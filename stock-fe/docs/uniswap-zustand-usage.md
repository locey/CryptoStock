# Uniswap V3 Zustand Store 使用指南

## 概述

本文档介绍如何使用为 Uniswap V3 功能创建的 Zustand store，包括状态管理、合约交互和UI集成。

## 📁 文件结构

```
stock-fe/
├── lib/
│   ├── config/
│   │   └── loadContracts.ts          # 合约配置加载器
│   ├── contracts/
│   │   └── contracts.ts              # 合约接口定义
│   └── hooks/
│       ├── useUniswapContracts.ts    # 底层合约交互
│       ├── useUniswap.ts             # 主要业务逻辑
│       └── useUniswap.ts             # 简化接口
├── store/
│   └── uniswapStore.ts               # Zustand 主 store
└── docs/
    └── uniswap-zustand-usage.md      # 本使用指南
```

## 🚀 快速开始

### 1. 在组件中使用主 Hook

```typescript
import { useUniswap } from '@/lib/hooks/useUniswap';

function MyComponent() {
  const {
    isConnected,
    address,
    tokens,
    positions,
    handleAddLiquidity,
    showAddLiquidityModal,
    totalTVL,
  } = useUniswap();

  if (!isConnected) {
    return <div>请连接钱包</div>;
  }

  return (
    <div>
      <p>连接地址: {address}</p>
      <p>总锁仓价值: ${totalTVL.toLocaleString()}</p>
      <button onClick={showAddLiquidityModal}>
        添加流动性
      </button>
    </div>
  );
}
```

### 2. 代币管理

```typescript
import { useUniswapTokens } from '@/lib/hooks/useUniswap';

function TokenBalance() {
  const { tokens, getTokenBalance, formatTokenBalance } = useUniswapTokens();

  const { data: usdtBalance } = getTokenBalance(tokens.USDT.address);
  const { data: wethBalance } = getTokenBalance(tokens.WETH.address);

  return (
    <div>
      <div>USDT: {formatTokenBalance(tokens.USDT.address, usdtBalance || 0n)}</div>
      <div>WETH: {formatTokenBalance(tokens.WETH.address, wethBalance || 0n)}</div>
    </div>
  );
}
```

### 3. 流动性操作

```typescript
import { useUniswapOperations } from '@/lib/hooks/useUniswap';
import { UNISWAP_CONFIG } from '@/lib/config/loadContracts';

function LiquidityOperations() {
  const {
    handleAddLiquidity,
    handleRemoveLiquidity,
    handleCollectFees,
    canAddLiquidity,
    approvalState,
    transactionState,
  } = useUniswapOperations();

  // 添加流动性
  const onAddLiquidity = async () => {
    try {
      const params = {
        token0: UNISWAP_CONFIG.tokens.USDT.address,
        token1: UNISWAP_CONFIG.tokens.WETH.address,
        amount0: '1000', // 1000 USDT
        amount1: '0.5',  // 0.5 WETH
        amount0Min: '990',   // 最小 990 USDT (1% 滑点)
        amount1Min: '0.495', // 最小 0.495 WETH (1% 滑点)
        tickLower: -60000,
        tickUpper: 60000,
        recipient: address,
      };

      const txHash = await handleAddLiquidity(params);
      console.log('添加流动性成功:', txHash);
    } catch (error) {
      console.error('添加流动性失败:', error);
    }
  };

  return (
    <div>
      <button onClick={onAddLiquidity} disabled={!canAddLiquidity(params)}>
        添加流动性
      </button>

      {transactionState.isPending && <div>交易进行中...</div>}
      {transactionState.isSuccess && <div>交易成功!</div>}
    </div>
  );
}
```

## 🎯 核心 Hook 详解

### useUniswap()

主要的业务逻辑 Hook，提供完整的 Uniswap V3 功能。

