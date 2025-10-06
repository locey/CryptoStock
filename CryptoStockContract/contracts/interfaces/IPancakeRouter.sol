// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @title IPancakeRouter
 * @dev PancakeSwap Router V2 接口 - 用于代币交换
 * @notice 支持 USDT <-> CAKE 等代币对交换
 */
interface IPancakeRouter {
    
    /**
     * @dev 获取工厂合约地址
     */
    function factory() external view returns (address);
    
    /**
     * @dev 获取 WETH 地址
     */
    function WETH() external view returns (address);
    
    // ==================== 价格查询函数 ====================
    
    /**
     * @dev 根据精确输入数量计算输出数量
     * @param amountIn 输入代币数量
     * @param path 交换路径 [输入代币地址, 输出代币地址] 或通过中介代币的路径
     * @return amounts 每步交换的数量数组，最后一个元素是最终输出数量
     */
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view returns (uint256[] memory amounts);
    
    /**
     * @dev 根据精确输出数量计算输入数量
     * @param amountOut 期望的输出代币数量
     * @param path 交换路径 [输入代币地址, 输出代币地址]
     * @return amounts 每步交换的数量数组，第一个元素是需要的输入数量
     */
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        external view returns (uint256[] memory amounts);
    
    // ==================== 代币交换函数 ====================
    
    /**
     * @dev 精确输入代币交换 - 指定输入数量，获得尽可能多的输出
     * @param amountIn 精确的输入代币数量
     * @param amountOutMin 最小接受的输出数量（滑点保护）
     * @param path 交换路径数组
     * @param to 接收输出代币的地址
     * @param deadline 交易截止时间戳
     * @return amounts 实际交换的数量数组
     * 
     * 使用场景：用固定数量的 USDT 换取尽可能多的 CAKE
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @dev 精确输出代币交换 - 指定输出数量，花费尽可能少的输入
     * @param amountOut 精确的输出代币数量
     * @param amountInMax 最大允许的输入数量（滑点保护）
     * @param path 交换路径数组
     * @param to 接收输出代币的地址
     * @param deadline 交易截止时间戳
     * @return amounts 实际交换的数量数组
     * 
     * 使用场景：想要获得固定数量的 CAKE，花费尽可能少的 USDT
     */
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @dev 支持转账手续费代币的精确输入交换
     * @param amountIn 输入数量
     * @param amountOutMin 最小输出数量
     * @param path 交换路径
     * @param to 接收地址
     * @param deadline 截止时间
     * 
     * 使用场景：当 USDT 或 CAKE 有转账手续费时使用
     */
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
    
    // ==================== ETH 相关交换函数 ====================
    
    /**
     * @dev 用精确的 ETH 换取代币
     */
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
    
    /**
     * @dev 用代币换取精确的 ETH
     */
    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    /**
     * @dev 用精确的代币换取 ETH
     */
    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    // ==================== 流动性管理函数 ====================
    
    /**
     * @dev 添加流动性
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    
    /**
     * @dev 移除流动性
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

/**
 * @title 使用示例和最佳实践
 * 
 * 1. USDT 换 CAKE（精确输入）：
 * ```solidity
 * // 1. 先查询能换到多少 CAKE
 * address[] memory path = new address[](2);
 * path[0] = USDT_ADDRESS;
 * path[1] = CAKE_ADDRESS;
 * uint256[] memory amounts = router.getAmountsOut(usdtAmount, path);
 * uint256 expectedCake = amounts[1];
 * 
 * // 2. 设置滑点保护（例如 5% 滑点）
 * uint256 minCake = expectedCake * 95 / 100;
 * 
 * // 3. 执行交换
 * IERC20(USDT_ADDRESS).approve(address(router), usdtAmount);
 * router.swapExactTokensForTokens(
 *     usdtAmount,
 *     minCake,
 *     path,
 *     msg.sender,
 *     block.timestamp + 300
 * );
 * ```
 * 
 * 2. CAKE 换 USDT（精确输出）：
 * ```solidity
 * // 1. 查询需要多少 CAKE
 * address[] memory path = new address[](2);
 * path[0] = CAKE_ADDRESS;
 * path[1] = USDT_ADDRESS;
 * uint256[] memory amounts = router.getAmountsIn(targetUsdtAmount, path);
 * uint256 requiredCake = amounts[0];
 * 
 * // 2. 设置滑点保护
 * uint256 maxCake = requiredCake * 105 / 100;
 * 
 * // 3. 执行交换
 * IERC20(CAKE_ADDRESS).approve(address(router), maxCake);
 * router.swapTokensForExactTokens(
 *     targetUsdtAmount,
 *     maxCake,
 *     path,
 *     msg.sender,
 *     block.timestamp + 300
 * );
 * ```
 * 
 * 注意事项：
 * - 交换前必须先 approve 代币给 router
 * - path 数组定义交换路径，如果没有直接交易对可能需要中介代币
 * - deadline 应该设置合理的时间，防止交易被长时间挂起
 * - 滑点保护很重要，防止价格波动导致损失
 * - 对于有转账税的代币，使用 SupportingFeeOnTransferTokens 版本
 */