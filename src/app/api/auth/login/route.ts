import { NextResponse } from 'next/server';
import { authenticateUser, getOrgByCode, authenticateAdmin } from '@/lib/db';
import { createToken } from '@/lib/auth';

export async function POST(request: Request) {
  let code: string, account: string, password: string;
  try {
    ({ code, account, password } = await request.json());
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }

  if (!account || !password) {
    return NextResponse.json({ error: '請填寫帳號和密碼' }, { status: 400 });
  }

  // 管理員可以不填代碼直接登入
  if (!code) {
    const result = await authenticateAdmin(account, password);
    if (!result) {
      return NextResponse.json({ error: '帳號或密碼錯誤，一般特護請填寫代碼' }, { status: 401 });
    }

    const { user, org } = result;
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
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  }

  // 一般特護：需要代碼 + 帳號 + 密碼
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
    maxAge: 60 * 60 * 24,
    path: '/',
  });

  return response;
}
