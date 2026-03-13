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
    // Close slide-out menu
    document.getElementById('slideMenu')?.classList.remove('open');
    document.getElementById('menuOverlay')?.classList.remove('open');

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
    var SKIP = ['songs', 'songdetail'];  // songs renders on load; songdetail needs song context
    var VALID = ['setlists','playlists','practice','rehearsal','calendar','gigs',
                 'venues','finances','tuner','metronome','bestshot','admin',
                 'social','notifications','pocketmeter','help','equipment','contacts'];
    document.addEventListener('DOMContentLoaded', function() {
        try {
            var last = localStorage.getItem('glLastPage');
            if (last && VALID.indexOf(last) !== -1) {
                // Defer so app.js auth + data init runs first
                setTimeout(function() {
                    if (typeof showPage === 'function') showPage(last);
                }, 800);
            } else if (last === 'songdetail') {
                var lastSong = localStorage.getItem('glLastSong');
                if (!lastSong) return;
                // Poll until allSongs is populated (auth + Firebase load takes variable time)
                // Home renders first, then restore overtops it
                var attempts = 0;
                var maxAttempts = 40; // 4 seconds max
                var interval = setInterval(function() {
                    attempts++;
                    var songsReady = typeof allSongs !== 'undefined' && Array.isArray(allSongs) && allSongs.length > 0;
                    if (songsReady || attempts >= maxAttempts) {
                        clearInterval(interval);
                        if (songsReady && typeof renderSongDetail === 'function') {
                            // Manually show/hide pages to avoid pageRenderers.songdetail
                            // firing renderSongDetail() with no arg (which bails to songs)
                            document.querySelectorAll('.app-page').forEach(function(p){p.classList.add('hidden');});
                            var sdDiv = document.getElementById('page-songdetail');
                            if (sdDiv) { sdDiv.classList.remove('hidden'); sdDiv.classList.add('fade-in'); }
                            try { localStorage.setItem('glLastPage','songdetail'); } catch(e){}
                            renderSongDetail(lastSong);
                        }
                    }
                }, 100);
            }
        } catch(e) {}
    });
})();
