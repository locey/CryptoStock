// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @title ICurve
 * @dev Curve Finance 稳定币交换池接口
 * 支持多种代币之间的低滑点交换、流动性提供和移除等功能
 */
interface ICurve {
    
    // ===== 事件定义 =====
    
    /**
     * @dev 代币交换事件
     * @param buyer 买家地址
     * @param sold_id 卖出代币索引
     * @param tokens_sold 卖出代币数量
     * @param bought_id 买入代币索引
     * @param tokens_bought 买入代币数量
     */
    event TokenExchange(
        address indexed buyer,
        int128 sold_id,
        uint256 tokens_sold,
        int128 bought_id,
        uint256 tokens_bought
    );

    /**
     * @dev 添加流动性事件
     * @param provider 流动性提供者地址
     * @param token_amounts 各代币添加数量
     * @param fees 手续费
     * @param invariant 不变量
     * @param token_supply LP代币总供应量
     */
    event AddLiquidity(
        address indexed provider,
        uint256[3] token_amounts,
        uint256[3] fees,
        uint256 invariant,
        uint256 token_supply
    );

    /**
     * @dev 移除流动性事件
     * @param provider 流动性提供者地址
     * @param token_amounts 各代币移除数量
     * @param fees 手续费
     * @param token_supply LP代币总供应量
     */
    event RemoveLiquidity(
        address indexed provider,
        uint256[3] token_amounts,
        uint256[3] fees,
        uint256 token_supply
    );

    /**
     * @dev 移除单一代币流动性事件
     * @param provider 流动性提供者地址
     * @param token_amount LP代币数量
     * @param coin_amount 获得的代币数量
     */
    event RemoveLiquidityOne(
        address indexed provider,
        uint256 token_amount,
        uint256 coin_amount
    );

    /**
     * @dev 不平衡移除流动性事件
     * @param provider 流动性提供者地址
     * @param token_amounts 各代币移除数量
     * @param fees 手续费
     * @param invariant 不变量
     * @param token_supply LP代币总供应量
     */
    event RemoveLiquidityImbalance(
        address indexed provider,
        uint256[3] token_amounts,
        uint256[3] fees,
        uint256 invariant,
        uint256 token_supply
    );

    /**
     * @dev 提交新管理员事件
     */
    event CommitNewAdmin(uint256 indexed deadline, address indexed admin);

    /**
     * @dev 新管理员事件
     */
    event NewAdmin(address indexed admin);

    /**
     * @dev 提交新费用事件
     */
    event CommitNewFee(uint256 indexed deadline, uint256 fee, uint256 admin_fee);

    /**
     * @dev 新费用事件
     */
    event NewFee(uint256 fee, uint256 admin_fee);

    /**
     * @dev A参数变化事件
     */
    event RampA(uint256 old_A, uint256 new_A, uint256 initial_time, uint256 future_time);

    /**
     * @dev 停止A参数变化事件
     */
    event StopRampA(uint256 A, uint256 t);

    // ===== 核心交换功能 =====
    
    /**
     * @dev 获取 A 参数（放大系数）
     * @return A参数值
     */
    function A() external view returns (uint256);

    /**
     * @dev 获取虚拟价格
     * @return 虚拟价格
     */
    function get_virtual_price() external view returns (uint256);

    /**
     * @dev 计算添加/移除流动性时的LP代币数量
     * @param amounts 各代币数量数组
     * @param deposit 是否为存入操作
     * @return 计算得到的LP代币数量
     */
    function calc_token_amount(uint256[3] calldata amounts, bool deposit) external view returns (uint256);

