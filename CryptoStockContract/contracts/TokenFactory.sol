// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./StockToken.sol";

// ===================== 代币工厂合约 (UUPS 可升级) =====================
contract TokenFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable {
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
    
    event TokenCreated(address indexed tokenAddress, string name, string symbol);
    event OracleUpdated(address newOracle);
    event ImplementationUpdated(address newImplementation);
    
    
    function initialize(address _oracleAggregator, address _stockTokenImplementation, address _usdtTokenAddress) initializer public {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        oracleAggregator = _oracleAggregator;
        stockTokenImplementation = _stockTokenImplementation;
        usdtTokenAddress = _usdtTokenAddress;
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
    
    // 创建新代币
    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external onlyOwner returns (address) {
        require(bytes(name).length > 0, "Token name cannot be empty");
        require(bytes(symbol).length > 0, "Token symbol cannot be empty");
        require(initialSupply > 0, "Initial supply must be greater than 0");
        require(tokenBySymbol[symbol] == address(0), "Token already exists");
        require(stockTokenImplementation != address(0), "Implementation not set");
        require(usdtTokenAddress != address(0), "USDT token address not set");
        
        // 准备初始化数据
        bytes memory initData = abi.encodeCall(
            StockToken.initialize,
            (name, symbol, initialSupply, msg.sender, oracleAggregator, usdtTokenAddress)
        );
        
        // 使用代理模式创建新的 StockToken 实例
        ERC1967Proxy proxy = new ERC1967Proxy(stockTokenImplementation, initData);
        address tokenAddress = address(proxy);
        
        tokenBySymbol[symbol] = tokenAddress;
        allTokens.push(tokenAddress);
        
        emit TokenCreated(tokenAddress, name, symbol);
        return tokenAddress;
    }
    
    // 获取代币地址
    function getTokenAddress(string memory symbol) external view returns (address) {
        return tokenBySymbol[symbol];
    }
    
    // 获取所有代币
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
    
    // 获取代币符号和地址映射 (最简实现)
    function getTokensMapping() external view returns (string[] memory symbols, address[] memory addresses) {
        uint256 length = allTokens.length;
        symbols = new string[](length);
        addresses = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            addresses[i] = allTokens[i];
            // 从代币合约获取符号
            symbols[i] = StockToken(allTokens[i]).symbol();
        }
        
        return (symbols, addresses);
    }
    
    // 更新预言机地址
    function setOracleAggregator(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        oracleAggregator = newOracle;
        emit OracleUpdated(newOracle);
    }
    
    // 设置 StockToken 实现合约地址
    function setStockTokenImplementation(address newImplementation) external onlyOwner {
        require(newImplementation != address(0), "Invalid implementation address");
        stockTokenImplementation = newImplementation;
        emit ImplementationUpdated(newImplementation);
    }
    
    // 设置 USDT 代币地址
    function setUSDTTokenAddress(address newUSDTTokenAddress) external onlyOwner {
        require(newUSDTTokenAddress != address(0), "Invalid USDT token address");
        usdtTokenAddress = newUSDTTokenAddress;
    }
}