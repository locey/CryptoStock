'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Droplets, Activity, Plus, Wallet, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CurveLiquidityModal from '@/components/CurveLiquidityModal'
import CurveWithdrawModal from '@/components/CurveWithdrawModal'
import { useCurve, useCurveTokens, useCurveOperations } from '@/lib/hooks/useCurve'

const curvePools = [
  {
    id: '3pool',
    name: 'Curve 3Pool',
    description: 'USDC / USDT / DAI 稳定币池',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', icon: '$', balance: '0' },
      { symbol: 'USDT', name: 'Tether', icon: '₮', balance: '0' },
      { symbol: 'DAI', name: 'Dai Stablecoin', icon: '◈', balance: '0' },
    ],
    tvl: 456789.12,
    apr: 12.5,
    volume24h: 789.12,
    lpTokenSupply: '1522.63',
    userLpBalance: '0',
    color: 'from-cyan-500 to-blue-500',
    features: ['稳定币交易', '低滑点', '高收益', 'CRV奖励', '智能池管理']
  }
]

export default function CurvePage() {
  const [selectedPool, setSelectedPool] = useState(curvePools[0])
  const [liquidityModalOpen, setLiquidityModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)

  // Curve hooks
  const { isConnected, poolInfo, initializeCurveTrading, refreshUserInfo } = useCurve()
  const { formattedBalances, needsApproval } = useCurveTokens()
  const { isOperating } = useCurveOperations()

  // 格式化数字
  function formatLargeNumber(num: number): string {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(1) + 'B'
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(0) + 'M'
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(1) + 'K'
    }
    return num.toString()
  }

  // 自动初始化
  useEffect(() => {
    if (isConnected) {
      initializeCurveTrading()
    }
  }, [isConnected, initializeCurveTrading])

  // 更新池信息
  useEffect(() => {
    if (formattedBalances && curvePools.length > 0) {
      const updatedPools = curvePools.map(pool => ({
        ...pool,
        tokens: pool.tokens.map(token => ({
          ...token,
          balance: formattedBalances[`${token.symbol.toLowerCase()}Balance` as keyof typeof formattedBalances] || '0'
        })),
        userLpBalance: formattedBalances.lpTokenBalance || '0'
      }))

      if (updatedPools[0]) {
        setSelectedPool(updatedPools[0])
      }
    }
  }, [formattedBalances])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/pools" className="p-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
              Curve Finance
            </h1>
            <p className="text-gray-400">稳定币流动性挖矿协议</p>
          </div>
        </div>

        {/* 钱包连接状态 */}
        {!isConnected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-yellow-400" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-400">连接钱包</h3>
                <p className="text-yellow-300">请连接钱包以查看您的流动性信息和进行交易</p>
              </div>
            </div>
          </div>
        )}

        {/* 统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Droplets className="w-8 h-8 text-cyan-400" />
              <div className="text-sm text-green-400">+15.2%</div>
            </div>
            <div className="text-3xl font-bold mb-2">${formatLargeNumber(selectedPool.tvl)}</div>
            <div className="text-gray-400">总锁仓价值</div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-blue-400" />
              <div className="text-sm text-green-400">+23.1%</div>
            </div>
            <div className="text-3xl font-bold mb-2">${formatLargeNumber(selectedPool.volume24h)}</div>
            <div className="text-gray-400">24小时交易量</div>
          </div>

          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <div className="text-sm text-green-400">+8.2%</div>
            </div>
            <div className="text-3xl font-bold mb-2">{selectedPool.apr}%</div>
            <div className="text-gray-400">年化收益率</div>
          </div>

          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Plus className="w-8 h-8 text-purple-400" />
              <div className="text-sm text-gray-400">LP Token</div>
            </div>
            <div className="text-3xl font-bold mb-2">{selectedPool.lpTokenSupply}</div>
            <div className="text-gray-400">LP Token 总供应</div>
          </div>
        </div>

        {/* 池列表 */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">可用池</h2>
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            {curvePools.map((pool) => (
              <div
                key={pool.id}
                className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-cyan-500/50 transition-all"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center -space-x-3">
                      {pool.tokens.map((token, index) => (
                        <div
                          key={token.symbol}
                          className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-gray-900 ${
                            index === 0 ? 'bg-blue-500' :
                            index === 1 ? 'bg-green-500' :
                            'bg-yellow-500'
                          }`}
                        >
                          <span className="text-lg font-bold text-white">{token.icon}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{pool.name}</h3>
                      <p className="text-sm text-gray-400">{pool.description}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-cyan-400">{pool.apr}%</div>
                    <div className="text-sm text-gray-400">APY</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">TVL</div>
                    <div className="font-semibold">${formatLargeNumber(pool.tvl)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">24h 交易量</div>
                    <div className="font-semibold">${formatLargeNumber(pool.volume24h)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">您的 LP Token</div>
                    <div className="font-semibold">{pool.userLpBalance}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">LP Token 供应</div>
                    <div className="font-semibold">{pool.lpTokenSupply}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {pool.features.map((feature, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => setLiquidityModalOpen(true)}
                    disabled={!isConnected}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    添加流动性
                  </Button>
                  <Button
                    onClick={() => setWithdrawModalOpen(true)}
                    disabled={!isConnected || parseFloat(pool.userLpBalance) === 0}
                    variant="outline"
                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    提取流动性
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 用户余额信息 */}
        {isConnected && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-12">
            <h3 className="text-xl font-semibold mb-4">您的余额</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {selectedPool.tokens.map((token) => (
                <div key={token.symbol} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      token.symbol === 'USDC' ? 'bg-blue-500' :
                      token.symbol === 'USDT' ? 'bg-green-500' :
                      'bg-yellow-500'
                    }`}>
                      <span className="text-sm font-bold text-white">{token.icon}</span>
                    </div>
                    <div>
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-sm text-gray-400">{token.name}</div>
                    </div>
                  </div>
                  <div className="text-lg font-mono">{token.balance}</div>
                </div>
              ))}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold">LP Token</div>
                    <div className="text-sm text-gray-400">Curve 3Pool</div>
                  </div>
                </div>
                <div className="text-lg font-mono">{selectedPool.userLpBalance}</div>
              </div>
            </div>
          </div>
        )}

        {/* 快速操作 */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">开始赚取稳定收益</h3>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Curve Finance 为稳定币交易提供最佳流动性，享受低滑点交易和高额收益。立即添加流动性开始您的 DeFi 之旅。
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              onClick={() => setLiquidityModalOpen(true)}
              disabled={!isConnected}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              添加流动性
            </Button>
            <Link href="https://curve.fi/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="lg" className="flex items-center gap-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                了解更多
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Curve 添加流动性弹窗 */}
      <CurveLiquidityModal
        isOpen={liquidityModalOpen}
        onClose={() => setLiquidityModalOpen(false)}
        onSuccess={(result) => {
          console.log('Curve 添加流动性成功:', result)
          setLiquidityModalOpen(false)
          refreshUserInfo()
        }}
      />

      {/* Curve 提取流动性弹窗 */}
      <CurveWithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        onSuccess={(result) => {
          console.log('Curve 提取流动性成功:', result)
          setWithdrawModalOpen(false)
          refreshUserInfo()
        }}
      />
    </div>
  )
}