import { create } from 'zustand';

interface PythData {
  updateData: string[] | null;
  updateFee: bigint;
  lastUpdated: number; // 时间戳
  isLoading: boolean;
  error: string | null;
}

interface PythStore {
  // 数据状态
  pythData: Record<string, PythData>; // key: symbol, value: PythData

  // 操作方法
  getPythData: (symbol: string) => PythData | undefined;
  setPythData: (symbol: string, updateData: string[], updateFee?: bigint) => void;
  setLoading: (symbol: string, loading: boolean) => void;
  setError: (symbol: string, error: string) => void;
  clearData: (symbol: string) => void;

  // 检查数据是否过期 (5分钟过期)
  isDataExpired: (symbol: string) => boolean;

  // 获取缓存的数据，如果过期则返回 null
  getCachedData: (symbol: string) => string[] | null;
}

export const usePythStore = create<PythStore>((set, get) => ({
  // 初始状态
  pythData: {},

  // 获取 Pyth 数据
  getPythData: (symbol: string) => {
    return get().pythData[symbol];
  },

  // 设置 Pyth 数据
  setPythData: (symbol: string, updateData: string[], updateFee: bigint = 0n) => {
    set((state) => ({
      pythData: {
        ...state.pythData,
        [symbol]: {
          updateData,
          updateFee,
          lastUpdated: Date.now(),
          isLoading: false,
          error: null,
        },
      },
    }));
    console.log(`✅ 缓存 ${symbol} 的 Pyth 数据:`, {
      dataLength: updateData.length,
      updateFee: updateFee.toString(),
      timestamp: Date.now(),
    });
  },

  // 设置加载状态
  setLoading: (symbol: string, loading: boolean) => {
    set((state) => ({
      pythData: {
        ...state.pythData,
        [symbol]: {
          ...state.pythData[symbol],
          isLoading: loading,
          error: loading ? null : state.pythData[symbol]?.error || null,
        },
      },
    }));
  },

  // 设置错误状态
  setError: (symbol: string, error: string) => {
    set((state) => ({
      pythData: {
        ...state.pythData,
        [symbol]: {
          ...state.pythData[symbol],
          isLoading: false,
          error,
        },
      },
    }));
  },

  // 清除数据
  clearData: (symbol: string) => {
    set((state) => {
      const newData = { ...state.pythData };
      delete newData[symbol];
      return { pythData: newData };
    });
  },

  // 检查数据是否过期 (5分钟 = 300000ms)
  isDataExpired: (symbol: string) => {
    const data = get().pythData[symbol];
    if (!data || !data.lastUpdated) return true;

    const now = Date.now();
    const timeDiff = now - data.lastUpdated;
    const isExpired = timeDiff > 300000; // 5分钟过期

    if (isExpired) {
      console.log(`⚠️ ${symbol} 的 Pyth 数据已过期 (${Math.floor(timeDiff / 1000)}秒前)`);
    }

    return isExpired;
  },

  // 获取缓存的数据，如果过期则返回 null
  getCachedData: (symbol: string) => {
    const data = get().pythData[symbol];
    if (!data || get().isDataExpired(symbol)) {
      return null;
    }
    return data.updateData;
  },
}));