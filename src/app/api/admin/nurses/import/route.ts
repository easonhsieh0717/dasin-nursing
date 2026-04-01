import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUsers, createUser, updateUser, getRateSettings } from '@/lib/db';
import crypto from 'crypto';

/** Generate a random 8-char alphanumeric password for newly imported nurses */
function generateRandomPassword(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars
}

interface ImportItem {
  name: string;
  bank: string;
  accountNo: string;
  accountName: string;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const { items } = await request.json() as { items: ImportItem[] };
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: '資料格式錯誤' }, { status: 400 });
    }

    // 取得最新費率作為預設時薪
    const allRates = await getRateSettings(session.orgId);
    const latestRate = allRates.sort((a, b) =>
      new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
    )[0];
    const defaultRate = latestRate?.mainDayRate ?? 490;

    // 取得目前所有特護
    const { users: existingUsers } = await getUsers(session.orgId);
    const userByName = new Map(existingUsers.map(u => [u.name.trim(), u]));

    let updated = 0;
    let created = 0;
    let skipped = 0;
    const updatedNames: string[] = [];
    const createdNames: string[] = [];
    const skippedNames: string[] = [];

    // 用來產生不重複帳號
    const existingAccounts = new Set(existingUsers.map(u => u.account));
    let accountSeq = existingUsers.length + 1;

    function generateAccount(): string {
      let acc: string;
      do {
        acc = 'N' + String(accountSeq).padStart(3, '0');
        accountSeq++;
      } while (existingAccounts.has(acc));
      existingAccounts.add(acc);
      return acc;
    }

    for (const item of items) {
      const name = (item.name || '').trim();
      if (!name) { skipped++; continue; }

      const existing = userByName.get(name);

      if (existing) {
        // 已存在 → 更新銀行資訊
        await updateUser(existing.id, {
          bank: item.bank || existing.bank,
          accountNo: item.accountNo || existing.accountNo,
          accountName: item.accountName || existing.accountName,
        });
        updated++;
        updatedNames.push(name);
      } else {
        // 新特護 → 建立帳號
        const account = generateAccount();
        await createUser({
          orgId: session.orgId,
          name,
          account,
          password: generateRandomPassword(),
          role: 'employee',
          hourlyRate: defaultRate,
          bank: item.bank || '',
          accountNo: item.accountNo || '',
          accountName: item.accountName || '',
        });
        created++;
        createdNames.push(name);
        // 避免重複 name 被建立多次
        userByName.set(name, { id: '', orgId: session.orgId, name, account, password: '0000', role: 'employee', hourlyRate: defaultRate });
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      created,
      skipped,
      defaultRate,
      updatedNames: updatedNames.slice(0, 20),
      createdNames: createdNames.slice(0, 20),
      totalImported: updated + created,
    });
  } catch (err) {
    console.error('Nurses import error:', err);
    return NextResponse.json({ error: '匯入失敗' }, { status: 500 });
  }
}
