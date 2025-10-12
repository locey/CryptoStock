# getUpdateFee 调用错误修复文档

## 问题描述

在 `sellStore.ts` 文件的第555行出现 `ContractFunctionExecutionError` 错误：

```
❌ 获取价格更新数据失败: ContractFunctionExecutionError: The contract function "getUpdateFee" reverted.

Contract Call:
  address:   0x9F491D7e329BF6CfC2672F01dF9f856F45379034
  function:  getUpdateFee(bytes[] updateData)
  args:
```

## 根本原因分析

### 1. 错误的合约地址

**问题**: 使用了错误的合约地址调用 `getUpdateFee` 函数

- **错误地址**: `0x9F491D7e329BF6CfC2672F01dF9f856F45379034` (这是 PriceAggregator 地址)
- **正确地址**: `0xF358b741b96a615903e4e1049A1BE000B176D163` (这是 PythPriceFeed 地址)

### 2. 错误的 ABI 文件

**问题**: 使用了错误的 ABI 文件调用 `getUpdateFee` 函数

- **错误 ABI**: `OracleAggregator.json` - 这个合约没有 `getUpdateFee` 函数
- **正确 ABI**: `PythPriceFeed.json` - 这个合约有 `getUpdateFee` 函数

### 3. 地址对应关系

根据部署配置文件：

```json
// deployments-unified-oracle-sepolia.json
{
  "contracts": {
    "pythPriceFeed": {
      "address": "0xF358b741b96a615903e4e1049A1BE000B176D163",
      "type": "PythPriceFeed"
    },
    "priceAggregator": {
      "address": "0x9F491D7e329BF6CfC2672F01dF9f856F45379034",
      "type": "PriceAggregator"
    }
  }
}
```

### 4. ABI 函数定义验证

**PythPriceFeed ABI 中的 getUpdateFee 函数**：
```json
{
  "inputs": [
    {
      "internalType": "bytes[]",
      "name": "updateData",
      "type": "bytes[]"
    }
  ],
  "name": "getUpdateFee",
  "outputs": [
    {
      "internalType": "uint256",
      "name": "",
      "type": "uint256"
    }
  ],
  "stateMutability": "view",
  "type": "function"
}
```

**PriceAggregator ABI** - 没有 `getUpdateFee` 函数，只有：
- `getAggregatedPrice`
- `addOracle`
- `removeLastOracle`
- `totalWeight`
- `oracles`

## 修复方案

### 1. 添加正确的导入

```typescript
// 添加导入
import PYTH_PRICE_FEED_ABI from '@/lib/abi/PythPriceFeed.json';
import UNIFIED_ORACLE_DEPLOYMENT from '@/lib/abi/deployments-unified-oracle-sepolia.json';
```

### 2. 添加正确的地址常量

```typescript
// 添加 PythPriceFeed 地址
const pythPriceFeedAddress = ensureAddress(UNIFIED_ORACLE_DEPLOYMENT.contracts.pythPriceFeed.address);
```

### 3. 添加正确的 ABI 类型

```typescript
// 添加 PythPriceFeed ABI
const typedPythPriceFeedABI = PYTH_PRICE_FEED_ABI as Abi;
```

### 4. 修复 getUpdateFee 调用

**修改前:**
```typescript
const updateFee = await publicClient.readContract({
  address: OracleAggregatorAddress,        // ❌ 错误地址
  abi: ORACLE_AGGREGATOR_ABI,             // ❌ 错误ABI
  functionName: "getUpdateFee",
  args: [updateData]
}) as bigint;
```

**修改后:**
```typescript
const updateFee = await publicClient.readContract({
  address: pythPriceFeedAddress,          // ✅ 正确地址
  abi: typedPythPriceFeedABI,            // ✅ 正确ABI
  functionName: "getUpdateFee",
  args: [updateData]
}) as bigint;
```

## 修改的文件和位置

### 文件: `/Users/lijinhai/Desktop/my_project/CryptoStock/stock-fe/lib/stores/sellStore.ts`

1. **第8行** - 添加 PYTH_PRICE_FEED_ABI 导入
2. **第9行** - 添加 UNIFIED_ORACLE_DEPLOYMENT 导入
3. **第48行** - 添加 pythPriceFeedAddress 地址常量
4. **第52行** - 添加 typedPythPriceFeedABI 类型
5. **第545行** - 修复 getUpdateFee 调用地址
6. **第546行** - 修复 getUpdateFee 调用 ABI

## 验证方法

修复后，应该能够：

1. **成功调用 getUpdateFee** - 不再出现合约函数回滚错误
2. **获取正确的预言机费用** - 从 PythPriceFeed 合约获取费用
3. **继续完整的卖出流程** - 成功获取价格更新数据和费用
4. **完成卖出交易** - 使用正确的预言机数据执行交易

## 相关地址对照

| 合约名称 | 地址 | ABI文件 | 主要功能 |
|---------|------|---------|---------|
| PythPriceFeed | 0xF358b741b96a615903e4e1049A1BE000B176D163 | PythPriceFeed.json | Pyth价格更新、getUpdateFee |
| PriceAggregator | 0x9F491D7e329BF6CfC2672F01dF9f856F45379034 | PriceAggregator.json | 聚合价格、getAggregatedPrice |
| OracleAggregator | 0x9F491D7e329BF6CfC2672F01dF9f856F45379034 | OracleAggregator.json | 价格Feed管理 |

## 技术细节

### 合约架构说明

1. **PythPriceFeed**:
   - 直接与 Pyth 网络交互
   - 提供 `getUpdateFee` 函数计算更新费用
   - 提供 `getPrice` 函数获取价格

2. **PriceAggregator**:
   - 聚合多个预言机的价格
   - 提供 `getAggregatedPrice` 函数
   - 不直接提供 `getUpdateFee` 函数

3. **OracleAggregator**:
   - 管理价格Feed配置
   - 提供Feed ID管理功能
   - 不直接处理价格更新费用

## 总结

这次修复解决了合约调用地址和ABI不匹配的根本问题：

1. **地址修正** - 从 PriceAggregator 地址改为 PythPriceFeed 地址
2. **ABI修正** - 从 OracleAggregator ABI 改为 PythPriceFeed ABI
3. **函数存在性验证** - 确认目标合约确实有 `getUpdateFee` 函数
4. **配置统一** - 使用统一的预言机部署配置文件

修复后，卖出功能应该能够正确获取预言机更新费用，继续执行完整的卖出流程。