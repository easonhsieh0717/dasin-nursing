import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords, getAdvanceExpenses } from '@/lib/db';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

import { roundClockIn, roundClockOut, fmtRoundedTime } from '@/lib/utils';

/** 格式化時間為 HHmm-HHmm，上班進位/下班捨去到整點半點 */
function fmtTimeRange(inTime: string | null, outTime: string | null): string {
  if (!inTime && !outTime) return '';
  let inStr = '';
  let outStr = '';
  if (inTime) {
    const { hours, minutes } = roundClockIn(new Date(inTime));
    inStr = fmtRoundedTime(hours, minutes);
  }
  if (outTime) {
    const { hours, minutes } = roundClockOut(new Date(outTime));
    outStr = fmtRoundedTime(hours, minutes);
  }
  return `${inStr}-${outStr}`;
}

/** 格式化日期為 MM/DD */
function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}

/** 格式化完整時間 MM/DD HH:mm */
function fmtFullDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime') || undefined;
    // endTime 加上 T23:59:59 確保包含整天（與畫面篩選一致）
    const rawEnd = searchParams.get('endTime');
    const endTime = rawEnd && !rawEnd.includes('T') ? `${rawEnd}T23:59:59` : (rawEnd || undefined);
    const clockType = searchParams.get('clockType') as 'in' | 'out' | undefined;
    const settlementType = searchParams.get('settlementType') || undefined;
    const caseCode = searchParams.get('caseCode') || undefined;
    const caseName = searchParams.get('caseName') || undefined;
    const userName = searchParams.get('userName') || undefined;

    const records = await getClockRecords(session.orgId, {
      startTime, endTime, clockType, settlementType, caseCode, caseName, userName, fetchAll: true
    });
    const enriched = await enrichRecords(records);

    // 取得已通過的代墊費用（同一時間範圍）
    const expenses = await getAdvanceExpenses(session.orgId, {
      status: 'approved',
      startDate: startTime?.slice(0, 10),
      endDate: rawEnd || undefined,
    });
    // 按 userId 彙總代墊費用
    const expenseByUser = new Map<string, number>();
    for (const e of expenses) {
      expenseByUser.set(e.userId, (expenseByUser.get(e.userId) || 0) + e.amount);
    }

    // 按上班時間排序，使用預算值
    const computed = [...enriched].sort((a, b) => {
      const ta = a.clockInTime ? new Date(a.clockInTime).getTime() : 0;
      const tb = b.clockInTime ? new Date(b.clockInTime).getTime() : 0;
      return ta - tb;
    });

    // ========== 按個案分組 ==========
    const caseGroups = new Map<string, {
      caseName: string;
      caseCode: string;
      records: typeof computed;
    }>();

    for (const r of computed) {
      const key = r.caseId;
      if (!caseGroups.has(key)) {
        caseGroups.set(key, { caseName: r.caseName, caseCode: r.caseCode, records: [] });
      }
      caseGroups.get(key)!.records.push(r);
    }

    // ========== 共用：為一個個案建立 Excel Workbook ==========
    function buildCaseWorkbook(group: { caseName: string; caseCode: string; records: typeof computed }) {
      const wb = XLSX.utils.book_new();

      // --- Table 1: 簽到明細 ---
      const table1Data: (string | number)[][] = [
        ['日期', '計費時段', '簽到人', '上班時間', '下班時間', '請款金額', '特護薪資'],
      ];
      let totalBilling = 0;
      let totalNurseSalary = 0;
      for (const r of group.records) {
        table1Data.push([
          fmtDate(r.clockInTime),
          fmtTimeRange(r.clockInTime, r.clockOutTime),
          r.userName,
          fmtFullDateTime(r.clockInTime),
          fmtFullDateTime(r.clockOutTime),
          r.billing,
          r.nurseSalary,
        ]);
        totalBilling += r.billing;
        totalNurseSalary += r.nurseSalary;
      }
      // 總和行
      table1Data.push(['總和', '', '', '', '', totalBilling, totalNurseSalary]);

      const ws = XLSX.utils.aoa_to_sheet(table1Data);
      ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }];

      // --- Table 2: 特護薪資彙總 (特護, 薪資, 費用, 總計) ---
      // 空兩行後
      const startRow = table1Data.length + 2;

      const nurseSummary = new Map<string, { name: string; salary: number; userId: string }>();
      for (const r of group.records) {
        const existing = nurseSummary.get(r.userId);
        if (existing) {
          existing.salary += r.nurseSalary;
        } else {
          nurseSummary.set(r.userId, { name: r.userName, salary: r.nurseSalary, userId: r.userId });
        }
      }

      const table2Data: (string | number)[][] = [
        ['特護', '薪資', '代墊費用', '總計'],
      ];
      for (const [, { name, salary, userId }] of nurseSummary) {
        const expense = expenseByUser.get(userId) || 0;
        table2Data.push([name, salary, expense, salary + expense]);
      }

      XLSX.utils.sheet_add_aoa(ws, table2Data, { origin: { r: startRow, c: 0 } });
      XLSX.utils.book_append_sheet(wb, ws, '明細');

      return wb;
    }

    // ========== 單一個案 → 直接下載 Excel；多個個案 → ZIP ==========
    if (caseGroups.size === 1) {
      const [, group] = [...caseGroups][0];
      const wb = buildCaseWorkbook(group);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `${group.caseName}_${group.caseCode}.xlsx`;

      return new Response(Buffer.from(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        },
      });
    }

    // 多個個案：ZIP 包含每個個案的 Excel
    const zip = new JSZip();
    for (const [, group] of caseGroups) {
      const wb = buildCaseWorkbook(group);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const fileName = `${group.caseName}_${group.caseCode}.xlsx`;
      zip.file(fileName, buf);
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

    return new Response(Buffer.from(zipBuf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="export_${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: '匯出失敗' }, { status: 500 });
  }
}
