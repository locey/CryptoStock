import { useSellStore } from './sellStore';
import { formatUnits, parseUnits } from 'viem';
import { shallow } from 'zustand/shallow';

// ==================== 连接状态 ====================
/**
 * 获取连接状态
 */
export const useSellConnection = () => {
  return useSellStore(
    (state) => ({
      isConnected: state.isConnected,
      address: state.address,
    })
  );
};

// ==================== 代币信息 ====================
/**
 * 获取代币信息
 */
export const useSellToken = () => {
  return useSellStore((state) => state.token);
};

// ==================== 余额信息 ====================
/**
 * 获取余额信息
 */
export const useSellBalances = () => {
  return useSellStore(
    (state) => ({
      balances: state.balances,
      formattedBalances: state.balances ? {
        usdtBalance: state.balances.formatted.usdtBalance,
        tokenBalance: state.balances.formatted.tokenBalance,
      } : {
        usdtBalance: '0',
        tokenBalance: '0',
      },
      lastBalanceUpdate: state.lastBalanceUpdate,
    })
  );
};

// ==================== 卖出参数 ====================
/**
 * 获取卖出参数
 */
export const useSellParams = () => {
  return useSellStore(
    (state) => ({
      sellAmount: state.sellAmount,
      slippage: state.slippage,
    })
  );
};

// ==================== 预估结果 ====================
/**
 * 获取预估结果
 */
export const useSellEstimate = () => {
  return useSellStore((state) => state.estimate);
};

// ==================== 交易状态 ====================
/**
 * 获取交易状态
 */
export const useSellTransaction = () => {
  return useSellStore(
    (state) => ({
      isTransactionPending: state.isTransactionPending,
      currentTransaction: state.currentTransaction,
      sellHistory: state.sellHistory,
    })
  );
};

// ==================== 错误状态 ====================
/**
 * 获取错误状态
 */
export const useSellError = () => {
  return useSellStore(
    (state) => ({
      error: state.error,
      errorCode: state.errorCode,
    })
  );
};

// ==================== 操作方法 ====================
/**
 * 获取操作方法
 */
export const useSellActions = () => {
  return useSellStore((state) => ({
    setConnected: state.setConnected,
    setToken: state.setToken,
    fetchBalances: state.fetchBalances,
    setSellAmount: state.setSellAmount,
    setSlippage: state.setSlippage,
    setEstimate: state.setEstimate,
    getSellEstimate: state.getSellEstimate,
    fetchPriceUpdateData: state.fetchPriceUpdateData,
    executeSellTransaction: state.executeSellTransaction,
    sellToken: state.sellToken,
    clearEstimate: state.clearEstimate,
    setTransactionPending: state.setTransactionPending,
    addTransaction: state.addTransaction,
    clearTransaction: state.clearTransaction,
    setError: state.setError,
    clearError: state.clearError,
    reset: state.reset,
  }));
};

// ==================== 计算属性 ====================
/**
 * 获取是否可以卖出
 */
export const useCanSell = () => {
  return useSellStore((state) => {
    const hasToken = state.token && state.balances && state.balances.tokenBalance > 0n;
    const hasAmount = state.sellAmount && parseFloat(state.sellAmount) > 0;
    const hasEstimate = state.estimate !== null;
    const notPending = !state.isTransactionPending;
    const noError = !state.error;

    return hasToken && hasAmount && hasEstimate && notPending && noError;
  });
};

/**
 * 获取余额是否充足
 */
export const useHasSufficientBalance = () => {
  return useSellStore((state) => {
    if (!state.sellAmount || !state.balances?.tokenBalance) return true;

    const sellAmountWei = parseUnits(state.sellAmount, 18);
    return state.balances.tokenBalance >= sellAmountWei;
  });
};