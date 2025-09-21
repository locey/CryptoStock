package types

import "github.com/shopspring/decimal"

type ItemBid struct {
	MarketplaceId     int             `json:"marketplace_id"`
	CollectionAddress string          `json:"collection_address"`
	TokenId           string          `json:"token_id"`
	OrderID           string          `json:"order_id"` //  订单唯一id
	EventTime         int64           `json:"event_time"`
	ExpireTime        int64           `json:"expire_time"` // in seconds
	Price             decimal.Decimal `json:"price"`
	Salt              int64           `json:"salt"`
	BidSize           int64           `json:"bid_size"`
	BidUnfilled       int64           `json:"bid_unfilled"`
	Bidder            string          `json:"bidder"`
	OrderType         int64           `json:"order_type"`
}
