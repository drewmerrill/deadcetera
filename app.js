// ============================================================================
// DEADCETERA WORKFLOW APP v5.5.0 - Firebase · Playlists · Mobile-Ready
// DEV BRANCH — safe to experiment here
// Last updated: 2026-02-26
// ============================================================================

console.log('%c🔗 GrooveLinx BUILD: 20260307-063705', 'color:#667eea;font-weight:bold;font-size:14px');

// ── Version baseline for update banner ───────────────────────────────────────
var BUILD_VERSION = '20260307-063705';
var _loadedVersion = BUILD_VERSION;



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
        /* ===== SONG LIST ===== */
        .song-item {
            display: grid !important;
            grid-template-columns: 1fr 28px 50px 68px 44px !important;
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
            overflow: hidden;
        }
        .song-item:hover { background:#263248 !important; border-color:rgba(102,126,234,0.25) !important; }
        .song-item.selected { background:#2d3a5c !important; border-color:#667eea !important; }
        .song-item.selected * { color:inherit !important; }
        .song-item.selected .song-name { color:#c7d2fe !important; }
        .song-item.selected .song-badge { opacity:1 !important; }
        .song-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#f1f5f9 !important; font-weight:500; font-size:0.9em; line-height:1.3; }
        .song-status-cell { width:68px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        /* Col 2: Icon badges — row layout so single badge stays vertically centered */
        .song-badges { display:flex; flex-direction:row; align-items:center; justify-content:center; gap:2px; width:28px; overflow:hidden; }
        .harmony-slot, .northstar-slot { display:flex; align-items:center; justify-content:center; width:13px; flex-shrink:0; }
        .harmony-badge { font-size:9px; line-height:1; display:flex; align-items:center; justify-content:center; background:rgba(129,140,248,0.2); padding:1px 2px; border-radius:4px; border:1px solid rgba(129,140,248,0.3); width:16px; height:14px; overflow:hidden; flex-shrink:0; }
        .northstar-badge { font-size:0.78em; line-height:1; cursor:default; }
        /* Col 3: Chain strip */
        .song-chain-strip { display:flex; align-items:center; justify-content:center; gap:1px; width:50px; height:12px; overflow:hidden; flex-shrink:0; }
        /* Col 4: Status badge */
        .status-badge { white-space:nowrap; font-size:0.52em; padding:2px 3px; border-radius:10px; font-weight:700; letter-spacing:0.01em; display:inline-flex; align-items:center; justify-content:center; width:100%; max-width:68px; text-align:center; box-sizing:border-box; overflow:hidden; }
        /* Col 5: Band badge */
        .song-badge { font-size:0.58em; padding:3px 0; border-radius:20px; font-weight:700; text-align:center; width:44px; letter-spacing:0.03em; text-transform:uppercase; display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; flex-shrink:0; }
        .song-badge.gd    { background:rgba(239,68,68,0.15);  color:#f87171; border:1px solid rgba(239,68,68,0.25); }
        .song-badge.jgb   { background:rgba(59,130,246,0.15); color:#60a5fa; border:1px solid rgba(59,130,246,0.25); }
        .song-badge.wsp   { background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.25); }
        .song-badge.phish { background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.25); }
        .song-badge.abb   { background:rgba(236,72,153,0.15); color:#f472b6; border:1px solid rgba(236,72,153,0.25); }
        .song-badge.goose { background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid rgba(168,85,247,0.25); }
        .song-badge.dmb   { background:rgba(20,184,166,0.15); color:#2dd4bf; border:1px solid rgba(20,184,166,0.25); }
        /* Mobile: hide chain strip */
        @media (max-width:479px) {
            .song-item { grid-template-columns:1fr 28px 68px 44px !important; }
            .song-chain-strip { display:none !important; }
        }
        /* Connected button pulse */
        @keyframes connPulse {
            0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,0.5); transform:scale(1); }
            50%      { box-shadow:0 0 0 4px rgba(16,185,129,0); transform:scale(1.06); }
        }
        .conn-logo-pulse { animation:connPulse 2.4s ease-in-out infinite; border-radius:6px; }

        /* ===== TOPBAR LOGO =====
           logo.png has been re-centered so no offset hacks needed. */
        .topbar-brand {
            background: none !important;
            -webkit-background-clip: unset !important;
            -webkit-text-fill-color: unset !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            line-height: 1 !important;
        }
        .topbar-brand img {
            width: 24px !important;
            height: 24px !important;
            flex-shrink: 0 !important;
            display: block !important;
        }
        .topbar-brand-text {
            background: linear-gradient(135deg, #60a5fa, #f59e0b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            line-height: 1 !important;
            display: inline-block !important;
        }
        /* Connected button */
        .topbar-btn.connected {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 6px !important;
            line-height: 1 !important;
        }
        .topbar-btn.connected img {
            width: 20px !important;
            height: 20px !important;
            flex-shrink: 0 !important;
            display: block !important;
        }

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

console.log('🔗 GrooveLinx v5.4 — Firebase · Playlists · Harmonies · Stage-ready!');

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
// SECTION HELP TOOLTIPS (ⓘ icons on song detail section headers)
// Usage in HTML: <span class="gl-help-icon" onclick="glShowHelp('dna',this)">ⓘ</span>
// ============================================================================

const GL_SECTION_HELP = {
    dna:        { title: '🧬 Song DNA', text: 'Everything your band needs at a glance — chord charts, keys, BPM, harmonies, structure, and reference versions. This is the source of truth for the song.' },
    northstar:  { title: '⭐ North Star', text: 'The definitive reference version the band is working toward. Vote for your favorite recording — the most-voted version becomes the North Star.' },
    crib:       { title: '📝 Stage Crib Notes', text: 'Personal performance reminders visible only to you during a gig or rehearsal. Add notes for your instrument, intros, solos, or anything you want to remember on stage.' },
    woodshed:   { title: '🪵 The Woodshed', text: 'Your personal practice checklist for this song. Track what you\'ve worked on solo, in rehearsal, and gig-ready. Bandmates can see each other\'s progress.' },
    pocket:     { title: '🎯 The Pocket', text: 'Live BPM monitor using your microphone. Shows whether the band is rushing, dragging, or locked in. Tap tempo to broadcast the target BPM to all members.' },
    bestshot:   { title: '🏆 Best Shot', text: 'Record and compare takes against the North Star version. Rate sections, track improvement over time, and identify what needs more woodshedding.' },
    listen:     { title: '🎧 Listen & Find Versions', text: 'Search Archive.org, Relisten, Phish.in, YouTube, and Spotify for live versions of this song. Send any version directly to the band.' },
    rehearsal:  { title: '📋 Rehearsal Notes', text: 'Shared notes from rehearsals — what worked, what needs work, and action items for next time.' },
    readiness:  { title: '📊 Readiness', text: 'How ready is this song? Each member rates their own readiness. The heatmap shows the band\'s collective preparation level.' },
};

function glShowHelp(key, el) {
    document.getElementById('glHelpPopup')?.remove();
    const info = GL_SECTION_HELP[key];
    if (!info) return;
    const d = document.createElement('div');
    d.id = 'glHelpPopup';
    d.style.cssText = 'position:absolute;z-index:9999;max-width:280px;width:280px;background:#1e2235;border:1px solid rgba(99,102,241,0.35);border-radius:10px;padding:12px 14px;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-size:0.82em;line-height:1.5;color:#e2e8f0';
    d.innerHTML = `<div style="font-weight:700;color:#818cf8;margin-bottom:6px">${info.title}</div><div style="color:#94a3b8">${info.text}</div><div style="margin-top:8px;font-size:0.85em;opacity:0.4;text-align:right">tap anywhere to dismiss</div>`;
    // Use absolute positioning relative to document, accounting for scroll
    const rect = el ? el.getBoundingClientRect() : null;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    let top = rect ? rect.bottom + scrollY + 8 : scrollY + 100;
    let left = rect ? rect.left + scrollX - 120 : scrollX + 20;
    left = Math.max(8, Math.min(left, (window.innerWidth || 360) - 296));
    d.style.top = top + 'px';
    d.style.left = left + 'px';
    document.body.appendChild(d);
    setTimeout(() => document.addEventListener('click', function f(e) {
        if (!d.contains(e.target)) { d.remove(); document.removeEventListener('click', f); }
    }), 100);
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

                // ── Poll for updates every 60s (iOS PWAs need this) ──────────
                setInterval(() => reg.update(), 60 * 1000);

                // ── When a new SW is waiting, show the update banner ────────
                // NEVER auto-reload — user clicks the banner when ready
                function promptUpdate() {
                    console.log('[PWA] New version detected — showing banner');
                    showUpdateBanner();
                }

                // If a SW is already waiting when we register
                if (reg.waiting) promptUpdate();

                // When a new SW finishes installing and enters waiting state
                reg.addEventListener('updatefound', () => {
                    const newSW = reg.installing;
                    if (!newSW) return;
                    newSW.addEventListener('statechange', () => {
                        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                            // New SW is installed but waiting — show banner
                            promptUpdate();
                        }
                    });
                });

                // ── postMessage handler ────────────────────────────────────
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data?.type === 'SW_UPDATED') {
                        console.log('[PWA] SW_UPDATED message — showing banner');
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
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = 'position:fixed;bottom:70px;left:12px;right:12px;background:linear-gradient(135deg,#1e2a4a,#252d4a);border:1px solid rgba(99,102,241,0.5);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;z-index:8000;box-shadow:0 8px 32px rgba(0,0,0,0.5)';
    banner.innerHTML = '<div style="flex:1"><div style="font-weight:700;color:white;font-size:0.92em">📱 Install GrooveLinx</div><div style="font-size:0.78em;color:rgba(255,255,255,0.7);margin-top:2px">Add to home screen for quick access</div></div>';
    var installBtn = document.createElement('button');
    installBtn.textContent = 'Install';
    installBtn.style.cssText = 'background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:0.85em';
    installBtn.addEventListener('click', function() {
        if (pwaInstallPrompt) {
            pwaInstallPrompt.prompt();
            pwaInstallPrompt.userChoice.then(function(result) {
                if (result.outcome === 'accepted') console.log('[PWA] App installed');
                pwaInstallPrompt = null;
                hidePWAInstallBanner();
            });
        }
    });
    banner.appendChild(installBtn);
    var dismissBtn = document.createElement('button');
    dismissBtn.textContent = '✕';
    dismissBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:1.2em;padding:0 4px';
    dismissBtn.addEventListener('click', function() { hidePWAInstallBanner(); });
    banner.appendChild(dismissBtn);
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
    // Parachute: render gig pack if URL has ?gigpack=1#...
    if (parachuteCheckUrlHash()) return;
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
        preloadReadinessCache().then(function() { addReadinessChains(); });
        
        // Auto-re-authenticate if user was previously signed in
        if (localStorage.getItem('deadcetera_google_email')) {
            console.log('🔑 Auto-reconnecting (was signed in)...');
            handleGoogleDriveAuth(true);
        }
        
        // Check for ?join= invite link
        checkInviteLink();
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

function songQuickFill(title, e) {
    e && e.stopPropagation();
    var existing = document.getElementById('quickFillPopup');
    if (existing) existing.remove();
    var songData = allSongs.find(function(s){return s.title===title;}) || {};
    var popup = document.createElement('div');
    popup.id = 'quickFillPopup';
    popup.style.cssText = 'position:fixed;bottom:70px;left:12px;right:12px;background:#1e293b;border:1px solid rgba(102,126,234,0.3);border-radius:14px;padding:14px;z-index:4000;box-shadow:0 8px 32px rgba(0,0,0,0.6)';
    var st = title.replace(/'/g, "\\'");
    popup.innerHTML = '<div style="font-size:0.8em;font-weight:700;color:#818cf8;margin-bottom:10px">🎵 Quick Fill: ' + title + '</div>';
    popup.innerHTML += '<div style="display:flex;gap:8px;margin-bottom:10px"><div style="flex:1"><label style="font-size:0.72em;color:#64748b;display:block;margin-bottom:3px">Key</label><input id="qfKey" class="app-input" placeholder="e.g. G" value="' + (songData.key||'')+'" style="font-size:0.88em;padding:6px 10px"></div><div style="flex:1"><label style="font-size:0.72em;color:#64748b;display:block;margin-bottom:3px">BPM</label><input id="qfBpm" class="app-input" placeholder="e.g. 120" value="' + (songData.bpm||'')+'" type="number" style="font-size:0.88em;padding:6px 10px"></div></div>';
    popup.innerHTML += '<div style="display:flex;gap:8px"><button onclick="songQuickFillSave()´+JSON.stringify(title)+´)" style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.4);color:#a5b4fc;padding:7px 16px;border-radius:8px;font-size:0.85em;font-weight:700;cursor:pointer;flex:1">💾 Save</button><button onclick="qfCancel()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:7px 14px;border-radius:8px;font-size:0.85em;cursor:pointer">Cancel</button></div>';
    // fix the onclick with proper title injection
    popup.querySelector('button').onclick = function() { songQuickFillSave(title); };
    document.body.appendChild(popup);
    setTimeout(function(){document.getElementById('qfKey')?.focus();},80);
    setTimeout(function(){
        document.addEventListener('click', function h(ev) {
            if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('click',h); }
        });
    },150);
}

function qfCancel() { document.getElementById('quickFillPopup')?.remove(); }

async function songQuickFillSave(title) {
    var key = (document.getElementById('qfKey')?.value||''). trim();
    var bpm = (document.getElementById('qfBpm')?.value||''). trim();
    if (!key && !bpm) { showToast('Enter key or BPM'); return; }
    var songIdx = allSongs.findIndex(function(s){return s.title===title;});
    if (songIdx >= 0) {
        if (key) allSongs[songIdx].key = key;
        if (bpm) allSongs[songIdx].bpm = parseInt(bpm);
    }
    try {
        var path = bandPath('assets/' + sanitizeFirebasePath(title));
        var update = {};
        if (key) update.key = key;
        if (bpm) update.bpm = parseInt(bpm);
        await firebaseDB.ref(path).update(update);
        showToast('🎵 Saved!');
    } catch(e) { showToast('Saved locally'); }
    document.getElementById('quickFillPopup')?.remove();
    renderSongs();
}

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
            <span class="song-badges"><span class="harmony-slot"></span><span class="northstar-slot"></span></span>
            <span class="song-chain-strip" data-song="${song.title.replace(/"/g, '&quot;')}"></span>
            <span class="song-status-cell"></span>
            <span class="song-badge ${(song.band||'other').toLowerCase()}">${song.band}</span>
        </div>
    `).join('');
    
    // Add badges after rendering (no setTimeout race condition)
    requestAnimationFrame(() => {
        addHarmonyBadges();
        addNorthStarBadges();
        // Quick-fill pencil for songs missing key/bpm
        filtered.forEach(function(song) {
            if (!song.key && !song.bpm) {
                var item = document.querySelector('.song-item[data-title="' + song.title.replace(/"/g,'&quot;') + '"] .northstar-slot');
                if (item && !item.nextSibling?.classList?.contains('qf-btn')) {
                    var btn = document.createElement('span');
                    btn.className = 'qf-btn';
                    btn.title = 'Quick-fill key/BPM';
                    btn.textContent = '✏️';
                    btn.style.cssText = 'font-size:0.7em;opacity:0.4;cursor:pointer;padding:1px 4px;border-radius:3px;border:1px solid rgba(255,255,255,0.08);transition:opacity 0.15s';
                    btn.onmouseenter = function(){this.style.opacity='1';};
                    btn.onmouseleave = function(){this.style.opacity='0.4';};
                    var t = song.title;
                    btn.onclick = function(e){e.stopPropagation();songQuickFill(t,e);};
                    item.after(btn);
                }
            }
        });
        preloadAllStatuses();
        if (statusCacheLoaded) addStatusBadges();
        if (readinessCacheLoaded) addReadinessChains();
        if (_heatmapMode) renderHeatmapOverlay();
        if (window._sectionRatingsCache) addSectionStatusDots();
        else preloadSectionRatingsCache();
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
    // Inject heatmap toggle button
    if (!document.getElementById('heatmapToggleBtn')) {
        const btn = document.createElement('button');
        btn.id = 'heatmapToggleBtn';
        btn.title = 'Show readiness heatmap';
        btn.textContent = '🌡️ Heatmap';
        btn.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:4px 9px;border-radius:20px;cursor:pointer;font-size:0.72em;font-weight:700;white-space:nowrap;transition:all 0.15s;flex-shrink:0;margin-left:4px';
        btn.onclick = function() { if(typeof toggleHeatmapMode==='function') toggleHeatmapMode(); };
        const harmoniesEl = document.getElementById('harmoniesOnlyFilter');
        const target = harmoniesEl ? (harmoniesEl.closest('label')?.parentElement || harmoniesEl.parentElement) : null;
        if (target && target.parentElement) target.parentElement.appendChild(btn);
        else if (searchInput?.parentElement?.parentElement) searchInput.parentElement.parentElement.appendChild(btn);
    }
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
    const stepVersionHub = document.getElementById('stepVersionHub');
    const step3ref = document.getElementById('step3ref');
    const step3bestshot = document.getElementById('step3bestshot');
    const step4ref = document.getElementById('step4ref');
    const step5ref = document.getElementById('step5ref');
    if (stepVersionHub) stepVersionHub.classList.remove('hidden');
    if (step3ref) step3ref.classList.remove('hidden');
    if (step3bestshot) step3bestshot.classList.remove('hidden');
    if (step4ref) step4ref.classList.remove('hidden');
    const step4cover = document.getElementById('step4cover');
    if (step4cover) step4cover.classList.remove('hidden');
    if (step5ref) step5ref.classList.remove('hidden');
    renderBestShotVsNorthStar(songTitle);
    
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
    var vhStep = document.getElementById('stepVersionHub');
    if (vhStep) vhStep.classList.add('hidden');
    
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
    const subtitleEl = document.getElementById('bandResourcesSubtitle');
    if (subtitleEl) subtitleEl.textContent = `Everything your band needs at a glance`;
    
    // Get band data from data.js if available
    const bandData = bandKnowledgeBase[songTitle] || {};
    
    // Render each section IN PARALLEL for fast loading
    Promise.all([
        renderChartSection(songTitle),
        renderRefVersions(songTitle, bandData),
        renderPersonalTabs(songTitle),
        renderMoisesStems(songTitle, bandData),
        renderPracticeTracks(songTitle, bandData),
        renderHarmoniesEnhanced(songTitle, bandData),
        renderRehearsalNotesWithStorage(songTitle),
        renderSongStructure(songTitle),
        renderGigNotes(songTitle, bandData),
        renderCoverMe(songTitle),
        renderSongInPlaylists(songTitle),
        populateSongMetadata(songTitle),
        renderReadinessSection(songTitle),
        renderWoodshedChecklist(songTitle),
        renderMomentsSection(songTitle)
    ]).catch(error => {
        console.error('Error rendering sections:', error);
    });
}


// ============================================================================
// CHORD CHART — renders in Woodshed with Practice Mode launcher
// ============================================================================
async function renderChartSection(songTitle) {
    const container = document.getElementById('chartContainer');
    if (!container) return;
    const safeSong = songTitle.replace(/'/g, "\\'");
    let chartText = null;
    try { const cd = await loadBandDataFromDrive(songTitle, 'chart'); if (cd && cd.text && cd.text.trim()) chartText = cd.text; } catch(e) {}
    
    const hasChart = chartText && chartText.trim();
    const preview = hasChart ? chartText.split('\n').slice(0, 4).join('\n') : '';
    const safePreview = hasChart ? preview.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
    
    container.innerHTML = `
        <div onclick="openRehearsalMode('${safeSong}')" style="cursor:pointer;border-radius:10px;overflow:hidden;background:rgba(102,126,234,0.06);border:1px solid rgba(102,126,234,0.15);transition:all 0.2s" onmouseover="this.style.borderColor='rgba(102,126,234,0.4)';this.style.background='rgba(102,126,234,0.1)'" onmouseout="this.style.borderColor='rgba(102,126,234,0.15)';this.style.background='rgba(102,126,234,0.06)'">
            ${hasChart ? `<pre style="font-family:monospace;font-size:12px;color:#64748b;line-height:1.4;white-space:pre-wrap;margin:0;padding:12px 14px 0;max-height:72px;overflow:hidden">${safePreview}</pre>` : ''}
            <div style="padding:${hasChart ? '8' : '14'}px 14px 12px;display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;font-size:0.9em">🧠 Practice Mode</span>
                    <span style="color:#64748b;font-size:0.75em">${hasChart ? 'Chart · Transpose · Brain Trainer' : 'Search charts · Paste · UG'}</span>
                </div>
                <span style="color:var(--accent-light,#818cf8);font-size:0.85em">→</span>
            </div>
        </div>`;
}

// ============================================================================
// PERSONAL TAB LINKS
// ============================================================================

async function renderPersonalTabs(songTitle) {
    var container = document.getElementById('personalTabsContainer');
    if (!container) return;
    var tabs = await loadPersonalTabs(songTitle);

    var emailToKey = {
        'drewmerrill1029@gmail.com': 'drew',
        'cmjalbert@gmail.com': 'chris',
        'brian@hrestoration.com': 'brian',
        'pierce.d.hale@gmail.com': 'pierce',
        'jnault@fegholdings.com': 'jay'
    };

    var tabsByMember = {};
    (tabs || []).forEach(function(tab, index) {
        var key = tab.memberKey || emailToKey[tab.addedBy] || tab.addedBy || 'unknown';
        if (!tabsByMember[key]) tabsByMember[key] = [];
        tabsByMember[key].push(Object.assign({}, tab, { _index: index }));
    });

    var currentMemberKey = getCurrentMemberKey();
    var emoji = { drew: '🎸', chris: '🎸', brian: '🎸', pierce: '🎹', jay: '🥁' };
    var safeSong = songTitle.replace(/'/g, "\\'");

    // Split members into those with refs and those without
    var withRefs = [];
    var withoutRefs = [];
    Object.entries(bandMembers).forEach(function(entry) {
        var key = entry[0], member = entry[1];
        if ((tabsByMember[key] || []).length > 0) withRefs.push([key, member]);
        else withoutRefs.push([key, member]);
    });

    var html = '';

    // Members WITH refs: compact cards
    withRefs.forEach(function(entry) {
        var key = entry[0], member = entry[1];
        var memberTabs = tabsByMember[key] || [];
        var isMe = (key === currentMemberKey);
        var em = emoji[key] || '👤';

        html += '<div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:' + (memberTabs.length ? '6' : '0') + 'px">';
        html += '<span style="font-size:0.9em">' + em + '</span>';
        html += '<strong style="color:var(--accent-light);font-size:0.82em">' + member.name + '</strong>';
        html += '<span style="color:var(--text-dim);font-size:0.68em">' + member.role + '</span>';
        html += '<span style="margin-left:auto;background:rgba(16,185,129,0.15);color:var(--green);font-size:0.65em;padding:1px 6px;border-radius:8px;font-weight:600">' + memberTabs.length + '</span>';
        html += '</div>';

        memberTabs.forEach(function(tab) {
            html += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;margin-left:22px">';
            html += '<a href="' + tab.url + '" target="_blank" style="flex:1;color:var(--accent-light);font-size:0.78em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (tab.label || tab.notes || tab.url) + '</a>';
            if (tab.notes && tab.label) html += '<span style="color:var(--text-dim);font-size:0.65em">' + tab.notes + '</span>';
            if (currentMemberKey) html += '<button onclick="deletePersonalTab(\'' + safeSong + '\',' + tab._index + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.7em;padding:0" title="Delete">\u2715</button>';
            html += '</div>';
        });

        // Add-ref form: show for current user on any member card
        if (currentMemberKey) {
            html += '<div id="addTabInline_' + key + '" style="display:none;margin-top:6px">';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
            html += '<input type="text" id="tabUrl_' + key + '" placeholder="URL" class="app-input" style="font-size:0.78em">';
            html += '<input type="text" id="tabLabel_' + key + '" placeholder="Label" class="app-input" style="font-size:0.78em">';
            html += '</div>';
            html += '<input type="text" id="tabNotes_' + key + '" placeholder="Notes (optional)" class="app-input" style="font-size:0.78em;margin-top:4px">';
            html += '<div style="display:flex;gap:4px;margin-top:6px">';
            html += '<button onclick="addPersonalTabForMember(\'' + safeSong + '\',\'' + key + '\')" class="btn btn-primary btn-sm" style="font-size:0.75em">➕ Add</button>';
            html += '<button onclick="document.getElementById(\'addTabInline_' + key + '\').style.display=\'none\';document.getElementById(\'addTabBtn_' + key + '\').style.display=\'block\'" class="btn btn-ghost btn-sm" style="font-size:0.75em">Cancel</button>';
            html += '</div></div>';
            html += '<button id="addTabBtn_' + key + '" onclick="document.getElementById(\'addTabInline_' + key + '\').style.display=\'block\';this.style.display=\'none\'" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-size:0.72em;padding:2px 0;margin-top:4px;margin-left:22px">+ Add ref</button>';
        }
        html += '</div>';
    });

    // Members WITHOUT refs: clickable pills with add-ref popover
    if (withoutRefs.length > 0) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;' + (withRefs.length ? 'margin-top:4px' : '') + '">';
        withoutRefs.forEach(function(entry) {
            var key = entry[0], member = entry[1];
            var em = emoji[key] || '\u{1F464}';
            if (currentMemberKey) {
                // Clickable pill with popover add-ref form
                html += '<div id="cribPill_' + key + '" style="position:relative;background:rgba(255,255,255,0.02);border:1px dashed var(--border);border-radius:8px;padding:5px 10px;display:flex;align-items:center;gap:4px;flex:1;min-width:140px;cursor:pointer" onclick="toggleCribPillForm(\'' + key + '\')">';
                html += '<span style="font-size:0.8em">' + em + '</span>';
                html += '<span style="font-size:0.72em;color:var(--text-dim)">' + member.name.split(' ')[0] + '</span>';
                html += '<span style="margin-left:auto;color:var(--accent-light);font-size:0.65em">+ add</span>';
                html += '<div id="addTabInline_' + key + '" style="display:none;position:absolute;top:100%;left:0;z-index:10;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px;width:280px;box-shadow:0 4px 12px rgba(0,0,0,0.3);margin-top:4px" onclick="event.stopPropagation()">';
                html += '<div style="font-size:0.75em;color:var(--accent-light);font-weight:600;margin-bottom:6px">' + em + ' Add ref for ' + member.name.split(' ')[0] + '</div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
                html += '<input type="text" id="tabUrl_' + key + '" placeholder="URL" class="app-input" style="font-size:0.78em" onclick="event.stopPropagation()">';
                html += '<input type="text" id="tabLabel_' + key + '" placeholder="Label" class="app-input" style="font-size:0.78em" onclick="event.stopPropagation()">';
                html += '</div>';
                html += '<input type="text" id="tabNotes_' + key + '" placeholder="Notes (optional)" class="app-input" style="font-size:0.78em;margin-top:4px" onclick="event.stopPropagation()">';
                html += '<div style="display:flex;gap:4px;margin-top:6px">';
                html += '<button onclick="event.stopPropagation();addPersonalTabForMember(\'' + safeSong + '\',\'' + key + '\')" class="btn btn-primary btn-sm" style="font-size:0.75em">\u{2795} Add</button>';
                html += '<button onclick="event.stopPropagation();document.getElementById(\'addTabInline_' + key + '\').style.display=\'none\'" class="btn btn-ghost btn-sm" style="font-size:0.75em">Cancel</button>';
                html += '</div></div>';
                html += '</div>';
            } else {
                // Not signed in: static pill
                html += '<div style="background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.04);border-radius:8px;padding:4px 8px;display:flex;align-items:center;gap:4px">';
                html += '<span style="font-size:0.75em">' + em + '</span>';
                html += '<span style="font-size:0.68em;color:var(--text-dim)">' + member.name.split(' ')[0] + '</span>';
                html += '</div>';
            }
        });
        html += '</div>';
    }

    container.innerHTML = html || '<div style="padding:12px;color:var(--text-dim);font-size:0.82em">No members found</div>';
}
function toggleCribPillForm(memberKey) {
    var form = document.getElementById('addTabInline_' + memberKey);
    if (!form) return;
    // Close all other open pill forms first
    document.querySelectorAll('[id^="addTabInline_"]').forEach(function(el) {
        if (el.id !== 'addTabInline_' + memberKey) el.style.display = 'none';
    });
    form.style.display = (form.style.display === 'none' || !form.style.display) ? 'block' : 'none';
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
    var container = document.getElementById('gigNotesContainer');
    if (!container) return;
    var notes = toArray(await loadGigNotes(songTitle) || []);
    if (notes.length === 0 && bandData.gigNotes) notes = toArray(bandData.gigNotes);
    if (notes.length === 0 && bandData.performanceTips) notes = toArray(bandData.performanceTips);
    
    if (notes.length === 0) {
        container.innerHTML = '<button onclick="addGigNote()" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-size:0.78em;padding:4px 0">+ Add stage note</button>';
        return;
    }
    
    var html = '<div style="padding:2px 0">';
    for (var i = 0; i < notes.length; i++) {
        html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03)">';
        html += '<span style="color:var(--accent-light);font-size:0.7em;margin-top:2px">▸</span>';
        html += '<span id="gigNoteText_' + i + '" style="flex:1;font-size:0.82em;color:var(--text);line-height:1.3">' + notes[i] + '</span>';
        html += '<button onclick="editGigNote(' + i + ')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.7em;padding:0 2px;opacity:0.5" title="Edit">✏️</button>';
        html += '<button onclick="deleteGigNote(' + i + ',this)" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.65em;padding:0 2px;opacity:0.5" title="Delete">✕</button>';
        html += '</div>';
    }
    html += '<button onclick="addGigNote()" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-size:0.75em;padding:4px 0;margin-top:2px">+ Add</button>';
    html += '</div>';
    container.innerHTML = html;
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
        const storageRef = firebaseStorage.ref(bandPath(`practice_tracks/${safeSong}/${Date.now()}_${safeName}`));
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
        const storageRef = firebaseStorage.ref(bandPath(`ref_audio/${safeSong}/${Date.now()}_${safeName}`));
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
// ── Version Hub launchers ────────────────────────────────────────────────────
function launchVersionHub(opts) {
    var songTitle = selectedSong?.title || selectedSong;
    if (!songTitle) { if (typeof showToast === 'function') showToast('Select a song first'); return; }
    if (typeof openVersionHub === 'function') openVersionHub(songTitle, opts || {});
}
function launchVersionHubForNorthStar() { launchVersionHub({ returnTo: 'northstar' }); }
function launchVersionHubForCoverMe() { launchVersionHub({ returnTo: 'coverme' }); }
function launchVersionHubForFadr() { launchVersionHub({ returnTo: 'fadr' }); }

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

// const FADR_PROXY → js/core/worker-api.js

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
                1. Paste an audio URL (Archive.org, Phish.in, YouTube, or direct MP3)<br>
                2. Fadr AI separates vocal stems<br>
                3. Each stem converts to MIDI → ABC notation<br>
                4. ABC is saved to each harmony section automatically<br>
                <span style="color:#9ca3af;font-size:0.9em">⏱ Takes 1–5 minutes depending on song length</span>
            </div>
            <div style="margin-bottom:16px">
                <label style="display:block;font-size:0.85em;color:#9ca3af;margin-bottom:6px">Audio URL:</label>
                <input id="fadrArchiveUrl" type="url" placeholder="https://archive.org/download/... or any audio URL"
                    value="${defaultUrl}"
                    style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;color:white;font-size:0.9em;outline:none">
                <p style="color:#6b7280;font-size:0.78em;margin-top:6px">💡 Use Find a Version to search for audio, or paste any direct URL</p>
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
    if (!audioUrl || !audioUrl.startsWith('http')) { alert('Please enter a valid audio URL'); return; }
    const isArchive = audioUrl.includes('archive.org');
    const progressEl = document.getElementById('fadrProgress');
    const startBtn = document.querySelector('#fadrImportModal button[onclick*="runFadrImport"]');
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = '⏳ Processing...'; }
    // Add cancel flag
    window._fadrCancelled = false;
    if (progressEl) {
        progressEl.style.display = 'block';
        // Append cancel button without destroying existing children
        if (!document.getElementById('fadrCancelBtn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'fadrCancelBtn';
            cancelBtn.style.cssText = 'margin-top:10px;width:100%;padding:8px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:6px;cursor:pointer;font-size:0.82em';
            cancelBtn.textContent = '✕ Cancel';
            cancelBtn.onclick = function() { window._fadrCancelled = true; cancelBtn.textContent = 'Cancelling...'; cancelBtn.disabled = true; };
            progressEl.appendChild(cancelBtn);
        }
    }
    // Re-query progress elements (in case DOM changed)
    const progressText = document.getElementById('fadrProgressText');
    const progressBar = document.getElementById('fadrProgressBar');
    const progressDetail = document.getElementById('fadrProgressDetail');
    const setProgress = (msg, pct, detail = '') => {
        if (progressEl) progressEl.style.display = 'block';
        if (progressText) progressText.textContent = msg;
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressDetail) progressDetail.textContent = detail;
    };
    try {
        let audioBuffer;
        if (isArchive) {
            setProgress('📥 Downloading from Archive.org...', 5, audioUrl.split('/').pop());
            const archiveResp = await fetch(`${FADR_PROXY}/archive-fetch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioUrl }) });
            if (!archiveResp.ok) { const err = await archiveResp.json().catch(() => ({})); throw new Error(`Archive fetch failed: ${err.error || archiveResp.status}`); }
            audioBuffer = await archiveResp.arrayBuffer();
            setProgress('✅ Audio downloaded', 15, `${(audioBuffer.byteLength/1024/1024).toFixed(1)} MB`);
        } else {
            setProgress('📥 Fetching audio...', 5, audioUrl.split('/').pop());
            const resp = await fetch(audioUrl);
            if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
            audioBuffer = await resp.arrayBuffer();
        }
        if (window._fadrCancelled) throw new Error('Cancelled by user');
        setProgress('✅ Audio downloaded', 15, `${(audioBuffer.byteLength/1024/1024).toFixed(1)} MB`);

        setProgress('📤 Getting Fadr upload URL...', 20);
        const filename = audioUrl.split('/').pop() || 'song.mp3';
        const ext = filename.split('.').pop().toLowerCase() || 'mp3';
        const uploadUrlResp = await fetch(`${FADR_PROXY}/fadr/assets/upload2`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: filename, extension: ext }) });
        if (!uploadUrlResp.ok) throw new Error(`Fadr upload URL failed: ${uploadUrlResp.status}`);
        const { url: presignedUrl, s3Path } = await uploadUrlResp.json();
        if (window._fadrCancelled) throw new Error('Cancelled by user');

        setProgress('📤 Uploading to Fadr...', 25, `${(audioBuffer.byteLength/1024/1024).toFixed(1)} MB → Fadr S3`);
        const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : 'audio/mpeg';
        const putResp = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: audioBuffer });
        if (!putResp.ok) throw new Error(`S3 upload failed: ${putResp.status}`);

        setProgress('🗄️ Creating Fadr asset...', 40);
        const group = filename + '-' + Date.now();
        const assetResp = await fetch(`${FADR_PROXY}/fadr/assets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: filename, s3Path: s3Path, extension: ext, group: group }) });
        if (!assetResp.ok) { const errTxt = await assetResp.text().catch(()=>''); throw new Error(`Fadr create asset failed: ${assetResp.status} ${errTxt.substring(0,100)}`); }
        const asset = await assetResp.json();
        const assetId = asset?.asset?._id || asset?._id;
        if (!assetId) throw new Error('No asset ID returned from Fadr');
        console.log('Fadr asset created:', assetId);

        setProgress('🤖 Starting stem separation...', 50, 'AI is separating vocal parts...');
        const taskResp = await fetch(`${FADR_PROXY}/fadr/assets/analyze/stem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _id: assetId }) });
        if (!taskResp.ok) { const errTxt = await taskResp.text().catch(()=>''); throw new Error(`Fadr stem task failed: ${taskResp.status} ${errTxt.substring(0,100)}`); }

        // Poll for up to 10 minutes (120 attempts × 5s)
        for (let attempt = 0; attempt < 120; attempt++) {
            if (window._fadrCancelled) throw new Error('Cancelled by user');
            await new Promise(r => setTimeout(r, 5000));
            const pollResp = await fetch(`${FADR_PROXY}/fadr/assets/${assetId}`);
            if (!pollResp.ok) continue;
            const assetData = await pollResp.json();
            const mins = Math.floor(attempt * 5 / 60);
            const secs = (attempt * 5) % 60;
            setProgress(`⏳ AI processing... (${mins}:${String(secs).padStart(2,'0')})`, 55 + Math.min(attempt*0.15, 25), `Status: ${assetData.status || 'processing'}`);
            if (assetData.status === 'done' || (assetData.stems && assetData.stems.length > 0)) {
                // MIDI IDs may be strings (not objects) depending on Fadr API version
                const midiAssets = assetData.midi || [];
                const getMidiId = (m) => typeof m === 'string' ? m : m._id;
                const vocalMidi = midiAssets.filter(m => {
                    const name = typeof m === 'string' ? '' : (m.name || '').toLowerCase();
                    return name.includes('vocal');
                });
                const midiIds = vocalMidi.length > 0 ? vocalMidi.map(getMidiId) : midiAssets.slice(0,2).map(getMidiId);
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
        throw new Error('Fadr timed out after 10 minutes. The song may be too long — try a shorter track or a different recording.');
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

// FIREBASE_CONFIG, GOOGLE_DRIVE_CONFIG, isGoogleDriveInitialized, isUserSignedIn,
// accessToken, tokenClient, currentUserEmail, currentUserName, currentUserPicture,
// firebaseDB, firebaseStorage
// → js/core/firebase-service.js

// ── Multi-band data isolation ───────────────────────────────────────────────
// All Firebase paths are prefixed with /bands/{slug}/ so each band's data is isolated.
// Default: 'deadcetera' (the original band). Future: band switcher sets this.
var currentBandSlug = localStorage.getItem('deadcetera_current_band') || 'deadcetera';

function bandPath(subpath) {
    return 'bands/' + currentBandSlug + '/' + subpath;
}

// ── One-time migration: copy flat /songs and /master to /bands/deadcetera/ ──
// Runs once per device. Safe to re-run (checks for existing data first).
async function migrateToMultiBand() {
    if (!firebaseDB) return;
    var migrationKey = 'deadcetera_migrated_to_multiband';
    if (localStorage.getItem(migrationKey) === 'done') return;

    try {
        // Check if migration already happened (data exists at new path)
        var testSnap = await firebaseDB.ref('bands/deadcetera/master').once('value');
        if (testSnap.val()) {
            console.log('Multi-band migration already complete (data exists at new path)');
            localStorage.setItem(migrationKey, 'done');
            return;
        }

        // Check if old flat data exists
        var oldSongsSnap = await firebaseDB.ref('songs').once('value');
        var oldMasterSnap = await firebaseDB.ref('master').once('value');
        var oldPartiesSnap = await firebaseDB.ref('listening_parties').once('value');

        var oldSongs = oldSongsSnap.val();
        var oldMaster = oldMasterSnap.val();
        var oldParties = oldPartiesSnap.val();

        if (!oldSongs && !oldMaster) {
            console.log('No legacy data to migrate');
            localStorage.setItem(migrationKey, 'done');
            return;
        }

        console.log('Migrating data to /bands/deadcetera/ ...');
        var updates = {};
        if (oldSongs) updates['bands/deadcetera/songs'] = oldSongs;
        if (oldMaster) updates['bands/deadcetera/master'] = oldMaster;
        if (oldParties) updates['bands/deadcetera/listening_parties'] = oldParties;

        // Write band metadata
        updates['bands/deadcetera/meta'] = {
            name: 'Deadcetera',
            slug: 'deadcetera',
            createdAt: Date.now(),
            catalog: ['GD', 'JGB', 'Phish', 'WSP', 'ABB'],
            members: {
                drew: { name: 'Drew', role: 'Rhythm Guitar', email: 'drewmerrill1029@gmail.com', joined: Date.now() },
                chris: { name: 'Chris', role: 'Bass', email: 'cmjalbert@gmail.com', joined: Date.now() },
                brian: { name: 'Brian', role: 'Lead Guitar', email: 'brian@hrestoration.com', joined: Date.now() },
                pierce: { name: 'Pierce', role: 'Keyboard', email: 'pierce.d.hale@gmail.com', joined: Date.now() },
                jay: { name: 'Jay', role: 'Drums', email: 'jnault@fegholdings.com', joined: Date.now() }
            }
        };

        await firebaseDB.ref().update(updates);
        console.log('Multi-band migration complete!');
        localStorage.setItem(migrationKey, 'done');
        showToast('Data migrated to multi-band format');
    } catch (err) {
        console.error('Migration error:', err);
        // Don't mark done so it retries next load
    }
}

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
    
    // Run one-time data migration to multi-band structure
    migrateToMultiBand().catch(err => console.log('Migration skipped:', err.message));
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
        
        // Run one-time data migration to multi-band structure
        migrateToMultiBand().catch(err => console.log('Migration skipped:', err.message));
        
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
        currentUserName = userInfo.name || userInfo.given_name || '';
        currentUserPicture = userInfo.picture || '';
        localStorage.setItem('deadcetera_google_name', currentUserName);
        localStorage.setItem('deadcetera_google_picture', currentUserPicture);
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

// Scan localStorage for any DeadCetera data saved before Firebase was initialized.
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
                          'best_shot_takes','best_shot_ratings','best_shot_section_notes',
                          'practice_tracks','rehearsal_notes','gig_notes','moises_stems',
                          'harmony_metadata','part_notes','custom_songs','calendar_events',
                          'blocked_dates','gig_history','setlists','equipment','contacts',
                          'playlists','finances','finances_meta','social_profiles','best_shots'];
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
        var name = currentUserName || currentUserEmail || '';
        var parts = name.split(/[ @]/);
        var initials = parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase() || '?';
        var customPic = localStorage.getItem('deadcetera_avatar_custom') || '';
        var picSrc = customPic || currentUserPicture || '';

        if (picSrc) {
            button.innerHTML = '<img src="' + picSrc + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block">';
        } else {
            button.innerHTML = '<span style="display:flex;width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);align-items:center;justify-content:center;font-size:0.72em;font-weight:800;color:#fff">' + initials + '</span>';
        }
        button.className = 'topbar-btn';
        button.style.cssText = 'background:none!important;border:2px solid #22c55e!important;padding:2px!important;border-radius:50%!important;width:36px!important;height:36px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;flex-shrink:0!important;';
        button.title = (currentUserName || currentUserEmail || 'Signed in') + ' — tap to manage';
        button.onclick = showAvatarMenu;

        const heroBtn = document.getElementById('googleDriveAuthBtn2');
        if (heroBtn) { heroBtn.innerHTML = '👋 Sign Out'; heroBtn.style.background = '#64748b'; }
        const heroCaption = document.querySelector('#signInPrompt p');
        if (heroCaption) heroCaption.textContent = 'Signed in as ' + (currentUserEmail || '');
    } else {
        button.innerHTML = '👤';
        button.className = 'topbar-btn';
        button.style.cssText = 'background:#667eea!important;color:#fff!important;border:none!important;border-radius:50%!important;width:36px!important;height:36px!important;padding:0!important;font-size:1.1em!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;';
        button.title = 'Sign in to sync with your bandmates';
        button.onclick = handleGoogleDriveAuth;

        const heroBtn = document.getElementById('googleDriveAuthBtn2');
        if (heroBtn) { heroBtn.innerHTML = '👤 Sign In'; heroBtn.style.background = 'var(--accent)'; }
        const heroCaption = document.querySelector('#signInPrompt p');
        if (heroCaption) heroCaption.textContent = 'Sign in to sync with your bandmates';
    }
}

