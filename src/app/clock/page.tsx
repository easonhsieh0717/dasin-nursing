'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ClockStatus {
  isClockedIn: boolean;
  defaultCaseName?: string;
  defaultCaseCode?: string;
  defaultCaseId?: string;
  openRecord?: {
    id: string;
    clockInTime: string;
    caseName: string;
  };
}

export default function ClockPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);

  // 即時時鐘
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 取得打卡狀態
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/clock/status');
      const data = await res.json();
      if (!data.error) setClockStatus(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // 請求推播通知權限並訂閱（fire-and-forget，不影響打卡流程）
  const requestPushPermission = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
    } catch {
      // 訂閱失敗不影響打卡
    }
  };

  const handleClock = async (type: 'in' | 'out') => {
    setLoading(true);
    setMessage('');

    try {
      const location = await getLocation();

      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          lat: location?.lat,
          lng: location?.lng,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || '打卡失敗');
        setMessageType('error');
        return;
      }

      const now = new Date();
      const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setMessage(`${type === 'in' ? '上班' : '下班'}打卡成功！ ${timeStr}`);
      setMessageType('success');

      // 上班打卡成功後，嘗試訂閱推播通知（不等待結果）
      if (type === 'in') {
        requestPushPermission();
      }

      // 打卡成功後重新取得狀態
      await fetchStatus();
    } catch {
      setMessage('系統錯誤');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const isClockedIn = clockStatus?.isClockedIn ?? false;

  // 計算已上班經過時間
  let elapsedStr = '';
  if (isClockedIn && clockStatus?.openRecord?.clockInTime) {
    const diff = currentTime.getTime() - new Date(clockStatus.openRecord.clockInTime).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    elapsedStr = `${hours} 小時 ${mins} 分鐘`;
  }

  // 格式化上班時間
  let clockInTimeStr = '';
  if (clockStatus?.openRecord?.clockInTime) {
    const d = new Date(clockStatus.openRecord.clockInTime);
    clockInTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white border-b flex items-center justify-between px-4">
        <div className="flex">
          <button
            onClick={() => router.push('/clock')}
            className="px-5 py-3 font-medium text-gray-700 hover:bg-gray-100 border-b-2 border-blue-500"
          >
            打卡
          </button>
          <button
            onClick={() => router.push('/records')}
            className="px-5 py-3 font-medium text-gray-700 hover:bg-gray-100"
          >
            打卡紀錄
          </button>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-gray-600 hover:text-red-600"
        >
          登出
        </button>
      </nav>

      {/* 個案名稱顯示（使用 inline style 確保手機瀏覽器正確顯示） */}
      <div style={{
        borderBottom: '1px solid',
        borderColor: isClockedIn ? '#fdba74' : '#bfdbfe',
        backgroundColor: isClockedIn ? '#fff7ed' : '#eff6ff',
        padding: '8px 16px',
        textAlign: 'center',
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', color: isClockedIn ? '#9a3412' : '#1e40af' }}>
          {isClockedIn ? '目前正在值班中' : '目前個案'}
        </div>
        <div style={{ fontSize: '12px', marginTop: '4px', color: isClockedIn ? '#ea580c' : '#2563eb' }}>
          {clockStatus
            ? (isClockedIn
              ? <>個案：{clockStatus.openRecord?.caseName || ''} · 上班時間：{clockInTimeStr} · 已經過 {elapsedStr}</>
              : <>個案代碼：{clockStatus.defaultCaseCode || ''} · 個案名稱：{clockStatus.defaultCaseName || ''}</>
            )
            : '載入中...'
          }
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', minHeight: 'calc(100vh - 140px)' }}>
        {/* 即時時鐘 */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#1f2937', letterSpacing: '0.05em' }}>
            {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}
            <span style={{ fontSize: '1.875rem', color: '#9ca3af' }}>:{String(currentTime.getSeconds()).padStart(2, '0')}</span>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            {currentTime.getFullYear()}/{String(currentTime.getMonth()+1).padStart(2,'0')}/{String(currentTime.getDate()).padStart(2,'0')}
            {' '}
            {['日','一','二','三','四','五','六'][currentTime.getDay()]}
          </div>
        </div>

        {/* Clock buttons — 圓形設計（使用 inline style 確保手機瀏覽器正確顯示） */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
          <button
            onClick={() => handleClock('in')}
            disabled={loading || isClockedIn}
            style={{
              width: '144px', height: '144px', borderRadius: '50%', flexShrink: 0,
              background: isClockedIn ? '#9ca3af' : 'linear-gradient(135deg, #34d058, #28a745)',
              color: 'white', fontSize: '1.875rem', fontWeight: 'bold',
              border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              opacity: (loading || isClockedIn) ? 0.3 : 1,
              cursor: (loading || isClockedIn) ? 'default' : 'pointer',
            }}
          >
            上班
          </button>

          <button
            onClick={() => handleClock('out')}
            disabled={loading || !isClockedIn}
            style={{
              width: '144px', height: '144px', borderRadius: '50%', flexShrink: 0,
              background: !isClockedIn ? '#9ca3af' : 'linear-gradient(135deg, #ff6b6b, #dc3545)',
              color: 'white', fontSize: '1.875rem', fontWeight: 'bold',
              border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              opacity: (loading || !isClockedIn) ? 0.3 : 1,
              cursor: (loading || !isClockedIn) ? 'default' : 'pointer',
            }}
          >
            下班
          </button>
        </div>

        {/* Status message */}
        {message && (
          <div className={`mt-8 px-6 py-3 rounded-xl text-base font-medium ${
            messageType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        {loading && (
          <div className="mt-6 text-gray-500 text-sm">正在取得位置並打卡中...</div>
        )}
      </div>
    </div>
  );
}
