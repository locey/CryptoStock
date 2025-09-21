package multi

import (
	"fmt"

	"github.com/shopspring/decimal"
)

const (
	ListingOrder       = 1
	OfferOrder         = 2
	CollectionBidOrder = 3
	ItemBidOrder       = 4
)

const (
	OrderStatusActive    = 0
	OrderStatusInactive  = 1
	OrderStatusExpired   = 2
	OrderStatusCancelled = 3
	OrderStatusFilled    = 4
	OrderStatusNeedSign  = 5
)

const (
	ListingType = 1
	OfferType   = 2
)

const (
	MarketOrderBook = iota
)

type Order struct {
	ID                int64           `gorm:"column:id" json:"id"` //  主键
	MarketplaceId     int             `gorm:"column:marketplace_id" json:"marketplace_id"`
	CollectionAddress string          `gorm:"column:collection_address" json:"collection_address"`
	TokenId           string          `gorm:"column:token_id" json:"token_id"`
	OrderID           string          `gorm:"column:order_id" json:"order_id"`                            //  订单唯一id
	OrderStatus       int             `gorm:"column:order_status;default:0;NOT NULL" json:"order_status"` // 订单状态
	EventTime         int64           `gorm:"column:event_time" json:"event_time"`
	ExpireTime        int64           `gorm:"column:expire_time" json:"expire_time"` // in seconds
	CurrencyAddress   string          `gorm:"column:currency_address" json:"currency_address"`
	Price             decimal.Decimal `gorm:"column:price" json:"price"`
	Maker             string          `gorm:"column:maker" json:"maker"`
	Taker             string          `gorm:"column:taker" json:"taker"`
	QuantityRemaining int64           `gorm:"column:quantity_remaining" json:"quantity_remaining"`
	Size              int64           `gorm:"column:size" json:"size"`
	// 1: listing 2:offer 3:collection bid 4:item bid
	OrderType  int64 `gorm:"column:order_type" json:"order_type"`
	Salt       int64 `gorm:"column:salt" json:"salt"`
	CreateTime int64 `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime int64 `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func OrderTableName(chainName string) string {
	return fmt.Sprintf("ob_order_%s", chainName)
}
