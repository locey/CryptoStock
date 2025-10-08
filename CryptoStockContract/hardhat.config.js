require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // viaIR: true, // 禁用 viaIR 以避免兼容性问题
    },
  },
  // 全局 gas 配置，适用于所有网络
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  // 默认网络配置 - 使用hardhat内置网络
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,  // 增加到12M
      gasPrice: "auto",
      blockGasLimit: 30000000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_URL || "https://rpc.sepolia.org",
      accounts: [
        process.env.PRIVATE_KEY_1,
        process.env.PRIVATE_KEY_2,
        process.env.PRIVATE_KEY_3,
        process.env.PRIVATE_KEY_4
      ].filter(key => key !== undefined), // 过滤掉未定义的私钥
      chainId: 11155111,
      gas: 8000000, // 增加到 8M gas limit
      gasPrice: 20000000000, // 固定 20 Gwei (而不是 auto)
      gasMultiplier: 2.5, // 增加 gas 价格乘数到 2.5
      timeout: 600000, // 增加到 10分钟超时
      confirmations: 3, // 增加到 3个区块确认
      // 添加 EIP-1559 支持
      maxFeePerGas: 100000000000, // 100 Gwei
      maxPriorityFeePerGas: 5000000000, // 5 Gwei
    }
  },

  // Etherscan 验证配置 - hardhat-verify v2 格式
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },

  // 路径配置
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
