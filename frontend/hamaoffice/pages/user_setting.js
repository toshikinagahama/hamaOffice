import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState, useEffect, useRef } from 'react';
import { userState } from '../components/atoms';
import { useRecoilState } from 'recoil';
import Auth from '../components/auth';
import MyNav from '../components/nav';
import { domain_db, domain, http_protcol, human_icon } from '../global';
import QRCode from 'qrcode.react';

export default function UserSetting(pageProps) {
  const canvasRef = useRef();
  const [user, setUser] = useRecoilState(userState);
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [canvasPos, setCanvasPos] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [clipImage, setClipImage] = useState('');

  const [isFetchData, setIsFetchData] = useState(false);
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    if (user == null) {
      return;
    }

    const fetchData = async () => {
      if (!isFetchData) {
        const token = localStorage.getItem('token');
        const res = await fetch(`${http_protcol}://${domain_db}/restricted/get_rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            room_ids: user.room_ids,
          }),
        }).catch(() => null);
        if (res != null) {
          const json_data = await res.json().catch(() => null);
          if (json_data['result'] != null) {
            if (json_data['result'] === 0) {
              const res_rooms = json_data['rooms'];
              setIsFetchData(true);
              const rooms_new = [];
              res_rooms.map((r, index) => {
                if (r.icon == '') {
                  r.icon = human_icon;
                }
                rooms_new.push({
                  id: r.id,
                  name: r.name,
                  icon: r.icon,
                  num_unread: 0,
                  last_update: new Date(),
                  last_message: '',
                });
              });
              setRooms([...rooms, ...rooms_new]);
            }
          }
        }
      }
    };
    fetchData();
  }, [rooms, user]);

  const handleImageChange = (e) => {
    let reader = new FileReader();
    reader.onload = function (event) {
      let img = new Image();
      img.onload = function () {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
        setImageSize({ w: img.width, h: img.height });
        let ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(
          img,
          0,
          0
          // this.width,
          // this.height,
          // 0,
          // 0,
          // canvasRef.current.width,
          // canvasRef.current.height
        );
        console.log('load image');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
  };

  const handleUpdateIconButton = async () => {
    const token = localStorage.getItem('token');
    if (canvasRef.current.style.left == '') canvasRef.current.style.left = '0px';
    if (canvasRef.current.style.top == '') canvasRef.current.style.top = '0px';
    //新しいキャンバスを作って描画
    let cvs = document.createElement('canvas');
    let toCtx = cvs.getContext('2d');
    let left = parseInt(canvasRef.current.style.left);
    let top = parseInt(canvasRef.current.style.top);
    let s = parseFloat(canvasScale);
    cvs.width = 240;
    cvs.height = 240;
    toCtx.fillStyle = 'rgb(200, 0, 0)';
    toCtx.fillRect(0, 0, 240, 240);
    toCtx.drawImage(
      canvasRef.current,
      left + (imageSize.w * (1 - s)) / 2,
      top + (imageSize.h * (1 - s)) / 2,
      imageSize.w * parseFloat(canvasScale),
      imageSize.h * parseFloat(canvasScale)
    );
    // let image = cvs.toDataURL();
    // setClipImage(image);

    //base64に変換
    let image_base64 = cvs.toDataURL('image/jpeg');
    // image_base64 = image_base64.replace('data:image/jpeg;base64,', '');
    let data = {
      icon: image_base64,
    };
    console.log(data);
    const res = await fetch(`${http_protcol}://${domain_db}/restricted/update_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }).catch(() => null);
    if (res != null) {
      console.log(res);
      const json_data = await res.json().catch(() => null);
      console.log(json_data);
      if (json_data['result'] != null) {
        if (json_data['result'] === 0) {
        }
      }
    }
  };

  const handleCanvasMove = (e) => {
    let canvas = canvasRef.current;
    if (e.changedTouches.length == 0) {
      return;
    }
    let pos = { x: e.changedTouches[0].pageX, y: e.changedTouches[0].pageY };
    canvas.style.left = canvasPos.x + pos.x - touchStartPos.x + 'px';
    canvas.style.top = canvasPos.y + pos.y - touchStartPos.y + 'px';
    //本当は制限したい
    // if (parseInt(canvas.style.left) + (imageSize.w - canvasScale * imageSize.w) / 2 > 0) {
    //   canvas.style.left = '0px';
    // }
    // if (parseInt(canvas.style.left) + canvasScale * imageSize.w < 240) {
    //   canvas.style.left = 240 - canvasScale * imageSize.w + 'px';
    // }
    // if (parseInt(canvas.style.top) > 0) {
    //   canvas.style.top = '0px';
    // }
  };

  const handleCanvasScaleChange = (e) => {};

  return (
    <Auth>
      {user == null ? (
        <div>Loading</div>
      ) : (
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 font-mono flex flex-col items-center justify-center min-h-screen w-full">
          <Head>
            <title>自分の設定</title>
            <meta httpEquiv="cache-control" content="no-cache" />
            <meta httpEquiv="expires" content="0" />
            <meta httpEquiv="pragma" content="no-cache" />
          </Head>
          <MyNav title="自分の設定" />
          <div className="m-4"></div>
          <main className="flex flex-col items-center justify-start w-full flex-1 container bg-slate-50 bg-opacity-40 space-y-8">
            <div>
              <p>あなたの名前: {user.name}</p>
            </div>
            {/* <div>
              <p>あなたのID: {user.id}</p>
            </div> */}
            <div className="flex flex-col justify-center items-center">
              <p className="mb-4">アイコンを変える</p>
              {user.icon == '' ? (
                <p className="text-sm">アイコンは設定されていません</p>
              ) : (
                <div>
                  <p className="text-xs">現在のアイコン</p>
                  <div className="w-24 h-24 rounded-full bg-slate-400 bg-opacity-50">
                    <img src={user.icon} width={240} height={240} />
                  </div>
                </div>
              )}
              <div className="mt-4 w-[240px] h-[240px] rounded-full overflow-hidden border-2 border-opacity-25 z-10">
                <div className="w-[240px] h-[240px] relative">
                  <canvas
                    ref={canvasRef}
                    width={240}
                    height={240}
                    className="bg-slate-100 absolute touch-none top-0 left-0"
                    onTouchStart={(e) => {
                      setTouchStartPos({ x: e.touches[0].pageX, y: e.touches[0].pageY });
                    }}
                    onTouchMove={(e) => {
                      handleCanvasMove(e);
                    }}
                    onTouchEnd={(e) => {
                      setCanvasPos({
                        x: parseInt(canvasRef.current.style.left),
                        y: parseInt(canvasRef.current.style.top),
                      });
                    }}
                  />
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={canvasScale}
                className="w-full max-w-xs mt-4"
                onChange={(e) => {
                  setCanvasScale(e.target.value);
                  canvasRef.current.style.transform = `scale(${e.target.value})`;
                }}
              />
              <button
                onClick={handleUpdateIconButton}
                className="text-sm w-full max-w-xs py-2 m-4 text-gray-600 rounded-md bg-white bg-opacity-90 shadow-lg shadow-cyan-700"
              >
                アイコン更新
              </button>
              <div className="flex justify-center mt-8">
                <div className="rounded-lg shadow-xl bg-gray-50 lg:w-1/2  max-w-xs">
                  <div className="m-4">
                    <label className="inline-block mb-2 text-gray-500 text-xs">
                      Upload Image(jpg,png,jpeg)
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col w-full h-16 border-4 border-dashed hover:bg-gray-100 hover:border-gray-300">
                        <div className="flex flex-col items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-8 h-8 text-gray-400 group-hover:text-gray-600"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <p className="pt-1 text-sm tracking-wider text-gray-400 group-hover:text-gray-600">
                            Select a photo
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*, image/heic"
                          className="opacity-0"
                          onChange={handleImageChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <p>あなたのQRコード</p>
              <div>
                <QRCode value={`${http_protcol}://${domain}/add_user_to_room?id=${user.id}`} />
              </div>
            </div>
            {/* <p>シークレットコード：1234</p> */}
          </main>
        </div>
      )}
    </Auth>
  );
}
