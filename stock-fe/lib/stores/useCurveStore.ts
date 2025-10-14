import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import {
  Address,
  formatUnits,
  parseUnits,
  Abi,
  PublicClient,
  WalletClient,
  Chain,
  TransactionReceipt,
  Hex
} from 'viem';

// 导入 ABI 文件
import CurveAdapterABI from '@/lib/abi/CurveAdapter.json';
import DefiAggregatorABI from '@/lib/abi/DefiAggregator.json';
import MockERC20ABI from '@/lib/abi/MockERC20.json';

// 导入部署配置文件 - 不硬编码地址
import CurveDeploymentInfo from '@/lib/abi/deployments-curve-adapter-sepolia.json';

// ==================== 类型定义 ====================

/**
 * Curve 操作类型枚举（基于测试用例）
 */
export enum CurveOperationType {
  ADD_LIQUIDITY = 2,    // 添加流动性
  REMOVE_LIQUIDITY = 3, // 移除流动性
}

/**
 * 操作参数类型（基于测试用例）
 */
export interface CurveOperationParams {
  tokens: Address[];
  amounts: string[]; // 统一使用字符串类型
  recipient: Address;
  deadline: number;
  tokenId: string;
  extraData: Hex;
}

/**
 * 操作结果类型（基于 DefiAggregator 返回结构）
 */
export interface CurveOperationResult {
  success: boolean;
  outputAmounts: bigint[];
  returnData: Hex;
  message: string;
}

/**
 * 交易结果类型
 */
export interface CurveTransactionResult {
  hash: `0x${string}`;
  receipt: TransactionReceipt;
  result: CurveOperationResult;
}

/**
 * Curve 池信息类型
 */
export interface CurvePoolInfo {
  defiAggregator: Address;
  curveAdapter: Address;
  usdcToken: Address;
  usdtToken: Address;
  daiToken: Address;
  curvePool: Address;
  adapterName: string;
  adapterVersion: string;
  supportedOperations: CurveOperationType[];
  feeRateBps: number;
}

/**
 * 用户余额信息类型
 */
export interface CurveUserBalanceInfo {
  usdcBalance: bigint;     // USDC 余额
  usdtBalance: bigint;     // USDT 余额
  daiBalance: bigint;      // DAI 余额
  usdcAllowance: bigint;   // 授权给 CurveAdapter 的 USDT 数量
  usdtAllowance: bigint;   // 授权给 CurveAdapter 的 USDT 数量
  daiAllowance: bigint;    // 授权给 CurveAdapter 的 DAI 数量
  lpTokenBalance: bigint;  // LP 代币余额
  lpTokenAllowance: bigint; // 授权给 CurveAdapter 的 LP 代币数量
}

/**
 * 合约调用结果类型
 */
export interface CurveContractCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 流动性位置信息类型
 */
export interface CurvePositionInfo {
  lpTokenBalance: bigint;
  lpTokenValueUSD: number;
  formattedLpBalance: string;
  timestamp: number;
}

// ==================== 辅助函数 ====================

/**
 * 确保地址是有效的 0x 开头的格式
 */
function ensureAddress(address: string | Address): Address {
  if (typeof address === 'string') {
    return address.startsWith('0x') ? address as Address : (`0x${address}`) as Address;
  }
  return address;
}

// ==================== 从配置文件获取地址 ====================
const defiAggregatorAddress = ensureAddress(CurveDeploymentInfo.contracts.DefiAggregator);
const curveAdapterAddress = ensureAddress(CurveDeploymentInfo.contracts.CurveAdapter);
const usdcTokenAddress = ensureAddress(CurveDeploymentInfo.contracts.MockERC20_USDC);
const usdtTokenAddress = ensureAddress(CurveDeploymentInfo.contracts.MockERC20_USDT);
const daiTokenAddress = ensureAddress(CurveDeploymentInfo.contracts.MockERC20_DAI);
const curvePoolAddress = ensureAddress(CurveDeploymentInfo.contracts.MockCurve);

// 代币精度配置（基于测试文件）
const TOKEN_DECIMALS = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  LP_TOKEN: 18,
} as const;

