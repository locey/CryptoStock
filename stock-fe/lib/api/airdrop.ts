import { Address } from 'viem';

// API 基础配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// 空投任务类型定义
export interface AirdropTask {
  id: number;
  name: string;
  description: string;
  reward_amount: number;
  status: "active" | "completed" | "expired";
  start_date?: string;
  end_date?: string;
  max_participants?: number;
  current_participants?: number;
}

export interface AirdropTaskWithStatus extends AirdropTask {
  user_status?: "claimed" | "completed" | "rewarded" | null;
  proof?: string;
  reward?: string;
  reward_claimed_at?: string;
  claimed_at?: string;
  completed_at?: string;
  rewarded_at?: string;
}

export interface ClaimRequest {
  user_id: string | number;
  task_id: number;
  address: string;
}

export interface ClaimRewardRequest {
  user_id: string | number;
  task_id: number;
  address: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// API 错误类
export class AirdropApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number
  ) {
    super(message);
    this.name = 'AirdropApiError';
  }
}

// 通用请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      throw new AirdropApiError(
        `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const data = await response.json();

    // 处理 API 返回的错误格式
    if (data.code && data.code !== 0) {
      throw new AirdropApiError(
        data.message || 'API request failed',
        response.status,
        data.code
      );
    }

    return data;
  } catch (error) {
    if (error instanceof AirdropApiError) {
      throw error;
    }

    // 网络错误或其他错误
    throw new AirdropApiError(
      error instanceof Error ? error.message : 'Unknown error',
      0
    );
  }
}

// 空投 API 函数
export const airdropApi = {
  // 获取用户的空投任务列表
  async getUserTasks(userId: string | Address): Promise<ApiResponse<AirdropTaskWithStatus[]>> {
    return apiRequest<ApiResponse<AirdropTaskWithStatus[]>>(
      `/api/v1/airdrop/tasks?user_id=${encodeURIComponent(userId)}`
    );
  },

  // 获取所有空投任务
  async getAllTasks(): Promise<ApiResponse<AirdropTask[]>> {
    return apiRequest<ApiResponse<AirdropTask[]>>('/api/v1/airdrop/tasks');
  },

  // 领取任务
  async claimTask(request: ClaimRequest): Promise<ApiResponse<null>> {
    return apiRequest<ApiResponse<null>>('/api/v1/airdrop/claim', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // 领取奖励
  async claimReward(request: ClaimRewardRequest): Promise<ApiResponse<null>> {
    return apiRequest<ApiResponse<null>>('/api/v1/airdrop/claimReward', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // 开启空投（管理员功能）
  async startAirdrop(contractAddress: string): Promise<ApiResponse<null>> {
    return apiRequest<ApiResponse<null>>(
      `/api/v1/airdrop/task/start?address=${encodeURIComponent(contractAddress)}`,
      {
        method: 'POST',
      }
    );
  },

  // 获取空投统计信息
  async getAirdropStats(): Promise<ApiResponse<{
    total_users: number;
    total_invites: number;
    total_airdropped: string;
    active_users: number;
  }>> {
    return apiRequest<ApiResponse<{
      total_users: number;
      total_invites: number;
      total_airdropped: string;
      active_users: number;
    }>>('/api/v1/airdrop/stats');
  },
};

// React Query hooks
export const useAirdropTasks = (userId: string | Address | undefined) => {
  return {
    queryKey: ['airdrop-tasks', userId],
    queryFn: () => userId ? airdropApi.getUserTasks(userId) : Promise.resolve({ code: 0, message: 'success', data: [] }),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  };
};

export const useAirdropStats = () => {
  return {
    queryKey: ['airdrop-stats'],
    queryFn: () => airdropApi.getAirdropStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  };
};