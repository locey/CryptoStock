package airdrop

import "time"

type AirdropTask struct {
	ID           int64     `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"size:200;not null" json:"name"`
	Description  string    `gorm:"type:text" json:"description"`
	RewardAmount float64   `gorm:"type:decimal(20,8);not null" json:"reward_amount"`
	TaskType     string    `gorm:"size:20" json:"task_type"`
	Level        string    `gorm:"size:20" json:"level"`
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	Status       string    `gorm:"size:20;default:'active'" json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func AirdropTaskTableName() string {
	return "airdrop_task"
}

type UserTaskStatus string

const (
	UserTaskStatusClaimed   UserTaskStatus = "claimed"
	UserTaskStatusCompleted UserTaskStatus = "completed"
	UserTaskStatusRewarded  UserTaskStatus = "rewarded"
	UserTaskStatusFailed    UserTaskStatus = "failed"
)

type AirdropUserTask struct {
	ID          int64          `gorm:"primaryKey" json:"id"`
	UserID      string         `gorm:"not null;index" json:"user_id"`
	TaskID      int64          `gorm:"not null;index" json:"task_id"`
	Address     string         `gorm:"size:100;not null;index" json:"address"`
	Status      UserTaskStatus `gorm:"size:20;default:claimed" json:"status"`
	ClaimedAt   time.Time      `json:"claimed_at"`
	CompletedAt *time.Time     `json:"completed_at,omitempty"`
	RewardedAt  *time.Time     `json:"rewarded_at,omitempty"`
	TxHash      string         `gorm:"size:100" json:"tx_hash"` // 交易哈希
	Proof       string         `gorm:"type:text" json:"proof"`  // 完成证明
}

func AirdropUserTaskTableName() string {
	return "airdrop_user_task"
}
