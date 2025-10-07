const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 Aave 适配器脚本 (复用已有基础设施)
 * 包括: AaveAdapter, MockAavePool, MockAToken
 * 复用: DefiAggregator, MockERC20_USDT (从基础设施部署文件读取)
 * 使用方法: npx hardhat run scripts/deploy-aave-adapter-only.js --network <network>
 */

// ABI 提取函数
async function extractABIFiles() {
  console.log("\n🔧 [ABI提取] 开始提取ABI文件...");
  
  // 适配器合约
  const adapterContracts = [
    'AaveAdapter'
  ];

  // Mock合约
  const mockContracts = [
    'MockAavePool',
    'MockAToken'
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
  console.log("🚀 开始部署 Aave 适配器...\n");
  
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

    // STEP 2: 部署 MockAavePool
    console.log("\n📄 [STEP 2] 部署 MockAavePool...");
    const MockAavePool = await ethers.getContractFactory("contracts/mock/MockAavePool.sol:MockAavePool");
    const mockAavePool = await MockAavePool.deploy();
    await mockAavePool.waitForDeployment();
    const mockAavePoolAddress = await mockAavePool.getAddress();
    console.log("✅ MockAavePool 部署完成:", mockAavePoolAddress);
    deploymentAddresses.MockAavePool = mockAavePoolAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 3: 部署 MockAToken (aUSDT)
    console.log("\n📄 [STEP 3] 部署 MockAToken (aUSDT)...");
    const MockAToken = await ethers.getContractFactory("contracts/mock/MockAToken.sol:MockAToken");
    const mockAToken = await MockAToken.deploy(
      "Aave USDT",           // name
      "aUSDT",               // symbol  
      usdtAddress,           // underlying asset (USDT)
      mockAavePoolAddress    // pool address
    );
    await mockAToken.waitForDeployment();
    const mockATokenAddress = await mockAToken.getAddress();
    console.log("✅ MockAToken (aUSDT) 部署完成:", mockATokenAddress);
    deploymentAddresses.MockAToken_aUSDT = mockATokenAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 4: 初始化 Aave Pool 的资产储备
    console.log("\n📄 [STEP 4] 初始化 Aave Pool 储备...");
    const initTx = await mockAavePool.initReserve(usdtAddress, mockATokenAddress);
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待初始化交易确认...");
      await initTx.wait(2); // 等待2个区块确认
    } else {
      await initTx.wait();
    }
    
    console.log("✅ USDT-aUSDT 储备初始化完成");

    // STEP 5: 部署可升级的 AaveAdapter
    console.log("\n📄 [STEP 5] 部署 AaveAdapter (可升级)...");
    const AaveAdapter = await ethers.getContractFactory("AaveAdapter");
    
    console.log("   初始化参数:");
    console.log("   - Aave Pool:", mockAavePoolAddress);
    console.log("   - USDT Token:", usdtAddress);
    console.log("   - aUSDT Token:", mockATokenAddress);
    console.log("   - Owner:", deployer.address);
    
    const aaveAdapter = await upgrades.deployProxy(
      AaveAdapter,
      [
        mockAavePoolAddress,  // _aavePool
        usdtAddress,          // _usdtToken
        mockATokenAddress,    // _aUsdtToken  
        deployer.address      // _owner
      ],
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    
    await aaveAdapter.waitForDeployment();
    const aaveAdapterAddress = await aaveAdapter.getAddress();
    console.log("✅ AaveAdapter 代理合约部署完成:", aaveAdapterAddress);
    deploymentAddresses.AaveAdapter = aaveAdapterAddress;
    
    // 获取实现合约地址
    const aaveImplementationAddress = await upgrades.erc1967.getImplementationAddress(aaveAdapterAddress);
    console.log("   实现合约地址:", aaveImplementationAddress);
    deploymentAddresses.AaveAdapter_Implementation = aaveImplementationAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 6: 验证 AaveAdapter 配置
    console.log("\n📄 [STEP 6] 验证 AaveAdapter 配置...");
    
    // 验证 AaveAdapter 的配置
    const aavePoolInAdapter = await aaveAdapter.aavePool();
    const usdtTokenInAdapter = await aaveAdapter.usdtToken();  
    const aUsdtTokenInAdapter = await aaveAdapter.aUsdtToken();
    
    console.log("   AaveAdapter 配置验证:");
    console.log("   - Aave Pool:", aavePoolInAdapter, aavePoolInAdapter === mockAavePoolAddress ? "✅" : "❌");
    console.log("   - USDT Token:", usdtTokenInAdapter, usdtTokenInAdapter === usdtAddress ? "✅" : "❌");
    console.log("   - aUSDT Token:", aUsdtTokenInAdapter, aUsdtTokenInAdapter === mockATokenAddress ? "✅" : "❌");

    // STEP 7: 注册适配器到 DefiAggregator
    console.log("\n📄 [STEP 7] 注册适配器到 DefiAggregator...");
    
    // 检查适配器是否已经存在
    const adapterExists = await defiAggregator.hasAdapter("aave");
    if (adapterExists) {
      console.log("⚠️  适配器 'aave' 已存在，先注销旧适配器...");
      const removeTx = await defiAggregator.removeAdapter("aave");
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
    const registerTx = await defiAggregator.registerAdapter("aave", aaveAdapterAddress);
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待注册交易确认...");
      await registerTx.wait(2); // 等待2个区块确认
    } else {
      await registerTx.wait();
    }
    
    console.log("✅ AaveAdapter 已注册到 DefiAggregator (名称: aave)");

    // STEP 8: 验证最终配置
    console.log("\n📄 [STEP 8] 验证最终配置...");
    
    // 验证 DefiAggregator 配置
    const hasAaveAdapter = await defiAggregator.hasAdapter("aave");
    const aaveAdapterFromAggregator = await defiAggregator.getAdapter("aave");
    
    console.log("   DefiAggregator 最终验证:");
    console.log("   - Has Aave Adapter:", hasAaveAdapter ? "✅" : "❌");
    console.log("   - Aave Adapter Address:", aaveAdapterFromAggregator, aaveAdapterFromAggregator === aaveAdapterAddress ? "✅" : "❌");

    // STEP 9: 给 MockAavePool 提供流动性
    console.log("\n📄 [STEP 9] 给 MockAavePool 提供流动性...");
    
    try {
      // 给 MockAavePool 铸造一些 USDT 作为流动性
      const liquidityAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      const mintTx = await usdtToken.mint(mockAavePoolAddress, liquidityAmount);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待铸造交易确认...");
        await mintTx.wait(2);
      } else {
        await mintTx.wait();
      }
      
      console.log("✅ 向 MockAavePool 提供 10,000 USDT 流动性");
      
      // 通过 MockAavePool 的 supply 函数来铸造相应的 aUSDT
      const approveTx = await usdtToken.approve(mockAavePoolAddress, liquidityAmount);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        await approveTx.wait(2);
      } else {
        await approveTx.wait();
      }
      
      const supplyTx = await mockAavePool.supply(usdtAddress, liquidityAmount, mockAavePoolAddress, 0); // 0 是 referralCode
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        await supplyTx.wait(2);
      } else {
        await supplyTx.wait();
      }
      
      console.log("✅ 通过 MockAavePool.supply 获得 10,000 aUSDT 流动性");
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

        // 验证MockAavePool合约
        console.log("🔍 验证MockAavePool合约...");
        try {
          await hre.run("verify:verify", {
            address: mockAavePoolAddress,
            constructorArguments: []
          });
          console.log("✅ MockAavePool合约验证成功");
        } catch (error) {
          console.log("⚠️ MockAavePool合约验证跳过 (可能已验证):", error.message);
        }

        // 验证MockAToken合约
        console.log("🔍 验证MockAToken合约...");
        try {
          await hre.run("verify:verify", {
            address: mockATokenAddress,
            constructorArguments: [
              "Aave USDT",           // name
              "aUSDT",               // symbol  
              usdtAddress,           // underlying asset (USDT)
              mockAavePoolAddress    // pool address
            ]
          });
          console.log("✅ MockAToken合约验证成功");
        } catch (error) {
          console.log("⚠️ MockAToken合约验证跳过 (可能已验证):", error.message);
        }

        // 验证AaveAdapter实现合约
        console.log("🔍 验证AaveAdapter实现合约...");
        try {
          const aaveImplementationAddress = await upgrades.erc1967.getImplementationAddress(aaveAdapterAddress);
          await hre.run("verify:verify", {
            address: aaveImplementationAddress,
            constructorArguments: []
          });
          console.log("✅ AaveAdapter实现合约验证成功");
        } catch (error) {
          console.log("⚠️ AaveAdapter实现合约验证跳过 (可能已验证):", error.message);
        }

        // 验证AaveAdapter代理合约
        console.log("🔍 验证AaveAdapter代理合约...");
        try {
          await hre.run("verify:verify", {
            address: aaveAdapterAddress
          });
          console.log("✅ AaveAdapter代理合约验证成功");
        } catch (error) {
          console.log("⚠️ AaveAdapter代理合约验证跳过:", error.message);
        }

        console.log("\n✅ [验证完成] Aave适配器合约验证已完成!");
      } catch (error) {
        console.log("⚠️ [验证警告] 合约验证过程中出现问题:", error.message);
        console.log("💡 提示: 您可以稍后手动验证合约");
      }
    }
    
    // STEP 11: 提取ABI文件
    await extractABIFiles();

    // STEP 12: 保存部署结果
    console.log("\n📄 [STEP 12] 保存部署结果...");
    
    const deploymentFile = `deployments-aave-adapter-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      feeRateBps: infrastructureData.feeRateBps,
      basedOn: infrastructureFile, // 引用基础设施部署文件
      contracts: deploymentAddresses,
      adapterRegistrations: {
        "aave": aaveAdapterAddress
      },
      notes: {
        description: "Aave适配器部署，复用了基础设施合约",
        reusedContracts: [
          "DefiAggregator",
          "MockERC20_USDT"
        ],
        newContracts: [
          "MockAavePool",
          "MockAToken_aUSDT", 
          "AaveAdapter"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    // 最终总结
    console.log("\n🎉 Aave 适配器部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n📝 使用方法:");
    console.log("   - 通过 DefiAggregator 调用 executeOperation 使用 'aave' 适配器");
    console.log("   - 支持存款和取款操作");
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