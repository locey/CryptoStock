# Uniswap V3 API 参考文档

## 概述

本文档提供 Uniswap V3 适配器的详细 API 接口说明，包括函数签名、参数说明、返回值和代码示例。

## 📚 目录

- [合约接口](#合约接口)
- [操作类型](#操作类型)
- [数据结构](#数据结构)
- [事件定义](#事件定义)
- [错误处理](#错误处理)
- [代码示例](#代码示例)

## 🔗 合约接口

### 主要合约地址

| 网络 | 合约名称 | 地址 |
|------|----------|------|
| Sepolia | UniswapV3Adapter | `0x0Da05F4753534669dCE540C1Bfc348f6728Bedb3` |
| Sepolia | DefiAggregator | `0xD93D27d031FdF461288c904688Dd78D6902eA315` |
| Sepolia | MockPositionManager | `0x8B5E5C5aA9FF2a3b17a5A9e5D6E30071Ba6BE74C` |

### ABI 接口

完整 ABI 文件位于: `/lib/abi/UniswapV3Adapter.json`

## 🎯 操作类型

### 支持的操作

| 操作类型 | 数值 | 描述 | 参数结构 |
|---------|------|------|----------|
| ADD_LIQUIDITY | 2 | 添加流动性 | [AddLiquidityParams](#addliquidity-params) |
| REMOVE_LIQUIDITY | 3 | 移除流动性 | [RemoveLiquidityParams](#removeliquidity-params) |
| COLLECT_FEES | 18 | 收取手续费 | [CollectFeesParams](#collectfees-params) |

### 通过 DefiAggregator 调用

```solidity
function executeOperation(
    string memory adapterName,    // "uniswapv3"
    uint8 operationType,          // 操作类型数值
    OperationParams calldata params
) external returns (OperationResult memory result);
```

## 📊 数据结构

### OperationParams

```solidity
struct OperationParams {
    address[] tokens;     // 代币地址数组
    uint256[] amounts;    // 数量数组
    address recipient;    // 接收者地址
    uint256 deadline;     // 截止时间戳
    uint256 tokenId;      // NFT tokenId
    bytes extraData;      // 额外数据
}
```

### OperationResult

```solidity
struct OperationResult {
    bool success;              // 操作是否成功
    uint256[] outputAmounts;   // 输出数量数组
    bytes returnData;          // 返回数据
    string message;            // 操作消息
}
```

## 🔧 参数结构详解

### AddLiquidityParams

**用途**: 添加流动性到 Uniswap V3 池

**参数结构**:
```javascript
{
    tokens: [
        "0x...Token0Address",  // USDT 或 WETH 地址
        "0x...Token1Address"   // USDT 或 WETH 地址
    ],
    amounts: [
        "10000000000",         // Token0 数量 (USDT: 6位小数, WETH: 18位小数)
        "10000000000000000000", // Token1 数量
        "9900000000",          // Token0 最小数量 (滑点保护)
        "9900000000000000000"  // Token1 最小数量 (滑点保护)
    ],
    recipient: "0x...UserAddress",
    deadline: 1734567890,
    tokenId: 0,               // 新建位置设为 0
    extraData: "0x..."        // 可选价格区间参数
}
```

**extraData 格式** (可选):
```javascript
// 自定义价格区间
const tickLower = -60000;
const tickUpper = 60000;
const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
    ['int24', 'int24'],
    [tickLower, tickUpper]
);

// 使用默认价格区间
const extraData = "0x";
```

**返回结果**:
```javascript
{
    success: true,
    outputAmounts: ["12345"],  // 新创建的 NFT tokenId
    returnData: "0x0000000000000000000000000000000000000000000000000000000000003039",
    message: "Add liquidity successful"
}
```

### RemoveLiquidityParams

**用途**: 从 Uniswap V3 池移除流动性

**参数结构**:
```javascript
{
    tokens: [
        "0x...Token0Address"   // 占位符地址，实际不使用
    ],
    amounts: [
        "9900000000",          // Token0 最小接收数量
        "9900000000000000000"  // Token1 最小接收数量
    ],
    recipient: "0x...UserAddress",
    deadline: 1734567890,
    tokenId: 12345,           // 要移除的 NFT tokenId
    extraData: "0x"
}
```

**前置条件**:
- 用户必须拥有指定的 NFT (`tokenId`)
- 用户必须授权适配器操作该 NFT
- NFT 必须有流动性 (`liquidity > 0`)

**返回结果**:
```javascript
{
    success: true,
    outputAmounts: [
        "9950000000",          // 实际收到的 Token0 数量
        "9950000000000000000"  // 实际收到的 Token1 数量
    ],
    returnData: "0x",
    message: "Remove liquidity successful"
}
```

### CollectFeesParams

**用途**: 收取累积的交易手续费

**参数结构**:
```javascript
{
    tokens: [
        "0x...Token0Address"   // 占位符地址
    ],
    amounts: [],               // 空数组
    recipient: "0x...UserAddress",
    deadline: 1734567890,
    tokenId: 12345,           // NFT tokenId
    extraData: "0x"
}
```

**前置条件**:
- 用户必须拥有指定的 NFT (`tokenId`)
- 用户必须授权适配器操作该 NFT
- NFT 必须有累积的手续费

**返回结果**:
```javascript
{
    success: true,
    outputAmounts: [
        "1000000",             // 收取的 Token0 手续费
        "500000000000000000"   // 收取的 Token1 手续费
    ],
    returnData: "0x",
    message: "Collect fees successful"
}
```

## 📢 事件定义

### OperationExecuted

**触发时机**: 每次操作执行后

```solidity
event OperationExecuted(
    address indexed user,           // 操作用户地址
    OperationType operationType,    // 操作类型
    address[] tokens,               // 涉及的代币地址
    uint256[] amounts,             // 操作数量
    bytes returnData               // 返回数据
);
```

### FeesCollected

**触发时机**: 收取手续费时

```solidity
event FeesCollected(
    address indexed user,           // 用户地址
    uint256 indexed tokenId,        // NFT tokenId
    uint256 amount0,               // Token0 手续费数量
    uint256 amount1                // Token1 手续费数量
);
```

## ❌ 错误处理

### 常见错误类型

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| "Invalid position manager address" | 初始化参数错误 | 检查部署配置 |
| "Unsupported token pair" | 不支持的代币对 | 只支持 USDT/WETH |
| "User does not own this position" | NFT 所有权错误 | 检查 NFT tokenId |
| "Invalid tokenId" | NFT ID 无效 | 使用正确的 tokenId |
| "Recipient address must be specified" | 接收者地址为空 | 设置有效地址 |
| "Amount array should contain [token0Amount, token1Amount, token0Min, token1Min]" | 数组长度错误 | 检查 amounts 数组 |

### Gas 估算失败

```javascript
try {
    const gasEstimate = await defiAggregator.executeOperation.estimateGas(
        "uniswapv3",
        operationType,
        params
    );
    console.log("Gas estimate:", gasEstimate.toString());
} catch (error) {
    console.error("Gas estimation failed:", error.message);
    // 分析具体错误原因
}
```

## 💻 代码示例

### 1. 添加流动性

```javascript
import { ethers } from 'ethers';

async function addLiquidity(
    defiAggregator,
    usdtAddress,
    wethAddress,
    userAddress,
    usdtAmount,
    wethAmount
) {
    // 1. 设置代币授权
    const uniswapAdapterAddress = "0x0Da05F4753534669dCE540C1Bfc348f6728Bedb3";

    const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, signer);
    const wethContract = new ethers.Contract(wethAddress, ERC20_ABI, signer);

    // 授权 USDT
    await usdtContract.approve(uniswapAdapterAddress, usdtAmount);
    // 授权 WETH
    await wethContract.approve(uniswapAdapterAddress, wethAmount);

    // 2. 构造操作参数
    const params = {
        tokens: [usdtAddress, wethAddress],
        amounts: [
            usdtAmount,           // USDT 数量
            wethAmount,           // WETH 数量
            usdtAmount * 99n / 100n,  // USDT 最小数量 (1% 滑点)
            wethAmount * 99n / 100n    // WETH 最小数量 (1% 滑点)
        ],
        recipient: userAddress,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
        tokenId: 0,
        extraData: "0x"  // 使用默认价格区间
    };

    // 3. 执行操作
    const tx = await defiAggregator.executeOperation(
        "uniswapv3",
        2, // ADD_LIQUIDITY
        params
    );

    // 4. 等待交易确认
    const receipt = await tx.wait();

    // 5. 从事件中解析 tokenId
    for (const log of receipt.logs) {
        try {
            const parsedLog = uniswapAdapter.interface.parseLog(log);
            if (parsedLog && parsedLog.name === 'OperationExecuted') {
                const returnData = parsedLog.args.returnData;
                const tokenId = ethers.AbiCoder.defaultAbiCoder().decode(
                    ['uint256'],
                    returnData
                )[0];
                console.log("NFT Token ID:", tokenId.toString());
                return tokenId;
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error("Failed to parse tokenId from events");
}
```

### 2. 移除流动性

```javascript
async function removeLiquidity(
    defiAggregator,
    tokenId,
    userAddress
) {
    // 1. 授权 NFT 操作
    const nftManagerAddress = "0x8B5E5C5aA9FF2a3b17a5A9e5D6E30071Ba6BE74C";
    const nftManager = new ethers.Contract(nftManagerAddress, NFT_MANAGER_ABI, signer);

    await nftManager.approve(
        "0x0Da05F4753534669dCE540C1Bfc348f6728Bedb3",
        tokenId
    );

    // 2. 构造操作参数
    const params = {
        tokens: ["0x...Placeholder"], // 占位符地址
        amounts: [
            0, // Token0 最小接收数量 (设置为0接收所有)
            0  // Token1 最小接收数量 (设置为0接收所有)
        ],
        recipient: userAddress,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: tokenId,
        extraData: "0x"
    };

    // 3. 执行操作
    const tx = await defiAggregator.executeOperation(
        "uniswapv3",
        3, // REMOVE_LIQUIDITY
        params
    );

    // 4. 等待交易确认
    const receipt = await tx.wait();

    // 5. 解析返回的代币数量
    for (const log of receipt.logs) {
        try {
            const parsedLog = uniswapAdapter.interface.parseLog(log);
            if (parsedLog && parsedLog.name === 'OperationExecuted') {
                return parsedLog.args.amounts; // [amount0, amount1]
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error("Failed to parse operation result");
}
```

### 3. 收取手续费

```javascript
async function collectFees(
    defiAggregator,
    tokenId,
    userAddress
) {
    // 1. 检查 NFT 授权状态
    const nftManagerAddress = "0x8B5E5C5aA9FF2a3b17a5A9e5D6E30071Ba6BE74C";
    const nftManager = new ethers.Contract(nftManagerAddress, NFT_MANAGER_ABI, signer);

    const approvedAddress = await nftManager.getApproved(tokenId);
    const adapterAddress = "0x0Da05F4753534669dCE540C1Bfc348f6728Bedb3";

    if (approvedAddress.toLowerCase() !== adapterAddress.toLowerCase()) {
        await nftManager.approve(adapterAddress, tokenId);
    }

    // 2. 构造操作参数
    const params = {
        tokens: ["0x...Placeholder"], // 占位符地址
        amounts: [],                  // 空数组
        recipient: userAddress,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: tokenId,
        extraData: "0x"
    };

    // 3. 执行操作
    const tx = await defiAggregator.executeOperation(
        "uniswapv3",
        18, // COLLECT_FEES
        params
    );

    // 4. 等待交易确认
    const receipt = await tx.wait();

    // 5. 解析收取的手续费
    for (const log of receipt.logs) {
        try {
            const parsedLog = uniswapAdapter.interface.parseLog(log);
            if (parsedLog && parsedLog.name === 'OperationExecuted') {
                return parsedLog.args.amounts; // [feeAmount0, feeAmount1]
            }
        } catch (e) {
            continue;
        }
    }

    throw new Error("Failed to parse fee collection result");
}
```

### 4. 查询仓位信息

```javascript
async function getPosition(tokenId) {
    const nftManagerAddress = "0x8B5E5C5aA9FF2a3b17a5A9e5D6E30071Ba6BE74C";
    const nftManager = new ethers.Contract(nftManagerAddress, NFT_MANAGER_ABI, provider);

    // 获取仓位详细信息
    const position = await nftManager.positions(tokenId);

    return {
        nonce: position[0],
        operator: position[1],
        token0: position[2],
        token1: position[3],
        fee: position[4],
        tickLower: position[5],
        tickUpper: position[6],
        liquidity: position[7],
        feeGrowthInside0LastX128: position[8],
        feeGrowthInside1LastX128: position[9],
        tokensOwed0: position[10],
        tokensOwed1: position[11]
    };
}
```

### 5. 估算操作结果

```javascript
async function estimateAddLiquidity(
    defiAggregator,
    usdtAddress,
    wethAddress,
    usdtAmount,
    wethAmount
) {
    const params = {
        tokens: [usdtAddress, wethAddress],
        amounts: [usdtAmount, wethAmount, 0, 0],
        recipient: "0x...UserAddress",
        deadline: Math.floor(Date.now() / 1000) + 3600,
        tokenId: 0,
        extraData: "0x"
    };

    const result = await defiAggregator.estimateOperation(
        2, // ADD_LIQUIDITY
        params
    );

    return {
        success: result.success,
        estimatedTokenId: result.outputAmounts[0],
        message: result.message
    };
}
```

## 🔍 监控和调试

### 事件监听

```javascript
// 监听 OperationExecuted 事件
uniswapAdapter.on("OperationExecuted", (user, operationType, tokens, amounts, returnData) => {
    console.log("Operation executed:", {
        user,
        operationType: operationType.toString(),
        tokens,
        amounts: amounts.map(a => a.toString()),
        returnData
    });
});

// 监听 FeesCollected 事件
uniswapAdapter.on("FeesCollected", (user, tokenId, amount0, amount1) => {
    console.log("Fees collected:", {
        user,
        tokenId: tokenId.toString(),
        amount0: amount0.toString(),
        amount1: amount1.toString()
    });
});
```

### Gas 优化建议

1. **批量操作**: 在可能的情况下批量执行多个操作
2. **合理设置 deadline**: 避免设置过长的截止时间
3. **优化滑点设置**: 根据市场情况合理设置最小数量
4. **使用 Events**: 通过事件获取结果而不是额外的查询调用

### 错误重试机制

```javascript
async function executeWithRetry(operation, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;

            // 指数退避
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));

            console.log(`Retry ${i + 1}/${maxRetries}...`);
        }
    }
}
```

---

**文档版本**: 1.0.0
**最后更新**: 2025-10-10
**维护者**: CryptoStock 开发团队