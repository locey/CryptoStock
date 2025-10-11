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
  decodeEventLog as viemDecodeEventLog,
  encodeAbiParameters,
  decodeAbiParameters,
} from 'viem';
import UniswapV3AdapterABI from '@/lib/abi/UniswapV3Adapter.json';
import DefiAggregatorABI from '@/lib/abi/DefiAggregator.json';
import MockERC20ABI from '@/lib/abi/MockERC20.json';
import MockPositionManagerABI from '@/lib/abi/MockNonfungiblePositionManager.json';
import UniswapDeploymentInfo from '@/lib/abi/deployments-uniswapv3-adapter-sepolia.json';

// ==================== 类型定义 ====================

/**
 * Uniswap V3 操作类型枚举（基于测试用例）
 */
export enum UniswapOperationType {
  ADD_LIQUIDITY = 2,    // 添加流动性
  REMOVE_LIQUIDITY = 3, // 移除流动性
  COLLECT_FEES = 18,    // 收取手续费
}

/**
 * 操作参数类型（基于测试用例）
 */
export interface UniswapOperationParams {
  tokens: Address[];
  amounts: string[]; // 统一使用字符串类型
  recipient: Address;
  deadline: number;
  tokenId: string | bigint; // 支持字符串或 bigint
  extraData: Hex;
}

/**
 * 操作结果类型（基于 DefiAggregator 返回结构）
 */
export interface UniswapOperationResult {
  success: boolean;
  outputAmounts: bigint[];
  returnData: Hex;
  message: string;
}

/**
 * 交易结果类型
 */
export interface UniswapTransactionResult {
  hash: `0x${string}`;
  receipt: TransactionReceipt;
  result: UniswapOperationResult;
}

/**
 * Uniswap V3 池信息类型
 */
export interface UniswapPoolInfo {
  defiAggregator: Address;
  uniswapV3Adapter: Address;
  usdtToken: Address;
  wethToken: Address;
  positionManager: Address;
  adapterName: string;
  adapterVersion: string;
  contractVersion: string;
  supportedOperations: UniswapOperationType[];
  feeRateBps: number; // 手续费率（基点）
}

/**
 * 位置信息类型
 */
export interface UniswapPositionInfo {
  tokenId: bigint;
  nonce: bigint;
  operator: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  token0ValueUSD?: number;
  token1ValueUSD?: number;
}

/**
 * 用户余额信息类型
 */
export interface UserBalanceInfo {
  usdtBalance: bigint;     // 用户持有的 USDT 余额
  wethBalance: bigint;     // 用户持有的 WETH 余额
  usdtAllowance: bigint;   // 用户授权给 UniswapV3Adapter 的 USDT 数量
  wethAllowance: bigint;   // 用户授权给 UniswapV3Adapter 的 WETH 数量
  nftAllowance: bigint;    // 用户授权给 UniswapV3Adapter 的 NFT 数量
}

/**
 * OperationExecuted 事件参数类型
 */
export interface OperationExecutedEventArgs {
  user: Address;
  operationType: number;
  tokens: Address[];
  amounts: bigint[];
  returnData: Hex;
}

/**
 * FeesCollected 事件参数类型
 */
export interface FeesCollectedEventArgs {
  user: Address;
  tokenId: bigint;
  amount0: bigint;
  amount1: bigint;
}

/**
 * 解码事件日志的返回类型
 */
export interface DecodedOperationExecutedEvent {
  eventName: 'OperationExecuted';
  args: OperationExecutedEventArgs;
}

export interface DecodedFeesCollectedEvent {
  eventName: 'FeesCollected';
  args: FeesCollectedEventArgs;
}

// ==================== Store 状态定义 ====================
interface UniswapState {
  // ==================== 状态 ====================
  /** DefiAggregator 合约地址 */
  defiAggregatorAddress: Address | null;
  /** UniswapV3 适配器合约地址 */
  uniswapV3AdapterAddress: Address | null;
  /** Uniswap V3 池信息 */
  poolInfo: UniswapPoolInfo | null;
  /** 用户余额信息 */
  userBalance: UserBalanceInfo | null;
  /** 用户位置信息 */
  userPositions: UniswapPositionInfo[];
  /** 选中的位置 */
  selectedPosition: UniswapPositionInfo | null;
  /** 加载状态 */
  isLoading: boolean;
  /** 操作执行中的加载状态 */
  isOperating: boolean;
  /** 错误信息 */
  error: string | null;

  // ==================== 初始化方法 ====================
  /** 初始化合约地址 */
  initContracts: (defiAggregatorAddress: Address, uniswapV3AdapterAddress: Address) => void;
  /** 从部署文件初始化合约地址 */
  initFromDeployment: () => void;

  // ==================== 读取方法 ====================
  /** 获取 Uniswap V3 池信息 */
  fetchPoolInfo: (publicClient: PublicClient) => Promise<void>;
  /** 获取用户余额信息 */
  fetchUserBalance: (publicClient: PublicClient, userAddress: Address) => Promise<void>;
  /** 获取用户位置信息 */
  fetchUserPositions: (publicClient: PublicClient, userAddress: Address) => Promise<void>;
  /** 获取用户 USDT 余额 */
  fetchUserUSDTBalance: (publicClient: PublicClient, userAddress: Address) => Promise<bigint>;
  /** 获取用户 WETH 余额 */
  fetchUserWETHBalance: (publicClient: PublicClient, userAddress: Address) => Promise<bigint>;
  /** 获取授权信息 */
  fetchAllowances: (publicClient: PublicClient, userAddress: Address) => Promise<{ usdtAllowance: bigint; wethAllowance: bigint; nftAllowance: bigint }>;
  /** 获取位置详情 */
  fetchPositionDetails: (publicClient: PublicClient, tokenId: bigint) => Promise<UniswapPositionInfo>;
  /** 获取手续费率 */
  fetchFeeRate: (publicClient: PublicClient) => Promise<number>;

  // ==================== 写入方法 ====================
  /** 授权 USDT 给 UniswapV3Adapter */
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

