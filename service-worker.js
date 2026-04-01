// GrooveLinx Service Worker — Simplified for reliable updates
// Strategy: network-first for everything. Cache is offline fallback only.

const CACHE_NAME = 'groovelinx-20260401-191421';
const BASE = self.registration.scope;

// ── Install: pre-cache index.html for offline nav, then activate immediately ─
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(['./', './index.html'])
        ).then(() => self.skipWaiting())
    );
});

// ── Activate: delete ALL old caches, claim all clients ──────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
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
            // Cache successful responses for offline use (guard against network errors during clone)
            if (response.ok && response.status === 200) {
                try {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone).catch(() => {}));
                } catch(e) {}
            }
            return response;
        }).catch(() => {
            // Offline: try cache
            return caches.match(event.request).then(cached => {
                if (cached) return cached;
                // Offline navigation: serve cached index.html (try all possible keys)
                if (event.request.mode === 'navigate') {
                    return caches.match(BASE + 'index.html')
                        .then(r => r || caches.match(BASE))
                        .then(r => r || caches.match('/index.html'))
                        .then(r => r || caches.match('./index.html'))
                        .then(r => r || new Response(
                            '<html><body style="background:#0f172a;color:#f1f5f9;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>GrooveLinx is offline</h2><p>Check your connection and reload.</p></div></body></html>',
                            { status: 503, headers: { 'Content-Type': 'text/html' } }
                        ));
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
    const data = event.notification.data || {};
    const target = data.url || (BASE + '#feed');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            // Try to focus existing window and navigate it to feed
            for (const c of list) {
                if (c.url.includes(BASE) && 'focus' in c) {
                    c.focus();
                    // Post message to navigate to feed with item context
                    if (data.itemType && data.itemId) {
                        c.postMessage({ type: 'GL_NOTIF_TAP', itemType: data.itemType, itemId: data.itemId });
                    }
                    return c;
                }
            }
            return clients.openWindow(target);
        })
    );
});

// ── SKIP_WAITING message (legacy support) ────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
