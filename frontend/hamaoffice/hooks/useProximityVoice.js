import { useEffect, useRef, useCallback } from 'react';
import { distance } from '../lib/collision';

const FALLBACK_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function buildIceServers(turnConfig) {
  if (!turnConfig || !turnConfig.urls) return FALLBACK_ICE_SERVERS;
  return turnConfig.urls.map((url) => {
    if (url.startsWith('turn:') || url.startsWith('turns:')) {
      return { urls: url, username: turnConfig.username, credential: turnConfig.credential };
    }
    return { urls: url };
  });
}

// listener を明示的に原点固定・前方=画面奥(-Z)に設定する。
// デフォルト任せにしていると、ブラウザ実装によって azimuth の基準が
// 微妙にズレることがあるため、値を確実に固定しておく。
function initListener(ctx) {
  const l = ctx.listener;
  if (l.forwardX) {
    l.forwardX.value = 0;
    l.forwardY.value = 0;
    l.forwardZ.value = -1;
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
    l.positionX.value = 0;
    l.positionY.value = 0;
    l.positionZ.value = 0;
  } else if (l.setOrientation) {
    l.setOrientation(0, 0, -1, 0, 1, 0);
    l.setPosition(0, 0, 0);
  }
}

// 2D座標(x,y)→3D音響空間へのマッピング。x=左右, y=前後(画面奥行き)。
// listener は常に原点(0,0,0)・(-Z方向を向く)に固定し、音源側(PannerNode)を
// 「相手の絶対位置-自分の絶対位置」の相対座標に置く。
function applyPannerPosition(panner, myPos, otherPos) {
  panner.positionX.value = otherPos.x - myPos.x;
  panner.positionY.value = 0;
  panner.positionZ.value = otherPos.y - myPos.y;
}

