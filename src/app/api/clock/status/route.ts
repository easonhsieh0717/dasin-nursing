import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findAnyOpenClockRecord, getCaseById, getUserById } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    // 個案由登入時的 caseId 決定（管理員無 caseId）
    const assignedCaseId = session.caseId || '';
    let defaultCaseName = '';
    let defaultCaseCode = '';

    if (assignedCaseId) {
      const c = await getCaseById(assignedCaseId);
      defaultCaseName = c?.name || '';
      defaultCaseCode = c?.code || '';
    }

    // 取使用者 account（用於特殊邏輯判斷）
    const user = await getUserById(session.userId);

    const openRecord = await findAnyOpenClockRecord(session.userId);

    const userAccount = user?.account || '';

    if (!openRecord) {
      return NextResponse.json({ isClockedIn: false, defaultCaseName, defaultCaseCode, defaultCaseId: assignedCaseId, account: userAccount });
    }

    const openCase = await getCaseById(openRecord.caseId);
    const caseName = openCase?.name || '';

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
