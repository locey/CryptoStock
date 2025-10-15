package dao

import (
	"context"

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

func (d *Dao) GetActiveTasks(tx context.Context) ([]airdrop.AirdropTask, error) {
	var userTasks []airdrop.AirdropTask
	d.DB.Find(&userTasks, "status = ?", 1)
	return userTasks, nil
}

// 批量更新
func (d *Dao) UpdateUserTasks(airdropTasks []airdrop.AirdropUserTask) {

	//通过id更新
	for _, task := range airdropTasks {
		d.DB.Debug().Model(&airdrop.AirdropUserTask{}).Where("id = ?", task.ID).Select("proof").Updates(&task)
	}
}

// GetTasksByIDs 批量获取任务
func (d *Dao) GetUserTasksByIDs(c context.Context, taskIds []int64) ([]airdrop.AirdropUserTask, error) {
	var tasks []airdrop.AirdropUserTask
	err := d.DB.WithContext(c).
		Table(airdrop.AirdropUserTaskTableName()).Where("task_id in ?", taskIds).Find(&tasks).Error
	return tasks, err
}
