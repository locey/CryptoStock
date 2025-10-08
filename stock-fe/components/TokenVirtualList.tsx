import React, { useState, useEffect, useMemo, useCallback } from "react";
import TokenCard from "./TokenCard";
import TokenCardSkeleton from "./TokenCardSkeleton";
import { TokenData } from "@/types/token";

interface TokenVirtualListProps {
  tokens: TokenData[];
  isLoading: boolean;
  onBuy: (token: TokenData) => void;
  onSell: (token: TokenData) => void;
}

const TokenVirtualList = React.memo<TokenVirtualListProps>(({
  tokens,
  isLoading,
  onBuy,
  onSell,
}) => {
  // 分页状态
  const [pageSize, setPageSize] = useState(12); // 每页显示12个

  // 计算总页数
  const totalPages = Math.ceil(tokens.length / pageSize);

  // 当前页数据
  const currentTokens = useMemo(() => {
    return tokens.slice(0, pageSize); // 简单分页，只显示前pageSize个
  }, [tokens, pageSize]);

  // 动态计算页面大小
  useEffect(() => {
    const updatePageSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setPageSize(6); // 移动端每页6个
      } else if (width < 1024) {
        setPageSize(8); // 平板每页8个
      } else {
        setPageSize(12); // 桌面每页12个
      }
    };

    updatePageSize();
    window.addEventListener('resize', updatePageSize);
    return () => window.removeEventListener('resize', updatePageSize);
  }, []);

  // 虚拟列表项渲染
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const token = currentTokens[index];

    if (!token) {
      return null;
    }

    return (
      <div style={style} className="p-2">
        <TokenCard
          token={token}
          onBuy={onBuy}
          onSell={onSell}
        />
      </div>
    );
  }, [currentTokens, onBuy, onSell]);

  // 加载更多处理
  const loadMore = useCallback(() => {
    // 这里可以实现真正的分页加载逻辑
    // 目前使用简单的分页策略
  }, []);

  // 如果没有数据且有加载状态，显示骨架屏
  if (tokens.length === 0 && isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <TokenCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  // 数据量少时直接渲染，避免虚拟列表的开销
  if (currentTokens.length <= 6) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentTokens.map((token) => (
          <TokenCard
            key={token.symbol}
            token={token}
            onBuy={onBuy}
            onSell={onSell}
          />
        ))}
        {isLoading && Array.from({ length: 3 }).map((_, index) => (
          <TokenCardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    );
  }

  // 使用虚拟列表
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentTokens.map((token) => (
          <TokenCard
            key={token.symbol}
            token={token}
            onBuy={onBuy}
            onSell={onSell}
          />
        ))}
        {isLoading && Array.from({ length: 3 }).map((_, index) => (
          <TokenCardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>

      {/* 加载更多按钮 */}
      {tokens.length > pageSize && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            加载更多代币
          </button>
        </div>
      )}
    </div>
  );
});

TokenVirtualList.displayName = "TokenVirtualList";

export default TokenVirtualList;