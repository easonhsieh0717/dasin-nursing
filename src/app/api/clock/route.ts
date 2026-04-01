import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createClockRecord, findOpenClockRecord, findAnyOpenClockRecord, updateClockRecord, getUserById, getCases } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const { type, lat, lng, caseId } = await request.json();

    if (type === 'in') {
      // 防呆：有未關閉的打卡紀錄 → 禁止再上班打卡
      const existingOpen = await findAnyOpenClockRecord(session.userId);
      if (existingOpen) {
        const d = new Date(existingOpen.clockInTime!);
        const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return NextResponse.json(
          { error: `你有未完成的打卡紀錄（上班時間：${timeStr}），請先打卡下班` },
          { status: 400 }
        );
      }

      // 使用使用者指定的個案
      const user = await getUserById(session.userId);
      const cases = await getCases(session.orgId);
      const targetCaseId = caseId || user?.defaultCaseId || cases[0]?.id;
      if (!targetCaseId) {
        return NextResponse.json({ error: '沒有可用的個案' }, { status: 400 });
      }

      const record = await createClockRecord({
        orgId: session.orgId,
        userId: session.userId,
        caseId: targetCaseId,
        clockInTime: new Date().toISOString(),
        clockInLat: lat || null,
        clockInLng: lng || null,
        clockOutTime: null,
        clockOutLat: null,
        clockOutLng: null,
        salary: 0,
        paidAt: null,
        billing: 0, nurseSalary: 0, dayHours: 0, nightHours: 0,
      });

      return NextResponse.json({ success: true, record });
    }

    if (type === 'out') {
      let openRecord = null;

      // 優先使用前端傳入的 caseId 找打卡紀錄
      if (caseId) {
        openRecord = await findOpenClockRecord(session.userId, caseId);
      }

      // 若未找到，查找任意未關閉的打卡紀錄
      if (!openRecord) {
        openRecord = await findAnyOpenClockRecord(session.userId) || null;
      }

      if (!openRecord) {
        return NextResponse.json({ error: '找不到上班打卡紀錄' }, { status: 400 });
      }

      const clockOutTime = new Date().toISOString();

      // 計算請款金額並存入資料庫
      let billingResult = { billing: 0, nurseSalary: 0, dayHours: 0, nightHours: 0 };
      try {
        const { computeBilling, loadBillingContext } = await import('@/lib/billing');
        const ctx = await loadBillingContext(session.orgId);
        const targetCase = ctx.cases.find(c => c.id === openRecord!.caseId);
        const nurse = await getUserById(session.userId);
        billingResult = computeBilling(
          openRecord.clockInTime, clockOutTime, 0,
          targetCase?.caseType || '主要地區',
          targetCase?.remoteSubsidy ?? false,
          ctx.latestRate, ctx.specialConditions,
          nurse?.hourlyRate ?? 0,
        );
      } catch {
        // 薪資計算失敗不影響打卡
      }

      const updated = await updateClockRecord(openRecord.id, {
        clockOutTime,
        clockOutLat: lat || null,
        clockOutLng: lng || null,
        salary: billingResult.billing,
        billing: billingResult.billing,
        nurseSalary: billingResult.nurseSalary,
        dayHours: billingResult.dayHours,
        nightHours: billingResult.nightHours,
      });

      return NextResponse.json({ success: true, record: updated });
    }

    return NextResponse.json({ error: '無效的打卡類型' }, { status: 400 });
  } catch (err) {
    console.error('Clock API error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
