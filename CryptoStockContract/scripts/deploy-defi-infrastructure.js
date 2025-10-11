const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 部署 DeFi 基础设施脚本
 * 包括: DefiAggregator
 * 复用之前股票系统中部署的 USDT 合约
 * 使用方法: npx hardhat run scripts/deploy-defi-infrastructure.js --network <network>
 */

// 读取之前部署的合约地址
function loadExistingDeployments(networkName) {
  // 优先尝试读取股票系统部署文件
  const stockDeploymentFile = `deployments-stock-${networkName}.json`;
  const uupsDeploymentFile = `deployments-uups-${networkName}.json`;
  
  // 首先检查股票系统部署文件
  if (fs.existsSync(stockDeploymentFile)) {
    console.log(`📁 找到股票系统部署文件: ${stockDeploymentFile}`);
    const stockDeployments = JSON.parse(fs.readFileSync(stockDeploymentFile, 'utf8'));
    return {
      USDT: stockDeployments.contracts.USDT,
      deployer: stockDeployments.deployer
    };
  }
  
  // 如果没有股票系统文件，则检查旧的UUPS文件（向后兼容）
  if (fs.existsSync(uupsDeploymentFile)) {
    console.log(`📁 找到UUPS部署文件: ${uupsDeploymentFile}`);
    const uupsDeployments = JSON.parse(fs.readFileSync(uupsDeploymentFile, 'utf8'));
    return {
      USDT: uupsDeployments.contracts.USDT,
      deployer: uupsDeployments.deployer
    };
  }
  
  console.log(`⚠️  未找到股票系统部署文件: ${stockDeploymentFile}`);
  console.log(`⚠️  未找到UUPS部署文件: ${uupsDeploymentFile}`);
  return null;
}

