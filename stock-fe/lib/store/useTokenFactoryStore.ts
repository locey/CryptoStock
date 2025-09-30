import { create } from 'zustand';
import {
  Address,
  PublicClient,
  WalletClient,
  TransactionReceipt,
  Abi,
  decodeEventLog as viemDecodeEventLog,
  Chain,
  Hex
} from 'viem';
import TokenFactoryABI from '@/lib/abi/TokenFactory.json';
import StockTokenABI from '@/lib/abi/StockToken.json';

// ==================== 类型定义 ====================
/**
 * 代币信息类型
 */
export interface TokenInfo {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  userBalance: bigint;
  price: bigint; // 以 wei 为单位的价格
  marketCap: bigint;
  change24h: number; // 24小时涨跌幅百分比
  volume24h: bigint; // 24小时成交量
  initialSupply?: bigint;
}

/**
 * 创建代币参数类型
 */
export interface CreateTokenParams {
  name: string;
  symbol: string;
  initialSupply: bigint;
}

/**
 * 交易结果类型
 */
export interface TransactionResult {
  hash: `0x${string}`;
  receipt: TransactionReceipt;
}

/**
 * TokenCreated 事件参数类型
 */
export interface TokenCreatedEventArgs {
  tokenAddress: Address;
  name: string;
  symbol: string;
}

/**
 * 解码事件日志的返回类型
 */
export interface DecodedTokenCreatedEvent {
  eventName: 'TokenCreated';
  args: TokenCreatedEventArgs;
}

/**
 * 部署信息类型
 */
export interface DeploymentInfo {
  network: string;
  chainId: string;
  deployer: Address;
  contracts: {
    OracleAggregator: {
      proxy: Address;
      implementation: Address;
    };
    TokenFactory: {
      proxy: Address;
      implementation: Address;
    };
    StockTokenImplementation: Address;
    USDT: Address;
  };
  stockTokens: Record<string, Address>;
  priceFeeds: Record<string, string>;
  timestamp: string;
}

// ==================== Store 状态定义 ====================
interface TokenFactoryState {
  // ==================== 状态 ====================
  /** 合约地址 */
  contractAddress: Address | null;
  /** 所有代币列表 */
  allTokens: TokenInfo[];
  /** 代币映射 (symbol -> address) */
  tokenBySymbol: Record<string, Address>;
  /** 加载状态 */
  isLoading: boolean;
  /** 创建代币时的加载状态 */
  isCreatingToken: boolean;
  /** 错误信息 */
  error: string | null;

  // ==================== 初始化方法 ====================
  /** 初始化合约地址 */
  initContract: (address: Address) => void;
  /** 从部署文件初始化合约地址 */
  initFromDeployment: (deploymentInfo?: DeploymentInfo) => void;

  // ==================== 读取方法 ====================
  /** 获取所有代币 */
  fetchAllTokens: (publicClient: PublicClient, userAddress?: Address) => Promise<void>;
  /** 获取代币映射 */
  fetchTokensMapping: (publicClient: PublicClient) => Promise<void>;
  /** 根据符号获取代币地址 */
  getTokenAddress: (publicClient: PublicClient, symbol: string) => Promise<Address>;
  /** 获取代币总数 */
  getTokensCount: (publicClient: PublicClient) => Promise<number>;
  /** 获取用户代币余额 */
  fetchUserBalance: (publicClient: PublicClient, tokenAddress: Address, userAddress: Address) => Promise<bigint>;

  // ==================== 写入方法 ====================
  /** 创建新代币 */
  createToken: (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: CreateTokenParams,
    account: Address
  ) => Promise<TransactionResult>;

  // ==================== 辅助方法 ====================
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置创建代币的加载状态 */
  setCreatingToken: (creating: boolean) => void;
  /** 设置错误信息 */
  setError: (error: string | null) => void;
  /** 清除错误信息 */
  clearErrors: () => void;
  /** 重置状态 */
  reset: () => void;
}

