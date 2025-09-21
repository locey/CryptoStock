package dao

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

const (
	BuyNow   = 1
	HasOffer = 2
	All      = 3
)

const (
	listTime      = 0
	listPriceAsc  = 1
	listPriceDesc = 2
	salePriceDesc = 3
	salePriceAsc  = 4
)

type CollectionItem struct {
	multi.Item
	MarketID       int    `json:"market_id"`
	Listing        bool   `json:"listing"`
	OrderID        string `json:"order_id"`
	OrderStatus    int    `json:"order_status"`
	ListMaker      string `json:"list_maker"`
	ListTime       int64  `json:"list_time"`
	ListExpireTime int64  `json:"list_expire_time"`
	ListSalt       int64  `json:"list_salt"`
}

// QueryCollectionBids 查询NFT集合的出价信息
// 该函数主要用于获取某个NFT集合的所有有效出价信息,包括出价数量、价格、总价值和出价人数等
func (d *Dao) QueryCollectionBids(ctx context.Context, chain string, collectionAddr string, page, pageSize int) ([]types.CollectionBids, int64, error) {
	var count int64

	// 统计总记录数
	// SQL解释:统计订单表中符合条件的记录数
	// 条件:1.指定集合地址 2.订单类型为出价单 3.订单状态为活跃 4.未过期
	// 按价格分组统计不同价格的出价数量
	if err := d.DB.WithContext(ctx).
		Table(multi.OrderTableName(chain)).
		Where("collection_address = ? and order_type = ? and order_status = ? and expire_time > ?",
			collectionAddr, multi.CollectionBidOrder, multi.OrderStatusActive, time.Now().Unix()).
		Group("price").
		Count(&count).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on count user items")
	}

	var bids []types.CollectionBids
	db := d.DB.WithContext(ctx).Table(multi.OrderTableName(chain))

	// 查询出价详情
	// SQL解释:查询订单表获取出价信息
	// 1. 统计每个价格的剩余数量总和(size)
	// 2. 获取价格(price)
	// 3. 计算总价值(total = size * price)
	// 4. 统计不同出价人数(bidders)
	// 条件与上面相同,增加quantity_remaining > 0确保有剩余数量
	// 按价格分组并降序排序,使用分页参数
	if err := db.Select(`
			sum(quantity_remaining) AS size, 
			price,
			sum(quantity_remaining)*price as total,
			COUNT(DISTINCT maker) AS bidders`).
		Where(`collection_address = ? and order_type = ? and order_status = ? 
			   and expire_time > ? and quantity_remaining > 0`,
			collectionAddr, multi.CollectionBidOrder, multi.OrderStatusActive, time.Now().Unix()).
		Group("price").
		Order("price desc").
		Limit(int(pageSize)).
		Offset(int(pageSize * (page - 1))).
		Scan(&bids).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on query collection bids")
	}

	return bids, count, nil
}

// QueryCollectionItemOrder 查询集合内NFT Item的订单信息

