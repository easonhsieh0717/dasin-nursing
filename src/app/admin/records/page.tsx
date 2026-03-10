'use client';

import { useState, useEffect, useCallback } from 'react';

interface EnrichedRecord {
  id: string;
  caseName: string;
  caseCode: string;
  userName: string;
  clockInLat: number | null;
  clockInLng: number | null;
  clockOutLat: number | null;
  clockOutLng: number | null;
  clockInTime: string | null;
  clockOutTime: string | null;
  salary: number;
  calculatedSalary?: number;
  multiplier?: number;
  userId: string;
  caseId: string;
}

interface NurseOption { id: string; name: string; }
interface CaseOption { id: string; name: string; code: string; }

function formatDT(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日 ${String(d.getHours()).padStart(2,'0')}點${String(d.getMinutes()).padStart(2,'0')}分`;
}

function fmtCoords(lat: number|null, lng: number|null): string {
  if (lat === null || lng === null) return '';
  return `${lat}, ${lng}`;
}

export default function AdminRecordsPage() {
  const [records, setRecords] = useState<EnrichedRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [clockType, setClockType] = useState<'in' | 'out'>('in');
  const [settlementType, setSettlementType] = useState('');
  const [caseCode, setCaseCode] = useState('');
  const [caseName, setCaseName] = useState('');
  const [userName, setUserName] = useState('');

  // For add/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<EnrichedRecord | null>(null);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [formData, setFormData] = useState({
    userId: '', caseId: '', clockInTime: '', clockOutTime: '',
    clockInLat: '', clockInLng: '', clockOutLat: '', clockOutLng: '', salary: '0'
  });

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '10' });
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    if (clockType) params.set('clockType', clockType);
    if (settlementType) params.set('settlementType', settlementType);
    if (caseCode) params.set('caseCode', caseCode);
    if (caseName) params.set('caseName', caseName);
    if (userName) params.set('userName', userName);

    const res = await fetch(`/api/admin/records?${params}`);
    const data = await res.json();
    setRecords(data.data || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, startTime, endTime, clockType, settlementType, caseCode, caseName, userName]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  useEffect(() => {
    fetch('/api/admin/nurses?all=true').then(r => r.json()).then(d => setNurses(d.data || []));
    fetch('/api/admin/cases?all=true').then(r => r.json()).then(d => setCases(d.data || []));
  }, []);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    if (clockType) params.set('clockType', clockType);
    if (settlementType) params.set('settlementType', settlementType);
    if (caseCode) params.set('caseCode', caseCode);
    if (caseName) params.set('caseName', caseName);
    if (userName) params.set('userName', userName);
    window.open(`/api/admin/export?${params}`, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此紀錄？')) return;
    await fetch(`/api/admin/records?id=${id}`, { method: 'DELETE' });
    fetchRecords();
  };

  const openAdd = () => {
    setEditingRecord(null);
    setFormData({ userId: nurses[0]?.id || '', caseId: cases[0]?.id || '', clockInTime: '', clockOutTime: '', clockInLat: '', clockInLng: '', clockOutLat: '', clockOutLng: '', salary: '0' });
    setShowModal(true);
  };

  const openEdit = (r: EnrichedRecord) => {
    setEditingRecord(r);
    setFormData({
      userId: r.userId, caseId: r.caseId,
      clockInTime: r.clockInTime?.slice(0, 16) || '',
      clockOutTime: r.clockOutTime?.slice(0, 16) || '',
      clockInLat: r.clockInLat?.toString() || '',
      clockInLng: r.clockInLng?.toString() || '',
      clockOutLat: r.clockOutLat?.toString() || '',
      clockOutLng: r.clockOutLng?.toString() || '',
      salary: r.salary.toString(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    // 驗證：上班時間必須早於下班時間
    if (formData.clockInTime && formData.clockOutTime) {
      if (new Date(formData.clockInTime) >= new Date(formData.clockOutTime)) {
        alert('上班時間必須早於下班時間');
        return;
      }
    }

    const body = {
      ...(editingRecord ? { id: editingRecord.id } : {}),
      userId: formData.userId,
      caseId: formData.caseId,
      clockInTime: formData.clockInTime || null,
      clockOutTime: formData.clockOutTime || null,
      clockInLat: formData.clockInLat ? parseFloat(formData.clockInLat) : null,
      clockInLng: formData.clockInLng ? parseFloat(formData.clockInLng) : null,
      clockOutLat: formData.clockOutLat ? parseFloat(formData.clockOutLat) : null,
      clockOutLng: formData.clockOutLng ? parseFloat(formData.clockOutLng) : null,
      salary: parseFloat(formData.salary) || 0,
    };

    await fetch('/api/admin/records', {
      method: editingRecord ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setShowModal(false);
    fetchRecords();
  };

  return (
    <div className="p-2 sm:p-4">
      {/* Filters */}
      <div className="bg-white p-3 sm:p-4 rounded-lg mb-3 space-y-2 sm:space-y-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-orange-700 text-sm">篩選時間</span>
          <input type="datetime-local" value={startTime} onChange={e => { setStartTime(e.target.value); setPage(1); }} className="px-2 py-1 border rounded text-sm flex-1 min-w-[140px]" />
          <span className="text-sm">~</span>
          <input type="datetime-local" value={endTime} onChange={e => { setEndTime(e.target.value); setPage(1); }} className="px-2 py-1 border rounded text-sm flex-1 min-w-[140px]" />
          <div className="flex gap-1">
            <button onClick={() => { setClockType('in'); setPage(1); }} className={`px-3 py-1 rounded text-sm ${clockType === 'in' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>上班</button>
            <button onClick={() => { setClockType('out'); setPage(1); }} className={`px-3 py-1 rounded text-sm ${clockType === 'out' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}>下班</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-orange-700 text-sm">結算</span>
          {['', '週', '月', '半月'].map(t => (
            <button key={t || 'all'} onClick={() => { setSettlementType(t); setPage(1); }}
              className={`px-3 py-1 rounded text-sm ${settlementType === t ? 'bg-blue-800 text-white' : 'bg-gray-200'}`}>
              {t || '全部'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-orange-700 text-sm">代碼</span>
          <input value={caseCode} onChange={e => { setCaseCode(e.target.value); setPage(1); }} className="px-2 py-1 border rounded w-20 sm:w-28 text-sm" />

          <span className="font-bold text-orange-700 text-sm">個案</span>
          <input value={caseName} onChange={e => { setCaseName(e.target.value); setPage(1); }} className="px-2 py-1 border rounded w-20 sm:w-32 text-sm" />

          <span className="font-bold text-orange-700 text-sm">特護</span>
          <input value={userName} onChange={e => { setUserName(e.target.value); setPage(1); }} className="px-2 py-1 border rounded w-20 sm:w-32 text-sm" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 mb-2">
        <button onClick={handleExport} className="px-3 sm:px-4 py-2 bg-green-700 text-white rounded font-bold hover:bg-green-800 text-sm">
          匯出
        </button>
        <button onClick={openAdd} className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 text-sm">
          新增
        </button>
      </div>

      {/* Table */}
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
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id}>
              <td>{r.caseName}</td>
              <td>{r.userName}</td>
              <td className="text-xs">{fmtCoords(r.clockInLat, r.clockInLng)}</td>
              <td className="text-xs">{fmtCoords(r.clockOutLat, r.clockOutLng)}</td>
              <td>{formatDT(r.clockInTime)}</td>
              <td>{formatDT(r.clockOutTime)}</td>
              <td className="font-bold text-green-700">{r.calculatedSalary ?? r.salary}</td>
              <td>{r.multiplier && r.multiplier > 1 ? <span className="text-red-600 font-bold">{r.multiplier}x</span> : ''}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  <button onClick={() => openEdit(r)} className="px-2 sm:px-3 py-1 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700">編輯</button>
                  <button onClick={() => handleDelete(r.id)} className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded text-xs sm:text-sm hover:bg-red-600">刪除</button>
                </div>
              </td>
            </tr>
          ))}
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
      <div className="flex items-center justify-center gap-2 mt-4">
        <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-30">&lt;</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pn: number;
          if (totalPages <= 5) pn = i + 1;
          else if (page <= 3) pn = i + 1;
          else if (page >= totalPages - 2) pn = totalPages - 4 + i;
          else pn = page - 2 + i;
          return <button key={pn} onClick={() => setPage(pn)} className={`px-3 py-1 border rounded ${page === pn ? 'bg-blue-500 text-white' : ''}`}>{pn}</button>;
        })}
        {totalPages > 5 && <span>... {totalPages}</span>}
        <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-3 py-1 border rounded disabled:opacity-30">&gt;</button>
        <span className="ml-4 text-sm text-gray-500">共 {total} 筆 | 10 / page</span>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold">{editingRecord ? '編輯紀錄' : '新增紀錄'}</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">特護</label>
                <select value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} className="w-full px-2 py-1 border rounded">
                  {nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">個案</label>
                <select value={formData.caseId} onChange={e => setFormData({...formData, caseId: e.target.value})} className="w-full px-2 py-1 border rounded">
                  {cases.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">上班時間</label>
                <input type="datetime-local" value={formData.clockInTime} onChange={e => setFormData({...formData, clockInTime: e.target.value})} className="w-full px-2 py-1 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">下班時間</label>
                <input type="datetime-local" value={formData.clockOutTime} onChange={e => setFormData({...formData, clockOutTime: e.target.value})} className="w-full px-2 py-1 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">薪資</label>
                <input type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} className="w-full px-2 py-1 border rounded" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSave} className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700">儲存</button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
