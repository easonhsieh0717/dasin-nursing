import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getReceipts, getNextSerialNumber, createReceipt, updateReceipt, deleteReceipt } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const receipts = await getReceipts(session.orgId, { caseId, startDate, endDate });
    return NextResponse.json({ data: receipts });
  } catch (err) {
    console.error('Receipts GET error:', err);
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
    const serialNumber = await getNextSerialNumber(session.orgId);

    const receipt = await createReceipt({
      orgId: session.orgId,
      serialNumber,
      caseId: body.caseId,
      recipientName: body.recipientName,
      serviceLocation: body.serviceLocation || '',
      serviceStartDate: body.serviceStartDate,
      serviceEndDate: body.serviceEndDate,
      serviceDays: body.serviceDays || 0,
      serviceAmount: body.serviceAmount || 0,
      transportationFee: body.transportationFee || 0,
      advanceExpenseTotal: body.advanceExpenseTotal || 0,
      advanceExpenseItems: body.advanceExpenseItems || '[]',
      totalAmount: body.totalAmount || 0,
      dispatchCompany: body.dispatchCompany || '達心特護',
      receiptDate: body.receiptDate || new Date().toISOString().slice(0, 10),
      note: body.note || '',
      status: 'active',
    });

    return NextResponse.json(receipt);
  } catch (err) {
    console.error('Receipts POST error:', err);
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
    const updated = await updateReceipt(id, data, session.orgId);
    if (!updated) {
      return NextResponse.json({ error: '找不到收據' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Receipts PUT error:', err);
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

    await deleteReceipt(id, session.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Receipts DELETE error:', err);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}
