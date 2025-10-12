/**
 * Uniswap V3 Zustand Store
 * 管理 Uniswap V3 相关状态和操作
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  Address,
  parseUnits,
  formatUnits,
  encodeAbiParameters,
  decodeAbiParameters
} from 'viem';
import {
  parseTokenAmount,
  formatTokenAmount,
} from '@/lib/contracts/contracts';
import { UNISWAP_CONFIG, PRICE_RANGE_PRESETS } from '@/lib/config/loadContracts';

// Store 状态接口
interface UniswapState {
  // 基础状态
  isConnected: boolean;
  userAddress: Address | null;
  chainId: number | null;

  // 代币状态
  tokens: Record<string, TokenInfo>;
  balances: Record<string, bigint>;
  allowances: Record<string, Record<string, bigint>>; // token -> spender -> allowance

  // 位置状态
  positions: PositionInfo[];
  selectedPosition: PositionInfo | null;

  // 操作状态
  currentOperation: 'add' | 'remove' | 'claim' | null;
  operationParams: Partial<AddLiquidityParams | RemoveLiquidityParams | CollectFeesParams>;

  // 授权状态
  approvalState: ApprovalState;

  // 交易状态
  transactionState: TransactionState;

  // UI 状态
  showLiquidityModal: boolean;
  showFeeModal: boolean;
  selectedPriceRange: typeof PRICE_RANGE_PRESETS.STANDARD;
  slippageTolerance: number; // 百分比

  // 错误状态
  error: string | null;
  isLoading: boolean;

  // Actions
  initialize: (address: Address, chainId: number) => void;
  reset: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;

  // 代币相关
  updateTokenBalance: (tokenAddress: string, balance: bigint) => void;
  updateTokenAllowance: (tokenAddress: string, spender: string, allowance: bigint) => void;
  setTokens: (tokens: Record<string, TokenInfo>) => void;

  // 位置相关
  setPositions: (positions: PositionInfo[]) => void;
  addPosition: (position: PositionInfo) => void;
  updatePosition: (tokenId: bigint, updates: Partial<PositionInfo>) => void;
  removePosition: (tokenId: bigint) => void;
  selectPosition: (position: PositionInfo | null) => void;

  // 操作相关
  setCurrentOperation: (operation: 'add' | 'remove' | 'claim' | null) => void;
  setOperationParams: (params: Partial<AddLiquidityParams | RemoveLiquidityParams | CollectFeesParams>) => void;

  // 授权相关
  setApprovalState: (state: Partial<ApprovalState>) => void;

  // 交易相关
  setTransactionState: (state: Partial<TransactionState>) => void;

  // UI 相关
  showLiquidityModalFor: (operation: 'add' | 'remove', position?: PositionInfo) => void;
  hideLiquidityModal: () => void;
  showFeeModalFor: (position: PositionInfo) => void;
  hideFeeModal: () => void;
  setSelectedPriceRange: (range: typeof PRICE_RANGE_PRESETS.STANDARD) => void;
  setSlippageTolerance: (slippage: number) => void;
}

// 创建 store
export const useUniswapStore = create<UniswapState>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始状态
        isConnected: false,
        userAddress: null,
        chainId: null,

        tokens: {},
        balances: {},
        allowances: {},

        positions: [],
        selectedPosition: null,

        currentOperation: null,
        operationParams: {},

        approvalState: {
          token0Approved: false,
          token1Approved: false,
          nftApproved: false,
          isLoading: false,
        },

        transactionState: {
          isPending: false,
          isConfirming: false,
          isSuccess: false,
        },

        showLiquidityModal: false,
        showFeeModal: false,
        selectedPriceRange: PRICE_RANGE_PRESETS.STANDARD,
        slippageTolerance: 1.0, // 1% 默认滑点

        error: null,
        isLoading: false,

        // Actions
        initialize: (address: Address, chainId: number) => {
          set({
            isConnected: true,
            userAddress: address,
            chainId,
            error: null,
          });
        },

        reset: () => {
          set({
            isConnected: false,
            userAddress: null,
            chainId: null,
            tokens: {},
            balances: {},
            allowances: {},
            positions: [],
            selectedPosition: null,
            currentOperation: null,
            operationParams: {},
            approvalState: {
              token0Approved: false,
              token1Approved: false,
              nftApproved: false,
              isLoading: false,
            },
            transactionState: {
              isPending: false,
              isConfirming: false,
              isSuccess: false,
            },
            showLiquidityModal: false,
            showFeeModal: false,
            error: null,
            isLoading: false,
          });
        },

        setError: (error: string | null) => set({ error }),
        setLoading: (isLoading: boolean) => set({ isLoading }),

        // 代币相关
        updateTokenBalance: (tokenAddress: string, balance: bigint) => {
          set((state) => ({
            balances: {
              ...state.balances,
              [tokenAddress]: balance,
            },
          }));
        },

        updateTokenAllowance: (tokenAddress: string, spender: string, allowance: bigint) => {
          set((state) => ({
            allowances: {
              ...state.allowances,
              [tokenAddress]: {
                ...state.allowances[tokenAddress],
                [spender]: allowance,
              },
            },
          }));
        },

        setTokens: (tokens: Record<string, TokenInfo>) => set({ tokens }),

        // 位置相关
        setPositions: (positions: PositionInfo[]) => set({ positions }),

        addPosition: (position: PositionInfo) => {
          set((state) => ({
            positions: [...state.positions, position],
          }));
        },

        updatePosition: (tokenId: bigint, updates: Partial<PositionInfo>) => {
          set((state) => ({
            positions: state.positions.map((pos) =>
              pos.tokenId === tokenId ? { ...pos, ...updates } : pos
            ),
            selectedPosition:
              state.selectedPosition?.tokenId === tokenId
                ? { ...state.selectedPosition, ...updates }
                : state.selectedPosition,
          }));
        },

        removePosition: (tokenId: bigint) => {
          set((state) => ({
            positions: state.positions.filter((pos) => pos.tokenId !== tokenId),
            selectedPosition:
              state.selectedPosition?.tokenId === tokenId ? null : state.selectedPosition,
          }));
        },

        selectPosition: (position: PositionInfo | null) => set({ selectedPosition: position }),

        // 操作相关
        setCurrentOperation: (currentOperation: 'add' | 'remove' | 'claim' | null) => {
          set({ currentOperation });
        },

        setOperationParams: (params: Partial<AddLiquidityParams | RemoveLiquidityParams | CollectFeesParams>) => {
          set((state) => ({
            operationParams: { ...state.operationParams, ...params },
          }));
        },

        // 授权相关
        setApprovalState: (approvalState: Partial<ApprovalState>) => {
          set((state) => ({
            approvalState: { ...state.approvalState, ...approvalState },
          }));
        },

        // 交易相关
        setTransactionState: (transactionState: Partial<TransactionState>) => {
          set((state) => ({
            transactionState: { ...state.transactionState, ...transactionState },
          }));
        },

        // UI 相关
        showLiquidityModalFor: (operation: 'add' | 'remove', position?: PositionInfo) => {
          set({
            currentOperation: operation,
            selectedPosition: position || null,
            showLiquidityModal: true,
            error: null,
          });

          // 如果是移除流动性，预填充参数
          if (operation === 'remove' && position) {
            set({
              operationParams: {
                tokenId: position.tokenId,
                recipient: get().userAddress || undefined,
              },
            });
          }
        },

        hideLiquidityModal: () => {
          set({
            currentOperation: null,
            selectedPosition: null,
            showLiquidityModal: false,
            operationParams: {},
          });
        },

        showFeeModalFor: (position: PositionInfo) => {
          set({
            currentOperation: 'claim',
            selectedPosition: position,
            showFeeModal: true,
            operationParams: {
              tokenId: position.tokenId,
              recipient: get().userAddress || undefined,
            },
          });
        },

        hideFeeModal: () => {
          set({
            currentOperation: null,
            selectedPosition: null,
            showFeeModal: false,
            operationParams: {},
          });
        },

        setSelectedPriceRange: (selectedPriceRange: typeof PRICE_RANGE_PRESETS.STANDARD) => {
          set({ selectedPriceRange });
        },

        setSlippageTolerance: (slippageTolerance: number) => {
          set({ slippageTolerance });
        },
      }),
      {
        name: 'uniswap-store',
        partialize: (state) => ({
          // 只持久化部分状态
          selectedPriceRange: state.selectedPriceRange,
          slippageTolerance: state.slippageTolerance,
        }),
      }
    ),
    {
      name: 'uniswap-store',
    }
  )
);

// Selectors
export const useUniswapSelectors = {
  // 基础选择器
  isConnected: () => useUniswapStore((state) => state.isConnected),
  userAddress: () => useUniswapStore((state) => state.userAddress),

  // 代币选择器
  tokens: () => useUniswapStore((state) => state.tokens),
  tokenBalance: (address: string) =>
    useUniswapStore((state) => state.balances[address] || 0n),
  tokenAllowance: (tokenAddress: string, spender: string) =>
    useUniswapStore((state) => state.allowances[tokenAddress]?.[spender] || 0n),

  // 位置选择器
  positions: () => useUniswapStore((state) => state.positions),
  selectedPosition: () => useUniswapStore((state) => state.selectedPosition),

  // 操作选择器
  currentOperation: () => useUniswapStore((state) => state.currentOperation),
  operationParams: () => useUniswapStore((state) => state.operationParams),

  // UI 选择器
  showLiquidityModal: () => useUniswapStore((state) => state.showLiquidityModal),
  showFeeModal: () => useUniswapStore((state) => state.showFeeModal),
  selectedPriceRange: () => useUniswapStore((state) => state.selectedPriceRange),
  slippageTolerance: () => useUniswapStore((state) => state.slippageTolerance),

  // 状态选择器
  isLoading: () => useUniswapStore((state) => state.isLoading),
  error: () => useUniswapStore((state) => state.error),
  approvalState: () => useUniswapStore((state) => state.approvalState),
  transactionState: () => useUniswapStore((state) => state.transactionState),
};

// 计算属性
export const useUniswapComputed = {
  // 总锁仓价值
  totalTVL: () => {
    const positions = useUniswapSelectors.positions();
    return positions.reduce(
      (total, pos) => total + (pos.token0ValueUSD || 0) + (pos.token1ValueUSD || 0),
      0
    );
  },

  // 总手续费
  totalFees: () => {
    const positions = useUniswapSelectors.positions();
    return positions.reduce(
      (total, pos) => total + Number(pos.tokensOwed0) + Number(pos.tokensOwed1),
      0
    );
  },

  // 是否有足够的代币余额
  hasSufficientBalance: (tokenAddress: string, amount: string) => {
    const balance = useUniswapSelectors.tokenBalance(tokenAddress);
    const tokenInfo = Object.values(useUniswapSelectors.tokens()).find(
      (token) => token.address === tokenAddress
    );

    if (!tokenInfo) return false;

    const requiredAmount = parseTokenAmount(amount, tokenInfo.decimals);
    return balance >= requiredAmount;
  },

  // 是否有足够的授权
  hasSufficientAllowance: (tokenAddress: string, spender: string, amount: string) => {
    const allowance = useUniswapSelectors.tokenAllowance(tokenAddress, spender);
    const tokenInfo = Object.values(useUniswapSelectors.tokens()).find(
      (token) => token.address === tokenAddress
    );

    if (!tokenInfo) return false;

    const requiredAmount = parseTokenAmount(amount, tokenInfo.decimals);
    return allowance >= requiredAmount;
  },
};