package multi

import "fmt"

type ItemTrait struct {
	Id                int64  `gorm:"column:id;AUTO_INCREMENT;primary_key" json:"id"` // 主键
	CollectionAddress string `gorm:"column:collection_address" json:"collection_address"`
	TokenId           string `gorm:"column:token_id" json:"token_id"`
	Trait             string `gorm:"column:trait;NOT NULL" json:"trait"`                                                      // 属性名称
	TraitValue        string `gorm:"column:trait_value;NOT NULL" json:"trait_value"`                                          // 属性值
	CreateTime        int64  `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64  `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func ItemTraitTableName(chainName string) string {
	return fmt.Sprintf("ob_item_trait_%s", chainName)
}
