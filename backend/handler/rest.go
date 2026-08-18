package handler

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"hamaoffice/config"
	"hamaoffice/database"
	"hamaoffice/model"
	"net/http"
	"time"

	jwtv3 "github.com/dgrijalva/jwt-go"
	"github.com/google/uuid"
	"github.com/labstack/echo"
	"golang.org/x/crypto/bcrypt"
)

func isMember(userID, roomID uuid.UUID) bool {
	db := database.GetDB()
	var m model.UserRoom
	return db.Where("user_id = ? AND room_id = ?", userID, roomID).First(&m).Error == nil
}

func currentUserID(c echo.Context) uuid.UUID {
	token := c.Get("user").(*jwtv3.Token)
	claims := token.Claims.(*model.JwtCustomClaims)
	return claims.ID
}

func Login(c echo.Context) error {
	db := database.GetDB()

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	name, _ := json_map["username"].(string)
	password, _ := json_map["password"].(string)

	var user model.User
	if err := db.Where("name = ?", name).First(&user).Error; err != nil {
		return c.JSON(http.StatusUnauthorized, nil)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return c.JSON(http.StatusUnauthorized, nil)
	}

	claims := &model.JwtCustomClaims{
		ID:   user.ID,
		Name: user.Name,
		StandardClaims: jwtv3.StandardClaims{
			ExpiresAt: time.Now().Add(time.Hour * 72).Unix(),
		},
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	token := jwtv3.NewWithClaims(jwtv3.SigningMethodHS256, claims)
	t, err := token.SignedString([]byte(cfg.SercretKey))
	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, echo.Map{"token": t})
}

func Signup(c echo.Context) error {
	db := database.GetDB()

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	username, _ := json_map["username"].(string)
	password, _ := json_map["password"].(string)

	if username == "" || password == "" {
		return c.JSON(http.StatusOK, echo.Map{"result": -5})
	}

	var count int64
	db.Model(&model.User{}).Where("name = ?", username).Count(&count)
	if count > 0 {
		return c.JSON(http.StatusOK, echo.Map{"result": -4})
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	user := model.User{Name: username, Password: string(hashed)}
	db.Create(&user)

	return c.JSON(http.StatusOK, echo.Map{"result": 0})
}

func GetAuthenticatedUser(c echo.Context) error {
	db := database.GetDB()
	id := currentUserID(c)

	var auth_user model.User
	if err := db.First(&auth_user, "id = ?", id).Error; err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	return c.JSON(http.StatusOK, echo.Map{
		"result": 0,
		"user":   echo.Map{"id": id, "icon": auth_user.Icon, "name": auth_user.Name},
	})
}

func UpdateUser(c echo.Context) error {
	db := database.GetDB()
	id := currentUserID(c)

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	icon_str, _ := json_map["icon"].(string)

	if err := db.Model(&model.User{}).Where("id = ?", id).Update("icon", icon_str).Error; err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	return c.JSON(http.StatusOK, echo.Map{"result": 0})
}

func CreateRoom(c echo.Context) error {
	db := database.GetDB()
	user_id := currentUserID(c)

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	roomname, _ := json_map["roomname"].(string)
	if roomname == "" {
		return c.JSON(http.StatusOK, echo.Map{"result": -5})
	}

	room := model.Room{Name: roomname}
	db.Create(&room)
	db.Create(&model.UserRoom{RoomID: room.ID, UserID: user_id})

	return c.JSON(http.StatusOK, echo.Map{"result": 0, "room_id": room.ID})
}

// CreateInvite は部屋のメンバーが発行する招待トークン(10分間有効)を返す。
func CreateInvite(c echo.Context) error {
	user_id := currentUserID(c)

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	room_id_str, _ := json_map["room_id"].(string)
	room_id, err := uuid.Parse(room_id_str)
	if err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -2})
	}

	if !isMember(user_id, room_id) {
		return c.JSON(http.StatusOK, echo.Map{"result": -3})
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	tokenstring, err := issueInviteToken(cfg, room_id, 10*time.Minute)
	if err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}

	return c.JSON(http.StatusOK, echo.Map{"result": 0, "invite_token": tokenstring})
}

