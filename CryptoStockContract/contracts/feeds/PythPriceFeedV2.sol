// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "../interfaces/IPriceOracle.sol";

contract PythPriceFeedV2 is IPriceFeed {
    IPyth pyth;

    mapping(string => bytes32) public symbolFeedIdMap;

    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }

    function getPriceFeedId(
        string memory symbol
    ) external view returns (bytes32) {
        return symbolFeedIdMap[symbol];
    }

    function setPriceFeedId(
        string memory symbol,
        bytes32 priceFeedId
    ) external {
        symbolFeedIdMap[symbol] = priceFeedId;
    }

    function updateAndGetLatestPrice(
        bytes32 feedId,
        bytes[] calldata priceUpdate
    ) public payable returns (uint256) {
        uint fee = getUpdateFee(priceUpdate);
        pyth.updatePriceFeeds{value: fee}(priceUpdate);

        try pyth.getPriceUnsafe(feedId) returns (
            PythStructs.Price memory newPrice
        ) {
            return _convertPrice(newPrice);
        } catch (bytes memory) {
            return 0;
        }
    }

    /**
     * @notice 获取股票价格（先更新价格再获取最新数据）
     * @dev 对于 Pyth，需要先调用 updatePriceFeeds 更新价格，然后获取最新价格
     */
    function getPrice(
        OperationParams calldata params
    ) external payable override returns (OperationResult memory) {
        bytes32 feedId = symbolFeedIdMap[params.symbol];
        if (feedId == bytes32(0)) {
            return
                OperationResult({
                    price: 0,
                    minPrice: 0,
                    maxPrice: 0,
                    publishTime: 0,
                    success: false,
                    errorMessage: "Price feed not found for symbol"
                });
        }

        // 1. 先更新价格（如果提供了 updateData）
        if (params.updateData.length > 0) {
            try pyth.updatePriceFeeds{value: msg.value}(params.updateData) {
                // 更新成功，继续获取价格
            } catch Error(string memory reason) {
                return
                    OperationResult({
                        price: 0,
                        minPrice: 0,
                        maxPrice: 0,
                        publishTime: 0,
                        success: false,
                        errorMessage: string(
                            abi.encodePacked("Update failed: ", reason)
                        )
                    });
            } catch {
                return
                    OperationResult({
                        price: 0,
                        minPrice: 0,
                        maxPrice: 0,
                        publishTime: 0,
                        success: false,
                        errorMessage: "Price update failed"
                    });
            }
        }

        // 2. 获取最新价格
        try pyth.getPriceUnsafe(feedId) returns (PythStructs.Price memory p) {
            if (p.price <= 0) {
                return
                    OperationResult({
                        price: 0,
                        minPrice: 0,
                        maxPrice: 0,
                        publishTime: 0,
                        success: false,
                        errorMessage: "Invalid price data"
                    });
            }

            // 转换为18位小数
            uint256 price = _convertPrice(p);
            uint256 minPrice = (price * 98) / 100; // -2%
            uint256 maxPrice = (price * 102) / 100; // +2%

            return
                OperationResult({
                    price: price,
                    minPrice: minPrice,
                    maxPrice: maxPrice,
                    publishTime: p.publishTime,
                    success: true,
                    errorMessage: ""
                });
        } catch Error(string memory reason) {
            return
                OperationResult({
                    price: 0,
                    minPrice: 0,
                    maxPrice: 0,
                    publishTime: 0,
                    success: false,
                    errorMessage: reason
                });
        }
    }

    function getUpdateFee(
        bytes[] calldata updateData
    ) public view returns (uint feeAmount) {
        return pyth.getUpdateFee(updateData);
    }

    /**
     * @notice 转换 Pyth 价格为 18 位小数
     */
    function _convertPrice(
        PythStructs.Price memory p
    ) internal pure returns (uint256) {
        uint256 absPrice = uint256(uint64(p.price));

        if (p.expo >= 0) {
            return absPrice * (10 ** uint256(int256(p.expo))) * 1e18;
        } else {
            int256 negExpo = -int256(p.expo);
            if (negExpo >= 18) {
                return (absPrice * 1e18) / (10 ** uint256(negExpo));
            } else {
                uint256 adjustment = 18 - uint256(negExpo);
                return absPrice * (10 ** adjustment);
            }
        }
    }
}
