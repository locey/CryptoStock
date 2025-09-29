"use client";

import { Button } from "@/components/ui/button";

interface StockCardProps {
  symbol: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
  volume?: string;
}

export function StockCard({ symbol, name, price, change, isPositive, volume }: StockCardProps) {
  return (
    <div className="group bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-blue-500 transition-all duration-500 card-hover-3d glow-effect">
      {/* Animated background */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      {/* Glow effect for positive changes */}
      {isPositive && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
      )}

      <div className="flex items-start justify-between mb-4 relative z-10">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1 transform transition-transform duration-500 group-hover:translate-x-1">{name}</h3>
          <p className="text-gray-400 text-sm transform transition-all duration-500 group-hover:text-gray-300">{symbol}</p>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold mb-1 transform transition-all duration-500 group-hover:scale-110 ${isPositive ? 'text-green-400 neon-text' : 'text-red-400'}`}>
            {price}
          </div>
          <div className={`text-sm font-semibold transform transition-all duration-500 group-hover:scale-110 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{change}
          </div>
        </div>
      </div>

      {volume && (
        <div className="text-xs text-gray-500 mb-4 transform transition-all duration-500 group-hover:text-gray-400">
          Volume: {volume}
        </div>
      )}

      <div className="flex gap-2 relative z-10">
        <Button size="sm" className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-chinese transform transition-all duration-500 hover:scale-105 glow-effect">
          买入
        </Button>
        <Button size="sm" variant="outline" className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white font-chinese transform transition-all duration-500 hover:scale-105">
          卖出
        </Button>
      </div>
    </div>
  );
}