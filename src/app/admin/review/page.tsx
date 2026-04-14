'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { Search, CheckSquare, ClipboardCheck } from 'lucide-react';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

interface StatRow {
  userId: string;
  userName: string;
  totalClocks: number;
  totalRequests: number;
  approved: number;
  rejected: number;
  pending: number;
  ratio: number;
}

interface DetailRow {
  id: string;
  recordId: string;
  originalClockInTime: string | null;
  originalClockOutTime: string | null;
  proposedClockInTime: string | null;
  proposedClockOutTime: string | null;
  reason: string;
  status: string;
  createdAt: string;
  caseName?: string;
  caseCode?: string;
}

function formatDT(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

interface PendingRequest {
  id: string;
  recordId: string;
  userId: string;
  userName: string;
  caseName: string;
  caseCode: string;
  originalClockInTime: string | null;
  originalClockOutTime: string | null;
  proposedClockInTime: string | null;
  proposedClockOutTime: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

interface PasswordResetRow {
  id: string;
  userId: string;
  userName: string;
  status: string;
  createdAt: string;
}

export default function ReviewPage() {
  const toast = useToast();
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // 待簽核打卡修改
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<PendingRequest | null>(null);

  // 密碼重設申請
  const [pwResetRequests, setPwResetRequests] = useState<PasswordResetRow[]>([]);

  // 展開明細
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate = '';
    let endDate = '';
    if (range === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      startDate = start.toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
    } else if (range === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      startDate = start.toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
    } else {
      startDate = customStart;
      endDate = customEnd;
    }
    return { startDate, endDate };
  }, [range, customStart, customEnd]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange();
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    try {
      const res = await fetch(`/api/admin/modification-stats?${params}`);
      const data = await res.json();
      setStats(data.data || []);
    } catch {
      setStats([]);
    }
    setLoading(false);
  }, [getDateRange]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/modification-requests?status=pending');
      const data = await res.json();
      setPendingRequests(data.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchPwResets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/password-reset-requests?status=pending');
      const data = await res.json();
      setPwResetRequests(data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchPending(); fetchPwResets(); }, [fetchPending, fetchPwResets]);

  const handlePwReset = async (id: string, action: 'approved' | 'rejected') => {
    const msg = action === 'approved' ? '確定同意密碼重設？將重設密碼為帳號名稱，並要求下次登入修改。' : '確定拒絕此密碼重設申請？';
    if (!confirm(msg)) return;
    const res = await fetch('/api/admin/password-reset-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '操作失敗');
      return;
    }
    toast.success(action === 'approved' ? '已同意，密碼已重設' : '已拒絕');
    setPwResetRequests(prev => prev.filter(r => r.id !== id));
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
    toast.success(action === 'approve' ? '已同意' : '已拒絕');
    setPendingRequests(prev => prev.filter(r => r.id !== id));
    setShowReviewModal(false);
    setReviewingRequest(null);
    fetchStats();
  };

  const toggleDetail = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setDetails([]);
      return;
    }
    setExpandedUser(userId);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/modification-requests?userId=${userId}`);
      const data = await res.json();
      setDetails(data.data || []);
    } catch {
      setDetails([]);
    }
    setDetailLoading(false);
  };

  const statusLabel = (s: string) => {
    if (s === 'pending') return <span className="badge-pending px-2 py-0.5 rounded text-xs font-bold">待審核</span>;
    if (s === 'approved') return <span className="badge-approved px-2 py-0.5 rounded text-xs font-bold">已通過</span>;
    if (s === 'rejected') return <span className="badge-rejected px-2 py-0.5 rounded text-xs font-bold">已拒絕</span>;
    return s;
  };

  return (
    <div className="p-2 sm:p-4">
      {/* 待簽核修改申請 */}
      {pendingRequests.length > 0 && (
        <div className="bg-[var(--color-primary-light)] border-2 border-[var(--color-primary)] rounded-xl mb-4 overflow-hidden">
          <div className="bg-[var(--color-primary-light)] px-4 py-2 flex items-center gap-2">
            <span className="text-[var(--color-primary)] font-bold text-lg">⚠</span>
            <span className="font-bold text-[var(--color-primary)] text-sm">
              待簽核修改申請（{pendingRequests.length} 筆）
            </span>
          </div>
          <div className="divide-y divide-[var(--color-primary-border)]">
            {pendingRequests.map(req => (
              <div key={req.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-white">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-[var(--color-text-primary)]">{req.userName}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className="text-[var(--color-text-secondary)]">{req.caseName}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDT(req.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="text-[var(--color-text-secondary)]">上班：<span className="line-through">{formatDT(req.originalClockInTime)}</span> → <span className="font-bold text-[var(--color-primary)]">{formatDT(req.proposedClockInTime)}</span></span>
                    <span className="text-[var(--color-text-secondary)]">下班：<span className="line-through">{formatDT(req.originalClockOutTime)}</span> → <span className="font-bold text-[var(--color-primary)]">{formatDT(req.proposedClockOutTime)}</span></span>
                  </div>
                  <div className="text-xs badge-pending inline-block px-2 py-0.5 rounded">原因：{req.reason}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setReviewingRequest(req); setShowReviewModal(true); }} className="px-3 py-1.5 btn-primary text-white rounded text-sm font-bold flex items-center gap-1"><ClipboardCheck size={14} />審核</button>
                  <button onClick={() => handleReview(req.id, 'approve')} className="px-3 py-1.5 btn-success text-white rounded text-sm font-bold">同意</button>
                  <button onClick={() => handleReview(req.id, 'reject')} className="px-3 py-1.5 btn-danger text-white rounded text-sm font-bold">拒絕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 密碼重設申請 */}
      {pwResetRequests.length > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl mb-4 overflow-hidden">
          <div className="px-4 py-2 flex items-center gap-2 bg-yellow-50">
            <span className="text-yellow-600 font-bold text-lg">🔑</span>
            <span className="font-bold text-yellow-700 text-sm">密碼重設申請（{pwResetRequests.length} 筆）</span>
          </div>
          <div className="divide-y divide-yellow-200">
            {pwResetRequests.map(req => (
              <div key={req.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-white">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-[var(--color-text-primary)]">{req.userName}</span>
                    <span className="text-[var(--color-text-muted)]">|</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{formatDT(req.createdAt)}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">申請將密碼重設為帳號預設值</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handlePwReset(req.id, 'approved')} className="px-3 py-1.5 btn-success text-white rounded text-sm font-bold">同意重設</button>
                  <button onClick={() => handlePwReset(req.id, 'rejected')} className="px-3 py-1.5 btn-danger text-white rounded text-sm font-bold">拒絕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] mb-3">簽核報表</h2>

      {/* 期間篩選 */}
      <div className="warm-card p-3 sm:p-4 mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="font-bold text-[var(--color-primary)] text-sm">期間</span>
        {(['week', 'month', 'custom'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 rounded-xl text-sm ${range === r ? 'btn-primary text-white' : 'bg-[var(--color-primary-light)]'}`}
          >
            {r === 'week' ? '近一週' : r === 'month' ? '近一個月' : '自訂'}
          </button>
        ))}
        {range === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm" />
            <span className="text-sm">~</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm" />
            <button onClick={fetchStats} className="px-4 py-1 btn-primary text-white rounded-xl font-bold text-sm flex items-center gap-1">
              <Search size={14} />查詢
            </button>
          </>
        )}
      </div>

      {/* 手機版：卡片 */}
      <div className="sm:hidden space-y-2">
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}
        {!loading && stats.map(s => (
          <div key={s.userId}>
            <div
              onClick={() => toggleDetail(s.userId)}
              className="warm-card p-3 border border-[var(--color-primary-border)] cursor-pointer active:bg-[var(--color-primary-light)]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[var(--color-text-primary)]">{s.userName}</span>
                <span className={`text-sm font-bold ${s.ratio >= 20 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}`}>
                  {s.ratio}%{s.ratio >= 20 ? ' ⚠' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-[var(--color-text-secondary)]">打卡 {s.totalClocks}</span>
                <span className="text-[var(--color-text-secondary)]">申請 {s.totalRequests}</span>
                <span className="text-[var(--color-success)] font-bold">通過 {s.approved}</span>
                <span className="text-[var(--color-danger)] font-bold">拒絕 {s.rejected}</span>
                {s.pending > 0 && <span className="text-yellow-600 font-bold">待審 {s.pending}</span>}
              </div>
            </div>
            {expandedUser === s.userId && (
              <div className="bg-[var(--color-primary-light)] rounded-b-xl p-3 -mt-1 border border-[var(--color-primary-border)] border-t-0 space-y-2">
                <h4 className="font-bold text-sm text-[var(--color-primary)]">{s.userName} — 修改明細</h4>
                {detailLoading ? (
                  <SkeletonCard />
                ) : details.length === 0 ? (
                  <div className="text-[var(--color-text-muted)] text-sm py-2">尚無修改申請</div>
                ) : details.map(d => (
                  <div key={d.id} className="warm-card p-2 border border-[var(--color-primary-border)] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--color-text-primary)]">{d.caseName || '—'}</span>
                      {statusLabel(d.status)}
                    </div>
                    <div className="text-[var(--color-text-secondary)]">
                      上班：<span className="line-through">{formatDT(d.originalClockInTime)}</span> → <span className="font-bold text-[var(--color-primary)]">{formatDT(d.proposedClockInTime)}</span>
                    </div>
                    <div className="text-[var(--color-text-secondary)]">
                      下班：<span className="line-through">{formatDT(d.originalClockOutTime)}</span> → <span className="font-bold text-[var(--color-primary)]">{formatDT(d.proposedClockOutTime)}</span>
                    </div>
                    <div className="text-yellow-700 bg-[var(--color-primary-light)] px-1.5 py-0.5 rounded">原因：{d.reason}</div>
                    <div className="text-[var(--color-text-muted)]">{formatDT(d.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!loading && stats.length === 0 && <EmptyState icon={CheckSquare} title="此期間內無修改申請紀錄" />}
      </div>

      {/* 桌面版：統計表格 */}
      <div className="hidden sm:block">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>特護名稱</th>
              <th>總打卡次數</th>
              <th>申請修改次數</th>
              <th>已通過</th>
              <th>已拒絕</th>
              <th>待審核</th>
              <th>修改比例</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <SkeletonTable rows={5} columns={7} />
            )}
            {!loading && stats.map(s => (
              <React.Fragment key={s.userId}>
                <tr
                  onClick={() => toggleDetail(s.userId)}
                  className="cursor-pointer hover:bg-[var(--color-primary-light)]"
                >
                  <td className="font-medium">{s.userName}</td>
                  <td>{s.totalClocks}</td>
                  <td>{s.totalRequests}</td>
                  <td className="text-[var(--color-success)] font-bold">{s.approved}</td>
                  <td className="text-[var(--color-danger)] font-bold">{s.rejected}</td>
                  <td className="text-yellow-600 font-bold">{s.pending}</td>
                  <td className={`font-bold ${s.ratio >= 20 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-primary)]'}`}>
                    {s.ratio}%
                    {s.ratio >= 20 && <span className="ml-1 text-xs">⚠</span>}
                  </td>
                </tr>
                {expandedUser === s.userId && (
                  <tr key={`${s.userId}-detail`}>
                    <td colSpan={7} className="p-0">
                      <div className="bg-[var(--color-primary-light)] p-3">
                        <h4 className="font-bold text-sm mb-2 text-[var(--color-primary)]">{s.userName} — 修改明細</h4>
                        {detailLoading ? (
                          <div className="text-[var(--color-text-muted)] text-sm py-2">載入中...</div>
                        ) : details.length === 0 ? (
                          <div className="text-[var(--color-text-muted)] text-sm py-2">尚無修改申請</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-[var(--color-primary-light)]">
                                  <th className="px-2 py-1 text-left">個案</th>
                                  <th className="px-2 py-1 text-left">原上班</th>
                                  <th className="px-2 py-1 text-left">原下班</th>
                                  <th className="px-2 py-1 text-left">建議上班</th>
                                  <th className="px-2 py-1 text-left">建議下班</th>
                                  <th className="px-2 py-1 text-left">原因</th>
                                  <th className="px-2 py-1 text-left">狀態</th>
                                  <th className="px-2 py-1 text-left">申請時間</th>
                                </tr>
                              </thead>
                              <tbody>
                                {details.map(d => (
                                  <tr key={d.id} className="border-t border-[var(--color-primary-border)]">
                                    <td className="px-2 py-1">{d.caseName || '—'}</td>
                                    <td className="px-2 py-1 text-[var(--color-text-secondary)]">{formatDT(d.originalClockInTime)}</td>
                                    <td className="px-2 py-1 text-[var(--color-text-secondary)]">{formatDT(d.originalClockOutTime)}</td>
                                    <td className="px-2 py-1 font-bold text-[var(--color-primary)]">{formatDT(d.proposedClockInTime)}</td>
                                    <td className="px-2 py-1 font-bold text-[var(--color-primary)]">{formatDT(d.proposedClockOutTime)}</td>
                                    <td className="px-2 py-1 max-w-[200px] truncate" title={d.reason}>{d.reason}</td>
                                    <td className="px-2 py-1">{statusLabel(d.status)}</td>
                                    <td className="px-2 py-1">{formatDT(d.createdAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!loading && stats.length === 0 && (
              <tr><td colSpan={7}><EmptyState icon={CheckSquare} title="此期間內無修改申請紀錄" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

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
                  <div className="text-sm font-medium">{formatDT(reviewingRequest.originalClockInTime)}</div>
                </div>
                <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] p-3 rounded-xl">
                  <div className="text-xs text-[var(--color-primary)] mb-1">建議上班時間</div>
                  <div className="text-sm font-bold text-[var(--color-primary)]">{formatDT(reviewingRequest.proposedClockInTime)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--color-primary-light)] p-3 rounded-xl">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">原始下班時間</div>
                  <div className="text-sm font-medium">{formatDT(reviewingRequest.originalClockOutTime)}</div>
                </div>
                <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] p-3 rounded-xl">
                  <div className="text-xs text-[var(--color-primary)] mb-1">建議下班時間</div>
                  <div className="text-sm font-bold text-[var(--color-primary)]">{formatDT(reviewingRequest.proposedClockOutTime)}</div>
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
