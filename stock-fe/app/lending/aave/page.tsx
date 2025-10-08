'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, Shield, Info, ChevronDown, Settings, Star, Plus, Minus, X, Check } from 'lucide-react'
import AaveUSDTBuyModal from '@/components/AaveUSDTBuyModal'
import AaveUSDTWithdrawModal from '@/components/AaveUSDTWithdrawModal'
import AaveUSDTSellModal from '@/components/AaveUSDTSellModal'

const markets: Asset[] = [
  {
    symbol: 'WETH',
    name: '包装以太坊',
    totalSupply: 12567.89,
    totalBorrow: 3456.78,
    supplyApy: 0.03,
    borrowApy: 0.08,
    liquidity: 9111.11,
    collateralFactor: 80,
    isActive: true,
    userSupply: 0.5,
    userBorrow: 0,
    icon: 'Ξ',
    color: 'from-blue-500 to-blue-600',
    walletBalance: 1.2345,
    price: 2856.78
  },
  {
    symbol: 'USDC',
    name: '美元硬币',
    totalSupply: 45678.90,
    totalBorrow: 12345.67,
    supplyApy: 0.05,
    borrowApy: 0.07,
    liquidity: 33333.23,
    collateralFactor: 85,
    isActive: true,
    userSupply: 1000.0,
    userBorrow: 500.0,
    icon: '$',
    color: 'from-blue-600 to-blue-700',
    walletBalance: 2456.78,
    price: 1.00
  },
  {
    symbol: 'DAI',
    name: '代币稳定币',
    totalSupply: 23456.78,
    totalBorrow: 8901.23,
    supplyApy: 0.04,
    borrowApy: 0.06,
    liquidity: 14555.55,
    collateralFactor: 75,
    isActive: true,
    userSupply: 2000.0,
    userBorrow: 0,
    icon: '◈',
    color: 'from-yellow-500 to-yellow-600',
    walletBalance: 1500.23,
    price: 0.999
  },
  {
    symbol: 'WBTC',
    name: '包装比特币',
    totalSupply: 89.45,
    totalBorrow: 23.67,
    supplyApy: 0.02,
    borrowApy: 0.09,
    liquidity: 65.78,
    collateralFactor: 70,
    isActive: true,
    userSupply: 0,
    userBorrow: 0,
    icon: '₿',
    color: 'from-orange-500 to-orange-600',
    walletBalance: 0.045,
    price: 45678.90
  },
  {
    symbol: 'LINK',
    name: '链环',
    totalSupply: 12345.67,
    totalBorrow: 3456.78,
    supplyApy: 0.06,
    borrowApy: 0.12,
    liquidity: 8888.89,
    collateralFactor: 65,
    isActive: true,
    userSupply: 150.0,
    userBorrow: 50.0,
    icon: '⬡',
    color: 'from-blue-400 to-blue-500',
    walletBalance: 250.5,
    price: 14.56
  }
]

// 定义资产类型
interface Asset {
  symbol: string
  name: string
  totalSupply: number
  totalBorrow: number
  supplyApy: number
  borrowApy: number
  liquidity: number
  collateralFactor: number
  isActive: boolean
  userSupply: number
  userBorrow: number
  icon: string
  color: string
  walletBalance: number
  price: number
}

