import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getRateSettings, getSpecialConditions } from '@/lib/db';
import { calculateSalary, getSpecialMultiplier, calculateNurseSalary, getDayNightHours } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;

    const filters: Record<string, string | undefined> = {};
    if (startTime) filters.startTime = startTime;
    if (endTime) filters.endTime = endTime;

    const records = await getClockRecords(session.orgId, filters);
    const enriched = await enrichRecords(records);

    const allRates = await getRateSettings(session.orgId);
    const latestRate = allRates.sort((a, b) =>
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    )[0];
    const specialConditions = await getSpecialConditions(session.orgId);
    const dayRate = latestRate?.mainDayRate ?? 490;
    const nightRate = latestRate?.mainNightRate ?? 530;

    // 計算每筆請款金額、特護薪資、日夜班時數
    const computed = enriched.map(r => {
      const multiplier = getSpecialMultiplier(r.clockInTime, r.clockOutTime, specialConditions);
      const billing = calculateSalary(r.clockInTime, r.clockOutTime, dayRate, nightRate, multiplier);
      const nurseSalary = calculateNurseSalary(billing);
      const { dayHours, nightHours } = getDayNightHours(r.clockInTime, r.clockOutTime);
      return { ...r, billing, nurseSalary, dayHours, nightHours };
    });

    // 總計
    const totalBilling = computed.reduce((s, r) => s + r.billing, 0);
    const totalNurseSalary = computed.reduce((s, r) => s + r.nurseSalary, 0);
    const totalProfit = totalBilling - totalNurseSalary;
    const totalDayHours = computed.reduce((s, r) => s + r.dayHours, 0);
    const totalNightHours = computed.reduce((s, r) => s + r.nightHours, 0);
    const totalShifts = computed.length;

    // 月度趨勢
    const monthlyMap = new Map<string, { billing: number; nurseSalary: number; profit: number; shifts: number }>();
    for (const r of computed) {
      if (!r.clockInTime) continue;
      const d = new Date(r.clockInTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyMap.get(key) || { billing: 0, nurseSalary: 0, profit: 0, shifts: 0 };
      existing.billing += r.billing;
      existing.nurseSalary += r.nurseSalary;
      existing.profit += r.billing - r.nurseSalary;
      existing.shifts += 1;
      monthlyMap.set(key, existing);
    }
    const monthlyTrend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    // 個案營收排名
    const caseMap = new Map<string, { name: string; billing: number; nurseSalary: number; shifts: number }>();
    for (const r of computed) {
      const existing = caseMap.get(r.caseId) || { name: r.caseName, billing: 0, nurseSalary: 0, shifts: 0 };
      existing.billing += r.billing;
      existing.nurseSalary += r.nurseSalary;
      existing.shifts += 1;
      caseMap.set(r.caseId, existing);
    }
    const caseBreakdown = Array.from(caseMap.values()).sort((a, b) => b.billing - a.billing);

    // 特護工時排名
    const nurseMap = new Map<string, { name: string; totalHours: number; dayHours: number; nightHours: number; billing: number; nurseSalary: number; shifts: number }>();
    for (const r of computed) {
      const existing = nurseMap.get(r.userId) || { name: r.userName, totalHours: 0, dayHours: 0, nightHours: 0, billing: 0, nurseSalary: 0, shifts: 0 };
      existing.totalHours += r.dayHours + r.nightHours;
      existing.dayHours += r.dayHours;
      existing.nightHours += r.nightHours;
      existing.billing += r.billing;
      existing.nurseSalary += r.nurseSalary;
      existing.shifts += 1;
      nurseMap.set(r.userId, existing);
    }
    const nurseBreakdown = Array.from(nurseMap.values()).sort((a, b) => b.totalHours - a.totalHours);

    return NextResponse.json({
      summary: { totalBilling, totalNurseSalary, totalProfit, totalDayHours, totalNightHours, totalShifts },
      monthlyTrend,
      caseBreakdown,
      nurseBreakdown,
      shiftDistribution: { dayHours: totalDayHours, nightHours: totalNightHours },
    });
  } catch (err) {
    console.error('Dashboard GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
