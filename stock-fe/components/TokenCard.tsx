import React, { memo } from "react";
import { Button } from "@/components/ui/button";
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
import { TokenData } from "@/types/token";

interface TokenCardProps {
  token: TokenData;
  onBuy: (token: TokenData) => void;
  onSell: (token: TokenData) => void;
}

const TokenCard = memo(({ token, onBuy, onSell }: TokenCardProps) => {
  const isPositive = token.change24h >= 0;
  const changeAmount = token.price * (token.change24h / 100);

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

  return (
    <div
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
            onClick={() => onBuy(token)}
            variant="buy"
            size="trading"
          >
            买入
          </Button>
          <Button
            onClick={() => onSell(token)}
            variant="sell"
            size="trading"
          >
            卖出
          </Button>
        </div>
      </div>
    </div>
  );
});

TokenCard.displayName = "TokenCard";

export default TokenCard;