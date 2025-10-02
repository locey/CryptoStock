"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceSourceIndicator } from '@/components/PriceSourceIndicator';
import { fetchStockPricesWithCache, clearPriceCache } from '@/lib/hermes';

interface PriceData {
  symbol: string;
  price: string;
  conf: string;
  publish_time: number;
  formatted: {
    price: string;
    conf: string;
    confidence: string;
  };
}

export default function APITestPage() {
  const [symbols] = useState(['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'BTC', 'ETH']);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceSource, setPriceSource] = useState<'contract' | 'hermes'>('hermes');

  const fetchPrices = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchStockPricesWithCache(symbols);
      setPrices(result as unknown as Record<string, PriceData>);
      setPriceSource('hermes');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    clearPriceCache();
    setPrices({});
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Hermes API 测试页面</h1>
          <p className="text-gray-400">测试 Pyth Hermes API 价格数据获取</p>
        </div>

        <div className="flex gap-4 mb-8">
          <Button
            onClick={fetchPrices}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? '获取中...' : '刷新价格'}
          </Button>
          <Button
            onClick={clearCache}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            清除缓存
          </Button>
          <PriceSourceIndicator source={priceSource} />
        </div>

        {error && (
          <Card className="mb-8 border-red-500/20 bg-red-500/5">
            <CardContent className="p-4">
              <p className="text-red-400">错误: {error}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {symbols.map((symbol) => {
            const priceData = prices[symbol];
            return (
              <Card key={symbol} className="border-gray-800 bg-gray-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-xl font-bold">{symbol}</span>
                    <div className="flex items-center gap-2">
                      {priceData ? (
                        <span className="text-xs text-green-400">✓</span>
                      ) : (
                        <span className="text-xs text-red-400">✗</span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {priceData ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">价格:</span>
                        <span className="text-white font-semibold">
                          ${priceData.formatted.price}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">置信度:</span>
                        <span className="text-gray-300">
                          {priceData.formatted.confidence}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">发布时间:</span>
                        <span className="text-gray-300 text-xs">
                          {new Date(priceData.publish_time * 1000).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400">无数据</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle>API 调用信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-400">端点:</span> /api/hermes/price</p>
                <p><span className="text-gray-400">数据源:</span> Pyth Hermes Network</p>
                <p><span className="text-gray-400">缓存时间:</span> 30秒</p>
                <p><span className="text-gray-400">支持符号:</span> {symbols.join(', ')}</p>
                <p><span className="text-gray-400">数据状态:</span> {Object.keys(prices).length} / {symbols.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}