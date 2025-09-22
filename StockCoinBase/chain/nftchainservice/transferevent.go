package nftchainservice

import (
	"context"
	"math/big"
	"sort"

	"github.com/ethereum/go-ethereum/common"
	evmTypes "github.com/ethereum/go-ethereum/core/types"
	"github.com/pkg/errors"

	"github.com/locey/CryptoStock/StockCoinBase/chain"
	logTypes "github.com/locey/CryptoStock/StockCoinBase/chain/types"
)

const hex = 16

var EVMTransferTopic = common.HexToHash("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef")
var TokenIdExp = new(big.Int).Exp(big.NewInt(2), big.NewInt(128), nil)

var BlockTimeGap = map[string]int{
	chain.Eth:      12,
	chain.Optimism: 2,
	chain.Sepolia:  12,
}

type TransferLog struct {
	Address         string        `json:"address" gencodec:"required"`
	TransactionHash string        `json:"transactionHash" gencodec:"required"`
	BlockNumber     uint64        `json:"blockNumber"`
	BlockTime       uint64        `json:"blockTime"`
	BlockHash       string        `json:"blockHash"`
	Data            []byte        `json:"data" gencodec:"required"`
	Topics          []common.Hash `json:"topics" gencodec:"required"`
	Topic0          string        `json:"topic0"`
	From            string        `json:"topic1"`
	To              string        `json:"topic2"`
	TokenID         string        `json:"topic3"`
	TxIndex         uint          `json:"transactionIndex"`
	Index           uint          `json:"logIndex"`
	Removed         bool          `json:"removed"`
}

func (s *Service) GetNFTTransferEvent(fromBlock, toBlock uint64) ([]*TransferLog, error) {
	// get block time
	var startBlockTime uint64
	var err error
	switch s.ChainName {
	case chain.Eth, chain.Optimism, chain.Sepolia:
		blockTimestamp, err := s.NodeClient.BlockTimeByNumber(context.Background(), big.NewInt(int64(fromBlock)))
		if err != nil {
			return nil, errors.Wrap(err, "failed on get block time")
		}
		startBlockTime = blockTimestamp
	}

	var transferTopic string
	switch s.ChainName {
	case chain.Eth, chain.Optimism, chain.Sepolia:
		transferTopic = EVMTransferTopic.String()
	default:
		return nil, errors.Wrap(err, "unsupported chain")
	}

	logFilter := logTypes.FilterQuery{
		FromBlock: new(big.Int).SetUint64(fromBlock),
		ToBlock:   new(big.Int).SetUint64(toBlock),
		Topics: [][]string{
			{transferTopic},
		},
	}

	//var logs []goEthereumTypes.Log
	logs, err := s.NodeClient.FilterLogs(context.Background(), logFilter)
	if err != nil {
		return nil, errors.Wrap(err, "failed on filter logs")
	}

	var transferLogs []*TransferLog
	for _, log := range logs {
		var evmLog evmTypes.Log
		var ok bool
		evmLog, ok = log.(evmTypes.Log)
		if ok {
			var topics [4]string
			for i := range evmLog.Topics {
				topics[i] = evmLog.Topics[i].Hex()
			}
			if topics[3] == "" {
				continue
			}

			tokenId := new(big.Int).SetBytes(evmLog.Topics[3][:])
			transferLog := &TransferLog{
				Address:         evmLog.Address.String(),
				TransactionHash: evmLog.TxHash.String(),
				BlockNumber:     evmLog.BlockNumber,
				BlockTime:       startBlockTime + (evmLog.BlockNumber-fromBlock)*uint64(BlockTimeGap[s.ChainName]),
				BlockHash:       evmLog.BlockHash.String(),
				Data:            evmLog.Data,
				Topics:          evmLog.Topics,
				Topic0:          topics[0],
				From:            common.HexToAddress(topics[1]).String(),
				To:              common.HexToAddress(topics[2]).String(),
				TokenID:         tokenId.String(),
				TxIndex:         evmLog.TxIndex,
				Index:           evmLog.Index,
				Removed:         evmLog.Removed,
			}
			transferLogs = append(transferLogs, transferLog)
			continue
		}
	}

	// Sort transferLogs by block number
	sort.Slice(transferLogs, func(i, j int) bool {
		return transferLogs[i].BlockNumber < transferLogs[j].BlockNumber
	})

	return transferLogs, nil
}

func (s *Service) isInSlice(str string, slice []string) bool {
	addr, err := chain.UniformAddress(s.ChainName, str)
	if err != nil {
		return false
	}

	for _, item := range slice {
		itemAddr, _ := chain.UniformAddress(s.ChainName, item)
		if itemAddr == addr {
			return true
		}
	}
	return false
}
