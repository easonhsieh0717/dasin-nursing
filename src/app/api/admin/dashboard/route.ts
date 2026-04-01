import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getModificationRequests, getAdvanceExpenses, getCases, getUsers } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';

interface RecordRow {
  billing: number;
  nurse_salary: number;
  day_hours: number;
  night_hours: number;
  user_id: string;
  case_id: string;
  clock_in_time: string;
  paid_at: string | null;
}

/** 分頁取得指定欄位的打卡紀錄（僅已打下班） */
async function fetchRecordColumns(
  orgId: string,
  startTime: string | null,
  endTime: string | null,
): Promise<RecordRow[]> {
  const PAGE = 1000;
  const all: RecordRow[] = [];
  let from = 0;

  while (true) {
    let q = supabase
      .from('clock_records')
      .select('billing, nurse_salary, day_hours, night_hours, user_id, case_id, clock_in_time, paid_at')
      .eq('org_id', orgId)
      .not('clock_out_time', 'is', null);
    if (startTime) q = q.gte('clock_in_time', startTime);
    if (endTime) q = q.lte('clock_in_time', endTime + 'T23:59:59');
    q = q.order('clock_in_time', { ascending: true }).range(from, from + PAGE - 1);

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as RecordRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime') || null;
    const endTime = searchParams.get('endTime') || null;

    // 趨勢粒度
    let granularity = 'month';
    if (startTime && endTime) {
      const durationDays = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 86400000;
      if (durationDays <= 14) granularity = 'day';
      else if (durationDays <= 180) granularity = 'week';
    }

    // 上期日期
    let prevStart: string | null = null, prevEnd: string | null = null;
    if (startTime && endTime) {
      const s = new Date(startTime).getTime();
      const e = new Date(endTime).getTime();
      const duration = e - s;
      prevStart = new Date(s - duration - 86400000).toISOString().slice(0, 10);
      prevEnd = new Date(s - 86400000).toISOString().slice(0, 10);
    }

    // === 並行查詢 ===
    const [alerts, records, prevRecords, allCases, usersResult] = await Promise.all([
      fetchAlerts(session.orgId),
      fetchRecordColumns(session.orgId, startTime, endTime),
      prevStart ? fetchRecordColumns(session.orgId, prevStart, prevEnd) : Promise.resolve([]),
      getCases(session.orgId),
      getUsers(session.orgId),
    ]);

    const caseMap = new Map(allCases.map(c => [c.id, c.name]));
    const userMap = new Map(usersResult.users.map(u => [u.id, u.name]));

    // === Summary ===
    const summary = aggregateSummary(records);
    const prev = aggregateSummary(prevRecords);

    // === Trend ===
    const trend = aggregateTrend(records, granularity);

    // === Case Breakdown ===
    const caseBreakdown = aggregateByCaseId(records, caseMap);

    // === Nurse Breakdown ===
    const nurseBreakdown = aggregateByUserId(records, userMap);

    // === Unpaid Shifts ===
    const unpaidShifts = aggregateUnpaid(records, userMap);

    // === Nurse Utilization ===
    const nurseUtilization = aggregateNurseUtil(records, userMap);

    // === Case Service Days ===
    const caseServiceDays = aggregateCaseServiceDays(records, caseMap);

    return NextResponse.json({
      alerts,
      summary: {
        totalBilling: summary.totalBilling,
        totalNurseSalary: summary.totalNurseSalary,
        totalProfit: summary.totalProfit,
        totalShifts: summary.totalShifts,
        totalDayHours: summary.totalDayHours,
        totalNightHours: summary.totalNightHours,
        prevBilling: prev.totalBilling,
        prevNurseSalary: prev.totalNurseSalary,
        prevProfit: prev.totalProfit,
        prevShifts: prev.totalShifts,
      },
      trend,
      problems: { caseServiceDays, unpaidShifts, nurseUtilization },
      caseBreakdown,
      nurseBreakdown,
      shiftDistribution: {
        dayHours: summary.totalDayHours,
        nightHours: summary.totalNightHours,
      },
    });
  } catch (err) {
    console.error('Dashboard GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

// === Aggregation helpers ===

function aggregateSummary(rows: RecordRow[]) {
  let totalBilling = 0, totalNurseSalary = 0, totalDayHours = 0, totalNightHours = 0;
  for (const r of rows) {
    totalBilling += Number(r.billing) || 0;
    totalNurseSalary += Number(r.nurse_salary) || 0;
    totalDayHours += Number(r.day_hours) || 0;
    totalNightHours += Number(r.night_hours) || 0;
  }
  return {
    totalBilling, totalNurseSalary,
    totalProfit: totalBilling - totalNurseSalary,
    totalShifts: rows.length,
    totalDayHours, totalNightHours,
  };
}

function toTaipeiDate(isoStr: string): Date {
  return new Date(new Date(isoStr).getTime() + 8 * 3600000);
}

function aggregateTrend(rows: RecordRow[], granularity: string) {
  const groups = new Map<string, { billing: number; nurseSalary: number; shifts: number; nurses: Set<string> }>();

  for (const r of rows) {
    const d = toTaipeiDate(r.clock_in_time);
    let key: string;
    if (granularity === 'day') {
      key = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    } else if (granularity === 'week') {
      // 取當週一
      const day = d.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d.getTime() + diff * 86400000);
      const sun = new Date(mon.getTime() + 6 * 86400000);
      key = `${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}~${String(sun.getUTCMonth() + 1).padStart(2, '0')}-${String(sun.getUTCDate()).padStart(2, '0')}`;
    } else {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    const g = groups.get(key);
    const billing = Number(r.billing) || 0;
    const nurseSalary = Number(r.nurse_salary) || 0;
    if (g) {
      g.billing += billing;
      g.nurseSalary += nurseSalary;
      g.shifts += 1;
      g.nurses.add(r.user_id);
    } else {
      groups.set(key, { billing, nurseSalary, shifts: 1, nurses: new Set([r.user_id]) });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, g]) => ({
      label,
      billing: g.billing,
      nurseSalary: g.nurseSalary,
      profit: g.billing - g.nurseSalary,
      shifts: g.shifts,
      activeNurses: g.nurses.size,
    }));
}

function aggregateByCaseId(rows: RecordRow[], caseMap: Map<string, string>) {
  const groups = new Map<string, { billing: number; nurseSalary: number; shifts: number }>();
  for (const r of rows) {
    const g = groups.get(r.case_id);
    const billing = Number(r.billing) || 0;
    const nurseSalary = Number(r.nurse_salary) || 0;
    if (g) { g.billing += billing; g.nurseSalary += nurseSalary; g.shifts++; }
    else groups.set(r.case_id, { billing, nurseSalary, shifts: 1 });
  }
  return Array.from(groups.entries())
    .map(([caseId, g]) => ({
      name: caseMap.get(caseId) || '未知',
      billing: g.billing,
      nurseSalary: g.nurseSalary,
      profit: g.billing - g.nurseSalary,
      shifts: g.shifts,
      margin: g.billing > 0 ? Math.round(((g.billing - g.nurseSalary) / g.billing) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.billing - a.billing);
}

function aggregateByUserId(rows: RecordRow[], userMap: Map<string, string>) {
  const groups = new Map<string, { billing: number; nurseSalary: number; dayHours: number; nightHours: number; shifts: number }>();
  for (const r of rows) {
    const g = groups.get(r.user_id);
    const billing = Number(r.billing) || 0;
    const nurseSalary = Number(r.nurse_salary) || 0;
    const dayHours = Number(r.day_hours) || 0;
    const nightHours = Number(r.night_hours) || 0;
    if (g) { g.billing += billing; g.nurseSalary += nurseSalary; g.dayHours += dayHours; g.nightHours += nightHours; g.shifts++; }
    else groups.set(r.user_id, { billing, nurseSalary, dayHours, nightHours, shifts: 1 });
  }
  return Array.from(groups.entries())
    .map(([userId, g]) => ({
      name: userMap.get(userId) || '未知',
      totalHours: g.dayHours + g.nightHours,
      dayHours: g.dayHours,
      nightHours: g.nightHours,
      billing: g.billing,
      nurseSalary: g.nurseSalary,
      shifts: g.shifts,
    }))
    .sort((a, b) => b.totalHours - a.totalHours);
}

function aggregateUnpaid(rows: RecordRow[], userMap: Map<string, string>) {
  const groups = new Map<string, { count: number; totalAmount: number; oldestDate: string }>();
  for (const r of rows) {
    if (r.paid_at) continue;
    const g = groups.get(r.user_id);
    const amount = Number(r.nurse_salary) || 0;
    if (g) {
      g.count++;
      g.totalAmount += amount;
      if (r.clock_in_time < g.oldestDate) g.oldestDate = r.clock_in_time;
    } else {
      groups.set(r.user_id, { count: 1, totalAmount: amount, oldestDate: r.clock_in_time });
    }
  }
  return Array.from(groups.entries())
    .map(([userId, g]) => ({
      nurseName: userMap.get(userId) || '未知',
      count: g.count,
      totalAmount: g.totalAmount,
      oldestDate: g.oldestDate,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

function aggregateNurseUtil(rows: RecordRow[], userMap: Map<string, string>) {
  const groups = new Map<string, { shifts: number; dayHours: number; nightHours: number; months: Set<string> }>();
  for (const r of rows) {
    const d = toTaipeiDate(r.clock_in_time);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const g = groups.get(r.user_id);
    const dayHours = Number(r.day_hours) || 0;
    const nightHours = Number(r.night_hours) || 0;
    if (g) { g.shifts++; g.dayHours += dayHours; g.nightHours += nightHours; g.months.add(monthKey); }
    else groups.set(r.user_id, { shifts: 1, dayHours, nightHours, months: new Set([monthKey]) });
  }
  return Array.from(groups.entries())
    .map(([userId, g]) => ({
      nurseName: userMap.get(userId) || '未知',
      totalShifts: g.shifts,
      dayHours: g.dayHours,
      nightHours: g.nightHours,
      avgPerMonth: Math.round((g.shifts / Math.max(1, g.months.size)) * 10) / 10,
    }))
    .sort((a, b) => b.totalShifts - a.totalShifts);
}

function aggregateCaseServiceDays(rows: RecordRow[], caseMap: Map<string, string>) {
  const groups = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    const d = toTaipeiDate(r.clock_in_time);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    if (!groups.has(r.case_id)) groups.set(r.case_id, new Map());
    const months = groups.get(r.case_id)!;
    if (!months.has(monthKey)) months.set(monthKey, new Set());
    months.get(monthKey)!.add(dateKey);
  }
  return Array.from(groups.entries())
    .map(([caseId, months]) => {
      const monthObj: Record<string, number> = {};
      let totalDays = 0;
      for (const [m, dates] of months) {
        monthObj[m] = dates.size;
        totalDays += dates.size;
      }
      return { caseName: caseMap.get(caseId) || '未知', months: monthObj, _totalDays: totalDays };
    })
    .sort((a, b) => b._totalDays - a._totalDays)
    .map(({ _totalDays, ...rest }) => rest);
}

// === Alert queries (global, efficient) ===
async function fetchAlerts(orgId: string) {
  let unpaidSalaryCount = 0, unpaidSalaryAmount = 0;
  let abnormalCount = 0;
  let pendingModCount = 0;
  let pendingExpCount = 0, pendingExpAmount = 0;

  if (isSupabase) {
    const { data: unpaidData } = await supabase
      .from('clock_records')
      .select('nurse_salary')
      .eq('org_id', orgId)
      .is('paid_at', null)
      .not('clock_out_time', 'is', null)
      .limit(100000);
    unpaidSalaryCount = unpaidData?.length || 0;
    unpaidSalaryAmount = (unpaidData || []).reduce((s: number, r: { nurse_salary: number }) => s + (Number(r.nurse_salary) || 0), 0);

    const cutoff48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: noClockOut } = await supabase
      .from('clock_records')
      .select('id')
      .eq('org_id', orgId)
      .is('clock_out_time', null)
      .lt('clock_in_time', cutoff48h);
    abnormalCount = noClockOut?.length || 0;
  }

  const pendingMods = await getModificationRequests(orgId, { status: 'pending' });
  pendingModCount = pendingMods.length;

  const pendingExps = await getAdvanceExpenses(orgId, { status: 'pending' });
  pendingExpCount = pendingExps.length;
  pendingExpAmount = pendingExps.reduce((s, e) => s + e.amount, 0);

  return {
    unpaidSalary: { count: unpaidSalaryCount, totalAmount: unpaidSalaryAmount },
    abnormalShifts: { count: abnormalCount },
    pendingModifications: { count: pendingModCount },
    pendingExpenses: { count: pendingExpCount, totalAmount: pendingExpAmount },
  };
}
