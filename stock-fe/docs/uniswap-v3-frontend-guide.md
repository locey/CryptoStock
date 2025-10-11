# Uniswap V3 前端集成指南

## 概述

本指南详细介绍如何在 CryptoStock 前端应用中集成 Uniswap V3 功能，包括组件设计、状态管理、用户界面和交互流程。

## 📋 目录

- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [组件设计](#组件设计)
- [状态管理](#状态管理)
- [页面实现](#页面实现)
- [样式设计](#样式设计)
- [测试策略](#测试策略)
- [部署配置](#部署配置)

## 🛠️ 技术栈

### 前端框架
- **Next.js 15.5.2** - React 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式框架

### Web3 集成
- **RainbowKit 2.2.8** - 钱包连接
- **Wagmi 2.16.9** - 以太坊交互
- **Ethers.js 6.15.0** - 区块链交互

### 状态管理
- **Zustand 5.0.8** - 客户端状态
- **TanStack Query 5.87.1** - 服务器状态

### UI 组件
- **shadcn/ui** - 组件库
- **Radix UI** - 无障碍组件
- **Lucide React** - 图标库

## 📁 项目结构

```
stock-fe/
├── app/
│   ├── pools/
│   │   ├── uniswap/
│   │   │   ├── page.tsx              # Uniswap V3 主页面
│   │   │   ├── components/
│   │   │   │   ├── LiquidityModal.tsx    # 流动性操作弹窗
│   │   │   │   ├── PositionCard.tsx      # 仓位卡片
│   │   │   │   ├── FeeClaim.tsx          # 手续费收取
│   │   │   │   ├── PriceRange.tsx        # 价格区间选择
│   │   │   │   └── TokenSelector.tsx     # 代币选择器
│   │   │   └── hooks/
│   │   │       ├── useUniswapPositions.ts
│   │   │       ├── useLiquidityOperations.ts
│   │   │       └── usePriceRange.ts
│   │   └── page.tsx                     # 池子总览页面
│   └── layout.tsx
├── components/
│   ├── ui/                              # 共享UI组件
│   └── common/                          # 通用组件
├── lib/
│   ├── contracts/
│   │   ├── UniswapV3Adapter.ts          # 合约交互接口
│   │   ├── DefiAggregator.ts            # 聚合器接口
│   │   └── types.ts                     # 类型定义
│   ├── hooks/
│   │   ├── useWallet.ts                 # 钱包钩子
│   │   └── useContract.ts               # 合约钩子
│   ├── utils/
│   │   ├── format.ts                    # 格式化工具
│   │   ├── validation.ts                # 验证工具
│   │   └── constants.ts                 # 常量定义
│   └── abi/
│       ├── UniswapV3Adapter.json        # 合约ABI
│       └── DefiAggregator.json          # 聚合器ABI
├── store/
│   ├── uniswapStore.ts                  # Uniswap状态管理
│   └── globalStore.ts                   # 全局状态管理
└── types/
    ├── uniswap.ts                       # Uniswap类型定义
    └── common.ts                        # 通用类型定义
```

## 🧩 组件设计

### 1. LiquidityModal - 流动性操作弹窗

```typescript
// app/pools/uniswap/components/LiquidityModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TokenSelector } from './TokenSelector';
import { PriceRange } from './PriceRange';
import { useLiquidityOperations } from '../hooks/useLiquidityOperations';
import { formatTokenAmount, formatUSD } from '@/lib/utils/format';

interface LiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation: 'add' | 'remove';
  tokenId?: number;
  onSuccess?: (result: any) => void;
}

export const LiquidityModal: React.FC<LiquidityModalProps> = ({
  isOpen,
  onClose,
  operation,
  tokenId,
  onSuccess
}) => {
  const [token0, setToken0] = useState<string>('');
  const [token1, setToken1] = useState<string>('');
  const [amount0, setAmount0] = useState<string>('');
  const [amount1, setAmount1] = useState<string>('');
  const [tickLower, setTickLower] = useState<number>(-60000);
  const [tickUpper, setTickUpper] = useState<number>(60000);
  const [slippage, setSlippage] = useState<number>(1); // 1% 默认滑点

  const {
    addLiquidity,
    removeLiquidity,
    isLoading,
    error,
    gasEstimate
  } = useLiquidityOperations();

  const handleExecute = async () => {
    try {
      const params = {
        tokens: [token0, token1],
        amounts: operation === 'add'
          ? [
              parseUnits(amount0, getTokenDecimals(token0)),
              parseUnits(amount1, getTokenDecimals(token1)),
              parseUnits(amount0, getTokenDecimals(token0)) * (100 - slippage) / 100,
              parseUnits(amount1, getTokenDecimals(token1)) * (100 - slippage) / 100
            ]
          : [0, 0], // 移除流动性时的最小数量
        recipient: await getWalletAddress(),
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: tokenId || 0,
        extraData: operation === 'add'
          ? encodeAbiParameters(['int24', 'int24'], [tickLower, tickUpper])
          : '0x'
      };

      const result = operation === 'add'
        ? await addLiquidity(params)
        : await removeLiquidity({ ...params, tokenId });

      onSuccess?.(result);
      onClose();
    } catch (err) {
      console.error('Operation failed:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">
            {operation === 'add' ? '添加流动性' : '移除流动性'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 错误提示 */}
          {error && (
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertDescription className="text-red-400">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* 代币选择 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="token0" className="text-white">代币 0</Label>
              <TokenSelector
                value={token0}
                onChange={setToken0}
                disabled={operation === 'remove'}
              />
            </div>
            <div>
              <Label htmlFor="token1" className="text-white">代币 1</Label>
              <TokenSelector
                value={token1}
                onChange={setToken1}
                disabled={operation === 'remove'}
              />
            </div>
          </div>

          {/* 数量输入 */}
          {operation === 'add' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount0" className="text-white">数量 0</Label>
                <Input
                  id="amount0"
                  type="number"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  placeholder="0.0"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="amount1" className="text-white">数量 1</Label>
                <Input
                  id="amount1"
                  type="number"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  placeholder="0.0"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-white">NFT Token ID</Label>
              <p className="text-gray-400">{tokenId}</p>
            </div>
          )}

          {/* 价格区间选择 (仅添加流动性) */}
          {operation === 'add' && (
            <PriceRange
              tickLower={tickLower}
              tickUpper={tickUpper}
              onTickLowerChange={setTickLower}
              onTickUpperChange={setTickUpper}
            />
          )}

          {/* 滑点设置 */}
          <div>
            <Label className="text-white">滑点容忍度: {slippage}%</Label>
            <Slider
              value={[slippage]}
              onValueChange={(value) => setSlippage(value[0])}
              max={10}
              min={0.1}
              step={0.1}
              className="mt-2"
            />
          </div>

          {/* Gas 费用估算 */}
          {gasEstimate && (
            <div className="text-sm text-gray-400">
              预估 Gas 费用: {formatEther(gasEstimate)} ETH
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-700 text-white hover:bg-gray-800"
            >
              取消
            </Button>
            <Button
              onClick={handleExecute}
              disabled={isLoading || !amount0 || !amount1}
              className="flex-1 bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500 text-white"
            >
              {isLoading ? '处理中...' : (operation === 'add' ? '添加流动性' : '移除流动性')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

### 2. PositionCard - 仓位卡片

```typescript
// app/pools/uniswap/components/PositionCard.tsx
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Settings, Trash2 } from 'lucide-react';
import { formatUSD, formatTokenAmount } from '@/lib/utils/format';
import { useUniswapPositions } from '../hooks/useUniswapPositions';
import { LiquidityModal } from './LiquidityModal';
import { FeeClaim } from './FeeClaim';

interface PositionCardProps {
  tokenId: number;
  onRefresh: () => void;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  tokenId,
  onRefresh
}) => {
  const [showLiquidityModal, setShowLiquidityModal] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);

  const { position, isLoading, fees } = useUniswapPositions(tokenId);

  if (isLoading || !position) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-800 rounded"></div>
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalValueUSD = position.token0ValueUSD + position.token1ValueUSD;
  const totalFeesUSD = fees.fee0ValueUSD + fees.fee1ValueUSD;

  return (
    <>
      <Card className="bg-gray-900 border-gray-800 hover:border-pink-500/50 transition-all">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center -space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-sm font-bold">{position.token0.symbol[0]}</span>
                </div>
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-sm font-bold">{position.token1.symbol[0]}</span>
                </div>
              </div>
              <div>
                <CardTitle className="text-lg text-white">
                  {position.token0.symbol}/{position.token1.symbol}
                </CardTitle>
                <p className="text-sm text-gray-400">Token ID: {tokenId}</p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              Active
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 价值统计 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">总价值</span>
              </div>
              <div className="text-xl font-bold text-white">
                {formatUSD(totalValueUSD)}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">累积手续费</span>
              </div>
              <div className="text-xl font-bold text-green-400">
                {formatUSD(totalFeesUSD)}
              </div>
            </div>
          </div>

          {/* 流动性详情 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{position.token0.symbol} 数量</span>
              <span className="text-white">
                {formatTokenAmount(position.amount0, position.token0.decimals)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{position.token1.symbol} 数量</span>
              <span className="text-white">
                {formatTokenAmount(position.amount1, position.token1.decimals)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">流动性</span>
              <span className="text-white">{position.liquidity.toString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">价格区间</span>
              <span className="text-white">
                [{position.tickLower}, {position.tickUpper}]
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFeeModal(true)}
              className="flex-1 border-gray-700 text-white hover:bg-gray-800"
              disabled={totalFeesUSD === 0}
            >
              收取手续费
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLiquidityModal(true)}
              className="flex-1 border-gray-700 text-white hover:bg-gray-800"
            >
              管理流动性
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 流动性管理弹窗 */}
      <LiquidityModal
        isOpen={showLiquidityModal}
        onClose={() => setShowLiquidityModal(false)}
        operation="remove"
        tokenId={tokenId}
        onSuccess={() => {
          onRefresh();
          setShowLiquidityModal(false);
        }}
      />

      {/* 手续费收取弹窗 */}
      <FeeClaim
        isOpen={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        tokenId={tokenId}
        onSuccess={() => {
          onRefresh();
          setShowFeeModal(false);
        }}
      />
    </>
  );
};
```

### 3. PriceRange - 价格区间选择

```typescript
// app/pools/uniswap/components/PriceRange.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Settings, RefreshCw } from 'lucide-react';
import { usePriceRange } from '../hooks/usePriceRange';

interface PriceRangeProps {
  tickLower: number;
  tickUpper: number;
  onTickLowerChange: (tick: number) => void;
  onTickUpperChange: (tick: number) => void;
}

export const PriceRange: React.FC<PriceRangeProps> = ({
  tickLower,
  tickUpper,
  onTickLowerChange,
  onTickUpperChange
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { currentPrice, priceFromTick, tickFromPrice } = usePriceRange();

  const priceRange = useMemo(() => {
    const lowerPrice = priceFromTick(tickLower);
    const upperPrice = priceFromTick(tickUpper);
    return { lowerPrice, upperPrice };
  }, [tickLower, tickUpper, priceFromTick]);

  const rangeWidth = tickUpper - tickLower;
  const rangePercentage = Math.min((rangeWidth / 887220 * 100), 100);

  const presetRanges = [
    { name: '窄幅', lower: -3000, upper: 3000 },
    { name: '标准', lower: -60000, upper: 60000 },
    { name: '宽幅', lower: -120000, upper: 120000 }
  ];

  const handlePresetRange = (lower: number, upper: number) => {
    onTickLowerChange(lower);
    onTickUpperChange(upper);
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-white">价格区间</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-gray-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 当前价格指示 */}
        <div className="text-center">
          <div className="text-sm text-gray-400">当前价格</div>
          <div className="text-lg font-bold text-white">
            ${currentPrice?.toFixed(4) || '---'}
          </div>
        </div>

        {/* 预设区间 */}
        <div className="flex gap-2">
          {presetRanges.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              onClick={() => handlePresetRange(preset.lower, preset.upper)}
              className={`flex-1 border-gray-600 text-xs ${
                tickLower === preset.lower && tickUpper === preset.upper
                  ? 'bg-pink-500/20 border-pink-500 text-pink-400'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              {preset.name}
            </Button>
          ))}
        </div>

        {/* 价格区间显示 */}
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">最低价格</span>
            <span className="text-white font-mono">
              ${priceRange.lowerPrice?.toFixed(4) || '---'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">最高价格</span>
            <span className="text-white font-mono">
              ${priceRange.upperPrice?.toFixed(4) || '---'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">区间宽度</span>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {rangePercentage.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* 高级设置 */}
        {showAdvanced && (
          <div className="space-y-4 border-t border-gray-700 pt-4">
            <div>
              <Label className="text-white text-sm">Tick 下限</Label>
              <Slider
                value={[tickLower]}
                onValueChange={(value) => onTickLowerChange(value[0])}
                min={-887220}
                max={887220}
                step={60}
                className="mt-2"
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {tickLower}
              </div>
            </div>

            <div>
              <Label className="text-white text-sm">Tick 上限</Label>
              <Slider
                value={[tickUpper]}
                onValueChange={(value) => onTickUpperChange(value[0])}
                min={-887220}
                max={887220}
                step={60}
                className="mt-2"
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {tickUpper}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

## 🗄️ 状态管理

### Uniswap Store

```typescript
// store/uniswapStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Position {
  tokenId: number;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
  };
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  token0ValueUSD: number;
  token1ValueUSD: number;
}

interface UniswapState {
  // 状态
  positions: Position[];
  isLoading: boolean;
  error: string | null;

  // 选中的操作
  selectedOperation: 'add' | 'remove' | 'claim' | null;
  selectedTokenId: number | null;

  // UI 状态
  showLiquidityModal: boolean;
  showFeeModal: boolean;

  // Actions
  setPositions: (positions: Position[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  setSelectedOperation: (operation: 'add' | 'remove' | 'claim' | null) => void;
  setSelectedTokenId: (tokenId: number | null) => void;

  showLiquidityModalFor: (operation: 'add' | 'remove', tokenId?: number) => void;
  hideLiquidityModal: () => void;
  showFeeModalFor: (tokenId: number) => void;
  hideFeeModal: () => void;

  addPosition: (position: Position) => void;
  updatePosition: (tokenId: number, updates: Partial<Position>) => void;
  removePosition: (tokenId: number) => void;

  reset: () => void;
}

export const useUniswapStore = create<UniswapState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      positions: [],
      isLoading: false,
      error: null,
      selectedOperation: null,
      selectedTokenId: null,
      showLiquidityModal: false,
      showFeeModal: false,

      // Actions
      setPositions: (positions) => set({ positions }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      setSelectedOperation: (selectedOperation) => set({ selectedOperation }),

      setSelectedTokenId: (selectedTokenId) => set({ selectedTokenId }),

      showLiquidityModalFor: (operation, tokenId) => set({
        selectedOperation: operation,
        selectedTokenId: tokenId || null,
        showLiquidityModal: true
      }),

      hideLiquidityModal: () => set({
        selectedOperation: null,
        selectedTokenId: null,
        showLiquidityModal: false
      }),

      showFeeModalFor: (tokenId) => set({
        selectedOperation: 'claim',
        selectedTokenId: tokenId,
        showFeeModal: true
      }),

      hideFeeModal: () => set({
        selectedOperation: null,
        selectedTokenId: null,
        showFeeModal: false
      }),

      addPosition: (position) => set((state) => ({
        positions: [...state.positions, position]
      })),

      updatePosition: (tokenId, updates) => set((state) => ({
        positions: state.positions.map(pos =>
          pos.tokenId === tokenId ? { ...pos, ...updates } : pos
        )
      })),

      removePosition: (tokenId) => set((state) => ({
        positions: state.positions.filter(pos => pos.tokenId !== tokenId)
      })),

      reset: () => set({
        positions: [],
        isLoading: false,
        error: null,
        selectedOperation: null,
        selectedTokenId: null,
        showLiquidityModal: false,
        showFeeModal: false
      })
    }),
    {
      name: 'uniswap-store'
    }
  )
);
```

## 🎣 自定义 Hooks

### useUniswapPositions

```typescript
// app/pools/uniswap/hooks/useUniswapPositions.ts
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useUniswapV3Adapter } from '@/lib/hooks/useContract';
import { formatPosition } from '@/lib/utils/format';

export const useUniswapPositions = (tokenId?: number) => {
  const { address } = useAccount();
  const contract = useUniswapV3Adapter();

  return useQuery({
    queryKey: ['uniswap-positions', address, tokenId],
    queryFn: async () => {
      if (!address) return null;

      try {
        // 获取用户的 NFT 列表
        const nftManager = contract.nftManager;
        const balance = await nftManager.balanceOf(address);

        const positions = [];
        for (let i = 0; i < balance; i++) {
          const currentTokenId = await nftManager.tokenOfOwnerByIndex(address, i);

          // 如果指定了 tokenId，只返回匹配的
          if (tokenId && currentTokenId !== tokenId) continue;

          const positionData = await nftManager.positions(currentTokenId);
          const formattedPosition = await formatPosition(positionData, currentTokenId);
          positions.push(formattedPosition);
        }

        return tokenId ? positions[0] : positions;
      } catch (error) {
        console.error('Failed to fetch positions:', error);
        throw error;
      }
    },
    enabled: !!address,
    staleTime: 30000, // 30秒缓存
    refetchInterval: 60000 // 1分钟自动刷新
  });
};
```

### useLiquidityOperations

```typescript
// app/pools/uniswap/hooks/useLiquidityOperations.ts
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useDefiAggregator } from '@/lib/hooks/useContract';
import { UNISWAP_ADAPTER_ADDRESS } from '@/lib/constants';

export const useLiquidityOperations = () => {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const defiAggregator = useDefiAggregator();

  const addLiquidity = async (params: any) => {
    try {
      // 估算 Gas
      const estimate = await defiAggregator.estimateGas.executeOperation([
        UNISWAP_ADAPTER_ADDRESS,
        2, // ADD_LIQUIDITY
        params
      ]);
      setGasEstimate(estimate);

      // 执行交易
      writeContract({
        address: defiAggregator.address,
        abi: defiAggregator.abi,
        functionName: 'executeOperation',
        args: [
          UNISWAP_ADAPTER_ADDRESS,
          2, // ADD_LIQUIDITY
          params
        ]
      });
    } catch (err) {
      console.error('Add liquidity failed:', err);
      throw err;
    }
  };

  const removeLiquidity = async (params: any) => {
    try {
      // 估算 Gas
      const estimate = await defiAggregator.estimateGas.executeOperation([
        UNISWAP_ADAPTER_ADDRESS,
        3, // REMOVE_LIQUIDITY
        params
      ]);
      setGasEstimate(estimate);

      // 执行交易
      writeContract({
        address: defiAggregator.address,
        abi: defiAggregator.abi,
        functionName: 'executeOperation',
        args: [
          UNISWAP_ADAPTER_ADDRESS,
          3, // REMOVE_LIQUIDITY
          params
        ]
      });
    } catch (err) {
      console.error('Remove liquidity failed:', err);
      throw err;
    }
  };

  const collectFees = async (params: any) => {
    try {
      writeContract({
        address: defiAggregator.address,
        abi: defiAggregator.abi,
        functionName: 'executeOperation',
        args: [
          UNISWAP_ADAPTER_ADDRESS,
          18, // COLLECT_FEES
          params
        ]
      });
    } catch (err) {
      console.error('Collect fees failed:', err);
      throw err;
    }
  };

  return {
    addLiquidity,
    removeLiquidity,
    collectFees,
    isLoading: isPending || isConfirming,
    isSuccess: isConfirmed,
    error,
    gasEstimate,
    transactionHash: hash
  };
};
```

## 📄 页面实现

### Uniswap V3 主页面

```typescript
// app/pools/uniswap/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { PositionCard } from './components/PositionCard';
import { LiquidityModal } from './components/LiquidityModal';
import { useUniswapStore } from '@/store/uniswapStore';
import { useUniswapPositions } from './hooks/useUniswapPositions';
import { formatUSD } from '@/lib/utils/format';

export default function UniswapPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    positions,
    showLiquidityModal,
    selectedOperation,
    selectedTokenId,
    hideLiquidityModal,
    showLiquidityModalFor
  } = useUniswapStore();

  const { data: userPositions, isLoading, error, refetch } = useUniswapPositions();

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const totalTVL = userPositions?.reduce(
    (sum, pos) => sum + pos.token0ValueUSD + pos.token1ValueUSD,
    0
  ) || 0;

  const totalFees = userPositions?.reduce(
    (sum, pos) => sum + (Number(pos.tokensOwed0) + Number(pos.tokensOwed1)),
    0
  ) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-pink-500 to-yellow-400 bg-clip-text text-transparent">
            Uniswap V3 流动性挖矿
          </h1>
          <p className="text-xl text-gray-400">
            在去中心化交易所提供流动性，赚取交易手续费奖励
          </p>
        </div>

        {/* 统计概览 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-purple-400" />
                <Badge className="bg-green-500/20 text-green-400">
                  Active
                </Badge>
              </div>
              <div className="text-2xl font-bold mb-2 text-white">
                {formatUSD(totalTVL)}
              </div>
              <div className="text-sm text-gray-400">总锁仓价值</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-8 h-8 text-blue-400" />
                <span className="text-sm text-gray-400">24h</span>
              </div>
              <div className="text-2xl font-bold mb-2 text-white">
                {userPositions?.length || 0}
              </div>
              <div className="text-sm text-gray-400">活跃仓位</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-8 h-8 text-green-400" />
                <span className="text-sm text-green-400">+12.5%</span>
              </div>
              <div className="text-2xl font-bold mb-2 text-white">
                8.2%
              </div>
              <div className="text-sm text-gray-400">平均年化收益率</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-yellow-400" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRefresh}
                  className="text-yellow-400 hover:text-yellow-300"
                >
                  刷新
                </Button>
              </div>
              <div className="text-2xl font-bold mb-2 text-white">
                {formatUSD(totalFees)}
              </div>
              <div className="text-sm text-gray-400">可收取手续费</div>
            </CardContent>
          </Card>
        </div>

        {/* 主要内容 */}
        <Tabs defaultValue="positions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900 border-gray-800">
            <TabsTrigger value="positions" className="data-[state=active]:bg-gray-800 text-white">
              我的仓位
            </TabsTrigger>
            <TabsTrigger value="add" className="data-[state=active]:bg-gray-800 text-white">
              添加流动性
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-gray-800 text-white">
              收益分析
            </TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">流动性仓位</h2>
              <Button
                onClick={() => showLiquidityModalFor('add')}
                className="bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                创建新仓位
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="bg-gray-900 border-gray-800">
                    <CardContent className="p-6">
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-800 rounded"></div>
                        <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-800 rounded w-1/2"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card className="bg-red-500/10 border-red-500/30">
                <CardContent className="p-6">
                  <p className="text-red-400">
                    加载仓位失败: {error.message}
                  </p>
                </CardContent>
              </Card>
            ) : userPositions?.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-12 text-center">
                  <div className="text-6xl mb-4">🦄</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    还没有流动性仓位
                  </h3>
                  <p className="text-gray-400 mb-6">
                    开始提供流动性来赚取交易手续费
                  </p>
                  <Button
                    onClick={() => showLiquidityModalFor('add')}
                    className="bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    创建第一个仓位
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userPositions?.map((position) => (
                  <PositionCard
                    key={position.tokenId}
                    tokenId={position.tokenId}
                    onRefresh={handleRefresh}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-xl text-white">
                  创建新的流动性仓位
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-6">
                  选择代币对并设置价格区间来创建新的流动性仓位
                </p>
                <Button
                  onClick={() => showLiquidityModalFor('add')}
                  className="bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  开始创建
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-xl text-white">
                  收益分析
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  详细的收益分析和历史数据
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 流动性操作弹窗 */}
        <LiquidityModal
          isOpen={showLiquidityModal}
          onClose={hideLiquidityModal}
          operation={selectedOperation || 'add'}
          tokenId={selectedTokenId || undefined}
          onSuccess={handleRefresh}
        />
      </div>
    </div>
  );
}
```

## 🎨 样式设计

### 颜色主题

```css
/* Uniswap V3 专用主题 */
:root {
  --uniswap-primary: 255; /* 粉色 */
  --uniswap-secondary: 43; /* 黄色 */
  --uniswap-accent: 212; /* 蓝色 */
}

.uniswap-gradient {
  background: linear-gradient(135deg,
    hsl(var(--uniswap-primary), 100%, 50%),
    hsl(var(--uniswap-secondary), 100%, 50%)
  );
}

.uniswap-card {
  background: linear-gradient(135deg,
    hsla(var(--uniswap-primary), 100%, 10%, 0.1),
    hsla(var(--uniswap-secondary), 100%, 10%, 0.1)
  );
  border: 1px solid hsla(var(--uniswap-primary), 100%, 50%, 0.2);
}
```

### 动画效果

```css
/* 流动性添加动画 */
@keyframes liquidityAdd {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.liquidity-add-animation {
  animation: liquidityAdd 0.6s ease-out;
}

/* 价格区间滑块样式 */
.price-range-slider {
  position: relative;
}

.price-range-slider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg,
    hsl(var(--uniswap-primary), 100%, 30%),
    hsl(var(--uniswap-secondary), 100%, 30%)
  );
  transform: translateY(-50%);
  border-radius: 2px;
}
```

## 🧪 测试策略

### 组件测试

```typescript
// __tests__/components/LiquidityModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LiquidityModal } from '@/app/pools/uniswap/components/LiquidityModal';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockProps = {
  isOpen: true,
  onClose: jest.fn(),
  operation: 'add' as const,
  onSuccess: jest.fn()
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient();

  return render(
    <WagmiProvider>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </WagmiProvider>
  );
};

