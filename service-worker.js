// GrooveLinx Service Worker — cache-first for shell (gig-safe on weak wifi)
// Static app shell (HTML/JS/CSS/images): cache-first, background refresh.
// version.json: network-first with a short timeout (so "Update available"
// banners still work on good connections but never hang at the gig).
// Firebase / external APIs: bypassed — handled by page code.

const CACHE_NAME = 'groovelinx-20260419-100323';
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function _navOfflineFallback() {
    return caches.match(BASE + 'index.html')
        .then(r => r || caches.match(BASE))
        .then(r => r || caches.match('/index.html'))
        .then(r => r || caches.match('./index.html'))
        .then(r => r || new Response(
            '<html><body style="background:#0f172a;color:#f1f5f9;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>GrooveLinx is offline</h2><p>Check your connection and reload.</p></div></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html' } }
        ));
}

// Background-refresh a cached response so next load gets fresh code.
function _bgRefresh(request) {
    fetch(request).then(response => {
        if (response && response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
        }
    }).catch(() => {});
}

// ── Fetch: cache-first for app shell, network-first-with-timeout for version.json ─
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-GET and cross-origin
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    const path = url.pathname;

    // version.json: network-first, 1.5s timeout, cache fallback. Keeps the
    // "update available" banner working on good networks without hanging at a
    // venue with weak wifi.
    if (path.endsWith('/version.json')) {
        event.respondWith(
            Promise.race([
                fetch(event.request).then(r => {
                    if (r && r.ok) {
                        const clone = r.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone).catch(() => {}));
                    }
                    return r;
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
            ]).catch(() => caches.match(event.request).then(r => r || new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })))
        );
        return;
    }

    // App shell: cache-first. Instant load from cache, background-refresh so
    // the next visit picks up new code. This is the critical change for gig
    // reliability — no more network waits on venue wifi.
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                _bgRefresh(event.request);
                return cached;
            }
            // Cache miss: fetch from network, cache for next time.
            return fetch(event.request).then(response => {
                if (response && response.ok && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone).catch(() => {}));
                }
                return response;
            }).catch(() => {
                if (event.request.mode === 'navigate') return _navOfflineFallback();
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
    // Deep link: /#songs?item=poll:abc123
    const itemParam = (data.itemType && data.itemId) ? '?item=' + encodeURIComponent(data.itemType + ':' + data.itemId) : '';
    const target = data.url || (BASE + '#feed' + itemParam);
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.includes(BASE) && 'focus' in c) {
                    c.focus();
                    c.postMessage({ type: 'GL_NOTIF_TAP', itemType: data.itemType, itemId: data.itemId });
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
