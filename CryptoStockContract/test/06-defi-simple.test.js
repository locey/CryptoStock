const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("DefiAggregator - 存款和取款测试", function () {
  let defiAggregator;
  let mockAavePool;
  let mockAToken;
  let usdtToken;
  let owner, user1, user2;

  beforeEach(async function () {
    console.log("\n🔧 设置测试环境...");

    // 获取测试账户
    [owner, user1, user2] = await ethers.getSigners();
    console.log("   Owner:", owner.address);
    console.log("   User1:", user1.address);
    console.log("   User2:", user2.address);

    // 1. 部署 MockERC20 (USDT)
    console.log("\n📄 部署 MockERC20 (USDT)...");
    const MockERC20 = await ethers.getContractFactory("contracts/mock/MockERC20.sol:MockERC20");
    usdtToken = await MockERC20.deploy("USD Tether", "USDT", 6);
    await usdtToken.waitForDeployment();
    console.log("   ✅ USDT 地址:", await usdtToken.getAddress());

    // 2. 部署 MockAavePool
    console.log("\n📄 部署 MockAavePool...");
    const MockAavePool = await ethers.getContractFactory("contracts/mock/MockAavePool.sol:MockAavePool");
    mockAavePool = await MockAavePool.deploy();
    await mockAavePool.waitForDeployment();
    console.log("   ✅ MockAavePool 地址:", await mockAavePool.getAddress());

    // 2.1 部署 MockAToken
    console.log("\n📄 部署 MockAToken...");
    const MockAToken = await ethers.getContractFactory("contracts/mock/MockAToken.sol:MockAToken");
    mockAToken = await MockAToken.deploy(
      "Aave USDT",
      "aUSDT",
      await usdtToken.getAddress(),
      await mockAavePool.getAddress()
    );
    await mockAToken.waitForDeployment();
    console.log("   ✅ MockAToken 地址:", await mockAToken.getAddress());

    // 2.2 初始化储备
    await mockAavePool.initReserve(await usdtToken.getAddress(), await mockAToken.getAddress());
    console.log("   ✅ 储备初始化完成");

    // 3. 部署可升级的 DefiAggregator
    console.log("\n📄 部署 DefiAggregator...");
    const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
    defiAggregator = await upgrades.deployProxy(
      DefiAggregator,
      [
        await mockAavePool.getAddress(),
        await usdtToken.getAddress(),
        owner.address
      ],
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    await defiAggregator.waitForDeployment();
    console.log("   ✅ DefiAggregator 地址:", await defiAggregator.getAddress());

    // 4. 给用户铸造一些 USDT 用于测试
    const mintAmount = ethers.parseUnits("1000", 6); // 1000 USDT
    await usdtToken.mint(user1.address, mintAmount);
    await usdtToken.mint(user2.address, mintAmount);
    console.log("   ✅ 为用户铸造 1000 USDT");

    console.log("✅ 测试环境设置完成\n");
  });

  describe("💰 存款功能测试", function () {
    
    it("用户应该能够成功存款", async function () {
      console.log("🧪 测试: 用户成功存款");
      
      const depositAmount = ethers.parseUnits("100", 6); // 100 USDT
      const expectedFee = ethers.parseUnits("0.5", 6); // 0.5% = 0.5 USDT
      const expectedNetDeposit = depositAmount - expectedFee; // 99.5 USDT
      
      // 用户授权 DefiAggregator
      await usdtToken.connect(user1).approve(await defiAggregator.getAddress(), depositAmount);
      console.log("   ✅ 用户1 授权 100 USDT");
      
      // 记录存款前余额
      const balanceBefore = await usdtToken.balanceOf(user1.address);
      const depositBefore = await defiAggregator.getDepositBalance(user1.address);
      const feesBefore = await defiAggregator.totalFeesCollected();
      
      // 执行存款
      const tx = await defiAggregator.connect(user1).deposit(depositAmount);
      console.log("   ✅ 用户1 存入 100 USDT (含0.5%手续费)");
      
      // 验证结果
      const balanceAfter = await usdtToken.balanceOf(user1.address);
      const depositAfter = await defiAggregator.getDepositBalance(user1.address);
      const feesAfter = await defiAggregator.totalFeesCollected();
      
      // 验证USDT余额减少
      expect(balanceAfter).to.equal(balanceBefore - depositAmount);
      
      // 验证实际存入金额（扣除手续费后）
      expect(depositAfter).to.equal(depositBefore + expectedNetDeposit);
      
      // 验证手续费收取
      expect(feesAfter).to.equal(feesBefore + expectedFee);
      
      // 验证事件
      await expect(tx)
        .to.emit(defiAggregator, "Deposited")
        .withArgs(user1.address, expectedNetDeposit, expectedFee);
      
      await expect(tx)
        .to.emit(defiAggregator, "FeeCollected")
        .withArgs(user1.address, expectedFee, "deposit");
      
      console.log("   📊 用户1 USDT 余额:", ethers.formatUnits(balanceAfter, 6));
      console.log("   📊 用户1 存款余额:", ethers.formatUnits(depositAfter, 6));
      console.log("   💰 收取手续费:", ethers.formatUnits(expectedFee, 6), "USDT");
      console.log("   ✅ 存款测试通过");
    });

    it("不应该允许存入0金额", async function () {
      console.log("🧪 测试: 阻止零金额存款");
      
      await expect(
        defiAggregator.connect(user1).deposit(0)
      ).to.be.revertedWith("Amount must be greater than 0");
      
      console.log("   ✅ 零金额存款被正确拒绝");
    });

    it("不应该允许未授权的存款", async function () {
      console.log("🧪 测试: 阻止未授权存款");
      
      const depositAmount = ethers.parseUnits("100", 6);
      
      // 不进行授权，直接尝试存款
      await expect(
        defiAggregator.connect(user1).deposit(depositAmount)
      ).to.be.reverted; // 改为通用的reverted检查，不指定具体错误消息
      
      console.log("   ✅ 未授权存款被正确拒绝");
    });
  });

  describe("💸 取款功能测试", function () {
    
    beforeEach(async function () {
      // 先让用户1存入一些钱用于测试取款
      const depositAmount = ethers.parseUnits("200", 6); // 200 USDT
      await usdtToken.connect(user1).approve(await defiAggregator.getAddress(), depositAmount);
      await defiAggregator.connect(user1).deposit(depositAmount);
      // 实际存入金额 = 200 - 1 (0.5% 手续费) = 199 USDT
      console.log("   🏦 用户1 预存 200 USDT (实际存入199 USDT，扣除1 USDT手续费)");
    });

    it("用户应该能够成功取款", async function () {
      console.log("🧪 测试: 用户成功取款");
      
      const withdrawAmount = ethers.parseUnits("100", 6); // 100 USDT
      
      // 获取aToken地址并授权给DefiAggregator
      const aTokenAddress = await mockAavePool.getAToken(await usdtToken.getAddress());
      const aToken = await ethers.getContractAt("MockAToken", aTokenAddress);
      await aToken.connect(user1).approve(await defiAggregator.getAddress(), withdrawAmount);
      
      // 记录取款前状态
      const balanceBefore = await usdtToken.balanceOf(user1.address);
      const depositBefore = await defiAggregator.getDepositBalance(user1.address);
      const feesBefore = await defiAggregator.totalFeesCollected();
      
      // 执行取款
      const tx = await defiAggregator.connect(user1).withdraw(withdrawAmount);
      console.log("   ✅ 用户1 取出 100 USDT");
      
      // 验证结果
      const balanceAfter = await usdtToken.balanceOf(user1.address);
      const depositAfter = await defiAggregator.getDepositBalance(user1.address);
      const feesAfter = await defiAggregator.totalFeesCollected();
      
      // 检查存款记录减少
      expect(depositAfter).to.equal(depositBefore - withdrawAmount);
      
      // 计算预期收益：MockAavePool给0.5%利息，然后DefiAggregator扣0.5%手续费
      const aaveInterest = withdrawAmount * 50n / 10000n; // 0.5% Aave利息
      const totalFromAave = withdrawAmount + aaveInterest; // 从Aave收到的总额
      const defiAggregatorFee = totalFromAave * 50n / 10000n; // DefiAggregator 0.5%手续费
      const expectedNetAmount = totalFromAave - defiAggregatorFee; // 用户实际收到
      
      // 验证用户余额增加
      expect(balanceAfter).to.equal(balanceBefore + expectedNetAmount);
      
      // 验证手续费收取
      expect(feesAfter).to.equal(feesBefore + defiAggregatorFee);
      
      // 验证事件
      await expect(tx)
        .to.emit(defiAggregator, "Withdrawn")
        .withArgs(user1.address, withdrawAmount, expectedNetAmount, defiAggregatorFee);
      
      await expect(tx)
        .to.emit(defiAggregator, "FeeCollected")
        .withArgs(user1.address, defiAggregatorFee, "withdraw");
      
      console.log("   📊 用户1 USDT 余额:", ethers.formatUnits(balanceAfter, 6));
      console.log("   📊 用户1 存款余额:", ethers.formatUnits(depositAfter, 6));
      console.log("   💰 Aave 利息:", ethers.formatUnits(aaveInterest, 6), "USDT");
      console.log("   💰 DefiAggregator 手续费:", ethers.formatUnits(defiAggregatorFee, 6), "USDT");
      console.log("   💰 用户净收益:", ethers.formatUnits(expectedNetAmount, 6), "USDT");
      console.log("   ✅ 取款测试通过");
    });

    it("不应该允许取出超过存款余额的金额", async function () {
      console.log("🧪 测试: 阻止超额取款");
      
      const depositBalance = await defiAggregator.getDepositBalance(user1.address);
      const excessiveAmount = depositBalance + ethers.parseUnits("1", 6); // 比余额多1 USDT
      
      // 获取aToken并授权
      const aTokenAddress = await mockAavePool.getAToken(await usdtToken.getAddress());
      const aToken = await ethers.getContractAt("MockAToken", aTokenAddress);
      await aToken.connect(user1).approve(await defiAggregator.getAddress(), excessiveAmount);
      
      await expect(
        defiAggregator.connect(user1).withdraw(excessiveAmount)
      ).to.be.revertedWith("Insufficient balance");
      
      console.log("   ✅ 超额取款被正确拒绝");
    });

    it("不应该允许取出0金额", async function () {
      console.log("🧪 测试: 阻止零金额取款");
      
      await expect(
        defiAggregator.connect(user1).withdraw(0)
      ).to.be.revertedWith("Amount must be greater than 0");
      
      console.log("   ✅ 零金额取款被正确拒绝");
    });
  });

  describe("📊 余额查询测试", function () {
    
    it("应该能正确查询用户存款余额", async function () {
      console.log("🧪 测试: 余额查询功能");
      
      // 初始余额应该为0
      let balance = await defiAggregator.getDepositBalance(user2.address);
      expect(balance).to.equal(0);
      console.log("   📊 用户2 初始存款余额:", ethers.formatUnits(balance, 6));
      
      // 存款后查询余额 (考虑0.5%手续费)
      const depositAmount = ethers.parseUnits("50", 6); // 50 USDT
      const expectedFee = depositAmount * 50n / 10000n; // 0.25 USDT 手续费
      const expectedNetDeposit = depositAmount - expectedFee; // 49.75 USDT 实际存入
      
      await usdtToken.connect(user2).approve(await defiAggregator.getAddress(), depositAmount);
      await defiAggregator.connect(user2).deposit(depositAmount);
      
      balance = await defiAggregator.getDepositBalance(user2.address);
      expect(balance).to.equal(expectedNetDeposit);
      console.log("   📊 用户2 存款后余额:", ethers.formatUnits(balance, 6), "USDT");
      console.log("   💰 扣除手续费:", ethers.formatUnits(expectedFee, 6), "USDT");
      console.log("   ✅ 余额查询测试通过");
    });
  });

  describe("🔄 完整流程测试", function () {
    
    it("完整的存款->取款->再存款流程", async function () {
      console.log("🧪 测试: 完整存取流程");
      
      const user = user1;
      const amount1 = ethers.parseUnits("150", 6);
      const amount2 = ethers.parseUnits("75", 6);
      const amount3 = ethers.parseUnits("50", 6);
      
      console.log("   第一步: 存入 150 USDT");
      await usdtToken.connect(user).approve(await defiAggregator.getAddress(), amount1);
      await defiAggregator.connect(user).deposit(amount1);
      
      // 存入 150 USDT，扣除手续费 0.75 USDT，实际存入 149.25 USDT
      const expectedNetDeposit1 = amount1 - (amount1 * 50n / 10000n);
      let balance = await defiAggregator.getDepositBalance(user.address);
      expect(balance).to.equal(expectedNetDeposit1);
      console.log("   📊 存款余额:", ethers.formatUnits(balance, 6));
      
      console.log("   第二步: 取出 75 USDT");
      // 获取aToken并授权
      const aTokenAddress = await mockAavePool.getAToken(await usdtToken.getAddress());
      const aToken = await ethers.getContractAt("MockAToken", aTokenAddress);
      await aToken.connect(user).approve(await defiAggregator.getAddress(), amount2);
      
      await defiAggregator.connect(user).withdraw(amount2);
      
      balance = await defiAggregator.getDepositBalance(user.address);
      expect(balance).to.equal(expectedNetDeposit1 - amount2);
      console.log("   📊 存款余额:", ethers.formatUnits(balance, 6));
      
      console.log("   第三步: 再存入 50 USDT");
      await usdtToken.connect(user).approve(await defiAggregator.getAddress(), amount3);
      await defiAggregator.connect(user).deposit(amount3);
      
      // 存入 50 USDT，扣除手续费 0.25 USDT，实际存入 49.75 USDT
      const expectedNetDeposit2 = amount3 - (amount3 * 50n / 10000n);
      balance = await defiAggregator.getDepositBalance(user.address);
      expect(balance).to.equal(expectedNetDeposit1 - amount2 + expectedNetDeposit2);
      console.log("   📊 最终存款余额:", ethers.formatUnits(balance, 6));
      console.log("   ✅ 完整流程测试通过");
    });
  });

  describe("💰 手续费管理测试", function () {
    
    it("应该能正确计算手续费", async function () {
      console.log("🧪 测试: 手续费计算");
      
      const testAmount = ethers.parseUnits("1000", 6); // 1000 USDT
      const expectedFee = await defiAggregator.calculateFee(testAmount);
      const manualFee = testAmount * 50n / 10000n; // 0.5%
      
      expect(expectedFee).to.equal(manualFee);
      expect(expectedFee).to.equal(ethers.parseUnits("5", 6)); // 5 USDT
      
      console.log("   📊 测试金额:", ethers.formatUnits(testAmount, 6), "USDT");
      console.log("   📊 计算手续费:", ethers.formatUnits(expectedFee, 6), "USDT");
      console.log("   ✅ 手续费计算正确");
    });

    it("owner应该能修改手续费率", async function () {
      console.log("🧪 测试: 修改手续费率");
      
      const oldRate = await defiAggregator.getFeeRate();
      const newRate = 100; // 1%
      
      // owner修改手续费率
      const tx = await defiAggregator.connect(owner).setFeeRate(newRate);
      
      // 验证变更
      const currentRate = await defiAggregator.getFeeRate();
      expect(currentRate).to.equal(newRate);
      
      // 验证事件
      await expect(tx)
        .to.emit(defiAggregator, "FeeRateChanged")
        .withArgs(oldRate, newRate);
      
      // 验证新费率计算
      const testAmount = ethers.parseUnits("100", 6);
      const newFee = await defiAggregator.calculateFee(testAmount);
      expect(newFee).to.equal(ethers.parseUnits("1", 6)); // 1%
      
      console.log("   📊 旧费率:", oldRate, "基点");
      console.log("   📊 新费率:", currentRate, "基点");
      console.log("   📊 100 USDT 新手续费:", ethers.formatUnits(newFee, 6), "USDT");
      console.log("   ✅ 手续费率修改成功");
    });

    it("非owner不应该能修改手续费率", async function () {
      console.log("🧪 测试: 阻止非owner修改手续费率");
      
      await expect(
        defiAggregator.connect(user1).setFeeRate(200)
      ).to.be.revertedWithCustomError(defiAggregator, "OwnableUnauthorizedAccount");
      
      console.log("   ✅ 非owner修改被正确拒绝");
    });

    it("不应该允许设置过高的手续费率", async function () {
      console.log("🧪 测试: 阻止过高手续费率");
      
      await expect(
        defiAggregator.connect(owner).setFeeRate(1001) // 超过10%
      ).to.be.revertedWith("Fee rate too high");
      
      console.log("   ✅ 过高手续费率被正确拒绝");
    });

    it("owner应该能提取累计手续费", async function () {
      console.log("🧪 测试: 提取累计手续费");
      
      // 先进行一些交易产生手续费
      const depositAmount = ethers.parseUnits("200", 6);
      await usdtToken.connect(user1).approve(await defiAggregator.getAddress(), depositAmount);
      await defiAggregator.connect(user1).deposit(depositAmount);
      
      const feesCollected = await defiAggregator.totalFeesCollected();
      expect(feesCollected).to.be.gt(0);
      
      // owner提取手续费
      const ownerBalanceBefore = await usdtToken.balanceOf(owner.address);
      await defiAggregator.connect(owner).withdrawFees();
      const ownerBalanceAfter = await usdtToken.balanceOf(owner.address);
      
      // 验证手续费转移
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + feesCollected);
      expect(await defiAggregator.totalFeesCollected()).to.equal(0);
      
      console.log("   📊 提取手续费:", ethers.formatUnits(feesCollected, 6), "USDT");
      console.log("   📊 owner余额增加:", ethers.formatUnits(ownerBalanceAfter - ownerBalanceBefore, 6), "USDT");
      console.log("   ✅ 手续费提取成功");
    });

    it("非owner不应该能提取手续费", async function () {
      console.log("🧪 测试: 阻止非owner提取手续费");
      
      await expect(
        defiAggregator.connect(user1).withdrawFees()
      ).to.be.revertedWithCustomError(defiAggregator, "OwnableUnauthorizedAccount");
      
      console.log("   ✅ 非owner提取被正确拒绝");
    });

    it("没有手续费时不应该能提取", async function () {
      console.log("🧪 测试: 阻止无手续费时提取");
      
      // 确保没有手续费可提取
      const fees = await defiAggregator.totalFeesCollected();
      if (fees > 0) {
        await defiAggregator.connect(owner).withdrawFees();
      }
      
      await expect(
        defiAggregator.connect(owner).withdrawFees()
      ).to.be.revertedWith("No fees to withdraw");
      
      console.log("   ✅ 无手续费提取被正确拒绝");
    });
  });
});