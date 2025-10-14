package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/airdrop"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
	"github.com/pkg/errors"
	"github.com/txaty/go-merkletree"
	"gorm.io/gorm"
)

// ClaimTask 用户领取任务
func ClaimTask(tx context.Context, s *svc.ServerCtx, userID, taskID int64) error {
	// 检查用户是否已领取该任务
	task, err := s.Dao.GetUserTask(tx, taskID, userID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.Wrap(err, "airdrop task is active")
		}
		return err
	}

	if task != nil && task.Status != airdrop.UserTaskStatusFailed {
		return errors.Wrap(err, "airdrop task is active")
	}

	// 检查任务是否已满
	// if task.MaxParticipants > 0 && task.CurrentParticipants >= task.MaxParticipants {
	// 	return ErrTaskFull
	// }

	// 创建用户任务记录
	userTask := &airdrop.AirdropUserTask{
		UserID:    userID,
		TaskID:    taskID,
		Status:    airdrop.UserTaskStatusClaimed,
		ClaimedAt: time.Now(),
	}

	return s.Dao.CreateUserTask(tx, userTask)
}

// CompleteTask 用户完成任务
func CompleteTask(tx context.Context, s *svc.ServerCtx, userID string, taskID uint, proof string) error {
	// 获取用户任务
	// userTask, err := s.Dao.GetUserTask(userID, taskID)
	// if err != nil {
	// 	return ErrTaskNotFound
	// }
	return nil
}

// ClaimReward 用户领取奖励
func ClaimReward(ctx context.Context, s *svc.ServerCtx, userID, taskID int64, userAddr string) error {
	task, err := s.Dao.GetTaskByID(ctx, taskID)
	if err != nil || task == nil {
		return errors.Wrap(err, "GetTaskByIDErr")
	}
	// 获取用户任务
	userTask, err := s.Dao.GetUserTask(ctx, taskID, userID)
	if err != nil {
		return err
	}

	if userTask.Status != airdrop.UserTaskStatusCompleted {
		return errors.Wrap(err, "ErrTaskNotCompleted")
	}

	// 转换奖励金额
	amount := big.NewInt(int64(task.RewardAmount))

	// 调用智能合约发放奖励
	address := []common.Address{common.HexToAddress(userAddr)}
	tx, err := s.AirdropClient.AirdropTokens(address, amount, task.Name)
	if err != nil {
		return fmt.Errorf("failed to distribute tokens: %v", err)
	}

	// 更新用户任务状态
	userTask.Status = airdrop.UserTaskStatusRewarded
	now := time.Now()
	userTask.RewardedAt = &now
	userTask.TxHash = tx[0].TxHash

	if err := s.Dao.UpdateUserTask(ctx, userTask); err != nil {
		return err
	}

	return nil
}

// GetUserTasks 获取用户任务列表和进度
func GetUserTasks(tx context.Context, s *svc.ServerCtx, userID string) ([]types.AirdropTaskWithStatus, error) {
	return s.Dao.GetUserTasksByUserID(tx, userID)
}

// 查出某段时间内的所有airdrop.AirdropUserTask，并且批量计算proof
func GetUserTaskProof(tx context.Context, s *svc.ServerCtx, startTime, endTime time.Time) ([]airdrop.AirdropUserTask, error) {
	userTasks, error := s.Dao.GetUserTasksByTime(tx, startTime, endTime)
	if error != nil {
		return nil, error
	}
	//获取任务ID以及任务对应的reward
	var taskIds []int64
	for _, task := range userTasks {
		taskIds = append(taskIds, task.TaskID)
	}
	tasks, error := s.Dao.GetTasksByIDs(tx, taskIds)
	if error != nil {
		return nil, error
	}
	//获取任务ID以及任务对应的reward map

	var taskRewardMap = make(map[int64]int64)
	for _, task := range tasks {
		taskRewardMap[task.ID] = int64(task.RewardAmount)
	}
	//根据任务ID进行分组
	var tasksMap = make(map[int64][]airdrop.AirdropUserTask)
	for _, task := range userTasks {
		tasksMap[task.TaskID] = append(tasksMap[task.TaskID], task)
	}
	for taskId, tasks := range tasksMap {
		//计算proof
		airdropTasks, root := CalculateProof(tasks, taskRewardMap[taskId], taskId)
		//调用Dao批量更新airdrop.AirdropUserTask
		s.Dao.UpdateUserTasks(airdropTasks)
		//调用合约abi接口设置merkleRoot
		updateMerkleRoot(taskId, root)
	}
	return userTasks, nil
}

// 计算proof（每一个人每一个任务计算一个proof）
func CalculateProof(tasks []airdrop.AirdropUserTask, reward int64, taskId int64) (airdropTasks []airdrop.AirdropUserTask, merkleRoot string) {
	//通过用户地址、reward、taskId生成默克尔proof
	if len(tasks) == 0 {
		return []airdrop.AirdropUserTask{}, ""
	}
	var leaves []merkletree.DataBlock
	for _, task := range tasks {

		rewardBytes := big.NewInt(reward).Bytes()
		taskIDBytes := big.NewInt(task.TaskID).Bytes()

		//用户地址、奖励、任务ID keccak256
		keccak256Data := crypto.Keccak256([]byte(task.Address), rewardBytes, taskIDBytes)

		// 创建一个实现 Content 接口的结构体
		content := &MerkleContent{
			Data: keccak256Data,
		}
		leaves = append(leaves, content)
	}

	// 如果没有有效数据，返回空字符串
	if len(leaves) == 0 {
		return []airdrop.AirdropUserTask{}, ""
	}
	tree, err := merkletree.New(&merkletree.Config{
		HashFunc: keccak256Wrapper,
	}, leaves)

	if err != nil {
		return []airdrop.AirdropUserTask{}, ""
	}

	for i, task := range tasks {
		rewardBytes := big.NewInt(reward).Bytes()
		taskIDBytes := big.NewInt(task.TaskID).Bytes()

		//用户地址、奖励、任务ID keccak256
		keccak256Data := crypto.Keccak256([]byte(task.Address), rewardBytes, taskIDBytes)

		// 创建一个实现 Content 接口的结构体
		content := &MerkleContent{
			Data: keccak256Data,
		}

		if tasks[i].Proof == "" {

			//获取默克尔证明
			proof, err := tree.Proof(content)
			if err != nil {
				return []airdrop.AirdropUserTask{}, ""
			}
			proofBytes, err := json.Marshal(proof)
			if err != nil {
				return []airdrop.AirdropUserTask{}, ""
			}
			tasks[i].Proof = string(proofBytes)
		}

	}

	return tasks, string(tree.Root)

}

type MerkleContent struct {
	Data []byte
}

// Serialize 实现 DataBlock 接口的 Serialize 方法
func (m *MerkleContent) Serialize() ([]byte, error) {
	return m.Data, nil
}

// 包装 Keccak256 为 merkletree 所需的 HashFunc 类型
func keccak256Wrapper(data []byte) ([]byte, error) {
	return crypto.Keccak256(data), nil
}

func updateMerkleRoot(taskId int64, root string) {

}
