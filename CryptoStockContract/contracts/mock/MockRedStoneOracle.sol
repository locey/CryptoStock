// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IRedStoneManual.sol";

/**
 * @title MockRedStoneOracle
 * @dev Mock 版本的 RedStone 手动模式预言机 - 用于 Sepolia 测试
 * @notice 模拟 RedStone Manual Payload 模式，为 RedStonePriceFeed.sol 提供测试数据
 * @notice 支持六种股票的模拟价格，带有浮动范围
 */
contract MockRedStoneOracle is IRedStoneManualFeed {
    
    address public owner;
    
    // 六种股票的基础价格 (18位小数，美元计价)
    uint256 public constant AAPL_BASE_PRICE  = 258 * 1e18; // $258.00
    uint256 public constant TSLA_BASE_PRICE  = 435 * 1e18; // $435.00  
    uint256 public constant GOOGL_BASE_PRICE = 241 * 1e18; // $241.00
    uint256 public constant MSFT_BASE_PRICE  = 522 * 1e18; // $522.00
    uint256 public constant AMZN_BASE_PRICE  = 227 * 1e18; // $227.00
    uint256 public constant NVDA_BASE_PRICE  = 192 * 1e18; // $192.00
    
    // 模拟价格存储 (bytes32 => uint256)
    mapping(bytes32 => uint256) private mockPrices;
    mapping(bytes32 => uint256) private lastUpdateTime;
    mapping(bytes32 => uint256) private priceSeeds;
    
    event MockPriceSet(bytes32 indexed assetDataFeedId, uint256 price, uint256 timestamp);
    event PriceRequested(bytes32 indexed assetDataFeedId, uint256 price, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        
        // 初始化六种股票的默认价格
        _initializeMockPrice("AAPL", AAPL_BASE_PRICE);
        _initializeMockPrice("TSLA", TSLA_BASE_PRICE);
        _initializeMockPrice("GOOGL", GOOGL_BASE_PRICE);
        _initializeMockPrice("MSFT", MSFT_BASE_PRICE);
        _initializeMockPrice("AMZN", AMZN_BASE_PRICE);
        _initializeMockPrice("NVDA", NVDA_BASE_PRICE);
    }
    
    function _initializeMockPrice(string memory symbol, uint256 basePrice) internal {
        bytes32 feedId = bytes32(bytes(symbol));
        mockPrices[feedId] = basePrice;
        lastUpdateTime[feedId] = block.timestamp;
        priceSeeds[feedId] = uint256(keccak256(abi.encodePacked(symbol, block.timestamp))) % 1000;
        
        emit MockPriceSet(feedId, basePrice, block.timestamp);
    }
    
    // IRedStoneManualFeed 接口实现
    
    /// @notice 获取最新价格（payload参数为了和真实RedStone兼容，可忽略内容）
    function getLatestPrice(bytes32 assetDataFeedId, bytes calldata payload) external view override returns (uint256 price) {
        // 在 mock 环境中，payload 参数被忽略
        payload; // 避免 unused parameter 警告
        
        uint256 basePrice = mockPrices[assetDataFeedId];
        require(basePrice > 0, "Unsupported asset");
        
        // 生成带浮动的价格（±2% 范围）
        uint256 fluctuatedPrice = _generateFluctuatedPrice(assetDataFeedId, basePrice);
        
        return fluctuatedPrice;
    }
    
    /// @dev 生成带浮动的价格（±2% 范围）
    function _generateFluctuatedPrice(bytes32 assetDataFeedId, uint256 basePrice) internal view returns (uint256) {
        uint256 seed = priceSeeds[assetDataFeedId];
        uint256 timeSeed = block.timestamp / 300; // 每5分钟变化一次
        
        // 生成伪随机数 (-200 到 +200, 代表 ±2%)
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            assetDataFeedId,
            seed,
            timeSeed
        )));
        
        int256 variation = int256(randomSeed % 401) - 200; // -200 到 +200
        
        // 计算价格波动 (±2%)
        uint256 fluctuation = basePrice * uint256(variation < 0 ? -variation : variation) / 10000;
        
        if (variation >= 0) {
            return basePrice + fluctuation;
        } else {
            return basePrice > fluctuation ? basePrice - fluctuation : basePrice / 2;
        }
    }
    
    // 辅助函数
    
    /// @notice 字符串转 bytes32（用于测试）
    function stringToBytes32(string memory str) external pure returns (bytes32) {
        return bytes32(bytes(str));
    }
    
    /// @notice 获取支持的资产列表
    function getSupportedAssets() external pure returns (bytes32[] memory) {
        bytes32[] memory assets = new bytes32[](6);
        assets[0] = bytes32(bytes("AAPL"));
        assets[1] = bytes32(bytes("TSLA"));
        assets[2] = bytes32(bytes("GOOGL"));
        assets[3] = bytes32(bytes("MSFT"));
        assets[4] = bytes32(bytes("AMZN"));
        assets[5] = bytes32(bytes("NVDA"));
        return assets;
    }
    
    /// @notice 获取基础价格（用于调试）
    function getBasePrice(bytes32 assetDataFeedId) external view returns (uint256) {
        return mockPrices[assetDataFeedId];
    }
    
    /// @notice 获取最后更新时间
    function getLastUpdateTime(bytes32 assetDataFeedId) external view returns (uint256) {
        return lastUpdateTime[assetDataFeedId];
    }
}