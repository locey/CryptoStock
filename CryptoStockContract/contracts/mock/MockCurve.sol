// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ICurve.sol";
import "./MockERC20.sol";

/**
 * @title MockCurve
 * @notice Mock Curve Finance 3Pool 合约，用于测试
 * @dev 简化实现，支持添加流动性、移除流动性和基础收益生成
 */
contract MockCurve is ICurve, ERC20 {
    
    // ============ 状态变量 ============
    
    /// @notice 池子中的三个代币地址 [token0, token1, token2]
    address[3] public coins;
    
    /// @notice 池子中各代币的余额
    uint256[3] public balances;
    
    /// @notice A 参数（稳定性参数）
    uint256 public A;
    
    /// @notice 交易手续费率 (基点)
    uint256 public fee;
    
    /// @notice 管理员手续费率 (基点)
    uint256 public admin_fee;
    
    /// @notice 合约所有者
    address public owner;
    
    /// @notice 虚拟价格 (1e18 = 1.0)
    uint256 private _virtual_price;
    
    /// @notice LP 代币总供应量跟踪
    uint256 private _totalSupply;

    // ============ 构造函数 ============
    
    /**
     * @notice 构造函数
     * @param _owner 所有者地址
     * @param _coins 三个代币地址
     * @param _A A 参数
     * @param _fee 交易手续费
     * @param _admin_fee 管理员手续费
     */
    constructor(
        address _owner,
        address[3] memory _coins,
        uint256 _A,
        uint256 _fee,
        uint256 _admin_fee
    ) ERC20("Curve 3Pool LP Token", "3CRV") {
        owner = _owner;
        coins = _coins;
        A = _A;
        fee = _fee;
        admin_fee = _admin_fee;
        _virtual_price = 1e18; // 初始虚拟价格为 1.0
    }

    // ============ 修饰符 ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ============ 查询函数实现 ============
    
    /**
     * @notice 获取虚拟价格
     */
    function get_virtual_price() external view override returns (uint256) {
        return _virtual_price;
    }
    
    /**
     * @notice 计算添加流动性能获得的 LP 代币数量
     * @param amounts 各代币数量
     * @param deposit 是否为存款操作
     */
    function calc_token_amount(
        uint256[3] memory amounts,
        bool deposit
    ) external view override returns (uint256) {
        if (!deposit) {
            // 移除流动性的计算
            uint256 totalValue = 0;
            for (uint i = 0; i < 3; i++) {
                totalValue += amounts[i];
            }
            return totalValue * 1e18 / _virtual_price;
        }
        
        // 添加流动性的计算 - 简化为按比例计算
        uint256 totalValue = 0;
        for (uint i = 0; i < 3; i++) {
            totalValue += amounts[i];
        }
        
        if (totalSupply() == 0) {
            return totalValue; // 首次添加流动性
        }
        
        // 按现有流动性比例计算
        uint256 currentTotalValue = 0;
        for (uint i = 0; i < 3; i++) {
            currentTotalValue += balances[i];
        }
        
        if (currentTotalValue == 0) {
            return totalValue;
        }
        
        return (totalValue * totalSupply()) / currentTotalValue;
    }
    
    /**
     * @notice 获取交换输出数量
     * @param i 输入代币索引
     * @param j 输出代币索引  
     * @param dx 输入数量
     */
    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view override returns (uint256) {
        require(i != j, "Same coin");
        require(i >= 0 && i < 3, "Invalid input coin");
        require(j >= 0 && j < 3, "Invalid output coin");
        
        // 简化计算：1:1 交换减去手续费
        uint256 feeAmount = (dx * fee) / 10000;
        return dx - feeAmount;
    }
    
    /**
     * @notice 获取底层代币交换输出数量（与 get_dy 相同）
     */
    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 dx
    ) external view override returns (uint256) {
        return this.get_dy(i, j, dx);
    }
    
    /**
     * @notice 计算移除单一代币的数量
     * @param _token_amount LP 代币数量
     * @param i 要移除的代币索引
     */
    function calc_withdraw_one_coin(
        uint256 _token_amount,
        int128 i
    ) external view override returns (uint256) {
        require(i >= 0 && i < 3, "Invalid coin index");
        
        if (totalSupply() == 0) {
            return 0;
        }
        
        // 按 LP 代币比例计算能获得的代币数量
        return (balances[uint256(uint128(i))] * _token_amount) / totalSupply();
    }

    // ============ 流动性管理函数 ============
    
    /**
     * @notice 添加流动性
     * @param amounts 各代币数量 [amount0, amount1, amount2]
     * @param min_mint_amount 最少铸造的 LP 代币数量
     */
    function add_liquidity(
        uint256[3] memory amounts,
        uint256 min_mint_amount
    ) external override {
        uint256 totalValue = 0;
        
        // 转入代币并更新余额
        for (uint i = 0; i < 3; i++) {
            if (amounts[i] > 0) {
                IERC20(coins[i]).transferFrom(msg.sender, address(this), amounts[i]);
                balances[i] += amounts[i];
                totalValue += amounts[i];
            }
        }
        
        require(totalValue > 0, "No tokens provided");
        
        // 计算要铸造的 LP 代币数量
        uint256 lpTokensToMint;
        if (totalSupply() == 0) {
            lpTokensToMint = totalValue;
        } else {
            // 按比例计算
            uint256 currentTotalValue = 0;
            for (uint i = 0; i < 3; i++) {
                currentTotalValue += balances[i];
            }
            lpTokensToMint = (totalValue * totalSupply()) / (currentTotalValue - totalValue);
        }
        
        require(lpTokensToMint >= min_mint_amount, "Slippage exceeded");
        
        // 铸造 LP 代币
        _mint(msg.sender, lpTokensToMint);
        
        // 模拟虚拟价格增长 (0.01% 收益)
        _virtual_price = (_virtual_price * 10001) / 10000;
        
        // 发出事件
        uint256[3] memory fees; // 简化：费用为0
        emit AddLiquidity(
            msg.sender,
            amounts,
            fees,
            0, // invariant 简化为0
            totalSupply()
        );
    }
    
    /**
     * @notice 移除流动性
     * @param _amount LP 代币数量
     * @param min_amounts 各代币最小数量 [min0, min1, min2]
     */
    function remove_liquidity(
        uint256 _amount,
        uint256[3] memory min_amounts
    ) external override {
        require(_amount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= _amount, "Insufficient LP tokens");
        
        uint256[3] memory amountsToWithdraw;
        
        // 按比例计算各代币提取数量
        for (uint i = 0; i < 3; i++) {
            amountsToWithdraw[i] = (balances[i] * _amount) / totalSupply();
            require(amountsToWithdraw[i] >= min_amounts[i], "Slippage exceeded");
            
            // 更新余额并转出代币
            if (amountsToWithdraw[i] > 0) {
                balances[i] -= amountsToWithdraw[i];
                
                // 添加 0.2% 的额外收益（模拟交易费收益）
                uint256 bonus = (amountsToWithdraw[i] * 20) / 10000;
                if (coins[i] != address(0)) {
                    MockERC20(coins[i]).mint(address(this), bonus);
                    amountsToWithdraw[i] += bonus;
                }
                
                IERC20(coins[i]).transfer(msg.sender, amountsToWithdraw[i]);
            }
        }
        
        // 销毁 LP 代币
        _burn(msg.sender, _amount);
        
        // 发出事件
        uint256[3] memory fees; // 简化：费用为0
        emit RemoveLiquidity(
            msg.sender,
            amountsToWithdraw,
            fees,
            totalSupply()
        );
    }
    
    /**
     * @notice 移除单一代币流动性
     * @param _token_amount LP 代币数量
     * @param i 要移除的代币索引
     * @param min_amount 最小获得数量
     */
    function remove_liquidity_one_coin(
        uint256 _token_amount,
        int128 i,
        uint256 min_amount
    ) external override {
        require(i >= 0 && i < 3, "Invalid coin index");
        require(_token_amount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= _token_amount, "Insufficient LP tokens");
        
        uint256 coinIndex = uint256(uint128(i));
        
        // 计算能获得的代币数量
        uint256 coinAmount = (balances[coinIndex] * _token_amount) / totalSupply();
        
        // 添加 0.2% 的额外收益
        uint256 bonus = (coinAmount * 20) / 10000;
        if (coins[coinIndex] != address(0)) {
            MockERC20(coins[coinIndex]).mint(address(this), bonus);
            coinAmount += bonus;
        }
        
        require(coinAmount >= min_amount, "Slippage exceeded");
        
        // 更新余额
        balances[coinIndex] -= (balances[coinIndex] * _token_amount) / totalSupply();
        
        // 转出代币
        IERC20(coins[coinIndex]).transfer(msg.sender, coinAmount);
        
        // 销毁 LP 代币
        _burn(msg.sender, _token_amount);
        
        // 发出事件
        emit RemoveLiquidityOne(msg.sender, _token_amount, coinAmount);
    }

    // ============ 交换函数（简化实现）============
    
    /**
     * @notice 代币交换
     * @param i 输入代币索引
     * @param j 输出代币索引
     * @param dx 输入数量
     * @param min_dy 最小输出数量
     */
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external override {
        require(i != j, "Same coin");
        require(i >= 0 && i < 3, "Invalid input coin");
        require(j >= 0 && j < 3, "Invalid output coin");
        
        uint256 inputIndex = uint256(uint128(i));
        uint256 outputIndex = uint256(uint128(j));
        
        // 转入输入代币
        IERC20(coins[inputIndex]).transferFrom(msg.sender, address(this), dx);
        balances[inputIndex] += dx;
        
        // 计算输出数量（1:1 减去手续费）
        uint256 feeAmount = (dx * fee) / 10000;
        uint256 dy = dx - feeAmount;
        
        require(dy >= min_dy, "Slippage exceeded");
        require(balances[outputIndex] >= dy, "Insufficient liquidity");
        
        // 更新余额并转出代币
        balances[outputIndex] -= dy;
        IERC20(coins[outputIndex]).transfer(msg.sender, dy);
        
        // 发出事件
        emit TokenExchange(msg.sender, i, dx, j, dy);
    }

    // ============ 不需要实现的函数（抛出错误）============
    
    function remove_liquidity_imbalance(
        uint256[3] memory amounts,
        uint256 max_burn_amount
    ) external pure override {
        revert("Not implemented");
    }
    
    function ramp_A(uint256 _future_A, uint256 _future_time) external pure override {
        revert("Not implemented");
    }
    
    function stop_ramp_A() external pure override {
        revert("Not implemented");
    }
    
    function commit_new_fee(uint256 new_fee, uint256 new_admin_fee) external pure override {
        revert("Not implemented");
    }
    
    function apply_new_fee() external pure override {
        revert("Not implemented");
    }
    
    function revert_new_parameters() external pure override {
        revert("Not implemented");
    }
    
    function commit_transfer_ownership(address _owner) external pure override {
        revert("Not implemented");
    }
    
    function apply_transfer_ownership() external pure override {
        revert("Not implemented");
    }
    
    function revert_transfer_ownership() external pure override {
        revert("Not implemented");
    }
    
    function admin_balances(uint256 i) external pure override returns (uint256) {
        return 0;
    }
    
    function withdraw_admin_fees() external pure override {
        revert("Not implemented");
    }
    
    function donate_admin_fees() external pure override {
        revert("Not implemented");
    }
    
    function kill_me() external pure override {
        revert("Not implemented");
    }
    
    function unkill_me() external pure override {
        revert("Not implemented");
    }
    
    function initial_A() external view override returns (uint256) {
        return A;
    }
    
    function future_A() external view override returns (uint256) {
        return A;
    }
    
    function initial_A_time() external pure override returns (uint256) {
        return 0;
    }
    
    function future_A_time() external pure override returns (uint256) {
        return 0;
    }
    
    function admin_actions_deadline() external pure override returns (uint256) {
        return 0;
    }
    
    function transfer_ownership_deadline() external pure override returns (uint256) {
        return 0;
    }
    
    function future_fee() external view override returns (uint256) {
        return fee;
    }
    
    function future_admin_fee() external view override returns (uint256) {
        return admin_fee;
    }
    
    function future_owner() external view override returns (address) {
        return owner;
    }

    // ============ 工具函数 ============
    
    /**
     * @notice 获取代币地址
     * @param arg0 代币索引
     */
    function getCoin(uint256 arg0) external view returns (address) {
        require(arg0 < 3, "Invalid coin index");
        return coins[arg0];
    }
    
    /**
     * @notice 获取余额
     * @param arg0 代币索引
     */
    function getBalance(uint256 arg0) external view returns (uint256) {
        require(arg0 < 3, "Invalid coin index");
        return balances[arg0];
    }
    
    /**
     * @notice 模拟收益增长（测试用）
     * @param user 用户地址
     */
    function simulateYieldGrowth(address user) external {
        uint256 userBalance = balanceOf(user);
        if (userBalance > 0) {
            // 虚拟价格增长 0.5%
            _virtual_price = (_virtual_price * 10050) / 10000;
        }
    }
}