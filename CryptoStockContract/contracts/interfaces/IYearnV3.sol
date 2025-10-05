// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IYearnV3Vault
 * @notice Yearn Finance V3 Vault 接口
 * @dev 基于 Yearn V3 ERC4626 标准简化接口
 */
interface IYearnV3Vault {
    
    // ============ 事件 ============
    
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    
    // ============ ERC4626 核心函数 ============
    
    /**
     * @notice 存入资产，获得份额
     * @param assets 存入的资产数量
     * @param receiver 接收份额的地址
     * @return shares 获得的份额数量
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    
    /**
     * @notice 取出资产，销毁份额
     * @param assets 取出的资产数量
     * @param receiver 接收资产的地址
     * @param owner 份额所有者
     * @return shares 销毁的份额数量
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    
    /**
     * @notice 赎回份额，取出对应资产
     * @param shares 赎回的份额数量
     * @param receiver 接收资产的地址  
     * @param owner 份额所有者
     * @return assets 获得的资产数量
     */
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    
    // ============ 查询函数 ============
    
    /**
     * @notice 获取底层资产地址
     */
    function asset() external view returns (address);
    
    /**
     * @notice 获取总资产管理量
     */
    function totalAssets() external view returns (uint256);
    
    /**
     * @notice 将资产数量转换为份额数量
     */
    function convertToShares(uint256 assets) external view returns (uint256 shares);
    
    /**
     * @notice 将份额数量转换为资产数量
     */
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    
    /**
     * @notice 预览存款能获得的份额
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    
    /**
     * @notice 预览取款需要销毁的份额
     */
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);
    
    /**
     * @notice 预览赎回能获得的资产
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
    
    /**
     * @notice 获取用户最大取款额度
     */
    function maxWithdraw(address owner) external view returns (uint256 maxAssets);
    
    /**
     * @notice 获取用户最大赎回份额
     */
    function maxRedeem(address owner) external view returns (uint256 maxShares);
    
    // ============ ERC20 基础函数 ============
    
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}