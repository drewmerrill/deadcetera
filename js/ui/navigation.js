// ============================================================================
// js/ui/navigation.js
// Page navigation shell: showPage(), toggleMenu(), and the pageRenderers map.
// Extracted from app.js Wave 1 refactor (lines ~8690–8730).
//
// DEPENDS ON: nothing at load time.
//   pageRenderers values (renderSetlistsPage, renderGigsPage, etc.) are
//   defined later in app.js and resolved at call time, so load order is safe.
//
// EXPOSES globals:
//   currentPage         — string, name of the currently visible page
//   showPage(page)      — main navigation entry point
//   toggleMenu()        — slide-out menu open/close
//   pageRenderers       — map of page name → render function
// ============================================================================

'use strict';

var currentPage = 'songs';
var _navSeq = 0; // Navigation sequence counter — prevents stale async renders from setting GL_PAGE_READY

/**
 * Navigate to a named page.
 * - Closes the slide-out menu.
 * - Hides all .app-page elements; shows the target one.
 * - Updates .menu-item active state.
 * - Calls the matching renderer from pageRenderers (except 'songs', which
 *   is driven by selectSong and is already rendered on load).
 *
 * @param {string} page  Matches the id of `#page-{page}` in the DOM.
 */
window.showPage = function showPage(page) {
    // ── Phase F: Deprecation shim ─────────────────────────────────────────
    // Any showPage('songdetail') call — including legacy ones in app.js /
    // app-dev.js selectSong() — is intercepted here when the BCC right-panel
    // shell is active (gl-right-panel.js loaded, window.glRightPanel.open
    // is a function).  The call is swallowed and re-routed to GLStore so the
    // panel opens instead of a full-page navigation.
    //
    // Falls through to the original page-swap logic when:
    //   · glRightPanel is not loaded (production index.html), OR
    //   · no selectedSong is available to open
    if (page === 'songdetail') {
        if (window.glRightPanel && typeof window.glRightPanel.open === 'function') {
            var _shimTitle = null;
            if (typeof selectedSong !== 'undefined' && selectedSong) {
                _shimTitle = (selectedSong && selectedSong.title)
                    ? selectedSong.title
                    : (typeof selectedSong === 'string' ? selectedSong : null);
            }
            if (_shimTitle) {
                if (typeof GLStore !== 'undefined' && typeof GLStore.selectSong === 'function') {
                    GLStore.selectSong(_shimTitle);
                } else {
                    window.glRightPanel.open(_shimTitle);
                }
                return; // swallow full-page nav -- panel handles it
            }
        }
        // Fallthrough: no panel or no song -- let full-page nav proceed normally
    }
    // Close slide-out menu
    document.getElementById('slideMenu')?.classList.remove('open');
    document.getElementById('menuOverlay')?.classList.remove('open');

    // Hide right panel when navigating away from songs (preserve selection)
    if (page !== 'songs' && window.glRightPanel && typeof window.glRightPanel.hide === 'function') {
        window.glRightPanel.hide();
    }

    // Restore right panel when entering songs (skip if a reload restore is pending)
    // On mobile (<900px), don't auto-open panel — it takes over the whole screen
    if (page === 'songs' && window.glRightPanel && typeof window.glRightPanel.open === 'function'
        && !window._glPanelRestorePending && window.innerWidth >= 900) {
        var _savedSong = (typeof GLStore !== 'undefined' && GLStore.getSelectedSong) ? GLStore.getSelectedSong() : null;
        if (_savedSong) {
            if (typeof highlightSelectedSongRow === 'function') highlightSelectedSongRow(_savedSong);
            window.glRightPanel.open();
        } else {
            window.glRightPanel.renderBandSnapshot();
            window.glRightPanel.open();
        }
    }

    // Hide all pages
    document.querySelectorAll('.app-page').forEach(function(p) {
        p.classList.add('hidden');
    });

    // Show target page
    var _thisNav = ++_navSeq; // Capture sequence for this navigation
    window.GL_PAGE_READY = null; // Reset until renderer completes
    var el = document.getElementById('page-' + page);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('fade-in');
    } else {
        console.warn('⚠️ showPage("' + page + '"): #page-' + page + ' not found in DOM');
    }

    // Update nav active states
    document.querySelectorAll('.menu-item').forEach(function(m) {
        m.classList.toggle('active', m.dataset.page === page);
    });

    currentPage = page;
    window._glCurrentPage = page; // For global error handler
    // Mirror into GLStore (Milestone 4) — currentPage global stays for compat
    if (typeof GLStore !== 'undefined' && typeof GLStore.setActivePage === 'function') {
        GLStore.setActivePage(page);
    }
    // Emit page change event (used by avatar and other listeners instead of polling)
    try { window.dispatchEvent(new CustomEvent('gl:pagechange', { detail: { page: page } })); } catch(e) {}
    // Release wake locks for utility pages when navigating away
    if (typeof glWakeLock !== 'undefined') {
        var _wlPages = { pocketmeter: 'pocket-meter', tuner: 'tuner', metronome: 'metronome' };
        Object.keys(_wlPages).forEach(function(p) {
            if (p !== page) glWakeLock.release(_wlPages[p]);
        });
    }
    // Update browser URL hash for back/forward navigation
    // Skip push when navigating to the same page (prevents duplicate history entries
    // that make browser Back appear to do nothing).
    if (!window._glNavFromPopstate) {
        var _prevHash = location.hash ? location.hash.slice(1) : '';
        if (_prevHash !== page) {
            try { history.pushState({ page: page }, '', '#' + page); } catch(e) {}
        }
    }
    window._glNavFromPopstate = false;
    window.scrollTo(0, 0);
    try { localStorage.setItem('glLastPage', page); } catch(e) {}

    // Run renderer (songs page is rendered by selectSong / renderSongs, not here)
    if (el && page === 'songs') {
        // Songs page skips renderer — mark ready immediately (content managed by renderSongs)
        if (_thisNav === _navSeq) window.GL_PAGE_READY = page;
    }
    if (el && page !== 'songs') {
        if (_glPageScripts[page]) {
            // Show loading state immediately via GLRenderState — never blank
            if (typeof GLRenderState !== 'undefined') {
                GLRenderState.set(page, { status: 'loading' });
            } else if (!el.textContent.trim()) {
                el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-dim)">Loading\u2026</div>';
            }
            // Lazy-load page scripts, then render
            var _lazyStart = performance.now();
            _glLazyLoadPage(page, (function(_seq) { return function() {
                console.log('[DependenciesReady] Page "' + page + '" scripts loaded in ' + Math.round(performance.now() - _lazyStart) + 'ms');
                if (_seq !== _navSeq) { console.log('[Navigation] Stale render skipped for "' + page + '"'); return; }
                var renderer = pageRenderers[page];
                if (typeof renderer === 'function') {
                    console.log('[RenderStart] ' + page);
                    try {
                        var _renderResult = renderer(el);
                        console.log('[RenderSuccess] ' + page);
                        // Set page-ready flag after async renderers resolve
                        if (_renderResult && typeof _renderResult.then === 'function') {
                            _renderResult.then(function() { if (_seq === _navSeq) window.GL_PAGE_READY = page; }).catch(function() { if (_seq === _navSeq) window.GL_PAGE_READY = page; });
                        } else {
                            if (_seq === _navSeq) window.GL_PAGE_READY = page;
                        }
                    }
                    catch(renderErr) {
                        console.error('[RenderError] ' + page + ':', renderErr);
                        if (_seq === _navSeq) window.GL_PAGE_READY = page;
                        if (typeof GLRenderState !== 'undefined') {
                            GLRenderState.set(page, { status: 'error', title: 'Render failed', message: renderErr.message, retry: "showPage('" + page + "')" });
                        }
                    }
                }
            }; })(_thisNav));
        } else {
            var renderer = pageRenderers[page];
            if (typeof renderer === 'function') {
                console.log('[RenderStart] ' + page);
                try {
                    var _renderResult2 = renderer(el);
                    console.log('[RenderSuccess] ' + page);
                    if (_renderResult2 && typeof _renderResult2.then === 'function') {
                        (function(_seq) {
                            _renderResult2.then(function() { if (_seq === _navSeq) window.GL_PAGE_READY = page; }).catch(function() { if (_seq === _navSeq) window.GL_PAGE_READY = page; });
                        })(_thisNav);
                    } else {
                        if (_thisNav === _navSeq) window.GL_PAGE_READY = page;
                    }
                }
                catch(renderErr) {
                    console.error('[RenderError] ' + page + ':', renderErr);
                    if (_thisNav === _navSeq) window.GL_PAGE_READY = page;
                    if (typeof GLRenderState !== 'undefined') {
                        GLRenderState.set(page, { status: 'error', title: 'Render failed', message: renderErr.message, retry: "showPage('" + page + "')" });
                    }
                }
            }
        }
    }

    // Auto-offer Starter Pack on songs page when library is nearly empty
    if (page === 'songs' && typeof allSongs !== 'undefined' && allSongs.length < 5
        && typeof showStarterPackImport === 'function' && !window._starterPackOffered) {
        window._starterPackOffered = true;
        setTimeout(showStarterPackImport, 500);
    }

    // First-time onboarding overlay — shows once per page per device
    if (typeof glCheckOnboarding === 'function') glCheckOnboarding(page);
};