describe('LiquidityModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders add liquidity form correctly', () => {
    renderWithProviders(<LiquidityModal {...mockProps} />);

    expect(screen.getByText('添加流动性')).toBeInTheDocument();
    expect(screen.getByLabelText('代币 0')).toBeInTheDocument();
    expect(screen.getByLabelText('代币 1')).toBeInTheDocument();
    expect(screen.getByLabelText('数量 0')).toBeInTheDocument();
    expect(screen.getByLabelText('数量 1')).toBeInTheDocument();
  });

  it('validates required fields before submission', async () => {
    renderWithProviders(<LiquidityModal {...mockProps} />);

    const submitButton = screen.getByText('添加流动性');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('calls onSuccess when operation completes', async () => {
    renderWithProviders(<LiquidityModal {...mockProps} />);

    // 模拟成功操作
    fireEvent.change(screen.getByLabelText('数量 0'), {
      target: { value: '1000' }
    });
    fireEvent.change(screen.getByLabelText('数量 1'), {
      target: { value: '1' }
    });

    const submitButton = screen.getByText('添加流动性');
    fireEvent.click(submitButton);

    // 等待操作完成
    await waitFor(() => {
      expect(mockProps.onSuccess).toHaveBeenCalled();
    });
  });
});
```

### 集成测试

```typescript
// __tests__/integration/uniswap-flow.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UniswapPage } from '@/app/pools/uniswap/page';
import { setupTestEnvironment } from '@/lib/test-utils';

