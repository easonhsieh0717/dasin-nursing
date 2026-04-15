import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords } from '@/lib/db';
import { paginate } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;

    const filters: Record<string, string | undefined> = {
      userId: session.role === 'employee' ? session.userId : undefined,
    };

    // 員工只能看到自己的紀錄（userId 已過濾，不限個案）

    if (startTime) filters.startTime = startTime;
    if (endTime) filters.endTime = endTime;

    const records = await getClockRecords(session.orgId, filters);
    const enriched = await enrichRecords(records);

    // 使用預算值
    const withSalary = enriched.map(r => ({
      ...r, calculatedSalary: r.nurseSalary, multiplier: 1,
    }));

    const result = paginate(withSalary, page, pageSize);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Records GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
