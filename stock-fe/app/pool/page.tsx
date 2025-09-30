"use client";

import { useState, useEffect, useMemo } from "react";
import { useTokenFactoryWithClients } from "@/lib/hooks/useTokenFactoryWithClients";
import { useWeb3Clients } from "@/lib/hooks/useWeb3Clients";
import { formatUnits, parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { TradingInterface } from "@/components/TradingInterface";
import { formatNumber, formatPrice, formatPercent, formatMarketCap } from "@/lib/utils/format";
import useTokenFactoryStore from "@/lib/store/useTokenFactoryStore";

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

interface TradingModalState {
  isOpen: boolean;
  token: TokenData | null;
}

export default function TokenPool() {
  const { publicClient, isConnected, address } = useWeb3Clients();
  console.log("🔗 钱包连接状态:", { isConnected, address });
  const {
    allTokens,
    tokenBySymbol,
    isLoading,
    error,
    fetchAllTokens,
    fetchTokensMapping,
    fetchTokensInfo,
    createToken,
  } = useTokenFactoryWithClients();

  // 直接从store获取数据
  const storeAllTokens = useTokenFactoryStore((state) => state.allTokens);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"marketCap" | "volume" | "price">(
    "marketCap"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [tradingModal, setTradingModal] = useState<TradingModalState>({
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
      decimals: tokenInfo.decimals
    });

      const totalSupply = Number(
        formatUnits(tokenInfo.totalSupply, tokenInfo.decimals)
      );

      console.log(`👤 !!! 开始转换用户余额 !!!`);
      console.log(`👤 原始值:`, tokenInfo.userBalance);
      console.log(`👤 类型:`, typeof tokenInfo.userBalance);
      console.log(`👤 是否为 BigInt:`, typeof tokenInfo.userBalance === 'bigint');
      console.log(`👤 精度:`, tokenInfo.decimals);

      let userBalance = 0;

      // 检查是否为 bigint
      if (typeof tokenInfo.userBalance !== 'bigint') {
        console.warn(`⚠️ userBalance 不是 bigint 类型:`, tokenInfo.userBalance);
        userBalance = 0;
      } else {
        try {
          // 使用 formatUnits 转换
          const formattedBalance = formatUnits(tokenInfo.userBalance, tokenInfo.decimals);
          console.log(`👤 formatUnits 结果:`, {
            formatted: formattedBalance,
            type: typeof formattedBalance,
            length: formattedBalance.length
          });

          // 检查格式化后的值是否太大
          if (formattedBalance.length > 15) {
            console.warn(`⚠️ 余额值过大，可能超出 Number 精度范围:`, formattedBalance);
          }

          const rawUserBalance = Number(formattedBalance);
          console.log(`👤 Number 转换结果:`, {
            rawUserBalance,
            type: typeof rawUserBalance,
            isNaN: isNaN(rawUserBalance),
            isFinite: isFinite(rawUserBalance),
            MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
            isOverSafeInteger: rawUserBalance > Number.MAX_SAFE_INTEGER
          });

          // 如果转换后的值不是有限值或超出安全整数范围，使用替代方案
          if (!isFinite(rawUserBalance) || rawUserBalance > Number.MAX_SAFE_INTEGER) {
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
      const rawMarketCap = Number(formatUnits(tokenInfo.marketCap, tokenInfo.decimals));
      console.log(`📊 市值转换: ${tokenInfo.marketCap} -> ${rawMarketCap} (decimals: ${tokenInfo.decimals})`);
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
          userValue: userBalance * price
        },
      };

      console.log(`✅ 第 ${index} 个代币转换完成:`, convertedToken);
      return convertedToken;
    });

    console.log("🎯 最终转换完成的代币数据:", convertedTokens);
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

  // 打开交易界面
  const openTradingModal = (token: TokenData) => {
    if (!isConnected) {
      alert("请先连接钱包");
      return;
    }
    setTradingModal({
      isOpen: true,
      token,
    });
  };

  // 关闭交易界面
  const closeTradingModal = () => {
    setTradingModal({
      isOpen: false,
      token: null,
    });
  };

  // 处理交易
  const handleTrade = (type: "buy" | "sell", amount: number) => {
    if (!tradingModal.token) return;

    try {
      console.log(`${type} ${amount} ${tradingModal.token.symbol}`);
      alert(`${type === "buy" ? "买入" : "卖出"}订单已提交！`);
      closeTradingModal();
    } catch (error) {
      console.error("交易失败:", error);
      alert("交易失败，请重试");
    }
  };

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
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white hover:bg-gray-800 transition-colors"
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>

        {/* Token List */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 text-gray-400 text-sm font-medium">
            <div className="col-span-3">代币</div>
            <div className="col-span-2 text-right">价格</div>
            <div className="col-span-2 text-right">24h 涨跌</div>
            <div className="col-span-2 text-right">成交量</div>
            <div className="col-span-1 text-right">市值</div>
            <div className="col-span-1 text-right">持有</div>
            <div className="col-span-1 text-right">操作</div>
          </div>

          {/* Token Rows */}
          <div className="divide-y divide-gray-800">
            {(() => {
              console.log("🎯 渲染代币列表，filteredAndSortedTokens:", filteredAndSortedTokens);
              console.log("🎯 filteredAndSortedTokens 长度:", filteredAndSortedTokens?.length);
              return null;
            })()}
            {filteredAndSortedTokens.map((token) => (
              <div
                key={token.symbol}
                className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-800/50 transition-colors"
              >
                {/* Token Info */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white">
                    {token.symbol.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {token.symbol}
                    </div>
                    <div className="text-sm text-gray-400">{token.name}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="col-span-2 text-right">
                  <div className="font-semibold text-white">
                    {formatPrice(token.price)}
                  </div>
                </div>

                {/* 24h Change */}
                <div className="col-span-2 text-right">
                  <div
                    className={`font-semibold ${
                      token.change24h >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {formatPercent(token.change24h)}
                  </div>
                </div>

                {/* Volume */}
                <div className="col-span-2 text-right">
                  <div className="text-gray-300">
                    {formatNumber(token.volume24h)}
                  </div>
                </div>

                {/* Market Cap */}
                <div className="col-span-1 text-right">
                  <div className="text-gray-300">
                    {formatMarketCap(token.marketCap)}
                  </div>
                </div>

                {/* Holdings */}
                <div className="col-span-1 text-right">
                  <div className="text-white">
                    {token.userBalance > 0.01 ? token.userBalance.toFixed(2) : token.userBalance.toFixed(6)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatNumber(token.userValue)}
                  </div>
                </div>

                {/* Actions */}
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => openTradingModal(token)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-sm rounded-lg transition-all duration-300 hover:scale-105"
                  >
                    交易
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredAndSortedTokens.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              没有找到匹配的代币
            </div>
          )}
        </div>
      </div>

      {/* Trading Interface */}
      {tradingModal.isOpen && tradingModal.token && (
        <TradingInterface
          token={tradingModal.token}
          onClose={closeTradingModal}
          onTrade={handleTrade}
        />
      )}
    </div>
  );
}
