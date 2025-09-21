package service

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/evm/eip"
	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"
	"github.com/locey/CryptoStock/StockCoinBase/ordermanager"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/locey/CryptoStock/StockCoinEnd/dao"
	"github.com/locey/CryptoStock/StockCoinEnd/service/mq"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

func GetBids(ctx context.Context, svcCtx *svc.ServerCtx, chain string, collectionAddr string, page, pageSize int) (*types.CollectionBidsResp, error) {
	bids, count, err := svcCtx.Dao.QueryCollectionBids(ctx, chain, collectionAddr, page, pageSize)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get item info")
	}

	return &types.CollectionBidsResp{
		Result: bids,
		Count:  count,
	}, nil
}

// GetItems 获取NFT Item列表信息：Item基本信息、订单信息、图片信息、用户持有数量、最近成交价格、最高出价信息
func GetItems(ctx context.Context, svcCtx *svc.ServerCtx, chain string, filter types.CollectionItemFilterParams, collectionAddr string) (*types.NFTListingInfoResp, error) {
	// 1. 查询基础Item信息和订单信息
	items, count, err := svcCtx.Dao.QueryCollectionItemOrder(ctx, chain, filter, collectionAddr)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get item info")
	}

	// 2. 提取需要查询的ItemID和所有者地址
	var ItemIds []string
	var ItemOwners []string
	var itemPrice []types.ItemPriceInfo
	for _, item := range items {
		if item.TokenId != "" {
			ItemIds = append(ItemIds, item.TokenId)
		}
		if item.Owner != "" {
			ItemOwners = append(ItemOwners, item.Owner)
		}
		// 记录已上架Item的价格信息
		if item.Listing {
			itemPrice = append(itemPrice, types.ItemPriceInfo{
				CollectionAddress: item.CollectionAddress,
				TokenID:           item.TokenId,
				Maker:             item.Owner,
				Price:             item.ListPrice,
				OrderStatus:       multi.OrderStatusActive,
			})
		}
	}

	// 3. 并发查询各类扩展信息
	var queryErr error
	var wg sync.WaitGroup

	// 3.1 查询订单详情
	ordersInfo := make(map[string]multi.Order)
	wg.Add(1)
	go func() {
		defer wg.Done()
		if len(itemPrice) > 0 {
			orders, err := svcCtx.Dao.QueryListingInfo(ctx, chain, itemPrice)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on get orders time info")
				return
			}
			for _, order := range orders {
				ordersInfo[strings.ToLower(order.CollectionAddress+order.TokenId)] = order
			}
		}
	}()

	// 3.2 查询Item图片信息
	ItemsExternal := make(map[string]multi.ItemExternal)
	wg.Add(1)
	go func() {
		defer wg.Done()
		if len(ItemIds) != 0 {
			items, err := svcCtx.Dao.QueryCollectionItemsImage(ctx, chain, collectionAddr, ItemIds)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on get items image info")
				return
			}
			for _, item := range items {
				ItemsExternal[strings.ToLower(item.TokenId)] = item
			}
		}
	}()

	// 3.3 查询用户持有数量
	userItemCount := make(map[string]int64)
	wg.Add(1)
	go func() {
		defer wg.Done()
		if len(ItemIds) != 0 {
			itemCount, err := svcCtx.Dao.QueryUsersItemCount(ctx, chain, collectionAddr, ItemOwners)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on get items image info")
				return
			}
			for _, v := range itemCount {
				userItemCount[strings.ToLower(v.Owner)] = v.Counts
			}
		}
	}()

	// 3.4 查询最近成交价格
	lastSales := make(map[string]decimal.Decimal)
	wg.Add(1)
	go func() {
		defer wg.Done()
		if len(ItemIds) != 0 {
			lastSale, err := svcCtx.Dao.QueryLastSalePrice(ctx, chain, collectionAddr, ItemIds)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on get items last sale info")
				return
			}
			for _, v := range lastSale {
				lastSales[strings.ToLower(v.TokenId)] = v.Price
			}
		}
	}()

	// 3.5 查询Item级别最高出价
	bestBids := make(map[string]multi.Order)
	wg.Add(1)
	go func() {
		defer wg.Done()
		if len(ItemIds) != 0 {
			bids, err := svcCtx.Dao.QueryBestBids(ctx, chain, filter.UserAddress, collectionAddr, ItemIds)
			if err != nil {
				queryErr = errors.Wrap(err, "failed on get items last sale info")
				return
			}
			for _, bid := range bids {
				order, ok := bestBids[strings.ToLower(bid.TokenId)]
				if !ok {
					bestBids[strings.ToLower(bid.TokenId)] = bid
					continue
				}
				if bid.Price.GreaterThan(order.Price) {
					bestBids[strings.ToLower(bid.TokenId)] = bid
				}
			}
		}
	}()

	// 3.6 查询集合级别最高出价
	var collectionBestBid multi.Order
	wg.Add(1)
	go func() {
		defer wg.Done()
		collectionBestBid, err = svcCtx.Dao.QueryCollectionBestBid(ctx, chain, filter.UserAddress, collectionAddr)
		if err != nil {
			queryErr = errors.Wrap(err, "failed on get items last sale info")
			return
		}
	}()

	// 4. 等待所有查询完成
	wg.Wait()
	if queryErr != nil {
		return nil, errors.Wrap(queryErr, "failed on get items info")
	}

	// 5. 整合所有信息
	var respItems []*types.NFTListingInfo
	for _, item := range items {
		// 设置Item名称
		nameStr := item.Name
		if nameStr == "" {
			nameStr = fmt.Sprintf("#%s", item.TokenId)
		}

		// 构建返回结构
		respItem := &types.NFTListingInfo{
			Name:              nameStr,
			CollectionAddress: item.CollectionAddress,
			TokenID:           item.TokenId,
			OwnerAddress:      item.Owner,
			ListPrice:         item.ListPrice,
			MarketID:          item.MarketID,
			BidOrderID:        collectionBestBid.OrderID,
			BidExpireTime:     collectionBestBid.ExpireTime,
			BidPrice:          collectionBestBid.Price,
			BidTime:           collectionBestBid.EventTime,
			BidSalt:           collectionBestBid.Salt,
			BidMaker:          collectionBestBid.Maker,
			BidType:           getBidType(collectionBestBid.OrderType),
			BidSize:           collectionBestBid.Size,
			BidUnfilled:       collectionBestBid.QuantityRemaining,
		}

		// 添加订单信息
		listOrder, ok := ordersInfo[strings.ToLower(item.CollectionAddress+item.TokenId)]
		if ok {
			respItem.ListTime = listOrder.EventTime
			respItem.ListOrderID = listOrder.OrderID
			respItem.ListExpireTime = listOrder.ExpireTime
			respItem.ListSalt = listOrder.Salt
		}

		// 添加最高出价信息
		bidOrder, ok := bestBids[strings.ToLower(item.TokenId)]
		if ok {
			if bidOrder.Price.GreaterThan(collectionBestBid.Price) {
				respItem.BidOrderID = bidOrder.OrderID
				respItem.BidExpireTime = bidOrder.ExpireTime
				respItem.BidPrice = bidOrder.Price
				respItem.BidTime = bidOrder.EventTime
				respItem.BidSalt = bidOrder.Salt
				respItem.BidMaker = bidOrder.Maker
				respItem.BidType = getBidType(bidOrder.OrderType)
				respItem.BidSize = bidOrder.Size
				respItem.BidUnfilled = bidOrder.QuantityRemaining
			}
		}

		// 添加图片和视频信息
		itemExternal, ok := ItemsExternal[strings.ToLower(item.TokenId)]
		if ok {
			if itemExternal.IsUploadedOss {
				respItem.ImageURI = itemExternal.OssUri
			} else {
				respItem.ImageURI = itemExternal.ImageUri
			}
			if len(itemExternal.VideoUri) > 0 {
				respItem.VideoType = itemExternal.VideoType
				if itemExternal.IsVideoUploaded {
					respItem.VideoURI = itemExternal.VideoOssUri
				} else {
					respItem.VideoURI = itemExternal.VideoUri
				}
			}
		}

		// 添加用户持有数量
		count, ok := userItemCount[strings.ToLower(item.Owner)]
		if ok {
			respItem.OwnerOwnedAmount = count
		}

		// 添加最近成交价格
		price, ok := lastSales[strings.ToLower(item.TokenId)]
		if ok {
			respItem.LastSellPrice = price
		}

		respItems = append(respItems, respItem)
	}

	return &types.NFTListingInfoResp{
		Result: respItems,
		Count:  count,
	}, nil
}