function showAvatarMenu() {
    var existing = document.getElementById('avatarMenuPopup');
    if (existing) { existing.remove(); return; }
    var btn = document.getElementById('googleDriveAuthBtn');
    var rect = btn ? btn.getBoundingClientRect() : { right: window.innerWidth - 8, bottom: 50 };
    var name = currentUserName || '';
    var email = currentUserEmail || '';
    var customPic = localStorage.getItem('deadcetera_avatar_custom') || '';
    var picSrc = customPic || currentUserPicture || '';
    var parts = (name || email).split(/[ @]/);
    var initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (name||email).slice(0,2).toUpperCase() || '?';
    var avatarHtml = picSrc
        ? '<img src="' + picSrc + '" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2.5px solid #22c55e;flex-shrink:0">'
        : '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;font-size:1.1em;font-weight:800;color:#fff;border:2.5px solid #22c55e;flex-shrink:0">' + initials + '</div>';
    var menu = document.createElement('div');
    menu.id = 'avatarMenuPopup';
    menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 8) + 'px;right:' + (window.innerWidth - rect.right) + 'px;background:#1e293b;border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px;min-width:230px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,0.6)';
    menu.innerHTML = ''
        + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
        +   avatarHtml
        +   '<div style="min-width:0"><div style="font-weight:700;font-size:0.9em;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (name || 'Musician') + '</div>'
        +   '<div style="font-size:0.72em;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + email + '</div>'
        +   '<div style="font-size:0.68em;color:#22c55e;margin-top:2px;font-weight:600">● Connected</div></div>'
        + '</div>'
        + '<div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:10px;display:flex;flex-direction:column;gap:6px">'
        + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85em;color:#94a3b8;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07)">'
        +   '🖼️ Upload profile photo'
        +   '<input type="file" accept="image/*" style="display:none" onchange="avatarUploadPhoto(this)">'
        + '</label>'
        + '<button onclick="avatarClearCustom()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);color:#64748b;padding:7px 10px;border-radius:8px;font-size:0.85em;cursor:pointer;text-align:left">🔄 Use Google photo instead</button>'
        + '<button onclick="avatarSignOut()" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#f87171;padding:7px 10px;border-radius:8px;font-size:0.85em;cursor:pointer;text-align:left">🚪 Sign Out</button>'
        + '</div>';
    document.body.appendChild(menu);
    setTimeout(function() {
        document.addEventListener('click', function h(e) {
            if (!menu.contains(e.target) && e.target !== btn) { menu.remove(); document.removeEventListener('click', h); }
        });
    }, 100);
}

function avatarUploadPhoto(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            var canvas = document.createElement('canvas');
            var size = Math.min(img.width, img.height, 128);
            canvas.width = size; canvas.height = size;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, size, size);
            localStorage.setItem('deadcetera_avatar_custom', canvas.toDataURL('image/jpeg', 0.85));
            document.getElementById('avatarMenuPopup')?.remove();
            updateDriveAuthButton();
            showToast('👤 Avatar updated!');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function avatarSignOut() {
    document.getElementById('avatarMenuPopup')?.remove();
    handleGoogleDriveAuth();
}

function avatarClearCustom() {
    localStorage.removeItem('deadcetera_avatar_custom');
    document.getElementById('avatarMenuPopup')?.remove();
    updateDriveAuthButton();
    showToast('Using Google photo');
}


// ============================================================================
// AUTHENTICATION
// ============================================================================

async function handleGoogleDriveAuth(silent) {
    if (!isGoogleDriveInitialized) {
        try {
            console.log('🔥 Loading Firebase...');
            await loadGoogleDriveAPI();
        } catch (error) {
            console.error('Failed to load Firebase:', error);
            if (!silent) alert('Failed to initialize.\n\nError: ' + error.message);
            return;
        }
    }
    
    if (isUserSignedIn) {
        if (silent) return; // Don't sign out in silent mode
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
            console.log('🔑 Requesting sign-in...' + (silent ? ' (auto-reconnect)' : ''));
            tokenClient.requestAccessToken({ prompt: silent ? 'none' : '' });
        } catch (error) {
            console.error('Sign-in failed:', error);
            if (!silent) alert('Sign-in failed.\n\nError: ' + error.message);
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
    return bandPath(`songs/${sanitizeFirebasePath(songTitle)}/${sanitizeFirebasePath(dataType)}`);
}

function masterPath(fileName) {
    // Remove file extension for cleaner paths
    const name = fileName.replace('.json', '');
    return bandPath(`master/${sanitizeFirebasePath(name)}`);
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

async function addSectionStatusDots() {
    // Add a small section-health dot to each song row based on cached section ratings
    document.querySelectorAll('.song-item').forEach(function(item) {
        var title = item.dataset.title || '';
        if (!title) return;
        if (item.querySelector('.section-dot')) return; // already added
        var statusCell = item.querySelector('.song-status-cell');
        if (!statusCell) return;
        var ratings = window._sectionRatingsCache && window._sectionRatingsCache[title];
        if (!ratings) return;
        var vals = Object.values(ratings).map(Number).filter(function(v) { return v > 0; });
        if (!vals.length) return;
        var avg = vals.reduce(function(a,b){return a+b;},0)/vals.length;
        var redCount = vals.filter(function(v){return v<=1;}).length;
        var color = redCount > 0 ? '#ef4444' : avg >= 4 ? '#22c55e' : avg >= 3 ? '#f59e0b' : '#f87171';
        var dot = document.createElement('span');
        dot.className = 'section-dot';
        dot.title = 'Sections: avg ' + avg.toFixed(1) + '/5' + (redCount?' (' + redCount + ' red)':'');
        dot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;background:'+color+';margin-left:3px;flex-shrink:0;vertical-align:middle';
        statusCell.appendChild(dot);
    });
}

function addStatusBadges() {
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
                'wip': { text: '🔧 WIP', color: '#fff', bg: '#d97706' },
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

async function preloadSectionRatingsCache() {
    if (window._sectionRatingsCache) return;
    window._sectionRatingsCache = {};
    // Load from the master readiness file which has section data baked in
    // Actually load lightweight: just check if section_ratings exists per visible song
    var visible = Array.from(document.querySelectorAll('.song-item')).map(function(el) {
        return el.dataset.title || '';
    }).filter(Boolean).slice(0, 30); // limit to 30 visible songs
    if (!visible.length) return;
    await Promise.all(visible.map(async function(title) {
        try {
            var snap = await firebaseDB.ref(bandPath('songs/' + sanitizeFirebasePath(title) + '/section_ratings')).once('value');
            if (snap.val()) {
                window._sectionRatingsCache[title] = snap.val();
            }
        } catch(e) {}
    }));
    addSectionStatusDots();
}

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
        const harmonySlot = badgesContainer.querySelector('.harmony-slot');
        if (harmonySlot) {
            harmonySlot.innerHTML = harmonyBadgeCache[songTitle]
                ? '<span class="harmony-badge" title="Has vocal harmonies">🎤</span>'
                : '<span class="harmony-badge" style="visibility:hidden">🎤</span>';
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
    firebaseDB.ref(bandPath('songs')).once('value').then(snapshot => {
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
        const nsSlot = bc.querySelector('.northstar-slot');
        if (nsSlot) {
            nsSlot.innerHTML = northStarCache[t]
                ? '<span class="northstar-badge" title="Has reference version">⭐</span>'
                : '<span class="northstar-badge" style="visibility:hidden">⭐</span>';
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
    // Always save to localStorage as backup (with original keys)
    const key = `deadcetera_${fileName}`;
    localStorage.setItem(key, JSON.stringify(data));
    
    if (!firebaseDB) return false;
    
    try {
        // Sanitize all object keys for Firebase (no . # $ / [ ])
        const sanitized = (typeof data === 'object' && data !== null && !Array.isArray(data))
            ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k.replace(/[.#$\[\]\/]/g, '_'), v]))
            : data;
        const path = masterPath(fileName);
        await firebaseDB.ref(path).set(sanitized);
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
        const storageRef = firebaseStorage.ref(bandPath(`stems/${safeName}`));
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
// let currentPage → js/ui/navigation.js

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

// const pageRenderers → js/ui/navigation.js

// ============================================================================
// SETLIST BUILDER
// ============================================================================
function renderSetlistsPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>📋 Setlists</h1><p>Build and manage setlists for gigs</p></div>
    <div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn btn-primary" onclick="createNewSetlist()">+ New Setlist</button></div>
    <div id="setlistsList"></div>`;
    if (typeof loadGigHistory === 'function') loadGigHistory().then(() => loadSetlists()); else loadSetlists();
}

async function loadSetlists() {
    const rawData = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    // Sort newest first; track original indices for edit/delete operations
    const data = rawData.map((sl, origIdx) => ({ ...sl, _origIdx: origIdx })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const container = document.getElementById('setlistsList');
    if (!container) return;
    if (data.length === 0) { container.innerHTML = '<div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No setlists yet. Create one for your next gig!</div>'; return; }
    container.innerHTML = data.map((sl, i) => `<div class="app-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;cursor:pointer" onclick="editSetlist(${sl._origIdx})">
                <h3 style="margin-bottom:4px">${sl.name||'Untitled'}</h3>
                <div style="display:flex;gap:12px;font-size:0.8em;color:var(--text-muted);flex-wrap:wrap">
                    <span>📅 ${sl.date||'No date'}</span><span>🏛️ ${sl.venue||'No venue'}</span>
                    <span>🎵 ${(sl.sets||[]).reduce((a,s)=>a+(s.songs||[]).length,0)} songs</span>
                    <span>📋 ${(sl.sets||[]).length} set${(sl.sets||[]).length!==1?'s':''}</span>
                </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="btn btn-sm btn-ghost" onclick="editSetlist(${sl._origIdx})" title="Edit">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="launchGigMode(${sl._origIdx})" title="Go Live" style="color:#22c55e">🎤</button>
                <button class="btn btn-sm btn-ghost" onclick="exportSetlistToiPad(${sl._origIdx})" title="Export for iPad" style="color:var(--accent-light)">📱</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteSetlist(${sl._origIdx})" title="Delete" style="color:var(--red,#f87171)">🗑️</button>
            </div>
        </div>
        ${(sl.sets||[]).map(s => { const SA={'stop':'  ','flow':' → ','segue':' ~ ','cutoff':' | '}; return `<div style="font-size:0.78em;color:var(--text-dim);margin-top:4px"><strong>${s.name}:</strong> ${(s.songs||[]).map((sg,i,arr)=>{ const t=typeof sg==='string'?sg:sg.title; const a=i<arr.length-1?(SA[(typeof sg==='object'&&sg.segue)||'stop']||'  '):''; return t+a; }).join('')}</div>`; }).join('')}
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
<title>${sl.name || 'Setlist'} — GrooveLinx Crib Sheet</title>
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
    results.innerHTML = matches.map(s => `<div class="list-item" style="cursor:pointer;padding:6px 10px;font-size:0.85em" data-title="${s.title.replace(/"/g,'&quot;')}" data-setidx="${setIdx}" onclick="slAddSongToSet(${setIdx},this.dataset.title)">
        <span style="color:var(--text-dim);font-size:0.8em;width:30px">${s.band||''}</span> ${s.title}</div>`).join('');
}
function slAddSongToSet(setIdx, title) {
    if (!window._slSets[setIdx]) window._slSets[setIdx] = { songs: [] };
    window._slSets[setIdx].songs.push({title: title, segue: 'stop'});
    slRenderSetSongs(setIdx);
    document.getElementById('slAddSong' + setIdx).value = '';
    document.getElementById('slSongResults' + setIdx).innerHTML = '';
}

function slRenderSetSongs(setIdx) {
    const el = document.getElementById('slSet' + setIdx + 'Songs');
    if (!el) return;
    const items = window._slSets[setIdx]?.songs || [];
    const allSongsList = (typeof allSongs !== 'undefined' ? allSongs : songs || []);
    el.innerHTML = items.map((item, i) => {
        const s = typeof item === 'string' ? item : item.title;
        const segue = typeof item === 'object' ? (item.segue || 'stop') : 'stop';
        const songData = allSongsList.find(sd => sd.title === s);
        const keyStr = songData?.key ? `<span style="font-size:0.7em;color:#818cf8;background:rgba(129,140,248,0.12);padding:1px 5px;border-radius:4px;border:1px solid rgba(129,140,248,0.2)">${songData.key}</span>` : '';
        const bpmStr = songData?.bpm ? `<span style="font-size:0.7em;color:#94a3b8">\u26a1${songData.bpm}</span>` : '';
        const segueColor = { stop:'#64748b', flow:'#818cf8', segue:'#34d399', cutoff:'#f87171' }[segue] || '#64748b';
        const histTip = typeof getSongHistoryTooltip === 'function' ? getSongHistoryTooltip(s) : '';
        return `<div class="list-item sl-song-row" data-set="${setIdx}" data-idx="${i}" draggable="true"
            style="padding:6px 10px;font-size:0.85em;gap:6px;align-items:center;cursor:default" title="${histTip.replace(/"/g,'&quot;')}">
            <span style="color:#475569;cursor:grab;font-size:1em;flex-shrink:0" title="Drag to reorder">\u2807</span>
            <span style="color:var(--text-dim);min-width:20px;font-weight:600;flex-shrink:0">${i + 1}.</span>
            <span style="flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s}</span>
            ${keyStr}${bpmStr}<span id="slvote_${sanitizeFirebasePath(s).replace(/[^a-zA-Z0-9]/g,'_')}" style="display:inline-flex;align-items:center;gap:2px;margin-left:4px;vertical-align:middle"></span>
            <select onchange="slSetSegue(${setIdx},${i},this.value)" onclick="event.stopPropagation()"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:${segueColor};border-radius:5px;padding:2px 4px;font-size:0.78em;font-weight:700;cursor:pointer;flex-shrink:0">
                <option value="stop" ${segue==='stop'?'selected':''}>Stop</option>
                <option value="flow" ${segue==='flow'?'selected':''}>\u2192 Flow</option>
                <option value="segue" ${segue==='segue'?'selected':''}>~ Segue</option>
                <option value="cutoff" ${segue==='cutoff'?'selected':''}>| Cut</option>
            </select>
            <button class="btn btn-sm btn-ghost" onclick="slRemoveSong(${setIdx},${i})" style="padding:2px 6px;flex-shrink:0">\u2715</button>
        </div>`;
    }).join('');
    el.querySelectorAll('.sl-song-row').forEach(row => {
        row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', row.dataset.idx); row.style.opacity='0.4'; });
        row.addEventListener('dragend', e => { row.style.opacity='1'; });
        row.addEventListener('dragover', e => { e.preventDefault(); row.style.background='rgba(102,126,234,0.12)'; });
        row.addEventListener('dragleave', e => { row.style.background=''; });
        row.addEventListener('drop', e => {
            e.preventDefault(); row.style.background='';
            const from=parseInt(e.dataTransfer.getData('text/plain')), to=parseInt(row.dataset.idx);
            if(from===to)return;
            const songs=window._slSets[setIdx].songs;
            const [moved]=songs.splice(from,1); songs.splice(to,0,moved);
            slRenderSetSongs(setIdx);
        });
    });
}

// Band Readiness Meter for setlist
async function slRenderReadinessMeter() {
    var container = document.getElementById('slReadinessMeter');
    if (!container) return;
    await preloadReadinessCache();
    var allTitles = [];
    (window._slSets || []).forEach(function(set) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : item.title;
            if (t) allTitles.push(t);
        });
    });
    if (!allTitles.length) { container.innerHTML = ''; return; }
    var songRows = allTitles.map(function(title) {
        var scores = readinessCache[title] || {};
        var vals = BAND_MEMBERS_ORDERED.map(function(m) { return scores[m.key] || 0; }).filter(Boolean);
        var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : 0;
        return { title: title, avg: avg, color: avg ? readinessColor(Math.round(avg)) : '#334155', scores: scores };
    });
    var locked   = songRows.filter(function(s){return s.avg>=4;}).length;
    var unrated  = songRows.filter(function(s){return s.avg===0;}).length;
    var inProg   = songRows.length - locked - unrated;
    var pct      = songRows.length ? Math.round(locked/songRows.length*100) : 0;
    var mc       = pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444';
    var html = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    html += '<span style="font-weight:700;font-size:0.9em">🎯 Band Readiness</span>';
    html += '<span style="font-size:1.1em;font-weight:800;color:'+mc+'">'+pct+'%</span></div>';
    html += '<div style="height:8px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden;margin-bottom:10px">';
    html += '<div style="height:100%;width:'+pct+'%;background:'+mc+';border-radius:4px;transition:width 0.4s ease"></div></div>';
    html += '<div style="display:flex;gap:14px;font-size:0.75em;margin-bottom:10px">';
    html += '<span style="color:#22c55e">🔒 '+locked+' locked</span>';
    html += '<span style="color:#f59e0b">🔧 '+inProg+' in progress</span>';
    html += '<span style="color:#64748b">❓ '+unrated+' unrated</span></div>';
    html += '<div style="display:flex;flex-direction:column;gap:5px">';
    songRows.forEach(function(s) {
        var pctS = s.avg ? Math.round(s.avg/5*100) : 0;
        var dots = BAND_MEMBERS_ORDERED.map(function(m) {
            var sc = s.scores[m.key]||0;
            var c = sc ? readinessColor(sc) : 'rgba(255,255,255,0.1)';
            return '<span title="'+m.name+': '+( sc||'?' )+'/5" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c+'"></span>';
        }).join('');
        html += '<div style="display:flex;align-items:center;gap:6px">';
        html += '<span style="font-size:0.72em;color:#94a3b8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.title+'</span>';
        html += '<div style="display:flex;gap:2px;flex-shrink:0">'+dots+'</div>';
        html += '<div style="width:40px;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;flex-shrink:0">';
        html += '<div style="height:100%;width:'+pctS+'%;background:'+s.color+';border-radius:2px"></div></div></div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
}

// Song Voting for setlist
async function slVoteSong(setlistIdx, songTitle, vote) {
    var memberKey = getCurrentMemberReadinessKey();
    if (!memberKey) { showToast('Sign in to vote'); return; }
    var safe = sanitizeFirebasePath(songTitle);
    var path = bandPath('setlist_votes/'+setlistIdx+'/'+safe+'/'+memberKey);
    try {
        var snap = await firebaseDB.ref(path).once('value');
        if (snap.val() === vote) { await firebaseDB.ref(path).remove(); }
        else { await firebaseDB.ref(path).set(vote); }
        slRefreshVotesForSong(setlistIdx, songTitle);
    } catch(e) { showToast('Could not save vote'); }
}

async function slRefreshVotesForSong(setlistIdx, songTitle) {
    var safe = sanitizeFirebasePath(songTitle);
    var myKey = getCurrentMemberReadinessKey();
    try {
        var snap = await firebaseDB.ref(bandPath('setlist_votes/'+setlistIdx+'/'+safe)).once('value');
        var votes = snap.val() || {};
        var ups = Object.values(votes).filter(function(v){return v===1;}).length;
        var downs = Object.values(votes).filter(function(v){return v===-1;}).length;
        var myVote = myKey?(votes[myKey]||0):0;
        var safeId = safe.replace(/[^a-zA-Z0-9]/g,'_');
        var el = document.getElementById('slvote_'+safeId);
        if (el) el.innerHTML = _slVoteBtns(setlistIdx, songTitle, ups, downs, myVote);
    } catch(e) {}
}

function _slVoteBtns(idx, title, ups, downs, myVote) {
    var st = JSON.stringify(title);
    var upOn = myVote===1;
    var dnOn = myVote===-1;
    var upS = upOn?'background:rgba(34,197,94,0.25);color:#86efac;border-color:rgba(34,197,94,0.5)':'background:rgba(255,255,255,0.04);color:#64748b;border-color:rgba(255,255,255,0.1)';
    var dnS = dnOn?'background:rgba(239,68,68,0.2);color:#fca5a5;border-color:rgba(239,68,68,0.4)':'background:rgba(255,255,255,0.04);color:#64748b;border-color:rgba(255,255,255,0.1)';
    return '<button onclick="event.stopPropagation();slVoteSong('+idx+','+st+',1)" style="border:1px solid;border-radius:5px;padding:1px 6px;font-size:0.7em;cursor:pointer;'+upS+'">👍'+(ups?ups:'')+'</button>'+           '<button onclick="event.stopPropagation();slVoteSong('+idx+','+st+',-1)" style="border:1px solid;border-radius:5px;padding:1px 6px;font-size:0.7em;cursor:pointer;margin-left:3px;'+dnS+'">👎'+(downs?downs:'')+'</button>';
}

async function slEnrichKeyBpm() {
    // Fetch key+BPM for any song in the current sets that's missing them
    if (!window._slSets) return;
    var allTitles = [];
    window._slSets.forEach(function(set) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : item.title;
            if (t) allTitles.push(t);
        });
    });
    var allSongsList = (typeof allSongs !== 'undefined' ? allSongs : []);
    var toFetch = allTitles.filter(function(t) {
        var sd = allSongsList.find(function(s) { return s.title === t; });
        return !sd || (!sd.key && !sd.bpm);
    });
    if (!toFetch.length) return;
    await Promise.all(toFetch.map(async function(title) {
        try {
            var keyData = await loadBandDataFromDrive(title, 'song_key');
            var bpmData = await loadBandDataFromDrive(title, 'song_bpm');
            var sd = allSongsList.find(function(s) { return s.title === title; });
            if (sd) {
                if (keyData && keyData.key) sd.key = keyData.key;
                if (bpmData && bpmData.bpm) sd.bpm = bpmData.bpm;
            }
        } catch(e) {}
    }));
    // Re-render all sets now that we have key/bpm
    window._slSets.forEach(function(_, si) { slRenderSetSongs(si); });
    slRenderReadinessMeter();
    var _vIdx = window._slEditIdx;
    if (_vIdx !== undefined) {
        (window._slSets||[]).forEach(function(set){
            (set.songs||[]).forEach(function(item){
                var t = typeof item==='string'?item:item.title;
                if(t) slRefreshVotesForSong(_vIdx, t);
            });
        });
    }
}

function slSetSegue(setIdx, songIdx, segueType) {
    const items = window._slSets[setIdx]?.songs;
    if (!items || items[songIdx] === undefined) return;
    if (typeof items[songIdx] === 'string') items[songIdx] = { title: items[songIdx], segue: segueType };
    else items[songIdx].segue = segueType;
}

function slToggleTransition(setIdx, songIdx) {
    const items = window._slSets[setIdx]?.songs;
    if (!items || !items[songIdx]) return;
    if (typeof items[songIdx] === 'string') items[songIdx] = { title: items[songIdx], segue: 'flow' };
    else items[songIdx].segue = items[songIdx].segue === 'flow' ? 'stop' : 'flow';
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
    window._slEditIdx = idx;
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
        <div id="slReadinessMeter"></div>
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
            <button class="btn btn-ghost" onclick="slShareSetlist(${idx})" style="color:#94a3b8">📤 Share</button>
            <button class="btn btn-ghost" onclick="carePackageSend('gig',${idx})" style="color:#fbbf24;font-size:0.82em">🪂 Pack</button>
            <button class="btn btn-success" onclick="slSaveSetlistEdit(${idx})" style="margin-left:auto">💾 Save Changes</button>
            <button class="btn btn-ghost" onclick="loadSetlists()">Cancel</button>
        </div></div>`;
    
    // Render existing songs in each set
    window._slSets.forEach((set, si) => slRenderSetSongs(si));
    slEnrichKeyBpm();
}

function slShareSetlist(idx) {
    var sl = (window._slSets !== undefined) ? null : null; // loaded below
    // Load from Firebase and show share modal
    loadBandDataFromDrive('_band', 'setlists').then(function(setlists) {
        setlists = toArray(setlists||[]);
        var sl = setlists[idx];
        if (!sl) { showToast('Setlist not found'); return; }
        _slShowShareModal(sl, idx);
    });
}

function _slShowShareModal(sl, idx) {
    var existing = document.getElementById('slShareModal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'slShareModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center';
    var name = sl.name || 'Untitled Setlist';
    var date = sl.date || '';
    // Build text version
    var lines = [name + (date?' — '+date:''), ''];
    (sl.sets||[]).forEach(function(set, si) {
        lines.push((set.name||'Set '+(si+1)).toUpperCase());
        (set.songs||[]).forEach(function(item, i) {
            var t = typeof item==='string'?item:item.title;
            var key = typeof item==='object'&&item.key?' ['+item.key+']':'';
            var seg = typeof item==='object'&&item.segue&&item.segue!=='stop'?' →':'';
            lines.push('  '+(i+1)+'. '+t+key+seg);
        });
        lines.push('');
    });
    lines.push('Generated by GrooveLinx');
    var textContent = lines.join('\n');
    modal.innerHTML = '<div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:80vh;overflow-y:auto">';
    modal.innerHTML += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    modal.innerHTML += '<div style="font-weight:800;font-size:1em">📤 Share Setlist</div>';
    modal.innerHTML += '<button onclick="document.getElementById(\'slShareModal\').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1em">×</button></div>';
    modal.innerHTML += '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;font-family:monospace;font-size:0.78em;color:#94a3b8;white-space:pre-wrap;max-height:200px;overflow-y:auto;margin-bottom:14px" id="slShareTextPreview">' + textContent.replace(/</g,'&lt;') + '</div>';
    modal.innerHTML += '<div style="display:flex;flex-direction:column;gap:8px">';
    modal.innerHTML += '<button onclick="slShareCopyText()" style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.35);color:#a5b4fc;padding:10px;border-radius:10px;font-size:0.88em;font-weight:700;cursor:pointer">📋 Copy as Text</button>';
    modal.innerHTML += '<div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:8px;margin-top:4px">';
    modal.innerHTML += '<div style="font-size:0.7em;font-weight:700;color:#f59e0b;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">🪂 Parachute — Emergency Backups</div>';
    modal.innerHTML += '<button onclick="parachutePrint('+idx+')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;padding:10px;border-radius:10px;font-size:0.88em;font-weight:700;cursor:pointer;width:100%;text-align:left">🖨️ Print / PDF all charts (Kinkos ready)</button>';
    modal.innerHTML += '<button onclick="parachuteEmail('+idx+')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">📧 Email gig pack to myself</button>';
    modal.innerHTML += '<button onclick="parachutePublicUrl('+idx+')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">🔗 Copy public link (no login needed)</button>';
    modal.innerHTML += '<button onclick="parachuteCacheOffline('+idx+')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">💾 Cache offline (survives no WiFi)</button>';
    var _op = localStorage.getItem('deadcetera_offline_gigpack');
    if (_op) { try { var _opd = JSON.parse(_op); modal.innerHTML += '<button onclick="parachuteOpenOfflinePack()" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">📂 Open cached pack: \''+(_opd.name||'?')+"\' ("+new Date(_opd.cachedAt).toLocaleDateString()+')</button>'; } catch(e) {} }
    modal.innerHTML += '</div></div></div>';
    modal.innerHTML += '</div></div>';
    // Store text for copy fn
    modal.dataset.text = textContent;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function slShareCopyText() {
    var modal = document.getElementById('slShareModal');
    var text = modal ? modal.dataset.text : '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(function() {
        showToast('📋 Copied to clipboard!');
    }).catch(function() {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        ta.remove();
        showToast('📋 Copied!');
    });
}

async function slSharePrint(idx) {
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var sl = setlists[idx];
    if (!sl) return;
    var name = sl.name || 'Setlist';
    var date = sl.date || '';
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + name + '</title>';
    html += '<style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;padding:0 20px;color:#111}h1{font-size:1.6em;margin-bottom:4px}';
    html += '.meta{color:#666;font-size:0.85em;margin-bottom:24px}.set-header{font-size:0.75em;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#888;border-bottom:1px solid #ddd;padding-bottom:4px;margin:20px 0 10px}';
    html += '.song{display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid #f0f0f0}.num{color:#999;min-width:24px;font-size:0.85em}.title{flex:1;font-size:1em}.chip{font-size:0.72em;color:#666;background:#f5f5f5;padding:1px 6px;border-radius:4px}';
    html += '.footer{margin-top:32px;font-size:0.75em;color:#aaa;text-align:center}@media print{.footer{position:fixed;bottom:20px;width:100%}}</style></head><body>';
    html += '<h1>' + name + '</h1>';
    html += '<div class="meta">' + (date?date+' · ':'')+'GrooveLinx</div>';
    (sl.sets||[]).forEach(function(set, si) {
        html += '<div class="set-header">' + (set.name||'Set '+(si+1)) + '</div>';
        (set.songs||[]).forEach(function(item, i) {
            var t = typeof item==='string'?item:item.title;
            var key = typeof item==='object'&&item.key?'<span class="chip">'+item.key+'</span>':'';
            var bpm = typeof item==='object'&&item.bpm?'<span class="chip">⚡'+item.bpm+'</span>':'';
            var seg = typeof item==='object'&&item.segue&&item.segue!=='stop'?'<span style="color:#999;margin-left:4px">→</span>':'';
            html += '<div class="song"><span class="num">'+(i+1)+'.</span><span class="title">'+ t + seg +'</span>'+key+bpm+'</div>';
        });
    });
    html += '<div class="footer">Generated by GrooveLinx — Where bands lock in.</div>';
    html += '</body></html>';
    var win = window.open('','_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function(){win.print();},400);
}

// PARACHUTE SYSTEM
// Offline PDF gig pack, email gig pack, public read-only URL, offline cache

async function parachuteLoadSetlistData(sl) {
    var songs = [];
    (sl.sets||[]).forEach(function(set, si) {
        (set.songs||[]).forEach(function(item) {
            var t = typeof item==='string'?item:item.title;
            if (t) songs.push({ title:t, setName:set.name||'Set '+(si+1), key:'', bpm:'', chart:'', segue:typeof item==='object'?item.segue:'stop' });
        });
    });
    await Promise.all(songs.map(async function(s) {
        var sd = allSongs.find(function(a){return a.title===s.title;});
        s.key = sd&&sd.key?sd.key:'';
        s.bpm = sd&&sd.bpm?String(sd.bpm):'';
        try {
            var cd = await loadBandDataFromDrive(s.title, 'chart');
            if (cd && cd.text && cd.text.trim()) s.chart = cd.text.trim();
        } catch(e) {}
    }));
    return songs;
}

function parachuteBuildHtml(sl, songs) {
    var name = sl.name || 'Setlist';
    var date = sl.date || '';
    var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+name+'</title>';
    h += '<style>';
    h += '*{box-sizing:border-box;margin:0;padding:0}';
    h += 'body{font-family:Georgia,serif;font-size:13px;color:#111;background:#fff;padding:24px 32px}';
    h += '.cover{text-align:center;padding:40px 0 32px;border-bottom:2px solid #333;margin-bottom:28px}';
    h += '.cover h1{font-size:2.2em;font-weight:700;margin-bottom:6px}';
    h += '.cover .meta{font-size:0.85em;color:#666;margin-top:4px}';
    h += '.toc{margin-bottom:28px;border:1px solid #ddd;border-radius:4px;padding:16px}';
    h += '.toc h3{font-size:0.8em;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:10px}';
    h += '.toc-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0;font-size:0.88em}';
    h += '.song-page{page-break-before:always;padding-top:8px}';
    h += '.song-page:first-of-type{page-break-before:auto}';
    h += '.song-header{display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:12px}';
    h += '.song-title{font-size:1.4em;font-weight:700}';
    h += '.chip{background:#f0f0f0;padding:2px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.78em;margin-left:6px}';
    h += '.chart{font-family:Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55;white-space:pre-wrap;background:#fafafa;border:1px solid #e8e8e8;border-radius:4px;padding:12px 14px;margin-top:4px}';
    h += '.no-chart{color:#999;font-style:italic;font-size:0.88em;padding:10px 0}';
    h += '.footer{margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:0.72em;color:#aaa;text-align:center}';
    h += '@media print{.song-page{page-break-before:always}.song-page:first-of-type{page-break-before:auto}body{padding:16px 20px}}';
    h += '</style></head><body>';
    h += '<div class="cover"><h1>'+name+'</h1>';
    if (date) h += '<div class="meta">'+date+'</div>';
    h += '<div class="meta" style="margin-top:8px;font-size:0.75em;color:#aaa">GrooveLinx Emergency Gig Pack \u2014 Printed '+new Date().toLocaleDateString()+'</div></div>';
    // TOC
    h += '<div class="toc"><h3>Setlist</h3>';
    var num = 0, lastSet = '';
    songs.forEach(function(s) {
        if (s.setName !== lastSet) {
            if (lastSet) h += '<div style="height:4px"></div>';
            h += '<div style="font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:6px 0 3px">'+s.setName+'</div>';
            lastSet = s.setName;
        }
        num++;
        var chips = (s.key?s.key:'')+(s.key&&s.bpm?' \u00b7 ':'')+( s.bpm?s.bpm+' bpm':'');
        var seg = {flow:' \u2192',segue:' ~',cutoff:' |'}[s.segue]||'';
        h += '<div class="toc-row"><span><b>'+num+'.</b> '+s.title+seg+'</span><span style="color:#888;font-size:0.85em">'+chips+'</span></div>';
    });
    h += '</div>';
    // Per-song pages
    songs.forEach(function(s) {
        h += '<div class="song-page">';
        h += '<div class="song-header"><span class="song-title">'+s.title+'</span><span>';
        if (s.key) h += '<span class="chip">\ud83c\udfb5 '+s.key+'</span>';
        if (s.bpm) h += '<span class="chip">\u26a1'+s.bpm+' BPM</span>';
        h += '</span></div>';
        if (s.chart) {
            h += '<div class="chart">'+s.chart.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>';
        } else {
            h += '<div class="no-chart">No chord chart saved yet.</div>';
        }
        h += '</div>';
    });
    h += '<div class="footer">GrooveLinx Emergency Gig Pack \u2014 '+name+(date?' \u2014 '+date:'')+' \u2014 Printed '+new Date().toLocaleDateString()+'</div>';
    h += '</body></html>';
    return h;
}

async function parachutePrint(slIdx) {
    document.getElementById('slShareModal')?.remove();
    showToast('\ud83c\udfa2 Loading charts...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var html = parachuteBuildHtml(sl, songs);
    var win = window.open('','_blank');
    if (!win) { showToast('Pop-up blocked \u2014 allow pop-ups and try again'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function(){win.print();}, 600);
}

async function parachuteEmail(slIdx) {
    document.getElementById('slShareModal')?.remove();
    showToast('\ud83c\udfa2 Building email pack...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var body = (sl.name||'Setlist')+(sl.date?' \u2014 '+sl.date:'')+'\n';
    body += 'Emergency Gig Pack from GrooveLinx\n';
    body += '='.repeat(40)+'\n\n';
    var lastSet = '';
    songs.forEach(function(s, i) {
        if (s.setName !== lastSet) {
            body += '\n\u2500\u2500 '+s.setName.toUpperCase()+' \u2500\u2500\n';
            lastSet = s.setName;
        }
        body += '\n'+(i+1)+'. '+s.title;
        if (s.key||s.bpm) body += ' ('+[s.key,s.bpm&&s.bpm+' BPM'].filter(Boolean).join(', ')+')';
        body += '\n';
        if (s.chart) body += s.chart+'\n';
        else body += '(no chart saved)\n';
    });
    var subject = encodeURIComponent('GrooveLinx Gig Pack: '+(sl.name||'Setlist')+(sl.date?' \u2014 '+sl.date:''));
    var to = encodeURIComponent(currentUserEmail||'');
    var mailto = 'mailto:'+to+'?subject='+subject+'&body='+encodeURIComponent(body);
    if (mailto.length > 8000) {
        showToast('\ud83d\udce7 Pack too large for email \u2014 opening print view instead');
        setTimeout(function(){parachutePrint(slIdx);}, 800);
        return;
    }
    window.location.href = mailto;
    showToast('\ud83d\udce7 Opening email...');
}

async function parachutePublicUrl(slIdx) {
    showToast('\ud83d\udd17 Building public link...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var payload = JSON.stringify({
        name: sl.name||'Setlist',
        date: sl.date||'',
        songs: songs.map(function(s){return {title:s.title,key:s.key,bpm:s.bpm,chart:s.chart,setName:s.setName,segue:s.segue};})
    });
    var b64 = btoa(unescape(encodeURIComponent(payload)));
    if (b64.length > 200000) {
        showToast('\u26a0\ufe0f Pack too large for URL \u2014 use Print or Email instead');
        return;
    }
    var url = window.location.origin + window.location.pathname + '?gigpack=1#' + b64;
    navigator.clipboard.writeText(url).then(function() {
        showToast('\ud83d\udd17 Public link copied! Anyone can open in any browser.');
    }).catch(function() {
        prompt('Copy this link:', url);
    });
}

function parachuteCheckUrlHash() {
    if (window.location.search.indexOf('gigpack=1') < 0) return false;
    var hash = window.location.hash;
    if (!hash) return false;
    try {
        var payload = JSON.parse(decodeURIComponent(escape(atob(hash.slice(1)))));
        if (!payload || !payload.songs) return false;
        var html = parachuteBuildHtml({name:payload.name,date:payload.date}, payload.songs);
        document.open(); document.write(html); document.close();
        return true;
    } catch(e) { return false; }
}

async function parachuteCacheOffline(slIdx) {
    showToast('\ud83d\udcbe Loading charts for offline cache...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var pack = { name:sl.name, date:sl.date, songs:songs, cachedAt:new Date().toISOString() };
    try {
        localStorage.setItem('deadcetera_offline_gigpack', JSON.stringify(pack));
        showToast('\ud83d\udcbe Gig pack cached for offline use! \ud83c\udf89');
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({type:'CACHE_GIG_PACK'});
        }
    } catch(e) {
        showToast('Could not cache: '+e.message);
    }
}

function parachuteOpenOfflinePack() {
    var raw = localStorage.getItem('deadcetera_offline_gigpack');
    if (!raw) { showToast('No offline gig pack cached yet'); return; }
    try {
        var pack = JSON.parse(raw);
        var html = parachuteBuildHtml({name:pack.name,date:pack.date}, pack.songs);
        var win = window.open('','_blank');
        if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(function(){win.print();},400); }
        else { document.open(); document.write(html); document.close(); }
    } catch(e) { showToast('Could not open pack'); }
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

// Returns "Venue Name — City, ST" for dropdown display, falling back gracefully
// venueShortLabel(), deleteGig(), editGig(), saveGigEdit()
// → js/features/gigs.js

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
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600">${typeIcon} ${e.title||'Untitled'}</div>
                    ${e.venue?`<div style="font-size:0.75em;color:var(--text-muted);margin-top:1px">📍 ${e.venue}</div>`:''}
                    ${e.linkedSetlist?`<div style="font-size:0.72em;color:var(--accent-light)">📋 ${e.linkedSetlist}</div>`:''}
                </div>
                ${e.time?`<span style="font-size:0.75em;color:var(--text-muted);flex-shrink:0">${e.time}</span>`:''}
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

async function calAddEvent(date, editIdx, existing) {
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    const isEdit = editIdx !== undefined;
    const ev = existing || {};
    // Load setlists + venues for gig-type dropdowns
    const setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    setlists.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const setlistOpts = setlists.map(sl =>
        `<option value="${(sl.name||'').replace(/"/g,'&quot;')}" ${(ev.linkedSetlist||'')===(sl.name||'')?'selected':''}>${sl.name||'Untitled'}${sl.date?' ('+sl.date+')':''}</option>`
    ).join('');
    const venues = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    venues.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const venueOptsCal = venues.map(v =>
        `<option value="${(v.name||'').replace(/"/g,'&quot;')}" ${(ev.venue||'')===(v.name||'')?'selected':''}>${venueShortLabel(v)}</option>`
    ).join('');
    const showSetlist = ev.type === 'gig';
    const showVenue   = ev.type === 'gig';
    area.innerHTML = `<h3 style="margin-bottom:12px;font-size:0.95em">${isEdit?'\u270f\ufe0f Edit Event':'\u2795 Add Event'}</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="calDate" type="date" value="${date||ev.date||''}"></div>
        <div class="form-row"><label class="form-label">Type</label><select class="app-select" id="calType" onchange="calTypeChanged(this)">
            <option value="rehearsal" ${(ev.type||'rehearsal')==='rehearsal'?'selected':''}>&#127928; Rehearsal</option>
            <option value="gig" ${ev.type==='gig'?'selected':''}>&#127908; Gig</option>
            <option value="meeting" ${ev.type==='meeting'?'selected':''}>&#128101; Meeting</option>
            <option value="other" ${ev.type==='other'?'selected':''}>&#128204; Other</option>
        </select></div>
        <div class="form-row calGigOnly" id="calVenueRow" style="${showVenue?'':'display:none'}">
            <label class="form-label">🏛️ Venue</label>
            <select class="app-select" id="calVenue" onchange="calVenueSelected(this)" style="margin-bottom:6px">
                <option value="">-- Select a venue --</option>
                ${venueOptsCal}
                <option value="__other__">➕ Other / New venue…</option>
            </select>
            <input class="app-input" id="calVenueCustom" placeholder="Or type venue name" value="${ev.venueCustom||''}" style="${(ev.venue&&!venues.find(v=>v.name===ev.venue))||ev.venueCustom?'':'display:none'}">
        </div>
        <div class="form-row"><label class="form-label">Title</label><input class="app-input" id="calTitle" placeholder="e.g. Practice at Drew's" value="${ev.title||''}"></div>
        <div class="form-row"><label class="form-label">Time</label><input class="app-input" id="calTime" type="time" value="${ev.time||''}"></div>
        <div class="form-row calGigOnly" id="calSetlistRow" style="${showSetlist?'':'display:none'}">
            <label class="form-label">\uD83D\uDCCB Linked Setlist</label>
            <select class="app-select" id="calLinkedSetlist">
                <option value="">-- None --</option>
                ${setlistOpts}
            </select>
        </div>
    </div>
    <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="calNotes" placeholder="Optional notes" style="height:60px">${ev.notes||''}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-success" onclick="calSaveEvent(${isEdit?editIdx:'undefined'})">${isEdit?'\uD83D\uDCBE Update':'\uD83D\uDCBE Save Event'}</button>
        <button class="btn btn-ghost" onclick="document.getElementById('calEventFormArea').innerHTML=''">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function calTypeChanged(sel) {
    var slRow = document.getElementById('calSetlistRow');
    var vRow  = document.getElementById('calVenueRow');
    var isGig = sel.value === 'gig';
    if (slRow) slRow.style.display = isGig ? '' : 'none';
    if (vRow)  vRow.style.display  = isGig ? '' : 'none';
}

function calVenueSelected(sel) {
    var custom = document.getElementById('calVenueCustom');
    if (!custom) return;
    if (sel.value === '__other__') {
        custom.style.display = '';
        custom.focus();
        sel.value = '';
    } else {
        custom.style.display = 'none';
    }
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
        linkedSetlist: document.getElementById('calLinkedSetlist')?.value || null,
        venue: (document.getElementById('calVenue')?.value && document.getElementById('calVenue')?.value !== '__other__')
            ? document.getElementById('calVenue')?.value
            : (document.getElementById('calVenueCustom')?.value || null),
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
    // If this is a gig event, also sync to the Gigs page
    if (ev.type === 'gig') {
        const existingGigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        const gigKey = (ev.venue||'') + '|' + (ev.date||'');
        const existingIdx = existingGigs.findIndex(g => ((g.venue||'')+'|'+(g.date||'')) === gigKey);
        const gigRecord = {
            venue: ev.venue || ev.title || '',
            date: ev.date || '',
            startTime: ev.time || '',
            notes: ev.notes || '',
            linkedSetlist: ev.linkedSetlist || '',
            updated: new Date().toISOString()
        };
        if (existingIdx >= 0) {
            existingGigs[existingIdx] = { ...existingGigs[existingIdx], ...gigRecord };
        } else {
            gigRecord.created = new Date().toISOString();
            existingGigs.push(gigRecord);
        }
        await saveBandDataToDrive('_band', 'gigs', existingGigs);
    }
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

// ══ CARE PACKAGE SYSTEM ══════════════════════════════════════════════════════
// Builds a full pre-gig/rehearsal pack (setlist + charts + crib notes),
// stores it in Firebase, returns a short URL served by the Cloudflare Worker.
// Bandmates tap the link — standalone page, no login, no app required.

var WORKER_BASE = 'https://deadcetera-proxy.drewmerrill.workers.dev';

// Main entry: called from Notifications page
async function carePackageSend(type, preselectedSlIdx) {
    // type = 'rehearsal' | 'gig'
    var modal = document.getElementById('carePackageModal');
    if (modal) { modal.remove(); }

    // Build picker modal
    var m = document.createElement('div');
    m.id = 'carePackageModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center';

    var typeLabel = type === 'gig' ? '🎤 Gig Pack' : '🎸 Rehearsal Pack';
    var typeColor = type === 'gig' ? '#f59e0b' : '#818cf8';

    m.innerHTML = `
    <div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-weight:800;font-size:1em;color:${typeColor}">${typeLabel}</div>
        <button onclick="document.getElementById('carePackageModal').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer">×</button>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:0.8em;color:#64748b;display:block;margin-bottom:6px">Select Setlist</label>
        <select id="cpSetlistPicker" class="app-select" style="width:100%"><option value="">Loading...</option></select>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:0.8em;color:#64748b;display:block;margin-bottom:6px">Add a note (optional)</label>
        <input id="cpNote" class="app-input" placeholder="e.g. Bring your A-game — Dark Star is in the set" style="width:100%;font-size:0.88em">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:0.8em;color:#64748b;display:block;margin-bottom:6px">Include crib notes for each member?</label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88em">
          <input type="checkbox" id="cpIncludeCribs" checked style="width:16px;height:16px">
          Yes — each bandmate sees their own crib notes
        </label>
      </div>
      <button onclick="carePackageBuild('${type}')" style="width:100%;background:linear-gradient(135deg,${typeColor},rgba(255,255,255,0.8));background:${type==='gig'?'rgba(245,158,11,0.2)':'rgba(129,140,248,0.2)'};border:1px solid ${type==='gig'?'rgba(245,158,11,0.4)':'rgba(129,140,248,0.4)'};color:${typeColor};padding:12px;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;margin-bottom:8px" id="cpBuildBtn">
        📦 Build & Send Care Package
      </button>
      <p style="font-size:0.72em;color:#475569;text-align:center">Loads all charts from Firebase → stores pack → sends SMS with tap-to-open link</p>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });

    // Populate setlist picker
    try {
        var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        var sel = document.getElementById('cpSetlistPicker');
        if (setlists.length === 0) {
            sel.innerHTML = '<option value="">No setlists yet — build one first</option>';
        } else {
            sel.innerHTML = setlists.map(function(sl, i) {
                return '<option value="' + i + '">' + (sl.name || 'Setlist ' + (i+1)) + (sl.date ? ' — ' + sl.date : '') + '</option>';
            }).join('');
            // Pre-select if called from setlist editor
            if (preselectedSlIdx !== undefined && sel.options[preselectedSlIdx]) {
                sel.selectedIndex = preselectedSlIdx;
            }
        }
    } catch(e) {
        document.getElementById('cpSetlistPicker').innerHTML = '<option value="">Error loading setlists</option>';
    }
}

async function carePackageBuild(type) {
    var btn = document.getElementById('cpBuildBtn');
    var slIdx = parseInt(document.getElementById('cpSetlistPicker')?.value);
    var note = (document.getElementById('cpNote')?.value || '').trim();
    var includeCribs = document.getElementById('cpIncludeCribs')?.checked;

    if (isNaN(slIdx)) { showToast('Select a setlist first'); return; }

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading charts...'; }

    try {
        var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        var sl = setlists[slIdx];
        if (!sl) { showToast('Setlist not found'); return; }

        // Load songs + charts using existing parachute loader
        var songs = await parachuteLoadSetlistData(sl);

        // Optionally load crib notes per member per song
        if (includeCribs) {
            if (btn) btn.textContent = '⏳ Loading crib notes...';
            await Promise.all(songs.map(async function(s) {
                s.cribs = {};
                try {
                    var path = bandPath('songs/' + sanitizeFirebasePath(s.title) + '/personal_tabs');
                    var snap = await firebaseDB.ref(path).once('value');
                    var tabs = snap.val();
                    if (tabs && Array.isArray(tabs)) {
                        var emailToKey = {
                            'drewmerrill1029@gmail.com':'drew','cmjalbert@gmail.com':'chris',
                            'brian@hrestoration.com':'brian','pierce.d.hale@gmail.com':'pierce',
                            'jnault@fegholdings.com':'jay'
                        };
                        tabs.forEach(function(tab) {
                            var mKey = tab.memberKey || emailToKey[tab.addedBy] || null;
                            if (mKey && tab.notes) s.cribs[mKey] = tab.notes;
                        });
                    }
                } catch(e) {}
            }));
        }

        // Build pack object
        var packId = 'pack_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
        var expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(); // 14 days
        var pack = {
            name: sl.name || 'Setlist',
            date: sl.date || '',
            type: type,
            note: note,
            songs: songs,
            createdBy: currentUserEmail || 'band',
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt
        };

        if (btn) btn.textContent = '⏳ Saving to Firebase...';

        // Save to Firebase — two paths:
        // 1. Band-scoped path (for band record-keeping)
        var fbPath = bandPath('care_packages/' + packId);
        await firebaseDB.ref(fbPath).set(pack);
        // 2. Public top-level path — readable by Cloudflare Worker without auth
        //    Firebase rules: /care_packages_public/{packId} .read: true
        try { await firebaseDB.ref('care_packages_public/' + packId).set(pack); }
        catch(epub) { console.warn('Public pack path failed (check Firebase rules):', epub.message); }

        // Build the URL — worker serves GET /pack/:id
        var packUrl = WORKER_BASE + '/pack/' + packId;

        // Close builder modal
        document.getElementById('carePackageModal')?.remove();

        // Show send modal with URL + per-member links
        carePackageShowSendModal(pack, packId, packUrl);

    } catch(e) {
        showToast('Error building pack: ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '📦 Build & Send Care Package'; }
    }
}

function carePackageShowSendModal(pack, packId, packUrl) {
    var m = document.createElement('div');
    m.id = 'carePackageSendModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center';

    var typeLabel = pack.type === 'gig' ? '🎤 Gig Pack' : '🎸 Rehearsal Pack';
    var typeColor = pack.type === 'gig' ? '#f59e0b' : '#818cf8';

    // Per-member personal links (adds ?m=memberKey so they see their crib notes)
    var memberKeys = ['drew','chris','brian','pierce','jay'];
    var memberNames = {drew:'Drew',chris:'Chris',brian:'Brian',pierce:'Pierce',jay:'Jay'};
    var memberLinks = memberKeys.map(function(k) {
        return {key:k, name:memberNames[k], url: packUrl + '?m=' + k};
    });

    var memberLinkHtml = memberLinks.map(function(ml) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">' +
            '<span style="font-size:0.85em;flex:1;color:#cbd5e1">' + ml.name + '</span>' +
            '<button onclick="cpCopyLink(\'' + ml.url + '\')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#64748b;padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer">📋</button>' +
            '<button onclick="cpTextMember(\'' + ml.key + '\',\'' + packUrl + '\')" style="background:rgba(129,140,248,0.1);border:1px solid rgba(129,140,248,0.2);color:#a5b4fc;padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer">💬 Text</button>' +
            '</div>';
    }).join('');

    var expiryLabel = new Date(pack.expiresAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});

    m.innerHTML = `
    <div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-weight:800;color:#22c55e">✅ Pack Ready!</div>
        <button onclick="document.getElementById('carePackageSendModal').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer">×</button>
      </div>
      <div style="font-size:0.8em;color:#64748b;margin-bottom:14px">${typeLabel} · Expires ${expiryLabel}</div>

      <!-- Universal link -->
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div style="font-size:0.7em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Universal Link (no login)</div>
        <div style="font-size:0.72em;color:#818cf8;word-break:break-all;margin-bottom:8px">${packUrl}</div>
        <div style="display:flex;gap:6px">
          <button onclick="cpCopyLink('${packUrl}')" style="flex:1;background:rgba(129,140,248,0.15);border:1px solid rgba(129,140,248,0.3);color:#a5b4fc;padding:7px;border-radius:8px;font-size:0.82em;font-weight:700;cursor:pointer">📋 Copy</button>
          <button onclick="cpSMSAll('${packUrl}','${pack.name}','${pack.date||''}')" style="flex:1;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:7px;border-radius:8px;font-size:0.82em;font-weight:700;cursor:pointer">💬 Text Everyone</button>
        </div>
      </div>

      <!-- Per-member links -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px;margin-bottom:16px">
        <div style="font-size:0.7em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Personal Links (includes their crib notes)</div>
        ${memberLinkHtml}
      </div>

      <button onclick="document.getElementById('carePackageSendModal').remove()" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:10px;border-radius:12px;font-size:0.85em;cursor:pointer">Done</button>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
}

function cpCopyLink(url) {
    navigator.clipboard.writeText(url).then(function() {
        showToast('📋 Link copied!');
    }).catch(function() {
        prompt('Copy this link:', url);
    });
}

async function cpSMSAll(packUrl, slName, slDate) {
    var phones = await notifGetAllPhones();
    var label = slName + (slDate ? ' — ' + slDate : '');
    var msg = '🎸 GrooveLinx Care Package: ' + label + '\n\nEverything you need — setlist, charts, your crib notes. No app login needed.\n\nTap to open: ' + packUrl;
    if (phones.length === 0) {
        notifShowSMSCopyModal(msg, 'No phone numbers saved yet — add them in the Band Contact Directory.');
        return;
    }
    notifSendSMS(phones, msg);
}

async function cpTextMember(memberKey, basePackUrl) {
    var contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    var contact = contacts[memberKey];
    var phone = contact && contact.phone;
    var name = {drew:'Drew',chris:'Chris',brian:'Brian',pierce:'Pierce',jay:'Jay'}[memberKey] || memberKey;
    var personalUrl = basePackUrl + '?m=' + memberKey;
    var msg = 'Hey ' + name + '! 🎸 Here\'s your personalized GrooveLinx care package — setlist, charts, and your crib notes all in one tap:\n\n' + personalUrl;
    if (!phone) {
        notifShowSMSCopyModal(msg, name + '\'s phone number isn\'t saved yet. Message copied — paste it into your text app.');
        return;
    }
    window.open('sms:' + phone + '?body=' + encodeURIComponent(msg));
}


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
                <h3 style="margin:0 0 4px 0">📲 Install GrooveLinx App</h3>
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


    <!-- CARE PACKAGE -->
    <div class="app-card" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(102,126,234,0.1),rgba(16,185,129,0.06));border-color:rgba(102,126,234,0.3)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span style="font-size:2em">🪂</span>
            <div>
                <h3 style="margin:0;color:#a5b4fc">Send Care Package</h3>
                <p style="color:var(--text-dim);font-size:0.8em;margin:3px 0 0">One tap → your bandmates get every chart, key, BPM &amp; their crib notes. No app. No login.</p>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <button onclick="carePackageSend('rehearsal')" style="background:rgba(129,140,248,0.12);border:1px solid rgba(129,140,248,0.3);color:#a5b4fc;padding:12px 8px;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;text-align:center">
                <div style="font-size:1.4em;margin-bottom:4px">🎸</div>
                <div>Rehearsal Pack</div>
                <div style="font-size:0.72em;color:#64748b;margin-top:2px;font-weight:400">Charts + crib notes</div>
            </button>
            <button onclick="carePackageSend('gig')" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;padding:12px 8px;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;text-align:center">
                <div style="font-size:1.4em;margin-bottom:4px">🎤</div>
                <div>Gig Pack</div>
                <div style="font-size:0.72em;color:#64748b;margin-top:2px;font-weight:400">Full setlist + all charts</div>
            </button>
        </div>
        <div style="font-size:0.72em;color:#475569;display:flex;gap:12px;flex-wrap:wrap">
            <span>✓ Personalized per member</span>
            <span>✓ No app required</span>
            <span>✓ Expires in 14 days</span>
        </div>
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
            title: 'GrooveLinx — Where Bands Lock In',
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
    const msg = `🎸 Hey! Here\'s the GrooveLinx band app — add it to your home screen so you always have it:\n\n${url}\n\n📱 iPhone (Safari only — not Chrome):\n1. Open the link in Safari\n2. Tap the Share button (□↑) at the bottom\n3. Tap "Add to Home Screen"\n4. Make sure "Open as Web App" is ON ✅\n5. Tap Add\n\n🤖 Android (Chrome):\n1. Open the link in Chrome\n2. Tap the Install banner that appears, OR tap ⋮ menu → "Add to Home screen"\n3. Tap Install\n\nOpens like a real app — no browser bar, works offline!`;
    if (phones.length === 0) {
        notifShowSMSCopyModal(msg, 'Add phone numbers in the Band Contact Directory to auto-fill recipients.');
        return;
    }
    notifSendSMS(phones, msg);
}

