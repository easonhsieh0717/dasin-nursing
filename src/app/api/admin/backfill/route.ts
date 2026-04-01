import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, updateClockRecord, getUsers, updateUser, getUserById } from '@/lib/db';
import { loadBillingContext, computeBilling } from '@/lib/billing';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    // mode=clearRates：清除所有特護時薪為 0
    if (mode === 'clearRates') {
      const { users } = await getUsers(session.orgId);
      let cleared = 0;
      for (const u of users) {
        if (u.role === 'employee' && u.hourlyRate > 0) {
          await updateUser(u.id, { hourlyRate: 0 }, session.orgId);
          cleared++;
        }
      }
      return NextResponse.json({ success: true, cleared });
    }

    // 預設：重算所有 billing
    const ctx = await loadBillingContext(session.orgId);
    const caseMap = new Map(ctx.cases.map(c => [c.id, c]));

    const records = await getClockRecords(session.orgId, { fetchAll: true });

    let updated = 0;
    let skipped = 0;

    const BATCH_SIZE = 50;
    const toUpdate: { id: string; data: { billing: number; nurseSalary: number; dayHours: number; nightHours: number } }[] = [];

    for (const r of records) {
      if (!r.clockOutTime) { skipped++; continue; }

      const targetCase = caseMap.get(r.caseId);
      const nurse = await getUserById(r.userId);
      const result = computeBilling(
        r.clockInTime, r.clockOutTime, r.salary,
        targetCase?.caseType || '主要地區',
        targetCase?.remoteSubsidy ?? false,
        ctx.latestRate, ctx.specialConditions,
        nurse?.hourlyRate ?? 0,
      );

      toUpdate.push({
        id: r.id,
        data: { billing: result.billing, nurseSalary: result.nurseSalary, dayHours: result.dayHours, nightHours: result.nightHours },
      });
    }

    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(item => updateClockRecord(item.id, item.data)));
      updated += batch.length;
    }

    return NextResponse.json({
      success: true,
      total: records.length,
      updated,
      skipped,
    });
  } catch (err) {
    console.error('Backfill error:', err);
    return NextResponse.json({ error: '回填失敗' }, { status: 500 });
  }
}
