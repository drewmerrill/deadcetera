// ============================================================================
// DEADCETERA WORKFLOW APP v5.5.0 - Firebase · Playlists · Mobile-Ready
// DEV BRANCH — safe to experiment here
// Last updated: 2026-02-26
// ============================================================================

console.log('%c🎸 DeadCetera BUILD: 20260301-190601', 'color:#667eea;font-weight:bold;font-size:14px');



// Inject favicon to prevent 404 error
(function() {
    if (!document.querySelector('link[rel="icon"]')) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjE1IiBmaWxsPSIjNjY3ZWVhIi8+Cjx0ZXh0IHg9IjE2IiB5PSIyMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxOCIgZmlsbD0id2hpdGUiPuKZqjwvdGV4dD4KPC9zdmc+';
        document.head.appendChild(link);
    }
})();

// Inject responsive CSS for consistent rendering across mobile/desktop/incognito
(function() {
    if (document.getElementById('deadcetera-responsive-css')) return;
    const style = document.createElement('style');
    style.id = 'deadcetera-responsive-css';
    style.textContent = `
        /* ===== SONG LIST (DARK THEME) ===== */
        .song-item {
            display: grid;
            grid-template-columns: 1fr 28px 80px 52px;
            align-items: center;
            gap: 4px;
            padding: 10px 12px;
            min-height: 42px;
            background: #1e293b !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
            border-radius: 8px;
            margin-bottom: 3px;
            cursor: pointer;
            transition: background 0.12s, border-color 0.12s;
            color: #f1f5f9 !important;
        }
        .song-item:hover {
            background: #263248 !important;
            border-color: rgba(102,126,234,0.25) !important;
        }
        .song-item.selected {
            background: #2d3a5c !important;
            border-color: #667eea !important;
        }
        .song-item.selected * { color: inherit !important; }
        .song-item.selected .song-name { color: #c7d2fe !important; }
        .song-item.selected .song-badge { opacity: 1 !important; }
        .song-name {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #f1f5f9 !important;
            font-weight: 500;
            font-size: 0.9em;
            line-height: 1.3;
        }
        /* Harmony badge column - fixed 28px */
        .song-badges {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
        }
        .harmony-badge {
            font-size: 0.75em;
            line-height: 1;
            background: rgba(129,140,248,0.2);
            padding: 2px 4px;
            border-radius: 5px;
            border: 1px solid rgba(129,140,248,0.3);
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        /* Status badge column - fixed 80px */
        .status-badge {
            white-space: nowrap;
            font-size: 0.6em;
            padding: 2px 6px;
            border-radius: 10px;
            font-weight: 700;
            letter-spacing: 0.02em;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 70px;
            text-align: center;
            box-sizing: border-box;
        }
        /* Band badge column - fixed 52px */
        .song-badge {
            font-size: 0.6em;
            padding: 3px 0;
            border-radius: 20px;
            font-weight: 700;
            text-align: center;
            width: 48px;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
        }
        .song-badge.gd { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
        .song-badge.jgb { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
        .song-badge.wsp { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.25); }
        .song-badge.phish { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.25); }
        .song-badge.abb { background: rgba(236,72,153,0.15); color: #f472b6; border: 1px solid rgba(236,72,153,0.25); }
        .song-badge.goose { background: rgba(168,85,247,0.15); color: #c084fc; border: 1px solid rgba(168,85,247,0.25); }
        .song-badge.dmb { background: rgba(20,184,166,0.15); color: #2dd4bf; border: 1px solid rgba(20,184,166,0.25); }

        /* ===== FILTER BUTTONS ===== */
        .status-filters, .harmony-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
        }
        .filter-btn {
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.04);
            color: #94a3b8;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.85em;
            white-space: nowrap;
            transition: all 0.15s ease;
        }
        .filter-btn.active, .filter-btn:hover {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }

        /* ===== PRACTICE TRACKS ===== */
        .practice-tracks-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 12px;
        }
        .practice-track-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 16px;
            color: #f1f5f9;
            transition: border-color 0.15s ease;
        }
        .practice-track-card:hover {
            border-color: rgba(102,126,234,0.3);
        }
        .practice-track-card img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }

        /* ===== REFERENCE VERSION CARDS ===== */
        .spotify-version-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            color: #f1f5f9;
        }
        .spotify-version-card.default {
            border-color: #667eea;
            background: rgba(102,126,234,0.08);
        }
        .votes-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 10px 0;
        }
        .vote-chip {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.82em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.04);
            color: #94a3b8;
        }
        .vote-chip.yes {
            background: rgba(16,185,129,0.15);
            color: #34d399;
            border-color: rgba(16,185,129,0.3);
        }
        .vote-chip.no {
            background: rgba(255,255,255,0.04);
            color: #64748b;
        }
        .vote-chip:hover {
            transform: scale(1.05);
        }
        .version-title { color: #f1f5f9; }
        .version-badge {
            background: #667eea;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 700;
            display: inline-block;
            margin-bottom: 8px;
        }

        /* ===== MODALS ===== */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        /* ===== BUTTONS ===== */
        .chart-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid rgba(255,255,255,0.08);
            font-size: 0.9em;
            transition: all 0.15s ease;
            background: rgba(255,255,255,0.04);
            color: #94a3b8;
        }
        .chart-btn:hover { background: rgba(255,255,255,0.08); color: #f1f5f9; }
        .chart-btn-primary {
            background: #667eea;
            color: white;
            border-color: #667eea;
        }
        .chart-btn-primary:hover {
            background: #5a6fd6;
        }
        .chart-btn-secondary {
            background: rgba(255,255,255,0.04);
            color: #94a3b8;
        }
        .primary-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
        }
        .secondary-btn {
            background: rgba(255,255,255,0.04);
            color: #94a3b8;
            border: 1px solid rgba(255,255,255,0.08);
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
        }
        .secondary-btn:hover { background: rgba(255,255,255,0.08); color: #f1f5f9; }

        /* ===== RESOURCE SECTIONS ===== */
        .resource-section {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .section-header h3 { color: #f1f5f9; }
        .section-header p { color: #94a3b8; }
        .empty-state { color: #64748b; }

        /* ===== REHEARSAL NOTES ===== */
        .rehearsal-note-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 8px;
        }
        .rehearsal-note-card.high { border-left: 3px solid #ef4444; }
        .note-header strong { color: #f1f5f9; }

        /* ===== HARMONY CARDS ===== */
        .harmony-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px;
            padding: 14px;
            margin-bottom: 8px;
        }
        .harmony-lyric { color: #818cf8; font-weight: 600; }
        .harmony-timing { color: #64748b; font-size: 0.82em; }
        .part-row { color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 4px 0; }
        .part-singer { color: #818cf8; font-weight: 600; }

        /* ===== SONG METADATA ===== */
        .song-metadata {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
        }
        .song-metadata span, .song-metadata label { color: #94a3b8; }
        .song-metadata select, .song-metadata input {
            background: rgba(255,255,255,0.06);
            color: #f1f5f9;
            border: 1px solid rgba(255,255,255,0.08);
        }

        /* ===== MOBILE RESPONSIVE ===== */
        @media (max-width: 640px) {
            .song-item { padding: 10px 12px; font-size: 0.93em; }
            .song-badge { font-size: 0.65em; padding: 2px 8px; }
            .practice-tracks-grid { grid-template-columns: 1fr; }
            .filter-btn { padding: 6px 12px; font-size: 0.8em; }
            .vote-chip { padding: 5px 10px; font-size: 0.8em; }
            .chart-btn { padding: 8px 14px; font-size: 0.85em; }
            .modal-overlay { padding: 10px; }
            #abcEditorModal > div { max-height: 90vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
            .abcjs-inline-audio { flex-wrap: wrap; gap: 4px; }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
            .practice-tracks-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (hover: none) and (pointer: coarse) {
            .song-item { min-height: 48px; }
            .filter-btn { min-height: 40px; display: flex; align-items: center; justify-content: center; }
            .vote-chip { min-height: 36px; display: flex; align-items: center; }
            button, .filter-btn, .vote-chip, .chart-btn { touch-action: manipulation; }
        }

        /* ===== SCROLLBAR ===== */
        #songDropdown {
            max-height: 50vh;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        #songDropdown::-webkit-scrollbar { width: 4px; }
        #songDropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
        #songDropdown::-webkit-scrollbar-track { background: transparent; }

        #songSearch { width: 100%; box-sizing: border-box; }

        @media print {
            .status-filters, .harmony-filters, .filter-btn,
            button, .chart-btn, #googleDriveAuthBtn { display: none !important; }
        }
    `;
    document.head.appendChild(style);
})();

console.log('🎸 Deadcetera v5.4 — Firebase · Playlists · Harmonies · Stage-ready!');

let selectedSong = null;
let selectedVersion = null;
let currentFilter = 'all';
let currentInstrument = 'bass'; // Default instrument
let currentResourceType = null; // For modal state
let currentResourceIndex = null; // For editing resources
let activeStatusFilter = null; // Tracks which status filter is active
let activeHarmonyFilter = null; // Tracks which harmony filter is active

// Helper: get play button label based on URL/platform
function getPlayButtonLabel(version) {
    const url = (version.url || version.spotifyUrl || '').toLowerCase();
    const p = version.platform || '';
    if (p === 'youtube' || url.includes('youtube') || url.includes('youtu.be')) return '▶️ Watch on YouTube';
    if (p === 'apple_music' || url.includes('music.apple')) return '▶️ Play on Apple Music';
    if (p === 'archive' || url.includes('archive.org')) return '▶️ Listen on Archive.org';
    if (p === 'soundcloud' || url.includes('soundcloud')) return '▶️ Play on SoundCloud';
    if (p === 'tidal' || url.includes('tidal')) return '▶️ Play on Tidal';
    if (url.includes('spotify')) return '▶️ Play on Spotify';
    return '▶️ Listen';
}

// Helper: get play button color based on URL/platform
function getPlayButtonStyle(version) {
    const url = (version.url || version.spotifyUrl || '').toLowerCase();
    const p = version.platform || '';
    if (p === 'spotify' || url.includes('spotify'))   return 'background:#1db954!important;color:#ffffff!important;';
    if (p === 'youtube' || url.includes('youtube') || url.includes('youtu.be')) return 'background:#ff0000!important;color:#ffffff!important;';
    if (p === 'apple_music' || url.includes('music.apple')) return 'background:#fc3c44!important;color:#ffffff!important;';
    if (p === 'archive' || url.includes('archive.org')) return 'background:#428bca!important;color:#ffffff!important;';
    if (p === 'soundcloud' || url.includes('soundcloud')) return 'background:#ff7700!important;color:#ffffff!important;';
    if (p === 'tidal' || url.includes('tidal')) return 'background:#000000!important;color:#ffffff!important;';
    return 'background:#667eea!important;color:#ffffff!important;';
}

// ============================================================================
// BAND NAME CONVERTER
// ============================================================================

function getFullBandName(bandAbbr) {
    const bandMap = {
        'GD': 'Grateful Dead',
        'JGB': 'Jerry Garcia Band',
        'WSP': 'Widespread Panic',
        'Phish': 'Phish',
        'ABB': 'Allman Brothers',
        'Goose': 'Goose',
        'DMB': 'Dave Matthews Band',
        'Other': 'Other'
    };
    return bandMap[bandAbbr] || bandAbbr;
}

// ============================================================================
// LEARNING RESOURCES STORAGE
// ============================================================================

// Get storage key for a song+instrument combination

// ============================================================================
// INITIALIZE APP
// ============================================================================

// ── PWA: Register service worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Use relative path so it works whether hosted at root or in a subdirectory
        const swPath = new URL('service-worker.js', window.location.href).href;
        navigator.serviceWorker.register(swPath)
            .then(reg => {
                console.log('[PWA] Service worker registered:', reg.scope);

                // ── iOS PWA fix: poll for updates every 5 min ──────────────
                // iOS installed PWAs don't receive postMessage from SW reliably.
                // Polling reg.update() forces the browser to re-check the SW script.
                // If the SW changed, it installs + activates, then reloads via message OR
                // via the controllerchange event below.
                setInterval(() => reg.update(), 5 * 60 * 1000);

                // ── controllerchange fires when a new SW takes over ─────────
                // This is the most reliable cross-platform reload trigger.
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('[PWA] New SW controller detected');
                    showUpdateBanner();
                });

                // ── postMessage handler (Chrome/Android) ───────────────────
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data?.type === 'SW_UPDATED') {
                        console.log('[PWA] New version deployed:', event.data.version);
                        showUpdateBanner();
                        return;
                    }
                    if (event.data?.type === 'NAVIGATE' && event.data.url) {
                        const params = new URLSearchParams(event.data.url.split('?')[1] || '');
                        const page = params.get('page');
                        if (page) showPage(page);
                    }
                });
            })
            .catch(err => console.log('[PWA] SW registration failed:', err));
    });
}

// ── PWA: Capture install prompt and show smart banner ───────────────────────
let pwaInstallPrompt = null;
let pwaInstalled = false;

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    pwaInstallPrompt = e;
    // Show banner after a 3s delay so it doesn't pop up immediately
    setTimeout(showPWAInstallBanner, 3000);
});

window.addEventListener('appinstalled', () => {
    pwaInstalled = true;
    pwaInstallPrompt = null;
    hidePWAInstallBanner();
    console.log('[PWA] App installed!');
});

function showPWAInstallBanner() {
    if (pwaInstalled || document.getElementById('pwa-install-banner')) return;
    // Don't show if already running as standalone (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
        position: fixed; bottom: 70px; left: 12px; right: 12px;
        background: linear-gradient(135deg, #1e2a4a, #252d4a);
        border: 1px solid rgba(99,102,241,0.5);
        border-radius: 14px; padding: 14px 16px;
        display: flex; align-items: center; gap: 12px;
        z-index: 8000; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: slideUpBanner 0.3s ease-out;
    `;
    banner.innerHTML = `
        <img src="icon-192.png" style="width:44px;height:44px;border-radius:10px;flex-shrink:0" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:0.92em;color:#f1f5f9">Add Deadcetera to Home Screen</div>
            <div style="font-size:0.75em;color:#94a3b8;margin-top:2px">Opens like an app, works offline</div>
        </div>
        <button onclick="pwaTriggerInstall()" style="
            background:#6366f1;color:white;border:none;border-radius:8px;
            padding:8px 14px;font-weight:700;font-size:0.82em;cursor:pointer;
            flex-shrink:0;white-space:nowrap">
            Install
        </button>
        <button onclick="hidePWAInstallBanner()" style="
            background:none;border:none;color:#64748b;cursor:pointer;
            font-size:1.2em;padding:4px;flex-shrink:0;line-height:1">✕</button>
    `;

    // Add animation keyframe once
    if (!document.getElementById('pwa-banner-style')) {
        const style = document.createElement('style');
        style.id = 'pwa-banner-style';
        style.textContent = `
            @keyframes slideUpBanner {
                from { transform: translateY(20px); opacity: 0; }
                to   { transform: translateY(0);    opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(banner);
}

function hidePWAInstallBanner() {
    const b = document.getElementById('pwa-install-banner');
    if (b) { b.style.opacity = '0'; b.style.transition = 'opacity 0.2s'; setTimeout(() => b.remove(), 250); }
}

async function pwaTriggerInstall() {
    if (!pwaInstallPrompt) return;
    hidePWAInstallBanner();
    pwaInstallPrompt.prompt();
    const { outcome } = await pwaInstallPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    pwaInstallPrompt = null;
}

// ── Handle deep-link shortcuts (?page=xxx from manifest shortcuts) ──────────
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const startPage = params.get('page');
    if (startPage) setTimeout(() => showPage(startPage), 800);
});

document.addEventListener('DOMContentLoaded', function() {
    // ── Auto-init Firebase DB on page load ──────────────────────────────────
    // Firebase RTDB doesn't require user sign-in to read/write. 
    // We initialize it immediately so all saves go to Firebase, not just localStorage.
    // Google Identity (for user email) is still loaded on first "Connect" click.
    // Render songs immediately from built-in data (fast, no Firebase needed)
    renderSongs();

    // Then init Firebase and reload everything that depends on it
    initFirebaseOnly().then(() => {
        // Now that Firebase is ready, load custom songs and re-render
        // (Running before this would fall back to localStorage → invisible in incognito)
        loadCustomSongs().then(() => renderSongs());

        // Also load statuses and north stars with live Firebase data
        statusCacheLoaded = false;
        statusPreloadRunning = false;
        preloadAllStatuses();
        preloadNorthStarCache();
        backgroundScanNorthStars();
    }).catch(err => {
        console.warn('⚠️ Firebase auto-init failed (offline?):', err.message);
        // Fallback: try loading custom songs from localStorage anyway
        loadCustomSongs().then(() => renderSongs());
    });
    setupSearchAndFilters();
    setupInstrumentSelector();
    setupContinueButton();
    setupRefAddButton();
    updateReferenceVersionLabels();
    
    // Load saved instrument preference
    const savedInstrument = localStorage.getItem('deadcetera_instrument');
    if (savedInstrument) {
        currentInstrument = savedInstrument;
        const instrumentSelect = document.getElementById('instrumentSelect');
        if (instrumentSelect) instrumentSelect.value = savedInstrument;
    }
});

// Update Reference Version section labels for multi-platform support
// ============================================================================
// CUSTOM SONGS — Band-added songs not in the built-in database
// ============================================================================

let customSongsLoaded = false;

async function loadCustomSongs() {
    try {
        const custom = toArray(await loadBandDataFromDrive('_band', 'custom_songs') || []);
        // Remove ALL previously added custom songs (not just from the tail)
        const before = allSongs.length;
        for (let i = allSongs.length - 1; i >= 0; i--) {
            if (allSongs[i].isCustom) allSongs.splice(i, 1);
        }
        // Add fresh custom songs (skip any that duplicate a built-in title)
        const builtInTitles = new Set(allSongs.map(s => s.title.toLowerCase()));
        custom.forEach(s => {
            if (s.title && !builtInTitles.has(s.title.toLowerCase())) {
                allSongs.push({ title: s.title, band: s.band || 'Other', isCustom: true, addedBy: s.addedBy, notes: s.notes || '' });
            }
        });
        customSongsLoaded = true;
        updateCustomSongCount();
    } catch(e) {
        console.warn('loadCustomSongs error:', e);
        customSongsLoaded = true;
    }
}

function updateCustomSongCount() {
    const count = allSongs.filter(s => s.isCustom).length;
    const badge = document.getElementById('customSongCount');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
    // Update button tooltip so the count makes sense
    const btn = document.getElementById('customSongBtn');
    if (btn) {
        btn.title = count > 0
            ? `${count} custom song${count !== 1 ? 's' : ''} added by the band`
            : 'Add a custom song not in the library';
    }
}

function showAddCustomSongModal() {
    const existing = document.getElementById('customSongModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'customSongModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:480px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent-light)">➕ Add Custom Song</h3>
            <button onclick="document.getElementById('customSongModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        <div class="form-row">
            <label class="form-label">Song Title</label>
            <input class="app-input" id="csTitle" placeholder="e.g. Brown Eyed Girl" autofocus>
        </div>
        <div class="form-row" style="margin-top:10px">
            <label class="form-label">Artist / Band</label>
            <div style="display:flex;gap:8px">
                <select class="app-select" id="csBand" style="flex:1">
                    <option value="Other">Other / Custom</option>
                    <option value="GD">Grateful Dead</option>
                    <option value="JGB">Jerry Garcia Band</option>
                    <option value="WSP">Widespread Panic</option>
                    <option value="Phish">Phish</option>
                    <option value="ABB">Allman Brothers</option>
                    <option value="Goose">Goose</option>
                    <option value="DMB">Dave Matthews Band</option>
                </select>
            </div>
        </div>
        <div class="form-row" style="margin-top:10px">
            <label class="form-label">Notes (optional)</label>
            <input class="app-input" id="csNotes" placeholder="e.g. Van Morrison cover, key of G">
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" style="flex:1" onclick="saveCustomSong()">➕ Add to Library</button>
            <button class="btn btn-ghost" onclick="document.getElementById('customSongModal').remove()">Cancel</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    document.getElementById('csTitle')?.focus();
}

async function saveCustomSong() {
    const title = document.getElementById('csTitle')?.value.trim();
    const band = document.getElementById('csBand')?.value || 'Other';
    const notes = document.getElementById('csNotes')?.value.trim() || '';
    if (!title) { alert('Please enter a song title'); return; }
    if (allSongs.find(s => s.title.toLowerCase() === title.toLowerCase())) {
        alert(`"${title}" is already in the library!`); return;
    }
    const newSong = { title, band, notes, addedBy: currentUserEmail || 'unknown', addedAt: new Date().toISOString() };
    const existing = toArray(await loadBandDataFromDrive('_band', 'custom_songs') || []);
    existing.push(newSong);
    await saveBandDataToDrive('_band', 'custom_songs', existing);
    document.getElementById('customSongModal')?.remove();
    await loadCustomSongs();
    renderSongs();
    // Show confirmation
    const notice = document.createElement('div');
    notice.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--green);color:white;padding:10px 20px;border-radius:8px;font-weight:600;z-index:9999;font-size:0.9em';
    notice.textContent = `✅ "${title}" added to the library!`;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 2500);
}

async function deleteCustomSong(title) {
    if (!confirm(`Remove "${title}" from the library?`)) return;
    let custom = toArray(await loadBandDataFromDrive('_band', 'custom_songs') || []);
    custom = custom.filter(s => s.title !== title);
    await saveBandDataToDrive('_band', 'custom_songs', custom);
    await loadCustomSongs();
    renderSongs();
}

async function showCustomSongsList() {
    const custom = allSongs.filter(s => s.isCustom);
    const existing = document.getElementById('customSongsListModal');
    if (existing) existing.remove();
    if (custom.length === 0) {
        showAddCustomSongModal(); return;
    }
    const modal = document.createElement('div');
    modal.id = 'customSongsListModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:500px;width:100%;max-height:80vh;display:flex;flex-direction:column;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent-light)">🎵 Custom Songs (${custom.length})</h3>
            <button onclick="document.getElementById('customSongsListModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        <div style="overflow-y:auto;flex:1;margin-bottom:12px">
            ${custom.map(s => `<div class="list-item" style="padding:8px 12px;gap:10px">
                <span style="flex:1;font-weight:500">${s.title}</span>
                <span class="song-badge ${s.band.toLowerCase()}" style="flex-shrink:0">${s.band}</span>
                ${s.notes ? `<span style="font-size:0.75em;color:var(--text-dim)">${s.notes}</span>` : ''}
                <button onclick="deleteCustomSong('${s.title.replace(/'/g,"\\'")}');document.getElementById('customSongsListModal').remove()" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:0.75em;flex-shrink:0">✕</button>
            </div>`).join('')}
        </div>
        <button class="btn btn-primary" style="width:100%" onclick="document.getElementById('customSongsListModal').remove();showAddCustomSongModal()">➕ Add Another Song</button>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function updateReferenceVersionLabels() {
    // Update subtitle text
    const spotifySection = document.getElementById('spotifySection');
    if (spotifySection) {
        const subtitle = spotifySection.querySelector('p');
        if (subtitle && subtitle.textContent.includes('reference version')) {
            subtitle.textContent = 'Vote on which version to learn';
        }
        // Update "Find Reference" link to include other options
        const searchLink = spotifySection.querySelector('a[onclick*="searchSpotify"], .search-spotify-link');
        if (searchLink && searchLink.textContent.includes('Find Reference')) {
            // Keep the original but add context
        }
    }
}

function setupRefAddButton() {
    const btn = document.getElementById('addRefVersionBtn');
    if (!btn) return;
    btn.textContent = '+ Suggest Reference Version';
    btn.addEventListener('click', addRefVersion);
}

// ============================================================================
// INSTRUMENT SELECTOR
// ============================================================================

function setupInstrumentSelector() {
    const selector = document.getElementById('instrumentSelect');
    
    // Safety check - element might not exist on all pages
    if (!selector) return;
    
    selector.addEventListener('change', (e) => {
        currentInstrument = e.target.value;
        localStorage.setItem('deadcetera_instrument', currentInstrument);
        
        
        });
}

// ============================================================================
// RENDER SONGS
// ============================================================================

function renderSongs(filter = 'all', searchTerm = '') {
    const dropdown = document.getElementById('songDropdown');
    
    // Pre-filter by status and harmony if active (do it at data level, not DOM level)
    let filtered = allSongs.filter(song => {
        const knownBands = ['GD','JGB','WSP','PHISH','ABB','GOOSE','DMB'];
        const bandUpper = (song.band || '').toUpperCase();  // null-safe
        const matchesFilter = filter === 'all'
            ? true
            : filter.toUpperCase() === 'OTHER'
                ? !knownBands.includes(bandUpper)
                : bandUpper === filter.toUpperCase();
        const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesFilter || !matchesSearch) return false;
        // Status filter at data level
        if (activeStatusFilter && statusCacheLoaded) {
            const songStatus = getStatusFromCache(song.title);
            if (songStatus !== activeStatusFilter) return false;
        }
        // Harmony filter at data level
        if (activeHarmonyFilter === 'harmonies') {
            if (!harmonyBadgeCache[song.title] && !harmonyCache[song.title]) return false;
        }
        // North Star filter at data level
        if (activeNorthStarFilter) {
            if (!northStarCache[song.title]) return false;
        }
        return true;
    });
    
    if (filtered.length === 0) {
        const statusNames = { 'prospect':'Prospect', 'wip':'Work in Progress', 'gig_ready':'Gig Ready' };
        const statusLabel = activeStatusFilter ? statusNames[activeStatusFilter] || activeStatusFilter : '';
        let msg;
        if (activeHarmonyFilter === 'harmonies') {
            msg = `<div style="font-size:2em;margin-bottom:12px">🎵</div><div style="font-size:1.1em;font-weight:600;color:#1e293b;margin-bottom:8px">No harmony songs marked yet</div><div style="margin-bottom:16px;font-size:0.9em;color:#64748b">Click any song and check "Has Harmonies"!</div><button onclick="document.getElementById('harmoniesOnlyFilter').checked=false;filterSongsSync('all')" class="btn btn-primary" style="padding:10px 24px">Show All Songs</button>`;
        } else if (activeStatusFilter) {
            msg = `<div style="font-size:2em;margin-bottom:12px">🎸</div><div style="font-size:1.1em;font-weight:600;color:#1e293b;margin-bottom:8px">No songs marked "${statusLabel}"</div><div style="margin-bottom:16px;font-size:0.9em;color:#64748b">Click any song and set its status!</div><button onclick="document.getElementById('statusFilter').value='all';filterByStatus('all')" class="btn btn-success" style="padding:10px 24px">Show All Songs</button>`;
        } else {
            msg = `<div style="font-size:2em;margin-bottom:12px">🔍</div><div style="font-size:1.1em;font-weight:600;color:#1e293b;margin-bottom:6px">No songs found</div><div style="font-size:0.9em;color:#64748b">Try a different search or filter</div>`;
        }
        dropdown.innerHTML = '<div style="padding:40px 20px;text-align:center;display:block !important;grid-template-columns:none !important">' + msg + '</div>';
        return;
    }
    
    dropdown.innerHTML = filtered.map(song => `
        <div class="song-item${song.isCustom?' custom-song':''}" data-title="${song.title.replace(/"/g, '&quot;')}" ${song.isCustom?'data-custom="true"':''} onclick="selectSong('${song.title.replace(/'/g, "\\'")}')">
            <span class="song-name">${song.title}</span>
            <span class="song-badges"></span>
            <span class="song-status-cell"></span>
            <span class="song-badge ${(song.band||'other').toLowerCase()}">${song.band}</span>
        </div>
    `).join('');
    
    // Add badges after rendering (no setTimeout race condition)
    requestAnimationFrame(() => {
        addHarmonyBadges();
        addNorthStarBadges();
        preloadAllStatuses();
        if (statusCacheLoaded) addStatusBadges();
    });
}

// ============================================================================
// SEARCH AND FILTERS
// ============================================================================

function setupSearchAndFilters() {
    const searchInput = document.getElementById('songSearch');
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    searchInput.addEventListener('input', (e) => {
        renderSongs(currentFilter, e.target.value);
    });
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderSongs(currentFilter, searchInput.value);
        });
    });
}

// ============================================================================
// SONG SELECTION
// ============================================================================

function selectSong(songTitle) {
    // Store as object with title property for consistency
    selectedSong = {
        title: songTitle,
        band: allSongs.find(s => s.title === songTitle)?.band || 'GD'
    };
    
    // Get band info from allSongs
    const songData = allSongs.find(s => s.title === songTitle);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Highlight selected song
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    const clickedItem = event?.target?.closest('.song-item');
    if (clickedItem) {
        clickedItem.classList.add('selected');
        // Add a brief glow effect
        clickedItem.style.boxShadow = '0 0 0 2px var(--accent, #667eea)';
        setTimeout(() => { clickedItem.style.boxShadow = ''; }, 600);
    }
    
    // Show Step 2: Song Blueprint
    showBandResources(songTitle);
    
    // Show steps 3-5 (new sections)
    const step3ref = document.getElementById('step3ref');
    const step4ref = document.getElementById('step4ref');
    const step5ref = document.getElementById('step5ref');
    if (step3ref) step3ref.classList.remove('hidden');
    if (step4ref) step4ref.classList.remove('hidden');
    const step4cover = document.getElementById('step4cover');
    if (step4cover) step4cover.classList.remove('hidden');
    if (step5ref) step5ref.classList.remove('hidden');
    
    // Hide old steps
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');
    const step5 = document.getElementById('step5');
    if (step3) step3.classList.add('hidden');
    if (step4) step4.classList.add('hidden');
    if (step5) step5.classList.add('hidden');
    document.getElementById('resetContainer')?.classList.add('hidden');
    
    // Scroll to step 2 after a short delay (gives user time to see selection)
    setTimeout(() => {
        document.getElementById('step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
}


// ============================================================================
// CONTINUE TO VERSION SELECTION
// ============================================================================

function setupContinueButton() {
    const btn = document.getElementById('continueToVersionsBtn');
    
    // Safety check - button might not exist on all pages
    if (!btn) return;
    
    btn.addEventListener('click', () => {
        if (!selectedSong) return;
        
        // Get band info from allSongs
        const songData = allSongs.find(s => s.title === selectedSong);
        const bandAbbr = songData ? songData.band : 'GD';
        const bandName = getFullBandName(bandAbbr);
        
        // Check if we have top 5 versions for this song
        if (top5Database[selectedSong]) {
            showTop5Versions(selectedSong);
        } else {
            showNoVersionsMessage(selectedSong, bandName);
        }
        
        // Scroll to step 3
        setTimeout(() => {
            document.getElementById('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    });
}

// ============================================================================
// VERSION SELECTION (Renumbered Step 3)
// ============================================================================

// Show top 5 versions (now in step3 instead of step2)
function showTop5Versions(songTitle) {
    const step3 = document.getElementById('step3');
    const container = document.getElementById('versionsContainer');
    
    const versions = top5Database[songTitle];
    
    // Get band name for resource links
    const songData = allSongs.find(s => s.title === songTitle);
    const bandName = songData ? songData.band : 'Grateful Dead';
    
    container.innerHTML = versions.map(version => {
        const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
        
        return `
            <div class="version-card" onclick="selectVersion('${songTitle.replace(/'/g, "\\'")}', ${version.rank})">
                <span class="version-rank rank-${version.rank}">#${version.rank}</span>
                <div class="version-info">
                    <div class="version-venue">${version.venue}</div>
                    <div class="version-date">${version.date}</div>
                    <div class="version-notes">${version.notes}</div>
                    <div style="margin-top: 10px; padding: 8px; background: #edf2f7; border-radius: 6px; border-left: 4px solid #667eea;">
                        <strong style="color: #667eea;">🎵 Track ${version.trackNumber}</strong> - 
                        <span class="version-quality">${version.quality} Quality</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    step3.classList.remove('hidden');
}

// Show message when no versions available yet
function showNoVersionsMessage(songTitle, bandName = 'Grateful Dead') {
    const step3 = document.getElementById('step3');
    const container = document.getElementById('versionsContainer');
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: #f7fafc; border-radius: 12px;">
            <p style="font-size: 1.2em; color: #4a5568; margin-bottom: 15px;">
                <strong>"${songTitle}"</strong> by <strong>${bandName}</strong> is in our catalog!
            </p>
            <p style="color: var(--text-dim, #64748b); margin-bottom: 20px;">
                We haven't pre-loaded the top 5 versions for this song yet.
            </p>
            <button class="primary-btn" onclick="searchArchiveForSong('${songTitle.replace(/'/g, "\\'")}', '${bandName}')" style="margin-bottom: 15px;">
                🔍 Find Best Versions on Archive.org
            </button>
            <p style="color: var(--text-dim, #64748b); font-size: 0.9em;">
                This will search Archive.org for popular downloadable versions
            </p>
        </div>
    `;
    
    step3.classList.remove('hidden');
}

// Select a version
function selectVersion(songTitle, rank) {
    const version = top5Database[songTitle][rank - 1];
    selectedVersion = version;
    
    // Highlight selected version
    document.querySelectorAll('.version-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.version-card').classList.add('selected');
    
    // Show download step
    showDownloadStep(songTitle, version);
    
    // Scroll to step 4
    setTimeout(() => {
        document.getElementById('step4').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// ============================================================================
// DOWNLOAD STEP (Now Step 4)
// ============================================================================

function showDownloadStep(songTitle, version) {
    const step4 = document.getElementById('step4');
    const step5 = document.getElementById('step5');
    const resetContainer = document.getElementById('resetContainer');
    const infoDiv = document.getElementById('selectedInfo');
    
    infoDiv.innerHTML = `
        <div class="selected-song-name">${songTitle}</div>
        <div class="selected-version-name">${version.venue} (${version.date})</div>
        <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e;">⚠️ YOU NEED: Track ${version.trackNumber}</strong>
            <div style="color: #78350f; font-size: 0.9em; margin-top: 5px;">
                Look for file: <code style="background: #fde68a; padding: 2px 6px; border-radius: 3px;">${version.archiveId}.mp3</code>
            </div>
        </div>
    `;
    
    // Setup Smart Download button
    const smartDownloadBtn = document.getElementById('smartDownloadBtn');
    smartDownloadBtn.onclick = () => handleSmartDownload(songTitle, version);
    
    // Setup regular download button
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.onclick = () => {
        const urls = generateArchiveUrls(version.archiveId, version.trackNumber);
        window.open(urls.download, '_blank');
        
        setTimeout(() => {
            alert(`📥 DOWNLOADING FULL SHOW:

Look for the MP3 file (usually 100-200MB)
It will be named something like: ${version.archiveId}.mp3

Track ${version.trackNumber} is "${songTitle}"

Right-click the MP3 filename → Save Link As...`);
        }, 500);
        
        step5.classList.remove('hidden');
        resetContainer.classList.remove('hidden');
    };
    
    // Setup Moises button
    const moisesBtn = document.getElementById('moisesBtn');
    moisesBtn.onclick = () => {
        window.open('https://studio.moises.ai/', '_blank');
        step5.classList.remove('hidden');
        resetContainer.classList.remove('hidden');
    };
    
    // Setup Setlist.fm button
    const setlistBtn = document.getElementById('setlistBtn');
    setlistBtn.onclick = () => handleSetlistClick(version.archiveId);
    
    // Setup YouTube search button (if you have it)
    const youtubeBtn = document.getElementById('youtubeSearchBtn');
    if (youtubeBtn) {
        youtubeBtn.onclick = () => searchYouTube(songTitle);
    }
    
    step4.classList.remove('hidden');
    resetContainer.classList.remove('hidden');
}

// ============================================================================
// SMART DOWNLOAD
// ============================================================================

function handleSmartDownload(songTitle, version) {
    console.log('📥 Starting Smart Download for:', songTitle, version);
    
    // Show progress UI
    const progressContainer = document.getElementById('progressContainer');
    const progressMessage = document.getElementById('progressMessage');
    const progressBar = document.getElementById('progressBar');
    
    progressContainer.classList.remove('hidden');
    progressMessage.textContent = 'Initializing Smart Download...';
    progressBar.style.width = '0%';
    
    // Check if AudioSplitter is loaded
    if (typeof AudioSplitter === 'undefined') {
        showToast('⚠️ Audio Splitter not loaded');
        progressContainer.classList.add('hidden');
        return;
    }
    
    const splitter = new AudioSplitter();
    
    // Start extraction
    splitter.extractSongFromShow(version.archiveId, version.trackNumber, songTitle)
        .then(blob => {
            console.log('✅ Smart Download complete!', blob);
            progressMessage.textContent = 'Download complete!';
            progressBar.style.width = '100%';
            
            // Create download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${songTitle} - ${version.venue} - ${version.date}.mp3`;
            a.click();
            
            setTimeout(() => {
                progressContainer.classList.add('hidden');
                alert(`✅ Downloaded: ${songTitle}

Now upload to Moises.ai to separate stems!`);
            }, 1000);
        })
        .catch(error => {
            console.error('❌ Smart Download failed:', error);
            progressContainer.classList.add('hidden');
            alert(`❌ Smart Download failed: ${error.message}

Try the regular "Download Full Show" button instead.`);
        });
}

// ============================================================================
// SETLIST.FM INTEGRATION
// ============================================================================

function handleSetlistClick(archiveId) {
    // Detect band from archive ID
    let band = 'Grateful Dead';
    if (archiveId.toLowerCase().includes('phish') || archiveId.startsWith('pt')) {
        band = 'Phish';
    } else if (archiveId.toLowerCase().includes('jgb') || archiveId.toLowerCase().includes('garcia')) {
        band = 'Jerry Garcia Band';
    } else if (archiveId.toLowerCase().includes('wsp') || archiveId.toLowerCase().includes('widespread') || archiveId.toLowerCase().includes('panic')) {
        band = 'Widespread Panic';
    }
    
    // Extract date from archive ID (format: gd1981-03-14 or similar)
    const dateMatch = archiveId.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
        const [_, year, month, day] = dateMatch;
        const setlistUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(band)}+${month}/${day}/${year}`;
        window.open(setlistUrl, '_blank');
    } else {
        const setlistUrl = `https://www.setlist.fm/search?query=${encodeURIComponent(band)}`;
        window.open(setlistUrl, '_blank');
    }
}

// ============================================================================
// YOUTUBE SEARCH (Optional)
// ============================================================================

function searchYouTube(songTitle) {
    const songData = allSongs.find(s => s.title === songTitle);
    const bandName = songData ? songData.band : 'Grateful Dead';
    const query = encodeURIComponent(`${bandName} ${songTitle} live`);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${query}`;
    window.open(youtubeUrl, '_blank');
}


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateArchiveUrls(archiveId, trackNumber) {
    return {
        details: `https://archive.org/details/${archiveId}`,
        download: `https://archive.org/download/${archiveId}/`
    };
}

function searchArchiveForSong(songTitle, bandName) {
    const searchUrl = `https://archive.org/search.php?query=creator%3A%22${encodeURIComponent(bandName)}%22+AND+%22${encodeURIComponent(songTitle)}%22+soundboard&sort=-downloads`;
    window.open(searchUrl, '_blank');
}

// ============================================================================
// RESET WORKFLOW
// ============================================================================

function resetWorkflow() {
    selectedSong = null;
    selectedVersion = null;
    
    // Hide all steps except step 1
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    document.getElementById('step5').classList.add('hidden');
    document.getElementById('resetContainer').classList.add('hidden');
    
    // Clear selections
    document.querySelectorAll('.song-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// END OF APP.JS
// ============================================================================
// ============================================================================
// BAND RESOURCES SYSTEM
// Renders collaborative band resources from bandKnowledgeBase
// ============================================================================

function showBandResources(songTitle) {
    const step2 = document.getElementById('step2');
    step2.classList.remove('hidden');
    
    // Update title with song name
    const titleEl = document.getElementById('step2Title');
    if (titleEl) titleEl.innerHTML = 'Song DNA: <span style="color:var(--accent-light,#818cf8)">' + songTitle + '</span>';
    document.getElementById('bandResourcesSubtitle').textContent = 
        `Everything your band needs at a glance`;
    
    // Get band data from data.js if available
    const bandData = bandKnowledgeBase[songTitle] || {};
    
    // Render each section IN PARALLEL for fast loading
    Promise.all([
        renderRefVersions(songTitle, bandData),
        renderPersonalTabs(songTitle),
        renderChart(songTitle),
        renderMoisesStems(songTitle, bandData),
        renderPracticeTracks(songTitle, bandData),
        renderHarmoniesEnhanced(songTitle, bandData),
        renderRehearsalNotesWithStorage(songTitle),
        renderSongStructure(songTitle),
        renderGigNotes(songTitle, bandData),
        renderCoverMe(songTitle),
        renderSongInPlaylists(songTitle),
        populateSongMetadata(songTitle)
    ]).catch(error => {
        console.error('Error rendering sections:', error);
    });
}


// ============================================================================
// CHORD CHART
// ============================================================================

// ============================================================================
// PERSONAL TAB LINKS
// ============================================================================

async function renderPersonalTabs(songTitle) {
    const container = document.getElementById('personalTabsContainer');
    const tabs = await loadPersonalTabs(songTitle);

    // Email → member key mapping for legacy data
    const emailToKey = {
        'drewmerrill1029@gmail.com': 'drew',
        'cmjalbert@gmail.com': 'chris',
        'brian@hrestoration.com': 'brian',
        'pierce.d.hale@gmail.com': 'pierce',
        'jnault@fegholdings.com': 'jay'
    };

    const tabsByMember = {};
    (tabs || []).forEach((tab, index) => {
        // Resolve to short key: try memberKey first, then map email addedBy
        let key = tab.memberKey || emailToKey[tab.addedBy] || tab.addedBy || 'unknown';
        if (!tabsByMember[key]) tabsByMember[key] = [];
        tabsByMember[key].push({ ...tab, _index: index });
    });

    // Determine current user's member key
    const currentMemberKey = getCurrentMemberKey();

    const memberHTML = Object.entries(bandMembers).map(([key, member]) => {
        const memberTabs = tabsByMember[key] || [];
        const isMe = (key === currentMemberKey);
        const emoji = { drew: '🎸', chris: '🎸', brian: '🎸', pierce: '🎹', jay: '🥁' }[key] || '👤';
        const tabItems = memberTabs.map(tab => `
            <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;gap:8px;align-items:center;margin-bottom:6px">
                <a href="${tab.url}" target="_blank" style="flex:1;color:var(--accent-light);font-size:0.88em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${tab.url}">${tab.label || tab.notes || tab.url}</a>
                ${tab.notes && tab.label ? `<span style="color:var(--text-dim);font-size:0.75em;flex-shrink:0">${tab.notes}</span>` : ''}
                ${isMe ? `<button onclick="deletePersonalTab('${songTitle.replace(/'/g,"\\'")}',${tab._index})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.85em;flex-shrink:0" title="Delete">✕</button>` : ''}
            </div>
        `).join('');

        return `
        <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:${memberTabs.length > 0 || isMe ? '10px' : '0'}">
                <span style="font-size:1.2em">${emoji}</span>
                <strong style="color:var(--accent-light);font-size:0.95em">${member.name}</strong>
                <span style="color:var(--text-dim);font-size:0.78em">${member.role}</span>
                ${memberTabs.length > 0 ? `<span style="margin-left:auto;background:rgba(16,185,129,0.15);color:var(--green);font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:600">${memberTabs.length} ref${memberTabs.length>1?'s':''}</span>` : `<span style="margin-left:auto;color:var(--text-dim);font-size:0.75em">No refs yet</span>`}
            </div>
            ${tabItems || ''}
            <div id="addTabInline_${key}" style="display:none">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
                    <input type="text" id="tabUrl_${key}" placeholder="URL (Ultimate Guitar, Chordify…)" class="app-input" style="font-size:0.82em">
                    <input type="text" id="tabLabel_${key}" placeholder="Label (e.g. 'My Chord Chart')" class="app-input" style="font-size:0.82em">
                </div>
                <input type="text" id="tabNotes_${key}" placeholder="Notes (optional)" class="app-input" style="font-size:0.82em;margin-top:6px">
                <div style="display:flex;gap:6px;margin-top:8px">
                    <button onclick="addPersonalTabForMember('${songTitle.replace(/'/g,"\\'")}','${key}')" class="btn btn-primary btn-sm">➕ Add</button>
                    <button onclick="document.getElementById('addTabInline_${key}').style.display='none';document.getElementById('addTabBtn_${key}').style.display='block'" class="btn btn-ghost btn-sm">Cancel</button>
                </div>
            </div>
            <button id="addTabBtn_${key}" onclick="document.getElementById('addTabInline_${key}').style.display='block';this.style.display='none'" class="btn btn-ghost btn-sm" style="margin-top:${memberTabs.length>0?'8':'4'}px;width:100%">+ Add My Reference</button>
        </div>`;
    }).join('');

    container.innerHTML = memberHTML || '<div style="padding:20px;color:var(--text-dim)">No members found</div>';
}
function getCurrentMemberKey() {
    // Try localStorage first
    const stored = localStorage.getItem('deadcetera_current_user');
    if (stored && bandMembers[stored]) return stored;
    // Fall back to email match
    if (currentUserEmail) {
        const emailToKey = {
            'drewmerrill1029@gmail.com': 'drew',
            'cmjalbert@gmail.com': 'chris',
            'brian@hrestoration.com': 'brian',
            'pierce.d.hale@gmail.com': 'pierce',
            'jnault@fegholdings.com': 'jay'
        };
        return emailToKey[currentUserEmail] || null;
    }
    return null;
}

// Resolve a display name from any identifier (email, member key, etc.)
function getBandMemberName(identifier) {
    if (!identifier) return 'Unknown';
    // Direct key match (drew, chris, brian, etc.)
    if (bandMembers && bandMembers[identifier]?.name) return bandMembers[identifier].name;
    // Search by email property
    if (bandMembers) {
        const entry = Object.entries(bandMembers).find(([key, member]) =>
            member.email === identifier ||
            member.email?.toLowerCase() === identifier.toLowerCase() ||
            key.toLowerCase() === identifier.toLowerCase()
        );
        if (entry) return entry[1].name;
    }
    // Fallback: extract from email (drewmerrill1029@gmail.com → Drew)
    if (identifier.includes('@')) {
        const emailName = identifier.split('@')[0].replace(/[0-9]/g, '').replace(/[._]/g, ' ');
        return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return identifier;
}

async function addPersonalTabForMember(songTitle, memberKey) {
    const urlInput = document.getElementById(`tabUrl_${memberKey}`);
    const labelInput = document.getElementById(`tabLabel_${memberKey}`);
    const notesInput = document.getElementById(`tabNotes_${memberKey}`);
    const url = urlInput?.value.trim();
    if (!url || !url.startsWith('http')) { alert('Please enter a valid URL starting with http'); return; }
    const tab = {
        url,
        label: labelInput?.value.trim() || '',
        notes: notesInput?.value.trim() || '',
        memberKey,
        addedBy: currentUserEmail,
        dateAdded: new Date().toLocaleDateString()
    };
    let tabs = await loadPersonalTabs(songTitle) || [];
    tabs.push(tab);
    await savePersonalTabs(songTitle, tabs);
    await renderPersonalTabs(songTitle);
}

async function addPersonalTab() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) {
        alert('Please select a song first!');
        return;
    }
    
    const urlInput = document.getElementById('tabUrlInput');
    const notesInput = document.getElementById('tabNotesInput');
    
    const url = urlInput.value.trim();
    if (!url) {
        alert('Please paste a tab URL!');
        return;
    }
    
    // Validate URL
    if (!url.startsWith('http')) {
        alert('Please paste a valid URL starting with http:// or https://');
        return;
    }
    
    const tab = {
        url: url,
        notes: notesInput.value.trim(),
        addedBy: currentUserEmail,
        dateAdded: new Date().toLocaleDateString()
    };
    
    // Load existing tabs
    let tabs = await loadPersonalTabs(songTitle) || [];
    
    // Add new tab
    tabs.push(tab);
    
    // Save to Drive
    await savePersonalTabs(songTitle, tabs);
    
    // Clear form
    urlInput.value = '';
    notesInput.value = '';
    
    // Re-render
    await renderPersonalTabs(songTitle);
}

async function deletePersonalTab(songTitle, index) {
    if (!confirm('Delete this tab link?')) return;
    
    let tabs = await loadPersonalTabs(songTitle) || [];
    tabs.splice(index, 1);
    
    await savePersonalTabs(songTitle, tabs);
    await renderPersonalTabs(songTitle);
}

// Storage functions
async function savePersonalTabs(songTitle, tabs) {
    return await saveBandDataToDrive(songTitle, 'personal_tabs', tabs);
}

async function loadPersonalTabs(songTitle) {
    return await loadBandDataFromDrive(songTitle, 'personal_tabs') || [];
}

console.log('📑 Personal tabs system loaded');

// ============================================================================
// THE CHART — Shared chord chart (replaces Ultimate Guitar)
// ============================================================================

async function renderChart(songTitle) {
    const container = document.getElementById('chartContainer');
    if (!container) return;

    container.innerHTML = '<p style="padding:10px;color:var(--text-dim)">Loading chart…</p>';

    const chartData = await loadBandDataFromDrive(songTitle, 'chart');
    const chartText = chartData?.text || '';
    const safeSong = songTitle.replace(/'/g, "\\'");

    if (chartText.trim()) {
        const meta = [];
        if (chartData.key) meta.push(`🔑 ${chartData.key}`);
        if (chartData.capo) meta.push(`Capo ${chartData.capo}`);
        const metaLine = meta.length ? `<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:10px">${meta.join('  ·  ')}</div>` : '';

        container.innerHTML = `
            ${metaLine}
            <div id="chartPreview" style="background:rgba(0,0,0,0.3);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;padding:16px;overflow-x:auto">
                <pre id="chartPreviewText" style="font-family:'Courier New','Menlo','Monaco',monospace;font-size:14px;line-height:1.7;color:#e2e8f0;white-space:pre;overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0">${renderChartWithHighlighting(chartText)}</pre>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" onclick="editChart('${safeSong}')">✏️ Edit Chart</button>
                <button class="btn btn-ghost btn-sm" onclick="searchUGForChart('${safeSong}')" style="color:#f59e0b;border-color:rgba(245,158,11,0.3)">🔍 Search UG</button>
                <button class="btn btn-ghost btn-sm" onclick="openGigMode('${safeSong}')" style="color:#10b981;border-color:rgba(16,185,129,0.3)">🎸 Gig Mode</button>
                <button class="btn btn-ghost btn-sm" onclick="openPracticeMode('${safeSong}')" style="color:#a78bfa;border-color:rgba(167,139,250,0.3)">🎯 Practice</button>
                <button class="btn btn-ghost btn-sm" onclick="exportChartToUG('${safeSong}')" style="color:#a78bfa;border-color:rgba(167,139,250,0.3)" title="Copy chart & open UG submission">📤 Publish</button>
                <button class="btn btn-ghost btn-sm" onclick="openRehearsalMode('${safeSong}')" style="color:#667eea;border-color:rgba(102,126,234,0.3)">🔄 Rehearsal Mode</button>
            </div>
        `;
    } else {
        // Check if there's a rehearsal_crib we can suggest importing
        const crib = await loadBandDataFromDrive(songTitle, 'rehearsal_crib');
        const importBtn = crib ? `<button class="btn btn-ghost btn-sm" onclick="importCribToChart('${safeSong}')" style="margin-top:8px">📥 Import from Rehearsal Crib</button>` : '';

        container.innerHTML = `
            <div style="text-align:center;padding:24px 16px;color:var(--text-dim)">
                <div style="font-size:2em;margin-bottom:8px">🎸</div>
                <div style="font-size:0.95em;font-weight:600;color:var(--text-muted);margin-bottom:6px">No chord chart yet</div>
                <div style="font-size:0.82em;margin-bottom:14px">Paste from Ultimate Guitar or auto-import</div>
                <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                    <button class="btn btn-primary" onclick="searchUGForChart('${safeSong}')">🔍 Search Ultimate Guitar</button>
                    <button class="btn btn-ghost" onclick="editChart('${safeSong}')">✏️ Paste Manually</button>
                </div>
                ${importBtn}
            </div>
        `;
    }
}

function renderChartWithHighlighting(text) {
    // Highlight chord lines vs lyric lines
    // A chord line is one where most "words" look like chords (A-G with optional modifiers)
    return text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        // Section headers: [Verse], [Chorus], etc.
        if (/^\[.+\]$/.test(trimmed)) {
            return `<span class="chart-section-header">${escapeHtml(trimmed)}</span>`;
        }
        // Chord line detection: most tokens match chord pattern
        if (isChordLine(trimmed)) {
            return `<span class="chart-chord-line">${escapeHtml(line)}</span>`;
        }
        // Regular lyric line
        return escapeHtml(line);
    }).join('\n');
}

// Smart renderer: pairs chord lines with lyric lines so chords float above the correct syllable.
// Falls back to plain highlighting for non-paired lines (section headers, standalone chords, tabs).
function renderChartSmart(text) {
    const lines = text.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Empty line → spacing div
        if (!trimmed) {
            out.push('<div class="cl-blank"></div>');
            i++;
            continue;
        }

        // Section header: [Verse], [Chorus], etc.
        if (/^\[.+\]$/.test(trimmed)) {
            out.push(`<div class="chart-section-header">${escapeHtml(trimmed)}</div>`);
            i++;
            continue;
        }

        // Tab line (e|---, B|---, etc.) — render as-is in monospace
        if (/^[eEBGDAdgba]\|/.test(trimmed) || /^[\-|0-9hpbr\/\\~x\s]+$/.test(trimmed) && trimmed.includes('-')) {
            out.push(`<div class="cl-tab-line">${escapeHtml(line)}</div>`);
            i++;
            continue;
        }

        // Chord line followed by lyric line → pair them
        if (isChordLine(trimmed)) {
            const nextLine = (i + 1 < lines.length) ? lines[i + 1] : '';
            const nextTrimmed = nextLine.trim();

            // If next line is a lyric (not empty, not a chord line, not a section header)
            if (nextTrimmed && !isChordLine(nextTrimmed) && !/^\[.+\]$/.test(nextTrimmed) && !/^[eEBGDAdgba]\|/.test(nextTrimmed)) {
                out.push(buildChordLyricPair(line, nextLine));
                i += 2;
                continue;
            }

            // Standalone chord line (no lyric below, e.g. intro: "E7  D  E7  D  E7")
            out.push(`<div class="cl-line"><span class="cl-pair"><span class="cl-chord">${escapeHtml(trimmed)}</span></span></div>`);
            i++;
            continue;
        }

        // Plain lyric line (no chords above)
        out.push(`<div class="cl-lyric-only">${escapeHtml(line)}</div>`);
        i++;
    }
    return out.join('\n');
}

function buildChordLyricPair(chordLine, lyricLine) {
    // Find chord positions in the chord line
    const chords = [];
    const re = /(\S+)/g;
    let m;
    while ((m = re.exec(chordLine)) !== null) {
        chords.push({ chord: m[1], pos: m.index });
    }

    if (chords.length === 0) {
        return `<div class="cl-lyric-only">${escapeHtml(lyricLine)}</div>`;
    }

    // Build raw split positions from chord positions
    const splitPositions = chords.map(c => c.pos);

    // Snap each split to a word boundary by extending forward
    const adjustedSplits = [0];
    for (let i = 1; i < splitPositions.length; i++) {
        let pos = splitPositions[i];
        if (pos < lyricLine.length && pos > 0 && lyricLine[pos] !== ' ' && lyricLine[pos - 1] !== ' ') {
            while (pos < lyricLine.length && lyricLine[pos] !== ' ') pos++;
        }
        if (pos <= adjustedSplits[adjustedSplits.length - 1]) {
            pos = adjustedSplits[adjustedSplits.length - 1];
        }
        adjustedSplits.push(pos);
    }
    adjustedSplits.push(lyricLine.length);

    // Build segments, then shift trailing spaces to leading spaces of next segment
    const segments = [];
    for (let c = 0; c < chords.length; c++) {
        let text = lyricLine.substring(adjustedSplits[c], adjustedSplits[c + 1]);
        segments.push({ chord: chords[c].chord, text });
    }

    // For proper inline-block rendering: trailing spaces get collapsed,
    // so move any trailing spaces to be leading spaces on the next segment.
    // But KEEP at least one leading space where the original had spaces.
    // Actually simpler: just use &nbsp; for the space between segments.
    
    let html = '<div class="cl-line">';

    for (let c = 0; c < segments.length; c++) {
        let text = segments[c].text;
        if (!text) text = '\u00a0';
        
        // Replace the trailing space(s) with a non-breaking space so inline-block preserves them
        text = text.replace(/ +$/, match => '\u00a0'.repeat(match.length));

        html += `<span class="cl-pair"><span class="cl-chord">${escapeHtml(segments[c].chord)}</span><span class="cl-lyric">${escapeHtml(text)}</span></span>`;
    }

    html += '</div>';
    return html;
}

function isChordLine(line) {
    // Common chord pattern: letter A-G, optional #/b, optional m/maj/min/dim/aug/sus/add/7/9/11/13
    const chordPattern = /^[A-G][#b]?(m|maj|min|dim|aug|sus[24]?|add[0-9]*|[0-9]{0,2})(\/[A-G][#b]?)?$/;
    const tokens = line.trim().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return false;
    // Consider it a chord line if >60% of tokens look like chords and there's at least one
    const chordCount = tokens.filter(t => chordPattern.test(t) || t === '|' || t === '||' || t === '/' || t === '-').length;
    return chordCount / tokens.length >= 0.6 && chordCount >= 1;
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function editChart(songTitle) {
    const container = document.getElementById('chartContainer');
    if (!container) return;

    const chartData = await loadBandDataFromDrive(songTitle, 'chart') || {};
    const chartText = chartData?.text || '';
    const safeSong = songTitle.replace(/'/g, "\\'");

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
            <div style="font-size:0.82em;color:var(--text-dim);line-height:1.4">
                Paste chord chart from Ultimate Guitar or type your own.<br>
                Use <code>[Verse]</code>, <code>[Chorus]</code>, etc. for section headers.<br>
                Chords go on lines above lyrics — just like Ultimate Guitar.
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <div style="flex:1;min-width:120px">
                    <label style="display:block;font-size:0.78em;color:var(--text-dim);margin-bottom:3px;font-weight:600">Key</label>
                    <input type="text" id="chartKeyInput" value="${chartData.key || ''}" placeholder="e.g. G, Am" class="app-input" style="font-size:0.85em">
                </div>
                <div style="flex:1;min-width:120px">
                    <label style="display:block;font-size:0.78em;color:var(--text-dim);margin-bottom:3px;font-weight:600">Capo</label>
                    <input type="number" id="chartCapoInput" value="${chartData.capo || 0}" min="0" max="12" class="app-input" style="font-size:0.85em">
                </div>
            </div>
            <textarea id="chartEditTextarea" rows="20"
                style="width:100%;background:rgba(0,0,0,0.3);border:1px solid var(--border,rgba(255,255,255,0.12));border-radius:8px;color:#e2e8f0;font-family:'Courier New','Menlo','Monaco',monospace;font-size:14px;line-height:1.6;padding:12px;resize:vertical;box-sizing:border-box;min-height:300px"
                placeholder="[Intro]&#10;G  C  D  G&#10;&#10;[Verse 1]&#10;G            C          D&#10;Truckin', got my chips cashed in&#10;G            C          D&#10;Keep truckin', like the do-dah man">${chartText}</textarea>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-primary" onclick="saveChart('${safeSong}')">💾 Save Chart</button>
                <button class="btn btn-ghost" onclick="renderChart('${safeSong}')">Cancel</button>
            </div>
        </div>
    `;

    document.getElementById('chartEditTextarea').focus();
}

async function saveChart(songTitle) {
    const text = document.getElementById('chartEditTextarea')?.value || '';
    const key = document.getElementById('chartKeyInput')?.value?.trim() || '';
    const capo = parseInt(document.getElementById('chartCapoInput')?.value) || 0;
    const member = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'unknown';

    const chartData = {
        text: text,
        key: key,
        capo: capo,
        updatedBy: member,
        updatedAt: new Date().toISOString()
    };

    try {
        await saveBandDataToDrive(songTitle, 'chart', chartData);
        showToast('✅ Chart saved!');
        await renderChart(songTitle);
    } catch(e) {
        showToast('❌ Save failed — are you signed in?');
    }
}

async function importCribToChart(songTitle) {
    const crib = await loadBandDataFromDrive(songTitle, 'rehearsal_crib');
    if (!crib) { showToast('No crib data found'); return; }
    const member = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'unknown';
    const chartData = {
        text: typeof crib === 'string' ? crib : JSON.stringify(crib),
        key: '',
        capo: 0,
        updatedBy: member,
        updatedAt: new Date().toISOString()
    };
    await saveBandDataToDrive(songTitle, 'chart', chartData);
    showToast('✅ Imported crib notes as chart!');
    await renderChart(songTitle);
}

console.log('🎸 Chart system loaded');

// ── Export / Publish to Ultimate Guitar ──────────────────────────────────────
async function exportChartToUG(songTitle) {
    const chartData = await loadBandDataFromDrive(songTitle, 'chart');
    if (!chartData?.text) { showToast('⚠️ No chart to export'); return; }

    // Apply current transpose if any
    let text = chartData.text;
    const savedTranspose = await loadBandDataFromDrive(songTitle, 'transpose').catch(() => null);
    if (savedTranspose && savedTranspose !== 0) {
        text = transposeChartText(text, savedTranspose);
    }

    // Find the song's artist
    const songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.title === songTitle);
    const artist = songData?.band || songData?.artist || '';

    // Copy to clipboard in UG format
    const ugText = text;
    try {
        await navigator.clipboard.writeText(ugText);
        showToast('📋 Chart copied to clipboard!');
    } catch(e) {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = ugText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('📋 Chart copied!');
    }

    // Open UG submission page
    const ugSubmitUrl = 'https://www.ultimate-guitar.com/contribution/submit/tabs';
    const openIt = confirm(
        `Chart copied to clipboard!\\n\\n` +
        `Song: ${songTitle}\\nArtist: ${artist}\\n` +
        `Key: ${chartData.key || 'not set'}${savedTranspose ? ' (transposed ' + savedTranspose + ')' : ''}\\n\\n` +
        `Open Ultimate Guitar's submission page?\\nYou can paste your chart there.`
    );
    if (openIt) {
        window.open(ugSubmitUrl, '_blank');
    }
}

// ============================================================================
// ULTIMATE GUITAR IMPORT — Search, pick, and bulk-import chord charts
// ============================================================================

const UG_PROXY = 'https://deadcetera-proxy.drewmerrill.workers.dev';

async function searchUGForChart(songTitle) {
    const container = document.getElementById('chartContainer');
    if (!container) return;
    const safeSong = songTitle.replace(/'/g, "\\'");

    // Find band name
    const songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.title === songTitle);
    const artist = songData ? getFullBandName(songData.band) : '';

    container.innerHTML = `
        <div style="padding:16px;text-align:center">
            <div style="font-size:1.1em;margin-bottom:12px">🔍 Searching Ultimate Guitar…</div>
            <div style="color:var(--text-dim);font-size:0.82em">${songTitle} — ${artist}</div>
        </div>
    `;

    try {
        const resp = await fetch(`${UG_PROXY}/ug-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: songTitle, artist })
        });
        const data = await resp.json();
        const results = data.results || [];

        if (results.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:20px;color:var(--text-dim)">
                    <div style="font-size:1.5em;margin-bottom:8px">🤷</div>
                    <div style="margin-bottom:8px">No chord charts found on Ultimate Guitar for "${songTitle}"</div>
                    <button class="btn btn-ghost btn-sm" onclick="editChart('${safeSong}')">✏️ Add Chart Manually</button>
                    <button class="btn btn-ghost btn-sm" onclick="renderChart('${safeSong}')" style="margin-left:6px">← Back</button>
                </div>
            `;
            return;
        }

        const resultsHTML = results.map((r, i) => {
            const stars = '⭐'.repeat(Math.round(r.rating));
            const safeUrl = r.url.replace(/'/g, "\\'");
            return `
                <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:600;color:var(--text);font-size:0.9em">${r.title} <span style="color:var(--text-dim);font-weight:400">by ${r.artist}</span></div>
                        <div style="font-size:0.78em;color:var(--text-muted);margin-top:3px">
                            ${stars} (${r.votes} votes) · v${r.version}
                            ${r.tonality ? ` · Key: ${r.tonality}` : ''}
                            ${r.capo ? ` · Capo ${r.capo}` : ''}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="importUGTab('${safeSong}', '${safeUrl}', ${i})">Import</button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
                <strong style="color:var(--accent-light);font-size:0.9em">🔍 ${results.length} results from Ultimate Guitar</strong>
                <button class="btn btn-ghost btn-sm" onclick="renderChart('${safeSong}')">← Back</button>
            </div>
            ${resultsHTML}
        `;
    } catch(e) {
        container.innerHTML = `
            <div style="text-align:center;padding:20px;color:var(--red)">
                <div style="margin-bottom:8px">❌ Search failed: ${e.message}</div>
                <button class="btn btn-ghost btn-sm" onclick="renderChart('${safeSong}')">← Back</button>
            </div>
        `;
    }
}

async function importUGTab(songTitle, tabUrl, resultIndex) {
    // Find the button and show loading state
    const buttons = document.querySelectorAll('#chartContainer .btn-primary');
    const btn = buttons[resultIndex];
    if (btn) { btn.textContent = '⏳…'; btn.disabled = true; }

    try {
        const resp = await fetch(`${UG_PROXY}/ug-fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: tabUrl })
        });
        const tab = await resp.json();

        if (tab.error || !tab.content) {
            showToast('❌ Could not fetch tab content');
            if (btn) { btn.textContent = 'Import'; btn.disabled = false; }
            return;
        }

        const member = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'unknown';
        const chartData = {
            text: tab.content,
            key: tab.tonality || '',
            capo: tab.capo || 0,
            updatedBy: member,
            updatedAt: new Date().toISOString(),
            source: 'ultimate-guitar',
            sourceUrl: tabUrl,
            sourceRating: tab.rating,
            sourceVotes: tab.votes
        };

        await saveBandDataToDrive(songTitle, 'chart', chartData);
        showToast(`✅ Chart imported for "${songTitle}"!`);
        await renderChart(songTitle);
    } catch(e) {
        showToast('❌ Import failed: ' + e.message);
        if (btn) { btn.textContent = 'Import'; btn.disabled = false; }
    }
}

// ── Bulk Import ──────────────────────────────────────────────────────────────
// Admin tool: auto-import charts for all songs from UG

async function bulkImportUGCharts() {
    const songs = typeof allSongs !== 'undefined' ? allSongs : [];
    if (songs.length === 0) { showToast('No songs loaded'); return; }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'ugBulkModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
        <div style="background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="margin:0;color:white">🎸 Bulk Import from Ultimate Guitar</h3>
                <button onclick="cancelBulkImport()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.3em">✕</button>
            </div>
            <div style="font-size:0.85em;color:var(--text-muted);margin-bottom:16px;line-height:1.5">
                This will search UG for each song and auto-import the highest-rated "Chords" version.
                Songs that already have a chart will be skipped unless you check "Overwrite existing".
            </div>
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer">
                <input type="checkbox" id="ugBulkOverwrite" style="accent-color:var(--accent)">
                <span style="color:var(--text);font-size:0.88em">Overwrite existing charts</span>
            </label>
            <div style="display:flex;gap:8px;margin-bottom:16px">
                <button id="ugBulkStartBtn" class="btn btn-primary" onclick="runBulkImport()" style="flex:1">
                    🚀 Import All ${songs.length} Songs
                </button>
                <button class="btn btn-ghost" onclick="cancelBulkImport()">Cancel</button>
            </div>
            <div id="ugBulkProgress" style="display:none">
                <div style="display:flex;justify-content:space-between;font-size:0.82em;color:var(--text-muted);margin-bottom:6px">
                    <span id="ugBulkStatus">Starting…</span>
                    <span id="ugBulkCount">0 / ${songs.length}</span>
                </div>
                <div style="background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;height:8px;margin-bottom:10px">
                    <div id="ugBulkBar" style="height:100%;background:#10b981;width:0%;transition:width 0.3s"></div>
                </div>
                <div id="ugBulkLog" style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px;max-height:300px;overflow-y:auto;font-family:monospace;font-size:0.75em;color:var(--text-dim);line-height:1.6"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

let ugBulkCancelled = false;

function cancelBulkImport() {
    ugBulkCancelled = true;
    const modal = document.getElementById('ugBulkModal');
    if (modal) modal.remove();
}

async function runBulkImport() {
    const songs = typeof allSongs !== 'undefined' ? allSongs : [];
    const overwrite = document.getElementById('ugBulkOverwrite')?.checked || false;
    ugBulkCancelled = false;

    const startBtn = document.getElementById('ugBulkStartBtn');
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = '⏳ Running…'; }

    const progress = document.getElementById('ugBulkProgress');
    const status = document.getElementById('ugBulkStatus');
    const count = document.getElementById('ugBulkCount');
    const bar = document.getElementById('ugBulkBar');
    const log = document.getElementById('ugBulkLog');
    if (progress) progress.style.display = 'block';

    let imported = 0, skipped = 0, failed = 0, noResults = 0;

    for (let i = 0; i < songs.length; i++) {
        if (ugBulkCancelled) break;

        const song = songs[i];
        const artist = getFullBandName(song.band);
        const pct = Math.round(((i + 1) / songs.length) * 100);

        if (status) status.textContent = `${song.title}…`;
        if (count) count.textContent = `${i + 1} / ${songs.length}`;
        if (bar) bar.style.width = pct + '%';

        // Check if chart already exists
        if (!overwrite) {
            try {
                const existing = await loadBandDataFromDrive(song.title, 'chart');
                if (existing?.text?.trim()) {
                    skipped++;
                    if (log) log.innerHTML += `<div style="color:#64748b">⏭ ${song.title} — already has chart</div>`;
                    log.scrollTop = log.scrollHeight;
                    continue;
                }
            } catch(e) {}
        }

        // Search UG
        try {
            const resp = await fetch(`${UG_PROXY}/ug-search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song: song.title, artist })
            });
            const data = await resp.json();
            const results = data.results || [];

            if (results.length === 0) {
                noResults++;
                if (log) log.innerHTML += `<div style="color:#f59e0b">🤷 ${song.title} — no results on UG</div>`;
                log.scrollTop = log.scrollHeight;
                // Small delay even on miss
                await new Promise(r => setTimeout(r, 800));
                continue;
            }

            // Pick the best result (already sorted by rating*log(votes))
            const best = results[0];

            // Fetch the tab content
            const tabResp = await fetch(`${UG_PROXY}/ug-fetch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: best.url })
            });
            const tab = await tabResp.json();

            if (!tab.content) {
                failed++;
                if (log) log.innerHTML += `<div style="color:#ef4444">❌ ${song.title} — fetch failed</div>`;
                log.scrollTop = log.scrollHeight;
                await new Promise(r => setTimeout(r, 800));
                continue;
            }

            // Save to Firebase
            const member = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'drew';
            await saveBandDataToDrive(song.title, 'chart', {
                text: tab.content,
                key: tab.tonality || '',
                capo: tab.capo || 0,
                updatedBy: member,
                updatedAt: new Date().toISOString(),
                source: 'ultimate-guitar',
                sourceUrl: best.url,
                sourceRating: tab.rating,
                sourceVotes: tab.votes
            });

            imported++;
            if (log) log.innerHTML += `<div style="color:#10b981">✅ ${song.title} — ⭐${best.rating.toFixed(1)} (${best.votes} votes)</div>`;
            log.scrollTop = log.scrollHeight;

        } catch(e) {
            failed++;
            if (log) log.innerHTML += `<div style="color:#ef4444">❌ ${song.title} — ${e.message}</div>`;
            log.scrollTop = log.scrollHeight;
        }

        // Rate limit: ~2 seconds between songs (2 requests per song)
        await new Promise(r => setTimeout(r, 2000));
    }

    // Done
    if (status) status.textContent = ugBulkCancelled ? 'Cancelled' : 'Done!';
    if (bar) bar.style.width = '100%';
    if (bar) bar.style.background = ugBulkCancelled ? '#f59e0b' : '#10b981';
    if (log) log.innerHTML += `<div style="color:white;font-weight:700;margin-top:8px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px">
        ✅ Imported: ${imported} · ⏭ Skipped: ${skipped} · 🤷 No results: ${noResults} · ❌ Failed: ${failed}
    </div>`;
    log.scrollTop = log.scrollHeight;
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = '✅ Done — Close'; startBtn.onclick = () => cancelBulkImport(); }
}

console.log('🔍 UG Import system loaded');

// ============================================================================
// GIG MODE — Full-screen, iPad-optimized, stage-ready chord chart view
// ============================================================================

let gigQueue = [];     // [{title, band}, ...]
let gigIndex = 0;      // current position in queue
let gigScrollTimer = null;
let gigScrollSpeed = 0;  // 0 = off, 1-5 = speed levels
let gigWakeLock = null;

function openGigMode(songTitle) {
    const songData = (typeof allSongs !== 'undefined' ? allSongs : [])
        .find(s => s.title === songTitle);
    gigQueue = [{ title: songTitle, band: songData?.band || '' }];
    gigIndex = 0;
    gigShow();
}

async function openGigModeFromSetlist(setlistId) {
    showToast('Loading setlist…', 1200);
    const setlists = await loadBandDataFromDrive('_band', 'setlists') || {};
    const setlist = setlists[setlistId];
    if (!setlist || !setlist.songs || setlist.songs.length === 0) {
        showToast('⚠️ No songs in this setlist');
        return;
    }
    gigQueue = toArray(setlist.songs).map(s => ({
        title: typeof s === 'string' ? s : s.title,
        band: typeof s === 'string' ? '' : (s.band || '')
    }));
    gigIndex = 0;
    gigShow();
}

function gigEnsureOverlay() {
    if (document.getElementById('gigOverlay')) return;

    const el = document.createElement('div');
    el.id = 'gigOverlay';
    el.innerHTML = `
        <!-- HEADER -->
        <div class="gig-header">
            <button class="gig-close" onclick="closeGigMode()" title="Close (Esc)">✕</button>
            <div class="gig-title-block">
                <div class="gig-song-title" id="gigSongTitle">Song</div>
                <div class="gig-song-meta" id="gigSongMeta"></div>
            </div>
            <div class="gig-nav-block">
                <button class="gig-nav-btn" id="gigPrevBtn" onclick="gigNavigate(-1)">‹</button>
                <span class="gig-position" id="gigPosition"></span>
                <button class="gig-nav-btn" id="gigNextBtn" onclick="gigNavigate(1)">›</button>
            </div>
        </div>

        <!-- CONTROLS BAR -->\n is replaced below -->
        <div class="gig-controls" id="gigControls">
            <button class="gig-ctrl-btn" onclick="gigAdjustFont(-1)">A−</button>
            <button class="gig-ctrl-btn" onclick="gigAdjustFont(1)">A+</button>
            <div class="gig-ctrl-divider"></div>
            <button class="gig-ctrl-btn" id="gigScrollBtn" onclick="gigToggleScroll()">▶ Scroll</button>
            <input type="range" id="gigScrollSpeedSlider" min="1" max="5" value="2"
                oninput="gigSetScrollSpeed(this.value)" class="gig-speed-slider"
                style="display:none;width:80px">
            <div class="gig-ctrl-divider"></div>
            <button class="gig-ctrl-btn" onclick="gigTranspose(-1)">♭</button>
            <span class="gig-key-display" id="gigKeyDisplay" style="color:#67e8f9;font-weight:700;min-width:32px;text-align:center;font-size:0.85em">—</span>
            <button class="gig-ctrl-btn" onclick="gigTranspose(1)">♯</button>
            <div class="gig-ctrl-divider"></div>
            <button class="gig-ctrl-btn" id="gigBpmBtn" onclick="gigOpenBpmPanel()" title="BPM / Count-off">🥁</button>
            <button class="gig-ctrl-btn" id="gigBrainBtn" onclick="gigToggleBrainTuner()" title="Brain Tuner - memorize lyrics">🧠 Full</button>
            <div style="flex:1"></div>
            <button class="gig-ctrl-btn" id="gigControlsToggle" onclick="gigToggleControlsVisibility()">🙈 Hide</button>
        </div>

        <!-- BPM / COUNT-OFF PANEL (hidden by default) -->
        <div id="gigBpmPanel" style="display:none;position:absolute;top:90px;left:50%;transform:translateX(-50%);background:rgba(30,30,30,0.97);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:16px;z-index:100002;min-width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.6)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <span style="font-weight:700;color:#e2e8f0;font-size:0.95em">🥁 BPM & Count-off</span>
                <button onclick="gigCloseBpmPanel()" style="background:none;border:none;color:#94a3b8;font-size:1.2em;cursor:pointer">✕</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <button class="gig-ctrl-btn" onclick="gigAdjustBpm(-5)">−5</button>
                <button class="gig-ctrl-btn" onclick="gigAdjustBpm(-1)">−</button>
                <span id="gigBpmDisplay" style="color:#fbbf24;font-weight:800;font-size:1.5em;min-width:50px;text-align:center">120</span>
                <button class="gig-ctrl-btn" onclick="gigAdjustBpm(1)">+</button>
                <button class="gig-ctrl-btn" onclick="gigAdjustBpm(5)">+5</button>
                <span style="color:#94a3b8;font-size:0.8em">BPM</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <span style="color:#94a3b8;font-size:0.82em;min-width:60px">Count-off:</span>
                <button class="gig-ctrl-btn" id="gigCountBtn4" onclick="gigSetCountBeats(4)" style="background:rgba(102,126,234,0.3)">4</button>
                <button class="gig-ctrl-btn" id="gigCountBtn3" onclick="gigSetCountBeats(3)">3</button>
                <button class="gig-ctrl-btn" id="gigCountBtn2" onclick="gigSetCountBeats(2)">2</button>
                <button class="gig-ctrl-btn" id="gigCountBtn1" onclick="gigSetCountBeats(1)">1</button>
            </div>
            <button onclick="gigCountOff()" style="width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;font-weight:700;font-size:1em;cursor:pointer;margin-top:4px">🎵 Count Off!</button>
        </div>

        <!-- CHART BODY -->
        <div class="gig-body" id="gigBody">
            <div class="gig-loading" id="gigLoading">Loading…</div>
            <div class="gig-chart-text" id="gigChartText"></div>
            <div class="gig-no-chart hidden" id="gigNoChart">
                <div style="font-size:2.5em;margin-bottom:12px">🎸</div>
                <div style="font-size:1.1em;font-weight:600;color:#94a3b8;margin-bottom:8px">No chart for this song yet</div>
                <div style="font-size:0.85em;color:#64748b">Add one from the song detail → The Chart section</div>
            </div>
        </div>

        <!-- SETLIST BAR (bottom, tap to show song list) -->
        <div class="gig-setlist-bar hidden" id="gigSetlistBar">
            <div class="gig-setlist-pills" id="gigSetlistPills"></div>
        </div>
    `;
    document.body.appendChild(el);

    // Keyboard nav
    document.addEventListener('keydown', gigKeyHandler);

    // Swipe support
    let gigStartX = 0;
    el.addEventListener('touchstart', e => {
        gigStartX = e.touches[0].clientX;
    }, { passive: true });
    el.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - gigStartX;
        if (Math.abs(dx) > 80) gigNavigate(dx < 0 ? 1 : -1);
    }, { passive: true });
}

function gigShow() {
    gigEnsureOverlay();
    const overlay = document.getElementById('gigOverlay');
    overlay.classList.add('gig-visible');
    // Lock background scroll — critical for iOS
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${window.scrollY}px`;
    gigRequestWakeLock();
    gigLoadSong();

    // Show setlist bar if queue > 1
    if (gigQueue.length > 1) {
        document.getElementById('gigSetlistBar').classList.remove('hidden');
        gigRenderSetlistPills();
    } else {
        document.getElementById('gigSetlistBar').classList.add('hidden');
    }
}

function closeGigMode() {
    const overlay = document.getElementById('gigOverlay');
    if (!overlay) return;
    overlay.classList.remove('gig-visible');
    // Restore background scroll
    const scrollY = document.body.style.top;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    window.scrollTo(0, parseInt(scrollY || '0') * -1);
    gigStopScroll();
    gigReleaseWakeLock();
}

async function gigLoadSong() {
    const song = gigQueue[gigIndex];
    if (!song) return;

    // Header
    document.getElementById('gigSongTitle').textContent = song.title;
    document.getElementById('gigPosition').textContent =
        gigQueue.length > 1 ? `${gigIndex + 1} / ${gigQueue.length}` : '';
    document.getElementById('gigPrevBtn').style.opacity = gigIndex > 0 ? '1' : '0.25';
    document.getElementById('gigNextBtn').style.opacity = gigIndex < gigQueue.length - 1 ? '1' : '0.25';

    // Meta
    document.getElementById('gigSongMeta').textContent = '';
    gigLoadMeta(song.title);

    // Reset
    document.getElementById('gigLoading').style.display = 'block';
    document.getElementById('gigChartText').style.display = 'none';
    document.getElementById('gigNoChart').classList.add('hidden');
    gigStopScroll();

    // Load chart, fallback to rehearsal_crib, fallback to gig_notes
    let chartText = null;
    let chartData = null;
    try {
        chartData = await loadBandDataFromDrive(song.title, 'chart');
        if (chartData?.text?.trim()) {
            chartText = chartData.text;
            // Show key/capo in meta
            const meta = [];
            if (chartData.key) meta.push(`🔑 ${chartData.key}`);
            if (chartData.capo) meta.push(`Capo ${chartData.capo}`);
            const existing = document.getElementById('gigSongMeta').textContent;
            if (meta.length && existing) {
                document.getElementById('gigSongMeta').textContent = existing + '  ·  ' + meta.join('  ·  ');
            } else if (meta.length) {
                document.getElementById('gigSongMeta').textContent = meta.join('  ·  ');
            }
        }
    } catch(e) {}

    // Fallback: rehearsal_crib
    if (!chartText) {
        try {
            const crib = await loadBandDataFromDrive(song.title, 'rehearsal_crib');
            if (crib && typeof crib === 'string' && crib.trim()) chartText = crib;
        } catch(e) {}
    }

    // Fallback: gig_notes joined
    if (!chartText) {
        try {
            const gigNotes = toArray(await loadBandDataFromDrive(song.title, 'gig_notes') || []);
            if (gigNotes.length > 0) chartText = gigNotes.join('\n');
        } catch(e) {}
    }

    document.getElementById('gigLoading').style.display = 'none';

    if (chartText && chartText.trim()) {
        const el = document.getElementById('gigChartText');
        el._originalText = chartText;
        el.innerHTML = renderChartSmart(chartText);
        el.style.display = 'block';
        document.getElementById('gigNoChart').classList.add('hidden');
        // Reset transpose — load saved value
        gigTransposeSteps = 0;
        gigOriginalKey = chartData?.key || '';
        try {
            const savedTranspose = await loadBandDataFromDrive(song.title, 'transpose');
            if (savedTranspose && typeof savedTranspose === 'number' && savedTranspose !== 0) {
                gigTransposeSteps = savedTranspose;
                el.innerHTML = renderChartSmart(transposeChartText(chartText, gigTransposeSteps));
            }
        } catch(e) {}
        gigUpdateKeyDisplay();
        // Reset brain tuner
        brainTunerLevel = 0;
        const brainBtn = document.getElementById('gigBrainBtn');
        if (brainBtn) { brainBtn.textContent = '🧠 Full'; brainBtn.style.background = ''; }
        // Load BPM if available
        if (chartData?.bpm) { gigBpm = parseInt(chartData.bpm) || 120; const d = document.getElementById('gigBpmDisplay'); if (d) d.textContent = gigBpm; }
        gigAutoFitFont();
        // Scroll to top
        document.getElementById('gigBody').scrollTop = 0;
    } else {
        document.getElementById('gigChartText').style.display = 'none';
        document.getElementById('gigNoChart').classList.remove('hidden');
    }

    // Update setlist pills
    if (gigQueue.length > 1) gigRenderSetlistPills();
}

async function gigLoadMeta(songTitle) {
    try {
        const meta = await loadBandDataFromDrive(songTitle, 'song_meta') || {};
        const parts = [];
        if (meta.key) parts.push(`🔑 ${meta.key}`);
        if (meta.bpm) parts.push(`🥁 ${meta.bpm} BPM`);
        if (meta.leadSinger) parts.push(`🎤 ${meta.leadSinger.charAt(0).toUpperCase() + meta.leadSinger.slice(1)}`);
        document.getElementById('gigSongMeta').textContent = parts.join('  ·  ');
    } catch(e) {}
}

function gigNavigate(dir) {
    const newIdx = gigIndex + dir;
    if (newIdx < 0 || newIdx >= gigQueue.length) return;
    gigIndex = newIdx;
    gigLoadSong();
}

function gigKeyHandler(e) {
    const overlay = document.getElementById('gigOverlay');
    if (!overlay?.classList.contains('gig-visible')) return;
    if (e.key === 'Escape')     { closeGigMode(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { gigNavigate(1);  e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { gigNavigate(-1); e.preventDefault(); }
    if (e.key === ' ')          { gigToggleScroll(); e.preventDefault(); }
}

// ── Font sizing ──────────────────────────────────────────────────────────────
let gigFontSize = 18;

function gigAdjustFont(delta) {
    gigFontSize = Math.min(36, Math.max(10, gigFontSize + delta * 2));
    const el = document.getElementById('gigChartText');
    if (el) el.style.fontSize = gigFontSize + 'px';
}

function gigAutoFitFont() {
    const isTablet = window.innerWidth >= 768;
    const el = document.getElementById('gigChartText');
    if (!el) return;
    if (!isTablet) {
        gigFontSize = 14;
        el.style.fontSize = gigFontSize + 'px';
        return;
    }
    // iPad: binary-search font size that fits without scrolling
    const body = document.getElementById('gigBody');
    const pre = document.getElementById('gigChartText');
    const availH = body.clientHeight - 32;
    let lo = 12, hi = 32, best = 16;
    for (let i = 0; i < 8; i++) {
        const mid = Math.floor((lo + hi) / 2);
        pre.style.fontSize = mid + 'px';
        if (pre.scrollHeight <= availH) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
    }
    gigFontSize = best;
    pre.style.fontSize = gigFontSize + 'px';
}

// ── Auto-scroll ──────────────────────────────────────────────────────────────
function gigToggleScroll() {
    if (gigScrollTimer) {
        gigStopScroll();
    } else {
        const speed = parseInt(document.getElementById('gigScrollSpeedSlider')?.value || '2');
        gigStartScroll(speed);
    }
}

function gigStartScroll(speed) {
    gigScrollSpeed = speed;
    const body = document.getElementById('gigBody');
    const btn = document.getElementById('gigScrollBtn');
    const slider = document.getElementById('gigScrollSpeedSlider');
    if (btn) btn.textContent = '⏸ Scroll';
    if (slider) slider.style.display = 'inline-block';
    // Speed: pixels per second — must be noticeable even at level 1
    const pxPerSecond = [25, 45, 70, 110, 170][speed - 1] || 45;
    let lastTime = performance.now();
    
    function scrollStep(now) {
        if (!gigScrollTimer) return;
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        if (body) {
            body.scrollTop += pxPerSecond * dt;
            if (body.scrollTop + body.clientHeight >= body.scrollHeight - 5) {
                gigStopScroll();
                return;
            }
        }
        gigScrollTimer = requestAnimationFrame(scrollStep);
    }
    gigScrollTimer = requestAnimationFrame(scrollStep);
}

function gigStopScroll() {
    if (gigScrollTimer) cancelAnimationFrame(gigScrollTimer);
    gigScrollTimer = null;
    const btn = document.getElementById('gigScrollBtn');
    const slider = document.getElementById('gigScrollSpeedSlider');
    if (btn) btn.textContent = '▶ Scroll';
    if (slider) slider.style.display = 'none';
}

function gigSetScrollSpeed(speed) {
    if (gigScrollTimer) {
        gigStopScroll();
        gigStartScroll(parseInt(speed));
    }
}

// ── Transpose ────────────────────────────────────────────────────────────────
let gigTransposeSteps = 0;
const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

function gigTranspose(delta) {
    gigTransposeSteps += delta;
    // Re-render the chart with transposed chords
    const el = document.getElementById('gigChartText');
    if (!el || !el._originalText) return;
    if (gigTransposeSteps === 0) {
        el.innerHTML = renderChartSmart(el._originalText);
    } else {
        el.innerHTML = renderChartSmart(transposeChartText(el._originalText, gigTransposeSteps));
    }
    gigUpdateKeyDisplay();
    // Re-apply brain tuner if active
    if (brainTunerLevel > 0) applyBrainTuner();
    // Save transpose to Firebase for this song
    const song = gigQueue[gigIndex];
    if (song) {
        saveBandDataToDrive(song.title, 'transpose', gigTransposeSteps).catch(() => {});
    }
}

function gigUpdateKeyDisplay() {
    const display = document.getElementById('gigKeyDisplay');
    if (!display) return;
    if (gigTransposeSteps === 0) {
        display.textContent = gigOriginalKey || '—';
        display.style.color = '#67e8f9';
    } else {
        const label = gigOriginalKey ? transposeNote(gigOriginalKey, gigTransposeSteps) : `${gigTransposeSteps > 0 ? '+' : ''}${gigTransposeSteps}`;
        display.textContent = label;
        display.style.color = '#fbbf24';
    }
}

let gigOriginalKey = '';

function transposeChartText(text, steps) {
    return text.split('\n').map(line => {
        if (isChordLine(line.trim())) {
            return line.replace(/([A-G][#b]?)(m|maj|min|dim|aug|sus[24]?|add[0-9]*|[0-9]{0,2})?(\/([A-G][#b]?))?/g,
                (match, root, mod, slashPart, bassNote) => {
                    let result = transposeNote(root, steps) + (mod || '');
                    if (bassNote) result += '/' + transposeNote(bassNote, steps);
                    return result;
                });
        }
        return line;
    }).join('\n');
}

function transposeNote(note, steps) {
    const root = note[0].toUpperCase();
    const accidental = note.length > 1 ? note[1] : '';
    let idx = NOTES_SHARP.indexOf(root);
    if (idx < 0) return note;
    if (accidental === '#') idx = (idx + 1) % 12;
    else if (accidental === 'b') idx = (idx + 11) % 12;
    idx = ((idx + steps) % 12 + 12) % 12;
    // Use sharps for sharp keys, flats for flat keys
    return (steps > 0 ? NOTES_SHARP : NOTES_FLAT)[idx];
}

// ── BPM & Count-off ─────────────────────────────────────────────────────────
let gigBpm = 120;
let gigCountBeats = 4;
let gigCountActive = false;

function gigOpenBpmPanel() {
    const panel = document.getElementById('gigBpmPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function gigCloseBpmPanel() {
    const panel = document.getElementById('gigBpmPanel');
    if (panel) panel.style.display = 'none';
}

function gigAdjustBpm(delta) {
    gigBpm = Math.min(300, Math.max(30, gigBpm + delta));
    const display = document.getElementById('gigBpmDisplay');
    if (display) display.textContent = gigBpm;
}

function gigSetCountBeats(beats) {
    gigCountBeats = beats;
    [1,2,3,4].forEach(n => {
        const btn = document.getElementById(`gigCountBtn${n}`);
        if (btn) btn.style.background = n === beats ? 'rgba(102,126,234,0.3)' : '';
    });
}

function gigCountOff() {
    if (gigCountActive) return;
    gigCountActive = true;
    const interval = 60000 / gigBpm;

    // Create AudioContext for click sounds
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    let beat = 0;
    const display = document.getElementById('gigBpmDisplay');
    const originalText = display ? display.textContent : '';

    function tick() {
        beat++;
        // Visual flash
        if (display) {
            display.textContent = beat;
            display.style.color = beat === 1 ? '#ef4444' : '#fbbf24';
        }

        // Audio click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = beat === 1 ? 1000 : 800;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);

        if (beat >= gigCountBeats) {
            // Done — restore display
            setTimeout(() => {
                if (display) {
                    display.textContent = gigBpm;
                    display.style.color = '#fbbf24';
                }
                gigCountActive = false;
                ctx.close();
            }, interval * 0.8);
        } else {
            setTimeout(tick, interval);
        }
    }

    tick();
}

// ── Brain Tuner (Practice Mode) ──────────────────────────────────────────────
// Progressive lyrics masking: helps memorize lyrics by gradually hiding words
let brainTunerLevel = 0; // 0=full, 1=hide 25%, 2=hide 50%, 3=hide 75%, 4=chords only

function gigToggleBrainTuner() {
    brainTunerLevel = (brainTunerLevel + 1) % 5;
    const btn = document.getElementById('gigBrainBtn');
    const labels = ['🧠 Full', '🧠 Easy', '🧠 Med', '🧠 Hard', '🧠 Chords'];
    if (btn) {
        btn.textContent = labels[brainTunerLevel];
        btn.style.background = brainTunerLevel > 0 ? 'rgba(251,191,36,0.2)' : '';
    }
    applyBrainTuner();
}

function applyBrainTuner() {
    const el = document.getElementById('gigChartText');
    if (!el) return;

    // Work on cl-line divs (chord+lyric pairs) and standalone lyrics
    const clLines = el.querySelectorAll('.cl-line');
    const lyricOnlys = el.querySelectorAll('.cl-lyric-only');

    if (brainTunerLevel === 0) {
        // Restore all
        el.querySelectorAll('.cl-lyric, .cl-lyric-only').forEach(span => {
            if (span._originalText !== undefined) {
                span.textContent = span._originalText;
            }
            span.style.opacity = '1';
        });
        return;
    }

    if (brainTunerLevel === 4) {
        // Chords only — hide all lyrics
        el.querySelectorAll('.cl-lyric, .cl-lyric-only').forEach(span => {
            if (span._originalText === undefined) span._originalText = span.textContent;
            span.textContent = span._originalText.replace(/\S/g, '·');
            span.style.opacity = '0.3';
        });
        return;
    }

    // Levels 1-3: progressive masking per LINE
    // Level 1 (Easy): mask 25% of words
    // Level 2 (Med): mask 50% of words
    // Level 3 (Hard): mask 75% BUT keep first word(s) of each line visible
    const maskPct = [0, 0.25, 0.5, 0.75][brainTunerLevel];

    // Process each cl-line as a unit
    clLines.forEach((line, lineIdx) => {
        const lyricSpans = line.querySelectorAll('.cl-lyric');
        // Collect all words across spans in this line
        let wordIndex = 0;
        let isFirstWord = true;
        lyricSpans.forEach((span) => {
            if (span._originalText === undefined) span._originalText = span.textContent;
            const text = span._originalText;
            const parts = text.split(/(\s+)/);
            const masked = parts.map((part) => {
                if (/^\s+$/.test(part)) return part;
                wordIndex++;
                // At level 3 (75%): always show the first real word of the line
                if (brainTunerLevel === 3 && isFirstWord && part.trim()) {
                    isFirstWord = false;
                    return part;
                }
                isFirstWord = false;
                const hash = (lineIdx * 31 + wordIndex * 7) % 100;
                if (hash < maskPct * 100) {
                    return part.replace(/\S/g, '_');
                }
                return part;
            });
            span.textContent = masked.join('');
            span.style.opacity = '1';
        });
    });

    // Also handle standalone lyric-only lines
    lyricOnlys.forEach((span, idx) => {
        if (span._originalText === undefined) span._originalText = span.textContent;
        const text = span._originalText;
        const parts = text.split(/(\s+)/);
        let wordIndex = 0;
        let isFirst = true;
        const masked = parts.map((part) => {
            if (/^\s+$/.test(part)) return part;
            wordIndex++;
            if (brainTunerLevel === 3 && isFirst && part.trim()) {
                isFirst = false;
                return part;
            }
            isFirst = false;
            const hash = (idx * 31 + wordIndex * 7) % 100;
            if (hash < maskPct * 100) return part.replace(/\S/g, '_');
            return part;
        });
        span.textContent = masked.join('');
        span.style.opacity = '1';
    });
}

// ── Controls visibility ─────────────────────────────────────────────────────
function gigToggleControlsVisibility() {
    const controls = document.getElementById('gigControls');
    const btn = document.getElementById('gigControlsToggle');
    if (controls.classList.contains('gig-controls-hidden')) {
        controls.classList.remove('gig-controls-hidden');
        if (btn) btn.textContent = '🙈 Hide';
    } else {
        controls.classList.add('gig-controls-hidden');
        if (btn) btn.textContent = '👁 Show';
    }
}

// ── Setlist pills ────────────────────────────────────────────────────────────
function gigRenderSetlistPills() {
    const container = document.getElementById('gigSetlistPills');
    if (!container) return;
    container.innerHTML = gigQueue.map((song, i) => `
        <button class="gig-setlist-pill ${i === gigIndex ? 'active' : ''}"
            onclick="gigIndex=${i};gigLoadSong()">${i + 1}. ${song.title}</button>
    `).join('');
    // Scroll active pill into view
    setTimeout(() => {
        const active = container.querySelector('.gig-setlist-pill.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
}

// ── Wake Lock (keep screen on) ──────────────────────────────────────────────
async function gigRequestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            gigWakeLock = await navigator.wakeLock.request('screen');
            console.log('🔒 Wake lock acquired');
        }
    } catch(e) {
        console.log('Wake lock not available:', e.message);
    }
}

function gigReleaseWakeLock() {
    if (gigWakeLock) {
        gigWakeLock.release().then(() => {
            console.log('🔓 Wake lock released');
            gigWakeLock = null;
        }).catch(() => {});
    }
}

async function openGigModeFromSetlistIndex(setlistIndex) {
    showToast('Loading setlist…', 1200);
    const allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    const sl = allSetlists[setlistIndex];
    if (!sl) { showToast('⚠️ Setlist not found'); return; }
    const songs = [];
    (sl.sets || []).forEach(set => {
        (set.songs || []).forEach(item => {
            const title = typeof item === 'string' ? item : item.title;
            const band = typeof item === 'string' ? '' : (item.band || '');
            if (title) songs.push({ title, band });
        });
    });
    if (songs.length === 0) { showToast('⚠️ No songs in this setlist'); return; }
    gigQueue = songs;
    gigIndex = 0;
    gigShow();
}

console.log('🎸 Gig Mode loaded');

// ============================================================================
// MOISES STEMS
// ============================================================================

async function renderMoisesStems(songTitle, bandData) {
    const container = document.getElementById('moisesStemsContainer');
    
    // Load from Google Drive
    const stems = await loadMoisesStems(songTitle) || bandData.moisesParts || {};
    
    if (!stems.folderUrl && (!stems.stems || Object.keys(stems.stems).length === 0)) {
        container.innerHTML = `
            <div style="padding: 16px;">
                <p style="color:var(--text-dim,#6b7280);margin-bottom:12px">No stems uploaded yet. Add a source to isolate parts:</p>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
                    <button onclick="moisesAddYouTube()" class="btn btn-primary" style="padding:10px">📺 YouTube Link</button>
                    <button onclick="showMoisesUploadForm()" class="btn btn-ghost" style="padding:10px">📤 Upload MP3</button>
                </div>
                <button onclick="moisesShowSplitter()" class="btn btn-ghost" style="width:100%;padding:10px;color:var(--yellow,#f59e0b)">✂️ Split Long Show Recording (Moises 20min limit)</button>
                <p style="margin-top:8px;color:var(--text-dim,#6b7280);font-size:0.78em">Or <a href="#" onclick="addMoisesStems();return false;" style="color:var(--accent-light,#667eea)">paste Drive links</a> if already uploaded</p>
            </div>
        `;
        return;
    }
    
    // Check if we have individual stem links
    const stemKeys = ['bass', 'drums', 'guitar', 'keys', 'vocals', 'other'];
    const instrumentIcons = {
        bass: '🎸',
        drums: '🥁', 
        guitar: '🎸',
        keys: '🎹',
        vocals: '🎤',
        other: '🎵'
    };
    
    // Show stem buttons
    const stemButtons = stemKeys.map(key => {
        const url = stems.stems && stems.stems[key];
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        const icon = instrumentIcons[key] || '🎵';
        
        if (url) {
            // Has URL - clickable download
            return `
                <button class="stem-button" onclick="window.open('${url}', '_blank')" style="background: white; border: 2px solid #e2e8f0; padding: 12px; border-radius: 8px; cursor: pointer; text-align: center;">
                    <div class="stem-label" style="font-weight: 600; margin-bottom: 4px;">${icon} ${label}</div>
                    <div class="stem-info" style="font-size: 0.85em; color: #6b7280;">Click to download</div>
                </button>
            `;
        }
        return '';
    }).filter(Boolean).join('');
    
    container.innerHTML = `
        <div style="position: relative;">
            <button onclick="showMoisesUploadForm()" style="position: absolute; top: 0; right: 60px; background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">📤 Upload</button>
            <button onclick="editMoisesStems()" style="position: absolute; top: 0; right: 0; background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Edit</button>
            
            ${stems.sourceVersion ? `<p style="margin-bottom: 15px; color: #6b7280;">Source: <strong>${stems.sourceVersion}</strong></p>` : ''}
            
            ${stemButtons ? `
                <div class="stems-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
                    ${stemButtons}
                </div>
            ` : '<p style="color: #6b7280; margin-bottom: 15px;">No individual stems added yet</p>'}
            
            ${stems.folderUrl ? `
                <button class="drive-folder-btn" onclick="window.open('${stems.folderUrl}', '_blank')" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%;">
                    📂 Open Google Drive Folder
                </button>
            ` : ''}
            
            ${stems.notes ? `<p style="margin-top: 12px; color: #6b7280; font-size: 0.9em;">${stems.notes}</p>` : ''}
        </div>
    `;
}

function showMoisesUploadForm() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    const container = document.getElementById('moisesStemsContainer');
    container.innerHTML = `
        <div style="background: #f9fafb; padding: 20px; border-radius: 12px; border: 2px solid #667eea;">
            <h4 style="margin: 0 0 15px 0; color: #667eea;">📤 Upload Moises Stems</h4>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">
                    Source Version (optional)
                </label>
                <input type="text" id="stemsSourceInput" 
                    placeholder="e.g., Cornell 5/8/77, Studio version, etc."
                    style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">
                    Select Stem Files
                </label>
                <p style="font-size: 0.85em; color: #6b7280; margin-bottom: 10px;">
                    Select all your Moises-separated tracks (bass.mp3, drums.mp3, etc.)
                </p>
                <input type="file" id="stemsFileInput" multiple accept="audio/*,.mp3,.wav,.m4a,.aac"
                    style="width: 100%; padding: 10px; border: 2px dashed #d1d5db; border-radius: 6px; background: white; cursor: pointer;">
                <p style="font-size: 0.85em; color: #6b7280; margin-top: 5px;">
                    💡 Name your files clearly (e.g., bass.mp3, drums.mp3, guitar.mp3, keys.mp3, vocals.mp3)
                </p>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">
                    Notes (optional)
                </label>
                <textarea id="stemsNotesInput" 
                    placeholder="e.g., Bass is really clear in this version"
                    style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; resize: vertical;"
                    rows="2"></textarea>
            </div>
            
            <div id="uploadProgress" style="display: none; margin-bottom: 15px;">
                <div style="background: #e5e7eb; height: 30px; border-radius: 6px; overflow: hidden; position: relative;">
                    <div id="uploadProgressBar" style="background: #10b981; height: 100%; width: 0%; transition: width 0.3s;"></div>
                    <div id="uploadProgressText" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: 600; color: #1f2937;"></div>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="uploadMoisesStems()" 
                    style="flex: 1; background: #10b981; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1em;">
                    📤 Upload Stems
                </button>
                <button onclick="renderMoisesStems('${songTitle.replace(/'/g, "\\'")}', {})" 
                    style="background: #6b7280; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        </div>
    `;
}

async function uploadMoisesStems() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    const fileInput = document.getElementById('stemsFileInput');
    const sourceInput = document.getElementById('stemsSourceInput');
    const notesInput = document.getElementById('stemsNotesInput');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select at least one stem file!');
        return;
    }
    
    // Show progress
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    progressDiv.style.display = 'block';
    
    try {
        // Create folder name
        const folderName = `${songTitle} - Moises Stems`;
        
        progressText.textContent = 'Creating folder...';
        progressBar.style.width = '10%';
        
        // Create folder in shared Drive folder
        const folderId = await createDriveFolder(folderName);
        
        if (!folderId) {
            throw new Error('Failed to create folder');
        }
        
        console.log(`📁 Created folder: ${folderId}`);
        
        // Upload each file
        const files = Array.from(fileInput.files);
        const uploadedStems = {};
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const progress = ((i + 1) / files.length) * 80 + 10; // 10-90%
            
            progressText.textContent = `Uploading ${file.name}... (${i + 1}/${files.length})`;
            progressBar.style.width = `${progress}%`;
            
            console.log(`Uploading ${file.name}...`);
            
            // Upload file to folder
            const fileId = await uploadFileToDrive(file, folderId);
            
            if (fileId) {
                // Determine instrument type from filename
                const fileName = file.name.toLowerCase();
                let instrument = 'other';
                
                if (fileName.includes('bass')) instrument = 'bass';
                else if (fileName.includes('drum')) instrument = 'drums';
                else if (fileName.includes('guitar')) instrument = 'guitar';
                else if (fileName.includes('key') || fileName.includes('piano')) instrument = 'keys';
                else if (fileName.includes('vocal') || fileName.includes('voice')) instrument = 'vocals';
                
                // fileId is now a direct download URL from Firebase Storage
                uploadedStems[instrument] = fileId;
                
                console.log(`✅ Uploaded ${file.name} as ${instrument}`);
            }
        }
        
        progressText.textContent = 'Saving metadata...';
        progressBar.style.width = '95%';
        
        // Save stems metadata
        const stemsData = {
            folderUrl: '', // No folder URL with Firebase Storage
            folderId: folderId,
            sourceVersion: sourceInput.value.trim(),
            stems: uploadedStems,
            notes: notesInput.value.trim(),
            uploadedBy: currentUserEmail,
            dateAdded: new Date().toLocaleDateString()
        };
        
        await saveMoisesStems(songTitle, stemsData);
        
        progressText.textContent = 'Complete! ✅';
        progressBar.style.width = '100%';
        
        console.log('✅ All stems uploaded successfully!');
        
        setTimeout(async () => {
            const bandData = bandKnowledgeBase[songTitle] || {};
            await renderMoisesStems(songTitle, bandData);
        }, 1000);
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
        progressDiv.style.display = 'none';
    }
}

// createDriveFolder and uploadFileToDrive are defined in Firebase storage section below
// (original Drive versions removed)

async function addMoisesStems() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    editMoisesStems();
}

async function editMoisesStems() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    if (document.getElementById('moisesModal')) return;
    const stems = await loadMoisesStems(songTitle) || {};
    const fields = [
        { id: 'msBass',    label: 'Bass track URL',       val: stems.stems?.bass || '' },
        { id: 'msDrums',   label: 'Drums track URL',      val: stems.stems?.drums || '' },
        { id: 'msGuitar',  label: 'Guitar track URL',     val: stems.stems?.guitar || '' },
        { id: 'msKeys',    label: 'Keys track URL',       val: stems.stems?.keys || '' },
        { id: 'msVocals',  label: 'Vocals track URL',     val: stems.stems?.vocals || '' },
        { id: 'msOther',   label: 'Other/Mix track URL',  val: stems.stems?.other || '' },
    ];
    const modal = document.createElement('div');
    modal.id = 'moisesModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
        <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <h3 style="margin:0;color:white">🎛️ Moises Stems</h3>
                <button onclick="document.getElementById('moisesModal').remove()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.3em">✕</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
                <div>
                    <label style="display:block;font-size:0.82em;color:#9ca3af;margin-bottom:5px">Google Drive folder URL</label>
                    <input id="msFolderUrl" class="app-input" placeholder="https://drive.google.com/drive/folders/..."
                        value="${stems.folderUrl || ''}" autocomplete="off">
                </div>
                <div>
                    <label style="display:block;font-size:0.82em;color:#9ca3af;margin-bottom:5px">Source version</label>
                    <input id="msSourceVersion" class="app-input" placeholder='e.g. "11/3/1985 Richmond"'
                        value="${stems.sourceVersion || ''}" autocomplete="off">
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;margin-top:4px">
                    <p style="color:#9ca3af;font-size:0.8em;margin:0 0 10px">Individual stem URLs (from Moises):</p>
                    ${fields.map(f => `
                        <div style="margin-bottom:10px">
                            <label style="display:block;font-size:0.78em;color:#6b7280;margin-bottom:4px">${f.label}</label>
                            <input id="${f.id}" class="app-input" placeholder="https://..." value="${f.val}" autocomplete="off">
                        </div>
                    `).join('')}
                </div>
                <div>
                    <label style="display:block;font-size:0.82em;color:#9ca3af;margin-bottom:5px">Notes</label>
                    <textarea id="msNotes" class="app-input" placeholder="Any notes about this version..."
                        style="min-height:70px;resize:vertical;font-family:inherit">${stems.notes || ''}</textarea>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:20px">
                <button onclick="saveMoisesStems()" class="btn btn-primary" style="flex:1">💾 Save Stems</button>
                <button onclick="document.getElementById('moisesModal').remove()" class="btn btn-ghost">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('msFolderUrl')?.focus();
}

async function saveMoisesStems() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const newStems = {
        folderUrl:     document.getElementById('msFolderUrl')?.value?.trim() || '',
        sourceVersion: document.getElementById('msSourceVersion')?.value?.trim() || '',
        stems: {
            bass:   document.getElementById('msBass')?.value?.trim() || '',
            drums:  document.getElementById('msDrums')?.value?.trim() || '',
            guitar: document.getElementById('msGuitar')?.value?.trim() || '',
            keys:   document.getElementById('msKeys')?.value?.trim() || '',
            vocals: document.getElementById('msVocals')?.value?.trim() || '',
            other:  document.getElementById('msOther')?.value?.trim() || '',
        },
        notes:     document.getElementById('msNotes')?.value?.trim() || '',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserEmail
    };
    await saveMoisesData(songTitle, newStems);
    document.getElementById('moisesModal')?.remove();
    showToast('✅ Stems saved');
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData && typeof renderMoisesStems === 'function') renderMoisesStems(songTitle, bandData);
}

async function saveMoisesStems(songTitle, stems) {
    return await saveBandDataToDrive(songTitle, 'moises_stems', stems);
}

async function loadMoisesStems(songTitle) {
    return await loadBandDataFromDrive(songTitle, 'moises_stems');
}

console.log('🎵 Moises stems editor loaded');

// ============================================================================
// PRACTICE TRACKS
// ============================================================================

async function renderPracticeTracks(songTitle, bandData) {
    // Use the Google Drive version instead
    await renderPracticeTracksSimplified(songTitle);
}


// ============================================================================
// REHEARSAL NOTES
// ============================================================================

function renderRehearsalNotes(songTitle, bandData) {
    const container = document.getElementById('rehearsalNotesContainer');
    const notes = bandData.rehearsalNotes;
    
    if (!notes || notes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No rehearsal notes yet</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="rehearsal-notes-list">
            ${notes.map(note => `
                <div class="rehearsal-note-card ${note.priority === 'high' ? 'high' : ''}">
                    <div class="note-header">
                        <span>${note.author} - ${note.date}</span>
                        <span style="color: ${note.priority === 'high' ? '#ef4444' : '#667eea'}; font-weight: 600;">
                            ${note.priority.toUpperCase()} PRIORITY
                        </span>
                    </div>
                    <div class="note-content">${note.note}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================================
// GIG NOTES
// ============================================================================

// ── SONG IN PLAYLISTS ─────────────────────────────────────────────────────────

async function renderSongInPlaylists(songTitle) {
    const container = document.getElementById('songPlaylistsContainer');
    if (!container) return;
    const playlists = await loadPlaylists();
    const inPlaylists = playlists.filter(pl => 
        Array.isArray(pl.songs) && pl.songs.some(s => (s.title || s) === songTitle)
    );
    if (!inPlaylists.length) {
        container.innerHTML = '<p style="color:var(--text-dim,#64748b);font-size:0.85em;padding:4px 0">Not in any playlists yet</p>';
        return;
    }
    const typeInfo = PLAYLIST_TYPES;
    container.innerHTML = inPlaylists.map(pl => {
        const t = typeInfo[pl.type] || typeInfo.custom;
        return `<span onclick="openPlaylistFromSong('${pl.id}')" 
            style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;
                   background:${t.bg};border:1px solid ${t.border};border-radius:12px;
                   color:${t.color};font-size:0.8em;font-weight:600;cursor:pointer;margin:2px">
            ${t.label.split(' ')[0]} ${pl.name}
        </span>`;
    }).join('');
}

function openPlaylistFromSong(playlistId) {
    navigateTo('playlists');
    setTimeout(() => plOpenEditor(playlistId), 400);
}

// ── COVER ME ──────────────────────────────────────────────────────────────────

async function renderCoverMe(songTitle) {
    const container = document.getElementById('coverMeContainer');
    if (!container) return;
    const data = await loadBandDataFromDrive(songTitle, 'cover_me') || [];
    const covers = Array.isArray(data) ? data : (data.covers || []);
    if (!covers.length) {
        container.innerHTML = '<p style="color:var(--text-muted,#94a3b8);padding:8px 0">No cover versions added yet</p>';
        return;
    }
    container.innerHTML = covers.map((c, i) => `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;color:var(--text,#f1f5f9)">${c.artist || 'Unknown Artist'}</div>
                    ${c.url ? `<a href="${c.url}" target="_blank" style="color:var(--accent-light,#818cf8);font-size:0.82em;word-break:break-all;display:block;margin-top:2px">${c.url}</a>` : ''}
                    ${(c.description || c.notes) ? `<div style="color:#fbbf24;font-size:0.82em;margin-top:6px;line-height:1.5;background:rgba(251,191,36,0.08);border-left:3px solid #fbbf24;padding:4px 8px;border-radius:0 4px 4px 0">💡 ${c.description || c.notes}</div>` : ''}
                    <div style="color:var(--text-dim,#64748b);font-size:0.72em;margin-top:5px">Added by ${c.addedBy?.split('@')[0] || 'band'}</div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0">
                    <button onclick="editCoverMe(${i})" style="background:none;border:none;color:#818cf8;cursor:pointer;font-size:1.1em;padding:4px" title="Edit">✏️</button>
                    <button onclick="deleteCoverMe(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.1em;padding:4px" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}
async function showAddCoverMeForm() {
    const container = document.getElementById('coverMeSection');
    if (!container || document.getElementById('coverMeForm')) return;
    const form = document.createElement('div');
    form.id = 'coverMeForm';
    form.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px;margin-bottom:12px';
    form.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">
            <input id="coverMeArtist" class="app-input" placeholder="Artist / Band name *" autocomplete="off">
            <input id="coverMeUrl" class="app-input" placeholder="YouTube / Spotify / Archive link (optional)" autocomplete="off">
            <textarea id="coverMeDescription" class="app-input" placeholder="Why it matters — e.g. 'listen to the bass in the outro' (optional)"
                style="min-height:70px;resize:vertical;font-family:inherit"></textarea>
            <div style="display:flex;gap:8px">
                <button onclick="saveCoverMe()" class="btn btn-primary">💾 Save</button>
                <button onclick="document.getElementById('coverMeForm')?.remove()" class="btn btn-ghost">Cancel</button>
            </div>
        </div>
    `;
    container.prepend(form);
    document.getElementById('coverMeArtist')?.focus();
}

async function saveCoverMe(editIndex = null) {
    const artist = document.getElementById('coverMeArtist')?.value?.trim();
    if (!artist) { showToast('Enter an artist name'); return; }
    const url = document.getElementById('coverMeUrl')?.value?.trim();
    const description = document.getElementById('coverMeDescription')?.value?.trim();
    const songTitle = selectedSong?.title || selectedSong;
    const existing = await loadBandDataFromDrive(songTitle, 'cover_me') || [];
    const covers = Array.isArray(existing) ? existing : (existing.covers || []);
    const entry = { artist, url, description, addedBy: currentUserEmail, addedAt: new Date().toISOString() };
    if (editIndex !== null) { covers[editIndex] = entry; } else { covers.push(entry); }
    await saveBandDataToDrive(songTitle, 'cover_me', covers);
    document.getElementById('coverMeForm')?.remove();
    await renderCoverMe(songTitle);
    showToast(editIndex !== null ? '✅ Cover updated!' : '✅ Cover version added!');
}

async function editCoverMe(index) {
    const songTitle = selectedSong?.title || selectedSong;
    const existing = await loadBandDataFromDrive(songTitle, 'cover_me') || [];
    const covers = Array.isArray(existing) ? existing : (existing.covers || []);
    const c = covers[index];
    if (!c) return;
    document.getElementById('coverMeForm')?.remove();
    const container = document.getElementById('coverMeSection');
    const form = document.createElement('div');
    form.id = 'coverMeForm';
    form.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px;margin-bottom:12px';
    form.innerHTML = `
        <div style="font-size:0.82em;color:#818cf8;margin-bottom:8px;font-weight:600">✏️ Editing cover version</div>
        <div style="display:flex;flex-direction:column;gap:8px">
            <input id="coverMeArtist" class="app-input" placeholder="Artist / Band name *" value="${c.artist||''}" autocomplete="off">
            <input id="coverMeUrl" class="app-input" placeholder="Link (optional)" value="${c.url||''}" autocomplete="off">
            <textarea id="coverMeDescription" class="app-input" placeholder="Why it matters — e.g. 'listen to the bass in the outro' (optional)"
                style="min-height:70px;resize:vertical;font-family:inherit">${c.description||c.notes||''}</textarea>
            <div style="display:flex;gap:8px">
                <button onclick="saveCoverMe(${index})" class="btn btn-primary">💾 Save</button>
                <button onclick="document.getElementById('coverMeForm')?.remove()" class="btn btn-ghost">Cancel</button>
            </div>
        </div>
    `;
    container.prepend(form);
    document.getElementById('coverMeArtist')?.focus();
}

async function deleteCoverMe(index) {
    if (!confirm('Remove this cover version?')) return;
    const songTitle = selectedSong?.title || selectedSong;
    const existing = await loadBandDataFromDrive(songTitle, 'cover_me') || [];
    const covers = Array.isArray(existing) ? existing : (existing.covers || []);
    covers.splice(index, 1);
    await saveBandDataToDrive(songTitle, 'cover_me', covers);
    await renderCoverMe(songTitle);
    showToast('🗑️ Cover removed');
}

async function renderGigNotes(songTitle, bandData) {
    const container = document.getElementById('gigNotesContainer');
    let notes = toArray(await loadGigNotes(songTitle) || []);
    // Fall back to data.js if Firebase empty
    if (notes.length === 0 && bandData.gigNotes) notes = toArray(bandData.gigNotes);
    if (notes.length === 0 && bandData.performanceTips) notes = toArray(bandData.performanceTips);
    
    if (notes.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <p>No performance tips yet</p>
                <button onclick="addGigNote()" class="secondary-btn" style="margin-top: 10px;">+ Add First Tip</button>
            </div>
        `;
        return;
    }
    
    container.style.cssText = 'color:var(--text,#f1f5f9)';  // ensure text visible
    container.innerHTML = `
        <div style="background:rgba(255,255,255,0.02);border-radius:8px;padding:4px 0">
            <ul style="list-style:none;padding:0;margin:0">
                ${notes.map((note, index) => `
                    <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #f1f5f9;">
                        <span id="gigNoteText_${index}" style="flex:1;color:var(--text,#f1f5f9);font-size:0.9em">${note}</span>
                        <div style="display:flex;gap:4px;flex-shrink:0">
                            <button onclick="editGigNote(${index})" style="background: rgba(102,126,234,0.15); color: var(--accent-light,#818cf8); border: 1px solid rgba(102,126,234,0.3); border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">✏️</button>
                            <button onclick="deleteGigNote(${index},this)" style="background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight:700;">✕</button>
                        </div>
                    </li>
                `).join('')}
            </ul>
            <div style="padding:8px 12px">
                <button onclick="addGigNote()" class="secondary-btn" style="margin-top: 4px;">+ Add Tip</button>
            </div>
        </div>
    `;
}

async function addGigNote() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const container = document.getElementById('gigNotesContainer');
    if (!container) return;
    // Show inline form instead of prompt (prompt blocked on iOS PWA)
    const formId = 'gigNoteInlineForm';
    if (document.getElementById(formId)) return; // already open
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'padding:10px 0;display:flex;gap:8px;flex-wrap:wrap';
    form.innerHTML = `
        <input id="gigNoteInput" class="app-input" placeholder="Add performance tip..." 
            style="flex:1;min-width:200px" autocomplete="off">
        <button onclick="saveGigNoteInline()" class="btn btn-primary" style="white-space:nowrap">💾 Save</button>
        <button onclick="document.getElementById('gigNoteInlineForm')?.remove()" class="btn btn-ghost">Cancel</button>
    `;
    container.prepend(form);
    document.getElementById('gigNoteInput')?.focus();
}

async function saveGigNoteInline() {
    const input = document.getElementById('gigNoteInput');
    const note = input?.value?.trim();
    if (!note) return;
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    let notes = await loadGigNotes(songTitle) || [];
    notes.push(note);
    await saveGigNotes(songTitle, notes);
    document.getElementById('gigNoteInlineForm')?.remove();
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderGigNotes(songTitle, bandData);
}

async function deleteGigNote(index, btn) {
    if (btn && btn.dataset.confirming) {
        const songTitle = selectedSong?.title || selectedSong;
        if (!songTitle) return;
        let notes = await loadGigNotes(songTitle) || [];
        notes.splice(index, 1);
        await saveGigNotes(songTitle, notes);
        const bandData = bandKnowledgeBase[songTitle] || {};
        await renderGigNotes(songTitle, bandData);

        showToast('🗑️ Tip removed');
    } else if (btn) {
        btn.dataset.confirming = '1';
        btn.textContent = 'Sure?';
        btn.style.background = '#ef4444';
        btn.style.color = 'white';
        setTimeout(() => { if (btn) { btn.dataset.confirming = ''; btn.textContent = '🗑️'; btn.style.background = ''; btn.style.color = ''; }}, 3000);
    }
}

async function editGigNote(index) {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    let notes = await loadGigNotes(songTitle) || [];
    const current = notes[index] || '';
    // Inline edit: replace li text with input
    const textEl = document.getElementById(`gigNoteText_${index}`);
    if (!textEl) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'app-input';
    input.style.cssText = 'flex:1;font-size:0.88em;padding:4px 8px';
    input.onkeydown = async (e) => {
        if (e.key === 'Enter') await saveGigNoteEdit(index, input.value);
        if (e.key === 'Escape') { const bd = bandKnowledgeBase[songTitle]||{}; await renderGigNotes(songTitle,bd); }
    };
    textEl.replaceWith(input);
    input.focus();
    // Change edit button to save
    const editBtn = input.parentElement?.querySelector('button:first-child');
    if (editBtn) { editBtn.textContent = '💾'; editBtn.onclick = () => saveGigNoteEdit(index, input.value); }
}

async function saveGigNoteEdit(index, value) {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle || !value?.trim()) return;
    let notes = await loadGigNotes(songTitle) || [];
    notes[index] = value.trim();
    await saveGigNotes(songTitle, notes);
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderGigNotes(songTitle, bandData);
}

async function saveGigNotes(songTitle, notes) {
    return await saveBandDataToDrive(songTitle, 'gig_notes', notes);
}

async function loadGigNotes(songTitle) {
    return toArray(await loadBandDataFromDrive(songTitle, 'gig_notes') || []);
}

console.log('📝 Gig notes editor loaded');

// ============================================================================
// ============================================================================
// SIMPLIFIED PRACTICE TRACK SYSTEM
// Auto-fetch titles, thumbnails, save to localStorage - NO GITHUB NEEDED!
// ============================================================================

// Store practice tracks in Google Drive (shared with all band members)
async function savePracticeTrack(songTitle, track) {
    const tracks = await loadPracticeTracksFromDrive(songTitle);
    tracks.push(track);
    await savePracticeTracks(songTitle, tracks);
}

async function loadPracticeTracksFromStorage(songTitle) {
    return await loadPracticeTracksFromDrive(songTitle);
}

async function deletePracticeTrack(songTitle, index) {
    const tracks = await loadPracticeTracksFromDrive(songTitle);
    tracks.splice(index, 1);
    await savePracticeTracks(songTitle, tracks);
    await renderPracticeTracksSimplified(songTitle);
}

// Extract YouTube video ID from any YouTube URL format
function extractYouTubeId(url) {
    if (!url) return null;
    url = url.trim();
    
    // Handle youtube.com/watch?v=
    const match1 = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match1) return match1[1];
    
    // Handle youtu.be/VIDEO_ID
    const match2 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match2) return match2[1];
    
    // Handle youtube.com/shorts/VIDEO_ID
    const match3 = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (match3) return match3[1];
    
    // Handle youtube.com/embed/VIDEO_ID
    const match4 = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match4) return match4[1];
    
    // Handle youtube.com/v/VIDEO_ID
    const match5 = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
    if (match5) return match5[1];
    
    // Handle mobile m.youtube.com
    const match6 = url.match(/m\.youtube\.com.*[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match6) return match6[1];
    
    // Handle music.youtube.com
    const match7 = url.match(/music\.youtube\.com.*[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match7) return match7[1];
    
    // Last resort - look for 11-char alphanumeric string after common patterns
    const match8 = url.match(/(?:\/|%2F)([a-zA-Z0-9_-]{11})(?:[?&]|$)/);
    if (match8 && url.includes('youtube')) return match8[1];
    
    return null;
}

// Auto-fetch video title and thumbnail from URL
async function fetchVideoMetadata(url) {
    try {
        // For YouTube videos and Shorts
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = extractYouTubeId(url);
            if (videoId) {
                // Use oEmbed API to get title
                const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                const data = await response.json();
                
                return {
                    title: data.title,
                    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    success: true
                };
            }
        }
        
        // For other URLs, try to extract domain
        try {
            const urlObj = new URL(url);
            return {
                title: `Video from ${urlObj.hostname}`,
                thumbnail: null,
                success: false
            };
        } catch {
            return {
                title: 'Video Track',
                thumbnail: null,
                success: false
            };
        }
    } catch (error) {
        console.error('Error fetching video metadata:', error);
        return {
            title: 'Video Track',
            thumbnail: null,
            success: false
        };
    }
}

// Simple add track flow with auto-fetch
async function addPracticeTrackSimple() {
    const url = document.getElementById('practiceTrackUrlInput').value.trim();
    const instrument = document.getElementById('practiceTrackInstrument').value;
    const notes = document.getElementById('practiceTrackNotes').value.trim();
    
    if (!url) {
        alert('Please paste a video URL');
        return;
    }
    
    if (!instrument) {
        alert('Please select an instrument');
        return;
    }
    
    // Show loading
    const addButton = document.getElementById('addPracticeTrackBtn');
    const originalText = addButton.innerHTML;
    addButton.innerHTML = '⏳ Fetching video info...';
    addButton.disabled = true;
    
    try {
        // Fetch metadata
        const metadata = await fetchVideoMetadata(url);
        
        const track = {
            title: metadata.title,
            videoUrl: url,
            instrument: instrument,
            notes: notes,
            uploadedBy: 'drew',
            dateAdded: new Date().toISOString().split('T')[0],
            thumbnail: metadata.thumbnail
        };
        
        // Check for duplicate URL
        const existingTracks = await loadPracticeTracksFromDrive(selectedSong.title);
        if (existingTracks.some(t => t.videoUrl === url)) {
            alert('This video has already been added as a practice track!');
            addButton.innerHTML = originalText;
            addButton.disabled = false;
            return;
        }
        
        // Save to Drive (await to prevent race conditions)
        await savePracticeTrack(selectedSong.title, track);
        logActivity('practice_track', { song: selectedSong.title, extra: instrument });
        
        // Show success message
        const message = document.createElement('div');
        message.style.cssText = 'background: #d1fae5; padding: 12px; border-radius: 8px; margin-top: 10px; color: #065f46; font-weight: 600;';
        message.textContent = `✅ Added: ${metadata.title}`;
        document.getElementById('practiceTrackAddForm').appendChild(message);
        
        // Clear form
        document.getElementById('practiceTrackUrlInput').value = '';
        document.getElementById('practiceTrackNotes').value = '';
        
        // Remove success message after 2 seconds
        setTimeout(() => message.remove(), 2000);
        
        // Refresh the practice tracks display
        await renderPracticeTracksSimplified(selectedSong.title);
        
    } catch (error) {
        alert('Error adding track: ' + error.message);
    } finally {
        addButton.innerHTML = originalText;
        addButton.disabled = false;
    }
}

function ptToggleUploadForm() {
    const form = document.getElementById('ptUploadForm');
    if (!form) return;
    const showing = form.style.display !== 'none';
    form.style.display = showing ? 'none' : '';
    if (!showing) document.getElementById('ptAudioFile')?.focus();
}

async function addPracticeTrackUpload() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) { alert('Please select a song first'); return; }

    const fileInput = document.getElementById('ptAudioFile');
    const title = document.getElementById('ptUploadTitle')?.value.trim();
    const instrument = document.getElementById('practiceTrackInstrument')?.value;

    if (!fileInput?.files?.[0]) { alert('Please choose an audio file'); return; }
    if (!title) { alert('Please enter a track title'); return; }
    if (!instrument) { alert('Please select an instrument'); return; }

    const file = fileInput.files[0];
    if (file.size > 20 * 1024 * 1024) { alert('File too large — max 20MB'); return; }

    if (!firebaseStorage) { alert('Storage not ready — please sign in first'); return; }

    const progWrapper = document.getElementById('ptUploadProgress');
    const progBar = document.getElementById('ptUploadBar');
    const progStatus = document.getElementById('ptUploadStatus');
    const btn = document.querySelector('#ptUploadForm .btn-primary');
    const origText = btn?.innerHTML;
    if (btn) { btn.innerHTML = '⏳ Uploading…'; btn.disabled = true; }
    progWrapper.style.display = '';

    try {
        const safeSong = sanitizeFirebasePath(songTitle);
        const safeName = sanitizeFirebasePath(file.name);
        const storageRef = firebaseStorage.ref(`practice_tracks/${safeSong}/${Date.now()}_${safeName}`);
        const uploadTask = storageRef.put(file);

        await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                snap => {
                    const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                    progBar.style.width = pct + '%';
                    progStatus.textContent = `Uploading… ${pct}%`;
                },
                reject,
                resolve
            );
        });

        const downloadURL = await storageRef.getDownloadURL();
        progStatus.textContent = 'Saving…';

        const track = {
            title: title,
            videoUrl: downloadURL,
            audioUpload: true,
            fileName: file.name,
            fileSize: file.size,
            instrument: instrument,
            notes: '',
            uploadedBy: currentUserEmail || 'drew',
            dateAdded: new Date().toISOString().split('T')[0],
            thumbnail: null
        };

        await savePracticeTrack(songTitle, track);
        logActivity('practice_track', { song: songTitle, extra: instrument });

        // Reset form
        fileInput.value = '';
        document.getElementById('ptUploadTitle').value = '';
        progWrapper.style.display = 'none';
        document.getElementById('ptUploadForm').style.display = 'none';

        showToast('✅ MP3 uploaded & added as practice track!');
        await renderPracticeTracksSimplified(songTitle);
    } catch (err) {
        progWrapper.style.display = 'none';
        alert('Upload failed: ' + err.message);
    } finally {
        if (btn) { btn.innerHTML = origText; btn.disabled = false; }
    }
}


async function renderPracticeTracksSimplified(songTitle) {
    const container = document.getElementById('practiceTracksContainer');
    const bandData = bandKnowledgeBase[songTitle];
    
    // Get tracks from both sources
    const storedTracks = await loadPracticeTracksFromStorage(songTitle);
    const dataTracks = [];
    
    // Get tracks from data.js if they exist
    if (bandData && bandData.practiceTracks) {
        Object.entries(bandData.practiceTracks).forEach(([instrument, trackList]) => {
            trackList.forEach(track => {
                dataTracks.push({ ...track, instrument, source: 'data.js' });
            });
        });
    }
    
    // Add source marker to stored tracks
    const storedWithSource = (storedTracks || []).map(t => ({ ...t, source: 'Google Drive' }));
    
    // Combine all tracks
    const allTracks = [...dataTracks, ...storedWithSource];
    
    if (allTracks.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No practice tracks yet - add your first one above!</div>';
        return;
    }
    
    // Instrument icons and names
    const instrumentIcons = {
        bass: '🎸',
        leadGuitar: '🎸',
        lead_guitar: '🎸',
        rhythmGuitar: '🎸',
        rhythm_guitar: '🎸',
        keys: '🎹',
        keyboards: '🎹',
        drums: '🥁',
        vocals: '🎤',
        whole_band: '🎶'
    };
    
    const instrumentNames = {
        bass: 'Bass',
        leadGuitar: 'Lead Guitar',
        lead_guitar: 'Lead Guitar',
        rhythmGuitar: 'Rhythm Guitar',
        rhythm_guitar: 'Rhythm Guitar',
        keys: 'Keys',
        keyboards: 'Keyboards',
        drums: 'Drums',
        vocals: 'Vocals',
        whole_band: 'Whole Band'
    };
    
    // Group tracks by instrument into quadrants (#19)
    const instruments = ['vocals','leadGuitar','rhythmGuitar','bass','keys','drums','wholeBand'];
    const instLabels = {vocals:'🎤 Vocals',leadGuitar:'🎸 Lead Guitar',rhythmGuitar:'🎸 Rhythm Guitar',bass:'🎸 Bass',keys:'🎹 Keys',drums:'🥁 Drums',wholeBand:'🎶 Whole Band'};
    const grouped = {};
    instruments.forEach(i => grouped[i] = []);
    allTracks.forEach(t => {
        const key = t.instrument?.replace('_','') || 'vocals';
        const norm = key === 'leadguitar' || key === 'lead_guitar' ? 'leadGuitar' : key === 'rhythmguitar' || key === 'rhythm_guitar' ? 'rhythmGuitar' : key === 'keyboards' ? 'keys' : key === 'wholeband' || key === 'whole_band' ? 'wholeBand' : key;
        if (!grouped[norm]) grouped[norm] = [];
        grouped[norm].push(t);
    });
    
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${instruments.filter(i=>i!=='wholeBand').map(inst => {
                const tracks = grouped[inst] || [];
                return `<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;padding:10px;min-height:80px">
                    <div style="font-size:0.78em;font-weight:700;color:var(--text-muted,#94a3b8);margin-bottom:6px">${instLabels[inst]||inst}</div>
                    ${tracks.length ? tracks.map((track,ti) => {
                        const url = track.videoUrl || track.youtubeUrl;
                        const title = track.title || track.notes || url?.substring(0,40) || 'Track';
                        const mediaEl = track.audioUpload
                            ? `<audio controls src="${url}" style="flex:1;height:28px;min-width:0;max-width:100%" title="${title}"></audio>`
                            : `<a href="${url||'#'}" target="_blank" style="flex:1;color:var(--accent-light,#818cf8);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${title}">${title}</a>`;
                        return `<div style="margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.04);padding-bottom:4px">
                            ${track.audioUpload ? `<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</div>` : ''}
                            <div style="display:flex;align-items:center;gap:6px;font-size:0.82em">
                                ${mediaEl}
                                ${track.source!=='data.js'?'<button onclick="deletePracticeTrackConfirm(\''+songTitle+'\','+ti+')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.8em;flex-shrink:0" title="Delete">✕</button>':''}
                            </div>
                        </div>`;
                    }).join('') : '<div style="font-size:0.75em;color:var(--text-dim,#64748b);font-style:italic">No tracks yet</div>'}
                </div>`;
            }).join('')}
        </div>
        ${(grouped.wholeBand||[]).length ? `<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;padding:10px;margin-top:8px">
            <div style="font-size:0.78em;font-weight:700;color:var(--text-muted,#94a3b8);margin-bottom:6px">🎶 Whole Band</div>
            ${(grouped.wholeBand||[]).map((track,ti) => {
                const url = track.videoUrl || track.youtubeUrl;
                const title = track.title || track.notes || url?.substring(0,40) || 'Track';
                return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.82em;border-bottom:1px solid rgba(255,255,255,0.04)"><a href="'+(url||'#')+'" target="_blank" style="flex:1;color:var(--accent-light,#818cf8);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+title+'">'+title+'</a>'+(track.source!=='data.js'?'<button onclick="deletePracticeTrackConfirm(\''+songTitle+'\','+ti+')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.8em" title="Delete">✕</button>':'')+'</div>';
            }).join('')}
        </div>` : `<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;padding:10px;margin-top:8px">
            <div style="font-size:0.78em;font-weight:700;color:var(--text-muted,#94a3b8);margin-bottom:6px">🎶 Whole Band</div>
            <div style="font-size:0.75em;color:var(--text-dim,#64748b);font-style:italic">No tracks yet</div>
        </div>`}
    `;
}

async function deletePracticeTrackConfirm(songTitle, index) {
    if (confirm('Delete this practice track?')) {
        await deletePracticeTrack(songTitle, index);
        await renderPracticeTracksSimplified(songTitle);
    }
}

// ============================================================================
// SPOTIFY API INTEGRATION
// Fetch real track names and metadata from Spotify
// ============================================================================

// Spotify API - Client Credentials Flow (public API)
async function fetchRefTrackInfo(trackUrl) {
    try {
        if (!trackUrl) return { title: 'Unknown Track', success: false };
        
        const url = trackUrl.toLowerCase();
        
        // Spotify
        if (url.includes('spotify.com')) {
            const trackId = extractSpotifyTrackId(trackUrl);
            if (!trackId) return { title: 'Spotify Track', success: false };
            const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`);
            const data = await response.json();
            return { title: data.title, thumbnail: data.thumbnail_url, success: true };
        }
        
        // YouTube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = null;
            const match1 = trackUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            const match2 = trackUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
            const match3 = trackUrl.match(/shorts\/([a-zA-Z0-9_-]{11})/);
            videoId = (match1 || match2 || match3)?.[1];
            if (videoId) {
                try {
                    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
                    const data = await response.json();
                    return { title: data.title, thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, success: true };
                } catch (e) {
                    return { title: 'YouTube Video', thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`, success: false };
                }
            }
            return { title: 'YouTube Video', success: false };
        }
        
        // Archive.org
        if (url.includes('archive.org')) {
            const title = decodeURIComponent(trackUrl.split('/').pop()).replace(/[-_]/g, ' ');
            return { title: title || 'Archive.org Recording', success: true };
        }
        
        // Generic fallback - use the domain name
        try {
            const domain = new URL(trackUrl).hostname.replace('www.', '');
            return { title: `Track on ${domain}`, success: false };
        } catch (e) {
            return { title: 'Unknown Track', success: false };
        }
    } catch (error) {
        console.error('Error fetching track metadata:', error);
        return { title: 'Track', success: false };
    }
}

function extractSpotifyTrackId(url) {
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

// Update reference version rendering to fetch metadata
async function renderRefVersions(songTitle, bandData) {
    const container = document.getElementById('spotifyVersionsContainer');
    
    // Load from Firebase first
    let firebaseVersions = await loadRefVersions(songTitle);
    firebaseVersions = toArray(firebaseVersions || []);
    
    // Only use data.js versions if Firebase has NOTHING for this song
    // Once a user adds/saves ANY version, Firebase takes over completely
    let versions;
    if (firebaseVersions.length > 0) {
        versions = firebaseVersions;
    } else if (bandData.spotifyVersions && bandData.spotifyVersions.length > 0) {
        versions = bandData.spotifyVersions;
    } else {
        versions = [];
    }
    
    // Deduplicate by URL (in case data.js and Firebase have same entries)
    const seen = new Set();
    versions = versions.filter(v => {
        const url = v.url || v.spotifyUrl || '';
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
    });
    
    if (versions.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No reference versions added yet</div>';
        return;
    }
    
    // Show loading
    container.innerHTML = '<p style="padding: 15px; color: #667eea;">⏳ Loading track info...</p>';
    
    // Fetch metadata for all versions
    const versionsWithMetadata = await Promise.all(
        versions.map(async version => {
            const metadata = await fetchRefTrackInfo(version.url || version.spotifyUrl);
            return {
                ...version,
                fetchedTitle: metadata.title,
                thumbnail: metadata.thumbnail
            };
        })
    );
    
    // Render with real titles
    container.innerHTML = versionsWithMetadata.map((version, index) => {
        const voteCount = version.totalVotes || 0;
        const totalMembers = Object.keys(bandMembers).length;
        const isDefault = version.isDefault;
        const displayTitle = version.fetchedTitle || version.title;
        const hasVoted = version.votes && version.votes[currentUserEmail];
        
        return `
            <div class="spotify-version-card ${isDefault ? 'default' : ''}" style="position: relative;">
                <button onclick="deleteRefVersion(${index})" 
                    style="position: absolute; top: 10px; right: 10px; background: #ef4444!important; color: #ffffff!important; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; z-index: 10; line-height:24px; text-align:center; font-weight:700;">✕</button>
                
                <div class="version-header">
                    <div class="version-title">${displayTitle}</div>
                    ${isDefault ? `<div class="version-badge">👑 BAND CHOICE (${voteCount}/${totalMembers})</div>` : ''}
                </div>
                
                <div class="votes-container">
                    ${Object.entries(bandMembers).map(([email, member]) => {
                        const voted = version.votes && version.votes[email];
                        return `
                            <span class="vote-chip ${voted ? 'yes' : 'no'}" onclick="toggleRefVote(${index}, '${email}')" style="cursor: pointer;">
                                ${voted ? '✅ ' : ''}${member.name}
                            </span>
                        `;
                    }).join('')}
                </div>
                
                ${version.notes ? `<p style="margin-bottom:12px;font-style:italic;color:var(--text-muted,#94a3b8);display:flex;align-items:center;gap:6px">${version.notes} <button onclick="editVersionNotes(${index})" style="background:none;border:none;color:var(--accent-light,#818cf8);cursor:pointer;font-size:0.8em" title="Edit notes">✏️</button></p>` : ''}
                
                <button class="spotify-play-btn" onclick="window.open('${version.url || version.spotifyUrl}', '_blank')" style="${getPlayButtonStyle(version)}">
                    ${getPlayButtonLabel(version)}
                </button>
            </div>
        `;
    }).join('');
}

async function addRefVersion() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) { alert('Please select a song first!'); return; }

    const existing = document.getElementById('addRefModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'addRefModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:480px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent-light)">⭐ Add Reference Version</h3>
            <button onclick="document.getElementById('addRefModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        <!-- Tab toggle -->
        <div style="display:flex;gap:0;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:16px">
            <button id="refTabLink" onclick="refSwitchTab('link')"
                style="flex:1;padding:8px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:0.88em;font-weight:600">
                🔗 Paste Link
            </button>
            <button id="refTabUpload" onclick="refSwitchTab('upload')"
                style="flex:1;padding:8px;background:transparent;color:var(--text-dim);border:none;cursor:pointer;font-size:0.88em;font-weight:600">
                📁 Upload MP3
            </button>
        </div>
        <!-- Link panel -->
        <div id="refPanelLink">
            <p style="color:var(--text-dim);font-size:0.82em;margin-bottom:10px">Paste any link — Spotify, YouTube, Archive.org, SoundCloud, or any URL.</p>
            <div id="refUrlDetect" style="height:24px;margin-bottom:6px;font-size:0.8em;color:var(--text-muted)"></div>
            <div class="form-row">
                <label class="form-label">URL</label>
                <input class="app-input" id="refUrl" placeholder="https://..." oninput="detectRefPlatform(this.value)" autofocus>
            </div>
            <div class="form-row" style="margin-top:10px">
                <label class="form-label">Version Title (optional)</label>
                <input class="app-input" id="refTitle" placeholder="e.g. Live at Red Rocks 1987, Cornell '77...">
            </div>
            <div class="form-row" style="margin-top:10px">
                <label class="form-label">Notes (optional)</label>
                <input class="app-input" id="refNotes" placeholder="Why this version? What makes it special?">
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
                <button class="btn btn-primary" style="flex:1" onclick="saveRefVersionFromModal()">⭐ Add Reference</button>
                <button class="btn btn-ghost" onclick="document.getElementById('addRefModal').remove()">Cancel</button>
            </div>
        </div>
        <!-- Upload panel (hidden by default) -->
        <div id="refPanelUpload" style="display:none">
            <p style="color:var(--text-dim);font-size:0.82em;margin-bottom:10px">Upload an MP3, M4A, or WAV — stored in Firebase and shared with the whole band.</p>
            <div class="form-row">
                <label class="form-label">Audio File</label>
                <input type="file" id="refAudioFile" accept="audio/*,.mp3,.m4a,.wav,.aac"
                    style="width:100%;padding:8px;background:var(--bg-input,rgba(255,255,255,0.05));border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.88em">
                <div style="font-size:0.78em;color:var(--text-dim);margin-top:4px">MP3, M4A, WAV · max 20MB</div>
            </div>
            <div class="form-row" style="margin-top:10px">
                <label class="form-label">Version Title</label>
                <input class="app-input" id="refUploadTitle" placeholder="e.g. Studio demo, Live rehearsal 3/15...">
            </div>
            <div class="form-row" style="margin-top:10px">
                <label class="form-label">Notes (optional)</label>
                <input class="app-input" id="refUploadNotes" placeholder="What makes this version useful?">
            </div>
            <div id="refUploadProgress" style="display:none;margin-top:10px">
                <div style="background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;height:6px">
                    <div id="refUploadBar" style="height:100%;background:var(--accent);width:0%;transition:width 0.3s"></div>
                </div>
                <div id="refUploadStatus" style="font-size:0.8em;color:var(--text-dim);margin-top:4px;text-align:center">Uploading...</div>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
                <button class="btn btn-primary" style="flex:1" onclick="saveRefVersionUpload()">📤 Upload & Add</button>
                <button class="btn btn-ghost" onclick="document.getElementById('addRefModal').remove()">Cancel</button>
            </div>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    document.getElementById('refUrl')?.focus();
}

function refSwitchTab(tab) {
    const isLink = tab === 'link';
    document.getElementById('refPanelLink').style.display = isLink ? '' : 'none';
    document.getElementById('refPanelUpload').style.display = isLink ? 'none' : '';
    document.getElementById('refTabLink').style.cssText =
        `flex:1;padding:8px;background:${isLink ? 'var(--accent)' : 'transparent'};color:${isLink ? '#fff' : 'var(--text-dim)'};border:none;cursor:pointer;font-size:0.88em;font-weight:600`;
    document.getElementById('refTabUpload').style.cssText =
        `flex:1;padding:8px;background:${!isLink ? 'var(--accent)' : 'transparent'};color:${!isLink ? '#fff' : 'var(--text-dim)'};border:none;cursor:pointer;font-size:0.88em;font-weight:600`;
    if (!isLink) document.getElementById('refAudioFile')?.focus();
    else document.getElementById('refUrl')?.focus();
}

async function saveRefVersionUpload() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;

    const fileInput = document.getElementById('refAudioFile');
    const title = document.getElementById('refUploadTitle')?.value.trim();
    const notes = document.getElementById('refUploadNotes')?.value.trim();

    if (!fileInput?.files?.[0]) { alert('Please choose an audio file'); return; }
    if (!title) { alert('Please add a version title'); return; }

    const file = fileInput.files[0];
    if (file.size > 20 * 1024 * 1024) { alert('File too large — max 20MB'); return; }

    if (!firebaseStorage) { alert('Storage not ready — please sign in first'); return; }

    // Show progress
    const progWrapper = document.getElementById('refUploadProgress');
    const progBar = document.getElementById('refUploadBar');
    const progStatus = document.getElementById('refUploadStatus');
    progWrapper.style.display = '';

    try {
        const safeSong = sanitizeFirebasePath(songTitle);
        const safeName = sanitizeFirebasePath(file.name);
        const storageRef = firebaseStorage.ref(`ref_audio/${safeSong}/${Date.now()}_${safeName}`);
        const uploadTask = storageRef.put(file);

        await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                snap => {
                    const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                    progBar.style.width = pct + '%';
                    progStatus.textContent = `Uploading… ${pct}%`;
                },
                reject,
                resolve
            );
        });

        const downloadURL = await storageRef.getDownloadURL();
        progStatus.textContent = 'Saving…';

        const version = {
            id: 'version_' + Date.now(),
            title: title,
            url: downloadURL,
            spotifyUrl: downloadURL,
            platform: 'upload',
            fileName: file.name,
            fileSize: file.size,
            votes: {},
            totalVotes: 0,
            isDefault: false,
            addedBy: currentUserEmail,
            notes: notes || '',
            dateAdded: new Date().toLocaleDateString()
        };
        Object.keys(bandMembers).forEach(k => { version.votes[k] = false; });

        document.getElementById('addRefModal')?.remove();

        let versions = toArray(await loadRefVersions(songTitle) || []);
        versions.push(version);
        await saveRefVersions(songTitle, versions);
        const bandData = bandKnowledgeBase[songTitle] || {};
        await renderRefVersions(songTitle, bandData);
        showToast('✅ Uploaded & added as reference version!');
    } catch (err) {
        progWrapper.style.display = 'none';
        alert('Upload failed: ' + err.message);
    }
}

function detectRefPlatform(url) {
    const el = document.getElementById('refUrlDetect');
    if (!el) return;
    if (!url) { el.innerHTML = ''; return; }
    let icon = '', label = '';
    if (url.includes('spotify.com')) { icon = '🟢'; label = 'Spotify'; }
    else if (url.includes('youtube.com') || url.includes('youtu.be')) { icon = '▶️'; label = 'YouTube'; }
    else if (url.includes('archive.org')) { icon = '📼'; label = 'Archive.org'; }
    else if (url.includes('soundcloud.com')) { icon = '🔊'; label = 'SoundCloud'; }
    else if (url.includes('music.apple.com')) { icon = '🍎'; label = 'Apple Music'; }
    else if (url.includes('tidal.com')) { icon = '🌊'; label = 'Tidal'; }
    else if (url.startsWith('http')) { icon = '🔗'; label = 'Link'; }
    el.innerHTML = icon ? `<span style="background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);border-radius:6px;padding:2px 10px">${icon} Detected: ${label}</span>` : '';
}

async function saveRefVersionFromModal() {
    const songTitle = selectedSong?.title || selectedSong;
    const url = document.getElementById('refUrl')?.value.trim();
    const title = document.getElementById('refTitle')?.value.trim();
    const notes = document.getElementById('refNotes')?.value.trim();
    
    if (!url) { alert('Please paste a URL'); return; }
    try { new URL(url); } catch(e) { alert('Please paste a valid URL'); return; }
    
    if (!isUserSignedIn || !firebaseDB) {
        showSignInNudge();
        // Still proceed — data saves to localStorage and will sync when they sign in
    }
    
    let platform = 'link';
    if (url.includes('spotify.com')) platform = 'spotify';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
    else if (url.includes('music.apple.com')) platform = 'apple_music';
    else if (url.includes('tidal.com')) platform = 'tidal';
    else if (url.includes('soundcloud.com')) platform = 'soundcloud';
    else if (url.includes('archive.org')) platform = 'archive';
    
    const version = {
        id: 'version_' + Date.now(),
        title: title || 'Loading...',
        url: url,
        spotifyUrl: url,  // backward compat
        platform: platform,
        votes: {},
        totalVotes: 0,
        isDefault: false,
        addedBy: currentUserEmail,
        notes: notes || '',
        dateAdded: new Date().toLocaleDateString()
    };
    Object.keys(bandMembers).forEach(email => { version.votes[email] = false; });
    
    document.getElementById('addRefModal')?.remove();
    
    let versions = toArray(await loadRefVersions(songTitle) || []);
    versions.push(version);
    await saveRefVersions(songTitle, versions);
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderRefVersions(songTitle, bandData);
}

// Alias for old render function compatibility

async function toggleRefVote(versionIndex, voterEmail) {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    // Note: any signed-in band member can toggle votes
    // (email mismatch between bandMembers keys and Google OAuth made the old check too strict)
    
    let versions = await loadRefVersions(songTitle) || [];
    if (!versions[versionIndex]) return;
    
    // Toggle vote
    versions[versionIndex].votes[voterEmail] = !versions[versionIndex].votes[voterEmail];
    
    // Recalculate total votes
    versions[versionIndex].totalVotes = Object.values(versions[versionIndex].votes).filter(v => v).length;
    
    // Check if this becomes default (majority = 3+ votes)
    const totalMembers = Object.keys(bandMembers).length;
    const majority = Math.ceil(totalMembers / 2);
    versions[versionIndex].isDefault = versions[versionIndex].totalVotes >= majority;
    
    // Save
    await saveRefVersions(songTitle, versions);
    
    // Re-render
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderRefVersions(songTitle, bandData);
}

async function editVersionNotes(versionIndex) {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const formId = `versionNotesForm_${versionIndex}`;
    if (document.getElementById(formId)) return;
    let versions = await loadRefVersions(songTitle) || [];
    if (!versions[versionIndex]) return;
    const current = versions[versionIndex].notes || '';
    // Find the version card's notes area to inject inline
    const cards = document.querySelectorAll('.ref-version-card, [data-version-index]');
    let targetEl = null;
    cards.forEach(c => { if (c.dataset.versionIndex == versionIndex) targetEl = c; });
    // Fallback: append after the edit button
    const editBtn = document.querySelector(`[onclick*="editVersionNotes(${versionIndex})"]`);
    const insertTarget = targetEl || editBtn?.closest('.app-card, .list-item, div') || document.getElementById('refVersionsContainer');
    if (!insertTarget) return;
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'padding:10px 0;display:flex;flex-direction:column;gap:8px';
    form.innerHTML = `
        <textarea id="versionNotesInput_${versionIndex}" class="app-input"
            placeholder="Notes about this version..."
            style="min-height:80px;resize:vertical;font-family:inherit">${current}</textarea>
        <div style="display:flex;gap:8px">
            <button onclick="saveVersionNotes(${versionIndex})" class="btn btn-primary">💾 Save</button>
            <button onclick="document.getElementById('${formId}')?.remove()" class="btn btn-ghost">Cancel</button>
        </div>
    `;
    insertTarget.appendChild(form);
    document.getElementById(`versionNotesInput_${versionIndex}`)?.focus();
}

async function saveVersionNotes(versionIndex) {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const newNotes = document.getElementById(`versionNotesInput_${versionIndex}`)?.value?.trim();
    if (newNotes === undefined) return;
    let versions = await loadRefVersions(songTitle) || [];
    if (!versions[versionIndex]) return;
    versions[versionIndex].notes = newNotes;
    await saveRefVersions(songTitle, versions);
    document.getElementById(`versionNotesForm_${versionIndex}`)?.remove();
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderRefVersions(songTitle, bandData);
    showToast('✅ Notes saved');
}

async function deleteRefVersion(versionIndex) {
    if (!confirm('Delete this reference version?')) return;
    
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    
    let versions = await loadRefVersions(songTitle) || [];
    versions.splice(versionIndex, 1);
    
    await saveRefVersions(songTitle, versions);
    
    const bandData = bandKnowledgeBase[songTitle] || {};
    await renderRefVersions(songTitle, bandData);
}

async function saveRefVersions(songTitle, versions) {
    const result = await saveBandDataToDrive(songTitle, 'spotify_versions', versions);
    // Update North Star cache
    const hasVersions = versions && versions.length > 0;
    if (northStarCache[songTitle] !== hasVersions) {
        northStarCache[songTitle] = hasVersions || undefined;
        if (!hasVersions) delete northStarCache[songTitle];
        saveMasterFile(MASTER_NORTH_STAR_FILE, northStarCache).catch(() => {});
        addNorthStarBadges();
    }
    return result;
}

async function loadRefVersions(songTitle) {
    return toArray(await loadBandDataFromDrive(songTitle, 'spotify_versions') || []);
}

console.log('🎵 reference versions system loaded');

// Search helpers
function searchRefVersion() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) { alert('Please select a song first!'); return; }
    const songData = allSongs.find(s => s.title === songTitle);
    const bandName = getFullBandName(songData?.band || 'GD');
    const q = encodeURIComponent(`${songTitle} ${bandName}`);
    
    // Show platform picker modal
    const existing = document.getElementById('refSearchModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'refSearchModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:380px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <h3 style="margin:0;font-size:1em;color:var(--accent-light)">🔍 Find Reference Version</h3>
            <button onclick="document.getElementById('refSearchModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1em">✕</button>
        </div>
        <p style="color:var(--text-dim);font-size:0.8em;margin-bottom:16px">Opens the platform in a new tab. Copy the URL and paste it with "+ Suggest Reference Version".</p>
        <div style="display:flex;flex-direction:column;gap:8px">
            <a href="https://open.spotify.com/search/${q}" target="_blank" onclick="setTimeout(()=>document.getElementById('refSearchModal').remove(),500)"
               style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(29,185,84,0.12);border:1px solid rgba(29,185,84,0.3);border-radius:8px;text-decoration:none;color:var(--text);font-weight:600;font-size:0.9em">
               <span style="font-size:1.3em">🟢</span> Search Spotify
            </a>
            <a href="https://www.youtube.com/results?search_query=${q}" target="_blank" onclick="setTimeout(()=>document.getElementById('refSearchModal').remove(),500)"
               style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,0,0,0.1);border:1px solid rgba(255,0,0,0.25);border-radius:8px;text-decoration:none;color:var(--text);font-weight:600;font-size:0.9em">
               <span style="font-size:1.3em">▶️</span> Search YouTube
            </a>
            <a href="https://archive.org/search?query=${q}&and%5B%5D=mediatype%3A%22audio%22" target="_blank" onclick="setTimeout(()=>document.getElementById('refSearchModal').remove(),500)"
               style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.25);border-radius:8px;text-decoration:none;color:var(--text);font-weight:600;font-size:0.9em">
               <span style="font-size:1.3em">📼</span> Search Archive.org
            </a>
            <a href="https://soundcloud.com/search?q=${q}" target="_blank" onclick="setTimeout(()=>document.getElementById('refSearchModal').remove(),500)"
               style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,85,0,0.1);border:1px solid rgba(255,85,0,0.25);border-radius:8px;text-decoration:none;color:var(--text);font-weight:600;font-size:0.9em">
               <span style="font-size:1.3em">🔊</span> Search SoundCloud
            </a>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function searchUltimateGuitar() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) {
        alert('Please select a song first!');
        return;
    }
    
    // Get band name  
    const songData = allSongs.find(s => s.title === songTitle);
    const bandAbbr = songData ? songData.band : 'GD';
    const bandName = getFullBandName(bandAbbr);
    
    // Open Ultimate Guitar search
    const query = encodeURIComponent(`${songTitle} ${bandName}`);
    window.open(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${query}`, '_blank');
}

console.log('🔍 Search helper functions loaded');

// ============================================================================
// REHEARSAL NOTES FORM
// Collaborative note-taking with band member attribution
// ============================================================================

function showRehearsalNoteForm() {
    const formHTML = `
        <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #667eea; margin-bottom: 15px;">
            <h4 style="margin: 0 0 15px 0;">Add Rehearsal Note</h4>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Band Member:</label>
                <select id="rehearsalNoteAuthor" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                    <option value="">-- Who's saying this? --</option>
                    ${Object.entries(bandMembers).map(([key, member]) => `
                        <option value="${key}">${member.name}</option>
                    `).join('')}
                </select>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Priority:</label>
                <select id="rehearsalNotePriority" style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                    <option value="low">🟢 Low - Nice to have</option>
                    <option value="medium" selected>🟡 Medium - Should address</option>
                    <option value="high">🔴 High - Must fix before gig</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Note:</label>
                <textarea id="rehearsalNoteText" placeholder="E.g., Need to work on harmony entries - Chris coming in too early"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; min-height: 80px; font-family: inherit; font-size: 0.95em;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="chart-btn chart-btn-primary" onclick="addRehearsalNote()" style="flex: 1;">
                    ➕ Add Note
                </button>
                <button class="chart-btn chart-btn-secondary" onclick="hideRehearsalNoteForm()">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('rehearsalNoteFormContainer').innerHTML = formHTML;
}

function hideRehearsalNoteForm() {
    document.getElementById('rehearsalNoteFormContainer').innerHTML = '';
}

async function addRehearsalNote() {
    const author = document.getElementById('rehearsalNoteAuthor').value;
    const priority = document.getElementById('rehearsalNotePriority').value;
    const text = document.getElementById('rehearsalNoteText').value.trim();
    
    if (!author) {
        alert('Please select who is making this note');
        return;
    }
    
    if (!text) {
        alert('Please enter a note');
        return;
    }
    
    const note = {
        author: author,
        date: new Date().toISOString().split('T')[0],
        priority: priority,
        note: text
    };
    
    // Save to Google Drive (shared with all band members)
    const notes = await loadRehearsalNotes(selectedSong.title);
    notes.push(note);
    await saveRehearsalNotes(selectedSong.title, notes);
    
    // Show success
    showToast(`✅ Note added by ${bandMembers[author].name}`);
    logActivity('rehearsal_note', { song: selectedSong.title, extra: bandMembers[author].name });
    
    // Clear form
    hideRehearsalNoteForm();
    
    // Refresh display
    renderRehearsalNotesWithStorage(selectedSong.title);
}


async function editRehearsalNote(songTitle, index) {
    const notes = await loadRehearsalNotes(songTitle);
    const note = notes[index];
    if (!note) return;
    const contentEl = document.getElementById(`rn_content_${index}`);
    if (!contentEl) return;
    contentEl.innerHTML = `
        <textarea id="rn_edit_${index}" class="app-input" style="width:100%;min-height:60px;resize:vertical;margin-top:6px;font-family:inherit">${note.note}</textarea>
        <div style="display:flex;gap:6px;margin-top:6px">
            <button onclick="saveRehearsalNoteEdit('${songTitle}',${index})" class="btn btn-primary" style="font-size:0.8em;padding:4px 10px">💾 Save</button>
            <button onclick="renderRehearsalNotesWithStorage('${songTitle}')" class="btn btn-ghost" style="font-size:0.8em;padding:4px 10px">Cancel</button>
        </div>
    `;
}

async function saveRehearsalNoteEdit(songTitle, index) {
    const textarea = document.getElementById(`rn_edit_${index}`);
    if (!textarea) return;
    const notes = await loadRehearsalNotes(songTitle);
    notes[index].note = textarea.value.trim();
    await saveRehearsalNotes(songTitle, notes);
    await renderRehearsalNotesWithStorage(songTitle);
    showToast('✅ Note updated');
}

async function deleteRehearsalNoteInline(songTitle, index, btn) {
    if (btn && btn.dataset.confirming) {
        const notes = await loadRehearsalNotes(songTitle);
        notes.splice(index, 1);
        await saveRehearsalNotes(songTitle, notes);
        await renderRehearsalNotesWithStorage(songTitle);
        showToast('🗑️ Note removed');
    } else if (btn) {
        btn.dataset.confirming = '1';
        btn.textContent = 'Sure?';
        btn.style.background = '#ef4444';
        btn.style.color = 'white';
        setTimeout(() => { if (btn) { btn.dataset.confirming = ''; btn.textContent = '🗑️'; btn.style.background = 'rgba(239,68,68,0.15)'; btn.style.color = '#ef4444'; }}, 3000);
    }
}

async function renderRehearsalNotesWithStorage(songTitle) {
    const container = document.getElementById('rehearsalNotesContainer');
    const bandData = bandKnowledgeBase[songTitle];
    
    // Get notes from both sources
    const dataJsNotes = (bandData && bandData.rehearsalNotes) || [];
    const storedNotes = await loadRehearsalNotes(songTitle);
    
    // Combine and sort by date (newest first)
    const allNotes = [...dataJsNotes, ...storedNotes].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    
    if (allNotes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">No rehearsal notes yet - add your first one above!</div>';
        return;
    }
    
    const priorityColors = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981'
    };
    
    const priorityEmojis = {
        high: '🔴',
        medium: '🟡',
        low: '🟢'
    };
    
    container.innerHTML = `
        <div class="rehearsal-notes-list">
            ${allNotes.map(note => {
                const memberName = bandMembers[note.author]?.name || note.author;
                const priorityColor = priorityColors[note.priority] || '#667eea';
                const priorityEmoji = priorityEmojis[note.priority] || '-';
                
                const storedIndex = storedNotes.indexOf(note);
                const canEdit = storedIndex !== -1;
                return `
                    <div class="rehearsal-note-card ${note.priority === 'high' ? 'high' : ''}">
                        <div class="note-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                            <div>
                                <span><strong>${memberName}</strong> - ${note.date?.substring(0,10)||''}</span>
                                <span style="color: ${priorityColor}; font-weight: 600; margin-left:8px">
                                    ${priorityEmoji} ${(note.priority||'').toUpperCase()} PRIORITY
                                </span>
                            </div>
                            ${canEdit ? `<div style="display:flex;gap:4px;flex-shrink:0">
                                <button onclick="editRehearsalNote('${songTitle}',${storedIndex})" style="background:rgba(102,126,234,0.15);color:#818cf8;border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 7px;cursor:pointer;font-size:11px">✏️</button>
                                <button onclick="deleteRehearsalNoteInline('${songTitle}',${storedIndex},this)" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:4px;padding:3px 7px;cursor:pointer;font-size:11px">🗑️</button>
                            </div>` : ''}
                        </div>
                        <div class="note-content" id="rn_content_${storedIndex}">${note.note}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
// ============================================================================
// HARMONY AUDIO SNIPPETS
// Upload audio files (Voice Memos, Soundtrap, etc.) with custom naming
// Uses localStorage with base64 for immediate functionality
// ============================================================================

function showHarmonyAudioUploadForm(sectionIndex) {
    const formHTML = `
        <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #667eea; margin-top: 15px;">
            <h4 style="margin: 0 0 15px 0;">Upload Harmony Audio Snippet</h4>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Audio File:</label>
                <input type="file" id="harmonyAudioFile" accept="audio/*"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
                <p style="font-size: 0.85em; color: #6b7280; margin-top: 5px;">
                    📎 Accepts: MP3, M4A, WAV, Voice Memos, Soundtrap exports, etc. (Max 5MB)
                </p>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Snippet Name:</label>
                <input type="text" id="harmonySnippetName" 
                    placeholder="E.g., Drew lead vocal - first try"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Notes:</label>
                <input type="text" id="harmonySnippetNotes" 
                    placeholder="E.g., Recorded on iPhone after practice"
                    style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px;">
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="chart-btn chart-btn-primary" onclick="uploadHarmonyAudio(${sectionIndex})" style="flex: 1;">
                    📤 Upload Audio
                </button>
                <button class="chart-btn chart-btn-secondary" onclick="hideHarmonyAudioForm()">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('harmonyAudioFormContainer' + sectionIndex).innerHTML = formHTML;
}

function hideHarmonyAudioForm() {
    // Hide all forms
    document.querySelectorAll('[id^="harmonyAudioFormContainer"]').forEach(el => {
        el.innerHTML = '';
    });
}

async function uploadHarmonyAudio(sectionIndex) {
    const fileInput = document.getElementById('harmonyAudioFile');
    const name = document.getElementById('harmonySnippetName').value.trim();
    const notes = document.getElementById('harmonySnippetNotes').value.trim();
    
    if (!fileInput.files || !fileInput.files[0]) {
        alert('Please select an audio file');
        return;
    }
    
    if (!name) {
        alert('Please enter a name for this snippet');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Check file size (5MB limit for localStorage)
    if (file.size > 5 * 1024 * 1024) {
        alert('File too large! Please use a file under 5MB.\n\nTip: You can compress audio files or use shorter clips.');
        return;
    }
    
    // Show loading
    const uploadButton = event.target;
    const originalText = uploadButton.innerHTML;
    uploadButton.innerHTML = '⏳ Uploading...';
    uploadButton.disabled = true;
    
    try {
        // Convert to base64
        const base64 = await fileToBase64(file);
        
        const snippet = {
            name: name,
            notes: notes,
            filename: file.name,
            type: file.type,
            size: file.size,
            data: base64,
            uploadedBy: 'drew', // Could make this selectable
            uploadedDate: new Date().toISOString().split('T')[0]
        };
        
        // Save to Google Drive (shared with band!)
        const key = `harmony_audio_section_${sectionIndex}`;
        const existing = await loadBandDataFromDrive(selectedSong.title, key) || [];
        existing.push(snippet);
        await saveBandDataToDrive(selectedSong.title, key, existing);
        
        // Also save to localStorage as backup
        const localKey = `deadcetera_harmony_audio_${selectedSong.title}_section${sectionIndex}`;
        localStorage.setItem(localKey, JSON.stringify(existing));
        
        showToast('✅ Audio uploaded — shared with band!');
        
        // Clear form
        hideHarmonyAudioForm();
        
        // Refresh harmony display
        const bandData = bandKnowledgeBase[selectedSong.title];
        if (bandData) {
            renderHarmoniesEnhanced(selectedSong.title, bandData);
        } else {
            
        }
    } catch (error) {
        alert('Error uploading file: ' + error.message);
    } finally {
        uploadButton.innerHTML = originalText;
        uploadButton.disabled = false;
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function loadHarmonyAudioSnippets(songTitle, sectionIndex) {
    // Load from Google Drive first
    const key = `harmony_audio_section_${sectionIndex}`;
    const driveData = await loadBandDataFromDrive(songTitle, key);
    if (driveData && Array.isArray(driveData)) return driveData;
    
    // Fallback to localStorage
    const localKey = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    const stored = localStorage.getItem(localKey);
    return stored ? JSON.parse(stored) : [];
}


async function deleteHarmonySnippet(songTitle, sectionIndex, snippetIndex) {
    if (!confirm('Delete this audio snippet?')) return;
    
    // Load from Drive
    const key = `harmony_audio_section_${sectionIndex}`;
    const snippets = await loadBandDataFromDrive(songTitle, key) || [];
    
    snippets.splice(snippetIndex, 1);
    
    // Save back to Drive
    await saveBandDataToDrive(songTitle, key, snippets);
    
    // Update localStorage backup
    const localKey = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    localStorage.setItem(localKey, JSON.stringify(snippets));
    
    // Refresh display
    const bandData = bandKnowledgeBase[selectedSong.title];
    if (bandData) {
        renderHarmoniesEnhanced(selectedSong.title, bandData);
    }
}

// ============================================================================
// COLLABORATIVE EDIT (DELETE/RENAME BY ANYONE)
// ============================================================================

async function renameHarmonySnippet(songTitle, sectionIndex, snippetIndex) {
    const formId = `renameSnippetForm_${sectionIndex}_${snippetIndex}`;
    if (document.getElementById(formId)) return;
    const key = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    const snippets = JSON.parse(localStorage.getItem(key) || '[]');
    const snippet = snippets[snippetIndex];
    if (!snippet) return;
    const renameBtn = document.querySelector(`[onclick*="renameHarmonySnippet"][onclick*="${sectionIndex}"][onclick*="${snippetIndex}"]`);
    const insertTarget = renameBtn?.closest('.snippet-row, .list-item, div[style]') || renameBtn?.parentElement;
    if (!insertTarget) return;
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'display:flex;gap:6px;align-items:center;padding:4px 0';
    form.innerHTML = `
        <input id="snippetNameInput_${sectionIndex}_${snippetIndex}" class="app-input"
            value="${snippet.name || ''}" placeholder="Snippet name"
            style="flex:1" autocomplete="off">
        <button onclick="saveSnippetRename('${songTitle}',${sectionIndex},${snippetIndex})" class="btn btn-primary btn-sm">Save</button>
        <button onclick="document.getElementById('${formId}')?.remove()" class="btn btn-ghost btn-sm">✕</button>
    `;
    insertTarget.after(form);
    document.getElementById(`snippetNameInput_${sectionIndex}_${snippetIndex}`)?.select();
}

async function saveSnippetRename(songTitle, sectionIndex, snippetIndex) {
    const newName = document.getElementById(`snippetNameInput_${sectionIndex}_${snippetIndex}`)?.value?.trim();
    if (!newName) return;
    const key = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    const snippets = JSON.parse(localStorage.getItem(key) || '[]');
    if (!snippets[snippetIndex]) return;
    snippets[snippetIndex].name = newName;
    localStorage.setItem(key, JSON.stringify(snippets));
    saveBandDataToDrive(songTitle, `harmony_audio_section_${sectionIndex}`, snippets);
    document.getElementById(`renameSnippetForm_${sectionIndex}_${snippetIndex}`)?.remove();
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) renderHarmoniesEnhanced(songTitle, bandData);
    showToast('✅ Renamed');
}

function deleteHarmonySnippetEnhanced(songTitle, sectionIndex, snippetIndex) {
    if (!confirm('Delete this audio snippet? Anyone can delete.')) return;
    
    const key = `deadcetera_harmony_audio_${songTitle}_section${sectionIndex}`;
    const snippets = JSON.parse(localStorage.getItem(key) || '[]');
    snippets.splice(snippetIndex, 1);
    localStorage.setItem(key, JSON.stringify(snippets));
    saveBandDataToDrive(songTitle, `harmony_audio_section_${sectionIndex}`, snippets);
    
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) renderHarmoniesEnhanced(songTitle, bandData);
}

// ============================================================================
// ABC EDITOR
// ============================================================================

// generateSheetMusic wrapper defined later (after enhanced version)


// Enhanced harmony rendering with audio snippets, recording, and sheet music
async function renderHarmoniesEnhanced(songTitle, bandData) {
    const container = document.getElementById('harmoniesContainer');
    if (!container) return;
    
    // Immediately show loading state so we know the function is running
    container.innerHTML = '<p style="padding: 10px; color: #667eea;">🎤 Loading harmony info...</p>';
    
    try {
    // Check if song has harmonies - use cache first, then Drive
    let hasHarmonies = harmonyBadgeCache[songTitle] || harmonyCache[songTitle];
    console.log(`🎤 Harmony render for "${songTitle}": cacheValue=${hasHarmonies}, bandData.harmonies=${!!bandData?.harmonies}`);
    if (hasHarmonies === undefined || hasHarmonies === null) {
        hasHarmonies = await loadHasHarmonies(songTitle);
        console.log(`🎤 Loaded hasHarmonies from Drive: ${hasHarmonies}`);
    }
    
    const safeSongTitle = songTitle.replace(/'/g, "\\'");
    
    if (!hasHarmonies) {
        // Double-check: maybe harmony DATA exists even if the flag isn't set
        const checkData = await loadBandDataFromDrive(songTitle, 'harmonies_data');
        if (checkData && checkData.sections && toArray(checkData.sections).length > 0) {
            hasHarmonies = true;
            console.log('🎤 Found harmony data despite flag being unset, auto-correcting');
        }
    }
    
    if (!hasHarmonies) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <p style="color: #9ca3af; font-style: italic; margin-bottom: 15px;">No harmony parts documented yet.</p>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">
                    <button onclick="addFirstHarmonySection('${safeSongTitle}')" 
                        class="chart-btn chart-btn-primary" style="background: #667eea;">
                        🎤 Add Harmony Section
                    </button>
                    <button onclick="importHarmoniesFromFadr('${safeSongTitle}')"
                        style="background:#059669;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.9em;font-weight:600">
                        🎵 Auto-Import Harmonies
                    </button>
                </div>
                <p style="color: #9ca3af; font-size: 0.85em;">Auto-import uses Fadr AI to extract vocal parts from an Archive.org recording.</p>
            </div>
        `;
        return;
    }
    
    if (!bandData || !bandData.harmonies) {
        // Check if harmony data exists on Drive (may not be in data.js)
        const driveHarmonies = await loadBandDataFromDrive(songTitle, 'harmonies_data');
        if (driveHarmonies && driveHarmonies.sections && toArray(driveHarmonies.sections).length > 0) {
            // Normalize sections from Firebase
            driveHarmonies.sections = toArray(driveHarmonies.sections);
            driveHarmonies.sections.forEach(s => { if (s.parts) s.parts = toArray(s.parts); });
            // Found harmony data - use it
            if (!bandData) bandData = {};
            bandData.harmonies = driveHarmonies;
            bandKnowledgeBase[songTitle] = bandData;
            console.log(`🎤 Loaded ${driveHarmonies.sections.length} harmony sections from Firebase for "${songTitle}"`);
        } else {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <p style="color: #6b7280; margin-bottom: 15px;">This song is marked as having harmonies but no parts have been added yet.</p>
                    <button onclick="addFirstHarmonySection('${safeSongTitle}')" 
                        class="chart-btn chart-btn-primary" style="background: #667eea;">
                        🎤 Add Harmony Section
                    </button>
                </div>
            `;
            return;
        }
    }
    
    console.log(`🎤 Rendering ${bandData.harmonies.sections?.length || 0} sections for "${songTitle}"`);
    
    // Firebase may convert arrays to objects with numeric keys - normalize
    let sections = bandData.harmonies.sections;
    if (sections && !Array.isArray(sections)) {
        sections = Object.values(sections);
        bandData.harmonies.sections = sections;
    }
    
    if (!sections || sections.length === 0) {
        // Check Firebase for sections that might not be in data.js
        const driveHarmonies = await loadBandDataFromDrive(songTitle, 'harmonies_data');
        if (driveHarmonies && driveHarmonies.sections && toArray(driveHarmonies.sections).length > 0) {
            driveHarmonies.sections = toArray(driveHarmonies.sections);
            driveHarmonies.sections.forEach(s => { if (s.parts) s.parts = toArray(s.parts); });
            bandData.harmonies = driveHarmonies;
            bandKnowledgeBase[songTitle] = bandData;
            // Continue rendering with Firebase data (don't return)
        } else {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <p style="color: #6b7280; margin-bottom: 15px;">Harmony sections are empty. Add the first one!</p>
                    <button onclick="addFirstHarmonySection('${safeSongTitle}')" 
                        class="chart-btn chart-btn-primary" style="background: #667eea;">
                        🎤 Add Harmony Section
                    </button>
                </div>
            `;
            return;
        }
    }
    
    // Use the latest sections (may have been updated from Firebase)
    let finalSections = toArray(bandData.harmonies.sections);
    finalSections.forEach(s => { if (s && s.parts) s.parts = toArray(s.parts); });
    
    const sectionsHTML = await Promise.all(finalSections.map(async (section, sectionIndex) => {
        console.log(`🎤 Section ${sectionIndex} keys:`, Object.keys(section), 'lyric:', section.lyric, 'name:', section.name);
        const audioSnippets = await loadHarmonyAudioSnippets(songTitle, sectionIndex);
        // Load ABC from Google Drive first, fallback to localStorage
        const savedAbc = await loadABCNotation(songTitle, sectionIndex);
        const sheetMusicExists = savedAbc && savedAbc.length > 0;
        
        // Get section title: prefer ABC T: field, then section properties
        let sectionDisplayName = section.lyric || section.name || section.title || section.label || `Section ${sectionIndex + 1}`;
        if (savedAbc) {
            const abcTMatch = savedAbc.match(/^T:(.+)$/m);
            if (abcTMatch) sectionDisplayName = abcTMatch[1].trim();
        }
        const sheetMusicButtonText = sheetMusicExists ? '🎼 👁️ View Sheet Music' : '🎼 Create Sheet Music';
        const sheetMusicButtonStyle = sheetMusicExists ? 
            'padding: 6px 12px; font-size: 0.85em; background: #10b981; color: white;' : 
            'padding: 6px 12px; font-size: 0.85em;';
        
        // Render parts with metadata
        const partsHTML = await renderHarmonyPartsWithMetadata(songTitle, sectionIndex, section.parts || []);
        
        return `
            <div class="harmony-card" style="background: #fff5f5; border: 2px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div class="harmony-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div class="harmony-lyric" style="font-size: 1.2em; font-weight: 600; font-style: italic; color: #991b1b;">"${sectionDisplayName}"</div>
                    <button class="chart-btn ${sheetMusicExists ? '' : 'chart-btn-secondary'}" 
                        onclick="generateSheetMusic(${sectionIndex}, ${JSON.stringify(section).replace(/"/g, '&quot;')})" 
                        style="${sheetMusicButtonStyle}">
                        ${sheetMusicButtonText}
                    </button>
                </div>
                
                ${partsHTML}
                
                ${section.practiceNotes && section.practiceNotes.length > 0 ? `
                    <div class="practice-notes-box" style="background: #fffbeb; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
                        <strong style="color: #92400e;">📝 General Practice Notes:</strong>
                        <ul style="margin: 8px 0 0 20px; padding: 0;">
                            ${section.practiceNotes.map(note => `<li style="margin: 4px 0; color: #78350f;">${note}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Audio Snippets -->
                <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #fee2e2;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <strong style="color: #991b1b;">🎵 Audio Snippets</strong>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="openMultiTrackStudio('${songTitle}', ${sectionIndex})" 
                                style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                                🎛️ Multi-Track Studio
                            </button>
                            <button onclick="showHarmonyAudioUploadForm(${sectionIndex})" 
                                style="background: #4b5563; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                                📤 Upload File
                            </button>
                        </div>
                    </div>
                    
                    <div id="harmonyAudioFormContainer${sectionIndex}"></div>
                    
                    ${audioSnippets.length > 0 ? `
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${audioSnippets.map((snippet, snippetIndex) => `
                                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 2px solid #e5e7eb;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                                        <div>
                                            <strong style="color: #1f2937;">${snippet.name}</strong>
                                            ${snippet.notes ? `<p style="margin: 5px 0 0 0; font-size: 0.85em; color: #6b7280;">${snippet.notes}</p>` : ''}
                                        </div>
                                        <div style="display: flex; gap: 8px;">
                                            <button onclick="renameHarmonySnippet('${songTitle}', ${sectionIndex}, ${snippetIndex})" 
                                                style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em;">✏️</button>
                                            <button onclick="deleteHarmonySnippetEnhanced('${songTitle}', ${sectionIndex}, ${snippetIndex})" 
                                                style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85em;">✕</button>
                                        </div>
                                    </div>
                                    <audio controls src="${snippet.data}" style="width: 100%; margin-bottom: 8px;"></audio>
                                    <p style="margin: 0; font-size: 0.8em; color: #9ca3af;">
                                        ${bandMembers[snippet.uploadedBy]?.name || snippet.uploadedBy} - ${snippet.uploadedDate}
                                        ${snippet.isRecording ? ' - 🎙️ Recorded' : ''}
                                    </p>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 0.9em;">
                            No audio snippets yet. Record now or upload a file!
                        </div>
                    `}
                </div>
            </div>
        `;
    }));
    
    // Show full lyrics if available
    const lyricsText = bandData.harmonies && bandData.harmonies.lyrics;
    const lyricsBlock = lyricsText ? `
        <div id="harmonyLyricsBlock" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <strong style="color:#818cf8;font-size:0.9em;">🎤 Lyrics</strong>
                <button onclick="document.getElementById('harmonyLyricsBlock').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.85em">Hide</button>
            </div>
            <pre style="white-space:pre-wrap;font-family:inherit;font-size:0.85em;color:var(--text,#f1f5f9);line-height:1.7;margin:0">${lyricsText.replace(/</g,'&lt;')}</pre>
        </div>
    ` : '';

    // Delegate to the AI learning view
    await renderHarmonyLearningView(songTitle);
    console.log('🎤 Harmony rendering complete');
    } catch (error) {
        console.error('❌ renderHarmoniesEnhanced error:', error);
        const safe = (songTitle || '').replace(/'/g, "\\'");
        container.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <p style="color: #ef4444; margin-bottom: 10px;">⚠️ Error loading harmonies</p>
                <p style="color: #6b7280; margin-bottom: 15px; font-size: 0.85em;">${error.message || 'Unknown error'}</p>
                <button onclick="addFirstHarmonySection('${safe}')" 
                    class="chart-btn chart-btn-primary" style="background: #667eea;">
                    🎤 Add Harmony Section
                </button>
            </div>
        `;
    }
}

async function renderHarmonyPartsWithMetadata(songTitle, sectionIndex, parts) {
    // Load metadata from Drive
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    
    // Firebase converts empty arrays to null - handle that
    if (!parts || !Array.isArray(parts)) parts = [];
    
    // Sort parts by order (highest to lowest pitch)
    const sortedParts = [...parts].sort((a, b) => {
        const orderA = metadata[a.singer]?.order !== undefined ? metadata[a.singer].order : 999;
        const orderB = metadata[b.singer]?.order !== undefined ? metadata[b.singer].order : 999;
        return orderA - orderB;
    });
    
    const partsHTML = await Promise.all(sortedParts.map(async (part, partIndex) => {
        const customNotes = await loadPartNotes(songTitle, sectionIndex, part.singer);
        const partMeta = metadata[part.singer] || {};
        const isLead = partMeta.isLead || false;
        const startingNote = partMeta.startingNote || '';
        
        return `
        <div class="part-row" style="display: flex; flex-direction: column; gap: 12px; padding: 15px; background: #ffffff; border-radius: 8px; margin-bottom: 12px; border: 2px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
                        <div style="font-weight: 700; font-size: 1.1em; color: #667eea;">${bandMembers[part.singer]?.name || part.singer}</div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" ${isLead ? 'checked' : ''} 
                                onchange="updatePartMetadata('${songTitle}', ${sectionIndex}, '${part.singer}', 'isLead', this.checked)"
                                style="width: 16px; height: 16px; cursor: pointer;">
                            <span style="font-size: 0.9em; color: #6b7280; font-weight: 600;">🎤 Lead</span>
                        </label>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.9em; color: #6b7280; font-weight: 600;">Starting Note:</span>
                            <select onchange="updatePartMetadata('${songTitle}', ${sectionIndex}, '${part.singer}', 'startingNote', this.value)"
                                style="padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; font-size: 0.9em;">
                                <option value="">-</option>
                                ${['A', 'A#/Bb', 'B', 'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab'].map(note => 
                                    `<option value="${note}" ${startingNote === note ? 'selected' : ''}>${note}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.85em; color: #6b7280;">Sort:</span>
                            <button onclick="movePartUp('${songTitle}', ${sectionIndex}, '${part.singer}')" 
                                style="background: #e5e7eb; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">▲</button>
                            <button onclick="movePartDown('${songTitle}', ${sectionIndex}, '${part.singer}')" 
                                style="background: #e5e7eb; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">▼</button>
                        </div>
                    </div>
                </div>
                
                <button onclick="addPartNote('${songTitle}', ${sectionIndex}, '${part.singer}')" 
                    style="background: #667eea; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em; white-space: nowrap;">
                    + Note
                </button>
            </div>
            
            ${customNotes && customNotes.length > 0 ? `
                <div style="margin-top: 8px; background: #f9fafb; padding: 12px; border-radius: 6px;">
                    <strong style="font-size: 0.9em; color: #374151;">📝 Practice Notes:</strong>
                    <ul style="margin: 8px 0 0 20px; padding: 0;">
                        ${customNotes.map((note, noteIndex) => `
                            <li style="margin: 6px 0; font-size: 0.9em; color: #4b5563;">
                                ${note}
                                <button onclick="editPartNote('${songTitle}', ${sectionIndex}, '${part.singer}', ${noteIndex})" 
                                    style="margin-left: 8px; background: none; border: none; cursor: pointer; color: #667eea; font-size: 0.85em;">✏️</button>
                                <button onclick="deletePartNote('${songTitle}', ${sectionIndex}, '${part.singer}', ${noteIndex})" 
                                    style="background: none; border: none; cursor: pointer; color: #ef4444; font-size: 0.9em;">✕</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    }));
    
    return (await Promise.all(partsHTML)).join('');
}

// Helper functions for part metadata
async function updatePartMetadata(songTitle, sectionIndex, singer, field, value) {
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    
    if (!metadata[singer]) metadata[singer] = {};
    metadata[singer][field] = value;
    
    await saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata);
    
    // Refresh display
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

async function movePartUp(songTitle, sectionIndex, singer) {
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    const currentOrder = metadata[singer]?.order !== undefined ? metadata[singer].order : 0;
    
    if (!metadata[singer]) metadata[singer] = {};
    metadata[singer].order = currentOrder - 1;
    
    await saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata);
    
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

async function movePartDown(songTitle, sectionIndex, singer) {
    const metadata = await loadHarmonyMetadataFromDrive(songTitle, sectionIndex) || {};
    const currentOrder = metadata[singer]?.order !== undefined ? metadata[singer].order : 0;
    
    if (!metadata[singer]) metadata[singer] = {};
    metadata[singer].order = currentOrder + 1;
    
    await saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata);
    
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

console.log('🎵 Comprehensive harmony parts rendering loaded');

// ============================================================================
// ENHANCED ABC EDITOR
// Edit ABC notation in-app, preview rendered sheet music, save to harmony
// ============================================================================

async function generateSheetMusicEnhanced(sectionIndex, section) {
    const parts = section.parts || [];
    
    // Map part types to ABC notation notes
    const partToNote = {
        'lead': 'C',           
        'harmony_high': 'E',   
        'harmony_low': 'A,',   
        'doubling': 'C'        
    };
    
    // Check if we have saved ABC notation - load from Drive first
    const savedAbc = await loadABCNotation(selectedSong.title, sectionIndex);
    
    // Get song BPM for default template
    const songBpm = await loadSongBpm(selectedSong.title) || 120;
    
    let abcNotation = savedAbc || generateDefaultABC(section, parts, partToNote, songBpm);
    
    // Get title: prefer ABC T: field, then section properties
    let sectionTitle = section.lyric || section.name || section.title || section.label;
    const abcTitleMatch = abcNotation.match(/^T:(.+)$/m);
    if (abcTitleMatch) sectionTitle = abcTitleMatch[1].trim();
    sectionTitle = sectionTitle || `Section ${sectionIndex + 1}`;
    
    // Show editor modal
    showABCEditorModal(sectionTitle, abcNotation, sectionIndex);
}

function generateDefaultABC(section, parts, partToNote, bpm) {
    const title = section.lyric || section.name || section.title || section.label || 'Enter Lyric or Section Name Here';
    const tempo = bpm || 120;
    
    let abc = `X:1\nT:${title}\nM:4/4\nQ:1/4=${tempo}\nL:1/8\nK:C\n`;
    
    if (parts && parts.length > 0) {
        // Create voice definitions for each part/singer
        parts.forEach((part, i) => {
            const memberName = bandMembers[part.singer]?.name || part.singer;
            abc += `V:${i + 1} clef=treble name="${memberName}"\n`;
        });
        abc += `%\n`;
        
        // Add placeholder notes for each voice
        parts.forEach((part, i) => {
            const note = partToNote[part.part] || 'C';
            abc += `[V:${i + 1}]${note}2${note}2${note}2${note}2|${note}2${note}2${note}4|\n`;
        });
    } else {
        // No parts defined - create a simple template with examples
        abc += `% Add voices below. Example:\n`;
        abc += `% V:1 clef=treble name="Pierce"\n`;
        abc += `% V:2 clef=treble name="Brian"\n`;
        abc += `% V:3 clef=treble name="Drew"\n`;
        abc += `%\n`;
        abc += `% [V:1]CCCC|CCCC|\n`;
        abc += `% [V:2]EEEE|EEEE|\n`;
        abc += `% [V:3]GGGG|GGGG|\n`;
        abc += `C2C2C2C2|C2C2C4|\n`;
    }
    
    return abc;
}

function showABCEditorModal(title, initialAbc, sectionIndex) {
    const modal = document.createElement('div');
    modal.id = 'abcEditorModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 16px; max-width: 1200px; width: 100%; max-height: 95vh; overflow: hidden; display: flex; flex-direction: column;">
            <div style="padding: 20px 25px; border-bottom: 2px solid #e2e8f0;">
                <h3 style="margin: 0 0 10px 0; font-size: ${title.length > 80 ? '0.85em' : title.length > 40 ? '1em' : '1.17em'}; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word;">🎼 Edit Sheet Music: ${title}</h3>
                <p style="margin: 0; color: #6b7280; font-size: 0.9em;">
                    Edit ABC notation below, then click "Preview" to see the rendered sheet music
                    - <a href="https://abcnotation.com/wiki/abc:standard:v2.1" target="_blank" style="color: #667eea;">📖 ABC Tutorial</a>
                    - <a href="https://abcjs.net/abcjs-editor.html" target="_blank" style="color: #667eea;">🎼 Full ABC Editor</a>
                </p>
                <!-- Import Toolbar -->
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                    <button onclick="importABCFromPhoto(${sectionIndex})" 
                        style="background:#7c3aed;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.82em;font-weight:600">
                        📷 Import from Photo
                    </button>
                    <button onclick="importABCFromMuseScore('${title.replace(/'/g,"\\'")}', ${sectionIndex})"
                        style="background:#0369a1;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.82em;font-weight:600">
                        🎼 Search MuseScore
                    </button>
                    <button onclick="importABCFromAudio(${sectionIndex})"
                        style="background:#065f46;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.82em;font-weight:600">
                        🎵 Import from Audio
                    </button>
                    <button onclick="importHarmoniesFromFadr('${title.replace(/'/g, "\\\'")}' )"
                        style="background:#059669;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.82em;font-weight:600">
                        🤖 Fadr Auto-Import
                    </button>
                    <span id="abcImportStatus" style="color:#6b7280;font-size:0.82em;align-self:center"></span>
                </div>
                </p>
            </div>
            
            <div style="flex: 1; overflow: auto; padding: 25px; display: flex; gap: 20px; flex-wrap: wrap;">
                <!-- Left: Editor -->
                <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column;">
                    <label style="font-weight: 600; margin-bottom: 8px; color: #2d3748;">📝 ABC Notation:</label>
                    <textarea id="abcEditorTextarea" 
                        style="flex: 1; min-height: 200px; font-family: 'Courier New', monospace; font-size: 0.95em; padding: 15px; border: 2px solid #e2e8f0; border-radius: 8px; resize: none;"
                    >${initialAbc}</textarea>
                    
                    <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <strong style="font-size: 0.9em;">💡 Quick Tips:</strong>
                        <ul style="margin: 8px 0 0 20px; font-size: 0.85em; line-height: 1.6;">
                            <li>C D E F G A B = Notes</li>
                            <li>2 = half note, 4 = quarter note</li>
                            <li>| = bar line</li>
                            <li>' = octave up, , = octave down</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Right: Preview -->
                <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column;">
                    <label style="font-weight: 600; margin-bottom: 8px; color: #2d3748;">👁️ Preview:</label>
                    <div id="abcPreviewContainer" style="flex: 1; min-height: 300px; background: #f9fafb; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; overflow: auto; -webkit-overflow-scrolling: touch;">
                        <p style="color: #9ca3af; text-align: center; margin-top: 40px;">Click "Preview" to render sheet music</p>
                    </div>
                    <p style="margin-top: 5px; font-size: 0.8em; color: #9ca3af;">Scroll horizontally if notation extends beyond the preview area</p>
                </div>
            </div>
            
            <div style="padding: 20px; border-top: 2px solid #e2e8f0; display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;">
                <button class="chart-btn chart-btn-secondary" onclick="document.getElementById('abcEditorModal').remove()" style="background: #ef4444; color: white; border: none;">
                    ❌ Cancel
                </button>
                <button class="chart-btn chart-btn-primary" onclick="previewABC()">
                    👁️ Preview Sheet Music
                </button>
                <button class="chart-btn chart-btn-primary" onclick="saveABCNotation(${sectionIndex})" style="background: #10b981;">
                    💾 Save & Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-preview after a short delay
    setTimeout(() => previewABC(), 500);
}

function previewABC() {
    const abc = document.getElementById('abcEditorTextarea').value;
    const container = document.getElementById('abcPreviewContainer');
    
    container.innerHTML = '<p style="color: #667eea; text-align: center;">Rendering...</p>';
    
    try {
        // Load abcjs library if not already loaded
        if (typeof ABCJS === 'undefined') {
            loadABCJS(() => renderABCPreview(abc, container));
        } else {
            renderABCPreview(abc, container);
        }
    } catch (error) {
        container.innerHTML = `<p style="color: #ef4444;">Error rendering: ${error.message}</p>`;
    }
}

function loadABCJS(callback) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/dist/abcjs-basic-min.js';
    script.onload = callback;
    script.onerror = () => {
        alert('Could not load sheet music renderer. Check your internet connection.');
    };
    document.head.appendChild(script);
}

async function renderABCPreview(abc, container) {
    container.innerHTML = '';
    
    // Load ABCjs audio CSS if not already loaded
    if (!document.getElementById('abcjs-audio-css')) {
        const cssLink = document.createElement('link');
        cssLink.id = 'abcjs-audio-css';
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/abcjs-audio.css';
        document.head.appendChild(cssLink);
    }
    
    try {
        // Create container for sheet music
        const sheetContainer = document.createElement('div');
        sheetContainer.id = 'abcSheetMusic';
        container.appendChild(sheetContainer);
        
        // Parse ABC to detect voices
        const voiceMatches = abc.match(/V:\d+\s+clef=treble\s+name="([^"]+)"/g) || [];
        const voices = voiceMatches.map((match, index) => {
            const nameMatch = match.match(/name="([^"]+)"/);
            return {
                index: index,
                name: nameMatch ? nameMatch[1] : `Voice ${index + 1}`
            };
        });
        
        // Render the sheet music with wrapping for long pieces
        const renderWidth = Math.max(container.offsetWidth - 40, 400);
        const visualObj = ABCJS.renderAbc(sheetContainer, abc, {
            responsive: 'resize',
            staffwidth: renderWidth,
            wrap: {
                minSpacing: 1.8,
                maxSpacing: 2.7,
                preferredMeasuresPerLine: 4
            },
            scale: 1.2,
            add_classes: true
        })[0];
        
        // Add voice selection if multiple voices
        let voiceControlsHTML = '';
        if (voices.length > 1) {
            voiceControlsHTML = `
                <div style="margin-bottom: 15px; padding: 12px; background: white; border-radius: 6px; border: 2px solid #e2e8f0;">
                    <strong style="color: #2d3748;">🎵 Select Parts to Play:</strong>
                    <div style="display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap;">
                        ${voices.map(voice => `
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                                <input type="checkbox" class="voice-checkbox" data-voice="${voice.index}" checked 
                                    style="width: 18px; height: 18px; cursor: pointer;">
                                <span style="color: #4b5563; font-weight: 500;">${voice.name}</span>
                            </label>
                        `).join('')}
                    </div>
                    <button onclick="updateVoiceSelection()" 
                        style="margin-top: 10px; background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                        🔄 Update Playback
                    </button>
                </div>
            `;
        }
        
        // Add playback controls
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = 'margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px;';
        controlsContainer.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: 600; color: #2d3748;">🎵 Playback Controls:</div>
            ${voiceControlsHTML}
            <div id="abcAudioControls"></div>
            <div id="abcAudioWarnings" style="margin-top: 10px; color: #f59e0b; font-size: 0.85em;"></div>
        `;
        container.appendChild(controlsContainer);
        
        // Store for voice selection updates
        window.currentVisualObj = visualObj;
        window.currentSynthControl = null;
        
        // Initialize synth for playback
        if (window.ABCJS && window.ABCJS.synth && visualObj) {
            try {
                // iOS FIX: Create AudioContext early via user gesture
                // We wrap synth init in a function triggered by first tap
                const initSynth = async () => {
                    try {
                        // Force-create and resume AudioContext (iOS requires user gesture)
                        if (window.AudioContext || window.webkitAudioContext) {
                            const AudioCtx = window.AudioContext || window.webkitAudioContext;
                            if (!window._deadceteraAudioCtx) {
                                window._deadceteraAudioCtx = new AudioCtx();
                            }
                            if (window._deadceteraAudioCtx.state === 'suspended') {
                                await window._deadceteraAudioCtx.resume();
                            }
                        }
                        
                        const synthControl = new ABCJS.synth.SynthController();
                        window.currentSynthControl = synthControl;
                        
                        synthControl.load('#abcAudioControls', null, {
                            displayLoop: true,
                            displayRestart: true,
                            displayPlay: true,
                            displayProgress: true,
                            displayWarp: true
                        });
                        
                        const selectedVoices = getSelectedVoices();
                        
                        await synthControl.setTune(visualObj, false, {
                            chordsOff: true,
                            voicesOff: selectedVoices.length > 0 ? 
                                voices.map((v, i) => !selectedVoices.includes(i)).reduce((acc, off, i) => {
                                    if (off) acc.push(i);
                                    return acc;
                                }, []) : []
                        });
                        
                        console.log('🔊 Audio ready for playback');
                        
                        // Resume AudioContext if still suspended
                        if (synthControl.audioContext && synthControl.audioContext.state === 'suspended') {
                            await synthControl.audioContext.resume();
                            console.log('🔊 AudioContext resumed');
                        }
                    } catch (error) {
                        console.warn('Audio setup failed:', error);
                        document.getElementById('abcAudioWarnings').textContent = 
                            '⚠️ Audio playback may not work in all browsers. The sheet music is still valid.';
                    }
                };
                
                // On iOS, we need user interaction first. Show a tap-to-play prompt.
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (isIOS) {
                    const tapPrompt = document.createElement('div');
                    tapPrompt.id = 'iosTapPrompt';
                    tapPrompt.style.cssText = 'padding: 15px; text-align: center; background: #fff7ed; border: 2px solid #f59e0b; border-radius: 8px; margin-bottom: 10px; cursor: pointer;';
                    tapPrompt.innerHTML = '<strong style="color: #92400e;">🔊 Tap here to enable audio playback</strong><br><span style="font-size: 0.85em; color: #78716c;">Required on iPhone/iPad</span>';
                    tapPrompt.addEventListener('click', async () => {
                        tapPrompt.innerHTML = '<span style="color: #667eea;">⏳ Loading audio...</span>';
                        await initSynth();
                        tapPrompt.remove();
                    });
                    document.getElementById('abcAudioControls').before(tapPrompt);
                    
                    // Still show the controls (they just won't work until tapped)
                    const synthControl = new ABCJS.synth.SynthController();
                    window.currentSynthControl = synthControl;
                    synthControl.load('#abcAudioControls', null, {
                        displayLoop: true,
                        displayRestart: true,
                        displayPlay: true,
                        displayProgress: true,
                        displayWarp: true
                    });
                    synthControl.setTune(visualObj, false, { chordsOff: true }).catch(() => {});
                } else {
                    // Non-iOS: init immediately
                    await initSynth();
                }
            } catch (error) {
                console.warn('Synth not available:', error);
                document.getElementById('abcAudioWarnings').textContent = 
                    '⚠️ Audio playback not available. You can still edit and save the notation.';
            }
        }
    } catch (error) {
        container.innerHTML = `
            <div style="color: #ef4444; padding: 20px;">
                <strong>Error rendering sheet music:</strong>
                <p>${error.message}</p>
                <p style="font-size: 0.9em; margin-top: 10px;">Check your ABC notation syntax.</p>
            </div>
        `;
    }
}

// Helper functions for voice selection
function getSelectedVoices() {
    const checkboxes = document.querySelectorAll('.voice-checkbox:checked');
    return Array.from(checkboxes).map(cb => parseInt(cb.dataset.voice));
}

function updateVoiceSelection() {
    // Get the textarea with ABC notation
    const textarea = document.getElementById('abcEditorTextarea');
    if (!textarea) {
        console.warn('No ABC textarea found');
        return;
    }
    
    try {
        const selectedVoices = getSelectedVoices();
        const abc = textarea.value;
        const lines = abc.split('\n');
        
        // Process each line to add/remove comments
        const newLines = lines.map(line => {
            // Check for voice definition: V:1 or V:2, etc.
            const voiceDefMatch = line.match(/^(% )?V:(\d+)/);
            // Check for voice content: [V:1] or [V:2], etc.
            const voiceContentMatch = line.match(/^(% )?\[V:(\d+)\]/);
            
            if (voiceDefMatch || voiceContentMatch) {
                const voiceNum = parseInt(voiceDefMatch ? voiceDefMatch[2] : voiceContentMatch[2]) - 1;
                const shouldMute = !selectedVoices.includes(voiceNum);
                const isCommented = line.trim().startsWith('%');
                
                if (shouldMute && !isCommented) {
                    // Mute: add % comment
                    return '% ' + line;
                } else if (!shouldMute && isCommented) {
                    // Unmute: remove % comment
                    return line.replace(/^% /, '');
                }
            }
            
            return line;
        });
        
        const newABC = newLines.join('\n');
        
        // Update textarea
        textarea.value = newABC;
        
        // Store for later use
        window.currentABCText = newABC;
        
        // Re-render preview
        const previewContainer = document.getElementById('abcPreviewContainer');
        if (previewContainer) {
            renderABCPreview(newABC, previewContainer);
        }
        
        console.log('🎵 Voice selection updated via ABC comments');
    } catch (error) {
        console.error('Error updating voice selection:', error);
    }
}

async function saveABCNotation(sectionIndex) {
    const abc = document.getElementById('abcEditorTextarea').value;
    const songTitle = selectedSong?.title || selectedSong;
    
    // Save to Google Drive (shared with all band members!)
    const key = `abc_section_${sectionIndex}`;
    await saveBandDataToDrive(songTitle, key, { abc, sectionIndex, updatedBy: currentUserEmail, updatedAt: new Date().toISOString() });
    
    // Also keep localStorage as fallback
    const localKey = `deadcetera_abc_${songTitle}_section${sectionIndex}`;
    localStorage.setItem(localKey, abc);
    
    showToast('✅ Sheet music saved — shared with band!');
    
    // Close modal
    const modal = document.getElementById('abcEditorModal');
    if (modal) modal.remove();
    
    // Refresh harmony display
    const bandData = bandKnowledgeBase[songTitle] || {};
    renderHarmoniesEnhanced(songTitle, bandData);
}


// ============================================================================
// ABC NOTATION IMPORT: PHOTO, MUSESCORE, AUDIO
// ============================================================================

// ── 1. PHOTO → ABC (Claude Vision) ──────────────────────────────────────────

async function openABCEditorForSection(songTitle, sectionIndex, sectionName) {
    // Load any existing ABC notation first
    const existing = await loadABCNotation(songTitle, sectionIndex);
    const bpm = await loadSongBpm(songTitle) || 120;
    const abc = existing || `X:1\nT:${sectionName}\nM:4/4\nQ:1/4=${bpm}\nL:1/8\nK:C\n`;
    showABCEditorModal(sectionName + ' — ' + songTitle, abc, sectionIndex);
}

async function importABCFromPhoto(sectionIndex) {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // mobile camera
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const status = document.getElementById('abcImportStatus');
        if (status) status.textContent = '📷 Reading sheet music...';
        
        try {
            if (status) status.textContent = '📷 Compressing image...';
            
            // Compress image using canvas — max 1600px, JPEG 85%
            const base64 = await new Promise((res, rej) => {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    const MAX = 1600;
                    let w = img.width, h = img.height;
                    if (w > MAX || h > MAX) {
                        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                        else { w = Math.round(w * MAX / h); h = MAX; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    URL.revokeObjectURL(url);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    res(dataUrl.split(',')[1]);
                };
                img.onerror = rej;
                img.src = url;
            });
            
            if (status) status.textContent = '🤖 Analyzing with AI...';
            
            const mediaType = 'image/jpeg';
            console.log('📷 Photo import: compressed base64 length =', base64.length);
            
            const response = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-opus-4-5',
                    max_tokens: 2000,
                    messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: { type: 'base64', media_type: (file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'), data: base64 }
                            },
                            {
                                type: 'text',
                                text: `Convert this sheet music to ABC notation. CRITICAL: Do NOT wrap in markdown backticks or code blocks. Output raw ABC text only.
Rules:
- Start your response with X:1 on the very first line, nothing before it
- Include X:1, T:, M:, L:, K: headers
- Include lyrics on w: lines if visible
- Use standard ABC note syntax: C D E F G A B for notes, lowercase for octave above middle C
- Use numbers for note lengths: C2 = half note, C4 = quarter note in L:1/8 context
- Include bar lines |
- If multiple voices/staves are shown, use V:1, V:2 etc
- Start directly with X:1

Sheet music image to convert:`
                            }
                        ]
                    }]
                })
            });
            
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const data = await response.json();
            let abc = data.content[0]?.text?.trim() || '';
            abc = abc.replace(/^```abc\n?/i, '').replace(/^```\n?/, '').replace(/```$/m, '').trim();
            
            if (abc && abc.includes('X:')) {
                const textarea = document.getElementById('abcEditorTextarea');
                if (textarea) {
                    textarea.value = abc;
                    previewABC();
                }
                if (status) status.textContent = '✅ Sheet music imported!';
            } else {
                throw new Error('No valid ABC notation in response');
            }
        } catch(e) {
            const status = document.getElementById('abcImportStatus');
            if (status) status.textContent = '❌ ' + (e.message.includes('CORS') ? 'API needs proxy setup' : e.message);
            console.error('Photo import error:', e);
        }
    };
    
    input.click();
}

// ── 2. MUSESCORE SEARCH ──────────────────────────────────────────────────────

async function importABCFromMuseScore(songTitle, sectionIndex) {
    const status = document.getElementById('abcImportStatus');
    
    // Show search modal
    const modal = document.createElement('div');
    modal.id = 'museScoreModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px';
    
    // Search MuseScore via their public API
    const query = encodeURIComponent(songTitle);
    const searchUrl = `https://api.musescore.com/services/rest/score.json?text=${query}&soundfont=0&part=0&parts=vocal&sort=view_count&order=desc&note=0`;
    
    modal.innerHTML = `
        <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="margin:0;color:white">🎼 MuseScore Search: ${songTitle}</h3>
                <button onclick="document.getElementById('museScoreModal').remove()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.3em">✕</button>
            </div>
            <p style="color:#9ca3af;font-size:0.85em;margin-bottom:16px">
                Search MuseScore for vocal arrangements. Click a result to open it — then use their 
                <strong style="color:white">Download → MusicXML</strong> option and use the 
                <strong style="color:#818cf8">📄 Import MusicXML</strong> button below.
            </p>
            <div id="museScoreResults" style="color:#9ca3af;text-align:center;padding:20px">
                🔍 Searching...
            </div>
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1)">
                <p style="color:#9ca3af;font-size:0.82em;margin-bottom:8px">Or paste MusicXML content directly:</p>
                <textarea id="musicXmlPaste" placeholder="Paste MusicXML here..." 
                    style="width:100%;height:80px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:white;font-size:0.8em;box-sizing:border-box"></textarea>
                <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                    <label style="background:#0369a1;color:white;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:0.82em;font-weight:600">
                        📄 Upload MusicXML File
                        <input type="file" accept=".xml,.mxl,.musicxml" style="display:none" onchange="handleMusicXmlUpload(event, ${sectionIndex})">
                    </label>
                    <button onclick="convertMusicXmlToABC(document.getElementById('musicXmlPaste').value, ${sectionIndex})"
                        style="background:#065f46;color:white;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:0.82em;font-weight:600">
                        🔄 Convert Pasted XML → ABC
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Try MuseScore search (public results page as fallback since API needs key)
    const resultsEl = document.getElementById('museScoreResults');
    const msSearchUrl = `https://musescore.com/sheetmusic?text=${query}&instrumentation=voice`;
    
    resultsEl.innerHTML = `
        <div style="text-align:left">
            <p style="color:#f1f5f9;margin-bottom:12px">MuseScore search results open in a new tab — look for arrangements with vocal parts:</p>
            <a href="${msSearchUrl}" target="_blank" 
               style="display:inline-block;background:#0369a1;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:12px">
                🔍 Search "${songTitle}" on MuseScore →
            </a>
            <p style="color:#9ca3af;font-size:0.82em">On MuseScore: find a score → click it → look for <strong style="color:white">Download → MusicXML</strong> (requires free account) → upload the .xml file here</p>
            <div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:12px;margin-top:8px;font-size:0.82em;color:#94a3b8">
                <strong style="color:#818cf8">💡 Best search tips:</strong><br>
                • Add "SATB" or "vocal" to find harmony arrangements<br>
                • Grateful Dead songs: search "grateful dead ${songTitle}"<br>
                • Look for scores with 4+ staves (usually has harmony parts)<br>
                • Filter by "Voice" instrumentation
            </div>
        </div>
    `;
}

async function handleMusicXmlUpload(event, sectionIndex) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    convertMusicXmlToABC(text, sectionIndex);
}

async function convertMusicXmlToABC(xmlText, sectionIndex) {
    if (!xmlText?.trim()) { alert('No XML content to convert'); return; }
    const status = document.getElementById('abcImportStatus');
    if (status) status.textContent = '🔄 Converting MusicXML...';
    
    // Close musescore modal if open
    document.getElementById('museScoreModal')?.remove();
    
    try {
        const response = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-haiku-4-5',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: `Convert this MusicXML to ABC notation. Extract ONLY the vocal parts (look for part names containing "Voice", "Vocal", "Soprano", "Alto", "Tenor", "Bass", or similar). If multiple vocal parts exist, include all as separate voices using V:1, V:2 etc with labels.

Output ONLY valid ABC notation starting with X:1. Include lyrics on w: lines.

MusicXML:
${xmlText.substring(0, 8000)}`
                }]
            })
        });
        
        if (!response.ok) throw new Error(`API ${response.status}`);
        const data = await response.json();
        const abc = data.content[0]?.text?.trim();
        
        if (abc?.includes('X:')) {
            const textarea = document.getElementById('abcEditorTextarea');
            if (textarea) { textarea.value = abc; previewABC(); }
            if (status) status.textContent = '✅ MusicXML converted!';
        } else {
            throw new Error('No valid ABC in response');
        }
    } catch(e) {
        if (status) status.textContent = '❌ ' + e.message;
    }
}

// ── 3. AUDIO → ABC (Basic Pitch by Spotify) ─────────────────────────────────

async function importABCFromAudio(sectionIndex) {
    const modal = document.createElement('div');
    modal.id = 'audioImportModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px';
    
    modal.innerHTML = `
        <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:560px;width:100%;max-height:85vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="margin:0;color:white">🎵 Import from Audio</h3>
                <button onclick="document.getElementById('audioImportModal').remove()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.3em">✕</button>
            </div>
            
            <div style="background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.2);border-radius:8px;padding:14px;margin-bottom:16px;font-size:0.85em;color:#c7d2fe;line-height:1.6">
                <strong style="color:white">How this works:</strong><br>
                1. Use <strong>Moises</strong> to isolate the vocal stem from a recording<br>
                2. Upload the isolated vocal audio file here<br>
                3. We send it to <strong>Basic Pitch</strong> (Spotify's free AI) to detect notes<br>
                4. The note data converts to ABC notation automatically
            </div>
            
            <div style="margin-bottom:16px">
                <label style="display:block;font-size:0.85em;color:#9ca3af;margin-bottom:8px">Upload isolated vocal audio (MP3, WAV, M4A):</label>
                <label style="display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,0.05);border:2px dashed rgba(255,255,255,0.15);border-radius:10px;padding:24px;cursor:pointer;color:#9ca3af;font-size:0.9em">
                    🎤 Click to select audio file
                    <input type="file" accept="audio/*" style="display:none" onchange="processAudioForABC(event, ${sectionIndex})">
                </label>
            </div>
            
            <div id="audioImportProgress" style="display:none;text-align:center;padding:16px;color:#818cf8"></div>
            
            <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:12px;font-size:0.8em;color:#6b7280;line-height:1.6">
                <strong style="color:#9ca3af">💡 Best results:</strong><br>
                • Use Moises or Spleeter to isolate vocals first — mixed audio gives messy results<br>
                • Short clips (one section, 8-16 bars) work better than full songs<br>
                • The AI detects the main pitch — harmony lines need separate passes<br>
                • Basic Pitch works best on clear, monophonic (single-note) vocal lines
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function processAudioForABC(event, sectionIndex) {
    const file = event.target.files[0];
    if (!file) return;
    
    const progress = document.getElementById('audioImportProgress');
    if (progress) { progress.style.display = 'block'; progress.textContent = '📤 Uploading to Basic Pitch...'; }
    
    try {
        // Basic Pitch API (Spotify's open source pitch detection)
        const formData = new FormData();
        formData.append('audio', file);
        
        const response = await fetch('https://basic-pitch.com/api/v1/predict', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error(`Basic Pitch API: ${response.status}`);
        const noteData = await response.json();
        
        if (progress) progress.textContent = '🎵 Converting notes to ABC...';
        
        // Convert Basic Pitch MIDI-like output to ABC
        const abc = convertBasicPitchToABC(noteData, file.name.replace(/\.[^.]+$/, ''));
        
        document.getElementById('audioImportModal')?.remove();
        const textarea = document.getElementById('abcEditorTextarea');
        if (textarea) { textarea.value = abc; previewABC(); }
        
        const status = document.getElementById('abcImportStatus');
        if (status) status.textContent = '✅ Audio converted to ABC!';
        
    } catch(e) {
        if (progress) {
            progress.innerHTML = `
                <div style="color:#ef4444;margin-bottom:8px">❌ ${e.message}</div>
                <div style="font-size:0.82em;color:#9ca3af">
                    Try the manual workflow:<br>
                    1. Upload your audio to <a href="https://basicpitch.spotify.com" target="_blank" style="color:#818cf8">basicpitch.spotify.com</a><br>
                    2. Download the MIDI file<br>
                    3. Convert MIDI→ABC at <a href="https://www.mandolintab.net/abcconverter.php" target="_blank" style="color:#818cf8">mandolintab.net/abcconverter</a><br>
                    4. Paste the ABC into the editor
                </div>
            `;
        }
    }
}

function convertBasicPitchToABC(noteData, title) {
    // Basic Pitch returns notes array: [{start_time, end_time, pitch, velocity}]
    const notes = noteData.notes || noteData.midi?.notes || [];
    if (!notes.length) return `X:1\nT:${title}\nM:4/4\nL:1/8\nK:C\n% No notes detected\n`;
    
    const MIDI_TO_ABC = ['C','C','D','D','E','F','F','G','G','A','A','B'];
    const noteToABC = (midi) => {
        const octave = Math.floor(midi / 12) - 1;
        const name = MIDI_TO_ABC[midi % 12];
        if (octave < 4) return name + ','.repeat(Math.max(0, 4 - octave));
        if (octave === 4) return name;
        if (octave === 5) return name.toLowerCase();
        return name.toLowerCase() + "'".repeat(octave - 5);
    };
    
    // Simple conversion: quarter note = 2 units at L:1/8
    let abc = `X:1\nT:${title}\nM:4/4\nL:1/8\nK:C\n`;
    let measure = '';
    let measureBeats = 0;
    
    notes.slice(0, 128).forEach(note => {
        const pitch = note.pitch || note.note;
        const dur = Math.max(1, Math.round((note.end_time - note.start_time) * 4));
        const abcNote = noteToABC(pitch) + (dur > 1 ? dur : '');
        measure += abcNote;
        measureBeats += dur;
        if (measureBeats >= 8) { abc += measure + '|'; measure = ''; measureBeats = 0; }
    });
    if (measure) abc += measure + '|';
    
    return abc + '\n% Review and clean up this auto-generated notation\n';
}


// ============================================================================
// FADR HARMONY AUTO-IMPORT
// ============================================================================

const FADR_PROXY = 'https://deadcetera-proxy.drewmerrill.workers.dev';

async function importHarmoniesFromFadr(songTitle) {
    const bandData = bandKnowledgeBase[songTitle] || {};
    const archiveLink = (bandData.links || []).find(l => l && l.url && l.url.includes('archive.org'));
    const defaultUrl = archiveLink?.url || '';
    const modal = document.createElement('div');
    modal.id = 'fadrImportModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
        <div style="background:#0f1a0f;border:1px solid rgba(5,150,105,0.4);border-radius:16px;padding:24px;max-width:580px;width:100%;max-height:90vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h3 style="margin:0;color:white">🎵 Auto-Import Harmonies via Fadr</h3>
                <button onclick="document.getElementById('fadrImportModal').remove()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.3em">✕</button>
            </div>
            <div style="background:rgba(5,150,105,0.1);border:1px solid rgba(5,150,105,0.25);border-radius:8px;padding:14px;margin-bottom:16px;font-size:0.85em;color:#6ee7b7;line-height:1.7">
                <strong style="color:white">How this works:</strong><br>
                1. Paste an Archive.org MP3 direct link<br>
                2. Fadr AI separates vocal stems<br>
                3. Each stem converts to MIDI → ABC notation<br>
                4. ABC is saved to each harmony section automatically<br>
                <span style="color:#9ca3af;font-size:0.9em">⏱ Takes 30–90 seconds</span>
            </div>
            <div style="margin-bottom:16px">
                <label style="display:block;font-size:0.85em;color:#9ca3af;margin-bottom:6px">Archive.org direct MP3 URL:</label>
                <input id="fadrArchiveUrl" type="url" placeholder="https://archive.org/download/identifier/song.mp3"
                    value="${defaultUrl}"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;color:white;font-size:0.9em;outline:none">
                <p style="color:#6b7280;font-size:0.78em;margin-top:6px">💡 On Archive.org, right-click an MP3 row → Copy Link Address</p>
            </div>
            <button onclick="runFadrImport('${songTitle.replace(/'/g, "\'")}')"
                style="width:100%;background:#059669;color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:0.95em;font-weight:700;margin-bottom:12px">
                🚀 Start Auto-Import
            </button>
            <div id="fadrProgress" style="display:none;background:rgba(0,0,0,0.3);border-radius:8px;padding:16px">
                <div id="fadrProgressText" style="color:#6ee7b7;font-size:0.9em;margin-bottom:10px">Initializing...</div>
                <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:6px;overflow:hidden">
                    <div id="fadrProgressBar" style="background:#059669;height:100%;width:0%;transition:width 0.5s ease"></div>
                </div>
                <div id="fadrProgressDetail" style="color:#6b7280;font-size:0.78em;margin-top:8px"></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function runFadrImport(songTitle) {
    const audioUrl = document.getElementById('fadrArchiveUrl')?.value?.trim();
    if (!audioUrl || !audioUrl.includes('archive.org')) { alert('Please enter a valid Archive.org MP3 URL'); return; }
    const progressEl = document.getElementById('fadrProgress');
    const progressText = document.getElementById('fadrProgressText');
    const progressBar = document.getElementById('fadrProgressBar');
    const progressDetail = document.getElementById('fadrProgressDetail');
    const setProgress = (msg, pct, detail = '') => {
        if (progressEl) progressEl.style.display = 'block';
        if (progressText) progressText.textContent = msg;
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressDetail) progressDetail.textContent = detail;
    };
    const startBtn = document.querySelector('#fadrImportModal button[onclick*="runFadrImport"]');
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = '⏳ Processing...'; }
    try {
        setProgress('📥 Fetching audio from Archive.org...', 5, audioUrl);
        const archiveResp = await fetch(`${FADR_PROXY}/archive-fetch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioUrl }) });
        if (!archiveResp.ok) { const err = await archiveResp.json().catch(() => ({})); throw new Error(`Archive fetch failed: ${err.error || archiveResp.status}`); }
        const audioBuffer = await archiveResp.arrayBuffer();
        setProgress('✅ Audio downloaded', 15, `${(audioBuffer.byteLength/1024/1024).toFixed(1)} MB`);

        setProgress('📤 Getting Fadr upload URL...', 20);
        const filename = audioUrl.split('/').pop() || 'song.mp3';
        const ext = filename.split('.').pop().toLowerCase() || 'mp3';
        const uploadUrlResp = await fetch(`${FADR_PROXY}/fadr/assets/upload2`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: filename, extension: ext }) });
        if (!uploadUrlResp.ok) throw new Error(`Fadr upload URL failed: ${uploadUrlResp.status}`);
        const { url: presignedUrl, s3Path } = await uploadUrlResp.json();

        setProgress('📤 Uploading to Fadr...', 25);
        const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4';
        const putResp = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: audioBuffer });
        if (!putResp.ok) throw new Error(`S3 upload failed: ${putResp.status}`);

        setProgress('🗄️ Creating Fadr asset...', 40);
        const assetResp = await fetch(`${FADR_PROXY}/fadr/assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: filename, path: s3Path, extension: ext }) });
        if (!assetResp.ok) throw new Error(`Fadr create asset failed: ${assetResp.status}`);
        const asset = await assetResp.json();
        const assetId = asset._id;

        setProgress('🤖 Starting stem separation...', 50, 'AI is separating vocal parts...');
        const taskResp = await fetch(`${FADR_PROXY}/fadr/assets/stems`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: assetId }) });
        if (!taskResp.ok) throw new Error(`Fadr stem task failed: ${taskResp.status}`);

        for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise(r => setTimeout(r, 5000));
            const pollResp = await fetch(`${FADR_PROXY}/fadr/assets/${assetId}`);
            if (!pollResp.ok) continue;
            const assetData = await pollResp.json();
            setProgress(`⏳ Processing... (${attempt*5}s)`, 55 + Math.min(attempt*0.7, 20), `Status: ${assetData.status || 'processing'}`);
            if (assetData.status === 'done' || (assetData.stems && assetData.stems.length > 0)) {
                const midiAssets = assetData.midi || [];
                const vocalMidi = midiAssets.filter(m => m.name && m.name.toLowerCase().includes('vocal'));
                const midiIds = vocalMidi.length > 0 ? vocalMidi.map(m => m._id) : midiAssets.slice(0,2).map(m => m._id);
                if (!midiIds.length) throw new Error('No MIDI files in Fadr output');
                const abcParts = [];
                for (let i = 0; i < midiIds.length; i++) {
                    setProgress(`🎼 Converting part ${i+1}/${midiIds.length}...`, 80 + i*5);
                    const dlResp = await fetch(`${FADR_PROXY}/fadr/assets/${midiIds[i]}/download`);
                    if (!dlResp.ok) continue;
                    const { url: dlUrl } = await dlResp.json();
                    const midiResp = await fetch(dlUrl);
                    if (!midiResp.ok) continue;
                    const midiBuffer = await midiResp.arrayBuffer();
                    const abcResp = await fetch(`${FADR_PROXY}/midi2abc`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: midiBuffer });
                    if (!abcResp.ok) continue;
                    const { abc } = await abcResp.json();
                    abcParts.push({ label: i === 0 ? 'Lead Vocals' : `Harmony ${i}`, abc });
                }
                if (!abcParts.length) throw new Error('MIDI→ABC conversion failed');
                const songKey = assetData.key || 'C';
                const songBpm = assetData.tempo || assetData.bpm || 120;
                await saveBandDataToDrive(songTitle, 'song_bpm', { bpm: Math.round(songBpm) });
                await saveBandDataToDrive(songTitle, 'song_key', { key: songKey });
                let combinedAbc = `X:1
T:${songTitle} (Fadr)
M:4/4
Q:1/4=${Math.round(songBpm)}
L:1/8
K:${songKey}
`;
                combinedAbc += abcParts.length === 1 ? abcParts[0].abc.split('\n').filter(l => !l.match(/^[XTMQLK]:/)).join('\n') : abcParts.map((p,i) => `V:${i+1} name="${p.label}"`).join('\n') + '\n' + abcParts.map((p,i) => `[V:${i+1}]\n${p.abc.split('\n').filter(l => !l.match(/^[XTMQLK]:/)).join('\n')}`).join('\n');
                await saveBandDataToDrive(songTitle, BAND_DATA_TYPES.HAS_HARMONIES, { value: true });
                const existingH = await loadBandDataFromDrive(songTitle, 'harmonies_data');
                if (!existingH || !existingH.sections || toArray(existingH.sections).length === 0) {
                    await saveBandDataToDrive(songTitle, 'harmonies_data', { sections: [{ name: 'Full Song', lyric: `Auto-imported via Fadr • Key: ${songKey} • ${Math.round(songBpm)} BPM`, parts: abcParts.map((p,i) => ({ singer: ['Drew','Chris','Brian'][i] || 'Drew', part: i === 0 ? 'lead' : 'harmony', notes: p.label })), practiceNotes: [`Detected key: ${songKey} • BPM: ${Math.round(songBpm)}`, `Auto-imported from Fadr on ${new Date().toLocaleDateString()}`] }] });
                }
                setProgress('🎉 Import complete!', 100, `${abcParts.length} vocal part(s) • Key: ${songKey} • ${Math.round(songBpm)} BPM`);
                if (progressText) { progressText.style.color = '#34d399'; progressText.innerHTML = `🎉 <strong>Import complete!</strong> ${abcParts.length} vocal part(s) imported.`; }
                if (startBtn) { startBtn.textContent = '✅ Done — Close & View'; startBtn.disabled = false; startBtn.style.background = '#047857'; startBtn.onclick = () => { document.getElementById('fadrImportModal')?.remove(); renderHarmoniesEnhanced(songTitle, bandKnowledgeBase[songTitle] || {}); }; }
                return;
            }
            if (assetData.status === 'failed') throw new Error('Fadr stem separation failed');
        }
        throw new Error('Fadr timed out after 5 minutes');
    } catch(err) {
        console.error('Fadr import error:', err);
        if (progressText) { progressText.style.color = '#ef4444'; progressText.textContent = `❌ Import failed: ${err.message}`; }
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = '🔄 Try Again'; }
    }
}

async function loadABCNotation(songTitle, sectionIndex) {
    // Try Google Drive first
    const key = `abc_section_${sectionIndex}`;
    const driveData = await loadBandDataFromDrive(songTitle, key);
    if (driveData && driveData.abc) {
        let abc = driveData.abc.trim();
        abc = abc.replace(/^```abc\n?/i, '').replace(/^```\n?/m, '').replace(/```$/m, '').trim();
        return abc;
    }
    
    // Fall back to localStorage
    const localKey = `deadcetera_abc_${songTitle}_section${sectionIndex}`;
    return localStorage.getItem(localKey);
}

// Update the original generateSheetMusic to use the enhanced version
function generateSheetMusic(sectionIndex, section) {
    generateSheetMusicEnhanced(sectionIndex, section);
}
// ============================================================================
// ============================================================================
// FIREBASE INTEGRATION - Real-time database for all band data
// Replaces Google Drive for reliable cross-browser data sharing
// ============================================================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC3sMU2S8XT9AhA4w5vTwtPP1Nx5kOHOJo",
    authDomain: "deadcetera-35424.firebaseapp.com",
    databaseURL: "https://deadcetera-35424-default-rtdb.firebaseio.com",
    projectId: "deadcetera-35424",
    storageBucket: "deadcetera-35424.firebasestorage.app",
    messagingSenderId: "218400123401",
    appId: "1:218400123401:web:7f64ad84231dcaba6966d8"
};

// Keep Google config for sign-in identity only (email/profile, no Drive access needed)
const GOOGLE_DRIVE_CONFIG = {
    apiKey: 'AIzaSyC3sMU2S8XT9AhA4w5vTwtPP1Nx5kOHOJo',
    clientId: '177899334738-6rcrst4nccsdol4g5t12923ne4duruub.apps.googleusercontent.com',
    scope: 'email profile'
};

let isGoogleDriveInitialized = false; // Keep name for compatibility - means "backend ready"
let isUserSignedIn = false;
let accessToken = null;
let tokenClient = null;
let currentUserEmail = localStorage.getItem('deadcetera_google_email') || null;
// ^ Pre-populated from last session so Profile shows email before auth re-fires

// Firebase references (set during init)
let firebaseDB = null;
let firebaseStorage = null;

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

// ── Sign-in nudge banner — shown once per session when unsaved data risk ────
let signInNudgeShown = false;
function showSignInNudge() {
    if (signInNudgeShown || isUserSignedIn) return;
    signInNudgeShown = true;
    
    // Don't stack with existing nudge
    if (document.getElementById('signInNudgeBanner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'signInNudgeBanner';
    banner.style.cssText = `
        position: fixed; bottom: 76px; left: 12px; right: 12px;
        background: linear-gradient(135deg, #1e2a4a, #2d1f4e);
        border: 1px solid rgba(245,158,11,0.5);
        border-radius: 14px; padding: 14px 16px;
        display: flex; align-items: center; gap: 12px;
        z-index: 8500; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: slideUpBanner 0.3s ease-out;
    `;
    banner.innerHTML = `
        <span style="font-size:1.6em;flex-shrink:0">⚠️</span>
        <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:0.9em;color:#fbbf24">Sign in to share with the band</div>
            <div style="font-size:0.75em;color:#94a3b8;margin-top:2px">Your changes are saved on this device only until you sign in</div>
        </div>
        <button onclick="handleGoogleDriveAuth();document.getElementById('signInNudgeBanner')?.remove()" style="
            background:#f59e0b;color:#1a1a1a;border:none;border-radius:8px;
            padding:8px 14px;font-weight:700;font-size:0.82em;cursor:pointer;
            flex-shrink:0;white-space:nowrap">
            Sign In
        </button>
        <button onclick="document.getElementById('signInNudgeBanner')?.remove()" style="
            background:none;border:none;color:#64748b;cursor:pointer;
            font-size:1.2em;padding:4px;flex-shrink:0;line-height:1">✕</button>
    `;
    document.body.appendChild(banner);
    // Auto-dismiss after 12 seconds
    setTimeout(() => banner?.remove(), 12000);
}

// ── Lightweight Firebase-only init (no Google Identity) ─────────────────────
// Called automatically on page load so firebaseDB is ready immediately.
// loadGoogleDriveAPI() (full init including Google Identity) is called on 
// first "Connect" click and handles sign-in + email attribution.
async function initFirebaseOnly() {
    if (firebaseDB) return; // Already initialized
    
    const loadScript = (src) => new Promise((res, rej) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
    });

    // Load Firebase app compat then database compat
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js');
    
    if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
    }
    firebaseDB = firebase.database();
    
    // Also try storage
    try {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js');
        if (firebase.storage) firebaseStorage = firebase.storage();
    } catch(e) { /* storage optional */ }

    console.log('🔥 Firebase DB ready (auto-init)');
}

function loadGoogleDriveAPI() {
    // Now loads Firebase SDK + Google Identity Services for sign-in
    return new Promise((resolve, reject) => {
        console.log('🔥 Loading Firebase + Google Identity...');
        
        const loadScript = (src) => new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });

        const loadGIS = new Promise((res, rej) => {
            if (window.google?.accounts?.oauth2) { res(); return; }
            loadScript('https://accounts.google.com/gsi/client').then(res).catch(rej);
        });

        // CRITICAL: firebase-app-compat MUST fully execute before database/storage load
        // Do NOT create DB/Storage script elements until after app-compat onload fires
        const firebaseAppReady = window.firebase?.apps !== undefined
            ? Promise.resolve()
            : loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');

        firebaseAppReady
            .then(() => Promise.all([
                loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'),
                loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js'),
                loadGIS
            ]))
            .then(() => {
                console.log('✅ Firebase + Google scripts loaded');
                initFirebase().then(resolve).catch(reject);
            })
            .catch(reject);
    });
}

async function initFirebase() {
    try {
        console.log('⚙️ Initializing Firebase...');
        
        // Initialize Firebase app if not already done (may have been done by initFirebaseOnly)
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        
        // Re-use existing firebaseDB if already set by initFirebaseOnly
        if (!firebaseDB) {
            firebaseDB = firebase.database();
        }
        
        // Firebase Storage is optional - we primarily use RTDB for audio (base64)
        try {
            if (firebase.storage && !firebaseStorage) {
                firebaseStorage = firebase.storage();
            }
        } catch(e) {
            console.log('⚠️ Firebase Storage not available (not critical - using RTDB for audio)');
        }
        
        console.log('✅ Firebase initialized');
        
        // Initialize Google Identity Services for sign-in (identity only, no Drive)
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_DRIVE_CONFIG.clientId,
            scope: GOOGLE_DRIVE_CONFIG.scope,
            callback: async (response) => {
                if (response.error) {
                    console.error('Token error:', response);
                    updateSignInStatus(false);
                    return;
                }
                accessToken = response.access_token;
                updateSignInStatus(true);
                console.log('✅ User signed in');
                
                // Get user email from Google
                await getCurrentUserEmail();
                
                // No shared folder init needed - Firebase is always ready!
                console.log('🔥 Firebase ready - no folder sharing needed!');
            }
        });
        
        isGoogleDriveInitialized = true;
        console.log('✅ Backend initialized (Firebase + Google Identity)');
        
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        throw error;
    }
}

function updateSignInStatus(signedIn) {
    isUserSignedIn = signedIn;
    updateDriveAuthButton();
}

async function getCurrentUserEmail() {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + accessToken }
        });
        const userInfo = await response.json();
        currentUserEmail = userInfo.email;
        console.log('👤 Signed in as:', currentUserEmail);
        // Persist email to localStorage so Profile page can show it immediately on reload
        localStorage.setItem('deadcetera_google_email', currentUserEmail);
        // Sign-in is critical — save immediately, don't wait for debounce
        logActivity('sign_in').then(() => {
            if (activityLogCache) {
                saveMasterFile(MASTER_ACTIVITY_LOG, activityLogCache).catch(() => {});
                activityLogDirty = false;
            }
        });
        injectAdminButton();
        // Re-update button now that we have the email
        updateDriveAuthButton();
        // Migrate any localStorage-only data to Firebase (recovers data saved before Firebase was ready)
        recoverLocalStorageToFirebase();
    } catch (error) {
        console.error('Could not get user email:', error);
        currentUserEmail = 'unknown';
    }
}

// Scan localStorage for any Deadcetera data saved before Firebase was initialized.
// Pushes to Firebase so it's shared with the band. Runs silently on each sign-in.
async function recoverLocalStorageToFirebase() {
    if (!firebaseDB) return;
    let recovered = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('deadcetera_')) continue;
        // Key format: deadcetera_{dataType}_{songTitle}
        // Extract parts — dataType is the second segment, songTitle is the rest
        const withoutPrefix = key.replace('deadcetera_', '');
        // Known dataTypes used in saveBandDataToDrive
        const dataTypes = ['spotify_versions','song_status','song_metadata','song_structure',
                          'practice_tracks','rehearsal_notes','gig_notes','moises_stems',
                          'harmony_metadata','part_notes','custom_songs','calendar_events',
                          'blocked_dates','gig_history','setlists','equipment','contacts',
                          'playlists','finances','social_profiles'];
        let matchedType = null, matchedSong = null;
        for (const dt of dataTypes) {
            if (withoutPrefix.startsWith(dt + '_')) {
                matchedType = dt;
                matchedSong = withoutPrefix.slice(dt.length + 1);
                break;
            }
        }
        if (!matchedType || !matchedSong) continue;
        try {
            // Check if Firebase already has this data
            const path = songPath(matchedSong, matchedType);
            const snap = await firebaseDB.ref(path).once('value');
            if (snap.val() !== null) continue; // Firebase already has it — skip
            // Push to Firebase
            const data = JSON.parse(localStorage.getItem(key));
            if (!data || (Array.isArray(data) && data.length === 0)) continue;
            await firebaseDB.ref(path).set(data);
            recovered++;
            console.log(`🔄 Recovered ${matchedType} for "${matchedSong}" from localStorage to Firebase`);
        } catch(e) { /* skip errors on individual keys */ }
    }
    if (recovered > 0) {
        showToast(`✅ Synced ${recovered} data item(s) from this device to Firebase`);
    }
}

function updateDriveAuthButton() {
    const button = document.getElementById('googleDriveAuthBtn');
    if (!button) return;
    
    if (isUserSignedIn) {
        button.innerHTML = '<span style="color:#065f46;font-size:1.1em">●</span><span class="conn-label"> Connected</span>';
        button.className = 'topbar-btn connected';
        button.style.cssText = 'background:#d1fae5!important;color:#065f46!important;border:2px solid #10b981!important;font-weight:700!important;padding:6px 10px!important;border-radius:8px!important;white-space:nowrap!important;';
        // Update the hero Sign In button to show Sign Out
        const heroBtn = document.getElementById('googleDriveAuthBtn2');
        if (heroBtn) {
            heroBtn.innerHTML = '👋 Sign Out';
            heroBtn.style.background = '#64748b';
        }
        const heroCaption = document.querySelector('#signInPrompt p');
        if (heroCaption) heroCaption.textContent = 'Signed in as ' + (currentUserEmail || '');
    } else {
        button.textContent = '👤 Sign In';
        button.className = 'topbar-btn';
        button.style.cssText = 'background:#667eea;color:#fff;border-color:#667eea;';
        const heroBtn = document.getElementById('googleDriveAuthBtn2');
        if (heroBtn) {
            heroBtn.innerHTML = '👤 Sign In';
            heroBtn.style.background = 'var(--accent)';
        }
        const heroCaption = document.querySelector('#signInPrompt p');
        if (heroCaption) heroCaption.textContent = 'Sign in to sync with your bandmates';
    }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function handleGoogleDriveAuth() {
    if (!isGoogleDriveInitialized) {
        try {
            console.log('🔥 Loading Firebase...');
            await loadGoogleDriveAPI();
        } catch (error) {
            console.error('Failed to load Firebase:', error);
            alert('Failed to initialize.\n\nError: ' + error.message);
            return;
        }
    }
    
    if (isUserSignedIn) {
        // Sign out
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('👋 User signed out');
            accessToken = null;
            currentUserEmail = null;
            localStorage.removeItem('deadcetera_google_email');
            updateSignInStatus(false);
        });
    } else {
        // Sign in
        try {
            console.log('🔑 Requesting sign-in...');
            tokenClient.requestAccessToken({ prompt: '' });
        } catch (error) {
            console.error('Sign-in failed:', error);
            alert('Sign-in failed.\n\nError: ' + error.message);
        }
    }
}

// ============================================================================
// FIREBASE PATH HELPERS
// ============================================================================

function sanitizeFirebasePath(str) {
    // Firebase paths cannot contain . # $ [ ] /
    return str.replace(/[.#$\[\]\/]/g, '_');
}

// Firebase converts arrays to objects with numeric keys - this normalizes them back
function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') return Object.values(val);
    return [];
}

function songPath(songTitle, dataType) {
    return `songs/${sanitizeFirebasePath(songTitle)}/${sanitizeFirebasePath(dataType)}`;
}

function masterPath(fileName) {
    // Remove file extension for cleaner paths
    const name = fileName.replace('.json', '');
    return `master/${sanitizeFirebasePath(name)}`;
}

// ============================================================================
// UPLOAD AUDIO TO FIREBASE STORAGE
async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

console.log('🔥 Firebase integration loaded');

// ============================================================================
// EDITABLE HARMONY PART NOTES
// ============================================================================
// ============================================================================
// EDITABLE HARMONY PART NOTES
// ============================================================================

async function loadPartNotes(songTitle, sectionIndex, singer) {
    const key = `part_notes_${sectionIndex}_${singer}`;
    const data = await loadBandDataFromDrive(songTitle, key);
    return Array.isArray(data) ? data : (data ? [data] : []);
}

async function savePartNotes(songTitle, sectionIndex, singer, notes) {
    const key = `part_notes_${sectionIndex}_${singer}`;
    await saveBandDataToDrive(songTitle, key, notes);
    logActivity('part_notes', { song: songTitle, extra: singer });
}

async function addPartNote(songTitle, sectionIndex, singer) {
    const formId = `addPartNoteForm_${sectionIndex}_${singer}`;
    if (document.getElementById(formId)) return;
    const addBtn = document.querySelector(`[onclick*="addPartNote"][onclick*="${sectionIndex}"][onclick*="${singer}"]`);
    if (!addBtn) return;
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap';
    form.innerHTML = `
        <input id="partNoteInput_${sectionIndex}_${singer}" class="app-input"
            placeholder="Practice note for ${singer}..."
            style="flex:1;min-width:180px" autocomplete="off">
        <button onclick="savePartNote('${songTitle}',${sectionIndex},'${singer}')" class="btn btn-primary btn-sm">Save</button>
        <button onclick="document.getElementById('${formId}')?.remove()" class="btn btn-ghost btn-sm">✕</button>
    `;
    addBtn.after(form);
    document.getElementById(`partNoteInput_${sectionIndex}_${singer}`)?.focus();
}

async function savePartNote(songTitle, sectionIndex, singer) {
    const note = document.getElementById(`partNoteInput_${sectionIndex}_${singer}`)?.value?.trim();
    if (!note) return;
    const notes = await loadPartNotes(songTitle, sectionIndex, singer);
    notes.push(note);
    await savePartNotes(songTitle, sectionIndex, singer, notes);
    document.getElementById(`addPartNoteForm_${sectionIndex}_${singer}`)?.remove();
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) renderHarmoniesEnhanced(songTitle, bandData);
}

async function editPartNote(songTitle, sectionIndex, singer, noteIndex) {
    const formId = `editPartNoteForm_${sectionIndex}_${singer}_${noteIndex}`;
    if (document.getElementById(formId)) return;
    const notes = await loadPartNotes(songTitle, sectionIndex, singer);
    const currentNote = notes[noteIndex] || '';
    const editBtn = document.querySelector(`[onclick*="editPartNote"][onclick*="${sectionIndex}"][onclick*="${singer}"][onclick*="${noteIndex}"]`);
    const noteEl = editBtn?.closest('[data-note-index], .note-item, div') || editBtn?.parentElement;
    if (!noteEl) return;
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap';
    form.innerHTML = `
        <input id="editPartNoteInput_${sectionIndex}_${singer}_${noteIndex}" class="app-input"
            value="${currentNote.replace(/"/g, '&quot;')}" 
            style="flex:1;min-width:180px" autocomplete="off">
        <button onclick="saveEditedPartNote('${songTitle}',${sectionIndex},'${singer}',${noteIndex})" class="btn btn-primary btn-sm">Save</button>
        <button onclick="deletePartNote('${songTitle}',${sectionIndex},'${singer}',${noteIndex})" class="btn btn-sm" style="background:#ef4444;color:white;border:none;border-radius:6px;padding:5px 8px;cursor:pointer">Delete</button>
        <button onclick="document.getElementById('${formId}')?.remove()" class="btn btn-ghost btn-sm">✕</button>
    `;
    noteEl.after(form);
    document.getElementById(`editPartNoteInput_${sectionIndex}_${singer}_${noteIndex}`)?.select();
}

async function saveEditedPartNote(songTitle, sectionIndex, singer, noteIndex) {
    const newNote = document.getElementById(`editPartNoteInput_${sectionIndex}_${singer}_${noteIndex}`)?.value?.trim();
    if (newNote === undefined) return;
    if (!newNote) { await deletePartNote(songTitle, sectionIndex, singer, noteIndex); return; }
    const notes = await loadPartNotes(songTitle, sectionIndex, singer);
    notes[noteIndex] = newNote;
    await savePartNotes(songTitle, sectionIndex, singer, notes);
    document.getElementById(`editPartNoteForm_${sectionIndex}_${singer}_${noteIndex}`)?.remove();
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) renderHarmoniesEnhanced(songTitle, bandData);
}

async function deletePartNote(songTitle, sectionIndex, singer, noteIndex) {
    if (!confirm('Delete this note?')) return;
    
    const notes = await loadPartNotes(songTitle, sectionIndex, singer);
    notes.splice(noteIndex, 1);
    await savePartNotes(songTitle, sectionIndex, singer, notes);
    
    // Refresh display
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData) {
        renderHarmoniesEnhanced(songTitle, bandData);
    }
}

// ============================================================================
// LEAD SINGER & HARMONY METADATA
// ============================================================================

async function updateLeadSinger(singer) {
    if (!selectedSong || !selectedSong.title) return;
    if (!isUserSignedIn) showSignInNudge();
    await saveBandDataToDrive(selectedSong.title, 'lead_singer', { singer });
    console.log(`🎤 Lead singer updated: ${singer} - saved to Google Drive!`);
}

async function loadLeadSinger(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'lead_singer');
    return data ? data.singer : '';
}

// ============================================================================
// GENIUS LYRICS FETCHER
// ============================================================================

function getGeniusApiKey() {
    return localStorage.getItem('deadcetera_genius_key') || '4doT-zIl3i_5lLprnoL2y-yfEDMqCsZ8DgzKKYne6dLgIlRcKgb4oEtFRux_cFFL';
}

function saveGeniusApiKey(key) {
    localStorage.setItem('deadcetera_genius_key', key.trim());
}

function toggleGeniusKeyRow() {
    const row = document.getElementById('geniusKeyRow');
    if (!row) return;
    const isHidden = row.style.display === 'none' || row.style.display === '';
    row.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
        const input = document.getElementById('geniusApiKeyInput');
        if (input) { input.value = getGeniusApiKey(); input.focus(); }
    }
}

function saveAndHideGeniusKey() {
    const input = document.getElementById('geniusApiKeyInput');
    if (input) saveGeniusApiKey(input.value);
    const row = document.getElementById('geniusKeyRow');
    if (row) row.style.display = 'none';
}

async function fetchLyricsFromGenius(songTitle, artistName) {
    const apiKey = getGeniusApiKey();
    if (!apiKey) {
        alert('Please enter your Genius API key first. Get one free at genius.com/api-clients');
        return null;
    }

    // Show status
    const statusEl = document.getElementById('lyricsStatus');
    if (statusEl) { statusEl.textContent = '🔍 Searching Genius...'; statusEl.style.display = 'block'; }

    try {
        // Search Genius — include artist name for accuracy
        const query = artistName ? `${artistName} ${songTitle}` : songTitle;
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}&access_token=${apiKey}`;
        // Genius API doesn't allow direct browser calls — use a CORS proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
        const searchRes = await fetch(proxyUrl);
        const searchJson = await searchRes.json();
        const searchData = JSON.parse(searchJson.contents);

        if (!searchData.response?.hits?.length) {
            if (statusEl) statusEl.textContent = '❌ No results found on Genius.';
            return null;
        }

        // Pick the best hit — prefer exact artist match
        const hits = searchData.response.hits;
        const artistLower = (artistName || '').toLowerCase();
        let best = artistName
            ? hits.find(h => h.result.primary_artist.name.toLowerCase().includes(artistLower))
              || hits.find(h => h.result.full_title.toLowerCase().includes(artistLower))
              || hits[0]
            : hits[0];

        const songUrl = best.result.url;
        const songName = best.result.full_title;
        if (statusEl) statusEl.textContent = `📄 Found: ${songName} — fetching lyrics...`;

        // Fetch the Genius page through proxy and parse lyrics
        const pageProxy = `https://api.allorigins.win/get?url=${encodeURIComponent(songUrl)}`;
        const pageRes = await fetch(pageProxy);
        const pageJson = await pageRes.json();
        const html = pageJson.contents;

        // Parse lyrics from the HTML — Genius uses data-lyrics-container divs
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Try modern containers first
        let lyricsContainers = doc.querySelectorAll('[data-lyrics-container="true"]');
        let rawText = '';

        if (lyricsContainers.length > 0) {
            rawText = Array.from(lyricsContainers).map(el => {
                // Replace <br> tags with newlines
                el.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                // Replace section headers like <h2> with [Section]
                el.querySelectorAll('h2').forEach(h => {
                    h.replaceWith('\n[' + h.textContent.trim() + ']\n');
                });
                return el.textContent;
            }).join('\n');
        } else {
            // Fallback: look for .lyrics class or Lyrics__Container
            const fallback = doc.querySelector('.lyrics') || doc.querySelector('.Lyrics__Container-sc-1ynbvzw-1');
            if (fallback) {
                fallback.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                rawText = fallback.textContent;
            }
        }

        if (!rawText.trim()) {
            if (statusEl) statusEl.textContent = '⚠️ Found song but couldn\'t extract lyrics. Try pasting manually.';
            return null;
        }

        // Clean up the text
        const lyrics = rawText
            .replace(/\[([^\]]+)\]/g, '\n[$1]\n')  // ensure section headers on own lines
            .replace(/\n{3,}/g, '\n\n')               // max 2 consecutive newlines
            .replace(/^\n+/, '')                         // strip leading newlines
            .trim();

        if (statusEl) statusEl.textContent = `✅ Lyrics loaded from Genius!`;
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);

        return { lyrics, songName };

    } catch (err) {
        console.error('Genius fetch error:', err);
        if (statusEl) statusEl.textContent = '❌ Error: ' + err.message;
        return null;
    }
}

// Parse section names from lyrics text and auto-check the checkboxes
function parseSectionsFromLyrics(lyricsText) {
    const sectionPattern = /\[([^\]]+)\]/g;
    const found = new Set();
    let match;
    while ((match = sectionPattern.exec(lyricsText)) !== null) {
        const raw = match[1].trim();
        // Normalize: "Verse 1", "VERSE 1" → "Verse 1"
        const normalized = raw.replace(/^(verse|chorus|bridge|outro|intro|pre-chorus|refrain|hook|coda|tag|interlude|solo)(\s*\d*)/i,
            (_, name, num) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() + (num ? ' ' + num.trim() : '')
        );
        found.add(normalized || raw);
    }
    return Array.from(found);
}

async function harmonyFetchLyrics(songTitle) {
    // Get the band name for this song to improve search accuracy
    const songData = allSongs ? allSongs.find(s => s.title === songTitle) : null;
    const bandAbbr = songData?.band || (selectedSong?.band) || 'GD';
    const artistName = getFullBandName(bandAbbr);
    const result = await fetchLyricsFromGenius(songTitle, artistName);
    if (!result) return;

    // Populate textarea
    const textarea = document.getElementById('harmLyrics');
    if (textarea) textarea.value = result.lyrics;

    // Parse sections and auto-check matching boxes
    const sections = parseSectionsFromLyrics(result.lyrics);
    const checkboxes = document.querySelectorAll('.harmSectionCheck');

    // Uncheck all first
    checkboxes.forEach(cb => cb.checked = false);

    // Check any that match found sections
    sections.forEach(sectionName => {
        checkboxes.forEach(cb => {
            if (cb.value.toLowerCase() === sectionName.toLowerCase()) {
                cb.checked = true;
            }
        });
    });

    // Add custom section checkboxes for any we don\'t already have
    const existingValues = Array.from(checkboxes).map(cb => cb.value.toLowerCase());
    sections.forEach(sectionName => {
        if (!existingValues.includes(sectionName.toLowerCase())) {
            const container = document.getElementById('harmSectionTags');
            if (container) {
                container.insertAdjacentHTML('beforeend', `
                    <label style="display:flex;align-items:center;gap:5px;padding:6px 10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;cursor:pointer;font-size:0.82em;color:var(--green,#10b981)">
                        <input type="checkbox" class="harmSectionCheck" value="${sectionName}" checked style="accent-color:var(--green)">
                        ${sectionName}
                    </label>`);
            }
        }
    });
}

async function addFirstHarmonySection(songTitle) {
    // Show the lyrics-based harmony builder
    const container = document.getElementById('harmoniesContainer');
    if (!container) return;
    
    // Try to load existing lyrics from Firebase
    let existingLyrics = '';
    try {
        const lyricData = await loadBandDataFromDrive(songTitle, 'lyrics');
        if (lyricData?.text) existingLyrics = lyricData.text;
    } catch(e) {}
    
    container.innerHTML = `
    <div style="padding:12px;background:rgba(102,126,234,0.05);border:1px solid rgba(102,126,234,0.15);border-radius:10px">
        <h4 style="color:var(--accent-light,#818cf8);margin-bottom:10px">🎤 Harmony Section Builder — ${songTitle}</h4>
        <p style="font-size:0.82em;color:var(--text-dim);margin-bottom:10px">
            Paste the lyrics below, then tag which sections have harmonies. This sets up the structure for recording harmony parts.
        </p>
        
        <div class="form-row" style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <label class="form-label" style="margin:0">Song Lyrics</label>
                <div style="display:flex;gap:6px;align-items:center">
                    <button class="btn btn-sm btn-primary" onclick="harmonyFetchLyrics(this.dataset.song)" data-song="${songTitle.replace(/"/g,'&quot;')}">
                        🎵 Fetch from Genius
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="toggleGeniusKeyRow()" title="Set Genius API Key">🔑</button>
                </div>
            </div>
            <div id="geniusKeyRow" style="display:none;gap:6px;margin-bottom:8px;align-items:center">
                <input class="app-input" id="geniusApiKeyInput" placeholder="Paste Genius API key here..." style="flex:1;margin:0;font-size:0.82em">
                <button class="btn btn-sm btn-success" onclick="saveAndHideGeniusKey()">Save Key</button>
                <a href="https://genius.com/api-clients" target="_blank" style="font-size:0.75em;color:var(--accent-light);white-space:nowrap">Get free key ↗</a>
            </div>
            <div id="lyricsStatus" style="display:none;padding:8px 12px;background:rgba(102,126,234,0.1);border-radius:6px;font-size:0.82em;color:var(--accent-light);margin-bottom:8px"></div>
            <textarea class="app-textarea" id="harmLyrics" rows="12" placeholder="Paste song lyrics here, or click Fetch from Genius above...">${existingLyrics}</textarea>
        </div>
        
        <div style="margin-bottom:12px">
            <label class="form-label" style="margin-bottom:6px;display:block">Tag Sections with Harmonies</label>
            <p style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Check each section that has vocal harmonies. These will become harmony recording sections.</p>
            <div id="harmSectionTags" style="display:flex;flex-wrap:wrap;gap:6px">
                ${['Verse 1','Verse 2','Verse 3','Verse 4','Verse 5','Chorus','Bridge','Coda','Intro','Outro','Pre-Chorus','Tag'].map(s => `
                    <label style="display:flex;align-items:center;gap:5px;padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:8px;cursor:pointer;font-size:0.82em;color:var(--text-muted)">
                        <input type="checkbox" class="harmSectionCheck" value="${s}" style="accent-color:var(--accent);width:14px;height:14px">
                        ${s}
                    </label>
                `).join('')}
            </div>
            <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
                <input class="app-input" id="harmCustomSection" placeholder="Custom section name..." style="flex:1;margin:0">
                <button class="btn btn-sm btn-ghost" onclick="addCustomHarmSection()">+ Add</button>
            </div>
        </div>
        
        <div style="margin-bottom:12px">
            <label class="form-label" style="margin-bottom:6px;display:block">Singing Assignments (optional)</label>
            <div class="form-grid">
                ${Object.entries(bandMembers).filter(([k,m]) => m.sings || m.leadVocals || m.harmonies).map(([k,m]) => `
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85em;color:var(--text-muted)">
                        <input type="checkbox" class="harmSingerCheck" value="${k}" checked style="accent-color:var(--accent)">
                        ${m.name} — ${m.leadVocals?'Lead/Harmony':m.harmonies?'Harmony':'Vocals'}
                    </label>
                `).join('')}
            </div>
        </div>
        
        <div style="display:flex;gap:8px">
            <button class="btn btn-success" onclick="buildHarmonySections('${songTitle.replace(/'/g,"\\'")}')">🎤 Create Harmony Sections</button>
            <button class="btn btn-ghost" onclick="renderHarmoniesEnhanced('${songTitle.replace(/'/g,"\\'")}',bandKnowledgeBase['${songTitle.replace(/'/g,"\\'")}']||{})">Cancel</button>
        </div>
    </div>`;
}

function addCustomHarmSection() {
    const input = document.getElementById('harmCustomSection');
    const val = input?.value?.trim();
    if (!val) return;
    const container = document.getElementById('harmSectionTags');
    container.insertAdjacentHTML('beforeend', `
        <label style="display:flex;align-items:center;gap:5px;padding:6px 10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;cursor:pointer;font-size:0.82em;color:var(--green,#10b981)">
            <input type="checkbox" class="harmSectionCheck" value="${val}" checked style="accent-color:var(--green)">
            ${val}
        </label>`);
    input.value = '';
}

async function buildHarmonySections(songTitle) {
    // Get checked sections
    const checks = document.querySelectorAll('.harmSectionCheck:checked');
    if (checks.length === 0) { alert('Please check at least one section that has harmonies.'); return; }
    
    const sectionNames = Array.from(checks).map(c => c.value);
    
    // Get singers
    const singers = Array.from(document.querySelectorAll('.harmSingerCheck:checked')).map(c => c.value);
    
    // Save lyrics
    const lyrics = document.getElementById('harmLyrics')?.value || '';
    if (lyrics.trim()) {
        await saveBandDataToDrive(songTitle, 'lyrics', { text: lyrics, updated: new Date().toISOString() });
    }
    
    // Build harmony sections
    if (!bandKnowledgeBase[songTitle]) bandKnowledgeBase[songTitle] = {};
    
    // Preserve existing sections
    let existing = bandKnowledgeBase[songTitle].harmonies;
    if (!existing || !existing.sections) {
        const driveData = await loadBandDataFromDrive(songTitle, 'harmonies_data');
        if (driveData && driveData.sections) existing = driveData;
    }
    const existingSections = (existing && existing.sections) ? [...toArray(existing.sections)] : [];
    const existingNames = new Set(existingSections.map(s => s.name || s.lyric));
    
    // Add new sections (skip duplicates)
    const newSections = sectionNames.filter(n => !existingNames.has(n)).map(name => ({
        name: name,
        lyric: name,
        timing: '',
        workedOut: false,
        soundsGood: false,
        parts: singers.map(s => ({
            singer: s,
            part: bandMembers[s]?.leadVocals ? 'lead' : 'harmony',
            notes: ''
        })),
        practiceNotes: []
    }));
    
    const allSections = [...existingSections, ...newSections];

    // Sort by canonical song section order
    const SECTION_ORDER = ['intro','verse 1','verse 2','verse 3','verse 4','verse','pre-chorus','chorus','post-chorus','bridge','solo','outro','coda','tag','reprise'];
    allSections.sort((a, b) => {
        const aName = (a.name || a.lyric || '').toLowerCase();
        const bName = (b.name || b.lyric || '').toLowerCase();
        const aIdx = SECTION_ORDER.findIndex(s => aName.includes(s));
        const bIdx = SECTION_ORDER.findIndex(s => bName.includes(s));
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
    });
    const harmonies = { sections: allSections, lyrics: lyrics || undefined };
    
    // Update in-memory
    bandKnowledgeBase[songTitle].harmonies = harmonies;
    harmonyCache[songTitle] = true;
    harmonyBadgeCache[songTitle] = true;
    
    const harmoniesCheckbox = document.getElementById('hasHarmoniesCheckbox');
    if (harmoniesCheckbox) harmoniesCheckbox.checked = true;
    
    // Save to Firebase
    try {
        await saveBandDataToDrive(songTitle, 'has_harmonies', { hasHarmonies: true });
        await saveBandDataToDrive(songTitle, 'harmonies_data', harmonies);
        await saveMasterFile(MASTER_HARMONIES_FILE, harmonyBadgeCache);
    } catch (e) { console.warn('Could not save harmony data:', e); }
    
    // Re-render
    await renderHarmoniesEnhanced(songTitle, bandKnowledgeBase[songTitle]);
    logActivity('harmony_add', { song: songTitle, extra: sectionNames.join(', ') });
    addHarmonyBadges();
    
    alert('✅ Created ' + newSections.length + ' harmony section(s): ' + sectionNames.join(', '));
}

async function updateHasHarmonies(hasHarmonies) {
    if (!selectedSong || !selectedSong.title) {
        console.error('Cannot update has harmonies - no song selected');
        return;
    }
    
    console.log(`Updating has harmonies for "${selectedSong.title}": ${hasHarmonies}`);
    
    await saveBandDataToDrive(selectedSong.title, 'has_harmonies', { hasHarmonies });
    
    // Update caches immediately
    harmonyCache[selectedSong.title] = hasHarmonies;
    harmonyBadgeCache[selectedSong.title] = hasHarmonies;
    
    // Save updated master harmonies file
    saveMasterFile(MASTER_HARMONIES_FILE, harmonyBadgeCache).then(() => {
        console.log('Master harmonies file updated');
    });
    
    // Update badge on song list
    addHarmonyBadges();
    
    // Show/hide harmony members row
    const membersRow = document.getElementById('harmonyMembersRow');
    if (membersRow) membersRow.style.display = hasHarmonies ? 'flex' : 'none';
    
    // Refresh harmonies display
    const bandData = bandKnowledgeBase[selectedSong.title];
    if (bandData) {
        renderHarmoniesEnhanced(selectedSong.title, bandData);
    }
    
    console.log(`Has harmonies: ${hasHarmonies} - saved to Google Drive!`);
}


function toggleSingersDropdown() {
    const dd = document.getElementById('singersDropdown');
    if (!dd) return;
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    setTimeout(() => {
        const close = (e) => {
            if (!document.getElementById('singersDropdownBtn')?.contains(e.target) &&
                !document.getElementById('singersDropdown')?.contains(e.target)) {
                dd.style.display = 'none';
                document.removeEventListener('click', close);
            }
        };
        document.addEventListener('click', close);
    }, 0);
}

function updateSingersLabel() {
    const checked = [...document.querySelectorAll('.harmony-member-cb:checked')].map(cb =>
        cb.value.charAt(0).toUpperCase() + cb.value.slice(1)
    );
    const label = document.getElementById('singersLabel');
    if (label) label.textContent = checked.length ? checked.join(', ') : 'Select singers...';
}

async function updateHarmonyMembers() {
    updateSingersLabel();
    if (!selectedSong || !selectedSong.title) return;
    const checkboxes = document.querySelectorAll('.harmony-member-cb:checked');
    const members = Array.from(checkboxes).map(cb => cb.value);
    await saveBandDataToDrive(selectedSong.title, 'harmony_members', members);
    console.log('🎶 Harmony members updated:', members);
}

async function loadHarmonyMembers(songTitle) {
    try {
        return await loadBandDataFromDrive(songTitle, 'harmony_members') || [];
    } catch(e) { return []; }
}

function updateSongStructureSummary(data) {
    const el = document.getElementById('songStructureSummary');
    if (!el) return;
    if (!data || (!data.whoStarts?.length && !data.whoCuesEnding?.length && !data.whoCuesEnding && !data.howStarts && !data.howEnds)) {
        el.textContent = '—';
        return;
    }
    const getName = (k) => k === 'whole_band' ? 'Whole Band' : (bandMembers[k]?.name || k);
    const val = (text) => `<span style="color:var(--text,#f1f5f9);font-weight:600">${text}</span>`;
    const parts = [];
    if (data.whoStarts?.length) parts.push(`Starts — Who? ${val(data.whoStarts.map(getName).join(', '))}`);
    if (data.howStarts) parts.push(`How? ${val(data.howStarts)}`);
    const endings = Array.isArray(data.whoCuesEnding) ? data.whoCuesEnding : (data.whoCuesEnding ? [data.whoCuesEnding] : []);
    if (endings.length) parts.push(`Ends — Who? ${val(endings.map(getName).join(', '))}`);
    if (data.howEnds) parts.push(`How? ${val(data.howEnds)}`);
    el.innerHTML = parts.join(' &nbsp;·&nbsp; ');
}

async function loadHasHarmonies(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'has_harmonies');
    return data ? data.hasHarmonies : false;
}

// ============================================================================
// SONG STATUS SYSTEM - Gig Ready, Needs Polish, On Deck, This Week
// ============================================================================

async function updateSongStatus(status) {
    if (!selectedSong || !selectedSong.title) return;
    if (!isUserSignedIn) showSignInNudge();
    
    const statusNames = {
        '': 'Not on Radar',
        'prospect': 'Prospect',
        'wip': 'Work in Progress',
        'gig_ready': 'Gig Ready'
    };
    
    // Save to individual file (backward compatibility)
    await saveBandDataToDrive(selectedSong.title, 'song_status', { status, updatedAt: new Date().toISOString(), updatedBy: currentUserEmail });
    
    // Update cache immediately
    statusCache[selectedSong.title] = status;
    
    // Save updated master file (so next page load is instant)
    saveMasterFile(MASTER_STATUS_FILE, statusCache).then(() => {
        console.log('Master status file updated');
    });
    
    console.log(`Song status updated: ${statusNames[status] || 'Not Started'}`);
    logActivity('status_change', { song: selectedSong.title, extra: statusNames[status] || 'Not Started' });
    
    // Update badge on song list
    await addStatusBadges();
}

async function loadSongStatus(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'song_status');
    return data ? data.status : '';
}

async function filterByStatus(status) {
    console.log('Filtering by status:', status);
    
    if (!statusCacheLoaded && status !== 'all') {
        alert('Song statuses are still loading. Please wait a moment.');
        const sel = document.getElementById('statusFilter');
        if (sel) sel.value = 'all';
        return;
    }
    
    activeStatusFilter = (status === 'all') ? null : status;
    const searchTerm = document.getElementById('songSearch')?.value || '';
    renderSongs(currentFilter, searchTerm);
}

// Legacy - kept for backward compat but renderSongs now handles filtering at data level

async function addStatusBadges() {
    if (!statusCacheLoaded) {
        console.log('⏳ Status cache not loaded yet, skipping badges');
        return;
    }
    
    const songItems = document.querySelectorAll('.song-item');
    songItems.forEach(item => {
        const statusCell = item.querySelector('.song-status-cell');
        if (!statusCell) return;
        
        // Clear existing
        statusCell.innerHTML = '';
        
        const songTitle = item.dataset.title || '';
        if (!songTitle) return;
        
        const status = getStatusFromCache(songTitle);
        
        if (status) {
            const badges = {
                'prospect': { text: '👀 PROSPECT', color: '#fff', bg: '#7c3aed' },
                'wip': { text: '🔧 IN PROGRESS', color: '#fff', bg: '#d97706' },
                'gig_ready': { text: '✅ READY', color: '#fff', bg: '#059669' }
            };
            
            const badge = badges[status];
            if (badge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'status-badge';
                badgeEl.textContent = badge.text;
                badgeEl.style.cssText = `color:${badge.color};background:${badge.bg};`;
                statusCell.appendChild(badgeEl);
            }
        }
    });
}

// ============================================================================
// BPM SYSTEM - Song BPM + ABC Player BPM with memory
// ============================================================================

async function updateSongBpm(bpm) {
    if (!selectedSong || !selectedSong.title) return;
    if (!isUserSignedIn) showSignInNudge();
    
    const bpmNum = parseInt(bpm);
    if (isNaN(bpmNum) || bpmNum < 40 || bpmNum > 240) {
        console.warn('Invalid BPM:', bpm);
        return;
    }
    
    await saveBandDataToDrive(selectedSong.title, 'song_bpm', { bpm: bpmNum, updatedAt: new Date().toISOString() });
    console.log(`🎵 Song BPM updated: ${bpmNum}`);
}

async function loadSongBpm(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, 'song_bpm');
    return data ? data.bpm : null;
}

async function populateSongMetadata(songTitle) {
    const leadSinger = await loadLeadSinger(songTitle);
    const hasHarmonies = await loadHasHarmonies(songTitle);
    const songStatus = await loadSongStatus(songTitle);
    const songBpm = await loadSongBpm(songTitle);
    const songKey = await loadSongKey(songTitle);
    
    const leadSelect = document.getElementById('leadSingerSelect');
    if (leadSelect) leadSelect.value = leadSinger;
    
    const harmoniesCheckbox = document.getElementById('hasHarmoniesCheckbox');
    if (harmoniesCheckbox) harmoniesCheckbox.checked = hasHarmonies;
    
    // Show/hide harmony members row
    const membersRow = document.getElementById('harmonyMembersRow');
    if (membersRow) membersRow.style.display = hasHarmonies ? 'flex' : 'none';
    
    // Load harmony members
    const harmonyMembers = await loadHarmonyMembers(songTitle);
    document.querySelectorAll('.harmony-member-cb').forEach(cb => {
        cb.checked = harmonyMembers.includes(cb.value);
    });
    
    const statusSelect = document.getElementById('songStatusSelect');
    if (statusSelect) statusSelect.value = songStatus || '';
    
    const bpmInput = document.getElementById('songBpmInput');
    if (bpmInput) bpmInput.value = songBpm || '';
    
    const keySelect = document.getElementById('songKeySelect');
    if (keySelect) keySelect.value = songKey || '';
    
    // Load song structure summary
    try {
        const structure = await loadBandDataFromDrive(songTitle, 'song_structure');
        updateSongStructureSummary(structure);
    } catch(e) { updateSongStructureSummary(null); }
}

async function updateSongKey(key) {
    if (!selectedSong) return;
    const songTitle = typeof selectedSong === 'string' ? selectedSong : selectedSong.title;
    await saveBandDataToDrive(songTitle, 'key', { key, updatedAt: new Date().toISOString() });
    console.log('🎵 Key updated:', key);
}

async function loadSongKey(songTitle) {
    try {
        const data = await loadBandDataFromDrive(songTitle, 'key');
        return (data && typeof data === 'object') ? (data.key || '') : (data || '');
    } catch(e) { return ''; }
}

// ============================================================================
// HARMONY SONG FILTERING
// ============================================================================

// Cache for harmony states - loads on demand
let harmonyCache = {};

// Cache for song statuses - loaded from single master file
let statusCache = {};
let statusCacheLoaded = false;
let statusPreloadRunning = false;

// ============================================================================
// MASTER STATUS FILE - Single Drive file for ALL song statuses (FAST!)
// Instead of 358 individual Drive calls, we load ONE file on startup.

// ============================================================================
// MASTER FILES FOR EFFICIENT LOADING
// ============================================================================

const MASTER_STATUS_FILE = '_master_song_statuses.json';
const MASTER_HARMONIES_FILE = '_master_harmonies.json';
const MASTER_NORTH_STAR_FILE = '_master_north_stars.json';
const MASTER_ACTIVITY_LOG = '_master_activity_log.json';

async function preloadAllStatuses() {
    if (statusPreloadRunning) return;
    if (statusCacheLoaded) {
        addStatusBadges();
        return;
    }
    
    statusPreloadRunning = true;
    console.log('Loading song statuses from master file...');
    
    try {
        // Load master status file (1 API call instead of 358!)
        const masterData = await loadMasterFile(MASTER_STATUS_FILE);
        
        if (masterData && typeof masterData === 'object' && Object.keys(masterData).length > 0) {
            // Master file exists - use it!
            Object.assign(statusCache, masterData);
            const count = Object.values(masterData).filter(v => v).length;
            console.log(`Loaded ${count} song statuses from master file (1 API call!)`);
            statusCacheLoaded = true;
        } else if (isUserSignedIn) {
            // Drive is ready but no master file - migrate
            console.log('No master status file found. Migrating from individual files...');
            await migrateStatusesToMaster();
            statusCacheLoaded = true;
        } else {
            // Drive not ready yet - try localStorage, don't mark as loaded
            const localData = localStorage.getItem('deadcetera__master_song_statuses.json');
            if (localData) {
                try {
                    Object.assign(statusCache, JSON.parse(localData));
                    const count = Object.values(statusCache).filter(v => v).length;
                    console.log(`Loaded ${count} statuses from localStorage (Drive not ready yet)`);
                    statusCacheLoaded = true;
                } catch (e) {}
            }
            // Will retry on next render cycle
        }
    } catch (error) {
        console.error('Error loading master statuses:', error);
        const localData = localStorage.getItem('deadcetera__master_song_statuses.json');
        if (localData) {
            try {
                Object.assign(statusCache, JSON.parse(localData));
                console.log('Loaded statuses from localStorage fallback');
                statusCacheLoaded = true;
            } catch (e) {}
        }
    }
    statusPreloadRunning = false;
    console.log('All song statuses ready! Filtering is now instant.');
    
    addStatusBadges();
}


// (loadMasterFile and saveMasterFile are defined in Firebase storage section below)

// One-time migration: read individual status files and combine into master
async function migrateStatusesToMaster() {
    console.log('Starting one-time status migration...');
    const migrated = {};
    let count = 0;
    
    // Load statuses in small batches to avoid throttling
    for (let i = 0; i < allSongs.length; i += 5) {
        const batch = allSongs.slice(i, i + 5);
        
        await Promise.all(batch.map(async (song) => {
            try {
                const data = await loadBandDataFromDrive(song.title, 'song_status');
                if (data && data.status) {
                    migrated[song.title] = data.status;
                    count++;
                }
            } catch (e) {
                // Skip failures
            }
        }));
        
        if (i % 50 === 0 && i > 0) {
            console.log(`Migration progress: ${i}/${allSongs.length}...`);
        }
    }
    
    // Save master file
    if (count > 0) {
        await saveMasterFile(MASTER_STATUS_FILE, migrated);
        console.log(`Migration complete! ${count} statuses saved to master file.`);
    } else {
        console.log('No existing statuses found to migrate.');
        // Save empty master so we don\'t re-migrate
        await saveMasterFile(MASTER_STATUS_FILE, {});
    }
    
    Object.assign(statusCache, migrated);
}

// Get status from cache (instant!)
function getStatusFromCache(songTitle) {
    return statusCache[songTitle] || '';
}

async function filterSongsAsync(type) {
    console.log('Filtering songs:', type);
    
    // Toggle: if clicking the same filter again, reset to 'all'
    if (type === 'harmonies' && activeHarmonyFilter === 'harmonies') {
        type = 'all';
        const cb = document.getElementById('harmoniesOnlyFilter');
        if (cb) cb.checked = false;
    }
    
    activeHarmonyFilter = (type === 'all') ? null : type;
    const searchTerm = document.getElementById('songSearch')?.value || '';
    renderSongs(currentFilter, searchTerm);
}

function toggleNorthStarFilter(enabled) {
    activeNorthStarFilter = enabled;
    renderSongs(currentFilter, document.getElementById('songSearch')?.value || '');
}

function filterSongsSync(type) {
    filterSongsAsync(type);
}


// Cache for harmony data - loaded from master file
let harmonyBadgeCache = {};
let harmonyBadgeCacheLoaded = false;
let harmonyBadgeLoading = false;

// North Star (reference version) cache
let northStarCache = {};
let northStarCacheLoaded = false;
let northStarCacheLoading = false;
let northStarScanDone = false;   // tracks whether Firebase full-scan has run this session
let activeNorthStarFilter = false;


async function addHarmonyBadges() {
    // Don't run multiple times simultaneously
    if (harmonyBadgeLoading) return;
    
    // Load master harmony file if not cached yet
    if (!harmonyBadgeCacheLoaded) {
        harmonyBadgeLoading = true;
        try {
            const masterData = await loadMasterFile(MASTER_HARMONIES_FILE);
            if (masterData && typeof masterData === 'object' && Object.keys(masterData).length > 0) {
                harmonyBadgeCache = masterData;
                harmonyBadgeCacheLoaded = true;
                console.log('Loaded harmonies from master file');
            } else if (isUserSignedIn) {
                // Drive is ready but no data found - mark as loaded (no harmonies set yet)
                harmonyBadgeCacheLoaded = true;
                console.log('No harmony data found in master file');
            }
            // If Drive not ready yet, DON'T mark as loaded - will retry on next render
        } catch (e) {
            console.error('Error loading harmony master:', e);
            if (isUserSignedIn) {
                harmonyBadgeCacheLoaded = true; // Drive was ready, real error
            }
        }
        harmonyBadgeLoading = false;
    }
    
    // Apply badges from cache (instant, no Drive calls!)
    const songItems = document.querySelectorAll('.song-item');
    songItems.forEach(item => {
        const badgesContainer = item.querySelector('.song-badges');
        if (!badgesContainer) return;
        
        // Remove existing harmony badge
        const existingBadge = badgesContainer.querySelector('.harmony-badge');
        if (existingBadge) existingBadge.remove();
        
        const songTitle = item.dataset.title || '';
        if (!songTitle) return;
        
        // Add badge if song has harmonies
        if (harmonyBadgeCache[songTitle]) {
            const badge = document.createElement('span');
            badge.className = 'harmony-badge';
            badge.textContent = '🎤';
            badge.title = 'Has vocal harmonies';
            badgesContainer.appendChild(badge);
        }
    });
}

// ============================================================================
// NORTH STAR BADGES — fast preload strategy
// Phase 1 (blocking): load master file → render stars immediately with first song list
// Phase 2 (background): scan Firebase songs/ once per session → update if new songs found
// ============================================================================

async function preloadNorthStarCache() {
    if (northStarCacheLoaded) return;
    try {
        (allSongs || []).forEach(song => {
            const bk = bandKnowledgeBase[song.title];
            if (bk && bk.spotifyVersions && bk.spotifyVersions.length > 0) {
                northStarCache[song.title] = true;
            }
        });
        const masterData = await loadMasterFile(MASTER_NORTH_STAR_FILE);
        if (masterData && typeof masterData === 'object') {
            Object.assign(northStarCache, masterData);
        }
        northStarCacheLoaded = true;
    } catch(e) { northStarCacheLoaded = true; }
}

function backgroundScanNorthStars() {
    if (northStarScanDone || !firebaseDB) return;
    northStarScanDone = true;
    firebaseDB.ref('songs').once('value').then(snapshot => {
        const allSongData = snapshot.val() || {};
        const sanitizedToReal = {};
        (allSongs || []).forEach(s => { sanitizedToReal[sanitizeFirebasePath(s.title)] = s.title; });
        let changed = false;
        Object.entries(allSongData).forEach(([fbKey, songData]) => {
            if (!songData) return;
            const versionsRaw = songData.spotify_versions || songData.ref_versions;
            if (!versionsRaw) return;
            const versions = Array.isArray(versionsRaw) ? versionsRaw.filter(Boolean) : Object.values(versionsRaw).filter(Boolean);
            if (!versions || versions.length === 0) return;
            const realTitle = sanitizedToReal[fbKey] || fbKey;
            if (!northStarCache[realTitle]) { northStarCache[realTitle] = true; changed = true; }
        });
        if (changed) {
            saveMasterFile(MASTER_NORTH_STAR_FILE, northStarCache).catch(() => {});
            applyNorthStarBadges();
        }
    }).catch(err => console.log('North Star scan error:', err));
}

function applyNorthStarBadges() {
    document.querySelectorAll('.song-item').forEach(item => {
        const bc = item.querySelector('.song-badges');
        if (!bc) return;
        const ex = bc.querySelector('.northstar-badge');
        if (ex) ex.remove();
        const t = item.dataset.title || '';
        if (northStarCache[t]) {
            const b = document.createElement('span');
            b.className = 'northstar-badge';
            b.textContent = '⭐';
            b.title = 'Has reference version';
            b.style.cssText = 'font-size:0.85em;flex-shrink:0;line-height:1;cursor:default';
            bc.appendChild(b);
        }
    });
}

async function addNorthStarBadges() {
    if (!northStarCacheLoaded) {
        if (northStarCacheLoading) return;
        northStarCacheLoading = true;
        await preloadNorthStarCache();
        northStarCacheLoading = false;
    }
    applyNorthStarBadges();
    backgroundScanNorthStars();
}

// ============================================================================
// COMPREHENSIVE FIREBASE STORAGE - ALL BAND DATA SHARED
// ============================================================================

// Central storage for all band data types
const BAND_DATA_TYPES = {
    PRACTICE_TRACKS: 'practice_tracks',
    REHEARSAL_NOTES: 'rehearsal_notes', 
    SPOTIFY_URLS: 'spotify_urls',
    HARMONY_METADATA: 'harmony_metadata',
    PART_NOTES: 'part_notes',
    LEAD_SINGER: 'lead_singer',
    HAS_HARMONIES: 'has_harmonies'
};

// ============================================================================
// SAVE TO FIREBASE (Shared with all band members automatically!)
// ============================================================================

async function saveBandDataToDrive(songTitle, dataType, data) {
    // Always save to localStorage as backup
    const localKey = `deadcetera_${dataType}_${songTitle}`;
    localStorage.setItem(localKey, JSON.stringify(data));
    
    if (!firebaseDB) {
        console.warn('⚠️ Firebase not ready — saved to localStorage only (not shared with band)');
        showSignInNudge();
        return false;
    }
    
    try {
        const path = songPath(songTitle, dataType);
        await firebaseDB.ref(path).set(data);
        return true;
    } catch (error) {
        console.error('❌ Failed to save to Firebase:', error);
        // Show error toast so user knows their save didn't reach the band
        showToast('⚠️ Could not sync to band — check your connection');
        return false;
    }
}

// ============================================================================
// LOAD FROM FIREBASE (Shared with all band members automatically!)
// ============================================================================

async function loadBandDataFromDrive(songTitle, dataType) {
    if (firebaseDB) {
        try {
            const path = songPath(songTitle, dataType);
            const snapshot = await firebaseDB.ref(path).once('value');
            const data = snapshot.val();
            
            if (data !== null) {
                console.log(`✅ Loaded ${dataType} from Firebase`);
                return data;
            } else {
                console.log(`No Firebase data for ${dataType}`);
            }
        } catch (error) {
            console.log(`⚠️ Firebase error for ${dataType}:`, error.message);
        }
    }
    
    // Fallback to localStorage
    return loadFromLocalStorageFallback(songTitle, dataType);
}

function loadFromLocalStorageFallback(songTitle, dataType) {
    const key = `deadcetera_${dataType}_${songTitle}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// ============================================================================
// MASTER FILES (aggregated data like all statuses, all harmonies)
// ============================================================================

async function loadMasterFile(fileName) {
    if (firebaseDB) {
        try {
            const path = masterPath(fileName);
            const snapshot = await firebaseDB.ref(path).once('value');
            const data = snapshot.val();
            if (data !== null) return data;
        } catch (error) {
            console.log(`Could not load master file from Firebase: ${fileName}`);
        }
    }
    
    // Try localStorage
    const key = `deadcetera_${fileName}`;
    const localData = localStorage.getItem(key);
    return localData ? JSON.parse(localData) : null;
}

async function saveMasterFile(fileName, data) {
    // Always save to localStorage as backup
    const key = `deadcetera_${fileName}`;
    localStorage.setItem(key, JSON.stringify(data));
    
    if (!firebaseDB) return false;
    
    try {
        const path = masterPath(fileName);
        await firebaseDB.ref(path).set(data);
        console.log(`Saved master file: ${fileName}`);
        return true;
    } catch (error) {
        console.error('Error saving master file:', error);
        return false;
    }
}

// ============================================================================
// PRACTICE TRACKS / REHEARSAL NOTES / SPOTIFY URLS / PART NOTES
// ============================================================================

async function savePracticeTracks(songTitle, tracks) {
    logActivity('practice_track', { song: songTitle });
    return await saveBandDataToDrive(songTitle, BAND_DATA_TYPES.PRACTICE_TRACKS, tracks);
}

async function loadPracticeTracksFromDrive(songTitle) {
    return toArray(await loadBandDataFromDrive(songTitle, BAND_DATA_TYPES.PRACTICE_TRACKS) || []);
}

async function saveRehearsalNotes(songTitle, notes) {
    logActivity('rehearsal_note', { song: songTitle });
    return await saveBandDataToDrive(songTitle, BAND_DATA_TYPES.REHEARSAL_NOTES, notes);
}

async function loadRehearsalNotes(songTitle) {
    const data = await loadBandDataFromDrive(songTitle, BAND_DATA_TYPES.REHEARSAL_NOTES);
    return toArray(data || []);
}

async function saveHarmonyMetadataToDrive(songTitle, sectionIndex, metadata) {
    const key = `${songTitle}_section${sectionIndex}`;
    logActivity('harmony_edit', { song: songTitle, extra: `section ${sectionIndex}` });
    return await saveBandDataToDrive(key, BAND_DATA_TYPES.HARMONY_METADATA, metadata);
}

async function loadHarmonyMetadataFromDrive(songTitle, sectionIndex) {
    const key = `${songTitle}_section${sectionIndex}`;
    return await loadBandDataFromDrive(key, BAND_DATA_TYPES.HARMONY_METADATA) || {};
}

// ============================================================================
// MOISES STEMS UPLOAD (Firebase Storage)
// ============================================================================

async function createDriveFolder(folderName, parentFolderId) {
    // No-op for Firebase - we don't need folders
    // Return a dummy ID for compatibility
    return sanitizeFirebasePath(folderName);
}

async function uploadFileToDrive(file, parentFolderId) {
    // Upload to Firebase Storage instead
    try {
        const safeName = sanitizeFirebasePath(`${parentFolderId}/${file.name}`);
        const storageRef = firebaseStorage.ref(`stems/${safeName}`);
        await storageRef.put(file);
        const downloadURL = await storageRef.getDownloadURL();
        console.log(`✅ Uploaded ${file.name} to Firebase Storage`);
        return downloadURL; // Return URL instead of Drive file ID
    } catch (error) {
        console.error('Error uploading file:', error);
        return null;
    }
}

console.log('🔥 Firebase storage system loaded');

// ============================================================================
// FIREBASE HELPER FUNCTIONS (replaces Drive folder/file management)
// ============================================================================


console.log('✅ Firebase helper functions loaded');

// ============================================================================
// SONG STRUCTURE - Who starts, how it starts, who cues ending, how it ends
// ============================================================================

async function renderSongStructure(songTitle) {
    const container = document.getElementById('songStructureContainer');
    
    // Load from Firebase first, fall back to data.js
    let structure = await loadBandDataFromDrive(songTitle, 'song_structure');
    if (!structure || (!structure.whoStarts && !structure.howStarts && !structure.whoCuesEnding && !structure.howEnds)) {
        // Check bandKnowledgeBase (data.js) for pre-populated data
        const bk = bandKnowledgeBase[songTitle];
        if (bk) {
            structure = {
                whoStarts: bk.songStructure?.whoStarts || bk.whoStarts || [],
                howStarts: bk.songStructure?.howStarts || bk.howStarts || '',
                whoCuesEnding: bk.songStructure?.whoCuesEnding || bk.whoCuesEnding || '',
                howEnds: bk.songStructure?.howEnds || bk.howEnds || ''
            };
        }
    }
    if (!structure) structure = {};
    
    if (!structure.whoStarts && !structure.howStarts && !structure.whoCuesEnding && !structure.howEnds) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <p>No song structure info yet</p>
                <button onclick="editSongStructure()" class="secondary-btn" style="margin-top: 10px;">+ Add Structure</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative;">
            <button onclick="showSongStructureForm()" style="position:absolute;top:-4px;right:0;background:var(--accent);color:white;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75em;font-weight:600;z-index:1">✏️ Edit</button>
            
            <!-- START panel -->
            <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:14px;">
                <div style="font-size:0.7em;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--green);margin-bottom:10px">▶ START</div>
                ${structure.whoStarts && structure.whoStarts.length > 0 ? `
                    <div style="margin-bottom:8px">
                        <div style="font-size:0.72em;font-weight:600;color:var(--text-dim);text-transform:uppercase;margin-bottom:5px">Who kicks it off</div>
                        <div style="display:flex;flex-wrap:wrap;gap:4px">${structure.whoStarts.map(m =>
                            `<span style="background:rgba(16,185,129,0.2);color:#34d399;padding:3px 10px;border-radius:20px;font-size:0.8em;font-weight:600">${bandMembers[m]?.name || m}</span>`
                        ).join('')}</div>
                    </div>` : '<div style="color:var(--text-dim);font-size:0.8em;margin-bottom:8px">Who — not set</div>'}
                ${structure.howStarts ? `
                    <div>
                        <div style="font-size:0.72em;font-weight:600;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">How it starts</div>
                        <div style="font-size:0.85em;color:var(--text);background:rgba(255,255,255,0.04);border-radius:6px;padding:8px">${structure.howStarts}</div>
                    </div>` : '<div style="color:var(--text-dim);font-size:0.8em">How — not set</div>'}
            </div>
            
            <!-- END panel -->
            <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:14px;">
                <div style="font-size:0.7em;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--red);margin-bottom:10px">⏹ END</div>
                ${structure.whoCuesEnding && (Array.isArray(structure.whoCuesEnding) ? structure.whoCuesEnding.length > 0 : structure.whoCuesEnding) ? `
                    <div style="margin-bottom:8px">
                        <div style="font-size:0.72em;font-weight:600;color:var(--text-dim);text-transform:uppercase;margin-bottom:5px">Who cues it</div>
                        <div style="display:flex;flex-wrap:wrap;gap:4px">${(Array.isArray(structure.whoCuesEnding)?structure.whoCuesEnding:[structure.whoCuesEnding]).map(m =>
                            `<span style="background:rgba(239,68,68,0.2);color:#f87171;padding:3px 10px;border-radius:20px;font-size:0.8em;font-weight:600">${bandMembers[m]?.name || m}</span>`
                        ).join('')}</div>
                    </div>` : '<div style="color:var(--text-dim);font-size:0.8em;margin-bottom:8px">Who — not set</div>'}
                ${structure.howEnds ? `
                    <div>
                        <div style="font-size:0.72em;font-weight:600;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">How it ends</div>
                        <div style="font-size:0.85em;color:var(--text);background:rgba(255,255,255,0.04);border-radius:6px;padding:8px">${structure.howEnds}</div>
                    </div>` : '<div style="color:var(--text-dim);font-size:0.8em">How — not set</div>'}
            </div>
        </div>
    `;
    
    // Update inline summary in metadata row
    updateSongStructureSummary(structure);
}

async function editSongStructure() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    if (document.getElementById('songStructureModal')) return;
    const structure = await loadBandDataFromDrive(songTitle, 'song_structure') || {};
    const memberOptions = Object.entries(bandMembers)
        .map(([k, m]) => `<option value="${k}">${m.name}</option>`).join('');
    const whoStartsCurrent = (structure.whoStarts || [])
        .map(e => bandMembers[e]?.name || e).join(', ');
    const modal = document.createElement('div');
    modal.id = 'songStructureModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
        <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <h3 style="margin:0;color:white">🎸 Song Structure</h3>
                <button onclick="document.getElementById('songStructureModal').remove()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.3em">✕</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:14px">
                <div>
                    <label style="display:block;font-size:0.82em;color:#9ca3af;margin-bottom:5px">Who starts the song?</label>
                    <input id="ssWhoStarts" class="app-input" placeholder="e.g. Jay, Drew"
                        value="${whoStartsCurrent}" autocomplete="off">
                    <p style="color:#6b7280;font-size:0.75em;margin-top:4px">Comma-separated names</p>
                </div>
                <div>
                    <label style="display:block;font-size:0.82em;color:#9ca3af;margin-bottom:5px">How does it start?</label>
                    <input id="ssHowStarts" class="app-input" placeholder="e.g. Count off, Cold start, Guitar intro"
                        value="${structure.howStarts || ''}" autocomplete="off">
                </div>
                <div>
                    <label style="display:block;font-size:0.82em;color:#9ca3af;margin-bottom:5px">Who cues the ending?</label>
                    <select id="ssWhoCues" class="app-select">
                        <option value="">— Nobody specific —</option>
                        ${memberOptions}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:0.82em;color:#9ca3af;margin-bottom:5px">How does it end?</label>
                    <input id="ssHowEnds" class="app-input" placeholder="e.g. Big finish, Fade out, Abrupt stop"
                        value="${structure.howEnds || ''}" autocomplete="off">
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:20px">
                <button onclick="saveSongStructure()" class="btn btn-primary" style="flex:1">💾 Save Structure</button>
                <button onclick="document.getElementById('songStructureModal').remove()" class="btn btn-ghost">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    // Pre-select who cues ending
    if (structure.whoCuesEnding) {
        const sel = document.getElementById('ssWhoCues');
        if (sel) sel.value = structure.whoCuesEnding;
    }
    document.getElementById('ssWhoStarts')?.focus();
}

async function saveSongStructure() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const whoStartsRaw = document.getElementById('ssWhoStarts')?.value?.trim() || '';
    // Convert comma-separated names back to email keys
    const whoStarts = whoStartsRaw.split(',').map(n => {
        const name = n.trim().toLowerCase();
        return Object.keys(bandMembers).find(k => bandMembers[k]?.name?.toLowerCase() === name) || n.trim();
    }).filter(Boolean);
    const structure = {
        whoStarts,
        howStarts: document.getElementById('ssHowStarts')?.value?.trim() || '',
        whoCuesEnding: document.getElementById('ssWhoCues')?.value || '',
        howEnds: document.getElementById('ssHowEnds')?.value?.trim() || '',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUserEmail
    };
    await saveBandDataToDrive(songTitle, 'song_structure', structure);
    document.getElementById('songStructureModal')?.remove();
    showToast('✅ Song structure saved');
    // Refresh the song detail view if open
    const bandData = bandKnowledgeBase[songTitle];
    if (bandData && typeof renderSongStructure === 'function') renderSongStructure(songTitle, bandData);
}

function showSongStructureForm() {
    if (!selectedSong || !selectedSong.title) return;
    
    loadBandDataFromDrive(selectedSong.title, 'song_structure').then(structure => {
        structure = structure || {};
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'structureModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        modal.innerHTML = `
            <div style="background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.12));border-radius:12px;padding:24px;max-width:500px;width:100%;max-height:85vh;overflow-y:auto;color:var(--text,#f1f5f9)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="margin:0;color:var(--accent-light,#818cf8)">🏗️ Edit Song Structure</h3>
                    <button onclick="document.getElementById('structureModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
                </div>
                
                <div style="margin-bottom:16px">
                    <strong style="display:block;margin-bottom:8px;color:var(--text-muted,#94a3b8);font-size:0.9em">🎤 Who Starts the Song?</strong>
                    <div style="display:flex;flex-wrap:wrap;gap:8px">
                        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.9em"><input type="checkbox" value="whole_band" ${structure.whoStarts?.includes('whole_band')?'checked':''} class="who-starts-checkbox" style="accent-color:var(--accent)"> Whole Band</label>
                        ${Object.keys(bandMembers).map(key => 
                            '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.9em"><input type="checkbox" value="'+key+'" '+(structure.whoStarts?.includes(key)?'checked':'')+' class="who-starts-checkbox" style="accent-color:var(--accent)"> '+bandMembers[key].name+'</label>'
                        ).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom:16px">
                    <label style="display:block;margin-bottom:6px;color:var(--text-muted,#94a3b8);font-size:0.9em;font-weight:600">🎵 How Does It Start?</label>
                    <textarea id="howStartsInput" class="app-textarea" rows="2" placeholder="Count off by Drew, Cold start, Guitar intro...">${structure.howStarts||''}</textarea>
                </div>
                
                <div style="margin-bottom:16px">
                    <strong style="display:block;margin-bottom:8px;color:var(--text-muted,#94a3b8);font-size:0.9em">🎤 Who Cues the Ending?</strong>
                    <div style="display:flex;flex-wrap:wrap;gap:8px">
                        <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.9em"><input type="checkbox" value="whole_band" ${structure.whoCuesEnding?.includes?.('whole_band')||(structure.whoCuesEnding==='whole_band')?'checked':''} class="who-ends-checkbox" style="accent-color:var(--accent)"> Whole Band</label>
                        ${Object.keys(bandMembers).map(key => 
                            '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.9em"><input type="checkbox" value="'+key+'" '+(Array.isArray(structure.whoCuesEnding)?structure.whoCuesEnding.includes(key):(structure.whoCuesEnding===key)?true:false?'checked':'')+' class="who-ends-checkbox" style="accent-color:var(--accent)"> '+bandMembers[key].name+'</label>'
                        ).join('')}
                    </div>
                </div>
                
                <div style="margin-bottom:20px">
                    <label style="display:block;margin-bottom:6px;color:var(--text-muted,#94a3b8);font-size:0.9em;font-weight:600">🎵 How Does It End?</label>
                    <textarea id="howEndsInput" class="app-textarea" rows="2" placeholder="Big finish on 1, Fade out, Abrupt stop...">${structure.howEnds||''}</textarea>
                </div>
                
                <div style="display:flex;gap:8px">
                    <button onclick="saveSongStructure()" class="btn btn-success" style="flex:1">💾 Save</button>
                    <button onclick="document.getElementById('structureModal').remove()" class="btn btn-ghost">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    });
}

function hideSongStructureForm() {
    document.getElementById('songStructureFormContainer').style.display = 'none';
    document.getElementById('editSongStructureBtn').style.display = 'block';
}

async function saveSongStructure() {
    if (!selectedSong || !selectedSong.title) return;
    
    const whoStarts = Array.from(document.querySelectorAll('.who-starts-checkbox:checked')).map(cb => cb.value);
    const whoCuesEnding = Array.from(document.querySelectorAll('.who-ends-checkbox:checked')).map(cb => cb.value);
    
    const structure = {
        whoStarts: whoStarts,
        howStarts: document.getElementById('howStartsInput').value.trim(),
        whoCuesEnding: whoCuesEnding,
        howEnds: document.getElementById('howEndsInput').value.trim()
    };
    
    await saveBandDataToDrive(selectedSong.title, 'song_structure', structure);
    logActivity('song_structure', { song: selectedSong.title });
    
    // Close modal and refresh
    document.getElementById('structureModal')?.remove();
    renderSongStructure(selectedSong.title);
    updateSongStructureSummary(structure);
}

console.log('📋 Song Structure functions loaded');

// ============================================================================
// ACTIVITY TRACKING - Silent usage logging for owner visibility
// ============================================================================

let activityLogCache = null;
let activityLogDirty = false;
let activityLogSaveTimer = null;

async function logActivity(action, details = {}) {
    if (!isUserSignedIn || !currentUserEmail) return;
    
    const entry = {
        user: currentUserEmail,
        action: action,
        song: details.song || (selectedSong ? selectedSong.title : null),
        details: details.extra || null,
        time: new Date().toISOString(),
        browser: /Brave/.test(navigator.userAgent) ? 'Brave' : 
                 /Edg/.test(navigator.userAgent) ? 'Edge' : 
                 /Chrome/.test(navigator.userAgent) ? 'Chrome' : 
                 /Firefox/.test(navigator.userAgent) ? 'Firefox' : 
                 /Safari/.test(navigator.userAgent) ? 'Safari' : 'Unknown'
    };
    
    // Initialize cache if needed
    if (!activityLogCache) {
        try {
            activityLogCache = await loadMasterFile(MASTER_ACTIVITY_LOG) || [];
        } catch (e) {
            activityLogCache = [];
        }
    }
    
    activityLogCache.push(entry);
    
    // Keep last 500 entries max
    if (activityLogCache.length > 500) {
        activityLogCache = activityLogCache.slice(-500);
    }
    
    // Debounce saves - batch writes every 10 seconds
    activityLogDirty = true;
    if (!activityLogSaveTimer) {
        activityLogSaveTimer = setTimeout(async () => {
            if (activityLogDirty) {
                await saveMasterFile(MASTER_ACTIVITY_LOG, activityLogCache);
                activityLogDirty = false;
            }
            activityLogSaveTimer = null;
        }, 3000); // 3s debounce (was 10s) — less data lost if tab closes quickly
    }
}

// Force-save on page unload
window.addEventListener('beforeunload', () => {
    if (activityLogDirty && activityLogCache) {
        // Use sync localStorage as backup since Drive save may not complete
        localStorage.setItem('deadcetera_activity_log_pending', JSON.stringify(activityLogCache));
    }
});

// ============================================================================
// ADMIN PANEL - Owner-only usage dashboard
// ============================================================================

function injectAdminButton() {
    if (currentUserEmail !== OWNER_EMAIL) return;
    
    // Don't duplicate
    if (document.getElementById('adminPanelBtn')) return;
    
    const btn = document.createElement('button');
    btn.id = 'adminPanelBtn';
    btn.innerHTML = '📊';
    btn.title = 'Band Activity Dashboard';
    btn.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 9999;
        width: 48px; height: 48px; border-radius: 50%;
        background: #667eea; color: white; border: none;
        font-size: 22px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.2s;
    `;
    btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    btn.onclick = showAdminPanel;
    document.body.appendChild(btn);

    checkUnreadFeedback();
}

async function checkUnreadFeedback() {
    try {
        const feedback = await loadBandDataFromDrive('_band', 'feedback');
        const items = Array.isArray(feedback) ? feedback : Object.values(feedback || {});
        const lastRead = localStorage.getItem('deadcetera_feedback_last_read') || '0';
        const unread = items.filter(f => f.date && f.date > lastRead).length;
        updateFeedbackBadge(unread);
    } catch(e) {}
}

function updateFeedbackBadge(count) {
    const btn = document.getElementById('adminPanelBtn');
    if (!btn) return;
    const existing = document.getElementById('adminFeedbackBadge');
    if (existing) existing.remove();
    if (count <= 0) return;
    const badge = document.createElement('div');
    badge.id = 'adminFeedbackBadge';
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;border-radius:50%;width:20px;height:20px;font-size:0.7em;font-weight:700;display:flex;align-items:center;justify-content:center;pointer-events:none;border:2px solid #1a1a2e';
    btn.style.position = 'relative';
    btn.appendChild(badge);
}

async function showAdminPanel() {
    // Mark feedback as read
    localStorage.setItem('deadcetera_feedback_last_read', new Date().toISOString());
    updateFeedbackBadge(0);
    // Remove existing panel if open
    const existing = document.getElementById('adminPanel');
    if (existing) { existing.remove(); return; }

    // Show loading state immediately
    const loadingPanel = document.createElement('div');
    loadingPanel.id = 'adminPanel';
    loadingPanel.style.cssText = `position:fixed;top:0;right:0;width:min(420px,100vw);height:100vh;background:#1a1a2e;color:#e0e0e0;z-index:10000;box-shadow:-4px 0 20px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;`;
    loadingPanel.innerHTML = `<div style="text-align:center"><div style="font-size:2em;margin-bottom:12px">⏳</div><div style="color:#667eea">Loading activity from Firebase...</div></div>`;
    document.body.appendChild(loadingPanel);

    // ALWAYS force-load from Firebase (never use stale local cache)
    // This ensures you see ALL band members' activity, not just your own session
    let log = [];
    try {
        log = await loadMasterFile(MASTER_ACTIVITY_LOG) || [];
        activityLogCache = log; // Update local cache after fresh load
    } catch(e) {
        log = activityLogCache || [];
    }
    loadingPanel.remove();
    
    const panel = document.createElement('div');
    panel.id = 'adminPanel';
    panel.style.cssText = `
        position: fixed; top: 0; right: 0; width: min(420px, 100vw); height: 100vh;
        background: #1a1a2e; color: #e0e0e0; z-index: 10000;
        box-shadow: -4px 0 20px rgba(0,0,0,0.5); overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    // Build stats
    const now = new Date();
    const last7days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30days = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    const recentLog = log.filter(e => new Date(e.time) > last30days);
    const weekLog = log.filter(e => new Date(e.time) > last7days);
    
    // Per-member stats
    const memberNames = {
        'drewmerrill1029@gmail.com': 'Drew',
        'brian@hrestoration.com': 'Brian',
        'pierce.d.hale@gmail.com': 'Pierce',
        'cmjalbert@gmail.com': 'Chris',
        'jnault@fegholdings.com': 'Jay'
    };

    // Build stats for ALL emails that appear in the log (not just hardcoded 5)
    // This catches members who signed in with a different Google account
    const allEmails = new Set([
        ...BAND_MEMBER_EMAILS,
        ...recentLog.map(e => e.user).filter(Boolean)
    ]);

    const memberStats = {};
    for (const email of allEmails) {
        const name = memberNames[email] || ('⚠️ Unknown: ' + email.split('@')[0]);
        const isKnown = BAND_MEMBER_EMAILS.includes(email);
        const memberEntries = recentLog.filter(e => e.user === email);
        const weekEntries = weekLog.filter(e => e.user === email);
        
        const signIns = memberEntries.filter(e => e.action === 'sign_in');
        const lastSignIn = signIns.length > 0 ? signIns[signIns.length - 1].time : null;
        
        const contributions = memberEntries.filter(e => e.action !== 'sign_in');
        const weekContributions = weekEntries.filter(e => e.action !== 'sign_in');
        
        // Count by type
        const byType = {};
        contributions.forEach(e => {
            byType[e.action] = (byType[e.action] || 0) + 1;
        });
        
        memberStats[email] = {
            name, email, isKnown, signIns: signIns.length, lastSignIn,
            contributions: contributions.length,
            weekContributions: weekContributions.length,
            byType,
            lastActivity: memberEntries.length > 0 ? memberEntries[memberEntries.length - 1] : null
        };
    }
    
    // Sort: known members first (by contributions), then unknown emails
    const sorted = Object.values(memberStats).sort((a, b) => {
        if (a.isKnown !== b.isKnown) return a.isKnown ? -1 : 1;
        return b.contributions - a.contributions;
    });
    
    // Action labels
    const actionLabels = {
        'sign_in': '🔑 Sign In',
        'status_change': '📊 Status Change',
        'harmony_add': '🎤 Harmony Added',
        'harmony_edit': '🎤 Harmony Edit',
        'rehearsal_note': '📝 Rehearsal Note',
        'practice_track': '🎸 Practice Track',
        'song_structure': '🏗️ Song Structure',
        'part_notes': '📋 Part Notes'
    };
    
    const timeAgo = (isoStr) => {
        if (!isoStr) return 'Never';
        const diff = now - new Date(isoStr);
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    };
    
    const feedbackData = await loadBandDataFromDrive('_band', 'feedback');
    const feedbackItems = Array.isArray(feedbackData) ? feedbackData : Object.values(feedbackData || {});
    const feedbackHTML = feedbackItems.length ? `
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px;margin-bottom:16px">
            <div style="font-weight:700;color:#fca5a5;margin-bottom:8px;font-size:0.9em">📬 Feedback & Bug Reports (${feedbackItems.length})</div>
            ${feedbackItems.slice().reverse().map(f => `
                <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.8em">
                    <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                        <span style="color:#fbbf24;font-weight:600">${f.type||'feedback'} · ${f.priority||'normal'}</span>
                        <span style="color:#64748b">${f.user||'anon'} · ${f.date ? new Date(f.date).toLocaleDateString() : ''}</span>
                    </div>
                    <div style="color:#e2e8f0">${f.description||''}</div>
                </div>
            `).join('')}
        </div>
    ` : '';

    panel.innerHTML = `
        <div style="padding: 20px;">
            ${feedbackHTML}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #667eea; font-size: 1.3em;">📊 Band Activity</h2>
                <button onclick="document.getElementById('adminPanel').remove()" 
                    style="background: none; border: none; color: #999; font-size: 24px; cursor: pointer;">✕</button>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div style="background: #16213e; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.8em; font-weight: 700; color: #667eea;">${weekLog.length}</div>
                    <div style="font-size: 0.75em; color: #888;">Actions This Week</div>
                </div>
                <div style="background: #16213e; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 1.8em; font-weight: 700; color: #10b981;">${recentLog.length}</div>
                    <div style="font-size: 0.75em; color: #888;">Actions (30 Days)</div>
                </div>
            </div>
            
            <h3 style="color: #ccc; font-size: 0.95em; margin-bottom: 12px; border-bottom: 1px solid #333; padding-bottom: 8px;">
                👥 Member Scoreboard
            </h3>
            
            ${sorted.map((m, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
                const barWidth = sorted[0].contributions > 0 ? Math.max(5, (m.contributions / sorted[0].contributions) * 100) : 0;
                const typeBreakdown = Object.entries(m.byType)
                    .map(([k, v]) => `${actionLabels[k] || k}: ${v}`)
                    .join(', ') || 'No contributions yet';
                    
                return `
                <div style="background: #16213e; border-radius: 10px; padding: 14px; margin-bottom: 10px; border: 1px solid ${m.isKnown ? 'transparent' : '#f59e0b33'}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-size: 1.1em;">${medal} <strong>${m.name}</strong></span>
                            <span style="color: #888; font-size: 0.8em; margin-left: 8px;">
                                ${m.weekContributions} this week
                            </span>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.3em; font-weight: 700; color: ${m.contributions > 0 ? '#10b981' : '#ef4444'};">
                                ${m.contributions}
                            </div>
                            <div style="font-size: 0.7em; color: #888;">contributions</div>
                        </div>
                    </div>
                    <div style="background: #0a0a1a; border-radius: 4px; height: 6px; margin: 8px 0;">
                        <div style="background: linear-gradient(90deg, #667eea, #10b981); height: 100%; border-radius: 4px; width: ${barWidth}%; transition: width 0.5s;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75em; color: #888;">
                        <span>🔑 ${m.signIns} sign-ins · Last: ${timeAgo(m.lastSignIn)}</span>
                        <span>Last active: ${timeAgo(m.lastActivity?.time)}</span>
                    </div>
                    <div style="font-size: 0.7em; color: #555; margin-top: 3px;">${m.email}</div>
                    <div style="font-size: 0.72em; color: #667; margin-top: 4px;">${typeBreakdown}</div>
                    ${!m.isKnown ? '<div style="font-size:0.72em;color:#f59e0b;margin-top:4px">⚠️ Email not in band list — may be wrong Google account</div>' : ''}
                </div>`;
            }).join('')}
            
            <h3 style="color: #ccc; font-size: 0.95em; margin: 20px 0 12px; border-bottom: 1px solid #333; padding-bottom: 8px;">
                📜 Recent Activity Feed
            </h3>
            
            <div style="max-height: 300px; overflow-y: auto;">
                ${log.slice(-30).reverse().map(e => {
                    const name = memberNames[e.user] || e.user.split('@')[0];
                    const label = actionLabels[e.action] || e.action;
                    const songInfo = e.song ? ` — ${e.song}` : '';
                    const detailInfo = e.details ? ` (${e.details})` : '';
                    return `
                    <div style="padding: 8px 0; border-bottom: 1px solid #222; font-size: 0.82em;">
                        <div style="display: flex; justify-content: space-between;">
                            <span><strong>${name}</strong> ${label}${songInfo}${detailInfo}</span>
                        </div>
                        <div style="color: #666; font-size: 0.85em;">${timeAgo(e.time)} · ${e.browser || ''}</div>
                    </div>`;
                }).join('')}
                ${log.length === 0 ? '<p style="color: #666; text-align: center; padding: 20px;">No activity logged yet. Data will appear as band members use the app.</p>' : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
}
// ============================================================================
// BAND CONFIGURATION
// ============================================================================

const BAND_MEMBER_EMAILS = [
    'drewmerrill1029@gmail.com',   // Drew (owner)
    'pierce.d.hale@gmail.com',     // Pierce
    'brian@hrestoration.com',      // Brian
    'cmjalbert@gmail.com',         // Chris
    'jnault@fegholdings.com'       // Jay
];
const OWNER_EMAIL = 'drewmerrill1029@gmail.com';

// ============================================================================
// MULTI-TRACK HARMONY STUDIO v3
// ============================================================================

let mtRecorder=null, mtAudioChunks=[], mtRecordingStream=null, mtMetronomeInterval=null;
let mtAudioContext=null, mtIsRecording=false, mtPlaybackAudios=[], mtIsPlaying=false;
let mtLooping=false, mtCurrentSectionIndex=null, mtCurrentSongTitle=null, mtLatencyMs=0;
let mtPitchAnimFrame=null, mtCurrentEffect='none';

// --- HELP TOOLTIPS ---
const mtTips = {
    metronome:'Set tempo (BPM) and click Start to hear a click track while recording.',
    tracks:'Recorded harmony parts. Solo(S) hears one track only, Mute(M) silences it. 🗑 deletes a track.',
    loop:'Mix replays automatically when it ends.',
    latency:'Compensates for the delay between when you play/sing and when the computer records it. Click 📋 for a full recording workflow guide.',
    calibrate:'Plays a tone through speakers, times when mic hears it back. Works best with speakers (not headphones). Keep the room quiet.',
    record:'Records your mic while playing checked tracks as backing. Use headphones to prevent bleed from speakers into the mic.',
    countIn:'Two measures of clicks at current BPM before recording starts. Second measure is louder so you know when recording is about to begin.',
    clickDuring:'Metronome clicks while recording to keep time.',
    pitch:'Shows what note you\'re singing in real-time. Green=in tune, yellow=close, red=off.',
    karaoke:'Sheet music with moving cursor and highlighted lyrics. Press ▶ Play in the karaoke controls to start.',
    effects:'Audio effect presets applied to playback. Select before pressing Play Mix. Warm=bass boost, Bright=presence, Room/Hall=reverb.',
    export:'Combine all checked tracks into one downloadable WAV file.',
    nudge:'After recording, shift your new track earlier or later (±200ms) to fix timing. Preview to hear the result before saving.',
    pan:'Stereo position: left, center, or right. Put guitar center, harmony 1 left, harmony 2 right — much easier to hear each part.',
    playMix:'Play all checked tracks at their volume and pan positions with the selected effect.',
    workflow:`<b>🎸 Recording Workflow Guide</b><br><br>
<b>Step 1: Calibrate Once</b><br>
Before your first recording session, click 🎯 Calibrate with speakers at moderate volume and a quiet room. This measures your system\'s audio delay. You only need to do this once per device.<br><br>
<b>Step 2: Record Guitar (Foundation)</b><br>
• Set BPM, enable Count-in and Click During<br>
• Hit Record and play acoustic guitar<br>
• Play through the whole section (or song)<br>
• Save → this is your foundation track<br><br>
<b>Step 3: Add Vocals (Use Headphones! 🎧)</b><br>
• <b>PUT ON HEADPHONES</b> — this prevents the backing track from bleeding into the vocal mic<br>
• Check the guitar track so it plays while you record<br>
• Hit Record and sing your first part<br>
• Use the <b>Nudge slider</b> if timing feels off → preview → then save<br>
• Repeat for each harmony part (2-4 parts)<br><br>
<b>Step 4: Mix & Pan</b><br>
• Pan guitar center (0), harmony 1 left (-60), harmony 2 right (+60), etc.<br>
• Adjust volumes so no part drowns the others<br>
• Try an effect preset (Room is nice for vocals)<br>
• Export when happy!<br><br>
<b>🔧 If tracks sound out of sync:</b><br>
Use the Nudge slider right after recording. +ms = later, -ms = earlier. Small adjustments (10-30ms) are normal. If ALL tracks drift, adjust the Sync offset.`
};
function mtHelp(k){return `<span class="mt-help-icon" onclick="event.stopPropagation();mtShowHelp('${k}')" title="${(mtTips[k]||'').replace(/<[^>]*>/g,'').replace(/'/g,'&#39;').substring(0,200)}">ⓘ</span>`;}
function mtShowHelp(k){
    document.getElementById('mtHelpPopup')?.remove();
    const d=document.createElement('div');d.id='mtHelpPopup';
    const isLong=(mtTips[k]||'').length>200;
    d.style.cssText=`position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e293b;color:white;padding:20px 24px;border-radius:12px;max-width:${isLong?'420':'320'}px;z-index:10000;box-shadow:0 20px 60px rgba(0,0,0,0.5);font-size:0.85em;line-height:1.6;max-height:80vh;overflow-y:auto;`;
    d.innerHTML=`<div style="margin-bottom:10px;font-weight:600">💡 Help</div><div>${mtTips[k]||'No help available.'}</div><button onclick="this.parentElement.remove()" style="margin-top:14px;background:#667eea;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;width:100%;font-weight:600">Got it</button>`;
    document.body.appendChild(d);
    setTimeout(()=>{document.addEventListener('click',function f(e){if(!d.contains(e.target)){d.remove();document.removeEventListener('click',f);}});},100);
}

// --- GUIDED TOUR ---
function mtGuidedTour(si){
    const steps=[
        {text:'🥁 <b>Metronome</b> — Set tempo and click Start. Visual dots flash on each beat.'},
        {text:'🎵 <b>Tracks</b> — All recorded parts with Solo/Mute, Volume, and Pan controls.'},
        {text:'⏱️ <b>Sync</b> — Compensate for audio delay. Calibrate for best results.'},
        {text:'🔴 <b>Record</b> — Capture your harmony. Toggle Pitch monitor and Karaoke mode.'},
        {text:'🎚️ <b>Effects</b> — Apply Warm, Bright, Room, or Hall reverb to the playback mix.'},
        {text:'💾 <b>Export</b> — Download mixed audio. Use Nudge slider after recording to align tracks.'}
    ];
    let cur=0;
    function show(){
        document.getElementById('mtTourOverlay')?.remove();
        if(cur>=steps.length){localStorage.setItem('deadcetera_tour_seen','true');return;}
        const o=document.createElement('div');o.id='mtTourOverlay';
        o.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
        o.innerHTML=`<div style="background:#1e293b;color:white;padding:24px;border-radius:12px;max-width:360px;text-align:center;">
            <div style="margin-bottom:12px;line-height:1.5">${steps[cur].text}</div>
            <div style="font-size:0.75em;color:rgba(255,255,255,0.35);margin-bottom:12px">Step ${cur+1} of ${steps.length}</div>
            <div style="display:flex;gap:8px;justify-content:center">
                <button onclick="document.getElementById('mtTourOverlay').remove();localStorage.setItem('deadcetera_tour_seen','true')" style="background:rgba(255,255,255,0.15);color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer">Skip</button>
                <button id="mtTourNext" style="background:#667eea;color:white;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-weight:600">Next →</button>
            </div></div>`;
        document.body.appendChild(o);
        document.getElementById('mtTourNext').onclick=()=>{cur++;show();};
    }
    show();
}

// ============================================================================
// MAIN STUDIO UI
// ============================================================================
function openMultiTrackStudio(songTitle, sectionIndex) {
    const container = document.getElementById('harmonyAudioFormContainer' + sectionIndex);
    if (!container) return;
    mtCurrentSectionIndex = sectionIndex;
    mtCurrentSongTitle = songTitle;
    const ss = songTitle.replace(/'/g, "\\'");
    mtLatencyMs = parseInt(localStorage.getItem('deadcetera_latency_ms') || '0');
    
    loadHarmonyAudioSnippets(songTitle, sectionIndex).then(async (snippets) => {
        const arr = toArray(snippets);
        let hasAbc = false;
        try { const abc = await loadABCNotation(songTitle, sectionIndex); hasAbc = abc && abc.length > 0; } catch(e){}
        const tourSeen = localStorage.getItem('deadcetera_tour_seen') === 'true';
        
        container.innerHTML = `
<div id="mtStudio_${sectionIndex}" style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:16px;border-radius:12px;margin-top:12px;color:white;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <h3 style="margin:0;font-size:1.1em">🎛️ Multi-Track Studio</h3>
    <div style="display:flex;gap:5px">
        ${!tourSeen?`<button onclick="mtGuidedTour(${sectionIndex})" style="background:rgba(102,126,234,0.25);color:#a5b4fc;border:1px solid rgba(102,126,234,0.3);padding:4px 8px;border-radius:5px;cursor:pointer;font-size:0.75em">📖 Tour</button>`:''}
        <button onclick="closeMultiTrackStudio(${sectionIndex})" style="background:rgba(255,255,255,0.1);color:white;border:none;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.85em">✕</button>
    </div>
</div>

${hasAbc?`
<div style="background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <strong style="font-size:0.85em">🎤 Karaoke ${mtHelp('karaoke')}</strong>
        <button id="mtKaraokeBtn_${sectionIndex}" onclick="mtToggleKaraoke('${ss}',${sectionIndex})" style="background:#8b5cf6;color:white;border:none;padding:5px 12px;border-radius:5px;cursor:pointer;font-size:0.8em;font-weight:600">🎤 Start</button>
    </div>
    <div id="mtKaraokeSheet_${sectionIndex}" style="background:white;border-radius:8px;padding:12px;display:none;max-height:50vh;overflow-y:auto;resize:vertical;min-height:120px"></div>
    <div id="mtKaraokeLyrics_${sectionIndex}" style="display:none;margin-top:6px;text-align:center;font-size:1.2em;font-weight:600;color:#fbbf24;min-height:36px"></div>
</div>`:''}

<div id="mtPitchSection_${sectionIndex}" style="display:none;background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:0.85em">🎵 Pitch ${mtHelp('pitch')}</strong>
        <div style="display:flex;align-items:center;gap:10px">
            <div id="mtPitchNote_${sectionIndex}" style="font-size:1.6em;font-weight:700;font-family:monospace;min-width:50px;text-align:center">—</div>
            <div id="mtPitchCents_${sectionIndex}" style="font-size:0.8em;min-width:45px;text-align:center;color:rgba(255,255,255,0.5)">—</div>
        </div>
    </div>
    <div style="margin-top:5px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;position:relative;overflow:hidden">
        <div id="mtPitchBar_${sectionIndex}" style="position:absolute;top:0;width:4px;height:100%;background:#10b981;left:50%;transition:left 0.1s;border-radius:2px"></div>
        <div style="position:absolute;top:0;left:50%;width:1px;height:100%;background:rgba(255,255,255,0.2)"></div>
    </div>
</div>

<div style="background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:5px;margin-bottom:6px">
        <strong style="font-size:0.85em">🥁 Metronome ${mtHelp('metronome')}</strong>
        <div style="display:flex;align-items:center;gap:5px">
            <button onclick="mtAdjustBPM(${sectionIndex},-5)" style="background:rgba(255,255,255,0.1);color:white;border:none;width:24px;height:24px;border-radius:50%;cursor:pointer">−</button>
            <input id="mtBPM_${sectionIndex}" type="number" value="${getBPMForSong()}" min="40" max="240" style="width:46px;text-align:center;background:rgba(255,255,255,0.1);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:4px;padding:3px;font-size:1em;font-weight:700" onchange="if(mtMetronomeInterval){mtStopMetronome();mtStartMetronome(${sectionIndex})}">
            <button onclick="mtAdjustBPM(${sectionIndex},5)" style="background:rgba(255,255,255,0.1);color:white;border:none;width:24px;height:24px;border-radius:50%;cursor:pointer">+</button>
            <span style="font-size:0.7em;color:rgba(255,255,255,0.35)">BPM</span>
            <button id="mtMetronomeToggle_${sectionIndex}" onclick="mtToggleMetronome(${sectionIndex})" style="background:#667eea;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-weight:600;font-size:0.8em">▶ Start</button>
        </div>
    </div>
    <div id="mtBeatVisual_${sectionIndex}" style="display:flex;gap:5px;justify-content:center">${[0,1,2,3].map(i=>`<div class="mt-beat" data-beat="${i}" style="width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.1);transition:all 0.05s"></div>`).join('')}</div>
</div>

<div style="background:rgba(255,255,255,0.06);padding:10px;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:5px">
        <strong style="font-size:0.85em">🎵 Tracks ${mtHelp('tracks')}</strong>
        <div style="display:flex;gap:5px;align-items:center">
            <label style="display:flex;align-items:center;gap:3px;font-size:0.7em;color:rgba(255,255,255,0.4);cursor:pointer">
                <input type="checkbox" id="mtLoop_${sectionIndex}" onchange="mtLooping=this.checked" style="accent-color:#667eea"> Loop
            </label>
            <button onclick="mtPlayAllTracks('${ss}',${sectionIndex})" style="background:#10b981;color:white;border:none;padding:5px 12px;border-radius:5px;cursor:pointer;font-weight:600;font-size:0.8em">▶ Play Mix</button>
            <button onclick="mtStopAllTracks()" style="background:rgba(255,255,255,0.1);color:white;border:none;padding:5px 12px;border-radius:5px;cursor:pointer;font-size:0.8em">⏹ Stop</button>
            <button onclick="mtExportMix('${ss}',${sectionIndex})" title="Export mix" style="background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15);padding:5px 8px;border-radius:5px;cursor:pointer;font-size:0.75em">💾</button>
        </div>
    </div>
    ${arr.length>0?`<div style="display:flex;align-items:center;gap:5px;padding:0 8px;font-size:0.6em;color:rgba(255,255,255,0.25);text-transform:uppercase;letter-spacing:0.4px">
        <span style="width:14px"></span><span style="flex:1">Track</span><span style="width:24px;text-align:center">S</span><span style="width:24px;text-align:center">M</span><span style="width:52px;text-align:center">Vol</span><span style="width:48px;text-align:center">Pan</span><span style="width:14px"></span>
    </div>`:''}
    <div id="mtTracksList_${sectionIndex}">${arr.length>0?arr.map((s,i)=>mtRenderTrackRow(sectionIndex,s,i)).join(''):`<div style="text-align:center;padding:12px;color:rgba(255,255,255,0.3);font-size:0.8em">No tracks yet — record the first one!</div>`}</div>
    <canvas id="mtWaveformCanvas_${sectionIndex}" width="600" height="50" style="width:100%;height:50px;border-radius:5px;background:rgba(0,0,0,0.15);margin-top:6px;display:none"></canvas>
</div>

<div style="background:rgba(255,255,255,0.06);padding:8px 10px;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:5px">
        <div><strong style="font-size:0.8em">⏱️ Sync ${mtHelp('latency')}</strong> <span class="mt-help-icon" onclick="event.stopPropagation();mtShowHelp('workflow')" title="Recording workflow guide" style="background:rgba(102,126,234,0.2);color:#a5b4fc;border-color:rgba(102,126,234,0.3)">📋</span>
            <div id="mtLatencyInfo_${sectionIndex}" style="font-size:0.65em;color:rgba(255,255,255,0.3)"><span id="mtDetectedLatency_${sectionIndex}">measuring...</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
            <button onclick="mtAutoDetectLatency(${sectionIndex})" title="Auto-detect" style="background:rgba(255,255,255,0.06);color:white;border:1px solid rgba(255,255,255,0.12);padding:3px 7px;border-radius:4px;cursor:pointer;font-size:0.7em">🔍</button>
            <button onclick="mtCalibrateLatency(${sectionIndex})" title="Calibrate" style="background:rgba(255,255,255,0.06);color:white;border:1px solid rgba(255,255,255,0.12);padding:3px 7px;border-radius:4px;cursor:pointer;font-size:0.7em">🎯</button>
            <button onclick="mtAdjustLatency(-10)" style="background:rgba(255,255,255,0.06);color:white;border:none;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:0.7em">−</button>
            <input id="mtLatency_${sectionIndex}" type="number" value="${mtLatencyMs}" step="10" style="width:38px;text-align:center;background:rgba(255,255,255,0.06);color:white;border:1px solid rgba(255,255,255,0.15);border-radius:3px;padding:2px;font-size:0.75em" onchange="mtLatencyMs=parseInt(this.value)||0;localStorage.setItem('deadcetera_latency_ms',mtLatencyMs)">
            <button onclick="mtAdjustLatency(10)" style="background:rgba(255,255,255,0.06);color:white;border:none;width:18px;height:18px;border-radius:50%;cursor:pointer;font-size:0.7em">+</button>
            <span style="font-size:0.6em;color:rgba(255,255,255,0.25)">ms</span>
        </div>
    </div>
    <div id="mtCalibrationStatus_${sectionIndex}" style="display:none;margin-top:4px;font-size:0.7em;padding:5px;background:rgba(255,255,255,0.03);border-radius:4px"></div>
</div>

<div style="background:rgba(255,255,255,0.06);padding:8px 10px;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
        <strong style="font-size:0.8em">🎚️ Effects ${mtHelp('effects')}</strong>
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">${['none|🔇 Dry','warm|🔥 Warm','bright|✨ Bright','room|🏠 Room','hall|🏛️ Hall'].map(p=>{const[k,l]=p.split('|');return`<button onclick="mtApplyEffect('${k}',${sectionIndex})" class="mt-fx-btn" data-fx="${k}" style="background:${k==='none'?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.05)'};color:${k==='none'?'white':'rgba(255,255,255,0.6)'};border:1px solid ${k==='none'?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.08)'};padding:4px 9px;border-radius:12px;cursor:pointer;font-size:0.7em">${l}</button>`;}).join('')}</div>
</div>

<div id="mtRecordSection_${sectionIndex}" style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);padding:10px;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div id="mtRecordStatus_${sectionIndex}" style="font-size:0.75em;color:rgba(255,255,255,0.45)">Ready to record ${mtHelp('record')}</div>
        <div id="mtRecordTimer_${sectionIndex}" style="font-size:1.8em;font-weight:700;font-family:monospace;display:none">0:00</div>
        <div style="display:flex;gap:6px">
            <button id="mtRecordBtn_${sectionIndex}" onclick="mtStartRecording('${ss}',${sectionIndex})" style="background:#ef4444;color:white;border:none;padding:9px 20px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.95em;display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;background:white;border-radius:50%;display:inline-block"></span> Record</button>
            <button id="mtStopBtn_${sectionIndex}" onclick="mtStopRecording(${sectionIndex})" style="background:white;color:#ef4444;border:none;padding:9px 20px;border-radius:20px;cursor:pointer;font-weight:600;display:none">⏹️ Stop</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">${[
            [`mtCountIn_${sectionIndex}`,'checked','Count-in','countIn'],
            [`mtMetronomeDuringRec_${sectionIndex}`,'','Click','clickDuring'],
            [`mtShowPitch_${sectionIndex}`,'','Pitch','pitch']
        ].map(([id,chk,label,hk])=>`<label style="display:flex;align-items:center;gap:3px;font-size:0.7em;color:rgba(255,255,255,0.4);cursor:pointer"><input type="checkbox" id="${id}" ${chk} ${id.includes('Pitch')?`onchange="mtTogglePitchMonitor(${sectionIndex},this.checked)"`:''} style="accent-color:#667eea"> ${label} ${mtHelp(hk)}</label>`).join('')}</div>
    </div>
</div>

<div id="mtNudgeSection_${sectionIndex}" style="display:none"></div>
<div id="mtPreviewSection_${sectionIndex}" style="display:none"></div>
</div>`;
        
        setTimeout(()=>mtAutoDetectLatency(sectionIndex), 300);
        if(!tourSeen) setTimeout(()=>mtGuidedTour(sectionIndex), 800);
    });
}

// ============================================================================
// TRACK ROW with Pan
// ============================================================================
function mtRenderTrackRow(si, snippet, i) {
    const nm = snippet.name||'Rec '+(i+1), who = bandMembers[snippet.uploadedBy]?.name || snippet.uploadedBy || '';
    const ss = (mtCurrentSongTitle||'').replace(/'/g, "\\'");
    return `<div id="mtTrackRow_${si}_${i}" style="display:flex;align-items:center;gap:4px;padding:5px 6px;background:rgba(255,255,255,0.03);border-radius:5px;margin-bottom:3px">
        <input type="checkbox" id="mtTrack_${si}_${i}" checked style="width:14px;height:14px;accent-color:#667eea;flex-shrink:0">
        <div style="flex:1;min-width:0"><div style="font-size:0.75em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nm}</div><div style="font-size:0.6em;color:rgba(255,255,255,0.25)">${who}</div></div>
        <button id="mtSolo_${si}_${i}" data-active="false" onclick="mtToggleSolo(${si},${i})" style="background:rgba(255,255,255,0.06);color:#fbbf24;border:1px solid rgba(251,191,36,0.15);width:22px;height:22px;border-radius:3px;cursor:pointer;font-size:0.6em;font-weight:700;flex-shrink:0">S</button>
        <button id="mtMute_${si}_${i}" onclick="mtToggleMute(${si},${i})" style="background:rgba(255,255,255,0.06);color:#ef4444;border:1px solid rgba(239,68,68,0.15);width:22px;height:22px;border-radius:3px;cursor:pointer;font-size:0.6em;font-weight:700;flex-shrink:0">M</button>
        <input type="range" id="mtVol_${si}_${i}" min="0" max="100" value="80" oninput="mtUpdateVolume(${si},${i},this.value)" title="Volume" style="width:48px;accent-color:#667eea;flex-shrink:0">
        <input type="range" id="mtPan_${si}_${i}" min="-100" max="100" value="0" oninput="mtUpdatePan(${si},${i},this.value)" title="Pan L↔R" style="width:42px;accent-color:#8b5cf6;flex-shrink:0">
        <span id="mtPanLabel_${si}_${i}" style="font-size:0.55em;color:rgba(255,255,255,0.25);width:14px;text-align:center;flex-shrink:0">C</span>
        <button onclick="mtDeleteTrack('${ss}',${si},${i})" title="Delete track" style="background:none;border:none;color:rgba(255,255,255,0.25);cursor:pointer;font-size:0.75em;flex-shrink:0;padding:2px">🗑</button>
    </div>`;
}

async function mtDeleteTrack(songTitle, si, trackIndex) {
    if (!confirm('Delete this recording? This cannot be undone.')) return;
    try {
        const key = `harmony_audio_section_${si}`;
        const existing = toArray(await loadBandDataFromDrive(songTitle, key));
        if (trackIndex >= 0 && trackIndex < existing.length) {
            const removed = existing.splice(trackIndex, 1);
            await saveBandDataToDrive(songTitle, key, existing);
            const localKey = `deadcetera_harmony_audio_${songTitle}_section${si}`;
            localStorage.setItem(localKey, JSON.stringify(existing));
            logActivity('harmony_delete', { song: songTitle, extra: `section ${si}: ${removed[0]?.name || 'track ' + trackIndex}` });
            openMultiTrackStudio(songTitle, si); // Refresh
        }
    } catch (e) { alert('Delete failed: ' + e.message); }
}

function closeMultiTrackStudio(si){
    mtStopMetronome();mtStopAllTracks();mtStopPitchMonitor();
    if(mtIsRecording)mtStopRecording(si);mtLooping=false;
    const c=document.getElementById('harmonyAudioFormContainer'+si);if(c)c.innerHTML='';
}
function getBPMForSong(){const b=document.getElementById('songBpmInput');return(b&&b.value)?parseInt(b.value)||120:120;}

// ============================================================================
// METRONOME
// ============================================================================
function mtToggleMetronome(si){
    const btn=document.getElementById(`mtMetronomeToggle_${si}`);
    if(mtMetronomeInterval){mtStopMetronome();if(btn){btn.textContent='▶ Start';btn.style.background='#667eea';}}
    else{mtStartMetronome(si);if(btn){btn.textContent='⏸ Stop';btn.style.background='#ef4444';btn.style.color='white';}}
}
function mtStartMetronome(si){
    if(!mtAudioContext)mtAudioContext=new(window.AudioContext||window.webkitAudioContext)();mtAudioContext.resume();
    const bpm=parseInt(document.getElementById(`mtBPM_${si}`)?.value)||120,intv=60/bpm;
    const beats=document.querySelectorAll(`#mtBeatVisual_${si} .mt-beat`);
    let next=mtAudioContext.currentTime+0.05,b=0;
    function sched(){
        const o=mtAudioContext.createOscillator(),g=mtAudioContext.createGain();
        o.connect(g);g.connect(mtAudioContext.destination);
        o.frequency.value=(b%4===0)?1000:700;g.gain.setValueAtTime(0.3,next);
        g.gain.exponentialRampToValueAtTime(0.001,next+0.08);o.start(next);o.stop(next+0.08);
        const cb=b%4,d=Math.max(0,(next-mtAudioContext.currentTime)*1000);
        setTimeout(()=>{beats.forEach((el,i)=>{el.style.background=i===cb?(cb===0?'#ef4444':'#667eea'):'rgba(255,255,255,0.1)';el.style.transform=i===cb?'scale(1.3)':'scale(1)';});},d);
        b++;next+=intv;
    }
    sched();
    mtMetronomeInterval=setInterval(()=>{while(next<mtAudioContext.currentTime+0.1)sched();},25);
}
function mtStopMetronome(){if(mtMetronomeInterval){clearInterval(mtMetronomeInterval);mtMetronomeInterval=null;}}
function mtAdjustBPM(si,d){const inp=document.getElementById(`mtBPM_${si}`);if(inp){inp.value=Math.max(40,Math.min(240,parseInt(inp.value)+d));if(mtMetronomeInterval){mtStopMetronome();mtStartMetronome(si);}}}

// ============================================================================
// LATENCY
// ============================================================================
function mtAdjustLatency(d){const inp=document.getElementById(`mtLatency_${mtCurrentSectionIndex}`);if(inp){mtLatencyMs=Math.max(-500,Math.min(500,parseInt(inp.value)+d));inp.value=mtLatencyMs;localStorage.setItem('deadcetera_latency_ms',mtLatencyMs);}}
function mtAutoDetectLatency(si){
    if(!mtAudioContext)mtAudioContext=new(window.AudioContext||window.webkitAudioContext)();
    let est=0;const p=[];
    if(mtAudioContext.outputLatency!==undefined){const m=Math.round(mtAudioContext.outputLatency*1000);p.push(`out:${m}ms`);est+=m;}
    if(mtAudioContext.baseLatency!==undefined){const m=Math.round(mtAudioContext.baseLatency*1000);p.push(`base:${m}ms`);est+=m;}
    if(est===0){est=50;p.push('est:~50ms');}
    const rt=Math.round(est*1.5);mtLatencyMs=rt;
    const inp=document.getElementById(`mtLatency_${si}`);if(inp)inp.value=mtLatencyMs;
    localStorage.setItem('deadcetera_latency_ms',mtLatencyMs);
    const info=document.getElementById(`mtDetectedLatency_${si}`);if(info)info.textContent=`${p.join(', ')} → ${rt}ms`;
}
async function mtCalibrateLatency(si){
    const st=document.getElementById(`mtCalibrationStatus_${si}`);if(!st)return;
    st.style.display='block';st.innerHTML='🎯 Turn up volume, stay quiet...';
    try{
        if(!mtAudioContext)mtAudioContext=new(window.AudioContext||window.webkitAudioContext)();await mtAudioContext.resume();
        // Request mic with echo cancellation OFF so it can hear the speaker
        const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
        const src=mtAudioContext.createMediaStreamSource(stream);
        const an=mtAudioContext.createAnalyser();an.fftSize=4096;an.smoothingTimeConstant=0;
        src.connect(an);
        const buf=new Float32Array(an.fftSize);
        
        // Sample the background noise level first
        await new Promise(r=>setTimeout(r,500));
        an.getFloatTimeDomainData(buf);
        let bgNoise=0;
        for(let i=0;i<buf.length;i++) bgNoise=Math.max(bgNoise,Math.abs(buf[i]));
        const threshold=Math.max(bgNoise*3, 0.02); // 3x background or min 0.02
        console.log('🎯 Calibration: bg noise='+bgNoise.toFixed(4)+', threshold='+threshold.toFixed(4));
        
        st.innerHTML='🔊 Playing click now...';
        await new Promise(r=>setTimeout(r,300));
        
        // Play a LOUDER, longer click
        const t0=performance.now();
        const o=mtAudioContext.createOscillator(),g=mtAudioContext.createGain();
        o.connect(g);g.connect(mtAudioContext.destination);
        o.frequency.value=880;
        g.gain.setValueAtTime(1.0,mtAudioContext.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001,mtAudioContext.currentTime+0.15);
        o.start();o.stop(mtAudioContext.currentTime+0.15);
        
        // Poll more aggressively with shorter intervals
        let det=false,t1=0;
        await new Promise(res=>{
            const pollInterval=setInterval(()=>{
                an.getFloatTimeDomainData(buf);
                let peak=0;
                for(let i=0;i<buf.length;i++) peak=Math.max(peak,Math.abs(buf[i]));
                if(peak>threshold&&!det){
                    det=true;t1=performance.now();
                    clearInterval(pollInterval);res();return;
                }
                if(performance.now()-t0>1000){clearInterval(pollInterval);res();return;}
            }, 5); // Poll every 5ms
        });
        
        stream.getTracks().forEach(t=>t.stop());src.disconnect();
        if(det){
            const rt=Math.round(t1-t0);mtLatencyMs=Math.round(rt/2);
            const inp=document.getElementById(`mtLatency_${si}`);if(inp)inp.value=mtLatencyMs;
            localStorage.setItem('deadcetera_latency_ms',mtLatencyMs);
            const info=document.getElementById(`mtDetectedLatency_${si}`);
            if(info)info.textContent=`Cal: RT ${rt}ms → ${mtLatencyMs}ms`;
            st.innerHTML=`✅ Round-trip: <b>${rt}ms</b> → offset: <b>${mtLatencyMs}ms</b>`;
        }else{
            st.innerHTML='⚠️ No click detected. Try: 1) Turn volume up more, 2) Make sure mic is near speakers, 3) Use wired headphones (not Bluetooth).';
        }
        setTimeout(()=>st.style.display='none',6000);
    }catch(e){st.innerHTML='❌ '+e.message;setTimeout(()=>st.style.display='none',3000);}
}

// ============================================================================
// SOLO / MUTE / VOLUME / PAN
// ============================================================================
function mtToggleSolo(si,ti){
    const btn=document.getElementById(`mtSolo_${si}_${ti}`),act=btn.dataset.active==='true';
    if(act){btn.dataset.active='false';btn.style.background='rgba(255,255,255,0.06)';
        document.querySelectorAll(`[id^="mtTrackRow_${si}_"]`).forEach(r=>r.style.opacity='1');
        document.querySelectorAll(`input[id^="mtTrack_${si}_"]`).forEach(c=>{if(c.type==='checkbox')c.checked=true;});
    }else{btn.dataset.active='true';btn.style.background='rgba(251,191,36,0.25)';
        document.querySelectorAll(`[id^="mtTrackRow_${si}_"]`).forEach((r,i)=>{
            const cb=document.getElementById(`mtTrack_${si}_${i}`);
            if(i===ti){if(cb)cb.checked=true;r.style.opacity='1';}
            else{if(cb)cb.checked=false;r.style.opacity='0.3';const s=document.getElementById(`mtSolo_${si}_${i}`);if(s){s.dataset.active='false';s.style.background='rgba(255,255,255,0.06)';}}
        });
    }
    if(mtIsPlaying)mtUpdateLiveVolumes(si);
}
function mtToggleMute(si,ti){
    const btn=document.getElementById(`mtMute_${si}_${ti}`),cb=document.getElementById(`mtTrack_${si}_${ti}`),row=document.getElementById(`mtTrackRow_${si}_${ti}`);
    if(cb.checked){cb.checked=false;btn.style.background='rgba(239,68,68,0.25)';if(row)row.style.opacity='0.3';}
    else{cb.checked=true;btn.style.background='rgba(255,255,255,0.06)';if(row)row.style.opacity='1';}
    if(mtIsPlaying)mtUpdateLiveVolumes(si);
}
function mtUpdateVolume(si,ti,val){if(mtIsPlaying&&mtPlaybackAudios[ti]?.audio){const cb=document.getElementById(`mtTrack_${si}_${ti}`);mtPlaybackAudios[ti].audio.volume=cb?.checked?val/100:0;}}
function mtUpdatePan(si,ti,val){
    const lbl=document.getElementById(`mtPanLabel_${si}_${ti}`),v=parseInt(val);
    if(lbl)lbl.textContent=v===0?'C':(v<0?'L':'R');
    if(mtIsPlaying&&mtPlaybackAudios[ti]?.panNode)mtPlaybackAudios[ti].panNode.pan.value=v/100;
}
function mtUpdateLiveVolumes(si){mtPlaybackAudios.forEach((item,i)=>{if(!item?.audio)return;const cb=document.getElementById(`mtTrack_${si}_${i}`),vol=document.getElementById(`mtVol_${si}_${i}`);item.audio.volume=(cb?.checked?(parseInt(vol?.value)||80):0)/100;});}

// ============================================================================
// RECORDING
// ============================================================================
async function mtStartRecording(songTitle, si) {
    try {
        if(!mtAudioContext)mtAudioContext=new(window.AudioContext||window.webkitAudioContext)();await mtAudioContext.resume();
        if(mtIsRecording)mtStopRecording(si);
        document.querySelectorAll('audio').forEach(a=>{a.pause();a.currentTime=0;});mtStopAllTracks();
        mtRecordingStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,sampleRate:44100}});
        let mime='audio/webm';
        if(MediaRecorder.isTypeSupported('audio/mp4'))mime='audio/mp4';
        else if(MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))mime='audio/webm;codecs=opus';
        mtRecorder=new MediaRecorder(mtRecordingStream,{mimeType:mime});mtAudioChunks=[];
        mtRecorder.ondataavailable=e=>{if(e.data.size>0)mtAudioChunks.push(e.data);};
        mtRecorder.onstop=async()=>{
            const blob=new Blob(mtAudioChunks,{type:mime});if(blob.size===0){alert('No audio captured');return;}
            const b64=await blobToBase64(blob);mtShowPreview(songTitle,si,b64,blob.size,mime);
            if(mtRecordingStream)mtRecordingStream.getTracks().forEach(t=>t.stop());mtIsRecording=false;mtStopPitchMonitor();
        };
        const statEl=document.getElementById(`mtRecordStatus_${si}`),timEl=document.getElementById(`mtRecordTimer_${si}`);
        const recBtn=document.getElementById(`mtRecordBtn_${si}`),stopBtn=document.getElementById(`mtStopBtn_${si}`);
        // Count-in: 2 measures (8 beats) with proper timing
        if(document.getElementById(`mtCountIn_${si}`)?.checked){
            const bpm=parseInt(document.getElementById(`mtBPM_${si}`)?.value)||120,beatMs=60000/bpm;
            const countBeats = [8,7,6,5,4,3,2,1]; // Two measures
            for(let idx=0;idx<countBeats.length;idx++){
                const beatNum=countBeats[idx];
                const isDownbeat=(idx%4===0);
                const displayNum=(idx%4)+1; // Show 1-2-3-4 1-2-3-4
                const measure=idx<4?1:2;
                statEl.innerHTML=`<span style="font-size:1.6em;font-weight:700;color:${measure===2?'#fbbf24':'rgba(255,255,255,0.5)'}">${measure===1?'●':''}${4-(idx%4)}</span><span style="font-size:0.7em;color:rgba(255,255,255,0.3);margin-left:6px">m${measure}</span>`;
                // Play click
                const o=mtAudioContext.createOscillator(),g=mtAudioContext.createGain();
                o.connect(g);g.connect(mtAudioContext.destination);
                o.frequency.value=isDownbeat?1200:900;
                g.gain.setValueAtTime(measure===2?0.5:0.3,mtAudioContext.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001,mtAudioContext.currentTime+0.1);
                o.start();o.stop(mtAudioContext.currentTime+0.1);
                // Flash beat dots
                const beats=document.querySelectorAll(`#mtBeatVisual_${si} .mt-beat`);
                const bi=idx%4;
                beats.forEach((el,j)=>{el.style.background=j===bi?(isDownbeat?'#ef4444':'#667eea'):'rgba(255,255,255,0.1)';el.style.transform=j===bi?'scale(1.3)':'scale(1)';});
                // Wait one full beat AFTER the click
                await new Promise(r=>setTimeout(r,beatMs));
            }
            // Reset beat dots
            document.querySelectorAll(`#mtBeatVisual_${si} .mt-beat`).forEach(el=>{el.style.background='rgba(255,255,255,0.1)';el.style.transform='scale(1)';});
        }
        const backD=Math.max(0,mtLatencyMs),recD=Math.max(0,-mtLatencyMs);
        setTimeout(()=>{mtRecorder.start();mtIsRecording=true;},recD);
        setTimeout(()=>mtStartBackingTracks(songTitle,si),backD);
        statEl.innerHTML='<span style="color:#ef4444" class="mt-pulse">🔴 RECORDING</span>';
        timEl.style.display='block';recBtn.style.display='none';stopBtn.style.display='inline-flex';
        let sec=0;const ti=setInterval(()=>{if(!mtIsRecording){clearInterval(ti);return;}sec++;if(timEl)timEl.textContent=formatTime(sec);},1000);
        stopBtn?.setAttribute('data-timer',ti);
        if(document.getElementById(`mtMetronomeDuringRec_${si}`)?.checked&&!mtMetronomeInterval)mtStartMetronome(si);
        if(document.getElementById(`mtShowPitch_${si}`)?.checked){document.getElementById(`mtPitchSection_${si}`).style.display='block';mtStartPitchMonitor(si);}
    }catch(e){let m='Microphone access denied.';if(e.name==='NotFoundError')m='No microphone found.';alert(m+'\n\n'+e.message);}
}
function mtStopRecording(si){
    if(mtRecorder?.state==='recording')mtRecorder.stop();mtIsRecording=false;mtStopAllTracks();mtStopPitchMonitor();
    if(document.getElementById(`mtMetronomeDuringRec_${si}`)?.checked)mtStopMetronome();
    const stopBtn=document.getElementById(`mtStopBtn_${si}`);if(stopBtn){const t=stopBtn.getAttribute('data-timer');if(t)clearInterval(parseInt(t));}
    document.getElementById(`mtRecordBtn_${si}`).style.display='inline-flex';
    if(stopBtn)stopBtn.style.display='none';
}

// ============================================================================
// PLAYBACK with Pan via Web Audio API
// ============================================================================
async function mtStartBackingTracks(songTitle,si){mtStopAllTracks();const sn=toArray(await loadHarmonyAudioSnippets(songTitle,si));mtPlaybackAudios=[];
    if(!mtAudioContext)mtAudioContext=new(window.AudioContext||window.webkitAudioContext)();await mtAudioContext.resume();
    for(let i=0;i<sn.length;i++){const cb=document.getElementById(`mtTrack_${si}_${i}`),vol=document.getElementById(`mtVol_${si}_${i}`);
        if(sn[i].data){const a=new Audio(sn[i].data);a.volume=(cb?.checked?(parseInt(vol?.value)||80):0)/100;
            let panNode=null,nodes=[];
            try{
                const src=mtAudioContext.createMediaElementSource(a);
                panNode=mtAudioContext.createStereoPanner();
                const pv=document.getElementById(`mtPan_${si}_${i}`);panNode.pan.value=(parseInt(pv?.value)||0)/100;
                // Chain: src → pan → effects → destination
                src.connect(panNode);
                nodes=mtConnectEffectChain(mtAudioContext, panNode);
            }catch(e){console.warn('Backing audio chain error:',e);}
            mtPlaybackAudios.push({audio:a,index:i,panNode,nodes});
            if(cb?.checked)a.play().catch(e=>console.warn('Backing:',e));
        }else{mtPlaybackAudios.push({audio:null,index:i,panNode:null,nodes:[]});}}
    mtIsPlaying=true;
}

async function mtPlayAllTracks(songTitle,si){
    mtStopAllTracks();const sn=toArray(await loadHarmonyAudioSnippets(songTitle,si));mtPlaybackAudios=[];
    if(!mtAudioContext)mtAudioContext=new(window.AudioContext||window.webkitAudioContext)();await mtAudioContext.resume();
    for(let i=0;i<sn.length;i++){const cb=document.getElementById(`mtTrack_${si}_${i}`),vol=document.getElementById(`mtVol_${si}_${i}`);
        if(sn[i].data){const a=new Audio(sn[i].data);a.volume=(cb?.checked?(parseInt(vol?.value)||80):0)/100;
            let panNode=null,nodes=[];
            try{
                const src=mtAudioContext.createMediaElementSource(a);
                panNode=mtAudioContext.createStereoPanner();
                const pv=document.getElementById(`mtPan_${si}_${i}`);panNode.pan.value=(parseInt(pv?.value)||0)/100;
                // Chain: src → pan → effects → destination
                src.connect(panNode);
                nodes=mtConnectEffectChain(mtAudioContext, panNode);
            }catch(e){console.warn('Play audio chain error:',e);}
            mtPlaybackAudios.push({audio:a,index:i,panNode,nodes});
            if(cb?.checked)a.play().catch(e=>console.warn('Play:',e));
        }else{mtPlaybackAudios.push({audio:null,index:i,panNode:null,nodes:[]});}}
    mtIsPlaying=true;
    // Loop support
    if(mtLooping){const first=mtPlaybackAudios.find(it=>it.audio&&document.getElementById(`mtTrack_${si}_${it.index}`)?.checked);
        if(first)first.audio.onended=()=>{if(mtLooping&&mtIsPlaying){console.log('🔁 Looping...');mtPlayAllTracks(songTitle,si);}};}
    // Draw waveforms
    mtDrawAllWaveforms(songTitle,si);
}
function mtStopAllTracks(){
    mtPlaybackAudios.forEach(it=>{
        if(it?.audio){it.audio.pause();it.audio.currentTime=0;it.audio.onended=null;}
        if(it?.nodes)it.nodes.forEach(n=>{try{n.disconnect();}catch(e){}});
    });
    mtPlaybackAudios=[];mtIsPlaying=false;
}

// ============================================================================
// EFFECTS (Web Audio preset chains applied during playback)
// ============================================================================
let mtEffectNodes = [];
function mtApplyEffect(name,si){
    mtCurrentEffect=name;
    document.querySelectorAll('.mt-fx-btn').forEach(b=>{const active=b.dataset.fx===name;
        b.style.background=active?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.05)';
        b.style.color=active?'white':'rgba(255,255,255,0.6)';
        b.style.borderColor=active?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.08)';
    });
    // If currently playing, restart playback to apply new effect
    if(mtIsPlaying && mtCurrentSongTitle){
        const ss = mtCurrentSongTitle;
        mtPlayAllTracks(ss, si);
    }
}

// Connects sourceNode through the current effect chain to destination.
// Returns array of created nodes for cleanup.
function mtConnectEffectChain(ctx, sourceNode) {
    const nodes = [];
    
    if (mtCurrentEffect === 'none' || !mtCurrentEffect) {
        sourceNode.connect(ctx.destination);
        return nodes;
    }
    
    let lastNode = sourceNode;
    
    if (mtCurrentEffect === 'warm') {
        const eq = ctx.createBiquadFilter(); eq.type = 'lowshelf'; eq.frequency.value = 300; eq.gain.value = 4;
        const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
        lastNode.connect(eq); eq.connect(comp); lastNode = comp; nodes.push(eq, comp);
    } else if (mtCurrentEffect === 'bright') {
        const eq = ctx.createBiquadFilter(); eq.type = 'highshelf'; eq.frequency.value = 3000; eq.gain.value = 5;
        const eq2 = ctx.createBiquadFilter(); eq2.type = 'peaking'; eq2.frequency.value = 6000; eq2.gain.value = 3; eq2.Q.value = 1;
        lastNode.connect(eq); eq.connect(eq2); lastNode = eq2; nodes.push(eq, eq2);
    } else if (mtCurrentEffect === 'room' || mtCurrentEffect === 'hall') {
        const isHall = mtCurrentEffect === 'hall';
        const delay1 = ctx.createDelay(); delay1.delayTime.value = isHall ? 0.08 : 0.03;
        const gain1 = ctx.createGain(); gain1.gain.value = isHall ? 0.4 : 0.3;
        const delay2 = ctx.createDelay(); delay2.delayTime.value = isHall ? 0.15 : 0.06;
        const gain2 = ctx.createGain(); gain2.gain.value = isHall ? 0.3 : 0.2;
        const delay3 = ctx.createDelay(); delay3.delayTime.value = isHall ? 0.25 : 0.1;
        const gain3 = ctx.createGain(); gain3.gain.value = isHall ? 0.2 : 0.1;
        const dry = ctx.createGain(); dry.gain.value = isHall ? 0.7 : 0.8;
        const merger = ctx.createGain();
        lastNode.connect(dry); dry.connect(merger);
        lastNode.connect(delay1); delay1.connect(gain1); gain1.connect(merger);
        lastNode.connect(delay2); delay2.connect(gain2); gain2.connect(merger);
        lastNode.connect(delay3); delay3.connect(gain3); gain3.connect(merger);
        // Feedback for hall
        if(isHall){ const fb=ctx.createGain();fb.gain.value=0.15;gain1.connect(fb);fb.connect(delay2);nodes.push(fb); }
        lastNode = merger; nodes.push(delay1, gain1, delay2, gain2, delay3, gain3, dry, merger);
    }
    
    lastNode.connect(ctx.destination);
    return nodes;
}

// ============================================================================
// PITCH DETECTION (autocorrelation)
// ============================================================================
const mtNoteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function mtFreqToNote(freq) {
    if (!freq || freq < 50 || freq > 2000) return null;
    const noteNum = 12 * (Math.log2(freq / 440)) + 69;
    const rounded = Math.round(noteNum);
    const cents = Math.round((noteNum - rounded) * 100);
    const name = mtNoteNames[rounded % 12];
    const octave = Math.floor(rounded / 12) - 1;
    return { name, octave, cents, noteNum: rounded };
}

function mtAutoCorrelate(buf, sampleRate) {
    let SIZE = buf.length, rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // Too quiet

    let r1 = 0, r2 = SIZE - 1;
    const thresh = 0.2;
    for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < thresh) { r1 = i; break; } }
    for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < thresh) { r2 = SIZE - i; break; } }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;
    const c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE - i; j++) c[i] += buf[j] * buf[j + i];

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }

    let T0 = maxpos;
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 -= b / (2 * a);
    return sampleRate / T0;
}

function mtStartPitchMonitor(si) {
    if (!mtAudioContext) mtAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const source = mtAudioContext.createMediaStreamSource(stream);
        const analyser = mtAudioContext.createAnalyser();
        analyser.fftSize = 4096;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        
        function update() {
            analyser.getFloatTimeDomainData(buf);
            const freq = mtAutoCorrelate(buf, mtAudioContext.sampleRate);
            const noteEl = document.getElementById(`mtPitchNote_${si}`);
            const centsEl = document.getElementById(`mtPitchCents_${si}`);
            const barEl = document.getElementById(`mtPitchBar_${si}`);
            
            if (freq > 0) {
                const note = mtFreqToNote(freq);
                if (note && noteEl) {
                    noteEl.textContent = note.name + note.octave;
                    noteEl.style.color = Math.abs(note.cents) < 10 ? '#10b981' : Math.abs(note.cents) < 25 ? '#fbbf24' : '#ef4444';
                    if (centsEl) centsEl.textContent = (note.cents >= 0 ? '+' : '') + note.cents + '¢';
                    if (barEl) barEl.style.left = (50 + note.cents * 0.4) + '%';
                }
            } else {
                if (noteEl) { noteEl.textContent = '—'; noteEl.style.color = 'white'; }
                if (centsEl) centsEl.textContent = '—';
                if (barEl) barEl.style.left = '50%';
            }
            mtPitchAnimFrame = requestAnimationFrame(update);
        }
        update();
        
        // Store stream for cleanup
        mtStartPitchMonitor._stream = stream;
        mtStartPitchMonitor._source = source;
    }).catch(e => console.warn('Pitch monitor:', e));
}

function mtStopPitchMonitor() {
    if (mtPitchAnimFrame) { cancelAnimationFrame(mtPitchAnimFrame); mtPitchAnimFrame = null; }
    if (mtStartPitchMonitor._stream) { mtStartPitchMonitor._stream.getTracks().forEach(t => t.stop()); mtStartPitchMonitor._stream = null; }
}

function mtTogglePitchMonitor(si, on) {
    const sec = document.getElementById(`mtPitchSection_${si}`);
    if (sec) sec.style.display = on ? 'block' : 'none';
    if (!on) mtStopPitchMonitor();
}

// ============================================================================
// KARAOKE MODE (ABC cursor + lyrics)
// ============================================================================
async function mtToggleKaraoke(songTitle, si) {
    const sheetEl = document.getElementById(`mtKaraokeSheet_${si}`);
    const lyricsEl = document.getElementById(`mtKaraokeLyrics_${si}`);
    const btn = document.getElementById(`mtKaraokeBtn_${si}`);
    
    if (sheetEl.style.display !== 'none') {
        mtStopKaraoke(si);
        return;
    }
    
    btn.textContent = '⏳ Loading...';
    
    try {
        const abc = await loadABCNotation(songTitle, si);
        if (!abc) { btn.textContent = '🎤 Start'; alert('No ABC notation for this section.'); return; }
        
        // Load abcjs if needed
        if (typeof ABCJS === 'undefined') {
            await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/dist/abcjs-basic-min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        }
        
        // CRITICAL: Load abcjs-audio CSS BEFORE creating synth controller
        if (!document.getElementById('abcjs-audio-css')) {
            const cssLink = document.createElement('link');
            cssLink.id = 'abcjs-audio-css';
            cssLink.rel = 'stylesheet';
            cssLink.href = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/abcjs-audio.css';
            document.head.appendChild(cssLink);
            // Wait for CSS to load
            await new Promise(r => { cssLink.onload = r; setTimeout(r, 1000); });
        }
        
        // Add karaoke highlight styles
        if (!document.getElementById('mt-karaoke-css')) {
            const style = document.createElement('style');
            style.id = 'mt-karaoke-css';
            style.textContent = `
                .abcjs-highlight{fill:#667eea !important;stroke:#667eea !important;}
                #mtKaraokeSheet_${si} .abcjs-cursor{stroke:#ef4444;stroke-width:2;opacity:0.8;}
            `;
            document.head.appendChild(style);
        }
        
        sheetEl.style.display = 'block';
        lyricsEl.style.display = 'block';
        
        // Extract lyrics from ABC for display
        const lyricLines = abc.split('\n').filter(l => l.startsWith('w:')).map(l => l.substring(2).trim());
        const lyricWords = lyricLines.join(' ').split(/\s+/).filter(w => w && w !== '|' && w !== '-');
        let currentWordIndex = 0;
        
        // Create audio controls container FIRST
        const audioContainerId = `mtKaraokeAudio_${si}`;
        
        // Render ABC
        sheetEl.innerHTML = ''; // Clear
        const sheetDiv = document.createElement('div');
        sheetDiv.id = `mtKaraokeSheetInner_${si}`;
        sheetEl.appendChild(sheetDiv);
        
        const audioDiv = document.createElement('div');
        audioDiv.id = audioContainerId;
        audioDiv.style.cssText = 'margin-top:8px;';
        sheetEl.appendChild(audioDiv);
        
        const visualObj = ABCJS.renderAbc(`mtKaraokeSheetInner_${si}`, abc, {
            responsive: 'resize', staffwidth: 480, scale: 0.85,
            wrap: { minSpacing: 1.8, maxSpacing: 2.7, preferredMeasuresPerLine: 4 },
            add_classes: true
        })[0];
        
        // Create cursor line in SVG
        const svgEl = sheetDiv.querySelector('svg');
        if (svgEl) {
            const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            cursor.setAttribute('class', 'abcjs-cursor');
            cursor.setAttribute('x1', 0); cursor.setAttribute('x2', 0);
            cursor.setAttribute('y1', 0); cursor.setAttribute('y2', 0);
            svgEl.appendChild(cursor);
        }
        
        // Cursor control callbacks
        const cursorControl = {
            beatSubdivisions: 2,
            onEvent: function(ev) {
                // Move cursor line
                if (ev && svgEl) {
                    const cursor = svgEl.querySelector('.abcjs-cursor');
                    if (cursor) {
                        cursor.setAttribute('x1', ev.left - 2);
                        cursor.setAttribute('x2', ev.left - 2);
                        cursor.setAttribute('y1', ev.top);
                        cursor.setAttribute('y2', ev.top + ev.height);
                    }
                }
                // Highlight notes
                document.querySelectorAll(`#mtKaraokeSheetInner_${si} svg .abcjs-highlight`).forEach(el => el.classList.remove('abcjs-highlight'));
                if (ev && ev.elements) {
                    ev.elements.forEach(els => els.forEach(el => el.classList.add('abcjs-highlight')));
                }
                // Update lyrics
                if (lyricsEl && lyricWords.length > 0 && ev && ev.elements) {
                    if (currentWordIndex < lyricWords.length) {
                        const word = lyricWords[currentWordIndex] || '';
                        lyricsEl.innerHTML = lyricWords.slice(Math.max(0, currentWordIndex - 2), currentWordIndex).map(w => `<span style="color:rgba(255,255,255,0.3)">${w} </span>`).join('') +
                            `<span style="color:#fbbf24;font-size:1.3em">${word}</span>` +
                            lyricWords.slice(currentWordIndex + 1, currentWordIndex + 4).map(w => `<span style="color:rgba(255,255,255,0.3)"> ${w}</span>`).join('');
                        currentWordIndex++;
                    }
                }
            },
            onFinished: function() {
                document.querySelectorAll(`#mtKaraokeSheetInner_${si} svg .abcjs-highlight`).forEach(el => el.classList.remove('abcjs-highlight'));
                if (lyricsEl) lyricsEl.innerHTML = '<span style="color:rgba(255,255,255,0.4)">🎤 Finished!</span>';
                currentWordIndex = 0;
            }
        };
        
        // iOS AudioContext fix
        if (!window._deadceteraAudioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            window._deadceteraAudioCtx = new AudioCtx();
        }
        if (window._deadceteraAudioCtx.state === 'suspended') {
            await window._deadceteraAudioCtx.resume();
        }
        
        // Set up synth controller
        const synthControl = new ABCJS.synth.SynthController();
        synthControl.load(`#${audioContainerId}`, cursorControl, {
            displayLoop: true, displayRestart: true, displayPlay: true, displayProgress: true
        });
        
        await synthControl.setTune(visualObj, false, { chordsOff: true });
        
        btn.textContent = '⏹ Stop Karaoke';
        btn.onclick = () => mtStopKaraoke(si);
        window._mtKaraokeSynth = synthControl;
        
        if (lyricsEl) lyricsEl.innerHTML = '<span style="color:rgba(255,255,255,0.4)">Press ▶ Play above to start karaoke</span>';
        
    } catch (e) {
        console.error('Karaoke error:', e);
        btn.textContent = '🎤 Start';
        alert('Could not start karaoke: ' + e.message);
    }
}

function mtStopKaraoke(si) {
    const sheetEl = document.getElementById(`mtKaraokeSheet_${si}`);
    const lyricsEl = document.getElementById(`mtKaraokeLyrics_${si}`);
    const btn = document.getElementById(`mtKaraokeBtn_${si}`);
    if (sheetEl) sheetEl.style.display = 'none';
    if (lyricsEl) lyricsEl.style.display = 'none';
    if (btn) { btn.textContent = '🎤 Start'; btn.onclick = () => mtToggleKaraoke(mtCurrentSongTitle, si); }
    if (window._mtKaraokeSynth) { try { window._mtKaraokeSynth.pause(); } catch(e){} }
}

// ============================================================================
// WAVEFORM VISUALIZATION
// ============================================================================
async function mtDrawAllWaveforms(songTitle, si) {
    const canvas = document.getElementById(`mtWaveformCanvas_${si}`);
    if (!canvas) return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    const snippets = toArray(await loadHarmonyAudioSnippets(songTitle, si));
    const colors = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    for (let i = 0; i < snippets.length; i++) {
        const cb = document.getElementById(`mtTrack_${si}_${i}`);
        if (!cb?.checked || !snippets[i].data) continue;
        
        try {
            if (!mtAudioContext) mtAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const response = await fetch(snippets[i].data);
            const arrayBuf = await response.arrayBuffer();
            const audioBuf = await mtAudioContext.decodeAudioData(arrayBuf);
            const data = audioBuf.getChannelData(0);
            
            const step = Math.floor(data.length / w);
            const color = colors[i % colors.length];
            const trackH = h / Math.min(snippets.length, 4);
            const yOffset = (i % 4) * trackH;
            
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            
            for (let x = 0; x < w; x++) {
                let min = 1, max = -1;
                for (let j = 0; j < step; j++) {
                    const v = data[x * step + j] || 0;
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
                const mid = yOffset + trackH / 2;
                ctx.moveTo(x, mid + min * trackH / 2);
                ctx.lineTo(x, mid + max * trackH / 2);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        } catch (e) { console.warn('Waveform error track', i, e); }
    }
}


// ============================================================================
// EXPORT MIX
// ============================================================================
async function mtExportMix(songTitle, si) {
    try {
        if (!mtAudioContext) mtAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const snippets = toArray(await loadHarmonyAudioSnippets(songTitle, si));
        const buffers = [];
        
        for (let i = 0; i < snippets.length; i++) {
            const cb = document.getElementById(`mtTrack_${si}_${i}`);
            if (!cb?.checked || !snippets[i].data) continue;
            const resp = await fetch(snippets[i].data);
            const arr = await resp.arrayBuffer();
            const buf = await mtAudioContext.decodeAudioData(arr);
            const vol = (parseInt(document.getElementById(`mtVol_${si}_${i}`)?.value) || 80) / 100;
            buffers.push({ buffer: buf, volume: vol });
        }
        
        if (buffers.length === 0) { alert('No checked tracks to export.'); return; }
        
        const maxLen = Math.max(...buffers.map(b => b.buffer.length));
        const sampleRate = buffers[0].buffer.sampleRate;
        const offline = new OfflineAudioContext(2, maxLen, sampleRate);
        
        buffers.forEach(({ buffer, volume }) => {
            const src = offline.createBufferSource();
            src.buffer = buffer;
            const gain = offline.createGain();
            gain.gain.value = volume;
            src.connect(gain);
            gain.connect(offline.destination);
            src.start(0);
        });
        
        const rendered = await offline.startRendering();
        
        // Convert to WAV
        const wav = mtAudioBufferToWav(rendered);
        const blob = new Blob([wav], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${songTitle.replace(/[^a-zA-Z0-9]/g, '_')}_mix.wav`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('✅ Mix exported as WAV!');
    } catch (e) {
        console.error('Export error:', e);
        alert('Export failed: ' + e.message);
    }
}

function mtAudioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = buffer.length * blockAlign;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    function writeString(offset, string) { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); }
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    let offset = 44;
    const channels = [];
    for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
    
    for (let i = 0; i < buffer.length; i++) {
        for (let c = 0; c < numChannels; c++) {
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }
    return arrayBuffer;
}

// ============================================================================
// POST-RECORDING NUDGE
// ============================================================================
function mtShowNudge(songTitle, si, newRecordingBase64) {
    const nudgeEl = document.getElementById(`mtNudgeSection_${si}`);
    if (!nudgeEl) return;
    const ss = songTitle.replace(/'/g, "\\'");
    
    nudgeEl.style.display = 'block';
    nudgeEl.innerHTML = `
        <div style="background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.25);padding:12px;border-radius:8px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong style="font-size:0.85em">🔧 Nudge / Align ${mtHelp('nudge')}</strong>
                <span id="mtNudgeVal_${si}" style="font-size:0.8em;font-family:monospace;color:#a5b4fc">0ms</span>
            </div>
            <input type="range" id="mtNudgeSlider_${si}" min="-200" max="200" value="0" step="5" style="width:100%;accent-color:#667eea"
                oninput="document.getElementById('mtNudgeVal_${si}').textContent=this.value+'ms'">
            <div style="display:flex;justify-content:space-between;font-size:0.6em;color:rgba(255,255,255,0.3);margin-top:2px"><span>← Earlier</span><span>Later →</span></div>
            <div style="margin-top:8px;text-align:center">
                <button onclick="mtPreviewWithNudge('${ss}',${si})" style="background:#667eea;color:white;border:none;padding:6px 16px;border-radius:5px;cursor:pointer;font-size:0.8em;font-weight:600">▶ Preview with Nudge</button>
            </div>
        </div>`;
    
    // Store the new recording for nudge preview
    window._mtNudgeRecording = newRecordingBase64;
}

async function mtPreviewWithNudge(songTitle, si) {
    mtStopAllTracks();
    const nudgeMs = parseInt(document.getElementById(`mtNudgeSlider_${si}`)?.value) || 0;
    const snippets = toArray(await loadHarmonyAudioSnippets(songTitle, si));
    
    // Play existing tracks
    for (const sn of snippets) {
        if (sn.data) { const a = new Audio(sn.data); a.volume = 0.7; a.play().catch(() => {}); mtPlaybackAudios.push({ audio: a }); }
    }
    
    // Play new recording with nudge offset
    if (window._mtNudgeRecording) {
        const newAudio = new Audio(window._mtNudgeRecording);
        newAudio.volume = 0.9;
        if (nudgeMs >= 0) { setTimeout(() => newAudio.play().catch(() => {}), nudgeMs); }
        else { setTimeout(() => { for (const pa of mtPlaybackAudios) if (pa.audio) pa.audio.play().catch(() => {}); }, Math.abs(nudgeMs)); newAudio.play().catch(() => {}); }
        mtPlaybackAudios.push({ audio: newAudio });
    }
    mtIsPlaying = true;
}

// ============================================================================
// PREVIEW & SAVE
// ============================================================================
function mtShowPreview(songTitle, si, base64Audio, fileSize, mimeType) {
    const section = document.getElementById(`mtPreviewSection_${si}`);
    if (!section) return;
    const ss = songTitle.replace(/'/g, "\\'");
    let ext = 'webm'; if (mimeType.includes('mp4')) ext = 'm4a'; else if (mimeType.includes('ogg')) ext = 'ogg';
    
    // Show nudge slider
    mtShowNudge(songTitle, si, base64Audio);
    
    section.style.display = 'block';
    section.innerHTML = `
        <div style="background:rgba(16,185,129,0.1);border:2px solid #10b981;padding:16px;border-radius:10px">
            <h4 style="margin:0 0 10px;color:#10b981">✅ Recording Complete!</h4>
            <audio controls src="${base64Audio}" style="width:100%;margin-bottom:10px"></audio>
            <p style="font-size:0.7em;color:rgba(255,255,255,0.35);margin:0 0 10px">${ext.toUpperCase()} · ${(fileSize/1024).toFixed(1)} KB</p>
            <div style="margin-bottom:8px">
                <label style="display:block;margin-bottom:3px;font-size:0.8em">Who recorded?</label>
                <select id="mtRecAuthor_${si}" style="width:100%;padding:7px;border-radius:5px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15)">
                    ${Object.entries(bandMembers).map(([k,m])=>`<option value="${k}" style="color:black">${m.name}</option>`).join('')}
                </select>
            </div>
            <div style="margin-bottom:8px">
                <label style="display:block;margin-bottom:3px;font-size:0.8em">Name:</label>
                <input type="text" id="mtRecName_${si}" placeholder="E.g. Drew - high harmony" style="width:100%;padding:7px;border-radius:5px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15);box-sizing:border-box">
            </div>
            <div style="margin-bottom:10px">
                <label style="display:block;margin-bottom:3px;font-size:0.8em">Notes:</label>
                <input type="text" id="mtRecNotes_${si}" placeholder="Optional" style="width:100%;padding:7px;border-radius:5px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.15);box-sizing:border-box">
            </div>
            <div style="display:flex;gap:8px">
                <button onclick="mtSaveRecording('${ss}',${si},'${base64Audio.substring(0,50)}',${fileSize})" style="flex:1;background:#10b981;color:white;border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:600">💾 Save</button>
                <button onclick="document.getElementById('mtPreviewSection_${si}').style.display='none';document.getElementById('mtNudgeSection_${si}').style.display='none'" style="background:rgba(255,255,255,0.12);color:white;border:none;padding:10px 16px;border-radius:6px;cursor:pointer">🗑️ Discard</button>
            </div>
        </div>`;
    
    // Store full base64 in a data attribute for save
    section.dataset.audio = base64Audio;
    
    const statEl = document.getElementById(`mtRecordStatus_${si}`);
    const timEl = document.getElementById(`mtRecordTimer_${si}`);
    if (statEl) statEl.innerHTML = 'Ready to record another take.';
    if (timEl) timEl.style.display = 'none';
}

async function mtSaveRecording(songTitle, si, _unused, fileSize) {
    const section = document.getElementById(`mtPreviewSection_${si}`);
    const base64Audio = section?.dataset?.audio;
    if (!base64Audio) { alert('Recording data lost. Please record again.'); return; }
    
    const author = document.getElementById(`mtRecAuthor_${si}`)?.value || 'unknown';
    const name = document.getElementById(`mtRecName_${si}`)?.value?.trim();
    const notes = document.getElementById(`mtRecNotes_${si}`)?.value?.trim();
    if (!name) { alert('Please enter a name for this recording'); return; }
    
    const snippet = {
        name, notes: notes || '', filename: 'recording.webm', type: 'audio/webm',
        size: fileSize, data: base64Audio, uploadedBy: author,
        uploadedDate: new Date().toISOString().split('T')[0], isRecording: true
    };
    
    const key = `harmony_audio_section_${si}`;
    const existing = toArray(await loadBandDataFromDrive(songTitle, key));
    existing.push(snippet);
    await saveBandDataToDrive(songTitle, key, existing);
    
    const localKey = `deadcetera_harmony_audio_${songTitle}_section${si}`;
    localStorage.setItem(localKey, JSON.stringify(existing));
    
    logActivity('harmony_recording', { song: songTitle, extra: `section ${si}: ${name}` });
    alert('✅ Recording saved!');
    openMultiTrackStudio(songTitle, si);
}

// ============================================================================
// CSS
// ============================================================================
(function(){
    if(document.getElementById('mt-studio-css'))return;
    const s=document.createElement('style');s.id='mt-studio-css';
    s.textContent=`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}} .mt-pulse{animation:pulse 1s infinite}
        .mt-help-icon{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);font-size:0.6em;cursor:pointer;margin-left:3px;vertical-align:middle;border:1px solid rgba(255,255,255,0.1);transition:all 0.15s}
        .mt-help-icon:hover{background:rgba(102,126,234,0.3);color:white;border-color:rgba(102,126,234,0.5)}
        .highlight{fill:#667eea !important} .abcjs-cursor{stroke:#ef4444;stroke-width:2}
    `;
    document.head.appendChild(s);
})();

console.log('🎛️ Multi-Track Harmony Studio v3 loaded');

// ============================================================================
// NAV SHELL: Menu Toggle, Page Navigation
// ============================================================================
let currentPage = 'songs';

function toggleMenu() {
    const menu = document.getElementById('slideMenu');
    const overlay = document.getElementById('menuOverlay');
    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    overlay.classList.toggle('open', !isOpen);
}

function showPage(page) {
    document.getElementById('slideMenu')?.classList.remove('open');
    document.getElementById('menuOverlay')?.classList.remove('open');
    document.querySelectorAll('.app-page').forEach(p => p.classList.add('hidden'));
    const el = document.getElementById('page-' + page);
    if (el) { el.classList.remove('hidden'); el.classList.add('fade-in'); }
    document.querySelectorAll('.menu-item').forEach(m => { m.classList.toggle('active', m.dataset.page === page); });
    currentPage = page;
    if (el && page !== 'songs') {
        const renderer = pageRenderers[page];
        if (renderer) renderer(el);
    }
}

const pageRenderers = {
    setlists: renderSetlistsPage,
    playlists: renderPlaylistsPage,
    practice: renderPracticePage,
    calendar: renderCalendarPage,
    gigs: renderGigsPage,
    venues: renderVenuesPage,
    finances: renderFinancesPage,
    tuner: renderTunerPage,
    metronome: renderMetronomePage,
    admin: renderSettingsPage,
    social: renderSocialPage,
    notifications: renderNotificationsPage,
    help: (el) => (typeof renderHelpPage === 'function' ? renderHelpPage(el) : (el.innerHTML = '<p>Help loading...</p>'))
};

// ============================================================================
// SETLIST BUILDER
// ============================================================================
function renderSetlistsPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>📋 Setlists</h1><p>Build and manage setlists for gigs</p></div>
    <div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn btn-primary" onclick="createNewSetlist()">+ New Setlist</button></div>
    <div id="setlistsList"></div>`;
    loadGigHistory().then(() => loadSetlists());
}

async function loadSetlists() {
    const data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    const container = document.getElementById('setlistsList');
    if (!container) return;
    if (data.length === 0) { container.innerHTML = '<div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No setlists yet. Create one for your next gig!</div>'; return; }
    container.innerHTML = data.map((sl, i) => `<div class="app-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;cursor:pointer" onclick="editSetlist(${i})">
                <h3 style="margin-bottom:4px">${sl.name||'Untitled'}</h3>
                <div style="display:flex;gap:12px;font-size:0.8em;color:var(--text-muted);flex-wrap:wrap">
                    <span>📅 ${sl.date||'No date'}</span><span>🏛️ ${sl.venue||'No venue'}</span>
                    <span>🎵 ${(sl.sets||[]).reduce((a,s)=>a+(s.songs||[]).length,0)} songs</span>
                    <span>📋 ${(sl.sets||[]).length} set${(sl.sets||[]).length!==1?'s':''}</span>
                </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="btn btn-sm btn-ghost" onclick="editSetlist(${i})" title="Edit">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="openGigModeFromSetlistIndex(${i})" title="Gig Mode" style="color:#10b981">🎸</button>
                <button class="btn btn-sm btn-ghost" onclick="exportSetlistToiPad(${i})" title="Export for iPad" style="color:var(--accent-light)">📱</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteSetlist(${i})" title="Delete" style="color:var(--red,#f87171)">🗑️</button>
            </div>
        </div>
        ${(sl.sets||[]).map(s => `<div style="font-size:0.78em;color:var(--text-dim);margin-top:4px"><strong>${s.name}:</strong> ${(s.songs||[]).map(sg => typeof sg==='string'?sg:sg.title).join(' → ')}</div>`).join('')}
    </div>`).join('');
}

async function exportSetlistToiPad(setlistIndex) {
    const allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    const sl = allSetlists[setlistIndex];
    if (!sl) return;

    const allSongsList = typeof allSongs !== 'undefined' ? allSongs : (songs || []);
    const allTabs = {};

    // Gather all songs in this setlist
    const songTitles = [];
    (sl.sets || []).forEach(set => {
        (set.songs || []).forEach(item => {
            const title = typeof item === 'string' ? item : item.title;
            if (title && !songTitles.includes(title)) songTitles.push(title);
        });
    });

    // Load all personal tabs for each song in parallel
    await Promise.all(songTitles.map(async (title) => {
        allTabs[title] = await loadPersonalTabs(title) || [];
    }));

    // Build HTML document
    const memberColors = { drew: '#667eea', chris: '#10b981', brian: '#f59e0b', pierce: '#8b5cf6', jay: '#3b82f6' };
    const memberEmoji = { drew: '🎸', chris: '🎸', brian: '🎸', pierce: '🎹', jay: '🥁' };

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${sl.name || 'Setlist'} — Deadcetera Crib Sheet</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; padding: 20px; }
  h1 { font-size: 1.6em; font-weight: 800; color: #818cf8; margin-bottom: 4px; }
  .meta { font-size: 0.85em; color: #94a3b8; margin-bottom: 24px; }
  .set-header { font-size: 1.1em; font-weight: 700; color: #10b981; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .song-block { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .song-title { font-size: 1.05em; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .song-number { background: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: 700; flex-shrink: 0; }
  .transition-arrow { color: #818cf8; font-weight: 700; margin-left: auto; }
  .member-refs { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-top: 8px; }
  .member-ref { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; }
  .member-name { font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .ref-link { font-size: 0.82em; color: #818cf8; text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .no-ref { font-size: 0.8em; color: #475569; font-style: italic; }
  .song-meta { font-size: 0.75em; color: #64748b; display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  @media print { body { background: white; color: black; } .song-block { background: #f8fafc; border-color: #e2e8f0; } }
  @media (max-width: 600px) { .member-refs { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<h1>📋 ${sl.name || 'Setlist'}</h1>
<div class="meta">📅 ${sl.date || 'Date TBD'} &nbsp;|&nbsp; 🏛️ ${sl.venue || 'Venue TBD'} &nbsp;|&nbsp; 🎵 ${songTitles.length} songs &nbsp;|&nbsp; Generated ${new Date().toLocaleDateString()}</div>
`;

    let songNumber = 0;
    for (const set of (sl.sets || [])) {
        html += `<div class="set-header">🎵 ${set.name || 'Set'}</div>`;
        for (const item of (set.songs || [])) {
            const title = typeof item === 'string' ? item : item.title;
            const isTransition = typeof item === 'object' && item.transition;
            songNumber++;
            const songData = allSongsList.find(s => s.title === title);
            const tabs = allTabs[title] || [];

            // Build member ref blocks
            const memberRefHTML = Object.entries(bandMembers).map(([key, member]) => {
                const memberTab = tabs.find(t => t.memberKey === key || (t.addedBy && t.addedBy.includes(key)));
                const color = memberColors[key] || '#94a3b8';
                const emoji = memberEmoji[key] || '👤';
                return `<div class="member-ref">
                    <div class="member-name" style="color:${color}">${emoji} ${member.name}</div>
                    ${memberTab ? `<a href="${memberTab.url}" class="ref-link">${memberTab.label || memberTab.notes || 'View Reference'}</a>` : '<span class="no-ref">No ref added</span>'}
                </div>`;
            }).join('');

            html += `<div class="song-block">
                <div class="song-title">
                    <span class="song-number">${songNumber}</span>
                    <span>${title}</span>
                    ${songData?.band ? `<span style="font-size:0.7em;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:10px">${songData.band}</span>` : ''}
                    ${isTransition ? '<span class="transition-arrow">→</span>' : ''}
                </div>
                ${songData?.key || songData?.bpm ? `<div class="song-meta">${songData.key ? `🎵 Key: ${songData.key}` : ''}${songData.bpm ? ` &nbsp; ⚡ ${songData.bpm} BPM` : ''}</div>` : ''}
                <div class="member-refs">${memberRefHTML}</div>
            </div>`;
        }
    }

    html += `</body></html>`;

    // Open in new window
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        // Fallback: download as HTML file
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(sl.name || 'setlist').replace(/[^a-z0-9]/gi, '_')}_crib_sheet.html`;
        a.click();
    }
}

function createNewSetlist() {
    const container = document.getElementById('setlistsList');
    if (!container) return;
    window._slSets = [{ name: 'Set 1', songs: [] }];
    container.innerHTML = `<div class="app-card"><h3>New Setlist</h3>
        <div class="form-grid" style="margin-bottom:12px">
            <div class="form-row"><label class="form-label">Name</label><input class="app-input" id="slName" placeholder="e.g. Buckhead Theatre 3/15"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="slDate" type="date"></div>
            <div class="form-row"><label class="form-label">Venue</label><input class="app-input" id="slVenue" placeholder="Venue name"></div>
            <div class="form-row"><label class="form-label">Notes</label><input class="app-input" id="slNotes" placeholder="Optional"></div>
        </div>
        <div id="slSets"><div class="app-card" style="background:rgba(255,255,255,0.02)"><h3 style="color:var(--accent-light)">Set 1</h3><div id="slSet0Songs"></div><div style="margin-top:8px"><input class="app-input" id="slAddSong0" placeholder="Type song name..." oninput="slSearchSong(this,0)" style="margin-bottom:4px"><div id="slSongResults0"></div></div></div></div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn-ghost" onclick="slAddSet()">+ Add Set</button>
            <button class="btn btn-ghost" onclick="slAddSet('encore')">+ Encore</button>
            <button class="btn btn-ghost" onclick="slAddSet('soundcheck')" style="color:var(--yellow)">🔊 Soundcheck</button>
            <button class="btn btn-success" onclick="slSaveSetlist()" style="margin-left:auto">💾 Save Setlist</button>
        </div></div>`;
}

function slSearchSong(input, setIdx) {
    const q = input.value.toLowerCase();
    const results = document.getElementById('slSongResults' + setIdx);
    if (!results || q.length < 2) { if(results) results.innerHTML=''; return; }
    const matches = (typeof allSongs !== "undefined" ? allSongs : songs || []).filter(s => s.title.toLowerCase().includes(q)).slice(0, 8);
    results.innerHTML = matches.map(s => `<div class="list-item" style="cursor:pointer;padding:6px 10px;font-size:0.85em" onclick="slAddSongToSet(${setIdx},'${s.title.replace(/'/g,"\\'")}')">
        <span style="color:var(--text-dim);font-size:0.8em;width:30px">${s.band||''}</span> ${s.title}</div>`).join('');
}
function slAddSongToSet(setIdx, title) {
    if (!window._slSets[setIdx]) window._slSets[setIdx] = { songs: [] };
    window._slSets[setIdx].songs.push({title: title, transition: false});
    slRenderSetSongs(setIdx);
    document.getElementById('slAddSong' + setIdx).value = '';
    document.getElementById('slSongResults' + setIdx).innerHTML = '';
}

function slRenderSetSongs(setIdx) {
    const el = document.getElementById('slSet' + setIdx + 'Songs');
    if (!el) return;
    const items = window._slSets[setIdx]?.songs || [];
    el.innerHTML = items.map((item, i) => {
        const s = typeof item === 'string' ? item : item.title;
        const trans = typeof item === 'object' && item.transition;
        const histTip = getSongHistoryTooltip(s);
        return `<div class="list-item" style="padding:6px 10px;font-size:0.85em;gap:6px" title="${histTip.replace(/"/g,'&quot;')}">
            <span style="color:var(--text-dim);min-width:20px;font-weight:600">${i + 1}.</span>
            <span style="flex:1;font-weight:500">${s}${trans ? ' <span style="color:var(--accent-light);font-weight:700">→</span>' : ''}</span>
            <button class="btn btn-sm ${trans?'btn-primary':'btn-ghost'}" onclick="slToggleTransition(${setIdx},${i})" title="${trans?'Song transitions into next':'Click to mark as transition'}" style="padding:2px 8px;font-size:0.75em">${trans?'→':'⏹'}</button>
            <button class="btn btn-sm btn-ghost" onclick="slRemoveSong(${setIdx},${i})" style="padding:2px 6px">✕</button>
        </div>`;
    }).join('');
}

function slToggleTransition(setIdx, songIdx) {
    const items = window._slSets[setIdx]?.songs;
    if (!items || !items[songIdx]) return;
    if (typeof items[songIdx] === 'string') items[songIdx] = { title: items[songIdx], transition: true };
    else items[songIdx].transition = !items[songIdx].transition;
    slRenderSetSongs(setIdx);
}

function slRemoveSong(setIdx, songIdx) {
    window._slSets[setIdx]?.songs.splice(songIdx, 1);
    slRenderSetSongs(setIdx);
}

let _slSetCount = 1;
function slAddSet(type) {
    const name = type === 'encore' ? 'Encore' : type === 'soundcheck' ? '🔊 Soundcheck' : ('Set ' + (++_slSetCount));
    window._slSets.push({ name, songs: [] });
    const idx = window._slSets.length - 1;
    const color = type === 'encore' ? 'var(--yellow)' : type === 'soundcheck' ? 'var(--green)' : 'var(--accent-light)';
    const setsEl = document.getElementById('slSets');
    setsEl.insertAdjacentHTML('beforeend', `
        <div class="app-card" style="background:rgba(255,255,255,0.02)">
            <h3 style="color:${color}">${name}</h3>
            <div id="slSet${idx}Songs"></div>
            <div style="margin-top:8px"><input class="app-input" id="slAddSong${idx}" placeholder="Type song name..." oninput="slSearchSong(this,${idx})" style="margin-bottom:4px"><div id="slSongResults${idx}"></div></div>
        </div>`);
}

async function slSaveSetlist() {
    const sl = {
        name: document.getElementById('slName')?.value || 'Untitled',
        date: document.getElementById('slDate')?.value || '',
        venue: document.getElementById('slVenue')?.value || '',
        notes: document.getElementById('slNotes')?.value || '',
        sets: window._slSets || [],
        created: new Date().toISOString()
    };
    const existing = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    existing.push(sl);
    await saveBandDataToDrive('_band', 'setlists', existing);
    showToast('✅ Setlist saved!');
    loadSetlists();
}

async function editSetlist(idx) {
    const data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    const sl = data[idx];
    if (!sl) { alert('Setlist not found'); return; }
    
    window._slSets = sl.sets || [{ name: 'Set 1', songs: [] }];
    window._slEditIndex = idx;
    _slSetCount = window._slSets.length;
    
    const container = document.getElementById('setlistsList');
    container.innerHTML = `<div class="app-card"><h3>Edit: ${sl.name||'Untitled'}</h3>
        <div class="form-grid" style="margin-bottom:12px">
            <div class="form-row"><label class="form-label">Name</label><input class="app-input" id="slName" value="${(sl.name||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="slDate" type="date" value="${sl.date||''}"></div>
            <div class="form-row"><label class="form-label">Venue</label><input class="app-input" id="slVenue" value="${(sl.venue||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Notes</label><input class="app-input" id="slNotes" value="${(sl.notes||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <div id="slSets">${window._slSets.map((set, si) => `
            <div class="app-card" style="background:rgba(255,255,255,0.02)">
                <h3 style="color:var(--accent-light)">${set.name||'Set '+(si+1)}</h3>
                <div id="slSet${si}Songs"></div>
                <div style="margin-top:8px"><input class="app-input" id="slAddSong${si}" placeholder="Type song name..." oninput="slSearchSong(this,${si})" style="margin-bottom:4px"><div id="slSongResults${si}"></div></div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn-ghost" onclick="slAddSet()">+ Add Set</button>
            <button class="btn btn-ghost" onclick="slAddSet('encore')">+ Encore</button>
            <button class="btn btn-success" onclick="slSaveSetlistEdit(${idx})" style="margin-left:auto">💾 Save Changes</button>
            <button class="btn btn-ghost" onclick="loadSetlists()">Cancel</button>
        </div></div>`;
    
    // Render existing songs in each set
    window._slSets.forEach((set, si) => slRenderSetSongs(si));
}

async function slSaveSetlistEdit(idx) {
    const data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    data[idx] = {
        ...data[idx],
        name: document.getElementById('slName')?.value || 'Untitled',
        date: document.getElementById('slDate')?.value || '',
        venue: document.getElementById('slVenue')?.value || '',
        notes: document.getElementById('slNotes')?.value || '',
        sets: window._slSets || [],
        updated: new Date().toISOString()
    };
    await saveBandDataToDrive('_band', 'setlists', data);
    showToast('✅ Setlist updated!');
    loadSetlists();
}

async function deleteSetlist(idx) {
    if (!confirm('Delete this setlist? This cannot be undone.')) return;
    const data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    data.splice(idx, 1);
    await saveBandDataToDrive('_band', 'setlists', data);
    showToast('🗑️ Setlist deleted');
    loadSetlists();
}

async function deleteGig(idx) {
    if (!confirm('Delete this gig? This cannot be undone.')) return;
    const data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    data.splice(idx, 1);
    await saveBandDataToDrive('_band', 'gigs', data);
    showToast('🗑️ Gig deleted');
    loadGigs();
}

async function editGig(idx) {
    const data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    const g = data[idx];
    if (!g) return;
    const el = document.getElementById('gigsList');
    el.innerHTML = `<div class="app-card">
        <h3>Edit Gig</h3>
        <div class="form-grid">
            <div class="form-row"><label class="form-label">Venue</label><input class="app-input" id="gigVenue" value="${(g.venue||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="gigDate" type="date" value="${g.date||''}"></div>
            <div class="form-row"><label class="form-label">Time</label><input class="app-input" id="gigTime" value="${(g.time||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Pay</label><input class="app-input" id="gigPay" value="${(g.pay||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Sound Person</label><input class="app-input" id="gigSound" value="${(g.soundPerson||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Contact</label><input class="app-input" id="gigContact" value="${(g.contact||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="gigNotes">${g.notes||''}</textarea></div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-success" onclick="saveGigEdit(${idx})">💾 Save</button>
            <button class="btn btn-ghost" onclick="loadGigs()">Cancel</button>
        </div>
    </div>`;
}

async function saveGigEdit(idx) {
    const data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    data[idx] = {
        ...data[idx],
        venue: document.getElementById('gigVenue')?.value,
        date: document.getElementById('gigDate')?.value,
        time: document.getElementById('gigTime')?.value,
        pay: document.getElementById('gigPay')?.value,
        soundPerson: document.getElementById('gigSound')?.value,
        contact: document.getElementById('gigContact')?.value,
        notes: document.getElementById('gigNotes')?.value,
        updated: new Date().toISOString()
    };
    await saveBandDataToDrive('_band', 'gigs', data);
    showToast('✅ Gig updated!');
    loadGigs();
}

// ============================================================================
// PRACTICE PLAN
// ============================================================================
// ============================================================================
// PRACTICE PLAN — linked to calendar rehearsal events
// Each rehearsal event on the calendar has its own plan stored under
// _band/practice_plans/{YYYY-MM-DD}
// ============================================================================

let practicePlanActiveDate = null;   // which rehearsal's plan is open

async function renderPracticePage(el) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">Loading...</div>';

    // Load song statuses and calendar events in parallel
    const [statusMap, allEvents] = await Promise.all([
        loadSongStatusMap(),
        loadCalendarEventsRaw()
    ]);

    const today = new Date();
    today.setHours(0,0,0,0);

    // Filter to rehearsal events only, sorted by date
    const rehearsals = allEvents
        .filter(e => e.type === 'rehearsal')
        .sort((a,b) => (a.date||'').localeCompare(b.date||''));

    // Find next upcoming rehearsal (or most recent past one)
    const upcoming = rehearsals.filter(r => new Date(r.date+'T00:00:00') >= today);
    const past     = rehearsals.filter(r => new Date(r.date+'T00:00:00') <  today);
    const defaultEvent = upcoming[0] || past[past.length-1] || null;

    if (!practicePlanActiveDate && defaultEvent) {
        practicePlanActiveDate = defaultEvent.date;
    }

    const songList = typeof allSongs !== 'undefined' ? allSongs : [];
    const thisWeek    = songList.filter(s => statusMap[s.title] === 'this_week');
    const needsPolish = songList.filter(s => statusMap[s.title] === 'needs_polish');
    const gigReady    = songList.filter(s => statusMap[s.title] === 'gig_ready');
    const onDeck      = songList.filter(s => statusMap[s.title] === 'on_deck');

    function songRow(s, badge='') {
        return `<div class="list-item" style="cursor:pointer" onclick="selectSong('${s.title.replace(/'/g,"\\'")}');showPage('songs')">
            <span style="color:var(--text-dim);font-size:0.78em;min-width:35px;flex-shrink:0">${s.band||''}</span>
            <span style="flex:1">${s.title}</span>${badge}
        </div>`;
    }

    // Build rehearsal selector tabs
    const tabsHtml = rehearsals.length === 0 ? '' : `
    <div class="app-card" style="margin-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <h3 style="margin:0">🎸 Rehearsal Plans</h3>
            <button class="btn btn-primary btn-sm" onclick="practicePlanNew()">+ New Rehearsal</button>
        </div>
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none">
            ${rehearsals.map(r => {
                const isPast = new Date(r.date+'T00:00:00') < today;
                const isActive = r.date === practicePlanActiveDate;
                const label = formatPracticeDate(r.date);
                return `<button onclick="practicePlanSelectDate('${r.date}')"
                    style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid ${isActive?'var(--accent)':'var(--border)'};
                    background:${isActive?'var(--accent)':'rgba(255,255,255,0.03)'};
                    color:${isActive?'white':isPast?'var(--text-dim)':'var(--text-muted)'};
                    font-size:0.78em;font-weight:${isActive?'700':'500'};cursor:pointer;white-space:nowrap">
                    ${isPast?'':'🎸 '}${label}${isPast?' ✓':''}
                </button>`;
            }).join('')}
        </div>
    </div>`;

    el.innerHTML = `
    <div class="page-header">
        <h1>📋 Practice Plans</h1>
        <p>Each rehearsal has its own plan — songs to focus on, goals, notes</p>
    </div>

    <!-- STAT CARDS -->
    <div class="card-grid" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-value" style="color:var(--red)">${thisWeek.length}</div><div class="stat-label">This Week</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--yellow)">${needsPolish.length}</div><div class="stat-label">Needs Polish</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--green)">${gigReady.length}</div><div class="stat-label">Gig Ready</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--accent-light)">${onDeck.length}</div><div class="stat-label">On Deck</div></div>
    </div>

    <!-- REHEARSAL TABS + PLAN -->
    ${rehearsals.length === 0
        ? `<div class="app-card" style="text-align:center;padding:32px">
            <div style="font-size:2em;margin-bottom:12px">🎸</div>
            <div style="font-weight:600;margin-bottom:8px">No rehearsals on the calendar yet</div>
            <div style="color:var(--text-dim);font-size:0.9em;margin-bottom:16px">Add a rehearsal event on the Calendar page, then come back to build its practice plan.</div>
            <button class="btn btn-primary" onclick="showPage('calendar')">📆 Go to Calendar</button>
           </div>`
        : `${tabsHtml}
           <div class="app-card" id="practicePlanBody" style="border-top-left-radius:0;border-top-right-radius:0">
               <div style="text-align:center;padding:20px;color:var(--text-dim)">Loading plan...</div>
           </div>`
    }

    <!-- SONG STATUS LISTS -->
    <div class="app-card"><h3 style="margin-bottom:10px">🎯 This Week's Focus</h3>
        ${thisWeek.length
            ? thisWeek.map(s => songRow(s, '<span style="color:var(--red);font-size:0.72em;font-weight:600;margin-left:4px">🎯</span>')).join('')
            : '<div style="padding:12px;color:var(--text-dim);text-align:center;font-size:0.9em">No songs marked "This Week" yet</div>'}
    </div>
    <div class="app-card"><h3 style="margin-bottom:10px">⚠️ Needs Polish</h3>
        ${needsPolish.length
            ? needsPolish.map(s => songRow(s)).join('')
            : '<div style="padding:12px;color:var(--text-dim);text-align:center;font-size:0.9em">None — looking tight! 💪</div>'}
    </div>
    <div class="app-card"><h3 style="margin-bottom:10px">📚 On Deck (${onDeck.length})</h3>
        ${onDeck.length
            ? onDeck.map(s => songRow(s)).join('')
            : '<div style="padding:12px;color:var(--text-dim);text-align:center;font-size:0.9em">No songs on deck</div>'}
    </div>`;

    // Render the active plan
    if (practicePlanActiveDate) {
        renderPracticePlanForDate(practicePlanActiveDate, statusMap);
    }
}

// Load all song statuses into a map
async function loadSongStatusMap() {
    const statusMap = {};
    try {
        const allStatuses = await loadBandDataFromDrive('_band', 'song_statuses');
        if (allStatuses && typeof allStatuses === 'object') Object.assign(statusMap, allStatuses);
        // Fallback to localStorage
        (allSongs||[]).forEach(s => {
            if (!statusMap[s.title]) {
                const cached = localStorage.getItem('deadcetera_status_' + s.title);
                if (cached) statusMap[s.title] = cached;
            }
        });
    } catch(e) {}
    return statusMap;
}

// Load all calendar events as raw array
async function loadCalendarEventsRaw() {
    try {
        return toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    } catch(e) { return []; }
}

function formatPracticeDate(dateStr) {
    if (!dateStr) return '?';
    const d = new Date(dateStr + 'T12:00:00');
    const opts = { month: 'short', day: 'numeric' };
    const day = d.toLocaleDateString('en-US', opts);
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    return `${dow} ${day}`;
}

async function renderPracticePlanForDate(dateStr, statusMap) {
    const body = document.getElementById('practicePlanBody');
    if (!body) return;

    // Load the stored plan for this date
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const statusMap2 = statusMap || await loadSongStatusMap();
    const songList = typeof allSongs !== 'undefined' ? allSongs : [];
    const suggested = songList.filter(s =>
        ['this_week','needs_polish'].includes(statusMap2[s.title])
    );

    const displayDate = formatPracticeDate(dateStr);
    const today = new Date(); today.setHours(0,0,0,0);
    const isPast = new Date(dateStr+'T00:00:00') < today;

    // Goals list
    const goals = toArray(plan.goals || []);
    // Song list for this rehearsal
    const planSongs = toArray(plan.songs || []);

    body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
            <h3 style="margin:0;color:var(--accent-light)">🎸 ${displayDate}${isPast?' — Past Rehearsal':''}</h3>
            ${plan.location ? `<div style="font-size:0.8em;color:var(--text-dim);margin-top:2px">📍 ${plan.location}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="practicePlanEditMeta('${dateStr}')">✏️ Details</button>
            ${!isPast ? `<button class="btn btn-primary btn-sm" onclick="practicePlanSave('${dateStr}')">💾 Save Plan</button>` : ''}
        </div>
    </div>

    <!-- START TIME / LOCATION summary -->
    ${plan.startTime || plan.location ? `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;font-size:0.82em;color:var(--text-muted)">
        ${plan.startTime ? `<span>⏰ ${plan.startTime}</span>` : ''}
        ${plan.location  ? `<span>📍 ${plan.location}</span>` : ''}
        ${plan.duration  ? `<span>⏱ ${plan.duration}</span>` : ''}
    </div>` : ''}

    <!-- GOALS -->
    <div style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🎯 Session Goals</div>
        <div id="ppGoalsList" style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
            ${goals.length ? goals.map((g,i) => `
            <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 10px">
                <span style="flex:1;font-size:0.88em">${g}</span>
                ${!isPast ? `<button onclick="ppRemoveGoal(${i},'${dateStr}')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9em">✕</button>` : ''}
            </div>`).join('') : '<div style="color:var(--text-dim);font-size:0.85em;font-style:italic">No goals set yet</div>'}
        </div>
        ${!isPast ? `
        <div style="display:flex;gap:6px">
            <input class="app-input" id="ppNewGoal" placeholder="Add a goal, e.g. 'Nail the Scarlet→Fire transition'" style="flex:1;font-size:0.85em" onkeydown="if(event.key==='Enter')ppAddGoal('${dateStr}')">
            <button class="btn btn-ghost btn-sm" onclick="ppAddGoal('${dateStr}')">+ Add</button>
        </div>` : ''}
    </div>

    <!-- SONGS FOR THIS REHEARSAL -->
    <div style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🎵 Songs to Rehearse</div>
        <div id="ppSongsList">
            ${planSongs.length ? planSongs.map((s,i) => `
            <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 10px;margin-bottom:4px">
                <span style="color:var(--text-dim);font-size:0.72em;min-width:28px">${s.band||''}</span>
                <span style="flex:1;font-size:0.88em;cursor:pointer" onclick="selectSong('${(s.title||'').replace(/'/g,"\\'")}');showPage('songs')">${s.title||''}</span>
                ${s.focus ? `<span style="font-size:0.7em;color:var(--yellow);flex-shrink:0">${s.focus}</span>` : ''}
                ${!isPast ? `<button onclick="ppRemoveSong(${i},'${dateStr}')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9em;flex-shrink:0">✕</button>` : ''}
            </div>`).join('') : '<div style="color:var(--text-dim);font-size:0.85em;font-style:italic;padding:4px 0">No songs added yet</div>'}
        </div>
        ${!isPast ? `
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <select class="app-select" id="ppSongPicker" style="flex:2;min-width:160px;font-size:0.82em">
                <option value="">— Pick a song —</option>
                ${suggested.length ? '<optgroup label="🎯 Suggested (This Week / Needs Polish)">' + suggested.map(s=>`<option value="${s.title.replace(/"/g,'&quot;')}">${s.title}</option>`).join('') + '</optgroup>' : ''}
                <optgroup label="All Songs">
                    ${(allSongs||[]).map(s=>`<option value="${s.title.replace(/"/g,'&quot;')}">${s.title}</option>`).join('')}
                </optgroup>
            </select>
            <input class="app-input" id="ppSongFocus" placeholder="Focus note (optional)" style="flex:2;min-width:120px;font-size:0.82em">
            <button class="btn btn-ghost btn-sm" onclick="ppAddSong('${dateStr}')">+ Add</button>
        </div>` : ''}
    </div>

    <!-- NOTES / AGENDA -->
    <div>
        <div style="font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📝 Notes & Agenda</div>
        ${!isPast
            ? `<textarea class="app-textarea" id="ppNotes" rows="4" placeholder="Anything else — warm-up order, who's bringing what, special requests...">${plan.notes||''}</textarea>
               <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                   <button class="btn btn-primary btn-sm" onclick="practicePlanSave('${dateStr}')">💾 Save Plan</button>
                   <button class="btn btn-success btn-sm" onclick="notifFromPracticePlan('${dateStr}')">🔔 Share to Band</button>
                   <button class="btn btn-ghost btn-sm" onclick="practicePlanExport('${dateStr}')">📄 Export Text</button>
               </div>`
            : `<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;font-size:0.88em;color:var(--text-muted);white-space:pre-wrap">${plan.notes || 'No notes recorded.'}</div>`
        }
    </div>`;
}

function practicePlanSelectDate(dateStr) {
    practicePlanActiveDate = dateStr;
    // Update tab highlight
    document.querySelectorAll('#practicePlanBody').forEach(b => {});
    // Re-render just the plan body (fast)
    renderPracticePlanForDate(dateStr);
    // Update tab button styles
    document.querySelectorAll('[onclick^="practicePlanSelectDate"]').forEach(btn => {
        const active = btn.getAttribute('onclick').includes(`'${dateStr}'`);
        btn.style.background = active ? 'var(--accent)' : 'rgba(255,255,255,0.03)';
        btn.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
        btn.style.color = active ? 'white' : 'var(--text-muted)';
        btn.style.fontWeight = active ? '700' : '500';
    });
    document.getElementById('practicePlanBody')?.scrollIntoView({behavior:'smooth', block:'nearest'});
}

async function ppAddGoal(dateStr) {
    const inp = document.getElementById('ppNewGoal');
    const val = inp?.value.trim();
    if (!val) return;
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const goals = toArray(plan.goals || []);
    goals.push(val);
    plan.goals = goals;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    inp.value = '';
    renderPracticePlanForDate(dateStr);
}

async function ppRemoveGoal(idx, dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const goals = toArray(plan.goals || []);
    goals.splice(idx, 1);
    plan.goals = goals;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    renderPracticePlanForDate(dateStr);
}

async function ppAddSong(dateStr) {
    const title = document.getElementById('ppSongPicker')?.value;
    if (!title) return;
    const focus = document.getElementById('ppSongFocus')?.value.trim() || '';
    const songData = (allSongs||[]).find(s => s.title === title);
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const songs = toArray(plan.songs || []);
    if (songs.find(s => s.title === title)) { alert('Already in this plan!'); return; }
    songs.push({ title, band: songData?.band || '', focus });
    plan.songs = songs;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    document.getElementById('ppSongPicker').value = '';
    document.getElementById('ppSongFocus').value = '';
    renderPracticePlanForDate(dateStr);
}

async function ppRemoveSong(idx, dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const songs = toArray(plan.songs || []);
    songs.splice(idx, 1);
    plan.songs = songs;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    renderPracticePlanForDate(dateStr);
}

async function practicePlanSave(dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    plan.notes = document.getElementById('ppNotes')?.value || plan.notes || '';
    plan.updatedAt = new Date().toISOString();
    plan.updatedBy = currentUserEmail || 'unknown';
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    // Visual confirmation
    const btn = event?.target;
    if (btn) { const orig = btn.textContent; btn.textContent = '✅ Saved!'; setTimeout(()=>btn.textContent=orig, 1800); }
}

function practicePlanEditMeta(dateStr) {
    const modal = document.createElement('div');
    modal.id = 'ppMetaModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:400px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent-light)">✏️ Rehearsal Details</h3>
            <button onclick="document.getElementById('ppMetaModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        <div class="form-row"><label class="form-label">Start Time</label>
            <input class="app-input" id="ppMetaTime" placeholder="e.g. 7:00 PM"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">Location / Venue</label>
            <input class="app-input" id="ppMetaLoc" placeholder="e.g. Drew's garage, Studio B"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">Expected Duration</label>
            <input class="app-input" id="ppMetaDur" placeholder="e.g. 3 hours"></div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" style="flex:1" onclick="practicePlanSaveMeta('${dateStr}')">💾 Save</button>
            <button class="btn btn-ghost" onclick="document.getElementById('ppMetaModal').remove()">Cancel</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    // Pre-fill
    loadBandDataFromDrive('_band', `practice_plan_${dateStr}`).then(plan => {
        if (!plan) return;
        if (plan.startTime) document.getElementById('ppMetaTime').value = plan.startTime;
        if (plan.location)  document.getElementById('ppMetaLoc').value  = plan.location;
        if (plan.duration)  document.getElementById('ppMetaDur').value  = plan.duration;
    });
}

async function practicePlanSaveMeta(dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    plan.startTime = document.getElementById('ppMetaTime')?.value.trim() || '';
    plan.location  = document.getElementById('ppMetaLoc')?.value.trim() || '';
    plan.duration  = document.getElementById('ppMetaDur')?.value.trim() || '';
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    document.getElementById('ppMetaModal')?.remove();
    renderPracticePlanForDate(dateStr);
}

function practicePlanNew() {
    // Just send user to calendar to add a rehearsal event
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:360px;width:100%;color:var(--text);text-align:center">
        <div style="font-size:2em;margin-bottom:12px">📆</div>
        <h3 style="margin-bottom:8px">Add a Rehearsal on the Calendar</h3>
        <p style="color:var(--text-dim);font-size:0.88em;margin-bottom:20px">Practice plans are created from calendar rehearsal events. Add a rehearsal event first, then its plan will appear here.</p>
        <div style="display:flex;gap:8px;justify-content:center">
            <button class="btn btn-primary" onclick="this.closest('[style]').remove();showPage('calendar')">📆 Go to Calendar</button>
            <button class="btn btn-ghost" onclick="this.closest('[style]').remove()">Cancel</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function practicePlanExport(dateStr) {
    loadBandDataFromDrive('_band', `practice_plan_${dateStr}`).then(plan => {
        if (!plan) return;
        const displayDate = formatPracticeDate(dateStr);
        const songs = toArray(plan.songs||[]).map(s=>`  • ${s.title}${s.focus?' — '+s.focus:''}`).join('\n');
        const goals = toArray(plan.goals||[]).map(g=>`  • ${g}`).join('\n');
        const text = `🎸 DEADCETERA PRACTICE PLAN — ${displayDate}
${plan.startTime ? '⏰ ' + plan.startTime : ''}${plan.location ? '  📍 ' + plan.location : ''}

GOALS:
${goals || '  (none)'}

SONGS:
${songs || '  (none)'}

NOTES:
${plan.notes || '  (none)'}`.trim();

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        modal.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:480px;width:100%;color:var(--text)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3 style="margin:0;color:var(--accent-light)">📤 Share Practice Plan</h3>
                <button onclick="this.closest('[style]').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
            </div>
            <textarea class="app-textarea" rows="12" style="font-family:monospace;font-size:0.78em">${text}</textarea>
            <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="navigator.clipboard.writeText(document.querySelector('[style*=fixed] textarea').value).then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy to Clipboard',1800)})">📋 Copy to Clipboard</button>
        </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    });
}

// Also update the calendar event DETAIL view for rehearsals to show a "📋 Practice Plan" link
async function calShowEvent(idx) {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const ev = events[idx];
    if (!ev) return;
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    const typeIcon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[ev.type||'other']||'📌';
    const isRehearsal = ev.type === 'rehearsal';
    area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h3 style="margin:0;font-size:1em">${typeIcon} ${ev.title||'Untitled'}</h3>
        <button onclick="document.getElementById('calEventFormArea').innerHTML=''" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1em">✕</button>
    </div>
    <div style="font-size:0.85em;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <span>📅 ${ev.date||''}</span>
        ${ev.time ? `<span>⏰ ${ev.time}</span>` : ''}
        <span style="text-transform:capitalize">📂 ${ev.type||'other'}</span>
    </div>
    ${ev.notes ? `<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;font-size:0.85em;color:var(--text-muted);margin-bottom:12px">${ev.notes}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${isRehearsal ? `<button onclick="practicePlanActiveDate='${ev.date}';showPage('practice')" class="btn btn-primary btn-sm">📋 Practice Plan</button>` : ''}
        <button onclick="calEditEvent(${idx})" class="btn btn-ghost btn-sm">✏️ Edit</button>
        <button onclick="calDeleteEvent(${idx})" class="btn btn-danger btn-sm">✕ Delete</button>
        <button onclick="document.getElementById('calEventFormArea').innerHTML=''" class="btn btn-ghost btn-sm">Close</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth', block:'nearest'});
}

// ============================================================================
// CALENDAR
// ============================================================================
// Calendar state - persists during session
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

function renderCalendarPage(el) {
    el.innerHTML = `<div class="page-header"><h1>📆 Calendar</h1><p>Band schedule and availability</p></div><div id="calendarInner"></div>`;
    renderCalendarInner();
}

function renderCalendarInner() {
    const el = document.getElementById('calendarInner');
    if (!el) return;
    const year = calViewYear, month = calViewMonth;
    const mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}-`;

    // Render shell immediately, then load events async and paint dots
    el.innerHTML = `
    <div class="app-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <button class="btn btn-ghost btn-sm" onclick="calNavMonth(-1)">← Prev</button>
            <h3 style="margin:0;font-size:1.05em;font-weight:700">${mNames[month]} ${year}</h3>
            <button class="btn btn-ghost btn-sm" onclick="calNavMonth(1)">Next →</button>
        </div>
        <div id="calGrid"></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="calAddEvent()">+ Add Event</button>
        <button class="btn btn-ghost" onclick="calBlockDates()" style="color:var(--red)">🚫 Block Dates</button>
    </div>
    <div class="app-card" id="calEventFormArea"></div>
    <div class="app-card"><h3>📌 Upcoming Events</h3>
        <div id="calendarEvents"><div style="text-align:center;padding:20px;color:var(--text-dim)">Loading…</div></div>
    </div>
    <div class="app-card"><h3>🚫 Blocked Dates</h3>
        <div id="blockedDates" style="font-size:0.85em;color:var(--text-muted)"><div style="text-align:center;padding:12px;color:var(--text-dim)">No blocked dates.</div></div>
    </div>`;

    // Load events, then build calendar grid with dots and blocked ranges
    loadCalendarEvents().then(result => {
        const eventDates = result ? result.dateMap : {};
        const blockedRanges = result ? (result.blockedRanges || []) : [];
        const grid = document.getElementById('calGrid');
        if (!grid) return;
        let g = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">';
        dNames.forEach((d,i) => {
            const w = i===0||i===6;
            g += `<div style="font-size:0.6em;font-weight:700;text-transform:uppercase;color:${w?'var(--accent-light)':'var(--text-dim)'};text-align:center;padding:6px 0">${d}</div>`;
        });
        for (let i=0;i<firstDay;i++) g += '<div style="min-height:60px;padding:4px;"></div>';
        for (let d=1;d<=daysInMonth;d++) {
            const ds = `${monthPrefix}${String(d).padStart(2,'0')}`;
            const isToday = ds===todayStr;
            const dow = new Date(year,month,d).getDay();
            const w = dow===0||dow===6;
            const dayEvents = eventDates ? (eventDates[ds] || []) : [];
            const hasEvent = dayEvents.length > 0;
            // For each event show icon + truncated name
            const eventPills = hasEvent
                ? dayEvents.slice(0,2).map((ev,ei) => {
                    const icon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[ev.type||'other']||'📌';
                    const name = (ev.title||'').substring(0,10) + ((ev.title||'').length > 10 ? '…' : '');
                    const evIdx = ev._idx !== undefined ? ev._idx : ei;
                    return `<div onclick="event.stopPropagation();calShowEvent(${evIdx})" style="display:flex;align-items:center;gap:2px;background:rgba(102,126,234,0.25);border-radius:3px;padding:1px 4px;margin-top:1px;cursor:pointer;overflow:hidden;width:100%" title="${ev.title||''}">
                        <span style="font-size:0.75em;flex-shrink:0">${icon}</span>
                        <span style="font-size:0.6em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:white">${name}</span>
                    </div>`;
                }).join('')
                : '';
            const moreCount = dayEvents.length > 2 ? `<div style="font-size:0.55em;color:var(--accent-light);text-align:center">+${dayEvents.length-2} more</div>` : '';
            // Blocked date bars
            const blockBars = blockedRanges
                .filter(b => b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate)
                .map((b,bi) => {
                    const bIdx = blockedRanges.indexOf(b);
                    return `<div ondblclick="event.stopPropagation();calEditBlocked(${bIdx})" onclick="event.stopPropagation()" style="background:rgba(239,68,68,0.7);border-radius:3px;padding:1px 4px;margin-top:1px;overflow:hidden;cursor:pointer" title="🖱️ Dbl-click to edit | ${b.person||''}: ${b.reason||''}">
                    <span style="font-size:0.55em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;color:white">🚫 ${(b.person||'').split(' ')[0]}</span>
                </div>`;
                }).join('');
            const isBlocked = blockedRanges.some(b => b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate);
            g += `<div style="min-height:60px;display:flex;flex-direction:column;align-items:stretch;padding:3px 2px;background:${isBlocked?'rgba(239,68,68,0.06)':hasEvent?'rgba(102,126,234,0.08)':w?'rgba(102,126,234,0.04)':'rgba(255,255,255,0.02)'};border-radius:6px;font-size:0.75em;cursor:pointer;${isToday?'border:2px solid var(--accent);':isBlocked?'border:1px solid rgba(239,68,68,0.3);':hasEvent?'border:1px solid rgba(102,126,234,0.25);':''}" onclick="calDayClick(${year},${month},${d})">
                <span style="text-align:center;${isToday?'color:var(--accent);font-weight:700;':hasEvent?'color:white;font-weight:600;':w?'color:var(--accent-light);':'color:var(--text-muted);'}">${d}</span>
                ${eventPills}
                ${moreCount}
                ${blockBars}
            </div>`;
        }
        g += '</div>';
        grid.innerHTML = g;
    });
}

function calNavMonth(dir) {
    calViewMonth += dir;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
    renderCalendarInner();
}


async function loadCalendarEvents() {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    // Build date map for grid dots (all events, not just upcoming)
    const dateMap = {};
    events.forEach((e, idx) => {
        if (e.date) {
            if (!dateMap[e.date]) dateMap[e.date] = [];
            dateMap[e.date].push({...e, _idx: idx});
        }
    });

    const el = document.getElementById('calendarEvents');
    if (!el) return dateMap;
    const today = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    if (upcoming.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">No upcoming events. Click a date or + Add Event.</div>';
    } else {
        el.innerHTML = upcoming.map((e,i) => {
            const typeIcon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[e.type]||'📌';
            const isRehearsal = e.type === 'rehearsal';
            return `<div class="list-item" style="padding:10px 12px;gap:10px">
                <span style="font-size:0.8em;color:var(--text-dim);min-width:85px">${e.date||''}</span>
                <span style="flex:1;font-weight:600">${typeIcon} ${e.title||'Untitled'}</span>
                ${e.time?`<span style="font-size:0.75em;color:var(--text-muted)">${e.time}</span>`:''}
                <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap">
                    ${isRehearsal ? `<button onclick="practicePlanActiveDate='${e.date}';showPage('practice')" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;">📋</button>` : ''}
                    <button onclick="calEditEvent(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;">✏️</button>
                    <button onclick="calDeleteEvent(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;">✕</button>
                </div>
            </div>`;
        }).join('');
    }
    // Blocked dates
    const blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    const bEl = document.getElementById('blockedDates');
    if (bEl && blocked.length > 0) {
        bEl.innerHTML = blocked.map((b,i) => `<div class="list-item" style="padding:6px 12px;font-size:0.85em">
            <span style="color:var(--red)">${b.startDate} → ${b.endDate}</span>
            <span style="flex:1;color:var(--text-muted);margin-left:8px">${b.person||''}: ${b.reason||''}</span>
            <button onclick="calEditBlocked(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;flex-shrink:0;margin-right:4px;">✏️</button>
            <button onclick="calDeleteBlocked(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0;">✕</button>
        </div>`).join('');
    }
    return { dateMap, blockedRanges: blocked };
}

function calBlockDates() {
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    area.innerHTML = `<h3 style="font-size:0.9em;color:var(--red);margin-bottom:12px">🚫 Block Dates — I'm Unavailable</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Start Date</label><input class="app-input" id="blockStart" type="date"></div>
        <div class="form-row"><label class="form-label">End Date</label><input class="app-input" id="blockEnd" type="date"></div>
        <div class="form-row"><label class="form-label">Who</label><select class="app-select" id="blockPerson">${Object.entries(bandMembers).map(([k,m])=>'<option value="'+m.name+'">'+m.name+'</option>').join('')}</select></div>
        <div class="form-row"><label class="form-label">Reason</label><input class="app-input" id="blockReason" placeholder="e.g. Family vacation"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-danger" onclick="saveBlockedDates()">🚫 Block Dates</button>
        <button class="btn btn-ghost" onclick="document.getElementById('calEventFormArea').innerHTML=''">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function saveBlockedDates() {
    const b = { startDate: document.getElementById('blockStart')?.value, endDate: document.getElementById('blockEnd')?.value,
        person: document.getElementById('blockPerson')?.value, reason: document.getElementById('blockReason')?.value };
    if (!b.startDate || !b.endDate) { alert('Both dates required'); return; }
    const ex = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    ex.push(b);
    await saveBandDataToDrive('_band', 'blocked_dates', ex);
    document.getElementById('calEventFormArea').innerHTML = '';
    loadCalendarEvents();
}

async function calDeleteBlocked(idx) {
    if (!confirm('Remove this blocked date range?')) return;
    let blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    blocked.splice(idx, 1);
    await saveBandDataToDrive('_band', 'blocked_dates', blocked);
    loadCalendarEvents();
}

async function calEditBlocked(idx) {
    const blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    const b = blocked[idx];
    if (!b) return;
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    area.innerHTML = `<h3 style="font-size:0.9em;color:var(--red);margin-bottom:12px">✏️ Edit Blocked Dates</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Start Date</label><input class="app-input" id="blockStart" type="date" value="${b.startDate||''}"></div>
        <div class="form-row"><label class="form-label">End Date</label><input class="app-input" id="blockEnd" type="date" value="${b.endDate||''}"></div>
        <div class="form-row"><label class="form-label">Who</label><select class="app-select" id="blockPerson">${Object.entries(bandMembers).map(([k,m])=>`<option value="${m.name}" ${m.name===b.person?'selected':''}>${m.name}</option>`).join('')}</select></div>
        <div class="form-row"><label class="form-label">Reason</label><input class="app-input" id="blockReason" placeholder="e.g. Family vacation" value="${b.reason||''}"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-danger" onclick="saveBlockedDatesEdit(${idx})">💾 Update</button>
        <button class="btn btn-ghost" onclick="document.getElementById('calEventFormArea').innerHTML=''">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth', block:'nearest'});
}

async function saveBlockedDatesEdit(idx) {
    const b = { startDate: document.getElementById('blockStart')?.value, endDate: document.getElementById('blockEnd')?.value,
        person: document.getElementById('blockPerson')?.value, reason: document.getElementById('blockReason')?.value };
    if (!b.startDate || !b.endDate) { alert('Both dates required'); return; }
    let blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    blocked[idx] = b;
    await saveBandDataToDrive('_band', 'blocked_dates', blocked);
    document.getElementById('calEventFormArea').innerHTML = '';
    renderCalendarInner();
}

function calDayClick(y, m, d) {
    calViewYear = y; calViewMonth = m;
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    calAddEvent(ds);
}

function calAddEvent(date, editIdx, existing) {
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    const isEdit = editIdx !== undefined;
    const ev = existing || {};
    area.innerHTML = `<h3 style="margin-bottom:12px;font-size:0.95em">${isEdit?'✏️ Edit Event':'➕ Add Event'}</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="calDate" type="date" value="${date||ev.date||''}"></div>
        <div class="form-row"><label class="form-label">Type</label><select class="app-select" id="calType">
            <option value="rehearsal" ${(ev.type||'rehearsal')==='rehearsal'?'selected':''}>🎸 Rehearsal</option>
            <option value="gig" ${ev.type==='gig'?'selected':''}>🎤 Gig</option>
            <option value="meeting" ${ev.type==='meeting'?'selected':''}>👥 Meeting</option>
            <option value="other" ${ev.type==='other'?'selected':''}>📌 Other</option>
        </select></div>
        <div class="form-row"><label class="form-label">Title</label><input class="app-input" id="calTitle" placeholder="e.g. Practice at Drew's" value="${ev.title||''}"></div>
        <div class="form-row"><label class="form-label">Time</label><input class="app-input" id="calTime" type="time" value="${ev.time||''}"></div>
    </div>
    <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="calNotes" placeholder="Optional notes" style="height:60px">${ev.notes||''}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-success" onclick="calSaveEvent(${isEdit?editIdx:'undefined'})">${isEdit?'💾 Update':'💾 Save Event'}</button>
        <button class="btn btn-ghost" onclick="document.getElementById('calEventFormArea').innerHTML=''">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function calEditEvent(idx) {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const today = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    if (upcoming[idx]) calAddEvent(upcoming[idx].date, idx, upcoming[idx]);
}

async function calDeleteEvent(idx) {
    if (!confirm('Delete this event?')) return;
    let events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const today = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const evToDelete = upcoming[idx];
    if (!evToDelete) return;
    events = events.filter(e => e !== evToDelete && !(e.date===evToDelete.date && e.title===evToDelete.title && e.created===evToDelete.created));
    await saveBandDataToDrive('_band', 'calendar_events', events);
    loadCalendarEvents();
}

async function calSaveEvent(editIdx) {
    const ev = {
        date: document.getElementById('calDate')?.value,
        type: document.getElementById('calType')?.value,
        title: document.getElementById('calTitle')?.value,
        time: document.getElementById('calTime')?.value,
        notes: document.getElementById('calNotes')?.value,
    };
    if (!ev.date || !ev.title) { alert('Date and title required'); return; }
    let events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    if (editIdx !== undefined) {
        // Find event by position in upcoming sorted list
        const today = new Date().toISOString().split('T')[0];
        const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
        const old = upcoming[editIdx];
        if (old) {
            const i = events.findIndex(e => e.date===old.date && e.title===old.title);
            if (i >= 0) { events[i] = {...events[i], ...ev}; }
        }
    } else {
        ev.created = new Date().toISOString();
        events.push(ev);
    }
    await saveBandDataToDrive('_band', 'calendar_events', events);
    document.getElementById('calEventFormArea').innerHTML = '';
    loadCalendarEvents();
}


// ============================================================================
// SOCIAL MEDIA COMMAND CENTER
// ============================================================================
// ============================================================================
// NOTIFICATIONS — Web Push (FCM) + SMS deep-link + subscription preferences
// ============================================================================

// Notification event types band members can subscribe to
const NOTIF_EVENTS = {
    practice_plan:    { label: 'Practice Plan Published',    icon: '📋', desc: 'When a practice plan is finalized and shared' },
    gig_added:        { label: 'New Gig Added',              icon: '🎤', desc: 'When a gig is added to the calendar' },
    rehearsal_added:  { label: 'Rehearsal Scheduled',        icon: '🎸', desc: 'When a rehearsal is added to the calendar' },
    song_status:      { label: 'Song Status Changed',        icon: '🎵', desc: 'When a song moves to Gig Ready or This Week' },
    new_harmony:      { label: 'New Harmony Added',          icon: '🎶', desc: 'When a harmony recording is uploaded' },
    setlist_created:  { label: 'Setlist Created/Updated',    icon: '📝', desc: 'When a setlist is created or changed' },
    blocked_dates:    { label: 'Blocked Dates Updated',      icon: '🚫', desc: 'When someone updates their availability' },
    announcements:    { label: 'Band Announcements',         icon: '📢', desc: 'General announcements (always recommended)' },
};

async function renderNotificationsPage(el) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">Loading...</div>';

    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    const pushState = ('Notification' in window) ? Notification.permission : 'unsupported';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const appUrl = window.location.origin + window.location.pathname.replace(/\/(index|test)\.html$/, '/');

    el.innerHTML = `
    <div class="page-header">
        <h1>🔔 Notifications</h1>
        <p>Install the app, share the link, manage contacts &amp; push alerts</p>
    </div>

    <!-- INSTALL APP CARD -->
    <div class="app-card" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(129,140,248,0.06));border-color:rgba(99,102,241,0.35)">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <img src="icon-192.png" style="width:56px;height:56px;border-radius:12px;flex-shrink:0" onerror="this.style.display='none'">
            <div style="flex:1;min-width:180px">
                <h3 style="margin:0 0 4px 0">📲 Install Deadcetera App</h3>
                <p style="color:var(--text-dim);font-size:0.82em;margin:0">Add to your home screen — opens like a native app, no App Store needed</p>
            </div>
            ${isStandalone
                ? '<span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:6px 16px;font-size:0.82em;font-weight:700;flex-shrink:0">✓ Already Installed</span>'
                : `<button class="btn btn-primary" onclick="pwaTriggerInstall()" id="installAppBtn" style="flex-shrink:0">
                    Install App
                   </button>`
            }
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06)">
            <div style="font-weight:600;font-size:0.85em;margin-bottom:10px;color:var(--text-muted)">📨 Share the app link with your bandmates:</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <code style="flex:1;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:0.8em;color:var(--accent-light);word-break:break-all;min-width:0">${appUrl}</code>
                <button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="navigator.clipboard.writeText('${appUrl}').then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy',1800)})">📋 Copy</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" onclick="notifShareAppLink('${appUrl}')">🔗 Share via Messages / Email</button>
                <button class="btn btn-ghost btn-sm" onclick="notifSMSAppLink('${appUrl}')">💬 Text the link to band</button>
            </div>
        </div>
        <div style="margin-top:12px;padding:10px 12px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.78em;color:var(--text-dim)">
            <strong style="color:var(--text-muted)">iPhone (Safari only):</strong> Open link in Safari → Share (□↑) → "Add to Home Screen" → turn <strong style="color:#10b981">Open as Web App ON</strong> → Add<br><br>
            <strong style="color:var(--text-muted)">Android (Chrome):</strong> Open in Chrome → tap the Install banner, or ⋮ menu → "Add to Home screen" → Install
        </div>
    </div>

    <!-- BAND CONTACT DIRECTORY -->
    <div class="app-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <h3 style="margin:0">👥 Band Contact Directory</h3>
            <button class="btn btn-primary btn-sm" onclick="notifAddMember()">+ Add</button>
        </div>
        <p style="color:var(--text-dim);font-size:0.82em;margin-bottom:14px">Tap ✏️ Edit on any member to add their phone number for group texts.</p>
        <div id="bandContactList"></div>
    </div>

    <!-- PUSH NOTIFICATIONS -->
    <div class="app-card" style="margin-bottom:16px">
        <h3 style="margin-bottom:12px">📲 Push Notifications (This Device)</h3>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid var(--border);gap:12px;flex-wrap:wrap">
            <div>
                <div style="font-weight:600;margin-bottom:3px">
                    ${pushState==='granted'?'✅ Enabled':pushState==='denied'?'🚫 Blocked':'🔔 Not Enabled'}
                </div>
                <div style="font-size:0.78em;color:var(--text-dim)">
                    ${pushState==='granted'?'Alerts come to this device when band posts updates':pushState==='denied'?'Click the 🔒 lock in your address bar to allow':'Get alerts when the band posts updates'}
                </div>
            </div>
            ${pushState==='granted'
                ? '<span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:4px 14px;font-size:0.8em;font-weight:600">Active ✓</span>'
                : pushState!=='denied'
                    ? '<button class="btn btn-primary" onclick="notifRequestPush()">Enable Push</button>'
                    : ''}
        </div>
    </div>

    <!-- SEND PRACTICE PLAN -->
    <div class="app-card" style="margin-bottom:16px">
        <h3 style="margin-bottom:6px">📋 Share Practice Plan</h3>
        <p style="color:var(--text-dim);font-size:0.85em;margin-bottom:14px">Send a rehearsal plan to the whole band</p>
        <div class="form-row" style="margin-bottom:12px">
            <label class="form-label">Select Rehearsal</label>
            <select class="app-select" id="notifRehearsalPicker" style="width:100%">
                <option value="">Loading...</option>
            </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-success" style="width:100%" onclick="notifSendSMSPracticePlan()">💬 Open Group Text (SMS)</button>
            <button class="btn btn-primary" style="width:100%" onclick="notifSendPracticePlanPush()">🔔 Send Push Notification</button>
        </div>
        <p style="font-size:0.75em;color:var(--text-dim);margin-top:8px">SMS opens your Messages app pre-filled with the plan. Push sends an in-app alert.</p>
    </div>

    <!-- CUSTOM ANNOUNCEMENT -->
    <div class="app-card">
        <h3 style="margin-bottom:6px">📢 Send Announcement</h3>
        <p style="color:var(--text-dim);font-size:0.85em;margin-bottom:12px">Quick message to the whole band</p>
        <textarea class="app-textarea" id="announcementText" rows="3" placeholder="e.g. Practice moved to Saturday 7pm — bring your A-game!"></textarea>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-success" style="flex:1;min-width:130px" onclick="notifSendAnnouncementSMS()">💬 Group Text</button>
            <button class="btn btn-primary" style="flex:1;min-width:130px" onclick="notifSendAnnouncementPush()">🔔 Push</button>
        </div>
    </div>`;

    renderBandContactList(contacts);
    notifPopulateRehearsalPicker();
}

// ─────────────────────────────────────────────────────────────────────────────
// BAND CONTACT DIRECTORY — editable, stored in Firebase by member key
// ─────────────────────────────────────────────────────────────────────────────

function renderBandContactList(contacts) {
    const el = document.getElementById('bandContactList');
    if (!el) return;

    // Build rows: start with data.js bandMembers, overlay stored contacts
    const rows = Object.entries(bandMembers).map(([key, m]) => {
        const stored = contacts[key] || {};
        return { key, name: stored.name || m.name, role: stored.role || m.role || '', phone: stored.phone || '', email: stored.email || '', isCore: true };
    });
    // Any extra members added manually (not in data.js)
    Object.entries(contacts).forEach(([key, c]) => {
        if (!bandMembers[key]) rows.push({ key, name: c.name||key, role: c.role||'', phone: c.phone||'', email: c.email||'', isCore: false });
    });

    if (rows.length === 0) {
        el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-dim)">No contacts yet. Click + Add to start.</div>';
        return;
    }

    el.innerHTML = rows.map(r => `
    <div id="contact-row-${r.key}" style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;background:rgba(255,255,255,0.02)">

        <!-- Header row: avatar + name + buttons -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:1.4em;flex-shrink:0;width:30px;text-align:center">${r.isCore ? (bandMembers[r.key]?.emoji||'🎸') : '👤'}</span>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.95em">${r.name}</div>
                <div style="font-size:0.75em;color:var(--text-dim)">${r.role}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0">
                ${r.phone ? `<button onclick="notifTextOne('${r.phone.replace(/'/g,"&#39;")}','${r.name.replace(/'/g,"&#39;")}')" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:0.72em;font-weight:600;white-space:nowrap">💬 Text</button>` : ''}
                <button onclick="notifToggleEdit('${r.key}')" style="background:rgba(102,126,234,0.12);color:var(--accent-light);border:1px solid rgba(102,126,234,0.25);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:0.72em;font-weight:600">✏️ Edit</button>
                ${!r.isCore ? `<button onclick="notifDeleteMember('${r.key}')" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:4px 7px;cursor:pointer;font-size:0.72em">✕</button>` : ''}
            </div>
        </div>

        <!-- Contact info display -->
        <div id="contact-info-${r.key}" style="display:flex;gap:14px;flex-wrap:wrap;font-size:0.82em;padding-left:40px">
            <span style="color:${r.phone?'var(--text-muted)':'var(--text-dim)'}">📞 ${r.phone||'<em style="color:var(--text-dim)">No phone — tap Edit</em>'}</span>
            <span style="color:${r.email?'var(--text-muted)':'var(--text-dim)'}">✉️ ${r.email||'<em style="color:var(--text-dim)">No email</em>'}</span>
        </div>

        <!-- Edit form (hidden by default) -->
        <div id="contact-edit-${r.key}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">Name</label>
                    <input class="app-input" id="cedit-name-${r.key}" value="${r.name}" style="font-size:0.85em">
                </div>
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">Role / Instrument</label>
                    <input class="app-input" id="cedit-role-${r.key}" value="${r.role}" placeholder="e.g. Bass" style="font-size:0.85em">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">📞 Phone</label>
                    <input class="app-input" id="cedit-phone-${r.key}" value="${r.phone}" placeholder="+1 404 555 0123" type="tel" style="font-size:0.85em">
                </div>
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">✉️ Email</label>
                    <input class="app-input" id="cedit-email-${r.key}" value="${r.email}" placeholder="name@email.com" type="email" style="font-size:0.85em">
                </div>
            </div>
            <div style="display:flex;gap:6px">
                <button class="btn btn-primary btn-sm" style="flex:1" onclick="notifSaveMemberContact('${r.key}')">💾 Save</button>
                <button class="btn btn-ghost btn-sm" onclick="notifToggleEdit('${r.key}')">Cancel</button>
            </div>
        </div>
    </div>`).join('');
}

function notifToggleEdit(key) {
    const info = document.getElementById(`contact-info-${key}`);
    const form = document.getElementById(`contact-edit-${key}`);
    if (!info || !form) return;
    const opening = form.style.display === 'none';
    form.style.display = opening ? 'block' : 'none';
    info.style.display = opening ? 'none' : 'flex';
    if (opening) setTimeout(() => document.getElementById(`cedit-phone-${key}`)?.focus(), 50);
}

async function notifSaveMemberContact(key) {
    const name  = document.getElementById(`cedit-name-${key}`)?.value.trim() || '';
    const role  = document.getElementById(`cedit-role-${key}`)?.value.trim() || '';
    const phone = document.getElementById(`cedit-phone-${key}`)?.value.trim() || '';
    const email = document.getElementById(`cedit-email-${key}`)?.value.trim() || '';

    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    contacts[key] = { name, role, phone, email, updatedAt: new Date().toISOString() };
    await saveBandDataToDrive('_band', 'band_contacts', contacts);

    // Update info display without full re-render
    const infoEl = document.getElementById(`contact-info-${key}`);
    if (infoEl) {
        infoEl.innerHTML = `
            <span style="color:${phone?'var(--text-muted)':'var(--text-dim)'}">📞 ${phone||'<em style="color:var(--text-dim)">No phone — tap Edit</em>'}</span>
            <span style="color:${email?'var(--text-muted)':'var(--text-dim)'}">✉️ ${email||'<em style="color:var(--text-dim)">No email</em>'}</span>`;
    }
    // Refresh Text button visibility
    const headerBtns = document.querySelector(`#contact-row-${key} div[style*="display:flex"][style*="gap:5px"]`);
    if (headerBtns && phone) {
        const existingText = headerBtns.querySelector('[onclick*="notifTextOne"]');
        if (!existingText) {
            const btn = document.createElement('button');
            btn.innerHTML = '💬 Text';
            btn.style.cssText = 'background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:0.72em;font-weight:600;white-space:nowrap';
            btn.onclick = () => notifTextOne(phone, name);
            headerBtns.insertBefore(btn, headerBtns.firstChild);
        }
    }

    notifToggleEdit(key);
    notifToast(`✅ ${name || key} saved`);
}

function notifAddMember() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:400px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent-light)">➕ Add Member</h3>
            <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        <div class="form-row"><label class="form-label">Name *</label>
            <input class="app-input" id="newMemberName" placeholder="e.g. Alex" autofocus></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">Role / Instrument</label>
            <input class="app-input" id="newMemberRole" placeholder="e.g. Keyboards"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">📞 Phone</label>
            <input class="app-input" id="newMemberPhone" type="tel" placeholder="+1 404 555 0123"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">✉️ Email</label>
            <input class="app-input" id="newMemberEmail" type="email" placeholder="alex@email.com"></div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" style="flex:1" onclick="notifConfirmAddMember()">Add Member</button>
            <button class="btn btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Cancel</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

async function notifConfirmAddMember() {
    const name  = document.getElementById('newMemberName')?.value.trim();
    const role  = document.getElementById('newMemberRole')?.value.trim() || '';
    const phone = document.getElementById('newMemberPhone')?.value.trim() || '';
    const email = document.getElementById('newMemberEmail')?.value.trim() || '';
    if (!name) { alert('Name is required'); return; }
    const key = name.toLowerCase().replace(/\W+/g,'_') + '_' + Date.now().toString().slice(-4);
    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    contacts[key] = { name, role, phone, email, addedAt: new Date().toISOString() };
    await saveBandDataToDrive('_band', 'band_contacts', contacts);
    document.querySelector('[style*="position:fixed"][style*="z-index:9999"]')?.remove();
    notifToast(`✅ ${name} added`);
    showPage('notifications');
}

async function notifDeleteMember(key) {
    if (!confirm('Remove this contact?')) return;
    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    delete contacts[key];
    await saveBandDataToDrive('_band', 'band_contacts', contacts);
    document.getElementById(`contact-row-${key}`)?.remove();
    notifToast('Contact removed');
}

function notifShareAppLink(url) {
    if (navigator.share) {
        navigator.share({
            title: 'Deadcetera — Band HQ',
            text: '🎸 Our band app — songs, setlists, rehearsals, harmonies. Add it to your home screen!',
            url: url
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => notifToast('📋 Link copied!'));
    }
}

function notifIsDesktop() {
    return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function notifSendSMS(phones, msg) {
    if (notifIsDesktop()) {
        navigator.clipboard.writeText(msg).catch(() => {});
        notifShowSMSCopyModal(msg,
            'You\'re on a desktop — group SMS doesn\'t work reliably here (Mac Messages only takes the first recipient). ' +
            'The message has been copied to your clipboard. Paste it into your band group text, or open this page on your phone to auto-send to everyone at once.'
        );
        return;
    }
    window.open(`sms:${phones.join(',')}?body=${encodeURIComponent(msg)}`);
}

async function notifSMSAppLink(url) {
    const phones = await notifGetAllPhones();
    const msg = `🎸 Hey! Here\'s the Deadcetera band app — add it to your home screen so you always have it:\n\n${url}\n\n📱 iPhone (Safari only — not Chrome):\n1. Open the link in Safari\n2. Tap the Share button (□↑) at the bottom\n3. Tap "Add to Home Screen"\n4. Make sure "Open as Web App" is ON ✅\n5. Tap Add\n\n🤖 Android (Chrome):\n1. Open the link in Chrome\n2. Tap the Install banner that appears, OR tap ⋮ menu → "Add to Home screen"\n3. Tap Install\n\nOpens like a real app — no browser bar, works offline!`;
    if (phones.length === 0) {
        notifShowSMSCopyModal(msg, 'Add phone numbers in the Band Contact Directory to auto-fill recipients.');
        return;
    }
    notifSendSMS(phones, msg);
}

function notifTextOne(phone, name) {
    const appUrl = window.location.href.split('?')[0];
    const msg = `Hey ${name}! 🎸 Check the Deadcetera app for updates: ${appUrl}`;
    window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function notifPopulateRehearsalPicker() {
    const sel = document.getElementById('notifRehearsalPicker');
    if (!sel) return;
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const today = new Date().toISOString().split('T')[0];
    const rehearsals = events.filter(e => e.type === 'rehearsal').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    if (rehearsals.length === 0) {
        sel.innerHTML = '<option value="">No rehearsals — add one on the Calendar page</option>';
        return;
    }
    const upcoming = rehearsals.filter(r => r.date >= today);
    const past = rehearsals.filter(r => r.date < today);
    sel.innerHTML =
        (upcoming.length ? '<optgroup label="Upcoming">' + upcoming.map(r=>`<option value="${r.date}">🎸 ${formatPracticeDate(r.date)} — ${r.title||'Rehearsal'}</option>`).join('') + '</optgroup>' : '') +
        (past.length ? '<optgroup label="Past">' + past.slice(-3).reverse().map(r=>`<option value="${r.date}">✓ ${formatPracticeDate(r.date)} — ${r.title||'Rehearsal'}</option>`).join('') + '</optgroup>' : '');
}

async function notifGetAllPhones() {
    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    const phones = [];
    // Core band members first
    Object.keys(bandMembers).forEach(key => { if (contacts[key]?.phone) phones.push(contacts[key].phone); });
    // Extra contacts
    Object.entries(contacts).forEach(([key, c]) => { if (!bandMembers[key] && c.phone) phones.push(c.phone); });
    return phones;
}

async function notifSendSMSPracticePlan() {
    const dateStr = document.getElementById('notifRehearsalPicker')?.value;
    if (!dateStr) { alert('Please select a rehearsal first'); return; }
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const displayDate = formatPracticeDate(dateStr);
    const songs = toArray(plan.songs||[]).map(s=>`• ${s.title}${s.focus?' ('+s.focus+')':''}`).join('\n') || '• TBD';
    const goals = toArray(plan.goals||[]).map(g=>`• ${g}`).join('\n') || '• TBD';
    const appUrl = window.location.href.split('?')[0];
    const msg = `🎸 DEADCETERA — ${displayDate}${plan.startTime?'\n⏰ '+plan.startTime:''}${plan.location?'\n📍 '+plan.location:''}\n\nSONGS:\n${songs}\n\nGOALS:\n${goals}${plan.notes?'\n\nNOTES:\n'+plan.notes:''}\n\n📱 Full plan: ${appUrl}`;
    const phones = await notifGetAllPhones();
    if (phones.length === 0) {
        notifShowSMSCopyModal(msg, 'No phone numbers saved yet — tap ✏️ Edit on each band member above to add their number, then try again.');
        return;
    }
    notifSendSMS(phones, msg);
}

async function notifSendPracticePlanPush() {
    const dateStr = document.getElementById('notifRehearsalPicker')?.value;
    if (!dateStr) { alert('Please select a rehearsal first'); return; }
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const songs = toArray(plan.songs||[]).map(s=>s.title).join(', ') || 'TBD';
    await notifSendPush(`Practice Plan — ${formatPracticeDate(dateStr)}`, `Songs: ${songs.substring(0,80)}${songs.length>80?'...':''}\nOpen the app for the full plan.`, 'practice_plan');
}

async function notifSendPush(title, body, eventType) {
    const log = toArray(await loadBandDataFromDrive('_band', 'notif_log') || []);
    log.unshift({ title, body, eventType, sentBy: currentUserEmail, sentAt: new Date().toISOString() });
    await saveBandDataToDrive('_band', 'notif_log', log.slice(0,50));
    if (Notification.permission === 'granted') {
        new Notification(`🎸 Deadcetera: ${title}`, { body, icon: '/favicon.ico', tag: eventType });
        notifToast('🔔 Notification sent!');
    } else {
        notifToast('⚠️ Enable push notifications first');
    }
}

async function notifRequestPush() {
    if (!('Notification' in window)) { alert('This browser does not support push notifications.'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
        notifToast('✅ Push notifications enabled!');
        showPage('notifications');
    } else if (perm === 'denied') {
        alert('Notifications blocked. Click the 🔒 lock in your browser address bar and allow notifications for this site.');
    }
}

async function notifSendAnnouncementPush() {
    const msg = document.getElementById('announcementText')?.value.trim();
    if (!msg) { alert('Please type a message first'); return; }
    await notifSendPush('Band Announcement', msg, 'announcements');
    document.getElementById('announcementText').value = '';
}

async function notifSendAnnouncementSMS() {
    const msg = document.getElementById('announcementText')?.value.trim();
    if (!msg) { alert('Please type a message first'); return; }
    const appUrl = window.location.href.split('?')[0];
    const full = `🎸 Deadcetera: ${msg}\n\n📱 ${appUrl}`;
    const phones = await notifGetAllPhones();
    if (phones.length === 0) {
        notifShowSMSCopyModal(full, 'No phone numbers saved — tap ✏️ Edit on each member above to add their number.');
        return;
    }
    notifSendSMS(phones, full);
}

function notifShowSMSCopyModal(msg, hint) {
    const isDesktop = notifIsDesktop();
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:500px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="margin:0;color:var(--accent-light)">💬 ${isDesktop ? 'Message Not Auto-Sent' : 'Copy & Send'}</h3>
            <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        ${isDesktop ? `
        <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:flex-start">
            <span style="font-size:1.4em;flex-shrink:0">⚠️</span>
            <div style="font-size:0.83em;color:#fca5a5;line-height:1.5">
                <strong style="display:block;margin-bottom:4px;font-size:1em">Group text didn't send — you're on desktop.</strong>
                Mac can only text one person at a time via SMS. <strong>Open this page on your phone</strong> to auto-send to the whole band at once, or copy the message below and paste it into your group chat manually.
            </div>
        </div>
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:8px 12px;font-size:0.8em;color:#6ee7b7;margin-bottom:10px">
            ✅ Message already copied to your clipboard — just paste it!
        </div>` 
        : hint ? `<p style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:8px 12px;font-size:0.82em;color:var(--yellow);margin-bottom:10px">⚠️ ${hint}</p>` : ''}
        <textarea class="app-textarea" rows="8" style="font-size:0.78em;font-family:monospace" readonly>${msg}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-primary" style="flex:1"
                onclick="navigator.clipboard.writeText(this.closest('[style*=fixed]').querySelector('textarea').value).then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy Message',1800)})">
                📋 Copy Message
            </button>
            <button class="btn btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Close</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function notifToast(msg) {
    document.querySelectorAll('.notif-toast').forEach(t=>t.remove());
    const t = document.createElement('div');
    t.className = 'notif-toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 20px;font-weight:600;z-index:9999;font-size:0.88em;color:var(--text);box-shadow:0 4px 20px rgba(0,0,0,0.4);white-space:nowrap;transition:opacity 0.3s';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity='0', 2200);
    setTimeout(() => t.remove(), 2600);
}

async function notifFromPracticePlan(dateStr) {
    practicePlanActiveDate = dateStr;
    showPage('notifications');
    setTimeout(() => {
        const sel = document.getElementById('notifRehearsalPicker');
        if (sel) sel.value = dateStr;
    }, 600);
}


function renderSocialPage(el) {
    el.innerHTML = `
    <div class="page-header">
        <h1>📣 Social Media</h1>
        <p>Plan content, draft posts, and coordinate across platforms</p>
    </div>

    <!-- PLATFORM LINKS -->
    <div class="app-card">
        <h3 style="margin-bottom:12px">🔗 Our Profiles</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px" id="socialProfileLinks">
            <div style="text-align:center;padding:12px;color:var(--text-dim);grid-column:1/-1">Loading…</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="socialEditProfiles()">✏️ Edit Profile Links</button>
    </div>

    <!-- CONTENT CALENDAR -->
    <div class="app-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <h3 style="margin:0">📅 Content Queue</h3>
            <button class="btn btn-primary btn-sm" onclick="socialAddPost()">+ Draft Post</button>
        </div>
        <div id="socialPostsList"><div style="text-align:center;padding:20px;color:var(--text-dim)">Loading…</div></div>
    </div>

    <!-- POST FORM (hidden initially) -->
    <div class="app-card" id="socialPostFormArea" style="display:none"></div>

    <!-- IDEAS BANK -->
    <div class="app-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0">💡 Content Ideas</h3>
            <button class="btn btn-ghost btn-sm" onclick="socialAddIdea()">+ Add Idea</button>
        </div>
        <div id="socialIdeasList"></div>
        <div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid var(--border)">
            <div style="font-size:0.8em;color:var(--text-dim);margin-bottom:8px;font-weight:600">💡 Content ideas for bands</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;font-size:0.78em;color:var(--text-muted)">
                <span>📸 Behind-the-scenes rehearsal photos</span>
                <span>🎵 30-sec clip of new song you're working on</span>
                <span>🎥 Time-lapse of gear setup</span>
                <span>📢 "We're learning [song]" announcement</span>
                <span>🎤 Shoutout to a fan who came to a show</span>
                <span>📆 Upcoming gig announcement with flyer</span>
                <span>🎸 Gear spotlight — whose rig is it?</span>
                <span>🎶 Cover preview (acoustic / stripped down)</span>
            </div>
        </div>
    </div>

    <!-- BEST PRACTICES -->
    <div class="app-card">
        <h3 style="margin-bottom:10px">📖 Band Social Media Playbook</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${[
                {icon:'📸',title:'Instagram / TikTok',tip:'Best for visual content. Post Reels of rehearsal clips, gear, live moments. Stories for day-of gig hype. Hashtags: #deadhead #gratefuldeadfan #livejam + local city tags.'},
                {icon:'🎵',title:'Facebook',tip:'Great for local event promotion and fan community. Create an event for every gig. Share setlists after shows. Your older/local fans are here.'},
                {icon:'▶️',title:'YouTube',tip:'Upload full live sets or highlight reels. Great long-term SEO. Fans search for "[song] cover" constantly — be in those results.'},
                {icon:'🐦',title:'X / Twitter',tip:'Real-time gig updates, setlist reveals live during shows, quick reactions. Use it day-of for "Heading to soundcheck" energy.'},
                {icon:'📅',title:'Posting Cadence',tip:'Aim for 3-4 posts/week total across platforms. Batch content on Sundays. Use Buffer or Later (free tiers) to schedule ahead.'},
                {icon:'🎯',title:'Post After Shows',tip:'Best engagement window: 30 min – 2 hrs after a gig. Quick iPhone shot + setlist + "Thanks [venue]!" = easy high-engagement post.'},
            ].map(c=>`<div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:1.3em;margin-bottom:6px">${c.icon}</div>
                <div style="font-weight:600;font-size:0.85em;color:var(--accent-light);margin-bottom:4px">${c.title}</div>
                <div style="font-size:0.78em;color:var(--text-muted);line-height:1.4">${c.tip}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:rgba(102,126,234,0.08);border-radius:8px;border:1px solid rgba(102,126,234,0.2);font-size:0.8em;color:var(--text-muted)">
            <strong style="color:var(--accent-light)">⚡ Pro tip:</strong> Since Deadcetera is on GitHub Pages, <strong>auto-publishing</strong> to social platforms requires a paid tool like Buffer ($6/mo) or Later (free tier). 
            Use the queue below to draft posts with text + notes, then tap "Copy & Post" to open the platform and paste instantly.
        </div>
    </div>`;
    loadSocialProfiles();
    loadSocialPosts();
    loadSocialIdeas();
}

async function loadSocialProfiles() {
    const profiles = (await loadBandDataFromDrive('_band', 'social_profiles') || {});
    const container = document.getElementById('socialProfileLinks');
    if (!container) return;
    const platforms = [
        {key:'instagram',icon:'📸',label:'Instagram',color:'#e1306c',url:'https://instagram.com/'},
        {key:'facebook',icon:'👥',label:'Facebook',color:'#1877f2',url:'https://facebook.com/'},
        {key:'youtube',icon:'▶️',label:'YouTube',color:'#ff0000',url:'https://youtube.com/'},
        {key:'tiktok',icon:'🎵',label:'TikTok',color:'#69c9d0',url:'https://tiktok.com/'},
        {key:'twitter',icon:'🐦',label:'X / Twitter',color:'#1da1f2',url:'https://x.com/'},
        {key:'spotify',icon:'🟢',label:'Spotify Artist',color:'#1db954',url:'https://artists.spotify.com/'},
    ];
    container.innerHTML = platforms.map(p => {
        const handle = profiles[p.key] || '';
        const href = handle ? (handle.startsWith('http') ? handle : p.url + handle.replace('@','')) : '#';
        return `<a href="${href}" target="${handle?'_blank':'_self'}" onclick="${!handle?'event.preventDefault();':''}" 
            style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;text-decoration:none;cursor:${handle?'pointer':'default'};opacity:${handle?'1':'0.45'}">
            <span style="font-size:1.5em">${p.icon}</span>
            <span style="font-size:0.72em;font-weight:600;color:${handle?p.color:'var(--text-dim)'}">${p.label}</span>
            <span style="font-size:0.65em;color:var(--text-dim);word-break:break-all;text-align:center">${handle||'Not set'}</span>
        </a>`;
    }).join('');
}

function socialEditProfiles() {
    const area = document.getElementById('socialPostFormArea');
    area.style.display = 'block';
    const platforms = ['instagram','facebook','youtube','tiktok','twitter','spotify'];
    const icons = {instagram:'📸',facebook:'👥',youtube:'▶️',tiktok:'🎵',twitter:'🐦',spotify:'🟢'};
    loadBandDataFromDrive('_band', 'social_profiles').then(profiles => {
        profiles = profiles || {};
        area.innerHTML = `<h3 style="margin-bottom:12px">✏️ Edit Profile Links</h3>
        <div class="form-grid">
            ${platforms.map(p=>`<div class="form-row">
                <label class="form-label">${icons[p]} ${p.charAt(0).toUpperCase()+p.slice(1)}</label>
                <input class="app-input" id="sp_${p}" placeholder="@handle or full URL" value="${profiles[p]||''}">
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-success" onclick="socialSaveProfiles(['${platforms.join("','")}'])">💾 Save</button>
            <button class="btn btn-ghost" onclick="document.getElementById('socialPostFormArea').style.display='none'">Cancel</button>
        </div>`;
        area.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
}

async function socialSaveProfiles(platforms) {
    const profiles = {};
    platforms.forEach(p => { const v = document.getElementById('sp_'+p)?.value.trim(); if(v) profiles[p]=v; });
    await saveBandDataToDrive('_band', 'social_profiles', profiles);
    document.getElementById('socialPostFormArea').style.display = 'none';
    loadSocialProfiles();
}

async function loadSocialPosts() {
    const posts = toArray(await loadBandDataFromDrive('_band', 'social_posts') || []);
    const el = document.getElementById('socialPostsList');
    if (!el) return;
    if (posts.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">No posts drafted yet. Hit "+ Draft Post" to start building your content queue!</div>';
        return;
    }
    const statusColors = {draft:'#667eea',ready:'#10b981',posted:'#64748b'};
    const statusLabels = {draft:'✏️ Draft',ready:'✅ Ready',posted:'📤 Posted'};
    const platformIcons = {instagram:'📸',facebook:'👥',youtube:'▶️',tiktok:'🎵',twitter:'🐦',spotify:'🟢',all:'📣'};
    el.innerHTML = posts.map((p,i) => `<div style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
            <span style="font-size:1.2em;flex-shrink:0">${platformIcons[p.platform||'all']||'📣'}</span>
            <div style="flex:1">
                <div style="font-weight:600;font-size:0.88em;margin-bottom:4px">${p.title||'Untitled Draft'}</div>
                ${p.caption?`<div style="font-size:0.78em;color:var(--text-muted);white-space:pre-wrap;line-height:1.4">${p.caption.substring(0,120)}${p.caption.length>120?'…':''}</div>`:''}
            </div>
            <span style="font-size:0.68em;padding:2px 8px;border-radius:10px;background:${statusColors[p.status||'draft']}22;color:${statusColors[p.status||'draft']};font-weight:600;white-space:nowrap;flex-shrink:0">${statusLabels[p.status||'draft']}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${p.scheduledDate?`<span style="font-size:0.72em;color:var(--text-dim)">📅 ${p.scheduledDate}</span>`:''}
            <div style="margin-left:auto;display:flex;gap:4px">
                <button onclick="socialCopyPost(${i})" style="background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.72em;font-weight:600">📋 Copy & Post</button>
                <button onclick="socialEditPost(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.72em;">✏️</button>
                <button onclick="socialDeletePost(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.72em;font-weight:700;">✕</button>
            </div>
        </div>
    </div>`).join('');
}

let _socialPosts = [];
async function getSocialPosts() {
    _socialPosts = toArray(await loadBandDataFromDrive('_band', 'social_posts') || []);
    return _socialPosts;
}

function socialAddPost(editIdx) {
    const area = document.getElementById('socialPostFormArea');
    area.style.display = 'block';
    const isEdit = editIdx !== undefined;
    const ev = isEdit ? (_socialPosts[editIdx]||{}) : {};
    area.innerHTML = `<h3 style="margin-bottom:12px">${isEdit?'✏️ Edit Post':'📝 Draft New Post'}</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Title / Internal Name</label><input class="app-input" id="sp_title" placeholder="e.g. Post-gig recap Sat 3/1" value="${ev.title||''}"></div>
        <div class="form-row"><label class="form-label">Platform</label><select class="app-select" id="sp_platform">
            ${[['all','📣 All Platforms'],['instagram','📸 Instagram'],['tiktok','🎵 TikTok'],['facebook','👥 Facebook'],['youtube','▶️ YouTube'],['twitter','🐦 X / Twitter']].map(([v,l])=>`<option value="${v}" ${(ev.platform||'all')===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
        <div class="form-row"><label class="form-label">Status</label><select class="app-select" id="sp_status">
            <option value="draft" ${(ev.status||'draft')==='draft'?'selected':''}>✏️ Draft</option>
            <option value="ready" ${ev.status==='ready'?'selected':''}>✅ Ready to Post</option>
            <option value="posted" ${ev.status==='posted'?'selected':''}>📤 Posted</option>
        </select></div>
        <div class="form-row"><label class="form-label">Scheduled Date (optional)</label><input class="app-input" id="sp_date" type="date" value="${ev.scheduledDate||''}"></div>
    </div>
    <div class="form-row" style="margin-top:8px"><label class="form-label">Caption / Copy</label>
        <textarea class="app-textarea" id="sp_caption" placeholder="Write your post caption here…
Hashtags, emojis, links — the whole thing." style="height:100px;white-space:pre-wrap">${ev.caption||''}</textarea>
    </div>
    <div class="form-row" style="margin-top:8px"><label class="form-label">Notes (internal only)</label>
        <input class="app-input" id="sp_notes" placeholder="e.g. Need photo from Jay" value="${ev.notes||''}">
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="socialSavePost(${isEdit?editIdx:'undefined'})">💾 ${isEdit?'Update':'Save Draft'}</button>
        <button class="btn btn-ghost" onclick="document.getElementById('socialPostFormArea').style.display='none'">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function socialSavePost(editIdx) {
    const post = {
        title: document.getElementById('sp_title')?.value.trim()||'',
        platform: document.getElementById('sp_platform')?.value||'all',
        status: document.getElementById('sp_status')?.value||'draft',
        scheduledDate: document.getElementById('sp_date')?.value||'',
        caption: document.getElementById('sp_caption')?.value||'',
        notes: document.getElementById('sp_notes')?.value||'',
        updatedAt: new Date().toISOString()
    };
    let posts = await getSocialPosts();
    if (editIdx !== undefined && editIdx < posts.length) posts[editIdx] = {...posts[editIdx], ...post};
    else { post.createdAt = new Date().toISOString(); posts.push(post); }
    await saveBandDataToDrive('_band', 'social_posts', posts);
    document.getElementById('socialPostFormArea').style.display = 'none';
    loadSocialPosts();
}

async function socialEditPost(idx) {
    await getSocialPosts();
    socialAddPost(idx);
}

async function socialDeletePost(idx) {
    if (!confirm('Delete this post draft?')) return;
    let posts = await getSocialPosts();
    posts.splice(idx, 1);
    await saveBandDataToDrive('_band', 'social_posts', posts);
    loadSocialPosts();
}

async function socialCopyPost(idx) {
    await getSocialPosts();
    const p = _socialPosts[idx];
    if (!p) return;
    const text = p.caption || p.title || '';
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('✅ Caption copied to clipboard! Now open the platform and paste.');
    } else {
        prompt('Copy this caption:', text);
    }
}

async function loadSocialIdeas() {
    const ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    const el = document.getElementById('socialIdeasList');
    if (!el) return;
    if (ideas.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = ideas.map((idea,i) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
        <span style="flex:1;font-size:0.85em">${idea.text}</span>
        <button onclick="socialIdeaToPost(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:2px 8px;cursor:pointer;font-size:0.72em">→ Draft</button>
        <button onclick="socialDeleteIdea(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:0.72em;font-weight:700;">✕</button>
    </div>`).join('');
}

async function socialAddIdea() {
    const formId = 'socialIdeaForm';
    if (document.getElementById(formId)) {
        document.getElementById('socialIdeaInput')?.focus();
        return;
    }
    const container = document.getElementById('socialIdeasContainer') || 
                      document.querySelector('[onclick*="socialAddIdea"]')?.closest('.app-card');
    if (!container) return;
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'display:flex;gap:8px;align-items:center;padding:10px 0;flex-wrap:wrap';
    form.innerHTML = `
        <input id="socialIdeaInput" class="app-input" placeholder="Content idea..."
            style="flex:1;min-width:200px" autocomplete="off">
        <button onclick="saveSocialIdea()" class="btn btn-primary">💾 Save</button>
        <button onclick="document.getElementById('${formId}')?.remove()" class="btn btn-ghost">Cancel</button>
    `;
    const addBtn = document.querySelector('[onclick*="socialAddIdea"]');
    if (addBtn) addBtn.after(form); else container.prepend(form);
    document.getElementById('socialIdeaInput')?.focus();
}

async function saveSocialIdea() {
    const text = document.getElementById('socialIdeaInput')?.value?.trim();
    if (!text) return;
    const ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    ideas.push({ text, addedAt: new Date().toISOString(), addedBy: currentUserEmail });
    await saveBandDataToDrive('_band', 'social_ideas', ideas);
    document.getElementById('socialIdeaForm')?.remove();
    loadSocialIdeas();
    showToast('✅ Idea saved');
}

async function socialDeleteIdea(idx) {
    let ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    ideas.splice(idx, 1);
    await saveBandDataToDrive('_band', 'social_ideas', ideas);
    loadSocialIdeas();
}

async function socialIdeaToPost(idx) {
    const ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    const idea = ideas[idx];
    if (!idea) return;
    await getSocialPosts();
    // Pre-fill post form with the idea text
    document.getElementById('socialPostFormArea').style.display = 'block';
    socialAddPost();
    setTimeout(() => {
        const cap = document.getElementById('sp_caption');
        if (cap) cap.value = idea.text;
    }, 50);
}


// ============================================================================
// GIGS
// ============================================================================
function renderGigsPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>🎤 Gigs</h1><p>Past and upcoming shows</p></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="addGig()">+ Add Gig</button>
        <button class="btn btn-ghost" onclick="seedGigData()" title="Import past gigs, setlists, and venues from master spreadsheet">📥 Import Spreadsheet Data</button>
    </div>
    <div id="gigsList"><div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No gigs added yet.</div></div>`;
    loadGigs();
}

async function loadGigs() {
    const data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    const el = document.getElementById('gigsList');
    if (!el || data.length === 0) return;
    data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    el.innerHTML = data.map((g, i) => `<div class="app-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1">
                <h3 style="margin-bottom:4px">${g.venue || 'TBD'}</h3>
                <div style="font-size:0.82em;color:var(--text-muted);display:flex;gap:10px;flex-wrap:wrap">
                    <span>📅 ${g.date || 'TBD'}</span>
                    ${g.time?`<span>⏰ ${g.time}</span>`:''}
                    ${g.pay?`<span>💰 ${g.pay}</span>`:''}
                    ${g.soundPerson?`<span>🔊 ${g.soundPerson}</span>`:''}
                </div>
            </div>
            <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
                <span style="font-size:0.65em;font-weight:600;padding:2px 8px;border-radius:6px;background:${new Date(g.date)>new Date()?'rgba(16,185,129,0.15);color:var(--green)':'rgba(255,255,255,0.06);color:var(--text-dim)'}">${new Date(g.date) > new Date() ? 'Upcoming' : 'Past'}</span>
                <button class="btn btn-sm btn-ghost" onclick="editGig(${i})" title="Edit">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteGig(${i})" title="Delete" style="color:var(--red,#f87171)">🗑️</button>
            </div>
        </div>
        ${g.notes ? `<div style="margin-top:6px;font-size:0.82em;color:var(--text-muted)">${g.notes}</div>` : ''}
        ${g.setlistName ? `<div style="margin-top:4px;font-size:0.78em"><span style="color:var(--accent-light)">📋 ${g.setlistName}</span></div>` : ''}
    </div>`).join('');
}

function addGig() {
    const el = document.getElementById('gigsList');
    el.innerHTML = `<div class="app-card">
        <h3>Add New Gig</h3>
        <div class="form-grid">
            <div class="form-row"><label class="form-label">Venue</label><input class="app-input" id="gigVenue" placeholder="Venue name"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="gigDate" type="date"></div>
            <div class="form-row"><label class="form-label">Time</label><input class="app-input" id="gigTime" placeholder="e.g. 9 PM"></div>
            <div class="form-row"><label class="form-label">Pay</label><input class="app-input" id="gigPay" placeholder="e.g. $500 + tips"></div>
            <div class="form-row"><label class="form-label">Sound Person</label><input class="app-input" id="gigSound" placeholder="Who's doing sound?"></div>
            <div class="form-row"><label class="form-label">Contact</label><input class="app-input" id="gigContact" placeholder="Venue contact name"></div>
        </div>
        <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="gigNotes" placeholder="Load-in time, parking, set length, etc."></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn btn-success" onclick="saveGig()">💾 Save</button><button class="btn btn-ghost" onclick="loadGigs()">Cancel</button></div>
    </div>` + el.innerHTML;
}

async function saveGig() {
    const gig = { venue: document.getElementById('gigVenue')?.value, date: document.getElementById('gigDate')?.value,
        time: document.getElementById('gigTime')?.value, pay: document.getElementById('gigPay')?.value,
        soundPerson: document.getElementById('gigSound')?.value, contact: document.getElementById('gigContact')?.value,
        notes: document.getElementById('gigNotes')?.value, created: new Date().toISOString() };
    if (!gig.venue) { alert('Venue required'); return; }
    const existing = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    existing.push(gig);
    await saveBandDataToDrive('_band', 'gigs', existing);
    showToast('✅ Gig saved!');
    loadGigs();
}

// ============================================================================
// SEED DATA — Pre-populate past gigs, setlists, and venues
// ============================================================================
async function seedGigData() {
    if (!isUserSignedIn) { alert('Sign in first to import gig data.'); return; }
    if (!confirm('Import past gigs, setlists, and venues from the master spreadsheet? This will not overwrite existing data.')) return;
    
    // ===== GIGS from PDF tabs =====
    const gigs = [
        { venue:'From The Earth Brewing', date:'2026-02-01', time:'8:00 PM', notes:'2 sets, ~116 min total' },
        { venue:'MoonShadow Tavern', date:'2026-01-12', time:'9:00 PM', notes:'2 sets, ~156 min total' },
        { venue:'Dunwoody Square', date:'2025-06-27', time:'7:00 PM', notes:'Private event' },
        { venue:'Wild Wings Café', date:'2025-05-23', time:'9:00 PM' },
        { venue:'Dead Fest', date:'2025-04-12', time:'TBD', notes:'Festival' },
        { venue:'Reformation Brewery', date:'2025-04-25', time:'7:00 PM' },
        { venue:'Reformation Brewery', date:'2025-03-29', time:'7:00 PM' },
        { venue:'Wing Café Marietta', date:'2024-12-14', time:'9:00 PM', notes:'2 sets' },
        { venue:'Wild Wings Café', date:'2024-12-06', time:'9:00 PM', notes:'2 sets, ~126+46 min' },
        { venue:'Truck & Tap', date:'2024-11-16', time:'8:00 PM', notes:'2 sets, ~38+81 min = 119 total' },
        { venue:'Meth Shed (PDH)', date:'2024-10-26', time:'8:00 PM', notes:'2 sets, ~49+49 min = 98 total' },
        { venue:'MadLife Stage & Studios', date:'2024-09-04', time:'8:00 PM' },
        { venue:'Wings Café', date:'2024-06-15', time:'9:00 PM' },
        { venue:'MadLife Stage & Studios', date:'2024-05-28', time:'8:00 PM' },
        { venue:'MadLife Patio', date:'2024-05-31', time:'7:00 PM' },
        { venue:'Alpharetta (Private)', date:'2024-07-19', time:'7:00 PM' },
        { venue:'Coastal Grill', date:'2024-05-11', time:'8:00 PM', notes:'2 sets + soundcheck' },
        { venue:'Wild Wings Café', date:'2024-01-19', time:'9:00 PM', notes:'2 sets + soundcheck' },
        { venue:'Wild Wings Alpharetta', date:'2023-12-29', time:'9:00 PM' },
        { venue:'Wild Wings Café', date:'2023-12-15', time:'9:00 PM' },
        { venue:'Wild Wings Café', date:'2023-10-27', time:'9:00 PM' },
        { venue:'Wild Wing Café', date:'2023-09-08', time:'9:00 PM' },
        { venue:'Private Party', date:'2023-08-19', time:'7:00 PM' },
        { venue:'Legends', date:'2023-07-22', time:'8:00 PM' },
        { venue:'Meth Shed', date:'2023-06-03', time:'8:00 PM' },
        { venue:'Wild Wings Alpharetta', date:'2023-05-12', time:'9:00 PM' },
        { venue:'Meth Shed', date:'2023-04-15', time:'8:00 PM' },
        { venue:'Skulls', date:'2023-03-23', time:'9:00 PM' },
        { venue:'Wild Wings Café', date:'2023-03-18', time:'9:00 PM' },
        { venue:'Skulls', date:'2023-01-13', time:'9:00 PM' },
    ];
    
    // ===== SETLISTS from PDF =====
    const setlists = [
      { name:'From The Earth 02/01/26', date:'2026-02-01', venue:'From The Earth Brewing', sets:[
        { name:'Set 1', songs:[{title:'Tall Boy'},{title:'Deal'},{title:'Scarlet Begonias',transition:true},{title:'Fire on the Mountain'},{title:'Superstition'},{title:'U.S. Blues'},{title:'Althea'},{title:'Deep Elem Blues'},{title:'Funky Bitch'},{title:'Chilly Water'}]},
        { name:'Set 2', songs:[{title:'Birthday'},{title:"Ain't Life Grand"},{title:'After Midnight'},{title:'Ramble On Rose'},{title:'Ophelia'},{title:'Cumberland Blues'},{title:"Franklin's Tower"},{title:'All Time Low'},{title:'Shakedown Street'},{title:'Not Fade Away'},{title:'Life During Wartime'}]}
      ]},
      { name:'MoonShadow 01/12/26', date:'2026-01-12', venue:'MoonShadow Tavern', sets:[
        { name:'Set 1', songs:[{title:'Cumberland Blues'},{title:"That's What Love Will Make You Do"},{title:'Eyes of the World'},{title:'Superstition'},{title:'Ramble On Rose'},{title:"Ain't Life Grand"},{title:'Jack Straw'},{title:'Althea'},{title:'They Love Each Other'},{title:'Tall Boy'},{title:'Deep Elem Blues'},{title:'China Cat Sunflower',transition:true},{title:'I Know You Rider'},{title:'First Tube'},{title:'Lifeboy'}]},
        { name:'Set 2', songs:[{title:'Black Peter'},{title:'Funky Bitch'},{title:'After Midnight'},{title:'Life During Wartime'},{title:'U.S. Blues'},{title:'Music Never Stopped'},{title:'Loser'},{title:"Franklin's Tower"},{title:'West LA Fadeaway'},{title:'Possum'},{title:'Chilly Water'}]}
      ]},
      { name:'Wing Café 12/14/24', date:'2024-12-14', venue:'Wing Café Marietta', sets:[
        { name:'Set 1', songs:[{title:'Music Never Stopped'},{title:'Superstition'},{title:'Ophelia'},{title:'West LA Fadeaway'},{title:'Bertha'},{title:'Possum'},{title:"Ain't Life Grand"},{title:'U.S. Blues'},{title:"Truckin'"},{title:'Chilly Water'},{title:'They Love Each Other'},{title:'Miss You'},{title:'Shakedown Street'}]},
        { name:'Set 2', songs:[{title:"Franklin's Tower"},{title:'Life During Wartime'},{title:'Sugaree'},{title:'Tall Boy'},{title:'Althea'},{title:'China Cat Sunflower',transition:true},{title:'I Know You Rider'},{title:'Jack Straw'}]}
      ]},
      { name:'Wild Wings 12/06/24', date:'2024-12-06', venue:'Wild Wings Café', sets:[
        { name:'Set 1', songs:[{title:'Minglewood Blues'},{title:'Eyes of the World'},{title:'Use Me'},{title:'Mr. Charlie'},{title:'Life During Wartime'},{title:'West LA Fadeaway'},{title:'Jack Straw'},{title:'Sledgehammer'},{title:'Music Never Stopped'},{title:"Truckin'"},{title:'LA Woman'},{title:"That's What Love Will Make You Do"},{title:'Sugaree'}]},
        { name:'Set 2', songs:[{title:'Ramble On Rose'},{title:'Deep Elem Blues'},{title:'Tall Boy'},{title:'All Along the Watchtower'},{title:'After Midnight'},{title:'They Love Each Other'},{title:'Scarlet Begonias',transition:true},{title:'Fire on the Mountain'}]}
      ]},
      { name:'Truck & Tap 11/16/24', date:'2024-11-16', venue:'Truck & Tap', sets:[
        { name:'Set 1', songs:[{title:'Ophelia'},{title:'China Cat Sunflower',transition:true},{title:'I Know You Rider'},{title:'They Love Each Other'},{title:"Ain't Life Grand"},{title:'Loser'},{title:'Superstition'},{title:'U.S. Blues'}]},
        { name:'Set 2', songs:[{title:"Truckin'"},{title:'Chilly Water'},{title:'Bertha'},{title:'Althea'},{title:'Sledgehammer'},{title:'Deal'},{title:"Franklin's Tower"},{title:'Miss You'},{title:'Eyes of the World'},{title:'Possum'},{title:'Ramble On Rose'},{title:'Tall Boy'},{title:'Shakedown Street'}]}
      ]},
      { name:'Meth Shed 10/26/24', date:'2024-10-26', venue:'Meth Shed (PDH)', sets:[
        { name:'Set 1', songs:[{title:'U.S. Blues'},{title:'Tall Boy'},{title:'Ramble On Rose'},{title:'Sledgehammer'},{title:'Miss You'},{title:"Ain't Life Grand"},{title:'China Cat Sunflower',transition:true},{title:'I Know You Rider'},{title:'Deal'}]},
        { name:'Set 2', songs:[{title:"Franklin's Tower"},{title:"Truckin'"},{title:'Tall Boy'},{title:'Chilly Water'},{title:'Eyes of the World'},{title:'Music Never Stopped'},{title:'They Love Each Other'}]}
      ]},
      { name:'MadLife 09/04/24', date:'2024-09-04', venue:'MadLife Stage & Studios', sets:[
        { name:'Set 1', songs:[{title:'Music Never Stopped'},{title:'Mr. Charlie'},{title:'Ramble On Rose'},{title:"Ain't Life Grand"},{title:'Ophelia'},{title:'Sugaree'},{title:'Possum'},{title:'Chilly Water'},{title:'Shakedown Street'}]}
      ]},
      { name:'Wings Café 06/15/24', date:'2024-06-15', venue:'Wings Café', sets:[
        { name:'Set 1', songs:[{title:'Music Never Stopped'},{title:'Minglewood Blues'},{title:'Bertha'},{title:'Hard to Handle'},{title:'Ophelia'},{title:'Big Railroad Blues'},{title:'Jack Straw'},{title:"Franklin's Tower"},{title:'Possum'},{title:'Life During Wartime'},{title:'Deep Elem Blues'},{title:'Loser'},{title:"That's What Love Will Make You Do"},{title:'Deal'},{title:'Mr. Charlie'},{title:'Chilly Water'}]},
        { name:'Set 2', songs:[{title:'China Cat Sunflower',transition:true},{title:'I Know You Rider'},{title:'Sugaree'},{title:'All Along the Watchtower'},{title:'Samson and Delilah'},{title:'Althea'},{title:'Miss You',transition:true},{title:'Shakedown Street'}]}
      ]},
      { name:'Alpharetta 07/19/24', date:'2024-07-19', venue:'Alpharetta (Private)', sets:[
        { name:'Set 1', songs:[{title:'Superstition'},{title:"That's What Love Will Make You Do"},{title:"Truckin'"},{title:'Use Me'},{title:'Life During Wartime'},{title:'Sugaree'},{title:'Miss You',transition:true},{title:'Shakedown Street'},{title:'U.S. Blues'}]}
      ]},
      { name:'Coastal Grill 05/11/24', date:'2024-05-11', venue:'Coastal Grill', sets:[
        { name:'Set 1', songs:[{title:'First Tube'},{title:'Bertha'},{title:'Mr. Charlie'},{title:'Life During Wartime'},{title:'Jack Straw'},{title:"That's What Love Will Make You Do"},{title:'Samson and Delilah'},{title:'Hard to Handle'},{title:'Sugaree'},{title:'Superstition'},{title:'Possum'},{title:"Truckin'"},{title:'China Cat Sunflower',transition:true},{title:'I Know You Rider'}]},
        { name:'Set 2', songs:[{title:'Scarlet Begonias',transition:true},{title:'Fire on the Mountain'},{title:'Use Me'},{title:'Minglewood Blues'},{title:"Franklin's Tower"},{title:'Red Hot Mama'},{title:'Miss You',transition:true},{title:'Shakedown Street'}]},
        { name:'🔊 Soundcheck', songs:[{title:'Music Never Stopped'}]}
      ]},
      { name:'MadLife 05/28/24', date:'2024-05-28', venue:'MadLife Stage & Studios', sets:[
        { name:'Set 1', songs:[{title:'Minglewood Blues'},{title:"That's What Love Will Make You Do"},{title:'Possum'},{title:'Miss You'},{title:'Shakedown Street'}]}
      ]},
      { name:'Wings 01/19/24', date:'2024-01-19', venue:'Wild Wings Café', sets:[
        { name:'Set 1', songs:[{title:"Franklin's Tower"},{title:'After Midnight'},{title:'Superstition'},{title:'They Love Each Other'},{title:'Possum'},{title:'Music Never Stopped'},{title:'Use Me'},{title:'Minglewood Blues'},{title:'Althea'},{title:'Chilly Water'},{title:'Deal'}]},
        { name:'Set 2', songs:[{title:'First Tube'},{title:"That's What Love Will Make You Do"},{title:'Hard to Handle'},{title:'Ophelia'},{title:'All Along the Watchtower'},{title:'Sugaree'},{title:'Miss You',transition:true},{title:'Shakedown Street'},{title:'Loser'},{title:'Life During Wartime'}]},
        { name:'🔊 Soundcheck', songs:[{title:'Werewolves of London'}]}
      ]},
      { name:'Wings 10/27/23', date:'2023-10-27', venue:'Wild Wings Café', sets:[
        { name:'Set 1', songs:[{title:'Frankenstein'},{title:'First Tube'},{title:'China Cat Sunflower',transition:true},{title:'I Know You Rider'},{title:'Sympathy for the Devil'},{title:'Deal'},{title:'Sugaree'},{title:'Miss You'},{title:'Shakedown Street'},{title:"That's What Love Will Make You Do"},{title:'Werewolves of London'}]},
        { name:'Set 2', songs:[{title:'Samson and Delilah'},{title:'All Along the Watchtower'},{title:'Bertha'},{title:'Good Lovin\''},{title:'Althea'},{title:'Samson and Delilah'},{title:'After Midnight'},{title:'Mr. Charlie'},{title:"Franklin's Tower"},{title:'Ziggy Stardust'},{title:'Not Fade Away'}]}
      ]},
    ];
    
    // ===== VENUES from PDF Venues tab + setlist venues =====
    const venues = [
        { name:'From The Earth Brewing', address:'Roswell, GA', notes:'Brewery with stage' },
        { name:'MoonShadow Tavern', address:'Atlanta area, GA' },
        { name:'Wild Wings Café', address:'Multiple GA locations', notes:'Regular gig. Alpharetta + others.' },
        { name:'Wing Café Marietta', address:'Marietta, GA', contact:'Analog Boy' },
        { name:'Reformation Brewery', address:'Woodstock, GA', notes:'Family friendly, early shows' },
        { name:'Truck & Tap', address:'Alpharetta, GA', contact:'Francisco Vilda' },
        { name:'MadLife Stage & Studios', address:'Woodstock, GA', notes:'Professional venue, great sound', contact:'Greg Shaddix' },
        { name:'Coastal Grill', address:'Atlanta area, GA' },
        { name:'Legends', address:'Atlanta area, GA' },
        { name:'Skulls', address:'Atlanta area, GA' },
        { name:'Meth Shed (PDH)', address:"Pierce's place", notes:'Practice/party spot' },
        { name:'Wild Wings Alpharetta', address:'Alpharetta, GA', contact:'David McPherson' },
        { name:"Lucky's", address:'Roswell, GA' },
        { name:'Gate City Brewing', address:'GA' },
        { name:"Milton's Tavern", address:'Milton, GA', contact:'Rivers Carroll', email:'RiversCarroll@yahoo.com', phone:'678-521-8001' },
        { name:'Hyde Brewery', address:'GA' },
        { name:"Rosatti's", address:'GA' },
        { name:'Wings Tap House', address:'GA' },
    ];
    
    gigs.forEach(g => g.created = new Date().toISOString());
    setlists.forEach(sl => sl.created = new Date().toISOString());
    venues.forEach(v => v.created = new Date().toISOString());
    
    try {
        const existingGigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        const existingSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        const existingVenues = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
        
        // Deduplicate
        const gigKeys = new Set(existingGigs.map(g => (g.venue||'') + '|' + (g.date||'')));
        const newGigs = gigs.filter(g => !gigKeys.has(g.venue + '|' + g.date));
        const slKeys = new Set(existingSetlists.map(s => s.name));
        const newSetlists = setlists.filter(s => !slKeys.has(s.name));
        const venueKeys = new Set(existingVenues.map(v => v.name));
        const newVenues = venues.filter(v => !venueKeys.has(v.name));
        
        if (newGigs.length > 0) await saveBandDataToDrive('_band', 'gigs', [...existingGigs, ...newGigs]);
        if (newSetlists.length > 0) await saveBandDataToDrive('_band', 'setlists', [...existingSetlists, ...newSetlists]);
        if (newVenues.length > 0) await saveBandDataToDrive('_band', 'venues', [...existingVenues, ...newVenues]);
        
        alert('✅ Imported ' + newGigs.length + ' gigs, ' + newSetlists.length + ' setlists, and ' + newVenues.length + ' venues!\n\n(Duplicates were skipped.)');
        if (typeof loadGigs === 'function') loadGigs();
        if (typeof loadSetlists === 'function') loadSetlists();
        if (typeof loadVenues === 'function') loadVenues();
    } catch(e) {
        console.error('Seed error:', e);
        alert('Error: ' + e.message);
    }
}

// ============================================================================
// VENUES & CONTACTS
// ============================================================================
function renderVenuesPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>🏛️ Venues & Contacts</h1><p>Venue info, booking contacts, sound engineers</p></div>
    <button class="btn btn-primary" onclick="addVenue()" style="margin-bottom:16px">+ Add Venue</button>
    <div id="venuesList"><div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No venues added yet.</div></div>`;
    loadVenues();
}

async function loadVenues() {
    const data = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    const el = document.getElementById('venuesList');
    if (!el || data.length === 0) return;
    el.innerHTML = data.map((v, i) => `<div class="app-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <h3 style="margin-bottom:6px">${v.name || 'Unnamed'}</h3>
            ${v.website?`<a href="${v.website}" target="_blank" class="btn btn-sm btn-ghost" title="Website">🌐</a>`:''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:0.82em;color:var(--text-muted)">
            ${v.address?`<span>📍 ${v.address}</span>`:''}
            ${v.phone?`<span>📞 ${v.phone}</span>`:''}
            ${v.email?`<span>📧 ${v.email}</span>`:''}
            ${v.capacity?`<span>👥 ${v.capacity}</span>`:''}
            ${v.stage?`<span>🎭 ${v.stage}</span>`:''}
            ${v.pA||v.pa?`<span>🔊 PA: ${v.pA||v.pa}</span>`:''}
            ${v.contactName||v.contact?`<span>🤝 ${v.contactName||v.contact}</span>`:''}
            ${v.owner?`<span>👤 ${bandMembers[v.owner]?.name||v.owner}</span>`:''}
            ${v.soundPerson?`<span>🎛️ Sound: ${v.soundPerson}</span>`:''}
            ${v.soundPhone?`<span>📱 ${v.soundPhone}</span>`:''}
            ${v.loadIn?`<span>🚪 ${v.loadIn}</span>`:''}
            ${v.parking?`<span>🅿️ ${v.parking}</span>`:''}
        </div>
        ${v.notes?`<div style="margin-top:8px;font-size:0.82em;color:var(--text-dim)">${v.notes}</div>`:''}
        ${v.pay?`<div style="margin-top:4px;font-size:0.82em;color:var(--green)">💰 ${v.pay}</div>`:''}
    </div>`).join('');
}

function addVenue() {
    const el = document.getElementById('venuesList');
    el.innerHTML = `<div class="app-card">
        <h3>Add Venue</h3>
        <div style="margin-bottom:12px;padding:10px;background:rgba(102,126,234,0.06);border-radius:8px;display:flex;gap:8px;align-items:center">
            <input class="app-input" id="vSearchGoogle" placeholder="Search Google for venue info..." style="flex:1;margin:0">
            <button class="btn btn-sm btn-primary" onclick="searchVenueGoogle()">🔍 Search</button>
        </div>
        <div class="form-grid">
            <div class="form-row"><label class="form-label">Venue Name</label><input class="app-input" id="vName"></div>
            <div class="form-row"><label class="form-label">Address</label><input class="app-input" id="vAddress"></div>
            <div class="form-row"><label class="form-label">Phone</label><input class="app-input" id="vPhone"></div>
            <div class="form-row"><label class="form-label">Email</label><input class="app-input" id="vEmail"></div>
            <div class="form-row"><label class="form-label">Website</label><input class="app-input" id="vWebsite" placeholder="https://..."></div>
            <div class="form-row"><label class="form-label">Capacity</label><input class="app-input" id="vCapacity" placeholder="e.g. 200"></div>
            <div class="form-row"><label class="form-label">Stage Size</label><input class="app-input" id="vStage" placeholder="e.g. 20x12 ft"></div>
            <div class="form-row"><label class="form-label">PA System</label><input class="app-input" id="vPA" placeholder="e.g. JBL PRX, 2 monitors"></div>
            <div class="form-row"><label class="form-label">Booking Contact</label><input class="app-input" id="vContact"></div>
            <div class="form-row"><label class="form-label">Band Contact Owner</label><select class="app-select" id="vOwner"><option value="">Select...</option>${Object.entries(bandMembers).map(([k,m])=>`<option value="${k}">${m.name}</option>`).join('')}</select></div>
            <div class="form-row"><label class="form-label">Sound Person</label><input class="app-input" id="vSoundPerson"></div>
            <div class="form-row"><label class="form-label">Sound Phone</label><input class="app-input" id="vSoundPhone"></div>
            <div class="form-row"><label class="form-label">Typical Pay</label><input class="app-input" id="vPay" placeholder="e.g. $500/night"></div>
            <div class="form-row"><label class="form-label">Load-in Info</label><input class="app-input" id="vLoadIn" placeholder="e.g. Back door, 5pm"></div>
            <div class="form-row"><label class="form-label">Parking</label><input class="app-input" id="vParking" placeholder="e.g. Street parking, lot behind"></div>
        </div>
        <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="vNotes" placeholder="Load-in, parking, stage size, PA info..."></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn btn-success" onclick="saveVenue()">💾 Save</button><button class="btn btn-ghost" onclick="loadVenues()">Cancel</button></div>
    </div>` + el.innerHTML;
}

function searchVenueGoogle() {
    const q = document.getElementById('vSearchGoogle')?.value;
    if (!q) return;
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q + ' venue'), '_blank');
}

async function saveVenue() {
    const v = {};
    ['Name','Address','Phone','Email','Website','Capacity','Stage','PA','Contact','Owner','SoundPerson','SoundPhone','Pay','LoadIn','Parking','Notes'].forEach(f => {
        const id = 'v' + f, el = document.getElementById(id);
        v[f.charAt(0).toLowerCase() + f.slice(1)] = el?.value || '';
    });
    if (!v.name) { alert('Venue name required'); return; }
    const existing = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    existing.push(v);
    await saveBandDataToDrive('_band', 'venues', existing);
    alert('✅ Venue saved!');
    loadVenues();
}

// ============================================================================
// FINANCES
// ============================================================================
function renderFinancesPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>💰 Finances</h1><p>Income, expenses, and receipts</p></div>
    <div class="card-grid" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-value finance-income" id="finTotalIncome">$0</div><div class="stat-label">Total Income</div></div>
        <div class="stat-card"><div class="stat-value finance-expense" id="finTotalExpenses">$0</div><div class="stat-label">Total Expenses</div></div>
        <div class="stat-card"><div class="stat-value" id="finBalance" style="color:var(--accent)">$0</div><div class="stat-label">Balance</div></div>
    </div>
    <button class="btn btn-primary" onclick="addTransaction()" style="margin-bottom:12px">+ Add Transaction</button>
    <div class="app-card"><h3>Transactions</h3><div id="finTransactions"><div style="text-align:center;padding:20px;color:var(--text-dim)">No transactions yet.</div></div></div>`;
    loadFinances();
}

async function loadFinances() {
    const data = toArray(await loadBandDataFromDrive('_band', 'finances') || []);
    const el = document.getElementById('finTransactions');
    if (!el) return;
    let totalIn = 0, totalOut = 0;
    data.forEach(t => { if (t.type === 'income') totalIn += parseFloat(t.amount) || 0; else totalOut += parseFloat(t.amount) || 0; });
    document.getElementById('finTotalIncome').textContent = '$' + totalIn.toFixed(2);
    document.getElementById('finTotalExpenses').textContent = '$' + totalOut.toFixed(2);
    const bal = totalIn - totalOut;
    const balEl = document.getElementById('finBalance');
    balEl.textContent = (bal >= 0 ? '$' : '-$') + Math.abs(bal).toFixed(2);
    balEl.style.color = bal >= 0 ? 'var(--green)' : 'var(--red)';
    
    if (data.length === 0) return;
    data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    el.innerHTML = `<div style="display:grid;grid-template-columns:90px 1fr 80px 60px;gap:6px;padding:6px 10px;font-size:0.7em;color:var(--text-dim);font-weight:600;text-transform:uppercase">
        <span>Date</span><span>Description</span><span>Amount</span><span>Type</span></div>` +
        data.map(t => `<div style="display:grid;grid-template-columns:90px 1fr 80px 60px;gap:6px;padding:8px 10px;font-size:0.85em;border-bottom:1px solid var(--border);align-items:center">
            <span style="color:var(--text-dim)">${t.date || ''}</span>
            <span>${t.description || ''}</span>
            <span style="color:${t.type==='income'?'var(--green)':'var(--red)'};font-weight:600">${t.type==='income'?'+':'-'}$${parseFloat(t.amount||0).toFixed(2)}</span>
            <span style="font-size:0.75em;color:var(--text-dim)">${t.category || ''}</span>
        </div>`).join('');
}

function addTransaction() {
    const el = document.getElementById('finTransactions');
    el.innerHTML = `<div style="margin-bottom:16px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px">
        <div class="form-grid">
            <div class="form-row"><label class="form-label">Type</label><select class="app-select" id="finType"><option value="income">💵 Income</option><option value="expense">💸 Expense</option></select></div>
            <div class="form-row"><label class="form-label">Amount ($)</label><input class="app-input" id="finAmount" type="number" step="0.01" placeholder="0.00"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="finDate" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-row"><label class="form-label">Category</label><select class="app-select" id="finCategory"><option value="gig_pay">Gig Pay</option><option value="merch">Merch</option><option value="tips">Tips</option><option value="equipment">Equipment</option><option value="rehearsal">Rehearsal Space</option><option value="promo">Promotion</option><option value="travel">Travel</option><option value="other">Other</option></select></div>
        </div>
        <div class="form-row"><label class="form-label">Description</label><input class="app-input" id="finDesc" placeholder="e.g. Buckhead Theatre gig pay"></div>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" onclick="saveTransaction()">💾 Save</button><button class="btn btn-ghost" onclick="loadFinances()">Cancel</button></div>
    </div>` + el.innerHTML;
}

async function saveTransaction() {
    const t = { type: document.getElementById('finType')?.value, amount: document.getElementById('finAmount')?.value,
        date: document.getElementById('finDate')?.value, category: document.getElementById('finCategory')?.value,
        description: document.getElementById('finDesc')?.value, created: new Date().toISOString() };
    if (!t.amount) { alert('Amount required'); return; }
    const existing = toArray(await loadBandDataFromDrive('_band', 'finances') || []);
    existing.push(t);
    await saveBandDataToDrive('_band', 'finances', existing);
    alert('✅ Transaction saved!');
    loadFinances();
}

// ============================================================================
// GUITAR TUNER
// ============================================================================
function renderTunerPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>🎸 Guitar Tuner</h1><p>Chromatic tuner using your microphone</p></div>
    <div class="app-card" style="text-align:center;padding:30px">
        <div id="tunerNote" style="font-size:4em;font-weight:800;font-family:'Inter',monospace;line-height:1;margin-bottom:6px">—</div>
        <div id="tunerOctave" style="font-size:1.2em;color:var(--text-dim);margin-bottom:16px">—</div>
        <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:4px;position:relative;overflow:hidden;margin:0 auto;max-width:400px">
            <div style="position:absolute;top:0;left:50%;width:2px;height:100%;background:rgba(255,255,255,0.15)"></div>
            <div id="tunerNeedle" style="position:absolute;top:0;width:4px;height:100%;background:var(--green);border-radius:2px;left:50%;transition:left 0.1s"></div>
        </div>
        <div id="tunerCents" style="font-size:0.9em;color:var(--text-dim);margin-top:10px">0¢</div>
        <div id="tunerFreq" style="font-size:0.75em;color:var(--text-dim);margin-top:4px">— Hz</div>
        <div style="margin-top:20px;display:flex;gap:10px;justify-content:center">
            <button class="btn btn-primary" id="tunerStartBtn" onclick="tunerToggle()">🎤 Start Tuner</button>
        </div>
        <div style="margin-top:20px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            ${['E2|82.41','A2|110.00','D3|146.83','G3|196.00','B3|246.94','E4|329.63'].map(s => {
                const [n,f] = s.split('|');
                return `<button class="btn btn-ghost btn-sm" onclick="tunerPlayRef(${f})" title="${f} Hz">${n}</button>`;
            }).join('')}
        </div>
        <div style="font-size:0.7em;color:var(--text-dim);margin-top:8px">Click a string to hear its reference tone</div>
    </div>`;
}

let _tunerRunning = false, _tunerAnimFrame = null, _tunerStream = null;
function tunerToggle() {
    if (_tunerRunning) { tunerStop(); return; }
    tunerStart();
}

async function tunerStart() {
    if (!mtAudioContext) mtAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
        _tunerStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = mtAudioContext.createMediaStreamSource(_tunerStream);
        const analyser = mtAudioContext.createAnalyser();
        analyser.fftSize = 4096;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        _tunerRunning = true;
        document.getElementById('tunerStartBtn').textContent = '⏹ Stop';
        document.getElementById('tunerStartBtn').classList.remove('btn-primary');
        document.getElementById('tunerStartBtn').classList.add('btn-danger');
        
        function update() {
            analyser.getFloatTimeDomainData(buf);
            const freq = mtAutoCorrelate(buf, mtAudioContext.sampleRate);
            if (freq > 0) {
                const note = mtFreqToNote(freq);
                if (note) {
                    document.getElementById('tunerNote').textContent = note.name;
                    document.getElementById('tunerNote').style.color = Math.abs(note.cents) < 5 ? 'var(--green)' : Math.abs(note.cents) < 15 ? 'var(--yellow)' : 'var(--red)';
                    document.getElementById('tunerOctave').textContent = 'Octave ' + note.octave;
                    document.getElementById('tunerCents').textContent = (note.cents >= 0 ? '+' : '') + note.cents + '¢';
                    document.getElementById('tunerNeedle').style.left = (50 + note.cents * 0.4) + '%';
                    document.getElementById('tunerFreq').textContent = freq.toFixed(1) + ' Hz';
                }
            } else {
                document.getElementById('tunerNote').textContent = '—';
                document.getElementById('tunerNote').style.color = 'var(--text)';
                document.getElementById('tunerCents').textContent = '—';
                document.getElementById('tunerNeedle').style.left = '50%';
            }
            if (_tunerRunning) _tunerAnimFrame = requestAnimationFrame(update);
        }
        update();
    } catch (e) { alert('Microphone access required: ' + e.message); }
}

function tunerStop() {
    _tunerRunning = false;
    if (_tunerAnimFrame) cancelAnimationFrame(_tunerAnimFrame);
    if (_tunerStream) _tunerStream.getTracks().forEach(t => t.stop());
    document.getElementById('tunerStartBtn').textContent = '🎤 Start Tuner';
    document.getElementById('tunerStartBtn').classList.add('btn-primary');
    document.getElementById('tunerStartBtn').classList.remove('btn-danger');
}

function tunerPlayRef(freq) {
    if (!mtAudioContext) mtAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    const o = mtAudioContext.createOscillator(), g = mtAudioContext.createGain();
    o.connect(g); g.connect(mtAudioContext.destination);
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.3, mtAudioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, mtAudioContext.currentTime + 2);
    o.start(); o.stop(mtAudioContext.currentTime + 2);
}

// ============================================================================
// STANDALONE METRONOME
// ============================================================================
function renderMetronomePage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>🥁 Metronome</h1><p>Keep time for practice</p></div>
    <div class="app-card" style="text-align:center;padding:30px">
        <div id="metBPMDisplay" style="font-size:4em;font-weight:800;font-family:'Inter',monospace;line-height:1">120</div>
        <div style="font-size:0.85em;color:var(--text-dim);margin-bottom:16px">BPM</div>
        <input type="range" id="metBPMSlider" min="40" max="240" value="120" style="width:100%;max-width:400px;accent-color:var(--accent)" oninput="metUpdateBPM(this.value)">
        <div style="display:flex;gap:6px;justify-content:center;margin:16px 0">
            ${[60,80,100,120,140,160,180].map(b => `<button class="btn btn-ghost btn-sm" onclick="metUpdateBPM(${b})">${b}</button>`).join('')}
        </div>
        <div id="metBeats" style="display:flex;gap:8px;justify-content:center;margin:16px 0">${[0,1,2,3].map(i => `<div id="metBeat${i}" style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.08);transition:all 0.05s"></div>`).join('')}</div>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:8px;align-items:center">
            <label class="form-label" style="margin:0">Time Sig:</label>
            <select class="app-select" id="metTimeSig" onchange="metUpdateTimeSig()" style="width:70px">${['4/4','3/4','6/8','2/4','5/4','7/8'].map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary" id="metStartBtn" onclick="metToggle()" style="margin-top:20px;padding:12px 32px;font-size:1.1em">▶ Start</button>
    </div>`;
}

let _metInterval = null, _metBeat = 0, _metBeatsPerBar = 4;
function metUpdateBPM(val) {
    document.getElementById('metBPMDisplay').textContent = val;
    document.getElementById('metBPMSlider').value = val;
    if (_metInterval) { clearInterval(_metInterval); _metInterval = null; metToggle(); }
}
function metUpdateTimeSig() {
    const ts = document.getElementById('metTimeSig')?.value || '4/4';
    _metBeatsPerBar = parseInt(ts.split('/')[0]);
    const container = document.getElementById('metBeats');
    container.innerHTML = Array.from({length: _metBeatsPerBar}, (_, i) => `<div id="metBeat${i}" style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.08);transition:all 0.05s"></div>`).join('');
    if (_metInterval) { clearInterval(_metInterval); _metInterval = null; metToggle(); }
}
function metToggle() {
    if (_metInterval) {
        clearInterval(_metInterval); _metInterval = null;
        document.getElementById('metStartBtn').textContent = '▶ Start';
        document.getElementById('metStartBtn').classList.remove('btn-danger');
        document.getElementById('metStartBtn').classList.add('btn-primary');
        return;
    }
    if (!mtAudioContext) mtAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    mtAudioContext.resume();
    const bpm = parseInt(document.getElementById('metBPMSlider')?.value) || 120;
    _metBeat = 0;
    document.getElementById('metStartBtn').textContent = '⏹ Stop';
    document.getElementById('metStartBtn').classList.add('btn-danger');
    document.getElementById('metStartBtn').classList.remove('btn-primary');
    
    function tick() {
        const isDown = _metBeat % _metBeatsPerBar === 0;
        const o = mtAudioContext.createOscillator(), g = mtAudioContext.createGain();
        o.connect(g); g.connect(mtAudioContext.destination);
        o.frequency.value = isDown ? 1000 : 700;
        g.gain.setValueAtTime(0.4, mtAudioContext.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, mtAudioContext.currentTime + 0.08);
        o.start(); o.stop(mtAudioContext.currentTime + 0.08);
        for (let i = 0; i < _metBeatsPerBar; i++) {
            const el = document.getElementById('metBeat' + i);
            if (el) {
                const active = i === _metBeat % _metBeatsPerBar;
                el.style.background = active ? (isDown ? 'var(--red)' : 'var(--accent)') : 'rgba(255,255,255,0.08)';
                el.style.transform = active ? 'scale(1.4)' : 'scale(1)';
            }
        }
        _metBeat++;
    }
    tick();
    _metInterval = setInterval(tick, 60000 / bpm);
}

console.log('🎸 Deadcetera Band App modules loaded');

// Register new pages
pageRenderers.equipment = renderEquipmentPage;
pageRenderers.contacts = renderContactsPage;
pageRenderers.admin = renderSettingsPage;

// ---- SETTINGS (Enhanced with tabs) ----
function renderSettingsPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>⚙️ Settings & Admin</h1><p>Configuration, band management, support</p></div>
    <div class="tab-bar" id="settingsTabs">
        <button class="tab-btn active" onclick="settingsTab('profile',this)">👤 Profile</button>
        <button class="tab-btn" onclick="settingsTab('band',this)">🎸 Band</button>
        <button class="tab-btn" onclick="settingsTab('data',this)">📊 Data</button>
        <button class="tab-btn" onclick="settingsTab('feedback',this)">🐛 Feedback</button>
        <button class="tab-btn" onclick="settingsTab('about',this)">ℹ️ About</button>
    </div>
    <div id="settingsContent"></div>`;
    settingsTab('profile');
}

function settingsTab(tab, btn) {
    if (btn) document.querySelectorAll('#settingsTabs .tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const el = document.getElementById('settingsContent');
    if (!el) return;
    const cu = localStorage.getItem('deadcetera_current_user') || '';
    const ci = localStorage.getItem('deadcetera_instrument') || '';
    const bn = localStorage.getItem('deadcetera_band_name') || 'Deadcetera';
    
    const panels = {
    profile: `
        <div class="app-card"><h3>👤 Your Profile</h3>
            <div class="form-grid">
                <div class="form-row"><label class="form-label">Who are you?</label>
                    <select class="app-select" id="settingsUser" onchange="localStorage.setItem('deadcetera_current_user',this.value)">
                        <option value="">Select your name...</option>
                        ${Object.entries(bandMembers).map(([k,m])=>'<option value="'+k+'"'+(cu===k?' selected':'')+'>'+m.name+' — '+m.role+'</option>').join('')}
                    </select></div>
                <div class="form-row"><label class="form-label">Primary Instrument</label>
                    <select class="app-select" id="settingsInst" onchange="localStorage.setItem('deadcetera_instrument',this.value)">
                        <option value="">Select...</option>
                        ${['bass|🎸 Bass','leadGuitar|🎸 Lead Guitar','rhythmGuitar|🎸 Rhythm Guitar','keys|🎹 Keys','drums|🥁 Drums','vocals|🎤 Vocals'].map(o=>{const[v,l]=o.split('|');return'<option value="'+v+'"'+(ci===v?' selected':'')+'>'+l+'</option>';}).join('')}
                    </select></div>
            </div>
            <div style="margin-top:12px;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.82em;color:var(--text-dim)">
                🔗 Google: <span style="color:${isUserSignedIn && currentUserEmail ? '#10b981' : 'var(--text-muted)'}">${isUserSignedIn && currentUserEmail ? currentUserEmail : 'Not connected — click Sign In above'}</span>
            </div>
        </div>
        <div class="app-card"><h3>🔔 Preferences</h3>
            <label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;font-size:0.88em;color:var(--text-muted)">
                <input type="checkbox" style="accent-color:var(--accent);width:16px;height:16px" checked> Auto-save recordings to Google Drive
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;font-size:0.88em;color:var(--text-muted)">
                <input type="checkbox" style="accent-color:var(--accent);width:16px;height:16px" checked> Show status badges in song list
            </label>
            <label style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;font-size:0.88em;color:var(--text-muted)">
                <input type="checkbox" style="accent-color:var(--accent);width:16px;height:16px"> Enable metronome count-in by default
            </label>
        </div>`,
        
    band: `
        <div class="app-card"><h3>🎸 Band Configuration</h3>
            <div class="form-row"><label class="form-label">Band Name</label>
                <div style="display:flex;gap:8px"><input class="app-input" id="setBandName" value="${bn}">
                <button class="btn btn-sm btn-primary" onclick="localStorage.setItem('deadcetera_band_name',document.getElementById('setBandName').value);alert('✅ Updated!')">Save</button></div></div>
            <div class="form-row" style="margin-top:12px"><label class="form-label">Band Logo</label>
                <div style="display:flex;align-items:center;gap:12px">
                    <div style="width:48px;height:48px;border-radius:10px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:1.5em;border:1px dashed var(--border)">🎸</div>
                    <div><input type="file" accept="image/*" class="app-input" style="padding:6px;font-size:0.82em">
                    <div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">200×200 PNG recommended. Displays in header.</div></div>
                </div></div>
        </div>
        <div class="app-card"><h3>👥 Band Members</h3>
            <div id="membersList">${Object.entries(bandMembers).map(([k,m])=>`
                <div class="list-item" style="padding:10px 12px">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-glow);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8em;color:var(--accent-light)">${m.name.charAt(0)}</div>
                    <div style="flex:1"><div style="font-weight:600;font-size:0.9em">${m.name}</div>
                        <div style="font-size:0.75em;color:var(--text-dim)">${m.role}${m.sings?' · Vocals':''}${m.leadVocals?' (Lead)':''}</div></div>
                    <button class="btn btn-sm btn-ghost" onclick="editMember('${k}')" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="removeMember('${k}')" title="Remove" style="color:var(--red)">✕</button>
                </div>`).join('')}</div>
            <div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.03);border:1px dashed var(--border);border-radius:8px">
                <div style="font-weight:600;font-size:0.85em;margin-bottom:8px;color:var(--text-muted)">+ Add New Member</div>
                <div class="form-grid">
                    <div class="form-row"><label class="form-label">Name</label><input class="app-input" id="newMemberName" placeholder="First name"></div>
                    <div class="form-row"><label class="form-label">Role</label><input class="app-input" id="newMemberRole" placeholder="e.g. Lead Guitar"></div>
                    <div class="form-row"><label class="form-label">Email</label><input class="app-input" id="newMemberEmail" placeholder="google@email.com"></div>
                    <div class="form-row"><label class="form-label">Sings?</label><select class="app-select" id="newMemberSings"><option value="no">No</option><option value="harmony">Harmony</option><option value="lead">Lead + Harmony</option></select></div>
                </div>
                <button class="btn btn-success btn-sm" onclick="addNewMember()" style="margin-top:8px">➕ Add Member</button>
            </div>
        </div>`,
        
    data: `
        <div class="app-card"><h3>📊 Data Management</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                <button class="btn btn-ghost" onclick="showAdminPanel()">📈 Activity Dashboard</button>
                <button class="btn btn-ghost" onclick="exportAllData()">💾 Export All Data</button>
                <button class="btn btn-ghost" style="color:var(--red)" onclick="if(confirm('Clear local cache? You\\'ll need to re-select your profile.')){localStorage.clear();location.reload()}">🗑 Clear Cache</button>
            </div>
            <div style="font-size:0.82em;color:var(--text-dim);padding:10px;background:rgba(255,255,255,0.03);border-radius:8px">
                <div>💾 Backend: Firebase Realtime DB (<code style="color:var(--accent-light)">deadcetera-35424</code>)</div>
                <div>📁 Files: Google Drive (shared folder)</div>
                <div>🌐 Hosting: GitHub Pages</div>
                <div style="margin-top:6px">📊 Songs in database: <b style="color:var(--text)">${(typeof allSongs!=='undefined'?allSongs:[]).length}</b></div>
            </div>
        </div>
        <div class="app-card"><h3>🎸 Chord Chart Import</h3>
            <p style="font-size:0.85em;color:var(--text-muted);margin-bottom:12px">Bulk import chord charts from Ultimate Guitar for all songs. Picks the highest-rated "Chords" version automatically.</p>
            <button class="btn btn-primary" onclick="bulkImportUGCharts()">🚀 Bulk Import from Ultimate Guitar</button>
        </div>
        <div class="app-card"><h3>🔄 Sync Status</h3>
            <div id="syncStatus" style="font-size:0.85em;color:var(--text-muted)">Checking...</div>
        </div>`,
        
    feedback: `
        <div class="app-card"><h3>🐛 Report Bug / Request Feature</h3>
            <div class="form-row"><label class="form-label">Type</label>
                <select class="app-select" id="fbType"><option value="bug">🐛 Bug Report</option><option value="feature">💡 Feature Request</option><option value="other">💬 General Feedback</option></select></div>
            <div class="form-row"><label class="form-label">Priority</label>
                <select class="app-select" id="fbPriority"><option value="low">🟢 Low</option><option value="medium">🟡 Medium</option><option value="high">🔴 High</option></select></div>
            <div class="form-row"><label class="form-label">Description</label>
                <textarea class="app-textarea" id="fbDesc" placeholder="Describe the issue or feature idea in detail..."></textarea></div>
            <div class="form-row"><label class="form-label">Screenshot (optional)</label>
                <input type="file" id="fbFile" accept="image/*" class="app-input" style="padding:8px"></div>
            <button class="btn btn-primary" onclick="submitFeedback()">📤 Submit Feedback</button>
        </div>
        <div class="app-card"><h3>📋 Submitted Feedback</h3><div id="fbHistory" style="color:var(--text-dim);font-size:0.85em">Loading...</div></div>`,
        
    about: `
        <div class="app-card"><h3>ℹ️ About Deadcetera</h3>
            <div style="text-align:center;padding:16px 0">
                <div style="font-size:2.5em;margin-bottom:8px">🎸</div>
                <div style="font-size:1.3em;font-weight:800;background:linear-gradient(135deg,#667eea,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${bn}</div>
                <div style="font-size:0.85em;color:var(--text-dim);margin-top:4px">Band HQ — Less admin. More jams. 🤘</div>
            </div>
            <div style="font-size:0.85em;line-height:2;color:var(--text-muted)">
                ${[['Version','3.1.0'],['Build', document.querySelector('meta[name="build-version"]')?.content || 'unknown'],['Created by','Drew Merrill'],['Platform','Firebase + GitHub Pages'],['Band Members',Object.values(bandMembers).map(m=>m.name).join(', ')],['Total Songs',''+(typeof allSongs!=='undefined'?allSongs.length:0)],['License','Private — All Rights Reserved']].map(([k,v])=>'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>'+k+'</span><span style="color:var(--text);font-weight:600">'+v+'</span></div>').join('')}
            </div>
            <div style="margin-top:16px;text-align:center;font-size:0.78em;color:var(--text-dim);line-height:1.6">
                © 2025–2026 Drew Merrill. All rights reserved.<br>
                Built with ❤️ for live music.<br>
                <a href="https://github.com" target="_blank" style="color:var(--accent-light)">GitHub</a> · 
                <a href="mailto:drewmerrill1029@gmail.com" style="color:var(--accent-light)">Contact</a>
            </div>
        </div>`
    };
    
    el.innerHTML = panels[tab] || panels.profile;
    
    // Post-render: load feedback history
    if (tab === 'feedback') loadFeedbackHistory();
    if (tab === 'data') checkSyncStatus();
}

async function loadFeedbackHistory() {
    const el = document.getElementById('fbHistory');
    if (!el) return;
    try {
        const data = toArray(await loadBandDataFromDrive('_band','feedback') || []);
        if (!data.length) { el.innerHTML = 'No feedback submitted yet.'; return; }
        data.sort((a,b) => (b.date||'').localeCompare(a.date||''));
        el.innerHTML = data.slice(0,10).map(f => `<div class="list-item" style="padding:8px 10px;font-size:0.85em">
            <span style="min-width:20px">${f.type==='bug'?'🐛':f.type==='feature'?'💡':'💬'}</span>
            <div style="flex:1"><div>${f.description?.substring(0,80)||'No description'}${f.description?.length>80?'...':''}</div>
            <div style="font-size:0.75em;color:var(--text-dim)">${f.user||'anon'} · ${f.date?new Date(f.date).toLocaleDateString():''}</div></div>
        </div>`).join('');
    } catch(e) { el.innerHTML = 'Could not load feedback.'; }
}

function checkSyncStatus() {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const isAuth = isUserSignedIn && !!currentUserEmail;
    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${isAuth?'var(--green)':'var(--yellow)'}"></span>
            Google: ${isAuth ? currentUserEmail : 'Not signed in'}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--green)"></span>
            Firebase: Active
        </div>
        <div style="display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--green)"></span>
            Local Storage: ${Object.keys(localStorage).filter(k=>k.startsWith('deadcetera')).length} keys cached
        </div>`;
}

function addNewMember() {
    const name = document.getElementById('newMemberName')?.value;
    const role = document.getElementById('newMemberRole')?.value;
    const sings = document.getElementById('newMemberSings')?.value;
    if (!name) { alert('Name required'); return; }
    const key = name.toLowerCase().replace(/\s/g,'');
    bandMembers[key] = { name, role: role||'Member', sings: sings!=='no', leadVocals: sings==='lead', harmonies: sings!=='no' };
    alert('✅ ' + name + ' added! Note: To make permanent, update data.js on GitHub.');
    settingsTab('band');
}

function removeMember(key) {
    if (!confirm('Remove ' + (bandMembers[key]?.name||key) + ' from the band roster?')) return;
    delete bandMembers[key];
    alert('Removed. Update data.js on GitHub to make permanent.');
    settingsTab('band');
}

async function editMember(key) {
    const m = bandMembers[key];
    if (!m) return;
    const formId = `editMemberForm_${key}`;
    if (document.getElementById(formId)) return;
    const editBtn = document.querySelector(`[onclick*="editMember('${key}')"]`) ||
                    document.querySelector(`[onclick*='editMember("${key}")']`);
    if (!editBtn) return;
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 0;flex-wrap:wrap';
    form.innerHTML = `
        <span style="color:var(--text-muted);font-size:0.85em;min-width:60px">Role:</span>
        <input id="memberRoleInput_${key}" class="app-input" value="${m.role || ''}"
            placeholder="e.g. Lead Guitar, Vocals..."
            style="flex:1;min-width:150px" autocomplete="off">
        <button onclick="saveMemberRole('${key}')" class="btn btn-primary btn-sm">Save</button>
        <button onclick="document.getElementById('${formId}')?.remove()" class="btn btn-ghost btn-sm">✕</button>
    `;
    editBtn.after(form);
    document.getElementById(`memberRoleInput_${key}`)?.focus();
}

async function saveMemberRole(key) {
    const newRole = document.getElementById(`memberRoleInput_${key}`)?.value?.trim();
    if (newRole === undefined) return;
    bandMembers[key].role = newRole;
    document.getElementById(`editMemberForm_${key}`)?.remove();
    showToast('✅ Role updated');
    settingsTab('band');
}

function exportAllData() {
    const data = {};
    Object.keys(localStorage).filter(k => k.startsWith('deadcetera')).forEach(k => { data[k] = localStorage.getItem(k); });
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'deadcetera-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
}

async function submitFeedback() {
    const d = document.getElementById('fbDesc')?.value;
    if (!d) { alert('Please describe the issue.'); return; }
    const fb = { type: document.getElementById('fbType')?.value, priority: document.getElementById('fbPriority')?.value, description: d, user: localStorage.getItem('deadcetera_current_user')||'anon', date: new Date().toISOString() };
    const ex = toArray(await loadBandDataFromDrive('_band','feedback')||[]);
    ex.push(fb);
    await saveBandDataToDrive('_band','feedback', ex);
    alert('✅ Feedback submitted! Thanks.');
    document.getElementById('fbDesc').value = '';
    loadFeedbackHistory();
}

// ---- EQUIPMENT (#28) ----
function renderEquipmentPage(el){el.innerHTML=`<div class="page-header"><h1>🎛️ Equipment</h1><p>Band gear inventory</p></div><button class="btn btn-primary" onclick="addEquipment()" style="margin-bottom:12px">+ Add Gear</button><div id="equipList"></div>`;loadEquipment();}
async function loadEquipment() {
    const d = toArray(await loadBandDataFromDrive('_band', 'equipment') || []);
    const el = document.getElementById('equipList');
    if (!el) return;
    if (!d.length) {
        el.innerHTML = '<div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No equipment yet. Click "+ Add Gear" to start.</div>';
        return;
    }
    const g = {};
    d.forEach((item, i) => {
        const o = item.owner || 'shared';
        if (!g[o]) g[o] = [];
        g[o].push({ ...item, _idx: i });
    });
    el.innerHTML = Object.entries(g).map(([o, items]) => `
        <div class="app-card">
            <h3>${bandMembers[o]?.name || 'Shared / Band'}</h3>
            ${items.map(i => `
                <div class="list-item" style="padding:8px 10px">
                    <div style="flex:1">
                        <div style="font-weight:600;font-size:0.9em">${i.name || ''}</div>
                        <div style="font-size:0.78em;color:var(--text-muted)">${[i.brand, i.model, i.category].filter(Boolean).join(' · ')}</div>
                        ${i.notes ? `<div style="font-size:0.75em;color:var(--text-dim);margin-top:2px">${i.notes}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        ${i.manualUrl ? `<a href="${i.manualUrl}" target="_blank" class="btn btn-sm btn-ghost">📄</a>` : ''}
                        <button onclick="deleteEquip(${i._idx})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1em;padding:4px" title="Delete">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}
function addEquipment(){const el=document.getElementById('equipList');el.innerHTML=`<div class="app-card"><h3>Add Gear</h3><div class="form-grid">${[['Name','eqN',''],['Category','eqC','select:amp,guitar,pedal,mic,cable,pa,drum,keys,other'],['Brand','eqB',''],['Model','eqM',''],['Owner','eqO','members'],['Serial #','eqS',''],['Manual URL','eqU',''],['Value ($)','eqV','number']].map(([l,id,t])=>{if(t==='members')return'<div class="form-row"><label class="form-label">'+l+'</label><select class="app-select" id="'+id+'"><option value="">Shared</option>'+Object.entries(bandMembers).map(([k,m])=>'<option value="'+k+'">'+m.name+'</option>').join('')+'</select></div>';if(t.startsWith('select:'))return'<div class="form-row"><label class="form-label">'+l+'</label><select class="app-select" id="'+id+'">'+t.slice(7).split(',').map(v=>'<option value="'+v+'">'+v+'</option>').join('')+'</select></div>';return'<div class="form-row"><label class="form-label">'+l+'</label><input class="app-input" id="'+id+'" '+(t==='number'?'type="number"':'')+' placeholder="'+l+'"></div>';}).join('')}</div><div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="eqNotes"></textarea></div><div style="display:flex;gap:8px"><button class="btn btn-success" onclick="saveEquip()">💾 Save</button><button class="btn btn-ghost" onclick="loadEquipment()">Cancel</button></div></div>`+el.innerHTML;}
async function saveEquip(){const eq={name:document.getElementById('eqN')?.value,category:document.getElementById('eqC')?.value,brand:document.getElementById('eqB')?.value,model:document.getElementById('eqM')?.value,owner:document.getElementById('eqO')?.value,serial:document.getElementById('eqS')?.value,manualUrl:document.getElementById('eqU')?.value,value:document.getElementById('eqV')?.value,notes:document.getElementById('eqNotes')?.value};if(!eq.name){alert('Name required');return;}const ex=toArray(await loadBandDataFromDrive('_band','equipment')||[]);ex.push(eq);await saveBandDataToDrive('_band','equipment',ex);alert('✅ Saved!');loadEquipment();}

async function saveEquip() {
    const item = {
        name: document.getElementById('eqN')?.value?.trim() || '',
        category: document.getElementById('eqC')?.value || 'other',
        brand: document.getElementById('eqB')?.value?.trim() || '',
        model: document.getElementById('eqM')?.value?.trim() || '',
        owner: document.getElementById('eqO')?.value || '',
        serial: document.getElementById('eqS')?.value?.trim() || '',
        manualUrl: document.getElementById('eqU')?.value?.trim() || '',
        value: document.getElementById('eqV')?.value || '',
        notes: document.getElementById('eqNotes')?.value?.trim() || '',
        addedAt: new Date().toISOString(),
        addedBy: currentUserEmail
    };
    if (!item.name) { showToast('Enter a name for this gear'); return; }
    const existing = toArray(await loadBandDataFromDrive('_band', 'equipment') || []);
    existing.push(item);
    await saveBandDataToDrive('_band', 'equipment', existing);
    showToast('✅ Gear saved!');
    await loadEquipment();
}

async function deleteEquip(index) {
    const existing = toArray(await loadBandDataFromDrive('_band', 'equipment') || []);
    existing.splice(index, 1);
    await saveBandDataToDrive('_band', 'equipment', existing);
    showToast('🗑️ Gear removed');
    await loadEquipment();
}

// ---- CONTACTS (#27) ----
function renderContactsPage(el){el.innerHTML=`<div class="page-header"><h1>👥 Contacts</h1><p>Booking agents, sound engineers, venue contacts</p></div><button class="btn btn-primary" onclick="addContact()" style="margin-bottom:12px">+ Add Contact</button><div id="ctList"></div>`;loadContacts();}
async function loadContacts(){const d=toArray(await loadBandDataFromDrive('_band','contacts')||[]);const el=document.getElementById('ctList');if(!el)return;if(!d.length){el.innerHTML='<div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No contacts yet.</div>';return;}el.innerHTML=d.map(c=>`<div class="list-item" style="padding:10px 12px"><div style="flex:1"><div style="font-weight:600;font-size:0.9em">${c.firstName||''} ${c.lastName||''}</div><div style="font-size:0.78em;color:var(--text-muted)">${c.title||''} ${c.company?'@ '+c.company:''}</div></div><div style="display:flex;gap:10px;font-size:0.8em;color:var(--text-muted);flex-wrap:wrap">${c.email?'<span>📧 '+c.email+'</span>':''}${c.cell?'<span>📱 '+c.cell+'</span>':''}</div></div>`).join('');}
function addContact(){const el=document.getElementById('ctList');el.innerHTML=`<div class="app-card"><h3>Add Contact</h3><div class="form-grid">${[['First Name','ctF'],['Last Name','ctL'],['Email','ctE'],['Cell','ctP'],['Title','ctT'],['Company/Venue','ctC']].map(([l,id])=>'<div class="form-row"><label class="form-label">'+l+'</label><input class="app-input" id="'+id+'"></div>').join('')}</div><div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="ctN"></textarea></div><div style="display:flex;gap:8px"><button class="btn btn-success" onclick="saveCt()">💾 Save</button><button class="btn btn-ghost" onclick="loadContacts()">Cancel</button></div></div>`+el.innerHTML;}
async function saveCt(){const c={firstName:document.getElementById('ctF')?.value,lastName:document.getElementById('ctL')?.value,email:document.getElementById('ctE')?.value,cell:document.getElementById('ctP')?.value,title:document.getElementById('ctT')?.value,company:document.getElementById('ctC')?.value,notes:document.getElementById('ctN')?.value};if(!c.firstName&&!c.lastName){alert('Name required');return;}const ex=toArray(await loadBandDataFromDrive('_band','contacts')||[]);ex.push(c);await saveBandDataToDrive('_band','contacts',ex);alert('✅ Saved!');loadContacts();}

// ---- FIX #11: Step 2 header ----


console.log('📦 Settings, Equipment, Contacts loaded');

// Band dropdown filter (#7)
function filterByBand(band) {
    currentFilter = band || 'all';
    const searchTerm = document.getElementById('songSearch')?.value || '';
    renderSongs(currentFilter, searchTerm);
}

// ---- MOISES ENHANCED (#18) ----
function moisesAddYouTube() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const container = document.getElementById('moisesStemsContainer');
    container.innerHTML = `
    <div class="app-card" style="background:rgba(255,255,255,0.03)">
        <h4 style="color:var(--accent-light);margin-bottom:10px">📺 Add YouTube Link for Stem Separation</h4>
        <div class="form-row"><label class="form-label">YouTube URL</label>
            <input class="app-input" id="moisesYTUrl" placeholder="https://youtube.com/watch?v=..."></div>
        <div class="form-row"><label class="form-label">Version Description</label>
            <input class="app-input" id="moisesYTDesc" placeholder="e.g. Grateful Dead 5/8/77 Cornell"></div>
        <div style="font-size:0.78em;color:var(--text-dim);margin:8px 0;line-height:1.5">
            <b>Workflow:</b> Copy the YouTube link → Go to <a href="https://moises.ai" target="_blank" style="color:var(--accent-light)">moises.ai</a> → 
            Paste link → Download separated stems → Upload stems back here<br>
            <b>Note:</b> Moises has a 20-minute limit. Use the Show Splitter for longer recordings.
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="saveMoisesYTLink()">💾 Save Link</button>
            <button class="btn btn-ghost" onclick="window.open('https://moises.ai','_blank')">🔗 Open Moises</button>
            <button class="btn btn-ghost" onclick="renderMoisesStems('${songTitle.replace(/'/g,"\\'")}',bandKnowledgeBase['${songTitle.replace(/'/g,"\\'")}']||{})">Cancel</button>
        </div>
    </div>`;
}

async function saveMoisesYTLink() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const url = document.getElementById('moisesYTUrl')?.value;
    const desc = document.getElementById('moisesYTDesc')?.value;
    if (!url) { alert('URL required'); return; }
    const existing = await loadMoisesStems(songTitle) || {};
    if (!existing.sourceLinks) existing.sourceLinks = [];
    existing.sourceLinks.push({ url, description: desc, type: 'youtube', addedBy: localStorage.getItem('deadcetera_current_user')||'anon', date: new Date().toISOString() });
    existing.sourceVersion = desc || url;
    await saveMoisesStems(songTitle, existing);
    alert('✅ YouTube link saved!');
    renderMoisesStems(songTitle, bandKnowledgeBase[songTitle]||{});
}

function moisesShowSplitter() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const container = document.getElementById('moisesStemsContainer');
    container.innerHTML = `
    <div class="app-card" style="background:rgba(255,255,255,0.03)">
        <h4 style="color:var(--yellow);margin-bottom:10px">✂️ Show Splitter — Break Long Recordings for Moises</h4>
        <p style="font-size:0.85em;color:var(--text-muted);margin-bottom:12px">
            Moises.ai has a <b>20-minute limit</b>. If you have a full show recording, you need to split it into sections first.
        </p>
        <div class="form-row"><label class="form-label">Source URL or File</label>
            <input class="app-input" id="splitterSource" placeholder="YouTube URL or archive.org link"></div>
        <div class="form-row"><label class="form-label">Song start time</label>
            <input class="app-input" id="splitterStart" placeholder="e.g. 45:30 (minutes:seconds)"></div>
        <div class="form-row"><label class="form-label">Song end time</label>
            <input class="app-input" id="splitterEnd" placeholder="e.g. 52:15"></div>
        <div style="font-size:0.78em;color:var(--text-dim);margin:8px 0;line-height:1.5">
            <b>How to split:</b><br>
            1. Note the start/end times for "${songTitle}" in the recording<br>
            2. Use a free tool like <a href="https://mp3cut.net" target="_blank" style="color:var(--accent-light)">mp3cut.net</a> or 
               <a href="https://audiotrimmer.com" target="_blank" style="color:var(--accent-light)">audiotrimmer.com</a><br>
            3. Download the trimmed clip (under 20 min)<br>
            4. Upload to <a href="https://moises.ai" target="_blank" style="color:var(--accent-light)">moises.ai</a> for stem separation<br>
            5. Upload the stems back here
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="saveSplitterInfo()">💾 Save Timestamps</button>
            <button class="btn btn-ghost" onclick="renderMoisesStems('${songTitle.replace(/'/g,"\\'")}',bandKnowledgeBase['${songTitle.replace(/'/g,"\\'")}']||{})">Cancel</button>
        </div>
    </div>`;
}

async function saveSplitterInfo() {
    const songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) return;
    const source = document.getElementById('splitterSource')?.value;
    const start = document.getElementById('splitterStart')?.value;
    const end = document.getElementById('splitterEnd')?.value;
    const existing = await loadMoisesStems(songTitle) || {};
    existing.showSplitter = { source, startTime: start, endTime: end, addedBy: localStorage.getItem('deadcetera_current_user')||'anon', date: new Date().toISOString() };
    await saveMoisesStems(songTitle, existing);
    alert('✅ Timestamps saved!');
    renderMoisesStems(songTitle, bandKnowledgeBase[songTitle]||{});
}

// ---- SETLIST SONG HISTORY (#24) ----
// Store gig history for hover tooltips
window._gigHistory = null;
async function loadGigHistory() {
    if (window._gigHistory) return window._gigHistory;
    try {
        const gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        const setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        const history = {};
        setlists.forEach(sl => {
            (sl.sets || []).forEach((set, si) => {
                (set.songs || []).forEach((song, songIdx) => {
                    const title = typeof song === 'string' ? song : song.title;
                    if (!title) return;
                    if (!history[title]) history[title] = [];
                    const isOpener = songIdx === 0;
                    const isCloser = songIdx === (set.songs.length - 1);
                    const setName = set.name || ('Set ' + (si+1));
                    const isEncore = setName.toLowerCase().includes('encore');
                    let position = 'middle';
                    if (isEncore) position = 'encore';
                    else if (isOpener) position = 'opener';
                    else if (isCloser) position = 'closer';
                    history[title].push({ date: sl.date || '', venue: sl.venue || sl.name || '', position, set: setName });
                });
            });
        });
        // Sort each song's history by date descending
        Object.values(history).forEach(arr => arr.sort((a,b) => (b.date||'').localeCompare(a.date||'')));
        window._gigHistory = history;
        return history;
    } catch(e) { console.log('Gig history load error:', e); return {}; }
}

function getSongHistoryTooltip(title) {
    const h = window._gigHistory?.[title];
    if (!h || !h.length) return 'No gig history for this song yet';
    return h.slice(0, 8).map(g => {
        const posIcon = g.position === 'opener' ? '🟢' : g.position === 'closer' ? '🔴' : g.position === 'encore' ? '⭐' : '·';
        return `${g.date||'?'} — ${g.venue||'?'} ${posIcon} ${g.position}`;
    }).join('\n') + (h.length > 8 ? '\n... +' + (h.length-8) + ' more' : '');
}

// ---- TAB BAR CSS ----
(function(){
    if(document.getElementById('tab-bar-css'))return;
    const s=document.createElement('style');s.id='tab-bar-css';
    s.textContent=`
        .tab-bar{display:flex;gap:6px;overflow-x:auto;padding:4px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:16px;scrollbar-width:none}
        .tab-bar::-webkit-scrollbar{display:none}
        .tab-btn{background:none;border:none;color:#64748b;padding:8px 14px;font-size:0.82em;font-weight:600;cursor:pointer;border-radius:8px;white-space:nowrap;transition:all 0.15s;font-family:inherit}
        .tab-btn:hover{color:#cbd5e1;background:rgba(255,255,255,0.06)}
        .tab-btn.active{color:#ffffff;background:#667eea}
    `;
    document.head.appendChild(s);
})();

console.log('🔧 Moises enhanced, gig history, tab CSS loaded');

// PLAYLISTS — PHASE 1: DATA LAYER
// ============================================================================
// All playlist data lives in Firebase (via saveBandDataToDrive / loadBandDataFromDrive)
// under two top-level keys:
//   _band / playlists        — the playlist objects (shared, writable by all)
//   _band / playlist_listens — per-user listened tracking (shared, writable by all)
//
// Listening Party state lives in Firebase Realtime DB at:
//   /listening_parties/{playlistId}
//
// Playlist types: northstar | pregig | practice | ondeck | custom
// ============================================================================

// ── Constants ────────────────────────────────────────────────────────────────

const PLAYLIST_TYPES = {
    setlist:   { label: '🎤 Setlist',        color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)'  },
    rehearsal: { label: '🎸 Rehearsal',      color: '#34d399', bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.3)'  },
    northstar: { label: '⭐ North Star',    color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)' },
    practice:  { label: '🏋️ Practice',      color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.3)'  },
    custom:    { label: '🎵 Custom',         color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', border: 'rgba(148,163,184,0.3)' },
};

// Source priority order for resolvePlaylistSongUrl
const SOURCE_PRIORITY = ['spotify', 'youtube', 'archive', 'soundcloud', 'other'];

// ── Storage helpers ───────────────────────────────────────────────────────────

async function loadPlaylists() {
    const data = await loadBandDataFromDrive('_band', 'playlists');
    return toArray(data || []);
}

async function savePlaylists(playlists) {
    return await saveBandDataToDrive('_band', 'playlists', playlists);
}

async function loadPlaylistListens() {
    const data = await loadBandDataFromDrive('_band', 'playlist_listens');
    return (data && typeof data === 'object') ? data : {};
}

async function savePlaylistListens(listens) {
    return await saveBandDataToDrive('_band', 'playlist_listens', listens);
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

async function createPlaylist(fields = {}) {
    const playlists = await loadPlaylists();
    const id = 'pl_' + Date.now();
    const userKey = getCurrentMemberKey() || 'unknown';
    const now = new Date().toISOString();

    const playlist = {
        id,
        name:           fields.name        || 'Untitled Playlist',
        type:           fields.type        || 'custom',
        description:    fields.description || '',
        createdBy:      userKey,
        createdAt:      now,
        updatedAt:      now,
        linkedSetlistId: fields.linkedSetlistId || null,
        linkedGigId:    fields.linkedGigId || null,
        // songs only stored here when NOT linked to a setlist
        songs:          fields.linkedSetlistId ? [] : (fields.songs || []),
    };

    playlists.push(playlist);
    await savePlaylists(playlists);
    console.log('✅ Playlist created:', id);
    return playlist;
}

async function updatePlaylist(playlistId, changes = {}) {
    const playlists = await loadPlaylists();
    const idx = playlists.findIndex(p => p.id === playlistId);
    if (idx === -1) { console.warn('Playlist not found:', playlistId); return null; }

    playlists[idx] = {
        ...playlists[idx],
        ...changes,
        id:        playlistId,               // never overwrite id
        updatedAt: new Date().toISOString(),
    };
    await savePlaylists(playlists);
    return playlists[idx];
}

async function deletePlaylist(playlistId) {
    const playlists = await loadPlaylists();
    const filtered = playlists.filter(p => p.id !== playlistId);
    await savePlaylists(filtered);

    // Clean up listened data for this playlist
    const listens = await loadPlaylistListens();
    delete listens[playlistId];
    await savePlaylistListens(listens);

    // End any active listening party
    if (firebaseDB) {
        await firebaseDB.ref(`listening_parties/${playlistId}`).remove().catch(() => {});
    }
    console.log('🗑️ Playlist deleted:', playlistId);
    return true;
}

// ── Song resolution ───────────────────────────────────────────────────────────
// Returns the songs array for a playlist, handling live-sync from setlist.
// Also merges in per-song notes/overrides stored on the playlist.

async function getPlaylistSongs(playlist) {
    if (!playlist) return [];

    // Live-synced from setlist
    if (playlist.linkedSetlistId) {
        const allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        const lid = playlist.linkedSetlistId || '';
        const setlist = allSetlists.find(sl =>
            (sl.id && sl.id === lid) ||
            sl.name === lid ||
            `${sl.name} (${sl.date})` === lid ||
            `${sl.name} ${sl.date}` === lid ||
            lid.startsWith(sl.name)
        );

        if (!setlist) {
            // Setlist was deleted — return last-known songs with a flag
            return (playlist.songs || []).map(s => ({ ...s, _setlistMissing: true }));
        }

        // Flatten all sets into ordered song array
        const flatSongs = [];
        (setlist.sets || []).forEach(set => {
            (set.songs || []).forEach(item => {
                const title = typeof item === 'string' ? item : item.title;
                if (title) flatSongs.push(title);
            });
        });

        // Build song entries, merging overrides stored on the playlist (by title)
        const overrideMap = {};
        (playlist.songs || []).forEach(s => { overrideMap[s.songTitle] = s; });

        return flatSongs.map(title => ({
            songTitle:       title,
            note:            overrideMap[title]?.note            || '',
            preferredSource: overrideMap[title]?.preferredSource || 'auto',
            customUrl:       overrideMap[title]?.customUrl       || null,
        }));
    }

    // Manual playlist — return stored songs as-is
    return toArray(playlist.songs || []);
}

// ── URL resolution ────────────────────────────────────────────────────────────
// Given a playlist song entry, returns the best available URL to play.
// Priority: customUrl → preferredSource match → spotify → youtube → archive → search fallback

async function resolvePlaylistSongUrl(playlistSong) {
    const { songTitle, preferredSource, customUrl } = playlistSong;

    // 1. Manual override always wins
    if (customUrl) return { url: customUrl, source: detectUrlSource(customUrl) };

    // 2. Load the song's saved versions from Drive
    const versions = toArray(await loadBandDataFromDrive(songTitle, 'spotify_versions') || []);
    const allUrls = versions.map(v => ({
        url:    v.url || v.spotifyUrl || '',
        source: detectUrlSource(v.url || v.spotifyUrl || ''),
    })).filter(v => v.url);

    // 3. Try preferred source first
    if (preferredSource && preferredSource !== 'auto') {
        const match = allUrls.find(v => v.source === preferredSource);
        if (match) return match;
    }

    // 4. Try sources in priority order
    for (const src of SOURCE_PRIORITY) {
        const match = allUrls.find(v => v.source === src);
        if (match) return match;
    }

    // 5. Practice tracks as fallback
    const practiceTracks = toArray(await loadBandDataFromDrive(songTitle, 'practice_tracks') || []);
    if (practiceTracks.length) {
        const pt = practiceTracks[0];
        const url = pt.url || pt.spotifyUrl || '';
        if (url) return { url, source: detectUrlSource(url) };
    }

    // 6. Spotify search fallback — always works
    const fallbackUrl = `https://open.spotify.com/search/${encodeURIComponent(songTitle)}`;
    return { url: fallbackUrl, source: 'search' };
}

// Detect which streaming platform a URL belongs to
function detectUrlSource(url) {
    if (!url) return 'other';
    const u = url.toLowerCase();
    if (u.includes('spotify.com'))               return 'spotify';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('archive.org'))               return 'archive';
    if (u.includes('soundcloud.com'))            return 'soundcloud';
    return 'other';
}

// Source display metadata (icon, label, color)
function getSourceMeta(source) {
    const map = {
        spotify:    { icon: '🟢', label: 'Spotify',       color: '#1db954', bg: 'rgba(29,185,84,0.15)'  },
        youtube:    { icon: '🔴', label: 'YouTube',       color: '#ff0000', bg: 'rgba(255,0,0,0.15)'    },
        archive:    { icon: '🟠', label: 'Archive.org',   color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
        soundcloud: { icon: '🟣', label: 'SoundCloud',    color: '#ff7700', bg: 'rgba(255,119,0,0.15)'  },
        search:     { icon: '🔍', label: 'Search Spotify',color: '#94a3b8', bg: 'rgba(148,163,184,0.15)'},
        other:      { icon: '▶️',  label: 'Play',          color: '#667eea', bg: 'rgba(102,126,234,0.15)'},
    };
    return map[source] || map.other;
}

// ── YouTube playlist export ───────────────────────────────────────────────────
// Builds an instant shareable YouTube playlist URL (no API key, no login needed).
// Limit: ~50 videos. Returns { url, count, total } so caller can show truncation notice.

function buildYouTubePlaylistUrl(resolvedSongs) {
    const MAX = 50;
    const ids = [];

    for (const song of resolvedSongs) {
        if (ids.length >= MAX) break;
        const url = song._resolvedUrl || '';
        const id = extractYouTubeId(url);
        if (id) ids.push(id);
    }

    if (!ids.length) return null;

    return {
        url:   `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}`,
        count: ids.length,
        total: resolvedSongs.length,
    };
}

// extractYouTubeId defined in core section above

// ── Share URL builder ─────────────────────────────────────────────────────────

function buildPlaylistShareUrl(playlistId) {
    const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
    return `${base}/?playlist=${encodeURIComponent(playlistId)}`;
}

async function copyPlaylistShareUrl(playlistId) {
    const url = buildPlaylistShareUrl(playlistId);
    try {
        await navigator.clipboard.writeText(url);
        showToast('📋 Link copied! Send it to the band.', 2500);
    } catch {
        // Fallback for older iOS
        prompt('Copy this link and send to the band:', url);
    }
    return url;
}

// ── Listened tracking ─────────────────────────────────────────────────────────

async function markSongListened(playlistId, songTitle) {
    if (!playlistId || !songTitle) return;
    const userKey = getCurrentMemberKey();
    if (!userKey) return;

    const listens = await loadPlaylistListens();
    if (!listens[playlistId]) listens[playlistId] = {};
    if (!listens[playlistId][userKey]) listens[playlistId][userKey] = [];

    if (!listens[playlistId][userKey].includes(songTitle)) {
        listens[playlistId][userKey].push(songTitle);
        await savePlaylistListens(listens);
        console.log(`✅ Marked listened: ${songTitle} (${userKey})`);
    }
}

// Returns an object: { drew: ['Song A', 'Song B'], chris: [...], ... }
async function getPlaylistListenedByUser(playlistId) {
    const listens = await loadPlaylistListens();
    return listens[playlistId] || {};
}

// Returns array of song titles this user has listened to in this playlist
async function getMyListenedSongs(playlistId) {
    const userKey = getCurrentMemberKey();
    if (!userKey) return [];
    const byUser = await getPlaylistListenedByUser(playlistId);
    return byUser[userKey] || [];
}

// Builds a per-member listen progress summary for display in cards
// Returns: [{ key, name, listenedCount, totalCount, pct }]
function buildListenProgress(listenedByUser, totalSongs) {
    return Object.entries(bandMembers).map(([key, member]) => {
        const count = (listenedByUser[key] || []).length;
        return {
            key,
            name:          member.name,
            listenedCount: count,
            totalCount:    totalSongs,
            pct:           totalSongs > 0 ? Math.round((count / totalSongs) * 100) : 0,
        };
    });
}

// ── Listening Party — Firebase Realtime DB ─────────────────────────────────────

let _partyListener = null;   // active Firebase listener ref, for cleanup
let _partyPlaylistId = null; // which playlist the current party is for

async function startListeningParty(playlistId, songs) {
    if (!firebaseDB) { alert('Firebase not connected — cannot start a Listening Party.'); return; }
    const userKey = getCurrentMemberKey() || 'unknown';

    const partyData = {
        active:             true,
        startedBy:          userKey,
        startedAt:          Date.now(),
        currentSongIndex:   0,
        currentSongTitle:   songs[0]?.songTitle || '',
        lastAdvancedBy:     userKey,
        lastAdvancedAt:     Date.now(),
        presence: {
            [userKey]: { online: true, lastSeen: Date.now() }
        }
    };

    await firebaseDB.ref(`listening_parties/${playlistId}`).set(partyData);
    console.log('🎉 Listening Party started:', playlistId);
    await joinListeningParty(playlistId, songs);
    return partyData;
}

async function joinListeningParty(playlistId, songs) {
    if (!firebaseDB) return;
    const userKey = getCurrentMemberKey() || 'unknown';

    // Register presence
    const presenceRef = firebaseDB.ref(`listening_parties/${playlistId}/presence/${userKey}`);
    await presenceRef.set({ online: true, lastSeen: Date.now() });
    presenceRef.onDisconnect().update({ online: false, lastSeen: Date.now() });

    // Refresh presence every 30s so lastSeen stays current
    if (window._presenceInterval) clearInterval(window._presenceInterval);
    window._presenceInterval = setInterval(() => {
        presenceRef.update({ lastSeen: Date.now() }).catch(() => {});
    }, 30000);

    // Detach any previous listener
    leaveListeningParty(false);

    _partyPlaylistId = playlistId;
    _partyListener = firebaseDB.ref(`listening_parties/${playlistId}`);

    _partyListener.on('value', snap => {
        const party = snap.val();
        if (!party || !party.active) {
            leaveListeningParty(false);
            onPartyEnded();
            return;
        }
        onPartyUpdate(party, songs);
    });

    console.log('👥 Joined Listening Party:', playlistId);
}

function leaveListeningParty(updatePresence = true) {
    if (_partyListener) {
        _partyListener.off('value');
        _partyListener = null;
    }
    if (updatePresence && _partyPlaylistId && firebaseDB) {
        const userKey = getCurrentMemberKey() || 'unknown';
        firebaseDB.ref(`listening_parties/${_partyPlaylistId}/presence/${userKey}`)
            .update({ online: false, lastSeen: Date.now() })
            .catch(() => {});
    }
    if (window._presenceInterval) {
        clearInterval(window._presenceInterval);
        window._presenceInterval = null;
    }
    _partyPlaylistId = null;
}

async function endListeningParty(playlistId) {
    if (!firebaseDB) return;
    await firebaseDB.ref(`listening_parties/${playlistId}`).update({
        active: false,
        endedAt: Date.now(),
    });
    leaveListeningParty(false);
    console.log('🛑 Listening Party ended:', playlistId);
}

// Advance everyone to a new song index — anyone can call this (collaborative mode)
async function advancePartyToSong(playlistId, newIndex, songs) {
    if (!firebaseDB) return;
    const userKey = getCurrentMemberKey() || 'unknown';
    const songTitle = songs[newIndex]?.songTitle || '';

    await firebaseDB.ref(`listening_parties/${playlistId}`).update({
        currentSongIndex: newIndex,
        currentSongTitle: songTitle,
        lastAdvancedBy:   userKey,
        lastAdvancedAt:   Date.now(),
    });

    // Mark previous song as listened for this user
    const prevTitle = songs[newIndex - 1]?.songTitle;
    if (prevTitle) await markSongListened(playlistId, prevTitle);
}

// Get current party state (one-time read, not subscribed)
async function getPartyState(playlistId) {
    if (!firebaseDB) return null;
    const snap = await firebaseDB.ref(`listening_parties/${playlistId}`).once('value');
    return snap.val();
}

// ── Party event callbacks — wired to the player UI ────────────────────────────

function onPartyUpdate(party, songs) {
    // Sync player to party's current song
    if (_plPlayerIndex !== party.currentSongIndex) {
        _plPlayerIndex = party.currentSongIndex;
        plPlayerRender();
        const advancer = getBandMemberName(party.lastAdvancedBy);
        showToast(`${advancer} advanced to: ${party.currentSongTitle}`, 3000);
    }
    // Always refresh the party status bar
    plPartyRenderStatus(party);
}

function onPartyEnded() {
    _plPartyActive = false;
    showToast('🛑 Listening Party has ended.', 3000);
    // Refresh player header to remove party bar
    if (document.getElementById('plPlayerModal')) plPlayerRender();
}

// ── Toast helper (reusable) ───────────────────────────────────────────────────
// Creates a brief notification at the bottom of the screen.

function showToast(message, duration = 2500) {
    const existing = document.getElementById('dc-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'dc-toast';
    toast.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: #1e293b; border: 1px solid rgba(102,126,234,0.4);
        color: #f1f5f9; padding: 10px 20px; border-radius: 20px;
        font-size: 0.88em; font-weight: 600; z-index: 9999;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        animation: slideUpBanner 0.25s ease-out;
        white-space: nowrap; max-width: 90vw; text-align: center;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// ── VERSION CHECKER ──────────────────────────────────────────────────────────
let _loadedVersion = null;

async function checkForAppUpdate() {
    try {
        const res = await fetch('/deadcetera/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!_loadedVersion) { _loadedVersion = data.version; return; }
        if (data.version !== _loadedVersion) showUpdateBanner();
    } catch(e) {}
}

function showUpdateBanner() {
    if (document.getElementById('dc-update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'dc-update-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:16px 20px;font-size:1em;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;gap:12px;text-align:center;cursor:pointer';
    banner.innerHTML = `
        <span>🎸 New version available!</span>
        <button onclick="window.location.reload(true)" style="background:white;color:#667eea;border:none;border-radius:8px;padding:8px 20px;font-weight:700;cursor:pointer;font-size:0.95em;white-space:nowrap;flex-shrink:0">Tap to Reload</button>
    `;
    banner.onclick = (e) => { if (e.target.tagName !== 'BUTTON') window.location.reload(true); };
    document.body.appendChild(banner);
}

setTimeout(() => { checkForAppUpdate(); setInterval(checkForAppUpdate, 60 * 1000); }, 10000);



// ── Stub page renderer (replaced by Phase 2) ─────────────────────────────────


console.log('🎵 Playlists Phase 1 — data layer loaded');

// ============================================================================
// PLAYLISTS — PHASE 2: INDEX PAGE + EDITOR
// ============================================================================

// ── Index Page ────────────────────────────────────────────────────────────────

function renderPlaylistsPage(el) {
    el.innerHTML = `
    <div class="page-header">
        <h1>🎵 Playlists</h1>
        <p>Curated listening for the whole band — from any source, in any order</p>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="plCreateNew()">+ New Playlist</button>
        <div class="tab-bar" id="plTypeFilter" style="margin-bottom:0;flex:1;min-width:0">
            <button class="tab-btn active" data-type="all" onclick="plFilterByType('all',this)">All</button>
            ${Object.entries(PLAYLIST_TYPES).map(([k,v]) =>
                `<button class="tab-btn" data-type="${k}" onclick="plFilterByType('${k}',this)">${v.label}</button>`
            ).join('')}
        </div>
    </div>
    <div id="plList"></div>`;
    plLoadIndex();
}

let _plAllLoaded = [];
let _plActiveType = 'all';

async function plLoadIndex() {
    const container = document.getElementById('plList');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Loading playlists…</div>';

    _plAllLoaded = await loadPlaylists();

    if (_plAllLoaded.length === 0) {
        container.innerHTML = `<div class="app-card" style="text-align:center;padding:40px;color:var(--text-dim)">
            <div style="font-size:2.5em;margin-bottom:12px">🎵</div>
            <div style="font-weight:700;margin-bottom:6px">No playlists yet</div>
            <div style="font-size:0.85em;margin-bottom:16px">Create your first playlist — North Star versions, pre-gig prep, whatever the band needs.</div>
            <button class="btn btn-primary" onclick="plCreateNew()">+ Create First Playlist</button>
        </div>`;
        return;
    }

    // Load listened data once for progress bars
    const listens = await loadPlaylistListens();
    plRenderIndex(_plAllLoaded, listens, _plActiveType);
}

function plFilterByType(type, btn) {
    _plActiveType = type;
    document.querySelectorAll('#plTypeFilter .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    plRenderIndex(_plAllLoaded, null, type);
}

async function plRenderIndex(playlists, listens, typeFilter) {
    const container = document.getElementById('plList');
    if (!container) return;

    if (!listens) listens = await loadPlaylistListens();

    const filtered = typeFilter === 'all'
        ? playlists
        : playlists.filter(p => p.type === typeFilter);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="app-card" style="text-align:center;padding:32px;color:var(--text-dim)">No ${typeFilter} playlists yet.</div>`;
        return;
    }

    // Check which playlists have active listening parties
    const partyStates = {};
    if (firebaseDB && isUserSignedIn) {
        await Promise.all(filtered.map(async pl => {
            const state = await getPartyState(pl.id).catch(() => null);
            if (state?.active) partyStates[pl.id] = state;
        }));
    }

    container.innerHTML = filtered.map((pl, i) => {
        const meta = PLAYLIST_TYPES[pl.type] || PLAYLIST_TYPES.custom;
        const songs = pl.linkedSetlistId ? null : toArray(pl.songs || []);
        const songCount = songs ? songs.length : '?';
        const listenedByUser = listens[pl.id] || {};
        const memberCount = Object.keys(bandMembers).length;

        // Progress bar: average % across all members
        const totalSongs = songs ? songs.length : 0;
        const progressHTML = totalSongs > 0
            ? Object.entries(bandMembers).map(([key, member]) => {
                const heard = (listenedByUser[key] || []).length;
                const pct = Math.round((heard / totalSongs) * 100);
                return `<div title="${member.name}: ${heard}/${totalSongs}" style="display:flex;align-items:center;gap:5px;font-size:0.72em;color:var(--text-muted)">
                    <span style="width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${member.name.split(' ')[0]}</span>
                    <div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;min-width:50px">
                        <div style="height:5px;border-radius:3px;background:${pct===100?'var(--green)':'var(--accent)'};width:${pct}%;transition:width 0.3s"></div>
                    </div>
                    <span style="width:26px;text-align:right;color:var(--text-dim)">${pct}%</span>
                </div>`;
            }).join('')
            : '';

        const linkedBadge = pl.linkedSetlistId
            ? `<span style="font-size:0.7em;background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.25);padding:2px 7px;border-radius:10px;font-weight:600">⚡ Live from setlist</span>`
            : '';

        // Listening party badge
        const party = partyStates[pl.id];
        const partyBadge = party
            ? `<span style="font-size:0.7em;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);padding:2px 7px;border-radius:10px;font-weight:600;animation:pulse 2s infinite">🎉 Party Live</span>`
            : '';

        const createdDate = pl.createdAt ? new Date(pl.createdAt).toLocaleDateString() : '';

        const partyCount = party ? Object.values(party.presence || {}).filter(p => p.online).length : 0;

        return `<div class="app-card" id="plCard_${pl.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div style="flex:1;min-width:0;cursor:pointer" onclick="plEdit('${pl.id}')">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                        <span style="font-weight:700;font-size:0.98em">${pl.name || 'Untitled'}</span>
                        <span style="font-size:0.72em;font-weight:600;padding:2px 8px;border-radius:10px;background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};white-space:nowrap">${meta.label}</span>
                        ${linkedBadge}
                        ${partyBadge}
                    </div>
                    ${pl.description ? `<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pl.description}</div>` : ''}
                    <div style="display:flex;gap:10px;font-size:0.78em;color:var(--text-dim);flex-wrap:wrap">
                        <span>🎵 ${pl.linkedSetlistId ? 'Synced' : songCount + ' song' + (songCount !== 1 ? 's' : '')}</span>
                        ${createdDate ? `<span>📅 ${createdDate}</span>` : ''}
                        <span>👤 ${bandMembers[pl.createdBy]?.name || pl.createdBy || 'Unknown'}</span>
                        ${partyCount > 0 ? `<span>👥 ${partyCount} listening now</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start;flex-wrap:wrap;justify-content:flex-end">
                    ${party ? `<button class="btn btn-sm" onclick="plPlay('${pl.id}')" title="Join the active listening party" style="font-size:0.78em;padding:4px 10px;background:rgba(251,191,36,0.2);color:#fbbf24;border:1px solid rgba(251,191,36,0.4)">🎉 Join Party</button>` : ''}
                    <button class="btn btn-sm btn-primary" onclick="plPlay('${pl.id}')" title="Play this playlist" style="font-size:0.78em;padding:4px 10px">▶ Play</button>
                    <button class="btn btn-sm btn-ghost" onclick="plEdit('${pl.id}')" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="copyPlaylistShareUrl('${pl.id}')" title="Copy share link" style="color:var(--accent-light)">🔗</button>
                    <button class="btn btn-sm btn-ghost" onclick="plConfirmDelete('${pl.id}')" title="Delete" style="color:var(--red)">🗑️</button>
                </div>
            </div>
            ${progressHTML ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:4px">${progressHTML}</div>` : ''}
        </div>`;
    }).join('');
}


// ── Playlist Player ──────────────────────────────────────────────────────────
// Queue-based player: one song at a time. Tap ▶ Open to launch it in Spotify/YouTube,
// then tap ▶▶ Next when you're ready for the next song. No tab explosion.

let _plPlayerSongs = [];      // resolved songs for current session
let _plPlayerIndex = 0;       // which song is "now playing"
let _plPlayerPlaylist = null; // current playlist object
let _plPartyActive = false;   // true while a listening party is joined

async function plPlay(playlistId) {
    const playlists = await loadPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) { showToast('Playlist not found', 2000); return; }

    const songs = await getPlaylistSongs(pl);
    if (!songs.length) { showToast('This playlist has no songs yet', 2000); return; }

    _plPlayerPlaylist = pl;
    _plPlayerSongs = songs;

    // If a party is already active for this playlist, jump to its current song
    const partyState = firebaseDB ? await getPartyState(playlistId) : null;
    if (partyState?.active) {
        _plPlayerIndex = partyState.currentSongIndex || 0;
        _plPartyActive = true;
        await joinListeningParty(playlistId, songs);
    } else {
        _plPlayerIndex = 0;
        _plPartyActive = false;
    }

    plPlayerRender();
}

function plPlayerRender() {
    const existing = document.getElementById('plPlayerModal');
    if (existing) existing.remove();

    const pl = _plPlayerPlaylist;
    const songs = _plPlayerSongs;
    const idx = _plPlayerIndex;
    const current = songs[idx];
    const meta = PLAYLIST_TYPES[pl.type] || PLAYLIST_TYPES.custom;
    const total = songs.length;

    const modal = document.createElement('div');
    modal.id = 'plPlayerModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;overflow:hidden';

    // Build the song queue list (all songs, current one highlighted)
    const queueRows = songs.map((s, i) => {
        const isCurrent = i === idx;
        const isDone = i < idx;
        return `<div id="plQueueRow_${i}" onclick="plPlayerJumpTo(${i})"
            style="padding:10px 16px;display:flex;align-items:center;gap:10px;
                   cursor:pointer;transition:background 0.15s;
                   background:${isCurrent ? 'rgba(102,126,234,0.15)' : 'transparent'};
                   border-left:3px solid ${isCurrent ? 'var(--accent)' : 'transparent'}">
            <span style="font-size:0.78em;min-width:22px;text-align:right;flex-shrink:0;
                         color:${isCurrent ? 'var(--accent-light)' : isDone ? 'var(--green)' : 'var(--text-dim)'}">
                ${isDone ? '✓' : isCurrent ? '▶' : i + 1}
            </span>
            <div style="flex:1;min-width:0">
                <div style="font-size:0.88em;font-weight:${isCurrent ? '700' : '500'};
                            color:${isCurrent ? 'var(--text)' : isDone ? 'var(--text-dim)' : 'var(--text-muted)'};
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    ${s.songTitle}
                </div>
                ${s.note ? `<div style="font-size:0.72em;color:var(--text-dim);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.note}</div>` : ''}
            </div>
            ${isCurrent ? `<span style="font-size:0.7em;color:var(--accent-light);flex-shrink:0">Now</span>` : ''}
        </div>`;
    }).join('');

    modal.innerHTML = `
        <!-- Header -->
        <div style="background:var(--bg-card);border-bottom:1px solid var(--border);padding:12px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0">
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.95em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pl.name || 'Playlist'}</div>
                <div style="font-size:0.72em;color:var(--text-muted);margin-top:2px">
                    <span style="padding:1px 7px;border-radius:10px;background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};font-weight:600">${meta.label}</span>
                    &nbsp;Song ${idx + 1} of ${total}
                </div>
            </div>
            <button onclick="plPlayerClose()"
                style="background:none;border:none;color:var(--text-muted);font-size:1.4em;cursor:pointer;flex-shrink:0;padding:4px;line-height:1">✕</button>
        </div>

        <!-- Party status bar (shown when party active) -->
        <div id="plPartyBar" style="display:${_plPartyActive ? '' : 'none'};background:rgba(251,191,36,0.1);border-bottom:1px solid rgba(251,191,36,0.25);padding:8px 16px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-size:0.82em;font-weight:700;color:#fbbf24">🎉 Listening Party</span>
                <div id="plPartyPresence" style="display:flex;gap:5px;flex:1;flex-wrap:wrap"></div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                    <button onclick="plPartyAdvance()" class="btn btn-sm" style="background:rgba(251,191,36,0.2);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);font-size:0.75em;padding:4px 10px">▶▶ Advance All</button>
                    <button id="plPartyHostBtn" onclick="plPartyEnd()" style="display:none" class="btn btn-sm" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);font-size:0.75em;padding:4px 10px">End Party</button>
                    <button id="plPartyLeaveBtn" onclick="plPartyLeave()" class="btn btn-sm" style="background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid var(--border);font-size:0.75em;padding:4px 10px">Leave</button>
                </div>
            </div>
            <div id="plPartyLastAdvanced" style="font-size:0.72em;color:var(--text-dim);margin-top:3px"></div>
        </div>

        <!-- Now Playing card -->
        <div style="background:rgba(102,126,234,0.08);border-bottom:1px solid var(--border);padding:20px 20px 16px;flex-shrink:0">
            <div style="font-size:0.7em;font-weight:700;letter-spacing:0.08em;color:var(--accent-light);text-transform:uppercase;margin-bottom:6px">Now Playing</div>
            <div style="font-size:1.15em;font-weight:700;color:var(--text);margin-bottom:4px;line-height:1.3">${current.songTitle}</div>
            ${current.note ? `<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:10px">${current.note}</div>` : '<div style="margin-bottom:10px"></div>'}

            <!-- Action buttons -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <button id="plOpenBtn" onclick="plPlayerOpenCurrent()"
                    class="btn btn-primary" style="font-size:0.88em;padding:9px 18px;gap:6px">
                    ⏳ Loading…
                </button>
                ${idx > 0 ? `
                <button onclick="plPlayerJumpTo(${idx - 1})"
                    class="btn btn-ghost" style="font-size:0.82em;padding:8px 14px">
                    ◀ Prev
                </button>` : ''}
                ${idx < total - 1 ? `
                <button onclick="plPlayerJumpTo(${idx + 1})"
                    class="btn btn-success" style="font-size:0.88em;padding:9px 18px">
                    Next ▶▶
                </button>` : `
                <div style="font-size:0.82em;color:var(--green);padding:8px;font-weight:600">
                    ✅ End of playlist
                </div>`}
                <div style="flex:1"></div>
                ${isUserSignedIn && !_plPartyActive ? `
                <button onclick="plPartyStart()" class="btn btn-sm"
                    style="background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);font-size:0.75em;padding:6px 12px;white-space:nowrap">
                    🎉 Start Party
                </button>` : ''}
                ${!isUserSignedIn ? `
                <div style="font-size:0.72em;color:var(--text-dim);text-align:right;line-height:1.4">
                    Opens in Spotify<br>or YouTube
                </div>` : ''}
            </div>
        </div>

        <!-- Queue -->
        <div style="flex:1;overflow-y:auto" id="plQueueList">
            ${queueRows}
        </div>`;

    document.body.appendChild(modal);

    // Scroll current song into view in the queue
    setTimeout(() => {
        const row = document.getElementById(`plQueueRow_${idx}`);
        if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 100);

    // Resolve the current song's URL (and pre-resolve next)
    plPlayerResolveAndUpdate(idx);
    if (idx + 1 < songs.length) plPlayerResolveAndUpdate(idx + 1);
}

// Cache of resolved URLs so we don't re-fetch on navigation
const _plPlayerUrlCache = {};

async function plPlayerResolveAndUpdate(idx) {
    if (_plPlayerUrlCache[idx]) {
        plPlayerUpdateOpenBtn(idx, _plPlayerUrlCache[idx]);
        return;
    }
    const song = _plPlayerSongs[idx];
    if (!song) return;
    const resolved = await resolvePlaylistSongUrl(song);
    _plPlayerUrlCache[idx] = resolved;
    if (idx === _plPlayerIndex) plPlayerUpdateOpenBtn(idx, resolved);
}

function plPlayerUpdateOpenBtn(idx, resolved) {
    if (idx !== _plPlayerIndex) return; // user moved on
    const btn = document.getElementById('plOpenBtn');
    if (!btn) return;
    const srcMeta = getSourceMeta(resolved.source);
    btn.innerHTML = `${srcMeta.icon} Open in ${srcMeta.label}`;
    btn.style.background = srcMeta.color;
    btn.style.color = 'white';
    btn.dataset.url = resolved.url;
}

function plPlayerOpenCurrent() {
    const btn = document.getElementById('plOpenBtn');
    const url = btn?.dataset.url;
    if (!url || url === '') { showToast('Still loading URL…', 1500); return; }
    window.open(url, '_blank', 'noopener');
    // Auto-highlight this row as played
    const row = document.getElementById(`plQueueRow_${_plPlayerIndex}`);
    if (row) row.style.borderLeftColor = 'var(--green)';
}

function plPlayerClose() {
    if (_plPartyActive) leaveListeningParty(true);
    _plPartyActive = false;
    document.getElementById('plPlayerModal')?.remove();
}

function plPlayerJumpTo(idx) {
    _plPlayerIndex = idx;
    // If in a party, advance all members too
    if (_plPartyActive && _plPlayerPlaylist) {
        advancePartyToSong(_plPlayerPlaylist.id, idx, _plPlayerSongs).catch(() => {});
    }
    plPlayerRender();
}

// ── Listening Party actions ───────────────────────────────────────────────────

async function plPartyStart() {
    if (!isUserSignedIn) { showToast('Sign in to start a Listening Party', 2500); return; }
    if (!_plPlayerPlaylist) return;
    _plPartyActive = true;
    await startListeningParty(_plPlayerPlaylist.id, _plPlayerSongs);
    plPlayerRender();
    showToast('🎉 Listening Party started! Band members can join when they open this playlist.', 4000);
    // Refresh playlist index so the "Join Party" badge appears
    plLoadIndex().catch(() => {});
}

async function plPartyAdvance() {
    if (!_plPlayerPlaylist || !_plPartyActive) return;
    const nextIdx = _plPlayerIndex + 1;
    if (nextIdx >= _plPlayerSongs.length) { showToast('Already at the last song', 2000); return; }
    await advancePartyToSong(_plPlayerPlaylist.id, nextIdx, _plPlayerSongs);
    // onPartyUpdate will drive the render via Firebase listener
}

async function plPartyLeave() {
    leaveListeningParty(true);
    _plPartyActive = false;
    plPlayerRender();
    showToast('👋 Left the Listening Party', 2000);
}

async function plPartyEnd() {
    if (!_plPlayerPlaylist) return;
    if (!confirm('End the Listening Party for everyone?')) return;
    await endListeningParty(_plPlayerPlaylist.id);
    _plPartyActive = false;
    plPlayerRender();
    showToast('🛑 Listening Party ended', 2500);
    plLoadIndex().catch(() => {});
}

// Update just the party status bar (called from onPartyUpdate — no full re-render)
function plPartyRenderStatus(party) {
    const bar = document.getElementById('plPartyBar');
    if (!bar) return;
    bar.style.display = '';

    // Presence avatars
    const presenceEl = document.getElementById('plPartyPresence');
    if (presenceEl && party.presence) {
        presenceEl.innerHTML = Object.entries(party.presence)
            .filter(([, p]) => p.online)
            .map(([key]) => {
                const name = getBandMemberName(key);
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return `<span title="${name}" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(251,191,36,0.25);color:#fbbf24;font-size:0.7em;font-weight:700;border:1px solid rgba(251,191,36,0.4)">${initials}</span>`;
            }).join('');
    }

    // Last advanced by
    const advEl = document.getElementById('plPartyLastAdvanced');
    if (advEl && party.lastAdvancedBy) {
        const who = getBandMemberName(party.lastAdvancedBy);
        const when = party.lastAdvancedAt ? new Date(party.lastAdvancedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        advEl.textContent = `Last advanced by ${who}${when ? ' at ' + when : ''}`;
    }

    // Show End Party button only to the host
    const hostBtn = document.getElementById('plPartyHostBtn');
    if (hostBtn) {
        const myKey = getCurrentMemberKey();
        hostBtn.style.display = (myKey && myKey === party.startedBy) ? '' : 'none';
    }
}



async function plConfirmDelete(playlistId) {
    const pl = _plAllLoaded.find(p => p.id === playlistId);
    if (!confirm(`Delete "${pl?.name || 'this playlist'}"? This cannot be undone.`)) return;
    await deletePlaylist(playlistId);
    showToast('🗑️ Playlist deleted', 2000);
    plLoadIndex();
}

// ── Editor ────────────────────────────────────────────────────────────────────

let _plEditing = null;       // playlist object currently being edited
let _plEditorSongs = [];     // working copy of songs array in editor

async function plCreateNew() {
    _plEditing = null;
    _plEditorSongs = [];
    await plRenderEditor(null);
}

async function plEdit(playlistId) {
    const playlists = await loadPlaylists();
    _plEditing = playlists.find(p => p.id === playlistId) || null;
    _plEditorSongs = _plEditing ? await getPlaylistSongs(_plEditing) : [];
    await plRenderEditor(_plEditing);
}

async function plRenderEditor(pl) {
    const container = document.getElementById('plList');
    if (!container) return;

    // Load setlists for the dropdown
    const allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);

    const isLinked = !!(pl?.linkedSetlistId);
    const typeOptions = Object.entries(PLAYLIST_TYPES).map(([k, v]) =>
        `<option value="${k}" ${(pl?.type || 'custom') === k ? 'selected' : ''}>${v.label}</option>`
    ).join('');

    const setlistOptions = `<option value="">— Not linked to a setlist —</option>` +
        allSetlists.map(sl =>
            `<option value="${sl.name}" ${pl?.linkedSetlistId === sl.name ? 'selected' : ''}>${sl.name || 'Untitled'} ${sl.date ? '(' + sl.date + ')' : ''}</option>`
        ).join('');

    container.innerHTML = `
    <div class="app-card">
        <h3 style="margin-bottom:16px">${pl ? '✏️ Edit Playlist' : '➕ New Playlist'}</h3>

        <!-- Metadata -->
        <div class="form-grid" style="margin-bottom:12px">
            <div class="form-row">
                <label class="form-label">Name</label>
                <input class="app-input" id="plEdName" placeholder="e.g. Pre-Gig Prep — March 1st" value="${(pl?.name || '').replace(/"/g,'&quot;')}">
            </div>
            <div class="form-row">
                <label class="form-label">Type</label>
                <select class="app-select" id="plEdType">${typeOptions}</select>
            </div>
        </div>
        <div class="form-row" style="margin-bottom:12px">
            <label class="form-label">Description</label>
            <input class="app-input" id="plEdDesc" placeholder="Optional — what's this playlist for?" value="${(pl?.description || '').replace(/"/g,'&quot;')}">
        </div>
        <div class="form-row" style="margin-bottom:16px">
            <label class="form-label">🔗 Link to Setlist (optional — songs will live-sync)</label>
            <select class="app-select" id="plEdSetlist" onchange="plHandleSetlistLink(this.value)">${setlistOptions}</select>
        </div>

        ${isLinked ? `
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:0.85em;color:var(--green)">
            ⚡ Songs are live-synced from the linked setlist. Per-song notes and source preferences are still editable below.
        </div>` : ''}

        <!-- Song list -->
        <div style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:0.78em;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Songs <span id="plEdSongCount" style="color:var(--accent-light)">${_plEditorSongs.length}</span></span>
            ${!isLinked ? `<span style="font-size:0.78em;color:var(--text-dim)">Drag to reorder</span>` : ''}
        </div>

        <div id="plEdSongList" style="margin-bottom:12px"></div>

        ${!isLinked ? `
        <!-- Add songs -->
        <div style="margin-bottom:16px">
            <input class="app-input" id="plEdSearch" placeholder="Search songs to add…" oninput="plEdSearchSong(this.value)" autocomplete="off">
            <div id="plEdSearchResults" style="margin-top:4px"></div>
        </div>` : ''}

        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-success" onclick="plEdSave()">💾 Save Playlist</button>
            <button class="btn btn-ghost" onclick="plLoadIndex()">Cancel</button>
            ${pl ? `<button class="btn btn-ghost" onclick="copyPlaylistShareUrl('${pl.id}')" style="margin-left:auto;color:var(--accent-light)">🔗 Copy Share Link</button>` : ''}
        </div>
    </div>`;

    plEdRenderSongList();
    plEdInitDragDrop();
}

async function plHandleSetlistLink(setlistId) {
    // Preserve current field values without re-rendering entire editor
    const nameVal = document.getElementById('plEdName')?.value;
    const typeVal = document.getElementById('plEdType')?.value;
    const descVal = document.getElementById('plEdDesc')?.value;

    if (!_plEditing) _plEditing = {};
    _plEditing.linkedSetlistId = setlistId || null;
    _plEditing.name = nameVal || _plEditing.name;
    _plEditing.type = typeVal || _plEditing.type;
    _plEditing.description = descVal || _plEditing.description;

    // Fetch songs from linked setlist (or clear if unlinked)
    if (setlistId) {
        // Show loading state immediately
        const songListEl = document.getElementById('plEdSongList');
        if (songListEl) songListEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:0.85em">⏳ Loading songs from setlist…</div>';
        _plEditorSongs = await getPlaylistSongs(_plEditing);
    } else {
        _plEditorSongs = [];
    }

    // Show/hide live-sync notice inline without full re-render
    const noticeId = 'plLiveSyncNotice';
    let notice = document.getElementById(noticeId);
    if (setlistId && !notice) {
        notice = document.createElement('div');
        notice.id = noticeId;
        notice.style.cssText = 'background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:0.85em;color:#10b981';
        notice.innerHTML = '⚡ Songs are live-synced from the linked setlist. Per-song notes and source preferences are still editable below.';
        const setlistRow = document.getElementById('plEdSetlist')?.closest('.form-row');
        if (setlistRow) setlistRow.insertAdjacentElement('afterend', notice);
    } else if (!setlistId && notice) {
        notice.remove();
    }

    // Hide/show the add-songs search bar
    const searchArea = document.getElementById('plEdSearch')?.parentElement;
    if (searchArea) searchArea.style.display = setlistId ? 'none' : '';

    plEdRenderSongList();
}

// ── Editor song list ──────────────────────────────────────────────────────────

function plEdRenderSongList() {
    const el = document.getElementById('plEdSongList');
    if (!el) return;

    const linked = !!(document.getElementById('plEdSetlist')?.value);

    if (_plEditorSongs.length === 0) {
        const linkedId = document.getElementById('plEdSetlist')?.value;
        let msg;
        if (linkedId) {
            msg = '⏳ Loading songs from setlist… (if this persists, the setlist may be empty)';
        } else {
            msg = linked ? 'Select a setlist above to populate songs' : 'Search for songs below to add them';
        }
        el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:0.85em;border:1px dashed rgba(255,255,255,0.1);border-radius:8px">${msg}</div>`;
        return;
    }

    el.innerHTML = _plEditorSongs.map((song, i) => {
        const sourceMeta = getSourceMeta(song.preferredSource || 'auto');
        const songData = allSongs.find(s => s.title === song.songTitle);
        const band = songData?.band || '';
        const badgeClass = band.toLowerCase().replace(/\s/g,'');

        return `<div class="list-item" id="plEdSong_${i}" draggable="true"
            style="flex-wrap:wrap;gap:4px 6px;padding:8px 10px;cursor:grab;position:relative;align-items:center"
            ondragstart="plEdDragStart(event,${i})"
            ondragover="plEdDragOver(event,${i})"
            ondrop="plEdDrop(event,${i})"
            ondragend="plEdDragEnd(event)">
            <!-- Top row: number · drag · title · band badge · remove -->
            <span style="color:var(--text-dim);font-size:0.8em;min-width:20px;text-align:right;flex-shrink:0">${i + 1}</span>
            <span style="color:var(--text-dim);cursor:grab;flex-shrink:0" title="Drag to reorder">⠿</span>
            <span style="flex:1;font-size:0.9em;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:80px">${song.songTitle}</span>
            ${band ? `<span class="song-badge ${badgeClass}" style="flex-shrink:0">${band}</span>` : ''}
            <button onclick="plEdRemoveSong(${i})" class="btn btn-sm btn-ghost" style="padding:2px 6px;flex-shrink:0;color:var(--red)">✕</button>
            <!-- Bottom row: note + source — indented to align under title, wraps on mobile -->
            <div style="display:flex;gap:6px;width:100%;padding-left:46px;box-sizing:border-box" onclick="event.stopPropagation()">
                <input placeholder="Note (optional)…" value="${(song.note || '').replace(/"/g,'&quot;')}"
                    oninput="plEdUpdateNote(${i},this.value)"
                    style="flex:1;min-width:60px;font-size:0.78em;padding:3px 8px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit">
                <select onchange="plEdUpdateSource(${i},this.value)"
                    style="font-size:0.75em;padding:3px 5px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;flex-shrink:0">
                    <option value="auto" ${(song.preferredSource||'auto')==='auto'?'selected':''}>Auto</option>
                    <option value="spotify" ${song.preferredSource==='spotify'?'selected':''}>Spotify</option>
                    <option value="youtube" ${song.preferredSource==='youtube'?'selected':''}>YouTube</option>
                    <option value="archive" ${song.preferredSource==='archive'?'selected':''}>Archive</option>
                </select>
            </div>
        </div>`;
    }).join('');

    const countEl = document.getElementById('plEdSongCount');
    if (countEl) countEl.textContent = _plEditorSongs.length;
}

function plEdUpdateNote(idx, val) {
    if (_plEditorSongs[idx]) _plEditorSongs[idx].note = val;
}

function plEdUpdateSource(idx, val) {
    if (_plEditorSongs[idx]) _plEditorSongs[idx].preferredSource = val;
}

function plEdRemoveSong(idx) {
    _plEditorSongs.splice(idx, 1);
    plEdRenderSongList();
}

// ── Song search ───────────────────────────────────────────────────────────────

function plEdSearchSong(query) {
    const results = document.getElementById('plEdSearchResults');
    if (!results) return;
    if (!query || query.length < 2) { results.innerHTML = ''; return; }

    const q = query.toLowerCase();
    const existing = new Set(_plEditorSongs.map(s => s.songTitle));
    const matches = (allSongs || [])
        .filter(s => s.title.toLowerCase().includes(q) && !existing.has(s.title))
        .slice(0, 10);

    if (matches.length === 0) {
        results.innerHTML = `<div style="padding:8px 10px;font-size:0.82em;color:var(--text-dim)">No songs found</div>`;
        return;
    }

    results.innerHTML = matches.map(s =>
        `<div class="list-item" style="cursor:pointer;padding:7px 10px;font-size:0.85em;gap:8px"
            onclick="plEdAddSong('${s.title.replace(/'/g,"\\'")}','${s.band||''}')">
            <span style="flex:1">${s.title}</span>
            <span class="song-badge ${(s.band||'').toLowerCase().replace(/\s/g,'')}">${s.band||''}</span>
        </div>`
    ).join('');
}

function plEdAddSong(title, band) {
    // Avoid duplicates
    if (_plEditorSongs.find(s => s.songTitle === title)) {
        showToast('Already in playlist', 1500);
        return;
    }
    _plEditorSongs.push({ songTitle: title, note: '', preferredSource: 'auto', customUrl: null });
    plEdRenderSongList();

    // Clear search
    const searchEl = document.getElementById('plEdSearch');
    const resultsEl = document.getElementById('plEdSearchResults');
    if (searchEl) searchEl.value = '';
    if (resultsEl) resultsEl.innerHTML = '';
}

// ── Drag-and-drop reorder ─────────────────────────────────────────────────────

let _plDragIdx = null;

function plEdInitDragDrop() {
    // Drag is handled inline via ondragstart/over/drop attributes
}

function plEdDragStart(e, idx) {
    _plDragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
        const el = document.getElementById('plEdSong_' + idx);
        if (el) el.style.opacity = '0.4';
    }, 0);
}

function plEdDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Highlight drop target
    document.querySelectorAll('#plEdSongList .list-item').forEach((el, i) => {
        el.style.borderColor = i === idx ? 'var(--accent)' : '';
    });
}

function plEdDrop(e, dropIdx) {
    e.preventDefault();
    if (_plDragIdx === null || _plDragIdx === dropIdx) return;
    const moved = _plEditorSongs.splice(_plDragIdx, 1)[0];
    _plEditorSongs.splice(dropIdx, 0, moved);
    _plDragIdx = null;
    plEdRenderSongList();
}

function plEdDragEnd(e) {
    _plDragIdx = null;
    document.querySelectorAll('#plEdSongList .list-item').forEach(el => {
        el.style.opacity = '';
        el.style.borderColor = '';
    });
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function plEdSave() {
    const name     = document.getElementById('plEdName')?.value?.trim();
    const type     = document.getElementById('plEdType')?.value || 'custom';
    const desc     = document.getElementById('plEdDesc')?.value?.trim() || '';
    const setlistId = document.getElementById('plEdSetlist')?.value || null;

    if (!name) { showToast('Please enter a playlist name', 2000); return; }

    const songsToSave = setlistId
        ? _plEditorSongs.filter(s => s.note || s.preferredSource !== 'auto' || s.customUrl) // only store overrides
        : _plEditorSongs;

    const fields = { name, type, description: desc, linkedSetlistId: setlistId || null, songs: songsToSave };

    if (_plEditing?.id) {
        await updatePlaylist(_plEditing.id, fields);
        showToast('✅ Playlist updated!', 2000);
    } else {
        await createPlaylist(fields);
        showToast('✅ Playlist created!', 2000);
    }

    plLoadIndex();
}

console.log('🎵 Playlists Phase 2 — index + editor loaded');


// ============================================================================
// HARMONY AI STUDIO v1 — AI-powered learning & practice system
// ============================================================================

const HARMONY_SINGER_COLORS = {
    drew:   { bg: '#1e40af', light: '#dbeafe', text: '#93c5fd', name: 'Drew' },
    brian:  { bg: '#065f46', light: '#d1fae5', text: '#6ee7b7', name: 'Brian' },
    chris:  { bg: '#7c2d12', light: '#fed7aa', text: '#fb923c', name: 'Chris' },
    pierce: { bg: '#4c1d95', light: '#ede9fe', text: '#c4b5fd', name: 'Pierce' },
};

// ── AI HARMONY ANALYSIS ──────────────────────────────────────────────────────

async function analyzeHarmonyWithAI(songTitle, artistName, lyrics) {
    const statusEl = document.getElementById('harmonyAIStatus');
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '🤖 Asking AI to analyze harmonies...'; }

    const singerList = Object.entries(bandMembers)
        .filter(([k,m]) => m.sings || m.harmonies || m.leadVocals)
        .map(([k,m]) => `${m.name} (${m.role})`)
        .join(', ');

    const prompt = `You are an expert music arranger and harmony coach. Analyze the vocal harmonies for "${songTitle}" by ${artistName}.

Our band members who sing: ${singerList}

${lyrics ? `Lyrics:\n${lyrics.substring(0, 2000)}` : ''}

Return ONLY valid JSON (no markdown, no explanation) in exactly this structure:
{
  "summary": "2-3 sentence overview of the harmony style and difficulty",
  "youtubeQuery": "best search query to find harmony tutorial or isolated vocals on YouTube",
  "sections": [
    {
      "name": "Verse 1",
      "hasHarmony": true,
      "leadSinger": "drew",
      "harmonySingers": ["brian", "pierce"],
      "arrangement": "Brief description of who sings what",
      "interval": "e.g. 3rd above, 5th below",
      "difficulty": "easy|medium|hard",
      "teachingNote": "Most important thing to know about singing this section correctly",
      "lyricCue": "First few words of this section"
    }
  ]
}

Focus on the actual known harmony arrangements for this song. If you don't know the specific arrangement, make a musically appropriate suggestion based on the style. Be specific and practical for amateur singers learning the song.`;

    try {
        // Route through corsproxy.io to avoid CORS block on Anthropic API
        const proxyUrl = 'https://deadcetera-proxy.drewmerrill.workers.dev/';
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'sk-ant-api03-placeholder',  // replaced at runtime
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await response.json();
        const text = data.content?.find(b => b.type === 'text')?.text || '';
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        if (statusEl) statusEl.textContent = '\u2705 AI analysis complete!';
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);
        return parsed;

    } catch (err) {
        console.error('AI harmony analysis error:', err);
        if (statusEl) statusEl.textContent = '\u26a0\ufe0f AI analysis failed — ' + err.message;
        return null;
    }
}

// ── BULK POPULATE ────────────────────────────────────────────────────────────

async function bulkPopulateHarmonies() {
    const harmonySongs = allSongs ? allSongs.filter(s => s.hasHarmonies || harmonyBadgeCache[s.title]) : [];
    if (!harmonySongs.length) {
        alert('No songs marked as having harmonies found.');
        return;
    }

    const container = document.getElementById('bulkHarmonyStatus');
    if (!container) return;
    container.style.display = 'block';

    let done = 0, skipped = 0, failed = 0;
    const total = harmonySongs.length;

    for (const song of harmonySongs) {
        container.innerHTML = `
            <div style="margin-bottom:8px;font-weight:600;color:var(--accent-light)">
                🤖 Bulk AI Harmony Population
            </div>
            <div style="background:rgba(255,255,255,0.05);border-radius:6px;overflow:hidden;margin-bottom:8px">
                <div style="background:var(--accent);height:8px;border-radius:6px;transition:width 0.3s;width:${Math.round((done+skipped+failed)/total*100)}%"></div>
            </div>
            <div style="font-size:0.82em;color:var(--text-dim)">
                Processing: <strong style="color:white">${song.title}</strong><br>
                ✅ ${done} done · ⏭️ ${skipped} skipped · ❌ ${failed} failed · ${total - done - skipped - failed} remaining
            </div>
        `;

        try {
            // Check if already has AI analysis
            const existing = await loadBandDataFromDrive(song.title, 'harmony_ai');
            if (existing && existing.sections) { skipped++; continue; }

            // Fetch lyrics if we don't have them
            let lyrics = '';
            const lyricData = await loadBandDataFromDrive(song.title, 'harmonies_data');
            if (lyricData?.lyrics) {
                lyrics = lyricData.lyrics;
            } else {
                const fetched = await fetchLyricsFromGenius(song.title, getFullBandName(song.band));
                if (fetched) lyrics = fetched.lyrics;
            }

            const artistName = getFullBandName(song.band || 'GD');
            const aiData = await analyzeHarmonyWithAI(song.title, artistName, lyrics);

            if (aiData) {
                await saveBandDataToDrive(song.title, 'harmony_ai', { ...aiData, generatedAt: new Date().toISOString() });
                // Also save lyrics if we fetched them
                if (lyrics && !lyricData?.lyrics) {
                    const currentHarmonies = lyricData || {};
                    await saveBandDataToDrive(song.title, 'harmonies_data', { ...currentHarmonies, lyrics });
                }
                done++;
            } else {
                failed++;
            }

            // Rate limit — be nice to the API
            await new Promise(r => setTimeout(r, 800));

        } catch (e) {
            console.error(`Bulk populate error for ${song.title}:`, e);
            failed++;
        }
    }

    container.innerHTML = `
        <div style="color:var(--green);font-weight:600">✅ Bulk population complete!</div>
        <div style="font-size:0.82em;color:var(--text-dim);margin-top:4px">
            ${done} analyzed · ${skipped} already had data · ${failed} failed
        </div>
        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('bulkHarmonyStatus').style.display='none'" style="margin-top:8px">Dismiss</button>
    `;
}

// ── LEARNING VIEW ─────────────────────────────────────────────────────────────

async function renderHarmonyLearningView(songTitle) {
    const container = document.getElementById('harmoniesContainer');
    if (!container) return;

    container.innerHTML = '<p style="padding:20px;color:var(--accent-light)">🎵 Loading harmony learning view...</p>';

    // Load all data in parallel
    const [harmonyData, aiData, songData] = await Promise.all([
        loadBandDataFromDrive(songTitle, 'harmonies_data'),
        loadBandDataFromDrive(songTitle, 'harmony_ai'),
        Promise.resolve(allSongs?.find(s => s.title === songTitle))
    ]);

    const artistName = getFullBandName(songData?.band || 'GD');
    const lyrics = harmonyData?.lyrics || '';
    const sections = harmonyData?.sections ? (Array.isArray(harmonyData.sections) ? harmonyData.sections : Object.values(harmonyData.sections)) : [];
    const safeSong = songTitle.replace(/'/g, "\\'");

    // If no AI data yet, show analyze button
    const aiPanel = aiData ? renderAIInsightsPanel(aiData, songTitle) : `
        <div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px;padding:16px;margin-bottom:16px;text-align:center">
            <div style="font-size:1.1em;margin-bottom:8px">🤖 No AI analysis yet</div>
            <p style="font-size:0.82em;color:var(--text-dim);margin-bottom:12px">Let AI analyze the harmony arrangement, suggest who sings what, and provide teaching notes.</p>
            <div id="harmonyAIStatus" style="display:none;padding:8px;background:rgba(102,126,234,0.1);border-radius:6px;font-size:0.82em;color:var(--accent-light);margin-bottom:10px"></div>
            <button class="btn btn-primary" onclick="runAIAnalysisForSong('${safeSong}')">
                🤖 Analyze with AI
            </button>
        </div>
    `;

    // Color-coded lyrics block
    const lyricsPanel = lyrics ? renderColorCodedLyrics(lyrics, sections, aiData) : '';

    // Sections with learning view
    const sectionsHTML = sections.map((section, idx) => {
        const aiSection = aiData?.sections?.find(s => s.name?.toLowerCase() === section.name?.toLowerCase());
        return renderLearningSectionCard(songTitle, section, idx, aiSection);
    }).join('');

    // Practice mode button
    const practiceBtn = `
        <div style="position:sticky;bottom:16px;z-index:10;text-align:center;margin-top:16px">
            <button class="btn btn-primary" onclick="openPracticeMode('${safeSong}')"
                style="background:linear-gradient(135deg,#667eea,#764ba2);padding:12px 28px;font-size:1em;box-shadow:0 4px 20px rgba(102,126,234,0.4)">
                🎤 Practice Mode
            </button>
        </div>
    `;

    // Singer filter tabs
    const singerTabs = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
            <span style="font-size:0.8em;color:var(--text-dim);margin-right:4px">View:</span>
            <button onclick="setHarmonyViewFilter('all')" id="hFilter_all"
                class="btn btn-sm btn-primary" style="font-size:0.8em">All Parts</button>
            ${Object.entries(HARMONY_SINGER_COLORS).map(([key, c]) =>
                `<button onclick="setHarmonyViewFilter('${key}')" id="hFilter_${key}"
                    class="btn btn-sm btn-ghost" style="font-size:0.8em;border-color:${c.text};color:${c.text}">
                    ${c.name} only
                </button>`
            ).join('')}
        </div>
    `;

    container.innerHTML = `
        <div id="harmonyLearningView">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <h3 style="margin:0;color:var(--accent-light);font-size:1.1em">🎵 Harmony Guide — ${songTitle}</h3>
                <div style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-ghost" onclick="addFirstHarmonySection('${safeSong}')">✏️ Edit</button>
                    <button class="btn btn-sm btn-ghost" onclick="runAIAnalysisForSong('${safeSong}')">🤖 Re-analyze</button>
                </div>
            </div>

            <div id="harmonyAIStatus" style="display:none;padding:8px 12px;background:rgba(102,126,234,0.1);border-radius:6px;font-size:0.82em;color:var(--accent-light);margin-bottom:12px"></div>
            <div id="bulkHarmonyStatus" style="display:none;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:16px"></div>

            ${aiPanel}
            ${singerTabs}
            ${lyricsPanel}
            <div id="harmonySectionsContainer">
                ${sectionsHTML || '<p style="color:var(--text-dim);text-align:center;padding:20px">No sections yet. Click Edit to add them.</p>'}
            </div>
            ${practiceBtn}
        </div>
    `;
}

function renderAIInsightsPanel(aiData, songTitle) {
    if (!aiData) return '';
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(aiData.youtubeQuery || songTitle + ' harmony')}`;
    return `
        <div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px;padding:16px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px;margin-bottom:10px">
                <strong style="color:var(--accent-light)">🤖 AI Harmony Analysis</strong>
                <a href="${ytUrl}" target="_blank" class="btn btn-sm btn-ghost" style="font-size:0.8em">▶️ Find on YouTube</a>
            </div>
            <p style="font-size:0.85em;color:var(--text,#f1f5f9);margin:0;line-height:1.6">${aiData.summary || ''}</p>
        </div>
    `;
}

function renderColorCodedLyrics(lyrics, sections, aiData) {
    if (!lyrics) return '';

    // Build singer map: section name -> {lead, harmony[]}
    const singerForSection = {};
    if (aiData?.sections) {
        aiData.sections.forEach(s => {
            singerForSection[(s.name||'').toLowerCase()] = {
                lead: s.leadSinger,
                harmony: s.harmonySingers || []
            };
        });
    }
    // Also pull from actual harmony section parts if AI data missing for a section
    if (sections) {
        toArray(sections).forEach(s => {
            const key = (s.name || s.lyric || '').toLowerCase();
            if (!singerForSection[key]) {
                const parts = toArray(s.parts || []);
                const lead = parts.find(p => p.part === 'lead')?.singer;
                const harmony = parts.filter(p => p.part !== 'lead').map(p => p.singer);
                if (lead || harmony.length) singerForSection[key] = { lead, harmony };
            }
        });
    }

    // Split into section blocks, each tagged with data-singers for filtering
    const rawLines = lyrics.split('\n');
    let html = '';
    let currentSingers = [];
    let blockLines = [];

    const flushBlock = () => {
        if (!blockLines.length) return;
        const singerAttr = currentSingers.join(' ');
        html += `<div class="lyric-block" data-singers="${singerAttr}" style="margin-bottom:8px;transition:opacity 0.25s,color 0.25s">`;
        html += blockLines.map(l => `<div>${l ? l.replace(/</g,'&lt;') : '&nbsp;'}</div>`).join('');
        html += `</div>`;
        blockLines = [];
    };

    rawLines.forEach(line => {
        const m = line.match(/^\[([^\]]+)\]$/);
        if (m) {
            flushBlock();
            const name = m[1];
            const info = singerForSection[name.toLowerCase()];
            const lead = info?.lead;
            const allSingers = info ? [info.lead, ...(info.harmony||[])].filter(Boolean) : [];
            currentSingers = allSingers.map(s => (s||'').toLowerCase());
            const color = lead ? (HARMONY_SINGER_COLORS[lead]?.text || '#818cf8') : '#818cf8';
            const badges = allSingers.map(s =>
                `<span style="background:${HARMONY_SINGER_COLORS[s]?.bg||'#374151'};color:${HARMONY_SINGER_COLORS[s]?.text||'white'};padding:1px 7px;border-radius:10px;font-size:0.7em;margin-left:4px;font-weight:600">${HARMONY_SINGER_COLORS[s]?.name||s}</span>`
            ).join('');
            const singerAttr = currentSingers.join(' ');
            html += `<div class="lyric-block lyric-header-block" data-singers="${singerAttr}" style="margin-top:14px;margin-bottom:3px;transition:opacity 0.25s">`;
            html += `<span style="color:${color};font-weight:700">[${name}]</span>${badges}`;
            html += `</div>`;
        } else {
            blockLines.push(line);
        }
    });
    flushBlock();

    return `
        <div id="harmonyLyricsPanel" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <strong style="color:#818cf8;font-size:0.9em">🎤 Lyrics</strong>
                <button onclick="document.getElementById('harmonyLyricsPanel').style.display='none'"
                    style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.82em">Hide</button>
            </div>
            <div id="harmonyLyricsContent" style="font-size:0.85em;color:var(--text,#f1f5f9);line-height:1.9">${html}</div>
        </div>
    `;
}


function renderLearningSectionCard(songTitle, section, sectionIndex, aiSection) {
    const safeSong = songTitle.replace(/'/g, "\\'");
    const difficulty = aiSection?.difficulty || 'medium';
    const diffColor = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' }[difficulty] || '#6b7280';

    // Assign colors to each part
    const parts = Array.isArray(section.parts) ? section.parts : Object.values(section.parts || {});
    const partsHTML = parts.map(part => {
        const colors = HARMONY_SINGER_COLORS[part.singer] || { bg: '#374151', light: '#f3f4f6', text: '#9ca3af', name: part.singer };
        const isLead = part.part === 'lead' || aiSection?.leadSinger === part.singer;
        return `
            <div class="harmony-singer-chip" data-singer="${(part.singer||'').toLowerCase()}"
                style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
                       background:${colors.bg};border-radius:20px;flex-shrink:0">
                <span style="color:${colors.text};font-weight:600;font-size:0.85em">${colors.name}</span>
                <span style="color:rgba(255,255,255,0.5);font-size:0.75em">${isLead ? 'Lead' : 'Harmony'}</span>
                ${part.notes ? `<span style="color:rgba(255,255,255,0.7);font-size:0.75em">· ${part.notes}</span>` : ''}
            </div>
        `;
    }).join('');

    const teachingNote = aiSection?.teachingNote || section.timing || '';
    const interval = aiSection?.interval || '';

    return `
        <div class="harmony-learning-card" data-section="${sectionIndex}"
            style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
                   border-radius:12px;padding:16px;margin-bottom:12px">

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
                <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-weight:700;font-size:1.05em;color:white">${section.name || section.lyric || 'Section ' + (sectionIndex+1)}</span>
                    <span style="background:${diffColor}22;color:${diffColor};padding:2px 8px;border-radius:10px;font-size:0.75em;font-weight:600">${difficulty}</span>
                    ${section.workedOut ? '<span style="color:#10b981;font-size:0.8em">✓ Worked out</span>' : ''}
                    ${section.soundsGood ? '<span style="color:#f59e0b;font-size:0.8em">⭐ Sounds good</span>' : ''}
                </div>
                <button onclick="openSectionPractice('${safeSong}', ${sectionIndex})"
                    style="background:#667eea;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.82em">
                    🎤 Practice
                </button>
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">${partsHTML}</div>

            ${interval ? `<div style="font-size:0.82em;color:#a5b4fc;margin-bottom:6px">🎵 Interval: ${interval}</div>` : ''}
            ${teachingNote ? `
                <div style="background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;padding:8px 12px;border-radius:0 6px 6px 0;font-size:0.82em;color:#fcd34d;margin-top:8px">
                    💡 ${teachingNote}
                </div>` : ''}

            <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
                <button onclick="openMultiTrackStudio('${safeSong}', ${sectionIndex})"
                    style="background:rgba(102,126,234,0.15);color:#a5b4fc;border:1px solid rgba(102,126,234,0.3);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.78em">
                    🎛️ Studio
                </button>
                <button onclick="markSectionStatus('${safeSong}', ${sectionIndex}, 'workedOut')"
                    style="background:rgba(16,185,129,0.1);color:#6ee7b7;border:1px solid rgba(16,185,129,0.2);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.78em">
                    ✓ Worked Out
                </button>
                <button onclick="markSectionStatus('${safeSong}', ${sectionIndex}, 'soundsGood')"
                    style="background:rgba(245,158,11,0.1);color:#fcd34d;border:1px solid rgba(245,158,11,0.2);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.78em">
                    ⭐ Sounds Good
                </button>
            </div>
            <div id="harmonyAudioFormContainer${sectionIndex}" style="margin-top:8px"></div>
            <div style="margin-top:6px">
                <button onclick="openABCEditorForSection('${safeSong}', ${sectionIndex}, '${(section.name || section.lyric || '').replace(/'/g, '\\\'')}')"
                    style="background:rgba(139,92,246,0.1);color:#c4b5fd;border:1px solid rgba(139,92,246,0.2);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.78em">
                    🎼 Edit ABC Notation
                </button>
            </div>
        </div>
    `;
}

// ── SINGER FILTER ─────────────────────────────────────────────────────────────

function setHarmonyViewFilter(singer) {
    // Update button styles
    document.querySelectorAll('[id^="hFilter_"]').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
    });
    const activeBtn = document.getElementById('hFilter_' + singer);
    if (activeBtn) { activeBtn.classList.add('btn-primary'); activeBtn.classList.remove('btn-ghost'); }

    if (singer === 'all') {
        // Show everything
        document.querySelectorAll('.harmony-learning-card').forEach(el => {
            el.style.display = '';
            el.style.opacity = '1';
        });
        document.querySelectorAll('.harmony-singer-chip').forEach(el => el.style.opacity = '1');
        document.querySelectorAll('.lyric-block').forEach(el => {
            el.style.opacity = '1';
            el.style.color = '';
        });
    } else {
        // Filter section cards
        document.querySelectorAll('.harmony-learning-card').forEach(card => {
            const hasSinger = card.querySelector(`.harmony-singer-chip[data-singer="${singer}"]`);
            card.style.display = hasSinger ? '' : 'none';
        });
        document.querySelectorAll('.harmony-singer-chip').forEach(chip => {
            chip.style.opacity = chip.dataset.singer === singer ? '1' : '0.3';
        });
        // Filter lyric blocks - dim sections that don't involve this singer
        document.querySelectorAll('.lyric-block').forEach(block => {
            const singers = (block.dataset.singers || '').split(' ').filter(Boolean);
            const involved = singers.length === 0 || singers.includes(singer);
            block.style.opacity = involved ? '1' : '0.2';
            block.style.color = involved ? '' : 'rgba(255,255,255,0.3)';
        });
    }
}


// ── SECTION STATUS ────────────────────────────────────────────────────────────

async function markSectionStatus(songTitle, sectionIndex, field) {
    const data = await loadBandDataFromDrive(songTitle, 'harmonies_data');
    if (!data || !data.sections) return;
    const sections = Array.isArray(data.sections) ? data.sections : Object.values(data.sections);
    if (sections[sectionIndex]) {
        sections[sectionIndex][field] = !sections[sectionIndex][field];
        data.sections = sections;
        await saveBandDataToDrive(songTitle, 'harmonies_data', data);
        renderHarmonyLearningView(songTitle);
    }
}

// ── RUN AI ANALYSIS FOR ONE SONG ─────────────────────────────────────────────

async function runAIAnalysisForSong(songTitle) {
    const statusEl = document.getElementById('harmonyAIStatus');
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '⏳ Loading song data...'; }

    const songData = allSongs?.find(s => s.title === songTitle);
    const artistName = getFullBandName(songData?.band || 'GD');

    let lyrics = '';
    const harmonyData = await loadBandDataFromDrive(songTitle, 'harmonies_data');
    if (harmonyData?.lyrics) {
        lyrics = harmonyData.lyrics;
    } else {
        if (statusEl) statusEl.textContent = '🎵 Fetching lyrics from Genius...';
        const fetched = await fetchLyricsFromGenius(songTitle, artistName);
        if (fetched) {
            lyrics = fetched.lyrics;
            // Save lyrics into harmonies_data
            await saveBandDataToDrive(songTitle, 'harmonies_data', { ...(harmonyData||{}), lyrics });
        }
    }

    const aiData = await analyzeHarmonyWithAI(songTitle, artistName, lyrics);
    if (aiData) {
        await saveBandDataToDrive(songTitle, 'harmony_ai', { ...aiData, generatedAt: new Date().toISOString() });
        renderHarmonyLearningView(songTitle);
    }
}

// ── PRACTICE MODE ─────────────────────────────────────────────────────────────

let pitchDetectionActive = false;
let pitchAudioContext = null;
let pitchAnalyser = null;
let pitchStream = null;

function openPracticeMode(songTitle) {
    const modal = document.createElement('div');
    modal.id = 'practiceModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';

    // Get current singer
    const currentUser = (typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : null) || 'drew';
    const colors = HARMONY_SINGER_COLORS[currentUser] || HARMONY_SINGER_COLORS.drew;

    modal.innerHTML = `
        <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                <h3 style="margin:0;color:white">🎤 Practice Mode — ${songTitle}</h3>
                <button onclick="closePracticeMode()" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.3em">✕</button>
            </div>

            <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin-bottom:16px;text-align:center">
                <div style="font-size:0.82em;color:var(--text-dim);margin-bottom:8px">Practicing as</div>
                <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:${colors.bg};border-radius:20px">
                    <span style="color:${colors.text};font-weight:700">${colors.name}</span>
                </div>
                <div style="margin-top:10px;display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
                    ${Object.entries(HARMONY_SINGER_COLORS).map(([key, c]) => `
                        <button onclick="setPracticeSinger('${key}')" id="practiceBtn_${key}"
                            style="background:${key===currentUser?c.bg:'rgba(255,255,255,0.05)'};color:${c.text};border:1px solid ${c.bg};padding:4px 10px;border-radius:12px;cursor:pointer;font-size:0.78em">
                            ${c.name}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Pitch Detector -->
            <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <strong style="color:white">🎵 Live Pitch Detector</strong>
                    <button id="pitchToggleBtn" onclick="togglePitchDetection()"
                        style="background:#667eea;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600">
                        🎙️ Start Listening
                    </button>
                </div>

                <div style="text-align:center;padding:20px 0">
                    <div id="pitchNote" style="font-size:3em;font-weight:800;color:white;min-height:1.2em">—</div>
                    <div id="pitchFreq" style="font-size:0.85em;color:#6b7280;margin-top:4px"></div>
                    <div id="pitchMeter" style="height:8px;background:rgba(255,255,255,0.1);border-radius:4px;margin-top:12px;overflow:hidden">
                        <div id="pitchMeterBar" style="height:100%;width:0%;background:#10b981;border-radius:4px;transition:width 0.1s"></div>
                    </div>
                    <div id="pitchAccuracy" style="font-size:0.82em;margin-top:8px;color:#9ca3af"></div>
                </div>
            </div>

            <!-- Metronome -->
            <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:14px;margin-bottom:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <strong style="color:white">🥁 Metronome</strong>
                    <div style="display:flex;align-items:center;gap:8px">
                        <input type="range" id="practiceBpm" min="40" max="200" value="80"
                            oninput="document.getElementById('practiceBpmVal').textContent=this.value"
                            style="width:100px">
                        <span id="practiceBpmVal" style="color:white;font-weight:600;min-width:35px">80</span>
                        <span style="color:#6b7280;font-size:0.82em">BPM</span>
                        <button id="metroBtn" onclick="togglePracticeMetronome()"
                            style="background:#4b5563;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer">
                            ▶ Start
                        </button>
                    </div>
                </div>
            </div>

            <!-- Notes for this singer -->
            <div id="practiceNotesPanel" style="background:rgba(255,255,255,0.04);border-radius:10px;padding:14px">
                <strong style="color:white;display:block;margin-bottom:10px">📝 My Notes</strong>
                <textarea id="practiceNoteInput" rows="3" placeholder="Add practice notes for yourself..."
                    style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;color:white;font-size:0.85em;resize:vertical"></textarea>
                <button onclick="savePracticeNote('${songTitle.replace(/'/g,"\\'")}', '${currentUser}')"
                    style="margin-top:8px;background:#667eea;color:white;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.82em">
                    Save Note
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Load BPM from Firebase
    loadBandDataFromDrive(songTitle, 'song_bpm').then(d => {
        if (d?.bpm) {
            const slider = document.getElementById('practiceBpm');
            const val = document.getElementById('practiceBpmVal');
            if (slider) slider.value = d.bpm;
            if (val) val.textContent = d.bpm;
        }
    });
}

function openSectionPractice(songTitle, sectionIndex) {
    openPracticeMode(songTitle);
}

function closePracticeMode() {
    stopPitchDetection();
    stopPracticeMetronome();
    const modal = document.getElementById('practiceModal');
    if (modal) modal.remove();
}

function setPracticeSinger(singer) {
    const colors = HARMONY_SINGER_COLORS[singer];
    Object.keys(HARMONY_SINGER_COLORS).forEach(k => {
        const btn = document.getElementById('practiceBtn_' + k);
        if (btn) btn.style.background = k === singer ? HARMONY_SINGER_COLORS[k].bg : 'rgba(255,255,255,0.05)';
    });
}

// ── PITCH DETECTION ───────────────────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function frequencyToNote(freq) {
    if (freq <= 0) return null;
    const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
    const rounded = Math.round(noteNum) + 69;
    const octave = Math.floor(rounded / 12) - 1;
    const note = NOTE_NAMES[rounded % 12];
    const cents = Math.round((noteNum - Math.round(noteNum)) * 100);
    return { note, octave, cents, display: `${note}${octave}` };
}

function autoCorrelate(buffer, sampleRate) {
    let SIZE = buffer.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1;
    const threshold = 0.2;
    for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buffer[i]) < threshold) { r1 = i; break; } }
    for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; } }
    buffer = buffer.slice(r1, r2);
    SIZE = buffer.length;

    const c = new Float32Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE - i; j++) c[i] += buffer[j] * buffer[j + i];

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }

    let T0 = maxpos;
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    return sampleRate / T0;
}

async function togglePitchDetection() {
    if (pitchDetectionActive) {
        stopPitchDetection();
    } else {
        await startPitchDetection();
    }
}

async function startPitchDetection() {
    try {
        pitchStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        pitchAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        pitchAnalyser = pitchAudioContext.createAnalyser();
        pitchAnalyser.fftSize = 2048;

        const source = pitchAudioContext.createMediaStreamSource(pitchStream);
        source.connect(pitchAnalyser);

        pitchDetectionActive = true;
        const btn = document.getElementById('pitchToggleBtn');
        if (btn) { btn.textContent = '⏹ Stop'; btn.style.background = '#ef4444'; }

        const buffer = new Float32Array(pitchAnalyser.fftSize);
        function detect() {
            if (!pitchDetectionActive) return;
            pitchAnalyser.getFloatTimeDomainData(buffer);
            const freq = autoCorrelate(buffer, pitchAudioContext.sampleRate);

            const noteEl = document.getElementById('pitchNote');
            const freqEl = document.getElementById('pitchFreq');
            const meterBar = document.getElementById('pitchMeterBar');
            const accuracyEl = document.getElementById('pitchAccuracy');

            if (freq > 60 && freq < 2000) {
                const result = frequencyToNote(freq);
                if (result && noteEl) {
                    noteEl.textContent = result.display;
                    noteEl.style.color = Math.abs(result.cents) < 10 ? '#10b981' : Math.abs(result.cents) < 25 ? '#f59e0b' : '#ef4444';
                }
                if (freqEl) freqEl.textContent = `${Math.round(freq)} Hz`;
                if (meterBar) {
                    const pct = Math.min(100, Math.max(0, 50 + result?.cents));
                    meterBar.style.width = pct + '%';
                    meterBar.style.background = Math.abs(result?.cents||99) < 15 ? '#10b981' : '#f59e0b';
                }
                if (accuracyEl && result) {
                    const cents = result.cents;
                    accuracyEl.textContent = cents === 0 ? '✅ In tune!' : cents > 0 ? `↑ ${cents}¢ sharp` : `↓ ${Math.abs(cents)}¢ flat`;
                    accuracyEl.style.color = Math.abs(cents) < 10 ? '#10b981' : Math.abs(cents) < 25 ? '#f59e0b' : '#ef4444';
                }
            } else {
                if (noteEl) { noteEl.textContent = '—'; noteEl.style.color = '#6b7280'; }
                if (freqEl) freqEl.textContent = 'Sing into your mic...';
                if (meterBar) meterBar.style.width = '0%';
            }
            requestAnimationFrame(detect);
        }
        detect();

    } catch (err) {
        alert('Could not access microphone: ' + err.message);
    }
}

function stopPitchDetection() {
    pitchDetectionActive = false;
    if (pitchStream) { pitchStream.getTracks().forEach(t => t.stop()); pitchStream = null; }
    if (pitchAudioContext) { pitchAudioContext.close(); pitchAudioContext = null; }
    const btn = document.getElementById('pitchToggleBtn');
    if (btn) { btn.textContent = '🎙️ Start Listening'; btn.style.background = '#667eea'; }
    const noteEl = document.getElementById('pitchNote');
    if (noteEl) { noteEl.textContent = '—'; noteEl.style.color = 'white'; }
}

// ── PRACTICE METRONOME ────────────────────────────────────────────────────────

let practiceMetroCtx = null;
let practiceMetroInterval = null;
let practiceMetroActive = false;

function togglePracticeMetronome() {
    if (practiceMetroActive) {
        stopPracticeMetronome();
    } else {
        startPracticeMetronome();
    }
}

function startPracticeMetronome() {
    const bpm = parseInt(document.getElementById('practiceBpm')?.value || '80');
    practiceMetroCtx = new (window.AudioContext || window.webkitAudioContext)();
    practiceMetroActive = true;

    const btn = document.getElementById('metroBtn');
    if (btn) { btn.textContent = '⏹ Stop'; btn.style.background = '#ef4444'; }

    let beat = 0;
    const interval = (60 / bpm) * 1000;

    function tick() {
        if (!practiceMetroActive) return;
        const osc = practiceMetroCtx.createOscillator();
        const gain = practiceMetroCtx.createGain();
        osc.connect(gain);
        gain.connect(practiceMetroCtx.destination);
        osc.frequency.value = beat % 4 === 0 ? 1000 : 800;
        gain.gain.setValueAtTime(0.3, practiceMetroCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, practiceMetroCtx.currentTime + 0.05);
        osc.start(practiceMetroCtx.currentTime);
        osc.stop(practiceMetroCtx.currentTime + 0.05);
        beat++;
        practiceMetroInterval = setTimeout(tick, interval);
    }
    tick();
}

function stopPracticeMetronome() {
    practiceMetroActive = false;
    if (practiceMetroInterval) clearTimeout(practiceMetroInterval);
    if (practiceMetroCtx) { practiceMetroCtx.close(); practiceMetroCtx = null; }
    const btn = document.getElementById('metroBtn');
    if (btn) { btn.textContent = '▶ Start'; btn.style.background = '#4b5563'; }
}

// ── SAVE PRACTICE NOTE ────────────────────────────────────────────────────────

async function savePracticeNote(songTitle, singer) {
    const input = document.getElementById('practiceNoteInput');
    if (!input?.value?.trim()) return;
    const note = input.value.trim();
    const existing = await loadBandDataFromDrive(songTitle, `practice_notes_${singer}`) || [];
    const notes = Array.isArray(existing) ? existing : [existing];
    notes.push({ text: note, date: new Date().toLocaleDateString() });
    await saveBandDataToDrive(songTitle, `practice_notes_${singer}`, notes);
    input.value = '';
    alert('✅ Note saved!');
}

console.log('🎤 Harmony AI Studio v1 loaded');

// ============================================================================
// PRACTICE MODE — Individual Woodshedding Overlay
// ============================================================================
// Full-screen overlay with tabbed panels for focused individual practice.
// Entry: openPracticeMode(songTitle) from song detail or setlist
// Reuses: chart system, transpose, brain tuner, ABCJS, audio recording
// ============================================================================

let pmQueue = [];
let pmIndex = 0;
let pmActiveTab = 'chart';
let pmMetronomeTimer = null;
let pmMetronomeBpm = 120;
let pmMetronomeCtx = null;
let pmLoopSection = null; // null = no loop, or {start, end} line indices
let pmRecorder = null;
let pmRecordedChunks = [];
let pmRecordings = []; // saved recordings for this song

function openPracticeMode(songTitle) {
    const songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.title === songTitle);
    pmQueue = [{ title: songTitle, band: songData?.band || '' }];
    pmIndex = 0;
    pmShow();
}

async function openPracticeModeFromSetlist(setlistId) {
    const setlist = await loadBandDataFromDrive('_setlists', setlistId);
    if (!setlist?.songs?.length) { showToast('⚠️ Empty setlist'); return; }
    pmQueue = setlist.songs.map(s => typeof s === 'string' ? { title: s, band: '' } : { title: s.title, band: s.band || '' });
    pmIndex = 0;
    pmShow();
}

function pmEnsureOverlay() {
    if (document.getElementById('pmOverlay')) return;
    const el = document.createElement('div');
    el.id = 'pmOverlay';
    el.className = 'pm-overlay';
    el.innerHTML = `
        <!-- HEADER -->
        <div class="pm-header">
            <button class="pm-close" onclick="closePracticeMode()">✕</button>
            <div class="pm-title-block">
                <div class="pm-song-title" id="pmSongTitle">Song</div>
                <div class="pm-song-meta" id="pmSongMeta"></div>
            </div>
            <div class="pm-nav-block">
                <button class="pm-nav-btn" onclick="pmNavigate(-1)" id="pmPrevBtn">‹</button>
                <span class="pm-position" id="pmPosition"></span>
                <button class="pm-nav-btn" onclick="pmNavigate(1)" id="pmNextBtn">›</button>
            </div>
        </div>

        <!-- TABS -->
        <div class="pm-tabs" id="pmTabs">
            <button class="pm-tab active" data-tab="chart" onclick="pmSwitchTab('chart',this)">🎵 Chart</button>
            <button class="pm-tab" data-tab="know" onclick="pmSwitchTab('know',this)">📖 Know</button>
            <button class="pm-tab" data-tab="memory" onclick="pmSwitchTab('memory',this)">🧠 Memory</button>
            <button class="pm-tab" data-tab="harmony" onclick="pmSwitchTab('harmony',this)">🎤 Harmony</button>
            <button class="pm-tab" data-tab="record" onclick="pmSwitchTab('record',this)">🎙️ Record</button>
        </div>

        <!-- TAB CONTENT -->
        <div class="pm-body" id="pmBody">

            <!-- TAB: CHART + PLAY -->
            <div class="pm-panel" id="pmPanelChart">
                <div class="pm-toolbar">
                    <button class="pm-tool-btn" onclick="pmTranspose(-1)">♭</button>
                    <span class="pm-key-display" id="pmKeyDisplay">—</span>
                    <button class="pm-tool-btn" onclick="pmTranspose(1)">♯</button>
                    <div class="pm-tool-divider"></div>
                    <button class="pm-tool-btn" onclick="pmAdjustFont(-1)">A−</button>
                    <button class="pm-tool-btn" onclick="pmAdjustFont(1)">A+</button>
                    <div class="pm-tool-divider"></div>
                    <button class="pm-tool-btn" id="pmScrollBtn" onclick="pmToggleScroll()">▶ Scroll</button>
                    <input type="range" id="pmScrollSpeedSlider" min="1" max="5" value="2"
                        oninput="pmSetScrollSpeed(this.value)" style="display:none;width:60px">
                    <div class="pm-tool-divider"></div>
                    <button class="pm-tool-btn" id="pmBrainBtn" onclick="pmToggleBrainTuner()">🧠 Full</button>
                </div>

                <!-- Metronome bar -->
                <div class="pm-metronome-bar">
                    <button class="pm-tool-btn" onclick="pmAdjustMetronomeBpm(-5)">−5</button>
                    <button class="pm-tool-btn" onclick="pmAdjustMetronomeBpm(-1)">−</button>
                    <span id="pmBpmDisplay" style="color:#fbbf24;font-weight:700;min-width:40px;text-align:center">120</span>
                    <button class="pm-tool-btn" onclick="pmAdjustMetronomeBpm(1)">+</button>
                    <button class="pm-tool-btn" onclick="pmAdjustMetronomeBpm(5)">+5</button>
                    <span style="color:#94a3b8;font-size:0.75em">BPM</span>
                    <div class="pm-tool-divider"></div>
                    <button class="pm-tool-btn" id="pmMetronomeBtn" onclick="pmToggleMetronome()">🥁 Start</button>
                    <button class="pm-tool-btn" onclick="pmCountOff()">🎵 Count</button>
                </div>

                <div class="pm-chart-scroll" id="pmChartScroll">
                    <div class="pm-chart-text gig-chart-text" id="pmChartText"></div>
                    <div class="pm-no-chart hidden" id="pmNoChart">
                        <div style="font-size:2em;margin-bottom:8px">🎸</div>
                        <div style="color:#94a3b8">No chart yet — import from Ultimate Guitar on the song page</div>
                    </div>
                </div>
            </div>

            <!-- TAB: KNOW THE SONG -->
            <div class="pm-panel hidden" id="pmPanelKnow">
                <div class="pm-chart-scroll" id="pmKnowScroll">
                    <div id="pmKnowContent" style="padding:4px">
                        <div style="text-align:center;color:#94a3b8;padding:40px 20px">Loading...</div>
                    </div>
                </div>
            </div>

            <!-- TAB: MEMORY PALACE -->
            <div class="pm-panel hidden" id="pmPanelMemory">
                <div class="pm-toolbar">
                    <span style="color:#94a3b8;font-size:0.82em">Level:</span>
                    <button class="pm-tool-btn pm-mem-btn active" data-level="0" onclick="pmSetMemoryLevel(0,this)">Full</button>
                    <button class="pm-tool-btn pm-mem-btn" data-level="1" onclick="pmSetMemoryLevel(1,this)">Easy</button>
                    <button class="pm-tool-btn pm-mem-btn" data-level="2" onclick="pmSetMemoryLevel(2,this)">Med</button>
                    <button class="pm-tool-btn pm-mem-btn" data-level="3" onclick="pmSetMemoryLevel(3,this)">Hard</button>
                    <button class="pm-tool-btn pm-mem-btn" data-level="4" onclick="pmSetMemoryLevel(4,this)">🎯 Test</button>
                    <div style="flex:1"></div>
                    <button class="pm-tool-btn" onclick="pmMemoryShuffle()" title="Randomize which words are hidden">🔀</button>
                </div>
                <div class="pm-chart-scroll" id="pmMemoryScroll">
                    <div class="pm-chart-text gig-chart-text" id="pmMemoryText"></div>
                </div>
            </div>

            <!-- TAB: HARMONY -->
            <div class="pm-panel hidden" id="pmPanelHarmony">
                <div class="pm-chart-scroll" id="pmHarmonyScroll">
                    <div id="pmHarmonyContent" style="padding:4px">
                        <div style="text-align:center;color:#94a3b8;padding:40px 20px">Loading harmonies...</div>
                    </div>
                </div>
            </div>

            <!-- TAB: RECORD & REVIEW -->
            <div class="pm-panel hidden" id="pmPanelRecord">
                <div class="pm-chart-scroll" id="pmRecordScroll">
                    <div style="padding:4px">
                        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
                            <button class="pm-tool-btn" id="pmRecordBtn" onclick="pmToggleRecord()" style="padding:8px 16px;font-size:0.9em">⏺ Record</button>
                            <button class="pm-tool-btn" id="pmPlayLastBtn" onclick="pmPlayLastRecording()" style="padding:8px 16px;font-size:0.9em" disabled>▶ Play Last</button>
                            <button class="pm-tool-btn" onclick="pmSaveRecording()" style="padding:8px 16px;font-size:0.9em" id="pmSaveRecBtn" disabled>💾 Save</button>
                        </div>
                        <div id="pmRecordingStatus" style="color:#94a3b8;font-size:0.85em;margin-bottom:16px"></div>
                        <div id="pmRecordingWaveform" style="height:60px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:16px;display:none"></div>
                        <h3 style="color:#e2e8f0;font-size:0.95em;margin:0 0 12px 0">📁 Saved Recordings</h3>
                        <div id="pmRecordingsList"></div>
                    </div>
                </div>
            </div>

        </div>
    `;
    document.body.appendChild(el);
    document.addEventListener('keydown', pmKeyHandler);
}

function pmShow() {
    pmEnsureOverlay();
    document.getElementById('pmOverlay').classList.add('pm-visible');
    document.body.dataset.scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    pmActiveTab = 'chart';
    pmLoadSong();
}

function closePracticeMode() {
    const overlay = document.getElementById('pmOverlay');
    if (!overlay) return;
    overlay.classList.remove('pm-visible');
    const scrollY = document.body.dataset.scrollY || '0';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, parseInt(scrollY));
    pmStopMetronome();
    pmStopScroll();
    pmStopRecord();
}

function pmNavigate(delta) {
    const newIdx = pmIndex + delta;
    if (newIdx < 0 || newIdx >= pmQueue.length) return;
    pmIndex = newIdx;
    pmLoadSong();
}

function pmSwitchTab(tab, btn) {
    pmActiveTab = tab;
    document.querySelectorAll('#pmTabs .pm-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.pm-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`pmPanel${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (panel) panel.classList.remove('hidden');

    // Lazy-load tab content
    const song = pmQueue[pmIndex];
    if (!song) return;
    if (tab === 'know') pmLoadKnowTab(song.title);
    if (tab === 'harmony') pmLoadHarmonyTab(song.title);
    if (tab === 'memory') pmLoadMemoryTab(song.title);
    if (tab === 'record') pmLoadRecordTab(song.title);
}

function pmKeyHandler(e) {
    const overlay = document.getElementById('pmOverlay');
    if (!overlay?.classList.contains('pm-visible')) return;
    if (e.key === 'Escape') { closePracticeMode(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { pmNavigate(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { pmNavigate(-1); e.preventDefault(); }
    if (e.key === ' ' && pmActiveTab === 'chart') { pmToggleScroll(); e.preventDefault(); }
    if (e.key === 'm') { pmToggleMetronome(); e.preventDefault(); }
}

// ── Load song into Practice Mode ─────────────────────────────────────────────
let pmTransposeSteps = 0;
let pmOriginalKey = '';
let pmOriginalChartText = '';
let pmFontSize = 16;
let pmBrainLevel = 0;
let pmMemoryLevel = 0;
let pmMemorySeed = 1;

async function pmLoadSong() {
    const song = pmQueue[pmIndex];
    if (!song) return;

    // Header
    document.getElementById('pmSongTitle').textContent = song.title;
    document.getElementById('pmPosition').textContent =
        pmQueue.length > 1 ? `${pmIndex + 1} / ${pmQueue.length}` : '';
    document.getElementById('pmPrevBtn').style.opacity = pmIndex > 0 ? '1' : '0.25';
    document.getElementById('pmNextBtn').style.opacity = pmIndex < pmQueue.length - 1 ? '1' : '0.25';

    // Reset state
    pmStopMetronome();
    pmStopScroll();
    pmBrainLevel = 0;
    const brainBtn = document.getElementById('pmBrainBtn');
    if (brainBtn) { brainBtn.textContent = '🧠 Full'; brainBtn.style.background = ''; }

    // Load chart
    let chartText = '';
    let chartData = null;
    try {
        chartData = await loadBandDataFromDrive(song.title, 'chart');
        if (chartData?.text?.trim()) chartText = chartData.text;
    } catch(e) {}
    if (!chartText) {
        try {
            const crib = await loadBandDataFromDrive(song.title, 'rehearsal_crib');
            if (crib && typeof crib === 'string') chartText = crib;
        } catch(e) {}
    }

    pmOriginalChartText = chartText;
    pmOriginalKey = chartData?.key || '';

    // Load saved transpose
    pmTransposeSteps = 0;
    try {
        const saved = await loadBandDataFromDrive(song.title, 'transpose');
        if (saved && typeof saved === 'number') pmTransposeSteps = saved;
    } catch(e) {}

    // Load BPM
    if (chartData?.bpm) pmMetronomeBpm = parseInt(chartData.bpm) || 120;
    const bpmD = document.getElementById('pmBpmDisplay');
    if (bpmD) bpmD.textContent = pmMetronomeBpm;

    // Render chart
    const el = document.getElementById('pmChartText');
    if (chartText.trim()) {
        const displayText = pmTransposeSteps !== 0 ? transposeChartText(chartText, pmTransposeSteps) : chartText;
        el.innerHTML = renderChartSmart(displayText);
        el._originalText = chartText;
        el.style.display = 'block';
        document.getElementById('pmNoChart').classList.add('hidden');
    } else {
        el.style.display = 'none';
        document.getElementById('pmNoChart').classList.remove('hidden');
    }

    pmUpdateKeyDisplay();
    document.getElementById('pmChartScroll').scrollTop = 0;

    // Meta
    const meta = [];
    if (chartData?.key) meta.push(`🔑 ${pmTransposeSteps ? transposeNote(chartData.key, pmTransposeSteps) : chartData.key}`);
    if (chartData?.capo) meta.push(`Capo ${chartData.capo}`);
    document.getElementById('pmSongMeta').textContent = meta.join('  ·  ');

    // Reset tab to chart
    pmSwitchTab('chart', document.querySelector('#pmTabs .pm-tab[data-tab="chart"]'));

    // Load recordings list
    pmRecordings = [];
    try {
        pmRecordings = toArray(await loadBandDataFromDrive(song.title, 'practice_recordings') || []);
    } catch(e) {}
}

// ── Chart tab tools ──────────────────────────────────────────────────────────
function pmTranspose(delta) {
    pmTransposeSteps += delta;
    const el = document.getElementById('pmChartText');
    if (!el || !pmOriginalChartText) return;
    const displayText = pmTransposeSteps !== 0 ? transposeChartText(pmOriginalChartText, pmTransposeSteps) : pmOriginalChartText;
    el.innerHTML = renderChartSmart(displayText);
    el._originalText = pmOriginalChartText;
    pmUpdateKeyDisplay();
    if (pmBrainLevel > 0) pmApplyBrainTuner('pmChartText');
    // Save
    const song = pmQueue[pmIndex];
    if (song) saveBandDataToDrive(song.title, 'transpose', pmTransposeSteps).catch(() => {});
}

function pmUpdateKeyDisplay() {
    const display = document.getElementById('pmKeyDisplay');
    if (!display) return;
    if (pmTransposeSteps === 0) {
        display.textContent = pmOriginalKey || '—';
        display.style.color = '#67e8f9';
    } else {
        display.textContent = pmOriginalKey ? transposeNote(pmOriginalKey, pmTransposeSteps) : `${pmTransposeSteps > 0 ? '+' : ''}${pmTransposeSteps}`;
        display.style.color = '#fbbf24';
    }
}

function pmAdjustFont(delta) {
    pmFontSize = Math.min(36, Math.max(10, pmFontSize + delta * 2));
    const el = document.getElementById('pmChartText');
    if (el) el.style.fontSize = pmFontSize + 'px';
    const el2 = document.getElementById('pmMemoryText');
    if (el2) el2.style.fontSize = pmFontSize + 'px';
}

// ── Brain Tuner (Practice Mode) ──────────────────────────────────────────────
function pmToggleBrainTuner() {
    pmBrainLevel = (pmBrainLevel + 1) % 5;
    const btn = document.getElementById('pmBrainBtn');
    const labels = ['🧠 Full', '🧠 Easy', '🧠 Med', '🧠 Hard', '🧠 Chords'];
    if (btn) {
        btn.textContent = labels[pmBrainLevel];
        btn.style.background = pmBrainLevel > 0 ? 'rgba(251,191,36,0.2)' : '';
    }
    pmApplyBrainTuner('pmChartText');
}

function pmApplyBrainTuner(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    // Reuse the gig mode brain tuner logic
    const clLines = el.querySelectorAll('.cl-line');
    const lyricOnlys = el.querySelectorAll('.cl-lyric-only');
    const level = containerId === 'pmMemoryText' ? pmMemoryLevel : pmBrainLevel;
    const seed = containerId === 'pmMemoryText' ? pmMemorySeed : 1;

    if (level === 0) {
        el.querySelectorAll('.cl-lyric, .cl-lyric-only').forEach(span => {
            if (span._originalText !== undefined) span.textContent = span._originalText;
            span.style.opacity = '1';
        });
        return;
    }
    if (level === 4) {
        el.querySelectorAll('.cl-lyric, .cl-lyric-only').forEach(span => {
            if (span._originalText === undefined) span._originalText = span.textContent;
            span.textContent = span._originalText.replace(/\S/g, '·');
            span.style.opacity = '0.3';
        });
        return;
    }

    const maskPct = [0, 0.25, 0.5, 0.75][level];
    clLines.forEach((line, lineIdx) => {
        const lyricSpans = line.querySelectorAll('.cl-lyric');
        let wordIndex = 0;
        let isFirstWord = true;
        lyricSpans.forEach(span => {
            if (span._originalText === undefined) span._originalText = span.textContent;
            const parts = span._originalText.split(/(\s+)/);
            const masked = parts.map(part => {
                if (/^\s+$/.test(part)) return part;
                wordIndex++;
                if (level === 3 && isFirstWord && part.trim()) { isFirstWord = false; return part; }
                isFirstWord = false;
                const hash = ((lineIdx * seed) * 31 + wordIndex * 7) % 100;
                return hash < maskPct * 100 ? part.replace(/\S/g, '_') : part;
            });
            span.textContent = masked.join('');
            span.style.opacity = '1';
        });
    });
    lyricOnlys.forEach((span, idx) => {
        if (span._originalText === undefined) span._originalText = span.textContent;
        const parts = span._originalText.split(/(\s+)/);
        let wordIndex = 0;
        let isFirst = true;
        const masked = parts.map(part => {
            if (/^\s+$/.test(part)) return part;
            wordIndex++;
            if (level === 3 && isFirst && part.trim()) { isFirst = false; return part; }
            isFirst = false;
            const hash = ((idx * seed) * 31 + wordIndex * 7) % 100;
            return hash < maskPct * 100 ? part.replace(/\S/g, '_') : part;
        });
        span.textContent = masked.join('');
        span.style.opacity = '1';
    });
}

// ── Auto-scroll (Practice Mode) ──────────────────────────────────────────────
let pmScrollTimer = null;
function pmToggleScroll() {
    if (pmScrollTimer) { pmStopScroll(); } else {
        const speed = parseInt(document.getElementById('pmScrollSpeedSlider')?.value || '2');
        pmStartScroll(speed);
    }
}
function pmStartScroll(speed) {
    const body = document.getElementById('pmChartScroll');
    const btn = document.getElementById('pmScrollBtn');
    const slider = document.getElementById('pmScrollSpeedSlider');
    if (btn) btn.textContent = '⏸ Scroll';
    if (slider) slider.style.display = 'inline-block';
    const pxPerSecond = [25, 45, 70, 110, 170][speed - 1] || 45;
    let lastTime = performance.now();
    function step(now) {
        if (!pmScrollTimer) return;
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        if (body) {
            body.scrollTop += pxPerSecond * dt;
            if (body.scrollTop + body.clientHeight >= body.scrollHeight - 5) { pmStopScroll(); return; }
        }
        pmScrollTimer = requestAnimationFrame(step);
    }
    pmScrollTimer = requestAnimationFrame(step);
}
function pmStopScroll() {
    if (pmScrollTimer) cancelAnimationFrame(pmScrollTimer);
    pmScrollTimer = null;
    const btn = document.getElementById('pmScrollBtn');
    const slider = document.getElementById('pmScrollSpeedSlider');
    if (btn) btn.textContent = '▶ Scroll';
    if (slider) slider.style.display = 'none';
}
function pmSetScrollSpeed(speed) {
    if (pmScrollTimer) { pmStopScroll(); pmStartScroll(parseInt(speed)); }
}

// ── Metronome ────────────────────────────────────────────────────────────────
function pmAdjustMetronomeBpm(delta) {
    pmMetronomeBpm = Math.min(300, Math.max(30, pmMetronomeBpm + delta));
    const d = document.getElementById('pmBpmDisplay');
    if (d) d.textContent = pmMetronomeBpm;
    // If running, restart with new BPM
    if (pmMetronomeTimer) { pmStopMetronome(); pmStartMetronome(); }
}

function pmToggleMetronome() {
    if (pmMetronomeTimer) { pmStopMetronome(); } else { pmStartMetronome(); }
}

function pmStartMetronome() {
    if (!pmMetronomeCtx) pmMetronomeCtx = new (window.AudioContext || window.webkitAudioContext)();
    const btn = document.getElementById('pmMetronomeBtn');
    if (btn) { btn.textContent = '🥁 Stop'; btn.style.background = 'rgba(239,68,68,0.2)'; }
    let beat = 0;
    function tick() {
        beat = (beat % 4) + 1;
        const osc = pmMetronomeCtx.createOscillator();
        const gain = pmMetronomeCtx.createGain();
        osc.connect(gain); gain.connect(pmMetronomeCtx.destination);
        osc.frequency.value = beat === 1 ? 1000 : 800;
        gain.gain.setValueAtTime(0.3, pmMetronomeCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, pmMetronomeCtx.currentTime + 0.08);
        osc.start(pmMetronomeCtx.currentTime);
        osc.stop(pmMetronomeCtx.currentTime + 0.08);
    }
    tick();
    pmMetronomeTimer = setInterval(tick, 60000 / pmMetronomeBpm);
}

function pmStopMetronome() {
    if (pmMetronomeTimer) clearInterval(pmMetronomeTimer);
    pmMetronomeTimer = null;
    const btn = document.getElementById('pmMetronomeBtn');
    if (btn) { btn.textContent = '🥁 Start'; btn.style.background = ''; }
}

function pmCountOff() {
    if (!pmMetronomeCtx) pmMetronomeCtx = new (window.AudioContext || window.webkitAudioContext)();
    let beat = 0;
    const interval = 60000 / pmMetronomeBpm;
    const display = document.getElementById('pmBpmDisplay');
    function tick() {
        beat++;
        if (display) { display.textContent = beat; display.style.color = beat === 1 ? '#ef4444' : '#fbbf24'; }
        const osc = pmMetronomeCtx.createOscillator();
        const gain = pmMetronomeCtx.createGain();
        osc.connect(gain); gain.connect(pmMetronomeCtx.destination);
        osc.frequency.value = beat === 1 ? 1000 : 800;
        gain.gain.setValueAtTime(0.5, pmMetronomeCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, pmMetronomeCtx.currentTime + 0.1);
        osc.start(pmMetronomeCtx.currentTime);
        osc.stop(pmMetronomeCtx.currentTime + 0.1);
        if (beat >= 4) {
            setTimeout(() => { if (display) { display.textContent = pmMetronomeBpm; display.style.color = '#fbbf24'; } }, interval * 0.8);
        } else { setTimeout(tick, interval); }
    }
    tick();
}

// ── Know the Song tab ────────────────────────────────────────────────────────
let pmKnowLoaded = {};
async function pmLoadKnowTab(songTitle) {
    if (pmKnowLoaded[songTitle]) return;
    const container = document.getElementById('pmKnowContent');

    let meaning = null;
    try { meaning = await loadBandDataFromDrive(songTitle, 'song_meaning'); } catch(e) {}

    let structure = null;
    try { structure = await loadBandDataFromDrive(songTitle, 'song_structure'); } catch(e) {}
    if (!structure) {
        const bk = typeof bandKnowledgeBase !== 'undefined' ? bandKnowledgeBase[songTitle] : null;
        if (bk) structure = { whoStarts: bk.songStructure?.whoStarts || [], howStarts: bk.songStructure?.howStarts || '', whoCuesEnding: bk.songStructure?.whoCuesEnding || '', howEnds: bk.songStructure?.howEnds || '' };
    }
    if (!structure) structure = {};

    const songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.title === songTitle);
    const band = songData ? getFullBandName(songData.band) : '';
    const safeSong = songTitle.replace(/'/g, "\\'");

    container.innerHTML = `
        <div style="margin-bottom:16px">
            <h3 style="color:#e2e8f0;margin:0 0 4px 0;font-size:1em">📖 ${songTitle}</h3>
            <div style="color:#94a3b8;font-size:0.82em">${band}</div>
        </div>

        <!-- SONG MEANING -->
        <div class="pm-card">
            <div class="pm-card-header">
                <h4 style="color:#67e8f9;margin:0;font-size:0.9em">🎵 Song Meaning & Story</h4>
                <div style="display:flex;gap:4px">
                    <button onclick="pmFetchGenius('${safeSong}')" class="pm-tool-btn" title="Auto-fetch from Genius">🔍 Genius</button>
                    <button onclick="pmEditField('${safeSong}','text','Song meaning')" class="pm-tool-btn">✏️</button>
                </div>
            </div>
            <div id="pmMeaningText" class="pm-card-body">${meaning?.text || '<span class="pm-empty">No song meaning added yet. Tap 🔍 Genius to auto-fetch.</span>'}</div>
        </div>

        <!-- MEMORY PALACE SCENES -->
        <div class="pm-card">
            <div class="pm-card-header">
                <h4 style="color:#e879f9;margin:0;font-size:0.9em">🏰 Memory Palace</h4>
                <button onclick="pmEditField('${safeSong}','memoryPalace','Memory palace scenes')" class="pm-tool-btn">✏️</button>
            </div>
            <div id="pmMemoryPalaceText" class="pm-card-body">${meaning?.memoryPalace || '<span class="pm-empty">Visual scene descriptions for each section to help memorize the song. Add imagery cues here — e.g. "Verse 1: Imagine standing at a crossroads at dawn, birds singing overhead..."</span>'}</div>
        </div>

        <!-- SONG STRUCTURE (editable, syncs with main app) -->
        <div class="pm-card">
            <div class="pm-card-header">
                <h4 style="color:#f59e0b;margin:0;font-size:0.9em">🏗️ Song Structure</h4>
                <button onclick="pmEditStructure('${safeSong}')" class="pm-tool-btn">✏️ Edit</button>
            </div>
            <div class="pm-card-body" id="pmStructureContent">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                    <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:10px">
                        <div style="font-size:0.7em;font-weight:800;color:#34d399;margin-bottom:6px">▶ START</div>
                        <div style="font-size:0.82em;color:#cbd5e1">${structure.whoStarts?.length ? structure.whoStarts.map(m => (typeof bandMembers !== 'undefined' && bandMembers[m]) ? bandMembers[m].name : m).join(', ') : '<span class="pm-empty">Who?</span>'}</div>
                        <div style="font-size:0.82em;color:#94a3b8;margin-top:4px">${structure.howStarts || '<span class="pm-empty">How?</span>'}</div>
                    </div>
                    <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:10px">
                        <div style="font-size:0.7em;font-weight:800;color:#f87171;margin-bottom:6px">⏹ END</div>
                        <div style="font-size:0.82em;color:#cbd5e1">${structure.whoCuesEnding ? (Array.isArray(structure.whoCuesEnding) ? structure.whoCuesEnding : [structure.whoCuesEnding]).map(m => (typeof bandMembers !== 'undefined' && bandMembers[m]) ? bandMembers[m].name : m).join(', ') : '<span class="pm-empty">Who?</span>'}</div>
                        <div style="font-size:0.82em;color:#94a3b8;margin-top:4px">${structure.howEnds || '<span class="pm-empty">How?</span>'}</div>
                    </div>
                </div>
                ${structure.form ? `<div style="margin-top:8px;font-size:0.82em;color:#94a3b8"><strong>Form:</strong> ${structure.form}</div>` : ''}
            </div>
        </div>

        <!-- BAND NOTES -->
        <div class="pm-card">
            <div class="pm-card-header">
                <h4 style="color:#a78bfa;margin:0;font-size:0.9em">🎯 Band Notes</h4>
                <button onclick="pmEditField('${safeSong}','bandNotes','Band notes')" class="pm-tool-btn">✏️</button>
            </div>
            <div id="pmBandNotesText" class="pm-card-body">${meaning?.bandNotes || '<span class="pm-empty">How does the band approach this song?</span>'}</div>
        </div>

        <!-- PERFORMANCE TIPS -->
        <div class="pm-card">
            <div class="pm-card-header">
                <h4 style="color:#10b981;margin:0;font-size:0.9em">🎸 Performance Tips</h4>
                <button onclick="pmEditField('${safeSong}','tips','Performance tips')" class="pm-tool-btn">✏️</button>
            </div>
            <div class="pm-card-body">${meaning?.tips || '<span class="pm-empty">Cues, reminders, watch-outs.</span>'}</div>
        </div>
    `;
    pmKnowLoaded[songTitle] = true;
}

// ── Generic field editor (avoids prompt() on iOS) ────────────────────────────
async function pmEditField(songTitle, field, label) {
    const current = await loadBandDataFromDrive(songTitle, 'song_meaning') || {};
    // Build an inline editor
    const container = document.getElementById('pmKnowContent');
    const existingEditor = document.getElementById('pmFieldEditor');
    if (existingEditor) existingEditor.remove();

    const editor = document.createElement('div');
    editor.id = 'pmFieldEditor';
    editor.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px';
    editor.innerHTML = `
        <div style="background:#1e1e2e;border-radius:12px;padding:20px;width:100%;max-width:500px;max-height:80vh;overflow-y:auto">
            <h3 style="color:#e2e8f0;margin:0 0 12px 0;font-size:1em">${label}</h3>
            <textarea id="pmFieldTextarea" rows="8" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;font-size:14px;line-height:1.6;padding:12px;resize:vertical;box-sizing:border-box;font-family:inherit">${current[field] || ''}</textarea>
            <div style="display:flex;gap:8px;margin-top:12px">
                <button onclick="pmSaveField('${songTitle.replace(/'/g, "\\'")}','${field}')" style="flex:1;padding:10px;background:#667eea;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer">💾 Save</button>
                <button onclick="document.getElementById('pmFieldEditor').remove()" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(editor);
    document.getElementById('pmFieldTextarea').focus();
}

async function pmSaveField(songTitle, field) {
    const text = document.getElementById('pmFieldTextarea')?.value?.trim() || '';
    const current = await loadBandDataFromDrive(songTitle, 'song_meaning') || {};
    current[field] = text;
    await saveBandDataToDrive(songTitle, 'song_meaning', current);
    document.getElementById('pmFieldEditor')?.remove();
    pmKnowLoaded[songTitle] = false;
    pmLoadKnowTab(songTitle);
    showToast('✅ Saved!');
}

// ── Genius auto-fetch ────────────────────────────────────────────────────────
async function pmFetchGenius(songTitle) {
    showToast('🔍 Searching Genius...');
    const songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.title === songTitle);
    const artist = songData ? getFullBandName(songData.band) : '';

    try {
        const searchRes = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/genius-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song: songTitle, artist })
        });
        const searchData = await searchRes.json();

        if (!searchData.results?.length) {
            showToast('🤷 No Genius results found');
            return;
        }

        // Fetch the top result
        const top = searchData.results[0];
        const fetchRes = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/genius-fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: top.url })
        });
        const fetchData = await fetchRes.json();

        if (fetchData.description) {
            const current = await loadBandDataFromDrive(songTitle, 'song_meaning') || {};
            current.text = fetchData.description;
            current.geniusUrl = top.url;
            await saveBandDataToDrive(songTitle, 'song_meaning', current);
            pmKnowLoaded[songTitle] = false;
            pmLoadKnowTab(songTitle);
            showToast(`✅ Imported from Genius: ${top.title} by ${top.artist}`);
        } else {
            showToast('⚠️ Found on Genius but no description available');
        }
    } catch(e) {
        showToast('❌ Genius fetch failed: ' + e.message);
    }
}

// ── Bulk import song meanings ────────────────────────────────────────────────
async function pmBulkImportMeanings() {
    if (!confirm('Bulk import song meanings from Genius for all songs without meanings?\n\nThis will take a while (~2 sec/song).')) return;
    const songs = typeof allSongs !== 'undefined' ? allSongs : [];
    let imported = 0, skipped = 0, failed = 0;

    for (const song of songs) {
        // Check if already has meaning
        try {
            const existing = await loadBandDataFromDrive(song.title, 'song_meaning');
            if (existing?.text) { skipped++; continue; }
        } catch(e) {}

        try {
            const artist = getFullBandName(song.band);
            const searchRes = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/genius-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song: song.title, artist })
            });
            const searchData = await searchRes.json();
            if (searchData.results?.length) {
                const fetchRes = await fetch('https://deadcetera-proxy.drewmerrill.workers.dev/genius-fetch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: searchData.results[0].url })
                });
                const fetchData = await fetchRes.json();
                if (fetchData.description) {
                    await saveBandDataToDrive(song.title, 'song_meaning', {
                        text: fetchData.description,
                        geniusUrl: searchData.results[0].url
                    });
                    imported++;
                } else { failed++; }
            } else { failed++; }
        } catch(e) { failed++; }

        // Rate limit
        await new Promise(r => setTimeout(r, 2000));
    }
    showToast(`✅ Done! ${imported} imported, ${skipped} skipped, ${failed} not found`);
}

// ── Structure editing (syncs with main app) ──────────────────────────────────
async function pmEditStructure(songTitle) {
    const structure = await loadBandDataFromDrive(songTitle, 'song_structure') || {};
    const members = typeof bandMembers !== 'undefined' ? Object.entries(bandMembers) : [];

    const editor = document.createElement('div');
    editor.id = 'pmFieldEditor';
    editor.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:20px';
    editor.innerHTML = `
        <div style="background:#1e1e2e;border-radius:12px;padding:20px;width:100%;max-width:500px;max-height:80vh;overflow-y:auto">
            <h3 style="color:#e2e8f0;margin:0 0 16px 0;font-size:1em">🏗️ Edit Song Structure</h3>

            <label style="display:block;font-size:0.82em;color:#94a3b8;margin-bottom:4px;font-weight:600">Who starts?</label>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
                ${members.map(([key, m]) => `
                    <label style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.82em;color:#cbd5e1">
                        <input type="checkbox" class="pmStructWho" value="${key}" ${(structure.whoStarts || []).includes(key) ? 'checked' : ''}> ${m.name}
                    </label>
                `).join('')}
            </div>

            <label style="display:block;font-size:0.82em;color:#94a3b8;margin-bottom:4px;font-weight:600">How does it start?</label>
            <textarea id="pmStructHowStarts" rows="2" class="pm-struct-input">${structure.howStarts || ''}</textarea>

            <label style="display:block;font-size:0.82em;color:#94a3b8;margin-bottom:4px;margin-top:12px;font-weight:600">Who cues the ending?</label>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
                ${members.map(([key, m]) => `
                    <label style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.05);padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.82em;color:#cbd5e1">
                        <input type="checkbox" class="pmStructCues" value="${key}" ${(Array.isArray(structure.whoCuesEnding) ? structure.whoCuesEnding : [structure.whoCuesEnding]).filter(Boolean).includes(key) ? 'checked' : ''}> ${m.name}
                    </label>
                `).join('')}
            </div>

            <label style="display:block;font-size:0.82em;color:#94a3b8;margin-bottom:4px;font-weight:600">How does it end?</label>
            <textarea id="pmStructHowEnds" rows="2" class="pm-struct-input">${structure.howEnds || ''}</textarea>

            <label style="display:block;font-size:0.82em;color:#94a3b8;margin-bottom:4px;margin-top:12px;font-weight:600">Song Form (e.g. AABA, Verse-Chorus-Verse)</label>
            <input id="pmStructForm" type="text" class="pm-struct-input" value="${structure.form || ''}" placeholder="e.g. Intro → Verse → Chorus → Verse → Jam → Chorus → Outro">

            <div style="display:flex;gap:8px;margin-top:16px">
                <button onclick="pmSaveStructure('${songTitle.replace(/'/g, "\\'")}')" style="flex:1;padding:10px;background:#667eea;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer">💾 Save</button>
                <button onclick="document.getElementById('pmFieldEditor').remove()" style="flex:1;padding:10px;background:rgba(255,255,255,0.06);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(editor);
}

async function pmSaveStructure(songTitle) {
    const whoStarts = [...document.querySelectorAll('.pmStructWho:checked')].map(c => c.value);
    const howStarts = document.getElementById('pmStructHowStarts')?.value?.trim() || '';
    const whoCuesEnding = [...document.querySelectorAll('.pmStructCues:checked')].map(c => c.value);
    const howEnds = document.getElementById('pmStructHowEnds')?.value?.trim() || '';
    const form = document.getElementById('pmStructForm')?.value?.trim() || '';

    const structure = { whoStarts, howStarts, whoCuesEnding, howEnds, form };
    await saveBandDataToDrive(songTitle, 'song_structure', structure);
    document.getElementById('pmFieldEditor')?.remove();

    // Refresh both Practice Mode and main app
    pmKnowLoaded[songTitle] = false;
    pmLoadKnowTab(songTitle);
    // Also refresh main page if visible
    if (typeof renderSongStructure === 'function' && typeof selectedSong !== 'undefined') {
        try { renderSongStructure(songTitle); } catch(e) {}
    }
    showToast('✅ Structure saved!');
}

// ── Memory Palace tab ────────────────────────────────────────────────────────
function pmLoadMemoryTab(songTitle) {
    const el = document.getElementById('pmMemoryText');
    if (!pmOriginalChartText) {
        el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:40px">No chart available for memory practice</div>';
        return;
    }
    const displayText = pmTransposeSteps !== 0 ? transposeChartText(pmOriginalChartText, pmTransposeSteps) : pmOriginalChartText;
    el.innerHTML = renderChartSmart(displayText);
    el._originalText = pmOriginalChartText;
    // Apply current memory level
    if (pmMemoryLevel > 0) pmApplyBrainTuner('pmMemoryText');
}

function pmSetMemoryLevel(level, btn) {
    pmMemoryLevel = level;
    document.querySelectorAll('.pm-mem-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    pmApplyBrainTuner('pmMemoryText');
}

function pmMemoryShuffle() {
    pmMemorySeed = Math.floor(Math.random() * 1000) + 1;
    if (pmMemoryLevel > 0) pmApplyBrainTuner('pmMemoryText');
    showToast('🔀 Shuffled!');
}

// ── Harmony tab ──────────────────────────────────────────────────────────────
let pmHarmonyLoaded = {};
async function pmLoadHarmonyTab(songTitle) {
    if (pmHarmonyLoaded[songTitle]) return;
    const container = document.getElementById('pmHarmonyContent');
    const safeSong = songTitle.replace(/'/g, "\\'");

    // Load harmony data
    let parts = null;
    try { parts = await loadBandDataFromDrive(songTitle, 'harmony_parts'); } catch(e) {}
    if (!parts || Object.keys(parts).length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px 20px">
                <div style="font-size:2em;margin-bottom:8px">🎤</div>
                <div style="color:#94a3b8;margin-bottom:16px">No harmony parts imported yet.</div>
                <button onclick="pmStartFadrImport('${safeSong}')" class="pm-tool-btn" style="padding:10px 20px;font-size:0.9em;background:rgba(102,126,234,0.2);color:#818cf8">
                    🤖 Import via Fadr AI
                </button>
                <div style="color:#64748b;font-size:0.78em;margin-top:12px;line-height:1.5">
                    <strong>How Fadr import works:</strong><br>
                    1. Find the song on Archive.org (live recordings)<br>
                    2. Paste the Archive.org MP3 link<br>
                    3. Fadr AI separates vocal stems automatically<br>
                    4. MIDI is extracted and converted to ABC notation<br>
                    5. Parts appear here for practice!
                </div>
            </div>
        `;
        pmHarmonyLoaded[songTitle] = true;
        return;
    }

    // Render each harmony part with ABC notation
    const colors = { 'Soprano': '#ef4444', 'Alto': '#f59e0b', 'Tenor': '#10b981', 'Bass': '#3b82f6', 'Melody': '#a78bfa' };
    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="color:#e2e8f0;font-weight:600;font-size:0.95em">🎤 Harmony Parts</span>
        <button onclick="pmStartFadrImport('${safeSong}')" class="pm-tool-btn">🤖 Re-import</button>
    </div>`;
    for (const [partName, partData] of Object.entries(parts)) {
        const color = colors[partName] || '#94a3b8';
        html += `
            <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:12px;margin-bottom:12px;border-left:3px solid ${color}">
                <h4 style="color:${color};margin:0 0 8px 0;font-size:0.9em">${partName}</h4>
                <div id="pmHarmonyABC_${partName.replace(/\s/g, '_')}" style="background:white;border-radius:6px;padding:8px;margin-bottom:8px"></div>
                <div id="pmHarmonyAudio_${partName.replace(/\s/g, '_')}"></div>
            </div>
        `;
    }
    container.innerHTML = html;

    // Render ABC
    const renderParts = () => {
        for (const [partName, partData] of Object.entries(parts)) {
            const abc = typeof partData === 'string' ? partData : partData.abc;
            const containerId = `pmHarmonyABC_${partName.replace(/\s/g, '_')}`;
            if (abc && document.getElementById(containerId)) {
                try { ABCJS.renderAbc(containerId, abc, { responsive: 'resize', staffwidth: 300 }); } catch(e) {}
            }
        }
    };
    if (typeof ABCJS !== 'undefined') { renderParts(); }
    else { loadABCJS(renderParts); }

    pmHarmonyLoaded[songTitle] = true;
}

// Bridge to existing Fadr import
function pmStartFadrImport(songTitle) {
    // Close practice mode temporarily and open the Fadr import modal
    closePracticeMode();
    setTimeout(() => {
        if (typeof importHarmoniesFromFadr === 'function') {
            importHarmoniesFromFadr(songTitle);
        } else {
            showToast('⚠️ Fadr import not available — use the Harmonies section on the song page');
        }
    }, 300);
}

// ── Record & Review tab ──────────────────────────────────────────────────────
function pmLoadRecordTab(songTitle) {
    const list = document.getElementById('pmRecordingsList');
    if (!list) return;
    if (pmRecordings.length === 0) {
        list.innerHTML = '<div style="color:#64748b;font-size:0.85em;padding:8px">No saved recordings yet. Hit ⏺ Record to practice!</div>';
        return;
    }
    list.innerHTML = pmRecordings.map((rec, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px">
            <button onclick="pmPlaySavedRecording(${i})" class="pm-tool-btn" style="padding:4px 8px">▶</button>
            <div style="flex:1">
                <div style="color:#e2e8f0;font-size:0.85em">${rec.label || 'Recording ' + (i + 1)}</div>
                <div style="color:#64748b;font-size:0.75em">${rec.date ? new Date(rec.date).toLocaleDateString() : ''} · ${rec.duration ? Math.round(rec.duration) + 's' : ''}</div>
            </div>
            <button onclick="pmDeleteRecording(${i})" class="pm-tool-btn" style="padding:4px 8px;color:#ef4444">✕</button>
        </div>
    `).join('');
}

let pmLastRecordingBlob = null;
let pmRecordStartTime = 0;

async function pmToggleRecord() {
    if (pmRecorder && pmRecorder.state === 'recording') {
        pmStopRecord();
    } else {
        pmStartRecord();
    }
}

async function pmStartRecord() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        pmRecordedChunks = [];
        pmRecorder = new MediaRecorder(stream);
        pmRecorder.ondataavailable = e => { if (e.data.size > 0) pmRecordedChunks.push(e.data); };
        pmRecorder.onstop = () => {
            pmLastRecordingBlob = new Blob(pmRecordedChunks, { type: 'audio/webm' });
            const duration = (Date.now() - pmRecordStartTime) / 1000;
            document.getElementById('pmRecordingStatus').textContent = `✅ Recorded ${Math.round(duration)}s — play back or save`;
            document.getElementById('pmPlayLastBtn').disabled = false;
            document.getElementById('pmSaveRecBtn').disabled = false;
            stream.getTracks().forEach(t => t.stop());
        };
        pmRecorder.start();
        pmRecordStartTime = Date.now();
        const btn = document.getElementById('pmRecordBtn');
        if (btn) { btn.textContent = '⏹ Stop'; btn.style.background = 'rgba(239,68,68,0.3)'; }
        document.getElementById('pmRecordingStatus').textContent = '🔴 Recording...';
        document.getElementById('pmRecordingWaveform').style.display = 'block';
    } catch(e) {
        showToast('⚠️ Microphone access denied');
    }
}

function pmStopRecord() {
    if (pmRecorder && pmRecorder.state === 'recording') {
        pmRecorder.stop();
    }
    const btn = document.getElementById('pmRecordBtn');
    if (btn) { btn.textContent = '⏺ Record'; btn.style.background = ''; }
    const wf = document.getElementById('pmRecordingWaveform');
    if (wf) wf.style.display = 'none';
}

function pmPlayLastRecording() {
    if (!pmLastRecordingBlob) return;
    const url = URL.createObjectURL(pmLastRecordingBlob);
    const audio = new Audio(url);
    audio.play();
    document.getElementById('pmRecordingStatus').textContent = '▶ Playing...';
    audio.onended = () => {
        document.getElementById('pmRecordingStatus').textContent = '✅ Playback complete';
        URL.revokeObjectURL(url);
    };
}

async function pmSaveRecording() {
    if (!pmLastRecordingBlob) return;
    const song = pmQueue[pmIndex];
    if (!song) return;
    const label = prompt('Label this recording (optional):', '') || `Recording ${pmRecordings.length + 1}`;
    // Convert blob to base64 for storage
    const reader = new FileReader();
    reader.onload = async () => {
        const rec = {
            label,
            date: new Date().toISOString(),
            duration: (Date.now() - pmRecordStartTime) / 1000,
            audioData: reader.result,
            member: (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'unknown'
        };
        pmRecordings.push(rec);
        await saveBandDataToDrive(song.title, 'practice_recordings', pmRecordings);
        pmLoadRecordTab(song.title);
        showToast('💾 Recording saved!');
        document.getElementById('pmSaveRecBtn').disabled = true;
    };
    reader.readAsDataURL(pmLastRecordingBlob);
}

function pmPlaySavedRecording(index) {
    const rec = pmRecordings[index];
    if (!rec?.audioData) return;
    const audio = new Audio(rec.audioData);
    audio.play();
    showToast('▶ Playing...');
}

async function pmDeleteRecording(index) {
    if (!confirm('Delete this recording?')) return;
    const song = pmQueue[pmIndex];
    pmRecordings.splice(index, 1);
    await saveBandDataToDrive(song.title, 'practice_recordings', pmRecordings);
    pmLoadRecordTab(song.title);
    showToast('🗑 Deleted');
}

console.log('🎸 Practice Mode loaded');