// GetItem 获取单个NFT的详细信息
func GetItem(ctx context.Context, svcCtx *svc.ServerCtx, chain string, chainID int, collectionAddr, tokenID string) (*types.ItemDetailInfoResp, error) {
	var queryErr error
	var wg sync.WaitGroup

	// 并发查询以下信息:
	// 1. 查询collection信息
	var collection *multi.Collection
	wg.Add(1)
	go func() {
		defer wg.Done()
		collection, queryErr = svcCtx.Dao.QueryCollectionInfo(ctx, chain, collectionAddr)
		if queryErr != nil {
			return
		}
	}()

	// 2. 查询item基本信息
	var item *multi.Item
	wg.Add(1)
	go func() {
		defer wg.Done()
		item, queryErr = svcCtx.Dao.QueryItemInfo(ctx, chain, collectionAddr, tokenID)
		if queryErr != nil {
			return
		}
	}()

	// 3. 查询item挂单信息
	var itemListInfo *dao.CollectionItem
	wg.Add(1)
	go func() {
		defer wg.Done()
		itemListInfo, queryErr = svcCtx.Dao.QueryItemListInfo(ctx, chain, collectionAddr, tokenID)
		if queryErr != nil {
			return
		}
	}()

	// 4. 查询item图片和视频信息
	ItemExternals := make(map[string]multi.ItemExternal)
	wg.Add(1)
	go func() {
		defer wg.Done()
		items, err := svcCtx.Dao.QueryCollectionItemsImage(ctx, chain, collectionAddr, []string{tokenID})
		if err != nil {
			queryErr = errors.Wrap(err, "failed on get items image info")
			return
		}

		for _, item := range items {
			ItemExternals[strings.ToLower(item.TokenId)] = item
		}
	}()

	// 5. 查询最近成交价格
	lastSales := make(map[string]decimal.Decimal)
	wg.Add(1)
	go func() {
		defer wg.Done()
		lastSale, err := svcCtx.Dao.QueryLastSalePrice(ctx, chain, collectionAddr, []string{tokenID})
		if err != nil {
			queryErr = errors.Wrap(err, "failed on get items last sale info")
			return
		}

		for _, v := range lastSale {
			lastSales[strings.ToLower(v.TokenId)] = v.Price
		}
	}()

	// 6. 查询最高出价信息
	bestBids := make(map[string]multi.Order)
	wg.Add(1)
	go func() {
		defer wg.Done()
		bids, err := svcCtx.Dao.QueryBestBids(ctx, chain, "", collectionAddr, []string{tokenID})
		if err != nil {
			queryErr = errors.Wrap(err, "failed on get items last sale info")
			return
		}

		for _, bid := range bids {
			order, ok := bestBids[strings.ToLower(bid.TokenId)]
			if !ok {
				bestBids[strings.ToLower(bid.TokenId)] = bid
				continue
			}
			if bid.Price.GreaterThan(order.Price) {
				bestBids[strings.ToLower(bid.TokenId)] = bid
			}
		}
	}()

	// 7. 查询collection最高出价信息
	var collectionBestBid multi.Order
	wg.Add(1)
	go func() {
		defer wg.Done()
		bid, err := svcCtx.Dao.QueryCollectionBestBid(ctx, chain, "", collectionAddr)
		if err != nil {
			queryErr = errors.Wrap(err, "failed on get items last sale info")
			return
		}
		collectionBestBid = bid
	}()

	// 等待所有查询完成
	wg.Wait()
	if queryErr != nil {
		return nil, errors.Wrap(queryErr, "failed on get items info")
	}

	// 组装返回数据
	var itemDetail types.ItemDetailInfo
	itemDetail.ChainID = chainID

	// 设置item基本信息
	if item != nil {
		itemDetail.Name = item.Name
		itemDetail.CollectionAddress = item.CollectionAddress
		itemDetail.TokenID = item.TokenId
		itemDetail.OwnerAddress = item.Owner
		// 设置collection级别的最高出价信息
		itemDetail.BidOrderID = collectionBestBid.OrderID
		itemDetail.BidExpireTime = collectionBestBid.ExpireTime
		itemDetail.BidPrice = collectionBestBid.Price
		itemDetail.BidTime = collectionBestBid.EventTime
		itemDetail.BidSalt = collectionBestBid.Salt
		itemDetail.BidMaker = collectionBestBid.Maker
		itemDetail.BidType = getBidType(collectionBestBid.OrderType)
		itemDetail.BidSize = collectionBestBid.Size
		itemDetail.BidUnfilled = collectionBestBid.QuantityRemaining
	}

	// 如果item级别的最高出价大于collection级别的最高出价,则使用item级别的出价信息
	bidOrder, ok := bestBids[strings.ToLower(item.TokenId)]
	if ok {
		if bidOrder.Price.GreaterThan(collectionBestBid.Price) {
			itemDetail.BidOrderID = bidOrder.OrderID
			itemDetail.BidExpireTime = bidOrder.ExpireTime
			itemDetail.BidPrice = bidOrder.Price
			itemDetail.BidTime = bidOrder.EventTime
			itemDetail.BidSalt = bidOrder.Salt
			itemDetail.BidMaker = bidOrder.Maker
			itemDetail.BidType = getBidType(bidOrder.OrderType)
			itemDetail.BidSize = bidOrder.Size
			itemDetail.BidUnfilled = bidOrder.QuantityRemaining
		}
	}

	// 设置挂单信息
	if itemListInfo != nil {
		itemDetail.ListPrice = itemListInfo.ListPrice
		itemDetail.MarketplaceID = itemListInfo.MarketID
		itemDetail.ListOrderID = itemListInfo.OrderID
		itemDetail.ListTime = itemListInfo.ListTime
		itemDetail.ListExpireTime = itemListInfo.ListExpireTime
		itemDetail.ListSalt = itemListInfo.ListSalt
		itemDetail.ListMaker = itemListInfo.ListMaker
	}

	// 设置collection信息
	if collection != nil {
		itemDetail.CollectionName = collection.Name
		itemDetail.FloorPrice = collection.FloorPrice
		itemDetail.CollectionImageURI = collection.ImageUri
		if itemDetail.Name == "" {
			itemDetail.Name = fmt.Sprintf("%s #%s", collection.Name, tokenID)
		}
	}

	// 设置最近成交价格
	price, ok := lastSales[strings.ToLower(tokenID)]
	if ok {
		itemDetail.LastSellPrice = price
	}

	// 设置图片和视频信息
	itemExternal, ok := ItemExternals[strings.ToLower(tokenID)]
	if ok {
		itemDetail.ImageURI = itemExternal.ImageUri
		if itemExternal.IsUploadedOss {
			itemDetail.ImageURI = itemExternal.OssUri
		}
		if len(itemExternal.VideoUri) > 0 {
			itemDetail.VideoType = itemExternal.VideoType
			if itemExternal.IsVideoUploaded {
				itemDetail.VideoURI = itemExternal.VideoOssUri
			} else {
				itemDetail.VideoURI = itemExternal.VideoUri
			}
		}
	}

	return &types.ItemDetailInfoResp{
		Result: itemDetail,
	}, nil
}

