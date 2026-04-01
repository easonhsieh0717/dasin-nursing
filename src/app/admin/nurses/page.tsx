'use client';

import { useState, useEffect, useRef } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useToast } from '@/components/Toast';
import { Plus, Upload, Download, Pencil, Trash2, Save, UserCog } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

interface Nurse {
  id: string;
  name: string;
  account: string;
  hourlyRate: number;
  bank: string;
  accountNo: string;
  accountName: string;
  defaultCaseId?: string;
  note?: string;
}

// 台灣金融機構代碼（郵局優先，其餘按代碼排序）
const TAIWAN_BANKS = [
  { code: '700', name: '中華郵政（郵局）' },
  { code: '004', name: '臺灣銀行' },
  { code: '005', name: '臺灣土地銀行' },
  { code: '006', name: '合作金庫商業銀行' },
  { code: '007', name: '第一商業銀行' },
  { code: '008', name: '華南商業銀行' },
  { code: '009', name: '彰化商業銀行' },
  { code: '011', name: '上海商業儲蓄銀行' },
  { code: '012', name: '台北富邦商業銀行' },
  { code: '013', name: '國泰世華商業銀行' },
  { code: '016', name: '高雄銀行' },
  { code: '017', name: '兆豐國際商業銀行' },
  { code: '018', name: '全國農業金庫' },
  { code: '048', name: '王道商業銀行' },
  { code: '050', name: '臺灣中小企業銀行' },
  { code: '052', name: '渣打國際商業銀行' },
  { code: '053', name: '台中商業銀行' },
  { code: '054', name: '京城商業銀行' },
  { code: '081', name: '匯豐（台灣）商業銀行' },
  { code: '101', name: '瑞興商業銀行' },
  { code: '102', name: '華泰商業銀行' },
  { code: '103', name: '臺灣新光商業銀行' },
  { code: '108', name: '陽信商業銀行' },
  { code: '118', name: '板信商業銀行' },
  { code: '147', name: '三信商業銀行' },
  { code: '803', name: '聯邦商業銀行' },
  { code: '805', name: '遠東國際商業銀行' },
  { code: '806', name: '元大商業銀行' },
  { code: '807', name: '永豐商業銀行' },
  { code: '808', name: '玉山商業銀行' },
  { code: '809', name: '凱基商業銀行' },
  { code: '810', name: '星展（台灣）商業銀行' },
  { code: '812', name: '台新國際商業銀行' },
  { code: '822', name: '中國信託商業銀行' },
  { code: '823', name: '將來商業銀行（NEXT Bank）' },
  { code: '824', name: '連線商業銀行（LINE Bank）' },
  { code: '826', name: '樂天國際商業銀行' },
];

interface ImportResult {
  success: boolean;
  updated: number;
  created: number;
  skipped: number;
  defaultRate: number;
  updatedNames: string[];
  createdNames: string[];
  totalImported: number;
}

