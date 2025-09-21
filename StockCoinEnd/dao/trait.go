package dao

import (
	"context"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"

	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

// QueryItemTraits 查询单个NFT Item的 Trait信息
func (d *Dao) QueryItemTraits(ctx context.Context, chain string, collectionAddr string, tokenID string) ([]multi.ItemTrait, error) {
	var itemTraits []multi.ItemTrait
	if err := d.DB.WithContext(ctx).Table(multi.ItemTraitTableName(chain)).
		Select("collection_address, token_id, trait, trait_value").
		Where("collection_address = ? and token_id = ?", collectionAddr, tokenID).
		Scan(&itemTraits).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query items trait info")
	}

	return itemTraits, nil
}

// QueryItemsTraits 查询多个NFT Item的 Trait信息
func (d *Dao) QueryItemsTraits(ctx context.Context, chain string, collectionAddr string, tokenIds []string) ([]multi.ItemTrait, error) {
	var itemsTraits []multi.ItemTrait
	if err := d.DB.WithContext(ctx).Table(multi.ItemTraitTableName(chain)).
		Select("collection_address, token_id, trait, trait_value").
		Where("collection_address = ? and token_id in (?)", collectionAddr, tokenIds).
		Scan(&itemsTraits).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query items trait info")
	}

	return itemsTraits, nil
}

// QueryCollectionTraits 查询NFT合集的 Trait信息统计
func (d *Dao) QueryCollectionTraits(ctx context.Context, chain string, collectionAddr string) ([]types.TraitCount, error) {
	var traitCounts []types.TraitCount
	if err := d.DB.WithContext(ctx).Table(multi.ItemTraitTableName(chain)).
		Select("`trait`,`trait_value`,count(*) as count").Where("collection_address=?", collectionAddr).
		Group("`trait`,`trait_value`").
		Scan(&traitCounts).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query collection trait amount")
	}

	return traitCounts, nil
}
