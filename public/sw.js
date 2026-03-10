// Service Worker — 只處理推播通知，不攔截 fetch（不影響現有功能）

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '達心打卡提醒', {
      body: data.body || '你有未完成的打卡紀錄，請記得打卡下班',
      icon: '/next.svg',
      badge: '/next.svg',
      data: { url: '/clock' },
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/clock')
  );
});
