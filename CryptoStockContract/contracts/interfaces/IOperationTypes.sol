// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @title IOperationTypes
 * @dev 定义所有 DeFi 操作类型的接口
 */
interface IOperationTypes {
    
    /**
     * @dev DeFi 操作类型枚举
     */
    enum OperationType {
        // === 基础操作 ===
        DEPOSIT,              // 0: 存款
        WITHDRAW,             // 1: 取款
        
        // === 流动性操作 ===  
        ADD_LIQUIDITY,        // 2: 添加流动性
        REMOVE_LIQUIDITY,     // 3: 移除流动性
        INCREASE_LIQUIDITY,   // 4: 增加流动性
        DECREASE_LIQUIDITY,   // 5: 减少流动性
        
        // === 交易操作 ===
        SWAP,                 // 6: 代币交换
        SWAP_EXACT_INPUT,     // 7: 精确输入交换
        SWAP_EXACT_OUTPUT,    // 8: 精确输出交换
        
        // === 借贷操作 ===
        BORROW,               // 9: 借款
        REPAY,                // 10: 还款
        SUPPLY,               // 11: 供应/存入担保
        LIQUIDATE,            // 12: 清算
        
        // === 质押操作 ===
        STAKE,                // 13: 质押
        UNSTAKE,              // 14: 取消质押
        CLAIM_REWARDS,        // 15: 领取奖励
        
        // === NFT 操作 ===
        MINT_POSITION,        // 16: 铸造位置 NFT
        BURN_POSITION,        // 17: 销毁位置 NFT
        COLLECT_FEES,         // 18: 收取手续费
        
        // === 治理操作 ===
        VOTE,                 // 19: 投票
        DELEGATE,             // 20: 委托
        
        // === 其他操作 ===
        HARVEST,              // 21: 收获/复利
        COMPOUND,             // 22: 复投
        EMERGENCY_WITHDRAW,   // 23: 紧急提取
        CUSTOM                // 24: 自定义操作
    }
    
    /**
     * @dev 操作参数结构体 - 通用参数容器
     */
    struct OperationParams {
        address[] tokens;      // 相关代币地址数组
        uint256[] amounts;     // 相关金额数组
        address recipient;     // 接收地址
        uint256 deadline;      // 操作截止时间
        uint256 tokenId;       // NFT tokenId (用于 UniswapV3, Aave 等基于 NFT 的协议)
        bytes extraData;       // 额外的操作特定数据
    }
    
    /**
     * @dev 操作结果结构体
     */
    struct OperationResult {
        bool success;          // 操作是否成功
        uint256[] outputAmounts; // 输出金额数组
        bytes returnData;      // 返回的额外数据
        string message;        // 操作消息
    }
}