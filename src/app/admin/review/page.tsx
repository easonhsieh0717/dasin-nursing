'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { Search, CheckSquare } from 'lucide-react';
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

export default function ReviewPage() {
  const toast = useToast();
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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

  useEffect(() => { fetchStats(); }, [fetchStats]);

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
    </div>
  );
}
