// 09-curve-sepolia.test.js


const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("09-curve-sepolia.test.js - CurveAdapter Sepolia 测试", function () {
    const INITIAL_TOKEN_SUPPLY = ethers.parseUnits("1000000", 18);
    const USER_DEPOSIT_AMOUNT = ethers.parseUnits("1000", 18);
    const FEE_RATE_BPS = 100;

    async function deployFixture() {
        const [deployer, user] = await ethers.getSigners();
        
        // 读取已部署的合约地址
        const fs = require("fs");
        const path = require("path");
        
        const curveDeploymentFile = path.join(__dirname, "..", "deployments-curve-adapter-sepolia.json");
        
        if (!fs.existsSync(curveDeploymentFile)) {
            throw new Error("未找到 Curve 部署文件。请先运行部署脚本: npx hardhat run scripts/deploy-curve-adapter-only.js --network sepolia");
        }
        
        const deployments = JSON.parse(fs.readFileSync(curveDeploymentFile, 'utf8'));
        console.log("✅ 使用已部署的 Sepolia 合约");
        
        // 连接到已部署的合约
        const usdc = await ethers.getContractAt("MockERC20", deployments.contracts.MockERC20_USDC);
        const usdt = await ethers.getContractAt("MockERC20", deployments.contracts.MockERC20_USDT);
        const dai = await ethers.getContractAt("MockERC20", deployments.contracts.MockERC20_DAI);
        const mockCurve = await ethers.getContractAt("MockCurve", deployments.contracts.MockCurve);
        const defiAggregator = await ethers.getContractAt("DefiAggregator", deployments.contracts.DefiAggregator);
        const curveAdapter = await ethers.getContractAt("CurveAdapter", deployments.contracts.CurveAdapter);
        
        console.log("✅ 已连接到 Sepolia 上的合约:");
        console.log("   USDC:", deployments.contracts.MockERC20_USDC);
        console.log("   USDT:", deployments.contracts.MockERC20_USDT);
        console.log("   DAI:", deployments.contracts.MockERC20_DAI);
        console.log("   MockCurve:", deployments.contracts.MockCurve);
        console.log("   DefiAggregator:", deployments.contracts.DefiAggregator);
        console.log("   CurveAdapter:", deployments.contracts.CurveAdapter);
        
        // 获取代币精度信息
        const usdcDecimals = await usdc.decimals();
        const usdtDecimals = await usdt.decimals();
        const daiDecimals = await dai.decimals();
        
        console.log("📋 代币精度信息:");
        console.log("   USDC:", usdcDecimals, "位精度");
        console.log("   USDT:", usdtDecimals, "位精度");
        console.log("   DAI:", daiDecimals, "位精度");
        
        // 检查用户当前余额
        const currentUsdcBalance = await usdc.balanceOf(user.address);
        const currentUsdtBalance = await usdt.balanceOf(user.address);
        const currentDaiBalance = await dai.balanceOf(user.address);
        const currentLpBalance = await mockCurve.balanceOf(user.address);
        
        console.log("💰 用户当前余额:");
        console.log("   USDC:", ethers.formatUnits(currentUsdcBalance, usdcDecimals));
        console.log("   USDT:", ethers.formatUnits(currentUsdtBalance, usdtDecimals));
        console.log("   DAI:", ethers.formatUnits(currentDaiBalance, daiDecimals));
        console.log("   LP:", ethers.formatUnits(currentLpBalance, 18));

        return { deployer, user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter };
    }

    it("添加流动性 (Sepolia)", async function () {
        // 设置更长的超时时间用于 Sepolia 网络
        this.timeout(300000); // 5 分钟超时
        
        const { user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter } = await deployFixture();
        
        // 获取代币精度信息
        const usdcDecimals = await usdc.decimals();
        const usdtDecimals = await usdt.decimals();
        const daiDecimals = await dai.decimals();
        
        console.log("📋 代币精度信息:");
        console.log("   USDC:", usdcDecimals, "位精度");
        console.log("   USDT:", usdtDecimals, "位精度");
        console.log("   DAI:", daiDecimals, "位精度");
        
        // 根据实际精度设置投入数量
        const USDC_AMOUNT = ethers.parseUnits("1000", usdcDecimals);
        const USDT_AMOUNT = ethers.parseUnits("1000", usdtDecimals);
        const DAI_AMOUNT = ethers.parseUnits("1000", daiDecimals);
        
        // 记录操作前的余额
        const userUsdcBefore = await usdc.balanceOf(user.address);
        const userUsdtBefore = await usdt.balanceOf(user.address);
        const userDaiBefore = await dai.balanceOf(user.address);
        const userLpBefore = await mockCurve.balanceOf(user.address);
        
        console.log("💰 操作前余额:");
        console.log("   USDC:", ethers.formatUnits(userUsdcBefore, usdcDecimals));
        console.log("   USDT:", ethers.formatUnits(userUsdtBefore, usdtDecimals));
        console.log("   DAI:", ethers.formatUnits(userDaiBefore, daiDecimals));
        console.log("   LP:", ethers.formatUnits(userLpBefore, 18));
        
        // 用户授权 - 根据合约架构，需要授权给 CurveAdapter
        console.log("🔐 设置代币授权给 CurveAdapter...");
        console.log("   授权目标: CurveAdapter =", await curveAdapter.getAddress());
        
        console.log("🔄 授权 USDC...");
        const approveTxUsdc = await usdc.connect(user).approve(await curveAdapter.getAddress(), USDC_AMOUNT);
        await approveTxUsdc.wait(1); // 减少等待时间到1个区块
        console.log("✅ USDC 授权完成");
        
        console.log("🔄 授权 USDT...");
        const approveTxUsdt = await usdt.connect(user).approve(await curveAdapter.getAddress(), USDT_AMOUNT);
        await approveTxUsdt.wait(1); // 减少等待时间到1个区块
        console.log("✅ USDT 授权完成");
        
        console.log("🔄 授权 DAI...");
        const approveTxDai = await dai.connect(user).approve(await curveAdapter.getAddress(), DAI_AMOUNT);
        await approveTxDai.wait(1); // 减少等待时间到1个区块
        console.log("✅ DAI 授权完成");
        
        // 减少等待时间
        console.log("⏳ 等待授权生效...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // 减少到 2 秒
        
        // 验证授权
        const usdcAllowance = await usdc.allowance(user.address, await curveAdapter.getAddress());
        const usdtAllowance = await usdt.allowance(user.address, await curveAdapter.getAddress());
        const daiAllowance = await dai.allowance(user.address, await curveAdapter.getAddress());
        
        console.log("🔍 验证授权结果:");
        console.log("   USDC 授权:", ethers.formatUnits(usdcAllowance, usdcDecimals));
        console.log("   USDT 授权:", ethers.formatUnits(usdtAllowance, usdtDecimals));
        console.log("   DAI 授权:", ethers.formatUnits(daiAllowance, daiDecimals));
        
        // 验证授权是否足够
        if (usdcAllowance < USDC_AMOUNT) {
            throw new Error(`USDC 授权不足: 需要 ${ethers.formatUnits(USDC_AMOUNT, usdcDecimals)}, 实际 ${ethers.formatUnits(usdcAllowance, usdcDecimals)}`);
        }
        if (usdtAllowance < USDT_AMOUNT) {
            throw new Error(`USDT 授权不足: 需要 ${ethers.formatUnits(USDT_AMOUNT, usdtDecimals)}, 实际 ${ethers.formatUnits(usdtAllowance, usdtDecimals)}`);
        }
        if (daiAllowance < DAI_AMOUNT) {
            throw new Error(`DAI 授权不足: 需要 ${ethers.formatUnits(DAI_AMOUNT, daiDecimals)}, 实际 ${ethers.formatUnits(daiAllowance, daiDecimals)}`);
        }
        
        console.log("✅ 所有授权验证通过");
        
        // 构造参数 [amount0, amount1, amount2, minLpTokens] - 使用各代币的实际精度
        const params = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [USDC_AMOUNT, USDT_AMOUNT, DAI_AMOUNT, 0],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        console.log("🔄 执行添加流动性操作...");
        
        // 执行添加流动性
        const tx = await defiAggregator.connect(user).executeOperation(
            "curve",
            2, // ADD_LIQUIDITY
            params
        );
        
        console.log("📋 交易已提交，哈希:", tx.hash);
        
        // 等待交易确认 - Sepolia网络需要更多确认时间
        console.log("⏳ 等待交易确认...");
        const receipt = await tx.wait(1); // 先等待1个区块
        console.log("✅ 交易确认成功，区块:", receipt.blockNumber);
        console.log("⛽ Gas 使用量:", receipt.gasUsed.toString());
        
        // 简短等待以确保状态同步
        console.log("⏳ 等待状态同步...");
        await new Promise(resolve => setTimeout(resolve, 3000)); // 减少到 3 秒
        
        // 记录操作后的余额
        const userUsdcAfter = await usdc.balanceOf(user.address);
        const userUsdtAfter = await usdt.balanceOf(user.address);
        const userDaiAfter = await dai.balanceOf(user.address);
        const userLpAfter = await mockCurve.balanceOf(user.address);
        
        console.log("💰 操作后余额:");
        console.log("   USDC:", ethers.formatUnits(userUsdcAfter, usdcDecimals));
        console.log("   USDT:", ethers.formatUnits(userUsdtAfter, usdtDecimals));
        console.log("   DAI:", ethers.formatUnits(userDaiAfter, daiDecimals));
        console.log("   LP:", ethers.formatUnits(userLpAfter, 18));
        
        // 验证代币转移 - 使用精确的数量进行验证
        console.log("🔍 详细余额分析:");
        console.log("   预期 USDC 减少:", ethers.formatUnits(USDC_AMOUNT, usdcDecimals));
        console.log("   实际 USDC 变化:", ethers.formatUnits(userUsdcBefore - userUsdcAfter, usdcDecimals));
        console.log("   USDC Before:", ethers.formatUnits(userUsdcBefore, usdcDecimals));
        console.log("   USDC After:", ethers.formatUnits(userUsdcAfter, usdcDecimals));
        
        // 检查是否用户余额增加了而不是减少了
        if (userUsdcAfter > userUsdcBefore) {
            console.log("❌ 异常：用户 USDC 余额增加了！这不应该发生。");
            console.log("   可能的原因：MockCurve 合约向用户发送了代币而不是接收代币");
        }
        
        expect(userUsdcBefore - userUsdcAfter).to.equal(USDC_AMOUNT);
        expect(userUsdtBefore - userUsdtAfter).to.equal(USDT_AMOUNT);
        expect(userDaiBefore - userDaiAfter).to.equal(DAI_AMOUNT);
        expect(userLpAfter - userLpBefore).to.be.gt(0); // 获得了LP代币
        
        console.log("✅ 添加流动性成功:");
        console.log("   USDC投入:", ethers.formatUnits(USDC_AMOUNT, usdcDecimals), "USDC");
        console.log("   USDT投入:", ethers.formatUnits(USDT_AMOUNT, usdtDecimals), "USDT");
        console.log("   DAI投入:", ethers.formatUnits(DAI_AMOUNT, daiDecimals), "DAI");
        console.log("   获得LP代币:", ethers.formatUnits(userLpAfter - userLpBefore, 18));
    });

    // 收益计算功能已移除 - 由后端监听事件处理

    it("部分移除流动性 (Sepolia)", async function () {
        // 设置超时时间
        this.timeout(300000); // 5 分钟超时
        
        const { user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter } = await deployFixture();
        
        // 检查用户当前LP余额（用户刚才已经添加过流动性）
        const currentLpBalance = await mockCurve.balanceOf(user.address);
        console.log("💰 用户当前LP余额:", ethers.formatUnits(currentLpBalance, 18));
        
        if (currentLpBalance === 0n) {
            throw new Error("用户没有LP代币！请先运行'添加流动性'测试。");
        }
        
        // 模拟池子产生收益
        console.log("🔄 模拟池子产生收益...");
        await mockCurve.simulateYieldGrowth(user.address);
        
        // 记录移除前状态
        const lpBalanceBefore = await mockCurve.balanceOf(user.address);
        const userUsdcBefore = await usdc.balanceOf(user.address);
        const userUsdtBefore = await usdt.balanceOf(user.address);
        const userDaiBefore = await dai.balanceOf(user.address);
        
        console.log("📊 移除流动性前状态:");
        console.log("   LP余额:", ethers.formatUnits(lpBalanceBefore, 18));
        console.log("   USDC余额:", ethers.formatUnits(userUsdcBefore, 6));
        console.log("   USDT余额:", ethers.formatUnits(userUsdtBefore, 6));
        console.log("   DAI余额:", ethers.formatUnits(userDaiBefore, 18));
        
        // 移除50%的流动性
        const lpToRemove = lpBalanceBefore / 2n;
        console.log("🔄 准备移除LP代币:", ethers.formatUnits(lpToRemove, 18));
        
        // 授权LP代币给适配器
        console.log("🔐 授权LP代币给CurveAdapter...");
        const approveTx = await mockCurve.connect(user).approve(await curveAdapter.getAddress(), lpToRemove);
        await approveTx.wait(1);
        console.log("✅ LP代币授权完成");
        
        const removeParams = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [lpToRemove, 0, 0, 0], // [lpTokens, minAmount0, minAmount1, minAmount2]
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        console.log("🔄 执行移除流动性操作...");
        const removeTx = await defiAggregator.connect(user).executeOperation("curve", 3, removeParams); // REMOVE_LIQUIDITY
        console.log("📋 移除流动性交易已提交，哈希:", removeTx.hash);
        
        // 等待交易确认
        const receipt = await removeTx.wait(1);
        console.log("✅ 交易确认成功，区块:", receipt.blockNumber);
        console.log("⛽ Gas 使用量:", receipt.gasUsed.toString());
        
        // 等待状态同步
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 记录移除后状态
        const lpBalanceAfter = await mockCurve.balanceOf(user.address);
        const userUsdcAfter = await usdc.balanceOf(user.address);
        const userUsdtAfter = await usdt.balanceOf(user.address);
        const userDaiAfter = await dai.balanceOf(user.address);
        
        console.log("📊 移除流动性后状态:");
        console.log("   LP余额:", ethers.formatUnits(lpBalanceAfter, 18));
        console.log("   USDC余额:", ethers.formatUnits(userUsdcAfter, 6));
        console.log("   USDT余额:", ethers.formatUnits(userUsdtAfter, 6));
        console.log("   DAI余额:", ethers.formatUnits(userDaiAfter, 18));
        
        console.log("📈 收益情况:");
        console.log("   USDC获得:", ethers.formatUnits(userUsdcAfter - userUsdcBefore, 6));
        console.log("   USDT获得:", ethers.formatUnits(userUsdtAfter - userUsdtBefore, 6));
        console.log("   DAI获得:", ethers.formatUnits(userDaiAfter - userDaiBefore, 18));
        console.log("   LP减少:", ethers.formatUnits(lpBalanceBefore - lpBalanceAfter, 18));
        
        // 验证LP减少了大约50%
        expect(lpBalanceAfter).to.be.closeTo(lpBalanceBefore / 2n, ethers.parseUnits("0.01", 18));
        
        // 验证获得了代币（包含收益）
        expect(userUsdcAfter).to.be.gt(userUsdcBefore);
        expect(userUsdtAfter).to.be.gt(userUsdtBefore);
        expect(userDaiAfter).to.be.gt(userDaiBefore);
        
        console.log("✅ 部分移除流动性成功!");
    });

    it("完全移除流动性 (Sepolia)", async function () {
        // 设置超时时间
        this.timeout(300000); // 5 分钟超时
        
        const { user, usdc, usdt, dai, mockCurve, defiAggregator, curveAdapter } = await deployFixture();
        
        // 检查用户当前LP余额（用户之前已经添加过流动性）
        const currentLpBalance = await mockCurve.balanceOf(user.address);
        console.log("💰 用户当前LP余额:", ethers.formatUnits(currentLpBalance, 18));
        
        if (currentLpBalance === 0n) {
            throw new Error("用户没有LP代币！请先运行'添加流动性'或'部分移除流动性'测试。");
        }
        
        // 模拟池子产生收益
        console.log("🔄 模拟池子产生收益...");
        await mockCurve.simulateYieldGrowth(user.address);
        
        // 记录移除前状态
        const lpBalanceBefore = await mockCurve.balanceOf(user.address);
        const userUsdcBefore = await usdc.balanceOf(user.address);
        const userUsdtBefore = await usdt.balanceOf(user.address);
        const userDaiBefore = await dai.balanceOf(user.address);
        
        console.log("📊 完全移除流动性前状态:");
        console.log("   LP余额:", ethers.formatUnits(lpBalanceBefore, 18));
        console.log("   USDC余额:", ethers.formatUnits(userUsdcBefore, 6));
        console.log("   USDT余额:", ethers.formatUnits(userUsdtBefore, 6));
        console.log("   DAI余额:", ethers.formatUnits(userDaiBefore, 18));
        
        // 移除全部流动性
        const lpToRemove = lpBalanceBefore;
        console.log("🔄 准备移除全部LP代币:", ethers.formatUnits(lpToRemove, 18));
        
        // 授权LP代币给适配器
        console.log("🔐 授权LP代币给CurveAdapter...");
        const approveTx = await mockCurve.connect(user).approve(await curveAdapter.getAddress(), lpToRemove);
        await approveTx.wait(1);
        console.log("✅ LP代币授权完成");
        
        const removeParams = {
            tokens: [await usdc.getAddress(), await usdt.getAddress(), await dai.getAddress()],
            amounts: [lpToRemove, 0, 0, 0], // [lpTokens, minAmount0, minAmount1, minAmount2]
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        console.log("🔄 执行完全移除流动性操作...");
        const removeTx = await defiAggregator.connect(user).executeOperation("curve", 3, removeParams); // REMOVE_LIQUIDITY
        console.log("📋 完全移除流动性交易已提交，哈希:", removeTx.hash);
        
        // 等待交易确认
        const receipt = await removeTx.wait(1);
        console.log("✅ 交易确认成功，区块:", receipt.blockNumber);
        console.log("⛽ Gas 使用量:", receipt.gasUsed.toString());
        
        // 等待状态同步
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 记录移除后状态
        const lpBalanceAfter = await mockCurve.balanceOf(user.address);
        const userUsdcAfter = await usdc.balanceOf(user.address);
        const userUsdtAfter = await usdt.balanceOf(user.address);
        const userDaiAfter = await dai.balanceOf(user.address);
        
        console.log("📊 完全移除流动性后状态:");
        console.log("   LP余额:", ethers.formatUnits(lpBalanceAfter, 18));
        console.log("   USDC余额:", ethers.formatUnits(userUsdcAfter, 6));
        console.log("   USDT余额:", ethers.formatUnits(userUsdtAfter, 6));
        console.log("   DAI余额:", ethers.formatUnits(userDaiAfter, 18));
        
        console.log("📈 最终收益情况:");
        console.log("   USDC获得:", ethers.formatUnits(userUsdcAfter - userUsdcBefore, 6));
        console.log("   USDT获得:", ethers.formatUnits(userUsdtAfter - userUsdtBefore, 6));
        console.log("   DAI获得:", ethers.formatUnits(userDaiAfter - userDaiBefore, 18));
        console.log("   LP完全移除:", ethers.formatUnits(lpBalanceBefore, 18));
        
        // 验证LP完全移除（应该为0）
        expect(lpBalanceAfter).to.equal(0);
        
        // 验证获得了代币（包含收益）
        expect(userUsdcAfter).to.be.gt(userUsdcBefore);
        expect(userUsdtAfter).to.be.gt(userUsdtBefore);
        expect(userDaiAfter).to.be.gt(userDaiBefore);
        
        console.log("✅ 完全移除流动性成功! LP余额:", ethers.formatUnits(lpBalanceAfter, 18));
    });
});