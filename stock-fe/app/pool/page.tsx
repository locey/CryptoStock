"use client";

import { useState, useEffect, useMemo } from "react";
import { useTokenFactoryWithClients } from "@/lib/hooks/useTokenFactoryWithClients";
import { useWallet } from "ycdirectory-ui";
import { formatUnits, parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import BuyModal from "@/components/BuyModal";
import { SellModal } from "@/components/SellModal";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Apple,
  Car,
  Search,
  Server,
  ShoppingBag,
  MessageSquare,
  Cpu,
  Bitcoin,
  CircleDollarSign,
  Gamepad2,
  Zap,
  Briefcase,
  Building2,
  Heart,
  Smartphone,
} from "lucide-react";
import {
  formatNumber,
  formatPrice,
  formatPercent,
  formatMarketCap,
} from "@/lib/utils/format";
import useTokenFactoryStore from "@/lib/store/useTokenFactoryStore";
import { DEFAULT_CONFIG, getNetworkConfig } from "@/lib/contracts";

// 使用动态合约地址
function getContractAddresses() {
  // 使用 Sepolia 测试网配置
  return {
    ORACLE_AGGREGATOR_ADDRESS: DEFAULT_CONFIG.contracts.oracleAggregator as const,
    USDT_ADDRESS: DEFAULT_CONFIG.contracts.usdt as const,
  };
}

const { ORACLE_AGGREGATOR_ADDRESS, USDT_ADDRESS } = getContractAddresses();

interface TokenData {
  symbol: string;
  name: string;
  address: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  totalSupply: number;
  userBalance: number;
  userValue: number;
}

// 分别定义 BuyModal 和 SellModal 的状态
interface BuyModalState {
  isOpen: boolean;
  token: TokenData | null;
}

interface SellModalState {
  isOpen: boolean;
  token: TokenData | null;
}

