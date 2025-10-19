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
import PancakeAdapterABI from '@/lib/abi/PancakeAdapter.json';
import DefiAggregatorABI from '@/lib/abi/DefiAggregator.json';
import MockERC20ABI from '@/lib/abi/MockERC20.json';
import MockPancakeRouterABI from '@/lib/abi/MockPancakeRouter.json';
import PancakeDeploymentInfo from '@/lib/abi/deployments-pancake-adapter-sepolia.json';

// 导入 USDT 地址配置，与其他模块保持一致
import { getContractAddresses } from "@/app/pool/page";
const { USDT_ADDRESS } = getContractAddresses() as { USDT_ADDRESS: Address };

// ==================== 类型定义 ====================

/**
 * PancakeSwap 操作类型枚举
 */
export enum PancakeSwapOperationType {
  SWAP_EXACT_INPUT = 6,
  SWAP_EXACT_OUTPUT = 8,
}

/**
 * 操作参数类型
 */
export interface PancakeSwapOperationParams {
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
export interface PancakeSwapOperationResult {
  success: boolean;
  outputAmounts: bigint[];
  returnData: Hex;
  message: string;
}

/**
 * 交易结果类型
 */
export interface PancakeSwapTransactionResult {
  success: boolean;
  hash?: Address;
  receipt?: TransactionReceipt;
  result?: PancakeSwapOperationResult;
  error?: string;
  message?: string;
}

/**
 * 合约调用结果类型
 */
export interface PancakeSwapContractCallResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

/**
 * 用户余额信息类型
 */
export interface PancakeSwapUserBalanceInfo {
  usdtBalance: bigint;        // USDT 余额 (6 decimals)
  cakeBalance: bigint;        // CAKE 余额 (18 decimals)
  usdtAllowance: bigint;      // USDT 授权额度
  cakeAllowance: bigint;      // CAKE 授权额度
}

/**
 * 汇率信息类型
 */
export interface PancakeSwapExchangeRateInfo {
  tokenIn: Address;
  tokenOut: Address;
  rate: number;              // 汇率
  timestamp: number;
}

// ==================== Store 状态定义 ====================
interface PancakeSwapState {
  // 合约地址
  defiAggregatorAddress: Address | null;
  pancakeAdapterAddress: Address | null;
  usdtTokenAddress: Address | null;
  cakeTokenAddress: Address | null;
  routerAddress: Address | null;

  // 用户数据
  userBalance: PancakeSwapUserBalanceInfo | null;
  exchangeRate: PancakeSwapExchangeRateInfo | null;

  // 操作状态
  isLoading: boolean;
  isOperating: boolean;
  error: string | null;

  // 初始化方法
  initContracts: () => void;

  // 读取方法
  fetchUserBalance: (publicClient: PublicClient, userAddress: Address) => Promise<void>;
  fetchAllowances: (publicClient: PublicClient, userAddress: Address) => Promise<void>;
  fetchExchangeRate: (publicClient: PublicClient, tokenIn: Address, tokenOut: Address) => Promise<void>;

  // 操作方法
  swapExactInput: (amountIn: string, tokenIn: Address, tokenOut: Address, slippageBps?: number) => Promise<PancakeSwapTransactionResult>;
  swapExactOutput: (amountOut: string, tokenIn: Address, tokenOut: Address, slippageBps?: number) => Promise<PancakeSwapTransactionResult>;
  approveToken: (token: Address, amount: string) => Promise<PancakeSwapContractCallResult>;
  estimateSwap: (publicClient: PublicClient, amountIn: string, tokenIn: Address, tokenOut: Address, operationType: PancakeSwapOperationType) => Promise<PancakeSwapContractCallResult>;

