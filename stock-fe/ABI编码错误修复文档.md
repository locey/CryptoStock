# ABI 编码错误修复文档

## 问题描述

在 `sellStore.ts` 文件的第518行出现 `AbiEncodingLengthMismatchError` 错误：

```
❌ 获取预估失败: AbiEncodingLengthMismatchError: ABI encoding params/values length mismatch.
Expected length (params): 2
Given length (values): 1
```

## 根本原因分析

### 1. ABI 函数签名不匹配

查看 `StockToken.json` ABI 文件中的 `getSellEstimate` 函数定义（第656-670行）：

```json
{
  "inputs": [
    {
      "internalType": "uint256",
      "name": "tokenAmount",
      "type": "uint256"
    },
    {
      "internalType": "bytes[][]",
      "name": "updateData",
      "type": "bytes[][]"
    }
  ],
  "name": "getSellEstimate",
  "outputs": [
    {
      "internalType": "uint256",
      "name": "usdtAmount",
      "type": "uint256"
    },
    {
      "internalType": "uint256",
      "name": "feeAmount",
      "type": "uint256"
    }
  ],
  "stateMutability": "payable",
  "type": "function"
}
```

**问题**: `getSellEstimate` 函数需要 **2个参数**：
1. `tokenAmount` (uint256) - 代币数量
2. `updateData` (bytes[][]) - 价格更新数据

但在原代码中（第492-496行），只传递了 **1个参数**：
```javascript
args: [tokenAmount]  // 缺少 updateData 参数
```

### 2. 调用顺序问题

原代码的调用顺序：
1. 先调用 `getSellEstimate`（需要 updateData）
2. 后调用 `fetchPriceUpdateData`（获取 updateData）

这导致了参数依赖问题。

## 修复方案

### 1. 更新函数签名

修改 `getSellEstimate` 函数的参数列表，添加 `updateData` 参数：

**修改前:**
```typescript
getSellEstimate: (publicClient: PublicClient, stockTokenAddress: Address, tokenAmount: bigint) => Promise<ContractCallResult>
```

**修改后:**
```typescript
getSellEstimate: (publicClient: PublicClient, stockTokenAddress: Address, tokenAmount: bigint, updateData: Uint8Array[]) => Promise<ContractCallResult>
```

### 2. 更新函数实现

修改函数实现，传递正确的参数：

**修改前:**
```javascript
const result = await publicClient.readContract({
  address: stockTokenAddress,
  abi: typedStockTokenABI,
  functionName: 'getSellEstimate',
  args: [tokenAmount]  // 只有1个参数
});
```

**修改后:**
```javascript
const result = await publicClient.readContract({
  address: stockTokenAddress,
  abi: typedStockTokenABI,
  functionName: 'getSellEstimate',
  args: [tokenAmount, updateData]  // 2个参数
});
```

### 3. 调整调用顺序

在 `sellToken` 函数中重新安排调用顺序：

**修改前:**
1. 获取预估结果（需要 updateData）
2. 获取价格更新数据（获取 updateData）

**修改后:**
1. 获取价格更新数据（获取 updateData）
2. 获取预估结果（使用 updateData）

### 4. 更新注释

更新函数注释以反映正确的函数签名：

**修改前:**
```javascript
/**
 * 2. 获取预估结果（使用最新价格）
 * 合约方法：getSellEstimate(uint256 tokenAmount) returns (uint256 usdtAmount, uint256 feeAmount)
 */
```

**修改后:**
```javascript
/**
 * 2. 获取预估结果（使用最新价格）
 * 合约方法：getSellEstimate(uint256 tokenAmount, bytes[][] updateData) returns (uint256 usdtAmount, uint256 feeAmount)
 */
```

## 修改的文件和位置

### 文件: `/Users/lijinhai/Desktop/my_project/CryptoStock/stock-fe/lib/stores/sellStore.ts`

1. **第169行** - 接口定义更新
2. **第486行** - 函数注释更新
3. **第488行** - 函数签名更新
4. **第496行** - 函数实现更新（添加 updateData 参数）
5. **第673-697行** - 调用顺序调整

## 验证方法

修复后，应该能够：

1. **成功调用 `getSellEstimate`** - 不再出现参数数量不匹配错误
2. **正确传递预言机数据** - 确保价格更新数据正确传递给合约
3. **获取准确的预估结果** - 基于最新价格计算预估USDT数量和手续费
4. **完成完整的卖出流程** - 从余额检查到交易执行

## 相关对比

### getBuyEstimate 函数对比

`getBuyEstimate` 函数在 ABI 中同样需要2个参数：
- `usdtAmount` (uint256)
- `updateData` (bytes[][])

这与 `getSellEstimate` 的结构是一致的，验证了修复的正确性。

### 测试文件对应

这个修复与测试文件 `/Users/lijinhai/Desktop/my_project/CryptoStock/CryptoStockContract/test/12-PriceOracle-AAPL.test.js` 中的实现保持一致，都要求在调用预估函数时提供价格更新数据。

## 总结

这次修复解决了 ABI 编码参数不匹配的根本问题：

1. **参数数量不匹配** - 从1个参数增加到2个参数
2. **函数签名更新** - 同步更新了接口和实现
3. **调用顺序优化** - 先获取数据再调用预估
4. **注释同步** - 更新了函数文档

修复后，卖出功能应该能够正常工作，不再出现 ABI 编码错误。