function notifTextOne(phone, name) {
    const appUrl = window.location.href.split('?')[0];
    const msg = `Hey ${name}! 🎸 Check the GrooveLinx app for updates: ${appUrl}`;
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

// ══════════════════════════════════════════════════════════════════════════
// CARE PACKAGE SYSTEM
// Curated, server-rendered gig/rehearsal pack delivered via SMS.
// Flow: buildPack → save to Firebase → worker serves /pack/:id → SMS link
// ══════════════════════════════════════════════════════════════════════════

var WORKER_URL = 'https://deadcetera-proxy.drewmerrill.workers.dev';
var FIREBASE_DB_URL = 'https://deadcetera-35424-default-rtdb.firebaseio.com';

// ── Unique pack ID generator ──────────────────────────────────────────────
function carePackageGenId() {
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/O/1/I confusion
    var id = '';
    for (var i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

// ── Load all data for a setlist (charts + key/bpm + crib notes per member) ─
async function carePackageLoadSongs(sl) {
    var songs = [];
    (sl.sets || []).forEach(function(set, si) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : item.title;
            if (t) songs.push({
                title: t,
                setName: set.name || 'Set ' + (si + 1),
                key: '',
                bpm: '',
                chart: '',
                cribs: {},
                segue: typeof item === 'object' ? (item.segue || 'stop') : 'stop'
            });
        });
    });

    // Load key/bpm + chart + crib notes for each song in parallel
    await Promise.all(songs.map(async function(s) {
        // Key + BPM from allSongs cache
        var sd = allSongs.find(function(a) { return a.title === s.title; });
        s.key = sd && sd.key ? sd.key : '';
        s.bpm = sd && sd.bpm ? String(sd.bpm) : '';

        // Chord chart
        try {
            var cd = await loadBandDataFromDrive(s.title, 'chart');
            if (cd && cd.text && cd.text.trim()) s.chart = cd.text.trim();
        } catch (e) {}

        // Crib notes: personal tabs text per member
        try {
            var tabs = await loadPersonalTabs(s.title) || [];
            tabs.forEach(function(tab) {
                var mk = tab.memberKey;
                if (mk && tab.notes) {
                    if (!s.cribs[mk]) s.cribs[mk] = '';
                    s.cribs[mk] += (s.cribs[mk] ? '\n' : '') + (tab.label ? tab.label + ': ' : '') + tab.notes;
                }
            });
        } catch (e) {}
    }));

    return songs;
}

// ── Save pack to Firebase ─────────────────────────────────────────────────
async function carePackageSave(packData) {
    var packId = carePackageGenId();
    var path = bandPath('care_packages/' + packId);
    await firebaseDB.ref(path).set(packData);

    // Also write to public node (no bandPath prefix) so worker can read it
    // Worker reads /bands/deadcetera/care_packages/:id
    var publicPath = 'bands/deadcetera/care_packages/' + packId;
    await firebaseDB.ref(publicPath).set(packData);

    return packId;
}

// ── Main entry: show the care package send modal ──────────────────────────
async function carePackageShowModal() {
    var existing = document.getElementById('carePackageModal');
    if (existing) existing.remove();

    // Load setlists + calendar events for pickers
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    var today = new Date().toISOString().split('T')[0];
    var upcoming = events.filter(function(e) { return (e.type === 'rehearsal' || e.type === 'gig') && e.date >= today; })
        .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

    var modal = document.createElement('div');
    modal.id = 'carePackageModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5100;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center';

    var slOptions = setlists.map(function(sl, i) {
        return '<option value="' + i + '">' + (sl.name || 'Untitled Setlist') + (sl.date ? ' — ' + sl.date : '') + '</option>';
    }).join('');

    var eventOptions = upcoming.length
        ? upcoming.map(function(e) {
            var icon = e.type === 'gig' ? '🎤' : '🎸';
            return '<option value="' + e.date + '">' + icon + ' ' + (e.title || e.type) + ' — ' + e.date + '</option>';
          }).join('')
        : '<option value="">No upcoming events</option>';

    modal.innerHTML = '<div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        '<div>' +
        '<div style="font-weight:800;font-size:1.05em">🪂 Send Care Package</div>' +
        '<div style="font-size:0.75em;color:#64748b;margin-top:2px">Delivers charts + crib notes to the whole band — no app needed</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'carePackageModal\').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1em;flex-shrink:0">×</button>' +
        '</div>' +

        '<div style="display:flex;flex-direction:column;gap:12px">' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Type</label>' +
        '<div style="display:flex;gap:8px">' +
        '<button id="cpTypeRehearsal" onclick="cpSetType(\'rehearsal\')" style="flex:1;padding:8px;border-radius:8px;font-size:0.85em;font-weight:600;cursor:pointer;background:rgba(129,140,248,0.2);border:1px solid rgba(129,140,248,0.4);color:#a5b4fc">🎸 Rehearsal</button>' +
        '<button id="cpTypeGig" onclick="cpSetType(\'gig\')" style="flex:1;padding:8px;border-radius:8px;font-size:0.85em;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#64748b">🎤 Gig</button>' +
        '</div>' +
        '</div>' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Setlist</label>' +
        '<select id="cpSetlistPicker" class="app-select" style="width:100%;font-size:0.88em">' +
        (slOptions || '<option value="">No setlists yet</option>') +
        '</select>' +
        '</div>' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Event (optional)</label>' +
        '<select id="cpEventPicker" class="app-select" style="width:100%;font-size:0.88em">' +
        '<option value="">None</option>' +
        eventOptions +
        '</select>' +
        '</div>' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Message to band (optional)</label>' +
        '<textarea id="cpNote" class="app-textarea" rows="2" placeholder="e.g. Heads up — new set order, check the charts!" style="font-size:0.85em;resize:none"></textarea>' +
        '</div>' +

        '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:10px 12px;font-size:0.78em;color:#fbbf24">' +
        '🪂 Each bandmate gets a personalized SMS with their crib notes highlighted. The link works in any browser — no app, no login.' +
        '</div>' +

        '<button id="cpSendBtn" onclick="carePackageBuild()" style="background:linear-gradient(135deg,#667eea,#764ba2);border:none;color:white;padding:13px;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;width:100%">🪂 Build &amp; Send Care Package</button>' +
        '</div></div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    window._cpType = 'rehearsal';
}

function cpSetType(type) {
    window._cpType = type;
    var rBtn = document.getElementById('cpTypeRehearsal');
    var gBtn = document.getElementById('cpTypeGig');
    if (type === 'rehearsal') {
        rBtn.style.cssText += ';background:rgba(129,140,248,0.2);border:1px solid rgba(129,140,248,0.4);color:#a5b4fc';
        gBtn.style.cssText += ';background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#64748b';
    } else {
        gBtn.style.cssText += ';background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);color:#fbbf24';
        rBtn.style.cssText += ';background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#64748b';
    }
}

// ── Build the pack, save it, send SMS to each member ──────────────────────
async function carePackageBuild() {
    var btn = document.getElementById('cpSendBtn');
    if (btn) { btn.textContent = '⏳ Loading charts...'; btn.disabled = true; }

    try {
        var slIdx = parseInt(document.getElementById('cpSetlistPicker')?.value || '0');
        var eventDate = document.getElementById('cpEventPicker')?.value || '';
        var note = (document.getElementById('cpNote')?.value || '').trim();
        var type = window._cpType || 'rehearsal';

        var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        var sl = setlists[slIdx];
        if (!sl) { showToast('No setlist selected'); return; }

        if (btn) btn.textContent = '⏳ Loading songs & charts...';
        var songs = await carePackageLoadSongs(sl);

        var expires = new Date();
        expires.setDate(expires.getDate() + 14); // 14-day link

        var packData = {
            name: sl.name || 'Setlist',
            date: sl.date || eventDate || '',
            type: type,
            note: note,
            songs: songs,
            createdBy: currentUserEmail || 'unknown',
            createdAt: new Date().toISOString(),
            expiresAt: expires.toISOString()
        };

        if (btn) btn.textContent = '⏳ Saving to Firebase...';
        var packId = await carePackageSave(packData);
        var baseUrl = WORKER_URL + '/pack/' + packId;

        if (btn) btn.textContent = '⏳ Building SMS messages...';

        // Send a personalized SMS to each band member
        var contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
        var membersSent = 0;

        // Collect all members with phones
        var recipients = [];
        Object.keys(bandMembers).forEach(function(mk) {
            var contact = contacts[mk];
            var member = bandMembers[mk];
            if (contact && contact.phone) {
                recipients.push({ key: mk, name: member.name || mk, phone: contact.phone });
            }
        });

        // Also extra contacts
        Object.entries(contacts).forEach(function(pair) {
            var k = pair[0], c = pair[1];
            if (!bandMembers[k] && c.phone) {
                recipients.push({ key: k, name: c.name || k, phone: c.phone });
            }
        });

        document.getElementById('carePackageModal')?.remove();

        if (recipients.length === 0) {
            // No phone numbers — show the link to copy manually
            carePackageShowLinkModal(baseUrl, packData);
            return;
        }

        // Show the delivery modal with per-member SMS openers
        carePackageShowDeliveryModal(baseUrl, packData, recipients, packId);

    } catch (e) {
        showToast('Error building pack: ' + e.message);
        if (btn) { btn.textContent = '🪂 Build & Send Care Package'; btn.disabled = false; }
    }
}

// ── Delivery modal: per-member SMS buttons ────────────────────────────────
function carePackageShowDeliveryModal(baseUrl, packData, recipients, packId) {
    var existing = document.getElementById('cpDeliveryModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'cpDeliveryModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5200;background:rgba(0,0,0,0.8);display:flex;align-items:flex-end;justify-content:center';

    var typeLabel = packData.type === 'gig' ? '🎤 Gig Pack' : '🎸 Rehearsal Pack';
    var packName = packData.name + (packData.date ? ' — ' + packData.date : '');

    var recipientBtns = recipients.map(function(r) {
        var memberUrl = baseUrl + '?m=' + encodeURIComponent(r.key);
        var msg = carePackageBuildSMS(r.name, packData, memberUrl);
        var encodedMsg = encodeURIComponent(msg);
        var smsHref = 'sms:' + r.phone + '?body=' + encodedMsg;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px">' +
            '<div>' +
            '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0">' + r.name + '</div>' +
            '<div style="font-size:0.7em;color:#475569">' + r.phone + '</div>' +
            '</div>' +
            '<a href="' + smsHref + '" style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#86efac;padding:6px 14px;border-radius:8px;font-size:0.82em;font-weight:700;text-decoration:none;flex-shrink:0">💬 Text</a>' +
            '</div>';
    }).join('');

    // "Text everyone at once" button
    var allPhones = recipients.map(function(r) { return r.phone; }).join(',');
    var groupMsg = carePackageBuildSMS('everyone', packData, baseUrl);
    var groupSms = 'sms:' + allPhones + '?body=' + encodeURIComponent(groupMsg);

    modal.innerHTML = '<div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
        '<div style="font-weight:800;font-size:1em">✅ Care Package Ready</div>' +
        '<button onclick="document.getElementById(\'cpDeliveryModal\').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1em">×</button>' +
        '</div>' +
        '<div style="font-size:0.78em;color:#64748b;margin-bottom:14px">' + typeLabel + ' — ' + packName + '</div>' +

        '<div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:0.78em">' +
        '<div style="font-size:0.7em;color:#818cf8;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Pack Link</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<code style="color:#94a3b8;font-size:0.85em;flex:1;word-break:break-all">' + baseUrl + '</code>' +
        '<button onclick="navigator.clipboard.writeText(\'' + baseUrl + '\').then(function(){showToast(\'Copied!\')})" style="background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);color:#a5b4fc;padding:4px 10px;border-radius:6px;font-size:0.75em;cursor:pointer;flex-shrink:0;white-space:nowrap">Copy</button>' +
        '</div>' +
        '</div>' +

        '<div style="margin-bottom:12px">' +
        '<a href="' + groupSms + '" style="display:block;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px;border-radius:12px;text-align:center;font-weight:700;font-size:0.9em;text-decoration:none;margin-bottom:8px">💬 Text Everyone at Once</a>' +
        '<div style="font-size:0.72em;color:#475569;text-align:center">Opens group text with the care package link</div>' +
        '</div>' +

        '<div style="font-size:0.72em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Or text individually (personalized with their crib notes):</div>' +

        '<div style="display:flex;flex-direction:column;gap:6px">' + recipientBtns + '</div>' +

        '<div style="margin-top:14px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.72em;color:#475569">' +
        '🔗 Link stays active for 14 days — works on any phone, no login needed.' +
        '</div>' +
        '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

// ── Build the SMS message body ────────────────────────────────────────────
function carePackageBuildSMS(recipientName, packData, packUrl) {
    var typeEmoji = packData.type === 'gig' ? '🎤' : '🎸';
    var greeting = recipientName === 'everyone' ? 'Hey band' : 'Hey ' + recipientName.split(' ')[0];
    var eventLine = packData.date ? ' for ' + packData.date : '';
    var noteLine = packData.note ? '\n\n' + packData.note : '';
    var songCount = (packData.songs || []).length;

    return greeting + ' —' + noteLine + '\n\n' +
        typeEmoji + ' ' + (packData.type === 'gig' ? 'Gig' : 'Rehearsal') + ' care package' + eventLine + ' is ready:\n' +
        packData.name + ' (' + songCount + ' songs)\n\n' +
        'Tap to see charts, key/BPM, and your crib notes — no login needed:\n' +
        packUrl + '\n\n' +
        '— GrooveLinx 🎸';
}

// ── Fallback: no phones saved, just show the link ─────────────────────────
function carePackageShowLinkModal(baseUrl, packData) {
    showToast('Pack saved! No phone numbers found — copy the link below.');
    var modal = document.createElement('div');
    modal.id = 'cpLinkModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5200;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:400px;width:100%">' +
        '<div style="font-weight:800;margin-bottom:8px">🪂 Care Package Ready</div>' +
        '<div style="font-size:0.78em;color:#64748b;margin-bottom:12px">Share this link — works on any phone, no login needed:</div>' +
        '<code style="display:block;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;font-size:0.78em;color:#a5b4fc;word-break:break-all;margin-bottom:12px">' + baseUrl + '</code>' +
        '<div style="display:flex;gap:8px">' +
        '<button onclick="navigator.clipboard.writeText(\'' + baseUrl + '\').then(function(){showToast(\'Copied!\')})" style="flex:1;background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.4);color:#a5b4fc;padding:10px;border-radius:10px;font-size:0.88em;font-weight:700;cursor:pointer">📋 Copy Link</button>' +
        '<button onclick="document.getElementById(\'cpLinkModal\').remove()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer">Close</button>' +
        '</div>' +
        '<div style="margin-top:12px;font-size:0.7em;color:#475569">Add phone numbers in Band Contact Directory to auto-text next time.</div>' +
        '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
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
        new Notification(`🔗 GrooveLinx: ${title}`, { body, icon: '/favicon.ico', tag: eventType });
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
    const full = `🔗 GrooveLinx: ${msg}\n\n📱 ${appUrl}`;
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
            <strong style="color:var(--accent-light)">⚡ Pro tip:</strong> Since GrooveLinx is on GitHub Pages, <strong>auto-publishing</strong> to social platforms requires a paid tool like Buffer ($6/mo) or Later (free tier). 
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
// ══ GIGS MAP ════════════════════════════════════════════════════════════════
// Interactive map of all gig venues with filter, info cards, and directions

// _gigsMap, _gigsMapMarkers, _gigsMapInfoWindows, _gigsMapFilter state vars,
// renderGigsMap(), _gigsMapApplyFilter(), gigsMapSetFilter(),
// renderGigsPage(), gigLaunchLinkedSetlist(), loadGigs(), addGig(),
// gigVenueSelected(), _syncGigToCalendar(), saveGig(), seedGigData()
// → js/features/gigs.js

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

// ============================================================================
// VENUE DIRECTIONS + LEAVE TIME CALC
// ============================================================================
var _venuesCache = [];
var DRIVE_BUFFER_MINS = 15; // buffer on top of drive time

async function venueGetDirections(venueIdx) {
    // Load venues if not cached
    if (!_venuesCache.length) {
        _venuesCache = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    }
    var venue = _venuesCache[venueIdx];
    if (!venue) return;
    var container = document.getElementById('vDirections_' + venueIdx);
    if (!container) return;

    container.innerHTML = '<div style="padding:10px;background:rgba(102,126,234,0.07);border:1px solid rgba(102,126,234,0.15);border-radius:10px">'
        + '<div style="font-size:0.85em;font-weight:700;color:#818cf8;margin-bottom:8px">🚗 Get Directions to ' + (venue.name||'Venue') + '</div>'
        + '<div id="vDirStatus_' + venueIdx + '" style="font-size:0.82em;color:#64748b">Loading…</div>'
        + '<div id="vDirResult_' + venueIdx + '" style="margin-top:8px"></div>'
        + '</div>';

    // Try geolocation first
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) { _venueCalcRoute(venueIdx, venue, pos.coords.latitude + ',' + pos.coords.longitude, true); },
            function(err) { _venuePromptAddress(venueIdx, venue); }
        );
    } else {
        _venuePromptAddress(venueIdx, venue);
    }
}

function _venuePromptAddress(venueIdx, venue) {
    var statusEl = document.getElementById('vDirStatus_' + venueIdx);
    var resultEl = document.getElementById('vDirResult_' + venueIdx);
    if (statusEl) statusEl.textContent = 'Enter your starting address:';
    if (resultEl) resultEl.innerHTML = '<div style="display:flex;gap:6px;margin-top:4px">'
        + '<input class="app-input" id="vDirFrom_' + venueIdx + '" placeholder="Your starting address…" style="flex:1;margin:0;font-size:0.85em">'
        + '<button onclick="_venueCalcRouteFromInput(' + venueIdx + ')" class="btn btn-sm btn-primary">Go</button>'
        + '</div>';
}