func (d *Dao) QueryCollectionItemOrder(ctx context.Context, chain string, filter types.CollectionItemFilterParams, collectionAddr string) ([]*CollectionItem, int64, error) {
	// 如果未指定市场,默认使用OrderBookDex
	if len(filter.Markets) == 0 {
		filter.Markets = []int{int(multi.OrderBookDex)}
	}

	// 初始化数据库查询
	db := d.DB.WithContext(ctx).Table(fmt.Sprintf("%s as ci", multi.ItemTableName(chain)))
	coTableName := multi.OrderTableName(chain)

	// 根据状态过滤查询
	// status: 1-buy now(立即购买), 2-has offer(有报价), 3-all(所有)
	if len(filter.Status) == 1 {
		// 构建基础SELECT语句
		db.Select(
			"ci.id as id, ci.chain_id as chain_id, " +
				"ci.collection_address as collection_address,ci.token_id as token_id, " +
				"ci.name as name, ci.owner as owner, " +
				"min(co.price) as list_price, " +
				"SUBSTRING_INDEX(GROUP_CONCAT(co.marketplace_id ORDER BY co.price,co.marketplace_id),',', 1) AS market_id, " +
				"min(co.price) != 0 as listing")

		// 处理立即购买状态
		if filter.Status[0] == BuyNow {
			// SQL解释:
			// 1. 关联订单表和Item表
			// 2. 条件:集合地址匹配、订单类型为listing、订单状态active、卖家是Item所有者
			db.Joins(fmt.Sprintf(
				"join %s co on co.collection_address=ci.collection_address and co.token_id=ci.token_id",
				coTableName)).
				Where(
					"co.collection_address = ? and co.order_type = ? and co.order_status=? "+
						"and co.maker = ci.owner",
					collectionAddr, multi.ListingOrder, multi.OrderStatusActive)

			// 根据市场ID过滤
			if len(filter.Markets) == 1 {
				db.Where("co.marketplace_id = ?", filter.Markets[0])
			} else if len(filter.Markets) != 5 {
				db.Where("co.marketplace_id in (?)", filter.Markets)
			}

			// 根据tokenID和用户地址过滤
			if filter.TokenID != "" {
				db.Where("co.token_id =?", filter.TokenID)
			}
			if filter.UserAddress != "" {
				db.Where("ci.owner =?", filter.UserAddress)
			}

			db.Group("co.token_id")
		}

		// 处理有报价状态
		if filter.Status[0] == HasOffer {
			// SQL解释:
			// 1. 关联订单表和Item表
			// 2. 条件:集合地址匹配、订单类型为offer、订单状态active
			db.Joins(fmt.Sprintf(
				"join %s co on co.collection_address=ci.collection_address and co.token_id=ci.token_id",
				coTableName)).
				Where(
					"co.collection_address = ? and co.order_type = ? and co.order_status = ?",
					collectionAddr, multi.OfferOrder, multi.OrderStatusActive)

			// 根据市场ID过滤
			if len(filter.Markets) == 1 {
				db.Where("co.marketplace_id = ?", filter.Markets[0])
			} else if len(filter.Markets) != 5 {
				db.Where("co.marketplace_id in (?)", filter.Markets)
			}

			// 根据tokenID和用户地址过滤
			if filter.TokenID != "" {
				db.Where("co.token_id =?", filter.TokenID)
			}
			if filter.UserAddress != "" {
				db.Where("ci.owner =?", filter.UserAddress)
			}

			db.Group("co.token_id")
		}
	} else if len(filter.Status) == 2 {
		// 处理同时有买卖订单的情况
		// SQL解释:
		// 1. 关联订单表和Item表
		// 2. 条件:订单状态active、卖家是Item所有者
		// 3. 分组后需同时存在listing和offer订单
		// 选择字段:
		// 1. 基本信息:id、chain_id、collection_address、token_id、name、owner
		// 2. list_price: 取最低挂单价格(min(co.price))
		// 3. market_id: 使用SUBSTRING_INDEX和GROUP_CONCAT组合取最低价格对应的市场ID
		//    - GROUP_CONCAT按价格和市场ID排序,将marketplace_id连接成字符串
		//    - SUBSTRING_INDEX取第一个值,即最低价格对应的市场ID
		db.Select(
			"ci.id as id, ci.chain_id as chain_id," +
				"ci.collection_address as collection_address,ci.token_id as token_id, " +
				"ci.name as name, ci.owner as owner, " +
				"min(co.price) as list_price, " +
				"SUBSTRING_INDEX(GROUP_CONCAT(co.marketplace_id ORDER BY co.price,co.marketplace_id),',', 1) AS market_id")

		db.Joins(fmt.Sprintf(
			"join %s co on co.collection_address=ci.collection_address and co.token_id=ci.token_id",
			coTableName)).
			Where(
				"co.collection_address = ? and co.order_status=? and co.maker = ci.owner",
				collectionAddr, multi.OrderStatusActive)

		// 根据市场ID过滤
		if len(filter.Markets) == 1 {
			db.Where("co.marketplace_id = ?", filter.Markets[0])
		} else if len(filter.Markets) != 5 {
			db.Where("co.marketplace_id in (?)", filter.Markets)
		}

		// 根据tokenID和用户地址过滤
		if filter.TokenID != "" {
			db.Where("co.token_id =?", filter.TokenID)
		}
		if filter.UserAddress != "" {
			db.Where("ci.owner =?", filter.UserAddress)
		}

		db.Group("co.token_id").Having(
			"min(co.type)=? and max(co.type)=?",
			multi.ListingOrder, multi.OfferOrder)

	} else {
		// 处理所有状态
		// SQL解释:
		// 1. 子查询获取每个token的最低listing价格
		// 2. 左连接子查询结果到Item表
		// 3. 根据条件过滤
		subQuery := d.DB.WithContext(ctx).Table(
			fmt.Sprintf("%s as cis", multi.ItemTableName(chain))).
			Select(
				"cis.id as item_id,cis.collection_address as collection_address,"+
					"cis.token_id as token_id, cis.owner as owner, cos.order_id as order_id, "+
					"min(cos.price) as list_price, "+
					"SUBSTRING_INDEX(GROUP_CONCAT(cos.marketplace_id ORDER BY cos.price,cos.marketplace_id),',', 1) AS market_id, "+
					"min(cos.price) != 0 as listing").
			Joins(fmt.Sprintf(
				"join %s cos on cos.collection_address=cis.collection_address and cos.token_id=cis.token_id",
				coTableName)).
			Where(
				"cos.collection_address = ? and cos.order_type = ? and cos.order_status=? "+
					"and cos.maker = cis.owner",
				collectionAddr, multi.ListingOrder, multi.OrderStatusActive)

		if len(filter.Markets) == 1 {
			subQuery.Where("cos.marketplace_id = ?", filter.Markets[0])
		} else if len(filter.Markets) != 5 {
			subQuery.Where("cos.marketplace_id in (?)", filter.Markets)
		}
		subQuery.Group("cos.token_id")

		db.Joins("left join (?) co on co.collection_address=ci.collection_address and co.token_id=ci.token_id",
			subQuery).
			Select(
				"ci.id as id, ci.chain_id as chain_id," +
					"ci.collection_address as collection_address, ci.token_id as token_id, " +
					"ci.name as name, ci.owner as owner, " +
					"co.list_price as list_price, co.market_id as market_id, co.listing as listing").
			Where(fmt.Sprintf("ci.collection_address = '%s'", collectionAddr))

		if filter.TokenID != "" {
			db.Where(fmt.Sprintf("ci.token_id = '%s'", filter.TokenID))
		}
		if filter.UserAddress != "" {
			db.Where(fmt.Sprintf("ci.owner = '%s'", filter.UserAddress))
		}
	}

	// 统计总记录数
	var count int64
	countTx := db.Session(&gorm.Session{})
	if err := countTx.Count(&count).Error; err != nil {
		return nil, 0, errors.Wrap(db.Error, "failed on count items")
	}

	// 处理排序
	if len(filter.Status) == 0 {
		db.Order("listing desc")
	}

	if filter.Sort == 0 {
		filter.Sort = listPriceAsc
	}

	// 根据不同排序条件设置ORDER BY
	switch filter.Sort {
	case listTime:
		db.Order("list_time desc,ci.id asc")
	case listPriceAsc:
		db.Order("list_price asc, ci.id asc")
	case listPriceDesc:
		db.Order("list_price desc,ci.id asc")
	case salePriceDesc:
		db.Order("sale_price desc,ci.id asc")
	case salePriceAsc:
		db.Order("sale_price = 0,sale_price asc,ci.id asc")
	}

	// 执行分页查询
	var items []*CollectionItem
	db.Offset(int((filter.Page - 1) * filter.PageSize)).
		Limit(int(filter.PageSize)).
		Scan(&items)

	if db.Error != nil {
		return nil, 0, errors.Wrap(db.Error, "failed on get query items info")
	}

	return items, count, nil
}

type UserItemCount struct {
	Owner  string `json:"owner"`
	Counts int64  `json:"counts"`
}

// QueryUsersItemCount 查询用户持有NFT数量统计
// 该函数主要功能:
// 1. 根据链名称、集合地址和用户地址列表查询每个用户持有的NFT数量
// 2. 返回用户地址和对应的NFT持有数量
func (d *Dao) QueryUsersItemCount(ctx context.Context, chain string,
	collectionAddr string, owners []string) ([]UserItemCount, error) {

	var itemCount []UserItemCount

	// SQL解释:
	// 1. 从Item表(ob_items_{chain})中查询
	// 2. 选择owner字段和每个owner持有的NFT总数(COUNT(*))
	// 3. 条件:指定集合地址且owner在给定列表中
	// 4. 按owner分组统计每个用户的持有数量
	if err := d.DB.WithContext(ctx).
		Table(fmt.Sprintf("%s as ci", multi.ItemTableName(chain))).
		Select("owner,COUNT(*) AS counts").
		Where("collection_address = ? and owner in (?)",
			collectionAddr, owners).
		Group("owner").
		Scan(&itemCount).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get user item count")
	}

	return itemCount, nil
}

