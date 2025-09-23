package service

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/locey/CryptoStock/StockCoinEnd/dao"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
)

const (
	apiKey     = "rtJCR35B93aRr6gb6TvXqDmv_jc3DiNE"
	baseURL    = "https://api.polygon.io/v2/aggs/ticker"
	timeout    = 10 * time.Second
	companies  = "AAPL,TSLA,GOOGL,MSFT,AMZN,NVDA"
	multiplier = 1
	timespan   = "day"
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
	Ticker         string  `json:"ticker"`
	AvgGain        float64 `json:"avg_gain"`
	AvgGainPercent float64 `json:"avg_gain_percent"`
	AvgVolume      float64 `json:"avg_volume"`
	CurrentPrice   float64 `json:"current_price"`
}

var summary = make(map[string]StockSummary)

func GetStockList(codes []string) ([]StockSummary, error) {
	summaries := make([]StockSummary, 0)
	for i := range codes {
		summaries = append(summaries, summary[codes[i]])
	}
	return summaries, nil
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
func Init(ctx *svc.ServerCtx) {
	//通过abi接口获取股票对应的代币地址
	ctx.Dao.DB.AutoMigrate(&dao.StockInfo{})
	//构造股票信息，基础信息先写死（第三方平台的信息只能一个一个调用，还限制一分钟5次）
	stocks := []*dao.StockInfo{
		{
			Ticker:       "AAPL",
			Name:         "Apple Inc.",
			Description:  "Consumer electronics and software company",
			Logo:         "https://logo.clearbit.com/apple.com",
			TokenAddress: "0x0000000000000000000000000000000000000001",
		},
		{
			Ticker:       "TSLA",
			Name:         "Tesla Inc.",
			Description:  "Electric vehicle and clean energy company",
			Logo:         "https://logo.clearbit.com/tesla.com",
			TokenAddress: "0x0000000000000000000000000000000000000002",
		},
		{
			Ticker:       "GOOGL",
			Name:         "Alphabet Inc.",
			Description:  "Multinational technology conglomerate",
			Logo:         "https://logo.clearbit.com/google.com",
			TokenAddress: "0x0000000000000000000000000000000000000003",
		},
		{
			Ticker:       "MSFT",
			Name:         "Microsoft Corporation",
			Description:  "Technology company producing software and hardware",
			Logo:         "https://logo.clearbit.com/microsoft.com",
			TokenAddress: "0x0000000000000000000000000000000000000004",
		},
		{
			Ticker:       "AMZN",
			Name:         "Amazon.com Inc.",
			Description:  "Multinational technology company focusing on e-commerce",
			Logo:         "https://logo.clearbit.com/amazon.com",
			TokenAddress: "0x0000000000000000000000000000000000000005",
		},
		{
			Ticker:       "NVDA",
			Name:         "NVIDIA Corporation",
			Description:  "Technology company designing graphics processing units",
			Logo:         "https://logo.clearbit.com/nvidia.com",
			TokenAddress: "0x0000000000000000000000000000000000000006",
		},
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
	for i := 0; i < maxRetries; i++ {
		req, err := http.NewRequest("GET", fmt.Sprintf("%s/%s/range/%d/%s/%s/%s",
			baseURL, ticker, multiplier, timespan, fromDate, toDate), nil)
		if err != nil {
			log.Printf("%s 请求创建失败 (尝试%d/%d): %v", ticker, i+1, maxRetries, err)
			continue
		}

		q := req.URL.Query()
		q.Add("apiKey", apiKey)
		req.URL.RawQuery = q.Encode()

		resp, err := client.Do(req)
		if err != nil {
			log.Printf("%s 请求执行失败 (尝试%d/%d): %v", ticker, i+1, maxRetries, err)
			continue
		}
		defer resp.Body.Close()

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
