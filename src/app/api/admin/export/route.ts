import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords } from '@/lib/db';
import { formatDateTime, formatCoords, calculateHours } from '@/lib/utils';
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

  const rows = enriched.map(r => ({
    '個案名稱': r.caseName,
    '特護名稱': r.userName,
    '上班經緯度': formatCoords(r.clockInLat, r.clockInLng),
    '下班經緯度': formatCoords(r.clockOutLat, r.clockOutLng),
    '上班時間': formatDateTime(r.clockInTime),
    '下班時間': formatDateTime(r.clockOutTime),
    '工時(小時)': calculateHours(r.clockInTime, r.clockOutTime),
    '薪資': r.salary,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 30 },
    { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 },
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
