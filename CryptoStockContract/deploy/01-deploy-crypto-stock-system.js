module.exports = async ({ getNamedAccounts, deployments, ethers, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🚀 部署币股池系统合约...");
  console.log("📝 部署者地址:", deployer);

  // ============= 第一步：部署基础代币合约 =============
  console.log("\\n📄 [STEP 1] 部署模拟 USDT 代币...");
  const usdtToken = await deploy("MockERC20_USDT", {
    contract: "MockERC20",
    from: deployer,
    args: ["USD Tether", "USDT", 6], // 名称、符号、精度（6位小数）
    log: true,
  });
  console.log("✅ USDT 代币部署完成:", usdtToken.address);

  // ============= 第二步：部署预言机聚合合约 =============
  console.log("\\n📄 [STEP 2] 部署预言机聚合合约...");
  const PYTH_SEPOLIA_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21";
  const FEED_IDS = {
    "AAPL": "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
    "TSLA": "0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2",
    "GOOGL": "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
    "MSFT": "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
    "AMZN": "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
    "NVDA": "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"
  };

  let pythAddress;
  if (network.name === "hardhat" || network.name === "localhost") {
    // 部署 MockPyth 合约
    const mockPyth = await deploy("MockPyth", {
      contract: "MockPyth",
      from: deployer,
      log: true,
    });
    pythAddress = mockPyth.address;
    console.log("✅ MockPyth 部署完成:", pythAddress);

    // 设置本地测试价格
    const mockPythContract = await ethers.getContractAt("MockPyth", pythAddress, await ethers.getSigner(deployer));
    const now = Math.floor(Date.now() / 1000);
    for (const [symbol, feedId] of Object.entries(FEED_IDS)) {
      // 价格100，精度-8，当前时间
      await mockPythContract.setPrice(feedId, 10000, -8, now);
      console.log(`   MockPyth 设置价格: ${symbol} = 100.00`);
    }
  } else if (network.name === "sepolia") {
    pythAddress = PYTH_SEPOLIA_ADDRESS;
    console.log("✅ 使用官方Pyth地址:", pythAddress);
  } else {
    throw new Error("请配置当前网络的Pyth合约地址或Mock合约");
  }

  const oracleAggregator = await deploy("OracleAggregator", {
    from: deployer,
    args: [pythAddress],
    log: true,
  });
  console.log("✅ 预言机聚合合约部署完成:", oracleAggregator.address);  // ============= 第三步：部署 StockToken 实现合约 =============
  console.log("\\n📄 [STEP 3] 部署 StockToken 实现合约...");
  const stockTokenImplementation = await deploy("StockToken_Implementation", {
    contract: "StockToken",
    from: deployer,
    log: true,
  });
  console.log("✅ StockToken 实现合约部署完成:", stockTokenImplementation.address);

  // ============= 第四步：部署代币工厂合约（可升级） =============
  console.log("\\n📄 [STEP 4] 部署代币工厂合约（可升级代理）...");
  const tokenFactory = await deploy("TokenFactory", {
    from: deployer,
    proxy: {
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [
            oracleAggregator.address,
            stockTokenImplementation.address,
            usdtToken.address
          ]
        }
      }
    },
    log: true,
  });
  console.log("✅ 代币工厂合约部署完成:", tokenFactory.address);

  // ============= 第五步：设置预言机价格源 =============
  console.log("\\n📄 [STEP 5] 设置预言机价格源...");
  
  const signer = await ethers.getSigner(deployer);
  const oracleContract = await ethers.getContractAt("OracleAggregator", oracleAggregator.address, signer);
  
  // 批量设置价格源
  const symbols = Object.keys(FEED_IDS);
  const feedIds = Object.values(FEED_IDS);
  
  console.log("📋 设置价格源映射:");
  for (let i = 0; i < symbols.length; i++) {
    console.log(`   ${symbols[i]} -> ${feedIds[i]}`);
  }
  
  await oracleContract.batchSetFeedIds(symbols, feedIds);
  console.log("✅ 价格源设置完成");

  // ============= 第六步：准备测试用的代币 =============
  console.log("\\n📄 [STEP 6] 创建测试代币...");
  
  const tokenFactoryContract = await ethers.getContractAt("TokenFactory", tokenFactory.address, signer);
  
  // 创建几个测试用的股票代币
  const testTokens = [
    {
      name: "Apple Inc Stock Token",
      symbol: "AAPL",
      supply: ethers.utils.parseEther("1000000") // 100万代币
    },
    {
      name: "Tesla Inc Stock Token", 
      symbol: "TSLA",
      supply: ethers.utils.parseEther("500000") // 50万代币
    },
    {
      name: "Google Stock Token",
      symbol: "GOOGL", 
      supply: ethers.utils.parseEther("300000") // 30万代币
    },
    {
      name: "Microsoft Stock Token",
      symbol: "MSFT", 
      supply: ethers.utils.parseEther("400000") // 40万代币
    },
    {
      name: "Amazon Stock Token",
      symbol: "AMZN", 
      supply: ethers.utils.parseEther("200000") // 20万代币
    },
    {
      name: "NVIDIA Stock Token",
      symbol: "NVDA", 
      supply: ethers.utils.parseEther("600000") // 60万代币
    }
  ];

  console.log("📋 创建测试代币:");
  for (const token of testTokens) {
    console.log(`   检查 ${token.name} (${token.symbol})...`);
    
    // 检查代币是否已存在
    try {
      const existingAddress = await tokenFactoryContract.getTokenAddress(token.symbol);
      if (existingAddress !== "0x0000000000000000000000000000000000000000") {
        console.log(`   ⏭️  ${token.symbol} 代币已存在: ${existingAddress}`);
        continue;
      }
    } catch (error) {
      // 代币不存在，继续创建流程
    }
    
    console.log(`   创建 ${token.name} (${token.symbol})...`);
    try {
      await tokenFactoryContract.createToken(
        token.name,
        token.symbol,
        token.supply
      );
      
      const tokenAddress = await tokenFactoryContract.getTokenAddress(token.symbol);
      console.log(`   ✅ ${token.symbol} 代币创建成功: ${tokenAddress}`);
    } catch (error) {
      if (error.message.includes("Token already exists")) {
        console.log(`   ⏭️  ${token.symbol} 代币已存在，跳过创建`);
        // 获取已存在的代币地址
        try {
          const tokenAddress = await tokenFactoryContract.getTokenAddress(token.symbol);
          console.log(`   📍 现有地址: ${tokenAddress}`);
        } catch (getError) {
          console.log(`   ⚠️  无法获取已存在代币的地址`);
        }
      } else {
        console.error(`   ❌ 创建 ${token.symbol} 时发生错误:`, error.message);
        throw error;
      }
    }
  }

  // ============= 第七步：给测试账户分配 USDT =============
  console.log("\\n📄 [STEP 7] 给测试账户分配 USDT...");
  
  const usdtContract = await ethers.getContractAt("MockERC20", usdtToken.address, signer);
  
  // 获取测试账户（假设有多个签名者）
  const accounts = await ethers.getSigners();
  const testAmount = ethers.utils.parseUnits("10000", 6); // 给每个账户 10,000 USDT
  
  for (let i = 1; i < Math.min(accounts.length, 4); i++) { // 给前3个测试账户分配
    await usdtContract.mint(accounts[i].address, testAmount);
    console.log(`   ✅ 给账户 ${accounts[i].address} 分配 ${ethers.utils.formatUnits(testAmount, 6)} USDT`);
  }

  // ============= 第八步：输出部署摘要 =============
  console.log("\\n🎉 [部署完成] 币股池系统部署摘要:");
  console.log("==================================================");
  console.log(`📝 部署者:                ${deployer}`);
  console.log(`💰 USDT 代币:             ${usdtToken.address}`);
  console.log(`🔮 预言机聚合器:           ${oracleAggregator.address}`);
  console.log(`📜 StockTokenV2 实现:       ${stockTokenImplementation.address}`);
  console.log(`🏭 代币工厂:              ${tokenFactory.address}`);
  console.log("==================================================");
  
  console.log("🏷️  已创建的股票代币:");
  for (const token of testTokens) {
    const tokenAddress = await tokenFactoryContract.getTokenAddress(token.symbol);
    console.log(`   ${token.symbol}: ${tokenAddress}`);
  }
  
  console.log("\\n🔮 已配置的价格源:");
  for (const symbol of symbols) {
    console.log(`   ${symbol}: ${FEED_IDS[symbol]}`);
  }
  
  console.log("\\n✨ 系统已就绪，可以开始测试！");

  // ============= 验证部署 =============
  console.log("\\n🔍 [验证] 验证部署状态...");
  
  // 验证代币工厂配置
  const factoryOracle = await tokenFactoryContract.oracleAggregator();
  const factoryImplementation = await tokenFactoryContract.stockTokenImplementation();
  const factoryUSDT = await tokenFactoryContract.usdtTokenAddress();
  
  console.log("📋 代币工厂配置验证:");
  console.log(`   预言机地址: ${factoryOracle === oracleAggregator.address ? '✅' : '❌'} ${factoryOracle}`);
  console.log(`   实现合约: ${factoryImplementation === stockTokenImplementation.address ? '✅' : '❌'} ${factoryImplementation}`);
  console.log(`   USDT地址: ${factoryUSDT === usdtToken.address ? '✅' : '❌'} ${factoryUSDT}`);
  
  // 验证代币创建
  const allTokens = await tokenFactoryContract.getAllTokens();
  console.log(`\\n📊 已创建代币数量: ${allTokens.length}`);
  
  // 验证价格源
  const supportedSymbols = await oracleContract.getSupportedSymbols();
  console.log(`🔮 支持的价格源: ${supportedSymbols.length} 个`);
  
  console.log("\\n🎯 部署验证完成！所有组件正常工作。");
};

module.exports.tags = ["CryptoStockSystem", "TokenFactory", "OracleAggregator", "MockERC20"];
module.exports.dependencies = [];