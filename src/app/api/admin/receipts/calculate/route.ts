import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, getAdvanceExpenses } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!caseId || !startDate || !endDate) {
      return NextResponse.json({ error: '缺少必要參數（caseId, startDate, endDate）' }, { status: 400 });
    }

    // 取得打卡紀錄（使用預算值）
    const records = await getClockRecords(session.orgId, {
      caseId,
      startTime: startDate,
      endTime: endDate,
      fetchAll: true,
    });

    // 使用預算 billing 計算
    let totalAmount = 0;
    const details: Array<{ date: string; hours: number; amount: number }> = [];

    for (const r of records) {
      if (!r.clockInTime || !r.clockOutTime) continue;
      const amount = r.billing || 0;
      totalAmount += amount;

      const diffMs = new Date(r.clockOutTime).getTime() - new Date(r.clockInTime).getTime();
      const hours = Math.round((diffMs / 3600000) * 10) / 10;

      details.push({
        date: r.clockInTime.slice(0, 10),
        hours,
        amount,
      });
    }

    // 計算服務天數（不重複日期數）
    const uniqueDays = new Set(details.map(d => d.date));

    // 查詢該個案+期間的已核准代墊費用
    const approvedExpenses = await getAdvanceExpenses(session.orgId, {
      caseId,
      status: 'approved',
      startDate,
      endDate,
    });

    const TYPE_LABELS: Record<string, string> = { meal: '餐費', transport: '車資', advance: '代墊費', other: '其它' };
    const expenseByType: Record<string, number> = {};
    let advanceExpenseTotal = 0;
    for (const exp of approvedExpenses) {
      const label = TYPE_LABELS[exp.expenseType] || exp.expenseType;
      expenseByType[label] = (expenseByType[label] || 0) + exp.amount;
      advanceExpenseTotal += exp.amount;
    }

    return NextResponse.json({
      serviceDays: uniqueDays.size,
      serviceAmount: totalAmount,
      records: details,
      advanceExpenses: expenseByType,
      advanceExpenseTotal,
    });
  } catch (err) {
    console.error('Receipt calculate error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
