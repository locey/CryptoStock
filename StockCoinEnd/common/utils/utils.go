package utils

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/anyswap/CrossChain-Bridge/common"
	"github.com/go-playground/validator/v10"
)

var (
	validatorM map[string]validator.Func
	patternM   map[string]string
)

func init() {
	validatorM = map[string]validator.Func{
		"symbol":  rightSymbol,
		"address": regexpValidator,
	}
	patternM = map[string]string{
		"address": `^0x[a-fA-F0-9]{40}$`,
	}
}

var (
	// validator for symbol string
	rightSymbol validator.Func = func(fl validator.FieldLevel) bool {
		symbol, ok := fl.Field().Interface().(string)
		if ok {
			return len(symbol) < 10
		}
		return false
	}

	// validator for common regexp
	regexpValidator validator.Func = func(fl validator.FieldLevel) bool {
		key, _ := fl.Field().Interface().(string)
		pattern, ok := patternM[fl.GetTag()]
		if ok {
			match, _ := regexp.MatchString(pattern, key)
			return match
		}
		return false
	}
)

func ToValidateAddress(address string) string {
	addrLowerStr := strings.ToLower(address)
	if strings.HasPrefix(addrLowerStr, "0x") {
		addrLowerStr = addrLowerStr[2:]
		address = address[2:]
	}
	var binaryStr string
	addrBytes := []byte(addrLowerStr)

	hash256 := common.Keccak256Hash([]byte(addrLowerStr)) //注意，这里是直接对字符串转换成byte切片然后哈希

	for i, e := range addrLowerStr {
		//如果是数字则跳过
		if e >= '0' && e <= '9' {
			continue
		} else {
			binaryStr = fmt.Sprintf("%08b", hash256[i/2]) //注意，这里一定要填充0
			if binaryStr[4*(i%2)] == '1' {
				addrBytes[i] -= 32
			}
		}
	}

	return "0x" + string(addrBytes)
}
