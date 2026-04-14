import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createPasswordResetRequest } from '@/lib/db';

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'employee') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    await createPasswordResetRequest(session.orgId, session.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Password reset request error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
