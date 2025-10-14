// Test case for Compound adapter functionality
// Test to verify DefiAggregator + CompoundAdapter deposit and withdraw flow

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("07-compound.test.js - Compound Adapter Test", function () {
    
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
        
        // 2. 部署 MockCToken (cUSDT)
        const MockCToken = await ethers.getContractFactory("MockCToken");
        const mockCToken = await MockCToken.deploy(
            "Mock cUSDT",
            "cUSDT", 
            await mockUSDT.getAddress(),
            ethers.parseUnits("0.02", 18) // 初始汇率 2%
        );
        
        // 3. 部署可升级的 DefiAggregator
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
        
        // 4. 部署可升级的 CompoundAdapter
        const CompoundAdapter = await ethers.getContractFactory("CompoundAdapter");
        const compoundAdapter = await upgrades.deployProxy(
            CompoundAdapter,
            [
                await mockCToken.getAddress(),
                await mockUSDT.getAddress(),
                deployer.address
            ], // 初始化参数
            { 
                kind: 'uups',
                initializer: 'initialize'
            }
        );
        await compoundAdapter.waitForDeployment();
        
        // 5. 在聚合器中注册适配器
        await defiAggregator.registerAdapter("compound", await compoundAdapter.getAddress());
        
        // 6. 给用户分配 USDT 用于测试
        await mockUSDT.mint(user.address, USER_DEPOSIT_AMOUNT * 2n); // 多给一些用于测试
        
        // 7. 给 cToken 一些 USDT 用于支付利息
        await mockUSDT.mint(await mockCToken.getAddress(), INITIAL_USDT_SUPPLY);

        return {
            deployer,
            user,
            mockUSDT,
            mockCToken,
            defiAggregator,
            compoundAdapter
        };
    }

    describe("Compound Adapter Deposit Flow", function () {
        
        it("Should successfully deposit USDT through Compound Adapter", async function () {
            const { user, mockUSDT, mockCToken, defiAggregator, compoundAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // === 准备阶段 ===
            
            // 检查用户初始 USDT 余额
            const userInitialBalance = await mockUSDT.balanceOf(user.address);
            expect(userInitialBalance).to.equal(USER_DEPOSIT_AMOUNT * 2n);
            
            // 用户授权 CompoundAdapter 使用 USDT
            await mockUSDT.connect(user).approve(
                await compoundAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            // === 执行存款操作 ===
            
            // 构造操作参数
            const operationParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address, // 明确指定受益者为用户
                deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                tokenId: 0, // Compound 不使用 NFT，设为 0
                extraData: "0x" // 无额外数据
            };
            
            // 执行存款操作
            const tx = await defiAggregator.connect(user).executeOperation(
                "compound",     // adapter name
                0,          // OperationType.DEPOSIT
                operationParams
            );
            
            // 等待交易确认
            await tx.wait();
            
            // === 验证结果 ===
            
            // 1. 检查用户 USDT 余额减少
            const userFinalBalance = await mockUSDT.balanceOf(user.address);
            const expectedNetDeposit = USER_DEPOSIT_AMOUNT - (USER_DEPOSIT_AMOUNT * BigInt(FEE_RATE_BPS) / 10000n);
            expect(userFinalBalance).to.equal(USER_DEPOSIT_AMOUNT * 2n - USER_DEPOSIT_AMOUNT);
            
            // 2. 验证用户收到 cToken
            const userCTokenBalance = await mockCToken.balanceOf(user.address);
            expect(userCTokenBalance).to.be.gt(0);
            console.log(`✅ 用户收到 cToken 数量: ${userCTokenBalance}`);
            
            // 3. 验证 cToken 实际对应的 USDT 价值
            const exchangeRate = await mockCToken.exchangeRateStored();
            const underlyingValue = userCTokenBalance * exchangeRate / ethers.parseUnits("1", 18);
            expect(underlyingValue).to.be.gte(expectedNetDeposit);
            console.log(`✅ cToken 对应价值: ${underlyingValue} USDT (预期: ${expectedNetDeposit})`);
            
            console.log("✅ Compound 存款流程测试通过！");
        });

        it("Should reject Compound deposit with insufficient allowance", async function () {
            const { user, mockUSDT, defiAggregator } = 
                await loadFixture(deployContractsFixture);
            
            // 不给授权，直接尝试存款
            const operationParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address, // 明确指定受益者
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0, // Compound 不使用 NFT，设为 0
                extraData: "0x"
            };
            
            // 应该失败
            await expect(
                defiAggregator.connect(user).executeOperation(
                    "compound", 
                    0, // DEPOSIT
                    operationParams
                )
            ).to.be.reverted;
            
            console.log("✅ 授权不足时正确拒绝存款！");
        });

        it("Should reject Compound deposit of zero amount", async function () {
            const { user, mockUSDT, defiAggregator, compoundAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // 授权但尝试存款0
            await mockUSDT.connect(user).approve(
                await compoundAdapter.getAddress(), 
                USER_DEPOSIT_AMOUNT
            );
            
            const operationParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [0n], // 零金额
                recipient: user.address, // 明确指定受益者
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0, // Compound 不使用 NFT，设为 0
                extraData: "0x"
            };
            
            // 应该失败
            await expect(
                defiAggregator.connect(user).executeOperation(
                    "compound", 
                    0, // DEPOSIT
                    operationParams
                )
            ).to.be.reverted;
            
            console.log("✅ 零金额存款时正确拒绝！");
        });
    });

    describe("Compound Adapter Withdraw Flow", function () {
        
        it("Should successfully withdraw USDT from Compound after deposit", async function () {
            const { user, mockUSDT, mockCToken, defiAggregator, compoundAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // 先进行存款以获得 cToken
            await mockUSDT.connect(user).approve(
                await compoundAdapter.getAddress(), 
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
            
            await defiAggregator.connect(user).executeOperation(
                "compound", 
                0, // DEPOSIT
                depositParams
            );
            
            // 获取存款后的状态
            const expectedNetDeposit = USER_DEPOSIT_AMOUNT - (USER_DEPOSIT_AMOUNT * BigInt(FEE_RATE_BPS) / 10000n);
            const balanceAfterDeposit = await mockUSDT.balanceOf(user.address);
            expect(balanceAfterDeposit).to.equal(USER_DEPOSIT_AMOUNT); // 用户剩余的 USDT (存款后)
            
            // === 执行取款操作 ===
            
            // 获取用户的 cToken 余额和汇率
            const userCTokenBalance = await mockCToken.balanceOf(user.address);
            const exchangeRate = await mockCToken.exchangeRateStored();
            
            // 计算可取款的 USDT 数量（取一半）
            const totalUSDTValue = userCTokenBalance * exchangeRate / ethers.parseUnits("1", 18);
            const withdrawUSDTAmount = totalUSDTValue / 2n; // 取一半的 USDT 价值
            
            // 用户需要授权 CompoundAdapter 使用 cToken
            await mockCToken.connect(user).approve(
                await compoundAdapter.getAddress(),
                userCTokenBalance // 授权所有 cToken，适配器会计算需要多少
            );
            
            // 构造取款参数（金额是想要取回的 USDT 数量）
            const withdrawParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [withdrawUSDTAmount], // 这里是要取回的 USDT 数量
                recipient: user.address, // 取款到用户地址
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            // 记录取款前的 USDT 余额
            const usdtBalanceBeforeWithdraw = await mockUSDT.balanceOf(user.address);
            const cTokenBalanceBeforeWithdraw = await mockCToken.balanceOf(user.address);
            
            // 执行取款操作
            const withdrawTx = await defiAggregator.connect(user).executeOperation(
                "compound", 
                1, // WITHDRAW
                withdrawParams
            );
            await withdrawTx.wait();
            
            // === 验证取款结果 ===
            
            // 1. 检查 USDT 余额增加
            const usdtBalanceAfterWithdraw = await mockUSDT.balanceOf(user.address);
            expect(usdtBalanceAfterWithdraw).to.be.gt(usdtBalanceBeforeWithdraw);
            
            // 2. 检查 cToken 余额减少
            const cTokenBalanceAfterWithdraw = await mockCToken.balanceOf(user.address);
            expect(cTokenBalanceAfterWithdraw).to.be.lt(cTokenBalanceBeforeWithdraw);
            
            // 3. 计算实际取回的 USDT 并验证金额
            const actualWithdrawn = usdtBalanceAfterWithdraw - usdtBalanceBeforeWithdraw;
            
            // 验证实际取回的金额应该接近请求的金额（允许小量误差）
            const expectedWithdrawn = withdrawUSDTAmount;
            const tolerance = expectedWithdrawn / 1000n; // 0.1% 容差
            expect(actualWithdrawn).to.be.gte(expectedWithdrawn - tolerance);
            expect(actualWithdrawn).to.be.lte(expectedWithdrawn + tolerance);
            
            console.log(`✅ 成功取回 USDT: ${actualWithdrawn} (预期: ${expectedWithdrawn})`);
            console.log(`✅ 剩余 cToken: ${cTokenBalanceAfterWithdraw}`);
            
            console.log("✅ Compound 取款流程测试通过！");
        });

        it("Should reject Compound withdraw with insufficient balance", async function () {
            const { user, mockUSDT, defiAggregator } = 
                await loadFixture(deployContractsFixture);
            
            // 尝试取款但没有余额
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
                    "compound", 
                    1, // WITHDRAW
                    withdrawParams
                )
            ).to.be.reverted;
            
            console.log("✅ 余额不足时正确拒绝取款！");
        });

        it("Should reject Compound withdraw of zero amount", async function () {
            const { user, mockUSDT, defiAggregator } = 
                await loadFixture(deployContractsFixture);
            
            // 尝试取款零金额
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
                    "compound", 
                    1, // WITHDRAW
                    withdrawParams
                )
            ).to.be.reverted;
            
            console.log("✅ 零金额取款时正确拒绝！");
        });

        it("Should handle full Compound withdrawal", async function () {
            const { user, mockUSDT, mockCToken, defiAggregator, compoundAdapter } = 
                await loadFixture(deployContractsFixture);
            
            // 用户授权并存款
            await mockUSDT.connect(user).approve(
                await compoundAdapter.getAddress(), 
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
            
            await defiAggregator.connect(user).executeOperation(
                "compound", 
                0, // DEPOSIT
                depositParams
            );
            
            // === 执行全额取款 ===
            
            // 获取用户的所有 cToken 余额和汇率
            const userCTokenBalance = await mockCToken.balanceOf(user.address);
            const exchangeRate = await mockCToken.exchangeRateStored();
            
            // 计算可取款的总 USDT 数量
            const totalUSDTValue = userCTokenBalance * exchangeRate / ethers.parseUnits("1", 18);
            
            // 用户需要授权 CompoundAdapter 使用所有 cToken
            await mockCToken.connect(user).approve(
                await compoundAdapter.getAddress(),
                userCTokenBalance
            );
            
            // 记录取款前状态
            const usdtBalanceBeforeWithdraw = await mockUSDT.balanceOf(user.address);
            
            // 构造全额取款参数（取出所有可用的 USDT）
            const fullWithdrawParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [totalUSDTValue], // 取出所有可用的 USDT
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            // 执行全额取款
            const fullWithdrawTx = await defiAggregator.connect(user).executeOperation(
                "compound", 
                1, // WITHDRAW
                fullWithdrawParams
            );
            await fullWithdrawTx.wait();
            
            // === 验证全额取款结果 ===
            
            // 1. 检查用户 cToken 余额应该很少或为0（允许精度误差）
            const finalCTokenBalance = await mockCToken.balanceOf(user.address);
            console.log(`✅ 取款前 cToken 余额: ${userCTokenBalance}`);
            console.log(`✅ 请求取款 USDT: ${totalUSDTValue}`);
            console.log(`✅ 取款后 cToken 余额: ${finalCTokenBalance}`);
            
            // 允许小量的精度误差（小于原余额的1%）
            expect(finalCTokenBalance).to.be.lt(userCTokenBalance / 100n);
            
            // 2. 检查用户收到 USDT
            const finalUSDTBalance = await mockUSDT.balanceOf(user.address);
            expect(finalUSDTBalance).to.be.gt(usdtBalanceBeforeWithdraw);
            
            const totalWithdrawn = finalUSDTBalance - usdtBalanceBeforeWithdraw;
            console.log(`✅ 全额取款完成，取回 USDT: ${totalWithdrawn}`);
            console.log(`✅ 最终 cToken 余额: ${finalCTokenBalance}`);
            
            console.log("✅ 全额取款测试通过！");
        });
    });
    

});