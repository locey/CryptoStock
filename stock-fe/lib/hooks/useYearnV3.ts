/**
 * YearnV3 主要 Hook
 * 提供简化的 YearnV3 功能接口
 */

import { useYearnV3WithClients } from './useYearnV3WithClients';
import { YearnV3OperationType } from '../stores/useYearnV3Store';

// 主要的 YearnV3 Hook - 提供简化的 API
export const useYearnV3 = () => {
  const yearnV3WithClients = useYearnV3WithClients();

  return {
    // 基础状态
    isConnected: yearnV3WithClients.isConnected,
    address: yearnV3WithClients.address,
    isLoading: yearnV3WithClients.isLoading,
    isOperating: yearnV3WithClients.isOperating,
    error: yearnV3WithClients.error,

    // 合约信息
    defiAggregatorAddress: yearnV3WithClients.defiAggregatorAddress,
    yearnV3AdapterAddress: yearnV3WithClients.yearnV3AdapterAddress,
    yearnVaultAddress: yearnV3WithClients.yearnVaultAddress,
    usdtTokenAddress: yearnV3WithClients.usdtTokenAddress,

    // 用户余额信息
    userBalance: yearnV3WithClients.userBalance,
    formattedBalances: yearnV3WithClients.formattedBalances,

    // 授权检查
    needsApproval: yearnV3WithClients.needsApproval,
    maxBalances: yearnV3WithClients.maxBalances,

    // 初始化方法
    initializeYearnV3: yearnV3WithClients.initializeYearnV3,
    refreshUserInfo: yearnV3WithClients.refreshUserInfo,

    // 读取方法
    fetchUserBalance: yearnV3WithClients.fetchUserBalance,
    fetchAllowances: yearnV3WithClients.fetchAllowances,
    getUserCurrentValue: yearnV3WithClients.getUserCurrentValue,
    previewDeposit: yearnV3WithClients.previewDeposit,
    previewWithdraw: yearnV3WithClients.previewWithdraw,

    // 操作方法
    approveUSDT: yearnV3WithClients.approveUSDT,
    approveShares: yearnV3WithClients.approveShares,
    deposit: yearnV3WithClients.deposit,
    withdraw: yearnV3WithClients.withdraw,

    // 辅助方法
    setError: yearnV3WithClients.setError,
    clearError: yearnV3WithClients.clearError,
    reset: yearnV3WithClients.reset,
  };
};

// 便捷的 Hook exports
export const useYearnV3Tokens = () => {
  const {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    approveUSDT,
    approveShares,
    fetchUserBalance,
    fetchAllowances,
  } = useYearnV3();

  return {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    approveUSDT,
    approveShares,
    fetchUserBalance,
    fetchAllowances,
  };
};

export const useYearnV3Operations = () => {
  const {
    isOperating,
    error,
    deposit,
    withdraw,
    approveUSDT,
    approveShares,
    initializeYearnV3,
    refreshUserInfo,
    setError,
    clearError,
  } = useYearnV3();

  return {
    isOperating,
    error,
    deposit,
    withdraw,
    approveUSDT,
    approveShares,
    initializeYearnV3,
    refreshUserInfo,
    setError,
    clearError,
  };
};

export const useYearnV3UserInfo = () => {
  const {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    fetchUserBalance,
    fetchAllowances,
    getUserCurrentValue,
    refreshUserInfo,
  } = useYearnV3();

  return {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    fetchUserBalance,
    fetchAllowances,
    getUserCurrentValue,
    refreshUserInfo,
  };
};

export const useYearnV3Preview = () => {
  const {
    previewDeposit,
    previewWithdraw,
    userBalance,
    formattedBalances,
  } = useYearnV3();

  return {
    previewDeposit,
    previewWithdraw,
    userBalance,
    formattedBalances,
  };
};

// 操作类型常量
export { YearnV3OperationType };

export default useYearnV3;