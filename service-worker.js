// Deadcetera Service Worker
// Auto-updates: new deploys activate within ~60 seconds on all devices

// ── VERSION: bump this string on every deploy to force cache refresh ────────
// This is automatically kept fresh — the app writes a ?v= timestamp to bust cache
const CACHE_NAME = 'deadcetera-20260228-h';
const BASE = self.registration.scope;

const CACHE_URLS = [
    BASE,
    BASE + 'index.html',
    BASE + 'styles.css',
    BASE + 'app-shell.css',
    BASE + 'app.js',
    BASE + 'data.js',
    BASE + 'help.js',
    BASE + 'manifest.json',
    BASE + 'icon-192.png',
    BASE + 'icon-512.png',
];

// ── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    console.log('[SW] Installing', CACHE_NAME);
    // skipWaiting: activate IMMEDIATELY, don't wait for old tabs to close
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.allSettled(CACHE_URLS.map(url => cache.add(url).catch(() => {})))
        )
    );
});

// ── Activate: claim all tabs immediately, delete old caches ─────────────────
self.addEventListener('activate', event => {
    console.log('[SW] Activating', CACHE_NAME);
    event.waitUntil(
        Promise.all([
            // Delete ALL old caches
            caches.keys().then(keys =>
                Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
                    console.log('[SW] Deleting old cache:', k);
                    return caches.delete(k);
                }))
            ),
            // Take control of ALL open tabs immediately (no reload needed next visit)
            self.clients.claim()
        ]).then(() => {
            // Tell all open tabs to reload so they get the new version
            self.clients.matchAll({ type: 'window' }).then(clients => {
                clients.forEach(client => {
                    console.log('[SW] Telling tab to reload for update');
                    client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
                });
            });
        })
    );
});

// ── Fetch: network-first for JS/HTML (always get latest), cache for assets ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Always network-first — never cache-only for these
    const alwaysNetwork = [
        'firebaseio.com', 'googleapis.com', 'firebase.google.com',
        'fonts.googleapis.com', 'fonts.gstatic.com',
        'open.spotify.com', 'youtube.com', 'archive.org', 'soundcloud.com'
    ];
    if (alwaysNetwork.some(d => url.hostname.includes(d))) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    // For app JS, HTML, CSS — always network-first with no-cache headers
    // This bypasses iOS WKWebView's HTTP cache layer
    const isAppFile = ['.js', '.html', '.css', '.json'].some(ext => url.pathname.endsWith(ext));
    if (isAppFile && url.origin === self.location.origin) {
        event.respondWith(
            fetch(new Request(event.request, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
            })).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() =>
                caches.match(event.request).then(cached =>
                    cached || (event.request.mode === 'navigate'
                        ? caches.match(BASE + 'index.html')
                        : new Response('', { status: 503 }))
                )
            )
        );
        return;
    }

    // Images and icons — cache-first (they don't change often)
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => new Response('', { status: 503 }));
        })
    );
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: 'Deadcetera', body: 'New update from the band!', tag: 'general' };
    try { if (event.data) data = { ...data, ...event.data.json() }; }
    catch(e) { if (event.data) data.body = event.data.text(); }

    event.waitUntil(
        self.registration.showNotification(`🎸 ${data.title}`, {
            body: data.body,
            icon: BASE + 'icon-192.png',
            badge: BASE + 'icon-192.png',
            tag: data.tag || 'general',
            renotify: true,
            vibrate: [200, 100, 200],
            data: { url: data.url || BASE },
            actions: [
                { action: 'open', title: '📱 Open App' },
                { action: 'dismiss', title: 'Dismiss' }
            ]
        })
    );
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'dismiss') return;
    const targetUrl = event.notification.data?.url || BASE;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.postMessage({ type: 'NAVIGATE', url: targetUrl });
                    return;
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});

// ── Messages from app ────────────────────────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
