// 完全替代 hardhat-deploy 的一体化部署脚本
// 直接用 npx hardhat run scripts/deploy-full-system.js --network <network> 执行

const { ethers, upgrades } = require("hardhat");

const PYTH_SEPOLIA_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21";
const FEED_IDS = {
  "AAPL": "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  "TSLA": "0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2",
  "GOOGL": "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
  "MSFT": "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  "AMZN": "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  "NVDA": "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"
};

async function main() {
  const [deployer, ...accounts] = await ethers.getSigners();
  console.log("🚀 部署币股池系统合约...");
  console.log("📝 部署者地址:", await deployer.getAddress());

  // 判断是否为本地网络
  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";
  
  // STEP 1: 部署 USDT
  console.log("\n📄 [STEP 1] 部署模拟 USDT 代币...");
  const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
  const usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
  await usdtToken.waitForDeployment();
  console.log("✅ USDT 代币部署完成:", await usdtToken.getAddress());

  // STEP 2: 部署 Pyth
  let pythAddress;
  if (isLocalNetwork) {
    console.log("🧪 本地网络 - 部署Mock合约...");
    
    const MockPyth = await ethers.getContractFactory("contracts/mock/MockPyth.sol:MockPyth");
    const mockPyth = await MockPyth.deploy();
    await mockPyth.waitForDeployment();
    pythAddress = await mockPyth.getAddress();
    console.log("✅ MockPyth 部署完成:", pythAddress);
    // 设置本地价格
    const now = Math.floor(Date.now() / 1000);
    for (const [symbol, feedId] of Object.entries(FEED_IDS)) {
      await mockPyth.setPrice(feedId, 10000, -8, now);
      console.log(`   MockPyth 设置价格: ${symbol} = 100.00`);
    }
  } else if (network.name === "sepolia") {
    pythAddress = PYTH_SEPOLIA_ADDRESS;
    console.log("✅ 使用官方Pyth地址:", pythAddress);
  } else {
    throw new Error("请配置当前网络的Pyth合约地址或Mock合约");
  }

  // STEP 3: 部署 OracleAggregator (UUPS)
  console.log("\n📄 [STEP 3] 部署预言机聚合合约 (UUPS)...");
  const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
  const oracleAggregatorProxy = await upgrades.deployProxy(OracleAggregator, [pythAddress], {
    initializer: "initialize",
    kind: "uups",
    timeout: 300000,
    pollingInterval: 5000,
  });
  await oracleAggregatorProxy.waitForDeployment();
  console.log("✅ 预言机聚合合约部署完成:", await oracleAggregatorProxy.getAddress());

  // STEP 4: 部署 StockToken 实现
  console.log("\n📄 [STEP 4] 部署 StockToken 实现合约...");
  const StockToken = await ethers.getContractFactory("StockToken");
  const stockTokenImplementation = await StockToken.deploy();
  await stockTokenImplementation.waitForDeployment();
  console.log("✅ StockToken 实现合约部署完成:", await stockTokenImplementation.getAddress());

  // STEP 5: 部署 TokenFactory (UUPS)
  console.log("\n📄 [STEP 5] 部署代币工厂合约 (UUPS)...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactoryProxy = await upgrades.deployProxy(TokenFactory, [
    await oracleAggregatorProxy.getAddress(),
    await stockTokenImplementation.getAddress(),
    await usdtToken.getAddress()
  ], {
    initializer: "initialize",
    kind: "uups",
    timeout: 300000,
    pollingInterval: 5000,
  });
  await tokenFactoryProxy.waitForDeployment();
  console.log("✅ 代币工厂合约部署完成:", await tokenFactoryProxy.getAddress());

  // STEP 6: 设置价格源
  console.log("\n📄 [STEP 6] 设置预言机价格源...");
  const oracleContract = OracleAggregator.attach(await oracleAggregatorProxy.getAddress());
  await oracleContract.batchSetFeedIds(Object.keys(FEED_IDS), Object.values(FEED_IDS));
  console.log("✅ 价格源设置完成");

  // STEP 7: 创建测试股票代币
  console.log("\n📄 [STEP 7] 创建测试股票代币...");
  const tokenFactoryContract = TokenFactory.attach(await tokenFactoryProxy.getAddress());
  const testTokens = [
    { name: "Apple Inc Stock Token", symbol: "AAPL", supply: ethers.parseEther("1000000") },
    { name: "Tesla Inc Stock Token", symbol: "TSLA", supply: ethers.parseEther("500000") },
    { name: "Google Stock Token", symbol: "GOOGL", supply: ethers.parseEther("300000") },
    { name: "Microsoft Stock Token", symbol: "MSFT", supply: ethers.parseEther("400000") },
    { name: "Amazon Stock Token", symbol: "AMZN", supply: ethers.parseEther("200000") },
    { name: "NVIDIA Stock Token", symbol: "NVDA", supply: ethers.parseEther("600000") }
  ];

  const stockTokenAddresses = {};
  for (const token of testTokens) {
    try {
      const tx = await tokenFactoryContract.createToken(token.name, token.symbol, token.supply);
      await tx.wait();
      const tokenAddress = await tokenFactoryContract.getTokenAddress(token.symbol);
      stockTokenAddresses[token.symbol] = tokenAddress;
      console.log(`   ✅ ${token.symbol} 代币创建成功: ${tokenAddress}`);
    } catch (e) {
      console.log(`   ⚠️ ${token.symbol} 创建失败或已存在:`, e.message);
      // 如果代币已存在，获取地址
      try {
        const tokenAddress = await tokenFactoryContract.getTokenAddress(token.symbol);
        stockTokenAddresses[token.symbol] = tokenAddress;
        console.log(`   ℹ️ ${token.symbol} 已存在地址: ${tokenAddress}`);
      } catch (getError) {
        console.log(`   ❌ 无法获取 ${token.symbol} 地址:`, getError.message);
      }
    }
  }

  // STEP 8: 给测试账户分配 USDT
  console.log("\n📄 [STEP 8] 给测试账户分配 USDT...");
  const usdtContract = MockERC20.attach(await usdtToken.getAddress());
  const testAmount = ethers.parseUnits("10000", 6);
  for (let i = 1; i < Math.min(accounts.length, 4); i++) {
    await usdtContract.mint(await accounts[i].getAddress(), testAmount);
    console.log(`   ✅ 给账户 ${await accounts[i].getAddress()} 分配 ${ethers.formatUnits(testAmount, 6)} USDT`);
  }

  // STEP 9: 输出部署摘要
  console.log("\n🎉 [部署完成] 币股池系统部署摘要:");
  console.log("==================================================");
  console.log(`📝 部署者:                ${await deployer.getAddress()}`);
  console.log(`💰 USDT 代币:             ${await usdtToken.getAddress()}`);
  console.log(`🔮 预言机聚合器:           ${await oracleAggregatorProxy.getAddress()}`);
  console.log(`📜 StockToken 实现:        ${await stockTokenImplementation.getAddress()}`);
  console.log(`🏭 代币工厂:              ${await tokenFactoryProxy.getAddress()}`);
  console.log("==================================================");
  for (const token of testTokens) {
    const tokenAddress = await tokenFactoryContract.getTokenAddress(token.symbol);
    console.log(`   ${token.symbol}: ${tokenAddress}`);
  }
  console.log("\n🔮 已配置的价格源:");
  for (const symbol of Object.keys(FEED_IDS)) {
    console.log(`   ${symbol}: ${FEED_IDS[symbol]}`);
  }
  
  // 只在 Sepolia 网络保存部署信息到文件
  if (network.name === "sepolia") {
    const deploymentData = {
      network: network.name,
      chainId: "11155111", // Sepolia chain ID
      deployer: await deployer.getAddress(),
      contracts: {
        OracleAggregator: {
          proxy: await oracleAggregatorProxy.getAddress(),
          implementation: await upgrades.erc1967.getImplementationAddress(await oracleAggregatorProxy.getAddress())
        },
        TokenFactory: {
          proxy: await tokenFactoryProxy.getAddress(),
          implementation: await upgrades.erc1967.getImplementationAddress(await tokenFactoryProxy.getAddress())
        },
        StockTokenImplementation: await stockTokenImplementation.getAddress(),
        USDT: await usdtToken.getAddress()
      },
      stockTokens: stockTokenAddresses,
      priceFeeds: FEED_IDS,
      timestamp: new Date().toISOString()
    };
    
    const fs = require('fs');
    const deploymentFile = `deployments-uups-${network.name}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log(`📄 部署信息已保存到: ${deploymentFile}`);

    // STEP 10: 验证合约到Etherscan
    console.log("\n🔍 [开始验证] 正在验证合约到Etherscan...");
    try {
      // 等待几个区块确认
      console.log("⏳ 等待区块确认...");
      await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒

      // 验证USDT代币合约
      console.log("🔍 验证USDT代币合约...");
      try {
        await hre.run("verify:verify", {
          address: await usdtToken.getAddress(),
          constructorArguments: ["USD Tether", "USDT", 6]
        });
        console.log("✅ USDT代币合约验证成功");
      } catch (error) {
        console.log("⚠️ USDT代币合约验证跳过 (可能已验证):", error.message);
      }

      // 验证StockToken实现合约
      console.log("🔍 验证StockToken实现合约...");
      try {
        await hre.run("verify:verify", {
          address: await stockTokenImplementation.getAddress(),
          constructorArguments: []
        });
        console.log("✅ StockToken实现合约验证成功");
      } catch (error) {
        console.log("⚠️ StockToken实现合约验证跳过 (可能已验证):", error.message);
      }

      // 验证OracleAggregator实现合约
      console.log("🔍 验证OracleAggregator实现合约...");
      try {
        const oracleImplementationAddress = await upgrades.erc1967.getImplementationAddress(await oracleAggregatorProxy.getAddress());
        await hre.run("verify:verify", {
          address: oracleImplementationAddress,
          constructorArguments: []
        });
        console.log("✅ OracleAggregator实现合约验证成功");
      } catch (error) {
        console.log("⚠️ OracleAggregator实现合约验证跳过 (可能已验证):", error.message);
      }

      // 验证TokenFactory实现合约
      console.log("🔍 验证TokenFactory实现合约...");
      try {
        const factoryImplementationAddress = await upgrades.erc1967.getImplementationAddress(await tokenFactoryProxy.getAddress());
        await hre.run("verify:verify", {
          address: factoryImplementationAddress,
          constructorArguments: []
        });
        console.log("✅ TokenFactory实现合约验证成功");
      } catch (error) {
        console.log("⚠️ TokenFactory实现合约验证跳过 (可能已验证):", error.message);
      }

      // 验证代理合约 (注意: OpenZeppelin 代理合约通常已经在Etherscan验证)
      console.log("🔍 验证代理合约...");
      try {
        // OracleAggregator代理
        await hre.run("verify:verify", {
          address: await oracleAggregatorProxy.getAddress()
        });
        console.log("✅ OracleAggregator代理合约验证成功");
      } catch (error) {
        console.log("⚠️ OracleAggregator代理合约验证跳过:", error.message);
      }

      try {
        // TokenFactory代理
        await hre.run("verify:verify", {
          address: await tokenFactoryProxy.getAddress()
        });
        console.log("✅ TokenFactory代理合约验证成功");
      } catch (error) {
        console.log("⚠️ TokenFactory代理合约验证跳过:", error.message);
      }

      // 验证6种股票代币合约
      console.log("🔍 验证股票代币合约...");
      for (const [symbol, address] of Object.entries(stockTokenAddresses)) {
        try {
          console.log(`🔍 验证 ${symbol} 代币合约...`);
          // 股票代币是通过工厂创建的clone，构造参数为空
          await hre.run("verify:verify", {
            address: address,
            constructorArguments: []
          });
          console.log(`✅ ${symbol} 代币合约验证成功`);
        } catch (error) {
          console.log(`⚠️ ${symbol} 代币合约验证跳过 (可能已验证):`, error.message);
        }
      }

      console.log("\n✅ [验证完成] 合约验证已完成!");
    } catch (error) {
      console.log("⚠️ [验证警告] 合约验证过程中出现问题:", error.message);
      console.log("💡 提示: 您可以稍后手动验证合约");
    }
  }
  
  console.log("\n✨ 系统已就绪，可以开始测试！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });
