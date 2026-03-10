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

  // 個案顯示名稱
  const caseName = isClockedIn
    ? (clockStatus?.openRecord?.caseName || '')
    : (clockStatus?.defaultCaseName || '—');

  // 圓形按鈕共用樣式（完全用 inline style，確保手機瀏覽器相容）
  const circleButtonBase: React.CSSProperties = {
    WebkitAppearance: 'none',
    MozAppearance: 'none' as never,
    appearance: 'none',
    width: '130px',
    height: '130px',
    minWidth: '130px',
    minHeight: '130px',
    maxWidth: '130px',
    maxHeight: '130px',
    borderRadius: '50%',
    WebkitBorderRadius: '50%' as never,
    flexShrink: 0,
    flexGrow: 0,
    color: 'white',
    fontSize: '1.75rem',
    fontWeight: 'bold',
    border: 'none',
    outline: 'none',
    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
    padding: '0',
    margin: '0',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    textAlign: 'center',
    overflow: 'hidden',
  };

  // 橫幅背景色：值班中=橘色，未打卡=藍色
  const bannerBg = isClockedIn ? '#ea580c' : '#2563eb';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Navbar */}
      <nav style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex' }}>
          <button
            onClick={() => router.push('/clock')}
            style={{
              padding: '12px 20px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'transparent',
              borderBottom: '2px solid #3b82f6',
              cursor: 'pointer',
            }}
          >
            打卡
          </button>
          <button
            onClick={() => router.push('/records')}
            style={{
              padding: '12px 20px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            打卡紀錄
          </button>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            color: '#6b7280',
            backgroundColor: 'transparent',
            cursor: 'pointer',
          }}
        >
          登出
        </button>
      </nav>

      {/* 主內容區：個案名稱 + 時間 + 按鈕 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        minHeight: 'calc(100vh - 56px)',
      }}>

        {/* 個案名稱 — 貼在時間上方，大字醒目 */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: isClockedIn ? '#ea580c' : '#2563eb',
            letterSpacing: '0.05em',
          }}>
            {clockStatus ? caseName : '載入中...'}
          </div>
          {isClockedIn && (
            <div style={{ fontSize: '13px', color: '#ea580c', marginTop: '4px' }}>
              🟠 值班中 · 上班 {clockInTimeStr} · 已 {elapsedStr}
            </div>
          )}
          {!isClockedIn && clockStatus && (
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              個案代碼：{clockStatus.defaultCaseCode || '—'}
            </div>
          )}
        </div>

        {/* 即時時鐘 */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{
            fontSize: '3rem',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: '#1f2937',
            letterSpacing: '0.05em',
          }}>
            {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}
            <span style={{ fontSize: '1.875rem', color: '#9ca3af' }}>
              :{String(currentTime.getSeconds()).padStart(2, '0')}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
            {currentTime.getFullYear()}/{String(currentTime.getMonth()+1).padStart(2,'0')}/{String(currentTime.getDate()).padStart(2,'0')}
            {' '}
            {['日','一','二','三','四','五','六'][currentTime.getDay()]}
          </div>
        </div>

        {/* 打卡按鈕 — 兩個圓形並排 */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}>
          {/* 上班按鈕 */}
          <button
            onClick={() => handleClock('in')}
            disabled={loading || isClockedIn}
            style={{
              ...circleButtonBase,
              background: isClockedIn ? '#9ca3af' : 'linear-gradient(135deg, #34d058, #28a745)',
              opacity: (loading || isClockedIn) ? 0.3 : 1,
              cursor: (loading || isClockedIn) ? 'default' : 'pointer',
            }}
          >
            上班
          </button>

          {/* 下班按鈕 */}
          <button
            onClick={() => handleClock('out')}
            disabled={loading || !isClockedIn}
            style={{
              ...circleButtonBase,
              background: !isClockedIn ? '#9ca3af' : 'linear-gradient(135deg, #ff6b6b, #dc3545)',
              opacity: (loading || !isClockedIn) ? 0.3 : 1,
              cursor: (loading || !isClockedIn) ? 'default' : 'pointer',
            }}
          >
            下班
          </button>
        </div>

        {/* 狀態訊息 */}
        {message && (
          <div style={{
            marginTop: '2rem',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '500',
            backgroundColor: messageType === 'success' ? '#f0fdf4' : '#fef2f2',
            color: messageType === 'success' ? '#15803d' : '#b91c1c',
            border: messageType === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
          }}>
            {message}
          </div>
        )}

        {loading && (
          <div style={{ marginTop: '24px', color: '#6b7280', fontSize: '14px' }}>
            正在取得位置並打卡中...
          </div>
        )}
      </div>
    </div>
  );
}
