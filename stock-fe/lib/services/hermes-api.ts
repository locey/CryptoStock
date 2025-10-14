import axios from 'axios';
import deploymentConfig from '@/lib/abi/deployments-uups-sepolia.json';

// Pyth 相关配置
const HERMES_ENDPOINT = 'https://hermes.pyth.network';

// 从部署配置文件直接获取价格源 ID 和代币地址
const STOCK_FEED_IDS: Record<string, string> = deploymentConfig.priceFeeds;
const STOCK_TOKEN_ADDRESSES: Record<string, string> = deploymentConfig.stockTokens;

export interface HermesPriceData {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price?: {
    price: string;
    conf: string;
    expo: number;
  };
}

export interface HermesResponse {
  parsed: {
    [feedId: string]: HermesPriceData[];
  };
}

/**
 * 从 Hermes API 获取股票价格
 * @param symbols 股票符号数组
 * @returns 价格数据对象
 */
export async function getPricesFromHermes(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  // 过滤出有效的股票符号
  const validSymbols = symbols.filter(symbol => STOCK_FEED_IDS[symbol]);

  if (validSymbols.length === 0) {
    console.warn('❌ 没有找到有效的股票符号');
    return prices;
  }

  // 构建 Feed ID 列表
  const feedIds = validSymbols.map(symbol => STOCK_FEED_IDS[symbol]);
  const feedIdParams = feedIds.map(id => `ids[]=${id}`).join('&');

  try {
    console.log('🌐 从 Hermes API 获取价格数据...');
    console.log('📋 查询的股票符号:', validSymbols);
    console.log('🔗 Feed IDs:', feedIds);

    const response = await axios.get<HermesResponse>(
      `${HERMES_ENDPOINT}/v2/updates/price/latest?${feedIdParams}`,
      {
        timeout: 10000, // 10秒超时
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    console.log('✅ Hermes API 响应成功');

    // 解析响应数据
    Object.entries(response.data.parsed).forEach(([feedId, priceData]) => {
      if (priceData && priceData.length > 0) {
        const latestPrice = priceData[priceData.length - 1];
        const price = parseFloat(latestPrice.price.price) * Math.pow(10, latestPrice.price.expo);

        // 找到对应的股票符号
        const symbol = Object.entries(STOCK_FEED_IDS).find(([sym, id]) => id === feedId)?.[0];
        if (symbol) {
          prices[symbol] = price;
          console.log(`💰 ${symbol} 价格: $${price}`);
        }
      }
    });

    console.log('📊 从 Hermes 获取到的价格:', prices);
    return prices;

  } catch (error: any) {
    console.error('❌ Hermes API 调用失败:', error.message);

    if (error.response) {
      console.error('❌ API 响应错误:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    throw new Error(`Hermes API 调用失败: ${error.message}`);
  }
}

/**
 * 获取单个股票的价格
 * @param symbol 股票符号
 * @returns 价格，失败返回 null
 */
export async function getSinglePriceFromHermes(symbol: string): Promise<number | null> {
  try {
    const prices = await getPricesFromHermes([symbol]);
    return prices[symbol] || null;
  } catch (error) {
    console.error(`❌ 获取 ${symbol} 价格失败:`, error);
    return null;
  }
}

/**
 * 检查股票是否在 Hermes 中支持
 * @param symbol 股票符号
 * @returns 是否支持
 */
export function isStockSupportedByHermes(symbol: string): boolean {
  return !!STOCK_FEED_IDS[symbol];
}

/**
 * 获取所有支持的股票符号
 * @returns 支持的股票符号列表
 */
export function getSupportedStocks(): string[] {
  return Object.keys(STOCK_FEED_IDS);
}

/**
 * 获取股票代币地址
 * @param symbol 股票符号
 * @returns 代币地址，如果不存在返回 undefined
 */
export function getStockTokenAddress(symbol: string): string | undefined {
  return STOCK_TOKEN_ADDRESSES[symbol];
}

/**
 * 获取所有股票代币地址映射
 * @returns 股票代币地址映射对象
 */
export function getAllStockTokenAddresses(): Record<string, string> {
  return { ...STOCK_TOKEN_ADDRESSES };
}

// 导出常量供外部使用
export { STOCK_FEED_IDS, STOCK_TOKEN_ADDRESSES };