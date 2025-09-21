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

func OrderInfosHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		filterParam := c.Query("filters")
		if filterParam == "" {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		var filter types.OrderInfosParam
		err := json.Unmarshal([]byte(filterParam), &filter)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		chain, ok := chainIDToChain[filter.ChainID]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		res, err := service.GetOrderInfos(c.Request.Context(), svcCtx, filter.ChainID, chain, filter.UserAddress, filter.CollectionAddress, filter.TokenIds)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}
		xhttp.OkJson(c, struct {
			Result interface{} `json:"result"`
		}{Result: res})
	}
}
