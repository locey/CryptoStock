package collectionfilter

import (
	"context"
	"strings"
	"sync"

	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb"
	"github.com/pkg/errors"

	"gorm.io/gorm"

	"github.com/locey/CryptoStock/StockCoinSync/service/comm"
)

// Filter is a thread-safe structure to store a set of strings.
type Filter struct {
	ctx     context.Context
	db      *gorm.DB
	chain   string
	set     map[string]bool // Set of strings
	lock    *sync.RWMutex   // Read/Write mutex for thread safety
	project string
}

// NewFilter creates a new Filter and returns its pointer.
func New(ctx context.Context, db *gorm.DB, chain string, project string) *Filter {
	return &Filter{
		ctx:     ctx,
		db:      db,
		chain:   chain,
		set:     make(map[string]bool),
		lock:    &sync.RWMutex{},
		project: project,
	}
}

// Add inserts a new element into the Filter.
// The element is transformed to lowercase before being inserted.
func (f *Filter) Add(element string) {
	f.lock.Lock()         // Acquire the lock for writing
	defer f.lock.Unlock() // Defer unlocking until function return
	f.set[strings.ToLower(element)] = true
}

// Remove deletes an element from the Filter.
func (f *Filter) Remove(element string) {
	f.lock.Lock()
	defer f.lock.Unlock()
	delete(f.set, strings.ToLower(element))
}

// Contains checks whether the Filter contains a specific element.
// The element is transformed to lowercase before checking.
func (f *Filter) Contains(element string) bool {
	f.lock.RLock()         // Acquire the lock for reading
	defer f.lock.RUnlock() // Defer unlocking until function return
	_, exists := f.set[strings.ToLower(element)]
	return exists
}

func (f *Filter) PreloadCollections() error {
	var addresses []string
	var err error

	// Query the addresses directly from the database
	err = f.db.WithContext(f.ctx).
		Table(gdb.GetMultiProjectCollectionTableName(f.project, f.chain)).
		Select("address").
		Where("floor_price_status = ?", comm.CollectionFloorPriceImported).
		Scan(&addresses).Error

	if err != nil {
		return errors.Wrap(err, "failed on query collections from db")
	}

	// Add each address into the Filter
	for _, address := range addresses {
		f.Add(address)
	}

	return nil
}
