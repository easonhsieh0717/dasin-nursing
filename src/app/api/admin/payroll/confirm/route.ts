import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markRecordsAsPaid } from '@/lib/db';

/** POST: 確定發放 — 批次標記紀錄為已發放 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    const { recordIds } = body;

    if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ error: '缺少紀錄 ID' }, { status: 400 });
    }

    const count = await markRecordsAsPaid(recordIds);

    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error('Payroll confirm POST error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
