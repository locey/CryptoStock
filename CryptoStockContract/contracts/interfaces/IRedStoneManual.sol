// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @title IRedStoneManualFeed
/// @notice RedStone 手动 payload 合约的接口定义
interface IRedStoneManualFeed {
    /// @notice 获取最新价格（payload参数为了和真实RedStone兼容，可忽略内容）
    /// @param assetDataFeedId 资产 symbol 的 bytes32
    /// @param payload 手动payload，实际 mock 时无作用
    /// @return price 当前 mock 价格
    function getLatestPrice(bytes32 assetDataFeedId, bytes calldata payload) external view returns (uint256 price);
}