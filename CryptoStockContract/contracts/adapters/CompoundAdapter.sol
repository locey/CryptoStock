// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IDefiAdapter.sol";
import "../interfaces/ICompound.sol";

/**
 * @title CompoundAdapter
 * @dev 可升级的 Compound V2 协议适配器 - 仅支持 USDC 存款和取款操作，支持 UUPS 升级
 */
contract CompoundAdapter is 
    Initializable,
    OwnableUpgradeable, 
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IDefiAdapter 
{
    using SafeERC20 for IERC20;
    
    // Compound cUSDC 合约地址
    address public cUsdcToken;
    
    // USDC 代币地址 - 可配置支持不同网络
    address public usdcToken;
    
    // 用户本金记录 (user => principal) - 用于收益计算
    mapping(address => uint256) private _userPrincipal;
    
    // 常量
    uint256 private constant EXCHANGE_RATE_SCALE = 1e18;
    uint256 private constant BLOCKS_PER_YEAR = 2102400; // 大约每年的区块数（15秒/块）
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev 初始化 Compound 适配器
     */
    function initialize(
        address _cUsdcToken,
        address _usdcToken,
        address _owner
    ) external initializer {
        require(_cUsdcToken != address(0), "Invalid cUSDC address");
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_owner != address(0), "Invalid owner address");
        
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        cUsdcToken = _cUsdcToken;
        usdcToken = _usdcToken;
    }
    
    // ===== IDefiAdapter 接口实现 =====
    
    function supportsOperation(OperationType operationType) external pure override returns (bool) {
        return operationType == OperationType.DEPOSIT || operationType == OperationType.WITHDRAW;
    }
    
    function executeOperation(
        OperationType operationType,
        OperationParams calldata params,
        uint256 feeRateBps
    ) external override whenNotPaused nonReentrant returns (OperationResult memory result) {
        if (operationType == OperationType.DEPOSIT) {
            return _handleDeposit(params, feeRateBps);
        } else if (operationType == OperationType.WITHDRAW) {
            return _handleWithdraw(params, feeRateBps);
        } else {
            revert("Unsupported operation");
        }
    }
    
    function estimateOperation(
        OperationType operationType,
        OperationParams calldata params
    ) external pure override returns (OperationResult memory result) {
        result.success = true;
        result.outputAmounts = new uint256[](1);
        
        if (operationType == OperationType.DEPOSIT) {
            // 估算存款后能获得的收益
            result.outputAmounts[0] = params.amounts[0]; // 简化：假设1:1兑换
            result.message = "Estimated deposit successful";
        } else if (operationType == OperationType.WITHDRAW) {
            // 估算取款能得到的金额
            result.outputAmounts[0] = params.amounts[0];
            result.message = "Estimated withdraw successful";
        } else {
            result.success = false;
            result.message = "Unsupported operation";
        }
        
        return result;
    }
    
    function getMinAmounts(
        OperationType /* operationType */,
        OperationParams calldata /* params */
    ) external pure override returns (uint256[] memory minAmounts) {
        minAmounts = new uint256[](1);
        minAmounts[0] = 1; // 最小 1 wei
    }
    
    function getUserBalances(address user) external view override returns (uint256 balance) {
        return _userPrincipal[user];
    }
    
    function getUserYield(address user) external view override returns (
        uint256 principal,
        uint256 currentValue, 
        uint256 profit,
        bool isProfit
    ) {
        principal = _userPrincipal[user];
        
        if (principal == 0) {
            return (0, 0, 0, true);
        }
        
        // 直接查询用户持有的 cToken 余额，然后计算当前价值
        try ICToken(cUsdcToken).balanceOf(user) returns (uint256 userCTokens) {
            if (userCTokens == 0) {
                currentValue = 0;
            } else {
                // 计算当前价值：cToken余额 * 当前汇率
                uint256 exchangeRate = ICToken(cUsdcToken).exchangeRateStored();
                currentValue = (userCTokens * exchangeRate) / EXCHANGE_RATE_SCALE;
            }
            
            if (currentValue >= principal) {
                profit = currentValue - principal;
                isProfit = true;
            } else {
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
        return "CompoundAdapter";
    }
    
    function getAdapterVersion() external pure override returns (string memory) {
        return "1.0.0";
    }
    
    // ===== 内部操作函数 =====
    
    /**
     * @dev 处理存款操作
     */
    function _handleDeposit(
        OperationParams calldata params,
        uint256 feeRateBps
    ) internal returns (OperationResult memory result) {
        require(params.tokens.length == 1, "Deposit supports single token only");
        require(params.amounts.length == 1, "Amount array mismatch");
        require(params.tokens[0] == usdcToken, "Only USDC deposits supported");
        require(params.amounts[0] > 0, "Amount must be greater than 0");
        
        address user = params.recipient;
        require(user != address(0), "Recipient address must be specified");
        
        uint256 depositAmount = params.amounts[0];
        
        // 计算手续费
        uint256 fee = (depositAmount * feeRateBps) / 10000;
        uint256 netAmount = depositAmount - fee;
        
        // 从用户转入 USDC 到适配器
        IERC20(usdcToken).safeTransferFrom(user, address(this), depositAmount);
        
        // 授权并存入 Compound
        IERC20(usdcToken).approve(cUsdcToken, netAmount);
        uint256 mintResult = ICToken(cUsdcToken).mint(netAmount);
        require(mintResult == 0, "Compound mint failed");
        
        // 获取适配器铸造的 cToken 数量
        uint256 newCTokens = ICToken(cUsdcToken).balanceOf(address(this));
        
        // 将 cToken 转给用户
        IERC20(cUsdcToken).safeTransfer(user, newCTokens);
        
        // 更新用户本金记录
        _userPrincipal[user] += netAmount;
        
        result.success = true;
        result.outputAmounts = new uint256[](1);
        result.outputAmounts[0] = newCTokens;
        result.message = "Deposit successful";
        
        emit OperationExecuted(user, OperationType.DEPOSIT, params.tokens, params.amounts, "");
        
        return result;
    }
    
    /**
     * @dev 处理取款操作
     */
    function _handleWithdraw(
        OperationParams calldata params,
        uint256 /* feeRateBps */
    ) internal returns (OperationResult memory result) {
        require(params.tokens.length == 1, "Withdraw supports single token only");
        require(params.amounts.length == 1, "Amount array mismatch");
        require(params.tokens[0] == usdcToken, "Only USDC withdraws supported");
        require(params.amounts[0] > 0, "Amount must be greater than 0");
        
        address user = params.recipient;
        require(user != address(0), "Recipient address must be specified");
        
        uint256 withdrawAmount = params.amounts[0];
        require(_userPrincipal[user] >= withdrawAmount, "Insufficient balance");
        
        // 计算需要赎回的 cToken 数量
        uint256 exchangeRate = ICToken(cUsdcToken).exchangeRateCurrent();
        uint256 cTokensNeeded = (withdrawAmount * EXCHANGE_RATE_SCALE) / exchangeRate;
        
        // 检查用户的 cToken 余额是否足够
        uint256 userCTokenBalance = ICToken(cUsdcToken).balanceOf(user);
        require(userCTokenBalance >= cTokensNeeded, "Insufficient cToken balance");
        
        // 用户将 cToken 转给适配器
        IERC20(cUsdcToken).safeTransferFrom(user, address(this), cTokensNeeded);
        
        // 从 Compound 赎回指定数量的底层资产
        uint256 redeemResult = ICToken(cUsdcToken).redeemUnderlying(withdrawAmount);
        require(redeemResult == 0, "Compound redeem failed");
        
        // 转账给用户
        IERC20(usdcToken).safeTransfer(user, withdrawAmount);
        
        // 更新用户本金记录
        _userPrincipal[user] -= withdrawAmount;
        
        result.success = true;
        result.outputAmounts = new uint256[](1);
        result.outputAmounts[0] = withdrawAmount;
        result.message = "Withdraw successful";
        
        emit OperationExecuted(user, OperationType.WITHDRAW, params.tokens, params.amounts, "");
        
        return result;
    }
    
    // ===== 查询函数 =====
    
    /**
     * @dev 获取当前 Compound 供应利率（年化）
     */
    function getCurrentAPY() external view returns (uint256) {
        uint256 supplyRatePerBlock = ICToken(cUsdcToken).supplyRatePerBlock();
        // 计算年化利率：(1 + supplyRatePerBlock) ^ BLOCKS_PER_YEAR - 1
        // 简化计算：supplyRatePerBlock * BLOCKS_PER_YEAR
        return supplyRatePerBlock * BLOCKS_PER_YEAR;
    }
    
    /**
     * @dev 获取当前汇率
     */
    function getCurrentExchangeRate() external view returns (uint256) {
        return ICToken(cUsdcToken).exchangeRateStored();
    }
    
    /**
     * @dev 获取用户的 cToken 余额
     */
    function getUserCTokenBalance(address user) external view returns (uint256) {
        return ICToken(cUsdcToken).balanceOf(user);
    }
    
    // ===== UUPS 升级功能 =====
    
    /**
     * @dev UUPS 升级授权 - 只有所有者可以升级
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev 设置新的 cUSDC 地址（仅在升级时使用）
     */
    function setCUsdcToken(address _cUsdcToken) external onlyOwner {
        require(_cUsdcToken != address(0), "Invalid cUSDC address");
        cUsdcToken = _cUsdcToken;
    }
    
    /**
     * @dev 设置 USDC 代币地址（仅在升级或迁移时使用）
     */
    function setUsdcToken(address _usdcToken) external onlyOwner {
        require(_usdcToken != address(0), "Invalid USDC token address");
        usdcToken = _usdcToken;
    }
    
    /**
     * @dev 紧急暂停功能
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 恢复功能
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 紧急提取功能（仅所有者）
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}