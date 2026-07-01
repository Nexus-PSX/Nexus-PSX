// firebase-messaging-sw.js
// Handles FCM push notifications when the Nexus PSX tab is closed or in the
// background. Must be in the repo root (same scope as index.html).
// Chrome/Edge/Android will use this file automatically when it finds it at
// the scope root alongside the registered service worker.
//
// NOTE: This file uses importScripts (not ES modules) because service workers
// pre-date ES module support. The Firebase version MUST stay in sync with
// the version imported in auth.js.

importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

// ===== Firebase config — must match the config in auth.js =====
firebase.initializeApp({
  apiKey: "AIzaSyCmIUoD99B2U94wWuHIaQIWmU2A4kppbDY",
  authDomain: "psx-dashboard-dev.firebaseapp.com",
  projectId: "psx-dashboard-dev",
  storageBucket: "psx-dashboard-dev.firebasestorage.app",
  messagingSenderId: "1089260456151",
  appId: "1:1089260456151:web:38c68733e2f4d547330892"
});

const messaging = firebase.messaging();

// ===== Background message handler =====
// This fires when a push notification arrives while the tab is closed or
// hidden. If the payload has a notification block, FCM displays it
// automatically. If it only has a data block (our preferred format, since
// it gives us full control over the display), we display it manually here.
messaging.onBackgroundMessage(payload => {
  const { title, body, icon, badge, tag, data } = payload.data || {};

  self.registration.showNotification(title || 'Nexus PSX Alert', {
    body:  body  || 'New buy signal detected',
    icon:  icon  || './icon-192.png',
    badge: badge || './favicon-32x32.png',
    tag:   tag   || 'nexus-psx-alert',   // collapses duplicate alerts
    data:  { url: data?.url || self.location.origin },
    requireInteraction: false,            // auto-dismiss after a few seconds
  });
});

// ===== Notification click handler =====
// Opens the app (or focuses the existing tab) when the user taps a
// background notification.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        // Re-focus an existing tab if one is already open
        if (new URL(client.url).origin === new URL(targetUrl).origin) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
