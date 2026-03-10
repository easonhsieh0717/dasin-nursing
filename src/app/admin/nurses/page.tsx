'use client';

import { useState, useEffect, useCallback } from 'react';

interface Nurse {
  id: string;
  name: string;
  account: string;
  password: string;
  hourlyRate: number;
}

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Nurse | null>(null);
  const [form, setForm] = useState({ name: '', account: '', password: '', hourlyRate: '200' });

  const fetchNurses = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: '10' });
    if (search) params.set('search', search);
    const res = await fetch(`/api/admin/nurses?${params}`);
    const data = await res.json();
    setNurses(data.data || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
  }, [page, search]);

  useEffect(() => { fetchNurses(); }, [fetchNurses]);

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此特護？')) return;
    await fetch(`/api/admin/nurses?id=${id}`, { method: 'DELETE' });
    fetchNurses();
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', account: '', password: '', hourlyRate: '200' });
    setShowModal(true);
  };

  const openEdit = (n: Nurse) => {
    setEditing(n);
    setForm({ name: n.name, account: n.account, password: n.password, hourlyRate: n.hourlyRate.toString() });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = editing
      ? { id: editing.id, name: form.name, account: form.account, password: form.password, hourlyRate: parseFloat(form.hourlyRate) }
      : { name: form.name, account: form.account, password: form.password, hourlyRate: parseFloat(form.hourlyRate) };

    await fetch('/api/admin/nurses', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowModal(false);
    fetchNurses();
  };

  return (
    <div className="p-6">
      {/* Search */}
      <div className="mb-4">
        <label className="font-bold text-gray-700 mr-2">特護名稱</label>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-1 border rounded w-60"
          placeholder="搜尋特護名稱..."
        />
      </div>

      <div className="flex justify-end mb-2">
        <button onClick={openAdd} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">新增</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>特護名稱</th>
            <th>帳號</th>
            <th>密碼</th>
            <th>時薪</th>
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
              <td>
                <button onClick={() => openEdit(n)} className="px-3 py-1 bg-blue-600 text-white rounded mr-1 text-sm hover:bg-blue-700">編輯</button>
                <button onClick={() => handleDelete(n.id)} className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">刪除</button>
              </td>
            </tr>
          ))}
          {nurses.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-gray-400">尚無資料</td></tr>
          )}
        </tbody>
      </table>

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
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">{editing ? '編輯特護' : '新增特護'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">特護名稱</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">帳號</label>
                <input value={form.account} onChange={e => setForm({...form, account: e.target.value})} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">密碼</label>
                <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">時薪</label>
                <input type="number" value={form.hourlyRate} onChange={e => setForm({...form, hourlyRate: e.target.value})} className="w-full px-3 py-2 border rounded" />
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
