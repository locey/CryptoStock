package dao

import (
	"context"
	"fmt"
	"strings"
	"time"

	//"github.com/locey/CryptoStock/StockCoinBase/ordermanager"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"
	"github.com/shopspring/decimal"

	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

const MaxBatchReadCollections = 500
const MaxRetries = 3
const QueryTimeout = time.Second * 30

var collectionFields = []string{"id", "chain_id", "token_standard", "name", "address", "image_uri", "floor_price", "sale_price", "item_amount", "owner_amount"}

// QueryHistorySalesPriceInfo 查询指定时间段内的NFT销售历史价格信息
func (d *Dao) QueryHistorySalesPriceInfo(ctx context.Context, chain string, collectionAddr string, durationTimeStamp int64) ([]multi.Activity, error) {
	var historySalesInfo []multi.Activity
	now := time.Now().Unix()

	// SQL语句解释:
	// 1. 从activity表中查询指定字段(price,token_id,event_time)
	// 2. 条件:
	//   - 活动类型为Sale(销售)
	//   - 集合地址匹配
	//   - 事件时间在指定范围内(now-duration到now)
	if err := d.DB.WithContext(ctx).
		Table(multi.ActivityTableName(chain)).
		Select("price", "token_id", "event_time").
		Where("activity_type = ? and collection_address = ? and event_time >= ? and event_time <= ?",
			multi.Sale,
			collectionAddr,
			now-durationTimeStamp,
			now).
		Find(&historySalesInfo).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get history sales info")
	}

	return historySalesInfo, nil
}

// QueryAllCollectionInfo 查询指定链上的所有NFT集合信息
func (d *Dao) QueryAllCollectionInfo(ctx context.Context, chain string) ([]multi.Collection, error) {
	ctx, cancel := context.WithTimeout(ctx, QueryTimeout)
	defer cancel()

	tx := d.DB.WithContext(ctx).Begin() // 开启事务
	defer func() {                      // 捕获异常
		if r := recover(); r != nil {
			tx.Rollback() // 回滚事务
			panic(r)
		}
	}()

	cursor := int64(0) // 游标
	var allCollections []multi.Collection
	// 循环分页查询所有集合信息
	for {
		var collections []multi.Collection
		// 最多重试MaxRetries次查询
		for i := 0; i < MaxRetries; i++ {
			// 查询大于当前cursor的MaxBatchReadCollections条记录
			err := tx.Table(multi.CollectionTableName(chain)).
				Select(collectionFields).
				Where("id > ?", cursor).
				Limit(MaxBatchReadCollections).
				Order("id asc").
				Scan(&collections).Error

			// 查询成功则跳出重试循环
			if err == nil {
				break
			}
			// 达到最大重试次数仍失败,则回滚事务并返回错误
			if i == MaxRetries-1 {
				tx.Rollback()
				return nil, errors.Wrap(err, "failed on get collections info")
			}
			// 重试间隔时间递增
			time.Sleep(time.Duration(i+1) * time.Second)
		}

		// 将本次查询结果追加到总结果中
		allCollections = append(allCollections, collections...)
		// 如果本次查询结果数小于批次大小,说明已经查完所有记录
		if len(collections) < MaxBatchReadCollections {
			break
		}

		// 更新游标为最后一条记录的ID
		cursor = collections[len(collections)-1].Id
	}

	if err := tx.Commit().Error; err != nil { // 提交事务
		return nil, errors.Wrap(err, "failed to commit transaction")
	}
	return allCollections, nil
}

// QueryCollectionInfo 查询指定链上的NFT集合信息
func (d *Dao) QueryCollectionInfo(ctx context.Context, chain string, collectionAddr string) (*multi.Collection, error) {
	var collection multi.Collection
	if err := d.DB.WithContext(ctx).Table(multi.CollectionTableName(chain)).
		Select(collectionDetailFields).Where("address = ?", collectionAddr).
		First(&collection).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get collection info")
	}

	return &collection, nil
}

