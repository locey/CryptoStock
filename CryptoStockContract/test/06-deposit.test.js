// Test case for user deposit functionality
// Simple test to verify DefiAggregator + AaveAdapter deposit flow

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("06-deposit.test.js - User Deposit Test", function () {
    
    // 测试固定参数
    const INITIAL_USDC_SUPPLY = ethers.parseUnits("1000000", 6); // 1M USDC (6 decimals)
    const USER_DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6);    // 1000 USDC
    const FEE_RATE_BPS = 100; // 1% fee

    async function deployContractsFixture() {
        // 获取测试账户
        const [deployer, user] = await ethers.getSigners();

        // 1. 部署 MockUSDC
        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        const mockUSDC = await MockUSDC.deploy();
        
        // 2. 部署 MockAavePool
        const MockAavePool = await ethers.getContractFactory("MockAavePool");
        const mockAavePool = await MockAavePool.deploy();
        
        // 3. 部署 MockAToken
        const MockAToken = await ethers.getContractFactory("MockAToken");
        const mockAToken = await MockAToken.deploy(
            "Mock aUSDC",
            "aUSDC", 
            await mockUSDC.getAddress(),
            await mockAavePool.getAddress()
        );
        
        // 4. 初始化 Aave Pool 资产映射
        await mockAavePool.initReserve(await mockUSDC.getAddress(), await mockAToken.getAddress());
        
        // 5. 部署可升级的 DefiAggregator
        const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
        const defiAggregator = await upgrades.deployProxy(
            DefiAggregator,
            [FEE_RATE_BPS], // 初始化参数
            { 
                kind: 'uups',
                initializer: 'initialize'
            }
        );
        await defiAggregator.waitForDeployment();
        
        // 6. 部署可升级的 AaveAdapter
        const AaveAdapter = await ethers.getContractFactory("AaveAdapter");
        const aaveAdapter = await upgrades.deployProxy(
            AaveAdapter,
            [
                await mockAavePool.getAddress(),
                await mockUSDC.getAddress(),
                await mockAToken.getAddress(),
                deployer.address
            ], // 初始化参数
            { 
                kind: 'uups',
                initializer: 'initialize'
            }
        );
        await aaveAdapter.waitForDeployment();
        
        // 7. 在聚合器中注册适配器
        await defiAggregator.registerAdapter("aave", await aaveAdapter.getAddress());
        
        // 8. 给用户分配 USDC 用于测试
        await mockUSDC.mint(user.address, USER_DEPOSIT_AMOUNT * 2n); // 多给一些用于测试
        
        // 9. 给 Pool 一些 USDC 用于支付利息
        await mockUSDC.mint(await mockAavePool.getAddress(), INITIAL_USDC_SUPPLY);

        return {
            deployer,
            user,
            mockUSDC,
            mockAavePool,
            mockAToken,
            defiAggregator,
            aaveAdapter
        };
    }

    describe("User Deposit Flow", function () {
        
        it("Should successfully deposit USDC through DefiAggregator", async function () {
            const { user, mockUSDC, mockAToken, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // === 准备阶段 ===
            
            // 检查用户初始 USDC 余额
            const userInitialBalance = await mockUSDC.balanceOf(user.address);
            expect(userInitialBalance).to.equal(USER_DEPOSIT_AMOUNT * 2n);
            
            // 用户授权 AaveAdapter 使用 USDC
            await mockUSDC.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            // === 执行存款操作 ===
            
            // 构造操作参数
            const operationParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address, // 明确指定受益者为用户
                deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                extraData: "0x" // 无额外数据
            };
            
            // 执行存款操作
            const tx = await defiAggregator.connect(user).executeOperation(
                "aave",     // adapter name
                0,          // OperationType.DEPOSIT
                operationParams
            );
            
            // 等待交易确认
            await tx.wait();
            
            // === 验证结果 ===
            
            // 1. 检查用户 USDC 余额减少
            const userFinalBalance = await mockUSDC.balanceOf(user.address);
            expect(userFinalBalance).to.equal(userInitialBalance - USER_DEPOSIT_AMOUNT);
            
            // 2. 计算预期的净存款金额（扣除手续费）
            const expectedFee = USER_DEPOSIT_AMOUNT * BigInt(FEE_RATE_BPS) / 10000n;
            const expectedNetDeposit = USER_DEPOSIT_AMOUNT - expectedFee;
            
            // 3. 检查用户获得的 aToken 余额
            const userATokenBalance = await mockAToken.balanceOf(user.address);
            expect(userATokenBalance).to.equal(expectedNetDeposit);
            
            // 4. 检查适配器记录的用户余额
            const adapterRecordedBalance = await aaveAdapter.getUserBalances(user.address);
            expect(adapterRecordedBalance).to.equal(expectedNetDeposit);
            
            // 5. 验证收益查询功能
            const yieldInfo = await aaveAdapter.getUserYield(user.address);
            expect(yieldInfo.principal).to.equal(expectedNetDeposit);  // 本金
            expect(yieldInfo.currentValue).to.equal(expectedNetDeposit); // 当前价值（暂无收益）
            expect(yieldInfo.profit).to.equal(0n); // 收益为0
            expect(yieldInfo.isProfit).to.be.true; // 无亏损
            
            console.log("✅ 存款测试通过！");
            console.log(`💰 用户存款: ${ethers.formatUnits(USER_DEPOSIT_AMOUNT, 6)} USDC`);
            console.log(`💸 手续费: ${ethers.formatUnits(expectedFee, 6)} USDC`);
            console.log(`🏦 净存款: ${ethers.formatUnits(expectedNetDeposit, 6)} USDC`);
            console.log(`🪙 获得 aToken: ${ethers.formatUnits(userATokenBalance, 6)} aUSDC`);
        });

        it("Should reject deposit with insufficient allowance", async function () {
            const { user, mockUSDC, defiAggregator } = 
                await loadFixture(deployContractsFixture);
            
            // 不给授权，直接尝试存款
            const operationParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address, // 明确指定受益者
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            // 应该失败
            await expect(
                defiAggregator.connect(user).executeOperation(
                    "aave", 
                    0, // DEPOSIT
                    operationParams
                )
            ).to.be.reverted;
            
            console.log("✅ 授权不足时正确拒绝存款！");
        });

        it("Should reject deposit of zero amount", async function () {
            const { user, mockUSDC, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // 授权但尝试存款0
            await mockUSDC.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            const operationParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [0n], // 零金额
                recipient: user.address, // 明确指定受益者
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            // 应该失败
            await expect(
                defiAggregator.connect(user).executeOperation(
                    "aave", 
                    0, // DEPOSIT
                    operationParams
                )
            ).to.be.reverted;
            
            console.log("✅ 零金额存款时正确拒绝！");
        });
    });

    describe("User Withdraw Flow", function () {
        
        it("Should successfully withdraw USDC after deposit", async function () {
            const { user, mockUSDC, mockAToken, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // === 先进行存款操作 ===
            
            // 用户授权 AaveAdapter 使用 USDC
            await mockUSDC.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            // 执行存款
            const depositParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            await defiAggregator.connect(user).executeOperation(
                "aave", 
                0, // DEPOSIT
                depositParams
            );
            
            // 计算存款后的净金额
            const expectedFee = USER_DEPOSIT_AMOUNT * BigInt(FEE_RATE_BPS) / 10000n;
            const expectedNetDeposit = USER_DEPOSIT_AMOUNT - expectedFee;
            
            // 验证存款成功
            const balanceAfterDeposit = await aaveAdapter.getUserBalances(user.address);
            expect(balanceAfterDeposit).to.equal(expectedNetDeposit);
            
            // === 执行取款操作 ===
            
            // 部分取款金额
            const withdrawAmount = expectedNetDeposit / 2n; // 取一半
            
            // 构造取款参数
            const withdrawParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [withdrawAmount],
                recipient: user.address, // 取款到用户地址
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            // 记录取款前的 USDC 余额
            const usdcBalanceBeforeWithdraw = await mockUSDC.balanceOf(user.address);
            const aTokenBalanceBeforeWithdraw = await mockAToken.balanceOf(user.address);
            
            // 执行取款操作
            const withdrawTx = await defiAggregator.connect(user).executeOperation(
                "aave",
                1, // WITHDRAW
                withdrawParams
            );
            
            await withdrawTx.wait();
            
            // === 验证取款结果 ===
            
            // 1. 检查用户在适配器中的余额记录减少
            const balanceAfterWithdraw = await aaveAdapter.getUserBalances(user.address);
            expect(balanceAfterWithdraw).to.equal(expectedNetDeposit - withdrawAmount);
            
            // 2. 检查用户的 USDC 余额增加（考虑 MockAavePool 的利息）
            const usdcBalanceAfterWithdraw = await mockUSDC.balanceOf(user.address);
            expect(usdcBalanceAfterWithdraw).to.be.greaterThan(usdcBalanceBeforeWithdraw);
            
            // 3. 检查用户的 aToken 余额减少
            const aTokenBalanceAfterWithdraw = await mockAToken.balanceOf(user.address);
            expect(aTokenBalanceAfterWithdraw).to.be.lessThan(aTokenBalanceBeforeWithdraw);
            
            // 4. 验证收益查询功能
            const yieldInfoAfterWithdraw = await aaveAdapter.getUserYield(user.address);
            expect(yieldInfoAfterWithdraw.principal).to.equal(expectedNetDeposit - withdrawAmount);
            
            console.log("✅ 取款测试通过！");
            console.log(`💰 存款净额: ${ethers.formatUnits(expectedNetDeposit, 6)} USDC`);
            console.log(`💸 取款金额: ${ethers.formatUnits(withdrawAmount, 6)} USDC`);
            console.log(`🏦 剩余余额: ${ethers.formatUnits(balanceAfterWithdraw, 6)} USDC`);
            console.log(`📈 收到 USDC: ${ethers.formatUnits(usdcBalanceAfterWithdraw - usdcBalanceBeforeWithdraw, 6)} USDC (含利息)`);
        });

        it("Should reject withdraw with insufficient balance", async function () {
            const { user, mockUSDC, defiAggregator } = 
                await loadFixture(deployContractsFixture);
            
            // 尝试取款但没有存款
            const withdrawParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            // 应该失败
            await expect(
                defiAggregator.connect(user).executeOperation(
                    "aave",
                    1, // WITHDRAW
                    withdrawParams
                )
            ).to.be.revertedWith("Insufficient balance");
            
            console.log("✅ 余额不足时正确拒绝取款！");
        });

        it("Should reject withdraw of zero amount", async function () {
            const { user, mockUSDC, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // 先进行少量存款
            await mockUSDC.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            const depositParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            await defiAggregator.connect(user).executeOperation("aave", 0, depositParams);
            
            // 尝试取款0金额
            const withdrawParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [0n], // 零金额
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            // 应该失败
            await expect(
                defiAggregator.connect(user).executeOperation(
                    "aave",
                    1, // WITHDRAW
                    withdrawParams
                )
            ).to.be.reverted;
            
            console.log("✅ 零金额取款时正确拒绝！");
        });

        it("Should handle full withdrawal", async function () {
            const { user, mockUSDC, mockAToken, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // === 先进行存款 ===
            
            await mockUSDC.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            const depositParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            await defiAggregator.connect(user).executeOperation("aave", 0, depositParams);
            
            // 获取存款净额
            const netDeposit = await aaveAdapter.getUserBalances(user.address);
            
            // === 执行完全取款 ===
            
            const withdrawParams = {
                tokens: [await mockUSDC.getAddress()],
                amounts: [netDeposit], // 取出所有余额
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                extraData: "0x"
            };
            
            const usdcBalanceBefore = await mockUSDC.balanceOf(user.address);
            
            await defiAggregator.connect(user).executeOperation("aave", 1, withdrawParams);
            
            // === 验证完全取款结果 ===
            
            // 1. 用户在适配器中的余额应为0
            const finalBalance = await aaveAdapter.getUserBalances(user.address);
            expect(finalBalance).to.equal(0n);
            
            // 2. 用户收到了 USDC（包含利息）
            const usdcBalanceAfter = await mockUSDC.balanceOf(user.address);
            expect(usdcBalanceAfter).to.be.greaterThan(usdcBalanceBefore);
            
            // 3. 收益查询应显示无余额
            const yieldInfo = await aaveAdapter.getUserYield(user.address);
            expect(yieldInfo.principal).to.equal(0n);
            expect(yieldInfo.currentValue).to.equal(0n);
            expect(yieldInfo.profit).to.equal(0n);
            
            console.log("✅ 完全取款测试通过！");
            console.log(`💰 取出金额: ${ethers.formatUnits(netDeposit, 6)} USDC`);
            console.log(`📈 实际收到: ${ethers.formatUnits(usdcBalanceAfter - usdcBalanceBefore, 6)} USDC (含利息)`);
        });
    });
});

module.exports = {};