'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Spinner from '@/components/Spinner';

function PasswordRuleItem({ passed, text }: { passed: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${passed ? 'text-green-600' : 'text-[var(--color-text-muted)]'}`}>
      <span className="text-base">{passed ? '✓' : '○'}</span>
      {text}
    </li>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isForced = searchParams.get('forced') !== 'false'; // forced by default
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const rules = {
    length: newPw.length >= 8,
    upper: /[A-Z]/.test(newPw),
    lower: /[a-z]/.test(newPw),
    digit: /[0-9]/.test(newPw),
    match: newPw.length > 0 && newPw === confirm,
  };
  const allPassed = Object.values(rules).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!allPassed) { setError('請確認所有密碼規則都符合'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPw, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '修改失敗'); return; }
      router.push('/clock');
    } catch {
      setError('系統錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/request-password-reset', { method: 'POST' });
      if (res.ok) { setResetRequested(true); }
      else { const d = await res.json(); setError(d.error || '申請失敗'); }
    } catch { setError('系統錯誤'); }
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="warm-card p-8 w-full max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-warm-100)] flex items-center justify-center">
            <ShieldCheck size={32} style={{ color: 'var(--color-primary)' }} />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center mb-1 text-[var(--color-text-primary)]">
          {isForced ? '首次登入請修改密碼' : '修改密碼'}
        </h1>
        <p className="text-center text-sm text-[var(--color-text-muted)] mb-6">
          {isForced ? '為保障帳號安全，請設定新密碼' : '請輸入目前密碼及新密碼'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">目前密碼</label>
            <div className="relative">
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="請輸入目前密碼"
                className="w-full pl-10 pr-10 py-2"
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">新密碼</label>
            <div className="relative">
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="請輸入新密碼"
                className="w-full pl-10 pr-10 py-2"
                required
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">確認新密碼</label>
            <div className="relative">
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="請再次輸入新密碼"
                className="w-full pl-10 pr-10 py-2"
                required
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Rules checklist */}
          <div className="bg-[var(--color-warm-50)] rounded-lg p-3">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">密碼規則</p>
            <ul className="space-y-1">
              <PasswordRuleItem passed={rules.length} text="至少 8 個字元" />
              <PasswordRuleItem passed={rules.upper} text="包含大寫字母 (A-Z)" />
              <PasswordRuleItem passed={rules.lower} text="包含小寫字母 (a-z)" />
              <PasswordRuleItem passed={rules.digit} text="包含數字 (0-9)" />
              <PasswordRuleItem passed={rules.match} text="兩次輸入密碼一致" />
            </ul>
          </div>

          {error && <div className="text-[var(--color-danger)] text-sm text-center">{error}</div>}

          <button
            type="submit"
            disabled={loading || !allPassed}
            className="w-full py-3 btn-primary text-base disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Spinner size="sm" /> : <ShieldCheck size={18} />}
            {loading ? '修改中...' : '確認修改密碼'}
          </button>

          {!isForced && (
            <button type="button" onClick={() => router.back()} className="w-full py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
              取消
            </button>
          )}
        </form>

        {/* 忘記密碼 / 申請重設 */}
        <div className="mt-4 border-t border-[var(--color-primary-border)] pt-4 text-center">
          {resetRequested ? (
            <p className="text-sm text-green-600 font-medium">✓ 已送出申請，請聯絡管理員處理</p>
          ) : (
            <>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">忘記目前密碼？</p>
              <button
                onClick={handleRequestReset}
                disabled={resetLoading}
                className="text-sm text-[var(--color-primary)] hover:underline disabled:opacity-50"
              >
                {resetLoading ? '申請中...' : '申請管理員重設密碼'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense>
      <ChangePasswordForm />
    </Suspense>
  );
}
