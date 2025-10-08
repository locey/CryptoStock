import { useCallback, useMemo } from 'react';
import { Address, formatUnits, parseUnits, PublicClient, WalletClient, Chain } from 'viem';
import { useWallet } from 'ycdirectory-ui';
import { usePublicClient, useWalletClient } from 'ycdirectory-hooks';
import CompoundDeploymentInfo from '@/lib/abi/deployments-compound-adapter-sepolia.json';
import useCompoundStore, {
  CompoundOperationType,
  CompoundTransactionResult,
  CompoundPoolInfo,
} from '@/lib/stores/useCompoundStore';

// ==================== 导出 Hook ====================
export const useCompoundWithClients = () => {
  // 获取 store 和客户端
  const store = useCompoundStore();
  const { isConnected, address } = useWallet();
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();

  // 初始化合约（从部署文件）
  const initContracts = useCallback(() => {
    if (store.defiAggregatorAddress === null || store.compoundAdapterAddress === null) {
      console.log("🔧 使用 Sepolia 测试网部署信息初始化 Compound 合约:", {
        chainId: CompoundDeploymentInfo.chainId,
        defiAggregator: CompoundDeploymentInfo.contracts.DefiAggregator,
        compoundAdapter: CompoundDeploymentInfo.contracts.CompoundAdapter,
        cUsdtToken: CompoundDeploymentInfo.contracts.MockCToken_cUSDT,
        feeRateBps: CompoundDeploymentInfo.feeRateBps
      });
      store.initFromDeployment();
    }
  }, [store.defiAggregatorAddress, store.compoundAdapterAddress, store.initFromDeployment]);

  // 手动初始化合约地址
  const setContractAddresses = useCallback((defiAggregatorAddress: Address, compoundAdapterAddress: Address) => {
    store.initContracts(defiAggregatorAddress, compoundAdapterAddress);
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

  const fetchUserUSDTBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserUSDTBalance(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs }, address);
  }, [publicClient, store.fetchUserUSDTBalance, address]);

  const fetchUserCUSDTBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserCUSDTBalance(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs }, address);
  }, [publicClient, store.fetchUserCUSDTBalance, address]);

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

  const fetchCurrentAPY = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.fetchCurrentAPY(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs });
  }, [publicClient, store.fetchCurrentAPY]);

  const fetchCurrentExchangeRate = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.fetchCurrentExchangeRate(publicClient as PublicClient & { getLogs: typeof publicClient.getLogs });
  }, [publicClient, store.fetchCurrentExchangeRate]);

  // 包装写入方法
  const approveUSDT = useCallback(async (amount: string, userAddress?: Address) => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
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
      userAddress || address,
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveUSDT]);

  const approveCUSDT = useCallback(async (amount: string) => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
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

    return store.approveCUSDT(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      amountBigInt,
      address,
      gasConfig
    );
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveCUSDT]);

  const supplyUSDT = useCallback(async (amount: string): Promise<CompoundTransactionResult> => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
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

    const receipt = await store.supplyUSDT(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      amountBigInt,
      address,
      gasConfig
    );

    return {
      success: true,
      outputAmounts: [amountBigInt],
      returnData: '0x' as Hex,
      message: 'Compound 存款成功',
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }, [isConnected, address, publicClient, chain, getWalletClient, store.supplyUSDT]);

  const redeemUSDT = useCallback(async (amount: string): Promise<CompoundTransactionResult> => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
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

    const receipt = await store.redeemUSDT(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      amountBigInt,
      address,
      gasConfig
    );

    return {
      success: true,
      outputAmounts: [amountBigInt],
      returnData: '0x' as Hex,
      message: 'Compound 提取成功',
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }, [isConnected, address, publicClient, chain, getWalletClient, store.redeemUSDT]);

  const sellUSDT = useCallback(async (amount: string): Promise<CompoundTransactionResult> => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
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

    const receipt = await store.sellUSDT(
      publicClient as PublicClient & { getLogs: typeof publicClient.getLogs },
      wc as WalletClient,
      chain,
      amountBigInt,
      address,
      gasConfig
    );

    return {
      success: true,
      outputAmounts: [amountBigInt],
      returnData: '0x' as Hex,
      message: 'Compound 卖出成功',
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }, [isConnected, address, publicClient, chain, getWalletClient, store.sellUSDT]);

  // 初始化 Compound 交易功能
  const initializeCompoundTrading = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
    }

    console.log('🔄 初始化 Compound 交易功能...');

    // 检查是否已初始化合约
    await initContracts();

    // 获取池信息
    await fetchPoolInfo();

    // 获取用户余额
    await fetchUserBalance();

    console.log('✅ Compound 交易功能初始化完成');
  }, [isConnected, address, initContracts, fetchPoolInfo, fetchUserBalance]);

  // 格式化余额显示
  const formattedUSDTBalance = useMemo(() => {
    return store.userBalance?.formattedUsdtBalance || '0';
  }, [store.userBalance]);

  const formattedCUSDTBalance = useMemo(() => {
    return store.userBalance?.formattedCUsdtBalance || '0';
  }, [store.userBalance]);

  const currentAPY = useMemo(() => {
    if (!store.poolInfo?.currentAPY) return '0';
    return formatUnits(store.poolInfo.currentAPY, 18); // APY 通常是 18 位小数
  }, [store.poolInfo]);

  const currentExchangeRate = useMemo(() => {
    if (!store.poolInfo?.currentExchangeRate) return '0';
    return formatUnits(store.poolInfo.currentExchangeRate, 18); // 汇率通常是 18 位小数
  }, [store.poolInfo]);

  // 检查授权状态
  const needsUSDTApproval = useMemo(() => {
    if (!store.userBalance?.usdtAllowance || !store.userBalance?.usdtBalance) {
      return true;
    }
    return store.userBalance.usdtAllowance < store.userBalance.usdtBalance;
  }, [store.userBalance]);

  const needsCUSDTApproval = useMemo(() => {
    if (!store.userBalance?.cUsdtAllowance || !store.userBalance?.cUsdtBalance) {
      return true;
    }
    return store.userBalance.cUsdtAllowance < store.userBalance.cUsdtBalance;
  }, [store.userBalance]);

  // 清理错误状态
  const clearError = useCallback(() => {
    store.clearError();
  }, [store.clearError]);

  return {
    // 状态
    isConnected,
    address,
    poolInfo: store.poolInfo,
    userBalance: store.userBalance,
    isLoading: store.isLoading,
    isOperating: store.isOperating,
    error: store.error,

    // 格式化数据
    formattedUSDTBalance,
    formattedCUSDTBalance,
    currentAPY,
    currentExchangeRate,

    // 授权状态
    needsUSDTApproval,
    needsCUSDTApproval,

    // 初始化方法
    initContracts,
    setContractAddresses,
    initializeCompoundTrading,

    // 读取方法
    fetchPoolInfo,
    fetchUserBalance,
    fetchUserUSDTBalance,
    fetchUserCUSDTBalance,
    fetchAllowances,
    fetchFeeRate,
    fetchCurrentAPY,
    fetchCurrentExchangeRate,

    // 写入方法
    approveUSDT,
    approveCUSDT,
    supplyUSDT,
    redeemUSDT,
    sellUSDT,

    // 状态管理
    clearError,
    reset: store.reset,
  };
};

// 导出 store hook 以便直接使用
export { useCompoundStore };