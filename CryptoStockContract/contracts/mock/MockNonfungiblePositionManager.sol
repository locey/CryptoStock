// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./MockERC20.sol";

contract MockNonfungiblePositionManager is ERC721, ReentrancyGuard {
    
    struct Position {
        uint96 nonce;
        address operator;
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
        uint256 amount0Deposited;  // 实际存入的token0数量
        uint256 amount1Deposited;  // 实际存入的token1数量
    }
    
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }
    
    struct IncreaseLiquidityParams {
        uint256 tokenId;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    
    struct DecreaseLiquidityParams {
        uint256 tokenId;
        uint128 liquidity;
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }
    
    struct CollectParams {
        uint256 tokenId;
        address recipient;
        uint128 amount0Max;
        uint128 amount1Max;
    }
    
    // Position ID counter
    uint256 private _nextId = 1;
    
    // Position storage
    mapping(uint256 => Position) private _positions;
    
    // Mock yield rate (in basis points, 100 = 1%)
    uint256 public constant MOCK_YIELD_RATE = 50; // 0.5%
    
    // Events
    event IncreaseLiquidity(
        uint256 indexed tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    
    event DecreaseLiquidity(
        uint256 indexed tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
    
    event Collect(
        uint256 indexed tokenId,
        address recipient,
        uint256 amount0,
        uint256 amount1
    );
    
    constructor() ERC721("Mock Uniswap V3 Positions NFT-V1", "UNI-V3-POS") {}
    
    function mint(MintParams calldata params)
        external
        payable
        nonReentrant
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(block.timestamp <= params.deadline, "Transaction too old");
        require(params.token0 < params.token1, "Invalid token order");
        require(params.amount0Desired > 0 || params.amount1Desired > 0, "Invalid amounts");
        
        tokenId = _nextId++;
        
        // Mock liquidity calculation (简化版本)
        liquidity = uint128(
            (params.amount0Desired + params.amount1Desired) / 2
        );
        
        // For mock, use desired amounts as actual amounts
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        
        require(amount0 >= params.amount0Min, "Amount0 too low");
        require(amount1 >= params.amount1Min, "Amount1 too low");
        
        // Transfer tokens from user
        if (amount0 > 0) {
            IERC20(params.token0).transferFrom(msg.sender, address(this), amount0);
        }
        if (amount1 > 0) {
            IERC20(params.token1).transferFrom(msg.sender, address(this), amount1);
        }
        
        // Create position
        _positions[tokenId] = Position({
            nonce: 0,
            operator: address(0),
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            liquidity: liquidity,
            feeGrowthInside0LastX128: 0,
            feeGrowthInside1LastX128: 0,
            tokensOwed0: 0,
            tokensOwed1: 0,
            amount0Deposited: amount0,  // 记录实际投入的token0
            amount1Deposited: amount1   // 记录实际投入的token1
        });
        
        // Mint NFT to recipient
        _mint(params.recipient, tokenId);
        
        emit IncreaseLiquidity(tokenId, liquidity, amount0, amount1);
    }
    
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        nonReentrant
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(block.timestamp <= params.deadline, "Transaction too old");
        require(_ownerOf(params.tokenId) != address(0), "Invalid token ID");
        
        Position storage position = _positions[params.tokenId];
        
        // Mock liquidity calculation
        liquidity = uint128(
            (params.amount0Desired + params.amount1Desired) / 2
        );
        
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        
        require(amount0 >= params.amount0Min, "Amount0 too low");
        require(amount1 >= params.amount1Min, "Amount1 too low");
        
        // Transfer tokens from user
        if (amount0 > 0) {
            IERC20(position.token0).transferFrom(msg.sender, address(this), amount0);
        }
        if (amount1 > 0) {
            IERC20(position.token1).transferFrom(msg.sender, address(this), amount1);
        }
        
        // Update position
        position.liquidity += liquidity;
        position.amount0Deposited += amount0;  // 累加投入
        position.amount1Deposited += amount1;  // 累加投入
        
        emit IncreaseLiquidity(params.tokenId, liquidity, amount0, amount1);
    }
    
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        require(block.timestamp <= params.deadline, "Transaction too old");
        require(_ownerOf(params.tokenId) != address(0), "Invalid token ID");
        require(
            _isAuthorized(ownerOf(params.tokenId), msg.sender, params.tokenId),
            "Not approved"
        );
        
        Position storage position = _positions[params.tokenId];
        require(position.liquidity >= params.liquidity, "Insufficient liquidity");
        
        // 基于实际投入计算比例返回
        if (position.liquidity > 0) {
            uint256 proportion = (params.liquidity * 1e18) / position.liquidity;
            amount0 = (position.amount0Deposited * proportion) / 1e18;
            amount1 = (position.amount1Deposited * proportion) / 1e18;
            
            // 加上简单的固定收益 (0.5%)
            amount0 = amount0 + (amount0 * MOCK_YIELD_RATE) / 10000;
            amount1 = amount1 + (amount1 * MOCK_YIELD_RATE) / 10000;
        }
        
        require(amount0 >= params.amount0Min, "Amount0 too low");
        require(amount1 >= params.amount1Min, "Amount1 too low");
        
        // 为了模拟收益，先mint额外的代币到合约
        if (amount0 > 0) {
            MockERC20(position.token0).mint(address(this), amount0);
        }
        if (amount1 > 0) {
            MockERC20(position.token1).mint(address(this), amount1);
        }
        
        // Update position
        position.liquidity -= params.liquidity;
        position.tokensOwed0 += uint128(amount0);
        position.tokensOwed1 += uint128(amount1);
        
        // 按比例减少投入记录
        if (position.liquidity > 0) {
            uint256 proportion = (params.liquidity * 1e18) / (position.liquidity + params.liquidity);
            position.amount0Deposited -= (position.amount0Deposited * proportion) / 1e18;
            position.amount1Deposited -= (position.amount1Deposited * proportion) / 1e18;
        } else {
            // 如果流动性完全移除，清零投入记录
            position.amount0Deposited = 0;
            position.amount1Deposited = 0;
        }
        
        emit DecreaseLiquidity(params.tokenId, params.liquidity, amount0, amount1);
    }
    
    function collect(CollectParams calldata params)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        require(_ownerOf(params.tokenId) != address(0), "Invalid token ID");
        require(
            _isAuthorized(ownerOf(params.tokenId), msg.sender, params.tokenId),
            "Not approved"
        );
        
        Position storage position = _positions[params.tokenId];
        
        amount0 = position.tokensOwed0;
        amount1 = position.tokensOwed1;
        
        if (params.amount0Max < amount0) amount0 = params.amount0Max;
        if (params.amount1Max < amount1) amount1 = params.amount1Max;
        
        if (amount0 > 0) {
            position.tokensOwed0 -= uint128(amount0);
            IERC20(position.token0).transfer(params.recipient, amount0);
        }
        
        if (amount1 > 0) {
            position.tokensOwed1 -= uint128(amount1);
            IERC20(position.token1).transfer(params.recipient, amount1);
        }
        
        emit Collect(params.tokenId, params.recipient, amount0, amount1);
    }
    
    function burn(uint256 tokenId) external {
        require(_isAuthorized(ownerOf(tokenId), msg.sender, tokenId), "Not approved");
        
        Position storage position = _positions[tokenId];
        require(position.liquidity == 0, "Position not empty");
        require(position.tokensOwed0 == 0 && position.tokensOwed1 == 0, "Uncollected tokens");
        
        delete _positions[tokenId];
        _burn(tokenId);
    }
    
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        Position memory position = _positions[tokenId];
        return (
            position.nonce,
            position.operator,
            position.token0,
            position.token1,
            position.fee,
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            position.feeGrowthInside0LastX128,
            position.feeGrowthInside1LastX128,
            position.tokensOwed0,
            position.tokensOwed1
        );
    }
}