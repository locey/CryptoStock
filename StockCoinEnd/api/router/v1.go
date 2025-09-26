package router

import (
	"github.com/gin-gonic/gin"

	"github.com/locey/CryptoStock/StockCoinEnd/api/middleware"
	v1 "github.com/locey/CryptoStock/StockCoinEnd/api/v1"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
)

func loadV1(r *gin.Engine, svcCtx *svc.ServerCtx) {
	apiV1 := r.Group("/api/v1")

	user := apiV1.Group("/user")
	{
		user.GET("/:address/login-message", v1.GetLoginMessageHandler(svcCtx)) // 生成login签名信息
		user.POST("/login", v1.UserLoginHandler(svcCtx))                       // 登陆
		user.GET("/:address/sig-status", v1.GetSigStatusHandler(svcCtx))       // 获取用户签名状态
	}

	collections := apiV1.Group("/collections")
	{
		// 接口定义： 路由 + 中间件 + 处理函数
		collections.GET("/:address", v1.CollectionDetailHandler(svcCtx))                  // 指定Collection详情
		collections.GET("/:address/bids", v1.CollectionBidsHandler(svcCtx))               // 指定Collection的bids信息
		collections.GET("/:address/:token_id/bids", v1.CollectionItemBidsHandler(svcCtx)) // 指定Item的bid信息
		collections.GET("/:address/items", v1.CollectionItemsHandler(svcCtx))             // 指定Collection的items信息

		collections.GET("/:address/:token_id", v1.ItemDetailHandler(svcCtx))                                                  // 获取NFT Item的详细信息
		collections.GET("/:address/:token_id/traits", v1.ItemTraitsHandler(svcCtx))                                           //获取NFT Item的Attribute信息
		collections.GET("/:address/top-trait", v1.ItemTopTraitPriceHandler(svcCtx))                                           //获取NFT Item的Trait的最高价格信息
		collections.GET("/:address/:token_id/image", middleware.CacheApi(svcCtx.KvStore, 60), v1.GetItemImageHandler(svcCtx)) // 获取NFT Item的图片信息
		collections.GET("/:address/history-sales", v1.HistorySalesHandler(svcCtx))                                            // NFT销售历史价格信息
		collections.GET("/:address/:token_id/owner", v1.ItemOwnerHandler(svcCtx))                                             // 获取NFT Item的owner信息
		collections.POST("/:address/:token_id/metadata", v1.ItemMetadataRefreshHandler(svcCtx))                               // 刷新NFT Item的metadata

		collections.GET("/ranking", middleware.CacheApi(svcCtx.KvStore, 60), v1.TopRankingHandler(svcCtx)) // 获取NFT集合排名信息
	}

	activities := apiV1.Group("/activities")
	{
		activities.GET("", v1.ActivityMultiChainHandler(svcCtx)) // 批量获取activity信息
	}

	portfolio := apiV1.Group("/portfolio")
	{
		portfolio.GET("/collections", v1.UserMultiChainCollectionsHandler(svcCtx)) // 获取用户拥有Collection信息
		portfolio.GET("/items", v1.UserMultiChainItemsHandler(svcCtx))             // 查询用户拥有nft的Item基本信息
		portfolio.GET("/listings", v1.UserMultiChainListingsHandler(svcCtx))       // 查询用户挂单的Listing信息
		portfolio.GET("/bids", v1.UserMultiChainBidsHandler(svcCtx))               // 查询用户挂单的Bids信息
	}

	orders := apiV1.Group("/bid-orders")
	{
		orders.GET("", v1.OrderInfosHandler(svcCtx)) // 批量查询出价信息
	}
	airdrop := apiV1.Group("airdrop")
	{
		airdrop.GET("tasks", v1.GetAirDropTasks(svcCtx))               // 获取空投任务列表
		airdrop.GET("task/:taskId", v1.GetAirDropClaim(svcCtx))        // 领取任务
		airdrop.POST("task/:taskId", v1.GetAirDropClaimReward(svcCtx)) // 领取任务奖励
		airdrop.GET("ref/link", v1.GetRefLink(svcCtx))                 // 获取用户邀请链接
		airdrop.GET("task/info", v1.GetUserAirDropInfo(svcCtx))        // 领取用户空投信息
		airdrop.GET("task/rank", v1.GetAirDropRanks(svcCtx))           // 领取空投排行
		airdrop.GET("task/poolinfo", v1.GetAirDropPoolInfo(svcCtx))    // 领取空投排行
	}
	stocks := apiV1.Group("/stocks")
	{
		stocks.GET("", v1.GetStockList(svcCtx))              // 批量获取activity信息
		stocks.GET("/overview", v1.GetOverview(svcCtx))      // 获取股票总览信息
		stocks.GET("/:code/price", v1.GetStockPrice(svcCtx)) // 获取股票价格
	}
}
