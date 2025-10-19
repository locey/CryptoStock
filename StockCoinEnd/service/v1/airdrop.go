package service

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"path/filepath"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/airdrop"
	"github.com/locey/CryptoStock/StockCoinEnd/common/utils"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	mytype "github.com/locey/CryptoStock/StockCoinEnd/types/v1"
	"github.com/pkg/errors"
	merkletree "github.com/wealdtech/go-merkletree/v2"
	"github.com/wealdtech/go-merkletree/v2/keccak256"
	"gorm.io/gorm"
)

// ClaimTask 用户领取任务
func ClaimTask(tx context.Context, s *svc.ServerCtx, userID string, taskID int64, address string) error {
	// 检查用户是否已领取该任务
	task, err := s.Dao.GetUserTaskByStringUserID(tx, taskID, userID)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.Wrap(err, "database error")
		}
		// 记录不存在，说明是第一次领取，继续执行
	} else {
		// 记录存在，检查状态
		if task != nil && task.Status != airdrop.UserTaskStatusFailed {
			return errors.New("airdrop task is active")
		}
	}

	// 检查任务是否已满
	// if task.MaxParticipants > 0 && task.CurrentParticipants >= task.MaxParticipants {
	// 	return ErrTaskFull
	// }

	// 创建用户任务记录
	userTask := &airdrop.AirdropUserTask{
		UserID:    userID,
		TaskID:    taskID,
		Address:   address,
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
func ClaimReward(ctx context.Context, s *svc.ServerCtx, userID string, taskID int64, userAddr string) error {
	task, err := s.Dao.GetTaskByID(ctx, taskID)
	if err != nil || task == nil {
		return errors.Wrap(err, "GetTaskByIDErr")
	}
	// 获取用户任务
	userTask, err := s.Dao.GetUserTaskByStringUserID(ctx, taskID, userID)
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
func GetUserTasks(tx context.Context, s *svc.ServerCtx, userID string) ([]mytype.AirdropTaskWithStatus, error) {
	return s.Dao.GetUserTasksByUserID(tx, userID)
}

// 查出某段时间内的所有airdrop.AirdropUserTask，并且批量计算proof
func StartAirdrop(tx context.Context, s *svc.ServerCtx, address string) ([]airdrop.AirdropUserTask, error) {
	tasks, error := s.Dao.GetActiveTasks(tx)
	var airdropTasks []airdrop.AirdropUserTask
	if error != nil || len(tasks) == 0 {
		return nil, error
	}
	//获取任务ID以及任务对应的reward map
	var taskRewardMap = make(map[int64]int64)
	var taskIds []int64
	for _, task := range tasks {
		taskIds = append(taskIds, task.ID)
		taskRewardMap[task.ID] = int64(task.RewardAmount)
	}

	userTasks, error := s.Dao.GetUserTasksByIDs(tx, taskIds)
	//根据任务ID进行分组
	var tasksMap = make(map[int64][]airdrop.AirdropUserTask)
	for _, task := range userTasks {
		tasksMap[task.TaskID] = append(tasksMap[task.TaskID], task)
	}

	var roots [][]byte
	for taskId, tasks := range tasksMap {
		//计算proof
		var root []byte
		airdropTasks, root = CalculateProof(tasks, taskRewardMap[taskId], taskId)
		//调用Dao批量更新airdrop.AirdropUserTask
		s.Dao.UpdateUserTasks(airdropTasks)
		roots = append(roots, root)
	}

	//privateKey转成edsa密钥
	privateKey, err := crypto.HexToECDSA("d4f92103da1106a9eac579281458f51a541e0525253993246d8e08f440b28e77")
	if err != nil {
		log.Println("Failed to convert private key:", err)
		return nil, err
	}
	// 1. 连接以太坊节点
	client, err := ethclient.Dial("https://ethereum-sepolia-rpc.publicnode.com")
	if err != nil {
		log.Fatal(err)
	}
	//调用合约abi接口设置merkleRoot
	updateMerkleRoot(address, taskIds, roots, client, privateKey)
	return airdropTasks, nil
}

// 计算proof（每一个人每一个任务计算一个proof）
func CalculateProof(tasks []airdrop.AirdropUserTask, reward int64, taskId int64) (airdropTasks []airdrop.AirdropUserTask, merkleRoot []byte) {
	//通过用户地址、reward、taskId生成默克尔proof
	if len(tasks) == 0 {
		return []airdrop.AirdropUserTask{}, []byte{}
	}
	//构建默克尔树
	tree, leaves, err := buildTree(tasks, reward, taskId)
	if err != nil {
		log.Println("buildTree err:", err)
		return []airdrop.AirdropUserTask{}, []byte{}
	}

	// 使用预先创建的leaves来生成证明
	for i, _ := range tasks {

		//获取默克尔证明，使用预先创建的content
		log.Println("GetProof:", leaves[i])
		//获取proof
		hexProof, err := getProof(tree, leaves[i])
		if err != nil {
			log.Println("getProof err:", err)
			return []airdrop.AirdropUserTask{}, []byte{}
		}
		tasks[i].Proof = hexProof

	}
	airdropTasks = tasks
	return airdropTasks, tree.Root()
}

// 构建默克尔树
func buildTree(tasks []airdrop.AirdropUserTask, reward int64, taskId int64) (*merkletree.MerkleTree, [][]byte, error) {
	var leaves [][]byte

	for _, task := range tasks {

		addr := common.HexToAddress(task.Address)

		rewardBig := big.NewInt(reward)
		taskIDBig := big.NewInt(taskId)

		// （左侧填充0）（address无需填充）模拟 Solidity 中的 abi.encodePacked(msg.sender, amount, taskId)
		data := append(addr.Bytes(), common.LeftPadBytes(rewardBig.Bytes(), 32)...)
		data = append(data, common.LeftPadBytes(taskIDBig.Bytes(), 32)...)

		leaves = append(leaves, data)
	}
	// 如果没有有效数据，返回空字符串
	if len(leaves) == 0 {
		return nil, nil, errors.New("No valid data")
	}

	//循环打印leaves
	log.Println("leaves:", leaves)

	//创建Merkle树时统一keccak256 hash 统一做排序
	tree, err := merkletree.NewTree(merkletree.WithData(leaves), merkletree.WithSorted(true), merkletree.WithHashType(&keccak256.Keccak256{}))

	if err != nil {
		log.Println("Failed to create merkle tree:", err)
		return nil, nil, err
	}

	//打印树结构
	log.Println("Merkle Tree:", tree)
	//打印树根
	log.Println("Merkle Root:", common.Bytes2Hex(tree.Root()))
	return tree, leaves, nil
}

func getProof(tree *merkletree.MerkleTree, leave []byte) (string, error) {

	proof, err := tree.GenerateProof(leave, 0)
	log.Println("proof:", proof)
	if err != nil {
		log.Println("GetProof err:", err)
		return "", err
	}

	// 将proof转换为合约可接受的格式（仅包含Siblings）
	// 合约需要的是bytes32[]，对应Go中的[][]byte
	proofData := make([][]byte, len(proof.Hashes))
	for j, hash := range proof.Hashes {
		proofData[j] = hash
	}

	//proofBytes转成Hex 16进制字符串
	// 转换为十六进制字符串数组格式，例如["0xd733915f41c130f3dfba966cb715edafd213dcdaf99dec8764297f12cd8393c6"]
	hexStrings := make([]string, len(proofData))
	for k, data := range proofData {
		hexStrings[k] = "0x" + hex.EncodeToString(data)
	}

	jsonHexStrings, err := json.Marshal(hexStrings)
	if err != nil {
		return "", err
	}
	return string(jsonHexStrings), nil
}

// sendTransaction 发送交易到区块链的通用函数
// 参数:
// - client: 以太坊客户端
// - contractAddress: 合约地址
// - data: 交易数据
// - privateKey: 私钥用于签名
// 返回值:
// - *types.Transaction: 已签名的交易
func sendTransaction(client *ethclient.Client, contractAddress common.Address, data []byte, privateKey *ecdsa.PrivateKey) error {
	// 获取账户地址
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)

	// 获取nonce
	nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
	if err != nil {
		log.Fatal("获取nonce错误:", err)
	}

	// 获取gas price
	gasPrice, err := client.SuggestGasPrice(context.Background())
	if err != nil {
		log.Fatal("获取gas price错误:", err)
	}

	// 创建交易
	tx := types.NewTransaction(nonce, contractAddress, big.NewInt(0), 1000000, gasPrice, data)

	// 获取链ID用于签名
	chainID, err := client.NetworkID(context.Background())
	if err != nil {
		log.Fatal("获取chain ID错误:", err)
	}

	// 签名交易
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		log.Fatal("签名交易错误:", err)
	}
	// 5. 提交交易到网络
	err = client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		log.Fatal("发送交易错误:", err)
	}
	log.Println("交易已发送，交易哈希:", signedTx.Hash().Hex())
	return err
}

