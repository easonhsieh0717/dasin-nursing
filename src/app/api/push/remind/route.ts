import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { findAnyOpenClockRecord, getPushSubscriptionsByUserIds } from '@/lib/db';
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

/**
 * 前端定時呼叫此端點（測試：每 2 分鐘一次）
 * 如果該使用者有未下班的打卡紀錄，就發送推播通知提醒下班
 */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // 檢查是否有未下班的紀錄
    const openRecord = await findAnyOpenClockRecord(session.userId);
    if (!openRecord) {
      return NextResponse.json({ reminded: false, reason: '沒有未下班紀錄' });
    }

    // 計算已經上班多久
    const elapsed = Date.now() - new Date(openRecord.clockInTime!).getTime();
    const hours = Math.floor(elapsed / 3600000);
    const mins = Math.floor((elapsed % 3600000) / 60000);

    // 取得使用者的推播訂閱
    const subscriptions = await getPushSubscriptionsByUserIds([session.userId]);
    if (subscriptions.length === 0) {
      return NextResponse.json({ reminded: false, reason: '沒有推播訂閱' });
    }

    // 發送推播通知
    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify({
            title: '達心打卡提醒',
            body: `你已上班 ${hours} 小時 ${mins} 分鐘，請記得打卡下班！`,
          })
        );
        sent++;
      } catch (err) {
        console.error('Push remind error:', err);
      }
    }

    return NextResponse.json({ reminded: true, sent, elapsed: `${hours}h${mins}m` });
  } catch (err) {
    console.error('Push remind error:', err);
    return NextResponse.json({ error: '系統錯誤' }, { status: 500 });
  }
}
