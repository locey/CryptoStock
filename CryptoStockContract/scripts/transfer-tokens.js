const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ERC20 ABI - 包含 transfer, balanceOf, mint 等必要函数
const ERC20_ABI = [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function mint(address to, uint256 amount) external",
    "function owner() external view returns (address)",
    "function name() external view returns (string)",
    "function symbol() external view returns (string)"
];

/**
 * 读取部署配置文件
 */
function readDeploymentConfig() {
    const deploymentPath = path.join(__dirname, "../deployments-uups-sepolia.json");
    
    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`Deployment file not found: ${deploymentPath}`);
    }
    
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log(`📋 Loaded deployment config for network: ${deploymentData.network} (Chain ID: ${deploymentData.chainId})`);
    
    return deploymentData;
}

/**
 * 获取所有 ERC20 代币地址
 */
function getAllTokenAddresses(deploymentData) {
    const tokens = {};
    
    // 添加 USDT
    if (deploymentData.contracts.USDT) {
        tokens.USDT = deploymentData.contracts.USDT;
    }
    
    // 添加所有股票代币
    if (deploymentData.stockTokens) {
        Object.entries(deploymentData.stockTokens).forEach(([symbol, address]) => {
            tokens[symbol] = address;
        });
    }
    
    return tokens;
}

/**
 * 检查代币余额并执行转账或铸造
 */
async function handleTokenTransfer(tokenContract, tokenSymbol, ownerSigner, targetAddress, transferAmount) {
    try {
        console.log(`\n🔍 处理代币: ${tokenSymbol}`);
        
        // 获取代币信息
        const decimals = await tokenContract.decimals();
        const name = await tokenContract.name();
        const actualAmount = ethers.parseUnits(transferAmount.toString(), decimals);
        
        console.log(`   📝 代币信息: ${name} (${tokenSymbol}), 精度: ${decimals}`);
        console.log(`   💰 转账金额: ${transferAmount} ${tokenSymbol} (${actualAmount.toString()} wei)`);
        
        // 检查 owner 余额
        const ownerBalance = await tokenContract.balanceOf(ownerSigner.address);
        console.log(`   👑 Owner 余额: ${ethers.formatUnits(ownerBalance, decimals)} ${tokenSymbol}`);
        
        if (ownerBalance >= actualAmount) {
            // 余额足够，直接转账
            console.log(`   ✅ 余额充足，执行转账...`);
            const transferTx = await tokenContract.connect(ownerSigner).transfer(targetAddress, actualAmount);
            await transferTx.wait();
            console.log(`   🎯 转账成功! TxHash: ${transferTx.hash}`);
        } else {
            // 余额不足，尝试铸造
            console.log(`   ⚠️  余额不足，尝试铸造代币...`);
            
            try {
                const mintTx = await tokenContract.connect(ownerSigner).mint(targetAddress, actualAmount);
                await mintTx.wait();
                console.log(`   🎭 铸造成功! TxHash: ${mintTx.hash}`);
            } catch (mintError) {
                console.log(`   ❌ 铸造失败: ${mintError.message}`);
                console.log(`   🔄 尝试先铸造给 owner，再转账...`);
                
                try {
                    // 先铸造给 owner
                    const mintToOwnerTx = await tokenContract.connect(ownerSigner).mint(ownerSigner.address, actualAmount);
                    await mintToOwnerTx.wait();
                    console.log(`   🎭 铸造给 Owner 成功! TxHash: ${mintToOwnerTx.hash}`);
                    
                    // 再转账给目标地址
                    const transferTx = await tokenContract.connect(ownerSigner).transfer(targetAddress, actualAmount);
                    await transferTx.wait();
                    console.log(`   🎯 转账成功! TxHash: ${transferTx.hash}`);
                } catch (secondError) {
                    console.log(`   ❌ 最终操作失败: ${secondError.message}`);
                    throw secondError;
                }
            }
        }
        
        // 验证最终余额
        const finalBalance = await tokenContract.balanceOf(targetAddress);
        console.log(`   🏁 目标地址最终余额: ${ethers.formatUnits(finalBalance, decimals)} ${tokenSymbol}`);
        
    } catch (error) {
        console.error(`❌ 处理 ${tokenSymbol} 时发生错误:`, error.message);
        throw error;
    }
}

/**
 * 主函数
 */