async function _venueCalcRouteFromInput(venueIdx) {
    if (!_venuesCache.length) {
        _venuesCache = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    }
    var venue = _venuesCache[venueIdx];
    var input = document.getElementById('vDirFrom_' + venueIdx);
    if (!input || !input.value.trim()) return;
    _venueCalcRoute(venueIdx, venue, input.value.trim(), false);
}

function _venueCalcRoute(venueIdx, venue, origin, fromGPS) {
    var statusEl = document.getElementById('vDirStatus_' + venueIdx);
    var resultEl = document.getElementById('vDirResult_' + venueIdx);
    if (statusEl) statusEl.textContent = 'Calculating route…';

    var mapsUrl = 'https://maps.google.com/maps?saddr=' + encodeURIComponent(fromGPS ? 'My+Location' : origin) + '&daddr=' + encodeURIComponent(venue.address||venue.name);
    var fallbackHtml = '<a href="' + mapsUrl + '" target="_blank" class="btn btn-sm btn-ghost">🗺 Open in Google Maps</a>';

    // Use DirectionsService (already loaded, key handled automatically, not deprecated)
    if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
        if (resultEl) resultEl.innerHTML = fallbackHtml;
        if (statusEl) statusEl.textContent = 'Tap to open in Google Maps:';
        return;
    }
    var dest = (venue.lat && venue.lng)
        ? { lat: parseFloat(venue.lat), lng: parseFloat(venue.lng) }
        : venue.address || venue.name;

    var svc = new google.maps.DirectionsService();
    svc.route({
        origin: origin,
        destination: dest,
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date(), trafficModel: 'bestguess' }
    }, function(result, status) {
        if (status !== 'OK' || !result.routes || !result.routes[0]) {
            if (resultEl) resultEl.innerHTML = '<a href="' + mapsUrl + '" target="_blank" class="btn btn-sm btn-ghost">🗺 Open in Google Maps</a>';
            if (statusEl) statusEl.textContent = 'Could not calculate route — tap to open:';
            return;
        }
        var leg = result.routes[0].legs[0];
        var driveMins = Math.ceil((leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value) / 60);
        var distText = leg.distance.text;
        var totalMins = driveMins + DRIVE_BUFFER_MINS;

        // Try to find nearest upcoming gig at this venue for arrival time
        var arrivalNote = '';
        if (statusEl) statusEl.textContent = '';

        var html = '<div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:10px 12px;font-size:0.85em">';
        html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">';
        html += '<span>🚗 <strong>' + driveMins + ' min</strong> drive (' + distText + ')</span>';
        html += '<span style="color:#f59e0b">⏱ +' + DRIVE_BUFFER_MINS + ' min buffer</span>';
        html += '</div>';

        // Leave time calculator
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
        html += '<span style="color:#94a3b8;font-size:0.9em">Arrive at:</span>';
        html += '<input type="time" id="vArriveTime_' + venueIdx + '" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#f1f5f9;padding:4px 8px;font-size:0.85em;font-family:inherit" onchange="_venueUpdateLeaveTime(' + venueIdx + ',' + totalMins + ')">';
        html += '</div>';
        html += '<div id="vLeaveTime_' + venueIdx + '" style="font-size:0.95em;font-weight:700;color:#22c55e;min-height:20px"></div>';
        html += '</div>';

        // Open in Maps link
        var mapsUrl = 'https://maps.google.com/maps?saddr=' + encodeURIComponent(fromGPS ? 'My+Location' : origin) + '&daddr=' + encodeURIComponent(venue.address||venue.name);
        html += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">';
        html += '<a href="' + mapsUrl + '" target="_blank" class="btn btn-sm btn-ghost">🗺 Open in Maps</a>';
        if (!fromGPS) {
            html += '<button onclick="_venuePromptAddress(' + venueIdx + ')" class="btn btn-sm btn-ghost">🔄 Different address</button>';
        } else {
            html += '<button onclick="_venuePromptAddress(' + venueIdx + ')" class="btn btn-sm btn-ghost">📍 Type address instead</button>';
        }
        html += '</div>';

        if (resultEl) resultEl.innerHTML = html;
    });
}

function _venueUpdateLeaveTime(venueIdx, totalMins) {
    var arrInput = document.getElementById('vArriveTime_' + venueIdx);
    var leaveEl  = document.getElementById('vLeaveTime_' + venueIdx);
    if (!arrInput || !leaveEl || !arrInput.value) return;
    var parts = arrInput.value.split(':');
    var h = parseInt(parts[0]), m = parseInt(parts[1]);
    var arrMins = h * 60 + m;
    var leaveMins = arrMins - totalMins;
    if (leaveMins < 0) leaveMins += 1440;
    var lh = Math.floor(leaveMins / 60) % 24;
    var lm = leaveMins % 60;
    var ampm = lh >= 12 ? 'PM' : 'AM';
    var lh12 = lh % 12 || 12;
    var lmStr = lm < 10 ? '0' + lm : lm;
    leaveEl.innerHTML = '🚪 Leave by: <span style="font-size:1.1em">' + lh12 + ':' + lmStr + ' ' + ampm + '</span>';
}

async function loadVenues() {
    const data = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    data.sort((a, b) => (a.name||'').localeCompare(b.name||''));
    const el = document.getElementById('venuesList');
    if (!el || data.length === 0) return;
    el.innerHTML = data.map((v, i) => `<div class="app-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <h3 style="margin-bottom:6px">${v.name || 'Unnamed'}</h3>
            <div style="display:flex;gap:4px;flex-shrink:0">
                ${v.website?`<a href="${v.website}" target="_blank" class="btn btn-sm btn-ghost" title="Website">🌐</a>`:''}
                ${v.address?`<button class="btn btn-sm btn-ghost" onclick="venueGetDirections(${i})" title="Get Directions">🚗 Directions</button>`:''}
                <button class="btn btn-sm btn-ghost" onclick="editVenue(${i})" title="Edit">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteVenue(${i})" title="Delete" style="color:var(--red,#f87171)">🗑️</button>
            </div>
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
        <div id="vDirections_${i}" style="margin-top:10px"></div>
    </div>`).join('');
}

async function editVenue(idx) {
    const data = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    const v = data[idx];
    if (!v) return;
    const el = document.getElementById('venuesList');
    el.innerHTML = `<div class="app-card">
        <h3>✏️ Edit Venue</h3>
        <div class="form-grid">
            <div class="form-row" style="grid-column:1/-1"><label class="form-label">Name</label><input class="app-input" id="vName" value="${(v.name||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row" style="grid-column:1/-1"><label class="form-label">Address</label><input class="app-input" id="vAddress" value="${(v.address||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Phone</label><input class="app-input" id="vPhone" value="${(v.phone||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Email</label><input class="app-input" id="vEmail" value="${(v.email||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Website</label><input class="app-input" id="vWebsite" value="${(v.website||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Capacity</label><input class="app-input" id="vCapacity" value="${(v.capacity||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Stage</label><input class="app-input" id="vStage" value="${(v.stage||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">PA System</label><input class="app-input" id="vPA" value="${(v.pA||v.pa||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Sound Person</label><input class="app-input" id="vSoundPerson" value="${(v.soundPerson||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Sound Phone</label><input class="app-input" id="vSoundPhone" value="${(v.soundPhone||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Venue Contact</label><input class="app-input" id="vContactName" value="${(v.contactName||v.contact||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Load-In</label><input class="app-input" id="vLoadIn" value="${(v.loadIn||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Parking</label><input class="app-input" id="vParking" value="${(v.parking||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Pay</label><input class="app-input" id="vPay" value="${(v.pay||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="vNotes">${v.notes||''}</textarea></div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-success" onclick="saveVenueEdit(${idx})">💾 Save</button>
            <button class="btn btn-ghost" onclick="loadVenues()">Cancel</button>
        </div>
    </div>`;
}

async function saveVenueEdit(idx) {
    const data = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    const vNameEl = document.getElementById('vName');
    const latLng = {};
    if (vNameEl && vNameEl.dataset.lat) {
        latLng.lat = parseFloat(vNameEl.dataset.lat);
        latLng.lng = parseFloat(vNameEl.dataset.lng);
    } else if (data[idx] && data[idx].lat) {
        // Preserve existing lat/lng if not re-searched
        latLng.lat = data[idx].lat;
        latLng.lng = data[idx].lng;
    }
    data[idx] = { ...data[idx],
        name:        document.getElementById('vName')?.value?.trim(),
        address:     document.getElementById('vAddress')?.value?.trim(),
        phone:       document.getElementById('vPhone')?.value,
        email:       document.getElementById('vEmail')?.value,
        website:     document.getElementById('vWebsite')?.value,
        capacity:    document.getElementById('vCapacity')?.value,
        stage:       document.getElementById('vStage')?.value,
        pA:          document.getElementById('vPA')?.value,
        soundPerson: document.getElementById('vSoundPerson')?.value,
        soundPhone:  document.getElementById('vSoundPhone')?.value,
        contactName: document.getElementById('vContactName')?.value,
        loadIn:      document.getElementById('vLoadIn')?.value,
        parking:     document.getElementById('vParking')?.value,
        pay:         document.getElementById('vPay')?.value,
        notes:       document.getElementById('vNotes')?.value,
        ...latLng,
        updated:     new Date().toISOString()
    };
    await saveBandDataToDrive('_band', 'venues', data);
    showToast('✅ Venue updated!');
    loadVenues();
}

async function deleteVenue(idx) {
    if (!confirm('Delete this venue?')) return;
    const data = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    data.splice(idx, 1);
    await saveBandDataToDrive('_band', 'venues', data);
    showToast('🗑️ Venue deleted');
    loadVenues();
}

function addVenue() {
    const el = document.getElementById('venuesList');
    el.innerHTML = `<div class="app-card" id="addVenueCard">
        <h3>🏛️ Add Venue</h3>
        <div style="margin-bottom:14px;padding:12px;background:rgba(102,126,234,0.07);border:1px solid rgba(102,126,234,0.2);border-radius:10px">
            <label class="form-label" style="margin-bottom:6px;display:block">🔍 Search Google Places (autofills everything)</label>
            <input class="app-input" id="vPlacesSearch" placeholder="Start typing a venue name or address…" autocomplete="off" style="width:100%;box-sizing:border-box">
            <div style="font-size:0.72em;color:#64748b;margin-top:4px">Powered by Google Places — tap a suggestion to autofill the form below</div>
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
    // Init Places Autocomplete after render
    requestAnimationFrame(function() { vInitPlacesAutocomplete(); });
}

function vInitPlacesAutocomplete() {
    var input = document.getElementById('vPlacesSearch');
    if (!input) return;
    if (!window.google || !window.google.maps || !window.google.maps.places) {
        input.placeholder = 'Google Maps not loaded — fill fields manually';
        return;
    }
    var ac = new google.maps.places.Autocomplete(input, {
        types: ['establishment'],
        fields: ['name','formatted_address','formatted_phone_number','website','geometry']
    });
    ac.addListener('place_changed', function() {
        var place = ac.getPlace();
        if (!place) return;
        var setVal = function(id, val) {
            var el = document.getElementById(id);
            if (el && val) el.value = val;
        };
        setVal('vName',    place.name || '');
        setVal('vAddress', place.formatted_address || '');
        setVal('vPhone',   place.formatted_phone_number || '');
        setVal('vWebsite', place.website || '');
        // Store placeId for later directions use
        if (place.geometry && place.geometry.location) {
            var inp = document.getElementById('vName');
            if (inp) {
                inp.dataset.lat = place.geometry.location.lat();
                inp.dataset.lng = place.geometry.location.lng();
            }
        }
        // Scroll to form
        var card = document.getElementById('addVenueCard');
        if (card) card.scrollIntoView({behavior:'smooth', block:'start'});
    });
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
    // Save lat/lng if autofilled from Places
    const vNameEl = document.getElementById('vName');
    if (vNameEl && vNameEl.dataset.lat) {
        v.lat = parseFloat(vNameEl.dataset.lat);
        v.lng = parseFloat(vNameEl.dataset.lng);
    }
    if (!v.name) { alert('Venue name required'); return; }
    const existing = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    existing.push(v);
    await saveBandDataToDrive('_band', 'venues', existing);
    showToast('✅ Venue saved!');
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
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="addTransaction()">+ Add Transaction</button>
        <button class="btn btn-ghost" onclick="setStartingBalance()">💵 Starting Balance</button>
    </div>
    <div id="finStartBalDisplay"></div>
    <div class="app-card"><h3>Transactions</h3><div id="finTransactions"><div style="text-align:center;padding:20px;color:var(--text-dim)">No transactions yet.</div></div></div>`;
    loadFinances();
}

async function loadFinances() {
    const data = toArray(await loadBandDataFromDrive('_band', 'finances') || []);
    const meta = await loadBandDataFromDrive('_band', 'finances_meta') || {};
    const startBal = parseFloat(meta.startingBalance) || 0;
    const el = document.getElementById('finTransactions');
    if (!el) return;
    let totalIn = 0, totalOut = 0;
    data.forEach(t => { if (t.type === 'income') totalIn += parseFloat(t.amount) || 0; else totalOut += parseFloat(t.amount) || 0; });
    document.getElementById('finTotalIncome').textContent = '$' + totalIn.toFixed(2);
    document.getElementById('finTotalExpenses').textContent = '$' + totalOut.toFixed(2);
    const bal = startBal + totalIn - totalOut;
    const balEl = document.getElementById('finBalance');
    balEl.textContent = (bal >= 0 ? '$' : '-$') + Math.abs(bal).toFixed(2);
    balEl.style.color = bal >= 0 ? 'var(--green)' : 'var(--red)';
    var sbDisp = document.getElementById('finStartBalDisplay');
    if (sbDisp) {
        if (startBal !== 0) {
            sbDisp.innerHTML = '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:10px;padding:6px 10px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px">💵 Starting balance: <strong style="color:var(--text)">$' + startBal.toFixed(2) + '</strong> <span style="opacity:0.5">(set ' + (meta.startingBalanceDate || '') + ')</span></div>';
        } else { sbDisp.innerHTML = ''; }
    }
    if (data.length === 0) return;
    data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    el.innerHTML = '<div style="display:grid;grid-template-columns:90px 1fr 80px 70px;gap:6px;padding:6px 10px;font-size:0.7em;color:var(--text-dim);font-weight:600;text-transform:uppercase"><span>Date</span><span>Description</span><span>Amount</span><span></span></div>' +
        data.map(function(t, idx) { return '<div style="display:grid;grid-template-columns:90px 1fr 80px 70px;gap:6px;padding:8px 10px;font-size:0.85em;border-bottom:1px solid var(--border);align-items:center"><span style="color:var(--text-dim)">' + (t.date || '') + '</span><span>' + (t.description || '') + '</span><span style="color:' + (t.type==='income'?'var(--green)':'var(--red)') + ';font-weight:600">' + (t.type==='income'?'+':'-') + '$' + parseFloat(t.amount||0).toFixed(2) + '</span><span style="display:flex;align-items:center;gap:4px"><span style="font-size:0.75em;color:var(--text-dim)">' + (t.category || '') + '</span><button onclick="deleteTransaction(' + idx + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.85em;padding:2px" title="Delete">🗑️</button></span></div>'; }).join('');
}

async function setStartingBalance() {
    var meta = await loadBandDataFromDrive('_band', 'finances_meta') || {};
    var current = meta.startingBalance || '';
    var el = document.getElementById('finStartBalDisplay');
    if (!el) return;
    el.innerHTML = '<div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;margin-bottom:10px"><div style="font-weight:600;font-size:0.9em;margin-bottom:8px">💵 Set Starting Balance</div><div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Enter the amount your band fund started with before tracking transactions here.</div><div class="form-grid"><div class="form-row"><label class="form-label">Amount ($)</label><input class="app-input" id="finStartBal" type="number" step="0.01" placeholder="0.00" value="' + current + '"></div></div><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" onclick="saveStartingBalance()">💾 Save</button><button class="btn btn-ghost" onclick="loadFinances()">Cancel</button></div></div>';
}

async function saveStartingBalance() {
    var val = document.getElementById('finStartBal')?.value;
    if (val === '' || val === undefined) { showToast('Enter an amount'); return; }
    var meta = await loadBandDataFromDrive('_band', 'finances_meta') || {};
    meta.startingBalance = val;
    meta.startingBalanceDate = new Date().toISOString().split('T')[0];
    meta.setBy = currentUserEmail;
    await saveBandDataToDrive('_band', 'finances_meta', meta);
    showToast('✅ Starting balance set!');
    loadFinances();
}

async function deleteTransaction(index) {
    var existing = toArray(await loadBandDataFromDrive('_band', 'finances') || []);
    if (index < 0 || index >= existing.length) return;
    existing.splice(index, 1);
    await saveBandDataToDrive('_band', 'finances', existing);
    showToast('🗑️ Transaction deleted');
    loadFinances();
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
// BEST SHOT vs NORTH STAR — Side by Side with Section Ratings
// ============================================================================

// ── Song Detail: Side-by-Side View ──────────────────────────────────────────
async function renderBestShotVsNorthStar(songTitle) {
    var container = document.getElementById('bestShotVsNorthStar');
    if (!container) return;

    // Load data in parallel
    var [refVersions, shots, structure, ratings, sectionNotes] = await Promise.all([
        loadRefVersions(songTitle),
        loadBandDataFromDrive(songTitle, 'best_shot_takes').then(function(d) { return toArray(d || []); }),
        loadBandDataFromDrive(songTitle, 'song_structure'),
        loadBandDataFromDrive(songTitle, 'best_shot_ratings'),
        loadBandDataFromDrive(songTitle, 'best_shot_section_notes')
    ]);
    refVersions = toArray(refVersions || []);
    if (!ratings) ratings = {};

    // Find the crowned North Star (most votes)
    var northStar = null;
    refVersions.forEach(function(v) {
        var votes = v.votes ? Object.keys(v.votes).filter(function(k) { return v.votes[k]; }).length : 0;
        if (!northStar || votes > (northStar._voteCount || 0)) {
            northStar = v;
            northStar._voteCount = votes;
        }
    });

    // Find crowned best shot (or latest)
    var crowned = shots.find(function(s) { return s.crowned; });
    if (!crowned && shots.length) crowned = shots[shots.length - 1];

    // Build sections list from structure.sections (custom) or defaults
    var defaultSections = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Jam', 'Outro'];
    var sections = (structure && structure.sections && structure.sections.length) ? toArray(structure.sections) : defaultSections;

    // ── Side by Side Players ──
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';

    // North Star column
    html += '<div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:12px;padding:14px;text-align:center">';
    html += '<div style="font-size:1.2em;margin-bottom:4px">⭐</div>';
    html += '<div style="font-weight:700;font-size:0.85em;color:var(--accent-light);margin-bottom:6px">North Star</div>';
    if (northStar) {
        var nsTitle = northStar.fetchedTitle || northStar.title || 'Reference';
        var nsUrl = northStar.url || northStar.spotifyUrl || '';
        html += '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + nsTitle + '</div>';
        html += '<button onclick="window.open(\'' + nsUrl.replace(/'/g, "\\'") + '\',\'_blank\')" class="btn btn-sm" style="background:rgba(102,126,234,0.2);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);font-size:0.78em;padding:6px 14px;border-radius:8px;cursor:pointer">▶ Listen</button>';
        html += '<div style="font-size:0.68em;color:var(--text-dim);margin-top:6px">' + (northStar._voteCount || 0) + '/' + Object.keys(bandMembers).length + ' votes</div>';
    } else {
        html += '<div style="font-size:0.78em;color:var(--text-dim)">No reference yet</div>';
        html += '<button onclick="showPage(\'songs\');setTimeout(function(){document.getElementById(\'step3ref\')?.scrollIntoView({behavior:\'smooth\'})},300)" class="btn btn-sm btn-ghost" style="font-size:0.72em;margin-top:6px">+ Add One</button>';
    }
    html += '</div>';

    // Best Shot column
    html += '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:14px;text-align:center">';
    html += '<div style="font-size:1.2em;margin-bottom:4px">🏆</div>';
    html += '<div style="font-weight:700;font-size:0.85em;color:#f59e0b;margin-bottom:6px">Best Shot</div>';
    if (crowned) {
        var who = bandMembers[crowned.uploadedBy]?.name || crowned.uploadedByName || '';
        html += '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:4px">' + (crowned.label || new Date(crowned.uploadedAt).toLocaleDateString()) + '</div>';
        if (crowned.audioUrl) html += bestShotAudioHtml(crowned.audioUrl, 'width:100%;max-width:200px;height:32px;margin:4px auto');
        else if (crowned.externalUrl) html += '<button onclick="window.open(\'' + crowned.externalUrl.replace(/'/g, "\\'") + '\',\'_blank\')" class="btn btn-sm" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.78em;padding:6px 14px;border-radius:8px;cursor:pointer">▶ Listen</button>';
        html += '<div style="font-size:0.68em;color:var(--text-dim);margin-top:4px">' + who + (crowned.crowned ? ' 👑' : '') + '</div>';
    } else {
        html += '<div style="font-size:0.78em;color:var(--text-dim)">No recording yet</div>';
        html += '<button onclick="addBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\')" class="btn btn-sm btn-ghost" style="font-size:0.72em;margin-top:6px">📤 Upload Take</button>';
    }
    html += '</div></div>';

    // ── Section Scorecard ──
    // ── Section Scorecard (always shown) ──
    {
        html += '<div style="margin-bottom:16px">';
        html += '<div style="font-weight:700;font-size:0.9em;margin-bottom:10px;display:flex;align-items:center;gap:6px"><span>📊 Section Scorecard</span><span style="font-size:0.75em;font-weight:400;color:var(--text-dim)">Tap to rate · 💬 for notes</span><button onclick="editScorecardSections(\'' + songTitle.replace(/'/g, "\\'") + '\')" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:0.85em;color:var(--text-dim)" title="Edit sections">✏️</button></div>';
        var totalGreen = 0, totalSections = sections.length;
        var allSectionNotes = null; // loaded lazily below
        sections.forEach(function(sec) {
            var sectionRatings = ratings[sec] || {};
            var counts = {green: 0, yellow: 0, red: 0};
            var myRating = sectionRatings[emailKey(currentUserEmail)] || '';
            Object.values(sectionRatings).forEach(function(r) { if (counts[r] !== undefined) counts[r]++; });
            var total = counts.green + counts.yellow + counts.red;
            var pctGreen = total ? Math.round(counts.green / total * 100) : 0;
            var pctYellow = total ? Math.round(counts.yellow / total * 100) : 0;
            if (total && counts.green === total) totalGreen++;
            var barColor = !total ? 'rgba(255,255,255,0.06)' : 'linear-gradient(90deg, #10b981 ' + pctGreen + '%, #f59e0b ' + pctGreen + '% ' + (pctGreen + pctYellow) + '%, #ef4444 ' + (pctGreen + pctYellow) + '%)';
            html += '<div data-section="' + sec + '" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
            var noteThread = toArray((sectionNotes || {})[sec] || []);
            var noteCount = noteThread.length;
            var hasNew = noteThread.some(function(n) { return n.ts && (Date.now() - new Date(n.ts).getTime()) < 24 * 60 * 60 * 1000; });
            html += '<div style="width:70px;font-size:0.78em;color:var(--text-muted);font-weight:600;flex-shrink:0;cursor:pointer;display:flex;align-items:center;gap:2px" onclick="toggleSectionNotes(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\')" title="View/add notes for ' + sec + '">' + sec + ' 💬' + (noteCount ? '<span style="font-size:0.8em;background:' + (hasNew ? '#f59e0b' : 'rgba(255,255,255,0.1)') + ';color:' + (hasNew ? '#000' : 'var(--text-dim)') + ';border-radius:8px;padding:0 4px;font-weight:700">' + noteCount + '</span>' : '') + '</div>';
            html += '<div data-bar="' + sec + '" style="flex:1;height:22px;border-radius:6px;background:' + barColor + ';position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06)">';
            if (total) html += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.65em;color:white;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.5)">' + counts.green + '🟢 ' + counts.yellow + '🟡 ' + counts.red + '🔴</div>';
            html += '</div>';
            // My vote buttons
            html += '<div data-votes="' + sec + '" style="display:flex;gap:2px;flex-shrink:0">';
            html += '<button onclick="event.stopPropagation();rateBestShotSection(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\',\'green\')" style="width:24px;height:24px;border-radius:6px;border:' + (myRating==='green'?'2px solid #10b981':'1px solid rgba(255,255,255,0.1)') + ';background:' + (myRating==='green'?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.04)') + ';cursor:pointer;font-size:0.7em;display:flex;align-items:center;justify-content:center" title="Locked In">🟢</button>';
            html += '<button onclick="event.stopPropagation();rateBestShotSection(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\',\'yellow\')" style="width:24px;height:24px;border-radius:6px;border:' + (myRating==='yellow'?'2px solid #f59e0b':'1px solid rgba(255,255,255,0.1)') + ';background:' + (myRating==='yellow'?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.04)') + ';cursor:pointer;font-size:0.7em;display:flex;align-items:center;justify-content:center" title="Getting There">🟡</button>';
            html += '<button onclick="event.stopPropagation();rateBestShotSection(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\',\'red\')" style="width:24px;height:24px;border-radius:6px;border:' + (myRating==='red'?'2px solid #ef4444':'1px solid rgba(255,255,255,0.1)') + ';background:' + (myRating==='red'?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.04)') + ';cursor:pointer;font-size:0.7em;display:flex;align-items:center;justify-content:center" title="Needs Work">🔴</button>';
            html += '</div></div>';
        });
        html += '</div>';

        // ── Focus Areas (auto-insights) ──
        var weakSections = [];
        var strongSections = [];
        sections.forEach(function(sec) {
            var sr = ratings[sec] || {};
            var vals = Object.values(sr);
            if (!vals.length) return;
            var reds = vals.filter(function(v) { return v === 'red'; }).length;
            var greens = vals.filter(function(v) { return v === 'green'; }).length;
            if (reds > greens) weakSections.push(sec);
            else if (greens === vals.length) strongSections.push(sec);
        });

        if (weakSections.length || strongSections.length) {
            html += '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px">';
            html += '<div style="font-weight:700;font-size:0.85em;margin-bottom:8px">🎯 Next Rehearsal Focus</div>';
            if (weakSections.length) {
                html += '<div style="font-size:0.82em;color:#ef4444;margin-bottom:6px">🔴 Needs work: <strong>' + weakSections.join(', ') + '</strong></div>';
                html += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Spend extra time on ' + (weakSections.length === 1 ? 'the ' + weakSections[0] : 'these sections') + ' at next practice.</div>';
            }
            if (strongSections.length) {
                html += '<div style="font-size:0.82em;color:#10b981">🟢 Locked in: <strong>' + strongSections.join(', ') + '</strong>' + (strongSections.length > 1 ? ' — run these once and move on' : '') + '</div>';
            }
            html += '</div>';
        }

        // ── Overall Progress ──
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">';
        html += '<div style="font-size:0.82em;color:var(--text-muted)">Progress:</div>';
        html += '<div style="flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,0.06);overflow:hidden">';
        var overallPct = totalSections ? Math.round(totalGreen / totalSections * 100) : 0;
        html += '<div style="width:' + overallPct + '%;height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:4px;transition:width 0.3s"></div>';
        html += '</div>';
        html += '<div style="font-size:0.82em;font-weight:700;color:' + (overallPct === 100 ? '#10b981' : 'var(--text)') + '">' + totalGreen + '/' + totalSections + '</div>';
        html += '</div>';
    } // end section scorecard block

    // ── Evolution Timeline ──
    if (shots.length) {
        html += '<div style="margin-bottom:12px">';
        html += '<div style="font-weight:700;font-size:0.85em;margin-bottom:8px">📼 All Takes (' + shots.length + ')</div>';
        shots.forEach(function(s, idx) {
            var isCrowned = s.crowned;
            var recDate = s.recordedDate || s.uploadedAt || '';
            var dateLabel = recDate ? new Date(recDate).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : 'No date';
            var who = bandMembers[s.uploadedBy]?.name || s.uploadedByName || '';
            html += '<div class="app-card" style="margin-bottom:6px;padding:10px;border-left:3px solid ' + (isCrowned ? '#f59e0b' : 'var(--border)') + '">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
            html += '<div style="flex:1;min-width:0">';
            html += '<div style="font-weight:700;font-size:0.88em">' + (s.label || 'Take ' + (idx + 1)) + (isCrowned ? ' 👑' : '') + '</div>';
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">🗓️ ' + dateLabel + (who ? ' · by ' + who : '') + '</div>';
            if (s.notes) html += '<div style="font-size:0.75em;color:var(--text-muted);margin-top:4px;font-style:italic">' + s.notes + '</div>';
            html += '</div>';
            html += '<div style="display:flex;gap:4px;flex-shrink:0">';
            if (!isCrowned) html += '<button onclick="crownBestShot(\'' + songTitle.replace(/'/g, "\\'") + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:2px" title="Crown as best">👑</button>';
            html += '<button onclick="editBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:2px" title="Edit">✏️</button>';
            html += '<button onclick="deleteBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:2px;color:#ef4444" title="Delete">🗑️</button>';
            html += '</div></div>';
            if (s.audioUrl) html += bestShotAudioHtml(s.audioUrl, 'width:100%;height:32px;margin-top:6px');
            else if (s.externalUrl) html += '<a href="' + s.externalUrl + '" target="_blank" style="display:inline-block;margin-top:4px;font-size:0.75em;color:var(--accent-light)">🔗 External Link</a>';
            html += '</div>';
        });
        html += '</div>';
    }

    // ── Add Take + Chop Rehearsal buttons ──
    html += '<div style="display:flex;gap:8px;margin-top:4px">';
    html += '<button onclick="addBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\')" class="btn btn-primary" style="flex:1">📤 Upload Take</button>';
    html += '<button onclick="openRehearsalChopper()" class="btn btn-ghost" style="flex-shrink:0">✂️ Chop</button>';
    html += '<button onclick="sendToPracticePlan(\'' + songTitle.replace(/'/g, "\\'") + '\')" class="btn btn-ghost" style="flex-shrink:0" title="Add to This Week\'s Focus">🎯 Practice</button>';
    html += '</div>';

    container.innerHTML = html;
}

// ── Rate a section ──────────────────────────────────────────────────────────
function emailKey(email) { return (email || '').replace(/[.#$\[\]\/]/g, '_'); }
function emailFromKey(key) {
    // Reverse lookup from sanitized key to real email
    var found = Object.keys(bandMembers).find(function(e) { return emailKey(e) === key; });
    return found || key;
}

async function rateBestShotSection(songTitle, section, rating) {
    var ratings = await loadBandDataFromDrive(songTitle, 'best_shot_ratings') || {};
    if (!ratings[section]) ratings[section] = {};
    var ek = emailKey(currentUserEmail);
    // Toggle off if clicking same rating
    if (ratings[section][ek] === rating) {
        delete ratings[section][ek];
    } else {
        ratings[section][ek] = rating;
    }
    await saveBandDataToDrive(songTitle, 'best_shot_ratings', ratings);
    // Inline update: refresh only this section's row instead of full re-render
    updateSectionRatingInline(songTitle, section, ratings);
}

function updateSectionRatingInline(songTitle, section, allRatings) {
    var sectionRatings = allRatings[section] || {};
    var counts = {green: 0, yellow: 0, red: 0};
    var myRating = sectionRatings[emailKey(currentUserEmail)] || '';
    Object.values(sectionRatings).forEach(function(r) { if (counts[r] !== undefined) counts[r]++; });
    var total = counts.green + counts.yellow + counts.red;
    var pctGreen = total ? Math.round(counts.green / total * 100) : 0;
    var pctYellow = total ? Math.round(counts.yellow / total * 100) : 0;
    var barColor = !total ? 'rgba(255,255,255,0.06)' : 'linear-gradient(90deg, #10b981 ' + pctGreen + '%, #f59e0b ' + pctGreen + '% ' + (pctGreen + pctYellow) + '%, #ef4444 ' + (pctGreen + pctYellow) + '%)';

    // Find the section row
    var rows = document.querySelectorAll('#bestShotVsNorthStar [data-section]');
    var targetRow = null;
    rows.forEach(function(r) { if (r.getAttribute('data-section') === section) targetRow = r; });
    // Bail gracefully if row not found — do NOT full re-render (would kill any playing audio)
    if (!targetRow) return;

    // Update the progress bar
    var bar = targetRow.querySelector('[data-bar="' + section + '"]');
    if (bar) {
        bar.style.background = barColor;
        var inner = bar.querySelector('div');
        if (inner && total) {
            inner.innerHTML = counts.green + '\u{1F7E2} ' + counts.yellow + '\u{1F7E1} ' + counts.red + '\u{1F534}';
        } else if (!total && inner) {
            inner.remove();
        } else if (total && !inner) {
            var newInner = document.createElement('div');
            newInner.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.65em;color:white;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.5)';
            newInner.innerHTML = counts.green + '\u{1F7E2} ' + counts.yellow + '\u{1F7E1} ' + counts.red + '\u{1F534}';
            bar.style.position = 'relative';
            bar.style.overflow = 'hidden';
            bar.appendChild(newInner);
        }
    }

    // Update my vote buttons
    var votesContainer = targetRow.querySelector('[data-votes="' + section + '"]');
    var buttons = votesContainer ? votesContainer.querySelectorAll('button') : [];
    buttons.forEach(function(btn) {
        var onclick = btn.getAttribute('onclick') || '';
        var color = '';
        if (onclick.includes("'green'")) color = 'green';
        else if (onclick.includes("'yellow'")) color = 'yellow';
        else if (onclick.includes("'red'")) color = 'red';
        var isActive = myRating === color;
        var borderMap = {green: '#10b981', yellow: '#f59e0b', red: '#ef4444'};
        var bgMap = {green: 'rgba(16,185,129,0.2)', yellow: 'rgba(245,158,11,0.2)', red: 'rgba(239,68,68,0.2)'};
        btn.style.border = isActive ? '2px solid ' + borderMap[color] : '1px solid rgba(255,255,255,0.1)';
        btn.style.background = isActive ? bgMap[color] : 'rgba(255,255,255,0.04)';
    });
}

// ── Section notes (per member, per section) ─────────────────────────────────
async function toggleSectionNotes(songTitle, section) {
    var id = 'secNotes_' + section.replace(/\s/g, '_');
    var existing = document.getElementById(id);
    if (existing) { existing.remove(); return; }

    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    // Sort by timestamp
    thread.sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
    var ek = emailKey(currentUserEmail);

    var rows = document.querySelectorAll('#bestShotVsNorthStar [data-section]');
    var targetRow = null;
    rows.forEach(function(r) { if (r.getAttribute('data-section') === section) targetRow = r; });
    if (!targetRow) return;

    var panel = document.createElement('div');
    panel.id = id;
    panel.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px;margin:4px 0 8px 68px;font-size:0.82em';

    var threadHtml = '';
    if (!thread.length) {
        threadHtml = '<div style="color:var(--text-dim);margin-bottom:8px;font-style:italic">No notes yet — start the conversation</div>';
    } else {
        thread.forEach(function(note, idx) {
            var name = bandMembers[emailFromKey(note.by)]?.name || note.by || '?';
            var time = note.ts ? new Date(note.ts).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : '';
            var isNew = note.ts && (Date.now() - new Date(note.ts).getTime()) < 24 * 60 * 60 * 1000;
            var isMine = note.by === ek;
            threadHtml += '<div style="margin-bottom:8px;padding:6px 8px;border-radius:6px;background:' + (isMine ? 'rgba(102,126,234,0.06)' : 'rgba(255,255,255,0.02)') + ';border-left:2px solid ' + (isMine ? 'var(--accent-light)' : 'rgba(255,255,255,0.1)') + '">';
            threadHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">';
            threadHtml += '<span style="font-weight:600;font-size:0.85em;color:' + (isMine ? 'var(--accent-light)' : 'var(--text)') + '">' + name + (isNew ? ' 🆕' : '') + '</span>';
            threadHtml += '<span style="font-size:0.7em;color:var(--text-dim)">' + time;
            if (isMine) {
                threadHtml += ' <button onclick="editSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\',' + idx + ')" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-size:1em;padding:0 2px" title="Edit">✏️</button>';
                threadHtml += '<button onclick="deleteSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\',' + idx + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1em;padding:0 2px" title="Delete">🗑️</button>';
            }
            threadHtml += '</span></div>';
            threadHtml += '<div style="color:var(--text-muted);font-size:0.92em" id="secNoteText_' + section + '_' + idx + '">' + (note.text || '') + '</div>';
            threadHtml += '</div>';
        });
    }

    panel.innerHTML = threadHtml +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<input class="app-input" id="secNoteInput_' + section + '" placeholder="Add a note for ' + section + '..." style="flex:1;font-size:0.9em;padding:6px 10px">' +
        '<button class="btn btn-sm btn-primary" onclick="addSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\')" style="font-size:0.78em;padding:4px 10px">💬</button>' +
        '</div>';

    targetRow.parentNode.insertBefore(panel, targetRow.nextSibling);
    document.getElementById('secNoteInput_' + section)?.focus();
}

async function addSectionNote(songTitle, section) {
    var input = document.getElementById('secNoteInput_' + section);
    if (!input || !input.value.trim()) return;
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    if (!Array.isArray(allNotes[section])) {
        // Migrate old format (object with email keys) to array
        var oldObj = allNotes[section] || {};
        var migrated = [];
        Object.keys(oldObj).forEach(function(k) {
            if (typeof oldObj[k] === 'string') migrated.push({by: k, text: oldObj[k], ts: new Date().toISOString()});
        });
        allNotes[section] = migrated;
    }
    allNotes[section].push({
        by: emailKey(currentUserEmail),
        text: input.value.trim(),
        ts: new Date().toISOString()
    });
    await saveBandDataToDrive(songTitle, 'best_shot_section_notes', allNotes);
    showToast('💬 Note added');
    // Re-open the thread to show new note
    var panelId = 'secNotes_' + section.replace(/\s/g, '_');
    var el = document.getElementById(panelId);
    if (el) el.remove();
    toggleSectionNotes(songTitle, section);
}

async function editSectionNote(songTitle, section, idx) {
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    if (!thread[idx]) return;
    var textEl = document.getElementById('secNoteText_' + section + '_' + idx);
    if (!textEl) return;
    var current = thread[idx].text || '';
    textEl.innerHTML = '<div style="display:flex;gap:4px"><input class="app-input" id="secNoteEdit_' + section + '_' + idx + '" value="' + current.replace(/"/g, '&quot;') + '" style="flex:1;font-size:0.9em;padding:4px 8px"><button class="btn btn-sm btn-primary" onclick="saveEditedSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\',' + idx + ')" style="font-size:0.75em;padding:2px 8px">💾</button></div>';
    document.getElementById('secNoteEdit_' + section + '_' + idx)?.focus();
}

async function saveEditedSectionNote(songTitle, section, idx) {
    var input = document.getElementById('secNoteEdit_' + section + '_' + idx);
    if (!input) return;
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    if (!thread[idx]) return;
    thread[idx].text = input.value.trim();
    thread[idx].editedAt = new Date().toISOString();
    allNotes[section] = thread;
    await saveBandDataToDrive(songTitle, 'best_shot_section_notes', allNotes);
    showToast('✏️ Note updated');
    var panelId = 'secNotes_' + section.replace(/\s/g, '_');
    var el = document.getElementById(panelId);
    if (el) el.remove();
    toggleSectionNotes(songTitle, section);
}

async function deleteSectionNote(songTitle, section, idx) {
    if (!confirm('Delete this note?')) return;
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    thread.splice(idx, 1);
    allNotes[section] = thread;
    await saveBandDataToDrive(songTitle, 'best_shot_section_notes', allNotes);
    showToast('🗑️ Note deleted');
    var panelId = 'secNotes_' + section.replace(/\s/g, '_');
    var el = document.getElementById(panelId);
    if (el) el.remove();
    toggleSectionNotes(songTitle, section);
}

// ── Crown a take ────────────────────────────────────────────────────────────
async function crownBestShot(songTitle, index) {
    var shots = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    shots.forEach(function(s, i) { s.crowned = (i === index); });
    await saveBandDataToDrive(songTitle, 'best_shot_takes', shots);
    showToast('👑 Crowned as Best Shot!');
    renderBestShotVsNorthStar(songTitle);
}

// ── Edit a take ─────────────────────────────────────────────────────────────
async function editBestShotTake(songTitle, index) {
    var shots = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    var take = shots[index];
    if (!take) return;
    var memberOpts = Object.entries(bandMembers).map(function(e) { return '<option value="' + e[0] + '"' + (e[0] === take.uploadedBy ? ' selected' : '') + '>' + e[1].name + '</option>'; }).join('');
    var container = document.getElementById('bestShotVsNorthStar');
    if (!container) return;
    var form = document.createElement('div');
    form.id = 'editTakeForm';
    form.style.cssText = 'background:rgba(102,126,234,0.05);border:1px solid rgba(102,126,234,0.2);border-radius:12px;padding:16px;margin-bottom:12px';
    form.innerHTML = '<div style="font-weight:700;font-size:0.9em;margin-bottom:10px">✏️ Edit Take #' + (index + 1) + '</div>' +
        '<div class="form-grid">' +
        '<div class="form-row"><label class="form-label">Label</label><input class="app-input" id="editTakeLabel" value="' + (take.label || '').replace(/"/g, '&quot;') + '"></div>' +
        '<div class="form-row"><label class="form-label">Recorded By</label><select class="app-select" id="editTakeBy">' + memberOpts + '</select></div>' +
        '<div class="form-row"><label class="form-label">Recording Date</label><input type="date" class="app-input" id="editTakeDate" value="' + (take.recordedDate || (take.uploadedAt ? take.uploadedAt.slice(0,10) : '')) + '"></div>' +
        '<div class="form-row"><label class="form-label">Audio URL</label><input class="app-input" id="editTakeUrl" value="' + (take.audioUrl || '').replace(/"/g, '&quot;') + '"></div>' +
        '<div class="form-row"><label class="form-label">External Link</label><input class="app-input" id="editTakeExtUrl" value="' + (take.externalUrl || '').replace(/"/g, '&quot;') + '"></div>' +
        '</div>' +
        '<div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="editTakeNotes">' + (take.notes || '') + '</textarea></div>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" id="editTakeSaveBtn">💾 Save</button><button class="btn btn-ghost" id="editTakeCancelBtn">Cancel</button></div>';
    container.insertBefore(form, container.firstChild);
    document.getElementById('editTakeSaveBtn').addEventListener('click', async function() {
        shots[index].label = document.getElementById('editTakeLabel')?.value?.trim() || '';
        shots[index].uploadedBy = document.getElementById('editTakeBy')?.value || take.uploadedBy;
        shots[index].uploadedByName = bandMembers[document.getElementById('editTakeBy')?.value]?.name || '';
        shots[index].recordedDate = document.getElementById('editTakeDate')?.value || '';
        shots[index].audioUrl = document.getElementById('editTakeUrl')?.value?.trim() || '';
        shots[index].externalUrl = document.getElementById('editTakeExtUrl')?.value?.trim() || '';
        shots[index].notes = document.getElementById('editTakeNotes')?.value?.trim() || '';
        await saveBandDataToDrive(songTitle, 'best_shot_takes', shots);
        showToast('✏️ Take updated');
        renderBestShotVsNorthStar(songTitle);
    });
    document.getElementById('editTakeCancelBtn').addEventListener('click', function() { form.remove(); });
}

// ── Delete a take ───────────────────────────────────────────────────────────
async function deleteBestShotTake(songTitle, index) {
    if (!confirm('Delete this take?')) return;
    var shots = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    shots.splice(index, 1);
    await saveBandDataToDrive(songTitle, 'best_shot_takes', shots);
    showToast('🗑️ Take deleted');
    renderBestShotVsNorthStar(songTitle);
}

// ── Add Take form ───────────────────────────────────────────────────────────
function addBestShotTake(songTitle) {
    var container = document.getElementById('bestShotVsNorthStar');
    if (!container) return;
    var memberOpts = Object.entries(bandMembers).map(function(e) { return '<option value="' + e[0] + '"' + (e[0] === currentUserEmail ? ' selected' : '') + '>' + e[1].name + '</option>'; }).join('');
    var form = document.createElement('div');
    form.style.cssText = 'background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:16px;margin-bottom:12px';
    var h = '<div style="font-weight:700;font-size:0.9em;margin-bottom:10px">📤 Upload Take for ' + songTitle + '</div>';
    h += '<div class="form-grid">';
    h += '<div class="form-row"><label class="form-label">Label</label><input class="app-input" id="bstLabel" placeholder="e.g. 3/1 rehearsal take 2"></div>';
    h += '<div class="form-row"><label class="form-label">Recorded By</label><select class="app-select" id="bstBy">' + memberOpts + '</select></div>';
    h += '<div class="form-row"><label class="form-label">Recording Date</label><input type="date" class="app-input" id="bstRecDate" value="' + new Date().toISOString().slice(0,10) + '"></div>';
    h += '</div>';
    h += '<div class="form-row"><label class="form-label">Audio</label>';
    h += '<div id="bstDropZone" style="border:2px dashed rgba(245,158,11,0.3);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:8px">';
    h += '<div style="font-size:1.5em;margin-bottom:4px">🎵</div>';
    h += '<div style="font-size:0.82em;color:var(--text-muted)">Drag & drop MP3 here</div>';
    h += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:4px">or paste a link below</div>';
    h += '</div>';
    h += '<input class="app-input" id="bstUrl" placeholder="Google Drive / Dropbox / direct MP3 link" style="margin-bottom:6px">';
    h += '<input type="file" id="bstFileInput" accept=".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/*" style="display:none">';
    h += '<button class="btn btn-ghost btn-sm" style="font-size:0.78em;margin-bottom:8px" id="bstBrowseBtn">📁 Browse files</button>';
    h += '</div>';
    h += '<div class="form-row"><label class="form-label">External Link (opt)</label><input class="app-input" id="bstExtUrl" placeholder="YouTube, SoundCloud, etc."></div>';
    h += '<div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="bstNotes" placeholder="How did it go?"></textarea></div>';
    h += '<div id="bstUploadStatus" style="display:none;font-size:0.78em;color:#f59e0b;margin:4px 0"></div>';
    h += '<div style="font-size:0.75em;color:var(--text-dim);margin:4px 0">💡 Drag MP3 here, browse files, or paste a Google Drive/Dropbox link</div>';
    h += '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" id="bstSaveBtn">💾 Save Take</button><button class="btn btn-ghost" id="bstCancelBtn">Cancel</button></div>';
    form.innerHTML = h;
    container.insertBefore(form, container.firstChild);
    var dropZone = document.getElementById('bstDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = '#f59e0b'; dropZone.style.background = 'rgba(245,158,11,0.08)'; });
        dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; });
        dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; var f = e.dataTransfer?.files?.[0]; if (f) handleBestShotFile(f, songTitle); });
        dropZone.addEventListener('click', function() { document.getElementById('bstFileInput')?.click(); });
    }
    var fileInput = document.getElementById('bstFileInput');
    if (fileInput) fileInput.addEventListener('change', function() { if (this.files[0]) handleBestShotFile(this.files[0], songTitle); });
    document.getElementById('bstBrowseBtn')?.addEventListener('click', function() { document.getElementById('bstFileInput')?.click(); });
    document.getElementById('bstSaveBtn')?.addEventListener('click', function() { saveBestShotTake(songTitle); });
    document.getElementById('bstCancelBtn')?.addEventListener('click', function() { renderBestShotVsNorthStar(songTitle); });
}

// ── File upload to Firebase as base64 ───────────────────────────────────────
async function handleBestShotFile(file, songTitle) {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
        showToast('Please drop an audio file (MP3, WAV, etc.)'); return;
    }
    if (file.size > 15 * 1024 * 1024) {
        showToast('File too large (max 15MB). Try a link instead.'); return;
    }
    var zone = document.getElementById('bstDropZone');
    var status = document.getElementById('bstUploadStatus');
    if (zone) zone.innerHTML = '<div style="font-size:0.82em;color:#f59e0b">⏳ Reading ' + file.name + '...</div>';
    if (status) { status.style.display = 'block'; status.textContent = '⏳ Uploading...'; }
    try {
        var base64 = await blobToBase64(file);
        var audioKey = 'audio_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await saveBandDataToDrive(songTitle, 'best_shot_audio_' + audioKey, {
            data: base64, name: file.name, type: file.type, size: file.size, uploadedAt: new Date().toISOString()
        });
        var urlInput = document.getElementById('bstUrl');
        if (urlInput) urlInput.value = 'firebase-audio://' + songTitle + '/best_shot_audio_' + audioKey;
        if (zone) zone.innerHTML = '<div style="font-size:0.82em;color:#10b981">✅ ' + file.name + ' uploaded!</div>';
        if (status) { status.style.display = 'block'; status.textContent = '✅ Audio uploaded!'; status.style.color = '#10b981'; }
    } catch (err) {
        console.error('Audio upload error:', err);
        if (zone) zone.innerHTML = '<div style="font-size:0.82em;color:#ef4444">❌ Upload failed</div>';
        if (status) { status.style.display = 'block'; status.textContent = '❌ ' + err.message; status.style.color = '#ef4444'; }
    }
}

// ── Audio URL normalization ─────────────────────────────────────────────────
function normalizeAudioUrl(url) {
    if (!url) return '';
    if (url.startsWith('firebase-audio://')) return url;
    // Google Drive: extract file ID
    var driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (driveMatch) return 'gdrive:' + driveMatch[1];
    var driveMatch2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
    if (driveMatch2) return 'gdrive:' + driveMatch2[1];
    var driveMatch3 = url.match(/id=([a-zA-Z0-9_-]{20,})/);
    if (driveMatch3 && url.includes('drive.google.com')) return 'gdrive:' + driveMatch3[1];
    if (url.includes('dropbox.com')) return url.replace('dl=0', 'dl=1');
    return url;
}

// ── Audio player HTML builder ───────────────────────────────────────────────
function bestShotAudioHtml(audioUrl, style) {
    if (!audioUrl) return '';
    style = style || 'width:100%;height:32px;margin-top:4px';
    if (audioUrl.startsWith('firebase-audio://')) {
        var parts = audioUrl.replace('firebase-audio://', '').split('/');
        var sTitle = decodeURIComponent(parts[0]);
        var aKey = parts.slice(1).join('/');
        var playerId = 'bsPlayer_' + aKey.replace(/[^a-zA-Z0-9]/g, '_');
        return '<div id="' + playerId + '" style="' + style + '"><button class="btn btn-sm btn-ghost" onclick="loadFirebaseAudio(\'' + sTitle.replace(/'/g, "\\'") + '\',\'' + aKey + '\',\'' + playerId + '\')" style="font-size:0.78em">▶ Load Audio</button></div>';
    }
    var normalized = normalizeAudioUrl(audioUrl);
    // Google Drive: lazy-load with user's auth token, fallback to open in Drive
    if (normalized.startsWith('gdrive:')) {
        var fileId = normalized.replace('gdrive:', '');
        var gdriveLink = 'https://drive.google.com/file/d/' + fileId + '/view';
        var pid = 'bsGd_' + fileId.slice(0, 8);
        return '<div id="' + pid + '" style="' + style + '">' +
            '<button class="btn btn-sm btn-ghost" onclick="loadGdriveAudio(\'' + fileId + '\',\'' + pid + '\')" style="font-size:0.78em">▶ Load from Google Drive</button>' +
            ' <a href="' + gdriveLink + '" target="_blank" style="font-size:0.65em;color:var(--accent-light)">open in Drive</a></div>';
    }
    return '<audio controls preload="none" style="' + style + '"><source src="' + normalized + '"></audio>';
}

// ── Firebase audio lazy loader ──────────────────────────────────────────────
async function loadFirebaseAudio(songTitle, audioKey, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<span style="font-size:0.78em;color:#f59e0b">⏳ Loading...</span>';
    try {
        var data = await loadBandDataFromDrive(songTitle, audioKey);
        if (data && data.data) {
            el.innerHTML = '<audio controls autoplay style="width:100%;height:32px"><source src="' + data.data + '" type="' + (data.type || 'audio/mpeg') + '"></audio>';
        } else {
            el.innerHTML = '<span style="font-size:0.78em;color:#ef4444">Audio not found</span>';
        }
    } catch (err) {
        el.innerHTML = '<span style="font-size:0.78em;color:#ef4444">Failed to load</span>';
    }
}

async function loadGdriveAudio(fileId, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<span style="font-size:0.78em;color:#f59e0b">\u23f3 Loading from Drive...</span>';
    var driveLink = 'https://drive.google.com/file/d/' + fileId + '/view';
    try {
        var res = null;
        // Try 1: User's access token (has drive.readonly scope after consent)
        if (accessToken) {
            console.log('[GDrive Audio] Trying with access token...');
            res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            if (res.ok) console.log('[GDrive Audio] Token fetch succeeded');
            else console.log('[GDrive Audio] Token fetch failed:', res.status);
        }
        // Try 2: API key fallback (for publicly shared files)
        if (!res || !res.ok) {
            console.log('[GDrive Audio] Trying with API key...');
            res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&key=' + GOOGLE_DRIVE_CONFIG.apiKey);
        }
        if (!res.ok) throw new Error('HTTP ' + res.status + (accessToken ? '' : ' (not signed in)'));
        var blob = await res.blob();
        console.log('[GDrive Audio] Got blob:', blob.size, 'bytes, type:', blob.type);
        var objectUrl = URL.createObjectURL(blob);
        el.innerHTML = '<audio controls autoplay style="width:100%;height:32px"><source src="' + objectUrl + '" type="' + (blob.type || 'audio/mpeg') + '"></audio>';
    } catch (err) {
        console.error('[GDrive Audio]', err);
        el.innerHTML = '<a href="' + driveLink + '" target="_blank" class="btn btn-sm btn-ghost" style="font-size:0.82em">\u25b6 Open in Google Drive</a>' +
            '<div style="font-size:0.62em;color:var(--text-dim);margin-top:2px">' + err.message + '</div>';
    }
}

async function saveBestShotTake(songTitle) {
    var url = document.getElementById('bstUrl')?.value?.trim() || '';
    var extUrl = document.getElementById('bstExtUrl')?.value?.trim() || '';
    if (!url && !extUrl) { showToast('Provide an audio file or link'); return; }
    var take = {
        label: document.getElementById('bstLabel')?.value?.trim() || '',
        uploadedBy: document.getElementById('bstBy')?.value || currentUserEmail,
        uploadedByName: bandMembers[document.getElementById('bstBy')?.value]?.name || '',
        audioUrl: url,
        externalUrl: extUrl,
        recordedDate: document.getElementById('bstRecDate')?.value || '',
        notes: document.getElementById('bstNotes')?.value?.trim() || '',
        uploadedAt: new Date().toISOString(),
        crowned: false
    };
    var existing = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    // Auto-crown if first take
    if (!existing.length) take.crowned = true;
    existing.push(take);
    await saveBandDataToDrive(songTitle, 'best_shot_takes', existing);
    showToast('🏆 Take saved!');
    renderBestShotVsNorthStar(songTitle);
}

// ── Send to Practice Plan ────────────────────────────────────────────────────
async function sendToPracticePlan(songTitle) {
    var song = allSongs.find(function(s) { return s.title === songTitle; });
    if (!song) { showToast('Song not found'); return; }
    var currentStatus = song.status || '';
    if (currentStatus === 'This Week') {
        showToast('Already in This Week\'s Focus!');
        return;
    }
    var oldStatus = currentStatus;
    song.status = 'This Week';
    await saveBandDataToDrive(songTitle, 'song_status', { status: 'This Week' });
    showToast('🎯 Added to This Week\'s Focus!' + (oldStatus ? ' (was: ' + oldStatus + ')' : ''));
}

// ── Custom Section Editor ────────────────────────────────────────────────────
async function editScorecardSections(songTitle) {
    var structure = await loadBandDataFromDrive(songTitle, 'song_structure') || {};
    var defaultSections = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Jam', 'Outro'];
    var current = (structure.sections && structure.sections.length) ? toArray(structure.sections) : defaultSections;

    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px';
    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-card,#1e293b);border-radius:16px;padding:20px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto';

    var h = '<div style="font-weight:700;font-size:1em;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">';
    h += '<span>\u270f\ufe0f Edit Sections</span>';
    h += '<button id="secEdClose" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.2em">\u2715</button></div>';
    h += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:10px">One section per line. These become the rows in your Section Scorecard.</div>';
    h += '<textarea id="secEdText" style="width:100%;box-sizing:border-box;min-height:180px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--text);font-size:0.9em;padding:10px;line-height:1.6;resize:vertical">' + current.join('\n') + '</textarea>';
    h += '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
    h += '<button id="secEdPresets" class="btn btn-ghost btn-sm" style="font-size:0.75em">Reset to defaults</button>';
    h += '<div style="flex:1"></div>';
    h += '<button id="secEdCancel" class="btn btn-ghost btn-sm">Cancel</button>';
    h += '<button id="secEdSave" class="btn btn-primary btn-sm">Save</button>';
    h += '</div>';
    inner.innerHTML = h;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.getElementById('secEdClose').addEventListener('click', function() { modal.remove(); });
    document.getElementById('secEdCancel').addEventListener('click', function() { modal.remove(); });
    document.getElementById('secEdPresets').addEventListener('click', function() {
        document.getElementById('secEdText').value = defaultSections.join('\n');
    });
    document.getElementById('secEdSave').addEventListener('click', async function() {
        var lines = document.getElementById('secEdText').value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
        if (!lines.length) { showToast('Add at least one section'); return; }
        structure.sections = lines;
        await saveBandDataToDrive(songTitle, 'song_structure', structure);
        modal.remove();
        showToast('Sections updated!');
        renderBestShotVsNorthStar(songTitle);
    });
}

// ============================================================================
// ============================================================================
// REHEARSAL CHOPPER — Split a long rehearsal MP3 into individual song takes
// ============================================================================
function openRehearsalChopper() {
    if (document.getElementById('rehearsalChopperModal')) return;
    var modal = document.createElement('div');
    modal.id = 'rehearsalChopperModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10002;display:flex;flex-direction:column;overflow-y:auto';
    modal.innerHTML = '<div style="max-width:960px;width:100%;margin:0 auto;padding:16px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<h2 style="margin:0;color:white">✂️ Rehearsal Chopper</h2>' +
        '<button id="chopCloseBtn" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.5em">✕</button>' +
        '</div>' +
        '<p style="color:var(--text-dim);font-size:0.85em;margin-bottom:8px">Load a rehearsal MP3, detect pauses, adjust boundaries, name songs, save as individual takes.</p>' +
        '<details style="margin-bottom:12px;font-size:0.78em;color:var(--text-dim)"><summary style="cursor:pointer;color:var(--text-muted);font-weight:600">How it works</summary>' +
        '<div style="padding:6px 0 2px 0;line-height:1.5">' +
        '<b>1.</b> Drop an MP3 (or click to browse). ' +
        '<b>2.</b> Hit Detect Pauses \u2014 adjusts silence threshold and min gap to taste. ' +
        '<b>3.</b> Drag orange markers to fine-tune. Click waveform to seek; Space to play/pause; \u2190\u2192 skip 5s. ' +
        '<b>4.</b> Click a timestamp to set boundary on waveform, or double-click to type an exact time. ' +
        '<b>5.</b> Name each segment from the song dropdown, exclude non-music sections with \ud83d\udeab. ' +
        '<b>6.</b> Save All downloads WAV files and logs takes to Best Shot.' +
        '</div></details>' +
        '<div id="chopDropZone" style="border:2px dashed rgba(245,158,11,0.3);border-radius:12px;padding:30px;text-align:center;cursor:pointer;margin-bottom:12px;transition:all 0.2s">' +
        '<div style="font-size:1.8em;margin-bottom:6px">🎵</div>' +
        '<div style="color:var(--text-muted);font-size:0.9em">Drag & drop rehearsal MP3 here</div>' +
        '<div style="font-size:0.75em;color:var(--text-dim);margin-top:4px">or click to browse</div>' +
        '<input type="file" id="chopFileInput" accept=".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/*" style="display:none">' +
        '</div>' +
        '<div id="chopperContent" style="display:none">' +
        '<div style="margin-bottom:8px">' +
        '<audio id="chopAudio" controls style="width:100%;height:36px;margin-bottom:6px"></audio>' +
        '<div style="position:relative">' +
        '<canvas id="chopWaveform" width="920" height="130" style="width:100%;height:130px;border-radius:8px;cursor:crosshair;background:#0f0f1e;border:1px solid rgba(255,255,255,0.08)"></canvas>' +
        '<div id="chopPlayhead" style="position:absolute;top:0;left:0;width:2px;height:100%;background:#fff;pointer-events:none;opacity:0.8;display:none"></div>' +
        '<div id="chopHoverLine" style="position:absolute;top:0;left:0;width:1px;height:100%;background:rgba(255,255,255,0.4);pointer-events:none;display:none"></div>' +
        '<div id="chopHoverTime" style="position:absolute;top:2px;left:0;background:rgba(0,0,0,0.8);color:white;font-size:0.65em;padding:1px 4px;border-radius:3px;pointer-events:none;display:none"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:3px;font-size:0.7em;color:var(--text-dim)"><span id="chopTimeStart">0:00</span><span id="chopTimeEnd">0:00</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn btn-primary btn-sm" id="chopDetectBtn">🔍 Detect Pauses</button>' +
        '<button class="btn btn-ghost btn-sm" id="chopAddMarkerBtn" title="Adds a split marker at the current audio position. Play, pause at a song break, click this.">+ Split at Playhead</button>' +
        '<button class="btn btn-ghost btn-sm" id="chopClearBtn" style="color:#ef4444">🗑️ Clear All</button>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:0.78em;color:var(--text-muted);margin-left:auto">Silence: <input type="range" id="chopThreshold" min="0.002" max="0.08" step="0.002" value="0.015" style="width:80px"> <span id="chopThreshVal">0.015</span></label>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:0.78em;color:var(--text-muted)">Min gap: <input type="range" id="chopMinGap" min="0.5" max="8" step="0.5" value="3" style="width:60px"> <span id="chopMinGapVal">3</span>s</label>' +
        '</div>' +
        '<div id="chopSegments"></div>' +
        '</div></div>';
    document.body.appendChild(modal);

    // Wire up events
    var dropZone = document.getElementById('chopDropZone');
    var fileInput = document.getElementById('chopFileInput');
    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = '#f59e0b'; dropZone.style.background = 'rgba(245,158,11,0.08)'; });
    dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; });
    dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; if (e.dataTransfer?.files?.[0]) chopLoadFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', function() { if (this.files[0]) chopLoadFile(this.files[0]); });
    document.getElementById('chopCloseBtn').addEventListener('click', function() { chopStopPlayheadTracker(); modal.remove(); });
    document.getElementById('chopDetectBtn').addEventListener('click', function() { chopDetectSilence(); });
    document.getElementById('chopAddMarkerBtn').addEventListener('click', function() { chopAddMarker(); });
    // Keyboard shortcuts: Space=play/pause, Left/Right=skip 5s
    document.addEventListener('keydown', function chopKeyHandler(e) {
        if (!document.getElementById('rehearsalChopperModal')) { document.removeEventListener('keydown', chopKeyHandler); return; }
        var audio = document.getElementById('chopAudio');
        if (!audio || !chopAudioBuffer) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); }
        if (e.code === 'ArrowRight') { e.preventDefault(); audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); }
    });

    document.getElementById('chopClearBtn').addEventListener('click', function() { chopMarkers = []; chopExcluded = {}; chopDrawWaveform(); chopRenderSegments(); showToast('Cleared all markers'); });
    document.getElementById('chopThreshold').addEventListener('input', function() { document.getElementById('chopThreshVal').textContent = this.value; });
    document.getElementById('chopMinGap').addEventListener('input', function() { document.getElementById('chopMinGapVal').textContent = this.value; });
}

