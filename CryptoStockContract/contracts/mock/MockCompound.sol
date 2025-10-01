// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ICompound.sol";

/**
 * @title MockCToken
 * @dev Mock Compound cToken 合约用于测试
 */
contract MockCToken is ERC20, ICToken {
    address public override underlying;
    uint256 public exchangeRate;
    uint256 public supplyRate;
    
    // 事件
    event Mint(address minter, uint256 mintAmount, uint256 mintTokens);
    event Redeem(address redeemer, uint256 redeemAmount, uint256 redeemTokens);
    
    constructor(
        string memory name,
        string memory symbol,
        address _underlying,
        uint256 _initialExchangeRate
    ) ERC20(name, symbol) {
        underlying = _underlying;
        exchangeRate = _initialExchangeRate; // 通常是 1e18 开始
        supplyRate = 317097919; // 大约年化 1% (每个区块)
    }
    
    /**
     * @dev 存入底层资产，铸造 cToken
     */
    function mint(uint256 mintAmount) external override returns (uint256) {
        require(mintAmount > 0, "Mint amount must be greater than 0");
        
        // 从调用者转移底层资产到这个合约
        require(
            IERC20(underlying).transferFrom(msg.sender, address(this), mintAmount),
            "Transfer failed"
        );
        
        // 计算要铸造的 cToken 数量：mintAmount / exchangeRate
        uint256 mintTokens = (mintAmount * 1e18) / exchangeRate;
        
        // 铸造 cToken 给调用者
        _mint(msg.sender, mintTokens);
        
        emit Mint(msg.sender, mintAmount, mintTokens);
        return 0; // 0 表示成功
    }
    
    /**
     * @dev 获取账户的 cToken 余额 - 重写 ERC20 的 balanceOf
     */
    function balanceOf(address owner) public view override(ERC20, ICToken) returns (uint256) {
        return ERC20.balanceOf(owner);
    }
    function redeem(uint256 redeemTokens) external override returns (uint256) {
        require(redeemTokens > 0, "Redeem tokens must be greater than 0");
        require(balanceOf(msg.sender) >= redeemTokens, "Insufficient cToken balance");
        
        // 计算要返回的底层资产数量：redeemTokens * exchangeRate
        uint256 redeemAmount = (redeemTokens * exchangeRate) / 1e18;
        
        // 销毁调用者的 cToken
        _burn(msg.sender, redeemTokens);
        
        // 转移底层资产给调用者
        require(
            IERC20(underlying).transfer(msg.sender, redeemAmount),
            "Transfer failed"
        );
        
        emit Redeem(msg.sender, redeemAmount, redeemTokens);
        return 0; // 0 表示成功
    }
    
    /**
     * @dev 销毁 cToken，赎回指定数量的底层资产
     */
    function redeemUnderlying(uint256 redeemAmount) external override returns (uint256) {
        require(redeemAmount > 0, "Redeem amount must be greater than 0");
        
        // 计算需要销毁的 cToken 数量：redeemAmount / exchangeRate
        uint256 redeemTokens = (redeemAmount * 1e18) / exchangeRate;
        
        require(balanceOf(msg.sender) >= redeemTokens, "Insufficient cToken balance");
        
        // 销毁调用者的 cToken
        _burn(msg.sender, redeemTokens);
        
        // 转移底层资产给调用者
        require(
            IERC20(underlying).transfer(msg.sender, redeemAmount),
            "Transfer failed"
        );
        
        emit Redeem(msg.sender, redeemAmount, redeemTokens);
        return 0; // 0 表示成功
    }
    
    /**
     * @dev 获取账户可赎回的底层资产数量
     */
    function balanceOfUnderlying(address owner) external view override returns (uint256) {
        uint256 cTokenBalance = balanceOf(owner);
        return (cTokenBalance * exchangeRate) / 1e18;
    }
    
    /**
     * @dev 获取当前存储的汇率
     */
    function exchangeRateStored() external view override returns (uint256) {
        return exchangeRate;
    }
    
    /**
     * @dev 获取当前实时汇率并更新利息
     */
    function exchangeRateCurrent() external override returns (uint256) {
        // 简单的利息累积模拟
        _accrueInterest();
        return exchangeRate;
    }
    
    /**
     * @dev 获取每个区块的供应利率
     */
    function supplyRatePerBlock() external view override returns (uint256) {
        return supplyRate;
    }
    
    // ===== 测试辅助函数 =====
    
    /**
     * @dev 设置汇率（仅用于测试）
     */
    function setExchangeRate(uint256 _exchangeRate) external {
        exchangeRate = _exchangeRate;
    }
    
    /**
     * @dev 设置供应利率（仅用于测试）
     */
    function setSupplyRate(uint256 _supplyRate) external {
        supplyRate = _supplyRate;
    }
    
    /**
     * @dev 模拟利息累积
     */
    function _accrueInterest() internal {
        // 简单模拟：每次调用增长 0.001%
        exchangeRate = exchangeRate + (exchangeRate / 100000);
    }
    
    /**
     * @dev 为池子添加流动性（仅用于测试）
     */
    function addLiquidity(uint256 amount) external {
        require(
            IERC20(underlying).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
    }
}