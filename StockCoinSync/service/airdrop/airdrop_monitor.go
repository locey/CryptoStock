package airdrop

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"os"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// AirdropClaimEvent represents the AirDropClaim event from the Airdrop contract
type AirdropClaimEvent struct {
	User   common.Address
	TaskId *big.Int
	Amount *big.Int
}

func StartAirdropEventListener() {
	// 从环境变量获取配置
	infuraProjectID := os.Getenv("INFURA_PROJECT_ID")
	if infuraProjectID == "" {
		log.Fatal("请设置 INFURA_PROJECT_ID 环境变量")
	}

	contractAddressStr := os.Getenv("AIRDROP_CONTRACT_ADDRESS")
	if contractAddressStr == "" {
		log.Fatal("请设置 AIRDROP_CONTRACT_ADDRESS 环境变量")
	}

	// 连接到以太坊节点 (这里使用Sepolia测试网作为示例)
	rpcURL := fmt.Sprintf("https://sepolia.infura.io/v3/%s", infuraProjectID)
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		log.Fatal("Failed to connect to the Ethereum client: ", err)
	}

	// Airdrop 合约地址
	contractAddress := common.HexToAddress(contractAddressStr)

	// AirDropClaim 事件的 topic hash
	// 事件签名: AirDropClaim(address indexed user, uint256 indexed taskId, uint256 amount)
	topicHash := crypto.Keccak256Hash([]byte("AirDropClaim(address,uint256,uint256)"))

	// 创建查询过滤器
	query := ethereum.FilterQuery{
		Addresses: []common.Address{contractAddress},
		Topics:    [][]common.Hash{{topicHash}},
	}

	// 监听事件
	logs := make(chan types.Log)
	sub, err := client.SubscribeFilterLogs(context.Background(), query, logs)
	if err != nil {
		log.Fatal("Failed to subscribe to event logs: ", err)
	}

	fmt.Printf("开始监听 Airdrop 合约 (%s) 的 AirDropClaim 事件...\n", contractAddress.Hex())

	// 处理事件
	for {
		select {
		case err := <-sub.Err():
			log.Fatal("Error in log subscription: ", err)
		case vLog := <-logs:
			// 解析事件数据
			event, err := parseAirDropClaimEvent(vLog)
			if err != nil {
				log.Println("Failed to parse event: ", err)
				continue
			}

			// 打印事件信息
			fmt.Printf("检测到 AirDropClaim 事件:\n")
			fmt.Printf("  用户地址: %s\n", event.User.Hex())
			fmt.Printf("  任务ID: %s\n", event.TaskId.String())
			fmt.Printf("  奖励数量: %s\n", event.Amount.String())
			fmt.Printf("  交易哈希: %s\n", vLog.TxHash.Hex())
			fmt.Printf("  区块号: %d\n", vLog.BlockNumber)
			fmt.Println("------------------------")
		}
	}
}

// parseAirDropClaimEvent 解析 AirDropClaim 事件
func parseAirDropClaimEvent(vLog types.Log) (*AirdropClaimEvent, error) {
	event := new(AirdropClaimEvent)

	// 确保有足够的 topics (至少3个: topic0, user, taskId)
	if len(vLog.Topics) < 3 {
		return nil, fmt.Errorf("invalid number of topics: %d", len(vLog.Topics))
	}

	// 从 topics 中解析 indexed 参数
	// topics[0] = 事件签名哈希
	// topics[1] = user (indexed)
	// topics[2] = taskId (indexed)
	event.User = common.BytesToAddress(vLog.Topics[1].Bytes())
	event.TaskId = new(big.Int).SetBytes(vLog.Topics[2].Bytes())

	// 从 data 中解析非 indexed 参数
	// data[0:32] = amount
	if len(vLog.Data) >= 32 {
		event.Amount = new(big.Int).SetBytes(vLog.Data[0:32])
	} else {
		return nil, fmt.Errorf("invalid data length: %d", len(vLog.Data))
	}

	return event, nil
}
