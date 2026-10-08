// Firebase Messaging Service Worker
// Handles background push notifications when the app tab is closed or not focused.
// Firebase expects this file at exactly /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ─── Firebase config (must be hardcoded here — no Vite env access in SW) ──────
firebase.initializeApp({
  apiKey: "AIzaSyD0CqrcfCSFLo7AqaeArFRV3tYEZGt6ZBo",
  authDomain: "mutiny-talent-e8de9.firebaseapp.com",
  projectId: "mutiny-talent-e8de9",
  storageBucket: "mutiny-talent-e8de9.firebasestorage.app",
  messagingSenderId: "802906432268",
  appId: "1:802906432268:web:51026b17da8b5e8b491f29",
  measurementId: "G-ZBSP1V6094",
});

const messaging = firebase.messaging();

// ─── Background message handler ───────────────────────────────────────────────
// Called when app is in background / tab is closed.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Mutiny';
  const body = payload.notification?.body || payload.data?.body || 'You have a new notification.';
  const icon = '/favicon.ico';
  const badge = '/favicon.ico';
  const data = payload.data || {};

  self.registration.showNotification(title, {
    body,
    icon,
    badge,
    tag: data.notificationId || 'mutiny-notification',
    renotify: true,
    data: {
      actionUrl: data.actionUrl || '/',
      ...data,
    },
  });
});

// ─── Notification click handler ───────────────────────────────────────────────
// Open/focus the app tab and navigate to the action URL when user taps notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl || '/';
  const targetUrl = self.location.origin + actionUrl;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a tab with the app is already open, focus it and navigate.
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new tab.
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

