import { useState, useCallback, useEffect } from 'react';
import { Address, formatUnits, parseUnits, maxUint256, formatEther } from 'viem';
import { usePublicClient, useWalletClient } from '@/hooks/usePublicClient';
import { useWallet } from 'ycdirectory-ui';
import { useToast } from '@/hooks/use-toast';
import USDT_TOKEN_ABI from '@/lib/abi/MockERC20.json';
import STOCK_TOKEN_ABI from '@/lib/abi/StockToken.json';
import { fetchStockPrice } from '@/lib/hermes';
import { fetchPythUpdateData } from '@/lib/pyth';
import { usePythStore } from '@/lib/stores/pythStore';

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
  priceData: any;
  updateData: any[] | null;
  updateFee: bigint;
}

export interface TradingResult {
  success: boolean;
  hash?: `0x${string}`;
  error?: string;
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

console.log("🔍 useTokenTrading 初始化:", { isConnected, address });
  // 状态管理
  const [tradingState, setTradingState] = useState<TradingState>({
    buyAmount: "100",
    slippage: 1,
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
      });

      const balanceBigInt = BigInt(balance.toString());
      setTradingState(prev => ({ ...prev, usdtBalance: balanceBigInt }));

      // 获取授权额度
      const approval = await publicClient.readContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "allowance",
        args: [address, token.address],
      });

      const approvalBigInt = BigInt(approval.toString());
      setTradingState(prev => ({ ...prev, allowance: approvalBigInt }));

      // 检查是否需要授权
      const buyAmountWei = parseUnits(tradingState.buyAmount || "0", 6);
      const needsApproval = approvalBigInt < buyAmountWei;
      setTradingState(prev => ({ ...prev, needsApproval }));
    } catch (error) {
      console.error("获取用户信息失败:", error);
    }
  }, [isConnected, address, publicClient, usdtAddress, token.address, tradingState.buyAmount]);

  // 获取价格数据
  const fetchPriceData = useCallback(async () => {
    try {
      console.log(`🔄 开始获取 ${token.symbol} 价格数据...`);
      const priceData = await fetchStockPrice(token.symbol);
      console.log(`📊 ${token.symbol} 价格数据获取结果:`, priceData);

      if (priceData) {
        setTradingState(prev => ({ ...prev, priceData }));
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
          updateData: cachedData,
          updateFee: 0n
        }));
        return;
      }

      console.log(`⚠️ ${token.symbol} 缓存过期或不存在，重新获取...`);
      setLoading(token.symbol, true);

      const updateData = await fetchPythUpdateData([token.symbol]);

      if (updateData && updateData.length > 0) {
        console.log(`✅ 成功获取 ${updateData.length} 条更新数据，已缓存`);
        setPythData(token.symbol, updateData, 0n);
        setTradingState(prev => ({
          ...prev,
          updateData: updateData,
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
    if (!publicClient || !token.address) return 0n;

    const buyAmount = parseFloat(tradingState.buyAmount) || 0;
    if (buyAmount <= 0) return 0n;

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
          address: token.address,
          abi: STOCK_TOKEN_ABI,
          functionName: "getBuyEstimate",
          args: [buyAmountWei]
        });

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
        if (!tradingState.priceData) {
          throw new Error("无法获取价格数据进行估算");
        }

        const pricePerShare = parseFloat(tradingState.priceData.price || "0");
        if (pricePerShare <= 0) {
          throw new Error("价格数据无效");
        }

        const buyAmount = parseFloat(tradingState.buyAmount) || 0;
        const shares = buyAmount / pricePerShare;
        estimatedTokens = parseUnits(shares.toFixed(6), 18);
        estimatedFee = 0n;

        console.log("📊 价格估算结果:", {
          pricePerShare,
          buyAmount,
          estimatedShares: shares,
          estimatedTokens: estimatedTokens.toString(),
          estimatedTokensFormatted: formatEther(estimatedTokens)
        });
      }

      // 应用滑点保护 (默认1% 滑点)
      const minTokenAmount = estimatedTokens * BigInt(Math.floor((100 - tradingState.slippage) * 100) / 100) / 100n;

      console.log("🛡️ 应用滑点保护:", {
        original: formatEther(estimatedTokens),
        slippagePercent: tradingState.slippage,
        minAmount: formatEther(minTokenAmount),
        calculation: `${estimatedTokens} * ${100 - tradingState.slippage} / 100`
      });

      return minTokenAmount;
    } catch (error) {
      console.error("❌ 调用合约 getBuyEstimate 失败:", error);
      return 0n;
    }
  }, [publicClient, token.address, tradingState.buyAmount, tradingState.slippage]);

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
    } catch (error: any) {
      updateState({ transactionStatus: 'error' });
      console.error("授权失败:", error);
      return {
        success: false,
        error: error.message || "授权失败"
      };
    }
  }, [isConnected, address, getWalletClient, usdtAddress, token.address, chain, publicClient, fetchUserInfo, updateState]);

  // 执行买入
  const buyTokens = useCallback(async (): Promise<TradingResult> => {
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

    if (tradingState.usdtBalance < buyAmountWei) {
      return {
        success: false,
        error: "USDT余额不足"
      };
    }

    updateState({ transactionStatus: 'buying' });

    try {
      console.log("🔄 开始购买流程，获取最新价格数据...");

      // 1. 每次购买都获取最新的价格更新数据
      console.log(`🔍 获取 ${token.symbol} 的最新 Pyth 价格更新数据...`);
      const updateData = await fetchPythUpdateData([token.symbol]);

      if (!updateData || updateData.length === 0) {
        throw new Error("无法获取最新的价格更新数据，请检查网络连接");
      }

      // 2. 更新状态中的数据
      setTradingState(prev => ({
        ...prev,
        updateData: updateData,
        updateFee: 0n // TODO: 可以添加预言机费用获取逻辑
      }));

      console.log("✅ 获取到最新的价格更新数据:", {
        dataLength: updateData.length,
        timestamp: new Date().toISOString()
      });

      // 异步计算最小代币数量
      const minTokenAmount = await calculateMinTokenAmount();

      if (minTokenAmount === 0n) {
        throw new Error("无法计算最小代币数量");
      }

      console.log("💰 准备买入交易:", {
        buyAmountWei: buyAmountWei.toString(),
        buyAmount: tradingState.buyAmount,
        minTokenAmount: minTokenAmount.toString(),
        minTokenAmountFormatted: formatEther(minTokenAmount),
        updateDataLength: tradingState.updateData?.length || 0,
        updateFee: tradingState.updateFee?.toString()
      });

      const client = getWalletClient();

      // 预先检查合约状态
      console.log("🔍 执行前检查合约状态...");

      // 检查合约代币余额
      try {
        // 使用 balanceOf 函数查询合约自身地址的代币余额
        const contractBalance = await publicClient.readContract({
          address: token.address,
          abi: STOCK_TOKEN_ABI,
          functionName: "balanceOf",
          args: [token.address], // 查询合约地址自身的代币余额
        });
        console.log("合约代币余额:", formatEther(contractBalance));
        if (contractBalance < minTokenAmount) {
          throw new Error(`合约代币余额不足! 需要: ${formatEther(minTokenAmount)}, 可用: ${formatEther(contractBalance)}`);
        }
      } catch (balanceError) {
        console.warn("⚠️ 无法检查合约余额:", balanceError);
      }

      // 检查 USDT 授权
      if (tradingState.allowance < buyAmountWei) {
        throw new Error(`USDT授权不足! 需要: ${formatUnits(buyAmountWei, 6)}, 可用: ${formatUnits(tradingState.allowance, 6)}`);
      }

      console.log("📝 准备执行合约调用...",[
          buyAmountWei,                    // 参数1: USDT金额
          minTokenAmount,                  // 参数2: 最小代币数量
          tradingState.updateData || []    // 参数3: 价格更新数据
        ]);
      debugger
      const hash = await client.writeContract({
        address: token.address,
        abi: STOCK_TOKEN_ABI,
        functionName: "buy",
        args: [
          buyAmountWei,                    // 参数1: USDT金额
          minTokenAmount,                  // 参数2: 最小代币数量
          tradingState.updateData || []    // 参数3: 价格更新数据
        ],
        account: address,
        chain,
        value: tradingState.updateFee || BigInt('10000000000000000'), // msg.value: 更新费用 (0.01 ETH 最小值)
        gas: 1000000n, // 增加gas限制到 1M
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
    } catch (error: any) {
      updateState({ transactionStatus: 'error' });
      console.error("❌ 买入交易失败:", error);

      // 详细的错误分析和用户友好提示
      let errorMessage = "买入失败";
      let userAction = "";

      if (error.message) {
        errorMessage = error.message;

        // 分析错误类型并给出用户友好的提示
        if (error.message.includes("insufficient funds")) {
          errorMessage = "账户ETH余额不足";
          userAction = "请为钱包充值足够的ETH来支付Gas费用";
        } else if (error.message.includes("execution reverted")) {
          errorMessage = "合约执行失败";
          userAction = "请检查：1) 合约代币余额 2) 价格数据是否最新 3) 滑点设置是否合理 4) USDT授权是否足够";
        } else if (error.message.includes("USDT授权不足")) {
          errorMessage = "USDT授权不足";
          userAction = "请先授权USDT代币给合约";
        } else if (error.message.includes("合约代币余额不足")) {
          errorMessage = "合约代币余额不足";
          userAction = "合约中没有足够的代币可供购买";
        } else if (error.message.includes("无法获取最新的价格更新数据")) {
          errorMessage = "价格数据获取失败";
          userAction = "请检查网络连接或重试";
        } else if (error.message.includes("无法计算最小代币数量")) {
          errorMessage = "无法计算预期获得的代币数量";
          userAction = "请检查价格数据是否有效";
        } else if (error.message.includes("call revert exception")) {
          errorMessage = "合约调用失败";
          userAction = "检查交易参数或合约状态";
        }
      }

      // 记录详细错误信息用于调试
      console.error("🔍 买入交易失败详细分析:", {
        errorType: error.name || 'Unknown',
        errorMessage: errorMessage,
        errorCode: error.code,
        errorReason: error.reason,
        errorData: error.data,
        transactionHash: error.transaction?.hash,
        userAction,
        stack: error.stack ? error.stack.split('\n').slice(0, 5) : 'No stack trace'
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
  }, [isConnected, address, getWalletClient, token.address, tradingState, calculateMinTokenAmount, chain, publicClient]);

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
      slippage: 1,
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