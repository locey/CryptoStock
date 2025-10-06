# 股票代币卖出功能设计文档

## 概述

本文档详细描述了CryptoStock平台股票代币卖出功能的完整实现，包括前端流程设计、技术架构、用户体验和错误处理机制。卖出功能与买入功能形成完整的交易闭环，为用户提供完整的代币交易体验。

## 功能架构

### 技术栈
- **React 19.1.0** - 用户界面框架
- **Viem 2.37.9** - 以太坊交互库
- **Ethers.js 6.15.0** - 兼容性支持
- **Wagmi 2.17.5** - Web3状态管理
- **RainbowKit 2.2.8** - 钱包连接
- **TypeScript** - 类型安全

### 核心组件
```
SellModal (用户界面)
    ↓
useTokenTrading Hook (业务逻辑)
    ↓
PublicClient/Web3Client (链上交互)
    ↓
StockToken Contract (具体股票代币合约)
    ↓
OracleAggregator (价格预言机)
    ↓
USDT Token (支付代币)
```

### 重要架构说明

**StockToken合约地址设计**：
每个股票都有独立的代理合约地址，通过TokenFactory创建：

```typescript
// 从部署配置获取具体股票的代币地址
export function getStockTokenAddress(symbol: string): string {
  const address = STOCK_TOKENS[symbol.toUpperCase()];
  if (!address) {
    throw new Error(`未找到股票符号 ${symbol} 对应的代币地址`);
  }
  return address;
}

// 部署配置示例
{
  "stockTokens": {
    "AAPL": "0xc9e8f23Ea0eEF733244cFE6d697724CE9a7A9510",  // AAPL代币合约地址
    "TSLA": "0x58f4a55c1aD444AA104EB2751F416627131E9B15",  // TSLA代币合约地址
    "GOOGL": "0xb034A8DabbC4e9EC602C7B5Ad2d8F16F7e2C32bA", // GOOGL代币合约地址
  }
}
```

**正确的合约调用方式**：
```typescript
// 卖出AAPL - 调用AAPL代币合约
const hash = await client.writeContract({
  address: getStockTokenAddress("AAPL"),  // AAPL具体合约地址
  abi: STOCK_TOKEN_ABI,
  functionName: "sell",
  args: [sellAmountWei, minUsdtAmount, updateData],
  value: updateFee,
});
```

## 完整流程设计

### 1. 初始化阶段
**触发条件**: 用户点击卖出按钮，打开SellModal

**执行步骤**:
```typescript
useEffect(() => {
  if (isOpen && isConnected) {
    initializeData(); // 并行获取所有必要数据
  }
}, [isOpen, isConnected, initializeData]);

const initializeData = async () => {
  await Promise.all([
    fetchUserInfo(),        // 获取USDT余额（用于显示）
    fetchTokenBalance(),    // 获取代币余额
    fetchPriceData(),       // 获取当前价格
    fetchPythData()         // 获取价格更新数据缓存
  ]);
};
```

**数据获取内容**:
- 用户股票代币余额
- 合约USDT余额（流动性检查）
- 当前股票价格数据
- 预言机价格更新数据缓存

**关键代码实现**:

```typescript
// 1. 用户股票代币余额查询
const fetchTokenBalance = useCallback(async () => {
  if (!isConnected || !address || !publicClient) return;

  try {
    console.log(`🔍 获取 ${token.symbol} 代币余额...`);

    // 获取用户股票代币余额
    const userTokenBalance = await publicClient.readContract({
      address: stockTokenAddress,  // 具体的股票代币合约地址
      abi: STOCK_TOKEN_ABI,
      functionName: "balanceOf",
      args: [address],
    }) as bigint;

    // 获取合约中的代币总余额（流动性指标）
    const contractTokenBalance = await publicClient.readContract({
      address: stockTokenAddress,
      abi: STOCK_TOKEN_ABI,
      functionName: "balanceOf",
      args: [stockTokenAddress],
    }) as bigint;

    // 更新状态
    setTradingState(prev => ({
      ...prev,
      tokenBalance: BigInt(userTokenBalance),
      contractTokenBalance: BigInt(contractTokenBalance)
    }));

  } catch (error) {
    console.error(`❌ 获取 ${token.symbol} 代币余额失败:`, error);
  }
}, [isConnected, address, publicClient, stockTokenAddress, token.symbol]);
```

