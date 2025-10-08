'use client'

import { useState } from 'react'
import { TrendingUp, Shield, Clock, DollarSign, Wallet, Info, Plus, Minus, X, ArrowUpRight, CheckCircle } from 'lucide-react'

export default function USDCPoolPage() {
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')

  const poolData = {
    protocol: 'Aave',
    asset: 'USDC',
    assetName: 'USD Coin',
    assetIcon: '$',
    apy: 5.2,
    riskLevel: '低风险',
    tvl: 1200000000, // 1.2B
    minDeposit: 100,
    lockPeriod: '无锁定期',
    userInvested: 2500,
    userEarnings: 125.5,
    walletBalance: 5234.67,
    totalSupply: 234567890.12,
    utilizationRate: 0.75
  }

  const features = [
    { icon: TrendingUp, title: '稳定收益', description: '基于市场需求算法调整的稳定收益' },
    { icon: Clock, title: '随时提取', description: '没有锁定期，资金流动性高' },
    { icon: Shield, title: '保险保障', description: 'Aave保险基金保护用户资金安全' }
  ]

  const handleMaxDeposit = () => {
    setDepositAmount(poolData.walletBalance.toString())
  }

  const handleMaxWithdraw = () => {
    setWithdrawAmount(poolData.userInvested.toString())
  }

  const formatCurrency = (value) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(1)}B`
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    return `$${value.toLocaleString()}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
            <span className="text-2xl font-bold">🏦</span>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">Aave</h1>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                DeFi 借贷协议
              </span>
            </div>
            <h2 className="text-2xl text-gray-300">USDC稳定币池</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Pool Card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pool Overview Card */}
            <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700 rounded-2xl p-8 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <span className="text-2xl font-bold">{poolData.assetIcon}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{poolData.asset} {poolData.assetName}</h3>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {poolData.riskLevel}
                      </span>
                      <span className="text-gray-400">Aave协议</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-green-400 mb-1">{poolData.apy}%</div>
                  <div className="text-gray-400">年化收益率 (APY)</div>
                </div>
              </div>

              <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                将USDC存入Aave协议，获得稳定的借贷收益
              </p>

              {/* Pool Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-400 text-sm">总锁仓</span>
                  </div>
                  <div className="text-xl font-bold">{formatCurrency(poolData.tvl)}</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-gray-400 text-sm">最小存款</span>
                  </div>
                  <div className="text-xl font-bold">${poolData.minDeposit}</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-xs">{poolData.assetIcon}</span>
                    </div>
                    <span className="text-gray-400 text-sm">代币</span>
                  </div>
                  <div className="text-xl font-bold">{poolData.asset}</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-400 text-sm">锁定期</span>
                  </div>
                  <div className="text-xl font-bold">{poolData.lockPeriod}</div>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h4 className="text-lg font-semibold mb-4">产品特点</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {features.map((feature, index) => (
                    <div key={index} className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-pink-500/20 to-yellow-400/20 rounded-lg flex items-center justify-center">
                          <feature.icon className="w-4 h-4 text-pink-400" />
                        </div>
                        <span className="font-semibold">{feature.title}</span>
                      </div>
                      <p className="text-sm text-gray-400">{feature.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Position */}
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
                <h4 className="text-lg font-semibold mb-4">我的投资</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400">已投入</span>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                    <div className="text-2xl font-bold">${poolData.userInvested.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400">已赚取</span>
                      <ArrowUpRight className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-400">+${poolData.userEarnings.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowDepositModal(true)}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
              >
                <Plus className="w-5 h-5" />
                投入资金
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3 text-lg"
              >
                <Minus className="w-5 h-5" />
                提取资金
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Protocol Info */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">关于Aave</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">行业领先协议</div>
                    <div className="text-sm text-gray-400">总锁仓价值超过100亿美元的顶级DeFi借贷平台</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">透明机制</div>
                    <div className="text-sm text-gray-400">算法利率模型，完全透明的收益计算</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">保险保障</div>
                    <div className="text-sm text-gray-400">Aave保险基金为用户提供额外的安全保障</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Stats */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">市场数据</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">总供给量</span>
                  <span className="font-semibold">{formatCurrency(poolData.totalSupply)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">利用率</span>
                  <span className="font-semibold">{(poolData.utilizationRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">24h交易量</span>
                  <span className="font-semibold">$45.2M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">存款人数</span>
                  <span className="font-semibold">12,456</span>
                </div>
              </div>
            </div>

            {/* Risk Disclaimer */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <div className="font-medium mb-2 text-yellow-400">风险提示</div>
                  <div className="text-sm text-gray-300">
                    DeFi投资涉及智能合约风险、市场波动等。请充分了解相关风险后投资，建议不要投入超过承受能力的资金。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deposit Modal */}
        {showDepositModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">投入USDC</h3>
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Asset Display */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold">{poolData.assetIcon}</span>
                      </div>
                      <div>
                        <div className="font-semibold">{poolData.asset}</div>
                        <div className="text-sm text-gray-400">{poolData.assetName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">钱包余额</div>
                      <div className="font-semibold">{poolData.walletBalance}</div>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">投入金额</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-xl font-semibold focus:border-pink-500 focus:outline-none"
                    />
                    <button
                      onClick={handleMaxDeposit}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded-lg transition-colors text-sm"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-gray-400">≈ ${depositAmount || '0.00'}</span>
                    <span className="text-sm text-gray-400">最小金额: ${poolData.minDeposit}</span>
                  </div>
                </div>

                {/* Yield Info */}
                <div className="p-4 bg-gray-800/50 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">预期年化收益</span>
                    <span className="font-semibold text-green-400">{poolData.apy}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">预计年收益</span>
                    <span className="font-semibold">
                      ${depositAmount ? (parseFloat(depositAmount) * poolData.apy / 100).toFixed(2) : '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">锁定期</span>
                    <span className="font-semibold">{poolData.lockPeriod}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all"
                    disabled={!depositAmount || parseFloat(depositAmount) < poolData.minDeposit}
                  >
                    确认投入
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Withdraw Modal */}
        {showWithdrawModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">提取USDC</h3>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Position Display */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold">{poolData.assetIcon}</span>
                      </div>
                      <div>
                        <div className="font-semibold">当前投资</div>
                        <div className="text-sm text-gray-400">+ 已赚取收益</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${poolData.userInvested.toLocaleString()}</div>
                      <div className="text-sm text-green-400">+${poolData.userEarnings.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">提取金额</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-xl font-semibold focus:border-pink-500 focus:outline-none"
                    />
                    <button
                      onClick={handleMaxWithdraw}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 rounded-lg transition-colors text-sm"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-gray-400">≈ ${withdrawAmount || '0.00'}</span>
                    <span className="text-sm text-gray-400">可提取: ${poolData.userInvested}</span>
                  </div>
                </div>

                {/* Withdraw Info */}
                <div className="p-4 bg-gray-800/50 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">剩余投资</span>
                    <span className="font-semibold">
                      ${Math.max(0, poolData.userInvested - (parseFloat(withdrawAmount) || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">提取后年收益</span>
                    <span className="font-semibold text-green-400">
                      ${Math.max(0, (poolData.userInvested - (parseFloat(withdrawAmount) || 0)) * poolData.apy / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all"
                    disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > poolData.userInvested}
                  >
                    确认提取
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}