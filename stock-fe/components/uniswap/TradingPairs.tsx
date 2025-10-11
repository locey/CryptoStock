'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  TrendingUp,
  Star,
  ArrowUpDown,
  Filter,
  ChevronDown,
  Activity,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { TokenPair } from './TokenPairSelector';
import LiquidityModal from './LiquidityModal';

interface TradingPairsProps {
  onSelectPair?: (pair: TokenPair) => void;
}

// 预定义的热门交易对
const POPULAR_PAIRS: TokenPair[] = [
  {
    symbol0: 'USDT',
    symbol1: 'WETH',
    address0: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`,
    address1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
    decimals0: 6,
    decimals1: 18,
    currentPrice: 0.001,
    volume24h: 2500000,
    apy: 8.5,
    tvl: 15000000,
    isPopular: true,
    category: 'bluechip'
  },
  {
    symbol0: 'USDC',
    symbol1: 'WETH',
    address0: '0xA0b86a33E6441e3C6E8A9C0b8B9a0d4a0E5d2B2c' as `0x${string}`,
    address1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
    decimals0: 6,
    decimals1: 18,
    currentPrice: 0.001,
    volume24h: 2800000,
    apy: 7.8,
    tvl: 18000000,
    isPopular: true,
    category: 'bluechip'
  },
  {
    symbol0: 'UNI',
    symbol1: 'WETH',
    address0: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' as `0x${string}`,
    address1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
    decimals0: 18,
    decimals1: 18,
    currentPrice: 0.0035,
    volume24h: 850000,
    apy: 12.3,
    tvl: 5200000,
    category: 'defi'
  },
  {
    symbol0: 'AAVE',
    symbol1: 'WETH',
    address0: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' as `0x${string}`,
    address1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
    decimals0: 18,
    decimals1: 18,
    currentPrice: 0.0028,
    volume24h: 650000,
    apy: 10.5,
    tvl: 4100000,
    category: 'defi'
  }
];

// 确保代币对按正确顺序排列
const sortTokenPair = (pair: TokenPair): TokenPair => {
  if (pair.address0.toLowerCase() < pair.address1.toLowerCase()) {
    return pair;
  }
  return {
    ...pair,
    symbol0: pair.symbol1,
    symbol1: pair.symbol0,
    address0: pair.address1,
    address1: pair.address0,
    decimals0: pair.decimals1,
    decimals1: pair.decimals0,
    currentPrice: 1 / pair.currentPrice
  };
};

const SORTED_POPULAR_PAIRS = POPULAR_PAIRS.map(sortTokenPair);

type SortOption = 'volume' | 'apy' | 'tvl' | 'price' | 'change';
type FilterOption = 'all' | 'stable' | 'volatile' | 'bluechip' | 'defi';

export const TradingPairs: React.FC<TradingPairsProps> = ({ onSelectPair }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('volume');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPair, setSelectedPair] = useState<TokenPair | null>(null);
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);

  // 过滤和排序交易对
  const filteredAndSortedPairs = useMemo(() => {
    let filtered = SORTED_POPULAR_PAIRS;

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(pair =>
        pair.symbol0.toLowerCase().includes(term) ||
        pair.symbol1.toLowerCase().includes(term) ||
        `${pair.symbol0}/${pair.symbol1}`.toLowerCase().includes(term) ||
        `${pair.symbol1}/${pair.symbol0}`.toLowerCase().includes(term)
      );
    }

    // 类别过滤
    if (filterBy !== 'all') {
      filtered = filtered.filter(pair => pair.category === filterBy);
    }

    // 排序
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'apy':
          return (b.apy || 0) - (a.apy || 0);
        case 'tvl':
          return (b.tvl || 0) - (a.tvl || 0);
        case 'price':
          return b.currentPrice - a.currentPrice;
        case 'change':
          // 模拟价格变化排序
          return Math.random() - 0.5;
        default:
          return 0;
      }
    });

    return sorted;
  }, [searchTerm, sortBy, filterBy]);

  const handlePairSelect = (pair: TokenPair) => {
    setSelectedPair(pair);
    if (onSelectPair) {
      onSelectPair(pair);
    } else {
      // 默认行为：打开流动性模态框
      setShowLiquidityModal(true);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    }
    return `$${num.toFixed(0)}`;
  };

  const formatPrice = (price: number, decimals: number = 4) => {
    return price.toFixed(decimals);
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'stable': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'volatile': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'bluechip': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'defi': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'stable': return '稳定币';
      case 'volatile': return '高波动';
      case 'bluechip': return '蓝筹';
      case 'defi': return 'DeFi';
      default: return '其他';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      {/* 头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-400" />
          交易市场
        </h1>
        <p className="text-gray-400">
          探索热门交易对，提供流动性并赚取收益
        </p>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 搜索框 */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索交易对 (例如: ETH/WBTC, USDT, DAI)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
            />
          </div>

          {/* 筛选和排序 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 flex-1"
            >
              <Filter className="w-4 h-4 mr-2" />
              筛选
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded-md text-sm flex-1"
            >
              <option value="volume">交易量</option>
              <option value="apy">APY</option>
              <option value="tvl">TVL</option>
              <option value="price">价格</option>
              <option value="change">涨跌幅</option>
            </select>
          </div>
        </div>

        {/* 筛选选项 */}
        {showFilters && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterBy === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('all')}
              className={filterBy === 'all'
                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                : 'border-gray-700 text-gray-400 hover:bg-gray-800'
              }
            >
              全部
            </Button>
            <Button
              variant={filterBy === 'bluechip' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('bluechip')}
              className={filterBy === 'bluechip'
                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                : 'border-gray-700 text-gray-400 hover:bg-gray-800'
              }
            >
              蓝筹
            </Button>
            <Button
              variant={filterBy === 'stable' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('stable')}
              className={filterBy === 'stable'
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : 'border-gray-700 text-gray-400 hover:bg-gray-800'
              }
            >
              稳定币
            </Button>
            <Button
              variant={filterBy === 'defi' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('defi')}
              className={filterBy === 'defi'
                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                : 'border-gray-700 text-gray-400 hover:bg-gray-800'
              }
            >
              DeFi
            </Button>
            <Button
              variant={filterBy === 'volatile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterBy('volatile')}
              className={filterBy === 'volatile'
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'border-gray-700 text-gray-400 hover:bg-gray-800'
              }
            >
              高波动
            </Button>
          </div>
        )}

        {/* 统计信息 */}
        <div className="text-sm text-gray-400 mt-4">
          找到 {filteredAndSortedPairs.length} 个交易对
        </div>
      </div>

      {/* 交易对列表 */}
      <div className="space-y-4">
        {filteredAndSortedPairs.map((pair, index) => (
          <Card
            key={`${pair.address0}-${pair.address1}-${index}`}
            className="bg-gray-900 border-gray-800 hover:bg-gray-800/50 transition-all cursor-pointer"
            onClick={() => handlePairSelect(pair)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {/* 左侧：代币信息 */}
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {pair.symbol0.slice(0, 2)}
                    </div>
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {pair.symbol1.slice(0, 2)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold text-lg">
                        {pair.symbol0}/{pair.symbol1}
                      </span>
                      {pair.isPopular && (
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      )}
                    </div>
                    <div className="text-gray-400">
                      1 {pair.symbol1} = {formatPrice(1 / pair.currentPrice)} {pair.symbol0}
                    </div>
                    <Badge className={`mt-2 ${getCategoryColor(pair.category)}`}>
                      {getCategoryLabel(pair.category)}
                    </Badge>
                  </div>
                </div>

                {/* 右侧：统计数据 */}
                <div className="flex items-center gap-8">
                  {pair.volume24h && (
                    <div className="text-right">
                      <div className="text-gray-400 text-sm flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        24h 交易量
                      </div>
                      <div className="text-white font-medium text-lg">
                        {formatNumber(pair.volume24h)}
                      </div>
                    </div>
                  )}

                  {pair.tvl && (
                    <div className="text-right">
                      <div className="text-gray-400 text-sm flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        TVL
                      </div>
                      <div className="text-white font-medium text-lg">
                        {formatNumber(pair.tvl)}
                      </div>
                    </div>
                  )}

                  {pair.apy && (
                    <div className="text-right">
                      <div className="text-gray-400 text-sm flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        APY
                      </div>
                      <div className="text-green-400 font-medium text-lg">
                        {pair.apy.toFixed(1)}%
                      </div>
                    </div>
                  )}

                  <Button
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePairSelect(pair);
                    }}
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    交易
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredAndSortedPairs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            </div>
            <p className="text-gray-400 text-lg">没有找到匹配的交易对</p>
            <p className="text-gray-500 text-sm mt-2">
              尝试使用不同的搜索词或筛选条件
            </p>
          </div>
        )}
      </div>

      {/* 流动性模态框 */}
      {selectedPair && (
        <LiquidityModal
          isOpen={showLiquidityModal}
          onClose={() => setShowLiquidityModal(false)}
          tokenPair={selectedPair}
        />
      )}
    </div>
  );
};

export default TradingPairs;