// QueryLastSalePrice 查询NFT最近的销售价格
// 该函数主要功能:
// 1. 根据链名称、集合地址和代币ID列表查询每个NFT最近一次的销售价格
// 2. 返回NFT的集合地址、代币ID和对应的销售价格
func (d *Dao) QueryLastSalePrice(ctx context.Context, chain string,
	collectionAddr string, tokenIds []string) ([]multi.Activity, error) {
	var lastSales []multi.Activity

	// SQL解释:
	// 1. 子查询:按集合地址和代币ID分组,找出每组最新的销售事件时间
	//    - 条件:指定集合地址、代币ID列表、活动类型为销售
	//    - 分组后取每组最大event_time
	// 2. 主查询:关联活动表和子查询结果
	//    - 匹配集合地址、代币ID、事件时间和活动类型
	//    - 获取每个NFT最近一次销售的价格信息
	sql := fmt.Sprintf(`
		SELECT a.collection_address, a.token_id, a.price
		FROM %s a
		INNER JOIN (
			SELECT collection_address,token_id, 
				MAX(event_time) as max_event_time
			FROM %s
			WHERE collection_address = ?
				AND token_id IN (?)
				AND activity_type = ?
			GROUP BY collection_address,token_id
		) groupedA 
		ON a.collection_address = groupedA.collection_address
		AND a.token_id = groupedA.token_id
		AND a.event_time = groupedA.max_event_time
		AND a.activity_type = ?`,
		multi.ActivityTableName(chain),
		multi.ActivityTableName(chain))

	if err := d.DB.Raw(sql, collectionAddr, tokenIds,
		multi.Sale, multi.Sale).Scan(&lastSales).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get item last sale price")
	}

	return lastSales, nil
}

// QueryBestBids 查询NFT的最佳出价信息
// 该函数主要功能:
// 1. 根据链名称、用户地址、集合地址和代币ID列表查询NFT的出价信息
// 2. 返回符合条件的出价订单列表
// 3. 如果指定了用户地址,则排除该用户的出价
func (d *Dao) QueryBestBids(ctx context.Context, chain string, userAddr string,
	collectionAddr string, tokenIds []string) ([]multi.Order, error) {
	var bestBids []multi.Order
	var sql string

	// SQL解释:
	// 1. 查询订单表中符合条件的出价记录
	// 2. 条件包括:
	//    - 指定集合地址
	//    - 指定代币ID列表
	//    - 订单类型为出价单
	//    - 订单状态为激活
	//    - 未过期
	//    - 剩余数量大于0
	//    - 如果指定用户地址,则排除该用户的出价
	if userAddr == "" {
		sql = fmt.Sprintf(`
			SELECT order_id, token_id, event_time, price, salt, 
				expire_time, maker, order_type, quantity_remaining, size   
			FROM %s
			WHERE collection_address = ?
				AND token_id IN (?)
				AND order_type = ?
				AND order_status = ?
				AND expire_time > ?
				AND quantity_remaining > 0
		`, multi.OrderTableName(chain))
	} else {
		sql = fmt.Sprintf(`
			SELECT order_id, token_id, event_time, price, salt, 
				expire_time, maker, order_type, quantity_remaining, size   
			FROM %s
			WHERE collection_address = ?
				AND token_id IN (?)
				AND order_type = ?
				AND order_status = ?
				AND expire_time > ?
				AND quantity_remaining > 0
				AND maker != '%s'
		`, multi.OrderTableName(chain), userAddr)
	}

	if err := d.DB.Raw(sql, collectionAddr, tokenIds,
		multi.ItemBidOrder, multi.OrderStatusActive,
		time.Now().Unix()).Scan(&bestBids).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get item best bids")
	}

	return bestBids, nil
}

// QueryItemsBestBids 查询多个NFT Item的最高出价信息
// 主要功能:
// 1. 根据链名称、用户地址和Itemem信息列表查询ItemItem的最高出价订单
// 2. 如果指定了用户地址,则排除该用户的出价
// 3. 返回所有符合条件的有效订单(未过期且有剩余数量)
func (d *Dao) QueryItemsBestBids(ctx context.Context, chain string, userAddr string, itemInfos []types.ItemInfo) ([]multi.Order, error) {
	// 构建查询条件,将每个Item的集合地址和tokenID组合成(addr,tokenId)形式
	var conditions []clause.Expr
	for _, info := range itemInfos {
		conditions = append(conditions, gorm.Expr("(?, ?)", info.CollectionAddress, info.TokenID))
	}

	var bestBids []multi.Order
	var sql string

	// 根据是否指定用户地址构建不同的SQL
	if userAddr == "" {
		// SQL解释:
		// 1. 从订单表中查询订单详细信息
		// 2. WHERE条件:
		//   - 集合地址和tokenID匹配输入的Item列表
		//   - 订单类型为Item出价单
		//   - 订单状态为活跃
		//   - 剩余数量大于0
		//   - 未过期
		sql = fmt.Sprintf(`
SELECT order_id, token_id, event_time, price, salt, expire_time, maker, order_type, quantity_remaining, size
    FROM %s
    WHERE (collection_address,token_id) IN (?)
      AND order_type = ?
      AND order_status = ?
	  AND quantity_remaining > 0
      AND expire_time > ?
`, multi.OrderTableName(chain))
	} else {
		// SQL解释:
		// 与上面相同,但增加了排除指定用户的条件
		sql = fmt.Sprintf(`
SELECT order_id, token_id, event_time, price, salt, expire_time, maker, order_type, quantity_remaining,size 
    FROM %s
    WHERE (collection_address,token_id) IN (?)
      AND order_type = ?
      AND order_status = ?
	  AND quantity_remaining > 0
      AND expire_time > ?
	  AND maker != '%s'
`, multi.OrderTableName(chain), userAddr)
	}

	// 执行SQL查询
	if err := d.DB.Raw(sql, conditions, multi.ItemBidOrder, multi.OrderStatusActive, time.Now().Unix()).Scan(&bestBids).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get item best bids")
	}

	return bestBids, nil
}

