package comm

const (
	CollectionFloorPriceNotImport = 0
	CollectionFloorPriceImported  = 1
)

const (
	DBBatchSizeLimit                 = 200
	CollectionFloorChangeIndexType   = 5
	CollectionFloorSyncPeriod        = 150                // in seconds
	DaySeconds                       = 3600 * 24          // in seconds
	MaxCollectionFloorTimeDifference = 10                 // in seconds
	CollectionFloorTimeRange         = 3600 * 24 * 30 * 2 // in seconds
)