    /**
     * @dev 添加流动性
     * @param amounts 各代币数量数组
     * @param min_mint_amount 最小铸造LP代币数量
     */
    function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amount) external;

    /**
     * @dev 获取交换输出数量（不包含底层资产）
     * @param i 输入代币索引
     * @param j 输出代币索引
     * @param dx 输入代币数量
     * @return 输出代币数量
     */
    function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256);

    /**
     * @dev 获取交换输出数量（包含底层资产）
     * @param i 输入代币索引
     * @param j 输出代币索引
     * @param dx 输入代币数量
     * @return 输出代币数量
     */
    function get_dy_underlying(int128 i, int128 j, uint256 dx) external view returns (uint256);

    /**
     * @dev 执行代币交换
     * @param i 输入代币索引
     * @param j 输出代币索引
     * @param dx 输入代币数量
     * @param min_dy 最小输出代币数量
     */
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external;

    // ===== 流动性管理 =====
    
    /**
     * @dev 移除流动性
     * @param _amount LP代币数量
     * @param min_amounts 各代币最小获得数量
     */
    function remove_liquidity(uint256 _amount, uint256[3] calldata min_amounts) external;

    /**
     * @dev 不平衡移除流动性
     * @param amounts 各代币期望获得数量
     * @param max_burn_amount 最大燃烧LP代币数量
     */
    function remove_liquidity_imbalance(uint256[3] calldata amounts, uint256 max_burn_amount) external;

    /**
     * @dev 计算移除单一代币的数量
     * @param _token_amount LP代币数量
     * @param i 代币索引
     * @return 可获得的代币数量
     */
    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns (uint256);

    /**
     * @dev 移除单一代币流动性
     * @param _token_amount LP代币数量
     * @param i 代币索引
     * @param min_amount 最小获得代币数量
     */
    function remove_liquidity_one_coin(uint256 _token_amount, int128 i, uint256 min_amount) external;

    // ===== 管理功能 =====
    
    /**
     * @dev 开始A参数变化
     * @param _future_A 目标A参数
     * @param _future_time 目标时间
     */
    function ramp_A(uint256 _future_A, uint256 _future_time) external;

    /**
     * @dev 停止A参数变化
     */
    function stop_ramp_A() external;

    /**
     * @dev 提交新费用
     * @param new_fee 新的交易费用
     * @param new_admin_fee 新的管理员费用
     */
    function commit_new_fee(uint256 new_fee, uint256 new_admin_fee) external;

    /**
     * @dev 应用新费用
     */
    function apply_new_fee() external;

    /**
     * @dev 撤销新参数
     */
    function revert_new_parameters() external;

    /**
     * @dev 提交转移所有权
     * @param _owner 新所有者地址
     */
    function commit_transfer_ownership(address _owner) external;

    /**
     * @dev 应用转移所有权
     */
    function apply_transfer_ownership() external;

    /**
     * @dev 撤销转移所有权
     */
    function revert_transfer_ownership() external;

    /**
     * @dev 获取管理员余额
     * @param i 代币索引
     * @return 管理员费用余额
     */
    function admin_balances(uint256 i) external view returns (uint256);

    /**
     * @dev 提取管理员费用
     */
    function withdraw_admin_fees() external;

    /**
     * @dev 捐赠管理员费用
     */
    function donate_admin_fees() external;

    /**
     * @dev 紧急暂停合约
     */
    function kill_me() external;

    /**
     * @dev 恢复合约
     */
    function unkill_me() external;

    // ===== 状态查询 =====
    
    /**
     * @dev 获取代币地址
     * @param arg0 代币索引
     * @return 代币合约地址
     */
    function coins(uint256 arg0) external view returns (address);

    /**
     * @dev 获取代币余额
     * @param arg0 代币索引
     * @return 代币余额
     */
    function balances(uint256 arg0) external view returns (uint256);

    /**
     * @dev 获取交易费用
     * @return 当前交易费用
     */
    function fee() external view returns (uint256);

    /**
     * @dev 获取管理员费用
     * @return 当前管理员费用
     */
    function admin_fee() external view returns (uint256);

    /**
     * @dev 获取合约所有者
     * @return 所有者地址
     */
    function owner() external view returns (address);

    /**
     * @dev 获取初始A参数
     * @return 初始A参数值
     */
    function initial_A() external view returns (uint256);

    /**
     * @dev 获取目标A参数
     * @return 目标A参数值
     */
    function future_A() external view returns (uint256);

    /**
     * @dev 获取A参数变化开始时间
     * @return 开始时间戳
     */
    function initial_A_time() external view returns (uint256);

    /**
     * @dev 获取A参数变化结束时间
     * @return 结束时间戳
     */
    function future_A_time() external view returns (uint256);

    /**
     * @dev 获取管理员操作截止时间
     * @return 截止时间戳
     */
    function admin_actions_deadline() external view returns (uint256);

    /**
     * @dev 获取所有权转移截止时间
     * @return 截止时间戳
     */
    function transfer_ownership_deadline() external view returns (uint256);

    /**
     * @dev 获取未来费用
     * @return 未来交易费用
     */
    function future_fee() external view returns (uint256);

    /**
     * @dev 获取未来管理员费用
     * @return 未来管理员费用
     */
    function future_admin_fee() external view returns (uint256);

    /**
     * @dev 获取未来所有者
     * @return 未来所有者地址
     */
    function future_owner() external view returns (address);
}