// QueryCollectionsBestBid 查询多个集合的最高出价信息
// 该函数主要功能:
// 1. 根据链名称、用户地址和集合地址列表查询每个集合的最高出价订单
// 2. 如果指定了用户地址,则排除该用户的出价
// 3. 返回每个集合中价格最高的有效订单(未过期且有剩余数量)
func (d *Dao) QueryCollectionsBestBid(ctx context.Context, chain string, userAddr string, collectionAddrs []string) ([]*multi.Order, error) {
	var bestBid []*multi.Order

	// SQL解释:
	// 1. 主查询:从订单表中查询订单详细信息
	sql := fmt.Sprintf(`
		SELECT collection_address, order_id, price,event_time, expire_time, salt, maker, order_type, quantity_remaining, size  
		FROM %s `, multi.OrderTableName(chain))

	// 2. 子查询:获取每个集合的最高出价
	sql += fmt.Sprintf(`where (collection_address,price) in (SELECT collection_address, max(price) as price FROM %s `, multi.OrderTableName(chain))

	// 3. 子查询条件:
	//   - 集合地址在给定列表中
	//   - 订单类型为集合出价单
	//   - 订单状态为活跃
	//   - 剩余数量大于0
	//   - 未过期
	//   - 如果指定用户地址,则排除该用户
	sql += `where collection_address in (?) and order_type = ? and order_status = ? and quantity_remaining > 0 and expire_time > ? `
	if userAddr != "" {
		sql += fmt.Sprintf(" and maker != '%s'", userAddr)
	}
	sql += `group by collection_address ) `

	// 4. 主查询条件:与子查询条件相同
	sql += `and order_type = ? and order_status = ? and quantity_remaining > 0 and expire_time > ? `
	if userAddr != "" {
		sql += fmt.Sprintf(" and maker != '%s'", userAddr)
	}

	// 5. 执行查询
	if err := d.DB.Raw(sql, collectionAddrs, multi.CollectionBidOrder, multi.OrderStatusActive, time.Now().Unix(), multi.CollectionBidOrder, multi.OrderStatusActive, time.Now().Unix()).Scan(&bestBid).Error; err != nil {
		return bestBid, errors.Wrap(err, "failed on get item best bids")
	}

	return bestBid, nil
}

// QueryCollectionBestBid 查询集合最高出价信息
// 该函数主要功能:
// 1. 根据链名称、用户地址和集合地址查询该集合的最高出价订单
// 2. 如果指定了用户地址,则排除该用户的出价
// 3. 返回价格最高的一个有效订单(未过期且有剩余数量)
func (d *Dao) QueryCollectionBestBid(ctx context.Context, chain string,
	userAddr string, collectionAddr string) (multi.Order, error) {
	var bestBid multi.Order
	var sql string

	// SQL解释:
	// 1. 从订单表中查询订单详细信息
	// 2. 条件:
	//   - 指定集合地址
	//   - 订单类型为集合出价单
	//   - 订单状态为活跃
	//   - 剩余数量大于0
	//   - 未过期
	// 3. 按价格降序排序并限制返回1条记录
	if userAddr == "" {
		sql = fmt.Sprintf(`
			SELECT order_id, price, event_time, expire_time, salt, maker, 
				order_type, quantity_remaining, size  
			FROM %s
			WHERE collection_address = ?
			AND order_type = ?
			AND order_status = ?
			AND quantity_remaining > 0
			AND expire_time > ? 
			ORDER BY price DESC 
			LIMIT 1
		`, multi.OrderTableName(chain))
	} else {
		sql = fmt.Sprintf(`
			SELECT order_id, price, event_time, expire_time, salt, maker, 
				order_type, quantity_remaining, size  
			FROM %s
			WHERE collection_address = ?
			AND order_type = ?
			AND order_status = ?
			AND quantity_remaining > 0
			AND expire_time > ? 
			AND maker != '%s'
			ORDER BY price DESC 
			LIMIT 1
		`, multi.OrderTableName(chain), userAddr)
	}

	if err := d.DB.Raw(sql, collectionAddr, multi.CollectionBidOrder,
		multi.OrderStatusActive, time.Now().Unix()).Scan(&bestBid).Error; err != nil {
		return bestBid, errors.Wrap(err, "failed on get item best bids")
	}

	return bestBid, nil
}

// QueryCollectionTopNBid 查询集合中前N个最高出价订单
// 主要功能:
// 1. 查询指定集合中的最高出价订单
// 2. 根据剩余数量展开订单
// 3. 返回指定数量的订单记录
func (d *Dao) QueryCollectionTopNBid(ctx context.Context, chain string,
	userAddr string, collectionAddr string, num int) ([]multi.Order, error) {
	var bestBids []multi.Order
	var sql string

	// 根据是否指定用户地址构建不同的SQL
	if userAddr == "" {
		// SQL解释:
		// 1. 查询订单基本信息(订单ID、价格、时间、过期时间等)
		// 2. 条件:
		//   - 指定集合地址
		//   - 订单类型为集合出价单
		//   - 订单状态为活跃
		//   - 剩余数量大于0
		//   - 未过期
		// 3. 按价格降序排序并限制返回记录数
		sql = fmt.Sprintf(`
			SELECT order_id, price, event_time, expire_time, salt, maker, 
				order_type, quantity_remaining, size 
			FROM %s
			WHERE collection_address = ?
				AND order_type = ?
				AND order_status = ?
				AND quantity_remaining > 0
				AND expire_time > ? 
			ORDER BY price DESC 
			LIMIT %d
		`, multi.OrderTableName(chain), num)
	} else {
		// SQL与上面类似,增加了排除指定用户的条件(maker != userAddr)
		sql = fmt.Sprintf(`
			SELECT order_id, price, event_time, expire_time, salt, maker, 
				order_type, quantity_remaining, size
			FROM %s
			WHERE collection_address = ?
				AND order_type = ?
				AND order_status = ?
				AND quantity_remaining > 0
				AND expire_time > ? 
				AND maker != '%s'
			ORDER BY price DESC 
			LIMIT %d
		`, multi.OrderTableName(chain), userAddr, num)
	}

	// 执行SQL查询
	if err := d.DB.Raw(sql, collectionAddr, multi.CollectionBidOrder,
		multi.OrderStatusActive, time.Now().Unix()).Scan(&bestBids).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get item best bids")
	}

	// 根据剩余数量展开订单
	var results []multi.Order
	for i := 0; i < len(bestBids); i++ {
		for j := 0; j < int(bestBids[i].QuantityRemaining); j++ {
			results = append(results, bestBids[i])
		}
	}

	// 返回指定数量的订单
	if num > len(results) {
		return results[:], nil
	}
	return results[:num], nil
}