// QueryCollectionsInfo 批量查询指定链上的NFT集合信息
func (d *Dao) QueryCollectionsInfo(ctx context.Context, chain string, collectionAddrs []string) ([]multi.Collection, error) {
	addrs := removeRepeatedElement(collectionAddrs)
	var collections []multi.Collection
	if err := d.DB.WithContext(ctx).Table(multi.CollectionTableName(chain)).
		Select(collectionDetailFields).Where("address in (?)", addrs).
		Scan(&collections).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get collection info")
	}

	return collections, nil
}

// QueryMultiChainCollectionsInfo 批量查询多条链上的NFT集合信息
// 参数collectionAddrs是一个二维数组,每个元素包含[合约地址,链名称]
// 返回多条链上的NFT集合信息列表
func (d *Dao) QueryMultiChainCollectionsInfo(ctx context.Context, collectionAddrs [][]string) ([]multi.Collection, error) {
	addrs := removeRepeatedElementArr(collectionAddrs)
	var collections []multi.Collection
	var collection multi.Collection
	for _, collectionAddr := range addrs {
		if err := d.DB.WithContext(ctx).Table(multi.CollectionTableName(collectionAddr[1])).
			Select(collectionDetailFields).Where("address = ?", collectionAddr[0]).
			Scan(&collection).Error; err != nil {
			return nil, errors.Wrap(err, "failed on get collection info")
		}
		collections = append(collections, collection)
	}

	return collections, nil
}

// QueryMultiChainUserCollectionInfos 查询用户在多条链上的Collection信息
func (d *Dao) QueryMultiChainUserCollectionInfos(ctx context.Context, chainID []int,
	chainNames []string, userAddrs []string) ([]types.UserCollections, error) {
	var userCollections []types.UserCollections

	// 构建用户地址参数字符串,格式: 'addr1','addr2',...
	var userAddrsParam string
	for i, addr := range userAddrs {
		userAddrsParam += fmt.Sprintf(`'%s'`, addr)
		if i < len(userAddrs)-1 {
			userAddrsParam += ","
		}
	}

	// SQL语句组成部分
	sqlHead := "SELECT * FROM ("
	// 按照地板价*持有数量降序排序
	sqlTail := ") as combined ORDER BY combined.floor_price * " +
		"CAST(combined.item_count AS DECIMAL) DESC"
	var sqlMids []string

	// 遍历每条链,构建子查询
	for _, chainName := range chainNames {
		sqlMid := "("
		// 查询Collection基本信息和用户持有数量
		sqlMid += "select " +
			"gc.address as address, " +
			"gc.name as name, " +
			"gc.floor_price as floor_price, " +
			"gc.chain_id as chain_id, " +
			"gc.item_amount as item_amount, " +
			"gc.symbol as symbol, " +
			"gc.image_uri as image_uri, " +
			"count(*) as item_count "
		// 从Collection表和Item表联表查询
		sqlMid += fmt.Sprintf("from %s as gc ", multi.CollectionTableName(chainName))
		sqlMid += fmt.Sprintf("join %s as gi ", multi.ItemTableName(chainName))
		sqlMid += "on gc.address = gi.collection_address "
		// 过滤指定用户持有的Item
		sqlMid += fmt.Sprintf("where gi.owner in (%s) ", userAddrsParam)
		sqlMid += "group by gc.address"
		sqlMid += ")"

		sqlMids = append(sqlMids, sqlMid)
	}

	// 组装完整SQL,使用UNION ALL合并多链结果
	sql := sqlHead
	for i := 0; i < len(sqlMids); i++ {
		if i != 0 {
			sql += " UNION ALL "
		}
		sql += sqlMids[i]
	}
	sql += sqlTail

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(sql).Scan(&userCollections).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get user multi chain collection infos")
	}

	return userCollections, nil
}

