package dao

import (
	"context"
	"fmt"
	"strings"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
	"github.com/pkg/errors"
)

// QueryCollectionItemsImage 查询集合内NFT Item的图片和视频信息
func (d *Dao) QueryCollectionItemsImage(ctx context.Context, chain string,
	collectionAddr string, tokenIds []string) ([]multi.ItemExternal, error) {
	var itemsExternal []multi.ItemExternal

	if err := d.DB.WithContext(ctx).
		Table(multi.ItemExternalTableName(chain)).
		Select("collection_address, token_id, is_uploaded_oss, "+
			"image_uri, oss_uri, video_type, is_video_uploaded, "+
			"video_uri, video_oss_uri").
		Where("collection_address = ? and token_id in (?)",
			collectionAddr, tokenIds).
		Scan(&itemsExternal).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query items external info")
	}

	return itemsExternal, nil
}

// QueryMultiChainCollectionsItemsImage 查询多条链上NFT Item的图片信息
// 主要功能:
// 1. 按链名称对输入的Item信息进行分组
// 2. 构建多条链的联合查询SQL
// 3. 返回所有链上Item的图片信息
func (d *Dao) QueryMultiChainCollectionsItemsImage(ctx context.Context, itemInfos []MultiChainItemInfo) ([]multi.ItemExternal, error) {
	var itemsExternal []multi.ItemExternal

	// SQL语句组成部分
	sqlHead := "SELECT * FROM (" // 外层查询开始
	sqlTail := ") as combined"   // 外层查询结束
	var sqlMids []string         // 存储每条链的子查询

	// 按链名称对Item信息分组
	chainItems := make(map[string][]MultiChainItemInfo)
	for _, itemInfo := range itemInfos {
		items, ok := chainItems[strings.ToLower(itemInfo.ChainName)]
		if ok {
			items = append(items, itemInfo)
			chainItems[strings.ToLower(itemInfo.ChainName)] = items
		} else {
			chainItems[strings.ToLower(itemInfo.ChainName)] = []MultiChainItemInfo{itemInfo}
		}
	}

	// 遍历每条链构建子查询
	for chainName, items := range chainItems {
		// 构建IN查询条件: (('addr1','id1'),('addr2','id2'),...)
		tmpStat := fmt.Sprintf("(('%s','%s')", items[0].CollectionAddress, items[0].TokenID)
		for i := 1; i < len(items); i++ {
			tmpStat += fmt.Sprintf(",('%s','%s')", items[i].CollectionAddress, items[i].TokenID)
		}
		tmpStat += ") "

		// 构建子查询SQL:
		// 1. 选择Item的图片相关字段
		// 2. 从对应链的external表查询
		// 3. 匹配集合地址和tokenID
		sqlMid := "("
		sqlMid += "select collection_address, token_id, is_uploaded_oss, image_uri, oss_uri "
		sqlMid += fmt.Sprintf("from %s ", multi.ItemExternalTableName(chainName))
		sqlMid += "where (collection_address,token_id) in "
		sqlMid += tmpStat
		sqlMid += ")"

		sqlMids = append(sqlMids, sqlMid)
	}

	// 使用UNION ALL组合所有子查询
	sql := sqlHead
	for i := 0; i < len(sqlMids); i++ {
		if i != 0 {
			sql += " UNION ALL " // 使用UNION ALL合并结果集
		}
		sql += sqlMids[i]
	}
	sql += sqlTail

	// 执行SQL查询
	if err := d.DB.WithContext(ctx).Raw(sql).Scan(&itemsExternal).Error; err != nil {
		return nil, errors.Wrap(err, "failed on query multi chain items external info")
	}

	return itemsExternal, nil
}
