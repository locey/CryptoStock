"use client";

import { Database, Globe, AlertTriangle } from 'lucide-react';

interface PriceSourceIndicatorProps {
  source: 'contract' | 'hermes' | 'fallback';
  lastUpdate?: number;
  className?: string;
}

export function PriceSourceIndicator({ source, lastUpdate, className }: PriceSourceIndicatorProps) {
  const getSourceInfo = () => {
    switch (source) {
      case 'contract':
        return {
          icon: Database,
          label: '链上数据',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          description: '来自智能合约的实时价格'
        };
      case 'hermes':
        return {
          icon: Globe,
          label: 'Hermes API',
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          description: '来自 Pyth Hermes API 的价格数据'
        };
      case 'fallback':
        return {
          icon: AlertTriangle,
          label: '默认值',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          description: '价格数据暂时不可用'
        };
      default:
        return {
          icon: AlertTriangle,
          label: '未知',
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          description: '未知的数据源'
        };
    }
  };

  const sourceInfo = getSourceInfo();
  const Icon = sourceInfo.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${sourceInfo.bgColor} ${className}`}>
      <Icon className={`w-4 h-4 ${sourceInfo.color}`} />
      <div className="flex items-center gap-1">
        <span className={`text-xs font-medium ${sourceInfo.color}`}>
          {sourceInfo.label}
        </span>
        {lastUpdate && (
          <span className="text-xs text-gray-400">
            {formatTime(lastUpdate)}
          </span>
        )}
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) { // 小于1分钟
    return `${Math.floor(diff / 1000)}s前`;
  } else if (diff < 3600000) { // 小于1小时
    return `${Math.floor(diff / 60000)}m前`;
  } else {
    return `${Math.floor(diff / 3600000)}h前`;
  }
}