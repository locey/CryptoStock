package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/service/v1"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

// 获取空投任务列表
func GetAirDropTasks(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.Query("userId")
		if userId == "" {
			xhttp.Error(c, errcode.NewCustomErr("userId addr is null"))
			return
		}

		res, err := service.GetUserTasks(c.Request.Context(), svcCtx, userId)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, res)
	}
}

// 领取空投
func GetAirDropClaim(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		req := new(types.ClaimRequest)
		if err := c.ShouldBindBodyWithJSON(req); err != nil {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		err := service.ClaimTask(c.Request.Context(), svcCtx, req.UsesrId, req.TaskId)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, nil)
	}
}

// 领取空投奖励
func GetAirDropClaimReward(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		req := new(types.ClaimRequest)
		if err := c.ShouldBindBodyWithJSON(req); err != nil {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		err := service.ClaimReward(c.Request.Context(), svcCtx, req.UsesrId, req.TaskId, req.Address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, nil)
	}
}

// 获取用户空投信息
// 1已获得代币数，2邀请好友数，3任务完成度， 4排名
func GetUserAirDropInfo(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		address := c.Params.ByName("address")
		if address == "" {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		res, err := service.GetUserLoginMsg(c.Request.Context(), svcCtx, address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, res)
	}
}

// 获取邀请链接
func GetUserRefLink(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		address := c.Params.ByName("address")
		if address == "" {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		res, err := service.GetUserLoginMsg(c.Request.Context(), svcCtx, address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, res)
	}
}

// 获取空投排行榜
func GetAirDropRanks(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		address := c.Params.ByName("address")
		if address == "" {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		res, err := service.GetUserLoginMsg(c.Request.Context(), svcCtx, address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, res)
	}
}

// 获取空投池信息
func GetAirDropPoolInfo(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		address := c.Params.ByName("address")
		if address == "" {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		res, err := service.GetUserLoginMsg(c.Request.Context(), svcCtx, address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, res)
	}
}

// 邀请链接访问记录
func GetRefLink(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		address := c.Params.ByName("address")
		if address == "" {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		res, err := service.GetUserLoginMsg(c.Request.Context(), svcCtx, address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, res)
	}
}

func GetAndSetUserTaskProof(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		address := "0x3c276c70Ad0447f5FbbeBC297793Be2A750704aE"
		if address == "" {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		res, err := service.GetUserTaskProof(c.Request.Context(), svcCtx, address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}
		xhttp.OkJson(c, res)
	}
}
