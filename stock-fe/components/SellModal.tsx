"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Wallet,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { formatUnits, parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PriceSourceIndicator } from "@/components/PriceSourceIndicator";
import {
  useSellTradingSimple as useSellTrading,
  UseSellTradingProps,
} from "@/lib/hooks/useSellTradingSimple";
import { useWallet } from "yc-sdk-ui";

// 预设金额选项 (代币数量)
const PRESET_AMOUNTS = [0.1, 0.5, 1, 5, 10, 50];

// 滑点选项
const SLIPPAGE_OPTIONS = [
  { label: "1%", value: 1 },
  { label: "3%", value: 3 },
  { label: "5%", value: 5 },
  { label: "10%", value: 10 },
  { label: "自定义", value: "custom" },
];

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: {
    symbol: string;
    name: string;
    price: string;
    change24h: number;
    volume24h: number;
    marketCap: number;
    address: `0x${string}`;
  };
  stockTokenAddress: `0x${string}`;
}

export function SellModal({
  isOpen,
  onClose,
  token,
  stockTokenAddress,
}: SellModalProps) {
  const { toast } = useToast();
  const [showCustomSlippage, setShowCustomSlippage] = useState(false);
  const { isConnected } = useWallet();

  // 转换 token 数据格式为 useSellTrading 需要的格式
  const tokenInfo: UseSellTradingProps["token"] = {
    symbol: token.symbol,
    name: token.name,
    address: token.address,
    price: parseFloat(token.price.replace(/[$,]/g, "")),
    change24h: token.change24h,
    volume24h: token.volume24h,
    marketCap: token.marketCap,
  };

  // 使用 sellTrading hook
  const {
    isLoading,
    canSell,
    hasSufficientBalance,
    error,
    tokenInfo: hookTokenInfo,
    balances,
    params,
    estimate,
    transaction,
    setSellAmount,
    setSlippage,
    calculateEstimate,
    executeSell,
    clearError,
    updateBalance,
  } = useSellTrading({
    token: tokenInfo,
    stockTokenAddress: stockTokenAddress,
    onTransactionComplete: (result) => {
      if (result.success) {
        toast({
          title: "卖出成功",
          description: `${token.symbol} 卖出成功！`,
        });
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    },
    onError: (errorMessage) => {
      toast({
        title: "卖出失败",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // 本地状态：是否正在计算预估
  const [isCalculatingEstimate, setIsCalculatingEstimate] = useState(false);

  const isPositive = token.change24h >= 0;

  // 初始化数据
  useEffect(() => {
    if (isOpen && isConnected) {
      console.log("🔍 SellModal 打开，初始化数据...");
      console.log("🔍 当前余额状态:", balances);
      updateBalance();
    }
  }, [isOpen, isConnected]);

  // 重置状态当模态框关闭时
  useEffect(() => {
    if (!isOpen) {
      clearError();
      setShowCustomSlippage(false);
      setSellAmount("");
    }
  }, [isOpen, clearError, setSellAmount]);

  // 监听余额变化
  useEffect(() => {
    if (isOpen) {
      console.log("🔍 余额更新:", {
        balances,
        tokenBalance: balances?.tokenBalance,
        formatted: balances?.tokenBalance
          ? formatUnits(balances.tokenBalance, 18)
          : "0",
      });
    }
  }, [balances, isOpen]);

  // 监听卖出金额变化，自动计算预估
  useEffect(() => {
    if (isOpen && params?.sellAmount && parseFloat(params.sellAmount) > 0) {
      // 清除之前的错误
      clearError();
      setIsCalculatingEstimate(true);

      // 减少延迟时间，提升响应速度
      const timer = setTimeout(() => {
        calculateEstimate()
          .finally(() => {
            setIsCalculatingEstimate(false);
          })
          .catch(() => {
            setIsCalculatingEstimate(false);
          });
      }, 150); // 从300ms减少到150ms

      return () => {
        clearTimeout(timer);
        setIsCalculatingEstimate(false);
      };
    }
  }, [isOpen, params?.sellAmount]); // 只依赖必要的值，避免无限循环

  // 处理卖出
  const handleSell = async () => {
    console.log("🚀 开始卖出代币:", {
      token: token.symbol,
      params,
      estimate,
      isConnected,
    });

    const result = await executeSell();

    // toast 提示已经在 hook 中处理，这里不需要重复处理
  };

  // 计算按钮状态
  const getButtonState = () => {
    if (isLoading) {
      return {
        text: "卖出中...",
        disabled: true,
        color: "bg-red-500",
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
      };
    }

    if (transaction?.currentTransaction?.status === "success") {
      return {
        text: "交易成功",
        disabled: true,
        color: "bg-green-500",
        icon: <CheckCircle className="w-4 h-4" />,
      };
    }

    if (!isConnected) {
      return {
        text: "连接钱包",
        disabled: false,
        color: "bg-blue-500",
        icon: <Wallet className="w-4 h-4" />,
      };
    }

    if (!params?.sellAmount || parseFloat(params.sellAmount) <= 0) {
      return {
        text: "输入卖出数量",
        disabled: true,
        color: "bg-gray-500",
        icon: null,
      };
    }

    if (!hasSufficientBalance) {
      return {
        text: "余额不足",
        disabled: true,
        color: "bg-gray-500",
        icon: null,
      };
    }

    // 正在计算预估时禁用按钮
    if (isCalculatingEstimate) {
      return {
        text: "计算预估中...",
        disabled: true,
        color: "bg-yellow-500",
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
      };
    }

    return {
      text: `卖出 ${token.symbol}`,
      disabled: false, // 简化判断，只依赖前面的基本检查
      color: "bg-red-500",
      icon: null,
    };
  };

  const buttonState = getButtonState();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isPositive
                  ? "bg-gradient-to-br from-green-500 to-emerald-600"
                  : "bg-gradient-to-br from-red-500 to-orange-600"
              }`}
            >
              <span className="text-white font-bold text-lg">
                {token.symbol.charAt(0)}
              </span>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">
                卖出 {token.symbol}
              </h3>
              <p className="text-gray-400 text-sm">{token.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Price Info */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">当前价格</span>
              <PriceSourceIndicator source="fallback" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white text-2xl font-bold">
                ${token.price}
              </span>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                  isPositive
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm font-semibold">
                  {isPositive ? "+" : ""}
                  {token.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{token.symbol} 余额</span>
            <span className="text-white">
              {balances?.tokenBalance
                ? formatUnits(balances.tokenBalance, 18)
                : "0"}{" "}
              {token.symbol}
            </span>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              卖出数量 ({token.symbol})
            </label>
            <div className="flex gap-2 mb-3">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setSellAmount(amount.toString())}
                  className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm ${
                    params?.sellAmount === amount.toString()
                      ? "border-red-500 bg-red-500/20 text-red-400"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={params?.sellAmount || ""}
              onChange={(e) => setSellAmount(e.target.value)}
              placeholder="输入数量"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none"
            />
            {balances?.tokenBalance &&
              params?.sellAmount &&
              parseFloat(params.sellAmount) > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  可卖出最大: {formatUnits(balances.tokenBalance, 18)}{" "}
                  {token.symbol}
                </div>
              )}
          </div>

          {/* Slippage */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              滑点容忍度
            </label>
            <div className="flex gap-2 mb-3">
              {SLIPPAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    if (option.value === "custom") {
                      setShowCustomSlippage(true);
                    } else {
                      setSlippage(
                        typeof option.value === "number" ? option.value : 3
                      );
                      setShowCustomSlippage(false);
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm ${
                    (typeof option.value === "number" &&
                      params?.slippage === option.value) ||
                    (option.value === "custom" && showCustomSlippage)
                      ? "border-red-500 bg-red-500/20 text-red-400"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {showCustomSlippage && (
              <input
                type="number"
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    setSlippage(parseFloat(value));
                  }
                }}
                placeholder="自定义滑点 %"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-red-500 focus:outline-none"
              />
            )}
          </div>

          {/* Estimate Result */}
          {isCalculatingEstimate && (
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">计算预估中...</span>
              </div>
            </div>
          )}
          {estimate && !isCalculatingEstimate && (
            <div className="bg-gray-800/50 rounded-xl p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">预估获得</span>
                  <span className="text-white font-semibold">
                    {estimate.formatted.estimatedUsdt} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">预估手续费</span>
                  <span className="text-gray-300">
                    {estimate.formatted.estimatedFee} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">最小获得</span>
                  <span className="text-yellow-400">
                    {estimate.formatted.minUsdtAmount} USDT
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Status */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {transaction?.currentTransaction?.status === "success" && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm">交易成功！</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800">
          <Button
            onClick={handleSell}
            disabled={buttonState.disabled}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
              buttonState.disabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:opacity-90"
            } ${buttonState.color}`}
          >
            <div className="flex items-center justify-center gap-2">
              {buttonState.icon}
              {buttonState.text}
            </div>
          </Button>

          {!isConnected && (
            <p className="text-center text-gray-400 text-sm mt-3">
              请先连接钱包以继续交易
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SellModal;
