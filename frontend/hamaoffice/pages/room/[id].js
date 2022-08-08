import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState, useEffect, useRef } from 'react';
import { userState } from '../../components/atoms';
import { useRecoilState } from 'recoil';
import { getDeviceStream } from '../../func';
import { domain_db, http_protcol, ws_protcol } from '../../global';
import Auth from '../../components/auth';
import MyNav from '../../components/nav';
import * as THREE from 'three';
import { Canvas, useThree, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function MyBox() {
  const myMesh = React.useRef();
  useFrame(({ clock }) => {
    myMesh.current.rotation.x = clock.getElapsedTime();
  });
  return (
    <mesh ref={myMesh}>
      <boxGeometry />
      <meshBasicMaterial color="royalblue" />
    </mesh>
  );
}

export default function Room(pageProps) {
  const router = useRouter();
  const [user, setUser] = useRecoilState(userState);
  const [room_users, setRoom_users] = useState([]);
  const socketRef = useRef();
  const refRoom_users = useRef([]);
  const refUser_id = useRef('');
  const room_id = useRef('');
  room_id.current = router.query.id;
  const [peer_con, setPerr_con] = useState(null);
  const [active_users, setActive_users] = useState({}); //{id: user_id, pos: {x:0, y:0, z: 0}, lookat: {x:0,y:0,z:0}, is_offer: boolean, peer: PeerConnection, panner: Panner}
  const refActive_users = useRef([]);

  const [isFetchData, setIsFetchData] = useState(false);
  const [room, setRoom] = useState([]);
  const audioctx = useRef(null);
  const destination = useRef(null);
  const panner = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);

  function prepareNewConnection(command, to_user_id, panner) {
    let pc_config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    let peer = new RTCPeerConnection(pc_config);

    peer.ontrack = function (event) {
      console.log('-- peer.ontrack(): track kind=' + event.track.kind);
      let stream = event.streams[0];
      let audio = new Audio();
      audio.srcObject = stream;
      audio.onloadedmetadata = () => {
        let source = audioctx.current.createMediaStreamSource(stream);
        source.connect(panner).connect(destination.current);
        audioctx.current.resume();
      };
    };
    if (localStream.current) {
      localStream.current.getTracks().forEach(function (track) {
        peer.addTrack(track, localStream.current);
      });
    } else {
      console.warn('no local stream, but continue.');
    }

    peer.onconnectionstatechange = (evt) => {
      switch (peer.connectionState) {
        //case 'disconnected':
        //  console.log('disconnected...');
        //  break;
        case 'closed':
          console.log('closed...');
          break;
        default:
          break;
      }
    };

    // --- on get local ICE candidate
    peer.onicecandidate = function (evt) {
      if (evt.candidate) {
      } else {
        //console.log('empty ice event');
        //ここで、ICE candidateを含んだSDPを送らないといけなさそう。
        if (command == 2) {
          const data = {
            command: 3,
            message: {
              room_id: room_id.current,
              user_id: refUser_id.current,
              to_user_id: to_user_id,
              text: peer.localDescription.sdp,
            },
          };
          console.log(data);
          socketRef.current.send(JSON.stringify(data));
        } else if (command == 3) {
          const data = {
            command: 4,
            message: {
              room_id: room_id.current,
              user_id: refUser_id.current,
              to_user_id: to_user_id,
              text: peer.localDescription.sdp,
            },
          };
          console.log(data);
          socketRef.current.send(JSON.stringify(data));
        }
      }
    };

    return peer;
  }

  const initMedia = () => {
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;
    RTCPeerConnection =
      window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    RTCSessionDescription =
      window.RTCSessionDescription ||
      window.webkitRTCSessionDescription ||
      window.mozRTCSessionDescription;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioctx.current = new AudioContext();
    destination.current = audioctx.current.destination;
    //destination.current = audioctx.current.createMediaStreamDestination();
    getDeviceStream({ video: false, audio: true })
      .then(function (stream) {
        localStream.current = stream;
      })
      .catch(function (error) {
        // error
        console.error('getUserMedia error:', error);
        return;
      });
  };

  // Data channel のイベントハンドラを定義する
  function setupDataChannel(dc) {
    dc.onerror = function (error) {
      console.log('Data channel error:', error);
    };
    dc.onmessage = function (evt) {
      console.log('Data channel message:', evt.data);
      let msg = evt.data;
    };
    dc.onopen = function (evt) {
      console.log('Data channel opened:', evt);
    };
    dc.onclose = function () {
      console.log('Data channel closed.');
    };
  }

  const initWebsocket = () => {
    if (socketRef.current == null)
      socketRef.current = new WebSocket(`${ws_protcol}://${domain_db}/ws`);
    else return;
    const token = localStorage.getItem('token');
    socketRef.current.addEventListener('open', function (e) {
      socketRef.current.send(JSON.stringify({ command: 100, data: { token } }));
      const data = {
        command: 0,
        message: { room_id: room_id.current, user_id: user.id, text: '' },
      };
      socketRef.current.send(JSON.stringify(data));
    });

    // サーバーからデータを受け取る
    socketRef.current.addEventListener('message', function (e) {
      //console.log(e.data);
      try {
        const json_data = JSON.parse(e.data);
        const command = json_data['command'];
        if (command != null) {
          switch (command) {
            case 0:
              console.log(json_data);
              const user_ids = json_data['active_user_ids'];
              if (user_ids == null) {
                console.log('No active users');
                return;
              }
              //アクティブユーザーの設定（先に入室している方）
              user_ids.map((user_id) => {
                if (user_id != user.id) {
                  let tmp_user = { id: user_id };
                  // あとから入ったほうがanswerにする。
                  tmp_user['is_offer'] = true;
                  tmp_user['pos'] = { x: 0, y: 0, z: 0 };
                  tmp_user['lookat'] = { x: 0, y: 0, z: 0 };
                  tmp_user['panner'] = new PannerNode(audioctx.current, { panningModel: 'HRTF' });
                  let text = 'offer';
                  const data = {
                    command: 2,
                    message: {
                      room_id: room_id.current,
                      user_id: user.id,
                      to_user_id: user_id,
                      text: text,
                    },
                  };
                  socketRef.current.send(JSON.stringify(data));
                  refActive_users.current.push(tmp_user);
                }
              });
              break;
            case 1:
              //const m = json_data['message'];
              //  let m_new = {
              //    text: m.text,
              //    from_id: tmp_user.id,
              //  };
              break;
            case 2:
              if (json_data['offer_or_answer'] == 'offer') {
                //offerされたほう(先に入室している側)の処理
                //目的のactiveuserのインデックスを調べ、すでに存在していたら、削除
                let index = -1;
                for (let i = 0; i < refActive_users.current.length; i++) {
                  let tmp_user = refActive_users.current[i];
                  if (tmp_user['id'] == json_data['from_user_id']) index = i;
                }
                if (index == -1) console.log('No connection');
                else {
                  //すでに存在していたら、いったん削除する。
                  refActive_users.current.splice(index, 1);
                  console.log(index);
                }
                let tmp_user = { id: json_data['from_user_id'] };
                tmp_user['pos'] = { x: 0, y: 0, z: 0 };
                tmp_user['lookat'] = { x: 0, y: 0, z: 0 };
                tmp_user['panner'] = new PannerNode(audioctx.current, { panningModel: 'HRTF' });
                tmp_user['is_offer'] = false;
                let text = '';
                if (tmp_user['is_offer']) text = 'offer';
                else text = 'answer';
                tmp_user['peer'] = prepareNewConnection(
                  2,
                  json_data['from_user_id'],
                  tmp_user['panner']
                );
                tmp_user['channel'] = tmp_user['peer'].createDataChannel(json_data['from_user_id']);
                setupDataChannel(tmp_user['channel']);
                tmp_user['peer']
                  .createOffer()
                  .then(function (sessionDescription) {
                    console.log('createOffer() succsess in promise');
                    return tmp_user['peer'].setLocalDescription(sessionDescription);
                  })
                  .then(function () {})
                  .catch(function (err) {
                    console.error(err);
                  });
                refActive_users.current.push(tmp_user);
              }
              break;
            case 3:
              //接続要求した側の処理
              let offer = new RTCSessionDescription({
                type: 'offer',
                sdp: json_data['message'],
              });
              //目的のactiveuserのインデックスを調べる
              let index = -1;
              for (let i = 0; i < refActive_users.current.length; i++) {
                let tmp_user = refActive_users.current[i];
                if (tmp_user['id'] == json_data['from_user_id']) index = i;
              }
              if (index == -1) console.log('Error in peerConnection');
              if (refActive_users.current[index]['peer']) {
                console.error('peerConnection alreay exist!');
              } else {
                refActive_users.current[index]['peer'] = prepareNewConnection(
                  3,
                  json_data['from_user_id'],
                  refActive_users.current[index]['panner']
                );
                refActive_users.current[index]['peer']
                  .setRemoteDescription(offer)
                  .then(function () {
                    //console.log('setRemoteDescription(offer) succsess in promise');
                    refActive_users.current[index]['peer']
                      .createAnswer()
                      .then(function (sessionDescription) {
                        //console.log('createAnswer() succsess in promise');
                        refActive_users.current[index]['peer'].ondatachannel = function (evt) {
                          console.log('Data channel created:', evt);
                          setupDataChannel(evt.channel);
                          refActive_users.current[index]['channel'] = evt.channel;
                          refActive_users.current[index]['channel'].send(user.id);
                        };
                        return refActive_users.current[index]['peer'].setLocalDescription(
                          sessionDescription
                        );
                      })
                      .then(function () {
                        //console.log('setLocalDescription() succsess in promise');
                      })
                      .catch(function (err) {
                        console.error(err);
                      });
                  })
                  .catch(function (err) {
                    console.error('setRemoteDescription(offer) ERROR: ', err);
                  });
              }

              break;
            case 4:
              //目的のactiveuserのインデックスを調べる
              index = -1;
              for (let i = 0; i < refActive_users.current.length; i++) {
                let tmp_user = refActive_users.current[i];
                if (tmp_user['id'] == json_data['from_user_id']) index = i;
              }
              if (index == -1) console.log('Error in peerConnection');
              if (!refActive_users.current[index]['peer']) {
                console.error('peerConnection NOT exist!');
                return;
              }
              let answer = new RTCSessionDescription({
                type: 'answer',
                sdp: json_data['message'],
              });

              refActive_users.current[index]['peer']
                .setRemoteDescription(answer)
                .then(function () {
                  //console.log('setRemoteDescription(answer) succsess in promise');
                })
                .catch(function (err) {
                  console.error('setRemoteDescription(answer) ERROR: ', err);
                });
              break;
            default:
              console.log(json_data);
              break;
          }
        }
      } catch (error) {
        console.log(error);
      }
    });
  };

  useEffect(async () => {
    if (user == null) {
      return;
    }

    initMedia();
    initWebsocket();

    refUser_id.current = user.id;
    return () => {
      socketRef.current.close(); //websocketのクローズ
    };
  }, [user]);

  useEffect(() => {
    refRoom_users.current = [...room_users];
  }, [room_users]);

  const handleConnectBtnClicked = (e) => {
    console.log('connect...');
    const data = {
      command: 2,
      message: { room_id: room_id.current, user_id: user.id, text: '' },
    };
    console.log(data);
    socketRef.current.send(JSON.stringify(data));
  };

  return (
    <Auth>
      {user == null ? (
        <div>loading</div>
      ) : (
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 font-mono flex flex-col items-center justify-center min-h-screen w-screen">
          <Head>
            <title>部屋一覧</title>
            <meta httpEquiv="cache-control" content="no-cache" />
            <meta httpEquiv="expires" content="0" />
            <meta httpEquiv="pragma" content="no-cache" />
          </Head>

          <MyNav title={room.name} />
          <div className="m-4"></div>

          <main className="flex flex-col items-center justify-start w-full h-full flex-1 container bg-slate-50 bg-opacity-40 pt-4 pb-40">
            <button className="flex-none" onClick={handleConnectBtnClicked}>
              接続
            </button>
            <div className="h-[60vh] w-full">
              <Canvas camera={{ position: [0, 0, 5] }}>
                <color attach="background" args={['rgba(255, 255, 255, 1)']} />
                <ambientLight />
                <pointLight color="white" intensity={0.1} position={[10, 10, 10]} />
                <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} />
                <MyBox />
              </Canvas>
            </div>
          </main>
        </div>
      )}
    </Auth>
  );
}
