"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ERC20_TOKEN_ADDRESS } from "@/lib/token";
import { getTokenBalance, getTokenInfo } from "@/lib/etherscan";

export interface TokenBalance {
  balance: string;
  formattedBalance: string;
  symbol: string;
  decimals: number;
  address: string;
  isLoading: boolean;
  error: string | null;
}

export function useTokenBalance(tokenAddress: string = ERC20_TOKEN_ADDRESS) {
  const { address, isConnected } = useAccount();
  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    balance: "0",
    formattedBalance: "0",
    symbol: "CS",
    decimals: 18,
    address: tokenAddress,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const fetchBalanceAndInfo = async () => {
      if (!isConnected || !address) {
        if (mounted) {
          setTokenBalance(prev => ({
            ...prev,
            balance: "0",
            formattedBalance: "0",
            isLoading: false,
            error: null,
          }));
        }
        return;
      }

      setTokenBalance(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        // 并行获取余额和代币信息
        const [balance, tokenInfo] = await Promise.allSettled([
          getTokenBalance(tokenAddress, address),
          getTokenInfo(tokenAddress),
        ]);

        // 处理余额结果
        if (balance.status === 'fulfilled') {
          const balanceValue = balance.value;

          // 处理代币信息结果
          let decimals = 18;
          let symbol = "CS";

          if (tokenInfo.status === 'fulfilled' && tokenInfo.value) {
            decimals = tokenInfo.value.decimals;
            symbol = tokenInfo.value.symbol;
          }

          // 格式化余额
          const formattedBalance = formatTokenBalance(balanceValue, decimals);

          if (mounted) {
            setTokenBalance({
              balance: balanceValue,
              formattedBalance,
              symbol,
              decimals,
              address: tokenAddress,
              isLoading: false,
              error: null,
            });
          }
        } else {
          throw new Error('Failed to fetch balance');
        }
      } catch (error) {
        console.error('Error fetching token balance:', error);
        if (mounted) {
          setTokenBalance(prev => ({
            ...prev,
            balance: "0",
            formattedBalance: "0",
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch balance',
          }));
        }
      }
    };

    fetchBalanceAndInfo();

    // 设置定时刷新（每30秒）
    const interval = setInterval(fetchBalanceAndInfo, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [address, isConnected, tokenAddress]);

  return tokenBalance;
}

// 格式化代币余额
function formatTokenBalance(balance: string, decimals: number): string {
  try {
    const balanceBig = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const wholePart = balanceBig / divisor;
    const fractionalPart = balanceBig % divisor;

    if (fractionalPart === 0n) {
      return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmed = fractionalStr.replace(/0+$/, '');

    return `${wholePart}.${trimmed}`;
  } catch (error) {
    console.error('Error formatting balance:', error);
    return "0";
  }
}

// 获取余额的简化 Hook
export function useSimpleTokenBalance(tokenAddress: string = ERC20_TOKEN_ADDRESS) {
  const tokenBalance = useTokenBalance(tokenAddress);
  return {
    balance: tokenBalance.formattedBalance,
    symbol: tokenBalance.symbol,
    isLoading: tokenBalance.isLoading,
    error: tokenBalance.error,
  };
}