// ==================== 类型化 ABI ====================
const typedCurveAdapterABI = CurveAdapterABI as Abi;
const typedDefiAggregatorABI = DefiAggregatorABI as Abi;
const typedMockERC20ABI = MockERC20ABI as Abi;

// ==================== Store 状态定义 ====================
interface CurveState {
  // 基础状态
  defiAggregatorAddress: Address | null;
  curveAdapterAddress: Address | null;
  poolInfo: CurvePoolInfo | null;
  userBalance: CurveUserBalanceInfo | null;
  userPositions: CurvePositionInfo[];

  // 操作状态
  isLoading: boolean;
  isOperating: boolean;
  error: string | null;

  // 基础方法
  initContracts: () => void;
  setLoading: (loading: boolean) => void;
  setOperating: (operating: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  // 读取方法
  fetchPoolInfo: (publicClient: PublicClient) => Promise<CurveContractCallResult>;
  fetchUserBalance: (publicClient: PublicClient, userAddress: Address) => Promise<CurveContractCallResult>;
  fetchAllowances: (publicClient: PublicClient, userAddress: Address) => Promise<CurveContractCallResult>;
  previewAddLiquidity: (publicClient: PublicClient, amounts: [bigint, bigint, bigint]) => Promise<CurveContractCallResult>;
  previewRemoveLiquidity: (publicClient: PublicClient, lpAmount: bigint) => Promise<CurveContractCallResult>;

  // 写入方法 - 授权（严格按照测试文件：授权给 CurveAdapter）
  approveUSDC: (publicClient: PublicClient, walletClient: WalletClient, chain: Chain, account: Address, amount: bigint) => Promise<CurveContractCallResult>;
  approveUSDT: (publicClient: PublicClient, walletClient: WalletClient, chain: Chain, account: Address, amount: bigint) => Promise<CurveContractCallResult>;
  approveDAI: (publicClient: PublicClient, walletClient: WalletClient, chain: Chain, account: Address, amount: bigint) => Promise<CurveContractCallResult>;
  approveLPToken: (publicClient: PublicClient, walletClient: WalletClient, chain: Chain, account: Address, amount: bigint) => Promise<CurveContractCallResult>;

  // 写入方法 - 交易（严格按照测试文件逻辑）
  addLiquidity: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    account: Address,
    params: {
      amounts: [string, string, string]; // [USDC, USDT, DAI]
      recipient?: Address;
      deadline?: number;
    }
  ) => Promise<CurveContractCallResult>;

  removeLiquidity: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    account: Address,
    params: {
      lpAmount: string;
      recipient?: Address;
      deadline?: number;
    }
  ) => Promise<CurveContractCallResult>;
}

