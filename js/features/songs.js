// ============================================================================
// js/features/songs.js
// Song list rendering, search/filter wiring, and song selection.
// Extracted from app.js Wave 1 refactor (lines ~900–1090).
//
// DEPENDS ON (must load before this):
//   js/core/utils.js            — showToast
//   js/core/firebase-service.js — firebaseDB, bandPath, sanitizeFirebasePath
//   data.js                     — allSongs (const array)
//
// READS globals from app.js (resolved at call time — safe):
//   currentFilter, activeStatusFilter, activeHarmonyFilter, activeNorthStarFilter
//   statusCacheLoaded, harmonyBadgeCache, harmonyCache, northStarCache, readinessCacheLoaded
//   _heatmapMode, window._sectionRatingsCache
//   addHarmonyBadges(), addNorthStarBadges(), addStatusBadges(), addReadinessChains()
//   addSectionStatusDots(), preloadSectionRatingsCache(), preloadAllStatuses()
//   renderHeatmapOverlay()
//   showBandResources(), renderBestShotVsNorthStar()
//   getFullBandName()
//   selectedSong (writable global)
//
// EXPOSES globals:
//   renderSongs(filter, searchTerm)
//   setupSearchAndFilters()
//   selectSong(songTitle)
// ============================================================================

'use strict';

/**
 * Render the song list dropdown filtered by band, search term, status, and
 * harmony/NorthStar badges.
 *
 * @param {string} [filter='all']    Band abbreviation or 'all'
 * @param {string} [searchTerm='']  Substring match against song title
 */
