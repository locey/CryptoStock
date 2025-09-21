package service

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"
	"github.com/shopspring/decimal"

	"github.com/locey/CryptoStock/StockCoinEnd/dao"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

const BidTypeOffset = 3

func getBidType(origin int64) int64 {
	if origin >= BidTypeOffset {
		return origin - BidTypeOffset
	} else {
		return origin
	}
}

// GetMultiChainUserCollections 获取用户拥有Collection信息： 拥有item数量、上架数量、floor price
func GetMultiChainUserCollections(ctx context.Context, svcCtx *svc.ServerCtx, chainIDs []int, chainNames []string, userAddrs []string) (*types.UserCollectionsResp, error) {
	// 1. 查询用户在多条链上的Collection基本信息
	collections, err := svcCtx.Dao.QueryMultiChainUserCollectionInfos(ctx, chainIDs, chainNames, userAddrs)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get collection info")
	}

	// 2. 构建chainID到chainName的映射
	chainIDToChainName := make(map[int]string)
	for _, chain := range svcCtx.C.ChainSupported {
		chainIDToChainName[chain.ChainID] = chain.Name
	}

	// 3. 构建chainID到Collection地址列表的映射
	chainIDToCollectionAddrs := make(map[int][]string)
	for _, collection := range collections {
		if _, ok := chainIDToCollectionAddrs[collection.ChainID]; !ok {
			chainIDToCollectionAddrs[collection.ChainID] = []string{collection.Address}
		} else {
			chainIDToCollectionAddrs[collection.ChainID] = append(chainIDToCollectionAddrs[collection.ChainID], collection.Address)
		}
	}

	// 4. 并发查询每个Collectionlection的挂单数量
	var listed []types.CollectionInfo
	var wg sync.WaitGroup
	var mu sync.Mutex
	for chainID, collectionAddrs := range chainIDToCollectionAddrs {
		chainName := chainIDToChainName[chainID]
		wg.Add(1)
		go func(chainName string, collectionAddrs []string) {
			defer wg.Done()

			list, err := svcCtx.Dao.QueryListedAmountEachCollection(ctx, chainName, collectionAddrs, userAddrs)
			if err != nil {
				return
			}
			mu.Lock()
			listed = append(listed, list...)
			mu.Unlock()
		}(chainName, collectionAddrs)
	}
	wg.Wait()

	// 5. 构建Collection地址到挂单数量的映射
	collectionsListed := make(map[string]int)
	for _, l := range listed {
		collectionsListed[strings.ToLower(l.Address)] = l.ListAmount
	}

	// 6. 组装最终结果
	var results types.UserCollectionsData
	chainInfos := make(map[int]types.ChainInfo)
	for _, collection := range collections {
		// 6.1 添加Collection信息
		listCount := collectionsListed[strings.ToLower(collection.Address)]
		results.CollectionInfos = append(results.CollectionInfos, types.CollectionInfo{
			ChainID:    collection.ChainID,
			Name:       collection.Name,
			Address:    collection.Address,
			Symbol:     collection.Symbol,
			ImageURI:   collection.ImageURI,
			ListAmount: listCount,
			ItemAmount: collection.ItemCount,
			FloorPrice: collection.FloorPrice,
		})

		// 6.2 计算每条链的统计信息
		chainInfo, ok := chainInfos[collection.ChainID]
		if ok {
			chainInfo.ItemOwned += collection.ItemCount
			chainInfo.ItemValue = chainInfo.ItemValue.Add(decimal.New(collection.ItemCount, 0).Mul(collection.FloorPrice))
			chainInfos[collection.ChainID] = chainInfo
		} else {
			chainInfos[collection.ChainID] = types.ChainInfo{
				ChainID:   collection.ChainID,
				ItemOwned: collection.ItemCount,
				ItemValue: decimal.New(collection.ItemCount, 0).Mul(collection.FloorPrice),
			}
		}
	}

	// 6.3 添加链信息到结果中
	for _, chainInfo := range chainInfos {
		results.ChainInfos = append(results.ChainInfos, chainInfo)
	}

	return &types.UserCollectionsResp{
		Result: results,
	}, nil
}

