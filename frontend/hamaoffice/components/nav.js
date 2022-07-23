import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState, useEffect } from 'react';

export default function MyNav(props) {
  const router = useRouter();
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setIsShowMenuContent(true);
    } else {
      setIsShowMenuContent(false);
    }
  }, []);

  const handleLogoutBtnClick = (e) => {
    localStorage.setItem('token', null);
    router.push('/');
  };

  const [isShowMenuContent, setIsShowMenuContent] = useState(false);

  return (
    <nav className="sticky top-0 flex items-center justify-between w-full flex-wrap bg-slate-50 bg-opacity-40  p-4">
      <div className="flex items-center flex-no-shrink text-white mr-6">
        <span className="font-semibold text-gray-700 text-xl tracking-tight">{props.title}</span>
      </div>
      <div className="block lg:hidden">
        <button
          className="flex items-center px-3 py-2 border rounded text-teal-lighter border-teal-light hover:text-white hover:border-white"
          onClick={() => {
            setIsShowMenuContent(!isShowMenuContent);
          }}
        >
          <svg
            className="h-3 w-3 fill-white"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>Menu</title>
            <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" />
          </svg>
        </button>
      </div>
      <div className="w-full block flex-grow lg:flex lg:items-center lg:w-auto lg:justify-end">
        {isShowMenuContent && (
          <div className="animate-fade-in-down">
            <div className="text-sm lg:flex-grow">
              <Link href="/user">
                <a
                  href="#"
                  className="block mt-4 lg:inline-block lg:mt-0 text-teal-lighter hover:text-white mr-4"
                >
                  部屋一覧
                </a>
              </Link>
              <Link href="/user_setting">
                <a
                  href="#"
                  className="block mt-4 lg:inline-block lg:mt-0 text-teal-lighter hover:text-white mr-4"
                >
                  自分の設定
                </a>
              </Link>
              <Link href="/create_room">
                <a
                  href="#"
                  className="block mt-4 lg:inline-block lg:mt-0 text-teal-lighter hover:text-white mr-4"
                >
                  部屋を作る
                </a>
              </Link>
              <button
                href="#"
                className="inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-teal hover:bg-white mt-4 lg:mt-0"
                onClick={handleLogoutBtnClick}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
