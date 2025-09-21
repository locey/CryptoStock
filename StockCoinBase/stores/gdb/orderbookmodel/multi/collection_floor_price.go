package multi

import (
	"fmt"

	"github.com/shopspring/decimal"
)

type CollectionFloorPrice struct {
	Id                int64           `gorm:"column:id;AUTO_INCREMENT;primary_key" json:"id"`                                          // 主键
	CollectionAddress string          `gorm:"column:collection_address;NOT NULL" json:"collection_address"`                            // 链上合约地址
	Price             decimal.Decimal `gorm:"column:price;type:decimal(30,18);comment:整个collection中item的最低的listing价格" json:"price"`    // token 价格
	EventTime         int64           `gorm:"column:event_time" json:"event_time"`                                                     // 事件时间
	CreateTime        int64           `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64           `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func CollectionFloorPriceTableName(chainName string) string {
	return fmt.Sprintf("ob_collection_floor_price_%s", chainName)
}
