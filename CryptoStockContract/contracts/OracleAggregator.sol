// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract OracleAggregator is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    IPyth public pyth;
    
    // 股票符号 => Pyth Feed ID 映射
    mapping(string => bytes32) public symbolToFeedId;
    
    // 已支持的股票符号列表
    string[] public supportedSymbols;
    
    // 事件
    event FeedIdUpdated(string symbol, bytes32 feedId);
    event FeedIdRemoved(string symbol);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address pythContract) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        pyth = IPyth(pythContract);
    }

    // UUPS升级授权
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

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

    /// @notice 根据股票符号查询价格（仅查询版本）
    /// @dev 只查询已缓存的价格，不会更新。推荐使用 updateAndGetPrices 获取最新价格
    /// @dev 警告：此函数返回的可能不是最新价格，仅用于查询已缓存的价格数据
    function getPrice(string memory symbol) external view returns (
        uint256 price, 
        uint256 minPrice, 
        uint256 maxPrice, 
        uint256 publishTime
    ) {
        bytes32 feedId = symbolToFeedId[symbol];
        require(feedId != bytes32(0), "Price feed not found for symbol");
        
        // 获取缓存的价格数据（可能不是最新的）
        // 要获取最新价格，请使用 updateAndGetPrices 函数
        PythStructs.Price memory p = pyth.getPriceUnsafe(feedId);
        require(p.price > 0, "Invalid price data");
        
        // 动态转换为 18 位小数精度
        // Pyth价格格式：price * 10^expo = 实际价格
        // 我们需要转换为：实际价格 * 10^18
        
        uint256 absPrice = uint256(uint64(p.price)); // 确保为正数
        
        if (p.expo >= 0) {
            // expo >= 0: price已经是整数，需要乘以10^expo，然后再乘以10^18
            price = absPrice * (10 ** uint256(int256(p.expo))) * 1e18;
        } else {
            // expo < 0: price需要除以10^(-expo)来得到实际价格，然后乘以10^18
            // 为了避免精度丢失，我们重新排列计算顺序
            int256 negExpo = -int256(p.expo);
            if (negExpo >= 18) {
                // 如果负指数大于等于18，结果会很小
                price = absPrice * 1e18 / (10 ** uint256(negExpo));
            } else {
                // 如果负指数小于18，我们可以优化计算避免精度丢失
                uint256 adjustment = 18 - uint256(negExpo);
                price = absPrice * (10 ** adjustment);
            }
        }
        
        // 简单设置最小最大价格（可以根据需要调整）
        minPrice = price * 95 / 100; // -5%
        maxPrice = price * 105 / 100; // +5%
        publishTime = p.publishTime;
    }
    
    /// @notice 更新并获取单个股票的最新价格
    /// @param symbol 股票符号
    /// @param updateData 价格更新数据
    /// @return price 转换为18位小数的价格
    /// @return minPrice 最小价格（-5%）
    /// @return maxPrice 最大价格（+5%）
    /// @return publishTime 发布时间
    function updateAndGetPrice(
        string memory symbol,
        bytes[] calldata updateData
    ) external payable returns (
        uint256 price,
        uint256 minPrice,
        uint256 maxPrice,
        uint256 publishTime
    ) {
        // 1. 更新链上价格
        uint fee = pyth.getUpdateFee(updateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: fee}(updateData);
        
        // 2. 获取最新价格
        bytes32 feedId = symbolToFeedId[symbol];
        require(feedId != bytes32(0), "Price feed not found for symbol");
        
        PythStructs.Price memory p = pyth.getPriceUnsafe(feedId);
        require(p.price > 0, "Invalid price data");
        
        // 动态转换为 18 位小数精度
        uint256 absPrice = uint256(uint64(p.price)); // 确保为正数
        
        if (p.expo >= 0) {
            // expo >= 0: price已经是整数，需要乘以10^expo，然后再乘以10^18
            price = absPrice * (10 ** uint256(int256(p.expo))) * 1e18;
        } else {
            // expo < 0: price需要除以10^(-expo)来得到实际价格，然后乘以10^18
            // 为了避免精度丢失，我们重新排列计算顺序
            int256 negExpo = -int256(p.expo);
            if (negExpo >= 18) {
                // 如果负指数大于等于18，结果会很小
                price = absPrice * 1e18 / (10 ** uint256(negExpo));
            } else {
                // 如果负指数小于18，我们可以优化计算避免精度丢失
                uint256 adjustment = 18 - uint256(negExpo);
                price = absPrice * (10 ** adjustment);
            }
        }
        
        // 简单设置最小最大价格（可以根据需要调整）
        minPrice = price * 95 / 100; // -5%
        maxPrice = price * 105 / 100; // +5%
        publishTime = p.publishTime;
        
        // 返还多余的费用
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }
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
            
            // 动态转换为 18 位小数精度（与getPrice函数保持一致）
            uint256 absPrice = uint256(uint64(p.price)); // 确保为正数
            
            if (p.expo >= 0) {
                // expo >= 0: price已经是整数，需要乘以10^expo，然后再乘以10^18
                prices[i] = absPrice * (10 ** uint256(int256(p.expo))) * 1e18;
            } else {
                // expo < 0: price需要除以10^(-expo)来得到实际价格，然后乘以10^18
                // 为了避免精度丢失，我们重新排列计算顺序
                int256 negExpo = -int256(p.expo);
                if (negExpo >= 18) {
                    // 如果负指数大于等于18，结果会很小
                    prices[i] = absPrice * 1e18 / (10 ** uint256(negExpo));
                } else {
                    // 如果负指数小于18，我们可以优化计算避免精度丢失
                    uint256 adjustment = 18 - uint256(negExpo);
                    prices[i] = absPrice * (10 ** adjustment);
                }
            }
            
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
