import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findAnyOpenClockRecord, getCases, getUserById } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    // 取得使用者資料（含 defaultCaseId）
    const user = await getUserById(session.userId);

    // 取得個案列表
    let cases: { id: string; name: string; code: string }[] = [];
    try {
      cases = await getCases(session.orgId);
    } catch {
      // ignore
    }

    // 使用使用者指定的個案，否則用第一個
    const assignedCaseId = user?.defaultCaseId || cases[0]?.id || '';
    const assignedCase = cases.find(c => c.id === assignedCaseId);
    const defaultCaseName = assignedCase?.name || cases[0]?.name || '';
    const defaultCaseCode = assignedCase?.code || cases[0]?.code || '';

    const openRecord = await findAnyOpenClockRecord(session.userId);

    const userAccount = user?.account || '';

    if (!openRecord) {
      return NextResponse.json({ isClockedIn: false, defaultCaseName, defaultCaseCode, defaultCaseId: assignedCaseId, account: userAccount });
    }

    const matched = cases.find(c => c.id === openRecord.caseId);
    const caseName = matched?.name || '';

    return NextResponse.json({
      isClockedIn: true,
      defaultCaseName,
      defaultCaseCode,
      defaultCaseId: assignedCaseId,
      account: userAccount,
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