  // 辅助方法
  setLoading: (loading: boolean) => void;
  setOperating: (operating: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// ==================== 类型化 ABI ====================
const typedPancakeAdapterABI = PancakeAdapterABI as Abi;
const typedDefiAggregatorABI = DefiAggregatorABI as Abi;
const typedMockERC20ABI = MockERC20ABI as Abi;
const typedMockPancakeRouterABI = MockPancakeRouterABI as Abi;

// ==================== 从部署文件获取地址 ====================
const DEPLOYMENT_ADDRESSES = {
  defiAggregator: PancakeDeploymentInfo.contracts.DefiAggregator as Address,
  pancakeAdapter: PancakeDeploymentInfo.contracts.PancakeAdapter as Address,
  usdtToken: PancakeDeploymentInfo.contracts.MockERC20_USDT as Address,
  cakeToken: PancakeDeploymentInfo.contracts.MockCakeToken as Address,
  router: PancakeDeploymentInfo.contracts.MockPancakeRouter as Address,
};

// 代币精度配置
const TOKEN_DECIMALS = {
  USDT: 6,      // USDT 使用 6 位小数
  CAKE: 18,     // CAKE 使用 18 位小数
} as const;

// 常量配置
const PANCAKE_CONSTANTS = {
  DEFAULT_SLIPPAGE_BPS: 100,    // 1%
  DEFAULT_DEADLINE_OFFSET: 3600, // 1小时
} as const;

// ==================== Store 创建 ====================
export const usePancakeSwapStore = create<PancakeSwapState>()(
  devtools(
    (set, get) => ({
      // 初始状态
      defiAggregatorAddress: null,
      pancakeAdapterAddress: null,
      usdtTokenAddress: null,
      cakeTokenAddress: null,
      routerAddress: null,
      userBalance: null,
      exchangeRate: null,
      isLoading: false,
      isOperating: false,
      error: null,

      // 初始化合约
      initContracts: () => {
        try {
          console.log('🔧 初始化 PancakeSwap 合约地址...');
          console.log('📋 DefiAggregator:', DEPLOYMENT_ADDRESSES.defiAggregator);
          console.log('📋 PancakeAdapter:', DEPLOYMENT_ADDRESSES.pancakeAdapter);
          console.log('📋 USDT Token:', DEPLOYMENT_ADDRESSES.usdtToken);
          console.log('📋 CAKE Token:', DEPLOYMENT_ADDRESSES.cakeToken);
          console.log('📋 Router:', DEPLOYMENT_ADDRESSES.router);

          set({
            defiAggregatorAddress: DEPLOYMENT_ADDRESSES.defiAggregator,
            pancakeAdapterAddress: DEPLOYMENT_ADDRESSES.pancakeAdapter,
            usdtTokenAddress: DEPLOYMENT_ADDRESSES.usdtToken,
            cakeTokenAddress: DEPLOYMENT_ADDRESSES.cakeToken,
            routerAddress: DEPLOYMENT_ADDRESSES.router,
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
        const { usdtTokenAddress, cakeTokenAddress } = get();
        if (!usdtTokenAddress || !cakeTokenAddress) {
          const errorMsg = '合约地址未初始化';
          set({ error: errorMsg });
          return;
        }

        try {
          console.log('💰 获取用户余额...', { userAddress });
          set({ isLoading: true, error: null });

          // 并行获取所有余额
          const [usdtBalance, cakeBalance] = await Promise.all([
            publicClient.readContract({
              address: usdtTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            publicClient.readContract({
              address: cakeTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
          ]);

          // 添加详细的余额调试信息
          const formattedUSDTBalance = formatUnits(usdtBalance as bigint, TOKEN_DECIMALS.USDT);
          const formattedCAKEBalance = formatUnits(cakeBalance as bigint, TOKEN_DECIMALS.CAKE);

          console.log('📊 余额查询结果:', {
            usdtBalanceRaw: (usdtBalance as bigint).toString(),
            usdtBalanceFormatted: formattedUSDTBalance,
            cakeBalanceRaw: (cakeBalance as bigint).toString(),
            cakeBalanceFormatted: formattedCAKEBalance,
            usdtDecimals: TOKEN_DECIMALS.USDT,
            cakeDecimals: TOKEN_DECIMALS.CAKE
          });

          const balanceInfo: PancakeSwapUserBalanceInfo = {
            usdtBalance: usdtBalance as bigint,
            cakeBalance: cakeBalance as bigint,
            usdtAllowance: BigInt(0),
            cakeAllowance: BigInt(0),
          };

          set({ userBalance: balanceInfo, isLoading: false });
          console.log('✅ 用户余额获取成功');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取用户余额失败';
          console.warn('⚠️ 获取用户余额失败，使用默认值:', errorMsg);

          // 设置默认余额信息
          const defaultBalanceInfo: PancakeSwapUserBalanceInfo = {
            usdtBalance: BigInt(0),
            cakeBalance: BigInt(0),
            usdtAllowance: BigInt(0),
            cakeAllowance: BigInt(0),
          };

          set({ userBalance: defaultBalanceInfo, isLoading: false });
        }
      },

      // 获取授权信息
      fetchAllowances: async (publicClient: PublicClient, userAddress: Address) => {
        const { pancakeAdapterAddress, usdtTokenAddress, cakeTokenAddress } = get();
        if (!pancakeAdapterAddress || !usdtTokenAddress || !cakeTokenAddress) {
          const errorMsg = '合约地址未初始化';
          set({ error: errorMsg });
          return;
        }

        try {
          console.log('🔑 获取授权信息...');

          const [usdtAllowance, cakeAllowance] = await Promise.all([
            publicClient.readContract({
              address: usdtTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'allowance',
              args: [userAddress, pancakeAdapterAddress],
            }),
            publicClient.readContract({
              address: cakeTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'allowance',
              args: [userAddress, pancakeAdapterAddress],
            }),
          ]);

          console.log('📊 授权查询结果:', {
            usdtAllowance: formatUnits(usdtAllowance as bigint, TOKEN_DECIMALS.USDT),
            cakeAllowance: formatUnits(cakeAllowance as bigint, TOKEN_DECIMALS.CAKE),
          });

          // 更新当前余额信息中的授权状态
          const currentBalance = get().userBalance;
          if (currentBalance) {
            const updatedBalance = {
              ...currentBalance,
              usdtAllowance: usdtAllowance as bigint,
              cakeAllowance: cakeAllowance as bigint,
            };
            set({ userBalance: updatedBalance });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取授权信息失败';
          console.warn('⚠️ 获取授权信息失败，使用默认值:', errorMsg);

          // 更新当前余额信息中的授权状态为默认值
          const currentBalance = get().userBalance;
          if (currentBalance) {
            const updatedBalance = {
              ...currentBalance,
              usdtAllowance: BigInt(0),
              cakeAllowance: BigInt(0),
            };
            set({ userBalance: updatedBalance });
          }
        }
      },

      // 获取汇率信息
      fetchExchangeRate: async (publicClient: PublicClient, tokenIn: Address, tokenOut: Address) => {
        const { routerAddress } = get();
        if (!routerAddress) {
          const errorMsg = 'Router 地址未初始化';
          set({ error: errorMsg });
          return;
        }

        try {
          console.log('💱 获取汇率信息...', { tokenIn, tokenOut });

          const rate = await publicClient.readContract({
            address: routerAddress,
            abi: typedMockPancakeRouterABI,
            functionName: 'getExchangeRate',
            args: [tokenIn, tokenOut],
          });

          const rateNumber = Number(rate as bigint) / 10000; // 转换为实际汇率

          const exchangeRateInfo: PancakeSwapExchangeRateInfo = {
            tokenIn,
            tokenOut,
            rate: rateNumber,
            timestamp: Date.now()
          };

          console.log('📊 汇率查询结果:', {
            tokenIn,
            tokenOut,
            rateRaw: (rate as bigint).toString(),
            rateNumber,
            timestamp: exchangeRateInfo.timestamp
          });

          set({ exchangeRate: exchangeRateInfo });
          console.log('✅ 汇率信息获取成功');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取汇率信息失败';
          console.warn('⚠️ 获取汇率信息失败:', errorMsg);
          set({ error: errorMsg });
        }
      },

      // 预估交换
      estimateSwap: async (publicClient: PublicClient, amountIn: string, tokenIn: Address, tokenOut: Address, operationType: PancakeSwapOperationType) => {
        const { pancakeAdapterAddress } = get();
        if (!pancakeAdapterAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          console.log('🔍 预估交换...', { amountIn, tokenIn, tokenOut, operationType });

          const decimalsIn = tokenIn === DEPLOYMENT_ADDRESSES.usdtToken ? TOKEN_DECIMALS.USDT : TOKEN_DECIMALS.CAKE;
          const amountInBigInt = parseUnits(amountIn, decimalsIn);

          // 构造操作参数
          const operationParams = {
            tokens: [tokenIn, tokenOut],
            amounts: [amountInBigInt.toString()],
            recipient: '0x0000000000000000000000000000000000000000' as Address, // 临时地址
            deadline: Math.floor(Date.now() / 1000) + PANCAKE_CONSTANTS.DEFAULT_DEADLINE_OFFSET,
            tokenId: "0",
            extraData: "0x" as const,
          };

          const result = await publicClient.readContract({
            address: pancakeAdapterAddress,
            abi: typedPancakeAdapterABI,
            functionName: 'estimateOperation',
            args: [operationType, operationParams],
          });

          console.log('📊 预估结果:', result);

          return {
            success: true,
            data: {
              outputAmount: (result as any).outputAmounts?.[0] || BigInt(0),
              message: (result as any).message || '预估成功'
            }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '预估交换失败';
          console.error('❌ 预估交换失败:', errorMsg);
          return { success: false, error: errorMsg };
        }
      },

      // 授权代币
      approveToken: async (token: Address, amount: string) => {
        const { pancakeAdapterAddress } = get();
        if (!pancakeAdapterAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          console.log('🔑 授权代币...', { token, amount });

          // 这个方法需要 walletClient 等参数，在 Hook 中实现
          console.warn('approveToken 需要完整的客户端参数，请在 Hook 中实现');
          return { success: false, error: '请在 Hook 中实现授权逻辑' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '代币授权失败';
          return { success: false, error: errorMsg };
        }
      },

      // 精确输入交换
      swapExactInput: async (amountIn: string, tokenIn: Address, tokenOut: Address, slippageBps: number = PANCAKE_CONSTANTS.DEFAULT_SLIPPAGE_BPS) => {
        const { defiAggregatorAddress } = get();
        if (!defiAggregatorAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          set({ isOperating: true, error: null });
          console.log('🚀 开始精确输入交换...', { amountIn, tokenIn, tokenOut, slippageBps });

          // 这个方法需要完整的客户端参数，在 Hook 中实现
          console.warn('swapExactInput 需要完整的客户端参数，请在 Hook 中实现');

          set({ isOperating: false });
          return { success: false, error: '请在 Hook 中实现交换逻辑' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '精确输入交换失败';
          set({ error: errorMsg, isOperating: false });
          return { success: false, error: errorMsg };
        }
      },

      // 精确输出交换
      swapExactOutput: async (amountOut: string, tokenIn: Address, tokenOut: Address, slippageBps: number = PANCAKE_CONSTANTS.DEFAULT_SLIPPAGE_BPS) => {
        const { defiAggregatorAddress } = get();
        if (!defiAggregatorAddress) {
          return { success: false, error: '合约地址未初始化' };
        }

        try {
          set({ isOperating: true, error: null });
          console.log('🚀 开始精确输出交换...', { amountOut, tokenIn, tokenOut, slippageBps });

          // 这个方法需要完整的客户端参数，在 Hook 中实现
          console.warn('swapExactOutput 需要完整的客户端参数，请在 Hook 中实现');

          set({ isOperating: false });
          return { success: false, error: '请在 Hook 中实现交换逻辑' };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '精确输出交换失败';
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
        pancakeAdapterAddress: null,
        usdtTokenAddress: null,
        cakeTokenAddress: null,
        routerAddress: null,
        userBalance: null,
        exchangeRate: null,
        isLoading: false,
        isOperating: false,
        error: null,
      }),
    }),
    {
      name: 'pancakeswap-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

export default usePancakeSwapStore;