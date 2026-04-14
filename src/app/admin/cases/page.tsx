'use client';

import { useState, useEffect, useRef } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useToast } from '@/components/Toast';
import { Plus, Download, Pencil, Trash2, Save, Users } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

interface CaseItem {
  id: string;
  name: string;
  code: string;
  caseType: string;
  settlementType: string;
  remoteSubsidy: boolean;
  rateProfileId?: string;
}

interface RateProfile { id: string; name: string; }

export default function CasesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CaseItem | null>(null);
  const [form, setForm] = useState({ name: '', code: '', caseType: '主要地區', settlementType: '週', remoteSubsidy: false, rateProfileId: '' });
  const [rateProfiles, setRateProfiles] = useState<RateProfile[]>([]);

  useEffect(() => {
    fetch('/api/admin/rate-profiles').then(r => r.json()).then(d => setRateProfiles(d.data || []));
  }, []);

  // Dropdown search
  const [allCases, setAllCases] = useState<CaseItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load all cases for dropdown
  useEffect(() => {
    fetch('/api/admin/cases?pageSize=2000').then(r => r.json()).then(d => setAllCases(d.data || []));
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredDropdown = search && !allCases.find(c => c.name === search)
    ? allCases.filter(c => c.name.includes(search) || c.code.toLowerCase().includes(search.toLowerCase()))
    : allCases;

  const committedSearchRef = useRef(committedSearch);
  committedSearchRef.current = committedSearch;

  const { data: cases, loading, hasMore, total, sentinelRef, refresh: refreshCases } = useInfiniteScroll<CaseItem>(
    { url: '/api/admin/cases', buildParams: () => {
      const p: Record<string, string> = {};
      if (committedSearchRef.current) p.search = committedSearchRef.current;
      return p;
    }},
    [committedSearch],
  );

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此個案？')) return;
    const res = await fetch(`/api/admin/cases?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '刪除失敗');
      return;
    }
    refreshCases();
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/admin/cases/export');
      if (!res.ok) { toast.error('匯出失敗'); return; }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fileName = match ? decodeURIComponent(match[1]) : `個案名冊_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('匯出失敗'); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', code: '', caseType: '主要地區', settlementType: '週', remoteSubsidy: false, rateProfileId: '' });
    setShowModal(true);
  };

  const openEdit = (c: CaseItem) => {
    setEditing(c);
    setForm({ name: c.name, code: c.code, caseType: c.caseType, settlementType: c.settlementType, remoteSubsidy: c.remoteSubsidy, rateProfileId: c.rateProfileId || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = editing
      ? { id: editing.id, ...form, rateProfileId: form.rateProfileId || null }
      : { ...form, rateProfileId: form.rateProfileId || null };
    const res = await fetch('/api/admin/cases', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '儲存失敗');
      return;
    }
    setShowModal(false);
    refreshCases();
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="font-bold text-[var(--color-text-primary)] text-sm sm:text-base whitespace-nowrap">個案名稱</label>
          <div ref={searchRef} className="relative flex-1 sm:w-60">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true); if (!e.target.value) { setCommittedSearch(''); } }}
              onFocus={() => setDropdownOpen(true)}
              onKeyDown={e => { if (e.key === 'Enter') { setCommittedSearch(search); setDropdownOpen(false); } }}
              className="w-full px-3 py-1 border rounded text-sm"
              placeholder="搜尋個案名稱或代碼..."
            />
            {dropdownOpen && (
              <div className="absolute z-50 left-0 right-0 top-full bg-white border border-[var(--color-primary-border)] rounded shadow-lg max-h-60 overflow-y-auto">
                {committedSearch && (
                  <div className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-nav-hover-bg)] cursor-pointer border-b border-[var(--color-primary-border)]"
                    onClick={() => { setSearch(''); setCommittedSearch(''); setDropdownOpen(false); }}>
                    清除搜尋
                  </div>
                )}
                {filteredDropdown.slice(0, 30).map(c => (
                  <div key={c.id}
                    className={`px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer ${c.name === committedSearch ? 'bg-blue-100 font-bold' : ''}`}
                    onClick={() => { setSearch(c.name); setCommittedSearch(c.name); setDropdownOpen(false); }}>
                    {c.name} <span className="text-[var(--color-text-muted)] text-xs">{c.code}</span>
                  </div>
                ))}
                {filteredDropdown.length > 30 && (
                  <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] text-center">繼續輸入以縮小範圍...</div>
                )}
                {filteredDropdown.length === 0 && (
                  <div className="px-3 py-2 text-sm text-[var(--color-text-muted)] text-center">無符合的個案</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 self-end">
          <button onClick={openAdd} className="px-4 py-2 btn-success text-white rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={16} />新增</button>
          <button onClick={handleExport} className="px-4 py-2 btn-primary text-white rounded-xl font-bold text-sm flex items-center gap-1"><Download size={16} />匯出</button>
        </div>
      </div>

      {/* 手機版：卡片 */}
      <div className="sm:hidden space-y-2">
        {loading && cases.length === 0 && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
        {cases.map(c => (
          <div key={c.id} className="warm-card p-3 border border-[var(--color-primary-border)]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[var(--color-text-primary)]">{c.name}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="px-2 py-1 btn-primary text-white rounded-xl text-xs flex items-center gap-1"><Pencil size={14} />編輯</button>
                <button onClick={() => handleDelete(c.id)} className="px-2 py-1 btn-danger text-white rounded-xl text-xs flex items-center gap-1"><Trash2 size={14} />刪除</button>
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mb-1.5">代碼：{c.code}</div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-1.5 py-0.5 bg-blue-50 text-[var(--color-text-link)] rounded text-xs">{c.caseType}</span>
              <span className="px-1.5 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-text-secondary)] rounded text-xs">{c.settlementType}結</span>
              {c.remoteSubsidy && <span className="px-1.5 py-0.5 bg-orange-50 text-[var(--color-primary)] rounded text-xs">偏遠補貼</span>}
            </div>
          </div>
        ))}
        {!loading && cases.length === 0 && <EmptyState icon={Users} title="尚無個案資料" />}
      </div>

      {/* 桌面版：表格 */}
      <div className="hidden sm:block">
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>個案名稱</th>
            <th>個案代碼</th>
            <th>資費地區</th>
            <th>偏遠補貼</th>
            <th>結算型態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading && cases.length === 0 && (
            <SkeletonTable rows={5} columns={6} />
          )}
          {cases.map(c => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.code}</td>
              <td>{c.caseType}</td>
              <td>{c.remoteSubsidy ? '是' : '—'}</td>
              <td>{c.settlementType}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  <button onClick={() => openEdit(c)} className="px-2 sm:px-3 py-1 btn-primary text-white rounded-xl text-xs sm:text-sm flex items-center gap-1"><Pencil size={14} />編輯</button>
                  <button onClick={() => handleDelete(c.id)} className="px-2 sm:px-3 py-1 btn-danger text-white rounded-xl text-xs sm:text-sm flex items-center gap-1"><Trash2 size={14} />刪除</button>
                </div>
              </td>
            </tr>
          ))}
          {!loading && cases.length === 0 && (
            <tr><td colSpan={6}><EmptyState icon={Users} title="尚無個案資料" /></td></tr>
          )}
        </tbody>
      </table>
      </div>
      </div>

      {/* 無限滾動哨兵 */}
      <div ref={sentinelRef} className="py-4 text-center text-sm text-[var(--color-text-muted)]">
        {loading && cases.length > 0 && <Spinner />}
        {!loading && !hasMore && cases.length > 0 && `已顯示全部 ${total} 筆`}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="warm-card modal-content p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">{editing ? '編輯個案' : '新增個案'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">個案名稱</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">個案代碼</label>
                <input value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">資費地區</label>
                <select value={form.caseType} onChange={e => setForm({...form, caseType: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded">
                  <option value="主要地區">主要地區</option>
                  <option value="其它地區">其它地區</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.remoteSubsidy} onChange={e => setForm({...form, remoteSubsidy: e.target.checked})} className="w-4 h-4" />
                  <span className="text-sm font-medium">偏遠地區每班補貼：500 元</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">結算型態</label>
                <select value={form.settlementType} onChange={e => setForm({...form, settlementType: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded">
                  <option value="週">週</option>
                  <option value="月">月</option>
                  <option value="半月">半月</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  彈性費率方案
                  <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">（選填，未設定則用標準費率）</span>
                </label>
                <select
                  value={form.rateProfileId}
                  onChange={e => setForm({...form, rateProfileId: e.target.value})}
                  className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded"
                >
                  <option value="">— 使用標準費率 —</option>
                  {rateProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSave} className="px-5 py-2 btn-success text-white rounded-xl flex items-center gap-1"><Save size={16} />儲存</button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-[var(--color-text-muted)] text-white rounded-xl hover:opacity-80">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
