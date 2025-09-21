require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
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
    }
  },
  
  // hardhat-deploy 配置
  namedAccounts: {
    deployer: {
      default: 0, // 默认使用第一个账户作为部署者
      1: 0, // mainnet 上使用第一个账户
      11155111: 0, // sepolia 上使用第一个账户
    },
    user1: {
      default: 1, // 默认使用第二个账户作为用户1
    },
    user2: {
      default: 2, // 默认使用第三个账户作为用户2
    },
    user3: {
      default: 3, // 默认使用第四个账户作为用户3
    },
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
    deploy: "./deploy",
    deployments: "./deployments",
  },
};
