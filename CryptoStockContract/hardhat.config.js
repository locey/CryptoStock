require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
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
      gas: 3000000,
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
      gas: 5000000, // 5M gas limit (正常水平)
      gasPrice: 2000000000, // 2 Gwei (正常水平，Sepolia测试网)
      timeout: 300000, // 5分钟超时
    }
  },

  // Etherscan 验证配置
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
      mainnet: process.env.ETHERSCAN_API_KEY,
    }
  },

  // 路径配置
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