export default function NursesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Nurse | null>(null);
  const [form, setForm] = useState({ name: '', account: '', password: '', hourlyRate: '0', bank: '', accountNo: '', accountName: '', defaultCaseId: '', note: '' });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dropdown search
  const [allNurses, setAllNurses] = useState<{ id: string; name: string; account: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load all nurses for dropdown
  useEffect(() => {
    fetch('/api/admin/nurses?pageSize=2000').then(r => r.json()).then(d =>
      setAllNurses((d.data || []).map((n: Nurse) => ({ id: n.id, name: n.name, account: n.account })))
    );
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredDropdown = search && !allNurses.find(n => n.name === search)
    ? allNurses.filter(n => n.name.includes(search) || n.account.toLowerCase().includes(search.toLowerCase()))
    : allNurses;

  const committedSearchRef = useRef(committedSearch);
  committedSearchRef.current = committedSearch;

  const { data: nurses, loading, hasMore, total, sentinelRef, refresh: refreshNurses } = useInfiniteScroll<Nurse>(
    { url: '/api/admin/nurses', buildParams: () => {
      const p: Record<string, string> = {};
      if (committedSearchRef.current) p.search = committedSearchRef.current;
      return p;
    }},
    [committedSearch],
  );

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此特護？')) return;
    const res = await fetch(`/api/admin/nurses?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '刪除失敗');
      return;
    }
    refreshNurses();
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', account: '', password: '', hourlyRate: '0', bank: '', accountNo: '', accountName: '', defaultCaseId: '', note: '' });
    setShowModal(true);
  };

  const openEdit = (n: Nurse) => {
    setEditing(n);
    setForm({
      name: n.name, account: n.account, password: '', hourlyRate: n.hourlyRate.toString(),
      bank: n.bank || '', accountNo: n.accountNo || '', accountName: n.accountName || '',
      defaultCaseId: n.defaultCaseId || '', note: n.note || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name, account: form.account, ...(form.password ? { password: form.password } : {}), hourlyRate: parseFloat(form.hourlyRate),
      bank: form.bank, accountNo: form.accountNo, accountName: form.accountName,
      defaultCaseId: form.defaultCaseId || null, note: form.note,
    };

    const res = await fetch('/api/admin/nurses', {
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
    refreshNurses();
  };

  // ===== Excel 匯出 =====
  const handleExport = async () => {
    try {
      const res = await fetch('/api/admin/nurses/export');
      if (!res.ok) { toast.error('匯出失敗'); return; }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fileName = match ? decodeURIComponent(match[1]) : `特護名冊_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { toast.error('匯出失敗'); }
  };

  // ===== Excel 匯入 =====
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const wb = XLSX.read(arrayBuffer, { type: 'array' });

      // 嘗試找「特護帳戶」分頁，找不到就用第一個
      const sheetName = wb.SheetNames.find(n => n.includes('特護帳戶')) || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      // 解析資料（跳過標頭）
      const items: { name: string; bank: string; accountNo: string; accountName: string }[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        const name = String(row[0] || '').trim();
        const accountName = String(row[2] || '').trim();
        const bank = String(row[3] || '').trim();
        const accountNo = String(row[4] || '').trim();
        if (name) {
          items.push({ name, bank, accountNo, accountName: accountName || name });
        }
      }

      if (items.length === 0) {
        toast.error('Excel 中沒有找到有效資料');
        setImporting(false);
        return;
      }

      // 確認匯入
      if (!confirm(`從「${sheetName}」解析到 ${items.length} 筆特護帳戶資料，確認匯入？\n\n（已存在的特護會更新銀行資訊，新特護會自動建立帳號）`)) {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
        return;
      }

      // 分批送出（每批 50 筆，避免超時）
      const batchSize = 50;
      let totalResult: ImportResult = {
        success: true, updated: 0, created: 0, skipped: 0,
        defaultRate: 0, updatedNames: [], createdNames: [], totalImported: 0,
      };

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const res = await fetch('/api/admin/nurses/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }),
        });

        if (!res.ok) {
          const errData = await res.json();
          toast.error(`匯入失敗（第 ${i + 1}-${i + batch.length} 筆）：${errData.error}`);
          break;
        }

        const result: ImportResult = await res.json();
        totalResult.updated += result.updated;
        totalResult.created += result.created;
        totalResult.skipped += result.skipped;
        totalResult.defaultRate = result.defaultRate;
        totalResult.totalImported += result.totalImported;
        if (result.updatedNames) totalResult.updatedNames.push(...result.updatedNames);
        if (result.createdNames) totalResult.createdNames.push(...result.createdNames);
      }

      setImportResult(totalResult);
      refreshNurses();
    } catch (err) {
      console.error('Import error:', err);
      toast.error('讀取 Excel 失敗，請確認檔案格式');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Search + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <label className="font-bold text-[var(--color-text-primary)] text-sm sm:text-base whitespace-nowrap">特護名稱</label>
          <div ref={searchRef} className="relative flex-1 sm:w-60">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true); if (!e.target.value) { setCommittedSearch(''); } }}
              onFocus={() => setDropdownOpen(true)}
              onKeyDown={e => { if (e.key === 'Enter') { setCommittedSearch(search); setDropdownOpen(false); } }}
              className="w-full px-3 py-1 border rounded text-sm"
              placeholder="搜尋特護名稱或帳號..."
            />
            {dropdownOpen && (
              <div className="absolute z-50 left-0 right-0 top-full bg-white border border-[var(--color-primary-border)] rounded shadow-lg max-h-60 overflow-y-auto">
                {committedSearch && (
                  <div className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-nav-hover-bg)] cursor-pointer border-b border-[var(--color-primary-border)]"
                    onClick={() => { setSearch(''); setCommittedSearch(''); setDropdownOpen(false); }}>
                    清除搜尋
                  </div>
                )}
                {filteredDropdown.slice(0, 30).map(n => (
                  <div key={n.id}
                    className={`px-3 py-1.5 text-sm hover:bg-blue-50 cursor-pointer ${n.name === committedSearch ? 'bg-blue-100 font-bold' : ''}`}
                    onClick={() => { setSearch(n.name); setCommittedSearch(n.name); setDropdownOpen(false); }}>
                    {n.name} <span className="text-[var(--color-text-muted)] text-xs">{n.account}</span>
                  </div>
                ))}
                {filteredDropdown.length > 30 && (
                  <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] text-center">繼續輸入以縮小範圍...</div>
                )}
                {filteredDropdown.length === 0 && (
                  <div className="px-3 py-2 text-sm text-[var(--color-text-muted)] text-center">無符合的特護</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 self-end">
          <button onClick={openAdd} className="px-4 py-2 btn-success text-white rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={16} />新增</button>
          <label className={`px-4 py-2 btn-primary text-white rounded-xl font-bold text-sm cursor-pointer flex items-center gap-1 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload size={16} />{importing ? '匯入中...' : '匯入 Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
          </label>
          <button onClick={handleExport} className="px-4 py-2 btn-primary text-white rounded-xl font-bold text-sm flex items-center gap-1"><Download size={16} />匯出</button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 mb-4 text-sm">
          <div className="font-bold text-green-800 mb-2">匯入完成！</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[var(--color-success)]">
            <div>更新：<span className="font-bold">{importResult.updated}</span> 筆</div>
            <div>新增：<span className="font-bold">{importResult.created}</span> 筆</div>
            <div>略過：<span className="font-bold">{importResult.skipped}</span> 筆</div>
            <div>預設時薪：<span className="font-bold">{importResult.defaultRate}</span></div>
          </div>
          {importResult.created > 0 && (
            <div className="mt-2 text-xs text-[var(--color-success)]">
              新建帳號預設密碼為 <span className="font-mono font-bold">0000</span>，請提醒特護登入後修改。
            </div>
          )}
          <button onClick={() => setImportResult(null)} className="mt-2 text-xs text-[var(--color-text-secondary)] underline">關閉</button>
        </div>
      )}

      {/* 手機版：卡片 */}
      <div className="sm:hidden space-y-2">
        {loading && nurses.length === 0 && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
        {nurses.map(n => (
          <div key={n.id} className="warm-card p-3 border border-[var(--color-primary-border)]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[var(--color-text-primary)]">{n.name}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(n)} className="px-2 py-1 btn-primary text-white rounded-xl text-xs flex items-center gap-1"><Pencil size={14} />編輯</button>
                <button onClick={() => handleDelete(n.id)} className="px-2 py-1 btn-danger text-white rounded-xl text-xs flex items-center gap-1"><Trash2 size={14} />刪除</button>
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mb-1.5">{n.account} | 時薪 {n.hourlyRate}</div>
            {n.bank && <div className="text-xs text-[var(--color-text-secondary)] mb-1">{n.bank} <span className="font-mono">{n.accountNo}</span></div>}
            {n.note && <div className="text-xs text-[var(--color-text-muted)]">備註：{n.note}</div>}
          </div>
        ))}
        {!loading && nurses.length === 0 && <EmptyState icon={UserCog} title="尚無特護資料" />}
      </div>

      {/* 桌面版：表格 */}
      <div className="hidden sm:block">
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>特護名稱</th>
            <th>帳號</th>
            <th>時薪</th>
            <th>銀行</th>
            <th>銀行帳號</th>
            <th>備註</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading && nurses.length === 0 && (
            <SkeletonTable rows={5} columns={7} />
          )}
          {nurses.map(n => (
            <tr key={n.id}>
              <td>{n.name}</td>
              <td>{n.account}</td>
              <td>{n.hourlyRate}</td>
              <td className="text-xs">{n.bank || '-'}</td>
              <td className="text-xs font-mono">{n.accountNo || '-'}</td>
              <td className="text-xs">{n.note || '-'}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  <button onClick={() => openEdit(n)} className="px-2 sm:px-3 py-1 btn-primary text-white rounded-xl text-xs sm:text-sm flex items-center gap-1"><Pencil size={14} />編輯</button>
                  <button onClick={() => handleDelete(n.id)} className="px-2 sm:px-3 py-1 btn-danger text-white rounded-xl text-xs sm:text-sm flex items-center gap-1"><Trash2 size={14} />刪除</button>
                </div>
              </td>
            </tr>
          ))}
          {!loading && nurses.length === 0 && (
            <tr><td colSpan={7}><EmptyState icon={UserCog} title="尚無特護資料" /></td></tr>
          )}
        </tbody>
      </table>
      </div>
      </div>

      {/* 無限滾動哨兵 */}
      <div ref={sentinelRef} className="py-4 text-center text-sm text-[var(--color-text-muted)]">
        {loading && nurses.length > 0 && <Spinner />}
        {!loading && !hasMore && nurses.length > 0 && `已顯示全部 ${total} 筆`}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay overflow-y-auto py-4">
          <div className="warm-card modal-content p-4 sm:p-6 w-full max-w-md mx-3 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold">{editing ? '編輯特護' : '新增特護'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">特護名稱</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">帳號</label>
                  <input value={form.account} onChange={e => setForm({...form, account: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">密碼{editing ? '（留空不修改）' : ''}</label>
                  <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm" placeholder={editing ? '留空不修改' : ''} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">時薪</label>
                <input type="number" value={form.hourlyRate} onChange={e => setForm({...form, hourlyRate: e.target.value})} placeholder="0 = 依個案費率" className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm" />
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">0 = 依個案費率 x0.9 計算</p>
              </div>
              <div className="border-t border-[var(--color-primary-border)] pt-3 mt-2">
                <h4 className="font-bold text-[var(--color-primary)] text-sm mb-2">銀行帳戶資訊（發薪用）</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">銀行名稱</label>
                  <select value={form.bank} onChange={e => setForm({...form, bank: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm">
                    <option value="">請選擇銀行</option>
                    {TAIWAN_BANKS.map(b => <option key={b.code} value={b.name}>({b.code}) {b.name}</option>)}
                  </select>
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">銀行帳號</label>
                  <input value={form.accountNo} onChange={e => setForm({...form, accountNo: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm font-mono" placeholder="帳號" />
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">戶名</label>
                  <input value={form.accountName} onChange={e => setForm({...form, accountName: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm" placeholder="帳戶戶名" />
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">備註</label>
                  <input value={form.note} onChange={e => setForm({...form, note: e.target.value})} className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded text-sm" placeholder="備註（會顯示在發放明細）" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSave} className="px-5 py-2 btn-success text-white rounded-xl text-sm flex items-center gap-1"><Save size={16} />儲存</button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-[var(--color-text-muted)] text-white rounded-xl hover:opacity-80 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
