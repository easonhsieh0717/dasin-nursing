'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EmployeeNav from '@/components/EmployeeNav';
import { useToast } from '@/components/Toast';
import Spinner from '@/components/Spinner';

interface ClockStatus {
  isClockedIn: boolean;
  defaultCaseName?: string;
  defaultCaseCode?: string;
  defaultCaseId?: string;
  account?: string;
  openRecord?: {
    id: string;
    clockInTime: string;
    caseName: string;
  };
}

export default function ClockPage() {
  const router = useRouter();
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const remindTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/clock/status');
      const data = await res.json();
      if (!data.error) setClockStatus(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const startRemindTimer = useCallback(() => {
    if (remindTimerRef.current) clearInterval(remindTimerRef.current);
    remindTimerRef.current = setInterval(async () => {
      try { await fetch('/api/push/remind', { method: 'POST' }); } catch { /* ignore */ }
    }, 2 * 60 * 1000);
  }, []);

  const stopRemindTimer = useCallback(() => {
    if (remindTimerRef.current) { clearInterval(remindTimerRef.current); remindTimerRef.current = null; }
  }, []);

  const isTestAccount = clockStatus?.account === 'T123';
  useEffect(() => {
    if (isTestAccount && clockStatus?.isClockedIn) startRemindTimer();
    else stopRemindTimer();
    return () => stopRemindTimer();
  }, [isTestAccount, clockStatus?.isClockedIn, startRemindTimer, stopRemindTimer]);

  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

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
    } catch { /* ignore */ }
  };

  const handleClock = async (type: 'in' | 'out') => {
    setLoading(true);
    setMessage('');
    try {
      const location = await getLocation();
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, lat: location?.lat, lng: location?.lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || '打卡失敗');
        setMessageType('error');
        toast.error(data.error || '打卡失敗');
        return;
      }
      const now = new Date();
      const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const msg = `${type === 'in' ? '上班' : '下班'}打卡成功！ ${timeStr}`;
      setMessage(msg);
      setMessageType('success');
      toast.success(msg);
      if (type === 'in') requestPushPermission();
      await fetchStatus();
    } catch {
      setMessage('系統錯誤');
      setMessageType('error');
      toast.error('系統錯誤');
    }
    finally { setLoading(false); }
  };

  const isClockedIn = clockStatus?.isClockedIn ?? false;

  let elapsedStr = '';
  if (isClockedIn && clockStatus?.openRecord?.clockInTime) {
    const diff = currentTime.getTime() - new Date(clockStatus.openRecord.clockInTime).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    elapsedStr = `${hours} 小時 ${mins} 分鐘`;
  }

  let clockInTimeStr = '';
  if (clockStatus?.openRecord?.clockInTime) {
    const d = new Date(clockStatus.openRecord.clockInTime);
    clockInTimeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const caseName = isClockedIn
    ? (clockStatus?.openRecord?.caseName || '')
    : (clockStatus?.defaultCaseName || '—');

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
    boxShadow: '0 10px 25px rgba(180,120,100,0.2)',
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

  const clockInDisabled = loading || isClockedIn;
  const clockOutDisabled = loading || !isClockedIn;

  return (
    <div style={{ minHeight: '100vh' }}>
      <EmployeeNav />

      {/* 主內容區 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '4vh 24px 24px',
      }}>

        {/* 個案名稱 */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: isClockedIn ? '#e8776f' : '#4a3733',
            letterSpacing: '0.05em',
          }}>
            {clockStatus ? caseName : '載入中...'}
          </div>
          {isClockedIn && (
            <div style={{ fontSize: '13px', color: '#e8776f', marginTop: '4px' }}>
              值班中 · 上班 {clockInTimeStr} · 已 {elapsedStr}
            </div>
          )}
          {!isClockedIn && clockStatus && (
            <div style={{ fontSize: '13px', color: '#8b7b76', marginTop: '4px' }}>
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
            color: '#4a3733',
            letterSpacing: '0.05em',
          }}>
            {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}
            <span style={{ fontSize: '1.875rem', color: '#b0a09a' }}>
              :{String(currentTime.getSeconds()).padStart(2, '0')}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: '#8b7b76', marginTop: '8px' }}>
            {currentTime.getFullYear()}/{String(currentTime.getMonth()+1).padStart(2,'0')}/{String(currentTime.getDate()).padStart(2,'0')}
            {' '}
            {['日','一','二','三','四','五','六'][currentTime.getDay()]}
          </div>
        </div>

        {/* 打卡按鈕 */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}>
          <button
            onClick={() => handleClock('in')}
            disabled={clockInDisabled}
            style={{
              ...circleButtonBase,
              background: isClockedIn ? '#b0a09a' : 'linear-gradient(135deg, #5dab68, #4d9a58)',
              opacity: clockInDisabled ? 0.3 : 1,
              cursor: clockInDisabled ? 'default' : 'pointer',
              ...(clockInDisabled ? {} : { animation: 'float 3s ease-in-out infinite' }),
            }}
          >
            上班
          </button>

          <button
            onClick={() => handleClock('out')}
            disabled={clockOutDisabled}
            style={{
              ...circleButtonBase,
              background: !isClockedIn ? '#b0a09a' : 'linear-gradient(135deg, #e8776f, #d9534f)',
              opacity: clockOutDisabled ? 0.3 : 1,
              cursor: clockOutDisabled ? 'default' : 'pointer',
              ...(clockOutDisabled ? {} : { animation: 'float 3s ease-in-out infinite' }),
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
            borderRadius: '16px',
            fontSize: '16px',
            fontWeight: '500',
            backgroundColor: messageType === 'success' ? '#e8f5ea' : '#fce8e8',
            color: messageType === 'success' ? '#3d7a47' : '#b5403d',
            border: messageType === 'success' ? '1px solid #c8e6c9' : '1px solid #f5c6c6',
          }}>
            {message}
          </div>
        )}

        {loading && (
          <div style={{ marginTop: '24px', color: '#8b7b76', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size="sm" /> 正在取得位置並打卡中...
          </div>
        )}
      </div>
    </div>
  );
}
