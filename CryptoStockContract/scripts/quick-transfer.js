const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// 简化的转账脚本 - 快速给测试账户发送代币

async function quickTransfer() {
    // 可以在这里直接修改目标地址和金额
    const TARGET_ADDRESS = "0x1234567890123456789012345678901234567890"; // 修改为实际地址
    const TRANSFER_AMOUNT = "10000";
    
    console.log("🚀 快速代币转账脚本");
    console.log(`📍 目标地址: ${TARGET_ADDRESS}`);
    console.log(`💰 转账金额: ${TRANSFER_AMOUNT} (每种代币)`);
    
    // 验证地址
    if (!ethers.isAddress(TARGET_ADDRESS)) {
        console.error("❌ 请在脚本中设置有效的目标地址!");
        return;
    }
    
    // 读取部署配置
    const deploymentPath = path.join(__dirname, "../deployments-uups-sepolia.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    // 获取签名者
    const [owner] = await ethers.getSigners();
    console.log(`👑 使用账户: ${owner.address}`);
    
    // ERC20 基础 ABI
    const erc20ABI = [
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function mint(address to, uint256 amount) external",
        "function symbol() external view returns (string)"
    ];
    
    // 收集所有代币
    const tokens = {
        ...deploymentData.stockTokens,
        USDT: deploymentData.contracts.USDT
    };
    
    console.log(`\n📋 准备转账 ${Object.keys(tokens).length} 种代币:`);
    
    for (const [symbol, address] of Object.entries(tokens)) {
        try {
            console.log(`\n🔄 处理 ${symbol}...`);
            
            const contract = new ethers.Contract(address, erc20ABI, owner);
            const decimals = await contract.decimals();
            const amount = ethers.parseUnits(TRANSFER_AMOUNT, decimals);
            
            // 检查余额
            const balance = await contract.balanceOf(owner.address);
            
            if (balance >= amount) {
                // 直接转账
                const tx = await contract.transfer(TARGET_ADDRESS, amount);
                await tx.wait();
                console.log(`✅ ${symbol} 转账成功 (${tx.hash})`);
            } else {
                // 先铸造，再转账
                try {
                    const mintTx = await contract.mint(TARGET_ADDRESS, amount);
                    await mintTx.wait();
                    console.log(`🎭 ${symbol} 铸造成功 (${mintTx.hash})`);
                } catch {
                    const mintTx = await contract.mint(owner.address, amount);
                    await mintTx.wait();
                    const transferTx = await contract.transfer(TARGET_ADDRESS, amount);
                    await transferTx.wait();
                    console.log(`✅ ${symbol} 铸造并转账成功`);
                }
            }
            
        } catch (error) {
            console.error(`❌ ${symbol} 失败:`, error.message);
        }
    }
    
    console.log("\n🎉 批量转账完成!");
}

// 如果直接运行此文件
if (require.main === module) {
    quickTransfer()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { quickTransfer };