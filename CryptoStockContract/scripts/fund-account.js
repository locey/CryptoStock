const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 开始为账户注入资金...");

  // 目标地址
  const targetAddress = "0xdee363c4a8ebc7a44f31a6e95cea659cdb2c605b";
  console.log("📝 目标地址:", targetAddress);

  // 获取部署者账户 (有大量 ETH)
  const [deployer] = await ethers.getSigners();
  console.log("📝 资金来源地址:", deployer.address);

  // 检查部署者余额
  const deployerBalance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 部署者 ETH 余额:", ethers.formatEther(deployerBalance), "ETH");

  // 1. 转账 ETH 给目标地址 (用于支付 Gas)
  console.log("\n📄 [STEP 1] 转账 ETH...");
  const ethAmount = ethers.parseEther("10"); // 10 ETH

  try {
    const ethTx = await deployer.sendTransaction({
      to: targetAddress,
      value: ethAmount,
    });
    console.log("⏳ ETH 交易哈希:", ethTx.hash);
    await ethTx.wait();
    console.log("✅ ETH 转账成功!");
  } catch (error) {
    console.error("❌ ETH 转账失败:", error.message);
  }

  // 检查目标地址的 ETH 余额
  const targetEthBalance = await deployer.provider.getBalance(targetAddress);
  console.log("💰 目标地址 ETH 余额:", ethers.formatEther(targetEthBalance), "ETH");

  // 2. 获取已部署的 USDT 合约地址
  console.log("\n📄 [STEP 2] 获取 USDT 合约地址...");

  // 从部署信息文件读取 USDT 地址
  const fs = require("fs");
  const path = require("path");
  const deploymentsPath = path.join(__dirname, "..", "deployments-local.json");

  let usdtAddress;
  if (fs.existsSync(deploymentsPath)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    usdtAddress = deployments.contracts.usdt;
    console.log("✅ 从部署文件读取 USDT 地址:", usdtAddress);
  } else {
    // 如果没有部署文件，使用已知的地址
    usdtAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
    console.log("⚠️ 使用默认 USDT 地址:", usdtAddress);
  }

  // 3. 给目标地址铸造 USDT
  console.log("\n📄 [STEP 3] 铸造 USDT...");
  const usdtAmount = ethers.parseUnits("5000", 6); // 5000 USDT (6位小数)

  try {
    const usdtContract = await ethers.getContractAt(
      "contracts/mock/MockERC20.sol:MockERC20",
      usdtAddress
    );

    const mintTx = await usdtContract.mint(targetAddress, usdtAmount);
    console.log("⏳ USDT 铸造交易哈希:", mintTx.hash);
    await mintTx.wait();
    console.log("✅ USDT 铸造成功!");
  } catch (error) {
    console.error("❌ USDT 铸造失败:", error.message);
  }

  // 4. 检查目标地址的 USDT 余额
  try {
    const usdtContract = await ethers.getContractAt(
      "contracts/mock/MockERC20.sol:MockERC20",
      usdtAddress
    );
    const usdtBalance = await usdtContract.balanceOf(targetAddress);
    console.log("💰 目标地址 USDT 余额:", ethers.formatUnits(usdtBalance, 6), "USDT");
  } catch (error) {
    console.error("❌ 查询 USDT 余额失败:", error.message);
  }

  // 5. 获取股票代币合约地址并注入代币
  console.log("\n📄 [STEP 4] 获取股票代币信息...");

  if (fs.existsSync(deploymentsPath)) {
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

    if (deployments.tokens) {
      console.log("📊 发现代币地址:");
      for (const [symbol, address] of Object.entries(deployments.tokens)) {
        console.log(`   ${symbol}: ${address}`);

        // 查询代币余额
        try {
          const tokenContract = await ethers.getContractAt("StockToken", address);
          const balance = await tokenContract.balanceOf(targetAddress);
          const formattedBalance = ethers.formatEther(balance);
          console.log(`   💰 ${symbol} 余额: ${formattedBalance} ${symbol}`);
        } catch (error) {
          console.log(`   ❌ 无法查询 ${symbol} 余额:`, error.message);
        }
      }
    }
  }

  console.log("\n🎉 资金注入完成!");
  console.log("📊 账户资金总结:");
  console.log(`   地址: ${targetAddress}`);
  console.log(`   ETH: ${ethers.formatEther(targetEthBalance)} ETH`);
  console.log(`   USDT: 可以进行交易了`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 脚本执行失败:", error);
    process.exit(1);
  });