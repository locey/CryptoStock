package types

import (
	"math/big"

	"github.com/ethereum/go-ethereum"
)

type CallParam struct {
	EVMParam    ethereum.CallMsg
	BlockNumber *big.Int
}
