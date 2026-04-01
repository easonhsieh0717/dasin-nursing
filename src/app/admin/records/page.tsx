'use client';

import { useState, useEffect, useRef } from 'react';
import CaseSearchInput from '@/components/CaseSearchInput';
import NurseSearchInput from '@/components/NurseSearchInput';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useToast } from '@/components/Toast';
import { Search, Plus, Download, Pencil, Trash2, ClipboardCheck, Save } from 'lucide-react';
import Spinner from '@/components/Spinner';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

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
  billing?: number;
  nurseSalary?: number;
  multiplier?: number;
  userId: string;
  caseId: string;
  paidAt: string | null;
}

interface NurseOption { id: string; name: string; account?: string; }
interface CaseOption { id: string; name: string; code: string; }
interface ModRequest { id: string; recordId: string; userId: string; userName: string; caseName: string; caseCode: string; originalClockInTime: string | null; originalClockOutTime: string | null; proposedClockInTime: string | null; proposedClockOutTime: string | null; reason: string; status: string; createdAt: string; }

function formatDT(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日 ${String(d.getHours()).padStart(2,'0')}點${String(d.getMinutes()).padStart(2,'0')}分`;
}

/** 將 ISO 時間字串轉為 datetime-local 格式（本地時區） */
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

function CoordsLink({ lat, lng, label }: { lat: number | null; lng: number | null; label?: string }) {
  if (lat === null || lng === null) return <span></span>;
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-link)] hover:underline">
      {label || '打卡點'}
    </a>
  );
}

export default function AdminRecordsPage() {
  const toast = useToast();

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
  const salaryManualRef = useRef(false);

  // 待審核修改申請
  const [modRequests, setModRequests] = useState<ModRequest[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<ModRequest | null>(null);

  // Committed search values（按搜尋按鈕時才更新，避免打字時自動刷新）
  const [searchFilters, setSearchFilters] = useState({
    startTime: '', endTime: '', clockType: 'in' as 'in' | 'out',
    settlementType: '', caseCode: '', caseName: '', userName: '',
  });

  const searchFiltersRef = useRef(searchFilters);
  searchFiltersRef.current = searchFilters;

  const { data: records, loading, hasMore, total, sentinelRef, refresh: refreshRecords } = useInfiniteScroll<EnrichedRecord>(
    {
      url: '/api/admin/records',
      buildParams: () => {
        const sf = searchFiltersRef.current;
        const p: Record<string, string> = {};
        if (sf.startTime) p.startTime = sf.startTime;
        if (sf.endTime) p.endTime = sf.endTime;
        if (sf.clockType) p.clockType = sf.clockType;
        if (sf.settlementType) p.settlementType = sf.settlementType;
        if (sf.caseCode) p.caseCode = sf.caseCode;
        if (sf.caseName) p.caseName = sf.caseName;
        if (sf.userName) p.userName = sf.userName;
        return p;
      },
    },
    [searchFilters],
  );

  const handleSearch = () => {
    setSearchFilters({ startTime, endTime, clockType, settlementType, caseCode, caseName, userName });
  };

  useEffect(() => {
    fetch('/api/admin/nurses?all=true').then(r => r.json()).then(d => setNurses(d.data || []));
    fetch('/api/admin/cases?all=true').then(r => r.json()).then(d => setCases(d.data || []));
    fetchModRequests();
  }, []);

  const fetchModRequests = () => {
    fetch('/api/admin/modification-requests?status=pending')
      .then(r => r.json())
      .then(d => setModRequests(d.data || []))
      .catch(() => {});
  };

  // 建立 recordId → ModRequest 的對照表
  const modRequestMap = new Map(modRequests.map(r => [r.recordId, r]));

  const openReviewModal = (req: ModRequest) => {
    setReviewingRequest(req);
    setShowReviewModal(true);
  };

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    const msg = action === 'approve' ? '確定同意此修改申請？將自動更新打卡紀錄。' : '確定拒絕此修改申請？';
    if (!confirm(msg)) return;
    const res = await fetch('/api/admin/modification-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '操作失敗');
      return;
    }
    setModRequests(prev => prev.filter(r => r.id !== id));
    setShowReviewModal(false);
    setReviewingRequest(null);
    refreshRecords();
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (searchFilters.startTime) params.set('startTime', searchFilters.startTime);
    if (searchFilters.endTime) params.set('endTime', searchFilters.endTime);
    if (searchFilters.clockType) params.set('clockType', searchFilters.clockType);
    if (searchFilters.settlementType) params.set('settlementType', searchFilters.settlementType);
    if (searchFilters.caseCode) params.set('caseCode', searchFilters.caseCode);
    if (searchFilters.caseName) params.set('caseName', searchFilters.caseName);
    if (searchFilters.userName) params.set('userName', searchFilters.userName);
    try {
      const res = await fetch(`/api/admin/export?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || '匯出失敗');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fileName = match ? decodeURIComponent(match[1]) : `export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('匯出失敗，請稍後再試');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此紀錄？')) return;
    const res = await fetch(`/api/admin/records?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '刪除失敗');
      return;
    }
    refreshRecords();
  };

  const openAdd = () => {
    setEditingRecord(null);
    salaryManualRef.current = false;
    setFormData({ userId: nurses[0]?.id || '', caseId: cases[0]?.id || '', clockInTime: '', clockOutTime: '', clockInLat: '', clockInLng: '', clockOutLat: '', clockOutLng: '', salary: '0' });
    setShowModal(true);
  };

  const openEdit = (r: EnrichedRecord) => {
    setEditingRecord(r);
    salaryManualRef.current = false;
    setFormData({
      userId: r.userId, caseId: r.caseId,
      clockInTime: toLocalDatetime(r.clockInTime),
      clockOutTime: toLocalDatetime(r.clockOutTime),
      clockInLat: r.clockInLat?.toString() || '',
      clockInLng: r.clockInLng?.toString() || '',
      clockOutLat: r.clockOutLat?.toString() || '',
      clockOutLng: r.clockOutLng?.toString() || '',
      salary: '0',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    // 驗證：上班時間必須早於下班時間
    if (formData.clockInTime && formData.clockOutTime) {
      if (new Date(formData.clockInTime) >= new Date(formData.clockOutTime)) {
        toast.error('上班時間必須早於下班時間');
        return;
      }
    }

    const body = {
      ...(editingRecord ? { id: editingRecord.id } : {}),
      userId: formData.userId,
      caseId: formData.caseId,
      clockInTime: formData.clockInTime ? new Date(formData.clockInTime).toISOString() : null,
      clockOutTime: formData.clockOutTime ? new Date(formData.clockOutTime).toISOString() : null,
      clockInLat: formData.clockInLat ? parseFloat(formData.clockInLat) : null,
      clockInLng: formData.clockInLng ? parseFloat(formData.clockInLng) : null,
      clockOutLat: formData.clockOutLat ? parseFloat(formData.clockOutLat) : null,
      clockOutLng: formData.clockOutLng ? parseFloat(formData.clockOutLng) : null,
      salary: salaryManualRef.current ? (parseFloat(formData.salary) || 0) : 0,
    };

    const res = await fetch('/api/admin/records', {
      method: editingRecord ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '儲存失敗');
      return;
    }

    setShowModal(false);
    refreshRecords();
  };

  return (
    <div className="p-2 sm:p-4">
      {/* 待審核修改申請區塊 — 直接可操作 */}
      {modRequests.length > 0 && (
        <div className="bg-[var(--color-primary-light)] border-2 border-[var(--color-primary)] rounded-xl mb-3 overflow-hidden">
          <div className="bg-[var(--color-primary-light)] px-4 py-2 flex items-center gap-2">
            <span className="text-[var(--color-primary)] font-bold text-lg">⚠</span>
            <span className="font-bold text-[var(--color-primary)] text-sm">
              待簽核修改申請（{modRequests.length} 筆）
            </span>
          </div>
          <div className="divide-y divide-[var(--color-primary-border)]">
            {modRequests.map(req => (
              <div key={req.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-[var(--color-text-primary)]">{req.userName}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className="text-[var(--color-text-secondary)]">{req.caseName}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDT(req.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-[var(--color-text-secondary)]">上班：<span className="line-through">{formatDT(req.originalClockInTime) || '—'}</span> → <span className="font-bold text-[var(--color-primary)]">{formatDT(req.proposedClockInTime) || '—'}</span></span>
                    <span className="text-[var(--color-text-secondary)]">下班：<span className="line-through">{formatDT(req.originalClockOutTime) || '—'}</span> → <span className="font-bold text-[var(--color-primary)]">{formatDT(req.proposedClockOutTime) || '—'}</span></span>
                  </div>
                  <div className="text-xs badge-pending inline-block px-2 py-0.5 rounded">原因：{req.reason}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openReviewModal(req)} className="px-3 py-1.5 btn-primary text-white rounded text-sm font-bold flex items-center gap-1"><ClipboardCheck size={14} />審核</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="warm-card p-3 mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <input type="date" value={startTime} onChange={e => setStartTime(e.target.value)} className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm w-[130px]" />
          <span className="text-sm">~</span>
          <input type="date" value={endTime} onChange={e => setEndTime(e.target.value)} className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm w-[130px]" />
          <div className="flex gap-0.5">
            <button onClick={() => setClockType('in')} className={`px-2 py-1 rounded text-xs ${clockType === 'in' ? 'btn-primary text-white' : 'bg-gray-200'}`}>上班</button>
            <button onClick={() => setClockType('out')} className={`px-2 py-1 rounded text-xs ${clockType === 'out' ? 'bg-gray-600 text-white' : 'bg-gray-200'}`}>下班</button>
          </div>
          <span className="text-[var(--color-primary-border)]">|</span>
          {['', '週', '月', '半月'].map(t => (
            <button key={t || 'all'} onClick={() => setSettlementType(t)}
              className={`px-2 py-1 rounded text-xs ${settlementType === t ? 'btn-primary text-white' : 'bg-gray-200'}`}>
              {t || '全部'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[var(--color-primary)] text-xs font-bold whitespace-nowrap">個案</span>
          <CaseSearchInput
            cases={cases}
            value={caseName ? cases.find(c => c.name === caseName)?.id || '' : ''}
            onChange={id => {
              const c = cases.find(c => c.id === id);
              setCaseName(c?.name || '');
              setCaseCode(c?.code || '');
            }}
            placeholder="搜尋個案名稱或代碼..."
            showCode
            className="flex-1 sm:w-48"
          />
          <button onClick={handleSearch} className="px-3 py-1 btn-primary text-white rounded font-bold text-xs whitespace-nowrap flex items-center gap-1"><Search size={14} />搜尋</button>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-[var(--color-primary)] text-xs font-bold whitespace-nowrap">特護</span>
          <NurseSearchInput
            nurses={nurses}
            value={userName}
            onChange={name => setUserName(name)}
            placeholder="搜尋特護姓名或帳號..."
            className="flex-1 sm:w-48"
          />
          <button onClick={handleSearch} className="px-3 py-1 btn-primary text-white rounded font-bold text-xs whitespace-nowrap flex items-center gap-1"><Search size={14} />搜尋</button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 mb-2">
        <button onClick={handleExport} className="px-3 sm:px-4 py-2 btn-success text-white rounded font-bold text-sm flex items-center gap-1">
          <Download size={16} />匯出
        </button>
        <button onClick={openAdd} className="px-3 sm:px-4 py-2 btn-success text-white rounded font-bold text-sm flex items-center gap-1">
          <Plus size={16} />新增
        </button>
      </div>

      {/* 手機版：卡片 */}
      <div className="sm:hidden space-y-2">
        {loading && records.length === 0 && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
        {records.map(r => {
          const isAnomaly = !!(r.clockInTime && !r.clockOutTime &&
            (Date.now() - new Date(r.clockInTime).getTime()) > 12 * 60 * 60 * 1000);
          const pendingReq = modRequestMap.get(r.id);
          return (
            <div key={r.id} className={`warm-card p-3 border ${isAnomaly ? 'border-[var(--color-danger)] bg-red-50' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="font-bold text-[var(--color-text-primary)]">{r.caseName}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-1">{r.caseCode}</span>
                </div>
                <div className="flex gap-1">
                  {pendingReq ? (
                    <button onClick={() => openReviewModal(pendingReq)} className="px-2 py-1 btn-primary text-white rounded text-xs font-bold flex items-center gap-1"><ClipboardCheck size={14} />簽核</button>
                  ) : null}
                  <button onClick={() => openEdit(r)} className="px-2 py-1 btn-primary text-white rounded text-xs flex items-center gap-1"><Pencil size={14} />編輯</button>
                  <button onClick={() => handleDelete(r.id)} className="px-2 py-1 btn-danger text-white rounded text-xs flex items-center gap-1"><Trash2 size={14} />刪除</button>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mb-1">特護：{r.userName}</div>
              <div className="text-xs text-[var(--color-text-secondary)] mb-1">
                上班：{formatDT(r.clockInTime)}
                {r.clockInLat != null && <span> · <CoordsLink lat={r.clockInLat} lng={r.clockInLng} label="打卡點" /></span>}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mb-1.5">
                下班：{r.clockOutTime ? formatDT(r.clockOutTime) : (
                  isAnomaly
                    ? <span className="text-[var(--color-danger)] font-bold">未下班 (超過12h)</span>
                    : <span className="text-[var(--color-primary)]">值班中</span>
                )}
                {r.clockOutLat != null && <span> · <CoordsLink lat={r.clockOutLat} lng={r.clockOutLng} label="打卡點" /></span>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span>請款 <span className="font-bold text-[var(--color-primary)]">{r.billing ?? r.calculatedSalary ?? r.salary}</span></span>
                <span>薪資 <span className="font-bold text-[var(--color-success)]">{r.nurseSalary ?? '—'}</span></span>
                {r.multiplier && r.multiplier > 1 && <span className="text-[var(--color-danger)] font-bold">{r.multiplier}x</span>}
                {r.paidAt ? <span className="text-[var(--color-success)] font-bold">已發放</span> : <span className="text-[var(--color-text-muted)]">未發放</span>}
              </div>
            </div>
          );
        })}
        {!loading && records.length === 0 && (
          <EmptyState icon={ClipboardCheck} title="尚無打卡紀錄" />
        )}
      </div>

      {/* 桌面版：表格 */}
      <div className="hidden sm:block">
      <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>個案名稱</th>
            <th>個案代碼</th>
            <th>特護名稱</th>
            <th>上班打卡點</th>
            <th>下班打卡點</th>
            <th>上班時間</th>
            <th>下班時間</th>
            <th>請款金額</th>
            <th>特護薪資</th>
            <th>倍率</th>
            <th>發放</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {loading && records.length === 0 && (
            <SkeletonTable rows={5} columns={12} />
          )}
          {records.map(r => {
            // 異常偵測：有上班但未下班，且超過 12 小時
            const isAnomaly = !!(r.clockInTime && !r.clockOutTime &&
              (Date.now() - new Date(r.clockInTime).getTime()) > 12 * 60 * 60 * 1000);
            const pendingReq = modRequestMap.get(r.id);
            return (
            <tr key={r.id} className={isAnomaly ? 'bg-red-50' : ''}>
              <td>{r.caseName}</td>
              <td>{r.caseCode}</td>
              <td>{r.userName}</td>
              <td className="text-xs"><CoordsLink lat={r.clockInLat} lng={r.clockInLng} label="打卡點" /></td>
              <td className="text-xs"><CoordsLink lat={r.clockOutLat} lng={r.clockOutLng} label="打卡點" /></td>
              <td>{formatDT(r.clockInTime)}</td>
              <td>
                {r.clockOutTime ? formatDT(r.clockOutTime) : (
                  isAnomaly
                    ? <span className="text-[var(--color-danger)] font-bold text-xs">⚠ 未下班 (超過12h)</span>
                    : <span className="text-[var(--color-primary)] text-xs">值班中</span>
                )}
              </td>
              <td className="font-bold text-[var(--color-primary)]">{r.billing ?? r.calculatedSalary ?? r.salary}</td>
              <td className="font-bold text-[var(--color-success)]">{r.nurseSalary ?? ''}</td>
              <td>{r.multiplier && r.multiplier > 1 ? <span className="text-[var(--color-danger)] font-bold">{r.multiplier}x</span> : ''}</td>
              <td>{r.paidAt ? <span className="text-[var(--color-success)] font-bold text-xs">✓ 已發放</span> : <span className="text-[var(--color-text-muted)] text-xs">未發放</span>}</td>
              <td>
                <div className="flex gap-1 justify-center">
                  {pendingReq ? (
                    <button onClick={() => openReviewModal(pendingReq)} className="px-2 sm:px-3 py-1 btn-primary text-white rounded text-xs sm:text-sm font-bold flex items-center gap-1"><ClipboardCheck size={14} />簽核</button>
                  ) : (
                    <button disabled className="px-2 sm:px-3 py-1 bg-gray-300 text-[var(--color-text-secondary)] rounded text-xs sm:text-sm cursor-not-allowed flex items-center gap-1"><ClipboardCheck size={14} />簽核</button>
                  )}
                  <button onClick={() => openEdit(r)} className="px-2 sm:px-3 py-1 btn-primary text-white rounded text-xs sm:text-sm flex items-center gap-1"><Pencil size={14} />編輯</button>
                  <button onClick={() => handleDelete(r.id)} className="px-2 sm:px-3 py-1 btn-danger text-white rounded text-xs sm:text-sm flex items-center gap-1"><Trash2 size={14} />刪除</button>
                </div>
              </td>
            </tr>
            );
          })}
          {!loading && records.length === 0 && (
            <tr><td colSpan={12}><EmptyState icon={ClipboardCheck} title="尚無打卡紀錄" /></td></tr>
          )}
        </tbody>
      </table>
      </div>
      </div>

      {/* 無限滾動哨兵 + 載入狀態 */}
      <div ref={sentinelRef} className="py-4 text-center text-sm text-[var(--color-text-muted)]">
        {loading && records.length > 0 && <Spinner />}
        {!loading && !hasMore && records.length > 0 && `已顯示全部 ${total} 筆`}
        {!loading && records.length === 0 && ''}
      </div>

      {/* 編輯/新增 Modal */}
      {showModal && (
        <div className="modal-overlay overflow-y-auto py-4 sm:py-8">
          <div className="warm-card modal-content p-4 sm:p-6 w-full max-w-lg mx-3 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold">{editingRecord ? '編輯紀錄' : '新增紀錄'}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">特護</label>
                <select value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} className="w-full px-2 py-1.5 border border-[var(--color-primary-border)] rounded text-sm">
                  {nurses.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">個案</label>
                <CaseSearchInput cases={cases} value={formData.caseId}
                  onChange={id => setFormData({...formData, caseId: id})}
                  placeholder="搜尋個案..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">上班時間</label>
                <input type="datetime-local" value={formData.clockInTime} onChange={e => setFormData({...formData, clockInTime: e.target.value})} className="w-full px-2 py-1.5 border border-[var(--color-primary-border)] rounded text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">下班時間</label>
                <input type="datetime-local" value={formData.clockOutTime} onChange={e => setFormData({...formData, clockOutTime: e.target.value})} className="w-full px-2 py-1.5 border border-[var(--color-primary-border)] rounded text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">請款金額</label>
                <input type="number" value={formData.salary}
                  onChange={e => { salaryManualRef.current = true; setFormData({...formData, salary: e.target.value}); }}
                  placeholder="0 = 自動計算"
                  className="w-full px-2 py-1.5 border border-[var(--color-primary-border)] rounded text-sm" />
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{salaryManualRef.current ? '手動覆寫' : '儲存後自動計算'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSave} className="px-4 sm:px-5 py-2 btn-success text-white rounded text-sm flex items-center gap-1"><Save size={16} />儲存</button>
              <button onClick={() => setShowModal(false)} className="px-4 sm:px-5 py-2 bg-[var(--color-text-muted)] text-white rounded hover:opacity-80 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 簽核 Modal */}
      {showReviewModal && reviewingRequest && (
        <div className="modal-overlay overflow-y-auto py-4 sm:py-8">
          <div className="warm-card modal-content p-4 sm:p-6 w-full max-w-lg mx-3 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--color-primary)]">簽核修改申請</h2>

            <div className="bg-[var(--color-primary-light)] rounded-xl p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">申請人</span>
                <span className="font-bold">{reviewingRequest.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">個案</span>
                <span className="font-bold">{reviewingRequest.caseName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">申請時間</span>
                <span>{formatDT(reviewingRequest.createdAt)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">原始上班時間</div>
                  <div className="text-sm font-medium">{formatDT(reviewingRequest.originalClockInTime) || '—'}</div>
                </div>
                <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] p-3 rounded-xl">
                  <div className="text-xs text-[var(--color-primary)] mb-1">建議上班時間</div>
                  <div className="text-sm font-bold text-[var(--color-primary)]">{formatDT(reviewingRequest.proposedClockInTime) || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">原始下班時間</div>
                  <div className="text-sm font-medium">{formatDT(reviewingRequest.originalClockOutTime) || '—'}</div>
                </div>
                <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] p-3 rounded-xl">
                  <div className="text-xs text-[var(--color-primary)] mb-1">建議下班時間</div>
                  <div className="text-sm font-bold text-[var(--color-primary)]">{formatDT(reviewingRequest.proposedClockOutTime) || '—'}</div>
                </div>
              </div>
            </div>

            <div className="badge-pending rounded-xl p-3">
              <div className="text-xs font-bold mb-1">修改原因</div>
              <div className="text-sm text-[var(--color-text-primary)]">{reviewingRequest.reason}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => handleReview(reviewingRequest.id, 'approve')} className="px-4 sm:px-5 py-2 btn-success text-white rounded text-sm font-bold">同意</button>
              <button onClick={() => handleReview(reviewingRequest.id, 'reject')} className="px-4 sm:px-5 py-2 btn-danger text-white rounded text-sm font-bold">拒絕</button>
              <button onClick={() => { setShowReviewModal(false); setReviewingRequest(null); }} className="px-4 sm:px-5 py-2 bg-[var(--color-text-muted)] text-white rounded hover:opacity-80 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
