'use client';

import { ToastProvider } from './Toast';
import IdleLogout from './IdleLogout';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <IdleLogout />
      {children}
    </ToastProvider>
  );
}
