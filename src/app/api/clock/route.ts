import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createClockRecord, findOpenClockRecord, updateClockRecord, getCases } from '@/lib/db';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  const { type, lat, lng, caseId } = await request.json();

  if (type === 'in') {
    const cases = await getCases(session.orgId);
    const targetCaseId = caseId || cases[0]?.id;
    if (!targetCaseId) {
      return NextResponse.json({ error: '沒有可用的個案' }, { status: 400 });
    }

    const record = await createClockRecord({
      orgId: session.orgId,
      userId: session.userId,
      caseId: targetCaseId,
      clockInTime: new Date().toISOString(),
      clockInLat: lat || null,
      clockInLng: lng || null,
      clockOutTime: null,
      clockOutLat: null,
      clockOutLng: null,
      salary: 0,
    });

    return NextResponse.json({ success: true, record });
  }

  if (type === 'out') {
    const cases = await getCases(session.orgId);
    let openRecord = null;

    for (const c of cases) {
      const found = await findOpenClockRecord(session.userId, c.id);
      if (found) {
        openRecord = found;
        break;
      }
    }

    if (!openRecord) {
      return NextResponse.json({ error: '找不到上班打卡紀錄' }, { status: 400 });
    }

    const updated = await updateClockRecord(openRecord.id, {
      clockOutTime: new Date().toISOString(),
      clockOutLat: lat || null,
      clockOutLng: lng || null,
    });

    return NextResponse.json({ success: true, record: updated });
  }

  return NextResponse.json({ error: '無效的打卡類型' }, { status: 400 });
}