var chopAudioBuffer = null;
var chopAudioContext = null;
var chopMarkers = [];    // array of seconds where splits happen
var chopExcluded = {};   // index -> true for excluded segments
var chopFile = null;
var chopPlayheadRAF = null;
var chopDraggingMarker = -1; // index of marker being dragged (-1 = none)
var chopSelectedSegment = -1; // which segment is selected for boundary editing
var chopSettingBoundary = null; // 'start' or 'end'

async function chopLoadFile(file) {
    chopFile = file;
    chopMarkers = [];
    chopExcluded = {};
    var dropZone = document.getElementById('chopDropZone');
    if (dropZone) dropZone.innerHTML = '<div style="color:#10b981">✅ ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)</div>';

    var audio = document.getElementById('chopAudio');
    audio.src = URL.createObjectURL(file);

    document.getElementById('chopperContent').style.display = 'block';
    var canvas = document.getElementById('chopWaveform');
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏳ Analyzing waveform...', canvas.width / 2, canvas.height / 2);

    try {
        chopAudioContext = chopAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        var arrayBuffer = await file.arrayBuffer();
        chopAudioBuffer = await chopAudioContext.decodeAudioData(arrayBuffer);
        document.getElementById('chopTimeEnd').textContent = formatChopTime(chopAudioBuffer.duration);
        chopDrawWaveform();
        chopWireCanvasEvents();
        chopStartPlayheadTracker();
    } catch (err) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillText('Error: ' + err.message, canvas.width / 2, canvas.height / 2);
    }
}

function chopWireCanvasEvents() {
    var canvas = document.getElementById('chopWaveform');
    var audio = document.getElementById('chopAudio');
    if (!canvas || !chopAudioBuffer) return;

    // Hover: show line + time tooltip
    canvas.addEventListener('mousemove', function(e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var pct = x / rect.width;
        var sec = pct * chopAudioBuffer.duration;

        var pixPerSec2 = rect.width / chopAudioBuffer.duration;
        var nearM = false;
        for (var mi = 0; mi < chopMarkers.length; mi++) { if (Math.abs(x - chopMarkers[mi] * pixPerSec2) < 8) { nearM = true; break; } }
        canvas.style.cursor = chopDraggingMarker >= 0 ? 'col-resize' : (nearM ? 'col-resize' : 'crosshair');
        var hoverLine = document.getElementById('chopHoverLine');
        var hoverTime = document.getElementById('chopHoverTime');
        if (hoverLine) { hoverLine.style.display = 'block'; hoverLine.style.left = x + 'px'; }
        if (hoverTime) { hoverTime.style.display = 'block'; hoverTime.style.left = (x + 6) + 'px'; hoverTime.textContent = formatChopTime(sec); }

        if (chopDraggingMarker >= 0) {
            var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
            var targetVal = sorted[chopDraggingMarker];
            var origIdx = chopMarkers.indexOf(targetVal);
            if (origIdx >= 0) chopMarkers[origIdx] = Math.max(0.1, Math.min(sec, chopAudioBuffer.duration - 0.1));
            chopDrawWaveform();
            chopRenderSegments();
        }
    });

    canvas.addEventListener('mouseleave', function() {
        document.getElementById('chopHoverLine').style.display = 'none';
        document.getElementById('chopHoverTime').style.display = 'none';
        if (chopDraggingMarker >= 0) { chopDraggingMarker = -1; chopMarkers.sort(function(a,b){return a-b}); chopRenderSegments(); }
    });

    // Click: seek audio or set boundary
    canvas.addEventListener('click', function(e) {
        if (chopDraggingMarker >= 0) return;
        var rect = canvas.getBoundingClientRect();
        var pct = (e.clientX - rect.left) / rect.width;
        var sec = pct * chopAudioBuffer.duration;
        // If setting a boundary, apply it
        if (chopSelectedSegment >= 0 && chopSettingBoundary) {
            chopSetBoundary(sec);
            return;
        }
        audio.currentTime = sec;
        audio.play();
    });

    canvas.addEventListener('mousedown', function(e) {
        var rect = canvas.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        var pixelPerSec = rect.width / chopAudioBuffer.duration;
        var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
        for (var i = 0; i < sorted.length; i++) {
            var markerX = sorted[i] * pixelPerSec;
            if (Math.abs(clickX - markerX) < 8) {
                chopDraggingMarker = i;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
                return;
            }
        }
    });

    // Use document-level mouseup so drag works even if mouse leaves canvas
    document.addEventListener('mouseup', function chopMouseUp() {
        if (chopDraggingMarker >= 0) {
            chopDraggingMarker = -1;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            chopMarkers.sort(function(a,b){return a-b});
            chopDrawWaveform();
            chopRenderSegments();
        }
    });
}

function chopStartPlayheadTracker() {
    var audio = document.getElementById('chopAudio');
    var playhead = document.getElementById('chopPlayhead');
    var canvas = document.getElementById('chopWaveform');
    if (!audio || !playhead || !canvas || !chopAudioBuffer) return;

    function tick() {
        chopPlayheadRAF = requestAnimationFrame(tick);
        if (audio.paused) { playhead.style.display = 'none'; return; }
        var pct = audio.currentTime / chopAudioBuffer.duration;
        var rect = canvas.getBoundingClientRect();
        playhead.style.display = 'block';
        playhead.style.left = (pct * rect.width) + 'px';
    }
    tick();
}

function chopStopPlayheadTracker() {
    if (chopPlayheadRAF) cancelAnimationFrame(chopPlayheadRAF);
    chopPlayheadRAF = null;
}

function chopDrawWaveform() {
    if (!chopAudioBuffer) return;
    var canvas = document.getElementById('chopWaveform');
    var ctx = canvas.getContext('2d');
    var data = chopAudioBuffer.getChannelData(0);
    var step = Math.ceil(data.length / canvas.width);
    var amp = canvas.height / 2;
    var dur = chopAudioBuffer.duration;

    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Build segment boundaries for coloring
    var allMarkers = [0].concat(chopMarkers.slice().sort(function(a,b){return a-b})).concat([dur]);

    // Draw waveform with segment coloring
    for (var px = 0; px < canvas.width; px++) {
        var sec = (px / canvas.width) * dur;
        // Determine which segment this pixel belongs to
        var segIdx = 0;
        for (var m = 0; m < allMarkers.length - 1; m++) {
            if (sec >= allMarkers[m] && sec < allMarkers[m + 1]) { segIdx = m; break; }
        }
        var isExcluded = !!chopExcluded[segIdx];

        var min = 1.0, max = -1.0;
        for (var j = 0; j < step; j++) {
            var datum = data[px * step + j] || 0;
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }

        if (isExcluded) {
            ctx.fillStyle = 'rgba(100,100,100,0.3)';
        } else {
            // Alternate colors for adjacent segments
            ctx.fillStyle = segIdx % 2 === 0 ? '#667eea' : '#34d399';
        }
        ctx.fillRect(px, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw split markers as draggable handles
    chopMarkers.forEach(function(sec, idx) {
        var x = (sec / dur) * canvas.width;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        // Draw handle triangle at top
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(x - 5, 0);
        ctx.lineTo(x + 5, 0);
        ctx.lineTo(x, 8);
        ctx.fill();
        // Label
        ctx.fillStyle = 'rgba(245,158,11,0.9)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatChopTime(sec), x, canvas.height - 2);
    });

    // Highlight selected segment
    if (chopSelectedSegment >= 0) {
        var selStart = allMarkers[chopSelectedSegment];
        var selEnd = allMarkers[Math.min(chopSelectedSegment + 1, allMarkers.length - 1)];
        if (selStart !== undefined && selEnd !== undefined) {
            var x1 = (selStart / dur) * canvas.width;
            var x2 = (selEnd / dur) * canvas.width;
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x1, 0, x2 - x1, canvas.height);
            ctx.setLineDash([]);
            if (chopSettingBoundary === 'start') {
                ctx.fillStyle = 'rgba(245,158,11,0.3)';
                ctx.fillRect(x1 - 3, 0, 6, canvas.height);
            } else if (chopSettingBoundary === 'end') {
                ctx.fillStyle = 'rgba(245,158,11,0.3)';
                ctx.fillRect(x2 - 3, 0, 6, canvas.height);
            }
        }
    }
}

function chopDetectSilence() {
    if (!chopAudioBuffer) { showToast('Load an audio file first'); return; }
    var threshold = parseFloat(document.getElementById('chopThreshold')?.value || 0.015);
    var minGapSec = parseFloat(document.getElementById('chopMinGap')?.value || 3);
    var data = chopAudioBuffer.getChannelData(0);
    var sampleRate = chopAudioBuffer.sampleRate;
    var minSilenceSamples = minGapSec * sampleRate;

    var windowSize = Math.floor(sampleRate * 0.1);
    var silenceStart = -1;
    chopMarkers = [];
    chopExcluded = {};

    for (var i = 0; i < data.length; i += windowSize) {
        var sum = 0;
        var end = Math.min(i + windowSize, data.length);
        for (var j = i; j < end; j++) { sum += data[j] * data[j]; }
        var rms = Math.sqrt(sum / (end - i));

        if (rms < threshold) {
            if (silenceStart < 0) silenceStart = i;
        } else {
            if (silenceStart >= 0 && (i - silenceStart) >= minSilenceSamples) {
                var midpoint = (silenceStart + i) / 2 / sampleRate;
                chopMarkers.push(midpoint);
            }
            silenceStart = -1;
        }
    }

    chopDrawWaveform();
    chopRenderSegments();
    showToast('Found ' + chopMarkers.length + ' pause' + (chopMarkers.length !== 1 ? 's' : '') + ' — drag markers to adjust');
}

function chopAddMarker() {
    if (!chopAudioBuffer) return;
    var audio = document.getElementById('chopAudio');
    var time = audio?.currentTime || chopAudioBuffer.duration / 2;
    chopMarkers.push(time);
    chopMarkers.sort(function(a, b) { return a - b; });
    chopDrawWaveform();
    chopRenderSegments();
}

function chopRemoveMarker(index) {
    // When removing a marker, merge excluded state
    if (chopExcluded[index + 1]) delete chopExcluded[index + 1];
    chopMarkers.splice(index, 1);
    // Rebuild excluded map with shifted indices
    var newExcluded = {};
    Object.keys(chopExcluded).forEach(function(k) {
        var ki = parseInt(k);
        if (ki > index + 1) newExcluded[ki - 1] = true;
        else if (ki <= index) newExcluded[ki] = true;
    });
    chopExcluded = newExcluded;
    chopDrawWaveform();
    chopRenderSegments();
}

function chopToggleExclude(segIndex) {
    if (chopExcluded[segIndex]) delete chopExcluded[segIndex];
    else chopExcluded[segIndex] = true;
    chopDrawWaveform();
    chopRenderSegments();
}

function chopRenderSegments() {
    var el = document.getElementById('chopSegments');
    if (!el || !chopAudioBuffer) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var allMarkers = [0].concat(sorted).concat([dur]);
    var songOpts = typeof allSongs !== 'undefined' ? allSongs.map(function(s) { return '<option value="' + (s.title||'').replace(/"/g,'&quot;') + '">' + (s.title||'') + '</option>'; }).join('') : '';

    var activeCount = 0;
    for (var k = 0; k < allMarkers.length - 1; k++) { if (!chopExcluded[k]) activeCount++; }

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    html += '<div style="font-weight:700;font-size:0.88em">🎵 Segments (' + activeCount + ' active / ' + (allMarkers.length - 1) + ' total)</div>';
    html += '<div style="font-size:0.68em;color:var(--text-dim)">Click a time to set boundary on waveform</div>';
    html += '</div>';

    for (var i = 0; i < allMarkers.length - 1; i++) {
        var startSec = allMarkers[i];
        var endSec = allMarkers[i + 1];
        var segDuration = endSec - startSec;
        var isExcluded = !!chopExcluded[i];
        var isSel = chopSelectedSegment === i;

        html += '<div class="app-card" style="margin-bottom:4px;padding:8px 10px;display:flex;align-items:center;gap:6px;opacity:' + (isExcluded ? '0.4' : '1') + ';border-left:3px solid ' + (isSel ? '#f59e0b' : (isExcluded ? '#666' : (i % 2 === 0 ? '#667eea' : '#34d399'))) + ';' + (isSel ? 'background:rgba(245,158,11,0.08)' : '') + '">';

        html += '<div style="font-size:0.7em;color:var(--text-dim);width:100px;flex-shrink:0">';
        html += '<div style="display:flex;align-items:center;gap:2px">';
        html += "<button onclick=\"chopSelectBoundary(" + i + ",'start')\" ondblclick=\"chopEditTime(event," + i + ",'start')\" style=\"background:none;border:1px solid " + (isSel && chopSettingBoundary === 'start' ? '#f59e0b' : 'transparent') + ";border-radius:3px;cursor:pointer;padding:1px 3px;color:var(--text);font-size:1em;font-family:monospace\" title=\"Click: set on waveform · Double-click: type time\">" + formatChopTime(startSec) + "</button>";
        html += '<span> \u2013 </span>';
        html += "<button onclick=\"chopSelectBoundary(" + i + ",'end')\" ondblclick=\"chopEditTime(event," + i + ",'end')\" style=\"background:none;border:1px solid " + (isSel && chopSettingBoundary === 'end' ? '#f59e0b' : 'transparent') + ";border-radius:3px;cursor:pointer;padding:1px 3px;color:var(--text);font-size:1em;font-family:monospace\" title=\"Click: set on waveform · Double-click: type time\">" + formatChopTime(endSec) + "</button>";
        html += '</div>';
        html += '<div style="font-size:0.85em;margin-top:1px">(' + formatChopTime(segDuration) + ')</div>';
        html += '</div>';

        if (!isExcluded) {
            html += '<select class="app-select" id="chopSong_' + i + '" style="flex:1;font-size:0.8em"><option value="">— Choose song —</option>' + songOpts + '</select>';
        } else {
            html += '<div style="flex:1;font-size:0.78em;color:#666;font-style:italic">Excluded</div>';
        }

        html += '<div style="display:flex;gap:2px;flex-shrink:0">';
        html += '<button onclick="chopPreviewSegment(' + startSec + ',' + endSec + ')" class="btn btn-sm btn-ghost" style="font-size:0.72em;padding:3px 6px" title="Preview">▶</button>';
        html += '<button onclick="chopToggleExclude(' + i + ')" style="background:none;border:none;cursor:pointer;font-size:0.8em;padding:2px" title="' + (isExcluded ? 'Include' : 'Exclude') + '">' + (isExcluded ? '➕' : '🚫') + '</button>';
        if (i > 0) html += '<button onclick="chopRemoveMarker(' + (i - 1) + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8em;padding:2px" title="Merge with previous">✕</button>';
        html += '</div></div>';
    }
    html += '<button class="btn btn-success" onclick="chopSaveAll()" style="width:100%;margin-top:8px">💾 Save All Named Segments as Takes</button>';
    el.innerHTML = html;
}

// Parse m:ss time string to seconds
function parseChopTime(str) {
    var parts = str.trim().split(':');
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    return parseFloat(str) || 0;
}

// Update marker time from editable inputs
function chopUpdateTime(segIndex, isStart) {
    if (!chopAudioBuffer) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});

    var inputId = isStart ? 'chopStart_' + segIndex : 'chopEnd_' + segIndex;
    var input = document.getElementById(inputId);
    if (!input) return;
    var newSec = parseChopTime(input.value);
    newSec = Math.max(0, Math.min(newSec, dur));

    if (isStart && segIndex > 0) {
        var markerVal = sorted[segIndex - 1];
        var origIdx = chopMarkers.indexOf(markerVal);
        if (origIdx >= 0) chopMarkers[origIdx] = newSec;
    } else if (!isStart && segIndex < sorted.length) {
        var markerVal = sorted[segIndex];
        var origIdx = chopMarkers.indexOf(markerVal);
        if (origIdx >= 0) chopMarkers[origIdx] = newSec;
    }

    chopMarkers.sort(function(a,b){return a-b});
    chopDrawWaveform();
    chopRenderSegments();
}

function chopSelectBoundary(segIndex, which) {
    if (chopSelectedSegment === segIndex && chopSettingBoundary === which) {
        chopSelectedSegment = -1;
        chopSettingBoundary = null;
    } else {
        chopSelectedSegment = segIndex;
        chopSettingBoundary = which;
    }
    chopDrawWaveform();
    chopRenderSegments();
    if (chopSettingBoundary) showToast('Click on the waveform to set ' + which + ' point');
}

function chopSetBoundary(sec) {
    if (chopSelectedSegment < 0 || !chopSettingBoundary || !chopAudioBuffer) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var allMarkers = [0].concat(sorted).concat([dur]);
    var seg = chopSelectedSegment;
    sec = Math.max(0.1, Math.min(sec, dur - 0.1));

    if (chopSettingBoundary === 'start') {
        if (seg === 0) {
            chopMarkers.push(sec);
            chopMarkers.sort(function(a,b){return a-b});
            var newExcluded = {0: true};
            Object.keys(chopExcluded).forEach(function(k) { newExcluded[parseInt(k) + 1] = chopExcluded[k]; });
            chopExcluded = newExcluded;
        } else {
            var markerVal = sorted[seg - 1];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = sec;
        }
    } else {
        if (seg >= allMarkers.length - 2) {
            chopMarkers.push(sec);
            chopMarkers.sort(function(a,b){return a-b});
            var newAll = [0].concat(chopMarkers.slice().sort(function(a,b){return a-b})).concat([dur]);
            chopExcluded[newAll.length - 2] = true;
        } else {
            var markerVal = sorted[seg];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = sec;
        }
    }

    chopMarkers.sort(function(a,b){return a-b});
    chopSettingBoundary = null;
    chopSelectedSegment = -1;
    chopDrawWaveform();
    chopRenderSegments();
    showToast('Boundary set');
}

function chopEditTime(event, segIndex, which) {
    event.preventDefault();
    event.stopPropagation();
    var btn = event.target;
    var currentTime = btn.textContent.trim();
    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentTime;
    input.style.cssText = 'width:55px;background:rgba(0,0,0,0.5);border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;font-size:1em;font-family:monospace;padding:1px 3px;text-align:center';
    input.placeholder = 'm:ss';
    btn.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
        var newSec = parseChopTime(input.value);
        if (!chopAudioBuffer) return;
        var dur = chopAudioBuffer.duration;
        newSec = Math.max(0.1, Math.min(newSec, dur - 0.1));
        var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
        if (which === 'start' && segIndex > 0) {
            var markerVal = sorted[segIndex - 1];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = newSec;
        } else if (which === 'end' && segIndex < sorted.length) {
            var markerVal = sorted[segIndex];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = newSec;
        }
        chopMarkers.sort(function(a,b){return a-b});
        chopDrawWaveform();
        chopRenderSegments();
    }
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { chopRenderSegments(); }
    });
    input.addEventListener('blur', commit);
}