// GetItemTopTraitPrice 获取指定 token ids的Trait的最高价格信息
func GetItemTopTraitPrice(ctx context.Context, svcCtx *svc.ServerCtx, chain, collectionAddr string, tokenIDs []string) (*types.ItemTopTraitResp, error) {
	// 1. 查询Trait对应的最低挂单价格
	traitsPrice, err := svcCtx.Dao.QueryTraitsPrice(ctx, chain, collectionAddr, tokenIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed on calc top trait")
	}

	// 2. 空结果处理
	if len(traitsPrice) == 0 {
		return &types.ItemTopTraitResp{
			Result: []types.TraitPrice{},
		}, nil
	}

	// 3. 构建 Trait -> 最低挂单价格映射
	traitsPrices := make(map[string]decimal.Decimal)
	for _, traitPrice := range traitsPrice {
		traitsPrices[strings.ToLower(fmt.Sprintf("%s:%s", traitPrice.Trait, traitPrice.TraitValue))] = traitPrice.Price
	}

	// 4. 查询指定 token ids的 所有Trait
	traits, err := svcCtx.Dao.QueryItemsTraits(ctx, chain, collectionAddr, tokenIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query items trait")
	}

	// 5. 计算指定 token ids的 最高价值 Trait
	topTraits := make(map[string]types.TraitPrice)
	for _, trait := range traits {
		key := strings.ToLower(fmt.Sprintf("%s:%s", trait.Trait, trait.TraitValue))
		price, ok := traitsPrices[key]
		if ok {
			topPrice, ok := topTraits[trait.TokenId]
			// 如果已有最高价且当前价格不高于最高价,跳过
			if ok {
				if price.LessThanOrEqual(topPrice.Price) {
					continue
				}
			}

			// 更新最高价值 Trait
			topTraits[trait.TokenId] = types.TraitPrice{
				CollectionAddress: collectionAddr,
				TokenID:           trait.TokenId,
				Trait:             trait.Trait,
				TraitValue:        trait.TraitValue,
				Price:             price,
			}
		}
	}

	// 6. 整理返回结果
	var results []types.TraitPrice
	for _, topTrait := range topTraits {
		results = append(results, topTrait)
	}

	return &types.ItemTopTraitResp{
		Result: results,
	}, nil
}

