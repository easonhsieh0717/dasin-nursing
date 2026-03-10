'use client';

import { useState, useEffect } from 'react';

interface SpecialCondition {
  id: string;
  name: string;
  target: string;
  multiplier: number;
  startTime: string;
  endTime: string;
}

function formatDT(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日 ${String(d.getHours()).padStart(2,'0')}點${String(d.getMinutes()).padStart(2,'0')}分`;
}

const SPECIAL_TYPES = ['過年', '颱風', '國定假日', '特殊加班', '其他'];

export default function SpecialPage() {
  const [conditions, setConditions] = useState<SpecialCondition[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SpecialCondition | null>(null);
  const [form, setForm] = useState({
    name: '過年', target: '', multiplier: '2', startTime: '', endTime: ''
  });

  const fetchData = async () => {
    const res = await fetch('/api/admin/special');
    const data = await res.json();
    setConditions(data.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除？')) return;
    const res = await fetch(`/api/admin/special?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || '刪除失敗');
      return;
    }
    fetchData();
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '過年', target: '', multiplier: '2', startTime: '', endTime: '' });
    setShowModal(true);
  };

  const openEdit = (sc: SpecialCondition) => {
    setEditing(sc);
    setForm({
      name: sc.name,
      target: sc.target,
      multiplier: sc.multiplier.toString(),
      startTime: sc.startTime?.slice(0, 16) || '',
      endTime: sc.endTime?.slice(0, 16) || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name,
      target: form.target,
      multiplier: parseFloat(form.multiplier),
      startTime: form.startTime,
      endTime: form.endTime,
    };

    const res = await fetch('/api/admin/special', {
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
    fetchData();
  };

  const handleClear = () => {
    setForm({ name: '過年', target: '', multiplier: '2', startTime: '', endTime: '' });
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex justify-end mb-3">
        <button onClick={openAdd} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 text-sm">新增</button>
      </div>

      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>特殊狀況</th>
            <th>對象</th>
            <th>倍數</th>
            <th>開始時間</th>
            <th>結束時間</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map(sc => (
            <tr key={sc.id}>
              <td>{sc.name}</td>
              <td>{sc.target}</td>
              <td>{sc.multiplier}</td>
              <td>{formatDT(sc.startTime)}</td>
              <td>{formatDT(sc.endTime)}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  <button onClick={() => openEdit(sc)} className="px-2 sm:px-3 py-1 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700">編輯</button>
                  <button onClick={() => handleDelete(sc.id)} className="px-2 sm:px-3 py-1 bg-red-500 text-white rounded text-xs sm:text-sm hover:bg-red-600">刪除</button>
                </div>
              </td>
            </tr>
          ))}
          {conditions.length === 0 && (
            <tr><td colSpan={6} className="py-8 text-gray-400">尚無資料</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">{editing ? '編輯特殊狀況' : '新增特殊狀況'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-orange-700 mb-1">特殊狀況：</label>
                <select value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded">
                  {SPECIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-orange-700 mb-1">個案代號：</label>
                <input value={form.target} onChange={e => setForm({...form, target: e.target.value})}
                  placeholder="輸入組織代碼或個案代碼" className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-bold text-orange-700 mb-1">薪資倍數：</label>
                <input type="number" step="0.1" value={form.multiplier} onChange={e => setForm({...form, multiplier: e.target.value})} className="w-full px-3 py-2 border rounded bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-bold text-orange-700 mb-1">開始時間：</label>
                <input type="datetime-local" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-bold text-orange-700 mb-1">結束時間：</label>
                <input type="datetime-local" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} className="w-full px-3 py-2 border rounded" />
              </div>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button onClick={handleSave} className="px-5 py-2 bg-green-500 text-white rounded hover:bg-green-600">儲存</button>
              <button onClick={handleClear} className="px-5 py-2 bg-red-400 text-white rounded hover:bg-red-500">清除</button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">返回</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
