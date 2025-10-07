const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 Curve 适配器脚本 (复用已有基础设施)
 * 包括: CurveAdapter, MockCurvePool, MockCurveToken
 * 复用: DefiAggregator, MockERC20_USDT (从基础设施部署文件读取)
 * 使用方法: npx hardhat run scripts/deploy-curve-adapter-only.js --network <network>
 */

async function main() {
  console.log("🚀 开始部署 Curve 适配器...\n");
  
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

    // STEP 2: 部署 MockCurve (集成池子和LP代币)
    console.log("\n📄 [STEP 2] 部署 MockCurve (集成池子和LP代币)...");
    const MockCurve = await ethers.getContractFactory("contracts/mock/MockCurve.sol:MockCurve");
    const mockCurve = await MockCurve.deploy(
      deployer.address,                 // owner
      [usdtAddress, usdtAddress, usdtAddress], // coins (使用USDT作为所有三个币)
      100,                             // A parameter
      4000000,                         // fee (0.4%)
      5000000000                       // admin_fee (50% of fee)
    );
    await mockCurve.waitForDeployment();
    const mockCurveAddress = await mockCurve.getAddress();
    console.log("✅ MockCurve (池子+LP代币) 部署完成:", mockCurveAddress);
    deploymentAddresses.MockCurve = mockCurveAddress;
    
    // MockCurve既是池子也是LP代币
    const mockCurvePoolAddress = mockCurveAddress;
    const mockCurveTokenAddress = mockCurveAddress;
    deploymentAddresses.MockCurvePool = mockCurvePoolAddress;
    deploymentAddresses.MockCurveToken = mockCurveTokenAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log("✅ MockCurve 既作为池子又作为LP代币使用");

    // STEP 3: 部署可升级的 CurveAdapter
    console.log("\n📄 [STEP 3] 部署 CurveAdapter (可升级)...");
    const CurveAdapter = await ethers.getContractFactory("CurveAdapter");
    
    console.log("   初始化参数:");
    console.log("   - Curve Pool:", mockCurvePoolAddress);
    console.log("   - USDT Token:", usdtAddress);
    console.log("   - Curve LP Token:", mockCurveTokenAddress);
    console.log("   - Owner:", deployer.address);
    
    const curveAdapter = await upgrades.deployProxy(
      CurveAdapter,
      [
        deployer.address,      // initialOwner
        mockCurvePoolAddress   // _curve3Pool
      ],
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    
    await curveAdapter.waitForDeployment();
    const curveAdapterAddress = await curveAdapter.getAddress();
    console.log("✅ CurveAdapter 代理合约部署完成:", curveAdapterAddress);
    deploymentAddresses.CurveAdapter = curveAdapterAddress;
    
    // 获取实现合约地址
    const curveImplementationAddress = await upgrades.erc1967.getImplementationAddress(curveAdapterAddress);
    console.log("   实现合约地址:", curveImplementationAddress);
    deploymentAddresses.CurveAdapter_Implementation = curveImplementationAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 4: 验证 CurveAdapter 配置
    console.log("\n📄 [STEP 4] 验证 CurveAdapter 配置...");
    
    const curve3PoolInAdapter = await curveAdapter.curve3Pool();
    const adapterName = await curveAdapter.getAdapterName();
    const adapterVersion = await curveAdapter.getAdapterVersion();
    
    console.log("   CurveAdapter 配置验证:");
    console.log("   - Curve 3Pool:", curve3PoolInAdapter, curve3PoolInAdapter === mockCurvePoolAddress ? "✅" : "❌");
    console.log("   - Adapter Name:", adapterName);
    console.log("   - Adapter Version:", adapterVersion);

    // STEP 5: 注册适配器到 DefiAggregator
    console.log("\n📄 [STEP 5] 注册适配器到 DefiAggregator...");
    
    // 检查适配器是否已经存在
    const adapterExists = await defiAggregator.hasAdapter("curve");
    if (adapterExists) {
      console.log("⚠️  适配器 'curve' 已存在，先注销旧适配器...");
      const removeTx = await defiAggregator.removeAdapter("curve");
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
    const registerTx = await defiAggregator.registerAdapter("curve", curveAdapterAddress);
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待注册交易确认...");
      await registerTx.wait(2);
    } else {
      await registerTx.wait();
    }
    
    console.log("✅ CurveAdapter 已注册到 DefiAggregator (名称: curve)");

    // STEP 6: 验证最终配置
    console.log("\n📄 [STEP 6] 验证最终配置...");
    
    const hasCurveAdapter = await defiAggregator.hasAdapter("curve");
    const curveAdapterFromAggregator = await defiAggregator.getAdapter("curve");
    
    console.log("   DefiAggregator 最终验证:");
    console.log("   - Has Curve Adapter:", hasCurveAdapter ? "✅" : "❌");
    console.log("   - Curve Adapter Address:", curveAdapterFromAggregator, curveAdapterFromAggregator === curveAdapterAddress ? "✅" : "❌");

    // STEP 7: 给 MockCurve 提供流动性
    console.log("\n📄 [STEP 7] 给 MockCurve 提供流动性...");
    
    try {
      const liquidityAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      const mintTx = await usdtToken.mint(mockCurveAddress, liquidityAmount);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待铸造交易确认...");
        await mintTx.wait(2);
      } else {
        await mintTx.wait();
      }
      
      console.log("✅ 向 MockCurve 提供 10,000 USDT 流动性");
    } catch (error) {
      console.log("⚠️  流动性提供遇到问题，跳过此步骤:", error.message);
      console.log("   部署仍然成功，可以后续手动添加流动性");
    }

    // STEP 8: 保存部署结果
    console.log("\n📄 [STEP 8] 保存部署结果...");
    
    const deploymentFile = `deployments-curve-adapter-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      feeRateBps: infrastructureData.feeRateBps,
      basedOn: infrastructureFile,
      contracts: deploymentAddresses,
      adapterRegistrations: {
        "curve": curveAdapterAddress
      },
      notes: {
        description: "Curve适配器部署，复用了基础设施合约",
        reusedContracts: [
          "DefiAggregator",
          "MockERC20_USDT"
        ],
        newContracts: [
          "MockCurve",
          "CurveAdapter"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    console.log("\n🎉 Curve 适配器部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n📝 使用方法:");
    console.log("   - 通过 DefiAggregator 调用 executeOperation 使用 'curve' 适配器");
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
