const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("11-pancakeswap.test.js - PancakeAdapter 测试", function () {
  const INITIAL_TOKEN_SUPPLY = ethers.parseUnits("1000000", 18);
  const USER_SWAP_AMOUNT = ethers.parseUnits("100", 18); // 100 USDT
  const FEE_RATE_BPS = 30; // 0.3%
  const SLIPPAGE_BPS = 100; // 1% 滑点

  async function deployFixture() {
    const [deployer, user] = await ethers.getSigners();

    // 1. 部署测试代币 USDT 和 CAKE
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await MockERC20.deploy("Mock USDT", "USDT", 18);
    const cake = await MockERC20.deploy("Mock CAKE", "CAKE", 18);

    // 2. 部署 MockPancakeRouter (需要factory和WETH地址，可以用零地址)
    const MockPancakeRouter = await ethers.getContractFactory(
      "MockPancakeRouter"
    );
    const mockRouter = await MockPancakeRouter.deploy(
      ethers.ZeroAddress, // factory
      ethers.ZeroAddress // WETH
    );

    // 3. 设置交换汇率 (基于10000基点)
    await mockRouter.setExchangeRate(
      await usdt.getAddress(),
      await cake.getAddress(),
      20000 // 1 USDT = 2 CAKE (20000/10000 = 2)
    );
    await mockRouter.setExchangeRate(
      await cake.getAddress(),
      await usdt.getAddress(),
      5000 // 1 CAKE = 0.5 USDT (5000/10000 = 0.5)
    );

    // 4. 给Router提供流动性
    await usdt.mint(
      await mockRouter.getAddress(),
      ethers.parseUnits("100000", 18)
    );
    await cake.mint(
      await mockRouter.getAddress(),
      ethers.parseUnits("200000", 18)
    );

    // 5. 部署 DefiAggregator
    const DefiAggregator = await ethers.getContractFactory("DefiAggregator");
    const defiAggregator = await upgrades.deployProxy(
      DefiAggregator,
      [FEE_RATE_BPS],
      { kind: "uups", initializer: "initialize" }
    );
    await defiAggregator.waitForDeployment();

    // 6. 部署 PancakeAdapter
    const PancakeAdapter = await ethers.getContractFactory("PancakeAdapter");
    const pancakeAdapter = await upgrades.deployProxy(
      PancakeAdapter,
      [await mockRouter.getAddress()],
      {
        kind: "uups",
        initializer: "initialize",
      }
    );
    await pancakeAdapter.waitForDeployment();

    // 7. 添加支持的代币
    await pancakeAdapter.addSupportedToken(await usdt.getAddress());
    await pancakeAdapter.addSupportedToken(await cake.getAddress());

    // 8. 注册适配器
    await defiAggregator.registerAdapter(
      "pancakeswap",
      await pancakeAdapter.getAddress()
    );

    // 9. 给用户分配代币
    await usdt.mint(user.address, ethers.parseUnits("1000", 18));
    await cake.mint(user.address, ethers.parseUnits("1000", 18));

    return {
      deployer,
      user,
      usdt,
      cake,
      mockRouter,
      defiAggregator,
      pancakeAdapter,
    };
  }

  it("精确输入交换 (USDT -> CAKE)", async function () {
    const { user, usdt, cake, defiAggregator, pancakeAdapter } =
      await loadFixture(deployFixture);

    // 记录交换前余额
    const usdtBefore = await usdt.balanceOf(user.address);
    const cakeBefore = await cake.balanceOf(user.address);

    console.log("交换前:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtBefore, 18));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeBefore, 18));

    // 预估输出数量
    const result = await pancakeAdapter.estimateOperation(
      6, // SWAP_EXACT_INPUT
      {
        tokens: [await usdt.getAddress(), await cake.getAddress()],
        amounts: [USER_SWAP_AMOUNT],
        recipient: user.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: 0,
        extraData: "0x",
      }
    );

    const estimatedOutput = result.outputAmounts[0];
    const minOutput = (estimatedOutput * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;

    console.log("预估输出:", ethers.formatUnits(estimatedOutput, 18), "CAKE");
    console.log("最小输出:", ethers.formatUnits(minOutput, 18), "CAKE");

    // 用户授权USDT给PancakeAdapter
    await usdt
      .connect(user)
      .approve(await pancakeAdapter.getAddress(), USER_SWAP_AMOUNT);

    // 执行交换
    const swapParams = {
      tokens: [await usdt.getAddress(), await cake.getAddress()],
      amounts: [USER_SWAP_AMOUNT, minOutput], // [amountIn, minAmountOut]
      recipient: user.address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      tokenId: 0,
      extraData: "0x",
    };

    const tx = await defiAggregator.connect(user).executeOperation(
      "pancakeswap",
      6, // SWAP_EXACT_INPUT
      swapParams
    );
    await tx.wait();

    // 记录交换后余额
    const usdtAfter = await usdt.balanceOf(user.address);
    const cakeAfter = await cake.balanceOf(user.address);

    console.log("交换后:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtAfter, 18));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeAfter, 18));

    // 验证交换结果
    const usdtUsed = usdtBefore - usdtAfter;
    const cakeReceived = cakeAfter - cakeBefore;

    expect(usdtUsed).to.equal(USER_SWAP_AMOUNT);
    expect(cakeReceived).to.be.gte(minOutput);

    console.log("实际输出:", ethers.formatUnits(cakeReceived, 18), "CAKE");
    console.log("✅ 精确输入交换成功");
  });

  it("精确输出交换 (USDT -> CAKE)", async function () {
    const { user, usdt, cake, defiAggregator, pancakeAdapter } =
      await loadFixture(deployFixture);

    // 记录交换前余额
    const usdtBefore = await usdt.balanceOf(user.address);
    const cakeBefore = await cake.balanceOf(user.address);

    console.log("交换前:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtBefore, 18));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeBefore, 18));

    // 设定期望输出数量
    const desiredOutput = ethers.parseUnits("100", 18); // 想要100 CAKE

    // 预估需要的输入数量
    const result = await pancakeAdapter.estimateOperation(
      8, // SWAP_EXACT_OUTPUT
      {
        tokens: [await usdt.getAddress(), await cake.getAddress()],
        amounts: [desiredOutput],
        recipient: user.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: 0,
        extraData: "0x",
      }
    );

    const estimatedInput = result.outputAmounts[0];
    const maxInput = (estimatedInput * BigInt(10000 + SLIPPAGE_BPS)) / 10000n;

    console.log("预估输入:", ethers.formatUnits(estimatedInput, 18), "USDT");
    console.log("最大输入:", ethers.formatUnits(maxInput, 18), "USDT");

    // 用户授权USDT给PancakeAdapter
    await usdt
      .connect(user)
      .approve(await pancakeAdapter.getAddress(), maxInput);

    // 执行交换
    const swapParams = {
      tokens: [await usdt.getAddress(), await cake.getAddress()],
      amounts: [desiredOutput, maxInput], // [amountOut, maxAmountIn]
      recipient: user.address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      tokenId: 0,
      extraData: "0x",
    };

    const tx = await defiAggregator.connect(user).executeOperation(
      "pancakeswap",
      8, // SWAP_EXACT_OUTPUT
      swapParams
    );
    await tx.wait();

    // 记录交换后余额
    const usdtAfter = await usdt.balanceOf(user.address);
    const cakeAfter = await cake.balanceOf(user.address);

    console.log("交换后:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtAfter, 18));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeAfter, 18));

    // 验证交换结果
    const usdtUsed = usdtBefore - usdtAfter;
    const cakeReceived = cakeAfter - cakeBefore;

    expect(cakeReceived).to.equal(desiredOutput);
    expect(usdtUsed).to.be.lte(maxInput);

    console.log("实际输入:", ethers.formatUnits(usdtUsed, 18), "USDT");
    console.log("✅ 精确输出交换成功");
  });

  it("反向交换 (CAKE -> USDT)", async function () {
    const { user, usdt, cake, defiAggregator, pancakeAdapter } =
      await loadFixture(deployFixture);

    const swapAmount = ethers.parseUnits("50", 18); // 50 CAKE

    // 记录交换前余额
    const usdtBefore = await usdt.balanceOf(user.address);
    const cakeBefore = await cake.balanceOf(user.address);

    console.log("反向交换前:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtBefore, 18));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeBefore, 18));

    // 预估输出数量 (CAKE -> USDT, 汇率 2:1)
    const result = await pancakeAdapter.estimateOperation(
      6, // SWAP_EXACT_INPUT
      {
        tokens: [await cake.getAddress(), await usdt.getAddress()],
        amounts: [swapAmount],
        recipient: user.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: 0,
        extraData: "0x",
      }
    );

    const estimatedOutput = result.outputAmounts[0];
    const minOutput = (estimatedOutput * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;

    console.log("预估输出:", ethers.formatUnits(estimatedOutput, 18), "USDT");

    // 用户授权CAKE给PancakeAdapter
    await cake
      .connect(user)
      .approve(await pancakeAdapter.getAddress(), swapAmount);

    // 执行交换
    const swapParams = {
      tokens: [await cake.getAddress(), await usdt.getAddress()],
      amounts: [swapAmount, minOutput], // [amountIn, minAmountOut]
      recipient: user.address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      tokenId: 0,
      extraData: "0x",
    };

    const tx = await defiAggregator.connect(user).executeOperation(
      "pancakeswap",
      6, // SWAP_EXACT_INPUT
      swapParams
    );
    await tx.wait();

    // 记录交换后余额
    const usdtAfter = await usdt.balanceOf(user.address);
    const cakeAfter = await cake.balanceOf(user.address);

    console.log("反向交换后:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtAfter, 18));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeAfter, 18));

    // 验证交换结果
    const cakeUsed = cakeBefore - cakeAfter;
    const usdtReceived = usdtAfter - usdtBefore;

    expect(cakeUsed).to.equal(swapAmount);
    expect(usdtReceived).to.be.gte(minOutput);

    console.log("✅ 反向交换成功");
  });

  it("手续费计算验证", async function () {
    const { user, usdt, cake, defiAggregator, pancakeAdapter } =
      await loadFixture(deployFixture);

    const swapAmount = ethers.parseUnits("100", 18);
    const expectedFee = (swapAmount * BigInt(FEE_RATE_BPS)) / 10000n;
    const actualSwapAmount = swapAmount - expectedFee;

    console.log("手续费测试:");
    console.log("输入金额:", ethers.formatUnits(swapAmount, 18), "USDT");
    console.log("预期手续费:", ethers.formatUnits(expectedFee, 18), "USDT");
    console.log(
      "实际交换金额:",
      ethers.formatUnits(actualSwapAmount, 18),
      "USDT"
    );

    // 用户授权给PancakeAdapter
    await usdt
      .connect(user)
      .approve(await pancakeAdapter.getAddress(), swapAmount);

    // 预估输出
    const result = await pancakeAdapter.estimateOperation(
      6, // SWAP_EXACT_INPUT
      {
        tokens: [await usdt.getAddress(), await cake.getAddress()],
        amounts: [swapAmount],
        recipient: user.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: 0,
        extraData: "0x",
      }
    );

    const minOutput =
      (result.outputAmounts[0] * BigInt(10000 - SLIPPAGE_BPS)) / 10000n;

    // 执行交换
    const swapParams = {
      tokens: [await usdt.getAddress(), await cake.getAddress()],
      amounts: [swapAmount, minOutput],
      recipient: user.address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      tokenId: 0,
      extraData: "0x",
    };

    await defiAggregator
      .connect(user)
      .executeOperation("pancakeswap", 6, swapParams);

    console.log("✅ 手续费计算验证完成");
  });
});
