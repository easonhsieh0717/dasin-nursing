import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRateSettings, createRateSettings, updateRateSettings, deleteRateSettings } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const settings = await getRateSettings(session.orgId);
    return NextResponse.json({ data: settings });
  } catch (err) {
    console.error('Settings GET error:', err);
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
  } catch (err) {
    console.error('Settings POST error:', err);
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
    const updated = await updateRateSettings(id, data, session.orgId);
    if (!updated) {
      return NextResponse.json({ error: '找不到設定' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Settings PUT error:', err);
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
    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });

    await deleteRateSettings(id, session.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Settings DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