/**
 * Toggle the slide-out navigation menu.
 */
window.toggleMenu = function toggleMenu() {
    var menu    = document.getElementById('slideMenu');
    var overlay = document.getElementById('menuOverlay');
    if (!menu) return;
    var isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    if (overlay) overlay.classList.toggle('open', !isOpen);
};

// ── Lazy Script Loader ──────────────────────────────────────────────────────
// Loads feature scripts on-demand instead of at boot.
// Scripts are loaded once and cached. Build version is appended for cache busting.

var _glLazyLoaded = {};

window.glLazy = function glLazy(src) {
    if (_glLazyLoaded[src]) return _glLazyLoaded[src];
    // Check if already in DOM (loaded at boot or previous lazy load)
    if (document.querySelector('script[src^="' + src + '"]')) {
        _glLazyLoaded[src] = Promise.resolve();
        return _glLazyLoaded[src];
    }
    var buildV = (typeof BUILD_VERSION !== 'undefined') ? BUILD_VERSION : '';
    var fullSrc = src + (buildV ? '?v=' + buildV : '');
    console.log('[Lazy] Loading ' + src);
    _glLazyLoaded[src] = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = fullSrc;
        s.onload = function() {
            console.log('[Lazy] Loaded ' + src);
            resolve();
        };
        s.onerror = function() {
            console.error('[Lazy] Failed to load ' + src);
            _glLazyLoaded[src] = null; // allow retry
            reject(new Error('Failed to load ' + src));
        };
        document.body.appendChild(s);
    });
    return _glLazyLoaded[src];
};

