'use client';

import { useRouter, usePathname } from 'next/navigation';

const navItems = [
  { label: '打卡紀錄', path: '/admin/records' },
  { label: '特護', path: '/admin/nurses' },
  { label: '個案', path: '/admin/cases' },
  { label: '特殊狀況', path: '/admin/special' },
  { label: '費率設定', path: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white border-b flex items-center justify-between px-4">
        <div className="flex">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`px-5 py-3 font-medium transition-colors ${
                pathname === item.path
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button onClick={handleLogout} className="px-4 py-2 text-gray-600 hover:text-red-600">
          登出
        </button>
      </nav>
      {children}
    </div>
  );
}
