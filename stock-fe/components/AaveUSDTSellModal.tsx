'use client'

import React, { useState, useEffect } from 'react'
import { X, DollarSign, TrendingDown, AlertCircle, Check, Wallet, ArrowDown, Info } from 'lucide-react'
import { useAaveWithClients } from '@/lib/hooks/useAaveWithClients'

interface AaveUSDTSellModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

/**
 * Aave USDT 卖出弹窗（从 Aave 提取）
 *
 * 功能：
 * 1. 连接钱包检查
 * 2. aUSDT 余额查询和显示
 * 3. 授权状态检查
 * 4. USDT 从 Aave 提取（实际上是 withdraw 功能的简化版本）
 * 5. 手续费计算和显示
 * 6. 交易状态反馈
 */
export default function AaveUSDTSellModal({ isOpen, onClose, onSuccess }: AaveUSDTSellModalProps) {
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'input' | 'approve' | 'selling' | 'success'>('input')
  const [txHash, setTxHash] = useState<string>('')

  const {
    isConnected,
    address,
    isLoading,
    isOperating,
    error,
    formattedBalances,
    needsApproval,
    maxBalances,
    initializeAaveTrading,
    refreshUserBalance,
    approveAUSDT,
    sellUSDT,
    clearErrors,
    poolInfo
  } = useAaveWithClients()

  // 初始化
  useEffect(() => {
    if (isOpen && isConnected) {
      initializeAaveTrading()
      refreshUserBalance()
    }
  }, [isOpen, isConnected])

  // 重置状态
  const resetModal = () => {
    setAmount('')
    setStep('input')
    setTxHash('')
    clearErrors()
  }

  // 关闭弹窗
  const handleClose = () => {
    resetModal()
    onClose()
  }

  // 输入验证
  const validateAmount = (value: string): boolean => {
    if (!value || parseFloat(value) <= 0) return false
    const maxAmount = parseFloat(maxBalances.maxUSDTToWithdraw)
    return parseFloat(value) <= maxAmount
  }

  // 处理金额输入
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // 只允许数字和小数点，最多6位小数（USDT精度）
    if (/^\d*\.?\d{0,6}$/.test(value) || value === '') {
      setAmount(value)
    }
  }

  // 设置最大金额
  const handleMaxAmount = () => {
    setAmount(maxBalances.maxUSDTToWithdraw)
  }

  // 计算手续费
  const calculateFee = (): string => {
    if (!amount || !poolInfo) return '0'
    const amountNum = parseFloat(amount)
    const fee = (amountNum * poolInfo.feeRateBps) / 10000
    return fee.toFixed(6)
  }

  // 计算实际提取的USDT数量
  const calculateNetWithdrawAmount = (): string => {
    if (!amount) return '0'
    const amountNum = parseFloat(amount)
    const feeNum = parseFloat(calculateFee())
    return Math.max(0, amountNum - feeNum).toFixed(6)
  }

  // 计算提取后余额
  const calculateRemainingBalance = (): string => {
    const currentBalance = parseFloat(formattedBalances.aUsdtBalance)
    const withdrawAmount = parseFloat(amount) || 0
    const feeNum = parseFloat(calculateFee())
    const remaining = Math.max(0, currentBalance - withdrawAmount - feeNum)
    return remaining.toFixed(2)
  }

  // 处理授权
  const handleApprove = async () => {
    if (!validateAmount(amount)) return

    try {
      setStep('approve')
      await approveAUSDT(amount)

      // 授权成功后刷新余额信息
      await refreshUserBalance()

      // 自动进入卖出步骤
      setStep('selling')

      // 自动执行卖出逻辑
      await handleSell()
    } catch (error) {
      console.error('授权失败:', error)
      setStep('input')
    }
  }

  // 处理卖出
  const handleSell = async () => {
    if (!validateAmount(amount)) return

    try {
      // 如果不是从授权步骤来的，设置步骤为 selling
      if (step !== 'selling') {
        setStep('selling')
      }

      const result = await sellUSDT(amount)
      setTxHash(result.hash)
      setStep('success')

      // 刷新余额
      await refreshUserBalance()

      // 成功回调
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('卖出失败:', error)
      setStep('input')
    }
  }

  // 处理确认操作
  const handleConfirm = async () => {
    if (!isConnected) return

    // 需要先授权 aUSDT
    if (needsApproval.aUsdt) {
      await handleApprove()
    } else {
      await handleSell()
    }
  }

  // 如果弹窗未打开，返回 null
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md mx-4 relative">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
          disabled={isOperating}
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* 标题 */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <ArrowDown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">卖出 USDT</h2>
              <p className="text-sm text-gray-400">从 Aave 协议提取</p>
            </div>
          </div>

          {/* 钱包连接状态 */}
          {!isConnected && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-yellow-400">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">请先连接钱包</span>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* 步骤指示器 */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'input' ? 'bg-orange-500' :
              step === 'approve' ? 'bg-yellow-500' :
              step === 'selling' ? 'bg-red-500' :
              'bg-green-500'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'approve' || step === 'selling' || step === 'success' ? 'bg-yellow-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'selling' || step === 'success' ? 'bg-red-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'success' ? 'bg-green-500' : 'bg-gray-700'
            }`} />
          </div>

          {/* 输入步骤 */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* 投资信息卡片 */}
              <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">已投入金额</p>
                    <p className="text-lg font-bold text-white">
                      ${parseFloat(formattedBalances.depositedAmount).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">已赚取收益</p>
                    <p className="text-lg font-bold text-green-400">
                      +${parseFloat(formattedBalances.earnedInterest).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">提取后余额</p>
                    <p className="text-lg font-bold text-blue-400">
                      ${amount ? calculateRemainingBalance() : parseFloat(formattedBalances.aUsdtBalance).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* 余额显示 */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">可提取余额</span>
                  <span className="text-sm font-semibold text-white">
                    {formattedBalances.aUsdtBalance} USDT
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">年化收益率</span>
                  <span className="text-sm font-semibold text-green-400">
                    {poolInfo?.feeRatePercent || '~'}
                  </span>
                </div>
              </div>

              {/* 输入框 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  卖出数量
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                    disabled={!isConnected || isLoading}
                  />
                  <button
                    onClick={handleMaxAmount}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs hover:bg-orange-500/30 transition-colors"
                    disabled={!isConnected}
                  >
                    MAX
                  </button>
                </div>
                {amount && !validateAmount(amount) && (
                  <p className="text-red-400 text-xs mt-1">请输入有效的金额</p>
                )}
              </div>

              {/* 费用明细 */}
              {amount && validateAmount(amount) && (
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">卖出金额</span>
                    <span className="text-white">{amount} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">手续费 ({poolInfo?.feeRatePercent})</span>
                    <span className="text-white">{calculateFee()} USDT</span>
                  </div>
                  <div className="border-t border-gray-700 pt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-300">实际到账</span>
                      <span className="text-sm font-bold text-white">{calculateNetWithdrawAmount()} USDT</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 确认按钮 */}
              <button
                onClick={handleConfirm}
                disabled={!isConnected || !validateAmount(amount) || isOperating}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isOperating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    {needsApproval.aUsdt ? '授权并卖出' : '确认卖出'}
                  </>
                )}
              </button>
            </div>
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
                  正在授权 {amount} aUSDT 给 DefiAggregator 合约
                </p>
              </div>
            </div>
          )}

          {/* 卖出步骤 */}
          {step === 'selling' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">卖出中</h3>
                <p className="text-sm text-gray-400">
                  正在从 Aave 协议提取 {amount} USDT
                </p>
              </div>
            </div>
          )}

          {/* 成功步骤 */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">卖出成功！</h3>
                <p className="text-sm text-gray-400 mb-4">
                  成功从 Aave 提取 {amount} USDT 到您的钱包
                </p>

                {/* 交易详情 */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">提取数量</span>
                      <div className="font-semibold text-white">{amount} USDT</div>
                    </div>
                    <div>
                      <span className="text-gray-400">实际到账</span>
                      <div className="font-semibold text-green-400">{calculateNetWithdrawAmount()} USDT</div>
                    </div>
                  </div>
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
              <button
                onClick={handleClose}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all"
              >
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}