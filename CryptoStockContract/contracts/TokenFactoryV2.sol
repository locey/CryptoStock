// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./StockToken.sol";

// ===================== 代币工厂合约V2 (UUPS 可升级) =====================
contract TokenFactoryV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // 代币符号 => 代币合约地址
    mapping(string => address) public tokenBySymbol;
    
    // 所有代币地址列表
    address[] public allTokens;
    
    // 预言机聚合器地址
    address public oracleAggregator;
    
    // StockToken 实现合约地址
    address public stockTokenImplementation;
    
    // USDT 代币地址
    address public usdtTokenAddress;
    
    // V2 新增：代币类别枚举
    enum TokenCategory {
        STOCK,      // 股票代币
        CRYPTO,     // 加密货币代币
        COMMODITY,  // 商品代币
        FOREX       // 外汇代币
    }
    
    // V2 新增：代币元数据结构
    struct TokenMetadata {
        string name;
        string symbol;
        address tokenAddress;
        TokenCategory category;
        uint256 createdAt;
        bool isActive;
        uint256 totalVolume;  // 累计交易量
        address creator;      // 创建者地址
    }
    
    // V2 新增：符号到元数据的映射
    mapping(string => TokenMetadata) public tokenMetadata;
    
    // V2 新增：按类别分组的代币列表
    mapping(TokenCategory => string[]) public tokensByCategory;
    
    // V2 新增：代币创建费用
    uint256 public tokenCreationFee;
    
    // V2 新增：费用收取地址
    address public feeRecipient;
    
    // V2 新增：代币创建者权限
    mapping(address => bool) public authorizedCreators;
    
    // V2 新增：批量操作限制
    uint256 public maxBatchSize;
    
    event TokenCreated(address indexed tokenAddress, string name, string symbol);
    event OracleUpdated(address newOracle);
    event ImplementationUpdated(address newImplementation);
    
    // V2 新增事件
    event TokenCategoryUpdated(string indexed symbol, TokenCategory oldCategory, TokenCategory newCategory);
    event TokenStatusUpdated(string indexed symbol, bool isActive);
    event TokenVolumeUpdated(string indexed symbol, uint256 newVolume);
    event CreationFeeUpdated(uint256 newFee);
    event FeeRecipientUpdated(address newRecipient);
    event AuthorizedCreatorUpdated(address indexed creator, bool status);
    event BatchTokensCreated(uint256 count);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _oracleAggregator, address _stockTokenImplementation, address _usdtTokenAddress) initializer public {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        oracleAggregator = _oracleAggregator;
        stockTokenImplementation = _stockTokenImplementation;
        usdtTokenAddress = _usdtTokenAddress;
        
        // V2 新增：初始化新变量
        tokenCreationFee = 0; // 初始免费
        feeRecipient = msg.sender;
        maxBatchSize = 10;
        authorizedCreators[msg.sender] = true;
    }
    
    // V2 新增：初始化V2版本
    function initializeV2() external onlyOwner {
        if (tokenCreationFee == 0 && feeRecipient == address(0)) {
            tokenCreationFee = 0;
            feeRecipient = owner();
            maxBatchSize = 10;
            authorizedCreators[owner()] = true;
        }
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    // 创建新代币（增强版）
    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        TokenCategory category
    ) external payable returns (address) {
        require(authorizedCreators[msg.sender] || msg.sender == owner(), "Not authorized to create tokens");
        require(msg.value >= tokenCreationFee, "Insufficient creation fee");
        require(bytes(name).length > 0, "Token name cannot be empty");
        require(bytes(symbol).length > 0, "Token symbol cannot be empty");
        require(initialSupply > 0, "Initial supply must be greater than 0");
        require(tokenBySymbol[symbol] == address(0), "Token symbol already exists");
        
        // 创建代币实例
        address tokenAddress = _createTokenInstance(name, symbol, initialSupply);
        
        // V2 新增：保存元数据
        tokenMetadata[symbol] = TokenMetadata({
            name: name,
            symbol: symbol,
            tokenAddress: tokenAddress,
            category: category,
            createdAt: block.timestamp,
            isActive: true,
            totalVolume: 0,
            creator: msg.sender
        });
        
        // V2 新增：按类别分组
        tokensByCategory[category].push(symbol);
        
        // 转移创建费用
        if (msg.value > 0 && feeRecipient != address(0)) {
            payable(feeRecipient).transfer(msg.value);
        }
        
        emit TokenCreated(tokenAddress, name, symbol);
        return tokenAddress;
    }
    
    // 兼容原有的创建函数（默认为股票类别）
    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external returns (address) {
        require(msg.sender == owner(), "Only owner can use legacy create function");
        return _createTokenWithCategory(name, symbol, initialSupply, TokenCategory.STOCK);
    }
    
    // V2 新增：批量创建代币
    function batchCreateTokens(
        string[] memory names,
        string[] memory symbols,
        uint256[] memory initialSupplies,
        TokenCategory[] memory categories
    ) external payable onlyOwner returns (address[] memory) {
        require(names.length <= maxBatchSize, "Batch size too large");
        require(names.length == symbols.length, "Arrays length mismatch");
        require(symbols.length == initialSupplies.length, "Arrays length mismatch");
        require(initialSupplies.length == categories.length, "Arrays length mismatch");
        
        uint256 totalFee = tokenCreationFee * names.length;
        require(msg.value >= totalFee, "Insufficient total creation fee");
        
        address[] memory newTokens = new address[](names.length);
        
        for (uint256 i = 0; i < names.length; i++) {
            newTokens[i] = _createTokenWithCategory(names[i], symbols[i], initialSupplies[i], categories[i]);
        }
        
        // 转移总费用
        if (msg.value > 0 && feeRecipient != address(0)) {
            payable(feeRecipient).transfer(msg.value);
        }
        
        emit BatchTokensCreated(names.length);
        return newTokens;
    }
    
    // V2 新增：更新代币类别
    function updateTokenCategory(string memory symbol, TokenCategory newCategory) external onlyOwner {
        require(tokenBySymbol[symbol] != address(0), "Token does not exist");
        
        TokenMetadata storage metadata = tokenMetadata[symbol];
        TokenCategory oldCategory = metadata.category;
        
        // 从旧类别中移除
        _removeFromCategory(symbol, oldCategory);
        
        // 添加到新类别
        tokensByCategory[newCategory].push(symbol);
        metadata.category = newCategory;
        
        emit TokenCategoryUpdated(symbol, oldCategory, newCategory);
    }
    
    // V2 新增：更新代币状态
    function updateTokenStatus(string memory symbol, bool isActive) external onlyOwner {
        require(tokenBySymbol[symbol] != address(0), "Token does not exist");
        
        tokenMetadata[symbol].isActive = isActive;
        emit TokenStatusUpdated(symbol, isActive);
    }
    
    // V2 新增：更新代币交易量（由代币合约调用）
    function updateTokenVolume(string memory symbol, uint256 additionalVolume) external {
        require(tokenBySymbol[symbol] == msg.sender, "Only token contract can update volume");
        
        tokenMetadata[symbol].totalVolume += additionalVolume;
        emit TokenVolumeUpdated(symbol, tokenMetadata[symbol].totalVolume);
    }
    
    // V2 新增：设置创建费用
    function setTokenCreationFee(uint256 newFee) external onlyOwner {
        tokenCreationFee = newFee;
        emit CreationFeeUpdated(newFee);
    }
    
    // V2 新增：设置费用接收地址
    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient address");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }
    
    // V2 新增：管理授权创建者
    function setAuthorizedCreator(address creator, bool status) external onlyOwner {
        authorizedCreators[creator] = status;
        emit AuthorizedCreatorUpdated(creator, status);
    }
    
    // V2 新增：设置批量操作限制
    function setMaxBatchSize(uint256 newMaxSize) external onlyOwner {
        require(newMaxSize > 0 && newMaxSize <= 50, "Invalid batch size");
        maxBatchSize = newMaxSize;
    }
    
    // V2 新增：按类别获取代币列表
    function getTokensByCategory(TokenCategory category) external view returns (string[] memory) {
        return tokensByCategory[category];
    }
    
    // V2 新增：获取活跃代币列表
    function getActiveTokens() external view returns (string[] memory) {
        uint256 activeCount = 0;
        
        // 计算活跃代币数量
        for (uint256 i = 0; i < allTokens.length; i++) {
            address tokenAddr = allTokens[i];
            string memory symbol = StockToken(tokenAddr).symbol();
            if (tokenMetadata[symbol].isActive) {
                activeCount++;
            }
        }
        
        // 构建活跃代币数组
        string[] memory activeTokens = new string[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allTokens.length; i++) {
            address tokenAddr = allTokens[i];
            string memory symbol = StockToken(tokenAddr).symbol();
            if (tokenMetadata[symbol].isActive) {
                activeTokens[index] = symbol;
                index++;
            }
        }
        
        return activeTokens;
    }
    
    // V2 新增：获取代币详细信息
    function getTokenInfo(string memory symbol) external view returns (
        address tokenAddress,
        TokenCategory category,
        uint256 createdAt,
        bool isActive,
        uint256 totalVolume,
        address creator
    ) {
        require(tokenBySymbol[symbol] != address(0), "Token does not exist");
        
        TokenMetadata memory metadata = tokenMetadata[symbol];
        return (
            metadata.tokenAddress,
            metadata.category,
            metadata.createdAt,
            metadata.isActive,
            metadata.totalVolume,
            metadata.creator
        );
    }
    
    // V2 新增：获取版本信息
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
    
    // 内部函数：创建代币实例
    function _createTokenInstance(string memory name, string memory symbol, uint256 initialSupply) internal returns (address) {
        require(tokenBySymbol[symbol] == address(0), "Token symbol already exists");
        
        // 创建代理合约
        ERC1967Proxy proxy = new ERC1967Proxy(
            stockTokenImplementation,
            abi.encodeWithSelector(
                StockToken.initialize.selector,
                name,
                symbol,
                initialSupply,
                oracleAggregator,
                usdtTokenAddress
            )
        );
        
        address tokenAddress = address(proxy);
        tokenBySymbol[symbol] = tokenAddress;
        allTokens.push(tokenAddress);
        
        return tokenAddress;
    }
    
    // 内部函数：创建带类别的代币
    function _createTokenWithCategory(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        TokenCategory category
    ) internal returns (address) {
        // 创建代币实例
        address tokenAddress = _createTokenInstance(name, symbol, initialSupply);
        
        // 保存元数据
        tokenMetadata[symbol] = TokenMetadata({
            name: name,
            symbol: symbol,
            tokenAddress: tokenAddress,
            category: category,
            createdAt: block.timestamp,
            isActive: true,
            totalVolume: 0,
            creator: msg.sender
        });
        
        // 按类别分组
        tokensByCategory[category].push(symbol);
        
        emit TokenCreated(tokenAddress, name, symbol);
        return tokenAddress;
    }
    
    // 内部函数：从类别中移除代币
    function _removeFromCategory(string memory symbol, TokenCategory category) internal {
        string[] storage categoryTokens = tokensByCategory[category];
        for (uint256 i = 0; i < categoryTokens.length; i++) {
            if (keccak256(bytes(categoryTokens[i])) == keccak256(bytes(symbol))) {
                categoryTokens[i] = categoryTokens[categoryTokens.length - 1];
                categoryTokens.pop();
                break;
            }
        }
    }
    
    // 现有函数保持不变
    function updateOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        oracleAggregator = newOracle;
        emit OracleUpdated(newOracle);
    }
    
    function updateImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "Invalid implementation address");
        stockTokenImplementation = newImplementation;
        emit ImplementationUpdated(newImplementation);
    }
    
    function getAllTokensCount() external view returns (uint256) {
        return allTokens.length;
    }
    
    function getTokenAt(uint256 index) external view returns (address) {
        require(index < allTokens.length, "Index out of bounds");
        return allTokens[index];
    }
}