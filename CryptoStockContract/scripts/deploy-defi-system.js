const { ethers, upgrades } = require("hardhat");

/**
 * 部署 Defi 聚合器系统脚本
 * 包括: MockAavePool, MockAToken 和 DefiAggregator
 * 使用方法: npx hardhat run scripts/deploy-defi-system.js --network <network>
 */

async function main() {
  console.log("🚀 开始部署 Defi 系统...\n");
  
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
  let MockERC20; // 声明在外层作用域
  
  try {
    // STEP 1: 部署 MockERC20 作为 USDT
    console.log("📄 [STEP 1] 部署 MockERC20 (USDT)...");
    MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
    const usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
    await usdtToken.waitForDeployment();
    const usdtAddress = await usdtToken.getAddress();
    console.log("✅ MockERC20 (USDT) 部署完成:", usdtAddress);
    deploymentAddresses.MockERC20_USDT = usdtAddress;
    
    // STEP 2: 部署 MockAavePool (所有网络都使用Mock版本)
    console.log("\n📄 [STEP 2] 部署 MockAavePool...");
    const MockAavePool = await ethers.getContractFactory("contracts/mock/MockAavePool.sol:MockAavePool");
    const mockAavePool = await MockAavePool.deploy();
    await mockAavePool.waitForDeployment();
    const mockAavePoolAddress = await mockAavePool.getAddress();
    console.log("✅ MockAavePool 部署完成:", mockAavePoolAddress);
    deploymentAddresses.MockAavePool = mockAavePoolAddress;
    
    // STEP 2.1: 部署 MockAToken (aUSDT)
    console.log("\n📄 [STEP 2.1] 部署 MockAToken (aUSDT)...");
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
    
    // STEP 2.2: 初始化 Aave Pool 的资产储备
    console.log("\n📄 [STEP 2.2] 初始化 Aave Pool 储备...");
    await mockAavePool.initReserve(usdtAddress, mockATokenAddress);
    console.log("✅ USDT-aUSDT 储备初始化完成");
    
    // STEP 3: 部署可升级的 DefiAggregator
    console.log("\n📄 [STEP 3] 部署 DefiAggregator (可升级)...");
    const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
    
    console.log("   初始化参数:");
    console.log("   - Aave Pool:", mockAavePoolAddress);
    console.log("   - USDT Token:", usdtAddress);
    console.log("   - Owner:", deployer.address);
    
    const defiAggregator = await upgrades.deployProxy(
      DefiAggregator,
      [
        mockAavePoolAddress,  // _aavePool
        usdtAddress,          // _usdtToken  
        deployer.address      // _owner
      ],
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
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(defiAggregatorAddress);
    console.log("   实现合约地址:", implementationAddress);
    deploymentAddresses.DefiAggregator_Implementation = implementationAddress;
    
    // STEP 4: 验证合约状态
    console.log("\n📄 [STEP 4] 验证合约状态...");
    
    // 验证 DefiAggregator 配置
    const aavePoolInContract = await defiAggregator.aavePool();
    const usdtTokenInContract = await defiAggregator.usdtToken();
    const ownerInContract = await defiAggregator.owner();
    
    console.log("   DefiAggregator 配置验证:");
    console.log("   - Aave Pool:", aavePoolInContract, aavePoolInContract === mockAavePoolAddress ? "✅" : "❌");
    console.log("   - USDT Token:", usdtTokenInContract, usdtTokenInContract === usdtAddress ? "✅" : "❌");
    console.log("   - Owner:", ownerInContract, ownerInContract === deployer.address ? "✅" : "❌");
    
    // STEP 5: 测试基础功能
    console.log("\n📄 [STEP 5] 测试基础功能...");
    
    // 给部署者一些 USDT 用于测试
    const usdtContract = MockERC20.attach(usdtAddress);
    const mintAmount = ethers.parseUnits("1000", 6); // 1000 USDT (6 decimals)
    await usdtContract.mint(deployer.address, mintAmount);
    console.log("   ✅ 为部署者铸造 1000 USDT");
    
    // 测试存款功能
    const depositAmount = ethers.parseUnits("100", 6); // 100 USDT
    
    // 用户授权 DefiAggregator 转移 USDT
    await usdtContract.approve(defiAggregatorAddress, depositAmount);
    console.log("   ✅ 授权 DefiAggregator 转移 100 USDT");
    
    // 执行存款
    await defiAggregator.deposit(depositAmount);
    console.log("   ✅ 成功存入 100 USDT");
    
    // 检查存款余额
    const depositBalance = await defiAggregator.getDepositBalance(deployer.address);
    console.log("   📊 存款余额:", ethers.formatUnits(depositBalance, 6), "USDT");
    
    console.log("   🎉 基础功能测试通过!");
    
    // STEP 6: 保存部署结果
    console.log("\n📄 [STEP 6] 保存部署结果...");
    
    const fs = require('fs');
    const deploymentFile = `deployments-defi-${networkName}.json`;
    
    const deploymentData = {
      network: networkName,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deploymentAddresses
    };
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("✅ 部署结果已保存到:", deploymentFile);
    
    // 最终总结
    console.log("\n🎉 Defi 系统部署完成!");
    console.log("📋 部署地址摘要:");
    Object.entries(deploymentAddresses).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
    
    console.log("\n🔧 下一步操作建议:");
    console.log("1. 验证合约源码 (如果在测试网)");
    console.log("2. 测试存款和取款功能");
    console.log("3. 如需升级，使用 upgrades.upgradeProxy()");
    console.log("4. 配置前端应用使用这些合约地址");
    
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