```typescript
// 2. 合约USDT余额流动性检查
const fetchContractUSDTBalance = useCallback(async () => {
  if (!publicClient) return;

  try {
    console.log(`🔍 检查 ${token.symbol} 合约的 USDT 余额...`);

    // 获取股票代币合约中的USDT余额
    const contractUsdtBalance = await publicClient.readContract({
      address: usdtAddress,        // USDT代币合约地址
      abi: USDT_TOKEN_ABI,
      functionName: "balanceOf",
      args: [stockTokenAddress],   // 查询股票代币合约的USDT余额
    }) as bigint;

    // 计算可卖出的最大代币数量
    const maxSellableTokens = contractUsdtBalance > 0n
      ? (contractUsdtBalance * BigInt(1e18)) / BigInt(parseFloat(tradingState.priceData?.price || "100") * 1e6)
      : 0n;

    // 流动性警告
    if (contractUsdtBalance < parseUnits("1000", 6)) { // 少于1000 USDT
      console.warn(`⚠️ ${token.symbol} 合约 USDT 流动性不足`);
    }

    setTradingState(prev => ({
      ...prev,
      contractUsdtBalance: BigInt(contractUsdtBalance),
      maxSellableTokens: BigInt(maxSellableTokens)
    }));

  } catch (error) {
    console.error(`❌ 检查 ${token.symbol} 合约 USDT 余额失败:`, error);
  }
}, [publicClient, usdtAddress, stockTokenAddress, token.symbol, tradingState.priceData]);
```

```typescript
// 3. 当前股票价格数据获取（多层策略）
const fetchPriceData = useCallback(async () => {
  try {
    // 策略1: 从Hermes API获取最新价格
    const priceInfo = await getPriceInfo(token.symbol);
    if (priceInfo) {
      const formattedPriceData = {
        price: priceInfo.price,
        conf: priceInfo.conf || '0.01',
        expo: priceInfo.expo || -2,
        publish_time: priceInfo.publish_time || Date.now(),
        formatted: {
          price: parseFloat(priceInfo.price).toFixed(2),
          conf: priceInfo.conf || '0.01',
          confidence: '1.00%'
        },
        source: 'api'
      };

      setTradingState(prev => ({ ...prev, priceData: formattedPriceData }));
      return formattedPriceData;
    }

    // 策略2: 从合约获取缓存价格
    const contractPrice = await publicClient.readContract({
      address: stockTokenAddress,
      abi: STOCK_TOKEN_ABI,
      functionName: "getStockPrice",
    }) as bigint;

    if (contractPrice > 0n) {
      const formattedPrice = parseFloat(formatEther(contractPrice));
      const contractPriceData = {
        price: formattedPrice.toString(),
        source: 'contract'
      };

      setTradingState(prev => ({ ...prev, priceData: contractPriceData }));
      return contractPriceData;
    }

    // 策略3: 使用默认价格作为fallback
    const defaultPriceData = {
      price: '100.00',
      source: 'default'
    };

    setTradingState(prev => ({ ...prev, priceData: defaultPriceData }));
    return defaultPriceData;

  } catch (error) {
    console.error(`❌ 获取 ${token.symbol} 价格失败:`, error);
  }
}, [token.symbol, publicClient, stockTokenAddress]);
```

```typescript
// 4. 预言机价格更新数据缓存
const fetchPythDataWithCache = useCallback(async () => {
  const { getCachedData, setPythData, setLoading, setError, isDataExpired } = usePythStore.getState();
  const symbolUpper = token.symbol.toUpperCase();

  try {
    // 检查缓存是否存在且未过期
    const cachedData = getCachedData(symbolUpper);
    if (cachedData && !isDataExpired(symbolUpper)) {
      console.log(`✅ 使用 ${token.symbol} 的缓存数据`);

      setTradingState(prev => ({
        ...prev,
        updateData: cachedData.updateData,
        updateFee: cachedData.updateFee
      }));

      return cachedData;
    }

    console.log(`⚠️ ${token.symbol} 缓存过期或不存在，重新获取...`);
    setLoading(symbolUpper, true);

    // 从Pyth API获取新数据
    const updateData = await fetchUpdateData([token.symbol]);

    if (updateData && updateData.length > 0) {
      // 计算更新费用
      const updateFee = await publicClient.readContract({
        address: oracleAddress,
        abi: ORACLE_AGGREGATOR_ABI,
        functionName: "getUpdateFee",
        args: [updateData]
      }) as bigint;

      // 缓存数据
      setPythData(symbolUpper, updateData, updateFee, 'api-fetch');

      // 更新组件状态
      setTradingState(prev => ({
        ...prev,
        updateData: updateData as `0x${string}`[],
        updateFee: updateFee
      }));

      return { updateData, updateFee };
    } else {
      throw new Error("未获取到有效的价格更新数据");
    }

  } catch (error) {
    console.error("❌ 获取 Pyth 数据失败:", error);
    setError(symbolUpper, error instanceof Error ? error.message : "未知错误");
    throw error;
  } finally {
    setLoading(symbolUpper, false);
  }
}, [token.symbol, publicClient, oracleAddress]);
```

