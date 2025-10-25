const { ethers, upgrades } = require("hardhat")
const { fetchUpdateData } = require("../utils/getPythUpdateData")
const { expect } = require("chai")
const { getRedStoneUpdateData } = require("../utils/getRedStoneUpdateData-v061")
const fs = require("fs")

// 预言机权重配置
const ORACLE_WEIGHTS = {
    PYTH: 60,      // Pyth 占 60%
    REDSTONE: 40   // RedStone 占 40%
};

// OracleType 枚举值 (来自 IPriceOracle.sol)
const ORACLE_TYPES = {
    PYTH: 0,       // OracleType.PYTH
    REDSTONE: 1    // OracleType.REDSTONE
};



describe("测试从pyth network预言机获取价格 ", function () {

    let pythPriceFeedV2
    let redstonePriceFeed
    let priceAggregator
    let pythUpdateData
    let updateFee
    let redstoneUpdateData
    const TEST_SYMBOL = "TSLA"
    const TEST_FEED_ID = "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1"
    const SEPOLIA_PYTH_CONTRACT_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21"
    const PYTH_ADDRESS = "0x940F61402924429bD927Af6E26f66D6DD0AD739f"
    const PRICE_AGGREGATOR = "0xBA22dd8E2520c4B48Fb84d46A34f64eC95cD6161"



    before(async function () {

        // const pythPriceFeed = await ethers.getContractFactory("PythPriceFeedV2")
        // pythPriceFeedV2 = await pythPriceFeed.deploy(SEPOLIA_PYTH_CONTRACT_ADDRESS)
        // await pythPriceFeedV2.waitForDeployment()
        // console.log("✅ PythPriceFeedV2 deployed to:", await pythPriceFeedV2.getAddress())

        pythPriceFeedV2 = await ethers.getContractAt("PythPriceFeedV2", PYTH_ADDRESS)

        // const redstonePriceFeedFactory = await ethers.getContractFactory("RedstonePriceFeedV2")
        // redstonePriceFeed = await redstonePriceFeedFactory.deploy()
        // await redstonePriceFeed.waitForDeployment()

        // // 部署配置写入到文件中
        // const deployment = {
        //     address: await redstonePriceFeed.getAddress(),
        // }
        // fs.writeFileSync("./RedstonePriceFeed.json", JSON.stringify(deployment), "utf8");

        //从文件中获取redstone部署数据
        const deployment = JSON.parse(fs.readFileSync("./RedstonePriceFeed.json", "utf8"));

        redstonePriceFeed = await ethers.getContractAt("RedstonePriceFeedV2", deployment.address)

        console.log("✅ RedstonePriceFeed deployed to:", await redstonePriceFeed.getAddress())


        // const priceAggregatorContract = await ethers.getContractFactory("PriceAggregator")
        // priceAggregator = await priceAggregatorContract.deploy()
        // await priceAggregator.waitForDeployment()

        priceAggregator = await ethers.getContractAt("PriceAggregator", PRICE_AGGREGATOR)
        console.log("✅ PriceAggregator deployed to:", await priceAggregator.getAddress())


    })

    it("测试从pyth network预言机获取价格 ", async function () {


        try {
            //设置feedId
            //await pythPriceFeedV2.setPriceFeedId(TEST_SYMBOL, TEST_FEED_ID)
            pythUpdateData = await fetchUpdateData([TEST_SYMBOL])


            // 2. 计算更新费用
            updateFee = await pythPriceFeedV2.getUpdateFee(pythUpdateData);
            console.log(`   💰 更新费用: ${updateFee.toString()} wei`);

            // 3. 组装 updateDataArray
            const pythParams = {
                symbol: TEST_SYMBOL,
                updateData: pythUpdateData
            };

            //使用静态调用（Static Call）方式执行函数
            //不会改变区块链状态，仅模拟执行
            //不消耗 gas，不产生交易
            //用于预览函数执行结果
            const pythResult = await pythPriceFeedV2.getPrice.staticCall(pythParams, { value: updateFee })

            console.log(` pyth结果`, pythResult);

            expect(pythResult).to.not.be.undefined;
            expect(pythResult.success).to.be.true;
            expect(pythResult.price).to.be.gt(0);

            const priceUSD = ethers.formatEther(pythResult.price);
            console.log(`   💰 ${TEST_SYMBOL} Pyth 价格: $${priceUSD}`);
            console.log(`   ✅ Pyth 价格获取成功`);
        } catch (error) {
            console.error("   ❌ Pyth 价格获取失败:", error);
        }
    })

    it("测试从redstone预言机获取价格 ", async function () {
        console.log("   🔍 获取 RedStone 数据...");
        redstoneUpdateData = await getRedStoneUpdateData(TEST_SYMBOL)

        console.log(`   💰 RedStone 数据: `, redstoneUpdateData);

        const redstoneParams = {
            symbol: TEST_SYMBOL,
            updateData: [redstoneUpdateData.updateData]
        };

        try {
            const redstoneResult = await redstonePriceFeed.getPrice.staticCall(redstoneParams);
            const priceUSD = ethers.formatEther(redstoneResult.price);
            console.log(`   💰 RedStone 结果: `, redstoneResult);
            console.log(`   💰 ${TEST_SYMBOL} RedStone 价格: ${priceUSD}`);
            expect(redstoneResult).to.not.be.undefined;
            expect(redstoneResult.success).to.be.true;
            expect(redstoneResult.price).to.be.gt(0);

            console.log(`   ✅ RedStone 数据获取成功`);
        } catch (error) {
            console.error("   ❌ RedStone 数据获取失败:", error);
            throw error;
        }
    })
    it("测试聚合预言机添加pyth和redstone预言机", async function () {
        console.log(`🌊 测试聚合预言机添加 RedStone 预言机...`);
        await priceAggregator.addOracle(ORACLE_TYPES.REDSTONE, redstonePriceFeed.getAddress(), ORACLE_WEIGHTS.REDSTONE)
        console.log(`   ✅ 添加 RedStone 预言机成功`);
        console.log(`   🌊 测试聚合预言机添加 Pyth 预言机...`);

        await priceAggregator.addOracle(ORACLE_TYPES.PYTH, pythPriceFeedV2.getAddress(), ORACLE_WEIGHTS.PYTH)

        console.log(`   ✅ 添加 Pyth 预言机成功`);
    })

    it("测试聚合预言机", async function () {

        console.log(`🌊 测试聚合预言机获取 ${TEST_SYMBOL} 价格...`);

        try {
            // 1. 准备 Pyth updateData
            console.log(`   📡 准备聚合器更新数据...`);

            // 2. 组装 updateDataArray
            const updateDataArray = [
                [pythUpdateData[0]],                 // Pyth 的 updateData (bytes[])
                [redstoneUpdateData.updateData]      // RedStone 的 payload (包装成 bytes[])
            ];

            // 3. 计算更新费用
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


})