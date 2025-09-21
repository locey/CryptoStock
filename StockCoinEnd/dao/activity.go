package dao

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

const CacheActivityNumPrefix = "cache:es:activity:count:"

var eventTypesToID = map[string]int{
	"sale":                  multi.Sale,
	"transfer":              multi.Transfer,
	"offer":                 multi.MakeOffer,
	"cancel_offer":          multi.CancelOffer,
	"cancel_list":           multi.CancelListing,
	"list":                  multi.Listing,
	"mint":                  multi.Mint,
	"buy":                   multi.Buy,
	"collection_bid":        multi.CollectionBid,
	"item_bid":              multi.ItemBid,
	"cancel_collection_bid": multi.CancelCollectionBid,
	"cancel_item_bid":       multi.CancelItemBid,
}

var idToEventTypes = map[int]string{
	multi.Sale:                "sale",
	multi.Transfer:            "transfer",
	multi.MakeOffer:           "offer",
	multi.CancelOffer:         "cancel_offer",
	multi.CancelListing:       "cancel_list",
	multi.Listing:             "list",
	multi.Mint:                "mint",
	multi.Buy:                 "buy",
	multi.CollectionBid:       "collection_bid",
	multi.ItemBid:             "item_bid",
	multi.CancelCollectionBid: "cancel_collection_bid",
	multi.CancelItemBid:       "cancel_item_bid",
}

type ActivityCountCache struct {
	Chain             string   `json:"chain"`
	ContractAddresses []string `json:"contract_addresses"`
	TokenId           string   `json:"token_id"`
	UserAddress       string   `json:"user_address"`
	EventTypes        []string `json:"event_types"`
}

type ActivityMultiChainInfo struct {
	multi.Activity
	ChainName string `gorm:"column:chain_name"`
}

func getActivityCountCacheKey(activity *ActivityCountCache) (string, error) {
	uid, err := json.Marshal(activity)
	if err != nil {
		return "", errors.Wrap(err, "failed on marshal activity struct")
	}
	return CacheActivityNumPrefix + string(uid), nil
}

// QueryMultiChainActivities 查询多链上的活动信息
// 参数:
// - ctx: 上下文
// - chainName: 链名称列表
// - collectionAddrs: NFT合约地址列表
// - tokenID: NFT的tokenID
// - userAddrs: 用户地址列表
// - eventTypes: 事件类型列表
// - page: 页码
// - pageSize: 每页大小
// 返回:
// - []ActivityMultiChainInfo: 活动信息列表
// - int64: 总记录数
// - error: 错误信息
func (d *Dao) QueryMultiChainActivities(ctx context.Context, chainName []string, collectionAddrs []string, tokenID string, userAddrs []string, eventTypes []string, page, pageSize int) ([]ActivityMultiChainInfo, int64, error) {
	//查询缓存中的总数
	var strNums []string

	var total int64
	var activities []ActivityMultiChainInfo

	//将事件类型转换为对应的ID
	var events []int
	for _, v := range eventTypes {
		id, ok := eventTypesToID[v]
		if !ok {
			continue
		}
		events = append(events, id)
	}

	//构建SQL查询
	//1. 构建SQL头部
	sqlHead := "SELECT * FROM ("

	//2. 构建SQL中间部分 - 使用UNION ALL合并多个链的查询
	sqlMid := ""
	for _, chain := range chainName {
		if sqlMid != "" {
			sqlMid += "UNION ALL "
		}
		//为每个链构建子查询
		sqlMid += fmt.Sprintf("(select '%s' as chain_name,id,collection_address,token_id,currency_address,activity_type,maker,taker,price,tx_hash,event_time,marketplace_id ", chain)
		sqlMid += fmt.Sprintf("from %s ", multi.ActivityTableName(chain))

		//添加用户地址过滤条件
		if len(userAddrs) == 1 {
			sqlMid += fmt.Sprintf("where maker = '%s' or taker = '%s'", strings.ToLower(userAddrs[0]), strings.ToLower(userAddrs[0]))
		} else if len(userAddrs) > 1 {
			var userAddrsParam string
			for i, addr := range userAddrs {
				userAddrsParam += fmt.Sprintf(`'%s'`, addr)
				if i < len(userAddrs)-1 {
					userAddrsParam += ","
				}
			}
			sqlMid += fmt.Sprintf("where maker in (%s) or taker in (%s)", userAddrsParam, userAddrsParam)
		}
		sqlMid += ") "
	}

	//3. 构建SQL尾部 - 添加过滤条件
	sqlTail := ") as combined "
	firstFlag := true

	//添加合约地址过滤
	if len(collectionAddrs) == 1 {
		sqlTail += fmt.Sprintf("WHERE collection_address = '%s' ", collectionAddrs[0])
		firstFlag = false
	} else if len(collectionAddrs) > 1 {
		sqlTail += fmt.Sprintf("WHERE collection_address in ('%s'", collectionAddrs[0])
		for i := 1; i < len(collectionAddrs); i++ {
			sqlTail += fmt.Sprintf(",'%s'", collectionAddrs[i])
		}
		sqlTail += ") "
		firstFlag = false
	}

	//添加tokenID过滤
	if tokenID != "" {
		if firstFlag {
			sqlTail += fmt.Sprintf("WHERE token_id = '%s' ", tokenID)
			firstFlag = false
		} else {
			sqlTail += fmt.Sprintf("and token_id = '%s' ", tokenID)
		}
	}

	//添加事件类型过滤
	if len(events) > 0 {
		if firstFlag {
			sqlTail += fmt.Sprintf("WHERE activity_type in (%d", events[0])
			for i := 1; i < len(events); i++ {
				sqlTail += fmt.Sprintf(",%d", events[i])
			}
			sqlTail += ") "
			firstFlag = false
		} else {
			sqlTail += fmt.Sprintf("and activity_type in (%d", events[0])
			for i := 1; i < len(events); i++ {
				sqlTail += fmt.Sprintf(",%d", events[i])
			}
			sqlTail += ") "
		}
	}

	//添加分页
	sqlTail += fmt.Sprintf("ORDER BY combined.event_time DESC, combined.id DESC limit %d offset %d", pageSize, pageSize*(page-1))

	//组合完整SQL
	sql := sqlHead + sqlMid + sqlTail

	//执行查询
	if err := d.DB.Raw(sql).Scan(&activities).Error; err != nil {
		return nil, 0, errors.Wrap(err, "failed on query activity")
	}

	//构建计数SQL
	sqlCnt := "SELECT COUNT(*) FROM (" + sqlMid + sqlTail

	//从Redis缓存获取总数
	cacheKey, err := getActivityCountCacheKey(&ActivityCountCache{
		Chain:             "MultiChain",
		ContractAddresses: collectionAddrs,
		TokenId:           tokenID,
		UserAddress:       strings.ToLower(strings.Join(userAddrs, ",")),
		EventTypes:        eventTypes,
	})
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed on get activity number cache key")
	}

	strNum, err := d.KvStore.Get(cacheKey)
	if err != nil {
		return nil, 0, errors.Wrap(err, "failed on get activity number from cache")
	}
	strNums = append(strNums, strNum)

	//获取总数
	if strNum != "" {
		//从缓存获取
		total, _ = strconv.ParseInt(strNum, 10, 64)
	} else {
		//从数据库查询
		if err := d.DB.Raw(sqlCnt).Scan(&total).Error; err != nil {
			return nil, 0, errors.Wrap(err, "failed on count activity")
		}

		//更新缓存
		if err := d.KvStore.Setex(cacheKey, strconv.FormatInt(total, 10), 30); err != nil {
			return nil, 0, errors.Wrap(err, "failed on cache activities number")
		}
	}

	return activities, total, nil
}

