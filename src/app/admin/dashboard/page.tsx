'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = {
  billing: '#2563eb',
  nurseSalary: '#16a34a',
  profit: '#ea580c',
  dayShift: '#f59e0b',
  nightShift: '#6366f1',
};

interface Summary {
  totalBilling: number;
  totalNurseSalary: number;
  totalProfit: number;
  totalDayHours: number;
  totalNightHours: number;
  totalShifts: number;
}

interface MonthlyItem {
  month: string;
  billing: number;
  nurseSalary: number;
  profit: number;
  shifts: number;
}

interface CaseItem {
  name: string;
  billing: number;
  nurseSalary: number;
  shifts: number;
}

interface NurseItem {
  name: string;
  totalHours: number;
  dayHours: number;
  nightHours: number;
  billing: number;
  nurseSalary: number;
  shifts: number;
}

interface DashboardData {
  summary: Summary;
  monthlyTrend: MonthlyItem[];
  caseBreakdown: CaseItem[];
  nurseBreakdown: NurseItem[];
  shiftDistribution: { dayHours: number; nightHours: number };
}

function getPresetRange(preset: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const fmt = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  switch (preset) {
    case 'thisMonth':
      return { start: fmt(new Date(y, m, 1)), end: fmt(new Date(y, m + 1, 0)) };
    case 'lastMonth':
      return { start: fmt(new Date(y, m - 1, 1)), end: fmt(new Date(y, m, 0)) };
    case 'thisQuarter': {
      const qStart = Math.floor(m / 3) * 3;
      return { start: fmt(new Date(y, qStart, 1)), end: fmt(new Date(y, qStart + 3, 0)) };
    }
    case 'lastQuarter': {
      const qStart = Math.floor(m / 3) * 3 - 3;
      const qy = qStart < 0 ? y - 1 : y;
      const qs = qStart < 0 ? qStart + 12 : qStart;
      return { start: fmt(new Date(qy, qs, 1)), end: fmt(new Date(qy, qs + 3, 0)) };
    }
    case 'thisYear':
      return { start: fmt(new Date(y, 0, 1)), end: fmt(new Date(y, 11, 31)) };
    default:
      return { start: '', end: '' };
  }
}

function fmtAmount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}萬`;
  return n.toLocaleString();
}

const PIE_COLORS = [COLORS.dayShift, COLORS.nightShift];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [activePreset, setActivePreset] = useState('thisYear');

  const fetchData = useCallback(async (s: string, e: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (s) params.set('startTime', s);
      if (e) params.set('endTime', e);
      const res = await fetch(`/api/admin/dashboard?${params}`);
      const d = await res.json();
      if (d.summary) setData(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { start, end } = getPresetRange('thisYear');
    setStartTime(start);
    setEndTime(end);
    fetchData(start, end);
  }, [fetchData]);

  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    const { start, end } = getPresetRange(preset);
    setStartTime(start);
    setEndTime(end);
    fetchData(start, end);
  };

  const handleQuery = () => {
    setActivePreset('');
    fetchData(startTime, endTime);
  };

  const presets = [
    { key: 'thisMonth', label: '本月' },
    { key: 'lastMonth', label: '上月' },
    { key: 'thisQuarter', label: '本季' },
    { key: 'lastQuarter', label: '上季' },
    { key: 'thisYear', label: '今年' },
  ];

  const pieData = data ? [
    { name: '日班', value: data.shiftDistribution.dayHours },
    { name: '夜班', value: data.shiftDistribution.nightHours },
  ] : [];

  const nurseSalaryRanking = data
    ? [...data.nurseBreakdown].sort((a, b) => b.nurseSalary - a.nurseSalary).slice(0, 15)
    : [];

  return (
    <div className="p-3 sm:p-6">
      <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4">業績報表</h2>

      {/* Time range controls */}
      <div className="bg-white p-3 sm:p-4 rounded-lg mb-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          {presets.map(p => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activePreset === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
          <span className="text-sm text-gray-500">~</span>
          <input type="date" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
          <button onClick={handleQuery} disabled={loading}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {loading ? '載入中...' : '查詢'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
              <div className="text-xs sm:text-sm text-gray-500">請款總額</div>
              <div className="text-lg sm:text-2xl font-bold text-blue-700">NT$ {fmtAmount(data.summary.totalBilling)}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
              <div className="text-xs sm:text-sm text-gray-500">特護薪資</div>
              <div className="text-lg sm:text-2xl font-bold text-green-700">NT$ {fmtAmount(data.summary.totalNurseSalary)}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-orange-500">
              <div className="text-xs sm:text-sm text-gray-500">公司利潤</div>
              <div className="text-lg sm:text-2xl font-bold text-orange-700">NT$ {fmtAmount(data.summary.totalProfit)}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-purple-500">
              <div className="text-xs sm:text-sm text-gray-500">總班數</div>
              <div className="text-lg sm:text-2xl font-bold text-purple-700">{data.summary.totalShifts} 班</div>
              <div className="text-xs text-gray-400">日 {data.summary.totalDayHours}h / 夜 {data.summary.totalNightHours}h</div>
            </div>
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Chart 1: 月營業額趨勢 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">月營業額趨勢</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v/10000).toFixed(0)}萬`} />
                  <Tooltip formatter={(v) => [`NT$ ${Number(v).toLocaleString()}`, '']} />
                  <Legend />
                  <Bar dataKey="billing" name="請款金額" fill={COLORS.billing} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: 月利潤趨勢 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">月利潤趨勢</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v/10000).toFixed(0)}萬`} />
                  <Tooltip formatter={(v) => [`NT$ ${Number(v).toLocaleString()}`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="billing" name="請款" stroke={COLORS.billing} strokeWidth={2} />
                  <Line type="monotone" dataKey="nurseSalary" name="薪資" stroke={COLORS.nurseSalary} strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" name="利潤" stroke={COLORS.profit} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: 個案營收 Top 10 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">個案營收排名 Top 10</h3>
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

            {/* Chart 4: 特護工時排名 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">特護工時排名 Top 15</h3>
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

            {/* Chart 5: 日夜班比例 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">日班 / 夜班時數分佈</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value, percent }) => `${name} ${value}h (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} 小時`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 6: 特護薪資排名 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">特護薪資排名 Top 15</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={nurseSalaryRanking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}萬`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => [`NT$ ${Number(v).toLocaleString()}`, '']} />
                  <Bar dataKey="nurseSalary" name="特護薪資" fill={COLORS.nurseSalary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-12 text-gray-400">載入中...</div>
      )}
    </div>
  );
}
