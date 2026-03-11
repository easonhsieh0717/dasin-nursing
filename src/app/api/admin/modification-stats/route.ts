import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getModificationRequestStats, getUsers } from '@/lib/db';

/** GET: 簽核報表 — 每個特護的修改申請統計 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') return NextResponse.json({ error: '無權限' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const stats = await getModificationRequestStats(session.orgId, startDate, endDate);

    // Enrich: 加上特護名稱
    const { users } = await getUsers(session.orgId);
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const enriched = stats.map(s => ({
      ...s,
      userName: userMap.get(s.userId) || '未知',
      ratio: s.totalClocks > 0 ? Math.round((s.totalRequests / s.totalClocks) * 1000) / 10 : 0,
    }));

    // 按修改比例降序排列
    enriched.sort((a, b) => b.ratio - a.ratio);

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error('Modification stats GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
