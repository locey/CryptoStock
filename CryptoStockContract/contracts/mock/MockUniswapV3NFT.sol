// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MockUniswapV3Pool is ReentrancyGuard {
    
    struct Position {
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    // position key => position info
    mapping(bytes32 => Position) public positions;
    
    // Global state
    uint128 public liquidity;
    uint160 public sqrtPriceX96;
    int24 public tick;
    
    // Events
    event Mint(
        address sender,
        address indexed owner,
        int24 indexed tickLower,
        int24 indexed tickUpper,
        uint128 amount,
        uint256 amount0,
        uint256 amount1
    );

    event Burn(
        address indexed owner,
        int24 indexed tickLower,
        int24 indexed tickUpper,
        uint128 amount,
        uint256 amount0,
        uint256 amount1
    );

    modifier lock() {
        _;
    }

    constructor() {
        // 初始化一些默认值
        sqrtPriceX96 = 79228162514264337593543950336; // 价格为1时的sqrtPriceX96
        tick = 0;
        liquidity = 0;
    }

    /// @notice Adds liquidity for the given recipient/tickLower/tickUpper position
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata data
    ) external lock returns (uint256 amount0, uint256 amount1) {
        require(amount > 0, "Amount must be greater than 0");
        require(tickLower < tickUpper, "tickLower must be less than tickUpper");
        require(recipient != address(0), "Invalid recipient");
        
        bytes32 positionKey = keccak256(abi.encodePacked(recipient, tickLower, tickUpper));
        Position storage position = positions[positionKey];
        
        // 简化实现：固定返回值
        amount0 = uint256(amount) * 100; // 写死的amount0
        amount1 = uint256(amount) * 200; // 写死的amount1
        
        // 更新position
        position.liquidity += amount;
        
        // 更新全局流动性
        liquidity += amount;
        
        emit Mint(msg.sender, recipient, tickLower, tickUpper, amount, amount0, amount1);
        
        // 这里通常会有callback调用，简化处理
        if (data.length > 0) {
            // 简化：什么都不做
        }
    }

    /// @notice Burn liquidity from the sender and account tokens owed for the liquidity to the position
    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external lock returns (uint256 amount0, uint256 amount1) {
        require(amount > 0, "Amount must be greater than 0");
        require(tickLower < tickUpper, "tickLower must be less than tickUpper");
        
        bytes32 positionKey = keccak256(abi.encodePacked(msg.sender, tickLower, tickUpper));
        Position storage position = positions[positionKey];
        
        require(position.liquidity >= amount, "Insufficient liquidity");
        
        // 简化实现：固定返回值
        amount0 = uint256(amount) * 150; // 写死的amount0
        amount1 = uint256(amount) * 250; // 写死的amount1
        
        // 更新position
        position.liquidity -= amount;
        position.tokensOwed0 += uint128(amount0);
        position.tokensOwed1 += uint128(amount1);
        
        // 更新全局流动性
        liquidity -= amount;
        
        emit Burn(msg.sender, tickLower, tickUpper, amount, amount0, amount1);
    }

    /// @notice Get position info for a given position key
    function getPosition(bytes32 key) external view returns (
        uint128 _liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    ) {
        Position memory position = positions[key];
        return (
            position.liquidity,
            position.feeGrowthInside0LastX128,
            position.feeGrowthInside1LastX128,
            position.tokensOwed0,
            position.tokensOwed1
        );
    }

    /// @notice Helper function to generate position key
    function getPositionKey(address owner, int24 tickLower, int24 tickUpper) 
        external pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, tickLower, tickUpper));
    }
}
