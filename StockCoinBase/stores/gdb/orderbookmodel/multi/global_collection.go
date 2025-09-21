package multi

import (
	"fmt"
)

type GlobalCollection struct {
	Id                int64  `json:"id" gorm:"primaryKey;autoIncrement;column:id;comment:id"` // id
	CollectionAddress string `json:"collection_address" gorm:"column:collection_address;type:varchar(42);index:index_collection_address;not null;default:'';comment:链上合约地址"`
	TokenStandard     int64  `json:"token_standard" gorm:"column:token_standard;type:tinyint(4);not null;default:0"`          // (0:native,1:erc721,2:erc1155)
	ImportStatus      int32  `json:"import_status" gorm:"column:token_standard;type:tinyint(4);not null;default:0"`           //(0:un imported,1:wait import 2:import failed 3:import successfully)
	CreateTime        int64  `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64  `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func GlobalCollectionTableName(chainName string) string {
	return fmt.Sprintf("ob_global_collection_%s", chainName)
}
