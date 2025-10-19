import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Address,
  PublicClient,
  WalletClient,
  TransactionReceipt,
  Abi,
  Chain,
  Hex,
  formatUnits,
  parseUnits,
} from 'viem';

// 导入 ABI 文件
import YearnV3AdapterABI from '@/lib/abi/YearnV3Adapter.json';
import DefiAggregatorABI from '@/lib/abi/DefiAggregator.json';
import MockERC20ABI from '@/lib/abi/MockERC20.json';
import MockYearnV3VaultABI from '@/lib/abi/MockYearnV3Vault.json';
import YearnDeploymentInfo from '@/lib/abi/deployments-yearnv3-adapter-sepolia.json';

// 导入 USDT 地址配置，与 Aave 保持一致
import { getContractAddresses } from "@/app/pool/page";
const { USDT_ADDRESS } = getContractAddresses() as { USDT_ADDRESS: Address };

// ==================== 类型定义 ====================

/**
 * YearnV3 操作类型枚举
 */
export enum YearnV3OperationType {
  DEPOSIT = 0,    // 存款
  WITHDRAW = 1,   // 取款
}

/**
 * 操作参数类型
 */
export interface YearnV3OperationParams {
  tokens: Address[];
  amounts: string[];
  recipient: Address;
  deadline: number;
  tokenId: string;
  extraData: Hex;
}

/**
 * 操作结果类型
 */
export interface YearnV3OperationResult {
  success: boolean;
  outputAmounts: bigint[];
  returnData: Hex;
  message: string;
}

/**
 * 交易结果类型
 */
export interface YearnV3TransactionResult {
  success: boolean;
  hash?: Address;
  receipt?: TransactionReceipt;
  result?: YearnV3OperationResult;
  error?: string;
  message?: string;
}

/**
 * 合约调用结果类型
 */
export interface YearnV3ContractCallResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * 用户余额信息类型
 */
export interface YearnV3UserBalanceInfo {
  usdtBalance: bigint;        // USDT 余额 (6 decimals)
  sharesBalance: bigint;      // Vault Shares 余额 (18 decimals)
  usdtAllowance: bigint;      // USDT 授权额度
  sharesAllowance: bigint;    // Shares 授权额度
  currentValue: bigint;       // 当前份额价值 (USDT)
  estimatedAPY?: number;      // 预估年化收益
}

// ==================== Store 状态定义 ====================
interface YearnV3State {
  // 合约地址
  defiAggregatorAddress: Address | null;
  yearnV3AdapterAddress: Address | null;
  yearnVaultAddress: Address | null;
  usdtTokenAddress: Address | null;

  // 用户数据
  userBalance: YearnV3UserBalanceInfo | null;

  // 操作状态
  isLoading: boolean;
  isOperating: boolean;
  error: string | null;

  // 初始化方法
  initContracts: () => void;

  // 读取方法
  fetchUserBalance: (publicClient: PublicClient, userAddress: Address) => Promise<void>;
  fetchAllowances: (publicClient: PublicClient, userAddress: Address) => Promise<void>;

  // 操作方法
  deposit: (amount: string) => Promise<YearnV3TransactionResult>;
  withdraw: (amount: string) => Promise<YearnV3TransactionResult>;
  approveUSDT: (amount: string) => Promise<YearnV3ContractCallResult>;
  approveShares: (amount: string) => Promise<YearnV3ContractCallResult>;
  previewDeposit: (amount: string) => Promise<YearnV3ContractCallResult>;
  previewWithdraw: (shares: string) => Promise<YearnV3ContractCallResult>;
  getUserCurrentValue: (userAddress: Address) => Promise<YearnV3ContractCallResult>;

