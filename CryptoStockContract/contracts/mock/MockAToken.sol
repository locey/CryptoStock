// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockAToken
 * @dev 模拟Aave的aToken，代表用户在Aave中的存款凭证
 * aToken余额会随时间增长，代表利息累积（这里简化处理）
 */
contract MockAToken is ERC20, Ownable {
    
    // underlying asset 地址（比如USDT地址）
    address public underlyingAsset;
    
    // 只有Pool合约可以铸造和销毁
    address public pool;
    
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    constructor(
        string memory name,      // 比如 "Aave USDT"
        string memory symbol,    // 比如 "aUSDT" 
        address _underlyingAsset,
        address _pool
    ) ERC20(name, symbol) Ownable(msg.sender) {
        underlyingAsset = _underlyingAsset;
        pool = _pool;
    }

    /**
     * @dev 只有Pool合约可以铸造aToken
     * 当用户存款时调用
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == pool, "Only pool can mint");
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /**
     * @dev 只有Pool合约可以销毁aToken  
     * 当用户取款时调用
     */
    function burn(address from, uint256 amount) external {
        require(msg.sender == pool, "Only pool can burn");
        _burn(from, amount);
        emit Burn(from, amount);
    }

    /**
     * @dev 设置新的Pool地址（仅owner）
     */
    function setPool(address _pool) external onlyOwner {
        require(_pool != address(0), "Invalid pool address");
        pool = _pool;
    }

    /**
     * @dev 获取underlying asset地址
     */
    function getUnderlyingAsset() external view returns (address) {
        return underlyingAsset;
    }

    /**
     * @dev 重写decimals以匹配underlying asset
     * 实际实现中应该从underlying asset获取decimals
     */
    function decimals() public view virtual override returns (uint8) {
        // 这里简化为6（USDT的decimals）
        // 实际应该调用 IERC20Metadata(underlyingAsset).decimals()
        return 6;
    }
}