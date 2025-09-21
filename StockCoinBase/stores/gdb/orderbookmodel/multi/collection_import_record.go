package multi

import (
	"fmt"
)

// CollectionImportRecord 导入结果表信息
type CollectionImportRecord struct {
	Id                int64  `json:"id" gorm:"primaryKey;autoIncrement;column:id;comment:id"` // id
	CollectionAddress string `json:"address" gorm:"column:address;type:varchar(42);index:index_collection_address;not null;default:'';comment:链上合约地址"`
	Msg               string `json:"msg" gorm:"msg;type:varchar(16000);default:'';not null;comment:错误的提示信息"`
	FinishedStage     int32  `json:"finished_stage" gorm:"column:finished_stage;type:tinyint(1);not null;default:0;comment:已完成的阶段。0表示加入任务，1表示导入collection完成，2全部完成(指item导入完成，photo不好记录不影响此处的阶段)"`
	CreateTime        int64  `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64  `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func CollectionImportRecordTableName(chainName string) string {
	return fmt.Sprintf("ob_collection_import_record_%s", chainName)
}
