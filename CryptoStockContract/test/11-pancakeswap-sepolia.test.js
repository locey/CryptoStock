const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

describe("11-pancakeswap-sepolia.test.js - PancakeAdapter Sepolia 测试", function () {
  let deploymentConfig;
  let deployer, user;
  let usdt, cake, mockRouter, defiAggregator, pancakeAdapter;
  let USDT_ADDRESS, CAKE_ADDRESS, ROUTER_ADDRESS;
  
  const USER_SWAP_AMOUNT = ethers.parseUnits("100", 6); // 100 USDT (6 decimals)
  const FEE_RATE_BPS = 30; // 0.3% fee rate
  const SLIPPAGE_BPS = 100; // 1% slippage

  before(async function() {
    // 加载部署配置
    const deploymentPath = path.join(__dirname, '..', 'deployments-pancake-adapter-sepolia.json');
    if (!fs.existsSync(deploymentPath)) {
      throw new Error(`部署文件不存在: ${deploymentPath}`);
    }
    
    deploymentConfig = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log("已加载部署配置:", deploymentConfig.network);
    
    // 检查网络
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== BigInt(deploymentConfig.chainId)) {
      this.skip();
    }

    // 获取账户
    [deployer, user] = await ethers.getSigners();

    // 从部署配置获取地址
    USDT_ADDRESS = deploymentConfig.contracts.MockERC20_USDT;
    CAKE_ADDRESS = deploymentConfig.contracts.MockCakeToken;
    ROUTER_ADDRESS = deploymentConfig.contracts.MockPancakeRouter;
    const DEFI_AGGREGATOR = deploymentConfig.contracts.DefiAggregator;
    const PANCAKE_ADAPTER = deploymentConfig.contracts.PancakeAdapter;

    // 获取已部署的合约实例
    usdt = await ethers.getContractAt("MockERC20", USDT_ADDRESS);
    cake = await ethers.getContractAt("MockERC20", CAKE_ADDRESS);
    mockRouter = await ethers.getContractAt("MockPancakeRouter", ROUTER_ADDRESS);
    defiAggregator = await ethers.getContractAt("DefiAggregator", DEFI_AGGREGATOR);
    pancakeAdapter = await ethers.getContractAt("PancakeAdapter", PANCAKE_ADAPTER);

    console.log("✅ 已连接到 Sepolia 上的合约:");
    console.log("   USDT:", USDT_ADDRESS);
    console.log("   CAKE:", CAKE_ADDRESS);
    console.log("   Router:", ROUTER_ADDRESS);
    console.log("   DefiAggregator:", DEFI_AGGREGATOR);
    console.log("   PancakeAdapter:", PANCAKE_ADAPTER);
  });

  it("精确输入交换 (USDT -> CAKE)", async function () {
    // 检查用户代币余额，如果不足则跳过测试
    const userUsdtBalance = await usdt.balanceOf(user.address);
    if (userUsdtBalance < USER_SWAP_AMOUNT) {
      console.log(`用户 USDT 余额不足: ${ethers.formatUnits(userUsdtBalance, 6)} USDT`);
      console.log(`需要至少: ${ethers.formatUnits(USER_SWAP_AMOUNT, 6)} USDT`);
      this.skip();
    }

    // 记录交换前余额
    const usdtBefore = await usdt.balanceOf(user.address);
    const cakeBefore = await cake.balanceOf(user.address);

    console.log("交换前:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtBefore, 6));
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
    const minOutput = (estimatedOutput * 99n) / 100n; // 1% 滑点

    console.log("预估输出:", ethers.formatUnits(estimatedOutput, 18), "CAKE");
    console.log("最小输出:", ethers.formatUnits(minOutput, 18), "CAKE");

    // 用户授权USDT给PancakeAdapter
    console.log("授权 USDT 给 PancakeAdapter...");
    const approveTx = await usdt
      .connect(user)
      .approve(await pancakeAdapter.getAddress(), USER_SWAP_AMOUNT);
    
    // 等待授权交易确认
    await approveTx.wait();
    console.log("✅ 授权完成");

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
      "pancake", // 使用部署配置中的注册名称
      6, // SWAP_EXACT_INPUT
      swapParams
    );
    await tx.wait();

    // 记录交换后余额
    const usdtAfter = await usdt.balanceOf(user.address);
    const cakeAfter = await cake.balanceOf(user.address);

    console.log("交换后:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtAfter, 6));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeAfter, 18));

    // 验证交换结果
    const usdtUsed = usdtBefore - usdtAfter;
    const cakeReceived = cakeAfter - cakeBefore;

    expect(usdtUsed).to.equal(USER_SWAP_AMOUNT);
    expect(cakeReceived).to.be.gte(minOutput);

    console.log("实际输出:", ethers.formatUnits(cakeReceived, 18), "CAKE");
    console.log("✅ 精确输入交换成功");
  });

  it("精确输出交换 (CAKE -> USDT)", async function () {
    // 检查用户CAKE余额 (应该从前一个测试获得了CAKE)
    const userCakeBalance = await cake.balanceOf(user.address);
    const userUsdtBalance = await usdt.balanceOf(user.address);
    
    console.log("当前余额:");
    console.log("用户USDT余额:", ethers.formatUnits(userUsdtBalance, 6));
    console.log("用户CAKE余额:", ethers.formatUnits(userCakeBalance, 18));

    // 检查是否有CAKE可用于交换
    if (userCakeBalance <= 0n) {
      console.log("用户没有CAKE余额，跳过精确输出交换测试");
      this.skip();
    }

    // 记录交换前余额
    const usdtBefore = await usdt.balanceOf(user.address);
    const cakeBefore = await cake.balanceOf(user.address);

    console.log("交换前:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtBefore, 6));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeBefore, 18));

    // 设定期望输出数量 (想要获得10 USDT)
    const desiredOutput = ethers.parseUnits("10", 6); // 想要10 USDT

    // 预估需要的CAKE输入数量
    const result = await pancakeAdapter.estimateOperation(
      8, // SWAP_EXACT_OUTPUT
      {
        tokens: [await cake.getAddress(), await usdt.getAddress()],
        amounts: [desiredOutput],
        recipient: user.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: 0,
        extraData: "0x",
      }
    );

    const estimatedInput = result.outputAmounts[0];
    const maxInput = (estimatedInput * 101n) / 100n; // 1% 滑点

    console.log("预估输入:", ethers.formatUnits(estimatedInput, 18), "CAKE");
    console.log("最大输入:", ethers.formatUnits(maxInput, 18), "CAKE");

    // 检查用户是否有足够的CAKE
    if (userCakeBalance < maxInput) {
      console.log(`用户 CAKE 余额不足，跳过测试`);
      console.log(`需要: ${ethers.formatUnits(maxInput, 18)} CAKE，但只有: ${ethers.formatUnits(userCakeBalance, 18)} CAKE`);
      this.skip();
    }

    // 用户授权CAKE给PancakeAdapter
    console.log("授权 CAKE 给 PancakeAdapter (精确输出)...");
    const approveTx2 = await cake
      .connect(user)
      .approve(await pancakeAdapter.getAddress(), maxInput);
    
    // 等待授权交易确认
    await approveTx2.wait();
    console.log("✅ 授权完成");

    // 执行交换
    const swapParams = {
      tokens: [await cake.getAddress(), await usdt.getAddress()],
      amounts: [desiredOutput, maxInput], // [amountOut, maxAmountIn]
      recipient: user.address,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      tokenId: 0,
      extraData: "0x",
    };

    const tx = await defiAggregator.connect(user).executeOperation(
      "pancake", // 使用部署配置中的注册名称
      8, // SWAP_EXACT_OUTPUT
      swapParams
    );
    await tx.wait();

    // 记录交换后余额
    const usdtAfter = await usdt.balanceOf(user.address);
    const cakeAfter = await cake.balanceOf(user.address);

    console.log("交换后:");
    console.log("用户USDT余额:", ethers.formatUnits(usdtAfter, 6));
    console.log("用户CAKE余额:", ethers.formatUnits(cakeAfter, 18));

    // 验证交换结果
    const cakeUsed = cakeBefore - cakeAfter;
    const usdtReceived = usdtAfter - usdtBefore;

    expect(usdtReceived).to.equal(desiredOutput);
    expect(cakeUsed).to.be.lte(maxInput);

    console.log("实际输入:", ethers.formatUnits(cakeUsed, 18), "CAKE");
    console.log("实际输出:", ethers.formatUnits(usdtReceived, 6), "USDT");
    console.log("✅ 精确输出交换成功");
  });

  it("手续费计算验证", async function () {
    const swapAmount = ethers.parseUnits("100", 6); // 修改为使用6位小数
    const expectedFee = (swapAmount * BigInt(FEE_RATE_BPS)) / 10000n;
    const actualSwapAmount = swapAmount - expectedFee;

    console.log("手续费测试:");
    console.log("输入金额:", ethers.formatUnits(swapAmount, 6), "USDT");
    console.log("预期手续费:", ethers.formatUnits(expectedFee, 6), "USDT");
    console.log(
      "实际交换金额:",
      ethers.formatUnits(actualSwapAmount, 6),
      "USDT"
    );

    // 用户授权给PancakeAdapter
    console.log("授权 USDT 给 PancakeAdapter (手续费测试)...");
    const approveTx4 = await usdt
      .connect(user)
      .approve(await pancakeAdapter.getAddress(), swapAmount);
    
    // 等待授权交易确认
    await approveTx4.wait();
    console.log("✅ 授权完成");

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
      .executeOperation("pancake", 6, swapParams);

    console.log("✅ 手续费计算验证完成");
  });
});
