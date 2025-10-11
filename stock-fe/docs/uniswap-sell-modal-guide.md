# Uniswap 卖出弹窗组件指南

## 概述

`UniswapSellModal` 是用于 Uniswap V3 流动性管理的弹出组件，支持两种主要操作：
- **移除流动性 (Remove Liquidity)** - 完全撤出流动性位置
- **收取手续费 (Collect Fees)** - 只收取累积的手续费

## 功能特性

### 🔥 核心功能
- ✅ 支持移除流动性操作
- ✅ 支持收取手续费操作
- ✅ 自动获取用户流动性位置
- ✅ 流动性位置选择器
- ✅ NFT 授权管理
- ✅ 滑点保护设置
- ✅ 实时余额更新
- ✅ 交易状态跟踪

### 🎨 UI/UX 特性
- 现代化暗色主题设计
- 步骤指示器
- 错误状态处理
- 交易成功确认
- 响应式布局

## 使用方法

### 基本用法

```tsx
import UniswapSellModal from '@/components/UniswapSellModal';

function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>
        管理流动性
      </button>

      <UniswapSellModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(result) => {
          console.log('操作成功:', result);
        }}
      />
    </div>
  );
}
```

### 指定默认位置

```tsx
<UniswapSellModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  defaultPosition={{
    tokenId: BigInt(1),
    liquidity: "1000000",
    tickLower: -60000,
    tickUpper: 60000,
    tokensOwed0: "1000000",
    tokensOwed1: "500000000000000000",
    formattedLiquidity: "1.0",
    formattedTokensOwed0: "1.0",
    formattedTokensOwed1: "0.5",
    totalFeesUSD: 1500.0
  }}
/>
```

## 组件 Props

| Prop | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `isOpen` | `boolean` | ✅ | - | 控制弹窗显示/隐藏 |
| `onClose` | `() => void` | ✅ | - | 关闭弹窗的回调函数 |
| `onSuccess` | `(result: any) => void` | ❌ | - | 操作成功时的回调函数 |
| `defaultPosition` | `UniswapPositionInfo \| null` | ❌ | `null` | 默认选择的流动性位置 |

## 操作流程

### 1. 移除流动性流程

```
选择操作类型 → 选择流动性位置 → 授权NFT → 移除流动性 → 交易确认
```

**关键参数：**
- `operationType`: 3 (REMOVE_LIQUIDITY)
- `tokenId`: NFT Token ID
- `amount0Min`: 最小代币0数量（滑点保护）
- `amount1Min`: 最小代币1数量（滑点保护）

### 2. 收取手续费流程

```
选择操作类型 → 选择流动性位置 → 授权NFT → 收取手续费 → 交易确认
```

**关键参数：**
- `operationType`: 18 (COLLECT_FEES)
- `tokenId`: NFT Token ID
- `recipient`: 接收手续费的地址

## 测试用例参考

### 移除流动性测试用例

```javascript
// 参考测试文件: test/08-uniswap-sepolia.test.js (第333-562行)

const removeLiquidityParams = {
    tokens: [token0Address], // 占位符地址
    amounts: [0, 0], // amount0Min, amount1Min
    recipient: user.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    tokenId: tokenId, // 🔑 关键：NFT Token ID
    extraData: "0x"
};

// 执行操作
await defiAggregator.executeOperation(
    "uniswapv3",
    3, // REMOVE_LIQUIDITY
    removeLiquidityParams
);
```

### 收取手续费测试用例

```javascript
// 参考测试文件: test/08-uniswap-sepolia.test.js (第564-763行)

const claimRewardsParams = {
    tokens: [token0Address],
    amounts: [], // 空数组表示收取指定 tokenId 的手续费
    recipient: user.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    tokenId: tokenId, // 🔑 关键：NFT Token ID
    extraData: "0x"
};

// 执行操作
await defiAggregator.executeOperation(
    "uniswapv3",
    18, // COLLECT_FEES
    claimRewardsParams
);
```

## Hook 集成

组件使用以下 Uniswap Hooks：

```tsx
// 基础功能
const { isConnected, refreshUserInfo } = useUniswap();
const { approveNFT } = useUniswapTokens();
const { removeLiquidity, collectFees } = useUniswapOperations();
const { userPositions, fetchUserPositions } = useUniswapPositions();
```

## 状态管理

### 步骤状态
- `select`: 选择操作类型和流动性位置
- `approve`: NFT 授权进行中
- `remove`: 移除流动性进行中
- `collect`: 收取手续费进行中
- `success`: 操作成功完成

### 错误处理
组件会自动处理以下错误情况：
- 钱包未连接
- 无流动性位置
- 授权失败
- 交易执行失败
- 网络错误

## 安全考虑

### 授权管理
- 每次操作前都会验证 NFT 授权
- 支持最小金额设置（滑点保护）
- 自动检查位置余额充足性

### 滑点保护
```tsx
const calculateMinAmounts = () => {
  const amount0Min = expectedWithdrawals.token0Amount * (1 - slippage / 100);
  const amount1Min = expectedWithdrawals.token1Amount * (1 - slippage / 100);
  return { amount0Min, amount1Min };
};
```

## 样式定制

组件使用 Tailwind CSS，主题变量：
- 主色调: `blue-500` (操作按钮)
- 成功色: `green-500` (成功状态)
- 警告色: `yellow-500` (授权状态)
- 错误色: `red-500` (错误状态)
- 危险色: `red-500` (移除操作)
- 收益色: `green-500` (收取操作)

## 最佳实践

### 1. 位置选择
- 优先选择有较高流动性的位置
- 检查手续费累积情况
- 考虑价格区间与当前价格的偏离

### 2. 滑点设置
- 流动性充足时可设置较低滑点 (0.1-0.5%)
- 流动性较少时应设置较高滑点 (1-3%)
- 避免设置过低滑点导致交易失败

### 3. 授权管理
- 定期检查和更新授权
- 操作完成后刷新用户信息
- 监控交易状态和结果

## 故障排除

### 常见问题

**Q: 为什么看不到流动性位置？**
A: 确保钱包已连接，并且该地址确实拥有 Uniswap V3 NFT 位置。

**Q: 授权失败怎么办？**
A: 检查钱包状态，确保有足够的 ETH 支付 Gas 费，重新尝试授权。

**Q: 交易失败怎么办？**
A: 检查滑点设置是否合理，确认位置有足够的流动性，查看具体错误信息。

**Q: 收取手续费显示 0？**
A: 该位置可能没有累积手续费，或者手续费已被领取。

## 更新日志

### v1.0.0
- ✅ 添加移除流动性功能
- ✅ 添加收取手续费功能
- ✅ 实现位置选择器
- ✅ 添加滑点保护
- ✅ 完善错误处理
- ✅ 响应式设计

## 相关文档

- [Uniswap V3 前端集成指南](./uniswap-v3-frontend-integration-guide.md)
- [Uniswap V3 API 参考](./uniswap-v3-api-reference.md)
- [Uniswap Hook 使用指南](./uniswap-with-clients-usage.md)
- [测试用例说明](../test/08-uniswap-sepolia.test.js)