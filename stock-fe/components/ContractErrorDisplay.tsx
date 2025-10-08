"use client";

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContractErrorDisplayProps {
  error: Error | { message: string; code?: string; data?: unknown };
  contractAddress?: string;
  onRetry?: () => void;
}

export function ContractErrorDisplay({ error, contractAddress, onRetry }: ContractErrorDisplayProps) {
  const getErrorDetails = () => {
    if (error?.message?.includes('0x14aebe68')) {
      return {
        title: 'Pyth 价格数据错误',
        description: '无法获取股票的实时价格数据。这通常是因为：',
        solutions: [
          '1. 股票代码未在 Pyth 网络中配置',
          '2. 价格数据暂时不可用',
          '3. OracleAggregator 合约未正确配置',
          '4. 缺少足够的 ETH 用于价格更新费用'
        ]
      };
    }

    if (error?.message?.includes('reverted')) {
      return {
        title: '合约执行失败',
        description: '合约执行时发生错误：',
        solutions: [
          '1. 检查合约是否正确部署',
          '2. 确认合约地址正确',
          '3. 检查网络连接',
          '4. 验证账户权限'
        ]
      };
    }

    return {
      title: '未知错误',
      description: '发生了一个未预期的错误：',
      solutions: [
        '1. 检查网络连接',
        '2. 刷新页面重试',
        '3. 联系技术支持'
      ]
    };
  };

  const errorDetails = getErrorDetails();

  return (
    <div className="p-6 border border-red-500/20 bg-red-500/5 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-red-400 font-semibold mb-2">{errorDetails.title}</h3>
          <p className="text-red-300 text-sm mb-3">{errorDetails.description}</p>

          <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-3">
            <p className="text-xs text-red-400 mb-1">错误详情:</p>
            <p className="text-xs text-red-300 font-mono break-all">{error?.message}</p>
            {contractAddress && (
              <p className="text-xs text-red-300 font-mono mt-1">
                合约地址: {contractAddress}
              </p>
            )}
          </div>

          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">可能的解决方案:</p>
            <ul className="space-y-1">
              {errorDetails.solutions.map((solution, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span className="text-xs">{solution}</span>
                </li>
              ))}
            </ul>
          </div>

          {onRetry && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={onRetry}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重试
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}