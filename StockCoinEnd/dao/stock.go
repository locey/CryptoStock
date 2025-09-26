package dao

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StockInfo struct {
	gorm.Model
	Ticker         string  `gorm:"uniqueIndex;size:20" json:"ticker"`
	Name           string  `gorm:"size:100" json:"name"`
	Description    string  `gorm:"type:text" json:"description"`
	Logo           string  `gorm:"size:255" json:"logo"`
	TokenAddress   string  `gorm:"size:100" json:"token_address"`
	AvgGain        float64 `gorm:"type:float" json:"avg_gain"`         //7日平均涨幅
	AvgGainPercent float64 `gorm:"type:float" json:"avg_gain_percent"` //7日平均涨幅百分比
	AvgVolume      float64 `gorm:"type:float" json:"avg_volume"`       //7日平均成交量
	CurrentPrice   float64 `gorm:"type:float" json:"current_price"`    //当前价格
	MarketCap      float64 `gorm:"type:float" json:"market_cap"`       //市值
}

// 构造stock_token表
type StockToken struct {
	gorm.Model
	Ticker       string `gorm:"uniqueIndex;size:20" json:"ticker"`
	TokenAddress string `gorm:"size:100" json:"token_address"`
}

// BatchCreate 批量创建股票信息
func (d *Dao) BatchCreate(stocks []*StockInfo) error {
	return d.DB.Clauses(clause.OnConflict{
		DoNothing: true,
	}).CreateInBatches(stocks, 100).Error // 每批100条记录
}

// GetByTicker 根据股票代码查询
func (d *Dao) GetByTicker(ticker string) (*StockInfo, error) {
	var stock StockInfo
	err := d.DB.Where("ticker = ?", ticker).First(&stock).Error
	return &stock, err
}

// GetByTicker 根据股票代码查询
func (d *Dao) GetByTickers(tickers []string) ([]StockInfo, error) {
	var stocks []StockInfo
	err := d.DB.Where("ticker IN ?", tickers).Find(&stocks).Error
	return stocks, err
}

// 分页获取StockInfo
func (d *Dao) GetByPage(page int, pageSize int) ([]StockInfo, error) {
	var stocks []StockInfo
	//分页获取StockInfo列表
	err := d.DB.Limit(pageSize).Offset((page - 1) * pageSize).Find(&stocks).Error
	return stocks, err
}

// Update 更新股票信息
func (d *Dao) Update(stock *StockInfo) error {
	return d.DB.Save(stock).Error
}

// UpdateStockSummary 通过ticker更新AvgGain、AvgGainPercent、AvgVolume、CurrentPrice
func (d *Dao) UpdateStockSummary(ticker string, avgGain float64, avgGainPercent float64, avgVolume float64, currentPrice float64) error {
	return d.DB.Model(&StockInfo{}).Where("ticker = ?", ticker).Updates(map[string]interface{}{
		"avg_gain":         avgGain,
		"avg_gain_percent": avgGainPercent,
		"avg_volume":       avgVolume,
		"current_price":    currentPrice,
	}).Error
}

// UpdateMarketData 更新市值相关数据
func (d *Dao) UpdateMarketData(ticker string, sharesOutstanding float64, avgMarketCap float64) error {
	return d.DB.Model(&StockInfo{}).Where("ticker = ?", ticker).Updates(map[string]interface{}{
		"shares_outstanding": sharesOutstanding,
		"avg_market_cap":     avgMarketCap,
	}).Error

}

// Delete 删除股票信息
func (d *Dao) Delete(ticker string) error {
	return d.DB.Where("ticker = ?", ticker).Delete(&StockInfo{}).Error
}

// ListAll 获取所有股票信息
func (d *Dao) ListAll() ([]StockInfo, error) {
	var stocks []StockInfo
	err := d.DB.Find(&stocks).Error
	return stocks, err
}

// 获取币股池数量
func (d *Dao) Count() (int64, float64, float64, float64, error) {
	var count int64
	d.DB.Model(&StockInfo{}).Count(&count)
	//计算market_cap字段总和
	var sumMarketCap float64
	d.DB.Model(&StockInfo{}).Select("SUM(market_cap)").Scan(&sumMarketCap)
	//计算avg_volume总和
	var sumAvgVolume float64
	d.DB.Model(&StockInfo{}).Select("SUM(avg_volume)").Scan(&sumAvgVolume)
	var avgGainPercent float64
	d.DB.Model(&StockInfo{}).Select("SUM(avg_gain_percent)").Scan(&avgGainPercent)
	//查询数据量
	return count, sumMarketCap, sumAvgVolume, avgGainPercent / float64(count), nil
}

// SearchByName 根据名称搜索股票
func (d *Dao) SearchByName(keyword string) ([]StockInfo, error) {
	var stocks []StockInfo
	err := d.DB.Where("name LIKE ?", "%"+keyword+"%").Find(&stocks).Error
	return stocks, err
}
