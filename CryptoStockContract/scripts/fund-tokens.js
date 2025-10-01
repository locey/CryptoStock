const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 开始为账户注入股票代币...");

  // 目标地址
  const targetAddress = "0xdee363c4a8ebc7a44f31a6e95cea659cdb2c605b";
  console.log("📝 目标地址:", targetAddress);

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("📝 操作者地址:", deployer.address);

  // 读取部署信息
  const fs = require("fs");
  const path = require("path");
  const deploymentsPath = path.join(__dirname, "..", "deployments-local.json");

  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ 部署文件不存在:", deploymentsPath);
    return;
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  if (!deployments.tokens) {
    console.error("❌ 部署文件中没有代币信息");
    return;
  }

  console.log("📊 发现的代币:");
  for (const [symbol, address] of Object.entries(deployments.tokens)) {
    console.log(`   ${symbol}: ${address}`);
  }

  // 为每个代币注入资金
  for (const [symbol, tokenAddress] of Object.entries(deployments.tokens)) {
    console.log(`\n📄 [STEP] 处理 ${symbol} 代币...`);

    try {
      const tokenContract = await ethers.getContractAt("StockToken", tokenAddress);

      // 注入代币到合约
      const injectAmount = ethers.parseEther("1000"); // 1000 个代币
      console.log(`💰 向 ${symbol} 合约注入 ${ethers.formatEther(injectAmount)} 个代币...`);

      const injectTx = await tokenContract.injectTokens(injectAmount);
      console.log(`⏳ ${symbol} 注入交易哈希:`, injectTx.hash);
      await injectTx.wait();
      console.log(`✅ ${symbol} 代币注入成功!`);

      // 检查合约余额
      const contractBalance = await tokenContract.balanceOf(tokenAddress);
      console.log(`💰 ${symbol} 合约余额: ${ethers.formatEther(contractBalance)} ${symbol}`);

      // 给目标地址转一些代币用于测试卖出
      const transferAmount = ethers.parseEther("100"); // 100 个代币
      console.log(`💰 给目标地址转账 ${ethers.formatEther(transferAmount)} 个 ${symbol}...`);

      const transferTx = await tokenContract.transfer(targetAddress, transferAmount);
      console.log(`⏳ ${symbol} 转账交易哈希:`, transferTx.hash);
      await transferTx.wait();
      console.log(`✅ ${symbol} 转账成功!`);

      // 检查目标地址余额
      const targetBalance = await tokenContract.balanceOf(targetAddress);
      console.log(`💰 目标地址 ${symbol} 余额: ${ethers.formatEther(targetBalance)} ${symbol}`);

    } catch (error) {
      console.error(`❌ 处理 ${symbol} 代币失败:`, error.message);
    }
  }

  console.log("\n🎉 股票代币注入完成!");
  console.log("📊 最终余额总结:");

  for (const [symbol, address] of Object.entries(deployments.tokens)) {
    try {
      const tokenContract = await ethers.getContractAt("StockToken", address);
      const balance = await tokenContract.balanceOf(targetAddress);
      console.log(`   ${symbol}: ${ethers.formatEther(balance)} ${symbol}`);
    } catch (error) {
      console.log(`   ${symbol}: 查询失败`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  });