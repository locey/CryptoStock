const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const fs = require('fs');

describe("StockToken UUPS升级测试", function () {
  let tokenFactory;
  let aaplToken;
  let aaplTokenV2;
  let deployer, user1;
  
  // 增加测试超时时间
  this.timeout(300000); // 5分钟

  before("加载已部署的合约和AAPL代币", async function () {
    [deployer, user1] = await ethers.getSigners();
    console.log("🚀 开始加载已部署的合约...");
    console.log("📝 测试账户:", await deployer.getAddress());
    
    // 读取部署信息
    const deploymentFile = 'deployments-uups-sepolia.json';
    let deploymentData;
    
    try {
      if (fs.existsSync(deploymentFile)) {
        deploymentData = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
        console.log("✅ 成功加载部署信息:", deploymentFile);
      } else {
        throw new Error(`部署文件不存在: ${deploymentFile}`);
      }
    } catch (error) {
      console.error("❌ 加载部署信息失败:", error.message);
      throw error;
    }

    // 连接到已部署的TokenFactory
    const TokenFactory = await ethers.getContractFactory("TokenFactory");
    tokenFactory = TokenFactory.attach(deploymentData.contracts.TokenFactory.proxy);
    console.log("✅ TokenFactory 连接成功:", await tokenFactory.getAddress());

    // 连接到已部署的AAPL代币
    const aaplAddress = deploymentData.stockTokens.AAPL;
    if (!aaplAddress) {
      throw new Error("AAPL代币地址未找到");
    }
    
    const StockToken = await ethers.getContractFactory("StockToken");
    aaplToken = StockToken.attach(aaplAddress);
    console.log("✅ AAPL StockToken 连接成功:", aaplAddress);
    
    // 验证连接
    const tokenName = await aaplToken.name();
    const tokenSymbol = await aaplToken.symbol();
    console.log("📊 代币信息:", tokenName, "-", tokenSymbol);
    
    console.log("🎉 合约加载完成，准备升级测试");
  });

  it("V1 AAPL代币可以正常工作", async function () {
    // 验证当前版本的功能
    const name = await aaplToken.name();
    const symbol = await aaplToken.symbol();
    const totalSupply = await aaplToken.totalSupply();
    
    console.log("✅ V1 AAPL代币正常工作");
    console.log("📊 代币名称:", name);
    console.log("📊 代币符号:", symbol);
    console.log("📊 总供应量:", ethers.formatEther(totalSupply));
    
    expect(symbol).to.equal("AAPL");
    expect(totalSupply).to.be.greaterThan(0);
    
    // 检查是否有upgradeNote函数（V1应该没有）
    let hasUpgradeNote = false;
    try {
      await aaplToken.getUpgradeNote();
      hasUpgradeNote = true;
    } catch (error) {
      console.log("✅ V1确认：没有upgradeNote函数 (符合预期)");
    }
    
    expect(hasUpgradeNote).to.be.false;
  });

  it("可以安全升级AAPL代币到V2，并使用新功能", async function () {
    console.log("⏳ 开始升级AAPL代币到V2...");
    
    // 记录升级前的信息
    const beforeName = await aaplToken.name();
    const beforeSymbol = await aaplToken.symbol();
    const beforeTotalSupply = await aaplToken.totalSupply();
    const beforeBalance = await aaplToken.balanceOf(await deployer.getAddress());
    
    console.log("📊 升级前信息:");
    console.log("   名称:", beforeName);
    console.log("   符号:", beforeSymbol);
    console.log("   总供应量:", ethers.formatEther(beforeTotalSupply));
    console.log("   部署者余额:", ethers.formatEther(beforeBalance));
    
    // 读取部署信息获取代理地址
    const deploymentFile = 'deployments-uups-sepolia.json';
    const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    const proxyAddress = deploymentData.stockTokens.AAPL;
    
    console.log("📍 代理合约地址:", proxyAddress);
    
    // 使用upgrades.upgradeProxy进行升级
    console.log("⏳ 执行升级操作...");
    try {
      // 先使用forceImport导入现有代理
      const StockToken = await ethers.getContractFactory("StockToken");
      console.log("⏳ 导入现有代理合约...");
      const importedProxy = await upgrades.forceImport(proxyAddress, StockToken, { kind: 'uups' });
      console.log("✅ 代理合约导入成功");
      
      // 现在升级到V2
      const StockTokenV2 = await ethers.getContractFactory("StockTokenV2");
      console.log("⏳ 升级到StockTokenV2...");
      aaplTokenV2 = await upgrades.upgradeProxy(importedProxy, StockTokenV2);
      
      console.log("✅ 升级成功，合约地址:", await aaplTokenV2.getAddress());
    } catch (error) {
      console.error("❌ 升级失败:", error.message);
      throw error;
    }
    
    // Sepolia 网络延迟，等待一下
    console.log("⏳ 等待网络确认...");
    await new Promise(resolve => setTimeout(resolve, 10000)); // 增加到10秒
    
    // 验证升级后的状态
    console.log("🔍 验证升级后状态...");
    const afterName = await aaplTokenV2.name();
    const afterSymbol = await aaplTokenV2.symbol();
    const afterTotalSupply = await aaplTokenV2.totalSupply();
    const afterBalance = await aaplTokenV2.balanceOf(await deployer.getAddress());
    
    console.log("📊 升级后信息:");
    console.log("   名称:", afterName);
    console.log("   符号:", afterSymbol);
    console.log("   总供应量:", ethers.formatEther(afterTotalSupply));
    console.log("   部署者余额:", ethers.formatEther(afterBalance));
    
    // 验证数据保持不变
    expect(afterName).to.equal(beforeName);
    expect(afterSymbol).to.equal(beforeSymbol);
    expect(afterTotalSupply).to.equal(beforeTotalSupply);
    expect(afterBalance).to.equal(beforeBalance);
    
    // 验证V2新功能 - 增加重试机制
    console.log("🔍 测试V2新功能...");
    
    let initialNote;
    let retryCount = 0;
    const maxRetries = 3;
    
    // 重试获取upgradeNote
    while (retryCount < maxRetries) {
      try {
        console.log(`📝 第 ${retryCount + 1} 次尝试获取升级备注...`);
        initialNote = await aaplTokenV2.getUpgradeNote();
        console.log("📝 初始升级备注:", initialNote || "(空)");
        break;
      } catch (error) {
        retryCount++;
        console.log(`⚠️ 第 ${retryCount} 次尝试失败:`, error.message);
        if (retryCount < maxRetries) {
          console.log("⏳ 等待5秒后重试...");
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          throw error;
        }
      }
    }
    expect(initialNote).to.equal("");
    
    // 设置升级备注
    const testNote = "Successfully upgraded to V2 with enhanced features";
    console.log("📝 设置升级备注:", testNote);
    const setNoteTx = await aaplTokenV2.setUpgradeNote(testNote);
    await setNoteTx.wait();
    
    // 验证备注设置成功
    const updatedNote = await aaplTokenV2.getUpgradeNote();
    console.log("📝 设置后的升级备注:", updatedNote);
    expect(updatedNote).to.equal(testNote);
    
    console.log("🎉 AAPL代币升级到V2成功！");
    console.log("✅ 所有原有数据保持完整");
    console.log("✅ V2新功能正常工作");
  });
});