func GetHistorySalesPrice(ctx context.Context, svcCtx *svc.ServerCtx, chain, collectionAddr, duration string) ([]types.HistorySalesPriceInfo, error) {
	var durationTimeStamp int64
	if duration == "24h" {
		durationTimeStamp = 24 * 60 * 60
	} else if duration == "7d" {
		durationTimeStamp = 7 * 24 * 60 * 60
	} else if duration == "30d" {
		durationTimeStamp = 30 * 24 * 60 * 60
	} else {
		return nil, errors.New("only support 24h/7d/30d")
	}

	historySalesPriceInfo, err := svcCtx.Dao.QueryHistorySalesPriceInfo(ctx, chain, collectionAddr, durationTimeStamp)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get history sales price info")
	}

	res := make([]types.HistorySalesPriceInfo, len(historySalesPriceInfo))

	for i, ele := range historySalesPriceInfo {
		res[i] = types.HistorySalesPriceInfo{
			Price:     ele.Price,
			TokenID:   ele.TokenId,
			TimeStamp: ele.EventTime,
		}
	}

	return res, nil
}

// GetItemOwner 获取NFT Item的所有者信息
func GetItemOwner(ctx context.Context, svcCtx *svc.ServerCtx, chainID int64, chain, collectionAddr, tokenID string) (*types.ItemOwner, error) {
	// 从链上获取NFT所有者地址
	address, err := svcCtx.NodeSrvs[chainID].FetchNftOwner(collectionAddr, tokenID)
	if err != nil {
		xzap.WithContext(ctx).Error("failed on fetch nft owner onchain", zap.Error(err))
		return nil, errcode.ErrUnexpected
	}

	// 将地址转换为校验和格式
	owner, err := eip.ToCheckSumAddress(address.String())
	if err != nil {
		xzap.WithContext(ctx).Error("invalid address", zap.Error(err), zap.String("address", address.String()))
		return nil, errcode.ErrUnexpected
	}

	// 更新数据库中的所有者信息
	if err := svcCtx.Dao.UpdateItemOwner(ctx, chain, collectionAddr, tokenID, owner); err != nil {
		xzap.WithContext(ctx).Error("failed on update item owner", zap.Error(err), zap.String("address", address.String()))
	}

	// 返回NFT所有者信息
	return &types.ItemOwner{
		CollectionAddress: collectionAddr,
		TokenID:           tokenID,
		Owner:             owner,
	}, nil
}

