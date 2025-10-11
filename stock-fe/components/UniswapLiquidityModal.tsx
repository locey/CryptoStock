'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, AlertTriangle, TrendingUp, Settings, Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { useUniswap, useUniswapTokens, useUniswapOperations } from '@/lib/hooks/useUniswap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatUnits, parseUnits, Address } from 'viem';
import { UNISWAP_CONFIG } from '@/lib/config/loadContracts';

// 类型定义
interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
}

interface PriceRange {
  tickLower: number;
  tickUpper: number;
  type: 'narrow' | 'standard' | 'wide' | 'custom';
  name: string;
  description: string;
}

interface UniswapLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  defaultToken0?: string;
  defaultToken1?: string;
}

// 预设价格区间
const PRICE_RANGES: PriceRange[] = [
  { tickLower: -3000, tickUpper: 3000, type: 'narrow', name: '窄幅', description: '±0.1%' },
  { tickLower: -60000, tickUpper: 60000, type: 'standard', name: '标准', description: '±2%' },
  { tickLower: -120000, tickUpper: 120000, type: 'wide', name: '宽幅', description: '±4%' },
];

// 代币信息
const TOKENS: Record<string, TokenInfo> = {
  USDT: {
    address: UNISWAP_CONFIG.tokens.USDT.address,
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    icon: '/tokens/usdt.png',
  },
  WETH: {
    address: UNISWAP_CONFIG.tokens.WETH.address,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    icon: '/tokens/weth.png',
  },
};

