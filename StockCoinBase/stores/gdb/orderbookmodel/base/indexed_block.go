package base

const (
	TypeNftTransferIndex            = 0
	TypeMultiMarketsTradeIndex      = 1
	TypeMultiMarketsListIndex       = 2
	TypeMultiMarketsSaleIndex       = 3
	TypeHubContractEventIndex       = 4
	TypeMultiMarketsFloorPriceIndex = 5
)

type IndexedStatus struct {
	Id               int64 `json:"id" gorm:"primaryKey;autoIncrement;column:id;comment:主键"`
	ChainId          int   `json:"chain_id" gorm:"column:chain_id;default:1;NOT NULL" ` // 链类型(1:以太坊)
	LastIndexedBlock int64 `json:"last_indexed_block" gorm:"column:last_indexed_block;NULL)"`
	LastIndexedTime  int64 `json:"last_indexed_time" gorm:"column:last_indexed_time;NULL)"`
	IndexType        int32 `json:"index_type" gorm:"column:index_type;type:tinyint(4);not null;default:0"`                  //0:activity 1:trade info
	CreateTime       int64 `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime       int64 `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func IndexedStatusTableName() string {
	return "ob_indexed_status"
}
