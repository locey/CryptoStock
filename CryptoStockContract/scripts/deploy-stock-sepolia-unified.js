// 股票代币系统 Sepolia 网络部署脚本 (统一预言机架构)
// 直接用 npx hardhat run scripts/deploy-stock-sepolia-unified.js --network sepolia 执行

const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

const PYTH_SEPOLIA_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21";
const FEED_IDS = {
  "AAPL": "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  "TSLA": "0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2",
  "GOOGL": "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
  "MSFT": "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  "AMZN": "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  "NVDA": "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"
};

// 预言机权重配置
const ORACLE_WEIGHTS = {
  PYTH: 60,      // Pyth 占 60%
  REDSTONE: 40   // RedStone 占 40%
};

// OracleType 枚举值
const ORACLE_TYPES = {
  PYTH: 0,       // OracleType.PYTH
  REDSTONE: 1    // OracleType.REDSTONE
};

// ABI 提取函数
async function extractABIFiles() {
  console.log("\n🔧 [ABI提取] 开始提取ABI文件...");
  
  // 需要提取ABI的合约列表 (更新为统一预言机架构)
  const contracts = [
    'StockToken',
    'StockTokenV2', 
    'TokenFactory',
    'TokenFactoryV2',
    'PriceAggregator',  // 新的聚合器
    'CSToken',
    'DefiAggregator'
  ];

  // 预言机相关合约
  const oracleContracts = [
    'PythPriceFeed',
    'RedstonePriceFeed'
  ];

  // Mock合约
  const mockContracts = [
    'MockERC20',
    'MockPyth',
    'MockRedStoneOracle',  // 新增
    'MockAavePool',
    'MockAToken'
  ];

  // 适配器合约
  const adapterContracts = [
    'AaveAdapter'
  ];

  // 创建abi输出目录
  const abiDir = path.join(__dirname, '..', 'abi');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
    console.log('✅ 创建ABI目录:', abiDir);
  }

  let successCount = 0;
  let failCount = 0;

  // 处理普通合约
  for (const contractName of contracts) {
    try {
      const artifactPath = path.join(
        __dirname, 
        '..', 
        'artifacts', 
        'contracts', 
        `${contractName}.sol`, 
        `${contractName}.json`
      );
      
      processContract(contractName, artifactPath, abiDir);
      successCount++;
      
    } catch (error) {
      console.log(`❌ 提取失败 ${contractName}:`, error.message);
      failCount++;
    }
  }

  // 处理预言机合约
  for (const contractName of oracleContracts) {
    try {
      const artifactPath = path.join(
        __dirname, 
        '..', 
        'artifacts', 
        'contracts',
        'feeds', 
        `${contractName}.sol`, 
        `${contractName}.json`
      );
      
      processContract(contractName, artifactPath, abiDir);
      successCount++;
      
    } catch (error) {
      console.log(`❌ 提取失败 ${contractName}:`, error.message);
      failCount++;
    }
  }

  // 处理mock合约
  for (const contractName of mockContracts) {
    try {
      const artifactPath = path.join(
        __dirname, 
        '..', 
        'artifacts', 
        'contracts',
        'mock', 
        `${contractName}.sol`, 
        `${contractName}.json`
      );
      
      processContract(contractName, artifactPath, abiDir);
      successCount++;
      
    } catch (error) {
      console.log(`❌ 提取失败 ${contractName}:`, error.message);
      failCount++;
    }
  }

  // 处理适配器合约
  for (const contractName of adapterContracts) {
    try {
      const artifactPath = path.join(
        __dirname, 
        '..', 
        'artifacts', 
        'contracts',
        'adapters', 
        `${contractName}.sol`, 
        `${contractName}.json`
      );
      
      processContract(contractName, artifactPath, abiDir);
      successCount++;
      
    } catch (error) {
      console.log(`❌ 提取失败 ${contractName}:`, error.message);
      failCount++;
    }
  }

  console.log(`📊 ABI提取完成:`);
  console.log(`   成功: ${successCount} 个合约`);
  console.log(`   失败: ${failCount} 个合约`);
  console.log(`   输出目录: ${abiDir}`);
}

function processContract(contractName, artifactPath, abiDir) {
  // 检查文件是否存在
  if (!fs.existsSync(artifactPath)) {
    console.log(`⚠️  跳过 ${contractName}: artifact文件不存在`);
    throw new Error(`Artifact not found: ${artifactPath}`);
  }
  
  // 读取artifact文件
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  // 提取ABI
  const abi = artifact.abi;
  
  // 创建输出文件路径
  const abiPath = path.join(abiDir, `${contractName}.abi`);
  
  // 写入ABI文件 (格式化JSON)
  fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
  
  console.log(`✅ 成功提取: ${contractName}.abi`);
}

