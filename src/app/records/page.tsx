'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMotivationalQuote } from '@/lib/motivational-quotes';
import EmployeeNav from '@/components/EmployeeNav';
import { useToast } from '@/components/Toast';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import Spinner from '@/components/Spinner';
import { ClipboardList, Search } from 'lucide-react';

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
  reason?: string;
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
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-link)] hover:underline">
      打卡點
    </a>
  );
}

export default function RecordsPage() {
  const router = useRouter();
  const toast = useToast();
  const [records, setRecords] = useState<Record[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [searchStartTime, setSearchStartTime] = useState('');
  const [searchEndTime, setSearchEndTime] = useState('');

  const [modRequests, setModRequests] = useState<ModRequest[]>([]);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyingRecord, setModifyingRecord] = useState<Record | null>(null);
  const [proposedClockIn, setProposedClockIn] = useState('');
  const [proposedClockOut, setProposedClockOut] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<Record | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

  const getModStatus = (recordId: string): 'pending' | 'approved' | 'rejected' | null => {
    const req = modRequests.find(r => r.recordId === recordId && !r.reason?.startsWith('[刪除申請]'));
    return req?.status || null;
  };

  const getDeleteStatus = (recordId: string): 'pending' | 'approved' | 'rejected' | null => {
    const req = modRequests.find(r => r.recordId === recordId && r.reason?.startsWith('[刪除申請]'));
    return req?.status || null;
  };

  const openDeleteModal = (r: Record) => {
    setDeletingRecord(r);
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const handleSubmitDeletion = async () => {
    if (!deletingRecord) return;
    if (!deleteReason.trim()) { toast.error('請填寫刪除原因'); return; }
    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/modification-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: deletingRecord.id,
          proposedClockInTime: null,
          proposedClockOutTime: null,
          reason: `[刪除申請] ${deleteReason.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || '申請失敗'); return; }
      toast.success('刪除申請已送出，等待管理員審核');
      setShowDeleteModal(false);
      fetchModRequests();
    } catch { toast.error('系統錯誤'); }
    finally { setDeleteSubmitting(false); }
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
    if (!reason.trim()) { toast.error('請填寫修改原因'); return; }
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
      if (!res.ok) { toast.error(data.error || '申請失敗'); return; }
      toast.success('申請已送出，等待管理員審核');
      setShowModifyModal(false);
      fetchModRequests();
    } catch { toast.error('系統錯誤'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen">
      <EmployeeNav />

      <div className="p-3 sm:p-6">
        {/* Date filter */}
        <div className="warm-card p-3 mb-3 flex flex-wrap items-center gap-2">
          <span className="font-bold text-[var(--color-primary)] text-sm">篩選時間</span>
          <input type="date" value={startTime} onChange={e => setStartTime(e.target.value)} className="px-2 py-1 text-sm flex-1 min-w-[120px]" />
          <span className="text-sm text-[var(--color-text-secondary)]">~</span>
          <input type="date" value={endTime} onChange={e => setEndTime(e.target.value)} className="px-2 py-1 text-sm flex-1 min-w-[120px]" />
          <button onClick={handleSearch} className="btn-primary px-4 py-1.5 text-sm">
            <Search size={14} className="inline mr-1" />搜尋
          </button>
        </div>

        {/* 手機版：卡片 */}
        <div className="sm:hidden space-y-2">
          {records.map(r => {
            const modStatus = getModStatus(r.id);
            const delStatus = getDeleteStatus(r.id);
            return (
              <div key={r.id} className="warm-card p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-[var(--color-text-primary)]">{r.caseName}</span>
                  <div className="flex flex-col items-end gap-1">
                    {modStatus === 'pending' ? (
                      <span className="badge-pending">修改申請中</span>
                    ) : modStatus === 'approved' ? (
                      <span className="badge-approved">修改已通過</span>
                    ) : modStatus === 'rejected' ? (
                      <span className="badge-rejected">修改已拒絕</span>
                    ) : (
                      <button onClick={() => openModifyModal(r)} className="btn-primary px-2 py-1 text-xs">申請修改</button>
                    )}
                    {delStatus === 'pending' ? (
                      <span className="badge-pending">刪除申請中</span>
                    ) : delStatus === 'approved' ? (
                      <span className="badge-approved">刪除已通過</span>
                    ) : delStatus === 'rejected' ? (
                      <span className="badge-rejected">刪除已拒絕</span>
                    ) : (
                      <button onClick={() => openDeleteModal(r)} className="btn-danger px-2 py-1 text-xs">申請刪除</button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mb-1">
                  上班：{formatDateTime(r.clockInTime)}
                  {r.clockInLat != null && <span> · <CoordsLink lat={r.clockInLat} lng={r.clockInLng} /></span>}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mb-1.5">
                  下班：{r.clockOutTime ? formatDateTime(r.clockOutTime) : <span className="text-[var(--color-primary)]">值班中</span>}
                  {r.clockOutLat != null && <span> · <CoordsLink lat={r.clockOutLat} lng={r.clockOutLng} /></span>}
                </div>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span>薪資 <span className="font-bold text-[var(--color-success)]">{r.calculatedSalary ?? '—'}</span></span>
                  {r.multiplier && r.multiplier > 1 && <span className="text-[var(--color-danger)] font-bold">{r.multiplier}x</span>}
                  {r.calculatedSalary != null && r.calculatedSalary > 0 && (
                    <span className="text-[var(--color-primary)] italic text-[11px]">{getMotivationalQuote(r.calculatedSalary, r.id)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {loading && [1,2,3].map(i => <SkeletonCard key={i} />)}
          {!loading && records.length === 0 && <EmptyState icon={ClipboardList} title="尚無紀錄" description="打卡後紀錄會顯示在這裡" />}
        </div>

        {/* 桌面版：表格 */}
        <div className="hidden sm:block table-wrap">
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
              const delStatus = getDeleteStatus(r.id);
              return (
                <tr key={r.id}>
                  <td>{r.caseName}</td>
                  <td>{r.userName}</td>
                  <td className="text-xs"><CoordsLink lat={r.clockInLat} lng={r.clockInLng} /></td>
                  <td className="text-xs"><CoordsLink lat={r.clockOutLat} lng={r.clockOutLng} /></td>
                  <td>{formatDateTime(r.clockInTime)}</td>
                  <td>{formatDateTime(r.clockOutTime)}</td>
                  <td>
                    <span className="font-bold text-[var(--color-success)]">{r.calculatedSalary ?? ''}</span>
                    {r.calculatedSalary != null && r.calculatedSalary > 0 && (
                      <div className="text-[var(--color-primary)] italic text-[11px] mt-0.5">{getMotivationalQuote(r.calculatedSalary, r.id)}</div>
                    )}
                  </td>
                  <td>{r.multiplier && r.multiplier > 1 ? <span className="text-[var(--color-danger)] font-bold">{r.multiplier}x</span> : ''}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {modStatus === 'pending' ? (
                        <span className="badge-pending">修改申請中</span>
                      ) : modStatus === 'approved' ? (
                        <span className="badge-approved">修改已通過</span>
                      ) : modStatus === 'rejected' ? (
                        <span className="badge-rejected">修改已拒絕</span>
                      ) : (
                        <button onClick={() => openModifyModal(r)} className="btn-primary px-2 py-1 text-xs">申請修改</button>
                      )}
                      {delStatus === 'pending' ? (
                        <span className="badge-pending">刪除申請中</span>
                      ) : delStatus === 'approved' ? (
                        <span className="badge-approved">刪除已通過</span>
                      ) : delStatus === 'rejected' ? (
                        <span className="badge-rejected">刪除已拒絕</span>
                      ) : (
                        <button onClick={() => openDeleteModal(r)} className="btn-danger px-2 py-1 text-xs">申請刪除</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {loading && (
              <SkeletonTable rows={5} columns={9} />
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={9}><EmptyState icon={ClipboardList} title="尚無紀錄" /></td></tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-[var(--color-primary-border)] rounded-xl disabled:opacity-30">&lt;</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) pageNum = i + 1;
            else if (page <= 3) pageNum = i + 1;
            else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
            else pageNum = page - 2 + i;
            return <button key={pageNum} onClick={() => setPage(pageNum)} className={`px-3 py-1 border border-[var(--color-primary-border)] rounded-xl ${page === pageNum ? 'bg-[var(--color-primary)] text-white' : ''}`}>{pageNum}</button>;
          })}
          {totalPages > 5 && <span className="px-2 text-[var(--color-text-secondary)]">... {totalPages}</span>}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border border-[var(--color-primary-border)] rounded-xl disabled:opacity-30">&gt;</button>
          <span className="ml-4 text-sm text-[var(--color-text-secondary)]">共 {total} 筆 | 每頁 10 筆</span>
        </div>
      </div>

      {/* 申請刪除 Modal */}
      {showDeleteModal && deletingRecord && (
        <div className="modal-overlay overflow-y-auto py-4">
          <div className="warm-card modal-content p-4 sm:p-6 w-full max-w-lg mx-3 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--color-danger)]">申請刪除打卡紀錄</h2>
            <div className="space-y-3">
              <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                <div className="text-sm text-[var(--color-text-secondary)] mb-1">個案</div>
                <div className="font-medium">{deletingRecord.caseName}</div>
              </div>
              <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                <div className="text-sm text-[var(--color-text-secondary)] mb-1">上班時間</div>
                <div className="font-medium">{formatDateTime(deletingRecord.clockInTime) || '—'}</div>
              </div>
              <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                <div className="text-sm text-[var(--color-text-secondary)] mb-1">下班時間</div>
                <div className="font-medium">{formatDateTime(deletingRecord.clockOutTime) || '—'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">刪除原因 <span className="text-[var(--color-danger)]">*</span></label>
                <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                  placeholder="請說明刪除原因（必填）" rows={3}
                  className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded-xl text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSubmitDeletion} disabled={deleteSubmitting}
                className="btn-danger px-4 py-2 text-sm disabled:opacity-50">
                {deleteSubmitting ? <Spinner size="sm" /> : '提交刪除申請'}
              </button>
              <button onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-[var(--color-text-muted)] text-white rounded-xl hover:opacity-80 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 申請修改 Modal */}
      {showModifyModal && modifyingRecord && (
        <div className="modal-overlay overflow-y-auto py-4">
          <div className="warm-card modal-content p-4 sm:p-6 w-full max-w-lg mx-3 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">申請修改打卡時間</h2>
            <div className="space-y-3">
              <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                <div className="text-sm text-[var(--color-text-secondary)] mb-1">原始上班時間</div>
                <div className="font-medium">{formatDateTime(modifyingRecord.clockInTime) || '—'}</div>
              </div>
              <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                <div className="text-sm text-[var(--color-text-secondary)] mb-1">原始下班時間</div>
                <div className="font-medium">{formatDateTime(modifyingRecord.clockOutTime) || '—'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">建議上班時間</label>
                <input type="datetime-local" value={proposedClockIn} onChange={e => setProposedClockIn(e.target.value)} className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">建議下班時間</label>
                <input type="datetime-local" value={proposedClockOut} onChange={e => setProposedClockOut(e.target.value)} className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">修改原因 <span className="text-[var(--color-danger)]">*</span></label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="請說明修改原因（必填）" rows={3}
                  className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded-xl text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSubmitModification} disabled={submitting}
                className="btn-success px-4 py-2 text-sm disabled:opacity-50">
                {submitting ? <Spinner size="sm" /> : '提交申請'}
              </button>
              <button onClick={() => setShowModifyModal(false)}
                className="px-4 py-2 bg-[var(--color-text-muted)] text-white rounded-xl hover:opacity-80 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
