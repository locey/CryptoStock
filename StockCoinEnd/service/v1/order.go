package service

import (
	"context"
	"sort"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"

	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

// GetOrderInfos 获取订单信息
// 该函数主要用于获取指定NFT的出价信息,包括单个NFT的最高出价和整个Collection的最高出价
func GetOrderInfos(ctx context.Context, svcCtx *svc.ServerCtx, chainID int, chain string, userAddr string, collectionAddr string, tokenIds []string) ([]types.ItemBid, error) {
	// 1. 构建NFT信息列表
	var items []types.ItemInfo
	for _, tokenID := range tokenIds {
		items = append(items, types.ItemInfo{
			CollectionAddress: collectionAddr,
			TokenID:           tokenID,
		})
	}

	// 2. 查询每个NFT的最高出价信息
	bids, err := svcCtx.Dao.QueryItemsBestBids(ctx, chain, userAddr, items)
	if err != nil {
		return nil, errors.Wrap(err, "failed on query items best bids")
	}

	// 3. 处理每个NFT的最高出价,如果有多个出价选择最高的
	itemsBestBids := make(map[string]multi.Order)
	for _, bid := range bids {
		order, ok := itemsBestBids[bid.TokenId]
		if !ok {
			itemsBestBids[bid.TokenId] = bid
			continue
		}
		if bid.Price.GreaterThan(order.Price) {
			itemsBestBids[bid.TokenId] = bid
		}
	}

	// 4. 查询整个Collection的最高出价信息
	collectionBids, err := svcCtx.Dao.QueryCollectionTopNBid(ctx, chain, userAddr, collectionAddr, len(tokenIds))
	if err != nil {
		return nil, errors.Wrap(err, "failed on query collection best bids")
	}

	// 5. 处理并返回最终的出价信息
	return processBids(tokenIds, itemsBestBids, collectionBids, collectionAddr), nil
}

// processBids 处理NFT的出价信息,返回每个NFT的最高出价
// 参数说明:
// - tokenIds: NFT的token ID列表
// - itemsBestBids: 每个NFT的最高出价信息,key为tokenId
// - collectionBids: 整个Collection的最高出价列表
// - collectionAddr: Collection地址
//
// 处理逻辑:
// 1. 将itemsBestBids按价格升序排序
// 2. 遍历tokenIds,对每个tokenId:
//   - 如果该tokenId没有单独的出价信息,使用Collection级别的出价(如果有)
//   - 如果该tokenId有单独的出价信息:
//   - 如果Collection级别没有更高的出价,使用该NFT的出价
//   - 如果Collection级别有更高的出价,使用Collection的出价
//
// 3. 返回每个NFT的最终出价信息
func processBids(tokenIds []string, itemsBestBids map[string]multi.Order, collectionBids []multi.Order, collectionAddr string) []types.ItemBid {
	// 将itemsBestBids转换为切片并按价格升序排序
	var itemsSortedBids []multi.Order
	for _, bid := range itemsBestBids {
		itemsSortedBids = append(itemsSortedBids, bid)
	}
	sort.SliceStable(itemsSortedBids, func(i, j int) bool {
		return itemsSortedBids[i].Price.LessThan(itemsSortedBids[j].Price)
	})

	var resultBids []types.ItemBid
	var cBidIndex int // Collection级别出价的索引

	// 处理没有单独出价的NFT
	for _, tokenId := range tokenIds {
		if _, ok := itemsBestBids[tokenId]; !ok {
			// 如果有Collection级别的出价,使用Collection的出价
			if cBidIndex < len(collectionBids) {
				resultBids = append(resultBids, types.ItemBid{
					MarketplaceId:     collectionBids[cBidIndex].MarketplaceId,
					CollectionAddress: collectionAddr,
					TokenId:           tokenId,
					OrderID:           collectionBids[cBidIndex].OrderID,
					EventTime:         collectionBids[cBidIndex].EventTime,
					ExpireTime:        collectionBids[cBidIndex].ExpireTime,
					Price:             collectionBids[cBidIndex].Price,
					Salt:              collectionBids[cBidIndex].Salt,
					BidSize:           collectionBids[cBidIndex].Size,
					BidUnfilled:       collectionBids[cBidIndex].QuantityRemaining,
					Bidder:            collectionBids[cBidIndex].Maker,
					OrderType:         getBidType(collectionBids[cBidIndex].OrderType),
				})
				cBidIndex++
			}
		}
	}

	// 处理有单独出价的NFT
	for _, itemBid := range itemsSortedBids {
		if cBidIndex >= len(collectionBids) {
			// 如果没有更多Collection级别的出价,使用NFT自己的出价
			resultBids = append(resultBids, types.ItemBid{
				MarketplaceId:     itemBid.MarketplaceId,
				CollectionAddress: collectionAddr,
				TokenId:           itemBid.TokenId,
				OrderID:           itemBid.OrderID,
				EventTime:         itemBid.EventTime,
				ExpireTime:        itemBid.ExpireTime,
				Price:             itemBid.Price,
				Salt:              itemBid.Salt,
				BidSize:           itemBid.Size,
				BidUnfilled:       itemBid.QuantityRemaining,
				Bidder:            itemBid.Maker,
				OrderType:         getBidType(itemBid.OrderType),
			})
		} else {
			// 比较Collection级别的出价和NFT自己的出价
			cBid := collectionBids[cBidIndex]
			if cBid.Price.GreaterThan(itemBid.Price) {
				// 如果Collection的出价更高,使用Collection的出价
				resultBids = append(resultBids, types.ItemBid{
					MarketplaceId:     cBid.MarketplaceId,
					CollectionAddress: collectionAddr,
					TokenId:           itemBid.TokenId,
					OrderID:           cBid.OrderID,
					EventTime:         cBid.EventTime,
					ExpireTime:        cBid.ExpireTime,
					Price:             cBid.Price,
					Salt:              cBid.Salt,
					BidSize:           cBid.Size,
					BidUnfilled:       cBid.QuantityRemaining,
					Bidder:            cBid.Maker,
					OrderType:         getBidType(cBid.OrderType),
				})
				cBidIndex++
			} else {
				// 如果NFT自己的出价更高,使用NFT的出价
				resultBids = append(resultBids, types.ItemBid{
					MarketplaceId:     itemBid.MarketplaceId,
					CollectionAddress: collectionAddr,
					TokenId:           itemBid.TokenId,
					OrderID:           itemBid.OrderID,
					EventTime:         itemBid.EventTime,
					ExpireTime:        itemBid.ExpireTime,
					Price:             itemBid.Price,
					Salt:              itemBid.Salt,
					BidSize:           itemBid.Size,
					BidUnfilled:       itemBid.QuantityRemaining,
					Bidder:            itemBid.Maker,
					OrderType:         getBidType(itemBid.OrderType),
				})
			}
		}
	}

	return resultBids
}
