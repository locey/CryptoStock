"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Power, AlertTriangle, CheckCircle, Gift, ExternalLink } from "lucide-react";
import {
  ERC20_TOKEN_ADDRESS,
  AIRDROP_CONTRACT_ADDRESS,
  getTokenExplorerUrl,
  getTokenSymbol
} from "@/lib/token";
import { FormattedAddress } from "@/components/FormattedAddress";

interface StartAirdropButtonProps {
  onStartAirdrop: (contractAddress: string) => Promise<boolean>;
  isStarting?: boolean;
}


export function StartAirdropButton({ onStartAirdrop, isStarting = false }: StartAirdropButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleStartClick = async () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmStart = async () => {
    setStatus('idle');
    setShowConfirmDialog(false);

    try {
      const success = await onStartAirdrop(AIRDROP_CONTRACT_ADDRESS);
      if (success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
      }
    } catch (error) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  return (
    <div className="relative flex gap-2">
      {/* ERC20 代币信息按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(getTokenExplorerUrl(ERC20_TOKEN_ADDRESS), '_blank')}
        className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 flex items-center gap-2"
        title={`查看 ${getTokenSymbol(ERC20_TOKEN_ADDRESS)} 代币详情`}
      >
        <Gift className="w-4 h-4" />
        {getTokenSymbol(ERC20_TOKEN_ADDRESS)} 代币
      </Button>

      {/* 主按钮 */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleStartClick}
        disabled={isStarting || showConfirmDialog}
        className="text-green-400 border-green-400/30 hover:bg-green-400/10 flex items-center gap-2"
      >
        <Power className="w-4 h-4" />
        {isStarting ? "开启中..." : "开启空投"}
      </Button>

      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Power className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">确认开启空投</h3>
          </div>

          <div className="text-sm text-gray-300 mb-4">
            <p className="mb-2">您即将开启空投活动，这将：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>计算所有符合条件的用户Merkle证明</li>
              <li>更新智能合约的Merkle根</li>
              <li>启用任务领取功能</li>
            </ul>
          </div>

          <div className="text-xs text-gray-400 mb-4 p-2 bg-gray-800 rounded space-y-2">
            <div>
              <span className="text-gray-500">空投合约:</span>
              <div className="mt-1">
                <FormattedAddress
                  address={AIRDROP_CONTRACT_ADDRESS}
                  startLength={6}
                  endLength={4}
                  className="text-gray-300"
                  showCopy={false}
                />
              </div>
            </div>
            <div>
              <span className="text-gray-500">代币合约 ({getTokenSymbol(ERC20_TOKEN_ADDRESS)}):</span>
              <div className="mt-1">
                <FormattedAddress
                  address={ERC20_TOKEN_ADDRESS}
                  startLength={6}
                  endLength={4}
                  className="text-gray-300"
                  showCopy={false}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleConfirmStart}
              disabled={isStarting}
              className="bg-green-600 hover:bg-green-700 flex-1"
            >
              确认开启
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isStarting}
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 状态提示 */}
      {status === 'success' && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-green-900/90 border border-green-700 rounded-lg shadow-lg z-50 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-200">空投活动已成功开启！</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-red-900/90 border border-red-700 rounded-lg shadow-lg z-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-200">开启空投失败，请稍后重试</span>
          </div>
        </div>
      )}
    </div>
  );
}