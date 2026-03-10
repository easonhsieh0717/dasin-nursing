import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCases } from '@/lib/db';

// 公開 API：任何已登入使用者都能取得自己組織的個案列表
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const cases = await getCases(session.orgId);
    return NextResponse.json({ data: cases, total: cases.length });
  } catch (err) {
    console.error('Cases GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
