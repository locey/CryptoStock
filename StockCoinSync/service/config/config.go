package config

import (
	"strings"

	"github.com/spf13/viper"

	logging "github.com/locey/CryptoStock/StockCoinBase/logger"
	"github.com/locey/CryptoStock/StockCoinBase/stores/gdb"
)

type Config struct {
	Monitor     *Monitor         `toml:"monitor" mapstructure:"monitor" json:"monitor"`
	Log         *logging.LogConf `toml:"log" mapstructure:"log" json:"log"`
	Kv          *KvConf          `toml:"kv" mapstructure:"kv" json:"kv"`
	DB          *gdb.Config      `toml:"db" mapstructure:"db" json:"db"`
	AnkrCfg     AnkrCfg          `toml:"ankr_cfg" mapstructure:"ankr_cfg" json:"ankr_cfg"`
	ChainCfg    ChainCfg         `toml:"chain_cfg" mapstructure:"chain_cfg" json:"chain_cfg"`
	ContractCfg ContractCfg      `toml:"contract_cfg" mapstructure:"contract_cfg" json:"contract_cfg"`
	ProjectCfg  ProjectCfg       `toml:"project_cfg" mapstructure:"project_cfg" json:"project_cfg"`
}

type ChainCfg struct {
	Name string `toml:"name" mapstructure:"name" json:"name"`
	ID   int64  `toml:"id" mapstructure:"id" json:"id"`
}

type ContractCfg struct {
	EthAddress  string `toml:"eth_address" mapstructure:"eth_address" json:"eth_address"`
	WethAddress string `toml:"weth_address" mapstructure:"weth_address" json:"weth_address"`
	DexAddress  string `toml:"dex_address" mapstructure:"dex_address" json:"dex_address"`
}

type Monitor struct {
	PprofEnable bool  `toml:"pprof_enable" mapstructure:"pprof_enable" json:"pprof_enable"`
	PprofPort   int64 `toml:"pprof_port" mapstructure:"pprof_port" json:"pprof_port"`
}

type AnkrCfg struct {
	ApiKey       string `toml:"api_key" mapstructure:"api_key" json:"api_key"`
	HttpsUrl     string `toml:"https_url" mapstructure:"https_url" json:"https_url"`
	WebsocketUrl string `toml:"websocket_url" mapstructure:"websocket_url" json:"websocket_url"`
	EnableWss    bool   `toml:"enable_wss" mapstructure:"enable_wss" json:"enable_wss"`
}

type ProjectCfg struct {
	Name string `toml:"name" mapstructure:"name" json:"name"`
}

type KvConf struct {
	Redis []*Redis `toml:"redis" json:"redis"`
}

type Redis struct {
	Host string `toml:"host" json:"host"`
	Type string `toml:"type" json:"type"`
	Pass string `toml:"pass" json:"pass"`
}

type LogLevel struct {
	Api      string `toml:"api" json:"api"`
	DataBase string `toml:"db" json:"db"`
	Utils    string `toml:"utils" json:"utils"`
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

	var c Config
	if err := viper.Unmarshal(&c); err != nil {
		return nil, err
	}

	return &c, nil
}

// UnmarshalCmdConfig unmarshal conifg file
// @params path: the path of config dir
func UnmarshalCmdConfig() (*Config, error) {
	if err := viper.ReadInConfig(); err != nil {
		return nil, err
	}

	var c Config

	if err := viper.Unmarshal(&c); err != nil {
		return nil, err
	}

	return &c, nil
}
