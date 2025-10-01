// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IChainlinkPriceFeed.sol";

contract MockAggregatorV3 is AggregatorV3Interface {
    uint8 private _decimals;
    string private _description;
    int256 private _price;
    uint256 private _updatedAt;
    uint80 private _roundId;

    constructor(
        string memory description_,
        uint8 decimals_,
        int256 initialPrice_
    ) {
        _description = description_;
        _decimals = decimals_;
        _price = initialPrice_;
        _updatedAt = block.timestamp;
        _roundId = 1;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external view override returns (string memory) {
        return _description;
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            _price,
            _updatedAt,
            _updatedAt,
            _roundId
        );
    }

    function getRoundData(uint80 _roundId_)
        external
        view
        returns (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId_,
            _price,
            _updatedAt,
            _updatedAt,
            _roundId_
        );
    }

    // 用于测试的价格更新函数
    function updatePrice(int256 newPrice) external {
        _price = newPrice;
        _updatedAt = block.timestamp;
        _roundId++;
    }
}