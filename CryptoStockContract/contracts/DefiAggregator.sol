// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./interfaces/IDefiAdapter.sol";
import "./interfaces/IOperationTypes.sol";

/**
 * @title DefiAggregator
 * @dev 纯净的 DeFi 聚合器 - 只使用适配器模式，无历史包袱
 */
contract DefiAggregator is 
    Initializable, 
    OwnableUpgradeable, 
    UUPSUpgradeable, 
    PausableUpgradeable,
    IOperationTypes
{
    using SafeERC20 for IERC20;
    
    // 适配器注册表
    mapping(string => address) private _adapters;
    string[] private _adapterNames;
    
    // 手续费率 (基点)
    uint24 public feeRateBps;
    
    // 事件
    event AdapterRegistered(string indexed adapterName, address indexed adapterAddress);
    event AdapterRemoved(string indexed adapterName, address indexed adapterAddress);
    event OperationExecuted(address indexed user, string indexed adapterName, OperationType indexed operationType);
    event FeeRateChanged(uint256 oldRate, uint256 newRate);
    
    modifier onlyValidAdapter(string calldata adapterName) {
        require(_adapters[adapterName] != address(0), "Adapter not found");
        _;
    }
    
    /**
     * @dev 初始化聚合器
     */
    function initialize(uint24 _feeRateBps) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __Pausable_init();
        
        require(_feeRateBps <= 1000, "Fee rate too high"); // 最大 10%
        feeRateBps = _feeRateBps;
    }
    
    /**
     * @dev 注册适配器
     */
    function registerAdapter(string calldata adapterName, address adapterAddress) external onlyOwner {
        require(adapterAddress != address(0), "Invalid adapter address");
        require(_adapters[adapterName] == address(0), "Adapter already exists");
        
        _adapters[adapterName] = adapterAddress;
        _adapterNames.push(adapterName);
        
        emit AdapterRegistered(adapterName, adapterAddress);
    }
    
    /**
     * @dev 移除适配器
     */
    function removeAdapter(string calldata adapterName) external onlyOwner {
        address adapterAddress = _adapters[adapterName];
        require(adapterAddress != address(0), "Adapter not found");
        
        delete _adapters[adapterName];
        
        // 从数组中移除
        for (uint i = 0; i < _adapterNames.length; i++) {
            if (keccak256(bytes(_adapterNames[i])) == keccak256(bytes(adapterName))) {
                _adapterNames[i] = _adapterNames[_adapterNames.length - 1];
                _adapterNames.pop();
                break;
            }
        }
        
        emit AdapterRemoved(adapterName, adapterAddress);
    }
    
    /**
     * @dev 执行 DeFi 操作
     */
    function executeOperation(
        string calldata adapterName,
        OperationType operationType,
        OperationParams calldata params
    ) external whenNotPaused onlyValidAdapter(adapterName) returns (OperationResult memory result) {
        require(params.tokens.length > 0, "No tokens provided");
        
        address adapterAddress = _adapters[adapterName];
        
        // 验证适配器支持该操作
        require(IDefiAdapter(adapterAddress).supportsOperation(operationType), "Operation not supported");
        
        // 直接调用适配器执行操作
        // 受益者地址已经在 params.recipient 中指定
        result = IDefiAdapter(adapterAddress).executeOperation(operationType, params, feeRateBps);
        
        require(result.success, "Operation failed");
        
        emit OperationExecuted(msg.sender, adapterName, operationType);
        
        return result;
    }
    
    /**
     * @dev 预估操作结果
     */
    function estimateOperation(
        string calldata adapterName,
        OperationType operationType,
        OperationParams calldata params
    ) external view onlyValidAdapter(adapterName) returns (OperationResult memory) {
        address adapterAddress = _adapters[adapterName];
        return IDefiAdapter(adapterAddress).estimateOperation(operationType, params);
    }
    
    /**
     * @dev 获取适配器地址
     */
    function getAdapter(string calldata adapterName) external view returns (address) {
        return _adapters[adapterName];
    }
    
    /**
     * @dev 获取所有适配器名称
     */
    function getAllAdapters() external view returns (string[] memory) {
        return _adapterNames;
    }
    
    /**
     * @dev 检查适配器是否存在
     */
    function hasAdapter(string calldata adapterName) external view returns (bool) {
        return _adapters[adapterName] != address(0);
    }
    
    /**
     * @dev 设置手续费率
     */
    function setFeeRate(uint24 _feeRateBps) external onlyOwner {
        require(_feeRateBps <= 1000, "Fee rate too high");
        uint24 oldRate = feeRateBps;
        feeRateBps = _feeRateBps;
        emit FeeRateChanged(oldRate, _feeRateBps);
    }
    
    /**
     * @dev 紧急暂停
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 取消暂停
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
    
    // ============ 收益相关功能已移除 ============
    // 收益计算功能已移交给后端通过监听链上事件处理
    // 前端可以通过监听 VaultDeposit, VaultWithdraw 等事件
    // 结合 convertToAssets 等函数来计算实时收益
    
    /**
     * @dev UUPS升级授权
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}