import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createClockRecord, findOpenClockRecord, findAnyOpenClockRecord, updateClockRecord, getCases, getRateSettings, getSpecialConditions } from '@/lib/db';
import { calculateSalary, getSpecialMultiplier } from '@/lib/utils';

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

      const cases = await getCases(session.orgId);
      const targetCaseId = caseId || cases[0]?.id;
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

      // 計算請款金額並存入資料庫（salary 欄位存的是客戶請款金額，特護薪資 = 請款 × 0.9，在顯示時計算）
      let salary = 0;
      try {
        const allRates = await getRateSettings(session.orgId);
        const latestRate = allRates.sort((a, b) =>
          new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
        )[0];
        const dayRate = latestRate?.mainDayRate ?? 490;
        const nightRate = latestRate?.mainNightRate ?? 530;
        const specialConditions = await getSpecialConditions(session.orgId);
        const multiplier = getSpecialMultiplier(openRecord.clockInTime, clockOutTime, specialConditions);
        salary = calculateSalary(openRecord.clockInTime, clockOutTime, dayRate, nightRate, multiplier);
      } catch {
        // 薪資計算失敗不影響打卡
      }

      const updated = await updateClockRecord(openRecord.id, {
        clockOutTime,
        clockOutLat: lat || null,
        clockOutLng: lng || null,
        salary,
      });

      return NextResponse.json({ success: true, record: updated });
    }

    return NextResponse.json({ error: '無效的打卡類型' }, { status: 400 });
  } catch (err) {
    console.error('Clock API error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
