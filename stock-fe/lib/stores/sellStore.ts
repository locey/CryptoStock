import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { Address, formatUnits, parseUnits, Abi, PublicClient, WalletClient, Chain, TransactionReceipt } from 'viem';
import StockToken from "@/lib/abi/StockToken.json"
import delpolyConfig from "@/lib/abi/deployments-uups-sepolia.json"
import { fetchUpdateData } from "@/lib/utils/getPythUpdateData"
import ORACLE_AGGREGATOR_ABI from '@/lib/abi/OracleAggregator.json';


/**
 * 价格更新数据接口
 */
interface PriceUpdateData {
  updateData: Uint8Array[];
  updateFee: bigint;
}

/**
 * 获取卖出预估的返回结果
 */
interface SellEstimateResult {
  estimatedUsdt: bigint;
  estimatedFee: bigint;
}

/**
 * 合约交易结果
 */
interface TransactionResult {
  hash: Address;
  receipt: TransactionReceipt;
}

/**
 * 确保地址是有效的 0x 开头的格式
 */
function ensureAddress(address: string | Address): Address {
  if (typeof address === 'string') {
    return address.startsWith('0x') ? address as Address : (`0x${address}`) as Address;
  }
  return address;
}

const usdtAddress = ensureAddress(delpolyConfig.contracts.USDT);
const OracleAggregatorAddress = ensureAddress(delpolyConfig.contracts.PriceAggregator);

// ==================== 类型化 ABI ====================
const typedStockTokenABI = StockToken as Abi;
// 标准的ERC20 ABI（用于余额查询）
const typedERC20ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  }
] as const;

// ==================== 步骤一：类型定义 ====================
export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

/**
 * 卖出预估结果类型（对应合约的 getSellEstimate 返回值）
 */
export interface SellEstimate {
  estimatedUsdt: bigint;  // 预估获得的 USDT 数量
  estimatedFee: bigint;   // 预估手续费（USDT）
  minUsdtAmount: bigint;  // 滑点保护最小 USDT 数量
  timestamp: number;
  formatted: {
    estimatedUsdt: string;
    estimatedFee: string;
    minUsdtAmount: string;
  };
}

/**
 * 交易记录类型
 */
export interface TransactionRecord {
  hash: Address;
  tokenAmount: bigint;
  usdtAmount: bigint;
  feeAmount: bigint;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
}

/**
 * 合约调用结果类型
 */
export interface ContractCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 余额信息类型
 */
export interface BalanceInfo {
  usdtBalance: bigint;
  tokenBalance: bigint;
  formatted: {
    usdtBalance: string;
    tokenBalance: string;
  };
}

// ==================== 步骤二：基础状态定义 ====================
interface SellStoreState {
  // ===== 连接状态 =====
  isConnected: boolean;
  address: Address | null;

  // ===== 代币信息 =====
  token: TokenInfo | null;

  // ===== 余额信息 =====
  balances: BalanceInfo | null;
  lastBalanceUpdate: number;

  // ===== 卖出参数 =====
  sellAmount: string;
  slippage: number;

  // ===== 预估结果 =====
  estimate: SellEstimate | null;

  // ===== 交易状态 =====
  isTransactionPending: boolean;
  currentTransaction: TransactionRecord | null;

  // ===== 错误信息 =====
  error: string | null;
  errorCode: string | null;

  // ===== 历史记录 =====
  sellHistory: TransactionRecord[];

  // ==================== 步骤三：基础方法（不涉及合约调用）================
  setConnected: (connected: boolean, address?: Address) => void;
  setToken: (token: TokenInfo) => void;
  setSellAmount: (amount: string) => void;
  setSlippage: (slippage: number) => void;
  setEstimate: (estimatedUsdt: bigint, estimatedFee: bigint) => void;
  clearEstimate: () => void;
  setTransactionPending: (pending: boolean) => void;
  addTransaction: (transaction: TransactionRecord) => void;
  clearTransaction: () => void;
  setError: (error: string, errorCode?: string) => void;
  clearError: () => void;
  reset: () => void;

  // ==================== 步骤四：合约调用方法 ====================
  // 1. 获取初始余额（USDT 余额和代币余额）
  fetchBalances: (publicClient: PublicClient, stockTokenAddress: Address, userAddress: Address) => Promise<ContractCallResult>;

