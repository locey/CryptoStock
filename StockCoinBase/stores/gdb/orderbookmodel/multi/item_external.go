package multi

import "fmt"

const (
	// status
	OK                  = 0
	WaitingRefresh      = 1
	FetchMetadataFailed = 2
	FetchImageFailed    = 3
	Base64Image         = 4
	HttpUpload          = 5
	IpfsUpload          = 6
	IpfsUploadRetry     = 7
)

type ItemExternal struct {
	ID                int64  `gorm:"column:id" json:"id"` //  主键
	CollectionAddress string `gorm:"column:collection_address" json:"collection_address"`
	TokenId           string `gorm:"column:token_id" json:"token_id"`
	IsUploadedOss     bool   `gorm:"column:is_uploaded_oss;default:0" json:"is_uploaded_oss"`      // 是否已上传oss(0:未上传,1:已上传)
	UploadStatus      int32  `gorm:"column:upload_status;default:0;NOT NULL" json:"upload_status"` // 上传oss是否失败
	MetaDataUri       string `gorm:"column:meta_data_uri" json:"meta_data_uri"`                    //  元数据地址
	ImageUri          string `gorm:"column:image_uri" json:"image_uri"`
	OssUri            string `gorm:"column:oss_uri" json:"oss_uri"`                               //  图片地址
	IsVideoUploaded   bool   `gorm:"column:is_video_uploaded;default:0" json:"is_video_uploaded"` // video是否已上传oss(0:未上传,1:已上传)
	VideoUploadStatus int32  `gorm:"column:video_upload_status;default:0;NOT NULL" json:"video_upload_status"`
	VideoType         string `gorm:"column:video_type" json:"video_type"`
	VideoUri          string `gorm:"column:video_uri" json:"video_uri"`
	VideoOssUri       string `gorm:"column:video_oss_uri" json:"video_oss_uri"`
	CreateTime        int64  `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime        int64  `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func ItemExternalTableName(chainName string) string {
	return fmt.Sprintf("ob_item_external_%s", chainName)
}
