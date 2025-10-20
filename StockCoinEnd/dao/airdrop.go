package dao

import (
	"context"
	"log"
	"math/big"
	"time"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/airdrop"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

func (d *Dao) GetTaskByID(c context.Context, taskId int64) (*airdrop.AirdropTask, error) {
	var task airdrop.AirdropTask
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropTaskTableName()).Where("id = ?", taskId).First(&task).Error
	return &task, err
}

// func (d *Dao) GetUserTask(c context.Context, taskId, userId int64) ()
func (d *Dao) GetUserTask(c context.Context, taskId int64, userId string) (*airdrop.AirdropUserTask, error) {
	var task airdrop.AirdropUserTask
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropUserTaskTableName()).Where("task_id = ? and user_id = ?", taskId, userId).First(&task).Error
	return &task, err
}

func (d *Dao) GetUserTaskByStringUserID(c context.Context, taskId int64, userId string) (*airdrop.AirdropUserTask, error) {
	var task airdrop.AirdropUserTask
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropUserTaskTableName()).Where("task_id = ? and user_id = ?", taskId, userId).First(&task).Error
	return &task, err
}

func (d *Dao) GetUserTasksByUserID(c context.Context, userID string) ([]types.AirdropTaskWithStatus, error) {
	var userTasks []types.AirdropTaskWithStatus
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropTaskTableName()).Select(`airdrop_task.*, airdrop_user_task.proof as proof,airdrop_user_task.claimed_at as reward_claimed_at,airdrop_user_task.status as user_status,airdrop_user_task.batch_id as batch_id`).
		Joins(`LEFT JOIN airdrop_user_task ON airdrop_task.id = airdrop_user_task.task_id AND airdrop_user_task.user_id = ?`, userID).
		Scan(&userTasks).Error
	return userTasks, err
}

func (d *Dao) CreateUserTask(c context.Context, userTask *airdrop.AirdropUserTask) error {
	return d.DB.Create(userTask).Error
}

func (d *Dao) UpdateUserTask(c context.Context, userTask *airdrop.AirdropUserTask) error {
	return d.DB.Save(userTask).Error
}

func (d *Dao) GetActiveTasks(tx context.Context) ([]airdrop.AirdropTask, error) {
	var userTasks []airdrop.AirdropTask
	d.DB.Find(&userTasks, "status = ?", "active")
	return userTasks, nil
}

// 批量更新
func (d *Dao) UpdateUserTasks(airdropTasks []airdrop.AirdropUserTask) {

	//通过id更新
	for _, task := range airdropTasks {
		d.DB.Debug().Model(&airdrop.AirdropUserTask{}).Where("task_id = ? AND user_id = ?", task.TaskID, task.UserID).Select("proof", "batch_id").Updates(&task)
	}
}

// GetTasksByIDs 批量获取任务
func (d *Dao) GetUserTasksByIDs(c context.Context, taskIds []int64) ([]airdrop.AirdropUserTask, error) {
	var tasks []airdrop.AirdropUserTask
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropUserTaskTableName()).Where("task_id in ?", taskIds).Find(&tasks).Error
	return tasks, err
}

// CreateTask 创建空投任务
func (d *Dao) CreateTask(c context.Context, task *airdrop.AirdropTask) error {
	return d.DB.WithContext(c).Table(airdrop.AirdropTaskTableName()).Create(task).Error
}

// UpdateTask 更新空投任务
func (d *Dao) UpdateTask(c context.Context, task *airdrop.AirdropTask) error {
	return d.DB.WithContext(c).Table(airdrop.AirdropTaskTableName()).Save(task).Error
}

// DeleteTask 删除空投任务
func (d *Dao) DeleteTask(c context.Context, taskId int64) error {
	return d.DB.WithContext(c).Table(airdrop.AirdropTaskTableName()).Where("id = ?", taskId).Delete(&airdrop.AirdropTask{}).Error
}

// GetAllTasks 获取所有空投任务
func (d *Dao) GetAllTasks(c context.Context) ([]airdrop.AirdropTask, error) {
	var tasks []airdrop.AirdropTask
	err := d.DB.WithContext(c).Table(airdrop.AirdropTaskTableName()).Find(&tasks).Error
	return tasks, err
}

// GetTasksByStatus 根据状态获取任务
func (d *Dao) GetTasksByStatus(c context.Context, status string) ([]airdrop.AirdropTask, error) {
	var tasks []airdrop.AirdropTask
	err := d.DB.WithContext(c).Table(airdrop.AirdropTaskTableName()).Where("status = ?", status).Find(&tasks).Error
	return tasks, err
}

// GetTaskUserCount 获取任务的参与人数
func (d *Dao) GetTaskUserCount(c context.Context, taskId int64) (int64, error) {
	var count int64
	err := d.DB.WithContext(c).Table(airdrop.AirdropUserTaskTableName()).Where("task_id = ?", taskId).Count(&count).Error
	return count, err
}

// UpdateAirdropUserTaskStatus 更新单个用户任务状态
func (d *Dao) UpdateAirdropUserTaskStatus(userAddress string, batchID *big.Int, taskID *big.Int, status string, txHash string) error {
	//更新用户地址、任务id更新任务状态、txHash、提现时间
	now := time.Now()

	log.Printf("更新用户任务状态: 用户地址=%s, 任务ID=%s, 状态=%s, 交易哈希=%s",
		userAddress, batchID.String(), status, txHash)

	result := d.DB.Model(&airdrop.AirdropUserTask{}).Where("address = ? and batch_id = ? and task_id = ?", userAddress, batchID.Int64(), taskID.Int64()).Updates(map[string]interface{}{
		"status":      status,
		"tx_hash":     txHash,
		"rewarded_at": now,
	})

	if result.Error != nil {
		log.Printf("更新用户任务状态失败: %v", result.Error)
		return result.Error
	}

	log.Printf("成功更新 %d 条用户任务记录", result.RowsAffected)
	return nil
}
