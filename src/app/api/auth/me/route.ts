import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '未登入' }, { status: 401 });
  }

  return NextResponse.json({
    name: session.name,
    role: session.role,
  });
}
