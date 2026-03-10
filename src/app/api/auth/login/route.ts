import { NextResponse } from 'next/server';
import { authenticateUser, getOrgByCode } from '@/lib/db';
import { createToken } from '@/lib/auth';

export async function POST(request: Request) {
  const { code, account, password } = await request.json();

  if (!code || !account || !password) {
    return NextResponse.json({ error: '請填寫所有欄位' }, { status: 400 });
  }

  const org = await getOrgByCode(code);
  if (!org) {
    return NextResponse.json({ error: '代碼錯誤' }, { status: 401 });
  }

  const user = await authenticateUser(code, account, password);
  if (!user) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 });
  }

  const token = await createToken({
    userId: user.id,
    orgId: user.orgId,
    orgCode: org.code,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    success: true,
    user: { name: user.name, role: user.role },
  });

  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return response;
}
