# 代币转账脚本使用说明

## 概述

提供两个脚本用于在 Sepolia 测试网上给指定账户转账 ERC20 代币：

1. `transfer-tokens.js` - 完整功能的转账脚本
2. `quick-transfer.js` - 简化的快速转账脚本

## 支持的代币

脚本会自动读取 `deployments-uups-sepolia.json` 配置文件，获取以下代币：

- **USDT**: 基础稳定币
- **股票代币**: AAPL, TSLA, GOOGL, MSFT, AMZN, NVDA

共计 **7种 ERC20 代币**

## 使用方法

### 方法一：完整功能脚本 (推荐)

```bash
# 基本用法 - 每种代币转 10000 个
npx hardhat run scripts/transfer-tokens.js --network sepolia -- <目标地址>

# 指定转账数量
npx hardhat run scripts/transfer-tokens.js --network sepolia -- <目标地址> <数量>

# 示例
npx hardhat run scripts/transfer-tokens.js --network sepolia -- 0x1234567890123456789012345678901234567890 5000
```

### 方法二：快速转账脚本

1. 编辑 `scripts/quick-transfer.js` 文件
2. 修改 `TARGET_ADDRESS` 为目标地址
3. 修改 `TRANSFER_AMOUNT` 为转账数量 (可选)
4. 运行脚本：

```bash
npx hardhat run scripts/quick-transfer.js --network sepolia
```

## 脚本功能

### 自动处理机制

1. **余额检查**: 检查 owner 是否有足够的代币余额
2. **智能转账**: 
   - 如果余额足够 → 直接转账
   - 如果余额不足 → 尝试铸造代币
3. **铸造策略**:
   - 优先直接铸造给目标地址
   - 如果失败，铸造给 owner 后再转账
4. **错误处理**: 每种代币独立处理，单个失败不影响其他代币

### 安全特性

- ✅ 地址格式验证
- ✅ 网络匹配检查  
- ✅ 部署者身份验证
- ✅ ETH 余额检查
- ✅ 交易确认等待
- ✅ 详细的执行日志

## 前置条件

### 1. 网络配置

确保 `hardhat.config.js` 中配置了 Sepolia 网络：

```javascript
sepolia: {
  url: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
  accounts: ["YOUR_PRIVATE_KEY"]
}
```

### 2. 账户要求

- 使用的账户应该是代币合约的 owner 或有 mint 权限
- 账户需要有足够的 ETH 支付 Gas 费用 (建议 > 0.01 ETH)

### 3. 权限说明

脚本假设 ERC20 代币合约具有以下接口：
- `transfer()` - 转账函数
- `mint()` - 铸造函数 (需要 owner 权限)
- `balanceOf()` - 余额查询
- `decimals()` - 精度查询

## 示例输出

```
🚀 开始执行代币转账脚本
📍 目标地址: 0x1234...5678
💰 每种代币转账数量: 10000

📋 Loaded deployment config for network: sepolia (Chain ID: 11155111)
👑 Owner 地址: 0x46b4...796A
📊 找到 7 种 ERC20 代币:
   USDT: 0xDec3...c7D8
   AAPL: 0x6234...21A4
   TSLA: 0x5B17...432F
   ...

🔍 处理代币: USDT
   📝 代币信息: Tether USD (USDT), 精度: 6
   💰 转账金额: 10000 USDT
   👑 Owner 余额: 50000 USDT
   ✅ 余额充足，执行转账...
   🎯 转账成功! TxHash: 0xabc...def

📊 执行结果总结:
✅ 成功: 7 种代币
❌ 失败: 0 种代币
🎉 所有代币转账完成!
```

## 故障排除

### 常见问题

1. **"Insufficient balance" 错误**
   - 原因: 账户 ETH 不足支付 Gas
   - 解决: 向账户转入更多 ETH

2. **"Only owner can mint" 错误**
   - 原因: 当前账户不是代币合约的 owner
   - 解决: 使用正确的 owner 账户，或联系管理员

3. **"Network mismatch" 错误**
   - 原因: 当前网络与配置文件不匹配
   - 解决: 确保使用 `--network sepolia` 参数

4. **"Invalid address format" 错误**
   - 原因: 目标地址格式不正确
   - 解决: 检查地址是否为有效的以太坊地址

### 调试技巧

- 使用 `console.log` 输出详细信息
- 检查 Sepolia 区块链浏览器确认交易状态
- 验证代币合约是否正确部署

## 注意事项

⚠️ **重要提醒**:
- 这是测试网脚本，仅用于 Sepolia 测试环境
- 不要在主网上使用此脚本
- 确保私钥安全，不要提交到版本控制系统
- 建议先小额测试，确认无误后再大量转账

## 更新日志

- v1.0: 基础转账功能
- v1.1: 添加自动铸造功能
- v1.2: 增强错误处理和日志输出