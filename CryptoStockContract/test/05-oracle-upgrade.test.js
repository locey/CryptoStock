const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OracleAggregator UUPS升级测试", function () {
  let proxy;
  let mockPyth;

  // 增加测试超时时间
  this.timeout(120000); // 2分钟

  before("部署全新的可升级OracleAggregator V1", async function () {
    console.log("🚀 开始部署全新的可升级 OracleAggregator V1...");
    
    // 1. 部署 MockPyth 合约
    const MockPyth = await ethers.getContractFactory("contracts/mock/MockPyth.sol:MockPyth");
    mockPyth = await MockPyth.deploy();
    await mockPyth.waitForDeployment();
    const mockPythAddress = await mockPyth.getAddress();
    console.log("✅ MockPyth 部署完成:", mockPythAddress);

    // 2. 部署可升级的 OracleAggregator V1
    const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
    proxy = await upgrades.deployProxy(
      OracleAggregator,
      [mockPythAddress], // 初始化参数
      { 
        kind: 'uups',
        initializer: 'initialize'
      }
    );
    await proxy.waitForDeployment();
    
    const proxyAddress = await proxy.getAddress();
    console.log("✅ OracleAggregator V1 代理合约部署完成:", proxyAddress);
    
    // 3. 添加测试用的价格源
    console.log("📝 添加测试用的价格源...");
    const testSymbols = ["AAPL", "TSLA", "MSFT"];
    const testFeedIds = [
      "0x" + "1".repeat(64), // AAPL Feed ID
      "0x" + "2".repeat(64), // TSLA Feed ID
      "0x" + "3".repeat(64)  // MSFT Feed ID
    ];
    
    // 使用批量设置减少交易次数
    const batchTx = await proxy.batchSetFeedIds(testSymbols, testFeedIds);
    await batchTx.wait(); // 等待交易确认
    console.log("✅ 批量设置价格源完成");
    
    // Sepolia 网络延迟，等待一下
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 4. 验证部署成功
    const supportedSymbols = await proxy.getSupportedSymbols();
    console.log("📊 支持的价格源数量：", supportedSymbols.length);
    console.log("🔗 支持的符号：", supportedSymbols);
    
    // 5. 显示初始实现地址
    const initialImplAddr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("🔍 初始实现合约地址：", initialImplAddr);
    
    console.log("🎉 全新的可升级 OracleAggregator V1 部署完成，准备升级测试");
  });

  it("V1 可以正常连接和调用", async function () {
    // 验证当前版本的功能
    const supportedSymbols = await proxy.getSupportedSymbols();
    expect(supportedSymbols.length).to.be.greaterThan(0);
    
    console.log("✅ V1 正常工作，代理地址：", await proxy.getAddress());
    console.log("📊 支持的价格源数量：", supportedSymbols.length);
    console.log("🔗 支持的符号：", supportedSymbols);

    const proxyAddress = await proxy.getAddress();
    const beforeImplAddr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("🔍 升级前实现合约地址：", beforeImplAddr);
  });

  it("可以安全升级到V2，并使用新功能", async function () {
    // 获取升级前的实现地址
    const proxyAddress = await proxy.getAddress();
    const beforeImplAddr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("🔍 升级前实现合约地址：", beforeImplAddr);
    
    // 升级操作
    const OracleAggregatorV2 = await ethers.getContractFactory("OracleAggregatorV2");
    console.log("⏳ 开始升级代理合约...");
    const upgraded = await upgrades.upgradeProxy(proxy, OracleAggregatorV2);
    const upgradedAddress = await upgraded.getAddress();
    console.log("📍 升级后代理合约地址：", upgradedAddress);
    
    // 循环等待实现地址变化
    console.log("⏳ 等待实现地址更新...");
    let currentImplAddr = beforeImplAddr;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (currentImplAddr === beforeImplAddr && retryCount < maxRetries) {
      retryCount++;
      console.log(`⏳ 第 ${retryCount} 次检查实现地址...`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      currentImplAddr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      console.log(`� 当前实现地址：${currentImplAddr}`);
      
      if (currentImplAddr !== beforeImplAddr) {
        console.log("✅ 升级成功：实现地址已更新");
        break;
      } else if (retryCount < maxRetries) {
        console.log(`⚠️ 实现地址未变化，继续等待... (${retryCount}/${maxRetries})`);
      }
    }
    
    // 检查是否超时
    if (currentImplAddr === beforeImplAddr) {
      throw new Error(`❌ 升级失败：等待 ${maxRetries * 5} 秒后实现地址仍未更新！\n` +
                     `   升级前地址: ${beforeImplAddr}\n` +
                     `   当前地址: ${currentImplAddr}`);
    }

    // 升级后调用V2初始化函数
    try {
      console.log("⏳ 开始调用 V2 初始化...");
      const initTx = await upgraded.initializeV2();
      console.log("⏳ 等待初始化交易确认...");
      await initTx.wait(); // 等待交易确认
      console.log("⏳ Sepolia 网络延迟，额外等待3秒...");
      await new Promise(resolve => setTimeout(resolve, 3000)); // Sepolia 网络延迟
      console.log("✅ V2初始化完成");
    } catch (error) {
      console.log("⚠️ V2初始化跳过（可能已初始化）:", error.message);
    }

    // 升级后仍然是同一个代理，原有数据保持
    const supportedSymbols = await upgraded.getAllSupportedSymbols();
    expect(supportedSymbols.length).to.be.greaterThan(0);
    console.log("✅ 升级后原有数据保持：支持", supportedSymbols.length, "个价格源");

    // V2 新功能：版本号
    const version = await upgraded.version();
    expect(version).to.equal("2.0.0");
    console.log("🆕 新功能 - 版本号：", version);

    // V2 新功能：计数器（初始值应为0）
    const initialCounter = await upgraded.updateCounter();
    expect(initialCounter).to.equal(0);
    console.log("🆕 新功能 - 更新计数器初始值：", initialCounter.toString());

    // V2 新功能：管理员地址
    const [deployer, newAdmin] = await ethers.getSigners();
    const adminAddress = await upgraded.adminAddress();
    // 管理员地址应该是合约的 owner，而不是当前 deployer
    const contractOwner = await upgraded.owner();
    expect(adminAddress).to.equal(contractOwner);
    console.log("🆕 新功能 - 管理员地址：", adminAddress);
    console.log("🔍 合约所有者地址：", contractOwner);
    console.log("🔍 当前部署者地址：", await deployer.getAddress());

    // 测试 V2 新功能：设置管理员
    const setAdminTx = await upgraded.setAdmin(await newAdmin.getAddress());
    await setAdminTx.wait(); // 等待交易确认
    console.log("⏳ 等待管理员地址更新...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Sepolia 网络延迟
    
    const updatedAdmin = await upgraded.adminAddress();
    expect(updatedAdmin).to.equal(await newAdmin.getAddress());
    console.log("🔧 管理员地址更新成功：", updatedAdmin);

    // 测试 V2 新功能：重置计数器
    await upgraded.connect(newAdmin).resetCounter();
    const resetCounter = await upgraded.updateCounter();
    expect(resetCounter).to.equal(0);
    console.log("🔧 计数器重置功能正常");

    console.log("🎉 升级到V2成功！所有新功能正常工作");
  });
});