// QueryMultiChainUserItemInfos 查询用户拥有nft的Item基本信息，list信息和bid信息，从Item表和Activity表中查询
// 参数:
// - chain: 链名称列表
// - userAddrs: 用户地址列表
// - contractAddrs: 合约地址列表
// - page: 页码
// - pageSize: 每页大小
// 返回:
// - []types.PortfolioItemInfo: NFT Item信息列表
// - int64: 总数
// - error: 错误信息
func (d *Dao) QueryMultiChainUserItemInfos(ctx context.Context, chain []string, userAddrs []string,
	contractAddrs []string, page, pageSize int) ([]types.PortfolioItemInfo, int64, error) {
	var count int64
	var items []types.PortfolioItemInfo

	// 构建用户地址参数字符串,格式: 'addr1','addr2',...
	var userAddrsParam string
	for i, addr := range userAddrs {
		userAddrsParam += fmt.Sprintf(`'%s'`, addr)
		if i < len(userAddrs)-1 {
			userAddrsParam += ","
		}
	}

	// SQL语句组成部分
	sqlCntHead := "SELECT COUNT(*) FROM ("
	sqlHead := "SELECT * FROM ("
	sqlTail := fmt.Sprintf(") as combined ORDER BY combined.owned_time DESC LIMIT %d OFFSET %d",
		pageSize, page-1)
	var sqlMids []string

	// 遍历每条链,构建子查询
	for _, chainName := range chain {
		sqlMid := "("
		// 查询Item基本信息和最后交易时间
		// 选择字段: chain_id, collection_address, token_id, name, owner, owned_time
		sqlMid += "select gi.chain_id as chain_id, " +
			"gi.collection_address as collection_address, " +
			"gi.token_id as token_id, " +
			"gi.name as name, " +
			"gi.owner as owner, " +
			"sub.last_event_time as owned_time "
		sqlMid += fmt.Sprintf("from %s gi ", multi.ItemTableName(chainName))

		// 左连接子查询,获取最后交易时间
		sqlMid += "left join "
		sqlMid += "(select sgi.collection_address, sgi.token_id, " +
			"max(sga.event_time) as last_event_time "
		sqlMid += fmt.Sprintf("from %s sgi join %s sga ",
			multi.ItemTableName(chainName), multi.ActivityTableName(chainName))
		sqlMid += "on sgi.collection_address = sga.collection_address " +
			"and sgi.token_id = sga.token_id "
		sqlMid += fmt.Sprintf("where sgi.owner in (%s) and sga.activity_type = %d ",
			userAddrsParam, multi.Sale)

		// 如果指定了合约地址,添加合约地址过滤条件
		if len(contractAddrs) > 0 {
			sqlMid += fmt.Sprintf("and sgi.collection_address in ('%s'", contractAddrs[0])
			for i := 1; i < len(contractAddrs); i++ {
				sqlMid += fmt.Sprintf(",'%s'", contractAddrs[i])
			}
			sqlMid += ") "
		}
		sqlMid += "group by sgi.collection_address, sgi.token_id) sub "
		sqlMid += "on gi.collection_address = sub.collection_address " +
			"and gi.token_id = sub.token_id "

		// 过滤指定用户持有的Item
		sqlMid += fmt.Sprintf("where gi.owner in (%s) ", userAddrsParam)
		if len(contractAddrs) > 0 {
			sqlMid += fmt.Sprintf("and gi.collection_address in ('%s'", contractAddrs[0])
			for i := 1; i < len(contractAddrs); i++ {
				sqlMid += fmt.Sprintf(",'%s'", contractAddrs[i])
			}
			sqlMid += ")"
		}
		sqlMid += ")"

		sqlMids = append(sqlMids, sqlMid)
	}

	// 组装完整SQL,使用UNION ALL合并多链结果
	sqlCnt := sqlCntHead
	sql := sqlHead
	for i := 0; i < len(sqlMids); i++ {
		if i != 0 {
			sql += " UNION ALL "
			sqlCnt += " UNION ALL "
		}
		sql += sqlMids[i]
		sqlCnt += sqlMids[i]
	}
	sql += sqlTail
	sqlCnt += ") as combined"

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(sqlCnt).Scan(&count).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on count user multi chain items")
	}
	if err := d.DB.WithContext(ctx).Raw(sql).Scan(&items).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on get user multi chain items")
	}

	return items, count, nil
}

