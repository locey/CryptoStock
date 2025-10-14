'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertTriangle, TrendingDown, Wallet, Droplets, ArrowUpRight } from 'lucide-react';
import { useCurve, useCurveTokens, useCurveOperations } from '@/lib/hooks/useCurve';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatUnits, parseUnits, Address } from 'viem';

// 类型定义
interface CurveWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

// 代币信息
const TOKENS = [
  { symbol: 'USDC', name: 'USD Coin', icon: '$', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', icon: '₮', decimals: 6 },
  { symbol: 'DAI', name: 'Dai Stablecoin', icon: '◈', decimals: 18 },
];

export const CurveWithdrawModal: React.FC<CurveWithdrawModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Curve hooks
  const { isConnected, poolInfo, initializeCurveTrading, refreshUserInfo } = useCurve();
  const { formattedBalances, needsApproval, approveLPToken } = useCurveTokens();
  const { isOperating, removeLiquidity } = useCurveOperations();

  // 状态管理
  const [lpAmount, setLpAmount] = useState('0');
  const [percentage, setPercentage] = useState(0);
  const [slippage, setSlippage] = useState(0.5);
  const [step, setStep] = useState<'input' | 'approve' | 'withdraw' | 'success'>('input');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [estimatedReturns, setEstimatedReturns] = useState({
    USDC: '0',
    USDT: '0',
    DAI: '0',
  });

  // 计算属性
  const maxLPAmount = formattedBalances.lpTokenBalance || '0';
  const lpValueUSD = (parseFloat(lpAmount) || 0) * 300; // 简化计算：1 LP = 300 USD

  const isInputValid = useMemo(() => {
    return lpAmount && parseFloat(lpAmount) > 0;
  }, [lpAmount]);

  const hasSufficientBalance = useMemo(() => {
    const balance = parseFloat(maxLPAmount);
    const amount = parseFloat(lpAmount);
    return amount <= balance;
  }, [lpAmount, maxLPAmount]);

  // 设置百分比
  const setPercentageAmount = (percent: number) => {
    setPercentage(percent);
    const amount = (parseFloat(maxLPAmount) * percent / 100).toFixed(6);
    setLpAmount(amount);
  };

  // 估算回报
  const estimateReturns = useCallback(async () => {
    if (!isInputValid) {
      setEstimatedReturns({ USDC: '0', USDT: '0', DAI: '0' });
      return;
    }

    try {
      // 简化计算：平均分配
      const totalValue = lpValueUSD;
      const perToken = totalValue / 3;

      setEstimatedReturns({
        USDC: perToken.toFixed(2),
        USDT: perToken.toFixed(2),
        DAI: perToken.toFixed(2),
      });
    } catch (error) {
      console.error('估算回报失败:', error);
      setEstimatedReturns({ USDC: '0', USDT: '0', DAI: '0' });
    }
  }, [isInputValid, lpValueUSD]);

  // 更新估算值
  useEffect(() => {
    estimateReturns();
  }, [estimateReturns]);

  // 自动计算百分比
  useEffect(() => {
    if (lpAmount && maxLPAmount) {
      const amount = parseFloat(lpAmount);
      const max = parseFloat(maxLPAmount);
      const percent = max > 0 ? (amount / max) * 100 : 0;
      setPercentage(Math.min(percent, 100));
    }
  }, [lpAmount, maxLPAmount]);

  // 重置状态
  const resetModal = () => {
    setLpAmount('0');
    setPercentage(0);
    setStep('input');
    setTxHash('');
    setError(null);
    setEstimatedReturns({ USDC: '0', USDT: '0', DAI: '0' });
  };

  // 关闭弹窗
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // 处理授权
  const handleApprove = async () => {
    if (!isConnected || !isInputValid) {
      setError('请先连接钱包并输入有效数量');
      return;
    }

    try {
      setStep('approve');
      setError(null);

      // 授权 LP Token
      await approveLPToken(lpAmount);

      // 等待一下让区块链状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 授权成功后自动进入提取流动性步骤
      setStep('withdraw');
      await handleWithdrawLiquidity();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '授权失败';
      setError(errorMessage);
      setStep('input');
    }
  };

  // 处理提取流动性
  const handleWithdrawLiquidity = async () => {
    if (!isConnected || !isInputValid) {
      setError('请先连接钱包并输入有效数量');
      return;
    }

    if (!hasSufficientBalance) {
      setError('LP Token 余额不足');
      return;
    }

    try {
      setError(null);

      const result = await removeLiquidity({
        lpAmount,
      });

      setTxHash(result.hash);
      setStep('success');

      // 刷新用户信息
      await refreshUserInfo();

      // 成功回调
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '提取流动性失败';
      setError(errorMessage);
      setStep('input');
    }
  };

  // 处理确认操作
  const handleConfirm = async () => {
    if (!isConnected) return;

    await handleApprove();
  };

  // 自动初始化
  useEffect(() => {
    if (isOpen && isConnected) {
      initializeCurveTrading();
    }
  }, [isOpen, isConnected, initializeCurveTrading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">提取流动性</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 钱包连接状态 */}
          {!isConnected && (
            <Alert className="border-yellow-500/20 bg-yellow-500/10">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <AlertDescription className="text-yellow-400">
                请先连接钱包以继续操作
              </AlertDescription>
            </Alert>
          )}

          {/* LP Token 余额信息 */}
          <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">LP Token 余额</h3>
                <p className="text-sm text-gray-400">Curve 3Pool</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{maxLPAmount}</div>
                <div className="text-sm text-gray-400">LP Token</div>
              </div>
            </div>
          </div>

          {/* LP Token 输入 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">提取数量</h3>

            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                    <Droplets className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">LP Token</div>
                    <div className="text-sm text-gray-400">
                      余额: {maxLPAmount}
                      {!hasSufficientBalance && lpAmount && (
                        <span className="text-red-400 ml-2">余额不足</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Input
                type="number"
                value={lpAmount}
                onChange={(e) => setLpAmount(e.target.value)}
                placeholder="0.0"
                className={`bg-gray-900 border-gray-700 text-white text-xl font-mono ${
                  !hasSufficientBalance && lpAmount ? 'border-red-500/50' : ''
                }`}
                disabled={!isConnected}
              />
            </div>

            {/* 快速选择按钮 */}
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((percent) => (
                <Button
                  key={percent}
                  variant="outline"
                  size="sm"
                  onClick={() => setPercentageAmount(percent)}
                  className={`border-cyan-500/30 ${
                    percentage === percent
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500'
                      : 'text-gray-400 hover:bg-cyan-500/10'
                  }`}
                  disabled={!isConnected || parseFloat(maxLPAmount) === 0}
                >
                  {percent}%
                </Button>
              ))}
            </div>

            {/* 百分比滑块 */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-gray-400">提取比例</Label>
                <span className="text-white font-mono">{percentage.toFixed(1)}%</span>
              </div>
              <Slider
                value={[percentage]}
                onValueChange={(value: number[]) => {
                  const percent = value[0];
                  setPercentage(percent);
                  const amount = (parseFloat(maxLPAmount) * percent / 100).toFixed(6);
                  setLpAmount(amount);
                }}
                max={100}
                min={0}
                step={0.1}
                className="mt-2"
              />
            </div>
          </div>

          {/* 预估回报 */}
          {isInputValid && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">预估回报</h3>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">总价值</span>
                  <span className="text-white font-mono">${lpValueUSD.toFixed(2)}</span>
                </div>

                <div className="border-t border-gray-700 pt-3 space-y-2">
                  {TOKENS.map((token) => (
                    <div key={token.symbol} className="flex justify-between">
                      <span className="text-gray-400">{token.symbol}</span>
                      <span className="text-white font-mono">
                        {estimatedReturns[token.symbol as keyof typeof estimatedReturns]}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-700 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">滑点容忍度</span>
                    <span className="text-white font-mono">{slippage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 滑点设置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">滑点设置</h3>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-400">滑点容忍度</Label>
                  <span className="text-white font-mono">{slippage.toFixed(1)}%</span>
                </div>
                <Slider
                  value={[slippage]}
                  onValueChange={(value: number[]) => setSlippage(value[0])}
                  max={5}
                  min={0.1}
                  step={0.1}
                  className="mt-2"
                />
              </div>
              <div className="text-sm text-gray-400">
                <p>⚠️ 较高的滑点容忍度可能导致交易失败</p>
              </div>
            </div>
          </div>

          {/* 授权说明 */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-semibold text-blue-400">需要授权</h3>
                <p className="text-xs text-gray-400">
                  提取流动性需要授权 LP Token 给 Curve 适配器合约
                </p>
              </div>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-red-400">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* 步骤指示器 */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'input' ? 'bg-red-500' :
              step === 'approve' ? 'bg-yellow-500' :
              step === 'withdraw' ? 'bg-purple-500' :
              'bg-green-500'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'approve' || step === 'withdraw' || step === 'success' ? 'bg-yellow-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'withdraw' || step === 'success' ? 'bg-purple-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'success' ? 'bg-green-500' : 'bg-gray-700'
            }`} />
          </div>

          {/* 根据步骤显示不同内容 */}
          {step === 'input' && (
            <>
              {/* 确认按钮 */}
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-gray-700 text-white hover:bg-gray-800"
                  disabled={isOperating}
                >
                  取消
                </Button>

                {!isConnected ? (
                  <Button
                    className="flex-1 bg-gray-600 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    请连接钱包
                  </Button>
                ) : (
                  <Button
                    onClick={handleConfirm}
                    disabled={!isInputValid || !hasSufficientBalance || isOperating}
                    className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
                  >
                    {isOperating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-4 h-4 mr-2" />
                        授权并提取流动性
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* 授权步骤 */}
          {step === 'approve' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">授权中</h3>
                <p className="text-sm text-gray-400">
                  正在授权 LP Token 给 Curve 适配器
                </p>
                <div className="mt-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">LP Token 授权</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 提取流动性步骤 */}
          {step === 'withdraw' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">提取流动性中</h3>
                <p className="text-sm text-gray-400">
                  正在从 Curve 3Pool 提取 {lpAmount} LP Token
                </p>
                <div className="mt-4 space-y-1 text-sm text-gray-400">
                  <p>预估回报:</p>
                  {Object.entries(estimatedReturns).map(([symbol, amount]) => (
                    <p key={symbol}>{symbol}: {amount}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 成功步骤 */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingDown className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">提取流动性成功！</h3>
                <p className="text-sm text-gray-400 mb-4">
                  成功提取 {lpAmount} LP Token
                </p>

                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-2">获得代币:</p>
                  {Object.entries(estimatedReturns).map(([symbol, amount]) => (
                    <div key={symbol} className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{symbol}:</span>
                      <span className="text-white font-mono">{amount}</span>
                    </div>
                  ))}
                </div>

                {/* 交易哈希 */}
                {txHash && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">交易哈希</p>
                    <p className="text-xs text-blue-400 break-all font-mono">
                      {txHash}
                    </p>
                  </div>
                )}
              </div>

              {/* 完成按钮 */}
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all"
              >
                完成
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CurveWithdrawModal;