package dao

import (
	"context"
	"time"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/airdrop"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

func (d *Dao) GetTaskByID(c context.Context, taskId int64) (*airdrop.AirdropTask, error) {
	var task airdrop.AirdropTask
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropTaskTableName()).Where("task_id  = ?", taskId).First(&task).Error
	return &task, err
}

// func (d *Dao) GetUserTask(c context.Context, taskId, userId int64) ()
func (d *Dao) GetUserTask(c context.Context, taskId, userId int64) (*airdrop.AirdropUserTask, error) {
	var task airdrop.AirdropUserTask
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropUserTaskTableName()).Where("task_id = ? and user_id = ?", taskId, userId).First(&task).Error
	return &task, err
}

func (d *Dao) GetUserTasksByUserID(c context.Context, userID string) ([]types.AirdropTaskWithStatus, error) {
	var userTasks []types.AirdropTaskWithStatus
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropTaskTableName()).Select(`airdrop_tasks.*, airdrop_user_tasks.status as user_status`).
		Joins(`LEFT JOIN airdrop_user_tasks ON airdrop_tasks.id = airdrop_user_tasks.task_id AND airdrop_user_tasks.user_id = ?`, userID).
		Scan(&userTasks).Error
	return userTasks, err
}

func (d *Dao) CreateUserTask(c context.Context, userTask *airdrop.AirdropUserTask) error {
	return d.DB.Create(userTask).Error
}

func (d *Dao) UpdateUserTask(c context.Context, userTask *airdrop.AirdropUserTask) error {
	return d.DB.Save(userTask).Error
}

func (d *Dao) GetUserTasksByTime(tx context.Context, startTime time.Time, endTime time.Time) ([]airdrop.AirdropUserTask, error) {
	var userTasks []airdrop.AirdropUserTask
	d.DB.WithContext(tx).Table(airdrop.AirdropUserTaskTableName()).Where("created_at >= ? AND created_at <= ?", startTime, endTime).Find(&userTasks)

	return userTasks, nil
}

// 批量更新
func (d *Dao) UpdateUserTasks(airdropTasks []airdrop.AirdropUserTask) {
	// 根据id 批量更新
	ids := make([]int64, len(airdropTasks))
	for i, task := range airdropTasks {
		ids[i] = task.ID
	}
	d.DB.Model(&airdrop.AirdropUserTask{}).Where("id IN ?", ids).Updates(airdropTasks)
	d.DB.Model(&airdrop.AirdropUserTask{}).Where("id IN ?")
}