```typescript
const {
  // 基础状态
  isConnected,
  address,
  chainId,

  // 代币相关
  tokens,
  getTokenBalance,
  getTokenAllowance,
  formatTokenBalance,

  // 位置相关
  positions,
  selectedPosition,
  totalTVL,
  totalFees,
  refreshPositions,

  // 操作相关
  handleAddLiquidity,
  handleRemoveLiquidity,
  handleCollectFees,

  // 授权相关
  approvalState,
  ensureTokenApproval,
  ensureNFTApproval,

  // 交易相关
  transactionState,
  transactionHash,

  // UI 相关
  showLiquidityModal,
  showFeeModal,
  selectedPriceRange,
  slippageTolerance,

  // 工具函数
  estimateGas,
  calculateMinAmount,
} = useUniswap();
```

### useUniswapTokens()

专注于代币管理的 Hook。

```typescript
const {
  tokens,                    // 代币信息
  getTokenBalance,          // 获取余额
  getTokenAllowance,         // 获取授权
  formatTokenBalance,        // 格式化余额显示
} = useUniswapTokens();
```

### useUniswapPositions()

专注于位置管理的 Hook。

```typescript
const {
  positions,                 // 用户位置列表
  selectedPosition,          // 选中的位置
  totalTVL,                 // 总锁仓价值
  totalFees,                // 总手续费
  useUserPositions,         // 获取用户位置
  usePositionDetails,       // 获取位置详情
  refreshPositions,         // 刷新位置
  calculateLiquidityValue,   // 计算流动性价值
} = useUniswapPositions();
```

### useUniswapOperations()

专注于操作执行的 Hook。

```typescript
const {
  currentOperation,          // 当前操作
  handleAddLiquidity,       // 添加流动性
  handleRemoveLiquidity,    // 移除流动性
  handleCollectFees,        // 收取手续费
  canAddLiquidity,          // 是否可以添加流动性
  canRemoveLiquidity,       // 是否可以移除流动性
  canCollectFees,           // 是否可以收取手续费
  approvalState,            // 授权状态
  transactionState,         // 交易状态
  estimateGas,              // Gas 估算
} = useUniswapOperations();
```

## 📊 状态管理

### Store 结构

```typescript
interface UniswapState {
  // 基础状态
  isConnected: boolean;
  userAddress: Address | null;
  chainId: number | null;

  // 代币状态
  tokens: Record<string, TokenInfo>;
  balances: Record<string, bigint>;
  allowances: Record<string, Record<string, bigint>>;

  // 位置状态
  positions: PositionInfo[];
  selectedPosition: PositionInfo | null;

  // 操作状态
  currentOperation: 'add' | 'remove' | 'claim' | null;
  operationParams: Partial<OperationParams>;

  // 授权状态
  approvalState: ApprovalState;

  // 交易状态
  transactionState: TransactionState;

  // UI 状态
  showLiquidityModal: boolean;
  showFeeModal: boolean;
  selectedPriceRange: PriceRangePreset;
  slippageTolerance: number;

  // 错误和加载状态
  error: string | null;
  isLoading: boolean;
}
```

### 使用选择器

```typescript
import { useUniswapSelectors, useUniswapComputed } from '@/store/uniswapStore';

// 使用选择器
const isConnected = useUniswapSelectors.isConnected();
const userAddress = useUniswapSelectors.userAddress();
const positions = useUniswapSelectors.positions();

// 使用计算属性
const totalTVL = useUniswapComputed.totalTVL();
const hasSufficientBalance = useUniswapComputed.hasSufficientBalance(
  tokenAddress,
  amount
);
```

## 🔧 合约配置

### 动态加载配置

```typescript
import { UNISWAP_CONFIG } from '@/lib/config/loadContracts';

// 获取合约地址
console.log(UNISWAP_CONFIG.contracts.DefiAggregator);
console.log(UNISWAP_CONFIG.contracts.UniswapV3Adapter);

// 获取代币配置
console.log(UNISWAP_CONFIG.tokens.USDT);
console.log(UNISWAP_CONFIG.tokens.WETH);

// 获取预设价格区间
console.log(UNISWAP_CONFIG.presets.STANDARD);
```

### 配置验证

```typescript
import { loadUniswapDeployment } from '@/lib/config/loadContracts';

try {
  const deployment = loadUniswapDeployment();
  console.log('部署配置:', deployment);
} catch (error) {
  console.error('配置加载失败:', error);
}
```

