package model

import (
	"time"

	jwtv3 "github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JwtCustomClaims struct {
	ID      uuid.UUID   `json:"id" gorm:"type:uuid"`
	Name    string      `json:"name"`
	RoomIDs []uuid.UUID `json:"room_ids"` //room_idsもトークンに含む
	jwtv3.StandardClaims
}

type Auth struct {
	UserID  uuid.UUID   `json:"user_id" gorm:"type:uuid"`
	RoomIDs []uuid.UUID `json:"room_ids"`
}
type User struct {
	ID        uuid.UUID `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt

	Name     string    `json:"name"`
	Password string    `json:"password"`
	Icon     string    `json:"icon" gorm:"size:100000; default:''"`
	Rooms    []Room    `json:"rooms" gorm:"many2many:user_rooms;"`
	Messages []Message `json:"messages"`
}

type APIUser struct {
	ID   uuid.UUID `json:"id" gorm:"type:uuid"`
	Name string    `json:"name"`
	Icon string    `json:"icon" gorm:"size:100000; default:''"`
}

type Room struct {
	ID        uuid.UUID `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt

	Name     string `json:"name"`
	Password string `json:"password"`
	Icon     string `json:"icon" gorm:"size:100000; default:''"`
	Users    []User `json:"users" gorm:"many2many:user_rooms;"`
	Messages []Message
}

type UserRoom struct {
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid"`
	RoomID uuid.UUID `json:"room_id" gorm:"type:uuid"`
}

type APIRoom struct {
	ID      uuid.UUID   `json:"id" gorm:"type:uuid"`
	Name    string      `json:"name"`
	Icon    string      `json:"icon"`
	UserIDs []uuid.UUID `json:"user_ids"`
}

type Message struct {
	gorm.Model
	Text      string    `json:"text"`
	ReadCount uint      `json:"read_count"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid"`
	ToUserID  uuid.UUID `json:"to_user_id" gorm:"type:uuid"`
	RoomID    uuid.UUID `json:"room_id" gorm:"type:uuid"`
}

type APIMessage struct {
	RoomID   uuid.UUID `json:"room_id"  gorm:"type:uuid"`
	UserID   uuid.UUID `json:"user_id" gorm:"type:uuid"`
	ToUserID uuid.UUID `json:"to_user_id" gorm:"type:uuid"`
	Text     string    `json:"text"`
}

type Res struct {
	Command uint       `json:"command"`
	APIMsg  APIMessage `json:"message"`
}
