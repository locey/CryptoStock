/**
 * 动态加载 Uniswap V3 合约配置
 * 从部署文件中读取地址信息
 */

import deploymentsConfig from '../abi/deployments-uniswapv3-adapter-sepolia.json';

// 类型定义
interface ContractDeployment {
  network: string;
  chainId: string;
  deployer: string;
  timestamp: string;
  feeRateBps: number;
  basedOn?: string;
  contracts: {
    DefiAggregator: string;
    MockERC20_USDT: string;
    MockWethToken: string;
    MockPositionManager: string;
    UniswapV3Adapter: string;
    UniswapV3Adapter_Implementation: string;
  };
  adapterRegistrations: {
    uniswapv3: string;
  };
  notes?: {
    description?: string;
    reusedContracts?: string[];
    newContracts?: string[];
  };
}

// 加载并验证部署配置
export function loadUniswapDeployment(): ContractDeployment {
  if (!deploymentsConfig) {
    throw new Error('无法加载 Uniswap V3 部署配置文件');
  }

  // 验证必要的字段
  const requiredContracts = [
    'DefiAggregator',
    'MockERC20_USDT',
    'MockWethToken',
    'MockPositionManager',
    'UniswapV3Adapter'
  ];

  const missingContracts = requiredContracts.filter(
    contract => !deploymentsConfig.contracts[contract as keyof typeof deploymentsConfig.contracts]
  );

  if (missingContracts.length > 0) {
    throw new Error(`缺少必要的合约地址: ${missingContracts.join(', ')}`);
  }

  return deploymentsConfig as ContractDeployment;
}

// 获取合约地址
export function getContractAddresses() {
  const deployment = loadUniswapDeployment();

  return {
    network: deployment.network,
    chainId: parseInt(deployment.chainId),
    contracts: deployment.contracts,
    adapterRegistrations: deployment.adapterRegistrations,
    feeRateBps: deployment.feeRateBps,
  };
}

// 获取支持的代币配置
export function getSupportedTokens() {
  const { contracts } = getContractAddresses();

  return {
    USDT: {
      address: contracts.MockERC20_USDT,
      symbol: 'USDT',
      name: 'Mock USDT',
      decimals: 6,
    },
    WETH: {
      address: contracts.MockWethToken,
      symbol: 'WETH',
      name: 'Mock WETH',
      decimals: 18,
    },
  };
}

// 获取适配器地址
export function getAdapterAddress(adapterName: string): string {
  const { adapterRegistrations } = getContractAddresses();

  if (!adapterRegistrations[adapterName as keyof typeof adapterRegistrations]) {
    throw new Error(`未找到适配器: ${adapterName}`);
  }

  return adapterRegistrations[adapterName as keyof typeof adapterRegistrations];
}

// 操作类型枚举
export enum OperationType {
  ADD_LIQUIDITY = 2,
  REMOVE_LIQUIDITY = 3,
  COLLECT_FEES = 18,
}

// 价格区间预设
export const PRICE_RANGE_PRESETS = {
  NARROW: { tickLower: -3000, tickUpper: 3000, name: '窄幅' },
  STANDARD: { tickLower: -60000, tickUpper: 60000, name: '标准' },
  WIDE: { tickLower: -120000, tickUpper: 120000, name: '宽幅' },
  FULL: { tickLower: -887220, tickUpper: 887220, name: '全幅' },
};

// 导出配置
export const UNISWAP_CONFIG = {
  ...getContractAddresses(),
  tokens: getSupportedTokens(),
  presets: PRICE_RANGE_PRESETS,
  operations: OperationType,
};