import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState, useEffect, useRef } from 'react';
import { userState } from '../../components/atoms';
import { useRecoilState } from 'recoil';
import { domain_db, http_protcol, ws_protcol } from '../../global';
import { FaUser } from 'react-icons/fa';
import { isMobile } from 'react-device-detect';
import Auth from '../../components/auth';
import MyNav from '../../components/nav';

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
  const refVideo = useRef(null);
  const refVideo2 = useRef(null);
  const [active_users, setActive_users] = useState({}); //{user_id: {pos: {x:0, y:0, z: 0}, lookat: {x:0,y:0,z:0}, is_offer: boolean, peer: PeerConnection, panner: Panner}}

  const [isFetchData, setIsFetchData] = useState(false);
  const [room, setRoom] = useState([]);
  const audioctx = useRef(null);
  const destination = useRef(null);
  const panner = useRef(null);
  const pc = useRef(null);
  const localStream = useRef(null);
  const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1,
  };

  function prepareNewConnection(command, to_user_id) {
    let pc_config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    //let pc_config = { offerToReceiveAudio: 1, offerToReceiveVideo: 1, iceServers: [] };
    let peer = new RTCPeerConnection(pc_config);

    peer.ontrack = function (event) {
      console.log('-- peer.ontrack(): track kind=' + event.track.kind);
      let stream = event.streams[0];
      console.log(event);
      let audio = new Audio();
      audio.srcObject = stream;
      audio.onloadedmetadata = () => {
        console.log('loaded audio');
        let source = audioctx.current.createMediaStreamSource(stream);
        let gainNode = audioctx.current.createGain();
        gainNode.gain.value = 1.0;
        let panner = new PannerNode(audioctx.current, { panningModel: 'HRTF' });
        panner.positionX.value = -1.0;
        source.connect(gainNode).connect(panner).connect(destination.current);
        audioctx.current.resume();
      };
    };
    if (localStream.current) {
      console.log('Adding local stream...');
      //console.log(localStream.current);
      localStream.current.getTracks().forEach(function (track) {
        //console.log(track);
        //peer.addTrack(track);
        peer.addTrack(track, localStream.current);
      });
      //peer.addStream(localStream.current);
    } else {
      console.warn('no local stream, but continue.');
    }

    // --- on get local ICE candidate
    peer.onicecandidate = function (evt) {
      if (evt.candidate) {
        //console.log(evt.candidate);
        //peer.addIceCandidate(evt.candidate);
      } else {
        console.log('empty ice event');
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

  function getDeviceStream(option) {
    if ('getUserMedia' in navigator.mediaDevices) {
      console.log('navigator.mediaDevices.getUserMadia');
      return navigator.mediaDevices.getUserMedia(option);
    } else {
      console.log('wrap navigator.getUserMadia with Promise');
      return new Promise(function (resolve, reject) {
        navigator.getUserMedia(option, resolve, reject);
      });
    }
  }

  useEffect(async () => {
    if (user == null) {
      return;
    }
    const token = localStorage.getItem('token');
    if (socketRef.current == null)
      socketRef.current = new WebSocket(`${ws_protcol}://${domain_db}/ws`);
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
              break;
            case 1:
              //const m = json_data['message'];
              //  let m_new = {
              //    text: m.text,
              //    from_id: tmp_user.id,
              //  };
              break;
            case 2:
              //接続要求された側の処理
              pc.current = prepareNewConnection(2, json_data['to_user_id']);
              let dataChannelOptions = {
                ordered: false,
              };
              let dataChannel = pc.current.createDataChannel(
                'test-data-channel',
                dataChannelOptions
              );
              pc.current
                .createOffer(offerOptions)
                .then(function (sessionDescription) {
                  console.log('createOffer() succsess in promise');
                  return pc.current.setLocalDescription(sessionDescription);
                })
                .then(function () {})
                .catch(function (err) {
                  console.error(err);
                });
              break;
            case 3:
              //接続要求した側の処理
              let offer = new RTCSessionDescription({
                type: 'offer',
                sdp: json_data['message'],
              });
              if (pc.current) {
                console.error('peerConnection alreay exist!');
              } else {
                pc.current = prepareNewConnection(3, json_data['from_user_id']);
                pc.current
                  .setRemoteDescription(offer)
                  .then(function () {
                    console.log('setRemoteDescription(offer) succsess in promise');
                    pc.current
                      .createAnswer()
                      .then(function (sessionDescription) {
                        console.log('createAnswer() succsess in promise');
                        pc.current.ondatachannel = function (evt) {
                          //console.log('Data channel created:', evt);
                          //setupDataChannel(evt.channel);
                          //dataChannel = evt.channel;
                        };
                        return pc.current.setLocalDescription(sessionDescription);
                      })
                      .then(function () {
                        console.log('setLocalDescription() succsess in promise');
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
              if (!pc.current) {
                console.error('peerConnection NOT exist!');
                return;
              }
              let answer = new RTCSessionDescription({
                type: 'answer',
                sdp: json_data['message'],
              });

              pc.current
                .setRemoteDescription(answer)
                .then(function () {
                  console.log('setRemoteDescription(answer) succsess in promise');
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

    refUser_id.current = user.id;
    return () => {
      console.log('Disconnecting..');
      socketRef.current.close();
      // removeListeners?.();
    };
  }, [user]);

  useEffect(() => {}, [user]);

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

  const handleStartVoiceBtnClicked = (e) => {
    audioctx.current.resume();
    console.log('resume');
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

          <main className="flex flex-col items-center justify-start w-full flex-1 container bg-slate-50 bg-opacity-40 pt-4 pb-40">
            <button onClick={handleConnectBtnClicked}>接続</button>
            <button onClick={handleStartVoiceBtnClicked}>音声開始</button>
            <video
              ref={refVideo}
              autoPlay={true}
              width={300}
              height={200}
              controls
              className="border-gray-50"
              style={{ width: '300px', height: '200px' }}
            ></video>
            <video
              ref={refVideo2}
              autoPlay={true}
              width={300}
              height={200}
              controls
              className="border-gray-50"
              style={{ width: '300px', height: '200px' }}
            ></video>
          </main>
        </div>
      )}
    </Auth>
  );
}
