package handler

import (
	"fmt"
	"hamaoffice/config"
	"hamaoffice/model"
	"time"

	jwtv3 "github.com/dgrijalva/jwt-go"
	"github.com/dgrijalva/jwt-go/v4"
	"github.com/google/uuid"
)

// parseUserToken はログインセッション用トークンをパースし user_id を取り出す。
func parseUserToken(tokenstring string) (uuid.UUID, error) {
	cfg, err := config.Load()
	if err != nil {
		return uuid.Nil, fmt.Errorf("config is not valid")
	}

	token, err := jwt.Parse(tokenstring, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.SercretKey), nil
	})
	if err != nil {
		if ve, ok := err.(*jwtv3.ValidationError); ok && ve.Errors&jwtv3.ValidationErrorExpired != 0 {
			return uuid.Nil, fmt.Errorf("token is expired")
		}
		return uuid.Nil, fmt.Errorf("token is invalid")
	}
	if token == nil {
		return uuid.Nil, fmt.Errorf("not found token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, fmt.Errorf("not found claims")
	}

	user_id_str, ok := claims["id"].(string)
	if !ok {
		return uuid.Nil, fmt.Errorf("not found user_id")
	}
	user_id, err := uuid.Parse(user_id_str)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user_id")
	}

	return user_id, nil
}

// issueInviteToken は部屋への招待用の短命トークンを発行する。
func issueInviteToken(cfg *config.Config, room_id uuid.UUID, ttl time.Duration) (string, error) {
	claims := &model.InviteClaims{
		RoomID: room_id,
		StandardClaims: jwtv3.StandardClaims{
			ExpiresAt: time.Now().Add(ttl).Unix(),
		},
	}
	token := jwtv3.NewWithClaims(jwtv3.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.SercretKey))
}

// parseInviteToken は招待トークンをパースし room_id を取り出す。
func parseInviteToken(cfg *config.Config, tokenstring string) (uuid.UUID, error) {
	claims := &model.InviteClaims{}
	token, err := jwtv3.ParseWithClaims(tokenstring, claims, func(token *jwtv3.Token) (interface{}, error) {
		return []byte(cfg.SercretKey), nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, fmt.Errorf("invite token is invalid or expired")
	}
	return claims.RoomID, nil
}
