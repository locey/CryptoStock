const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 UniswapV3 适配器脚本 (复用已有基础设施)
 * 包括: UniswapV3Adapter, MockUniswapV3Pool, MockUniswapV3Position
 * 复用: DefiAggregator, MockERC20_USDT (从基础设施部署文件读取)
 * 使用方法: npx hardhat run scripts/deploy-uniswapv3-adapter-only.js --network <network>
 */

async function main() {
  console.log("🚀 开始部署 UniswapV3 适配器...\n");
  
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

    // STEP 2: 部署 MockERC20 作为 WETH 代币
    console.log("\n📄 [STEP 2] 部署 MockERC20 作为 WETH 代币...");
    const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
    const mockWethToken = await MockERC20.deploy(
      "Wrapped Ether",  // name
      "WETH",           // symbol
      18                // decimals
    );
    await mockWethToken.waitForDeployment();
    const mockWethTokenAddress = await mockWethToken.getAddress();
    console.log("✅ MockERC20 (WETH代币) 部署完成:", mockWethTokenAddress);
    deploymentAddresses.MockWethToken = mockWethTokenAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 3: 部署 MockNonfungiblePositionManager
    console.log("\n📄 [STEP 4] 部署 MockNonfungiblePositionManager...");
    const MockNonfungiblePositionManager = await ethers.getContractFactory("contracts/mock/MockNonfungiblePositionManager.sol:MockNonfungiblePositionManager");
    const mockPositionManager = await MockNonfungiblePositionManager.deploy();
    await mockPositionManager.waitForDeployment();
    const mockPositionManagerAddress = await mockPositionManager.getAddress();
    console.log("✅ MockNonfungiblePositionManager 部署完成:", mockPositionManagerAddress);
    deploymentAddresses.MockPositionManager = mockPositionManagerAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 5: 部署可升级的 UniswapV3Adapter
    console.log("\n📄 [STEP 5] 部署 UniswapV3Adapter (可升级)...");
    const UniswapV3Adapter = await ethers.getContractFactory("UniswapV3Adapter");
    
    console.log("   初始化参数:");
    console.log("   - Position Manager:", mockPositionManagerAddress);
    console.log("   - USDT Token:", usdtAddress);
    console.log("   - WETH Token:", mockWethTokenAddress);
    console.log("   - Owner:", deployer.address);
    
    const uniswapV3Adapter = await upgrades.deployProxy(
      UniswapV3Adapter,
      [
        mockPositionManagerAddress,   // _positionManager
        usdtAddress,                  // _usdtToken
        mockWethTokenAddress,         // _wethToken
        deployer.address              // _owner
      ],
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    
    await uniswapV3Adapter.waitForDeployment();
    const uniswapV3AdapterAddress = await uniswapV3Adapter.getAddress();
    console.log("✅ UniswapV3Adapter 代理合约部署完成:", uniswapV3AdapterAddress);
    deploymentAddresses.UniswapV3Adapter = uniswapV3AdapterAddress;
    
    // 获取实现合约地址
    const uniswapV3ImplementationAddress = await upgrades.erc1967.getImplementationAddress(uniswapV3AdapterAddress);
    console.log("   实现合约地址:", uniswapV3ImplementationAddress);
    deploymentAddresses.UniswapV3Adapter_Implementation = uniswapV3ImplementationAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 6: 验证 UniswapV3Adapter 配置
    console.log("\n📄 [STEP 6] 验证 UniswapV3Adapter 配置...");
    
    const positionManagerInAdapter = await uniswapV3Adapter.positionManager();
    const usdtTokenInAdapter = await uniswapV3Adapter.usdtToken();
    const wethTokenInAdapter = await uniswapV3Adapter.wethToken();
    const adapterName = await uniswapV3Adapter.getAdapterName();
    const adapterVersion = await uniswapV3Adapter.getAdapterVersion();
    
    console.log("   UniswapV3Adapter 配置验证:");
    console.log("   - Position Manager:", positionManagerInAdapter, positionManagerInAdapter === mockPositionManagerAddress ? "✅" : "❌");
    console.log("   - USDT Token:", usdtTokenInAdapter, usdtTokenInAdapter === usdtAddress ? "✅" : "❌");
    console.log("   - WETH Token:", wethTokenInAdapter, wethTokenInAdapter === mockWethTokenAddress ? "✅" : "❌");
    console.log("   - Adapter Name:", adapterName);
    console.log("   - Adapter Version:", adapterVersion);

    // STEP 7: 注册适配器到 DefiAggregator
    console.log("\n📄 [STEP 7] 注册适配器到 DefiAggregator...");
    const registerTx = await defiAggregator.registerAdapter("uniswapv3", uniswapV3AdapterAddress);
    
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待注册交易确认...");
      await registerTx.wait(2);
    } else {
      await registerTx.wait();
    }
    
    console.log("✅ UniswapV3Adapter 已注册到 DefiAggregator (名称: uniswapv3)");

    // STEP 8: 验证最终配置
    console.log("\n📄 [STEP 8] 验证最终配置...");
    
    const hasUniswapV3Adapter = await defiAggregator.hasAdapter("uniswapv3");
    const uniswapV3AdapterFromAggregator = await defiAggregator.getAdapter("uniswapv3");
    
    console.log("   DefiAggregator 最终验证:");
    console.log("   - Has UniswapV3 Adapter:", hasUniswapV3Adapter ? "✅" : "❌");
    console.log("   - UniswapV3 Adapter Address:", uniswapV3AdapterFromAggregator, uniswapV3AdapterFromAggregator === uniswapV3AdapterAddress ? "✅" : "❌");

    // STEP 9: 给 Position Manager 提供流动性
    console.log("\n📄 [STEP 9] 给 Position Manager 提供流动性...");
    
    try {
      const liquidityAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
      const wethAmount = ethers.parseUnits("5", 18); // 5 WETH
      
      // 给 Position Manager 提供 USDT 和 WETH 流动性
      const mintUsdtTx = await usdtToken.mint(mockPositionManagerAddress, liquidityAmount);
      const mintWethTx = await mockWethToken.mint(mockPositionManagerAddress, wethAmount);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待铸造交易确认...");
        await mintUsdtTx.wait(2);
        await mintWethTx.wait(2);
      } else {
        await mintUsdtTx.wait();
        await mintWethTx.wait();
      }
      
      console.log("✅ 向 Position Manager 提供 10,000 USDT 和 5 WETH 流动性");
    } catch (error) {
      console.log("⚠️  流动性提供遇到问题，跳过此步骤:", error.message);
      console.log("   部署仍然成功，可以后续手动添加流动性");
    }

    // STEP 10: 保存部署结果
    console.log("\n📄 [STEP 10] 保存部署结果...");
    
    const deploymentFile = `deployments-uniswapv3-adapter-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      feeRateBps: infrastructureData.feeRateBps,
      basedOn: infrastructureFile,
      contracts: deploymentAddresses,
      adapterRegistrations: {
        "uniswapv3": uniswapV3AdapterAddress
      },
      notes: {
        description: "UniswapV3适配器部署，复用了基础设施合约",
        reusedContracts: [
          "DefiAggregator",
          "MockERC20_USDT"
        ],
        newContracts: [
          "MockWethToken",
          "MockPositionManager", 
          "UniswapV3Adapter"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    console.log("\n🎉 UniswapV3 适配器部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n📝 使用方法:");
    console.log("   - 通过 DefiAggregator 调用 executeOperation 使用 'uniswapv3' 适配器");
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