// Map pages to their lazy-loaded script(s).
// Only scripts removed from index.html need entries here.
var _glPageScripts = {
    rehearsal:       ['js/features/rehearsal.js', 'js/features/rehearsal-mixdowns.js'],
    'rehearsal-intel': ['js/features/rehearsal.js'],
    gigs:            ['js/features/gigs.js', 'js/features/stoner-mode.js', 'js/features/live-gig.js'],
    bestshot:        ['js/features/bestshot.js'],
    practice:        ['js/features/practice.js'],
    pocketmeter:     ['pocket-meter.js'],
    stageplot:       ['js/features/stage-plot.js'],
    finances:        ['js/features/finances.js'],
    social:          ['js/features/social.js'],
    notifications:   ['js/features/notifications.js'],
    playlists:       ['js/features/playlists.js'],
    calendar:        ['js/features/calendar.js', 'js/core/calendar-export.js'],
    ideas:           ['js/features/band-comms.js', 'js/features/song-pitch.js'],
    feed:            ['js/features/band-feed.js'],
    'rehearsal-mode': ['rehearsal-mode.js'],
    help:            ['help.js', 'js/ui/gl-help-v2.js']
};

// Load all scripts for a page, then run callback.
// Includes timeout fallback — never leaves a blank screen.
var LAZY_WARN_MS = 3000;
var LAZY_TIMEOUT_MS = 6000;

function _glLazyLoadPage(page, callback) {
    var scripts = _glPageScripts[page];
    if (!scripts || !scripts.length) { callback(); return; }
    var done = false;

    // Warning at 3s — show degraded state
    var warnTimer = setTimeout(function() {
        if (done) return;
        console.warn('[Lazy] Scripts for "' + page + '" taking longer than ' + LAZY_WARN_MS + 'ms');
        if (typeof GLRenderState !== 'undefined') {
            GLRenderState.set(page, { status: 'loading', message: 'Still loading\u2026 this is taking longer than usual.' });
        }
    }, LAZY_WARN_MS);

    // Hard timeout at 6s — show error with retry
    var failTimer = setTimeout(function() {
        if (done) return;
        done = true;
        console.error('[Lazy] Timeout loading scripts for "' + page + '" after ' + LAZY_TIMEOUT_MS + 'ms');
        if (typeof GLRenderState !== 'undefined') {
            GLRenderState.set(page, {
                status: 'error',
                title: 'Page loading slowly',
                message: 'Check your connection and try again.',
                retry: "showPage('" + page + "')"
            });
        }
        callback(); // try rendering anyway — typeof guards prevent crashes
    }, LAZY_TIMEOUT_MS);

    Promise.all(scripts.map(function(src) { return glLazy(src); })).then(function() {
        if (done) return;
        done = true;
        clearTimeout(warnTimer);
        clearTimeout(failTimer);
        callback();
    }).catch(function(err) {
        if (done) return;
        done = true;
        clearTimeout(warnTimer);
        clearTimeout(failTimer);
        console.error('[Lazy] Page load failed for ' + page + ':', err);
        if (typeof GLRenderState !== 'undefined') {
            GLRenderState.set(page, { status: 'error', title: 'Failed to load', message: err.message, retry: "showPage('" + page + "')" });
        }
        callback();
    });
}

