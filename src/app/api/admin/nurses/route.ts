import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUsers, createUser, updateUser, deleteUser, getClockRecords } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || undefined;
    const all = searchParams.get('all');

    if (all === 'true') {
      const { users, total } = await getUsers(session.orgId, search);
      return NextResponse.json({ data: users, total });
    }

    const { users, total } = await getUsers(session.orgId, search, page, pageSize);
    const totalPages = Math.ceil(total / pageSize);
    return NextResponse.json({ data: users, total, totalPages });
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
    const user = await createUser({
      orgId: session.orgId,
      name: body.name,
      account: body.account,
      password: body.password,
      role: 'employee',
      hourlyRate: body.hourlyRate || 200,
      bank: body.bank || '',
      accountNo: body.accountNo || '',
      accountName: body.accountName || '',
      defaultCaseId: body.defaultCaseId || undefined,
      note: body.note || '',
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error('Nurses POST error:', err);
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
    const { id, ...data } = body;
    const updated = await updateUser(id, data);
    if (!updated) {
      return NextResponse.json({ error: '找不到特護' }, { status: 404 });
    }
    return NextResponse.json(updated);
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

    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Nurses DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
