// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/**
 * @title ICompound
 * @dev Compound V2 协议接口定义
 */

/**
 * @dev CToken 接口 (如 cUSDC)
 */
interface ICToken {
    /**
     * @dev 存入底层资产，铸造 cToken
     * @param mintAmount 要存入的底层资产数量
     * @return 0 表示成功，非零表示错误代码
     */
    function mint(uint256 mintAmount) external returns (uint256);
    
    /**
     * @dev 销毁 cToken，赎回底层资产
     * @param redeemTokens 要销毁的 cToken 数量
     * @return 0 表示成功，非零表示错误代码
     */
    function redeem(uint256 redeemTokens) external returns (uint256);
    
    /**
     * @dev 销毁 cToken，赎回指定数量的底层资产
     * @param redeemAmount 要赎回的底层资产数量
     * @return 0 表示成功，非零表示错误代码
     */
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    
    /**
     * @dev 获取账户的 cToken 余额
     * @param owner 账户地址
     * @return cToken 余额
     */
    function balanceOf(address owner) external view returns (uint256);
    
    /**
     * @dev 获取账户可赎回的底层资产数量
     * @param owner 账户地址
     * @return 底层资产数量
     */
    function balanceOfUnderlying(address owner) external returns (uint256);
    
    /**
     * @dev 获取当前存储的汇率（cToken 对底层资产）
     * @return 汇率（18位精度）
     */
    function exchangeRateStored() external view returns (uint256);
    
    /**
     * @dev 获取当前实时汇率并更新利息
     * @return 汇率（18位精度）
     */
    function exchangeRateCurrent() external returns (uint256);
    
    /**
     * @dev 获取每个区块的供应利率
     * @return 每个区块的利率
     */
    function supplyRatePerBlock() external view returns (uint256);
    
    /**
     * @dev 获取底层资产地址
     * @return 底层资产合约地址
     */
    function underlying() external view returns (address);
}