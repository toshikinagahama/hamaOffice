package router

import (
	"hamaoffice/config"
	"hamaoffice/handler"
	"hamaoffice/model"
	"log"

	"github.com/labstack/echo"
	"github.com/labstack/echo/middleware"
)

func NewRouter() (*echo.Echo, error) {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log.Println(cfg.StaticPath)

	router := echo.New()
	router.Use(middleware.Logger())
	router.Use(middleware.Recover())
	if cfg.Environment == 1 {
		//本番環境なら
		router.Static(cfg.BasePath+"/web", cfg.StaticPath)
		router.File(cfg.BasePath+"/web", cfg.StaticPath+"/index.html")
		router.File(cfg.BasePath+"/web/user", cfg.StaticPath+"/user.html")
		router.File(cfg.BasePath+"/web/room/*", cfg.StaticPath+"/room/[id].html")
		router.File(cfg.BasePath+"/web/create_room", cfg.StaticPath+"/create_room.html")
		router.File(cfg.BasePath+"/web/signup", cfg.StaticPath+"/signup.html")
		router.File(cfg.BasePath+"/web/user_setting", cfg.StaticPath+"/user_setting.html")
	} else if cfg.Environment == 0 {
		//開発環境なら
		router.Use(middleware.CORS())
	}

	router.GET(cfg.BasePath+"/backend/ws", handler.Websocket)

	router.POST(cfg.BasePath+"/backend/login", handler.Login)
	router.POST(cfg.BasePath+"/backend/signup", handler.Signup)
	router_group := router.Group(cfg.BasePath + "/backend/restricted")

	jwt_config := middleware.JWTConfig{
		Claims:     &model.JwtCustomClaims{},
		SigningKey: []byte(cfg.SercretKey),
	}

	router_group.Use(middleware.JWTWithConfig(jwt_config))
	router_group.GET("/auth_user", handler.GetAuthenticatedUser)
	router_group.POST("/get_roomusers", handler.GetRoomUsers)
	router_group.POST("/get_rooms", handler.GetRooms)
	router_group.POST("/get_messages", handler.GetMessages)
	router_group.POST("/create_room", handler.CreateRoom)
	router_group.POST("/create_invite", handler.CreateInvite)
	router_group.POST("/join_room", handler.JoinRoom)
	router_group.POST("/update_user", handler.UpdateUser)
	router_group.GET("/turn_credential", handler.TurnCredential)

	return router, nil
}
