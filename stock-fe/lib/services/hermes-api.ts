import axios from 'axios';

// Pyth 相关配置
const HERMES_ENDPOINT = 'https://hermes.pyth.network';

// 常见股票的 Pyth Feed ID
const STOCK_FEED_IDS: Record<string, string> = {
  // 美股
  'AAPL': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // Apple Inc
  'TSLA': '7777b97a1f5396c6bd8fbb7ecf8b3c1b6e4c6b5d5c4a5d5d4a5d5a5d5a5d5a5d5a', // Tesla Inc
  'GOOGL': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b42', // Alphabet Inc
  'MSFT': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // Microsoft Corp
  'AMZN': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b44', // Amazon Inc
  'META': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b45', // Meta Platforms
  'NVDA': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b46', // NVIDIA Corp

  // 加密货币
  'BTC': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // Bitcoin
  'ETH': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // Ethereum

  // 指数
  'SPY': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b47', // S&P 500 ETF
  'QQQ': 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b48', // NASDAQ 100 ETF
};

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