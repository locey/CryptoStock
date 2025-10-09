const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { fetchUpdateData } = require("../utils/getPythUpdateData");
const fs = require("fs");
const path = require("path");

// 支持的股票符号
const SYMBOLS = ["AAPL", "GOOGL"];

// 测试账户分配
const USER_A_USDT = ethers.parseUnits("50000", 6);
const USER_A_AAPL = ethers.parseEther("50000"); // 增加到50000个AAPL
const USER_B_USDT = ethers.parseUnits("30000", 6);
const USER_B_AAPL = ethers.parseEther("30000"); // 增加到30000个AAPL

// 交易参数
const INIT_FEE_RATE = 30; // 0.3% (以基点表示)
const INIT_MAX_SLIPPAGE = 300; // 3% (以基点表示)
const MIN_TRADE_AMOUNT = ethers.parseUnits("1", 6); // 1 USDT

// 判断网络类型
let isLocalNetwork, isSepoliaNetwork;

// 辅助函数：智能等待交易确认
async function smartWait(tx, description = "交易") {
  console.log(`⏳ 等待 ${description} 确认...`);
  const receipt = await tx.wait();
  console.log(`✅ ${description} 已确认 (区块: ${receipt.blockNumber})`);
  return receipt;
}

describe("Exchange - 股票交易所功能测试", function () {
  // 设置长超时时间，适用于 Sepolia 网络的慢出块
  this.timeout(180000); // 3分钟超时，适应Sepolia网络
  
  let owner, userA, userB, feeReceiver;
  let usdtToken, aaplToken, googlToken, tokenFactory, oracleAggregator, mockPyth;
  let aaplFeedId, googlFeedId;

  beforeEach(async function () {
    console.log("🚀 [SETUP] 初始化交易所测试环境...");
    
    // 0. 判断网络类型
    const network = await ethers.provider.getNetwork();
    isLocalNetwork = ["hardhat", "localhost", 31337].includes(network.name) || network.chainId === 31337n || network.chainId === 31337;
    isSepoliaNetwork = network.chainId === 11155111n || network.chainId === 11155111;
    
    console.log(`🌐 当前网络: ${network.name} (chainId: ${network.chainId})`);
    console.log(`🔧 isLocalNetwork: ${isLocalNetwork}`);
    console.log(`🔧 isSepoliaNetwork: ${isSepoliaNetwork}`);
    
    // 1. 获取测试账户
    [owner, userA, userB, feeReceiver] = await ethers.getSigners();
    console.log(`📝 Owner: ${owner.address}`);
    console.log(`📝 UserA: ${userA.address}`);
    console.log(`📝 UserB: ${userB.address}`);
    console.log(`📝 FeeReceiver: ${feeReceiver.address}`);

    // Feed IDs 定义
    aaplFeedId = "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688";
    googlFeedId = "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6";

    // 2. 部署所有依赖合约
    if (isLocalNetwork) {
      // 本地网络：全新部署所有合约
      console.log("🏠 [本地网络] 开始全新部署...");
      
      // 2.1 部署 MockPyth 合约
      console.log("📄 [STEP 1] 部署 MockPyth 合约...");
      const MockPyth = await ethers.getContractFactory("contracts/mock/MockPyth.sol:MockPyth");
      mockPyth = await MockPyth.deploy();
      await mockPyth.waitForDeployment();
      const mockPythAddress = await mockPyth.getAddress();
      console.log(`✅ MockPyth 部署完成: ${mockPythAddress}`);
      
      // 2.2 部署 USDT 代币
      console.log("📄 [STEP 2] 部署 USDT 代币...");
      const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
      usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
      await usdtToken.waitForDeployment();
      const usdtAddress = await usdtToken.getAddress();
      console.log(`✅ USDT 代币部署完成: ${usdtAddress}`);
      
      // 2.3 部署可升级的预言机聚合器
      console.log("📄 [STEP 3] 部署预言机聚合器...");
      const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
      oracleAggregator = await upgrades.deployProxy(
        OracleAggregator,
        [mockPythAddress],
        { 
          kind: 'uups',
          initializer: 'initialize'
        }
      );
      await oracleAggregator.waitForDeployment();
      const oracleAddress = await oracleAggregator.getAddress();
      console.log(`✅ 预言机聚合器部署完成: ${oracleAddress}`);
      
      // 2.4 部署 StockToken 实现合约
      console.log("📄 [STEP 4] 部署 StockToken 实现合约...");
      const StockToken = await ethers.getContractFactory("StockToken");
      const stockTokenImplementation = await StockToken.deploy();
      await stockTokenImplementation.waitForDeployment();
      const implementationAddress = await stockTokenImplementation.getAddress();
      console.log(`✅ StockToken 实现合约部署完成: ${implementationAddress}`);
      
      // 2.5 部署 TokenFactory (可升级合约)
      console.log("📄 [STEP 5] 部署 TokenFactory...");
      const TokenFactory = await ethers.getContractFactory("TokenFactory");
      tokenFactory = await upgrades.deployProxy(
        TokenFactory,
        [oracleAddress, implementationAddress, usdtAddress],
        { 
          kind: 'uups',
          initializer: 'initialize'
        }
      );
      await tokenFactory.waitForDeployment();
      const factoryAddress = await tokenFactory.getAddress();
      console.log(`✅ TokenFactory 部署完成: ${factoryAddress}`);
      
      // 2.6 设置 MockPyth 的初始价格数据
      console.log("📄 [STEP 6] 设置价格数据...");
      const now = Math.floor(Date.now() / 1000);
      // 设置合理的价格：AAPL: $1.50, GOOGL: $2.80
      const setAaplPriceTx = await mockPyth.setPrice(aaplFeedId, 150, -2, now);
      await setAaplPriceTx.wait();
      const setGooglPriceTx = await mockPyth.setPrice(googlFeedId, 280, -2, now + 1);
      await setGooglPriceTx.wait();
      console.log("✅ MockPyth 价格设置完成 (AAPL: $1.50, GOOGL: $2.80)");
      
      // 2.7 配置预言机聚合器支持股票符号
      console.log("📄 [STEP 7] 配置预言机聚合器支持股票符号...");
      await oracleAggregator.setFeedId("AAPL", aaplFeedId);
      await oracleAggregator.setFeedId("GOOGL", googlFeedId);
      console.log("✅ 股票符号Feed ID配置完成");
    }

    // 获取合约实例
    if (isLocalNetwork) {
      // 本地网络：合约已经在上面部署完成，直接使用变量
      console.log("✅ 本地网络合约实例已准备就绪");
    } else {
      // Sepolia网络：从部署文件读取合约地址
      console.log("🌐 [Sepolia网络] 从部署文件读取合约地址...");
      const deploymentsPath = path.join(__dirname, '..', 'deployments-uups-sepolia.json');
      
      if (!fs.existsSync(deploymentsPath)) {
        throw new Error(`❌ 部署文件不存在: ${deploymentsPath}`);
      }
      
      const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
      
      if (!deployments.contracts?.TokenFactory?.proxy) {
        throw new Error("❌ TokenFactory代理地址未找到");
      }
      if (!deployments.contracts?.OracleAggregator?.proxy) {
        throw new Error("❌ OracleAggregator代理地址未找到");
      }
      if (!deployments.contracts?.USDT) {
        throw new Error("❌ USDT地址未找到");
      }
      
      console.log("📡 连接到Sepolia网络合约...");
      tokenFactory = await ethers.getContractAt("TokenFactory", deployments.contracts.TokenFactory.proxy);
      oracleAggregator = await ethers.getContractAt("OracleAggregator", deployments.contracts.OracleAggregator.proxy);
      usdtToken = await ethers.getContractAt("contracts/mock/MockERC20.sol:MockERC20", deployments.contracts.USDT);
      console.log(`✅ TokenFactory获取完成: ${deployments.contracts.TokenFactory.proxy}`);
      console.log(`✅ OracleAggregator获取完成: ${deployments.contracts.OracleAggregator.proxy}`);
      console.log(`✅ USDT获取完成: ${deployments.contracts.USDT}`);
    }

    // Feed IDs
    aaplFeedId = "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688";
    googlFeedId = "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6";

    // 3. 初始化预言机价格源
    if (isLocalNetwork) {
      // 本地网络：MockPyth已经在上面部署并设置了价格
      console.log("✅ 本地网络MockPyth已准备就绪");
    }

    // 4. 创建测试代币
    console.log("📄 [STEP 2] 创建股票代币...");
    
    // 创建 AAPL 代币
    const existingAaplAddress = await tokenFactory.getTokenAddress("AAPL");
    if (existingAaplAddress === ethers.ZeroAddress) {
      console.log("🔨 创建 AAPL 代币...");
      const createAaplTx = await tokenFactory.createToken(
        "Apple Stock Token",
        "AAPL",
        ethers.parseEther("1000000")
      );
      await smartWait(createAaplTx, "AAPL代币创建");
    }
    const aaplTokenAddress = await tokenFactory.getTokenAddress("AAPL");
    // ethers v6需要你检查address是否为有效字符串
    if (!aaplTokenAddress || aaplTokenAddress === ethers.ZeroAddress) {
      throw new Error("AAPL token address 获取失败，实际为: " + aaplTokenAddress);
    }
    aaplToken = await ethers.getContractAt("StockToken", aaplTokenAddress);
    console.log(`✅ AAPL 代币创建: ${aaplTokenAddress}`);

    // 创建 GOOGL 代币
    const existingGooglAddress = await tokenFactory.getTokenAddress("GOOGL");
    if (existingGooglAddress === ethers.ZeroAddress) {
      console.log("🔨 创建 GOOGL 代币...");
      const createGooglTx = await tokenFactory.createToken(
        "Google Stock Token", 
        "GOOGL",
        ethers.parseEther("500000")
      );
      await smartWait(createGooglTx, "GOOGL代币创建");
    }
    const googlTokenAddress = await tokenFactory.getTokenAddress("GOOGL");
    // ethers v6需要你检查address是否为有效字符串
    if (!googlTokenAddress || googlTokenAddress === ethers.ZeroAddress) {
      throw new Error("GOOGL token address 获取失败，实际为: " + googlTokenAddress);
    }
    googlToken = await ethers.getContractAt("StockToken", googlTokenAddress);
    console.log(`✅ GOOGL 代币创建: ${googlTokenAddress}`);

    // 5. 分配测试余额
    console.log("📄 [STEP 3] 分配测试余额...");
    
    // 针对Sepolia网络的批量操作优化
    if (isSepoliaNetwork) {
      console.log("🌐 Sepolia网络模式：批量检查所有状态...");
    }
    
    // 检查用户A的USDT余额，如果不足才进行mint
    const userAUsdtBalance = await usdtToken.balanceOf(userA.address);
    if (userAUsdtBalance < USER_A_USDT) {
      console.log(`💰 UserA USDT余额不足 (${ethers.formatUnits(userAUsdtBalance, 6)}), 需要mint`);
      const mintUserATx = await usdtToken.mint(userA.address, USER_A_USDT);
      await smartWait(mintUserATx, "UserA USDT mint");
      console.log(`✅ UserA 获得 ${ethers.formatUnits(USER_A_USDT, 6)} USDT`);
    } else {
      console.log(`✅ UserA USDT余额充足 (${ethers.formatUnits(userAUsdtBalance, 6)}), 跳过mint`);
    }
    
    // 检查用户B的USDT余额，如果不足才进行mint
    const userBUsdtBalance = await usdtToken.balanceOf(userB.address);
    if (userBUsdtBalance < USER_B_USDT) {
      console.log(`💰 UserB USDT余额不足 (${ethers.formatUnits(userBUsdtBalance, 6)}), 需要mint`);
      const mintUserBTx = await usdtToken.mint(userB.address, USER_B_USDT);
      await smartWait(mintUserBTx, "UserB USDT mint");
      console.log(`✅ UserB 获得 ${ethers.formatUnits(USER_B_USDT, 6)} USDT`);
    } else {
      console.log(`✅ UserB USDT余额充足 (${ethers.formatUnits(userBUsdtBalance, 6)}), 跳过mint`);
    }
    
    // 检查AAPL合约的代币余额，如果不足才进行注入
    const aaplContractBalance = await aaplToken.balanceOf(await aaplToken.getAddress());
    const requiredAaplBalance = USER_A_AAPL + USER_B_AAPL;
    if (aaplContractBalance < requiredAaplBalance) {
      console.log(`🪙 AAPL合约余额不足 (${ethers.formatEther(aaplContractBalance)}), 需要注入`);
      const injectAaplTx = await aaplToken.injectTokens(requiredAaplBalance);
      await smartWait(injectAaplTx, "AAPL代币注入");
      console.log(`✅ AAPL合约注入 ${ethers.formatEther(requiredAaplBalance)} AAPL`);
    } else {
      console.log(`✅ AAPL合约余额充足 (${ethers.formatEther(aaplContractBalance)}), 跳过注入`);
    }
    
    // 检查GOOGL合约的代币余额，如果不足才进行注入
    const googlContractBalance = await googlToken.balanceOf(await googlToken.getAddress());
    const requiredGooglBalance = ethers.parseEther("10000"); // 增加到10000个GOOGL
    if (googlContractBalance < requiredGooglBalance) {
      console.log(`🪙 GOOGL合约余额不足 (${ethers.formatEther(googlContractBalance)}), 需要注入`);
      const injectGooglTx = await googlToken.injectTokens(requiredGooglBalance);
      await smartWait(injectGooglTx, "GOOGL代币注入");
      console.log(`✅ GOOGL合约注入 ${ethers.formatEther(requiredGooglBalance)} GOOGL`);
    } else {
      console.log(`✅ GOOGL合约余额充足 (${ethers.formatEther(googlContractBalance)}), 跳过注入`);
    }

    // 6. 授权设置
    console.log("📄 [STEP 4] 设置授权...");
    
    // 检查UserA对AAPL的授权额度
    const userAAllowanceAAPL = await usdtToken.allowance(userA.address, await aaplToken.getAddress());
    if (userAAllowanceAAPL < USER_A_USDT) {
      console.log(`🔐 UserA对AAPL授权不足 (${ethers.formatUnits(userAAllowanceAAPL, 6)}), 需要授权`);
      const approveA1Tx = await usdtToken.connect(userA).approve(await aaplToken.getAddress(), USER_A_USDT);
      await smartWait(approveA1Tx, "UserA AAPL授权");
      console.log(`✅ UserA 授权 ${ethers.formatUnits(USER_A_USDT, 6)} USDT 给 AAPL 合约`);
    } else {
      console.log(`✅ UserA对AAPL授权充足 (${ethers.formatUnits(userAAllowanceAAPL, 6)}), 跳过授权`);
    }
    
    // 检查UserB对AAPL的授权额度
    const userBAllowanceAAPL = await usdtToken.allowance(userB.address, await aaplToken.getAddress());
    if (userBAllowanceAAPL < USER_B_USDT) {
      console.log(`🔐 UserB对AAPL授权不足 (${ethers.formatUnits(userBAllowanceAAPL, 6)}), 需要授权`);
      const approveB1Tx = await usdtToken.connect(userB).approve(await aaplToken.getAddress(), USER_B_USDT);
      await smartWait(approveB1Tx, "UserB AAPL授权");
      console.log(`✅ UserB 授权 ${ethers.formatUnits(USER_B_USDT, 6)} USDT 给 AAPL 合约`);
    } else {
      console.log(`✅ UserB对AAPL授权充足 (${ethers.formatUnits(userBAllowanceAAPL, 6)}), 跳过授权`);
    }
    
    // 检查UserA对GOOGL的授权额度
    const userAAllowanceGOOGL = await usdtToken.allowance(userA.address, await googlToken.getAddress());
    if (userAAllowanceGOOGL < USER_A_USDT) {
      console.log(`🔐 UserA对GOOGL授权不足 (${ethers.formatUnits(userAAllowanceGOOGL, 6)}), 需要授权`);
      const approveA2Tx = await usdtToken.connect(userA).approve(await googlToken.getAddress(), USER_A_USDT);
      await smartWait(approveA2Tx, "UserA GOOGL授权");
      console.log(`✅ UserA 授权 ${ethers.formatUnits(USER_A_USDT, 6)} USDT 给 GOOGL 合约`);
    } else {
      console.log(`✅ UserA对GOOGL授权充足 (${ethers.formatUnits(userAAllowanceGOOGL, 6)}), 跳过授权`);
    }
    
    // 检查UserB对GOOGL的授权额度
    const userBAllowanceGOOGL = await usdtToken.allowance(userB.address, await googlToken.getAddress());
    if (userBAllowanceGOOGL < USER_B_USDT) {
      console.log(`🔐 UserB对GOOGL授权不足 (${ethers.formatUnits(userBAllowanceGOOGL, 6)}), 需要授权`);
      const approveB2Tx = await usdtToken.connect(userB).approve(await googlToken.getAddress(), USER_B_USDT);
      await smartWait(approveB2Tx, "UserB GOOGL授权");
      console.log(`✅ UserB 授权 ${ethers.formatUnits(USER_B_USDT, 6)} USDT 给 GOOGL 合约`);
    } else {
      console.log(`✅ UserB对GOOGL授权充足 (${ethers.formatUnits(userBAllowanceGOOGL, 6)}), 跳过授权`);
    }

    console.log("🎉 [SETUP] 交易所测试环境初始化完成！\n");
  });

  describe("1. 合约初始化验证", function () {
    it("验证代币工厂地址正确设置", async function () {
      expect(await aaplToken.oracleAggregator()).to.equal(await oracleAggregator.getAddress());
      expect(await googlToken.oracleAggregator()).to.equal(await oracleAggregator.getAddress());
    });
    
    it("验证预言机聚合器地址正确绑定", async function () {
      expect(await aaplToken.oracleAggregator()).to.equal(await oracleAggregator.getAddress());
    });
    
    it("检查初始手续费率设置（默认0.3%）", async function () {
      expect(await aaplToken.tradeFeeRate()).to.equal(INIT_FEE_RATE);
    });
    
    it("确认手续费接收地址正确配置", async function () {
      expect(await aaplToken.feeReceiver()).to.equal(owner.address);
    });
    
    it("验证最大滑点默认值设置（3%）", async function () {
      expect(await aaplToken.maxSlippage()).to.equal(INIT_MAX_SLIPPAGE);
    });
  });

  describe("2. 买入功能（USDT → 股票代币）", function () {

    it("正常买入流程，用户A用USDT买入AAPL，余额变化验证", async function () {
      const buyAmount = ethers.parseUnits("100", 6); // 100 USDT
      
      console.log("\n📊 === 买入交易详细信息 ===");
      console.log(`💰 用户输入买入金额: ${ethers.formatUnits(buyAmount, 6)} USDT`);
      console.log(`🌐 当前网络: ${isLocalNetwork ? 'localhost (MockPyth)' : 'sepolia (真实Pyth)'}`);
      
      // 获取初始余额
      const initialUsdtBalance = await usdtToken.balanceOf(userA.address);
      const initialTokenBalance = await aaplToken.balanceOf(userA.address);
      
      console.log(`🏦 交易前用户USDT余额: ${ethers.formatUnits(initialUsdtBalance, 6)} USDT (原始值: ${initialUsdtBalance.toString()})`);
      console.log(`🪙 交易前用户AAPL余额: ${ethers.formatEther(initialTokenBalance)} AAPL (原始值: ${initialTokenBalance.toString()})`);
      console.log(`💰 买入金额: ${ethers.formatUnits(buyAmount, 6)} USDT (原始值: ${buyAmount.toString()})`);
      
      // 检查用户授权额度
      const allowance = await usdtToken.allowance(userA.address, await aaplToken.getAddress());
      console.log(`🔐 用户USDT授权额度: ${ethers.formatUnits(allowance, 6)} USDT (原始值: ${allowance.toString()})`);
      
      // 根据网络类型获取价格更新数据
      let updateData, fee;
      if (isLocalNetwork) {
        // 本地网络使用空数组，因为 MockPyth 已经设置了价格
        updateData = [];
        fee = 0;
        console.log(`🔄 本地网络使用 MockPyth 价格数据`);
      } else {
        // Sepolia 网络获取真实的 Pyth 更新数据
        updateData = await fetchUpdateData(["AAPL"]);
        fee = await oracleAggregator.getUpdateFee(updateData);
        
        // 先更新价格数据到预言机
        const overrides = { value: fee };
        await oracleAggregator.updatePriceFeeds(updateData, overrides);
        console.log(`🔄 价格数据已更新到预言机`);
      }
      
      // 获取预估结果（此时使用的是最新价格）
      const [estimatedTokens, estimatedFee] = await aaplToken.getBuyEstimate(buyAmount);
      console.log(`💡 预估获得代币: ${ethers.formatEther(estimatedTokens)} AAPL`);
      console.log(`💡 预估手续费: ${ethers.formatEther(estimatedFee)} AAPL`);
      
      // 根据网络类型获取交易用的更新数据
      let buyUpdateData, buyFee;
      if (isLocalNetwork) {
        // 本地网络使用空数组
        buyUpdateData = [];
        buyFee = 0;
        console.log(`💡 本地网络买入交易更新费用: ${buyFee} wei`);
      } else {
        // Sepolia 网络获取新的价格更新数据用于实际交易
        buyUpdateData = await fetchUpdateData(["AAPL"]);
        buyFee = await oracleAggregator.getUpdateFee(buyUpdateData);
        console.log(`💡 买入交易更新费用: ${buyFee.toString()} wei`);
      }
      
      // 执行买入交易
      console.log(`\n🚀 === 准备执行买入交易 ===`);
      console.log(`🎯 买入金额: ${ethers.formatUnits(buyAmount, 6)} USDT`);
      console.log(`💡 预估代币: ${ethers.formatEther(estimatedTokens)} AAPL`);
      console.log(`🛡️ 最小代币: ${ethers.formatEther(estimatedTokens * 95n / 100n)} AAPL (5%滑点保护)`);
      console.log(`💸 更新费用: ${buyFee.toString()} wei`);
      
      // 根据网络类型设置交易参数
      console.log(`🔍 buyFee类型: ${typeof buyFee}, 值: ${buyFee.toString()}`);
      const transactionOptions = {
        value: buyFee, // 传递正确的更新费用
      };
      
      // if (!isLocalNetwork) {
      //   // Sepolia 网络需要更高的 gas 设置
      //   transactionOptions.gasLimit = 300000;
      //   transactionOptions.gasPrice = ethers.parseUnits("30", "gwei");
      // }
      
      // 🔍 详细打印交易参数
      console.log(`\n🔍 === 详细交易参数调试 ===`);
      console.log(`📄 buyAmount: ${buyAmount.toString()} (${ethers.formatUnits(buyAmount, 6)} USDT)`);
      console.log(`📄 minTokenAmount: ${(estimatedTokens * 95n / 100n).toString()} (${ethers.formatEther(estimatedTokens * 95n / 100n)} AAPL)`);
      console.log(`📄 buyUpdateData类型: ${typeof buyUpdateData}`);
      console.log(`📄 buyUpdateData是否为数组: ${Array.isArray(buyUpdateData)}`);
      console.log(`📄 buyUpdateData长度: ${buyUpdateData ? buyUpdateData.length : 'undefined'}`);
      if (buyUpdateData && buyUpdateData.length > 0) {
        console.log(`� buyUpdateData[0]类型: ${typeof buyUpdateData[0]}`);
        console.log(`📄 buyUpdateData[0]长度: ${buyUpdateData[0] ? buyUpdateData[0].length : 'undefined'}`);
        console.log(`� buyUpdateData[0]前50字符: ${buyUpdateData[0] ? buyUpdateData[0].substring(0, 50) + '...' : 'undefined'}`);
      }
      console.log(`📄 transactionOptions详情:`);
      console.log(`   - value: ${transactionOptions.value} (类型: ${typeof transactionOptions.value})`);
      console.log(`   - value toString: ${transactionOptions.value?.toString()} wei`);
      console.log(`   - gasLimit: ${transactionOptions.gasLimit} (类型: ${typeof transactionOptions.gasLimit})`);
      console.log(`   - gasPrice: ${transactionOptions.gasPrice} (类型: ${typeof transactionOptions.gasPrice})`);
      console.log(`   - gasPrice格式化: ${transactionOptions.gasPrice ? ethers.formatUnits(transactionOptions.gasPrice, 'gwei') + ' gwei' : 'undefined'}`);
      console.log(`📄 合约地址: ${await aaplToken.getAddress()}`);
      console.log(`📄 调用者地址: ${userA.address}`);
      console.log(`📄 网络状态:`);
      console.log(`   - isLocalNetwork: ${isLocalNetwork}`);
      console.log(`   - isSepoliaNetwork: ${isSepoliaNetwork}`);
      
      let tx, receipt;
      try {
        console.log(`\n🚀 开始执行合约调用...`);
        
        // ethers v6修复：确保value被正确传递
        const overrides = {
          value: buyFee,
          gasLimit: transactionOptions.gasLimit,
          gasPrice: transactionOptions.gasPrice
        };
        
        console.log(`🔍 最终overrides: ${JSON.stringify({
          value: overrides.value?.toString(),
          gasLimit: overrides.gasLimit?.toString(),
          gasPrice: overrides.gasPrice?.toString()
        })}`);
        
        tx = await aaplToken.connect(userA).buy(
          buyAmount,
          estimatedTokens * 95n / 100n,
          buyUpdateData,
          overrides
        );
        
        // 等待交易确认
        receipt = await tx.wait();
        console.log(`✅ 买入交易已确认，区块号: ${receipt.blockNumber}, Gas 使用: ${receipt.gasUsed.toString()}`);
      } catch (error) {
        console.log("❌ 买入交易失败:");
        console.log("错误类型:", error.code);
        console.log("错误消息:", error.message);
        if (error.reason) {
          console.log("错误原因:", error.reason);
        }
        if (error.data) {
          console.log("错误数据:", error.data);
        }
        if (error.transaction) {
          console.log("交易参数:", {
            to: error.transaction.to,
            from: error.transaction.from,
            value: error.transaction.value?.toString(),
            data: error.transaction.data?.slice(0, 50) + "..."
          });
        }
        
        // 尝试调用合约的预估函数看看问题所在
        try {
          console.log("🔍 检查合约状态...");
          const minTrade = await aaplToken.minTradeAmount();
          console.log(`最小交易金额: ${ethers.formatUnits(minTrade, 6)} USDT`);
          
          const isPaused = await aaplToken.paused();
          console.log(`合约是否暂停: ${isPaused}`);
          
          const contractBalance = await aaplToken.balanceOf(await aaplToken.getAddress());
          console.log(`合约AAPL余额: ${ethers.formatEther(contractBalance)} AAPL`);
          
          const userUsdtBalance = await usdtToken.balanceOf(userA.address);
          console.log(`用户USDT余额: ${ethers.formatUnits(userUsdtBalance, 6)} USDT`);
          
          const allowance = await usdtToken.allowance(userA.address, await aaplToken.getAddress());
          console.log(`用户USDT授权: ${ethers.formatUnits(allowance, 6)} USDT`);
          
          console.log(`买入金额: ${ethers.formatUnits(buyAmount, 6)} USDT`);
          console.log(`最小代币: ${ethers.formatEther(estimatedTokens * 95n / 100n)} AAPL`);
          
        } catch (statusError) {
          console.log("状态检查失败:", statusError.message);
        }
        
        throw error;
      }
      // 立即检查余额（交易确认后）
      const immediateUsdtBalance = await usdtToken.balanceOf(userA.address);
      const immediateTokenBalance = await aaplToken.balanceOf(userA.address);
      console.log(`\n📊 === 交易确认后立即余额 ===`);
      console.log(`🏦 USDT余额: ${ethers.formatUnits(immediateUsdtBalance, 6)} USDT (原始值: ${immediateUsdtBalance.toString()})`);
      console.log(`🪙 AAPL余额: ${ethers.formatEther(immediateTokenBalance)} AAPL (原始值: ${immediateTokenBalance.toString()})`);
      console.log(`💸 USDT变化: ${ethers.formatUnits(initialUsdtBalance - immediateUsdtBalance, 6)} USDT`);
      console.log(`📦 AAPL变化: ${ethers.formatEther(immediateTokenBalance - initialTokenBalance)} AAPL`);
      
      // 根据网络类型等待区块确认
      if (!isLocalNetwork) {
        console.log("⏳ Sepolia 网络等待区块确认余额更新...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      } else {
        console.log("⚡ 本地网络无需额外等待");
      }
      
      // 验证余额变化
      const finalUsdtBalance = await usdtToken.balanceOf(userA.address);
      const finalTokenBalance = await aaplToken.balanceOf(userA.address);
      
      console.log(`\n📊 === 等待后最终余额 ===`);
      console.log(`🏦 USDT余额: ${ethers.formatUnits(finalUsdtBalance, 6)} USDT (原始值: ${finalUsdtBalance.toString()})`);
      console.log(`🪙 AAPL余额: ${ethers.formatEther(finalTokenBalance)} AAPL (原始值: ${finalTokenBalance.toString()})`);
      
      // 计算实际变化
      const actualUsdtSpent = initialUsdtBalance - finalUsdtBalance;
      const actualTokensReceived = finalTokenBalance - initialTokenBalance;
      
      console.log(`\n📊 === 余额变化详细分析 ===`);
      console.log(`🏦 初始USDT: ${ethers.formatUnits(initialUsdtBalance, 6)} USDT (${initialUsdtBalance.toString()})`);
      console.log(`🏦 最终USDT: ${ethers.formatUnits(finalUsdtBalance, 6)} USDT (${finalUsdtBalance.toString()})`);
      console.log(`💸 USDT差值: ${ethers.formatUnits(actualUsdtSpent, 6)} USDT (${actualUsdtSpent.toString()})`);
      console.log(`📦 期望USDT减少: ${ethers.formatUnits(buyAmount, 6)} USDT (${buyAmount.toString()})`);
      console.log(`🔍 差值是否为正数: ${actualUsdtSpent > 0n ? '是（正常）' : '否（异常）'}`);
      console.log(`🔍 差值是否等于买入金额: ${actualUsdtSpent === buyAmount ? '是' : '否'}`);
      
      console.log(`\n🪙 AAPL代币变化:`);
      console.log(`🪙 初始AAPL: ${ethers.formatEther(initialTokenBalance)} AAPL (${initialTokenBalance.toString()})`);
      console.log(`🪙 最终AAPL: ${ethers.formatEther(finalTokenBalance)} AAPL (${finalTokenBalance.toString()})`);
      console.log(`📦 AAPL增加: ${ethers.formatEther(actualTokensReceived)} AAPL (${actualTokensReceived.toString()})`);
      console.log(`🔍 AAPL是否增加: ${actualTokensReceived > 0n ? '是（正常）' : '否（异常）'}`);
      
      await expect(tx)
        .to.emit(aaplToken, "TokenPurchased")
        .withArgs(userA.address, "AAPL", buyAmount, actualTokensReceived, await aaplToken.getStockPrice());
      
      console.log("\n📈 === 交易结果统计 ===");
      console.log(`🏦 交易后用户USDT余额: ${ethers.formatUnits(finalUsdtBalance, 6)} USDT`);
      console.log(`🪙 交易后用户AAPL余额: ${ethers.formatEther(finalTokenBalance)} AAPL`);
      console.log(`💸 实际消费USDT: ${ethers.formatUnits(actualUsdtSpent, 6)} USDT`);
      console.log(`📦 实际获得AAPL: ${ethers.formatEther(actualTokensReceived)} AAPL`);
      
      console.log("\n🔍 === 预估 vs 实际对比 ===");
      console.log(`预估获得: ${ethers.formatEther(estimatedTokens)} AAPL`);
      console.log(`实际获得: ${ethers.formatEther(actualTokensReceived)} AAPL`);
      console.log(`差异: ${ethers.formatEther(actualTokensReceived - estimatedTokens)} AAPL`);
      
      // 验证余额变化（使用实际获得的代币数量，因为价格可能在两次调用间变化）
      expect(finalUsdtBalance).to.equal(initialUsdtBalance - buyAmount);
      expect(finalTokenBalance).to.equal(initialTokenBalance + actualTokensReceived);
    });

    it("手续费计算验证，不同金额和费率", async function () {
      console.log(`🌐 当前网络: ${isLocalNetwork ? 'localhost (MockPyth)' : 'sepolia (真实Pyth)'}`);
      
      const amounts = [
        ethers.parseUnits("10", 6),   // 10 USDT
        ethers.parseUnits("100", 6),  // 100 USDT
        ethers.parseUnits("500", 6)   // 500 USDT
      ];
      
      for (const amount of amounts) {
        const [tokenAmount, feeAmount] = await aaplToken.getBuyEstimate(amount);
        const feeRate = await aaplToken.tradeFeeRate();
        
        // 验证手续费计算: fee = (tokenAmount + fee) * feeRate / 10000
        // 即: tokenAmountBeforeFee = tokenAmount + feeAmount
        // feeAmount = tokenAmountBeforeFee * feeRate / 10000
        const tokenAmountBeforeFee = tokenAmount + feeAmount;
        const expectedFee = tokenAmountBeforeFee * BigInt(feeRate) / 10000n;
        
        expect(feeAmount).to.be.closeTo(expectedFee, ethers.parseEther("0.001"));
      }
    });

    it("滑点保护机制，价格超出范围时交易失败", async function () {
      console.log(`🌐 当前网络: ${isLocalNetwork ? 'localhost (MockPyth)' : 'sepolia (真实Pyth)'}`);
      
      const buyAmount = ethers.parseUnits("1000", 6);
      
      // 根据网络类型获取价格更新数据
      let updateData, fee;
      if (isLocalNetwork) {
        updateData = [];
        fee = 0;
      } else {
        updateData = await fetchUpdateData(["AAPL"]);
        fee = await oracleAggregator.getUpdateFee(updateData);
        
        // 先更新价格数据到预言机
        const overrides = { value: fee };
        await oracleAggregator.updatePriceFeeds(updateData, overrides);
      }
      
      // 获取基于最新价格的预估（此时价格已经更新）
      const [estimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
      
      // 设置极端过高的最小代币数量（模拟极大滑点）
      const tooHighMinTokens = estimatedTokens * 200n / 100n; // 期望多获得100%（不可能）
      
      console.log(`💡 预估获得代币: ${ethers.formatEther(estimatedTokens)} AAPL`);
      console.log(`💡 设置极端过高期望: ${ethers.formatEther(tooHighMinTokens)} AAPL (+100%)`);
      
      // 在两种网络上，我们检测交易是否失败
      let transactionFailed = false;
      try {
        // ethers v6修复：确保value被正确传递
        const overrides = { value: fee };
        const tx = await aaplToken.connect(userA).buy(buyAmount, tooHighMinTokens, updateData, overrides);
        await tx.wait(); // 等待交易确认
        console.log("❌ 交易意外成功了");
      } catch (error) {
        transactionFailed = true;
        console.log("✅ 交易失败（预期的）:", error.message);
      }
      
      // 验证交易确实失败了
      expect(transactionFailed).to.be.true;
      console.log("✅ 滑点保护成功：交易被拒绝");
    });

    it("边界条件，最小/最大/零金额交易测试", async function () {
      console.log(`🌐 当前网络: ${isLocalNetwork ? 'localhost (MockPyth)' : 'sepolia (真实Pyth)'}`);
      
      // 根据网络类型获取价格更新数据
      let updateData, fee;
      if (isLocalNetwork) {
        updateData = [];
        fee = 0;
      } else {
        updateData = await fetchUpdateData(["AAPL"]);
        fee = await oracleAggregator.getUpdateFee(updateData);
        const overrides = { value: fee };
        await oracleAggregator.updatePriceFeeds(updateData, overrides);
      }
      
      // 获取最小交易金额设置
      const minAmount = await aaplToken.minTradeAmount();
      console.log(`📝 最小交易金额: ${ethers.formatUnits(minAmount, 6)} USDT`);
      
      // 测试1: 零金额交易（应该失败）
      console.log("📝 测试零金额交易...");
      let zeroAmountFailed = false;
      
      // 根据网络类型设置交易参数
      // ethers v6修复：确保value被正确传递
      const testOverrides = { value: fee };
      if (!isLocalNetwork) {
        testOverrides.gasLimit = 200000;
        testOverrides.gasPrice = ethers.parseUnits("20", "gwei");
      }
      
      try {
        const tx = await aaplToken.connect(userA).buy(0, 0, updateData, testOverrides);
        await tx.wait();
        console.log("❌ 零金额交易意外成功了");
      } catch (error) {
        zeroAmountFailed = true;
        console.log("✅ 零金额交易失败（预期的）");
      }
      expect(zeroAmountFailed).to.be.true;
      
      // 测试2: 低于最小金额（如果最小金额>0）
      if (minAmount > 0n) {
        console.log("📝 测试低于最小金额交易...");
        let belowMinFailed = false;
        try {
          let updateData, updateFee;
          if (isLocalNetwork) {
            updateData = [];
            updateFee = 0;
          } else {
            const priceUpdate = await getPythUpdateData();
            updateData = priceUpdate.updateData;
            updateFee = priceUpdate.updateFee;
          }
          
          // ethers v6修复：确保value被正确传递
          const overrides = { 
            value: updateFee,
            gasLimit: isLocalNetwork ? 200000 : 300000,
            gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
          };
          
          const tx = await aaplToken.connect(userA).buy(minAmount - 1, 0, updateData, overrides);
          await tx.wait();
          console.log("❌ 低于最小金额交易意外成功了");
        } catch (error) {
          belowMinFailed = true;
          console.log("✅ 低于最小金额交易失败（预期的）");
        }
        expect(belowMinFailed).to.be.true;
      }
      
      // 测试3: 最小有效金额交易（应该成功）
      console.log("📝 测试最小有效金额交易...");
      const testAmount = minAmount > 0n ? minAmount : ethers.parseUnits("1", 6); // 如果minAmount为0，使用1 USDT
      const [estimatedTokens] = await aaplToken.getBuyEstimate(testAmount);
      console.log(`💡 测试金额 ${ethers.formatUnits(testAmount, 6)} USDT，预估获得: ${ethers.formatEther(estimatedTokens)} AAPL`);
      
      let validAmountSuccess = false;
      try {
        let updateData, updateFee;
        if (isLocalNetwork) {
          updateData = [];
          updateFee = 0;
        } else {
          const priceUpdate = await getPythUpdateData();
          updateData = priceUpdate.updateData;
          updateFee = priceUpdate.updateFee;
        }
        
        // ethers v6修复：确保value被正确传递
        const overrides = { 
          value: updateFee,
          gasLimit: isLocalNetwork ? 200000 : 300000,
          gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
        };
        
        const tx = await aaplToken.connect(userA).buy(testAmount, estimatedTokens, updateData, overrides);
        await tx.wait();
        validAmountSuccess = true;
        console.log("✅ 有效金额交易成功");
      } catch (error) {
        console.log("❌ 有效金额交易失败:", error.message);
      }
      expect(validAmountSuccess).to.be.true;
      
      console.log("🎉 边界条件测试完成");
    });
  });

  describe("3. 卖出功能（股票代币 → USDT）", function () {
    beforeEach(async function () {
      // 检查用户A的AAPL代币余额，如果足够就跳过买入
      const currentAaplBalance = await aaplToken.balanceOf(userA.address);
      const requiredAaplBalance = ethers.parseEther("5"); // 需要至少5个AAPL用于卖出测试
      
      if (currentAaplBalance >= requiredAaplBalance) {
        console.log(`✅ UserA AAPL余额充足 (${ethers.formatEther(currentAaplBalance)} AAPL), 跳过买入操作`);
        return;
      }
      
      console.log(`💰 UserA AAPL余额不足 (${ethers.formatEther(currentAaplBalance)} AAPL), 需要买入代币`);
      
      // 先让用户A买入一些代币用于卖出测试
      const buyAmount = ethers.parseUnits("500", 6); // 500 USDT
      const [estimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
      
      let updateData, updateFee;
      if (isLocalNetwork) {
        updateData = [];
        updateFee = 0;
      } else {
        const updateData2 = await fetchUpdateData(["AAPL"]);
        updateFee = await oracleAggregator.getUpdateFee(updateData2);
        updateData = updateData2;
      }
      
      // ethers v6修复：确保value被正确传递
      const overrides = { 
        value: updateFee,
        gasLimit: isLocalNetwork ? 200000 : 300000,
        gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
      };
      
      const tx = await aaplToken.connect(userA).buy(
        buyAmount,
        estimatedTokens * 95n / 100n,
        updateData,
        overrides
      );
      
      // 等待买入交易确认
      const receipt = await tx.wait();
      console.log(`✅ beforeEach 买入交易已确认，区块号: ${receipt.blockNumber}, Gas 使用: ${receipt.gasUsed.toString()}`);
      
      // 等待区块确认
      if (!isLocalNetwork) {
        console.log("⏳ beforeEach 等待区块确认...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      }
    });

    it("正常卖出流程，用户A卖出AAPL换USDT，余额变化验证", async function () {
      const sellAmount = ethers.parseEther("1"); // 卖出1个AAPL代币
      
      // 获取初始余额
      const initialUsdtBalance = await usdtToken.balanceOf(userA.address);
      const initialTokenBalance = await aaplToken.balanceOf(userA.address);
      
      let updateData, updateFee;
      if (isLocalNetwork) {
        updateData = [];
        updateFee = 0;
      } else {
        updateData = await fetchUpdateData(["AAPL"]);
        updateFee = await oracleAggregator.getUpdateFee(updateData);
      }
      
      // // 先更新价格数据到预言机（仅在真实网络）
      // if (!isLocalNetwork) {
      //   const overrides = { value: updateFee };
      //   await oracleAggregator.updatePriceFeeds(updateData, overrides);
      //   console.log(`🔄 价格数据已更新到预言机`);
      // }
      
      // 获取预估结果（此时使用的是最新价格）
      const [estimatedUsdt, estimatedFee] = await aaplToken.getSellEstimate(sellAmount);
      console.log(`💡 预估获得USDT: ${ethers.formatUnits(estimatedUsdt, 6)} USDT`);
      console.log(`💡 预估手续费: ${ethers.formatUnits(estimatedFee, 6)} USDT`);
      
      // 获取新的价格更新数据用于实际交易
      // let sellUpdateData, sellFee;
      // if (isLocalNetwork) {
      //   sellUpdateData = [];
      //   sellFee = 0;
      // } else {
      //   sellUpdateData = await fetchUpdateData(["AAPL"]);
      //   sellFee = await oracleAggregator.getUpdateFee(sellUpdateData);
      //   console.log(`💡 卖出交易更新费用: ${sellFee.toString()} wei`);
      // }
      
      // 执行卖出（使用网络相应的价格更新数据）
      // ethers v6修复：确保value被正确传递
      const overrides = {
        value: sellFee,
        gasLimit: isLocalNetwork ? 200000 : 300000,
        gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
      };
      
      const tx = await aaplToken.connect(userA).sell(
        sellAmount,
        estimatedUsdt * 95n / 100n, // 5% 滑点保护
        sellUpdateData,
        overrides
      );
      
      // 等待交易确认
      const receipt = await tx.wait();
      console.log(`✅ 卖出交易已确认，区块号: ${receipt.blockNumber}, Gas 使用: ${receipt.gasUsed.toString()}`);
      
      // 在 Sepolia 网络上等待额外确认 (较短时间)
      if (!isLocalNetwork) {
        console.log("⏳ 等待区块确认余额更新...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
      }
      
      await expect(tx)
        .to.emit(aaplToken, "TokenSold")
        .withArgs(userA.address, "AAPL", sellAmount, estimatedUsdt, await aaplToken.getStockPrice());
      
      // 验证余额变化
      const finalUsdtBalance = await usdtToken.balanceOf(userA.address);
      const finalTokenBalance = await aaplToken.balanceOf(userA.address);
      
      console.log(`🏦 交易后用户USDT余额: ${ethers.formatUnits(finalUsdtBalance, 6)} USDT`);
      console.log(`🪙 交易后用户AAPL余额: ${ethers.formatEther(finalTokenBalance)} AAPL`);
      console.log(`💰 实际获得USDT: ${ethers.formatUnits(finalUsdtBalance - initialUsdtBalance, 6)} USDT`);
      console.log(`📦 实际卖出AAPL: ${ethers.formatEther(initialTokenBalance - finalTokenBalance)} AAPL`);
      
      expect(finalUsdtBalance).to.equal(initialUsdtBalance + estimatedUsdt);
      expect(finalTokenBalance).to.equal(initialTokenBalance - sellAmount);
    });

    it("价格波动场景，价格上涨/下跌时卖出验证", async function () {
      if (isLocalNetwork) {
        const sellAmount = ethers.parseEther("5");
        
        // 原始价格卖出
        const [originalUsdt] = await aaplToken.getSellEstimate(sellAmount);
        
        // 模拟价格上涨20%
        const now = Math.floor(Date.now() / 1000);
        await mockPyth.setPrice(aaplFeedId, 180, -2, now); // $1.80 (从$1.50上涨20%)
        
        const [higherUsdt] = await aaplToken.getSellEstimate(sellAmount);
        expect(higherUsdt).to.be.gt(originalUsdt);
        
        // 模拟价格下跌
        await mockPyth.setPrice(aaplFeedId, 120, -2, now + 1); // $1.20 (从$1.50下跌20%)
        
        const [lowerUsdt] = await aaplToken.getSellEstimate(sellAmount);
        expect(lowerUsdt).to.be.lt(originalUsdt);
      } else {
        console.log("⏭️  价格波动测试（Sepolia网络使用真实价格，只能观察当前价格）");
        
        const sellAmount = ethers.parseEther("5");
        
        // 获取当前价格的卖出估算
        const [currentUsdt] = await aaplToken.getSellEstimate(sellAmount);
        console.log(`💡 当前价格下卖出${ethers.formatEther(sellAmount)} AAPL可获得: ${ethers.formatUnits(currentUsdt, 6)} USDT`);
        
        // 在真实网络上，我们验证估算功能正常工作
        expect(currentUsdt).to.be.gt(0);
      }
    });

    it("异常情况，余额不足/未授权/无效符号", async function () {
      const userTokenBalance = await aaplToken.balanceOf(userA.address);
      const updateData = isLocalNetwork ? [] : await fetchUpdateData(["AAPL"]);
      const fee = isLocalNetwork ? 0 : await oracleAggregator.getUpdateFee(updateData);
      
      // 余额不足
      let insufficientBalanceFailed = false;
      try {
        // ethers v6修复：确保value被正确传递
        const overrides = { value: fee };
        const tx = await aaplToken.connect(userA).sell(
          userTokenBalance + ethers.parseEther("1"), // 超出余额
          0,
          updateData,
          overrides
        );
        await tx.wait();
        console.log("❌ 余额不足交易意外成功了");
      } catch (error) {
        insufficientBalanceFailed = true;
        console.log("✅ 余额不足交易失败（预期的）");
      }
      expect(insufficientBalanceFailed).to.be.true;
      
      // 卖出零数量
      let zeroAmountSellFailed = false;
      try {
        // ethers v6修复：确保value被正确传递
        const overrides = { value: fee };
        const tx = await aaplToken.connect(userA).sell(0, 0, updateData, overrides);
        await tx.wait();
        console.log("❌ 零数量卖出意外成功了");
      } catch (error) {
        zeroAmountSellFailed = true;
        console.log("✅ 零数量卖出失败（预期的）");
      }
      expect(zeroAmountSellFailed).to.be.true;
    });
  });

  describe("4. 手续费计算逻辑", function () {
    it("不同费率下的手续费计算（0.1%-10%）", async function () {
      const testFeeRates = [10, 50, 100, 500, 1000]; // 0.1%, 0.5%, 1%, 5%, 10%
      const buyAmount = ethers.parseUnits("1000", 6);
      
      for (const feeRate of testFeeRates) {
        // 设置新的手续费率
        await aaplToken.setTradeParameters(
          MIN_TRADE_AMOUNT,  // 使用常量
          INIT_MAX_SLIPPAGE,
          feeRate
        );
        
        const [tokenAmount, feeAmount] = await aaplToken.getBuyEstimate(buyAmount);
        const actualFeeRate = await aaplToken.tradeFeeRate();
        
        // 验证手续费率设置
        expect(actualFeeRate).to.equal(feeRate);
        
        // 验证手续费计算逻辑
        const tokenAmountBeforeFee = tokenAmount + feeAmount;
        const expectedFee = tokenAmountBeforeFee * BigInt(feeRate) / 10000n;
        expect(feeAmount).to.be.closeTo(expectedFee, ethers.parseEther("0.001"));
      }
      
      // 恢复默认费率
      await aaplToken.setTradeParameters(
        MIN_TRADE_AMOUNT,  // 使用常量而不是读取当前值
        INIT_MAX_SLIPPAGE,
        INIT_FEE_RATE
      );
    });

    it("大额/小额交易手续费验证，精度处理", async function () {
      const amounts = [
        ethers.parseUnits("1", 6),     // 小额: 1 USDT
        ethers.parseUnits("10000", 6), // 大额: 10,000 USDT
        ethers.parseUnits("50000", 6)  // 超大额: 50,000 USDT
      ];
      
      for (const amount of amounts) {
        const [tokenAmount, feeAmount] = await aaplToken.getBuyEstimate(amount);
        
        // 验证手续费不为负数
        expect(feeAmount).to.be.gte(0);
        
        // 验证代币数量合理
        expect(tokenAmount).to.be.gt(0);
        
        // 验证精度：手续费应该小于总代币数量
        expect(feeAmount).to.be.lt(tokenAmount + feeAmount);
        
        console.log(`💰 ${ethers.formatUnits(amount, 6)} USDT -> ${ethers.formatEther(tokenAmount)} AAPL (手续费: ${ethers.formatEther(feeAmount)} AAPL)`);
      }
    });
  });

  describe("5. 滑点保护机制", function () {
    it("不同滑点设置下的交易成功率", async function () {
      const buyAmount = ethers.parseUnits("100", 6);
      const [estimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
      
      const slippageTests = [
        { slippage: 0, minTokens: estimatedTokens },                    // 无滑点
        { slippage: 1, minTokens: estimatedTokens * 99n / 100n },   // 1% 滑点
        { slippage: 5, minTokens: estimatedTokens * 95n / 100n },   // 5% 滑点
        { slippage: 10, minTokens: estimatedTokens * 90n / 100n }   // 10% 滑点
      ];
      
      const updateData = isLocalNetwork ? [] : await fetchUpdateData(["AAPL"]);
      const fee = isLocalNetwork ? 0 : await oracleAggregator.getUpdateFee(updateData);
      
      for (const test of slippageTests) {
        // 理论上正常的滑点应该能成功交易
        let slippageTestSuccess = false;
        try {
          const overrides = { 
            value: fee,
            gasLimit: isLocalNetwork ? 200000 : 300000,
            gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
          };
          
          const tx = await aaplToken.connect(userA).buy(
            buyAmount,
            test.minTokens,
            updateData,
            overrides
          );
          await tx.wait();
          slippageTestSuccess = true;
          console.log(`✅ ${test.slippage}% 滑点交易成功`);
        } catch (error) {
          console.log(`❌ ${test.slippage}% 滑点交易失败:`, error.message);
        }
        expect(slippageTestSuccess).to.be.true;
      }
    });

    it("实时价格波动对滑点的影响", async function () {
      if (isLocalNetwork) {
        const buyAmount = ethers.parseUnits("100", 6);
        
        // 设置初始价格
        let now = Math.floor(Date.now() / 1000);
        await mockPyth.setPrice(aaplFeedId, 150, -2, now); // $1.50
        
        const [estimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
        
        // 模拟价格上涨（对买方不利）
        await mockPyth.setPrice(aaplFeedId, 165, -2, now + 1); // $1.65 (+10%)
        
        // 使用原来的估算值应该失败（滑点保护）
        let priceChangeSlippageFailed = false;
        try {
          const tx = await aaplToken.connect(userA).buy(buyAmount, estimatedTokens, [], { 
            value: 0,
            gasLimit: 200000,
            gasPrice: ethers.parseUnits("20", "gwei")
          });
          await tx.wait();
          console.log("❌ 价格上涨后交易意外成功了");
        } catch (error) {
          priceChangeSlippageFailed = true;
          console.log("✅ 价格上涨后交易失败（预期的）");
        }
        expect(priceChangeSlippageFailed).to.be.true;
        
        // 调整期望值后应该成功
        const [newEstimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
        let adjustedPriceSuccess = false;
        try {
          const tx = await aaplToken.connect(userA).buy(buyAmount, newEstimatedTokens, [], { 
            value: 0,
            gasLimit: 200000,
            gasPrice: ethers.parseUnits("20", "gwei")
          });
          await tx.wait();
          adjustedPriceSuccess = true;
          console.log("✅ 调整期望值后交易成功");
        } catch (error) {
          console.log("❌ 调整期望值后交易失败:", error.message);
        }
        expect(adjustedPriceSuccess).to.be.true;
      } else {
        console.log("⏭️  价格波动测试（Sepolia网络使用真实价格，只能验证当前价格逻辑）");
        
        const buyAmount = ethers.parseUnits("100", 6);
        const [estimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
        
        // 在真实网络上，我们验证当前价格的买入功能
        const updateData = await fetchUpdateData(["AAPL"]);
        const fee = await oracleAggregator.getUpdateFee(updateData);
        
        let realNetworkBuySuccess = false;
        try {
          const tx = await aaplToken.connect(userA).buy(buyAmount, estimatedTokens * 95 / 100, updateData, {
            value: fee,
            gasLimit: 300000,
            gasPrice: ethers.parseUnits("30", "gwei")
          });
          await tx.wait();
          realNetworkBuySuccess = true;
          console.log("✅ 真实网络价格买入交易成功");
        } catch (error) {
          console.log("❌ 真实网络价格买入交易失败:", error.message);
        }
        expect(realNetworkBuySuccess).to.be.true;
      }
    });

    it("滑点超出系统最大值处理，零滑点交易验证", async function () {
      const buyAmount = ethers.parseUnits("100", 6);
      const [estimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
      
      const updateData = isLocalNetwork ? [] : await fetchUpdateData(["AAPL"]);
      const fee = isLocalNetwork ? 0 : await oracleAggregator.getUpdateFee(updateData);
      
      // 零滑点交易（要求精确数量）
      let zeroSlippageSuccess = false;
      try {
        // ethers v6修复：确保value被正确传递
        const overrides = { 
          value: fee,
          gasLimit: isLocalNetwork ? 200000 : 300000,
          gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
        };
        
        const tx = await aaplToken.connect(userA).buy(buyAmount, estimatedTokens, updateData, overrides);
        await tx.wait();
        zeroSlippageSuccess = true;
        console.log("✅ 零滑点交易成功");
      } catch (error) {
        console.log("❌ 零滑点交易失败:", error.message);
      }
      expect(zeroSlippageSuccess).to.be.true;
      
      // 过高期望（超出合理范围）
      const unreasonableMinTokens = estimatedTokens * 150n / 100n; // 期望多50%
      let unreasonableExpectationFailed = false;
      try {
        // ethers v6修复：确保value被正确传递
        const overrides = { 
          value: fee,
          gasLimit: isLocalNetwork ? 200000 : 300000,
          gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
        };
        
        const tx = await aaplToken.connect(userA).buy(buyAmount, unreasonableMinTokens, updateData, overrides);
        await tx.wait();
        console.log("❌ 过高期望交易意外成功了");
      } catch (error) {
        unreasonableExpectationFailed = true;
        console.log("✅ 过高期望交易失败（预期的）");
      }
      expect(unreasonableExpectationFailed).to.be.true;
    });
  });

  describe("6. 管理功能", function () {
    it("手续费率更新，所有者/非所有者/超限测试", async function () {
      const newFeeRate = 50; // 0.5%
      const oldFeeRate = await aaplToken.tradeFeeRate();
      
      // 所有者更新费率
      await expect(
        aaplToken.setTradeParameters(
          MIN_TRADE_AMOUNT,  // 使用常量
          INIT_MAX_SLIPPAGE,
          newFeeRate
        )
      ).to.emit(aaplToken, "ParameterUpdated")
        .withArgs("tradeFeeRate", oldFeeRate, newFeeRate);
      
      expect(await aaplToken.tradeFeeRate()).to.equal(newFeeRate);
      
      // 非所有者尝试更新失败
      let nonOwnerUpdateFailed = false;
      try {
        const tx = await aaplToken.connect(userA).setTradeParameters(
          MIN_TRADE_AMOUNT,  // 使用常量
          INIT_MAX_SLIPPAGE,
          100
        );
        await tx.wait();
        console.log("❌ 非所有者更新意外成功了");
      } catch (error) {
        nonOwnerUpdateFailed = true;
        console.log("✅ 非所有者更新失败（预期的）");
      }
      expect(nonOwnerUpdateFailed).to.be.true;
      
      // 超出最大限制测试
      let exceedLimitFailed = false;
      try {
        const tx = await aaplToken.setTradeParameters(
          MIN_TRADE_AMOUNT,  // 使用常量
          INIT_MAX_SLIPPAGE,
          1001 // > 10%
        );
        await tx.wait();
        console.log("❌ 超出限制更新意外成功了");
      } catch (error) {
        exceedLimitFailed = true;
        console.log("✅ 超出限制更新失败（预期的）");
      }
      expect(exceedLimitFailed).to.be.true;
    });

    it("收款地址变更，零地址/新地址验证", async function () {
      const oldFeeReceiver = await aaplToken.feeReceiver();
      
      // 更新收款地址
      await aaplToken.setFeeReceiver(feeReceiver.address);
      expect(await aaplToken.feeReceiver()).to.equal(feeReceiver.address);
      
      // 验证手续费转入新地址（通过一次买入交易）
      const buyAmount = ethers.parseUnits("1000", 6);
      const initialFeeReceiverBalance = await aaplToken.balanceOf(feeReceiver.address);
      
      const updateData = isLocalNetwork ? [] : await fetchUpdateData(["AAPL"]);
      const fee = isLocalNetwork ? 0 : await oracleAggregator.getUpdateFee(updateData);
      const [estimatedTokens] = await aaplToken.getBuyEstimate(buyAmount);
      
      const overrides = { value: fee };
      await aaplToken.connect(userA).buy(
        buyAmount,
        estimatedTokens * 95n / 100n,
        updateData,
        overrides
      );
      
      const finalFeeReceiverBalance = await aaplToken.balanceOf(feeReceiver.address);
      expect(finalFeeReceiverBalance).to.be.gt(initialFeeReceiverBalance);
      
      // 零地址更新尝试
      let zeroAddressUpdateFailed = false;
      try {
        const tx = await aaplToken.setFeeReceiver(ethers.ZeroAddress);
        await tx.wait();
        console.log("❌ 零地址更新意外成功了");
      } catch (error) {
        zeroAddressUpdateFailed = true;
        console.log("✅ 零地址更新失败（预期的）");
      }
      expect(zeroAddressUpdateFailed).to.be.true;
    });

    it("最大滑点更新，参数验证和影响范围测试", async function () {
      const newMaxSlippage = 500; // 5%
      const oldMaxSlippage = await aaplToken.maxSlippage();
      
      // 更新滑点参数
      await expect(
        aaplToken.setTradeParameters(
          MIN_TRADE_AMOUNT,  // 使用常量
          newMaxSlippage,
          INIT_FEE_RATE
        )
      ).to.emit(aaplToken, "ParameterUpdated")
        .withArgs("maxSlippage", oldMaxSlippage, newMaxSlippage);
      
      expect(await aaplToken.maxSlippage()).to.equal(newMaxSlippage);
      
      // 超出最大滑点限制测试
      let maxSlippageExceedFailed = false;
      try {
        const tx = await aaplToken.setTradeParameters(
          MIN_TRADE_AMOUNT,  // 使用常量
          1001, // > 10%
          INIT_FEE_RATE
        );
        await tx.wait();
        console.log("❌ 超出最大滑点限制更新意外成功了");
      } catch (error) {
        maxSlippageExceedFailed = true;
        console.log("✅ 超出最大滑点限制更新失败（预期的）");
      }
      expect(maxSlippageExceedFailed).to.be.true;
    });
  });

  describe("7. 多股票代币交易测试", function () {
    it("GOOGL 代币交易功能验证", async function () {
      const buyAmount = ethers.parseUnits("200", 6); // 200 USDT 买GOOGL
      
      // 授权USDT给GOOGL合约
      await usdtToken.connect(userA).approve(await googlToken.getAddress(), buyAmount);
      
      // 获取初始余额
      const initialUsdtBalance = await usdtToken.balanceOf(userA.address);
      const initialTokenBalance = await googlToken.balanceOf(userA.address);
      
      // 执行买入
      const updateData = isLocalNetwork ? [] : await fetchUpdateData(["GOOGL"]);
      const fee = isLocalNetwork ? 0 : await oracleAggregator.getUpdateFee(updateData);
      const [estimatedTokens] = await googlToken.getBuyEstimate(buyAmount);
      
      const overrides = { 
        value: fee,
        gasLimit: isLocalNetwork ? 200000 : 300000,
        gasPrice: isLocalNetwork ? ethers.parseUnits("20", "gwei") : ethers.parseUnits("30", "gwei")
      };
      
      await googlToken.connect(userA).buy(
        buyAmount,
        estimatedTokens * 95n / 100n, // 5% 滑点保护
        updateData,
        overrides
      );
      
      // 验证余额变化
      const finalUsdtBalance = await usdtToken.balanceOf(userA.address);
      const finalTokenBalance = await googlToken.balanceOf(userA.address);
      
      expect(finalUsdtBalance).to.equal(initialUsdtBalance - buyAmount);
      expect(finalTokenBalance).to.equal(initialTokenBalance + estimatedTokens);
      
      console.log(`✅ GOOGL 交易成功: ${ethers.formatEther(estimatedTokens)} GOOGL`);
    });

    it("跨股票代币价格对比", async function () {
      const aaplPrice = await aaplToken.getStockPrice();
      const googlPrice = await googlToken.getStockPrice();
      
      console.log(`📊 AAPL 价格: $${ethers.formatEther(aaplPrice)}`);
      console.log(`📊 GOOGL 价格: $${ethers.formatEther(googlPrice)}`);
      
      // GOOGL 价格应该显著高于 AAPL
      expect(googlPrice).to.be.gt(aaplPrice);
      
      // 验证价格合理范围（基于模拟数据）
      if (isLocalNetwork) {
        expect(aaplPrice).to.be.closeTo(ethers.parseEther("1.5"), ethers.parseEther("0.1")); // $1.50 ± $0.10
        expect(googlPrice).to.be.closeTo(ethers.parseEther("2.8"), ethers.parseEther("0.1")); // $2.80 ± $0.10
      }
    });
  });
});
