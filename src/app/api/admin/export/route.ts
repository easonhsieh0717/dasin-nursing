import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getRateSettings, getSpecialConditions } from '@/lib/db';
import { calculateSalary, getSpecialMultiplier } from '@/lib/utils';
import * as XLSX from 'xlsx';

/** 格式化時間為 HHmm (e.g. "0900") */
function fmtTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
}

/** 格式化日期為 MM/DD */
function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}

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

  // 取得最新費率設定
  const allRates = await getRateSettings(session.orgId);
  const latestRate = allRates.sort((a, b) =>
    new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
  )[0];
  const specialConditions = await getSpecialConditions(session.orgId);

  const dayRate = latestRate?.mainDayRate ?? 490;
  const nightRate = latestRate?.mainNightRate ?? 530;

  // 按上班時間排序
  const sorted = [...enriched].sort((a, b) => {
    const ta = a.clockInTime ? new Date(a.clockInTime).getTime() : 0;
    const tb = b.clockInTime ? new Date(b.clockInTime).getTime() : 0;
    return ta - tb;
  });

  // 計算每筆薪資
  const computed = sorted.map(r => {
    const multiplier = getSpecialMultiplier(r.clockInTime, r.clockOutTime, specialConditions);
    const salary = calculateSalary(r.clockInTime, r.clockOutTime, dayRate, nightRate, multiplier);
    const timeRange = `${fmtTime(r.clockInTime)}-${fmtTime(r.clockOutTime)}`;
    const date = fmtDate(r.clockInTime);
    return { ...r, salary, multiplier, timeRange, date };
  });

  const wb = XLSX.utils.book_new();

  // ========== Sheet 1: 簽到表 ==========
  const signRows = computed.map(r => ({
    '日期': r.date,
    '時間': r.timeRange,
    '簽到人': r.userName,
  }));
  const ws1 = XLSX.utils.json_to_sheet(signRows);
  ws1['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, '簽到表');

  // ========== Sheet 2: 請款明細 + 薪資彙總 ==========
  const invoiceRows: Record<string, string | number>[] = computed.map(r => ({
    '日期': r.date,
    '時間': r.timeRange,
    '簽到人': r.userName,
    '金額': r.salary,
  }));

  // 總和行
  const totalSalary = computed.reduce((sum, r) => sum + r.salary, 0);
  invoiceRows.push({
    '日期': '總和',
    '時間': '',
    '簽到人': '',
    '金額': totalSalary,
  });

  const ws2 = XLSX.utils.json_to_sheet(invoiceRows);
  ws2['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];

  // 空兩行後加薪資彙總
  const summaryStartRow = invoiceRows.length + 3; // +1 header +1 data rows + 1 blank

  // 薪資彙總表頭
  const summaryHeader = { '特護': '特護', '薪資': '薪資', '費用': '費用', '總計': '總計' };
  // 按特護彙總
  const nurseSalaryMap = new Map<string, number>();
  for (const r of computed) {
    nurseSalaryMap.set(r.userName, (nurseSalaryMap.get(r.userName) || 0) + r.salary);
  }

  // 手動寫入薪資彙總到同一個 sheet
  const summaryData: (string | number)[][] = [
    ['特護', '薪資', '費用', '總計'],
  ];
  for (const [name, sal] of nurseSalaryMap) {
    summaryData.push([name, sal, '', sal]);
  }

  // 寫入彙總到 sheet2 的指定位置
  XLSX.utils.sheet_add_aoa(ws2, summaryData, { origin: { r: summaryStartRow, c: 0 } });

  XLSX.utils.book_append_sheet(wb, ws2, '請款明細');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clock_records_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
