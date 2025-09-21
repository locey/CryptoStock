# CryptoStock - 去中心化股票代币化智能合约

CryptoStock 是一个创新的去中心化股票代币化智能合约系统，通过区块链技术将传统股票代币化，让用户能够使用加密货币投资股票市场。

## 项目概述

CryptoStock 智能合约系统集成了 Pyth Network 预言机，提供实时股票价格数据，支持股票代币的创建、交易和价格查询。用户可以通过工厂合约创建对应真实股票的 ERC20 代币，实现传统金融与 DeFi 的桥接。

## 功能特性

- 🏭 **代币工厂**: 支持创建对应真实股票的 ERC20 代币
- � **实时价格**: 集成 Pyth Network 获取实时股票价格数据
- 🔮 **预言机聚合**: 统一管理多个股票的价格源 Feed ID
- 💱 **精度转换**: 自动处理不同精度的价格数据转换为 18 位小数
- 🚀 **批量操作**: 支持批量价格更新和查询操作
- �🔒 **可升级代理**: 使用 OpenZeppelin 透明代理模式支持合约升级
- ⚡ **Gas 优化**: 优化的合约设计减少 Gas 消耗
- 🛡️ **安全防护**: 内置价格数据有效性检查和异常处理

## 支持的股票

- **AAPL** (Apple Inc.) - 苹果公司
- **TSLA** (Tesla Inc.) - 特斯拉公司  
- **GOOGL** (Alphabet Inc.) - 谷歌母公司
- **MSFT** (Microsoft Corp.) - 微软公司
- **AMZN** (Amazon.com Inc.) - 亚马逊公司
- **NVDA** (NVIDIA Corp.) - 英伟达公司

## 技术栈

- **Solidity**: ^0.8.22
- **Hardhat**: 开发框架和测试环境
- **OpenZeppelin**: 安全合约库和可升级代理
- **Pyth Network**: 去中心化预言机网络
- **Ethers.js**: 以太坊交互库
- **Hardhat Deploy**: 自动化部署管理
- **Chai**: 测试框架
- **Axios**: HTTP 客户端 (用于 Pyth API 集成)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件并配置必要参数：

```bash
cp .env.example .env
```

配置内容：

```env
# Sepolia 测试网配置
SEPOLIA_URL=https://rpc.sepolia.org
PRIVATE_KEY_1=your_private_key_1
PRIVATE_KEY_2=your_private_key_2
PRIVATE_KEY_3=your_private_key_3
PRIVATE_KEY_4=your_private_key_4

# Etherscan API (用于合约验证)
ETHERSCAN_API_KEY=your_etherscan_api_key

# Gas 报告
REPORT_GAS=true
```

### 3. 编译合约

```bash
npm run compile
```

### 4. 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test test/01-token-factory.test.js
npm test test/02-stock-token.test.js

# 运行测试覆盖率
npm run coverage
```

### 5. 部署合约

#### 本地部署

```bash
# 启动本地节点
npm run node

