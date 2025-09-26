package v1

import (
	"log"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/service/v1"
)

func GetStockList(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		pageSize := ctx.Query("pageSize")
		pageNum := ctx.Query("pageNum")
		pageSizeInt, err := strconv.Atoi(pageSize)
		if err != nil {
			return
		}
		pageNumInt, err := strconv.Atoi(pageNum)
		if err != nil {
			return
		}
		summary, err := service.GetStockList(svcCtx, pageSizeInt, pageNumInt)
		if err != nil {
			log.Fatalf("获取股票数据失败: %v", err)
		}

		xhttp.OkJson(ctx, summary)
	}

}
func Init(svcCtx *svc.ServerCtx, interval time.Duration) {

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Println("开始初始化股票基础数据...")
			// 批量初始化股票代码等各种信息
			service.Init(svcCtx)
		}
	}

}
func GetOverview(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		overview, err := service.GetOverview(svcCtx)
		if err != nil {
			log.Fatalf("获取股票类型失败: %v", err)
		}

		xhttp.OkJson(ctx, overview)
	}

}

// 通过股票代码获取股票价格
func GetStockPrice(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		stockCode := ctx.Param("code")
		price, err := service.GetStockPrice(svcCtx, stockCode)
		if err != nil {
			log.Fatalf("获取股票价格失败: %v", err)
		}
		xhttp.OkJson(ctx, price)
	}
}
