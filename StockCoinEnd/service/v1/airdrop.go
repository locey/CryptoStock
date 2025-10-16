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

// 更新指定默克尔树根
func updateMerkleRoot(address string, taskIds []int64, roots [][]byte, client *ethclient.Client, privateKey *ecdsa.PrivateKey) {

	// 1. 解析ABI
	abiPath := filepath.Join("..", "CryptoStockContract", "abi", "Airdrop.abi")
	parsedABI, err := utils.ReadABI(abiPath)
	if err != nil {
		log.Fatal("ABI解析错误:", err)
	}

	// 转换参数类型
	taskIdBigInts := make([]*big.Int, len(taskIds))
	for i, id := range taskIds {
		taskIdBigInts[i] = big.NewInt(id)
	}

	rootHashes := make([]common.Hash, len(roots))
	for i, root := range roots {
		rootHashes[i] = common.BytesToHash(root)
	}

	// 2. 构造调用数据
	data, err := parsedABI.Pack("setMerkleRoot", taskIdBigInts, rootHashes)
	if err != nil {
		log.Fatal("数据打包错误:", err)
	}

	// 3. 获取nonce
	fromAddress := crypto.PubkeyToAddress(privateKey.PublicKey)
	nonce, err := client.PendingNonceAt(context.Background(), fromAddress)
	if err != nil {
		log.Fatal("获取nonce错误:", err)
	}

	// 4. 设置交易参数
	gasPrice, err := client.SuggestGasPrice(context.Background())
	if err != nil {
		log.Fatal("获取gas price错误:", err)
	}

	contractAddress := common.HexToAddress(address)
	tx := types.NewTransaction(nonce, contractAddress, big.NewInt(0), 1000000, gasPrice, data)

	// 5. 签名交易
	chainID, err := client.NetworkID(context.Background())
	if err != nil {
		log.Fatal("获取chain ID错误:", err)
	}

	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		log.Fatal("签名交易错误:", err)
	}

	// 6. 发送交易
	err = client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		log.Fatal("发送交易错误:", err)
	}

	log.Println("交易已发送，交易哈希:", signedTx.Hash().Hex())

}
