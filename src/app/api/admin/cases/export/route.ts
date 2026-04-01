import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCases } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const cases = await getCases(session.orgId);

    const wb = XLSX.utils.book_new();
    const data: (string | number)[][] = [
      ['個案名稱', '個案代碼', '資費地區', '偏遠補貼', '結算型態'],
    ];

    for (const c of cases) {
      data.push([
        c.name,
        c.code,
        c.caseType,
        c.remoteSubsidy ? '是' : '否',
        c.settlementType,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, '個案名冊');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `個案名冊_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (err) {
    console.error('Cases export error:', err);
    return NextResponse.json({ error: '匯出失敗' }, { status: 500 });
  }
}
