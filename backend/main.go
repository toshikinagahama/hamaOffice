package main

import (
	"fmt"
	"hamaoffice/config"
	"hamaoffice/database"
	"hamaoffice/router"
	"log"
)

func main() {
	log.SetFlags(log.Flags() | log.Llongfile)
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}
	log.Println(cfg.Version)

	database.Init()
	defer database.Close()
	router, _ := router.NewRouter()
	addr := fmt.Sprintf(":%d", cfg.Port)
	if cfg.TLSCertFile != "" && cfg.TLSKeyFile != "" {
		router.Logger.Fatal(router.StartTLS(addr, cfg.TLSCertFile, cfg.TLSKeyFile))
	} else {
		router.Logger.Fatal(router.Start(addr))
	}
}
