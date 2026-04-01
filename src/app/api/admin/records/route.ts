import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecordsPaginated, enrichRecords, createClockRecord, updateClockRecord, deleteClockRecord } from '@/lib/db';
import { createRecordSchema, updateRecordSchema, parseBody } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20'), 1), 100);

    const filters: Record<string, string | undefined> = {};
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const clockType = searchParams.get('clockType') as 'in' | 'out' | null;
    const settlementType = searchParams.get('settlementType');
    const caseCode = searchParams.get('caseCode');
    const caseName = searchParams.get('caseName');
    const userName = searchParams.get('userName');

    if (startTime) filters.startTime = startTime;
    if (endTime) filters.endTime = endTime;
    if (settlementType) filters.settlementType = settlementType;
    if (caseCode) filters.caseCode = caseCode;
    if (caseName) filters.caseName = caseName;
    if (userName) filters.userName = userName;
    if (clockType) (filters as Record<string, string>).clockType = clockType;

    // True server-side pagination — only fetch the requested page
    const result = await getClockRecordsPaginated(session.orgId, page, pageSize, filters);
    const enriched = await enrichRecords(result.data);

    const withSalary = enriched.map(r => ({
      ...r, calculatedSalary: r.billing, multiplier: 1,
    }));

    return NextResponse.json({ data: withSalary, total: result.total, totalPages: result.totalPages });
  } catch (err) {
    console.error('Admin records GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseBody(createRecordSchema, body);
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const record = await createClockRecord({
      orgId: session.orgId,
      ...parsed.data,
      paidAt: null,
      billing: 0, nurseSalary: 0, dayHours: 0, nightHours: 0,
    });

    // 有下班時間 → 計算 billing
    if (record.clockOutTime) {
      try {
        const { computeBillingForRecord } = await import('@/lib/billing');
        const result = await computeBillingForRecord(record);
        const updated = await updateClockRecord(record.id, {
          billing: result.billing, nurseSalary: result.nurseSalary,
          dayHours: result.dayHours, nightHours: result.nightHours,
          salary: result.billing,
        });
        return NextResponse.json(updated);
      } catch { /* billing 計算失敗不影響建立 */ }
    }

    return NextResponse.json(record);
  } catch (err) {
    console.error('Admin records POST error:', err);
    return NextResponse.json({ error: '新增失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseBody(updateRecordSchema, body);
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { id, ...data } = parsed.data;
    let updated = await updateClockRecord(id, data, session.orgId);
    if (!updated) {
      return NextResponse.json({ error: '找不到紀錄' }, { status: 404 });
    }

    // 若修改了影響 billing 的欄位 → 重算
    const billingFields = ['clockInTime', 'clockOutTime', 'salary', 'caseId'] as const;
    if (billingFields.some(k => (data as Record<string, unknown>)[k] !== undefined) && updated.clockOutTime) {
      try {
        const { computeBillingForRecord } = await import('@/lib/billing');
        const result = await computeBillingForRecord(updated);
        updated = (await updateClockRecord(id, {
          billing: result.billing, nurseSalary: result.nurseSalary,
          dayHours: result.dayHours, nightHours: result.nightHours,
        })) || updated;
      } catch { /* billing 計算失敗不影響更新 */ }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('Admin records PUT error:', err);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    await deleteClockRecord(id, session.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin records DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
