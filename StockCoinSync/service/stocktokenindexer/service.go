package stocktokenindexer

import (
	"context"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	ethereumTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/locey/CryptoStock/StockCoinBase/chain/chainclient"
	"github.com/locey/CryptoStock/StockCoinBase/chain/types"
	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"

	//"github.com/locey/CryptoStock/StockCoinBase/ordermanager"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/stocktokenmodel/base"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/stocktokenmodel/multi"
	"github.com/locey/CryptoStock/StockCoinBase/stores/xkv"
	"github.com/shopspring/decimal"
	"github.com/zeromicro/go-zero/core/threading"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/locey/CryptoStock/StockCoinSync/service/config"
)

const (
	EventIndexType    = 0  //合约的事件类型 0为StockToken合约事件
	SleepInterval     = 10 // in seconds
	SyncBlockPeriod   = 10
	LogPurchasedTopic = "0x56a4595ce78f0d5bdfa9a7bae14f8fc1a12cc8dc813877b02629396412a1599f" //keccak256("TokenPurchased(address,string,uint256,uint256,uint256)");
	LogTokenSoldTopic = "0x1bd9eda01c8e8bf59e44853566034cca1fd20f1138ac11e9a2405999592ec0d7" ///keccak256("TokenSold(address,string,uint256,uint256,uint256)");
	contractAbi       = `[{"inputs":[],"name":"CannotFindNextEmptyKey","type":"error"},{"inputs":[],"name":"CannotFindPrevEmptyKey","type":"error"},{"inputs":[{"internalType":"OrderKey","name":"orderKey","type":"bytes32"}],"name":"CannotInsertDuplicateOrder","type":"error"},{"inputs":[],"name":"CannotInsertEmptyKey","type":"error"},{"inputs":[],"name":"CannotInsertExistingKey","type":"error"},{"inputs":[],"name":"CannotRemoveEmptyKey","type":"error"},{"inputs":[],"name":"CannotRemoveMissingKey","type":"error"},{"inputs":[],"name":"EnforcedPause","type":"error"},{"inputs":[],"name":"ExpectedPause","type":"error"},{"inputs":[],"name":"InvalidInitialization","type":"error"},{"inputs":[],"name":"NotInitializing","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"offset","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"msg","type":"bytes"}],"name":"BatchMatchInnerError","type":"event"},{"anonymous":false,"inputs":[],"name":"EIP712DomainChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint64","name":"version","type":"uint64"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"OrderKey","name":"orderKey","type":"bytes32"},{"indexed":true,"internalType":"address","name":"maker","type":"address"}],"name":"LogCancel","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"OrderKey","name":"orderKey","type":"bytes32"},{"indexed":true,"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"indexed":true,"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"indexed":true,"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"indexed":false,"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"indexed":false,"internalType":"Price","name":"price","type":"uint128"},{"indexed":false,"internalType":"uint64","name":"expiry","type":"uint64"},{"indexed":false,"internalType":"uint64","name":"salt","type":"uint64"}],"name":"LogMake","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"OrderKey","name":"makeOrderKey","type":"bytes32"},{"indexed":true,"internalType":"OrderKey","name":"takeOrderKey","type":"bytes32"},{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"indexed":false,"internalType":"structLibOrder.Order","name":"makeOrder","type":"tuple"},{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"indexed":false,"internalType":"structLibOrder.Order","name":"takeOrder","type":"tuple"},{"indexed":false,"internalType":"uint128","name":"fillPrice","type":"uint128"}],"name":"LogMatch","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"OrderKey","name":"orderKey","type":"bytes32"},{"indexed":false,"internalType":"uint64","name":"salt","type":"uint64"}],"name":"LogSkipOrder","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint128","name":"newProtocolShare","type":"uint128"}],"name":"LogUpdatedProtocolShare","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"LogWithdrawETH","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"inputs":[{"internalType":"OrderKey[]","name":"orderKeys","type":"bytes32[]"}],"name":"cancelOrders","outputs":[{"internalType":"bool[]","name":"successes","type":"bool[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"OrderKey","name":"oldOrderKey","type":"bytes32"},{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"newOrder","type":"tuple"}],"internalType":"structLibOrder.EditDetail[]","name":"editDetails","type":"tuple[]"}],"name":"editOrders","outputs":[{"internalType":"OrderKey[]","name":"newOrderKeys","type":"bytes32[]"}],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"eip712Domain","outputs":[{"internalType":"bytes1","name":"fields","type":"bytes1"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"version","type":"string"},{"internalType":"uint256","name":"chainId","type":"uint256"},{"internalType":"address","name":"verifyingContract","type":"address"},{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"uint256[]","name":"extensions","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"OrderKey","name":"","type":"bytes32"}],"name":"filledAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"}],"name":"getBestOrder","outputs":[{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"orderResult","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"collection","type":"address"},{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"}],"name":"getBestPrice","outputs":[{"internalType":"Price","name":"price","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"collection","type":"address"},{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"Price","name":"price","type":"uint128"}],"name":"getNextBestPrice","outputs":[{"internalType":"Price","name":"nextBestPrice","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"uint256","name":"count","type":"uint256"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"OrderKey","name":"firstOrderKey","type":"bytes32"}],"name":"getOrders","outputs":[{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order[]","name":"resultOrders","type":"tuple[]"},{"internalType":"OrderKey","name":"nextOrderKey","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint128","name":"newProtocolShare","type":"uint128"},{"internalType":"address","name":"newVault","type":"address"},{"internalType":"string","name":"EIP712Name","type":"string"},{"internalType":"string","name":"EIP712Version","type":"string"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order[]","name":"newOrders","type":"tuple[]"}],"name":"makeOrders","outputs":[{"internalType":"OrderKey[]","name":"newOrderKeys","type":"bytes32[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"sellOrder","type":"tuple"},{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"buyOrder","type":"tuple"}],"name":"matchOrder","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"sellOrder","type":"tuple"},{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"buyOrder","type":"tuple"},{"internalType":"uint256","name":"msgValue","type":"uint256"}],"name":"matchOrderWithoutPayback","outputs":[{"internalType":"uint128","name":"costValue","type":"uint128"}],"stateMutability":"payable","type":"function"},{"inputs":[{"components":[{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"sellOrder","type":"tuple"},{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"buyOrder","type":"tuple"}],"internalType":"structLibOrder.MatchDetail[]","name":"matchDetails","type":"tuple[]"}],"name":"matchOrders","outputs":[{"internalType":"bool[]","name":"successes","type":"bool[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"enumLibOrder.Side","name":"","type":"uint8"},{"internalType":"Price","name":"","type":"uint128"}],"name":"orderQueues","outputs":[{"internalType":"OrderKey","name":"head","type":"bytes32"},{"internalType":"OrderKey","name":"tail","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"OrderKey","name":"","type":"bytes32"}],"name":"orders","outputs":[{"components":[{"internalType":"enumLibOrder.Side","name":"side","type":"uint8"},{"internalType":"enumLibOrder.SaleKind","name":"saleKind","type":"uint8"},{"internalType":"address","name":"maker","type":"address"},{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"address","name":"collection","type":"address"},{"internalType":"uint96","name":"amount","type":"uint96"}],"internalType":"structLibOrder.Asset","name":"nft","type":"tuple"},{"internalType":"Price","name":"price","type":"uint128"},{"internalType":"uint64","name":"expiry","type":"uint64"},{"internalType":"uint64","name":"salt","type":"uint64"}],"internalType":"structLibOrder.Order","name":"order","type":"tuple"},{"internalType":"OrderKey","name":"next","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"enumLibOrder.Side","name":"","type":"uint8"}],"name":"priceTrees","outputs":[{"internalType":"Price","name":"root","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"protocolShare","outputs":[{"internalType":"uint128","name":"","type":"uint128"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint128","name":"newProtocolShare","type":"uint128"}],"name":"setProtocolShare","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newVault","type":"address"}],"name":"setVault","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdrawETH","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]`
	HexPrefix         = "0x"
	ZeroAddress       = "0x0000000000000000000000000000000000000000"
)

