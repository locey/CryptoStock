"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatNumber, formatPrice } from '@/lib/utils/format';

interface TokenData {
  symbol: string;
  name: string;
  address: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  totalSupply: number;
  userBalance: number;
  userValue: number;
}

interface TradingInterfaceProps {
  token: TokenData;
  onClose: () => void;
  onTrade: (type: 'buy' | 'sell', amount: number) => void;
}

export function TradingInterface({ token, onClose, onTrade }: TradingInterfaceProps) {
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // 计算预计成本
  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
      const amt = parseFloat(amount);
      setEstimatedCost(amt * token.price);
    } else {
      setEstimatedCost(0);
    }
  }, [amount, token.price]);

  // 快速金额选择
  const quickAmounts = [100, 500, 1000, 5000];

  // 最大可买入/卖出数量
  const maxAmount = tradeType === 'buy' ?
    Math.min(10000, (100000 / token.price)) : // 假设预算 10万 USDT
    token.userBalance;

  // 处理快速金额选择
  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  // 处理最大数量
  const handleMaxAmount = () => {
    setAmount(maxAmount.toString());
  };

  // 执行交易
  const handleExecuteTrade = () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      alert('请输入有效数量');
      return;
    }

    const amt = parseFloat(amount);
    if (amt > maxAmount) {
      alert(`${tradeType === 'buy' ? '买入' : '卖出'}数量超过限制`);
      return;
    }

    onTrade(tradeType, amt);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white text-lg">
              {token.symbol.charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{token.name}</h3>
              <p className="text-gray-400">{token.symbol}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Price Info */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-gray-400 text-sm">当前价格</p>
              <p className="text-2xl font-bold text-white">
                {formatPrice(token.price)}
              </p>
            </div>
            <div className={`text-right ${token.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              <p className="text-sm">24h 涨跌</p>
              <p className="text-xl font-bold">
                {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Trade Type Selector */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTradeType('buy')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                tradeType === 'buy' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              买入
            </button>
            <button
              onClick={() => setTradeType('sell')}
              className={`flex-1 py-2 px-4 rounded-md transition-colors ${
                tradeType === 'sell' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              卖出
            </button>
          </div>
        </div>

        {/* Trading Form */}
        <div className="p-6">
          {/* Amount Input */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 font-medium">
                {tradeType === 'buy' ? '买入数量' : '卖出数量'} ({token.symbol})
              </label>
              <button
                onClick={handleMaxAmount}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                最大
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 pr-20 text-white focus:border-blue-500 focus:outline-none text-lg"
                step="0.01"
                min="0"
                max={maxAmount}
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                {token.symbol}
              </span>
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-400">
              <span>可用: {maxAmount.toFixed(2)} {token.symbol}</span>
              <span>≈ {formatPrice(estimatedCost)}</span>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-2">快速选择</p>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  onClick={() => handleQuickAmount(value)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  ${value}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex justify-between items-center w-full text-gray-400 hover:text-white transition-colors"
            >
              <span>高级设置</span>
              <span>{showAdvanced ? '▲' : '▼'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">滑点容忍度</label>
                  <div className="flex gap-2">
                    {[0.1, 0.5, 1.0].map((value) => (
                      <button
                        key={value}
                        onClick={() => setSlippage(value)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                          slippage === value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {value}%
                      </button>
                    ))}
                    <input
                      type="number"
                      value={slippage}
                      onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none text-sm"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">价格</span>
                <span className="text-white">{formatPrice(token.price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">数量</span>
                <span className="text-white">{amount || '0'} {token.symbol}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">预计{tradeType === 'buy' ? '成本' : '收入'}</span>
                <span className="text-white font-semibold">
                  {formatPrice(estimatedCost)}
                </span>
              </div>
              {showAdvanced && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">滑点容忍度</span>
                  <span className="text-white">{slippage}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Execute Button */}
          <Button
            onClick={handleExecuteTrade}
            disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount}
            className={`w-full py-4 text-lg font-semibold ${
              tradeType === 'buy'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {tradeType === 'buy' ? '买入' : '卖出'} {token.symbol}
          </Button>
        </div>

        {/* User Balance */}
        <div className="p-6 border-t border-gray-800 bg-gray-800/50">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">持有数量</span>
            <span className="text-white font-medium">
              {token.userBalance.toFixed(2)} {token.symbol}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="text-gray-400">持有价值</span>
            <span className="text-white font-medium">
              {formatNumber(token.userValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}