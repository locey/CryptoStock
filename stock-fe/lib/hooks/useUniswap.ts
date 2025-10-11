/**
 * Uniswap V3 主要 Hook
 * 提供简化的 Uniswap V3 功能接口
 */

import { useUniswapWithClients } from './useUniswapWithClients';
import { UniswapOperationType } from '../stores/useUniswapStore';

// 主要的 Uniswap Hook - 提供简化的 API
export const useUniswap = () => {
  const uniswapWithClients = useUniswapWithClients();

  // 调试日志：监控 useUniswapWithClients 的数据
  console.log('🔍 [DEBUG] useUniswap - from useUniswapWithClients:', {
    userPositionsLength: uniswapWithClients.userPositions.length,
    userPositions: uniswapWithClients.userPositions,
    isConnected: uniswapWithClients.isConnected,
    isLoading: uniswapWithClients.isLoading,
    timestamp: new Date().toISOString()
  });

  return {
    // 基础状态
    isConnected: uniswapWithClients.isConnected,
    address: uniswapWithClients.address,

    // 合约信息
    defiAggregatorAddress: uniswapWithClients.defiAggregatorAddress,
    uniswapV3AdapterAddress: uniswapWithClients.uniswapV3AdapterAddress,
    poolInfo: uniswapWithClients.poolInfo,

    // 用户余额信息
    userBalance: uniswapWithClients.userBalance,
    formattedBalances: uniswapWithClients.formattedBalances,
    needsApproval: uniswapWithClients.needsApproval,
    maxBalances: uniswapWithClients.maxBalances,

    // 用户位置信息
    userPositions: uniswapWithClients.userPositions,
    selectedPosition: uniswapWithClients.selectedPosition,
    formattedPositions: uniswapWithClients.formattedPositions,
    totalTVL: uniswapWithClients.totalTVL,
    totalFees: uniswapWithClients.totalFees,

    // 状态
    isLoading: uniswapWithClients.isLoading,
    isOperating: uniswapWithClients.isOperating,
    error: uniswapWithClients.error,

    // 初始化
    initializeUniswapTrading: uniswapWithClients.initializeUniswapTrading,
    refreshUserInfo: uniswapWithClients.refreshUserInfo,

    // 读取方法
    fetchPoolInfo: uniswapWithClients.fetchPoolInfo,
    fetchUserBalance: uniswapWithClients.fetchUserBalance,
    fetchUserPositions: uniswapWithClients.fetchUserPositions,
    fetchUserUSDTBalance: uniswapWithClients.fetchUserUSDTBalance,
    fetchUserWETHBalance: uniswapWithClients.fetchUserWETHBalance,
    fetchAllowances: uniswapWithClients.fetchAllowances,
    fetchFeeRate: uniswapWithClients.fetchFeeRate,

    // 授权方法
    approveUSDT: uniswapWithClients.approveUSDT,
    approveWETH: uniswapWithClients.approveWETH,
    approveNFT: uniswapWithClients.approveNFT,
    approveAllNFT: uniswapWithClients.approveAllNFT,

    // 交易方法
    addLiquidity: uniswapWithClients.addLiquidity,
    removeLiquidity: uniswapWithClients.removeLiquidity,
    collectFees: uniswapWithClients.collectFees,

    // 位置管理
    selectPosition: uniswapWithClients.selectPosition,

    // 错误处理
    setError: uniswapWithClients.setError,
    clearErrors: uniswapWithClients.clearErrors,
    reset: uniswapWithClients.reset,
  };
};

// 便捷的 Hook exports
export const useUniswapTokens = () => {
  const {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    approveUSDT,
    approveWETH,
    approveAllNFT,
    fetchUserUSDTBalance,
    fetchUserWETHBalance,
    fetchAllowances,
  } = useUniswap();

  return {
    userBalance,
    formattedBalances,
    needsApproval,
    maxBalances,
    approveUSDT,
    approveWETH,
    approveAllNFT,
    fetchUserUSDTBalance,
    fetchUserWETHBalance,
    fetchAllowances,
  };
};

export const useUniswapPositions = () => {
  const uniswapData = useUniswap();

  // 调试日志：监控 useUniswap 返回的完整数据
  console.log('🔍 [DEBUG] useUniswapPositions - useUniswap 完整数据:', {
    userPositionsLength: uniswapData.userPositions.length,
    userPositions: uniswapData.userPositions,
    isConnected: uniswapData.isConnected,
    isLoading: uniswapData.isLoading,
    timestamp: new Date().toISOString()
  });

  const {
    userPositions,
    selectedPosition,
    formattedPositions,
    totalTVL,
    totalFees,
    fetchUserPositions,
    selectPosition,
  } = uniswapData;

  // 调试日志：监控 userPositions 变化
  console.log('🔍 [DEBUG] useUniswapPositions - 解构后的 userPositions:', {
    length: userPositions.length,
    positions: userPositions,
    timestamp: new Date().toISOString()
  });

  return {
    userPositions,
    selectedPosition,
    formattedPositions,
    totalTVL,
    totalFees,
    fetchUserPositions,
    selectPosition,
  };
};

export const useUniswapOperations = () => {
  const {
    isOperating,
    error,
    addLiquidity,
    removeLiquidity,
    collectFees,
    approveUSDT,
    approveWETH,
    approveNFT,
    approveAllNFT,
    initializeUniswapTrading,
    refreshUserInfo,
  } = useUniswap();

  return {
    isOperating,
    error,
    addLiquidity,
    removeLiquidity,
    collectFees,
    approveUSDT,
    approveWETH,
    approveNFT,
    approveAllNFT,
    initializeUniswapTrading,
    refreshUserInfo,
  };
};

export const useUniswapUI = () => {
  const {
    poolInfo,
    selectedPosition,
    selectPosition,
    setError,
    clearErrors,
  } = useUniswap();

  return {
    poolInfo,
    selectedPosition,
    selectPosition,
    setError,
    clearErrors,
  };
};

// 操作类型常量
export { UniswapOperationType };

export default useUniswap;