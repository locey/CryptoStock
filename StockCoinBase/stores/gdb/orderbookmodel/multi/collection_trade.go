package multi

import (
	"fmt"

	"github.com/shopspring/decimal"
)

type CollectionTrade struct {
	Id                int64           `gorm:"column:id;AUTO_INCREMENT;primary_key" json:"id"`    // 主键
	EpochNumber       int64           `gorm:"column:epoch_number;default:0" json:"epoch_number"` // 数据同步周期
	CollectionAddress string          `gorm:"column:collection_address" json:"collection_address"`
	ItemCount         int64           `gorm:"column:item_count;default:0" json:"item_count"`                                           // 单周期内交易的nft数量
	Volume            decimal.Decimal `gorm:"column:volume;default:0;NOT NULL" json:"volume"`                                          // 单周期内的成交量
	FloorPrice        decimal.Decimal `gorm:"column:floor_price;default:0;NOT NULL" json:"floor_price"`                                // ...的地板价
	BenchmarkPrice    decimal.Decimal `gorm:"column:benchmark_price;default:0;NOT NULL" json:"benchmark_price"`                        // 池子相关数据,基准价格
	SellPrice         decimal.Decimal `gorm:"column:sell_price;default:0;NOT NULL" json:"sell_price"`                                  // 池子相关数据,出售价格
	BuyPrice          decimal.Decimal `gorm:"column:buy_price;default:0;NOT NULL" json:"buy_price"`                                    // 池子相关数据,购买价格
	CreateTime        int64           `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64           `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func CollectionTradeTableName(chainName string) string {
	return fmt.Sprintf("ob_collection_trade_%s", chainName)
}
