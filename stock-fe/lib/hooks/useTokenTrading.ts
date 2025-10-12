import { useState, useCallback, useEffect } from 'react';
import { Address, formatUnits, parseUnits, maxUint256, formatEther } from 'viem';
import { ethers } from 'ethers';
import { usePublicClient, useWalletClient } from 'yc-sdk-hooks';
import { useWallet } from 'yc-sdk-ui';
import { useToast } from '@/hooks/use-toast';
import USDT_TOKEN_ABI from '@/lib/abi/MockERC20.json';
import STOCK_TOKEN_ABI from '@/lib/abi/StockToken.json';
import PYTH_PRICE_FEED_ABI from '@/lib/abi/PythPriceFeed.json';
import PRICE_AGGREGATOR_ABI from '@/lib/abi/PriceAggregator.json';
import BUY_PARAMS from '@/lib/abi/buy.json';
// import { fetchStockPrice } from '@/lib/hermes';
import { usePythStore } from '@/lib/stores/pythStore';
import { getNetworkConfig } from '@/lib/contracts';
import UNIFIED_ORACLE_DEPLOYMENT from '@/lib/abi/deployments-unified-oracle-sepolia.json';
import getPythUpdateData, { fetchUpdateData } from "@/lib/utils/getPythUpdateData";
import getPriceInfo from "@/lib/utils/getPythUpdateData";
import { getRedStoneUpdateData } from '../utils/getRedStoneUpdateData-v061';
export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  totalSupply: number;
  userBalance: number;
  userValue: number;
}

export interface TradingState {
  buyAmount: string;
  slippage: number;
  customSlippage: string;
  showCustomSlippage: boolean;
  showDropdown: boolean;
  usdtBalance: bigint;
  allowance: bigint;
  needsApproval: boolean;
  transactionStatus: 'idle' | 'approving' | 'buying' | 'success' | 'error';
  transactionHash: `0x${string}` | null;
  priceData: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
    formatted: {
      price: string;
      conf: string;
      confidence: string;
    };
  } | null;
  updateData: `0x${string}`[][] | null;
  updateFee: bigint;
}

export interface TradingResult {
  success: boolean;
  hash?: `0x${string}`;
  error?: string;
}

/**
 * 自定义十六进制验证函数，不依赖 viem
 * @param data - 要验证的数据
 * @returns 是否为有效的十六进制字符串
 */
function isValidHex(data: string): boolean {
  if (typeof data !== 'string') return false;

  const trimmedData = data.trim();
  if (!trimmedData) return false;

  // 检查是否以 0x 开头
  if (!trimmedData.startsWith('0x')) return false;

  // 检查长度（至少 0x + 1 个字符）
  if (trimmedData.length < 3) return false;

  // 检查是否只包含有效的十六进制字符
  const hexPart = trimmedData.slice(2);
  return /^[0-9a-fA-F]*$/.test(hexPart);
}

/**
 * 验证和格式化十六进制字符串
 * @param data - 要验证的数据
 * @param context - 上下文描述，用于错误消息
 * @returns 格式化的十六进制字符串
 */
function validateAndFormatHex(data: unknown, context: string): `0x${string}` {
  console.log(`🔍 validateAndFormatHex 调用: ${context}`, {
    data: data,
    dataType: typeof data,
    dataLength: data?.toString?.length || 0
  });

  // 检查数据是否为空
  if (data === null || data === undefined) {
    const error = `${context}: 数据为空`;
    console.error(`❌ ${error}`);
    throw new Error(error);
  }

  // 检查数据是否为字符串
  if (typeof data !== 'string') {
    const error = `${context}: 数据类型无效，期望字符串，实际 ${typeof data}`;
    console.error(`❌ ${error}`);
    throw new Error(error);
  }

  // 去除首尾空白字符
  const trimmedData = data.trim();
  console.log(`🔍 ${context} 去除空白后: "${trimmedData}"`);

  // 检查去除空白后是否为空
  if (!trimmedData) {
    const error = `${context}: 数据为空字符串`;
    console.error(`❌ ${error}`);
    throw new Error(error);
  }

  // 使用自定义验证而不是 viem 的 isValidHex
  if (!isValidHex(trimmedData)) {
    console.log(`🔍 ${context} 不是有效十六进制，尝试修复...`);

    // 如果不是标准的十六进制格式，尝试修复
    let formattedData = trimmedData;

    // 移除 0x 前缀（如果存在）然后重新添加
    if (trimmedData.startsWith('0x')) {
      const hexPart = trimmedData.slice(2);
      // 验证剩余部分是否为有效的十六进制字符
      if (!/^[0-9a-fA-F]*$/.test(hexPart)) {
        const error = `${context}: 包含无效的十六进制字符: ${trimmedData}`;
        console.error(`❌ ${error}`);
        throw new Error(error);
      }
      formattedData = `0x${hexPart}`;
    } else {
      // 如果没有 0x 前缀，检查是否为有效的十六进制字符
      if (!/^[0-9a-fA-F]*$/.test(trimmedData)) {
        const error = `${context}: 包含无效的十六进制字符: ${trimmedData}`;
        console.error(`❌ ${error}`);
        throw new Error(error);
      }
      formattedData = `0x${trimmedData}`;
    }

    console.log(`🔍 ${context} 修复后: "${formattedData}"`);

    // 最终验证
    if (!isValidHex(formattedData)) {
      const error = `${context}: 无法格式化为有效的十六进制: ${trimmedData}`;
      console.error(`❌ ${error}`);
      throw new Error(error);
    }

    console.log(`✅ ${context} 验证通过: ${formattedData.slice(0, 30)}...`);
    return formattedData as `0x${string}`;
  }

  console.log(`✅ ${context} 无需修复，直接返回: ${trimmedData.slice(0, 30)}...`);
  return trimmedData as `0x${string}`;
}

/**
 * Token Trading Hook
 *
 * 这个 Hook 封装了代币购买和销售的所有逻辑，
 * 包括授权、余额查询、价格获取等。
 */
