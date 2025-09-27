// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title INonfungiblePositionManager
 * @dev 自定义的 Uniswap V3 Position Manager 接口
 */
interface INonfungiblePositionManager is IERC721 {
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

    /**
     * @notice 创建新的流动性位置并铸造 NFT
     * @param params 铸造参数
     * @return tokenId 新铸造的 NFT token ID
     * @return liquidity 添加的流动性数量
     * @return amount0 实际使用的 token0 数量
     * @return amount1 实际使用的 token1 数量
     */
    function mint(MintParams calldata params)
        external
        payable
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    /**
     * @notice 增加现有位置的流动性
     * @param params 增加流动性参数
     * @return liquidity 增加的流动性数量
     * @return amount0 实际使用的 token0 数量
     * @return amount1 实际使用的 token1 数量
     */
    function increaseLiquidity(IncreaseLiquidityParams calldata params)
        external
        payable
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    /**
     * @notice 减少现有位置的流动性
     * @param params 减少流动性参数
     * @return amount0 减少的 token0 数量
     * @return amount1 减少的 token1 数量
     */
    function decreaseLiquidity(DecreaseLiquidityParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    /**
     * @notice 收集位置的手续费和代币
     * @param params 收集参数
     * @return amount0 收集的 token0 数量
     * @return amount1 收集的 token1 数量
     */
    function collect(CollectParams calldata params)
        external
        payable
        returns (uint256 amount0, uint256 amount1);

    /**
     * @notice 销毁 NFT（必须先移除所有流动性）
     * @param tokenId 要销毁的 token ID
     */
    function burn(uint256 tokenId) external payable;

    /**
     * @notice 获取位置信息
     * @param tokenId 位置的 token ID
     * @return nonce 随机数
     * @return operator 操作者地址
     * @return token0 token0 地址
     * @return token1 token1 地址
     * @return fee 手续费率
     * @return tickLower 下界 tick
     * @return tickUpper 上界 tick
     * @return liquidity 流动性数量
     * @return feeGrowthInside0LastX128 内部 fee growth 0
     * @return feeGrowthInside1LastX128 内部 fee growth 1
     * @return tokensOwed0 欠付的 token0
     * @return tokensOwed1 欠付的 token1
     */
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
        );
}