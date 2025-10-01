"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, Wallet, ChevronDown } from 'lucide-react';
import { formatUnits, parseUnits, formatEther } from 'viem';
import { useWeb3Clients } from 'ycdirectory-hooks';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: {
    symbol: string;
    name: string;
    price: string;
    change24h: number;
    volume24h: number;
    marketCap: number;
  };
}

// 预设金额选项
const PRESET_AMOUNTS = [10, 50, 100, 500, 1000, 5000];

// 滑点选项
const SLIPPAGE_OPTIONS = [
  { label: '0.5%', value: 0.5 },
  { label: '1%', value: 1 },
  { label: '2%', value: 2 },
  { label: '3%', value: 3 },
  { label: '自定义', value: 'custom' }
];

export function BuyModal({ isOpen, onClose, token }: BuyModalProps) {
  const { toast } = useToast();
  const { publicClient, walletClient, address, isConnected } = useWeb3Clients();

  // 状态管理
  const [buyAmount, setBuyAmount] = useState<string>('100');
  const [slippage, setSlippage] = useState<number>(1);
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [showCustomSlippage, setShowCustomSlippage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 预估信息
  const [estimatedTokens, setEstimatedTokens] = useState<bigint>(0n);
  const [estimatedFee, setEstimatedFee] = useState<bigint>(0n);
  const [gasFee, setGasFee] = useState<bigint>(0n);

  // 用户余额
  const [usdtBalance, setUsdtBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);

  // 计算预期结果
  const calculateEstimate = useCallback(async () => {
    if (!publicClient || !buyAmount || parseFloat(buyAmount) <= 0) return;

    try {
      const buyAmountWei = parseUnits(buyAmount, 6);

      // 这里需要调用合约的 getBuyEstimate 函数
      // 模拟计算（实际应该调用合约）
      const currentPrice = parseFloat(token.price);
      const feeRate = 0.003; // 0.3%
      const estimatedTokensBeforeFee = buyAmountWei * BigInt(Math.floor(currentPrice * 1000000)) / parseUnits('1', 6);
      const estimatedFeeAmount = estimatedTokensBeforeFee * BigInt(Math.floor(feeRate * 10000)) / 10000n;
      const finalEstimatedTokens = estimatedTokensBeforeFee - estimatedFeeAmount;

      setEstimatedTokens(finalEstimatedTokens);
      setEstimatedFee(estimatedFeeAmount);

      // 估算gas费用（模拟）
      setGasFee(parseUnits('0.001', 18));

    } catch (error) {
      console.error('计算预估失败:', error);
    }
  }, [buyAmount, token.price, publicClient]);

  // 获取用户余额和授权
  const fetchUserInfo = useCallback(async () => {
    if (!publicClient || !address) return;

    try {
      // 这里需要调用合约获取用户USDT余额和授权额度
      // 模拟数据
      setUsdtBalance(parseUnits('10000', 6));
      setAllowance(parseUnits('5000', 6));
      setNeedsApproval(parseUnits('5000', 6) < parseUnits(buyAmount || '0', 6));
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  }, [address, publicClient, buyAmount]);

  // 授权USDT
  const handleApprove = async () => {
    if (!walletClient) {
      toast({
        title: "钱包未连接",
        description: "请先连接钱包",
        variant: "destructive",
      });
      return;
    }

    setApproving(true);
    try {
      // 这里需要调用USDT合约的approve方法
      const buyAmountWei = parseUnits(buyAmount || '0', 6);

      // 模拟授权交易
      console.log('授权USDT:', formatUnits(buyAmountWei, 6));

      toast({
        title: "授权成功",
        description: `已授权 ${formatUnits(buyAmountWei, 6)} USDT`,
      });

      setNeedsApproval(false);
      setAllowance(buyAmountWei);

    } catch (error) {
      console.error('授权失败:', error);
      toast({
        title: "授权失败",
        description: "请重试授权操作",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  // 执行买入
  const handleBuy = async () => {
    if (!isConnected || !walletClient) {
      toast({
        title: "钱包未连接",
        description: "请先连接钱包",
        variant: "destructive",
      });
      return;
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      toast({
        title: "金额错误",
        description: "请输入有效的买入金额",
        variant: "destructive",
      });
      return;
    }

    if (usdtBalance < parseUnits(buyAmount, 6)) {
      toast({
        title: "余额不足",
        description: "USDT余额不足以完成交易",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const buyAmountWei = parseUnits(buyAmount, 6);
      const slippageTolerance = showCustomSlippage ? parseFloat(customSlippage) : slippage;
      const minTokenAmount = estimatedTokens * BigInt(Math.floor((100 - slippageTolerance) * 100)) / 10000n;

      // 这里需要调用合约的buy方法
      console.log('执行买入:', {
        buyAmount: formatUnits(buyAmountWei, 6),
        minTokenAmount: formatEther(minTokenAmount),
        token: token.symbol
      });

      toast({
        title: "买入成功",
        description: `成功购买 ${formatEther(estimatedTokens)} ${token.symbol}`,
      });

      onClose();

    } catch (error) {
      console.error('买入失败:', error);
      toast({
        title: "买入失败",
        description: "交易失败，请重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 监听弹窗状态变化
  useEffect(() => {
    if (isOpen) {
      fetchUserInfo();
      calculateEstimate();
    }
  }, [isOpen, fetchUserInfo, calculateEstimate]);

  // 监听输入变化
  useEffect(() => {
    calculateEstimate();
  }, [buyAmount, calculateEstimate]);

  // 监听余额变化
  useEffect(() => {
    setNeedsApproval(allowance < parseUnits(buyAmount || '0', 6));
  }, [allowance, buyAmount]);

  const isPositive = token.change24h >= 0;
  const canBuy = isConnected && !loading && parseFloat(buyAmount) > 0 && usdtBalance >= parseUnits(buyAmount, 6) && !needsApproval;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isPositive ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-orange-600'
            }`}>
              <span className="text-white font-bold text-lg">{token.symbol[0]}</span>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">买入 {token.symbol}</h3>
              <div className="flex items-center gap-1">
                <span className="text-white">{formatEther(parseUnits(token.price, 6))}</span>
                <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{Math.abs(token.change24h).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 余额信息 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">可用余额</span>
            <div className="text-right">
              <div className="text-white">{formatUnits(usdtBalance, 6)} USDT</div>
              {allowance > 0 && (
                <div className="text-gray-400">已授权: {formatUnits(allowance, 6)} USDT</div>
              )}
            </div>
          </div>

          {/* 输入金额 */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400">买入金额 (USDT)</label>
            <div className="relative">
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                placeholder="0.00"
              />
              <span className="absolute right-4 top-3 text-gray-400">USDT</span>
            </div>

            {/* 快捷金额 */}
            <div className="flex gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBuyAmount(amount.toString())}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors"
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* 滑点设置 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400">滑点容忍度</label>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 text-sm text-white hover:text-blue-400 transition-colors"
              >
                {showCustomSlippage ? `${customSlippage}%` : `${slippage}%`}
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {showDropdown && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
                {SLIPPAGE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => {
                      if (option.value === 'custom') {
                        setShowCustomSlippage(true);
                      } else {
                        setSlippage(Number(option.value));
                        setShowCustomSlippage(false);
                        setShowDropdown(false);
                      }
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {option.label}
                  </button>
                ))}

                {showCustomSlippage && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                    <input
                      type="number"
                      value={customSlippage}
                      onChange={(e) => setCustomSlippage(e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                      placeholder="0.1"
                    />
                    <span className="text-gray-400">%</span>
                    <button
                      onClick={() => {
                        if (customSlippage) {
                          setSlippage(parseFloat(customSlippage));
                          setShowDropdown(false);
                        }
                      }}
                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 rounded text-white text-sm"
                    >
                      确认
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 预估信息 */}
          {estimatedTokens > 0 && (
            <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">预期获得</span>
                <span className="text-white font-semibold">
                  {formatEther(estimatedTokens)} {token.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">手续费</span>
                <span className="text-white">
                  {formatEther(estimatedFee)} {token.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">网络费用</span>
                <span className="text-white">
                  {formatEther(gasFee)} ETH
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-700">
                <span className="text-gray-400">最小获得</span>
                <span className="text-white font-semibold">
                  {formatEther(estimatedTokens * BigInt(Math.floor((100 - (showCustomSlippage ? parseFloat(customSlippage) : slippage)) * 100)) / 10000n)} {token.symbol}
                </span>
              </div>
            </div>
          )}

          {/* 风险提示 */}
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
            <div className="text-xs text-yellow-400">
              <p className="font-semibold mb-1">交易提示</p>
              <p>• 最小交易金额: 1 USDT</p>
              <p>• 手续费率: 0.3%</p>
              <p>• 价格会根据实时情况变动</p>
              <p>• 请设置合理的滑点保护</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-800 space-y-3">
          {!isConnected ? (
            <Button
              onClick={() => {/* 连接钱包逻辑 */}}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-500 hover:scale-105 flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              连接钱包
            </Button>
          ) : needsApproval ? (
            <Button
              onClick={handleApprove}
              disabled={approving}
              className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-500 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {approving ? '授权中...' : `授权 ${buyAmount} USDT`}
            </Button>
          ) : (
            <Button
              onClick={handleBuy}
              disabled={!canBuy}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all duration-500 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '买入中...' : `买入 ${token.symbol}`}
            </Button>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 text-gray-400 hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}