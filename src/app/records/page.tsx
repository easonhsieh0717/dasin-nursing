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

interface ModRequest {
  id: string;
  recordId: string;
  status: 'pending' | 'approved' | 'rejected';
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

function toLocalDatetime(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
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
  const [searchStartTime, setSearchStartTime] = useState('');
  const [searchEndTime, setSearchEndTime] = useState('');

  // 修改申請相關
  const [modRequests, setModRequests] = useState<ModRequest[]>([]);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyingRecord, setModifyingRecord] = useState<Record | null>(null);
  const [proposedClockIn, setProposedClockIn] = useState('');
  const [proposedClockOut, setProposedClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '10' });
    if (searchStartTime) params.set('startTime', searchStartTime);
    if (searchEndTime) params.set('endTime', searchEndTime);
    const res = await fetch(`/api/records?${params}`);
    const data = await res.json();
    setRecords(data.data || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, searchStartTime, searchEndTime]);

  // 取得自己的修改申請狀態
  const fetchModRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/modification-requests');
      const data = await res.json();
      setModRequests(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchModRequests(); }, [fetchModRequests]);

  const handleSearch = () => {
    setSearchStartTime(startTime);
    setSearchEndTime(endTime);
    setPage(1);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const getModStatus = (recordId: string): 'pending' | 'approved' | 'rejected' | null => {
    const req = modRequests.find(r => r.recordId === recordId);
    return req?.status || null;
  };

  const openModifyModal = (r: Record) => {
    setModifyingRecord(r);
    setProposedClockIn(toLocalDatetime(r.clockInTime));
    setProposedClockOut(toLocalDatetime(r.clockOutTime));
    setReason('');
    setShowModifyModal(true);
  };

  const handleSubmitModification = async () => {
    if (!modifyingRecord) return;
    if (!reason.trim()) { alert('請填寫修改原因'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/modification-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: modifyingRecord.id,
          proposedClockInTime: proposedClockIn ? new Date(proposedClockIn).toISOString() : null,
          proposedClockOutTime: proposedClockOut ? new Date(proposedClockOut).toISOString() : null,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '申請失敗');
        return;
      }
      alert('申請已送出，等待管理員審核');
      setShowModifyModal(false);
      fetchModRequests();
    } catch {
      alert('系統錯誤');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white border-b flex items-center justify-between px-4">
        <div className="flex">
          <button onClick={() => router.push('/clock')} className="px-5 py-3 font-medium text-gray-700 hover:bg-gray-100">
            打卡
          </button>
          <button onClick={() => router.push('/records')} className="px-5 py-3 font-medium text-gray-700 hover:bg-gray-100 border-b-2 border-blue-500">
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
          <input type="date" value={startTime} onChange={e => setStartTime(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
          <span className="text-sm">~</span>
          <input type="date" value={endTime} onChange={e => setEndTime(e.target.value)} className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
          <button onClick={handleSearch} className="px-4 py-1.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 text-sm">
            搜尋
          </button>
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
              <th>特護薪資</th>
              <th>倍率</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => {
              const modStatus = getModStatus(r.id);
              return (
                <tr key={r.id}>
                  <td>{r.caseName}</td>
                  <td>{r.userName}</td>
                  <td className="text-xs"><CoordsLink lat={r.clockInLat} lng={r.clockInLng} /></td>
                  <td className="text-xs"><CoordsLink lat={r.clockOutLat} lng={r.clockOutLng} /></td>
                  <td>{formatDateTime(r.clockInTime)}</td>
                  <td>{formatDateTime(r.clockOutTime)}</td>
                  <td className="font-bold text-green-700">{r.calculatedSalary ?? ''}</td>
                  <td>{r.multiplier && r.multiplier > 1 ? <span className="text-red-600 font-bold">{r.multiplier}x</span> : ''}</td>
                  <td>
                    {modStatus === 'pending' ? (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">審核中</span>
                    ) : modStatus === 'approved' ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">已通過</span>
                    ) : modStatus === 'rejected' ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">已拒絕</span>
                    ) : (
                      <button onClick={() => openModifyModal(r)} className="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600">
                        申請修改
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {loading && (
              <tr><td colSpan={9} className="py-8 text-gray-400">載入中...</td></tr>
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={9} className="py-8 text-gray-400">尚無紀錄</td></tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-30">&lt;</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) pageNum = i + 1;
            else if (page <= 3) pageNum = i + 1;
            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
            else pageNum = page - 2 + i;
            return <button key={pageNum} onClick={() => setPage(pageNum)} className={`px-3 py-1 border rounded ${page === pageNum ? 'bg-blue-500 text-white' : ''}`}>{pageNum}</button>;
          })}
          {totalPages > 5 && <span className="px-2">... {totalPages}</span>}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-30">&gt;</button>
          <span className="ml-4 text-sm text-gray-500">共 {total} 筆 | 每頁 10 筆</span>
        </div>
      </div>

      {/* 申請修改 Modal */}
      {showModifyModal && modifyingRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg mx-3 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold">申請修改打卡時間</h2>

            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500 mb-1">原始上班時間</div>
                <div className="font-medium">{formatDateTime(modifyingRecord.clockInTime) || '—'}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500 mb-1">原始下班時間</div>
                <div className="font-medium">{formatDateTime(modifyingRecord.clockOutTime) || '—'}</div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">建議上班時間</label>
                <input type="datetime-local" value={proposedClockIn} onChange={e => setProposedClockIn(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">建議下班時間</label>
                <input type="datetime-local" value={proposedClockOut} onChange={e => setProposedClockOut(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">修改原因 <span className="text-red-500">*</span></label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="請說明修改原因（必填）"
                  rows={3}
                  className="w-full px-3 py-2 border rounded text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleSubmitModification}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
              >
                {submitting ? '送出中...' : '提交申請'}
              </button>
              <button onClick={() => setShowModifyModal(false)} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
