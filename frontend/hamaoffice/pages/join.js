import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useState, useEffect } from 'react';
import { userState } from '../components/atoms';
import { useRecoilState } from 'recoil';
import Auth from '../components/auth';
import MyNav from '../components/nav';
import { domain_db, http_protcol } from '../global';

export default function Join() {
  const router = useRouter();
  const [user] = useRecoilState(userState);
  const [status, setStatus] = useState('joining'); // joining | success | error
  const [message, setMessage] = useState('');
  const invite_token = router.query.invite_token;

  useEffect(() => {
    if (user == null || !invite_token) return;

    const doJoin = async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${http_protcol}://${domain_db}/restricted/join_room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invite_token }),
      }).catch(() => null);
      if (res == null) {
        setStatus('error');
        setMessage('サーバーに接続できませんでした');
        return;
      }
      const json_data = await res.json().catch(() => null);
      if (json_data && json_data.result === 0) {
        setStatus('success');
        setTimeout(() => router.push(`/room/${json_data.room_id}`), 1000);
      } else {
        setStatus('error');
        setMessage('招待リンクが無効か期限切れです');
      }
    };
    doJoin();
  }, [user, invite_token]);

  return (
    <Auth>
      <Head>
        <title>部屋に参加</title>
      </Head>
      <div className="bg-gradient-to-r from-cyan-500 to-blue-500 font-mono min-h-screen flex flex-col">
        <MyNav title="部屋に参加" />
        <div className="container max-w-sm mx-auto flex-1 flex flex-col items-center justify-center px-2">
          <div className="bg-slate-50 bg-opacity-40 px-6 py-8 rounded shadow-md text-black w-full text-center">
            {status === 'joining' && <p>参加処理中...</p>}
            {status === 'success' && <p>参加しました。部屋に移動します。</p>}
            {status === 'error' && <p className="text-red-600">{message}</p>}
          </div>
        </div>
      </div>
    </Auth>
  );
}