  // 2. 获取预估结果（使用最新价格）
  getSellEstimate: (publicClient: PublicClient, stockTokenAddress: Address, tokenAmount: bigint) => Promise<ContractCallResult>;

  // 3. 获取价格更新数据
  fetchPriceUpdateData: (publicClient: PublicClient, tokenSymbol: string) => Promise<ContractCallResult>;

  // 4. 执行卖出交易
  executeSellTransaction: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    account: Address,
    stockTokenAddress: Address,
    tokenAmount: bigint,
    minUsdtAmount: bigint,
    updateData: Uint8Array[],
    updateFee: bigint
  ) => Promise<ContractCallResult>;

  // ==================== 步骤五：高层业务方法 ====================
  // 完整的卖出流程
  sellToken: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    account: Address,
    stockTokenAddress: Address
  ) => Promise<ContractCallResult>;
}

// ==================== 步骤六：Store 实现 ====================
export const useSellStore = create<SellStoreState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ==================== 初始状态 ====================
      isConnected: false,
      address: null,
      token: null,
      balances: null,
      lastBalanceUpdate: 0,
      sellAmount: '',
      slippage: 3,
      estimate: null,
      isTransactionPending: false,
      currentTransaction: null,
      error: null,
      errorCode: null,
      sellHistory: [],

      // ==================== 基础方法实现 ====================

      /**
       * 设置连接状态
       */
      setConnected: (connected: boolean, address?: Address) => {
        const currentState = get();
        if (currentState.isConnected !== connected || currentState.address !== address) {
          console.log('🔗 设置连接状态:', { connected, address });
          set({
            isConnected: connected,
            address: address || null
          });
        }
      },

      /**
       * 设置代币信息
       */
      setToken: (token: TokenInfo) => {
        console.log('🪙 设置代币信息:', token);
        const currentToken = get().token;

        // 只有当代币信息真正改变时才更新
        if (!currentToken ||
            currentToken.address !== token.address ||
            currentToken.symbol !== token.symbol ||
            currentToken.price !== token.price) {
          set({ token });
          get().clearEstimate(); // 清除旧的预估信息
        }
      },

      /**
       * 设置卖出数量
       */
      setSellAmount: (amount: string) => {
        const currentAmount = get().sellAmount;
        if (currentAmount !== amount) {
          console.log('📝 设置卖出数量:', amount);
          set({ sellAmount: amount });
          get().clearEstimate(); // 清除旧的预估信息，等待重新计算
        }
      },

      /**
       * 设置滑点
       */
      setSlippage: (slippage: number) => {
        const currentSlippage = get().slippage;
        if (currentSlippage !== slippage) {
          console.log('📊 设置滑点:', slippage);
          set({ slippage });
          // 如果已有预估，重新计算最小接收数量
          const state = get();
          if (state.estimate) {
            get().setEstimate(state.estimate.estimatedUsdt, state.estimate.estimatedFee);
          }
        }
      },

      /**
       * 设置预估结果
       */
      setEstimate: (estimatedUsdt: bigint, estimatedFee: bigint) => {
        const currentEstimate = get().estimate;
        const state = get();
        const slippagePercentage = BigInt(100 - state.slippage);
        const minUsdtAmount = (estimatedUsdt * slippagePercentage) / 100n;

        const sellEstimate: SellEstimate = {
          estimatedUsdt,
          estimatedFee,
          minUsdtAmount,
          timestamp: Date.now(),
          formatted: {
            estimatedUsdt: formatUnits(estimatedUsdt, 6),
            estimatedFee: formatUnits(estimatedFee, 6),
            minUsdtAmount: formatUnits(minUsdtAmount, 6),
          }
        };

        // 只有当预估结果真正改变时才更新
        if (!currentEstimate ||
            currentEstimate.estimatedUsdt !== estimatedUsdt ||
            currentEstimate.estimatedFee !== estimatedFee ||
            currentEstimate.minUsdtAmount !== minUsdtAmount) {
          console.log('📈 设置预估结果:', {
            estimatedUsdt: estimatedUsdt.toString(),
            estimatedFee: estimatedFee.toString()
          });
          set({ estimate: sellEstimate });
        }
      },

      /**
       * 清除预估
       */
      clearEstimate: () => {
        if (get().estimate !== null) {
          console.log('🧹 清除预估结果');
          set({ estimate: null });
        }
      },

      /**
       * 设置交易状态
       */
      setTransactionPending: (pending: boolean) => {
        console.log('⏳ 设置交易状态:', { pending });
        set({ isTransactionPending: pending });
      },

      /**
       * 添加交易记录
       */
      addTransaction: (transaction: TransactionRecord) => {
        console.log('📝 添加交易记录:', transaction.hash);
        set((state) => ({
          sellHistory: [transaction, ...state.sellHistory],
          currentTransaction: transaction,
        }));
      },

      /**
       * 清除交易状态
       */
      clearTransaction: () => {
        console.log('🧹 清除当前交易');
        set({
          currentTransaction: null,
          isTransactionPending: false,
        });
      },

      /**
       * 设置错误信息
       */
      setError: (error: string, errorCode?: string) => {
        console.error('❌ 设置错误:', { error, errorCode });
        set({
          error,
          errorCode: errorCode || null,
        });
      },

      /**
       * 清除错误信息
       */
      clearError: () => {
        console.log('🧹 清除错误信息');
        set({
          error: null,
          errorCode: null,
        });
      },

      /**
       * 重置所有状态
       */
      reset: () => {
        console.log('🔄 重置卖出 Store');
        set({
          isConnected: false,
          address: null,
          token: null,
          balances: null,
          lastBalanceUpdate: 0,
          sellAmount: '',
          slippage: 3,
          estimate: null,
          isTransactionPending: false,
          currentTransaction: null,
          error: null,
          errorCode: null,
          sellHistory: [],
        });
      },

      // ==================== 合约调用方法实现 ====================

      /**
       * 1. 获取初始余额（USDT 余额和代币余额）
       */
      fetchBalances: async (publicClient: PublicClient, stockTokenAddress: Address, userAddress: Address): Promise<ContractCallResult> => {
        try {
          console.log('💰 获取用户余额...', {
            userAddress,
            stockTokenAddress,
            usdtAddress: usdtAddress.toString()
          });

          // 验证参数
          if (!publicClient) {
            throw new Error('PublicClient 未初始化');
          }
          if (!stockTokenAddress) {
            throw new Error('代币合约地址无效');
          }
          if (!userAddress) {
            throw new Error('用户地址无效');
          }

          console.log('📡 开始合约调用...');

          // 并行获取 USDT 余额和代币余额
          const balanceResults = await Promise.all([
            // 获取 USDT 余额
            publicClient.readContract({
              address: usdtAddress,
              abi: typedERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }).catch(error => {
              console.error('❌ 获取USDT余额失败:', error);
              return BigInt(0); // 返回0作为默认值
            }),
            // 获取代币余额
            publicClient.readContract({
              address: stockTokenAddress,
              abi: typedERC20ABI,
              functionName: 'balanceOf',
              args: [userAddress],
            }).catch(error => {
              console.error('❌ 获取代币余额失败:', error);
              return BigInt(0); // 返回0作为默认值
            })
          ]);

          console.log('📊 余额查询结果:', balanceResults.map(b => b.toString()));

          // 安全地转换为 bigint
          const usdtBalance = BigInt(balanceResults[0] as unknown as string);
          const tokenBalance = BigInt(balanceResults[1] as unknown as string);

          const balanceInfo: BalanceInfo = {
            usdtBalance,
            tokenBalance,
            formatted: {
              usdtBalance: formatUnits(usdtBalance, 6),
              tokenBalance: formatUnits(tokenBalance, 18),
            }
          };

          console.log('✅ 余额获取成功:', {
            usdtBalance: balanceInfo.formatted.usdtBalance,
            tokenBalance: balanceInfo.formatted.tokenBalance
          });

          set({
            balances: balanceInfo,
            lastBalanceUpdate: Date.now()
          });

          return {
            success: true,
            data: balanceInfo
          };
        } catch (error) {
          console.error('❌ 获取余额失败:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : '获取余额失败'
          };
        }
      },

      /**
       * 2. 获取预估结果（使用最新价格）
       * 合约方法：getSellEstimate(uint256 tokenAmount) returns (uint256 usdtAmount, uint256 feeAmount)
       */
      getSellEstimate: async (publicClient: PublicClient, stockTokenAddress: Address, tokenAmount: bigint): Promise<ContractCallResult> => {
        try {
          console.log('🧮 获取卖出预估...', { stockTokenAddress, tokenAmount: tokenAmount.toString() });

          const result = await publicClient.readContract({
            address: stockTokenAddress,
            abi: typedStockTokenABI,
            functionName: 'getSellEstimate',
            args: [tokenAmount]
          });

          // 安全地类型断言
          const resultArray = result as unknown;
          if (!Array.isArray(resultArray) || resultArray.length !== 2) {
            throw new Error('合约返回结果格式错误');
          }

          const estimatedUsdt = BigInt(resultArray[0] as unknown as string);
          const estimatedFee = BigInt(resultArray[1] as unknown as string);

          console.log('✅ 预估获取成功:', {
            estimatedUsdt: formatUnits(estimatedUsdt, 6),
            estimatedFee: formatUnits(estimatedFee, 6)
          });

          return {
            success: true,
            data: { estimatedUsdt, estimatedFee }
          };
        } catch (error) {
          console.error('❌ 获取预估失败:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : '获取预估失败'
          };
        }
      },

      /**
       * 3. 获取价格更新数据
       */
      fetchPriceUpdateData: async (publicClient: PublicClient, tokenSymbol: string): Promise<ContractCallResult> => {
        try {
          console.log('📡 获取价格更新数据...', { tokenSymbol, tokenSymbolType: typeof tokenSymbol });

          if (typeof tokenSymbol !== 'string') {
            throw new Error(`代币符号类型错误: 期望string，收到${typeof tokenSymbol}`);
          }

          const updateData = await fetchUpdateData([tokenSymbol]);
          console.log('🔍 获取到的原始数据类型:', typeof updateData, updateData);

          const updateFee = await publicClient.readContract({
                    address: OracleAggregatorAddress,
                    abi: ORACLE_AGGREGATOR_ABI,
                    functionName: "getUpdateFee",
                    args: [updateData]
                  }) as bigint;

          return {
            success: true,
            data: {
              updateData,
              updateFee
            }
          };
        } catch (error) {
          console.error('❌ 获取价格更新数据失败:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : '获取价格更新数据失败'
          };
        }
      },

      /**
       * 4. 执行卖出交易
       * 合约方法：sell(uint256 tokenAmount, uint256 minUsdtAmount, bytes[] updateData) payable
       */
      executeSellTransaction: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        stockTokenAddress: Address,
        tokenAmount: bigint,
        minUsdtAmount: bigint,
        updateData: Uint8Array[],
        updateFee: bigint
      ): Promise<ContractCallResult> => {
        try {
          console.log('🚀 执行卖出交易...', {
            stockTokenAddress,
            tokenAmount: tokenAmount.toString(),
            minUsdtAmount: minUsdtAmount.toString(),
            updateFee: updateFee.toString()
          });

          console.log('🔍 调试信息:', {
            walletClient,
            walletClientType: typeof walletClient,
            hasWriteContract: typeof walletClient.writeContract,
            stockTokenAddress,
            abi: typedStockTokenABI,
            functionName: 'sell',
            args: [tokenAmount, minUsdtAmount, updateData],
            chain,
            account,
            value: updateFee
          });
          const hash = await walletClient.writeContract({
            address: stockTokenAddress,
            abi: typedStockTokenABI,
            functionName: 'sell',
            args: [tokenAmount, minUsdtAmount, updateData],
            chain,
            account,
            value: updateFee // 支付价格更新费用
          });

          console.log('📝 交易哈希:', hash);

          console.log('⏳ 等待交易确认...');
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          console.log('✅ 交易已确认');

          return {
            success: true,
            data: { hash, receipt }
          };
        } catch (error) {
          console.error('❌ 执行卖出交易失败:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : '执行卖出交易失败'
          };
        }
      },

      // ==================== 高层业务方法实现 ====================

      /**
       * 完整的卖出流程
       * 1. 获取初始余额 -> 2. 获取预估 -> 3. 获取价格更新数据 -> 4. 执行卖出
       */
      sellToken: async (
        publicClient: PublicClient,
        walletClient: WalletClient,
        chain: Chain,
        account: Address,
        stockTokenAddress: Address
      ): Promise<ContractCallResult> => {
        const state = get();

        try {
          console.log('🚀 开始完整卖出流程...');

          // 验证参数
          if (!state.sellAmount || !state.token) {
            throw new Error('缺少卖出参数或代币信息');
          }

          if (!state.isConnected || !state.address) {
            throw new Error('钱包未连接');
          }

          // 清除错误状态
          get().clearError();
          get().setTransactionPending(true);

          // 步骤1：获取初始余额
          console.log('📋 步骤1：获取初始余额...');
          const balanceResult = await get().fetchBalances(publicClient, stockTokenAddress, account);
          if (!balanceResult.success || !balanceResult.data) {
            throw new Error(balanceResult.error || '获取余额失败');
          }

          const { tokenBalance } = balanceResult.data as BalanceInfo;
          const sellAmountWei = parseUnits(state.sellAmount, 18);

          // 检查代币余额是否足够
          if (tokenBalance < sellAmountWei) {
            throw new Error(`代币余额不足。余额: ${formatUnits(tokenBalance, 18)}, 尝试卖出: ${state.sellAmount}`);
          }

          // 步骤2：获取预估结果（使用最新价格）
          console.log('📋 步骤2：获取预估结果...');
          const estimateResult = await get().getSellEstimate(publicClient, stockTokenAddress, sellAmountWei);
          if (!estimateResult.success || !estimateResult.data) {
            throw new Error(estimateResult.error || '获取预估失败');
          }

          const estimateData = estimateResult.data as SellEstimateResult;
          const { estimatedUsdt, estimatedFee } = estimateData;
          get().setEstimate(estimatedUsdt, estimatedFee);

          const minUsdtAmount = get().estimate!.minUsdtAmount;

          // 步骤3：获取价格更新数据
          console.log('📋 步骤3：获取价格更新数据...');
          console.log('🔍 代币符号:', state.token?.symbol, typeof state.token?.symbol);
          if (!state.token?.symbol) {
            throw new Error('代币符号无效');
          }
          const updateDataResult = await get().fetchPriceUpdateData(publicClient, state.token.symbol);
          if (!updateDataResult.success || !updateDataResult.data) {
            throw new Error(updateDataResult.error || '获取价格更新数据失败');
          }

          const { updateData, updateFee } = updateDataResult.data;
         


          // 步骤4：执行卖出交易
          console.log('📋 步骤4：执行卖出交易...');
          const sellResult = await get().executeSellTransaction(
            publicClient,
            walletClient,
            chain,
            account,
            stockTokenAddress,
            sellAmountWei,
            minUsdtAmount,
            updateData,
            updateFee
          );

          if (!sellResult.success) {
            throw new Error(sellResult.error || '执行卖出交易失败');
          }

          // 获取交易结果
          const transactionResult = sellResult.data as TransactionResult;

          // 添加交易记录
          get().addTransaction({
            hash: transactionResult.hash,
            tokenAmount: sellAmountWei,
            usdtAmount: estimatedUsdt,
            feeAmount: estimatedFee,
            timestamp: Date.now(),
            status: 'success'
          });

          console.log('✅ 卖出流程完成成功!');
          return {
            success: true,
            data: {
              hash: transactionResult.hash,
              tokenAmount: state.sellAmount,
              usdtAmount: get().estimate!.formatted.estimatedUsdt,
              feeAmount: get().estimate!.formatted.estimatedFee,
              beforeBalances: balanceResult.data,
              transactionReceipt: transactionResult.receipt
            }
          };

        } catch (error) {
          console.error('❌ 卖出流程失败:', error);
          get().setError('卖出流程失败', 'SELL_PROCESS_FAILED');
          get().setTransactionPending(false);

          return {
            success: false,
            error: error instanceof Error ? error.message : '卖出流程失败'
          };
        } finally {
          get().setTransactionPending(false);
        }
      },
    })),
    {
      name: 'sell-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

export default useSellStore;