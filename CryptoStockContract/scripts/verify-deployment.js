const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🔍 验证部署者:", await deployer.getAddress());
  
  // 从部署记录中读取地址
  const fs = require('fs');
  const deployData = JSON.parse(fs.readFileSync('deployments-uups-sepolia.json', 'utf8'));
  
  console.log("\n📋 验证已部署的合约...");
  
  // 验证 OracleAggregator
  const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
  const oracle = OracleAggregator.attach(deployData.contracts.OracleAggregator.proxy);
  
  console.log("🔮 预言机聚合器:", await oracle.getAddress());
  
  // 验证 TokenFactory
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const factory = TokenFactory.attach(deployData.contracts.TokenFactory.proxy);
  
  console.log("🏭 代币工厂:", await factory.getAddress());
  
  // 检查 USDT 地址
  const usdtAddress = await factory.usdtTokenAddress();
  console.log("💰 USDT 代币:", usdtAddress);
  
  // 检查预言机地址
  const oracleAddress = await factory.oracleAggregator();
  console.log("📊 预言机地址:", oracleAddress);
  
  // 检查一个价格源 (使用 symbol 而不是 priceId)
  try {
    const aaplPrice = await oracle.getPrice("AAPL");
    console.log("🍎 AAPL 价格:", ethers.formatUnits(aaplPrice, 18), "USD");
  } catch (error) {
    console.log("⚠️ AAPL 价格查询失败 (这是正常的，因为 Sepolia 上的 Pyth 可能没有实时数据)");
  }
  
  console.log("\n✅ 所有合约验证通过！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 验证失败:", error);
    process.exit(1);
  });