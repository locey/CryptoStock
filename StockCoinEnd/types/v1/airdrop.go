package types

import (
	"time"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/airdrop"
)

type ClaimRequest struct {
	UserID  string `json:"user_id" binding:"required"`
	TaskID  int64  `json:"task_id" binding:"required"`
	Address string `json:"address" binding:"required"`
}

// CreateTaskRequest 创建空投任务请求
type CreateTaskRequest struct {
	Name         string  `json:"name" binding:"required,max=200"`
	Description  string  `json:"description" binding:"max=1000"`
	RewardAmount float64 `json:"reward_amount" binding:"required,gt=0"`
	TaskType     string  `json:"task_type" binding:"required,max=20"`
	Level        string  `json:"level" binding:"max=20"`
	StartTime    string  `json:"start_time"` // ISO 8601 格式时间字符串
	EndTime      string  `json:"end_time"`   // ISO 8601 格式时间字符串
}

// UpdateTaskRequest 更新空投任务请求
type UpdateTaskRequest struct {
	Name         string  `json:"name" binding:"max=200"`
	Description  string  `json:"description" binding:"max=1000"`
	RewardAmount float64 `json:"reward_amount" binding:"gt=0"`
	TaskType     string  `json:"task_type" binding:"max=20"`
	Level        string  `json:"level" binding:"max=20"`
	StartTime    string  `json:"start_time"`
	EndTime      string  `json:"end_time"`
	Status       string  `json:"status" binding:"omitempty,oneof=active completed expired"`
}

type AirdropStats struct {
	TotalUsers      int64  `json:"total_users"`
	TotalInvites    int64  `json:"total_invites"`
	TotalAirdropped string `json:"total_airdropped"`
	ActiveUsers     int64  `json:"active_users"`
}

type AirdropTaskWithStatus struct {
	airdrop.AirdropTask
	UserStatus      *string    `json:"user_status"`       // 用户参与状态，未参与为nil
	Proof           string     `json:"proof"`             // 完成证明
	RewardClaimedAt *time.Time `json:"reward_claimed_at"` // 领取奖励时间
}

type AddAirdropTaskRequest struct {
	Name    string `json:"name"`
	Desc    string `json:"desc"`
	Type    int64  `json:"type"`
	Reward  int64  `json:"reward"`
	Level   int64  `json:"level"`
	StartAt int64  `json:"start_at"`
	EndAt   int64  `json:"end_at"`
	Status  int64  `json:"status"`
}
