import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getUsers, getAdvanceExpenses, getCases } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;

    if (!caseId) {
      return NextResponse.json({ error: '請先選擇個案' }, { status: 400 });
    }

    const filters: Record<string, string | boolean | undefined> = { caseId, fetchAll: true };
    if (startTime) filters.startTime = startTime;
    if (endTime) filters.endTime = endTime;

    const records = await getClockRecords(session.orgId, filters);
    const enriched = await enrichRecords(records);

    // 取得所有特護（含銀行資訊）
    const { users } = await getUsers(session.orgId);
    const userMap = new Map(users.map(u => [u.id, u]));

    // 取得個案資訊
    const allCases = await getCases(session.orgId);
    const targetCase = allCases.find(c => c.id === caseId);
    const caseName = targetCase?.name || '未知';

    // 使用預算值
    const computed = enriched;

    // 查詢期間已核准的代墊費用（限定個案）
    const expenseFilters: Record<string, string> = { status: 'approved', caseId };
    if (startTime) expenseFilters.startDate = startTime;
    if (endTime) expenseFilters.endDate = endTime;
    const approvedExpenses = await getAdvanceExpenses(session.orgId, expenseFilters);

    // 按特護彙總代墊費用
    const expenseByUser = new Map<string, number>();
    for (const exp of approvedExpenses) {
      expenseByUser.set(exp.userId, (expenseByUser.get(exp.userId) || 0) + exp.amount);
    }

    // 按特護彙總
    const summaryMap = new Map<string, { name: string; userId: string; totalBilling: number; totalSalary: number; shifts: number; bank: string; accountNo: string; accountName: string; isPostOffice: boolean; caseNames: Set<string>; note: string; advanceExpenseTotal: number }>();

    for (const r of computed) {
      const existing = summaryMap.get(r.userId);
      const user = userMap.get(r.userId);
      if (existing) {
        existing.totalBilling += r.billing;
        existing.totalSalary += r.nurseSalary;
        existing.shifts += 1;
        existing.caseNames.add(r.caseName);
      } else {
        summaryMap.set(r.userId, {
          name: r.userName,
          userId: r.userId,
          totalBilling: r.billing,
          totalSalary: r.nurseSalary,
          shifts: 1,
          bank: user?.bank || '',
          accountNo: user?.accountNo || '',
          accountName: user?.accountName || '',
          isPostOffice: (user?.bank || '').includes('郵局') || (user?.bank || '').includes('郵政'),
          caseNames: new Set([r.caseName]),
          note: user?.note || '',
          advanceExpenseTotal: 0,
        });
      }
    }

    // 帶入代墊費用
    for (const [userId, expTotal] of expenseByUser) {
      const existing = summaryMap.get(userId);
      if (existing) {
        existing.advanceExpenseTotal = expTotal;
      }
    }

    const summary = Array.from(summaryMap.values()).map(s => ({
      ...s,
      caseNames: [...s.caseNames],
    }));
    const totalAmount = summary.reduce((sum, s) => sum + s.totalSalary, 0);
    const totalBilling = summary.reduce((sum, s) => sum + s.totalBilling, 0);
    const totalAdvanceExpenses = summary.reduce((sum, s) => sum + s.advanceExpenseTotal, 0);
    const postOfficeItems = summary.filter(s => s.isPostOffice);
    const bankItems = summary.filter(s => !s.isPostOffice);

    // 取得所有紀錄 ID 及發放狀態
    const recordIds = records.map(r => r.id);
    const paidCount = records.filter(r => r.paidAt).length;
    const unpaidCount = records.length - paidCount;

    return NextResponse.json({
      caseName,
      summary,
      totalAmount,
      totalBilling,
      totalAdvanceExpenses,
      postOfficeCount: postOfficeItems.length,
      postOfficeAmount: postOfficeItems.reduce((sum, s) => sum + s.totalSalary, 0),
      bankCount: bankItems.length,
      bankAmount: bankItems.reduce((sum, s) => sum + s.totalSalary, 0),
      recordIds,
      paidCount,
      unpaidCount,
    });
  } catch (err) {
    console.error('Payroll GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
