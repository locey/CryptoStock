import { PublicClient, Address } from 'viem';
import StockTokenABI from './abi/StockToken.json';

/**
 * 调试合约问题
 */
export async function debugContractIssues(
  publicClient: PublicClient,
  contractAddress: Address
) {
  console.log('🔍 开始调试合约问题...');

  try {
    // 1. 检查合约是否存在
    const code = await publicClient.getBytecode({ address: contractAddress });
    console.log('📦 合约代码长度:', code?.length || 0);

    if (!code || code === '0x' || code.length < 2) {
      console.error('❌ 合约不存在或未正确部署');
      return { error: '合约不存在或未正确部署' };
    }

    // 2. 尝试获取基本信息
    const name = await publicClient.readContract({
      address: contractAddress,
      abi: StockTokenABI,
      functionName: 'name',
    }) as string;
    console.log('📛 合约名称:', name);

    const symbol = await publicClient.readContract({
      address: contractAddress,
      abi: StockTokenABI,
      functionName: 'stockSymbol',
    }) as string;
    console.log('🔤 股票符号:', symbol);

    // 3. 检查 OracleAggregator 是否设置
    const oracleAggregator = await publicClient.readContract({
      address: contractAddress,
      abi: StockTokenABI,
      functionName: 'oracleAggregator',
    }) as Address;
    console.log('🔮 OracleAggregator 地址:', oracleAggregator);

    if (oracleAggregator === '0x0000000000000000000000000000000000000000') {
      console.error('❌ OracleAggregator 未设置');
      return { error: 'OracleAggregator 未设置' };
    }

    // 4. 检查交易参数
    const tradingInfo = await publicClient.readContract({
      address: contractAddress,
      abi: StockTokenABI,
      functionName: 'getTradingInfo',
    }) as any[];
    console.log('⚙️ 交易参数:', tradingInfo);

    // 5. 尝试获取价格（这里可能会失败）
    try {
      const price = await publicClient.readContract({
        address: contractAddress,
        abi: StockTokenABI,
        functionName: 'getStockPrice',
      }) as bigint;
      console.log('💰 股票价格:', price.toString());
      return { success: true, name, symbol, price };
    } catch (priceError: any) {
      console.error('❌ 获取价格失败:', priceError.message);

      // 6. 如果价格获取失败，尝试其他方法
      console.log('🔍 尝试检查合约的其他状态...');

      try {
        const balance = await publicClient.readContract({
          address: contractAddress,
          abi: StockTokenABI,
          functionName: 'balanceOf',
          args: [contractAddress],
        }) as bigint;
        console.log('💎 合约代币余额:', balance.toString());
      } catch (balanceError: any) {
        console.error('❌ 获取余额失败:', balanceError.message);
      }

      return {
        error: '价格获取失败',
        details: priceError.message,
        name,
        symbol,
        oracleAggregator,
        tradingInfo
      };
    }

  } catch (error: any) {
    console.error('❌ 调试过程中发生错误:', error.message);
    return { error: error.message };
  }
}

/**
 * 获取常见错误签名
 */
export function getErrorSignature(signature: string): string {
  const commonErrors: Record<string, string> = {
    '0x14aebe68': 'PythPriceError', // Pyth价格相关错误
    '0x08c379a0': 'Error(string)', // 标准错误消息
    '0x4e487b71': 'Panic(uint)', // panic错误
    '0x96c6fd1c': 'InsufficientBalance', // 余额不足
    '0x70a08231': 'balanceOf', // 余额查询
    '0x06fdde03': 'name', // 名称查询
    '0x95d89b41': 'symbol', // 符号查询
  };

  return commonErrors[signature] || '未知错误';
}