import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUsers } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { users } = await getUsers(session.orgId);

    const wb = XLSX.utils.book_new();
    const data: (string | number)[][] = [
      ['特護名稱', '帳號', '時薪', '銀行', '銀行帳號', '帳戶名', '備註'],
    ];

    for (const u of users) {
      data.push([
        u.name,
        u.account,
        u.hourlyRate,
        u.bank || '',
        u.accountNo || '',
        u.accountName || '',
        u.note || '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, '特護名冊');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `特護名冊_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(Buffer.from(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (err) {
    console.error('Nurses export error:', err);
    return NextResponse.json({ error: '匯出失敗' }, { status: 500 });
  }
}
