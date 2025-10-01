/**
 * 前端 API 调用工具函数
 */

/**
 * 获取 Pyth 价格更新数据
 * @param symbols 股票代码数组，例如 ["AAPL", "MSFT"]
 * @returns 包含更新数据的对象 { updateData: string[] }
 */
export async function fetchPythUpdateData(symbols: string[]): Promise<{ 
  updateData: string[] 
}> {
  try {
    // 调用我们的 API 端点
    const response = await fetch(`/api/hermes/price?symbols=${symbols.join(',')}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API 请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.updateData || !Array.isArray(data.updateData)) {
      console.warn("⚠️ API 返回的更新数据格式不正确:", data);
      return { updateData: [] };
    }
    
    console.log(`✅ 成功获取 ${symbols.join(', ')} 的价格更新数据: ${data.updateData.length} 条`);
    return { updateData: data.updateData };
  } catch (error) {
    console.error("❌ 获取 Pyth 价格更新数据失败:", error);
    return { updateData: [] };
  }
}

/**
 * 获取支持的股票代码列表
 * 这个函数可以在需要时实现，从后端获取支持的股票列表
 */
export async function getSupportedSymbols(): Promise<string[]> {
  // 这里可以实现一个 API 调用，获取支持的股票列表
  // 暂时返回一个硬编码的列表
  return ["AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "BTC", "ETH", "SPY", "QQQ"];
}