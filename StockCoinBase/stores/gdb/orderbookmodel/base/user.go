package base

type User struct {
	Id         int64  `gorm:"column:id;AUTO_INCREMENT;primary_key" json:"id"`         // 主键
	Address    string `gorm:"column:address;NOT NULL" json:"address"`                 // 用户地址
	IsAllowed  bool   `gorm:"column:is_allowed;default:0;NOT NULL" json:"is_allowed"` // 是否允许用户访问
	IsSigned   bool   `gorm:"column:is_signed;default:0" json:"is_signed"`
	CreateTime int64  `json:"create_time" gorm:"column:create_time;type:bigint(20);autoCreateTime:milli;comment:创建时间"` // 创建时间
	UpdateTime int64  `json:"update_time" gorm:"column:update_time;type:bigint(20);autoUpdateTime:milli;comment:更新时间"` // 更新时间
}

func UserTableName() string {
	return "ob_user"
}
