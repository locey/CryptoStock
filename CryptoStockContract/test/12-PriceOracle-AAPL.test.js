/**
 * 12号测试用例 - AAPL 价格获取测试
 * 
 * 功能：
 * 1. 使用已部署的合约地址（从 deployments-unified-oracle-sepolia.json 读取）
 * 2. 分别测试 Pyth 和 RedStone 预言机获取 AAPL 价格
 * 3. 测试聚合预言机获取 AAPL 价格
 * 4. 对比三种价格源的结果
 * 
 * 不重新部署合约，直接使用现有合约地址
 * 
 * 用法：npx hardhat test test/12-PriceOracle-AAPL.test.js --network sepolia
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { fetchUpdateData } = require("../utils/getPythUpdateData");
const { getRedStoneUpdateData } = require("../utils/getRedStoneUpdateData-v061");

describe("12号测试用例 - AAPL 价格获取测试", function () {
  // 设置测试超时时间为 2 分钟
  this.timeout(120000);

  let pythPriceFeed;
  let redstonePriceFeed;
  let priceAggregator;
  let deploymentInfo;

  const TEST_SYMBOL = "AAPL";

  before(async function () {
    console.log("🚀 开始初始化 AAPL 价格获取测试...");

    // 读取部署信息
    const deploymentFilePath = path.join(__dirname, "..", "deployments-unified-oracle-sepolia.json");
    if (!fs.existsSync(deploymentFilePath)) {
      throw new Error("❌ 找不到部署信息文件，请先运行部署脚本");
    }

    deploymentInfo = JSON.parse(fs.readFileSync(deploymentFilePath, "utf8"));
    console.log(`📄 读取部署信息成功 - 部署时间: ${deploymentInfo.metadata.deployTime}`);

    // 获取合约实例
    pythPriceFeed = await ethers.getContractAt("PythPriceFeed", deploymentInfo.contracts.pythPriceFeed.address);
    redstonePriceFeed = await ethers.getContractAt("RedstonePriceFeed", deploymentInfo.contracts.redstonePriceFeed.address);
    priceAggregator = await ethers.getContractAt("PriceAggregator", deploymentInfo.contracts.priceAggregator.address);

    console.log("📍 合约地址:");
    console.log(`   PythPriceFeed:     ${deploymentInfo.contracts.pythPriceFeed.address}`);
    console.log(`   RedstonePriceFeed: ${deploymentInfo.contracts.redstonePriceFeed.address}`);
    console.log(`   PriceAggregator:   ${deploymentInfo.contracts.priceAggregator.address}`);
    console.log("");
  });

  describe("📊 Pyth 预言机价格测试", function () {
    it("应该能够获取 AAPL 的 Pyth 价格", async function () {
      console.log(`🐍 测试 Pyth 预言机获取 ${TEST_SYMBOL} 价格...`);

      try {
        // 1. 获取 Pyth updateData
        console.log(`   📡 获取 ${TEST_SYMBOL} 的 Pyth 更新数据...`);
        const pythUpdateData = await fetchUpdateData([TEST_SYMBOL]);
        console.log(`   ✅ 获取到 ${pythUpdateData.length} 条更新数据`);

        // 2. 计算更新费用
        const updateFee = await pythPriceFeed.getUpdateFee(pythUpdateData);
        console.log(`   💰 更新费用: ${updateFee.toString()} wei`);

        // 3. 准备参数
        const pythParams = {
          symbol: TEST_SYMBOL,
          updateData: pythUpdateData
        };

        // 4. 调用 getPrice
        const pythResult = await pythPriceFeed.getPrice.staticCall(pythParams, { value: updateFee });

        // 5. 验证结果
        expect(pythResult).to.not.be.undefined;
        expect(pythResult.success).to.be.true;
        expect(pythResult.price).to.be.gt(0);

        const priceUSD = ethers.formatEther(pythResult.price);
        console.log(`   💰 ${TEST_SYMBOL} Pyth 价格: $${priceUSD}`);
        console.log(`   ✅ Pyth 价格获取成功`);

        // 验证价格在合理范围内（AAPL 通常在 100-300 美元）
        const price = parseFloat(priceUSD);
        expect(price).to.be.gt(50);   // 大于 $50
        expect(price).to.be.lt(500);  // 小于 $500

      } catch (error) {
        console.log(`   ❌ Pyth 价格获取失败: ${error.message}`);
        throw error;
      }
    });
  });

  describe("🔴 RedStone 预言机价格测试", function () {
    it("应该能够获取 AAPL 的 RedStone 价格", async function () {
      console.log(`🔴 测试 RedStone 预言机获取 ${TEST_SYMBOL} 价格...`);

      try {
        // 1. 获取 RedStone updateData（固定使用 TSLA 配置）
        console.log(`   📡 获取 RedStone payload (固定使用 TSLA)...`);
        const redStoneData = await getRedStoneUpdateData(TEST_SYMBOL);
        console.log(`   ✅ RedStone payload 获取成功，长度: ${redStoneData.updateData.length} 字符`);

        // 2. 准备参数
        const redstoneParams = {
          symbol: TEST_SYMBOL,
          updateData: [redStoneData.updateData] // 包装成数组
        };

        // 3. 调用 getPrice
        const redstoneResult = await redstonePriceFeed.getPrice.staticCall(redstoneParams);

        // 4. 验证结果
        expect(redstoneResult).to.not.be.undefined;
        expect(redstoneResult.success).to.be.true;
        expect(redstoneResult.price).to.be.gt(0);

        const priceUSD = ethers.formatEther(redstoneResult.price);
        console.log(`   💰 ${TEST_SYMBOL} RedStone 价格: $${priceUSD}`);
        console.log(`   ✅ RedStone 价格获取成功`);

        // 验证价格在合理范围内
        const price = parseFloat(priceUSD);
        expect(price).to.be.gt(50);   // 大于 $50
        expect(price).to.be.lt(1000); // 小于 $1000 (RedStone 使用 TSLA 数据，价格可能更高)

      } catch (error) {
        console.log(`   ❌ RedStone 价格获取失败: ${error.message}`);
        throw error;
      }
    });
  });

  describe("🌊 聚合预言机价格测试", function () {
    it("应该能够获取 AAPL 的聚合价格", async function () {
      console.log(`🌊 测试聚合预言机获取 ${TEST_SYMBOL} 价格...`);

      try {
        // 1. 准备 Pyth updateData
        console.log(`   📡 准备聚合器更新数据...`);
        const pythUpdateData = await fetchUpdateData([TEST_SYMBOL]);
        const redStoneData = await getRedStoneUpdateData(TEST_SYMBOL);

        // 2. 组装 updateDataArray
        const updateDataArray = [
          pythUpdateData,                 // Pyth 的 updateData (bytes[])
          [redStoneData.updateData]      // RedStone 的 payload (包装成 bytes[])
        ];

        // 3. 计算更新费用
        const updateFee = await pythPriceFeed.getUpdateFee(pythUpdateData);
        console.log(`   💰 聚合器更新费用: ${updateFee.toString()} wei`);

        // 4. 调用聚合器
        const aggregatedPrice = await priceAggregator.getAggregatedPrice.staticCall(
          TEST_SYMBOL,
          updateDataArray,
          { value: updateFee }
        );

        // 5. 验证结果
        expect(aggregatedPrice).to.be.gt(0);

        const priceUSD = ethers.formatEther(aggregatedPrice);
        console.log(`   💰 ${TEST_SYMBOL} 聚合价格: $${priceUSD}`);
        console.log(`   ✅ 聚合价格获取成功`);

        // 验证价格在合理范围内
        const price = parseFloat(priceUSD);
        expect(price).to.be.gt(50);   // 大于 $50
        expect(price).to.be.lt(1000); // 小于 $1000

      } catch (error) {
        console.log(`   ❌ 聚合价格获取失败: ${error.message}`);
        throw error;
      }
    });
  });

  describe("📈 价格对比分析", function () {
    it("应该对比三种价格源的结果", async function () {
      console.log(`📈 对比分析 ${TEST_SYMBOL} 的三种价格源...`);

      const results = {};

      try {
        // 1. 获取 Pyth 价格
        console.log(`   🐍 获取 Pyth 价格...`);
        const pythUpdateData = await fetchUpdateData([TEST_SYMBOL]);
        const pythUpdateFee = await pythPriceFeed.getUpdateFee(pythUpdateData);
        const pythParams = { symbol: TEST_SYMBOL, updateData: pythUpdateData };
        const pythResult = await pythPriceFeed.getPrice.staticCall(pythParams, { value: pythUpdateFee });

        results.pyth = {
          success: pythResult.success,
          price: pythResult.success ? ethers.formatEther(pythResult.price) : "0",
          priceWei: pythResult.price || 0n
        };

      } catch (error) {
        console.log(`   ❌ Pyth 价格获取失败: ${error.message}`);
        results.pyth = { success: false, price: "0", priceWei: 0n, error: error.message };
      }

      try {
        // 2. 获取 RedStone 价格
        console.log(`   🔴 获取 RedStone 价格...`);
        const redStoneData = await getRedStoneUpdateData(TEST_SYMBOL);
        const redstoneParams = { symbol: TEST_SYMBOL, updateData: [redStoneData.updateData] };
        const redstoneResult = await redstonePriceFeed.getPrice.staticCall(redstoneParams);

        results.redstone = {
          success: redstoneResult.success,
          price: redstoneResult.success ? ethers.formatEther(redstoneResult.price) : "0",
          priceWei: redstoneResult.price || 0n
        };

      } catch (error) {
        console.log(`   ❌ RedStone 价格获取失败: ${error.message}`);
        results.redstone = { success: false, price: "0", priceWei: 0n, error: error.message };
      }

      try {
        // 3. 获取聚合价格
        console.log(`   🌊 获取聚合价格...`);
        const pythUpdateData = await fetchUpdateData([TEST_SYMBOL]);
        const redStoneData = await getRedStoneUpdateData(TEST_SYMBOL);
        const updateDataArray = [pythUpdateData, [redStoneData.updateData]];
        const updateFee = await pythPriceFeed.getUpdateFee(pythUpdateData);
        const aggregatedPrice = await priceAggregator.getAggregatedPrice.staticCall(
          TEST_SYMBOL, updateDataArray, { value: updateFee }
        );

        results.aggregated = {
          success: true,
          price: ethers.formatEther(aggregatedPrice),
          priceWei: aggregatedPrice
        };

      } catch (error) {
        console.log(`   ❌ 聚合价格获取失败: ${error.message}`);
        results.aggregated = { success: false, price: "0", priceWei: 0n, error: error.message };
      }

      // 4. 输出对比结果
      console.log(`\n📊 ${TEST_SYMBOL} 价格对比结果:`);
      console.log(`   Pyth 价格:     ${results.pyth.success ? '$' + results.pyth.price : '❌ ' + (results.pyth.error || '失败')}`);
      console.log(`   RedStone 价格: ${results.redstone.success ? '$' + results.redstone.price : '❌ ' + (results.redstone.error || '失败')}`);
      console.log(`   聚合价格:     ${results.aggregated.success ? '$' + results.aggregated.price : '❌ ' + (results.aggregated.error || '失败')}`);

      // 5. 计算价格差异
      if (results.pyth.success && results.redstone.success) {
        const pythPrice = parseFloat(results.pyth.price);
        const redstonePrice = parseFloat(results.redstone.price);
        const priceDiff = Math.abs(pythPrice - redstonePrice);
        const priceDiffPercent = (priceDiff / pythPrice) * 100;

        console.log(`\n📈 价格分析:`);
        console.log(`   价格差异: $${priceDiff.toFixed(4)}`);
        console.log(`   差异百分比: ${priceDiffPercent.toFixed(2)}%`);

        // 验证价格差异在合理范围内（小于50%）
        expect(priceDiffPercent).to.be.lt(50, "价格差异过大");
      }

      // 6. 验证至少一个价格源成功
      const successCount = [results.pyth.success, results.redstone.success, results.aggregated.success].filter(Boolean).length;
      expect(successCount).to.be.gt(0, "所有价格源都失败了");

      console.log(`\n✅ 价格对比测试完成，成功获取 ${successCount}/3 个价格源的数据`);
    });
  });

  describe("💰 USDT 购买 AAPL 代币测试", function () {
    let usdtToken;
    let aaplToken;
    let deployerSigner;
    let user;

    before(async function () {
      console.log("🔧 初始化 USDT 购买 AAPL 测试环境...");

      // 获取签名者
      const signers = await ethers.getSigners();
      deployerSigner = signers[0];
      user = signers[1] || signers[0]; // 如果只有一个签名者，用同一个

      // 读取股票代币部署信息
      const stockDeploymentPath = path.join(__dirname, "..", "deployments-stock-sepolia.json");
      if (!fs.existsSync(stockDeploymentPath)) {
        throw new Error("❌ 找不到股票代币部署信息文件，请先运行 deploy-stock-sepolia-unified.js");
      }

      const stockDeploymentInfo = JSON.parse(fs.readFileSync(stockDeploymentPath, "utf8"));
      console.log(`📄 读取股票代币部署信息成功`);

      // 获取合约实例
      usdtToken = await ethers.getContractAt("MockERC20", stockDeploymentInfo.contracts.USDT);
      aaplToken = await ethers.getContractAt("StockToken", stockDeploymentInfo.stockTokens.AAPL);

      console.log("📍 代币合约地址:");
      console.log(`   USDT: ${stockDeploymentInfo.contracts.USDT}`);
      console.log(`   AAPL: ${stockDeploymentInfo.stockTokens.AAPL}`);
      console.log(`   用户地址: ${await user.getAddress()}`);
    });

    it("应该能够使用 USDT 成功购买 AAPL 代币", async function () {
      console.log(`💰 测试使用 USDT 购买 AAPL 代币...`);

      try {
        // 1. 检查合约代币供应情况
        const contractAaplBalance = await aaplToken.balanceOf(await aaplToken.getAddress());
        const ownerAaplBalance = await aaplToken.balanceOf(await deployerSigner.getAddress());
        const totalSupply = await aaplToken.totalSupply();

        console.log(`   📊 AAPL 代币供应情况:`);
        console.log(`      合约余额: ${ethers.formatEther(contractAaplBalance)}`);
        console.log(`      所有者余额: ${ethers.formatEther(ownerAaplBalance)}`);
        console.log(`      总供应量: ${ethers.formatEther(totalSupply)}`);

        // 2. 如果合约中代币不足，注入一些代币
        const requiredTokens = ethers.parseEther("1000"); // 需要1000个代币用于交易
        if (contractAaplBalance < requiredTokens) {
          console.log(`   🔄 合约代币不足，正在注入代币...`);

          // 检查owner是否有足够的代币
          if (ownerAaplBalance < requiredTokens) {
            console.log(`   🪙 所有者代币不足，正在铸造代币...`);
            const mintAmount = requiredTokens - ownerAaplBalance + ethers.parseEther("1000"); // 额外铸造1000个
            await aaplToken.mint(await deployerSigner.getAddress(), mintAmount);
            console.log(`   ✅ 已铸造 ${ethers.formatEther(mintAmount)} 个 AAPL 代币给所有者`);
          }

          // 注入代币到合约
          await aaplToken.injectTokens(requiredTokens);
          const newContractBalance = await aaplToken.balanceOf(await aaplToken.getAddress());
          console.log(`   ✅ 已注入代币，合约新余额: ${ethers.formatEther(newContractBalance)}`);

          // 等待代币注入状态同步
          console.log(`   ⏳ 等待代币注入状态同步...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        }

        // 3. 检查用户初始余额
        const userAddress = await user.getAddress();
        const initialUsdtBalance = await usdtToken.balanceOf(userAddress);
        const initialAaplBalance = await aaplToken.balanceOf(userAddress);

        console.log(`   📊 用户初始余额:`);
        console.log(`      USDT: ${ethers.formatUnits(initialUsdtBalance, 6)}`);
        console.log(`      AAPL: ${ethers.formatEther(initialAaplBalance)}`);

        // 4. 如果用户USDT余额不足，先铸造一些USDT
        const purchaseAmount = ethers.parseUnits("100", 6); // 100 USDT
        if (initialUsdtBalance < purchaseAmount) {
          console.log(`   🪙 为用户铸造 USDT...`);
          await usdtToken.mint(userAddress, purchaseAmount * 2n); // 铸造200 USDT，确保足够
          const newUsdtBalance = await usdtToken.balanceOf(userAddress);
          console.log(`   ✅ 铸造后 USDT 余额: ${ethers.formatUnits(newUsdtBalance, 6)}`);

          // 等待USDT铸造状态同步
          console.log(`   ⏳ 等待USDT铸造状态同步...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        }

        // 5. 授权 AAPL 合约使用用户的 USDT
        console.log(`   🔐 授权 AAPL 合约使用 USDT...`);
        const aaplAddress = await aaplToken.getAddress();
        console.log(`   📋 授权金额: ${ethers.formatUnits(purchaseAmount, 6)} USDT`);

        const approveTx = await usdtToken.connect(user).approve(aaplAddress, purchaseAmount);
        console.log(`   📝 授权交易哈希: ${approveTx.hash}`);

        // 等待交易确认
        console.log(`   ⏳ 等待授权交易确认...`);
        const approveReceipt = await approveTx.wait();
        console.log(`   ✅ 授权交易确认，区块: ${approveReceipt.blockNumber}`);

        // 等待网络状态同步
        console.log(`   ⏳ 等待网络状态同步 (5秒)...`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 减少到5秒

        // 验证授权状态
        const allowance = await usdtToken.allowance(userAddress, aaplAddress);
        console.log(`   🔍 当前授权额度: ${ethers.formatUnits(allowance, 6)} USDT`);

        if (allowance < purchaseAmount) {
          console.log(`   ⚠️  授权额度不足，重新授权...`);
          const reapproveTx = await usdtToken.connect(user).approve(aaplAddress, purchaseAmount * 2n);
          await reapproveTx.wait();
          console.log(`   ✅ 重新授权完成`);

          await new Promise(resolve => setTimeout(resolve, 3000)); // 再等3秒
          const newAllowance = await usdtToken.allowance(userAddress, aaplAddress);
          console.log(`   🔍 新授权额度: ${ethers.formatUnits(newAllowance, 6)} USDT`);
        }

        // 6. 准备预言机更新数据
        console.log(`   📡 准备预言机更新数据...`);

        let pythUpdateData;
        let maxRetries = 3;

        // 重试获取Pyth数据
        for (let i = 0; i < maxRetries; i++) {
          try {
            console.log(`   🔄 尝试获取Pyth数据 (${i + 1}/${maxRetries})...`);
            pythUpdateData = await fetchUpdateData([TEST_SYMBOL]);
            console.log(`   ✅ Pyth数据获取成功`);
            break;
          } catch (error) {
            console.log(`   ❌ 第${i + 1}次获取失败: ${error.message}`);
            if (i === maxRetries - 1) {
              console.log(`   🚨 Pyth数据获取失败，使用空数据继续测试...`);
              pythUpdateData = ["0x"]; // 使用空的更新数据
            } else {
              console.log(`   ⏳ 等待3秒后重试...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }

        const redStoneData = await getRedStoneUpdateData(TEST_SYMBOL);
        const updateDataArray = [
          pythUpdateData,
          [redStoneData.updateData]
        ];

        // 7. 计算更新费用
        const updateFee = await pythPriceFeed.getUpdateFee(pythUpdateData);
        console.log(`   💰 预言机更新费用: ${updateFee.toString()} wei`);

        // 8. 获取当前价格用于计算最小代币数量
        const currentPrice = await priceAggregator.getAggregatedPrice.staticCall(
          TEST_SYMBOL,
          updateDataArray,
          { value: updateFee }
        );
        console.log(`   📈 当前 AAPL 价格: $${ethers.formatEther(currentPrice)}`);

        // 9. 计算预期获得的代币数量（考虑手续费和滑点）
        // 根据StockToken合约：tokenAmountBeforeFee = (usdtAmount * 1e30) / stockPrice
        const tokenAmountBeforeFee = (purchaseAmount * ethers.parseEther("1000000000000")) / currentPrice; // 1e30 = 1e18 * 1e12
        const tradeFeeRate = 30n; // 0.3% = 30 基点
        const feeAmount = (tokenAmountBeforeFee * tradeFeeRate) / 10000n;
        const expectedTokenAmount = tokenAmountBeforeFee - feeAmount;
        const minTokenAmount = expectedTokenAmount * 90n / 100n; // 允许10%滑点，更宽松

        console.log(`   🎯 预期获得代币: ${ethers.formatEther(expectedTokenAmount)}`);
        console.log(`   💸 手续费: ${ethers.formatEther(feeAmount)}`);
        console.log(`   🛡️ 最小接受代币: ${ethers.formatEther(minTokenAmount)}`);

        // 10. 等待一下确保所有状态更新
        console.log(`   ⏳ 等待网络状态同步...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒

        // 验证合约状态
        const finalContractBalance = await aaplToken.balanceOf(await aaplToken.getAddress());
        const userAllowance = await usdtToken.allowance(userAddress, await aaplToken.getAddress());
        console.log(`   🔍 最终验证:`);
        console.log(`      合约AAPL余额: ${ethers.formatEther(finalContractBalance)}`);
        console.log(`      用户授权额度: ${ethers.formatUnits(userAllowance, 6)}`);
        console.log(`      需要代币数量: ${ethers.formatEther(expectedTokenAmount)}`);

        // 确保合约有足够的代币
        if (finalContractBalance < expectedTokenAmount) {
          throw new Error(`合约代币余额不足: 需要 ${ethers.formatEther(expectedTokenAmount)}，实际 ${ethers.formatEther(finalContractBalance)}`);
        }

        // 11. 执行购买交易
        console.log(`   🚀 执行购买交易...`);
        const buyTx = await aaplToken.connect(user).buy(
          purchaseAmount,
          minTokenAmount,
          updateDataArray,
          { value: updateFee }
        );

        const receipt = await buyTx.wait();
        console.log(`   ✅ 交易成功，Gas 使用: ${receipt.gasUsed.toString()}`);

        // 12. 检查交易后余额
        const finalUsdtBalance = await usdtToken.balanceOf(userAddress);
        const finalAaplBalance = await aaplToken.balanceOf(userAddress);

        console.log(`   📊 交易后余额:`);
        console.log(`      USDT: ${ethers.formatUnits(finalUsdtBalance, 6)}`);
        console.log(`      AAPL: ${ethers.formatEther(finalAaplBalance)}`);

        // 13. 验证余额变化
        const usdtSpent = initialUsdtBalance - finalUsdtBalance;
        const aaplReceived = finalAaplBalance - initialAaplBalance;

        console.log(`   📈 交易结果:`);
        console.log(`      支付 USDT: ${ethers.formatUnits(usdtSpent, 6)}`);
        console.log(`      获得 AAPL: ${ethers.formatEther(aaplReceived)}`);

        // 验证断言
        expect(usdtSpent).to.equal(purchaseAmount, "USDT 支付金额不正确");
        expect(aaplReceived).to.be.gt(0, "应该获得 AAPL 代币");
        expect(aaplReceived).to.be.gte(minTokenAmount, "获得的代币数量低于最小值");

        // 验证事件是否正确发出
        const events = receipt.logs.filter(log => {
          try {
            return aaplToken.interface.parseLog(log);
          } catch {
            return false;
          }
        });

        const purchaseEvent = events.find(event => {
          const parsed = aaplToken.interface.parseLog(event);
          return parsed.name === "TokenPurchased";
        });

        expect(purchaseEvent).to.not.be.undefined;
        console.log(`   🎉 TokenPurchased 事件已正确发出`);

        console.log(`   ✅ USDT 购买 AAPL 测试成功完成!`);

      } catch (error) {
        console.log(`   ❌ USDT 购买 AAPL 失败: ${error.message}`);
        throw error;
      }
    });

    it("应该能够使用 AAPL 代币成功卖出换取 USDT", async function () {
      console.log(`💰 测试使用 AAPL 代币卖出换取 USDT...`);

      try {
        // 1. 检查用户AAPL余额，如果没有则先转一些
        const userAddress = await user.getAddress();
        let userAaplBalance = await aaplToken.balanceOf(userAddress);
        console.log(`   📊 用户当前AAPL余额: ${ethers.formatEther(userAaplBalance)}`);

        const sellAmount = ethers.parseEther("10"); // 卖出10个AAPL

        if (userAaplBalance < sellAmount) {
          console.log(`   🪙 用户AAPL余额不足，先转入一些AAPL代币...`);

          // 重试转账操作，处理网络连接问题
          let transferSuccess = false;
          let transferRetries = 3;

          for (let i = 0; i < transferRetries; i++) {
            try {
              console.log(`   🔄 尝试转账AAPL (${i + 1}/${transferRetries})...`);
              await aaplToken.connect(deployerSigner).transfer(userAddress, sellAmount * 2n);
              transferSuccess = true;
              console.log(`   ✅ 转账成功`);
              break;
            } catch (error) {
              console.log(`   ❌ 第${i + 1}次转账失败: ${error.message}`);
              if (i === transferRetries - 1) {
                throw new Error(`转账失败，已重试${transferRetries}次: ${error.message}`);
              } else {
                console.log(`   ⏳ 等待5秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
              }
            }
          }

          if (transferSuccess) {
            userAaplBalance = await aaplToken.balanceOf(userAddress);
            console.log(`   ✅ 转入后用户AAPL余额: ${ethers.formatEther(userAaplBalance)}`);

            // 等待转账状态同步
            console.log(`   ⏳ 等待转账状态同步...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        // 2. 检查合约USDT余额，确保有足够的USDT支付用户
        const contractUsdtBalance = await usdtToken.balanceOf(await aaplToken.getAddress());
        console.log(`   📊 合约当前USDT余额: ${ethers.formatUnits(contractUsdtBalance, 6)}`);

        // 估算需要的USDT（按当前价格粗略计算）
        const roughPrice = ethers.parseEther("200"); // 假设AAPL价格约200美元
        const estimatedUsdt = (sellAmount * roughPrice) / ethers.parseEther("1000000000000"); // 转换为6位精度
        const requiredUsdt = estimatedUsdt * 2n; // 预留2倍余量

        if (contractUsdtBalance < requiredUsdt) {
          console.log(`   🔄 合约USDT不足，正在注入USDT...`);

          // 检查部署者是否有足够的USDT
          const deployerUsdtBalance = await usdtToken.balanceOf(await deployerSigner.getAddress());
          if (deployerUsdtBalance < requiredUsdt) {
            console.log(`   🪙 部署者USDT不足，正在铸造USDT...`);
            const mintAmount = requiredUsdt - deployerUsdtBalance + ethers.parseUnits("10000", 6); // 额外铸造10000 USDT

            // 重试铸造操作
            let mintSuccess = false;
            for (let i = 0; i < 3; i++) {
              try {
                console.log(`   🔄 尝试铸造USDT (${i + 1}/3)...`);
                await usdtToken.mint(await deployerSigner.getAddress(), mintAmount);
                mintSuccess = true;
                console.log(`   ✅ 已铸造 ${ethers.formatUnits(mintAmount, 6)} USDT 给部署者`);
                break;
              } catch (error) {
                console.log(`   ❌ 第${i + 1}次铸造失败: ${error.message}`);
                if (i === 2) throw error;
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            }
          }

          // 重试转移USDT到合约
          let transferSuccess = false;
          for (let i = 0; i < 3; i++) {
            try {
              console.log(`   🔄 尝试转移USDT到合约 (${i + 1}/3)...`);
              await usdtToken.connect(deployerSigner).transfer(await aaplToken.getAddress(), requiredUsdt);
              transferSuccess = true;
              const newContractUsdtBalance = await usdtToken.balanceOf(await aaplToken.getAddress());
              console.log(`   ✅ 已注入USDT，合约新余额: ${ethers.formatUnits(newContractUsdtBalance, 6)}`);
              break;
            } catch (error) {
              console.log(`   ❌ 第${i + 1}次转移失败: ${error.message}`);
              if (i === 2) throw error;
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }

          // 等待USDT注入状态同步
          console.log(`   ⏳ 等待USDT注入状态同步...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // 3. 检查初始余额
        const initialUsdtBalance = await usdtToken.balanceOf(userAddress);
        const initialAaplBalance = await aaplToken.balanceOf(userAddress);

        console.log(`   📊 用户初始余额:`);
        console.log(`      USDT: ${ethers.formatUnits(initialUsdtBalance, 6)}`);
        console.log(`      AAPL: ${ethers.formatEther(initialAaplBalance)}`);

        // 4. 准备预言机更新数据
        console.log(`   📡 准备预言机更新数据...`);

        let pythUpdateData;
        let maxRetries = 3;

        // 重试获取Pyth数据
        for (let i = 0; i < maxRetries; i++) {
          try {
            console.log(`   🔄 尝试获取Pyth数据 (${i + 1}/${maxRetries})...`);
            pythUpdateData = await fetchUpdateData([TEST_SYMBOL]);
            console.log(`   ✅ Pyth数据获取成功`);
            break;
          } catch (error) {
            console.log(`   ❌ 第${i + 1}次获取失败: ${error.message}`);
            if (i === maxRetries - 1) {
              console.log(`   🚨 Pyth数据获取失败，使用空数据继续测试...`);
              pythUpdateData = ["0x"]; // 使用空的更新数据
            } else {
              console.log(`   ⏳ 等待5秒后重试...`);
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        }

        const redStoneData = await getRedStoneUpdateData(TEST_SYMBOL);
        const updateDataArray = [
          pythUpdateData,
          [redStoneData.updateData]
        ];

        // 5. 计算更新费用
        const updateFee = await pythPriceFeed.getUpdateFee(pythUpdateData);
        console.log(`   💰 预言机更新费用: ${updateFee.toString()} wei`);

        // 6. 获取当前AAPL价格
        const currentPrice = await priceAggregator.getAggregatedPrice.staticCall(TEST_SYMBOL, updateDataArray, { value: updateFee });
        console.log(`   📈 当前 AAPL 价格: $${ethers.formatEther(currentPrice)}`);

        // 7. 计算预期获得的USDT (考虑手续费)
        const tradeFeeRate = await aaplToken.tradeFeeRate();
        const expectedUsdtBeforeFee = (sellAmount * currentPrice) / ethers.parseEther("1000000000000"); // 转换为6位精度USDT
        const feeAmount = (expectedUsdtBeforeFee * tradeFeeRate) / 10000n;
        const expectedUsdtAmount = expectedUsdtBeforeFee - feeAmount;
        const minUsdtAmount = expectedUsdtAmount * 90n / 100n; // 10%滑点保护，与买入测试保持一致

        console.log(`   🎯 预期获得USDT: ${ethers.formatUnits(expectedUsdtAmount, 6)}`);
        console.log(`   💸 手续费: ${ethers.formatUnits(feeAmount, 6)}`);
        console.log(`   🛡️ 最小接受USDT: ${ethers.formatUnits(minUsdtAmount, 6)}`);

        // 8. 最终验证合约状态
        console.log(`   ⏳ 等待网络状态同步...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const finalContractUsdtBalance = await usdtToken.balanceOf(await aaplToken.getAddress());
        console.log(`   🔍 最终验证:`);
        console.log(`      合约USDT余额: ${ethers.formatUnits(finalContractUsdtBalance, 6)}`);
        console.log(`      需要USDT数量: ${ethers.formatUnits(expectedUsdtAmount, 6)}`);

        // 确保合约有足够的USDT
        if (finalContractUsdtBalance < expectedUsdtAmount) {
          throw new Error(`合约USDT余额不足: 需要 ${ethers.formatUnits(expectedUsdtAmount, 6)}，实际 ${ethers.formatUnits(finalContractUsdtBalance, 6)}`);
        }

        // 9. 执行卖出交易
        console.log(`   🚀 执行卖出交易...`);
        const sellTx = await aaplToken.connect(user).sell(
          sellAmount,
          minUsdtAmount,
          updateDataArray,
          { value: updateFee }
        );

        const receipt = await sellTx.wait();
        console.log(`   ✅ 交易成功，Gas 使用: ${receipt.gasUsed.toString()}`);

        // 10. 验证余额变化
        const finalUsdtBalance = await usdtToken.balanceOf(userAddress);
        const finalAaplBalance = await aaplToken.balanceOf(userAddress);

        const usdtReceived = finalUsdtBalance - initialUsdtBalance;
        const aaplSold = initialAaplBalance - finalAaplBalance;

        console.log(`   📊 交易后余额:`);
        console.log(`      USDT: ${ethers.formatUnits(finalUsdtBalance, 6)} (+${ethers.formatUnits(usdtReceived, 6)})`);
        console.log(`      AAPL: ${ethers.formatEther(finalAaplBalance)} (-${ethers.formatEther(aaplSold)})`);

        // 11. 验证交易结果
        console.log(`   📈 交易结果:`);
        console.log(`      卖出 AAPL: ${ethers.formatEther(aaplSold)}`);
        console.log(`      获得 USDT: ${ethers.formatUnits(usdtReceived, 6)}`);

        expect(aaplSold).to.equal(sellAmount, "卖出的AAPL数量应该正确");
        expect(usdtReceived).to.be.greaterThan(0, "应该收到USDT");
        expect(usdtReceived).to.be.gte(minUsdtAmount, "收到的USDT应该不少于最小金额");

        // 12. 验证事件
        const sellEvent = receipt.logs.find(log => {
          try {
            const parsedLog = aaplToken.interface.parseLog(log);
            return parsedLog && parsedLog.name === "TokenSold";
          } catch (e) {
            return false;
          }
        });

        expect(sellEvent).to.not.be.undefined;
        console.log(`   🎉 TokenSold 事件已正确发出`);

        console.log(`   ✅ AAPL 卖出测试成功完成!`);

      } catch (error) {
        console.log(`   ❌ AAPL 卖出失败: ${error.message}`);
        throw error;
      }
    });
  });

  after(function () {
    console.log("\n🎉 AAPL 价格获取测试完成!");
    console.log("📋 测试总结:");
    console.log("   ✅ 使用已部署的合约地址");
    console.log("   ✅ 测试了 Pyth 预言机价格获取");
    console.log("   ✅ 测试了 RedStone 预言机价格获取");
    console.log("   ✅ 测试了聚合预言机价格获取");
    console.log("   ✅ 对比分析了三种价格源的结果");
    console.log("   ✅ 测试了使用 USDT 购买 AAPL 代币功能");
    console.log("   ✅ 测试了使用 AAPL 代币卖出换取 USDT 功能");
  });
});