// GetMultiChainUserItems 查询用户拥有nft的Item基本信息，list信息和bid信息，从Item表和Activity表中查询
func GetMultiChainUserItems(ctx context.Context, svcCtx *svc.ServerCtx, chainID []int, chain []string, userAddrs []string, contractAddrs []string, page, pageSize int) (*types.UserItemsResp, error) {
	// 1.
	items, count, err := svcCtx.Dao.QueryMultiChainUserItemInfos(ctx, chain, userAddrs, contractAddrs, page, pageSize)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get user items info")
	}

	// 如果没有Item,直接返回空结果
	if count == 0 {
		return &types.UserItemsResp{
			Result: items,
			Count:  count,
		}, nil
	}

	// 2. 构建chainID到chain name的映射
	chainIDToChainName := make(map[int]string)
	for i, _ := range chainID {
		chainIDToChainName[chainID[i]] = chain[i]
	}

	// 3. 准备查询参数
	var collectionAddrs [][]string                          // Collection地址和链名称对
	var itemInfos []dao.MultiChainItemInfo                  // Item信息
	var chainCollections = make(map[string][]string)        // 按链分组的Collection地址
	var multichainItems = make(map[string][]types.ItemInfo) // 按链分组的Item信息

	// 遍历Item,构建查询参数
	for _, item := range items {
		collectionAddrs = append(collectionAddrs, []string{strings.ToLower(item.CollectionAddress), chainIDToChainName[item.ChainID]})
		itemInfos = append(itemInfos, dao.MultiChainItemInfo{
			ItemInfo: types.ItemInfo{
				CollectionAddress: item.CollectionAddress,
				TokenID:           item.TokenID,
			},
			ChainName: chainIDToChainName[item.ChainID],
		})
		chainCollections[strings.ToLower(chainIDToChainName[item.ChainID])] = append(chainCollections[strings.ToLower(chainIDToChainName[item.ChainID])], item.CollectionAddress)
		multichainItems[chainIDToChainName[item.ChainID]] = append(multichainItems[chainIDToChainName[item.ChainID]], types.ItemInfo{
			CollectionAddress: item.CollectionAddress,
			TokenID:           item.TokenID,
		})
	}

	// 4. 获取用户地址
	var userAddr string
	if len(userAddrs) == 0 {
		userAddr = ""
	} else {
		userAddr = userAddrs[0]
	}

	// 5. 并发查询Collection最高出价信息
	collectionBestBids := make(map[types.MultichainCollection]multi.Order)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var queryErr error
	for chain, collections := range chainCollections {
		wg.Add(1)
		go func(chainName string, collectionArray []string) {
			defer wg.Done()
			bestBids, err := svcCtx.Dao.QueryCollectionsBestBid(ctx, chainName, userAddr, collectionArray)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on query collections best bids")
				return
			}
			mu.Lock()
			defer mu.Unlock()
			for _, bestBid := range bestBids {
				collectionBestBids[types.MultichainCollection{
					CollectionAddress: strings.ToLower(bestBid.CollectionAddress),
					Chain:             chainName,
				}] = *bestBid
			}
		}(chain, collections)
	}
	wg.Wait()
	if queryErr != nil {
		return nil, errors.Wrap(err, "failed on query collection bids")
	}

	// 6. 并发查询Item最高出价信息
	itemsBestBids := make(map[dao.MultiChainItemInfo]multi.Order)
	for chain, items := range multichainItems {
		wg.Add(1)
		go func(chainName string, itemInfos []types.ItemInfo) {
			defer wg.Done()
			bids, err := svcCtx.Dao.QueryItemsBestBids(ctx, chainName, userAddr, itemInfos)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on query items best bids")
				return
			}

			mu.Lock()
			defer mu.Unlock()
			for _, bid := range bids {
				order, ok := itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(bid.CollectionAddress), TokenID: bid.TokenId}, ChainName: chainName}]
				if !ok {
					itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(bid.CollectionAddress), TokenID: bid.TokenId}, ChainName: chainName}] = bid
					continue
				}
				if bid.Price.GreaterThan(order.Price) {
					itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(bid.CollectionAddress), TokenID: bid.TokenId}, ChainName: chainName}] = bid
				}
			}
		}(chain, items)
	}
	wg.Wait()
	if queryErr != nil {
		return nil, errors.Wrap(err, "failed on query items best bids")
	}

	// 7. 查询Collection信息
	collections, err := svcCtx.Dao.QueryMultiChainCollectionsInfo(ctx, collectionAddrs)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query collections info")
	}

	collectionInfos := make(map[string]multi.Collection)
	for _, collection := range collections {
		collectionInfos[strings.ToLower(collection.Address)] = collection
	}

	// 8. 查询Item挂单信息
	listings, err := svcCtx.Dao.QueryMultiChainUserItemsListInfo(ctx, userAddrs, itemInfos)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query item list info")
	}

	listingInfos := make(map[string]*dao.CollectionItem)
	for _, listing := range listings {
		listingInfos[strings.ToLower(listing.CollectionAddress+listing.TokenId)] = listing
	}

	// 9. 获取挂单价格信息
	var itemPrice []dao.MultiChainItemPriceInfo
	for _, item := range listingInfos {
		if item.Listing {
			itemPrice = append(itemPrice, dao.MultiChainItemPriceInfo{
				ItemPriceInfo: types.ItemPriceInfo{
					CollectionAddress: item.CollectionAddress,
					TokenID:           item.TokenId,
					Maker:             item.Owner,
					Price:             item.ListPrice,
					OrderStatus:       multi.OrderStatusActive,
				},
				ChainName: chainIDToChainName[item.ChainId],
			})
		}
	}

	// 10. 查询挂单订单信息
	orderIds := make(map[string]multi.Order)
	if len(itemPrice) > 0 {
		orders, err := svcCtx.Dao.QueryMultiChainListingInfo(ctx, itemPrice)
		if err != nil {
			return nil, errors.Wrap(err, "failed on query item order id")
		}

		for _, order := range orders {
			orderIds[strings.ToLower(order.CollectionAddress+order.TokenId)] = order
		}
	}

	// 11. 查询Item图片信息
	itemImages, err := svcCtx.Dao.QueryMultiChainCollectionsItemsImage(ctx, itemInfos)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query item image info")
	}

	itemExternals := make(map[string]multi.ItemExternal)
	for _, item := range itemImages {
		itemExternals[strings.ToLower(item.CollectionAddress+item.TokenId)] = item
	}

	// 12. 组装最终结果
	for i := 0; i < len(items); i++ {
		// 设置出价信息
		bidOrder, ok := itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(items[i].CollectionAddress), TokenID: items[i].TokenID}, ChainName: chainIDToChainName[items[i].ChainID]}]
		if ok {
			if bidOrder.Price.GreaterThan(collectionBestBids[types.MultichainCollection{
				CollectionAddress: strings.ToLower(items[i].CollectionAddress),
				Chain:             chainIDToChainName[items[i].ChainID],
			}].Price) {
				items[i].BidOrderID = bidOrder.OrderID
				items[i].BidExpireTime = bidOrder.ExpireTime
				items[i].BidPrice = bidOrder.Price
				items[i].BidTime = bidOrder.EventTime
				items[i].BidSalt = bidOrder.Salt
				items[i].BidMaker = bidOrder.Maker
				items[i].BidType = getBidType(bidOrder.OrderType)
				items[i].BidSize = bidOrder.Size
				items[i].BidUnfilled = bidOrder.QuantityRemaining
			}
		} else {
			if cBid, ok := collectionBestBids[types.MultichainCollection{
				CollectionAddress: strings.ToLower(items[i].CollectionAddress),
				Chain:             chainIDToChainName[items[i].ChainID],
			}]; ok {
				items[i].BidOrderID = cBid.OrderID
				items[i].BidExpireTime = cBid.ExpireTime
				items[i].BidPrice = cBid.Price
				items[i].BidTime = cBid.EventTime
				items[i].BidSalt = cBid.Salt
				items[i].BidMaker = cBid.Maker
				items[i].BidType = getBidType(cBid.OrderType)
				items[i].BidSize = cBid.Size
				items[i].BidUnfilled = cBid.QuantityRemaining
			}
		}

		// 设置Collection信息
		collection, ok := collectionInfos[strings.ToLower(items[i].CollectionAddress)]
		if ok {
			items[i].CollectionName = collection.Name
			items[i].FloorPrice = collection.FloorPrice
			items[i].CollectionImageURI = collection.ImageUri
			if items[i].Name == "" {
				items[i].Name = fmt.Sprintf("%s #%s", collection.Name, items[i].TokenID)
			}
		}

		// 设置挂单信息
		listing, ok := listingInfos[strings.ToLower(items[i].CollectionAddress+items[i].TokenID)]
		if ok {
			items[i].ListPrice = listing.ListPrice
			items[i].Listing = listing.Listing
			items[i].MarketplaceID = listing.MarketID
		}

		// 设置订单信息
		order, ok := orderIds[strings.ToLower(items[i].CollectionAddress+items[i].TokenID)]
		if ok {
			items[i].ListOrderID = order.OrderID
			items[i].ListTime = order.EventTime
			items[i].ListExpireTime = order.ExpireTime
			items[i].ListSalt = order.Salt
			items[i].ListMaker = order.Maker
		}

		// 设置图片信息
		image, ok := itemExternals[strings.ToLower(items[i].CollectionAddress+items[i].TokenID)]
		if ok {
			if image.IsUploadedOss {
				items[i].ImageURI = image.OssUri
			} else {
				items[i].ImageURI = image.ImageUri
			}
		}
	}

	return &types.UserItemsResp{
		Result: items,
		Count:  count,
	}, nil
}

