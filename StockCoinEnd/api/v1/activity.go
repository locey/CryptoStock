package v1

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"

	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/service/v1"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

// ActivityMultiChainHandler 处理多链活动查询请求
// 主要功能:
// 1. 解析过滤参数
// 2. 根据是否指定链ID执行不同的查询逻辑:
//   - 未指定链ID: 查询所有链上的活动
//   - 指定链ID: 只查询指定链上的活动
func ActivityMultiChainHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取过滤参数
		filterParam := c.Query("filters")
		if filterParam == "" {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		// 解析过滤参数
		var filter types.ActivityMultiChainFilterParams
		err := json.Unmarshal([]byte(filterParam), &filter)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		// 指定链ID,只查询指定链上的活动
		var chainName []string
		for _, id := range filter.ChainID {
			chainName = append(chainName, chainIDToChain[id])
		}

		res, err := service.GetMultiChainActivities(
			c.Request.Context(),
			svcCtx,
			filter.ChainID,
			chainName,
			filter.CollectionAddresses,
			filter.TokenID,
			filter.UserAddresses,
			filter.EventTypes,
			filter.Page,
			filter.PageSize,
		)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Get multi-chain activities failed."))
			return
		}
		xhttp.OkJson(c, res)
	}

}
