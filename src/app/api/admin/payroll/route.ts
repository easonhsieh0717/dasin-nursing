import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getRateSettings, getSpecialConditions, getUsers } from '@/lib/db';
import { calculateSalary, getSpecialMultiplier, calculateNurseSalary } from '@/lib/utils';

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

    // 取得費率和特殊狀況
    const allRates = await getRateSettings(session.orgId);
    const latestRate = allRates.sort((a, b) =>
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    )[0];
    const specialConditions = await getSpecialConditions(session.orgId);
    const dayRate = latestRate?.mainDayRate ?? 490;
    const nightRate = latestRate?.mainNightRate ?? 530;

    // 取得所有特護（含銀行資訊）
    const { users } = await getUsers(session.orgId);
    const userMap = new Map(users.map(u => [u.id, u]));

    // 計算每筆請款金額和特護薪資
    const computed = enriched.map(r => {
      const multiplier = getSpecialMultiplier(r.clockInTime, r.clockOutTime, specialConditions);
      const billing = calculateSalary(r.clockInTime, r.clockOutTime, dayRate, nightRate, multiplier);
      const nurseSalary = calculateNurseSalary(billing);
      return { ...r, billing, nurseSalary, multiplier };
    });

    // 按特護彙總
    const summaryMap = new Map<string, { name: string; userId: string; totalBilling: number; totalSalary: number; shifts: number; bank: string; accountNo: string; accountName: string; isPostOffice: boolean }>();

    for (const r of computed) {
      const existing = summaryMap.get(r.userId);
      const user = userMap.get(r.userId);
      if (existing) {
        existing.totalBilling += r.billing;
        existing.totalSalary += r.nurseSalary;
        existing.shifts += 1;
      } else {
        summaryMap.set(r.userId, {
          name: r.userName,
          userId: r.userId,
          totalBilling: r.billing,
          totalSalary: r.nurseSalary,
          shifts: 1,
          bank: user?.bank || '',
          accountNo: user?.accountNo || '',
          accountName: user?.accountName || '',
          isPostOffice: (user?.bank || '').includes('郵局'),
        });
      }
    }

    const summary = Array.from(summaryMap.values());
    const totalAmount = summary.reduce((sum, s) => sum + s.totalSalary, 0);
    const totalBilling = summary.reduce((sum, s) => sum + s.totalBilling, 0);
    const postOfficeItems = summary.filter(s => s.isPostOffice);
    const bankItems = summary.filter(s => !s.isPostOffice);

    return NextResponse.json({
      summary,
      totalAmount,
      totalBilling,
      postOfficeCount: postOfficeItems.length,
      postOfficeAmount: postOfficeItems.reduce((sum, s) => sum + s.totalSalary, 0),
      bankCount: bankItems.length,
      bankAmount: bankItems.reduce((sum, s) => sum + s.totalSalary, 0),
    });
  } catch (err) {
    console.error('Payroll GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
