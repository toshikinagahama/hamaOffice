package database

import (
	"hamaoffice/config"
	"hamaoffice/model"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var db *gorm.DB

const sampleMapData = `[{"x":0,"y":0,"w":800,"h":20},{"x":0,"y":0,"w":20,"h":600},{"x":780,"y":0,"w":20,"h":600},{"x":0,"y":580,"w":800,"h":20},{"x":300,"y":200,"w":200,"h":30}]`

func Init() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	// WAL モード: 同時読み書きの相互ブロックを避ける。
	db, err = gorm.Open(sqlite.Open(cfg.DBPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	//Migrate
	db.AutoMigrate(&model.User{})
	db.AutoMigrate(&model.Room{})
	db.AutoMigrate(&model.Message{})
	db.AutoMigrate(&model.UserRoom{})

	//Insert sample data (開発環境のみ)
	if cfg.Environment != 0 {
		return
	}
	{
		var user model.User
		err = db.Where("name = ?", "test_user1").First(&user).Error
		if err != nil {
			password_byte := []byte("test_user1")
			hashed, _ := bcrypt.GenerateFromPassword(password_byte, 10)
			user := model.User{Name: "test_user1", Password: string(hashed)}
			db.Create(&user)
		}
	}
	{
		var user model.User
		err = db.Where("name = ?", "test_user2").First(&user).Error
		if err != nil {
			password_byte := []byte("test_user2")
			hashed, _ := bcrypt.GenerateFromPassword(password_byte, 10)
			user := model.User{Name: "test_user2", Password: string(hashed)}
			db.Create(&user)
		}
	}
	{
		var room model.Room
		err = db.Where("name = ?", "test_room1").First(&room).Error
		if err != nil {
			room := model.Room{Name: "test_room1", MapData: sampleMapData}
			db.Create(&room)
		}
	}
	{
		var user model.User
		err = db.Where("name = ?", "test_user1").First(&user).Error
		if err == nil {
			var room model.Room
			err = db.Where("name = ?", "test_room1").First(&room).Error
			if err == nil {
				var user_room model.UserRoom
				if db.Where("user_id = ? AND room_id = ?", user.ID, room.ID).First(&user_room).Error != nil {
					db.Create(&model.UserRoom{UserID: user.ID, RoomID: room.ID})
				}
			}
		}
	}
	{
		var user model.User
		err = db.Where("name = ?", "test_user2").First(&user).Error
		if err == nil {
			var room model.Room
			err = db.Where("name = ?", "test_room1").First(&room).Error
			if err == nil {
				var user_room model.UserRoom
				if db.Where("user_id = ? AND room_id = ?", user.ID, room.ID).First(&user_room).Error != nil {
					db.Create(&model.UserRoom{UserID: user.ID, RoomID: room.ID})
				}
			}
		}
	}
}

func GetDB() *gorm.DB {
	return db
}

func Close() {
	db_v2, _ := db.DB()
	if err := db_v2.Close(); err != nil {
		panic(err)
	}
}
