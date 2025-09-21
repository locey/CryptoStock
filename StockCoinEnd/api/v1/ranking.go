package v1

import (
	"sort"
	"strconv"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"
	"go.uber.org/zap"

	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/service/v1"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

// TopRankingHandler 处理获取排名前列的NFT集合的请求
func TopRankingHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 解析limit参数,获取需要返回的数量
		limit, err := strconv.ParseInt(c.Query("limit"), 10, 64)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		// 获取时间范围参数
		period := c.Query("range")
		if period != "" {
			// 验证时间范围参数是否有效
			validParams := map[string]bool{
				"15m": true, // 15分钟
				"1h":  true, // 1小时
				"6h":  true, // 6小时
				"1d":  true, // 1天
				"7d":  true, // 7天
				"30d": true, // 30天
			}
			if ok := validParams[period]; !ok {
				xzap.WithContext(c).Error("range parse error: ", zap.String("range", period))
				xhttp.Error(c, errcode.ErrInvalidParams)
				return
			}
		} else {
			// 默认使用1天的时间范围
			period = "1d"
		}

		// 存储所有链的排名结果
		var allResult []*types.CollectionRankingInfo

		// 使用WaitGroup和Mutex来保证并发安全
		var wg sync.WaitGroup
		var mu sync.Mutex

		// 并发获取每条链的排名数据
		for _, chain := range svcCtx.C.ChainSupported {
			wg.Add(1)
			go func(chain string) {
				defer wg.Done()

				// 获取该链的排名数据
				result, err := service.GetTopRanking(c.Copy(), svcCtx, chain, period, limit)
				if err != nil {
					xhttp.Error(c, err)
					return
				}

				// 将结果追加到总结果中
				mu.Lock()
				allResult = append(allResult, result...)
				mu.Unlock()
			}(chain.Name)
		}

		// 等待所有goroutine完成
		wg.Wait()

		// 根据交易量对集合进行降序排序
		sort.SliceStable(allResult, func(i, j int) bool {
			return allResult[i].Volume.GreaterThan(allResult[j].Volume)
		})

		// 返回排序后的结果
		xhttp.OkJson(c, types.CollectionRankingResp{Result: allResult})
	}
}