window.renderSongs = function renderSongs(filter, searchTerm) {
    filter     = filter     || 'all';
    searchTerm = searchTerm || '';

    var dropdown = document.getElementById('songDropdown');
    if (!dropdown) return;

    var knownBands = ['GD','JGB','WSP','PHISH','ABB','GOOSE','DMB'];

    var filtered = allSongs.filter(function(song) {
        var bandUpper = (song.band || '').toUpperCase();
        var matchesFilter = filter === 'all'
            ? true
            : filter.toUpperCase() === 'OTHER'
                ? !knownBands.includes(bandUpper)
                : bandUpper === filter.toUpperCase();

        var matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesFilter || !matchesSearch) return false;

        // Status filter (data-level)
        if (typeof activeStatusFilter !== 'undefined' && activeStatusFilter &&
            typeof statusCacheLoaded !== 'undefined' && statusCacheLoaded) {
            if (typeof getStatusFromCache === 'function') {
                if (getStatusFromCache(song.title) !== activeStatusFilter) return false;
            }
        }

        // Harmony filter
        if (typeof activeHarmonyFilter !== 'undefined' && activeHarmonyFilter === 'harmonies') {
            var hbc = (typeof harmonyBadgeCache !== 'undefined') ? harmonyBadgeCache : {};
            var hc  = (typeof harmonyCache      !== 'undefined') ? harmonyCache      : {};
            if (!hbc[song.title] && !hc[song.title]) return false;
        }

        // North Star filter
        if (typeof activeNorthStarFilter !== 'undefined' && activeNorthStarFilter) {
            var nsc = (typeof northStarCache !== 'undefined') ? northStarCache : {};
            if (!nsc[song.title]) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        var statusNames = { prospect:'Prospect', wip:'Work in Progress', gig_ready:'Gig Ready' };
        var statusLabel = (typeof activeStatusFilter !== 'undefined' && activeStatusFilter)
            ? (statusNames[activeStatusFilter] || activeStatusFilter)
            : '';
        var msg;

        if (typeof activeHarmonyFilter !== 'undefined' && activeHarmonyFilter === 'harmonies') {
            msg = '<div style="font-size:2em;margin-bottom:12px">🎵</div>' +
                  '<div style="font-size:1.1em;font-weight:600;margin-bottom:8px">No harmony songs marked yet</div>' +
                  '<div style="margin-bottom:16px;font-size:0.9em;color:#64748b">Click any song and check "Has Harmonies"!</div>' +
                  '<button onclick="document.getElementById(\'harmoniesOnlyFilter\').checked=false;filterSongsSync(\'all\')" class="btn btn-primary" style="padding:10px 24px">Show All Songs</button>';
        } else if (statusLabel) {
            msg = '<div style="font-size:2em;margin-bottom:12px">🎸</div>' +
                  '<div style="font-size:1.1em;font-weight:600;margin-bottom:8px">No songs marked "' + statusLabel + '"</div>' +
                  '<div style="margin-bottom:16px;font-size:0.9em;color:#64748b">Click any song and set its status!</div>' +
                  '<button onclick="document.getElementById(\'statusFilter\').value=\'all\';filterByStatus(\'all\')" class="btn btn-success" style="padding:10px 24px">Show All Songs</button>';
        } else {
            msg = '<div style="font-size:2em;margin-bottom:12px">🔍</div>' +
                  '<div style="font-size:1.1em;font-weight:600;margin-bottom:6px">No songs found</div>' +
                  '<div style="font-size:0.9em;color:#64748b">Try a different search or filter</div>';
        }

        dropdown.innerHTML = '<div style="padding:40px 20px;text-align:center;display:block !important;grid-template-columns:none !important">' + msg + '</div>';
        return;
    }

    dropdown.innerHTML = filtered.map(function(song) {
        var titleEsc   = song.title.replace(/"/g, '&quot;');
        var titleOnclick = song.title.replace(/'/g, "\\'");
        var bandClass  = (song.band || 'other').toLowerCase();
        var customAttr = song.isCustom ? ' data-custom="true"' : '';
        var customClass = song.isCustom ? ' custom-song' : '';
        var drawerBtn = '<button class="song-drawer-btn" title="Quick view (S)" '+
            'onclick="event.stopPropagation();openSongDrawer(\'' + titleOnclick + '\')">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">'+
            '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>'+
            '</button>';
        return '<div class="song-item' + customClass + '" data-title="' + titleEsc + '"' + customAttr +
               ' onclick="selectSong(\'' + titleOnclick + '\')">' +
               '<span class="song-name">' + song.title + '</span>' +
               '<span class="song-badges"><span class="harmony-slot"></span><span class="northstar-slot"></span></span>' +
               '<span class="song-chain-strip" data-song="' + titleEsc + '"></span>' +
               '<span class="song-status-cell"></span>' +
               '<span class="song-badge ' + bandClass + '">' + (song.band || '') + '</span>' +
               drawerBtn +
               '</div>';
    }).join('');

    // Inject badges and overlays after paint
    requestAnimationFrame(function() {
        if (typeof addHarmonyBadges         === 'function') addHarmonyBadges();
        if (typeof addNorthStarBadges       === 'function') addNorthStarBadges();

        // Quick-fill pencil for songs missing key/bpm
        filtered.forEach(function(song) {
            if (!song.key && !song.bpm) {
                var titleEsc = song.title.replace(/"/g, '&quot;');
                var slot = document.querySelector('.song-item[data-title="' + titleEsc + '"] .northstar-slot');
                if (slot && !slot.nextSibling?.classList?.contains('qf-btn')) {
                    var btn = document.createElement('span');
                    btn.className = 'qf-btn';
                    btn.title = 'Quick-fill key/BPM';
                    btn.textContent = '✏️';
                    btn.style.cssText = 'font-size:0.7em;opacity:0.4;cursor:pointer;padding:1px 4px;border-radius:3px;border:1px solid rgba(255,255,255,0.08);transition:opacity 0.15s';
                    btn.onmouseenter = function() { this.style.opacity = '1'; };
                    btn.onmouseleave = function() { this.style.opacity = '0.4'; };
                    var t = song.title;
                    btn.onclick = function(e) { e.stopPropagation(); if (typeof songQuickFill === 'function') songQuickFill(t, e); };
                    slot.after(btn);
                }
            }
        });

        if (typeof preloadAllStatuses       === 'function') preloadAllStatuses();
        if (typeof statusCacheLoaded !== 'undefined' && statusCacheLoaded &&
            typeof addStatusBadges          === 'function') addStatusBadges();
        if (typeof readinessCacheLoaded !== 'undefined' && readinessCacheLoaded &&
            typeof addReadinessChains       === 'function') addReadinessChains();
        if (typeof _heatmapMode !== 'undefined' && _heatmapMode &&
            typeof renderHeatmapOverlay     === 'function') renderHeatmapOverlay();
        if (window._sectionRatingsCache) {
            if (typeof addSectionStatusDots === 'function') addSectionStatusDots();
        } else {
            if (typeof preloadSectionRatingsCache === 'function') preloadSectionRatingsCache();
        }
    });
};

// ── Search + filter wiring ────────────────────────────────────────────────────

/**
 * Wire up the search input and band filter buttons on the songs page.
 * Also injects the Heatmap toggle button if it doesn't exist yet.
 * Called once during app init.
 */
window.setupSearchAndFilters = function setupSearchAndFilters() {
    var searchInput = document.getElementById('songSearch');
    var filterBtns  = document.querySelectorAll('.filter-btn');

    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            window.renderSongs(
                typeof currentFilter !== 'undefined' ? currentFilter : 'all',
                e.target.value
            );
        });
    }

    filterBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            filterBtns.forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            if (typeof currentFilter !== 'undefined') currentFilter = btn.dataset.filter;
            window.renderSongs(
                btn.dataset.filter,
                searchInput ? searchInput.value : ''
            );
        });
    });

    // Inject heatmap toggle button once
    if (!document.getElementById('heatmapToggleBtn')) {
        var hBtn = document.createElement('button');
        hBtn.id = 'heatmapToggleBtn';
        hBtn.title = 'Show readiness heatmap';
        hBtn.textContent = '🌡️ Heatmap';
        hBtn.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:4px 9px;border-radius:20px;cursor:pointer;font-size:0.72em;font-weight:700;white-space:nowrap;transition:all 0.15s;flex-shrink:0;margin-left:4px';
        hBtn.onclick = function() { if (typeof toggleHeatmapMode === 'function') toggleHeatmapMode(); };
        var harmoniesEl = document.getElementById('harmoniesOnlyFilter');
        var target = harmoniesEl ? (harmoniesEl.closest('label')?.parentElement || harmoniesEl.parentElement) : null;
        if (target && target.parentElement) target.parentElement.appendChild(hBtn);
        else if (searchInput?.parentElement?.parentElement) searchInput.parentElement.parentElement.appendChild(hBtn);
    }
};

