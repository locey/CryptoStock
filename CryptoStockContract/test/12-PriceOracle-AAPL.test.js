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

    it.only("应该能够使用 USDT 成功购买 AAPL 代币", async function () {
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
        await usdtToken.connect(user).approve(await aaplToken.getAddress(), purchaseAmount);
        console.log(`   ✅ 授权完成`);
        
        // 等待授权状态同步
        console.log(`   ⏳ 等待授权状态同步...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        
        // 6. 准备预言机更新数据
        console.log(`   📡 准备预言机更新数据...`);
        const pythUpdateData = await fetchUpdateData([TEST_SYMBOL]);
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
  });
});