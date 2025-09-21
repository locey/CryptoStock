package middleware

import (
	"bytes"
	"crypto/sha512"
	"encoding/gob"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/stores/xkv"
	"github.com/locey/CryptoStock/StockCoinBase/xhttp"
)

const CacheApiPrefix = "apicache:"

type responseCache struct {
	Status int
	Header http.Header
	Data   []byte
}

// CacheApi 是一个缓存中间件函数,用于缓存API响应数据
// 主要功能包括:
// 1. 接收一个 xkv.Store 存储实例和过期时间作为参数
// 2. 检查请求是否有缓存,如果有且状态码为200则直接返回缓存数据
// 3. 如果没有缓存,则继续处理请求
// 4. 请求处理完成后,如果响应状态码为200,则将响应数据缓存起来
func CacheApi(store *xkv.Store, expireSeconds int) gin.HandlerFunc {
	return func(c *gin.Context) {
		var data xhttp.Response
		// 创建响应体写入器用于获取响应内容
		bodyLogWriter := &BodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = bodyLogWriter

		// 生成缓存key
		cacheKey := CreateKey(c)
		if cacheKey == "" {
			xhttp.Error(c, errcode.NewCustomErr("cache error:no cache"))
			c.Abort()
		}

		// 尝试获取缓存数据
		cacheData, err := (*store).Get(cacheKey)
		if err == nil && cacheData != "" {
			cache := unserialize(cacheData)
			if cache != nil {
				// 如果有缓存,则直接返回缓存的响应
				bodyLogWriter.ResponseWriter.WriteHeader(cache.Status)
				for k, vals := range cache.Header {
					for _, v := range vals {
						bodyLogWriter.ResponseWriter.Header().Set(k, v)
					}
				}

				if err := json.Unmarshal(cache.Data, &data); err == nil {
					if data.Code == http.StatusOK {
						bodyLogWriter.ResponseWriter.Write(cache.Data)
						c.Abort()
					}
				}
			}
		}

		// 继续处理请求
		c.Next()

		// 获取响应数据
		responseBody := bodyLogWriter.body.Bytes()

		// 如果响应状态码为200,则缓存响应数据
		if err := json.Unmarshal(responseBody, &data); err == nil {
			if data.Code == http.StatusOK {
				storeCache := responseCache{
					Header: bodyLogWriter.Header().Clone(),
					Status: bodyLogWriter.ResponseWriter.Status(),
					Data:   responseBody,
				}
				store.SetnxEx(cacheKey, serialize(storeCache), expireSeconds)
			}
		}

	}
}

// CreateKey 生成缓存的key
// 主要功能:
// 1. 将路径、查询参数和请求体组合成缓存key
// 2. 如果key长度超过128,使用SHA512进行哈希
// 3. 添加缓存前缀并返回最终的key
func CreateKey(c *gin.Context) string {
	var buf bytes.Buffer
	tee := io.TeeReader(c.Request.Body, &buf)
	requestBody, _ := ioutil.ReadAll(tee)
	c.Request.Body = ioutil.NopCloser(&buf)

	path := c.Request.URL.Path
	query := c.Request.URL.RawQuery

	// 组合缓存key
	cacheKey := path + "," + query + string(requestBody)

	// 如果key太长则进行哈希
	if len(cacheKey) > 128 {
		hash := sha512.New() // 512/8*2
		hash.Write([]byte(cacheKey))
		cacheKey = string(hash.Sum([]byte("")))
		cacheKey = fmt.Sprintf("%x", cacheKey)
	}

	// 添加缓存前缀
	cacheKey = CacheApiPrefix + cacheKey
	return cacheKey
}

func serialize(cache responseCache) string {
	buf := new(bytes.Buffer)
	enc := gob.NewEncoder(buf)
	if err := enc.Encode(cache); err != nil {
		return ""
	} else {
		return buf.String()
	}
}

func unserialize(data string) *responseCache {
	var g1 = responseCache{}
	dec := gob.NewDecoder(bytes.NewBuffer([]byte(data)))
	if err := dec.Decode(&g1); err != nil {
		return nil
	} else {
		return &g1
	}
}
