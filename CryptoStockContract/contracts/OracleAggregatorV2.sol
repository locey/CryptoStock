// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract OracleAggregatorV2 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    IPyth public pyth;
    
    // 股票符号 => Pyth Feed ID 映射
    mapping(string => bytes32) public symbolToFeedId;
    
    // 已支持的股票符号列表
    string[] public supportedSymbols;
    
    // V2 新增：简单的计数器
    uint256 public updateCounter;
    
    // V2 新增：管理员地址
    address public adminAddress;
    
    // 事件
    event FeedIdUpdated(string indexed symbol, bytes32 feedId);
    event FeedIdRemoved(string indexed symbol);
    
    // V2 新增事件
    event CounterIncremented(uint256 newValue);
    event AdminUpdated(address newAdmin);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address pythContract) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        pyth = IPyth(pythContract);
        
        // V2 新增：初始化新变量
        updateCounter = 0;
        adminAddress = msg.sender;
    }

    // V2 升级时的重新初始化函数
    function initializeV2() external onlyOwner {
        // 只有在变量未初始化时才设置
        if (adminAddress == address(0)) {
            adminAddress = owner();
        }
        // updateCounter 默认为 0，无需设置
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

    // 获取股票价格
    function getStockPrice(string memory symbol) external view returns (int64 price, int32 expo, uint256 publishTime) {
        bytes32 feedId = symbolToFeedId[symbol];
        require(feedId != bytes32(0), "Symbol not supported");
        
        PythStructs.Price memory pythPrice = pyth.getPriceUnsafe(feedId);
        return (pythPrice.price, pythPrice.expo, pythPrice.publishTime);
    }

    // 更新价格数据到 Pyth
    function updatePriceFeeds(bytes[] calldata updateData) external payable {
        require(msg.value >= getUpdateFee(updateData), "Insufficient fee");
        pyth.updatePriceFeeds{value: msg.value}(updateData);
        
        // V2 新增：更新计数器
        updateCounter++;
        emit CounterIncremented(updateCounter);
    }

    // 获取更新费用
    function getUpdateFee(bytes[] calldata updateData) public view returns (uint256) {
        return pyth.getUpdateFee(updateData);
    }

    // 获取支持的股票符号数量
    function getSupportedSymbolsCount() external view returns (uint256) {
        return supportedSymbols.length;
    }

    // 获取指定索引的股票符号
    function getSupportedSymbol(uint256 index) external view returns (string memory) {
        require(index < supportedSymbols.length, "Index out of bounds");
        return supportedSymbols[index];
    }

    // 获取所有支持的股票符号
    function getAllSupportedSymbols() external view returns (string[] memory) {
        return supportedSymbols;
    }

    // V2 新增：获取版本信息
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
    
    // V2 新增：设置管理员地址
    function setAdmin(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid address");
        adminAddress = newAdmin;
        emit AdminUpdated(newAdmin);
    }
    
    // V2 新增：重置计数器
    function resetCounter() external {
        require(msg.sender == adminAddress || msg.sender == owner(), "Not authorized");
        updateCounter = 0;
        emit CounterIncremented(0);
    }

    // UUPS升级授权
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}