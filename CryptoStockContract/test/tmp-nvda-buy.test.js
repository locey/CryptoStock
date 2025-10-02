const { expect } = require("chai");
const { ethers } = require("hardhat");
const { fetchUpdateData } = require("../utils/getPythUpdateData");
const fs = require("fs");
const path = require("path");

// NVDA 相关常量
const NVDA_SYMBOL = "NVDA";
const USER_USDT = ethers.parseUnits("1000", 6);
const USER_NVDA = ethers.parseEther("1000");
const NVDA_FEED_ID = "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593";

let isLocalNetwork, isSepoliaNetwork;

// 辅助函数
async function smartWait(tx, description = "交易") {
  const receipt = await tx.wait();
  return receipt;
}

describe("NVDA 买入功能测试", function () {
  this.timeout(120000);
  let owner, user, usdtToken, nvdaToken, tokenFactory, oracleAggregator, mockPyth;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    
    // 判断网络类型
    const network = await ethers.provider.getNetwork();
    isLocalNetwork = ["hardhat", "localhost", 31337].includes(network.name) || network.chainId === 31337n || network.chainId === 31337;
    isSepoliaNetwork = network.chainId === 11155111n || network.chainId === 11155111;
    
    console.log(`🌐 当前网络: ${network.name} (chainId: ${network.chainId})`);
    console.log(`🔧 isLocalNetwork: ${isLocalNetwork}, isSepoliaNetwork: ${isSepoliaNetwork}`);
    
    if (isLocalNetwork) {
      // 本地网络：部署所有合约
      console.log("🏠 [本地网络] 开始部署合约...");
      
      // 部署 MockPyth 合约
      const MockPyth = await ethers.getContractFactory("contracts/mock/MockPyth.sol:MockPyth");
      mockPyth = await MockPyth.deploy();
      await mockPyth.waitForDeployment();
      
      // 部署 USDT 代币
      const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
      usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
      await usdtToken.waitForDeployment();
      
      // 部署 OracleAggregator 代理合约
      const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
      const oracleImpl = await OracleAggregator.deploy();
      await oracleImpl.waitForDeployment();
      
      const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
      const initData = oracleImpl.interface.encodeFunctionData("initialize", [await mockPyth.getAddress()]);
      const oracleProxy = await ERC1967Proxy.deploy(await oracleImpl.getAddress(), initData);
      await oracleProxy.waitForDeployment();
      oracleAggregator = await ethers.getContractAt("OracleAggregator", await oracleProxy.getAddress());
      
      // 部署 TokenFactory 代理合约
      const TokenFactory = await ethers.getContractFactory("TokenFactory");
      const factoryImpl = await TokenFactory.deploy();
      await factoryImpl.waitForDeployment();
      
      const factoryInitData = factoryImpl.interface.encodeFunctionData("initialize", [await oracleAggregator.getAddress(), await usdtToken.getAddress()]);
      const factoryProxy = await ERC1967Proxy.deploy(await factoryImpl.getAddress(), factoryInitData);
      await factoryProxy.waitForDeployment();
      tokenFactory = await ethers.getContractAt("TokenFactory", await factoryProxy.getAddress());
      
      // 设置 MockPyth 价格
      const now = Math.floor(Date.now() / 1000);
      await mockPyth.setPrice(NVDA_FEED_ID, 12800, -2, now); // $128.00
      await oracleAggregator.setFeedId(NVDA_SYMBOL, NVDA_FEED_ID);
      
    } else {
      // Sepolia网络：从部署文件读取合约地址
      console.log("🌐 [Sepolia网络] 从部署文件读取合约地址...");
      const deploymentsPath = path.join(__dirname, '..', 'deployments-uups-sepolia.json');
      
      if (!fs.existsSync(deploymentsPath)) {
        throw new Error(`❌ 部署文件不存在: ${deploymentsPath}`);
      }
      
      const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
      
      console.log("📡 连接到Sepolia网络合约...");
      tokenFactory = await ethers.getContractAt("TokenFactory", deployments.contracts.TokenFactory.proxy);
      oracleAggregator = await ethers.getContractAt("OracleAggregator", deployments.contracts.OracleAggregator.proxy);
      usdtToken = await ethers.getContractAt("contracts/mock/MockERC20.sol:MockERC20", deployments.contracts.USDT);
      console.log(`✅ 合约连接完成`);
    }

    // 创建 NVDA 代币（如果不存在）
    let nvdaAddr = await tokenFactory.getTokenAddress(NVDA_SYMBOL);
    if (nvdaAddr === ethers.ZeroAddress) {
      console.log("🔨 创建 NVDA 代币...");
      const tx = await tokenFactory.createToken("NVIDIA Stock Token", NVDA_SYMBOL, ethers.parseEther("1000000"));
      await smartWait(tx, "NVDA代币创建");
      nvdaAddr = await tokenFactory.getTokenAddress(NVDA_SYMBOL);
    }
    nvdaToken = await ethers.getContractAt("StockToken", nvdaAddr);
    console.log(`✅ NVDA 代币地址: ${nvdaAddr}`);

    // 检查并给用户 mint USDT
    const userUsdtBalance = await usdtToken.balanceOf(user.address);
    if (userUsdtBalance < USER_USDT) {
      console.log(`💰 给用户 mint USDT...`);
      await usdtToken.mint(user.address, USER_USDT);
    }
    
    // 检查并给 NVDA 合约注入足够的 NVDA
    const nvdaContractBalance = await nvdaToken.balanceOf(await nvdaToken.getAddress());
    if (nvdaContractBalance < USER_NVDA) {
      console.log(`🪙 给 NVDA 合约注入代币...`);
      await nvdaToken.injectTokens(USER_NVDA);
    }
    
    // 用户授权 USDT 给 NVDA
    const allowance = await usdtToken.allowance(user.address, await nvdaToken.getAddress());
    if (allowance < USER_USDT) {
      console.log(`🔐 用户授权 USDT 给 NVDA 合约...`);
      await usdtToken.connect(user).approve(await nvdaToken.getAddress(), USER_USDT);
    }
  });

  it("用户用 USDT 买入 NVDA，余额变化验证", async function () {
    const buyAmount = ethers.parseUnits("100", 6); // 100 USDT
    const beforeUsdt = await usdtToken.balanceOf(user.address);
    const beforeNvda = await nvdaToken.balanceOf(user.address);

    // 准备更新数据和费用
    let buyUpdateData, buyFee;
    if (isLocalNetwork) {
      buyUpdateData = [];
      buyFee = 0n;
    } else {
      buyUpdateData = await fetchUpdateData([NVDA_SYMBOL]);
      buyFee = await oracleAggregator.getUpdateFee(buyUpdateData);
    }

    // 设置交易选项
    const overrides = {
      value: buyFee,
      gasLimit: 2_000_000
    };

    console.log(`💰 买入金额: ${ethers.formatUnits(buyAmount, 6)} USDT`);
    console.log(`🔮 更新数据长度: ${buyUpdateData.length}`);
    console.log(`💸 预言机费用: ${ethers.formatEther(buyFee)} ETH`);

    // 买入 NVDA
    const tx = await nvdaToken.connect(user).buy(buyAmount, 0, buyUpdateData, overrides);
    await smartWait(tx, "买入NVDA");

    const afterUsdt = await usdtToken.balanceOf(user.address);
    const afterNvda = await nvdaToken.balanceOf(user.address);

    expect(afterUsdt).to.be.lt(beforeUsdt);
    expect(afterNvda).to.be.gt(beforeNvda);
    
    console.log(`✅ 用户买入成功！`);
    console.log(`📈 USDT 余额变化: ${ethers.formatUnits(beforeUsdt, 6)} → ${ethers.formatUnits(afterUsdt, 6)}`);
    console.log(`📈 NVDA 余额变化: ${ethers.formatEther(beforeNvda)} → ${ethers.formatEther(afterNvda)}`);
  });
});
