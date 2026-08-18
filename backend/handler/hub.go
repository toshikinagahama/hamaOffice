package handler

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Client は 1 WebSocket 接続 = 1 部屋内の 1 ユーザーを表す。
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID uuid.UUID
	name   string
	icon   string

	mu   sync.Mutex
	x, y float64
}

// outboundMsg は Hub の broadcast チャネルに流す配信指示。
type outboundMsg struct {
	data    []byte
	from    *Client
	to      uuid.UUID // uuid.Nil なら全員宛
	exclude bool       // true なら from を配信対象から除外
}

// Hub は 1 部屋分の接続を管理する。
type Hub struct {
	id         uuid.UUID
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	broadcast  chan outboundMsg
	mu         sync.Mutex
}

func newHub(roomID uuid.UUID) *Hub {
	return &Hub{
		id:         roomID,
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan outboundMsg, 64),
	}
}

func (h *Hub) run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			_, wasMember := h.clients[c]
			if wasMember {
				delete(h.clients, c)
				close(c.send)
			}
			remaining := make([]*Client, 0, len(h.clients))
			for rc := range h.clients {
				remaining = append(remaining, rc)
			}
			h.mu.Unlock()

			if wasMember {
				data, _ := json.Marshal(map[string]interface{}{
					"type":    "user_left",
					"user_id": c.userID,
				})
				for _, rc := range remaining {
					select {
					case rc.send <- data:
					default:
					}
				}
			}
			if len(remaining) == 0 {
				removeHub(h.id)
				return
			}

		case m := <-h.broadcast:
			h.mu.Lock()
			for c := range h.clients {
				if m.exclude && c == m.from {
					continue
				}
				if m.to != uuid.Nil && c.userID != m.to {
					continue
				}
				select {
				case c.send <- m.data:
				default:
					log.Println("client send buffer full, dropping connection")
					close(c.send)
					delete(h.clients, c)
				}
			}
			h.mu.Unlock()
		}
	}
}

var hubsMu sync.Mutex
var hubs = map[uuid.UUID]*Hub{}

func getOrCreateHub(roomID uuid.UUID) *Hub {
	hubsMu.Lock()
	defer hubsMu.Unlock()
	h, ok := hubs[roomID]
	if !ok {
		h = newHub(roomID)
		hubs[roomID] = h
		go h.run()
	}
	return h
}

func removeHub(roomID uuid.UUID) {
	hubsMu.Lock()
	defer hubsMu.Unlock()
	delete(hubs, roomID)
}