## 🎨 UI 组件集成

### 添加流动性弹窗

```typescript
import { useUniswap, useUniswapUI } from '@/lib/hooks/useUniswap';

function AddLiquidityModal() {
  const {
    handleAddLiquidity,
    tokens,
    approvalState,
    transactionState,
    estimateGas,
  } = useUniswap();

  const { slippageTolerance, setSlippageTolerance, calculateMinAmount } = useUniswapUI();

  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);

  // 估算 Gas
  const estimateGasForOperation = async () => {
    if (!amount0 || !amount1) return;

    const params = {
      token0: tokens.USDT.address,
      token1: tokens.WETH.address,
      amount0,
      amount1,
      amount0Min: calculateMinAmount(amount0, slippageTolerance),
      amount1Min: calculateMinAmount(amount1, slippageTolerance),
      recipient: address,
    };

    const estimate = await estimateGas.addLiquidity(params);
    setGasEstimate(estimate);
  };

  const handleSubmit = async () => {
    try {
      const params = {
        token0: tokens.USDT.address,
        token1: tokens.WETH.address,
        amount0,
        amount1,
        amount0Min: calculateMinAmount(amount0, slippageTolerance),
        amount1Min: calculateMinAmount(amount1, slippageTolerance),
        recipient: address,
      };

      await handleAddLiquidity(params);
    } catch (error) {
      console.error('添加流动性失败:', error);
    }
  };

  return (
    <div className="modal">
      <h2>添加流动性</h2>

      {/* 代币输入 */}
      <input
        value={amount0}
        onChange={(e) => setAmount0(e.target.value)}
        placeholder="USDT 数量"
      />
      <input
        value={amount1}
        onChange={(e) => setAmount1(e.target.value)}
        placeholder="WETH 数量"
      />

      {/* 滑点设置 */}
      <div>
        <label>滑点容忍度: {slippageTolerance}%</label>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={slippageTolerance}
          onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
        />
      </div>

      {/* Gas 估算 */}
      {gasEstimate && (
        <div>预估 Gas: {formatEther(gasEstimate)} ETH</div>
      )}

      {/* 授权状态 */}
      {approvalState.isLoading && <div>授权中...</div>}

      {/* 交易状态 */}
      {transactionState.isPending && <div>交易进行中...</div>}
      {transactionState.isSuccess && <div>交易成功!</div>}

      <button onClick={handleSubmit} disabled={!amount0 || !amount1}>
        添加流动性
      </button>
    </div>
  );
}
```

### 位置列表组件

```typescript
import { useUniswapPositions, useUniswapOperations } from '@/lib/hooks/useUniswap';

function PositionList() {
  const { positions, totalTVL, refreshPositions } = useUniswapPositions();
  const { showRemoveLiquidityModal, showCollectFeesModal } = useUniswapOperations();

  if (positions.length === 0) {
    return <div>暂无流动性位置</div>;
  }

  return (
    <div>
      <div className="summary">
        <h3>总锁仓价值: ${totalTVL.toLocaleString()}</h3>
        <button onClick={refreshPositions}>刷新</button>
      </div>

      {positions.map((position) => (
        <div key={position.tokenId.toString()} className="position-card">
          <h4>Position #{position.tokenId}</h4>
          <p>流动性: {position.liquidity.toString()}</p>
          <p>价格区间: [{position.tickLower}, {position.tickUpper}]</p>
          <p>待收取手续费: {position.tokensOwed0.toString()} USDT, {position.tokensOwed1.toString()} WETH</p>

          <div className="actions">
            <button onClick={() => showRemoveLiquidityModal(position)}>
              移除流动性
            </button>
            <button onClick={() => showCollectFeesModal(position)}>
              收取手续费
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## 🔍 错误处理

### 错误类型

```typescript
import { UniswapError } from '@/lib/contracts/contracts';

