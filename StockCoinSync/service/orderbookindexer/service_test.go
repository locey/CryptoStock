package orderbookindexer

import (
	"context"
	"math/big"
	"testing"

	ethereumTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/locey/CryptoStock/StockCoinBase/chain/chainclient"
	"github.com/locey/CryptoStock/StockCoinBase/chain/types"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb"

	"github.com/locey/CryptoStock/StockCoinSync/model"
)

func TestSyncEvent(t *testing.T) {
	ctx := context.Background()
	db := model.NewDB(&gdb.Config{
		User:         "orderbook",
		Password:     "SM1tnJjhVnDWUbqO",
		Host:         "a95467a044b9f4f1399fa1221969c7fd-799134117.us-east-1.elb.amazonaws.com",
		Port:         4000,
		Database:     "orderbook_test",
		MaxIdleConns: 10,
		MaxOpenConns: 1500,
	})

	chainClient, _ := chainclient.New(10, "https://rpc.ankr.com/optimism/9c6c678ebcb56da1cb80f7632c7c02264831232c3d53453c7726a611e7ca36d7")
	//orderbookSyncer := New(ctx, nil, db, nil, chainClient, 10, "optimism", nil)
	orderbookSyncer := New(ctx, nil, db, nil, chainClient, 10, "optimism")
	query := types.FilterQuery{
		FromBlock: new(big.Int).SetUint64(111819366),
		ToBlock:   new(big.Int).SetUint64(111819366),
		Addresses: []string{"0x7d29d1860bD4d3A74bBD9a03C9B043d375311dCb"},
	}

	logs, _ := chainClient.FilterLogs(ctx, query)

	for _, log := range logs {
		ethLog := log.(ethereumTypes.Log)
		switch ethLog.Topics[0].String() {
		case LogMakeTopic:
			orderbookSyncer.handleMakeEvent(ethLog)
		case LogCancelTopic:
			orderbookSyncer.handleCancelEvent(ethLog)
		case LogMatchTopic:
			orderbookSyncer.handleMatchEvent(ethLog)
		default:

		}
	}
}

func TestHandleMakeEvent(t *testing.T) {
	// ctx := context.Background()
	// db := model.NewDB(&gdb.Config{
	// 	User:         "orderbook",
	// 	Password:     "SM1tnJjhVnDWUbqO",
	// 	Host:         "a95467a044b9f4f1399fa1221969c7fd-799134117.us-east-1.elb.amazonaws.com",
	// 	Port:         4000,
	// 	Database:     "orderbook_test",
	// 	MaxIdleConns: 10,
	// 	MaxOpenConns: 1500,
	// })
	// chainClient, _ := chainclient.New(10, "https://rpc.ankr.com/optimism/9c6c678ebcb56da1cb80f7632c7c02264831232c3d53453c7726a611e7ca36d7")
	// // orderbookSyncer := New(ctx, nil, db, nil, chainClient, 10, "optimism", nil)
	// data, _ := hex.DecodeString("c773ae81bc9a186dc6c5d70a486730a6f734578ae1a0116acd0aaaf69250d2650000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e7f1725e7734ce288f8367e1bb143e90bb3f05120000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000000000006558875d0000000000000000000000000000000000000000000000000000000000000001")
	// log := ethereumTypes.Log{
	// 	Address: common.HexToAddress("0x123"),
	// 	Topics: []common.Hash{
	// 		common.HexToHash("0xfc37f2ff950f95913eb7182357ba3c14df60ef354bc7d6ab1ba2815f249fffe6"),
	// 		common.HexToHash("0x0000000000000000000000000000000000000000000000000000000000000000"),
	// 		common.HexToHash("0x0000000000000000000000000000000000000000000000000000000000000001"),
	// 		common.HexToHash("0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266"),
	// 	},
	// 	Data:        data,
	// 	BlockNumber: 111482956,
	// 	TxHash:      common.HexToHash("0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266"),
	// }
	// orderbookSyncer.handleMakeEvent(log)
}
