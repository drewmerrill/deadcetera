// GrooveLinx — Firebase Cloud Messaging service worker
// Loaded automatically by FCM at the site root. Handles BACKGROUND push
// messages (when the page isn't focused or is closed). Foreground messages
// are handled by gl-push.js inside the page.
//
// Must live at the root path /firebase-messaging-sw.js so FCM can find it.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC3sMU2S8XT9AhA4w5vTwtPP1Nx5kOHOJo',
  authDomain: 'deadcetera-35424.firebaseapp.com',
  databaseURL: 'https://deadcetera-35424-default-rtdb.firebaseio.com',
  projectId: 'deadcetera-35424',
  storageBucket: 'deadcetera-35424.firebasestorage.app',
  messagingSenderId: '218400123401',
  appId: '1:218400123401:web:7f64ad84231dcaba6966d8'
});

// Initialize messaging so the SDK registers itself as a recognized FCM SW
// (required for getToken() in the page to succeed). We don't use
// onBackgroundMessage — the raw 'push' listener below handles display directly,
// which is more reliable across browsers.
firebase.messaging();

// Raw push handler — fires whenever a push arrives, regardless of FCM SDK
// payload-shape detection. We parse the FCM data envelope ourselves.
self.addEventListener('push', function(event) {
  console.log('[FCM-SW] push event received', event);
  var payload = {};
  if (event.data) {
    try { payload = event.data.json(); }
    catch(e) { try { payload.body = event.data.text(); } catch(e2) {} }
  }
  // FCM v1 wraps the user payload at payload.data; webpush.notification (if any)
  // shows up at payload.notification. Fall back to top-level fields too.
  var data  = payload.data || payload || {};
  var notif = payload.notification || {};
  var title = notif.title || data.title || 'GrooveLinx';
  var body  = notif.body  || data.body  || 'You have a new band update.';
  var click = data.click_action || data.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { click: click, ts: Date.now() },
      tag: data.tag || 'gl-feed',
      renotify: true
    })
  );
});

// Click handler — focus an existing tab if one's open, else open a new one.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.click) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.registration.scope) === 0) {
          list[i].focus();
          if (list[i].navigate) list[i].navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
