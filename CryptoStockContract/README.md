# Metanode Stake

Metanode质押智能合约项目，提供安全、高效的代币质押功能。

## 项目概述

这是一个基于以太坊的质押合约项目，用户可以质押代币获得奖励。项目采用 Hardhat 开发框架，集成了完整的测试、部署和验证流程。

## 功能特性

- 🔒 **安全质押**: 采用 OpenZeppelin 合约库确保安全性
- 💰 **奖励机制**: 灵活的奖励分发算法
- ⏰ **锁定期管理**: 支持不同的锁定期设置
- 🔄 **自动复投**: 可选的奖励自动复投功能
- 📊 **实时查询**: 质押状态和奖励实时查询

## 技术栈

- **Solidity**: ^0.8.20
- **Hardhat**: 开发框架
- **OpenZeppelin**: 安全合约库
- **Ethers.js**: 以太坊交互库
- **Hardhat Deploy**: 部署管理
- **Chai**: 测试框架

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入相应配置：

```bash
cp .env.example .env
```

### 3. 编译合约

```bash
npm run compile
```

### 4. 运行测试

```bash
npm test
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
Metanode_Stake/
├── contracts/          # 智能合约
├── deploy/             # 部署脚本 (hardhat-deploy)
├── scripts/            # 工具脚本
├── test/               # 测试文件
├── ignition/           # Ignition 部署模块
├── artifacts/          # 编译产物
├── cache/              # 缓存文件
├── deployments/        # 部署记录
├── hardhat.config.js   # Hardhat 配置
├── package.json        # 项目配置
└── README.md          # 项目说明
```

## 合约架构

### 核心合约

- `MetanodeStake.sol`: 主质押合约
- `RewardToken.sol`: 奖励代币合约
- `StakeToken.sol`: 质押代币合约

### 安全特性

- 重入攻击防护
- 权限访问控制
- 数学运算溢出保护
- 紧急暂停机制

## 测试覆盖

项目包含完整的测试套件：

- 单元测试
- 集成测试
- 边界条件测试
- 安全测试

运行测试覆盖率检查：

```bash
npm run coverage
```

## 部署指南

### 网络配置

项目支持多个网络：

- `localhost`: 本地开发网络
- `sepolia`: Sepolia 测试网
- `sepolia-fast`: Sepolia 快速配置
- `mainnet`: 以太坊主网

### 部署步骤

1. 配置网络参数
2. 准备部署账户
3. 设置合约参数
4. 执行部署脚本
5. 验证合约代码

## Gas 优化

- 使用 Solidity 0.8.20 优化器
- 合约大小优化
- 函数调用优化
- 存储布局优化

## 安全审计

建议在主网部署前进行：

- 代码审计
- 安全测试
- Bug 赏金计划
- 社区验证

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 官网: [待补充]
- Twitter: [待补充]
- Discord: [待补充]
- 技术支持: [待补充]

## 版本历史

- v1.0.0: 初始版本
  - 基础质押功能
  - 奖励分发机制
  - 测试套件

---

⚠️ **免责声明**: 本项目仅供学习和研究使用，使用前请仔细阅读合约代码并进行充分测试。
