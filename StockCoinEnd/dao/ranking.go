package dao

import (
	"fmt"
	"strings"
	"time"

	"github.com/pkg/errors"
	"github.com/shopspring/decimal"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
)

type CollectionTrade struct {
	ContractAddress string          `json:"contract_address"`
	ItemCount       int64           `json:"item_count"`
	Volume          decimal.Decimal `json:"volume"`
	VolumeChange    int             `json:"volume_change"`
	PreFloorPrice   decimal.Decimal `json:"pre_floor_price"`
	FloorChange     int             `json:"floor_change"`
}

func GenRankingKey(project, chain string, period int) string {
	return fmt.Sprintf("cache:%s:%s:ranking:volume:%d", strings.ToLower(project), strings.ToLower(chain), period)
}

type periodEpochMap map[string]int

var periodToEpoch = periodEpochMap{
	"15m": 3,
	"1h":  12,
	"6h":  72,
	"24h": 288,
	"1d":  288,
	"7d":  2016,
	"30d": 8640,
}

// GetTradeInfoByCollection 获取指定时间段内集合的交易统计信息
func (d *Dao) GetTradeInfoByCollection(chain, collectionAddr, period string) (*CollectionTrade, error) {
	// 查询当前时间段的交易信息
	var tradeCount int64
	var totalVolume decimal.Decimal
	var floorPrice decimal.Decimal

	// 获取时间段对应的epoch值
	epoch, ok := periodToEpoch[period]
	if !ok {
		return nil, errors.Errorf("invalid period: %s", period)
	}
	// 计算查询的时间范围
	startTime := time.Now().Add(-time.Duration(epoch) * time.Minute)
	endTime := time.Now()

	// 统计当前时间段内的交易数量和总交易额
	err := d.DB.WithContext(d.ctx).Table(multi.ActivityTableName(chain)).
		Where("collection_address = ? AND activity_type = ? AND event_time >= ? AND event_time <= ?",
			collectionAddr, multi.Sale, startTime, endTime).
		Select("COUNT(*) as trade_count, COALESCE(SUM(price), 0) as total_volume").
		Row().Scan(&tradeCount, &totalVolume)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get trade count and volume")
	}

	// 获取当前时间段内的地板价(最低成交价)
	err = d.DB.WithContext(d.ctx).Table(multi.ActivityTableName(chain)).
		Where("collection_address = ? AND activity_type = ? AND event_time >= ? AND event_time <= ?",
			collectionAddr, multi.Sale, startTime, endTime).
		Select("COALESCE(MIN(price), 0)").
		Row().Scan(&floorPrice)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get floor price")
	}

	// 计算上一个时间段的时间范围
	prevStartTime := startTime.Add(-time.Duration(epoch) * time.Minute)
	prevEndTime := startTime

	var prevVolume decimal.Decimal
	var prevFloorPrice decimal.Decimal

	// 获取上一时段的总交易额
	err = d.DB.WithContext(d.ctx).Table(multi.ActivityTableName(chain)).
		Where("collection_address = ? AND activity_type = ? AND event_time >= ? AND event_time <= ?",
			collectionAddr, multi.Sale, prevStartTime, prevEndTime).
		Select("COALESCE(SUM(price), 0)").
		Row().Scan(&prevVolume)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get previous volume")
	}

	// 获取上一时段的地板价
	err = d.DB.WithContext(d.ctx).Table(multi.ActivityTableName(chain)).
		Where("collection_address = ? AND activity_type = ? AND event_time >= ? AND event_time <= ?",
			collectionAddr, multi.Sale, prevStartTime, prevEndTime).
		Select("COALESCE(MIN(price), 0)").
		Row().Scan(&prevFloorPrice)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get previous floor price")
	}

	// 计算交易额和地板价的变化百分比
	volumeChange := 0
	floorChange := 0

	// 如果上一时段交易额不为0,计算交易额变化百分比
	if !prevVolume.IsZero() {
		volumeChangeDecimal := totalVolume.Sub(prevVolume).Div(prevVolume).Mul(decimal.NewFromInt(100))
		volumeChange = int(volumeChangeDecimal.IntPart())
	}
	// 如果上一时段地板价不为0,计算地板价变化百分比
	if !prevFloorPrice.IsZero() {
		floorChangeDecimal := floorPrice.Sub(prevFloorPrice).Div(prevFloorPrice).Mul(decimal.NewFromInt(100))
		floorChange = int(floorChangeDecimal.IntPart())
	}

	// 返回集合交易统计信息
	return &CollectionTrade{
		ContractAddress: collectionAddr,
		ItemCount:       tradeCount,
		Volume:          totalVolume,
		VolumeChange:    volumeChange,
		PreFloorPrice:   prevFloorPrice,
		FloorChange:     floorChange,
	}, nil
}

