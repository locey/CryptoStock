// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IDefiAdapter.sol";
import "../interfaces/INonfungiblePositionManager.sol";
import "../interfaces/IChainlinkPriceFeed.sol";

/**
 * @title UniswapV3Adapter
 * @dev 可升级的 Uniswap V3 协议适配器 - 仅支持 USDT/ETH 流动性操作，支持 UUPS 升级
 */
contract UniswapV3Adapter is 
    Initializable,
    OwnableUpgradeable, 
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC721Receiver,
    IDefiAdapter 
{
    using SafeERC20 for IERC20;
    
    // Uniswap V3 Position Manager 合约地址
    address public positionManager;
    
    // USDT 代币地址
    address public usdtToken;
    
    // WETH 代币地址（用于与 ETH 配对）
    address public wethToken;
    
    // ETH/USD Chainlink 预言机地址
    address public ethUsdPriceFeed;
    
    // 用户 Position NFT 记录 (user => tokenId[])
    mapping(address => uint256[]) private _userPositions;
    
    // Position 原始投入记录 (tokenId => amounts)
    mapping(uint256 => uint256[2]) private _positionPrincipal; // [usdt, weth]
    
    // Position 初始美元价值记录 (tokenId => initialUsdValue)
    mapping(uint256 => uint256) private _positionInitialValue;
    
    // 用户累积提取的手续费 (user => totalUsdValue) - 以美元计价，6位精度
    mapping(address => uint256) private _userTotalCollectedFees;

    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev 初始化 Uniswap V3 适配器
     */
    function initialize(
        address _positionManager,
        address _usdtToken,
        address _wethToken,
        address _ethUsdPriceFeed,
        address _owner
    ) external initializer {
        require(_positionManager != address(0), "Invalid position manager address");
        require(_usdtToken != address(0), "Invalid USDT token address");
        require(_wethToken != address(0), "Invalid WETH token address");
        require(_ethUsdPriceFeed != address(0), "Invalid ETH/USD price feed address");
        require(_owner != address(0), "Invalid owner address");
        
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        positionManager = _positionManager;
        usdtToken = _usdtToken;
        wethToken = _wethToken;
        ethUsdPriceFeed = _ethUsdPriceFeed;
    }
    
    // ===== IDefiAdapter 接口实现 =====
    
    function supportsOperation(OperationType operationType) external pure override returns (bool) {
        return operationType == OperationType.ADD_LIQUIDITY || 
               operationType == OperationType.REMOVE_LIQUIDITY ||
               operationType == OperationType.COLLECT_FEES;
    }
    
    function executeOperation(
        OperationType operationType,
        OperationParams calldata params,
        uint24 feeRateBps
    ) external override whenNotPaused nonReentrant returns (OperationResult memory result) {
        if (operationType == OperationType.ADD_LIQUIDITY) {
            return _handleAddLiquidity(params, feeRateBps);
        } else if (operationType == OperationType.REMOVE_LIQUIDITY) {
            return _handleRemoveLiquidity(params, feeRateBps);
        } else if (operationType == OperationType.COLLECT_FEES) {
            return _handleCollectFees(params, feeRateBps);
        } else {
            revert("Unsupported operation");
        }
    }
    
    function estimateOperation(
        OperationType operationType,
        OperationParams calldata params
    ) external pure override returns (OperationResult memory result) {
        result.success = true;
        result.outputAmounts = new uint256[](params.amounts.length);
        
        if (operationType == OperationType.ADD_LIQUIDITY) {
            // 估算添加流动性后的 NFT tokenId (无法预估，返回 1)
            result.outputAmounts[0] = 1;
            result.message = "Estimated liquidity addition";
        } else if (operationType == OperationType.REMOVE_LIQUIDITY) {
            // 估算移除流动性后的代币数量 (简化返回输入金额)
            for (uint i = 0; i < params.amounts.length; i++) {
                result.outputAmounts[i] = params.amounts[i];
            }
            result.message = "Estimated liquidity removal";
        } else if (operationType == OperationType.COLLECT_FEES) {
            // 估算手续费收取 (无法精确预估，返回 0)
            result.outputAmounts = new uint256[](2);
            result.outputAmounts[0] = 0; // USDT 手续费
            result.outputAmounts[1] = 0; // WETH 手续费
            result.message = "Estimated fee collection";
        }
    }
    

    
    function getUserBalances(address user) external view override returns (uint256 balance) {
        // 返回用户拥有的 Position NFT 数量
        return _userPositions[user].length;
    }
    
    function getUserYield(address user) external view override returns (
        uint256 principal,
        uint256 currentValue,
        uint256 profit,
        bool isProfit
    ) {
        uint256[] memory positions = _userPositions[user];
        if (positions.length == 0) {
            return (0, 0, 0, true);
        }
        
        // 计算所有 Position 的总价值
        uint256 totalLiquidityValue = 0;
        uint256 totalFeeValue = 0;
        
        for (uint i = 0; i < positions.length; i++) {
            uint256 tokenId = positions[i];
            
            // 累加初始投入价值 (美元计价)
            principal += _positionInitialValue[tokenId];
            
            // 获取当前价值和手续费收益
            (, uint256 liquidityValue, uint256 feeValue) = getPositionValue(tokenId);
            totalLiquidityValue += liquidityValue;
            totalFeeValue += feeValue;
        }
        
        // 总当前价值 = 流动性价值 + 当前未提取手续费 + 历史累积提取手续费
        uint256 historicalFees = _userTotalCollectedFees[user];
        currentValue = totalLiquidityValue + totalFeeValue + historicalFees;
        
        // 计算盈亏
        if (currentValue >= principal) {
            profit = currentValue - principal;
            isProfit = true;
        } else {
            profit = principal - currentValue;
            isProfit = false;
        }
    }
    
    function getSupportedOperations() external pure override returns (OperationType[] memory operations) {
        operations = new OperationType[](3);
        operations[0] = OperationType.ADD_LIQUIDITY;    // Add Liquidity
        operations[1] = OperationType.REMOVE_LIQUIDITY; // Remove Liquidity
        operations[2] = OperationType.COLLECT_FEES;     // Collect Fees
    }
    
    function getAdapterName() external pure override returns (string memory) {
        return "UniswapV3Adapter";
    }
    
    function getAdapterVersion() external pure override returns (string memory) {
        return "1.0.0";
    }

    // ===== 价格查询函数 =====
    
    /**
     * @dev 从 Chainlink 获取 ETH/USD 价格
     * @return price ETH 价格 (18 位精度)
     */
    function getETHPrice() public view returns (uint256 price) {
        (, int256 rawPrice, , uint256 updatedAt, ) = AggregatorV3Interface(ethUsdPriceFeed).latestRoundData();
        require(rawPrice > 0, "Invalid ETH price");
        require(updatedAt > 0, "Price feed not updated");
        require(block.timestamp - updatedAt <= 3600, "Price feed stale"); // 1小时内的价格
        
        uint8 decimals = AggregatorV3Interface(ethUsdPriceFeed).decimals();
        // 将价格调整为 18 位精度
        if (decimals < 18) {
            price = uint256(rawPrice) * (10 ** (18 - decimals));
        } else {
            price = uint256(rawPrice) / (10 ** (decimals - 18));
        }
    }
    
    /**
     * @dev 计算 Position 的美元价值
     * @param usdtAmount USDT 数量 (6 位精度)
     * @param wethAmount WETH 数量 (18 位精度)
     * @return usdValue 总美元价值 (6 位精度，与 USDT 一致)
     */
    function calculateUSDValue(uint256 usdtAmount, uint256 wethAmount) public view returns (uint256 usdValue) {
        // USDT 价值 (假设 1 USDT = 1 USD)
        uint256 usdtValue = usdtAmount; // 已经是 6 位精度
        
        // WETH 价值
        uint256 ethPrice = getETHPrice(); // 18 位精度
        uint256 wethValue = (wethAmount * ethPrice) / 1e18; // 转换为 18 位精度
        wethValue = wethValue / 1e12; // 转换为 6 位精度 (与 USDT 一致)
        
        usdValue = usdtValue + wethValue;
    }
    
    /**
     * @dev 获取 Position 的当前流动性价值和手续费收益
     * @param tokenId Position NFT ID
     * @return liquidity 当前流动性数量
     * @return currentUsdValue 当前流动性的美元价值
     * @return feeUsdValue 累积手续费的美元价值
     */
    function getPositionValue(uint256 tokenId) public view returns (
        uint128 liquidity,
        uint256 currentUsdValue,
        uint256 feeUsdValue
    ) {
        // 获取 Position 基本信息
        uint128 tokensOwed0;
        uint128 tokensOwed1;
        (, , , , , , , liquidity, , , tokensOwed0, tokensOwed1) = 
            INonfungiblePositionManager(positionManager).positions(tokenId);
        
        if (liquidity > 0) {
            // 获取原始投入数量
            uint256[2] memory principal = _positionPrincipal[tokenId];
            uint256 principalUsdt = principal[0];
            uint256 principalWeth = principal[1];
            
            // 计算当前流动性价值 (简化计算，假设价格变化不大时流动性价值≈原始投入)
            // 实际应该根据当前价格范围和流动性计算精确价值
            currentUsdValue = calculateUSDValue(principalUsdt, principalWeth);
        }
        
        // 计算手续费收益
        if (tokensOwed0 > 0 || tokensOwed1 > 0) {
            feeUsdValue = calculateUSDValue(uint256(tokensOwed0), uint256(tokensOwed1));
        }
    }

    // ===== 内部操作处理函数 =====
    
    /**
     * @dev 处理添加流动性操作 - 整合所有子函数避免 stack too deep
     * params.amounts[0] = USDT amount, params.amounts[1] = WETH amount
     */
    function _handleAddLiquidity(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory result) {
        require(params.tokens.length == 2, "Add liquidity requires 2 tokens");
        require(params.amounts.length == 4, "Amount array should contain [usdtAmount, wethAmount, usdtMin, wethMin]");
        require(params.tokens[0] == usdtToken, "Token 0 must be USDT");
        require(params.tokens[1] == wethToken, "Token 1 must be WETH");
        require(params.recipient != address(0), "Recipient address must be specified");
        
        // 转入 USDT 和 WETH
        IERC20(usdtToken).safeTransferFrom(params.recipient, address(this), params.amounts[0]);
        IERC20(wethToken).safeTransferFrom(params.recipient, address(this), params.amounts[1]);
        
        // 计算净金额
        uint256 netUsdt = params.amounts[0] - (params.amounts[0] * feeRateBps) / 10000;
        uint256 netWeth = params.amounts[1] - (params.amounts[1] * feeRateBps) / 10000;
        
        // 批准代币
        IERC20(usdtToken).approve(positionManager, netUsdt);
        IERC20(wethToken).approve(positionManager, netWeth);
        
        // 构建 mint 参数
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: usdtToken,
            token1: wethToken,
            fee: feeRateBps,
            tickLower: -887220,
            tickUpper: 887220,
            amount0Desired: netUsdt,
            amount1Desired: netWeth,
            amount0Min: params.amounts[2], // 用户设置的 USDT 最小金额
            amount1Min: params.amounts[3], // 用户设置的 WETH 最小金额
            recipient: params.recipient, // NFT 直接发放给用户
            deadline: params.deadline
        });
        
        // 调用 mint 函数
        (uint256 tokenId,,,) = INonfungiblePositionManager(positionManager).mint(mintParams);
        
        // 记录用户 Position
        _userPositions[params.recipient].push(tokenId);
        _positionPrincipal[tokenId] = [netUsdt, netWeth];
        
        // 计算并保存初始美元价值
        uint256 initialUsdValue = calculateUSDValue(netUsdt, netWeth);
        _positionInitialValue[tokenId] = initialUsdValue;
        
        result.success = true;
        result.outputAmounts = new uint256[](1);
        result.outputAmounts[0] = tokenId;
        result.message = "Add liquidity successful";
        
        emit OperationExecuted(params.recipient, OperationType.ADD_LIQUIDITY, params.tokens, params.amounts, "");
        
        return result;
    }
    
    /**
     * @dev 处理移除流动性操作
     * params.amounts[0] = tokenId
     */
    function _handleRemoveLiquidity(
        OperationParams calldata params,
        uint24 /* feeRateBps */
    ) internal returns (OperationResult memory result) {
        require(params.tokens.length == 1, "Remove liquidity requires 1 token (tokenId)");
        require(params.amounts.length == 3, "Amount array should contain [tokenId, amount0Min, amount1Min]");
        require(params.recipient != address(0), "Recipient address must be specified");
        
        uint256 tokenId = params.amounts[0];
        
        // 验证用户拥有此 Position
        require(_isUserPosition(params.recipient, tokenId), "User does not own this position");
        
        // 获取流动性并移除
        (, , , , , , , uint128 liquidity, , , , ) = INonfungiblePositionManager(positionManager).positions(tokenId);
        
        if (liquidity > 0) {
            // 移除所有流动性
            INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: params.amounts[1], // 用户设置的 USDT 最小金额
                amount1Min: params.amounts[2], // 用户设置的 WETH 最小金额
                deadline: params.deadline
            });
            INonfungiblePositionManager(positionManager).decreaseLiquidity(decreaseParams);
        }
        
        // 收集所有费用和代币，直接转给用户
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: params.recipient, // 直接转给用户
            amount0Max: type(uint128).max, // 收集所有可用的 USDT (包括本金 + 手续费)
            amount1Max: type(uint128).max  // 收集所有可用的 WETH (包括本金 + 手续费)
        });
        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(positionManager).collect(collectParams);
        
        // 清理用户记录
        _removeUserPosition(params.recipient, tokenId);
        delete _positionPrincipal[tokenId];
        delete _positionInitialValue[tokenId];
        
        result.success = true;
        result.outputAmounts = new uint256[](2);
        result.outputAmounts[0] = amount0; // USDT
        result.outputAmounts[1] = amount1; // WETH
        result.message = "Remove liquidity successful";
        
        emit OperationExecuted(params.recipient, OperationType.REMOVE_LIQUIDITY, params.tokens, params.amounts, "");
        
        return result;
    }
    
    /**
     * @dev 处理手续费收取操作 (通过聚合合约调用)
     * 两种调用模式：
     * 1. 收取指定Position手续费：params.amounts = [tokenId]
     * 2. 收取所有Position手续费：params.amounts = [任意tokenId, 1] (第二个参数为1表示收取所有)
     * 注意：collectAll模式时第一个tokenId参数会被忽略，因为会遍历用户所有Position
     */
    function _handleCollectFees(
        OperationParams calldata params,
        uint24 /* feeRateBps */
    ) internal returns (OperationResult memory result) {
        require(params.amounts.length >= 1, "TokenId is required");
        require(params.recipient != address(0), "Recipient address must be specified");
        
        uint256 totalAmount0 = 0;
        uint256 totalAmount1 = 0;
        
        // 检查是否收取所有Position的手续费
        bool collectAll = params.amounts.length > 1 && params.amounts[1] == 1;
        
        if (collectAll) {
            // 收取用户所有Position的手续费
            uint256[] memory userPositions = _userPositions[params.recipient];
            require(userPositions.length > 0, "No positions found");
            
            for (uint i = 0; i < userPositions.length; i++) {
                uint256 tokenId = userPositions[i];
                
                // 提取每个Position的手续费
                INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
                    tokenId: tokenId,
                    recipient: params.recipient,
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                });
                
                (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(positionManager).collect(collectParams);
                totalAmount0 += amount0;
                totalAmount1 += amount1;
                
                // 累加到用户总收益记录（美元计价）
                if (amount0 > 0 || amount1 > 0) {
                    uint256 feeUsdValue = calculateUSDValue(amount0, amount1);
                    _userTotalCollectedFees[params.recipient] += feeUsdValue;
                    emit FeesCollected(params.recipient, tokenId, amount0, amount1);
                }
            }
        } else {
            // 只收取指定Position的手续费
            uint256 tokenId = params.amounts[0];
            require(_isUserPosition(params.recipient, tokenId), "User does not own this position");
            
            INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: params.recipient,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });
            
            (totalAmount0, totalAmount1) = INonfungiblePositionManager(positionManager).collect(collectParams);
            
            // 累加到用户总收益记录（美元计价）
            if (totalAmount0 > 0 || totalAmount1 > 0) {
                uint256 feeUsdValue = calculateUSDValue(totalAmount0, totalAmount1);
                _userTotalCollectedFees[params.recipient] += feeUsdValue;
                emit FeesCollected(params.recipient, tokenId, totalAmount0, totalAmount1);
            }
        }
        
        result.success = true;
        result.outputAmounts = new uint256[](2);
        result.outputAmounts[0] = totalAmount0; // USDT 手续费
        result.outputAmounts[1] = totalAmount1; // WETH 手续费
        result.message = collectAll ? "Collect all fees successful" : "Collect fees successful";
        
        emit OperationExecuted(params.recipient, OperationType.COLLECT_FEES, params.tokens, params.amounts, "");
        
        return result;
    }
    
    // ===== 事件定义 =====
    
    /**
     * @dev 手续费收取事件
     */
    event FeesCollected(
        address indexed user,
        uint256 indexed tokenId,
        uint256 amount0,
        uint256 amount1
    );
    
    // ===== 辅助函数 =====
    
    function _isUserPosition(address user, uint256 tokenId) internal view returns (bool) {
        uint256[] memory positions = _userPositions[user];
        for (uint i = 0; i < positions.length; i++) {
            if (positions[i] == tokenId) {
                return true;
            }
        }
        return false;
    }
    
    function _removeUserPosition(address user, uint256 tokenId) internal {
        uint256[] storage positions = _userPositions[user];
        for (uint i = 0; i < positions.length; i++) {
            if (positions[i] == tokenId) {
                positions[i] = positions[positions.length - 1];
                positions.pop();
                break;
            }
        }
    }

    // ===== UUPS 升级功能 =====
    
    /**
     * @dev UUPS 升级授权 - 只有所有者可以升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev 紧急暂停适配器
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 取消暂停适配器
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 获取合约版本
     */
    function getContractVersion() external pure returns (string memory) {
        return "1.0.0";
    }
    
    /**
     * @dev 获取用户的 Position NFT 列表
     */
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return _userPositions[user];
    }
    
    /**
     * @dev 获取 Position 的初始价值
     */
    function getPositionInitialValue(uint256 tokenId) external view returns (uint256) {
        return _positionInitialValue[tokenId];
    }
    
    /**
     * @dev 获取 Position 的原始投入
     */
    function getPositionPrincipal(uint256 tokenId) external view returns (uint256 usdt, uint256 weth) {
        uint256[2] memory principal = _positionPrincipal[tokenId];
        return (principal[0], principal[1]);
    }
    
    /**
     * @dev 设置 ETH/USD 价格预言机地址 (仅 owner)
     */
    function setEthUsdPriceFeed(address _ethUsdPriceFeed) external onlyOwner {
        require(_ethUsdPriceFeed != address(0), "Invalid price feed address");
        ethUsdPriceFeed = _ethUsdPriceFeed;
    }
    
    /**
     * @dev 获取用户历史累积提取的手续费收益（美元计价）
     * @param user 用户地址
     * @return totalCollectedFeesUsd 累积提取手续费的美元价值 (6位精度)
     */
    function getUserTotalCollectedFees(address user) external view returns (uint256 totalCollectedFeesUsd) {
        return _userTotalCollectedFees[user];
    }
    
    /**
     * @dev 获取用户收益详细信息
     * @param user 用户地址
     * @return currentPositionValue 当前Position价值
     * @return currentUnclaimedFees 当前未提取手续费价值
     * @return historicalCollectedFees 历史累积提取手续费价值
     * @return totalValue 总价值
     */
    function getUserYieldDetails(address user) external view returns (
        uint256 currentPositionValue,
        uint256 currentUnclaimedFees, 
        uint256 historicalCollectedFees,
        uint256 totalValue
    ) {
        uint256[] memory positions = _userPositions[user];
        
        for (uint i = 0; i < positions.length; i++) {
            uint256 tokenId = positions[i];
            (, uint256 liquidityValue, uint256 feeValue) = getPositionValue(tokenId);
            currentPositionValue += liquidityValue;
            currentUnclaimedFees += feeValue;
        }
        
        historicalCollectedFees = _userTotalCollectedFees[user];
        totalValue = currentPositionValue + currentUnclaimedFees + historicalCollectedFees;
    }
    
    /**
     * @dev 实现 IERC721Receiver 接口以接收 NFT
     */
    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 /* tokenId */,
        bytes calldata /* data */
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
