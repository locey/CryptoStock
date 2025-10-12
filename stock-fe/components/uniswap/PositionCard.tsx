'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  DollarSign,
  Settings,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useUniswap, useUniswapOperations } from '@/lib/hooks/useUniswap';
import { formatUnits } from 'viem';

interface PositionCardProps {
  position: {
    tokenId: bigint;
    token0: string;
    token1: string;
    liquidity: bigint;
    tokensOwed0: bigint;
    tokensOwed1: bigint;
    tickLower: number;
    tickUpper: number;
    fee: number;
    token0ValueUSD?: number;
    token1ValueUSD?: number;
    formattedLiquidity?: string;
    formattedTokensOwed0?: string;
    formattedTokensOwed1?: string;
    totalFeesUSD?: number;
  };
  onSelect?: (position: any) => void;
  isSelected?: boolean;
  onRefresh?: () => void;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onSelect,
  isSelected = false,
  onRefresh
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showFeesModal, setShowFeesModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const {
    selectPosition,
  } = useUniswap();

  const {
    isOperating,
    collectFees,
    removeLiquidity,
  } = useUniswapOperations();

  const totalValue = (position.token0ValueUSD || 0) + (position.token1ValueUSD || 0);
  const hasFees = position.tokensOwed0 > 0n || position.tokensOwed1 > 0n;

  // 获取代币符号
  const getTokenSymbol = (address: string) => {
    if (address === '0xd7C597Cf30fb56162AEDAe8a52927B7CE4076e5B') return 'USDT';
    if (address === '0x6a1B8536678C42cacf9e2C6502bffe288c84C8bA') return 'WETH';
    return 'Unknown';
  };

  const token0Symbol = getTokenSymbol(position.token0);
  const token1Symbol = getTokenSymbol(position.token1);

  // 处理位置选择
  const handleSelect = () => {
    // 构造一个符合 UniswapPositionInfo 类型的对象
    const fullPosition = {
      ...position,
      nonce: BigInt(0), // 添加缺失的属性
      operator: '0x0000000000000000000000000000000000000000' as `0x${string}`,
      token0: position.token0 as `0x${string}`, // 类型转换
      token1: position.token1 as `0x${string}`, // 类型转换
      feeGrowthInside0LastX128: BigInt(0),
      feeGrowthInside1LastX128: BigInt(0),
      // 确保必需的格式化字段存在
      formattedLiquidity: position.formattedLiquidity || '0',
      formattedTokensOwed0: position.formattedTokensOwed0 || '0',
      formattedTokensOwed1: position.formattedTokensOwed1 || '0',
      totalFeesUSD: position.totalFeesUSD || 0,
    };
    selectPosition(fullPosition);
    onSelect?.(position);
  };

  // 收取手续费
  const handleCollectFees = async () => {
    try {
      const result = await collectFees({
        tokenId: position.tokenId,
      });

      console.log('✅ 手续费收取成功:', result.hash);
      setShowFeesModal(false);
      onRefresh?.();
    } catch (error) {
      console.error('❌ 收取手续费失败:', error);
    }
  };

  // 移除流动性
  const handleRemoveLiquidity = async () => {
    try {
      const result = await removeLiquidity({
        tokenId: position.tokenId,
      });

      console.log('✅ 移除流动性成功:', result.hash);
      setShowRemoveModal(false);
      onRefresh?.();
    } catch (error) {
      console.error('❌ 移除流动性失败:', error);
    }
  };

  return (
    <>
      <Card
        className={`bg-gray-900 border-gray-800 hover:border-blue-500/50 transition-all duration-300 ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 代币图标 */}
              <div className="flex items-center -space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-sm font-bold text-white">{token0Symbol[0]}</span>
                </div>
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-sm font-bold text-white">{token1Symbol[0]}</span>
                </div>
              </div>

              {/* 位置信息 */}
              <div>
                <CardTitle className="text-lg text-white">
                  {token0Symbol}/{token1Symbol}
                </CardTitle>
                <p className="text-sm text-gray-400">Token ID: #{position.tokenId}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 状态标签 */}
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Active
              </Badge>

              {/* 操作按钮 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDetails(!showDetails)}
                className="text-gray-400 hover:text-white"
              >
                <Settings className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isOperating}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${isOperating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 价值统计 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">总价值</span>
              </div>
              <div className="text-xl font-bold text-white">
                ${totalValue.toLocaleString()}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">待收取手续费</span>
              </div>
              <div className="text-xl font-bold text-green-400">
                ${position.totalFeesUSD?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          {/* 流动性信息 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">流动性</span>
              <span className="text-white">
                {position.formattedLiquidity || formatUnits(position.liquidity, 18)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">价格区间</span>
              <span className="text-white">
                [{position.tickLower}, {position.tickUpper}]
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">手续费率</span>
              <span className="text-white">{position.fee / 10000}%</span>
            </div>
          </div>

          {/* 待收取手续费详情 */}
          {hasFees && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-yellow-400 font-medium">可收取手续费</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">{token0Symbol}: </span>
                  <span className="text-white">
                    {position.formattedTokensOwed0 || formatUnits(position.tokensOwed0, 6)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">{token1Symbol}: </span>
                  <span className="text-white">
                    {position.formattedTokensOwed1 || formatUnits(position.tokensOwed1, 18)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 详细信息（可展开） */}
          {showDetails && (
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <h4 className="text-white font-medium">详细信息</h4>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Token0 地址:</span>
                  <p className="text-white font-mono text-xs break-all">
                    {position.token0}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Token1 地址:</span>
                  <p className="text-white font-mono text-xs break-all">
                    {position.token1}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">流动性进度</span>
                <span className="text-white text-sm">75%</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelect}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              选择
            </Button>

            {hasFees && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFeesModal(true)}
                disabled={isOperating}
                className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
              >
                收取手续费
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRemoveModal(true)}
              disabled={isOperating}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 收取手续费确认弹窗 */}
      {showFeesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md mx-auto bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">收取手续费</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h4 className="text-yellow-400 font-medium mb-2">待收取手续费</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">{token0Symbol}:</span>
                    <span className="text-white">
                      {position.formattedTokensOwed0 || formatUnits(position.tokensOwed0, 6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">{token1Symbol}:</span>
                    <span className="text-white">
                      {position.formattedTokensOwed1 || formatUnits(position.tokensOwed1, 18)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowFeesModal(false)}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  取消
                </Button>
                <Button
                  onClick={handleCollectFees}
                  disabled={isOperating}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                >
                  {isOperating ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      处理中...
                    </div>
                  ) : (
                    '确认收取'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 移除流动性确认弹窗 */}
      {showRemoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md mx-auto bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                移除流动性
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <p className="text-gray-300 mb-2">
                  确定要移除此流动性位置吗？
                </p>
                <p className="text-sm text-gray-400">
                  移除后，您的流动性将被返还，但可能会影响您的手续费收益。
                </p>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Token ID:</span>
                  <span className="text-white">#{position.tokenId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">代币对:</span>
                  <span className="text-white">{token0Symbol}/{token1Symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">当前价值:</span>
                  <span className="text-white">${totalValue.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveModal(false)}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  取消
                </Button>
                <Button
                  onClick={handleRemoveLiquidity}
                  disabled={isOperating}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {isOperating ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      处理中...
                    </div>
                  ) : (
                    '确认移除'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default PositionCard;