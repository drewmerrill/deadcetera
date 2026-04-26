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

const messaging = firebase.messaging();

// Background handler — fires when the app isn't focused. Show a native OS
// notification so the user gets phone-side / desktop-side feedback.
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM-SW] Background message:', payload);
  var data = payload.data || {};
  var notif = payload.notification || {};
  var title = notif.title || data.title || 'GrooveLinx';
  var body  = notif.body  || data.body  || 'You have a new band update.';
  var click = data.click_action || data.url || '/';

  return self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { click: click, ts: Date.now() },
    tag: data.tag || 'gl-feed',
    renotify: true
  });
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
