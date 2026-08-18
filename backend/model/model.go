package model

import (
	"time"

	jwtv3 "github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// JwtCustomClaims はログイン後のセッション用トークン。room_ids は含めない
// (部屋への所属は都度 DB を見る。招待直後に再ログインなしで反映させるため)。
type JwtCustomClaims struct {
	ID   uuid.UUID `json:"id" gorm:"type:uuid"`
	Name string    `json:"name"`
	jwtv3.StandardClaims
}

// InviteClaims は部屋への招待リンク用の短命トークン。
type InviteClaims struct {
	RoomID uuid.UUID `json:"room_id" gorm:"type:uuid"`
	jwtv3.StandardClaims
}

type Auth struct {
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid"`
}

type User struct {
	ID        uuid.UUID `gorm:"primaryKey;type:uuid"`
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
	ID        uuid.UUID `gorm:"primaryKey;type:uuid"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt

	Name string `json:"name"`
	Icon string `json:"icon" gorm:"size:100000; default:''"`
	// MapData は障害物矩形の配列を JSON でシリアライズしたもの。
	// 例: [{"x":0,"y":0,"w":40,"h":400}]
	MapData  string `json:"map_data" gorm:"type:text; default:'[]'"`
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
	MapData string      `json:"map_data"`
	UserIDs []uuid.UUID `json:"user_ids"`
}

type Message struct {
	gorm.Model
	Text      string    `json:"text"`
	ReadCount uint      `json:"read_count"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid"`
	RoomID    uuid.UUID `json:"room_id" gorm:"type:uuid"`
}

type APIMessage struct {
	RoomID uuid.UUID `json:"room_id"  gorm:"type:uuid"`
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid"`
	Text   string    `json:"text"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}

func (r *Room) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return
}
