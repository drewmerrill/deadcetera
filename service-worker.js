// Deadcetera Service Worker
// Handles: offline caching, push notifications, background sync
const CACHE_NAME = 'deadcetera-v2';

// Derive base path from SW location (works at root or subdirectory)
const BASE = self.registration.scope;

const CACHE_URLS = [
    BASE,
    BASE + 'index.html',
    BASE + 'styles.css',
    BASE + 'app-shell.css',
    BASE + 'app.js',
    BASE + 'data.js',
    BASE + 'manifest.json',
    BASE + 'icon-192.png',
    BASE + 'icon-512.png',
];

// ── Install: cache core app shell ──────────────────────────────────────────
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cache what we can — don't fail install if some external URLs fail
            return Promise.allSettled(
                CACHE_URLS.map(url => cache.add(url).catch(e => console.log('[SW] Cache miss:', url)))
            );
        }).then(() => self.skipWaiting())
    );
});

// ── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: network-first for API calls, cache-first for app shell ──────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Always network-first for Firebase, Google APIs, fonts
    const networkFirst = [
        'firebaseio.com', 'googleapis.com', 'firebase.google.com',
        'fonts.googleapis.com', 'fonts.gstatic.com', 'open.spotify.com',
        'youtube.com', 'archive.org'
    ];
    if (networkFirst.some(domain => url.hostname.includes(domain))) {
        event.respondWith(fetch(event.request).catch(() => new Response('', {status: 503})));
        return;
    }

    // Cache-first for app shell assets
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Cache successful GET requests for same-origin assets
                if (response.ok && event.request.method === 'GET' && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline fallback for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                return new Response('', {status: 503});
            });
        })
    );
});

// ── Push Notifications ──────────────────────────────────────────────────────
self.addEventListener('push', event => {
    console.log('[SW] Push received');
    let data = { title: '🎸 Deadcetera', body: 'New update from the band!', tag: 'general' };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch(e) {
        if (event.data) data.body = event.data.text();
    }

    const options = {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || 'general',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: data.url || '/', dateOfArrival: Date.now() },
        actions: [
            { action: 'open', title: '📱 Open App' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(`🎸 ${data.title}`, options)
    );
});

// ── Notification Click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'dismiss') return;

    const targetUrl = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Focus existing window if open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    if (targetUrl !== '/') client.postMessage({ type: 'NAVIGATE', url: targetUrl });
                    return;
                }
            }
            // Open new window
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});

// ── Message from app ────────────────────────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'CACHE_URLS') {
        caches.open(CACHE_NAME).then(cache => cache.addAll(event.data.urls || []));
    }
});
