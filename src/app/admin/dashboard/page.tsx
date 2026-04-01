'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useToast } from '@/components/Toast';
import { Search, BarChart3 } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

const COLORS = {
  billing: '#e8776f',
  nurseSalary: '#5dab68',
  profit: '#e8a54b',
  dayShift: '#e8a54b',
  nightShift: '#c96b63',
  activeNurses: '#e8776f',
};

interface AlertData {
  unpaidSalary: { count: number; totalAmount: number };
  abnormalShifts: { count: number };
  pendingModifications: { count: number };
  pendingExpenses: { count: number; totalAmount: number };
}

interface Summary {
  totalBilling: number; totalNurseSalary: number; totalProfit: number;
  totalDayHours: number; totalNightHours: number; totalShifts: number;
  prevBilling: number; prevNurseSalary: number; prevProfit: number; prevShifts: number;
}

interface TrendItem { label: string; billing: number; nurseSalary: number; profit: number; shifts: number; activeNurses: number; }
interface CaseItem { name: string; billing: number; nurseSalary: number; profit: number; margin: number; shifts: number; }
interface NurseItem { name: string; totalHours: number; dayHours: number; nightHours: number; billing: number; nurseSalary: number; shifts: number; }
interface CaseServiceDays { caseName: string; months: Record<string, number>; }
interface UnpaidShift { nurseName: string; count: number; totalAmount: number; oldestDate: string; }
interface NurseUtil { nurseName: string; totalShifts: number; avgPerMonth: number; dayHours: number; nightHours: number; }

interface DashboardData {
  alerts: AlertData;
  summary: Summary;
  trend: TrendItem[];
  problems: { caseServiceDays: CaseServiceDays[]; unpaidShifts: UnpaidShift[]; nurseUtilization: NurseUtil[] };
  caseBreakdown: CaseItem[];
  nurseBreakdown: NurseItem[];
  shiftDistribution: { dayHours: number; nightHours: number };
}

function getPresetRange(preset: string): { start: string; end: string } {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  switch (preset) {
    case 'thisMonth': return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) };
    case 'lastMonth': return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
    case 'thisQuarter': { const q = Math.floor(m / 3) * 3; return { start: fmt(new Date(y, q, 1)), end: fmt(new Date(y, q + 3, 0)) }; }
    case 'lastQuarter': { const q = Math.floor(m / 3) * 3 - 3; const qy = q < 0 ? y - 1 : y; const qs = q < 0 ? q + 12 : q; return { start: fmt(new Date(qy, qs, 1)), end: fmt(new Date(qy, qs + 3, 0)) }; }
    case 'thisYear': return { start: fmt(new Date(y, 0, 1)), end: fmt(new Date(y, 11, 31)) };
    case 'lastYear': return { start: fmt(new Date(y - 1, 0, 1)), end: fmt(new Date(y - 1, 11, 31)) };
    case 'yearBeforeLast': return { start: fmt(new Date(y - 2, 0, 1)), end: fmt(new Date(y - 2, 11, 31)) };
    default: return { start: '', end: '' };
  }
}

function fmtAmount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString();
}

