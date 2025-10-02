import { NextRequest, NextResponse } from 'next/server';

// 本地测试用的固定价格数据
const LOCAL_PRICES: Record<string, { price: string; conf: string; expo: number; publish_time: number; formatted: { price: string; conf: string; confidence: string } }> = {
  'AAPL': {
    price: '150',
    conf: '1',
    expo: -2,
    publish_time: Math.floor(Date.now() / 1000),
    formatted: {
      price: '1.50',
      conf: '0.01',
      confidence: '0.67%'
    }
  },
  'GOOGL': {
    price: '280',
    conf: '2',
    expo: -2,
    publish_time: Math.floor(Date.now() / 1000),
    formatted: {
      price: '2.80',
      conf: '0.02',
      confidence: '0.71%'
    }
  },
  'TSLA': {
    price: '25000',
    conf: '100',
    expo: -2,
    publish_time: Math.floor(Date.now() / 1000),
    formatted: {
      price: '250.00',
      conf: '1.00',
      confidence: '0.40%'
    }
  },
  'MSFT': {
    price: '38000',
    conf: '150',
    expo: -2,
    publish_time: Math.floor(Date.now() / 1000),
    formatted: {
      price: '380.00',
      conf: '1.50',
      confidence: '0.39%'
    }
  }
};

/**
 * 获取本地价格数据 API
 * 用于本地开发测试
 *
 * 请求格式: /api/price?symbols=AAPL,GOOGL
 * 返回格式: { success: boolean, data: Record<string, PriceData> }
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

    console.log(`🔄 获取 ${symbols.join(", ")} 的本地价格数据...`);

    // 构建返回数据
    const data: Record<string, {
      price: string;
      conf: string;
      expo: number;
      publish_time: number;
      formatted: {
        price: string;
        conf: string;
        confidence: string;
      };
    }> = {};

    for (const symbol of symbols) {
      const priceData = LOCAL_PRICES[symbol];
      if (priceData) {
        data[symbol] = priceData;
        console.log(`✅ ${symbol}: $${priceData.formatted.price}`);
      } else {
        console.warn(`⚠️ 未找到符号 ${symbol} 的价格数据`);
        // 返回默认价格
        data[symbol] = {
          price: '100',
          conf: '1',
          expo: -2,
          publish_time: Math.floor(Date.now() / 1000),
          formatted: {
            price: '1.00',
            conf: '0.01',
            confidence: '1.00%'
          }
        };
      }
    }

    console.log(`✅ 成功返回 ${Object.keys(data).length} 个符号的价格数据`);

    // 返回价格数据
    return NextResponse.json({
      success: true,
      data,
      count: Object.keys(data).length,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error("❌ 获取本地价格数据失败:", error instanceof Error ? error.message : "未知错误");
    return NextResponse.json(
      { error: `Failed to fetch local price data: ${error instanceof Error ? error.message : "未知错误"}` },
      { status: 500 }
    );
  }
}