package contract

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/locey/CryptoStock/StockCoinEnd/config"
)

// CSTokenContract 封装了CSToken合约的交互方法
type CSTokenContract struct {
	client      *ethclient.Client
	config      *config.Config
	contractABI abi.ABI
	address     common.Address
}

// 空投事件结构
type AirdropResult struct {
	Address string
	Amount  *big.Int
	TxHash  string
	Success bool
	Error   string
}

// 合约ABI（简化版本，只包含我们需要的方法）
const contractABI = `[
    {
        "inputs": [
            {
                "internalType": "address[]",
                "name": "recipients",
                "type": "address[]"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "reason",
                "type": "string"
            }
        ],
        "name": "airdrop",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "paused",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "mintingEnabled",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getRemainingMintable",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]`

func NewCSTokenContract(cfg *config.Config) (*CSTokenContract, error) {
	// 连接以太坊节点，增加超时和重试机制
	var client *ethclient.Client
	var err error
	
	// 最多重试3次
	for i := 0; i < 3; i++ {
		client, err = connectWithTimeout(cfg.AirdropContract.RPCEndpoint, 30*time.Second)
		if err == nil {
			break
		}
		log.Printf("Failed to connect to Ethereum node (attempt %d): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ethereum node after 3 attempts: %v", err)
	}

	// 解析合约ABI
	parsedABI, err := abi.JSON(strings.NewReader(contractABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse contract ABI: %v", err)
	}

	// 验证合约地址
	if !common.IsHexAddress(cfg.AirdropContract.ContractAddress) {
		return nil, fmt.Errorf("invalid contract address: %s", cfg.AirdropContract.ContractAddress)
	}
	contractAddress := common.HexToAddress(cfg.AirdropContract.ContractAddress)

	return &CSTokenContract{
		client:      client,
		config:      cfg,
		contractABI: parsedABI,
		address:     contractAddress,
	}, nil
}

// connectWithTimeout 带超时的连接函数
func connectWithTimeout(endpoint string, timeout time.Duration) (*ethclient.Client, error) {
	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// 使用HTTP客户端创建连接
	client, err := ethclient.DialContext(ctx, endpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ethereum node: %v", err)
	}

	return client, nil
}

// CheckContractStatus 检查合约状态
func (c *CSTokenContract) CheckContractStatus() error {
	// 检查合约是否暂停
	paused, err := c.isPaused()
	if err != nil {
		return fmt.Errorf("failed to check contract pause status: %v", err)
	}
	if paused {
		return fmt.Errorf("contract is paused")
	}

	// 检查铸造功能是否启用
	mintingEnabled, err := c.isMintingEnabled()
	if err != nil {
		return fmt.Errorf("failed to check minting status: %v", err)
	}
	if !mintingEnabled {
		return fmt.Errorf("minting is disabled")
	}

	return nil
}

// GetRemainingMintable 获取剩余可铸造数量
func (c *CSTokenContract) GetRemainingMintable() (*big.Int, error) {
	// 创建调用消息
	callMsg := ethereum.CallMsg{
		To:   &c.address,
		Data: common.FromHex("0x4f4477d0"), // getRemainingMintable的函数选择器
	}

	// 添加超时控制
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := c.client.CallContract(ctx, callMsg, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to call contract: %v", err)
	}

	return new(big.Int).SetBytes(result), nil
}

// AirdropTokens 执行空投操作
func (c *CSTokenContract) AirdropTokens(recipients []common.Address, amount *big.Int, reason string) ([]AirdropResult, error) {
	results := make([]AirdropResult, len(recipients))

	// 检查合约状态
	if err := c.CheckContractStatus(); err != nil {
		return nil, err
	}

	// 检查剩余可铸造数量
	remaining, err := c.GetRemainingMintable()
	if err != nil {
		return nil, err
	}

	requiredAmount := new(big.Int).Mul(amount, big.NewInt(int64(len(recipients))))
	if remaining.Cmp(requiredAmount) < 0 {
		return nil, fmt.Errorf("insufficient remaining mintable tokens: need %s, have %s",
			requiredAmount.String(), remaining.String())
	}

	// 创建交易签名者
	privateKey, err := crypto.HexToECDSA(c.config.AirdropContract.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %v", err)
	}

	// 获取nonce
	from := crypto.PubkeyToAddress(privateKey.PublicKey)
	
	// 添加超时控制
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	nonce, err := c.client.PendingNonceAt(ctx, from)
	cancel()
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %v", err)
	}

	// 获取gas价格
	gasPrice := big.NewInt(c.config.AirdropContract.GasPrice)

	// 准备交易数据
	data, err := c.contractABI.Pack("airdrop", recipients, amount, reason)
	if err != nil {
		return nil, fmt.Errorf("failed to pack transaction data: %v", err)
	}

	// 估算gas
	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	gasLimit, err := c.client.EstimateGas(ctx, ethereum.CallMsg{
		From:  from,
		To:    &c.address,
		Data:  data,
		Value: big.NewInt(0),
	})
	cancel()
	if err != nil {
		return nil, fmt.Errorf("failed to estimate gas: %v", err)
	}

	// 创建交易
	tx := types.NewTransaction(
		nonce,
		c.address,
		big.NewInt(0),
		gasLimit,
		gasPrice,
		data,
	)

	// 签名交易
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(big.NewInt(c.config.AirdropContract.ChainID)), privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %v", err)
	}

	// 发送交易
	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	err = c.client.SendTransaction(ctx, signedTx)
	cancel()
	if err != nil {
		return nil, fmt.Errorf("failed to send transaction: %v", err)
	}

	// 等待交易确认
	ctx, cancel = context.WithTimeout(context.Background(), 120*time.Second)
	receipt, err := bind.WaitMined(ctx, c.client, signedTx)
	cancel()
	if err != nil {
		return nil, fmt.Errorf("failed to wait for transaction: %v", err)
	}

	if receipt.Status == 0 {
		return nil, fmt.Errorf("transaction failed")
	}

	// 填充结果
	for i, recipient := range recipients {
		results[i] = AirdropResult{
			Address: recipient.Hex(),
			Amount:  amount,
			TxHash:  signedTx.Hash().Hex(),
			Success: receipt.Status == 1,
		}
	}

	return results, nil
}

