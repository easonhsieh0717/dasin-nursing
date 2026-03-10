'use client';

import { useState, useEffect, useCallback } from 'react';

interface CaseItem {
  id: string;
  name: string;
  code: string;
  caseType: string;
  settlementType: string;
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CaseItem | null>(null);
  const [form, setForm] = useState({ name: '', code: '', caseType: '一般', settlementType: '週' });
  const [loading, setLoading] = useState(true);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '10' });
    if (search) params.set('search', search);
    const res = await fetch(`/api/admin/cases?${params}`);
    const data = await res.json();
    setCases(data.data || []);
    setTotalPages(data.totalPages || 1);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此個案？')) return;
    const res = await fetch(`/api/admin/cases?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '刪除失敗');
      return;
    }
    fetchCases();
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', code: '', caseType: '一般', settlementType: '週' });
    setShowModal(true);
  };

  const openEdit = (c: CaseItem) => {
    setEditing(c);
    setForm({ name: c.name, code: c.code, caseType: c.caseType, settlementType: c.settlementType });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = editing ? { id: editing.id, ...form } : form;
    const res = await fetch('/api/admin/cases', {
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
    fetchCases();
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="font-bold text-gray-700 text-sm sm:text-base whitespace-nowrap">個案名稱</label>
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
            <th>個案名稱</th>
            <th>個案代碼</th>
            <th>個案型態</th>
            <th>結算型態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {cases.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.code}</td>
              <td>{c.caseType}</td>
              <td>{c.settlementType}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  <button onClick={() => openEdit(c)} className="px-2 sm:px-3 py-1 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700">編輯</button>
                  <button onClick={() => handleDelete(c.id)} className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded text-xs sm:text-sm hover:bg-red-600">刪除</button>
                </div>
              </td>
            </tr>
          ))}
          {loading && (
            <tr><td colSpan={5} className="py-8 text-gray-400">載入中...</td></tr>
          )}
          {!loading && cases.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-gray-400">尚無資料</td></tr>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">{editing ? '編輯個案' : '新增個案'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">個案名稱</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">個案代碼</label>
                <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">個案型態</label>
                <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className="w-full px-3 py-2 border rounded">
                  <option value="一般">一般</option>
                  <option value="特殊">特殊</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">結算型態</label>
                <select value={form.settlementType} onChange={e => setForm({...form, settlementType: e.target.value})} className="w-full px-3 py-2 border rounded">
                  <option value="週">週</option>
                  <option value="月">月</option>
                  <option value="半月">半月</option>
                </select>
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