// 根据Activity获取集合排行榜信息
func (d *Dao) GetCollectionRankingByActivity(chain, period string) ([]*CollectionTrade, error) {
	// 解析时间范围
	// 获取时间段对应的epoch值
	epoch, ok := periodToEpoch[period]
	if !ok {
		return nil, errors.Errorf("invalid period: %s", period)
	}
	// 计算查询的时间范围
	startTime := time.Now().Add(-time.Duration(epoch) * time.Minute)
	endTime := time.Now()

	// 计算上一个时间段
	prevEndTime := startTime
	prevStartTime := startTime.Add(-time.Duration(epoch) * time.Minute)

	// 获取当前时间段的交易统计
	type TradeStats struct {
		CollectionAddress string
		ItemCount         int64
		Volume            decimal.Decimal
		FloorPrice        decimal.Decimal
	}

	var currentStats []TradeStats
	err := d.DB.WithContext(d.ctx).Table(multi.ActivityTableName(chain)).
		Select("collection_address, COUNT(*) as item_count, COALESCE(SUM(price), 0) as volume, COALESCE(MIN(price), 0) as floor_price").
		Where("activity_type = ? AND event_time >= ? AND event_time <= ?", multi.Sale, startTime, endTime).
		Group("collection_address").
		Find(&currentStats).Error
	if err != nil {
		return nil, errors.Wrap(err, "failed to get current stats")
	}

	// 获取上一时间段的交易统计
	var prevStats []TradeStats
	err = d.DB.WithContext(d.ctx).Table(multi.ActivityTableName(chain)).
		Select("collection_address, COUNT(*) as item_count, COALESCE(SUM(price), 0) as volume, COALESCE(MIN(price), 0) as floor_price").
		Where("activity_type = ? AND event_time >= ? AND event_time <= ?", multi.Sale, prevStartTime, prevEndTime).
		Group("collection_address").
		Find(&prevStats).Error
	if err != nil {
		return nil, errors.Wrap(err, "failed to get previous stats")
	}

	// 构建上一时间段数据的map
	prevStatsMap := make(map[string]TradeStats)
	for _, stat := range prevStats {
		prevStatsMap[stat.CollectionAddress] = stat
	}

	// 构建结果
	var result []*CollectionTrade
	for _, curr := range currentStats {
		trade := &CollectionTrade{
			ContractAddress: curr.CollectionAddress,
			ItemCount:       curr.ItemCount,
			Volume:          curr.Volume,
			VolumeChange:    0,
			PreFloorPrice:   decimal.Zero,
			FloorChange:     0,
		}

		// 计算变化率
		if prev, ok := prevStatsMap[curr.CollectionAddress]; ok {
			trade.PreFloorPrice = prev.FloorPrice

			if !prev.Volume.IsZero() {
				volumeChangeDecimal := curr.Volume.Sub(prev.Volume).Div(prev.Volume).Mul(decimal.NewFromInt(100))
				trade.VolumeChange = int(volumeChangeDecimal.IntPart())
			}

			if !prev.FloorPrice.IsZero() {
				floorChangeDecimal := curr.FloorPrice.Sub(prev.FloorPrice).Div(prev.FloorPrice).Mul(decimal.NewFromInt(100))
				trade.FloorChange = int(floorChangeDecimal.IntPart())
			}
		}

		result = append(result, trade)
	}

	return result, nil
}

// 获取指定COllection的交易总量
func (d *Dao) GetCollectionVolume(chain, collectionAddr string) (decimal.Decimal, error) {
	var volume decimal.Decimal
	err := d.DB.WithContext(d.ctx).Table(multi.ActivityTableName(chain)).
		Where("collection_address = ? AND activity_type = ?", collectionAddr, multi.Sale).
		Select("COALESCE(SUM(price), 0)").
		Row().Scan(&volume)
	if err != nil {
		return decimal.Zero, errors.Wrap(err, "failed to get collection volume")
	}

	return volume, nil
}
