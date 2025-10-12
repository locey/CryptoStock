import axios from 'axios';
import deploymentConfig from '../abi/deployments-uups-sepolia.json';

// 定义价格数据接口
interface PriceInfo {
  id: string;
  price: {
    price: string;
    expo: number;
    publish_time: number;
    conf: string;
  };
}

interface ParsedData {
  parsed: PriceInfo[];
}

interface ResponseData {
  data: ParsedData;
}

// Sepolia 的 Pyth HTTP 端点
const HERMES_ENDPOINT = "https://hermes.pyth.network";

// 从部署配置文件直接获取价格源 ID 和代币地址
const FEED_IDS: Record<string, string> = deploymentConfig.priceFeeds;
const TOKEN_ADDRESSES: Record<string, string> = deploymentConfig.stockTokens;

/**
 * 获取指定符号的 Pyth 更新数据 (Price Update Data)
 * @param symbols - 股票符号数组
 * @returns - 返回 bytes[] 格式的更新数据 (用于 updatePriceFeeds)
 *
 * 重要说明：
 * - Pyth v2 API 会将多个符号的价格数据打包成一个 updateData
 * - 即使请求多个符号，通常也只返回一条包含所有数据的 updateData
 * - 在合约调用时，symbols 数组的顺序必须与 API 请求的 feedIds 顺序一致
 */
async function fetchUpdateData(symbols: string[] = ["AAPL"]): Promise<string[]> {
  try {
    console.log(`🔄 获取 ${symbols.join(", ")} 的 Pyth 更新数据...`);
    
    // 获取对应的 feed IDs
    const feedIds = symbols.map(symbol => {
      const feedId = FEED_IDS[symbol];
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
    console.log("API parsed info:", response.data.parsed.map((x: PriceInfo) => ({
      id: x.id,
      price: x.price.price,
      expo: x.price.expo,
      time: x.price.publish_time
    })));
    
    // 检查价格数据有效性
    const invalidData = response.data.parsed.filter((x: PriceInfo) => {
      const isInvalidPrice = !x.price.price || x.price.price === "0";
      const isInvalidTime = !x.price.publish_time || x.price.publish_time === 0;
      return isInvalidPrice || isInvalidTime;
    });
    
    if (invalidData.length > 0) {
      console.warn("⚠️  发现无效价格数据:", invalidData.map((x: PriceInfo) => ({
        symbol: symbols[response.data.parsed.indexOf(x)],
        id: x.id,
        price: x.price.price,
        time: x.price.publish_time,
        issue: !x.price.price || x.price.price === "0" ? "价格为0" : "时间戳为0"
      })));
      
      // 过滤掉无效数据对应的符号
      const validIndices = response.data.parsed
        .map((x: PriceInfo, index: number) => {
          const isInvalidPrice = !x.price.price || x.price.price === "0";
          const isInvalidTime = !x.price.publish_time || x.price.publish_time === 0;
          return (!isInvalidPrice && !isInvalidTime) ? index : -1;
        })
        .filter((index: number) => index !== -1);
      
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
    const bytesData = response.data.binary.data.map((data: string) => {
      if (data && typeof data === 'string') {
        return data.startsWith('0x') ? data : '0x' + data;
      } else {
        throw new Error('无效的更新数据格式');
      }
    });
    
    console.log(`✅ 成功获取 ${bytesData.length} 条更新数据`);
    return bytesData;
    
  } catch (error) {
    console.error("❌ 获取 Pyth 更新数据失败:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 获取单个符号的更新数据（便捷函数）
 */
async function fetchSingleUpdateData(symbol: string = "AAPL"): Promise<string[]> {
  return fetchUpdateData([symbol]);
}

/**
 * 直接获取价格信息（不用于链上调用，仅用于显示）
 */
async function getPriceInfo(symbol: string = "AAPL") {
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
    console.error("❌ 获取价格信息失败:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// 默认导出主要的获取函数
const getPythUpdateData = fetchUpdateData;
export default getPythUpdateData;

// 命名导出其他函数
export { fetchUpdateData, fetchSingleUpdateData, getPriceInfo, FEED_IDS, TOKEN_ADDRESSES };