import { create } from 'zustand';
import {
  Address,
  PublicClient,
  WalletClient,
  TransactionReceipt,
  Abi,
  Chain,
  Hex,
  formatUnits,
  decodeEventLog as viemDecodeEventLog,
} from 'viem';
import DefiAggregatorABI from '@/lib/abi/DefiAggregator.json';
import MockERC20ABI from '@/lib/abi/MockERC20.json';
import CompoundAdapterABI from '@/lib/abi/CompoundAdapter.json';
import CompoundDeploymentInfo from '@/lib/abi/deployments-compound-adapter-sepolia.json';

// USDT 地址从 Compound 部署文件获取
const USDT_ADDRESS = CompoundDeploymentInfo.contracts.MockERC20_USDT as Address;

// ==================== 类型定义 ====================

/**
 * Compound 操作类型枚举（基于 ABI）
 */
export enum CompoundOperationType {
  SUPPLY = 0,     // 存入资产
  REDEEM = 1,     // 提取资产
}

/**
 * Compound 操作参数类型
 */
export interface CompoundOperationParams {
  tokens: Address[];
  amounts: bigint[];
  recipient: Address;
  deadline: number;
  tokenId: number;
  extraData: Hex;
}

/**
 * Compound 池信息
 */
export interface CompoundPoolInfo {
  feeRateBps: number;
  usdtToken: Address;
  cUsdtToken: Address;
  adapterName: string;
  adapterVersion: string;
  contractVersion: string;
  currentAPY: bigint;
  currentExchangeRate: bigint;
}

/**
 * 用户余额信息
 */
export interface CompoundUserBalance {
  usdtBalance: bigint;
  cUsdtBalance: bigint;
  cUsdtAllowance: bigint;
  usdtAllowance: bigint;
  formattedUsdtBalance: string;
  formattedCUsdtBalance: string;
  depositedAmount?: bigint;
  earnedInterest?: bigint;
}

/**
 * Compound 交易结果
 */
export interface CompoundTransactionResult {
  success: boolean;
  outputAmounts: bigint[];
  returnData: Hex;
  message: string;
  transactionHash?: Hex;
  blockNumber?: bigint;
  gasUsed?: bigint;
}

// ==================== Store 接口定义 ====================
interface CompoundStore {
  // 状态
  defiAggregatorAddress: Address | null;
  compoundAdapterAddress: Address | null;
  cUsdtTokenAddress: Address | null;
  poolInfo: CompoundPoolInfo | null;
  userBalance: CompoundUserBalance | null;
  isLoading: boolean;
  isOperating: boolean;
  error: string | null;

  // 初始化方法
  initContracts: (defiAggregatorAddress: Address, compoundAdapterAddress: Address) => void;
  initFromDeployment: () => void;

  // 读取方法
  fetchPoolInfo: (publicClient: PublicClient) => Promise<void>;
  fetchUserBalance: (publicClient: PublicClient, userAddress: Address) => Promise<void>;
  fetchUserUSDTBalance: (publicClient: PublicClient, userAddress: Address) => Promise<bigint>;
  fetchUserCUSDTBalance: (publicClient: PublicClient, userAddress: Address) => Promise<bigint>;
  fetchUserUSDTAllowance: (publicClient: PublicClient, userAddress: Address, spenderAddress: Address) => Promise<bigint>;
  fetchUserCUSDTAllowance: (publicClient: PublicClient, userAddress: Address, spenderAddress: Address) => Promise<bigint>;
  fetchAllowances: (publicClient: PublicClient, userAddress: Address) => Promise<void>;
  fetchFeeRate: (publicClient: PublicClient) => Promise<bigint>;
  fetchCurrentAPY: (publicClient: PublicClient) => Promise<bigint>;
  fetchCurrentExchangeRate: (publicClient: PublicClient) => Promise<bigint>;

  // 写入方法
  supplyUSDT: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<TransactionReceipt>;

  redeemUSDT: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<TransactionReceipt>;

  sellUSDT: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<CompoundTransactionResult>;

  approveUSDT: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<TransactionReceipt>;

  approveCUSDT: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<TransactionReceipt>;

  // 重置状态
  reset: () => void;
  clearError: () => void;
}

// Typed ABIs
const typedDefiAggregatorABI = DefiAggregatorABI as Abi;
const typedMockERC20ABI = MockERC20ABI as Abi;
const typedCompoundAdapterABI = CompoundAdapterABI as Abi;

