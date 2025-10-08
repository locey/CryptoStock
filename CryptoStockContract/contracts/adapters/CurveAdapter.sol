// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../interfaces/IDefiAdapter.sol";
import "../interfaces/IOperationTypes.sol";
import "../interfaces/ICurve.sol";

/**
 * @title CurveAdapter
 * @notice Curve Finance 3Pool 协议适配器，支持流动性管理
 * @dev 实现与 Curve 3Pool 的添加和移除流动性功能
 */
contract CurveAdapter is 
    Initializable,
    OwnableUpgradeable, 
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    IDefiAdapter 
{
    using SafeERC20 for IERC20;

    // ============ 事件定义 ============
    
    event LiquidityAdded(
        address indexed user,
        address indexed pool,
        uint256[3] amounts,
        uint256 lpTokensReceived,
        uint256 timestamp
    );
    
    event LiquidityRemoved(
        address indexed user,
        address indexed pool,
        uint256 lpTokensBurned,
        uint256[3] tokensReceived,
        uint256 timestamp
    );

    // ============ 状态变量 ============
    
    /// @notice 支持的 Curve 3Pool 地址
    address public curve3Pool;

    // ============ 构造函数与初始化 ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice 初始化函数
     * @param initialOwner 合约所有者地址
     * @param _curve3Pool Curve 3Pool 合约地址
     */
    function initialize(address initialOwner, address _curve3Pool) external initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        
        curve3Pool = _curve3Pool;
    }

    // ============ 管理员功能 ============
    
    /**
     * @notice 设置 Curve 3Pool 地址
     * @param _curve3Pool 新的 3Pool 地址
     */
    function setCurve3Pool(address _curve3Pool) external onlyOwner {
        require(_curve3Pool != address(0), "Invalid pool address");
        curve3Pool = _curve3Pool;
    }

    // ============ IAdapter 接口实现 ============
    
    /**
     * @notice 获取适配器名称
     */
    function getAdapterName() external pure override returns (string memory) {
        return "CurveAdapter";
    }
    
    /**
     * @notice 获取适配器版本
     */
    function getAdapterVersion() external pure override returns (string memory) {
        return "1.0.0";
    }
    
    /**
     * @notice 检查是否支持指定操作类型
     */
    function supportsOperation(OperationType operationType) external pure override returns (bool) {
        return operationType == OperationType.ADD_LIQUIDITY || 
               operationType == OperationType.REMOVE_LIQUIDITY;
    }
    
    /**
     * @notice 获取支持的操作类型列表
     */
    function getSupportedOperations() external pure override returns (OperationType[] memory operations) {
        operations = new OperationType[](2);
        operations[0] = OperationType.ADD_LIQUIDITY;
        operations[1] = OperationType.REMOVE_LIQUIDITY;
    }
    
    /**
     * @notice 执行操作
     * @param operationType 操作类型
     * @param params 操作参数
     * @param feeRateBps 手续费率（基点）
     */
    function executeOperation(
        OperationType operationType,
        OperationParams calldata params,
        uint24 feeRateBps
    ) external override nonReentrant returns (OperationResult memory) {
        require(curve3Pool != address(0), "3Pool not set");
        require(params.recipient != address(0), "Invalid recipient address");
        require(feeRateBps <= 10000, "Fee rate too high"); // 最大100%
        
        if (operationType == OperationType.ADD_LIQUIDITY) {
            return _handleAddLiquidity(params, feeRateBps);
        } else if (operationType == OperationType.REMOVE_LIQUIDITY) {
            return _handleRemoveLiquidity(params, feeRateBps);
        } else {
            revert("Unsupported operation");
        }
    }
    
    /**
     * @notice 预估操作结果
     */
    function estimateOperation(
        OperationType operationType,
        OperationParams calldata params
    ) external view override returns (OperationResult memory) {
        if (operationType == OperationType.ADD_LIQUIDITY) {
            uint256[3] memory amounts;
            amounts[0] = params.amounts[0];
            amounts[1] = params.amounts[1];
            amounts[2] = params.amounts[2];
            
            uint256 estimatedLp = ICurve(curve3Pool).calc_token_amount(amounts, true);
            
            uint256[] memory outputAmounts = new uint256[](1);
            outputAmounts[0] = estimatedLp;
            
            return OperationResult({
                success: true,
                outputAmounts: outputAmounts,
                returnData: abi.encode(estimatedLp),
                message: "Estimated add liquidity result"
            });
        }
        
        revert("Unsupported operation for estimation");
    }
    
    // ============ 内部操作处理函数 ============
    
    /**
     * @notice 处理添加流动性操作
     * @param params 操作参数
     * @param feeRateBps 手续费率（基点）
     */
    function _handleAddLiquidity(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory) {
        require(params.tokens.length == 3, "Curve 3Pool requires exactly 3 tokens");
        require(params.amounts.length >= 4, "Invalid amounts array"); // [amount0, amount1, amount2, minLpTokens]
        require(params.recipient != address(0), "Invalid recipient address");
        
        ICurve pool = ICurve(curve3Pool);
        
        // 准备流动性数组
        uint256[3] memory amounts;
        amounts[0] = params.amounts[0];
        amounts[1] = params.amounts[1]; 
        amounts[2] = params.amounts[2];
        uint256 minLpTokens = params.amounts[3];
        
        // 验证输入参数
        require(amounts[0] > 0 || amounts[1] > 0 || amounts[2] > 0, "At least one token amount must be greater than 0");
        
        // 计算总投入价值（简化为总金额）
        uint256 totalValue = amounts[0] + amounts[1] + amounts[2];
        require(totalValue > 0, "No tokens provided");
        
        // 验证每个代币的余额和授权
        for (uint i = 0; i < 3; i++) {
            if (amounts[i] > 0) {
                address token = params.tokens[i];
                require(token != address(0), string(abi.encodePacked("Token ", i, " address is zero")));
                
                // 检查用户余额
                uint256 userBalance = IERC20(token).balanceOf(params.recipient);
                require(userBalance >= amounts[i], string(abi.encodePacked("Insufficient balance for token ", i)));
                
                // 检查用户对本合约的授权
                uint256 allowance = IERC20(token).allowance(params.recipient, address(this));
                require(allowance >= amounts[i], string(abi.encodePacked("Insufficient allowance for token ", i)));
            }
        }
        
        // 转入代币到合约并授权给池子
        for (uint i = 0; i < 3; i++) {
            if (amounts[i] > 0) {
                IERC20(params.tokens[i]).safeTransferFrom(params.recipient, address(this), amounts[i]);
                IERC20(params.tokens[i]).forceApprove(curve3Pool, amounts[i]);
            }
        }
        
        // 记录添加前的 LP 代币余额
        uint256 lpBalanceBefore = IERC20(curve3Pool).balanceOf(address(this));
        
        // 添加流动性
        pool.add_liquidity(amounts, minLpTokens);
        
        // 计算获得的 LP 代币数量
        uint256 lpBalanceAfter = IERC20(curve3Pool).balanceOf(address(this));
        uint256 lpTokensReceived = lpBalanceAfter - lpBalanceBefore;
        
        require(lpTokensReceived > 0, "No LP tokens received");
        
        // 从LP代币中扣除手续费
        uint256 lpFeeAmount = (lpTokensReceived * feeRateBps) / 10000;
        uint256 netLpTokens = lpTokensReceived - lpFeeAmount;
        
        // 转移净LP代币给用户
        IERC20(curve3Pool).safeTransfer(params.recipient, netLpTokens);
        
        emit LiquidityAdded(params.recipient, curve3Pool, amounts, netLpTokens, block.timestamp);
        
        // 构造返回结果
        uint256[] memory outputAmounts = new uint256[](1);
        outputAmounts[0] = netLpTokens;
        
        return OperationResult({
            success: true,
            outputAmounts: outputAmounts,
            returnData: abi.encode(netLpTokens),
            message: "Liquidity added successfully"
        });
    }
    
    /**
     * @notice 处理移除流动性操作
     * @param params 操作参数
     * @param feeRateBps 手续费率（基点）
     */
    function _handleRemoveLiquidity(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory) {
        require(params.amounts.length >= 4, "Invalid amounts array"); // [lpTokens, minAmount0, minAmount1, minAmount2]
        
        ICurve pool = ICurve(curve3Pool);
        
        uint256 lpTokensToRemove = params.amounts[0];
        
        require(lpTokensToRemove > 0, "LP tokens amount must be positive");
        
        // 从LP代币中扣除手续费
        uint256 lpFeeAmount = (lpTokensToRemove * feeRateBps) / 10000;
        uint256 netLpToRemove = lpTokensToRemove - lpFeeAmount;
        
        // 转入 LP 代币（用户需要转入完整数量，但只移除净数量）
        IERC20(curve3Pool).safeTransferFrom(params.recipient, address(this), lpTokensToRemove);
        
        // 记录移除前各代币余额
        uint256[3] memory balancesBefore;
        for (uint i = 0; i < 3; i++) {
            balancesBefore[i] = IERC20(params.tokens[i]).balanceOf(address(this));
        }
        
        // 移除流动性（只移除扣费后的净LP数量）
        pool.remove_liquidity(netLpToRemove, [params.amounts[1],params.amounts[2],params.amounts[3]]);
        
        // 计算获得的代币数量并直接转给用户
        uint256[3] memory tokensReceived;
        
        for (uint i = 0; i < 3; i++) {
            uint256 balanceAfter = IERC20(params.tokens[i]).balanceOf(address(this));
            tokensReceived[i] = balanceAfter - balancesBefore[i];
            
            if (tokensReceived[i] > 0) {
                IERC20(params.tokens[i]).safeTransfer(params.recipient, tokensReceived[i]);
            }
        }
        
        emit LiquidityRemoved(params.recipient, curve3Pool, netLpToRemove, tokensReceived, block.timestamp);
        
        
        // 构造返回结果
        uint256[] memory outputAmounts = new uint256[](3);
        outputAmounts[0] = tokensReceived[0];
        outputAmounts[1] = tokensReceived[1];
        outputAmounts[2] = tokensReceived[2];
        
        return OperationResult({
            success: true,
            outputAmounts: outputAmounts,
            returnData: abi.encode(tokensReceived),
            message: "Liquidity removed successfully"
        });
    }

    // ============ 查询功能 ============
    
    /**
     * @notice 获取用户当前 LP 代币余额对应的价值
     * @param user 用户地址
     */
    function getUserCurrentValue(address user) external view returns (uint256) {
        uint256 lpBalance = IERC20(curve3Pool).balanceOf(user);
        if (lpBalance == 0) return 0;
        
        ICurve pool = ICurve(curve3Pool);
        uint256 virtualPrice = pool.get_virtual_price();
        return (lpBalance * virtualPrice) / 1e18;
    }
    
    /**
     * @notice 预览添加流动性能获得的 LP 代币数量
     * @param amounts 各代币数量
     */
    function previewAddLiquidity(uint256[3] calldata amounts) external view returns (uint256) {
        require(curve3Pool != address(0), "3Pool not set");
        ICurve pool = ICurve(curve3Pool);
        return pool.calc_token_amount(amounts, true);
    }
    
    /**
     * @notice 预览移除流动性能获得的代币数量
     * @param lpTokenAmount LP 代币数量
     */
    function previewRemoveLiquidity(uint256 lpTokenAmount) external view returns (uint256[3] memory amounts) {
        require(curve3Pool != address(0), "3Pool not set");
        ICurve pool = ICurve(curve3Pool);
        
        uint256 totalSupply = IERC20(curve3Pool).totalSupply();
        if (totalSupply == 0) {
            return [uint256(0), uint256(0), uint256(0)];
        }
        
        // 按比例计算各代币数量
        for (uint i = 0; i < 3; i++) {
            uint256 poolBalance = pool.balances(i);
            amounts[i] = (poolBalance * lpTokenAmount) / totalSupply;
        }
    }

    // ============ 紧急功能 ============
    
    /**
     * @notice 紧急提取代币（仅限所有者）
     * @param token 代币地址
     * @param amount 提取数量
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============ UUPS 升级授权 ============
    
    /**
     * @notice 授权升级（仅限所有者）
     * @param newImplementation 新实现地址
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}