// GetMultiChainUserListings 获取用户在多条链上的挂单信息
func GetMultiChainUserListings(ctx context.Context, svcCtx *svc.ServerCtx, chainID []int, chain []string, userAddrs []string, contractAddrs []string, page, pageSize int) (*types.UserListingsResp, error) {
	var result []types.Listing
	// 1. 查询用户挂单Item基本信息
	items, count, err := svcCtx.Dao.QueryMultiChainUserListingItemInfos(ctx, chain, userAddrs, contractAddrs, page, pageSize)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get user items info")
	}

	// 如果没有挂单,直接返回空结果
	if count == 0 {
		return &types.UserListingsResp{
			Count: count,
		}, nil
	}

	// 2. 构建chainID到chain name的映射
	chainIDToChainName := make(map[int]string)
	for i, _ := range chainID {
		chainIDToChainName[chainID[i]] = chain[i]
	}

	// 3. 获取用户地址
	var userAddr string
	if len(userAddrs) == 0 {
		userAddr = ""
	} else {
		userAddr = userAddrs[0]
	}

	// 4. 准备查询参数
	var collectionAddrs [][]string                          // Collection地址和链名称对
	var itemInfos []dao.MultiChainItemInfo                  // Item信息
	var chainCollections = make(map[string][]string)        // 按链分组的Collection地址
	var multichainItems = make(map[string][]types.ItemInfo) // 按链分组的Item信息

	// 遍历Item,构建查询参数
	for _, item := range items {
		collectionAddrs = append(collectionAddrs, []string{strings.ToLower(item.CollectionAddress), chainIDToChainName[item.ChainID]})
		itemInfos = append(itemInfos, dao.MultiChainItemInfo{
			ItemInfo: types.ItemInfo{
				CollectionAddress: item.CollectionAddress,
				TokenID:           item.TokenID,
			},
			ChainName: chainIDToChainName[item.ChainID],
		})

		chainCollections[strings.ToLower(chainIDToChainName[item.ChainID])] = append(chainCollections[strings.ToLower(chainIDToChainName[item.ChainID])], item.CollectionAddress)
		multichainItems[chainIDToChainName[item.ChainID]] = append(multichainItems[chainIDToChainName[item.ChainID]], types.ItemInfo{
			CollectionAddress: item.CollectionAddress,
			TokenID:           item.TokenID,
		})
	}

	// 5. 记录Item最近成本
	itemLastCost := make(map[dao.MultiChainItemInfo]decimal.Decimal)

	// 6. 并发查询Collection最高出价信息
	collectionBestBids := make(map[types.MultichainCollection]multi.Order)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var queryErr error
	for chain, collections := range chainCollections {
		wg.Add(1)
		go func(chainName string, collectionArray []string) {
			defer wg.Done()
			bestBids, err := svcCtx.Dao.QueryCollectionsBestBid(ctx, chainName, userAddr, collectionArray)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on query collections best bids")
				return
			}
			mu.Lock()
			defer mu.Unlock()
			for _, bestBid := range bestBids {
				collectionBestBids[types.MultichainCollection{
					CollectionAddress: strings.ToLower(bestBid.CollectionAddress),
					Chain:             chainName,
				}] = *bestBid
			}
		}(chain, collections)
	}
	wg.Wait()
	if queryErr != nil {
		return nil, errors.Wrap(err, "failed on query collection bids")
	}

	// 7. 并发查询Item最高出价信息
	itemsBestBids := make(map[dao.MultiChainItemInfo]multi.Order)
	for chain, items := range multichainItems {
		wg.Add(1)
		go func(chainName string, itemInfos []types.ItemInfo) {
			defer wg.Done()
			bids, err := svcCtx.Dao.QueryItemsBestBids(ctx, chainName, userAddr, itemInfos)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on query items best bids")
				return
			}

			mu.Lock()
			defer mu.Unlock()
			for _, bid := range bids {
				order, ok := itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(bid.CollectionAddress), TokenID: bid.TokenId}, ChainName: chainName}]
				if !ok {
					itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(bid.CollectionAddress), TokenID: bid.TokenId}, ChainName: chainName}] = bid
					continue
				}
				if bid.Price.GreaterThan(order.Price) {
					itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(bid.CollectionAddress), TokenID: bid.TokenId}, ChainName: chainName}] = bid
				}
			}
		}(chain, items)
	}
	wg.Wait()
	if queryErr != nil {
		return nil, errors.Wrap(err, "failed on query items best bids")
	}

	// 8. 查询Collection基本信息
	collections, err := svcCtx.Dao.QueryMultiChainCollectionsInfo(ctx, collectionAddrs)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query collections info")
	}

	collectionInfos := make(map[string]multi.Collection)
	for _, collection := range collections {
		collectionInfos[strings.ToLower(collection.Address)] = collection
	}

	// 9. 查询用户Item挂单信息
	listings, err := svcCtx.Dao.QueryMultiChainUserItemsExpireListInfo(ctx, userAddrs, itemInfos)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query item list info")
	}

	listingInfos := make(map[string]*dao.CollectionItem)
	for _, listing := range listings {
		listingInfos[strings.ToLower(listing.CollectionAddress+listing.TokenId)] = listing
	}

	// 10. 查询挂单订单信息
	var itemPrice []dao.MultiChainItemPriceInfo
	for _, item := range listingInfos {
		if item.Listing {
			itemPrice = append(itemPrice, dao.MultiChainItemPriceInfo{
				ItemPriceInfo: types.ItemPriceInfo{
					CollectionAddress: item.CollectionAddress,
					TokenID:           item.TokenId,
					Maker:             item.Owner,
					Price:             item.ListPrice,
					OrderStatus:       item.OrderStatus,
				},
				ChainName: chainIDToChainName[item.ChainId],
			})
		}
	}

	orderIds := make(map[string]multi.Order)
	if len(itemPrice) > 0 {
		orders, err := svcCtx.Dao.QueryMultiChainListingInfo(ctx, itemPrice)
		if err != nil {
			return nil, errors.Wrap(err, "failed on query item order id")
		}

		for _, order := range orders {
			orderIds[strings.ToLower(order.CollectionAddress+order.TokenId)] = order
		}
	}

	// 11. 查询Item图片信息
	itemImages, err := svcCtx.Dao.QueryMultiChainCollectionsItemsImage(ctx, itemInfos)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query item image info")
	}

	itemExternals := make(map[string]multi.ItemExternal)
	for _, item := range itemImages {
		itemExternals[strings.ToLower(item.CollectionAddress+item.TokenId)] = item
	}

	// 12. 组装最终结果
	for i := 0; i < len(items); i++ {
		var resultlisting types.Listing
		listing, ok := listingInfos[strings.ToLower(items[i].CollectionAddress+items[i].TokenID)]
		if ok {
			resultlisting.ListPrice = listing.ListPrice
			resultlisting.MarketplaceID = listing.MarketID
		} else {
			count--
			continue
		}

		resultlisting.ChainID = items[i].ChainID
		resultlisting.CollectionAddress = items[i].CollectionAddress
		resultlisting.TokenID = items[i].TokenID
		resultlisting.LastCostPrice = itemLastCost[dao.MultiChainItemInfo{
			ItemInfo: types.ItemInfo{
				CollectionAddress: items[i].CollectionAddress,
				TokenID:           items[i].TokenID,
			},
			ChainName: chainIDToChainName[items[i].ChainID],
		}]

		// 设置出价信息 - 优先使用Item出价,如果没有则使用Collection出价
		bidOrder, ok := itemsBestBids[dao.MultiChainItemInfo{ItemInfo: types.ItemInfo{CollectionAddress: strings.ToLower(items[i].CollectionAddress), TokenID: items[i].TokenID}, ChainName: chainIDToChainName[items[i].ChainID]}]
		if ok {
			if bidOrder.Price.GreaterThan(collectionBestBids[types.MultichainCollection{
				CollectionAddress: strings.ToLower(items[i].CollectionAddress),
				Chain:             chainIDToChainName[items[i].ChainID],
			}].Price) {
				resultlisting.BidOrderID = bidOrder.OrderID
				resultlisting.BidExpireTime = bidOrder.ExpireTime
				resultlisting.BidPrice = bidOrder.Price
				resultlisting.BidTime = bidOrder.EventTime
				resultlisting.BidSalt = bidOrder.Salt
				resultlisting.BidMaker = bidOrder.Maker
				resultlisting.BidType = getBidType(bidOrder.OrderType)
				resultlisting.BidSize = bidOrder.Size
				resultlisting.BidUnfilled = bidOrder.QuantityRemaining
			}
		} else {
			bidOrder, ok := collectionBestBids[types.MultichainCollection{
				CollectionAddress: strings.ToLower(items[i].CollectionAddress),
				Chain:             chainIDToChainName[items[i].ChainID],
			}]

			if ok {
				resultlisting.BidOrderID = bidOrder.OrderID
				resultlisting.BidExpireTime = bidOrder.ExpireTime
				resultlisting.BidPrice = bidOrder.Price
				resultlisting.BidTime = bidOrder.EventTime
				resultlisting.BidSalt = bidOrder.Salt
				resultlisting.BidMaker = bidOrder.Maker
				resultlisting.BidType = getBidType(bidOrder.OrderType)
				resultlisting.BidSize = bidOrder.Size
				resultlisting.BidUnfilled = bidOrder.QuantityRemaining
			}
		}

		// 设置Collection信息
		collection, ok := collectionInfos[strings.ToLower(items[i].CollectionAddress)]
		if ok {
			resultlisting.CollectionName = collection.Name
			if resultlisting.Name == "" {
				resultlisting.Name = fmt.Sprintf("%s #%s", collection.Name, items[i].TokenID)
			}
			resultlisting.FloorPrice = collection.FloorPrice
		}

		// 设置订单信息
		order, ok := orderIds[strings.ToLower(items[i].CollectionAddress+items[i].TokenID)]
		if ok {
			resultlisting.ListOrderID = order.OrderID
			resultlisting.ListExpireTime = order.ExpireTime
			resultlisting.ListMaker = order.Maker
			resultlisting.ListSalt = order.Salt
		}

		// 设置图片信息
		image, ok := itemExternals[strings.ToLower(items[i].CollectionAddress+items[i].TokenID)]
		if ok {
			if image.IsUploadedOss {
				resultlisting.ImageURI = image.OssUri
			} else {
				resultlisting.ImageURI = image.ImageUri
			}
		}
		result = append(result, resultlisting)
	}

	return &types.UserListingsResp{
		Count:  count,
		Result: result,
	}, nil
}

