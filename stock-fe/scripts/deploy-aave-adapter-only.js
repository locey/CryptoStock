const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 开始部署 Aave 适配器到 Sepolia 网络...");

  // 获取网络配置
  const network = await ethers.provider.getNetwork();
  console.log("📡 网络:", network.name, "Chain ID:", network.chainId);

  // 获取部署者账户
  [deployer] = await ethers.getSigners();
  console.log("👤 部署者地址:", deployer.address);

  // 配置合约地址
  const config = {
    DEFI_AGGREGATOR: '0x43C83cE19346e2148A18aE44315f03de20203ff3',
    AAVE_POOL: '0xD9553590245d3C2bd947f664DED70500C0F3455B',
    USDT_TOKEN: '0x01C8918bd02437C52ab0034A73c6Fecc448e2B5f',
    AUSDT_AAVE: '0x74D206B207f4FC04579cF7c26D8C6b4F0Ee1fA76',
    AAVE_ADAPTER: '0xc84cCaDa821939902e7f3D728440e193d6903fCb',
    MOCK_AUSDT: '0x74D206B207f4FC04579cF7c26D8C6b4F0Ee1fA76'
  };

  console.log("📋 合约地址配置:");
  console.log("  DefiAggregator:", config.DEFI_AGGREGATOR);
  console.log("  AavePool:", config.AAVE_POOL);
  console.log("  USDT Token:", config.USDT_TOKEN);
  console.log("  aUSDT Token:", config.AUSDT_AAVE);
  console.log("  Aave Adapter:", config.AAVE_ADAPTER);

  // 部署 AaveAdapter (如果需要升级)
  console.log("🔄 部署/升级 Aave 适配器...");

  try {
    const AaveAdapter = await ethers.getContractFactory("AaveAdapter");
    console.log("✅ 获取AaveAdapter合约工厂成功");

    // 如果需要初始化，取消注释下面的代码
    // await AaveAdapter.deploy(
    //   config.AAVE_POOL,
    //   config.USDT_TOKEN,
    //   config.AUSDT_AAVE,
    //   deployer.address
    // );

    console.log("🎉 AaveAdapter已部署到:", AaveAdapter.address);

    // 更新地址配置
    const newConfig = {
      ...config,
      AAVE_ADAPTER: AaveAdapter.address
    };

    // 保存到部署文件
    const deployment = {
      network: network.name.toLowerCase(),
      chainId: network.chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {
        DefiAggregator: config.DEFI_AGGREGATOR,
        AaveAdapter: newConfig.AAVE_ADAPTER,
        USDT_TOKEN: config.USDT_TOKEN,
        MockAavePool: config.AAVE_POOL,
        MockAToken_aUSDT: config.AUSDT_AAVE,
        AaveAdapter_Implementation: config.AAVE_ADAPTER_IMPL
      }
    };

    // 保存部署文件
    const deploymentFile = path.join(__dirname, '..', 'deployments-aave-adapter-only.json');
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

    console.log("✅ 部署文件已保存到:", deploymentFile);
    console.log("📄 合约地址:");
    console.log("  AaveAdapter:", AaveAdapter.address);

  } catch (error) {
      console.error("❌ 部署AaveAdapter失败:", error);

      if (error.message.includes("not deployed")) {
        console.log("💡 提示: 请先部署基础合约:");
        console.log("   npx hardhat run scripts/deploy-infrastructure.js --network sepolia");
      }
      throw error;
    }
  }

  // 验证部署
  console.log("🔍 验证部署结果...");

  try {
    // 检查DefiAggregator是否已注册Aave适配器
    const defiAggregator = await ethers.getContractAt("DefiAggregator", config.DEFI_AGGREGATOR);
    const hasAdapter = await defiAggregator.hasAdapter("aave");
    console.log("📊 Aave适配器已注册:", hasAdapter);

    if (hasAdapter) {
      const adapterAddress = await defiAggregator.getAdapterAddress("aave");
      console.log("📍 应配器地址:", adapterAddress);

      // 验证适配器是否支持所需操作
      const supportsDeposit = await defiAggregator.supportsOperation(0); // DEPOSIT
      const supportsWithdraw = await defiAggregator.supportsOperation(1); // WITHDRAW
      console.log("📊 支持存款:", supportsDeposit);
      console.log("📊 支持取款:", supportsWithdraw);
    }

    // 测试连接
    console.log("🧪 测试合约连接...");
    const owner = await defiAggregator.owner();
    console.log("👤 合约所有者:", owner);

    console.log("✅ Aave配置验证完成");

  } catch (error) {
    console.error("❌ 验证失败:", error);
    throw error;
  }

  console.log("🎉 Aave 适配器部署完成!");
  console.log("📍 可用的合约地址:");
  console.log("  DefiAggregator:", config.DEFI_AGGREGATOR);
  console.log("  AaveAdapter:", config.AAVE_ADAPTER);
  console.log("  USDT Token:", config.USDT_TOKEN);
  console.log("  aUSDT Aave:", config.AUSDT_AAVE);
  console.log("  Aave Pool:", config.AAVE_POOL);

  return {
    config,
    success: true
  };
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的错误:', reason);
  process.exit(1);
});

// 主函数
if (require.main === module) {
  main()
    .catch(error => {
      console.error("❌ 部署失败:", error);
      process.exit(1);
    });
}

module.exports = { main };