// 一定距離内に入った相手とだけ自動で WebRTC 音声接続を張り、
// PannerNode(HRTF) で相手の 2D 座標(左右+前後)から音が聞こえるように定位する。
export function useProximityVoice({ myUserId, sendSignal, threshold, turnConfig }) {
  const peersRef = useRef(new Map()); // userId -> { pc, panner }
  const audioCtxRef = useRef(null);
  const localStreamRef = useRef(null);
  const myPosRef = useRef({ x: 0, y: 0 });
  const otherPosRef = useRef(new Map());
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);
  const sendSignalRef = useRef(sendSignal);
  sendSignalRef.current = sendSignal;

  // マイク取得(成功/拒否問わず)が確定するまでは PeerConnection を一切
  // 作らない。先に作ってしまうと、後からトラックが追加された側だけ
  // renegotiation が必要になり、offer/answer の衝突(glare)を生みやすい。
  const micReadyRef = useRef(false);
  const pendingSignalsRef = useRef([]);
  const checkProximityRef = useRef(() => {});

  useEffect(() => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new AudioContextCtor();
    initListener(audioCtxRef.current);

    // ブラウザの自動再生ポリシー対策: AudioContext はユーザー操作由来の
    // イベント内で resume されないと音が出ないままのことが多い。矢印キー
    // 移動やクリックなど、最初のユーザー操作で一度だけ resume する。
    const resumeOnGesture = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('keydown', resumeOnGesture);
    window.addEventListener('click', resumeOnGesture);

    const onMicSettled = () => {
      micReadyRef.current = true;
      const queued = pendingSignalsRef.current;
      pendingSignalsRef.current = [];
      queued.forEach((msg) => processSignalRef.current(msg));
      checkProximityRef.current();
    };

    // getUserMedia は Secure Context (https、または localhost) でしか
    // 存在しない。http://IPアドレス 等でアクセスすると navigator.mediaDevices
    // 自体が undefined になり、素通しだと同期的に例外を投げてしまう。
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('getUserMedia not available (requires https or localhost) — voice disabled');
      onMicSettled();
    } else {
      navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then((stream) => {
          localStreamRef.current = stream;
        })
        .catch((err) => console.error('mic error:', err))
        .finally(onMicSettled);
    }

    return () => {
      window.removeEventListener('keydown', resumeOnGesture);
      window.removeEventListener('click', resumeOnGesture);
      peersRef.current.forEach((p) => {
        p.pc.close();
        p.panner.disconnect();
      });
      peersRef.current.clear();
      localStreamRef.current && localStreamRef.current.getTracks().forEach((t) => t.stop());
      audioCtxRef.current && audioCtxRef.current.close();
    };
  }, []);

  useEffect(() => {
    iceServersRef.current = buildIceServers(turnConfig);
  }, [turnConfig]);

  const updatePannerFor = useCallback((userId) => {
    const p = peersRef.current.get(userId);
    const other = otherPosRef.current.get(userId);
    if (!p || !other) return;
    applyPannerPosition(p.panner, myPosRef.current, other);
  }, []);

  const removePeer = useCallback((userId) => {
    const p = peersRef.current.get(userId);
    if (p) {
      p.pc.close();
      p.panner.disconnect();
      peersRef.current.delete(userId);
    }
  }, []);

  const createPeer = useCallback(
    (userId, isOfferer) => {
      const ctx = audioCtxRef.current;
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      const panner = new PannerNode(ctx, {
        panningModel: 'HRTF',
        distanceModel: 'linear',
        refDistance: 40,
        maxDistance: threshold,
        rolloffFactor: 1,
      });
      panner.connect(ctx.destination);

      pc.ontrack = (evt) => {
        // ブラウザの自動再生ポリシーで AudioContext は suspended のまま
        // 生成されることが多い。resume しないと PannerNode 経由の音が
        // 一切出ない。
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const audioEl = new Audio();
        audioEl.srcObject = evt.streams[0];
        audioEl.muted = true; // PannerNode 経由でしか鳴らさない
        audioEl.play().catch(() => {});
        const source = ctx.createMediaStreamSource(evt.streams[0]);
        source.connect(panner);
      };

      pc.onicecandidate = (evt) => {
        if (evt.candidate) sendSignalRef.current(userId, 'ice', evt.candidate);
      };

      if (isOfferer) {
        pc.onnegotiationneeded = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignalRef.current(userId, 'offer', pc.localDescription);
          } catch (err) {
            console.error('negotiation error:', err);
          }
        };
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
      }

      const entry = { pc, panner };
      peersRef.current.set(userId, entry);
      updatePannerFor(userId);
      return entry;
    },
    [threshold, updatePannerFor]
  );

  const checkProximity = useCallback(() => {
    if (!micReadyRef.current) return; // マイク許可/拒否が確定するまで待つ
    otherPosRef.current.forEach((pos, userId) => {
      const d = distance(myPosRef.current.x, myPosRef.current.y, pos.x, pos.y);
      const has = peersRef.current.has(userId);
      if (d <= threshold && !has) {
        // 一意な決定: userID の文字列比較が小さい方が offer を出す。
        const isOfferer = String(myUserId) < String(userId);
        createPeer(userId, isOfferer);
      } else if (d > threshold && has) {
        removePeer(userId);
      }
    });
  }, [threshold, myUserId, createPeer, removePeer]);
  checkProximityRef.current = checkProximity;

  const processSignal = useCallback(
    async ({ from, kind, data }) => {
      let payload;
      try {
        payload = JSON.parse(data);
      } catch (err) {
        return;
      }
      let entry = peersRef.current.get(from);
      if (kind === 'offer') {
        if (!entry) entry = createPeer(from, false);
        await entry.pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        sendSignalRef.current(from, 'answer', entry.pc.localDescription);
      } else if (kind === 'answer') {
        if (entry) await entry.pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (kind === 'ice') {
        if (entry) {
          try {
            await entry.pc.addIceCandidate(payload);
          } catch (err) {
            console.error('addIceCandidate error:', err);
          }
        }
      }
    },
    [createPeer]
  );
  const processSignalRef = useRef(processSignal);
  processSignalRef.current = processSignal;

  const handleSignal = useCallback((msg) => {
    if (!micReadyRef.current) {
      pendingSignalsRef.current.push(msg);
      return;
    }
    processSignalRef.current(msg);
  }, []);

  const updateMyPos = useCallback(
    (x, y) => {
      myPosRef.current = { x, y };
      peersRef.current.forEach((_, userId) => updatePannerFor(userId));
      checkProximity();
    },
    [updatePannerFor, checkProximity]
  );

  const updateOtherPos = useCallback(
    (userId, x, y) => {
      otherPosRef.current.set(userId, { x, y });
      updatePannerFor(userId);
      checkProximity();
    },
    [updatePannerFor, checkProximity]
  );

  const removeUser = useCallback(
    (userId) => {
      otherPosRef.current.delete(userId);
      removePeer(userId);
    },
    [removePeer]
  );

  return { updateMyPos, updateOtherPos, removeUser, handleSignal };
}
