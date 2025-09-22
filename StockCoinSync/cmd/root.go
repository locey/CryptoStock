package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/mitchellh/go-homedir"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "sync",
	Short: "root server.",
	Long:  `root server.`,
	// Uncomment the following line if your bare application
	// has an action associated with it:
	// Run: func(cmd *cobra.Command, args []string) { },
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}

	fmt.Println("cfgFile=", cfgFile)
}

func init() {
	// 设置initConfig在调用rootCmd的Execute()方法时运行
	cobra.OnInitialize(initConfig)
	flags := rootCmd.PersistentFlags()
	flags.StringVarP(&cfgFile, "config", "c", "./config/config_import.toml", "config file (default is $HOME/.config_import.toml)")
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// 从flag中获取配置文件
		viper.SetConfigFile(cfgFile)
	} else {
		// 主目录 /Users/$HOME$
		home, err := homedir.Dir()
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}

		// 从主目录下搜索后缀名为 ".toml" 文件 (without extension).
		viper.AddConfigPath(home)
		viper.SetConfigName("config_import")
	}
	viper.AutomaticEnv() // 读取匹配的环境变量
	viper.SetConfigType("toml")
	viper.SetEnvPrefix("EasySwap")
	replacer := strings.NewReplacer(".", "_")
	viper.SetEnvKeyReplacer(replacer)
	// 读取找到的配置文件
	if err := viper.ReadInConfig(); err == nil {
		fmt.Println("Using config file:", viper.ConfigFileUsed())
	} else {
		panic(err)
	}

}
