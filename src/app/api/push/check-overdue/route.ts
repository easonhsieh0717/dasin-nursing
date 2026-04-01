import { NextResponse } from 'next/server';
import { getOverdueClockRecords, getPushSubscriptionsByUserIds } from '@/lib/db';
import { supabase, isSupabase } from '@/lib/supabase';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@dasin-nursing.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export async function GET(request: Request) {
  try {
    // 驗證 Cron Secret（Vercel Cron 自動帶 Authorization header）
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // 查詢超過 8 小時未下班的打卡紀錄
    const overdueRecords = await getOverdueClockRecords(8);

    if (overdueRecords.length === 0) {
      return NextResponse.json({ message: '沒有超時紀錄', sent: 0 });
    }

    // 取得需要通知的 userId 列表（去重）
    const userIds = [...new Set(overdueRecords.map(r => r.userId))];

    // 查詢這些使用者的推播訂閱
    const subscriptions = await getPushSubscriptionsByUserIds(userIds);

    if (subscriptions.length === 0) {
      return NextResponse.json({ message: '沒有可用的推播訂閱', overdueCount: overdueRecords.length, sent: 0 });
    }

    // 逐一發送推播通知
    let sent = 0;
    let failed = 0;
    for (const sub of subscriptions) {
      try {
        const record = overdueRecords.find(r => r.userId === sub.userId);
        const hours = record
          ? Math.floor((Date.now() - new Date(record.clockInTime!).getTime()) / 3600000)
          : 8;

        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify({
            title: '達心打卡提醒',
            body: `你已上班超過 ${hours} 小時，請記得打卡下班！`,
          })
        );
        sent++;
      } catch (err) {
        console.error('Push send error for user', sub.userId, err);
        failed++;
      }
    }

    // === 代墊費用圖片自動清理（核准超過 30 天）===
    let cleanedImages = 0;
    if (isSupabase) {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: expiredExpenses } = await supabase
          .from('advance_expenses')
          .select('id, image_url')
          .eq('status', 'approved')
          .lt('reviewed_at', thirtyDaysAgo)
          .not('image_url', 'is', null)
          .neq('image_url', '');

        if (expiredExpenses && expiredExpenses.length > 0) {
          for (const exp of expiredExpenses) {
            try {
              // 從 storage 刪除圖片
              const storagePath = exp.image_url;
              if (storagePath && !storagePath.startsWith('data:')) {
                await supabase.storage.from('expense-images').remove([storagePath]);
              }
              // 清除 DB 中的 image_url
              await supabase.from('advance_expenses').update({ image_url: '' }).eq('id', exp.id);
              cleanedImages++;
            } catch (e) {
              console.error('Image cleanup error for expense', exp.id, e);
            }
          }
        }
      } catch (e) {
        console.error('Image cleanup query error:', e);
      }
    }

    return NextResponse.json({
      message: '推播通知已處理',
      overdueCount: overdueRecords.length,
      sent,
      failed,
      cleanedImages,
    });
  } catch (err) {
    console.error('Check overdue error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
