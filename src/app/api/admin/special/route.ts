import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSpecialConditions, createSpecialCondition, updateSpecialCondition, deleteSpecialCondition } from '@/lib/db';

const SPECIAL_TYPES = ['過年', '颱風', '國定假日', '特殊加班', '其他'];

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const types = searchParams.get('types');

    if (types === 'true') {
      return NextResponse.json({ types: SPECIAL_TYPES });
    }

    const conditions = await getSpecialConditions(session.orgId);
    return NextResponse.json({ data: conditions });
  } catch (err) {
    console.error('Special GET error:', err);
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
    const sc = await createSpecialCondition({
      orgId: session.orgId,
      name: body.name,
      target: body.target || session.orgCode,
      multiplier: body.multiplier || 2,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    return NextResponse.json(sc);
  } catch (err) {
    console.error('Special POST error:', err);
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
    const updated = await updateSpecialCondition(id, data);
    if (!updated) {
      return NextResponse.json({ error: '找不到紀錄' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Special PUT error:', err);
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

    await deleteSpecialCondition(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Special DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
