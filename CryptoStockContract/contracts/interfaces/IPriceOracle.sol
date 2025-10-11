// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 预言机类型枚举
enum OracleType { PYTH, REDSTONE }

/**
 * @dev 操作参数结构体 - 通用参数容器
 */
struct OperationParams {
    string symbol;          // 股票符号（通用）
    bytes[] updateData;     // 更新数据（Pyth 需要更新数据，RedStone 需要 payload）
}

/**
 * @dev 操作结果结构体 - 通用返回值容器
 */
struct OperationResult {
    uint256 price;          // 主要价格
    uint256 minPrice;       // 最小价格
    uint256 maxPrice;       // 最大价格
    uint256 publishTime;    // 发布时间
    bool success;           // 操作是否成功
    string errorMessage;    // 错误信息（如果有）
}

// 通用预言机接口
interface IPriceFeed {
    // 获取指定资产的价格（统一返回格式）
    // 对于需要更新的预言机（如 Pyth），可以在这个函数内部处理更新逻辑
    function getPrice(OperationParams calldata params) external payable returns (OperationResult memory);
}