// BatchAirdrop 批量空投（分批处理大量地址）
func (c *CSTokenContract) BatchAirdrop(recipients []common.Address, amount *big.Int, reason string) ([]AirdropResult, error) {
	var allResults []AirdropResult
	batchSize := c.config.AirdropContract.BatchSize

	for i := 0; i < len(recipients); i += batchSize {
		end := i + batchSize
		if end > len(recipients) {
			end = len(recipients)
		}

		batch := recipients[i:end]
		log.Printf("Processing batch %d-%d of %d", i+1, end, len(recipients))

		results, err := c.AirdropTokens(batch, amount, reason)
		if err != nil {
			log.Printf("Batch %d-%d failed: %v", i+1, end, err)
			// 记录失败的结果
			for _, addr := range batch {
				allResults = append(allResults, AirdropResult{
					Address: addr.Hex(),
					Amount:  amount,
					Success: false,
					Error:   err.Error(),
				})
			}
		} else {
			allResults = append(allResults, results...)
		}

		// 添加间隔以避免过快的请求
		if i+batchSize < len(recipients) {
			// time.Sleep(time.Duration(c.config.AirdropInterval) * time.Second)
		}
	}

	return allResults, nil
}

// 检查合约是否暂停
func (c *CSTokenContract) isPaused() (bool, error) {
	callMsg := ethereum.CallMsg{
		To:   &c.address,
		Data: common.FromHex("0x5c975abb"), // paused()的函数选择器
	}

	result, err := c.client.CallContract(context.Background(), callMsg, nil)
	if err != nil {
		return false, err
	}

	return new(big.Int).SetBytes(result).Cmp(big.NewInt(0)) != 0, nil
}

// 检查铸造是否启用
func (c *CSTokenContract) isMintingEnabled() (bool, error) {
	callMsg := ethereum.CallMsg{
		To:   &c.address,
		Data: common.FromHex("0x4f4477d0"), // mintingEnabled()的函数选择器
	}

	result, err := c.client.CallContract(context.Background(), callMsg, nil)
	if err != nil {
		return false, err
	}

	return new(big.Int).SetBytes(result).Cmp(big.NewInt(0)) != 0, nil
}

// Close 关闭客户端连接
func (c *CSTokenContract) Close() {
	if c.client != nil {
		c.client.Close()
	}
}