export const useTokenTrading = (token: TokenInfo, usdtAddress: Address, oracleAddress: Address) => {
  console.log("token",token,"usdtAddress",usdtAddress)
  const { toast } = useToast();
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();
  const { isConnected, address } = useWallet();

  // Get the StockToken implementation contract address
  const networkConfig = getNetworkConfig(chain?.id || 11155111);
  const stockTokenImplAddress = networkConfig.contracts.stockTokenImplementation as Address;

  // Use unified oracle deployments
  const pythPriceFeedAddress = UNIFIED_ORACLE_DEPLOYMENT.contracts.pythPriceFeed.address as Address;
  const priceAggregatorAddress = UNIFIED_ORACLE_DEPLOYMENT.contracts.priceAggregator.address as Address;

console.log("🔍 useTokenTrading 初始化:", { isConnected, address, stockTokenImplAddress, priceAggregatorAddress });
  // 状态管理
  const [tradingState, setTradingState] = useState<TradingState>({
    buyAmount: "100",
    slippage: 5,
    customSlippage: "",
    showCustomSlippage: false,
    showDropdown: false,
    usdtBalance: 0n,
    allowance: 0n,
    needsApproval: true,
    transactionStatus: 'idle',
    transactionHash: null,
    priceData: null,
    updateData: null,
    updateFee: 0n,
  });

  // 更新状态的辅助函数
  const updateState = useCallback((updates: Partial<TradingState>) => {
    setTradingState(prev => ({ ...prev, ...updates }));
  }, []);

  // 获取预言机更新数据和费用
  const fetchUpdateDataAndFee = useCallback(async (symbols: string[]) => {
    console.log("🔍 fetchUpdateDataAndFee 调用:", { symbols, publicClient: !!publicClient, chain: chain?.name });
    if (!publicClient || !chain) {
      throw new Error("客户端或链信息未初始化");
    }

    try {
      // 获取当前网络的 oracleAggregator 地址
      const networkConfig = getNetworkConfig(chain.id);
      const oracleAggregatorAddress = networkConfig.contracts.oracleAggregator as Address;
      console.log("🐛 网络配置:", {
        chainId: chain.id,
        chainName: chain.name,
        oracleAggregatorAddress
      });

      console.log("🔍 获取预言机更新数据:", { symbols, oracleAggregatorAddress });

      // 1. 获取 Pyth 更新数据
      const updateData = await getPythUpdateData(symbols);

      console.log("🐛 Pyth 更新数据:", {
        hasData: !!updateData,
        dataLength: updateData?.length || 0,
        rawData: updateData
      });

      if (!updateData || updateData.length === 0) {
        throw new Error("无法获取价格更新数据");
      }

      console.log("✅ 获取到 Pyth 更新数据:", {
        dataLength: updateData.length,
        updateData: updateData.map((data, index) => ({
          index,
          size: data.length,
          preview: data.slice(0, 20) + "..."
        }))
      });

      // 2. 获取更新费用
      console.log("💰 计算预言机更新费用...");

      const updateFee = await publicClient.readContract({
        address: pythPriceFeedAddress,
        abi: PYTH_PRICE_FEED_ABI,
        functionName: "getUpdateFee",
        args: [updateData]
      }) as bigint;

      let feeBigInt = BigInt(updateFee);

      console.log("🐛 预言机费用详情:", {
        rawFee: updateFee,
        feeBigInt: feeBigInt.toString(),
        feeEth: formatEther(feeBigInt),
        feeUsd: parseFloat(formatEther(feeBigInt)) * 2000,
        isZero: feeBigInt === 0n
      });

     

      // 添加额外的缓冲费用 (0.001 ETH) 以应对 Gas 费用波动
      const totalFee = feeBigInt;


      console.log("💰 预言机更新费用:", {
        rawUpdateFee: feeBigInt.toString(),
        updateFeeEth: formatEther(feeBigInt),
        totalFee: totalFee.toString(),
        totalFeeEth: formatEther(totalFee),
        totalFeeUsd: parseFloat(formatEther(totalFee)) * 2000 // 假设 ETH 价格为 $2000
      });

      return {
        updateData: [updateData as `0x${string}`[], []], // Convert to nested array format
        updateFee: feeBigInt, // 返回原始预言机费用（不包括缓冲）
        totalFee: totalFee    // 返回总费用（包括缓冲）
      };
    } catch (error) {
      console.error("❌ 获取预言机数据失败:", error);
      throw new Error(`获取预言机数据失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [publicClient, chain]);

  // 获取用户信息（余额和授权额度）
  const fetchUserInfo = useCallback(async () => {
    if (!isConnected || !address || !publicClient) {
      return;
    }

    try {
      // 获取USDT余额
      const balance = await publicClient.readContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;

      const balanceBigInt = BigInt(balance);
      setTradingState(prev => ({ ...prev, usdtBalance: balanceBigInt }));

      // 获取授权额度 - 授权给当前选择的代币合约
      const approval = await publicClient.readContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "allowance",
        args: [address, token.address],
      }) as bigint;

      const approvalBigInt = BigInt(approval);
      setTradingState(prev => ({ ...prev, allowance: approvalBigInt }));

      // 检查是否需要授权
      const buyAmountWei = parseUnits(tradingState.buyAmount || "0", 6);
      const needsApproval = approvalBigInt < buyAmountWei;
      setTradingState(prev => ({ ...prev, needsApproval }));
    } catch (error) {
      console.error("获取用户信息失败:", error);
    }
  }, [isConnected, address, publicClient, usdtAddress, stockTokenImplAddress, tradingState.buyAmount]);

  // 获取价格数据
  const fetchPriceData = useCallback(async () => {
    try {
      console.log(`🔄 开始获取 ${token.symbol} 价格数据...`);
      const priceDataArray = await getPriceInfo([token.symbol]);
      console.log(`📊 ${token.symbol} 价格数据获取结果:`, priceDataArray);

      const priceDataString = priceDataArray[0];
      if (priceDataString) {
        // 假设 getPriceInfo 返回的是价格字符串，转换为 TradingState 接口格式
        const price = parseFloat(priceDataString) || 100;
        const formattedPriceData = {
          price: price.toString(),
          conf: '1',
          expo: -2,
          publish_time: Date.now(),
          formatted: {
            price: price.toFixed(2),
            conf: '0.01',
            confidence: '1.00%'
          }
        };
        setTradingState(prev => ({ ...prev, priceData: formattedPriceData }));
        console.log(`✅ ${token.symbol} 价格数据已设置`);
      } else {
        console.warn(`⚠️ ${token.symbol} 价格数据为空，使用默认价格`);
        // 设置默认价格数据
        const defaultPriceData = {
          price: '100',
          conf: '1',
          expo: -2,
          publish_time: Date.now(),
          formatted: {
            price: '1.00',
            conf: '0.01',
            confidence: '1.00%'
          }
        };
        setTradingState(prev => ({ ...prev, priceData: defaultPriceData }));
      }
    } catch (error) {
      console.error(`❌ 获取 ${token.symbol} 价格失败:`, error);
      // 设置默认价格数据作为 fallback
      const defaultPriceData = {
        price: '100',
        conf: '1',
        expo: -2,
        publish_time: Date.now(),
        formatted: {
          price: '1.00',
          conf: '0.01',
          confidence: '1.00%'
        }
      };
      setTradingState(prev => ({ ...prev, priceData: defaultPriceData }));
    }
  }, [token.symbol]);

  // 获取 Pyth 价格更新数据 (使用缓存)
  const fetchPythData = useCallback(async () => {
    const { getCachedData, setPythData, setLoading, setError, isDataExpired } = usePythStore.getState();

    try {
      console.log(`🔄 检查 ${token.symbol} 的 Pyth 数据缓存...`);

      // 首先检查缓存
      const cachedData = getCachedData(token.symbol);
      if (cachedData) {
        console.log(`✅ 使用 ${token.symbol} 的缓存数据`);
        setTradingState(prev => ({
          ...prev,
          updateData: [cachedData as `0x${string}`[], []], // Convert to nested array format
          updateFee: 0n
        }));
        return;
      }

      console.log(`⚠️ ${token.symbol} 缓存过期或不存在，重新获取...`);
      setLoading(token.symbol, true);

      const updateData = await fetchUpdateData([token.symbol]);

      if (updateData && updateData.length > 0) {
        console.log(`✅ 成功获取 ${updateData.length} 条更新数据，已缓存`);
        setPythData(token.symbol, updateData, 0n);
        setTradingState(prev => ({
          ...prev,
          updateData: [updateData as `0x${string}`[], []], // Convert to nested array format
          updateFee: 0n
        }));
      } else {
        console.warn("⚠️ 未获取到有效的价格更新数据");
        setError(token.symbol, "未获取到有效的价格更新数据");
      }
    } catch (error) {
      console.error("❌ 获取 Pyth 数据失败:", error);
      setError(token.symbol, error instanceof Error ? error.message : "未知错误");
    } finally {
      setLoading(token.symbol, false);
    }
  }, [token.symbol]);

  // 计算最小代币数量（使用合约预估函数）
  const calculateMinTokenAmount = useCallback(async () => {
    if (!publicClient || !stockTokenImplAddress) return { estimatedTokens: 0n, minTokenAmount: 0n };

    const buyAmount = parseFloat(tradingState.buyAmount) || 0;
    if (buyAmount <= 0) return { estimatedTokens: 0n, minTokenAmount: 0n };

    try {
      const buyAmountWei = parseUnits(tradingState.buyAmount, 6);
      console.log("🔍 调用合约 getBuyEstimate:", {
        buyAmountWei: buyAmountWei.toString(),
        buyAmount: tradingState.buyAmount,
        slippage: tradingState.slippage
      });

      let estimatedTokens: bigint;
      let estimatedFee: bigint = 0n;

      try {
        // 首先尝试调用合约的 getBuyEstimate 函数
        console.log("🔍 尝试调用合约 getBuyEstimate...");
        const result = await publicClient.readContract({
          // address: stockTokenImplAddress,
          address:token.address,
          abi: STOCK_TOKEN_ABI,
          functionName: "getBuyEstimate",
          args: [buyAmountWei]
        }) as [bigint, bigint];

        estimatedTokens = result[0];
        estimatedFee = result[1];

        console.log("📊 合约预估结果:", {
          estimatedTokens: estimatedTokens.toString(),
          estimatedTokensFormatted: formatEther(estimatedTokens),
          estimatedFee: estimatedFee.toString(),
          estimatedFeeFormatted: formatEther(estimatedFee)
        });
      } catch (contractError) {
        console.warn("⚠️ 合约 getBuyEstimate 调用失败，使用价格估算:", contractError);

        // 回退到基于价格的估算
        let pricePerShare = 0;

        if (tradingState.priceData && tradingState.priceData.price) {
          pricePerShare = parseFloat(tradingState.priceData.price);
          console.log("📊 使用状态中的价格数据:", pricePerShare);
        } else {
          // 如果没有价格数据，使用默认价格（假设 $100 per share）
          pricePerShare = 100;
          console.warn("⚠️ 没有价格数据，使用默认价格 $100 进行估算");
        }

        if (pricePerShare <= 0) {
          // 如果解析出的价格无效，使用默认价格
          pricePerShare = 100;
          console.warn("⚠️ 价格数据无效，使用默认价格 $100 进行估算");
        }

        const buyAmount = parseFloat(tradingState.buyAmount) || 0;
        if (buyAmount <= 0) {
          throw new Error("购买金额必须大于 0");
        }

        const shares = buyAmount / pricePerShare;
        estimatedTokens = parseUnits(shares.toFixed(6), 18);
        estimatedFee = 0n;

        console.log("📊 价格估算结果:", {
          pricePerShare,
          buyAmount,
          estimatedShares: shares,
          estimatedTokens: estimatedTokens.toString(),
          estimatedTokensFormatted: formatEther(estimatedTokens),
          note: tradingState.priceData ? "使用获取的价格数据" : "使用默认价格数据"
        });
      }

      // 应用滑点保护 - 简化计算逻辑
      const slippagePercentage = BigInt(100 - tradingState.slippage);
      const minTokenAmount = (estimatedTokens * slippagePercentage) / 100n;

      console.log("🛡️ 应用滑点保护:", {
        original: formatEther(estimatedTokens),
        slippagePercent: tradingState.slippage,
        slippageMultiplier: slippagePercentage.toString(),
        minAmount: formatEther(minTokenAmount),
        calculation: `(${estimatedTokens} * ${slippagePercentage}) / 100 = ${minTokenAmount}`,
        reduction: `${tradingState.slippage}%`
      });

      return { estimatedTokens, minTokenAmount };
    } catch (error) {
      console.error("❌ 计算最小代币数量完全失败:", error);

      // 给出详细的错误信息
      let errorMessage = "无法计算预期获得的代币数量";
      if (error instanceof Error) {
        if (error.message.includes("无法获取价格数据进行估算")) {
          errorMessage = "价格数据获取失败，请重试或联系客服";
        } else if (error.message.includes("购买金额必须大于 0")) {
          errorMessage = "请输入有效的购买金额";
        } else {
          errorMessage = `计算失败: ${error.message}`;
        }
      }

      throw new Error(errorMessage);
    }
  }, [publicClient, stockTokenImplAddress, tradingState.buyAmount, tradingState.slippage, tradingState.priceData]);

  // 授权USDT
  const approveUSDT = useCallback(async (): Promise<TradingResult> => {
    if (!isConnected || !address) {
      return {
        success: false,
        error: "钱包未连接"
      };
    }

    updateState({ transactionStatus: 'approving' });

    try {
      const client = getWalletClient();
      const maxApprovalAmount = maxUint256;

      const hash = await client.writeContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "approve",
        args: [token.address, maxApprovalAmount],
        account: address,
        chain,
      });

      updateState({ transactionHash: hash });

      // 等待交易确认
      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
      });

      if (receipt?.status === 'success') {
        // 重新获取授权额度
        await fetchUserInfo();
        updateState({ transactionStatus: 'idle' });

        return {
          success: true,
          hash
        };
      } else {
        throw new Error('交易失败');
      }
    } catch (error: unknown) {
      updateState({ transactionStatus: 'error' });
      console.error("授权失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "授权失败"
      };
    }
  }, [isConnected, address, getWalletClient, usdtAddress, stockTokenImplAddress, chain, publicClient, fetchUserInfo, updateState]);

  // 执行买入
  const buyTokens = useCallback(async (): Promise<TradingResult> => {
    console.log("🐛 buyTokens 调用:", {
      isConnected,
      address,
      buyAmount: tradingState.buyAmount,
      usdtBalance: formatUnits(tradingState.usdtBalance, 6),
      needsApproval: tradingState.needsApproval
    });

    if (!isConnected || !address) {
      return {
        success: false,
        error: "钱包未连接"
      };
    }

    if (!tradingState.buyAmount || parseFloat(tradingState.buyAmount) <= 0) {
      return {
        success: false,
        error: "金额错误"
      };
    }

    const buyAmountWei = parseUnits(tradingState.buyAmount, 6);

    console.log("🐛 余额检查:", {
      buyAmount: tradingState.buyAmount,
      buyAmountWei: buyAmountWei.toString(),
      usdtBalance: tradingState.usdtBalance.toString(),
      hasEnoughBalance: tradingState.usdtBalance >= buyAmountWei
    });

    if (tradingState.usdtBalance < buyAmountWei) {
      return {
        success: false,
        error: "USDT余额不足"
      };
    }

    updateState({ transactionStatus: 'buying' });

    // 初始化变量以便在错误处理中访问
    let pythUpdateData: string[] = [];
    let redStoneData: any = null;
    let updateDataArray: `0x${string}`[][] = [];
    let currentUpdateFee: bigint = 0n;

    try {
      console.log("🔄 开始购买流程，获取最新价格数据...");

      // 1. 首先确保有价格数据
      console.log(`🔍 确保 ${token.symbol} 的价格数据已获取...`);
      if (!tradingState.priceData) {
        console.log("⚠️ 价格数据为空，重新获取...");
        await fetchPriceData();
      }

      // 再次检查价格数据
      if (!tradingState.priceData) {
        throw new Error("无法获取价格数据，请重试");
      }

      console.log("✅ 价格数据已确认:", tradingState.priceData);

      // 2. 获取 Pyth 和 RedStone 数据
      console.log(`🔍 获取 ${token.symbol} 的 Pyth 和 RedStone 数据...`);

      pythUpdateData = await fetchUpdateData([token.symbol]);
      console.log("✅ Pyth 数据获取成功");

      // 验证和格式化 Pyth 数据
      const validatedPythUpdateData = pythUpdateData
        .map((data, index) => {
          try {
            return validateAndFormatHex(data, `Pyth 数据 [${index}]`);
          } catch (error) {
            console.warn(`⚠️ 跳过无效的 Pyth 数据 [${index}]:`, error);
            return null;
          }
        })
        .filter((data): data is `0x${string}` => data !== null);

      if (validatedPythUpdateData.length === 0) {
        throw new Error("获取的 Pyth 数据无效或为空");
      }

      console.log("✅ Pyth 数据验证完成:", {
        originalLength: pythUpdateData.length,
        validatedLength: validatedPythUpdateData.length,
        sampleData: validatedPythUpdateData[0]?.slice(0, 20) + "..."
      });

      // 获取 RedStone 数据
      redStoneData = await getRedStoneUpdateData(token.symbol);

      if (redStoneData.updateData === "0x") {
        console.log("⚠️ RedStone 数据为空，使用空数据继续交易");
      } else {
        console.log("✅ RedStone 数据获取成功");
      }

      // 验证 RedStone 数据
      let validatedRedStoneData: `0x${string}`;
      try {
        validatedRedStoneData = validateAndFormatHex(redStoneData.updateData, "RedStone 数据");
      } catch (error) {
        console.warn(`⚠️ RedStone 数据无效，使用空数据:`, error);
        validatedRedStoneData = "0x" as `0x${string}`;
      }

      // 组装 updateDataArray - 严格按照测试文件的格式
      updateDataArray = [
        pythUpdateData,                    // 使用原始 Pyth 数据 (bytes[])
        [redStoneData.updateData]         // RedStone 的 payload 包装成数组
      ];

      console.log("🐛 预言机数据组装完成:", {
        pythDataLength: validatedPythUpdateData?.length || 0,
        redstoneDataLength: validatedRedStoneData.length,
        redstoneDataIsEmpty: validatedRedStoneData === "0x",
        updateDataArrayLength: updateDataArray.length
      });

      // 3. 使用 PythPriceFeed 获取更新费用（按照测试用例的方式）
      console.log("📈 获取更新费用...");

      // 使用 PythPriceFeed 合约获取费用
      let updateFee: bigint;
      try {
        console.log("🔍 调用 getUpdateFee，参数:", validatedPythUpdateData);
        updateFee = await publicClient.readContract({
          address: pythPriceFeedAddress,
          abi: PYTH_PRICE_FEED_ABI,
          functionName: "getUpdateFee",
          args: [validatedPythUpdateData]
        }) as bigint;
        console.log("✅ getUpdateFee 调用成功:", updateFee.toString());
      } catch (error) {
        console.error("❌ getUpdateFee 调用失败:", error);
        if (error instanceof Error && error.message.includes("hex_.replace")) {
          throw new Error(`getUpdateFee 调用中的 hex 数据错误: ${error.message}`);
        }
        throw error;
      }

      console.log("💰 PythPriceFeed 更新费用:", {
        updateFee: updateFee.toString(),
        updateFeeEth: formatEther(updateFee)
      });

      // 在调用 getAggregatedPrice 之前验证参数
      console.log("🔍 验证 getAggregatedPrice 调用参数:");
      console.log("token.symbol 类型:", typeof token.symbol, "值:", token.symbol);
      console.log("updateDataArray 类型:", typeof updateDataArray, "长度:", updateDataArray.length);

      // 验证 updateDataArray 的每个元素在调用之前
      const validatedUpdateDataArray = updateDataArray.map((subArray, arrayIndex) => {
        if (Array.isArray(subArray)) {
          return subArray.map((hexData, dataIndex) => {
            try {
              return validateAndFormatHex(hexData, `getAggregatedPrice 参数 [${arrayIndex}][${dataIndex}]`);
            } catch (error) {
              console.error(`❌ getAggregatedPrice 参数验证失败 [${arrayIndex}][${dataIndex}]:`, error);
              throw new Error(`getAggregatedPrice 参数包含无效的十六进制数据: ${error}`);
            }
          });
        }
        return subArray;
      });

      console.log("✅ getAggregatedPrice 参数验证完成");

      // 获取当前聚合价格用于计算最小代币数量（按照测试文件方式）
      let currentPrice: bigint;
      try {
        console.log("🔍 调用 getAggregatedPrice，参数:", token.symbol, validatedUpdateDataArray);
        // 严格按照测试文件方式：使用 staticCall 并传递 updateFee
        currentPrice = await publicClient.readContract({
          address: priceAggregatorAddress,
          abi: PRICE_AGGREGATOR_ABI,
          functionName: "getAggregatedPrice",
          args: [token.symbol, validatedUpdateDataArray]
        }) as bigint;
        console.log("✅ getAggregatedPrice 调用成功:", currentPrice.toString());
      } catch (error) {
        console.error("❌ getAggregatedPrice 调用失败:", error);
        if (error instanceof Error && error.message.includes("hex_.replace")) {
          throw new Error(`getAggregatedPrice 调用中的 hex 数据错误: ${error.message}`);
        }
        throw error;
      }

      console.log("📈 当前聚合价格:", {
        price: currentPrice.toString(),
        priceFormatted: formatEther(currentPrice),
        priceUSD: parseFloat(formatEther(currentPrice))
      });

      console.log("🐛 预言机数据获取完成:", {
        updateDataLength: validatedPythUpdateData.length,
        updateFee: updateFee.toString(),
        updateFeeEth: formatEther(updateFee)
      });
      // 调用合约 合约地址 /Users/lijinhai/Desktop/my_project/CryptoStock/stock-fe/lib/abi/PriceAggregator.json 
      // 地址  /Users/lijinhai/Desktop/my_project/CryptoStock/stock-fe/lib/abi/deployments-uups-sepolia.json  PriceAggregator
      // 可以看测试文件 /Users/lijinhai/Desktop/my_project/CryptoStock/CryptoStockContract/test/12-PriceOracle-AAPL.test.js 看     const pythResult = await pythPriceFeed.getPrice.staticCall(pythParams, { value: updateFee }); 调用  // 8. 获取当前价格用于计算最小代币数量
        // const currentPrice = await priceAggregator.getAggregatedPrice.staticCall(
        //   TEST_SYMBOL, 
        //   updateDataArray, 
        //   { value: updateFee }
        // );
        
    

      // 4. 更新状态中的数据
      setTradingState(prev => ({
        ...prev,
        updateData: updateDataArray,
        updateFee: updateFee,
        priceData: {
          price: currentPrice.toString(),
          conf: '1',
          expo: -18,
          publish_time: Date.now(),
          formatted: {
            price: formatEther(currentPrice),
            conf: '0.01',
            confidence: '1.00%'
          }
        }
      }));

      // 直接使用获取到的数据，不依赖状态更新
      const currentUpdateDataArray = updateDataArray;
      currentUpdateFee = updateFee;

      console.log("🐛 数据验证:", {
        updateDataFromFunction: !!updateDataArray,
        updateDataLength: updateDataArray?.length || 0,
        updateDataType: typeof updateDataArray,
        updateDataArray: Array.isArray(updateDataArray),
        currentUpdateFee: currentUpdateFee.toString(),
        currentUpdateFeeEth: formatEther(currentUpdateFee)
      });

      console.log("✅ 获取到最新的价格更新数据:", {
        dataLength: currentUpdateDataArray.length,
        updateFee: currentUpdateFee.toString(),
        updateFeeEth: formatEther(currentUpdateFee),
        currentPrice: formatEther(currentPrice),
        timestamp: new Date().toISOString()
      });

      // 严格按照测试文件流程计算购买参数
      console.log("🔄 严格按照测试文件流程计算购买参数...");

      const buyAmountWei = parseUnits(tradingState.buyAmount, 6);

      // 按照测试文件第 448-454 行的公式计算
      // tokenAmountBeforeFee = (usdtAmount * 1e30) / stockPrice
      const tokenAmountBeforeFee = (buyAmountWei * ethers.parseEther("1000000000000")) / currentPrice; // 1e30 = 1e18 * 1e12
      const tradeFeeRate = 30n; // 0.3% = 30 基点（与测试文件一致）
      const feeAmount = (tokenAmountBeforeFee * tradeFeeRate) / 10000n;
      const expectedTokenAmount = tokenAmountBeforeFee - feeAmount;
      const minTokenAmount = expectedTokenAmount * 90n / 100n; // 允许10%滑点，与测试文件一致

      console.log("📊 测试文件公式计算结果:", {
        buyAmountWei: buyAmountWei.toString(),
        currentPrice: currentPrice.toString(),
        tokenAmountBeforeFee: tokenAmountBeforeFee.toString(),
        tradeFeeRate: tradeFeeRate.toString(),
        feeAmount: feeAmount.toString(),
        expectedTokenAmount: expectedTokenAmount.toString(),
        minTokenAmount: minTokenAmount.toString(),
        expectedTokenAmountFormatted: formatEther(expectedTokenAmount),
        minTokenAmountFormatted: formatEther(minTokenAmount)
      });

      console.log("🧪 动态计算参数详情:", {
        buyAmount: buyAmountWei.toString(),
        buyAmountFormatted: formatUnits(buyAmountWei, 6),
        minTokenAmount: minTokenAmount.toString(),
        minTokenAmountFormatted: formatEther(minTokenAmount),
        updateDataLength: currentUpdateDataArray?.length || 0,
        updateFee: currentUpdateFee.toString(),
        updateFeeEth: formatEther(currentUpdateFee)
      });

      // 检查用户余额是否足够
      if (tradingState.usdtBalance < buyAmountWei) {
        throw new Error(`USDT余额不足! 需要: ${formatUnits(buyAmountWei, 6)}, 可用: ${formatUnits(tradingState.usdtBalance, 6)}`);
      }

      console.log("💰 准备执行买入交易:", {
        buyAmountWei: buyAmountWei.toString(),
        minTokenAmount: minTokenAmount.toString(),
        updateDataLength: currentUpdateDataArray?.length || 0,
        updateFee: currentUpdateFee.toString()
      });

      const client = getWalletClient();

      // 检查用户 ETH 余额是否足够支付预言机费用
      try {
        if (!publicClient) {
          throw new Error("Public client not available");
        }
        const ethBalance = await publicClient.getBalance({ address });

        console.log("🐛 用户 ETH 余额检查:", {
          ethBalance: ethBalance.toString(),
          ethBalanceFormatted: formatEther(ethBalance),
          requiredFee: currentUpdateFee.toString(),
          requiredFeeFormatted: formatEther(currentUpdateFee),
          hasEnoughEth: ethBalance >= currentUpdateFee,
          shortfall: ethBalance < currentUpdateFee ?
            formatEther(currentUpdateFee - ethBalance) : "0"
        });

        if (ethBalance < currentUpdateFee) {
          throw new Error(`ETH余额不足! 需要: ${formatEther(currentUpdateFee)} ETH, 可用: ${formatEther(ethBalance)} ETH, 缺少: ${formatEther(currentUpdateFee - ethBalance)} ETH`);
        }
      } catch (balanceError) {
        console.warn("⚠️ 无法检查 ETH 余额:", balanceError);
        // 继续执行，但会在合约调用时失败
      }

      // 检查 USDT 授权 (仍然需要检查)
      console.log("🐛 USDT 授权检查:", {
        allowance: tradingState.allowance.toString(),
        allowanceFormatted: formatUnits(tradingState.allowance, 6),
        buyAmountWei: buyAmountWei.toString(),
        buyAmountFormatted: formatUnits(buyAmountWei, 6),
        hasEnoughAllowance: tradingState.allowance >= buyAmountWei
      });

      if (tradingState.allowance < buyAmountWei) {
        throw new Error(`USDT授权不足! 需要: ${formatUnits(buyAmountWei, 6)}, 可用: ${formatUnits(tradingState.allowance, 6)}`);
      }

      console.log("📝 准备执行合约调用:", [
          buyAmountWei,               // 参数1: USDT金额 (动态计算)
          minTokenAmount,             // 参数2: 最小代币数量 (动态计算)
          currentUpdateDataArray || []     // 参数3: 价格更新数据 (动态获取)
      ]);

      console.log("🐛 合约调用参数 (动态模式):", {
        tokenAddress: token.address,
        functionName: "buy",
        args: [
          {
            name: "USDT金额",
            value: buyAmountWei.toString(),
            formatted: formatUnits(buyAmountWei, 6),
            source: "动态计算"
          },
          {
            name: "最小代币数量",
            value: minTokenAmount.toString(),
            formatted: formatEther(minTokenAmount),
            source: "动态计算"
          },
          {
            name: "价格更新数据",
            value: currentUpdateDataArray,
            length: currentUpdateDataArray?.length || 0,
            source: "动态获取"
          }
        ],
        msgValue: {
          value: currentUpdateFee.toString(),
          formatted: formatEther(currentUpdateFee),
          description: "预言机更新费用 (动态计算)"
        },
        account: address,
        chain: chain?.name
      });

      // 打印对比测试值和动态计算值
      console.log("🔍 参数对比:");
      console.log("测试值 USDT金额:", BigInt(BUY_PARAMS.usdtAmount).toString(), formatUnits(BigInt(BUY_PARAMS.usdtAmount), 6));
      console.log("动态计算 USDT金额:", buyAmountWei.toString(), formatUnits(buyAmountWei, 6));
      console.log("测试值 最小代币数量:", BigInt(BUY_PARAMS.minTokenAmount).toString(), formatEther(BigInt(BUY_PARAMS.minTokenAmount)));
      console.log("动态计算 最小代币数量:", minTokenAmount.toString(), formatEther(minTokenAmount));
      // 验证所有参数类型
      console.log("🔍 最终参数类型验证:");
      console.log("buyAmountWei 类型:", typeof buyAmountWei, "值:", buyAmountWei);
      console.log("minTokenAmount 类型:", typeof minTokenAmount, "值:", minTokenAmount);
      console.log("currentUpdateDataArray 类型:", typeof currentUpdateDataArray, "值:", currentUpdateDataArray);
      console.log("currentUpdateFee 类型:", typeof currentUpdateFee, "值:", currentUpdateFee);
      console.log("address 类型:", typeof address, "值:", address);

      // 详细验证 updateDataArray 的每个元素
      console.log("🔍 详细验证 updateDataArray:");
      currentUpdateDataArray.forEach((subArray, arrayIndex) => {
        console.log(`数组 ${arrayIndex}:`, {
          type: typeof subArray,
          length: subArray?.length,
          isArray: Array.isArray(subArray),
          contents: subArray
        });

        if (Array.isArray(subArray)) {
          subArray.forEach((hexData, dataIndex) => {
            console.log(`  [${arrayIndex}][${dataIndex}]:`, {
              value: hexData,
              type: typeof hexData,
              isHex: isValidHex(hexData),
              length: hexData?.length,
              startsWith0x: hexData?.startsWith('0x')
            });

            // 使用我们的验证函数
            try {
              const validatedHex = validateAndFormatHex(hexData, `updateDataArray[${arrayIndex}][${dataIndex}]`);
              console.log(`  ✅ [${arrayIndex}][${dataIndex}] 验证通过:`, validatedHex.slice(0, 20) + "...");
            } catch (validationError) {
              console.error(`  ❌ [${arrayIndex}][${dataIndex}] 验证失败:`, validationError);
              throw new Error(`updateDataArray[${arrayIndex}][${dataIndex}] 包含无效的十六进制数据: ${validationError}`);
            }
          });
        }
      });

      // 确保 currentUpdateFee 是 bigint
      const finalUpdateFee = typeof currentUpdateFee === 'string' ? BigInt(currentUpdateFee) : currentUpdateFee;
      console.log("finalUpdateFee 类型:", typeof finalUpdateFee, "值:", finalUpdateFee);

      // 根据测试用例执行购买交易
      console.log("🚀 执行购买交易...");
      let hash: `0x${string}`;
      try {
        // 最终验证和格式化所有 writeContract 参数
        console.log("🔍 最终验证 writeContract 参数...");

        // 验证并格式化地址
        console.log("🔍 验证代币地址...");
        const validatedAddress = token.address;
        console.log("   原始地址:", validatedAddress);
        console.log("   类型:", typeof validatedAddress);
        console.log("   长度:", validatedAddress?.length);
        console.log("   是否以0x开头:", validatedAddress?.startsWith('0x'));
        if (!validatedAddress || !validatedAddress.startsWith('0x') || validatedAddress.length !== 42) {
          throw new Error(`无效的代币地址: ${validatedAddress}`);
        }
        console.log("✅ 代币地址验证通过");

        // 验证并格式化账户地址
        console.log("🔍 验证账户地址...");
        const validatedAccount = address;
        console.log("   原始地址:", validatedAccount);
        console.log("   类型:", typeof validatedAccount);
        console.log("   长度:", validatedAccount?.length);
        console.log("   是否以0x开头:", validatedAccount?.startsWith('0x'));
        if (!validatedAccount || !validatedAccount.startsWith('0x') || validatedAccount.length !== 42) {
          throw new Error(`无效的账户地址: ${validatedAccount}`);
        }
        console.log("✅ 账户地址验证通过");

        // 确保 buyAmountWei 是 bigint
        console.log("🔍 验证购买金额...");
        console.log("   原始值:", buyAmountWei);
        console.log("   类型:", typeof buyAmountWei);
        const validatedBuyAmountWei = typeof buyAmountWei === 'bigint' ? buyAmountWei : BigInt(buyAmountWei);
        console.log("   转换后:", validatedBuyAmountWei);
        console.log("   转换后类型:", typeof validatedBuyAmountWei);
        console.log("✅ 购买金额验证通过");

        // 确保 minTokenAmount 是 bigint
        console.log("🔍 验证最小代币数量...");
        console.log("   原始值:", minTokenAmount);
        console.log("   类型:", typeof minTokenAmount);
        const validatedMinTokenAmount = typeof minTokenAmount === 'bigint' ? minTokenAmount : BigInt(minTokenAmount);
        console.log("   转换后:", validatedMinTokenAmount);
        console.log("   转换后类型:", typeof validatedMinTokenAmount);
        console.log("✅ 最小代币数量验证通过");

        // 严格按照测试文件方式准备 updateDataArray
        console.log("🔍 按照测试文件方式准备 updateDataArray...");
        console.log("   原始数组:", updateDataArray);
        console.log("   数组长度:", updateDataArray?.length);
        console.log("   第一个元素 (Pyth):", updateDataArray[0]);
        console.log("   第二个元素 (RedStone):", updateDataArray[1]);

        // 直接按照测试文件第 431-434 行的方式构建
        const contractUpdateDataArray = [
          pythUpdateData,                    // Pyth 的原始数据
          [redStoneData.updateData]         // RedStone 的数据包装成数组
        ];

        console.log("✅ 按测试文件方式构建的 updateDataArray:", contractUpdateDataArray);

        // 深度验证 contractUpdateDataArray 中的每个元素
        console.log("🔍 深度验证 contractUpdateDataArray:");
        contractUpdateDataArray.forEach((subArray, arrayIndex) => {
          console.log(`数组 ${arrayIndex}:`, {
            type: typeof subArray,
            isArray: Array.isArray(subArray),
            length: subArray?.length,
            contents: subArray
          });

          if (Array.isArray(subArray)) {
            subArray.forEach((item, itemIndex) => {
              console.log(`  [${arrayIndex}][${itemIndex}]:`, {
                value: item,
                type: typeof item,
                isString: typeof item === 'string',
                isHex: typeof item === 'string' && item.startsWith('0x'),
                length: item?.length,
                preview: typeof item === 'string' ? item.slice(0, 50) + '...' : 'N/A'
              });

              // 强制转换为字符串 if needed
              if (typeof item !== 'string') {
                console.warn(`⚠️ [${arrayIndex}][${itemIndex}] 不是字符串类型，强制转换:`, item);
                subArray[itemIndex] = String(item);
              }
            });
          }
        });

        // 创建一个完全经过验证和清理的数据结构用于合约调用
        const sanitizedContractUpdateDataArray = [
          pythUpdateData.map(item => {
            if (typeof item !== 'string') {
              console.warn("⚠️ Pyth 数据包含非字符串元素，强制转换:", item);
              return String(item);
            }
            return item;
          }),
          [String(redStoneData.updateData)]
        ];

        console.log("✅ 清理后的 contractUpdateDataArray:", sanitizedContractUpdateDataArray);

        // 确保 finalUpdateFee 是 bigint
        console.log("🔍 验证交易费用...");
        console.log("   原始值:", finalUpdateFee);
        console.log("   类型:", typeof finalUpdateFee);
        const validatedValue = typeof finalUpdateFee === 'bigint' ? finalUpdateFee : BigInt(finalUpdateFee);
        console.log("   转换后:", validatedValue);
        console.log("   转换后类型:", typeof validatedValue);
        console.log("✅ 交易费用验证通过");

        console.log("✅ 所有 writeContract 参数验证完成");

        console.log("🔍 调用 writeContract，参数:", {
          address: validatedAddress,
          functionName: "buy",
          args: [
            validatedBuyAmountWei,
            validatedMinTokenAmount,
            sanitizedContractUpdateDataArray
          ],
          account: validatedAccount,
          value: validatedValue
        });

        // 额外验证：在调用前检查所有参数类型
        console.log("🔍 预调用参数类型检查:");
        console.log("  validatedAddress 类型:", typeof validatedAddress);
        console.log("  validatedAccount 类型:", typeof validatedAccount);
        console.log("  validatedBuyAmountWei 类型:", typeof validatedBuyAmountWei);
        console.log("  validatedMinTokenAmount 类型:", typeof validatedMinTokenAmount);
        console.log("  sanitizedContractUpdateDataArray 类型:", typeof sanitizedContractUpdateDataArray);
        console.log("  sanitizedContractUpdateDataArray 长度:", sanitizedContractUpdateDataArray.length);

        // 检查数组结构
        if (Array.isArray(sanitizedContractUpdateDataArray)) {
          sanitizedContractUpdateDataArray.forEach((subArray, index) => {
            console.log(`  数组[${index}] 类型:`, typeof subArray);
            console.log(`  数组[${index}] 长度:`, subArray?.length);
            if (Array.isArray(subArray)) {
              subArray.forEach((hexData, subIndex) => {
                console.log(`    数组[${index}][${subIndex}] 类型:`, typeof hexData);
                console.log(`    数组[${index}][${subIndex}] 值:`, hexData?.slice(0, 50) + "...");
              });
            }
          });
        }

        console.log("🚀 即将调用 client.writeContract...");
        debugger; // 🔍 在浏览器中暂停，可以检查所有参数

        // 严格按照测试文件第 479-484 行的方式调用 buy 函数
        console.log("🚀 严格按照测试文件方式执行购买交易...");
        hash = await client.writeContract({
          address: validatedAddress,
          abi: STOCK_TOKEN_ABI,
          functionName: "buy",
          args: [
            validatedBuyAmountWei,           // 参数1: USDT金额 (purchaseAmount)
            validatedMinTokenAmount,         // 参数2: 最小代币数量 (minTokenAmount)
            sanitizedContractUpdateDataArray // 参数3: 预言机数据 (updateDataArray) - 使用清理后的数据
          ],
          account: validatedAccount,
          chain,
          value: validatedValue,             // 预言机更新费用 (updateFee)
        });

        console.log("✅ writeContract 调用成功:", hash);
      } catch (error) {
        console.error("❌ writeContract 调用失败:", error);
        if (error instanceof Error && error.message.includes("hex_.replace")) {
          throw new Error(`writeContract 调用中的 hex 数据错误: ${error.message}`);
        }
        throw error;
      }

      console.log("🐛 合约调用成功:", {
        transactionHash: hash,
        transactionHashShort: hash.slice(0, 10) + "..." + hash.slice(-8)
      });

      updateState({ transactionHash: hash });

      // 等待交易确认
      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
      });

      if (receipt?.status === 'success') {
        updateState({ transactionStatus: 'success' });

        return {
          success: true,
          hash
        };
      } else {
        throw new Error('交易失败');
      }
    } catch (error: unknown) {
      updateState({ transactionStatus: 'error' });
      console.error("❌ 买入交易失败:", error);

      // 特殊处理 hex_.replace TypeError
      if (error instanceof Error && error.message.includes("hex_.replace is not a function")) {
        console.error("🔍 检测到 hex 数据格式错误，详细信息:");
        console.error("错误堆栈:", error.stack);

        // 记录相关数据状态
        console.error("🐛 调试信息:", {
          pythUpdateData: pythUpdateData ? `长度: ${pythUpdateData.length}` : 'null',
          pythUpdateDataSample: pythUpdateData?.[0] ? pythUpdateData[0].slice(0, 50) : 'N/A',
          redStoneData: redStoneData ? redStoneData.updateData.slice(0, 50) : 'null',
          updateDataArrayLength: updateDataArray?.length || 0,
          currentUpdateFee: currentUpdateFee?.toString() || 'null',
          currentUpdateFeeType: typeof currentUpdateFee,
          currentUpdateFeeValue: currentUpdateFee
        });

        // 返回更具体的错误信息
        return {
          success: false,
          error: "数据格式错误：预言机数据包含无效的十六进制格式"
        };
      }

      // 详细的错误分析和用户友好提示
      let errorMessage = "买入失败";
      let userAction = "";

      const errorObj = error as Error & {
        code?: string;
        reason?: string;
        data?: unknown;
        transaction?: { hash?: string };
        stack?: string;
      };

      console.log("🐛 错误详情:", {
        name: errorObj.name,
        message: errorObj.message,
        code: errorObj.code,
        reason: errorObj.reason,
        data: errorObj.data,
        transactionHash: errorObj.transaction?.hash,
        stack: errorObj.stack ? errorObj.stack.split('\n').slice(0, 3) : 'No stack trace'
      });

      if (errorObj.message) {
        errorMessage = errorObj.message;

        // 分析错误类型并给出用户友好的提示
        if (errorObj.message.includes("insufficient funds")) {
          errorMessage = "账户ETH余额不足";
          userAction = "请为钱包充值足够的ETH来支付Gas费用";
        } else if (errorObj.message.includes("Insufficient fee")) {
          errorMessage = "预言机费用不足";
          userAction = "ETH余额不足以支付预言机更新费用。请充值ETH或联系管理员调整费用设置。";
        } else if (errorObj.message.includes("execution reverted")) {
          errorMessage = "合约执行失败";
          userAction = "请检查：1) 合约代币余额 2) 价格数据是否最新 3) 滑点设置是否合理 4) USDT授权是否足够";
        } else if (errorObj.message.includes("USDT授权不足")) {
          errorMessage = "USDT授权不足";
          userAction = "请先授权USDT代币给合约";
        } else if (errorObj.message.includes("合约代币余额不足")) {
          errorMessage = "合约代币余额不足";
          userAction = "合约中没有足够的代币可供购买";
        } else if (errorObj.message.includes("无法获取最新的价格更新数据")) {
          errorMessage = "价格数据获取失败";
          userAction = "请检查网络连接或重试";
        } else if (errorObj.message.includes("无法计算最小代币数量")) {
          errorMessage = "无法计算预期获得的代币数量";
          userAction = "请检查价格数据是否有效";
        } else if (errorObj.message.includes("call revert exception")) {
          errorMessage = "合约调用失败";
          userAction = "检查交易参数或合约状态";
        }
      }

      // 记录详细错误信息用于调试
      console.error("🔍 买入交易失败详细分析:", {
        errorType: errorObj.name || 'Unknown',
        errorMessage: errorMessage,
        errorCode: errorObj.code,
        errorReason: errorObj.reason,
        errorData: errorObj.data,
        transactionHash: errorObj.transaction?.hash,
        userAction,
        stack: errorObj.stack ? errorObj.stack.split('\n').slice(0, 5) : 'No stack trace'
      });

      // 显示用户友好的提示
      if (userAction) {
        console.log("💡 建议操作:", userAction);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [isConnected, address, getWalletClient, stockTokenImplAddress, tradingState, calculateMinTokenAmount, chain, publicClient, fetchPriceData]);

  // 执行卖出
  const sellTokens = useCallback(async (sellAmount: string): Promise<TradingResult> => {
    console.log("🐛 sellTokens 调用:", {
      isConnected,
      address,
      sellAmount,
      tokenSymbol: token.symbol
    });

    if (!isConnected || !address) {
      return {
        success: false,
        error: "钱包未连接"
      };
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      return {
        success: false,
        error: "卖出金额必须大于0"
      };
    }

    const sellAmountWei = parseUnits(sellAmount, 18); // 代币精度为18

    // 检查用户代币余额
    const tokenBalance = await publicClient.readContract({
      address: token.address,
      abi: STOCK_TOKEN_ABI,
      functionName: "balanceOf",
      args: [address]
    }) as bigint;

    console.log("🐛 代币余额检查:", {
      sellAmount: sellAmount,
      sellAmountWei: sellAmountWei.toString(),
      tokenBalance: tokenBalance.toString(),
      hasEnoughBalance: tokenBalance >= sellAmountWei
    });

    if (tokenBalance < sellAmountWei) {
      return {
        success: false,
        error: "代币余额不足"
      };
    }

    updateState({ transactionStatus: 'buying' }); // 复用购买状态

    // 初始化变量以便在错误处理中访问
    let pythUpdateData: string[] = [];
    let redStoneData: any = null;
    let updateDataArray: `0x${string}`[][] = [];
    let currentUpdateFee: bigint = 0n;

    try {
      console.log("🔄 开始卖出流程，获取最新价格数据...");

      // 1. 首先确保有价格数据
      console.log(`🔍 确保 ${token.symbol} 的价格数据已获取...`);
      if (!tradingState.priceData) {
        console.log("⚠️ 价格数据为空，重新获取...");
        await fetchPriceData();
      }

      // 再次检查价格数据
      if (!tradingState.priceData) {
        throw new Error("无法获取价格数据，请重试");
      }

      console.log("✅ 价格数据已确认:", tradingState.priceData);

      // 2. 获取 Pyth 和 RedStone 数据
      console.log(`🔍 获取 ${token.symbol} 的 Pyth 和 RedStone 数据...`);

      pythUpdateData = await fetchUpdateData([token.symbol]);
      console.log("✅ Pyth 数据获取成功");

      // 验证和格式化 Pyth 数据
      const validatedPythUpdateData = pythUpdateData
        .map((data, index) => {
          try {
            return validateAndFormatHex(data, `Pyth 数据 [${index}]`);
          } catch (error) {
            console.warn(`⚠️ 跳过无效的 Pyth 数据 [${index}]:`, error);
            return null;
          }
        })
        .filter((data): data is `0x${string}` => data !== null);

      if (validatedPythUpdateData.length === 0) {
        throw new Error("获取的 Pyth 数据无效或为空");
      }

      console.log("✅ Pyth 数据验证完成:", {
        originalLength: pythUpdateData.length,
        validatedLength: validatedPythUpdateData.length,
        sampleData: validatedPythUpdateData[0]?.slice(0, 20) + "..."
      });

      // 获取 RedStone 数据
      redStoneData = await getRedStoneUpdateData(token.symbol);

      if (redStoneData.updateData === "0x") {
        console.log("⚠️ RedStone 数据为空，使用空数据继续交易");
      } else {
        console.log("✅ RedStone 数据获取成功");
      }

      // 验证 RedStone 数据
      let validatedRedStoneData: `0x${string}`;
      try {
        validatedRedStoneData = validateAndFormatHex(redStoneData.updateData, "RedStone 数据");
      } catch (error) {
        console.warn(`⚠️ RedStone 数据无效，使用空数据:`, error);
        validatedRedStoneData = "0x" as `0x${string}`;
      }

      // 组装 updateDataArray - 严格按照测试文件的格式
      updateDataArray = [
        pythUpdateData,                    // 使用原始 Pyth 数据 (bytes[])
        [redStoneData.updateData]         // RedStone 的 payload 包装成数组
      ];

      console.log("🐛 预言机数据组装完成:", {
        pythDataLength: validatedPythUpdateData?.length || 0,
        redstoneDataLength: validatedRedStoneData.length,
        redstoneDataIsEmpty: validatedRedStoneData === "0x",
        updateDataArrayLength: updateDataArray.length
      });

      // 3. 使用 PythPriceFeed 获取更新费用（按照测试用例的方式）
      console.log("📈 获取更新费用...");

      // 使用 PythPriceFeed 合约获取费用
      let updateFee: bigint;
      try {
        console.log("🔍 调用 getUpdateFee，参数:", validatedPythUpdateData);
        updateFee = await publicClient.readContract({
          address: pythPriceFeedAddress,
          abi: PYTH_PRICE_FEED_ABI,
          functionName: "getUpdateFee",
          args: [validatedPythUpdateData]
        }) as bigint;
        console.log("✅ getUpdateFee 调用成功:", updateFee.toString());
      } catch (error) {
        console.error("❌ getUpdateFee 调用失败:", error);
        if (error instanceof Error && error.message.includes("hex_.replace")) {
          throw new Error(`getUpdateFee 调用中的 hex 数据错误: ${error.message}`);
        }
        throw error;
      }

      console.log("💰 PythPriceFeed 更新费用:", {
        updateFee: updateFee.toString(),
        updateFeeEth: formatEther(updateFee)
      });

      // 在调用 getAggregatedPrice 之前验证参数
      console.log("🔍 验证 getAggregatedPrice 调用参数:");
      console.log("token.symbol 类型:", typeof token.symbol, "值:", token.symbol);
      console.log("updateDataArray 类型:", typeof updateDataArray, "长度:", updateDataArray.length);

      // 验证 updateDataArray 的每个元素在调用之前
      const validatedUpdateDataArray = updateDataArray.map((subArray, arrayIndex) => {
        if (Array.isArray(subArray)) {
          return subArray.map((hexData, dataIndex) => {
            try {
              return validateAndFormatHex(hexData, `getAggregatedPrice 参数 [${arrayIndex}][${dataIndex}]`);
            } catch (error) {
              console.error(`❌ getAggregatedPrice 参数验证失败 [${arrayIndex}][${dataIndex}]:`, error);
              throw new Error(`getAggregatedPrice 参数包含无效的十六进制数据: ${error}`);
            }
          });
        }
        return subArray;
      });

      console.log("✅ getAggregatedPrice 参数验证完成");

      // 获取当前聚合价格用于计算最小USDT数量（按照测试文件方式）
      let currentPrice: bigint;
      try {
        console.log("🔍 调用 getAggregatedPrice，参数:", token.symbol, validatedUpdateDataArray);
        // 严格按照测试文件方式：使用 staticCall 并传递 updateFee
        currentPrice = await publicClient.readContract({
          address: priceAggregatorAddress,
          abi: PRICE_AGGREGATOR_ABI,
          functionName: "getAggregatedPrice",
          args: [token.symbol, validatedUpdateDataArray]
        }) as bigint;
        console.log("✅ getAggregatedPrice 调用成功:", currentPrice.toString());
      } catch (error) {
        console.error("❌ getAggregatedPrice 调用失败:", error);
        if (error instanceof Error && error.message.includes("hex_.replace")) {
          throw new Error(`getAggregatedPrice 调用中的 hex 数据错误: ${error.message}`);
        }
        throw error;
      }

      console.log("📈 当前聚合价格:", {
        price: currentPrice.toString(),
        priceFormatted: formatEther(currentPrice),
        priceUSD: parseFloat(formatEther(currentPrice))
      });

      // 4. 更新状态中的数据
      setTradingState(prev => ({
        ...prev,
        updateData: updateDataArray,
        updateFee: updateFee,
        priceData: {
          price: currentPrice.toString(),
          conf: '1',
          expo: -18,
          publish_time: Date.now(),
          formatted: {
            price: formatEther(currentPrice),
            conf: '0.01',
            confidence: '1.00%'
          }
        }
      }));

      // 直接使用获取到的数据，不依赖状态更新
      const currentUpdateDataArray = updateDataArray;
      currentUpdateFee = updateFee;

      console.log("✅ 获取到最新的价格更新数据:", {
        dataLength: currentUpdateDataArray.length,
        updateFee: currentUpdateFee.toString(),
        updateFeeEth: formatEther(currentUpdateFee),
        currentPrice: formatEther(currentPrice),
        timestamp: new Date().toISOString()
      });

      // 严格按照测试文件流程计算卖出参数（第 686-690 行）
      console.log("🔄 严格按照测试文件流程计算卖出参数...");

      // 获取合约的交易费率
      const tradeFeeRate = await publicClient.readContract({
        address: token.address,
        abi: STOCK_TOKEN_ABI,
        functionName: "tradeFeeRate"
      }) as bigint;

      // 按照测试文件第 686-690 行的公式计算
      // expectedUsdtBeforeFee = (sellAmount * currentPrice) / 1e12 (转换为6位精度USDT)
      const expectedUsdtBeforeFee = (sellAmountWei * currentPrice) / ethers.parseEther("1000000000000"); // 1e30 = 1e18 * 1e12
      const feeAmount = (expectedUsdtBeforeFee * tradeFeeRate) / 10000n;
      const expectedUsdtAmount = expectedUsdtBeforeFee - feeAmount;
      const minUsdtAmount = expectedUsdtAmount * 90n / 100n; // 允许10%滑点，与测试文件一致

      console.log("📊 测试文件公式计算结果:", {
        sellAmountWei: sellAmountWei.toString(),
        currentPrice: currentPrice.toString(),
        tradeFeeRate: tradeFeeRate.toString(),
        expectedUsdtBeforeFee: expectedUsdtBeforeFee.toString(),
        feeAmount: feeAmount.toString(),
        expectedUsdtAmount: expectedUsdtAmount.toString(),
        minUsdtAmount: minUsdtAmount.toString(),
        expectedUsdtAmountFormatted: formatUnits(expectedUsdtAmount, 6),
        minUsdtAmountFormatted: formatUnits(minUsdtAmount, 6)
      });

      console.log("🧪 动态计算参数详情:", {
        sellAmountWei: sellAmountWei.toString(),
        sellAmountFormatted: formatEther(sellAmountWei),
        minUsdtAmount: minUsdtAmount.toString(),
        minUsdtAmountFormatted: formatUnits(minUsdtAmount, 6),
        updateDataLength: currentUpdateDataArray?.length || 0,
        updateFee: currentUpdateFee.toString(),
        updateFeeEth: formatEther(currentUpdateFee)
      });

      // 检查合约USDT余额是否足够
      const contractUsdtBalance = await publicClient.readContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "balanceOf",
        args: [token.address]
      }) as bigint;

      console.log("🔍 合约USDT余额检查:", {
        contractUsdtBalance: contractUsdtBalance.toString(),
        contractUsdtBalanceFormatted: formatUnits(contractUsdtBalance, 6),
        expectedUsdtAmount: expectedUsdtAmount.toString(),
        expectedUsdtAmountFormatted: formatUnits(expectedUsdtAmount, 6),
        hasEnoughBalance: contractUsdtBalance >= expectedUsdtAmount
      });

      if (contractUsdtBalance < expectedUsdtAmount) {
        throw new Error(`合约USDT余额不足! 需要: ${formatUnits(expectedUsdtAmount, 6)}, 可用: ${formatUnits(contractUsdtBalance, 6)}`);
      }

      console.log("💰 准备执行卖出交易:", {
        sellAmountWei: sellAmountWei.toString(),
        minUsdtAmount: minUsdtAmount.toString(),
        updateDataLength: currentUpdateDataArray?.length || 0,
        updateFee: currentUpdateFee.toString()
      });

      const client = getWalletClient();

      // 检查用户 ETH 余额是否足够支付预言机费用
      try {
        if (!publicClient) {
          throw new Error("Public client not available");
        }
        const ethBalance = await publicClient.getBalance({ address });

        console.log("🐛 用户 ETH 余额检查:", {
          ethBalance: ethBalance.toString(),
          ethBalanceFormatted: formatEther(ethBalance),
          requiredFee: currentUpdateFee.toString(),
          requiredFeeFormatted: formatEther(currentUpdateFee),
          hasEnoughEth: ethBalance >= currentUpdateFee,
          shortfall: ethBalance < currentUpdateFee ?
            formatEther(currentUpdateFee - ethBalance) : "0"
        });

        if (ethBalance < currentUpdateFee) {
          throw new Error(`ETH余额不足! 需要: ${formatEther(currentUpdateFee)} ETH, 可用: ${formatEther(ethBalance)} ETH, 缺少: ${formatEther(currentUpdateFee - ethBalance)} ETH`);
        }
      } catch (balanceError) {
        console.warn("⚠️ 无法检查 ETH 余额:", balanceError);
        // 继续执行，但会在合约调用时失败
      }

      console.log("📝 准备执行合约调用:", [
        sellAmountWei,                // 参数1: 代币数量
        minUsdtAmount,               // 参数2: 最小USDT数量
        currentUpdateDataArray || [] // 参数3: 价格更新数据
      ]);

      console.log("🐛 合约调用参数 (动态模式):", {
        tokenAddress: token.address,
        functionName: "sell",
        args: [
          {
            name: "代币数量",
            value: sellAmountWei.toString(),
            formatted: formatEther(sellAmountWei),
            source: "动态计算"
          },
          {
            name: "最小USDT数量",
            value: minUsdtAmount.toString(),
            formatted: formatUnits(minUsdtAmount, 6),
            source: "动态计算"
          },
          {
            name: "价格更新数据",
            value: currentUpdateDataArray,
            length: currentUpdateDataArray?.length || 0,
            source: "动态获取"
          }
        ],
        msgValue: {
          value: currentUpdateFee.toString(),
          formatted: formatEther(currentUpdateFee),
          description: "预言机更新费用 (动态计算)"
        },
        account: address,
        chain: chain?.name
      });

      // 验证所有参数类型
      console.log("🔍 最终参数类型验证:");
      console.log("sellAmountWei 类型:", typeof sellAmountWei, "值:", sellAmountWei);
      console.log("minUsdtAmount 类型:", typeof minUsdtAmount, "值:", minUsdtAmount);
      console.log("currentUpdateDataArray 类型:", typeof currentUpdateDataArray, "值:", currentUpdateDataArray);
      console.log("currentUpdateFee 类型:", typeof currentUpdateFee, "值:", currentUpdateFee);
      console.log("address 类型:", typeof address, "值:", address);

      // 详细验证 updateDataArray 的每个元素
      console.log("🔍 详细验证 updateDataArray:");
      currentUpdateDataArray.forEach((subArray, arrayIndex) => {
        console.log(`数组 ${arrayIndex}:`, {
          type: typeof subArray,
          length: subArray?.length,
          isArray: Array.isArray(subArray),
          contents: subArray
        });

        if (Array.isArray(subArray)) {
          subArray.forEach((hexData, dataIndex) => {
            console.log(`  [${arrayIndex}][${dataIndex}]:`, {
              value: hexData,
              type: typeof hexData,
              isHex: isValidHex(hexData),
              length: hexData?.length,
              startsWith0x: hexData?.startsWith('0x')
            });

            // 使用我们的验证函数
            try {
              const validatedHex = validateAndFormatHex(hexData, `updateDataArray[${arrayIndex}][${dataIndex}]`);
              console.log(`  ✅ [${arrayIndex}][${dataIndex}] 验证通过:`, validatedHex.slice(0, 20) + "...");
            } catch (validationError) {
              console.error(`  ❌ [${arrayIndex}][${dataIndex}] 验证失败:`, validationError);
              throw new Error(`updateDataArray[${arrayIndex}][${dataIndex}] 包含无效的十六进制数据: ${validationError}`);
            }
          });
        }
      });

      // 确保 currentUpdateFee 是 bigint
      const finalUpdateFee = typeof currentUpdateFee === 'string' ? BigInt(currentUpdateFee) : currentUpdateFee;
      console.log("finalUpdateFee 类型:", typeof finalUpdateFee, "值:", finalUpdateFee);

      // 根据测试用例执行卖出交易（第 712-717 行）
      console.log("🚀 执行卖出交易...");
      let hash: `0x${string}`;
      try {
        // 最终验证和格式化所有 writeContract 参数
        console.log("🔍 最终验证 writeContract 参数...");

        // 验证并格式化地址
        console.log("🔍 验证代币地址...");
        const validatedAddress = token.address;
        console.log("   原始地址:", validatedAddress);
        console.log("   类型:", typeof validatedAddress);
        console.log("   长度:", validatedAddress?.length);
        console.log("   是否以0x开头:", validatedAddress?.startsWith('0x'));
        if (!validatedAddress || !validatedAddress.startsWith('0x') || validatedAddress.length !== 42) {
          throw new Error(`无效的代币地址: ${validatedAddress}`);
        }
        console.log("✅ 代币地址验证通过");

        // 验证并格式化账户地址
        console.log("🔍 验证账户地址...");
        const validatedAccount = address;
        console.log("   原始地址:", validatedAccount);
        console.log("   类型:", typeof validatedAccount);
        console.log("   长度:", validatedAccount?.length);
        console.log("   是否以0x开头:", validatedAccount?.startsWith('0x'));
        if (!validatedAccount || !validatedAccount.startsWith('0x') || validatedAccount.length !== 42) {
          throw new Error(`无效的账户地址: ${validatedAccount}`);
        }
        console.log("✅ 账户地址验证通过");

        // 确保 sellAmountWei 是 bigint
        console.log("🔍 验证卖出金额...");
        console.log("   原始值:", sellAmountWei);
        console.log("   类型:", typeof sellAmountWei);
        const validatedSellAmountWei = typeof sellAmountWei === 'bigint' ? sellAmountWei : BigInt(sellAmountWei);
        console.log("   转换后:", validatedSellAmountWei);
        console.log("   转换后类型:", typeof validatedSellAmountWei);
        console.log("✅ 卖出金额验证通过");

        // 确保 minUsdtAmount 是 bigint
        console.log("🔍 验证最小USDT数量...");
        console.log("   原始值:", minUsdtAmount);
        console.log("   类型:", typeof minUsdtAmount);
        const validatedMinUsdtAmount = typeof minUsdtAmount === 'bigint' ? minUsdtAmount : BigInt(minUsdtAmount);
        console.log("   转换后:", validatedMinUsdtAmount);
        console.log("   转换后类型:", typeof validatedMinUsdtAmount);
        console.log("✅ 最小USDT数量验证通过");

        // 严格按照测试文件方式准备 updateDataArray
        console.log("🔍 按照测试文件方式准备 updateDataArray...");
        console.log("   原始数组:", updateDataArray);
        console.log("   数组长度:", updateDataArray?.length);
        console.log("   第一个元素 (Pyth):", updateDataArray[0]);
        console.log("   第二个元素 (RedStone):", updateDataArray[1]);

        // 直接按照测试文件第 671-675 行的方式构建
        const contractUpdateDataArray = [
          pythUpdateData,                    // Pyth 的原始数据
          [redStoneData.updateData]         // RedStone 的数据包装成数组
        ];

        console.log("✅ 按测试文件方式构建的 updateDataArray:", contractUpdateDataArray);

        // 深度验证 contractUpdateDataArray 中的每个元素
        console.log("🔍 深度验证 contractUpdateDataArray:");
        contractUpdateDataArray.forEach((subArray, arrayIndex) => {
          console.log(`数组 ${arrayIndex}:`, {
            type: typeof subArray,
            isArray: Array.isArray(subArray),
            length: subArray?.length,
            contents: subArray
          });

          if (Array.isArray(subArray)) {
            subArray.forEach((item, itemIndex) => {
              console.log(`  [${arrayIndex}][${itemIndex}]:`, {
                value: item,
                type: typeof item,
                isString: typeof item === 'string',
                isHex: typeof item === 'string' && item.startsWith('0x'),
                length: item?.length,
                preview: typeof item === 'string' ? item.slice(0, 50) + '...' : 'N/A'
              });

              // 强制转换为字符串 if needed
              if (typeof item !== 'string') {
                console.warn(`⚠️ [${arrayIndex}][${itemIndex}] 不是字符串类型，强制转换:`, item);
                subArray[itemIndex] = String(item);
              }
            });
          }
        });

        // 创建一个完全经过验证和清理的数据结构用于合约调用
        const sanitizedContractUpdateDataArray = [
          pythUpdateData.map(item => {
            if (typeof item !== 'string') {
              console.warn("⚠️ Pyth 数据包含非字符串元素，强制转换:", item);
              return String(item);
            }
            return item;
          }),
          [String(redStoneData.updateData)]
        ];

        console.log("✅ 清理后的 contractUpdateDataArray:", sanitizedContractUpdateDataArray);

        // 确保 finalUpdateFee 是 bigint
        console.log("🔍 验证交易费用...");
        console.log("   原始值:", finalUpdateFee);
        console.log("   类型:", typeof finalUpdateFee);
        const validatedValue = typeof finalUpdateFee === 'bigint' ? finalUpdateFee : BigInt(finalUpdateFee);
        console.log("   转换后:", validatedValue);
        console.log("   转换后类型:", typeof validatedValue);
        console.log("✅ 交易费用验证通过");

        console.log("✅ 所有 writeContract 参数验证完成");

        console.log("🔍 调用 writeContract，参数:", {
          address: validatedAddress,
          functionName: "sell",
          args: [
            validatedSellAmountWei,
            validatedMinUsdtAmount,
            sanitizedContractUpdateDataArray
          ],
          account: validatedAccount,
          value: validatedValue
        });

        // 额外验证：在调用前检查所有参数类型
        console.log("🔍 预调用参数类型检查:");
        console.log("  validatedAddress 类型:", typeof validatedAddress);
        console.log("  validatedAccount 类型:", typeof validatedAccount);
        console.log("  validatedSellAmountWei 类型:", typeof validatedSellAmountWei);
        console.log("  validatedMinUsdtAmount 类型:", typeof validatedMinUsdtAmount);
        console.log("  sanitizedContractUpdateDataArray 类型:", typeof sanitizedContractUpdateDataArray);
        console.log("  sanitizedContractUpdateDataArray 长度:", sanitizedContractUpdateDataArray.length);

        // 检查数组结构
        if (Array.isArray(sanitizedContractUpdateDataArray)) {
          sanitizedContractUpdateDataArray.forEach((subArray, index) => {
            console.log(`  数组[${index}] 类型:`, typeof subArray);
            console.log(`  数组[${index}] 长度:`, subArray?.length);
            if (Array.isArray(subArray)) {
              subArray.forEach((hexData, subIndex) => {
                console.log(`    数组[${index}][${subIndex}] 类型:`, typeof hexData);
                console.log(`    数组[${index}][${subIndex}] 值:`, hexData?.slice(0, 50) + "...");
              });
            }
          });
        }

        console.log("🚀 即将调用 client.writeContract...");
        debugger; // 🔍 在浏览器中暂停，可以检查所有参数

        // 严格按照测试文件第 712-717 行的方式调用 sell 函数
        console.log("🚀 严格按照测试文件方式执行卖出交易...");
        hash = await client.writeContract({
          address: validatedAddress,
          abi: STOCK_TOKEN_ABI,
          functionName: "sell",
          args: [
            validatedSellAmountWei,          // 参数1: 代币数量 (sellAmount)
            validatedMinUsdtAmount,          // 参数2: 最小USDT数量 (minUsdtAmount)
            sanitizedContractUpdateDataArray // 参数3: 预言机数据 (updateDataArray) - 使用清理后的数据
          ],
          account: validatedAccount,
          chain,
          value: validatedValue,             // 预言机更新费用 (updateFee)
        });

        console.log("✅ writeContract 调用成功:", hash);
      } catch (error) {
        console.error("❌ writeContract 调用失败:", error);
        if (error instanceof Error && error.message.includes("hex_.replace")) {
          throw new Error(`writeContract 调用中的 hex 数据错误: ${error.message}`);
        }
        throw error;
      }

      console.log("🐛 合约调用成功:", {
        transactionHash: hash,
        transactionHashShort: hash.slice(0, 10) + "..." + hash.slice(-8)
      });

      updateState({ transactionHash: hash });

      // 等待交易确认
      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
      });

      if (receipt?.status === 'success') {
        updateState({ transactionStatus: 'success' });

        return {
          success: true,
          hash
        };
      } else {
        throw new Error('交易失败');
      }
    } catch (error: unknown) {
      updateState({ transactionStatus: 'error' });
      console.error("❌ 卖出交易失败:", error);

      // 特殊处理 hex_.replace TypeError
      if (error instanceof Error && error.message.includes("hex_.replace is not a function")) {
        console.error("🔍 检测到 hex 数据格式错误，详细信息:");
        console.error("错误堆栈:", error.stack);

        // 记录相关数据状态
        console.error("🐛 调试信息:", {
          pythUpdateData: pythUpdateData ? `长度: ${pythUpdateData.length}` : 'null',
          pythUpdateDataSample: pythUpdateData?.[0] ? pythUpdateData[0].slice(0, 50) : 'N/A',
          redStoneData: redStoneData ? redStoneData.updateData.slice(0, 50) : 'null',
          updateDataArrayLength: updateDataArray?.length || 0,
          currentUpdateFee: currentUpdateFee?.toString() || 'null',
          currentUpdateFeeType: typeof currentUpdateFee,
          currentUpdateFeeValue: currentUpdateFee
        });

        // 返回更具体的错误信息
        return {
          success: false,
          error: "数据格式错误：预言机数据包含无效的十六进制格式"
        };
      }

      // 详细的错误分析和用户友好提示
      let errorMessage = "卖出失败";
      let userAction = "";

      const errorObj = error as Error & {
        code?: string;
        reason?: string;
        data?: unknown;
        transaction?: { hash?: string };
        stack?: string;
      };

      console.log("🐛 错误详情:", {
        name: errorObj.name,
        message: errorObj.message,
        code: errorObj.code,
        reason: errorObj.reason,
        data: errorObj.data,
        transactionHash: errorObj.transaction?.hash,
        stack: errorObj.stack ? errorObj.stack.split('\n').slice(0, 3) : 'No stack trace'
      });

      if (errorObj.message) {
        errorMessage = errorObj.message;

        // 分析错误类型并给出用户友好的提示
        if (errorObj.message.includes("insufficient funds")) {
          errorMessage = "账户ETH余额不足";
          userAction = "请为钱包充值足够的ETH来支付Gas费用";
        } else if (errorObj.message.includes("Insufficient fee")) {
          errorMessage = "预言机费用不足";
          userAction = "ETH余额不足以支付预言机更新费用。请充值ETH或联系管理员调整费用设置。";
        } else if (errorObj.message.includes("execution reverted")) {
          errorMessage = "合约执行失败";
          userAction = "请检查：1) 合约USDT余额 2) 价格数据是否最新 3) 滑点设置是否合理 4) 用户代币余额是否足够";
        } else if (errorObj.message.includes("代币余额不足")) {
          errorMessage = "代币余额不足";
          userAction = "请检查您的代币余额";
        } else if (errorObj.message.includes("合约USDT余额不足")) {
          errorMessage = "合约USDT余额不足";
          userAction = "合约中没有足够的USDT用于支付卖出";
        } else if (errorObj.message.includes("无法获取最新的价格更新数据")) {
          errorMessage = "价格数据获取失败";
          userAction = "请检查网络连接或重试";
        } else if (errorObj.message.includes("call revert exception")) {
          errorMessage = "合约调用失败";
          userAction = "检查交易参数或合约状态";
        }
      }

      // 记录详细错误信息用于调试
      console.error("🔍 卖出交易失败详细分析:", {
        errorType: errorObj.name || 'Unknown',
        errorMessage: errorMessage,
        errorCode: errorObj.code,
        errorReason: errorObj.reason,
        errorData: errorObj.data,
        transactionHash: errorObj.transaction?.hash,
        userAction,
        stack: errorObj.stack ? errorObj.stack.split('\n').slice(0, 5) : 'No stack trace'
      });

      // 显示用户友好的提示
      if (userAction) {
        console.log("💡 建议操作:", userAction);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [isConnected, address, getWalletClient, token.address, usdtAddress, tradingState, chain, publicClient, fetchPriceData]);

  // 初始化数据
  const initializeData = useCallback(async () => {
    await Promise.all([
      fetchUserInfo(),
      fetchPriceData(),
      fetchPythData()
    ]);
  }, [fetchUserInfo, fetchPriceData, fetchPythData]);

  // 注意：数据初始化现在在打开购买弹窗时手动调用
  // 这样可以避免在不需要时频繁调用 API

  // 重置状态
  const resetState = useCallback(() => {
    setTradingState({
      buyAmount: "100",
      slippage: 5,
      customSlippage: "",
      showCustomSlippage: false,
      showDropdown: false,
      usdtBalance: 0n,
      allowance: 0n,
      needsApproval: true,
      transactionStatus: 'idle',
      transactionHash: null,
      priceData: null,
      updateData: null,
      updateFee: 0n,
    });
  }, []);

  return {
    // 状态
    tradingState,
    isConnected,
    address,

    // 操作方法
    initializeData,
    approveUSDT,
    buyTokens,
    sellTokens,
    resetState,

    // 更新方法
    updateState,
    fetchUserInfo,

    // 计算属性 (异步获取)
    minTokenAmount: 0n, // 这个值在购买时动态计算

    // 客户端
    publicClient,
    walletClient,
    chain,
  };
};

export default useTokenTrading;