// ── Song selection ────────────────────────────────────────────────────────────

/**
 * Select a song by title: updates selectedSong, highlights the row,
 * and opens the song in the right panel (index-dev.html) or falls back
 * to full-page navigation (index.html / production).
 *
 * @param {string} songTitle  Exact title matching an entry in allSongs
 */
window.selectSong = function selectSong(songTitle) {
    // Update shared state
    selectedSong = {
        title: songTitle,
        band: (allSongs.find(function(s) { return s.title === songTitle; }) || {}).band || 'GD'
    };

    // Highlight selected row
    document.querySelectorAll('.song-item').forEach(function(item) {
        item.classList.remove('selected');
    });
    var clickedItem = event?.target?.closest('.song-item');
    if (clickedItem) {
        clickedItem.classList.add('selected');
        clickedItem.style.boxShadow = '0 0 0 2px var(--accent, #667eea)';
        setTimeout(function() { clickedItem.style.boxShadow = ''; }, 600);
    }

    // showBandResources() populates legacy step-cards in page-songs as a
    // background task during the transition period. Harmless in panel mode.
    if (typeof showBandResources === 'function') showBandResources(songTitle);

    // ── Routing: right-panel shell (index-dev.html) vs full-page (index.html) ─
    //
    // Guard is window.glRightPanel.open — set only when gl-right-panel.js has
    // loaded AND initialised. gl-right-panel.js is NOT loaded by index.html,
    // so this check is a precise proxy for "dev shell is active".
    //
    // GLStore also loads in index.html, so GLStore existence alone is NOT a
    // safe guard — it would break production song navigation.

    if (window.glRightPanel && typeof window.glRightPanel.open === 'function') {
        // Dev / BCC shell path (index-dev.html only).
        // Fires gl-song-selected → gl-right-panel.js subscriber handles render.
        // Does NOT call showPage(). Does NOT write glLastPage.
        GLStore.selectSong(songTitle);
    } else {
        // Production path (index.html) — gl-right-panel.js is not loaded here.
        // Full-page navigation as before.
        if (typeof showPage === 'function') {
            showPage('songdetail');
        }
    }
};

console.log('✅ songs.js loaded');