// ==================== 类型化 ABI ====================
const typedTokenFactoryABI = TokenFactoryABI as Abi;

// ==================== Store 创建 ====================
export const useTokenFactoryStore = create<TokenFactoryState>((set, get) => ({
  // ==================== 初始状态 ====================
  contractAddress: null,
  allTokens: [],
  tokenBySymbol: {},
  isLoading: false,
  isCreatingToken: false,
  error: null,

  // ==================== 初始化方法 ====================
  /**
   * 初始化合约地址
   * @param address TokenFactory 合约地址
   */
  initContract: (address: Address) => {
    try {
      set({ contractAddress: address, error: null });
      console.log('✅ TokenFactory 合约地址已初始化:', address);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '初始化合约失败';
      set({ error: errorMsg });
      console.error('❌ 初始化合约失败:', errorMsg);
    }
  },

  /**
   * 从部署文件初始化合约地址
   * @param deploymentInfo 部署信息（可选，如果不提供则从导入的文件读取）
   */
  initFromDeployment: (deploymentInfo?: DeploymentInfo) => {
    try {
      // 如果提供了部署信息，使用它；否则可以在这里导入默认的部署文件
      const info = deploymentInfo;
      if (info?.contracts?.TokenFactory?.proxy) {
        set({ contractAddress: info.contracts.TokenFactory.proxy, error: null });
        console.log('✅ TokenFactory 合约地址已从部署文件初始化:', info.contracts.TokenFactory.proxy);
      } else {
        throw new Error('部署文件中未找到 TokenFactory 合约地址');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '从部署文件初始化失败';
      set({ error: errorMsg });
      console.error('❌ 从部署文件初始化失败:', errorMsg);
    }
  },

  // ==================== 读取方法 ====================
  /**
   * 获取所有代币信息
   * @param publicClient 公共客户端
   * @param userAddress 用户地址（可选，用于获取用户余额）
   */
  fetchAllTokens: async (publicClient: PublicClient, userAddress?: Address) => {
    const { contractAddress } = get();
    if (!contractAddress) {
      set({ error: '合约地址未初始化' });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('🔍 获取所有代币信息...');

      const tokenAddresses = await publicClient.readContract({
        address: contractAddress,
        abi: typedTokenFactoryABI,
        functionName: 'getAllTokens',
      }) as Address[];
      console.log("tokenAddresses", tokenAddresses);

      // 获取每个代币的详细信息
      const tokensInfo: TokenInfo[] = [];
      for (const tokenAddress of tokenAddresses) {
        try {
          console.log(`🔍 获取代币 ${tokenAddress} 的详细信息...`);

          // 使用 StockToken ABI 获取代币详细信息
          const [name, symbol, decimals, totalSupply, price] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress,
              abi: StockTokenABI,
              functionName: 'name',
            }),
            publicClient.readContract({
              address: tokenAddress,
              abi: StockTokenABI,
              functionName: 'symbol',
            }),
            publicClient.readContract({
              address: tokenAddress,
              abi: StockTokenABI,
              functionName: 'decimals',
            }),
            publicClient.readContract({
              address: tokenAddress,
              abi: StockTokenABI,
              functionName: 'totalSupply',
            }),
            publicClient.readContract({
              address: tokenAddress,
              abi: StockTokenABI,
              functionName: 'getStockPrice',
            }),
          ]);

          console.log(`✅ 代币 ${tokenAddress} 信息获取成功:`, { name, symbol, decimals, totalSupply, price });

          // 获取当前用户余额（如果提供了用户地址）
          let userBalance = BigInt(0);
          if (userAddress) {
            try {
              console.log(`👤 获取 ${symbol} 用户余额，用户: ${userAddress}`);
              userBalance = await publicClient.readContract({
                address: tokenAddress,
                abi: StockTokenABI,
                functionName: 'balanceOf',
                args: [userAddress],
              }) as bigint;
              console.log(`✅ ${symbol} 用户余额获取成功: ${userBalance}`);
            } catch (error) {
              console.warn(`❌ 获取用户 ${symbol} 余额失败:`, error);
              userBalance = BigInt(0);
            }
          } else {
            console.log(`👤 未提供用户地址，${symbol} 用户余额设置为 0`);
          }

          // 计算市值 (price * totalSupply) / 10^decimals
          const priceBigInt = price as bigint;
          const totalSupplyBigInt = totalSupply as bigint;
          const rawMarketCap = priceBigInt * totalSupplyBigInt;
          const marketCap = rawMarketCap / BigInt(10 ** Number(decimals));
          console.log(`📊 市值计算: price=${price}, totalSupply=${totalSupply}, rawMarketCap=${rawMarketCap}, marketCap=${marketCap}`);

          // 生成模拟的 24 小时涨跌幅和成交量
          const change24h = (Math.random() - 0.5) * 10; // -5% 到 +5%
          const volume24h = BigInt(Math.floor(Math.random() * 1000000000) * 10 ** Number(decimals));

          const tokenInfo: TokenInfo = {
            address: tokenAddress,
            name: name as string,
            symbol: symbol as string,
            decimals: Number(decimals),
            totalSupply: totalSupply as bigint,
            userBalance,
            price: price as bigint,
            marketCap,
            change24h,
            volume24h,
          };
          tokensInfo.push(tokenInfo);
          console.log(`✅ 代币 ${symbol} (${name}) 已添加到列表`);
        } catch (error) {
          console.error(`❌ 获取代币信息失败: ${tokenAddress}`, error);
        }
      }

      console.log(`📊 最终获取到 ${tokensInfo.length} 个代币信息`);

      set({ allTokens: tokensInfo, isLoading: false });
      console.log('✅ 获取到', tokensInfo.length, '个代币');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取代币信息失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取代币信息失败:', errorMsg);
    }
  },

  /**
   * 获取代币映射
   * @param publicClient 公共客户端
   */
  fetchTokensMapping: async (publicClient: PublicClient) => {
    const { contractAddress } = get();
    if (!contractAddress) {
      set({ error: '合约地址未初始化' });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      console.log('🔍 获取代币映射...');

      const mapping = await publicClient.readContract({
        address: contractAddress,
        abi: typedTokenFactoryABI,
        functionName: 'getTokensMapping',
      }) as [string[], Address[]];

      const tokenBySymbol: Record<string, Address> = {};
      mapping[0].forEach((symbol, index) => {
        tokenBySymbol[symbol] = mapping[1][index];
      });

      set({ tokenBySymbol, isLoading: false });
      console.log('✅ 获取到', Object.keys(tokenBySymbol).length, '个代币映射');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取代币映射失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取代币映射失败:', errorMsg);
    }
  },

  /**
   * 根据符号获取代币地址
   * @param publicClient 公共客户端
   * @param symbol 代币符号
   */
  getTokenAddress: async (publicClient: PublicClient, symbol: string): Promise<Address> => {
    const { contractAddress } = get();
    const nullAddress = '0x0000000000000000000000000000000000000000' as Address;

    if (!contractAddress) {
      set({ error: '合约地址未初始化' });
      return nullAddress;
    }

    try {
      set({ isLoading: true, error: null });
      console.log(`🔍 获取代币 ${symbol} 的地址...`);

      const tokenAddress = await publicClient.readContract({
        address: contractAddress,
        abi: typedTokenFactoryABI,
        functionName: 'getTokenAddress',
        args: [symbol]
      }) as Address;

      set({ isLoading: false });
      console.log('✅ 获取到代币地址:', tokenAddress);
      return tokenAddress;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取代币地址失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取代币地址失败:', errorMsg);
      return nullAddress;
    }
  },

  /**
   * 获取代币总数
   * @param publicClient 公共客户端
   */
  getTokensCount: async (publicClient: PublicClient): Promise<number> => {
    const { contractAddress } = get();

    if (!contractAddress) {
      set({ error: '合约地址未初始化' });
      return 0;
    }

    try {
      set({ isLoading: true, error: null });

      const count = await publicClient.readContract({
        address: contractAddress,
        abi: typedTokenFactoryABI,
        functionName: 'allTokens',
        args: ['length'] // 获取数组长度
      }) as bigint;

      set({ isLoading: false });
      return Number(count);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取代币总数失败';
      set({ error: errorMsg, isLoading: false });
      console.error('❌ 获取代币总数失败:', errorMsg);
      return 0;
    }
  },

  /**
   * 获取用户代币余额
   * @param publicClient 公共客户端
   * @param tokenAddress 代币地址
   * @param userAddress 用户地址
   */
  fetchUserBalance: async (publicClient: PublicClient, tokenAddress: Address, userAddress: Address): Promise<bigint> => {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: StockTokenABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      return balance as bigint;
    } catch (error) {
      console.warn('获取用户余额失败:', error);
      return BigInt(0);
    }
  },

  // ==================== 写入方法 ====================
  /**
   * 创建新代币
   * @param publicClient 公共客户端
   * @param walletClient 钱包客户端
   * @param chain 链配置
   * @param params 创建代币参数
   * @param account 用户地址
   */
  createToken: async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    chain: Chain,
    params: CreateTokenParams,
    account: Address
  ): Promise<TransactionResult> => {
    const { contractAddress } = get();
    if (!contractAddress) {
      throw new Error('合约地址未初始化');
    }

    try {
      set({ isCreatingToken: true, error: null });
      console.log('🚀 开始创建代币...');
      console.log('参数:', params);

      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: typedTokenFactoryABI,
        functionName: 'createToken',
        args: [params.name, params.symbol, params.initialSupply],
        chain,
        account,
      });

      console.log('📝 交易哈希:', hash);

      console.log('⏳ 等待交易确认...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('✅ 交易已确认');

      // 从事件中获取新代币地址
      let newTokenAddress: Address | null = null;
      if (receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const event = decodeEventLog({
              abi: typedTokenFactoryABI,
              data: log.data,
              topics: [...log.topics] as unknown as [signature: Hex, ...args: Hex[]],
            });

            if (event && event.eventName === 'TokenCreated') {
              const tokenCreatedEvent = event as unknown as DecodedTokenCreatedEvent;
              newTokenAddress = tokenCreatedEvent.args.tokenAddress;
              console.log('✅ 新代币地址:', newTokenAddress);
              break;
            }
          } catch (e) {
            // 忽略解码错误
            console.warn('解码事件日志失败:', e);
          }
        }
      }

      // 刷新代币列表
      await get().fetchAllTokens(publicClient);

      set({ isCreatingToken: false });
      return { hash, receipt };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '创建代币失败';
      set({ error: errorMsg, isCreatingToken: false });
      console.error('❌ 创建代币失败:', errorMsg);
      throw error;
    }
  },

  // ==================== 辅助方法 ====================
  /**
   * 设置加载状态
   * @param loading 是否加载中
   */
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  /**
   * 设置创建代币的加载状态
   * @param creating 是否创建中
   */
  setCreatingToken: (creating: boolean) => {
    set({ isCreatingToken: creating });
  },

  /**
   * 设置错误信息
   * @param error 错误信息
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
   * 重置状态
   */
  reset: () => {
    set({
      contractAddress: null,
      allTokens: [],
      tokenBySymbol: {},
      isLoading: false,
      isCreatingToken: false,
      error: null,
    });
  },
}));

// ==================== 事件解码辅助函数 ====================
/**
 * 解码事件日志
 */
function decodeEventLog({ abi, data, topics }: {
  abi: Abi;
  data: `0x${string}`;
  topics: [signature: Hex, ...args: Hex[]]
}) {
  try {
    // 使用 viem 的 decodeEventLog 函数
    const decoded = viemDecodeEventLog({
      abi,
      data,
      topics,
    });

    return decoded;
  } catch (error) {
    // 如果 viem 解码失败，返回空值
    console.warn('解码事件日志失败:', error);
    return null;
  }
}

export default useTokenFactoryStore;