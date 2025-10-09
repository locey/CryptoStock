# 币股池页面

## 概述

币股池页面是 CryptoStock 平台的核心交易界面，提供了完整的股票代币交易功能。用户可以在此页面查看所有可交易的股票代币，查看实时价格、成交量、市值等信息，并进行买入/卖出操作。

## 功能特性

### 🎯 核心功能
- **实时价格显示** - 显示股票代币的实时价格和 24 小时涨跌幅
- **市场数据** - 包含成交量、市值、总供应量等关键指标
- **用户持仓** - 显示用户持有的代币数量和价值
- **交易功能** - 支持买入和卖出操作
- **搜索和筛选** - 支持按代币名称、符号搜索，多种排序方式

### 📊 数据展示
- **代币信息** - 代币名称、符号、合约地址
- **价格数据** - 当前价格、24 小时涨跌幅
- **交易数据** - 24 小时成交量、市值
- **用户数据** - 持仓数量、持仓价值

### 🛒 交易功能
- **买入操作** - 输入买入数量，显示预计成本
- **卖出操作** - 输入卖出数量，显示预计收入
- **高级设置** - 滑点容忍度设置
- **快速选择** - 预设金额快速选择

## 页面结构

```
币股池页面 (/pool)
├── 页面头部
│   ├── 标题和描述
│   └── 总市值统计
├── 搜索和筛选
│   ├── 搜索框
│   └── 排序选项
├── 代币列表
│   ├── 表格头部
│   ├── 代币行数据
│   └── 操作按钮
└── 交易界面
    ├── 代币信息
    ├── 交易类型选择
    ├── 数量输入
    ├── 高级设置
    └── 执行交易
```

## 技术实现

### 状态管理
- **Zustand Store** - `useTokenFactoryStore` 管理合约状态
- **React State** - 组件本地状态管理
- **Web3 集成** - 通过 `useWeb3Clients` 获取区块链数据

### 数据流
```
部署文件 → TokenFactory Store → 页面状态 → UI 展示
    ↓
用户交互 → 交易界面 → 合约调用 → 区块链交易
```

### 关键组件
- `TradingInterface` - 交易界面组件
- `useTokenFactoryWithClients` - 带 Web3 客户端的 Store Hook
- `formatUtils` - 数字格式化工具

## 使用示例

### 基本使用
```tsx
import { useTokenFactoryWithClients } from '@/lib/hooks/useTokenFactoryWithClients';

function MyComponent() {
  const {
    tokens,
    isLoading,
    error,
    fetchAllTokens
  } = useTokenFactoryWithClients();

  useEffect(() => {
    fetchAllTokens();
  }, [fetchAllTokens]);

  return (
    <div>
      {/* 渲染代币列表 */}
    </div>
  );
}
```

### 交易功能
```tsx
const handleTrade = async (token: TokenData, type: 'buy' | 'sell', amount: number) => {
  try {
    // 调用交易合约
    console.log(`${type} ${amount} ${token.symbol}`);
    alert('交易成功！');
  } catch (error) {
    console.error('交易失败:', error);
    alert('交易失败，请重试');
  }
};
```

## 数据格式

### TokenData 接口
```typescript
interface TokenData {
  symbol: string;        // 代币符号 (AAPL, TSLA)
  name: string;          // 代币名称
  address: string;       // 合约地址
  price: number;         // 当前价格
  change24h: number;     // 24小时涨跌幅 (%)
  volume24h: number;     // 24小时成交量
  marketCap: number;     // 市值
  totalSupply: number;   // 总供应量
  userBalance: number;   // 用户持仓数量
  userValue: number;     // 用户持仓价值
}
```

## 样式和主题

### 设计原则
- **暗色主题** - 符合 DeFi 应用设计趋势
- **渐变效果** - 使用蓝紫色渐变增强视觉效果
- **响应式设计** - 适配不同屏幕尺寸
- **动画效果** - 平滑的交互动画

### 颜色方案
- **主色调** - 蓝色到紫色渐变
- **涨跌颜色** - 绿色（涨） / 红色（跌）
- **背景色** - 深黑色背景
- **文字颜色** - 白色主要文字，灰色次要文字

## 性能优化

### 数据缓存
- 使用 Zustand 持久化存储合约地址
- 缓存代币数据减少重复请求
- 防抖搜索输入优化性能

### 用户体验
- 加载状态显示
- 错误处理和用户提示
- 平滑的页面过渡动画

## 扩展功能

### 即将添加
- [ ] 实时价格推送
- [ ] 价格图表显示
- [ ] 交易历史记录
- [ ] 流动性池信息
- [ ] 收益计算器

### 技术优化
- [ ] WebSocket 实时数据
- [ ] 数据预加载
- [ ] 离线缓存支持
- [ ] 移动端优化

## 部署和配置

### 环境要求
- Node.js 18+
- Next.js 15.5.2
- TypeScript
- Tailwind CSS

### 配置说明
- 合约地址通过 `deployments-uups-sepolia.json` 配置
- 网络配置支持多链切换
- 钱包集成使用 `yc-sdk-ui`

## 故障排除

### 常见问题
1. **合约未初始化** - 检查部署文件配置
2. **钱包未连接** - 确保钱包已正确连接
3. **数据加载失败** - 检查网络连接和合约状态
4. **交易失败** - 检查余额和 Gas 费

### 调试方法
- 使用浏览器开发者工具查看控制台日志
- 检查网络请求状态
- 验证合约调用参数

## 更新日志

### v1.0.0 (2024-01-XX)
- ✅ 基础页面结构和样式
- ✅ 代币列表显示和筛选
- ✅ 交易界面功能
- ✅ 响应式设计
- ✅ 多语言支持 (中文)

---

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目。在提交代码前，请确保：

1. 代码符合项目规范
2. 添加必要的测试
3. 更新相关文档
4. 通过代码审查