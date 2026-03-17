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

        // When the user is actively searching, bypass status/harmony/northstar
        // filters so search always finds everything in the library.
        var isSearching = searchTerm.length > 0;

        // Status filter (data-level) — skipped during active search
        if (!isSearching &&
            typeof activeStatusFilter !== 'undefined' && activeStatusFilter &&
            typeof statusCacheLoaded !== 'undefined' && statusCacheLoaded) {
            if (typeof getStatusFromCache === 'function') {
                if (getStatusFromCache(song.title) !== activeStatusFilter) return false;
            }
        }

        // Harmony filter — skipped during active search
        if (!isSearching &&
            typeof activeHarmonyFilter !== 'undefined' && activeHarmonyFilter === 'harmonies') {
            var hbc = (typeof harmonyBadgeCache !== 'undefined') ? harmonyBadgeCache : {};
            var hc  = (typeof harmonyCache      !== 'undefined') ? harmonyCache      : {};
            if (!hbc[song.title] && !hc[song.title]) return false;
        }

        // North Star filter — skipped during active search
        if (!isSearching &&
            typeof activeNorthStarFilter !== 'undefined' && activeNorthStarFilter) {
            var nsc = (typeof northStarCache !== 'undefined') ? northStarCache : {};
            if (!nsc[song.title]) return false;
        }

        // Triage filter — show only songs missing specific data
        if (!isSearching && window._sqTriageFilter) {
            var tf = window._sqTriageFilter;
            if (tf === 'no_key' && song.key) return false;
            if (tf === 'no_bpm' && song.bpm) return false;
            if (tf === 'no_status') {
                var _ts = (typeof statusCache !== 'undefined') ? statusCache[song.title] : null;
                if (_ts) return false;
            }
            // no_lead requires async data — use cached songDetailCache if available
            if (tf === 'no_lead') {
                var _dc = (typeof GLStore !== 'undefined' && GLStore._getDetailCache) ? GLStore._getDetailCache(song.title) : null;
                var _hasLead = _dc && _dc.lead_singer && _dc.lead_singer.singer;
                if (_hasLead) return false;
            }
            if (tf === 'needs_work') {
                var _nwScores = (typeof readinessCache !== 'undefined' && readinessCache[song.title]) || {};
                var _nwVals = Object.values(_nwScores).filter(function(v) { return typeof v === 'number' && v > 0; });
                var _nwAvg = _nwVals.length ? _nwVals.reduce(function(a,b){return a+b;},0) / _nwVals.length : 0;
                if (_nwAvg === 0 || _nwAvg >= 3) return false;
            }
            if (tf === 'not_rotation') {
                var _nrStatus = (typeof statusCache !== 'undefined') ? statusCache[song.title] : '';
                if (_nrStatus === 'rotation') return false;
            }
        }

        return true;
    });

    if (filtered.length === 0) {
        var statusNames = { prospect:'Prospect', learning:'Learning', rotation:'In Rotation', shelved:'Shelved', wip:'Learning', active:'Learning', gig_ready:'Learning', parked:'Shelved', retired:'Shelved' };
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

    // Show active filter chip so the user knows a filter is hiding songs
    _renderActiveFilterChip();
    // Show triage bar when active
    _renderTriageBar(dropdown, filtered.length);

    // ── CANONICAL SONG ROW MODEL (PL-8c) ──────────────────────────────────
    // Song rows are scan-only. They render EXACTLY:
    //   1. Song title (primary)
    //   2. Lifecycle badge (Prospect / Learning / In Rotation / Shelved)
    //   3. Average readiness score (single number, color-coded)
    //   4. One contextual signal (setlist / priority gap / needs work)
    //   5. Band tag (quiet)
    //   6. Quick edit button
    // NO post-paint decoration. NO injected badges/chains/dots/heatmaps.
    // All rich data lives in the song detail view (Song Assets card).
    // ────────────────────────────────────────────────────────────────────────
    // Precompute readiness + status + priority signals for simplified rows
    var _rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    var _sc = (typeof statusCache !== 'undefined') ? statusCache : {};
    var _statusDisplay = { prospect:'Prospect', learning:'Learning', rotation:'In Rotation', shelved:'Shelved', wip:'Learning', active:'Learning', gig_ready:'Learning', parked:'Shelved', retired:'Shelved' };
    var _statusColor = { prospect:'#7c3aed', learning:'#2563eb', rotation:'#059669', shelved:'#6b7280', wip:'#2563eb', active:'#2563eb', gig_ready:'#2563eb', parked:'#6b7280', retired:'#6b7280' };

    // Build upcoming setlist song set for priority signals
    var _upcomingSongs = {};
    try {
        var _sls = (typeof window._glCachedSetlists !== 'undefined') ? window._glCachedSetlists : [];
        var _today = new Date().toISOString().split('T')[0];
        for (var _si = 0; _si < _sls.length && _si < 5; _si++) {
            var _sl = _sls[_si];
            if ((_sl.date || '') < _today) continue;
            var _sets = _sl.sets || [];
            for (var _sj = 0; _sj < _sets.length; _sj++) {
                var _ssongs = _sets[_sj].songs || [];
                for (var _sk = 0; _sk < _ssongs.length; _sk++) {
                    var _st = typeof _ssongs[_sk] === 'string' ? _ssongs[_sk] : (_ssongs[_sk].title || '');
                    if (_st) _upcomingSongs[_st] = _sl.name || 'Upcoming';
                }
            }
        }
    } catch(e) {}
    // Top practice attention songs
    var _topGaps = {};
    try {
        var _pr = (typeof GLStore !== 'undefined' && GLStore.getPracticeAttention) ? GLStore.getPracticeAttention({ limit: 5 }) : [];
        if (_pr) _pr.forEach(function(p) { _topGaps[p.songId] = true; });
    } catch(e) {}

    dropdown.innerHTML = filtered.map(function(song) {
        var titleEsc   = song.title.replace(/"/g, '&quot;');
        var titleOnclick = song.title.replace(/'/g, "\\'");
        var customAttr = song.isCustom ? ' data-custom="true"' : '';
        var customClass = song.isCustom ? ' custom-song' : '';

        // Lifecycle badge
        var status = _sc[song.title] || '';
        var statusBadge = status && _statusDisplay[status]
            ? '<span style="font-size:0.62em;font-weight:700;padding:1px 6px;border-radius:8px;background:' + (_statusColor[status] || '#6b7280') + '22;color:' + (_statusColor[status] || '#6b7280') + ';border:1px solid ' + (_statusColor[status] || '#6b7280') + '44;white-space:nowrap">' + _statusDisplay[status] + '</span>'
            : '';

        // Average readiness (bar + number)
        var scores = _rc[song.title] || {};
        var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
        var avg = vals.length ? (vals.reduce(function(a,b){return a+b;},0) / vals.length) : 0;
        var barPct = avg ? Math.round((avg / 5) * 100) : 0;
        var barColor = avg >= 4 ? '#22c55e' : avg >= 3 ? '#f59e0b' : avg > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)';
        var readinessBar = avg > 0
            ? '<span class="song-readiness-bar"><span class="song-readiness-fill" style="width:' + barPct + '%;background:' + barColor + '"></span></span>'
              + '<span style="font-size:0.62em;font-weight:700;color:' + barColor + ';min-width:18px">' + avg.toFixed(1) + '</span>'
            : '';
        // Contextual priority signal (one per row max)
        var signal = '';
        if (_upcomingSongs[song.title]) {
            signal = '<span style="font-size:0.58em;color:#818cf8;font-weight:600">🎯 In setlist</span>';
        } else if (_topGaps[song.title] || (avg > 0 && avg < 3)) {
            signal = '<span class="song-signal-needswork">⚠️ Needs work</span>';
        }

        var editBtn = '<button class="song-quick-edit-btn" title="Edit song details" onclick="event.stopPropagation();songQuickSetup(\'' + titleOnclick + '\')">Edit</button>';
        var needsWorkClass = (signal && signal.indexOf('needswork') > -1) ? ' song-item--needswork' : '';

        return '<div class="song-item' + customClass + needsWorkClass + '" data-title="' + titleEsc + '"' + customAttr +
               ' onclick="selectSong(\'' + titleOnclick + '\')">' +
               '<div class="song-row-line1"><span class="song-name">' + song.title + '</span>' +
               '<span class="song-badge ' + (song.band || 'other').toLowerCase() + '">' + (song.band || '') + '</span>' +
               editBtn + '</div>' +
               '<div class="song-row-line2">' + readinessBar + statusBadge + signal + '</div>' +
               '</div>';
    }).join('');

    // Post-paint: highlight + preload only (no badge injection — all inline now)
    requestAnimationFrame(function() {
        if (typeof selectedSong !== 'undefined' && selectedSong && selectedSong.title) {
            highlightSelectedSongRow(selectedSong.title);
        }
        if (typeof preloadAllStatuses === 'function') preloadAllStatuses();
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

    // Heatmap toggle removed — heatmap no longer renders on song rows (PL-8c)
};

// ── Active filter chip ───────────────────────────────────────────────────────

/**
 * Show/hide a visible chip above the song list when a status filter is active,
 * so the user always knows songs are being filtered.
 */
function _renderActiveFilterChip() {
    var existing = document.getElementById('glActiveFilterChip');
    var hasFilter = (typeof activeStatusFilter !== 'undefined' && activeStatusFilter);
    if (!hasFilter) {
        if (existing) existing.remove();
        return;
    }
    var statusNames = { prospect:'👀 Prospect', learning:'📖 Learning', rotation:'🔄 In Rotation', shelved:'📦 Shelved', wip:'📖 Learning', active:'📖 Learning', gig_ready:'📖 Learning', parked:'📦 Shelved', retired:'📦 Shelved' };
    var label = statusNames[activeStatusFilter] || activeStatusFilter;
    if (!existing) {
        existing = document.createElement('div');
        existing.id = 'glActiveFilterChip';
        existing.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;margin-bottom:8px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.25);border-radius:8px;font-size:0.82em;color:#fbbf24';
        var dropdown = document.getElementById('songDropdown');
        if (dropdown && dropdown.parentElement) {
            dropdown.parentElement.insertBefore(existing, dropdown);
        } else {
            return;
        }
    }
    existing.innerHTML = '<span>Showing: <strong>' + label + '</strong></span>' +
        '<button onclick="document.getElementById(\'statusFilter\').value=\'all\';filterByStatus(\'all\')" ' +
        'style="background:none;border:1px solid rgba(251,191,36,0.3);color:#fbbf24;border-radius:4px;padding:1px 8px;cursor:pointer;font-size:0.9em;font-weight:700" title="Clear filter">✕ Show All</button>';
}

// ── Song row highlight ────────────────────────────────────────────────────────

/**
 * Highlight the song row matching `title` in the songs list.
 * Clears any previous highlight first.  Uses data-title attribute lookup
 * so it works from any call path (click, keyboard, GLStore restore).
 */
function highlightSelectedSongRow(title) {
    document.querySelectorAll('.song-item.selected').forEach(function(item) {
        item.classList.remove('selected');
    });
    if (!title) return;
    var esc = title.replace(/"/g, '\\"');
    var row = document.querySelector('.song-item[data-title="' + esc + '"]');
    if (row) {
        row.classList.add('selected');
        if (typeof _songInjectQuickActions === 'function') _songInjectQuickActions(row);
    }
}

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

    // Highlight selected row (by data-title, not event.target — works for
    // all call paths: click, keyboard, GLStore restore, etc.)
    highlightSelectedSongRow(songTitle);

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

    // Mobile: always use full-page detail (right panel too small)
    var isMobile = window.innerWidth <= 768;
    if (!isMobile && window.glRightPanel && typeof window.glRightPanel.open === 'function') {
        // Desktop BCC shell path (index-dev.html only).
        GLStore.selectSong(songTitle);
    } else {
        // Production path or mobile — full-page navigation.
        if (typeof showPage === 'function') {
            showPage('songdetail');
        }
    }
};

// ── Triage Mode (missing data filters) ────────────────────────────────────────

window._sqTriageFilter = null;
window._sqTriageList = [];    // Ordered list of titles matching current triage
window._sqTriageIndex = -1;   // Current position in triage list
window._sqTriageDone = 0;     // Count of songs completed this session

window.sqTriageSet = function(filter) {
    window._sqTriageFilter = (window._sqTriageFilter === filter) ? null : filter;
    window._sqTriageDone = 0;
    window._sqTriageIndex = -1;
    // Toggle triage focus mode on body
    if (window._sqTriageFilter) document.body.classList.add('gl-triage-active');
    else document.body.classList.remove('gl-triage-active');
    var searchTerm = (document.getElementById('songSearch') || {}).value || '';
    renderSongs(typeof currentFilter !== 'undefined' ? currentFilter : 'all', searchTerm);
};

// Start triage workflow: activate filter + open first incomplete song
window.sqTriageStart = function(filter) {
    window._sqTriageFilter = filter;
    window._sqTriageDone = 0;
    window._sqTriageIndex = -1;
    document.body.classList.add('gl-triage-active');
    var searchTerm = (document.getElementById('songSearch') || {}).value || '';
    renderSongs(typeof currentFilter !== 'undefined' ? currentFilter : 'all', searchTerm);
    // Auto-open first song after render
    requestAnimationFrame(function() {
        if (window._sqTriageList.length) {
            window._sqTriageIndex = 0;
            songQuickSetup(window._sqTriageList[0]);
        }
    });
};

// Advance to next song in triage list
window._sqTriageAdvance = function(currentTitle) {
    _sqClose(currentTitle);
    window._sqTriageDone++;
    // Micro-feedback
    if (typeof showToast === 'function') showToast('Saved — next song');
    // Re-render to update progress + re-filter (the song may now pass)
    var searchTerm = (document.getElementById('songSearch') || {}).value || '';
    renderSongs(typeof currentFilter !== 'undefined' ? currentFilter : 'all', searchTerm);
    requestAnimationFrame(function() {
        if (!window._sqTriageList.length) {
            // All done — show completion
            _renderTriageComplete();
            return;
        }
        // Open next item
        window._sqTriageIndex = 0;
        songQuickSetup(window._sqTriageList[0]);
    });
};

function _renderTriageComplete() {
    var dropdown = document.getElementById('songDropdown');
    if (!dropdown) return;
    var bar = document.getElementById('sqTriageBar');
    if (bar) {
        bar.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;width:100%">'
            + '<span style="font-size:1em">✅</span>'
            + '<span style="font-size:0.82em;font-weight:700;color:#22c55e">All songs updated!</span>'
            + '<span style="font-size:0.72em;color:var(--text-dim)">' + window._sqTriageDone + ' completed</span>'
            + '<button onclick="sqTriageSet(null)" style="margin-left:auto;font-size:0.7em;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-dim);padding:3px 10px;border-radius:6px;cursor:pointer">Exit Triage</button>'
            + '</div>';
    }
}

function _renderTriageBar(dropdown, count) {
    // Build triage list from currently visible rows
    window._sqTriageList = [];
    var rows = dropdown.querySelectorAll('.song-item');
    rows.forEach(function(r) { if (r.dataset.title) window._sqTriageList.push(r.dataset.title); });

    var existing = document.getElementById('sqTriageBar');
    if (existing) existing.remove();
    var bar = document.createElement('div');
    bar.id = 'sqTriageBar';
    bar.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;align-items:center;padding:4px 0;margin-bottom:4px';
    var tf = window._sqTriageFilter;
    var items = [
        { id: 'no_key', label: 'Missing Key' },
        { id: 'no_bpm', label: 'Missing BPM' },
        { id: 'no_status', label: 'No Status' },
        { id: 'no_lead', label: 'No Lead' },
        { id: 'needs_work', label: 'Needs Work' },
        { id: 'not_rotation', label: 'Not in Rotation' }
    ];
    // Count missing data for entry CTA
    var _missingCounts = { no_key: 0, no_bpm: 0, no_status: 0 };
    if (typeof allSongs !== 'undefined') {
        allSongs.forEach(function(s) {
            if (!s.key) _missingCounts.no_key++;
            if (!s.bpm) _missingCounts.no_bpm++;
            if (typeof statusCache !== 'undefined' && !statusCache[s.title]) _missingCounts.no_status++;
        });
    }
    var _totalMissing = _missingCounts.no_key + _missingCounts.no_bpm + _missingCounts.no_status;

    var html = '';
    // Entry CTA when no triage active but missing data exists
    if (!tf && _totalMissing > 0) {
        var _bestFilter = _missingCounts.no_bpm >= _missingCounts.no_key ? 'no_bpm' : 'no_key';
        if (_missingCounts.no_status > _missingCounts[_bestFilter]) _bestFilter = 'no_status';
        var _bestLabel = { no_bpm: 'Missing BPM', no_key: 'Missing Key', no_status: 'No Status' }[_bestFilter] || 'Missing data';
        var _bestCount = _missingCounts[_bestFilter] || _totalMissing;
        html += '<button onclick="sqTriageStart(\'' + _bestFilter + '\')" style="font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24;margin-right:6px;display:inline-flex;align-items:center;gap:6px">'
            + '<span>⚡</span>Start cleanup → ' + _bestLabel
            + '<span style="font-weight:500;opacity:0.7;font-size:0.85em">(' + _bestCount + ')</span></button>';
    }
    // Triage progress bar when active (always show when filter active)
    if (tf) {
        var _pTotal = count + window._sqTriageDone;
        var _pPct = _pTotal > 0 ? Math.round(window._sqTriageDone / _pTotal * 100) : 0;
        html += '<div style="display:flex;align-items:center;gap:6px;width:100%;margin-bottom:4px">'
            + '<span style="font-size:0.68em;font-weight:700;color:#22c55e">' + window._sqTriageDone + ' fixed</span>'
            + '<span style="font-size:0.62em;color:var(--text-dim)">—</span>'
            + '<span style="font-size:0.68em;font-weight:600;color:var(--text-dim)">' + count + ' remaining</span>'
            + '<div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden">'
            + '<div style="width:' + _pPct + '%;height:100%;background:#22c55e;border-radius:2px;transition:width 0.3s"></div></div></div>';
    }

    html += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);margin-right:2px">Triage:</span>';
    items.forEach(function(it) {
        var active = tf === it.id;
        var itemCount = _missingCounts[it.id] || '';
        html += '<button onclick="sqTriageSet(\'' + it.id + '\')" style="font-size:0.68em;font-weight:' + (active ? '800' : '600') + ';padding:' + (active ? '3px 10px' : '2px 8px') + ';border-radius:10px;cursor:pointer;border:' + (active ? '2px' : '1px') + ' solid '
            + (active ? '#fbbf24' : 'rgba(255,255,255,0.08)') + ';background:'
            + (active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)') + ';color:'
            + (active ? '#fbbf24' : 'var(--text-dim)') + (active ? ';box-shadow:0 0 8px rgba(251,191,36,0.15)' : '') + '">' + it.label + (itemCount ? ' (' + itemCount + ')' : '') + '</button>';
    });
    if (tf) {
        html += '<span style="font-size:0.65em;color:var(--text-dim);margin-left:4px">' + count + ' songs need data</span>';
        if (window._sqTriageDone > 0) {
            html += '<span style="font-size:0.65em;color:#22c55e;margin-left:2px">(' + window._sqTriageDone + ' done)</span>';
        }
        html += '<button onclick="sqTriageSet(null);window._sqTriageFilter=null;renderSongs()" style="font-size:0.62em;background:none;border:none;color:var(--text-dim);cursor:pointer;padding:0 4px">Clear</button>';
    }
    bar.innerHTML = html;
    dropdown.parentElement.insertBefore(bar, dropdown);
}

// ── Quick Song Setup (inline editing) ─────────────────────────────────────────

(function() {
    // Inject styles once
    var style = document.createElement('style');
    style.textContent = '.song-row-line1{display:flex;align-items:center;gap:6px;min-width:0}'
        + '.song-row-line2{display:flex;align-items:center;gap:6px;min-width:0;margin-top:1px}'
        + '.song-readiness-bar{width:40px;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;flex-shrink:0}'
        + '.song-readiness-fill{height:100%;border-radius:2px;transition:width 0.3s}'
        + '.song-row-meta{display:flex;align-items:center;gap:4px;flex-shrink:0}'
        + '.song-signal-needswork{font-size:0.58em;color:#f59e0b;font-weight:700;background:rgba(245,158,11,0.08);padding:1px 6px;border-radius:6px;border:1px solid rgba(245,158,11,0.2)}'
        + '.song-item--needswork{border-left:3px solid #f59e0b!important;background:rgba(245,158,11,0.02)!important}'
        + '.song-quick-edit-btn{font-size:0.62em;opacity:0.2;cursor:pointer;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);padding:2px 8px;border-radius:4px;color:var(--text-dim);font-weight:600;transition:all 0.15s;flex-shrink:0}'
        + '.song-item:hover .song-quick-edit-btn{opacity:0.9;border-color:rgba(99,102,241,0.3);color:var(--accent-light)}'
        + '.song-item--editing{border:2px solid rgba(99,102,241,0.4)!important;background:rgba(99,102,241,0.06)!important;min-height:38px;display:flex;align-items:center;gap:6px;padding:4px 8px!important;box-shadow:0 0 12px rgba(99,102,241,0.1)}'
        + '.sq-field{font-size:0.78em;padding:3px 6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text,#f1f5f9);font-family:inherit}'
        + '.sq-field:focus{border-color:rgba(99,102,241,0.4);outline:none}'
        + '.sq-label{font-size:0.62em;color:var(--text-dim);font-weight:700;white-space:nowrap}'
        + '.sq-done{font-size:0.7em;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:700;white-space:nowrap}'
        + '.sq-field--saved{border-color:rgba(34,197,94,0.5)!important;transition:border-color 0.15s}'
        + '.gl-triage-active #sd-readiness-card,.gl-triage-active #sd-discussion-mount,.gl-triage-active #sd-confidence-prompt,.gl-triage-active .sd-intel-card,.gl-triage-active #sd-assets{display:none!important}';
    document.head.appendChild(style);
})();

window.songQuickSetup = function songQuickSetup(title) {
    var row = document.querySelector('.song-item[data-title="' + title.replace(/"/g, '\\"') + '"]');
    if (!row) return;
    // If already editing, skip
    if (row.classList.contains('song-item--editing')) return;
    // Store original HTML for restore
    row._sqOrigHTML = row.innerHTML;
    row._sqOrigClick = row.getAttribute('onclick');
    row.removeAttribute('onclick');
    row.classList.add('song-item--editing');

    // Load current values
    var songObj = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === title; }) : null;
    var currentKey = (songObj && songObj.key) || '';
    var currentBpm = (songObj && songObj.bpm) ? String(songObj.bpm) : '';
    var currentStatus = (typeof statusCache !== 'undefined' && statusCache[title]) || '';

    var safeTitle = title.replace(/'/g, "\\'");
    var titleLabel = '<span style="font-weight:600;font-size:0.85em;min-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:1">' + (title.length > 25 ? title.substring(0, 25) + '...' : title) + '</span>';

    // Lead options
    var leadOpts = ['','drew','chris','brian','pierce','shared','rotating'].map(function(v) {
        var lbl = v === '' ? '—' : v === 'shared' ? 'Shared' : v === 'rotating' ? 'Rotating' : v.charAt(0).toUpperCase() + v.slice(1);
        return '<option value="' + v + '">' + lbl + '</option>';
    }).join('');

    // Status options
    var statusOpts = [['','—'],['prospect','Prospect'],['learning','Learning'],['rotation','Rotation'],['shelved','Shelved']].map(function(p) {
        return '<option value="' + p[0] + '"' + (currentStatus === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
    }).join('');

    // Key options
    var keyOpts = ['','A','Am','Bb','B','Bm','C','Cm','C#','D','Dm','E','Em','F','Fm','F#','G','Gm','Ab'].map(function(k) {
        return '<option value="' + k + '"' + (currentKey === k ? ' selected' : '') + '>' + (k || '—') + '</option>';
    }).join('');

    row.innerHTML = titleLabel
        + '<span class="sq-label">Lead</span><select class="sq-field sq-tab" id="sq-lead-' + safeTitle + '" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'leadSinger\',this.value)">' + leadOpts + '</select>'
        + '<span class="sq-label">Status</span><select class="sq-field sq-tab" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'status\',this.value)">' + statusOpts + '</select>'
        + '<span class="sq-label">Key</span><select class="sq-field sq-tab" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'key\',this.value)">' + keyOpts + '</select>'
        + '<span class="sq-label">BPM</span><input type="number" class="sq-field sq-tab" style="width:55px" min="40" max="240" value="' + currentBpm + '" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'bpm\',this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_sqAdvanceNext(\'' + safeTitle + '\')}">'
        + '<button class="sq-done" onclick="event.stopPropagation();_sqClose(\'' + safeTitle + '\')">Done</button>';

    // Smart auto-focus: jump to the first MISSING field based on triage filter
    requestAnimationFrame(function() {
        var tf = window._sqTriageFilter;
        var target = null;
        if (tf === 'no_bpm') {
            target = row.querySelector('input[type="number"]');
        } else if (tf === 'no_key') {
            var keySelects = row.querySelectorAll('.sq-tab');
            target = keySelects[2]; // Lead=0, Status=1, Key=2
        } else if (tf === 'no_status') {
            var statusSelects = row.querySelectorAll('.sq-tab');
            target = statusSelects[1]; // Status is second field
        } else if (tf === 'no_lead') {
            target = row.querySelector('.sq-tab'); // Lead is first
        }
        if (!target) target = row.querySelector('.sq-tab');
        if (target) target.focus();
    });

    // Load lead singer async
    if (typeof GLStore !== 'undefined' && GLStore.loadFieldMeta) {
        GLStore.loadFieldMeta(title, 'lead_singer').then(function(data) {
            var sel = document.getElementById('sq-lead-' + safeTitle);
            if (sel && data && data.singer) sel.value = data.singer;
        }).catch(function() {});
    }

    // Escape to close
    row._sqKeyHandler = function(e) {
        if (e.key === 'Escape') _sqClose(title);
    };
    document.addEventListener('keydown', row._sqKeyHandler);
};

window._sqFieldSaved = function(el) {
    if (!el) return;
    el.classList.add('sq-field--saved');
    setTimeout(function() { el.classList.remove('sq-field--saved'); }, 800);
};

window._sqClose = function(title) {
    var row = document.querySelector('.song-item[data-title="' + title.replace(/"/g, '\\"') + '"]');
    if (!row || !row._sqOrigHTML) return;
    row.innerHTML = row._sqOrigHTML;
    if (row._sqOrigClick) row.setAttribute('onclick', row._sqOrigClick);
    row.classList.remove('song-item--editing');
    if (row._sqKeyHandler) document.removeEventListener('keydown', row._sqKeyHandler);
    // Re-apply badges
    requestAnimationFrame(function() {
        if (typeof addStatusBadges === 'function') addStatusBadges();
        if (typeof addReadinessChains === 'function') addReadinessChains();
    });
};

window._sqAdvanceNext = function(title) {
    // If triage is active, use triage-aware advance
    if (window._sqTriageFilter) {
        _sqTriageAdvance(title);
        return;
    }
    _sqClose(title);
    // Find next song row (non-triage)
    var row = document.querySelector('.song-item[data-title="' + title.replace(/"/g, '\\"') + '"]');
    if (row && row.nextElementSibling && row.nextElementSibling.classList.contains('song-item')) {
        var nextTitle = row.nextElementSibling.dataset.title;
        if (nextTitle) songQuickSetup(nextTitle);
    }
};

console.log('✅ songs.js loaded');
