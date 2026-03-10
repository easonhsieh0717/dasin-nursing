import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCases, createCase, updateCase, deleteCase, getClockRecords } from '@/lib/db';
import { paginate } from '@/lib/utils';

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

    const cases = await getCases(session.orgId, search);

    if (all === 'true') {
      return NextResponse.json({ data: cases, total: cases.length });
    }

    return NextResponse.json(paginate(cases, page, pageSize));
  } catch (err) {
    console.error('Cases GET error:', err);
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
    const newCase = await createCase({
      orgId: session.orgId,
      name: body.name,
      code: body.code,
      caseType: body.caseType || '一般',
      settlementType: body.settlementType || '週',
    });

    return NextResponse.json(newCase);
  } catch (err) {
    console.error('Cases POST error:', err);
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
    const updated = await updateCase(id, data);
    if (!updated) {
      return NextResponse.json({ error: '找不到個案' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Cases PUT error:', err);
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
    const records = await getClockRecords(session.orgId, { caseId: id });
    if (records.length > 0) {
      return NextResponse.json({ error: `此個案有 ${records.length} 筆打卡紀錄，無法刪除` }, { status: 400 });
    }

    await deleteCase(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cases DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