# 在另一个终端部署
npm run deploy:localhost
```

#### 测试网部署

```bash
npm run deploy:sepolia
```

## 项目结构

```
CryptoStockContract/
├── contracts/              # 智能合约
│   ├── OracleAggregator.sol    # 预言机聚合器
│   ├── TokenFactory.sol        # 代币工厂
│   ├── StockToken.sol          # 股票代币实现
│   ├── MockERC20.sol          # 模拟 USDT 代币
│   └── MockPyth.sol           # 模拟预言机 (测试用)
├── deploy/                 # 自动化部署脚本
│   └── 01-deploy-crypto-stock-system.js
├── test/                   # 测试套件
│   ├── 01-token-factory.test.js
│   └── 02-stock-token.test.js
├── utils/                  # 工具函数
│   └── getPythUpdateData.js    # Pyth API 集成
├── scripts/                # 交互脚本
│   └── interact.js
├── artifacts/              # 编译产物
├── deployments/            # 部署记录
├── hardhat.config.js       # Hardhat 配置
└── package.json           # 项目依赖
```

## 合约架构

### 核心合约

#### TokenFactory.sol
- **功能**: 股票代币工厂合约，负责创建和管理股票代币
- **特性**: 
  - 使用可升级代理模式
  - 统一管理所有创建的股票代币
  - 集成预言机获取实时价格
  - 支持 USDT 作为基础交易货币

#### StockToken.sol  
- **功能**: ERC20 股票代币实现
- **特性**:
  - 标准 ERC20 功能
  - 实时股票价格查询
  - 与预言机聚合器深度集成
  - 支持铸造和销毁操作

#### OracleAggregator.sol
- **功能**: 预言机聚合器，管理多个股票的价格源
- **特性**:
  - 集成 Pyth Network 获取实时价格
  - 支持批量价格更新和查询
  - 自动价格精度转换 (转换为 18 位小数)
  - 价格数据有效性验证

#### MockERC20.sol
- **功能**: 模拟 USDT 代币 (测试和交易用)
- **特性**:
  - 标准 ERC20 实现
  - 支持铸造功能 (测试环境)
  - 6 位小数精度 (符合 USDT 标准)

### 预言机集成

#### Pyth Network 集成
- **Sepolia 网络**: 使用真实 Pyth 预言机数据
- **本地网络**: 使用 MockPyth 模拟数据
- **支持功能**:
  - 实时价格更新
  - 批量价格查询
  - 价格数据有效性检查
  - 自动过滤无效数据 (价格为0或时间戳为0)

### 安全特性

- **可升级代理**: 使用 OpenZeppelin 透明代理模式
- **权限控制**: 基于 Ownable 的访问控制
- **价格验证**: 多重检查确保价格数据有效性
- **重入保护**: 防止重入攻击
- **Gas 优化**: 优化的合约设计和存储布局

## 测试覆盖

项目包含完整的测试套件，支持本地和 Sepolia 网络测试：

### 测试文件

#### 01-token-factory.test.js
- 代币工厂合约功能测试
- 代币创建和管理
- 权限控制验证
- 初始化参数检查

#### 02-stock-token.test.js  
- 股票代币功能测试
- 价格查询和验证
- 批量价格操作测试
- 精度转换验证
- 网络兼容性测试 (本地 vs Sepolia)

### 网络适配测试

- **本地网络**: 使用 MockPyth 进行快速测试
- **Sepolia 网络**: 使用真实 Pyth 数据进行集成测试
- **自动网络检测**: 根据网络环境自动选择测试策略

### 价格数据测试

- 实时价格获取验证
- 批量价格更新测试  
- 价格数据有效性检查
- 异常情况处理 (价格为0、网络错误等)

运行测试覆盖率检查：

```bash
npm run coverage
```

## 部署指南

## 部署指南

### 支持的网络

- **hardhat/localhost**: 本地开发网络 (使用 MockPyth)
- **sepolia**: Sepolia 测试网 (使用真实 Pyth 预言机)
- **mainnet**: 以太坊主网 (生产环境)

### 部署合约顺序

1. **MockERC20_USDT**: 基础稳定币代币
2. **OracleAggregator**: 预言机聚合器 (连接 Pyth Network)
3. **StockToken_Implementation**: 股票代币实现合约
4. **TokenFactory**: 代币工厂 (可升级透明代理)

### 自动化部署

使用 hardhat-deploy 进行自动化部署：

```bash
# 本地部署
npm run deploy:localhost

# Sepolia 测试网部署  
npm run deploy:sepolia
```

### 部署后配置

部署脚本会自动完成以下配置：

1. 设置价格源 Feed IDs (6 个主流股票)
2. 创建初始股票代币 (AAPL, TSLA, GOOGL 等)
3. 分配测试 USDT 代币给测试账户
4. 验证所有合约配置和功能

### Pyth Network 配置

#### Feed IDs 配置
```javascript
const FEED_IDS = {
  "AAPL": "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  "TSLA": "0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2", 
  "GOOGL": "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
  "MSFT": "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  "AMZN": "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  "NVDA": "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"
};
```

#### 网络特定配置
- **Sepolia**: 使用官方 Pyth 合约地址 `0xDd24F84d36BF92C65F92307595335bdFab5Bbd21`
- **本地**: 部署 MockPyth 合约进行测试

## 使用示例

### 创建股票代币

```javascript
const tokenFactory = await ethers.getContractAt("TokenFactory", factoryAddress);

// 创建 Apple 股票代币
const tx = await tokenFactory.createToken(
  "Apple Stock Token",                    // 代币名称
  "AAPL",                                // 代币符号  
  ethers.utils.parseEther("1000000")     // 初始供应量 (100万代币)
);
await tx.wait();

// 获取创建的代币地址
const aaplTokenAddress = await tokenFactory.getTokenAddress("AAPL");
console.log("AAPL 代币地址:", aaplTokenAddress);
```

### 查询股票价格

```javascript
const stockToken = await ethers.getContractAt("StockToken", aaplTokenAddress);

// 获取实时股票价格
const price = await stockToken.getStockPrice();
console.log(`AAPL 当前价格: $${ethers.utils.formatEther(price)}`);

// 获取详细价格信息
const priceInfo = await oracleAggregator.getPrice("AAPL");
console.log(`价格: $${ethers.utils.formatEther(priceInfo.price)}`);
console.log(`发布时间: ${new Date(priceInfo.publishTime * 1000).toISOString()}`);
```

### 批量价格更新

```javascript
const { fetchUpdateData } = require('./utils/getPythUpdateData');

// 获取多个股票的价格更新数据
const symbols = ["AAPL", "GOOGL", "MSFT"];
const updateData = await fetchUpdateData(symbols);

// 计算更新费用
const fee = await oracleAggregator.getUpdateFee(updateData);

