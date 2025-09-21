package service

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/locey/CryptoStock/StockCoinBase/errcode"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb/orderbookmodel/base"
	"github.com/pkg/errors"

	"github.com/locey/CryptoStock/StockCoinEnd/api/middleware"
	"github.com/locey/CryptoStock/StockCoinEnd/service/svc"
	"github.com/locey/CryptoStock/StockCoinEnd/types/v1"
)

func getUserLoginMsgCacheKey(address string) string {
	return middleware.CR_LOGIN_MSG_KEY + ":" + strings.ToLower(address)
}

func getUserLoginTokenCacheKey(address string) string {
	return middleware.CR_LOGIN_KEY + ":" + strings.ToLower(address)
}

func UserLogin(ctx context.Context, svcCtx *svc.ServerCtx, req types.LoginReq) (*types.UserLoginInfo, error) {
	// 返回结果
	res := types.UserLoginInfo{}

	//todo: add verify signature
	//ok := verifySignature(req.Message, req.Signature, req.PublicKey)
	//if !ok {
	//	return nil, errors.New("invalid signature")
	//}

	// 从缓存中获取登录消息UUID
	cachedUUID, err := svcCtx.KvStore.Get(getUserLoginMsgCacheKey(req.Address))
	if cachedUUID == "" || err != nil {
		return nil, errcode.ErrTokenExpire
	}

	// 分割消息获取UUID
	splits := strings.Split(req.Message, "Nonce:")
	if len(splits) != 2 {
		return nil, errcode.ErrTokenExpire
	}

	// 获取登录UUID并验证
	loginUUID := strings.Trim(splits[1], "\n")
	if loginUUID != cachedUUID {
		return nil, errcode.ErrTokenExpire
	}

	// 查询用户信息
	var user base.User
	db := svcCtx.DB.WithContext(ctx).Table(base.UserTableName()).
		Select("id,address,is_allowed").
		Where("address = ?", req.Address).
		Find(&user)
	if db.Error != nil {
		return nil, errors.Wrap(db.Error, "failed on get user info")
	}

	// 如果用户不存在则创建新用户
	if user.Id == 0 {
		now := time.Now().UnixMilli()
		user := &base.User{
			Address:    req.Address,
			IsAllowed:  false,
			IsSigned:   true,
			CreateTime: now,
			UpdateTime: now,
		}
		if err := svcCtx.DB.WithContext(ctx).Table(base.UserTableName()).
			Create(user).Error; err != nil {
			return nil, errors.Wrap(db.Error, "failed on create new user")
		}
	}

	// 生成用户token
	tokenKey := getUserLoginTokenCacheKey(req.Address)
	userToken, err := AesEncryptOFB([]byte(tokenKey), []byte(middleware.CR_LOGIN_SALT))
	if err != nil {
		return nil, errors.Wrap(err, "failed on get user token")
	}

	// 缓存用户token
	if err := CacheUserToken(svcCtx, tokenKey, uuid.NewString()); err != nil {
		return nil, err
	}

	// 设置返回结果
	res.Token = hex.EncodeToString(userToken)
	res.IsAllowed = user.IsAllowed

	return &res, err
}

// 把token写入redis
func CacheUserToken(svcCtx *svc.ServerCtx, tokenKey, token string) error {
	if err := svcCtx.KvStore.Setex(tokenKey, token, 30*24*60*60); err != nil {
		return err
	}

	return nil
}

func AesEncryptOFB(data []byte, key []byte) ([]byte, error) {
	data = PKCS7Padding(data, aes.BlockSize)
	block, _ := aes.NewCipher([]byte(key))
	out := make([]byte, aes.BlockSize+len(data))
	iv := out[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, err
	}

	stream := cipher.NewOFB(block, iv)
	stream.XORKeyStream(out[aes.BlockSize:], data)
	return out, nil
}

// 补码
// AES加密数据块分组长度必须为128bit(byte[16])，密钥长度可以是128bit(byte[16])、192bit(byte[24])、256bit(byte[32])中的任意一个。
func PKCS7Padding(ciphertext []byte, blocksize int) []byte {
	padding := blocksize - len(ciphertext)%blocksize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}

func genLoginTemplate(nonce string) string {
	return fmt.Sprintf("Welcome to EasySwap!\nNonce:%s", nonce)
}

func GetUserLoginMsg(ctx context.Context, svcCtx *svc.ServerCtx, address string) (*types.UserLoginMsgResp, error) {
	uuid := uuid.NewString()
	loginMsg := genLoginTemplate(uuid)
	if err := svcCtx.KvStore.Setex(getUserLoginMsgCacheKey(address), uuid, 72*60*60); err != nil {
		return nil, errors.Wrap(err, "failed on generate login msg")
	}

	return &types.UserLoginMsgResp{Address: address, Message: loginMsg}, nil
}

func GetSigStatusMsg(ctx context.Context, svcCtx *svc.ServerCtx, userAddr string) (*types.UserSignStatusResp, error) {
	isSigned, err := svcCtx.Dao.GetUserSigStatus(ctx, userAddr)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get user sign status")
	}

	return &types.UserSignStatusResp{IsSigned: isSigned}, nil
}
