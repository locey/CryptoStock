'use client'

import { useState } from 'react'
import { ArrowUpDown, Plus, Settings, ChevronDown, Info, X, ChevronLeft, Search, Filter } from 'lucide-react'

const pools = [
  {
    id: 1,
    token0: { symbol: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'from-blue-500 to-blue-600' },
    token1: { symbol: 'USDC', name: 'USD Coin', icon: '$', color: 'from-blue-600 to-blue-700' },
    fee: '0.05',
    tvl: 125983.45,
    volume24h: 125.67,
    apr: 5.23,
    userLiquidity: 151.18,
    userShare: 0.12,
    range: { min: 0.99, max: 1.01, current: 1.005 },
    fees: { collected24h: 0.23, collected: 12.45 }
  },
  {
    id: 2,
    token0: { symbol: 'WETH', name: 'Wrapped Ethereum', icon: 'Ξ', color: 'from-purple-500 to-purple-600' },
    token1: { symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '₿', color: 'from-orange-500 to-orange-600' },
    fee: '0.3',
    tvl: 89456.78,
    volume24h: 234.56,
    apr: 8.92,
    userLiquidity: 0,
    userShare: 0,
    range: { min: 0.035, max: 0.037, current: 0.036 },
    fees: { collected24h: 0, collected: 0 }
  },
  {
    id: 3,
    token0: { symbol: 'USDT', name: 'Tether', icon: '₮', color: 'from-green-500 to-green-600' },
    token1: { symbol: 'USDC', name: 'USD Coin', icon: '$', color: 'from-blue-600 to-blue-700' },
    fee: '0.01',
    tvl: 234567.89,
    volume24h: 567.89,
    apr: 2.15,
    userLiquidity: 500.00,
    userShare: 0.21,
    range: { min: 0.999, max: 1.001, current: 1.000 },
    fees: { collected24h: 0.05, collected: 3.21 }
  }
]

