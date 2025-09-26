package utils

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

// ReadABI 从指定目录下读取abi文件
func ReadABI(filePath string) (abi.ABI, error) {
	// Read the file content
	data, err := os.ReadFile(filePath)
	if err != nil {
		return abi.ABI{}, fmt.Errorf("failed to read ABI file: %w", err)
	}

	// Parse the JSON content
	var abiFromPath abi.ABI
	if err := json.Unmarshal(data, &abiFromPath); err != nil {
		return abi.ABI{}, fmt.Errorf("failed to parse ABI JSON: %w", err)
	}

	return abiFromPath, nil
}
