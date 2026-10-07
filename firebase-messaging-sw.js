// firebase-messaging-sw.js
// Handles FCM push notifications when the Nexus PSX tab is closed or in the
// background. Must be in the repo root (same scope as index.html).
// Chrome/Edge/Android will use this file automatically when it finds it at
// the scope root alongside the registered service worker.
//
// THIS IS THE ONLY SERVICE WORKER. Two different workers on one scope replace
// each other (the last one registered wins), and only this one can show push
// notifications - so install/activate/fetch handling from the old sw.js now
// lives here too, and the page registers only this file.
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

// ===== Install / activate / fetch (merged from the old sw.js) =====
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Pass-through fetch (required for "Add to Home Screen" installability).
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// ===== Background message handler =====
// Messages are data-only, so we build the notification ourselves.
messaging.onBackgroundMessage(payload => {
  const d = payload.data || {};
  return self.registration.showNotification(d.title || 'Nexus PSX Alert', {
    body:  d.body  || 'New buy signal detected',
    icon:  d.icon  || './icon-192.png',
    badge: d.badge || './favicon-32x32.png',
    tag:   d.tag   || 'nexus-psx-alert',
    renotify: true,                       // buzz again even if an alert with the same tag is showing
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: { url: d.url || self.registration.scope },   // payload field is `url` (was read from the wrong place)
    requireInteraction: false
  });
});

// ===== Notification tap =====
// Opens the app (or focuses the already-open tab/PWA window).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