// QueryMultiChainUserListingItemInfos 查询多链上用户挂单Item信息
func (d *Dao) QueryMultiChainUserListingItemInfos(ctx context.Context, chain []string, userAddrs []string,
	contractAddrs []string, page, pageSize int) ([]types.PortfolioItemInfo, int64, error) {
	var count int64
	var items []types.PortfolioItemInfo

	// 构建用户地址参数字符串
	var userAddrsParam string
	for i, addr := range userAddrs {
		userAddrsParam += fmt.Sprintf(`'%s'`, addr)
		if i < len(userAddrs)-1 {
			userAddrsParam += ","
		}
	}

	// SQL语句头部
	sqlCntHead := "SELECT COUNT(*) FROM ("
	sqlHead := "SELECT * FROM ("
	// 分页SQL
	sqlTail := fmt.Sprintf(") as combined ORDER BY combined.owned_time DESC LIMIT %d OFFSET %d",
		pageSize, page-1)
	var sqlMids []string

	// 遍历每条链构建SQL
	for _, chainName := range chain {
		sqlMid := "("
		// 查询Item基本信息和最后交易时间
		sqlMid += "select gi.chain_id as chain_id, gi.collection_address as collection_address, " +
			"gi.token_id as token_id, gi.name as name, gi.owner as owner, " +
			"sub.last_event_time as owned_time "
		sqlMid += fmt.Sprintf("from %s gi ", multi.ItemTableName(chainName))
		sqlMid += "left join "
		// 子查询获取每个Item最后的交易时间
		sqlMid += "(select sgi.collection_address, sgi.token_id, " +
			"max(sga.event_time) as last_event_time "
		sqlMid += fmt.Sprintf("from %s sgi join %s sga ",
			multi.ItemTableName(chainName), multi.ActivityTableName(chainName))
		sqlMid += "on sgi.collection_address = sga.collection_address " +
			"and sgi.token_id = sga.token_id "
		// 过滤条件:指定用户和Sale类型活动
		sqlMid += fmt.Sprintf("where sgi.owner in (%s) and sga.activity_type = %d ",
			userAddrsParam, multi.Sale)

		// 添加合约地址过滤
		if len(contractAddrs) > 0 {
			sqlMid += fmt.Sprintf("and sgi.collection_address in ('%s'", contractAddrs[0])
			for i := 1; i < len(contractAddrs); i++ {
				sqlMid += fmt.Sprintf(",'%s'", contractAddrs[i])
			}
			sqlMid += ") "
		}
		sqlMid += "group by sgi.collection_address, sgi.token_id) sub "
		sqlMid += "on gi.collection_address = sub.collection_address " +
			"and gi.token_id = sub.token_id "

		// 主查询过滤条件
		sqlMid += fmt.Sprintf("where gi.owner in (%s) ", userAddrsParam)
		if len(contractAddrs) > 0 {
			sqlMid += fmt.Sprintf("and gi.collection_address in ('%s'", contractAddrs[0])
			for i := 1; i < len(contractAddrs); i++ {
				sqlMid += fmt.Sprintf(",'%s'", contractAddrs[i])
			}
			sqlMid += ")"
		}
		sqlMid += ")"

		sqlMids = append(sqlMids, sqlMid)
	}

	// 使用UNION ALL合并多链结果
	sqlCnt := sqlCntHead
	sql := sqlHead
	for i := 0; i < len(sqlMids); i++ {
		if i != 0 {
			sql += " UNION ALL "
			sqlCnt += " UNION ALL "
		}
		sql += sqlMids[i]
		sqlCnt += sqlMids[i]
	}
	sql += sqlTail
	sqlCnt += ") as combined"

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(sqlCnt).Scan(&count).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on count user multi chain items")
	}
	if err := d.DB.WithContext(ctx).Raw(sql).Scan(&items).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on get user multi chain items")
	}

	return items, count, nil
}

// QueryCollectionsListed 查询多个集合的上架数量
func (d *Dao) QueryCollectionsListed(ctx context.Context, chain string, collectionAddrs []string) ([]types.CollectionListed, error) {
	var collectionsListed []types.CollectionListed
	if len(collectionAddrs) == 0 {
		return collectionsListed, nil
	}

	// for _, address := range collectionAddrs {
	// 	count, err := d.KvStore.GetInt(ordermanager.GenCollectionListedKey(chain, address))
	// 	if err != nil {
	// 		return nil, errors.Wrap(err, "failed on set collection listed count")
	// 	}
	// 	collectionsListed = append(collectionsListed, types.CollectionListed{
	// 		CollectionAddr: address,
	// 		Count:          count,
	// 	})
	// }

	return collectionsListed, nil
}

