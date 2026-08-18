import { useEffect, useRef, useState, useCallback } from 'react';
import { domain_db, ws_protcol } from '../global';

// サーバーへの position 送信を間引く間隔。
const MOVE_THROTTLE_MS = 50;

export function useRoomSocket({
  roomId,
  token,
  onWelcome,
  onUserJoined,
  onUserLeft,
  onMove,
  onChat,
  onSignal,
}) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const lastMoveSentRef = useRef(0);
  const pendingMoveRef = useRef(null);
  const pendingMoveTimerRef = useRef(null);

  const callbacksRef = useRef({});
  callbacksRef.current = { onWelcome, onUserJoined, onUserLeft, onMove, onChat, onSignal };

  useEffect(() => {
    if (!roomId || !token) return;

    const ws = new WebSocket(`${ws_protcol}://${domain_db}/ws`);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'join', token, room_id: roomId }));
      setConnected(true);
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch (err) {
        return;
      }
      const cb = callbacksRef.current;
      switch (msg.type) {
        case 'welcome':
          cb.onWelcome && cb.onWelcome(msg);
          break;
        case 'user_joined':
          cb.onUserJoined && cb.onUserJoined(msg.user);
          break;
        case 'user_left':
          cb.onUserLeft && cb.onUserLeft(msg.user_id);
          break;
        case 'move':
          cb.onMove && cb.onMove(msg);
          break;
        case 'chat':
          cb.onChat && cb.onChat(msg);
          break;
        case 'signal':
          cb.onSignal && cb.onSignal(msg);
          break;
        case 'error':
          console.error('ws error:', msg.message);
          break;
        default:
          break;
      }
    });

    ws.addEventListener('close', () => setConnected(false));
    ws.addEventListener('error', (err) => console.error('ws error', err));

    return () => {
      clearTimeout(pendingMoveTimerRef.current);
      ws.close();
    };
  }, [roomId, token]);

  const sendRaw = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }, []);

  const sendMove = useCallback(
    (x, y) => {
      pendingMoveRef.current = { x, y };
      const now = Date.now();
      const elapsed = now - lastMoveSentRef.current;
      if (elapsed >= MOVE_THROTTLE_MS) {
        lastMoveSentRef.current = now;
        sendRaw({ type: 'move', x, y });
        pendingMoveRef.current = null;
      } else if (!pendingMoveTimerRef.current) {
        pendingMoveTimerRef.current = setTimeout(() => {
          pendingMoveTimerRef.current = null;
          if (pendingMoveRef.current) {
            lastMoveSentRef.current = Date.now();
            sendRaw({ type: 'move', ...pendingMoveRef.current });
            pendingMoveRef.current = null;
          }
        }, MOVE_THROTTLE_MS - elapsed);
      }
    },
    [sendRaw]
  );

  const sendChat = useCallback((text) => sendRaw({ type: 'chat', text }), [sendRaw]);

  const sendSignal = useCallback(
    (to, kind, data) => sendRaw({ type: 'signal', to, kind, data: JSON.stringify(data) }),
    [sendRaw]
  );

  return { connected, sendMove, sendChat, sendSignal };
}
