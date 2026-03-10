'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Record {
  id: string;
  caseName: string;
  userName: string;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  calculatedSalary?: number;
  multiplier?: number;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${day}日 ${h}點${min}分`;
}

function CoordsLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat === null || lng === null) return <span></span>;
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
      {lat.toFixed(4)}, {lng.toFixed(4)}
    </a>
  );
}

export default function RecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<Record[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '10' });
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    const res = await fetch(`/api/records?${params}`);
    const data = await res.json();
    setRecords(data.data || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, startTime, endTime]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
            className="px-5 py-3 font-medium text-gray-700 hover:bg-gray-100"
          >
            打卡
          </button>
          <button
            onClick={() => router.push('/records')}
            className="px-5 py-3 font-medium text-gray-700 hover:bg-gray-100 border-b-2 border-blue-500"
          >
            打卡紀錄
          </button>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 text-gray-600 hover:text-red-600">
          登出
        </button>
      </nav>

      <div className="p-3 sm:p-6">
        {/* Date filter */}
        <div className="bg-white p-3 rounded-lg mb-3 flex flex-wrap items-center gap-2">
          <span className="font-bold text-orange-700 text-sm">篩選時間</span>
          <input type="datetime-local" value={startTime} onChange={e => { setStartTime(e.target.value); setPage(1); }} className="px-2 py-1 border rounded text-sm flex-1 min-w-[140px]" />
          <span className="text-sm">~</span>
          <input type="datetime-local" value={endTime} onChange={e => { setEndTime(e.target.value); setPage(1); }} className="px-2 py-1 border rounded text-sm flex-1 min-w-[140px]" />
        </div>

        <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>個案名稱</th>
              <th>特護名稱</th>
              <th>上班經緯度</th>
              <th>下班經緯度</th>
              <th>上班時間</th>
              <th>下班時間</th>
              <th>薪資</th>
              <th>倍率</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id}>
                <td>{r.caseName}</td>
                <td>{r.userName}</td>
                <td className="text-xs"><CoordsLink lat={r.clockInLat} lng={r.clockInLng} /></td>
                <td className="text-xs"><CoordsLink lat={r.clockOutLat} lng={r.clockOutLng} /></td>
                <td>{formatDateTime(r.clockInTime)}</td>
                <td>{formatDateTime(r.clockOutTime)}</td>
                <td className="font-bold text-green-700">{r.calculatedSalary ?? ''}</td>
                <td>{r.multiplier && r.multiplier > 1 ? <span className="text-red-600 font-bold">{r.multiplier}x</span> : ''}</td>
              </tr>
            ))}
            {loading && (
              <tr><td colSpan={8} className="py-8 text-gray-400">載入中...</td></tr>
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-gray-400">尚無紀錄</td></tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            &lt;
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`px-3 py-1 border rounded ${page === pageNum ? 'bg-blue-500 text-white' : ''}`}
              >
                {pageNum}
              </button>
            );
          })}
          {totalPages > 5 && <span className="px-2">... {totalPages}</span>}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-30"
          >
            &gt;
          </button>
          <span className="ml-4 text-sm text-gray-500">共 {total} 筆 | 每頁 10 筆</span>
        </div>
      </div>
    </div>
  );
}