// GetItemTraits 获取NFT的 Trait信息
// 主要功能:
// 1. 并发查询三个信息:
//   - NFT的 Trait信息
//   - 集合中每个 Trait的数量统计
//   - 集合基本信息
//
// 2. 计算每个 Trait的百分比
// 3. 组装返回数据
func GetItemTraits(ctx context.Context, svcCtx *svc.ServerCtx, chain, collectionAddr, tokenID string) ([]types.TraitInfo, error) {
	var traitInfos []types.TraitInfo
	var itemTraits []multi.ItemTrait
	var collection *multi.Collection
	var traitCounts []types.TraitCount
	var queryErr error
	var wg sync.WaitGroup

	// 并发查询NFT Trait信息
	wg.Add(1)
	go func() {
		defer wg.Done()
		itemTraits, queryErr = svcCtx.Dao.QueryItemTraits(
			ctx,
			chain,
			collectionAddr,
			tokenID,
		)
		if queryErr != nil {
			return
		}
	}()

	// 并发查询集合 Trait统计
	wg.Add(1)
	go func() {
		defer wg.Done()
		traitCounts, queryErr = svcCtx.Dao.QueryCollectionTraits(
			ctx,
			chain,
			collectionAddr,
		)
		if queryErr != nil {
			return
		}
	}()

	// 并发查询集合信息
	wg.Add(1)
	go func() {
		defer wg.Done()
		collection, queryErr = svcCtx.Dao.QueryCollectionInfo(
			ctx,
			chain,
			collectionAddr,
		)
		if queryErr != nil {
			return
		}
	}()

	// 等待所有查询完成
	wg.Wait()
	if queryErr != nil {
		return nil, queryErr
	}

	// 如果NFT没有 Trait信息,返回空数组
	if len(itemTraits) == 0 {
		return traitInfos, nil
	}

	// 构建 Trait数量映射
	traitCountMap := make(map[string]int64)
	for _, trait := range traitCounts {
		traitCountMap[fmt.Sprintf("%s-%s", trait.Trait, trait.TraitValue)] = trait.Count
	}

	// 计算每个 Trait的百分比并组装返回数据
	for _, trait := range itemTraits {
		key := fmt.Sprintf("%s-%s", trait.Trait, trait.TraitValue)
		if count, ok := traitCountMap[key]; ok {
			traitPercent := 0.0
			if collection.ItemAmount != 0 {
				traitPercent = decimal.NewFromInt(count).
					DivRound(decimal.NewFromInt(collection.ItemAmount), 4).
					Mul(decimal.NewFromInt(100)).
					InexactFloat64()
			}
			traitInfos = append(traitInfos, types.TraitInfo{
				Trait:        trait.Trait,
				TraitValue:   trait.TraitValue,
				TraitAmount:  count,
				TraitPercent: traitPercent,
			})
		}
	}

	return traitInfos, nil
}