var collectionDetailFields = []string{"id", "chain_id", "token_standard", "name", "address", "image_uri", "floor_price", "sale_price", "item_amount", "owner_amount"}

const OrderType = 1
const OrderStatus = 0

// QueryListedAmount 查询集合中已上架NFT的数量
func (d *Dao) QueryListedAmount(ctx context.Context, chain string, collectionAddr string) (int64, error) {
	// SQL解释:
	// 1. 从Item表(ci)和订单表(co)联表查询
	// 2. 关联条件:集合地址和tokenID都相同
	// 3. 使用distinct去重统计不同的tokenID数量
	// 4. WHERE条件:
	//   - 指定集合地址
	//   - 订单类型为listing(OrderType=1)
	//   - 订单状态为active(OrderStatus=0)
	//   - 卖家是NFT当前所有者
	//   - 排除marketplace_id=1的订单
	sql := fmt.Sprintf(`SELECT count(distinct (co.token_id)) as counts
			FROM %s as ci
					join %s co on co.collection_address = ci.collection_address and co.token_id = ci.token_id
			WHERE (co.collection_address=? and co.order_type = ? and
				co.order_status = ? and co.maker = ci.owner and co.marketplace_id != ?)
		`, multi.ItemTableName(chain), multi.OrderTableName(chain))

	var counts int64
	if err := d.DB.WithContext(ctx).Raw(
		sql,
		collectionAddr,
		OrderType,
		OrderStatus,
		1,
	).Scan(&counts).Error; err != nil {
		return 0, errors.Wrap(err, "failed on get listed item amount")
	}

	return counts, nil
}

// QueryListedAmountEachCollection 查询多个集合中已上架NFT的数量
func (d *Dao) QueryListedAmountEachCollection(ctx context.Context, chain string, collectionAddrs []string, userAddrs []string) ([]types.CollectionInfo, error) {
	var counts []types.CollectionInfo

	// SQL解释:
	// 1. 从Item表(ci)和订单表(co)联表查询
	// 2. 选择字段:
	//    - ci.collection_address 作为 address
	//    - count(distinct co.token_id) 作为 list_amount,统计每个集合中不重复的tokenID数量
	// 3. 关联条件:集合地址和tokenID都相同
	// 4. WHERE条件:
	//    - 集合地址在给定列表中
	//    - NFT所有者在给定用户列表中
	//    - 订单类型为listing(OrderType=1)
	//    - 订单状态为active(OrderStatus=0)
	//    - 卖家是NFT当前所有者
	//    - 排除marketplace_id=1的订单
	// 5. 按集合地址分组,获取每个集合的统计结果
	sql := fmt.Sprintf(`SELECT  ci.collection_address as address, count(distinct (co.token_id)) as list_amount
			FROM %s as ci
					join %s co on co.collection_address = ci.collection_address and co.token_id = ci.token_id
			WHERE (co.collection_address in (?) and ci.owner in (?) and co.order_type = ? and
				co.order_status = ? and co.maker = ci.owner and co.marketplace_id != ?) group by ci.collection_address`,
		multi.ItemTableName(chain), multi.OrderTableName(chain))
	if err := d.DB.WithContext(ctx).Raw(
		sql,
		collectionAddrs,
		userAddrs,
		OrderType,
		OrderStatus,
		1,
	).Scan(&counts).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get listed item amount")
	}

	return counts, nil
}

type MultiChainItemInfo struct {
	types.ItemInfo
	ChainName string
}

// QueryMultiChainUserItemsListInfo 查询多条链上用户NFT Item的挂单信息
// 主要功能:
// 1. 根据用户地址列表和Item信息列表查询每个Item的挂单状态
// 2. 支持跨链查询,按链名称分组处理
// 3. 返回每个Item的挂单价格、市场ID等信息
func (d *Dao) QueryMultiChainUserItemsListInfo(ctx context.Context, userAddrs []string,
	itemInfos []MultiChainItemInfo) ([]*CollectionItem, error) {
	var collectionItems []*CollectionItem

	// 构建用户地址参数字符串: 'addr1','addr2',...
	var userAddrsParam string
	for i, addr := range userAddrs {
		userAddrsParam += fmt.Sprintf(`'%s'`, addr)
		if i < len(userAddrs)-1 {
			userAddrsParam += ","
		}
	}

	// 按链名称对Item信息分组
	chainItems := make(map[string][]MultiChainItemInfo)
	for _, itemInfo := range itemInfos {
		items, ok := chainItems[strings.ToLower(itemInfo.ChainName)]
		if ok {
			items = append(items, itemInfo)
			chainItems[strings.ToLower(itemInfo.ChainName)] = items
		} else {
			chainItems[strings.ToLower(itemInfo.ChainName)] = []MultiChainItemInfo{itemInfo}
		}
	}

	// SQL语句组成部分
	sqlHead := "SELECT * FROM (" // 外层查询开始
	sqlTail := ") as combined"   // 外层查询结束
	var sqlMids []string         // 存储每条链的子查询

	// 遍历每条链构建子查询
	for chainName, items := range chainItems {
		// 构建IN查询条件: (('addr1','id1'),('addr2','id2'),...)
		tmpStat := fmt.Sprintf("(('%s','%s')", items[0].CollectionAddress, items[0].TokenID)
		for i := 1; i < len(items); i++ {
			tmpStat += fmt.Sprintf(",('%s','%s')", items[i].CollectionAddress, items[i].TokenID)
		}
		tmpStat += ") "

		// 构建子查询SQL
		sqlMid := "("
		// 选择字段:Item基本信息、最低挂单价格、市场ID等
		sqlMid += "select ci.id as id, ci.chain_id as chain_id,"
		sqlMid += "ci.collection_address as collection_address,ci.token_id as token_id, ci.name as name, ci.owner as owner,"
		sqlMid += "min(co.price) as list_price, " +
			"SUBSTRING_INDEX(GROUP_CONCAT(co.marketplace_id ORDER BY co.price,co.marketplace_id),',', 1) " +
			"AS market_id, min(co.price) != 0 as listing "
		// 关联Item表和订单表
		sqlMid += fmt.Sprintf("from %s as ci ", multi.ItemTableName(chainName))
		sqlMid += fmt.Sprintf("join %s co ", multi.OrderTableName(chainName))
		sqlMid += "on co.collection_address=ci.collection_address and co.token_id=ci.token_id "
		// 查询条件:匹配集合地址和tokenID、订单类型为listing、状态为active、卖家是Item所有者
		sqlMid += "where (co.collection_address,co.token_id) in "
		sqlMid += tmpStat
		sqlMid += fmt.Sprintf("and co.order_type = %d and co.order_status=%d "+
			"and co.maker = ci.owner and co.maker in (%s) ",
			multi.ListingOrder, multi.OrderStatusActive, userAddrsParam)
		sqlMid += "group by co.collection_address,co.token_id"
		sqlMid += ")"

		sqlMids = append(sqlMids, sqlMid)
	}

	// 使用UNION ALL组合所有子查询
	sql := sqlHead
	for i := 0; i < len(sqlMids); i++ {
		if i != 0 {
			sql += " UNION ALL " // 使用UNION ALL合并结果集
		}
		sql += sqlMids[i]
	}
	sql += sqlTail

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(sql).Scan(&collectionItems).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query user multi chain items list info")
	}

	return collectionItems, nil
}