var chopPreviewTimeout = null;
function chopPreviewSegment(startSec, endSec) {
    var audio = document.getElementById('chopAudio');
    if (!audio) return;
    audio.currentTime = startSec;
    audio.play();
    // Auto-stop at end of segment
    if (chopPreviewTimeout) clearTimeout(chopPreviewTimeout);
    var duration = (endSec - startSec) * 1000;
    chopPreviewTimeout = setTimeout(function() { audio.pause(); }, duration);
}

async function chopSaveAll() {
    if (!chopAudioBuffer || !chopFile) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var allMarkers = [0].concat(sorted).concat([dur]);
    var saved = 0;
    var errors = 0;

    // Show progress
    var btn = document.querySelector('#chopSegments .btn-success');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

    for (var i = 0; i < allMarkers.length - 1; i++) {
        if (chopExcluded[i]) continue;
        var songTitle = document.getElementById('chopSong_' + i)?.value;
        if (!songTitle) continue;
        var startSec = allMarkers[i];
        var endSec = allMarkers[i + 1];
        var segDuration = endSec - startSec;
        var sampleRate = chopAudioBuffer.sampleRate;
        var startSample = Math.floor(startSec * sampleRate);
        var numSamples = Math.floor(segDuration * sampleRate);
        var numChannels = chopAudioBuffer.numberOfChannels;

        try {
            var offline = new OfflineAudioContext(numChannels, numSamples, sampleRate);
            var newBuffer = offline.createBuffer(numChannels, numSamples, sampleRate);
            for (var ch = 0; ch < numChannels; ch++) {
                var oldData = chopAudioBuffer.getChannelData(ch);
                var newData = newBuffer.getChannelData(ch);
                for (var s = 0; s < numSamples && (startSample + s) < oldData.length; s++) {
                    newData[s] = oldData[startSample + s];
                }
            }
            var source = offline.createBufferSource();
            source.buffer = newBuffer;
            source.connect(offline.destination);
            source.start();
            var rendered = await offline.startRendering();
            var wav = audioBufferToWav(rendered);
            // Use chunked btoa for large files
            var bytes = new Uint8Array(wav);
            var binary = '';
            for (var b = 0; b < bytes.length; b += 8192) {
                binary += String.fromCharCode.apply(null, bytes.subarray(b, Math.min(b + 8192, bytes.length)));
            }
            var base64 = btoa(binary);
            var dataUrl = 'data:audio/wav;base64,' + base64;

            // Download WAV file (too large for Firebase JSON storage)
            var wavBlob = new Blob([wav], { type: 'audio/wav' });
            var dlUrl = URL.createObjectURL(wavBlob);
            var dlLink = document.createElement('a');
            dlLink.href = dlUrl;
            dlLink.download = songTitle.replace(/[^a-z0-9]/gi, '_') + '_' + formatChopTime(startSec).replace(':','-') + '.wav';
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
            setTimeout(function() { URL.revokeObjectURL(dlUrl); }, 1000);
            var audioKey = 'chop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

            var take = {
                label: 'Rehearsal ' + (chopFile?.name || '').replace(/\.[^.]+$/, ''),
                uploadedBy: currentUserEmail,
                uploadedByName: bandMembers[currentUserEmail]?.name || '',
                audioUrl: 'downloaded:' + dlLink.download,
                externalUrl: '',
                recordedDate: new Date().toISOString().slice(0, 10),
                notes: 'Chopped: ' + formatChopTime(startSec) + '-' + formatChopTime(endSec) + ' from ' + (chopFile?.name || 'rehearsal'),
                uploadedAt: new Date().toISOString(),
                crowned: false
            };
            var existing = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
            if (!existing.length) take.crowned = true;
            existing.push(take);
            await saveBandDataToDrive(songTitle, 'best_shot_takes', existing);
            saved++;
            if (btn) btn.textContent = '⏳ Saved ' + saved + '...';
        } catch (err) {
            console.error('Error chopping segment ' + i + ':', err);
            errors++;
        }
    }
    var msg = '✂️ Saved ' + saved + ' segment' + (saved !== 1 ? 's' : '') + ' as takes!';
    if (errors) msg += ' (' + errors + ' failed)';
    showToast(msg);
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save All Named Segments as Takes'; }
    if (saved > 0 && !errors) document.getElementById('rehearsalChopperModal')?.remove();
}

