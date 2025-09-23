const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

describe("OracleAggregator UUPS升级测试", function () {
  let proxy;
  let DEPLOYED_PROXY_ADDRESS;

  before("读取部署信息", async function () {
    // 动态读取部署信息
    try {
      const deployData = JSON.parse(fs.readFileSync('deployments-uups-sepolia.json', 'utf8'));
      DEPLOYED_PROXY_ADDRESS = deployData.contracts.OracleAggregator.proxy;
      console.log("📖 从部署文件读取代理地址:", DEPLOYED_PROXY_ADDRESS);
    } catch (error) {
      throw new Error("❌ 无法读取部署信息文件: deployments-uups-sepolia.json");
    }
  });

  it("V1 可以正常连接和调用", async function () {
    const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
    proxy = OracleAggregator.attach(DEPLOYED_PROXY_ADDRESS);

    // 验证当前版本的功能
    const supportedSymbols = await proxy.getSupportedSymbols();
    expect(supportedSymbols.length).to.be.greaterThan(0);
    
    console.log("✅ V1 正常工作，代理地址：", await proxy.getAddress());
    console.log("📊 支持的价格源数量：", supportedSymbols.length);
    console.log("🔗 支持的符号：", supportedSymbols);
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
    
    // 等待升级交易确认
    console.log("⏳ 等待升级交易确认...");
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
    
    // 检查升级后的实现地址
    const afterImplAddr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("🔄 升级后实现合约地址：", afterImplAddr);
    
    // 验证升级是否真的发生了
    if (beforeImplAddr === afterImplAddr) {
      console.log("⚠️ 警告：实现地址未变化，可能是网络延迟，再等待5秒...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      const retryImplAddr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      console.log("� 重试后实现合约地址：", retryImplAddr);
    } else {
      console.log("✅ 升级成功：实现地址已更新");
    }

    // 升级后调用V2初始化函数
    try {
      await upgraded.initializeV2();
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
    const [deployer] = await ethers.getSigners();
    const adminAddress = await upgraded.adminAddress();
    expect(adminAddress).to.equal(await deployer.getAddress());
    console.log("🆕 新功能 - 管理员地址：", adminAddress);

    // 测试 V2 新功能：设置管理员
    const [, newAdmin] = await ethers.getSigners();
    await upgraded.setAdmin(await newAdmin.getAddress());
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