// updateMerkleRoot 更新指定默克尔树根
// 参数:
// - address: 合约地址
// - taskIds: 任务ID数组
// - roots: 默克尔树根哈希数组
// - client: 以太坊客户端
// - privateKey: 私钥用于签名交易
func updateMerkleRoot(address string, taskIds []int64, roots [][]byte, client *ethclient.Client, privateKey *ecdsa.PrivateKey) {
	// 1. 解析ABI
	abiPath := filepath.Join("..", "CryptoStockContract", "abi", "Airdrop.abi")
	parsedABI, err := utils.ReadABI(abiPath)
	if err != nil {
		log.Fatal("ABI解析错误:", err)
	}

	// 2. 转换参数类型
	taskIdBigInts := make([]*big.Int, len(taskIds))
	for i, id := range taskIds {
		taskIdBigInts[i] = big.NewInt(id)
	}

	rootHashes := make([]common.Hash, len(roots))
	for i, root := range roots {
		rootHashes[i] = common.BytesToHash(root)
	}

	// 3. 构造调用数据
	data, err := parsedABI.Pack("setMerkleRoot", taskIdBigInts, rootHashes)
	if err != nil {
		log.Fatal("数据打包错误:", err)
	}

	// 4. 发送交易
	contractAddress := common.HexToAddress(address)
	err = sendTransaction(client, contractAddress, data, privateKey)
	if err != nil {
		log.Fatal("交易发送错误:", err)
	}

}