function formatChopTime(sec) {
    if (sec >= 3600) {
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = Math.floor(sec % 60);
        return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// WAV encoder (PCM 16-bit)
function audioBufferToWav(buffer) {
    var numChannels = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var format = 1;
    var bitsPerSample = 16;
    var bytesPerSample = bitsPerSample / 8;
    var blockAlign = numChannels * bytesPerSample;
    var dataLength = buffer.length * blockAlign;
    var totalLength = 44 + dataLength;
    var arrayBuffer = new ArrayBuffer(totalLength);
    var view = new DataView(arrayBuffer);

    function writeString(offset, string) { for (var i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); }
    writeString(0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    var offset = 44;
    for (var i = 0; i < buffer.length; i++) {
        for (var ch = 0; ch < numChannels; ch++) {
            var sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }
    return arrayBuffer;
}

// // BEST SHOT — Overview Page (Gap Dashboard)
// ============================================================================
function renderBestShotPage(el) {
    // Lightweight overview — only loads status data, not full takes for every song
    el.innerHTML = '<div class="page-header"><h1>🏆 Best Shot</h1><p>Band recordings vs reference versions</p></div>' +
        '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:12px">Select a song to see its Section Scorecard, takes, and reference versions.</div>' +
        '<input class="app-input" id="bsOverviewSearch" placeholder="Search songs..." oninput="filterBestShotOverview()" style="margin-bottom:12px">' +
        '<div id="bsOverviewList"></div>';
    renderBestShotOverviewList();
}

async function renderBestShotOverviewList() {
    var el = document.getElementById('bsOverviewList');
    if (!el) return;
    var search = (document.getElementById('bsOverviewSearch')?.value || '').toLowerCase();
    var filtered = allSongs.filter(function(s) { return !search || s.title.toLowerCase().includes(search); });
    // Only show first 30 for performance
    var shown = filtered.slice(0, 30);
    var html = '';
    shown.forEach(function(song) {
        var status = song.status || '';
        var statusBadge = '';
        if (status === 'Gig Ready') statusBadge = '<span style="font-size:0.65em;background:rgba(16,185,129,0.15);color:#10b981;padding:1px 5px;border-radius:4px">✅</span>';
        else if (status === 'This Week') statusBadge = '<span style="font-size:0.65em;background:rgba(245,158,11,0.15);color:#f59e0b;padding:1px 5px;border-radius:4px">🎯</span>';
        html += '<div class="list-item" onclick="showPage(\'songs\');setTimeout(function(){selectSong({title:\'' + song.title.replace(/'/g, "\\'") + '\'});document.getElementById(\'step3bestshot\')?.scrollIntoView({behavior:\'smooth\'})},300)" style="cursor:pointer;padding:10px 12px">';
        html += '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.88em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + song.title + '</div>';
        html += '<div style="font-size:0.72em;color:var(--text-dim)">' + (song.artist || '') + '</div></div>';
        html += statusBadge + '</div></div>';
    });
    if (filtered.length > 30) {
        html += '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:0.82em">Showing 30 of ' + filtered.length + ' songs. Use search to narrow.</div>';
    }
    if (!filtered.length) {
        html += '<div style="text-align:center;padding:40px;color:var(--text-dim)">No songs match.</div>';
    }
    el.innerHTML = html;
}

function filterBestShotOverview() { renderBestShotOverviewList(); }

async function loadBestShotOverview() {
    var el = document.getElementById('bsOverviewGrid');
    if (!el) return;
    var songs = typeof allSongs !== 'undefined' ? allSongs : [];

    // Only show songs that have North Star OR best shots
    var relevantSongs = [];
    for (var si = 0; si < songs.length; si++) {
        var s = songs[si];
        var title = s.title || '';
        if (!title) continue;
        if (northStarCache[title]) { relevantSongs.push(s); continue; }
        // Check if it has best shot takes
        var takes = toArray(await loadBandDataFromDrive(title, 'best_shot_takes') || []);
        if (takes.length) relevantSongs.push(s);
    }

    if (!relevantSongs.length) {
        el.innerHTML = '<div class="app-card" style="text-align:center;padding:40px"><div style="font-size:2em;margin-bottom:8px">🏆</div><div style="color:var(--text-dim)">No songs with North Star references or recordings yet.</div><div style="font-size:0.82em;color:var(--text-dim);margin-top:8px">Add a reference version to any song to get started.</div></div>';
        return;
    }

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
    for (var i = 0; i < relevantSongs.length; i++) {
        var song = relevantSongs[i];
        var title = song.title;
        var ratings = await loadBandDataFromDrive(title, 'best_shot_ratings') || {};
        var takes = toArray(await loadBandDataFromDrive(title, 'best_shot_takes') || []);
        var hasNorthStar = !!northStarCache[title];

        var sections = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Jam', 'Outro'];
        var greenCount = 0, ratedCount = 0;
        sections.forEach(function(sec) {
            var sr = ratings[sec] || {};
            var vals = Object.values(sr);
            if (!vals.length) return;
            ratedCount++;
            var greens = vals.filter(function(v) { return v === 'green'; }).length;
            if (greens === vals.length) greenCount++;
        });
        var pct = ratedCount ? Math.round(greenCount / sections.length * 100) : 0;
        var statusColor = pct >= 80 ? '#10b981' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#ef4444' : 'var(--text-dim)';
        var statusLabel = pct >= 80 ? '🔥 Almost there' : pct >= 40 ? '💪 Making progress' : pct > 0 ? '🎯 Keep working' : 'Not rated';

        html += '<div class="app-card" style="cursor:pointer;padding:14px;transition:all 0.15s" onclick="selectSong(\'' + title.replace(/'/g, "\\'") + '\');showPage(\'songs\')" onmouseover="this.style.borderColor=\'rgba(102,126,234,0.3)\'" onmouseout="this.style.borderColor=\'\'">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
        html += '<div style="font-weight:700;font-size:0.9em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + title + '</div>';
        html += '<div style="display:flex;gap:4px;flex-shrink:0">';
        if (hasNorthStar) html += '<span style="font-size:0.7em;padding:2px 6px;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.2);border-radius:4px;color:var(--accent-light)">⭐</span>';
        if (takes.length) html += '<span style="font-size:0.7em;padding:2px 6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:4px;color:#f59e0b">🏆 ' + takes.length + '</span>';
        html += '</div></div>';

        // Mini progress bar
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
        html += '<div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,0.06);overflow:hidden">';
        html += '<div style="width:' + pct + '%;height:100%;background:' + statusColor + ';border-radius:3px;transition:width 0.3s"></div>';
        html += '</div>';
        html += '<div style="font-size:0.75em;font-weight:700;color:' + statusColor + '">' + greenCount + '/' + sections.length + '</div>';
        html += '</div>';

        // Section dots
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
        sections.forEach(function(sec) {
            var sr = ratings[sec] || {};
            var vals = Object.values(sr);
            var dot = '⬜';
            if (vals.length) {
                var greens = vals.filter(function(v) { return v === 'green'; }).length;
                var reds = vals.filter(function(v) { return v === 'red'; }).length;
                if (greens === vals.length) dot = '🟢';
                else if (reds > greens) dot = '🔴';
                else dot = '🟡';
            }
            html += '<span style="font-size:0.55em;display:flex;align-items:center;gap:1px;color:var(--text-dim)">' + dot + '<span style="font-size:0.9em">' + sec.slice(0,3) + '</span></span>';
        });
        html += '</div>';

        html += '<div style="font-size:0.72em;color:' + statusColor + ';margin-top:6px">' + statusLabel + '</div>';
        html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
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

console.log('🔗 GrooveLinx modules loaded');

// Register new pages
pageRenderers.equipment = renderEquipmentPage;
pageRenderers.contacts = renderContactsPage;
pageRenderers.admin = renderSettingsPage;

// ---- SETTINGS (Enhanced with tabs) ----
function renderSettingsPage(el) {
    el.innerHTML = `
    <div class="page-header"><h1>⚙️ Settings & Admin</h1><p>Configuration, band management, support</p></div>
    <div class="tab-bar" id="settingsTabs" style="flex-wrap:wrap;overflow-x:visible">
        <button class="tab-btn active" onclick="settingsTab('profile',this)">👤 Profile</button>
        <button class="tab-btn" onclick="settingsTab('band',this)">🎸 Band</button>
        <button class="tab-btn" onclick="settingsTab('data',this)">📊 Data</button>
        <button class="tab-btn" onclick="settingsTab('feedback',this)">🐛 Bugs</button>
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
    const bn = localStorage.getItem('deadcetera_band_name') || 'GrooveLinx';
    
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
                <button class="btn btn-success btn-sm" onclick="addNewMember()" style="margin-top:8px">+ Add Member</button>
            </div>
        </div>
        <div class="app-card"><h3>&#127760; Multi-Band</h3>
            <div style="font-size:0.88em;color:var(--text-muted);margin-bottom:12px">Current band: <strong style="color:var(--accent-light)">${currentBandSlug}</strong></div>
            <button class="btn btn-primary" onclick="showCreateBandModal()">+ Create New Band</button>
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
                <div>🎸 Band data: <code style="color:var(--accent-light)">/bands/${currentBandSlug}/</code></div>
                <div>📁 Files: Google Drive (shared folder)</div>
                <div>🌐 Hosting: GitHub Pages</div>
                <div style="margin-top:6px">📊 Songs in database: <b style="color:var(--text)">${(typeof allSongs!=='undefined'?allSongs:[]).length}</b></div>
            </div>
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
        <div class="app-card"><h3>ℹ️ About GrooveLinx</h3>
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

// ============================================================================
// BAND CREATION + MANAGEMENT (Multi-Band Architecture Stage 3)
// ============================================================================

function showCreateBandModal() {
    var overlay = document.getElementById('createBandOverlay');
    if (overlay) { overlay.style.display = 'flex'; return; }
    overlay = document.createElement('div');
    overlay.id = 'createBandOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.2s';
    overlay.innerHTML = '<div style="background:var(--card-bg,#1a2340);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:16px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;padding:24px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
            '<h2 style="margin:0;font-size:1.2em">Create a New Band</h2>' +
            '<button onclick="document.getElementById(\'createBandOverlay\').style.display=\'none\'" style="background:none;border:none;color:var(--text-muted);font-size:1.3em;cursor:pointer">&#x2715;</button>' +
        '</div>' +
        '<div id="cbStep1">' +
            '<label class="form-label" style="margin-bottom:6px;display:block">Band Name</label>' +
            '<input id="cbName" class="app-input" placeholder="e.g. Deadcetera, The Groove Machine" style="width:100%;margin-bottom:16px" autocomplete="off">' +
            '<label class="form-label" style="margin-bottom:6px;display:block">What does your band play?</label>' +
            '<div id="cbCatalogGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">' +
                createCatalogCheckboxes() +
            '</div>' +
            '<label class="form-label" style="margin-bottom:6px;display:block">Your Name</label>' +
            '<input id="cbOwnerName" class="app-input" placeholder="Your first name" style="width:100%;margin-bottom:6px" autocomplete="off">' +
            '<label class="form-label" style="margin-bottom:6px;display:block">Your Role</label>' +
            '<input id="cbOwnerRole" class="app-input" placeholder="e.g. Guitar, Vocals, Drums" style="width:100%;margin-bottom:20px" autocomplete="off">' +
            '<button class="btn btn-primary" onclick="submitCreateBand()" style="width:100%;padding:14px;font-size:1em;font-weight:700">Create Band</button>' +
        '</div>' +
        '<div id="cbStep2" style="display:none;text-align:center">' +
            '<div style="font-size:2.5em;margin-bottom:12px">&#127928;</div>' +
            '<h3 id="cbCreatedName" style="margin-bottom:8px"></h3>' +
            '<p style="color:var(--text-muted);font-size:0.88em;margin-bottom:20px">Your band is ready! Share this invite link with your bandmates:</p>' +
            '<div style="background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;word-break:break-all">' +
                '<code id="cbInviteLink" style="color:var(--accent-light);font-size:0.85em"></code>' +
            '</div>' +
            '<button onclick="copyInviteLink()" class="btn btn-primary" style="width:100%;margin-bottom:10px">Copy Invite Link</button>' +
            '<button onclick="switchToBand(document.getElementById(\'cbCreatedSlug\').value)" class="btn btn-ghost" style="width:100%">Open Band Now</button>' +
            '<input type="hidden" id="cbCreatedSlug">' +
        '</div>' +
    '</div>';
    document.body.appendChild(overlay);
}

function createCatalogCheckboxes() {
    var catalogs = [
        { id: 'GD', label: 'Grateful Dead', emoji: '&#9760;&#65039;' },
        { id: 'JGB', label: 'Jerry Garcia Band', emoji: '&#127928;' },
        { id: 'Phish', label: 'Phish', emoji: '&#128031;' },
        { id: 'WSP', label: 'Widespread Panic', emoji: '&#127908;' },
        { id: 'ABB', label: 'Allman Brothers', emoji: '&#127925;' },
        { id: 'Goose', label: 'Goose', emoji: '&#129414;' },
        { id: 'DMB', label: 'Dave Matthews Band', emoji: '&#127926;' },
        { id: 'originals', label: 'Originals', emoji: '&#11088;' }
    ];
    return catalogs.map(function(c) {
        return '<label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all 0.15s" ' +
            'onchange="this.style.borderColor=this.querySelector(\'input\').checked?\'rgba(102,126,234,0.5)\':\'var(--border)\';this.style.background=this.querySelector(\'input\').checked?\'rgba(102,126,234,0.08)\':\'rgba(255,255,255,0.03)\'">' +
            '<input type="checkbox" value="' + c.id + '" name="cbCatalog" style="accent-color:var(--accent);width:16px;height:16px">' +
            '<span>' + c.emoji + ' ' + c.label + '</span></label>';
    }).join('');
}

async function submitCreateBand() {
    var nameInput = document.getElementById('cbName');
    var ownerName = document.getElementById('cbOwnerName');
    var ownerRole = document.getElementById('cbOwnerRole');
    var name = (nameInput ? nameInput.value : '').trim();
    var owner = (ownerName ? ownerName.value : '').trim();
    var role = (ownerRole ? ownerRole.value : '').trim();

    if (!name) { showToast('Please enter a band name'); return; }
    if (!owner) { showToast('Please enter your name'); return; }

    // Generate slug from band name
    var slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) { showToast('Invalid band name'); return; }

    // Collect selected catalogs
    var catalogs = [];
    document.querySelectorAll('input[name="cbCatalog"]:checked').forEach(function(cb) {
        catalogs.push(cb.value);
    });

    // Generate invite code
    var inviteCode = slug + '-' + Math.random().toString(36).substr(2, 6);

    if (!firebaseDB) {
        showToast('Firebase not connected. Please sign in first.');
        return;
    }

    // Check if slug already exists
    try {
        var existing = await firebaseDB.ref('bands/' + slug + '/meta').once('value');
        if (existing.val()) {
            showToast('A band with that name already exists. Try a different name.');
            return;
        }
    } catch(e) { /* proceed */ }

    // Create the band in Firebase
    var ownerKey = owner.toLowerCase().replace(/\s/g, '');
    var memberEntry = {};
    memberEntry[ownerKey] = {
        name: owner,
        role: role || 'Member',
        email: currentUserEmail || '',
        joined: Date.now(),
        isOwner: true
    };

    var bandMeta = {
        name: name,
        slug: slug,
        createdAt: Date.now(),
        createdBy: currentUserEmail || ownerKey,
        catalog: catalogs,
        inviteCode: inviteCode,
        members: memberEntry
    };

    try {
        await firebaseDB.ref('bands/' + slug + '/meta').set(bandMeta);
        console.log('Band created:', slug);

        // Show success step
        document.getElementById('cbStep1').style.display = 'none';
        document.getElementById('cbStep2').style.display = 'block';
        document.getElementById('cbCreatedName').textContent = name;
        document.getElementById('cbCreatedSlug').value = slug;
        var inviteUrl = window.location.origin + window.location.pathname + '?join=' + inviteCode;
        document.getElementById('cbInviteLink').textContent = inviteUrl;

        showToast('Band created!');
    } catch(err) {
        console.error('Error creating band:', err);
        showToast('Error creating band. Try again.');
    }
}

function copyInviteLink() {
    var link = document.getElementById('cbInviteLink');
    if (!link) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link.textContent).then(function() {
            showToast('Invite link copied!');
        });
    } else {
        // Fallback
        var range = document.createRange();
        range.selectNodeContents(link);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        showToast('Invite link copied!');
    }
}

async function switchToBand(slug) {
    if (!slug) return;
    // Verify band exists
    if (firebaseDB) {
        try {
            var snap = await firebaseDB.ref('bands/' + slug + '/meta').once('value');
            if (!snap.val()) { showToast('Band not found'); return; }
        } catch(e) { /* proceed optimistically */ }
    }

    currentBandSlug = slug;
    localStorage.setItem('deadcetera_current_band', slug);

    // Close modal
    var overlay = document.getElementById('createBandOverlay');
    if (overlay) overlay.style.display = 'none';

    // Reload to pick up new band data
    showToast('Switching to ' + slug + '...');
    setTimeout(function() { location.reload(); }, 800);
}

// ── Join via invite link ────────────────────────────────────────────────────
async function checkInviteLink() {
    var params = new URLSearchParams(window.location.search);
    var joinCode = params.get('join');
    if (!joinCode) return;

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);

    if (!firebaseDB) {
        showToast('Please sign in first to join a band');
        return;
    }

    // Parse invite code: slug-randomchars
    var dashIdx = joinCode.lastIndexOf('-');
    if (dashIdx < 1) { showToast('Invalid invite link'); return; }
    var slug = joinCode.substring(0, dashIdx);

    try {
        var snap = await firebaseDB.ref('bands/' + slug + '/meta').once('value');
        var meta = snap.val();
        if (!meta) { showToast('Band not found'); return; }
        if (meta.inviteCode !== joinCode) { showToast('Invalid or expired invite code'); return; }

        // Check if already a member
        var memberKey = getCurrentMemberKey();
        if (meta.members && meta.members[memberKey]) {
            showToast('You are already in ' + meta.name + '!');
            switchToBand(slug);
            return;
        }

        // Ask to join
        if (!confirm('Join ' + meta.name + '?')) return;

        // Get user info from existing bandMembers or show join form
        var memberKey = getCurrentMemberKey();
        var knownName = (memberKey && bandMembers[memberKey]) ? bandMembers[memberKey].name : null;
        var knownRole = (memberKey && bandMembers[memberKey]) ? bandMembers[memberKey].role : null;

        if (knownName) {
            // Already identified user — join directly
            var userKey = knownName.toLowerCase().replace(/\s/g, '');
            var memberData = {
                name: knownName,
                role: knownRole || 'Member',
                email: currentUserEmail || '',
                joined: Date.now()
            };
            await firebaseDB.ref('bands/' + slug + '/meta/members/' + userKey).set(memberData);
            showToast('Welcome to ' + meta.name + '!');
            switchToBand(slug);
        } else {
            // Show join form modal (no prompt() — iOS safe)
            showJoinBandForm(slug, meta.name);
        }
    } catch(err) {
        console.error('Join error:', err);
        showToast('Error joining band');
    }
}

function showJoinBandForm(slug, bandName) {
    var overlay = document.createElement('div');
    overlay.id = 'joinBandOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = '<div style="background:var(--card-bg,#1a2340);border:1px solid var(--border);border-radius:16px;width:100%;max-width:400px;padding:24px">' +
        '<h2 style="margin:0 0 8px 0;font-size:1.15em">Join ' + bandName + '</h2>' +
        '<p style="color:var(--text-muted);font-size:0.88em;margin-bottom:16px">Tell us who you are:</p>' +
        '<label class="form-label" style="display:block;margin-bottom:4px">Your Name</label>' +
        '<input id="jbName" class="app-input" placeholder="First name" style="width:100%;margin-bottom:12px" autocomplete="off">' +
        '<label class="form-label" style="display:block;margin-bottom:4px">Your Role</label>' +
        '<input id="jbRole" class="app-input" placeholder="e.g. Guitar, Bass, Drums" style="width:100%;margin-bottom:16px" autocomplete="off">' +
        '<button class="btn btn-primary" onclick="confirmJoinBand(\'' + slug + '\')" style="width:100%;padding:12px;font-weight:700">Join Band</button>' +
        '<button onclick="document.getElementById(\'joinBandOverlay\').remove()" class="btn btn-ghost" style="width:100%;margin-top:8px">Cancel</button>' +
    '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() { var el = document.getElementById('jbName'); if (el) el.focus(); }, 100);
}

async function confirmJoinBand(slug) {
    var nameEl = document.getElementById('jbName');
    var roleEl = document.getElementById('jbRole');
    var name = (nameEl ? nameEl.value : '').trim();
    var role = (roleEl ? roleEl.value : '').trim();
    if (!name) { showToast('Please enter your name'); return; }

    var userKey = name.toLowerCase().replace(/\s/g, '');
    var memberData = {
        name: name,
        role: role || 'Member',
        email: currentUserEmail || '',
        joined: Date.now()
    };

    try {
        await firebaseDB.ref('bands/' + slug + '/meta/members/' + userKey).set(memberData);
        var overlay = document.getElementById('joinBandOverlay');
        if (overlay) overlay.remove();
        showToast('Welcome to the band!');
        switchToBand(slug);
    } catch(err) {
        console.error('Join error:', err);
        showToast('Error joining band');
    }
}

// ---- EQUIPMENT (#28) ----
function renderEquipmentPage(el){el.innerHTML='<div class="page-header"><h1>🎛️ Equipment</h1><p>Band gear inventory</p></div><button class="btn btn-primary" onclick="addEquipment()" style="margin-bottom:12px">+ Add Gear</button><div id="equipList"></div>';loadEquipment();}
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
    el.innerHTML = Object.entries(g).map(function([o, items]) { return '<div class="app-card"><h3>' + (bandMembers[o]?.name || 'Shared / Band') + '</h3>' + items.map(function(i) { return '<div class="list-item" style="padding:8px 10px"><div style="display:flex;gap:10px;flex:1;align-items:center">' + (i.photoUrl ? '<img src="' + i.photoUrl + '" style="width:48px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0">' : '') + '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.9em">' + (i.name || '') + '</div><div style="font-size:0.78em;color:var(--text-muted)">' + [i.brand, i.model, i.category].filter(Boolean).join(' · ') + '</div>' + (i.serial ? '<div style="font-size:0.72em;color:var(--text-dim)">S/N: ' + i.serial + '</div>' : '') + (i.value ? '<div style="font-size:0.72em;color:var(--text-dim)">Value: $' + i.value + '</div>' : '') + (i.notes ? '<div style="font-size:0.75em;color:var(--text-dim);margin-top:2px">' + i.notes + '</div>' : '') + '</div></div><div style="display:flex;gap:6px;align-items:center">' + (i.manualUrl ? '<a href="' + i.manualUrl + '" target="_blank" class="btn btn-sm btn-ghost">📄</a>' : '') + '<button onclick="editEquipment(' + i._idx + ')" style="background:none;border:none;color:#818cf8;cursor:pointer;font-size:1em;padding:4px" title="Edit">✏️</button><button onclick="deleteEquip(' + i._idx + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1em;padding:4px" title="Delete">🗑️</button></div></div>'; }).join('') + '</div>'; }).join('');
}
function equipFormHtml(item) {
    var it = item || {};
    return '<div class="form-grid">' + [['Name','eqN',it.name||'',''],['Category','eqC',it.category||'other','select:amp,guitar,pedal,mic,cable,pa,drum,keys,other'],['Brand','eqB',it.brand||'',''],['Model','eqM',it.model||'',''],['Owner','eqO',it.owner||'','members'],['Serial #','eqS',it.serial||'',''],['Manual URL','eqU',it.manualUrl||'',''],['Value ($)','eqV',it.value||'','number'],['Photo URL','eqP',it.photoUrl||'','']].map(function(f) {
        var l=f[0], id=f[1], val=f[2], t=f[3];
        if(t==='members') return '<div class="form-row"><label class="form-label">'+l+'</label><select class="app-select" id="'+id+'"><option value="">Shared</option>'+Object.entries(bandMembers).map(function(e){return'<option value="'+e[0]+'"'+(val===e[0]?' selected':'')+'>'+e[1].name+'</option>';}).join('')+'</select></div>';
        if(t.startsWith('select:')) return '<div class="form-row"><label class="form-label">'+l+'</label><select class="app-select" id="'+id+'">'+t.slice(7).split(',').map(function(v){return'<option value="'+v+'"'+(val===v?' selected':'')+'>'+v+'</option>';}).join('')+'</select></div>';
        return '<div class="form-row"><label class="form-label">'+l+'</label><input class="app-input" id="'+id+'" '+(t==='number'?'type="number"':'')+' placeholder="'+l+'" value="'+(val||'').replace(/"/g,'&quot;')+'"></div>';
    }).join('') + '</div><div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="eqNotes">' + (it.notes || '') + '</textarea></div>' +
    '<div style="margin-top:6px;display:flex;align-items:center;gap:8px">' +
    '<button type="button" onclick="equipPickPhoto()" class="btn btn-ghost btn-sm" style="font-size:0.78em">📸 Take/Choose Photo</button>' +
    '<span id="eqPhotoPreview">' + (it.photoUrl ? '<img src="' + it.photoUrl + '" style="width:40px;height:40px;border-radius:6px;object-fit:cover">' : '') + '</span>' +
    '<input type="file" id="eqPhotoFile" accept="image/*" capture="environment" style="display:none">' +
    '</div>';
}
function addEquipment(){var el=document.getElementById('equipList');el.innerHTML='<div class="app-card"><h3>Add Gear</h3>' + equipFormHtml() + '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" onclick="saveEquip(-1)">💾 Save</button><button class="btn btn-ghost" onclick="loadEquipment()">Cancel</button></div></div>'+el.innerHTML;}

async function editEquipment(index) {
    var existing = toArray(await loadBandDataFromDrive('_band', 'equipment') || []);
    var item = existing[index];
    if (!item) return;
    var el = document.getElementById('equipList');
    el.innerHTML = '<div class="app-card"><h3>Edit Gear</h3>' + equipFormHtml(item) + '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" onclick="saveEquip(' + index + ')">💾 Update</button><button class="btn btn-ghost" onclick="loadEquipment()">Cancel</button></div></div>';
}

async function saveEquip(editIndex) {
    var item = {
        name: document.getElementById('eqN')?.value?.trim() || '',
        category: document.getElementById('eqC')?.value || 'other',
        brand: document.getElementById('eqB')?.value?.trim() || '',
        model: document.getElementById('eqM')?.value?.trim() || '',
        owner: document.getElementById('eqO')?.value || '',
        serial: document.getElementById('eqS')?.value?.trim() || '',
        manualUrl: document.getElementById('eqU')?.value?.trim() || '',
        value: document.getElementById('eqV')?.value || '',
        photoUrl: document.getElementById('eqP')?.value?.trim() || '',
        notes: document.getElementById('eqNotes')?.value?.trim() || '',
        addedAt: new Date().toISOString(),
        addedBy: currentUserEmail
    };
    if (!item.name) { showToast('Enter a name for this gear'); return; }
    var existing = toArray(await loadBandDataFromDrive('_band', 'equipment') || []);
    if (editIndex >= 0 && editIndex < existing.length) {
        item.addedAt = existing[editIndex].addedAt || item.addedAt;
        item.addedBy = existing[editIndex].addedBy || item.addedBy;
        item.updatedAt = new Date().toISOString();
        existing[editIndex] = item;
    } else {
        existing.push(item);
    }
    await saveBandDataToDrive('_band', 'equipment', existing);
    showToast(editIndex >= 0 ? '✅ Gear updated!' : '✅ Gear saved!');
    await loadEquipment();
}

async function deleteEquip(index) {
    const existing = toArray(await loadBandDataFromDrive('_band', 'equipment') || []);
    existing.splice(index, 1);
    await saveBandDataToDrive('_band', 'equipment', existing);
    showToast('🗑️ Gear removed');
    await loadEquipment();
}

function equipPickPhoto() {
    var fileInput = document.getElementById('eqPhotoFile');
    if (!fileInput) return;
    fileInput.onchange = function() {
        var file = fileInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            showToast('Photo must be under 2 MB');
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            // Resize to max 400px for storage efficiency
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                var maxDim = 400;
                var w = img.width, h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                    else { w = Math.round(w * maxDim / h); h = maxDim; }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('eqP').value = dataUrl;
                var preview = document.getElementById('eqPhotoPreview');
                if (preview) preview.innerHTML = '<img src="' + dataUrl + '" style="width:40px;height:40px;border-radius:6px;object-fit:cover">';
                showToast('✅ Photo attached');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
    fileInput.click();
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
// loadGigHistory() → js/features/gigs.js

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
//   /bands/{slug}/listening_parties/{playlistId}
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
        await firebaseDB.ref(bandPath(`listening_parties/${playlistId}`)).remove().catch(() => {});
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

    await firebaseDB.ref(bandPath(`listening_parties/${playlistId}`)).set(partyData);
    console.log('🎉 Listening Party started:', playlistId);
    await joinListeningParty(playlistId, songs);
    return partyData;
}

async function joinListeningParty(playlistId, songs) {
    if (!firebaseDB) return;
    const userKey = getCurrentMemberKey() || 'unknown';

    // Register presence
    const presenceRef = firebaseDB.ref(bandPath(`listening_parties/${playlistId}/presence/${userKey}`));
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
    _partyListener = firebaseDB.ref(bandPath(`listening_parties/${playlistId}`));

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
        firebaseDB.ref(bandPath(`listening_parties/${_partyPlaylistId}/presence/${userKey}`))
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
    await firebaseDB.ref(bandPath(`listening_parties/${playlistId}`)).update({
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

    await firebaseDB.ref(bandPath(`listening_parties/${playlistId}`)).update({
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
    const snap = await firebaseDB.ref(bandPath(`listening_parties/${playlistId}`)).once('value');
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

async function checkForAppUpdate() {
    try {
        var res = await fetch('/deadcetera/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) { console.log('[Update] version.json fetch failed:', res.status); return; }
        var data = await res.json();
        console.log('[Update] Server version:', data.version, '| Loaded:', _loadedVersion);
        if (data.version && data.version !== _loadedVersion) {
            console.log('[Update] Version mismatch! Showing banner.');
            showUpdateBanner();
        }
    } catch(e) { console.log('[Update] Check failed:', e); }
}

var _updateBannerShown = false;
function showUpdateBanner() {
    if (_updateBannerShown) return;
    if (document.getElementById('dc-update-banner')) return;
    _updateBannerShown = true;
    console.log('[Update] Creating banner');
    var banner = document.createElement('div');
    banner.id = 'dc-update-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px 20px;font-size:0.9em;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;gap:12px';
    var label = document.createElement('span');
    label.textContent = '🎸 New version available!';
    banner.appendChild(label);
    var reloadBtn = document.createElement('button');
    reloadBtn.textContent = 'Reload';
    reloadBtn.style.cssText = 'background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);border-radius:8px;padding:6px 14px;font-weight:700;cursor:pointer;font-size:0.85em;white-space:nowrap;flex-shrink:0';
    reloadBtn.addEventListener('click', function() {
        banner.remove();
        // Tell waiting SW to take over, then reload
        if (navigator.serviceWorker) {
            navigator.serviceWorker.getRegistration().then(function(r) {
                if (r && r.waiting) {
                    // Listen for the new SW to activate, then reload
                    navigator.serviceWorker.addEventListener('controllerchange', function onCC() {
                        navigator.serviceWorker.removeEventListener('controllerchange', onCC);
                        window.location.reload();
                    });
                    r.waiting.postMessage({type: 'SKIP_WAITING'});
                } else {
                    // No waiting SW — just reload (network-first will get new files)
                    window.location.reload();
                }
            });
        } else {
            window.location.reload();
        }
    });
    banner.appendChild(reloadBtn);
    document.body.appendChild(banner);
    console.log('[Update] Banner appended. In DOM:', !!document.getElementById('dc-update-banner'));
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

        if (statusEl) statusEl.textContent = '✅ AI analysis complete!';
        setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);
        return parsed;

    } catch (err) {
        console.error('AI harmony analysis error:', err);
        if (statusEl) statusEl.textContent = '⚠️ AI analysis failed — ' + err.message;
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
            <button class="btn btn-primary" onclick="pmOpenPracticeMode('${safeSong}')"
                style="background:linear-gradient(135deg,#667eea,#764ba2);padding:12px 28px;font-size:1em;box-shadow:0 4px 20px rgba(102,126,234,0.4)">
                🧠 Practice Mode
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

// ═══════════════════════════════════════════════════════════════════════════
var pmSelectedAudioUrl = '';
var pmArchiveSort = 'downloads';
var pmPalaceSceneIndex = 0;
var pmPalaceScenes = [];
var pmPalaceAutoTimer = null;

// PRACTICE MODE v2 — Know · Memory · Harmony (with AI Images)
// ═══════════════════════════════════════════════════════════════════════════

function pmOpenPracticeMode(songTitle) {
    const band = (allSongs.find(s => s.title === songTitle) || {}).band || 'Grateful Dead';
    const safeSong = songTitle.replace(/'/g, "\\'");
    const modal = document.createElement('div');
    modal.id = 'pmModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0f172a;z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch';
    modal.innerHTML = `
        <div style="max-width:600px;margin:0 auto;padding:16px;padding-bottom:80px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <h2 style="margin:0;color:white;font-size:1.2em">🧠 Practice Mode — ${songTitle}</h2>
                <button onclick="document.getElementById('pmModal').remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.5em">✕</button>
            </div>
            <div style="display:flex;gap:4px;margin-bottom:16px">
                <button class="pm-tab active" onclick="pmTab('know',this)" style="flex:1;padding:10px;border:none;border-radius:8px;font-weight:700;cursor:pointer;background:#667eea;color:white">📖 Know</button>
                <button class="pm-tab" onclick="pmTab('memory',this)" style="flex:1;padding:10px;border:none;border-radius:8px;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.05);color:#94a3b8">🧠 Memory</button>
                <button class="pm-tab" onclick="pmTab('harmony',this)" style="flex:1;padding:10px;border:none;border-radius:8px;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.05);color:#94a3b8">🎵 Harmony</button>
            </div>
            <div id="pmKnowPanel"></div>
            <div id="pmMemoryPanel" style="display:none"></div>
            <div id="pmHarmonyPanel" style="display:none"></div>
        </div>`;
    document.body.appendChild(modal);
    pmLoadKnow(songTitle, band);
    pmLoadMemory(songTitle, band);
    pmLoadHarmony(songTitle, band);
}

function pmTab(tab, btn) {
    document.querySelectorAll('.pm-tab').forEach(b => { b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = '#94a3b8'; });
    btn.style.background = '#667eea'; btn.style.color = 'white';
    ['know','memory','harmony'].forEach(t => {
        const el = document.getElementById('pm' + t.charAt(0).toUpperCase() + t.slice(1) + 'Panel');
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
}

// ── KNOW TAB ────────────────────────────────────────────────────────────────
async function pmLoadKnow(songTitle, band) {
    const el = document.getElementById('pmKnowPanel');
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">Loading song knowledge...</div>';
    // Check for cached meaning
    const cached = await loadBandDataFromDrive(songTitle, 'song_meaning');
    if (cached && cached.text) {
        el.innerHTML = pmRenderKnow(cached.text, cached.source || '');
        return;
    }
    // Try Genius first
    try {
        const searchRes = await fetch(FADR_PROXY + '/genius-search', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ query: songTitle + ' ' + band }) });
        const searchData = await searchRes.json();
        if (searchData.results?.length) {
            const song = searchData.results[0];
            const fetchRes = await fetch(FADR_PROXY + '/genius-fetch', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ songId: song.id, url: song.url }) });
            const fetchData = await fetchRes.json();
            if (fetchData.description && fetchData.description.length > 30) {
                await saveBandDataToDrive(songTitle, 'song_meaning', { text: fetchData.description, source: 'Genius' });
                el.innerHTML = pmRenderKnow(fetchData.description, 'Genius');
                return;
            }
        }
    } catch(e) { console.log('Genius error:', e); }
    // Fallback to Claude AI
    try {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:#f59e0b">🤖 Asking AI about this song...</div>';
        const aiRes = await fetch(FADR_PROXY + '/claude', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: `Tell me about the song "${songTitle}" by ${band}. Cover: meaning, inspiration, emotional themes, history, notable performances. 2-3 concise paragraphs.` }] })
        });
        const aiData = await aiRes.json();
        const text = aiData?.content?.[0]?.text || '';
        if (text) {
            await saveBandDataToDrive(songTitle, 'song_meaning', { text, source: 'AI-generated' });
            el.innerHTML = pmRenderKnow(text, 'AI-generated');
            return;
        }
    } catch(e) { console.log('Claude error:', e); }
    el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">Could not find song information. Try searching manually.</div>';
}

function pmRenderKnow(text, source) {
    return `<div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px">
        <div style="color:#fbbf24;font-size:0.75em;margin-bottom:8px">${source ? '📚 Source: ' + source : ''}</div>
        <div style="color:#e2e8f0;font-size:0.9em;line-height:1.7;white-space:pre-wrap">${text}</div>
    </div>`;
}

// ── MEMORY TAB (with Flux AI Images) ────────────────────────────────────────
async function pmLoadMemory(songTitle, band) {
    const el = document.getElementById('pmMemoryPanel');
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">Loading memory palace...</div>';
    const cached = await loadBandDataFromDrive(songTitle, 'memory_palace');
    if (cached && cached.scenes?.length) {
        pmPalaceScenes = cached.scenes;
        el.innerHTML = pmRenderMemoryTab(songTitle, cached.scenes);
        return;
    }
    el.innerHTML = `<div style="text-align:center;padding:30px">
        <div style="font-size:2em;margin-bottom:12px">🏰</div>
        <div style="color:#e2e8f0;font-size:0.95em;margin-bottom:16px">Create a Memory Palace for <strong>${songTitle}</strong></div>
        <div style="color:#94a3b8;font-size:0.82em;margin-bottom:20px">AI will create vivid visual scenes to help you memorize the song structure, lyrics, and feel — each with a stunning AI-generated image.</div>
        <button onclick="pmGeneratePalace('${songTitle.replace(/'/g,"\\'")}','${band.replace(/'/g,"\\'")}')" style="padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.95em">🤖 Generate Memory Palace</button>
    </div>`;
}

async function pmGeneratePalace(songTitle, band) {
    const el = document.getElementById('pmMemoryPanel');
    el.innerHTML = '<div style="text-align:center;padding:30px"><div style="font-size:2em;margin-bottom:12px">🤖</div><div style="color:#f59e0b">Generating memory palace scenes...</div></div>';
    try {
        const res = await fetch(FADR_PROXY + '/claude', { method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user',
                content: `Create a Memory Palace for the song "${songTitle}" by ${band}. 
Return EXACTLY 4 scenes as JSON array. Each scene helps memorize a section of the song.
Format: [{"title":"Scene title","room":"Room name","description":"2-3 vivid sentences describing a bizarre, memorable visual scene that encodes the lyrics/feel of this section","imagePrompt":"A detailed, artistic prompt for an AI image generator. Describe a surreal, dreamlike scene. Style: psychedelic concert poster art, vibrant colors, atmospheric lighting. NO text in image.","section":"verse/chorus/bridge/outro"}]
Make scenes bizarre and unforgettable — exaggerated imagery, impossible physics, vivid colors. Each scene should encode specific lyrics or musical elements.`
            }] })
        });
        const data = await res.json();
        const text = data?.content?.[0]?.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('No JSON in response');
        const scenes = JSON.parse(jsonMatch[0]);
        if (!scenes.length) throw new Error('Empty scenes');

        // Generate AI images for each scene
        el.innerHTML = '<div style="text-align:center;padding:30px"><div style="font-size:2em;margin-bottom:12px">🎨</div><div style="color:#f59e0b">Generating AI artwork for each scene...</div><div id="pmImageProgress" style="color:#64748b;font-size:0.82em;margin-top:8px"></div></div>';

        for (let i = 0; i < scenes.length; i++) {
            document.getElementById('pmImageProgress').textContent = `Scene ${i+1} of ${scenes.length}...`;
            try {
                const imgRes = await fetch(FADR_PROXY + '/generate-image', { method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ prompt: scenes[i].imagePrompt || scenes[i].description, steps: 6 })
                });
                const imgData = await imgRes.json();
                if (imgData.image) {
                    scenes[i].imageBase64 = imgData.image;
                }
            } catch(e) { console.log('Image gen error for scene', i, e); }
        }

        pmPalaceScenes = scenes;
        await saveBandDataToDrive(songTitle, 'memory_palace', { scenes });
        el.innerHTML = pmRenderMemoryTab(songTitle, scenes);
    } catch(e) {
        console.error('Palace generation error:', e);
        el.innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center">❌ Failed: ${e.message}<br><button onclick="pmGeneratePalace('${songTitle.replace(/'/g,"\\'")}','${(allSongs.find(s=>s.title===songTitle)||{}).band||'Grateful Dead'}')" style="margin-top:12px;padding:8px 16px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer">Try Again</button></div>`;
    }
}

function pmRenderMemoryTab(songTitle, scenes) {
    const cards = scenes.map((s, i) => {
        const hasImage = s.imageBase64;
        const bgStyle = hasImage
            ? `background-image:url(data:image/jpeg;base64,${s.imageBase64});background-size:cover;background-position:center`
            : `background:linear-gradient(135deg,${['#1a1a2e,#16213e','#0f3460,#533483','#1a1a2e,#e94560','#16213e,#0f3460'][i%4]})`;
        return `<div style="border-radius:12px;overflow:hidden;margin-bottom:12px;position:relative;min-height:160px;${bgStyle}">
            <div style="position:absolute;inset:0;background:linear-gradient(transparent 20%,rgba(0,0,0,0.85))"></div>
            <div style="position:relative;padding:16px;display:flex;flex-direction:column;justify-content:flex-end;min-height:160px">
                <div style="color:#fbbf24;font-size:0.7em;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${s.section || 'Scene ' + (i+1)} · Room ${i+1}</div>
                <div style="color:white;font-size:1em;font-weight:700;margin-bottom:6px">${s.title || s.room || ''}</div>
                <div style="color:#cbd5e1;font-size:0.82em;line-height:1.5">${s.description}</div>
            </div>
        </div>`;
    }).join('');
    return `<div style="margin-bottom:12px;display:flex;gap:8px">
        <button onclick="pmOpenPalaceWalk()" style="flex:1;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer">🏰 Walk the Palace</button>
        <button onclick="pmRegeneratePalace('${songTitle.replace(/'/g,"\\'")}')" style="padding:10px 14px;background:rgba(255,255,255,0.05);color:#94a3b8;border:none;border-radius:10px;cursor:pointer">🔄</button>
    </div>${cards}`;
}

async function pmRegeneratePalace(songTitle) {
    await saveBandDataToDrive(songTitle, 'memory_palace', null);
    const band = (allSongs.find(s => s.title === songTitle) || {}).band || 'Grateful Dead';
    pmGeneratePalace(songTitle, band);
}

// ── PALACE WALK (Full-Screen Immersive) ─────────────────────────────────────
function pmOpenPalaceWalk() {
    if (!pmPalaceScenes.length) return;
    pmPalaceSceneIndex = 0;
    const overlay = document.createElement('div');
    overlay.id = 'pmPalaceWalkOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:#000;transition:background 0.8s ease';
    overlay.innerHTML = `
        <div id="pmPalaceScene" style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;transition:opacity 0.4s ease">
        </div>
        <div style="position:absolute;top:16px;right:16px;display:flex;gap:8px;z-index:2">
            <button id="pmAutoBtn" onclick="pmPalaceAutoPlay()" style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.82em">▶ Auto</button>
            <button onclick="document.getElementById('pmPalaceWalkOverlay')?.remove();clearInterval(pmPalaceAutoTimer)" style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.82em">✕ Close</button>
        </div>
        <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:2" id="pmPalaceDots"></div>`;
    document.body.appendChild(overlay);
    // Touch/keyboard navigation
    let touchStartX = 0;
    overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
    overlay.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) pmPalaceNav(dx > 0 ? -1 : 1);
    });
    document.addEventListener('keydown', function pmKeyNav(e) {
        if (!document.getElementById('pmPalaceWalkOverlay')) { document.removeEventListener('keydown', pmKeyNav); return; }
        if (e.key === 'ArrowRight' || e.key === ' ') pmPalaceNav(1);
        if (e.key === 'ArrowLeft') pmPalaceNav(-1);
        if (e.key === 'Escape') { document.getElementById('pmPalaceWalkOverlay')?.remove(); clearInterval(pmPalaceAutoTimer); }
    });
    pmRenderPalaceScene();
}

function pmRenderPalaceScene() {
    const scene = pmPalaceScenes[pmPalaceSceneIndex];
    if (!scene) return;
    const sceneEl = document.getElementById('pmPalaceScene');
    const overlay = document.getElementById('pmPalaceWalkOverlay');
    const dotsEl = document.getElementById('pmPalaceDots');

    // Set background image or gradient
    if (scene.imageBase64) {
        overlay.style.backgroundImage = `url(data:image/jpeg;base64,${scene.imageBase64})`;
        overlay.style.backgroundSize = 'cover';
        overlay.style.backgroundPosition = 'center';
    } else {
        const gradients = ['radial-gradient(ellipse at 30% 40%,#2d1b4e,#0f0a1a)','radial-gradient(ellipse at 70% 30%,#1a3a2a,#0a1a0f)','radial-gradient(ellipse at 50% 60%,#2a1a1a,#1a0a0a)','radial-gradient(ellipse at 40% 50%,#1a1a3a,#0a0a1a)'];
        overlay.style.backgroundImage = gradients[pmPalaceSceneIndex % gradients.length];
        overlay.style.backgroundSize = '';
    }

    // Fade transition
    sceneEl.style.opacity = '0';
    setTimeout(() => {
        sceneEl.innerHTML = `
            <div style="position:absolute;inset:0;background:linear-gradient(transparent 30%,rgba(0,0,0,0.9))"></div>
            <div style="position:relative;padding:24px;max-width:600px;margin:0 auto">
                <div style="color:rgba(255,255,255,0.4);font-size:0.7em;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Room ${pmPalaceSceneIndex+1} of ${pmPalaceScenes.length} · ${scene.section || ''}</div>
                <div style="color:white;font-size:1.4em;font-weight:800;margin-bottom:12px;text-shadow:0 2px 8px rgba(0,0,0,0.5)">${scene.title || scene.room || ''}</div>
                <div style="color:#e2e8f0;font-size:1em;line-height:1.8;background:rgba(0,0,0,0.4);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.08)">${scene.description}</div>
            </div>`;
        sceneEl.style.opacity = '1';
    }, 200);

    // Dots
    dotsEl.innerHTML = pmPalaceScenes.map((_, i) =>
        `<div onclick="pmPalaceSceneIndex=${i};pmRenderPalaceScene()" style="width:${i===pmPalaceSceneIndex?'24px':'10px'};height:10px;border-radius:5px;cursor:pointer;transition:all 0.3s;background:${i===pmPalaceSceneIndex?'#667eea':'rgba(255,255,255,0.3)'};box-shadow:${i===pmPalaceSceneIndex?'0 0 8px #667eea':'none'}"></div>`
    ).join('');
}

function pmPalaceNav(delta) {
    pmPalaceSceneIndex = Math.max(0, Math.min(pmPalaceScenes.length - 1, pmPalaceSceneIndex + delta));
    pmRenderPalaceScene();
}

function pmPalaceAutoPlay() {
    const btn = document.getElementById('pmAutoBtn');
    if (pmPalaceAutoTimer) {
        clearInterval(pmPalaceAutoTimer);
        pmPalaceAutoTimer = null;
        if (btn) btn.textContent = '▶ Auto';
    } else {
        pmPalaceAutoTimer = setInterval(() => {
            if (pmPalaceSceneIndex < pmPalaceScenes.length - 1) pmPalaceNav(1);
            else { clearInterval(pmPalaceAutoTimer); pmPalaceAutoTimer = null; if (btn) btn.textContent = '▶ Auto'; }
        }, 8000);
        if (btn) btn.textContent = '⏸ Stop';
    }
}

// ── HARMONY TAB ─────────────────────────────────────────────────────────────
function pmLoadHarmony(songTitle, band) {
    const el = document.getElementById('pmHarmonyPanel');
    const safeSong = songTitle.replace(/'/g, "\\'");
    el.innerHTML = `
        <div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
            <button class="pm-src-tab active" onclick="pmSrcTab('archive',this)" style="padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-size:0.82em;background:#667eea;color:white">🏛️ Archive</button>
            <button class="pm-src-tab" onclick="pmSrcTab('youtube',this)" style="padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-size:0.82em;background:rgba(255,255,255,0.05);color:#94a3b8">📺 YouTube</button>
            <button class="pm-src-tab" onclick="pmSrcTab('url',this)" style="padding:8px 12px;border:none;border-radius:8px;cursor:pointer;font-size:0.82em;background:rgba(255,255,255,0.05);color:#94a3b8">🔗 URL</button>
        </div>
        <div id="pmSrcArchive">
            <div style="display:flex;gap:6px;margin-bottom:8px">
                <input id="pmArchiveQuery" type="text" placeholder="Search Archive.org..." value="${songTitle} ${band}" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;font-family:inherit" onkeydown="if(event.key==='Enter')pmSearchArchive()">
                <button onclick="pmSearchArchive()" style="padding:8px 14px;background:rgba(102,126,234,0.2);color:#818cf8;border:none;border-radius:8px;cursor:pointer">🔍</button>
            </div>
            <div style="color:#64748b;font-size:0.72em;margin-bottom:8px">Searches setlists in the ${band} collection. Add year for better results.</div>
            <div id="pmArchiveResults" style="max-height:180px;overflow-y:auto"></div>
            <div id="pmArchiveFiles" style="display:none;max-height:200px;overflow-y:auto"></div>
        </div>
        <div id="pmSrcYoutube" style="display:none">
            <div style="display:flex;gap:6px;margin-bottom:8px">
                <input id="pmYoutubeQuery" type="text" placeholder="Search YouTube..." value="${songTitle} ${band}" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;font-family:inherit" onkeydown="if(event.key==='Enter')pmSearchYouTube()">
                <button onclick="pmSearchYouTube()" style="padding:8px 14px;background:rgba(239,68,68,0.2);color:#f87171;border:none;border-radius:8px;cursor:pointer">🔍</button>
            </div>
            <div id="pmYoutubeResults" style="max-height:220px;overflow-y:auto"></div>
            <div style="margin-top:8px"><input id="pmYoutubeUrl" type="url" placeholder="Or paste a YouTube URL..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;box-sizing:border-box;font-family:inherit" oninput="if(this.value.trim()){pmSelectedAudioUrl=this.value.trim();document.getElementById('pmSelectedSource').style.display='block';document.getElementById('pmSelectedSourceText').textContent=this.value.trim();document.getElementById('pmFadrGoBtn').disabled=false}"></div>
        </div>
        <div id="pmSrcUrl" style="display:none">
            <div style="color:#94a3b8;font-size:0.82em;margin-bottom:6px">Paste any direct audio URL (MP3, FLAC, OGG, WAV):</div>
            <input id="pmDirectUrl" type="url" placeholder="https://..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;box-sizing:border-box;font-family:inherit" oninput="if(this.value.trim()){pmSelectedAudioUrl=this.value.trim();document.getElementById('pmSelectedSource').style.display='block';document.getElementById('pmSelectedSourceText').textContent=this.value.trim();document.getElementById('pmFadrGoBtn').disabled=false}">
        </div>
        <div id="pmSelectedSource" style="display:none;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.3);border-radius:8px;padding:10px;margin:12px 0">
            <div style="color:#818cf8;font-size:0.78em;font-weight:600">Selected:</div>
            <div id="pmSelectedSourceText" style="color:#e2e8f0;font-size:0.82em;word-break:break-all"></div>
        </div>
        <button id="pmFadrGoBtn" onclick="pmRunFadrFromPM('${safeSong}')" style="width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-weight:700;font-size:0.95em;cursor:pointer;margin-top:8px" disabled>🤖 Send to Fadr AI</button>
        <div id="pmFadrProgress" style="display:none;margin-top:12px;background:rgba(255,255,255,0.03);border-radius:8px;padding:12px">
            <div id="pmFadrProgressText" style="color:#e2e8f0;font-size:0.85em"></div>
            <div style="background:rgba(255,255,255,0.1);border-radius:4px;height:6px;margin-top:8px"><div id="pmFadrProgressBar" style="height:100%;background:#667eea;border-radius:4px;width:0;transition:width 0.3s"></div></div>
        </div>`;
}

function pmSrcTab(tab, btn) {
    document.querySelectorAll('.pm-src-tab').forEach(b => { b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = '#94a3b8'; });
    btn.style.background = '#667eea'; btn.style.color = 'white';
    ['archive','youtube','url'].forEach(t => {
        const el = document.getElementById('pmSrc' + t.charAt(0).toUpperCase() + t.slice(1));
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
}

async function pmSearchArchive() {
    const query = document.getElementById('pmArchiveQuery')?.value?.trim();
    if (!query) return;
    const container = document.getElementById('pmArchiveResults');
    container.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">🔍 Searching Archive.org setlists...</div>';
    try {
        const sortMap = {downloads:'downloads+desc', rating:'avg_rating+desc', date:'date+desc'};
        const res = await fetch(FADR_PROXY + '/archive-search', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ query, sort: sortMap[pmArchiveSort] || 'downloads+desc' }) });
        const data = await res.json();
        if (!data.results?.length) { container.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No results. Try different terms.</div>'; return; }
        var sortLabel = pmArchiveSort === 'rating' ? 'Rating' : pmArchiveSort === 'date' ? 'Date' : 'Downloads';
        container.innerHTML = (data.total ? '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px"><span style="color:#64748b;font-size:0.7em">' + data.total + ' shows</span><div style="display:flex;gap:4px">' + ['downloads','rating','date'].map(function(s) { return '<button onclick="pmArchiveSort=\'' + s + '\';pmSearchArchive()" style="background:' + (pmArchiveSort===s?'rgba(102,126,234,0.2)':'none') + ';border:1px solid ' + (pmArchiveSort===s?'rgba(102,126,234,0.4)':'rgba(255,255,255,0.08)') + ';border-radius:4px;color:' + (pmArchiveSort===s?'#818cf8':'#64748b') + ';cursor:pointer;padding:2px 6px;font-size:0.65em">' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>'; }).join('') + '</div></div>' : '') + data.results.slice(0,20).map(r => `
            <div onclick="pmSelectShow('${r.identifier}')" style="padding:7px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
                <div style="color:#e2e8f0;font-size:0.82em;font-weight:600">${r.title || r.identifier}</div>
                <div style="color:#64748b;font-size:0.72em">${r.date ? r.date.split('T')[0] : ''} · ⭐ ${r.rating ? r.rating.toFixed(1) : '—'} · ${r.downloads ? r.downloads.toLocaleString() + ' dl' : ''}</div>
            </div>`).join('');
    } catch(e) { container.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

async function pmSelectShow(identifier) {
    const container = document.getElementById('pmArchiveFiles');
    container.style.display = 'block';
    container.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">Loading tracks...</div>';
    try {
        const res = await fetch(FADR_PROXY + '/archive-files', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ identifier }) });
        const data = await res.json();
        if (!data.files?.length) { container.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No audio files found.</div>'; return; }
        // Prefer MP3 files
        const sorted = data.files.sort((a,b) => {
            const aMP3 = /mp3/i.test(a.format||a.name); const bMP3 = /mp3/i.test(b.format||b.name);
            if (aMP3 && !bMP3) return -1; if (!aMP3 && bMP3) return 1; return 0;
        });
        container.innerHTML = '<div style="color:#fbbf24;font-size:0.75em;padding:4px 8px">' + (data.title||identifier) + '</div>' + sorted.map(f => {
            const name = f.title || f.name.replace(/\.[^.]+$/, '');
            const fmt = (f.format || '').replace('VBR ','');
            return `<div onclick="pmSelectTrack('${f.url.replace(/'/g,"\\'")}','${name.replace(/'/g,"\\'")}',${parseInt(f.length||0)>600})" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
                <div style="color:#e2e8f0;font-size:0.8em">${name}</div>
                <div style="color:#64748b;font-size:0.68em">${fmt} · ${f.length ? Math.floor(f.length/60)+':'+String(Math.floor(f.length%60)).padStart(2,'0') : ''} · ${f.size ? (parseInt(f.size)/1024/1024).toFixed(1)+'MB' : ''}</div>
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

function pmSelectTrack(url, title, isLong) {
    pmSelectedAudioUrl = url;
    document.getElementById('pmSelectedSource').style.display = 'block';
    document.getElementById('pmSelectedSourceText').textContent = title;
    document.getElementById('pmFadrGoBtn').disabled = false;
}

async function pmSearchYouTube() {
    const query = document.getElementById('pmYoutubeQuery')?.value?.trim();
    if (!query) return;
    const container = document.getElementById('pmYoutubeResults');
    container.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">🔍 Searching YouTube...</div>';
    try {
        const res = await fetch(FADR_PROXY + '/youtube-search', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ query }) });
        const data = await res.json();
        if (!data.results?.length) { container.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No results.' + (data.error ? ' (' + data.error + ')' : '') + ' Try pasting a URL below.</div>'; return; }
        container.innerHTML = data.results.map(v => `
            <div onclick="pmSelectedAudioUrl='${v.url}';document.getElementById('pmSelectedSource').style.display='block';document.getElementById('pmSelectedSourceText').textContent='${(v.title||'').replace(/'/g,"\\'")}';document.getElementById('pmFadrGoBtn').disabled=false" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:8px" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background=''">
                <span style="color:#ef4444">▶</span>
                <div style="flex:1;min-width:0"><div style="color:#e2e8f0;font-size:0.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title}</div><div style="color:#64748b;font-size:0.68em">${v.author||''} · ${v.duration||''}</div></div>
            </div>`).join('');
    } catch(e) { container.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

async function pmRunFadrFromPM(songTitle) {
    if (!pmSelectedAudioUrl) return;
    // Re-use existing importHarmoniesFromFadr but set the URL first
    const fadrModal = document.getElementById('fadrImportModal');
    if (fadrModal) fadrModal.remove();
    // Set up and trigger the main Fadr import
    importHarmoniesFromFadr(songTitle);
    setTimeout(() => {
        const urlInput = document.getElementById('fadrArchiveUrl');
        if (urlInput) { urlInput.value = pmSelectedAudioUrl; }
    }, 100);
}

// ── Hook into Song Detail to add Practice Mode button ───────────────────────
// Inject "🧠 Practice" button into song detail view
const _origRenderSongDetail = typeof renderSongDetail === 'function' ? renderSongDetail : null;
if (typeof window !== 'undefined') {
    const origSongModal = window.openSongModal;
    // We'll add the button via a MutationObserver or by patching
}

console.log('🧠 Practice Mode v2 with AI Images loaded');

// ============================================================================
// BAND LOCK-IN READINESS SYSTEM
// Each member rates their readiness 1-5 per song.
// Song list shows 5 chain links colored by score.
// Song DNA shows full readiness panel with slider.
// ============================================================================

var MASTER_READINESS_FILE = '_master_readiness.json';
var readinessCache = {};       // { songTitle: { drew:4, chris:3, ... } }
var readinessCacheLoaded = false;

var BAND_MEMBERS_ORDERED = [
    { key: 'drew',   name: 'Drew',  emoji: '🎸' },
    { key: 'chris',  name: 'Chris', emoji: '🎸' },
    { key: 'brian',  name: 'Brian', emoji: '🎸' },
    { key: 'pierce', name: 'Pierce',emoji: '🎹' },
    { key: 'jay',    name: 'Jay',   emoji: '🥁' }
];

function getCurrentMemberReadinessKey() {
    var emailToKey = {
        'drewmerrill1029@gmail.com': 'drew',
        'cmjalbert@gmail.com': 'chris',
        'brian@hrestoration.com': 'brian',
        'pierce.d.hale@gmail.com': 'pierce',
        'jnault@fegholdings.com': 'jay'
    };
    return currentUserEmail ? (emailToKey[currentUserEmail] || null) : null;
}

function readinessColor(score) {
    if (!score || score < 1) return 'rgba(255,255,255,0.12)';
    var colors = { 1:'#ef4444', 2:'#f97316', 3:'#eab308', 4:'#84cc16', 5:'#22c55e' };
    return colors[score] || 'rgba(255,255,255,0.12)';
}

function readinessLabel(score) {
    var labels = { 1:'Not ready', 2:'Needs work', 3:'Getting there', 4:'Almost locked', 5:'Locked in 🔒' };
    return labels[score] || 'Not set';
}

// ── Preload master readiness file on startup ──────────────────────────────────
async function preloadReadinessCache() {
    if (readinessCacheLoaded) return;
    try {
        var data = await loadMasterFile(MASTER_READINESS_FILE);
        if (data && typeof data === 'object') {
            readinessCache = data;
        }
        readinessCacheLoaded = true;
    } catch(e) {
        readinessCacheLoaded = true;
    }
}

// ── Chain link SVG (9x12px) ───────────────────────────────────────────────────
function chainLinkSVG(color, tooltipTitle) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="12" viewBox="0 0 9 12" style="display:block" title="' + tooltipTitle + '">'
        + '<rect x="1" y="0.5" width="7" height="4" rx="2" fill="none" stroke="' + color + '" stroke-width="1.6"/>'
        + '<rect x="1" y="7.5" width="7" height="4" rx="2" fill="none" stroke="' + color + '" stroke-width="1.6"/>'
        + '<line x1="4.5" y1="4.5" x2="4.5" y2="7.5" stroke="' + color + '" stroke-width="1.6"/>'
        + '</svg>';
}

// ── Inject chain links into every song row ────────────────────────────────────
function addReadinessChains() {
    document.querySelectorAll('.song-chain-strip').forEach(function(el) {
        var songTitle = el.dataset.song || '';
        var scores = readinessCache[songTitle] || {};
        el.innerHTML = BAND_MEMBERS_ORDERED.map(function(m) {
            var score = scores[m.key] || 0;
            var color = readinessColor(score);
            var label = m.name + (score ? ': ' + score + '/5 — ' + readinessLabel(score) : ': Not set');
            return '<span style="display:inline-block;line-height:0">' + chainLinkSVG(color, label) + '</span>';
        }).join('');
        el.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:1px;height:12px;overflow:hidden;';
    });
}

// ── Render readiness panel in Song DNA ───────────────────────────────────────
async function renderMomentsSection(songTitle) {
    var container = document.getElementById('momentsContainer');
    if (!container) {
        // Self-inject container after woodshedChecklistContainer
        var woodshed = document.getElementById('woodshedChecklistContainer');
        if (!woodshed) return;
        var section = document.createElement('div');
        section.className = 'app-card';
        section.style.cssText = 'margin-top:10px';
        section.innerHTML = '<h3 style="font-size:0.9em;margin-bottom:10px">📸 Captured Moments</h3><div id="momentsContainer"></div>';
        var _wParent = woodshed.closest('.app-card') || woodshed.parentElement;
        if (_wParent && _wParent.parentElement) _wParent.parentElement.insertBefore(section, _wParent.nextSibling);
        else if (_wParent) _wParent.appendChild(section);
        container = document.getElementById('momentsContainer');
        if (!container) return;
    }
    container.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">Loading moments...</div>';
    var moments = [];
    try {
        var path = bandPath('songs/' + sanitizeFirebasePath(songTitle) + '/moments');
        var snap = await firebaseDB.ref(path).once('value');
        var raw = snap.val() || {};
        moments = Object.values(raw).sort(function(a,b){return (b.ts||''). localeCompare(a.ts||')');});
    } catch(e) {
        // also check localStorage fallback
        var local = JSON.parse(localStorage.getItem('deadcetera_moments_'+songTitle)||'[]');
        moments = local.sort(function(a,b){return (b.ts||''). localeCompare(a.ts||')');});
    }
    if (!moments.length) {
        container.innerHTML = '<div style="color:#475569;font-size:0.82em;padding:6px 0;font-style:italic">No moments captured yet. Use the 📸 button during rehearsal or gig mode.</div>';
        return;
    }
    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    moments.forEach(function(m) {
        var d = m.ts ? new Date(m.ts) : null;
        var dateStr = d ? d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : '';
        var modeIcon = m.mode==='rehearsal'?'🎸':'🎤';
        html += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px">';
        html += '<div style="font-size:0.85em;color:#e2e8f0;line-height:1.4;margin-bottom:4px">' + m.text + '</div>';
        html += '<div style="font-size:0.7em;color:#475569">' + modeIcon + ' ' + dateStr + (m.by?' · '+m.by:'') + '</div>';
        html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function rdSparklineSvg(history) {
    if (!history || history.length < 2) return '';
    var pts = history.slice(-10);
    var w = 60, h = 18;
    var xs = pts.map(function(_,i){return Math.round(i/(pts.length-1)*w);});
    var ys = pts.map(function(p){return Math.round(h-(((p.score||1)-1)/4)*h);});
    var d = xs.map(function(x,i){return (i===0?'M':'L')+x+','+ys[i];}).join(' ');
    var last = pts[pts.length-1].score||1;
    var trend = pts.length>1?(pts[pts.length-1].score||1)-(pts[0].score||1):0;
    var col = last>=4?'#22c55e':last>=3?'#eab308':'#ef4444';
    var arrow = trend>0?'↗':trend<0?'↘':'↔';
    return '<span style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle">'+           '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" style="overflow:visible">'+           '<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="1.5" stroke-linecap="round"/>'+           '<circle cx="'+xs[xs.length-1]+'" cy="'+ys[ys.length-1]+'" r="2.5" fill="'+col+'"/></svg>'+           '<span style="font-size:0.8em;color:'+col+'">'+arrow+'</span></span>';
}

async function renderReadinessSection(songTitle) {
    var container = document.getElementById('readinessContainer');
    if (!container) return;

    var memberKey = getCurrentMemberReadinessKey();
    var scores = {};
    try {
        var snap = await firebaseDB.ref(bandPath('songs/' + sanitizeFirebasePath(songTitle) + '/readiness')).once('value');
        if (snap.val()) {
            scores = snap.val();
            // Update cache
            readinessCache[songTitle] = scores;
        }
    } catch(e) {}

    // Compute average of set scores
    var setScores = BAND_MEMBERS_ORDERED.map(function(m) { return scores[m.key]; }).filter(function(s) { return s && s > 0; });
    var avg = setScores.length ? (setScores.reduce(function(a,b){return a+b;},0) / setScores.length) : 0;
    var avgColor = avg ? readinessColor(Math.round(avg)) : '#64748b';
    var myScore = memberKey ? (scores[memberKey] || 0) : 0;

    var html = '<div style="margin-top:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
        +   '<span style="font-weight:700;font-size:0.95em;color:#f1f5f9">🔗 Band Lock-In</span>'
        +   (avg ? '<span style="font-size:0.72em;font-weight:700;padding:2px 10px;border-radius:20px;background:' + avgColor + '22;color:' + avgColor + ';border:1px solid ' + avgColor + '44">Avg ' + avg.toFixed(1) + '/5</span>' : '<span style="font-size:0.72em;color:#64748b">No scores yet</span>')
        + '</div>'

        // Member bars
        + '<div style="display:flex;gap:8px;margin-bottom:16px">'
        + BAND_MEMBERS_ORDERED.map(function(m) {
            var s = scores[m.key] || 0;
            var c = readinessColor(s);
            var pct = s ? (s / 5 * 100) : 0;
            var isMe = memberKey && m.key === memberKey;
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
                + '<div style="width:100%;height:40px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;position:relative;border:1px solid ' + (isMe ? c+'66' : 'rgba(255,255,255,0.08)') + '">'
                +   '<div style="position:absolute;bottom:0;left:0;right:0;height:' + pct + '%;background:' + c + ';opacity:0.85;transition:height 0.3s ease;border-radius:0 0 4px 4px"></div>'
                +   (s ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9em;color:' + (s >= 4 ? '#fff' : c) + '">' + s + '</div>' : '')
                + '</div>'
                + '<span style="font-size:0.62em;color:' + (isMe ? '#f1f5f9' : '#64748b') + ';font-weight:' + (isMe ? '700' : '500') + ';text-align:center">' + m.emoji + ' ' + m.name + '</span>'
                + '</div>';
        }).join('')
        + '</div>';

    // Slider for current member
    if (!isUserSignedIn) {
        html += '<div style="text-align:center;font-size:0.8em;color:#64748b;padding:8px">Sign in to set your readiness score</div>';
    } else if (!memberKey) {
        html += '<div style="text-align:center;font-size:0.8em;color:#64748b;padding:8px">Your account isn\'t linked to a band member</div>';
    } else {
        var mInfo = BAND_MEMBERS_ORDERED.find(function(m){ return m.key === memberKey; });
        html += '<div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:14px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
            +   '<span style="font-size:0.8em;color:#94a3b8;font-weight:600">' + (mInfo ? mInfo.emoji + ' ' + mInfo.name : 'Your') + ' readiness</span>'
            +   '<span id="readinessScoreLabel" style="font-size:0.8em;font-weight:700;color:' + (myScore ? readinessColor(myScore) : '#64748b') + '">' + (myScore ? myScore + '/5 — ' + readinessLabel(myScore) : 'Not set') + '</span>'
            +   '<span id="readinessTrend" style="margin-left:8px"></span>'
            + '</div>'
            + '<input type="range" min="1" max="5" step="1" value="' + (myScore || 1) + '" '
            +   'style="width:100%;accent-color:' + readinessColor(myScore || 3) + ';cursor:pointer;height:6px" '
            +   'oninput="previewReadiness(this.value,\'' + songTitle.replace(/'/g,"\\'") + '\')" '
            +   'onchange="saveMyReadiness(\'' + songTitle.replace(/'/g,"\\'") + '\',this.value)" />'
            + '<div style="display:flex;justify-content:space-between;margin-top:4px">'
            +   '<span style="font-size:0.65em;color:#64748b">1 — Not ready</span>'
            +   '<span style="font-size:0.65em;color:#22c55e">5 — Locked in 🔒</span>'
            + '</div>'
            + '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

// ── Live preview as slider moves ────────────────────────────────────────────�
    // Load sparkline trend async
    var _spMKey = getCurrentMemberReadinessKey();
    if (_spMKey && firebaseDB) {
        firebaseDB.ref(bandPath('songs/'+sanitizeFirebasePath(songTitle)+'/readiness_history/'+_spMKey)).limitToLast(10).once('value').then(function(snap) {
            var hist = Object.values(snap.val()||{}).sort(function(a,b){return (a.ts||'').localeCompare(b.ts||'');});
            var el = document.getElementById('readinessTrend');
            if (el && hist.length>=2) el.innerHTML = rdSparklineSvg(hist);
        }).catch(function(){});
    }
function previewReadiness(value, songTitle) {
    var v = parseInt(value);
    var c = readinessColor(v);
    var label = document.getElementById('readinessScoreLabel');
    if (label) {
        label.textContent = v + '/5 — ' + readinessLabel(v);
        label.style.color = c;
    }
    // Update slider accent color live
    var slider = document.querySelector('#readinessContainer input[type=range]');
    if (slider) slider.style.accentColor = c;
}

// ── Save score to Firebase + update cache + refresh chains ───────────────────
async function saveMyReadiness(songTitle, value) {
    var memberKey = getCurrentMemberReadinessKey();
    if (!memberKey || !firebaseDB) return;
    var v = parseInt(value);
    var path = bandPath('songs/' + sanitizeFirebasePath(songTitle) + '/readiness/' + memberKey);
    try {
        await firebaseDB.ref(path).set(v);
        // Update local cache
        if (!readinessCache[songTitle]) readinessCache[songTitle] = {};
        readinessCache[songTitle][memberKey] = v;
        // Persist to master file
        saveMasterFile(MASTER_READINESS_FILE, readinessCache).catch(function(){});
        // Refresh chain links in song list
        requestAnimationFrame(addReadinessChains);
        // Re-render section to update avg + bars
        renderReadinessSection(songTitle);
        showToast('🔗 Readiness saved: ' + v + '/5 — ' + readinessLabel(v));
        // Log activity
        logActivity('readiness_set', songTitle, { score: v, member: memberKey });
        try { firebaseDB.ref(bandPath('songs/'+sanitizeFirebasePath(songTitle)+'/readiness_history/'+memberKey)).push({score:v,ts:new Date().toISOString()}); } catch(eh) {}
    } catch(e) {
        showToast('⚠️ Could not save readiness');
    }
}

console.log('🔗 Band Lock-In Readiness loaded');

// ============================================================================
// WOODSHED CHECKLISTS
// ============================================================================
var WOODSHED_DEFAULTS={'Lead Guitar':[{text:'Reviewed the chart',phase:'solo'},{text:'Chord shapes locked',phase:'solo'},{text:'Signature licks / riffs dialed in',phase:'solo'},{text:'Can play through without stopping',phase:'solo'},{text:'Improv vocabulary feels right for this song',phase:'solo'},{text:'Tempo comfortable at full speed',phase:'solo'},{text:'Transitions nailed (intros, outros, jams)',phase:'solo'},{text:"NOT doubling Drew's rhythm part",phase:'rehearsal'},{text:'Listening for space — not filling every bar',phase:'rehearsal'},{text:'Dynamics mapped — know when to pull back',phase:'rehearsal'},{text:'Rig set for this song (patch, guitar, extras)',phase:'gig'},{text:'Tone checked in full band context',phase:'gig'}],'Rhythm Guitar':[{text:'Reviewed the chart',phase:'solo'},{text:'Chord shapes locked',phase:'solo'},{text:'Strumming pattern / feel dialed in',phase:'solo'},{text:'Voicings not muddying the low end',phase:'solo'},{text:'Can play through without stopping',phase:'solo'},{text:'Tempo comfortable at full speed',phase:'solo'},{text:'Transitions nailed (intros, outros, jams)',phase:'solo'},{text:'Chord voicings leave room for bass & keys',phase:'rehearsal'},{text:"Locked in with Jay's kick pattern",phase:'rehearsal'},{text:'Dynamics — know when to lay back',phase:'rehearsal'},{text:'Rig set for this song (patch, guitar, extras)',phase:'gig'},{text:'Tone checked in full band context',phase:'gig'}],'Bass':[{text:'Reviewed the chart',phase:'solo'},{text:'Root movement locked',phase:'solo'},{text:'Signature bass line / groove dialed in',phase:'solo'},{text:'Can play through without stopping',phase:'solo'},{text:'Tempo comfortable at full speed',phase:'solo'},{text:'Transitions nailed',phase:'solo'},{text:'Pocket tight with Jay — not rushing',phase:'rehearsal'},{text:"Pierce's left hand accounted for — register clear",phase:'rehearsal'},{text:'Dynamics mapped — know when to simplify',phase:'rehearsal'},{text:'Rig set for this song (bass choice, settings)',phase:'gig'},{text:'Tone checked in full band context',phase:'gig'}],'Keyboard':[{text:'Reviewed the chart',phase:'solo'},{text:'Main motif / riff locked',phase:'solo'},{text:'Voicings feel right for the style',phase:'solo'},{text:'Know when to comp vs. lead',phase:'solo'},{text:'Tempo comfortable at full speed',phase:'solo'},{text:'Transitions nailed',phase:'solo'},{text:"LEFT HAND: not muddying Chris's bass line",phase:'rehearsal'},{text:"Staying out of Drew's rhythm register when needed",phase:'rehearsal'},{text:'Patch / instrument choices locked per section',phase:'rehearsal'},{text:'Dynamics — know when to drop out entirely',phase:'rehearsal'},{text:'Rig set (which keyboard, which patch)',phase:'gig'},{text:'Tone checked in full band context',phase:'gig'}],'Drums':[{text:'Know the main groove / feel',phase:'solo'},{text:'Intro locked',phase:'solo'},{text:'Signature fills noted',phase:'solo'},{text:'Tempo — can hold it without rushing',phase:'solo'},{text:'Dynamics mapped (builds, drops, stops)',phase:'solo'},{text:'Transitions nailed',phase:'solo'},{text:'Pocket with Chris solid — not dragging',phase:'rehearsal'},{text:'Leaving space for band to breathe',phase:'rehearsal'},{text:'Know the cues — who signals the transitions?',phase:'rehearsal'},{text:'Kit setup for this song (bongos, block, rototoms?)',phase:'gig'},{text:'Tempo feels right from downbeat',phase:'gig'}]};
var WOODSHED_PHASE_LABELS={solo:{emoji:'🎸',label:'Solo Practice'},rehearsal:{emoji:'🤝',label:'Rehearsal Ready'},gig:{emoji:'🎤',label:'Gig Night'}};
var WOODSHED_BAND_SPACE_PROMPTS={'Lead Guitar':"e.g. Leaving low-mid to Drew. Holding back fills during verse 1.",'Rhythm Guitar':"e.g. Using closed voicings — leaves room for Pierce and Brian.",'Bass':"e.g. Pierce staying out of my register. Locking pocket with Jay.",'Keyboard':"e.g. Right hand only on verses — keeping left hand out of Chris's lane.",'Drums':"e.g. Driving tempo — band rushes this one. Brushes on verses."};
async function renderWoodshedChecklist(songTitle){var container=document.getElementById('woodshedChecklistContainer');if(!container)return;var myKey=getCurrentMemberKey();container.innerHTML='<div style="color:#64748b;font-size:0.82em;padding:8px">Loading...</div>';var memberLoads=BAND_MEMBERS_ORDERED.map(async function(m){var role=bandMembers[m.key]?bandMembers[m.key].role:null;var path=bandPath('songs/'+sanitizeFirebasePath(songTitle)+'/woodshed/'+m.key);var data=null;try{var snap=await firebaseDB.ref(path).once('value');data=snap.val();}catch(e){}if(!data||!data.seeded){var defs=(WOODSHED_DEFAULTS[role]||WOODSHED_DEFAULTS['Rhythm Guitar']).map(function(d,i){return{id:'item_'+i,text:d.text,done:false,phase:d.phase};});data={checklist:defs,rig:'',bandSpace:'',seeded:true};try{firebaseDB.ref(path).set(data);}catch(e){}}return{key:m.key,name:m.name,emoji:m.emoji,role:role,data:data};});var allMembers=await Promise.all(memberLoads);var safeSong=songTitle.replace(/'/g,"\\'");var html='';var me=allMembers.find(function(m){return m.key===myKey;});if(!isUserSignedIn)html='<div style="text-align:center;padding:20px;color:#64748b;font-size:0.85em">Sign in to use your Woodshed checklist</div>';else if(!myKey||!me)html='<div style="text-align:center;padding:20px;color:#64748b;font-size:0.85em">Your account is not linked to a band member</div>';else html=wsRenderMyPanel(me,safeSong);var others=allMembers.filter(function(m){return m.key!==myKey;});if(others.length){html+='<div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.06);padding-top:14px"><div style="font-size:0.72em;font-weight:700;color:#64748b;letter-spacing:0.05em;margin-bottom:8px">BANDMATES</div><div style="display:flex;flex-direction:column;gap:6px">';others.forEach(function(m){var cl=(m.data&&m.data.checklist)||[];var done=cl.filter(function(i){return i.done;}).length;var total=cl.length;var pct=total?Math.round(done/total*100):0;var bc=pct>=80?'#22c55e':pct>=50?'#eab308':'#ef4444';html+='<div onclick="wsToggleMate(\''+m.key+'\',\''+safeSong+'\')" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;cursor:pointer"><div style="display:flex;align-items:center;gap:10px"><span>'+m.emoji+'</span><span style="color:#e2e8f0;font-size:0.85em;font-weight:600;flex:1">'+m.name+'</span><span style="font-size:0.72em;color:#64748b">'+m.role+'</span><span style="font-size:0.75em;font-weight:700;color:'+bc+';margin-left:8px">'+done+'/'+total+'</span><span style="font-size:0.75em;color:#64748b;margin-left:2px">&#9662;</span></div><div style="margin-top:6px;height:3px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+bc+';border-radius:2px"></div></div><div id="wsmate_'+m.key+'" style="display:none;margin-top:12px">'+wsRenderMateDetail(m)+'</div></div>';});html+='</div></div>';}container.innerHTML=html;}
function wsRenderMyPanel(me,safeSong){var cl=(me.data&&me.data.checklist)||[];var done=cl.filter(function(i){return i.done;}).length;var total=cl.length;var pct=total?Math.round(done/total*100):0;var bc=pct>=80?'#22c55e':pct>=50?'#eab308':'#ef4444';var rigVal=(me.data&&me.data.rig)||'';var bsVal=(me.data&&me.data.bandSpace)||'';var prompt=WOODSHED_BAND_SPACE_PROMPTS[me.role]||'How does your part fit around everyone else?';var byPhase={solo:[],rehearsal:[],gig:[]};cl.forEach(function(item,idx){var p=item.phase||'solo';if(byPhase[p])byPhase[p].push({item:item,idx:idx});});var html='<div style="background:rgba(102,126,234,0.06);border:1px solid rgba(102,126,234,0.2);border-radius:12px;padding:16px">';html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:1.2em">'+me.emoji+'</span><div style="flex:1"><div style="display:flex;align-items:center;justify-content:space-between"><span style="font-weight:700;color:#f1f5f9;font-size:0.9em">'+me.name+' \u2014 '+me.role+'</span><span style="font-size:0.75em;font-weight:700;color:'+bc+'">'+done+'/'+total+(pct>=100?' \uD83D\uDD12':'')+'</span></div><div style="margin-top:5px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+bc+';transition:width 0.3s;border-radius:2px"></div></div></div></div>';['solo','rehearsal','gig'].forEach(function(phase){var items=byPhase[phase];if(!items.length)return;var ph=WOODSHED_PHASE_LABELS[phase];html+='<div style="margin-bottom:12px"><div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.06em;margin-bottom:6px;text-transform:uppercase">'+ph.emoji+' '+ph.label+'</div>';items.forEach(function(entry){var item=entry.item;var idx=entry.idx;var chk=item.done;html+='<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer" onclick="wsToggleItem(\''+safeSong+'\','+idx+',\''+me.key+'\')"><div style="width:18px;height:18px;border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;'+(chk?'background:rgba(34,197,94,0.25);border:1.5px solid #22c55e':'background:rgba(255,255,255,0.05);border:1.5px solid rgba(255,255,255,0.15)')+';">'+(chk?'<span style="color:#22c55e;font-size:0.7em;font-weight:900">\u2713</span>':'')+'</div><span style="font-size:0.85em;color:'+(chk?'#64748b':'#e2e8f0')+';'+(chk?'text-decoration:line-through;':'')+'flex:1;line-height:1.3">'+wsEsc(item.text)+'</span></div>';});html+='</div>';});html+='<div style="display:flex;gap:6px;margin-top:4px;margin-bottom:16px"><input type="text" id="wsNewItem_'+me.key+'" placeholder="Add a checklist item..." style="flex:1;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:#e2e8f0;padding:7px 10px;font-size:0.83em;font-family:inherit" onkeydown="if(event.key===\'Enter\')wsAddItem(\''+safeSong+'\',\''+me.key+'\')" onclick="event.stopPropagation()"><button onclick="event.stopPropagation();wsAddItem(\''+safeSong+'\',\''+me.key+'\')" style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.3);color:#818cf8;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:0.82em;font-weight:700;white-space:nowrap">+ Add</button></div><div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:14px;margin-bottom:14px"><div style="font-size:0.72em;font-weight:700;color:#94a3b8;letter-spacing:0.05em;margin-bottom:8px">\uD83C\uDFDB\uFE0F MY RIG FOR THIS SONG</div><textarea id="wsRig_'+me.key+'" rows="2" placeholder="Guitar, amp setting, patch #, pedals, capo, slide..." style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;padding:9px 11px;font-size:0.83em;font-family:inherit;resize:vertical" onclick="event.stopPropagation()" onblur="wsSaveRig(\''+safeSong+'\',\''+me.key+'\')">'+wsEsc(rigVal)+'</textarea></div><div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:14px"><div style="font-size:0.72em;font-weight:700;color:#94a3b8;letter-spacing:0.05em;margin-bottom:4px">\uD83C\uDFAD BAND SPACE NOTES</div><div style="font-size:0.72em;color:#475569;margin-bottom:7px">How does your part fit around everyone else?</div><textarea id="wsBandSpace_'+me.key+'" rows="2" placeholder="'+wsEsc(prompt)+'" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;padding:9px 11px;font-size:0.83em;font-family:inherit;resize:vertical" onclick="event.stopPropagation()" onblur="wsSaveBandSpace(\''+safeSong+'\',\''+me.key+'\')">'+wsEsc(bsVal)+'</textarea></div></div>';return html;}
function wsRenderMateDetail(m){var cl=(m.data&&m.data.checklist)||[];var rig=(m.data&&m.data.rig)||'';var bs=(m.data&&m.data.bandSpace)||'';var html='';var byPhase={solo:[],rehearsal:[],gig:[]};cl.forEach(function(item){var p=item.phase||'solo';if(byPhase[p])byPhase[p].push(item);});['solo','rehearsal','gig'].forEach(function(phase){var items=byPhase[phase];if(!items.length)return;var ph=WOODSHED_PHASE_LABELS[phase];html+='<div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.05em;margin:8px 0 4px;text-transform:uppercase">'+ph.emoji+' '+ph.label+'</div>';items.forEach(function(item){html+='<div style="display:flex;align-items:center;gap:8px;padding:5px 0"><div style="width:14px;height:14px;border-radius:3px;flex-shrink:0;'+(item.done?'background:rgba(34,197,94,0.2);border:1.5px solid #22c55e':'background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.1)')+';">'+(item.done?'<span style="color:#22c55e;font-size:0.65em;font-weight:900">\u2713</span>':'')+'</div><span style="font-size:0.82em;color:'+(item.done?'#64748b':'#94a3b8')+';'+(item.done?'text-decoration:line-through;':'')+'flex:1">'+wsEsc(item.text)+'</span></div>';});});if(rig.trim())html+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)"><div style="font-size:0.68em;font-weight:700;color:#64748b;margin-bottom:5px">\uD83C\uDFDB\uFE0F RIG</div><div style="font-size:0.82em;color:#94a3b8;white-space:pre-wrap">'+wsEsc(rig)+'</div></div>';if(bs.trim())html+='<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)"><div style="font-size:0.68em;font-weight:700;color:#64748b;margin-bottom:5px">\uD83C\uDFAD BAND SPACE</div><div style="font-size:0.82em;color:#94a3b8;white-space:pre-wrap">'+wsEsc(bs)+'</div></div>';return html||'<div style="color:#64748b;font-size:0.8em;padding:4px 0">Nothing added yet</div>';}
function wsToggleMate(k,s){var el=document.getElementById('wsmate_'+k);if(el)el.style.display=el.style.display==='none'?'block':'none';}
async function wsToggleItem(s,idx,k){if(!firebaseDB)return;var path=bandPath('songs/'+sanitizeFirebasePath(s)+'/woodshed/'+k);try{var snap=await firebaseDB.ref(path).once('value');var data=snap.val()||{};var cl=data.checklist||[];if(!cl[idx])return;cl[idx].done=!cl[idx].done;await firebaseDB.ref(path+'/checklist').set(cl);renderWoodshedChecklist(s);}catch(e){showToast('Could not save');}}
async function wsAddItem(s,k){var input=document.getElementById('wsNewItem_'+k);if(!input)return;var text=input.value.trim();if(!text||!firebaseDB)return;var path=bandPath('songs/'+sanitizeFirebasePath(s)+'/woodshed/'+k);try{var snap=await firebaseDB.ref(path).once('value');var data=snap.val()||{};var cl=data.checklist||[];cl.push({id:'custom_'+Date.now(),text:text,done:false,phase:'solo'});await firebaseDB.ref(path+'/checklist').set(cl);input.value='';renderWoodshedChecklist(s);showToast('Item added');}catch(e){showToast('Could not save');}}
async function wsSaveRig(s,k){var el=document.getElementById('wsRig_'+k);if(!el||!firebaseDB)return;try{await firebaseDB.ref(bandPath('songs/'+sanitizeFirebasePath(s)+'/woodshed/'+k+'/rig')).set(el.value);showToast('Rig saved');}catch(e){}}
async function wsSaveBandSpace(s,k){var el=document.getElementById('wsBandSpace_'+k);if(!el||!firebaseDB)return;try{await firebaseDB.ref(bandPath('songs/'+sanitizeFirebasePath(s)+'/woodshed/'+k+'/bandSpace')).set(el.value);showToast('Band space notes saved');}catch(e){}}
function wsEsc(str){if(!str)return '';return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
console.log('Woodshed Checklists loaded');


// ============================================================================
// REHEARSAL PLANNER + RSVP
// ============================================================================
// Data model: bands/{slug}/rehearsals/{id}/
//   date, time, location, notes, createdBy
//   rsvps/{ memberKey: { status: 'yes'|'maybe'|'no', note: '' } }
//   plan/{ songs: [], focusSections: {}, notes: '' }
// ============================================================================

// rhCurrentEventId state var,
// renderRehearsalPage(), rhLoadEvents(), rhTogglePast(), rhEventCard(),
// rhOpenEvent(), rhTimerRender(), rhTimerToggle(), rhTimerNext(),
// rhTimerReset(), _rhTimerSetGoal(), rhTimerInit(), rhRenderScoreboard(),
// rhRenderPlanSongs(), rhSetRsvp(), rhAddSongToPlan(), rhRemoveSongFromPlan(),
// rhSavePlan(), rhSavePlanData(), rhSendToPracticePlan(),
// rhGenerateSuggestions(), rhApplySuggestions(),
// rhOpenCreateModal(), rhOpenEditModal(), rhShowEventModal(),
// rhSaveEvent(), rhDeleteEvent(), rhGetAllEvents(), rhFormatDate()
// → js/features/rehearsal.js


// ============================================================================
// LIVE GIG MODE — Setlist-driven chart reader (reuses Practice Mode engine)
// ============================================================================

// _gmSetlist, _gmFlatList, _gmPlayedSet, _gmOverlayBuilt, _gmDrawerOpen state vars,
// openGigMode(), closeGigMode(), gmOpenPocket(), _gmShow(), gmNavigate(),
// gmMarkPlayed(), _gmRenderNav(), gmToggleDrawer(), gmCloseDrawer(),
// _gmRefreshDrawerIfOpen(), _gmRenderDrawer(), gmJumpTo(),
// _gmUpdateNowPlaying(), _gmEnsureOverlay(),
// loadGigPayouts(), gpRenderExpenses(), gpReadExpensesFromDOM(),
// gpAddExpense(), gpRemoveExpense(), gpSave()
// → js/features/gigs.js

console.log('\uD83D\uDCB0 Gig Payouts loaded');

// ============================================================================
// READINESS HEATMAP — Song list overlay
// ============================================================================
var _heatmapMode = false;

function toggleHeatmapMode() {
    _heatmapMode = !_heatmapMode;
    var btn = document.getElementById('heatmapToggleBtn');
    if (btn) {
        btn.style.background = _heatmapMode ? 'rgba(102,126,234,0.25)' : 'rgba(255,255,255,0.06)';
        btn.style.color = _heatmapMode ? '#818cf8' : '#94a3b8';
        btn.style.borderColor = _heatmapMode ? 'rgba(102,126,234,0.4)' : 'rgba(255,255,255,0.1)';
    }
    if (_heatmapMode && !readinessCacheLoaded) {
        preloadReadinessCache().then(function() { renderHeatmapOverlay(); });
    } else {
        renderHeatmapOverlay();
    }
}

function renderHeatmapOverlay() {
    document.querySelectorAll('.song-heatmap-bar').forEach(function(el) { el.remove(); });
    if (!_heatmapMode) return;
    document.querySelectorAll('.song-item').forEach(function(item) {
        var title = item.dataset.title || '';
        if (!title) return;
        var scores = readinessCache[title] || {};
        var vals = BAND_MEMBERS_ORDERED.map(function(m) { return scores[m.key] || 0; });
        var set = vals.filter(function(v) { return v > 0; });
        if (!set.length) return;
        var avg = set.reduce(function(a,b){ return a+b; }, 0) / set.length;
        var hue = Math.round((avg-1)/4*120);
        var stripe = document.createElement('div');
        stripe.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:3px;background:hsl('+hue+',65%,45%);border-radius:8px 0 0 8px;pointer-events:none;z-index:1';
        var dots = document.createElement('div');
        dots.className = 'song-heatmap-bar';
        dots.style.cssText = 'position:absolute;right:3px;top:50%;transform:translateY(-50%);display:flex;gap:2px;align-items:center;pointer-events:none;z-index:2';
        dots.innerHTML = BAND_MEMBERS_ORDERED.map(function(m) {
            var s = scores[m.key] || 0;
            var c = s ? readinessColor(s) : 'rgba(255,255,255,0.1)';
            return '<span title="'+m.name+': '+(s?s+'/5':'not set')+'" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+c+'"></span>';
        }).join('');
        item.style.position = 'relative';
        item.appendChild(stripe);
        item.appendChild(dots);
    });
}

console.log('\uD83C\uDF21\uFE0F Readiness Heatmap loaded');


// ============================================================================
// STONER MODE — Simplified "I just wanna play" interface
// ============================================================================
var _stonerMode = false;

function toggleStonerMode() {
    _stonerMode = !_stonerMode;
    localStorage.setItem('deadcetera_stoner_mode', _stonerMode ? '1' : '0');
    if (_stonerMode) {
        _stonerEnter();
    } else {
        _stonerExit();
    }
}

function _stonerEnter() {
    _stonerEnsureOverlay();
    var ov = document.getElementById('stonerOverlay');
    if (ov) ov.classList.add('stoner-visible');
    document.body.style.overflow = 'hidden';
    _stonerRender();
    // Update topbar button
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '😵 Exit'; btn.style.background = 'rgba(139,92,246,0.3)'; btn.style.color = '#c084fc'; btn.style.borderColor = 'rgba(139,92,246,0.5)'; }
}

function _stonerExit() {
    var ov = document.getElementById('stonerOverlay');
    if (ov) ov.classList.remove('stoner-visible');
    document.body.style.overflow = '';
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
}

function _stonerEnsureOverlay() {
    if (document.getElementById('stonerOverlay')) return;

    var style = document.createElement('style');
    style.textContent = [
        '#stonerOverlay{display:none;position:fixed;inset:0;z-index:2500;background:linear-gradient(160deg,#0a0a1a 0%,#0d1117 40%,#0a0f0a 100%);flex-direction:column;overflow:hidden}',
        '#stonerOverlay.stoner-visible{display:flex!important}',
        '.stoner-big-btn{width:100%;padding:20px;border-radius:16px;font-size:1.1em;font-weight:800;cursor:pointer;border:1px solid;transition:all 0.18s;letter-spacing:0.02em;display:flex;align-items:center;justify-content:center;gap:12px;min-height:64px}',
        '.stoner-big-btn:active{transform:scale(0.97)}',
        '.stoner-song-row{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.1s}',
        '.stoner-song-row:hover,.stoner-song-row:active{background:rgba(255,255,255,0.06)}',
        '.stoner-search{width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#f1f5f9;padding:14px 16px;font-size:1.1em;font-family:inherit;outline:none;box-sizing:border-box}',
        '.stoner-search:focus{border-color:rgba(139,92,246,0.5);background:rgba(255,255,255,0.09)}',
        '.stoner-search::placeholder{color:#475569}'
    ].join('\n');
    document.head.appendChild(style);

    var ov = document.createElement('div');
    ov.id = 'stonerOverlay';

    // Header
    ov.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;background:rgba(0,0,0,0.3)">'
        + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.4em">\uD83C\uDF3F</span><span style="font-weight:800;font-size:1.05em;color:#c084fc">Stoner Mode</span></div>'
        + '<button onclick="toggleStonerMode()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:700">Exit</button>'
        + '</div>'
        + '<div id="stonerContent" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch"></div>';

    document.body.appendChild(ov);
}

function _stonerRender() {
    var content = document.getElementById('stonerContent');
    if (!content) return;

    content.innerHTML = '<div id="stonerHome"></div>';
    _stonerRenderHome();
}

function _stonerRenderHome() {
    var home = document.getElementById('stonerHome');
    if (!home) return;

    home.innerHTML = [
        // Big search
        '<div style="padding:20px 16px 12px">',
        '  <div style="font-size:0.72em;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;text-align:center">What are we playing?</div>',
        '  <input class="stoner-search" id="stonerSearchInput" placeholder="\uD83D\uDD0D Type a song..." oninput="stonerSearch(this.value)" autocomplete="off" autocorrect="off" spellcheck="false">',
        '  <div id="stonerSearchResults" style="margin-top:6px;border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"></div>',
        '</div>',
        // Big action buttons
        '<div style="padding:0 16px;display:flex;flex-direction:column;gap:10px;margin-bottom:20px">',
        '  <button class="stoner-big-btn" onclick="stonerPickSetlist()" style="background:rgba(102,126,234,0.12);border-color:rgba(102,126,234,0.3);color:#818cf8">',
        '    <span style="font-size:1.4em">\uD83D\uDCCB</span> <span id="stonerActiveSetlistLabel">Pick a Setlist</span>',
        '  </button>',
        '  <button class="stoner-big-btn" onclick="stonerOpenGigs()" style="background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.25);color:#22c55e">',
        '    <span style="font-size:1.4em">\uD83C\uDFA4</span> Gigs',
        '  </button>',
        '</div>',
        // Recent songs
        '<div style="padding:0 16px"><div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px">Recent Songs</div>',
        '<div id="stonerRecentSongs"></div></div>'
    ].join('');

    // Load recent songs from activity log
    _stonerLoadRecent();
    // Update active setlist label
    _stonerUpdateSetlistLabel();
}

function stonerSearch(q) {
    var results = document.getElementById('stonerSearchResults');
    if (!results) return;
    if (!q || q.length < 2) { results.innerHTML = ''; return; }
    var matches = (typeof allSongs !== 'undefined' ? allSongs : [])
        .filter(function(s) { return s.title.toLowerCase().includes(q.toLowerCase()); })
        .slice(0, 8);
    if (!matches.length) { results.innerHTML = '<div style="padding:12px 16px;color:#64748b;font-size:0.9em">No songs found</div>'; return; }
    results.innerHTML = matches.map(function(s) {
        var bandColor = { GD:'#f87171', JGB:'#60a5fa', WSP:'#fbbf24', PHISH:'#34d399' }[s.band] || '#94a3b8';
        return '<div class="stoner-song-row" onclick="stonerLaunchSong(\'' + s.title.replace(/'/g,"\\'") + '\')">'
            + '<span style="font-size:0.72em;font-weight:700;color:' + bandColor + ';background:' + bandColor + '18;padding:2px 7px;border-radius:10px;flex-shrink:0">' + (s.band||'?') + '</span>'
            + '<span style="flex:1;font-size:0.95em;font-weight:600;color:#f1f5f9">' + s.title + '</span>'
            + '<span style="font-size:1em;color:#64748b">\u276F</span>'
            + '</div>';
    }).join('');
}

function stonerLaunchSong(title) {
    // Close overlay, select song, open practice mode on Chart tab
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    // Use Practice Mode
    if (typeof openRehearsalMode === 'function') {
        openRehearsalMode(title);
    } else if (typeof selectSong === 'function') {
        showPage('songs');
        selectSong(title);
    }
}

function _stonerLoadRecent() {
    var container = document.getElementById('stonerRecentSongs');
    if (!container) return;
    // Get recent from activity log cache or localStorage
    var recent = [];
    try {
        var logged = JSON.parse(localStorage.getItem('deadcetera_recent_songs') || '[]');
        recent = logged.slice(0, 6);
    } catch(e) {}
    // Fallback: try activityLog global
    if (!recent.length && typeof window._activityLog !== 'undefined') {
        var seen = new Set();
        window._activityLog.forEach(function(entry) {
            if (entry.songTitle && !seen.has(entry.songTitle)) {
                seen.add(entry.songTitle);
                recent.push(entry.songTitle);
            }
        });
        recent = recent.slice(0, 6);
    }
    if (!recent.length) {
        container.innerHTML = '<div style="color:#475569;font-size:0.85em;padding:8px 0">Play some songs and they\'ll show up here</div>';
        return;
    }
    container.innerHTML = recent.map(function(title) {
        var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === title; });
        var band = songData ? songData.band : '';
        var bandColor = { GD:'#f87171', JGB:'#60a5fa', WSP:'#fbbf24', PHISH:'#34d399' }[band] || '#94a3b8';
        return '<div class="stoner-song-row" style="border-radius:10px;margin-bottom:4px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)" onclick="stonerLaunchSong(\'' + title.replace(/'/g,"\\'") + '\')">'
            + (band ? '<span style="font-size:0.7em;font-weight:700;color:' + bandColor + ';flex-shrink:0">' + band + '</span>' : '')
            + '<span style="flex:1;font-size:0.95em;color:#e2e8f0">' + title + '</span>'
            + '<span style="color:#64748b;font-size:0.9em">\uD83D\uDCCB</span>'
            + '</div>';
    }).join('');
}

function _stonerExitToPage(page) {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    showPage(page);
}

function stonerExitToGigs() { _stonerExitToPage('gigs'); }

function stonerGoHome() {
    var content = document.getElementById('stonerContent');
    if (!content) return;
    content.innerHTML = '<div id="stonerHome"></div>';
    _stonerRenderHome();
}

async function stonerOpenSetlists() {
    var content = document.getElementById('stonerContent');
    if (!content) return;
    var header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0';
    header.innerHTML = '<button onclick="stonerGoHome()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:600">\u2190 Home</button>'
        + '<span style="font-weight:700;color:#f1f5f9">\uD83D\uDCCB Setlists</span>';
    var listDiv = document.createElement('div');
    listDiv.id = 'stonerSetlistList';
    listDiv.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px';
    listDiv.innerHTML = '<div style="color:#64748b;font-size:0.85em;padding:20px;text-align:center">Loading...</div>';
    content.innerHTML = '';
    content.appendChild(header);
    content.appendChild(listDiv);

    var data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    data.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    var list = document.getElementById('stonerSetlistList');
    if (!list) return;
    if (!data.length) { list.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">No setlists yet</div>'; return; }
    list.innerHTML = data.map(function(sl, i) {
        var totalSongs = (sl.sets||[]).reduce(function(a,s){ return a+(s.songs||[]).length; }, 0);
        return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;margin-bottom:10px">'
            + '<div style="font-weight:700;font-size:0.95em;color:#f1f5f9;margin-bottom:4px">' + (sl.name||'Untitled') + '</div>'
            + '<div style="font-size:0.78em;color:#64748b;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
            + (sl.date ? '<span>\uD83D\uDCC5 ' + sl.date + '</span>' : '')
            + (sl.venue ? '<span>\uD83C\uDFDB\uFE0F ' + sl.venue + '</span>' : '')
            + '<span>\uD83C\uDFB5 ' + totalSongs + ' songs</span>'
            + '</div>'
            + '<button onclick="stonerLaunchSetlist(' + i + ')" style="background:linear-gradient(135deg,#22c55e,#16a34a);border:none;color:white;padding:8px 20px;border-radius:8px;font-size:0.85em;font-weight:700;cursor:pointer">\uD83C\uDFA4 Go Live</button>'
            + '</div>';
    }).join('');
}

async function stonerLaunchSetlist(idx) {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    if (typeof launchGigMode === 'function') await launchGigMode(idx);
}

function stonerOpenGigs() {
    var content = document.getElementById('stonerContent');
    if (!content) return;
    var header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0';
    header.innerHTML = '<button onclick="stonerGoHome()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:600">\u2190 Home</button>'
        + '<span style="font-weight:700;color:#f1f5f9">\uD83C\uDFA4 Gigs</span>'
        + '<button onclick="stonerExitToGigs()" style="margin-left:auto;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75em">Full View \u2192</button>';
    var bodyDiv = document.createElement('div');
    bodyDiv.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px';
    bodyDiv.innerHTML = '<div style="color:#64748b;font-size:0.85em;padding:20px;text-align:center">Loading gigs...</div>';
    content.innerHTML = '';
    content.appendChild(header);
    content.appendChild(bodyDiv);
    // Load gigs async
    loadBandDataFromDrive('_band','gigs').then(function(raw2) {
        var gigs = toArray(raw2||[]).sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});
        if (!gigs.length) { bodyDiv.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">No gigs yet</div>'; return; }
        var upcoming = gigs.filter(function(g){ return g.date >= new Date().toISOString().slice(0,10); });
        var past = gigs.filter(function(g){ return g.date < new Date().toISOString().slice(0,10); });
        function gigCard(g) {
            return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;margin-bottom:8px">'
                + '<div style="font-weight:700;color:#f1f5f9">' + (g.venue||'Unknown Venue') + '</div>'
                + '<div style="font-size:0.8em;color:#64748b;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">'
                + (g.date?'<span>\uD83D\uDCC5 '+g.date+'</span>':'')
                + (g.startTime?'<span>\uD83D\uDD50 '+g.startTime+'</span>':'')
                + (g.pay?'<span>\uD83D\uDCB0 '+g.pay+'</span>':'')
                + '</div></div>';
        }
        var html = '';
        if (upcoming.length) {
            html += '<div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px">Upcoming</div>';
            html += upcoming.map(gigCard).join('');
        }
        if (past.length) {
            html += '<div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;margin:16px 0 8px">Past</div>';
            html += past.slice(0,5).map(gigCard).join('');
        }
        bodyDiv.innerHTML = html;
    });
}

async function stonerPickSetlist() {
    var container = document.getElementById('stonerContent');
    if (!container) return;
    container.innerHTML = '';
    var el = document.createElement('div');
    el.style.cssText = 'padding:20px 16px';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px';
    var backBtn = document.createElement('button');
    backBtn.textContent = '\u2190 Back';
    backBtn.className = 'btn btn-ghost btn-sm';
    backBtn.onclick = stonerGoHome;
    var title = document.createElement('div');
    title.style.cssText = 'font-weight:800;font-size:1.1em;color:#f1f5f9';
    title.textContent = '\uD83D\uDCCB Pick a Setlist';
    header.appendChild(backBtn);
    header.appendChild(title);
    el.appendChild(header);

    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    setlists.sort(function(a,b) { return (b.updatedAt||b.date||'').localeCompare(a.updatedAt||a.date||''); });

    if (!setlists.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;color:#64748b;padding:40px 0;font-size:0.9em';
        empty.textContent = 'No setlists yet. Create one in the Setlists page.';
        el.appendChild(empty);
    } else {
        setlists.forEach(function(sl, i) {
            var btn = document.createElement('button');
            btn.className = 'stoner-big-btn';
            var songCount = (sl.sets||[]).reduce(function(a,s){return a+(s.songs||[]).length;},0);
            btn.innerHTML = '<span style="font-size:1.3em">\uD83D\uDCCB</span>'
                + '<span style="flex:1;text-align:left"><div style="font-weight:800">' + (sl.name||'Untitled') + '</div>'
                + '<div style="font-size:0.72em;opacity:0.7;margin-top:2px">' + (sl.date?sl.date+' \u2022 ':'') + songCount + ' songs</div></span>';
            btn.style.cssText = 'background:rgba(102,126,234,0.1);border-color:rgba(102,126,234,0.25);color:#c7d2fe;margin-bottom:8px;justify-content:flex-start;padding:14px 16px;gap:12px';
            btn.onclick = function() {
                localStorage.setItem('deadcetera_stoner_setlist', i);
                _stonerUpdateSetlistLabel();
                stonerGoHome();
                showToast('\uD83D\uDCCB ' + (sl.name||'Setlist') + ' selected');
            };
            el.appendChild(btn);
        });
    }
    container.appendChild(el);
}

function _stonerUpdateSetlistLabel() {
    var label = document.getElementById('stonerActiveSetlistLabel');
    if (!label) return;
    var idx = localStorage.getItem('deadcetera_stoner_setlist');
    if (idx === null) { label.textContent = 'Pick a Setlist'; return; }
    // Load name async
    loadBandDataFromDrive('_band', 'setlists').then(function(setlists) {
        setlists = toArray(setlists || []);
        setlists.sort(function(a,b) { return (b.updatedAt||b.date||'').localeCompare(a.updatedAt||a.date||''); });
        var sl = setlists[parseInt(idx)];
        if (sl) label.textContent = sl.name || 'Setlist';
        else { label.textContent = 'Pick a Setlist'; localStorage.removeItem('deadcetera_stoner_setlist'); }
    });
}

function stonerOpenTuner() {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    showPage('tuner');
}

function stonerOpenMetronome() {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    showPage('metronome');
}

// ── Inject Stoner Mode button into topbar on load ─────────────────────────────
(function() {
    function injectStonerBtn() {
        if (document.getElementById('stonerBtn')) return;
        var topbarRight = document.querySelector('.topbar-right');
        if (!topbarRight) return;
        var btn = document.createElement('button');
        btn.id = 'stonerBtn';
        btn.className = 'topbar-btn';
        btn.title = 'Stoner Mode — simplified UI for when you just wanna play';
        btn.textContent = '\uD83C\uDF3F Mode';
        btn.onclick = toggleStonerMode;
        // Insert before the last button (settings gear)
        var gear = topbarRight.querySelector('[title*="Settings"],[onclick*="admin"],[onclick*="settings"]');
        if (gear) {
            topbarRight.insertBefore(btn, gear);
        } else {
            topbarRight.appendChild(btn);
        }
        // Restore stoner mode state if it was on
        if (localStorage.getItem('deadcetera_stoner_mode') === '1') {
            _stonerMode = true;
            _stonerEnter();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(injectStonerBtn, 500); });
    } else {
        setTimeout(injectStonerBtn, 500);
    }
})();

console.log('\uD83C\uDF3F Stoner Mode loaded');