**实时数据更新机制**:
```typescript
// 自动定时更新余额
useEffect(() => {
  if (isConnected && address) {
    // 初始获取
    initializeData();

    // 设置定时更新
    const balanceInterval = setInterval(() => {
      fetchUserInfo();
      fetchTokenBalance();
      fetchContractUSDTBalance();
    }, 10000); // 每10秒更新余额

    const priceInterval = setInterval(fetchPriceData, 30000); // 每30秒更新价格

    return () => {
      clearInterval(balanceInterval);
      clearInterval(priceInterval);
    };
  }
}, [isConnected, address, initializeData]);
```

### 2. 用户交互阶段
**输入处理**:
```typescript
// 卖出数量输入
<input
  type="number"
  value={tradingState.sellAmount}
  onChange={(e) => updateState({ sellAmount: e.target.value })}
  placeholder="输入数量"
  step="0.01"
  min="0"
  max={formatEther(tradingState.tokenBalance)}
/>

// 预设快速选择
{PRESET_SELL_AMOUNTS.map((amount) => (
  <button
    onClick={() => updateState({ sellAmount: amount.toString() })}
  >
    {amount}
  </button>
))}
```

**实时计算**:
```typescript
useEffect(() => {
  if (tradingState.sellAmount && tradingState.priceData) {
    calculateSellEstimate(); // 实时计算预估USDT
  }
}, [tradingState.sellAmount, tradingState.priceData, tradingState.slippage]);
```

### 3. 预估计算阶段
**合约预估调用**:
```typescript
const calculateSellEstimate = async () => {
  const sellAmountWei = parseUnits(tradingState.sellAmount, 18);

  // 调用合约预估函数
  const result = await publicClient.readContract({
    address: token.address,
    abi: STOCK_TOKEN_ABI,
    functionName: "getSellEstimate",
    args: [sellAmountWei]
  }) as [bigint, bigint];

  const [estimatedUsdt, estimatedFee] = result;

  // 应用滑点保护
  const slippagePercentage = BigInt(100 - tradingState.slippage);
  const minUsdtAmount = (estimatedUsdt * slippagePercentage) / 100n;

  return { estimatedUsdt, minUsdtAmount };
};
```

**价格计算逻辑**:
```
代币数量 × 当前价格 = USDT金额（含手续费）
USDT金额 × (100% - 滑点%) = 最小USDT数量
```

### 4. 前置验证阶段
**多层验证机制**:

```typescript
// 1. 钱包连接验证
if (!isConnected || !address) {
  return { success: false, error: "钱包未连接" };
}

// 2. 卖出数量验证
if (!tradingState.sellAmount || parseFloat(tradingState.sellAmount) <= 0) {
  return { success: false, error: "卖出数量必须大于0" };
}

// 3. 代币余额验证
const sellAmountWei = parseUnits(tradingState.sellAmount, 18);
if (tradingState.tokenBalance < sellAmountWei) {
  return {
    success: false,
    error: `代币余额不足! 需要: ${formatEther(sellAmountWei)}, 可用: ${formatEther(tradingState.tokenBalance)}`
  };
}

// 4. 价格数据验证
if (!tradingState.priceData) {
  await fetchPriceData();
}

// 5. ETH余额验证（Gas费用）
const ethBalance = await publicClient?.getBalance({ address });
if (ethBalance < updateFee) {
  throw new Error(`ETH余额不足! 需要: ${formatEther(updateFee)} ETH`);
}
```

### 5. 合约调用阶段
**价格数据准备**:
```typescript
// 获取最新价格更新数据
const { updateData, updateFee } = await fetchUpdateDataAndFee([token.symbol]);

// 计算最终参数
const { minUsdtAmount } = await calculateSellEstimate();
```

