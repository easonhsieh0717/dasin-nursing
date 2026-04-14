import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPasswordResetRequests, reviewPasswordResetRequest } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const requests = await getPasswordResetRequests(session.orgId, status);
    return NextResponse.json({ data: requests });
  } catch (err) {
    console.error('Password reset requests GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }
    const { id, action } = await request.json();
    if (!id || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: '參數錯誤' }, { status: 400 });
    }
    const result = await reviewPasswordResetRequest(id, action, session.userId);
    if (!result) return NextResponse.json({ error: '找不到申請' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Password reset review error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
