// ============================================================================
// js/core/gl-push.js
// Browser push notifications via Firebase Cloud Messaging.
// Handles permission request, FCM token retrieval, token storage in
// Firebase, and foreground message display.
// Background pushes are handled by /firebase-messaging-sw.js.
// EXPOSES: window.GLPush
// ============================================================================

'use strict';

(function () {
  var VAPID_KEY = 'BMv8-U7CVUO_soFYGaCmCuPoFAZuKrOg0ceI_6uCVpbN926SBygxbR7o2GJJmTPt9Bhflp4cPHq1HSJNppeFK0s';
  var _messaging = null;
  var _initTried = false;

  function _isSupported() {
    return typeof firebase !== 'undefined'
      && firebase.messaging
      && firebase.messaging.isSupported
      && firebase.messaging.isSupported();
  }

  function _getMessaging() {
    if (_messaging) return _messaging;
    if (!_isSupported()) return null;
    try { _messaging = firebase.messaging(); }
    catch (e) { console.warn('[GLPush] firebase.messaging() failed:', e); return null; }
    return _messaging;
  }

  // Returns the current permission state — 'granted' | 'denied' | 'default' | 'unsupported'
  function getPermissionState() {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (!_isSupported()) return 'unsupported';
    return Notification.permission;
  }

  // Returns whether THIS device is currently subscribed (token saved).
  async function isSubscribed() {
    var key = _localTokenKey();
    return !!(key && localStorage.getItem(key));
  }

  function _localTokenKey() {
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return null;
    return 'gl_push_token_' + memberKey;
  }

  // Request permission, get token, save under bands/{slug}/push_subscriptions/{memberKey}/{tokenHash}
  // Returns { ok: true, token } on success, { ok: false, reason } on failure.
  async function subscribe() {
    if (!_isSupported()) return { ok: false, reason: 'browser_not_supported' };
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return { ok: false, reason: 'not_signed_in' };

    // Permission gate
    if (Notification.permission === 'denied') {
      return { ok: false, reason: 'permission_denied', userMessage: 'Notifications are blocked for this site. Open the lock icon in the address bar and re-allow notifications.' };
    }
    if (Notification.permission !== 'granted') {
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return { ok: false, reason: 'permission_denied', userMessage: 'You declined notifications. Re-enable from your browser settings if you change your mind.' };
      }
    }

    // Make sure the FCM service worker is registered. FCM normally
    // auto-registers /firebase-messaging-sw.js but we register explicitly
    // so we can pass a fixed scope. We must also wait for THIS specific
    // registration to reach 'activated' — `navigator.serviceWorker.ready`
    // resolves on whichever SW controls the page (the main app SW), not
    // necessarily on our FCM SW.
    var swReg = null;
    try {
      if ('serviceWorker' in navigator) {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' });
        if (!swReg.active) {
          var sw = swReg.installing || swReg.waiting;
          if (sw) {
            await new Promise(function (resolve) {
              if (sw.state === 'activated') return resolve();
              sw.addEventListener('statechange', function () {
                if (sw.state === 'activated') resolve();
              });
            });
          }
        }
      }
    } catch (e) {
      console.warn('[GLPush] SW registration failed:', e);
      return { ok: false, reason: 'sw_register_failed', userMessage: 'Couldn\u2019t install the notification handler. Try refreshing the page.' };
    }

    var messaging = _getMessaging();
    if (!messaging) return { ok: false, reason: 'messaging_unavailable' };

    var token = null;
    try {
      token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    } catch (e) {
      console.warn('[GLPush] getToken failed:', e);
      return { ok: false, reason: 'token_failed', userMessage: 'Couldn\u2019t register for notifications: ' + (e.message || 'unknown error') };
    }
    if (!token) return { ok: false, reason: 'no_token' };

    // Persist locally + in Firebase. Use a hash of the token as the
    // child key so reinstalls / multi-device land in separate slots and
    // we can clean up stale ones.
    try {
      localStorage.setItem(_localTokenKey(), token);
    } catch (e) { /* quota — non-fatal */ }

    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var hash = await _shortHash(token);
        var entry = {
          token: token,
          memberKey: memberKey,
          ua: (typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent.slice(0, 220) : ''),
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString()
        };
        await db.ref(bandPath('push_subscriptions/' + memberKey + '/' + hash)).set(entry);
      }
    } catch (e) {
      console.warn('[GLPush] Firebase save failed:', e);
      // Non-fatal — local token still works for foreground listening.
    }

    console.log('[GLPush] Subscribed:', memberKey, 'token=', token.substring(0, 16) + '...');
    return { ok: true, token: token };
  }

  // Disable: remove the token from FCM and from Firebase. Called when the
  // user toggles off SMS / push in settings, or when they sign out.
  async function unsubscribe() {
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    var token = null;
    try { token = localStorage.getItem(_localTokenKey() || ''); } catch(_e) {}
    var messaging = _getMessaging();
    if (messaging && token) {
      try { await messaging.deleteToken(); } catch(e) { console.warn('[GLPush] deleteToken failed:', e); }
    }
    if (token) {
      try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function' && memberKey) {
          var hash = await _shortHash(token);
          await db.ref(bandPath('push_subscriptions/' + memberKey + '/' + hash)).remove();
        }
      } catch(e) { console.warn('[GLPush] Firebase token cleanup failed:', e); }
    }
    try { localStorage.removeItem(_localTokenKey() || ''); } catch(_e) {}
    return { ok: true };
  }

  // Foreground message listener — shows an in-app toast since the OS-level
  // notification doesn't fire when the page is focused.
  function _initForegroundListener() {
    var messaging = _getMessaging();
    if (!messaging) return;
    messaging.onMessage(function(payload) {
      console.log('[GLPush] Foreground message:', payload);
      var data = payload.data || {};
      var notif = payload.notification || {};
      var title = notif.title || data.title || 'Band update';
      var body  = notif.body  || data.body  || '';
      if (typeof showToast === 'function') {
        showToast('\uD83D\uDCE1 ' + title + (body ? ' \u2014 ' + body : ''), 7000);
      }
      // Bump the home banner so it re-counts
      if (typeof FeedActionState !== 'undefined' && FeedActionState.refresh) {
        try { FeedActionState.refresh(); } catch(_e) {}
      }
    });
  }

  async function _shortHash(s) {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      try {
        var enc = new TextEncoder().encode(s);
        var buf = await crypto.subtle.digest('SHA-256', enc);
        var arr = Array.from(new Uint8Array(buf));
        return arr.slice(0, 12).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      } catch(_e) { /* fall through */ }
    }
    // Fallback: simple JS hash
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  // Auto-init foreground listener after Firebase is ready
  function init() {
    if (_initTried) return;
    _initTried = true;
    if (!_isSupported()) {
      console.log('[GLPush] Browser does not support FCM (likely iOS Safari without PWA install).');
      return;
    }
    _initForegroundListener();
    console.log('[GLPush] Foreground listener initialized.');
  }

  // Wait for Firebase init then auto-start the foreground listener
  function _autoInit() {
    if (typeof firebase === 'undefined' || !firebase.messaging) {
      // Try again shortly
      setTimeout(_autoInit, 300);
      return;
    }
    init();
  }
  // Fan out a push notification to all band members. Reads every member's
  // FCM tokens from Firebase, calls the worker's /push/send endpoint to
  // dispatch via FCM. Caller usually wants this fire-and-forget — failures
  // don't block the originating action.
  //
  // Args: { title, body, click_action?, tag?, data?, excludeMemberKey? }
  // excludeMemberKey defaults to the current user (we don't push to ourselves).
  async function notifyBand(opts) {
    opts = opts || {};
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    var excludeKey = (opts.excludeMemberKey !== undefined) ? opts.excludeMemberKey : memberKey;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return { ok: false, reason: 'no_firebase' };
    try {
      var snap = await db.ref(bandPath('push_subscriptions')).once('value');
      var byMember = snap.val() || {};
      var tokens = [];
      Object.keys(byMember).forEach(function(mKey) {
        if (excludeKey && mKey === excludeKey) return;
        var hashes = byMember[mKey] || {};
        Object.keys(hashes).forEach(function(h) {
          var entry = hashes[h];
          if (entry && entry.token) tokens.push({ token: entry.token, memberKey: mKey, hash: h });
        });
      });
      if (!tokens.length) return { ok: true, sent: 0, total: 0 };
      var WORKER_BASE = (typeof window !== 'undefined' && window.WORKER_BASE) ? window.WORKER_BASE : 'https://deadcetera-proxy.drewmerrill.workers.dev';
      var res = await fetch(WORKER_BASE + '/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: tokens.map(function(t) { return t.token; }),
          title: opts.title || 'Band update',
          body: opts.body || '',
          click_action: opts.click_action || (window.location.origin + '/'),
          tag: opts.tag || 'gl-feed',
          data: opts.data || {}
        })
      });
      if (!res.ok) {
        var errText = await res.text();
        console.warn('[GLPush] notifyBand worker error', res.status, errText);
        return { ok: false, reason: 'worker_' + res.status };
      }
      var json = await res.json();
      // Clean up invalid tokens: walk the subscriptions and remove any
      // whose token is in invalidTokens, so we don't keep retrying dead
      // devices.
      if (json.invalidTokens && json.invalidTokens.length) {
        var invalidSet = {}; json.invalidTokens.forEach(function(t) { invalidSet[t] = true; });
        for (var i = 0; i < tokens.length; i++) {
          if (invalidSet[tokens[i].token]) {
            try { await db.ref(bandPath('push_subscriptions/' + tokens[i].memberKey + '/' + tokens[i].hash)).remove(); }
            catch(_e) {}
          }
        }
      }
      console.log('[GLPush] notifyBand:', json.sent, 'of', json.total, 'sent', json.failed ? '| ' + json.failed + ' failed' : '');
      return { ok: true, sent: json.sent, total: json.total, failed: json.failed };
    } catch(e) {
      console.warn('[GLPush] notifyBand failed:', e && e.message);
      return { ok: false, reason: e && e.message };
    }
  }

  // Self-test: send a push to all the current user's own devices. Bypasses
  // the excludeMemberKey rule so Drew can test push delivery without needing
  // a second login. Type GLPush.testSelf() in the console.
  async function testSelf() {
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return { ok: false, reason: 'not_signed_in' };
    return notifyBand({
      title: 'Test push from GrooveLinx',
      body: 'If you see this on this device, push is working end-to-end.',
      tag: 'gl-test',
      excludeMemberKey: '__none__' // bypass the self-exclusion
    });
  }

  if (typeof window !== 'undefined') {
    window.GLPush = {
      init: init,
      subscribe: subscribe,
      unsubscribe: unsubscribe,
      isSubscribed: isSubscribed,
      getPermissionState: getPermissionState,
      notifyBand: notifyBand,
      testSelf: testSelf
    };
    // Defer init until after page load + Firebase ready
    if (document.readyState === 'complete') _autoInit();
    else window.addEventListener('load', _autoInit);
  }
  console.log('\uD83D\uDD14 gl-push.js loaded');
})();