export default function AaveLendingPage() {
  const [activeView, setActiveView] = useState('markets')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [showAaveBuyModal, setShowAaveBuyModal] = useState(false)
  const [showAaveWithdrawModal, setShowAaveWithdrawModal] = useState(false)
  const [showAaveSellModal, setShowAaveSellModal] = useState(false)

  const userStats = {
    totalSupply: 3000.50,
    totalBorrow: 550.00,
    netAPY: 0.045,
    healthFactor: 2.85,
    totalCollateral: 3000.50,
    borrowingPower: 2550.43
  }

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`

  const handleDeposit = (asset: Asset) => {
    setSelectedAsset(asset)
    setDepositAmount('')
    setShowDepositModal(true)
  }

  const handleWithdraw = (asset: Asset) => {
    setSelectedAsset(asset)
    setWithdrawAmount('')
    setShowWithdrawModal(true)
  }

  const handleMaxDeposit = () => {
    if (selectedAsset) {
      setDepositAmount(selectedAsset.walletBalance.toString())
    }
  }

  const handleMaxWithdraw = () => {
    if (selectedAsset) {
      setWithdrawAmount(selectedAsset.userSupply.toString())
    }
  }

  // USDT 专用处理函数
  const handleAaveUSDTBuy = () => {
    setShowAaveBuyModal(true)
  }

  const handleAaveUSDTWithdraw = () => {
    setShowAaveWithdrawModal(true)
  }

  const handleAaveUSDTSell = () => {
    setShowAaveSellModal(true)
  }

  const handleAaveTransactionSuccess = () => {
    // 交易成功后可以刷新数据或执行其他操作
    console.log('Aave transaction completed successfully')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-pink-500 to-yellow-400 bg-clip-text text-transparent">
              Aave Lending
            </h1>
            <p className="text-gray-400">Supply assets to earn interest or borrow against your collateral</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <Star className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-sm">Total Supply</span>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(userStats.totalSupply)}</div>
            <div className="text-green-400 text-sm">+{formatPercent(userStats.netAPY)} Net APY</div>
          </div>

          <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-400 text-sm">Total Borrow</span>
              <TrendingDown className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(userStats.totalBorrow)}</div>
            <div className="text-red-400 text-sm">Variable APR</div>
          </div>

          <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-400 text-sm">Health Factor</span>
              <Shield className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold">{userStats.healthFactor.toFixed(2)}</div>
            <div className="text-green-400 text-sm">Safe</div>
          </div>

          <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-400 text-sm">Borrow Power</span>
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(userStats.borrowingPower)}</div>
            <div className="text-gray-400 text-sm">{formatCurrency(userStats.totalCollateral)} Collateral</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg mb-6 max-w-md">
          <button
            onClick={() => setActiveView('markets')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeView === 'markets'
                ? 'bg-white text-black font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            市场
          </button>
          <button
            onClick={() => setActiveView('portfolio')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeView === 'portfolio'
                ? 'bg-white text-black font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            我的投资组合
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeView === 'history'
                ? 'bg-white text-black font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            历史记录
          </button>
        </div>

        {/* Markets View */}
        {activeView === 'markets' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">所有市场</h2>
              <div className="flex gap-4">
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2">
                  <span>所有资产</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  稳定币
                </button>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  以太坊
                </button>
                <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  比特币
                </button>
              </div>
            </div>

            {/* USDT 专用卡片 */}
            <div className="group bg-gradient-to-br from-green-900/80 to-emerald-800/60 border border-green-700/50 rounded-2xl p-6 hover:border-green-500/50 hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-xl font-bold">₮</span>
                  </div>
                  <div>
                    <div className="font-bold text-xl">USDT</div>
                    <div className="text-sm text-gray-300">Tether USD</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Aave 协议</div>
                  <div className="font-bold text-lg">$1.00</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-xl p-4 hover:border-green-500/60 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300">存入APY</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400">3.5%</div>
                  <div className="text-xs text-gray-500 mt-1">稳定收益</div>
                </div>
                <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/40 rounded-xl p-4 hover:border-blue-500/60 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300">安全等级</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-400">AAA</div>
                  <div className="text-xs text-gray-500 mt-1">低风险</div>
                </div>
              </div>

              <div className="bg-gray-800/40 rounded-xl p-4 mb-6 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">总供给</span>
                  <span className="font-semibold">$2.5M+</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">流动性</span>
                  <span className="font-semibold text-blue-400">$1.8M+</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-400 text-sm">24h 交易量</span>
                  <span className="font-semibold text-purple-400">$450K</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={handleAaveUSDTBuy}
                    className="flex-1 py-3 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/30 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    存入 USDT
                  </button>
                  <button
                    onClick={handleAaveUSDTWithdraw}
                    className="flex-1 py-3 bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:from-red-600 hover:via-red-700 hover:to-orange-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-red-500/30 flex items-center justify-center gap-2"
                  >
                    <Minus className="w-5 h-5" />
                    提取 USDT
                  </button>
                </div>
                <button
                  onClick={handleAaveUSDTSell}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 via-purple-600 to-pink-600 hover:from-purple-600 hover:via-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30 flex items-center justify-center gap-2"
                >
                  <TrendingDown className="w-5 h-5" />
                  卖出 USDT
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {markets.map((market) => (
                <div key={market.symbol} className="group bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-700 rounded-2xl p-6 hover:border-pink-500/50 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-300 transform hover:-translate-y-1">
                  {/* Asset Header with Enhanced Styling */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 bg-gradient-to-br ${market.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                        <span className="text-xl font-bold">{market.icon}</span>
                      </div>
                      <div>
                        <div className="font-bold text-xl">{market.symbol}</div>
                        <div className="text-sm text-gray-400">{market.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">价格</div>
                      <div className="font-bold text-lg">${market.price.toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Enhanced APY Rates */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-xl p-4 hover:border-green-500/60 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-gray-300">存入APY</span>
                      </div>
                      <div className="text-2xl font-bold text-green-400">{formatPercent(market.supplyApy)}</div>
                      <div className="text-xs text-gray-500 mt-1">年化收益</div>
                    </div>
                    <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 rounded-xl p-4 hover:border-red-500/60 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-gray-300">借入APY</span>
                      </div>
                      <div className="text-2xl font-bold text-red-400">{formatPercent(market.borrowApy)}</div>
                      <div className="text-xs text-gray-500 mt-1">浮动利率</div>
                    </div>
                  </div>

                  {/* Enhanced Market Stats */}
                  <div className="bg-gray-800/40 rounded-xl p-4 mb-6 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">总供给</span>
                      <span className="font-semibold">{market.totalSupply.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">总借入</span>
                      <span className="font-semibold">{market.totalBorrow.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">流动性</span>
                      <span className="font-semibold text-blue-400">{market.liquidity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                      <span className="text-gray-400 text-sm">抵押系数</span>
                      <span className="font-semibold text-purple-400">{market.collateralFactor}%</span>
                    </div>
                  </div>

                  {/* Enhanced Your Position */}
                  <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-xl p-4 mb-6 border border-gray-600/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-300">我的持仓</span>
                      <Wallet className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-400">存入</span>
                        </div>
                        <span className="font-semibold text-green-400">{market.userSupply}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                          <span className="text-sm text-gray-400">借入</span>
                        </div>
                        <span className="font-semibold text-red-400">{market.userBorrow}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
                        <span className="text-sm text-gray-400">钱包余额</span>
                        <span className="font-semibold text-blue-400">{market.walletBalance}</span>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDeposit(market)}
                      className="flex-1 py-3 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-green-500/30 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      投入
                    </button>
                    <button
                      onClick={() => handleWithdraw(market)}
                      className={`flex-1 py-3 font-bold rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 ${
                        market.userSupply > 0
                          ? 'bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:from-red-600 hover:via-red-700 hover:to-orange-700 text-white hover:shadow-lg hover:shadow-red-500/30'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={market.userSupply === 0}
                    >
                      <Minus className="w-5 h-5" />
                      提取
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio View */}
        {activeView === 'portfolio' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Supplies */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">我的存入</h3>
              <div className="space-y-4">
                {markets.filter(m => m.userSupply > 0).map(market => (
                  <div key={market.symbol} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${market.color} rounded-full flex items-center justify-center`}>
                        <span className="text-sm font-bold">{market.icon}</span>
                      </div>
                      <div>
                        <div className="font-semibold">{market.symbol}</div>
                        <div className="text-sm text-gray-400">{formatPercent(market.supplyApy)} APY</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{market.userSupply}</div>
                      <div className="text-sm text-gray-400">{formatCurrency(market.userSupply * market.price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Borrows */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">我的借入</h3>
              <div className="space-y-4">
                {markets.filter(m => m.userBorrow > 0).map(market => (
                  <div key={market.symbol} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 bg-gradient-to-br ${market.color} rounded-full flex items-center justify-center`}>
                        <span className="text-sm font-bold">{market.icon}</span>
                      </div>
                      <div>
                        <div className="font-semibold">{market.symbol}</div>
                        <div className="text-sm text-gray-400">{formatPercent(market.borrowApy)} APY</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{market.userBorrow}</div>
                      <div className="text-sm text-gray-400">{formatCurrency(market.userBorrow * market.price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Deposit Modal */}
        {showDepositModal && selectedAsset && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${selectedAsset.color} rounded-xl flex items-center justify-center`}>
                    <span className="text-xl font-bold">{selectedAsset.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">投入 {selectedAsset.symbol}</h3>
                    <div className="text-sm text-gray-400">{selectedAsset.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Enhanced Asset Display */}
                <div className="bg-gradient-to-r from-gray-800/60 to-gray-700/60 border border-gray-600 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${selectedAsset.color} rounded-xl flex items-center justify-center shadow-lg`}>
                        <span className="text-xl font-bold">{selectedAsset.icon}</span>
                      </div>
                      <div>
                        <div className="font-bold text-lg">{selectedAsset.symbol}</div>
                        <div className="text-sm text-gray-400">Wallet Balance</div>
                        <div className="font-semibold text-green-400">{selectedAsset.walletBalance}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Current Price</div>
                      <div className="font-bold text-lg">${selectedAsset.price.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">投入金额</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-400">{selectedAsset.icon}</span>
                      <span className="text-lg font-semibold">{selectedAsset.symbol}</span>
                    </div>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gray-800/60 border border-gray-600 rounded-xl p-4 text-2xl font-bold pl-24 pr-20 focus:border-pink-500 focus:outline-none focus:bg-gray-800/80 transition-all"
                    />
                    <button
                      onClick={handleMaxDeposit}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-lg transition-all font-medium text-sm"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex justify-between mt-3">
                    <span className="text-sm text-gray-400">≈ ${depositAmount ? (parseFloat(depositAmount) * selectedAsset.price).toFixed(2) : '0.00'}</span>
                    <span className="text-sm text-gray-400">可用余额: {selectedAsset.walletBalance} {selectedAsset.symbol}</span>
                  </div>
                </div>

                {/* Enhanced Supply Info */}
                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6 space-y-4">
                  <h4 className="font-semibold text-green-400 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    收益预测
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">年化收益率</div>
                      <div className="text-xl font-bold text-green-400">{formatPercent(selectedAsset.supplyApy)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">预期年收益</div>
                      <div className="text-xl font-bold text-green-400">
                        ${depositAmount ? (parseFloat(depositAmount) * selectedAsset.supplyApy).toFixed(2) : '0.00'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-green-500/20">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">抵押系数</div>
                      <div className="font-semibold">{selectedAsset.collateralFactor}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">健康因子影响</div>
                      <div className="font-semibold text-green-400">+0.25</div>
                    </div>
                  </div>
                </div>

                {/* Warning/Info */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div className="text-sm text-gray-300">
                      投入的资产将作为抵押品，可以借入其他资产。收益率会根据市场情况动态调整。
                    </div>
                  </div>
                </div>

                {/* Enhanced Action Buttons */}
                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="flex-1 py-4 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 hover:from-green-600 hover:via-green-700 hover:to-emerald-700 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] hover:shadow-lg hover:shadow-green-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={!depositAmount || parseFloat(depositAmount) <= 0 || parseFloat(depositAmount) > selectedAsset.walletBalance}
                  >
                    <Plus className="w-5 h-5" />
                    确认投入
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Withdraw Modal */}
        {showWithdrawModal && selectedAsset && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${selectedAsset.color} rounded-xl flex items-center justify-center`}>
                    <span className="text-xl font-bold">{selectedAsset.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">提取 {selectedAsset.symbol}</h3>
                    <div className="text-sm text-gray-400">{selectedAsset.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Current Position Display */}
                <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-red-400 flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      当前投资
                    </h4>
                    <div className="text-sm text-gray-400">已赚取收益</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${selectedAsset.color} rounded-xl flex items-center justify-center shadow-lg`}>
                        <span className="text-xl font-bold">{selectedAsset.icon}</span>
                      </div>
                      <div>
                        <div className="font-bold text-lg">{selectedAsset.userSupply}</div>
                        <div className="text-sm text-gray-400">供给金额</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">${(selectedAsset.userSupply * selectedAsset.price).toFixed(2)}</div>
                      <div className="text-sm text-green-400">+${((selectedAsset.userSupply * selectedAsset.supplyApy) / 12).toFixed(2)} 月收益</div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">提取金额</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-400">{selectedAsset.icon}</span>
                      <span className="text-lg font-semibold">{selectedAsset.symbol}</span>
                    </div>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-gray-800/60 border border-gray-600 rounded-xl p-4 text-2xl font-bold pl-24 pr-20 focus:border-pink-500 focus:outline-none focus:bg-gray-800/80 transition-all"
                    />
                    <button
                      onClick={handleMaxWithdraw}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white rounded-lg transition-all font-medium text-sm"
                    >
                      MAX
                    </button>
                  </div>
                  <div className="flex justify-between mt-3">
                    <span className="text-sm text-gray-400">≈ ${withdrawAmount ? (parseFloat(withdrawAmount) * selectedAsset.price).toFixed(2) : '0.00'}</span>
                    <span className="text-sm text-gray-400">可提取: {selectedAsset.userSupply} {selectedAsset.symbol}</span>
                  </div>
                </div>

                {/* Withdraw Impact */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-6 space-y-4">
                  <h4 className="font-semibold text-yellow-400 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    提取影响
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">剩余供给</div>
                      <div className="text-xl font-bold">
                        {Math.max(0, selectedAsset.userSupply - (parseFloat(withdrawAmount) || 0)).toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">剩余价值</div>
                      <div className="text-xl font-bold">
                        ${Math.max(0, (selectedAsset.userSupply - (parseFloat(withdrawAmount) || 0)) * selectedAsset.price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-yellow-500/20">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">健康因子影响</div>
                      <div className="font-semibold text-yellow-400">-0.15</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">年收益减少</div>
                      <div className="font-semibold text-red-400">
                        -${(parseFloat(withdrawAmount) || 0) * selectedAsset.supplyApy.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation Warning */}
                {withdrawAmount && parseFloat(withdrawAmount) > selectedAsset.userSupply && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-red-400 mt-0.5" />
                      <div className="text-sm text-red-300">
                        提取金额不能超过可用的供给量。请输入有效金额。
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Action Buttons */}
                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-4 bg-gradient-to-r from-red-500 via-red-600 to-orange-600 hover:from-red-600 hover:via-red-700 hover:to-orange-700 text-white font-bold rounded-xl transition-all transform hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > selectedAsset.userSupply}
                  >
                    <Minus className="w-5 h-5" />
                    确认提取
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Aave USDT 弹窗组件 */}
        <AaveUSDTBuyModal
          isOpen={showAaveBuyModal}
          onClose={() => setShowAaveBuyModal(false)}
          onSuccess={handleAaveTransactionSuccess}
        />
        <AaveUSDTWithdrawModal
          isOpen={showAaveWithdrawModal}
          onClose={() => setShowAaveWithdrawModal(false)}
          onSuccess={handleAaveTransactionSuccess}
        />
        <AaveUSDTSellModal
          isOpen={showAaveSellModal}
          onClose={() => setShowAaveSellModal(false)}
          onSuccess={handleAaveTransactionSuccess}
        />
      </div>
    </div>
  )
}