// UpdateReward 更新空投奖励
// 参数:
// - svcCtx: 服务上下文
// - address: 合约地址
// - taskIds: 任务ID数组
// - amounts: 奖励金额数组
// - client: 以太坊客户端
// - privateKey: 私钥用于签名交易
func UpdateReward(svcCtx *svc.ServerCtx, address string, taskIds []int64, amounts []int64, client *ethclient.Client, privateKey *ecdsa.PrivateKey) {
	// 1. 解析ABI
	abiPath := filepath.Join("..", "CryptoStockContract", "abi", "Airdrop.abi")
	parsedABI, err := utils.ReadABI(abiPath)
	if err != nil {
		log.Fatal("ABI文件解析错误:", err)
	}

	// 2. 转换参数类型，将int64转换为big.Int以支持智能合约调用
	// 转换任务ID数组
	taskIdBigInts := make([]*big.Int, len(taskIds))
	for i, id := range taskIds {
		taskIdBigInts[i] = big.NewInt(id)
	}

	// 转换奖励金额数组
	amountBigInts := make([]*big.Int, len(amounts))
	for i, amount := range amounts {
		amountBigInts[i] = big.NewInt(amount)
	}

	// 3. 打包调用数据，准备调用合约的setReward函数
	rewardData, err := parsedABI.Pack("setReward", taskIdBigInts, amountBigInts)
	if err != nil {
		log.Fatal("ABI解析错误:", err)
	}

	// 4. 发送交易
	contractAddress := common.HexToAddress(address)
	err = sendTransaction(client, contractAddress, rewardData, privateKey)
	if err != nil {
		log.Fatal("交易发送错误:", err)
	}

}

