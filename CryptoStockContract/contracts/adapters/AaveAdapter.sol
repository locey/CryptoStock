// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IDefiAdapter.sol";
import "../interfaces/IAave.sol";

/**
 * @title AaveAdapter
 * @dev 可升级的 Aave 协议适配器 - 仅支持 USDC 存款和取款操作，支持 UUPS 升级
 */
contract AaveAdapter is 
    Initializable,
    OwnableUpgradeable, 
    UUPSUpgradeable,
    PausableUpgradeable,
    IDefiAdapter 
{
    using SafeERC20 for IERC20;
    
    // Aave Pool 合约地址
    address public aavePool;
    
    // USDC 代币地址 - 可配置支持不同网络
    address public usdcToken;
    
    // aUSDC 代币地址 - 可配置支持不同网络和测试
    address public aUsdcToken;
    
    // 用户 USDC 余额记录 (user => balance) - 仅支持 USDC
    mapping(address => uint256) private _userBalances;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev 初始化 Aave 适配器
     */
    function initialize(
        address _aavePool, 
        address _usdcToken, 
        address _aUsdcToken,
        address _owner
    ) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __Pausable_init();
        
        require(_aavePool != address(0), "Invalid Aave pool address");
        require(_usdcToken != address(0), "Invalid USDC token address");
        require(_aUsdcToken != address(0), "Invalid aUSDC token address");
        
        aavePool = _aavePool;
        usdcToken = _usdcToken;
        aUsdcToken = _aUsdcToken;
    }
    
    // ===== IDefiAdapter 接口实现 =====
    
    function supportsOperation(OperationType operationType) external pure override returns (bool) {
        return (
            operationType == OperationType.DEPOSIT ||
            operationType == OperationType.WITHDRAW
        );
    }
    
    function executeOperation(
        OperationType operationType,
        OperationParams calldata params,
        uint24 feeRateBps
    ) external override whenNotPaused returns (OperationResult memory result) {
        
        if (operationType == OperationType.DEPOSIT) {
            return _handleDeposit(params, feeRateBps);
        } else if (operationType == OperationType.WITHDRAW) {
            return _handleWithdraw(params, feeRateBps);
        } else {
            revert("Operation not supported");
        }
    }
    
    function estimateOperation(
        OperationType operationType,
        OperationParams calldata params
    ) external pure override returns (OperationResult memory result) {
        // 简单的预估逻辑
        result.success = true;
        result.outputAmounts = new uint256[](params.amounts.length);
        
        for (uint i = 0; i < params.amounts.length; i++) {
            if (operationType == OperationType.DEPOSIT) {
                // 预估存款后的净金额（扣除手续费）
                result.outputAmounts[i] = params.amounts[i] * 99 / 100; // 假设1%手续费
            } else {
                result.outputAmounts[i] = params.amounts[i];
            }
        }
        
        result.message = "Estimate successful";
    }
    
    /**
     * @dev 获取用户 USDC 余额
     */
    function getUserBalances(address user) external view override returns (uint256 balance) {
        return _userBalances[user];
    }
    
    /**
     * @dev 获取用户的收益信息
     */
    function getUserYield(address user) external view override returns (
        uint256 principal,
        uint256 currentValue,
        uint256 profit,
        bool isProfit
    ) {
        // 本金：适配器记录的用户存款净额
        principal = _userBalances[user];
        
        // 如果用户没有存款记录，直接返回0
        if (principal == 0) {
            return (0, 0, 0, true);
        }
        
        // 直接查询用户的 aToken 余额
        try IAToken(aUsdcToken).balanceOf(user) returns (uint256 aTokenBalance) {
            currentValue = aTokenBalance;
            
            // 计算收益/损失
            if (currentValue >= principal) {
                // 有收益
                profit = currentValue - principal;
                isProfit = true;
            } else {
                // 有损失（理论上 Aave 不太可能出现，但为了安全考虑）
                profit = principal - currentValue;
                isProfit = false;
            }
        } catch {
            // 调用失败，返回本金作为当前价值
            currentValue = principal;
            profit = 0;
            isProfit = true;
        }
    }
    
    function getSupportedOperations() external pure override returns (OperationType[] memory operations) {
        operations = new OperationType[](2);
        operations[0] = OperationType.DEPOSIT;
        operations[1] = OperationType.WITHDRAW;
    }
    
    function getAdapterName() external pure override returns (string memory) {
        return "AaveAdapter";
    }
    
    function getAdapterVersion() external pure override returns (string memory) {
        return "3.0.0";
    }
    
    /**
     * @dev 获取当前配置的 USDC 代币地址
     */
    function getUsdcToken() external view returns (address) {
        return usdcToken;
    }
    
    /**
     * @dev 获取当前配置的 aUSDC 代币地址
     */
    function getAUsdcToken() external view returns (address) {
        return aUsdcToken;
    }
    
    // ===== 内部操作处理函数 =====
    
    function _handleDeposit(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory result) {
        require(params.tokens.length == 1, "Deposit supports single token only");
        require(params.amounts.length == 1, "Amount array mismatch");
        
        address token = params.tokens[0];
        uint256 amount = params.amounts[0];
        
        // 用户地址必须明确指定在 params.recipient 中
        address user = params.recipient;
        require(user != address(0), "Recipient address must be specified");
        
        // 直接从用户转移代币到本合约（用户需要预先授权给本合约）
        IERC20(token).safeTransferFrom(user, address(this), amount);
        
        // 计算手续费
        uint256 fee = (amount * feeRateBps) / 10000;
        uint256 netAmount = amount - fee;
        
        // 存入 Aave，aToken 发给受益者
        IERC20(token).approve(aavePool, netAmount);
        IAavePool(aavePool).supply(token, netAmount, user, 0);
        
        // 更新受益者的 USDC 余额记录
        _userBalances[user] += netAmount;
        
        // 构造返回结果
        result.success = true;
        result.outputAmounts = new uint256[](1);
        result.outputAmounts[0] = netAmount;
        result.message = "Deposit successful";
        
        emit OperationExecuted(user, OperationType.DEPOSIT, params.tokens, params.amounts, result.returnData);
        
        return result;
    }
    
    function _handleWithdraw(
        OperationParams calldata params,
        uint24 /* feeRateBps */
    ) internal returns (OperationResult memory result) {
        require(params.tokens.length == 1, "Withdraw supports single token only");
        require(params.amounts.length == 1, "Amount array mismatch");
        
        address token = params.tokens[0];
        uint256 amount = params.amounts[0];
        
        // 验证金额不能为零
        require(amount > 0, "Amount must be greater than zero");
        
        // 用户地址必须明确指定在 params.recipient 中
        address user = params.recipient;
        require(user != address(0), "Recipient address must be specified");
        
        require(_userBalances[user] >= amount, "Insufficient balance");
        
        // 从 Aave 取款到指定接收者
        uint256 actualAmount = IAavePool(aavePool).withdraw(token, amount, user);
        
        // 更新用户 USDC 余额记录
        _userBalances[user] -= amount;
        
        // 计算净金额（简化，不收取提现手续费）
        uint256 netAmount = actualAmount;
        
        result.success = true;
        result.outputAmounts = new uint256[](1);
        result.outputAmounts[0] = netAmount;
        result.message = "Withdraw successful";
        
        emit OperationExecuted(user, OperationType.WITHDRAW, params.tokens, params.amounts, result.returnData);
        
        return result;
    }
    
    // ===== UUPS 升级功能 =====
    
    /**
     * @dev UUPS 升级授权 - 只有所有者可以升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev 设置新的 Aave Pool 地址（仅在升级时使用）
     */
    function setAavePool(address _aavePool) external onlyOwner {
        require(_aavePool != address(0), "Invalid Aave pool address");
        aavePool = _aavePool;
    }
    
    /**
     * @dev 设置 USDC 代币地址（仅在升级或迁移时使用）
     */
    function setUsdcToken(address _usdcToken) external onlyOwner {
        require(_usdcToken != address(0), "Invalid USDC token address");
        usdcToken = _usdcToken;
    }
    
    /**
     * @dev 设置 aUSDC 代币地址（仅在升级或迁移时使用）
     */
    function setAUsdcToken(address _aUsdcToken) external onlyOwner {
        require(_aUsdcToken != address(0), "Invalid aUSDC token address");
        aUsdcToken = _aUsdcToken;
    }
    
    /**
     * @dev 紧急暂停适配器
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 取消暂停适配器
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 紧急提取代币（仅在暂停状态下）
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner whenPaused {
        require(to != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(to, amount);
    }
    
    /**
     * @dev 获取合约版本
     */
    function getContractVersion() external pure returns (string memory) {
        return "3.0.0";
    }
}