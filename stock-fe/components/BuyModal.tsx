"use client";

import { useState, useEffect } from "react";
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
import useTokenTrading from "@/lib/hooks/useTokenTrading";

// 预设金额选项
const PRESET_AMOUNTS = [10, 50, 100, 500, 1000, 5000];

// 滑点选项
const SLIPPAGE_OPTIONS = [
  { label: "3%", value: 3 },
  { label: "5%", value: 5 },
  { label: "10%", value: 10 },
  { label: "15%", value: 15 },
  { label: "自定义", value: "custom" },
];

interface BuyModalProps {
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
  oracleAddress: `0x${string}`;
  usdtAddress: `0x${string}`;
}

export default function BuyModal({
  isOpen,
  onClose,
  token,
  oracleAddress,
  usdtAddress,
}: BuyModalProps) {
  const { toast } = useToast();

  // 转换 token 数据格式
  const tokenInfo = {
    symbol: token.symbol,
    name: token.name,
    address: token.address,
    price: parseFloat(token.price.replace(/[$,]/g, "")),
    change24h: token.change24h,
    volume24h: token.volume24h,
    marketCap: token.marketCap,
    totalSupply: 0, // 暂时使用默认值
    userBalance: 0, // 暂时使用默认值
    userValue: 0, // 暂时使用默认值
  };

  // 使用新的 trading hook
  const {
    tradingState,
    isConnected,
    initializeData,
    approveUSDT,
    buyTokens,
    resetState,
    updateState,
  } = useTokenTrading(tokenInfo, usdtAddress, oracleAddress);

  const [showCustomSlippage, setShowCustomSlippage] = useState(false);

  const isPositive = token.change24h >= 0;

  // 初始化数据
  useEffect(() => {
    if (isOpen && isConnected) {
      initializeData();
    }
  }, [isOpen, isConnected, initializeData]);

  // 监听价格数据更新，实时刷新弹窗显示
  useEffect(() => {
    if (isOpen && tradingState.priceData) {
      console.log("💰 价格数据更新，刷新弹窗显示:", {
        price: tradingState.priceData.price,
        lastUpdate: tradingState.updateData ? "有更新" : "无更新"
      });
    }
  }, [isOpen, tradingState.priceData, tradingState.updateData]);

  // 重置状态当模态框关闭时
  useEffect(() => {
    if (!isOpen) {
      resetState();
      setShowCustomSlippage(false);
    }
  }, [isOpen, resetState]);

  // 处理授权
  const handleApprove = async () => {
    const result = await approveUSDT();

    if (result.success) {
      toast({
        title: "授权成功",
        description: "USDT授权成功，现在可以购买代币了",
      });
    } else {
      toast({
        title: "授权失败",
        description: result.error || "授权失败，请重试",
        variant: "destructive",
      });
    }
  };

  // 处理买入
  const handleBuy = async () => {
    console.log("🚀 开始购买代币:", {
      token: token.symbol,
      tradingState,
      isConnected,
    });
    const result = await buyTokens();

    if (result.success) {
      toast({
        title: "购买成功",
        description: `${token.symbol} 购买成功！`,
      });
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      toast({
        title: "购买失败",
        description: result.error || "购买失败，请重试",
        variant: "destructive",
      });
    }
  };

  // 计算按钮状态
  const getButtonState = () => {
    if (tradingState.transactionStatus === "approving") {
      return {
        text: "授权中...",
        disabled: true,
        color: "bg-yellow-500",
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
      };
    }

    if (tradingState.transactionStatus === "buying") {
      return {
        text: "购买中...",
        disabled: true,
        color: "bg-green-500",
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
      };
    }

    if (tradingState.transactionStatus === "success") {
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

    if (tradingState.needsApproval) {
      return {
        text: `授权 ${tradingState.buyAmount} USDT`,
        disabled:
          !tradingState.buyAmount || parseFloat(tradingState.buyAmount) <= 0,
        color: "bg-yellow-500",
        icon: null,
      };
    }

    return {
      text: `买入 ${token.symbol}`,
      disabled:
        !tradingState.buyAmount ||
        parseFloat(tradingState.buyAmount) <= 0 ||
        tradingState.usdtBalance < parseUnits(tradingState.buyAmount, 6),
      color: "bg-green-500",
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
                {token.symbol}
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
                {token.price}
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
            <span className="text-gray-400">USDT 余额</span>
            <span className="text-white">
              {formatUnits(tradingState.usdtBalance, 6)} USDT
            </span>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">
              购买金额 (USDT)
            </label>
            <div className="flex gap-2 mb-3">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => updateState({ buyAmount: amount.toString() })}
                  className={`flex-1 py-2 px-3 rounded-lg border transition-all ${
                    tradingState.buyAmount === amount.toString()
                      ? "border-blue-500 bg-blue-500/20 text-blue-400"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={tradingState.buyAmount}
              onChange={(e) => updateState({ buyAmount: e.target.value })}
              placeholder="输入金额"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            />
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
                      updateState({
                        slippage: typeof option.value === 'number' ? option.value : 5,
                        customSlippage: "",
                      });
                      setShowCustomSlippage(false);
                    }
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border transition-all text-sm ${
                    (typeof option.value === 'number' && tradingState.slippage === option.value) ||
                    (option.value === "custom" && showCustomSlippage)
                      ? "border-blue-500 bg-blue-500/20 text-blue-400"
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
                value={tradingState.customSlippage}
                onChange={(e) => {
                  const value = e.target.value;
                  updateState({
                    customSlippage: value,
                    slippage: value ? parseFloat(value) : 5
                  });
                }}
                placeholder="自定义滑点 %"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
              />
            )}
          </div>

          {/* Transaction Status */}
          {tradingState.transactionStatus === "error" && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">交易失败，请重试</span>
              </div>
            </div>
          )}

          {tradingState.transactionStatus === "success" && (
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
            onClick={tradingState.needsApproval ? handleApprove : handleBuy}
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
