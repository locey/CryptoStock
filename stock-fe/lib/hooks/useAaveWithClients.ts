import { useCallback, useMemo } from 'react';
import { Address, formatUnits, parseUnits, PublicClient, WalletClient, Chain, GetLogsReturnType } from 'viem';
import { useWallet } from 'ycdirectory-ui';
import { usePublicClient, useWalletClient } from 'ycdirectory-hooks';
import useAaveStore, {
  AaveOperationType,
  AaveTransactionResult,
  AavePoolInfo,
  UserBalanceInfo
} from '../stores/useAaveStore';
import AaveDeploymentInfo from '@/lib/abi/deployments-aave-adapter-sepolia.json';

// 类型别名，避免复杂类型推导问题
type SafePublicClient = PublicClient;
type SafeWalletClient = WalletClient;
type SafeChain = Chain;

/**
 * Aave Hook with Clients
 *
 * 这个 Hook 将 Aave Store 与 Web3 客户端结合，
 * 自动处理客户端依赖关系，提供更简单的 API。
 * 基于 deployments-aave-adapter-sepolia.json 中的合约地址
 */
export const useAaveWithClients = () => {
  // 获取 store 和客户端
  const store = useAaveStore();
  const { isConnected, address } = useWallet();
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();

  // 初始化合约（从部署文件）
  const initContracts = useCallback(() => {
    if (store.defiAggregatorAddress === null || store.aaveAdapterAddress === null) {
      console.log("🔧 使用 Sepolia 测试网部署信息初始化 Aave 合约:", {
        chainId: AaveDeploymentInfo.chainId,
        defiAggregator: AaveDeploymentInfo.contracts.DefiAggregator,
        aaveAdapter: AaveDeploymentInfo.contracts.AaveAdapter,
        usdtToken: AaveDeploymentInfo.contracts.MockERC20_USDT,
        aUsdtToken: AaveDeploymentInfo.contracts.MockAToken_aUSDT,
        feeRateBps: AaveDeploymentInfo.feeRateBps
      });
      store.initFromDeployment();
    }
  }, [store.defiAggregatorAddress, store.aaveAdapterAddress, store.initFromDeployment]);

  // 手动初始化合约地址
  const setContractAddresses = useCallback((defiAggregatorAddress: Address, aaveAdapterAddress: Address) => {
    store.initContracts(defiAggregatorAddress, aaveAdapterAddress);
  }, [store.initContracts]);

  // 包装读取方法
  const fetchPoolInfo = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.fetchPoolInfo(publicClient);
  }, [publicClient, store.fetchPoolInfo]);

  const fetchUserBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserBalance(publicClient, address);
  }, [publicClient, store.fetchUserBalance, address]);

  const fetchUserUSDTBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserUSDTBalance(publicClient, address);
  }, [publicClient, store.fetchUserUSDTBalance, address]);

  const fetchUserAUSDTBalance = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchUserAUSDTBalance(publicClient, address);
  }, [publicClient, store.fetchUserAUSDTBalance, address]);

  const fetchAllowances = useCallback(async () => {
    if (!publicClient || !address) {
      throw new Error('PublicClient 未初始化或钱包未连接');
    }
    return store.fetchAllowances(publicClient, address);
  }, [publicClient, store.fetchAllowances, address]);

  const fetchFeeRate = useCallback(async () => {
    if (!publicClient) {
      throw new Error('PublicClient 未初始化');
    }
    return store.fetchFeeRate(publicClient);
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
    const gasConfig = {
      gas: 8000000, // 增加到 8M gas limit
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.approveUSDT(publicClient, wc, chain, amountBigInt, address, userAddress || address, gasConfig);
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveUSDT]);

  const approveAUSDT = useCallback(async (amount: string) => {
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

    const amountBigInt = parseUnits(amount, 6); // aUSDT 也是 6 位小数

    // 自定义 gas 设置以提高成功率 (EIP-1559 兼容)
    const gasConfig = {
      gas: 8000000, // 增加到 8M gas limit
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.approveAUSDT(publicClient, wc, chain, amountBigInt, address, gasConfig);
  }, [isConnected, address, publicClient, chain, getWalletClient, store.approveAUSDT]);

  const supplyUSDT = useCallback(async (amount: string): Promise<AaveTransactionResult> => {
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
    const gasConfig = {
      gas: 8000000, // 增加到 8M gas limit
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.supplyUSDT(publicClient, wc, chain, amountBigInt, address, gasConfig);
  }, [isConnected, address, publicClient, chain, getWalletClient, store.supplyUSDT]);

  const withdrawUSDT = useCallback(async (amount: string): Promise<AaveTransactionResult> => {
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
    const gasConfig = {
      gas: 8000000, // 增加到 8M gas limit
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.withdrawUSDT(publicClient, wc, chain, amountBigInt, address, gasConfig);
  }, [isConnected, address, publicClient, chain, getWalletClient, store.withdrawUSDT]);

  const sellUSDT = useCallback(async (amount: string): Promise<AaveTransactionResult> => {
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
    const gasConfig = {
      gas: 8000000, // 增加到 8M gas limit
      maxFeePerGas: 100000000000n, // 100 Gwei
      maxPriorityFeePerGas: 5000000000n, // 5 Gwei
      // 移除 gasPrice 以支持 EIP-1559
    };

    return store.sellUSDT(publicClient, wc, chain, amountBigInt, address, gasConfig);
  }, [isConnected, address, publicClient, chain, getWalletClient, store.sellUSDT]);

  // 初始化 Aave 交易功能
  const initializeAaveTrading = useCallback(async () => {
    try {
      console.log('🚀 初始化 Aave 交易功能...');

      // 初始化合约地址
      initContracts();

      // 获取池信息
      await fetchPoolInfo();

      // 如果用户已连接钱包，获取用户余额信息
      if (isConnected && address) {
        await fetchUserBalance();
      }

      console.log('✅ Aave 交易功能初始化完成');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '初始化失败';
      store.setError(errorMsg);
      console.error('❌ Aave 交易功能初始化失败:', errorMsg);
      throw error;
    }
  }, [initContracts, fetchPoolInfo, fetchUserBalance, isConnected, address, store.setError]);

  // 刷新用户余额信息
  const refreshUserBalance = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error('钱包未连接');
    }

    try {
      console.log('🔄 刷新用户余额信息...');
      await fetchUserBalance();
      console.log('✅ 用户余额信息刷新完成');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '刷新余额失败';
      store.setError(errorMsg);
      console.error('❌ 刷新用户余额失败:', errorMsg);
      throw error;
    }
  }, [isConnected, address, fetchUserBalance, store.setError]);

  // 计算属性：格式化的余额信息
  const formattedBalances = useMemo(() => {
    if (!store.userBalance) {
      return {
        usdtBalance: '0',
        aUsdtBalance: '0',
        usdtAllowance: '0',
        aUsdtAllowance: '0',
        depositedAmount: '0',
        earnedInterest: '0',
      };
    }

    return {
      usdtBalance: formatUnits(store.userBalance.usdtBalance, 6),
      aUsdtBalance: formatUnits(store.userBalance.aUsdtBalance, 6),
      usdtAllowance: formatUnits(store.userBalance.usdtAllowance, 6),
      aUsdtAllowance: formatUnits(store.userBalance.aUsdtAllowance, 6),
      depositedAmount: formatUnits(store.userBalance.depositedAmount, 6),
      earnedInterest: formatUnits(store.userBalance.earnedInterest, 6),
    };
  }, [store.userBalance]);

  // 计算属性：格式化的池信息
  const formattedPoolInfo = useMemo((): (AavePoolInfo & { feeRatePercent: string; supportedOperationsFormatted: string[] }) | null => {
    if (!store.poolInfo) {
      return null;
    }

    return {
      ...store.poolInfo,
      feeRatePercent: `${store.poolInfo.feeRateBps / 100}%`,
      supportedOperationsFormatted: store.poolInfo.supportedOperations.map(op =>
        op === AaveOperationType.DEPOSIT ? '存入' : '提取'
      ),
    };
  }, [store.poolInfo]);

  // 检查是否需要授权
  const needsApproval = useMemo(() => {
    if (!store.userBalance) {
      return { usdt: true, aUsdt: true };
    }

    return {
      usdt: store.userBalance.usdtAllowance === BigInt(0),
      aUsdt: store.userBalance.aUsdtAllowance === BigInt(0),
    };
  }, [store.userBalance]);

  // 获取最大可用余额
  const maxBalances = useMemo(() => {
    if (!store.userBalance) {
      return {
        maxUSDTToSupply: '0',
        maxUSDTToWithdraw: '0',
      };
    }

    return {
      maxUSDTToSupply: formatUnits(store.userBalance.usdtBalance, 6), // 最大可存入的 USDT
      maxUSDTToWithdraw: formatUnits(store.userBalance.aUsdtBalance, 6), // 最大可提取的 USDT（基于 aUSDT 余额）
    };
  }, [store.userBalance]);

  // 自动初始化合约
  if (store.defiAggregatorAddress === null || store.aaveAdapterAddress === null) {
    initContracts();
  }

  return {
    // 基础状态
    isConnected,
    address,
    isLoading: store.isLoading,
    isOperating: store.isOperating,
    error: store.error,

    // 合约信息
    defiAggregatorAddress: store.defiAggregatorAddress,
    aaveAdapterAddress: store.aaveAdapterAddress,
    poolInfo: formattedPoolInfo,

    // 用户余额信息
    userBalance: store.userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,

    // 初始化方法
    initializeAaveTrading,
    initContracts,
    setContractAddresses,

    // 读取方法
    fetchPoolInfo,
    fetchUserBalance,
    fetchUserUSDTBalance,
    fetchUserAUSDTBalance,
    fetchAllowances,
    fetchFeeRate,
    refreshUserBalance,

    // 授权方法
    approveUSDT,
    approveAUSDT,

    // 交易方法
    supplyUSDT,
    withdrawUSDT,
    sellUSDT,

    // 辅助方法
    setLoading: store.setLoading,
    setOperating: store.setOperating,
    setError: store.setError,
    clearErrors: store.clearErrors,
    reset: store.reset,
  };
};

export default useAaveWithClients;