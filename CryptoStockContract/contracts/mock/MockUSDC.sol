// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals;
    
    constructor() ERC20("Mock USDC", "USDC") {
        _decimals = 6; // USDC has 6 decimals
        // Mint 1 million USDC for testing
        _mint(msg.sender, 1000000 * 10**_decimals);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens for testing
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens for testing
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}