type Order struct {
	Side     uint8
	SaleKind uint8
	Maker    common.Address
	Nft      struct {
		TokenId        *big.Int
		CollectionAddr common.Address
		Amount         *big.Int
	}
	Price  *big.Int
	Expiry uint64
	Salt   uint64
}

type Service struct {
	ctx context.Context
	cfg *config.Config
	db  *gorm.DB
	kv  *xkv.Store
	//orderManager *ordermanager.OrderManager
	chainClient chainclient.ChainClient
	chainId     int64
	chain       string
	parsedAbi   abi.ABI
}

var MultiChainMaxBlockDifference = map[string]uint64{
	"eth":        1,
	"optimism":   2,
	"starknet":   1,
	"arbitrum":   2,
	"base":       2,
	"zksync-era": 2,
}

// func New(ctx context.Context, cfg *config.Config, db *gorm.DB, xkv *xkv.Store, chainClient chainclient.ChainClient, chainId int64, chain string, orderManager *ordermanager.OrderManager) *Service {
func New(ctx context.Context, cfg *config.Config, db *gorm.DB, xkv *xkv.Store, chainClient chainclient.ChainClient, chainId int64, chain string) *Service {
	parsedAbi, _ := abi.JSON(strings.NewReader(contractAbi)) // 通过ABI实例化
	return &Service{
		ctx:         ctx,
		cfg:         cfg,
		db:          db,
		kv:          xkv,
		chainClient: chainClient,
		//orderManager: orderManager,
		chain:     chain,
		chainId:   chainId,
		parsedAbi: parsedAbi,
	}
}

