package config

import (
	"strings"

	//"github.com/locey/CryptoStock/StockCoinBase/evm/erc"
	//"github.com/locey/CryptoStock/StockCoinBase/image"
	logging "github.com/locey/CryptoStock/StockCoinBase/logger"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb"
	"github.com/spf13/viper"
)

type Config struct {
	Api        `toml:"api" json:"api"`
	ProjectCfg *ProjectCfg     `toml:"project_cfg" mapstructure:"project_cfg" json:"project_cfg"`
	Log        logging.LogConf `toml:"log" json:"log"`
	//ImageCfg       *image.Config     `toml:"image_cfg" mapstructure:"image_cfg" json:"image_cfg"`
	DB gdb.Config `toml:"db" json:"db"`
	Kv *KvConf    `toml:"kv" json:"kv"`
	//Evm            *erc.NftErc       `toml:"evm" json:"evm"`
	MetadataParse  *MetadataParse    `toml:"metadata_parse" mapstructure:"metadata_parse" json:"metadata_parse"`
	ChainSupported []*ChainSupported `toml:"chain_supported" mapstructure:"chain_supported" json:"chain_supported"`
}

type ProjectCfg struct {
	Name string `toml:"name" mapstructure:"name" json:"name"`
}

type Api struct {
	Port   string `toml:"port" json:"port"`
	MaxNum int64  `toml:"max_num" json:"max_num"`
}

type KvConf struct {
	Redis []*Redis `toml:"redis" mapstructure:"redis" json:"redis"`
}

type Redis struct {
	MasterName string `toml:"master_name" mapstructure:"master_name" json:"master_name"`
	Host       string `toml:"host" json:"host"`
	Type       string `toml:"type" json:"type"`
	Pass       string `toml:"pass" json:"pass"`
}

type MetadataParse struct {
	NameTags       []string `toml:"name_tags" mapstructure:"name_tags" json:"name_tags"`
	ImageTags      []string `toml:"image_tags" mapstructure:"image_tags" json:"image_tags"`
	AttributesTags []string `toml:"attributes_tags" mapstructure:"attributes_tags" json:"attributes_tags"`
	TraitNameTags  []string `toml:"trait_name_tags" mapstructure:"trait_name_tags" json:"trait_name_tags"`
	TraitValueTags []string `toml:"trait_value_tags" mapstructure:"trait_value_tags" json:"trait_value_tags"`
}

type ChainSupported struct {
	Name     string `toml:"name" mapstructure:"name" json:"name"`
	ChainID  int    `toml:"chain_id" mapstructure:"chain_id" json:"chain_id"`
	Endpoint string `toml:"endpoint" mapstructure:"endpoint" json:"endpoint"`
}

// UnmarshalConfig unmarshal conifg file
// @params path: the path of config dir
func UnmarshalConfig(configFilePath string) (*Config, error) {
	viper.SetConfigFile(configFilePath)
	viper.SetConfigType("toml")
	viper.AutomaticEnv()
	viper.SetEnvPrefix("CNFT")
	replacer := strings.NewReplacer(".", "_")
	viper.SetEnvKeyReplacer(replacer)

	if err := viper.ReadInConfig(); err != nil {
		return nil, err
	}
	config, err := DefaultConfig()
	if err != nil {
		return nil, err
	}

	if err := viper.Unmarshal(config); err != nil {
		return nil, err
	}
	return config, nil
}

func DefaultConfig() (*Config, error) {
	return &Config{}, nil
}