// QueryMultiChainUserItemsExpireListInfo 查询多条链上用户Item的过期挂单信息
// 主要功能:
// 1. 根据用户地址列表和Item信息列表查询每个Item的挂单状态
// 2. 支持查询多条链上的Item信息
// 3. 返回Item的基本信息和挂单信息(价格、市场等)
func (d *Dao) QueryMultiChainUserItemsExpireListInfo(ctx context.Context, userAddrs []string,
	itemInfos []MultiChainItemInfo) ([]*CollectionItem, error) {
	var collectionItems []*CollectionItem

	// 构建用户地址参数字符串: 'addr1','addr2',...
	var userAddrsParam string
	for i, addr := range userAddrs {
		userAddrsParam += fmt.Sprintf(`'%s'`, addr)
		if i < len(userAddrs)-1 {
			userAddrsParam += ","
		}
	}

	// SQL语句组成部分
	sqlHead := "SELECT * FROM (" // 外层查询开始
	sqlTail := ") as combined"   // 外层查询结束
	var sqlMids []string         // 存储每个Item的子查询

	// 构建IN查询条件: (('addr1','id1'),('addr2','id2'),...)
	tmpStat := fmt.Sprintf("(('%s','%s')", itemInfos[0].CollectionAddress, itemInfos[0].TokenID)
	for i := 1; i < len(itemInfos); i++ {
		tmpStat += fmt.Sprintf(",('%s','%s')", itemInfos[i].CollectionAddress, itemInfos[i].TokenID)
	}
	tmpStat += ") "

	// 遍历每个Item构建子查询
	for _, info := range itemInfos {
		sqlMid := "("
		// 选择字段:Item基本信息、最低挂单价格、市场ID等
		sqlMid += "select ci.id as id, ci.chain_id as chain_id,"
		sqlMid += "ci.collection_address as collection_address,ci.token_id as token_id, " +
			"ci.name as name, ci.owner as owner,"
		sqlMid += "min(co.price) as list_price, " +
			"SUBSTRING_INDEX(GROUP_CONCAT(co.marketplace_id ORDER BY co.price,co.marketplace_id),',', 1) " +
			"AS market_id, min(co.price) != 0 as listing "

		// 关联Item表和订单表
		sqlMid += fmt.Sprintf("from %s as ci ", multi.ItemTableName(info.ChainName))
		sqlMid += fmt.Sprintf("join %s co ", multi.OrderTableName(info.ChainName))
		sqlMid += "on co.collection_address=ci.collection_address and co.token_id=ci.token_id "

		// 查询条件:
		// 1. 匹配集合地址和tokenID
		// 2. 订单类型为listing
		// 3. 订单状态为active或expired
		// 4. 卖家是Item所有者且在用户列表中
		sqlMid += "where (co.collection_address,co.token_id) in "
		sqlMid += tmpStat
		sqlMid += fmt.Sprintf("and co.order_type = %d and (co.order_status=%d or co.order_status=%d) "+
			"and co.maker = ci.owner and co.maker in (%s) ",
			multi.ListingOrder, multi.OrderStatusActive, multi.OrderStatusExpired, userAddrsParam)
		sqlMid += "group by co.collection_address,co.token_id"
		sqlMid += ")"

		sqlMids = append(sqlMids, sqlMid)
	}

	// 使用UNION ALL组合所有子查询
	sql := sqlHead
	for i := 0; i < len(sqlMids); i++ {
		if i != 0 {
			sql += " UNION ALL " // 使用UNION ALL合并结果集
		}
		sql += sqlMids[i]
	}
	sql += sqlTail

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(sql).Scan(&collectionItems).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query user multi chain items list info")
	}

	return collectionItems, nil
}