// CacheCollectionsListed 缓存集合的上架数量
func (d *Dao) CacheCollectionsListed(ctx context.Context, chain string, collectionAddr string, listedCount int) error {
	// err := d.KvStore.SetInt(ordermanager.GenCollectionListedKey(chain, collectionAddr), listedCount)
	// if err != nil {
	// 	return errors.Wrap(err, "failed on set collection listed count")
	// }

	return nil
}

// QueryFloorPrice 查询NFT集合的地板价
func (d *Dao) QueryFloorPrice(ctx context.Context, chain string, collectionAddr string) (decimal.Decimal, error) {
	var order multi.Order

	// SQL解释:
	// 1. 从Item表(ci)和订单表(co)联表查询
	// 2. 选择字段:co.price作为地板价
	// 3. 关联条件:集合地址和tokenID都相同
	// 4. WHERE条件:
	//    - 指定集合地址
	//    - 订单类型为listing(OrderType=1)
	//    - 订单状态为active(OrderStatus=0)
	//    - 卖家是NFT当前所有者
	//    - 排除marketplace_id=1的订单
	// 5. 按价格升序排序,取第一条记录(即最低价)
	sql := fmt.Sprintf(`SELECT co.price as price
		FROM %s as ci
				left join %s co on co.collection_address = ci.collection_address and co.token_id = ci.token_id
		WHERE (co.collection_address= ? and co.order_type = ? and
			co.order_status = ? and co.maker = ci.owner and co.marketplace_id != ?)
		order by co.price asc limit 1`, multi.ItemTableName(chain), multi.OrderTableName(chain))

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(
		sql,
		collectionAddr,
		OrderType,
		OrderStatus,
		1,
	).Scan(&order).Error; err != nil {
		return decimal.Zero, errors.Wrap(err, "failed on get collection floor price")
	}

	return order.Price, nil
}

func GetCollectionTradeInfoKey(project, chain string, collectionAddr string) string {
	return fmt.Sprintf("cache:%s:%s:collection:%s:trade", strings.ToLower(project), strings.ToLower(chain), strings.ToLower(collectionAddr))
}

type CollectionVolume struct {
	Volume decimal.Decimal `json:"volume"`
}

func GetHoldersCountKey(chain string) string {
	return fmt.Sprintf("cache:es:%s:holders:count", chain)
}

