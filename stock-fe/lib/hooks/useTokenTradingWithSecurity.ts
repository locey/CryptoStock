/**
 * 带有安全验证的代币交易 Hook
 *
 * 这个 Hook 展示了如何将安全验证功能集成到现有的交易流程中
 * 防止重放攻击，确保交易的安全性
 */

import { useState, useCallback, useEffect } from 'react';
import { Address, formatUnits, parseUnits } from 'viem';
import { ethers } from 'ethers';
import { usePublicClient, useWalletClient } from 'yc-sdk-hooks';
import { useWallet } from 'yc-sdk-ui';
import { useToast } from '@/hooks/use-toast';
import { useSecurityValidation } from './useSecurityValidation';
import USDT_TOKEN_ABI from '@/lib/abi/MockERC20.json';
import STOCK_TOKEN_ABI from '@/lib/abi/StockToken.json';
import PYTH_PRICE_FEED_ABI from '@/lib/abi/PythPriceFeed.json';
import PRICE_AGGREGATOR_ABI from '@/lib/abi/PriceAggregator.json';
import { getRedStoneUpdateData } from '../utils/getRedStoneUpdateData-v061';
import { getNetworkConfig } from '@/lib/contracts';
import UNIFIED_ORACLE_DEPLOYMENT from '@/lib/abi/deployments-unified-oracle-sepolia.json';
import getPythUpdateData from "@/lib/utils/getPythUpdateData";
import { TokenInfo, TradingState, TradingResult } from './useTokenTrading';

// ==================== 类型定义 ====================

/**
 * 安全交易结果
 */
export interface SecureTradingResult extends TradingResult {
  /** 安全验证信息 */
  securityInfo?: {
    sessionId: string;
    nonce: bigint;
    validationTime: number;
    oneTimeToken: string;
  };
}

/**
 * 安全交易状态
 */
export interface SecureTradingState extends TradingState {
  /** 安全验证状态 */
  securityValidationState: {
    isValidating: boolean;
    isSessionValid: boolean;
    lastValidationTime: number | null;
    securityErrors: string[];
  };
}

// ==================== Hook 实现 ====================

/**
 * 带有安全验证的代币交易 Hook
 */
