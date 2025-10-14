package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math/big"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/anyswap/CrossChain-Bridge/common"
	"github.com/ethereum/go-ethereum"
	common2 "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/locey/CryptoStock/StockCoinEnd/common/utils"
	"github.com/locey/CryptoStock/StockCoinEnd/dao"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"golang.org/x/exp/rand"
)

const (
	tokenFactoryAddress = "0xf5E1a44A68815fa627c1588e071fd089478aEB9C"
	baseURL             = "https://api.polygon.io/v2/aggs/ticker"
	timeout             = 10 * time.Second
	companies           = "AAPL,TSLA,GOOGL,MSFT,AMZN,NVDA"
	multiplier          = 1
	timespan            = "day"
)

var (
	apiKeys = []string{"rtJCR35B93aRr6gb6TvXqDmv_jc3DiNE", "itCVT8rqa0bWUc5TYcFs7XeDyAi2xfR7"}
	// 使用map结构定义股票logo信息
	stockLogoMap = map[string]string{
		"AAPL":  "https://logo.clearbit.com/apple.com",
		"TSLA":  "https://logo.clearbit.com/tesla.com",
		"GOOGL": "https://logo.clearbit.com/google.com",
		"MSFT":  "https://logo.clearbit.com/microsoft.com",
		"AMZN":  "https://logo.clearbit.com/amazon.com",
		"NVDA":  "https://logo.clearbit.com/nvidia.com",
	}
)

type StockResponse struct {
	Ticker       string `json:"ticker"`
	QueryCount   int    `json:"queryCount"`
	ResultsCount int    `json:"resultsCount"`
	Adjusted     bool   `json:"adjusted"`
	Results      []struct {
		Volume    float64 `json:"v"`
		Open      float64 `json:"o"`
		Close     float64 `json:"c"`
		High      float64 `json:"h"`
		Low       float64 `json:"l"`
		Timestamp int64   `json:"t"`
		ItemCount int     `json:"n"`
	} `json:"results"`
}

type StockSummary struct {
	Ticker              string  `json:"ticker"`                 // 股票代码
	Name                string  `json:"name"`                   //股票名称
	Description         string  `json:"description"`            //股票描述
	Logo                string  `json:"logo"`                   //股票logo地址
	TokenAddress        string  `json:"token_address"`          //代币地址
	AvgGain             float64 `json:"avg_gain"`               //7日平均涨幅
	AvgGainPercent      float64 `json:"avg_gain_percent"`       //7日平均涨幅百分比
	AvgVolume           float64 `json:"avg_volume"`             //7日平均成交量
	CurrentPrice        float64 `json:"current_price"`          //当前价格
	MarketCap           float64 `json:"market_cap"`             //市值
	StockPoolTokenCount big.Int `json:"stock_pool_token_count"` //币股池代币量
	StockPoolMarketCap  float64 `json:"stock_pool_market_cap"`  //币股池股票总市值

}

type StockOverview struct {
	TotalMarketCap float64 `json:"total_market_cap"` //总市值
	TotalVolume    float64 `json:"total_volume"`     //成交总量
	StockCount     int64   `json:"stock_count"`      //股票总数
	AvgGainPercent float64 `json:"avg_gain_percent"` //涨幅百分比
}

type TickerResponse struct {
	RequestID string `json:"request_id"`
	Results   struct {
		Ticker                      string  `json:"ticker"`
		Name                        string  `json:"name"`
		Description                 string  `json:"description"`
		MarketCap                   float64 `json:"market_cap"`
		ShareClassSharesOutstanding int64   `json:"share_class_shares_outstanding"`
		CurrencyName                string  `json:"currency_name"`
	} `json:"results"`
	Status string `json:"status"`
}

