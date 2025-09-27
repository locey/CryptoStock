// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Aave Pool Interface (V3)
interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

/// @title Aave aToken Interface
interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}