// ── Stubs for lazy-loaded functions referenced from boot scripts ─────────────
// These provide safe fallbacks until the real implementation loads.
if (typeof venueShortLabel === 'undefined') {
    window.venueShortLabel = function(v) {
        if (!v) return '';
        return (v.name || '') + (v.city ? ' — ' + v.city : '');
    };
}

/**
 * Map of page names to their render functions.
 * Functions are resolved at call time (not at definition time), so they
 * can be defined anywhere in app.js after this file loads.
 *
 * To register a renderer from a new module file, do:
 *   pageRenderers.mypage = myRenderFunction;
 * ...after this script runs.
 */
var pageRenderers = window.pageRenderers = {
    setlists:      function(el) { if (typeof renderSetlistsPage      === 'function') renderSetlistsPage(el);      },
    // live-gig is a full-screen overlay — launched via launchLiveGig() directly
    playlists:     function(el) { if (typeof renderPlaylistsPage     === 'function') renderPlaylistsPage(el);     },
    practice:      function(el) { if (typeof renderPracticePage      === 'function') renderPracticePage(el);      },
    rehearsal:     function(el) { if (typeof renderRehearsalPage     === 'function') renderRehearsalPage(el);     },
    'rehearsal-intel': function(el) { if (typeof renderRehearsalIntel === 'function') renderRehearsalIntel(el); },
    calendar:      function(el) { if (typeof renderCalendarPage      === 'function') renderCalendarPage(el);      },
    gigs:          function(el) { if (typeof renderGigsPage          === 'function') renderGigsPage(el);          },
    venues:        function(el) { if (typeof renderVenuesPage        === 'function') renderVenuesPage(el);        },
    finances:      function(el) { if (typeof renderFinancesPage      === 'function') renderFinancesPage(el);      },
    tuner:         function(el) { if (typeof renderTunerPage         === 'function') renderTunerPage(el);         },
    metronome:     function(el) { if (typeof renderMetronomePage     === 'function') renderMetronomePage(el);     },
    bestshot:      function(el) { if (typeof renderBestShotPage      === 'function') renderBestShotPage(el);      },
    admin:         function(el) { if (typeof renderSettingsPage      === 'function') renderSettingsPage(el);      },
    social:        function(el) { if (typeof renderSocialPage        === 'function') renderSocialPage(el);        },
    notifications: function(el) { if (typeof renderNotificationsPage === 'function') renderNotificationsPage(el); },
    pocketmeter:   function(el) { if (typeof renderPocketMeterPage   === 'function') renderPocketMeterPage(el);   },
    help:          function(el) {
        if      (typeof renderHelpPage === 'function') renderHelpPage(el);
        else el.innerHTML = '<p>Help loading…</p>';
    },
    ideas:         function(el) { if (typeof renderIdeasBoardPage   === 'function') renderIdeasBoardPage(el);   },
    stageplot:     function(el) { if (typeof renderStagePlotPage    === 'function') renderStagePlotPage(el);    },
};

// ── Browser history support ───────────────────────────────────────────────

// Pages the hash router will accept. Anything else falls back to 'home'.
var _HASH_VALID_PAGES = ['songs','home','setlists','playlists','practice','rehearsal','calendar','gigs',
    'venues','finances','tuner','metronome','bestshot','admin',
    'social','notifications','pocketmeter','help','equipment','contacts','rehearsal-intel','stageplot','ideas','feed'];

function _sanitizeHashPage(raw) {
    if (!raw) return 'home';
    return _HASH_VALID_PAGES.indexOf(raw) !== -1 ? raw : 'home';
}

