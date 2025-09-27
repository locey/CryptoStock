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
    uint256 public feeRateBps;
    
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
    function initialize(uint256 _feeRateBps) public initializer {
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
    function setFeeRate(uint256 _feeRateBps) external onlyOwner {
        require(_feeRateBps <= 1000, "Fee rate too high");
        uint256 oldRate = feeRateBps;
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
    
    /**
     * @dev 获取用户的总收益信息（聚合所有适配器）
     * @param user 用户地址
     * @return totalPrincipal 总本金
     * @return totalCurrentValue 总当前价值
     * @return totalProfit 总收益/损失金额
     * @return isProfit 总体是否盈利
     */
    function getUserTotalYield(address user) external view returns (
        uint256 totalPrincipal,
        uint256 totalCurrentValue,
        uint256 totalProfit,
        bool isProfit
    ) {
        uint256 totalProfitAmount = 0;
        uint256 totalLossAmount = 0;
        
        // 遍历所有注册的适配器
        for (uint i = 0; i < _adapterNames.length; i++) {
            address adapterAddress = _adapters[_adapterNames[i]];
            
            try IDefiAdapter(adapterAddress).getUserYield(user) returns (
                uint256 principal,
                uint256 currentValue,
                uint256 profit,
                bool adapterIsProfit
            ) {
                totalPrincipal += principal;
                totalCurrentValue += currentValue;
                
                if (adapterIsProfit) {
                    totalProfitAmount += profit;
                } else {
                    totalLossAmount += profit;
                }
            } catch {
                // 忽略调用失败的适配器，继续处理其他适配器
                continue;
            }
        }
        
        // 计算总体盈亏
        if (totalProfitAmount >= totalLossAmount) {
            totalProfit = totalProfitAmount - totalLossAmount;
            isProfit = true;
        } else {
            totalProfit = totalLossAmount - totalProfitAmount;
            isProfit = false;
        }
    }
    
    /**
     * @dev 获取用户在指定适配器中的收益信息
     * @param user 用户地址
     * @param adapterName 适配器名称
     */
    function getUserYieldByAdapter(
        address user,
        string calldata adapterName
    ) external view onlyValidAdapter(adapterName) returns (
        uint256 principal,
        uint256 currentValue,
        uint256 profit,
        bool isProfit
    ) {
        address adapterAddress = _adapters[adapterName];
        return IDefiAdapter(adapterAddress).getUserYield(user);
    }
    
    /**
     * @dev 获取用户的详细收益信息（包含所有适配器的明细）
     * @param user 用户地址
     * @return adapterNames 适配器名称数组
     * @return principals 各适配器本金数组
     * @return currentValues 各适配器当前价值数组
     * @return profits 各适配器收益/损失数组
     * @return isProfits 各适配器是否盈利数组
     */
    function getUserDetailedYield(address user) external view returns (
        string[] memory adapterNames,
        uint256[] memory principals,
        uint256[] memory currentValues,
        uint256[] memory profits,
        bool[] memory isProfits
    ) {
        uint256 activeAdapters = 0;
        
        // 第一次遍历：统计有效适配器数量
        for (uint i = 0; i < _adapterNames.length; i++) {
            address adapterAddress = _adapters[_adapterNames[i]];
            try IDefiAdapter(adapterAddress).getUserYield(user) returns (
                uint256 principal, uint256, uint256, bool
            ) {
                if (principal > 0) {
                    activeAdapters++;
                }
            } catch {
                continue;
            }
        }
        
        // 初始化返回数组
        adapterNames = new string[](activeAdapters);
        principals = new uint256[](activeAdapters);
        currentValues = new uint256[](activeAdapters);
        profits = new uint256[](activeAdapters);
        isProfits = new bool[](activeAdapters);
        
        // 第二次遍历：填充数据
        uint256 index = 0;
        for (uint i = 0; i < _adapterNames.length && index < activeAdapters; i++) {
            address adapterAddress = _adapters[_adapterNames[i]];
            try IDefiAdapter(adapterAddress).getUserYield(user) returns (
                uint256 principal,
                uint256 currentValue,
                uint256 profit,
                bool isProfit
            ) {
                if (principal > 0) {
                    adapterNames[index] = _adapterNames[i];
                    principals[index] = principal;
                    currentValues[index] = currentValue;
                    profits[index] = profit;
                    isProfits[index] = isProfit;
                    index++;
                }
            } catch {
                continue;
            }
        }
    }
    
    /**
     * @dev UUPS升级授权
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}