export const useTokenTradingWithSecurity = (
  token: TokenInfo,
  usdtAddress: Address,
  oracleAddress: Address
) => {
  const { toast } = useToast();
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();
  const { isConnected, address } = useWallet();

  // 安全验证 Hook
  const securityValidation = useSecurityValidation();

  // 网络配置
  const networkConfig = getNetworkConfig(chain?.id || 11155111);
  const stockTokenImplAddress = networkConfig.contracts.stockTokenImplementation as Address;
  const pythPriceFeedAddress = UNIFIED_ORACLE_DEPLOYMENT.contracts.pythPriceFeed.address as Address;
  const priceAggregatorAddress = UNIFIED_ORACLE_DEPLOYMENT.contracts.priceAggregator.address as Address;

  // 安全增强的交易状态
  const [tradingState, setTradingState] = useState<SecureTradingState>({
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
    securityValidationState: {
      isValidating: false,
      isSessionValid: false,
      lastValidationTime: null,
      securityErrors: [],
    },
  });

  /**
   * 安全的买入代币函数
   */
  const buyTokensSecurely = useCallback(async (): Promise<SecureTradingResult> => {
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

    try {
      console.log("🔐 开始安全的买入交易流程...");
      setTradingState(prev => ({
        ...prev,
        transactionStatus: 'buying',
        securityValidationState: {
          ...prev.securityValidationState,
          isValidating: true,
          securityErrors: [],
        },
      }));

      // 1. 准备交易安全参数
      const securityParams = {
        userAddress: address,
        contractAddress: token.address,
        amount: buyAmountWei,
        transactionType: 'buy',
        businessContext: {
          tokenSymbol: token.symbol,
          tokenName: token.name,
          slippage: tradingState.slippage,
          timestamp: Date.now(),
        },
      };

      // 2. 生成交易哈希（简化版本）
      const transactionHash = generateTransactionHash(address, token.address, buyAmountWei, 'buy');

      // 3. 创建安全交易元数据
      const { metadata, oneTimeToken } = await securityValidation.createSecureTransaction(
        transactionHash as any,
        securityParams
      );

      console.log("✅ 安全元数据创建成功:", {
        sessionId: metadata.sessionId,
        nonce: metadata.nonce.toString(),
        expirationTime: new Date(metadata.expirationTime).toLocaleString(),
      });

      // 4. 获取价格数据（保持原有逻辑）
      const pythUpdateData = await getPythUpdateData([token.symbol]);
      const redStoneData = await getRedStoneUpdateData(token.symbol);

      if (!pythUpdateData || pythUpdateData.length === 0) {
        throw new Error("无法获取价格更新数据");
      }

      // 5. 组装更新数据
      const updateDataArray = [
        pythUpdateData,
        [redStoneData.updateData]
      ];

      // 6. 获取更新费用
      const updateFee = await publicClient.readContract({
        address: pythPriceFeedAddress,
        abi: PYTH_PRICE_FEED_ABI,
        functionName: "getUpdateFee",
        args: [pythUpdateData]
      }) as bigint;

      // 7. 验证交易安全性
      const validationResult = await securityValidation.validateTransaction(metadata, oneTimeToken);

      if (!validationResult.isValid) {
        throw new Error(`安全验证失败: ${validationResult.error}`);
      }

      // 8. 检查交易是否即将过期
      if (securityValidation.isTransactionExpiringSoon(metadata)) {
        console.warn("⚠️ 交易即将过期，请尽快完成");
        toast({
          title: "⏰ 交易即将过期",
          description: "请尽快确认交易，否则需要重新创建",
          variant: "destructive",
        });
      }

      // 9. 执行买入交易（保持原有逻辑）
      const client = getWalletClient();

      // 计算预期获得的代币数量
      const currentPrice = await publicClient.readContract({
        address: priceAggregatorAddress,
        abi: PRICE_AGGREGATOR_ABI,
        functionName: "getAggregatedPrice",
        args: [token.symbol, updateDataArray]
      }) as bigint;

      const tokenAmountBeforeFee = (buyAmountWei * ethers.parseEther("1000000000000")) / currentPrice;
      const tradeFeeRate = 30n; // 0.3%
      const feeAmount = (tokenAmountBeforeFee * tradeFeeRate) / 10000n;
      const expectedTokenAmount = tokenAmountBeforeFee - feeAmount;
      const minTokenAmount = expectedTokenAmount * 90n / 100n; // 10%滑点

      console.log("📊 交易参数计算:", {
        buyAmount: formatUnits(buyAmountWei, 6),
        expectedTokens: formatEther(expectedTokenAmount),
        minTokens: formatEther(minTokenAmount),
        currentPrice: formatEther(currentPrice),
      });

      // 10. 执行合约调用
      const hash = await client.writeContract({
        address: token.address,
        abi: STOCK_TOKEN_ABI,
        functionName: "buy",
        args: [buyAmountWei, minTokenAmount, updateDataArray],
        account: address,
        chain,
        value: updateFee,
      });

      console.log("📝 交易哈希:", hash);

      // 11. 等待交易确认
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });

      if (receipt?.status === 'success') {
        setTradingState(prev => ({
          ...prev,
          transactionStatus: 'success',
          transactionHash: hash,
          securityValidationState: {
            ...prev.securityValidationState,
            isValidating: false,
            isSessionValid: true,
            lastValidationTime: Date.now(),
          },
        }));

        toast({
          title: "✅ 买入成功",
          description: `成功购买 ${token.symbol}`,
        });

        return {
          success: true,
          hash,
          securityInfo: {
            sessionId: metadata.sessionId,
            nonce: metadata.nonce,
            validationTime: Date.now(),
            oneTimeToken,
          },
        };
      } else {
        throw new Error('交易失败');
      }

    } catch (error: unknown) {
      console.error("❌ 安全买入交易失败:", error);

      // 更新安全错误状态
      setTradingState(prev => ({
        ...prev,
        transactionStatus: 'error',
        securityValidationState: {
          ...prev.securityValidationState,
          isValidating: false,
          securityErrors: [
            ...prev.securityValidationState.securityErrors,
            error instanceof Error ? error.message : '未知错误',
          ],
        },
      }));

      // 处理特定安全错误
      if (error instanceof Error) {
        if (error.message.includes('NONCE_ALREADY_USED')) {
          toast({
            title: "🚨 安全警告",
            description: "检测到重复交易，已自动阻止",
            variant: "destructive",
          });
        } else if (error.message.includes('TRANSACTION_EXPIRED')) {
          toast({
            title: "⏰ 交易已过期",
            description: "请重新创建交易",
            variant: "destructive",
          });
        } else if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
          toast({
            title: "🚦 请求过于频繁",
            description: "请稍后再试",
            variant: "destructive",
          });
        } else {
          toast({
            title: "❌ 买入失败",
            description: error.message,
            variant: "destructive",
          });
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "买入失败"
      };
    }
  }, [
    isConnected,
    address,
    getWalletClient,
    token,
    tradingState,
    securityValidation,
    publicClient,
    chain,
    toast,
    stockTokenImplAddress,
    pythPriceFeedAddress,
    priceAggregatorAddress,
  ]);

  /**
   * 安全的卖出代币函数
   */
  const sellTokensSecurely = useCallback(async (sellAmount: string): Promise<SecureTradingResult> => {
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

    const sellAmountWei = parseUnits(sellAmount, 18);

    try {
      console.log("🔐 开始安全的卖出交易流程...");
      setTradingState(prev => ({
        ...prev,
        transactionStatus: 'buying', // 复用购买状态
        securityValidationState: {
          ...prev.securityValidationState,
          isValidating: true,
          securityErrors: [],
        },
      }));

      // 1. 准备交易安全参数
      const securityParams = {
        userAddress: address,
        contractAddress: token.address,
        amount: sellAmountWei,
        transactionType: 'sell',
        businessContext: {
          tokenSymbol: token.symbol,
          tokenName: token.name,
          timestamp: Date.now(),
        },
      };

      // 2. 生成交易哈希
      const transactionHash = generateTransactionHash(address, token.address, sellAmountWei, 'sell');

      // 3. 创建安全交易元数据
      const { metadata, oneTimeToken } = await securityValidation.createSecureTransaction(
        transactionHash as any,
        securityParams
      );

      // 4. 验证交易安全性
      const validationResult = await securityValidation.validateTransaction(metadata, oneTimeToken);

      if (!validationResult.isValid) {
        throw new Error(`安全验证失败: ${validationResult.error}`);
      }

      // 5. 获取价格数据并执行交易（保持原有逻辑）
      const pythUpdateData = await getPythUpdateData([token.symbol]);
      const redStoneData = await getRedStoneUpdateData(token.symbol);

      const updateDataArray = [
        pythUpdateData,
        [redStoneData.updateData]
      ];

      const updateFee = await publicClient.readContract({
        address: pythPriceFeedAddress,
        abi: PYTH_PRICE_FEED_ABI,
        functionName: "getUpdateFee",
        args: [pythUpdateData]
      }) as bigint;

      const currentPrice = await publicClient.readContract({
        address: priceAggregatorAddress,
        abi: PRICE_AGGREGATOR_ABI,
        functionName: "getAggregatedPrice",
        args: [token.symbol, updateDataArray]
      }) as bigint;

      const tradeFeeRate = await publicClient.readContract({
        address: token.address,
        abi: STOCK_TOKEN_ABI,
        functionName: "tradeFeeRate"
      }) as bigint;

      const expectedUsdtBeforeFee = (sellAmountWei * currentPrice) / ethers.parseEther("1000000000000");
      const feeAmount = (expectedUsdtBeforeFee * tradeFeeRate) / 10000n;
      const expectedUsdtAmount = expectedUsdtBeforeFee - feeAmount;
      const minUsdtAmount = expectedUsdtAmount * 90n / 100n;

      // 6. 执行合约调用
      const client = getWalletClient();

      const hash = await client.writeContract({
        address: token.address,
        abi: STOCK_TOKEN_ABI,
        functionName: "sell",
        args: [sellAmountWei, minUsdtAmount, updateDataArray],
        account: address,
        chain,
        value: updateFee,
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });

      if (receipt?.status === 'success') {
        setTradingState(prev => ({
          ...prev,
          transactionStatus: 'success',
          transactionHash: hash,
          securityValidationState: {
            ...prev.securityValidationState,
            isValidating: false,
            isSessionValid: true,
            lastValidationTime: Date.now(),
          },
        }));

        toast({
          title: "✅ 卖出成功",
          description: `成功卖出 ${token.symbol}`,
        });

        return {
          success: true,
          hash,
          securityInfo: {
            sessionId: metadata.sessionId,
            nonce: metadata.nonce,
            validationTime: Date.now(),
            oneTimeToken,
          },
        };
      } else {
        throw new Error('交易失败');
      }

    } catch (error: unknown) {
      console.error("❌ 安全卖出交易失败:", error);

      setTradingState(prev => ({
        ...prev,
        transactionStatus: 'error',
        securityValidationState: {
          ...prev.securityValidationState,
          isValidating: false,
          securityErrors: [
            ...prev.securityValidationState.securityErrors,
            error instanceof Error ? error.message : '未知错误',
          ],
        },
      }));

      return {
        success: false,
        error: error instanceof Error ? error.message : "卖出失败"
      };
    }
  }, [
    isConnected,
    address,
    getWalletClient,
    token,
    publicClient,
    chain,
    toast,
    securityValidation,
    pythPriceFeedAddress,
    priceAggregatorAddress,
  ]);

  /**
   * 重置状态
   */
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
      securityValidationState: {
        isValidating: false,
        isSessionValid: false,
        lastValidationTime: null,
        securityErrors: [],
      },
    });

    securityValidation.resetState();
  }, [securityValidation]);

  // 监听交易过期警告
  useEffect(() => {
    if (!securityValidation.state.sessionId) return;

    const checkExpiry = setInterval(() => {
      // 检查会话状态并提醒用户
      if (securityValidation.state.validationResult?.isValid) {
        // 可以在这里添加过期提醒逻辑
      }
    }, 10000); // 每10秒检查一次

    return () => clearInterval(checkExpiry);
  }, [securityValidation.state.sessionId, securityValidation.state.validationResult]);

  return {
    // 状态
    tradingState,
    isConnected,
    address,

    // 安全验证相关
    securityValidation,

    // 操作方法（安全增强版）
    buyTokensSecurely,
    sellTokensSecurely,
    resetState,

    // 计算属性
    minTokenAmount: 0n,

    // 客户端
    publicClient,
    walletClient,
    chain,
  };
};

// ==================== 辅助函数 ====================

/**
 * 生成交易哈希
 */
const generateTransactionHash = (
  userAddress: Address,
  contractAddress: Address,
  amount: bigint,
  transactionType: string
): string => {
  const data = {
    userAddress,
    contractAddress,
    amount: amount.toString(),
    transactionType,
    timestamp: Date.now(),
  };

  const hashString = JSON.stringify(data);
  return `0x${hashString.slice(0, 64).padEnd(64, '0')}`;
};

export default useTokenTradingWithSecurity;