window.addEventListener('popstate', function(e) {
    var raw = (e.state && e.state.page) ? e.state.page : (location.hash ? location.hash.slice(1) : 'home');
    var page = _sanitizeHashPage(raw);
    if (typeof showPage === 'function') {
        window._glNavFromPopstate = true;
        showPage(page);
    }
});

// On first load: read URL hash and navigate (deferred so app init runs first).
// If the hash matches the glLastPage restore, we skip — no double-navigate.
document.addEventListener('DOMContentLoaded', function() {
    var hash = location.hash ? location.hash.slice(1) : '';
    var page = _sanitizeHashPage(hash);
    if (page && page !== 'home') {
        // Signal to glLastPage restore that hash will handle navigation
        window._glHashRestorePending = page;
        setTimeout(function() {
            window._glHashRestorePending = null;
            // Skip if another restore already landed on this page
            if (typeof currentPage !== 'undefined' && currentPage === page) return;
            if (typeof showPage === 'function') {
                window._glNavFromPopstate = true; // don't push duplicate state
                showPage(page);
            }
        }, 900); // after page restore + auth timing
    }
});

console.log('✅ navigation.js loaded');

// ── Restore last page on load ─────────────────────────────────────────────
(function() {
    var SKIP = ['songdetail'];  // songdetail needs song context
    var VALID = ['songs','home','setlists','playlists','practice','rehearsal','calendar','gigs',
                 'venues','finances','tuner','metronome','bestshot','admin',
                 'social','notifications','pocketmeter','help','equipment','contacts',
                 'rehearsal-intel','stageplot','ideas','feed'];
    document.addEventListener('DOMContentLoaded', function() {
        try {
            var last = localStorage.getItem('glLastPage');
            if (last && VALID.indexOf(last) !== -1) {
                // If a URL hash is present and points to a different page, the hash
                // handler (900ms) should win — it represents explicit navigation intent.
                // Skip the localStorage restore to avoid a double-navigate flash.
                var _hashTarget = window._glHashRestorePending || null;
                if (_hashTarget && _hashTarget !== last) {
                    // Hash disagrees with glLastPage — let hash handler take over.
                    // Still set restore-pending so glHeroCheck doesn't clobber us.
                    window._glPageRestorePending = true;
                    if (_hashTarget !== 'songs') {
                        var _sp0 = document.getElementById('page-songs');
                        if (_sp0) _sp0.classList.add('hidden');
                    }
                    return; // yield to hash handler
                }
                // Defer so app.js auth + data init runs first.
                // Set flag so glHeroCheck(true) / 50ms showPage('home') don't
                // override the restored page (same pattern as _glPanelRestorePending).
                window._glPageRestorePending = true;
                // Hide default songs page immediately to prevent flash
                if (last !== 'songs') {
                    var _sp = document.getElementById('page-songs');
                    if (_sp) _sp.classList.add('hidden');
                }
                setTimeout(function() {
                    if (typeof showPage === 'function') showPage(last);
                }, 800);
            } else if (last === 'songdetail') {
                // Production only: restore full-page songdetail
                var lastSong = localStorage.getItem('glLastSong');
                if (!lastSong) return;
                var attempts = 0;
                var maxAttempts = 40; // 4 seconds max
                var interval = setInterval(function() {
                    attempts++;
                    var songsReady = typeof allSongs !== 'undefined' && Array.isArray(allSongs) && allSongs.length > 0;
                    if (songsReady || attempts >= maxAttempts) {
                        clearInterval(interval);
                        if (!songsReady) return;
                        if (typeof renderSongDetail === 'function') {
                            document.querySelectorAll('.app-page').forEach(function(p){p.classList.add('hidden');});
                            var sdDiv = document.getElementById('page-songdetail');
                            if (sdDiv) { sdDiv.classList.remove('hidden'); sdDiv.classList.add('fade-in'); }
                            try { localStorage.setItem('glLastPage','songdetail'); } catch(e){}
                            renderSongDetail(lastSong);
                        }
                    }
                }, 100);
            }

            // ── Phase G: song panel restore — DISABLED ─────────────────────────
            // Previously auto-restored the last-viewed song into the right panel
            // on every page load. This caused "After Midnight" (alphabetically first)
            // to appear in the panel and Now Playing bar without user action.
            // Users found this confusing. Now: fresh start on every load.
            // The user must explicitly tap a song to open it.
            try { localStorage.removeItem('glLastSong'); } catch(e) {}
            if (false) { // dead code — kept for reference
            }
        } catch(e) {}
    });
})();
