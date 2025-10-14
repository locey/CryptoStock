"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Check,
  Wallet,
  Zap,
  Shield,
} from "lucide-react";
import { useYearnV3WithClients } from "@/lib/hooks/useYearnV3WithClients";

interface YearnV3DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

/**
 * YearnV3 存款弹窗
 *
 * 功能：
 * 1. 连接钱包检查
 * 2. 余额查询和显示
 * 3. 授权状态检查
 * 4. USDT 存入到 YearnV3 Vault
 * 5. 预览存款收益pools
 * 6. 交易状态反馈
 */
export default function YearnV3DepositModal({
  isOpen,
  onClose,
  onSuccess,
}: YearnV3DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"input" | "approve" | "deposit" | "success">(
    "input"
  );
  const [txHash, setTxHash] = useState<string>("");
  const [previewData, setPreviewData] = useState<{
    shares: string;
    formattedShares: string;
  } | null>(null);

  const {
    isConnected,
    address,
    isLoading,
    isOperating,
    error,
    formattedBalances,
    needsApproval,
    maxBalances,
    initializeYearnV3,
    refreshUserInfo,
    approveUSDT,
    deposit,
    previewDeposit,
    clearError,
  } = useYearnV3WithClients();

  // 初始化 - 添加清理函数防止内存泄漏
  useEffect(() => {
    let isMounted = true;
    let controller = new AbortController();

    if (isOpen && isConnected) {
      const initializeAndRefresh = async () => {
        try {
          if (!controller.signal.aborted && isMounted) {
            await initializeYearnV3();
          }
          if (!controller.signal.aborted && isMounted) {
            await refreshUserInfo();
          }
        } catch (error) {
          if (!controller.signal.aborted && isMounted) {
            console.error("YearnV3 初始化失败:", error);
          }
        }
      };

      initializeAndRefresh();
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, isConnected]);

  // 重置状态
  const resetModal = () => {
    setAmount("");
    setStep("input");
    setTxHash("");
    setPreviewData(null);
    clearError();
  };

  // 关闭弹窗
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // 格式化份额显示 - 使小份额数字更易读
  const formatShares = (sharesStr: string): string => {
    const shares = parseFloat(sharesStr);
    if (shares === 0) return "0";

    // 对于很小的份额，使用更高的精度显示，避免显示过多无意义的小数位
    if (shares < 0.0001) {
      // 使用科学记数法或固定6位小数，但避免显示过多的小数位
      if (shares < 0.000001) {
        return shares.toExponential(3);
      }
      return shares.toFixed(8).replace(/\.?0+$/, "");
    }

    // 如果份额小于 0.01，使用 6 位小数
    if (shares < 0.01) {
      return shares.toFixed(6).replace(/\.?0+$/, "");
    }

    // 否则使用合适的精度
    return shares.toFixed(4).replace(/\.?0+$/, "");
  };

  // 输入验证
  const validateAmount = (value: string): boolean => {
    if (!value || parseFloat(value) <= 0) return false;
    const maxAmount = parseFloat(maxBalances.maxUSDTToDeposit);
    return parseFloat(value) <= maxAmount;
  };

  // 处理金额输入 - 添加防抖优化
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 只允许数字和小数点，最多6位小数（USDT精度）
    if (/^\d*\.?\d{0,6}$/.test(value) || value === "") {
      setAmount(value);

      // 如果金额有效，预览存款收益
      if (validateAmount(value)) {
        // 防抖：只在用户停止输入一段时间后再触发预览
        const timeoutId = setTimeout(async () => {
          try {
            const preview = await previewDeposit(value);
            if (preview.success && preview.data) {
              setPreviewData({
                shares: preview.data.shares.toString(),
                formattedShares: preview.data.formattedShares,
              });
            }
          } catch (error) {
            console.error("预览失败:", error);
            setPreviewData(null);
          }
        }, 300);

        // 清除之前的防抖
        return () => clearTimeout(timeoutId);
      } else {
        setPreviewData(null);
      }
    }
  };

  // 设置最大金额
  const handleMaxAmount = () => {
    setAmount(maxBalances.maxUSDTToDeposit);
  };

  // 处理授权
  const handleApprove = async () => {
    if (!validateAmount(amount)) return;

    try {
      setStep("approve");
      await approveUSDT(amount);

      // 授权成功后刷新余额信息
      await refreshUserInfo();

      // 自动进入存款步骤
      setStep("deposit");

      // 自动执行存款逻辑
      await handleDeposit();
    } catch (error) {
      console.error("授权失败:", error);
      setStep("input");
    }
  };

  // 处理存款
  const handleDeposit = async () => {
    if (!validateAmount(amount)) return;

    try {
      // 如果不是从授权步骤来的，设置步骤为 deposit
      if (step !== "deposit") {
        setStep("deposit");
      }

      const result = await deposit(amount);
      setTxHash(result.hash || "");
      setStep("success");

      // 刷新余额
      await refreshUserInfo();

      // 成功回调
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error("存款失败:", error);
      setStep("input");
    }
  };

  // 处理确认操作
  const handleConfirm = async () => {
    if (!isConnected) return;

    // 需要先授权 USDT
    if (needsApproval.usdt) {
      await handleApprove();
    } else {
      await handleDeposit();
    }
  };

  // 如果弹窗未打开，返回 null
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md mx-4 relative">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title={isOperating ? "操作进行中，请稍候" : "关闭弹窗"}
        >
          <X
            className={`w-5 h-5 ${
              isOperating
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-400 hover:text-white"
            } transition-colors`}
          />
        </button>

        {/* 标题 */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">存入 YearnV3</h2>
              <p className="text-sm text-gray-400">自动化收益聚合器</p>
            </div>
          </div>

          {/* 钱包连接状态 */}
          {!isConnected && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-yellow-400">
                <Wallet className="w-4 h-4" />
                <span className="text-sm">请先连接钱包</span>
              </div>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* 步骤指示器 */}
          <div className="flex items-center gap-2 mb-6">
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                step === "input"
                  ? "bg-yellow-500"
                  : step === "approve"
                  ? "bg-orange-500"
                  : step === "deposit"
                  ? "bg-blue-500"
                  : "bg-green-500"
              }`}
            />
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                step === "approve" || step === "deposit" || step === "success"
                  ? "bg-orange-500"
                  : "bg-gray-700"
              }`}
            />
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                step === "deposit" || step === "success"
                  ? "bg-blue-500"
                  : "bg-gray-700"
              }`}
            />
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                step === "success" ? "bg-green-500" : "bg-gray-700"
              }`}
            />
          </div>

          {/* 输入步骤 */}
          {step === "input" && (
            <div className="space-y-4">
              {/* 投资信息卡片 */}
              <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">TVL</p>
                    <p className="text-lg font-bold text-white">$45.2M</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">预估年化收益</p>
                    <p className="text-lg font-bold text-green-400">~15.8%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-1">风险等级</p>
                    <p className="text-lg font-bold text-yellow-400">低风险</p>
                  </div>
                </div>
              </div>

              {/* 余额显示 */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">可用余额</span>
                  <span className="text-sm font-semibold text-white">
                    {formattedBalances.usdtBalance} USDT
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">已存入金额</span>
                  <span className="text-sm font-semibold text-blue-400">
                    ${formattedBalances.depositedAmount || "0"}
                  </span>
                </div>
              </div>

              {/* 输入框 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  存入数量
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0.00"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                    disabled={!isConnected || isLoading}
                  />
                  <button
                    onClick={handleMaxAmount}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30 transition-colors"
                    disabled={!isConnected}
                  >
                    MAX
                  </button>
                </div>
                {amount && !validateAmount(amount) && (
                  <p className="text-red-400 text-xs mt-1">请输入有效的金额</p>
                )}
              </div>

              {/* 预览收益 */}
              {amount && validateAmount(amount) && previewData && (
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">存入金额</span>
                    <span className="text-white">{amount} USDT</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">预期获得份额</span>
                    <div className="text-right">
                      <span className="text-yellow-400">
                        {formatShares(previewData.formattedShares)} yvUSDT
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        约等于 {amount} USDT 价值
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">预估每日收益</span>
                    <span className="text-green-400">
                      {((parseFloat(amount) * 0.158) / 365).toFixed(4)} USDT
                    </span>
                  </div>
                  <div className="border-t border-gray-700 pt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-300">
                        优势特点
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                        自动复投
                      </span>
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                        低风险
                      </span>
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                        稳定收益
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 确认按钮 */}
              <button
                onClick={handleConfirm}
                disabled={
                  !isConnected || !validateAmount(amount) || isOperating
                }
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isOperating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>{needsApproval.usdt ? "授权并存入" : "确认存入"}</>
                )}
              </button>
            </div>
          )}

          {/* 授权步骤 */}
          {step === "approve" && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  授权中
                </h3>
                <p className="text-sm text-gray-400">
                  正在授权 {amount} USDT 给 YearnV3 合约
                </p>
              </div>
            </div>
          )}

          {/* 存款步骤 */}
          {step === "deposit" && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  存入中
                </h3>
                <p className="text-sm text-gray-400">
                  正在存入 {amount} USDT 到 YearnV3 Vault
                </p>
                {previewData && (
                  <p className="text-sm text-yellow-400 mt-2">
                    预期获得 {formatShares(previewData.formattedShares)} yvUSDT
                    份额
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 成功步骤 */}
          {step === "success" && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  存入成功！
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  成功存入 {amount} USDT 到 YearnV3
                </p>
                {previewData && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-400 mb-1">获得份额</p>
                    <p className="text-lg font-bold text-yellow-400">
                      {formatShares(previewData.formattedShares)} yvUSDT
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      价值 {amount} USDT
                    </p>
                  </div>
                )}

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

              {/* 特点说明 */}
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">
                    YearnV3 优势
                  </span>
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>• 自动化收益优化策略</p>
                  <p>• 低风险稳定收益</p>
                  <p>• 智能金库管理</p>
                  <p>• 随时灵活取款</p>
                </div>
              </div>

              {/* 完成按钮 */}
              <button
                onClick={handleClose}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all"
              >
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
