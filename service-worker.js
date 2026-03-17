// GrooveLinx Service Worker — Simplified for reliable updates
// Strategy: network-first for everything. Cache is offline fallback only.

const CACHE_NAME = 'groovelinx-20260317-213930';
const BASE = self.registration.scope;

// ── Install: skip waiting immediately so new SW activates instantly ──────────
self.addEventListener('install', event => {
    self.skipWaiting();
});

// ── Activate: delete ALL old caches, claim all clients ──────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: network-first for everything. Cache only as offline fallback. ────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-GET and cross-origin
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request).then(response => {
            // Cache successful responses for offline use
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
        }).catch(() => {
            // Offline: try cache
            return caches.match(event.request).then(cached => {
                if (cached) return cached;
                // Offline navigation: serve cached index.html
                if (event.request.mode === 'navigate') {
                    return caches.match(BASE + 'index.html');
                }
                return new Response('', { status: 503 });
            });
        })
    );
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: 'GrooveLinx', body: 'New update from the band!', tag: 'general' };
    try { if (event.data) data = { ...data, ...event.data.json() }; }
    catch(e) { if (event.data) data.body = event.data.text(); }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body, icon: BASE + 'icon-192.png', badge: BASE + 'badge-logo.png',
            tag: data.tag || 'general', data: data
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url : BASE;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) { if (c.url.includes(BASE) && 'focus' in c) return c.focus(); }
            return clients.openWindow(target);
        })
    );
});

// ── SKIP_WAITING message (legacy support) ────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
