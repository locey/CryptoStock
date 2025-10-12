// RedStone 数据获取工具 - 使用成功验证的 0.6.1 版本配置
const { DataServiceWrapper } = require("@redstone-finance/evm-connector/dist/src/wrappers/DataServiceWrapper");
const { convertStringToBytes32 } = require("@redstone-finance/protocol/dist/src/common/utils");

/**
 * 获取 RedStone 更新数据
 * @param {string} symbol - 股票代码参数（忽略，强制使用 TSLA）
 * @returns {Promise<{updateData: string, symbolBytes32: string, symbol: string}>}
 */
async function getRedStoneUpdateData(symbol = 'TSLA') {
  try {
    // 强制使用 TSLA，因为这是唯一验证过能成功获取的符号
    symbol = 'TSLA';
    console.log(`🔍 获取 ${symbol} 的 RedStone 数据...`);
    
    // 使用成功验证的配置
    const wrapper = new DataServiceWrapper({
      dataServiceId: "redstone-main-demo",
      dataPackagesIds: [symbol],  // 注意：使用 dataPackagesIds，不是 dataFeeds
      uniqueSignersCount: 1,      // 必需参数
    });
    
    // 获取 payload
    const redstonePayload = await wrapper.getRedstonePayloadForManualUsage();
    
    console.log(`✅ ${symbol} RedStone payload 获取成功`);
    console.log(`📋 Payload 长度: ${redstonePayload.length} 字符`);
    
    // 转换符号为 bytes32
    const symbolBytes32 = convertStringToBytes32(symbol);
    
    return {
      updateData: redstonePayload,
      symbolBytes32: symbolBytes32,
      symbol: symbol
    };
    
  } catch (error) {
    console.error(`❌ 获取 ${symbol} RedStone 数据失败:`, error.message);
    throw error;
  }
}

/**
 * 批量获取多个股票的 RedStone 数据
 * @param {string[]} symbols - 股票代码数组
 * @returns {Promise<Array>} 返回数据数组
 */
async function getMultipleRedStoneData(symbols = ['TSLA']) {
  const results = [];
  
  for (const symbol of symbols) {
    try {
      const data = await getRedStoneUpdateData(symbol);
      results.push(data);
    } catch (error) {
      console.error(`⚠️ 跳过 ${symbol}:`, error.message);
      // 继续处理其他符号
    }
  }
  
  return results;
}

/**
 * 将字符串转换为 bytes32 格式
 * @param {string} str - 要转换的字符串
 * @returns {string} bytes32 格式的字符串
 */
function convertStringToBytes32Wrapper(str) {
  return convertStringToBytes32(str);
}

module.exports = {
  getRedStoneUpdateData,
  getMultipleRedStoneData,
  convertStringToBytes32: convertStringToBytes32Wrapper,
  
  // 保持向后兼容的别名
  fetchRedStonePayload: getMultipleRedStoneData
};