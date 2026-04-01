import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAdvanceExpenses, createAdvanceExpense } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '未登入' }, { status: 401 });
    const data = await getAdvanceExpenses(session.orgId, { userId: session.userId });
    // 為圖片產生 signed URL
    const enriched = await Promise.all(data.map(async (item) => {
      if (item.imageUrl && !item.imageUrl.startsWith('data:') && !item.imageUrl.startsWith('http') && isSupabase) {
        const { data: signedData } = await supabase.storage.from('expense-images').createSignedUrl(item.imageUrl, 3600);
        return { ...item, imageUrl: signedData?.signedUrl || item.imageUrl };
      }
      return item;
    }));
    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error('Expenses GET error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: '未登入' }, { status: 401 });

    const formData = await request.formData();
    const caseId = formData.get('caseId') as string;
    const expenseType = formData.get('expenseType') as string;
    const amount = parseInt(formData.get('amount') as string) || 0;
    const description = (formData.get('description') as string) || '';
    const expenseDate = formData.get('expenseDate') as string;
    const image = formData.get('image') as File | null;

    if (!caseId) return NextResponse.json({ error: '請選擇個案' }, { status: 400 });
    if (!['meal', 'transport', 'advance', 'other'].includes(expenseType)) {
      return NextResponse.json({ error: '請選擇費用類型' }, { status: 400 });
    }
    if (amount <= 0) return NextResponse.json({ error: '請輸入正確金額' }, { status: 400 });
    if (!expenseDate) return NextResponse.json({ error: '請選擇日期' }, { status: 400 });

    // Handle image upload
    let imageUrl = '';
    if (image && image.size > 0) {
      if (image.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: '圖片大小不可超過 4MB' }, { status: 400 });
      }
      if (isSupabase) {
        const ext = image.name.split('.').pop() || 'jpg';
        const fileName = `${session.orgId}/${session.userId}/${Date.now()}.${ext}`;
        const buffer = Buffer.from(await image.arrayBuffer());
        const { error: uploadErr } = await supabase.storage
          .from('expense-images')
          .upload(fileName, buffer, { contentType: image.type });
        if (!uploadErr) {
          imageUrl = fileName; // 存儲路徑，GET 時再產生 signed URL
        }
      } else {
        const buffer = Buffer.from(await image.arrayBuffer());
        imageUrl = `data:${image.type};base64,${buffer.toString('base64')}`;
      }
    }

    const req = await createAdvanceExpense({
      orgId: session.orgId,
      userId: session.userId,
      caseId,
      expenseType: expenseType as 'meal' | 'transport' | 'advance' | 'other',
      amount,
      description,
      imageUrl: imageUrl || null,
      expenseDate,
    });

    return NextResponse.json(req);
  } catch (err) {
    console.error('Expenses POST error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
