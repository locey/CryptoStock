// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IDefiAdapter.sol";
import "../interfaces/IOperationTypes.sol";
import "../interfaces/IPancakeRouter.sol";

/**
 * @title PancakeAdapter
 * @notice PancakeSwap 协议适配器，支持代币交换操作
 * @dev 实现与 PancakeSwap Router 的代币交换功能，支持 UUPS 升级
 */
contract PancakeAdapter is 
    Initializable,
    OwnableUpgradeable, 
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IDefiAdapter 
{
    using SafeERC20 for IERC20;
    
    // ============ 事件定义 ============
    
    event TokenSwapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    
    // ============ 状态变量 ============
    
    /// @notice PancakeSwap Router 合约地址
    address public pancakeRouter;
    
    /// @notice 支持的代币列表
    mapping(address => bool) public supportedTokens;
    
    // ============ 错误定义 ============
    
    error InvalidRouter();
    error UnsupportedToken(address token);
    error SwapFailed();
    
    // ============ 修饰符 ============
    
    modifier validRouter() {
        if (pancakeRouter == address(0)) revert InvalidRouter();
        _;
    }
    
    // ============ 初始化函数 ============
    
    function initialize(
        address _pancakeRouter
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        if (_pancakeRouter == address(0)) revert InvalidRouter();
        
        pancakeRouter = _pancakeRouter;
    }
    
    // ============ 管理函数 ============
    
    /**
     * @notice 设置 PancakeRouter 地址
     */
    function setPancakeRouter(address _pancakeRouter) external onlyOwner {
        if (_pancakeRouter == address(0)) revert InvalidRouter();
        pancakeRouter = _pancakeRouter;
    }
    
    /**
     * @notice 添加支持的代币
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }
    
    /**
     * @notice 移除支持的代币
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }
    

    
    // ============ IDefiAdapter 实现 ============
    
    function getAdapterName() external pure override returns (string memory) {
        return "PancakeAdapter";
    }
    
    function getAdapterVersion() external pure override returns (string memory) {
        return "1.0.0";
    }
    
    function supportsOperation(OperationType operationType) external pure override returns (bool) {
        return operationType == OperationType.SWAP ||
               operationType == OperationType.SWAP_EXACT_INPUT ||
               operationType == OperationType.SWAP_EXACT_OUTPUT;
    }
    
    function getSupportedOperations() external pure override returns (OperationType[] memory operations) {
        operations = new OperationType[](3);
        operations[0] = OperationType.SWAP;
        operations[1] = OperationType.SWAP_EXACT_INPUT;
        operations[2] = OperationType.SWAP_EXACT_OUTPUT;
    }
    
    function executeOperation(
        OperationType operationType,
        OperationParams calldata params,
        uint24 feeRateBps
    ) external override nonReentrant whenNotPaused validRouter returns (OperationResult memory) {
        require(pancakeRouter != address(0), "Router not set");
        
        if (operationType == OperationType.SWAP || operationType == OperationType.SWAP_EXACT_INPUT) {
            return _handleSwapExactInput(params, feeRateBps);
        } else if (operationType == OperationType.SWAP_EXACT_OUTPUT) {
            return _handleSwapExactOutput(params, feeRateBps);
        } else {
            revert("Unsupported operation");
        }
    }
    
    function estimateOperation(
        OperationType operationType,
        OperationParams calldata params
    ) external view validRouter returns (OperationResult memory result) {
        address tokenIn = params.tokens[0];
        address tokenOut = params.tokens[1];
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        if (operationType == OperationType.SWAP || operationType == OperationType.SWAP_EXACT_INPUT) {
            uint256 amountIn = params.amounts[0];
            uint256[] memory amountsOut = IPancakeRouter(pancakeRouter).getAmountsOut(amountIn, path);
            
            result.success = true;
            result.outputAmounts = new uint256[](1);
            result.outputAmounts[0] = amountsOut[amountsOut.length - 1];
            result.message = "Swap estimation successful";
            
        } else if (operationType == OperationType.SWAP_EXACT_OUTPUT) {
            uint256 amountOut = params.amounts[0];
            uint256[] memory amountsIn = IPancakeRouter(pancakeRouter).getAmountsIn(amountOut, path);
            
            result.success = true;
            result.outputAmounts = new uint256[](1);
            result.outputAmounts[0] = amountsIn[0];
            result.message = "Swap estimation successful";
        }
    }
    
    // ============ 内部函数 ============
    
    /**
     * @notice 处理精确输入交换
     * @param params 操作参数
     * @param feeRateBps 手续费率（基点）
     */
    function _handleSwapExactInput(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory) {
        // 参数验证
        require(params.tokens.length >= 2, "Invalid tokens array");
        require(params.amounts.length >= 2, "Invalid amounts array"); // [amountIn, minAmountOut]
        
        // 检查代币支持
        if (!supportedTokens[params.tokens[0]]) revert UnsupportedToken(params.tokens[0]);
        if (!supportedTokens[params.tokens[1]]) revert UnsupportedToken(params.tokens[1]);
        
        // 计算实际输入数量
        uint256 actualAmountIn = params.amounts[0] - (params.amounts[0] * feeRateBps) / 10000;
        
        // 创建交换路径
        address[] memory path = new address[](2);
        path[0] = params.tokens[0];
        path[1] = params.tokens[1];
        
        // 用户提供最小输出数量 (滑点保护)
        uint256 minAmountOut = params.amounts[1];
        
        // 检查用户授权
        require(
            IERC20(params.tokens[0]).allowance(params.recipient, address(this)) >= params.amounts[0],
            "Insufficient allowance"
        );
        
        // 检查用户余额
        require(
            IERC20(params.tokens[0]).balanceOf(params.recipient) >= params.amounts[0],
            "Insufficient balance"
        );
        
        // 转入代币并授权
        IERC20(params.tokens[0]).safeTransferFrom(params.recipient, address(this), params.amounts[0]);
        IERC20(params.tokens[0]).forceApprove(pancakeRouter, actualAmountIn);
        
        try IPancakeRouter(pancakeRouter).swapExactTokensForTokens(
            actualAmountIn,
            minAmountOut,
            path,
            params.recipient,
            params.deadline
        ) returns (uint256[] memory amounts) {
            
            emit TokenSwapped(params.recipient, params.tokens[0], params.tokens[1], actualAmountIn, amounts[1], block.timestamp);
            
            uint256[] memory outputAmounts = new uint256[](1);
            outputAmounts[0] = amounts[1];
            
            // 清理授权
            IERC20(params.tokens[0]).forceApprove(pancakeRouter, 0);
            
            return OperationResult({
                success: true,
                outputAmounts: outputAmounts,
                returnData: abi.encode(amounts[1]),
                message: "Swap successful"
            });
            
        } catch {
            IERC20(params.tokens[0]).safeTransfer(params.recipient, params.amounts[0]);
            IERC20(params.tokens[0]).forceApprove(pancakeRouter, 0);
            revert SwapFailed();
        }
    }
    
    /**
     * @notice 处理精确输出交换
     * @param params 操作参数
     * @param feeRateBps 手续费率（基点）
     */
    function _handleSwapExactOutput(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory) {
        // 参数验证
        require(params.tokens.length >= 2, "Invalid tokens array");
        require(params.amounts.length >= 2, "Invalid amounts array");
        
        // 检查代币支持
        if (!supportedTokens[params.tokens[0]]) revert UnsupportedToken(params.tokens[0]);
        if (!supportedTokens[params.tokens[1]]) revert UnsupportedToken(params.tokens[1]);
        
        // 创建交换路径
        address[] memory path = new address[](2);
        path[0] = params.tokens[0];
        path[1] = params.tokens[1];
        
        // 用户提供的最大输入数量
        uint256 maxAmountIn = params.amounts[1];
        // 计算手续费
        uint256 fee = (maxAmountIn * feeRateBps) / 10000;
        // 实际用于交换的数量
        uint256 actualMaxAmountIn = maxAmountIn - fee;
        
        // 检查用户授权
        require(
            IERC20(params.tokens[0]).allowance(params.recipient, address(this)) >= maxAmountIn,
            "Insufficient allowance"
        );
        
        // 检查用户余额
        require(
            IERC20(params.tokens[0]).balanceOf(params.recipient) >= maxAmountIn,
            "Insufficient balance"
        );
        
        // 转入代币并授权
        IERC20(params.tokens[0]).safeTransferFrom(params.recipient, address(this), maxAmountIn);
        IERC20(params.tokens[0]).forceApprove(pancakeRouter, actualMaxAmountIn);
        
        try IPancakeRouter(pancakeRouter).swapTokensForExactTokens(
            params.amounts[0],
            actualMaxAmountIn,
            path,
            params.recipient,
            params.deadline
        ) returns (uint256[] memory amounts) {
            
            // 退还剩余代币（实际使用量 + 手续费 vs 用户支付总额）
            uint256 totalUsed = amounts[0] + fee;
            if (maxAmountIn > totalUsed) {
                IERC20(params.tokens[0]).safeTransfer(params.recipient, maxAmountIn - totalUsed);
            }
            
            emit TokenSwapped(params.recipient, params.tokens[0], params.tokens[1], amounts[0], params.amounts[0], block.timestamp);
            
            uint256[] memory outputAmounts = new uint256[](2);
            outputAmounts[0] = params.amounts[0];
            outputAmounts[1] = amounts[0];
            
            // 清理授权
            IERC20(params.tokens[0]).forceApprove(pancakeRouter, 0);
            
            return OperationResult({
                success: true,
                outputAmounts: outputAmounts,
                returnData: abi.encode(params.amounts[0], amounts[0]),
                message: "Swap successful"
            });
            
        } catch {
            IERC20(params.tokens[0]).safeTransfer(params.recipient, maxAmountIn);
            IERC20(params.tokens[0]).forceApprove(pancakeRouter, 0);
            revert SwapFailed();
        }
    }
    
    
    
    // ============ 管理函数 ============
    
    /**
     * @notice 紧急提取代币
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    /**
     * @notice 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ 升级函数 ============
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}