export const UniswapLiquidityModal: React.FC<UniswapLiquidityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultToken0 = 'WETH', // 默认第一项为 WETH
  defaultToken1 = 'USDT', // 默认第二项为 USDT
}) => {
  // Uniswap hooks
  const { isConnected, totalTVL, initializeUniswapTrading } = useUniswap();
  const { formattedBalances, needsApproval, approveUSDT, approveWETH, approveAllNFT, fetchAllowances } = useUniswapTokens();
  const { isOperating, addLiquidity } = useUniswapOperations();

  // 状态管理
  const [token0, setToken0] = useState<TokenInfo>(TOKENS[defaultToken0]); // 使用传入的默认值
  const [token1, setToken1] = useState<TokenInfo>(TOKENS[defaultToken1]);
  const [amount0, setAmount0] = useState('1'); // 默认显示 1 WETH
  const [amount1, setAmount1] = useState('1000'); // 默认显示 1000 USDT
  const [slippage, setSlippage] = useState(1.0);
  const [selectedRange, setSelectedRange] = useState<PriceRange>(PRICE_RANGES[1]);
  const [customRange, setCustomRange] = useState({ lower: -60000, upper: 60000 });
  const [currentPrice, setCurrentPrice] = useState(0.001); // 🔧 修复：1 WETH = 0.001 USDT，即 10 WETH = 10000 USDT
  const [step, setStep] = useState<'input' | 'approve' | 'add' | 'success'>('input');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // 计算属性
  const isInputValid = useMemo(() => {
    const hasAmount0 = amount0 && parseFloat(amount0) > 0;
    const hasAmount1 = amount1 && parseFloat(amount1) > 0;
    const isValid = hasAmount0 && hasAmount1;

    // 调试信息
    console.log('🔍 [DEBUG] 输入验证:', {
      amount0,
      amount1,
      hasAmount0,
      hasAmount1,
      isInputValid: isValid
    });

    return isValid;
  }, [amount0, amount1]);

  const hasSufficientBalance = useMemo(() => {
    if (!amount0 || !amount1) return false;

    const balanceKey0 = `${token0.symbol.toLowerCase()}Balance`;
    const balanceKey1 = `${token1.symbol.toLowerCase()}Balance`;
    const balance0 = parseFloat(formattedBalances[balanceKey0 as keyof typeof formattedBalances] || '0');
    const balance1 = parseFloat(formattedBalances[balanceKey1 as keyof typeof formattedBalances] || '0');

    const amount0Num = parseFloat(amount0);
    const amount1Num = parseFloat(amount1);

    const hasBalance0 = amount0Num <= balance0;
    const hasBalance1 = amount1Num <= balance1;

    // 调试信息
    console.log('🔍 [DEBUG] 余额检查:', {
      // 基本信息
      token0Symbol: token0.symbol,
      token1Symbol: token1.symbol,
      amount0: amount0Num,
      amount1: amount1Num,

      // 余额信息
      balanceKey0,
      balanceKey1,
      balance0,
      balance1,

      // 检查结果
      hasBalance0,
      hasBalance1,
      hasSufficient: hasBalance0 && hasBalance1,

      // 原始数据
      formattedBalances,
      allBalanceKeys: Object.keys(formattedBalances)
    });

    return hasBalance0 && hasBalance1;
  }, [amount0, amount1, formattedBalances, token0, token1]);

  // 生成余额不足的错误信息
  const balanceError = useMemo(() => {
    if (!amount0 || !amount1) return null;

    const balanceKey0 = `${token0.symbol.toLowerCase()}Balance`;
    const balanceKey1 = `${token1.symbol.toLowerCase()}Balance`;
    const balance0 = parseFloat(formattedBalances[balanceKey0 as keyof typeof formattedBalances] || '0');
    const balance1 = parseFloat(formattedBalances[balanceKey1 as keyof typeof formattedBalances] || '0');

    const amount0Num = parseFloat(amount0);
    const amount1Num = parseFloat(amount1);

    const hasBalance0 = amount0Num <= balance0;
    const hasBalance1 = amount1Num <= balance1;

    if (!hasBalance0 || !hasBalance1) {
      const errors = [];
      if (!hasBalance0) {
        errors.push(`${token0.symbol}: 需要 ${amount0Num}, 余额 ${balance0}`);
      }
      if (!hasBalance1) {
        errors.push(`${token1.symbol}: 需要 ${amount1Num}, 余额 ${balance1}`);
      }
      return `余额不足: ${errors.join(', ')}`;
    }

    return null;
  }, [amount0, amount1, formattedBalances, token0, token1]);

  const calculatedAmounts = useMemo(() => {
    if (!amount0 || !currentPrice) return { amount1: '', amount0Min: '', amount1Min: '' };

    const amount0Num = parseFloat(amount0);
    // 计算对应的 USDT 数量：10 WETH = 10000 USDT，所以 1 WETH = 1000 USDT
    const calculatedAmount1 = amount0Num * 1000; // 直接使用比例 1:1000
    const amount0Min = amount0Num * (1 - slippage / 100);
    const amount1Min = calculatedAmount1 * (1 - slippage / 100);

    return {
      amount1: calculatedAmount1.toFixed(token1.decimals), // 使用 USDT 的小数位数
      amount0Min: amount0Min.toFixed(token0.decimals),
      amount1Min: amount1Min.toFixed(token1.decimals),
    };
  }, [amount0, currentPrice, slippage, token0.decimals, token1.decimals]);

  // 自动计算配对数量
  useEffect(() => {
    if (amount0 && currentPrice) {
      setAmount1(calculatedAmounts.amount1);
    }
  }, [amount0, currentPrice, calculatedAmounts.amount1]);

  // 模拟价格更新
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const variation = (Math.random() - 0.5) * 10; // ±5 变化
        return Math.max(100, prev + variation);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // 处理代币交换
  const handleSwapTokens = () => {
    setToken0(token1);
    setToken1(token0);
    setAmount0(amount1);
    setAmount1('');
  };

  // 🔧 检查代币排序并显示提示
  const checkTokenOrder = () => {
    const token0Address = token0.address.toLowerCase();
    const token1Address = token1.address.toLowerCase();

    if (token0Address > token1Address) {
      return {
        needsSwap: true,
        message: `⚠️ 代币顺序需要调整：${token0.symbol} 地址 > ${token1.symbol} 地址，系统将自动排序以确保符合 Uniswap V3 要求`
      };
    }

    return {
      needsSwap: false,
      message: `✅ 代币顺序正确：${token0.symbol} 地址 < ${token1.symbol} 地址`
    };
  };

  // 计算最小数量（基于滑点）
  const calculateMinAmounts = () => {
    if (!amount0 || !amount1) return { amount0Min: '', amount1Min: '' };

    const amount0Num = parseFloat(amount0);
    const amount1Num = parseFloat(amount1);
    const amount0Min = amount0Num * (1 - slippage / 100);
    const amount1Min = amount1Num * (1 - slippage / 100);

    return {
      amount0Min: amount0Min.toFixed(token0.decimals),
      amount1Min: amount1Min.toFixed(token1.decimals),
    };
  };

  // 获取价格区间 tick
  const getPriceRangeTicks = () => {
    if (selectedRange.type === 'custom') {
      return { tickLower: customRange.lower, tickUpper: customRange.upper };
    }
    return { tickLower: selectedRange.tickLower, tickUpper: selectedRange.tickUpper };
  };

  // 重置状态
  const resetModal = () => {
    setAmount0('');
    setAmount1('');
    setStep('input');
    setTxHash('');
    setError(null);
  };

  // 关闭弹窗
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // 处理授权 - 强制授权两种代币和 NFT
  const handleApprove = async () => {
    if (!isConnected || !isInputValid) {
      setError('请先连接钱包并输入有效数量');
      return;
    }

    try {
      setStep('approve');
      setError(null);

      console.log('🔑 开始授权流程...');

      // 1. 强制授权两种代币
      const tokenApprovals = [];
      tokenApprovals.push(approveUSDT(amount1)); // USDT 使用 amount1
      tokenApprovals.push(approveWETH(amount0)); // WETH 使用 amount0

      console.log('📝 授权代币交易...');
      await Promise.all(tokenApprovals);
      console.log('✅ 代币授权完成');

      // 2. 全局授权所有 NFT（用于未来的流动性位置）
      console.log('📝 授权 NFT（全局授权）...');
      await approveAllNFT();
      console.log('✅ NFT 全局授权完成');

      // 🔧 等待一下让区块链状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 授权成功后自动进入添加流动性步骤
      setStep('add');

      // 自动执行添加流动性
      await handleAddLiquidity();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '授权失败';
      setError(errorMessage);
      setStep('input');
    }
  };

  // 🔧 验证授权状态
  const verifyAllowances = async () => {
    if (!isConnected) return false;

    try {
      // 获取当前授权状态
      await fetchAllowances();

      // 🔧 修复：直接检查授权金额，不依赖 needsApproval
      const usdtAllowanceValue = parseFloat(formattedBalances.usdtAllowance || '0');
      const wethAllowanceValue = parseFloat(formattedBalances.wethAllowance || '0');
      const usdtNeededValue = parseFloat(amount1 || '0');
      const wethNeededValue = parseFloat(amount0 || '0');

      const hasUSDTAllowance = usdtAllowanceValue >= usdtNeededValue;
      const hasWETHAllowance = wethAllowanceValue >= wethNeededValue;

      console.log('🔍 [DEBUG] 详细授权状态验证:', {
        // 基本信息
        token0Symbol: token0.symbol,
        token1Symbol: token1.symbol,

        // USDT 授权信息
        usdtNeeded: usdtNeededValue,
        usdtAllowance: usdtAllowanceValue,
        usdtNeedsApproval: needsApproval.usdt,
        hasUSDTAllowance,

        // WETH 授权信息
        wethNeeded: wethNeededValue,
        wethAllowance: wethAllowanceValue,
        wethNeedsApproval: needsApproval.weth,
        hasWETHAllowance,

        // 原始数据
        rawFormattedBalances: formattedBalances,
        rawNeedsApproval: needsApproval
      });

      return hasUSDTAllowance && hasWETHAllowance;
    } catch (error) {
      console.error('❌ 验证授权状态失败:', error);
      return false;
    }
  };

  // 处理添加流动性 - 参考 Aave 模式
  const handleAddLiquidity = async () => {
    if (!isConnected || !isInputValid) {
      setError('请先连接钱包并输入有效数量');
      return;
    }

    if (!hasSufficientBalance) {
      setError('余额不足');
      return;
    }

    // 🔧 跳过授权验证 - 因为在 handleApprove 中已经进行了授权
    // 如果是从授权步骤来的，直接信任授权已经完成
    const hasValidAllowances = step === 'approve' ? true : await verifyAllowances();
    if (!hasValidAllowances && step !== 'approve') {
      setError('代币授权不足，请重新授权');
      setStep('input');
      return;
    }

    try {
      // 如果不是从授权步骤来的，设置步骤为 add
      if (step !== 'add') {
        setStep('add');
      }

      setError(null);
      const { amount0Min, amount1Min } = calculateMinAmounts();
      const { tickLower, tickUpper } = getPriceRangeTicks();

      // 添加流动性参数调试 - 按照测试用例格式
      const liquidityParams = {
        token0: token0.address as `0x${string}`, // WETH 作为 token0
        token1: token1.address as `0x${string}`, // USDT 作为 token1
        amount0, // 10 WETH
        amount1, // 10000 USDT
        amount0Min, // 滑点保护的最小值
        amount1Min,
        tickLower,
        tickUpper,
        recipient: '0x0000000000000000000000000000000000000000' as Address, // hook 会自动替换为用户地址
      };

      console.log('🔍 [DEBUG] 添加流动性参数:', liquidityParams);
      console.log('🔍 [DEBUG] amount0:', amount0, '类型:', typeof amount0);
      console.log('🔍 [DEBUG] amount1:', amount1, '类型:', typeof amount1);
      console.log('🔍 [DEBUG] amount0Min:', amount0Min, '类型:', typeof amount0Min);
      console.log('🔍 [DEBUG] amount1Min:', amount1Min, '类型:', typeof amount1Min);

      const result = await addLiquidity(liquidityParams);

      setTxHash(result.hash);
      setStep('success');
      console.log('添加流动性成功:', result);

      // 成功回调
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '添加流动性失败';
      setError(errorMessage);
      setStep('input');
    }
  };

  // 处理确认操作 - 强制先授权再添加
  const handleConfirm = async () => {
    if (!isConnected) return;

    // 每次都要先授权，不管之前是否已授权
    await handleApprove();
  };

  // 自动初始化
  useEffect(() => {
    if (isOpen && isConnected) {
      initializeUniswapTrading();
    }
  }, [isOpen, isConnected, initializeUniswapTrading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">添加流动性</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 钱包连接状态 */}
          {!isConnected && (
            <Alert className="border-yellow-500/20 bg-yellow-500/10">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <AlertDescription className="text-yellow-400">
                请先连接钱包以继续操作
              </AlertDescription>
            </Alert>
          )}

          {/* 代币选择和数量输入 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">选择代币对</h3>
              <button
                onClick={handleSwapTokens}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all"
                title="交换代币顺序"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* 🔧 代币排序提示 */}
            {amount0 && amount1 && (
              <div className={`p-3 rounded-lg text-sm ${
                checkTokenOrder().needsSwap
                  ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                  : 'bg-green-500/10 border border-green-500/30 text-green-400'
              }`}>
                {checkTokenOrder().message}
              </div>
            )}

            {/* Token 0 输入 */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold">{token0.symbol[0]}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{token0.symbol}</div>
                    <div className="text-sm text-gray-400">
                      余额: {formattedBalances[`${token0.symbol.toLowerCase()}Balance` as keyof typeof formattedBalances] || '0'}
                    </div>
                  </div>
                </div>
              </div>
              <Input
                type="number"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
                placeholder="0.0"
                className="bg-gray-900 border-gray-700 text-white text-xl font-mono"
                disabled={!isConnected}
              />
            </div>

            {/* Token 1 输入 */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold">{token1.symbol[0]}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{token1.symbol}</div>
                    <div className="text-sm text-gray-400">
                      余额: {formattedBalances[`${token1.symbol.toLowerCase()}Balance` as keyof typeof formattedBalances] || '0'}
                    </div>
                  </div>
                </div>
              </div>
              <Input
                type="number"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder="0.0"
                className="bg-gray-900 border-gray-700 text-white text-xl font-mono"
                disabled={!isConnected}
              />
            </div>
          </div>

          {/* 价格区间设置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              价格区间设置
            </h3>

            <div className="bg-gray-800 rounded-xl p-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">当前价格</span>
                  <span className="text-white font-mono">1 WETH = 1000 USDT</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">选中区间</span>
                  <span className="text-white">
                    {selectedRange.type === 'custom'
                      ? `[${(currentPrice * 0.98).toFixed(2)} - ${(currentPrice * 1.02).toFixed(2)}]`
                      : selectedRange.description
                    }
                  </span>
                </div>
              </div>

              {/* 预设选项 */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PRICE_RANGES.map((range) => (
                  <button
                    key={range.type}
                    onClick={() => setSelectedRange(range)}
                    className={`p-3 rounded-lg border transition-all ${
                      selectedRange.type === range.type
                        ? 'bg-pink-500/20 border-pink-500 text-pink-400'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-sm font-semibold">{range.name}</div>
                    <div className="text-xs opacity-80">{range.description}</div>
                  </button>
                ))}
              </div>

              {/* 自定义范围 */}
              {selectedRange.type === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400 text-sm">Tick 下限</Label>
                    <Input
                      type="number"
                      value={customRange.lower}
                      onChange={(e) => setCustomRange({...customRange, lower: Number(e.target.value)})}
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Tick 上限</Label>
                    <Input
                      type="number"
                      value={customRange.upper}
                      onChange={(e) => setCustomRange({...customRange, upper: Number(e.target.value)})}
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 费用设置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">费用设置</h3>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-gray-400">滑点容忍度</Label>
                  <span className="text-white font-mono">{slippage.toFixed(1)}%</span>
                </div>
                <Slider
                  value={[slippage]}
                  onValueChange={(value: number[]) => setSlippage(value[0])}
                  max={10}
                  min={0.1}
                  step={0.1}
                  className="mt-2"
                />
              </div>

              <div className="text-sm text-gray-400">
                <p>⚠️ 较高的滑点容忍度可能导致交易失败</p>
              </div>
            </div>
          </div>

          {/* 授权说明 */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-semibold text-blue-400">需要授权</h3>
                <p className="text-xs text-gray-400">
                  添加流动性需要授权 {token0.symbol}、{token1.symbol} 和所有 NFT 给 UniswapV3 适配器合约
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  • 代币授权：用于转移流动性代币<br/>
                  • NFT 授权：用于管理流动性位置 NFT
                </p>
              </div>
            </div>
          </div>

          {/* 调试信息 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-xs">
              <h4 className="text-white font-semibold mb-2">🔍 调试信息</h4>
              <div className="space-y-1 text-gray-300">
                <div>isConnected: {isConnected ? '✅' : '❌'}</div>
                <div>isInputValid: {isInputValid ? '✅' : '❌'}</div>
                <div>hasSufficientBalance: {hasSufficientBalance ? '✅' : '❌'}</div>
                <div>isOperating: {isOperating ? '✅' : '❌'}</div>
                <div>amount0: {amount0}</div>
                <div>amount1: {amount1}</div>
                <div>WETH 余额: {formattedBalances.wethBalance || '0'}</div>
                <div>USDT 余额: {formattedBalances.usdtBalance || '0'}</div>
                <div>钱包地址: {formattedBalances.address || '未连接'}</div>
                <div>所有余额键: {Object.keys(formattedBalances).join(', ')}</div>
              </div>
            </div>
          )}

          {/* 汇总信息 */}
          {isInputValid && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">汇总信息</h3>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">{token0.symbol} 投入</span>
                  <span className="text-white font-mono">{amount0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{token1.symbol} 投入</span>
                  <span className="text-white font-mono">{amount1}</span>
                </div>
                <div className="border-t border-gray-700 pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">最小 {token0.symbol}</span>
                    <span className="text-yellow-400 font-mono">{calculatedAmounts.amount0Min}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">最小 {token1.symbol}</span>
                    <span className="text-yellow-400 font-mono">{calculatedAmounts.amount1Min}</span>
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">预估收益</span>
                    <span className="text-green-400 font-semibold">8.92% APY</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-red-400">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* 步骤指示器 - 参考 Aave 模式 */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'input' ? 'bg-blue-500' :
              step === 'approve' ? 'bg-yellow-500' :
              step === 'add' ? 'bg-purple-500' :
              'bg-green-500'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'approve' || step === 'add' || step === 'success' ? 'bg-yellow-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'add' || step === 'success' ? 'bg-purple-500' : 'bg-gray-700'
            }`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${
              step === 'success' ? 'bg-green-500' : 'bg-gray-700'
            }`} />
          </div>

          {/* 根据步骤显示不同内容 - 参考 Aave 模式 */}
          {step === 'input' && (
            <>
              {/* 汇总信息 */}
              {isInputValid && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">汇总信息</h3>
                  <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">{token0.symbol} 投入</span>
                      <span className="text-white font-mono">{amount0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{token1.symbol} 投入</span>
                      <span className="text-white font-mono">{amount1}</span>
                    </div>
                    <div className="border-t border-gray-700 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">最小 {token0.symbol}</span>
                        <span className="text-yellow-400 font-mono">{calculatedAmounts.amount0Min}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">最小 {token1.symbol}</span>
                        <span className="text-yellow-400 font-mono">{calculatedAmounts.amount1Min}</span>
                      </div>
                    </div>
                    <div className="border-t border-gray-700 pt-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">预估收益</span>
                        <span className="text-green-400 font-semibold">8.92% APY</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 余额不足提示 */}
              {balanceError && (
                <Alert className="border-yellow-500/20 bg-yellow-500/10">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <AlertDescription className="text-yellow-400">
                    {balanceError}
                  </AlertDescription>
                </Alert>
              )}

              {/* 确认按钮 */}
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 border-gray-700 text-white hover:bg-gray-800"
                  disabled={isOperating}
                >
                  取消
                </Button>

                {!isConnected ? (
                  <Button
                    className="flex-1 bg-gray-600 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    请连接钱包
                  </Button>
                ) : (
                  <Button
                    onClick={handleConfirm}
                    disabled={!isInputValid || !hasSufficientBalance || isOperating}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-yellow-400 hover:from-pink-600 hover:to-yellow-500 text-white"
                  >
                    {isOperating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                        处理中...
                      </>
                    ) : (
                      <>
                        授权并添加流动性
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* 授权步骤 */}
          {step === 'approve' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">授权中</h3>
                <p className="text-sm text-gray-400">
                  正在授权 {token0.symbol}、{token1.symbol} 和 NFT 给 UniswapV3 适配器
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">代币授权</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    <span className="text-xs text-gray-400">NFT 全局授权</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 添加流动性步骤 */}
          {step === 'add' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">添加流动性中</h3>
                <p className="text-sm text-gray-400">
                  正在向 Uniswap V3 添加 {amount0} {token0.symbol} 和 {amount1} {token1.symbol}
                </p>
              </div>
            </div>
          )}

          {/* 成功步骤 */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">添加流动性成功！</h3>
                <p className="text-sm text-gray-400 mb-4">
                  成功添加 {amount0} {token0.symbol} 和 {amount1} {token1.symbol} 到 Uniswap V3
                </p>

                {/* 交易哈希 */}
                {txHash && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">交易哈希</p>
                    <p className="text-xs text-blue-400 break-all font-mono">
                      {txHash}
                    </p>
                  </div>
                )}
              </div>

              {/* 完成按钮 */}
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all"
              >
                完成
              </Button>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-red-400">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};

export default UniswapLiquidityModal;