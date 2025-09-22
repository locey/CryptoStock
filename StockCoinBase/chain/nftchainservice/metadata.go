package nftchainservice

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/pkg/errors"
	"go.uber.org/zap"

	"github.com/locey/CryptoStock/StockCoinBase/logger/xzap"
)

const fetchIPFSTimeout = 30 * time.Second

var (
	hosts = []string{"https://ipfs.io/ipfs/", "https://cf-ipfs.com/ipfs/", "https://infura-ipfs.io/ipfs/", "https://cloudflare-ipfs.com/ipfs/"}
)

type nftInfoSimple struct {
	Name         string `json:"name"`
	Image        string `json:"image"`
	Description  string `json:"description"`
	ExternalLink string `json:"external_link"`
	Attributes   interface{}
}

func (s *Service) fetchNftMetadata(collectionAddr string, tokenID string) ([]byte, string, error) {
	beginTime := time.Now()

	xzap.WithContext(s.ctx).Info("fetch nft metadata start",
		zap.String("collection_addr", collectionAddr), zap.String("token_id", tokenID), zap.Time("start", beginTime))
	defer func() {
		xzap.WithContext(s.ctx).Info("fetch nft metadata end", zap.String("collection_addr", collectionAddr), zap.String("token_id", tokenID), zap.Float64("take", time.Now().Sub(beginTime).Seconds()))
	}()

	tokenId, _ := big.NewInt(0).SetString(tokenID, 10)
	tokenURIReqData, err := s.Abi.Pack("tokenURI", tokenId)
	if err != nil {
		return nil, "", errors.Wrap(err, fmt.Sprintf("failed on pack token uri %s", tokenID))
	}

	to := common.HexToAddress(collectionAddr)
	respData, err := s.NodeClient.CallContract(s.ctx, ethereum.CallMsg{To: &to, Data: tokenURIReqData}, nil)
	if err != nil {
		return nil, "", errors.Wrap(err, "failed on request token uri")
	}

	res, err := s.Abi.Unpack("tokenURI", respData)
	if err != nil {
		return nil, "", errors.Wrap(err, "failed on unpack token uri")
	}

	tokenUri := res[0].(string)
	var body []byte
	if len(tokenUri) > 29 && tokenUri[0:29] == "data:application/json;base64," {
		body, err = base64.StdEncoding.DecodeString(tokenUri[29:])
		if err != nil {
			return nil, "", errors.Wrap(err, fmt.Sprintf("failed on decode token uri: %s", tokenUri))
		}
	} else if len(tokenUri) > 5 && tokenUri[0:5] == "ipfs:" {
		body, err = s.fetchIpfsData(tokenUri)
		if err != nil {
			return nil, "", errors.Wrap(err, fmt.Sprintf("failed on fetch token uri: %s", tokenUri))
		}
	} else if len(tokenUri) > 5 && tokenUri[0:4] != "http" {
		return nil, "", errors.New(fmt.Sprintf("invalid url %s", tokenUri))
	}

	if len(tokenUri) > 5 && tokenUri[0:4] == "http" {
		body, err = s.fetchJsonData(tokenUri)
		if err != nil {
			return nil, "", errors.Wrap(err, fmt.Sprintf("failed on fetch metadata. uri:%s", tokenUri))
		}
	}

	if body != nil {
		body = bytes.TrimPrefix(body, []byte("\xef\xbb\xbf"))
		return body, tokenUri, nil
	}

	return nil, "", errors.New("empty metadata")
}

