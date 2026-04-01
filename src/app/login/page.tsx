'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Hash, User, Lock, LogIn } from 'lucide-react';
import Spinner from '@/components/Spinner';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, account, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '登入失敗');
        return;
      }

      if (data.user.role === 'admin') {
        router.push('/admin/records');
      } else {
        router.push('/clock');
      }
    } catch {
      setError('系統錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="warm-card p-8 w-full max-w-md mx-3">
        <div className="flex justify-center mb-3">
          <img src="/logo.png" alt="達心" className="w-20 h-20 object-contain rounded-2xl" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 text-[var(--color-text-primary)]">
          達心特護打卡系統
        </h1>
        <p className="text-center text-sm text-[var(--color-text-muted)] mb-6">v{process.env.APP_VERSION?.replace(/\.0$/, '')}</p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              代碼 <span className="text-[var(--color-text-muted)] font-normal">（管理員可不填）</span>
            </label>
            <div className="relative">
              <Hash size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="特護請輸入代碼"
                className="w-full pl-10 pr-4 py-2"
                autoComplete="organization"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              帳號
            </label>
            <div className="relative">
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="請輸入帳號"
                className="w-full pl-10 pr-4 py-2"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              密碼
            </label>
            <div className="relative">
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
                className="w-full pl-10 pr-4 py-2"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-[var(--color-danger)] text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 btn-primary text-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Spinner size="sm" /> : <LogIn size={18} />}
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}
