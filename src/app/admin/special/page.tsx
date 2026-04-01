'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { Plus, Save, Trash2, Pencil } from 'lucide-react';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import { AlertTriangle } from 'lucide-react';

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
  const toast = useToast();
  const [conditions, setConditions] = useState<SpecialCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SpecialCondition | null>(null);
  const [form, setForm] = useState({
    name: '過年', target: '', multiplier: '2', startTime: '', endTime: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/special');
      const data = await res.json();
      setConditions(data.data || []);
    } catch {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除？')) return;
    const res = await fetch(`/api/admin/special?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '刪除失敗');
      return;
    }
    toast.success('已刪除');
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
      toast.error(data.error || '儲存失敗');
      return;
    }
    toast.success(editing ? '已更新' : '已新增');
    setShowModal(false);
    fetchData();
  };

  const handleClear = () => {
    setForm({ name: '過年', target: '', multiplier: '2', startTime: '', endTime: '' });
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex justify-end mb-3">
        <button onClick={openAdd} className="px-4 py-2 btn-success text-white rounded font-bold text-sm flex items-center gap-1">
          <Plus size={14} />新增
        </button>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
        {!loading && conditions.map(sc => (
          <div key={sc.id} className="warm-card p-3">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="font-bold text-sm text-[var(--color-text-primary)]">{sc.name}</span>
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{sc.multiplier} 倍</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(sc)} className="px-2 py-1 btn-primary text-white rounded text-xs flex items-center gap-1"><Pencil size={12} />編輯</button>
                <button onClick={() => handleDelete(sc.id)} className="px-2 py-1 btn-danger text-white rounded text-xs flex items-center gap-1"><Trash2 size={12} />刪除</button>
              </div>
            </div>
            {sc.target && <p className="text-xs text-[var(--color-text-secondary)] mb-1">對象：{sc.target}</p>}
            <p className="text-xs text-[var(--color-text-secondary)]">{formatDT(sc.startTime)} ~ {formatDT(sc.endTime)}</p>
          </div>
        ))}
        {!loading && conditions.length === 0 && (
          <EmptyState icon={AlertTriangle} title="尚無特殊狀況" />
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block table-wrap">
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
          {loading && (
            <SkeletonTable rows={5} columns={6} />
          )}
          {!loading && conditions.map(sc => (
            <tr key={sc.id}>
              <td>{sc.name}</td>
              <td>{sc.target}</td>
              <td>{sc.multiplier}</td>
              <td>{formatDT(sc.startTime)}</td>
              <td>{formatDT(sc.endTime)}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  <button onClick={() => openEdit(sc)} className="px-2 sm:px-3 py-1 btn-primary text-white rounded text-xs sm:text-sm flex items-center gap-1"><Pencil size={12} />編輯</button>
                  <button onClick={() => handleDelete(sc.id)} className="px-2 sm:px-3 py-1 btn-danger text-white rounded text-xs sm:text-sm flex items-center gap-1"><Trash2 size={12} />刪除</button>
                </div>
              </td>
            </tr>
          ))}
          {!loading && conditions.length === 0 && (
            <tr><td colSpan={6}><EmptyState icon={AlertTriangle} title="尚無特殊狀況" /></td></tr>
          )}
        </tbody>
      </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="warm-card modal-content p-6 w-full max-w-md space-y-4">
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
                <input type="number" step="0.1" value={form.multiplier} onChange={e => setForm({...form, multiplier: e.target.value})} className="w-full px-3 py-2 border rounded bg-[var(--color-primary-light)]" />
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
              <button onClick={handleSave} className="px-5 py-2 btn-success text-white rounded flex items-center gap-1"><Save size={14} />儲存</button>
              <button onClick={handleClear} className="px-5 py-2 btn-danger text-white rounded">清除</button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-[var(--color-text-muted)] text-white rounded hover:opacity-80">返回</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
