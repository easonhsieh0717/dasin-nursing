import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getModificationRequests, updateModificationRequestStatus, updateClockRecord } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';

/** GET: 管理員查看所有修改申請（含特護名稱、個案名稱） */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const requests = await getModificationRequests(session.orgId, { status });

    // Enrich: 加上特護名稱、個案名稱
    if (isSupabase && requests.length > 0) {
      const userIds = [...new Set(requests.map(r => r.userId))];
      const recordIds = [...new Set(requests.map(r => r.recordId))];

      const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
      const { data: records } = await supabase.from('clock_records').select('id, case_id').in('id', recordIds);
      const caseIds = [...new Set((records || []).map((r: { case_id: string }) => r.case_id))];
      const { data: cases } = await supabase.from('cases').select('id, name, code').in('id', caseIds);

      const userMap = new Map((users || []).map((u: { id: string; name: string }) => [u.id, u.name]));
      const recordCaseMap = new Map((records || []).map((r: { id: string; case_id: string }) => [r.id, r.case_id]));
      const caseMap = new Map((cases || []).map((c: { id: string; name: string; code: string }) => [c.id, { name: c.name, code: c.code }]));

      const enriched = requests.map(req => {
        const caseId = recordCaseMap.get(req.recordId);
        const caseInfo = caseId ? caseMap.get(caseId) : null;
        return {
          ...req,
          userName: userMap.get(req.userId) || '未知',
          caseName: caseInfo?.name || '未知',
          caseCode: caseInfo?.code || '',
        };
      });
      return NextResponse.json({ data: enriched, total: enriched.length });
    }

    return NextResponse.json({ data: requests, total: requests.length });
  } catch (err) {
    console.error('Admin modification requests GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

/** PUT: 管理員審核（同意/拒絕） */
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

    const body = await request.json();
    const { id, action } = body;

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '參數錯誤' }, { status: 400 });
    }

    // 先取得申請資料
    const requests = await getModificationRequests(session.orgId);
    const req = requests.find(r => r.id === id);
    if (!req) return NextResponse.json({ error: '找不到此申請' }, { status: 404 });
    if (req.status !== 'pending') return NextResponse.json({ error: '此申請已處理' }, { status: 400 });

    const status = action === 'approve' ? 'approved' : 'rejected';
    const updated = await updateModificationRequestStatus(id, status, session.userId);

    // 同意時自動更新打卡紀錄
    if (action === 'approve' && updated) {
      await updateClockRecord(req.recordId, {
        clockInTime: req.proposedClockInTime,
        clockOutTime: req.proposedClockOutTime,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('Admin modification requests PUT error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