func GetStockList(serverCtx *svc.ServerCtx, page int, pageNum int) ([]StockSummary, error) {
	//分页查询
	stocks, err := serverCtx.Dao.GetByPage(page, pageNum)
	if err != nil {
		return nil, err
	}
	//stocks转成[]StockSummary
	stockSummaries := make([]StockSummary, 0)
	for _, ticker := range stocks {
		supply, err := GetTotalSupply(ticker.TokenAddress)
		if err != nil {
			return nil, err
		}
		//string转int64
		stockPoolTokenCount := new(big.Int)
		stockPoolTokenCount.SetString(supply, 10)
		// 将big.Int转换为float64用于计算
		stockPoolTokenCountFloat, _ := new(big.Float).SetInt(stockPoolTokenCount).Float64()
		stockSummary := StockSummary{
			Ticker:              ticker.Ticker,
			Name:                ticker.Name,
			Description:         ticker.Description,
			Logo:                ticker.Logo,
			TokenAddress:        ticker.TokenAddress,
			AvgGain:             ticker.AvgGain,
			AvgGainPercent:      ticker.AvgGainPercent,
			AvgVolume:           ticker.AvgVolume,
			CurrentPrice:        ticker.CurrentPrice,
			MarketCap:           ticker.MarketCap,
			StockPoolTokenCount: *stockPoolTokenCount,
			StockPoolMarketCap:  ticker.CurrentPrice * stockPoolTokenCountFloat,
		}
		stockSummaries = append(stockSummaries, stockSummary)
	}

	return stockSummaries, nil
}

// 定时获取股票信息
func StartStockDataPoller(ctx *svc.ServerCtx, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Println("开始更新股票数据...")
			updateStockData(ctx)
		}
	}
}

// 定时获取股票信息，市值需要更新（其它基础信息不需要更新）
func Init(ctx *svc.ServerCtx) {
	//通过abi接口获取股票对应的代币地址
	symbols, err := GetSymbols("0x071304F5010BDdC9665c2666b6B930d7a60cf5bB")
	if err != nil {
		log.Println("GetSymbols error: %v", err)
	}
	stocks := make([]*dao.StockInfo, 0)
	nowApiKey := GetApiKey("")
	for i := range symbols {
		data, err := GetStockBaseData(symbols[i], nowApiKey)
		if err != nil {
			log.Println("GetStockBaseData error: %v,尝试第二次获取股票信息....", err)
			nowApiKey = GetApiKey(nowApiKey)
			data, err = GetStockBaseData(symbols[i], nowApiKey)
			if err != nil {
				log.Println("GetStockBaseData error: %v", err)
				continue
			}
			log.Println("第二次获取股票信息成功.....")
		}
		address, err := GetTokenAddress(tokenFactoryAddress, data.Results.Ticker)
		if err != nil {
			log.Println("GetTokenAddress error: %v", err)
		}
		stocks = append(stocks, &dao.StockInfo{
			Ticker:       data.Results.Ticker,
			Name:         data.Results.Name,
			Description:  data.Results.Description,
			Logo:         stockLogoMap[data.Results.Ticker],
			TokenAddress: address.String(),
			MarketCap:    data.Results.MarketCap,
		})

	}

	ctx.Dao.BatchCreate(stocks)
}

