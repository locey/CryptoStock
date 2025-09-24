package dao

import (
	"gorm.io/gorm"
)

type StockInfo struct {
	gorm.Model
	Ticker         string  `gorm:"primaryKey;size:20" json:"ticker"`
	Name           string  `gorm:"size:100" json:"name"`
	Description    string  `gorm:"type:text" json:"description"`
	Logo           string  `gorm:"size:255" json:"logo"`
	TokenAddress   string  `gorm:"size:100" json:"token_address"`
	AvgGain        float64 `gorm:"type:float" json:"avg_gain"`         //7日平均涨幅
	AvgGainPercent float64 `gorm:"type:float" json:"avg_gain_percent"` //7日平均涨幅百分比
	AvgVolume      float64 `gorm:"type:float" json:"avg_volume"`       //7日平均成交量
	CurrentPrice   float64 `gorm:"type:float" json:"current_price"`    //当前价格
}

// BatchCreate 批量创建股票信息
func (d *Dao) BatchCreate(stocks []*StockInfo) error {
	return d.DB.CreateInBatches(stocks, 100).Error // 每批100条记录
}

// GetByTicker 根据股票代码查询
func (d *Dao) GetByTicker(ticker string) (*StockInfo, error) {
	var stock StockInfo
	err := d.DB.Where("ticker = ?", ticker).First(&stock).Error
	return &stock, err
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

// SearchByName 根据名称搜索股票
func (d *Dao) SearchByName(keyword string) ([]StockInfo, error) {
	var stocks []StockInfo
	err := d.DB.Where("name LIKE ?", "%"+keyword+"%").Find(&stocks).Error
	return stocks, err
}
