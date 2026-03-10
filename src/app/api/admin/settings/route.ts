import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRateSettings, createRateSettings, updateRateSettings, deleteRateSettings } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const settings = await getRateSettings(session.orgId);
  return NextResponse.json({ data: settings });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const body = await request.json();
  const rs = await createRateSettings({
    orgId: session.orgId,
    effectiveDate: body.effectiveDate,
    label: body.label,
    mainDayRate: body.mainDayRate,
    mainNightRate: body.mainNightRate,
    otherDayRate: body.otherDayRate,
    otherNightRate: body.otherNightRate,
    fullDayRate24h: body.fullDayRate24h,
    minBillingHours: body.minBillingHours,
    remoteAreaSubsidy: body.remoteAreaSubsidy,
    dialysisVisitFee: body.dialysisVisitFee,
    dialysisOvertimeRate: body.dialysisOvertimeRate,
  });

  return NextResponse.json(rs);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...data } = body;
  const updated = await updateRateSettings(id, data);
  if (!updated) {
    return NextResponse.json({ error: '找不到設定' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });

  await deleteRateSettings(id);
  return NextResponse.json({ success: true });
}
