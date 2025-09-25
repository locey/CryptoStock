// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        // 铸造 100万个代币给部署者
        _mint(msg.sender, 1000000 * 10**decimals_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    // 用于测试的铸造函数
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // 用于测试的销毁函数
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}