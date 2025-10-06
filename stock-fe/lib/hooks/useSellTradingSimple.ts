"use client";

import { useCallback, useEffect } from "react";
import { Address, formatUnits, parseUnits } from "viem";
import { usePublicClient, useWalletClient } from "ycdirectory-hooks";
import { useWallet } from "ycdirectory-ui";
import { useSellStore } from "../stores/sellStore";

// ==================== 类型定义 ====================
export interface UseSellTradingProps {
  token: {
    symbol: string;
    name: string;
    address: Address;
    price: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
  };
  stockTokenAddress: Address;
  onTransactionComplete?: (result: TransactionResult) => void;
  onError?: (error: string) => void;
}

export interface TransactionResult {
  success: boolean;
  hash?: Address;
  data?: {
    tokenAmount: string;
    usdtAmount: string;
    feeAmount: string;
    beforeBalances?: {
      usdtBalance: string;
      tokenBalance: string;
    };
    transactionReceipt?: {
      blockNumber: bigint;
      transactionHash: Address;
      status: 'success' | 'reverted';
      gasUsed: bigint;
    };
  };
  error?: string;
}

/**
 * 简化的卖出交易 Hook
 * 避免复杂的状态管理和可能的无限循环
 */
export function useSellTradingSimple({
  token,
  stockTokenAddress,
  onTransactionComplete,
  onError,
}: UseSellTradingProps) {
  // ===== Web3 客户端 =====
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();
  const { isConnected, address } = useWallet();

  // ===== 使用 Zustand hook 获取状态和方法 =====
  const sellStore = useSellStore();

  // ===== 基本操作方法 =====
  const setSellAmount = useCallback((amount: string) => {
    sellStore.setSellAmount(amount);
  }, [sellStore]);

  const setSlippage = useCallback((slippage: number) => {
    sellStore.setSlippage(slippage);
  }, [sellStore]);

  const clearError = useCallback(() => {
    sellStore.clearError();
  }, [sellStore]);

  // 设置代币信息到store
  useEffect(() => {
    if (token) {
      console.log("🪙 设置代币信息到store:", token);
      sellStore.setToken(token);
    }
  }, [token, sellStore]);

  // 设置连接状态到store
  useEffect(() => {
    console.log("🔗 设置连接状态到store:", { isConnected, address });
    sellStore.setConnected(isConnected, address);
  }, [isConnected, address, sellStore]);

  // 优化的计算预估方法 - 添加防抖
  const debouncedCalculateEstimate = useCallback(
    debounce(async () => {
      try {
        if (!sellStore.sellAmount || !publicClient || !stockTokenAddress) {
          return;
        }

        console.log("🔢 开始计算预估...", { sellAmount: sellStore.sellAmount });
        const sellAmountWei = parseUnits(sellStore.sellAmount, 18);
        const result = await sellStore.getSellEstimate(publicClient, stockTokenAddress, sellAmountWei);
        if (result.success && result.data) {
          sellStore.setEstimate(result.data.estimatedUsdt, result.data.estimatedFee);
          console.log("✅ 预估计算完成");
        }
      } catch (error) {
        console.error("预估计算失败:", error);
        sellStore.setError("预估计算失败", "ESTIMATE_FAILED");
      }
    }, 500), // 减少防抖延迟到500ms，提升响应速度
    [publicClient, stockTokenAddress, sellStore]
  );

  // 包装方法，确保返回Promise
  const calculateEstimate = useCallback(() => {
    return debouncedCalculateEstimate();
  }, [debouncedCalculateEstimate]);

  // 简单的防抖函数实现
  function debounce<T extends (...args: any[]) => Promise<void>>(func: T, delay: number): T {
    let timeoutId: NodeJS.Timeout;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            await func(...args);
            resolve();
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    }) as T;
  }

  // 更新余额方法
  const updateBalance = useCallback(async () => {
    try {
      if (!publicClient || !address || !stockTokenAddress) {
        console.warn('⚠️ 缺少必要参数，跳过余额更新');
        return;
      }

      const result = await sellStore.fetchBalances(publicClient, stockTokenAddress, address);

      if (!result.success) {
        throw new Error(result.error || '获取余额失败');
      }

      console.log('✅ 余额更新成功');
    } catch (error) {
      console.error('❌ 更新代币余额失败:', error);
      const errorMessage = error instanceof Error ? error.message : '更新代币余额失败';
      sellStore.setError(errorMessage, 'BALANCE_UPDATE_FAILED');
      onError?.(errorMessage);
    }
  }, [publicClient, address, stockTokenAddress, onError, sellStore]);

  // 简化的执行卖出方法
  const executeSell = useCallback(async (): Promise<TransactionResult> => {
    try {
      if (!publicClient || !getWalletClient || !chain || !address || !stockTokenAddress) {
        throw new Error("缺少必要的客户端或连接信息");
      }

      // 获取实际的walletClient实例
      const actualWalletClient = await getWalletClient();

      if (!actualWalletClient) {
        throw new Error("无法获取钱包客户端");
      }

      console.log("🔧 检查walletClient:", {
        hasWalletClient: !!actualWalletClient,
        walletClientType: typeof actualWalletClient,
        hasWriteContract: typeof actualWalletClient.writeContract
      });

      const result = await sellStore.sellToken(
        publicClient,
        actualWalletClient,
        chain,
        address,
        stockTokenAddress
      );

      if (result.success && result.data) {
        onTransactionComplete?.({
          success: true,
          hash: result.data.hash,
          data: {
            tokenAmount: result.data.tokenAmount,
            usdtAmount: result.data.usdtAmount,
            feeAmount: result.data.feeAmount,
          }
        });

        return {
          success: true,
          hash: result.data.hash,
          data: {
            tokenAmount: result.data.tokenAmount,
            usdtAmount: result.data.usdtAmount,
            feeAmount: result.data.feeAmount,
          }
        };
      } else {
        throw new Error(result.error || "卖出交易失败");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      onError?.(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [publicClient, getWalletClient, chain, address, stockTokenAddress, onTransactionComplete, onError, sellStore]);

  return {
    // 状态信息
    isLoading: sellStore.isTransactionPending,
    canSell: !!sellStore.token && !!sellStore.sellAmount &&
             parseFloat(sellStore.sellAmount) > 0 &&
             sellStore.balances?.tokenBalance > 0n,
    hasSufficientBalance: sellStore.balances?.tokenBalance > 0n && sellStore.sellAmount ?
      sellStore.balances.tokenBalance >= parseUnits(sellStore.sellAmount, 18) : true,
    error: sellStore.error,

    // 数据信息
    tokenInfo: sellStore.token,
    balances: sellStore.balances,
    params: {
      sellAmount: sellStore.sellAmount,
      slippage: sellStore.slippage,
    },
    estimate: sellStore.estimate,
    transaction: {
      isTransactionPending: sellStore.isTransactionPending,
      currentTransaction: sellStore.currentTransaction,
      sellHistory: sellStore.sellHistory,
    },

    // 操作方法
    setSellAmount,
    setSlippage,
    calculateEstimate,
    executeSell,
    clearError,
    updateBalance,

    // 连接信息
    isConnected,
    address,
  };
}

export default useSellTradingSimple;