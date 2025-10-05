// 09-curve.test.js
// 测试 CurveAdapter 的添加流动性、移除流动性、收益计算

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("09-curve.test.js - CurveAdapter 测试", function () {
    const INITIAL_TOKEN_SUPPLY = ethers.parseUnits("1000000", 18);
    const USER_DEPOSIT_AMOUNT = ethers.parseUnits("1000", 18); // 每个代币投入1000
    const FEE_RATE_BPS = 100; // 1%

    async function deployFixture() {
        const [deployer, user] = await ethers.getSigners();

        // 1. 部署三个 MockERC20 代币 (USDC, USDT, DAI)
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdc = await MockERC20.deploy("Mock USDC", "USDC", 18);
        const usdt = await MockERC20.deploy("Mock USDT", "USDT", 18);
        const dai = await MockERC20.deploy("Mock DAI", "DAI", 18);

        // 2. 部署 MockCurve 3Pool
        const MockCurve = await ethers.getContractFactory("MockCurve");
        const mockCurve = await MockCurve.deploy(
            deployer.address, // owner
            [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()], // coins
            100, // A parameter
            4000000, // fee (0.04%)
            5000000000 // admin_fee (50% of fee)
        );

        // 3. 部署 DefiAggregator
        const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
        const defiAggregator = await upgrades.deployProxy(
            DefiAggregator,
            [FEE_RATE_BPS],
            { kind: 'uups', initializer: 'initialize' }
        );
        await defiAggregator.waitForDeployment();

        // 4. 部署 CurveAdapter
        const CurveAdapter = await ethers.getContractFactory("CurveAdapter");
        const curveAdapter = await upgrades.deployProxy(
            CurveAdapter,
            [deployer.address, await mockCurve.getAddress()],
            { 
                kind: 'uups', 
                initializer: 'initialize'
            }
        );
        await curveAdapter.waitForDeployment();

        // 5. 注册适配器
        await defiAggregator.registerAdapter("curve", await curveAdapter.getAddress());

        // 6. 给用户分配代币
        await usdc.mint(user.address, USER_DEPOSIT_AMOUNT * 2n);
        await usdt.mint(user.address, USER_DEPOSIT_AMOUNT * 2n);
        await dai.mint(user.address, USER_DEPOSIT_AMOUNT * 2n);

        // 7. 给 MockCurve 池子初始流动性 (模拟已有流动性)
        await usdc.mint(await mockCurve.getAddress(), INITIAL_TOKEN_SUPPLY);
        await usdt.mint(await mockCurve.getAddress(), INITIAL_TOKEN_SUPPLY);
        await dai.mint(await mockCurve.getAddress(), INITIAL_TOKEN_SUPPLY);

        return { deployer, user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter };
    }

    it("添加流动性", async function () {
        const { user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter } = await loadFixture(deployFixture);
        
        // 记录操作前的余额
        const userUsdcBefore = await usdc.balanceOf(user.address);
        const userUsdtBefore = await usdt.balanceOf(user.address);
        const userDaiBefore = await dai.balanceOf(user.address);
        const userLpBefore = await mockCurve.balanceOf(user.address);
        
        // 用户授权
        await usdc.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        await usdt.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        await dai.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        // 构造参数 [amount0, amount1, amount2, minLpTokens]
        const params = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [USER_DEPOSIT_AMOUNT, USER_DEPOSIT_AMOUNT, USER_DEPOSIT_AMOUNT, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        // 执行添加流动性
        const tx = await defiAggregator.connect(user).executeOperation(
            "curve",
            2, // ADD_LIQUIDITY
            params
        );
        await tx.wait();
        
        // 记录操作后的余额
        const userUsdcAfter = await usdc.balanceOf(user.address);
        const userUsdtAfter = await usdt.balanceOf(user.address);
        const userDaiAfter = await dai.balanceOf(user.address);
        const userLpAfter = await mockCurve.balanceOf(user.address);
        
        // 验证代币转移
        expect(userUsdcBefore - userUsdcAfter).to.equal(USER_DEPOSIT_AMOUNT);
        expect(userUsdtBefore - userUsdtAfter).to.equal(USER_DEPOSIT_AMOUNT);
        expect(userDaiBefore - userDaiAfter).to.equal(USER_DEPOSIT_AMOUNT);
        expect(userLpAfter - userLpBefore).to.be.gt(0); // 获得了LP代币
        
        console.log("添加流动性成功:");
        console.log("USDC投入:", ethers.formatUnits(USER_DEPOSIT_AMOUNT, 18));
        console.log("USDT投入:", ethers.formatUnits(USER_DEPOSIT_AMOUNT, 18));
        console.log("DAI投入:", ethers.formatUnits(USER_DEPOSIT_AMOUNT, 18));
        console.log("获得LP代币:", ethers.formatUnits(userLpAfter - userLpBefore, 18));
    });

    // 收益计算功能已移除 - 由后端监听事件处理

    it("部分移除流动性", async function () {
        const { user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter } = await loadFixture(deployFixture);
        
        // 先添加流动性
        await usdc.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        await usdt.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        await dai.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        const addParams = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [USER_DEPOSIT_AMOUNT, USER_DEPOSIT_AMOUNT, USER_DEPOSIT_AMOUNT, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("curve", 2, addParams);
        
        // 模拟池子产生收益
        await mockCurve.simulateYieldGrowth(user.address);
        
        // 记录移除前状态
        const lpBalanceBefore = await mockCurve.balanceOf(user.address);
        
        console.log("移除流动性前:");
        console.log("LP余额:", ethers.formatUnits(lpBalanceBefore, 18));
        
        // 移除50%的流动性
        const lpToRemove = lpBalanceBefore / 2n;
        await mockCurve.connect(user).approve(await curveAdapter.getAddress(), lpToRemove);
        
        const removeParams = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [lpToRemove, 0, 0, 0], // [lpTokens, minAmount0, minAmount1, minAmount2]
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("curve", 3, removeParams); // REMOVE_LIQUIDITY
        
        // 记录移除后状态
        const lpBalanceAfter = await mockCurve.balanceOf(user.address);
        
        console.log("移除流动性后:");
        console.log("LP余额:", ethers.formatUnits(lpBalanceAfter, 18));
        
        // 验证LP减少了大约50%
        expect(lpBalanceAfter).to.be.closeTo(lpBalanceBefore / 2n, ethers.parseUnits("0.01", 18));
    });

    it("完全移除流动性", async function () {
        const { user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter } = await loadFixture(deployFixture);
        
        // 先添加流动性
        await usdc.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        await usdt.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        await dai.connect(user).approve(await curveAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        const addParams = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [USER_DEPOSIT_AMOUNT, USER_DEPOSIT_AMOUNT, USER_DEPOSIT_AMOUNT, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("curve", 2, addParams);
        
        // 模拟收益
        await mockCurve.simulateYieldGrowth(user.address);
        
        // 移除全部流动性
        const lpBalance = await mockCurve.balanceOf(user.address);
        await mockCurve.connect(user).approve(await curveAdapter.getAddress(), lpBalance);
        
        const removeParams = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [lpBalance, 0, 0, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("curve", 3, removeParams);
        
        // 验证完全移除后的状态
        const lpBalanceAfter = await mockCurve.balanceOf(user.address);
        
        // LP应该为0
        expect(lpBalanceAfter).to.equal(0);
        
        console.log("完全移除流动性后:");
        console.log("LP余额:", ethers.formatUnits(lpBalanceAfter, 18));
    });
});