// 错误处理示例
const handleError = (error: unknown) => {
  if (error instanceof Error) {
    switch (error.message) {
      case UniswapError.INSUFFICIENT_BALANCE:
        console.error('余额不足');
        break;
      case UniswapError.INSUFFICIENT_ALLOWANCE:
        console.error('授权不足');
        break;
      case UniswapError.INVALID_TOKEN_PAIR:
        console.error('不支持的代币对');
        break;
      default:
        console.error('未知错误:', error.message);
    }
  }
};
```

### 交易错误处理

```typescript
import { useUniswap } from '@/lib/hooks/useUniswap';

function TransactionHandler() {
  const { error, transactionState, setError } = useUniswap();

  useEffect(() => {
    if (error) {
      // 显示错误消息
      toast.error(error);
      // 清除错误状态
      setError(null);
    }
  }, [error, setError]);

  useEffect(() => {
    if (transactionState.isConfirming) {
      toast.info('交易确认中...');
    }
    if (transactionState.isSuccess) {
      toast.success('交易成功!');
    }
  }, [transactionState]);

  return null;
}
```

## 📈 性能优化

### 选择器优化

```typescript
import { useMemo } from 'react';
import { useUniswapStore } from '@/store/uniswapStore';

// 使用 useMemo 优化计算
function useOptimizedData() {
  const positions = useUniswapStore((state) => state.positions);
  const tokens = useUniswapStore((state) => state.tokens);

  const activePositions = useMemo(() => {
    return positions.filter(position => position.liquidity > 0n);
  }, [positions]);

  const totalValue = useMemo(() => {
    return activePositions.reduce((total, position) => {
      return total + (position.token0ValueUSD || 0) + (position.token1ValueUSD || 0);
    }, 0);
  }, [activePositions]);

  return { activePositions, totalValue };
}
```

### 数据缓存

```typescript
import { useQuery } from '@tanstack/react-query';

// 使用 React Query 缓存数据
function useCachedPositions() {
  const { address } = useAccount();

  return useQuery({
    queryKey: ['positions', address],
    queryFn: async () => {
      // 获取位置数据
      return await fetchPositions(address);
    },
    staleTime: 30000, // 30秒缓存
    refetchInterval: 60000, // 1分钟自动刷新
  });
}
```

## 🧪 测试

### 单元测试

```typescript
import { renderHook, act } from '@testing-library/react';
import { useUniswap } from '@/lib/hooks/useUniswap';

describe('useUniswap', () => {
  it('should initialize correctly', () => {
    const { result } = renderHook(() => useUniswap());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.positions).toEqual([]);
    expect(result.current.tokens).toBeDefined();
  });

  it('should handle add liquidity', async () => {
    const { result } = renderHook(() => useUniswap());

    const params = {
      token0: '0x...',
      token1: '0x...',
      amount0: '1000',
      amount1: '0.5',
      amount0Min: '990',
      amount1Min: '0.495',
      recipient: '0x...',
    };

    await act(async () => {
      await result.current.handleAddLiquidity(params);
    });

    // 验证结果
  });
});
```

### 集成测试

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { AddLiquidityModal } from './AddLiquidityModal';

describe('AddLiquidityModal', () => {
  it('should submit form with valid data', async () => {
    render(<AddLiquidityModal />);

    fireEvent.change(screen.getByPlaceholderText('USDT 数量'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByPlaceholderText('WETH 数量'), {
      target: { value: '0.5' },
    });

    fireEvent.click(screen.getByText('添加流动性'));

    // 验证调用
  });
});
```

## 📚 最佳实践

### 1. 状态管理

- 使用选择器避免不必要的重渲染
- 将相关的状态分组管理
- 使用计算属性优化性能

### 2. 错误处理

- 提供用户友好的错误消息
- 实现重试机制
- 记录错误日志

### 3. 用户体验

- 显示加载状态
- 提供交易进度反馈
- 实现乐观更新

### 4. 安全性

- 验证所有输入参数
- 检查余额和授权
- 使用滑点保护

### 5. 性能优化

- 合理使用缓存
- 避免不必要的重新渲染
- 优化大数据量处理

---

**文档版本**: 1.0.0
**最后更新**: 2025-10-10
**维护者**: CryptoStock 开发团队