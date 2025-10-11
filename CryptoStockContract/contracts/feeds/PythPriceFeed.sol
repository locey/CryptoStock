// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "../interfaces/IPriceOracle.sol";

// Pyth 预言机，支持多股票符号管理
contract PythPriceFeed is IPriceFeed {
    IPyth public pyth;
    address public owner;
    
    // 股票符号 => Pyth Feed ID 映射（从 OracleAggregator 移过来）
    mapping(string => bytes32) public symbolToFeedId;
    
    // 已支持的股票符号列表（从 OracleAggregator 移过来）
    string[] public supportedSymbols;
    
    // 事件（从 OracleAggregator 移过来）
    event FeedIdUpdated(string indexed symbol, bytes32 indexed feedId);

    constructor(address pythContract) {
        owner = msg.sender;
        pyth = IPyth(pythContract);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ============ Feed ID 管理（从 OracleAggregator 移过来）============
    
    /**
     * @notice 设置股票符号对应的 Feed ID
     * @param symbol 股票符号
     * @param feedId Pyth Feed ID
     */
    function setFeedId(string memory symbol, bytes32 feedId) external onlyOwner {
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(feedId != bytes32(0), "Feed ID cannot be zero");
        
        // 如果是新符号，添加到支持列表
        if (symbolToFeedId[symbol] == bytes32(0)) {
            supportedSymbols.push(symbol);
        }
        
        symbolToFeedId[symbol] = feedId;
        emit FeedIdUpdated(symbol, feedId);
    }

    // ============ IPriceFeed 接口实现 ============

    /**
     * @notice 获取股票价格（先更新价格再获取最新数据）
     * @dev 对于 Pyth，需要先调用 updatePriceFeeds 更新价格，然后获取最新价格
     */
    function getPrice(OperationParams calldata params) external payable override returns (OperationResult memory) {
        bytes32 feedId = symbolToFeedId[params.symbol];
        if (feedId == bytes32(0)) {
            return OperationResult({
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
                return OperationResult({
                    price: 0,
                    minPrice: 0,
                    maxPrice: 0,
                    publishTime: 0,
                    success: false,
                    errorMessage: string(abi.encodePacked("Update failed: ", reason))
                });
            } catch {
                return OperationResult({
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
                return OperationResult({
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
            uint256 minPrice = price * 98 / 100; // -2%
            uint256 maxPrice = price * 102 / 100; // +2%
            
            return OperationResult({
                price: price,
                minPrice: minPrice,
                maxPrice: maxPrice,
                publishTime: p.publishTime,
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
        }
    }

    // ============ 内部辅助函数 ============
    
    /**
     * @notice 转换 Pyth 价格为 18 位小数
     */
    function _convertPrice(PythStructs.Price memory p) internal pure returns (uint256) {
        uint256 absPrice = uint256(uint64(p.price));
        
        if (p.expo >= 0) {
            return absPrice * (10 ** uint256(int256(p.expo))) * 1e18;
        } else {
            int256 negExpo = -int256(p.expo);
            if (negExpo >= 18) {
                return absPrice * 1e18 / (10 ** uint256(negExpo));
            } else {
                uint256 adjustment = 18 - uint256(negExpo);
                return absPrice * (10 ** adjustment);
            }
        }
    }
    
    // ============ 查询功能 ============
    
    /**
     * @notice 获取价格更新费用
     * @param updateData 价格更新数据
     * @return 更新费用 (wei)
     */
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256) {
        return pyth.getUpdateFee(updateData);
    }
    
    /**
     * @notice 获取所有支持的股票符号
     */
    function getSupportedSymbols() external view returns (string[] memory) {
        return supportedSymbols;
    }
    
    /**
     * @notice 检查是否支持某个股票符号
     */
    function isSymbolSupported(string memory symbol) external view returns (bool) {
        return symbolToFeedId[symbol] != bytes32(0);
    }
}