**合约调用执行**:
```typescript
const hash = await client.writeContract({
  address: token.address,           // StockToken合约地址
  abi: STOCK_TOKEN_ABI,            // StockToken ABI
  functionName: "sell",            // 调用sell函数
  args: [
    sellAmountWei,                 // 参数1: 代币数量
    minUsdtAmount,                 // 参数2: 最小USDT数量
    updateData || []               // 参数3: 价格更新数据
  ],
  account: address,
  chain,
  value: updateFee,               // 预言机更新费用
});
```

**智能合约逻辑**:
```solidity
function sell(uint256 tokenAmount, uint256 minUsdtAmount, bytes[] calldata updateData)
    external payable nonReentrant whenNotPaused {
    // 1. 参数验证
    require(tokenAmount > 0, "Invalid token amount");
    require(balanceOf(msg.sender) >= tokenAmount, "Insufficient token balance");

    // 2. 价格更新
    (uint256 stockPrice, , , ) = oracleAggregator.updateAndGetPrice{value: msg.value}(stockSymbol, updateData);
    require(stockPrice > 0, "Invalid stock price");

    // 3. USDT数量计算
    uint256 usdtAmountBeforeFee = (tokenAmount * stockPrice) / 1e30;
    uint256 feeAmount = (usdtAmountBeforeFee * tradeFeeRate) / 10000;
    uint256 usdtAmount = usdtAmountBeforeFee - feeAmount;

    // 4. 滑点保护
    require(usdtAmount >= minUsdtAmount, "Slippage too high");

    // 5. 余额检查和转账
    require(usdtToken.balanceOf(address(this)) >= usdtAmount + feeAmount, "Insufficient USDT in contract");
    _transfer(msg.sender, address(this), tokenAmount);
    require(usdtToken.transfer(msg.sender, usdtAmount), "USDT transfer failed");
    require(usdtToken.transfer(feeReceiver, feeAmount), "Fee transfer failed");

    // 6. 事件发出
    emit TokenSold(msg.sender, stockSymbol, tokenAmount, usdtAmount, stockPrice);
}
```

### 6. 交易确认阶段
**等待交易确认**:
```typescript
const receipt = await publicClient?.waitForTransactionReceipt({
  hash,
});

if (receipt?.status === 'success') {
  updateState({ transactionStatus: 'success' });

  // 刷新用户余额
  await fetchTokenBalance();

  return { success: true, hash };
} else {
  throw new Error('交易失败');
}
```

### 7. 结果反馈阶段
**成功反馈**:
```typescript
if (result.success) {
  toast({
    title: "卖出成功",
    description: `${token.symbol} 卖出成功！获得 ${formatUnits(tradingState.estimatedUsdt, 6)} USDT`,
  });
  setTimeout(() => onClose(), 2000);
}
```

**错误处理**:
```typescript
if (!result.success) {
  toast({
    title: "卖出失败",
    description: result.error || "卖出失败，请重试",
    variant: "destructive",
  });
}
```

## 核心设计思路

### 1. 用户体验优化

**渐进式披露**
- 只在需要时获取价格数据
- 实时计算并显示预估USDT数量
- 智能缓存价格更新数据

**视觉反馈**
- 红色主题突出卖出操作
- 实时余额和预估数量显示
- 清晰的交易状态指示

**操作便捷性**
- 预设卖出数量快速选择
- 一键最大数量卖出
- 滑点保护智能设置

### 2. 技术架构设计

**状态管理**
```typescript
interface TradingState {
  // 买入相关状态
  buyAmount: string;              // 买入金额
  usdtBalance: bigint;            // USDT余额
  allowance: bigint;              // USDT授权额度
  needsApproval: boolean;         // 是否需要授权

  // 卖出相关状态
  sellAmount: string;             // 卖出数量
  tokenBalance: bigint;           // 用户股票代币余额
  contractTokenBalance: bigint;  // 合约代币总余额（流动性指标）
  contractUsdtBalance: bigint;    // 合约USDT余额（流动性检查）
  maxSellableTokens: bigint;      // 最大可卖出代币数量
  estimatedUsdt: bigint;          // 预估USDT数量
  minUsdtAmount: bigint;          // 最小USDT数量（滑点保护）

  // 共用状态
  slippage: number;               // 滑点容忍度
  customSlippage: string;         // 自定义滑点
  transactionStatus: 'idle' | 'approving' | 'buying' | 'selling' | 'success' | 'error';
  transactionHash: `0x${string}` | null;  // 交易哈希
  priceData: PriceData | null;    // 价格数据
  updateData: `0x${string}`[];   // 价格更新数据
  updateFee: bigint;              // 预言机更新费用
}

interface PriceData {
  price: string;                  // 价格
  conf: string;                   // 置信度
  expo: number;                   // 指数
  publish_time: number;           // 发布时间
  formatted: {
    price: string;                // 格式化价格
    conf: string;                 // 格式化置信度
    confidence: string;           // 置信度百分比
  };
  source?: string;                // 数据来源
}
```

