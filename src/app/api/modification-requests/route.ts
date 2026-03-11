import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getModificationRequests, createModificationRequest, getModificationRequestsByRecordId, getClockRecords } from '@/lib/db';

/** GET: 特護查自己的修改申請列表 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '未登入' }, { status: 401 });

    const requests = await getModificationRequests(session.orgId, { userId: session.userId });
    return NextResponse.json({ data: requests });
  } catch (err) {
    console.error('Modification requests GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

/** POST: 特護提交修改申請 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '未登入' }, { status: 401 });

    const body = await request.json();
    const { recordId, proposedClockInTime, proposedClockOutTime, reason } = body;

    if (!recordId) return NextResponse.json({ error: '缺少紀錄 ID' }, { status: 400 });
    if (!reason || !reason.trim()) return NextResponse.json({ error: '請填寫修改原因' }, { status: 400 });

    // 確認紀錄屬於此使用者
    const records = await getClockRecords(session.orgId, { userId: session.userId });
    const record = records.find(r => r.id === recordId);
    if (!record) return NextResponse.json({ error: '找不到此紀錄或無權限' }, { status: 404 });

    // 檢查是否已有 pending 申請
    const existing = await getModificationRequestsByRecordId(recordId, 'pending');
    if (existing.length > 0) return NextResponse.json({ error: '此紀錄已有待審核的修改申請' }, { status: 400 });

    // 建立申請
    const req = await createModificationRequest({
      orgId: session.orgId,
      recordId,
      userId: session.userId,
      originalClockInTime: record.clockInTime,
      originalClockOutTime: record.clockOutTime,
      proposedClockInTime: proposedClockInTime || record.clockInTime,
      proposedClockOutTime: proposedClockOutTime || record.clockOutTime,
      reason: reason.trim(),
    });

    return NextResponse.json(req);
  } catch (err) {
    console.error('Modification requests POST error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
