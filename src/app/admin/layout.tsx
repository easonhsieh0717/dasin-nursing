'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const navItems = [
  { label: '紀錄', path: '/admin/records' },
  { label: '特護', path: '/admin/nurses' },
  { label: '個案', path: '/admin/cases' },
  { label: '特殊狀況', path: '/admin/special' },
  { label: '費率', path: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.name) setUserName(d.name); })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b">
        <div className="flex items-center justify-between px-2 sm:px-4">
          <div className="flex overflow-x-auto no-scrollbar">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`px-3 sm:px-5 py-3 text-sm sm:text-base font-medium whitespace-nowrap transition-colors ${
                  pathname === item.path
                    ? 'text-blue-600 border-b-2 border-blue-500'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1">
            {userName && (
              <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline">{userName}</span>
            )}
            <button onClick={handleLogout} className="px-2 sm:px-4 py-2 text-sm text-gray-600 hover:text-red-600 whitespace-nowrap">
              登出
            </button>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
