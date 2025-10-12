'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { useUniswap, useUniswapOperations } from '@/lib/hooks/useUniswap';
import { formatUnits } from 'viem';

interface FeeClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenId: bigint;
  position: {
    token0: string;
    token1: string;
    tokensOwed0: bigint;
    tokensOwed1: bigint;
    liquidity: bigint;
    token0ValueUSD?: number;
    token1ValueUSD?: number;
  };
}

export const FeeClaimModal: React.FC<FeeClaimModalProps> = ({
  isOpen,
  onClose,
  tokenId,
  position
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [claimedFees, setClaimedFees] = useState<{ amount0: bigint; amount1: bigint } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    collectFees,
    isOperating,
  } = useUniswapOperations();

  // 获取代币符号
  const getTokenSymbol = (address: string) => {
    if (address === '0xd7C597Cf30fb56162AEDAe8a52927B7CE4076e5B') return 'USDT';
    if (address === '0x6a1B8536678C42cacf9e2C6502bffe288c84C8bA') return 'WETH';
    return 'Unknown';
  };

  const token0Symbol = getTokenSymbol(position.token0);
  const token1Symbol = getTokenSymbol(position.token1);

  const totalFeesUSD = (position.token0ValueUSD || 0) + (position.token1ValueUSD || 0);
  const hasFees = position.tokensOwed0 > 0n || position.tokensOwed1 > 0n;

  // 收取手续费
  const handleClaimFees = async () => {
    if (!hasFees) return;

    setIsProcessing(true);
    try {
      const result = await collectFees({
        tokenId: tokenId,
      });

      console.log('✅ 手续费收取成功:', result.hash);

      // 模拟收取到的费用（实际应该从交易结果中获取）
      setClaimedFees({
        amount0: position.tokensOwed0,
        amount1: position.tokensOwed1,
      });

      setShowSuccess(true);

      // 3秒后自动关闭弹窗
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
        setClaimedFees(null);
      }, 3000);

    } catch (error) {
      console.error('❌ 收取手续费失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setClaimedFees(null);
      setShowSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto bg-gray-900 border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              收取手续费
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 成功状态 */}
          {showSuccess && claimedFees && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">手续费收取成功!</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">{token0Symbol}:</span>
                  <span className="text-green-400">
                    {formatUnits(claimedFees.amount0, token0Symbol === 'USDT' ? 6 : 18)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{token1Symbol}:</span>
                  <span className="text-green-400">
                    {formatUnits(claimedFees.amount1, token1Symbol === 'WETH' ? 18 : 6)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 无手续费提示 */}
          {!hasFees && !showSuccess && (
            <Alert className="border-yellow-500/20 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-400">
                当前位置暂无待收取的手续费
              </AlertDescription>
            </Alert>
          )}

          {/* 手续费详情 */}
          {hasFees && !showSuccess && (
            <>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-blue-400 font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    待收取手续费
                  </h4>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    Token #{tokenId}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {/* 代币对信息 */}
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="flex items-center -space-x-2">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                        <span className="text-xs font-bold text-white">{token0Symbol[0]}</span>
                      </div>
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                        <span className="text-xs font-bold text-white">{token1Symbol[0]}</span>
                      </div>
                    </div>
                    <span className="text-white font-medium">
                      {token0Symbol}/{token1Symbol}
                    </span>
                  </div>

                  {/* 手续费明细 */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-800/50 rounded-lg p-3">
                    <div className="text-center">
                      <p className="text-gray-400 text-sm mb-1">{token0Symbol}</p>
                      <p className="text-white font-bold text-lg">
                        {formatUnits(position.tokensOwed0, token0Symbol === 'USDT' ? 6 : 18)}
                      </p>
                      <p className="text-green-400 text-xs">
                        ≈ ${position.token0ValueUSD?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-sm mb-1">{token1Symbol}</p>
                      <p className="text-white font-bold text-lg">
                        {formatUnits(position.tokensOwed1, token1Symbol === 'WETH' ? 18 : 6)}
                      </p>
                      <p className="text-green-400 text-xs">
                        ≈ ${position.token1ValueUSD?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* 总价值 */}
                  <div className="text-center pt-2 border-t border-gray-700">
                    <p className="text-gray-400 text-sm">总手续费价值</p>
                    <p className="text-2xl font-bold text-green-400">
                      ${totalFeesUSD.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 收取历史或统计 */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  手续费统计
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">上次收取</span>
                    <span className="text-white">2天前</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">累计收取</span>
                    <span className="text-white">$1,234.56</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">年化收益率</span>
                    <span className="text-green-400">8.5%</span>
                  </div>
                </div>

                {/* 收取进度条 */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>收取进度</span>
                    <span>75%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              </div>

              {/* 提示信息 */}
              <Alert className="border-blue-500/20 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-400 text-sm">
                  收取手续费不会影响您的流动性位置，只会将累积的手续费转入您的钱包。
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing || showSuccess}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              {showSuccess ? '关闭' : '取消'}
            </Button>

            {hasFees && !showSuccess && (
              <Button
                onClick={handleClaimFees}
                disabled={isProcessing}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    处理中...
                  </div>
                ) : (
                  '收取手续费'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeeClaimModal;