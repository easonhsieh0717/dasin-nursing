import { NextResponse } from 'next/server';
import { authenticateUser, getOrgByCode, authenticateAdmin } from '@/lib/db';
import { createToken } from '@/lib/auth';

// ===== Rate Limiting =====
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; firstAttempt: number }>();

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }
  record.count++;
  return record.count <= MAX_ATTEMPTS;
}

// Cleanup stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attempts) {
    if (now - record.firstAttempt > LOGIN_WINDOW_MS) attempts.delete(ip);
  }
}, 60 * 1000);

export async function POST(request: Request) {
  // Rate limit check
  const ip = getClientIP(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '登入嘗試次數過多，請 15 分鐘後再試' },
      { status: 429 }
    );
  }

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

    // Clear rate limit on success
    attempts.delete(ip);

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

  // Clear rate limit on success
  attempts.delete(ip);

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
