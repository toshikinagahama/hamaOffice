package config

import (
	"fmt"
	"log"
	"strings"

	"github.com/spf13/viper"
)

// マッピング用の構造体
type Config struct {
	Version     string `yaml:"version"`
	DBUser      string `yaml:"dbuser"`
	DBPassword  string `yaml:"dbpassword"`
	DBName      string `yaml:"dbname"`
	DBHost      string `yaml:"dbhost"`
	DBPort      uint   `yaml:"dbport"`
	SercretKey  string `yaml:"sercretkey"`
	StaticPath  string `yaml:"staticpath"`
	BasePath    string `yaml:"basepath"`
	Environment uint   `yaml:"environment"`
}

func Load() (*Config, error) {
	viper.SetConfigName("config")                          // 設定ファイル名を指定
	viper.SetConfigType("yaml")                            // 設定ファイルの形式を指定
	viper.AddConfigPath("config/environments/")            // ファイルのpathを指定
	viper.AutomaticEnv()                                   //環境変数の読み込み
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_")) //プリフィックスの設定
	err := viper.ReadInConfig()                            // 設定ファイルを探索して読み取る
	if err != nil {
		return nil, fmt.Errorf("failed to load config file- %s", err)
	}
	var cfg Config
	err = viper.Unmarshal(&cfg)
	if err != nil {
		return nil, fmt.Errorf("unmarshal error- %s", err)
	}
	log.Println(cfg.DBUser)
	return &cfg, nil
}
