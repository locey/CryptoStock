// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MockPyth is IPyth {
    mapping(bytes32 => PythStructs.Price) public prices;

    function setPrice(
        bytes32 feedId,
        int64 price,
        int32 expo,
        uint publishTime
    ) external {
        prices[feedId] = PythStructs.Price({
            price: price,
            conf: 0,
            expo: expo,
            publishTime: publishTime
        });
    }

    function getPriceUnsafe(bytes32 feedId) external view override returns (PythStructs.Price memory) {
        return prices[feedId];
    }

    function getPriceNoOlderThan(bytes32 id, uint age) external view override returns (PythStructs.Price memory) {
        PythStructs.Price memory price = prices[id];
        require(price.publishTime > 0, "Price not found");
        require(block.timestamp - price.publishTime <= age, "Price too old");
        return price;
    }

    function getEmaPriceUnsafe(bytes32 id) external view override returns (PythStructs.Price memory) {
        return prices[id];
    }

    function getEmaPriceNoOlderThan(bytes32 id, uint age) external view override returns (PythStructs.Price memory) {
        return this.getPriceNoOlderThan(id, age);
    }

    // IPyth接口要求的其他方法
    function updatePriceFeeds(bytes[] calldata) external payable override {}
    
    function updatePriceFeedsIfNecessary(
        bytes[] calldata,
        bytes32[] calldata,
        uint64[] calldata
    ) external payable override {}

    function getUpdateFee(bytes[] calldata) external pure override returns (uint256) {
        return 0;
    }

    function getTwapUpdateFee(bytes[] calldata) external pure override returns (uint256) {
        return 0;
    }

    function parsePriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory) {
        return new PythStructs.PriceFeed[](0);
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory) {
        return new PythStructs.PriceFeed[](0);
    }

    function parsePriceFeedUpdatesWithConfig(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64,
        bool,
        bool,
        bool
    ) external payable override returns (
        PythStructs.PriceFeed[] memory,
        uint64[] memory
    ) {
        return (new PythStructs.PriceFeed[](0), new uint64[](0));
    }

    function parseTwapPriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata
    ) external payable override returns (PythStructs.TwapPriceFeed[] memory) {
        return new PythStructs.TwapPriceFeed[](0);
    }
}