func (s *Service) FetchNftOwner(collectionAddr string, tokenID string) (common.Address, error) {
	beginTime := time.Now()

	xzap.WithContext(s.ctx).Info("fetch nft owner start",
		zap.String("collection_addr", collectionAddr), zap.String("token_id", tokenID), zap.Time("start", beginTime))
	defer func() {
		xzap.WithContext(s.ctx).Info("fetch nft owner end", zap.String("collection_addr", collectionAddr), zap.String("token_id", tokenID), zap.Float64("take", time.Now().Sub(beginTime).Seconds()))
	}()

	tokenId, _ := big.NewInt(0).SetString(tokenID, 10)
	tokenOwnerReqData, err := s.Abi.Pack("ownerOf", tokenId)
	if err != nil {
		return common.Address{}, errors.Wrap(err, fmt.Sprintf("failed on pack token uri %s", tokenID))
	}

	to := common.HexToAddress(collectionAddr)
	respData, err := s.NodeClient.CallContract(s.ctx, ethereum.CallMsg{To: &to, Data: tokenOwnerReqData}, nil)
	if err != nil {
		return common.Address{}, errors.Wrap(err, "failed on request token uri")
	}

	res, err := s.Abi.Unpack("ownerOf", respData)
	if err != nil {
		return common.Address{}, errors.Wrap(err, "failed on unpack token uri")
	}

	address := *abi.ConvertType(res[0], new(common.Address)).(*common.Address)
	return address, nil
}

func (s *Service) fetchIpfsData(tokenUri string) ([]byte, error) {
	finished := make(chan []byte)
	ticker := time.NewTicker(fetchIPFSTimeout)
	var cancelFns []context.CancelFunc
	for i := range hosts {
		host := hosts[i]
		fullUrl := strings.Replace(tokenUri, "ipfs://", host, 1)
		ctx, cancel := context.WithCancel(context.Background())
		cancelFns = append(cancelFns, cancel)
		go func() {
			req, err := http.NewRequestWithContext(ctx, "GET", fullUrl, nil)
			if err != nil {
				xzap.WithContext(s.ctx).Error("failed on create fetch ipfs data req",
					zap.String("token_uri", tokenUri), zap.Error(err))
				return
			}

			resp, err := s.HttpClient.Do(req)
			if err != nil {
				xzap.WithContext(s.ctx).Error("failed on fetch metadata from ipfs",
					zap.String("token_uri", tokenUri), zap.Error(err))
				return
			}

			if resp.StatusCode == http.StatusOK {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					xzap.WithContext(s.ctx).Error("failed on read ipfs req resp body",
						zap.String("token_uri", tokenUri), zap.Error(err))
					return
				}

				finished <- body
			}
		}()
	}

	select {
	case data := <-finished:
		for i := range cancelFns {
			cancelFns[i]()
		}

		return data, nil
	case <-ticker.C:
		return nil, errors.New("request metadata timeout: " + tokenUri)
	}
}

func (s *Service) fetchJsonData(tokenUri string) (body []byte, err error) {
	resp, err := s.HttpClient.Get(tokenUri)
	if err != nil {
		return nil, errors.Wrap(err, "failed on get metadata from http")
	}

	if resp.StatusCode == http.StatusOK {
		body, err = io.ReadAll(resp.Body)
		if err != nil {
			return nil, errors.Wrap(err, "failed on read resp body")
		}

		if strings.Contains(tokenUri, "squid-app-o5c27.ondigitalocean") {
			tmpData := struct {
				Msg  string        `json:"msg"`
				Data nftInfoSimple `json:"data"`
			}{}
			if err := json.Unmarshal(body, &tmpData); err != nil {
				return nil, errors.Wrap(err, "failed on unmarshal raw metadata")
			}

			if tmpData.Data.Name != "" {
				body, err = json.Marshal(tmpData.Data)
				if err != nil {
					return nil, errors.Wrap(err, "failed on marshal raw metadata")
				}
			}
		}
	}

	return body, err
}

func (s *Service) FetchOnChainMetadata(collectionAddr string, tokenID string) (*JsonMetadata, error) {
	rawData, tokenUri, err := s.fetchNftMetadata(collectionAddr, tokenID)
	if err != nil {
		return nil, errors.Wrap(err, "failed on fetch nft metadata")
	}

	if len(rawData) == 0 {
		return nil, errors.New("metadata length is zero")
	}

	metadata, err := DecodeJsonMetadata(rawData, tokenUri, s.NameTags, s.ImageTags, s.AttributesTags, s.TraitNameTags, s.TraitValueTags)
	if err != nil {
		return nil, errors.Wrap(err, "failed on decode metadata")
	}

	return metadata, nil
}

