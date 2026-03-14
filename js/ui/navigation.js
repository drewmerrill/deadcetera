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
    if (page === 'songs' && window.glRightPanel && typeof window.glRightPanel.open === 'function'
        && !window._glPanelRestorePending) {
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
    var el = document.getElementById('page-' + page);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('fade-in');
    }

    // Update nav active states
    document.querySelectorAll('.menu-item').forEach(function(m) {
        m.classList.toggle('active', m.dataset.page === page);
    });

    currentPage = page;
    window.scrollTo(0, 0);
    try { localStorage.setItem('glLastPage', page); } catch(e) {}

    // Run renderer (songs page is rendered by selectSong / renderSongs, not here)
    if (el && page !== 'songs') {
        var renderer = pageRenderers[page];
        if (typeof renderer === 'function') {
            renderer(el);
        }
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
    }
};

console.log('✅ navigation.js loaded');

// ── Restore last page on load ─────────────────────────────────────────────
(function() {
    var SKIP = ['songdetail'];  // songdetail needs song context
    var VALID = ['songs','home','setlists','playlists','practice','rehearsal','calendar','gigs',
                 'venues','finances','tuner','metronome','bestshot','admin',
                 'social','notifications','pocketmeter','help','equipment','contacts'];
    document.addEventListener('DOMContentLoaded', function() {
        try {
            var last = localStorage.getItem('glLastPage');
            if (last && VALID.indexOf(last) !== -1) {
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

            // ── Phase G: dev-shell song panel restore ────────────────────────
            // In panel mode, glLastPage is NOT 'songdetail' (panelMode suppresses
            // that write). glLastSong IS written. So this block runs independently
            // of the glLastPage branching above: if glLastSong is set and the
            // right-panel shell is available, restore the song into the panel.
            //
            // Timing problem: auth completes async and glHeroCheck(true) calls
            // showPage('home'), which blows away the Songs workspace. We set a
            // flag (window._glPanelRestorePending) so glHeroCheck can defer to us.
            var panelSong = localStorage.getItem('glLastSong');
            if (panelSong && window.glRightPanel && typeof window.glRightPanel.open === 'function') {
                window._glPanelRestorePending = true;
                var pAttempts = 0;
                var pInterval = setInterval(function() {
                    pAttempts++;
                    var ready = typeof allSongs !== 'undefined' && Array.isArray(allSongs) && allSongs.length > 0;
                    if (ready || pAttempts >= 40) {
                        clearInterval(pInterval);
                        if (ready && typeof GLStore !== 'undefined' && typeof GLStore.selectSong === 'function') {
                            // Ensure Songs workspace is visible behind the panel
                            if (typeof showPage === 'function') showPage('songs');
                            GLStore.selectSong(panelSong);
                        }
                        // Clear flag after auth callbacks have had time to fire.
                        // 50ms showPage('home') and glHeroCheck typically complete
                        // within 3s of page load. Clearing unblocks the songs-entry
                        // panel logic for normal navigation.
                        setTimeout(function() { window._glPanelRestorePending = false; }, 3000);
                    }
                }, 100);
            }
        } catch(e) {}
    });
})();
