package multi

import (
	"fmt"

	"github.com/shopspring/decimal"
)

const (
	NotAggregated       = 0
	QueuedAggregated    = 1
	Aggregated          = 2
	MissAggregationInfo = 3
)

const (
	NotNeedRefresh = 0
	NeedRefresh    = 1
)

const (
	OverviewDone    = 0
	OverviewWaiting = 1
	OverviewError   = 2
)

const (
	NotSyncHistorySale     = 0
	AlreadySyncHistorySale = 1
)

type Collection struct {
	Id               int64           `gorm:"column:id;AUTO_INCREMENT;primary_key" json:"id"`             // 主键
	Symbol           string          `gorm:"column:symbol;NOT NULL" json:"symbol"`                       // 项目标识
	ChainId          int             `gorm:"column:chain_id;default:1;NOT NULL" json:"chain_id"`         // 链类型(1:以太坊)
	Auth             int             `gorm:"column:auth;default:0;NOT NULL" json:"auth"`                 // 认证(0:默认未认证1:认证通过2:认证不通过)
	TokenStandard    int64           `gorm:"column:token_standard;NOT NULL" json:"token_standard"`       // 合约实现标准
	Name             string          `gorm:"column:name;NOT NULL" json:"name"`                           // 项目名称
	Creator          string          `gorm:"column:creator;NOT NULL" json:"creator"`                     // 创建者
	Address          string          `gorm:"column:address;NOT NULL" json:"address"`                     // 链上合约地址
	OwnerAmount      int64           `gorm:"column:owner_amount;default:0;NOT NULL" json:"owner_amount"` // 拥有item人数
	ItemAmount       int64           `gorm:"column:item_amount;default:0;NOT NULL" json:"item_amount"`   // 该项目NFT的发行总量
	Description      string          `gorm:"column:description" json:"description"`                      // 项目描述
	Website          string          `gorm:"column:website" json:"website"`                              // 项目官网地址
	Twitter          string          `gorm:"column:twitter" json:"twitter"`                              // 项目twitter地址
	Discord          string          `gorm:"column:discord" json:"discord"`                              // 项目 discord 地址
	Instagram        string          `gorm:"column:instagram" json:"instagram"`                          // 项目 instagram 地址
	FloorPrice       decimal.Decimal `gorm:"column:floor_price" json:"floor_price"`
	SalePrice        decimal.Decimal `gorm:"column:sale_price" json:"sale_price"`                       // 整个collection中item的最低的listing价格
	VolumeTotal      decimal.Decimal `gorm:"column:volume_total" json:"volume_total"`                   // 总交易量
	ImageUri         string          `gorm:"column:image_uri" json:"image_uri"`                         // 项目封面图的链接
	BannerUri        string          `gorm:"column:banner_uri" json:"banner_uri"`                       // banner image uri
	OpenseaBanScan   int             `gorm:"column:opensea_ban_scan;default:0" json:"opensea_ban_scan"` // （0.未扫描 1扫描过）
	IsSyncing        int             `gorm:"column:is_syncing;default:0;NOT NULL" json:"is_syncing"`
	IsNeedRefresh    int             `gorm:"column:is_need_refresh;default:0;NOT NULL" json:"is_need_refresh"` // 是否需要刷新
	HistorySaleSync  int             `gorm:"column:history_sale_sync" json:"history_sale_sync"`
	HistoryOverview  int             `gorm:"column:history_overview" json:"history_overview"` // 是否生成历史成交overview(0:已经生成 1:等待生成 2:生成错误)
	FloorPriceStatus int             `gorm:"column:floor_price_status" json:"floor_price_status"`
	CreateTime       int64           `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime       int64           `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func CollectionTableName(chainName string) string {
	return fmt.Sprintf("ob_collection_%s", chainName)
}
