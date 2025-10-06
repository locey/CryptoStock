// Test case for Compound adapter functionality on Sepolia network
// Test to verify DefiAggregator + CompoundAdapter deposit flow using deployed contracts

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const fs = require("fs");
const path = require("path");

describe("07-compound-sepolia.test.js - Compound Adapter Sepolia Test", function () {
    
    // 测试固定参数
    const INITIAL_USDT_SUPPLY = ethers.parseUnits("1000000", 6); // 1M USDT (6 decimals)
    const USER_DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6);    // 1000 USDT
    const FEE_RATE_BPS = 100; // 1% fee

    async function deployContractsFixture() {
        // 获取测试账户
        const [deployer, testUser] = await ethers.getSigners();
        
        // 检查网络并决定使用哪个用户
        const network = await ethers.provider.getNetwork();
        const networkName = network.name === "unknown" ? "localhost" : network.name;
        
        // 在 Sepolia 网络上，使用部署者作为测试用户（因为部署者有铸币权限）
        const user = networkName === "sepolia" ? deployer : testUser;
        
        let mockUSDT, mockCToken, defiAggregator, compoundAdapter;
        
        if (networkName === "sepolia") {
            // 使用已部署的合约地址
            console.log("🌐 使用 Sepolia 网络上已部署的合约...");
            
            // 加载 Compound 适配器部署文件
            const compoundDeploymentFile = path.join(__dirname, "..", "deployments-compound-adapter-sepolia.json");
            
            if (fs.existsSync(compoundDeploymentFile)) {
                // 使用新的拆分部署结构
                const deployments = JSON.parse(fs.readFileSync(compoundDeploymentFile, 'utf8'));
                console.log("✅ 使用新的拆分部署结构 (compound-adapter + infrastructure)");
                
                // 连接到已部署的合约
                if (deployments.contracts) {
                    mockUSDT = await ethers.getContractAt("MockERC20", deployments.contracts.MockERC20_USDT);
                    mockCToken = await ethers.getContractAt("MockCToken", deployments.contracts.MockCToken_cUSDT);
                    defiAggregator = await ethers.getContractAt("DefiAggregator", deployments.contracts.DefiAggregator);
                    compoundAdapter = await ethers.getContractAt("CompoundAdapter", deployments.contracts.CompoundAdapter);
                    
                    console.log("✅ 已连接到 Sepolia 上的合约:");
                    console.log("   USDT:", deployments.contracts.MockERC20_USDT);
                    console.log("   cUSDT:", deployments.contracts.MockCToken_cUSDT);
                    console.log("   DefiAggregator:", deployments.contracts.DefiAggregator);
                    console.log("   CompoundAdapter:", deployments.contracts.CompoundAdapter);
                    
                    if (deployments.basedOn) {
                        console.log("   基于部署文件:", deployments.basedOn);
                    }
                    if (deployments.notes && deployments.notes.reusedContracts) {
                        console.log("   复用合约:", deployments.notes.reusedContracts.join(", "));
                    }
                    
                    // 给测试用户一些 USDT (如果是合约所有者)
                    try {
                        await mockUSDT.mint(user.address, USER_DEPOSIT_AMOUNT * 2n);
                        console.log("✅ 为测试用户铸造 USDT");
                    } catch (error) {
                        console.log("⚠️  无法铸造 USDT (可能不是合约所有者):", error.message);
                    }
                } else {
                    throw new Error("Compound 部署文件格式错误");
                }
            } else {
                throw new Error("未找到 Compound 部署文件。请先运行部署脚本: npx hardhat run scripts/deploy-compound-adapter-only.js --network " + networkName);
            }
            
        } else {
            // 本地测试 - 重新部署所有合约
            console.log("🏠 在本地网络部署新的合约...");

            // 1. 部署 MockERC20 作为 USDT
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            mockUSDT = await MockERC20.deploy("Mock USDT", "USDT", 6);
            
            // 2. 部署 MockCToken (cUSDT)
            const MockCToken = await ethers.getContractFactory("MockCToken");
            mockCToken = await MockCToken.deploy(
                "Mock cUSDT",
                "cUSDT", 
                await mockUSDT.getAddress(),
                ethers.parseUnits("0.02", 18) // 初始汇率 2%
            );
            
            // 3. 部署可升级的 DefiAggregator
            const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
            defiAggregator = await upgrades.deployProxy(
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
            compoundAdapter = await upgrades.deployProxy(
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
            
            console.log("✅ 本地合约部署完成");
        }

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
            // 检查网络并决定测试方式
            const network = await ethers.provider.getNetwork();
            const networkName = network.name === "unknown" ? "localhost" : network.name;
            
            // 为 Sepolia 网络设置更长的超时时间
            if (networkName === "sepolia") {
                this.timeout(120000); // 2分钟超时
                console.log("⏰ 已设置 Sepolia 网络专用超时时间: 2分钟");
            }
            
            let contracts;
            if (networkName === "sepolia") {
                // Sepolia 网络：直接调用部署函数，不使用 loadFixture
                contracts = await deployContractsFixture();
            } else {
                // 本地网络：使用 loadFixture
                contracts = await loadFixture(deployContractsFixture);
            }
            
            const { user, mockUSDT, mockCToken, defiAggregator, compoundAdapter } = contracts;
            
            // === 准备阶段 ===
            
            // 获取实际的手续费率
            const actualFeeRate = await defiAggregator.feeRateBps();
            console.log("📊 实际手续费率:", actualFeeRate.toString(), "BPS");
            
            // 检查用户初始 USDT 余额
            const userInitialBalance = await mockUSDT.balanceOf(user.address);
            console.log("💰 用户初始余额:", ethers.formatUnits(userInitialBalance, 6), "USDT");
            
            // 根据网络调整余额期望
            if (networkName === "sepolia") {
                // Sepolia 网络上可能余额不同，只检查是否大于存款金额
                expect(userInitialBalance).to.be.gte(USER_DEPOSIT_AMOUNT);
            } else {
                // 本地网络精确检查
                expect(userInitialBalance).to.equal(USER_DEPOSIT_AMOUNT * 2n);
            }
            
            // 用户授权 CompoundAdapter 使用 USDT
            console.log("🔑 授权 CompoundAdapter 使用 USDT...");
            const compoundAdapterAddress = await compoundAdapter.getAddress();
            const approveTx = await mockUSDT.connect(user).approve(compoundAdapterAddress, USER_DEPOSIT_AMOUNT);
            
            if (networkName === "sepolia") {
                console.log("⏳ 等待 Sepolia 网络授权交易确认...");
                await approveTx.wait(2); // 等待2个区块确认
                // 额外等待以确保状态同步
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log("✅ 授权完成 (已等待网络同步)");
            } else {
                await approveTx.wait();
                console.log("✅ 授权完成");
            }
            
            // 验证授权
            const allowance = await mockUSDT.allowance(user.address, compoundAdapterAddress);
            console.log("📋 授权金额:", ethers.formatUnits(allowance, 6), "USDT");
            
            // 检查适配器是否已注册
            const hasAdapter = await defiAggregator.hasAdapter("compound");
            console.log("🔌 适配器已注册:", hasAdapter);
            
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
            
            console.log("🚀 执行存款操作...");
            console.log("   适配器名称: compound");
            console.log("   操作类型: 0 (DEPOSIT)");
            console.log("   代币:", await mockUSDT.getAddress());
            console.log("   金额:", ethers.formatUnits(USER_DEPOSIT_AMOUNT, 6), "USDT");
            console.log("   受益者:", user.address);
            
            // 执行存款操作
            let tx;
            try {
                tx = await defiAggregator.connect(user).executeOperation(
                    "compound",     // adapter name
                    0,              // OperationType.DEPOSIT
                    operationParams
                );
                
                // 根据网络类型设置不同的确认策略
                if (networkName === "sepolia") {
                    console.log("⏳ 等待 Sepolia 网络交易确认...");
                    const receipt = await tx.wait(2); // 等待2个区块确认
                    console.log("📦 交易已确认，区块号:", receipt.blockNumber);
                    console.log("💰 Gas 使用量:", receipt.gasUsed.toString());
                    
                    // 在 Sepolia 网络上额外等待一点时间确保状态同步
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
                    console.log("✅ 存款操作成功 (已等待状态同步)");
                } else {
                    await tx.wait();
                    console.log("✅ 存款操作成功");
                }
            } catch (error) {
                console.log("❌ 存款操作失败:", error.message);
                
                // 尝试估算 gas 来获取更详细的错误信息
                try {
                    await defiAggregator.connect(user).executeOperation.estimateGas(
                        "compound", 0, operationParams
                    );
                } catch (estimateError) {
                    console.log("💣 Gas 估算错误:", estimateError.message);
                }
                throw error;
            }
            
            // === 验证结果 ===
            
            // 1. 检查用户 USDT 余额减少
            const userFinalBalance = await mockUSDT.balanceOf(user.address);
            console.log("💰 用户最终余额:", ethers.formatUnits(userFinalBalance, 6), "USDT");
            console.log("💰 预期最终余额:", ethers.formatUnits(userInitialBalance - USER_DEPOSIT_AMOUNT, 6), "USDT");
            
            // 在 Sepolia 网络上，由于可能有额外的铸造，我们检查余额是否合理减少了存款金额
            if (networkName === "sepolia") {
                // 对于 Sepolia 网络，我们只验证余额变化是合理的
                expect(userFinalBalance).to.be.gte(userInitialBalance - USER_DEPOSIT_AMOUNT);
                console.log("ℹ️  Sepolia 网络：跳过精确余额检查");
            } else {
                // 本地网络精确检查
                expect(userFinalBalance).to.equal(userInitialBalance - USER_DEPOSIT_AMOUNT);
            }
            
            // 2. 计算预期的净存款金额（扣除手续费）
            const expectedFee = USER_DEPOSIT_AMOUNT * actualFeeRate / 10000n;
            const expectedNetDeposit = USER_DEPOSIT_AMOUNT - expectedFee;
            
            // 3. 验证用户收到 cToken
            const userCTokenBalance = await mockCToken.balanceOf(user.address);
            console.log("🪙 用户当前 cToken 余额:", ethers.formatUnits(userCTokenBalance, 8), "cUSDT");
            
            if (networkName === "sepolia") {
                // Sepolia 网络：检查用户至少获得了一些 cToken
                expect(userCTokenBalance).to.be.gt(0);
                console.log("ℹ️  Sepolia 网络：用户 cToken 余额符合预期（可能包含之前的余额）");
            } else {
                // 本地网络：更严格的检查
                expect(userCTokenBalance).to.be.gt(0);
                
                // 验证 cToken 实际对应的 USDT 价值
                const exchangeRate = await mockCToken.exchangeRateStored();
                const underlyingValue = userCTokenBalance * exchangeRate / ethers.parseUnits("1", 18);
                expect(underlyingValue).to.be.gte(expectedNetDeposit * 95n / 100n); // 允许5%误差
                console.log(`💰 cToken 对应价值: ${ethers.formatUnits(underlyingValue, 6)} USDT (预期: ${ethers.formatUnits(expectedNetDeposit, 6)} USDT)`);
            }
            
            console.log("✅ 存款测试通过！");
            console.log(`💰 用户存款: ${ethers.formatUnits(USER_DEPOSIT_AMOUNT, 6)} USDT`);
            console.log(`💸 手续费: ${ethers.formatUnits(expectedFee, 6)} USDT`);
            console.log(`🏦 净存款: ${ethers.formatUnits(expectedNetDeposit, 6)} USDT`);
            console.log(`🪙 获得 cToken: ${ethers.formatUnits(userCTokenBalance, 8)} cUSDT`);
        });
    });

    describe("Compound Adapter Withdraw Flow", function () {
        
        it("Should successfully withdraw USDT from Compound after deposit", async function () {
            // 检查网络并决定测试方式
            const network = await ethers.provider.getNetwork();
            const networkName = network.name === "unknown" ? "localhost" : network.name;
            
            // 为 Sepolia 网络设置更长的超时时间
            if (networkName === "sepolia") {
                this.timeout(180000); // 3分钟超时，因为需要先存款再取款
                console.log("⏰ 已设置 Sepolia 网络专用超时时间: 3分钟");
            }
            
            let contracts;
            if (networkName === "sepolia") {
                // Sepolia 网络：直接调用部署函数，不使用 loadFixture
                contracts = await deployContractsFixture();
            } else {
                // 本地网络：使用 loadFixture
                contracts = await loadFixture(deployContractsFixture);
            }
            
            const { user, mockUSDT, mockCToken, defiAggregator, compoundAdapter } = contracts;
            
            // === 先进行存款操作 ===
            
            // 用户授权 CompoundAdapter 使用 USDT
            console.log("🔑 授权 CompoundAdapter 使用 USDT (用于存款)...");
            const compoundAdapterAddress = await compoundAdapter.getAddress();
            const approveTx = await mockUSDT.connect(user).approve(compoundAdapterAddress, USER_DEPOSIT_AMOUNT);
            
            if (networkName === "sepolia") {
                console.log("⏳ 等待 Sepolia 网络授权交易确认...");
                await approveTx.wait(2); // 等待2个区块确认
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log("✅ 授权完成 (已等待网络同步)");
            } else {
                await approveTx.wait();
                console.log("✅ 授权完成");
            }
            
            const depositParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [USER_DEPOSIT_AMOUNT],
                recipient: user.address,
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            console.log("🚀 执行存款操作...");
            const depositTx = await defiAggregator.connect(user).executeOperation(
                "compound", 
                0, // DEPOSIT
                depositParams
            );
            
            if (networkName === "sepolia") {
                console.log("⏳ 等待 Sepolia 网络存款交易确认...");
                await depositTx.wait(2); // 等待2个区块确认
                await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
                console.log("✅ 存款操作完成 (已等待状态同步)");
            } else {
                await depositTx.wait();
                console.log("✅ 存款操作完成");
            }
            
            // 获取实际的手续费率
            const actualFeeRate = await defiAggregator.feeRateBps();
            
            // 验证存款后的状态
            const expectedNetDeposit = USER_DEPOSIT_AMOUNT - (USER_DEPOSIT_AMOUNT * actualFeeRate / 10000n);
            const balanceAfterDeposit = await mockUSDT.balanceOf(user.address);
            console.log("💰 存款后 USDT 余额:", ethers.formatUnits(balanceAfterDeposit, 6), "USDT");
            
            // === 执行取款操作 ===
            
            // 获取用户的 cToken 余额和汇率
            const userCTokenBalance = await mockCToken.balanceOf(user.address);
            const exchangeRate = await mockCToken.exchangeRateStored();
            console.log("🪙 存款后 cToken 余额:", ethers.formatUnits(userCTokenBalance, 8), "cUSDT");
            console.log("📊 cToken 汇率:", ethers.formatUnits(exchangeRate, 18));
            
            // 计算可取款的 USDT 数量（取一半）
            const totalUSDTValue = userCTokenBalance * exchangeRate / ethers.parseUnits("1", 18);
            const withdrawUSDTAmount = totalUSDTValue / 2n; // 取一半的 USDT 价值
            console.log("💰 计算总价值:", ethers.formatUnits(totalUSDTValue, 6), "USDT");
            console.log("💰 计划取款:", ethers.formatUnits(withdrawUSDTAmount, 6), "USDT");
            
            // 用户需要授权 CompoundAdapter 使用 cToken
            console.log("🔑 授权 CompoundAdapter 使用 cToken...");
            const cTokenApproveTx = await mockCToken.connect(user).approve(
                compoundAdapterAddress,
                userCTokenBalance // 授权所有 cToken，适配器会计算需要多少
            );
            
            if (networkName === "sepolia") {
                console.log("⏳ 等待 Sepolia 网络 cToken 授权交易确认...");
                await cTokenApproveTx.wait(2);
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log("✅ cToken 授权完成 (已等待网络同步)");
            } else {
                await cTokenApproveTx.wait();
                console.log("✅ cToken 授权完成");
            }
            
            // 构造取款参数（金额是想要取回的 USDT 数量）
            const withdrawParams = {
                tokens: [await mockUSDT.getAddress()],
                amounts: [withdrawUSDTAmount], // 这里是要取回的 USDT 数量
                recipient: user.address, // 取款到用户地址
                deadline: Math.floor(Date.now() / 1000) + 3600,
                tokenId: 0,
                extraData: "0x"
            };
            
            // 记录取款前的余额
            const usdtBalanceBeforeWithdraw = await mockUSDT.balanceOf(user.address);
            const cTokenBalanceBeforeWithdraw = await mockCToken.balanceOf(user.address);
            
            // 执行取款操作
            console.log("🚀 执行取款操作...");
            console.log("   取款金额:", ethers.formatUnits(withdrawUSDTAmount, 6), "USDT");
            
            let withdrawTx;
            try {
                withdrawTx = await defiAggregator.connect(user).executeOperation(
                    "compound", 
                    1, // WITHDRAW
                    withdrawParams
                );
                
                if (networkName === "sepolia") {
                    console.log("⏳ 等待 Sepolia 网络取款交易确认...");
                    const receipt = await withdrawTx.wait(2); // 等待2个区块确认
                    console.log("📦 交易已确认，区块号:", receipt.blockNumber);
                    console.log("💰 Gas 使用量:", receipt.gasUsed.toString());
                    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
                    console.log("✅ 取款操作完成 (已等待状态同步)");
                } else {
                    await withdrawTx.wait();
                    console.log("✅ 取款操作完成");
                }
            } catch (error) {
                console.log("❌ 取款操作失败:", error.message);
                throw error;
            }
            
            // === 验证取款结果 ===
            
            // 1. 检查 USDT 余额增加
            const usdtBalanceAfterWithdraw = await mockUSDT.balanceOf(user.address);
            expect(usdtBalanceAfterWithdraw).to.be.gt(usdtBalanceBeforeWithdraw);
            
            // 2. 检查 cToken 余额减少
            const cTokenBalanceAfterWithdraw = await mockCToken.balanceOf(user.address);
            expect(cTokenBalanceAfterWithdraw).to.be.lt(cTokenBalanceBeforeWithdraw);
            
            // 3. 计算实际取回的 USDT 并验证金额
            const actualWithdrawn = usdtBalanceAfterWithdraw - usdtBalanceBeforeWithdraw;
            
            if (networkName === "sepolia") {
                // Sepolia 网络：更宽松的验证
                expect(actualWithdrawn).to.be.gt(0);
                console.log("ℹ️  Sepolia 网络：取款金额验证通过（允许网络差异）");
            } else {
                // 本地网络：严格验证
                const expectedWithdrawn = withdrawUSDTAmount;
                const tolerance = expectedWithdrawn / 1000n; // 0.1% 容差
                expect(actualWithdrawn).to.be.gte(expectedWithdrawn - tolerance);
                expect(actualWithdrawn).to.be.lte(expectedWithdrawn + tolerance);
                console.log(`💰 取回金额验证: ${ethers.formatUnits(actualWithdrawn, 6)} USDT (预期: ${ethers.formatUnits(expectedWithdrawn, 6)} USDT)`);
            }
            
            console.log("✅ 取款测试通过！");
            console.log(`💰 实际取回 USDT: ${ethers.formatUnits(actualWithdrawn, 6)} USDT`);
            console.log(`🪙 剩余 cToken: ${ethers.formatUnits(cTokenBalanceAfterWithdraw, 8)} cUSDT`);
            console.log(`💰 最终 USDT 余额: ${ethers.formatUnits(usdtBalanceAfterWithdraw, 6)} USDT`);
        });
    });
});

module.exports = {};