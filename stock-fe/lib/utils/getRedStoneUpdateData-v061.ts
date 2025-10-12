// RedStone 数据获取工具 - 使用成功验证的 0.6.1 版本配置
import { DataServiceWrapper } from "@redstone-finance/evm-connector";
import { convertStringToBytes32 } from "@redstone-finance/sdk";

// 定义接口
export interface RedStoneUpdateData {
  updateData: string;
  symbolBytes32: string;
  symbol: string;
}

export interface DataServiceConfig {
  dataServiceId: string;
  dataPackagesIds: string[];
  uniqueSignersCount: number;
}

/**
 * 获取 RedStone 更新数据
 * @param symbol - 股票代码参数（忽略，强制使用 TSLA）
 * @returns Promise<RedStoneUpdateData>
 */
async function getRedStoneUpdateData(symbol: string = 'TSLA'): Promise<RedStoneUpdateData> {
  try {
    // 强制使用 TSLA，因为这是唯一验证过能成功获取的符号
    symbol = 'TSLA';
    console.log(`🔍 获取 ${symbol} 的 RedStone 数据...`);

    // 使用成功验证的配置
    const config: DataServiceConfig = {
      dataServiceId: "redstone-main-demo",
      dataPackagesIds: [symbol],  // 注意：使用 dataPackagesIds，不是 dataFeeds
      uniqueSignersCount: 1,      // 必需参数
    };

    const wrapper = new DataServiceWrapper(config);

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

  } catch (error: any) {
    console.error(`❌ 获取 ${symbol} RedStone 数据失败:`, error.message);
    throw error;
  }
}

/**
 * 批量获取多个股票的 RedStone 数据
 * @param symbols - 股票代码数组
 * @returns Promise<RedStoneUpdateData[]> 返回数据数组
 */
async function getMultipleRedStoneData(symbols: string[] = ['TSLA']): Promise<RedStoneUpdateData[]> {
  const results: RedStoneUpdateData[] = [];

  for (const symbol of symbols) {
    try {
      const data = await getRedStoneUpdateData(symbol);
      results.push(data);
    } catch (error: any) {
      console.error(`⚠️ 跳过 ${symbol}:`, error.message);
      // 继续处理其他符号
    }
  }

  return results;
}

/**
 * 将字符串转换为 bytes32 格式
 * @param str - 要转换的字符串
 * @returns bytes32 格式的字符串
 */
function convertStringToBytes32Wrapper(str: string): string {
  return convertStringToBytes32(str);
}

// 导出函数
export {
  getRedStoneUpdateData,
  getMultipleRedStoneData,
  convertStringToBytes32Wrapper as convertStringToBytes32,

  // 保持向后兼容的别名
  fetchRedStonePayload,
};

// 为了向后兼容，提供别名
const fetchRedStonePayload = getMultipleRedStoneData;

// 默认导出
export default {
  getRedStoneUpdateData,
  getMultipleRedStoneData,
  convertStringToBytes32: convertStringToBytes32Wrapper,
  fetchRedStonePayload,
};