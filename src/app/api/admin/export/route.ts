import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getRateSettings, getSpecialConditions } from '@/lib/db';
import { formatDateTime, formatCoords, calculateHours, calculateSalary, getSpecialMultiplier, getDayNightHours, calculateNurseSalary } from '@/lib/utils';
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
  try {
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

  // 計算每筆請款金額 + 特護薪資 + 日夜班時數
  const computed = sorted.map(r => {
    const multiplier = getSpecialMultiplier(r.clockInTime, r.clockOutTime, specialConditions);
    const billing = calculateSalary(r.clockInTime, r.clockOutTime, dayRate, nightRate, multiplier);
    const nurseSalary = calculateNurseSalary(billing);
    const { dayHours, nightHours } = getDayNightHours(r.clockInTime, r.clockOutTime);
    const timeRange = `${fmtTime(r.clockInTime)}-${fmtTime(r.clockOutTime)}`;
    const date = fmtDate(r.clockInTime);
    return { ...r, billing, nurseSalary, multiplier, timeRange, date, dayHours, nightHours };
  });

  const wb = XLSX.utils.book_new();

  // ========== Sheet 1: 打卡紀錄（完整明細） ==========
  const detailRows = computed.map(r => ({
    '個案名稱': r.caseName,
    '個案代碼': r.caseCode,
    '特護名稱': r.userName,
    '上班經緯度': formatCoords(r.clockInLat, r.clockInLng),
    '下班經緯度': formatCoords(r.clockOutLat, r.clockOutLng),
    '上班時間': formatDateTime(r.clockInTime),
    '下班時間': formatDateTime(r.clockOutTime),
    '工時(小時)': calculateHours(r.clockInTime, r.clockOutTime),
    '日班時數': r.dayHours,
    '夜班時數': r.nightHours,
    '請款金額': r.billing,
    '特護薪資': r.nurseSalary,
    '倍率': r.multiplier > 1 ? `${r.multiplier}x` : '',
  }));
  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 30 },
    { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, '打卡紀錄');

  // ========== Sheet 2: 簽到表 ==========
  const signRows = computed.map(r => ({
    '個案': r.caseName,
    '日期': r.date,
    '時間': r.timeRange,
    '簽到人': r.userName,
  }));
  const wsSign = XLSX.utils.json_to_sheet(signRows);
  wsSign['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSign, '簽到表');

  // ========== Sheet 3: 請款明細（給客戶看） ==========
  const invoiceRows: Record<string, string | number>[] = computed.map(r => ({
    '個案': r.caseName,
    '日期': r.date,
    '時間': r.timeRange,
    '簽到人': r.userName,
    '日班h': r.dayHours,
    '夜班h': r.nightHours,
    '請款金額': r.billing,
  }));

  // 總和行
  const totalBilling = computed.reduce((sum, r) => sum + r.billing, 0);
  invoiceRows.push({
    '個案': '總和',
    '日期': '',
    '時間': '',
    '簽到人': '',
    '日班h': '',
    '夜班h': '',
    '請款金額': totalBilling,
  });

  const wsInvoice = XLSX.utils.json_to_sheet(invoiceRows);
  wsInvoice['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 6 }, { wch: 6 }, { wch: 12 }];

  // 空兩行後加彙總
  const summaryStartRow = invoiceRows.length + 3;

  // 按特護彙總（用 userId 避免同名合併錯誤）
  const nurseSummaryMap = new Map<string, { name: string; billing: number; nurseSalary: number }>();
  for (const r of computed) {
    const existing = nurseSummaryMap.get(r.userId);
    if (existing) {
      existing.billing += r.billing;
      existing.nurseSalary += r.nurseSalary;
    } else {
      nurseSummaryMap.set(r.userId, { name: r.userName, billing: r.billing, nurseSalary: r.nurseSalary });
    }
  }

  const summaryData: (string | number)[][] = [
    ['特護', '請款金額', '特護薪資(90%)', '總計'],
  ];
  for (const [, { name, billing: bil, nurseSalary: ns }] of nurseSummaryMap) {
    summaryData.push([name, bil, ns, ns]);
  }

  XLSX.utils.sheet_add_aoa(wsInvoice, summaryData, { origin: { r: summaryStartRow, c: 0 } });
  XLSX.utils.book_append_sheet(wb, wsInvoice, '請款明細');

  // ========== Sheet 4: 薪資發放 ==========
  const payrollRows: Record<string, string | number>[] = [];
  for (const [, { name, billing: bil, nurseSalary: ns }] of nurseSummaryMap) {
    payrollRows.push({
      '特護姓名': name,
      '請款金額': bil,
      '特護薪資(90%)': ns,
    });
  }
  const totalNurseSalary = computed.reduce((sum, r) => sum + r.nurseSalary, 0);
  payrollRows.push({
    '特護姓名': '合計',
    '請款金額': totalBilling,
    '特護薪資(90%)': totalNurseSalary,
  });
  const wsPayroll = XLSX.utils.json_to_sheet(payrollRows);
  wsPayroll['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsPayroll, '薪資發放');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="clock_records_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: '匯出失敗' }, { status: 500 });
  }
}
