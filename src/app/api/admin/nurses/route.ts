import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUsers, createUser, updateUser, deleteUser, getClockRecords } from '@/lib/db';
import type { User } from '@/lib/db';
import { createNurseSchema, updateNurseSchema, parseBody } from '@/lib/validation';

// Strip password from API response
function safeUser({ password, ...rest }: User) {
  void password;
  return rest;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '10'), 1), 200);
    const search = searchParams.get('search') || undefined;
    const all = searchParams.get('all');

    if (all === 'true') {
      const { users, total } = await getUsers(session.orgId, search);
      return NextResponse.json({ data: users.map(safeUser), total });
    }

    const { users, total } = await getUsers(session.orgId, search, page, pageSize);
    const totalPages = Math.ceil(total / pageSize);
    return NextResponse.json({ data: users.map(safeUser), total, totalPages });
  } catch (err) {
    console.error('Nurses GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseBody(createNurseSchema, body);
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const user = await createUser({
      orgId: session.orgId,
      ...parsed.data,
      // If no password provided, default = account name (db.ts createUser handles this)
      password: parsed.data.password || parsed.data.account,
      role: 'employee',
      defaultCaseId: parsed.data.defaultCaseId || undefined,
      mustChangePassword: true,
    });

    return NextResponse.json(safeUser(user));
  } catch (err: unknown) {
    console.error('Nurses POST error:', err);
    // Supabase unique constraint violation (duplicate account)
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      return NextResponse.json({ error: '帳號已存在，請使用其他帳號' }, { status: 400 });
    }
    return NextResponse.json({ error: '新增失敗' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = parseBody(updateNurseSchema, body);
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { id, ...allowed } = parsed.data;
    const updated = await updateUser(id, allowed as Partial<User>, session.orgId);
    if (!updated) {
      return NextResponse.json({ error: '找不到特護' }, { status: 404 });
    }
    return NextResponse.json(safeUser(updated));
  } catch (err) {
    console.error('Nurses PUT error:', err);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    // 檢查是否有關聯的打卡紀錄
    const records = await getClockRecords(session.orgId, { userId: id });
    if (records.length > 0) {
      return NextResponse.json({ error: `此特護有 ${records.length} 筆打卡紀錄，無法刪除` }, { status: 400 });
    }

    await deleteUser(id, session.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Nurses DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
