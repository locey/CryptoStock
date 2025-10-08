'use client'

import React, { useState } from 'react'
import AaveUSDTBuyModal from './AaveUSDTBuyModal'
import AaveUSDTWithdrawModal from './AaveUSDTWithdrawModal'

interface AaveModalManagerProps {
  onTransactionSuccess?: () => void
}

/**
 * Aave 弹窗管理器
 *
 * 统一管理买入和提取弹窗的状态和显示
 */
export default function AaveModalManager({ onTransactionSuccess }: AaveModalManagerProps) {
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)

  // 打开买入弹窗
  const openBuyModal = () => {
    setBuyModalOpen(true)
  }

  // 关闭买入弹窗
  const closeBuyModal = () => {
    setBuyModalOpen(false)
  }

  // 打开提取弹窗
  const openWithdrawModal = () => {
    setWithdrawModalOpen(true)
  }

  // 关闭提取弹窗
  const closeWithdrawModal = () => {
    setWithdrawModalOpen(false)
  }

  // 交易成功回调
  const handleTransactionSuccess = () => {
    if (onTransactionSuccess) {
      onTransactionSuccess()
    }
  }

  return (
    <>
      <AaveUSDTBuyModal
        isOpen={buyModalOpen}
        onClose={closeBuyModal}
        onSuccess={handleTransactionSuccess}
      />
      <AaveUSDTWithdrawModal
        isOpen={withdrawModalOpen}
        onClose={closeWithdrawModal}
        onSuccess={handleTransactionSuccess}
      />

      {/* 导出控制方法给父组件使用 */}
      <div style={{ display: 'none' }}>
        <button data-open-buy={openBuyModal} />
        <button data-open-withdraw={openWithdrawModal} />
      </div>
    </>
  )
}

// 导出 Hook 来获取弹窗控制方法
export const useAaveModalManager = () => {
  const [buyModalOpen, setBuyModalOpen] = useState(false)
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)

  const openBuyModal = () => setBuyModalOpen(true)
  const closeBuyModal = () => setBuyModalOpen(false)
  const openWithdrawModal = () => setWithdrawModalOpen(true)
  const closeWithdrawModal = () => setWithdrawModalOpen(false)

  return {
    buyModalOpen,
    withdrawModalOpen,
    openBuyModal,
    closeBuyModal,
    openWithdrawModal,
    closeWithdrawModal,
  }
}