func (s *Service) Start() {
	threading.GoSafe(s.SyncStockTokenEventLoop)
}

func (s *Service) SyncStockTokenEventLoop() {
	var indexedStatus base.IndexedStatus
	if err := s.db.WithContext(s.ctx).Table(base.IndexedStatusTableName()).
		Where("chain_id = ? and index_type = ?", s.chainId, EventIndexType).
		First(&indexedStatus).Error; err != nil {
		xzap.WithContext(s.ctx).Error("failed on get listing index status",
			zap.Error(err))
		return
	}

	lastSyncBlock := uint64(indexedStatus.LastIndexedBlock)
	for {
		select {
		case <-s.ctx.Done():
			xzap.WithContext(s.ctx).Info("SyncStockTokenEventLoop stopped due to context cancellation")
			return
		default:
		}

		currentBlockNum, err := s.chainClient.BlockNumber() // 以轮询的方式获取当前区块高度
		if err != nil {
			xzap.WithContext(s.ctx).Error("failed on get current block number", zap.Error(err))
			time.Sleep(SleepInterval * time.Second)
			continue
		}

		if lastSyncBlock > currentBlockNum-MultiChainMaxBlockDifference[s.chain] { // 如果上次同步的区块高度大于当前区块高度，等待一段时间后再次轮询
			time.Sleep(SleepInterval * time.Second)
			continue
		}

		startBlock := lastSyncBlock
		endBlock := startBlock + SyncBlockPeriod
		if endBlock > currentBlockNum-MultiChainMaxBlockDifference[s.chain] { // 如果结束区块高度大于当前区块高度，将结束区块高度设置为当前区块高度
			endBlock = currentBlockNum - MultiChainMaxBlockDifference[s.chain]
		}

		query := types.FilterQuery{
			FromBlock: new(big.Int).SetUint64(startBlock),
			ToBlock:   new(big.Int).SetUint64(endBlock),
			Addresses: []string{s.cfg.ContractCfg.DexAddress},
		}

		logs, err := s.chainClient.FilterLogs(s.ctx, query) //同时获取多个（SyncBlockPeriod）区块的日志
		if err != nil {
			xzap.WithContext(s.ctx).Error("failed on get log", zap.Error(err))
			time.Sleep(SleepInterval * time.Second)
			continue
		}

		for _, log := range logs { // 遍历日志，根据不同的topic处理不同的事件
			ethLog := log.(ethereumTypes.Log)
			switch ethLog.Topics[0].String() {
			case LogPurchasedTopic:
				s.handlePurchasedEvent(ethLog)
			case LogTokenSoldTopic:
				s.handleTokenSoldEvent(ethLog)
			default:
			}
		}

		lastSyncBlock = endBlock + 1 // 更新最后同步的区块高度
		if err := s.db.WithContext(s.ctx).Table(base.IndexedStatusTableName()).
			Where("chain_id = ? and index_type = ?", s.chainId, EventIndexType).
			Update("last_indexed_block", lastSyncBlock).Error; err != nil {
			xzap.WithContext(s.ctx).Error("failed on update orderbook event sync block number",
				zap.Error(err))
			return
		}

		xzap.WithContext(s.ctx).Info("sync orderbook event ...",
			zap.Uint64("start_block", startBlock),
			zap.Uint64("end_block", endBlock))
	}
}

