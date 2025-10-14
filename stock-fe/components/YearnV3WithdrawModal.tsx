'use client'

import React, { useState, useEffect } from 'react'
import { X, DollarSign, TrendingUp, AlertCircle, Check, Wallet, Zap, ArrowUpRight } from 'lucide-react'
import { useYearnV3WithClients } from '@/lib/hooks/useYearnV3WithClients'
import useYearnV3Store from '@/lib/stores/useYearnV3Store'
import { ethers } from 'ethers'

interface YearnV3WithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: any) => void
}

/**
 * YearnV3 取款弹窗
 *
 * 功能：
 * 1. 连接钱包检查
 * 2. 份额余额查询和显示
 * 3. 授权状态检查
 * 4. 从 YearnV3 Vault 提取 USDT
 * 5. 预览取款金额
 * 6. 交易状态反馈
 */
export default function YearnV3WithdrawModal({ isOpen, onClose, onSuccess }: YearnV3WithdrawModalProps) {
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<'input' | 'approve' | 'withdraw' | 'success'>('input')
  const [txHash, setTxHash] = useState<string>('')
  const [previewData, setPreviewData] = useState<{ assets: string; formattedAssets: string } | null>(null)
  const [percentage, setPercentage] = useState<number>(0)

  const store = useYearnV3Store()
  const {
    isConnected,
    address,
    isLoading,
    isOperating,
    error,
    formattedBalances,
    needsApproval,
    maxBalances,
    initializeYearnV3,
    refreshUserInfo,
    approveShares,
    withdraw,
    previewWithdraw,
    clearError,
  } = useYearnV3WithClients()

  // 初始化 - 添加清理函数防止内存泄漏
  useEffect(() => {
    let isMounted = true;
    let controller = new AbortController();

    if (isOpen && isConnected) {
      const initializeAndRefresh = async () => {
        try {
          if (!controller.signal.aborted && isMounted) {
            await initializeYearnV3();
          }
          if (!controller.signal.aborted && isMounted) {
            await refreshUserInfo();
          }
        } catch (error) {
          if (!controller.signal.aborted && isMounted) {
            console.error('YearnV3 初始化失败:', error);
          }
        }
      };

      initializeAndRefresh();
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, isConnected])

  // 重置状态
  const resetModal = () => {
    setAmount('')
    setStep('input')
    setTxHash('')
    setPreviewData(null)
    setPercentage(0)
    clearError()
  }

  // 关闭弹窗
  const handleClose = () => {
    resetModal()
    onClose()
  }

  // 格式化份额显示 - 使小份额数字更易读
  const formatShares = (sharesStr: string): string => {
    const shares = parseFloat(sharesStr)
    if (shares === 0) return '0'

    // 对于很小的份额，使用更高的精度显示，避免显示过多无意义的小数位
    if (shares < 0.0001) {
      // 使用科学记数法或固定6位小数，但避免显示过多的小数位
      if (shares < 0.000001) {
        return shares.toExponential(3)
      }
      return shares.toFixed(8).replace(/\.?0+$/, '')
    }

    // 如果份额小于 0.01，使用 6 位小数
    if (shares < 0.01) {
      return shares.toFixed(6).replace(/\.?0+$/, '')
    }

    // 否则使用合适的精度
    return shares.toFixed(4).replace(/\.?0+$/, '')
  }

  // 输入验证
  const validateAmount = (value: string): boolean => {
    if (!value || parseFloat(value) <= 0) return false
    const maxAmount = parseFloat(maxBalances.maxSharesToWithdraw)
    return parseFloat(value) <= maxAmount
  }

  // 处理金额输入 - 添加防抖优化
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // 只允许数字和小数点，最多6位小数（用户期望输入USDT数量）
    if (/^\d*\.?\d{0,6}$/.test(value) || value === '') {
      setAmount(value)
      setPercentage(0) // 重置百分比

      // 如果金额有效，预览取款金额（基于用户输入的USDT数量）
      if (validateAmount(value)) {
        // 防抖：只在用户停止输入一段时间后再触发预览
        const timeoutId = setTimeout(async () => {
          try {
            // 计算对应的shares数量（基于当前份额价格）
            const usdtAmount = parseFloat(value)
            const currentUsdtValue = parseFloat(formattedBalances.currentValue || '0')
            const sharesBalance = parseFloat(formattedBalances.sharesBalance || '0')

            if (currentUsdtValue > 0 && sharesBalance > 0) {
              // 计算每份额价格
              const pricePerShare = currentUsdtValue / sharesBalance
              // 根据用户输入的USDT数量计算需要的shares
              const requiredShares = usdtAmount / pricePerShare

              // 使用计算出的shares数量进行预览
              const preview = await previewWithdraw(requiredShares.toFixed(6))
              if (preview.success && preview.data) {
                setPreviewData({
                  assets: preview.data.assets.toString(),
                  formattedAssets: preview.data.formattedAssets,
                  requiredShares: requiredShares.toFixed(6),
                  inputUsdtAmount: value
                })
              }
            } else {
              // 如果没有当前价值数据，尝试直接使用shares数量
              const preview = await previewWithdraw(value)
              if (preview.success && preview.data) {
                setPreviewData({
                  assets: preview.data.assets.toString(),
                  formattedAssets: preview.data.formattedAssets,
                  requiredShares: value,
                  inputUsdtAmount: value
                })
              }
            }
          } catch (error) {
            console.error('预览失败:', error)
            setPreviewData(null)
          }
        }, 300)

        // 清除之前的防抖
        return () => clearTimeout(timeoutId)
      } else {
        setPreviewData(null)
      }
    }
  }

  // 设置最大金额
  const handleMaxAmount = () => {
    setAmount(maxBalances.maxSharesToWithdraw)
    setPercentage(100)
  }

  // 处理百分比选择
  const handlePercentageSelect = (percent: number) => {
    setPercentage(percent)
    const maxAmount = parseFloat(maxBalances.maxSharesToWithdraw)
    const selectedAmount = (maxAmount * percent / 100).toFixed(6)
    setAmount(selectedAmount)
  }

  // 计算提取后价值
  const calculateRemainingBalance = (): string => {
    const currentValue = parseFloat(formattedBalances.currentValue || '0')
    const withdrawValue = amount && previewData ? parseFloat(previewData.formattedAssets) : 0
    const remaining = Math.max(0, currentValue - withdrawValue)

    return remaining.toFixed(2)
  }

  // 处理授权 - 严格按照测试用例
  const handleApprove = async () => {
    if (!validateAmount(amount)) return

    try {
      setStep('approve')

      // 根据测试用例第193-196行，授权需要使用 shares 数量
      const sharesToApprove = previewData?.requiredShares || "0";
      const sharesBigInt = ethers.parseUnits(sharesToApprove, 18); // 使用18位小数

      console.log("=== 授权执行详情 ===");
      console.log("用户输入 USDT 数量:", amount, "USDT");
      console.log("需要授权的份额数量:", sharesBigInt.toString());

      const approveTx = await vault.connect(user).approve(
        await yearnAdapter.getAddress(),
        sharesBigInt
      );
      await approveTx.wait();
      console.log("Vault Shares 授权完成");

      // 授权成功后刷新余额信息
      await refreshUserInfo();

      // 自动进入取款步骤
      setStep('withdraw')

      // 自动执行取款逻辑
      await handleWithdraw()
    } catch (error) {
      console.error('授权失败:', error)
      setStep('input')
    }
  }

  // 处理取款 - 严格按照测试用例
  const handleWithdraw = async () => {
    if (!validateAmount(amount)) return

    try {
      // 如果不是从授权步骤来的，设置步骤为 withdraw
      if (step !== 'withdraw') {
        setStep('withdraw')
      }

      // 根据测试用例，amount 现在是 USDT 数量，但需要转换为 shares 数量
      const usdtAmount = ethers.parseUnits(amount, 6); // USDT 6位小数
      const sharesToWithdraw = ethers.parseUnits(
        previewData?.requiredShares || "0",
        18 // 测试用例使用18位小数
      );

      console.log("=== 提取执行详情 ===");
      console.log("用户输入 USDT 数量:", amount, "USDT");
      console.log("计算的份额数量:", sharesToWithdraw.toString());
      console.log("预期获得 USDT:", previewData?.formattedAssets || "0", "USDT");

      // 传入 shares 数量，而不是 USDT 数量
      const withdrawParams = {
        tokens: [USDT_ADDRESS],
        amounts: [sharesToWithdraw], // 传入 shares 数量
        recipient: user.address,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: 0,
        extraData: "0x"
      };

      const result = await withdraw(withdrawParams);
      setTxHash(result.hash || '')
      setStep('success')

      // 刷新余额
      await refreshUserInfo()

      // 成功回调
      if (onSuccess) {
        onSuccess(result)
      }
    } catch (error) {
      console.error('取款失败:', error)
      setStep('input')
    }
  }

  // 处理确认操作
  const handleConfirm = async () => {
    if (!isConnected) return

    // 需要先授权 Shares
    if (needsApproval.shares) {
      await handleApprove()
    } else {
      await handleWithdraw()
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
          title={isOperating ? "操作进行中，请稍候" : "关闭弹窗"}
        >
          <X className={`w-5 h-5 ${isOperating ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white'} transition-colors`} />
        </button>

        {/* 标题 */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">提取 YearnV3</h2>
              <p className="text-sm text-gray-400">赎回您的投资份额</p>
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
              step === 'approve' ? 'bg-red-500' :
              step === 'withdraw' ? 'bg-blue-500' :
              'bg-green-500'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'approve' || step === 'withdraw' || step === 'success' ? 'bg-red-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'withdraw' || step === 'success' ? 'bg-blue-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'success' ? 'bg-green-500' : 'bg-gray-700'
            }`} />
          </div>

          {/* 输入步骤 */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* 投资信息卡片 */}
              <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">已投入金额</p>
                    <p className="text-lg font-bold text-white">
                      ${parseFloat(formattedBalances.depositedAmount || '0').toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">已赚取收益</p>
                    <p className="text-lg font-bold text-green-400">
                      +${parseFloat(formattedBalances.earnedInterest || '0').toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">提取后余额</p>
                    <p className="text-lg font-bold text-orange-400">
                      ${amount ? calculateRemainingBalance() : parseFloat(formattedBalances.currentValue || '0').toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* 余额显示 */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">可用份额</span>
                  <span className="text-sm font-semibold text-white">
                    {formattedBalances.sharesBalance} yvUSDT
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">当前价值</span>
                  <span className="text-sm font-semibold text-green-400">
                    ${formattedBalances.currentValue} USDT
                  </span>
                </div>
                {/* 调试信息 - 临时显示原始数据 */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-xs text-gray-500">
                      <div>调试信息:</div>
                      <div>原始份额: {store.userBalance?.sharesBalance.toString()}</div>
                      <div>格式化份额: {formattedBalances.sharesBalance}</div>
                      <div>原始价值: {store.userBalance?.currentValue.toString()}</div>
                      <div>格式化价值: {formattedBalances.currentValue}</div>
                      <div>已投入: {formattedBalances.depositedAmount}</div>
                      <div>已赚取: {formattedBalances.earnedInterest}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 百分比快捷选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  快速选择
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      onClick={() => handlePercentageSelect(percent)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        percentage === percent
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                      disabled={!isConnected || parseFloat(maxBalances.maxSharesToWithdraw) === 0}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>
              </div>

              {/* 输入框 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  提取数量 (USDT)
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

              {/* 预览收益 */}
              {amount && validateAmount(amount) && previewData && (
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">提取金额</span>
                    <span className="text-white">{amount} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">预期获得</span>
                    <div className="text-right">
                      <span className="text-green-400">{previewData.formattedAssets} USDT</span>
                      {previewData.requiredShares && (
                        <p className="text-xs text-gray-500 mt-1">
                          需要 {formatShares(previewData.requiredShares)} yvUSDT 份额
                        </p>
                      )}
                    </div>
                  </div>
                  {percentage > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">提取比例</span>
                      <span className="text-orange-400">{percentage}%</span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-300">提取后价值</span>
                      <span className="text-sm font-bold text-blue-400">${calculateRemainingBalance()}</span>
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
                    {needsApproval.shares ? '授权并提取' : '确认提取'}
                  </>
                )}
              </button>
            </div>
          )}

          {/* 授权步骤 */}
          {step === 'approve' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">授权中</h3>
                <p className="text-sm text-gray-400">
                  正在授权 {amount} yvUSDT 份额给 YearnV3 合约
                </p>
              </div>
            </div>
          )}

          {/* 提取步骤 */}
          {step === 'withdraw' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">提取中</h3>
                <p className="text-sm text-gray-400">
                  正在提取 {amount} yvUSDT 份额
                </p>
                {previewData && (
                  <p className="text-sm text-green-400 mt-2">
                    预期获得 {previewData.formattedAssets} USDT
                  </p>
                )}
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
                <h3 className="text-lg font-semibold text-white mb-2">提取成功！</h3>
                <p className="text-sm text-gray-400 mb-4">
                  成功提取 {amount} yvUSDT 份额
                </p>
                {previewData && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-400 mb-1">获得金额</p>
                    <p className="text-lg font-bold text-green-400">
                      {previewData.formattedAssets} USDT
                    </p>
                  </div>
                )}

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

              {/* 投资提示 */}
              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">继续投资</span>
                </div>
                <div className="text-xs text-gray-300">
                  <p>您的 USDT 已成功提取到钱包</p>
                  <p>可以随时重新存入继续赚取收益</p>
                </div>
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