// ABI 提取函数
async function extractABIFiles() {
  console.log("\n🔧 [ABI提取] 开始提取ABI文件...");
  
  // 需要提取ABI的合约列表
  const contracts = [
    'DefiAggregator'
  ];

  // 提取三个代币的 ABI
  const mockContracts = [
    'MockERC20'
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
  
  // 加载已存在的部署信息
  console.log("📁 [STEP 0] 加载已存在的合约地址...");
  const existingDeployments = loadExistingDeployments(networkName);
  
  let usdtAddress;
  if (existingDeployments && existingDeployments.USDT) {
    usdtAddress = existingDeployments.USDT;
    console.log("✅ 复用已部署的 USDT:", usdtAddress);
    deploymentAddresses.MockERC20_USDT = usdtAddress; // 统一使用 MockERC20_USDT 字段名
  } else {
    throw new Error(`❌ 未找到已部署的 USDT 合约！\n请先部署股票系统或确保 deployments-stock-${networkName}.json 文件存在且包含 USDT 地址`);
  }

  // STEP 1: 部署 USDC 和 DAI 代币（总是部署新的）
  console.log("\n📄 [STEP 1] 部署 USDC 和 DAI 代币...");
  const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
  
  // 部署 USDC (6位精度，和真实 USDC 一致)
  console.log("   正在部署 USDC...");
  const usdcToken = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdcToken.waitForDeployment();
  const usdcAddress = await usdcToken.getAddress();
  console.log("✅ MockERC20 (USDC) 部署完成:", usdcAddress);
  deploymentAddresses.MockERC20_USDC = usdcAddress;
  
  // 部署 DAI (18位精度，和真实 DAI 一致)
  console.log("   正在部署 DAI...");
  const daiToken = await MockERC20.deploy("Dai Stablecoin", "DAI", 18);
  await daiToken.waitForDeployment();
  const daiAddress = await daiToken.getAddress();
  console.log("✅ MockERC20 (DAI) 部署完成:", daiAddress);
  deploymentAddresses.MockERC20_DAI = daiAddress;
  
  console.log("\n📊 代币配置完成:");
  console.log("   - USDC (6 decimals):", usdcAddress, "(新部署)");
  console.log("   - USDT (6 decimals):", usdtAddress, "(复用已有)");
  console.log("   - DAI (18 decimals):", daiAddress, "(新部署)");
  
  // 等待网络确认 (如果是测试网络)
  if (networkName !== "localhost" && networkName !== "hardhat") {
    console.log("⏳ 等待网络确认...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // 增加等待时间
  }
  
  try {

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
    
    // STEP 4: 验证合约连接性
    console.log("\n📄 [STEP 4] 验证合约连接性...");
    
    // 验证复用的 USDT 合约（现在总是复用）
    try {
      const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
      const usdtContract = MockERC20.attach(usdtAddress);
      
      const name = await usdtContract.name();
      const symbol = await usdtContract.symbol();
      const decimals = await usdtContract.decimals();
      
      console.log("   复用 USDT 合约信息:");
      console.log("   - Name:", name);
      console.log("   - Symbol:", symbol);
      console.log("   - Decimals:", decimals.toString());
      console.log("   ✅ USDT 合约连接验证成功");
    } catch (error) {
      console.log("   ❌ USDT 合约连接验证失败:", error.message);
      throw new Error("复用的USDT合约无法连接，请检查部署文件");
    }
    
    // 验证新部署的 USDC 合约
    try {
      const usdcContract = await ethers.getContractAt("MockERC20", deploymentAddresses.MockERC20_USDC);
      const usdcName = await usdcContract.name();
      const usdcSymbol = await usdcContract.symbol();
      const usdcDecimals = await usdcContract.decimals();
      
      console.log("   新部署 USDC 合约信息:");
      console.log("   - Name:", usdcName);
      console.log("   - Symbol:", usdcSymbol);
      console.log("   - Decimals:", usdcDecimals.toString());
      console.log("   ✅ USDC 合约验证成功");
    } catch (error) {
      console.log("   ❌ USDC 合约验证失败:", error.message);
    }
    
    // 验证新部署的 DAI 合约
    try {
      const daiContract = await ethers.getContractAt("MockERC20", deploymentAddresses.MockERC20_DAI);
      const daiName = await daiContract.name();
      const daiSymbol = await daiContract.symbol();
      const daiDecimals = await daiContract.decimals();
      
      console.log("   新部署 DAI 合约信息:");
      console.log("   - Name:", daiName);
      console.log("   - Symbol:", daiSymbol);
      console.log("   - Decimals:", daiDecimals.toString());
      console.log("   ✅ DAI 合约验证成功");
    } catch (error) {
      console.log("   ❌ DAI 合约验证失败:", error.message);
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
      reusedContracts: {
        USDT: existingDeployments.USDT,
        sourceDeployment: `deployments-uups-${networkName}.json`
      },
      notes: {
        description: "DeFi基础设施部署，包含DefiAggregator，复用已部署的USDT，新部署USDC和DAI",
        tokenStrategy: {
          USDT: "复用股票系统已部署的合约",
          USDC: "新部署的Mock代币(6位精度)",
          DAI: "新部署的Mock代币(18位精度)"
        },
        usage: "其他适配器脚本可以复用这些合约地址",
        nextSteps: [
          "运行适配器部署脚本 (deploy-curve-adapter-only.js 等)",
          "使用 DefiAggregator 地址注册新的适配器",
          "三个代币(USDC、USDT、DAI)可用于构建多代币池子"
        ]
      }
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    // STEP 6: 验证合约到Etherscan (仅Sepolia网络)
    if (networkName === "sepolia") {
      console.log("\n🔍 [开始验证] 正在验证合约到Etherscan...");
      try {
        // 等待几个区块确认
        console.log("⏳ 等待区块确认...");
        await new Promise(resolve => setTimeout(resolve, 30000)); // 等待30秒

        // 只验证新部署的USDT代币合约（如果有）
        if (!existingDeployments || !existingDeployments.USDT) {
          console.log("🔍 验证新部署的USDT代币合约...");
          try {
            await hre.run("verify:verify", {
              address: usdtAddress,
              constructorArguments: ["USD Tether", "USDT", 6]
            });
            console.log("✅ USDT代币合约验证成功");
          } catch (error) {
            console.log("⚠️ USDT代币合约验证跳过 (可能已验证):", error.message);
          }
        } else {
          console.log("ℹ️  跳过USDT验证 (复用已验证的合约)");
        }

        // 验证DefiAggregator实现合约
        console.log("🔍 验证DefiAggregator实现合约...");
        try {
          await hre.run("verify:verify", {
            address: defiImplementationAddress,
            constructorArguments: []
          });
          console.log("✅ DefiAggregator实现合约验证成功");
        } catch (error) {
          console.log("⚠️ DefiAggregator实现合约验证跳过 (可能已验证):", error.message);
        }

        // 验证代理合约
        console.log("🔍 验证DefiAggregator代理合约...");
        try {
          await hre.run("verify:verify", {
            address: defiAggregatorAddress
          });
          console.log("✅ DefiAggregator代理合约验证成功");
        } catch (error) {
          console.log("⚠️ DefiAggregator代理合约验证跳过:", error.message);
        }

        console.log("\n✅ [验证完成] DeFi基础设施合约验证已完成!");
      } catch (error) {
        console.log("⚠️ [验证警告] 合约验证过程中出现问题:", error.message);
        console.log("💡 提示: 您可以稍后手动验证合约");
      }
    }
    
    // STEP 7: 提取ABI文件
    await extractABIFiles();
    
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