export default function TokenPool() {
  const { toast } = useToast();

  const walletState = useWallet();
  const { isConnected, address } = walletState;
  const { fetchTokensInfo } = useTokenFactoryWithClients();

  // 直接从store获取数据
  const storeAllTokens = useTokenFactoryStore((state) => state.allTokens);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"marketCap" | "volume" | "price">(
    "marketCap"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [buyModal, setBuyModal] = useState<BuyModalState>({
    isOpen: false,
    token: null,
  });
  const [sellModal, setSellModal] = useState<SellModalState>({
    isOpen: false,
    token: null,
  });

  // 使用store数据进行转换
  const tokens = useMemo(() => {
    console.log("🔄 tokens useMemo 被调用");
    console.log("📊 storeAllTokens:", storeAllTokens);
    console.log("📊 storeAllTokens 长度:", storeAllTokens?.length);

    if (!storeAllTokens || storeAllTokens.length === 0) {
      console.log("❌ store中没有代币数据，返回空数组");
      return [];
    }

    console.log("✅ 开始转换代币数据，数量:", storeAllTokens.length);
    const convertedTokens = storeAllTokens.map((tokenInfo, index) => {
      console.log(`🔄 ===== 转换第 ${index} 个代币 =====`);
      console.log(`🔄 原始代币数据:`, {
        symbol: tokenInfo.symbol,
        userBalance: tokenInfo.userBalance,
        userBalanceType: typeof tokenInfo.userBalance,
        decimals: tokenInfo.decimals,
      });

      const totalSupply = Number(
        formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)
      );

      console.log(`👤 !!! 开始转换用户余额 !!!`);
      console.log(`👤 原始值:`, tokenInfo.userBalance);
      console.log(`👤 类型:`, typeof tokenInfo.userBalance);
      console.log(
        `👤 是否为 BigInt:`,
        typeof tokenInfo.userBalance === "bigint"
      );
      console.log(`👤 精度:`, tokenInfo.decimals);

      let userBalance = 0;

      // 检查是否为 bigint
      if (typeof tokenInfo.userBalance !== "bigint") {
        console.warn(`⚠️ userBalance 不是 bigint 类型:`, tokenInfo.userBalance);
        userBalance = 0;
      } else {
        try {
          // 使用 formatUnits 转换
          const formattedBalance = formatUnits(
            tokenInfo.userBalance,
            tokenInfo.decimals
          );
          console.log(`👤 formatUnits 结果:`, {
            formatted: formattedBalance,
            type: typeof formattedBalance,
            length: formattedBalance.length,
          });

          // 检查格式化后的值是否太大
          if (formattedBalance.length > 15) {
            console.warn(
              `⚠️ 余额值过大，可能超出 Number 精度范围:`,
              formattedBalance
            );
          }

          const rawUserBalance = Number(formattedBalance);
          console.log(`👤 Number 转换结果:`, {
            rawUserBalance,
            type: typeof rawUserBalance,
            isNaN: isNaN(rawUserBalance),
            isFinite: isFinite(rawUserBalance),
            MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
            isOverSafeInteger: rawUserBalance > Number.MAX_SAFE_INTEGER,
          });

          // 如果转换后的值不是有限值或超出安全整数范围，使用替代方案
          if (
            !isFinite(rawUserBalance) ||
            rawUserBalance > Number.MAX_SAFE_INTEGER
          ) {
            console.warn(`⚠️ 使用科学计数法处理大数值余额:`, formattedBalance);
            // 尝试使用科学计数法解析
            const scientificBalance = parseFloat(formattedBalance);
            if (isFinite(scientificBalance)) {
              userBalance = scientificBalance;
            } else {
              // 如果还是太大，设置为 0 或使用其他处理方式
              userBalance = 0;
              console.warn(`⚠️ 余额值过大，无法精确显示，设置为 0`);
            }
          } else {
            userBalance = rawUserBalance;
          }
        } catch (error) {
          console.error(`❌ formatUnits 转换失败:`, error);
          userBalance = 0;
        }
      }
      const price = Number(formatUnits(tokenInfo.price, tokenInfo.decimals));
      const volume24h = Number(
        formatUnits(tokenInfo.volume24h, tokenInfo.decimals)
      );
      const rawMarketCap = Number(
        formatUnits(tokenInfo.marketCap, tokenInfo.decimals)
      );
      console.log(
        `📊 市值转换: ${tokenInfo.marketCap} -> ${rawMarketCap} (decimals: ${tokenInfo.decimals})`
      );
      const marketCap = rawMarketCap;

      const convertedToken = {
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        address: tokenInfo.address,
        price,
        change24h: tokenInfo.change24h,
        volume24h,
        marketCap,
        totalSupply,
        userBalance,
        userValue: userBalance * price,
        debug: {
          userBalance,
          price,
          userValue: userBalance * price,
        },
      };

      console.log(`✅ 第 ${index} 个代币转换完成:`, convertedToken);
      return convertedToken;
    });

    console.log("🎯 最终转换完成的代币数据:", convertedTokens.map(token => ({
      symbol: token.symbol,
      price: token.price,
      priceFormatted: formatPrice(token.price),
      userBalance: token.userBalance,
      marketCap: token.marketCap
    })));
    return convertedTokens;
  }, [storeAllTokens]);

  // 初始化数据获取（只执行一次）
  useEffect(() => {
    const initializeData = async () => {
      console.log("🚀 初始化数据获取");

      // 每次都调用 fetchTokensInfo 来获取最新数据
      try {
        console.log("调用fetchTokensInfo获取最新代币数据");
        await fetchTokensInfo();
        console.log("✅ 代币数据获取完成");
      } catch (error) {
        console.error("获取代币信息失败:", error);
      }
    };

    initializeData();
  }, [fetchTokensInfo]);

  // 排序和过滤代币
  const filteredAndSortedTokens = tokens
    .filter(
      (token) =>
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue: number, bValue: number;

      switch (sortBy) {
        case "marketCap":
          aValue = a.marketCap;
          bValue = b.marketCap;
          break;
        case "volume":
          aValue = a.volume24h;
          bValue = b.volume24h;
          break;
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        default:
          aValue = a.marketCap;
          bValue = b.marketCap;
      }

      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });

  // 格式化数字 - 已导入 formatUtils

  // 获取股票图标
  const getStockIcon = (symbol: string) => {
    const icons: Record<string, React.ReactNode> = {
      // 科技公司
      AAPL: <Apple className="w-6 h-6 text-white" />,
      MSFT: <Server className="w-6 h-6 text-white" />,
      GOOGL: <Search className="w-6 h-6 text-white" />,
      META: <MessageSquare className="w-6 h-6 text-white" />,
      NVDA: <Cpu className="w-6 h-6 text-white" />,
      TSLA: <Car className="w-6 h-6 text-white" />,
      AMZN: <ShoppingBag className="w-6 h-6 text-white" />,
      NFLX: <Smartphone className="w-6 h-6 text-white" />,

      // 加密货币
      BTC: <Bitcoin className="w-6 h-6 text-white" />,
      ETH: <CircleDollarSign className="w-6 h-6 text-white" />,

      // 游戏/娱乐
      SONY: <Gamepad2 className="w-6 h-6 text-white" />,
      EA: <Gamepad2 className="w-6 h-6 text-white" />,

      // 能源
      NIO: <Zap className="w-6 h-6 text-white" />,

      // 金融
      JPM: <Briefcase className="w-6 h-6 text-white" />,
      BAC: <Building2 className="w-6 h-6 text-white" />,

      // 医疗健康
      JNJ: <Heart className="w-6 h-6 text-white" />,
      PFE: <Heart className="w-6 h-6 text-white" />,
    };

    return (
      icons[symbol] || (
        <div className="w-6 h-6 flex items-center justify-center font-bold text-white">
          {symbol.charAt(0)}
        </div>
      )
    );
  };

  // 获取代币描述
  const getTokenDescription = (symbol: string): string => {
    const descriptions: Record<string, string> = {
      AAPL: "苹果公司是全球领先的科技公司，设计、制造和销售智能手机、个人电脑、平板电脑、可穿戴设备和配件，并提供相关服务。",
      TSLA: "特斯拉公司是全球领先的电动汽车和清洁能源公司，致力于加速世界向可持续能源的转变。",
      GOOGL:
        "谷歌是全球最大的搜索引擎公司，提供互联网搜索、广告技术、云计算、人工智能和消费电子产品等服务。",
      MSFT: "微软公司是全球领先的软件和技术公司，开发、制造、许可和提供软件产品和服务。",
      AMZN: "亚马逊是全球最大的电子商务和云计算公司，提供在线零售、数字流媒体和人工智能服务。",
      META: "Meta平台公司（原Facebook）是全球最大的社交媒体公司，运营Facebook、Instagram、WhatsApp等平台。",
      NVDA: "英伟达是全球领先的图形处理器和人工智能芯片设计公司，为游戏、专业可视化和数据中心市场提供解决方案。",
      BTC: "比特币是第一个去中心化的数字货币，基于区块链技术，被誉为数字黄金。",
      ETH: "以太坊是一个开源的区块链平台，支持智能合约功能，是去中心化应用的主要开发平台。",
    };

    return (
      descriptions[symbol] ||
      `${symbol}是一种数字资产，基于区块链技术，具有去中心化、透明、不可篡改的特点。`
    );
  };

  // 打开买入界面
  const openBuyModal = (token: TokenData) => {
    console.log("🚀 openBuyModal 调用:", {
      isConnected,
      address,
      tokenSymbol: token.symbol,
      addressType: typeof address,
      addressLength: address?.length,
      isConnectedType: typeof isConnected,
    });

    // 更严格的连接状态检查
    const isActuallyConnected =
      isConnected &&
      address &&
      address !== "0x0000000000000000000000000000000000000000";

    console.log("🔍 openBuyModal 连接状态检查:", {
      isConnected,
      address,
      isActuallyConnected,
    });

    if (!isActuallyConnected) {
      console.log("❌ 钱包未连接或无有效地址，阻止打开购买弹窗");
      toast({
        title: "连接钱包",
        description: "请先连接钱包后再进行交易",
        variant: "destructive",
      });
      return;
    }

    console.log("✅ 钱包连接正常，打开购买弹窗");

    // 先设置弹窗状态
    setBuyModal({
      isOpen: true,
      token,
    });

    // 初始化数据 (获取最新的 Pyth 数据等)
    console.log("🔄 打开购买弹窗时初始化交易数据...");
    // 注意：数据初始化现在在 BuyModal 组件内部处理
  };

  // 打开卖出界面
  const openSellModal = (token: TokenData) => {
    if (!isConnected) {
      toast({
        title: "连接钱包",
        description: "请先连接钱包后再进行交易",
        variant: "destructive",
      });
      return;
    }
    setSellModal({
      isOpen: true,
      token,
    });
  };

  // 关闭买入界面
  const closeBuyModal = () => {
    setBuyModal({
      isOpen: false,
      token: null,
    });
  };

  // 关闭卖出界面
  const closeSellModal = () => {
    setSellModal({
      isOpen: false,
      token: null,
    });
  };

  // 处理交易

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-73px">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">币股池</h1>
              <p className="text-gray-400">交易真实股票的 ERC20 代币</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">总市值</div>
              <div className="text-2xl font-bold text-white">
                {formatNumber(
                  tokens.reduce((sum, token) => sum + token.marketCap, 0)
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索代币..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="marketCap">市值</option>
              <option value="volume">成交量</option>
              <option value="price">价格</option>
            </select>
            <Button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              variant="sort"
              size="sort"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </Button>
          </div>
        </div>

        {/* Token Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(() => {
            console.log(
              "🎯 渲染代币卡片，filteredAndSortedTokens:",
              filteredAndSortedTokens
            );
            console.log(
              "🎯 filteredAndSortedTokens 长度:",
              filteredAndSortedTokens?.length
            );
            return null;
          })()}
          {filteredAndSortedTokens.map((token) => {
            const isPositive = token.change24h >= 0;
            const changeAmount = token.price * (token.change24h / 100);
            return (
              <div
                key={token.symbol}
                className={`group bg-gray-900/60 backdrop-blur-xl border rounded-2xl p-5 transition-all duration-500 card-hover-3d glow-effect relative overflow-hidden ${
                  isPositive
                    ? "border-green-500/20 hover:border-green-500/40"
                    : "border-red-500/20 hover:border-red-500/40"
                }`}
              >
                {/* Animated background gradient */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 ${
                    isPositive
                      ? "from-green-500/5 to-emerald-500/5"
                      : "from-red-500/5 to-orange-500/5"
                  }`}
                ></div>

                {/* Top glow line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl transition-opacity duration-500 ${
                    isPositive
                      ? "bg-gradient-to-r from-green-500 to-emerald-500"
                      : "bg-gradient-to-r from-red-500 to-orange-500"
                  } opacity-60 group-hover:opacity-100`}
                ></div>

                <div className="relative z-10">
                  {/* Header with token info and trend indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transform transition-all duration-500 group-hover:scale-110 ${
                          isPositive
                            ? "bg-gradient-to-br from-green-500 to-emerald-600"
                            : "bg-gradient-to-br from-red-500 to-orange-600"
                        }`}
                      >
                        {getStockIcon(token.symbol)}
                      </div>
                      <div>
                        <div className="font-bold text-lg text-white transform transition-all duration-500 group-hover:translate-x-1">
                          {token.symbol}
                        </div>
                        <div className="text-sm text-gray-400 transform transition-all duration-500 group-hover:text-gray-300">
                          {token.name}
                        </div>
                      </div>
                    </div>

                    {/* Trend arrow indicator */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg transform transition-all duration-500 group-hover:scale-105 ${
                        isPositive
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <span className="text-sm font-semibold">
                        {formatPercent(token.change24h)}
                      </span>
                    </div>
                  </div>

                  {/* Price section */}
                  <div className="bg-gray-800/50 rounded-xl p-3 mb-3">
                    <div className="text-2xl font-bold text-white mb-1">
                      {formatPrice(token.price)}
                    </div>
                    <div
                      className={`text-sm font-medium flex items-center gap-2 ${
                        isPositive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      <span>
                        {isPositive ? "+" : ""}
                        {formatPrice(Math.abs(changeAmount))}
                      </span>
                      <span>({formatPercent(token.change24h)})</span>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-800/30 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">成交量</div>
                      <div className="text-sm font-semibold text-white">
                        {formatNumber(token.volume24h)}
                      </div>
                    </div>
                    <div className="bg-gray-800/30 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">市值</div>
                      <div className="text-sm font-semibold text-white">
                        {formatMarketCap(token.marketCap)}
                      </div>
                    </div>
                  </div>

                  {/* User holdings */}
                  {(token.userBalance > 0 || token.userValue > 0) && (
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-2.5 mb-3 border border-blue-500/20">
                      <div className="text-xs text-gray-400 mb-1">我的持仓</div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-semibold text-white">
                          {token.userBalance > 0.01
                            ? token.userBalance.toFixed(2)
                            : token.userBalance.toFixed(6)}{" "}
                          {token.symbol}
                        </div>
                        <div className="text-sm font-medium text-blue-400">
                          {formatNumber(token.userValue)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stock description */}
                  <div className="text-sm text-gray-400 mb-3 leading-relaxed bg-gray-800/20 rounded-lg p-2.5">
                    <div className="line-clamp-2">
                      {getTokenDescription(token.symbol)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => openBuyModal(token)}
                      variant="buy"
                      size="trading"
                    >
                      买入
                    </Button>
                    <Button
                      onClick={() => openSellModal(token)}
                      variant="sell"
                      size="trading"
                    >
                      卖出
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {filteredAndSortedTokens.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-400">
              没有找到匹配的代币
            </div>
          )}
        </div>
      </div>

      {/* Buy Modal */}
      {buyModal.isOpen && buyModal.token && (
        <BuyModal
          isOpen={buyModal.isOpen}
          onClose={closeBuyModal}
          token={{
            symbol: buyModal.token.symbol,
            name: buyModal.token.name,
            price: formatPrice(buyModal.token.price),
            change24h: buyModal.token.change24h,
            volume24h: buyModal.token.volume24h,
            marketCap: buyModal.token.marketCap,
            address: buyModal.token.address as `0x${string}`,
          }}
          oracleAddress={ORACLE_AGGREGATOR_ADDRESS}
          usdtAddress={USDT_ADDRESS}
        />
      )}

      {/* Sell Modal */}
      {sellModal.isOpen && sellModal.token && (
        <SellModal
          isOpen={sellModal.isOpen}
          onClose={closeSellModal}
          token={{
            symbol: sellModal.token.symbol,
            name: sellModal.token.name,
            price: formatPrice(sellModal.token.price),
            change24h: sellModal.token.change24h,
            volume24h: sellModal.token.volume24h,
            marketCap: sellModal.token.marketCap,
            address: sellModal.token.address as `0x${string}`,
          }}
          oracleAddress={ORACLE_AGGREGATOR_ADDRESS}
          usdtAddress={USDT_ADDRESS}
        />
      )}
    </div>
  );
}
