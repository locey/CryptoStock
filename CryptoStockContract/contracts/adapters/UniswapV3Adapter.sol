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
        address _owner
    ) external initializer {
        require(_positionManager != address(0), "Invalid position manager address");
        require(_usdtToken != address(0), "Invalid USDT token address");
        require(_wethToken != address(0), "Invalid WETH token address");
        require(_owner != address(0), "Invalid owner address");
        
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        positionManager = _positionManager;
        usdtToken = _usdtToken;
        wethToken = _wethToken;
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
        
        result.success = true;
        result.outputAmounts = new uint256[](1);
        result.outputAmounts[0] = tokenId;
        result.message = "Add liquidity successful";
        
        // 将 tokenId 编码到 returnData 中
        bytes memory returnData = abi.encode(tokenId);
        
        emit OperationExecuted(params.recipient, OperationType.ADD_LIQUIDITY, params.tokens, params.amounts, returnData);
        
        return result;
    }
    
    /**
     * @dev 处理移除流动性操作
     * params.tokenId = NFT tokenId
     * params.amounts[0] = amount0Min (token0 最小金额)
     * params.amounts[1] = amount1Min (token1 最小金额)
     */
    function _handleRemoveLiquidity(
        OperationParams calldata params,
        uint24 /* feeRateBps */
    ) internal returns (OperationResult memory result) {
        require(params.amounts.length == 2, "Amount array should contain [amount0Min, amount1Min]");
        require(params.recipient != address(0), "Recipient address must be specified");
        require(params.tokenId > 0, "Invalid tokenId");
        
        uint256 tokenId = params.tokenId;
        
        // 验证用户拥有此 Position
        require(INonfungiblePositionManager(positionManager).ownerOf(tokenId) == params.recipient, "User does not own this position");
        
        // 获取流动性并移除
        (, , , , , , , uint128 liquidity, , , , ) = INonfungiblePositionManager(positionManager).positions(tokenId);
        
        if (liquidity > 0) {
            // 移除所有流动性
            INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: params.amounts[0], // 用户设置的 USDT 最小金额
                amount1Min: params.amounts[1], // 用户设置的 WETH 最小金额
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
     * 1. 收取指定Position手续费：params.tokenId > 0
     * 2. 收取所有Position手续费：params.tokenId = 0 且 params.amounts[0] = 1
     */
    function _handleCollectFees(
        OperationParams calldata params,
        uint24 /* feeRateBps */
    ) internal returns (OperationResult memory result) {
        require(params.recipient != address(0), "Recipient address must be specified");
        require(params.tokenId > 0, "Invalid tokenId");
        
        uint256 tokenId = params.tokenId;
        
        // 验证用户拥有此 Position
        require(INonfungiblePositionManager(positionManager).ownerOf(tokenId) == params.recipient, "User does not own this position");
        
        INonfungiblePositionManager.CollectParams memory collectParams = INonfungiblePositionManager.CollectParams({
            tokenId: tokenId,
            recipient: params.recipient,
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
        });
        
        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(positionManager).collect(collectParams);
        
        // 发出事件记录手续费收集
        if (amount0 > 0 || amount1 > 0) {
            emit FeesCollected(params.recipient, tokenId, amount0, amount1);
        }
        
        result.success = true;
        result.outputAmounts = new uint256[](2);
        result.outputAmounts[0] = amount0; // USDT 手续费
        result.outputAmounts[1] = amount1; // WETH 手续费
        result.message = "Collect fees successful";
        
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