async function main() {
    // 从环境变量或脚本内设置目标地址
    let targetAddress = process.env.TARGET_ADDRESS;
    let transferAmount = process.env.TRANSFER_AMOUNT || "10000";
    
    // 如果没有环境变量，可以在这里直接设置地址进行测试
    if (!targetAddress) {
        // 🔧 在这里设置目标地址进行快速测试
        targetAddress = "0xdee363c4a8ebc7a44f31a6e95cea659cdb2c605b"; // 替换为您的目标地址
        console.log("💡 使用脚本内预设的目标地址");
    }
    
    if (!targetAddress) {
        console.error("❌ 请设置目标地址!");
        console.error("   方法1: 在脚本中直接修改 targetAddress 变量");
        console.error("   方法2: 设置环境变量: TARGET_ADDRESS=0x1234...5678 npx hardhat run scripts/transfer-tokens.js --network sepolia");
        process.exit(1);
    }
    
    console.log("🚀 开始执行代币转账脚本");
    console.log(`📍 目标地址: ${targetAddress}`);
    console.log(`💰 每种代币转账数量: ${transferAmount}`);
    
    try {
        // 验证目标地址格式
        if (!ethers.isAddress(targetAddress)) {
            throw new Error("无效的以太坊地址格式");
        }
        
        // 读取部署配置
        const deploymentData = readDeploymentConfig();
        
        // 验证网络
        const network = await ethers.provider.getNetwork();
        console.log(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`);
        
        if (network.chainId.toString() !== deploymentData.chainId) {
            throw new Error(`网络不匹配! 期望: ${deploymentData.chainId}, 实际: ${network.chainId}`);
        }
        
        // 获取 owner 签名者
        const [ownerSigner] = await ethers.getSigners();
        console.log(`👑 Owner 地址: ${ownerSigner.address}`);
        
        // 验证 owner 地址是否与部署者匹配
        if (ownerSigner.address.toLowerCase() !== deploymentData.deployer.toLowerCase()) {
            console.warn(`⚠️  警告: 当前账户 (${ownerSigner.address}) 与部署者 (${deploymentData.deployer}) 不同`);
        }
        
        // 获取所有代币地址
        const tokens = getAllTokenAddresses(deploymentData);
        console.log(`📊 找到 ${Object.keys(tokens).length} 种 ERC20 代币:`);
        Object.entries(tokens).forEach(([symbol, address]) => {
            console.log(`   ${symbol}: ${address}`);
        });
        
        // 检查 owner ETH 余额
        const ethBalance = await ethers.provider.getBalance(ownerSigner.address);
        console.log(`⛽ Owner ETH 余额: ${ethers.formatEther(ethBalance)} ETH`);
        
        if (ethBalance < ethers.parseEther("0.01")) {
            console.warn("⚠️  警告: ETH 余额较低，可能无法支付 Gas 费用");
        }
        
        console.log("\n" + "=".repeat(60));
        console.log("开始处理代币转账...");
        console.log("=".repeat(60));
        
        // 处理每种代币
        let successCount = 0;
        let failCount = 0;
        
        for (const [symbol, address] of Object.entries(tokens)) {
            try {
                const tokenContract = new ethers.Contract(address, ERC20_ABI, ethers.provider);
                await handleTokenTransfer(tokenContract, symbol, ownerSigner, targetAddress, transferAmount);
                successCount++;
            } catch (error) {
                console.error(`❌ ${symbol} 处理失败:`, error.message);
                failCount++;
            }
        }
        
        // 输出总结
        console.log("\n" + "=".repeat(60));
        console.log("📊 执行结果总结:");
        console.log("=".repeat(60));
        console.log(`✅ 成功: ${successCount} 种代币`);
        console.log(`❌ 失败: ${failCount} 种代币`);
        console.log(`🎯 目标地址: ${targetAddress}`);
        console.log(`💰 每种代币转账数量: ${transferAmount}`);
        
        if (failCount === 0) {
            console.log("\n🎉 所有代币转账完成!");
        } else {
            console.log(`\n⚠️  有 ${failCount} 种代币转账失败，请检查日志`);
        }
        
    } catch (error) {
        console.error("💥 脚本执行失败:", error.message);
        process.exit(1);
    }
}

// 执行主函数
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 未捕获的错误:", error);
        process.exit(1);
    });