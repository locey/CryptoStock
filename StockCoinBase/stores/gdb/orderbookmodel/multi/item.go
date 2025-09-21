package multi

import (
	"fmt"

	"github.com/shopspring/decimal"
)

type Item struct {
	Id                int64           `gorm:"column:id;AUTO_INCREMENT;primary_key" json:"id"`                                          // 主键
	ChainId           int             `gorm:"column:chain_id;default:1;NOT NULL" json:"chain_id"`                                      // 链类型
	CollectionAddress string          `gorm:"column:collection_address" json:"collection_address"`                                     // 合约地址
	TokenId           string          `gorm:"column:token_id;NOT NULL" json:"token_id"`                                                // token_id
	Name              string          `gorm:"column:name;NOT NULL" json:"name"`                                                        // nft名称
	Owner             string          `gorm:"column:owner" json:"owner"`                                                               // 拥有者
	Creator           string          `gorm:"column:creator;NOT NULL" json:"creator"`                                                  // 创建者
	Supply            int64           `gorm:"column:supply;NOT NULL" json:"supply"`                                                    // item最多可以有多少份
	ListPrice         decimal.Decimal `gorm:"column:list_price" json:"list_price"`                                                     // 上架价格
	ListTime          int64           `gorm:"column:list_time" json:"list_time"`                                                       // 上架时间
	SalePrice         decimal.Decimal `gorm:"column:sale_price" json:"sale_price"`                                                     // 销售价格
	Views             int64           `gorm:"column:views" json:"views"`                                                               // 浏览量
	CreateTime        int64           `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64           `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func ItemTableName(chainName string) string {
	return fmt.Sprintf("ob_item_%s", chainName)
}
