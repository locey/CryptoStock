// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IPriceOracle.sol";
import "@redstone-finance/evm-connector/contracts/data-services/MainDemoConsumerBase.sol";

contract RedstonePriceFeedV2 is IPriceFeed, MainDemoConsumerBase {
    function getLatestPrice(
        bytes32 assetDataFeedId,
        bytes calldata
    ) external view returns (uint256) {
        return getOracleNumericValueFromTxMsg(assetDataFeedId);
    }

    function getPrice(
        OperationParams calldata params
    ) external payable override returns (OperationResult memory) {
        bytes32 symbol = stringToBytes32(params.symbol);
        try this.getLatestPrice(symbol, params.updateData[0]) returns (
            uint256 price
        ) {
            return
                OperationResult({
                    price: _convertPrice(price, -8),
                    minPrice: (price * 98) / 100, // -2%
                    maxPrice: (price * 102) / 100, // +2%
                    publishTime: block.timestamp,
                    success: true,
                    errorMessage: ""
                });
        } catch Error(string memory errorMessage) {
            return
                OperationResult({
                    price: 0,
                    minPrice: 0,
                    maxPrice: 0,
                    publishTime: block.timestamp,
                    success: false,
                    errorMessage: errorMessage
                });
        }
    }

    /**
     * @notice 将 string 转换为 bytes32
     * @param source 源字符串
     * @return result bytes32 结果
     */
    function stringToBytes32(
        string memory source
    ) public pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            result := mload(add(source, 32))
        }
    }

    /**
     * @notice 转换 价格为 18 位小数
     */
    function _convertPrice(
        uint256 price,
        int32 expo
    ) internal pure returns (uint256) {
        uint256 absPrice = uint256(uint64(price));

        if (expo >= 0) {
            return absPrice * (10 ** uint256(int256(expo))) * 1e18;
        } else {
            int256 negExpo = -int256(expo);
            if (negExpo >= 18) {
                return (absPrice * 1e18) / (10 ** uint256(negExpo));
            } else {
                uint256 adjustment = 18 - uint256(negExpo);
                return absPrice * (10 ** adjustment);
            }
        }
    }
}
