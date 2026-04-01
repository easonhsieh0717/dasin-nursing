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

    // Handle image upload with security validation
    let imageUrl = '';
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAGIC_BYTES: Record<string, number[]> = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
    };
    if (image && image.size > 0) {
      if (image.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: '圖片大小不可超過 4MB' }, { status: 400 });
      }
      if (!ALLOWED_TYPES.includes(image.type)) {
        return NextResponse.json({ error: '僅接受 JPG/PNG/WebP/GIF 圖片格式' }, { status: 400 });
      }
      const buffer = Buffer.from(await image.arrayBuffer());
      // Validate magic bytes to prevent disguised file uploads
      const header = Array.from(buffer.slice(0, 8));
      const isValidMagic = Object.values(MAGIC_BYTES).some(magic =>
        magic.every((b, i) => header[i] === b)
      );
      if (!isValidMagic) {
        return NextResponse.json({ error: '檔案內容非有效圖片，請上傳正確的圖片檔案' }, { status: 400 });
      }
      if (isSupabase) {
        const ext = image.name.split('.').pop()?.toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
        const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
        const fileName = `${session.orgId}/${session.userId}/${Date.now()}.${safeExt}`;
        const { error: uploadErr } = await supabase.storage
          .from('expense-images')
          .upload(fileName, buffer, { contentType: image.type });
        if (!uploadErr) {
          imageUrl = fileName;
        }
      } else {
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
