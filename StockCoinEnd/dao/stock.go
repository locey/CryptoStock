package dao

import (
	"gorm.io/gorm"
)

type StockInfo struct {
	gorm.Model
	Ticker       string `gorm:"primaryKey;size:20" json:"ticker"`
	Name         string `gorm:"size:100" json:"name"`
	Description  string `gorm:"type:text" json:"description"`
	Logo         string `gorm:"size:255" json:"logo"`
	TokenAddress string `gorm:"size:100" json:"token_address"`
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
