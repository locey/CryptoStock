'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  ChevronDown,
  TrendingUp,
  Star,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import UniswapDeploymentInfo from '@/lib/abi/deployments-uniswapv3-adapter-sepolia.json';

export interface TokenPair {
  symbol0: string;
  symbol1: string;
  address0: `0x${string}`;
  address1: `0x${string}`;
  decimals0: number;
  decimals1: number;
  currentPrice: number; // price of token1 in terms of token0
  volume24h?: number;
  apy?: number;
  tvl?: number;
  isPopular?: boolean;
  category?: 'stable' | 'volatile' | 'bluechip' | 'defi';
}

interface TokenPairSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pair: TokenPair) => void;
  selectedPair?: TokenPair;
}

// 预定义的代币对列表
const PREDEFINED_TOKEN_PAIRS: TokenPair[] = [
  // 主流代币对
  {
    symbol0: 'USDT',
    symbol1: 'WETH',
    address0: UniswapDeploymentInfo.contracts.MockERC20_USDT as `0x${string}`,
    address1: UniswapDeploymentInfo.contracts.MockWethToken as `0x${string}`,
    decimals0: 6,
    decimals1: 18,
    currentPrice: 0.001, // 1 USDT = 0.001 WETH
    volume24h: 2500000,
    apy: 8.5,
    tvl: 15000000,
    isPopular: true,
    category: 'bluechip'
  },
  {
    symbol0: 'USDC',
    symbol1: 'WETH',
    address0: '0xA0b86a33E6441e3C6E8A9C0b8B9a0d4a0E5d2B2c' as `0x${string}`, // 示例地址
    address1: UniswapDeploymentInfo.contracts.MockWethToken as `0x${string}`,
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
    symbol0: 'USDT',
    symbol1: 'USDC',
    address0: UniswapDeploymentInfo.contracts.MockERC20_USDT as `0x${string}`,
    address1: '0xA0b86a33E6441e3C6E8A9C0b8B9a0d4a0E5d2B2c' as `0x${string}`,
    decimals0: 6,
    decimals1: 6,
    currentPrice: 1.0,
    volume24h: 5000000,
    apy: 2.5,
    tvl: 25000000,
    isPopular: true,
    category: 'stable'
  },
  // DeFi 代币对
  {
    symbol0: 'UNI',
    symbol1: 'WETH',
    address0: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' as `0x${string}`,
    address1: UniswapDeploymentInfo.contracts.MockWethToken as `0x${string}`,
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
    address1: UniswapDeploymentInfo.contracts.MockWethToken as `0x${string}`,
    decimals0: 18,
    decimals1: 18,
    currentPrice: 0.0028,
    volume24h: 650000,
    apy: 10.5,
    tvl: 4100000,
    category: 'defi'
  },
  // 稳定币对
  {
    symbol0: 'DAI',
    symbol1: 'USDT',
    address0: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`,
    address1: UniswapDeploymentInfo.contracts.MockERC20_USDT as `0x${string}`,
    decimals0: 18,
    decimals1: 6,
    currentPrice: 1.0,
    volume24h: 1200000,
    apy: 3.2,
    tvl: 8500000,
    category: 'stable'
  },
  // 波动性代币对
  {
    symbol0: 'SHIB',
    symbol1: 'WETH',
    address0: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE' as `0x${string}`,
    address1: UniswapDeploymentInfo.contracts.MockWethToken as `0x${string}`,
    decimals0: 18,
    decimals1: 18,
    currentPrice: 0.00000008,
    volume24h: 3200000,
    apy: 25.8,
    tvl: 8900000,
    category: 'volatile'
  },
  {
    symbol0: 'PEPE',
    symbol1: 'WETH',
    address0: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' as `0x${string}`,
    address1: UniswapDeploymentInfo.contracts.MockWethToken as `0x${string}`,
    decimals0: 18,
    decimals1: 18,
    currentPrice: 0.00000012,
    volume24h: 1800000,
    apy: 22.4,
    tvl: 5600000,
    category: 'volatile'
  }
];

// 确保代币对按正确顺序排列 (token0 < token1)
const sortTokenPair = (pair: TokenPair): TokenPair => {
  if (pair.address0.toLowerCase() < pair.address1.toLowerCase()) {
    return pair;
  }

  // 交换代币顺序
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

// 对所有预定义代币对进行排序
const SORTED_TOKEN_PAIRS = PREDEFINED_TOKEN_PAIRS.map(sortTokenPair);

type SortOption = 'popular' | 'volume' | 'apy' | 'tvl' | 'price';
type FilterOption = 'all' | 'stable' | 'volatile' | 'bluechip' | 'defi';

export const TokenPairSelector: React.FC<TokenPairSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedPair
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showFilters, setShowFilters] = useState(false);

  // 过滤和排序代币对
  const filteredAndSortedPairs = useMemo(() => {
    let filtered = SORTED_TOKEN_PAIRS;

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
        case 'popular':
          // 热门代币对优先
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'volume':
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'apy':
          return (b.apy || 0) - (a.apy || 0);
        case 'tvl':
          return (b.tvl || 0) - (a.tvl || 0);
        case 'price':
          return b.currentPrice - a.currentPrice;
        default:
          return 0;
      }
    });

    return sorted;
  }, [searchTerm, sortBy, filterBy]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    }
    return `$${num.toFixed(0)}`;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] bg-gray-900 border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-blue-400" />
              选择交易对
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索代币对 (例如: USDT/WETH, ETH, BTC)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
            />
          </div>

          {/* 筛选和排序 */}
          <div className="flex items-center gap-4">
            {/* 筛选按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <Filter className="w-4 h-4 mr-2" />
              筛选
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>

            {/* 排序选择 */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded-md text-sm"
            >
              <option value="popular">热门</option>
              <option value="volume">24h 交易量</option>
              <option value="apy">APY</option>
              <option value="tvl">TVL</option>
              <option value="price">价格</option>
            </select>

            {/* 结果数量 */}
            <span className="text-gray-400 text-sm">
              找到 {filteredAndSortedPairs.length} 个交易对
            </span>
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

          {/* 代币对列表 */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {filteredAndSortedPairs.map((pair, index) => {
              const isSelected = selectedPair &&
                ((selectedPair.symbol0 === pair.symbol0 && selectedPair.symbol1 === pair.symbol1) ||
                 (selectedPair.symbol0 === pair.symbol1 && selectedPair.symbol1 === pair.symbol0));

              return (
                <Card
                  key={`${pair.address0}-${pair.address1}-${index}`}
                  className={`cursor-pointer transition-all hover:bg-gray-800/50 ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-500/5' : 'bg-gray-800/30'
                  }`}
                  onClick={() => onSelect(pair)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* 代币图标和名称 */}
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                              {pair.symbol0.slice(0, 2)}
                            </div>
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                              {pair.symbol1.slice(0, 2)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">
                                {pair.symbol0}/{pair.symbol1}
                              </span>
                              {pair.isPopular && (
                                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              )}
                            </div>
                            <div className="text-gray-400 text-sm">
                              1 {pair.symbol1} = {(1 / pair.currentPrice).toFixed(4)} {pair.symbol0}
                            </div>
                          </div>
                        </div>

                        {/* 类别标签 */}
                        <Badge className={getCategoryColor(pair.category)}>
                          {getCategoryLabel(pair.category)}
                        </Badge>
                      </div>

                      {/* 统计数据 */}
                      <div className="flex items-center gap-6 text-sm">
                        {pair.volume24h && (
                          <div className="text-right">
                            <div className="text-gray-400 text-xs">24h 交易量</div>
                            <div className="text-white font-medium">
                              {formatNumber(pair.volume24h)}
                            </div>
                          </div>
                        )}

                        {pair.apy && (
                          <div className="text-right">
                            <div className="text-gray-400 text-xs">APY</div>
                            <div className="text-green-400 font-medium">
                              {pair.apy.toFixed(1)}%
                            </div>
                          </div>
                        )}

                        {pair.tvl && (
                          <div className="text-right">
                            <div className="text-gray-400 text-xs">TVL</div>
                            <div className="text-white font-medium">
                              {formatNumber(pair.tvl)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredAndSortedPairs.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                </div>
                <p className="text-gray-400">没有找到匹配的交易对</p>
                <p className="text-gray-500 text-sm mt-2">
                  尝试使用不同的搜索词或筛选条件
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TokenPairSelector;