**Hook封装**
```typescript
// useTokenTrading Hook 完整实现
export const useTokenTrading = (
  token: TokenInfo,
  usdtAddress: Address,
  oracleAddress: Address,
  stockTokenAddress: Address  // 具体的股票代币合约地址
) => {
  // 状态管理
  const [tradingState, setTradingState] = useState<TradingState>({...});

  // 核心功能函数
  const fetchTokenBalance = useCallback(async () => {
    // 获取用户股票代币余额和合约余额
  }, [isConnected, address, publicClient, stockTokenAddress]);

  const fetchContractUSDTBalance = useCallback(async () => {
    // 获取合约USDT余额和计算最大可卖出数量
  }, [publicClient, usdtAddress, stockTokenAddress]);

  const fetchPriceData = useCallback(async () => {
    // 多层策略获取价格数据
  }, [token.symbol, publicClient, stockTokenAddress]);

  const fetchPythDataWithCache = useCallback(async () => {
    // 获取预言机价格更新数据（带缓存）
  }, [token.symbol, publicClient, oracleAddress]);

  const initializeData = useCallback(async () => {
    // 并行获取所有必要数据
    await Promise.all([
      fetchUserInfo(),           // 获取USDT余额和授权
      fetchTokenBalance(),       // 获取代币余额
      fetchContractUSDTBalance(), // 获取合约USDT余额
      fetchPriceData(),          // 获取价格数据
      fetchPythDataWithCache()   // 获取价格更新数据缓存
    ]);
  }, [fetchUserInfo, fetchTokenBalance, fetchContractUSDTBalance, fetchPriceData, fetchPythDataWithCache]);

  const checkLiquidity = useCallback((requiredUsdtAmount: bigint) => {
    // 流动性检查函数
    const { contractUsdtBalance } = tradingState;

    if (contractUsdtBalance < requiredUsdtAmount) {
      return {
        sufficient: false,
        shortage: requiredUsdtBalance - contractUsdtBalance,
        message: `合约USDT流动性不足，缺少 ${formatUnits(requiredUsdtBalance - contractUsdtBalance, 6)} USDT`
      };
    }

    return { sufficient: true, shortage: 0n, message: "流动性充足" };
  }, [tradingState.contractUsdtBalance]);

  // 实时数据更新
  useEffect(() => {
    if (isConnected && address) {
      initializeData();

      // 设置定时更新
      const balanceInterval = setInterval(() => {
        fetchUserInfo();
        fetchTokenBalance();
        fetchContractUSDTBalance();
      }, 10000); // 每10秒更新余额

      const priceInterval = setInterval(fetchPriceData, 30000); // 每30秒更新价格

      return () => {
        clearInterval(balanceInterval);
        clearInterval(priceInterval);
      };
    }
  }, [isConnected, address, initializeData]);

  return {
    // 状态
    tradingState,
    isConnected,
    address,

    // 数据获取方法
    initializeData,
    fetchTokenBalance,
    fetchContractUSDTBalance,
    fetchPriceData,
    fetchPythDataWithCache,

    // 实用方法
    checkLiquidity,
    updateState,
    resetState,

    // 客户端
    publicClient,
    walletClient: getWalletClient(),
    chain,
  };
};
```

**关键特性**：
- 统一管理买卖逻辑
- 可复用的价格数据获取
- 智能缓存机制
- 实时数据更新
- 流动性检查功能
- 完整的错误处理机制

**类型安全**
- 完整的TypeScript类型定义
- 合约ABI类型验证
- 参数类型转换安全

### 3. 安全性设计

**多层验证**
1. 前端参数验证
2. 余额充足性检查
3. 价格数据有效性验证
4. 合约层面验证

**滑点保护**
- 用户自定义滑点设置
- 最小USDT数量保护
- 价格波动自动检测

