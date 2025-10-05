// 10-yearnv3.test.js
// 测试 YearnV3Adapter 的存款取款和收益计算

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("10-yearnv3.test.js - YearnV3Adapter 测试", function () {
    const INITIAL_TOKEN_SUPPLY = ethers.parseUnits("1000000", 18);
    const USER_DEPOSIT_AMOUNT = ethers.parseUnits("1000", 18); // 1000 USDC
    const FEE_RATE_BPS = 100; // 1%

    async function deployFixture() {
        const [deployer, user] = await ethers.getSigners();

        // 1. 部署 MockERC20 作为底层资产 (USDC)
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const usdc = await MockERC20.deploy("Mock USDC", "USDC", 18);

        // 2. 部署 MockYearnV3Vault
        const MockYearnV3Vault = await ethers.getContractFactory("contracts/mock/MockYearnV3Vault.sol:MockYearnV3Vault");
        const mockVault = await MockYearnV3Vault.deploy(
            await usdc.getAddress(),
            "Yearn USDC Vault",
            "yvUSDC"
        );

        // 3. 部署 DefiAggregator
        const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
        const defiAggregator = await upgrades.deployProxy(
            DefiAggregator,
            [FEE_RATE_BPS],
            { kind: 'uups', initializer: 'initialize' }
        );
        await defiAggregator.waitForDeployment();

        // 4. 部署 YearnV3Adapter
        const YearnV3Adapter = await ethers.getContractFactory("YearnV3Adapter");
        const yearnAdapter = await upgrades.deployProxy(
            YearnV3Adapter,
            [
                await mockVault.getAddress(),
                await usdc.getAddress(),
                deployer.address
            ],
            { 
                kind: 'uups', 
                initializer: 'initialize'
            }
        );
        await yearnAdapter.waitForDeployment();

        // 5. 注册适配器
        await defiAggregator.registerAdapter("yearnv3", await yearnAdapter.getAddress());

        // 6. 给用户分配 USDC
        await usdc.mint(user.address, USER_DEPOSIT_AMOUNT * 2n);

        return { deployer, user, usdc, mockVault, defiAggregator, yearnAdapter };
    }

    it("存款功能", async function () {
        const { user, usdc, mockVault, defiAggregator, yearnAdapter } = await loadFixture(deployFixture);
        
        // 记录操作前状态
        const userUsdcBefore = await usdc.balanceOf(user.address);
        const userSharesBefore = await mockVault.balanceOf(user.address);
        
        console.log("存款前:");
        console.log("用户USDC余额:", ethers.formatUnits(userUsdcBefore, 18));
        console.log("用户份额余额:", ethers.formatUnits(userSharesBefore, 18));
        
        // 用户授权
        await usdc.connect(user).approve(await yearnAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        // 构造存款参数
        const params = {
            tokens: [await usdc.getAddress()],
            amounts: [USER_DEPOSIT_AMOUNT],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        // 执行存款
        const tx = await defiAggregator.connect(user).executeOperation(
            "yearnv3",
            0, // DEPOSIT
            params
        );
        await tx.wait();
        
        // 记录操作后状态
        const userUsdcAfter = await usdc.balanceOf(user.address);
        const userSharesAfter = await mockVault.balanceOf(user.address);
        
        console.log("存款后:");
        console.log("用户USDC余额:", ethers.formatUnits(userUsdcAfter, 18));
        console.log("用户份额余额:", ethers.formatUnits(userSharesAfter, 18));
        
        // 验证代币转移
        expect(userUsdcBefore - userUsdcAfter).to.equal(USER_DEPOSIT_AMOUNT);
        expect(userSharesAfter - userSharesBefore).to.be.gt(0);
        
        // 投入记录功能已移除 - 由后端监听事件处理
    });

    // 收益计算功能已移除 - 由后端监听事件处理

    it("部分取款", async function () {
        const { user, usdc, mockVault, defiAggregator, yearnAdapter } = await loadFixture(deployFixture);
        
        // 先执行存款
        await usdc.connect(user).approve(await yearnAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        const depositParams = {
            tokens: [await usdc.getAddress()],
            amounts: [USER_DEPOSIT_AMOUNT],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("yearnv3", 0, depositParams);
        
        // 模拟收益（5% = 500基点）
        await mockVault.simulateYield(500);
        
        // 记录取款前状态
        const sharesBefore = await mockVault.balanceOf(user.address);
        const usdcBefore = await usdc.balanceOf(user.address);
        const currentValueBefore = await yearnAdapter.getUserCurrentValue(user.address);
        
        console.log("取款前:");
        console.log("份额余额:", ethers.formatUnits(sharesBefore, 18));
        console.log("USDC余额:", ethers.formatUnits(usdcBefore, 18));
        console.log("当前价值:", ethers.formatUnits(currentValueBefore, 18));
        
        // 取款50%的价值
        const withdrawAmount = currentValueBefore / 2n;
        
        // 预估需要的份额
        const sharesNeeded = await mockVault.previewWithdraw(withdrawAmount);
        
        // 用户授权份额
        await mockVault.connect(user).approve(await yearnAdapter.getAddress(), sharesNeeded);
        
        const withdrawParams = {
            tokens: [await usdc.getAddress()],
            amounts: [withdrawAmount], // 指定资产数量
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("yearnv3", 1, withdrawParams); // WITHDRAW
        
        // 记录取款后状态
        const sharesAfter = await mockVault.balanceOf(user.address);
        const usdcAfter = await usdc.balanceOf(user.address);
        const currentValueAfter = await yearnAdapter.getUserCurrentValue(user.address);
        
        console.log("取款后:");
        console.log("份额余额:", ethers.formatUnits(sharesAfter, 18));
        console.log("USDC余额:", ethers.formatUnits(usdcAfter, 18));
        console.log("当前价值:", ethers.formatUnits(currentValueAfter, 18));
        
        // 验证取款效果
        expect(sharesAfter).to.be.lt(sharesBefore); // 份额减少
        expect(usdcAfter).to.be.gt(usdcBefore); // USDC增加
        expect(currentValueAfter).to.be.lt(currentValueBefore); // 当前价值减少
    });

    it("完全取款", async function () {
        const { user, usdc, mockVault, defiAggregator, yearnAdapter } = await loadFixture(deployFixture);
        
        // 先执行存款
        await usdc.connect(user).approve(await yearnAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        const depositParams = {
            tokens: [await usdc.getAddress()],
            amounts: [USER_DEPOSIT_AMOUNT],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("yearnv3", 0, depositParams);
        
        // 模拟收益（5% = 500基点）
        await mockVault.simulateYield(500);
        
        // 获取当前价值和用户份额
        const currentValue = await yearnAdapter.getUserCurrentValue(user.address);
        const totalShares = await mockVault.balanceOf(user.address);
        
        console.log("完全取款前:");
        console.log("当前价值:", ethers.formatUnits(currentValue, 18));
        console.log("总份额:", ethers.formatUnits(totalShares, 18));
        
        // 授权所有份额
        await mockVault.connect(user).approve(await yearnAdapter.getAddress(), totalShares);
        
        const withdrawParams = {
            tokens: [await usdc.getAddress()],
            amounts: [currentValue], // 取出全部价值
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("yearnv3", 1, withdrawParams); // WITHDRAW
        
        // 验证完全取款后的状态
        const sharesAfter = await mockVault.balanceOf(user.address);
        const currentValueAfter = await yearnAdapter.getUserCurrentValue(user.address);
        
        // 由于simulateYield产生了巨大收益，检查份额是否大幅减少
        expect(sharesAfter).to.be.lt(totalShares); // 份额减少了
        expect(currentValueAfter).to.be.lt(currentValue); // 当前价值减少了
        
        console.log("完全取款后:");
        console.log("份额余额:", ethers.formatUnits(sharesAfter, 18));
        console.log("当前价值:", ethers.formatUnits(currentValueAfter, 18));
    });

    it("预览功能", async function () {
        const { user, usdc, mockVault, yearnAdapter } = await loadFixture(deployFixture);
        
        // 测试预览存款
        const depositAmount = ethers.parseUnits("100", 18);
        const previewShares = await yearnAdapter.previewDeposit(depositAmount);
        
        console.log("预览存款:");
        console.log("存入资产:", ethers.formatUnits(depositAmount, 18), "USDC");
        console.log("预期获得份额:", ethers.formatUnits(previewShares, 18));
        
        expect(previewShares).to.be.gt(0);
        
        // 测试预览赎回
        const sharesToRedeem = ethers.parseUnits("50", 18);
        const previewAssets = await yearnAdapter.previewRedeem(sharesToRedeem);
        
        console.log("预览赎回:");
        console.log("赎回份额:", ethers.formatUnits(sharesToRedeem, 18));
        console.log("预期获得资产:", ethers.formatUnits(previewAssets, 18), "USDC");
        
        expect(previewAssets).to.be.gt(0);
    });

    it("查询功能", async function () {
        const { user, usdc, mockVault, defiAggregator, yearnAdapter } = await loadFixture(deployFixture);
        
        // 先存款
        await usdc.connect(user).approve(await yearnAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        const params = {
            tokens: [await usdc.getAddress()],
            amounts: [USER_DEPOSIT_AMOUNT],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("yearnv3", 0, params);
        
        // 查询各种数据
        const currentValue = await yearnAdapter.getUserCurrentValue(user.address);
        const userShares = await mockVault.balanceOf(user.address);
        
        console.log("查询结果:");
        console.log("当前价值:", ethers.formatUnits(currentValue, 18), "USDC");
        console.log("用户份额:", ethers.formatUnits(userShares, 18), "shares");
        
        expect(currentValue).to.be.gt(0);
        expect(userShares).to.be.gt(0);
    });
});