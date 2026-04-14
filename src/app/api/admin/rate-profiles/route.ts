import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getRateProfiles, createRateProfile, updateRateProfile, deleteRateProfile,
  getRatePeriods, upsertRatePeriods,
} from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

    const profiles = await getRateProfiles(session.orgId);

    const { searchParams } = new URL(request.url);
    const withPeriods = searchParams.get('withPeriods') === 'true';

    if (withPeriods) {
      const result = await Promise.all(profiles.map(async p => ({
        ...p,
        periods: await getRatePeriods(p.id),
      })));
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ data: profiles });
  } catch (err) {
    console.error('Rate profiles GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

    const body = await request.json();
    const { name, periods } = body;

    if (!name?.trim()) return NextResponse.json({ error: '費率方案名稱必填' }, { status: 400 });
    if (!Array.isArray(periods) || periods.length < 2) return NextResponse.json({ error: '至少需要 2 個時段' }, { status: 400 });

    const profile = await createRateProfile({ orgId: session.orgId, name: name.trim() });
    await upsertRatePeriods(profile.id, periods.map((p, i) => ({
      profileId: profile.id,
      startTime: p.startTime,
      endTime: p.endTime,
      billingRate: Number(p.billingRate) || 0,
      nurseRate: Number(p.nurseRate) || 0,
      sortOrder: i,
    })));

    const savedPeriods = await getRatePeriods(profile.id);
    return NextResponse.json({ data: { ...profile, periods: savedPeriods } });
  } catch (err) {
    console.error('Rate profiles POST error:', err);
    return NextResponse.json({ error: '新增失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

    const body = await request.json();
    const { id, name, periods } = body;

    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });

    if (name !== undefined) {
      await updateRateProfile(id, { name }, session.orgId);
    }

    if (Array.isArray(periods)) {
      if (periods.length < 2) return NextResponse.json({ error: '至少需要 2 個時段' }, { status: 400 });
      await upsertRatePeriods(id, periods.map((p, i) => ({
        profileId: id,
        startTime: p.startTime,
        endTime: p.endTime,
        billingRate: Number(p.billingRate) || 0,
        nurseRate: Number(p.nurseRate) || 0,
        sortOrder: i,
      })));
    }

    const updatedPeriods = await getRatePeriods(id);
    return NextResponse.json({ success: true, periods: updatedPeriods });
  } catch (err) {
    console.error('Rate profiles PUT error:', err);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少 ID' }, { status: 400 });

    await deleteRateProfile(id, session.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Rate profiles DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
