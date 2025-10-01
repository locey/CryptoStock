// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @title Chainlink Price Feed Interface
 * @dev Chainlink Aggregator V3 接口，用于获取价格数据
 */
interface AggregatorV3Interface {
    /**
     * @dev 获取最新价格数据
     * @return roundId 轮次ID
     * @return price 价格 (根据 decimals() 确定精度)
     * @return startedAt 开始时间戳
     * @return updatedAt 更新时间戳 
     * @return answeredInRound 回答轮次ID
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
    
    /**
     * @dev 获取价格精度 (小数位数)
     * @return 小数位数
     */
    function decimals() external view returns (uint8);
    
    /**
     * @dev 获取价格描述
     * @return 价格对描述 (如 "ETH / USD")
     */
    function description() external view returns (string memory);
    
    /**
     * @dev 获取版本信息
     * @return 聚合器版本
     */
    function version() external view returns (uint256);
}