package service

import (
	"context"

	"github.com/pkg/errors"

	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

func GetItemBidsInfo(ctx context.Context, svcCtx *svc.ServerCtx, chain string, collectionAddr, tokenID string, page, pageSize int) (*types.CollectionBidsResp, error) {
	bids, count, err := svcCtx.Dao.QueryItemBids(ctx, chain, collectionAddr, tokenID, page, pageSize)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get item info")
	}

	for i := 0; i < len(bids); i++ {
		bids[i].OrderType = getBidType(bids[i].OrderType)
	}
	return &types.CollectionBidsResp{
		Result: bids,
		Count:  count,
	}, nil
}
