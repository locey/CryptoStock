// 10-yearnv3-sepolia.test.js
// 测试 YearnV3Adapter 在 Sepolia 网络的存款取款功能

const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

describe("10-yearnv3-sepolia.test.js - YearnV3Adapter Sepolia 测试", function () {
    let deploymentConfig;
    let deployer, user;
    let usdt, vault, defiAggregator, yearnAdapter;
    let USDT_ADDRESS, YEARN_V3_VAULT;

    const USER_DEPOSIT_AMOUNT = ethers.parseUnits("100", 6); // 100 USDT (6 decimals)
    const SHARES_DECIMALS = 18; // Vault Shares 使用 18 位小数

    before(async function() {
        // 加载部署配置
        const deploymentPath = path.join(__dirname, '..', 'deployments-yearnv3-adapter-sepolia.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error(`部署文件不存在: ${deploymentPath}`);
        }
        
        deploymentConfig = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        console.log("已加载部署配置:", deploymentConfig.network);
        
        // 检查网络
        const network = await ethers.provider.getNetwork();
        if (network.chainId !== BigInt(deploymentConfig.chainId)) {
            this.skip();
        }

        // 获取账户
        [deployer, user] = await ethers.getSigners();

        // 从部署配置获取地址
        USDT_ADDRESS = deploymentConfig.contracts.MockERC20_USDT;
        YEARN_V3_VAULT = deploymentConfig.contracts.MockYearnV3Vault;
        const DEFI_AGGREGATOR = deploymentConfig.contracts.DefiAggregator;
        const YEARN_ADAPTER = deploymentConfig.contracts.YearnV3Adapter;

        // 获取已部署的合约实例
        usdt = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
        defiAggregator = await ethers.getContractAt("DefiAggregator", DEFI_AGGREGATOR);
        yearnAdapter = await ethers.getContractAt("YearnV3Adapter", YEARN_ADAPTER);
        vault = await ethers.getContractAt("MockYearnV3Vault", YEARN_V3_VAULT);

        // 检查 USDT 余额，如果不足则跳过测试
        const userBalance = await usdt.balanceOf(user.address);
        if (userBalance < USER_DEPOSIT_AMOUNT) {
            console.log(`用户 USDT 余额不足: ${ethers.formatUnits(userBalance, 6)} USDT`);
            console.log(`需要至少: ${ethers.formatUnits(USER_DEPOSIT_AMOUNT, 6)} USDT`);
            throw new Error("USDT余额不足，请先获取测试代币");
        }

        console.log("✅ 已连接到 Sepolia 上的合约:");
        console.log("   USDT:", USDT_ADDRESS);
        console.log("   YearnV3Vault:", YEARN_V3_VAULT);
        console.log("   DefiAggregator:", DEFI_AGGREGATOR);
        console.log("   YearnV3Adapter:", YEARN_ADAPTER);
    });

    it("检查合约部署和配置", async function () {
        // 检查 USDT 代币信息
        const usdtName = await usdt.name();
        const usdtSymbol = await usdt.symbol();
        const usdtDecimals = await usdt.decimals();
        
        console.log("USDT 信息:");
        console.log("名称:", usdtName);
        console.log("符号:", usdtSymbol);
        console.log("精度:", usdtDecimals);
        
        // 检查 Vault 信息
        const vaultAsset = await vault.asset();
        const vaultName = await vault.name();
        const vaultSymbol = await vault.symbol();
        
        console.log("Vault 信息:");
        console.log("底层资产:", vaultAsset);
        console.log("名称:", vaultName);
        console.log("符号:", vaultSymbol);
        
        // 验证配置
        expect(vaultAsset.toLowerCase()).to.equal(USDT_ADDRESS.toLowerCase());
        
        const adapterUnderlyingToken = await yearnAdapter.underlyingToken();
        expect(adapterUnderlyingToken.toLowerCase()).to.equal(USDT_ADDRESS.toLowerCase());
    });

    it("存款功能", async function () {
        // 记录操作前状态
        const userUsdtBefore = await usdt.balanceOf(user.address);
        const userSharesBefore = await vault.balanceOf(user.address);
        
        console.log("存款前:");
        console.log("用户USDT余额:", ethers.formatUnits(userUsdtBefore, 6));
        console.log("用户份额余额:", ethers.formatUnits(userSharesBefore, SHARES_DECIMALS));
        console.log("存款金额:", ethers.formatUnits(USER_DEPOSIT_AMOUNT, 6));
        
        // 检查当前授权额度
        const yearnAdapterAddress = await yearnAdapter.getAddress();
        console.log("YearnAdapter地址:", yearnAdapterAddress);
        
        const currentAllowance = await usdt.allowance(user.address, yearnAdapterAddress);
        console.log("授权前的额度:", ethers.formatUnits(currentAllowance, 6));
        
        // 用户授权
        console.log("正在授权...");
        const approveTx = await usdt.connect(user).approve(yearnAdapterAddress, USER_DEPOSIT_AMOUNT);
        await approveTx.wait(); // 等待授权交易确认
        console.log("授权交易已确认");
        
        // 验证授权后的额度
        const newAllowance = await usdt.allowance(user.address, yearnAdapterAddress);
        console.log("授权后的额度:", ethers.formatUnits(newAllowance, 6));
        
        // 构造存款参数
        const params = {
            tokens: [USDT_ADDRESS],
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
        const userUsdtAfter = await usdt.balanceOf(user.address);
        const userSharesAfter = await vault.balanceOf(user.address);
        
        console.log("存款后:");
        console.log("用户USDT余额:", ethers.formatUnits(userUsdtAfter, 6));
        console.log("用户份额余额:", ethers.formatUnits(userSharesAfter, SHARES_DECIMALS));
        
        // 验证代币转移
        expect(userUsdtBefore - userUsdtAfter).to.equal(USER_DEPOSIT_AMOUNT);
        expect(userSharesAfter).to.be.gt(userSharesBefore);
    });

    it("部分取款", async function () {
        // 记录取款前状态
        const sharesBefore = await vault.balanceOf(user.address);
        const usdtBefore = await usdt.balanceOf(user.address);
        const vaultUsdtBefore = await usdt.balanceOf(await vault.getAddress());
        
        // 获取Vault的详细信息
        const vaultTotalAssets = await vault.totalAssets();
        const vaultTotalSupply = await vault.totalSupply();
        // 计算每份额价格 = totalAssets / totalSupply
        const vaultSharePrice = vaultTotalSupply > 0 ? (vaultTotalAssets * ethers.parseUnits("1", 6)) / vaultTotalSupply : ethers.parseUnits("1", 6);
        
        console.log("=== 取款前状态 ===");
        console.log("用户份额余额:", ethers.formatUnits(sharesBefore, SHARES_DECIMALS));
        console.log("用户USDT余额:", ethers.formatUnits(usdtBefore, 6));
        console.log("Vault USDT余额:", ethers.formatUnits(vaultUsdtBefore, 6));

        console.log("=== Vault 完整余额信息 ===");
        console.log("Vault 总资产 (totalAssets):", ethers.formatUnits(vaultTotalAssets, 6), "USDT");
        console.log("Vault 总供应量 (totalSupply):", ethers.formatUnits(vaultTotalSupply, SHARES_DECIMALS), "shares");
        console.log("Vault 每份额价格 (计算值):", ethers.formatUnits(vaultSharePrice, 6));
        console.log("Vault 地址余额 (balanceOf):", ethers.formatUnits(vaultUsdtBefore, 6), "USDT");

        // 取款50%的份额
        const sharesToWithdraw = sharesBefore / 2n;

        console.log("=== 取款计划 ===");
        console.log("计划取款份额:", ethers.formatUnits(sharesToWithdraw, SHARES_DECIMALS));

        // 预览取款金额，看看能取回多少USDT
        const previewAssets = await yearnAdapter.previewRedeem(sharesToWithdraw);
        console.log("预期取回资产:", ethers.formatUnits(previewAssets, 6), "USDT");

        const withdrawParams = {
            tokens: [USDT_ADDRESS],
            amounts: [sharesToWithdraw.toString()], // 传入shares数量，而不是USDT数量
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };

        // 用户授权足够的份额（授权要取款的份额数量）
        console.log("正在授权 Vault Shares...");
        const approveTx = await vault.connect(user).approve(await yearnAdapter.getAddress(), sharesToWithdraw);
        await approveTx.wait();
        console.log("Vault Shares 授权完成");

        console.log("正在执行取款操作...");
        const withdrawTx = await defiAggregator.connect(user).executeOperation("yearnv3", 1, withdrawParams); // WITHDRAW
        console.log("取款交易已提交，等待确认...");
        await withdrawTx.wait(); // 等待交易确认
        console.log("取款交易已确认");
        
        // 额外等待一些时间确保状态更新
        console.log("等待状态更新...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        console.log("状态更新完成");
        
        // 记录取款后状态
        const sharesAfter = await vault.balanceOf(user.address);
        const usdtAfter = await usdt.balanceOf(user.address);
        const vaultUsdtAfter = await usdt.balanceOf(await vault.getAddress());
        
        // 获取取款后Vault的详细信息
        const vaultTotalAssetsAfter = await vault.totalAssets();
        const vaultTotalSupplyAfter = await vault.totalSupply();
        // 计算每份额价格 = totalAssets / totalSupply
        const vaultSharePriceAfter = vaultTotalSupplyAfter > 0 ? (vaultTotalAssetsAfter * ethers.parseUnits("1", 6)) / vaultTotalSupplyAfter : ethers.parseUnits("1", 6);
        
        console.log("=== 取款后状态 ===");
        console.log("用户份额余额:", ethers.formatUnits(sharesAfter, SHARES_DECIMALS));
        console.log("用户USDT余额:", ethers.formatUnits(usdtAfter, 6));

        console.log("=== Vault 取款后完整余额信息 ===");
        console.log("Vault 总资产 (totalAssets):", ethers.formatUnits(vaultTotalAssetsAfter, 6), "USDT");
        console.log("Vault 总供应量 (totalSupply):", ethers.formatUnits(vaultTotalSupplyAfter, SHARES_DECIMALS), "shares");
        console.log("Vault 每份额价格 (计算值):", ethers.formatUnits(vaultSharePriceAfter, 6));
        console.log("Vault 地址余额 (balanceOf):", ethers.formatUnits(vaultUsdtAfter, 6), "USDT");

        console.log("=== Vault 余额变化对比 ===");
        console.log("总资产变化:", ethers.formatUnits(vaultTotalAssetsAfter - vaultTotalAssets, 6), "USDT");
        console.log("总供应量变化:", ethers.formatUnits(vaultTotalSupplyAfter - vaultTotalSupply, SHARES_DECIMALS), "shares");
        console.log("地址余额变化:", ethers.formatUnits(vaultUsdtAfter - vaultUsdtBefore, 6), "USDT");
        
        // 验证取款效果
        expect(sharesAfter).to.be.lt(sharesBefore);
        expect(usdtAfter).to.be.gt(usdtBefore);
        
        // 验证取款的资产数量
        const actualWithdrawn = usdtAfter - usdtBefore;
        console.log("实际取款金额:", ethers.formatUnits(actualWithdrawn, 6), "USDT");
        expect(actualWithdrawn).to.be.gt(ethers.parseUnits("30", 6)); // 至少取回30 USDT
        expect(actualWithdrawn).to.be.lt(ethers.parseUnits("60", 6)); // 不超过60 USDT
    });

    it("预览功能", async function () {
        // 测试预览存款
        const depositAmount = ethers.parseUnits("50", 6); // 50 USDT
        const previewShares = await yearnAdapter.previewDeposit(depositAmount);
        
        console.log("预览存款:");
        console.log("存入资产:", ethers.formatUnits(depositAmount, 6), "USDT");
        console.log("预期获得份额:", ethers.formatUnits(previewShares, 6));
        
        expect(previewShares).to.be.gt(0);
        
        // 测试预览赎回
        const sharesToRedeem = ethers.parseUnits("50", 6);
        const previewAssets = await yearnAdapter.previewRedeem(sharesToRedeem);
        
        console.log("预览赎回:");
        console.log("赎回份额:", ethers.formatUnits(sharesToRedeem, 6));
        console.log("预期获得资产:", ethers.formatUnits(previewAssets, 6), "USDT");
        
        expect(previewAssets).to.be.gt(0);
    });

    it("查询功能", async function () {
        // 先存款
        await usdt.connect(user).approve(await yearnAdapter.getAddress(), USER_DEPOSIT_AMOUNT);
        
        const params = {
            tokens: [USDT_ADDRESS],
            amounts: [USER_DEPOSIT_AMOUNT],
            recipient: user.address,
            deadline: Math.floor(Date.now() / 1000) + 3600,
            tokenId: 0,
            extraData: "0x"
        };
        
        await defiAggregator.connect(user).executeOperation("yearnv3", 0, params);
        
        // 查询各种数据
        const currentValue = await yearnAdapter.getUserCurrentValue(user.address);
        const userShares = await vault.balanceOf(user.address);
        const totalAssets = await vault.totalAssets();
        const totalSupply = await vault.totalSupply();
        
        console.log("查询结果:");
        console.log("当前价值:", ethers.formatUnits(currentValue, 6), "USDT");
        console.log("用户份额:", ethers.formatUnits(userShares, 6), "shares");
        console.log("Vault总资产:", ethers.formatUnits(totalAssets, 6), "USDT");
        console.log("Vault总供应量:", ethers.formatUnits(totalSupply, 6), "shares");
        
        expect(currentValue).to.be.gt(0);
        expect(userShares).to.be.gt(0);
    });
});