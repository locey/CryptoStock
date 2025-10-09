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
      url: process.env.SEPOLIA_URL || "https://rpc2.sepolia.org",
      accounts: [
        process.env.PRIVATE_KEY_1,
        process.env.PRIVATE_KEY_2,
        process.env.PRIVATE_KEY_3,
        process.env.PRIVATE_KEY_4
      ].filter(key => key !== undefined), // 过滤掉未定义的私钥
      chainId: 11155111,
      timeout: 120000, // 减少到 2分钟超时
      confirmations: 2, // 减少到 2个区块确认
      // 使用 EIP-1559 格式 (推荐)
      maxFeePerGas: 50000000000, // 50 Gwei (降低费用)
      maxPriorityFeePerGas: 2000000000, // 2 Gwei
      // 备用连接配置
      retry: {
        count: 3,
        delay: 2000, // 2秒重试延迟
      }
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
