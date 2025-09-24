package v1

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/service/v1"
)

func GetStockList(ctx *gin.Context) {
	stockCodes := []string{"AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "NVDA"}

	summary, err := service.GetStockList(stockCodes)
	if err != nil {
		log.Fatalf("获取股票数据失败: %v", err)
	}

	xhttp.OkJson(ctx, summary)
}
func Init(svcCtx *svc.ServerCtx) {
	// 批量初始化股票代码等各种信息
	service.Init(svcCtx)
}
