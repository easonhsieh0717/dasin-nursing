'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Clock, ClipboardList, Wallet, BookOpen, LogOut, KeyRound } from 'lucide-react';

const navItems: { label: string; path: string; icon: typeof Clock; external?: boolean }[] = [
  { label: '打卡', path: '/clock', icon: Clock },
  { label: '打卡紀錄', path: '/records', icon: ClipboardList },
  { label: '代墊費用', path: '/expenses', icon: Wallet },
  { label: '操作說明', path: '/guide.html', icon: BookOpen, external: true },
];

export default function EmployeeNav() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <nav style={{
      backgroundColor: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--color-primary-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
    }}>
      <div style={{ display: 'flex' }}>
        {navItems.map(item => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => item.external ? window.open(item.path, '_blank') : router.push(item.path)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{
                padding: '12px 16px',
                fontWeight: 500,
                color: isActive ? 'var(--color-primary)' : 'var(--color-nav-text)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 14,
              }}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => router.push('/change-password')}
          title="修改密碼"
          style={{
            padding: '8px 10px',
            color: pathname === '/change-password' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
          }}
        >
          <KeyRound size={15} />
          <span className="hidden sm:inline">密碼</span>
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 10px',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 14,
          }}
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">登出</span>
        </button>
      </div>
    </nav>
  );
}
