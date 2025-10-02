// 合约地址配置
export const NETWORK_CONFIG = {
  // 本地 Hardhat 网络
  localhost: {
    chainId: 31337,
    name: "localhost",
    rpcUrl: "http://127.0.0.1:8545",
    contracts: {
      oracleAggregator: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6", // 刚部署的地址
      usdt: "0x0165878A594ca255338adfa4d48449f69242Eb8F", // 刚部署的地址
      stockTokenImplementation: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318", // StockToken implementation contract
    }
  },

  // Sepolia 测试网
  sepolia: {
    chainId: 11155111,
    name: "sepolia",
    rpcUrl: "https://sepolia.infura.io/v3/",
    contracts: {
      oracleAggregator: "0x9e2fa29C0A79dF98955be0e53ADbC45185ECD71a",
      usdt: "0xd7C597Cf30fb56162AEDAe8a52927B7CE4076e5B",
      stockTokenImplementation: "0x27B8A99eE9ad97a3e7d508451af26f1532545A14", // StockToken implementation contract
    }
  },

  // 以太坊主网
  mainnet: {
    chainId: 1,
    name: "mainnet",
    rpcUrl: "https://mainnet.infura.io/v3/",
    contracts: {
      oracleAggregator: "0x34448d44CcFc49C542c237C46258D64a5C198572", // 待部署
      usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // 真实 USDT
      stockTokenImplementation: "0x0000000000000000000000000000000000000000", // 待部署
    }
  }
};

// 获取当前网络配置
export function getNetworkConfig(chainId: number) {
  const network = Object.values(NETWORK_CONFIG).find(
    config => config.chainId === chainId
  );

  if (!network) {
    throw new Error(`不支持的网络: ${chainId}`);
  }

  return network;
}

// 默认导出 Sepolia 测试网配置
export const DEFAULT_CONFIG = NETWORK_CONFIG.sepolia;