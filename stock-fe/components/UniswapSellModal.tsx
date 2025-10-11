'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertTriangle, TrendingUp, Wallet, ArrowDownUp, DollarSign } from 'lucide-react';
import { useUniswap, useUniswapTokens, useUniswapOperations, useUniswapPositions } from '@/lib/hooks/useUniswap';
import useUniswapStore from '@/lib/stores/useUniswapStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatUnits, parseUnits, Address } from 'viem';
import { UNISWAP_CONFIG } from '@/lib/config/loadContracts';

// 类型定义
interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
}

interface UniswapPositionInfo {
  tokenId: bigint;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  tokensOwed0: string;
  tokensOwed1: string;
  formattedLiquidity: string;
  formattedTokensOwed0: string;
  formattedTokensOwed1: string;
  totalFeesUSD: number;
}

interface UniswapSellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  defaultPosition?: UniswapPositionInfo | null;
}

// 代币信息
const TOKENS: Record<string, TokenInfo> = {
  USDT: {
    address: UNISWAP_CONFIG.tokens.USDT.address,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    icon: '/tokens/usdt.png',
  },
  WETH: {
    address: UNISWAP_CONFIG.tokens.WETH.address,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    icon: '/tokens/weth.png',
  },
};

export const UniswapSellModal: React.FC<UniswapSellModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultPosition = null,
}) => {
  // Uniswap hooks
  const { isConnected, refreshUserInfo } = useUniswap();
  const { formattedBalances, approveNFT, approveAllNFT, fetchAllowances } = useUniswapTokens();
  const { isOperating, removeLiquidity, collectFees } = useUniswapOperations();
  const { userPositions, fetchUserPositions } = useUniswapPositions();

  // 直接从 store 获取最新的 userPositions (绕过 hook 层面的问题)
  const storeUserPositions = useUniswapStore((state) => state.userPositions);

  // 调试日志：比较 hook 和 store 的数据
  console.log('🔍 [DEBUG] Hook vs Store userPositions 对比:', {
    hookLength: userPositions.length,
    storeLength: storeUserPositions.length,
    hookPositions: userPositions,
    storePositions: storeUserPositions,
    timestamp: new Date().toISOString()
  });

  // 调试日志：监控 userPositions 变化
  console.log('🔍 [DEBUG] UniswapSellModal - userPositions 状态:', {
    userPositionsLength: storeUserPositions.length,
    userPositions: storeUserPositions,
    isConnected
  });

  // 状态管理
  const [selectedPosition, setSelectedPosition] = useState<UniswapPositionInfo | null>(defaultPosition);
  const [operationType, setOperationType] = useState<'remove' | 'collect'>('remove');
  const [slippage, setSlippage] = useState(1.0);
  const [step, setStep] = useState<'select' | 'approve' | 'remove' | 'collect' | 'success'>('select');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // 自动选择第一个位置
  useEffect(() => {
    console.log('🔍 [DEBUG] UniswapSellModal - 检查用户位置状态:', {
      userPositionsLength: storeUserPositions.length,
      positions: storeUserPositions,
      isConnected,
      selectedPosition: selectedPosition
    });

    if (storeUserPositions.length > 0 && !selectedPosition) {
      setSelectedPosition(storeUserPositions[0]);
      console.log('🔍 [DEBUG] 自动选择第一个位置:', storeUserPositions[0]);
    }
  }, [storeUserPositions, selectedPosition, isConnected]);

  // 自动刷新位置信息
  useEffect(() => {
    console.log('🔍 [DEBUG] UniswapSellModal useEffect 触发:', {
      isOpen,
      isConnected,
      timestamp: new Date().toISOString()
    });

    if (isOpen && isConnected) {
      console.log('🔍 [DEBUG] UniswapSellModal: 开始刷新位置信息...');
      console.log('🔍 [DEBUG] 当前用户位置数量:', storeUserPositions.length);
      console.log('🔍 [DEBUG] 用户地址:', formattedBalances.address || '未连接');

      fetchUserPositions().then(() => {
        // 使用 setTimeout 确保 store 更新后再读取
        setTimeout(() => {
          console.log('🔍 [DEBUG] fetchUserPositions 完成，新位置数量:', storeUserPositions.length);
          console.log('🔍 [DEBUG] fetchUserPositions 完成，位置详情:', userPositions);
        }, 100);
      }).catch((error) => {
        console.error('❌ fetchUserPositions 失败:', error);
      });

      refreshUserInfo().then(() => {
        console.log('🔍 [DEBUG] refreshUserInfo 完成');
      }).catch((error) => {
        console.error('❌ refreshUserInfo 失败:', error);
      });
    }
  }, [isOpen, isConnected, fetchUserPositions, refreshUserInfo, formattedBalances.address]);

  // 计算属性
  const hasPositions = useMemo(() => {
    console.log('🔍 [DEBUG] hasPositions 检查:', {
      userPositionsLength: storeUserPositions.length,
      hasPositionsResult: storeUserPositions.length > 0,
      positions: storeUserPositions,
      formattedBalances,
      selectedPosition
    });
    return storeUserPositions.length > 0;
  }, [storeUserPositions, formattedBalances, selectedPosition]);

  const hasSufficientPosition = useMemo(() => {
    if (!selectedPosition) return false;
    if (operationType === 'remove') {
      return parseFloat(selectedPosition.formattedLiquidity) > 0;
    } else {
      return parseFloat(selectedPosition.formattedTokensOwed0) > 0 ||
             parseFloat(selectedPosition.formattedTokensOwed1) > 0;
    }
  }, [selectedPosition, operationType]);

  // 计算预期收回金额
  const expectedWithdrawals = useMemo(() => {
    if (!selectedPosition) return { token0Amount: '0', token1Amount: '0' };

    if (operationType === 'collect') {
      return {
        token0Amount: selectedPosition.formattedTokensOwed0,
        token1Amount: selectedPosition.formattedTokensOwed1,
      };
    } else {
      // 对于移除流动性，这是估算值
      const liquidityValue = parseFloat(selectedPosition.formattedLiquidity);
      // 简化计算：假设流动性价值等比例分配
      const totalLiquidityValue = selectedPosition.totalFeesUSD || liquidityValue * 1000;
      const ratio0 = 0.5; // 假设50%在token0
      const ratio1 = 0.5; // 假设50%在token1

      return {
        token0Amount: (totalLiquidityValue * ratio0).toFixed(2),
        token1Amount: (totalLiquidityValue * ratio1).toFixed(6),
      };
    }
  }, [selectedPosition, operationType]);

  // 重置状态
  const resetModal = () => {
    setSelectedPosition(defaultPosition);
    setOperationType('remove');
    setSlippage(1.0);
    setStep('select');
    setTxHash('');
    setError(null);
  };

  // 关闭弹窗
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // 处理NFT授权
  const handleApproveNFT = async () => {
    if (!isConnected || !selectedPosition) {
      setError('请先连接钱包并选择流动性位置');
      return;
    }

    try {
      setStep('approve');
      setError(null);

      console.log('🔑 开始NFT授权流程...');

      // 优先使用全局授权（如果还没有授权）
      console.log('📝 执行全局NFT授权...');
      await approveAllNFT();
      console.log('✅ 全局NFT授权完成');

      // 如果全局授权失败，尝试单个NFT授权
      console.log('📝 备用：单个NFT授权...');
      await approveNFT(selectedPosition.tokenId);
      console.log('✅ 单个NFT授权完成');

      // 根据操作类型进入下一步
      setStep(operationType);

      // 自动执行操作
      if (operationType === 'remove') {
        await handleRemoveLiquidity();
      } else {
        await handleCollectFees();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'NFT授权失败';
      setError(errorMessage);
      setStep('select');
    }
  };

  // 处理移除流动性
  const handleRemoveLiquidity = async () => {
    if (!isConnected || !selectedPosition) {
      setError('请先连接钱包并选择流动性位置');
      return;
    }

    try {
      setError(null);
      const { amount0Min, amount1Min } = calculateMinAmounts();

      const removeParams = {
        tokenId: selectedPosition.tokenId,
        amount0Min,
        amount1Min,
        recipient: undefined, // 使用默认用户地址
      };

      console.log('🔍 [DEBUG] 移除流动性参数:', removeParams);

      const result = await removeLiquidity(removeParams);
      setTxHash(result.hash);
      setStep('success');
      console.log('移除流动性成功:', result);

      // 刷新用户信息
      await refreshUserInfo();
      await fetchUserPositions();

      // 成功回调
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '移除流动性失败';
      setError(errorMessage);
      setStep('select');
    }
  };

  // 处理收取手续费
  const handleCollectFees = async () => {
    if (!isConnected || !selectedPosition) {
      setError('请先连接钱包并选择流动性位置');
      return;
    }

    try {
      setError(null);

      const collectParams = {
        tokenId: selectedPosition.tokenId,
        recipient: undefined, // 使用默认用户地址
      };

      console.log('🔍 [DEBUG] 收取手续费参数:', collectParams);

      const result = await collectFees(collectParams);
      setTxHash(result.hash);
      setStep('success');
      console.log('收取手续费成功:', result);

      // 刷新用户信息
      await refreshUserInfo();
      await fetchUserPositions();

      // 成功回调
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '收取手续费失败';
      setError(errorMessage);
      setStep('select');
    }
  };

  // 计算最小数量（基于滑点）
  const calculateMinAmounts = () => {
    if (!expectedWithdrawals.token0Amount || !expectedWithdrawals.token1Amount) {
      return { amount0Min: '0', amount1Min: '0' };
    }

    const amount0Min = parseFloat(expectedWithdrawals.token0Amount) * (1 - slippage / 100);
    const amount1Min = parseFloat(expectedWithdrawals.token1Amount) * (1 - slippage / 100);

    return {
      amount0Min: amount0Min.toFixed(TOKENS.USDT.decimals),
      amount1Min: amount1Min.toFixed(TOKENS.WETH.decimals),
    };
  };

  // 处理确认操作
  const handleConfirm = async () => {
    if (!isConnected) return;

    // 先授权NFT，然后自动执行操作
    await handleApproveNFT();
  };

  // 处理操作类型切换
  const handleOperationTypeChange = (type: 'remove' | 'collect') => {
    setOperationType(type);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">
            {operationType === 'remove' ? '移除流动性' : '收取手续费'}
          </h2>
          <button
            onClick={handleClose}
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

          {/* 操作类型选择 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5" />
              选择操作类型
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleOperationTypeChange('remove')}
                className={`p-4 rounded-lg border transition-all ${
                  operationType === 'remove'
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="font-semibold mb-1">移除流动性</div>
                <div className="text-xs opacity-80">完全撤出流动性位置</div>
              </button>
              <button
                onClick={() => handleOperationTypeChange('collect')}
                className={`p-4 rounded-lg border transition-all ${
                  operationType === 'collect'
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="font-semibold mb-1">收取手续费</div>
                <div className="text-xs opacity-80">只收取累积的手续费</div>
              </button>
            </div>
          </div>

          {/* 流动性位置选择 */}
          {hasPositions && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">选择流动性位置</h3>
              <div className="space-y-3">
                {storeUserPositions.map((position) => (
                  <button
                    key={position.tokenId.toString()}
                    onClick={() => setSelectedPosition(position)}
                    className={`w-full p-4 rounded-lg border transition-all ${
                      selectedPosition?.tokenId === position.tokenId
                        ? 'bg-blue-500/20 border-blue-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-mono">Token #{position.tokenId.toString()}</span>
                      <span className="text-sm text-gray-400">
                        流动性: {position.formattedLiquidity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        价格区间: [{position.tickLower}, {position.tickUpper}]
                      </span>
                      <span className="text-green-400">
                        手续费: ${position.totalFeesUSD.toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 无流动性位置 */}
          {!hasPositions && isConnected && (
            <Alert className="border-blue-500/20 bg-blue-500/10">
              <AlertTriangle className="w-4 h-4 text-blue-400" />
              <AlertDescription className="text-blue-400">
                您还没有流动性位置。请先添加流动性。
              </AlertDescription>
              <div className="text-xs text-blue-300 mt-2">
                <div>调试信息:</div>
                <div>- 用户地址: {formattedBalances.address || '未连接'}</div>
                <div>- 连接状态: {isConnected ? '已连接' : '未连接'}</div>
                <div>- 位置数量: {storeUserPositions.length}</div>
                <div>- 位置列表: {storeUserPositions.map(p => `#${p.tokenId.toString()}`).join(', ')}</div>
              </div>
            </Alert>
          )}

          {/* 滑点设置 - 仅在移除流动性时显示 */}
          {operationType === 'remove' && (
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
                    max={10}
                    min={0.1}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 汇总信息 */}
          {selectedPosition && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">汇总信息</h3>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Token ID</span>
                  <span className="text-white font-mono">#{selectedPosition.tokenId.toString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">当前流动性</span>
                  <span className="text-white font-mono">{selectedPosition.formattedLiquidity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">价格区间</span>
                  <span className="text-white">[{selectedPosition.tickLower}, {selectedPosition.tickUpper}]</span>
                </div>

                {operationType === 'collect' ? (
                  <>
                    <div className="border-t border-gray-700 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">可收取 USDT</span>
                        <span className="text-green-400 font-mono">{selectedPosition.formattedTokensOwed0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">可收取 WETH</span>
                        <span className="text-green-400 font-mono">{selectedPosition.formattedTokensOwed1}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="border-t border-gray-700 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">预估 USDT</span>
                        <span className="text-yellow-400 font-mono">{expectedWithdrawals.token0Amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">预估 WETH</span>
                        <span className="text-yellow-400 font-mono">{expectedWithdrawals.token1Amount}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

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
              step === 'select' ? 'bg-blue-500' :
              step === 'approve' ? 'bg-yellow-500' :
              step === 'remove' || step === 'collect' ? 'bg-purple-500' :
              'bg-green-500'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'approve' || step === 'remove' || step === 'collect' || step === 'success' ? 'bg-yellow-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              (step === 'remove' || step === 'collect') || step === 'success' ? 'bg-purple-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'success' ? 'bg-green-500' : 'bg-gray-700'
            }`} />
          </div>

          {/* 根据步骤显示不同内容 */}
          {step === 'select' && (
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
                ) : !hasPositions ? (
                  <Button
                    className="flex-1 bg-gray-600 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    无流动性位置
                  </Button>
                ) : !selectedPosition ? (
                  <Button
                    className="flex-1 bg-gray-600 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    请选择位置
                  </Button>
                ) : !hasSufficientPosition ? (
                  <Button
                    className="flex-1 bg-gray-600 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    位置余额不足
                  </Button>
                ) : (
                  <Button
                    onClick={handleConfirm}
                    disabled={isOperating}
                    className={`flex-1 ${
                      operationType === 'remove'
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                    } text-white`}
                  >
                    {isOperating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4 mr-2" />
                        {operationType === 'remove' ? '授权并移除流动性' : '授权并收取手续费'}
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
                <h3 className="text-lg font-semibold text-white mb-2">NFT 授权中</h3>
                <p className="text-sm text-gray-400 mb-4">
                  正在授权 Token #{selectedPosition?.tokenId.toString()} 给 UniswapV3 适配器
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">全局授权</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    <span className="text-xs text-gray-400">单个 NFT 授权（备用）</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 执行操作步骤 */}
          {(step === 'remove' || step === 'collect') && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {step === 'remove' ? '移除流动性中' : '收取手续费中'}
                </h3>
                <p className="text-sm text-gray-400">
                  {step === 'remove'
                    ? `正在移除 Token #${selectedPosition?.tokenId.toString()} 的流动性`
                    : `正在收取 Token #${selectedPosition?.tokenId.toString()} 的手续费`
                  }
                </p>
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
                <h3 className="text-lg font-semibold text-white mb-2">
                  {operationType === 'remove' ? '移除流动性成功！' : '收取手续费成功！'}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  {operationType === 'remove'
                    ? `成功移除 Token #${selectedPosition?.tokenId.toString()} 的流动性`
                    : `成功收取 Token #${selectedPosition?.tokenId.toString()} 的手续费`
                  }
                </p>

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

export default UniswapSellModal;