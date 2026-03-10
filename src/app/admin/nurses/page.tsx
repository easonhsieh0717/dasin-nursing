'use client';

import { useState, useEffect, useCallback } from 'react';

interface Nurse {
  id: string;
  name: string;
  account: string;
  password: string;
  hourlyRate: number;
  bank: string;
  accountNo: string;
  accountName: string;
}

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Nurse | null>(null);
  const [form, setForm] = useState({ name: '', account: '', password: '', hourlyRate: '200', bank: '', accountNo: '', accountName: '' });
  const [loading, setLoading] = useState(true);

  const fetchNurses = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '10' });
    if (search) params.set('search', search);
    const res = await fetch(`/api/admin/nurses?${params}`);
    const data = await res.json();
    setNurses(data.data || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchNurses(); }, [fetchNurses]);

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此特護？')) return;
    const res = await fetch(`/api/admin/nurses?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '刪除失敗');
      return;
    }
    fetchNurses();
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', account: '', password: '', hourlyRate: '200', bank: '', accountNo: '', accountName: '' });
    setShowModal(true);
  };

  const openEdit = (n: Nurse) => {
    setEditing(n);
    setForm({
      name: n.name, account: n.account, password: n.password, hourlyRate: n.hourlyRate.toString(),
      bank: n.bank || '', accountNo: n.accountNo || '', accountName: n.accountName || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name, account: form.account, password: form.password, hourlyRate: parseFloat(form.hourlyRate),
      bank: form.bank, accountNo: form.accountNo, accountName: form.accountName,
    };

    const res = await fetch('/api/admin/nurses', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '儲存失敗');
      return;
    }
    setShowModal(false);
    fetchNurses();
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="font-bold text-gray-700 text-sm sm:text-base whitespace-nowrap">特護名稱</label>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-1 border rounded flex-1 sm:w-60 text-sm"
            placeholder="搜尋..."
          />
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 text-sm self-end">新增</button>
      </div>

      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>特護名稱</th>
            <th>帳號</th>
            <th>密碼</th>
            <th>時薪</th>
            <th>銀行</th>
            <th>銀行帳號</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {nurses.map(n => (
            <tr key={n.id}>
              <td>{n.name}</td>
              <td>{n.account}</td>
              <td>{n.password}</td>
              <td>{n.hourlyRate}</td>
              <td className="text-xs">{n.bank || '-'}</td>
              <td className="text-xs font-mono">{n.accountNo || '-'}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  <button onClick={() => openEdit(n)} className="px-2 sm:px-3 py-1 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700">編輯</button>
                  <button onClick={() => handleDelete(n.id)} className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded text-xs sm:text-sm hover:bg-red-600">刪除</button>
                </div>
              </td>
            </tr>
          ))}
          {loading && (
            <tr><td colSpan={7} className="py-8 text-gray-400">載入中...</td></tr>
          )}
          {!loading && nurses.length === 0 && (
            <tr><td colSpan={7} className="py-8 text-gray-400">尚無資料</td></tr>
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
        <span className="ml-4 text-sm text-gray-500">共 {total} 筆 | 每頁 10 筆</span>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md mx-3 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold">{editing ? '編輯特護' : '新增特護'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">特護名稱</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">帳號</label>
                  <input value={form.account} onChange={e => setForm({...form, account: e.target.value})} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">密碼</label>
                  <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">時薪</label>
                <input type="number" value={form.hourlyRate} onChange={e => setForm({...form, hourlyRate: e.target.value})} className="w-full px-3 py-2 border rounded text-sm" />
              </div>

              <div className="border-t pt-3 mt-2">
                <h4 className="font-bold text-orange-700 text-sm mb-2">銀行帳戶資訊（發薪用）</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">銀行名稱</label>
                  <input value={form.bank} onChange={e => setForm({...form, bank: e.target.value})} className="w-full px-3 py-2 border rounded text-sm" placeholder="例：中華郵政、國泰世華" />
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">銀行帳號</label>
                  <input value={form.accountNo} onChange={e => setForm({...form, accountNo: e.target.value})} className="w-full px-3 py-2 border rounded text-sm font-mono" placeholder="帳號" />
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">戶名</label>
                  <input value={form.accountName} onChange={e => setForm({...form, accountName: e.target.value})} className="w-full px-3 py-2 border rounded text-sm" placeholder="帳戶戶名" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSave} className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">儲存</button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
