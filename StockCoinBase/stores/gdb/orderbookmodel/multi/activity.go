package multi

import (
	"fmt"

	"github.com/shopspring/decimal"
)

// (1:Buy,2:Mint,3:List,4:Cancel Listing,5:Cancler Offer,6.Make Offer,7.Sell,8.Transfer.)
const (
	Buy                 = 1
	Mint                = 2
	Listing             = 3
	CancelListing       = 4
	CancelOffer         = 5
	MakeOffer           = 6
	Sale                = 7
	Transfer            = 8
	CollectionBid       = 9
	ItemBid             = 10
	CancelCollectionBid = 16
	CancelItemBid       = 17
)

const (
	Hub int = iota
	Opensea
	Looksrare
	X2Y2
	Blur
	OrderBookDex
)

type Activity struct {
	Id int64 `json:"id" gorm:"primaryKey;autoIncrement;column:id;not null"`
	//1:Buy,2:Mint,3:List,4:Cancel List,5:Cancel Offer,6.Make Offer,7.Sell,8.Transfer.
	ActivityType      int             `json:"activity_type" gorm:"column:activity_type;type:tinyint(1);not null"`
	Maker             string          `json:"maker" gorm:"column:maker;type:varchar(42);not null"`
	Taker             string          `json:"taker" gorm:"column:taker;type:varchar(42);not null"`
	MarketplaceID     int             `json:"marketplace_id" gorm:"column:marketplace_id;type:tinyint;not null;default:0"`
	CollectionAddress string          `json:"collection_address" gorm:"column:collection_address;type:varchar(64);not null;default:''"`
	TokenId           string          `json:"token_id" gorm:"column:token_id"`
	CurrencyAddress   string          `gorm:"column:currency_address" json:"currency_address"`
	Price             decimal.Decimal `gorm:"column:price" json:"price"`
	SellPrice         decimal.Decimal `json:"sell_price" gorm:"column:sell_price;type:decimal(30);not null;default:0"`
	BuyPrice          decimal.Decimal `json:"buy_price" gorm:"column:buy_price;type:decimal(30);not null;default:0"`
	BlockNumber       int64           `json:"block_number" gorm:"column:block_number;type:bigint(20);not null"`
	TxHash            string          `json:"tx_hash" gorm:"column:tx_hash;type:varchar(255);not null"`
	EventTime         int64           `json:"event_time" gorm:"column:event_time;type:bigint(20);default:0;comment:链上事件发生的时间"`
	CreateTime        int64           `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64           `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func ActivityTableName(chainName string) string {
	return fmt.Sprintf("ob_activity_%s", chainName)
}
