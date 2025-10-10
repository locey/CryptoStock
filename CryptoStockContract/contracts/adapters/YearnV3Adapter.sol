// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IDefiAdapter.sol";
import "../interfaces/IOperationTypes.sol";
import "../interfaces/IYearnV3.sol";

/**
 * @title YearnV3Adapter
 * @notice Yearn Finance V3 协议适配器，支持存款取款和收益计算
 * @dev 实现与 Yearn V3 Vault 的存款和取款功能，支持 UUPS 升级
 */
contract YearnV3Adapter is 
    Initializable,
    OwnableUpgradeable, 
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    IDefiAdapter 
{
    using SafeERC20 for IERC20;
    
    // ============ 事件定义 ============
    
    event VaultDeposit(
        address indexed user,
        address indexed vault,
        uint256 assets,
        uint256 shares,
        uint256 timestamp
    );
    
    event VaultWithdraw(
        address indexed user,
        address indexed vault,
        uint256 shares,
        uint256 assets,
        uint256 timestamp
    );
    
    // ============ 状态变量 ============
    
    /// @notice 支持的 Yearn V3 Vault 地址
    address public yearnVault;
    
    /// @notice 底层资产代币地址
    address public underlyingToken;

    // ============ 构造函数与初始化 ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice 初始化函数
     * @param _yearnVault Yearn V3 Vault 合约地址
     * @param _underlyingToken 底层资产代币地址
     * @param _owner 合约所有者地址
     */
    function initialize(
        address _yearnVault,
        address _underlyingToken,
        address _owner
    ) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        require(_yearnVault != address(0), "Invalid vault address");
        require(_underlyingToken != address(0), "Invalid token address");
        
        yearnVault = _yearnVault;
        underlyingToken = _underlyingToken;
        
        // 验证 vault 和 token 的匹配性
        require(IYearnV3Vault(_yearnVault).asset() == _underlyingToken, "Token mismatch");
    }

    // ============ 管理员功能 ============
    
    /**
     * @notice 设置 Yearn Vault 地址
     * @param _yearnVault 新的 Vault 地址
     */
    function setYearnVault(address _yearnVault) external onlyOwner {
        require(_yearnVault != address(0), "Invalid vault address");
        require(IYearnV3Vault(_yearnVault).asset() == underlyingToken, "Token mismatch");
        yearnVault = _yearnVault;
    }

    // ============ IAdapter 接口实现 ============
    
    /**
     * @notice 获取适配器名称
     */
    function getAdapterName() external pure override returns (string memory) {
        return "YearnV3Adapter";
    }
    
    /**
     * @notice 获取适配器版本
     */
    function getAdapterVersion() external pure override returns (string memory) {
        return "1.0.0";
    }
    
    /**
     * @notice 检查是否支持指定操作类型
     */
    function supportsOperation(OperationType operationType) external pure override returns (bool) {
        return operationType == OperationType.DEPOSIT || 
               operationType == OperationType.WITHDRAW;
    }
    
    /**
     * @notice 获取支持的操作类型列表
     */
    function getSupportedOperations() external pure override returns (OperationType[] memory operations) {
        operations = new OperationType[](2);
        operations[0] = OperationType.DEPOSIT;
        operations[1] = OperationType.WITHDRAW;
    }
    
    /**
     * @notice 执行操作
     * @param operationType 操作类型
     * @param params 操作参数
     * @param feeRateBps 手续费率（基点）
     */
    function executeOperation(
        OperationType operationType,
        OperationParams calldata params,
        uint24 feeRateBps
    ) external override nonReentrant whenNotPaused returns (OperationResult memory) {
        require(yearnVault != address(0), "Vault not set");
        
        if (operationType == OperationType.DEPOSIT) {
            return _handleDeposit(params, feeRateBps);
        } else if (operationType == OperationType.WITHDRAW) {
            return _handleWithdraw(params, feeRateBps);
        } else {
            revert("Unsupported operation");
        }
    }
    
    /**
     * @notice 预估操作结果
     */
    function estimateOperation(
        OperationType operationType,
        OperationParams calldata params
    ) external view override returns (OperationResult memory) {
        if (operationType == OperationType.DEPOSIT) {
            uint256 assets = params.amounts[0];
            uint256 estimatedShares = IYearnV3Vault(yearnVault).previewDeposit(assets);
            
            uint256[] memory outputAmounts = new uint256[](1);
            outputAmounts[0] = estimatedShares;
            
            return OperationResult({
                success: true,
                outputAmounts: outputAmounts,
                returnData: abi.encode(estimatedShares),
                message: "Estimated deposit result"
            });
        } else if (operationType == OperationType.WITHDRAW) {
            uint256 shares = params.amounts[0];
            uint256 estimatedAssets = IYearnV3Vault(yearnVault).previewRedeem(shares);
            
            uint256[] memory outputAmounts = new uint256[](1);
            outputAmounts[0] = estimatedAssets;
            
            return OperationResult({
                success: true,
                outputAmounts: outputAmounts,
                returnData: abi.encode(estimatedAssets),
                message: "Estimated withdraw result"
            });
        }
        
        revert("Unsupported operation for estimation");
    }

    // ============ 内部操作处理函数 ============
    
    /**
     * @notice 处理存款操作
     * @param params 操作参数
     * @param feeRateBps 手续费率（基点）
     */
    function _handleDeposit(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory) {
        require(params.tokens.length == 1, "YearnV3 requires exactly 1 token");
        require(params.tokens[0] == underlyingToken, "Token mismatch");
        require(params.amounts.length >= 1, "Invalid amounts array");
        
        uint256 depositAmount = params.amounts[0];
        require(depositAmount > 0, "Deposit amount must be positive");
        
        // 验证用户余额
        uint256 userBalance = IERC20(underlyingToken).balanceOf(params.recipient);
        require(userBalance >= depositAmount, "Insufficient user balance");
        
        // 验证用户授权
        uint256 allowance = IERC20(underlyingToken).allowance(params.recipient, address(this));
        require(allowance >= depositAmount, "Insufficient allowance");
        
        IYearnV3Vault vault = IYearnV3Vault(yearnVault);
        
        // 转入代币到合约
        IERC20(underlyingToken).safeTransferFrom(params.recipient, address(this), depositAmount);
        
        // 授权给 Vault
        IERC20(underlyingToken).forceApprove(yearnVault, depositAmount);
        
        // 计算手续费
        uint256 feeAmount = (depositAmount * feeRateBps) / 10000;
        uint256 netDepositAmount = depositAmount - feeAmount;
        
        // 存入 Vault
        uint256 sharesReceived = vault.deposit(netDepositAmount, params.recipient);
        
        emit VaultDeposit(params.recipient, yearnVault, netDepositAmount, sharesReceived, block.timestamp);
        
        // 构造返回结果
        uint256[] memory outputAmounts = new uint256[](1);
        outputAmounts[0] = sharesReceived;
        
        return OperationResult({
            success: true,
            outputAmounts: outputAmounts,
            returnData: abi.encode(sharesReceived),
            message: "Deposit successful"
        });
    }
    
    /**
     * @notice 处理取款操作
     * @param params 操作参数  
     * @param feeRateBps 手续费率（基点）
     */
    function _handleWithdraw(
        OperationParams calldata params,
        uint24 feeRateBps
    ) internal returns (OperationResult memory) {
        require(params.tokens.length == 1, "YearnV3 requires exactly 1 token");
        require(params.tokens[0] == underlyingToken, "Token mismatch");
        require(params.amounts.length >= 1, "Invalid amounts array");
        
        // 用户想要提取的资产金额（美元价值）
        uint256 assetsToWithdraw = params.amounts[0];
        require(assetsToWithdraw > 0, "Withdraw amount must be positive");
        
        IYearnV3Vault vault = IYearnV3Vault(yearnVault);
        
        // 计算手续费
        uint256 feeAmount = (assetsToWithdraw * feeRateBps) / 10000;
        uint256 netAssetsToWithdraw = assetsToWithdraw - feeAmount;
        
        // 检查用户份额余额
        uint256 userSharesBefore = vault.balanceOf(params.recipient);
        require(userSharesBefore > 0, "No shares to withdraw");
        
        uint256 sharesToTransfer;
        
        // 方案1：如果要取出全部价值，直接使用 redeem
        if (netAssetsToWithdraw >= vault.convertToAssets(userSharesBefore)) {
            // 完全取款：销毁所有份额
            sharesToTransfer = userSharesBefore;
            
            // 验证用户对份额代币的授权
            uint256 shareAllowance = IERC20(yearnVault).allowance(params.recipient, address(this));
            require(shareAllowance >= sharesToTransfer, "Insufficient share allowance");
            
            // 转入所有份额到合约
            IERC20(yearnVault).safeTransferFrom(params.recipient, address(this), sharesToTransfer);
            
            // 使用 redeem 函数：销毁所有份额，获取对应资产
            uint256 actualAssetsReceived = vault.redeem(sharesToTransfer, params.recipient, address(this));
            netAssetsToWithdraw = actualAssetsReceived; // 更新为实际获得的资产
        } else {
            // 部分取款：使用 withdraw 函数
            sharesToTransfer = vault.previewWithdraw(netAssetsToWithdraw);
            require(userSharesBefore >= sharesToTransfer, "Insufficient shares");
            
            // 验证用户对份额代币的授权
            uint256 shareAllowance = IERC20(yearnVault).allowance(params.recipient, address(this));
            require(shareAllowance >= sharesToTransfer, "Insufficient share allowance");
            
            // 转入需要的份额到合约
            IERC20(yearnVault).safeTransferFrom(params.recipient, address(this), sharesToTransfer);
            
            // 使用 withdraw 函数：指定资产数量
            vault.withdraw(netAssetsToWithdraw, params.recipient, address(this));
        }
        
        // 实际销毁的份额数量
        uint256 userSharesAfter = vault.balanceOf(params.recipient);
        uint256 sharesBurned = userSharesBefore - userSharesAfter;
        
        // 处理剩余份额：如果转移的份额多于实际销毁的份额，需要退还
        if (sharesToTransfer > sharesBurned) {
            uint256 excessShares = sharesToTransfer - sharesBurned;
            // 从合约退还多余的份额给用户
            IERC20(yearnVault).safeTransfer(params.recipient, excessShares);
        }
        
        emit VaultWithdraw(params.recipient, yearnVault, sharesBurned, netAssetsToWithdraw, block.timestamp);
        
        // 构造返回结果
        uint256[] memory outputAmounts = new uint256[](1);
        outputAmounts[0] = netAssetsToWithdraw;
        
        return OperationResult({
            success: true,
            outputAmounts: outputAmounts,
            returnData: abi.encode(netAssetsToWithdraw),
            message: "Withdraw successful"
        });
    }

    // ============ 查询功能 ============
    
    /**
     * @notice 获取用户当前份额价值
     */
    function getUserCurrentValue(address user) external view returns (uint256) {
        uint256 shareBalance = IYearnV3Vault(yearnVault).balanceOf(user);
        return shareBalance > 0 ? 
            IYearnV3Vault(yearnVault).convertToAssets(shareBalance) : 0;
    }
    
    /**
     * @notice 预览存款能获得的份额
     */
    function previewDeposit(uint256 assets) external view returns (uint256) {
        require(yearnVault != address(0), "Vault not set");
        return IYearnV3Vault(yearnVault).previewDeposit(assets);
    }
    
    /**
     * @notice 预览赎回能获得的资产
     */
    function previewRedeem(uint256 shares) external view returns (uint256) {
        require(yearnVault != address(0), "Vault not set");
        return IYearnV3Vault(yearnVault).previewRedeem(shares);
    }

    // ============ 紧急功能 ============
    
    /**
     * @notice 紧急提取代币（仅限所有者）
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    
    /**
     * @notice 暂停合约（仅限所有者）
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice 恢复合约（仅限所有者）
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ UUPS 升级授权 ============
    
    /**
     * @notice 授权升级（仅限所有者）
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}