function pctChange(current: number, prev: number): { text: string; color: string } {
  if (!prev) return { text: '', color: '' };
  const pct = ((current - prev) / prev * 100).toFixed(1);
  const isUp = current >= prev;
  return { text: `${isUp ? '▲' : '▼'} ${Math.abs(Number(pct))}%`, color: isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' };
}

const PIE_COLORS = [COLORS.dayShift, COLORS.nightShift];

export default function DashboardPage() {
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [activePreset, setActivePreset] = useState('lastMonth');

  const fetchData = useCallback(async (s: string, e: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('startTime', s);
      if (e) params.set('endTime', e);
      const res = await fetch(`/api/admin/dashboard?${params}`);
      const d = await res.json();
      if (d.summary) setData(d);
    } catch { toast.error('載入失敗'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const { start, end } = getPresetRange('lastMonth');
    setStartTime(start); setEndTime(end);
    fetchData(start, end);
  }, [fetchData]);

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    const { start, end } = getPresetRange(preset);
    setStartTime(start); setEndTime(end);
    fetchData(start, end);
  };

  const handleQuery = () => { setActivePreset(''); fetchData(startTime, endTime); };

  const presets = [
    { key: 'thisMonth', label: '本月' }, { key: 'lastMonth', label: '上月' },
    { key: 'thisQuarter', label: '本季' }, { key: 'lastQuarter', label: '上季' },
    { key: 'thisYear', label: '今年' }, { key: 'lastYear', label: '去年' }, { key: 'yearBeforeLast', label: '前年' },
  ];

  const pieData = data ? [
    { name: '日班', value: Math.round(data.shiftDistribution.dayHours) },
    { name: '夜班', value: Math.round(data.shiftDistribution.nightHours) },
  ] : [];

  // All months across all cases for heatmap
  const allMonths = data ? [...new Set(data.problems.caseServiceDays.flatMap(c => Object.keys(c.months)))].sort() : [];

  return (
    <div className="p-3 sm:p-6">
      <h2 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)] mb-4">業績報表</h2>

      {/* Time range controls */}
      <div className="warm-card p-3 sm:p-4 mb-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          {presets.map(p => (
            <button key={p.key} onClick={() => handlePreset(p.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activePreset === p.key ? 'btn-primary' : 'bg-[var(--color-primary-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-nav-hover-bg)]'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startTime} onChange={e => setStartTime(e.target.value)} className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm flex-1 min-w-[120px]" />
          <span className="text-sm text-[var(--color-text-secondary)]">~</span>
          <input type="date" value={endTime} onChange={e => setEndTime(e.target.value)} className="px-2 py-1 border border-[var(--color-primary-border)] rounded text-sm flex-1 min-w-[120px]" />
          <button onClick={handleQuery} disabled={loading}
            className="px-4 py-1.5 btn-primary rounded text-sm font-bold disabled:opacity-50">
            <Search size={14} className="inline mr-1" />{loading ? <><Spinner size="sm" className="mr-1" />載入中...</> : '查詢'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* ========== Section 1: ALERTS ========== */}
          {(data.alerts.unpaidSalary.count > 0 || data.alerts.abnormalShifts.count > 0 || data.alerts.pendingModifications.count > 0 || data.alerts.pendingExpenses.count > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {data.alerts.unpaidSalary.count > 0 && (
                <div onClick={() => router.push('/admin/payroll')} className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] rounded-xl p-3 cursor-pointer hover:bg-[var(--color-nav-hover-bg)] transition-colors">
                  <div className="text-xs text-[var(--color-primary)] font-bold">未發放薪資</div>
                  <div className="text-lg font-bold" style={{ color: '#e8a54b' }}>{data.alerts.unpaidSalary.count} 筆</div>
                  <div className="text-xs" style={{ color: '#e8a54b' }}>NT$ {fmtAmount(data.alerts.unpaidSalary.totalAmount)}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">→ 前往發放</div>
                </div>
              )}
              {data.alerts.abnormalShifts.count > 0 && (
                <div onClick={() => router.push('/admin/records')} className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] rounded-xl p-3 cursor-pointer hover:bg-[var(--color-nav-hover-bg)] transition-colors">
                  <div className="text-xs text-[var(--color-danger)] font-bold">異常班次</div>
                  <div className="text-lg font-bold" style={{ color: '#d9534f' }}>{data.alerts.abnormalShifts.count} 筆</div>
                  <div className="text-xs text-[var(--color-text-muted)]">未打下班卡 &gt; 48h</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">→ 前往紀錄</div>
                </div>
              )}
              {data.alerts.pendingModifications.count > 0 && (
                <div onClick={() => router.push('/admin/review')} className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] rounded-xl p-3 cursor-pointer hover:bg-[var(--color-nav-hover-bg)] transition-colors">
                  <div className="text-xs text-[var(--color-primary)] font-bold">待簽核</div>
                  <div className="text-lg font-bold" style={{ color: '#e8a54b' }}>{data.alerts.pendingModifications.count} 件</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">→ 前往簽核</div>
                </div>
              )}
              {data.alerts.pendingExpenses.count > 0 && (
                <div onClick={() => router.push('/admin/expenses')} className="bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] rounded-xl p-3 cursor-pointer hover:bg-[var(--color-nav-hover-bg)] transition-colors">
                  <div className="text-xs text-[var(--color-primary)] font-bold">待審代墊</div>
                  <div className="text-lg font-bold" style={{ color: '#e8a54b' }}>{data.alerts.pendingExpenses.count} 件</div>
                  <div className="text-xs" style={{ color: '#e8a54b' }}>NT$ {fmtAmount(data.alerts.pendingExpenses.totalAmount)}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">→ 前往代墊</div>
                </div>
              )}
            </div>
          )}

          {/* ========== Section 2: KPIs ========== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: '請款總額', value: data.summary.totalBilling, prev: data.summary.prevBilling, accent: '#e8776f', borderColor: '#e8776f' },
              { label: '特護薪資', value: data.summary.totalNurseSalary, prev: data.summary.prevNurseSalary, accent: '#5dab68', borderColor: '#5dab68' },
              { label: '公司利潤', value: data.summary.totalProfit, prev: data.summary.prevProfit, accent: '#e8a54b', borderColor: '#e8a54b' },
            ].map(item => {
              const change = pctChange(item.value, item.prev);
              return (
                <div key={item.label} className="warm-card p-4 border-l-4" style={{ borderLeftColor: item.borderColor }}>
                  <div className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{item.label}</div>
                  <div className="text-lg sm:text-2xl font-bold" style={{ color: item.accent }}>NT$ {fmtAmount(item.value)}</div>
                  {change.text && <div className={`text-xs ${change.color}`}>{change.text} vs 上期</div>}
                </div>
              );
            })}
            <div className="warm-card p-4 border-l-4" style={{ borderLeftColor: '#c96b63' }}>
              <div className="text-xs sm:text-sm text-[var(--color-text-secondary)]">總班數</div>
              <div className="text-lg sm:text-2xl font-bold" style={{ color: '#c96b63' }}>{data.summary.totalShifts.toLocaleString()} 班</div>
              {data.summary.prevShifts > 0 && (
                <div className={`text-xs ${pctChange(data.summary.totalShifts, data.summary.prevShifts).color}`}>
                  {pctChange(data.summary.totalShifts, data.summary.prevShifts).text} vs 上期
                </div>
              )}
              <div className="text-xs text-[var(--color-text-muted)]">日 {Math.round(data.summary.totalDayHours)}h / 夜 {Math.round(data.summary.totalNightHours)}h</div>
            </div>
          </div>

          {/* ========== Section 3: TRENDS (2x2) ========== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* 營業額趨勢 */}
            <div className="warm-card p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">營業額趨勢</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={data.trend.length > 15 ? -45 : 0} textAnchor={data.trend.length > 15 ? 'end' : 'middle'} height={data.trend.length > 15 ? 60 : 30} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v/10000).toFixed(0)}萬`} />
                  <Tooltip formatter={(v) => [`NT$ ${Number(v).toLocaleString()}`, '']} />
                  <Bar dataKey="billing" name="請款金額" fill={COLORS.billing} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 利潤趨勢 */}
            <div className="warm-card p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">利潤趨勢</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={data.trend.length > 15 ? -45 : 0} textAnchor={data.trend.length > 15 ? 'end' : 'middle'} height={data.trend.length > 15 ? 60 : 30} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v/10000).toFixed(0)}萬`} />
                  <Tooltip formatter={(v) => [`NT$ ${Number(v).toLocaleString()}`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="billing" name="請款" stroke={COLORS.billing} strokeWidth={2} />
                  <Line type="monotone" dataKey="nurseSalary" name="薪資" stroke={COLORS.nurseSalary} strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" name="利潤" stroke={COLORS.profit} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 班次數趨勢 */}
            <div className="warm-card p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">班次數趨勢</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={data.trend.length > 15 ? -45 : 0} textAnchor={data.trend.length > 15 ? 'end' : 'middle'} height={data.trend.length > 15 ? 60 : 30} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v} 班`, '']} />
                  <Bar dataKey="shifts" name="班次" fill="#c96b63" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 活躍特護 */}
            <div className="warm-card p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">活躍特護人數</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={data.trend.length > 15 ? -45 : 0} textAnchor={data.trend.length > 15 ? 'end' : 'middle'} height={data.trend.length > 15 ? 60 : 30} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v} 人`, '']} />
                  <Area type="monotone" dataKey="activeNurses" name="活躍人數" fill={COLORS.activeNurses} fillOpacity={0.3} stroke={COLORS.activeNurses} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ========== Section 4: PROBLEM ANALYSIS ========== */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">問題分析</h3>

            {/* Case service days heatmap */}
            {data.problems.caseServiceDays.length > 0 && allMonths.length > 0 && (
              <div className="warm-card p-4 mb-4 overflow-x-auto">
                <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">個案服務天數表</h4>
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="text-left py-1 px-2 font-bold text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-card-bg)]">個案</th>
                      {allMonths.map(m => <th key={m} className="py-1 px-2 text-center text-[var(--color-text-secondary)]">{m.slice(2)}</th>)}
                      <th className="py-1 px-2 text-center font-bold text-[var(--color-text-secondary)]">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.problems.caseServiceDays.slice(0, 20).map(c => {
                      const total = Object.values(c.months).reduce((s, n) => s + n, 0);
                      return (
                        <tr key={c.caseName} className="border-t border-[var(--color-primary-border)]">
                          <td className="py-1 px-2 font-medium text-[var(--color-text-secondary)] sticky left-0 bg-[var(--color-card-bg)] whitespace-nowrap">{c.caseName}</td>
                          {allMonths.map(m => {
                            const days = c.months[m] || 0;
                            const bg = days === 0 ? 'text-[var(--color-danger)] font-bold' : days < 10 ? 'text-[var(--color-primary)]' : '';
                            return <td key={m} className={`py-1 px-2 text-center ${bg}`}>{days || '-'}</td>;
                          })}
                          <td className="py-1 px-2 text-center font-bold">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Unpaid shifts */}
              {data.problems.unpaidShifts.length > 0 && (
                <div className="warm-card p-4">
                  <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">未發放薪資明細</h4>
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-[var(--color-text-secondary)]">
                        <th className="text-left py-1">特護</th>
                        <th className="text-right py-1">班數</th>
                        <th className="text-right py-1">金額</th>
                        <th className="text-right py-1">最早日期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.problems.unpaidShifts.slice(0, 15).map(s => (
                        <tr key={s.nurseName} className="border-t border-[var(--color-primary-border)]">
                          <td className="py-1 font-medium">{s.nurseName}</td>
                          <td className="py-1 text-right">{s.count}</td>
                          <td className="py-1 text-right text-[var(--color-primary)] font-bold">NT$ {fmtAmount(s.totalAmount)}</td>
                          <td className="py-1 text-right text-[var(--color-text-muted)]">{s.oldestDate?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Nurse utilization */}
              {data.problems.nurseUtilization.length > 0 && (
                <div className="warm-card p-4">
                  <h4 className="text-xs font-bold text-[var(--color-text-secondary)] mb-2">護理師出勤統計</h4>
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-[var(--color-text-secondary)]">
                        <th className="text-left py-1">特護</th>
                        <th className="text-right py-1">總班數</th>
                        <th className="text-right py-1">月均</th>
                        <th className="text-right py-1">日班h</th>
                        <th className="text-right py-1">夜班h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.problems.nurseUtilization.slice(0, 15).map(n => (
                        <tr key={n.nurseName} className="border-t border-[var(--color-primary-border)]">
                          <td className="py-1 font-medium">{n.nurseName}</td>
                          <td className="py-1 text-right">{n.totalShifts}</td>
                          <td className={`py-1 text-right font-bold ${n.avgPerMonth < 5 ? 'text-[var(--color-danger)]' : n.avgPerMonth > 25 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                            {n.avgPerMonth}
                          </td>
                          <td className="py-1 text-right">{Math.round(n.dayHours)}</td>
                          <td className="py-1 text-right">{Math.round(n.nightHours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ========== Section 5: RANKINGS ========== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 個案營收 Top 10 */}
            <div className="warm-card p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">個案營收排名 Top 10</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.caseBreakdown.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}萬`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v) => [`NT$ ${Number(v).toLocaleString()}`, '']} />
                  <Bar dataKey="billing" name="請款金額" fill={COLORS.billing} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 特護工時排名 */}
            <div className="warm-card p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">特護工時排名 Top 15</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.nurseBreakdown.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v} 小時`, '']} />
                  <Legend />
                  <Bar dataKey="dayHours" name="日班" stackId="a" fill={COLORS.dayShift} />
                  <Bar dataKey="nightHours" name="夜班" stackId="a" fill={COLORS.nightShift} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 日夜班比例 */}
            <div className="warm-card p-4">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">日班 / 夜班時數分佈</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                    label={({ name, value, percent }) => `${name} ${value}h (${((percent ?? 0) * 100).toFixed(0)}%)`}>
                    {pieData.map((_, i) => <Cell key={`cell-${i}`} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} 小時`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 個案獲利表 */}
            <div className="warm-card p-4 overflow-x-auto">
              <h3 className="text-sm font-bold text-[var(--color-text-secondary)] mb-3">個案獲利分析</h3>
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-primary-border)]">
                    <th className="text-left py-1.5 px-1">個案</th>
                    <th className="text-right py-1.5 px-1">營收</th>
                    <th className="text-right py-1.5 px-1">薪資</th>
                    <th className="text-right py-1.5 px-1">利潤</th>
                    <th className="text-right py-1.5 px-1">利潤率</th>
                    <th className="text-right py-1.5 px-1">班數</th>
                  </tr>
                </thead>
                <tbody>
                  {data.caseBreakdown.slice(0, 15).map(c => (
                    <tr key={c.name} className="border-t border-[var(--color-primary-border)] hover:bg-[var(--color-nav-hover-bg)]">
                      <td className="py-1.5 px-1 font-medium whitespace-nowrap">{c.name}</td>
                      <td className="py-1.5 px-1 text-right">{fmtAmount(c.billing)}</td>
                      <td className="py-1.5 px-1 text-right">{fmtAmount(c.nurseSalary)}</td>
                      <td className="py-1.5 px-1 text-right text-[var(--color-primary)] font-bold">{fmtAmount(c.profit)}</td>
                      <td className="py-1.5 px-1 text-right">{c.margin}%</td>
                      <td className="py-1.5 px-1 text-right text-[var(--color-text-secondary)]">{c.shifts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!data && !loading && <EmptyState icon={BarChart3} title="請選擇時間範圍後點擊「查詢」" />}
    </div>
  );
}
