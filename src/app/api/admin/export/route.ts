import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getRateSettings, getSpecialConditions } from '@/lib/db';
import { formatDateTime, formatCoords, calculateHours, calculateSalary, getSpecialMultiplier } from '@/lib/utils';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startTime = searchParams.get('startTime') || undefined;
  const endTime = searchParams.get('endTime') || undefined;
  const clockType = searchParams.get('clockType') as 'in' | 'out' | undefined;
  const settlementType = searchParams.get('settlementType') || undefined;
  const caseCode = searchParams.get('caseCode') || undefined;
  const caseName = searchParams.get('caseName') || undefined;
  const userName = searchParams.get('userName') || undefined;

  const records = await getClockRecords(session.orgId, {
    startTime, endTime, clockType, settlementType, caseCode, caseName, userName
  });
  const enriched = await enrichRecords(records);

  // 取得最新費率設定（依生效日期排序取最新）
  const allRates = await getRateSettings(session.orgId);
  const latestRate = allRates.sort((a, b) =>
    new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
  )[0];

  // 取得所有特殊狀況
  const specialConditions = await getSpecialConditions(session.orgId);

  // 預設費率（無設定時使用）
  const dayRate = latestRate?.mainDayRate ?? 490;
  const nightRate = latestRate?.mainNightRate ?? 530;

  const rows = enriched.map(r => {
    // 計算特殊倍率
    const multiplier = getSpecialMultiplier(r.clockInTime, r.clockOutTime, specialConditions);
    // 自動計算薪資
    const calculatedSalary = calculateSalary(r.clockInTime, r.clockOutTime, dayRate, nightRate, multiplier);

    return {
      '個案名稱': r.caseName,
      '特護名稱': r.userName,
      '上班經緯度': formatCoords(r.clockInLat, r.clockInLng),
      '下班經緯度': formatCoords(r.clockOutLat, r.clockOutLng),
      '上班時間': formatDateTime(r.clockInTime),
      '下班時間': formatDateTime(r.clockOutTime),
      '工時(小時)': calculateHours(r.clockInTime, r.clockOutTime),
      '薪資': calculatedSalary,
      '倍率': multiplier > 1 ? `${multiplier}x` : '',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 30 },
    { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '打卡紀錄');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clock_records_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