// 批量更新和查询价格
const result = await oracleAggregator.updateAndGetPrices(
  symbols,
  updateData,
  { value: fee }
);

const [prices, publishTimes] = result;
for (let i = 0; i < symbols.length; i++) {
  console.log(`${symbols[i]}: $${ethers.utils.formatEther(prices[i])}`);
}
```

### Pyth API 集成

```javascript
// 直接使用 Pyth HTTP API
const { fetchUpdateData, getPriceInfo } = require('./utils/getPythUpdateData');

// 获取单个股票的价格信息 (仅显示用)
const priceInfo = await getPriceInfo("AAPL");
console.log("AAPL 价格信息:", priceInfo);

// 获取批量更新数据 (用于链上调用)
const updateData = await fetchUpdateData(["AAPL", "TSLA"]);
console.log("更新数据:", updateData);
```

## 故障排除

### 常见问题

#### 价格相关问题

1. **价格显示为 0**
   - 检查网络连接到 Pyth API
   - 确认 Feed ID 配置正确
   - 验证股票市场是否开市 (非交易时间价格可能为0)

2. **批量价格更新失败**
   - 检查是否有足够的 ETH 支付更新费用
   - 确认 updateData 格式正确
   - 过滤掉价格为0的无效数据

#### 部署问题

3. **合约部署失败**
   - 检查 Gas limit 设置
   - 确认私钥配置正确
   - 验证网络 RPC 连接

4. **Pyth 集成问题**
   - Sepolia: 确认使用官方 Pyth 合约地址
   - 本地: 确认 MockPyth 正确部署和配置

#### 测试问题

5. **测试超时或失败**
   - 增加测试超时时间 (Sepolia 网络较慢)
   - 检查网络连接稳定性
   - 确认测试账户有足够余额

### 调试工具

```bash
# 查看合约交互详情
npx hardhat console --network sepolia

# 生成 Gas 使用报告
REPORT_GAS=true npm test

# 查看测试覆盖率
npm run coverage

# 验证合约代码
npm run verify --network sepolia
```

### 环境检查

```javascript
// 检查网络配置
console.log("网络:", hre.network.name);
console.log("Chain ID:", await ethers.provider.getNetwork());

// 检查账户余额
const accounts = await ethers.getSigners();
const balance = await accounts[0].getBalance();
console.log("部署者余额:", ethers.utils.formatEther(balance), "ETH");

// 检查合约部署状态
const deployments = await hre.deployments.all();
console.log("已部署合约:", Object.keys(deployments));
```

## 贡献指南

### 开发流程

1. Fork 项目仓库
2. 创建功能分支: `git checkout -b feature/your-feature`
3. 编写代码和测试用例
4. 运行测试确保通过: `npm test`
5. 提交更改: `git commit -m "Add your feature"`
6. 推送分支: `git push origin feature/your-feature`
7. 创建 Pull Request

### 代码规范

- **Solidity**: 遵循 OpenZeppelin 和 Hardhat 推荐的编码标准
- **JavaScript**: 使用 ES6+ 语法，保持代码简洁明了
- **测试**: 为新功能编写完整的测试用例
- **文档**: 更新相关文档和注释

### 测试要求

- 新增功能必须包含单元测试
- 测试覆盖率不低于现有水平
- 确保本地和 Sepolia 网络测试都通过

## 安全建议

### 主网部署前检查

- **代码审计**: 建议进行专业的智能合约安全审计
- **测试网验证**: 在 Sepolia 测试网充分测试所有功能
- **Price Feed 验证**: 确认所有价格源 Feed ID 正确无误
- **Gas 优化**: 优化合约调用减少用户成本
- **监控系统**: 部署价格异常监控和报警系统

### 运行时安全

- **价格数据验证**: 内置多重检查防止异常价格数据
- **访问控制**: 严格的权限管理和多签钱包
- **紧急暂停**: 预留紧急暂停和升级机制
- **资金安全**: 合约不持有用户资金，降低风险

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 相关链接

- **Pyth Network**: https://pyth.network/ - 去中心化预言机网络
- **OpenZeppelin**: https://openzeppelin.com/ - 安全智能合约库
- **Hardhat**: https://hardhat.org/ - 以太坊开发框架
- **Sepolia 测试网**: https://sepolia.etherscan.io/ - 测试网区块浏览器

## 联系方式

- **GitHub Issues**: 提交 Bug 报告和功能请求
- **技术文档**: 查看项目 Wiki 获取详细技术文档
- **社区讨论**: 加入我们的技术交流群

## 版本历史

- **v1.0.0**: 初始版本
  - TokenFactory 代币工厂实现
  - StockToken ERC20 股票代币
  - OracleAggregator 预言机集成
  - Pyth Network 实时价格数据
  - 完整测试套件和部署脚本

---

⚠️ **免责声明**: 本项目仅供学习和研究使用。智能合约涉及金融风险，请在充分理解代码逻辑和风险的前提下使用。投资有风险，请谨慎决策。
