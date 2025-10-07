const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 YearnV3 适配器脚本 (复用已有基础设施)
 * 包括: YearnV3Adapter, MockYearnVault, MockYearnStrategy
 * 复用: DefiAggregator, MockERC20_USDT (从基础设施部署文件读取)
 * 使用方法: npx hardhat run scripts/deploy-yearnv3-adapter-only.js --network <network>
 */

// ABI 提取函数
async function extractABIFiles() {
  console.log("\n🔧 [ABI提取] 开始提取ABI文件...");
  
  // 适配器合约
  const adapterContracts = [
    'YearnV3Adapter'
  ];

  // Mock合约
  const mockContracts = [
    'MockYearnV3Vault'  // 实际的文件名和合约名
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
      let artifactPath;
      
      // 特殊处理：MockYearnV3Vault 合约在 MockYearnV3Vault.sol 文件中
      if (contractName === 'MockYearnV3Vault') {
        artifactPath = path.join(
          __dirname, 
          '..', 
          'artifacts', 
          'contracts',
          'mock', 
          'MockYearnV3Vault.sol', 
          'MockYearnV3Vault.json'
        );
      } else {
        artifactPath = path.join(
          __dirname, 
          '..', 
          'artifacts', 
          'contracts',
          'mock', 
          `${contractName}.sol`, 
          `${contractName}.json`
        );
      }
      
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
  console.log("🚀 开始部署 YearnV3 适配器...\n");
  
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

    // STEP 2: 部署 MockYearnV3Vault
    console.log("\n📄 [STEP 2] 部署 MockYearnV3Vault...");
    const MockYearnV3Vault = await ethers.getContractFactory("contracts/mock/MockYearnV3Vault.sol:MockYearnV3Vault");
    const mockYearnV3Vault = await MockYearnV3Vault.deploy(
      usdtAddress,           // underlying asset (USDT)
      "Yearn USDT Vault V3", // name
      "yvUSDT-V3"           // symbol
    );
    await mockYearnV3Vault.waitForDeployment();
    const mockYearnV3VaultAddress = await mockYearnV3Vault.getAddress();
    console.log("✅ MockYearnV3Vault 部署完成:", mockYearnV3VaultAddress);
    deploymentAddresses.MockYearnV3Vault = mockYearnV3VaultAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log("✅ MockYearnV3Vault 部署完成，跳过策略部署 (已集成)");

    // STEP 3: 部署可升级的 YearnV3Adapter
    console.log("\n📄 [STEP 3] 部署 YearnV3Adapter (可升级)...");
    const YearnV3Adapter = await ethers.getContractFactory("YearnV3Adapter");
    
    console.log("   初始化参数:");
    console.log("   - Yearn Vault:", mockYearnV3VaultAddress);
    console.log("   - Underlying Token:", usdtAddress);
    console.log("   - Owner:", deployer.address);
    
    const yearnV3Adapter = await upgrades.deployProxy(
      YearnV3Adapter,
      [
        mockYearnV3VaultAddress, // _yearnVault
        usdtAddress,             // _underlyingToken
        deployer.address         // _owner
      ],
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    
    await yearnV3Adapter.waitForDeployment();
    const yearnV3AdapterAddress = await yearnV3Adapter.getAddress();
    console.log("✅ YearnV3Adapter 代理合约部署完成:", yearnV3AdapterAddress);
    deploymentAddresses.YearnV3Adapter = yearnV3AdapterAddress;
    
    // 获取实现合约地址
    const yearnV3ImplementationAddress = await upgrades.erc1967.getImplementationAddress(yearnV3AdapterAddress);
    console.log("   实现合约地址:", yearnV3ImplementationAddress);
    deploymentAddresses.YearnV3Adapter_Implementation = yearnV3ImplementationAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 4: 验证 YearnV3Adapter 配置
    console.log("\n📄 [STEP 4] 验证 YearnV3Adapter 配置...");
    
    const yearnVaultInAdapter = await yearnV3Adapter.yearnVault();
    const underlyingTokenInAdapter = await yearnV3Adapter.underlyingToken();
    const adapterName = await yearnV3Adapter.getAdapterName();
    const adapterVersion = await yearnV3Adapter.getAdapterVersion();
    
    console.log("   YearnV3Adapter 配置验证:");
    console.log("   - Yearn Vault:", yearnVaultInAdapter, yearnVaultInAdapter === mockYearnV3VaultAddress ? "✅" : "❌");
    console.log("   - Underlying Token:", underlyingTokenInAdapter, underlyingTokenInAdapter === usdtAddress ? "✅" : "❌");
    console.log("   - Adapter Name:", adapterName);
    console.log("   - Adapter Version:", adapterVersion);

    // STEP 5: 注册适配器到 DefiAggregator
    console.log("\n📄 [STEP 5] 注册适配器到 DefiAggregator...");
    
    // 检查适配器是否已经存在
    const adapterExists = await defiAggregator.hasAdapter("yearnv3");
    if (adapterExists) {
      console.log("⚠️  适配器 'yearnv3' 已存在，先注销旧适配器...");
      const removeTx = await defiAggregator.removeAdapter("yearnv3");
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
    const registerTx = await defiAggregator.registerAdapter("yearnv3", yearnV3AdapterAddress);
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待注册交易确认...");
      await registerTx.wait(2);
    } else {
      await registerTx.wait();
    }
    
    console.log("✅ YearnV3Adapter 已注册到 DefiAggregator (名称: yearnv3)");

    // STEP 6: 验证最终配置
    console.log("\n📄 [STEP 6] 验证最终配置...");
    
    const hasYearnV3Adapter = await defiAggregator.hasAdapter("yearnv3");
    const yearnV3AdapterFromAggregator = await defiAggregator.getAdapter("yearnv3");
    
    console.log("   DefiAggregator 最终验证:");
    console.log("   - Has YearnV3 Adapter:", hasYearnV3Adapter ? "✅" : "❌");
    console.log("   - YearnV3 Adapter Address:", yearnV3AdapterFromAggregator, yearnV3AdapterFromAggregator === yearnV3AdapterAddress ? "✅" : "❌");

    // STEP 7: 给 MockYearnV3Vault 提供流动性
    console.log("\n📄 [STEP 7] 给 MockYearnV3Vault 提供流动性...");
    
    try {
      const liquidityAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      const mintTx = await usdtToken.mint(mockYearnV3VaultAddress, liquidityAmount);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待铸造交易确认...");
        await mintTx.wait(2);
      } else {
        await mintTx.wait();
      }
      
      console.log("✅ 向 MockYearnV3Vault 提供 10,000 USDT 流动性");
      
      // 设置 Vault 的收益率
      try {
        const setYieldTx = await mockYearnV3Vault.setYieldRate(500); // 5% 年化收益率
        
        if (networkName !== "localhost" && networkName !== "hardhat") {
          await setYieldTx.wait(2);
        } else {
          await setYieldTx.wait();
        }
        
        console.log("✅ 设置 MockYearnV3Vault 年化收益率为 5%");
      } catch (error) {
        console.log("⚠️  设置收益率遇到问题，使用默认收益率:", error.message);
      }
    } catch (error) {
      console.log("⚠️  流动性提供遇到问题，跳过此步骤:", error.message);
      console.log("   部署仍然成功，可以后续手动添加流动性");
    }

    // STEP 8: 验证合约到Etherscan (仅Sepolia网络)
    if (networkName === "sepolia") {
      console.log("\n🔍 [开始验证] 正在验证合约到Etherscan...");
      try {
        // 等待几个区块确认
        console.log("⏳ 等待区块确认...");
        await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒

        // 验证MockYearnVault合约
        console.log("🔍 验证MockYearnVault合约...");
        try {
          await hre.run("verify:verify", {
            address: mockYearnVaultAddress,
            constructorArguments: [
              usdtAddress,              // asset (USDT)
              "Yearn USDT Vault",       // name
              "yvUSDT"                  // symbol
            ]
          });
          console.log("✅ MockYearnVault合约验证成功");
        } catch (error) {
          console.log("⚠️ MockYearnVault合约验证跳过 (可能已验证):", error.message);
        }

        // 验证YearnV3Adapter实现合约
        console.log("🔍 验证YearnV3Adapter实现合约...");
        try {
          const yearnImplementationAddress = await upgrades.erc1967.getImplementationAddress(yearnv3AdapterAddress);
          await hre.run("verify:verify", {
            address: yearnImplementationAddress,
            constructorArguments: []
          });
          console.log("✅ YearnV3Adapter实现合约验证成功");
        } catch (error) {
          console.log("⚠️ YearnV3Adapter实现合约验证跳过 (可能已验证):", error.message);
        }

        // 验证YearnV3Adapter代理合约
        console.log("🔍 验证YearnV3Adapter代理合约...");
        try {
          await hre.run("verify:verify", {
            address: yearnv3AdapterAddress
          });
          console.log("✅ YearnV3Adapter代理合约验证成功");
        } catch (error) {
          console.log("⚠️ YearnV3Adapter代理合约验证跳过:", error.message);
        }

        console.log("\n✅ [验证完成] YearnV3适配器合约验证已完成!");
      } catch (error) {
        console.log("⚠️ [验证警告] 合约验证过程中出现问题:", error.message);
        console.log("💡 提示: 您可以稍后手动验证合约");
      }
    }
    
    // STEP 9: 提取ABI文件
    await extractABIFiles();

    // STEP 10: 保存部署结果
    console.log("\n📄 [STEP 10] 保存部署结果...");
    
    const deploymentFile = `deployments-yearnv3-adapter-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      feeRateBps: infrastructureData.feeRateBps,
      basedOn: infrastructureFile,
      contracts: deploymentAddresses,
      adapterRegistrations: {
        "yearnv3": yearnV3AdapterAddress
      },
      notes: {
        description: "YearnV3适配器部署，复用了基础设施合约",
        reusedContracts: [
          "DefiAggregator",
          "MockERC20_USDT"
        ],
        newContracts: [
          "MockYearnV3Vault",
          "YearnV3Adapter"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    console.log("\n🎉 YearnV3 适配器部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n📝 使用方法:");
    console.log("   - 通过 DefiAggregator 调用 executeOperation 使用 'yearnv3' 适配器");
    console.log("   - 支持存款和取款操作，自动获得收益");
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