package nftchainservice

import (
	"context"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/pkg/errors"

	"github.com/locey/CryptoStock/StockCoinBase/chain/chainclient"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"
)

const defaultTimeout = 10 //uint s

type NodeService interface {
	FetchOnChainMetadata(chainID int64, collectionAddr string, tokenID string) (*JsonMetadata, error)
	FetchNftOwner(chainID int64, collectionAddr string, tokenID string) (common.Address, error)
	GetNFTTransferEvent(chainName string, fromBlock, toBlock uint64) ([]*TransferLog, error)
	GetNFTTransferEventGoroutine(chainName string, fromBlock, toBlock, blockSize, channelSize uint64) ([]*TransferLog, error)
}

type Service struct {
	ctx context.Context

	Abi            *abi.ABI
	HttpClient     *xhttp.Client
	NodeClient     chainclient.ChainClient
	ChainName      string
	NodeName       string
	NameTags       []string
	ImageTags      []string
	AttributesTags []string
	TraitNameTags  []string
	TraitValueTags []string
}

func New(ctx context.Context, endpoint, chainName string, chainID int, nameTags, imageTags, attributesTags,
	traitNameTags, traitValueTags []string) (*Service, error) {
	conf := xhttp.GetDefaultConfig()
	conf.ForceAttemptHTTP2 = false
	conf.HTTPTimeout = time.Duration(defaultTimeout) * time.Second
	conf.DialTimeout = time.Duration(defaultTimeout-5) * time.Second
	conf.DialKeepAlive = time.Duration(defaultTimeout+10) * time.Second

	nodeClient, err := chainclient.New(chainID, endpoint)
	if err != nil {
		return nil, errors.Wrap(err, "failed on create node client")
	}

	abi, err := NftContractMetaData.GetAbi()
	if err != nil {
		return nil, errors.Wrap(err, "failed on get contract abi")
	}

	return &Service{
		ctx:            ctx,
		Abi:            abi,
		HttpClient:     xhttp.NewClient(conf),
		NodeClient:     nodeClient,
		ChainName:      chainName,
		NameTags:       nameTags,
		ImageTags:      imageTags,
		AttributesTags: attributesTags,
		TraitNameTags:  traitNameTags,
		TraitValueTags: traitValueTags,
	}, nil
}
