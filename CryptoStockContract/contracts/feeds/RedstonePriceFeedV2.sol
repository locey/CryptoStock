// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IPriceOracleV2.sol";
import "../interfaces/IRedstoneManualV2.sol";

contract RedstonePriceFeedV2 is IPriceOracleV2 {
    address public owner;
    IRedstoneManualV2 public redstone;

    constructor(address ownerAddr, address redstonePriceAddr) {
        owner = ownerAddr;
        redstone = IRedstoneManualV2(redstonePriceAddr);
    }

    function getPrice(
        GetPriceParams calldata params
    ) external view override returns (PriceResult memory) {
        bytes32 symbol = stringToBytes32(params.symbol);
        uint256 price = redstone.getLatestPrice(symbol, params.updateData[0]);
        try redstone.getLatestPrice(symbol, params.updateData[0]) returns (
            uint256 price
        ) {
            return
                PriceResult({
                    price: price,
                    minPrice: (price * 98) / 100, // -2%
                    maxPrice: (price * 102) / 100, // +2%
                    publishTime: block.timestamp,
                    success: true,
                    errorMessage: ""
                });
        } catch Error(string memory errorMessage) {
            return
                PriceResult({
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
}
