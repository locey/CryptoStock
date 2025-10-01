const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 开始部署本地网络合约...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("📝 部署者地址:", deployer.address);

  // 1. 部署 MockPyth
  console.log("📄 [STEP 1] 部署 MockPyth 合约...");
  const MockPyth = await ethers.getContractFactory("contracts/mock/MockPyth.sol:MockPyth");
  const mockPyth = await MockPyth.deploy();
  await mockPyth.waitForDeployment();
  const mockPythAddress = await mockPyth.getAddress();
  console.log("✅ MockPyth 部署完成:", mockPythAddress);

  // 2. 部署 USDT (MockERC20)
  console.log("📄 [STEP 2] 部署 USDT 代币...");
  const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
  const usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
  await usdtToken.waitForDeployment();
  const usdtAddress = await usdtToken.getAddress();
  console.log("✅ USDT 代币部署完成:", usdtAddress);

  // 3. 部署 OracleAggregator
  console.log("📄 [STEP 3] 部署预言机聚合器...");
  const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
  const oracleAggregator = await upgrades.deployProxy(
    OracleAggregator,
    [mockPythAddress],
    {
      kind: 'uups',
      initializer: 'initialize'
    }
  );
  await oracleAggregator.waitForDeployment();
  const oracleAddress = await oracleAggregator.getAddress();
  console.log("✅ 预言机聚合器部署完成:", oracleAddress);

  // 4. 部署 StockToken 实现合约
  console.log("📄 [STEP 4] 部署 StockToken 实现合约...");
  const StockToken = await ethers.getContractFactory("StockToken");
  const stockTokenImplementation = await StockToken.deploy();
  await stockTokenImplementation.waitForDeployment();
  const implementationAddress = await stockTokenImplementation.getAddress();
  console.log("✅ StockToken 实现合约部署完成:", implementationAddress);

  // 5. 部署 TokenFactory
  console.log("📄 [STEP 5] 部署 TokenFactory...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactory = await upgrades.deployProxy(
    TokenFactory,
    [oracleAddress, implementationAddress, usdtAddress],
    {
      kind: 'uups',
      initializer: 'initialize'
    }
  );
  await tokenFactory.waitForDeployment();
  const factoryAddress = await tokenFactory.getAddress();
  console.log("✅ TokenFactory 部署完成:", factoryAddress);

  // 6. 保存部署信息
  const deploymentInfo = {
    network: "localhost",
    chainId: 31337,
    deployedAt: new Date().toISOString(),
    contracts: {
      mockPyth: mockPythAddress,
      usdt: usdtAddress,
      oracleAggregator: oracleAddress,
      stockTokenImplementation: implementationAddress,
      tokenFactory: factoryAddress,
    }
  };

  // 保存到项目根目录
  const deploymentsPath = path.join(__dirname, "..", "deployments-local.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ 部署信息已保存到:", deploymentsPath);

  // 7. 创建一些测试代币
  console.log("📄 [STEP 6] 创建测试代币...");

  // 设置价格数据
  const now = Math.floor(Date.now() / 1000);
  await mockPyth.setPrice("0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688", 150, -2, now); // AAPL $1.50
  await mockPyth.setPrice("0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6", 280, -2, now + 1); // GOOGL $2.80

  // 配置价格源
  await oracleAggregator.setFeedId("AAPL", "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688");
  await oracleAggregator.setFeedId("GOOGL", "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6");

  // 创建 AAPL 代币
  const createAaplTx = await tokenFactory.createToken(
    "Apple Stock Token",
    "AAPL",
    ethers.parseEther("1000000")
  );
  await createAaplTx.wait();
  const aaplAddress = await tokenFactory.getTokenAddress("AAPL");
  console.log("✅ AAPL 代币创建:", aaplAddress);

  // 创建 GOOGL 代币
  const createGooglTx = await tokenFactory.createToken(
    "Google Stock Token",
    "GOOGL",
    ethers.parseEther("500000")
  );
  await createGooglTx.wait();
  const googlAddress = await tokenFactory.getTokenAddress("GOOGL");
  console.log("✅ GOOGL 代币创建:", googlAddress);

  // 8. 向合约注入代币
  console.log("📄 [STEP 7] 注入代币到合约...");

  const aaplToken = await ethers.getContractAt("StockToken", aaplAddress);
  const googlToken = await ethers.getContractAt("StockToken", googlAddress);

  // 注入 AAPL 代币
  await aaplToken.injectTokens(ethers.parseEther("100000"));
  console.log("✅ AAPL 合约注入 100000 代币");

  // 注入 GOOGL 代币
  await googlToken.injectTokens(ethers.parseEther("50000"));
  console.log("✅ GOOGL 合约注入 50000 代币");

  // 9. 给部署者一些 USDT 用于测试
  await usdtToken.mint(deployer.address, ethers.parseUnits("10000", 6));
  console.log("✅ 给部署者铸造 10000 USDT");

  // 更新部署信息
  deploymentInfo.tokens = {
    aapl: aaplAddress,
    googl: googlAddress,
  };
  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 本地网络部署完成！");
  console.log("📊 主要合约地址:");
  console.log("   USDT:", usdtAddress);
  console.log("   Oracle Aggregator:", oracleAddress);
  console.log("   Token Factory:", factoryAddress);
  console.log("   AAPL Token:", aaplAddress);
  console.log("   GOOGL Token:", googlAddress);
  console.log("\n💡 请将这些地址更新到前端配置文件中");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });