'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour
const EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export default function IdleLogout() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    router.push('/login');
  }, [router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, IDLE_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    // Don't run on login page
    if (pathname === '/login') return;

    resetTimer();

    for (const event of EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [pathname, resetTimer]);

  return null;
}
