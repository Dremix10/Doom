// Service worker for Doom Web Push. On iOS this runs only when the app has been
// added to the Home Screen (iOS 16.4+). It shows the nudge/pull-out as a system
// notification and focuses the app when tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) {}
  const title = data.title || 'Doom';
  const body = data.body || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: data.kind || 'nudge',
      data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
