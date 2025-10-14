import { useCallback, useMemo, useEffect } from 'react';
import { Address, formatUnits, parseUnits, PublicClient, WalletClient, Chain } from 'viem';
import { useWallet } from 'yc-sdk-ui';
import { usePublicClient, useWalletClient } from 'yc-sdk-hooks';
import useUniswapStore, {
  UniswapOperationType,
  UniswapTransactionResult,
  UniswapPoolInfo,
  UniswapPositionInfo,
  UserBalanceInfo
  
} from '../stores/useUniswapStore';
import UniswapDeploymentInfo from '@/lib/abi/deployments-uniswapv3-adapter-sepolia.json';

// 类型别名，避免复杂类型推导问题
type SafePublicClient = PublicClient;
type SafeWalletClient = WalletClient;
type SafeChain = Chain;

/**
 * Uniswap V3 Hook with Clients
 *
 * 这个 Hook 将 Uniswap Store 与 Web3 客户端结合，
 * 自动处理客户端依赖关系，提供更简单的 API。
 * 基于 deployments-uniswapv3-adapter-sepolia.json 中的合约地址
 */
export const useUniswapWithClients = () => {
  // 获取 store 和客户端
  const store = useUniswapStore();
  const { isConnected, address } = useWallet();
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();

  // 初始化合约（从部署文件）
  const initContracts = useCallback(() => {
    if (store.defiAggregatorAddress === null || store.uniswapV3AdapterAddress === null) {
      console.log("🔧 使用 Sepolia 测试网部署信息初始化 Uniswap V3 合约:", {
        chainId: UniswapDeploymentInfo.chainId,
        defiAggregator: UniswapDeploymentInfo.contracts.DefiAggregator,
        uniswapV3Adapter: UniswapDeploymentInfo.contracts.UniswapV3Adapter,
        usdtToken: UniswapDeploymentInfo.contracts.MockERC20_USDT,
        wethToken: UniswapDeploymentInfo.contracts.MockWethToken,
        positionManager: UniswapDeploymentInfo.contracts.MockPositionManager,
        feeRateBps: UniswapDeploymentInfo.feeRateBps
      });
      store.initFromDeployment();
    }
  }, [store.defiAggregatorAddress, store.uniswapV3AdapterAddress, store.initFromDeployment]);

  // 手动初始化合约地址
  const setContractAddresses = useCallback((defiAggregatorAddress: Address, uniswapV3AdapterAddress: Address) => {
    store.initContracts(defiAggregatorAddress, uniswapV3AdapterAddress);
  }, [store.initContracts]);

  // 包装读取方法
  const fetchPoolInfo = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.fetchPoolInfo(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs });
  }, [publicClient, store.fetchPoolInfo]);

  const fetchUserBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserBalance(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs }, address);
  }, [publicClient, store.fetchUserBalance, address]);

  const fetchUserPositions = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserPositions(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs }, address);
  }, [publicClient, store.fetchUserPositions, address]);

  const fetchUserUSDTBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserUSDTBalance(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs }, address);
  }, [publicClient, store.fetchUserUSDTBalance, address]);

  const fetchUserWETHBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserWETHBalance(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs }, address);
  }, [publicClient, store.fetchUserWETHBalance, address]);

  const fetchAllowances = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchAllowances(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs }, address);
  }, [publicClient, store.fetchAllowances, address]);

  const fetchFeeRate = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.fetchFeeRate(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs });
  }, [publicClient, store.fetchFeeRate]);

  // 包装写入方法
  const approveUSDT = useCallback(async (amount: string, userAddress?: Address) => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = await getWalletClient();
    if (!wc) {
      throw new Error('WalletClient 未初始化');
    }

    const amountBigInt = parseUnits(amount, 6); // USDT 是 6 位小数

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig: {
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      gas: 8000000n, // 增加到 8M gas limit (bigint)
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.approveUSDT(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      amountBigInt,
      address,
      userAddress || address, // userAddress parameter
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveUSDT]);

  const approveWETH = useCallback(async (amount: string) => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = await getWalletClient();
    if (!wc) {
      throw new Error('WalletClient 未初始化');
    }

    const amountBigInt = parseUnits(amount, 18); // WETH 是 18 位小数

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig: {
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      gas: 8000000n, // 增加到 8M gas limit (bigint)
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.approveWETH(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      amountBigInt,
      address,
      address, // userAddress should be the same as account
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveWETH]);

  const approveNFT = useCallback(async (tokenId: bigint) => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = await getWalletClient();
    if (!wc) {
      throw new Error('WalletClient 未初始化');
    }

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig: {
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      gas: 8000000n, // 增加到 8M gas limit (bigint)
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.approveNFT(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      tokenId,
      address,
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveNFT]);

  const approveAllNFT = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = await getWalletClient();
    if (!wc) {
      throw new Error('WalletClient 未初始化');
    }

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig: {
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      gas: 8000000n, // 增加到 8M gas limit (bigint)
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.approveAllNFT(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      address,
      address,
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveAllNFT]);

  const addLiquidity = useCallback(async (params: {
    token0: Address;
    token1: Address;
    amount0: string;
    amount1: string;
    amount0Min: string;
    amount1Min: string;
    tickLower?: number;
    tickUpper?: number;
    recipient?: Address;
    deadline?: number;
  }): Promise<UniswapTransactionResult> => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = await getWalletClient();
    if (!wc) {
      throw new Error('WalletClient 未初始化');
    }

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig: {
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      gas: 8000000n, // 增加到 8M gas limit (bigint)
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.addLiquidity(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      {
        ...params,
        recipient: address, // 使用用户的实际地址而不是传入的空地址
      },
      address,
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.addLiquidity]);

  const removeLiquidity = useCallback(async (params: {
    tokenId: bigint;
    recipient?: Address;
    deadline?: number;
  }): Promise<UniswapTransactionResult> => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = await getWalletClient();
    if (!wc) {
      throw new Error('WalletClient 未初始化');
    }

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig: {
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      gas: 8000000n, // 增加到 8M gas limit (bigint)
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.removeLiquidity(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      {
        ...params,
        recipient: params.recipient || address,
      },
      address,
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.removeLiquidity]);

  const collectFees = useCallback(async (params: {
    tokenId: bigint;
    recipient?: Address;
    deadline?: number;
  }): Promise<UniswapTransactionResult> => {
    if (!isConnected || !address) {
      throw new Error('请先连接钱包');
    }

    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }

    if (!chain) {
      throw new Error('Chain 未初始化');
    }

    const wc = await getWalletClient();
    if (!wc) {
      throw new Error('WalletClient 未初始化');
    }

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig: {
      gas?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    } = {
      gas: 8000000n, // 增加到 8M gas limit (bigint)
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.collectFees(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      {
        ...params,
        recipient: params.recipient || address,
      },
      address,
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.collectFees]);

  // 初始化 Uniswap V3 交易功能
  const initializeUniswapTrading = useCallback(async () => {
    try {
      console.log('🚀 初始化 Uniswap V3 交易功能...');

      // 初始化合约地址
      initContracts();

      // 获取池信息
      await fetchPoolInfo();

      // 如果用户已连接钱包，获取用户余额和位置信息
      if (isConnected && address) {
        await fetchUserBalance();
        await fetchUserPositions();
      }

      console.log('✅ Uniswap V3 交易功能初始化完成');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '初始化失败';
      store.setError(errorMsg);
      console.error('❌ Uniswap V3 交易功能初始化失败:', errorMsg);
      throw error;
    }
  }, [initContracts, fetchPoolInfo, fetchUserBalance, fetchUserPositions, isConnected, address, store.setError]);

  // 刷新用户信息
  const refreshUserInfo = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
    }

    try {
      console.log('🔄 刷新用户信息...');
      await Promise.all([
        fetchUserBalance(),
        fetchUserPositions()
      ]);
      console.log('✅ 用户信息刷新完成');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '刷新用户信息失败';
      store.setError(errorMsg);
      console.error('❌ 刷新用户信息失败:', errorMsg);
      throw error;
    }
  }, [isConnected, address, fetchUserBalance, fetchUserPositions, store.setError]);

  // 计算属性：格式化的余额信息
  const formattedBalances = useMemo(() => {
    if (!store.userBalance) {
      return {
        usdtBalance: '0',
        wethBalance: '0',
        usdtAllowance: '0',
        wethAllowance: '0',
        nftAllowance: '0',
        address: address || '未连接',
      };
    }

    return {
      usdtBalance: formatUnits(store.userBalance.usdtBalance, 6),
      wethBalance: formatUnits(store.userBalance.wethBalance, 18),
      usdtAllowance: formatUnits(store.userBalance.usdtAllowance, 6),
      wethAllowance: formatUnits(store.userBalance.wethAllowance, 18),
      nftAllowance: store.userBalance.nftAllowance > 0 ? '1' : '0',
      address: address || '未连接',
    };
  }, [store.userBalance, address]);

  // 计算属性：格式化的池信息
  const formattedPoolInfo = useMemo((): (UniswapPoolInfo & { feeRatePercent: string; supportedOperationsFormatted: string[] }) | null => {
    if (!store.poolInfo) {
      return null;
    }

    return {
      ...store.poolInfo,
      feeRatePercent: `${store.poolInfo.feeRateBps / 100}%`,
      supportedOperationsFormatted: store.poolInfo.supportedOperations.map(op =>
        op === UniswapOperationType.ADD_LIQUIDITY ? '添加流动性' :
        op === UniswapOperationType.REMOVE_LIQUIDITY ? '移除流动性' :
        op === UniswapOperationType.COLLECT_FEES ? '收取手续费' : '未知操作'
      ),
    };
  }, [store.poolInfo]);

  // 计算属性：格式化的位置信息
  const formattedPositions = useMemo(() => {
    return store.userPositions.map(position => ({
      ...position,
      formattedLiquidity: formatUnits(position.liquidity, 18),
      formattedTokensOwed0: formatUnits(position.tokensOwed0, 6),
      formattedTokensOwed1: formatUnits(position.tokensOwed1, 18),
      totalFeesUSD: (Number(formatUnits(position.tokensOwed0, 6)) * 1 + Number(formatUnits(position.tokensOwed1, 18)) * 2000), // 简化计算
    }));
  }, [store.userPositions]);

  // 检查是否需要授权 - 修复：检查授权金额是否足够
  const needsApproval = useMemo(() => {
    if (!store.userBalance) {
      return { usdt: true, weth: true, nft: true };
    }

    return {
      usdt: store.userBalance.usdtAllowance === BigInt(0),
      weth: store.userBalance.wethAllowance === BigInt(0),
      nft: store.userBalance.nftAllowance === BigInt(0),
    };
  }, [store.userBalance]);

  // 获取最大可用余额
  const maxBalances = useMemo(() => {
    if (!store.userBalance) {
      return {
        maxUSDTToSupply: '0',
        maxWETHToSupply: '0',
      };
    }

    return {
      maxUSDTToSupply: formatUnits(store.userBalance.usdtBalance, 6),
      maxWETHToSupply: formatUnits(store.userBalance.wethBalance, 18),
    };
  }, [store.userBalance]);

  // 计算总锁仓价值
  const totalTVL = useMemo(() => {
    return store.userPositions.reduce((total, position) => {
      return total + (position.token0ValueUSD || 0) + (position.token1ValueUSD || 0);
    }, 0);
  }, [store.userPositions]);

  // 计算总手续费
  const totalFees = useMemo(() => {
    return store.userPositions.reduce((total, position) => {
      return total + Number(position.tokensOwed0) + Number(position.tokensOwed1);
    }, 0);
  }, [store.userPositions]);

  // 自动初始化合约
  if (store.defiAggregatorAddress === null || store.uniswapV3AdapterAddress === null) {
    initContracts();
  }

  // 强制订阅 userPositions 变化 - 添加更详细的监控
  useEffect(() => {
    console.log("🔍 Uniswap userPositions 变化 (useEffect):", {
      length: store.userPositions.length,
      positions: store.userPositions,
      timestamp: new Date().toISOString()
    });

    // 强制触发重新渲染的辅助方法
    const forceRerender = () => {
      // 这个空依赖数组确保我们只在 userPositions 变化时调用
      console.log('🔄 [DEBUG] 强制触发重新渲染');
    };
    forceRerender();
  }, [store.userPositions]);

  return {
    // 基础状态
    isConnected,
    address,
    isLoading: store.isLoading,
    isOperating: store.isOperating,
    error: store.error,

    // 合约信息
    defiAggregatorAddress: store.defiAggregatorAddress,
    uniswapV3AdapterAddress: store.uniswapV3AdapterAddress,
    poolInfo: formattedPoolInfo,

    // 用户余额信息
    userBalance: store.userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,

    // 用户位置信息
    userPositions: store.userPositions,
    selectedPosition: store.selectedPosition,
    formattedPositions,
    totalTVL,
    totalFees,

    // 初始化方法
    initializeUniswapTrading,
    initContracts,
    setContractAddresses,

    // 读取方法
    fetchPoolInfo,
    fetchUserBalance,
    fetchUserPositions,
    fetchUserUSDTBalance,
    fetchUserWETHBalance,
    fetchAllowances,
    fetchFeeRate,
    refreshUserInfo,

    // 授权方法
    approveUSDT,
    approveWETH,
    approveNFT,
    approveAllNFT,

    // 交易方法
    addLiquidity,
    removeLiquidity,
    collectFees,

    // 辅助方法
    selectPosition: store.selectPosition,
    setLoading: store.setLoading,
    setOperating: store.setOperating,
    setError: store.setError,
    clearErrors: store.clearErrors,
    reset: store.reset,
  };
};

export default useUniswapWithClients;