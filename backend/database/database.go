package database

import (
	"fmt"
	"hamaoffice/config"
	"hamaoffice/model"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB

func Init() {
	// db, err = gorm.Open(sqlite.Open("chat.sqlite3"), &gorm.Config{})
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}
	var dsn = fmt.Sprintf("user=%s password=%s dbname=%s host=%s port=%d sslmode=disable TimeZone=Asia/Tokyo", cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBHost, cfg.DBPort)
	db, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // disables implicit prepared statement usage
	}), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	//Enable to use uuid
	db.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)

	//Migrate
	db.AutoMigrate(&model.User{})
	db.AutoMigrate(&model.Room{})
	db.AutoMigrate(&model.Message{})

	//Insert sample data
	{
		var user model.User
		//db.Unscoped().Delete(model.User{}, "id >= ?", 0)
		//db.Unscoped().Delete(model.Room{}, "id >= ?", 0)
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
			room := model.Room{Name: "test_room1", Password: "test_room1"}
			db.Create(&room)
		}
	}
	{
		var room model.Room
		err = db.Where("name = ?", "test_room2").First(&room).Error
		if err != nil {
			room := model.Room{Name: "test_room2", Password: "test_room2"}
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
				var user_room = model.UserRoom{UserID: user.ID, RoomID: room.ID}
				err = db.Create(&user_room).Error
			}
		}
	}
	{
		var user model.User
		err = db.Where("name = ?", "test_user1").First(&user).Error
		if err == nil {
			var room model.Room
			err = db.Where("name = ?", "test_room2").First(&room).Error
			if err == nil {
				var user_room = model.UserRoom{UserID: user.ID, RoomID: room.ID}
				err = db.Create(&user_room).Error
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
				var user_room = model.UserRoom{UserID: user.ID, RoomID: room.ID}
				err = db.Create(&user_room).Error
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
				var user_room = model.UserRoom{UserID: user.ID, RoomID: room.ID}
				err = db.Create(&user_room).Error
			}
		}
	}
	// {
	// 	var user model.User
	// 	err = db.Where("name = ?", "test_user1").First(&user).Error
	// 	if err == nil {
	// 		var room model.Room
	// 		err = db.Where("name = ?", "test_room1").First(&room).Error
	// 		if err == nil {
	// 			var message = model.Message{UserID: user.ID, RoomID: room.ID, Text: "hello from test_user1", ReadCount: 0}
	// 			db.Create(&message)
	// 		}
	// 	}
	// }
	// {
	// 	var user model.User
	// 	err = db.Where("name = ?", "test_user2").First(&user).Error
	// 	if err == nil {
	// 		var room model.Room
	// 		err = db.Where("name = ?", "test_room1").First(&room).Error
	// 		if err == nil {
	// 			var message = model.Message{UserID: user.ID, RoomID: room.ID, Text: "hello from test_user2", ReadCount: 0}
	// 			db.Create(&message)
	// 		}
	// 	}
	// }

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
