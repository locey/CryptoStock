import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import deploymentConfig from '@/lib/abi/deployments-uups-sepolia.json';

// 从部署配置文件直接获取价格源 ID 和代币地址
const STOCK_FEED_IDS: Record<string, string> = deploymentConfig.priceFeeds;
const STOCK_TOKEN_ADDRESSES: Record<string, string> = deploymentConfig.stockTokens;

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

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ 获取 Pyth 更新数据失败:", errorMessage);
    return NextResponse.json(
      { error: `Failed to fetch Pyth update data: ${errorMessage}` },
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

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("❌ 获取 Pyth 更新数据失败:", errorMessage);
    return NextResponse.json(
      { error: `Failed to fetch Pyth update data: ${errorMessage}` },
      { status: 500 }
    );
  }
}