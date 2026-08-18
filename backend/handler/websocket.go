package handler

import (
	"encoding/json"
	"hamaoffice/database"
	"hamaoffice/model"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

const (
	writeWait  = 10 * time.Second
	pongWait   = 60 * time.Second
	pingPeriod = (pongWait * 9) / 10
)

// clientMsg はクライアントから送られてくるメッセージ全種の envelope。
type clientMsg struct {
	Type   string  `json:"type"`
	Token  string  `json:"token,omitempty"`
	RoomID string  `json:"room_id,omitempty"`
	X      float64 `json:"x,omitempty"`
	Y      float64 `json:"y,omitempty"`
	Text   string  `json:"text,omitempty"`
	To     string  `json:"to,omitempty"`
	Kind   string  `json:"kind,omitempty"`
	Data   string  `json:"data,omitempty"`
}

func wsSendError(conn *websocket.Conn, message string) {
	data, _ := json.Marshal(map[string]interface{}{"type": "error", "message": message})
	conn.WriteMessage(websocket.TextMessage, data)
}

// Websocket はまず join メッセージを待ち、認証・部屋所属チェックの後
// Hub に登録して以降のリアルタイム通信を仲介する。
func Websocket(c echo.Context) error {
	conn, err := upgrader.Upgrade(c.Response().Writer, c.Request(), nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return nil
	}

	var join clientMsg
	if err := conn.ReadJSON(&join); err != nil || join.Type != "join" {
		wsSendError(conn, "first message must be a join message")
		conn.Close()
		return nil
	}

	userID, err := parseUserToken(join.Token)
	if err != nil {
		wsSendError(conn, "authentication failed")
		conn.Close()
		return nil
	}

	roomID, err := uuid.Parse(join.RoomID)
	if err != nil {
		wsSendError(conn, "invalid room_id")
		conn.Close()
		return nil
	}

	db := database.GetDB()
	var user model.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		wsSendError(conn, "user not found")
		conn.Close()
		return nil
	}

	var membership model.UserRoom
	if err := db.Where("user_id = ? AND room_id = ?", userID, roomID).First(&membership).Error; err != nil {
		wsSendError(conn, "not a member of this room")
		conn.Close()
		return nil
	}

	hub := getOrCreateHub(roomID)

	client := &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 32),
		userID: userID,
		name:   user.Name,
		icon:   user.Icon,
	}

	hub.mu.Lock()
	existing := make([]map[string]interface{}, 0, len(hub.clients))
	for other := range hub.clients {
		other.mu.Lock()
		existing = append(existing, map[string]interface{}{
			"id": other.userID, "name": other.name, "icon": other.icon,
			"x": other.x, "y": other.y,
		})
		other.mu.Unlock()
	}
	hub.mu.Unlock()

	hub.register <- client

	welcome, _ := json.Marshal(map[string]interface{}{
		"type": "welcome",
		"self": map[string]interface{}{"id": userID, "name": user.Name, "icon": user.Icon},
		"users": existing,
	})
	client.send <- welcome

	joined, _ := json.Marshal(map[string]interface{}{
		"type": "user_joined",
		"user": map[string]interface{}{"id": userID, "name": user.Name, "icon": user.Icon, "x": 0, "y": 0},
	})
	hub.broadcast <- outboundMsg{data: joined, from: client, exclude: true}

	go client.writePump()
	client.readPump()

	return nil
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		var msg clientMsg
		if err := c.conn.ReadJSON(&msg); err != nil {
			break
		}

		switch msg.Type {
		case "move":
			c.mu.Lock()
			c.x, c.y = msg.X, msg.Y
			c.mu.Unlock()
			data, _ := json.Marshal(map[string]interface{}{
				"type": "move", "user_id": c.userID, "x": msg.X, "y": msg.Y,
			})
			c.hub.broadcast <- outboundMsg{data: data, from: c, exclude: true}

		case "chat":
			if msg.Text == "" {
				continue
			}
			m := model.Message{UserID: c.userID, RoomID: c.hub.id, Text: msg.Text}
			database.GetDB().Create(&m)
			data, _ := json.Marshal(map[string]interface{}{
				"type": "chat", "user_id": c.userID, "text": msg.Text, "created_at": m.CreatedAt,
			})
			c.hub.broadcast <- outboundMsg{data: data, from: c, exclude: false}

		case "signal":
			toID, err := uuid.Parse(msg.To)
			if err != nil {
				continue
			}
			data, _ := json.Marshal(map[string]interface{}{
				"type": "signal", "from": c.userID, "kind": msg.Kind, "data": msg.Data,
			})
			c.hub.broadcast <- outboundMsg{data: data, from: c, to: toID}

		default:
			log.Println("unknown ws message type:", msg.Type)
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case data, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