export default function UniswapPoolPage() {
  const [selectedPool, setSelectedPool] = useState(pools[0])
  const [showCreatePool, setShowCreatePool] = useState(false)
  const [showNewPosition, setShowNewPosition] = useState(false)

  const formatPercent = (value: number) => `${value.toFixed(2)}%`
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-pink-500 to-yellow-400 bg-clip-text text-transparent">
                Pools
              </h1>
              <p className="text-gray-400">Provide liquidity and earn fees in a range of pools</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNewPosition(true)}
              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              + New Position
            </button>
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-sm">Total Value Locked</span>
              <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
                <span className="text-xs">$</span>
              </div>
            </div>
            <div className="text-2xl font-bold">$449,008.12</div>
            <div className="text-green-400 text-sm">+12.5% this week</div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-400 text-sm">24h Volume</span>
              <div className="w-5 h-5 bg-blue-500/20 rounded-full flex items-center justify-center">
                <span className="text-xs">↗</span>
              </div>
            </div>
            <div className="text-2xl font-bold">$928.12</div>
            <div className="text-blue-400 text-sm">Across all pools</div>
          </div>

          <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-400 text-sm">Your Liquidity</span>
              <div className="w-5 h-5 bg-purple-500/20 rounded-full flex items-center justify-center">
                <span className="text-xs">💧</span>
              </div>
            </div>
            <div className="text-2xl font-bold">$651.18</div>
            <div className="text-purple-400 text-sm">2 active positions</div>
          </div>

          <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-400 text-sm">Unclaimed Fees</span>
              <div className="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <span className="text-xs">💰</span>
              </div>
            </div>
            <div className="text-2xl font-bold">$15.66</div>
            <div className="text-yellow-400 text-sm">Ready to claim</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by token or pool"
              className="w-full bg-gray-900/50 border border-gray-800 rounded-lg pl-10 pr-4 py-3 focus:border-pink-500 focus:outline-none"
            />
          </div>
          <button className="px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Pool List */}
        <div className="grid grid-cols-1 gap-4">
          {pools.map(pool => (
            <div
              key={pool.id}
              onClick={() => setSelectedPool(pool)}
              className={`bg-gray-900/50 border rounded-xl p-6 hover:border-pink-500/50 transition-all cursor-pointer ${
                selectedPool.id === pool.id ? 'border-pink-500/50' : 'border-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center -space-x-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${pool.token0.color} rounded-full flex items-center justify-center border-2 border-gray-900`}>
                      <span className="text-lg font-bold">{pool.token0.icon}</span>
                    </div>
                    <div className={`w-12 h-12 bg-gradient-to-br ${pool.token1.color} rounded-full flex items-center justify-center border-2 border-gray-900`}>
                      <span className="text-lg font-bold">{pool.token1.icon}</span>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{pool.token0.symbol}/{pool.token1.symbol}</div>
                    <div className="text-sm text-gray-400">{pool.fee}% Fee Tier</div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">TVL</div>
                    <div className="font-semibold">{formatCurrency(pool.tvl)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">24h Volume</div>
                    <div className="font-semibold">{formatCurrency(pool.volume24h)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">APR</div>
                    <div className="font-semibold text-green-400">{formatPercent(pool.apr)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Your Position</div>
                    {pool.userLiquidity > 0 ? (
                      <div>
                        <div className="font-semibold">{formatCurrency(pool.userLiquidity)}</div>
                        <div className="text-sm text-gray-400">{formatPercent(pool.userShare)} Share</div>
                      </div>
                    ) : (
                      <span className="text-gray-500">No position</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Fees 24h</div>
                    <div className="font-semibold text-yellow-400">${pool.fees.collected24h}</div>
                  </div>
                  <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pool Details (Expanded) */}
              {selectedPool.id === pool.id && (
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Range Info */}
                    <div>
                      <h4 className="font-semibold mb-3">Price Range</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Min Price</span>
                          <span className="font-semibold">{pool.range.min}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Max Price</span>
                          <span className="font-semibold">{pool.range.max}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Current Price</span>
                          <span className="font-semibold">{pool.range.current}</span>
                        </div>
                      </div>
                    </div>

                    {/* Your Position */}
                    {pool.userLiquidity > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">Your Position</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Liquidity</span>
                            <span className="font-semibold">{formatCurrency(pool.userLiquidity)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Pool Share</span>
                            <span className="font-semibold">{formatPercent(pool.userShare)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Collected Fees</span>
                            <span className="font-semibold text-yellow-400">${pool.fees.collected}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div>
                      <h4 className="font-semibold mb-3">Actions</h4>
                      <div className="flex gap-2">
                        <button className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors">
                          Add
                        </button>
                        <button className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors">
                          Remove
                        </button>
                        {pool.fees.collected > 0 && (
                          <button className="flex-1 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors">
                            Claim
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* New Position Modal */}
        {showNewPosition && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">New Position</h3>
                <button
                  onClick={() => setShowNewPosition(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Token Selection */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Select a pair</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-sm">Ξ</span>
                        </div>
                        <span className="font-semibold">ETH</span>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-sm">$</span>
                        </div>
                        <span className="font-semibold">USDC</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fee Tier Selection */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Fee tier</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['0.01', '0.05', '0.3', '1'].map(fee => (
                      <button
                        key={fee}
                        className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-pink-500/50 transition-colors"
                      >
                        <div className="font-semibold">{fee}%</div>
                        <div className="text-xs text-gray-400">
                          {fee === '0.01' ? 'Correlated pairs' :
                           fee === '0.05' ? 'Stable pairs' :
                           fee === '0.3' ? 'Most pairs' : 'Exotic pairs'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Set Price Range */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Set price range</label>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-400">Min Price</span>
                          <span>0.99</span>
                        </div>
                        <input
                          type="range"
                          className="w-full"
                          min="0.5"
                          max="1.5"
                          step="0.01"
                          defaultValue="0.99"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-400">Max Price</span>
                          <span>1.01</span>
                        </div>
                        <input
                          type="range"
                          className="w-full"
                          min="0.5"
                          max="1.5"
                          step="0.01"
                          defaultValue="1.01"
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-sm text-gray-400">Current Price: </span>
                        <span className="font-semibold">1.005</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deposit Amounts */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Deposit amounts</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-xs">Ξ</span>
                          </div>
                          <span>ETH</span>
                        </div>
                        <button className="text-xs text-pink-400">MAX</button>
                      </div>
                      <input
                        type="number"
                        placeholder="0.0"
                        className="w-full bg-transparent text-lg font-semibold outline-none placeholder-gray-600"
                      />
                      <div className="text-sm text-gray-400 mt-1">Balance: 1.2345</div>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-xs">$</span>
                          </div>
                          <span>USDC</span>
                        </div>
                        <button className="text-xs text-pink-400">MAX</button>
                      </div>
                      <input
                        type="number"
                        placeholder="0.0"
                        className="w-full bg-transparent text-lg font-semibold outline-none placeholder-gray-600"
                      />
                      <div className="text-sm text-gray-400 mt-1">Balance: 2,456.78</div>
                    </div>
                  </div>
                </div>

                {/* Approve and Supply Button */}
                <button
                  onClick={() => setShowNewPosition(false)}
                  className="w-full py-4 bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500 text-white font-semibold rounded-lg transition-all"
                >
                  Approve & Supply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}