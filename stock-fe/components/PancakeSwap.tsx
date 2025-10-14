/**
 * PancakeSwap 交换组件
 *
 * 提供完整的代币交换功能，包括：
 * - 精确输入/输出交换
 * - 实时余额查询
 * - 汇率显示
 * - 滑点保护
 * - 错误处理
 */

import React, { useState, useEffect } from 'react';
import { usePancakeSwapWithClients } from '@/lib/hooks/usePancakeSwapWithClients';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * 代币选择组件
 */
const TokenSelector: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; address: string }[];
  disabled?: boolean;
}> = ({ value, onChange, options, disabled = false }) => {
  const getTokenIcon = (label: string) => {
    switch (label) {
      case 'USDT':
        return '₮';
      case 'CAKE':
        return '🥞';
      default:
        return '🪙';
    }
  };

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors disabled:bg-gray-900 disabled:text-gray-500 hover:border-gray-600">
        <SelectValue placeholder="选择代币">
          {value && (
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {getTokenIcon(options.find(opt => opt.address === value)?.label || '')}
              </span>
              <span className="text-sm font-medium">
                {options.find(opt => opt.address === value)?.label || '选择代币'}
              </span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-gray-800 border border-gray-700 text-white">
        {options.map((option) => (
          <SelectItem
            key={option.address}
            value={option.address}
            className="hover:bg-gray-700 focus:bg-amber-500/20 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{getTokenIcon(option.label)}</span>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-white">{option.label}</div>
                <div className="text-xs text-gray-400 font-mono">
                  {option.address.slice(0, 6)}...{option.address.slice(-4)}
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

/**
 * 数量输入组件
 */
const AmountInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  label: string;
  balance?: string;
  maxBalance?: string;
  onMax?: () => void;
}> = ({ value, onChange, placeholder = "0.00", readOnly = false, label, balance = "0", maxBalance = "0", onMax }) => {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
      <div className="flex justify-between items-center mb-3">
        <Label className="text-sm font-medium text-gray-300">{label}</Label>
        {balance && (
          <span className="text-sm text-gray-400">
            余额: {balance}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`flex-1 bg-transparent text-2xl font-bold outline-none placeholder-gray-500 border-0 shadow-none p-0 h-auto ${
            readOnly ? 'text-gray-500' : 'text-white'
          }`}
        />
        {onMax && !readOnly && (
          <Button
            onClick={() => onMax()}
            variant="secondary"
            size="sm"
            className="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 h-auto"
          >
            MAX
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * 交换模式切换组件
 */
const SwapModeToggle: React.FC<{
  mode: 'exactInput' | 'exactOutput';
  onChange: (mode: 'exactInput' | 'exactOutput') => void;
}> = ({ mode, onChange }) => {
  return (
    <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-1">
      <button
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
          mode === 'exactInput'
            ? 'bg-amber-500 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        onClick={() => onChange('exactInput')}
      >
        精确输入
      </button>
      <button
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
          mode === 'exactOutput'
            ? 'bg-amber-500 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        onClick={() => onChange('exactOutput')}
      >
        精确输出
      </button>
    </div>
  );
};

/**
 * 错误提示组件
 */
const ErrorMessage: React.FC<{ error: string; onClear?: () => void }> = ({ error, onClear }) => {
  return (
    <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-red-400 text-sm">{error}</span>
        {onClear && (
          <button
            onClick={onClear}
            className="ml-auto text-red-400 hover:text-red-300 text-sm"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * 设置面板组件
 */
const SettingsPanel: React.FC<{
  slippageBps: number;
  onSlippageChange: (value: number) => void;
  onClose: () => void;
}> = ({ slippageBps, onSlippageChange, onClose }) => {
  const [customValue, setCustomValue] = useState((slippageBps / 100).toFixed(1));

  const presetOptions = [
    { label: '0.1%', value: 10 },
    { label: '0.5%', value: 50 },
    { label: '1.0%', value: 100 },
    { label: '2.0%', value: 200 },
  ];

  const handlePresetClick = (value: number) => {
    setCustomValue((value / 100).toFixed(1));
    onSlippageChange(value);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomValue(value);

    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue >= 0.1 && numericValue <= 50) {
      onSlippageChange(Math.round(numericValue * 100));
    }
  };

  const getSlippageColor = () => {
    const slippagePercent = slippageBps / 100;
    if (slippagePercent < 0.5) return 'text-green-400';
    if (slippagePercent < 1) return 'text-yellow-400';
    if (slippagePercent < 3) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-300">交易设置</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 滑点设置 */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-300">
              滑点容忍度
            </label>
            <span className={`text-sm font-medium ${getSlippageColor()}`}>
              {customValue}%
            </span>
          </div>

          {/* 预设选项 */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {presetOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePresetClick(option.value)}
                className={`py-2 px-2 text-xs font-medium rounded-lg border transition-colors ${
                  slippageBps === option.value
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 自定义输入 */}
          <div className="relative">
            <input
              type="number"
              value={customValue}
              onChange={handleCustomChange}
              min="0.1"
              max="50"
              step="0.1"
              placeholder="0.1"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              %
            </span>
          </div>

          <div className="flex items-start gap-2 mt-2">
            <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-400">
              设置滑点容忍度，如果价格变化超过此值，交易将失败
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 主 PancakeSwap 组件
 */
const PancakeSwapComponent: React.FC = () => {
  // PancakeSwap Hook
  const {
    isConnected,
    address,
    isLoading,
    isOperating,
    error,
    userBalance,
    exchangeRate,
    formattedBalances,
    needsApproval,
    maxBalances,
    usdtTokenAddress,
    cakeTokenAddress,
    initializePancakeSwap,
    fetchExchangeRate,
    estimateSwap,
    approveToken,
    swapExactInput,
    swapExactOutput,
    clearError
  } = usePancakeSwapWithClients();

  // 组件状态
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [swapMode, setSwapMode] = useState<'exactInput' | 'exactOutput'>('exactInput');
  const [slippageBps, setSlippageBps] = useState(100); // 1%
  const [showSettings, setShowSettings] = useState(false);
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);

  // 代币选项
  const tokenOptions = [
    { value: 'USDT', label: 'USDT', address: usdtTokenAddress || '' },
    { value: 'CAKE', label: 'CAKE', address: cakeTokenAddress || '' }
  ];

  // 初始化合约
  useEffect(() => {
    if (isConnected && usdtTokenAddress && cakeTokenAddress) {
      initializePancakeSwap();
      setTokenIn(usdtTokenAddress);
      setTokenOut(cakeTokenAddress);
    }
  }, [isConnected, usdtTokenAddress, cakeTokenAddress]);

  // 预估交换数量
  const handleEstimate = async () => {
    if (!amountIn || !tokenIn || !tokenOut || tokenIn === tokenOut) {
      setEstimatedAmount('');
      return;
    }

    try {
      setIsEstimating(true);
      const operationType = swapMode === 'exactInput' ? 6 : 8; // PancakeSwapOperationType
      const result = await estimateSwap(amountIn, tokenIn, tokenOut, operationType);

      if (result.success && result.data) {
        setEstimatedAmount(result.data.formattedOutput);
        if (swapMode === 'exactInput') {
          setAmountOut(result.data.formattedOutput);
        }
      } else {
        setEstimatedAmount('');
      }
    } catch (error) {
      console.error('预估失败:', error);
      setEstimatedAmount('');
    } finally {
      setIsEstimating(false);
    }
  };

  // 监听输入变化，自动预估
  useEffect(() => {
    if (swapMode === 'exactInput' && amountIn && tokenIn && tokenOut && tokenIn !== tokenOut) {
      handleEstimate();
    }
  }, [amountIn, tokenIn, tokenOut, swapMode]);

  // 监听输出变化，自动预估
  useEffect(() => {
    if (swapMode === 'exactOutput' && amountOut && tokenIn && tokenOut && tokenIn !== tokenOut) {
      handleEstimate();
    }
  }, [amountOut, tokenIn, tokenOut, swapMode]);

  // 切换代币
  const switchTokens = () => {
    const newTokenIn = tokenOut;
    const newTokenOut = tokenIn;
    const newAmountIn = amountOut;
    const newAmountOut = amountIn;

    setTokenIn(newTokenIn);
    setTokenOut(newTokenOut);
    setAmountIn(newAmountIn);
    setAmountOut(newAmountOut);
    setEstimatedAmount('');
  };

  // 获取汇率
  const getExchangeRateDisplay = () => {
    if (!exchangeRate || !tokenIn || !tokenOut) return null;

    const tokenInSymbol = tokenOptions.find(t => t.address === tokenIn)?.label || '';
    const tokenOutSymbol = tokenOptions.find(t => t.address === tokenOut)?.label || '';

    return `1 ${tokenInSymbol} = ${exchangeRate.rate.toFixed(4)} ${tokenOutSymbol}`;
  };

  // 获取当前余额
  const getCurrentBalance = (tokenAddress: string) => {
    if (tokenAddress === usdtTokenAddress) {
      return formattedBalances.usdtBalance;
    }
    if (tokenAddress === cakeTokenAddress) {
      return formattedBalances.cakeBalance;
    }
    return '0';
  };

  // 获取最大余额
  const getMaxBalance = (tokenAddress: string) => {
    if (tokenAddress === usdtTokenAddress) {
      return maxBalances.maxUSDTToSwap;
    }
    if (tokenAddress === cakeTokenAddress) {
      return maxBalances.maxCAKEToSwap;
    }
    return '0';
  };

  // 处理授权
  const handleApprove = async (tokenAddress: string) => {
    if (!tokenAddress) return;

    const balance = getCurrentBalance(tokenAddress);
    if (!balance || parseFloat(balance) <= 0) {
      alert('余额不足');
      return;
    }

    try {
      const result = await approveToken(tokenAddress, balance);
      if (result.success) {
        alert(`授权成功！交易哈希: ${result.data?.hash}`);
      } else {
        alert(`授权失败: ${result.error}`);
      }
    } catch (error) {
      alert('授权失败，请重试');
    }
  };

  // 处理交换
  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || tokenIn === tokenOut) {
      alert('请选择不同的代币');
      return;
    }

    if (swapMode === 'exactInput' && !amountIn) {
      alert('请输入交换数量');
      return;
    }

    if (swapMode === 'exactOutput' && !amountOut) {
      alert('请输入期望的输出数量');
      return;
    }

    try {
      let result;
      if (swapMode === 'exactInput') {
        result = await swapExactInput(amountIn, tokenIn, tokenOut, slippageBps);
      } else {
        result = await swapExactOutput(amountOut, tokenIn, tokenOut, slippageBps);
      }

      if (result.success) {
        alert(`交换成功！交易哈希: ${result.hash}`);
        // 重置表单
        setAmountIn('');
        setAmountOut('');
        setEstimatedAmount('');
      } else {
        alert(`交换失败: ${result.error}`);
      }
    } catch (error) {
      alert('交换失败，请重试');
    }
  };

  // 检查是否可以交换
  const canSwap = () => {
    if (!isConnected || isOperating || isLoading || isEstimating) return false;

    if (!tokenIn || !tokenOut || tokenIn === tokenOut) return false;

    if (swapMode === 'exactInput' && !amountIn) return false;

    if (swapMode === 'exactOutput' && !amountOut) return false;

    return true;
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">连接钱包</h2>
          <p className="text-sm text-gray-400">请连接您的钱包以使用 PancakeSwap 交换功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0">
      {/* 余额显示 */}
      <div className="mb-4 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">USDT 余额</div>
            <div className="text-sm font-semibold text-white">{formattedBalances.usdtBalance}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">CAKE 余额</div>
            <div className="text-sm font-semibold text-white">{formattedBalances.cakeBalance}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">钱包地址</span>
            <span className="text-xs text-gray-300 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          </div>
        </div>
      </div>

        {/* 错误显示 */}
        {error && <ErrorMessage error={error} onClear={clearError} />}

        {/* 交换模式切换 */}
        <SwapModeToggle mode={swapMode} onChange={setSwapMode} />

        {/* 交换表单 */}
        <div className="space-y-4">
          {/* 输入代币 */}
          <div>
            <TokenSelector
              value={tokenIn}
              onChange={setTokenIn}
              options={tokenOptions}
            />
            <AmountInput
              label={swapMode === 'exactInput' ? '支付' : '最大支付'}
              value={swapMode === 'exactInput' ? amountIn : amountOut}
              onChange={(value) => swapMode === 'exactInput' ? setAmountIn(value) : setAmountOut(value)}
              balance={getCurrentBalance(tokenIn)}
              maxBalance={getMaxBalance(tokenIn)}
              onMax={() => swapMode === 'exactInput' ? setAmountIn(getMaxBalance(tokenIn)) : setAmountOut(getMaxBalance(tokenIn))}
            />
          </div>

          {/* 切换按钮 */}
          <div className="flex justify-center">
            <Button
              onClick={switchTokens}
              disabled={isOperating || isLoading}
              variant="secondary"
              size="icon"
              className="p-3 bg-amber-500 text-white rounded-full hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </Button>
          </div>

          {/* 输出代币 */}
          <div>
            <TokenSelector
              value={tokenOut}
              onChange={setTokenOut}
              options={tokenOptions}
            />
            <AmountInput
              label={swapMode === 'exactInput' ? '最小接收' : '接收'}
              value={swapMode === 'exactInput' ? amountOut : amountIn}
              onChange={(value) => swapMode === 'exactInput' ? setAmountOut(value) : setAmountIn(value)}
              readOnly={swapMode === 'exactInput'}
              balance={getCurrentBalance(tokenOut)}
            />
          </div>

        {/* 汇率和预估信息 */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 mb-4">
          {getExchangeRateDisplay() && (
            <div className="text-center text-sm text-amber-400 mb-2">
              {getExchangeRateDisplay()}
            </div>
          )}

          {estimatedAmount && swapMode === 'exactInput' && (
            <div className="text-center text-sm text-white">
              预估接收: <span className="font-semibold text-amber-400">{estimatedAmount}</span>
              {isEstimating && (
                <span className="text-gray-400 ml-1">
                  <svg className="w-3 h-3 inline animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>

          {/* 授权提示 */}
          {(needsApproval.usdt || needsApproval.cake) && (
            <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm text-yellow-400 font-medium">需要授权代币</p>
              </div>
              <div className="flex gap-2">
                {needsApproval.usdt && (
                  <Button
                    onClick={() => handleApprove(usdtTokenAddress!)}
                    disabled={isOperating}
                    variant="secondary"
                    className="flex-1 py-2 text-sm bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-600"
                  >
                    授权 USDT
                  </Button>
                )}
                {needsApproval.cake && (
                  <Button
                    onClick={() => handleApprove(cakeTokenAddress!)}
                    disabled={isOperating}
                    variant="secondary"
                    className="flex-1 py-2 text-sm bg-yellow-500 text-white hover:bg-yellow-600 disabled:bg-gray-600"
                  >
                    授权 CAKE
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* 设置按钮 */}
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setShowSettings(!showSettings)}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              设置
            </Button>
          </div>

          {/* 设置面板 */}
          {showSettings && (
            <SettingsPanel
              slippageBps={slippageBps}
              onSlippageChange={setSlippageBps}
              onClose={() => setShowSettings(false)}
            />
          )}

          {/* 交换按钮 */}
          <Button
            onClick={handleSwap}
            disabled={!canSwap()}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isOperating ? (
              <>
                <svg className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                交换中...
              </>
            ) : (
              <>
                交换
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </Button>
        </div>
    </div>
  );
};

export default PancakeSwapComponent;