async function main() {
  const [deployer, ...accounts] = await ethers.getSigners();
  console.log("🚀 部署币股池系统合约 (使用已部署的统一预言机)...");
  console.log("📝 部署者地址:", await deployer.getAddress());

  // STEP 0: 读取已部署的预言机合约地址
  console.log("\n📄 [STEP 0] 读取已部署的预言机合约地址...");
  const deploymentFilePath = path.join(__dirname, "..", "deployments-unified-oracle-sepolia.json");
  
  if (!fs.existsSync(deploymentFilePath)) {
    throw new Error("❌ 找不到预言机部署信息文件，请先运行 deploy-unified-oracle.js");
  }
  
  const oracleDeploymentInfo = JSON.parse(fs.readFileSync(deploymentFilePath, "utf8"));
  const priceAggregatorAddress = oracleDeploymentInfo.contracts.priceAggregator.address;
  
  console.log("✅ 读取预言机合约地址成功:");
  console.log(`   PriceAggregator:    ${priceAggregatorAddress}`);
  console.log(`   部署时间:           ${oracleDeploymentInfo.metadata.deployTime}`);
  console.log(`   支持股票:           ${oracleDeploymentInfo.contracts.pythPriceFeed.supportedSymbols.join(", ")}`);

  // STEP 1: 部署 USDT
  console.log("\n📄 [STEP 1] 部署模拟 USDT 代币...");
  const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
  const usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
  await usdtToken.waitForDeployment();
  console.log("✅ USDT 代币部署完成:", await usdtToken.getAddress());

  // STEP 2: 部署 StockToken 实现
  console.log("\n📄 [STEP 2] 部署 StockToken 实现合约...");
  const StockToken = await ethers.getContractFactory("StockToken");
  const stockTokenImplementation = await StockToken.deploy();
  await stockTokenImplementation.waitForDeployment();
  console.log("✅ StockToken 实现合约部署完成:", await stockTokenImplementation.getAddress());

  // STEP 3: 部署 TokenFactory (UUPS) - 使用已部署的 PriceAggregator
  console.log("\n📄 [STEP 3] 部署代币工厂合约 (UUPS)...");
  const TokenFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactoryProxy = await upgrades.deployProxy(TokenFactory, [
    priceAggregatorAddress,  // 使用已部署的 PriceAggregator 地址
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

  // STEP 4: 创建测试股票代币
  console.log("\n📄 [STEP 4] 创建测试股票代币...");
  
  const stockConfigs = [
    { symbol: "AAPL", name: "Apple Inc Stock Token", supply: ethers.parseEther("1000000") },
    { symbol: "TSLA", name: "Tesla Inc Stock Token", supply: ethers.parseEther("500000") },
    { symbol: "GOOGL", name: "Google Stock Token", supply: ethers.parseEther("300000") },
    { symbol: "MSFT", name: "Microsoft Stock Token", supply: ethers.parseEther("400000") },
    { symbol: "AMZN", name: "Amazon Stock Token", supply: ethers.parseEther("200000") },
    { symbol: "NVDA", name: "NVIDIA Stock Token", supply: ethers.parseEther("600000") }
  ];
  
  console.log(`要创建 ${stockConfigs.length} 个股票代币...`);

  const stockTokenAddresses = {};
  for (let i = 0; i < stockConfigs.length; i++) {
    const config = stockConfigs[i];
    console.log(`\n📈 [${i + 1}/${stockConfigs.length}] 创建 ${config.symbol} 股票代币...`);
    
    try {
      const tx = await tokenFactoryProxy.createToken(config.name, config.symbol, config.supply);
      console.log(`${config.symbol} 交易哈希:`, tx.hash);
      await tx.wait();
      console.log(`✅ ${config.symbol} 股票代币创建成功`);
      
      // 获取并显示代币地址
      const tokenAddress = await tokenFactoryProxy.getTokenAddress(config.symbol);
      stockTokenAddresses[config.symbol] = tokenAddress;
      console.log(`${config.symbol} 代币地址:`, tokenAddress);
      
      // 🔥 关键步骤：向合约注入代币用于交易
      console.log(`💰 为 ${config.symbol} 合约注入交易代币...`);
      const stockTokenContract = await ethers.getContractAt("StockToken", tokenAddress);
      
      // 注入50%的代币到合约中用于交易
      const injectAmount = config.supply / 2n; // 注入一半代币
      await stockTokenContract.injectTokens(injectAmount);
      console.log(`✅ 已向 ${config.symbol} 合约注入 ${ethers.formatEther(injectAmount)} 个代币用于交易`);
      
      // 验证合约余额
      const contractBalance = await stockTokenContract.balanceOf(tokenAddress);
      console.log(`📊 ${config.symbol} 合约代币余额: ${ethers.formatEther(contractBalance)}`);
      
    } catch (error) {
      console.error(`❌ 创建 ${config.symbol} 代币失败:`, error.message);
      // 如果代币已存在，尝试获取地址
      try {
        const tokenAddress = await tokenFactoryProxy.getTokenAddress(config.symbol);
        stockTokenAddresses[config.symbol] = tokenAddress;
        console.log(`ℹ️ ${config.symbol} 已存在地址:`, tokenAddress);
      } catch (getError) {
        console.log(`❌ 无法获取 ${config.symbol} 地址:`, getError.message);
      }
    }
  }

  // STEP 5: 给各个StockToken合约注入USDT用于购买交易
  console.log("\n📄 [STEP 5] 给各个StockToken合约注入USDT...");
  const usdtToInject = ethers.parseUnits("50000", 6); // 每个合约注入50,000 USDT
  
  for (const [symbol, tokenAddress] of Object.entries(stockTokenAddresses)) {
    try {
      console.log(`💰 向 ${symbol} 合约注入 USDT...`);
      await usdtToken.mint(tokenAddress, usdtToInject);
      const contractUsdtBalance = await usdtToken.balanceOf(tokenAddress);
      console.log(`✅ ${symbol} 合约 USDT 余额: ${ethers.formatUnits(contractUsdtBalance, 6)}`);
    } catch (error) {
      console.error(`❌ 向 ${symbol} 注入 USDT 失败:`, error.message);
    }
  }

  // STEP 6: 给测试账户分配 USDT
  console.log("\n📄 [STEP 6] 给测试账户分配 USDT...");
  const usdtContract = MockERC20.attach(await usdtToken.getAddress());
  const testAmount = ethers.parseUnits("10000", 6); // 给每个账户10,000 USDT
  for (let i = 0; i < Math.min(accounts.length, 5); i++) { // 最多给5个账户
    await usdtContract.mint(await accounts[i].getAddress(), testAmount);
    console.log(`   ✅ 给账户 ${await accounts[i].getAddress()} 分配 ${ethers.formatUnits(testAmount, 6)} USDT`);
  }

    // STEP 7: 输出部署摘要
  console.log("\n🎉 [部署完成] 币股池系统部署摘要 (统一预言机架构):");
  console.log("==================================================");
  console.log(`📝 部署者:                ${await deployer.getAddress()}`);
  console.log(`💰 USDT 代币:             ${await usdtToken.getAddress()}`);
  console.log(`🔮 统一预言机系统 (复用已部署):`);
  console.log(`   PriceAggregator:       ${priceAggregatorAddress}`);
  console.log(`📜 StockToken 实现:        ${await stockTokenImplementation.getAddress()}`);
  console.log(`🏭 代币工厂:              ${await tokenFactoryProxy.getAddress()}`);
  console.log("==================================================");
  console.log("📈 股票代币地址:");
  for (const [symbol, address] of Object.entries(stockTokenAddresses)) {
    console.log(`   ${symbol}: ${address}`);
  }
  console.log(`\n🔮 预言机权重配置: Pyth ${ORACLE_WEIGHTS.PYTH}% + RedStone ${ORACLE_WEIGHTS.REDSTONE}%`);
  console.log("\n🔮 已配置的价格源:");
  for (const symbol of Object.keys(FEED_IDS)) {
    console.log(`   ${symbol}: ${FEED_IDS[symbol]}`);
  }
  
  // 保存部署信息到文件
  const deploymentData = {
    network: network.name,
    chainId: "11155111", // Sepolia chain ID
    deployer: await deployer.getAddress(),
    architecture: "统一预言机架构 (复用已部署的预言机)",
    contracts: {
      // 复用的预言机系统
      PriceAggregator: priceAggregatorAddress,
      // 新部署的代币系统
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
  
  const deploymentFile = `deployments-stock-${network.name}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log(`📄 部署信息已保存到: ${deploymentFile}`);

  // STEP 8: 验证合约到Etherscan
  console.log("\n🔍 [开始验证] 正在验证新部署的合约到Etherscan...");
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
  
  // 提取ABI文件
  await extractABIFiles();
  
  console.log("\n✨ 统一预言机架构的币股池系统已就绪，可以开始测试！");
  console.log("🔗 新架构特点:");
  console.log("   • 支持多预言机源 (Pyth + RedStone)");
  console.log("   • 统一的 IPriceFeed 接口");
  console.log("   • 权重聚合价格算法");
  console.log("   • 更高的价格可靠性");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  });