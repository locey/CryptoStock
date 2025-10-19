package v1

import (
	"fmt"

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
		userId := c.Query("address")
		if userId == "" {
			xhttp.Error(c, errcode.NewCustomErr("address addr is null"))
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

// 领取空投任务
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

func StartAirdrop(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		address := c.Query("address")
		if address == "" {
			xhttp.Error(c, errcode.NewCustomErr("user addr is null"))
			return
		}

		res, err := service.StartAirdrop(c.Request.Context(), svcCtx, address)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}
		xhttp.OkJson(c, res)
	}
}

// CreateAirdropTask 创建空投任务
func CreateAirdropTask(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req types.CreateTaskRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Invalid request format: "+err.Error()))
			return
		}

		// 基本验证
		if req.Name == "" {
			xhttp.Error(c, errcode.NewCustomErr("Task name is required"))
			return
		}
		if req.RewardAmount <= 0 {
			xhttp.Error(c, errcode.NewCustomErr("Reward amount must be greater than 0"))
			return
		}
		if req.TaskType == "" {
			xhttp.Error(c, errcode.NewCustomErr("Task type is required"))
			return
		}

		// 创建任务
		task, err := service.CreateTask(c.Request.Context(), svcCtx, &req)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, task)
	}
}

// UpdateAirdropTask 更新空投任务
func UpdateAirdropTask(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取任务ID
		taskIdStr := c.Param("taskId")
		if taskIdStr == "" {
			xhttp.Error(c, errcode.NewCustomErr("Task ID is required"))
			return
		}

		var taskId int64
		if _, err := fmt.Sscanf(taskIdStr, "%d", &taskId); err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Invalid task ID format"))
			return
		}

		var req types.UpdateTaskRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Invalid request format: "+err.Error()))
			return
		}

		// 更新任务
		task, err := service.UpdateTask(c.Request.Context(), svcCtx, taskId, &req)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, task)
	}
}

// DeleteAirdropTask 删除空投任务
func DeleteAirdropTask(svcCtx *svc.ServerCtx) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取任务ID
		taskIdStr := c.Param("taskId")
		if taskIdStr == "" {
			xhttp.Error(c, errcode.NewCustomErr("Task ID is required"))
			return
		}

		var taskId int64
		if _, err := fmt.Sscanf(taskIdStr, "%d", &taskId); err != nil {
			xhttp.Error(c, errcode.NewCustomErr("Invalid task ID format"))
			return
		}

		// 删除任务
		err := service.DeleteTask(c.Request.Context(), svcCtx, taskId)
		if err != nil {
			xhttp.Error(c, errcode.NewCustomErr(err.Error()))
			return
		}

		xhttp.OkJson(c, gin.H{"message": "Task deleted successfully"})
	}
}