// QueryMultiChainActivityExternalInfo 查询多链活动的外部信息
// 包括: 用户地址、NFT信息、合约信息等
func (d *Dao) QueryMultiChainActivityExternalInfo(ctx context.Context, chainID []int, chainName []string, activities []ActivityMultiChainInfo) ([]types.ActivityInfo, error) {
	// 收集需要查询的地址和ID
	var userAddrs [][]string
	var items [][]string
	var collectionAddrs [][]string
	for _, activity := range activities {
		userAddrs = append(userAddrs,
			[]string{activity.Maker, activity.ChainName},
			[]string{activity.Taker, activity.ChainName})
		items = append(items,
			[]string{activity.CollectionAddress, activity.TokenId, activity.ChainName})
		collectionAddrs = append(collectionAddrs,
			[]string{activity.CollectionAddress, activity.ChainName})
	}

	// 去重
	userAddrs = removeRepeatedElementArr(userAddrs)
	collectionAddrs = removeRepeatedElementArr(collectionAddrs)
	items = removeRepeatedElementArr(items)

	// 构建item查询条件
	var itemQuery []clause.Expr
	for _, item := range items {
		itemQuery = append(itemQuery, gorm.Expr("(?, ?)", item[0], item[1]))
	}

	// 存储查询结果的map
	collections := make(map[string]multi.Collection)
	itemInfos := make(map[string]multi.Item)
	itemExternals := make(map[string]multi.ItemExternal)

	// 并发查询三类信息
	var wg sync.WaitGroup
	var queryErr error

	// 1. 查询items基本信息
	wg.Add(1)
	go func() {
		defer wg.Done()
		var newItems []multi.Item
		var newItem multi.Item

		for i := 0; i < len(itemQuery); i++ {
			// SQL: SELECT collection_address, token_id, name
			// FROM {chain}_items
			// WHERE (collection_address,token_id) = (?, ?)
			itemDb := d.DB.WithContext(ctx).
				Table(multi.ItemTableName(items[i][2])).
				Select("collection_address, token_id, name").
				Where("(collection_address,token_id) = ?", itemQuery[i])
			if err := itemDb.Scan(&newItem).Error; err != nil {
				queryErr = errors.Wrap(err, "failed on query items info")
				return
			}

			newItems = append(newItems, newItem)
		}

		for _, item := range newItems {
			itemInfos[strings.ToLower(item.CollectionAddress+item.TokenId)] = item
		}
	}()

	// 2. 查询items外部信息(图片等)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var newItems []multi.ItemExternal
		var newItem multi.ItemExternal

		for i := 0; i < len(itemQuery); i++ {
			// SQL: SELECT collection_address, token_id, is_uploaded_oss, image_uri, oss_uri
			// FROM {chain}_item_externals
			// WHERE (collection_address, token_id) = (?, ?)
			itemDb := d.DB.WithContext(ctx).
				Table(multi.ItemExternalTableName(items[i][2])).
				Select("collection_address, token_id, is_uploaded_oss, image_uri, oss_uri").
				Where("(collection_address, token_id) = ?", itemQuery[i])
			if err := itemDb.Scan(&newItem).Error; err != nil {
				queryErr = errors.Wrap(err, "failed on query items info")
				return
			}

			newItems = append(newItems, newItem)
		}

		for _, item := range newItems {
			itemExternals[strings.ToLower(item.CollectionAddress+item.TokenId)] = item
		}
	}()

	// 3. 查询collection信息
	wg.Add(1)
	go func() {
		defer wg.Done()
		var colls []multi.Collection
		var coll multi.Collection

		for i := 0; i < len(collectionAddrs); i++ {
			// SQL: SELECT id, name, address, image_uri
			// FROM {chain}_collections
			// WHERE address = ?
			if err := d.DB.WithContext(ctx).
				Table(multi.CollectionTableName(collectionAddrs[i][1])).
				Select("id, name, address, image_uri").
				Where("address = ?", collectionAddrs[i][0]).
				Scan(&coll).Error; err != nil {
				queryErr = errors.Wrap(err, "failed on query collections info")
				return
			}

			colls = append(colls, coll)
		}

		for _, c := range colls {
			collections[strings.ToLower(c.Address)] = c
		}
	}()
	wg.Wait()

	if queryErr != nil {
		return nil, errors.Wrap(queryErr, "failed on query activity external info")
	}

	// 构建chain name到chain id的映射
	chainnameTochainid := make(map[string]int)
	for i, name := range chainName {
		chainnameTochainid[name] = chainID[i]
	}

	// 组装最终结果
	var results []types.ActivityInfo
	for _, act := range activities {
		activity := types.ActivityInfo{
			EventType:         "unknown",
			EventTime:         act.EventTime,
			CollectionAddress: act.CollectionAddress,
			TokenID:           act.TokenId,
			Currency:          act.CurrencyAddress,
			Price:             act.Price,
			Maker:             act.Maker,
			Taker:             act.Taker,
			TxHash:            act.TxHash,
			MarketplaceID:     act.MarketplaceID,
			ChainID:           chainnameTochainid[act.ChainName],
		}

		// Listing类型活动不需要txHash
		if act.ActivityType == multi.Listing {
			activity.TxHash = ""
		}

		// 设置事件类型
		eventType, ok := idToEventTypes[act.ActivityType]
		if ok {
			activity.EventType = eventType
		}

		// 设置item名称
		item, ok := itemInfos[strings.ToLower(act.CollectionAddress+act.TokenId)]
		if ok {
			activity.ItemName = item.Name
		}
		if activity.ItemName == "" {
			activity.ItemName = fmt.Sprintf("#%s", act.TokenId)
		}

		// 设置item图片
		itemExternal, ok := itemExternals[strings.ToLower(act.CollectionAddress+act.TokenId)]
		if ok {
			imageUri := itemExternal.ImageUri
			if itemExternal.IsUploadedOss {
				imageUri = itemExternal.OssUri
			}
			activity.ImageURI = imageUri
		}

		// 设置collection信息
		collection, ok := collections[strings.ToLower(act.CollectionAddress)]
		if ok {
			activity.CollectionName = collection.Name
			activity.CollectionImageURI = collection.ImageUri
		}

		results = append(results, activity)
	}

	return results, nil
}

func removeRepeatedElement(arr []string) (newArr []string) {
	newArr = make([]string, 0)
	for i := 0; i < len(arr); i++ {
		repeat := false
		for j := i + 1; j < len(arr); j++ {
			if arr[i] == arr[j] {
				repeat = true
				break
			}
		}
		if !repeat && arr[i] != "" {
			newArr = append(newArr, arr[i])
		}
	}
	return
}

func removeRepeatedElementArr(arr [][]string) [][]string {
	filteredTokenIds := make([][]string, 0)
	seen := make(map[string]bool)

	for _, pair := range arr {
		if len(pair) == 2 {
			key := pair[0] + "," + pair[1]

			if _, exists := seen[key]; !exists {
				filteredTokenIds = append(filteredTokenIds, pair)
				seen[key] = true
			}
		} else if len(pair) == 3 {
			key := pair[0] + "," + pair[1] + "," + pair[2]

			if _, exists := seen[key]; !exists {
				filteredTokenIds = append(filteredTokenIds, pair)
				seen[key] = true
			}
		}
	}
	return filteredTokenIds
}
