package xkv

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/zeromicro/go-zero/core/stores/cache"
	"github.com/zeromicro/go-zero/core/stores/redis"
)

func TestStore(t *testing.T) {
	c := []cache.NodeConf{
		{
			RedisConf: redis.RedisConf{
				Host: "localhost:6379",
				Type: "node",
			},
			Weight: 100,
		},
	}

	type testObj struct {
		Id   int64  `json:"id"`
		Name string `json:"name"`
	}

	s := NewStore(c)

	testKey1 := "cache:test:test_store:id:1"
	t1 := &testObj{Id: 1, Name: "testName"}
	err := s.Write(testKey1, t1)
	assert.NoError(t, err)

	t2 := &testObj{}
	isExist, err := s.Read(testKey1, t2)
	assert.NoError(t, err)
	assert.True(t, isExist)
	t.Log(t2)

	_, err = s.Del(testKey1)
	assert.NoError(t, err)

	testKey2 := "cache:test:test_store:id:2"
	t3 := &testObj{}
	f1 := func() (interface{}, error) {
		return &testObj{Id: 2, Name: "testName2"}, nil
	}
	err = s.ReadOrGet(testKey2, t3, f1)
	assert.NoError(t, err)
	t.Log(t3)

	_, err = s.Del(testKey2)
	assert.NoError(t, err)

	testKey3 := "cache:test:test_store:id:3"
	t4 := make(map[string]*testObj)
	f2 := func() (interface{}, error) {
		m := make(map[string]*testObj)
		m["1"] = &testObj{Id: 1, Name: "1"}
		m["2"] = &testObj{Id: 2, Name: "2"}
		m["3"] = &testObj{Id: 3, Name: "3"}
		return &m, nil
	}
	err = s.ReadOrGet(testKey3, &t4, f2)
	assert.NoError(t, err)
	t.Log(t4)

	_, err = s.Del(testKey3)
	assert.NoError(t, err)

	testKey4 := "cache:test:test_store:id:4"
	err = s.SetString(testKey4, "test")
	assert.NoError(t, err)

	v, err := s.GetDel(testKey4)
	assert.NoError(t, err)
	assert.Equal(t, "test", v)

	isExist, err = s.Exists(testKey4)
	assert.NoError(t, err)
	assert.False(t, isExist)
}

func TestRedis(t *testing.T) {
	c := []cache.NodeConf{
		{
			RedisConf: redis.RedisConf{
				Host: "localhost:6379",
				Type: "node",
			},
			Weight: 100,
		},
	}

	store := NewStore(c)
	_, err := store.Lpush("cache:a", "a")
	assert.Nil(t, err)
	_, err = store.Lpush("cache:a", "b")
	assert.Nil(t, err)
	err = store.Redis.Ltrim("cache:a", 1, 0)
	assert.Nil(t, err)
}
