'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClockPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetch('/api/admin/cases?all=true')
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setCases(d.data);
          if (d.data.length > 0) setSelectedCase(d.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // 即時時鐘
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
          caseId: selectedCase,
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

      {/* Main content */}
      <div className="flex flex-col items-center justify-center px-6" style={{ minHeight: 'calc(100vh - 52px)' }}>
        {/* 即時時鐘 */}
        <div className="mb-8 text-center">
          <div className="text-5xl sm:text-6xl font-mono font-bold text-gray-800 tracking-wider">
            {String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}
            <span className="text-3xl sm:text-4xl text-gray-400">:{String(currentTime.getSeconds()).padStart(2, '0')}</span>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            {currentTime.getFullYear()}/{String(currentTime.getMonth()+1).padStart(2,'0')}/{String(currentTime.getDate()).padStart(2,'0')}
            {' '}
            {['日','一','二','三','四','五','六'][currentTime.getDay()]}
          </div>
        </div>

        {/* Case selector */}
        {cases.length > 0 && (
          <div className="mb-6">
            {cases.length === 1 ? (
              <div className="px-4 py-2 text-base text-gray-700 font-medium bg-white border rounded-lg">
                {cases[0].name}
              </div>
            ) : (
              <select
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
                className="px-4 py-2 border rounded-lg text-base bg-white"
              >
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Clock buttons — 圓形設計 */}
        <div className="flex items-center justify-center gap-8 sm:gap-16">
          <button
            onClick={() => handleClock('in')}
            disabled={loading}
            className="w-36 h-36 sm:w-40 sm:h-40 rounded-full text-white text-3xl sm:text-4xl font-bold shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #34d058, #28a745)' }}
          >
            上班
          </button>

          <button
            onClick={() => handleClock('out')}
            disabled={loading}
            className="w-36 h-36 sm:w-40 sm:h-40 rounded-full text-white text-3xl sm:text-4xl font-bold shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #ff6b6b, #dc3545)' }}
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
