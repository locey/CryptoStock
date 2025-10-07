const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 Compound 适配器脚本 (复用已有基础设施)
 * 包括: CompoundAdapter, MockCompound
 * 复用: DefiAggregator, MockERC20_USDT (从基础设施部署文件读取)
 * 使用方法: npx hardhat run scripts/deploy-compound-adapter-only.js --network <network>
 */

async function main() {
  console.log("🚀 开始部署 Compound 适配器...\n");
  
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

    // STEP 2: 部署 MockCToken (cUSDT)
    console.log("\n📄 [STEP 2] 部署 MockCToken (cUSDT)...");
    const MockCToken = await ethers.getContractFactory("contracts/mock/MockCompound.sol:MockCToken");
    const mockCToken = await MockCToken.deploy(
      "Compound USDT",           // name
      "cUSDT",                   // symbol  
      usdtAddress,               // underlying asset (USDT)
      ethers.parseUnits("0.02", 18)  // initial exchange rate (0.02 USDT per cUSDT)
    );
    await mockCToken.waitForDeployment();
    const mockCTokenAddress = await mockCToken.getAddress();
    console.log("✅ MockCToken (cUSDT) 部署完成:", mockCTokenAddress);
    deploymentAddresses.MockCToken_cUSDT = mockCTokenAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 3: 部署可升级的 CompoundAdapter
    console.log("\n📄 [STEP 3] 部署 CompoundAdapter (可升级)...");
    const CompoundAdapter = await ethers.getContractFactory("CompoundAdapter");
    
    console.log("   初始化参数:");
    console.log("   - cUSDT Token:", mockCTokenAddress);
    console.log("   - USDT Token:", usdtAddress);
    console.log("   - Owner:", deployer.address);
    
    const compoundAdapter = await upgrades.deployProxy(
      CompoundAdapter,
      [
        mockCTokenAddress,    // _cUsdtToken
        usdtAddress,          // _usdtToken
        deployer.address      // _owner
      ],
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    
    await compoundAdapter.waitForDeployment();
    const compoundAdapterAddress = await compoundAdapter.getAddress();
    console.log("✅ CompoundAdapter 代理合约部署完成:", compoundAdapterAddress);
    deploymentAddresses.CompoundAdapter = compoundAdapterAddress;
    
    // 获取实现合约地址
    const compoundImplementationAddress = await upgrades.erc1967.getImplementationAddress(compoundAdapterAddress);
    console.log("   实现合约地址:", compoundImplementationAddress);
    deploymentAddresses.CompoundAdapter_Implementation = compoundImplementationAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 4: 验证 CompoundAdapter 配置
    console.log("\n📄 [STEP 4] 验证 CompoundAdapter 配置...");
    
    // 验证 CompoundAdapter 的配置
    const cUsdtTokenInAdapter = await compoundAdapter.cUsdtToken();
    const usdtTokenInAdapter = await compoundAdapter.usdtToken();
    
    console.log("   CompoundAdapter 配置验证:");
    console.log("   - cUSDT Token:", cUsdtTokenInAdapter, cUsdtTokenInAdapter === mockCTokenAddress ? "✅" : "❌");
    console.log("   - USDT Token:", usdtTokenInAdapter, usdtTokenInAdapter === usdtAddress ? "✅" : "❌");

    // STEP 5: 注册适配器到 DefiAggregator
    console.log("\n📄 [STEP 5] 注册适配器到 DefiAggregator...");
    
    // 检查适配器是否已经存在
    const adapterExists = await defiAggregator.hasAdapter("compound");
    if (adapterExists) {
      console.log("⚠️  适配器 'compound' 已存在，先注销旧适配器...");
      const removeTx = await defiAggregator.removeAdapter("compound");
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
    const registerTx = await defiAggregator.registerAdapter("compound", compoundAdapterAddress);
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待注册交易确认...");
      await registerTx.wait(2); // 等待2个区块确认
    } else {
      await registerTx.wait();
    }
    
    console.log("✅ CompoundAdapter 已注册到 DefiAggregator (名称: compound)");

    // STEP 6: 验证最终配置
    console.log("\n📄 [STEP 6] 验证最终配置...");
    
    // 验证 DefiAggregator 配置
    const hasCompoundAdapter = await defiAggregator.hasAdapter("compound");
    const compoundAdapterFromAggregator = await defiAggregator.getAdapter("compound");
    
    console.log("   DefiAggregator 最终验证:");
    console.log("   - Has Compound Adapter:", hasCompoundAdapter ? "✅" : "❌");
    console.log("   - Compound Adapter Address:", compoundAdapterFromAggregator, compoundAdapterFromAggregator === compoundAdapterAddress ? "✅" : "❌");

    // STEP 7: 给 MockCToken 提供流动性
    console.log("\n📄 [STEP 7] 给 MockCToken 提供流动性...");
    
    try {
      // 给 MockCToken 铸造一些 USDT 作为流动性
      const liquidityAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      const mintTx = await usdtToken.mint(mockCTokenAddress, liquidityAmount);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待铸造交易确认...");
        await mintTx.wait(2);
      } else {
        await mintTx.wait();
      }
      
      console.log("✅ 向 MockCToken 提供 10,000 USDT 流动性");
      
      // 验证流动性
      const compoundBalance = await usdtToken.balanceOf(mockCTokenAddress);
      console.log("   MockCToken USDT 余额:", ethers.formatUnits(compoundBalance, 6), "USDT");
    } catch (error) {
      console.log("⚠️  流动性提供遇到问题，跳过此步骤:", error.message);
      console.log("   部署仍然成功，可以后续手动添加流动性");
    }

    // STEP 8: 保存部署结果
    console.log("\n📄 [STEP 8] 保存部署结果...");
    
    const deploymentFile = `deployments-compound-adapter-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      feeRateBps: infrastructureData.feeRateBps,
      basedOn: infrastructureFile, // 引用基础设施部署文件
      contracts: deploymentAddresses,
      adapterRegistrations: {
        "compound": compoundAdapterAddress
      },
      notes: {
        description: "Compound适配器部署，复用了基础设施合约",
        reusedContracts: [
          "DefiAggregator",
          "MockERC20_USDT"
        ],
        newContracts: [
          "MockCToken_cUSDT",
          "CompoundAdapter"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    // 最终总结
    console.log("\n🎉 Compound 适配器部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n📝 使用方法:");
    console.log("   - 通过 DefiAggregator 调用 executeOperation 使用 'compound' 适配器");
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