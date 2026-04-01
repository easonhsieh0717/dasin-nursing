'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 3000);
  }, []);

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
  };

  const styles: Record<ToastType, { bg: string; border: string; color: string; Icon: typeof CheckCircle }> = {
    success: { bg: '#e8f5ea', border: '#c8e6c9', color: '#3d7a47', Icon: CheckCircle },
    error: { bg: '#fce8e8', border: '#f5c6c6', color: '#b5403d', Icon: XCircle },
    info: { bg: '#fce8e4', border: '#f0ddd8', color: '#e8776f', Icon: Info },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => {
          const s = styles[t.type];
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 18px',
                borderRadius: 14,
                backgroundColor: s.bg,
                border: `1px solid ${s.border}`,
                color: s.color,
                fontSize: 14,
                fontWeight: 500,
                boxShadow: '0 4px 16px rgba(180,120,100,0.15)',
                animation: t.exiting ? 'toastOut 0.3s ease-in forwards' : 'toastIn 0.3s ease-out',
                pointerEvents: 'auto',
                maxWidth: 340,
              }}
            >
              <s.Icon size={18} style={{ flexShrink: 0 }} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
