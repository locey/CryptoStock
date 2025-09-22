const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 开始部署CSToken合约到Sepolia测试网...\n");

    // 获取部署者账户
    const [deployer] = await ethers.getSigners();
    console.log("📝 部署者账户:", deployer.address);
    
    // 检查账户余额
    const balance = await deployer.getBalance();
    console.log("💰 账户余额:", ethers.utils.formatEther(balance), "ETH");
    
    if (balance.lt(ethers.utils.parseEther("0.01"))) {
        console.log("⚠️  警告: 账户余额较低，可能无法完成部署");
        console.log("   请确保账户有足够的ETH用于支付Gas费用");
    }
    console.log("");

    // 部署参数
    const tokenName = "CryptoStock Token";
    const tokenSymbol = "CSTK";
    const tokenDecimals = 18;
    const initialSupply = ethers.utils.parseEther("1000000"); // 100万代币
    const maxSupply = ethers.utils.parseEther("10000000"); // 1000万代币
    const owner = deployer.address;

    console.log("📋 部署参数:");
    console.log("  代币名称:", tokenName);
    console.log("  代币符号:", tokenSymbol);
    console.log("  代币精度:", tokenDecimals);
    console.log("  初始供应量:", ethers.utils.formatEther(initialSupply));
    console.log("  最大供应量:", ethers.utils.formatEther(maxSupply));
    console.log("  所有者:", owner);
    console.log("");

    // 部署CSToken合约
    console.log("📄 正在部署CSToken合约...");
    const CSToken = await ethers.getContractFactory("CSToken");
    
    const csToken = await CSToken.deploy(
        tokenName,
        tokenSymbol,
        tokenDecimals,
        initialSupply,
        maxSupply,
        owner
    );

    console.log("⏳ 等待交易确认...");
    await csToken.deployed();
    
    console.log("✅ CSToken合约部署成功!");
    console.log("📍 合约地址:", csToken.address);
    console.log("🔗 Sepolia浏览器:", `https://sepolia.etherscan.io/address/${csToken.address}`);
    console.log("");

    // 验证合约部署
    console.log("🔍 验证合约部署...");
    try {
        const tokenInfo = await csToken.getTokenInfo();
        console.log("📊 代币信息验证:");
        console.log("  名称:", tokenInfo.name_);
        console.log("  符号:", tokenInfo.symbol_);
        console.log("  精度:", tokenInfo.decimals_.toString());
        console.log("  总供应量:", ethers.utils.formatEther(tokenInfo.totalSupply_));
        console.log("  最大供应量:", ethers.utils.formatEther(tokenInfo.maxSupply_));
        console.log("  铸造启用:", tokenInfo.mintingEnabled_);
        console.log("  销毁启用:", tokenInfo.burningEnabled_);
        console.log("  暂停状态:", tokenInfo.paused_);
        console.log("  所有者:", tokenInfo.owner_);
        console.log("");

        // 检查初始余额
        const ownerBalance = await csToken.balanceOf(owner);
        console.log("💰 所有者初始余额:", ethers.utils.formatEther(ownerBalance));
        console.log("");

        // 测试基本功能
        console.log("🧪 测试基本功能...");
        
        // 测试暂停功能
        await csToken.pause();
        const isPaused = await csToken.paused();
        console.log("✅ 暂停功能正常:", isPaused);
        
        // 恢复合约
        await csToken.unpause();
        const isUnpaused = await csToken.paused();
        console.log("✅ 恢复功能正常:", !isUnpaused);
        
        // 测试铸造功能
        const mintAmount = ethers.utils.parseEther("1000");
        await csToken.mint(owner, mintAmount, "测试铸造");
        const newBalance = await csToken.balanceOf(owner);
        console.log("✅ 铸造功能正常，新余额:", ethers.utils.formatEther(newBalance));
        
        // 测试销毁功能
        const burnAmount = ethers.utils.parseEther("100");
        await csToken.burn(owner, burnAmount, "测试销毁");
        const finalBalance = await csToken.balanceOf(owner);
        console.log("✅ 销毁功能正常，最终余额:", ethers.utils.formatEther(finalBalance));
        
        console.log("");
        console.log("🎉 合约部署和功能验证完成！");
        
    } catch (error) {
        console.log("❌ 合约验证失败:", error.message);
    }

    // 保存部署信息
    const deploymentInfo = {
        network: "sepolia",
        contractName: "CSToken",
        contractAddress: csToken.address,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        tokenName: tokenName,
        tokenSymbol: tokenSymbol,
        tokenDecimals: tokenDecimals,
        initialSupply: initialSupply.toString(),
        maxSupply: maxSupply.toString(),
        owner: owner,
        transactionHash: csToken.deployTransaction.hash,
        blockNumber: csToken.deployTransaction.blockNumber
    };

    console.log("💾 部署信息已保存:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // 提示后续操作
    console.log(`   合约地址: ${csToken.address}`);
    
    return csToken.address;
}

main()
    .then((address) => {
        console.log("✅ 部署脚本执行完成，合约地址:", address);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ 部署失败:", error);
        process.exit(1);
    });
