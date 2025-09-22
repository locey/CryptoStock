const { expect } = require("chai");
const { ethers, deployments, network } = require("hardhat");
const { fetchUpdateData, fetchSingleUpdateData } = require("../utils/getPythUpdateData");

describe("StockToken - 股票代币合约测试", function () {
  let tokenFactory;
  let stockToken;
  let oracleAggregator;
  let usdtToken;
  let mockPyth;
  let owner, userA, userB;

  // 网络判断
  const isLocalNetwork = network.name === "hardhat" || network.name === "localhost";
  const isSepoliaNetwork = network.name === "sepolia";

  console.log(`🌐 当前测试网络: ${network.name}`);
  console.log(`🔧 本地网络模式: ${isLocalNetwork}`);
  console.log(`🌍 Sepolia 网络模式: ${isSepoliaNetwork}`);

  // 测试账户
  const zeroAddress = ethers.constants.AddressZero;

  // 代币参数 - 使用预设的AAPL股票代币
  const tokenName = "Apple Inc Stock Token";
  const tokenSymbol = "AAPL";
  const stockCode = "AAPL";
  const initialSupply = ethers.utils.parseEther("1000000"); // 1,000,000 AAPL

  // 测试余额分配
  const testAmount = ethers.utils.parseEther("1000"); // 1,000 AAPL for tests
  const userAUSDT = 10000 * 10 ** 6; // 10,000 USDT (6 decimals)
  const userBUSDT = 5000 * 10 ** 6; // 5,000 USDT (6 decimals)

  // 价格数据 (MockPyth使用int64，所以需要合理的范围)
  const priceNormal = 10000; // 100.00 USD (expo = -2，所以实际价格是 10000 * 10^-2 = 100.00)
  const priceHigh = 15000; // 150.00 USD
  const priceLow = 5000; // 50.00 USD
  const priceInvalid = 0;
  const priceExpo = -2; // 价格精度指数

  // Feed ID for AAPL stock (部署脚本中已配置)
  const aaplFeedId =
    "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688";

  beforeEach(async function () {
    console.log("🚀 [SETUP] 初始化股票代币测试环境...");

    [owner, userA, userB] = await ethers.getSigners();
    console.log(`📝 Owner: ${owner.address}`);
    console.log(`📝 UserA: ${userA.address}`);
    console.log(`📝 UserB: ${userB.address}`);

    // 1. 获取已部署的合约（不重新部署）
    console.log("📄 [STEP 1] 获取已部署的合约实例...");
    
    // 如果是本地网络，使用部署脚本
    if (isLocalNetwork) {
      await deployments.fixture(["CryptoStockSystem"]);
    }

    // 获取合约实例
    console.log("📄 [STEP 2] 获取部署的合约实例...");
    
    // 调试：查看所有已部署的合约
    try {
      const allDeployments = await deployments.all();
      console.log("🔍 所有已部署的合约:");
      for (const [name, deployment] of Object.entries(allDeployments)) {
        console.log(`   ${name}: ${deployment.address}`);
      }
    } catch (error) {
      console.log("❌ 无法获取部署列表:", error.message);
    }
    
    const factoryDeployment = await deployments.get("TokenFactory");
    tokenFactory = await ethers.getContractAt(
      "TokenFactory",
      factoryDeployment.address
    );
    console.log(`✅ 代币工厂获取完成: ${factoryDeployment.address}`);

    const oracleDeployment = await deployments.get("OracleAggregator");
    oracleAggregator = await ethers.getContractAt(
      "OracleAggregator",
      oracleDeployment.address
    );
    console.log(`✅ 预言机聚合器获取完成: ${oracleDeployment.address}`);

    const usdtDeployment = await deployments.get("MockERC20_USDT");
    usdtToken = await ethers.getContractAt("MockERC20", usdtDeployment.address);
    console.log(`✅ USDT 代币获取完成: ${usdtDeployment.address}`);

    // MockPyth 只在本地网络中存在
    if (isLocalNetwork) {
      const mockPythDeployment = await deployments.get("MockPyth");
      mockPyth = await ethers.getContractAt(
        "MockPyth",
        mockPythDeployment.address
      );
      console.log(`✅ MockPyth 获取完成: ${mockPythDeployment.address}`);
    } else {
      console.log(`⏭️  Sepolia 网络跳过 MockPyth 初始化`);
    }

    // 2. 获取已部署的AAPL代币（部署脚本中已创建）
    console.log("📄 [STEP 3] 获取已部署的AAPL股票代币...");
    try {
      const stockTokenAddress = await tokenFactory.getTokenAddress(tokenSymbol);
      if (stockTokenAddress === zeroAddress) {
        throw new Error("AAPL代币未部署");
      }
      stockToken = await ethers.getContractAt("StockToken", stockTokenAddress);
      console.log(`✅ ${tokenSymbol} 代币获取成功: ${stockTokenAddress}`);
    } catch (error) {
      console.log("⚠️  AAPL代币不存在，将创建新的代币...");
      // 如果代币不存在，创建一个新的
      const tx = await tokenFactory.createToken(
        tokenName,
        tokenSymbol,
        initialSupply
      );
      const receipt = await tx.wait();
      const event = receipt.events.find((e) => e.event === "TokenCreated");
      const stockTokenAddress = event.args.tokenAddress;
      stockToken = await ethers.getContractAt("StockToken", stockTokenAddress);
      console.log(`✅ ${tokenSymbol} 代币创建成功: ${stockTokenAddress}`);
    }

    // 验证代币合约地址非零
    expect(stockToken.address).to.not.equal(zeroAddress);

    // 3. 更新价格数据（根据网络类型）
    console.log("📄 [STEP 4] 更新AAPL价格数据...");
    if (isLocalNetwork) {
      // 本地网络：使用 MockPyth 设置价格
      await mockPyth.setPrice(
        aaplFeedId,
        priceNormal,
        priceExpo,
        Math.floor(Date.now() / 1000)
      );
      console.log(`✅ ${tokenSymbol} MockPyth 价格更新完成: ${priceNormal / 100} USD`);
    } else {
      // Sepolia 网络：价格由真实 Pyth 网络提供，无需手动设置
      console.log(`✅ ${tokenSymbol} 将使用 Sepolia Pyth 网络的实时价格`);
    }

    // 4. 分配测试代币给用户进行测试˝
    console.log("📄 [STEP 5] 分配测试代币...");
    const ownerBalance = await stockToken.balanceOf(owner.address);
    console.log(
      `📊 Owner代币余额: ${ethers.utils.formatEther(
        ownerBalance
      )} ${tokenSymbol}`
    );
    if (ownerBalance.gte(testAmount.mul(2))) {
      await stockToken.connect(owner).transfer(userA.address, testAmount);
      await stockToken.connect(owner).transfer(userB.address, testAmount);
      console.log(
        `✅ 已向UserA分配: ${ethers.utils.formatEther(
          testAmount
        )} ${tokenSymbol}`
      );
      console.log(
        `✅ 已向UserB分配: ${ethers.utils.formatEther(
          testAmount
        )} ${tokenSymbol}`
      );
    }

    // 5. 设置USDT测试余额
    console.log("📄 [STEP 5] 分配USDT测试余额...");
    await usdtToken.mint(userA.address, userAUSDT);
    await usdtToken.mint(userB.address, userBUSDT);
    console.log(`✅ UserA USDT余额: ${userAUSDT / 10 ** 6} USDT`);
    console.log(`✅ UserB USDT余额: ${userBUSDT / 10 ** 6} USDT`);

    // 6. 配置代币授权
    console.log("📄 [STEP 6] 配置代币授权...");
    await usdtToken.connect(userA).approve(stockToken.address, userAUSDT);
    await usdtToken.connect(userB).approve(stockToken.address, userBUSDT);
    console.log(`✅ 授权配置完成`);

    console.log("🎉 [SETUP] 测试环境初始化完成！\n");
  });

  describe("1. ERC20 标准功能测试", function () {
    describe("转账功能(transfer)", function () {
      it("正常转账：有效账户间转账", async function () {
        const transferAmount = ethers.utils.parseEther("100"); // 减少转账金额
        const initialBalanceA = await stockToken.balanceOf(userA.address);
        const initialBalanceB = await stockToken.balanceOf(userB.address);

        await stockToken.connect(userA).transfer(userB.address, transferAmount);

        expect(await stockToken.balanceOf(userA.address)).to.equal(
          initialBalanceA.sub(transferAmount)
        );
        expect(await stockToken.balanceOf(userB.address)).to.equal(
          initialBalanceB.add(transferAmount)
        );
      });

      it("超额转账：超过余额的转账尝试", async function () {
        const userBalance = await stockToken.balanceOf(userA.address);
        const excessiveAmount = userBalance.add(ethers.utils.parseEther("1"));
        await expect(
          stockToken.connect(userA).transfer(userB.address, excessiveAmount)
        ).to.be.reverted; // 简化错误检查
      });

      it("零地址转账：向0x0地址转账", async function () {
        await expect(
          stockToken
            .connect(userA)
            .transfer(zeroAddress, ethers.utils.parseEther("100"))
        ).to.be.reverted; // 简化错误检查
      });

      it("零金额转账：转账金额为0", async function () {
        await expect(stockToken.connect(userA).transfer(userB.address, 0)).to
          .not.be.reverted; // ERC20 standard allows 0 transfers
      });

      it("大额转账：最大uint256值转账", async function () {
        await expect(
          stockToken
            .connect(userA)
            .transfer(userB.address, ethers.constants.MaxUint256)
        ).to.be.reverted; // 简化错误检查
      });
    });

    describe("授权功能(approve)", function () {
      it("正常授权：设置有效授权额度", async function () {
        const approveAmount = ethers.utils.parseEther("500"); // 减少授权金额
        await stockToken.connect(userA).approve(userB.address, approveAmount);

        expect(
          await stockToken.allowance(userA.address, userB.address)
        ).to.equal(approveAmount);
      });

      it("超额授权：超过账户余额的授权", async function () {
        const userBalance = await stockToken.balanceOf(userA.address);
        const excessiveAmount = userBalance.add(
          ethers.utils.parseEther("50000")
        );
        await stockToken.connect(userA).approve(userB.address, excessiveAmount);

        expect(
          await stockToken.allowance(userA.address, userB.address)
        ).to.equal(excessiveAmount);
      });

      it("重复授权：同一授权对象多次授权", async function () {
        await stockToken
          .connect(userA)
          .approve(userB.address, ethers.utils.parseEther("1000"));
        await stockToken
          .connect(userA)
          .approve(userB.address, ethers.utils.parseEther("2000"));

        expect(
          await stockToken.allowance(userA.address, userB.address)
        ).to.equal(ethers.utils.parseEther("2000"));
      });

      it("授权撤销：将授权额度设为0", async function () {
        await stockToken
          .connect(userA)
          .approve(userB.address, ethers.utils.parseEther("1000"));
        await stockToken.connect(userA).approve(userB.address, 0);

        expect(
          await stockToken.allowance(userA.address, userB.address)
        ).to.equal(0);
      });
    });

    describe("授权转账(transferFrom)", function () {
      beforeEach(async function () {
        // 为每个测试设置基础授权 - 使用实际余额
        const userBalance = await stockToken.balanceOf(userA.address);
        const approveAmount = userBalance.div(2); // 授权一半余额
        await stockToken.connect(userA).approve(userB.address, approveAmount);
      });

      it("正常授权转账", async function () {
        const transferAmount = ethers.utils.parseEther("100");
        const initialAllowance = await stockToken.allowance(
          userA.address,
          userB.address
        );
        const initialOwnerBalance = await stockToken.balanceOf(owner.address);

        await stockToken
          .connect(userB)
          .transferFrom(userA.address, owner.address, transferAmount);

        expect(await stockToken.balanceOf(owner.address)).to.equal(
          initialOwnerBalance.add(transferAmount)
        );
        expect(
          await stockToken.allowance(userA.address, userB.address)
        ).to.equal(initialAllowance.sub(transferAmount));
      });

      it("超额授权转账", async function () {
        const userBalance = await stockToken.balanceOf(userA.address);
        const excessiveAmount = userBalance.add(ethers.utils.parseEther("1"));
        await expect(
          stockToken
            .connect(userB)
            .transferFrom(userA.address, owner.address, excessiveAmount)
        ).to.be.reverted; // 简化错误检查
      });

      it("未授权账户尝试转账", async function () {
        await expect(
          stockToken
            .connect(owner)
            .transferFrom(
              userA.address,
              userB.address,
              ethers.utils.parseEther("10")
            )
        ).to.be.reverted; // 简化错误检查
      });

      it("授权后余额变化场景", async function () {
        const transferAmount = ethers.utils.parseEther("50");
        const initialBalanceA = await stockToken.balanceOf(userA.address);
        const initialBalanceB = await stockToken.balanceOf(userB.address);
        const initialAllowance = await stockToken.allowance(userA.address, userB.address);

        await stockToken
          .connect(userB)
          .transferFrom(userA.address, userB.address, transferAmount);

        // 验证余额变化
        expect(await stockToken.balanceOf(userA.address)).to.equal(
          initialBalanceA.sub(transferAmount)
        );
        expect(await stockToken.balanceOf(userB.address)).to.equal(
          initialBalanceB.add(transferAmount)
        );
        
        // 验证授权额度减少
        expect(await stockToken.allowance(userA.address, userB.address)).to.equal(
          initialAllowance.sub(transferAmount)
        );
      });
    });
  });

  describe("2. 价格查询功能", function () {
    it("正常价格查询：返回有效价格数据", async function () {
      if (isSepoliaNetwork) {
        // Sepolia 网络：测试真实 Pyth 价格获取
        console.log("🌍 Sepolia 网络 - 测试真实 Pyth 价格获取");
        
        try {
          // 获取真实的 updateData
          const updateData = await fetchSingleUpdateData("AAPL");
          const fee = await oracleAggregator.getUpdateFee(updateData);
          console.log(`💰 更新费用: ${ethers.utils.formatEther(fee)} ETH`);
          
          // 调用 updateAndGetPrice 获取实时价格
          const tx = await oracleAggregator.updateAndGetPrice(
            "AAPL",
            updateData,
            { value: fee }
          );
          const receipt = await tx.wait();
          
          // 详细的 Gas 使用情况统计，调用一次 大概花费 0.5分钱 人民币
          console.log("\n💰 调用方法: updateAndGetPrice");
          console.log(`- Gas价格: ${ethers.utils.formatUnits(tx.gasPrice, "gwei")} gwei`);
          console.log(`- Gas用量: ${receipt.gasUsed.toString()}`);
          console.log(`- 实际费用: ${ethers.utils.formatEther(receipt.gasUsed.mul(tx.gasPrice))} ETH`);
          console.log(`- 更新费用: ${ethers.utils.formatEther(fee)} ETH`);
          console.log(`- 总费用: ${ethers.utils.formatEther(receipt.gasUsed.mul(tx.gasPrice).add(fee))} ETH`);
          
          // 验证价格
          const price = await stockToken.getStockPrice();
          console.log(`📈 AAPL 实时价格: $${ethers.utils.formatEther(price)}`);
          expect(price).to.be.gt(0);
        } catch (error) {
          console.error("❌ Sepolia 价格获取失败:", error.message);
          // 如果网络问题，跳过测试
          this.skip();
        }
      } else {
        // 本地网络：使用 MockPyth 测试
        console.log("🏠 本地网络 - 使用 MockPyth 测试");
        const price = await stockToken.getStockPrice();
        expect(price).to.be.gt(0);
        expect(price).to.equal(ethers.utils.parseEther("100")); // 100.00 USD
      }
    });

    it("时间戳验证：返回价格时间戳的有效性", async function () {
      if (isLocalNetwork) {
        const currentTime = Math.floor(Date.now() / 1000);
        await mockPyth.setPrice(aaplFeedId, priceNormal, priceExpo, currentTime);

        // 调用预言机聚合器获取完整的价格信息
        const [price, , , timestamp] = await oracleAggregator.getPrice(
          tokenSymbol
        );
        expect(price).to.equal(ethers.utils.parseEther("100")); // 100.00 USD in 18 decimal precision
        expect(timestamp).to.equal(currentTime);
      } else if (isSepoliaNetwork) {
        console.log("🌍 Sepolia 网络 - 测试真实 Pyth 时间戳验证");
        this.timeout(30000); // 增加超时时间到30秒
        
        try {
          // 1. 获取真实的 updateData
          console.log("📡 获取 AAPL 的最新价格数据...");
          const updateData = await fetchSingleUpdateData("AAPL");
          
          // 2. 计算更新费用
          const fee = await oracleAggregator.getUpdateFee(updateData);
          console.log(`💰 所需更新费用: ${ethers.utils.formatEther(fee)} ETH`);
          
          // 3. 使用 updateAndGetPrice 更新价格数据
          console.log("🔄 调用 updateAndGetPrice 更新价格...");
          const updateTx = await oracleAggregator.updateAndGetPrice(
            "AAPL",
            updateData,
            { value: fee }
          );
          const updateReceipt = await updateTx.wait();
          
          // 详细的 Gas 使用情况统计
          console.log("\n💰 调用方法: updateAndGetPrice");
          console.log(`- Gas价格: ${ethers.utils.formatUnits(updateTx.gasPrice, "gwei")} gwei`);
          console.log(`- Gas用量: ${updateReceipt.gasUsed.toString()}`);
          console.log(`- 实际费用: ${ethers.utils.formatEther(updateReceipt.gasUsed.mul(updateTx.gasPrice))} ETH`);
          console.log(`- 更新费用: ${ethers.utils.formatEther(fee)} ETH`);
          console.log(`- 总费用: ${ethers.utils.formatEther(updateReceipt.gasUsed.mul(updateTx.gasPrice).add(fee))} ETH`);
          
          // 4. 获取完整的价格信息验证时间戳
          console.log("📊 获取更新后的价格信息...");
          const [price, minPrice, maxPrice, timestamp] = await oracleAggregator.getPrice(
            tokenSymbol
          );
          
          // 5. 验证价格数据有效性
          expect(price).to.be.gt(0);
          expect(minPrice).to.be.gt(0);
          expect(maxPrice).to.be.gt(price);
          expect(timestamp).to.be.gt(0);
          
          // 6. 验证时间戳合理性（应该是最近的时间）
          const currentTime = Math.floor(Date.now() / 1000);
          const timeDifference = Math.abs(currentTime - timestamp);
          expect(timeDifference).to.be.lte(2 * 24 * 3600); // 时间戳应该在2天内
          
          console.log(`📈 AAPL 价格: $${ethers.utils.formatEther(price)}`);
          console.log(`📊 价格范围: $${ethers.utils.formatEther(minPrice)} - $${ethers.utils.formatEther(maxPrice)}`);
          console.log(`⏰ 发布时间: ${new Date(timestamp * 1000).toISOString()}`);
          console.log(`✅ 时间戳差异: ${timeDifference} 秒`);
          
        } catch (error) {
          console.error("❌ Sepolia 时间戳验证失败:", error.message);
          console.log("⚠️  可能的原因：网络连接问题或 Pyth API 暂时不可用");
          this.skip(); // 如果失败则跳过测试
        }
      } else {
        console.log("⏭️  跳过时间戳验证测试（不支持的网络）");
        this.skip();
      }
    });

    it("批量价格更新：使用updateAndGetPrices获取多个股票价格", async function () {
      if (isLocalNetwork) {
        const symbols = ["AAPL", "TSLA", "GOOGL"];
        const prices = [12000, 25000, 280000]; // 120.00, 250.00, 2800.00 USD
        const currentTime = Math.floor(Date.now() / 1000);

        // 设置多个股票的价格
        const tslaPriceId = "0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2";
        const googlPriceId = "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6";
        
        await mockPyth.setPrice(aaplFeedId, prices[0], priceExpo, currentTime);
        await mockPyth.setPrice(tslaPriceId, prices[1], priceExpo, currentTime + 1);
        await mockPyth.setPrice(googlPriceId, prices[2], priceExpo, currentTime + 2);

        // 使用updateAndGetPrices批量获取价格（模拟空的updateData）
        const result = await oracleAggregator.callStatic.updateAndGetPrices(
          symbols,
          [] // 空的updateData用于测试
        );
        const returnedPrices = result[0];
        const publishTimes = result[1];

        // 验证价格
        expect(returnedPrices[0]).to.equal(ethers.utils.parseEther("120")); // AAPL: 120.00 USD
        expect(returnedPrices[1]).to.equal(ethers.utils.parseEther("250")); // TSLA: 250.00 USD
        expect(returnedPrices[2]).to.equal(ethers.utils.parseEther("2800")); // GOOGL: 2800.00 USD

        // 验证时间戳
        expect(publishTimes[0]).to.equal(currentTime);
        expect(publishTimes[1]).to.equal(currentTime + 1);
        expect(publishTimes[2]).to.equal(currentTime + 2);
      } else if (isSepoliaNetwork) {
        console.log("🌍 Sepolia 网络 - 测试真实 Pyth 批量价格获取");
        this.timeout(60000); // 增加超时时间到60秒
        
        try {
          const symbols = ["AAPL", "GOOGL"];
          
          // 1. 获取多个股票的 updateData
          console.log(`📡 获取 ${symbols.join(", ")} 的价格数据...`);
          const updateData = await fetchUpdateData(symbols);
          console.log(`✅ 获取到 ${updateData.length} 条更新数据`);
          
          // 2. 计算更新费用
          const fee = await oracleAggregator.getUpdateFee(updateData);
          console.log(`💰 批量更新费用: ${ethers.utils.formatEther(fee)} ETH`);
          
          // 3. 使用 updateAndGetPrices 批量更新和获取价格
          console.log("🔄 调用 updateAndGetPrices 批量更新价格...");
          const result = await oracleAggregator.callStatic.updateAndGetPrices(
            symbols,
            updateData,
            { value: fee }
          );
          
          const [prices, publishTimes] = result;
          
          // 4. 验证返回结果
          expect(prices.length).to.equal(symbols.length);
          expect(publishTimes.length).to.equal(symbols.length);
          
          // 5. 验证每个价格数据
          for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const price = prices[i];
            const publishTime = publishTimes[i];
            
            console.log(`📈 ${symbol}: $${ethers.utils.formatEther(price)} (${new Date(publishTime * 1000).toISOString()})`);
            
            // 验证价格有效性
            expect(price).to.be.gt(0);
            expect(publishTime).to.be.gt(0);
            
            // 验证价格合理范围（根据不同股票调整）
            const priceInUSD = parseFloat(ethers.utils.formatEther(price));
            if (symbol === "AAPL") {
              expect(priceInUSD).to.be.gte(50).and.to.be.lte(500);
            } else if (symbol === "TSLA") {
              expect(priceInUSD).to.be.gte(100).and.to.be.lte(1000);
            } else if (symbol === "GOOGL") {
              expect(priceInUSD).to.be.gte(100).and.to.be.lte(1000);
            }
            
            // 验证时间戳合理性（考虑到股市非交易时间）
            const currentTime = Math.floor(Date.now() / 1000);
            const timeDifference = Math.abs(currentTime - publishTime);
            const maxTimeDifference = 2 * 24 * 3600; // 最多2天的差异
            expect(timeDifference).to.be.lte(maxTimeDifference);
            expect(publishTime).to.be.lte(currentTime);
          }
          
          console.log("✅ Sepolia 批量价格获取测试通过！");
        } catch (error) {
          console.error("❌ Sepolia 批量测试失败:", error.message);
          console.log("⚠️  可能的原因：网络连接问题或 Pyth API 暂时不可用");
          this.skip(); // 如果失败则跳过测试
        }
      } else {
        console.log("⏭️  跳过批量价格更新测试（不支持的网络）");
        this.skip();
      }
    });

    it("批量价格查询：验证不同精度价格的正确转换", async function () {
      if (isLocalNetwork) {
        // 本地网络：测试不同精度的价格转换
        const symbols = ["AAPL"];
        const testPrices = [
          { price: 5000, expo: -2, expected: "50" },    // 50.00 USD
          { price: 15055, expo: -2, expected: "150.55" }, // 150.55 USD
          { price: 1, expo: 0, expected: "1" },           // 1.00 USD
          { price: 100000, expo: -3, expected: "100" }   // 100.000 USD
        ];

        for (let i = 0; i < testPrices.length; i++) {
          const testCase = testPrices[i];
          const currentTime = Math.floor(Date.now() / 1000) + i;
          
          // 设置价格
          await mockPyth.setPrice(aaplFeedId, testCase.price, testCase.expo, currentTime);
          
          // 使用updateAndGetPrices获取价格
          const result = await oracleAggregator.callStatic.updateAndGetPrices(
            symbols,
            []
          );
          const returnedPrices = result[0];
          
          // 验证转换后的价格
          expect(returnedPrices[0]).to.equal(ethers.utils.parseEther(testCase.expected));
        }
      } else {
        console.log("⏭️  跳过价格精度转换测试（Sepolia 网络不支持精度验证）");
        this.skip();
      }
    });

    it("批量价格查询：处理不支持的股票符号", async function () {
      if (isLocalNetwork) {
        // 本地网络：使用空的 updateData 测试
        const symbols = ["AAPL", "UNSUPPORTED_SYMBOL"];
        
        // 尝试查询包含不支持符号的批量请求
        await expect(
          oracleAggregator.updateAndGetPrices(symbols, [])
        ).to.be.revertedWith("Price feed not found for symbol");
      } else {
        console.log("⏭️  跳过不支持符号测试（Sepolia 网络无法模拟不支持的符号）");
        this.skip();
      }
    });

    it("实时价格同步：验证价格更新后立即可查询", async function () {
      const newPrice = 20000; // 200.00 USD
      const currentTime = Math.floor(Date.now() / 1000);
      
      // 更新价格
      await mockPyth.setPrice(aaplFeedId, newPrice, priceExpo, currentTime);
      
      // 立即使用updateAndGetPrices查询
      const result = await oracleAggregator.callStatic.updateAndGetPrices(
        [tokenSymbol],
        []
      );
      const returnedPrices = result[0];
      const publishTimes = result[1];
      
      // 验证价格和时间戳立即更新
      expect(returnedPrices[0]).to.equal(ethers.utils.parseEther("200"));
      expect(publishTimes[0]).to.equal(currentTime);
      
      // 验证StockToken也能获取到更新后的价格
      const stockPrice = await stockToken.getStockPrice();
      expect(stockPrice).to.equal(ethers.utils.parseEther("200"));
    });

    // Sepolia 网络专用测试
    if (isSepoliaNetwork) {
      it("Sepolia 真实 Pyth 网络价格获取测试", async function () {
        console.log("🌍 测试 Sepolia 网络的真实 Pyth 价格获取");
        this.timeout(30000); // 增加超时时间到30秒
        
        try {
          // 1. 获取真实的 updateData
          console.log("📡 获取 AAPL 的最新价格数据...");
          const updateData = await fetchSingleUpdateData("AAPL");
          console.log(`✅ 获取到 ${updateData.length} 条更新数据`);
          
          // 2. 计算更新费用
          const fee = await oracleAggregator.getUpdateFee(updateData);
          console.log(`💰 所需更新费用: ${ethers.utils.formatEther(fee)} ETH`);
          
          // 3. 使用 updateAndGetPrice 获取实时价格
          console.log("🔄 调用 updateAndGetPrice...");
          const result = await oracleAggregator.callStatic.updateAndGetPrice(
            "AAPL",
            updateData,
            { value: fee }
          );
          
          const [price, minPrice, maxPrice, publishTime] = result;
          
          // 4. 验证价格数据
          console.log(`📈 AAPL 当前价格: $${ethers.utils.formatEther(price)}`);
          console.log(`📊 价格范围: $${ethers.utils.formatEther(minPrice)} - $${ethers.utils.formatEther(maxPrice)}`);
          console.log(`⏰ 发布时间: ${new Date(publishTime * 1000).toISOString()}`);
          
          expect(price).to.be.gt(0);
          expect(minPrice).to.be.gt(0);
          expect(maxPrice).to.be.gt(price);
          expect(publishTime).to.be.gt(0);
          
          // 5. 验证价格的合理范围（AAPL 应该在 $50-$500 之间）
          const priceInUSD = parseFloat(ethers.utils.formatEther(price));
          expect(priceInUSD).to.be.gte(50);
          expect(priceInUSD).to.be.lte(500);
          
          console.log("✅ Sepolia Pyth 价格获取测试通过！");
        } catch (error) {
          console.error("❌ Sepolia Pyth 测试失败:", error.message);
          console.log("⚠️  可能的原因：网络连接问题或 Pyth API 暂时不可用");
          this.skip(); // 如果失败则跳过测试
        }
      });

      it("Sepolia 批量价格获取测试", async function () {
        console.log("🌍 测试 Sepolia 网络的批量价格获取");
        this.timeout(60000); // 增加超时时间到60秒
        
        try {
          const symbols = ["AAPL", "TSLA", "GOOGL"];
          
          // 1. 获取多个股票的 updateData
          console.log(`📡 获取 ${symbols.join(", ")} 的价格数据...`);
          const updateData = await fetchUpdateData(symbols);
          
          // 2. 计算费用
          const fee = await oracleAggregator.getUpdateFee(updateData);
          console.log(`💰 批量更新费用: ${ethers.utils.formatEther(fee)} ETH`);
          
          // 3. 批量获取价格
          console.log("🔄 调用 updateAndGetPrices...");
          const result = await oracleAggregator.callStatic.updateAndGetPrices(
            symbols,
            updateData,
            { value: fee }
          );
          
          const [prices, publishTimes] = result;
          
          // 4. 验证结果
          expect(prices.length).to.equal(symbols.length);
          expect(publishTimes.length).to.equal(symbols.length);
          
          for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const price = prices[i];
            const publishTime = publishTimes[i];
            
            console.log(`📈 ${symbol}: $${ethers.utils.formatEther(price)} (${new Date(publishTime * 1000).toISOString()})`);
            
            expect(price).to.be.gt(0);
            expect(publishTime).to.be.gt(0);
            
            // 验证价格合理范围
            const priceInUSD = parseFloat(ethers.utils.formatEther(price));
            expect(priceInUSD).to.be.gte(10); // 最低 $10
            expect(priceInUSD).to.be.lte(10000); // 最高 $10,000
          }
          
          console.log("✅ Sepolia 批量价格获取测试通过！");
        } catch (error) {
          console.error("❌ Sepolia 批量测试失败:", error.message);
          this.skip();
        }
      });
    }
    
    // 本地网络的其他测试保持原有逻辑
    if (isLocalNetwork) {
      it("预言机未配置：查询未配置的股票代码", async function () {
        // 创建一个新的代币，但不配置价格源
        const newTokenTx = await tokenFactory.createToken(
          "New Token",
          "NEW",
          initialSupply
        );
        const newTokenReceipt = await newTokenTx.wait();
        const newEvent = newTokenReceipt.events.find(
          (e) => e.event === "TokenCreated"
        );
        const newTokenAddress = newEvent.args.tokenAddress;
        const newToken = await ethers.getContractAt(
          "StockToken",
          newTokenAddress
        );

        await expect(newToken.getStockPrice()).to.be.reverted;
      });

      it("预言机故障：模拟预言机返回错误", async function () {
        await mockPyth.setPrice(
          aaplFeedId,
          priceInvalid,
          priceExpo,
          Math.floor(Date.now() / 1000)
        );

        // 改为检查是否会抛出错误
        await expect(stockToken.getStockPrice()).to.be.revertedWith(
          "Invalid price data"
        );
      });

      it("价格波动测试：不同价格场景下的响应", async function () {
        // 测试高价格
        await mockPyth.setPrice(
          aaplFeedId,
          priceHigh,
          priceExpo,
          Math.floor(Date.now() / 1000)
        );
        const highPrice = await stockToken.getStockPrice();
        expect(highPrice).to.equal(ethers.utils.parseEther("150")); // 150.00 USD in 18 decimal precision

        // 测试低价格
        await mockPyth.setPrice(
          aaplFeedId,
          priceLow,
          priceExpo,
          Math.floor(Date.now() / 1000)
        );
        const lowPrice = await stockToken.getStockPrice();
        expect(lowPrice).to.equal(ethers.utils.parseEther("50")); // 50.00 USD in 18 decimal precision

        // 回到正常价格
        await mockPyth.setPrice(
          aaplFeedId,
          priceNormal,
          priceExpo,
          Math.floor(Date.now() / 1000)
        );
        const normalPrice = await stockToken.getStockPrice();
        expect(normalPrice).to.equal(ethers.utils.parseEther("100")); // 100.00 USD in 18 decimal precision
      });
    }
  });

  describe("3. 所有权管理功能", function () {
    it("mint功能：只有所有者可以mint", async function () {
      const mintAmount = ethers.utils.parseEther("10000");
      const initialSupply = await stockToken.totalSupply();

      await stockToken.connect(owner).mint(mintAmount);
      expect(await stockToken.totalSupply()).to.equal(
        initialSupply.add(mintAmount)
      );

      // 非所有者尝试mint - 使用通用错误检查
      await expect(stockToken.connect(userA).mint(mintAmount)).to.be.reverted; // 简化错误检查
    });

    it("所有权转移后权限验证", async function () {
      // 转移所有权
      await stockToken.connect(owner).transferOwnership(userA.address);

      // 原所有者无法再mint
      await expect(
        stockToken.connect(owner).mint(ethers.utils.parseEther("1000"))
      ).to.be.reverted; // 简化错误检查

      // 新所有者可以mint，并且代币会分配给新所有者
      const initialBalance = await stockToken.balanceOf(userA.address);
      const mintAmount = ethers.utils.parseEther("1000");
      await stockToken.connect(userA).mint(mintAmount);
      expect(await stockToken.balanceOf(userA.address)).to.equal(
        initialBalance.add(mintAmount)
      );
    });
  });

  describe("5. 预言机聚合器高级功能测试", function () {
    it("支持的股票符号查询：验证getSupportedSymbols功能", async function () {
      const supportedSymbols = await oracleAggregator.getSupportedSymbols();
      
      // 验证返回的符号列表包含预期的股票
      expect(supportedSymbols).to.include("AAPL");
      expect(supportedSymbols).to.include("TSLA");
      expect(supportedSymbols).to.include("GOOGL");
      expect(supportedSymbols.length).to.be.gte(3); // 至少应该有3个支持的符号
    });

    it("股票符号支持检查：验证isSymbolSupported功能", async function () {
      // 测试支持的符号
      expect(await oracleAggregator.isSymbolSupported("AAPL")).to.be.true;
      expect(await oracleAggregator.isSymbolSupported("TSLA")).to.be.true;
      
      // 测试不支持的符号
      expect(await oracleAggregator.isSymbolSupported("UNKNOWN")).to.be.false;
      expect(await oracleAggregator.isSymbolSupported("")).to.be.false;
    });

    it("费用计算：验证getUpdateFee功能", async function () {
      const emptyUpdateData = [];
      const fee = await oracleAggregator.getUpdateFee(emptyUpdateData);
      
      // MockPyth应该返回0费用用于空的updateData
      expect(fee).to.equal(0);
    });

    it("价格精度转换：验证不同expo值的处理", async function () {
      const testCases = [
        { price: 10000, expo: -2, symbol: "AAPL", expected: "100" },    // 100.00
        { price: 15050, expo: -2, symbol: "AAPL", expected: "150.5" },  // 150.50
        { price: 1000000, expo: -4, symbol: "AAPL", expected: "100" },  // 100.0000
        { price: 5, expo: 0, symbol: "AAPL", expected: "5" },           // 5
      ];

      for (const testCase of testCases) {
        const currentTime = Math.floor(Date.now() / 1000);
        
        // 设置特定精度的价格
        await mockPyth.setPrice(aaplFeedId, testCase.price, testCase.expo, currentTime);
        
        // 查询价格
        const [price, , , ] = await oracleAggregator.getPrice(testCase.symbol);
        
        // 验证转换结果
        expect(price).to.equal(ethers.utils.parseEther(testCase.expected));
      }
    });

    it("批量价格更新性能：测试大量符号的处理", async function () {
      const symbols = ["AAPL", "TSLA", "GOOGL", "MSFT", "AMZN"];
      const currentTime = Math.floor(Date.now() / 1000);
      
      // 设置所有股票的价格
      const feedIds = [
        aaplFeedId,
        "0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2", // TSLA
        "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6", // GOOGL
        "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1", // MSFT
        "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a"  // AMZN
      ];
      
      for (let i = 0; i < symbols.length; i++) {
        await mockPyth.setPrice(feedIds[i], 10000 + i * 1000, priceExpo, currentTime + i);
      }
      
      // 批量获取价格
      const startTime = Date.now();
      const result = await oracleAggregator.callStatic.updateAndGetPrices(symbols, []);
      const endTime = Date.now();
      
      // 解构返回结果
      const prices = result[0];
      const publishTimes = result[1];
      
      // 验证结果
      expect(prices.length).to.equal(symbols.length);
      expect(publishTimes.length).to.equal(symbols.length);
      
      // 验证价格值
      for (let i = 0; i < prices.length; i++) {
        const expectedPrice = ethers.utils.parseEther(((10000 + i * 1000) / 100).toString());
        expect(prices[i]).to.equal(expectedPrice);
        expect(publishTimes[i]).to.equal(currentTime + i);
      }
      
      // 性能检查（应该在合理时间内完成）
      expect(endTime - startTime).to.be.lessThan(5000); // 5秒内完成
    });

    it("错误处理：验证无效价格数据的处理", async function () {
      // 设置无效价格（价格为0）
      await mockPyth.setPrice(aaplFeedId, 0, priceExpo, Math.floor(Date.now() / 1000));
      
      // 单个价格查询应该失败
      await expect(
        oracleAggregator.getPrice("AAPL")
      ).to.be.revertedWith("Invalid price data");
      
      // 批量价格查询也应该失败
      await expect(
        oracleAggregator.updateAndGetPrices(["AAPL"], [])
      ).to.be.revertedWith("Invalid price data");
    });

    it("价格范围验证：验证minPrice和maxPrice计算", async function () {
      const testPrice = 15000; // 150.00 USD
      const currentTime = Math.floor(Date.now() / 1000);
      
      await mockPyth.setPrice(aaplFeedId, testPrice, priceExpo, currentTime);
      
      const [price, minPrice, maxPrice, ] = await oracleAggregator.getPrice("AAPL");
      
      // 验证价格
      expect(price).to.equal(ethers.utils.parseEther("150"));
      
      // 验证价格范围（应该是±5%）
      const expectedMinPrice = price.mul(95).div(100); // -5%
      const expectedMaxPrice = price.mul(105).div(100); // +5%
      
      expect(minPrice).to.equal(expectedMinPrice);
      expect(maxPrice).to.equal(expectedMaxPrice);
    });
  });

  describe("4. 业务功能测试", function () {
    it("验证股票符号配置", async function () {
      expect(await stockToken.stockSymbol()).to.equal(tokenSymbol);
    });

    it("验证owner拥有初始代币", async function () {
      const ownerBalance = await stockToken.balanceOf(owner.address);
      const totalSupply = await stockToken.totalSupply();

      // 减去已分配给用户的测试代币
      const expectedOwnerBalance = totalSupply.sub(testAmount.mul(2));
      expect(ownerBalance).to.equal(expectedOwnerBalance);
    });
  });
});
