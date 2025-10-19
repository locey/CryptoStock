"use client";

import React, { useState, useEffect } from 'react';
import { useAirdrop } from '@/hooks/useAirdrop';
import { AirdropTask, CreateTaskRequest, UpdateTaskRequest } from '@/lib/api/airdrop';
import { useToast } from '@/hooks/use-toast';

interface AirdropTaskManagerProps {
  isAdmin?: boolean;
}

export function AirdropTaskManager({ isAdmin = false }: AirdropTaskManagerProps) {
  const { toast } = useToast();

  const {
    allTasks,
    loading,
    error,
    fetching,
    creating,
    updating,
    deleting,
    fetchAllTasks,
    createTask,
    updateTask,
    deleteTask,
    clearError
  } = useAirdrop({
    onSuccess: (message) => {
      toast({
        title: "操作成功",
        description: message,
      });
    },
    onError: (error) => {
      toast({
        title: "操作失败",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<AirdropTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (isAdmin) {
      fetchAllTasks();
    }
  }, [isAdmin]); // 移除 fetchAllTasks 依赖

  useEffect(() => {
    fetchAllTasks(statusFilter || undefined);
  }, [statusFilter]); // 移除 fetchAllTasks 依赖

  const handleCreateTask = async (taskData: CreateTaskRequest) => {
    const success = await createTask(taskData);
    if (success) {
      setShowCreateForm(false);
    }
  };

  const handleUpdateTask = async (taskId: number, updateData: UpdateTaskRequest) => {
    const success = await updateTask(taskId, updateData);
    if (success) {
      setEditingTask(null);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('确定要删除这个任务吗？此操作不可撤销。')) {
      return;
    }

    await deleteTask(taskId);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 text-white';
      case 'completed':
        return 'bg-blue-500 text-white';
      case 'expired':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'expired':
        return '已过期';
      default:
        return status;
    }
  };

  const getLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'easy':
        return '简单';
      case 'medium':
        return '中等';
      case 'hard':
        return '困难';
      default:
        return level || '中等';
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">您没有权限访问任务管理功能</p>
      </div>
    );
  }

  return (
    <div className="crypto-card p-6">
      {/* 头部 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">空投任务管理</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          创建新任务
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-500 bg-opacity-10 border border-red-500 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            状态筛选
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全部状态</option>
            <option value="active">进行中</option>
            <option value="completed">已完成</option>
            <option value="expired">已过期</option>
          </select>
        </div>
      </div>

      {/* 任务列表 */}
      {fetching ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <p className="mt-2 text-gray-400">加载中...</p>
        </div>
      ) : allTasks && allTasks.length > 0 ? (
        <div className="space-y-4">
          {allTasks.map((task) => (
            <div key={task.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{task.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getLevelBadgeClass(task.level)}`}>
                      {getLevelText(task.level)}
                    </span>
                  </div>

                  <p className="text-gray-300 mb-3">{task.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">奖励:</span>
                      <span className="ml-2 text-yellow-400">{task.reward_amount} tokens</span>
                    </div>
                    <div>
                      <span className="text-gray-400">类型:</span>
                      <span className="ml-2 text-white">{task.task_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">开始时间:</span>
                      <span className="ml-2 text-white">
                        {task.start_time ? new Date(task.start_time).toLocaleDateString('zh-CN') : '立即开始'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">结束时间:</span>
                      <span className="ml-2 text-white">
                        {task.end_time ? new Date(task.end_time).toLocaleDateString('zh-CN') : '无限制'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setEditingTask(task)}
                    disabled={updating === task.id}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    {updating === task.id ? '更新中...' : '编辑'}
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    disabled={deleting === task.id}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    {deleting === task.id ? '删除中...' : '删除'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-400">暂无任务数据</p>
        </div>
      )}

      {/* 创建任务表单弹窗 */}
      {showCreateForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={() => setShowCreateForm(false)}
          loading={creating}
        />
      )}

      {/* 编辑任务表单弹窗 */}
      {editingTask && (
        <TaskForm
          task={editingTask}
          onSubmit={(data) => handleUpdateTask(editingTask.id, data)}
          onCancel={() => setEditingTask(null)}
          loading={updating === editingTask.id}
          isEdit
        />
      )}
    </div>
  );
}

interface TaskFormProps {
  task?: AirdropTask;
  onSubmit: (data: CreateTaskRequest | UpdateTaskRequest) => void;
  onCancel: () => void;
  loading: boolean;
  isEdit?: boolean;
}

function TaskForm({ task, onSubmit, onCancel, loading, isEdit = false }: TaskFormProps) {
  const [formData, setFormData] = useState({
    name: task?.name || '',
    description: task?.description || '',
    reward_amount: task?.reward_amount || 0,
    task_type: task?.task_type || 'social',
    level: task?.level || 'medium',
    start_time: task?.start_time ? new Date(task.start_time).toISOString().slice(0, 16) : '',
    end_time: task?.end_time ? new Date(task.end_time).toISOString().slice(0, 16) : '',
    status: task?.status || 'active'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submitData: CreateTaskRequest | UpdateTaskRequest = {
      name: formData.name,
      description: formData.description,
      reward_amount: formData.reward_amount,
      task_type: formData.task_type,
      level: formData.level,
      start_time: formData.start_time ? new Date(formData.start_time).toISOString() : undefined,
      end_time: formData.end_time ? new Date(formData.end_time).toISOString() : undefined,
    };

    if (isEdit) {
      (submitData as UpdateTaskRequest).status = formData.status as any;
    }

    onSubmit(submitData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-white mb-4">
          {isEdit ? '编辑任务' : '创建新任务'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              任务名称 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              任务描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                奖励数量 *
              </label>
              <input
                type="number"
                value={formData.reward_amount}
                onChange={(e) => handleChange('reward_amount', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                min="0.00000001"
                step="0.00000001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                任务类型 *
              </label>
              <select
                value={formData.task_type}
                onChange={(e) => handleChange('task_type', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="social">社交任务</option>
                <option value="trading">交易任务</option>
                <option value="referral">推荐任务</option>
                <option value="other">其他任务</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                难度等级
              </label>
              <select
                value={formData.level}
                onChange={(e) => handleChange('level', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">困难</option>
              </select>
            </div>

            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  任务状态
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="active">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="expired">已过期</option>
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                开始时间
              </label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => handleChange('start_time', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                结束时间
              </label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => handleChange('end_time', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '处理中...' : (isEdit ? '更新任务' : '创建任务')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}