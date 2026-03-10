import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { savePushSubscription, deletePushSubscription } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const { subscription } = await request.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: '無效的訂閱資料' }, { status: 400 });
    }

    await savePushSubscription(session.userId, session.orgId, subscription);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    await deletePushSubscription(session.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
