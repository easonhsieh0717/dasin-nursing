import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getModificationRequests, createModificationRequest } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';

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

    // 確認紀錄存在（同組織即可申請）
    let record: { clockInTime: string | null; clockOutTime: string | null } | null = null;
    if (isSupabase) {
      const { data } = await supabase.from('clock_records').select('clock_in_time, clock_out_time').eq('id', recordId).eq('org_id', session.orgId).single();
      if (data) record = { clockInTime: data.clock_in_time, clockOutTime: data.clock_out_time };
    }
    if (!record) return NextResponse.json({ error: '找不到此紀錄' }, { status: 404 });

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
