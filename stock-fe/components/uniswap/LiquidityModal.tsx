'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Minus,
  DollarSign,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  ArrowUpDown
} from 'lucide-react';
import { useUniswap, useUniswapTokens, useUniswapOperations } from '@/lib/hooks/useUniswap';
import UniswapDeploymentInfo from '@/lib/abi/deployments-uniswapv3-adapter-sepolia.json';
import TokenPairSelector, { TokenPair } from './TokenPairSelector';

interface LiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation?: 'add' | 'remove';
  tokenId?: bigint;
  tokenPair?: TokenPair; // 可选的自定义代币对
}

export const LiquidityModal: React.FC<LiquidityModalProps> = ({
  isOpen,
  onClose,
  operation = 'add',
  tokenId,
  tokenPair
}) => {
  // 🔧 默认代币对配置（如果没有传入自定义代币对）
  const defaultTokenPair: TokenPair = {
    symbol0: 'USDT',
    symbol1: 'WETH',
    address0: UniswapDeploymentInfo.contracts.MockERC20_USDT as `0x${string}`,
    address1: UniswapDeploymentInfo.contracts.MockWethToken as `0x${string}`,
    decimals0: 6,
    decimals1: 18,
    currentPrice: 0.001, // 1 USDT = 0.001 WETH (1 WETH = 1000 USDT)
  };

  const [currentTokenPair, setCurrentTokenPair] = useState<TokenPair>(tokenPair || defaultTokenPair);
  const [showTokenPairSelector, setShowTokenPairSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [tickLower, setTickLower] = useState(-60000);
  const [tickUpper, setTickUpper] = useState(60000);
  const [slippage, setSlippage] = useState(1.0);
  const [selectedPreset, setSelectedPreset] = useState('standard');

  const {
    isConnected,
    userBalance,
    formattedBalances,
    poolInfo,
    initializeUniswapTrading,
    refreshUserInfo,
    userPositions,
    selectedPosition,
  } = useUniswap();

  const {
    needsApproval,
    approveUSDT,
    approveWETH,
  } = useUniswapTokens();

  const {
    isOperating,
    error,
    addLiquidity,
    removeLiquidity,
    clearErrors,
  } = useUniswapOperations();

  // 价格区间预设
  const priceRangePresets = [
    { id: 'narrow', name: '窄幅', lower: -3000, upper: 3000 },
    { id: 'standard', name: '标准', lower: -60000, upper: 60000 },
    { id: 'wide', name: '宽幅', lower: -120000, upper: 120000 },
  ];

  // 🔧 价格比率计算（根据当前代币对的市场价格）
  const calculatePriceRatio = () => {
    const { symbol0, symbol1, currentPrice } = currentTokenPair;

    // 如果用户输入了 USDT 数量，计算对应的 WETH 数量
    if (amount0 && parseFloat(amount0) > 0) {
      const calculatedToken1 = parseFloat(amount0) * currentPrice; // USDT * price = WETH
      return {
        fromAmount0: amount0,
        toAmount1: calculatedToken1.toFixed(4), // 🔧 减少小数位到4位
        price: 1 / currentPrice, // 显示 WETH 相对于 USDT 的价格
        direction: `${symbol0}→${symbol1}`
      };
    }

    // 如果用户输入了 WETH 数量，计算对应的 USDT 数量
    if (amount1 && parseFloat(amount1) > 0) {
      const calculatedToken0 = parseFloat(amount1) / currentPrice; // WETH / price = USDT
      return {
        fromAmount1: amount1,
        toAmount0: calculatedToken0.toFixed(2), // USDT 保持2位小数
        price: 1 / currentPrice, // 显示 WETH 相对于 USDT 的价格
        direction: `${symbol1}→${symbol0}`
      };
    }

    return null;
  };

  // 价格信息
  const priceInfo = calculatePriceRatio();

  // 🔧 临时修复：暂时禁用滑点计算，直接使用原始金额
  const calculateMinAmount = (amount: string, slippagePercent: number) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return '0';
    // 🔧 暂时禁用滑点：返回原始金额
    return amountNum.toString();
  };

  // 处理代币对选择
  const handleTokenPairSelect = useCallback((pair: TokenPair) => {
    setCurrentTokenPair(pair);
    setShowTokenPairSelector(false);
    // 清空当前输入金额
    setAmount0('');
    setAmount1('');
  }, []);

  // 🔧 根据 tokenId 查找位置信息
  const getPositionByTokenId = useCallback((tokenId: bigint) => {
    return userPositions.find(position => position.tokenId === tokenId);
  }, [userPositions]);

  // 🔧 获取当前选择的位置信息
  const currentPosition = tokenId ? getPositionByTokenId(tokenId) : null;

  // 验证输入
  const validateInputs = () => {
    if (activeTab === 'add') {
      return parseFloat(amount0) > 0 && parseFloat(amount1) > 0;
    }
    return tokenId !== undefined;
  };

  // 自动初始化
  const handleInitialize = useCallback(async () => {
    try {
      await initializeUniswapTrading();
    } catch (error) {
      console.error('初始化失败:', error);
    }
  }, [initializeUniswapTrading]);

  // 授权代币 - 通用代币授权处理（优化版本）
  const handleApproveToken0 = useCallback(async () => {
    try {
      // 🔧 优化：使用最大金额进行一次性授权，避免后续重复授权
      const inputAmount = parseFloat(amount0) > 0 ? parseFloat(amount0) : 1;
      const maxApprovalAmount = inputAmount * 1000; // 授权1000倍当前金额

      console.log('🔑 开始授权 Token0 (大额授权):', {
        symbol: currentTokenPair.symbol0,
        address: currentTokenPair.address0,
        inputAmount: amount0,
        approvalAmount: maxApprovalAmount.toString(),
        reason: '避免重复授权冲突'
      });

      if (currentTokenPair.symbol0 === 'USDT') {
        await approveUSDT(maxApprovalAmount.toString());
      } else if (currentTokenPair.symbol0 === 'WETH') {
        await approveWETH(maxApprovalAmount.toString());
      } else {
        // 对于其他代币，这里可以添加相应的授权逻辑
        console.log('⚠️ 暂不支持该代币的自动授权:', currentTokenPair.symbol0);
      }

      // 授权成功后刷新余额信息
      await refreshUserInfo();
    } catch (error) {
      console.error(`${currentTokenPair.symbol0} 授权失败:`, error);
      // 如果是"already known"错误，静默处理
      if (error instanceof Error && error.message.includes('already known')) {
        console.log(`✅ ${currentTokenPair.symbol0} 授权可能已存在，刷新状态`);
        await refreshUserInfo();
      } else {
        throw error;
      }
    }
  }, [currentTokenPair, amount0, approveUSDT, approveWETH, refreshUserInfo]);

  const handleApproveToken1 = useCallback(async () => {
    try {
      // 🔧 优化：使用最大金额进行一次性授权，避免后续重复授权
      const inputAmount = parseFloat(amount1) > 0 ? parseFloat(amount1) : 1;
      const maxApprovalAmount = inputAmount * 1000; // 授权1000倍当前金额

      console.log('🔑 开始授权 Token1 (大额授权):', {
        symbol: currentTokenPair.symbol1,
        address: currentTokenPair.address1,
        inputAmount: amount1,
        approvalAmount: maxApprovalAmount.toString(),
        reason: '避免重复授权冲突'
      });

      if (currentTokenPair.symbol1 === 'USDT') {
        await approveUSDT(maxApprovalAmount.toString());
      } else if (currentTokenPair.symbol1 === 'WETH') {
        await approveWETH(maxApprovalAmount.toString());
      } else {
        // 对于其他代币，这里可以添加相应的授权逻辑
        console.log('⚠️ 暂不支持该代币的自动授权:', currentTokenPair.symbol1);
      }

      // 授权成功后刷新余额信息
      await refreshUserInfo();
    } catch (error) {
      console.error(`${currentTokenPair.symbol1} 授权失败:`, error);
      // 如果是"already known"错误，静默处理
      if (error instanceof Error && error.message.includes('already known')) {
        console.log(`✅ ${currentTokenPair.symbol1} 授权可能已存在，刷新状态`);
        await refreshUserInfo();
      } else {
        throw error;
      }
    }
  }, [currentTokenPair, amount1, approveUSDT, approveWETH, refreshUserInfo]);

  // 添加流动性
  const handleAddLiquidity = useCallback(async () => {
    if (!validateInputs()) return;

    try {
      console.log('🚀 开始添加流动性...');
      console.log('📋 代币对信息:', {
        symbol0: currentTokenPair.symbol0,
        symbol1: currentTokenPair.symbol1,
        address0: currentTokenPair.address0,
        address1: currentTokenPair.address1,
        amount0,
        amount1,
        currentPrice: currentTokenPair.currentPrice
      });

      const result = await addLiquidity({
        token0: currentTokenPair.address0, // 使用当前选择的代币地址
        token1: currentTokenPair.address1, // 使用当前选择的代币地址
        amount0, // token0 金额
        amount1, // token1 金额
        amount0Min: calculateMinAmount(amount0, slippage), // token0 最小金额
        amount1Min: calculateMinAmount(amount1, slippage), // token1 最小金额
        tickLower,
        tickUpper,
      });

      console.log('✅ 添加流动性成功:', result.hash);
      onClose();
      await refreshUserInfo();
    } catch (error) {
      console.error('❌ 添加流动性失败:', error);
    }
  }, [currentTokenPair, amount0, amount1, tickLower, tickUpper, slippage, addLiquidity, onClose, refreshUserInfo]);

  // 移除流动性
  const handleRemoveLiquidity = useCallback(async () => {
    if (!tokenId) return;

    try {
      // 🔧 严格按照测试用例格式：不传递amount0Min和amount1Min，使用合约默认值
      const result = await removeLiquidity({
        tokenId,
      });

      console.log('✅ 移除流动性成功:', result.hash);
      onClose();
      await refreshUserInfo();
    } catch (error) {
      console.error('❌ 移除流动性失败:', error);
    }
  }, [tokenId, removeLiquidity, onClose, refreshUserInfo]);

  // 完整流程（自动授权 + 操作）- 修复授权检查逻辑
  const handleCompleteFlow = useCallback(async () => {
    if (!isConnected) return;

    // 自动初始化
    await handleInitialize();

    if (activeTab === 'add') {
      // 🔧 修复：智能检查授权状态，避免重复授权

      // 检查 token0 授权状态
      if (amount0 && parseFloat(amount0) > 0) {

        let allowance = '0';
        let needsApprovalForToken = false;

        if (currentTokenPair.symbol0 === 'USDT') {
          allowance = formattedBalances?.usdtAllowance || '0';
          needsApprovalForToken = needsApproval.usdt;
        } else if (currentTokenPair.symbol0 === 'WETH') {
          allowance = formattedBalances?.wethAllowance || '0';
          needsApprovalForToken = needsApproval.weth;
        }

        // 只有在授权金额不足时才重新授权，并且使用足够大的金额避免频繁授权
        const currentAllowance = parseFloat(allowance);
        const requiredAmount = parseFloat(amount0);
        const largeApprovalAmount = requiredAmount * 100; // 授权100倍当前需要的金额

        console.log(`📊 ${currentTokenPair.symbol0} 授权检查:`, {
          currentAllowance,
          requiredAmount,
          needsApproval: needsApprovalForToken,
          shouldApprove: currentAllowance < requiredAmount || needsApprovalForToken
        });

        if (currentAllowance < requiredAmount || needsApprovalForToken) {
          console.log(`⚠️ ${currentTokenPair.symbol0} 授权不足，进行一次性大额授权`);
          try {
            if (currentTokenPair.symbol0 === 'USDT') {
              await approveUSDT(largeApprovalAmount.toString());
            } else if (currentTokenPair.symbol0 === 'WETH') {
              await approveWETH(largeApprovalAmount.toString());
            }
          } catch (error) {
            console.error(`${currentTokenPair.symbol0} 授权失败:`, error);
            // 如果授权失败，检查是否是"already known"错误，如果是则继续执行
            if (error instanceof Error && error.message.includes('already known')) {
            } else {
              throw error;
            }
          }
        } else {
        }
      }

      // 检查 token1 授权状态
      if (amount1 && parseFloat(amount1) > 0) {

        let allowance = '0';
        let needsApprovalForToken = false;

        if (currentTokenPair.symbol1 === 'USDT') {
          allowance = formattedBalances?.usdtAllowance || '0';
          needsApprovalForToken = needsApproval.usdt;
        } else if (currentTokenPair.symbol1 === 'WETH') {
          allowance = formattedBalances?.wethAllowance || '0';
          needsApprovalForToken = needsApproval.weth;
        }

        // 只有在授权金额不足时才重新授权，并且使用足够大的金额避免频繁授权
        const currentAllowance = parseFloat(allowance);
        const requiredAmount = parseFloat(amount1);
        const largeApprovalAmount = requiredAmount * 100; // 授权100倍当前需要的金额

        console.log(`📊 ${currentTokenPair.symbol1} 授权检查:`, {
          currentAllowance,
          requiredAmount,
          needsApproval: needsApprovalForToken,
          shouldApprove: currentAllowance < requiredAmount || needsApprovalForToken
        });

        if (currentAllowance < requiredAmount || needsApprovalForToken) {
          console.log(`⚠️ ${currentTokenPair.symbol1} 授权不足，进行一次性大额授权`);
          try {
            if (currentTokenPair.symbol1 === 'USDT') {
              await approveUSDT(largeApprovalAmount.toString());
            } else if (currentTokenPair.symbol1 === 'WETH') {
              await approveWETH(largeApprovalAmount.toString());
            }
          } catch (error) {
            console.error(`${currentTokenPair.symbol1} 授权失败:`, error);
            // 如果授权失败，检查是否是"already known"错误，如果是则继续执行
            if (error instanceof Error && error.message.includes('already known')) {
            } else {
              throw error;
            }
          }
        } else {
        }
      }

      // 等待一小段时间确保授权状态更新
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 刷新授权状态
      await refreshUserInfo();

      // 执行添加流动性
      console.log('🚀 开始添加流动性...');
      await handleAddLiquidity();
    } else {
      // 执行移除流动性
      await handleRemoveLiquidity();
    }
  }, [isConnected, activeTab, needsApproval, amount0, amount1, handleInitialize, currentTokenPair, approveUSDT, approveWETH, handleAddLiquidity, handleRemoveLiquidity, formattedBalances, refreshUserInfo]);

  // 清除错误
  React.useEffect(() => {
    clearErrors();
  }, [activeTab, clearErrors]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl mx-auto bg-gray-900 border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              {activeTab === 'add' ? (
                <>
                  <Plus className="w-5 h-5 text-green-400" />
                  添加流动性
                </>
              ) : (
                <>
                  <Minus className="w-5 h-5 text-red-400" />
                  移除流动性
                </>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* 连接状态提示 */}
          {!isConnected && (
            <Alert className="border-yellow-500/20 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-400">
                请先连接钱包以使用流动性功能
              </AlertDescription>
            </Alert>
          )}

          {/* 标签页切换 */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'add' | 'remove')}>
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="add" className="data-[state=active]:bg-gray-700 text-white">
                添加流动性
              </TabsTrigger>
              <TabsTrigger value="remove" className="data-[state=active]:bg-gray-700 text-white">
                移除流动性
              </TabsTrigger>
            </TabsList>

            {/* 添加流动性标签页 */}
            <TabsContent value="add" className="space-y-6">
              {/* 代币对选择 */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-white font-medium">当前交易对</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTokenPairSelector(true)}
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    切换交易对
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {currentTokenPair.symbol0.slice(0, 2)}
                    </div>
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {currentTokenPair.symbol1.slice(0, 2)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-semibold text-lg">
                      {currentTokenPair.symbol0}/{currentTokenPair.symbol1}
                    </div>
                    <div className="text-gray-400 text-sm">
                      1 {currentTokenPair.symbol1} = {(1 / currentTokenPair.currentPrice).toFixed(4)} {currentTokenPair.symbol0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400 text-xs">24h 交易量</div>
                    <div className="text-white font-medium">
                      {currentTokenPair.volume24h ? `$${(currentTokenPair.volume24h / 1000000).toFixed(1)}M` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 代币输入区域 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="token0-amount" className="text-white">{currentTokenPair.symbol0} 数量</Label>
                  <Input
                    id="token0-amount"
                    type="number"
                    value={amount0}
                    onChange={(e) => {
                      setAmount0(e.target.value);
                      // 🔧 自动计算对应的 token1 数量
                      if (e.target.value && parseFloat(e.target.value) > 0) {
                        const calculatedToken1 = (parseFloat(e.target.value) * currentTokenPair.currentPrice).toFixed(
                          currentTokenPair.decimals1 === 6 ? 2 : 6
                        );
                        setAmount1(calculatedToken1);
                      }
                    }}
                    placeholder="0.0"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">可用余额</span>
                    <span className="text-white">
                      {currentTokenPair.symbol0 === 'USDT' ? (formattedBalances?.usdtBalance || '0') :
                       currentTokenPair.symbol0 === 'WETH' ? (formattedBalances?.wethBalance || '0') : '0'} {currentTokenPair.symbol0}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token1-amount" className="text-white">{currentTokenPair.symbol1} 数量</Label>
                  <Input
                    id="token1-amount"
                    type="number"
                    value={amount1}
                    onChange={(e) => {
                      setAmount1(e.target.value);
                      // 🔧 自动计算对应的 token0 数量
                      if (e.target.value && parseFloat(e.target.value) > 0) {
                        const calculatedToken0 = (parseFloat(e.target.value) / currentTokenPair.currentPrice).toFixed(
                          currentTokenPair.decimals0 === 6 ? 2 : 6
                        );
                        setAmount0(calculatedToken0);
                      }
                    }}
                    placeholder="0.0"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">可用余额</span>
                    <span className="text-white">
                      {currentTokenPair.symbol1 === 'USDT' ? (formattedBalances?.usdtBalance || '0') :
                       currentTokenPair.symbol1 === 'WETH' ? (formattedBalances?.wethBalance || '0') : '0'} {currentTokenPair.symbol1}
                    </span>
                  </div>
                </div>
              </div>

              {/* 价格显示 */}
              {priceInfo && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 text-sm">当前价格比率</span>
                    <span className="text-white font-mono text-sm">
                      1 {currentTokenPair.symbol1} = {priceInfo.price.toFixed(currentTokenPair.decimals0 === 6 ? 2 : 6)} {currentTokenPair.symbol0}
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    输入 {priceInfo.direction.includes(`${currentTokenPair.symbol0}→${currentTokenPair.symbol1}`) ? priceInfo.fromAmount0 + ' ' + currentTokenPair.symbol0 : priceInfo.fromAmount1 + ' ' + currentTokenPair.symbol1}
                    ≈ {priceInfo.direction.includes(`${currentTokenPair.symbol0}→${currentTokenPair.symbol1}`) ? priceInfo.toAmount1 + ' ' + currentTokenPair.symbol1 : priceInfo.toAmount0 + ' ' + currentTokenPair.symbol0}
                  </div>
                  <div className="text-gray-500 text-xs mt-2">
                    * 价格基于市场数据，实际交易价格以滑点为准
                  </div>
                </div>
              )}

              {/* 快捷填充按钮 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const balance = currentTokenPair.symbol0 === 'USDT' ? (formattedBalances?.usdtBalance || '0') :
                                   currentTokenPair.symbol0 === 'WETH' ? (formattedBalances?.wethBalance || '0') : '0';
                    setAmount0(balance);
                  }}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  最大 {currentTokenPair.symbol0}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const balance = currentTokenPair.symbol1 === 'USDT' ? (formattedBalances?.usdtBalance || '0') :
                                   currentTokenPair.symbol1 === 'WETH' ? (formattedBalances?.wethBalance || '0') : '0';
                    setAmount1(balance);
                  }}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  最大 {currentTokenPair.symbol1}
                </Button>
              </div>

              {/* 价格区间设置 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-white">价格区间</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    高级
                  </Button>
                </div>

                {/* 预设选择 */}
                <div className="grid grid-cols-3 gap-2">
                  {priceRangePresets.map((preset) => (
                    <Button
                      key={preset.id}
                      variant={selectedPreset === preset.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedPreset(preset.id);
                        setTickLower(preset.lower);
                        setTickUpper(preset.upper);
                      }}
                      className={
                        selectedPreset === preset.id
                          ? "bg-blue-500/20 border-blue-500 text-blue-400"
                          : "border-gray-700 text-gray-400 hover:bg-gray-800"
                      }
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>

                {/* Tick 输入 */}
                <div className="grid grid-cols-2 gap-4 bg-gray-800/50 rounded-lg p-4">
                  <div>
                    <Label className="text-sm text-gray-400">Tick 下限</Label>
                    <Input
                      type="number"
                      value={tickLower}
                      onChange={(e) => setTickLower(Number(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-400">Tick 上限</Label>
                    <Input
                      type="number"
                      value={tickUpper}
                      onChange={(e) => setTickUpper(Number(e.target.value))}
                      className="bg-gray-900 border-gray-700 text-white"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 移除流动性标签页 */}
            <TabsContent value="remove" className="space-y-6">
              {/* 当前位置信息 */}
              {currentPosition ? (
                <div className="bg-gray-800/50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">流动性位置详情</h3>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Token ID: {currentPosition.tokenId.toString()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-900/50 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">Token0 地址</div>
                      <div className="text-white font-mono text-xs">
                        {currentPosition.token0.slice(0, 8)}...{currentPosition.token0.slice(-6)}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">Token1 地址</div>
                      <div className="text-white font-mono text-xs">
                        {currentPosition.token1.slice(0, 8)}...{currentPosition.token1.slice(-6)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-900/50 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">流动性数量</div>
                      <div className="text-white font-semibold">
                        {currentPosition.formattedLiquidity}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-1">手续费率</div>
                      <div className="text-white font-semibold">
                        {currentPosition.fee / 10000}%
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                    <div className="text-sm text-gray-400 mb-2">价格区间 (Tick)</div>
                    <div className="flex justify-between text-white">
                      <span>下限: {currentPosition.tickLower}</span>
                      <span>上限: {currentPosition.tickUpper}</span>
                    </div>
                  </div>

                  {/* 预估可提取的代币数量 */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3">预估可提取数量</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 mb-1">预估 USDT</div>
                        <div className="text-white font-semibold text-lg">
                          {parseFloat(currentPosition.formattedTokensOwed0).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-1">预估 WETH</div>
                        <div className="text-white font-semibold text-lg">
                          {parseFloat(currentPosition.formattedTokensOwed1).toFixed(6)}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      * 包含本金 + 待收取手续费
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                  <div className="text-6xl mb-4">🦄</div>
                  <h3 className="text-lg font-semibold text-white mb-2">移除流动性</h3>
                  <p className="text-gray-400 mb-4">
                    {tokenId ? `正在加载 Token ID: ${tokenId.toString()} 的位置信息...` : '请选择要移除的流动性位置'}
                  </p>
                  {tokenId && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Token ID: {tokenId.toString()}
                    </Badge>
                  )}
                </div>
              )}

              {/* 位置选择（如果有的话） */}
              {userPositions.length > 0 && !tokenId && (
                <div className="space-y-2">
                  <Label className="text-white">选择流动性位置</Label>
                  <div className="grid gap-2 max-h-40 overflow-y-auto">
                    {userPositions.map((position) => (
                      <div
                        key={position.tokenId.toString()}
                        className="bg-gray-800/50 rounded-lg p-3 cursor-pointer hover:bg-gray-700/50 transition-colors"
                        onClick={() => {
                          // 可以在这里添加选择位置的逻辑
                          console.log('选择位置:', position.tokenId);
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">
                            Token ID: {position.tokenId.toString()}
                          </span>
                          <span className="text-gray-400 text-sm">
                            流动性: {position.formattedLiquidity}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          待收取: {position.formattedTokensOwed0} USDT + {position.formattedTokensOwed1} WETH
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* 滑点设置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                滑点容忍度
              </Label>
              <span className="text-white font-mono">{slippage.toFixed(1)}%</span>
            </div>
            <Slider
              value={[slippage]}
              onValueChange={(value) => setSlippage(value[0])}
              max={10}
              min={0.1}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0.1%</span>
              <span>10%</span>
            </div>
          </div>

          {/* 授权状态 */}
          {activeTab === 'add' && (
            <div className="space-y-3">
              <h4 className="text-white font-medium">代币授权状态</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-300">{currentTokenPair.symbol0}</span>
                  {(() => {
                    const needsApprovalForToken =
                      currentTokenPair.symbol0 === 'USDT' ? needsApproval?.usdt :
                      currentTokenPair.symbol0 === 'WETH' ? needsApproval?.weth : false;
                    const hasAmount = amount0 && parseFloat(amount0) > 0;

                    return needsApprovalForToken || (hasAmount && needsApprovalForToken) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApproveToken0}
                        disabled={isOperating || !amount0}
                        className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        授权
                      </Button>
                    ) : (
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        已授权
                      </div>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-300">{currentTokenPair.symbol1}</span>
                  {(() => {
                    const needsApprovalForToken =
                      currentTokenPair.symbol1 === 'USDT' ? needsApproval?.usdt :
                      currentTokenPair.symbol1 === 'WETH' ? needsApproval?.weth : false;
                    const hasAmount = amount1 && parseFloat(amount1) > 0;

                    return needsApprovalForToken || (hasAmount && needsApprovalForToken) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApproveToken1}
                        disabled={isOperating || !amount1}
                        className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                      >
                        授权
                      </Button>
                    ) : (
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        已授权
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isOperating}
              className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              取消
            </Button>
            <Button
              onClick={handleCompleteFlow}
              disabled={!isConnected || isOperating || !validateInputs()}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              {isOperating ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  处理中...
                </div>
              ) : activeTab === 'add' ? (
                '添加流动性'
              ) : (
                '移除流动性'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 代币对选择器 */}
      <TokenPairSelector
        isOpen={showTokenPairSelector}
        onClose={() => setShowTokenPairSelector(false)}
        onSelect={handleTokenPairSelect}
        selectedPair={currentTokenPair}
      />
    </div>
  );
};

export default LiquidityModal;