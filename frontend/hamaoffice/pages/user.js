import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState, useEffect, useRef } from 'react';
import { userState } from '../components/atoms';
import { useRecoilState } from 'recoil';
import Auth from '../components/auth';
import MyNav from '../components/nav';
import { domain_db, domain, http_protcol, human_icon } from '../global';
import { MdMeetingRoom } from 'react-icons/md';
import QRCode from 'qrcode.react';

export default function User(pageProps) {
  const [user, setUser] = useRecoilState(userState);

  const [isFetchData, setIsFetchData] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [inviteUrl, setInviteUrl] = useState(null);

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
          body: JSON.stringify({}),
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

  const handleInviteClick = async (e, room_id) => {
    e.preventDefault();
    e.stopPropagation();
    const token = localStorage.getItem('token');
    const res = await fetch(`${http_protcol}://${domain_db}/restricted/create_invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ room_id }),
    }).catch(() => null);
    const json_data = await res.json().catch(() => null);
    if (json_data && json_data.result === 0) {
      setInviteUrl(`${http_protcol}://${domain}/join?invite_token=${json_data.invite_token}`);
    } else {
      alert('招待リンクの発行に失敗しました');
    }
  };

  return (
    <Auth>
      {user == null ? (
        <div>Loading</div>
      ) : (
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 font-mono flex flex-col items-center justify-center min-h-screen w-full">
          <Head>
            <title>部屋一覧</title>
            <meta httpEquiv="cache-control" content="no-cache" />
            <meta httpEquiv="expires" content="0" />
            <meta httpEquiv="pragma" content="no-cache" />
          </Head>
          <MyNav title="あなたの部屋" />
          <main className="flex flex-col items-center justify-start w-full flex-1 container">
            <div className="m-4"></div>
            {rooms.map((room, index) => {
              return (
                <div
                  key={index}
                  className="w-full text-gray-700 border-[1px] border-opacity-30 rounded-md bg-slate-50 bg-opacity-40 py-4 flex mb-4 mt-4"
                >
                  <Link href={'/room/' + room.id} className="flex-grow">
                    <a className="flex-grow flex">
                      <div className="flex flex-col justify-center items-center w-16 h-16 shadow-lg rounded-full bg-slate-50 bg-opacity-20 mx-2">
                        <div className="flex flex-row justify-center items-center rounded-full">
                          <MdMeetingRoom size="2.5rem" />
                        </div>
                      </div>
                      <div className="flex-grow text-left px-4 py-2 flex flex-col justify-center">
                        <p className="text-md mb-1">{room.name}</p>
                      </div>
                    </a>
                  </Link>
                  <button
                    className="text-xs px-3 mr-4 rounded bg-white bg-opacity-90 shadow"
                    onClick={(e) => handleInviteClick(e, room.id)}
                  >
                    招待
                  </button>
                </div>
              );
            })}
          </main>
          {inviteUrl && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
              onClick={() => setInviteUrl(null)}
            >
              <div
                className="bg-white rounded-md p-6 flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-4 text-sm text-gray-700">
                  このQRコード/リンクは10分間有効です
                </p>
                <QRCode value={inviteUrl} />
                <p className="mt-4 text-xs break-all max-w-xs text-gray-500">{inviteUrl}</p>
                <button
                  className="mt-4 text-sm px-4 py-2 bg-neutral-800 text-white rounded-md"
                  onClick={() => setInviteUrl(null)}
                >
                  閉じる
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Auth>
  );
}
