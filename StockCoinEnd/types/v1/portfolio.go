package types

import (
	"github.com/shopspring/decimal"
)

type UserCollectionsParams struct {
	UserAddresses []string `json:"user_addresses"`
}

type UserCollections struct {
	ChainID    int             `json:"chain_id"`
	Address    string          `json:"address"` // 合约地址
	Name       string          `json:"name"`
	Symbol     string          `json:"symbol"`
	ImageURI   string          `json:"image_uri"`
	ItemCount  int64           `json:"item_count"`
	FloorPrice decimal.Decimal `json:"floor_price"`
	ItemAmount int64           `json:"item_amount"`
}

type CollectionInfo struct {
	ChainID    int             `json:"chain_id"`
	Name       string          `json:"name"`
	Address    string          `json:"address"`
	Symbol     string          `json:"symbol"`
	ImageURI   string          `json:"image_uri"`
	ListAmount int             `json:"list_amount"`
	ItemAmount int64           `json:"item_amount"`
	FloorPrice decimal.Decimal `json:"floor_price"`
}

type ChainInfo struct {
	ChainID   int             `json:"chain_id"`
	ItemOwned int64           `json:"item_owned"`
	ItemValue decimal.Decimal `json:"item_value"`
}

type UserCollectionsData struct {
	CollectionInfos []CollectionInfo `json:"collection_info"`
	ChainInfos      []ChainInfo      `json:"chain_info"`
}

type UserCollectionsResp struct {
	Result interface{} `json:"result"`
}

type PortfolioMultiChainItemFilterParams struct {
	ChainID             []int    `json:"chain_id"`
	CollectionAddresses []string `json:"collection_addresses"`
	UserAddresses       []string `json:"user_addresses"`

	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

type PortfolioMultiChainListingFilterParams struct {
	ChainID             []int    `json:"chain_id"`
	CollectionAddresses []string `json:"collection_addresses"`
	UserAddresses       []string `json:"user_addresses"`

	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

type PortfolioMultiChainBidFilterParams struct {
	ChainID             []int    `json:"chain_id"`
	CollectionAddresses []string `json:"collection_addresses"`
	UserAddresses       []string `json:"user_addresses"`

	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

type PortfolioItemInfo struct {
	ChainID            int    `json:"chain_id"`
	CollectionAddress  string `json:"collection_address"`
	CollectionName     string `json:"collection_name"`
	CollectionImageURI string `json:"collection_image_uri"`
	TokenID            string `json:"token_id"`
	ImageURI           string `json:"image_uri"`

	LastCostPrice float64         `json:"last_cost_price"`
	OwnedTime     int64           `json:"owned_time"`
	Owner         string          `json:"owner"`
	Listing       bool            `json:"listing"`
	MarketplaceID int             `json:"marketplace_id"`
	Name          string          `json:"name"`
	FloorPrice    decimal.Decimal `json:"floor_price"`

	ListOrderID    string          `json:"list_order_id"`
	ListTime       int64           `json:"list_time"`
	ListPrice      decimal.Decimal `json:"list_price"`
	ListExpireTime int64           `json:"list_expire_time"`
	ListSalt       int64           `json:"list_salt"`
	ListMaker      string          `json:"list_maker"`

	BidOrderID    string          `json:"bid_order_id"`
	BidTime       int64           `json:"bid_time"`
	BidExpireTime int64           `json:"bid_expire_time"`
	BidPrice      decimal.Decimal `json:"bid_price"`
	BidSalt       int64           `json:"bid_salt"`
	BidMaker      string          `json:"bid_maker"`
	BidType       int64           `json:"bid_type"`
	BidSize       int64           `json:"bid_size"`
	BidUnfilled   int64           `json:"bid_unfilled"`
}

type UserItemsResp struct {
	Result interface{} `json:"result"`
	Count  int64       `json:"count"`
}

type UserListingsResp struct {
	Count  int64     `json:"count"`
	Result []Listing `json:"result"`
}

type Listing struct {
	CollectionAddress string          `json:"collection_address"`
	CollectionName    string          `json:"collection_name"`
	ImageURI          string          `json:"image_uri"`
	Name              string          `json:"name"`
	TokenID           string          `json:"token_id"`
	LastCostPrice     decimal.Decimal `json:"last_cost_price"`
	MarketplaceID     int             `json:"marketplace_id"`
	ChainID           int             `json:"chain_id"`

	ListOrderID    string          `json:"list_order_id"`
	ListTime       int64           `json:"list_time"`
	ListPrice      decimal.Decimal `json:"list_price"`
	ListExpireTime int64           `json:"list_expire_time"`
	ListSalt       int64           `json:"list_salt"`
	ListMaker      string          `json:"list_maker"`

	BidOrderID    string          `json:"bid_order_id"`
	BidTime       int64           `json:"bid_time"`
	BidExpireTime int64           `json:"bid_expire_time"`
	BidPrice      decimal.Decimal `json:"bid_price"`
	BidSalt       int64           `json:"bid_salt"`
	BidMaker      string          `json:"bid_maker"`
	BidType       int64           `json:"bid_type"`
	BidSize       int64           `json:"bid_size"`
	BidUnfilled   int64           `json:"bid_unfilled"`
	FloorPrice    decimal.Decimal `json:"floor_price"`
}

type BidInfo struct {
	BidOrderID    string          `json:"bid_order_id"`
	BidTime       int64           `json:"bid_time"`
	BidExpireTime int64           `json:"bid_expire_time"`
	BidPrice      decimal.Decimal `json:"bid_price"`
	BidSalt       int64           `json:"bid_salt"`
	BidSize       int64           `json:"bid_size"`
	BidUnfilled   int64           `json:"bid_unfilled"`
}

type UserBidsResp struct {
	Count  int       `json:"count"`
	Result []UserBid `json:"result"`
}

type UserBid struct {
	ChainID           int             `json:"chain_id"`
	CollectionAddress string          `json:"collection_address"`
	TokenID           string          `json:"token_id"`
	BidPrice          decimal.Decimal `json:"bid_price"`
	MarketplaceID     int             `json:"marketplace_id"`
	ExpireTime        int64           `json:"expire_time"`
	BidType           int64           `json:"bid_type"`
	CollectionName    string          `json:"collection_name"`
	ImageURI          string          `json:"image_uri"`
	OrderSize         int64           `json:"order_size"`
	BidInfos          []BidInfo       `json:"bid_infos"`
}

type MultichainCollection struct {
	CollectionAddress string `json:"collection_address"`
	Chain             string `json:"chain"`
}
