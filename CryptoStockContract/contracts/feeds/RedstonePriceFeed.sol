// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IPriceOracle.sol";
import "../interfaces/IRedStoneManual.sol";

/**
 * @title RedstonePriceFeed
 * @dev RedStone 预言机适配器 - 将 RedStone Manual 模式集成到统一的 IPriceFeed 接口
 * @notice 通过调用 MockRedStoneOracle 合约获取价格数据
 */
contract RedstonePriceFeed is IPriceFeed {
    address public owner;
    IRedStoneManualFeed public redstoneOracle;
    
    event PriceRequested(string indexed symbol, uint256 price, uint256 timestamp);

    constructor(address _redstoneOracleAddress) {
        owner = msg.sender;
        redstoneOracle = IRedStoneManualFeed(_redstoneOracleAddress);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @notice 获取股票价格（IPriceFeed 接口实现）
     * @dev 从 RedStone Oracle 获取实时价格
     */
    /**
     * @notice 获取股票价格（IPriceFeed 接口实现）
     * @dev 从 RedStone Oracle 获取实时价格
     */
    function getPrice(OperationParams calldata params) external payable override returns (OperationResult memory) {
        // 将股票符号转换为 bytes32 格式
        bytes32 assetDataFeedId = stringToBytes32(params.symbol);
        
        // 从 updateData 中提取 payload（如果有的话）
        bytes memory payload;
        if (params.updateData.length > 0) {
            payload = params.updateData[0];
        } else {
            payload = new bytes(0); // 空的 bytes 数组
        }
        
        try redstoneOracle.getLatestPrice(assetDataFeedId, payload) returns (uint256 price) {
            return OperationResult({
                price: price,
                minPrice: price * 98 / 100,  // -2%
                maxPrice: price * 102 / 100, // +2%
                publishTime: block.timestamp,
                success: true,
                errorMessage: ""
            });
        } catch Error(string memory reason) {
            return OperationResult({
                price: 0,
                minPrice: 0,
                maxPrice: 0,
                publishTime: 0,
                success: false,
                errorMessage: reason
            });
        } catch {
            return OperationResult({
                price: 0,
                minPrice: 0,
                maxPrice: 0,
                publishTime: 0,
                success: false,
                errorMessage: "Unsupported symbol or oracle error"
            });
        }
    }
    
    // ============ 工具函数 ============
    
    /**
     * @notice 将 string 转换为 bytes32
     * @param source 源字符串
     * @return result bytes32 结果
     */
    function stringToBytes32(string memory source) public pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }
        assembly {
            result := mload(add(source, 32))
        }
    }
    
    /**
     * @notice 检查是否支持指定的股票符号
     * @param symbol 股票符号
     * @return 是否支持
     */
    function isSymbolSupported(string memory symbol) external view returns (bool) {
        bytes32 assetDataFeedId = stringToBytes32(symbol);
        try redstoneOracle.getLatestPrice(assetDataFeedId, "") returns (uint256) {
            return true;
        } catch {
            return false;
        }
    }
}