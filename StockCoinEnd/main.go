package main

import (
	"flag"
	_ "net/http/pprof"

	"github.com/locey/CryptoStock/StockCoinEnd/api/router"
	"github.com/locey/CryptoStock/StockCoinEnd/app"
	"github.com/locey/CryptoStock/StockCoinEnd/config"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
)

const (
	// port       = ":9000"
	//repoRoot          = ""
	defaultConfigPath = "./config/config.toml"
)

func main() {
	conf := flag.String("conf", defaultConfigPath, "conf file path")
	flag.Parse()
	c, err := config.UnmarshalConfig(*conf)
	if err != nil {
		panic(err)
	}

	for _, chain := range c.ChainSupported {
		if chain.ChainID == 0 || chain.Name == "" {
			panic("invalid chain_suffix config")
		}
	}

	serverCtx, err := svc.NewServiceContext(c)
	if err != nil {
		panic(err)
	}
	// Initialize router
	r := router.NewRouter(serverCtx)
	// 启动每分钟轮询股票信息
	//go service.StartStockDataPoller(serverCtx, 2*time.Minute)

	// 定时获取股票信息，市值需要更新（其它基础信息不需要更新）
	//go v1.Init(serverCtx, 1*time.Minute)
	app, err := app.NewPlatform(c, r, serverCtx)
	if err != nil {
		panic(err)
	}
	app.Start()
}