  /** 授权 WETH 给 UniswapV3Adapter */
  approveWETH: (
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

  /** 授权 NFT 给 UniswapV3Adapter */
  approveNFT: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    tokenId: bigint,
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<TransactionReceipt>;

  /** 全局授权所有 NFT 给 UniswapV3Adapter (用于添加流动性前的准备) */
  approveAllNFT: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<TransactionReceipt>;

  /** 添加流动性（基于测试用例逻辑） */
  addLiquidity: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: {
      token0: Address;
      token1: Address;
      amount0: string;
      amount1: string;
      amount0Min: string;
      amount1Min: string;
      tickLower?: number;
      tickUpper?: number;
      recipient: Address;
      deadline?: number;
    },
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<UniswapTransactionResult>;

  /** 移除流动性（基于测试用例逻辑） */
  removeLiquidity: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: {
      tokenId: bigint;
      amount0Min?: string;
      amount1Min?: string;
      recipient: Address;
      deadline?: number;
    },
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<UniswapTransactionResult>;

  /** 收取手续费（基于测试用例逻辑） */
  collectFees: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: {
      tokenId: bigint;
      recipient: Address;
      deadline?: number;
    },
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ) => Promise<UniswapTransactionResult>;

  // ==================== 辅助方法 ====================
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置操作状态 */
  setOperating: (operating: boolean) => void;
  /** 设置错误信息 */
  setError: (error: string | null) => void;
  /** 清除错误信息 */
  clearErrors: () => void;
  /** 选择位置 */
  selectPosition: (position: UniswapPositionInfo | null) => void;
  /** 重置状态 */
  reset: () => void;
}

// ==================== 类型化 ABI ====================
const typedDefiAggregatorABI = DefiAggregatorABI as Abi;
const typedUniswapV3AdapterABI = UniswapV3AdapterABI as Abi;
const typedMockERC20ABI = MockERC20ABI as Abi;
const typedMockPositionManagerABI = MockPositionManagerABI as Abi;