// GetCollectionDetail 获取NFT集合的详细信息：基本信息、24小时交易信息、上架数量、地板价、卖单价格、总交易量
func GetCollectionDetail(ctx context.Context, svcCtx *svc.ServerCtx, chain string, collectionAddr string) (*types.CollectionDetailResp, error) {
	// 查询集合基本信息
	collection, err := svcCtx.Dao.QueryCollectionInfo(ctx, chain, collectionAddr)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get collection info")
	}

	// 获取集合24小时交易信息
	tradeInfos, err := svcCtx.Dao.GetTradeInfoByCollection(chain, collectionAddr, "1d")
	if err != nil {
		xzap.WithContext(ctx).Error("failed on get collection trade info", zap.Error(err))
		//return nil, errcode.NewCustomErr("cache error")
	}

	// 查询上架数量
	listed, err := svcCtx.Dao.QueryListedAmount(ctx, chain, collectionAddr)
	if err != nil {
		xzap.WithContext(ctx).Error("failed on get listed count", zap.Error(err))
		//return nil, errcode.NewCustomErr("cache error")
	} else {
		// 缓存上架数量
		if err := svcCtx.Dao.CacheCollectionsListed(ctx, chain, collectionAddr, int(listed)); err != nil {
			xzap.WithContext(ctx).Error("failed on cache collection listed", zap.Error(err))
		}
	}

	// 查询地板价
	floorPrice, err := svcCtx.Dao.QueryFloorPrice(ctx, chain, collectionAddr)
	if err != nil {
		xzap.WithContext(ctx).Error("failed on get floor price", zap.Error(err))
	}

	// 查询卖单价格
	collectionSell, err := svcCtx.Dao.QueryCollectionSellPrice(ctx, chain, collectionAddr)
	if err != nil {
		xzap.WithContext(ctx).Error("failed on get floor price", zap.Error(err))
	}

	// 如果地板价发生变化,更新价格事件
	if !floorPrice.Equal(collection.FloorPrice) {
		if err := ordermanager.AddUpdatePriceEvent(svcCtx.KvStore, &ordermanager.TradeEvent{
			EventType:      ordermanager.UpdateCollection,
			CollectionAddr: collectionAddr,
			Price:          floorPrice,
		}, chain); err != nil {
			xzap.WithContext(ctx).Error("failed on update floor price", zap.Error(err))
		}
	}

	// 获取24小时交易量和销售数量
	var volume24h decimal.Decimal
	var sold int64
	if tradeInfos != nil {
		volume24h = tradeInfos.Volume
		sold = tradeInfos.ItemCount
	}

	// 查询总交易量
	var allVol decimal.Decimal
	collectionVol, err := svcCtx.Dao.GetCollectionVolume(chain, collectionAddr)
	if err != nil {
		xzap.WithContext(ctx).Error("failed on query collection all volume", zap.Error(err))
	} else {
		allVol = collectionVol
	}

	// 构建返回结果
	detail := types.CollectionDetail{
		ImageUri:    collection.ImageUri, // svcCtx.ImageMgr.GetFileUrl(collection.ImageUri),
		Name:        collection.Name,
		Address:     collection.Address,
		ChainId:     collection.ChainId,
		FloorPrice:  floorPrice,
		SellPrice:   collectionSell.SalePrice.String(),
		VolumeTotal: allVol,
		Volume24h:   volume24h,
		Sold24h:     sold,
		ListAmount:  listed,
		TotalSupply: collection.ItemAmount,
		OwnerAmount: collection.OwnerAmount,
	}

	return &types.CollectionDetailResp{
		Result: detail,
	}, nil
}

