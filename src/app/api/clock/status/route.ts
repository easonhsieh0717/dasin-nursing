import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findAnyOpenClockRecord, getCases } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    // 取得個案列表（用於顯示目前個案名稱）
    let cases: { id: string; name: string }[] = [];
    try {
      cases = await getCases(session.orgId);
    } catch {
      // ignore
    }

    const defaultCaseName = cases[0]?.name || '';

    const openRecord = await findAnyOpenClockRecord(session.userId);

    if (!openRecord) {
      return NextResponse.json({ isClockedIn: false, defaultCaseName });
    }

    const matched = cases.find(c => c.id === openRecord.caseId);
    const caseName = matched?.name || '';

    return NextResponse.json({
      isClockedIn: true,
      defaultCaseName,
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
