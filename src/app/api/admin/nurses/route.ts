import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUsers, createUser, updateUser, deleteUser, getClockRecords } from '@/lib/db';
import { paginate } from '@/lib/utils';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const search = searchParams.get('search') || undefined;
  const all = searchParams.get('all');

  const users = await getUsers(session.orgId, search);

  if (all === 'true') {
    return NextResponse.json({ data: users, total: users.length });
  }

  return NextResponse.json(paginate(users, page, pageSize));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const body = await request.json();
  const user = await createUser({
    orgId: session.orgId,
    name: body.name,
    account: body.account,
    password: body.password,
    role: 'employee',
    hourlyRate: body.hourlyRate || 200,
  });

  return NextResponse.json(user);
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...data } = body;
  const updated = await updateUser(id, data);
  if (!updated) {
    return NextResponse.json({ error: '找不到特護' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
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

  await deleteUser(id);
  return NextResponse.json({ success: true });
}
