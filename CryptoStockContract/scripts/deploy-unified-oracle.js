/**
 * 统一预言机部署脚本 - Sepolia 网络
 * 功能：
 * 1. 部署 PythPriceFeed (真实 Pyth 数据源)
 * 2. 部署 MockRedStoneOracle (Mock RedStone 数据源) 
 * 3. 部署 RedstonePriceFeed (RedStone 适配器)
 * 4. 部署 PriceAggregator (聚合预言机)
 * 5. 测试六种股票价格获取 (AAPL, TSLA, GOOGL, MSFT, AMZN, NVDA)
 * 
 * 架构特点：
 * - IPriceFeed 接口只有 getPrice(OperationParams) payable 方法
 * - OperationParams 只包含 symbol 和 updateData 字段
 * - PriceAggregator 支持 bytes[][] updateDataArray 参数
 * - 所有价格函数都是 payable (支持 Pyth 的 ETH 费用)
 * 
 * 用法：npx hardhat run scripts/deploy-unified-oracle.js --network sepolia
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { fetchUpdateData } = require("../utils/getPythUpdateData");
const { getRedStoneUpdateData, convertStringToBytes32 } = require("../utils/getRedStoneUpdateData-v061");

// Pyth 官方合约地址（Sepolia 测试网）
const PYTH_SEPOLIA_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21";

// 股票 Feed IDs (Pyth 网络) - 支持六种股票
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

// OracleType 枚举值 (来自 IPriceOracle.sol)
const ORACLE_TYPES = {
  PYTH: 0,       // OracleType.PYTH
  REDSTONE: 1    // OracleType.REDSTONE
};

async function main() {
  console.log("🚀 开始部署统一预言机系统 (Sepolia)...\n");
  
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  const [deployer] = await ethers.getSigners();
  
  // 验证网络
  if (networkName !== "sepolia") {
    throw new Error(`❌ 此脚本仅支持 Sepolia 网络，当前网络: ${networkName}`);
  }
  
  console.log(`📡 网络: ${networkName} (chainId: ${network.chainId})`);
  console.log(`👤 部署者: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 余额: ${ethers.formatEther(balance)} ETH`);
  console.log(`📍 Pyth 合约地址: ${PYTH_SEPOLIA_ADDRESS}\n`);
  
  const deployedContracts = {};
  
  // =========================
  // 1. 部署 PythPriceFeed
  // =========================
  console.log("📦 [1/4] 部署 PythPriceFeed...");
  
  const PythPriceFeedFactory = await ethers.getContractFactory("PythPriceFeed");
  const pythPriceFeed = await PythPriceFeedFactory.deploy(PYTH_SEPOLIA_ADDRESS);
  await pythPriceFeed.waitForDeployment();
  
  const pythPriceFeedAddress = await pythPriceFeed.getAddress();
  deployedContracts.pythPriceFeed = pythPriceFeedAddress;
  
  console.log(`✅ PythPriceFeed 部署成功: ${pythPriceFeedAddress}`);
  
  // 设置支持的股票 Feed IDs
  console.log("🔧 配置 Pyth Feed IDs...");
  for (const [symbol, feedId] of Object.entries(FEED_IDS)) {
    try {
      const tx = await pythPriceFeed.setFeedId(symbol, feedId);
      await tx.wait();
      console.log(`   ✅ ${symbol}: ${feedId}`);
    } catch (error) {
      console.log(`   ❌ ${symbol} 配置失败: ${error.message}`);
    }
  }
  
  // =========================
  // 2. 部署 MockRedStoneOracle
  // =========================
  console.log("\n📦 [2/4] 部署 MockRedStoneOracle...");
  
  const MockRedStoneFactory = await ethers.getContractFactory("MockRedStoneOracle");
  const mockRedStone = await MockRedStoneFactory.deploy();
  await mockRedStone.waitForDeployment();
  
  const mockRedStoneAddress = await mockRedStone.getAddress();
  deployedContracts.mockRedStone = mockRedStoneAddress;
  
  console.log(`✅ MockRedStoneOracle 部署成功: ${mockRedStoneAddress}`);
  
  // =========================
  // 3. 部署 RedstonePriceFeed
  // =========================
  console.log("\n📦 [3/4] 部署 RedstonePriceFeed...");
  
  const RedstonePriceFeedFactory = await ethers.getContractFactory("RedstonePriceFeed");
  const redstonePriceFeed = await RedstonePriceFeedFactory.deploy(mockRedStoneAddress);
  await redstonePriceFeed.waitForDeployment();
  
  const redstonePriceFeedAddress = await redstonePriceFeed.getAddress();
  deployedContracts.redstonePriceFeed = redstonePriceFeedAddress;
  
  console.log(`✅ RedstonePriceFeed 部署成功: ${redstonePriceFeedAddress}`);
  
  // =========================
  // 4. 部署 PriceAggregator
  // =========================
  console.log("\n📦 [4/4] 部署 PriceAggregator...");
  
  const PriceAggregatorFactory = await ethers.getContractFactory("PriceAggregator");
  const priceAggregator = await PriceAggregatorFactory.deploy();
  await priceAggregator.waitForDeployment();
  
  const priceAggregatorAddress = await priceAggregator.getAddress();
  deployedContracts.priceAggregator = priceAggregatorAddress;
  
  console.log(`✅ PriceAggregator 部署成功: ${priceAggregatorAddress}`);
  
  // 配置聚合器的预言机源
  console.log("\n🔧 配置聚合器预言机源...");
  
  try {
    // 添加 Pyth 预言机源 (OracleType.PYTH = 0)
    let tx = await priceAggregator.addOracle(ORACLE_TYPES.PYTH, pythPriceFeedAddress, ORACLE_WEIGHTS.PYTH);
    await tx.wait();
    console.log(`   ✅ Pyth 预言机已添加 (类型: PYTH, 权重: ${ORACLE_WEIGHTS.PYTH}%)`);
    
    // 添加 RedStone 预言机源 (OracleType.REDSTONE = 1)
    tx = await priceAggregator.addOracle(ORACLE_TYPES.REDSTONE, redstonePriceFeedAddress, ORACLE_WEIGHTS.REDSTONE);
    await tx.wait();
    console.log(`   ✅ RedStone 预言机已添加 (类型: REDSTONE, 权重: ${ORACLE_WEIGHTS.REDSTONE}%)`);
    
  } catch (error) {
    console.log(`   ❌ 预言机源配置失败: ${error.message}`);
  }
  
  // =========================
  // 5. 价格测试
  // =========================
  console.log("\n🧪 开始价格功能测试...\n");
  
  const testResults = {};
  const testSymbols = ["AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "NVDA"]; // 测试所有六种股票
  
  for (const symbol of testSymbols) {
    console.log(`🔍 测试 ${symbol} 价格获取...`);
    testResults[symbol] = {};
    
    // 测试 1: Pyth 价格源
    try {
      console.log(`   🐍 测试 Pyth 价格源...`);
      
      // 获取真实的 Pyth updateData
      console.log(`      📡 获取 ${symbol} 的 Pyth 更新数据...`);
      const pythUpdateData = await fetchUpdateData([symbol]);
      console.log(`      ✅ 获取到 ${pythUpdateData.length} 条更新数据`);
      
      // 准备参数，使用真实的 updateData
      const pythParams = {
        symbol: symbol,
        updateData: pythUpdateData
      };
      
      // 获取更新费用
      const updateFee = await pythPriceFeed.getUpdateFee(pythUpdateData);
      console.log(`      💰 更新费用: ${updateFee.toString()} wei`);
      
      // 调用 getPrice（使用 staticCall 查询价格而不是发送交易）
      const pythResult = await pythPriceFeed.getPrice.staticCall(pythParams, { value: updateFee });
      
      // 安全处理价格值
      let pythPriceUSD = "0";
      if (pythResult && pythResult.price && pythResult.price.toString() !== "0") {
        pythPriceUSD = ethers.formatEther(pythResult.price);
      }
      
      console.log(`      价格: $${pythPriceUSD}`);
      console.log(`      成功: ${pythResult?.success || false}`);
      if (!pythResult?.success) {
        console.log(`      错误: ${pythResult?.errorMessage || "未知错误"}`);
      }
      
      testResults[symbol].pyth = {
        price: pythPriceUSD,
        success: pythResult?.success || false,
        error: pythResult?.success ? null : (pythResult?.errorMessage || "调用失败"),
        updateFee: updateFee.toString()
      };
      
    } catch (error) {
      console.log(`      ❌ Pyth 调用失败: ${error.message}`);
      testResults[symbol].pyth = {
        price: null,
        success: false,
        error: error.message,
        updateFee: "0"
      };
    }
    
    // 测试 2: RedStone 价格源
    try {
      console.log(`   🔴 测试 RedStone 价格源...`);
      
      // 使用固定的 TSLA 配置获取真实 RedStone payload
      console.log(`      📡 获取 RedStone payload (固定使用 TSLA)...`);
      const redStoneData = await getRedStoneUpdateData(symbol); // 无论传入什么，都使用 TSLA
      
      // 准备参数 - updateData 需要是 bytes[] 数组格式
      const redstoneParams = {
        symbol: symbol,
        updateData: [redStoneData.updateData] // 包装成 bytes[] 数组
      };
      
      const redstoneResult = await redstonePriceFeed.getPrice.staticCall(redstoneParams);
      
      // 安全处理价格值
      let redstonePriceUSD = "0";
      if (redstoneResult && redstoneResult.price && redstoneResult.price.toString() !== "0") {
        redstonePriceUSD = ethers.formatEther(redstoneResult.price);
      }
      
      console.log(`      价格: $${redstonePriceUSD}`);
      console.log(`      成功: ${redstoneResult?.success || false}`);
      if (!redstoneResult?.success) {
        console.log(`      错误: ${redstoneResult?.errorMessage || "未知错误"}`);
      }
      
      testResults[symbol].redstone = {
        price: redstonePriceUSD,
        success: redstoneResult?.success || false,
        error: redstoneResult?.success ? null : (redstoneResult?.errorMessage || "调用失败"),
        payloadLength: redStoneData.updateData ? redStoneData.updateData.length : 0
      };
      
    } catch (error) {
      console.log(`      ❌ RedStone 调用失败: ${error.message}`);
      testResults[symbol].redstone = {
        price: null,
        success: false,
        error: error.message,
        payloadLength: 0
      };
    }
    
    // 测试 3: 聚合价格
    try {
      console.log(`   🌊 测试聚合价格...`);
      
      // 为聚合器准备 updateDataArray
      console.log(`      📡 准备聚合器更新数据...`);
      const pythUpdateDataForAgg = await fetchUpdateData([symbol]);
      const redStoneDataForAgg = await getRedStoneUpdateData(symbol); // 固定使用 TSLA
      
      const updateDataArray = [
        pythUpdateDataForAgg,           // Pyth 预言机的 updateData (bytes[])
        [redStoneDataForAgg.updateData] // RedStone 预言机的 TSLA payload (包装成 bytes[])
      ];
      
      // 计算总的更新费用 (只有 Pyth 需要费用)
      const aggUpdateFee = await pythPriceFeed.getUpdateFee(pythUpdateDataForAgg);
      console.log(`      💰 聚合器更新费用: ${aggUpdateFee.toString()} wei`);
      
      const aggregatedPrice = await priceAggregator.getAggregatedPrice.staticCall(symbol, updateDataArray, { value: aggUpdateFee });
      
      // 安全处理聚合价格值
      let aggPriceUSD = "0";
      if (aggregatedPrice && aggregatedPrice.toString() !== "0") {
        aggPriceUSD = ethers.formatEther(aggregatedPrice);
      }
      
      console.log(`      聚合价格: $${aggPriceUSD}`);
      
      testResults[symbol].aggregated = {
        price: aggPriceUSD,
        success: true,
        error: null,
        updateFee: aggUpdateFee.toString(),
        pythDataLength: pythUpdateDataForAgg.length,
        redstonePayloadLength: redStoneDataForAgg.updateData ? redStoneDataForAgg.updateData.length : 0
      };
      
    } catch (error) {
      console.log(`      ❌ 聚合价格失败: ${error.message}`);
      testResults[symbol].aggregated = {
        price: null,
        success: false,
        error: error.message,
        updateFee: "0",
        pythDataLength: 0,
        redstonePayloadLength: 0
      };
    }
    
    console.log("");
  }
  
  // =========================
  // 6. 保存部署信息
  // =========================
  const deploymentInfo = {
    metadata: {
      deployTime: new Date().toISOString(),
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      deployerBalance: ethers.formatEther(balance),
      scriptVersion: "unified-oracle-sepolia-v1.0",
      architecture: "简化统一预言机架构 (Sepolia 专用)"
    },
    contracts: {
      pythPriceFeed: {
        address: pythPriceFeedAddress,
        type: "PythPriceFeed",
        description: "Pyth 网络价格适配器",
        pythContract: PYTH_SEPOLIA_ADDRESS,
        supportedSymbols: Object.keys(FEED_IDS)
      },
      mockRedStone: {
        address: mockRedStoneAddress,
        type: "MockRedStoneOracle", 
        description: "Mock RedStone 预言机 (测试用)",
        basePrice: "18 位小数精度",
        volatility: "±1% 随机波动"
      },
      redstonePriceFeed: {
        address: redstonePriceFeedAddress,
        type: "RedstonePriceFeed",
        description: "RedStone 预言机适配器",
        oracleSource: mockRedStoneAddress
      },
      priceAggregator: {
        address: priceAggregatorAddress,
        type: "PriceAggregator",
        description: "双预言机聚合器",
        oracleWeights: ORACLE_WEIGHTS,
        sources: [pythPriceFeedAddress, redstonePriceFeedAddress]
      }
    },
    configuration: {
      pythFeedIds: FEED_IDS,
      oracleWeights: ORACLE_WEIGHTS,
      supportedSymbols: Object.keys(FEED_IDS),
      priceFormat: "18 位小数精度 (Wei)",
      interfaceVersion: "IPriceFeed v2.0 (简化版)"
    },
    testResults: testResults,
    features: {
      "统一接口": "IPriceFeed.getPrice(OperationParams) payable",
      "简化参数": "OperationParams { symbol, updateData }",
      "聚合支持": "PriceAggregator.getAggregatedPrice(symbol, bytes[][])",
      "权重分配": `Pyth ${ORACLE_WEIGHTS.PYTH}% + RedStone ${ORACLE_WEIGHTS.REDSTONE}%`,
      "费用支持": "所有函数 payable (支持 Pyth ETH 费用)",
      "错误处理": "所有价格调用返回结构体 { price, success, errorMessage }"
    },
    usage: {
      pythExample: "pythPriceFeed.getPrice({ symbol: 'AAPL', updateData: '0x' })",
      redstoneExample: "redstonePriceFeed.getPrice({ symbol: 'AAPL', updateData: '0x' })",
      aggregatorExample: "priceAggregator.getAggregatedPrice('AAPL', [[], []])"
    }
  };
  
  // 保存到文件
  const deploymentFileName = `deployments-unified-oracle-${networkName}.json`;
  const deploymentFilePath = path.join(__dirname, "..", deploymentFileName);
  
  try {
    fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 部署信息已保存: ${deploymentFileName}`);
  } catch (error) {
    console.error(`❌ 保存部署信息失败: ${error.message}`);
  }
  
  // =========================
  // 7. 部署总结
  // =========================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 统一预言机系统部署完成!");
  console.log("=".repeat(50));
  console.log(`📊 架构: IPriceFeed 统一接口 + PriceAggregator 聚合`);
  console.log(`🔗 网络: ${networkName} (${network.chainId})`);
  console.log(`⚖️  权重: Pyth ${ORACLE_WEIGHTS.PYTH}% + RedStone ${ORACLE_WEIGHTS.REDSTONE}%`);
  console.log(`💱 支持: ${Object.keys(FEED_IDS).join(", ")}`);
  console.log("");
  console.log("📍 合约地址:");
  console.log(`   PythPriceFeed:      ${pythPriceFeedAddress}`);
  console.log(`   MockRedStoneOracle: ${mockRedStoneAddress}`);  
  console.log(`   RedstonePriceFeed:  ${redstonePriceFeedAddress}`);
  console.log(`   PriceAggregator:    ${priceAggregatorAddress}`);
  console.log("");
  console.log("🧪 股票价格测试结果:");
  for (const symbol of testSymbols) {
    if (testResults[symbol]) {
      console.log(`\n📊 ${symbol}:`);
      console.log(`   Pyth:      ${testResults[symbol].pyth?.success ? '$' + testResults[symbol].pyth.price : '❌ ' + testResults[symbol].pyth?.error}`);
      console.log(`   RedStone:  ${testResults[symbol].redstone?.success ? '$' + testResults[symbol].redstone.price : '❌ ' + testResults[symbol].redstone?.error}`);
      console.log(`   聚合价格:   ${testResults[symbol].aggregated?.success ? '$' + testResults[symbol].aggregated.price : '❌ ' + testResults[symbol].aggregated?.error}`);
    }
  }
  console.log("");
  console.log("🚀 后续步骤:");
  console.log("   1. 监控所有股票价格获取性能");
  console.log("   2. 集成到 StockToken 合约");
  console.log("   3. 部署到主网前进行全面测试");
  console.log(`   4. 查看详细部署信息: ${deploymentFileName}`);
  
  return {
    contracts: deployedContracts,
    testResults: testResults,
    deploymentInfo: deploymentInfo
  };
}

// 执行部署
main()
  .then((result) => {
    console.log("\n✅ 部署脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 部署失败:", error);
    console.error(error.stack);
    process.exit(1);
  });