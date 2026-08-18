import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { userState } from '../../components/atoms';
import { useRecoilState } from 'recoil';
import { domain_db, http_protcol } from '../../global';
import Auth from '../../components/auth';
import MyNav from '../../components/nav';
import { useKeyboardMovement } from '../../hooks/useKeyboardMovement';
import { useRoomSocket } from '../../hooks/useRoomSocket';
import { useProximityVoice } from '../../hooks/useProximityVoice';

const MapCanvas = dynamic(() => import('../../components/mapCanvas'), { ssr: false });

const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const VOICE_THRESHOLD = 220; // px。この距離以内なら自動で通話接続する。
const BOUNDS = { minX: 0, minY: 0, maxX: MAP_WIDTH, maxY: MAP_HEIGHT };

export default function Room() {
  const router = useRouter();
  const [user] = useRecoilState(userState);
  const room_id = router.query.id;

  const [room, setRoom] = useState(null);
  const [obstacles, setObstacles] = useState([]);
  const [others, setOthers] = useState({}); // id -> {id,name,icon,x,y}
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [turnConfig, setTurnConfig] = useState(null);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // 部屋情報・履歴・TURN credential の初期取得。
  useEffect(() => {
    if (user == null || !room_id) return;
    const fetchAll = async () => {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const roomsRes = await fetch(`${http_protcol}://${domain_db}/restricted/get_rooms`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      }).catch(() => null);
      if (roomsRes) {
        const json = await roomsRes.json().catch(() => null);
        const r = json && json.rooms && json.rooms.find((x) => x.id === room_id);
        if (r) {
          setRoom(r);
          try {
            setObstacles(JSON.parse(r.map_data || '[]'));
          } catch (e) {
            setObstacles([]);
          }
        }
      }

      const msgRes = await fetch(`${http_protcol}://${domain_db}/restricted/get_messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ room_id }),
      }).catch(() => null);
      if (msgRes) {
        const json = await msgRes.json().catch(() => null);
        if (json && json.messages) {
          setMessages(
            json.messages.map((m) => ({
              userId: m.user_id,
              text: m.text,
              createdAt: m.CreatedAt,
            }))
          );
        }
      }

      const turnRes = await fetch(`${http_protcol}://${domain_db}/restricted/turn_credential`, {
        headers: authHeaders,
      }).catch(() => null);
      if (turnRes) {
        const json = await turnRes.json().catch(() => null);
        if (json && json.result === 0) setTurnConfig(json);
      }

      setReady(true);
    };
    fetchAll();
  }, [user, room_id]);

  const voiceRef = useRef(null);

  const socket = useRoomSocket({
    roomId: room_id,
    token: ready ? token : null,
    onWelcome: useCallback((msg) => {
      const next = {};
      (msg.users || []).forEach((u) => {
        next[u.id] = u;
        voiceRef.current && voiceRef.current.updateOtherPos(u.id, u.x, u.y);
      });
      setOthers(next);
    }, []),
    onUserJoined: useCallback((u) => {
      setOthers((prev) => ({ ...prev, [u.id]: u }));
      voiceRef.current && voiceRef.current.updateOtherPos(u.id, u.x, u.y);
    }, []),
    onUserLeft: useCallback((userId) => {
      setOthers((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      voiceRef.current && voiceRef.current.removeUser(userId);
    }, []),
    onMove: useCallback((msg) => {
      setOthers((prev) => {
        if (!prev[msg.user_id]) return prev;
        return { ...prev, [msg.user_id]: { ...prev[msg.user_id], x: msg.x, y: msg.y } };
      });
      voiceRef.current && voiceRef.current.updateOtherPos(msg.user_id, msg.x, msg.y);
    }, []),
    onChat: useCallback((msg) => {
      setMessages((prev) => [
        ...prev,
        { userId: msg.user_id, text: msg.text, createdAt: msg.created_at },
      ]);
    }, []),
    onSignal: useCallback((msg) => {
      voiceRef.current && voiceRef.current.handleSignal(msg);
    }, []),
  });

  const voice = useProximityVoice({
    myUserId: user ? user.id : '',
    sendSignal: socket.sendSignal,
    threshold: VOICE_THRESHOLD,
    turnConfig,
  });
  voiceRef.current = voice;

  const { pos: myPos, dragTo, endDrag } = useKeyboardMovement(
    { x: 60, y: 60 },
    obstacles,
    BOUNDS
  );

  const handleMyDrag = useCallback((x, y) => dragTo(x, y), [dragTo]);

  // myPos が変わるたび(マウント直後の初期位置も含む)に、自分の位置を
  // サーバーへ送信しつつ voice 側にも伝える。rAF 内コールバックだけに頼ると
  // 一度も動いていない=初期位置がまだ誰にも共有されない、という抜けが起きるため。
  useEffect(() => {
    socket.sendMove(myPos.x, myPos.y);
    voiceRef.current && voiceRef.current.updateMyPos(myPos.x, myPos.y);
  }, [myPos, socket.sendMove]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView();
  }, [messages]);

  const othersList = useMemo(() => Object.values(others), [others]);

  const handleSendChat = () => {
    if (chatInput.trim() === '') return;
    socket.sendChat(chatInput);
    setChatInput('');
  };

  const nameFor = (userId) => {
    if (user && userId === user.id) return user.name;
    return (others[userId] && others[userId].name) || '?';
  };

  return (
    <Auth>
      {user == null ? (
        <div>loading</div>
      ) : (
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 font-mono flex flex-col items-center min-h-screen w-screen">
          <Head>
            <title>{room ? room.name : '部屋'}</title>
            <meta httpEquiv="cache-control" content="no-cache" />
          </Head>

          <MyNav title={room ? room.name : ''} />
          <div className="m-2"></div>

          <main className="flex flex-col lg:flex-row items-start justify-center w-full flex-1 container gap-4 pb-8">
            <div className="flex flex-col items-center">
              <p className="text-white text-xs mb-1">
                矢印キー(またはWASD)、または自分のアバターを直接ドラッグして移動。近づくと自動で通話接続します。
              </p>
              <div className="border-2 border-white rounded shadow-lg overflow-hidden">
                <MapCanvas
                  width={MAP_WIDTH}
                  height={MAP_HEIGHT}
                  obstacles={obstacles}
                  myPos={myPos}
                  myName={user.name}
                  others={othersList}
                  onMyDrag={handleMyDrag}
                  onMyDragEnd={endDrag}
                />
              </div>
            </div>

            <div className="flex flex-col w-full lg:w-96 bg-slate-50 bg-opacity-40 rounded-md h-[600px]">
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-semibold">{nameFor(m.userId)}: </span>
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  </div>
                ))}
                <div ref={bottomRef}></div>
              </div>
              <div className="flex p-2 border-t border-gray-300">
                <input
                  className="flex-grow rounded px-2 py-1 mr-2"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChat();
                  }}
                />
                <button
                  className="text-sm px-3 py-1 bg-neutral-800 rounded-md text-white"
                  onClick={handleSendChat}
                >
                  送信
                </button>
              </div>
            </div>
          </main>
        </div>
      )}
    </Auth>
  );
}