// DecodeJsonMetadata parses the NFT token Metadata JSON.
func DecodeJsonMetadata(content []byte, tokenUri string, nameTags, imageTags, attributesTags, traitNameTags, traitValueTags []string) (*JsonMetadata, error) {
	_, err := url.Parse(string(content))
	if err == nil {
		return &JsonMetadata{
			Image: string(content),
		}, nil
	}

	if isImageFile(content) {
		return &JsonMetadata{
			Image: tokenUri,
		}, nil
	}

	if isTextFile(content) {
		metadatas := make(map[string]interface{})
		err := json.Unmarshal(content, &metadatas)
		if err != nil {
			return nil, errors.Wrap(err, "failed on unmarshal raw metadata")
		}

		var metadata JsonMetadata
		// parse name field
		for _, tag := range nameTags {
			v, ok := metadatas[tag]
			if ok {
				sname, ok := v.(string)
				if ok {
					metadata.Name = sname
				}

				fname, ok := v.(float64)
				if ok {
					metadata.Name = strconv.FormatFloat(fname, 'f', -1, 64)
				}

				if metadata.Name != "" {
					break
				}
			}
		}
		// parse image field
		for _, tag := range imageTags {
			v, ok := metadatas[tag]
			if ok {
				simage, ok := v.(string)
				if ok {
					metadata.Image = simage
				}
				if metadata.Image != "" {
					break
				}
			}
		}
		// parse attributes field
		for _, tag := range attributesTags {
			rawAttributes, ok := metadatas[tag]
			if ok {
				attributesArray, ok := rawAttributes.(map[string]interface{})
				if ok {
					for k, v := range attributesArray {
						var value string
						svalue, ok := v.(string)
						if ok {
							value = svalue
						}
						fvalue, ok := v.(float64)
						if ok {
							value = strconv.FormatFloat(fvalue, 'f', -1, 64)
						}

						metadata.Attributes = append(metadata.Attributes, &OpenseaMetadataProps{
							TraitType: k,
							Value:     value,
						})
					}
					break
				}

				attributesArrays, ok := rawAttributes.([]interface{})
				if ok {
					for _, attributes := range attributesArrays {
						attributesMap, ok := attributes.(map[string]interface{})
						if !ok {
							break
						}
						var trait string
						for _, tag := range traitNameTags {
							v, ok := attributesMap[tag]
							if ok {
								strait, ok := v.(string)
								if ok {
									trait = strait
								}
								ftrait, ok := v.(float64)
								if ok {
									trait = strconv.FormatFloat(ftrait, 'f', -1, 64)
								}

								break
							}
						}
						var value string
						for _, tag := range traitValueTags {
							v, ok := attributesMap[tag]
							if ok {
								svalue, ok := v.(string)
								if ok {
									value = svalue
								}
								fvalue, ok := v.(float64)
								if ok {
									value = strconv.FormatFloat(fvalue, 'f', -1, 64)
								}

								break
							}
						}
						if trait != "" && value != "" {
							metadata.Attributes = append(metadata.Attributes, &OpenseaMetadataProps{
								TraitType: trait,
								Value:     value,
							})
						}
					}
					break
				}
			}
		}
		return &metadata, nil
	}

	return nil, errors.New(fmt.Sprintf("unsupported content type:%s", string(content)))
}

// isTextFile returns true if file content format is plain text or empty.
func isTextFile(data []byte) bool {
	if len(data) == 0 {
		return true
	}
	return strings.Contains(http.DetectContentType(data), "text/")
}

func isImageFile(data []byte) bool {
	return strings.Contains(http.DetectContentType(data), "image/")
}

func isVideoFile(data []byte) bool {
	return strings.Contains(http.DetectContentType(data), "video/")
}
