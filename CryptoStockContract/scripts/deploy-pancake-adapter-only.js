const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 PancakeSwap 适配器脚本 (复用已有基础设施)
 * 包括: PancakeAdapter, MockPancakePool, MockPancakeToken
 * 复用: DefiAggregator, MockERC20_USDT (从基础设施部署文件读取)
 * 使用方法: npx hardhat run scripts/deploy-pancake-adapter-only.js --network <network>
 */

// ABI 提取函数
async function extractABIFiles() {
  console.log("\n🔧 [ABI提取] 开始提取ABI文件...");
  
  // 适配器合约
  const adapterContracts = [
    'PancakeAdapter'
  ];

  // Mock合约
  const mockContracts = [
    'MockPancakeRouter'  // 实际部署的是 MockPancakeRouter，CAKE 代币使用基础设施的 MockERC20
  ];

  // 创建abi输出目录
  const abiDir = path.join(__dirname, '..', 'abi');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
    console.log('✅ 创建ABI目录:', abiDir);
  }

  let successCount = 0;
  let failCount = 0;

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
  console.log("🚀 开始部署 PancakeSwap 适配器...\n");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log("📋 部署信息:");
  console.log("   部署者地址:", deployer.address);
  console.log("   网络:", networkName);
  console.log("   Chain ID:", network.chainId.toString());
  
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("   部署者余额:", ethers.formatEther(deployerBalance), "ETH\n");
  
  try {
    // STEP 1: 读取基础设施部署信息
    console.log("📄 [STEP 1] 读取基础设施部署信息...");
    const infrastructureFile = `deployments-defi-infrastructure-${networkName}.json`;
    
    if (!fs.existsSync(infrastructureFile)) {
      throw new Error(`基础设施部署文件未找到: ${infrastructureFile}\\n请先运行: npx hardhat run scripts/deploy-defi-infrastructure.js --network ${networkName}`);
    }
    
    const infrastructureData = JSON.parse(fs.readFileSync(infrastructureFile, 'utf8'));
    console.log("✅ 成功读取基础设施部署信息");
    console.log("   DefiAggregator:", infrastructureData.contracts.DefiAggregator);
    console.log("   USDT Token:", infrastructureData.contracts.MockERC20_USDT);
    
    // 连接到已部署的合约
    const defiAggregator = await ethers.getContractAt("DefiAggregator", infrastructureData.contracts.DefiAggregator);
    const usdtToken = await ethers.getContractAt("MockERC20", infrastructureData.contracts.MockERC20_USDT);
    
    const usdtAddress = infrastructureData.contracts.MockERC20_USDT;
    const deploymentAddresses = {
      // 复用的合约
      DefiAggregator: infrastructureData.contracts.DefiAggregator,
      MockERC20_USDT: infrastructureData.contracts.MockERC20_USDT,
      // 新部署的合约将添加到这里
    };

    // STEP 2: 部署 MockERC20 作为 CAKE 代币
    console.log("\n📄 [STEP 2] 部署 MockERC20 作为 CAKE 代币...");
    const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
    const mockCakeToken = await MockERC20.deploy(
      "PancakeSwap Token",  // name
      "CAKE",               // symbol
      18                    // decimals
    );
    await mockCakeToken.waitForDeployment();
    const mockCakeTokenAddress = await mockCakeToken.getAddress();
    console.log("✅ MockERC20 (CAKE代币) 部署完成:", mockCakeTokenAddress);
    deploymentAddresses.MockCakeToken = mockCakeTokenAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 3: 部署 MockPancakeRouter
    console.log("\n📄 [STEP 3] 部署 MockPancakeRouter...");
    const MockPancakeRouter = await ethers.getContractFactory("contracts/mock/MockPancakeRouter.sol:MockPancakeRouter");
    const mockPancakeRouter = await MockPancakeRouter.deploy(
      deployer.address,        // factory (临时使用 deployer 地址)
      deployer.address         // WETH (临时使用 deployer 地址)
    );
    await mockPancakeRouter.waitForDeployment();
    const mockPancakeRouterAddress = await mockPancakeRouter.getAddress();
    console.log("✅ MockPancakeRouter 部署完成:", mockPancakeRouterAddress);
    deploymentAddresses.MockPancakeRouter = mockPancakeRouterAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 4: 设置 Router 的交换比率
    console.log("\n📄 [STEP 4] 设置 Router 的交换比率...");
    try {
      const setRateTx = await mockPancakeRouter.setExchangeRate(
        usdtAddress,           // USDT
        mockCakeTokenAddress,  // CAKE
        5000                   // 1 USDT = 0.5 CAKE (基于10000基点)
      );
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待设置交易确认...");
        await setRateTx.wait(2);
      } else {
        await setRateTx.wait();
      }
      
      console.log("✅ USDT <-> CAKE 交换比率已设置 (1 USDT = 0.5 CAKE)");
    } catch (error) {
      console.log("⚠️  设置交换比率遇到问题，跳过此步骤:", error.message);
    }

    // STEP 5: 部署可升级的 PancakeAdapter
    console.log("\n📄 [STEP 5] 部署 PancakeAdapter (可升级)...");
    const PancakeAdapter = await ethers.getContractFactory("PancakeAdapter");
    
    console.log("   初始化参数:");
    console.log("   - Pancake Router:", mockPancakeRouterAddress);
    
    const pancakeAdapter = await upgrades.deployProxy(
      PancakeAdapter,
      [
        mockPancakeRouterAddress  // _pancakeRouter
      ],
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    
    await pancakeAdapter.waitForDeployment();
    const pancakeAdapterAddress = await pancakeAdapter.getAddress();
    console.log("✅ PancakeAdapter 代理合约部署完成:", pancakeAdapterAddress);
    deploymentAddresses.PancakeAdapter = pancakeAdapterAddress;
    
    // 获取实现合约地址
    const pancakeImplementationAddress = await upgrades.erc1967.getImplementationAddress(pancakeAdapterAddress);
    console.log("   实现合约地址:", pancakeImplementationAddress);
    deploymentAddresses.PancakeAdapter_Implementation = pancakeImplementationAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 6: 验证 PancakeAdapter 配置
    console.log("\n📄 [STEP 6] 验证 PancakeAdapter 配置...");
    
    const pancakeRouterInAdapter = await pancakeAdapter.pancakeRouter();
    const adapterName = await pancakeAdapter.getAdapterName();
    const adapterVersion = await pancakeAdapter.getAdapterVersion();
    
    console.log("   PancakeAdapter 配置验证:");
    console.log("   - Pancake Router:", pancakeRouterInAdapter, pancakeRouterInAdapter === mockPancakeRouterAddress ? "✅" : "❌");
    console.log("   - Adapter Name:", adapterName);
    console.log("   - Adapter Version:", adapterVersion);

    // STEP 7: 注册适配器到 DefiAggregator
    console.log("\n📄 [STEP 7] 注册适配器到 DefiAggregator...");
    
    // 检查适配器是否已经存在
    const adapterExists = await defiAggregator.hasAdapter("pancake");
    if (adapterExists) {
      console.log("⚠️  适配器 'pancake' 已存在，先注销旧适配器...");
      const removeTx = await defiAggregator.removeAdapter("pancake");
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待注销交易确认...");
        await removeTx.wait(2);
      } else {
        await removeTx.wait();
      }
      console.log("✅ 旧适配器已注销");
    }
    
    // 注册新适配器
    console.log("📝 注册新适配器...");
    const registerTx = await defiAggregator.registerAdapter("pancake", pancakeAdapterAddress);
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待注册交易确认...");
      await registerTx.wait(2);
    } else {
      await registerTx.wait();
    }
    
    console.log("✅ PancakeAdapter 已注册到 DefiAggregator (名称: pancake)");

    // STEP 8: 验证最终配置
    console.log("\n📄 [STEP 8] 验证最终配置...");
    
    const hasPancakeAdapter = await defiAggregator.hasAdapter("pancake");
    const pancakeAdapterFromAggregator = await defiAggregator.getAdapter("pancake");
    
    console.log("   DefiAggregator 最终验证:");
    console.log("   - Has Pancake Adapter:", hasPancakeAdapter ? "✅" : "❌");
    console.log("   - Pancake Adapter Address:", pancakeAdapterFromAggregator, pancakeAdapterFromAggregator === pancakeAdapterAddress ? "✅" : "❌");

    // STEP 9: 给 MockPancakeRouter 提供流动性
    console.log("\n📄 [STEP 9] 给 MockPancakeRouter 提供流动性...");
    
    try {
      const liquidityAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      const cakeAmount = ethers.parseUnits("5000", 18); // 5,000 CAKE (1 USDT = 0.5 CAKE)
      
      // 给 Router 提供 USDT 和 CAKE 流动性
      const mintUsdtTx = await usdtToken.mint(mockPancakeRouterAddress, liquidityAmount);
      const mintCakeTx = await mockCakeToken.mint(mockPancakeRouterAddress, cakeAmount);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待铸造交易确认...");
        await mintUsdtTx.wait(2);
        await mintCakeTx.wait(2);
      } else {
        await mintUsdtTx.wait();
        await mintCakeTx.wait();
      }
      
      console.log("✅ 向 MockPancakeRouter 提供 10,000 USDT 和 5,000 CAKE 流动性");
    } catch (error) {
      console.log("⚠️  流动性提供遇到问题，跳过此步骤:", error.message);
      console.log("   部署仍然成功，可以后续手动添加流动性");
    }

    // STEP 10: 验证合约到Etherscan (仅Sepolia网络)
    if (networkName === "sepolia") {
      console.log("\n🔍 [开始验证] 正在验证合约到Etherscan...");
      try {
        // 等待几个区块确认
        console.log("⏳ 等待区块确认...");
        await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒

        // 验证MockPancakePool合约
        console.log("🔍 验证MockPancakePool合约...");
        try {
          await hre.run("verify:verify", {
            address: mockPancakePoolAddress,
            constructorArguments: []
          });
          console.log("✅ MockPancakePool合约验证成功");
        } catch (error) {
          console.log("⚠️ MockPancakePool合约验证跳过 (可能已验证):", error.message);
        }

        // 验证MockPancakeToken合约
        console.log("🔍 验证MockPancakeToken合约...");
        try {
          await hre.run("verify:verify", {
            address: mockPancakeTokenAddress,
            constructorArguments: [mockPancakePoolAddress]
          });
          console.log("✅ MockPancakeToken合约验证成功");
        } catch (error) {
          console.log("⚠️ MockPancakeToken合约验证跳过 (可能已验证):", error.message);
        }

        // 验证PancakeAdapter实现合约
        console.log("🔍 验证PancakeAdapter实现合约...");
        try {
          const pancakeImplementationAddress = await upgrades.erc1967.getImplementationAddress(pancakeAdapterAddress);
          await hre.run("verify:verify", {
            address: pancakeImplementationAddress,
            constructorArguments: []
          });
          console.log("✅ PancakeAdapter实现合约验证成功");
        } catch (error) {
          console.log("⚠️ PancakeAdapter实现合约验证跳过 (可能已验证):", error.message);
        }

        // 验证PancakeAdapter代理合约
        console.log("🔍 验证PancakeAdapter代理合约...");
        try {
          await hre.run("verify:verify", {
            address: pancakeAdapterAddress
          });
          console.log("✅ PancakeAdapter代理合约验证成功");
        } catch (error) {
          console.log("⚠️ PancakeAdapter代理合约验证跳过:", error.message);
        }

        console.log("\n✅ [验证完成] Pancake适配器合约验证已完成!");
      } catch (error) {
        console.log("⚠️ [验证警告] 合约验证过程中出现问题:", error.message);
        console.log("💡 提示: 您可以稍后手动验证合约");
      }
    }
    
    // STEP 11: 提取ABI文件
    await extractABIFiles();

    // STEP 12: 保存部署结果
    console.log("\n📄 [STEP 12] 保存部署结果...");
    
    const deploymentFile = `deployments-pancake-adapter-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      feeRateBps: infrastructureData.feeRateBps,
      basedOn: infrastructureFile,
      contracts: deploymentAddresses,
      adapterRegistrations: {
        "pancake": pancakeAdapterAddress
      },
      notes: {
        description: "PancakeSwap适配器部署，复用了基础设施合约",
        reusedContracts: [
          "DefiAggregator",
          "MockERC20_USDT"
        ],
        newContracts: [
          "MockCakeToken",
          "MockPancakeRouter",
          "PancakeAdapter"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    console.log("\n🎉 PancakeSwap 适配器部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n📝 使用方法:");
    console.log("   - 通过 DefiAggregator 调用 executeOperation 使用 'pancake' 适配器");
    console.log("   - 支持流动性提供和移除操作");
    console.log("   - USDT 代币地址:", usdtAddress);
    
    return {
      deploymentAddresses,
      deploymentData,
      deploymentFile
    };
    
  } catch (error) {
    console.error("\n❌ 部署失败:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// 当直接运行此脚本时执行
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
