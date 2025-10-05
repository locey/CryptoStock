// Test case for Aave adapter functionality
// Test to verify DefiAggregator + AaveAdapter deposit and withdraw flow

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("06-aave.test.js - Aave Adapter Test", function () {
    
    // 测试固定参数
    const INITIAL_USDT_SUPPLY = ethers.parseUnits("1000000", 6); // 1M USDT (6 decimals)
    const USER_DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6);    // 1000 USDT
    const FEE_RATE_BPS = 100; // 1% fee

    async function deployContractsFixture() {
        // 获取测试账户
        const [deployer, user] = await ethers.getSigners();

        // 1. 部署 MockERC20 作为 USDT
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 6);
        
        // 2. 部署 MockAavePool
        const MockAavePool = await ethers.getContractFactory("MockAavePool");
        const mockAavePool = await MockAavePool.deploy();
        
        // 3. 部署 MockAToken
        const MockAToken = await ethers.getContractFactory("MockAToken");
        const mockAToken = await MockAToken.deploy(
            "Mock aUSDT",
            "aUSDT", 
            await mockUSDT.getAddress(),
            await mockAavePool.getAddress()
        );
        
        // 4. 初始化 Aave Pool 资产映射
        await mockAavePool.initReserve(await mockUSDT.getAddress(), await mockAToken.getAddress());
        
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
                await mockUSDT.getAddress(),
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
        
        // 8. 给用户分配 USDT 用于测试
        await mockUSDT.mint(user.address, USER_DEPOSIT_AMOUNT * 2n); // 多给一些用于测试
        
        // 9. 给 Pool 一些 USDT 用于支付利息
        await mockUSDT.mint(await mockAavePool.getAddress(), INITIAL_USDT_SUPPLY);

        return {
            deployer,
            user,
            mockUSDT,
            mockAavePool,
            mockAToken,
            defiAggregator,
            aaveAdapter
        };
    }

    describe("Aave Adapter Deposit Flow", function () {
        
        it("Should successfully deposit USDT through Aave Adapter", async function () {
            const { user, mockUSDT, mockAToken, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // === 准备阶段 ===
            
            // 检查用户初始 USDT 余额
            const userInitialBalance = await mockUSDT.balanceOf(user.address);
            expect(userInitialBalance).to.equal(USER_DEPOSIT_AMOUNT * 2n);
            
            // 用户授权 AaveAdapter 使用 USDT
            await mockUSDT.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            // === 执行存款操作 ===
            
            // 构造操作参数
            const operationParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address, // 明确指定受益者为用户
                deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                tokenId: 0, // Aave 不使用 NFT，设为 0
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
            
            // 1. 检查用户 USDT 余额减少
            const userFinalBalance = await mockUSDT.balanceOf(user.address);
            expect(userFinalBalance).to.equal(userInitialBalance - USER_DEPOSIT_AMOUNT);
            
            // 2. 计算预期的净存款金额（扣除手续费）
            const expectedFee = USER_DEPOSIT_AMOUNT * BigInt(FEE_RATE_BPS) / 10000n;
            const expectedNetDeposit = USER_DEPOSIT_AMOUNT - expectedFee;
            
            // 3. 检查用户获得的 aToken 余额
            const userATokenBalance = await mockAToken.balanceOf(user.address);
            expect(userATokenBalance).to.equal(expectedNetDeposit);
            
            // 4. 通过 aToken 直接验证用户余额
            // (已在上面第3步验证过了，无需重复检查)
            
            console.log("✅ 存款测试通过！");
            console.log(`💰 用户存款: ${ethers.formatUnits(USER_DEPOSIT_AMOUNT, 6)} USDT`);
            console.log(`💸 手续费: ${ethers.formatUnits(expectedFee, 6)} USDT`);
            console.log(`🏦 净存款: ${ethers.formatUnits(expectedNetDeposit, 6)} USDT`);
            console.log(`🪙 获得 aToken: ${ethers.formatUnits(userATokenBalance, 6)} aUSDT`);
        });

        it("Should reject Aave deposit with insufficient allowance", async function () {
            const { user, mockUSDT, defiAggregator } = 
                await loadFixture(deployContractsFixture);
            
            // 不给授权，直接尝试存款
            const operationParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address, // 明确指定受益者
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0, // Aave 不使用 NFT，设为 0
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

        it("Should reject Aave deposit of zero amount", async function () {
            const { user, mockUSDT, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // 授权但尝试存款0
            await mockUSDT.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            const operationParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [0n], // 零金额
                recipient: user.address, // 明确指定受益者
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0, // Aave 不使用 NFT，设为 0
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

    describe("Aave Adapter Withdraw Flow", function () {
        
        it("Should successfully withdraw USDT from Aave after deposit", async function () {
            const { user, mockUSDT, mockAToken, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // === 先进行存款操作 ===
            
            // 用户授权 AaveAdapter 使用 USDT
            await mockUSDT.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            // 执行存款
            const depositParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
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
            
            // 验证存款成功 - 通过 aToken 余额检查
            const aTokenBalance = await mockAToken.balanceOf(user.address);
            expect(aTokenBalance).to.equal(expectedNetDeposit);
            
            // === 执行取款操作 ===
            
            // 部分取款金额
            const withdrawAmount = expectedNetDeposit / 2n; // 取一半
            
            // 构造取款参数
            const withdrawParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [withdrawAmount],
                recipient: user.address, // 取款到用户地址
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            // 记录取款前的 USDT 余额
            const usdtBalanceBeforeWithdraw = await mockUSDT.balanceOf(user.address);
            const aTokenBalanceBeforeWithdraw = await mockAToken.balanceOf(user.address);
            
            // 执行取款操作
            const withdrawTx = await defiAggregator.connect(user).executeOperation(
                "aave",
                1, // WITHDRAW
                withdrawParams
            );
            
            await withdrawTx.wait();
            
            // === 验证取款结果 ===
            
            // 1. 检查用户的 aToken 余额减少了相应数量
            const aTokenBalanceAfter = await mockAToken.balanceOf(user.address);
            expect(aTokenBalanceAfter).to.equal(expectedNetDeposit - withdrawAmount);
            
            // 2. 检查用户的 USDT 余额增加（考虑 MockAavePool 的利息）
            const usdtBalanceAfterWithdraw = await mockUSDT.balanceOf(user.address);
            expect(usdtBalanceAfterWithdraw).to.be.greaterThan(usdtBalanceBeforeWithdraw);
            
            // 3. 检查用户的 aToken 余额减少
            const aTokenBalanceAfterWithdraw = await mockAToken.balanceOf(user.address);
            expect(aTokenBalanceAfterWithdraw).to.be.lessThan(aTokenBalanceBeforeWithdraw);
            

            
            console.log("✅ 取款测试通过！");
            console.log(`💰 存款净额: ${ethers.formatUnits(expectedNetDeposit, 6)} USDT`);
            console.log(`💸 取款金额: ${ethers.formatUnits(withdrawAmount, 6)} USDT`);
            console.log(`🏦 剩余 aToken: ${ethers.formatUnits(aTokenBalanceAfter, 6)} aUSDT`);
            console.log(`📈 收到 USDT: ${ethers.formatUnits(usdtBalanceAfterWithdraw - usdtBalanceBeforeWithdraw, 6)} USDT (含利息)`);
        });

        it("Should reject Aave withdraw with insufficient balance", async function () {
            const { user, mockUSDT, defiAggregator } = 
                await loadFixture(deployContractsFixture);
            
            // 尝试取款但没有存款
            const withdrawParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            // 应该失败
            await expect(
                defiAggregator.connect(user).executeOperation(
                    "aave",
                    1, // WITHDRAW
                    withdrawParams
                )
            ).to.be.revertedWith("Insufficient aToken balance");
            
            console.log("✅ 余额不足时正确拒绝取款！");
        });

        it("Should reject Aave withdraw of zero amount", async function () {
            const { user, mockUSDT, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // 先进行少量存款
            await mockUSDT.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            const depositParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            await defiAggregator.connect(user).executeOperation("aave", 0, depositParams);
            
            // 尝试取款0金额
            const withdrawParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [0n], // 零金额
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
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

        it("Should handle full Aave withdrawal", async function () {
            const { user, mockUSDT, mockAToken, defiAggregator, aaveAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // === 先进行存款 ===
            
            await mockUSDT.connect(user).approve(
                await aaveAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            const depositParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            await defiAggregator.connect(user).executeOperation("aave", 0, depositParams);
            
            // 获取存款净额 - 通过 aToken 余额
            const netDeposit = await mockAToken.balanceOf(user.address);
            
            // === 执行完全取款 ===
            
            const withdrawParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [netDeposit], // 取出所有余额
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            const usdtBalanceBefore = await mockUSDT.balanceOf(user.address);
            
            await defiAggregator.connect(user).executeOperation("aave", 1, withdrawParams);
            
            // === 验证完全取款结果 ===
            
            // 1. 用户的 aToken 余额应为0
            const finalATokenBalance = await mockAToken.balanceOf(user.address);
            expect(finalATokenBalance).to.equal(0n);
            
            // 2. 用户收到了 USDT（包含利息）
            const usdtBalanceAfter = await mockUSDT.balanceOf(user.address);
            expect(usdtBalanceAfter).to.be.greaterThan(usdtBalanceBefore);
            

            
            console.log("✅ 完全取款测试通过！");
            console.log(`💰 取出金额: ${ethers.formatUnits(netDeposit, 6)} USDT`);
            console.log(`📈 实际收到: ${ethers.formatUnits(usdtBalanceAfter - usdtBalanceBefore, 6)} USDT (含利息)`);
        });
    });
});

module.exports = {};