func updateStockData(serverCtx *svc.ServerCtx) {
	client := &http.Client{Timeout: timeout}
	stockCodes := strings.Split(companies, ",")

	var wg sync.WaitGroup
	results := make(chan StockSummary, len(stockCodes))

	for _, code := range stockCodes {
		wg.Add(1)
		go func(ticker string) {
			defer wg.Done()
			fetchSingleStock(client, ticker, results)
		}(code)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	for res := range results {
		if res.Ticker != "" && res.CurrentPrice > 0 {
			err := serverCtx.Dao.UpdateStockSummary(res.Ticker, res.AvgGain, res.AvgGainPercent, res.AvgVolume, res.CurrentPrice)
			if err != nil {
				log.Println("UpdateStockSummary error: %v", err)
			}
		}
	}
}

func fetchSingleStock(client *http.Client, ticker string, results chan<- StockSummary) {
	// 保持原有请求逻辑，但添加重试机制
	now := time.Now()
	oneWeekAgo := now.AddDate(0, 0, -7)
	fromDate := oneWeekAgo.Format("2006-01-02")
	toDate := now.Format("2006-01-02")
	maxRetries := 3

	nowApiKey := GetApiKey("")
	for i := 0; i < maxRetries; i++ {

		req, err := http.NewRequest("GET", fmt.Sprintf("%s/%s/range/%d/%s/%s/%s",
			baseURL, ticker, multiplier, timespan, fromDate, toDate), nil)
		if err != nil {
			log.Printf("%s 请求创建失败 (尝试%d/%d): %v", ticker, i+1, maxRetries, err)
			continue
		}

		q := req.URL.Query()
		q.Add("apiKey", nowApiKey)
		req.URL.RawQuery = q.Encode()

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("%s 请求执行失败 (尝试%d/%d): %v", ticker, i+1, maxRetries, err)
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusTooManyRequests {
			log.Printf("%s 触发了 API 速率限制 (尝试%d/%d)", ticker, i+1, maxRetries)
			nowApiKey = GetApiKey(nowApiKey)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			//log.Printf("%s 返回状态码: %d (尝试%d/%d)", ticker, resp.StatusCode, i+1, maxRetries)
			continue
		}

		var result StockResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			log.Printf("%s 数据解析失败 (尝试%d/%d): %v", ticker, i+1, maxRetries, err)
			continue
		}

		//if len(result.Results) < 7 {
		//	log.Printf("%s 数据不足7天 (尝试%d/%d)", ticker, i+1, maxRetries)
		//	continue
		//}

		summary := calculate7DayStats(ticker, result.Results)
		results <- summary
		return
	}

	log.Printf("%s 获取失败 (最大重试次数已达)", ticker)
	results <- StockSummary{Ticker: ticker} // 发送空数据表示失败
}

func calculate7DayStats(ticker string, data []struct {
	Volume    float64 `json:"v"`
	Open      float64 `json:"o"`
	Close     float64 `json:"c"`
	High      float64 `json:"h"`
	Low       float64 `json:"l"`
	Timestamp int64   `json:"t"`
	ItemCount int     `json:"n"`
}) StockSummary {
	var totalGain, totalGainPercent, totalVolume float64
	days := len(data)

	for i := 1; i < days; i++ {
		prevClose := data[i-1].Close
		currentClose := data[i].Close
		gain := currentClose - prevClose
		gainPercent := (gain / prevClose) * 100

		totalGain += gain
		totalGainPercent += gainPercent
		totalVolume += data[i].Volume
	}

	return StockSummary{
		Ticker:         ticker,
		AvgGain:        totalGain / float64(days-1),
		AvgGainPercent: totalGainPercent / float64(days-1),
		AvgVolume:      totalVolume / float64(days-1),
		CurrentPrice:   data[days-1].Close,
	}
}

// 获取apiKey，传入非空的apiKey或者空字符串，返回一个新的apiKey
func GetApiKey(apiKey string) string {
	if apiKey == "" {
		return apiKeys[0]
	}
	apiKeyIdx := rand.Intn(len(apiKeys))
	for {
		if apiKeys[apiKeyIdx] == apiKey {
			apiKeyIdx = rand.Intn(len(apiKeys))
		} else {
			return apiKeys[apiKeyIdx]
		}
	}
}

func GetSymbols(address string) ([]string, error) {
	// 1. 连接以太坊节点
	client, err := ethclient.Dial("https://ethereum-sepolia-rpc.publicnode.com")
	if err != nil {
		log.Fatal(err)
	}

	// Construct the path to the ABI file
	abiPath := filepath.Join("..", "CryptoStockContract", "abi", "OracleAggregator.abi")
	parsedABI, err := utils.ReadABI(abiPath)
	if err != nil {
		log.Fatal("ABI解析错误:", err)
	}

	// 使用正确的合约地址
	contractAddress := common.HexToAddress(address) // OracleAggregator代理合约地址

	// 3. 构造调用数据
	data, err := parsedABI.Pack("getSupportedSymbols")
	if err != nil {
		log.Fatal("数据打包错误:", err)
	}

	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   (*common2.Address)(&contractAddress),
		Data: data,
	}, nil)
	if err != nil {
		log.Fatal("合约调用错误:", err)
	}

	// 5. 解析返回数据
	var supportedSymbols []string
	err = parsedABI.UnpackIntoInterface(&supportedSymbols, "getSupportedSymbols", result)
	if err != nil {
		log.Fatal("数据解包错误:", err)
	}
	return supportedSymbols, nil
}

