package common

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/locey/CryptoStock/StockCoinBase/evm/eip"
	"github.com/pkg/errors"

	"github.com/locey/CryptoStock/StockCoinEnd/common/utils"
)

func UnifyAddress(address string) (string, error) {
	if len(address) <= 2 || !common.IsHexAddress(address) {
		return "", errors.New("user address is illegal")
	}

	addr, err := eip.ToCheckSumAddress(address)
	if err != nil {
		return "", errors.Wrap(err, "invalid address")
	}

	if addr != utils.ToValidateAddress(addr) {
		return "", errors.Wrap(err, "failed on unify address")
	}

	return addr, nil
}
