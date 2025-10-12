import { useCallback } from 'react';
import { Address, parseAbi } from 'viem';
import { useWallet } from 'yc-sdk-ui';
import { usePublicClient, useWalletClient } from 'yc-sdk-hooks';
import useTokenFactoryStore, {
  CreateTokenParams,
  TransactionResult,
  TokenInfo,
  DeploymentInfo
} from '../stores/useTokenFactoryStore';
import deployments from '@/lib/abi/deployments-uups-sepolia.json';

/**
 * TokenFactory Hook with Clients
 *
 * 这个 Hook 将 TokenFactory Store 与 Web3 客户端结合，
 * 自动处理客户端依赖关系，提供更简单的 API。
 */
export const useTokenFactoryWithClients = () => {
  // 获取 store 和客户端
  const store = useTokenFactoryStore();
  const { isConnected, address, provider } = useWallet();
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();

  // 初始化合约（从部署文件）
  const initContract = useCallback(() => {
    if (store.contractAddress === null) {
      // 优先使用 Sepolia 测试网部署信息
      const deploymentInfo = deployments as DeploymentInfo;
      console.log("🔧 使用 Sepolia 测试网部署信息初始化 TokenFactory:", {
        chainId: deploymentInfo.chainId,
        tokenFactory: deploymentInfo.contracts?.TokenFactory?.proxy
      });
      store.initFromDeployment(deploymentInfo);
    }
  }, [store.contractAddress, store.initFromDeployment]);

  // 手动初始化合约地址
  const setContractAddress = useCallback((contractAddress: Address) => {
    store.initContract(contractAddress);
  }, [store.initContract]);

  // 包装读取方法
  const fetchAllTokens = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    // 类型断言以解决类型不匹配问题
    return store.fetchAllTokens(publicClient as any, address);
  }, [publicClient, store.fetchAllTokens, address]);

  const fetchTokensMapping = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.fetchTokensMapping(publicClient as any);
  }, [publicClient, store.fetchTokensMapping]);

  const getTokenAddress = useCallback(async (symbol: string) => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.getTokenAddress(publicClient as any, symbol);
  }, [publicClient, store.getTokenAddress]);

  const getTokensCount = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.getTokensCount(publicClient as any);
  }, [publicClient, store.getTokensCount]);

  // 包装写入方法
  const createToken = useCallback(async (params: CreateTokenParams): Promise<TransactionResult> => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = getWalletClient();

    return store.createToken(publicClient as any, wc as any, chain, params, address);
  }, [publicClient, getWalletClient, chain, address, isConnected, store.createToken]);

  // 批量获取代币信息 - 现在直接使用 store 中的数据
  const fetchTokensInfo = useCallback(async (symbols?: string[]): Promise<TokenInfo[]> => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    // 调用 fetchAllTokens 来获取和更新所有代币信息（包含用户余额）
    console.log("👤 检查用户连接状态:", { address: address, isConnected: isConnected });
    await store.fetchAllTokens(publicClient as any, address);

    // 从 store 中获取所有代币信息
    let allTokens = store.allTokens;

    // 如果没有获取到任何代币，返回空数组
    if (!allTokens || allTokens.length === 0) {
      console.log('没有从合约获取到代币');
      return [];
    }

    // 如果提供了 symbols，则过滤
    if (symbols && symbols.length > 0) {
      allTokens = allTokens.filter(token => symbols.includes(token.symbol));
    }

    // 现在用户余额已经在 fetchAllTokens 中获取了，直接返回
    console.log("👤 代币信息获取完成，用户余额已包含在结果中");
    return allTokens;
  }, [publicClient, store.fetchAllTokens, address]);

  // 检查代币是否存在
  const tokenExists = useCallback(async (symbol: string): Promise<boolean> => {
    try {
      const tokenAddress = await getTokenAddress(symbol);
      return tokenAddress !== '0x0000000000000000000000000000000000000000';
    } catch (error) {
      return false;
    }
  }, [getTokenAddress]);

  // 自动初始化合约
  if (store.contractAddress === null) {
    initContract();
  }

  return {
    // 状态
    contractAddress: store.contractAddress,
    allTokens: store.allTokens,
    tokenBySymbol: store.tokenBySymbol,
    isLoading: store.isLoading,
    isCreatingToken: store.isCreatingToken,
    error: store.error,
    isConnected,
    address,

    // 初始化方法
    initContract,
    setContractAddress,

    // 读取方法
    fetchAllTokens,
    fetchTokensMapping,
    fetchTokensInfo,
    getTokenAddress,
    getTokensCount,
    tokenExists,
    fetchUserBalance: store.fetchUserBalance,

    // 写入方法
    createToken,

    // 辅助方法
    setLoading: store.setLoading,
    setCreatingToken: store.setCreatingToken,
    setError: store.setError,
    clearErrors: store.clearErrors,
    reset: store.reset,
  };
};

export default useTokenFactoryWithClients;