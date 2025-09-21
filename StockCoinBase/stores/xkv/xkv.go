package xkv

import (
	"encoding/json"
	"log"
	"reflect"

	"github.com/pkg/errors"
	"github.com/zeromicro/go-zero/core/stores/cache"
	"github.com/zeromicro/go-zero/core/stores/kv"
	"github.com/zeromicro/go-zero/core/stores/redis"

	"github.com/locey/CryptoStock/StockCoinBase/kit/convert"
)

const (
	// getAndDelScript 获取并删除key所关联的值lua脚本
	getAndDelScript = `local current = redis.call('GET', KEYS[1]);
if (current) then
    redis.call('DEL', KEYS[1]);
end
return current;`
)

// Store 键值存取器结构详情
type Store struct {
	kv.Store
	Redis *redis.Redis
}

// NewStore 新建键值存取器
func NewStore(c kv.KvConf) *Store {
	if len(c) == 0 || cache.TotalWeights(c) <= 0 {
		log.Fatal("no cache nodes")
	}

	cn := redis.MustNewRedis(c[0].RedisConf)
	return &Store{
		Store: kv.NewStore(c),
		Redis: cn,
	}
}

// GetInt 返回给定key所关联的int值
func (s *Store) GetInt(key string) (int, error) {
	value, err := s.Get(key)
	if err != nil {
		return 0, err
	}

	return convert.ToInt(value), nil
}

// SetInt 将int value关联到给定key，seconds为key的过期时间（秒）
func (s *Store) SetInt(key string, value int, seconds ...int) error {
	return s.SetString(key, convert.ToString(value), seconds...)
}

// GetInt64 返回给定key所关联的int64值
func (s *Store) GetInt64(key string) (int64, error) {
	value, err := s.Get(key)
	if err != nil {
		return 0, err
	}

	return convert.ToInt64(value), nil
}

// SetInt64 将int64 value关联到给定key，seconds为key的过期时间（秒）
func (s *Store) SetInt64(key string, value int64, seconds ...int) error {
	return s.SetString(key, convert.ToString(value), seconds...)
}

// GetBytes 返回给定key所关联的[]byte值
func (s *Store) GetBytes(key string) ([]byte, error) {
	value, err := s.Get(key)
	if err != nil {
		return nil, err
	}

	return []byte(value), nil
}

// GetDel 返回并删除给定key所关联的string值
func (s *Store) GetDel(key string) (string, error) {
	resp, err := s.Eval(getAndDelScript, key)
	if err != nil {
		return "", errors.Wrap(err, "eval script err")
	}

	return convert.ToString(resp), nil
}

// SetString 将string value关联到给定key，seconds为key的过期时间（秒）
func (s *Store) SetString(key, value string, seconds ...int) error {
	if len(seconds) != 0 {
		return errors.Wrapf(s.Setex(key, value, seconds[0]), "setex by seconds = %v err", seconds[0])
	}

	return errors.Wrap(s.Set(key, value), "set err")
}

// Read 将给定key所关联的值反序列化到obj对象
// 返回false时代表给定key不存在
func (s *Store) Read(key string, obj interface{}) (bool, error) {
	if !isValid(obj) {
		return false, errors.New("obj is invalid")
	}

	value, err := s.GetBytes(key)
	if err != nil {
		return false, errors.Wrap(err, "get bytes err")
	}
	if len(value) == 0 {
		return false, nil
	}

	err = json.Unmarshal(value, obj)
	if err != nil {
		return false, errors.Wrap(err, "json unmarshal value to obj err")
	}

	return true, nil
}

// Write 将对象obj序列化后关联到给定key，seconds为key的过期时间（秒）
func (s *Store) Write(key string, obj interface{}, seconds ...int) error {
	value, err := json.Marshal(obj)
	if err != nil {
		return errors.Wrap(err, "json marshal obj err")
	}

	return s.SetString(key, string(value), seconds...)
}

// GetFunc 给定key不存在时调用的数据获取函数
type GetFunc func() (interface{}, error)

// ReadOrGet 将给定key所关联的值反序列化到obj对象
// 若给定key不存在则调用数据获取函数，调用成功时赋值至obj对象
// 并将其序列化后关联到给定key，seconds为key的过期时间（秒）
func (s *Store) ReadOrGet(key string, obj interface{}, gf GetFunc, seconds ...int) error {
	isExist, err := s.Read(key, obj)
	if err != nil {
		return errors.Wrap(err, "read obj by err")
	}

	if !isExist {
		data, err := gf()
		if err != nil {
			return err
		}

		if !isValid(data) {
			return errors.New("get data is invalid")
		}

		ov, dv := reflect.ValueOf(obj).Elem(), reflect.ValueOf(data).Elem()
		if ov.Type() != dv.Type() {
			return errors.New("obj type and get data type are not equal")
		}
		ov.Set(dv)

		_ = s.Write(key, data, seconds...)
	}

	return nil
}

// isValid 判断对象是否合法
func isValid(obj interface{}) bool {
	if obj == nil {
		return false
	}

	if reflect.ValueOf(obj).Kind() != reflect.Ptr {
		return false
	}

	return true
}