**错误恢复**
- 详细的错误分析
- 用户友好的错误提示
- 自动重试机制

### 4. 性能优化

**数据获取优化**
- 并行获取多个数据源
- 价格数据智能缓存
- 避免重复合约调用

**状态更新优化**
- 防抖处理用户输入
- 智能状态依赖更新
- 组件级别状态隔离

**网络优化**
- 最小化合约调用次数
- 批量操作优化
- Gas费用预估

## 与买入功能的对比

### 相同点
- 价格数据获取机制
- 滑点保护逻辑
- 错误处理框架
- 用户界面设计风格

### 不同点

| 功能点 | 买入功能 | 卖出功能 |
|--------|----------|----------|
| **操作方向** | USDT → 代币 | 代币 → USDT |
| **余额检查** | USDT余额 | 代币余额 |
| **授权需求** | 需要授权USDT | 无需额外授权 |
| **价格计算** | USDT金额/价格 = 代币数量 | 代币数量×价格 = USDT金额 |
| **界面主题** | 绿色（买入） | 红色（卖出） |
| **合约调用** | `buy(usdtAmount, minTokenAmount, updateData)` | `sell(tokenAmount, minUsdtAmount, updateData)` |
| **手续费** | 从代币中扣除 | 从USDT中扣除 |

## 错误处理机制

### 错误分类及处理

**1. 余额相关错误**
```typescript
if (error.message.includes("Insufficient token balance")) {
  return {
    error: "代币余额不足",
    userAction: "请检查您的代币余额，确保有足够的代币可以卖出"
  };
}
```

**2. 流动性相关错误**
```typescript
if (error.message.includes("Insufficient USDT in contract")) {
  return {
    error: "合约USDT余额不足",
    userAction: "合约流动性不足，请联系管理员补充流动性或稍后再试"
  };
}
```

**3. 价格相关错误**
```typescript
if (error.message.includes("Slippage too high")) {
  return {
    error: "价格滑点过大",
    userAction: "市场价格发生了较大变化，请调整滑点设置或等待价格稳定"
  };
}
```

**4. 网络相关错误**
```typescript
if (error.message.includes("insufficient funds")) {
  return {
    error: "ETH余额不足",
    userAction: "请为钱包充值足够的ETH来支付Gas费用"
  };
}
```

### 用户友好提示

**Toast通知系统**
- 成功/失败状态即时反馈
- 详细错误说明和解决建议
- 操作指引和重试选项

**状态指示器**
- 交易进度实时显示
- 加载状态动画
- 错误状态图标提示

## 测试策略

### 功能测试
- [ ] 正常卖出流程测试
- [ ] 边界值测试（最小/最大数量）
- [ ] 滑点保护测试
- [ ] 余额不足测试
- [ ] 网络异常测试

### 集成测试
- [ ] 合约调用集成测试
- [ ] 价格数据集成测试
- [ ] 钱包连接集成测试
- [ ] 多网络环境测试

### 用户体验测试
- [ ] 响应速度测试
- [ ] 错误提示准确性测试
- [ ] 界面交互流畅性测试
- [ ] 移动端适配测试

## 部署注意事项

### 环境配置
- 确保合约地址配置正确
- 验证价格预言机Feed ID
- 检查网络RPC端点可用性

### 监控要点
- 交易成功率监控
- 错误日志收集
- 用户行为分析
- 性能指标监控

### 安全检查
- 合约地址白名单验证
- 价格数据源可信度检查
- 用户权限验证
- 输入参数安全校验

## 未来优化方向

### 功能增强
- [ ] 批量卖出功能
- [ ] 定时卖出策略
- [ ] 价格预警设置
- [ ] 历史交易记录

### 性能优化
- [ ] 价格数据预测缓存
- [ ] 智能Gas费用优化
- [ ] 交易队列管理
- [ ] 状态同步优化

### 用户体验
- [ ] 交易进度可视化
- [ ] 更丰富的价格图表
- [ ] 个性化设置选项
- [ ] 多语言支持

---

## 总结

股票代币卖出功能的设计充分考虑了用户体验、安全性、性能和可维护性。通过与买入功能的协同设计，形成了完整的交易闭环，为用户提供了专业、安全、便捷的去中心化股票代币交易体验。

整个实现遵循了现代Web3应用的最佳实践，采用了类型安全的开发方式，实现了完善的错误处理机制，并提供了友好的用户界面。这为平台的长期发展奠定了坚实的技术基础。