describe('Uniswap V3 Flow Integration', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  it('complete add liquidity flow', async () => {
    render(<UniswapPage />);

    // 1. 点击添加流动性按钮
    const addButton = screen.getByText('创建新仓位');
    fireEvent.click(addButton);

    // 2. 填写流动性表单
    await waitFor(() => {
      expect(screen.getByText('添加流动性')).toBeInTheDocument();
    });

    // 3. 模拟代币选择和数量输入
    fireEvent.change(screen.getByLabelText('数量 0'), {
      target: { value: '10000' }
    });
    fireEvent.change(screen.getByLabelText('数量 1'), {
      target: { value: '10' }
    });

    // 4. 提交表单
    fireEvent.click(screen.getByText('添加流动性'));

    // 5. 验证成功状态
    await waitFor(() => {
      expect(screen.getByText('添加流动性成功')).toBeInTheDocument();
    });
  });
});
```

## 🚀 部署配置

### 环境变量

```bash
# .env.local
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_INFURA_ID=your_infura_id
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_infura_id

# Uniswap V3 合约地址
NEXT_PUBLIC_UNISWAP_V3_ADAPTER=0x0Da05F4753534669dCE540C1Bfc348f6728Bedb3
NEXT_PUBLIC_DEFIE_AGGREGATOR=0xD93D27d031FdF461288c904688Dd78D6902eA315
NEXT_PUBLIC_POSITION_MANAGER=0x8B5E5C5aA9FF2a3b17a5A9e5D6E30071Ba6BE74C

# 代币地址
NEXT_PUBLIC_USDT_TOKEN=0xd7C597Cf30fb56162AEDAe8a52927B7CE4076e5B
NEXT_PUBLIC_WETH_TOKEN=0x6a1B8536678C42cacf9e2C6502bffe288c84C8bA
```

### Wagmi 配置

```typescript
// lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { sepolia, mainnet } from 'wagmi/chains';
import { walletConnect, injected, metaMask } from 'wagmi/connectors';

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
    }),
    injected(),
    metaMask(),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});
```

### 构建优化

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  webpack: (config) => {
    // 优化 Uniswap 相关包
    config.resolve.alias = {
      ...config.resolve.alias,
      '@uniswap': path.resolve(__dirname, 'lib/uniswap'),
    };

    return config;
  },
};

module.exports = nextConfig;
```

---

**文档版本**: 1.0.0
**最后更新**: 2025-10-10
**维护者**: CryptoStock 开发团队