// QueryItemListInfo 查询单个NFT的挂单信息
// 主要功能:
// 1. 查询NFT基本信息(ID、稀有度等)和挂单信息(价格、市场等)
// 2. 如果有挂单,则查询挂单的详细信息(订单ID、过期时间等)
func (d *Dao) QueryItemListInfo(ctx context.Context, chain, collectionAddr, tokenID string) (*CollectionItem, error) {
	var collectionItem CollectionItem
	db := d.DB.WithContext(ctx).Table(fmt.Sprintf("%s as ci", multi.ItemTableName(chain)))
	coTableName := multi.OrderTableName(chain)

	// SQL解释:
	// 1. 从items表和orders表联表查询
	// 2. 选择NFT基本信息和挂单信息
	// 3. 按价格升序,取最低价的市场ID
	// 4. 过滤条件:匹配NFT、活跃订单、owner是卖家
	err := db.Select(
		"ci.id as id, ci.chain_id as chain_id, "+
			"ci.collection_address as collection_address,ci.token_id as token_id, "+
			"ci.name as name, ci.owner as owner, "+
			"min(co.price) as list_price, "+
			"SUBSTRING_INDEX(GROUP_CONCAT(co.marketplace_id ORDER BY co.price,co.marketplace_id),',', 1) AS market_id, "+
			"min(co.price) != 0 as listing").
		Joins(fmt.Sprintf("join %s co on co.collection_address=ci.collection_address and co.token_id=ci.token_id",
			coTableName)).
		Where("ci.collection_address =? and ci.token_id = ? and co.order_type = ? and co.order_status=? "+
			"and co.maker = ci.owner",
			collectionAddr, tokenID, multi.ListingOrder, multi.OrderStatusActive).
		Group("ci.collection_address,ci.token_id").
		Scan(&collectionItem).Error

	if err != nil {
		return nil, errors.Wrap(err, "failed on query user items list info")
	}

	// 如果没有挂单,直接返回
	if !collectionItem.Listing {
		return &collectionItem, nil
	}

	// SQL解释:
	// 如果有挂单,查询订单详细信息
	// 1. 从orders表查询订单ID、过期时间等信息
	// 2. 匹配NFT、卖家、状态和价格
	var listOrder multi.Order
	if err := d.DB.WithContext(ctx).Table(fmt.Sprintf("%s as ci", multi.OrderTableName(chain))).
		Select("order_id, expire_time, maker, salt, event_time").
		Where("collection_address=? and token_id=? and maker=? and order_status=? and price = ?",
			collectionItem.CollectionAddress, collectionItem.TokenId,
			collectionItem.Owner, multi.OrderStatusActive, collectionItem.ListPrice).
		Scan(&listOrder).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query item order id")
	}

	// 填充订单详细信息
	collectionItem.OrderID = listOrder.OrderID
	collectionItem.ListExpireTime = listOrder.ExpireTime
	collectionItem.ListMaker = listOrder.Maker
	collectionItem.ListSalt = listOrder.Salt
	collectionItem.ListTime = listOrder.EventTime

	return &collectionItem, nil
}

// QueryListingInfo 查询订单上架信息
// 该函数主要功能:
// 1. 根据传入的价格信息列表查询对应的订单详情
// 2. 每个价格信息包含:集合地址、代币ID、创建者、订单状态和价格
// 3. 返回订单的基本信息:集合地址、代币ID、订单ID、创建时间、过期时间等
func (d *Dao) QueryListingInfo(ctx context.Context, chain string,
	priceInfos []types.ItemPriceInfo) ([]multi.Order, error) {
	// 构建查询条件
	var conditions []clause.Expr
	for _, price := range priceInfos {
		conditions = append(conditions,
			gorm.Expr("(?, ?, ?, ?, ?)",
				price.CollectionAddress,
				price.TokenID,
				price.Maker,
				price.OrderStatus,
				price.Price))
	}

	var orders []multi.Order
	// SQL解释:
	// 1. 从订单表中查询指定字段
	// 2. WHERE条件使用IN子句,匹配多个(集合地址,代币ID,创建者,状态,价格)组合
	// 3. 返回匹配的订单记录
	if err := d.DB.WithContext(ctx).
		Table(multi.OrderTableName(chain)).
		Select("collection_address,token_id,order_id,event_time,"+
			"expire_time,salt,maker ").
		Where("(collection_address,token_id,maker,order_status,price) in (?)",
			conditions).
		Scan(&orders).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query items order id")
	}

	return orders, nil
}

type MultiChainItemPriceInfo struct {
	types.ItemPriceInfo
	ChainName string
}

// QueryMultiChainListingInfo 查询多条链上的NFT挂单信息
func (d *Dao) QueryMultiChainListingInfo(ctx context.Context, priceInfos []MultiChainItemPriceInfo) ([]multi.Order, error) {
	var orders []multi.Order

	// 按链名称对价格信息分组
	chainItemPrices := make(map[string][]MultiChainItemPriceInfo)
	for _, priceInfo := range priceInfos {
		items, ok := chainItemPrices[strings.ToLower(priceInfo.ChainName)]
		if ok {
			items = append(items, priceInfo)
			chainItemPrices[strings.ToLower(priceInfo.ChainName)] = items
		} else {
			chainItemPrices[strings.ToLower(priceInfo.ChainName)] = []MultiChainItemPriceInfo{priceInfo}
		}
	}

	// SQL语句组成部分
	sqlHead := "SELECT * FROM (" // 外层查询开始
	sqlTail := ") as combined"   // 外层查询结束
	var sqlMids []string         // 存储每条链的子查询

	// 遍历每条链构建子查询
	for chainName, priceInfos := range chainItemPrices {
		// 构建IN查询条件: (('addr1','id1','maker1',status1,price1),...)
		tmpStat := fmt.Sprintf("(('%s','%s','%s',%d, %s)", priceInfos[0].CollectionAddress, priceInfos[0].TokenID, priceInfos[0].Maker, priceInfos[0].OrderStatus, priceInfos[0].Price.String())
		for i := 1; i < len(priceInfos); i++ {
			tmpStat += fmt.Sprintf(",('%s','%s','%s',%d, %s)", priceInfos[i].CollectionAddress, priceInfos[i].TokenID, priceInfos[i].Maker, priceInfos[i].OrderStatus, priceInfos[i].Price.String())
		}
		tmpStat += ") "

		// 构建子查询SQL:
		// 1. 选择订单的基本字段
		// 2. 从对应链的订单表查询
		// 3. 匹配集合地址、代币ID、创建者、状态和价格
		sqlMid := "("
		sqlMid += "select collection_address,token_id,order_id,salt,event_time,expire_time,maker "
		sqlMid += fmt.Sprintf("from %s ", multi.OrderTableName(chainName))
		sqlMid += "where (collection_address,token_id,maker,order_status,price) in "
		sqlMid += tmpStat
		sqlMid += ")"

		sqlMids = append(sqlMids, sqlMid)
	}

	// 使用UNION ALL组合所有子查询
	sql := sqlHead
	for i := 0; i < len(sqlMids); i++ {
		if i != 0 {
			sql += " UNION ALL " // 使用UNION ALL合并结果集
		}
		sql += sqlMids[i]
	}
	sql += sqlTail

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(sql).Scan(&orders).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query user multi chain order list info")
	}

	return orders, nil
}