// ==================== Store 创建 ====================
export const useCurveStore = create<CurveState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // 初始状态
      defiAggregatorAddress: null,
      curveAdapterAddress: null,
      poolInfo: null,
      userBalance: null,
      userPositions: [],
      isLoading: false,
      isOperating: false,
      error: null,

      // 基础方法实现
      initContracts: () => {
        try {
          console.log('🔧 初始化 Curve 合约地址...');
          console.log('📋 DefiAggregator:', defiAggregatorAddress);
          console.log('📋 CurveAdapter:', curveAdapterAddress);
          console.log('📋 USDC Token:', usdcTokenAddress);
          console.log('📋 USDT Token:', usdtTokenAddress);
          console.log('📋 DAI Token:', daiTokenAddress);
          console.log('📋 Curve Pool:', curvePoolAddress);
          console.log('📋 网络:', CurveDeploymentInfo.network);
          console.log('📋 手续费率:', CurveDeploymentInfo.feeRateBps, 'BPS');

          set({
            defiAggregatorAddress,
            curveAdapterAddress,
            error: null
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '初始化合约失败';
          set({ error: errorMsg });
          console.error('❌ 初始化合约失败:', errorMsg);
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setOperating: (operating: boolean) => {
        set({ isOperating: operating });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set({
          defiAggregatorAddress: null,
          curveAdapterAddress: null,
          poolInfo: null,
          userBalance: null,
          userPositions: [],
          isLoading: false,
          isOperating: false,
          error: null,
        });
      },

      // ==================== 读取方法实现 ====================

      /**
       * 获取 Curve 池信息
       */
      fetchPoolInfo: async (publicClient: PublicClient): Promise<CurveContractCallResult> => {
        try {
          console.log('🔍 获取 Curve 池信息...');
          set({ isLoading: true, error: null });

          const [adapterName, adapterVersion, curve3Pool] = await Promise.all([
            publicClient.readContract({
              address: curveAdapterAddress,
              abi: typedCurveAdapterABI,
              functionName: 'getAdapterName',
            }),
            publicClient.readContract({
              address: curveAdapterAddress,
              abi: typedCurveAdapterABI,
              functionName: 'getAdapterVersion',
            }),
            publicClient.readContract({
              address: curveAdapterAddress,
              abi: typedCurveAdapterABI,
              functionName: 'curve3Pool',
            }),
          ]);

          const poolInfo: CurvePoolInfo = {
            defiAggregator: defiAggregatorAddress,
            curveAdapter: curveAdapterAddress,
            usdcToken: usdcTokenAddress,
            usdtToken: usdtTokenAddress,
            daiToken: daiTokenAddress,
            curvePool: curve3Pool as Address,
            adapterName: adapterName as string,
            adapterVersion: adapterVersion as string,
            supportedOperations: [CurveOperationType.ADD_LIQUIDITY, CurveOperationType.REMOVE_LIQUIDITY],
            feeRateBps: CurveDeploymentInfo.feeRateBps,
          };

          console.log('✅ Curve 池信息获取成功:', poolInfo);
          set({ poolInfo, isLoading: false });

          return {
            success: true,
            data: poolInfo
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取 Curve 池信息失败';
          set({ error: errorMsg, isLoading: false });
          console.error('❌ 获取 Curve 池信息失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 获取用户余额信息
       */
      fetchUserBalance: async (publicClient: PublicClient, userAddress: Address): Promise<CurveContractCallResult> => {
        try {
          console.log('💰 获取用户余额...', { userAddress });
          set({ isLoading: true, error: null });

          // 并行获取所有代币余额
          const [usdcBalance, usdtBalance, daiBalance, lpTokenBalance] = await Promise.all([
            publicClient.readContract({
              address: usdcTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            publicClient.readContract({
              address: usdtTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            publicClient.readContract({
              address: daiTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
            publicClient.readContract({
              address: curvePoolAddress,
              abi: typedMockERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }),
          ]);

          console.log('📊 余额查询结果:', {
            usdcBalance: formatUnits(usdcBalance as bigint, TOKEN_DECIMALS.USDC),
            usdtBalance: formatUnits(usdtBalance as bigint, TOKEN_DECIMALS.USDT),
            daiBalance: formatUnits(daiBalance as bigint, TOKEN_DECIMALS.DAI),
            lpTokenBalance: formatUnits(lpTokenBalance as bigint, TOKEN_DECIMALS.LP_TOKEN),
          });

          const balanceInfo: CurveUserBalanceInfo = {
            usdcBalance: usdcBalance as bigint,
            usdtBalance: usdtBalance as bigint,
            daiBalance: daiBalance as bigint,
            lpTokenBalance: lpTokenBalance as bigint,
            usdcAllowance: BigInt(0),
            usdtAllowance: BigInt(0),
            daiAllowance: BigInt(0),
            lpTokenAllowance: BigInt(0),
          };

          console.log('✅ 用户余额获取成功');
          set({ userBalance: balanceInfo, isLoading: false });

          return {
            success: true,
            data: balanceInfo
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取用户余额失败';
          set({ error: errorMsg, isLoading: false });
          console.error('❌ 获取用户余额失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 获取授权信息（严格按照测试文件：检查对 CurveAdapter 的授权）
       */
      fetchAllowances: async (publicClient: PublicClient, userAddress: Address): Promise<CurveContractCallResult> => {
        try {
          console.log('🔑 获取授权信息...');
          console.log('📋 授权目标:', curveAdapterAddress);

          const [usdcAllowance, usdtAllowance, daiAllowance, lpTokenAllowance] = await Promise.all([
            publicClient.readContract({
              address: usdcTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'allowance',
              args: [userAddress, curveAdapterAddress],
            }),
            publicClient.readContract({
              address: usdtTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'allowance',
              args: [userAddress, curveAdapterAddress],
            }),
            publicClient.readContract({
              address: daiTokenAddress,
              abi: typedMockERC20ABI,
              functionName: 'allowance',
              args: [userAddress, curveAdapterAddress],
            }),
            publicClient.readContract({
              address: curvePoolAddress,
              abi: typedMockERC20ABI,
              functionName: 'allowance',
              args: [userAddress, curveAdapterAddress],
            }),
          ]);

          console.log('📊 授权查询结果:', {
            usdcAllowance: formatUnits(usdcAllowance as bigint, TOKEN_DECIMALS.USDC),
            usdtAllowance: formatUnits(usdtAllowance as bigint, TOKEN_DECIMALS.USDT),
            daiAllowance: formatUnits(daiAllowance as bigint, TOKEN_DECIMALS.DAI),
            lpTokenAllowance: formatUnits(lpTokenAllowance as bigint, TOKEN_DECIMALS.LP_TOKEN),
          });

          // 更新当前余额信息中的授权状态
          const currentBalance = get().userBalance;
          if (currentBalance) {
            const updatedBalance = {
              ...currentBalance,
              usdcAllowance: usdcAllowance as bigint,
              usdtAllowance: usdtAllowance as bigint,
              daiAllowance: daiAllowance as bigint,
              lpTokenAllowance: lpTokenAllowance as bigint,
            };
            set({ userBalance: updatedBalance });
          }

          return {
            success: true,
            data: {
              usdcAllowance: usdcAllowance as bigint,
              usdtAllowance: usdtAllowance as bigint,
              daiAllowance: daiAllowance as bigint,
              lpTokenAllowance: lpTokenAllowance as bigint,
            }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取授权信息失败';
          console.error('❌ 获取授权信息失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 预览添加流动性
       */
      previewAddLiquidity: async (publicClient: PublicClient, amounts: [bigint, bigint, bigint]): Promise<CurveContractCallResult> => {
        try {
          console.log('🔮 预览添加流动性...', amounts.map(a => a.toString()));

          const lpTokens = await publicClient.readContract({
            address: curveAdapterAddress,
            abi: typedCurveAdapterABI,
            functionName: 'previewAddLiquidity',
            args: [amounts],
          });

          console.log('✅ 预览添加流动性成功:', formatUnits(lpTokens as bigint, TOKEN_DECIMALS.LP_TOKEN));

          return {
            success: true,
            data: {
              lpTokens: lpTokens as bigint,
              formattedLpTokens: formatUnits(lpTokens as bigint, TOKEN_DECIMALS.LP_TOKEN),
            }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '预览添加流动性失败';
          console.error('❌ 预览添加流动性失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 预览移除流动性
       */
      previewRemoveLiquidity: async (publicClient: PublicClient, lpAmount: bigint): Promise<CurveContractCallResult> => {
        try {
          console.log('🔮 预览移除流动性...', lpAmount.toString());

          const amounts = await publicClient.readContract({
            address: curveAdapterAddress,
            abi: typedCurveAdapterABI,
            functionName: 'previewRemoveLiquidity',
            args: [lpAmount],
          });

          const amountsArray = amounts as readonly [bigint, bigint, bigint];

          console.log('✅ 预览移除流动性成功:', {
            usdcAmount: formatUnits(amountsArray[0], TOKEN_DECIMALS.USDC),
            usdtAmount: formatUnits(amountsArray[1], TOKEN_DECIMALS.USDT),
            daiAmount: formatUnits(amountsArray[2], TOKEN_DECIMALS.DAI),
          });

          return {
            success: true,
            data: {
              usdcAmount: amountsArray[0],
              usdtAmount: amountsArray[1],
              daiAmount: amountsArray[2],
              formatted: {
                usdcAmount: formatUnits(amountsArray[0], TOKEN_DECIMALS.USDC),
                usdtAmount: formatUnits(amountsArray[1], TOKEN_DECIMALS.USDT),
                daiAmount: formatUnits(amountsArray[2], TOKEN_DECIMALS.DAI),
              }
            }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '预览移除流动性失败';
          console.error('❌ 预览移除流动性失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      // ==================== 写入方法实现 ====================

      /**
       * 授权 USDC 给 CurveAdapter（严格按照测试文件逻辑）
       */
      approveUSDC: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        amount: bigint
      ): Promise<CurveContractCallResult> => {
        try {
          console.log('🔑 授权 USDC 给 CurveAdapter...', { amount: amount.toString() });

          const hash = await walletClient.writeContract({
            address: usdcTokenAddress,
            abi: typedMockERC20ABI,
            functionName: 'approve',
            args: [curveAdapterAddress, amount], // 授权给 CurveAdapter
            chain,
            account,
          });

          console.log('📝 USDC 授权交易哈希:', hash);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log('✅ USDC 授权完成');

          // 刷新授权状态
          await get().fetchAllowances(publicClient, account);

          return {
            success: true,
            data: { hash, receipt }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'USDC 授权失败';
          console.error('❌ USDC 授权失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 授权 USDT 给 CurveAdapter（严格按照测试文件逻辑）
       */
      approveUSDT: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        amount: bigint
      ): Promise<CurveContractCallResult> => {
        try {
          console.log('🔑 授权 USDT 给 CurveAdapter...', { amount: amount.toString() });

          const hash = await walletClient.writeContract({
            address: usdtTokenAddress,
            abi: typedMockERC20ABI,
            functionName: 'approve',
            args: [curveAdapterAddress, amount], // 授权给 CurveAdapter
            chain,
            account,
          });

          console.log('📝 USDT 授权交易哈希:', hash);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log('✅ USDT 授权完成');

          // 刷新授权状态
          await get().fetchAllowances(publicClient, account);

          return {
            success: true,
            data: { hash, receipt }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'USDT 授权失败';
          console.error('❌ USDT 授权失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 授权 DAI 给 CurveAdapter（严格按照测试文件逻辑）
       */
      approveDAI: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        amount: bigint
      ): Promise<CurveContractCallResult> => {
        try {
          console.log('🔑 授权 DAI 给 CurveAdapter...', { amount: amount.toString() });

          const hash = await walletClient.writeContract({
            address: daiTokenAddress,
            abi: typedMockERC20ABI,
            functionName: 'approve',
            args: [curveAdapterAddress, amount], // 授权给 CurveAdapter
            chain,
            account,
          });

          console.log('📝 DAI 授权交易哈希:', hash);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log('✅ DAI 授权完成');

          // 刷新授权状态
          await get().fetchAllowances(publicClient, account);

          return {
            success: true,
            data: { hash, receipt }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'DAI 授权失败';
          console.error('❌ DAI 授权失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 授权 LP 代币给 CurveAdapter（严格按照测试文件逻辑）
       */
      approveLPToken: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        amount: bigint
      ): Promise<CurveContractCallResult> => {
        try {
          console.log('🔑 授权 LP 代币给 CurveAdapter...', { amount: amount.toString() });

          const hash = await walletClient.writeContract({
            address: curvePoolAddress,
            abi: typedMockERC20ABI,
            functionName: 'approve',
            args: [curveAdapterAddress, amount], // 授权给 CurveAdapter
            chain,
            account,
          });

          console.log('📝 LP 代币授权交易哈希:', hash);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log('✅ LP 代币授权完成');

          // 刷新授权状态
          await get().fetchAllowances(publicClient, account);

          return {
            success: true,
            data: { hash, receipt }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'LP 代币授权失败';
          console.error('❌ LP 代币授权失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 添加流动性（严格按照测试文件逻辑和参数格式）
       */
      addLiquidity: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        params: {
          amounts: [string, string, string]; // [USDC, USDT, DAI]
          recipient?: Address;
          deadline?: number;
        }
      ): Promise<CurveContractCallResult> => {
        try {
          console.log('🚀 开始添加流动性...');
          console.log('📋 参数:', params);

          set({ isOperating: true, error: null });

          // 严格按照测试文件的参数格式构造操作参数
          const operationParams: CurveOperationParams = {
            tokens: [usdcTokenAddress, usdtTokenAddress, daiTokenAddress],
            amounts: [
              parseUnits(params.amounts[0], TOKEN_DECIMALS.USDC).toString(),  // USDC
              parseUnits(params.amounts[1], TOKEN_DECIMALS.USDT).toString(),  // USDT
              parseUnits(params.amounts[2], TOKEN_DECIMALS.DAI).toString(),   // DAI
              "0"  // 重要：第4个元素固定为0（按照测试文件格式）
            ],
            recipient: params.recipient || account,
            deadline: params.deadline || Math.floor(Date.now() / 1000) + 3600,
            tokenId: "0",
            extraData: "0x" as Hex,
          };

          console.log('📋 操作参数（完全按测试格式）:', operationParams);

          // 通过 DefiAggregator 调用（严格按照测试文件逻辑）
          const hash = await walletClient.writeContract({
            address: defiAggregatorAddress,
            abi: typedDefiAggregatorABI,
            functionName: 'executeOperation',
            args: [
              "curve",                                // 适配器名称
              CurveOperationType.ADD_LIQUIDITY,      // 操作类型
              operationParams                         // 操作参数
            ],
            chain,
            account,
          });

          console.log('📝 添加流动性交易哈希:', hash);

          console.log('⏳ 等待交易确认...');
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log('✅ 交易已确认');

          set({ isOperating: false });

          return {
            success: true,
            data: { hash, receipt }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '添加流动性失败';
          set({ error: errorMsg, isOperating: false });
          console.error('❌ 添加流动性失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },

      /**
       * 移除流动性（严格按照测试文件逻辑和参数格式）
       */
      removeLiquidity: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        params: {
          lpAmount: string;
          recipient?: Address;
          deadline?: number;
        }
      ): Promise<CurveContractCallResult> => {
        try {
          console.log('🚀 开始移除流动性...');
          console.log('📋 参数:', params);

          set({ isOperating: true, error: null });

          // 严格按照测试文件的参数格式构造操作参数
          const operationParams: CurveOperationParams = {
            tokens: [usdcTokenAddress, usdtTokenAddress, daiTokenAddress],
            amounts: [
              parseUnits(params.lpAmount, TOKEN_DECIMALS.LP_TOKEN).toString(), // LP 代币数量
              "0",  // 最小接收 USDC 数量
              "0",  // 最小接收 USDT 数量
              "0",  // 最小接收 DAI 数量
            ],
            recipient: params.recipient || account,
            deadline: params.deadline || Math.floor(Date.now() / 1000) + 3600,
            tokenId: "0",
            extraData: "0x" as Hex,
          };

          console.log('📋 操作参数（完全按测试格式）:', operationParams);

          // 通过 DefiAggregator 调用（严格按照测试文件逻辑）
          const hash = await walletClient.writeContract({
            address: defiAggregatorAddress,
            abi: typedDefiAggregatorABI,
            functionName: 'executeOperation',
            args: [
              "curve",                                // 适配器名称
              CurveOperationType.REMOVE_LIQUIDITY,   // 操作类型
              operationParams                         // 操作参数
            ],
            chain,
            account,
          });

          console.log('📝 移除流动性交易哈希:', hash);

          console.log('⏳ 等待交易确认...');
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log('✅ 交易已确认');

          set({ isOperating: false });

          return {
            success: true,
            data: { hash, receipt }
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '移除流动性失败';
          set({ error: errorMsg, isOperating: false });
          console.error('❌ 移除流动性失败:', errorMsg);

          return {
            success: false,
            error: errorMsg
          };
        }
      },
    })),
    {
      name: 'curve-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

export default useCurveStore;