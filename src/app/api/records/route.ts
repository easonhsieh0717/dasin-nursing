import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getRateSettings, getSpecialConditions, getUserById, getCases } from '@/lib/db';
import { paginate, calculateSalary, getSpecialMultiplier, calculateNurseSalary } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;

    const filters: Record<string, string | undefined> = {
      userId: session.role === 'employee' ? session.userId : undefined,
    };

    // 員工只能看到自己 + 自己指派個案的紀錄
    if (session.role === 'employee') {
      const user = await getUserById(session.userId);
      let assignedCaseId = user?.defaultCaseId;
      // 如果沒有指派個案，使用第一個個案（與 clock/status 邏輯一致）
      if (!assignedCaseId) {
        const cases = await getCases(session.orgId);
        assignedCaseId = cases[0]?.id;
      }
      if (assignedCaseId) {
        filters.caseId = assignedCaseId;
      }
    }

    if (startTime) filters.startTime = startTime;
    if (endTime) filters.endTime = endTime;

    const records = await getClockRecords(session.orgId, filters);
    const enriched = await enrichRecords(records);

    // 計算薪資
    const allRates = await getRateSettings(session.orgId);
    const latestRate = allRates.sort((a, b) =>
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    )[0];
    const specialConditions = await getSpecialConditions(session.orgId);

    const dayRate = latestRate?.mainDayRate ?? 490;
    const nightRate = latestRate?.mainNightRate ?? 530;

    const withSalary = enriched.map(r => {
      const multiplier = getSpecialMultiplier(r.clockInTime, r.clockOutTime, specialConditions);
      const billing = calculateSalary(r.clockInTime, r.clockOutTime, dayRate, nightRate, multiplier);
      const calculatedSalary = calculateNurseSalary(billing); // 員工看到的是特護薪資(90%)
      return { ...r, calculatedSalary, multiplier };
    });

    const result = paginate(withSalary, page, pageSize);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Records GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
