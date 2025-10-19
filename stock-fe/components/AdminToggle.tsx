"use client";

import React, { useState } from 'react';
import { AirdropTaskManager } from './AirdropTaskManager';
import { ADMIN_PASSWORD, logAdminAction } from '@/lib/admin';
import { useToast } from '@/hooks/use-toast';

export function AdminToggle() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const { toast } = useToast();

  // 管理员验证
  const handleAdminLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPasswordInput(false);
      setPassword('');
      logAdminAction('ADMIN_LOGIN', undefined, { method: 'password' });
      toast({
        title: "登录成功",
        description: "管理员权限已开启",
      });
    } else {
      logAdminAction('ADMIN_LOGIN_FAILED', undefined, { reason: 'wrong_password' });
      toast({
        title: "登录失败",
        description: "密码错误",
        variant: "destructive",
      });
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    logAdminAction('ADMIN_LOGOUT', undefined, {});
    toast({
      title: "已退出",
      description: "管理员权限已关闭",
    });
  };

  if (isAdmin) {
    return (
      <div className="space-y-6">
        {/* 管理员状态栏 */}
        <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">🔑</span>
              <span className="text-yellow-400 font-medium">管理员模式已启用</span>
            </div>
            <button
              onClick={handleAdminLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              退出管理员
            </button>
          </div>
        </div>

        {/* 任务管理组件 */}
        <AirdropTaskManager isAdmin={true} />
      </div>
    );
  }

  return (
    <div className="crypto-card p-6 text-center">
      <h2 className="text-xl font-bold text-white mb-4">管理员功能</h2>

      {!showPasswordInput ? (
        <div>
          <p className="text-gray-400 mb-4">需要管理员权限才能访问任务管理功能</p>
          <button
            onClick={() => setShowPasswordInput(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            登录管理员
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入管理员密码"
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            />
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleAdminLogin}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              确认登录
            </button>
            <button
              onClick={() => {
                setShowPasswordInput(false);
                setPassword('');
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            提示：默认密码为 {ADMIN_PASSWORD}（仅用于演示）
          </p>
        </div>
      )}
    </div>
  );
}