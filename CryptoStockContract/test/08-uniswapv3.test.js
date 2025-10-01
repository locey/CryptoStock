// 08-uniswapv3.test.js
// 测试 UniswapV3Adapter 的添加流动性、移除流动性、领取奖励、收益计算

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("08-uniswapv3.test.js - UniswapV3Adapter 测试", function () {
    const INITIAL_USDT_SUPPLY = ethers.parseUnits("1000000", 6);
    const INITIAL_WETH_SUPPLY = ethers.parseUnits("1000", 18);
    const USER_USDT_AMOUNT = ethers.parseUnits("10000", 6);
    const USER_WETH_AMOUNT = ethers.parseUnits("10", 18);
    const FEE_RATE_BPS = 100; // 1%

    async function deployFixture() {
        const [deployer, user] = await ethers.getSigners();

        // 1. 部署 MockERC20 USDT/WETH
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdt = await MockERC20.deploy("Mock USDT", "USDT", 6);
        const weth = await MockERC20.deploy("Mock WETH", "WETH", 18);

        // 2. 部署 MockNonfungiblePositionManager
        const MockNPM = await ethers.getContractFactory("MockNonfungiblePositionManager");
        const mockNPM = await MockNPM.deploy();

        // 3. 部署简单的 MockAggregatorV3Interface (ETH/USD 预言机)
        const MockAggregator = await ethers.getContractFactory("MockAggregatorV3");
        const mockPriceFeed = await MockAggregator.deploy(
            "ETH/USD",
            8, // decimals
            ethers.parseUnits("2000", 8) // $2000 per ETH
        );

        // 4. 部署 DefiAggregator
        const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
        const defiAggregator = await upgrades.deployProxy(
            DefiAggregator,
            [FEE_RATE_BPS],
            { kind: 'uups', initializer: 'initialize' }
        );
        await defiAggregator.waitForDeployment();

        // 5. 部署 UniswapV3Adapter (增加gas限制)
        const UniswapV3Adapter = await ethers.getContractFactory("UniswapV3Adapter");
        const uniswapV3Adapter = await upgrades.deployProxy(
            UniswapV3Adapter,
            [
                await mockNPM.getAddress(),
                await usdt.getAddress(),
                await weth.getAddress(),
                await mockPriceFeed.getAddress(),
                deployer.address
            ],
            { 
                kind: 'uups', 
                initializer: 'initialize',
                gasLimit: 10000000 // 增加gas限制
            }
        );
        await uniswapV3Adapter.waitForDeployment();

        // 6. 注册适配器
        await defiAggregator.registerAdapter("uniswapv3", await uniswapV3Adapter.getAddress());

                // 7. 给用户分配 USDT/WETH
        await usdt.mint(user.address, USER_USDT_AMOUNT);
        await weth.mint(user.address, USER_WETH_AMOUNT);

        // 8. 不再需要给 MockNonfungiblePositionManager 额外代币
        // 因为现在基于实际投入计算，会自动计算固定收益

        return { deployer, user, usdt, weth, mockNPM, mockPriceFeed, defiAggregator, uniswapV3Adapter };
    }

    it("添加流动性", async function () {
        const { user, usdt, weth, defiAggregator, uniswapV3Adapter } = await loadFixture(deployFixture);
        // 用户授权
        await usdt.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_USDT_AMOUNT);
        await weth.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_WETH_AMOUNT);
        // 构造参数
        const params = {
            tokens: [await usdt.getAddress(), await weth.getAddress()],
            amounts: [USER_USDT_AMOUNT, USER_WETH_AMOUNT, 0, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            extraData: "0x"
        };
        // 执行添加流动性
        const tx = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            2, // ADD_LIQUIDITY
            params
        );
        await tx.wait();
        // 检查用户 Position
        const positions = await uniswapV3Adapter.getUserPositions(user.address);
        expect(positions.length).to.equal(1);
    });

    it("移除流动性", async function () {
        const { user, usdt, weth, mockNPM, defiAggregator, uniswapV3Adapter } = await loadFixture(deployFixture);
        // 先添加流动性
        await usdt.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_USDT_AMOUNT);
        await weth.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_WETH_AMOUNT);
        const params = {
            tokens: [await usdt.getAddress(), await weth.getAddress()],
            amounts: [USER_USDT_AMOUNT, USER_WETH_AMOUNT, 0, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            extraData: "0x"
        };
        const tx = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            2,
            params
        );
        await tx.wait();
        const positions = await uniswapV3Adapter.getUserPositions(user.address);
        
        // 用户需要授权 UniswapV3Adapter 操作其 NFT
        await mockNPM.connect(user).approve(await uniswapV3Adapter.getAddress(), positions[0]);
        
        // 移除流动性
        const removeParams = {
            tokens: [await usdt.getAddress()], // 需要一个token地址
            amounts: [positions[0], 0, 0],     // tokenId, amount0Min, amount1Min
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            extraData: "0x"
        };
        const tx2 = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            3, // REMOVE_LIQUIDITY
            removeParams
        );
        await tx2.wait();
        // 检查 Position 被移除
        const positionsAfter = await uniswapV3Adapter.getUserPositions(user.address);
        expect(positionsAfter.length).to.equal(0);
    });

    it("领取奖励（手续费）", async function () {
        const { user, usdt, weth, mockNPM, defiAggregator, uniswapV3Adapter } = await loadFixture(deployFixture);
        // 添加流动性
        await usdt.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_USDT_AMOUNT);
        await weth.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_WETH_AMOUNT);
        const params = {
            tokens: [await usdt.getAddress(), await weth.getAddress()],
            amounts: [USER_USDT_AMOUNT, USER_WETH_AMOUNT, 0, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            extraData: "0x"
        };
        const tx = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            2,
            params
        );
        await tx.wait();
        const positions = await uniswapV3Adapter.getUserPositions(user.address);
        
        // 用户需要授权 UniswapV3Adapter 操作其 NFT
        await mockNPM.connect(user).approve(await uniswapV3Adapter.getAddress(), positions[0]);
        
        // 领取手续费
        const collectParams = {
            tokens: [await usdt.getAddress()], // 需要提供一个token地址
            amounts: [positions[0]],           // tokenId
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            extraData: "0x"
        };
        const tx2 = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            18, // COLLECT_FEES
            collectParams
        );
        await tx2.wait();
        // 检查手续费领取事件和余额变化（略）
    });

    it("收益计算", async function () {
        const { user, usdt, weth, defiAggregator, uniswapV3Adapter } = await loadFixture(deployFixture);
        // 添加流动性
        await usdt.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_USDT_AMOUNT);
        await weth.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_WETH_AMOUNT);
        const params = {
            tokens: [await usdt.getAddress(), await weth.getAddress()],
            amounts: [USER_USDT_AMOUNT, USER_WETH_AMOUNT, 0, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            extraData: "0x"
        };
        const tx = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            2,
            params
        );
        await tx.wait();
        // 查询收益
        const [principal, currentValue, profit, isProfit] = await uniswapV3Adapter.getUserYield(user.address);
        expect(principal).to.be.gt(0);
        expect(currentValue).to.be.gte(principal);
        // 可以进一步断言 profit 和 isProfit
    });
});
