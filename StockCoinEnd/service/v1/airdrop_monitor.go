package service

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
)

// AirdropClaimEvent represents the AirDropClaim event from the Airdrop contract
type AirdropClaimEvent struct {
	User    common.Address
	BatchID *big.Int
	TaskID  *big.Int
	Amount  *big.Int
}

// TokenPurchasedEvent represents the TokenPurchased event from the StockToken contract
type TokenPurchasedEvent struct {
	Buyer       common.Address
	StockSymbol string
	UsdtAmount  *big.Int
	TokenAmount *big.Int
	Price       *big.Int
}

// TokenSoldEvent represents the TokenSold event from the StockToken contract
type TokenSoldEvent struct {
	Seller      common.Address
	StockSymbol string
	TokenAmount *big.Int
	UsdtAmount  *big.Int
	Price       *big.Int
}

// OperationExecutedEvent represents the OperationExecuted event from the DefiAggregator contract
type OperationExecutedEvent struct {
	User          common.Address
	AdapterName   string
	OperationType *big.Int
}

func StartAirdropEventListener(svcCtx *svc.ServerCtx) {
	// Airdrop contract
	airdropContractAddressStr := svcCtx.C.AirdropContract.ContractAddress
	if airdropContractAddressStr == "" {
		log.Fatal("请设置 AIRDROP_CONTRACT_ADDRESS 环境变量")
	}

	// StockToken contract addresses
	stockTokenAddresses := []string{
		"0xa3BCE5f241991cc4c0FeBFE33C14e7cFaE864a9c",
		"0x87150dA0Bebb21287E9de6979f52bc40647b7875",
		"0x6Ce65E8dD8869E3691EFd080Ebb972394Ae0CA9C",
		"0xF001A6F2363BdCc6FdE5c2FA6913eCe27D02126d",
		"0x187dd9D56161e399a7B400EC586A9b6c2296F31A",
		"0x5195B988D6375ef210f171b4D7e4E5D5B5e6ff40",
	}

	// DefiAggregator contract address
	defiAggregatorAddressStr := "0x885D8317087e292F713d2FFfb9B9E74D49a7cfa0"

	// 连接到以太坊节点
	client, err := ethclient.Dial("wss://ethereum-sepolia-rpc.publicnode.com")
	if err != nil {
		log.Fatal("Failed to connect to the Ethereum client: ", err)
	}

	// Airdrop 合约地址
	airdropContractAddress := common.HexToAddress(airdropContractAddressStr)

	// StockToken 合约地址转换成[]common.Address
	stockTokens := make([]common.Address, len(stockTokenAddresses))
	for i, addr := range stockTokenAddresses {
		stockTokens[i] = common.HexToAddress(addr)
	}

	// DefiAggregator 合约地址
	defiAggregatorAddress := common.HexToAddress(defiAggregatorAddressStr)

	// 事件的 topic hashes
	// AirDropClaim 事件签名: AirDropClaim(address indexed user, uint256 indexed taskId, uint256 amount)
	airdropTopicHash := crypto.Keccak256Hash([]byte("AirDropClaim(address,uint256,uint256,uint256)"))

	// TokenPurchased 事件签名: TokenPurchased(address indexed buyer, string stockSymbol, uint256 usdtAmount, uint256 tokenAmount, uint256 price)
	tokenPurchasedTopicHash := crypto.Keccak256Hash([]byte("TokenPurchased(address,string,uint256,uint256,uint256)"))

	// TokenSold 事件签名: TokenSold(address indexed seller, string stockSymbol, uint256 tokenAmount, uint256 usdtAmount, uint256 price)
	tokenSoldTopicHash := crypto.Keccak256Hash([]byte("TokenSold(address,string,uint256,uint256,uint256)"))

	// OperationExecuted 事件签名: OperationExecuted(address indexed user, string adapterName, uint8 indexed operationType)
	operationExecutedTopicHash := crypto.Keccak256Hash([]byte("OperationExecuted(address,string,uint8)"))

	// 创建查询过滤器 - 监听所有合约的所有事件
	allAddresses := append([]common.Address{airdropContractAddress, defiAggregatorAddress}, stockTokens...)
	allTopics := []common.Hash{airdropTopicHash, tokenPurchasedTopicHash, tokenSoldTopicHash, operationExecutedTopicHash}

	query := ethereum.FilterQuery{
		Addresses: allAddresses,
		Topics:    [][]common.Hash{allTopics},
	}

	// 监听事件
	logs := make(chan types.Log)
	sub, err := client.SubscribeFilterLogs(context.Background(), query, logs)
	if err != nil {
		log.Fatal("Failed to subscribe to event logs: ", err)
	}

	fmt.Printf("开始监听以下合约的事件:\n")
	fmt.Printf("  Airdrop 合约 (%s)\n", airdropContractAddress.Hex())
	fmt.Printf("  StockToken 合约 (%v)\n", stockTokenAddresses)
	fmt.Printf("  DefiAggregator 合约 (%s)\n", defiAggregatorAddress.Hex())

	// 处理事件
	for {
		select {
		case err := <-sub.Err():
			log.Fatal("Error in log subscription: ", err)
		case vLog := <-logs:
			// 根据 topic hash 判断事件类型并解析
			switch vLog.Topics[0] {
			case airdropTopicHash:
				// 解析 AirDropClaim 事件
				event, err := parseAirDropClaimEvent(vLog)
				if err != nil {
					log.Println("Failed to parse AirDropClaim event: ", err)
					continue
				}

				// 打印事件信息
				fmt.Printf("检测到 AirDropClaim 事件:\n")
				fmt.Printf("  用户地址: %s\n", event.User.Hex())
				fmt.Printf("  任务ID: %s\n", event.BatchID.String())
				fmt.Printf("  奖励数量: %s\n", event.Amount.String())
				fmt.Printf("  交易哈希: %s\n", vLog.TxHash.Hex())
				fmt.Printf("  区块号: %d\n", vLog.BlockNumber)
				fmt.Println("------------------------")

				// 更新任务状态
				fmt.Printf("正在更新用户任务状态: 用户地址=%s, 任务ID=%s, 状态=claimed, 交易哈希=%s\n",
					event.User.Hex(), event.BatchID.String(), vLog.TxHash.Hex())

				// 调用DAO方法更新任务状态
				if err := svcCtx.Dao.UpdateAirdropUserTaskStatus(event.User.Hex(), event.BatchID, event.TaskID, "rewarded", vLog.TxHash.Hex()); err != nil {
					log.Printf("更新用户任务状态失败: %v", err)
				} else {
					fmt.Printf("用户任务状态更新完成\n")
				}

			case tokenPurchasedTopicHash:
				// 解析 TokenPurchased 事件
				event, err := parseTokenPurchasedEvent(vLog)
				if err != nil {
					log.Println("Failed to parse TokenPurchased event: ", err)
					continue
				}

				// 打印事件信息
				fmt.Printf("检测到 TokenPurchased 事件:\n")
				fmt.Printf("  买家地址: %s\n", event.Buyer.Hex())
				fmt.Printf("  股票代码: %s\n", event.StockSymbol)
				fmt.Printf("  USDT数量: %s\n", event.UsdtAmount.String())
				fmt.Printf("  代币数量: %s\n", event.TokenAmount.String())
				fmt.Printf("  价格: %s\n", event.Price.String())
				fmt.Printf("  交易哈希: %s\n", vLog.TxHash.Hex())
				fmt.Printf("  区块号: %d\n", vLog.BlockNumber)
				fmt.Println("------------------------")

			case tokenSoldTopicHash:
				// 解析 TokenSold 事件
				event, err := parseTokenSoldEvent(vLog)
				if err != nil {
					log.Println("Failed to parse TokenSold event: ", err)
					continue
				}

				// 打印事件信息
				fmt.Printf("检测到 TokenSold 事件:\n")
				fmt.Printf("  卖家地址: %s\n", event.Seller.Hex())
				fmt.Printf("  股票代码: %s\n", event.StockSymbol)
				fmt.Printf("  代币数量: %s\n", event.TokenAmount.String())
				fmt.Printf("  USDT数量: %s\n", event.UsdtAmount.String())
				fmt.Printf("  价格: %s\n", event.Price.String())
				fmt.Printf("  交易哈希: %s\n", vLog.TxHash.Hex())
				fmt.Printf("  区块号: %d\n", vLog.BlockNumber)
				fmt.Println("------------------------")

			case operationExecutedTopicHash:
				// 解析 OperationExecuted 事件
				event, err := parseOperationExecutedEvent(vLog)
				if err != nil {
					log.Println("Failed to parse OperationExecuted event: ", err)
					continue
				}

				// 打印事件信息
				fmt.Printf("检测到 OperationExecuted 事件:\n")
				fmt.Printf("  用户地址: %s\n", event.User.Hex())
				fmt.Printf("  适配器名称: %s\n", event.AdapterName)
				fmt.Printf("  操作类型: %s\n", event.OperationType.String())
				fmt.Printf("  交易哈希: %s\n", vLog.TxHash.Hex())
				fmt.Printf("  区块号: %d\n", vLog.BlockNumber)
				fmt.Println("------------------------")
			}
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
	// topics[2] = batchId (indexed)
	// topics[3] = taskId (indexed)
	event.User = common.BytesToAddress(vLog.Topics[1].Bytes())
	event.BatchID = new(big.Int).SetBytes(vLog.Topics[2].Bytes())
	event.TaskID = new(big.Int).SetBytes(vLog.Topics[3].Bytes())

	// 从 data 中解析非 indexed 参数
	// data[0:32] = amount
	if len(vLog.Data) >= 32 {
		event.Amount = new(big.Int).SetBytes(vLog.Data[0:32])
	} else {
		return nil, fmt.Errorf("invalid data length: %d", len(vLog.Data))
	}

	return event, nil
}

// parseTokenPurchasedEvent 解析 TokenPurchased 事件
func parseTokenPurchasedEvent(vLog types.Log) (*TokenPurchasedEvent, error) {
	event := new(TokenPurchasedEvent)

	// 确保有足够的 topics (至少2个: topic0, buyer)
	if len(vLog.Topics) < 2 {
		return nil, fmt.Errorf("invalid number of topics: %d", len(vLog.Topics))
	}

	// 从 topics 中解析 indexed 参数
	// topics[0] = 事件签名哈希
	// topics[1] = buyer (indexed)
	event.Buyer = common.BytesToAddress(vLog.Topics[1].Bytes())

	// 从 data 中解析非 indexed 参数
	// data[0:32] = stockSymbol offset (通常为0x20)
	// data[32:64] = stockSymbol length
	// data[64:96] = usdtAmount
	// data[96:128] = tokenAmount
	// data[128:160] = price
	if len(vLog.Data) >= 160 {
		// 解析 stockSymbol 字符串
		offset := new(big.Int).SetBytes(vLog.Data[0:32])
		length := new(big.Int).SetBytes(vLog.Data[32:64])

		// 确保偏移量和长度在合理范围内
		if offset.Uint64() == 32 && length.Uint64() > 0 && 64+length.Uint64()*32 <= uint64(len(vLog.Data)) {
			// 读取字符串数据
			start := 64
			end := start + int(length.Uint64()*32)
			if end <= len(vLog.Data) {
				// 简单处理字符串（实际Solidity字符串编码可能更复杂）
				symbolBytes := vLog.Data[start:end]
				event.StockSymbol = strings.TrimRight(string(symbolBytes), "\x00")
			}
		}

		event.UsdtAmount = new(big.Int).SetBytes(vLog.Data[64:96])
		event.TokenAmount = new(big.Int).SetBytes(vLog.Data[96:128])
		event.Price = new(big.Int).SetBytes(vLog.Data[128:160])
	} else {
		return nil, fmt.Errorf("invalid data length: %d", len(vLog.Data))
	}

	return event, nil
}

// parseTokenSoldEvent 解析 TokenSold 事件
func parseTokenSoldEvent(vLog types.Log) (*TokenSoldEvent, error) {
	event := new(TokenSoldEvent)

	// 确保有足够的 topics (至少2个: topic0, seller)
	if len(vLog.Topics) < 2 {
		return nil, fmt.Errorf("invalid number of topics: %d", len(vLog.Topics))
	}

	// 从 topics 中解析 indexed 参数
	// topics[0] = 事件签名哈希
	// topics[1] = seller (indexed)
	event.Seller = common.BytesToAddress(vLog.Topics[1].Bytes())

	// 从 data 中解析非 indexed 参数
	// data[0:32] = stockSymbol offset (通常为0x20)
	// data[32:64] = stockSymbol length
	// data[64:96] = tokenAmount
	// data[96:128] = usdtAmount
	// data[128:160] = price
	if len(vLog.Data) >= 160 {
		// 解析 stockSymbol 字符串
		offset := new(big.Int).SetBytes(vLog.Data[0:32])
		length := new(big.Int).SetBytes(vLog.Data[32:64])

		// 确保偏移量和长度在合理范围内
		if offset.Uint64() == 32 && length.Uint64() > 0 && 64+length.Uint64()*32 <= uint64(len(vLog.Data)) {
			// 读取字符串数据
			start := 64
			end := start + int(length.Uint64()*32)
			if end <= len(vLog.Data) {
				// 简单处理字符串（实际Solidity字符串编码可能更复杂）
				symbolBytes := vLog.Data[start:end]
				event.StockSymbol = strings.TrimRight(string(symbolBytes), "\x00")
			}
		}

		event.TokenAmount = new(big.Int).SetBytes(vLog.Data[64:96])
		event.UsdtAmount = new(big.Int).SetBytes(vLog.Data[96:128])
		event.Price = new(big.Int).SetBytes(vLog.Data[128:160])
	} else {
		return nil, fmt.Errorf("invalid data length: %d", len(vLog.Data))
	}

	return event, nil
}

// parseOperationExecutedEvent 解析 OperationExecuted 事件
func parseOperationExecutedEvent(vLog types.Log) (*OperationExecutedEvent, error) {
	event := new(OperationExecutedEvent)

	// 确保有足够的 topics (至少3个: topic0, user, operationType)
	if len(vLog.Topics) < 3 {
		return nil, fmt.Errorf("invalid number of topics: %d", len(vLog.Topics))
	}

	// 从 topics 中解析 indexed 参数
	// topics[0] = 事件签名哈希
	// topics[1] = user (indexed)
	// topics[2] = operationType (indexed)
	event.User = common.BytesToAddress(vLog.Topics[1].Bytes())
	event.OperationType = new(big.Int).SetBytes(vLog.Topics[2].Bytes())

	// 从 data 中解析非 indexed 参数
	// data[0:32] = adapterName offset (通常为0x20)
	// data[32:64] = adapterName length
	if len(vLog.Data) >= 64 {
		// 解析 adapterName 字符串
		offset := new(big.Int).SetBytes(vLog.Data[0:32])
		length := new(big.Int).SetBytes(vLog.Data[32:64])

		// 确保偏移量和长度在合理范围内
		if offset.Uint64() == 32 && length.Uint64() > 0 && 64+length.Uint64()*32 <= uint64(len(vLog.Data)) {
			// 读取字符串数据
			start := 64
			end := start + int(length.Uint64()*32)
			if end <= len(vLog.Data) {
				// 简单处理字符串（实际Solidity字符串编码可能更复杂）
				adapterBytes := vLog.Data[start:end]
				event.AdapterName = strings.TrimRight(string(adapterBytes), "\x00")
			}
		}
	} else {
		return nil, fmt.Errorf("invalid data length: %d", len(vLog.Data))
	}

	return event, nil
}
