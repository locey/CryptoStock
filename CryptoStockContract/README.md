# CryptoStock Smart Contract System# CryptoStock - 分散化股票代币交易系统# CryptoStock - 去中心化股票代币化智能合约



[![Solidity](https://img.shields.io/badge/Solidity-0.8.22-blue)](https://soliditylang.org/)

[![Hardhat](https://img.shields.io/badge/Hardhat-2.19.5-yellow)](https://hardhat.org/)

[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.1.0-green)](https://openzeppelin.com/)[![Solidity](https://img.shields.io/badge/Solidity-0.8.22-blue)](https://soliditylang.org/)CryptoStock 是一个创新的去中心化股票代币化智能合约系统，通过区块链技术将传统股票代币化，让用户能够使用加密货币投资股票市场。

[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-purple)](https://ethers.org/)

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)[![Hardhat](https://img.shields.io/badge/Hardhat-2.22.15-yellow)](https://hardhat.org/)



## 🎯 项目概述[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.1.0-green)](https://openzeppelin.com/)## 项目概述



CryptoStock是一个基于以太坊的去中心化股票代币化智能合约系统，允许用户通过区块链技术将传统股票代币化，并使用USDT进行买卖交易。系统集成了多个价格预言机（Pyth Network + RedStone）提供实时股票价格数据，支持多种DeFi协议集成。[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-purple)](https://ethers.org/)



## ✨ 核心特性[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)CryptoStock 智能合约系统集成了 Pyth Network 预言机，提供实时股票价格数据，支持股票代币的创建、交易和价格查询。用户可以通过工厂合约创建对应真实股票的 ERC20 代币，实现传统金融与 DeFi 的桥接。



### 🏭 代币化系统

- **动态代币工厂**: 支持创建对应真实股票的可升级ERC20代币

- **UUPS可升级架构**: 使用OpenZeppelin代理模式，支持合约安全升级## 🎯 项目概述## 功能特性

- **批量代币管理**: 一键创建多种股票代币（AAPL、TSLA、GOOGL、MSFT、AMZN、NVDA）



### 📊 价格预言机系统

- **多源价格聚合**: 集成Pyth Network和RedStone预言机CryptoStock 是一个基于以太坊的分散化股票代币交易系统，允许用户通过区块链技术交易代表真实股票的代币。系统集成了 Pyth Network 价格预言机，提供实时、准确的股票价格数据，支持无缝的买卖交易。- 🏭 **代币工厂**: 支持创建对应真实股票的 ERC20 代币

- **智能权重分配**: Pyth(60%) + RedStone(40%) 加权平均价格

- **实时价格更新**: 支持payable价格更新，处理预言机费用- � **实时价格**: 集成 Pyth Network 获取实时股票价格数据

- **容错机制**: 单个预言机失败时自动切换备用数据源

### ✨ 核心特性- 🔮 **预言机聚合**: 统一管理多个股票的价格源 Feed ID

### 💱 交易系统

- **无缝买卖**: 支持USDT与股票代币的双向交易- 💱 **精度转换**: 自动处理不同精度的价格数据转换为 18 位小数

- **滑点保护**: 内置最小交易金额和滑点保护机制

- **手续费机制**: 可配置的交易手续费（默认0.3%）- 🏪 **代币工厂系统**: 动态创建和管理股票代币- 🚀 **批量操作**: 支持批量价格更新和查询操作

- **安全防护**: 重入保护、暂停机制、余额检查

- 📊 **实时价格预言机**: 集成Pyth Network获取实时股票价格- �🔒 **可升级代理**: 使用 OpenZeppelin 透明代理模式支持合约升级

### 🔗 DeFi生态集成

- **多协议适配器**: 支持Aave、Compound、Curve、Uniswap V3、PancakeSwap、Yearn V3- 💱 **无缝交易体验**: 支持USDT与股票代币的买卖交易- ⚡ **Gas 优化**: 优化的合约设计减少 Gas 消耗

- **收益策略**: 自动化DeFi收益聚合和管理

- **流动性优化**: 智能路由最优化交易执行- 🔄 **UUPS可升级架构**: 支持合约安全升级- 🛡️ **安全防护**: 内置价格数据有效性检查和异常处理



## 🏗️ 架构设计- 🛡️ **安全机制**: 包含暂停、重入保护、滑点保护等安全功能



### 核心合约- 🧪 **完整测试覆盖**: 5套完整的测试用例，支持本地和Sepolia网络## 支持的股票



```

CryptoStockContract/

├── StockToken.sol              # 股票代币合约（可升级ERC20）## 🏗️ 架构设计- **AAPL** (Apple Inc.) - 苹果公司

├── TokenFactory.sol            # 代币工厂（UUPS代理）

├── PriceAggregator.sol         # 价格聚合器- **TSLA** (Tesla Inc.) - 特斯拉公司  

├── DefiAggregator.sol          # DeFi协议聚合器

└── CSToken.sol                 # 项目治理代币### 合约架构- **GOOGL** (Alphabet Inc.) - 谷歌母公司

```

- **MSFT** (Microsoft Corp.) - 微软公司

### 价格预言机层

```- **AMZN** (Amazon.com Inc.) - 亚马逊公司

```

feeds/┌─────────────────────────────────────────────────────────────┐- **NVDA** (NVIDIA Corp.) - 英伟达公司

├── PythPriceFeed.sol           # Pyth Network适配器

└── RedstonePriceFeed.sol       # RedStone适配器│                    CryptoStock 系统架构                      │

```

├─────────────────────────────────────────────────────────────┤## 技术栈

### DeFi适配器层

│                                                             │

```

adapters/│  ┌─────────────────┐    ┌─────────────────┐                │- **Solidity**: ^0.8.22

├── AaveAdapter.sol             # Aave V3协议适配器

├── CompoundAdapter.sol         # Compound协议适配器│  │  TokenFactory   │    │ OracleAggregator│                │- **Hardhat**: 开发框架和测试环境

├── CurveAdapter.sol            # Curve协议适配器

├── UniswapV3Adapter.sol        # Uniswap V3协议适配器│  │   (UUPS Proxy)  │────│   (UUPS Proxy)  │                │- **OpenZeppelin**: 安全合约库和可升级代理

├── PancakeAdapter.sol          # PancakeSwap适配器

└── YearnV3Adapter.sol          # Yearn V3协议适配器│  │                 │    │                 │                │- **Pyth Network**: 去中心化预言机网络

```

│  │ • 创建股票代币    │    │ • Pyth集成      │                │- **Ethers.js**: 以太坊交互库

### 接口定义

│  │ • 管理代币列表    │    │ • 价格聚合      │                │- **Hardhat Deploy**: 自动化部署管理

```

interfaces/│  │ • 升级支持       │    │ • 多资产支持    │                │- **Chai**: 测试框架

├── IPriceOracle.sol            # 价格预言机统一接口

├── IDefiAdapter.sol            # DeFi适配器接口│  └─────────────────┘    └─────────────────┘                │- **Axios**: HTTP 客户端 (用于 Pyth API 集成)

├── IOperationTypes.sol         # 操作类型定义

└── 各协议专用接口 (IAave.sol, ICompound.sol, 等)│           │                        │                       │

```

│           │                        │                       │## 快速开始

### 测试合约

│           ▼                        │                       │

```

mock/│  ┌─────────────────┐               │                       │### 1. 安装依赖

├── MockERC20.sol               # ERC20代币模拟（USDT等）

├── MockPyth.sol                # Pyth预言机模拟│  │   StockToken    │◄──────────────┘                       │

├── MockRedStoneOracle.sol      # RedStone预言机模拟

└── 各DeFi协议模拟合约│  │   (UUPS Proxy)  │                                       │```bash

```

│  │                 │                                       │npm install

## 🚀 支持的股票

│  │ • ERC20代币      │                                       │```

| 股票代码 | 公司名称 | 代币名称 | 初始供应量 |

|---------|----------|----------|-----------|│  │ • 买卖交易       │                                       │

| AAPL | Apple Inc. | Apple Inc Stock Token | 1,000,000 |

| TSLA | Tesla Inc. | Tesla Inc Stock Token | 500,000 |│  │ • 价格计算       │                                       │### 2. 配置环境变量

| GOOGL | Alphabet Inc. | Google Stock Token | 300,000 |

| MSFT | Microsoft Corp. | Microsoft Stock Token | 400,000 |│  │ • 安全机制       │                                       │

| AMZN | Amazon.com Inc. | Amazon Stock Token | 200,000 |

| NVDA | NVIDIA Corporation | NVIDIA Stock Token | 600,000 |│  │ • 升级支持       │                                       │创建 `.env` 文件并配置必要参数：



## 🛠️ 技术栈│  └─────────────────┘                                       │



- **智能合约**: Solidity 0.8.22│                                                             │```bash

- **开发框架**: Hardhat 2.19.5

- **可升级合约**: OpenZeppelin Upgrades└─────────────────────────────────────────────────────────────┘cp .env.example .env

- **代理模式**: UUPS (Universal Upgradeable Proxy Standard)

- **测试库**: Chai + Ethers.js v6``````

- **网络支持**: Ethereum Mainnet, Sepolia Testnet, Hardhat Local



## 📁 项目结构

### 核心合约配置内容：

```

CryptoStockContract/

├── contracts/                  # 智能合约源码

│   ├── adapters/              # DeFi协议适配器| 合约名称 | 类型 | 功能描述 |```env

│   ├── feeds/                 # 价格预言机适配器

│   ├── interfaces/            # 接口定义|---------|------|---------|# Sepolia 测试网配置

│   ├── mock/                  # 测试模拟合约

│   └── *.sol                  # 核心合约| `TokenFactory` | UUPS代理 | 股票代币工厂，负责创建和管理所有股票代币 |SEPOLIA_URL=https://rpc.sepolia.org

├── scripts/                   # 部署脚本

│   ├── deploy-unified-oracle.js      # 预言机系统部署| `StockToken` | UUPS代理 | 股票代币实现，支持买卖交易和价格查询 |PRIVATE_KEY_1=your_private_key_1

│   ├── deploy-stock-sepolia-unified.js # 股票系统部署

│   └── deploy-*-adapter-only.js      # 各适配器独立部署| `OracleAggregator` | UUPS代理 | 价格预言机聚合器，集成Pyth Network |PRIVATE_KEY_2=your_private_key_2

├── test/                      # 测试用例

│   ├── 01-token-factory.test.js      # 代币工厂测试| `MockERC20` | 标准合约 | 模拟USDT代币，用于测试环境 |PRIVATE_KEY_3=your_private_key_3

│   ├── 02-stock-token.test.js        # 股票代币测试

│   ├── 12-PriceOracle-AAPL.test.js   # 价格预言机测试| `MockPyth` | 标准合约 | 模拟Pyth预言机，用于本地测试 |PRIVATE_KEY_4=your_private_key_4

│   └── 0X-*.test.js                  # DeFi协议集成测试

├── utils/                     # 工具函数

│   ├── getPythUpdateData.js          # Pyth价格数据获取

│   └── getRedStoneUpdateData-v061.js # RedStone数据获取## 🚀 快速开始# Etherscan API (用于合约验证)

├── abi/                       # 合约ABI文件

├── deployments-*.json         # 部署记录文件ETHERSCAN_API_KEY=your_etherscan_api_key

└── hardhat.config.js          # Hardhat配置

```### 环境要求



## 🚀 快速开始# Gas 报告



### 环境准备- Node.js >= 16.0.0REPORT_GAS=true



```bash- npm >= 8.0.0```

# 安装依赖

npm install- Git



# 配置环境变量### 3. 编译合约

cp .env.example .env

# 编辑 .env 文件，设置以下变量：### 安装依赖

# SEPOLIA_RPC_URL=您的Sepolia RPC URL

# PRIVATE_KEY=您的私钥```bash

# ETHERSCAN_API_KEY=您的Etherscan API密钥

``````bashnpm run compile



### 编译合约# 克隆仓库```



```bashgit clone <repository-url>

# 编译所有合约

npm run compilecd CryptoStockContract### 4. 运行测试



# 或使用hardhat命令

npx hardhat compile

```# 安装依赖```bash



### 本地测试npm install# 运行所有测试



```bash```npm test

# 启动本地节点

npx hardhat node



# 运行测试套件### 环境配置# 运行特定测试文件

npm run test

npm test test/01-token-factory.test.js

# 运行特定测试

npx hardhat test test/02-stock-token.test.js复制环境配置文件并填入相应参数：npm test test/02-stock-token.test.js

```



### 部署到Sepolia测试网

```bash# 运行测试覆盖率

```bash

# 1. 首先部署统一预言机系统cp .env.example .envnpm run coverage

npx hardhat run scripts/deploy-unified-oracle.js --network sepolia

``````

# 2. 部署股票代币系统

npx hardhat run scripts/deploy-stock-sepolia-unified.js --network sepolia



# 3. 运行集成测试编辑 `.env` 文件：### 5. 部署合约

npx hardhat test test/12-PriceOracle-AAPL.test.js --network sepolia

```



## 🧪 测试覆盖```bash#### 本地部署



### 核心功能测试# RPC URLs

- ✅ 代币工厂创建和管理

- ✅ 股票代币买卖交易SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY```bash

- ✅ 价格预言机集成

- ✅ 合约升级机制# 启动本地节点

- ✅ 安全防护机制

# Etherscan API Key for contract verificationnpm run node

### DeFi协议集成测试

- ✅ Aave V3存借款ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

- ✅ Compound协议集成

- ✅ Curve AMM交易# 在另一个终端部署

- ✅ Uniswap V3流动性

- ✅ PancakeSwap交易# Gas reporting (optional)npm run deploy:localhost

- ✅ Yearn V3收益策略

REPORT_GAS=true```

### 网络环境测试

- 🔄 Hardhat本地网络

- 🌐 Sepolia测试网络

- 📊 Gas优化分析# 账户私钥 (测试用途)#### 测试网部署



## 📊 合约地址（Sepolia测试网）PRIVATE_KEY_1=your_private_key_here



### 预言机系统PRIVATE_KEY_2=your_private_key_here```bash

```json

{PRIVATE_KEY_3=your_private_key_herenpm run deploy:sepolia

  "PythPriceFeed": "0xF358b741b96a615903e4e1049A1BE000B176D163",

  "RedstonePriceFeed": "0xd4F07054c2aB9eAb2afB3F852A3651Fc0db38ACB",PRIVATE_KEY_4=your_private_key_here```

  "PriceAggregator": "0x9F491D7e329BF6CfC2672F01dF9f856F45379034"

}```

```

## 项目结构

### 代币系统

```json## 🛠️ 开发指南

{

  "TokenFactory": "0x5DA5B533Af66c614aFE6C8CD9710dF73EFA48399",```

  "USDT": "0x8e032e6Fc641f347B12770019A213fd5b9E29339",

  "StockTokens": {### 编译合约CryptoStockContract/

    "AAPL": "0x9C517312Df1Bb1943F7Daf0a3C5536Bc5626F0Cc",

    "TSLA": "0x15BbF440d619F509a1083655dD4dc06239580127",├── contracts/              # 智能合约

    "GOOGL": "0xEed0F259b606c195C6e14770173771427d058fCA",

    "MSFT": "0xF7785bC80D37a00acBFb3f0caB14e28448F45213",```bash│   ├── OracleAggregator.sol    # 预言机聚合器

    "AMZN": "0xbd26EffC4f46898d68aADca0cD56001D628B89F8",

    "NVDA": "0xf7f9EfC3fe605Fe077cD3f78EF7f90c5fcF435AF"npm run compile│   ├── TokenFactory.sol        # 代币工厂

  }

}```│   ├── StockToken.sol          # 股票代币实现

```

│   ├── MockERC20.sol          # 模拟 USDT 代币

## 🔧 开发命令

### 运行测试│   └── MockPyth.sol           # 模拟预言机 (测试用)

```bash

# 编译和构建├── deploy/                 # 自动化部署脚本

npm run compile              # 编译合约

npm run build               # 编译 + 提取ABI```bash│   └── 01-deploy-crypto-stock-system.js

npm run extract-abi         # 提取ABI文件

# 本地网络测试├── test/                   # 测试套件

# 测试命令

npm run test                # 运行所有测试npm test│   ├── 01-token-factory.test.js

npm run coverage            # 生成测试覆盖率报告

│   └── 02-stock-token.test.js

# 部署命令

npm run deploy:stock:sepolia          # 部署股票系统到Sepolia# Sepolia网络测试├── utils/                  # 工具函数

npm run deploy:infrastructure:sepolia # 部署DeFi基础设施

npm run deploy:all-adapters:sepolia  # 部署所有DeFi适配器npm run test -- --network sepolia│   └── getPythUpdateData.js    # Pyth API 集成



# 清理命令├── scripts/                # 交互脚本

npm run clean               # 清理编译缓存

```# 特定测试文件│   └── interact.js



## 🛡️ 安全特性npx hardhat test test/01-token-factory.test.js├── artifacts/              # 编译产物



### 合约安全npx hardhat test test/02-stock-token.test.js  ├── deployments/            # 部署记录

- **重入保护**: 使用OpenZeppelin ReentrancyGuard

- **访问控制**: 基于角色的权限管理npx hardhat test test/03-exchange.test.js├── hardhat.config.js       # Hardhat 配置

- **暂停机制**: 紧急情况下可暂停合约功能

- **升级控制**: UUPS代理模式的安全升级npx hardhat test test/04-stock-token-upgrade.test.js└── package.json           # 项目依赖



### 交易安全npx hardhat test test/05-oracle-upgrade.test.js```

- **滑点保护**: 防止价格操纵攻击

- **余额检查**: 确保充足的代币和USDT储备```

- **最小交易限制**: 防止粉尘攻击

- **手续费验证**: 防止手续费操纵## 合约架构



### 预言机安全### 部署合约

- **多源验证**: 多个预言机数据交叉验证

- **异常检测**: 价格异常时自动降级### 核心合约

- **数据时效性**: 检查价格数据的时效性

- **容错机制**: 单点故障时的自动恢复```bash



## 📈 Gas优化# 部署到Sepolia测试网#### TokenFactory.sol



- **批量操作**: 支持批量价格更新和代币创建npm run deploy:full:sepolia- **功能**: 股票代币工厂合约，负责创建和管理股票代币

- **存储优化**: 优化状态变量布局减少存储成本

- **计算优化**: 减少链上复杂计算- **特性**: 

- **代理模式**: 使用代理减少重复代码部署

# 本地部署  - 使用可升级代理模式

## 🤝 贡献指南

npm run deploy:localhost  - 统一管理所有创建的股票代币

1. Fork项目

2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)```  - 集成预言机获取实时价格

3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)

4. 推送到分支 (`git push origin feature/AmazingFeature`)  - 支持 USDT 作为基础交易货币

5. 打开Pull Request

### 验证合约

## 📝 许可证

#### StockToken.sol  

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件获取详细信息。

```bash- **功能**: ERC20 股票代币实现

## 🔗 相关链接

# 验证已部署的合约- **特性**:

- [Pyth Network](https://pyth.network/) - 价格预言机数据源

- [RedStone Oracle](https://redstone.finance/) - 备用价格预言机npm run verify:sepolia  - 标准 ERC20 功能

- [OpenZeppelin](https://openzeppelin.com/) - 安全智能合约库

- [Hardhat](https://hardhat.org/) - 开发框架```  - 实时股票价格查询



## 📞 联系我们  - 与预言机聚合器深度集成



- 项目主页: [GitHub Repository](https://github.com/locey/CryptoStock)## 📊 已部署合约 (Sepolia)  - 支持铸造和销毁操作

- 问题反馈: [Issues](https://github.com/locey/CryptoStock/issues)



---

| 合约 | 地址 | 类型 |#### OracleAggregator.sol

**免责声明**: 本项目仅用于教育和研究目的。在生产环境中使用前，请进行充分的安全审计。投资有风险，请谨慎决策。
|------|------|------|- **功能**: 预言机聚合器，管理多个股票的价格源

| TokenFactory | `0xf5E1a44A68815fa627c1588e071fd089478aEB9C` | UUPS代理 |- **特性**:

| OracleAggregator | `0x071304F5010BDdC9665c2666b6B930d7a60cf5bB` | UUPS代理 |  - 集成 Pyth Network 获取实时价格

| USDT (Mock) | `0xAd728799474E8606571EBaCa43A9A595d760f613` | 标准ERC20 |  - 支持批量价格更新和查询

  - 自动价格精度转换 (转换为 18 位小数)

### 股票代币地址  - 价格数据有效性验证



| 股票符号 | 代币地址 | 股票名称 |#### MockERC20.sol

|---------|----------|----------|- **功能**: 模拟 USDT 代币 (测试和交易用)

| AAPL | `0x794f86DD0958be85E99841A78e0f50F2C55C6ede` | Apple Inc Stock Token |- **特性**:

| TSLA | `0xD2cFbcebc4ee17c721DFf7746E3dEAd85c83DD40` | Tesla Inc Stock Token |  - 标准 ERC20 实现

| GOOGL | `0xe15f9419B7Cf542CBF77626F231606dF48a034F5` | Google Stock Token |  - 支持铸造功能 (测试环境)

| MSFT | `0x38eEbAE9ef4dE3cB3BC5d8B85F6df2C2dEeec6F9` | Microsoft Stock Token |  - 6 位小数精度 (符合 USDT 标准)

| AMZN | `0x4FB1B9ABBa0c7a2ff3A892C2eC89F5e4EA95Ed9B` | Amazon Stock Token |

| NVDA | `0xF9f5FB3c67BE4fcE1C4027b5Ba1Ac23Fa0BADF59` | NVIDIA Stock Token |### 预言机集成



## 🧪 测试架构#### Pyth Network 集成

- **Sepolia 网络**: 使用真实 Pyth 预言机数据

项目包含5套完整的测试用例，总计30+个测试场景：- **本地网络**: 使用 MockPyth 模拟数据

- **支持功能**:

### 测试文件结构  - 实时价格更新

  - 批量价格查询

```  - 价格数据有效性检查

test/  - 自动过滤无效数据 (价格为0或时间戳为0)

├── 01-token-factory.test.js     # 代币工厂功能测试

├── 02-stock-token.test.js       # 股票代币基础功能测试  ### 安全特性

├── 03-exchange.test.js          # 交易系统完整测试 (22个测试用例)

├── 04-stock-token-upgrade.test.js # 股票代币升级测试- **可升级代理**: 使用 OpenZeppelin 透明代理模式

└── 05-oracle-upgrade.test.js    # 预言机升级测试- **权限控制**: 基于 Ownable 的访问控制

```- **价格验证**: 多重检查确保价格数据有效性

- **重入保护**: 防止重入攻击

### 关键测试场景- **Gas 优化**: 优化的合约设计和存储布局



- ✅ **代币创建**: 工厂合约创建各种股票代币## 测试覆盖

- ✅ **价格查询**: 实时获取Pyth Network价格数据

- ✅ **买入交易**: USDT购买股票代币的完整流程项目包含完整的测试套件，支持本地和 Sepolia 网络测试：

- ✅ **卖出交易**: 股票代币兑换USDT的完整流程

- ✅ **滑点保护**: 价格波动时的交易保护机制### 测试文件

- ✅ **权限控制**: 管理员权限和用户权限测试

- ✅ **升级测试**: UUPS代理合约升级功能验证#### 01-token-factory.test.js

- ✅ **错误处理**: 各种边界条件和错误情况处理- 代币工厂合约功能测试

- 代币创建和管理

## 💼 使用示例- 权限控制验证

- 初始化参数检查

### 基础交易流程

#### 02-stock-token.test.js  

```javascript- 股票代币功能测试

// 1. 连接到已部署的合约- 价格查询和验证

const tokenFactory = await ethers.getContractAt("TokenFactory", FACTORY_ADDRESS);- 批量价格操作测试

const aaplToken = await ethers.getContractAt("StockToken", AAPL_ADDRESS);- 精度转换验证

const usdtToken = await ethers.getContractAt("MockERC20", USDT_ADDRESS);- 网络兼容性测试 (本地 vs Sepolia)



// 2. 授权USDT使用### 网络适配测试

await usdtToken.approve(AAPL_ADDRESS, ethers.parseUnits("1000", 6));

- **本地网络**: 使用 MockPyth 进行快速测试

// 3. 获取实时价格和手续费- **Sepolia 网络**: 使用真实 Pyth 数据进行集成测试

const [price, fee] = await aaplToken.getBuyPriceAndFee(ethers.parseEther("10"));- **自动网络检测**: 根据网络环境自动选择测试策略



// 4. 购买股票代币### 价格数据测试

const overrides = { 

  value: fee,- 实时价格获取验证

  gasLimit: 500000,- 批量价格更新测试  

  gasPrice: ethers.parseUnits("2", "gwei")- 价格数据有效性检查

};- 异常情况处理 (价格为0、网络错误等)

await aaplToken.buy(ethers.parseEther("10"), overrides);

运行测试覆盖率检查：

// 5. 卖出股票代币  

await aaplToken.sell(ethers.parseEther("5"), overrides);```bash

```npm run coverage

```

### 合约升级示例

## 部署指南

```javascript

// 1. 使用forceImport导入现有代理## 部署指南

const StockToken = await ethers.getContractFactory("StockToken");

const importedProxy = await upgrades.forceImport(PROXY_ADDRESS, StockToken, { kind: 'uups' });### 支持的网络



// 2. 升级到V2版本- **hardhat/localhost**: 本地开发网络 (使用 MockPyth)

const StockTokenV2 = await ethers.getContractFactory("StockTokenV2");- **sepolia**: Sepolia 测试网 (使用真实 Pyth 预言机)

const upgradedProxy = await upgrades.upgradeProxy(importedProxy, StockTokenV2);- **mainnet**: 以太坊主网 (生产环境)



// 3. 使用V2新功能### 部署合约顺序

await upgradedProxy.setUpgradeNote("Successfully upgraded to V2");

const note = await upgradedProxy.getUpgradeNote();1. **MockERC20_USDT**: 基础稳定币代币

```2. **OracleAggregator**: 预言机聚合器 (连接 Pyth Network)

3. **StockToken_Implementation**: 股票代币实现合约

## 🔧 技术栈4. **TokenFactory**: 代币工厂 (可升级透明代理)



### 区块链技术### 自动化部署



- **Solidity 0.8.22**: 智能合约开发语言使用 hardhat-deploy 进行自动化部署：

- **Hardhat**: 开发框架和测试环境

- **OpenZeppelin**: 安全的合约库和升级框架```bash

- **Ethers.js v6**: 区块链交互库# 本地部署

npm run deploy:localhost

### 外部集成

# Sepolia 测试网部署  

- **Pyth Network**: 去中心化价格预言机npm run deploy:sepolia

- **Etherscan API**: 合约验证和监控```



### 开发工具### 部署后配置



- **Chai**: 测试断言库部署脚本会自动完成以下配置：

- **Mocha**: 测试框架

- **dotenv**: 环境变量管理1. 设置价格源 Feed IDs (6 个主流股票)

- **TypeChain**: TypeScript类型生成2. 创建初始股票代币 (AAPL, TSLA, GOOGL 等)

3. 分配测试 USDT 代币给测试账户

## 📋 脚本命令4. 验证所有合约配置和功能



| 命令 | 功能描述 |### Pyth Network 配置

|------|----------|

| `npm run compile` | 编译所有智能合约 |#### Feed IDs 配置

| `npm test` | 运行所有测试用例 |```javascript

| `npm run deploy:full:sepolia` | 部署完整系统到Sepolia |const FEED_IDS = {

| `npm run verify:sepolia` | 验证Sepolia上的合约 |  "AAPL": "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",

| `npm run node` | 启动本地Hardhat节点 |  "TSLA": "0x82c4d954fce9132f936100aa0b51628d7ac01888e4b46728d5d3f5778eb4c1d2", 

| `npm run clean` | 清理编译缓存 |  "GOOGL": "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",

| `npm run coverage` | 生成测试覆盖率报告 |  "MSFT": "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",

  "AMZN": "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",

## 🔐 安全特性  "NVDA": "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"

};

### 合约安全机制```



- **重入保护**: 使用OpenZeppelin的ReentrancyGuard#### 网络特定配置

- **暂停机制**: 紧急情况下可暂停合约操作- **Sepolia**: 使用官方 Pyth 合约地址 `0xDd24F84d36BF92C65F92307595335bdFab5Bbd21`

- **权限控制**: 基于角色的访问控制- **本地**: 部署 MockPyth 合约进行测试

- **滑点保护**: 交易价格波动保护机制

- **溢出保护**: Solidity 0.8.x内置溢出检查## 使用示例

- **升级安全**: UUPS代理模式，只有管理员可升级

### 创建股票代币

### 最佳实践

```javascript

- ✅ 使用最新版本的OpenZeppelin库const tokenFactory = await ethers.getContractAt("TokenFactory", factoryAddress);

- ✅ 遵循CEI (Checks-Effects-Interactions) 模式

- ✅ 完整的事件日志记录// 创建 Apple 股票代币

- ✅ 详细的错误消息const tx = await tokenFactory.createToken(

- ✅ Gas优化考虑  "Apple Stock Token",                    // 代币名称

- ✅ 全面的测试覆盖  "AAPL",                                // 代币符号  

  ethers.utils.parseEther("1000000")     // 初始供应量 (100万代币)

## 🤝 贡献指南);

await tx.wait();

1. Fork 本仓库

2. 创建功能分支 (`git checkout -b feature/amazing-feature`)// 获取创建的代币地址

3. 提交更改 (`git commit -m 'Add amazing feature'`)const aaplTokenAddress = await tokenFactory.getTokenAddress("AAPL");

4. 推送分支 (`git push origin feature/amazing-feature`)console.log("AAPL 代币地址:", aaplTokenAddress);

5. 创建Pull Request```



### 开发规范### 查询股票价格



- 遵循Solidity风格指南```javascript

- 添加完整的注释和文档const stockToken = await ethers.getContractAt("StockToken", aaplTokenAddress);

- 确保所有测试通过

- 更新相关文档// 获取实时股票价格

const price = await stockToken.getStockPrice();

## 📄 许可证console.log(`AAPL 当前价格: $${ethers.utils.formatEther(price)}`);



本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件获取详细信息。// 获取详细价格信息

const priceInfo = await oracleAggregator.getPrice("AAPL");

## 🔗 相关链接console.log(`价格: $${ethers.utils.formatEther(priceInfo.price)}`);

console.log(`发布时间: ${new Date(priceInfo.publishTime * 1000).toISOString()}`);

- [Hardhat 文档](https://hardhat.org/docs)```

- [OpenZeppelin 文档](https://docs.openzeppelin.com/)

- [Pyth Network](https://pyth.network/)### 批量价格更新

- [Ethers.js 文档](https://docs.ethers.org/v6/)

- [Solidity 文档](https://docs.soliditylang.org/)```javascript

const { fetchUpdateData } = require('./utils/getPythUpdateData');

## ⚠️ 免责声明

// 获取多个股票的价格更新数据

本项目仅用于教育和研究目的。在生产环境中使用前，请进行充分的安全审计。数字资产投资存在风险，请谨慎投资。const symbols = ["AAPL", "GOOGL", "MSFT"];

const updateData = await fetchUpdateData(symbols);

---

// 计算更新费用

**联系方式**: 如有问题或建议，请通过GitHub Issues联系我们。const fee = await oracleAggregator.getUpdateFee(updateData);

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