type multiOrder struct {
	multi.Order
	chainID   int
	chainName string
}

// GetMultiChainUserBids 获取用户在多条链上的出价信息
// 参数:
// - ctx: 上下文
// - svcCtx: 服务上下文
// - chainID: 链ID列表
// - chainNames: 链名称列表
// - userAddrs: 用户地址列表
// - contractAddrs: 合约地址列表
// - page: 页码
// - pageSize: 每页大小
// 返回:
// - *types.UserBidsResp: 用户出价信息响应
// - error: 错误信息
func GetMultiChainUserBids(ctx context.Context, svcCtx *svc.ServerCtx, chainID []int, chainNames []string, userAddrs []string, contractAddrs []string, page, pageSize int) (*types.UserBidsResp, error) {
	// 1. 遍历每条链,查询用户出价信息
	var totalBids []multiOrder
	for i, chain := range chainNames {
		orders, err := svcCtx.Dao.QueryUserBids(ctx, chain, userAddrs, contractAddrs)
		if err != nil {
			return nil, errors.Wrap(err, "failed on get user bids info")
		}

		// 将每条链的出价信息添加到总出价列表中
		var tmpBids []multiOrder
		for j := 0; j < len(orders); j++ {
			tmpBids = append(tmpBids, multiOrder{
				Order:     orders[j],
				chainID:   chainID[i],
				chainName: chain,
			})
		}
		totalBids = append(totalBids, tmpBids...)
	}

	// 2. 构建出价信息映射和Collection地址映射
	bidsMap := make(map[string]types.UserBid)
	bidCollections := make(map[string][]string)
	for _, bid := range totalBids {
		// 按链名称分组Collection地址
		if collections, ok := bidCollections[bid.chainName]; ok {
			bidCollections[bid.chainName] = append(collections, strings.ToLower(bid.CollectionAddress))
		} else {
			bidCollections[bid.chainName] = []string{strings.ToLower(bid.CollectionAddress)}
		}

		// 构建唯一key,用于合并相同Collection的出价信息
		key := strings.ToLower(bid.CollectionAddress) + bid.TokenId + bid.Price.String() + fmt.Sprintf("%d", bid.MarketplaceId) + fmt.Sprintf("%d", bid.ExpireTime) + fmt.Sprintf("%d", bid.OrderType)
		userBid, ok := bidsMap[key]
		if !ok {
			// 如果key不存在,创建新的出价信息
			bidsMap[key] = types.UserBid{
				ChainID:           bid.chainID,
				CollectionAddress: strings.ToLower(bid.CollectionAddress),
				TokenID:           bid.TokenId,
				BidPrice:          bid.Price,
				MarketplaceID:     bid.MarketplaceId,
				ExpireTime:        bid.ExpireTime,
				BidType:           getBidType(bid.OrderType),
				OrderSize:         bid.QuantityRemaining,
				BidInfos: []types.BidInfo{
					{
						BidOrderID:    bid.OrderID,
						BidTime:       bid.EventTime,
						BidExpireTime: bid.ExpireTime,
						BidPrice:      bid.Price,
						BidSalt:       bid.Salt,
						BidSize:       bid.Size,
						BidUnfilled:   bid.QuantityRemaining,
					},
				},
			}
			continue
		}

		// 如果key存在,更新出价信息
		userBid.OrderSize += bid.QuantityRemaining
		userBid.BidInfos = append(userBid.BidInfos, types.BidInfo{
			BidOrderID:    bid.OrderID,
			BidTime:       bid.EventTime,
			BidExpireTime: bid.ExpireTime,
			BidPrice:      bid.Price,
			BidSalt:       bid.Salt,
			BidSize:       bid.Size,
			BidUnfilled:   bid.QuantityRemaining,
		})
		bidsMap[key] = userBid
	}

	// 3. 查询Collection基本信息
	collectionInfos := make(map[string]multi.Collection)
	for chain, collections := range bidCollections {
		cs, err := svcCtx.Dao.QueryCollectionsInfo(ctx, chain, removeRepeatedElement(collections))
		if err != nil {
			return nil, errors.Wrap(err, "failed on get collections info")
		}

		for _, c := range cs {
			collectionInfos[fmt.Sprintf("%d:%s", c.ChainId, strings.ToLower(c.Address))] = c
		}
	}

	// 4. 组装最终结果
	var results []types.UserBid
	for _, userBid := range bidsMap {
		// 设置Collection名称和图片信息
		if c, ok := collectionInfos[fmt.Sprintf("%d:%s", userBid.ChainID, strings.ToLower(userBid.CollectionAddress))]; ok {
			userBid.CollectionName = c.Name
			userBid.ImageURI = c.ImageUri
		}

		results = append(results, userBid)
	}

	// 5. 按过期时间降序排序
	sort.SliceStable(results, func(i, j int) bool {
		return results[i].ExpireTime > (results[j].ExpireTime)
	})

	return &types.UserBidsResp{
		Count:  len(bidsMap),
		Result: results,
	}, nil
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
