package v1

import (
	"encoding/json"
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"

	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/service/v1"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

func CollectionItemsHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		filterParam := c.Query("filters")
		if filterParam == "" {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		var filter types.CollectionItemFilterParams
		err := json.Unmarshal([]byte(filterParam), &filter)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[filter.ChainID]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}
		res, err := service.GetItems(c.Request.Context(), svcCtx, chain, filter, collectionAddr)
		if err != nil {
			xhttp.Error(c, errcode.ErrUnexpected)
			return
		}
		xhttp.OkJson(c, res)
	}
}

func CollectionBidsHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		filterParam := c.Query("filters")
		if filterParam == "" {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		var filter types.CollectionBidFilterParams
		err := json.Unmarshal([]byte(filterParam), &filter)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(filter.ChainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		res, err := service.GetBids(c.Request.Context(), svcCtx, chain, collectionAddr, filter.Page, filter.PageSize)
		if err != nil {
			xhttp.Error(c, errcode.ErrUnexpected)
			return
		}
		xhttp.OkJson(c, res)
	}
}

func CollectionItemBidsHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		filterParam := c.Query("filters")
		if filterParam == "" {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		var filter types.CollectionBidFilterParams
		err := json.Unmarshal([]byte(filterParam), &filter)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		tokenID := c.Params.ByName("token_id")
		if tokenID == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(filter.ChainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		res, err := service.GetItemBidsInfo(c.Request.Context(), svcCtx, chain, collectionAddr, tokenID, filter.Page, filter.PageSize)
		if err != nil {
			xhttp.Error(c, errcode.ErrUnexpected)
			return
		}
		xhttp.OkJson(c, res)
	}
}

func ItemDetailHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		tokenID := c.Params.ByName("token_id")
		if tokenID == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chainID, err := strconv.ParseInt(c.Query("chain_id"), 10, 64)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(chainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		res, err := service.GetItem(c.Request.Context(), svcCtx, chain, int(chainID), collectionAddr, tokenID)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("get item error"))
			return

		}
		xhttp.OkJson(c, res)
	}
}

func ItemTopTraitPriceHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		filterParam := c.Query("filters")
		if filterParam == "" {
			xhttp.Error(c, errcode.NewCustomErr("Filter param is nil."))
			return
		}

		var filter types.TopTraitFilterParams
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

		res, err := service.GetItemTopTraitPrice(c.Request.Context(), svcCtx, chain, collectionAddr, filter.TokenIds)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("get item error"))
			return
		}
		xhttp.OkJson(c, res)
	}
}

func HistorySalesHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chainID, err := strconv.ParseInt(c.Query("chain_id"), 10, 64)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(chainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		duration := c.Query("duration")
		if duration != "" {
			validParams := map[string]bool{
				"24h": true,
				"7d":  true,
				"30d": true,
			}
			if ok := validParams[duration]; !ok {
				xzap.WithContext(c).Error("duration parse error: ", zap.String("duration", duration))
				xhttp.Error(c, errcode.ErrInvalidParams)
				return
			}
		} else {
			duration = "7d"
		}

		res, err := service.GetHistorySalesPrice(c.Request.Context(), svcCtx, chain, collectionAddr, duration)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("get history sales price error"))
			return
		}

		xhttp.OkJson(c, struct {
			Result interface{} `json:"result"`
		}{
			Result: res,
		})
	}
}

func ItemTraitsHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		tokenID := c.Params.ByName("token_id")
		if tokenID == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chainID, err := strconv.ParseInt(c.Query("chain_id"), 10, 64)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(chainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		itemTraits, err := service.GetItemTraits(c.Request.Context(), svcCtx, chain, collectionAddr, tokenID)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("get item traits error"))
			return
		}

		xhttp.OkJson(c, types.ItemTraitsResp{Result: itemTraits})
	}
}

func ItemOwnerHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		tokenID := c.Params.ByName("token_id")
		if tokenID == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chainID, err := strconv.ParseInt(c.Query("chain_id"), 10, 64)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(chainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		owner, err := service.GetItemOwner(c.Request.Context(), svcCtx, chainID, chain, collectionAddr, tokenID)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("get item owner error"))
			return
		}

		xhttp.OkJson(c, struct {
			Result interface{} `json:"result"`
		}{
			Result: owner,
		})
	}
}

func GetItemImageHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		tokenID := c.Params.ByName("token_id")
		if tokenID == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chainID, err := strconv.ParseInt(c.Query("chain_id"), 10, 64)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(chainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		result, err := service.GetItemImage(c.Request.Context(), svcCtx, chain, collectionAddr, tokenID)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr("failed on get item image"))
			return
		}

		xhttp.OkJson(c, struct {
			Result interface{} `json:"result"`
		}{Result: result})
	}
}

func ItemMetadataRefreshHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		chainId, err := strconv.ParseInt(c.Query("chain_id"), 10, 32)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(chainId)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		tokenId := c.Params.ByName("token_id")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		err = service.RefreshItemMetadata(c.Request.Context(), svcCtx, chain, chainId, collectionAddr, tokenId)
		if err != nil {
			xhttp.Error(c, err)
			return
		}

		successStr := "Success to joined the refresh queue and waiting for refresh."
		xhttp.OkJson(c, types.CommonResp{Result: successStr})
	}
}

func CollectionDetailHandler(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		chainID, err := strconv.ParseInt(c.Query("chain_id"), 10, 32)
		if err != nil {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		chain, ok := chainIDToChain[int(chainID)]
		if !ok {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}

		collectionAddr := c.Params.ByName("address")
		if collectionAddr == "" {
			xhttp.Error(c, errcode.ErrInvalidParams)
			return
		}
		res, err := service.GetCollectionDetail(c.Request.Context(), svcCtx, chain, collectionAddr)
		if err != nil {
			xhttp.Error(c, errcode.ErrUnexpected)
			return
		}

		xhttp.OkJson(c, res)
	}
}
