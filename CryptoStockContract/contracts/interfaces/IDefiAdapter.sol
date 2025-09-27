// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./IOperationTypes.sol";

/**
 * @title IDefiAdapter
 * @dev 通用 DeFi 适配器接口 - 所有模块必须实现的标准接口
 */
interface IDefiAdapter is IOperationTypes {
    
    /**
     * @dev 检查模块是否支持指定操作类型
     * @param operationType 操作类型
     * @return 是否支持该操作
     */
    function supportsOperation(OperationType operationType) external view returns (bool);
    
    /**
     * @dev 执行指定操作
     * @param operationType 操作类型
     * @param params 操作参数（包含受益者地址）
     * @param feeRateBps 手续费率（基点）
     * @return result 操作结果
     */
    function executeOperation(
        OperationType operationType,
        OperationParams calldata params,
        uint256 feeRateBps
    ) external returns (OperationResult memory result);
    
    /**
     * @dev 预估操作结果（只读，不执行）
     * @param operationType 操作类型
     * @param params 操作参数
     * @return result 预估结果
     */
    function estimateOperation(
        OperationType operationType,
        OperationParams calldata params
    ) external view returns (OperationResult memory result);
    
    /**
     * @dev 获取操作所需的最小代币数量
     * @param operationType 操作类型
     * @param params 操作参数
     * @return minAmounts 最小数量数组
     */
    function getMinAmounts(
        OperationType operationType,
        OperationParams calldata params
    ) external view returns (uint256[] memory minAmounts);
    
    /**
     * @dev 获取用户在该模块中的 USDC 余额
     * @param user 用户地址
     * @return balance USDC 余额
     */
    function getUserBalances(
        address user
    ) external view returns (uint256 balance);
    
    /**
     * @dev 获取用户的收益信息
     * @param user 用户地址
     * @return principal 本金（用户存入的净金额）
     * @return currentValue 当前价值（包含收益/损失）
     * @return profit 收益金额（正数为收益，负数为损失）
     * @return isProfit true表示盈利，false表示亏损
     */
    function getUserYield(
        address user
    ) external view returns (
        uint256 principal,
        uint256 currentValue,
        uint256 profit,
        bool isProfit
    );
    
    /**
     * @dev 获取模块支持的操作类型列表
     * @return operations 支持的操作类型数组
     */
    function getSupportedOperations() external view returns (OperationType[] memory operations);
    
    /**
     * @dev 获取模块名称
     * @return 模块名称
     */
    function getAdapterName() external pure returns (string memory);
    
    /**
     * @dev 获取模块版本
     * @return 模块版本
     */
    function getAdapterVersion() external pure returns (string memory);
    
    // ===== 事件 =====
    
    /**
     * @dev 操作执行事件
     */
    event OperationExecuted(
        address indexed user,
        OperationType indexed operationType,
        address[] tokens,
        uint256[] amounts,
        bytes returnData
    );
    
    /**
     * @dev 手续费收取事件
     */
    event FeeCollected(
        address indexed user,
        OperationType indexed operationType,
        address token,
        uint256 feeAmount
    );
}