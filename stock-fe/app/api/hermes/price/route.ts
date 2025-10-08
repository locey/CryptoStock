import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// 股票符号到 Pyth Feed ID 的映射（与合约保持一致）
const STOCK_FEED_IDS: Record<string, string> = {
  // 美股 - 使用与合约一致的 Feed ID
  'AAPL': '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688', // Apple Inc.
  'TSLA': '0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2', // Tesla Inc.
  'GOOGL': '0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6', // Alphabet Inc.
  'MSFT': '0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1', // Microsoft Corp.
  'AMZN': '0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a', // Amazon.com Inc.
  'META': '0xc1f33e5461c6a625f2e704417b7e10d87c0fce2c', // Meta Platforms Inc.
  'NVDA': '0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593', // NVIDIA Corp.

  // 加密货币
  'BTC': '0xe62df6c8b8a885664618ed715f6a08e640c2c788', // Bitcoin/USD
  'ETH': '0xff61491a931112dd9b260874939c7db856e478c1', // Ethereum/USD

  // 指数
  'SPY': '0xd3d2a9c7231a442a76f1a0df058a869d3b9954bb', // S&P 500
  'QQQ': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9', // NASDAQ 100
};

// Pyth Network API 端点
const HERMES_ENDPOINT = "https://hermes.pyth.network";

/**
 * 获取价格更新数据 API 路由
 * 
 * 请求格式: /api/hermes/price?symbols=AAPL,MSFT
 * 返回格式: { updateData: string[] }
 */
export async function GET(request: NextRequest) {
  try {
    // 从查询参数获取股票符号
    const searchParams = request.nextUrl.searchParams;
    const symbolsParam = searchParams.get('symbols');
    
    if (!symbolsParam) {
      return NextResponse.json(
        { error: "Missing 'symbols' parameter" },
        { status: 400 }
      );
    }
    
    // 解析股票符号
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    
    if (symbols.length === 0) {
      return NextResponse.json(
        { error: "No valid symbols provided" },
        { status: 400 }
      );
    }
    
    console.log(`🔄 获取 ${symbols.join(", ")} 的 Pyth 更新数据...`);
    
    // 获取对应的 feed IDs
    const feedIds = symbols.map(symbol => {
      const feedId = STOCK_FEED_IDS[symbol];
      if (!feedId) {
        console.warn(`⚠️ 未找到符号 ${symbol} 的 Feed ID`);
        return null;
      }
      return feedId;
    }).filter(id => id !== null) as string[];
    
    if (feedIds.length === 0) {
      return NextResponse.json(
        { error: "No valid feed IDs found for the provided symbols" },
        { status: 400 }
      );
    }
    
    console.log(`📡 Feed IDs: ${feedIds.join(", ")}`);
    
    // 使用 Pyth HTTP API v2 获取价格更新数据
    // 与合约测试代码使用相同的端点和参数
    const queryParams = feedIds.map(id => `ids[]=${id}`).join('&');
    const url = `${HERMES_ENDPOINT}/v2/updates/price/latest?${queryParams}`;
    
    console.log(`🌐 请求 Pyth 更新数据: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoStock/1.0'
      },
      timeout: 10000 // 10秒超时
    });
    
    // 检查返回数据
    if (!response.data || !response.data.binary || !response.data.binary.data) {
      console.error("❌ API 返回数据格式错误:", response.data);
      return NextResponse.json(
        { error: "Invalid response from Pyth API" },
        { status: 500 }
      );
    }

    
    // 打印 parsed 数据进行调试
    if (response.data.parsed) {
      console.log("📊 API parsed info:", response.data.parsed.map((x: {
        id: string;
        price?: {
          price: string;
          expo: number;
          publish_time: number;
        };
      }) => ({
        id: x.id,
        price: x.price?.price,
        expo: x.price?.expo,
        time: x.price?.publish_time
      })));
    }
    
    // 检查价格数据有效性
    if (response.data.parsed) {
      const invalidData = response.data.parsed.filter((x: {
        id: string;
        price?: {
          price: string;
          expo: number;
          publish_time: number;
        };
      }) => {
        const isInvalidPrice = !x.price?.price || x.price?.price === "0";
        const isInvalidTime = !x.price?.publish_time || x.price?.publish_time === 0;
        return isInvalidPrice || isInvalidTime;
      });
      
      if (invalidData.length > 0) {
        console.warn("⚠️ 发现无效价格数据:", invalidData.map((x: { id: string; price?: { price: string | number; publish_time: number } }) => ({
          id: x.id,
          price: x.price?.price,
          time: x.price?.publish_time,
          issue: !x.price?.price || x.price?.price === "0" || x.price?.price === 0 ? "价格为0" : "时间戳为0"
        })));
      }
    }
    
    // 转换为 EVM bytes 格式 (0x前缀 + 十六进制)
    const bytesData = response.data.binary.data.map((data: string) => {
      if (data && typeof data === 'string') {
        return data.startsWith('0x') ? data : '0x' + data;
      } else {
        throw new Error('无效的更新数据格式');
      }
    });
    
    console.log(`✅ 成功获取 ${bytesData.length} 条更新数据`,bytesData);
    
    // 返回更新数据
    return NextResponse.json({
      updateData: bytesData,
      symbols,
      feedIds,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error("❌ 获取 Pyth 更新数据失败:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: `Failed to fetch Pyth update data: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

/**
 * 创建一个新的 POST 路由，以便前端可以更灵活地请求数据
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols } = body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: "Invalid or missing 'symbols' in request body" },
        { status: 400 }
      );
    }
    
    // 处理符号列表
    const validSymbols = symbols.map(s => s.trim().toUpperCase());
    
    console.log(`🔄 获取 ${validSymbols.join(", ")} 的 Pyth 更新数据...`);
    
    // 获取对应的 feed IDs
    const feedIds = validSymbols.map(symbol => {
      const feedId = STOCK_FEED_IDS[symbol];
      if (!feedId) {
        console.warn(`⚠️ 未找到符号 ${symbol} 的 Feed ID`);
        return null;
      }
      return feedId;
    }).filter(id => id !== null) as string[];
    
    if (feedIds.length === 0) {
      return NextResponse.json(
        { error: "No valid feed IDs found for the provided symbols" },
        { status: 400 }
      );
    }
    
    // 使用 Pyth HTTP API v2 获取价格更新数据
    const queryParams = feedIds.map(id => `ids[]=${id}`).join('&');
    const url = `${HERMES_ENDPOINT}/v2/updates/price/latest?${queryParams}`;
    
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CryptoStock/1.0'
      },
      timeout: 10000
    });
    
    // 检查返回数据
    if (!response.data || !response.data.binary || !response.data.binary.data) {
      console.error("❌ API 返回数据格式错误:", response.data);
      return NextResponse.json(
        { error: "Invalid response from Pyth API" },
        { status: 500 }
      );
    }
    
    // 转换为 EVM bytes 格式
    const bytesData = response.data.binary.data.map((data: string) => {
      if (data && typeof data === 'string') {
        return data.startsWith('0x') ? data : '0x' + data;
      } else {
        throw new Error('无效的更新数据格式');
      }
    });
    
    console.log(`✅ 成功获取 ${bytesData.length} 条更新数据`);
    
    // 返回更新数据
    return NextResponse.json({
      updateData: bytesData,
      symbols: validSymbols,
      feedIds,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error("❌ 获取 Pyth 更新数据失败:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: `Failed to fetch Pyth update data: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}