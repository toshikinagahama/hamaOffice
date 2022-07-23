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

export default function AddFriends(pageProps) {
  const router = useRouter();
  const [user, setUser] = useRecoilState(userState);
  const [isFetchData, setIsFetchData] = useState(false);
  const [rooms, setRooms] = useState([]);

  const adduser_id = router.query.id;

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

  const handleRoomBtnClick = async (room_id) => {
    const input_info = {
      room_id,
      adduser_id,
    };
    const token = localStorage.getItem('token');
    const res = await fetch(`${http_protcol}://${domain_db}/restricted/add_user_to_room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input_info),
    }).catch(() => null);
    const json_data = await res.json().catch(() => null);
    console.log(json_data);
    const result = json_data['result'];
    if (result == 0) {
      alert('登録完了しました。お手数ですが、再度ログインし直してください。');
      localStorage.setItem('token', null);
      router.push('/user');
    } else {
      alert(`Result: ${result}`);
    }
  };

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
          <MyNav title="部屋に追加" />
          <main className="flex flex-col items-center justify-start w-full flex-1 container bg-zinc-100 space-y-2">
            <p>追加したい部屋を選択してください</p>
            {rooms.map((room, index) => {
              return (
                <div
                  key={index}
                  onClick={(e) => handleRoomBtnClick(room.id)}
                  className="w-9/12 max-w-md border-2 border-zinc-300 py-2 px-4 flex rounded-lg cursor-pointer"
                >
                  <div className="">
                    <img
                      className="w-16 h-16 shadow-lg rounded-full mx-2 object-contain"
                      src={room.icon}
                      alt={''}
                    />
                  </div>
                  <div className="flex-grow text-left px-4 py-2 flex flex-col justify-center">
                    <p className="text-sm mb-1">{room.name}</p>
                  </div>
                </div>
              );
            })}
          </main>
        </div>
      )}
    </Auth>
  );
}
