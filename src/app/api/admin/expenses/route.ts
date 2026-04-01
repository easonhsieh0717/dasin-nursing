import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdvanceExpenses, updateAdvanceExpenseStatus, deleteAdvanceExpense } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const caseId = searchParams.get('caseId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const requests = await getAdvanceExpenses(session.orgId, { status, caseId, startDate, endDate });

    // Enrich with user names and case names
    if (isSupabase && requests.length > 0) {
      const userIds = [...new Set(requests.map(r => r.userId))];
      const caseIds = [...new Set(requests.map(r => r.caseId))];

      const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
      const { data: cases } = await supabase.from('cases').select('id, name, code').in('id', caseIds);

      const userMap = new Map((users || []).map((u: { id: string; name: string }) => [u.id, u.name]));
      const caseMap = new Map((cases || []).map((c: { id: string; name: string; code: string }) => [c.id, c.name]));

      const enriched = await Promise.all(requests.map(async (req) => {
        let imageUrl = req.imageUrl;
        if (imageUrl && !imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
          const { data: signedData } = await supabase.storage.from('expense-images').createSignedUrl(imageUrl, 3600);
          imageUrl = signedData?.signedUrl || imageUrl;
        }
        return {
          ...req,
          imageUrl,
          userName: userMap.get(req.userId) || '未知',
          caseName: caseMap.get(req.caseId) || '未知',
        };
      }));
      return NextResponse.json({ data: enriched, total: enriched.length });
    }

    return NextResponse.json({ data: requests, total: requests.length });
  } catch (err) {
    console.error('Admin expenses GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '參數錯誤' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updated = await updateAdvanceExpenseStatus(id, newStatus, session.userId);
    if (!updated) return NextResponse.json({ error: '找不到此申請' }, { status: 404 });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('Admin expenses PUT error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: '參數錯誤' }, { status: 400 });

    const deleted = await deleteAdvanceExpense(id, session.orgId);
    if (!deleted) return NextResponse.json({ error: '找不到此紀錄或無權限刪除' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin expenses DELETE error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