// QueryItemListingAcrossPlatforms 查询NFT在各平台的挂单价格信息
func (d *Dao) QueryItemListingAcrossPlatforms(ctx context.Context, chain, collectionAddr, tokenID string, user []string) ([]types.ListingInfo, error) {
	var listings []types.ListingInfo
	if err := d.DB.WithContext(ctx).Table(multi.OrderTableName(chain)).
		Select("marketplace_id, min(price) as price").
		Where("collection_address=? and token_id=? and maker in (?) and order_type=? and order_status = ?",
			collectionAddr,
			tokenID,
			user,
			multi.ListingOrder,
			multi.OrderStatusActive).Group("marketplace_id").Scan(&listings).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query listing from db")
	}

	return listings, nil
}

// QueryItemInfo 查询单个NFT Item的详细信息
func (d *Dao) QueryItemInfo(ctx context.Context, chain, collectionAddr, tokenID string) (*multi.Item, error) {
	var item multi.Item

	// 构建SQL查询
	// 从items表中查询指定NFT的信息
	err := d.DB.WithContext(ctx).
		Table(fmt.Sprintf("%s as ci", multi.ItemTableName(chain))).
		Select("ci.id as id, "+
			"ci.chain_id as chain_id, "+
			"ci.collection_address as collection_address, "+
			"ci.token_id as token_id, "+
			"ci.name as name, "+
			"ci.owner as owner").
		Where("ci.collection_address =? and ci.token_id = ? ",
			collectionAddr, tokenID).
		Scan(&item).Error

	if err != nil {
		return nil, errors.Wrap(err, "failed on query user items list info")
	}

	return &item, nil
}

// QueryTraitsPrice 查询NFT Trait的价格信息
// 主要功能:
// 1. 查询指定NFT集合中特定token id的 Trait价格
// 2. 通过关联订单表和 Trait表,找出每个 Trait对应的最低挂单价格
// 3. 返回 Trait价格列表
func (d *Dao) QueryTraitsPrice(ctx context.Context, chain, collectionAddr string, tokenIds []string) ([]types.TraitPrice, error) {
	var traitsPrice []types.TraitPrice

	// 构建子查询,查询指定token的 Trait信息
	listSubQuery := d.DB.WithContext(ctx).
		Table(fmt.Sprintf("%s as gf_order", multi.OrderTableName(chain))).
		// 查询字段: Trait名称、 Trait值、最低价格
		Select("gf_attribute.trait,gf_attribute.trait_value,min(gf_order.price) as price").
		// 条件1:匹配集合地址、订单类型为挂单、订单状态为活跃
		Where("gf_order.collection_address=? and gf_order.order_type=? and gf_order.order_status = ?",
			collectionAddr,
			multi.ListingOrder,
			multi.OrderStatusActive).
		// 条件2: Trait必须在指定token的 Trait列表中
		Where("(gf_attribute.trait,gf_attribute.trait_value) in (?)",
			d.DB.WithContext(ctx).
				Table(fmt.Sprintf("%s as gf_attr", multi.ItemTraitTableName(chain))).
				Select("gf_attr.trait, gf_attr.trait_value").
				Where("gf_attr.collection_address=? and gf_attr.token_id in (?)",
					collectionAddr, tokenIds))

	// 关联 Trait表,按 Trait分组查询
	if err := listSubQuery.
		Joins(fmt.Sprintf("join %s as gf_attribute on gf_order.collection_address = gf_attribute.collection_address "+
			"and gf_order.token_id=gf_attribute.token_id", multi.ItemTraitTableName(chain))).
		Group("gf_attribute.trait, gf_attribute.trait_value").
		Scan(&traitsPrice).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query trait price")
	}

	return traitsPrice, nil
}

func (d *Dao) UpdateItemOwner(ctx context.Context, chain string, collectionAddr, tokenID string, owner string) error {
	if err := d.DB.WithContext(ctx).Table(fmt.Sprintf("%s as ci", multi.ItemTableName(chain))).
		Where("collection_address = ? and token_id = ?", collectionAddr, tokenID).Update("owner", owner).
		Error; err != nil {
		return errors.Wrap(err, "failed on get user item count")
	}
	return nil
}

// QueryItemBids 查询Item的出价信息
func (d *Dao) QueryItemBids(ctx context.Context, chain string, collectionAddr, tokenID string,
	page, pageSize int) ([]types.ItemBid, int64, error) {
	// 构建SQL查询
	// 查询字段包括:市场ID、集合地址、代币ID、订单ID、盐值、事件时间、过期时间
	// 价格、出价人、订单类型、未成交数量、出价总量
	db := d.DB.WithContext(ctx).Table(multi.OrderTableName(chain)).
		Select("marketplace_id, collection_address, token_id, order_id, salt, "+
			"event_time, expire_time, price, maker as bidder, order_type, "+
			"quantity_remaining as bid_unfilled, size as bid_size").
		// 查询条件1:集合级别的出价 - 匹配集合地址,订单类型为集合出价,状态为活跃,未过期且有剩余数量
		Where("collection_address = ? and order_type = ? and order_status = ? "+
			"and expire_time > ? and quantity_remaining > 0",
			collectionAddr, multi.CollectionBidOrder, multi.OrderStatusActive, time.Now().Unix()).
		// 查询条件2:Item级别的出价 - 匹配集合地址和代币ID,订单类型为Item出价,其他条件同上
		Or("collection_address = ? and token_id=? and order_type = ? and order_status = ? "+
			"and expire_time > ? and quantity_remaining > 0",
			collectionAddr, tokenID, multi.ItemBidOrder, multi.OrderStatusActive, time.Now().Unix())

	// 查询总记录数
	var count int64
	countTx := db.Session(&gorm.Session{})
	if err := countTx.Count(&count).Error; err != nil {
		return nil, 0, errors.Wrap(db.Error, "failed on count user items")
	}

	// 如果没有记录直接返回
	var itemBids []types.ItemBid
	if count == 0 {
		return itemBids, count, nil
	}

	// 分页查询出价记录,按价格降序排列
	if err := db.Order("price desc").
		Offset(int((page - 1) * pageSize)).
		Limit(int(pageSize)).
		Scan(&itemBids).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on get user items")
	}

	return itemBids, count, nil
}