// ==================== Store 实现 ====================
export const useCompoundStore = create<CompoundStore>((set, get) => ({
  // 初始状态
  defiAggregatorAddress: null,
  compoundAdapterAddress: null,
  cUsdtTokenAddress: null,
  poolInfo: null,
  userBalance: null,
  isLoading: false,
  isOperating: false,
  error: null,

  // ==================== 初始化方法 ====================
  initContracts: (defiAggregatorAddress: Address, compoundAdapterAddress: Address) => {
    console.log('🔧 初始化 Compound 合约地址:', {
      defiAggregator: defiAggregatorAddress,
      compoundAdapter: compoundAdapterAddress,
    });
    set({
      defiAggregatorAddress,
      compoundAdapterAddress,
      error: null,
    });
  },

  initFromDeployment: () => {
    try {
      console.log('🔧 使用 Sepolia 测试网部署信息初始化 Compound 合约:', {
        chainId: CompoundDeploymentInfo.chainId,
        defiAggregator: CompoundDeploymentInfo.contracts.DefiAggregator,
        compoundAdapter: CompoundDeploymentInfo.contracts.CompoundAdapter,
        cUsdtToken: CompoundDeploymentInfo.contracts.MockCToken_cUSDT,
        feeRateBps: CompoundDeploymentInfo.feeRateBps
      });
      set({
        defiAggregatorAddress: CompoundDeploymentInfo.contracts.DefiAggregator as Address,
        compoundAdapterAddress: CompoundDeploymentInfo.contracts.CompoundAdapter as Address,
        cUsdtTokenAddress: CompoundDeploymentInfo.contracts.MockCToken_cUSDT as Address,
        error: null,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '从部署文件初始化失败';
      set({ error: errorMsg });
      console.error('❌ 从部署文件初始化失败:', errorMsg);
    }
  },

  // ==================== 读取方法 ====================
  fetchPoolInfo: async (publicClient: PublicClient) => {
    const { defiAggregatorAddress, compoundAdapterAddress } = get();
    if (!defiAggregatorAddress || !compoundAdapterAddress) {
      set({ error: '合约地址未初始化' });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('🔍 获取 Compound 池信息...');

      const [feeRateBps, usdtToken, cUsdtToken, adapterName, adapterVersion, contractVersion, currentAPY, currentExchangeRate] = await Promise.all([
        publicClient.readContract({
          address: defiAggregatorAddress,
          abi: typedDefiAggregatorABI,
          functionName: 'feeRateBps',
        }),
        publicClient.readContract({
          address: compoundAdapterAddress,
          abi: typedCompoundAdapterABI,
          functionName: 'usdtToken',
        }),
        publicClient.readContract({
          address: compoundAdapterAddress,
          abi: typedCompoundAdapterABI,
          functionName: 'cUsdtToken',
        }),
        publicClient.readContract({
          address: compoundAdapterAddress,
          abi: typedCompoundAdapterABI,
          functionName: 'getAdapterName',
        }),
        publicClient.readContract({
          address: compoundAdapterAddress,
          abi: typedCompoundAdapterABI,
          functionName: 'getAdapterVersion',
        }),
        publicClient.readContract({
          address: compoundAdapterAddress,
          abi: typedCompoundAdapterABI,
          functionName: 'getAdapterVersion',
        }),
        publicClient.readContract({
          address: compoundAdapterAddress,
          abi: typedCompoundAdapterABI,
          functionName: 'getCurrentAPY',
        }),
        publicClient.readContract({
          address: compoundAdapterAddress,
          abi: typedCompoundAdapterABI,
          functionName: 'getCurrentExchangeRate',
        }),
      ]);

      const poolInfo: CompoundPoolInfo = {
        feeRateBps: Number(feeRateBps),
        usdtToken: usdtToken as Address,
        cUsdtToken: cUsdtToken as Address,
        adapterName: adapterName as string,
        adapterVersion: adapterVersion as string,
        contractVersion: contractVersion as string,
        currentAPY: currentAPY as bigint,
        currentExchangeRate: currentExchangeRate as bigint,
      };

      set({ poolInfo, isLoading: false });
      console.log('✅ Compound 池信息获取成功');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取池信息失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取 Compound 池信息失败:', errorMsg);
    }
  },

  fetchUserBalance: async (publicClient: PublicClient, userAddress: Address) => {
    const { compoundAdapterAddress } = get();
    if (!compoundAdapterAddress) {
      set({ error: '合约地址未初始化' });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('🔍 获取用户 Compound 余额...');

      const [usdtBalance, cUsdtBalance, usdtAllowance, cUsdtAllowance] = await Promise.all([
        get().fetchUserUSDTBalance(publicClient, userAddress),
        get().fetchUserCUSDTBalance(publicClient, userAddress),
        get().fetchUserUSDTAllowance(publicClient, userAddress, compoundAdapterAddress),
        get().fetchUserCUSDTAllowance(publicClient, userAddress, compoundAdapterAddress),
      ]);

      const userBalance: CompoundUserBalance = {
        usdtBalance,
        cUsdtBalance,
        cUsdtAllowance,
        usdtAllowance,
        formattedUsdtBalance: formatUnits(usdtBalance, 6), // USDT 是 6 位小数
        formattedCUsdtBalance: formatUnits(cUsdtBalance, 8), // cToken 通常是 8 位小数
      };

      set({ userBalance, isLoading: false });
      console.log('✅ 用户 Compound 余额获取成功');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取用户余额失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取用户 Compound 余额失败:', errorMsg);
    }
  },

  fetchUserUSDTBalance: async (publicClient: PublicClient, userAddress: Address): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: USDT_ADDRESS, // 使用动态获取的 USDT 地址
        abi: typedMockERC20ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      return balance as bigint;
    } catch (error) {
      console.error('❌ 获取 USDT 余额失败:', error);
      return BigInt(0);
    }
  },

  fetchUserCUSDTBalance: async (publicClient: PublicClient, userAddress: Address): Promise<bigint> => {
    const { compoundAdapterAddress } = get();
    if (!compoundAdapterAddress) return BigInt(0);

    try {
      const balance = await publicClient.readContract({
        address: compoundAdapterAddress,
        abi: typedCompoundAdapterABI,
        functionName: 'getUserCTokenBalance',
        args: [userAddress],
      });
      return balance as bigint;
    } catch (error) {
      console.error('❌ 获取 cUSDT 余额失败:', error);
      return BigInt(0);
    }
  },

  fetchAllowances: async (publicClient: PublicClient, userAddress: Address): Promise<void> => {
    const { compoundAdapterAddress, defiAggregatorAddress } = get();
    if (!compoundAdapterAddress || !defiAggregatorAddress) return;

    try {
      console.log('🔍 获取 Compound 授权额度...', {
        compoundAdapterAddress,
        userAddress
      });

      // USDT 和 cUSDT 都需要授权给 CompoundAdapter
      const [usdtAllowance, cUsdtAllowance] = await Promise.all([
        get().fetchUserUSDTAllowance(publicClient, userAddress, compoundAdapterAddress),
        get().fetchUserCUSDTAllowance(publicClient, userAddress, compoundAdapterAddress),
      ]);

      console.log('🔍 Compound 授权额度获取结果:', {
        usdtAllowance: usdtAllowance.toString(),
        cUsdtAllowance: cUsdtAllowance.toString(),
        usdtAllowanceFormatted: formatUnits(usdtAllowance, 6),
        cUsdtAllowanceFormatted: formatUnits(cUsdtAllowance, 8)
      });

      set((state) => ({
        userBalance: state.userBalance ? {
          ...state.userBalance,
          usdtAllowance,
          cUsdtAllowance,
        } : null,
      }));
    } catch (error) {
      console.error('❌ 获取授权额度失败:', error);
    }
  },

  fetchUserUSDTAllowance: async (publicClient: PublicClient, userAddress: Address, spenderAddress: Address): Promise<bigint> => {
    try {
      const allowance = await publicClient.readContract({
        address: USDT_ADDRESS,
        abi: typedMockERC20ABI,
        functionName: 'allowance',
        args: [userAddress, spenderAddress],
      });
      return allowance as bigint;
    } catch (error) {
      console.error('❌ 获取 USDT 授权额度失败:', error);
      return BigInt(0);
    }
  },

  fetchUserCUSDTAllowance: async (publicClient: PublicClient, userAddress: Address, spenderAddress: Address): Promise<bigint> => {
    const { compoundAdapterAddress } = get();
    if (!compoundAdapterAddress) return BigInt(0);

    try {
      const cUsdtToken = await publicClient.readContract({
        address: compoundAdapterAddress,
        abi: typedCompoundAdapterABI,
        functionName: 'cUsdtToken',
      });

      const allowance = await publicClient.readContract({
        address: cUsdtToken as Address,
        abi: typedMockERC20ABI,
        functionName: 'allowance',
        args: [userAddress, spenderAddress], // spenderAddress 应该是 DefiAggregator
      });
      return allowance as bigint;
    } catch (error) {
      console.error('❌ 获取 cUSDT 授权额度失败:', error);
      return BigInt(0);
    }
  },

  fetchFeeRate: async (publicClient: PublicClient): Promise<bigint> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) return BigInt(0);

    try {
      const feeRate = await publicClient.readContract({
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'feeRateBps',
      });
      return feeRate as bigint;
    } catch (error) {
      console.error('❌ 获取手续费率失败:', error);
      return BigInt(0);
    }
  },

  fetchCurrentAPY: async (publicClient: PublicClient): Promise<bigint> => {
    const { compoundAdapterAddress } = get();
    if (!compoundAdapterAddress) return BigInt(0);

    try {
      const apy = await publicClient.readContract({
        address: compoundAdapterAddress,
        abi: typedCompoundAdapterABI,
        functionName: 'getCurrentAPY',
      });
      return apy as bigint;
    } catch (error) {
      console.error('❌ 获取当前 APY 失败:', error);
      return BigInt(0);
    }
  },

  fetchCurrentExchangeRate: async (publicClient: PublicClient): Promise<bigint> => {
    const { compoundAdapterAddress } = get();
    if (!compoundAdapterAddress) return BigInt(0);

    try {
      const rate = await publicClient.readContract({
        address: compoundAdapterAddress,
        abi: typedCompoundAdapterABI,
        functionName: 'getCurrentExchangeRate',
      });
      return rate as bigint;
    } catch (error) {
      console.error('❌ 获取当前汇率失败:', error);
      return BigInt(0);
    }
  },

  // ==================== 写入方法 ====================
  approveUSDT: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<TransactionReceipt> => {
    const { compoundAdapterAddress } = get();
    if (!compoundAdapterAddress) {
      throw new Error('CompoundAdapter 合约地址未初始化');
    }

    try {
      console.log('🔑 开始授权 USDT 给 CompoundAdapter...');
      console.log('参数:', { amount: amount.toString(), account });

      // 构建交易参数，正确处理 gas 配置
      const baseParams = {
        address: USDT_ADDRESS,
        abi: typedMockERC20ABI,
        functionName: 'approve' as const,
        args: [compoundAdapterAddress, amount] as [`0x${string}`, bigint], // 授权给 CompoundAdapter
        chain,
        account,
      };

      // 根据gas配置动态构建参数，避免类型冲突
      const writeParams: any = { ...baseParams };

      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        // EIP-1559 gas 配置
        writeParams.maxFeePerGas = gasConfig.maxFeePerGas;
        writeParams.maxPriorityFeePerGas = gasConfig.maxPriorityFeePerGas;
        if (gasConfig?.gas) {
          writeParams.gas = gasConfig.gas;
        }
      } else {
        // Legacy gas 配置或默认
        if (gasConfig?.gasPrice) {
          writeParams.gasPrice = gasConfig.gasPrice;
        }
        if (gasConfig?.gas) {
          writeParams.gas = gasConfig.gas;
        }
      }

      const hash = await walletClient.writeContract(writeParams);

      console.log('📝 授权交易哈希:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ USDT 授权完成');

      // 授权成功后更新授权状态（从 store 中刷新）
      await get().fetchAllowances(publicClient, userAddress);

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'USDT 授权失败';
      console.error('❌ USDT 授权失败:', errorMsg);
      throw new Error(errorMsg);
    }
  },

  approveCUSDT: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<TransactionReceipt> => {
    const { compoundAdapterAddress } = get();
    if (!compoundAdapterAddress) {
      throw new Error('CompoundAdapter 合约地址未初始化');
    }

    try {
      console.log('🔑 开始授权 cUSDT 给 CompoundAdapter...');
      console.log('参数:', { amount: amount.toString(), account });

      // 获取 cUSDT token 地址
      const cUsdtToken = await publicClient.readContract({
        address: compoundAdapterAddress,
        abi: typedCompoundAdapterABI,
        functionName: 'cUsdtToken',
      });

      console.log('🔍 cUSDT 代币地址:', cUsdtToken);

      // 获取用户当前的 cUSDT 余额，直接授权所有余额
      // 参考测试文件逻辑：授权所有 cToken，让适配器自己计算需要多少
      const cUsdtBalance = await publicClient.readContract({
        address: compoundAdapterAddress,
        abi: typedCompoundAdapterABI,
        functionName: 'getUserCTokenBalance',
        args: [account],
      });

      console.log('🔄 cUSDT 授权参数:', {
        usdtAmount: amount.toString(),
        cUsdtToken: cUsdtToken,
        compoundAdapterAddress,
        account,
        cUsdtBalance: cUsdtBalance.toString(),
        cUsdtBalanceFormatted: formatUnits(cUsdtBalance, 8)
      });

      // 构建交易参数，正确处理 gas 配置
      const writeContractParams: any = {
        address: cUsdtToken as Address, // 从合约读取 cUSDT 地址
        abi: typedMockERC20ABI,
        functionName: 'approve' as const,
        args: [compoundAdapterAddress, cUsdtBalance] as [`0x${string}`, bigint], // 授权所有 cUSDT 给 CompoundAdapter
        chain,
        account,
      };

      // 添加 gas 配置，避免 EIP-1559 和 legacy 同时存在
      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        // EIP-1559 gas 配置
        writeContractParams.maxFeePerGas = gasConfig.maxFeePerGas;
        writeContractParams.maxPriorityFeePerGas = gasConfig.maxPriorityFeePerGas;
        if (gasConfig?.gas) {
          writeContractParams.gas = gasConfig.gas;
        }
      } else {
        // Legacy gas 配置
        if (gasConfig?.gasPrice) {
          writeContractParams.gasPrice = gasConfig.gasPrice;
        }
        if (gasConfig?.gas) {
          writeContractParams.gas = gasConfig.gas;
        }
      }

      const hash = await walletClient.writeContract(writeContractParams);

      console.log('📝 授权交易哈希:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ cUSDT 授权完成');

      // 授权成功后更新授权状态
      await get().fetchAllowances(publicClient, userAddress);

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'cUSDT 授权失败';
      console.error('❌ cUSDT 授权失败:', errorMsg);
      throw new Error(errorMsg);
    }
  },

  supplyUSDT: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<TransactionReceipt> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) {
      throw new Error('DefiAggregator 合约地址未初始化');
    }

    try {
      set({ isOperating: true, error: null });
      console.log('💰 开始存入 USDT 到 Compound...');
      console.log('参数:', { amount: amount.toString(), account });

      const operationParams: CompoundOperationParams = {
        tokens: [USDT_ADDRESS], // USDT 代币地址
        amounts: [amount], // 存入的 USDT 数量
        recipient: account,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
        tokenId: 0, // Compound 不使用 NFT，设为 0
        extraData: '0x' as Hex, // 无额外数据
      };

      console.log('📋 存入操作参数:', operationParams);
      console.log('📋 执行参数:', {
        adapterName: 'compound', // 适配器名称
        operationType: CompoundOperationType.SUPPLY, // 操作类型：0
        operationParams,
        gasConfig
      });

      // 构建交易参数，正确处理 gas 配置
      const txParams: any = {
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'executeOperation',
        args: [
          'compound', // 适配器名称
          CompoundOperationType.SUPPLY, // 操作类型：0
          operationParams
        ] as [string, number, CompoundOperationParams],
        chain,
        account,
      };

      // 添加 gas 配置，避免 EIP-1559 和 legacy 同时存在
      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        // EIP-1559 gas 配置
        txParams.maxFeePerGas = gasConfig.maxFeePerGas;
        txParams.maxPriorityFeePerGas = gasConfig.maxPriorityFeePerGas;
        if (gasConfig?.gas) {
          txParams.gas = gasConfig.gas;
        }
      } else {
        // Legacy gas 配置
        if (gasConfig?.gasPrice) {
          txParams.gasPrice = gasConfig.gasPrice;
        }
        if (gasConfig?.gas) {
          txParams.gas = gasConfig.gas;
        }
      }

      const hash = await walletClient.writeContract(txParams);

      console.log('📝 存款交易哈希:', hash);

      console.log('⏳ 等待交易确认...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ 交易已确认');

      // 检查交易结果
      if (receipt.logs) {
        for (const log of receipt.logs as Array<{ topics: readonly Hex[] } & typeof receipt.logs[0]>) {
          try {
            const event = viemDecodeEventLog({
              abi: typedDefiAggregatorABI,
              data: log.data,
              topics: log.topics as [signature: Hex, ...args: Hex[]],
            });

            if (event && event.eventName === 'OperationExecuted') {
              const operationEvent = event as unknown as DecodedOperationExecutedEvent;
              console.log('✅ 存款操作成功:', {
                outputAmounts: operationEvent.args.amounts,
                returnData: operationEvent.args.returnData,
              });
              break;
            }
          } catch (parseError) {
            console.warn('解析日志失败:', parseError);
          }
        }
      }

      // 更新用户余额
      await get().fetchUserBalance(publicClient, userAddress);

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Compound 存款失败';
      set({ error: errorMsg, isOperating: false });
      console.error('❌ Compound 存款失败:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      set({ isOperating: false });
    }
  },

  redeemUSDT: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<TransactionReceipt> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) {
      throw new Error('DefiAggregator 合约地址未初始化');
    }

    try {
      set({ isOperating: true, error: null });
      console.log('💰 开始从 Compound 提取 USDT...');
      console.log('参数:', { amount: amount.toString(), account });

      // 参考测试文件逻辑：amounts 参数直接使用 USDT 金额
      // CompoundAdapter 会自己计算需要多少 cUSDT
      console.log('🔄 提取参数:', {
        usdtAmount: amount.toString(),
        usdtAmountFormatted: formatUnits(amount, 6)
      });

      const operationParams: CompoundOperationParams = {
        tokens: [USDT_ADDRESS], // USDT 代币地址
        amounts: [amount], // 直接使用 USDT 金额
        recipient: account,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
        tokenId: 0, // Compound 不使用 NFT，设为 0
        extraData: '0x' as Hex, // 无额外数据
      };

      console.log('📋 提取操作参数:', operationParams);
      console.log('📋 执行参数:', {
        adapterName: 'compound', // 适配器名称
        operationType: CompoundOperationType.REDEEM, // 操作类型：1
        operationParams,
        gasConfig
      });

      const writeParams: any = {
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'executeOperation',
        args: [
          'compound', // 适配器名称
          CompoundOperationType.REDEEM, // 操作类型：1
          operationParams
        ] as [string, number, CompoundOperationParams],
        chain,
        account,
      };

      // 添加 gas 配置，避免 EIP-1559 和 legacy 同时存在
      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        // EIP-1559 gas 配置
        writeParams.maxFeePerGas = gasConfig.maxFeePerGas;
        writeParams.maxPriorityFeePerGas = gasConfig.maxPriorityFeePerGas;
        if (gasConfig?.gas) {
          writeParams.gas = gasConfig.gas;
        }
      } else {
        // Legacy gas 配置
        if (gasConfig?.gasPrice) {
          writeParams.gasPrice = gasConfig.gasPrice;
        }
        if (gasConfig?.gas) {
          writeParams.gas = gasConfig.gas;
        }
      }

      const hash = await walletClient.writeContract(writeParams);

      console.log('📝 提款交易哈希:', hash);

      console.log('⏳ 等待交易确认...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ 交易已确认');

      // 更新用户余额
      await get().fetchUserBalance(publicClient, userAddress);

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Compound 提取失败';
      set({ error: errorMsg, isOperating: false });
      console.error('❌ Compound 提取失败:', errorMsg);
      throw new Error(errorMsg);
    } finally {
      set({ isOperating: false });
    }
  },

  sellUSDT: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    amount: bigint,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<CompoundTransactionResult> => {
    // 卖出操作等同于提取操作
    const receipt = await get().redeemUSDT(publicClient, walletClient, chain, amount, account, userAddress, gasConfig);

    return {
      success: true,
      outputAmounts: [amount],
      returnData: '0x' as Hex,
      message: 'Compound 卖出成功',
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  },

  // ==================== 状态管理 ====================
  reset: () => {
    set({
      poolInfo: null,
      userBalance: null,
      error: null,
      isLoading: false,
      isOperating: false,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// 类型声明
interface DecodedOperationExecutedEvent {
  args: {
    amounts: bigint[];
    returnData: Hex;
  };
  eventName: 'OperationExecuted';
}