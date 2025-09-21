package utils

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
	"strings"

	"github.com/meshplus/bitxhub-kit/hexutil"

	"github.com/ethereum/go-ethereum/crypto"
)

func MetaSuffix(creator string, meta string) string {
	return creator + "-" + meta
}

func ItemOssKey(symbol string, tokenID uint64) string {
	return fmt.Sprintf("%s-%d", symbol, tokenID)
}

func UserOssKey(userName, userAddr string) string {
	return fmt.Sprintf("%s-%s", userName, userAddr)
}

func VerifySig(addr, sigHex string, digest []byte) bool {
	signature := hexutil.Decode(sigHex)
	if len(signature) != 65 {
		return false
	}
	if signature[64] != 27 && signature[64] != 28 {
		return false
	}
	signature[64] -= 27
	publicKeyBytes, err := crypto.Ecrecover(digest, signature)
	if err != nil {
		return false
	}
	publicKeyECDSA, err := crypto.UnmarshalPubkey(publicKeyBytes)
	if err != nil {
		return false
	}
	address := crypto.PubkeyToAddress(*publicKeyECDSA).Hex()
	if !strings.EqualFold(addr, address) {
		return false
	}

	signatureNoRecoverID := signature[:len(signature)-1] // remove recovery id
	return crypto.VerifySignature(publicKeyBytes, digest, signatureNoRecoverID)
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

func AesDecryptOFB(data []byte, key []byte) ([]byte, error) {
	block, _ := aes.NewCipher([]byte(key))
	iv := data[:aes.BlockSize]
	data = data[aes.BlockSize:]
	if len(data)%aes.BlockSize != 0 {
		return nil, fmt.Errorf("data is not a multiple of the block size")
	}

	out := make([]byte, len(data))
	mode := cipher.NewOFB(block, iv)
	mode.XORKeyStream(out, data)

	out = PKCS7UnPadding(out)
	return out, nil
}

// 补码
// AES加密数据块分组长度必须为128bit(byte[16])，密钥长度可以是128bit(byte[16])、192bit(byte[24])、256bit(byte[32])中的任意一个。
func PKCS7Padding(ciphertext []byte, blocksize int) []byte {
	padding := blocksize - len(ciphertext)%blocksize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}

// 去码
func PKCS7UnPadding(origData []byte) []byte {
	length := len(origData)
	unpadding := int(origData[length-1])
	return origData[:(length - unpadding)]
}
