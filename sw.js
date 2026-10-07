// Kept only as an alias. The single service worker is firebase-messaging-sw.js
// (it handles install, fetch AND push). Registering two workers on one scope
// makes them replace each other and breaks push notifications.
importScripts('./firebase-messaging-sw.js');
