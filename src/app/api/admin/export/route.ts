import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getClockRecords, enrichRecords } from '@/lib/db';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

/** 格式化時間為 HHmm-HHmm (e.g. "0900-1800") */
function fmtTimeRange(inTime: string | null, outTime: string | null): string {
  const fmt = (s: string | null) => {
    if (!s) return '';
    const d = new Date(s);
    return String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  };
  return `${fmt(inTime)}-${fmt(outTime)}`;
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
      startTime, endTime, clockType, settlementType, caseCode, caseName, userName, fetchAll: true
    });
    const enriched = await enrichRecords(records);

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

      // --- Table 1: 簽到明細 (日期, 時間, 簽到人, 金額) ---
      const table1Data: (string | number)[][] = [
        ['日期', '時間', '簽到人', '金額'],
      ];
      let totalBilling = 0;
      for (const r of group.records) {
        table1Data.push([
          fmtDate(r.clockInTime),
          fmtTimeRange(r.clockInTime, r.clockOutTime),
          r.userName,
          r.billing,
        ]);
        totalBilling += r.billing;
      }
      // 總和行
      table1Data.push(['總和', '', '', totalBilling]);

      const ws = XLSX.utils.aoa_to_sheet(table1Data);
      ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];

      // --- Table 2: 特護薪資彙總 (特護, 薪資, 費用, 總計) ---
      // 空兩行後
      const startRow = table1Data.length + 2;

      const nurseSummary = new Map<string, { name: string; salary: number }>();
      for (const r of group.records) {
        const existing = nurseSummary.get(r.userId);
        if (existing) {
          existing.salary += r.nurseSalary;
        } else {
          nurseSummary.set(r.userId, { name: r.userName, salary: r.nurseSalary });
        }
      }

      const table2Data: (string | number)[][] = [
        ['特護', '薪資', '費用', '總計'],
      ];
      for (const [, { name, salary }] of nurseSummary) {
        table2Data.push([name, salary, '', salary]);
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
