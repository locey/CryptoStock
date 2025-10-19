// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRedstoneManualV2 {
    function getLatestPrice(
        bytes32 dataFeedId,
        bytes calldata payload
    ) external view returns (uint256 price);
}
