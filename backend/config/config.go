package config

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/spf13/viper"
)

// マッピング用の構造体
type Config struct {
	Version     string `yaml:"version"`
	Port        uint   `yaml:"port"`
	DBPath      string `yaml:"dbpath"`
	SercretKey  string `yaml:"sercretkey"`
	StaticPath  string `yaml:"staticpath"`
	BasePath    string `yaml:"basepath"`
	Environment uint   `yaml:"environment"`

	// TURN (coturn REST API / use-auth-secret 方式) 用設定。
	TurnSecret string   `yaml:"turnsecret"`
	TurnRealm  string   `yaml:"turnrealm"`
	TurnURLs   []string `yaml:"turnurls"`

	// 両方指定されていれば TLS で起動する(開発時に getUserMedia の
	// Secure Context 制約を LAN 内で満たすため等)。
	TLSCertFile string `yaml:"tlscertfile"`
	TLSKeyFile  string `yaml:"tlskeyfile"`
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

	// TurnURLs はスライスなので AutomaticEnv 経由では来ない。
	// カンマ区切りの環境変数で上書きできるようにしておく。
	if v := os.Getenv("TURNURLS"); v != "" {
		cfg.TurnURLs = strings.Split(v, ",")
	}

	log.Println(cfg.DBPath)
	return &cfg, nil
}
