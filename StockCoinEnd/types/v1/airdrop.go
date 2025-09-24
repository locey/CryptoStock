package types

import "github.com/locey/CryptoStock/StockCoinBase/stores/gdb/airdrop"

type ClaimRequest struct {
	UsesrId uint `json:"user_id" binding:"required"`
	TaskId  uint `json:"task_id" binding:"required"`
}

type AirdropStats struct {
	TotalUsers      int64  `json:"total_users"`
	TotalInvites    int64  `json:"total_invites"`
	TotalAirdropped string `json:"total_airdropped"`
	ActiveUsers     int64  `json:"active_users"`
}

type AirdropTaskWithStatus struct {
	airdrop.AirdropTask
	UserStatus *string `json:"user_status"` // 用户参与状态，未参与为nil
}