// JoinRoom は招待トークンを検証してリクエストユーザーを部屋に追加する。
func JoinRoom(c echo.Context) error {
	db := database.GetDB()
	user_id := currentUserID(c)

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	invite_token, _ := json_map["invite_token"].(string)

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	room_id, err := parseInviteToken(cfg, invite_token)
	if err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -2})
	}

	if isMember(user_id, room_id) {
		return c.JSON(http.StatusOK, echo.Map{"result": 0, "room_id": room_id})
	}

	if err := db.Create(&model.UserRoom{RoomID: room_id, UserID: user_id}).Error; err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -3})
	}

	return c.JSON(http.StatusOK, echo.Map{"result": 0, "room_id": room_id})
}

// GetRooms は認証ユーザーが所属する部屋一覧を返す。
func GetRooms(c echo.Context) error {
	db := database.GetDB()
	user_id := currentUserID(c)

	var user_rooms []model.UserRoom
	if err := db.Where("user_id = ?", user_id).Find(&user_rooms).Error; err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	room_ids := make([]uuid.UUID, 0, len(user_rooms))
	for _, ur := range user_rooms {
		room_ids = append(room_ids, ur.RoomID)
	}

	rooms := []model.APIRoom{}
	if len(room_ids) > 0 {
		if err := db.Model(&model.Room{}).Where("id IN ?", room_ids).Find(&rooms).Error; err != nil {
			return c.JSON(http.StatusOK, echo.Map{"result": -2})
		}
	}

	return c.JSON(http.StatusOK, echo.Map{"result": 0, "rooms": rooms})
}

func GetRoomUsers(c echo.Context) error {
	db := database.GetDB()
	user_id := currentUserID(c)

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	room_id_str, _ := json_map["room_id"].(string)
	room_id, err := uuid.Parse(room_id_str)
	if err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	if !isMember(user_id, room_id) {
		return c.JSON(http.StatusOK, echo.Map{"result": -4})
	}

	var user_rooms []model.UserRoom
	if err := db.Where("room_id = ?", room_id).Find(&user_rooms).Error; err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	user_ids := make([]uuid.UUID, 0, len(user_rooms))
	for _, ur := range user_rooms {
		user_ids = append(user_ids, ur.UserID)
	}

	users := []model.APIUser{}
	if len(user_ids) > 0 {
		if err := db.Model(&model.User{}).Where("id IN ?", user_ids).Find(&users).Error; err != nil {
			return c.JSON(http.StatusOK, echo.Map{"result": -2})
		}
	}
	return c.JSON(http.StatusOK, echo.Map{"result": 0, "users": users})
}

func GetMessages(c echo.Context) error {
	db := database.GetDB()
	user_id := currentUserID(c)

	json_map := make(map[string]interface{})
	if err := json.NewDecoder(c.Request().Body).Decode(&json_map); err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	room_id_str, _ := json_map["room_id"].(string)
	room_id, err := uuid.Parse(room_id_str)
	if err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -1})
	}
	if !isMember(user_id, room_id) {
		return c.JSON(http.StatusOK, echo.Map{"result": -4})
	}

	var messages []model.Message
	if err := db.Model(&model.Message{}).Where("room_id = ?", room_id).Order("created_at asc").Find(&messages).Error; err != nil {
		return c.JSON(http.StatusOK, echo.Map{"result": -3})
	}
	return c.JSON(http.StatusOK, echo.Map{"result": 0, "messages": messages})
}

// TurnCredential は coturn の use-auth-secret (REST API) 方式に沿った
// 短命 TURN/STUN 認証情報を発行する。
func TurnCredential(c echo.Context) error {
	user_id := currentUserID(c)

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	const ttlSeconds = 3600
	expire := time.Now().Add(ttlSeconds * time.Second).Unix()
	username := fmt.Sprintf("%d:%s", expire, user_id.String())

	mac := hmac.New(sha1.New, []byte(cfg.TurnSecret))
	mac.Write([]byte(username))
	credential := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	return c.JSON(http.StatusOK, echo.Map{
		"result":     0,
		"username":   username,
		"credential": credential,
		"urls":       cfg.TurnURLs,
		"ttl":        ttlSeconds,
	})
}
