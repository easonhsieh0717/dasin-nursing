import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdvanceExpenses } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const TYPE_LABELS: Record<string, string> = { meal: '餐費', transport: '車資', advance: '代墊費', other: '其它' };
const STATUS_LABELS: Record<string, string> = { pending: '待審核', approved: '已通過', rejected: '已拒絕' };

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const requests = await getAdvanceExpenses(session.orgId, { status, startDate, endDate });

    // Enrich with user/case names
    let enriched = requests;
    if (isSupabase && requests.length > 0) {
      const userIds = [...new Set(requests.map(r => r.userId))];
      const caseIds = [...new Set(requests.map(r => r.caseId))];
      const { data: users } = await supabase.from('users').select('id, name').in('id', userIds);
      const { data: cases } = await supabase.from('cases').select('id, name').in('id', caseIds);
      const userMap = new Map((users || []).map((u: { id: string; name: string }) => [u.id, u.name]));
      const caseMap = new Map((cases || []).map((c: { id: string; name: string }) => [c.id, c.name]));
      enriched = requests.map(r => ({
        ...r,
        userName: userMap.get(r.userId) || '未知',
        caseName: caseMap.get(r.caseId) || '未知',
      }));
    }

    // Build Excel
    const wb = XLSX.utils.book_new();
    const data: (string | number)[][] = [
      ['日期', '特護', '個案', '費用類型', '金額', '說明', '狀態'],
    ];

    let total = 0;
    for (const r of enriched) {
      data.push([
        r.expenseDate,
        (r as { userName?: string }).userName || '',
        (r as { caseName?: string }).caseName || '',
        TYPE_LABELS[r.expenseType] || r.expenseType,
        r.amount,
        r.description || '',
        STATUS_LABELS[r.status] || r.status,
      ]);
      total += r.amount;
    }
    data.push(['合計', '', '', '', total, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, '代墊費用');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `代墊費用_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (err) {
    console.error('Expenses export error:', err);
    return NextResponse.json({ error: '匯出失敗' }, { status: 500 });
  }
}
