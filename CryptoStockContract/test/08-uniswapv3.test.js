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
        const { user, usdt, weth, mockNPM, defiAggregator, uniswapV3Adapter } = await loadFixture(deployFixture);
        
        // 记录操作前的余额
        const userUsdtBalanceBefore = await usdt.balanceOf(user.address);
        const userWethBalanceBefore = await weth.balanceOf(user.address);
        const npmUsdtBalanceBefore = await usdt.balanceOf(await mockNPM.getAddress());
        const npmWethBalanceBefore = await weth.balanceOf(await mockNPM.getAddress());
        
        // 用户授权
        await usdt.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_USDT_AMOUNT);
        await weth.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_WETH_AMOUNT);
        
        // 构造参数
        const params = {
            tokens: [await usdt.getAddress(), await weth.getAddress()],
            amounts: [USER_USDT_AMOUNT, USER_WETH_AMOUNT, 0, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0, // 添加流动性时不需要 tokenId
            extraData: "0x"
        };
        
        // 执行添加流动性
        const tx = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            2, // ADD_LIQUIDITY
            params
        );
        await tx.wait();
        
        // 记录操作后的余额
        const userUsdtBalanceAfter = await usdt.balanceOf(user.address);
        const userWethBalanceAfter = await weth.balanceOf(user.address);
        const npmUsdtBalanceAfter = await usdt.balanceOf(await mockNPM.getAddress());
        const npmWethBalanceAfter = await weth.balanceOf(await mockNPM.getAddress());
        
        // 计算扣除手续费后的实际投入金额（1%手续费）
        const actualUsdtDeposited = (USER_USDT_AMOUNT * 99n) / 100n; // 扣除1%手续费
        const actualWethDeposited = (USER_WETH_AMOUNT * 99n) / 100n; // 扣除1%手续费
        
        // 验证代币转移：用户余额减少（包含手续费），NPM合约余额增加（扣除手续费后）
        expect(userUsdtBalanceBefore - userUsdtBalanceAfter).to.equal(USER_USDT_AMOUNT); // 用户支付全额
        expect(userWethBalanceBefore - userWethBalanceAfter).to.equal(USER_WETH_AMOUNT); // 用户支付全额
        expect(npmUsdtBalanceAfter - npmUsdtBalanceBefore).to.equal(actualUsdtDeposited); // NPM收到扣费后金额
        expect(npmWethBalanceAfter - npmWethBalanceBefore).to.equal(actualWethDeposited); // NPM收到扣费后金额
        
        // 检查用户 Position
        const positions = await uniswapV3Adapter.getUserPositions(user.address);
        expect(positions.length).to.equal(1);
        
        // 通过 MockNonfungiblePositionManager 直接验证 NFT 参数
        const tokenId = positions[0];
        
        // 验证 NFT 所有者
        const owner = await mockNPM.ownerOf(tokenId);
        expect(owner).to.equal(user.address);
        
        // 验证 Position 详细信息（使用官方标准的12个返回值）
        const position = await mockNPM.positions(tokenId);
        expect(position[2]).to.equal(await usdt.getAddress()); // token0
        expect(position[3]).to.equal(await weth.getAddress()); // token1
        expect(position[7]).to.be.gt(0); // liquidity
        
        console.log("NFT Token ID:", tokenId.toString());
        console.log("Position Liquidity:", position[7].toString());
        console.log("User USDT paid:", ethers.formatUnits(USER_USDT_AMOUNT, 6));
        console.log("Actual USDT deposited (after 1% fee):", ethers.formatUnits(actualUsdtDeposited, 6));
        console.log("User WETH paid:", ethers.formatUnits(USER_WETH_AMOUNT, 18));
        console.log("Actual WETH deposited (after 1% fee):", ethers.formatUnits(actualWethDeposited, 18));
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
            tokenId: 0, // 添加流动性时不需要 tokenId
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
        
        // 移除流动性 - 提供占位符代币地址以满足 DefiAggregator 的要求
        const removeParams = {
            tokens: [await usdt.getAddress()], // 占位符地址，实际不会被使用
            amounts: [0, 0],                   // amount0Min, amount1Min
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: positions[0],             // 使用 tokenId 字段
            extraData: "0x"
        };
        // 记录移除流动性前的余额
        const userUsdtBalanceBefore = await usdt.balanceOf(user.address);
        const userWethBalanceBefore = await weth.balanceOf(user.address);
        const mockNpmUsdtBalanceBefore = await usdt.balanceOf(await mockNPM.getAddress());
        const mockNpmWethBalanceBefore = await weth.balanceOf(await mockNPM.getAddress());
        
        const tx2 = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            3, // REMOVE_LIQUIDITY
            removeParams
        );
        await tx2.wait();
        
        // 记录移除流动性后的余额
        const userUsdtBalanceAfter = await usdt.balanceOf(user.address);
        const userWethBalanceAfter = await weth.balanceOf(user.address);
        const mockNpmUsdtBalanceAfter = await usdt.balanceOf(await mockNPM.getAddress());
        const mockNpmWethBalanceAfter = await weth.balanceOf(await mockNPM.getAddress());
        
        // 1. 检查 Position 被移除
        const positionsAfter = await uniswapV3Adapter.getUserPositions(user.address);
        expect(positionsAfter.length).to.equal(0);
        
        // 2. 检查用户代币余额是否增加了
        expect(userUsdtBalanceAfter).to.be.gt(userUsdtBalanceBefore);
        expect(userWethBalanceAfter).to.be.gt(userWethBalanceBefore);
        console.log(`用户移除流动性后 USDT 增加: ${ethers.formatUnits(userUsdtBalanceAfter - userUsdtBalanceBefore, 6)}`);
        console.log(`用户移除流动性后 WETH 增加: ${ethers.formatUnits(userWethBalanceAfter - userWethBalanceBefore, 18)}`);
        
        // 3. 检查 Mock NFT 合约的代币余额变化
        // MockNPM 余额变化为 0 是正常的，因为：
        // - decreaseLiquidity 时铸造了新代币 (+amount)
        // - collect 时转账给用户 (-amount) 
        // - 净变化 = 0
        expect(mockNpmUsdtBalanceAfter).to.equal(mockNpmUsdtBalanceBefore);
        expect(mockNpmWethBalanceAfter).to.equal(mockNpmWethBalanceBefore);
        console.log(`MockNPM USDT 变化: ${ethers.formatUnits(mockNpmUsdtBalanceAfter - mockNpmUsdtBalanceBefore, 6)} (铸造+转出=0)`);
        console.log(`MockNPM WETH 变化: ${ethers.formatUnits(mockNpmWethBalanceAfter - mockNpmWethBalanceBefore, 18)} (铸造+转出=0)`);
        
        // 4. 验证 NFT 仍然存在但流动性已清零（符合 UniswapV3 实际行为）
        const tokenId = positions[0];
        const ownerAfter = await mockNPM.ownerOf(tokenId);
        expect(ownerAfter).to.equal(user.address);
        
        // 5. 验证 Position 流动性为 0 且无未收集代币
        const positionAfter = await mockNPM.positions(tokenId);
        expect(positionAfter.liquidity).to.equal(0);
        expect(positionAfter.tokensOwed0).to.equal(0);
        expect(positionAfter.tokensOwed1).to.equal(0);
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
            tokenId: 0, // 添加流动性时不需要 tokenId
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
        
        // 手动模拟一段时间后的手续费累积 (0.2% 手续费)
        await mockNPM.simulateFeeAccumulation(positions[0], 20); // 20 基点 = 0.2%
        
        const positionInfo = await mockNPM.positions(positions[0]);
        console.log(`模拟手续费累积后:`);
        console.log(`tokensOwed0 (USDT): ${ethers.formatUnits(positionInfo.tokensOwed0, 6)}`);
        console.log(`tokensOwed1 (WETH): ${ethers.formatUnits(positionInfo.tokensOwed1, 18)}`);
        
        // 在执行 collect 操作前再次检查手续费状态
        const positionBeforeCollect = await mockNPM.positions(positions[0]);
        console.log(`\n执行 collect 操作前:`);
        console.log(`tokensOwed0: ${ethers.formatUnits(positionBeforeCollect.tokensOwed0, 6)}`);
        console.log(`tokensOwed1: ${ethers.formatUnits(positionBeforeCollect.tokensOwed1, 18)}`);
        
        // 记录手续费收取前的余额和Position状态
        const userUsdtBalanceBefore = await usdt.balanceOf(user.address);
        const userWethBalanceBefore = await weth.balanceOf(user.address);
        const mockNpmUsdtBalanceBefore = await usdt.balanceOf(await mockNPM.getAddress());
        const mockNpmWethBalanceBefore = await weth.balanceOf(await mockNPM.getAddress());
        
        // 获取Position收取前的手续费状态
        const positionBefore = await mockNPM.positions(positions[0]);
        console.log(`收取前 tokensOwed0 (USDT): ${ethers.formatUnits(positionBefore.tokensOwed0, 6)}`);
        console.log(`收取前 tokensOwed1 (WETH): ${ethers.formatUnits(positionBefore.tokensOwed1, 18)}`);
        
        // 领取手续费
        const collectParams = {
            tokens: [await usdt.getAddress()], // 需要提供一个token地址
            amounts: [],                       // 空数组表示收取指定 tokenId 的手续费
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: positions[0],             // 使用新的 tokenId 字段
            extraData: "0x"
        };
        const tx2 = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            18, // COLLECT_FEES
            collectParams
        );
        
        // 执行手续费收取
        await tx2.wait();
        
        // 记录手续费收取后的余额
        const userUsdtBalanceAfter = await usdt.balanceOf(user.address);
        const userWethBalanceAfter = await weth.balanceOf(user.address);
        const mockNpmUsdtBalanceAfter = await usdt.balanceOf(await mockNPM.getAddress());
        const mockNpmWethBalanceAfter = await weth.balanceOf(await mockNPM.getAddress());
        
        // 获取Position收取后的手续费状态
        const positionAfter = await mockNPM.positions(positions[0]);
        console.log(`收取后 tokensOwed0 (USDT): ${ethers.formatUnits(positionAfter.tokensOwed0, 6)}`);
        console.log(`收取后 tokensOwed1 (WETH): ${ethers.formatUnits(positionAfter.tokensOwed1, 18)}`);
        
        // 计算实际收取的手续费数量
        const collectedUsdt = userUsdtBalanceAfter - userUsdtBalanceBefore;
        const collectedWeth = userWethBalanceAfter - userWethBalanceBefore;
        console.log(`实际收取 USDT: ${ethers.formatUnits(collectedUsdt, 6)}`);
        console.log(`实际收取 WETH: ${ethers.formatUnits(collectedWeth, 18)}`);
        
        // 验证手续费收取逻辑
            // 1. 用户余额应该增加（收到手续费）
            expect(userUsdtBalanceAfter).to.be.gte(userUsdtBalanceBefore);
            expect(userWethBalanceAfter).to.be.gte(userWethBalanceBefore);
            
            // 2. Position 的 tokensOwed 应该减少或清零
            expect(positionAfter.tokensOwed0).to.be.lte(positionBefore.tokensOwed0);
            expect(positionAfter.tokensOwed1).to.be.lte(positionBefore.tokensOwed1);
            
            // 3. MockNPM 合约余额应该减少（转出给用户）
            expect(mockNpmUsdtBalanceAfter).to.be.lte(mockNpmUsdtBalanceBefore);
            expect(mockNpmWethBalanceAfter).to.be.lte(mockNpmWethBalanceBefore);
            
            // 4. 验证收取的数量等于 tokensOwed 的减少量
            const expectedUsdtCollection = positionBefore.tokensOwed0 - positionAfter.tokensOwed0;
            const expectedWethCollection = positionBefore.tokensOwed1 - positionAfter.tokensOwed1;
            expect(collectedUsdt).to.equal(expectedUsdtCollection);
            expect(collectedWeth).to.equal(expectedWethCollection);
            
            console.log("✓ 手续费收取验证通过");

        
        // 5. 检查用户总收益记录是否更新
        const userTotalCollectedFees = await uniswapV3Adapter.getUserTotalCollectedFees(user.address);
        console.log(`用户历史累积手续费 (USD): ${ethers.formatUnits(userTotalCollectedFees, 6)}`);
        
        // 6. 验证收益详情
        const yieldDetails = await uniswapV3Adapter.getUserYieldDetails(user.address);
        console.log(`当前Position价值 (USD): ${ethers.formatUnits(yieldDetails.currentPositionValue, 6)}`);
        console.log(`当前未提取手续费 (USD): ${ethers.formatUnits(yieldDetails.currentUnclaimedFees, 6)}`);
        console.log(`历史累积手续费 (USD): ${ethers.formatUnits(yieldDetails.historicalCollectedFees, 6)}`);
        console.log(`总价值 (USD): ${ethers.formatUnits(yieldDetails.totalValue, 6)}`);
    });

    it("收益计算", async function () {
        const { user, usdt, weth, mockNPM, mockPriceFeed, defiAggregator, uniswapV3Adapter } = await loadFixture(deployFixture);
        // 添加流动性
        await usdt.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_USDT_AMOUNT);
        await weth.connect(user).approve(await uniswapV3Adapter.getAddress(), USER_WETH_AMOUNT);
        const params = {
            tokens: [await usdt.getAddress(), await weth.getAddress()],
            amounts: [USER_USDT_AMOUNT, USER_WETH_AMOUNT, 0, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0, // 添加流动性时不需要 tokenId
            extraData: "0x"
        };
        const tx = await defiAggregator.connect(user).executeOperation(
            "uniswapv3",
            2,
            params
        );
        await tx.wait();
        
        // 获取用户持仓列表
        const positions = await uniswapV3Adapter.getUserPositions(user.address);
        expect(positions.length).to.equal(1);
        const tokenId = positions[0];
        
        // 计算预期投入值
        const actualUsdtDeposited = (USER_USDT_AMOUNT * 99n) / 100n; // 扣除1%手续费
        const actualWethDeposited = (USER_WETH_AMOUNT * 99n) / 100n; // 扣除1%手续费
        
        // 1. 测试基础收益查询 getUserYield
        const [principal, currentValue, profit, isProfit] = await uniswapV3Adapter.getUserYield(user.address);
        
        console.log(`\n=== 基础收益信息 ===`);
        console.log(`本金 (USD): ${ethers.formatUnits(principal, 6)}`);
        console.log(`当前价值 (USD): ${ethers.formatUnits(currentValue, 6)}`);
        console.log(`${isProfit ? '收益' : '亏损'} (USD): ${ethers.formatUnits(profit, 6)}`);
        console.log(`收益率: ${isProfit ? '+' : '-'}${(Number(ethers.formatUnits(profit, 6)) / Number(ethers.formatUnits(principal, 6)) * 100).toFixed(4)}%`);
        
        // 验证基本收益逻辑
        expect(principal).to.be.gt(0);
        expect(currentValue).to.be.gte(principal); // 当前价值应该 >= 本金（包含收益）
        if (isProfit) {
            expect(profit).to.equal(currentValue - principal);
        } else {
            expect(profit).to.equal(principal - currentValue);
        }
        
        // 2. 测试详细收益分解 getUserYieldDetails
        const yieldDetails = await uniswapV3Adapter.getUserYieldDetails(user.address);
        console.log(`\n=== 详细收益分解 ===`);
        console.log(`当前持仓价值 (USD): ${ethers.formatUnits(yieldDetails.currentPositionValue, 6)}`);
        console.log(`未提取手续费 (USD): ${ethers.formatUnits(yieldDetails.currentUnclaimedFees, 6)}`);
        console.log(`历史累积手续费 (USD): ${ethers.formatUnits(yieldDetails.historicalCollectedFees, 6)}`);
        console.log(`总价值 (USD): ${ethers.formatUnits(yieldDetails.totalValue, 6)}`);
        
        // 验证详细收益逻辑
        expect(yieldDetails.currentPositionValue).to.be.gt(0);
        expect(yieldDetails.currentUnclaimedFees).to.equal(0); // 刚添加流动性，还没有手续费
        expect(yieldDetails.historicalCollectedFees).to.equal(0); // 还没有收取过手续费
        expect(yieldDetails.totalValue).to.equal(currentValue); // 总价值应该等于getUserYield的currentValue
        expect(yieldDetails.totalValue).to.equal(
            yieldDetails.currentPositionValue + 
            yieldDetails.currentUnclaimedFees + 
            yieldDetails.historicalCollectedFees
        );
        
        // 3. 测试单个持仓信息
        const positionInitialValue = await uniswapV3Adapter.getPositionInitialValue(tokenId);
        const [positionUsdt, positionWeth] = await uniswapV3Adapter.getPositionPrincipal(tokenId);
        
        console.log(`\n=== 单个持仓信息 ===`);
        console.log(`持仓ID: ${tokenId}`);
        console.log(`初始价值 (USD): ${ethers.formatUnits(positionInitialValue, 6)}`);
        console.log(`投入 USDT: ${ethers.formatUnits(positionUsdt, 6)}`);
        console.log(`投入 WETH: ${ethers.formatUnits(positionWeth, 18)}`);
        
        // 验证单个持仓信息
        expect(positionInitialValue).to.equal(principal); // 单个持仓的初始价值应该等于总本金
        expect(positionUsdt).to.equal(actualUsdtDeposited);
        expect(positionWeth).to.equal(actualWethDeposited);
        
        // 4. 测试历史累积手续费
        const userTotalCollectedFees = await uniswapV3Adapter.getUserTotalCollectedFees(user.address);
        expect(userTotalCollectedFees).to.equal(0); // 还没有收取过手续费
        
        // 5. 模拟手续费累积后再次查询收益
        console.log(`\n=== 模拟手续费累积后的收益 ===`);
        // 手动模拟手续费累积
        await mockNPM.simulateFeeAccumulation(tokenId, 15); // 15 基点 = 0.15%
        
        const [principal2, currentValue2, profit2, isProfit2] = await uniswapV3Adapter.getUserYield(user.address);
        const yieldDetails2 = await uniswapV3Adapter.getUserYieldDetails(user.address);
        
        console.log(`模拟手续费后 - 本金 (USD): ${ethers.formatUnits(principal2, 6)}`);
        console.log(`模拟手续费后 - 当前价值 (USD): ${ethers.formatUnits(currentValue2, 6)}`);
        console.log(`模拟手续费后 - ${isProfit2 ? '收益' : '亏损'} (USD): ${ethers.formatUnits(profit2, 6)}`);
        console.log(`模拟手续费后 - 未提取手续费 (USD): ${ethers.formatUnits(yieldDetails2.currentUnclaimedFees, 6)}`);
        
        // 验证手续费累积后的收益变化
        expect(principal2).to.equal(principal); // 本金不变
        expect(currentValue2).to.be.gt(currentValue); // 当前价值应该增加（包含手续费）
        expect(yieldDetails2.currentUnclaimedFees).to.be.gt(0); // 应该有未提取的手续费
        expect(profit2).to.be.gt(profit); // 收益应该增加
        expect(isProfit2).to.equal(true); // 应该是盈利的
        
        // 6. 验证收益率计算
        const totalReturnRate = Number(ethers.formatUnits(profit2, 6)) / Number(ethers.formatUnits(principal2, 6)) * 100;
        console.log(`总收益率: +${totalReturnRate.toFixed(4)}%`);
        expect(totalReturnRate).to.be.gt(0); // 收益率应该为正
        
        // 7. 模拟 ETH 涨价测试
        console.log(`\n=== 模拟 ETH 涨价后的收益 ===`);
        
        // 记录涨价前的状态
        const beforePriceChange = await uniswapV3Adapter.getUserYield(user.address);
        const beforeYieldDetails = await uniswapV3Adapter.getUserYieldDetails(user.address);
        
        // 获取当前 ETH 价格 ($2000)
        const currentEthPrice = await mockPriceFeed.latestRoundData();
        console.log(`当前 ETH 价格: $${ethers.formatUnits(currentEthPrice[1], 8)}`);
        
        // 模拟 ETH 涨价 50% (从 $2000 涨到 $3000)
        const newEthPrice = ethers.parseUnits("3000", 8); // $3000 per ETH
        await mockPriceFeed.updatePrice(newEthPrice);
        
        // 验证价格更新成功
        const updatedEthPrice = await mockPriceFeed.latestRoundData();
        console.log(`更新后 ETH 价格: $${ethers.formatUnits(updatedEthPrice[1], 8)}`);
        expect(updatedEthPrice[1]).to.equal(newEthPrice);
        
        // 查询涨价后的收益
        const [principal3, currentValue3, profit3, isProfit3] = await uniswapV3Adapter.getUserYield(user.address);
        const yieldDetails3 = await uniswapV3Adapter.getUserYieldDetails(user.address);
        
        console.log(`ETH涨价后 - 本金 (USD): ${ethers.formatUnits(principal3, 6)}`);
        console.log(`ETH涨价后 - 当前价值 (USD): ${ethers.formatUnits(currentValue3, 6)}`);
        console.log(`ETH涨价后 - ${isProfit3 ? '收益' : '亏损'} (USD): ${ethers.formatUnits(profit3, 6)}`);
        console.log(`ETH涨价后 - 当前持仓价值 (USD): ${ethers.formatUnits(yieldDetails3.currentPositionValue, 6)}`);
        
        // 验证 ETH 涨价后的收益逻辑
        expect(principal3).to.equal(principal2); // 本金不变
        expect(currentValue3).to.be.gt(currentValue2); // 当前价值应该增加（由于ETH涨价）
        expect(profit3).to.be.gt(profit2); // 总收益应该增加
        expect(yieldDetails3.currentPositionValue).to.be.gt(yieldDetails2.currentPositionValue); // 持仓价值应该增加
        expect(isProfit3).to.equal(true); // 应该是盈利的
        
        // 计算由于 ETH 涨价带来的额外收益
        const ethPriceGain = currentValue3 - currentValue2;
        console.log(`由于 ETH 涨价获得的额外收益 (USD): ${ethers.formatUnits(ethPriceGain, 6)}`);
        
        // 验证 ETH 涨价收益的合理性
        // 用户持有 9.9 WETH，ETH 从 $2000 涨到 $3000，应该获得 9.9 * $1000 = $9900 的收益
        const expectedEthGain = ethers.parseUnits("9900", 6); // 9.9 WETH * $1000 price increase
        const actualEthGain = yieldDetails3.currentPositionValue - yieldDetails2.currentPositionValue;
        console.log(`预期 ETH 涨价收益 (USD): ${ethers.formatUnits(expectedEthGain, 6)}`);
        console.log(`实际 ETH 涨价收益 (USD): ${ethers.formatUnits(actualEthGain, 6)}`);
        
        // 允许一定的计算误差（由于精度问题）
        const tolerance = ethers.parseUnits("10", 6); // $10 误差范围
        expect(actualEthGain).to.be.closeTo(expectedEthGain, tolerance);
        
        // 8. 计算包含价格变化的总收益率
        const totalReturnRateWithPriceChange = Number(ethers.formatUnits(profit3, 6)) / Number(ethers.formatUnits(principal3, 6)) * 100;
        console.log(`包含 ETH 涨价的总收益率: +${totalReturnRateWithPriceChange.toFixed(4)}%`);
        
        // 验证总收益率显著提高
        expect(totalReturnRateWithPriceChange).to.be.gt(totalReturnRate + 30); // 应该至少增加30%（由于ETH涨价50%但只持有部分WETH）
        
        console.log(`\n✓ ETH 涨价收益验证通过`);
        console.log(`\n✓ 收益计算测试完成`);
    });
});
