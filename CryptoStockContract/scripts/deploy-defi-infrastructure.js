const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 DeFi 基础设施脚本
 * 包括: DefiAggregator, MockERC20 (USDT)
 * 这是所有适配器的基础合约
 * 使用方法: npx hardhat run scripts/deploy-defi-infrastructure.js --network <network>
 */

async function main() {
  console.log("🚀 开始部署 DeFi 基础设施...\n");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  console.log("📋 部署信息:");
  console.log("   部署者地址:", deployer.address);
  console.log("   网络:", networkName);
  console.log("   Chain ID:", network.chainId.toString());
  
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  console.log("   部署者余额:", ethers.formatEther(deployerBalance), "ETH\n");
  
  const deploymentAddresses = {};
  const FEE_RATE_BPS = 30; // 0.3% 手续费
  
  try {
    // STEP 1: 部署 MockERC20 作为 USDT
    console.log("📄 [STEP 1] 部署 MockERC20 (USDT)...");
    const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
    const usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
    await usdtToken.waitForDeployment();
    const usdtAddress = await usdtToken.getAddress();
    console.log("✅ MockERC20 (USDT) 部署完成:", usdtAddress);
    deploymentAddresses.MockERC20_USDT = usdtAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 2: 部署可升级的 DefiAggregator
    console.log("\n📄 [STEP 2] 部署 DefiAggregator (可升级)...");
    const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
    
    console.log("   初始化参数:");
    console.log("   - Fee Rate BPS:", FEE_RATE_BPS);
    
    const defiAggregator = await upgrades.deployProxy(
      DefiAggregator,
      [FEE_RATE_BPS], // 只需要 feeRateBps 参数
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    
    await defiAggregator.waitForDeployment();
    const defiAggregatorAddress = await defiAggregator.getAddress();
    console.log("✅ DefiAggregator 代理合约部署完成:", defiAggregatorAddress);
    deploymentAddresses.DefiAggregator = defiAggregatorAddress;
    
    // 获取实现合约地址
    const defiImplementationAddress = await upgrades.erc1967.getImplementationAddress(defiAggregatorAddress);
    console.log("   实现合约地址:", defiImplementationAddress);
    deploymentAddresses.DefiAggregator_Implementation = defiImplementationAddress;
    
    // 等待网络确认 (如果是测试网络)
    if (networkName !== "localhost" && networkName !== "hardhat") {
      console.log("⏳ 等待网络确认...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 3: 验证 DefiAggregator 配置
    console.log("\n📄 [STEP 3] 验证 DefiAggregator 配置...");
    
    const feeRate = await defiAggregator.feeRateBps();
    const owner = await defiAggregator.owner();
    
    console.log("   DefiAggregator 配置验证:");
    console.log("   - Fee Rate BPS:", feeRate.toString(), feeRate.toString() === FEE_RATE_BPS.toString() ? "✅" : "❌");
    console.log("   - Owner:", owner, owner === deployer.address ? "✅" : "❌");
    
    // STEP 4: 给 USDT 合约提供初始流动性 (可选)
    console.log("\n📄 [STEP 4] 给 USDT 合约提供初始供应量...");
    
    try {
      // 给部署者铸造一些 USDT 用于测试
      const initialSupply = ethers.parseUnits("1000000", 6); // 1M USDT
      const mintTx = await usdtToken.mint(deployer.address, initialSupply);
      
      if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("⏳ 等待铸造交易确认...");
        await mintTx.wait(2); // 等待2个区块确认
      } else {
        await mintTx.wait();
      }
      
      console.log("✅ 向部署者铸造 1,000,000 USDT");
      
      const balance = await usdtToken.balanceOf(deployer.address);
      console.log("   部署者 USDT 余额:", ethers.formatUnits(balance, 6), "USDT");
    } catch (error) {
      console.log("⚠️  USDT 铸造遇到问题，跳过此步骤:", error.message);
    }
    
    // STEP 5: 保存部署结果
    console.log("\n📄 [STEP 5] 保存部署结果...");
    
    const deploymentFile = `deployments-defi-infrastructure-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      feeRateBps: FEE_RATE_BPS,
      contracts: deploymentAddresses,
      notes: {
        description: "DeFi基础设施部署，包含DefiAggregator和MockERC20 USDT",
        usage: "其他适配器脚本可以复用这些合约地址",
        nextSteps: [
          "运行适配器部署脚本 (deploy-aave-adapter.js, deploy-compound-adapter.js 等)",
          "使用 DefiAggregator 地址注册新的适配器"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    // 最终总结
    console.log("\n🎉 DeFi 基础设施部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n📝 下一步:");
    console.log("   1. 运行适配器部署脚本:");
    console.log("      npx hardhat run scripts/deploy-aave-adapter-only.js --network", networkName);
    console.log("      npx hardhat run scripts/deploy-compound-adapter-only.js --network", networkName);
    console.log("   2. 这些脚本将自动读取本部署文件并复用合约地址");
    
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