  // 辅助方法
  setLoading: (loading: boolean) => void;
  setOperating: (operating: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ==================== 类型化 ABI ====================
const typedYearnV3AdapterABI = YearnV3AdapterABI as Abi;
const typedDefiAggregatorABI = DefiAggregatorABI as Abi;
const typedMockERC20ABI = MockERC20ABI as Abi;
const typedMockYearnV3VaultABI = MockYearnV3VaultABI as Abi;

// ==================== 从部署文件获取地址 ====================
const DEPLOYMENT_ADDRESSES = {
  defiAggregator: YearnDeploymentInfo.contracts.DefiAggregator as Address,
  yearnV3Adapter: YearnDeploymentInfo.contracts.YearnV3Adapter as Address,
  yearnVault: YearnDeploymentInfo.contracts.MockYearnV3Vault as Address,
  usdtToken: USDT_ADDRESS, // 使用与 Aave 一致的 USDT 地址配置
};

// 代币精度配置
const TOKEN_DECIMALS = {
  USDT: 6,      // USDT 使用 6 位小数
  SHARES: 18,   // Vault Shares 使用 18 位小数
} as const;

// ==================== Store 创建 ====================
export const useYearnV3Store = create<YearnV3State>()(
  devtools(
    (set, get) => ({
      // 初始状态
      defiAggregatorAddress: null,
      yearnV3AdapterAddress: null,
      yearnVaultAddress: null,
      usdtTokenAddress: null,
      userBalance: null,
      isLoading: false,
      isOperating: false,
      error: null,

      // 初始化合约
      initContracts: () => {
        try {
          console.log('🔧 初始化 YearnV3 合约地址...');
          console.log('📋 DefiAggregator:', DEPLOYMENT_ADDRESSES.defiAggregator);
          console.log('📋 YearnV3Adapter:', DEPLOYMENT_ADDRESSES.yearnV3Adapter);
          console.log('📋 YearnV3Vault:', DEPLOYMENT_ADDRESSES.yearnVault);
          console.log('📋 USDT Token:', DEPLOYMENT_ADDRESSES.usdtToken);

          set({
            defiAggregatorAddress: DEPLOYMENT_ADDRESSES.defiAggregator,
            yearnV3AdapterAddress: DEPLOYMENT_ADDRESSES.yearnV3Adapter,
            yearnVaultAddress: DEPLOYMENT_ADDRESSES.yearnVault,
            usdtTokenAddress: DEPLOYMENT_ADDRESSES.usdtToken,
            error: null
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '初始化合约失败';
          set({ error: errorMsg });
          console.error('❌ 初始化合约失败:', errorMsg);
        }
      },

      // 获取用户余额
      fetchUserBalance: async (publicClient: PublicClient, userAddress: Address) => {
        const { yearnVaultAddress, usdtTokenAddress, yearnV3AdapterAddress } = get();
        if (!yearnVaultAddress || !usdtTokenAddress || !yearnV3AdapterAddress) {
          const errorMsg = '合约地址未初始化';
          set({ error: errorMsg });
          return;
        }

        try {
          console.log('💰 获取用户余额...', { userAddress });
          set({ isLoading: true, error: null });

          // 并行获取所有余额，包括当前价值
          const [usdtBalance, sharesBalance, currentValue] = await Promise.all([
            publicClient.readContract({
              address: usdtTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            publicClient.readContract({
              address: yearnVaultAddress,
              abi: typedMockYearnV3VaultABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            publicClient.readContract({
              address: yearnV3AdapterAddress,
              abi: typedYearnV3AdapterABI,
              functionName: 'getUserCurrentValue',
              args: [userAddress],
            }).catch(() => BigInt(0)), // 如果获取失败，使用0作为默认值
          ]);

          // 添加详细的余额调试信息
          const formattedUSDTBalance = formatUnits(usdtBalance as bigint, TOKEN_DECIMALS.USDT);
          const formattedSharesBalance = formatUnits(sharesBalance as bigint, TOKEN_DECIMALS.SHARES);
          const formattedCurrentValue = formatUnits(currentValue as bigint, TOKEN_DECIMALS.USDT);

          console.log('📊 余额查询结果:', {
            usdtBalanceRaw: (usdtBalance as bigint).toString(),
            usdtBalanceFormatted: formattedUSDTBalance,
            sharesBalanceRaw: (sharesBalance as bigint).toString(),
            sharesBalanceFormatted: formattedSharesBalance,
            currentValueRaw: (currentValue as bigint).toString(),
            currentValueFormatted: formattedCurrentValue,
            usdtDecimals: TOKEN_DECIMALS.USDT,
            sharesDecimals: TOKEN_DECIMALS.SHARES
          });

          const balanceInfo: YearnV3UserBalanceInfo = {
            usdtBalance: usdtBalance as bigint,
            sharesBalance: sharesBalance as bigint,
            usdtAllowance: BigInt(0),
            sharesAllowance: BigInt(0),
            currentValue: currentValue as bigint,
          };

          set({ userBalance: balanceInfo, isLoading: false });
          console.log('✅ 用户余额获取成功');
        } catch (error) {
          // 与 Aave 保持一致的错误处理方式：返回默认值而不是抛出错误
          const errorMsg = error instanceof Error ? error.message : '获取用户余额失败';
          console.warn('⚠️ 获取用户余额失败，使用默认值:', errorMsg);

          // 设置默认余额信息
          const defaultBalanceInfo: YearnV3UserBalanceInfo = {
            usdtBalance: BigInt(0),
            sharesBalance: BigInt(0),
            usdtAllowance: BigInt(0),
            sharesAllowance: BigInt(0),
            currentValue: BigInt(0),
          };

          set({ userBalance: defaultBalanceInfo, isLoading: false });
        }
      },

      // 获取授权信息
      fetchAllowances: async (publicClient: PublicClient, userAddress: Address) => {
        const { yearnV3AdapterAddress, yearnVaultAddress, usdtTokenAddress } = get();
        if (!yearnV3AdapterAddress || !yearnVaultAddress || !usdtTokenAddress) {
          const errorMsg = '合约地址未初始化';
          set({ error: errorMsg });
          return;
        }

        try {
          console.log('🔑 获取授权信息...');

          const [usdtAllowance, sharesAllowance] = await Promise.all([
            publicClient.readContract({
              address: usdtTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'allowance',
              args: [userAddress, yearnV3AdapterAddress],
            }),
            publicClient.readContract({
              address: yearnVaultAddress,
              abi: typedMockYearnV3VaultABI,
              functionName: 'allowance',
              args: [userAddress, yearnV3AdapterAddress],
            }),
          ]);

          console.log('📊 授权查询结果:', {
            usdtAllowance: formatUnits(usdtAllowance as bigint, TOKEN_DECIMALS.USDT),
            sharesAllowance: formatUnits(sharesAllowance as bigint, TOKEN_DECIMALS.SHARES),
          });

          // 更新当前余额信息中的授权状态
          const currentBalance = get().userBalance;
          if (currentBalance) {
            const updatedBalance = {
              ...currentBalance,
              usdtAllowance: usdtAllowance as bigint,
              sharesAllowance: sharesAllowance as bigint,
            };
            set({ userBalance: updatedBalance });
          }
        } catch (error) {
          // 与 Aave 保持一致的错误处理方式：返回默认值而不是抛出错误
          const errorMsg = error instanceof Error ? error.message : '获取授权信息失败';
          console.warn('⚠️ 获取授权信息失败，使用默认值:', errorMsg);

          // 更新当前余额信息中的授权状态为默认值
          const currentBalance = get().userBalance;
          if (currentBalance) {
            const updatedBalance = {
              ...currentBalance,
              usdtAllowance: BigInt(0),
              sharesAllowance: BigInt(0),
            };
            set({ userBalance: updatedBalance });
          }
        }
      },

      // 获取用户当前价值
      getUserCurrentValue: async (userAddress: Address) => {
        const { yearnV3AdapterAddress } = get();
        if (!yearnV3AdapterAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          // 这个方法需要 publicClient，但接口定义中没有，需要从外部传入
          console.warn('getUserCurrentValue 需要 publicClient 参数，请使用其他方法或修改接口');
          return { success: false, error: '接口定义不完整' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取用户当前价值失败';
          return { success: false, error: errorMsg };
        }
      },

      // 预览存款
      previewDeposit: async (amount: string) => {
        const { yearnV3AdapterAddress } = get();
        if (!yearnV3AdapterAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          // 这个方法需要 publicClient，但接口定义中没有
          console.warn('previewDeposit 需要 publicClient 参数，请使用其他方法或修改接口');
          return { success: false, error: '接口定义不完整' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '预览存款失败';
          return { success: false, error: errorMsg };
        }
      },

      // 预览取款
      previewWithdraw: async (shares: string) => {
        const { yearnV3AdapterAddress } = get();
        if (!yearnV3AdapterAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          // 这个方法需要 publicClient，但接口定义中没有
          console.warn('previewWithdraw 需要 publicClient 参数，请使用其他方法或修改接口');
          return { success: false, error: '接口定义不完整' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '预览取款失败';
          return { success: false, error: errorMsg };
        }
      },

      // 授权 USDT
      approveUSDT: async (amount: string) => {
        const { yearnV3AdapterAddress, usdtTokenAddress } = get();
        if (!yearnV3AdapterAddress || !usdtTokenAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          // 这个方法需要 walletClient 等参数，但接口定义中没有
          console.warn('approveUSDT 需要完整的客户端参数，请使用其他方法或修改接口');
          return { success: false, error: '接口定义不完整' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'USDT 授权失败';
          return { success: false, error: errorMsg };
        }
      },

      // 授权 Shares
      approveShares: async (amount: string) => {
        const { yearnV3AdapterAddress, yearnVaultAddress } = get();
        if (!yearnV3AdapterAddress || !yearnVaultAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          // 这个方法需要 walletClient 等参数，但接口定义中没有
          console.warn('approveShares 需要完整的客户端参数，请使用其他方法或修改接口');
          return { success: false, error: '接口定义不完整' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Shares 授权失败';
          return { success: false, error: errorMsg };
        }
      },

      // 存款
      deposit: async (amount: string) => {
        const { defiAggregatorAddress } = get();
        if (!defiAggregatorAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          set({ isOperating: true, error: null });
          console.log('🚀 开始存款操作...', { amount });

          // 这个方法需要完整的客户端参数，但接口定义中没有
          console.warn('deposit 需要完整的客户端参数，请使用其他方法或修改接口');

          set({ isOperating: false });
          return { success: false, error: '接口定义不完整' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '存款失败';
          set({ error: errorMsg, isOperating: false });
          return { success: false, error: errorMsg };
        }
      },

      // 取款
      withdraw: async (amount: string) => {
        const { defiAggregatorAddress } = get();
        if (!defiAggregatorAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          set({ isOperating: true, error: null });
          console.log('🚀 开始取款操作...', { amount });

          // 这个方法需要完整的客户端参数，但接口定义中没有
          console.warn('withdraw 需要完整的客户端参数，请使用其他方法或修改接口');

          set({ isOperating: false });
          return { success: false, error: '接口定义不完整' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '取款失败';
          set({ error: errorMsg, isOperating: false });
          return { success: false, error: errorMsg };
        }
      },

      // 辅助方法
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      setOperating: (operating: boolean) => set({ isOperating: operating }),

      setError: (error: string | null) => set({ error }),

      clearError: () => set({ error: null }),

      reset: () => set({
        defiAggregatorAddress: null,
        yearnV3AdapterAddress: null,
        yearnVaultAddress: null,
        usdtTokenAddress: null,
        userBalance: null,
        isLoading: false,
        isOperating: false,
        error: null,
      }),
    }),
    {
      name: 'yearnv3-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

export default useYearnV3Store;