func GetTotalSupply(address string) (string, error) {
	// 1. 连接以太坊节点
	client, err := ethclient.Dial("https://ethereum-sepolia-rpc.publicnode.com")
	if err != nil {
		log.Fatal(err)
	}

	// 2. 解析ABI
	// Construct the path to the ABI file
	abiPath := filepath.Join("..", "CryptoStockContract", "abi", "StockToken.abi")
	parsedABI, err := utils.ReadABI(abiPath)
	if err != nil {
		log.Fatal("ABI解析错误:", err)
	}

	// 3. 构造调用数据
	data, err := parsedABI.Pack("totalSupply")
	if err != nil {
		log.Fatal("数据打包错误:", err)
	}

	// 4. 执行call操作
	contractAddress := common.HexToAddress(address)
	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   (*common2.Address)(&contractAddress),
		Data: data,
	}, nil)
	if err != nil {
		log.Fatal("合约调用错误:", err)
	}

	// 5. 解析返回数据
	var supply *big.Int
	err = parsedABI.UnpackIntoInterface(&supply, "totalSupply", result)
	if err != nil {
		log.Fatal("数据解包错误:", err)
	}

	fmt.Printf("Total Supply: %s\n", supply.String())
	return supply.String(), nil
}
func GetTokenAddress(tokenFactoryAddress string, symbol string) (common.Address, error) {
	client, err := ethclient.Dial("https://ethereum-sepolia-rpc.publicnode.com")
	if err != nil {
		log.Fatal(err)
	}
	// Construct the path to the ABI file
	abiPath := filepath.Join("..", "CryptoStockContract", "abi", "TokenFactory.abi")
	parsedABI, err := utils.ReadABI(abiPath)
	if err != nil {
		log.Fatal(err)
	}
	pack, err := parsedABI.Pack("getTokenAddress", symbol)
	if err != nil {
		log.Fatal(err)
	}
	contractAddress := common.HexToAddress(tokenFactoryAddress)
	result, err := client.CallContract(context.Background(), ethereum.CallMsg{
		To:   (*common2.Address)(&contractAddress),
		Data: pack,
	}, nil)
	if err != nil {
		log.Fatal(err)
	}
	//解析返回数据
	var token common.Address
	err = parsedABI.UnpackIntoInterface(&token, "getTokenAddress", result)
	if err != nil {
		log.Fatal("数据解包错误:", err)
	}
	return token, nil

}

func GetStockBaseData(ticker string, apiKey string) (*TickerResponse, error) {
	url := fmt.Sprintf("https://api.polygon.io/v3/reference/tickers/%s?apiKey=%s", ticker, apiKey)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("HTTP请求失败: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("API错误: %s - %s", resp.Status)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := ioutil.ReadAll(resp.Body)
		return nil, fmt.Errorf("API错误: %s - %s", resp.Status, string(body))
	}

	var result TickerResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("JSON解析失败: %w", err)
	}

	return &result, nil
}

func GetOverview(svcCtx *svc.ServerCtx) (StockOverview, error) {
	count, sumMarketCap, sumVolume, avgGainPercent, err := svcCtx.Dao.Count()
	if err != nil {
		return StockOverview{}, err
	}
	return StockOverview{
		TotalMarketCap: sumMarketCap,
		TotalVolume:    sumVolume,
		StockCount:     count,
		AvgGainPercent: avgGainPercent,
	}, nil
}

// 通过股票代码获取股票价格
func GetStockPrice(svcCtx *svc.ServerCtx, stockCode string) (float64, error) {
	ticker, err := svcCtx.Dao.GetByTicker(stockCode)
	if err != nil {
		return 0, err
	}
	return ticker.CurrentPrice, nil
}
