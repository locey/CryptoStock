// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IPancakeRouter.sol";

/**
 * @title MockPancakeRouter
 * @dev 简化的 PancakeSwap Router Mock 实现
 * @notice 用于测试 USDT <-> CAKE 交换功能
 */
contract MockPancakeRouter is IPancakeRouter {
    using SafeERC20 for IERC20;
    
    // 模拟交换费率 (0.3% = 30/10000)
    uint256 public constant SWAP_FEE_BPS = 30;
    uint256 public constant BASIS_POINTS = 10000;
    
    address public immutable override factory;
    address public immutable override WETH;
    
    // 模拟价格比率 (1 USDT = 多少 CAKE)
    // 例如：1 USDT = 0.5 CAKE，则 usdtToCakeRate = 5000 (基于10000基点)
    uint256 public usdtToCakeRate = 5000; // 1 USDT = 0.5 CAKE
    uint256 public cakeToUsdtRate = 20000; // 1 CAKE = 2 USDT
    
    // 代币地址映射
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    // 事件
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed to
    );
    event RateUpdated(address indexed tokenA, address indexed tokenB, uint256 rate);
    
    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }
    
    /**
     * @dev 设置代币交换比率
     * @param tokenA 代币A地址
     * @param tokenB 代币B地址  
     * @param rate 交换比率 (基于10000基点)
     */
    function setExchangeRate(address tokenA, address tokenB, uint256 rate) external {
        exchangeRates[tokenA][tokenB] = rate;
        emit RateUpdated(tokenA, tokenB, rate);
    }
    
    /**
     * @dev 获取交换比率
     */
    function getExchangeRate(address tokenA, address tokenB) public view returns (uint256) {
        uint256 rate = exchangeRates[tokenA][tokenB];
        require(rate > 0, "Exchange rate not set");
        return rate;
    }
    
    /**
     * @dev 计算输出数量（考虑手续费）
     */
    function calculateAmountOut(
        uint256 amountIn,
        address tokenIn,
        address tokenOut
    ) public view returns (uint256) {
        uint256 rate = getExchangeRate(tokenIn, tokenOut);
        
        // 先扣除手续费
        uint256 amountAfterFee = amountIn * (BASIS_POINTS - SWAP_FEE_BPS) / BASIS_POINTS;
        
        // 根据汇率计算输出数量
        uint256 amountOut = amountAfterFee * rate / BASIS_POINTS;
        
        return amountOut;
    }
    
    /**
     * @dev 计算所需输入数量（考虑手续费）
     */
    function calculateAmountIn(
        uint256 amountOut,
        address tokenIn,
        address tokenOut
    ) public view returns (uint256) {
        uint256 rate = getExchangeRate(tokenIn, tokenOut);
        
        // 根据输出计算手续费前的数量
        uint256 amountBeforeFee = amountOut * BASIS_POINTS / rate;
        
        // 加上手续费
        uint256 amountIn = amountBeforeFee * BASIS_POINTS / (BASIS_POINTS - SWAP_FEE_BPS);
        
        return amountIn;
    }
    
    // ==================== 价格查询实现 ====================
    
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view override returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "Invalid path length");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        for (uint256 i = 0; i < path.length - 1; i++) {
            amounts[i + 1] = calculateAmountOut(amounts[i], path[i], path[i + 1]);
        }
    }
    
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external view override returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "Invalid path length");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        
        for (uint256 i = path.length - 1; i > 0; i--) {
            amounts[i - 1] = calculateAmountIn(amounts[i], path[i - 1], path[i]);
        }
    }
    
    // ==================== 交换实现 ====================
    
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction deadline exceeded");
        require(path.length >= 2, "Invalid path");
        
        // 计算输出数量
        amounts = this.getAmountsOut(amountIn, path);
        uint256 amountOut = amounts[amounts.length - 1];
        
        require(amountOut >= amountOutMin, "Insufficient output amount");
        
        // 执行转账
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length - 1]).safeTransfer(to, amountOut);
        
        emit SwapExecuted(path[0], path[path.length - 1], amountIn, amountOut, to);
    }
    
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction deadline exceeded");
        require(path.length >= 2, "Invalid path");
        
        // 计算所需输入数量
        amounts = this.getAmountsIn(amountOut, path);
        uint256 amountIn = amounts[0];
        
        require(amountIn <= amountInMax, "Excessive input amount");
        
        // 执行转账
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(path[path.length - 1]).safeTransfer(to, amountOut);
        
        emit SwapExecuted(path[0], path[path.length - 1], amountIn, amountOut, to);
    }
    
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override {
        require(block.timestamp <= deadline, "Transaction deadline exceeded");
        require(path.length >= 2, "Invalid path");
        
        // 记录转账前余额
        uint256 balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        
        // 执行标准交换
        this.swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline);
        
        // 验证实际收到的数量
        uint256 balanceAfter = IERC20(path[path.length - 1]).balanceOf(to);
        require(balanceAfter - balanceBefore >= amountOutMin, "Insufficient output amount");
    }
    
    // ==================== ETH 相关函数（简化实现）====================
    
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable override returns (uint256[] memory amounts) {
        require(path[0] == WETH, "Invalid path: must start with WETH");
        
        // 简化实现：直接按比率计算
        uint256 amountOut = calculateAmountOut(msg.value, path[0], path[path.length - 1]);
        require(amountOut >= amountOutMin, "Insufficient output amount");
        
        amounts = new uint256[](path.length);
        amounts[0] = msg.value;
        amounts[amounts.length - 1] = amountOut;
        
        IERC20(path[path.length - 1]).safeTransfer(to, amountOut);
        
        emit SwapExecuted(path[0], path[path.length - 1], msg.value, amountOut, to);
    }
    
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "Invalid path: must end with WETH");
        
        uint256 amountOut = calculateAmountOut(amountIn, path[0], path[path.length - 1]);
        require(amountOut >= amountOutMin, "Insufficient output amount");
        
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[amounts.length - 1] = amountOut;
        
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        payable(to).transfer(amountOut);
        
        emit SwapExecuted(path[0], path[path.length - 1], amountIn, amountOut, to);
    }
    
    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external override returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "Invalid path: must end with WETH");
        
        uint256 amountIn = calculateAmountIn(amountOut, path[0], path[path.length - 1]);
        require(amountIn <= amountInMax, "Excessive input amount");
        
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        amounts[amounts.length - 1] = amountOut;
        
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        payable(to).transfer(amountOut);
        
        emit SwapExecuted(path[0], path[path.length - 1], amountIn, amountOut, to);
    }
    
    // ==================== 流动性管理（占位实现）====================
    
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external override returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // 简化实现：返回期望的数量
        amountA = amountADesired;
        amountB = amountBDesired;
        liquidity = (amountA + amountB) / 2; // 简化的流动性计算
        
        // 转移代币
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
    }
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external override returns (uint256 amountA, uint256 amountB) {
        // 简化实现
        amountA = liquidity;
        amountB = liquidity;
        
        require(amountA >= amountAMin && amountB >= amountBMin, "Insufficient liquidity removed");
        
        IERC20(tokenA).safeTransfer(to, amountA);
        IERC20(tokenB).safeTransfer(to, amountB);
    }
    
    // ==================== 管理函数 ====================
    
    /**
     * @dev 为测试提供代币资金
     */
    function fundRouter(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }
    
    /**
     * @dev 获取路由器中的代币余额
     */
    function getRouterBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    /**
     * @dev 紧急提取代币（仅用于测试）
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external {
        IERC20(token).safeTransfer(to, amount);
    }
    
    // 接收 ETH
    receive() external payable {}
}