'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { Search, Check, X, Wallet, Download, Trash2 } from 'lucide-react';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

interface ExpenseItem {
  id: string; userId: string; caseId: string; expenseType: string;
  amount: number; description: string; imageUrl: string | null;
  status: string; expenseDate: string; createdAt: string;
  userName?: string; caseName?: string;
}

const TYPE_LABELS: Record<string, string> = { meal: '餐費', transport: '車資', advance: '代墊費', other: '其它' };

export default function AdminExpensesPage() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [previewImage, setPreviewImage] = useState('');

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);
      const res = await fetch(`/api/admin/expenses?${params}`);
      const d = await res.json();
      setExpenses(d.data || []);
    } catch { toast.error('載入失敗'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? '通過' : '拒絕';
    if (!confirm(`確定要${label}此代墊費用申請？`)) return;
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) { toast.error('操作失敗'); return; }
      fetchExpenses();
    } catch { toast.error('系統錯誤'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此代墊費用紀錄？此操作無法復原。')) return;
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { toast.error('刪除失敗'); return; }
      toast.success('已刪除');
      fetchExpenses();
    } catch { toast.error('系統錯誤'); }
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterStartDate) params.set('startDate', filterStartDate);
    if (filterEndDate) params.set('endDate', filterEndDate);
    try {
      const res = await fetch(`/api/admin/expenses/export?${params}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || '匯出失敗');
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fileName = match ? decodeURIComponent(match[1]) : `代墊費用_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  const pendingCount = expenses.filter(e => e.status === 'pending').length;
  const approvedList = expenses.filter(e => e.status === 'approved');
  const approvedTotal = approvedList.reduce((s, e) => s + e.amount, 0);
  const rejectedCount = expenses.filter(e => e.status === 'rejected').length;

  return (
    <div className="p-3 sm:p-6">
      <h2 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)] mb-4">代墊費用審核</h2>

      {/* 統計卡片 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="warm-card p-3 border-l-4 border-yellow-500">
          <div className="text-xs text-[var(--color-text-secondary)]">待審核</div>
          <div className="text-lg font-bold text-yellow-700">{pendingCount} 筆</div>
        </div>
        <div className="warm-card p-3 border-l-4 border-green-500">
          <div className="text-xs text-[var(--color-text-secondary)]">已通過</div>
          <div className="text-lg font-bold text-[var(--color-success)]">{approvedList.length} 筆</div>
          <div className="text-xs text-[var(--color-text-muted)]">NT$ {approvedTotal.toLocaleString()}</div>
        </div>
        <div className="warm-card p-3 border-l-4 border-red-400">
          <div className="text-xs text-[var(--color-text-secondary)]">已拒絕</div>
          <div className="text-lg font-bold text-[var(--color-danger)]">{rejectedCount} 筆</div>
        </div>
      </div>

      {/* 篩選 */}
      <div className="warm-card p-3 mb-4 flex flex-wrap items-center gap-2">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm">
          <option value="">全部狀態</option>
          <option value="pending">待審核</option>
          <option value="approved">已通過</option>
          <option value="rejected">已拒絕</option>
        </select>
        <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)}
          className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm flex-1 min-w-[120px]" />
        <span className="text-sm">~</span>
        <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)}
          className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm flex-1 min-w-[120px]" />
        <button onClick={fetchExpenses} disabled={loading}
          className="px-4 py-2 btn-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
          <Search size={16} />{loading ? '查詢中...' : '查詢'}
        </button>
        <button onClick={handleExport}
          className="px-4 py-2 btn-success text-white rounded-xl font-bold text-sm flex items-center gap-1">
          <Download size={16} />匯出
        </button>
      </div>

      {/* 費用列表 — 手機卡片 / 桌面表格 */}
      {loading && expenses.length === 0 ? (
        <div className="space-y-2 sm:hidden">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState icon={Wallet} title="尚無代墊費用紀錄" />
      ) : (
        <>
          {/* 手機版：卡片 */}
          <div className="sm:hidden space-y-2">
            {expenses.map(exp => (
              <div key={exp.id} className="warm-card p-3 border border-[var(--color-primary-border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-[var(--color-primary-light)] rounded text-xs">{TYPE_LABELS[exp.expenseType] || exp.expenseType}</span>
                    <span className="font-bold text-[var(--color-primary)]">NT$ {exp.amount.toLocaleString()}</span>
                  </div>
                  {exp.status === 'pending' && <span className="badge-pending text-xs font-bold px-1.5 py-0.5 rounded">待審核</span>}
                  {exp.status === 'approved' && <span className="badge-approved text-xs font-bold px-1.5 py-0.5 rounded">已通過</span>}
                  {exp.status === 'rejected' && <span className="badge-rejected text-xs font-bold px-1.5 py-0.5 rounded">已拒絕</span>}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-secondary)] mb-2">
                  <span>{exp.expenseDate}</span>
                  <span>{exp.userName || '—'}</span>
                  <span>{exp.caseName || '—'}</span>
                </div>
                {exp.description && <div className="text-xs text-[var(--color-text-muted)] mb-2">{exp.description}</div>}
                <div className="flex items-center gap-2">
                  {exp.imageUrl && (
                    <button onClick={() => setPreviewImage(exp.imageUrl!)}
                      className="px-2 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded text-xs hover:opacity-80">查看圖片</button>
                  )}
                  {exp.status === 'pending' && (
                    <>
                      <button onClick={() => handleAction(exp.id, 'approve')}
                        className="px-3 py-1 btn-success text-white rounded-xl text-xs flex items-center gap-1"><Check size={14} />通過</button>
                      <button onClick={() => handleAction(exp.id, 'reject')}
                        className="px-3 py-1 btn-danger text-white rounded-xl text-xs flex items-center gap-1"><X size={14} />拒絕</button>
                    </>
                  )}
                  <button onClick={() => handleDelete(exp.id)}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-xl text-xs flex items-center gap-1 hover:bg-gray-300 ml-auto"><Trash2 size={14} />刪除</button>
                </div>
              </div>
            ))}
          </div>
          {/* 桌面版：表格 */}
          <div className="hidden sm:block warm-card overflow-hidden">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th><th>特護</th><th>個案</th><th>類型</th>
                    <th>金額</th><th>說明</th><th>圖片</th><th>狀態</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && expenses.length === 0 && (
                    <SkeletonTable rows={5} columns={9} />
                  )}
                  {expenses.map(exp => (
                    <tr key={exp.id}>
                      <td className="text-xs">{exp.expenseDate}</td>
                      <td>{exp.userName || '—'}</td>
                      <td>{exp.caseName || '—'}</td>
                      <td><span className="px-1.5 py-0.5 bg-[var(--color-primary-light)] rounded text-xs">{TYPE_LABELS[exp.expenseType] || exp.expenseType}</span></td>
                      <td className="text-right font-bold">NT$ {exp.amount.toLocaleString()}</td>
                      <td className="text-xs text-[var(--color-text-secondary)] max-w-[120px] truncate">{exp.description || '—'}</td>
                      <td>
                        {exp.imageUrl ? (
                          <button onClick={() => setPreviewImage(exp.imageUrl!)}
                            className="px-2 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded text-xs hover:opacity-80">查看</button>
                        ) : <span className="text-xs text-[var(--color-text-muted)]">無</span>}
                      </td>
                      <td>
                        {exp.status === 'pending' && <span className="badge-pending text-xs font-bold px-1.5 py-0.5 rounded">待審核</span>}
                        {exp.status === 'approved' && <span className="badge-approved text-xs font-bold px-1.5 py-0.5 rounded">已通過</span>}
                        {exp.status === 'rejected' && <span className="badge-rejected text-xs font-bold px-1.5 py-0.5 rounded">已拒絕</span>}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {exp.status === 'pending' && (
                            <>
                              <button onClick={() => handleAction(exp.id, 'approve')}
                                className="px-2 py-1 btn-success text-white rounded-xl text-xs flex items-center gap-1"><Check size={14} />通過</button>
                              <button onClick={() => handleAction(exp.id, 'reject')}
                                className="px-2 py-1 btn-danger text-white rounded-xl text-xs flex items-center gap-1"><X size={14} />拒絕</button>
                            </>
                          )}
                          <button onClick={() => handleDelete(exp.id)}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded-xl text-xs flex items-center gap-1 hover:bg-gray-300"><Trash2 size={14} />刪除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 圖片預覽 Modal */}
      {previewImage && (
        <div className="modal-overlay p-4"
          onClick={() => setPreviewImage('')}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="收據" className="w-full rounded-xl shadow-2xl" />
            <button onClick={() => setPreviewImage('')}
              className="absolute -top-3 -right-3 w-8 h-8 warm-card rounded-full shadow-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold">
              X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
