'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, TrendingUp, DollarSign, Shield, Droplets, Activity, Plus, ChevronRight } from 'lucide-react'

const poolCategories = [
  {
    id: 'uniswap',
    name: 'Uniswap V3',
    description: '集中流动性池，支持多种手续费等级',
    icon: '🦄',
    tvl: 449008.12,
    volume24h: 928.12,
    pools: 3,
    color: 'from-pink-500 to-purple-500',
    href: '/pools/uniswap',
    features: ['集中流动性', '多种手续费等级', '资本效率', '区间订单']
  },
  {
    id: 'aave',
    name: 'Aave 借贷',
    description: '以有竞争力的利率提供和借入资产',
    icon: '👻',
    tvl: 2345678.90,
    volume24h: 0,
    pools: 5,
    color: 'from-blue-500 to-purple-500',
    href: '/lending/aave',
    features: ['存入和借入', '浮动利率', '抵押机制', '安全模块']
  },
  {
    id: 'compound',
    name: 'Compound',
    description: '赚取利息的算法货币市场',
    icon: '🏗️',
    tvl: 1567890.34,
    volume24h: 0,
    pools: 4,
    color: 'from-green-500 to-blue-500',
    href: '#',
    features: ['算法利率', 'COMP 奖励', '清算保护', '治理机制']
  }
]

const featuredPools = [
  {
    token0: { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ' },
    token1: { symbol: 'USDC', name: 'USD Coin', icon: '$' },
    tvl: 125983.45,
    apr: 5.23,
    volume24h: 125.67,
    type: 'Uniswap V3'
  },
  {
    token0: { symbol: 'WETH', name: 'Wrapped Ethereum', icon: 'Ξ' },
    token1: { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '₿' },
    tvl: 89456.78,
    apr: 8.92,
    volume24h: 234.56,
    type: 'Uniswap V3'
  },
  {
    token0: { symbol: 'USDC', name: 'USD Coin', icon: '$' },
    token1: { symbol: 'DAI', name: 'Dai Stablecoin', icon: '◈' },
    tvl: 234567.89,
    apr: 2.15,
    volume24h: 567.89,
    type: 'Uniswap V3'
  }
]

export default function PoolsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')

  const totalTVL = poolCategories.reduce((sum, category) => sum + category.tvl, 0)
  const totalVolume = poolCategories.reduce((sum, category) => sum + category.volume24h, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-pink-500 to-yellow-400 bg-clip-text text-transparent">
            DeFi 池
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            在我们集成的DeFi生态系统中提供流动性、提供资产或使用您的抵押品进行借贷
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <DollarSign className="w-8 h-8 text-purple-400" />
              <div className="text-sm text-green-400">+12.5%</div>
            </div>
            <div className="text-3xl font-bold mb-2">${totalTVL.toLocaleString()}</div>
            <div className="text-gray-400">总锁仓价值</div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-8 h-8 text-blue-400" />
              <div className="text-sm text-green-400">+23.1%</div>
            </div>
            <div className="text-3xl font-bold mb-2">${totalVolume.toLocaleString()}</div>
            <div className="text-gray-400">24小时交易量</div>
          </div>

          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <div className="text-sm text-green-400">+8.2%</div>
            </div>
            <div className="text-3xl font-bold mb-2">5.67%</div>
            <div className="text-gray-400">平均年化收益率</div>
          </div>

          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <Droplets className="w-8 h-8 text-yellow-400" />
              <div className="text-sm text-gray-400">Active</div>
            </div>
            <div className="text-3xl font-bold mb-2">12</div>
            <div className="text-gray-400">总池数</div>
          </div>
        </div>

        {/* Pool Categories */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8">池类别</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {poolCategories.map(category => (
              <Link
                key={category.id}
                href={category.href}
                className="group block bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-pink-500/50 transition-all hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center text-2xl">
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{category.name}</h3>
                      <p className="text-sm text-gray-400">{category.pools} 个池</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-pink-400 transition-colors" />
                </div>

                <p className="text-gray-400 mb-6">{category.description}</p>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-400">锁仓价值</span>
                    <span className="font-semibold">${category.tvl.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">24小时交易量</span>
                    <span className="font-semibold">${category.volume24h.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {category.features.slice(0, 3).map((feature, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Featured Pools */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">精选池</h2>
            <Link href="/pools/uniswap" className="text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-2">
              查看所有池
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredPools.map((pool, index) => (
              <div key={index} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-pink-500/50 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center -space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-gray-900">
                      <span className="text-sm font-bold">{pool.token0.icon}</span>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center border-2 border-gray-900">
                      <span className="text-sm font-bold">{pool.token1.icon}</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold">{pool.token0.symbol}/{pool.token1.symbol}</div>
                    <div className="text-sm text-gray-400">{pool.type}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">锁仓价值</span>
                    <span className="font-semibold">${pool.tvl.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">年化收益率</span>
                    <span className="font-semibold text-green-400">{pool.apr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">24小时交易量</span>
                    <span className="font-semibold">${pool.volume24h.toLocaleString()}</span>
                  </div>
                </div>

                <button className="w-full mt-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500 text-white font-semibold rounded-lg transition-all">
                  添加流动性
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-r from-pink-500/20 to-yellow-400/20 border border-pink-500/30 rounded-xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">准备开始了吗？</h3>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            从各种池类型中选择以最大化您的回报。无论您喜欢提供流动性、借出资产，还是探索收益耕作策略，我们的平台都能满足您的需求。
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/pools/uniswap"
              className="px-6 py-3 bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              创建新仓位
            </Link>
            <Link
              href="/lending/aave"
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              提供资产
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}