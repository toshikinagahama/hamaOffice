import Head from 'next/head';
import Link from 'next/link';
import React, { useState, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { domain_db, http_protcol, human_icon } from '../global';
import { useRouter } from 'next/router';
import Auth from '../components/auth';
import MyNav from '../components/nav';

export default function User(pageProps) {
  const router = useRouter();
  const [roomname, setRoomname] = useState('');
  const [sercret_key, setSercret_key] = useState('');

  useEffect(async () => {}, []);

  const handleRoomnameChange = (e) => {
    setRoomname(e.target.value);
  };

  const handleSercret_keyChange = (e) => {
    setSercret_key(e.target.value);
  };

  const handleSubmitBtnClick = async (e) => {
    if (roomname != '') {
      const input_info = {
        roomname,
        sercret_key,
      };
      const token = localStorage.getItem('token');
      const res = await fetch(`${http_protcol}://${domain_db}/restricted/create_room`, {
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
    } else {
      alert('input room name');
    }
  };

  return (
    <Auth>
      <Head>
        <title>部屋の作成</title>
        <meta httpEquiv="cache-control" content="no-cache" />
        <meta httpEquiv="expires" content="0" />
        <meta httpEquiv="pragma" content="no-cache" />
      </Head>
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 font-mono min-h-screen flex flex-col">
        <MyNav title="部屋の作成" />
        <div className="container max-w-sm mx-auto flex-1 flex flex-col items-center justify-center px-2">
          <div className="bg-slate-50 bg-opacity-40 px-6 py-8 rounded shadow-md text-black w-full">
            <h1 className="mb-8 text-xl text-center">部屋を作成する</h1>
            <input
              type="text"
              value={roomname}
              className="block border border-grey-light w-full p-3 rounded mb-4"
              placeholder="Room name"
              onChange={handleRoomnameChange}
            />

            <input
              type="password"
              className="block border border-grey-light w-full p-3 rounded mb-4"
              placeholder="Sercret Key"
              onChange={handleSercret_keyChange}
            />

            <button
              type="submit"
              className="w-full text-center py-3 rounded bg-slate-500 bg-opacity-90 shadow-md text-white hover:bg-green-dark focus:outline-none my-1"
              onClick={handleSubmitBtnClick}
            >
              作成
            </button>
          </div>
        </div>
      </div>
    </Auth>
  );
}
