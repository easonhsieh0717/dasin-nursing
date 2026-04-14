import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { changeUserPassword } from '@/lib/db';

// Apple ID password rules
function validatePassword(password: string, account: string): string | null {
  if (password.length < 8) return '密碼至少需要 8 個字元';
  if (!/[A-Z]/.test(password)) return '密碼需包含至少一個大寫字母';
  if (!/[a-z]/.test(password)) return '密碼需包含至少一個小寫字母';
  if (!/[0-9]/.test(password)) return '密碼需包含至少一個數字';
  if (password === account) return '密碼不能與帳號相同';
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: '請填寫所有欄位' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: '新密碼與確認密碼不一致' }, { status: 400 });
    }

    // Extract account from session userId — we need to get it from DB
    // We do validation in changeUserPassword after fetching user
    const ruleError = validatePassword(newPassword, session.name);
    // Note: account might differ from name, but we check more strictly in the DB function
    if (ruleError) {
      return NextResponse.json({ error: ruleError }, { status: 400 });
    }

    const result = await changeUserPassword(session.userId, currentPassword, newPassword);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
