# Web3 Hooks 使用指南

## 概述

这个设计模式将 Zustand store 与 React hooks 结合，提供了更简洁的 API 和自动的客户端依赖管理。

## 架构设计

### 1. 分层架构

```
┌─────────────────────────────────────┐
│          React Components          │
├─────────────────────────────────────┤
│     useTokenFactoryWithClients     │  ← 包装 Hook
├─────────────────────────────────────┤
│      useTokenFactoryStore          │  ← Zustand Store
├─────────────────────────────────────┤
│         useWeb3Clients             │  ← 客户端 Hook
├─────────────────────────────────────┤
│        WalletProvider              │  ← 钱包 Provider
└─────────────────────────────────────┘
```

### 2. 设计优势

1. **关注点分离**：
   - Store 专注于业务逻辑
   - Hook 专注于客户端集成
   - 组件专注于 UI 展示

2. **依赖注入**：
   - 自动注入 Web3 客户端
   - 避免手动传递客户端参数

3. **类型安全**：
   - 完整的 TypeScript 类型支持
   - 编译时错误检查

4. **可测试性**：
   - Store 可以独立测试
   - Hook 可以模拟客户端

## 使用示例

### 基础用法

```tsx
import { useTokenFactoryWithClients } from '@/lib/hooks/useTokenFactoryWithClients';

function TokenManager() {
  const {
    contractAddress,
    allTokens,
    isLoading,
    isCreatingToken,
    error,
    isConnected,
    fetchAllTokens,
    createToken,
    clearErrors
  } = useTokenFactoryWithClients();

  // 加载代币列表
  useEffect(() => {
    if (isConnected) {
      fetchAllTokens();
    }
  }, [isConnected, fetchAllTokens]);

  // 创建新代币
  const handleCreateToken = async () => {
    try {
      await createToken({
        name: 'Apple Inc.',
        symbol: 'AAPL',
        initialSupply: BigInt('1000000000000000000000') // 1000 tokens
      });
      alert('代币创建成功！');
    } catch (err) {
      console.error('创建失败:', err);
    }
  };

  return (
    <div>
      <h2>Token Factory</h2>
      <p>合约地址: {contractAddress}</p>

      {error && (
        <div className="error">
          {error}
          <button onClick={clearErrors}>清除错误</button>
        </div>
      )}

      <button
        onClick={handleCreateToken}
        disabled={!isConnected || isCreatingToken}
      >
        {isCreatingToken ? '创建中...' : '创建代币'}
      </button>

      <div>
        <h3>代币列表</h3>
        {isLoading ? (
          <p>加载中...</p>
        ) : (
          <ul>
            {allTokens.map((token) => (
              <li key={token.symbol}>
                {token.name} ({token.symbol}) - {token.address}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

### 高级用法

```tsx
import { useTokenFactoryWithClients } from '@/lib/hooks/useTokenFactoryWithClients';

function AdvancedTokenManager() {
  const {
    allTokens,
    tokenBySymbol,
    isConnected,
    fetchTokensMapping,
    getTokenAddress,
    tokenExists,
    createToken
  } = useTokenFactoryWithClients();

  // 检查代币是否存在
  const checkTokenExists = async (symbol: string) => {
    const exists = await tokenExists(symbol);
    console.log(`${symbol} 存在:`, exists);
  };

  // 获取特定代币地址
  const getTokenInfo = async (symbol: string) => {
    try {
      const address = await getTokenAddress(symbol);
      console.log(`${symbol} 地址:`, address);
    } catch (error) {
      console.error('获取失败:', error);
    }
  };

  return (
    <div>
      {/* 高级功能 UI */}
    </div>
  );
}
```

## API 参考

### useTokenFactoryWithClients

#### 状态
- `contractAddress`: 合约地址
- `allTokens`: 所有代币列表
- `tokenBySymbol`: 代币映射
- `isLoading`: 加载状态
- `isCreatingToken`: 创建代币状态
- `error`: 错误信息
- `isConnected`: 钱包连接状态
- `address`: 用户地址

#### 方法
- `fetchAllTokens()`: 获取所有代币
- `fetchTokensMapping()`: 获取代币映射
- `getTokenAddress(symbol)`: 获取代币地址
- `getTokensCount()`: 获取代币总数
- `tokenExists(symbol)`: 检查代币是否存在
- `createToken(params)`: 创建新代币
- `clearErrors()`: 清除错误
- `reset()`: 重置状态

### CreateTokenParams

```typescript
interface CreateTokenParams {
  name: string;
  symbol: string;
  initialSupply: bigint;
}
```

## 最佳实践

### 1. 错误处理

```tsx
const { createToken, error, clearErrors } = useTokenFactoryWithClients();

const handleCreate = async () => {
  try {
    await createToken(params);
    // 成功处理
  } catch (err) {
    // 错误已经在 store 中处理
    console.error('创建失败:', err);
  }
};
```

### 2. 加载状态

```tsx
const { isLoading, isCreatingToken } = useTokenFactoryWithClients();

return (
  <div>
    <button disabled={isLoading || isCreatingToken}>
      {isCreatingToken ? '创建中...' : '创建代币'}
    </button>
  </div>
);
```

### 3. 条件渲染

```tsx
const { isConnected, contractAddress } = useTokenFactoryWithClients();

if (!isConnected) {
  return <div>请先连接钱包</div>;
}

if (!contractAddress) {
  return <div>合约未初始化</div>;
}
```

## 性能优化

1. **使用 useCallback**：避免不必要的重渲染
2. **条件调用**：只在需要时调用合约方法
3. **缓存结果**：利用 React Query 缓存数据

## 扩展性

这个模式可以轻松扩展到其他合约：

1. 创建新的 Store（如 `useOracleStore`）
2. 创建对应的包装 Hook（如 `useOracleWithClients`）
3. 在组件中使用相同的模式

```typescript
// 示例：Oracle Store Hook
export const useOracleWithClients = () => {
  const store = useOracleStore();
  const { publicClient, walletClient, getWalletClient, chain, address } = useWeb3Clients();

  // 包装方法...
  return { /* ... */ };
};
```