// RefreshItemMetadata refresh item meta data.
func RefreshItemMetadata(ctx context.Context, svcCtx *svc.ServerCtx, chainName string, chainId int64, collectionAddress, tokenId string) error {
	if err := mq.AddSingleItemToRefreshMetadataQueue(svcCtx.KvStore, svcCtx.C.ProjectCfg.Name, chainName, chainId, collectionAddress, tokenId); err != nil {
		xzap.WithContext(ctx).Error("failed on add item to refresh queue", zap.Error(err), zap.String("collection address: ", collectionAddress), zap.String("item_id", tokenId))
		return errcode.ErrUnexpected
	}

	return nil

}

func GetItemImage(ctx context.Context, svcCtx *svc.ServerCtx, chain string, collectionAddress, tokenId string) (*types.ItemImage, error) {
	items, err := svcCtx.Dao.QueryCollectionItemsImage(ctx, chain, collectionAddress, []string{tokenId})
	if err != nil || len(items) == 0 {
		return nil, errors.Wrap(err, "failed on get item image")
	}
	var imageUri string
	if items[0].IsUploadedOss {
		imageUri = items[0].OssUri // svcCtx.ImageMgr.GetSmallSizeImageUrl(items[0].OssUri)
	} else {
		imageUri = items[0].ImageUri // svcCtx.ImageMgr.GetSmallSizeImageUrl(items[0].ImageUri)
	}

	return &types.ItemImage{
		CollectionAddress: collectionAddress,
		TokenID:           tokenId,
		ImageUri:          imageUri,
	}, nil
}