// QueryCollectionFloorChange 查询集合地板价变化情况
// @param chain string 链名称
// @param timeDiff int64 时间差(秒)
// @return map[string]float64 返回集合地址到地板价变化率的映射
// @return error 错误信息
func (d *Dao) QueryCollectionFloorChange(chain string, timeDiff int64) (map[string]float64, error) {
	collectionFloorChange := make(map[string]float64)

	var collectionPrices []multi.CollectionFloorPrice
	// 这个SQL语句用于查询NFT集合的地板价变化情况:
	// 1. 从集合地板价表中选择collection_address(集合地址)、price(价格)和event_time(事件时间)
	// 2. WHERE子句包含两个条件:
	//    a) 查询每个集合的最新地板价记录(通过GROUP BY和MAX(event_time)获取)
	//    b) 查询每个集合在指定时间段之前的最新地板价记录(通过WHERE event_time <= UNIX_TIMESTAMP() - ? 筛选)
	// 3. 最后按集合地址和时间降序排序,这样可以方便计算价格变化率
	rawSql := fmt.Sprintf(`SELECT collection_address, price, event_time 
		FROM %s 
		WHERE (collection_address, event_time) IN (
			SELECT collection_address, MAX(event_time)
			FROM %s
			GROUP BY collection_address
		) OR (collection_address, event_time) IN (
			SELECT collection_address, MAX(event_time)
			FROM %s 
			WHERE event_time <= UNIX_TIMESTAMP() - ? 
			GROUP BY collection_address
		) 
		ORDER BY collection_address,event_time DESC`,
		multi.CollectionFloorPriceTableName(chain),
		multi.CollectionFloorPriceTableName(chain),
		multi.CollectionFloorPriceTableName(chain))
	if err := d.DB.Raw(rawSql, timeDiff).Scan(&collectionPrices).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get collection floor change")
	}

	// 这个循环用于计算每个NFT集合的地板价变化率:
	// 1. 遍历collectionPrices数组,每个元素包含集合地址和对应时间点的地板价
	// 2. 对于每个集合:
	//    - 如果当前元素和下一个元素是同一个集合的记录(CollectionAddress相同)
	//    - 且下一个元素的价格大于0
	//    则:
	//    - 计算价格变化率 = (当前价格 - 历史价格) / 历史价格
	//    - 使用Price.Sub()计算价格差
	//    - 使用Div()计算变化率
	//    - 使用InexactFloat64()转换为float64类型
	//    - i++跳过下一个元素(因为已经使用过了)
	// 3. 如果不满足条件,则将该集合的变化率设为0
	// 4. 最终得到一个从集合地址到其地板价变化率的映射
	for i := 0; i < len(collectionPrices); i++ {
		if i < len(collectionPrices)-1 &&
			collectionPrices[i].CollectionAddress == collectionPrices[i+1].CollectionAddress &&
			collectionPrices[i+1].Price.GreaterThan(decimal.Zero) {
			collectionFloorChange[collectionPrices[i].CollectionAddress] = collectionPrices[i].Price.
				Sub(collectionPrices[i+1].Price).Div(collectionPrices[i+1].Price).InexactFloat64()
			i++
		} else {
			collectionFloorChange[collectionPrices[i].CollectionAddress] = 0.0
		}
	}

	return collectionFloorChange, nil
}

// QueryCollectionsSellPrice 查询所有集合的最高卖单价格
// @param ctx context.Context 上下文
// @param chain string 链名称
// @return []multi.Collection 返回集合列表,每个集合包含地址和最高卖单价格
// @return error 错误信息
func (d *Dao) QueryCollectionsSellPrice(ctx context.Context, chain string) ([]multi.Collection, error) {
	var collections []multi.Collection
	// 这条SQL语句用于查询每个NFT集合的最高卖单价格:
	// 1. 从订单表中选择数据
	// 2. 选择字段:
	//    - collection_address 作为 address - NFT集合地址
	//    - max(co.price) 作为 sale_price - 该集合最高的卖单价格
	// 3. 查询条件:
	//    - order_status = ? - 订单状态(传入参数,筛选：有效订单)
	//    - order_type = ? - 订单类型(传入参数,筛选：卖订单)
	//    - expire_time > ? - 过期时间大于当前时间(筛选：未过期订单)
	// 4. group by collection_address - 按集合地址分组,获取每个集合的最高价
	sql := fmt.Sprintf(`SELECT collection_address as address, max(co.price) as sale_price
FROM %s as co where order_status = ? and order_type = ? and expire_time > ? group by collection_address`, multi.OrderTableName(chain))
	if err := d.DB.WithContext(ctx).Raw(
		sql,
		multi.OrderStatusActive,
		multi.CollectionBidOrder,
		time.Now().Unix()).Scan(&collections).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get collection sell price")
	}

	return collections, nil
}

// QueryCollectionSellPrice 查询指定NFT集合的最高卖单价格
func (d *Dao) QueryCollectionSellPrice(ctx context.Context, chain, collectionAddr string) (*multi.Collection, error) {
	var collection multi.Collection
	sql := fmt.Sprintf(`SELECT collection_address as address, co.price as sale_price
FROM %s as co where collection_address = ? and order_status = ? and order_type = ? and quantity_remaining > 0 and expire_time > ? order by price desc limit 1`, multi.OrderTableName(chain))
	if err := d.DB.WithContext(ctx).Raw(
		sql,
		collectionAddr,
		multi.OrderStatusActive,
		multi.CollectionBidOrder,
		time.Now().Unix()).Scan(&collection).Error; err != nil {
		return nil, errors.Wrap(err, "failed on get collection sell price")
	}

	return &collection, nil
}
