const axios = require('axios');

// Sepolia 的 Pyth HTTP 端点
const HERMES_ENDPOINT = "https://hermes.pyth.network";

// 价格源 Feed IDs (与您之前定义的一致)
const FEED_IDS = {
  "AAPL": "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  "TSLA": "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  "GOOGL": "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
  "MSFT": "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  "AMZN": "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  "NVDA": "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"
};

/**
 * 获取指定符号的 Pyth 更新数据 (Price Update Data)
 * @param {string[]} symbols - 股票符号数组
 * @returns {Promise<string[]>} - 返回 bytes[] 格式的更新数据 (用于 updatePriceFeeds)
 * 
 * 重要说明：
 * - Pyth v2 API 会将多个符号的价格数据打包成一个 updateData
 * - 即使请求多个符号，通常也只返回一条包含所有数据的 updateData
 * - 在合约调用时，symbols 数组的顺序必须与 API 请求的 feedIds 顺序一致
 */
async function fetchUpdateData(symbols) {
  try {
    console.log(`🔄 获取 ${symbols.join(",")} 的 Pyth 更新数据...`);

    // 获取对应的 feed IDs
    const feedIds = symbols.map(symbol => {
      const feedId = FEED_IDS[symbol];
      console.log(`   🔍 获取 Feed ID: ${feedId}`);
      if (!feedId) {
        throw new Error(`未找到符号 ${symbol} 的 Feed ID`);
      }
      return feedId;
    });

    console.log(`📡 Feed IDs: ${feedIds.join(", ")}`);

    // 使用 Pyth HTTP API v2 获取价格更新数据
    const response = await axios.get(
      `${HERMES_ENDPOINT}/v2/updates/price/latest?${feedIds.map(id => `ids[]=${id}`).join('&')}`
    );

    // 打印 response.data.parsed 数据进行调试
    console.log("API parsed info:", response.data.parsed.map(x => ({
      id: x.id,
      price: x.price.price,
      expo: x.price.expo,
      time: x.price.publish_time
    })));

    // 检查价格数据有效性
    const invalidData = response.data.parsed.filter(x => {
      const isInvalidPrice = !x.price.price || x.price.price === "0" || x.price.price === 0;
      const isInvalidTime = !x.price.publish_time || x.price.publish_time === "0" || x.price.publish_time === 0;
      return isInvalidPrice || isInvalidTime;
    });

    if (invalidData.length > 0) {
      console.warn("⚠️  发现无效价格数据:", invalidData.map(x => ({
        symbol: symbols[response.data.parsed.indexOf(x)],
        id: x.id,
        price: x.price.price,
        time: x.price.publish_time,
        issue: !x.price.price || x.price.price === "0" || x.price.price === 0 ? "价格为0" : "时间戳为0"
      })));

      // 过滤掉无效数据对应的符号
      const validIndices = response.data.parsed
        .map((x, index) => {
          const isInvalidPrice = !x.price.price || x.price.price === "0" || x.price.price === 0;
          const isInvalidTime = !x.price.publish_time || x.price.publish_time === "0" || x.price.publish_time === 0;
          return (!isInvalidPrice && !isInvalidTime) ? index : -1;
        })
        .filter(index => index !== -1);

      if (validIndices.length === 0) {
        throw new Error("所有符号的价格数据都无效，无法继续执行");
      }

      console.log(`✅ 找到 ${validIndices.length} 个有效价格，将使用有效数据继续`);
    }

    // 获取 binary 数据用于链上调用
    if (!response.data.binary || !response.data.binary.data) {
      throw new Error('API 响应中缺少 binary 数据');
    }

    // 转换为 EVM bytes 格式 (0x前缀 + 十六进制)
    // 注意：Pyth API 返回的是包含所有符号价格的单一 updateData
    const bytesData = response.data.binary.data.map(data => {
      if (data && typeof data === 'string') {
        return data.startsWith('0x') ? data : '0x' + data;
      } else {
        throw new Error('无效的更新数据格式');
      }
    });

    console.log(`✅ 成功获取 ${bytesData.length} 条更新数据`);
    return bytesData;

  } catch (error) {
    console.error("❌ 获取 Pyth 更新数据失败:", error.message);
    throw error;
  }
}

/**
 * 获取单个符号的更新数据（便捷函数）
 */
async function fetchSingleUpdateData(symbol = "AAPL") {
  return fetchUpdateData([symbol]);
}

/**
 * 直接获取价格信息（不用于链上调用，仅用于显示）
 */
async function getPriceInfo(symbol = "AAPL") {
  try {
    const feedId = FEED_IDS[symbol];
    if (!feedId) {
      throw new Error(`未找到符号 ${symbol} 的 Feed ID`);
    }

    const response = await axios.get(
      `${HERMES_ENDPOINT}/api/latest_price_feeds?ids[]=${feedId}`
    );

    const priceFeed = response.data[0];
    if (priceFeed) {
      const price = priceFeed.price;
      console.log(`📊 ${symbol} 价格: $${price.price} ± $${price.confidence}`);
      console.log(`⏰ 更新时间: ${new Date(Number(price.publish_time) * 1000).toISOString()}`);
      return price;
    }

  } catch (error) {
    console.error("❌ 获取价格信息失败:", error.message);
    throw error;
  }
}

module.exports = {
  fetchUpdateData,
  fetchSingleUpdateData,
  getPriceInfo,
  FEED_IDS
};