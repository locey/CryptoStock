/**
 * Curve 主要 Hook
 * 提供简化的 Curve 功能接口
 */

import { useCurveWithClients } from './useCurveWithClients';
import { CurveOperationType } from '../stores/useCurveStore';

// 主要的 Curve Hook - 提供简化的 API
export const useCurve = () => {
  const curveWithClients = useCurveWithClients();

  return {
    // 基础状态
    isConnected: curveWithClients.isConnected,
    address: curveWithClients.address,

    // 合约信息
    defiAggregatorAddress: curveWithClients.defiAggregatorAddress,
    curveAdapterAddress: curveWithClients.curveAdapterAddress,
    poolInfo: curveWithClients.poolInfo,

    // 用户余额信息
    userBalance: curveWithClients.userBalance,
    formattedBalances: curveWithClients.formattedBalances,
    needsApproval: curveWithClients.needsApproval,
    maxBalances: curveWithClients.maxBalances,

    // 状态
    isLoading: curveWithClients.isLoading,
    isOperating: curveWithClients.isOperating,
    error: curveWithClients.error,

    // 初始化
    initializeCurveTrading: curveWithClients.initializeCurveTrading,
    refreshUserInfo: curveWithClients.refreshUserInfo,

    // 读取方法
    fetchPoolInfo: curveWithClients.fetchPoolInfo,
    fetchUserBalance: curveWithClients.fetchUserBalance,
    fetchAllowances: curveWithClients.fetchAllowances,
    previewAddLiquidity: curveWithClients.previewAddLiquidity,
    previewRemoveLiquidity: curveWithClients.previewRemoveLiquidity,

    // 授权方法
    approveUSDC: curveWithClients.approveUSDC,
    approveUSDT: curveWithClients.approveUSDT,
    approveDAI: curveWithClients.approveDAI,
    approveLPToken: curveWithClients.approveLPToken,

    // 交易方法
    addLiquidity: curveWithClients.addLiquidity,
    removeLiquidity: curveWithClients.removeLiquidity,

    // 错误处理
    setError: curveWithClients.setError,
    clearErrors: curveWithClients.clearErrors,
    reset: curveWithClients.reset,
  };
};

// 便捷的 Hook exports
export const useCurveTokens = () => {
  const {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    approveUSDC,
    approveUSDT,
    approveDAI,
    approveLPToken,
    fetchUserBalance,
    fetchAllowances,
  } = useCurve();

  return {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    approveUSDC,
    approveUSDT,
    approveDAI,
    approveLPToken,
    fetchUserBalance,
    fetchAllowances,
  };
};

export const useCurveOperations = () => {
  const {
    isOperating,
    error,
    addLiquidity,
    removeLiquidity,
    approveUSDC,
    approveUSDT,
    approveDAI,
    approveLPToken,
    initializeCurveTrading,
    refreshUserInfo,
    setError,
    clearErrors,
  } = useCurve();

  return {
    isOperating,
    error,
    addLiquidity,
    removeLiquidity,
    approveUSDC,
    approveUSDT,
    approveDAI,
    approveLPToken,
    initializeCurveTrading,
    refreshUserInfo,
    setError,
    clearErrors,
  };
};

export const useCurvePool = () => {
  const {
    poolInfo,
    fetchPoolInfo,
    previewAddLiquidity,
    previewRemoveLiquidity,
    setError,
    clearErrors,
  } = useCurve();

  return {
    poolInfo,
    fetchPoolInfo,
    previewAddLiquidity,
    previewRemoveLiquidity,
    setError,
    clearErrors,
  };
};

export const useCurveUI = () => {
  const {
    poolInfo,
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    setError,
    clearErrors,
  } = useCurve();

  return {
    poolInfo,
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    setError,
    clearErrors,
  };
};

// 操作类型常量
export { CurveOperationType };

export default useCurve;