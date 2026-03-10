import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findAnyOpenClockRecord, getCases } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const openRecord = await findAnyOpenClockRecord(session.userId);

    if (!openRecord) {
      return NextResponse.json({ isClockedIn: false });
    }

    // 取得個案名稱
    let caseName = '';
    try {
      const cases = await getCases(session.orgId);
      const matched = cases.find(c => c.id === openRecord.caseId);
      caseName = matched?.name || '';
    } catch {
      // ignore
    }

    return NextResponse.json({
      isClockedIn: true,
      openRecord: {
        id: openRecord.id,
        clockInTime: openRecord.clockInTime,
        caseName,
      },
    });
  } catch (err) {
    console.error('Clock status error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