// CreateTask 创建空投任务
func CreateTask(ctx context.Context, s *svc.ServerCtx, req *mytype.CreateTaskRequest) (*airdrop.AirdropTask, error) {
	// 解析时间字符串
	var startTime, endTime time.Time
	var err error

	if req.StartTime != "" {
		startTime, err = time.Parse(time.RFC3339, req.StartTime)
		if err != nil {
			return nil, errors.Wrap(err, "Invalid start_time format, expected ISO 8601")
		}
	} else {
		startTime = time.Now()
	}

	if req.EndTime != "" {
		endTime, err = time.Parse(time.RFC3339, req.EndTime)
		if err != nil {
			return nil, errors.Wrap(err, "Invalid end_time format, expected ISO 8601")
		}

		// 检查结束时间是否晚于开始时间
		if !endTime.After(startTime) {
			return nil, errors.New("end_time must be after start_time")
		}
	}

	// 创建任务对象
	task := &airdrop.AirdropTask{
		Name:         req.Name,
		Description:  req.Description,
		RewardAmount: req.RewardAmount,
		TaskType:     req.TaskType,
		Level:        req.Level,
		StartTime:    startTime,
		EndTime:      endTime,
		Status:       "active",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// 创建任务
	err = s.Dao.CreateTask(ctx, task)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to create task")
	}

	return task, nil
}

// UpdateTask 更新空投任务
func UpdateTask(ctx context.Context, s *svc.ServerCtx, taskId int64, req *mytype.UpdateTaskRequest) (*airdrop.AirdropTask, error) {
	// 获取现有任务
	task, err := s.Dao.GetTaskByID(ctx, taskId)
	if err != nil {
		return nil, errors.Wrap(err, "Task not found")
	}

	// 解析时间字符串（如果提供）
	if req.StartTime != "" {
		startTime, err := time.Parse(time.RFC3339, req.StartTime)
		if err != nil {
			return nil, errors.Wrap(err, "Invalid start_time format, expected ISO 8601")
		}
		task.StartTime = startTime
	}

	if req.EndTime != "" {
		endTime, err := time.Parse(time.RFC3339, req.EndTime)
		if err != nil {
			return nil, errors.Wrap(err, "Invalid end_time format, expected ISO 8601")
		}

		// 检查结束时间是否晚于开始时间
		if !endTime.After(task.StartTime) {
			return nil, errors.New("end_time must be after start_time")
		}
		task.EndTime = endTime
	}

	// 更新其他字段
	if req.Name != "" {
		task.Name = req.Name
	}
	if req.Description != "" {
		task.Description = req.Description
	}
	if req.RewardAmount > 0 {
		task.RewardAmount = req.RewardAmount
	}
	if req.TaskType != "" {
		task.TaskType = req.TaskType
	}
	if req.Level != "" {
		task.Level = req.Level
	}
	if req.Status != "" {
		task.Status = req.Status
	}

	task.UpdatedAt = time.Now()

	// 更新任务
	err = s.Dao.UpdateTask(ctx, task)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to update task")
	}

	return task, nil
}

// DeleteTask 删除空投任务
func DeleteTask(ctx context.Context, s *svc.ServerCtx, taskId int64) error {
	// 检查任务是否存在
	_, err := s.Dao.GetTaskByID(ctx, taskId)
	if err != nil {
		return errors.Wrap(err, "Task not found")
	}

	// 检查是否有用户已参与该任务
	userCount, err := s.Dao.GetTaskUserCount(ctx, taskId)
	if err != nil {
		return errors.Wrap(err, "Failed to check task participants")
	}

	if userCount > 0 {
		return errors.New("Cannot delete task with existing participants. Please set status to 'expired' instead.")
	}

	// 删除任务
	err = s.Dao.DeleteTask(ctx, taskId)
	if err != nil {
		return errors.Wrap(err, "Failed to delete task")
	}

	return nil
}

// GetAllTasks 获取所有空投任务
func GetAllTasks(ctx context.Context, s *svc.ServerCtx) ([]airdrop.AirdropTask, error) {
	return s.Dao.GetAllTasks(ctx)
}

// GetUserTasksByIDs 获取指定任务ID的用户任务记录
func GetUserTasksByIDs(ctx context.Context, s *svc.ServerCtx, taskIds []int64) ([]airdrop.AirdropUserTask, error) {
	return s.Dao.GetUserTasksByIDs(ctx, taskIds)
}

// GetTasksByStatus 根据状态获取任务
func GetTasksByStatus(ctx context.Context, s *svc.ServerCtx, status string) ([]airdrop.AirdropTask, error) {
	return s.Dao.GetTasksByStatus(ctx, status)
}
