'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertTriangle, TrendingUp, Wallet, Droplets, Plus, Minus } from 'lucide-react';
import { useCurve, useCurveTokens, useCurveOperations } from '@/lib/hooks/useCurve';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatUnits, parseUnits, Address } from 'viem';

// 类型定义
interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  balance: string;
}

interface CurveLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

// 代币信息
const TOKENS: TokenInfo[] = [
  {
    address: '0xUSDC',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: '$',
    balance: '0',
  },
  {
    address: '0xUSDT',
    symbol: 'USDT',
    name: 'Tether',
    decimals: 6,
    icon: '₮',
    balance: '0',
  },
  {
    address: '0xDAI',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    icon: '◈',
    balance: '0',
  },
];

export const CurveLiquidityModal: React.FC<CurveLiquidityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Curve hooks
  const { isConnected, poolInfo, initializeCurveTrading, refreshUserInfo } = useCurve();
  const { formattedBalances, needsApproval, approveUSDC, approveUSDT, approveDAI } = useCurveTokens();
  const { isOperating, addLiquidity } = useCurveOperations();

  // 状态管理
  const [amounts, setAmounts] = useState({ USDC: '100', USDT: '100', DAI: '100' });
  const [slippage, setSlippage] = useState(0.5);
  const [step, setStep] = useState<'input' | 'approve' | 'add' | 'success'>('input');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [estimatedLP, setEstimatedLP] = useState<string>('0');

  // 计算属性
  const isInputValid = useMemo(() => {
    return Object.values(amounts).every(amount => amount && parseFloat(amount) > 0);
  }, [amounts]);

  const hasSufficientBalance = useMemo(() => {
    return Object.entries(amounts).every(([symbol, amount]) => {
      const balance = parseFloat(formattedBalances[`${symbol.toLowerCase()}Balance` as keyof typeof formattedBalances] || '0');
      const amountNum = parseFloat(amount);
      return amountNum <= balance;
    });
  }, [amounts, formattedBalances]);

  const totalValue = useMemo(() => {
    return Object.values(amounts).reduce((sum, amount) => sum + parseFloat(amount || '0'), 0);
  }, [amounts]);

  const balanceError = useMemo(() => {
    if (!isInputValid) return null;

    const errors = Object.entries(amounts).map(([symbol, amount]) => {
      const balance = parseFloat(formattedBalances[`${symbol.toLowerCase()}Balance` as keyof typeof formattedBalances] || '0');
      const amountNum = parseFloat(amount);
      if (amountNum > balance) {
        return `${symbol}: 需要 ${amountNum}, 余额 ${balance}`;
      }
      return null;
    }).filter(Boolean);

    return errors.length > 0 ? `余额不足: ${errors.join(', ')}` : null;
  }, [amounts, formattedBalances, isInputValid]);

  // 估算 LP Token 数量
  const estimateLP = useCallback(async () => {
    if (!isInputValid) {
      setEstimatedLP('0');
      return;
    }

    try {
      // 这里可以调用预览函数来估算 LP 数量
      // 简化计算：假设 300 美元 = 1 LP Token
      const lpAmount = totalValue / 300;
      setEstimatedLP(lpAmount.toFixed(6));
    } catch (error) {
      console.error('估算 LP 失败:', error);
      setEstimatedLP('0');
    }
  }, [isInputValid, totalValue]);

  // 更新估算值
  useEffect(() => {
    estimateLP();
  }, [estimateLP]);

  // 自动平衡流动性
  const balanceLiquidity = () => {
    const avgAmount = (totalValue / 3).toFixed(2);
    setAmounts({ USDC: avgAmount, USDT: avgAmount, DAI: avgAmount });
  };

  // 重置状态
  const resetModal = () => {
    setAmounts({ USDC: '100', USDT: '100', DAI: '100' });
    setStep('input');
    setTxHash('');
    setError(null);
    setEstimatedLP('0');
  };

  // 关闭弹窗
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // 处理单个代币金额变化
  const handleAmountChange = (symbol: keyof typeof amounts, value: string) => {
    const numValue = parseFloat(value) || 0;
    if (numValue < 0) return;

    setAmounts(prev => ({
      ...prev,
      [symbol]: value
    }));
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

      // 并行授权所有代币
      const approvals = [];
      if (parseFloat(amounts.USDC) > 0) {
        approvals.push(approveUSDC(amounts.USDC));
      }
      if (parseFloat(amounts.USDT) > 0) {
        approvals.push(approveUSDT(amounts.USDT));
      }
      if (parseFloat(amounts.DAI) > 0) {
        approvals.push(approveDAI(amounts.DAI));
      }

      await Promise.all(approvals);

      // 等待一下让区块链状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 授权成功后自动进入添加流动性步骤
      setStep('add');
      await handleAddLiquidity();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '授权失败';
      setError(errorMessage);
      setStep('input');
    }
  };

  // 处理添加流动性
  const handleAddLiquidity = async () => {
    if (!isConnected || !isInputValid) {
      setError('请先连接钱包并输入有效数量');
      return;
    }

    if (!hasSufficientBalance) {
      setError('余额不足');
      return;
    }

    try {
      setError(null);

      const result = await addLiquidity({
        amounts: [amounts.USDC, amounts.USDT, amounts.DAI],
      });

      setTxHash(result.hash);
      setStep('success');

      // 刷新用户信息
      await refreshUserInfo();

      // 成功回调
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '添加流动性失败';
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Curve 添加流动性</h2>
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

          {/* 池信息 */}
          {poolInfo && (
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Curve 3Pool</h3>
                  <p className="text-sm text-gray-400">USDC / USDT / DAI 稳定币池</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">年化收益率</div>
                  <div className="text-xl font-bold text-green-400">12.5% APY</div>
                </div>
              </div>
            </div>
          )}

          {/* 代币输入 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">添加流动性</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={balanceLiquidity}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                平衡分配
              </Button>
            </div>

            {TOKENS.map((token) => {
              const balance = formattedBalances[`${token.symbol.toLowerCase()}Balance` as keyof typeof formattedBalances] || '0';
              const amount = amounts[token.symbol as keyof typeof amounts];
              const isSufficient = parseFloat(amount || '0') <= parseFloat(balance);

              return (
                <div key={token.symbol} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        token.symbol === 'USDC' ? 'bg-blue-500' :
                        token.symbol === 'USDT' ? 'bg-green-500' :
                        'bg-yellow-500'
                      }`}>
                        <span className="text-sm font-bold text-white">{token.icon}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{token.symbol}</div>
                        <div className="text-sm text-gray-400">
                          余额: {balance}
                          {!isSufficient && (
                            <span className="text-red-400 ml-2">余额不足</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => handleAmountChange(token.symbol as keyof typeof amounts, e.target.value)}
                    placeholder="0.0"
                    className={`bg-gray-900 border-gray-700 text-white text-xl font-mono ${
                      !isSufficient && amount ? 'border-red-500/50' : ''
                    }`}
                    disabled={!isConnected}
                  />
                </div>
              );
            })}
          </div>

          {/* 汇总信息 */}
          {isInputValid && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">汇总信息</h3>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">总投入价值</span>
                  <span className="text-white font-mono">${totalValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">预估 LP Token</span>
                  <span className="text-cyan-400 font-mono">{estimatedLP}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">滑点容忍度</span>
                  <span className="text-white font-mono">{slippage.toFixed(1)}%</span>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">预估收益</span>
                    <span className="text-green-400 font-semibold">12.5% APY</span>
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
                  添加流动性需要授权 USDC、USDT 和 DAI 给 Curve 适配器合约
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
              step === 'input' ? 'bg-cyan-500' :
              step === 'approve' ? 'bg-yellow-500' :
              step === 'add' ? 'bg-purple-500' :
              'bg-green-500'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'approve' || step === 'add' || step === 'success' ? 'bg-yellow-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'add' || step === 'success' ? 'bg-purple-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'success' ? 'bg-green-500' : 'bg-gray-700'
            }`} />
          </div>

          {/* 根据步骤显示不同内容 */}
          {step === 'input' && (
            <>
              {/* 余额不足提示 */}
              {balanceError && (
                <Alert className="border-yellow-500/20 bg-yellow-500/10">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <AlertDescription className="text-yellow-400">
                    {balanceError}
                  </AlertDescription>
                </Alert>
              )}

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
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                  >
                    {isOperating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <Droplets className="w-4 h-4 mr-2" />
                        授权并添加流动性
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
                  正在授权 USDC、USDT 和 DAI 给 Curve 适配器
                </p>
                <div className="mt-4 space-y-2">
                  {Object.entries(amounts).map(([symbol, amount], index) => (
                    parseFloat(amount) > 0 && (
                      <div key={symbol} className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"
                             style={{ animationDelay: `${index * 0.2}s` }}></div>
                        <span className="text-xs text-gray-400">{symbol} 授权</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 添加流动性步骤 */}
          {step === 'add' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">添加流动性中</h3>
                <p className="text-sm text-gray-400">
                  正在向 Curve 3Pool 添加流动性
                </p>
                <div className="mt-4 space-y-1">
                  {Object.entries(amounts).map(([symbol, amount]) => (
                    parseFloat(amount) > 0 && (
                      <div key={symbol} className="text-xs text-gray-400">
                        {symbol}: {amount}
                      </div>
                    )
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
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">添加流动性成功！</h3>
                <p className="text-sm text-gray-400 mb-4">
                  成功向 Curve 3Pool 添加了总价值 ${totalValue.toFixed(2)} 的流动性
                </p>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-1">预估获得 LP Token</p>
                  <p className="text-lg text-cyan-400 font-mono">{estimatedLP} LP</p>
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

export default CurveLiquidityModal;