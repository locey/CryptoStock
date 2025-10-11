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
  X
} from 'lucide-react';
import { useUniswap, useUniswapTokens, useUniswapOperations } from '@/lib/hooks/useUniswap';

interface LiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation?: 'add' | 'remove';
  tokenId?: bigint;
}

export const LiquidityModal: React.FC<LiquidityModalProps> = ({
  isOpen,
  onClose,
  operation = 'add',
  tokenId
}) => {
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

  // 🔧 临时修复：暂时禁用滑点计算，直接使用原始金额
  const calculateMinAmount = (amount: string, slippagePercent: number) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return '0';
    // 🔧 暂时禁用滑点：返回原始金额
    return amountNum.toString();
  };

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

  // 授权代币 - 修复代币标识
  const handleApproveUSDT = useCallback(async () => {
    try {
      await approveUSDT(amount0); // amount0 现在是 USDT 金额
    } catch (error) {
      console.error('USDT 授权失败:', error);
    }
  }, [approveUSDT, amount0]);

  const handleApproveWETH = useCallback(async () => {
    try {
      await approveWETH(amount1); // amount1 现在是 WETH 金额 (1000)
    } catch (error) {
      console.error('WETH 授权失败:', error);
    }
  }, [approveWETH, amount1]);

  // 添加流动性
  const handleAddLiquidity = useCallback(async () => {
    if (!validateInputs()) return;

    try {
      const result = await addLiquidity({
        token0: '0x6a1B8536678C42cacf9e2C6502bffe288c84C8bA', // WETH 地址 (第一项)
        token1: '0xd7C597Cf30fb56162AEDAe8a52927B7CE4076e5B', // USDT 地址 (第二项)
        amount1, // WETH 金额 (1000)
        amount0, // USDT 金额 (10)
        amount1Min: calculateMinAmount(amount1, slippage), // WETH 最小金额
        amount0Min: calculateMinAmount(amount0, slippage), // USDT 最小金额
        tickLower,
        tickUpper,
      });

      console.log('✅ 添加流动性成功:', result.hash);
      onClose();
      await refreshUserInfo();
    } catch (error) {
      console.error('❌ 添加流动性失败:', error);
    }
  }, [amount0, amount1, tickLower, tickUpper, slippage, addLiquidity, onClose, refreshUserInfo]);

  // 移除流动性
  const handleRemoveLiquidity = useCallback(async () => {
    if (!tokenId) return;

    try {
      const result = await removeLiquidity({
        tokenId,
        amount0Min: calculateMinAmount(amount0, slippage),
        amount1Min: calculateMinAmount(amount1, slippage),
      });

      console.log('✅ 移除流动性成功:', result.hash);
      onClose();
      await refreshUserInfo();
    } catch (error) {
      console.error('❌ 移除流动性失败:', error);
    }
  }, [tokenId, amount0, amount1, slippage, removeLiquidity, onClose, refreshUserInfo]);

  // 完整流程（自动授权 + 操作）
  const handleCompleteFlow = useCallback(async () => {
    if (!isConnected) return;

    // 自动初始化
    await handleInitialize();

    if (activeTab === 'add') {
      // 检查并执行授权
      if (needsApproval.usdt && amount0) {
        await handleApproveUSDT();
      }
      if (needsApproval.weth && amount1) {
        await handleApproveWETH();
      }

      // 执行添加流动性
      await handleAddLiquidity();
    } else {
      // 执行移除流动性
      await handleRemoveLiquidity();
    }
  }, [isConnected, activeTab, needsApproval, amount0, amount1, handleInitialize, handleApproveUSDT, handleApproveWETH, handleAddLiquidity, handleRemoveLiquidity]);

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
              {/* 代币输入区域 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usdt-amount" className="text-white">USDT 数量</Label>
                  <Input
                    id="usdt-amount"
                    type="number"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    placeholder="0.0"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">可用余额</span>
                    <span className="text-white">{formattedBalances?.usdtBalance || '0'} USDT</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weth-amount" className="text-white">WETH 数量</Label>
                  <Input
                    id="weth-amount"
                    type="number"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    placeholder="0.0"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-400"
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">可用余额</span>
                    <span className="text-white">{formattedBalances?.wethBalance || '0'} WETH</span>
                  </div>
                </div>
              </div>

              {/* 快捷填充按钮 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount0(formattedBalances?.usdtBalance || '0')}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  最大 USDT
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount1(formattedBalances?.wethBalance || '0')}
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  最大 WETH
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
              <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                <div className="text-6xl mb-4">🦄</div>
                <h3 className="text-lg font-semibold text-white mb-2">移除流动性</h3>
                <p className="text-gray-400 mb-4">
                  选择要移除的流动性位置，系统将自动计算可提取的代币数量
                </p>
                {tokenId && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    Token ID: {tokenId.toString()}
                  </Badge>
                )}
              </div>

              {/* 位置选择（如果有的话） */}
              {false && (
                <div className="space-y-2">
                  <Label className="text-white">选择位置</Label>
                  <div className="grid gap-2">
                    {/* 这里应该渲染用户的位置列表 */}
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
                  <span className="text-gray-300">USDT</span>
                  {needsApproval?.usdt ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApproveUSDT}
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
                  )}
                </div>
                <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-300">WETH</span>
                  {needsApproval?.weth ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApproveWETH}
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
                  )}
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
    </div>
  );
};

export default LiquidityModal;