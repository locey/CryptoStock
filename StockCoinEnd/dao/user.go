package dao

import (
	"context"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/base"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"
)

func (d *Dao) GetUserSigStatus(ctx context.Context, userAddr string) (bool, error) {
	var userInfo base.User
	db := d.DB.WithContext(ctx).Table(base.UserTableName()).
		Where("address = ?", userAddr).
		Find(&userInfo)
	if db.Error != nil {
		return false, errors.Wrap(db.Error, "failed on get user info")
	}

	return userInfo.IsSigned, nil
}

// QueryUserBids 查询用户的出价订单信息
func (d *Dao) QueryUserBids(ctx context.Context, chain string, userAddrs []string, contractAddrs []string) ([]multi.Order, error) {
	var userBids []multi.Order

	// SQL解释:
	// 1. 从订单表中查询订单详细信息
	// 2. 选择字段包括:集合地址、代币ID、订单ID、订单类型、剩余数量等
	// 3. WHERE条件:
	//    - maker在给定用户地址列表中
	//    - 订单类型为Item出价或集合出价
	//    - 订单状态为活跃
	//    - 剩余数量大于0
	db := d.DB.WithContext(ctx).
		Table(multi.OrderTableName(chain)).
		Select("collection_address, token_id, order_id, token_id,order_type,"+
			"quantity_remaining, size, event_time, price, salt, expire_time").
		Where("maker in (?) and order_type in (?,?) and order_status = ? and quantity_remaining > 0",
			userAddrs, multi.ItemBidOrder, multi.CollectionBidOrder, multi.OrderStatusActive)

	// 如果指定了合约地址列表,添加集合地址过滤条件
	if len(contractAddrs) != 0 {
		db.Where("collection_address in (?)", contractAddrs)
	}

	if err := db.Scan(&userBids).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get user bids")
	}

	return userBids, nil
}
