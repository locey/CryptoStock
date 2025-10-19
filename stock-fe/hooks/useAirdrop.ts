"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { airdropApi, AirdropTaskWithStatus, AirdropApiError } from "@/lib/api/airdrop";

interface UseAirdropOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: Error) => void;
}

interface UseAirdropReturn {
  tasks: AirdropTaskWithStatus[] | null;
  loading: boolean;
  error: string | null;
  claiming: number | null;
  fetching: boolean;

  // Actions
  fetchTasks: () => Promise<void>;
  claimTask: (taskId: number) => Promise<boolean>;
  claimReward: (taskId: number) => Promise<boolean>;
  startAirdrop: (contractAddress: string) => Promise<boolean>;

  // Utilities
  clearError: () => void;
  refresh: () => Promise<void>;
}

export function useAirdrop(options: UseAirdropOptions = {}): UseAirdropReturn {
  const { address, isConnected } = useAccount();
  const [tasks, setTasks] = useState<AirdropTaskWithStatus[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { onSuccess, onError } = options;

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 处理错误
  const handleError = useCallback((err: unknown) => {
    let errorMessage = "未知错误";

    if (err instanceof AirdropApiError) {
      errorMessage = err.message;
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    setError(errorMessage);
    onError?.(err instanceof Error ? err : new Error(errorMessage));
  }, [onError]);

  // 处理成功
  const handleSuccess = useCallback((message: string) => {
    clearError();
    onSuccess?.(message);
  }, [clearError, onSuccess]);

  // 获取任务列表
  const fetchTasks = useCallback(async () => {
    if (!isConnected || !address) {
      setTasks([]);
      return;
    }

    setFetching(true);
    clearError();

    try {
      const response = await airdropApi.getUserTasks(address);
      setTasks(response.data);
    } catch (err) {
      handleError(err);
      setTasks([]);
    } finally {
      setFetching(false);
    }
  }, [address, isConnected, clearError, handleError]);

  // 领取任务
  const claimTask = useCallback(async (taskId: number): Promise<boolean> => {
    if (!isConnected || !address) {
      setError("请先连接钱包");
      return false;
    }

    setClaiming(taskId);
    clearError();

    try {
      await airdropApi.claimTask({
        user_id: address,
        task_id: taskId,
        address: address,
      });

      // 更新本地状态
      setTasks(prev => prev?.map(task =>
        task.id === taskId
          ? { ...task, user_status: "claimed" as const, claimed_at: new Date().toISOString() }
          : task
      ) || null);

      handleSuccess("任务领取成功");
      return true;
    } catch (err) {
      handleError(err);
      return false;
    } finally {
      setClaiming(null);
    }
  }, [address, isConnected, clearError, handleError, handleSuccess]);

  // 领取奖励
  const claimReward = useCallback(async (taskId: number): Promise<boolean> => {
    if (!isConnected || !address) {
      setError("请先连接钱包");
      return false;
    }

    setClaiming(taskId);
    clearError();

    try {
      await airdropApi.claimReward({
        user_id: address,
        task_id: taskId,
        address: address,
      });

      // 更新本地状态
      setTasks(prev => prev?.map(task =>
        task.id === taskId
          ? {
              ...task,
              user_status: "rewarded" as const,
              reward_claimed_at: new Date().toISOString(),
              rewarded_at: new Date().toISOString()
            }
          : task
      ) || null);

      handleSuccess("奖励领取成功");
      return true;
    } catch (err) {
      handleError(err);
      return false;
    } finally {
      setClaiming(null);
    }
  }, [address, isConnected, clearError, handleError, handleSuccess]);

  // 开启空投（管理员功能）
  const startAirdrop = useCallback(async (contractAddress: string): Promise<boolean> => {
    setClaiming(-1); // 使用 -1 表示开启空投的特殊状态
    clearError();

    try {
      await airdropApi.startAirdrop(contractAddress);
      handleSuccess("空投活动已开启");
      return true;
    } catch (err) {
      handleError(err);
      return false;
    } finally {
      setClaiming(null);
    }
  }, [clearError, handleError, handleSuccess]);

  // 刷新数据
  const refresh = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  // 初始化时获取数据
  useState(() => {
    if (isConnected && address) {
      fetchTasks();
    }
  });

  return {
    tasks,
    loading,
    error,
    claiming,
    fetching,

    // Actions
    fetchTasks,
    claimTask,
    claimReward,
    startAirdrop,

    // Utilities
    clearError,
    refresh,
  };
}