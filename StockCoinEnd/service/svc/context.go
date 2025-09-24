package svc

import (
	"context"

	"github.com/locey/CryptoStock/StockCoinBase/chain/nftchainservice"
	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb"
	"github.com/locey/CryptoStock/StockCoinBase/stores/xkv"
	"github.com/pkg/errors"
	"github.com/zeromicro/go-zero/core/stores/cache"
	"github.com/zeromicro/go-zero/core/stores/kv"
	"github.com/zeromicro/go-zero/core/stores/redis"
	"gorm.io/gorm"

	"github.com/locey/CryptoStock/StockCoinEnd/config"
	"github.com/locey/CryptoStock/StockCoinEnd/contract"
	"github.com/locey/CryptoStock/StockCoinEnd/dao"
)

type ServerCtx struct {
	C  *config.Config
	DB *gorm.DB
	//ImageMgr image.ImageManager
	Dao           *dao.Dao
	KvStore       *xkv.Store
	RankKey       string
	NodeSrvs      map[int64]*nftchainservice.Service
	AirdropClient contract.CSTokenContract
}

func NewServiceContext(c *config.Config) (*ServerCtx, error) {
	var err error
	//imageMgr, err = image.NewManager(c.ImageCfg)
	//if err != nil {
	//	return nil, errors.Wrap(err, "failed on create image manager")
	//}

	// Log
	_, err = xzap.SetUp(c.Log)
	if err != nil {
		return nil, err
	}

	var kvConf kv.KvConf
	for _, con := range c.Kv.Redis {
		kvConf = append(kvConf, cache.NodeConf{
			RedisConf: redis.RedisConf{
				Host: con.Host,
				Type: con.Type,
				Pass: con.Pass,
			},
			Weight: 1,
		})
	}

	// redis
	store := xkv.NewStore(kvConf)
	// db
	db, err := gdb.NewDB(&c.DB)
	if err != nil {
		return nil, err
	}

	nodeSrvs := make(map[int64]*nftchainservice.Service)
	for _, supported := range c.ChainSupported {
		nodeSrvs[int64(supported.ChainID)], err = nftchainservice.New(context.Background(), supported.Endpoint, supported.Name, supported.ChainID,
			c.MetadataParse.NameTags, c.MetadataParse.ImageTags, c.MetadataParse.AttributesTags,
			c.MetadataParse.TraitNameTags, c.MetadataParse.TraitValueTags)

		if err != nil {
			return nil, errors.Wrap(err, "failed on start onchain sync service")
		}
	}

	dao := dao.New(context.Background(), db, store)
	serverCtx := NewServerCtx(
		WithDB(db),
		WithKv(store),
		//WithImageMgr(imageMgr),
		WithDao(dao),
	)
	serverCtx.C = c

	serverCtx.NodeSrvs = nodeSrvs

	return serverCtx, nil
}
