"use client";

import { X, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  oracleAddress: `0x${string}`;
  usdtAddress: `0x${string}`;
}

export function SellModal({ isOpen, onClose, token, oracleAddress, usdtAddress }: SellModalProps) {
  const isPositive = token.change24h >= 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isPositive ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-orange-600'
            }`}>
              <span className="text-white font-bold text-lg">{token.symbol[0]}</span>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">卖出 {token.symbol}</h3>
              <div className="flex items-center gap-1">
                <span className="text-white">${token.price}</span>
                <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{Math.abs(token.change24h).toFixed(2)}%</span>
                </div>
              </div>
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
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">卖出功能开发中...</div>
            <div className="text-sm text-gray-500">
              <p>当前价格: ${token.price}</p>
              <p>24小时变化: {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-800 space-y-3">
          <Button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold rounded-xl transition-all"
          >
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
}