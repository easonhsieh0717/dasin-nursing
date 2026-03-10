import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords } from '@/lib/db';
import { paginate } from '@/lib/utils';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  const records = await getClockRecords(session.orgId, {
    userId: session.role === 'employee' ? session.userId : undefined,
  });

  const enriched = await enrichRecords(records);
  const result = paginate(enriched, page, pageSize);

  return NextResponse.json(result);
}
