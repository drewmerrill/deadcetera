// GrooveLinx Service Worker — cache-first for shell (gig-safe on weak wifi)
// Static app shell (HTML/JS/CSS/images): cache-first, background refresh.
// version.json: network-first with a short timeout (so "Update available"
// banners still work on good connections but never hang at the gig).
// Firebase / external APIs: bypassed — handled by page code.

const CACHE_NAME = 'groovelinx-20260419-125019';
const BASE = self.registration.scope;

// Cross-origin hosts we cache because the app depends on them to boot.
// Firebase SDK, Google Fonts — without these cached, offline load = white page.
const CDN_HOSTS = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const CDN_PRECACHE = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// ── Install: pre-cache shell + parse index.html for every local asset ──────
// Each build stamps a new `?v=BUILD` on every script/CSS URL. If we only
// pre-cache index.html, all 80+ JS files and 5 CSS files are uncached until
// the browser happens to fetch them — so going offline immediately leaves a
// white page. Here we fetch index.html fresh and pre-cache every local URL
// it references, so one online visit is enough to be fully offline-ready.
async function _precacheShellAndAssets(cache) {
    await cache.addAll(['./', './index.html']);
    try {
        // Bypass browser + SW caches to get the latest index.html with current ?v= stamps
        const res = await fetch('./index.html?sw_install=1', { cache: 'no-cache' });
        if (!res || !res.ok) return;
        const html = await res.text();
        const urls = new Set();
        const re = /\s(?:src|href)\s*=\s*["']([^"'>]+)["']/gi;
        let m;
        while ((m = re.exec(html)) !== null) {
            const u = m[1].trim();
            if (!u) continue;
            if (u.startsWith('#') || u.startsWith('data:') || u.startsWith('mailto:')) continue;
            // Skip absolute external URLs (Firebase SDK + fonts handled by CDN_PRECACHE)
            if (/^https?:\/\//i.test(u) || u.startsWith('//')) continue;
            try {
                const abs = new URL(u, self.registration.scope).href;
                urls.add(abs);
            } catch (e) {}
        }
        // Fetch each asset and cache it. Failures are non-fatal — if the build
        // has a broken reference we still want the rest cached.
        await Promise.all([...urls].map(url =>
            fetch(url).then(r => {
                if (r && r.ok) return cache.put(url, r.clone());
            }).catch(() => {})
        ));
    } catch (e) { /* best-effort */ }
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.all([
                _precacheShellAndAssets(cache),
                Promise.all(CDN_PRECACHE.map(url =>
                    fetch(url, { mode: 'no-cors' })
                        .then(r => cache.put(url, r))
                        .catch(() => {})
                ))
            ])
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

// Cross-origin variant — opaque responses aren't `.ok`, so cache any that
// arrive without throwing. Serves Firebase SDK + Google Fonts after first fetch.
function _bgRefreshCrossOrigin(request) {
    fetch(request, { mode: 'no-cors' }).then(response => {
        try {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {}));
        } catch (e) {}
    }).catch(() => {});
}

// ── Fetch: cache-first for app shell, network-first-with-timeout for version.json ─
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-GET
    if (event.request.method !== 'GET') return;

    const sameOrigin = url.origin === self.location.origin;
    const isCdnHost = CDN_HOSTS.indexOf(url.host) >= 0;

    // Skip cross-origin EXCEPT for the CDN hosts we depend on to boot.
    if (!sameOrigin && !isCdnHost) return;

    // Cross-origin CDN: cache-first with opaque-response caching.
    if (!sameOrigin && isCdnHost) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) {
                    _bgRefreshCrossOrigin(event.request);
                    return cached;
                }
                return fetch(event.request, { mode: 'no-cors' }).then(response => {
                    try {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone).catch(() => {}));
                    } catch (e) {}
                    return response;
                }).catch(() => new Response('', { status: 503 }));
            })
        );
        return;
    }

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

// ── Messages ────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'GL_PRECACHE_SHELL') {
        // Triggered by the "Prep for Gig" button so the user can force a
        // full shell re-cache without waiting for the next build deploy.
        event.waitUntil((async () => {
            const cache = await caches.open(CACHE_NAME);
            await _precacheShellAndAssets(cache);
            await Promise.all(CDN_PRECACHE.map(url =>
                fetch(url, { mode: 'no-cors' })
                    .then(r => cache.put(url, r))
                    .catch(() => {})
            ));
            if (event.source && event.source.postMessage) {
                event.source.postMessage({ type: 'GL_PRECACHE_DONE' });
            }
        })());
    }
});
