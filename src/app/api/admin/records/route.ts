import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, createClockRecord, updateClockRecord, deleteClockRecord, getRateSettings, getSpecialConditions } from '@/lib/db';
import { paginate, calculateSalary, getSpecialMultiplier, calculateNurseSalary } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

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

    const records = await getClockRecords(session.orgId, filters);
    const enriched = await enrichRecords(records);

    // 取得費率和特殊狀況，自動計算薪資
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
      const nurseSalary = calculateNurseSalary(billing);
      return { ...r, calculatedSalary: billing, billing, nurseSalary, multiplier };
    });

    const result = paginate(withSalary, page, pageSize);

    return NextResponse.json(result);
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
    const record = await createClockRecord({
      orgId: session.orgId,
      userId: body.userId,
      caseId: body.caseId,
      clockInTime: body.clockInTime || null,
      clockInLat: body.clockInLat || null,
      clockInLng: body.clockInLng || null,
      clockOutTime: body.clockOutTime || null,
      clockOutLat: body.clockOutLat || null,
      clockOutLng: body.clockOutLng || null,
      salary: body.salary || 0,
      paidAt: null,
    });

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
    const { id, ...data } = body;
    const updated = await updateClockRecord(id, data);
    if (!updated) {
      return NextResponse.json({ error: '找不到紀錄' }, { status: 404 });
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

    await deleteClockRecord(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin records DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
