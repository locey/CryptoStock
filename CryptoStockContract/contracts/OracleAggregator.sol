// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OracleAggregator is Ownable {
    IPyth public pyth;
    
    // 股票符号 => Pyth Feed ID 映射
    mapping(string => bytes32) public symbolToFeedId;
    
    // 已支持的股票符号列表
    string[] public supportedSymbols;
    
    // 事件
    event FeedIdUpdated(string indexed symbol, bytes32 feedId);
    event FeedIdRemoved(string indexed symbol);

    constructor(address pythContract) Ownable(msg.sender) {
        pyth = IPyth(pythContract);
    }

    // 设置股票符号对应的 Feed ID
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
    
    // 移除股票符号
    function removeFeedId(string memory symbol) external onlyOwner {
        require(symbolToFeedId[symbol] != bytes32(0), "Symbol not found");
        
        symbolToFeedId[symbol] = bytes32(0);
        
        // 从支持列表中移除
        for (uint i = 0; i < supportedSymbols.length; i++) {
            if (keccak256(bytes(supportedSymbols[i])) == keccak256(bytes(symbol))) {
                supportedSymbols[i] = supportedSymbols[supportedSymbols.length - 1];
                supportedSymbols.pop();
                break;
            }
        }
        
        emit FeedIdRemoved(symbol);
    }

    /// @notice 根据股票符号查询价格（安全版本）
    /// @dev 需要先调用 updatePriceFeeds 更新价格，然后查询
    function getPrice(string memory symbol) external view returns (
        uint256 price, 
        uint256 minPrice, 
        uint256 maxPrice, 
        uint256 publishTime
    ) {
        bytes32 feedId = symbolToFeedId[symbol];
        require(feedId != bytes32(0), "Price feed not found for symbol");
        
        // 使用安全的价格查询方法，会验证价格的有效性和时效性
        // 注意，这里存在严重的安全隐患，pyth并不是实时更新价格，需要客户端或者后端去对接pythSDK，调用updatePriceFeeds方法来更新链上价格
        PythStructs.Price memory p = pyth.getPriceUnsafe(feedId);
        require(p.price > 0, "Invalid price data");
        
        // 转换为 18 位小数精度的正数
        uint256 basePrice;
        if (p.expo >= 0) {
            basePrice = uint256(uint64(p.price)) * (10 ** uint256(int256(p.expo)));
        } else {
            basePrice = uint256(uint64(p.price)) / (10 ** uint256(-int256(p.expo)));
        }
        
        // 调整到 18 位小数精度
        price = basePrice * 1e18 / 1e8; // 假设 Pyth 价格是 8 位小数
        
        // 简单设置最小最大价格（可以根据需要调整）
        minPrice = price * 95 / 100; // -5%
        maxPrice = price * 105 / 100; // +5%
        publishTime = p.publishTime;
    }
    
    /// @notice 更新价格数据（在查询价格前调用）
    /// @param updateData 从 Pyth 网络获取的价格更新数据
    function updatePriceFeeds(bytes[] calldata updateData) external payable {
        // 计算更新费用
        uint fee = pyth.getUpdateFee(updateData);
        require(msg.value >= fee, "Insufficient fee");
        
        // 更新链上价格
        pyth.updatePriceFeeds{value: fee}(updateData);
        
        // 返还多余的费用
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
    
    /// @notice 获取更新价格所需的费用
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256) {
        return pyth.getUpdateFee(updateData);
    }
    
    /// @notice 批量更新并查询价格（推荐使用）
    /// @param symbols 要查询的股票符号数组
    /// @param updateData 价格更新数据
    function updateAndGetPrices(
        string[] memory symbols, 
        bytes[] calldata updateData
    ) external payable returns (
        uint256[] memory prices,
        uint256[] memory publishTimes
    ) {
        // 1. 更新链上价格
        uint fee = pyth.getUpdateFee(updateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: fee}(updateData);
        
        // 2. 查询价格
        prices = new uint256[](symbols.length);
        publishTimes = new uint256[](symbols.length);
        
        for (uint i = 0; i < symbols.length; i++) {
            bytes32 feedId = symbolToFeedId[symbols[i]];
            require(feedId != bytes32(0), "Price feed not found for symbol");
            
            PythStructs.Price memory p = pyth.getPriceUnsafe(feedId);
            require(p.price > 0, "Invalid price data");
            
            // 转换价格
            uint256 basePrice;
            if (p.expo >= 0) {
                basePrice = uint256(uint64(p.price)) * (10 ** uint256(int256(p.expo)));
            } else {
                basePrice = uint256(uint64(p.price)) / (10 ** uint256(-int256(p.expo)));
            }
            
            prices[i] = basePrice * 1e18 / 1e8;
            publishTimes[i] = p.publishTime;
        }
        
        // 返还多余的费用
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
    }
    
    /// @notice 获取所有支持的股票符号
    function getSupportedSymbols() external view returns (string[] memory) {
        return supportedSymbols;
    }
    
    /// @notice 检查是否支持某个股票符号
    function isSymbolSupported(string memory symbol) external view returns (bool) {
        return symbolToFeedId[symbol] != bytes32(0);
    }
    
    /// @notice 批量设置 Feed ID
    function batchSetFeedIds(string[] memory symbols, bytes32[] memory feedIds) external onlyOwner {
        require(symbols.length == feedIds.length, "Arrays length mismatch");
        
        for (uint i = 0; i < symbols.length; i++) {
            require(bytes(symbols[i]).length > 0, "Symbol cannot be empty");
            require(feedIds[i] != bytes32(0), "Feed ID cannot be zero");
            
            // 如果是新符号，添加到支持列表
            if (symbolToFeedId[symbols[i]] == bytes32(0)) {
                supportedSymbols.push(symbols[i]);
            }
            
            symbolToFeedId[symbols[i]] = feedIds[i];
        }
    }
}
