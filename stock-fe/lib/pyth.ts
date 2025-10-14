/**
 * Pyth Network 价格数据获取工具
 * 用于获取股票价格的更新数据，以便在链上交易中更新 Pyth 预言机价格
 */

// 注意：现在使用本地 API 路由，不再需要直接访问外部 Pyth API

/**
 * 获取 Pyth 价格更新数据
 * @param symbols 股票代码数组，例如 ["AAPL", "MSFT"]
 * @returns 价格更新数据数组 (string[])
 */
export async function fetchPythUpdateData(symbols: string[]): Promise<string[]> {
  try {
    console.log(`🔄 开始获取 Pyth 数据，请求符号:`, symbols);

    if (symbols.length === 0) {
      console.error("没有提供符号");
      return [];
    }

    // 使用本地 API 路由避免 CORS 问题
    const url = `/api/hermes/price?symbols=${symbols.join(',')}`;
    console.log(`🌐 请求本地 API:`, url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    console.log(`📡 本地 API 响应状态:`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`本地 API 请求失败: ${response.statusText} (${response.status}) - ${errorText}`);
    }

    const data = await response.json();
    console.log(`📊 本地 API 响应数据:`, {
      hasUpdateData: !!data.updateData,
      updateDataLength: data.updateData?.length || 0,
      symbols: data.symbols,
      feedIds: data.feedIds,
      timestamp: data.timestamp,
      fullResponse: data
    });

    // 检查 updateData
    if (!data.updateData || !Array.isArray(data.updateData)) {
      console.error('本地 API 响应中缺少 updateData 或格式错误');
      return [];
    }

    if (data.updateData.length === 0) {
      console.warn('本地 API 返回的 updateData 为空数组');
      return [];
    }

    console.log(`✅ 成功从本地 API 获取 ${data.updateData.length} 条更新数据:`, data.updateData);
    return data.updateData;
  } catch (error) {
    console.error("❌ 获取 Pyth 价格更新数据失败:", error);
    return [];
  }
}

/**
 * 检查股票代码是否支持 Pyth 价格数据
 * @param symbol 股票代码
 * @returns 是否支持
 */
export function isSymbolSupported(symbol: string): boolean {
  // 支持的股票代码，与本地 API 保持一致
  const supportedSymbols = [
    'AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA',
    'BTC', 'ETH', 'SPY', 'QQQ'
  ];
  return supportedSymbols.includes(symbol.toUpperCase());
}

/**
 * 获取所有支持的股票代码
 * @returns 支持的股票代码数组
 */
export function getSupportedSymbols(): string[] {
  return [
    'AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA',
    'BTC', 'ETH', 'SPY', 'QQQ'
  ];
}