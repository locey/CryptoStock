import { createPublicClient, createWalletClient, custom, http, Address } from 'viem';
import { sepolia, mainnet, polygon, arbitrum } from 'viem/chains';
import { useMemo } from 'react';
import { useWallet } from 'ycdirectory-ui';

// 链配置映射
const chainConfigs = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  11155111: sepolia,
};

// 根据链ID获取链配置
const getChainConfig = (chainId: number) => {
  const config = chainConfigs[chainId as keyof typeof chainConfigs];
  if (!config) {
    console.warn(`⚠️ 未知的链ID: ${chainId}, 默认使用 Sepolia 测试网`);
    return sepolia;
  }
  return config;
};

/**
 * Web3 客户端 Hook
 * 提供公共客户端和钱包客户端
 */
export const useWeb3Clients = () => {
  const { address, provider, chainId, isConnected } = useWallet();

  // 获取当前链配置
  const chain = useMemo(() => {
    return chainId ? getChainConfig(chainId) : sepolia;
  }, [chainId]);

  // 创建公共客户端
  const publicClient = useMemo(() => {
    return createPublicClient({
      chain,
      transport: http(),
    });
  }, [chain]);

  // 创建钱包客户端
  const walletClient = useMemo(() => {
    if (!provider || !address || !isConnected) {
      return null;
    }

    return createWalletClient({
      chain,
      transport: custom(provider),
      account: address as Address,
    });
  }, [provider, address, chain, isConnected]);

  // 获取钱包客户端（如果未连接则抛出错误）
  const getWalletClient = () => {
    if (!walletClient) {
      throw new Error('钱包未连接');
    }
    return walletClient;
  };

  return {
    // 客户端
    publicClient,
    walletClient,
    getWalletClient,

    // 链信息
    chain,
    chainId,

    // 钱包信息
    address,
    isConnected,
  };
};

export default useWeb3Clients;