// ==================== Store 创建 ====================
export const useUniswapStore = create<UniswapState>()(
  devtools(
    (set, get) => ({
  // ==================== 初始状态 ====================
  defiAggregatorAddress: null,
  uniswapV3AdapterAddress: null,
  poolInfo: null,
  userBalance: null,
  userPositions: [],
  selectedPosition: null,
  isLoading: false,
  isOperating: false,
  error: null,

  // ==================== 初始化方法 ====================
  /**
   * 初始化合约地址
   */
  initContracts: (defiAggregatorAddress: Address, uniswapV3AdapterAddress: Address) => {
    try {
      set({
        defiAggregatorAddress,
        uniswapV3AdapterAddress,
        error: null
      });
      console.log('✅ DefiAggregator 合约地址已初始化:', defiAggregatorAddress);
      console.log('✅ UniswapV3Adapter 合约地址已初始化:', uniswapV3AdapterAddress);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '初始化合约失败';
      set({ error: errorMsg });
      console.error('❌ 初始化合约失败:', errorMsg);
    }
  },

  /**
   * 从部署文件初始化合约地址
   */
  initFromDeployment: () => {
    try {
      // 直接从导入的部署文件中获取地址
      const defiAggregatorAddress = UniswapDeploymentInfo.contracts.DefiAggregator as Address;
      const uniswapV3AdapterAddress = UniswapDeploymentInfo.contracts.UniswapV3Adapter as Address;
      const usdtTokenAddress = UniswapDeploymentInfo.contracts.MockERC20_USDT as Address;
      const wethTokenAddress = UniswapDeploymentInfo.contracts.MockWethToken as Address;
      const positionManagerAddress = UniswapDeploymentInfo.contracts.MockPositionManager as Address;

      set({
        defiAggregatorAddress,
        uniswapV3AdapterAddress,
        error: null
      });

      console.log('✅ 从部署文件初始化合约地址:');
      console.log('   DefiAggregator:', defiAggregatorAddress);
      console.log('   UniswapV3Adapter:', uniswapV3AdapterAddress);
      console.log('   USDT Token:', usdtTokenAddress);
      console.log('   WETH Token:', wethTokenAddress);
      console.log('   PositionManager:', positionManagerAddress);
      console.log('   网络:', UniswapDeploymentInfo.network);
      console.log('   手续费率:', UniswapDeploymentInfo.feeRateBps, 'BPS');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '从部署文件初始化失败';
      set({ error: errorMsg });
      console.error('❌ 从部署文件初始化失败:', errorMsg);
    }
  },

  // ==================== 读取方法 ====================
  /**
   * 获取 Uniswap V3 池信息
   */
  fetchPoolInfo: async (publicClient: PublicClient) => {
    const { defiAggregatorAddress, uniswapV3AdapterAddress } = get();
    if (!defiAggregatorAddress || !uniswapV3AdapterAddress) {
      set({ error: '合约地址未初始化' });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('🔍 获取 Uniswap V3 池信息...');

      const [feeRateBps, usdtToken, wethToken, positionManager, adapterName, adapterVersion, contractVersion] = await Promise.all([
        publicClient.readContract({
          address: defiAggregatorAddress,
          abi: typedDefiAggregatorABI,
          functionName: 'feeRateBps',
        }),
        publicClient.readContract({
          address: uniswapV3AdapterAddress,
          abi: typedUniswapV3AdapterABI,
          functionName: 'usdtToken',
        }),
        publicClient.readContract({
          address: uniswapV3AdapterAddress,
          abi: typedUniswapV3AdapterABI,
          functionName: 'wethToken',
        }),
        publicClient.readContract({
          address: uniswapV3AdapterAddress,
          abi: typedUniswapV3AdapterABI,
          functionName: 'positionManager',
        }),
        publicClient.readContract({
          address: uniswapV3AdapterAddress,
          abi: typedUniswapV3AdapterABI,
          functionName: 'getAdapterName',
        }),
        publicClient.readContract({
          address: uniswapV3AdapterAddress,
          abi: typedUniswapV3AdapterABI,
          functionName: 'getAdapterVersion',
        }),
        publicClient.readContract({
          address: uniswapV3AdapterAddress,
          abi: typedUniswapV3AdapterABI,
          functionName: 'getContractVersion',
        }),
      ]);

      const poolInfo: UniswapPoolInfo = {
        defiAggregator: defiAggregatorAddress,
        uniswapV3Adapter: uniswapV3AdapterAddress,
        usdtToken: usdtToken as Address,
        wethToken: wethToken as Address,
        positionManager: positionManager as Address,
        adapterName: adapterName as string,
        adapterVersion: adapterVersion as string,
        contractVersion: contractVersion as string,
        supportedOperations: [UniswapOperationType.ADD_LIQUIDITY, UniswapOperationType.REMOVE_LIQUIDITY, UniswapOperationType.COLLECT_FEES],
        feeRateBps: Number(feeRateBps),
      };

      console.log('✅ Uniswap V3 池信息获取成功:', poolInfo);
      set({ poolInfo, isLoading: false });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取 Uniswap V3 池信息失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取 Uniswap V3 池信息失败:', errorMsg);
    }
  },

  /**
   * 获取用户余额信息
   */
  fetchUserBalance: async (publicClient: PublicClient, userAddress: Address) => {
    try {
      set({ isLoading: true, error: null });
      console.log('🔍 获取用户余额信息...');

      const [usdtBalance, wethBalance, { usdtAllowance, wethAllowance, nftAllowance }] = await Promise.all([
        get().fetchUserUSDTBalance(publicClient, userAddress),
        get().fetchUserWETHBalance(publicClient, userAddress),
        get().fetchAllowances(publicClient, userAddress),
      ]);

      const balanceInfo: UserBalanceInfo = {
        usdtBalance,
        wethBalance,
        usdtAllowance,
        wethAllowance,
        nftAllowance,
      };

      console.log('✅ 用户余额信息获取成功:', balanceInfo);
      set({ userBalance: balanceInfo, isLoading: false });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取用户余额信息失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取用户余额信息失败:', errorMsg);
    }
  },

  /**
   * 获取用户位置信息
   */
  fetchUserPositions: async (publicClient: PublicClient, userAddress: Address) => {
    const { uniswapV3AdapterAddress } = get();
    if (!uniswapV3AdapterAddress) {
      set({ error: '合约地址未初始化' });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('🔍 获取用户位置信息...');

      // 直接使用替代方案，因为 MockNonfungiblePositionManager 没有实现 tokenOfOwnerByIndex
      console.log('🔄 MockNonfungiblePositionManager 不支持 tokenOfOwnerByIndex，使用替代方案...');
      await get().fetchUserPositionsFallback(publicClient, userAddress);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取用户位置信息失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取用户位置信息失败:', errorMsg);
    }
  },

  /**
   * 替代方案：直接检查已知的位置
   */
  fetchUserPositionsFallback: async (publicClient: PublicClient, userAddress: Address) => {
    const positionManagerAddress = UniswapDeploymentInfo.contracts.MockPositionManager as Address;

    try {
      console.log('🔧 使用替代方案获取位置信息...');

      const positions: UniswapPositionInfo[] = [];
      const maxTokenId = 10000; // 大幅增加搜索范围到 10000
      console.log(`🔍 搜索 Token ID 范围: 1-${maxTokenId}`);

      for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
        try {
          // 检查这个 tokenId 是否属于当前用户
          const owner = await publicClient.readContract({
            address: positionManagerAddress,
            abi: typedMockPositionManagerABI,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
          }) as Address;

          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            console.log(`✅ 找到用户拥有的 Token ID: ${tokenId}`);

            try {
              const position = await get().fetchPositionDetails(publicClient, BigInt(tokenId));

              // 添加所有位置，包括没有流动性的（可能是已经关闭但仍然存在的位置）
              positions.push(position);
              console.log(`✅ 添加位置 ${tokenId}:`);
              console.log(`   - 流动性: ${position.liquidity.toString()}`);
              console.log(`   - Token0: ${position.token0}`);
              console.log(`   - Token1: ${position.token1}`);
              console.log(`   - 待收取 Token0: ${position.tokensOwed0.toString()}`);
              console.log(`   - 待收取 Token1: ${position.tokensOwed1.toString()}`);
              console.log(`   - Fee: ${position.fee} (${position.fee / 10000}%)`);
              console.log(`   - Tick范围: [${position.tickLower}, ${position.tickUpper}]`);
            } catch (positionError) {
              console.warn(`⚠️ 获取位置 ${tokenId} 详情失败:`, positionError instanceof Error ? positionError.message : '未知错误');
              // 即使获取详情失败，也记录找到了 tokenId
              const fallbackPosition: UniswapPositionInfo = {
                tokenId: BigInt(tokenId),
                nonce: BigInt(0),
                operator: userAddress,
                token0: '0x0000000000000000000000000000000000000000' as Address,
                token1: '0x0000000000000000000000000000000000000000' as Address,
                fee: 0,
                tickLower: 0,
                tickUpper: 0,
                liquidity: BigInt(0),
                feeGrowthInside0LastX128: BigInt(0),
                feeGrowthInside1LastX128: BigInt(0),
                tokensOwed0: BigInt(0),
                tokensOwed1: BigInt(0),
              };
              positions.push(fallbackPosition);
            }
          }
        } catch (error) {
          // 这个 tokenId 可能不存在，继续尝试下一个
          // 由于搜索范围较大，这里不打印错误信息以避免日志过多
          continue;
        }
      }

      console.log(`✅ 替代方案成功获取到 ${positions.length} 个位置`);

      // 按 tokenId 排序
      positions.sort((a, b) => Number(a.tokenId - b.tokenId));

      console.log('🔍 [DEBUG] 准备更新 store，当前位置数量:', positions.length);

      // 添加更多调试信息
      console.log('🔍 [DEBUG] 当前 Store 状态更新前:', {
        isLoading: get().isLoading,
        userPositions: get().userPositions,
        userPositionsLength: get().userPositions.length
      });

      // 🔧 修复 Store 更新问题：强制触发 React 重新渲染
      console.log('🔍 [DEBUG] 正在调用 set() 方法...');
      set((state) => {
        console.log('🔍 [DEBUG] set() 函数内部，当前状态:', {
          currentPositions: state.userPositions,
          newPositions: positions,
          isLoading: state.isLoading
        });

        return {
          ...state,
          userPositions: positions,
          isLoading: false
        };
      });

      // 验证 set 是否成功 - 使用多个时间点检查
      setTimeout(() => {
        console.log('🔍 [DEBUG] Store 更新后状态 (100ms):', {
          isLoading: get().isLoading,
          userPositions: get().userPositions,
          userPositionsLength: get().userPositions.length
        });
      }, 100);

      setTimeout(() => {
        console.log('🔍 [DEBUG] Store 更新后状态 (500ms):', {
          isLoading: get().isLoading,
          userPositions: get().userPositions,
          userPositionsLength: get().userPositions.length
        });
      }, 500);

      if (positions.length === 0) {
        console.log('📝 用户当前没有任何 Uniswap V3 位置');
      } else {
        console.log('📋 用户位置摘要:');
        positions.forEach((pos, index) => {
          console.log(`  ${index + 1}. TokenID ${pos.tokenId}: 流动性=${pos.liquidity.toString()}, 待收取0=${pos.tokensOwed0.toString()}, 待收取1=${pos.tokensOwed1.toString()}`);
        });
      }
    } catch (fallbackError) {
      const errorMsg = fallbackError instanceof Error ? fallbackError.message : '替代方案也失败';
      console.error('❌ 替代方案也失败:', errorMsg);

      // 即使出错也要尝试更新 store - 使用正确的更新方式
      console.log('⚠️ 即使出错也要更新 store，当前位置数量:', positions.length);
      set((state) => ({
        ...state,
        userPositions: positions,
        isLoading: false
      }));
    }
  },

  /**
   * 获取用户 USDT 余额
   */
  fetchUserUSDTBalance: async (publicClient: PublicClient, userAddress: Address): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: UniswapDeploymentInfo.contracts.MockERC20_USDT as Address,
        abi: typedMockERC20ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });

      console.log(`💰 用户 USDT 余额: ${formatUnits(balance as bigint, 6)}`);
      return balance as bigint;
    } catch (error) {
      console.warn('获取用户 USDT 余额失败:', error);
      return BigInt(0);
    }
  },

  /**
   * 获取用户 WETH 余额
   */
  fetchUserWETHBalance: async (publicClient: PublicClient, userAddress: Address): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: UniswapDeploymentInfo.contracts.MockWethToken as Address,
        abi: typedMockERC20ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });

      console.log(`💰 用户 WETH 余额: ${formatUnits(balance as bigint, 18)}`);
      return balance as bigint;
    } catch (error) {
      console.warn('获取用户 WETH 余额失败:', error);
      return BigInt(0);
    }
  },

  /**
   * 获取授权信息 (检查对 UniswapV3Adapter 的授权，与测试用例保持一致)
   */
  fetchAllowances: async (publicClient: PublicClient, userAddress: Address): Promise<{ usdtAllowance: bigint; wethAllowance: bigint; nftAllowance: bigint }> => {
    const { uniswapV3AdapterAddress } = get();
    if (!uniswapV3AdapterAddress) {
      throw new Error('UniswapV3Adapter 合约地址未初始化');
    }

    try {
      const [usdtAllowance, wethAllowance] = await Promise.all([
        publicClient.readContract({
          address: UniswapDeploymentInfo.contracts.MockERC20_USDT as Address,
          abi: typedMockERC20ABI,
          functionName: 'allowance',
          args: [userAddress, uniswapV3AdapterAddress], // 🔧 与测试用例保持一致：检查对 UniswapV3Adapter 的授权
        }),
        publicClient.readContract({
          address: UniswapDeploymentInfo.contracts.MockWethToken as Address,
          abi: typedMockERC20ABI,
          functionName: 'allowance',
          args: [userAddress, uniswapV3AdapterAddress], // 🔧 与测试用例保持一致：检查对 UniswapV3Adapter 的授权
        }),
      ]);

      // NFT 授权检查：对于添加流动性，我们使用 setApprovalForAll 来全局授权
      let nftAllowance = BigInt(0);
      try {
        // 检查是否已经全局授权给 UniswapV3Adapter
        const isApprovedForAll = await publicClient.readContract({
          address: UniswapDeploymentInfo.contracts.MockPositionManager as Address,
          abi: typedMockPositionManagerABI, // MockPositionManager 使用 ERC721 接口
          functionName: 'isApprovedForAll',
          args: [userAddress, uniswapV3AdapterAddress],
        });
        nftAllowance = isApprovedForAll ? BigInt(1) : BigInt(0);
      } catch (e) {
        // 检查授权失败，忽略错误
        console.warn('检查 NFT 全局授权状态失败:', e);
      }

      console.log(`🔑 USDT 授权额度 (给 UniswapV3Adapter): ${formatUnits(usdtAllowance as bigint, 6)}`);
      console.log(`🔑 WETH 授权额度 (给 UniswapV3Adapter): ${formatUnits(wethAllowance as bigint, 18)}`);
      console.log(`🔑 NFT 授权状态: ${nftAllowance > 0 ? '已授权' : '未授权'}`);

      return {
        usdtAllowance: usdtAllowance as bigint,
        wethAllowance: wethAllowance as bigint,
        nftAllowance,
      };
    } catch (error) {
      console.warn('获取授权信息失败:', error);
      return { usdtAllowance: BigInt(0), wethAllowance: BigInt(0), nftAllowance: BigInt(0) };
    }
  },

  /**
   * 获取位置详情
   */
  fetchPositionDetails: async (publicClient: PublicClient, tokenId: bigint): Promise<UniswapPositionInfo> => {
    try {
      const positionManagerAddress = UniswapDeploymentInfo.contracts.MockPositionManager as Address;

      // 使用 readContract 获取位置信息
      const positionData = await publicClient.readContract({
        address: positionManagerAddress,
        abi: typedMockPositionManagerABI, // MockPositionManager 使用自己的 ABI
        functionName: 'positions',
        args: [tokenId],
      });

      // 转换为位置信息结构
      const position: UniswapPositionInfo = {
        tokenId,
        nonce: positionData[0] as bigint,
        operator: positionData[1] as Address,
        token0: positionData[2] as Address,
        token1: positionData[3] as Address,
        fee: Number(positionData[4]),
        tickLower: Number(positionData[5]),
        tickUpper: Number(positionData[6]),
        liquidity: positionData[7] as bigint,
        feeGrowthInside0LastX128: positionData[8] as bigint,
        feeGrowthInside1LastX128: positionData[9] as bigint,
        tokensOwed0: positionData[10] as bigint,
        tokensOwed1: positionData[11] as bigint,
      };

      return position;
    } catch (error) {
      console.warn('获取位置详情失败:', error);
      throw error;
    }
  },

  /**
   * 获取手续费率
   */
  fetchFeeRate: async (publicClient: PublicClient): Promise<number> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) {
      throw new Error('DefiAggregator 合约地址未初始化');
    }

    try {
      const feeRateBps = await publicClient.readContract({
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'feeRateBps',
      });

      const feeRate = Number(feeRateBps);
      console.log(`💰 手续费率: ${feeRate} BPS (${feeRate / 100}%)`);
      return feeRate;
    } catch (error) {
      console.warn('获取手续费率失败:', error);
      return UniswapDeploymentInfo.feeRateBps; // 从部署文件读取默认手续费率
    }
  },

  // ==================== 写入方法 ====================
  /**
   * 授权 USDT 给 UniswapV3Adapter (适配器直接转移代币)
   */
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
    const { uniswapV3AdapterAddress } = get();
    if (!uniswapV3AdapterAddress) {
      throw new Error('UniswapV3Adapter 合约地址未初始化');
    }

    try {
      console.log('🔑 开始授权 USDT 给 UniswapV3Adapter...');
      console.log('参数:', { amount: amount.toString(), account, uniswapV3AdapterAddress });

      // 构建交易参数
      // 🔧 关键修复：UniswapV3Adapter 直接调用 safeTransferFrom，需要授权给它
      const baseParams = {
        address: UniswapDeploymentInfo.contracts.MockERC20_USDT as Address,
        abi: typedMockERC20ABI,
        functionName: 'approve' as const,
        args: [uniswapV3AdapterAddress, amount] as [`0x${string}`, bigint], // 授权给 UniswapV3Adapter
        chain,
        account,
      };

      // 根据gas配置动态构建参数，避免类型冲突
      const writeParams = { ...baseParams };

      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        // EIP-1559 gas 配置
        Object.assign(writeParams, {
          ...(gasConfig?.gas && { gas: gasConfig.gas }),
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        });
      } else {
        // Legacy gas 配置或默认
        Object.assign(writeParams, {
          ...(gasConfig?.gas && { gas: gasConfig.gas }),
          ...(gasConfig?.gasPrice && { gasPrice: gasConfig.gasPrice }),
        });
      }

      const hash = await walletClient.writeContract(writeParams as Parameters<typeof walletClient.writeContract>[0]);

      console.log('📝 授权交易哈希:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ USDT 授权完成');

      // 授权成功后更新授权状态（从 store 中刷新）
      await get().fetchAllowances(publicClient, userAddress);

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'USDT 授权失败';
      console.error('❌ USDT 授权失败:', errorMsg);
      throw error;
    }
  },

  /**
   * 授权 WETH 给 UniswapV3Adapter (适配器直接转移代币)
   */
  approveWETH: async (
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
    const { uniswapV3AdapterAddress } = get();
    if (!uniswapV3AdapterAddress) {
      throw new Error('UniswapV3Adapter 合约地址未初始化');
    }

    try {
      console.log('🔑 开始授权 WETH 给 UniswapV3Adapter...');
      console.log('参数:', { amount: amount.toString(), account, uniswapV3AdapterAddress });

      // 构建交易参数
      // 🔧 关键修复：UniswapV3Adapter 直接调用 safeTransferFrom，需要授权给它
      const baseParams = {
        address: UniswapDeploymentInfo.contracts.MockWethToken as Address,
        abi: typedMockERC20ABI,
        functionName: 'approve' as const,
        args: [uniswapV3AdapterAddress, amount] as [`0x${string}`, bigint], // 授权给 UniswapV3Adapter
        chain,
        account,
      };

      // 根据gas配置动态构建参数，避免类型冲突
      const writeParams = { ...baseParams };

      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        // EIP-1559 gas 配置
        Object.assign(writeParams, {
          ...(gasConfig?.gas && { gas: gasConfig.gas }),
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        });
      } else {
        // Legacy gas 配置或默认
        Object.assign(writeParams, {
          ...(gasConfig?.gas && { gas: gasConfig.gas }),
          ...(gasConfig?.gasPrice && { gasPrice: gasConfig.gasPrice }),
        });
      }

      const hash = await walletClient.writeContract(writeParams as Parameters<typeof walletClient.writeContract>[0]);

      console.log('📝 授权交易哈希:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ WETH 授权完成');

      // 授权成功后更新授权状态（从 store 中刷新）
      await get().fetchAllowances(publicClient, userAddress);

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'WETH 授权失败';
      console.error('❌ WETH 授权失败:', errorMsg);
      throw error;
    }
  },

  /**
   * 授权 NFT 给 UniswapV3Adapter
   */
  approveNFT: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    tokenId: bigint,
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<TransactionReceipt> => {
    const { uniswapV3AdapterAddress } = get();
    if (!uniswapV3AdapterAddress) {
      throw new Error('UniswapV3Adapter 合约地址未初始化');
    }

    try {
      console.log('🔑 开始授权 NFT 给 UniswapV3Adapter...');
      console.log('参数:', { tokenId: tokenId.toString(), account });

      const txParams = {
        address: UniswapDeploymentInfo.contracts.MockPositionManager as Address,
        abi: typedMockPositionManagerABI, // MockPositionManager 使用 ERC721 接口
        functionName: 'approve',
        args: [uniswapV3AdapterAddress, tokenId] as [`0x${string}`, bigint],
        chain,
        account,
      };

      if (gasConfig?.gas) {
        Object.assign(txParams, { gas: gasConfig.gas });
      }
      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        Object.assign(txParams, {
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        });
      } else if (gasConfig?.gasPrice) {
        Object.assign(txParams, { gasPrice: gasConfig.gasPrice });
      }

      const hash = await walletClient.writeContract(txParams as any);

      console.log('📝 授权交易哈希:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ NFT 授权完成');

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'NFT 授权失败';
      console.error('❌ NFT 授权失败:', errorMsg);
      throw error;
    }
  },

  /**
   * 全局授权所有 NFT 给 UniswapV3Adapter (用于添加流动性前的准备)
   */
  approveAllNFT: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    account: Address,
    userAddress: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<TransactionReceipt> => {
    const { uniswapV3AdapterAddress } = get();
    if (!uniswapV3AdapterAddress) {
      throw new Error('UniswapV3Adapter 合约地址未初始化');
    }

    try {
      console.log('🔑 开始全局授权所有 NFT 给 UniswapV3Adapter...');
      console.log('参数:', { account, uniswapV3AdapterAddress });

      const txParams = {
        address: UniswapDeploymentInfo.contracts.MockPositionManager as Address,
        abi: typedMockPositionManagerABI, // MockPositionManager 使用 ERC721 接口
        functionName: 'setApprovalForAll',
        args: [uniswapV3AdapterAddress, true] as [`0x${string}`, boolean],
        chain,
        account,
      };

      if (gasConfig?.gas) {
        Object.assign(txParams, { gas: gasConfig.gas });
      }
      if (gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas) {
        Object.assign(txParams, {
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        });
      } else if (gasConfig?.gasPrice) {
        Object.assign(txParams, { gasPrice: gasConfig.gasPrice });
      }

      const hash = await walletClient.writeContract(txParams as any);

      console.log('📝 全局 NFT 授权交易哈希:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ 全局 NFT 授权完成');

      // 授权成功后更新授权状态
      await get().fetchAllowances(publicClient, userAddress);

      return receipt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '全局 NFT 授权失败';
      console.error('❌ 全局 NFT 授权失败:', errorMsg);
      throw error;
    }
  },

  /**
   * 验证 UniswapV3 适配器是否已注册
   */
  verifyAdapterRegistration: async (publicClient: PublicClient): Promise<boolean> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) {
      throw new Error('DefiAggregator 合约地址未初始化');
    }

    try {
      // 检查适配器是否已注册
      const isRegistered = await publicClient.readContract({
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'hasAdapter',
        args: ['uniswapv3'],
      }) as boolean;

      console.log('🔍 UniswapV3 适配器注册状态:', isRegistered);
      return isRegistered;
    } catch (error) {
      console.error('❌ 检查适配器注册状态失败:', error);
      return false;
    }
  },

  /**
   * 添加流动性（基于测试用例逻辑）
   */
  addLiquidity: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: {
      token0: Address;
      token1: Address;
      amount0: string;
      amount1: string;
      amount0Min: string;
      amount1Min: string;
      tickLower?: number;
      tickUpper?: number;
      recipient: Address;
      deadline?: number;
    },
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<UniswapTransactionResult> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) {
      throw new Error('合约地址未初始化');
    }

    // 🔍 验证适配器注册状态
    const isAdapterRegistered = await get().verifyAdapterRegistration(publicClient);
    if (!isAdapterRegistered) {
      throw new Error('UniswapV3 适配器未在 DefiAggregator 中注册');
    }

    try {
      set({ isOperating: true, error: null });
      console.log('🚀 开始添加流动性...');
      console.log('参数:', { ...params, account });

      // 🔧 修复 Uniswap V3 代币排序问题
      // Uniswap V3 要求 token0 地址 < token1 地址，否则会抛出 "Invalid token order" 错误
      console.log('🔧 处理代币排序...');
      console.log('原始 token0:', params.token0);
      console.log('原始 token1:', params.token1);

      // 获取代币地址以便识别代币类型
      const usdtAddress = UniswapDeploymentInfo.contracts.MockERC20_USDT as Address;
      const wethAddress = UniswapDeploymentInfo.contracts.MockWethToken as Address;

      let sortedTokens: [Address, Address];
      let sortedAmounts: [string, string];
      let sortedAmountMins: [string, string];

      // 🔧 简化修复：直接根据地址确定顺序，然后正确匹配金额
      console.log('🔧 修复代币排序和金额对应关系...');

      // 确定哪个地址更小（应该是 token0）
      if (params.token0.toLowerCase() < params.token1.toLowerCase()) {
        // token0 < token1，顺序正确，无需交换
        sortedTokens = [params.token0, params.token1];
        sortedAmounts = [params.amount0, params.amount1];
        sortedAmountMins = [params.amount0Min, params.amount1Min];
        console.log('✅ 代币顺序正确: token0 < token1');
      } else {
        // token0 > token1，需要交换
        sortedTokens = [params.token1, params.token0];
        sortedAmounts = [params.amount1, params.amount0];  // 🔧 关键：金额也要交换
        sortedAmountMins = [params.amount1Min, params.amount0Min];  // 🔧 关键：最小金额也要交换
        console.log('🔄 已交换代币顺序和对应金额');
      }

      console.log('排序后 token0:', sortedTokens[0]);
      console.log('排序后 token1:', sortedTokens[1]);
      console.log('排序后 amount0:', sortedAmounts[0]);
      console.log('排序后 amount1:', sortedAmounts[1]);

      // 🔧 调试：确认代币和金额的对应关系
      console.log('🔍 调试信息:');
      console.log('排序后 token0 地址:', sortedTokens[0]);
      console.log('排序后 token0 是 WETH:', sortedTokens[0].toLowerCase() === wethAddress.toLowerCase());
      console.log('排序后 token0 是 USDT:', sortedTokens[0].toLowerCase() === usdtAddress.toLowerCase());
      console.log('排序后 amount0 (字符串):', sortedAmounts[0]);
      console.log('排序后 amount1 (字符串):', sortedAmounts[1]);

      // 🔧 根据代币类型确定小数位数
      // 无论代币顺序如何，都根据代币地址确定小数位数
      const getTokenDecimals = (tokenAddress: Address): number => {
        if (tokenAddress.toLowerCase() === usdtAddress.toLowerCase()) {
          return 6; // USDT 是 6 位小数
        } else if (tokenAddress.toLowerCase() === wethAddress.toLowerCase()) {
          return 18; // WETH 是 18 位小数
        } else {
          // 默认处理：大多数 ERC20 代币是 18 位小数
          return 18;
        }
      };

      const token0Decimals = getTokenDecimals(sortedTokens[0]);
      const token1Decimals = getTokenDecimals(sortedTokens[1]);

      console.log('Token0 小数位数:', token0Decimals);
      console.log('Token1 小数位数:', token1Decimals);

      // 🔧 DEBUGGER: 在构造操作参数前添加断点
      console.log('🐛 [DEBUGGER] 构造操作参数前检查点');

      // 构造操作参数（基于测试用例，使用排序后的代币和正确的小数位数）
      const amount0BigInt = parseUnits(sortedAmounts[0], token0Decimals);
      const amount1BigInt = parseUnits(sortedAmounts[1], token1Decimals);

      // 🔧 使用字符串类型来匹配后端期望的格式
      const operationParams: UniswapOperationParams = {
        tokens: sortedTokens,
        amounts: [
          amount0BigInt.toString(), // token0 金额 - 转换为字符串
          amount1BigInt.toString(), // token1 金额 - 转换为字符串
          "0", // token0 最小金额设为 0 - 字符串格式
          "0", // token1 最小金额设为 0 - 字符串格式
        ],
        recipient: params.recipient,
        deadline: params.deadline || Math.floor(Date.now() / 1000) + 3600,
        tokenId: "0", // 🔧 使用字符串格式的 tokenId
        extraData: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe8900000000000000000000000000000000000000000000000000000000000001770' as Hex, // 🔧 临时写死 extraData
      };

      console.log('📋 操作参数 (完全字符串格式):', {
        amounts: operationParams.amounts, // 字符串数组
        tokens: operationParams.tokens,
        recipient: operationParams.recipient,
        deadline: operationParams.deadline,
        tokenId: operationParams.tokenId, // 现在直接是字符串
        extraData: operationParams.extraData
      });

      console.log('📋 最终操作参数:', operationParams);
      console.log('🔍 [DEBUG] amounts数组长度:', operationParams.amounts.length);
      console.log('🔍 [DEBUG] amounts内容 (字符串格式):', operationParams.amounts);
      console.log('🔍 [DEBUG] amounts类型检查:', operationParams.amounts.map(a => typeof a));
      console.log('🔍 [DEBUG] tokenId类型:', typeof operationParams.tokenId);
      console.log('🔍 [DEBUG] tokenId值:', operationParams.tokenId);

      console.log('🚀 操作参数构造完成，准备发送交易');

      const txParams = {
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'executeOperation',
        args: [
          'uniswapv3', // 适配器名称
          UniswapOperationType.ADD_LIQUIDITY,
          operationParams
        ] as [string, number, UniswapOperationParams],
        chain,
        account,
        ...(gasConfig?.gas && { gas: gasConfig.gas }),
        ...(gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas && {
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        }),
        ...(gasConfig?.gasPrice && { gasPrice: gasConfig.gasPrice }),
      } as Parameters<typeof walletClient.writeContract>[0];

      const hash = await walletClient.writeContract(txParams);

      console.log('📝 添加流动性交易哈希:', hash);

      console.log('⏳ 等待交易确认...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ 交易已确认');

      // 解析操作结果（从事件日志中）
      let operationResult: UniswapOperationResult = {
        success: false,
        outputAmounts: [],
        returnData: '0x' as Hex,
        message: '无法解析操作结果',
      };

      if (receipt.logs) {
        for (const log of receipt.logs as Array<{ topics: readonly Hex[] } & typeof receipt.logs[0]>) {
          try {
            const event = viemDecodeEventLog({
              abi: typedUniswapV3AdapterABI,
              data: log.data,
              topics: log.topics as [signature: Hex, ...args: Hex[]],
            });

            if (event && event.eventName === 'OperationExecuted') {
              const operationEvent = event as unknown as DecodedOperationExecutedEvent;
              operationResult = {
                success: true,
                outputAmounts: operationEvent.args.amounts,
                returnData: operationEvent.args.returnData,
                message: '添加流动性成功',
              };
              console.log('✅ 解析到 OperationExecuted 事件:', operationEvent);
              break;
            }
          } catch (e) {
            console.warn('解码事件日志失败:', e);
          }
        }
      }

      set({ isOperating: false });

      const result: UniswapTransactionResult = {
        hash,
        receipt,
        result: operationResult,
      };

      console.log('✅ 添加流动性操作完成');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '添加流动性失败';
      set({ error: errorMsg, isOperating: false });
      console.error('❌ 添加流动性失败:', errorMsg);
      throw error;
    }
  },

  /**
   * 移除流动性（基于测试用例逻辑）
   */
  removeLiquidity: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: {
      tokenId: bigint;
      amount0Min?: string;
      amount1Min?: string;
      recipient: Address;
      deadline?: number;
    },
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<UniswapTransactionResult> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) {
      throw new Error('合约地址未初始化');
    }

    try {
      set({ isOperating: true, error: null });
      console.log('🚀 开始移除流动性...');
      console.log('参数:', { ...params, account });

      // 构造操作参数（基于测试用例）
      const operationParams: UniswapOperationParams = {
        tokens: [UniswapDeploymentInfo.contracts.MockERC20_USDT as Address], // 占位符地址
        amounts: [
          params.amount0Min ? parseUnits(params.amount0Min, 6) : BigInt(0), // USDT decimals
          params.amount1Min ? parseUnits(params.amount1Min, 18) : BigInt(0), // WETH decimals
        ],
        recipient: params.recipient,
        deadline: params.deadline || Math.floor(Date.now() / 1000) + 3600,
        tokenId: params.tokenId,
        extraData: '0x' as Hex,
      };

      console.log('📋 移除流动性操作参数:', operationParams);

      const hash = await walletClient.writeContract({
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'executeOperation',
        args: [
          'uniswapv3', // 适配器名称
          UniswapOperationType.REMOVE_LIQUIDITY,
          operationParams
        ],
        chain,
        account,
        ...(gasConfig?.gas && { gas: gasConfig.gas }),
        ...(gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas && {
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        }),
        ...(gasConfig?.gasPrice && { gasPrice: gasConfig.gasPrice }),
      } as Parameters<typeof walletClient.writeContract>[0]);

      console.log('📝 移除流动性交易哈希:', hash);

      console.log('⏳ 等待交易确认...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ 交易已确认');

      // 解析操作结果（从事件日志中）
      let operationResult: UniswapOperationResult = {
        success: false,
        outputAmounts: [],
        returnData: '0x' as Hex,
        message: '无法解析操作结果',
      };

      if (receipt.logs) {
        for (const log of receipt.logs as Array<{ topics: readonly Hex[] } & typeof receipt.logs[0]>) {
          try {
            const event = viemDecodeEventLog({
              abi: typedUniswapV3AdapterABI,
              data: log.data,
              topics: log.topics as [signature: Hex, ...args: Hex[]],
            });

            if (event && event.eventName === 'OperationExecuted') {
              const operationEvent = event as unknown as DecodedOperationExecutedEvent;
              operationResult = {
                success: true,
                outputAmounts: operationEvent.args.amounts,
                returnData: operationEvent.args.returnData,
                message: '移除流动性成功',
              };
              console.log('✅ 解析到 OperationExecuted 事件:', operationEvent);
              break;
            }
          } catch (e) {
            console.warn('解码事件日志失败:', e);
          }
        }
      }

      set({ isOperating: false });

      const result: UniswapTransactionResult = {
        hash,
        receipt,
        result: operationResult,
      };

      console.log('✅ 移除流动性操作完成');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '移除流动性失败';
      set({ error: errorMsg, isOperating: false });
      console.error('❌ 移除流动性失败:', errorMsg);
      throw error;
    }
  },

  /**
   * 收取手续费（基于测试用例逻辑）
   */
  collectFees: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: {
      tokenId: bigint;
      recipient: Address;
      deadline?: number;
    },
    account: Address,
    gasConfig?: {
      gas?: bigint;
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    }
  ): Promise<UniswapTransactionResult> => {
    const { defiAggregatorAddress } = get();
    if (!defiAggregatorAddress) {
      throw new Error('合约地址未初始化');
    }

    try {
      set({ isOperating: true, error: null });
      console.log('💰 开始收取手续费...');
      console.log('参数:', { ...params, account });

      // 构造操作参数（基于测试用例）
      const operationParams: UniswapOperationParams = {
        tokens: [UniswapDeploymentInfo.contracts.MockERC20_USDT as Address], // 占位符地址
        amounts: [], // 空数组表示收取指定 tokenId 的手续费
        recipient: params.recipient,
        deadline: params.deadline || Math.floor(Date.now() / 1000) + 3600,
        tokenId: params.tokenId,
        extraData: '0x' as Hex,
      };

      console.log('📋 收取手续费操作参数:', operationParams);

      const hash = await walletClient.writeContract({
        address: defiAggregatorAddress,
        abi: typedDefiAggregatorABI,
        functionName: 'executeOperation',
        args: [
          'uniswapv3', // 适配器名称
          UniswapOperationType.COLLECT_FEES,
          operationParams
        ],
        chain,
        account,
        ...(gasConfig?.gas && { gas: gasConfig.gas }),
        ...(gasConfig?.maxFeePerGas && gasConfig?.maxPriorityFeePerGas && {
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        }),
        ...(gasConfig?.gasPrice && { gasPrice: gasConfig.gasPrice }),
      } as Parameters<typeof walletClient.writeContract>[0]);

      console.log('📝 收取手续费交易哈希:', hash);

      console.log('⏳ 等待交易确认...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ 交易已确认');

      // 解析操作结果（从事件日志中）
      let operationResult: UniswapOperationResult = {
        success: false,
        outputAmounts: [],
        returnData: '0x' as Hex,
        message: '无法解析操作结果',
      };

      if (receipt.logs) {
        for (const log of receipt.logs as Array<{ topics: readonly Hex[] } & typeof receipt.logs[0]>) {
          try {
            const event = viemDecodeEventLog({
              abi: typedUniswapV3AdapterABI,
              data: log.data,
              topics: log.topics as [signature: Hex, ...args: Hex[]],
            });

            if (event && event.eventName === 'OperationExecuted') {
              const operationEvent = event as unknown as DecodedOperationExecutedEvent;
              operationResult = {
                success: true,
                outputAmounts: operationEvent.args.amounts,
                returnData: operationEvent.args.returnData,
                message: '收取手续费成功',
              };
              console.log('✅ 解析到 OperationExecuted 事件:', operationEvent);
              break;
            }
          } catch (e) {
            console.warn('解码事件日志失败:', e);
          }
        }
      }

      set({ isOperating: false });

      const result: UniswapTransactionResult = {
        hash,
        receipt,
        result: operationResult,
      };

      console.log('✅ 收取手续费操作完成');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '收取手续费失败';
      set({ error: errorMsg, isOperating: false });
      console.error('❌ 收取手续费失败:', errorMsg);
      throw error;
    }
  },

  // ==================== 辅助方法 ====================
  /**
   * 设置加载状态
   */
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  /**
   * 设置操作状态
   */
  setOperating: (operating: boolean) => {
    set({ isOperating: operating });
  },

  /**
   * 设置错误信息
   */
  setError: (error: string | null) => {
    set({ error: error });
  },

  /**
   * 清除错误信息
   */
  clearErrors: () => {
    set({ error: null });
  },

  /**
   * 选择位置
   */
  selectPosition: (position: UniswapPositionInfo | null) => {
    set({ selectedPosition: position });
  },

  /**
   * 重置状态
   */
  reset: () => {
    set({
      defiAggregatorAddress: null,
      uniswapV3AdapterAddress: null,
      poolInfo: null,
      userBalance: null,
      userPositions: [],
      selectedPosition: null,
      isLoading: false,
      isOperating: false,
      error: null,
    });
  },
}),
    {
      name: 'uniswap-store',
    }
  )
);

export default useUniswapStore;