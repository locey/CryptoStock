package model

import (
	"context"

	"gorm.io/gorm"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb"
)

func NewDB(ndb *gdb.Config) *gorm.DB {
	db := gdb.MustNewDB(ndb)
	ctx := context.Background()
	err := InitModel(ctx, db)
	if err != nil {
		panic(err)
	}

	return db
}

// InitModel 初始化服务模型信息
func InitModel(ctx context.Context, db *gorm.DB) error {
	err := db.Set(
		"gorm:table_options",
		"ENGINE=InnoDB AUTO_INCREMENT=1 CHARACTER SET=utf8mb4 COLLATE=utf8mb4_general_ci",
	).Error
	if err != nil {
		return err
	}

	return nil
}
