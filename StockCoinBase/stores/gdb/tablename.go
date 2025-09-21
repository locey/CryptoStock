package gdb

import (
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/multi"
)

func GetMultiProjectOrderTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.OrderTableName(chain)
	} else {
		return ""
	}

}

func GetMultiProjectItemTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.ItemTableName(chain)
	} else {
		return ""
	}
}

func GetMultiProjectCollectionTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.CollectionTableName(chain)
	} else {
		return ""
	}
}

func GetMultiProjectActivityTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.ActivityTableName(chain)
	} else {
		return ""
	}
}

func GetMultiProjectCollectionFloorPriceTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.CollectionFloorPriceTableName(chain)
	} else {
		return ""
	}
}

func GetMultiProjectItemExternalTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.ItemExternalTableName(chain)
	} else {
		return ""
	}
}

func GetMultiProjectItemTraitTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.ItemTraitTableName(chain)
	} else {
		return ""
	}
}

func GetMultiProjectCollectionTradeTableName(project string, chain string) string {
	if project == OrderBookDexProject {
		return multi.CollectionTradeTableName(chain)
	} else {
		return ""
	}
}
