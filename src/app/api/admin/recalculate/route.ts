import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, updateClockRecord } from '@/lib/db';
import { loadBillingContext, computeBilling } from '@/lib/billing';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { startTime, endTime } = body;

    const ctx = await loadBillingContext(session.orgId);
    const caseMap = new Map(ctx.cases.map(c => [c.id, c]));

    const filters: Record<string, string | boolean | undefined> = { fetchAll: true };
    if (startTime) filters.startTime = startTime;
    if (endTime) filters.endTime = endTime;

    const records = await getClockRecords(session.orgId, filters);

    // Batch updates in chunks of 50
    const BATCH_SIZE = 50;
    const toUpdate: { id: string; data: { billing: number; nurseSalary: number; dayHours: number; nightHours: number } }[] = [];
    for (const r of records) {
      if (!r.clockOutTime) continue;
      const targetCase = caseMap.get(r.caseId);
      const result = computeBilling(
        r.clockInTime, r.clockOutTime, r.salary,
        targetCase?.caseType || '主要地區',
        targetCase?.remoteSubsidy ?? false,
        ctx.latestRate, ctx.specialConditions,
      );
      toUpdate.push({ id: r.id, data: { billing: result.billing, nurseSalary: result.nurseSalary, dayHours: result.dayHours, nightHours: result.nightHours } });
    }
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(item => updateClockRecord(item.id, item.data)));
      updated += batch.length;
    }

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    console.error('Recalculate error:', err);
    return NextResponse.json({ error: '重算失敗' }, { status: 500 });
  }
}