// 处理挂单事件
func (s *Service) handlePurchasedEvent(log ethereumTypes.Log) {
	var event struct {
		UsdtAmount  *big.Int
		TokenAmount *big.Int
		Price       *big.Int
	}

	// Unpack data
	err := s.parsedAbi.UnpackIntoInterface(&event, "TokenPurchased", log.Data) // 通过ABI解析日志数据
	if err != nil {
		xzap.WithContext(s.ctx).Error("Error unpacking TokenPurchased event:", zap.Error(err))
		return
	}
	// Extract indexed fields from topics
	buyer := common.BytesToAddress(log.Topics[1].Bytes())
	stockSymbol := string(log.Topics[2].Bytes())
	blockTime, err := s.chainClient.BlockTimeByNumber(s.ctx, big.NewInt(int64(log.BlockNumber)))
	if err != nil {
		xzap.WithContext(s.ctx).Error("failed to get block time", zap.Error(err))
		return
	}
	newActivity := multi.Activity{ // 将订单信息存入活动表
		ActivityType:   multi.Buy,
		UserAddress:    buyer.String(),
		TokenSymbol:    stockSymbol,
		CurrentPrice:   decimal.NewFromBigInt(event.Price, 0),
		TokenAmount:    decimal.NewFromBigInt(event.TokenAmount, 0),
		CurrencyAmount: decimal.NewFromBigInt(event.UsdtAmount, 0),
		BlockNumber:    int64(log.BlockNumber),
		TxHash:         log.TxHash.String(),
		EventTime:      int64(blockTime),
	}
	if err := s.db.WithContext(s.ctx).Table(multi.ActivityTableName(s.chain)).Clauses(clause.OnConflict{
		DoNothing: true,
	}).Create(&newActivity).Error; err != nil {
		xzap.WithContext(s.ctx).Warn("failed on create activity",
			zap.Error(err))
	}
}

func (s *Service) handleTokenSoldEvent(log ethereumTypes.Log) {
	var event struct {
		UsdtAmount  *big.Int
		TokenAmount *big.Int
		Price       *big.Int
	}

	// Unpack data
	err := s.parsedAbi.UnpackIntoInterface(&event, "TokenPurchased", log.Data) // 通过ABI解析日志数据
	if err != nil {
		xzap.WithContext(s.ctx).Error("Error unpacking TokenPurchased event:", zap.Error(err))
		return
	}
	// Extract indexed fields from topics
	seller := common.BytesToAddress(log.Topics[1].Bytes())
	stockSymbol := string(log.Topics[2].Bytes())
	blockTime, err := s.chainClient.BlockTimeByNumber(s.ctx, big.NewInt(int64(log.BlockNumber)))
	if err != nil {
		xzap.WithContext(s.ctx).Error("failed to get block time", zap.Error(err))
		return
	}
	newActivity := multi.Activity{ // 将股票信息存入活动表
		ActivityType:   multi.Sell,
		UserAddress:    seller.String(),
		TokenSymbol:    stockSymbol,
		CurrentPrice:   decimal.NewFromBigInt(event.Price, 0),
		TokenAmount:    decimal.NewFromBigInt(event.TokenAmount, 0),
		CurrencyAmount: decimal.NewFromBigInt(event.UsdtAmount, 0),
		BlockNumber:    int64(log.BlockNumber),
		TxHash:         log.TxHash.String(),
		EventTime:      int64(blockTime),
	}
	if err := s.db.WithContext(s.ctx).Table(multi.ActivityTableName(s.chain)).Clauses(clause.OnConflict{
		DoNothing: true,
	}).Create(&newActivity).Error; err != nil {
		xzap.WithContext(s.ctx).Warn("failed on create activity",
			zap.Error(err))
	}
}
