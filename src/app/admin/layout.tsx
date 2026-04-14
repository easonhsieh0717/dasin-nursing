'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { FileText, CheckSquare, Users, UserCog, Wallet, Receipt, CreditCard, BarChart3, AlertTriangle, Settings, Layers, LogOut } from 'lucide-react';

const navItems = [
  { label: '紀錄', path: '/admin/records', icon: FileText },
  { label: '簽核', path: '/admin/review', icon: CheckSquare },
  { label: '個案', path: '/admin/cases', icon: Users },
  { label: '特護', path: '/admin/nurses', icon: UserCog },
  { label: '代墊', path: '/admin/expenses', icon: Wallet },
  { label: '收據', path: '/admin/receipts', icon: Receipt },
  { label: '發放', path: '/admin/payroll', icon: CreditCard },
  { label: '報表', path: '/admin/dashboard', icon: BarChart3 },
  { label: '特殊狀況', path: '/admin/special', icon: AlertTriangle },
  { label: '費率方案', path: '/admin/rate-profiles', icon: Layers },
  { label: '費率', path: '/admin/settings', icon: Settings },
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
    <div className="min-h-screen">
      <nav className="bg-white/90 backdrop-blur-sm border-b border-[var(--color-primary-border)]">
        <div className="flex items-center justify-between px-2 sm:px-4">
          <div className="flex overflow-x-auto no-scrollbar min-w-0 flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`nav-item ${pathname === item.path ? 'active' : ''} px-3 sm:px-5 py-3 text-sm sm:text-base font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  pathname === item.path
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-nav-text)] hover:bg-[var(--color-nav-hover-bg)]'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-1">
            {userName && (
              <span className="text-xs sm:text-sm text-[var(--color-text-secondary)] hidden sm:inline">{userName}</span>
            )}
            <button onClick={handleLogout} className="px-2 sm:px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] whitespace-nowrap flex items-center gap-1">
              <LogOut size={15} />
              登出
            </button>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
