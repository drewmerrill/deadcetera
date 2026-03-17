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
// Restore persisted sort on load
try { window._sqSongSort = localStorage.getItem('gl_song_sort') || 'default'; } catch(e) {}

window.renderSongs = function renderSongs(filter, searchTerm) {
    filter     = filter     || 'all';
    searchTerm = searchTerm || '';
    // Persist sort preference
    try { if (window._sqSongSort) localStorage.setItem('gl_song_sort', window._sqSongSort); } catch(e) {}

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
            var _tdc = (typeof GLStore !== 'undefined' && GLStore._getDetailCache) ? GLStore._getDetailCache(song.title) : null;
            if (tf === 'no_key') {
                if (song.key) return false;
                if (_tdc && _tdc.key && _tdc.key.key) return false;
            }
            if (tf === 'no_bpm') {
                if (song.bpm) return false;
                if (_tdc && _tdc.song_bpm && _tdc.song_bpm.bpm) return false;
            }
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

    // Sort: user-selected or triage auto-sort
    var _sortMode = window._sqSongSort || 'default';
    if (!window._sqTriageFilter && _sortMode !== 'default' && filtered.length > 1) {
        var _sRc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
        var _sSc = (typeof statusCache !== 'undefined') ? statusCache : {};
        filtered.sort(function(a, b) {
            if (_sortMode === 'readiness_asc' || _sortMode === 'readiness_desc') {
                var aS = _sRc[a.title] || {}, bS = _sRc[b.title] || {};
                var aV = Object.values(aS).filter(function(v){return typeof v==='number'&&v>0;}), bV = Object.values(bS).filter(function(v){return typeof v==='number'&&v>0;});
                var aA = aV.length ? aV.reduce(function(x,y){return x+y;},0)/aV.length : (_sortMode === 'readiness_asc' ? 99 : -1);
                var bA = bV.length ? bV.reduce(function(x,y){return x+y;},0)/bV.length : (_sortMode === 'readiness_asc' ? 99 : -1);
                return _sortMode === 'readiness_asc' ? aA - bA : bA - aA;
            }
            if (_sortMode === 'title_asc') return (a.title||'').localeCompare(b.title||'');
            if (_sortMode === 'title_desc') return (b.title||'').localeCompare(a.title||'');
            if (_sortMode === 'status') return ((_sSc[a.title]||'').localeCompare(_sSc[b.title]||''));
            if (_sortMode === 'band') return ((a.band||'').localeCompare(b.band||''));
            return 0;
        });
    }

    // Triage priority sort: when triage active, surface the most important songs first
    if (window._sqTriageFilter && filtered.length > 1) {
        var _sortRc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
        var _sortUpcoming = (typeof window._glCachedSetlists !== 'undefined') ? {} : null;
        if (_sortUpcoming) {
            try {
                var _today = new Date().toISOString().split('T')[0];
                (window._glCachedSetlists || []).forEach(function(sl) {
                    if ((sl.date || '') < _today) return;
                    (sl.sets || []).forEach(function(set) {
                        (set.songs || []).forEach(function(sg) {
                            var t = typeof sg === 'string' ? sg : (sg.title || '');
                            if (t) _sortUpcoming[t] = true;
                        });
                    });
                });
            } catch(e) {}
        }
        filtered.sort(function(a, b) {
            var aInSet = _sortUpcoming && _sortUpcoming[a.title] ? 1 : 0;
            var bInSet = _sortUpcoming && _sortUpcoming[b.title] ? 1 : 0;
            if (aInSet !== bInSet) return bInSet - aInSet; // setlist first
            var aScores = _sortRc[a.title] || {};
            var bScores = _sortRc[b.title] || {};
            var aVals = Object.values(aScores).filter(function(v) { return typeof v === 'number' && v > 0; });
            var bVals = Object.values(bScores).filter(function(v) { return typeof v === 'number' && v > 0; });
            var aAvg = aVals.length ? aVals.reduce(function(x,y){return x+y;},0) / aVals.length : -1;
            var bAvg = bVals.length ? bVals.reduce(function(x,y){return x+y;},0) / bVals.length : -1;
            // Unrated (avg=-1) after rated-low, before rated-high
            if (aAvg < 0 && bAvg >= 0) return bAvg < 3 ? 1 : -1;
            if (bAvg < 0 && aAvg >= 0) return aAvg < 3 ? -1 : 1;
            return aAvg - bAvg; // lowest readiness first
        });
    }

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

    // ── MODE TOGGLE + SORT INDICATOR ──
    var _isCleanup = !!window._sqTriageFilter;
    var _sm = window._sqSongSort || 'default';
    var _arrow = function(field) {
        if (_sm === field + '_asc') return ' ↑';
        if (_sm === field + '_desc' || _sm === field) return ' ↓';
        return '';
    };
    var _sortLabels = { default:'Default', title_asc:'Song A→Z', title_desc:'Song Z→A', readiness_asc:'Readiness ↑', readiness_desc:'Readiness ↓', status:'Status', band:'Band' };
    var _modeBar = '<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;margin-bottom:4px">'
        + '<button onclick="window._sqTriageFilter=null;document.body.classList.remove(\'gl-triage-active\');renderSongs()" style="font-size:0.72em;font-weight:' + (!_isCleanup ? '800' : '600') + ';padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (!_isCleanup ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (!_isCleanup ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (!_isCleanup ? '#a5b4fc' : 'var(--text-dim)') + '">🎯 Rehearsal</button>'
        + '<button onclick="if(!window._sqTriageFilter)sqTriageSet(\'no_bpm\')" style="font-size:0.72em;font-weight:' + (_isCleanup ? '800' : '600') + ';padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (_isCleanup ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (_isCleanup ? 'rgba(251,191,36,0.1)' : 'none') + ';color:' + (_isCleanup ? '#fbbf24' : 'var(--text-dim)') + '">🧹 Cleanup</button>'
        + '<span style="margin-left:auto;font-size:0.62em;color:var(--text-dim)">Sorted by: <strong>' + (_sortLabels[_sm] || 'Default') + '</strong></span>'
        + '</div>';

    // ── COLUMN HEADERS (4 columns: Song | Readiness | Why | Band+Action) ──
    var _hd = 'font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;cursor:pointer;padding:6px 4px';
    var headerHTML = !_isCleanup
        ? '<table style="width:100%;border-collapse:collapse;border-bottom:2px solid rgba(255,255,255,0.1);background:#0f172a;position:sticky;top:0;z-index:5;margin-bottom:2px;table-layout:fixed"><tr>'
          + '<td style="' + _hd + ';padding-left:12px;width:40%" onclick="window._sqSongSort=(window._sqSongSort===\'title_asc\'?\'title_desc\':\'title_asc\');renderSongs()">Song' + _arrow('title') + '</td>'
          + '<td style="' + _hd + ';width:15%" onclick="window._sqSongSort=(window._sqSongSort===\'readiness_asc\'?\'readiness_desc\':\'readiness_asc\');renderSongs()">Readiness' + _arrow('readiness') + '</td>'
          + '<td style="' + _hd + ';width:30%" onclick="window._sqSongSort=(window._sqSongSort===\'status\'?\'default\':\'status\');renderSongs()">Why it matters' + _arrow('status') + '</td>'
          + '<td style="' + _hd + ';width:15%;text-align:right;padding-right:12px" onclick="window._sqSongSort=(window._sqSongSort===\'band\'?\'default\':\'band\');renderSongs()">Band' + _arrow('band') + '</td>'
          + '</tr></table>' : '';

    dropdown.innerHTML = _modeBar + headerHTML + filtered.map(function(song) {
        var titleEsc   = song.title.replace(/"/g, '&quot;');
        var titleOnclick = song.title.replace(/'/g, "\\'");
        var customAttr = song.isCustom ? ' data-custom="true"' : '';
        var customClass = song.isCustom ? ' custom-song' : '';

        // Lifecycle + context combined into "Why it matters"
        var status = _sc[song.title] || '';
        var statusText = _statusDisplay[status] || '';
        var signal = '';
        if (_upcomingSongs[song.title]) signal = '🎯 Setlist';
        else if (_topGaps[song.title] || (avg > 0 && avg < 3)) signal = '⚠️ Needs work';

        // Average readiness
        var scores = _rc[song.title] || {};
        var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
        var avg = vals.length ? (vals.reduce(function(a,b){return a+b;},0) / vals.length) : 0;
        var barPct = avg ? Math.round((avg / 5) * 100) : 0;
        var barColor = avg >= 3.5 ? '#22c55e' : avg >= 2 ? '#f59e0b' : avg > 0 ? '#ef4444' : 'rgba(255,255,255,0.08)';
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
        var ratedCount = vals.length;
        var participation = (avg > 0 && ratedCount < memberCount) ? ' <span style="font-size:0.7em;color:var(--text-dim);opacity:0.6">' + ratedCount + '/' + memberCount + '</span>' : '';

        // "Why it matters" = status + signal combined
        var whyParts = [];
        if (statusText) whyParts.push('<span style="color:' + (_statusColor[status] || '#6b7280') + '">' + statusText + '</span>');
        if (signal) whyParts.push('<span class="' + (signal.indexOf('Needs') > -1 ? 'song-signal-needswork' : 'song-signal-context') + '">' + signal + '</span>');
        var whyHTML = whyParts.join(' <span style="opacity:0.3">·</span> ');

        var editBtn = '<button class="song-quick-edit-btn" title="Edit song details" onclick="event.stopPropagation();songQuickSetup(\'' + titleOnclick + '\')">Edit</button>';
        var needsWorkClass = signal.indexOf('Needs work') > -1 ? ' song-item--needswork' : '';

        return '<div class="song-item' + customClass + needsWorkClass + '" data-title="' + titleEsc + '"' + customAttr +
               ' onclick="selectSong(\'' + titleOnclick + '\')">' +
               '<div class="song-row-grid">' +
               '<span class="song-col song-col-title">' + song.title + '</span>' +
               '<span class="song-col song-col-readiness"><span class="song-readiness-bar"><span class="song-readiness-fill" style="width:' + barPct + '%;background:' + barColor + '"></span></span><span class="song-readiness-num" style="color:' + barColor + '">' + (avg > 0 ? avg.toFixed(1) : '—') + '</span>' + participation + '</span>' +
               '<span class="song-col song-col-why">' + whyHTML + '</span>' +
               '<span class="song-col song-col-end"><span class="song-badge ' + (song.band || 'other').toLowerCase() + '">' + (song.band || '') + '</span>' + editBtn + '</span>' +
               '</div></div>';
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
    // Count missing data for entry CTA (check both allSongs cache + GLStore detail cache)
    var _missingCounts = { no_key: 0, no_bpm: 0, no_status: 0 };
    if (typeof allSongs !== 'undefined') {
        allSongs.forEach(function(s) {
            var _mdc = (typeof GLStore !== 'undefined' && GLStore._getDetailCache) ? GLStore._getDetailCache(s.title) : null;
            var hasKey = s.key || (_mdc && _mdc.key && _mdc.key.key);
            var hasBpm = s.bpm || (_mdc && _mdc.song_bpm && _mdc.song_bpm.bpm);
            if (!hasKey) _missingCounts.no_key++;
            if (!hasBpm) _missingCounts.no_bpm++;
            if (typeof statusCache !== 'undefined' && !statusCache[s.title]) _missingCounts.no_status++;
        });
    }
    var _totalMissing = _missingCounts.no_key + _missingCounts.no_bpm + _missingCounts.no_status;

    var html = '';
    // Entry CTA when no triage active but missing data exists
    if (!tf && _totalMissing > 0) {
        var _bestFilter = _missingCounts.no_bpm >= _missingCounts.no_key ? 'no_bpm' : 'no_key';
        if (_missingCounts.no_status > _missingCounts[_bestFilter]) _bestFilter = 'no_status';
        html += '<button onclick="sqTriageStart(\'' + _bestFilter + '\')" style="font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24;margin-right:6px;display:inline-flex;align-items:center;gap:6px">'
            + '<span>⚡</span>Start cleanup → Fill missing song data'
            + '<span style="font-weight:500;opacity:0.7;font-size:0.82em">(' + _totalMissing + ')</span></button>';
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

    if (!tf) {
        // No active triage — show chip strip
        html += '<span style="font-size:0.65em;font-weight:700;color:var(--text-dim);margin-right:2px">Triage:</span>';
    }
    items.forEach(function(it) {
        var active = tf === it.id;
        var itemCount = _missingCounts[it.id] || '';
        if (tf && !active) {
            // During active triage, de-emphasize other chips
            html += '<button onclick="sqTriageSet(\'' + it.id + '\')" style="font-size:0.6em;font-weight:500;padding:1px 6px;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.05);background:none;color:var(--text-dim);opacity:0.5">' + it.label + '</button>';
        } else {
            html += '<button onclick="sqTriageSet(\'' + it.id + '\')" style="font-size:0.65em;font-weight:' + (active ? '800' : '600') + ';padding:' + (active ? '3px 10px' : '2px 7px') + ';border-radius:10px;cursor:pointer;border:' + (active ? '2px' : '1px') + ' solid '
                + (active ? '#fbbf24' : 'rgba(255,255,255,0.08)') + ';background:'
                + (active ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)') + ';color:'
                + (active ? '#fbbf24' : 'var(--text-dim)') + (active ? ';box-shadow:0 0 8px rgba(251,191,36,0.15)' : '') + '">' + it.label + (itemCount ? ' (' + itemCount + ')' : '') + '</button>';
        }
    });
    if (tf) {
        html += '<span style="font-size:0.65em;color:var(--text-dim);margin-left:4px">' + count + ' songs need data</span>';
        if (window._sqTriageDone > 0) {
            html += '<span style="font-size:0.65em;color:#22c55e;margin-left:2px">(' + window._sqTriageDone + ' done)</span>';
        }
        html += '<button onclick="sqTriageSet(null);window._sqTriageFilter=null;renderSongs()" style="font-size:0.62em;background:none;border:none;color:var(--text-dim);cursor:pointer;padding:0 4px">Clear</button>';
    }
    // Sort now via column headers (PL-11) — dropdown removed
    bar.innerHTML = html;
    dropdown.parentElement.insertBefore(bar, dropdown);
}

// ── Quick Song Setup (inline editing) ─────────────────────────────────────────

(function() {
    // Inject styles once
    var style = document.createElement('style');
    style.textContent = ''
        // ── 4-column layout (PL-12: Song | Readiness | Why | Band+Action) ──
        + '.song-row-grid{display:grid;grid-template-columns:40% 15% 30% 15%;align-items:center;gap:0 6px;min-width:0;padding:0 4px}'
        + '.song-col{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
        + '.song-col-title{font-weight:600;font-size:0.9em;color:var(--text,#f1f5f9);padding-left:8px}'
        + '.song-col-readiness{display:flex;align-items:center;gap:3px}'
        + '.song-col-why{font-size:0.72em}'
        + '.song-col-end{display:flex;align-items:center;gap:4px;justify-content:flex-end;padding-right:8px}'
        // Column headers
        + '#songDropdown{background:transparent!important;max-height:none!important;border:none!important}'
        + '.song-header-row{display:grid;grid-template-columns:1fr 100px 80px 90px 48px 36px;gap:0 8px;padding:6px 12px;border-bottom:2px solid rgba(255,255,255,0.12);margin-bottom:2px;position:sticky;top:0;z-index:5;background:#0f172a}'
        + '.song-hdr{font-size:0.65em;font-weight:800;color:var(--text-muted,#94a3b8);text-transform:uppercase;letter-spacing:0.06em;cursor:pointer;user-select:none;padding:4px 0}'
        + '.song-hdr:hover{color:var(--accent-light)}'
        + '.song-hdr-sm{font-size:0.6em}'
        + '.song-hdr-xs{font-size:0.55em;text-align:center}'
        // Readiness bar
        + '.song-readiness-bar{width:60px;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;flex-shrink:0}'
        + '.song-readiness-fill{height:100%;border-radius:3px;transition:width 0.3s}'
        + '.song-readiness-num{font-size:0.68em;font-weight:800;min-width:18px}'
        // Signals
        + '.song-signal-needswork{color:#f59e0b;font-weight:700}'
        + '.song-signal-context{color:#818cf8;font-weight:600}'
        + '.song-item--needswork{border-left:3px solid #f59e0b!important;background:rgba(245,158,11,0.02)!important}'
        // Edit button
        + '.song-quick-edit-btn{font-size:0.58em;opacity:0.2;cursor:pointer;border:1px solid transparent;background:none;padding:2px 5px;border-radius:4px;color:var(--text-dim);font-weight:600;transition:all 0.15s}'
        + '.song-item:hover .song-quick-edit-btn{opacity:0.9;border-color:rgba(99,102,241,0.3);color:var(--accent-light)}'
        + '.song-item--editing{border:2px solid rgba(99,102,241,0.4)!important;background:rgba(99,102,241,0.06)!important;padding:8px 12px!important;box-shadow:0 0 12px rgba(99,102,241,0.1)}'
        + '.sq-edit-form{width:100%}'
        + '.sq-edit-title{font-weight:700;font-size:0.95em;margin-bottom:6px;color:var(--text,#f1f5f9)}'
        + '.sq-edit-row{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}'
        + '.sq-edit-field{display:flex;flex-direction:column;gap:2px}'
        + '.sq-edit-label{font-size:0.6em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em}'
        + '.sq-edit-extras{margin-top:6px;font-size:0.78em;color:var(--text-dim)}'
        + '.sq-field{font-size:0.82em;padding:4px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:var(--text,#f1f5f9);font-family:inherit}'
        + '.sq-field:focus{border-color:rgba(99,102,241,0.5);outline:none}'
        + '.sq-done{font-size:0.75em;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;border-radius:5px;padding:5px 12px;cursor:pointer;font-weight:700;white-space:nowrap;align-self:flex-end}'
        + '.sq-field--saved{border-color:rgba(34,197,94,0.5)!important;transition:border-color 0.15s}'
        + '.gl-triage-active #sd-readiness-card,.gl-triage-active #sd-discussion-mount,.gl-triage-active #sd-confidence-prompt,.gl-triage-active .sd-intel-card,.gl-triage-active #sd-assets,.gl-triage-active #sd-prospect-vote{display:none!important}'
        + '.gl-triage-active .sd-tab-bar{display:none!important}'
        + '.gl-triage-active .sd-readiness-strip{display:none!important}'
        // Scroll snap for smooth iPhone scrolling
        + '#songDropdown{scroll-snap-type:y proximity;-webkit-overflow-scrolling:touch}'
        + '.song-item{scroll-snap-align:start}'
        // Mobile: 2-col layout (Song + Readiness), hide Why + Band columns
        + '@media(max-width:640px){'
        + 'table[style*="sticky"]{display:none!important}'
        + '.song-row-grid{grid-template-columns:1fr auto!important;gap:2px 4px!important}'
        + '.song-col-why,.song-col-end .song-badge{display:none!important}'
        + '.song-col-title{white-space:normal!important}'
        + '}';
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

    // Load current values from in-memory cache (may be stale for key/bpm)
    var songObj = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === title; }) : null;
    var currentKey = (songObj && songObj.key) || '';
    var currentBpm = (songObj && songObj.bpm) ? String(songObj.bpm) : '';
    var currentStatus = (typeof statusCache !== 'undefined' && statusCache[title]) || '';
    // Also check GLStore detail cache for Firebase-sourced key/bpm
    var _dc = (typeof GLStore !== 'undefined' && GLStore._getDetailCache) ? GLStore._getDetailCache(title) : null;
    if (_dc) {
        if (!currentKey && _dc.key && _dc.key.key) currentKey = _dc.key.key;
        if (!currentBpm && _dc.song_bpm && _dc.song_bpm.bpm) currentBpm = String(_dc.song_bpm.bpm);
    }

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

    row.innerHTML = '<div class="sq-edit-form">'
        + '<div class="sq-edit-title">' + title + '</div>'
        + '<div class="sq-edit-row">'
        + '<label class="sq-edit-field"><span class="sq-edit-label">Lead</span><select class="sq-field sq-tab" id="sq-lead-' + safeTitle + '" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'leadSinger\',this.value)">' + leadOpts + '</select></label>'
        + '<label class="sq-edit-field"><span class="sq-edit-label">Status</span><select class="sq-field sq-tab" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'status\',this.value)">' + statusOpts + '</select></label>'
        + '<label class="sq-edit-field"><span class="sq-edit-label">Key</span><select class="sq-field sq-tab" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'key\',this.value)">' + keyOpts + '</select></label>'
        + '<label class="sq-edit-field"><span class="sq-edit-label">BPM</span><input type="number" class="sq-field sq-tab" style="width:60px" min="40" max="240" value="' + currentBpm + '" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'bpm\',this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_sqAdvanceNext(\'' + safeTitle + '\')}"></label>'
        + '<button class="sq-done" onclick="event.stopPropagation();_sqClose(\'' + safeTitle + '\')">Done</button>'
        + '</div>'
        + '<div class="sq-edit-extras" id="sq-extras-' + safeTitle + '"></div>'
        + '</div>';

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

    // Load lead singer, key, bpm from Firebase async (fills in values not in allSongs cache)
    if (typeof GLStore !== 'undefined' && GLStore.loadFieldMeta) {
        GLStore.loadFieldMeta(title, 'lead_singer').then(function(data) {
            var sel = document.getElementById('sq-lead-' + safeTitle);
            if (sel && data && data.singer) sel.value = data.singer;
        }).catch(function() {});
        GLStore.loadFieldMeta(title, 'key').then(function(data) {
            if (!data || !data.key) return;
            var keySelects = row.querySelectorAll('.sq-tab');
            var keySel = keySelects[2]; // Key is 3rd field
            if (keySel && !keySel.value) keySel.value = data.key;
        }).catch(function() {});
        GLStore.loadFieldMeta(title, 'song_bpm').then(function(data) {
            if (!data || !data.bpm) return;
            var bpmInput = row.querySelector('input[type="number"]');
            if (bpmInput && !bpmInput.value) bpmInput.value = data.bpm;
        }).catch(function() {});
    }

    // Load Chart + Jam Structure into extras area
    var extrasEl = document.getElementById('sq-extras-' + safeTitle);
    if (extrasEl && typeof GLStore !== 'undefined' && GLStore.loadFieldMeta) {
        var extras = [];
        Promise.all([
            GLStore.loadFieldMeta(title, 'chart').catch(function() { return null; }),
            GLStore.loadFieldMeta(title, 'song_structure').catch(function() { return null; })
        ]).then(function(results) {
            var chart = results[0], structure = results[1];
            var html = '';
            // Chart status
            if (chart && chart.text) {
                html += '<span style="color:#fbbf24;margin-right:8px">📖 Chart loaded</span>';
            } else {
                html += '<span style="color:var(--text-dim);opacity:0.5;margin-right:8px">📖 No chart</span>';
            }
            // Jam Structure summary
            if (structure && structure.sections && structure.sections.length) {
                html += '<span style="color:var(--accent-light)">🎼 ' + structure.sections.length + ' sections</span>';
                html += '<span style="margin-left:4px;font-size:0.85em;color:var(--text-dim)">' + structure.sections.map(function(s) { return s.name; }).join(' → ') + '</span>';
            } else {
                html += '<span style="color:var(--text-dim);opacity:0.5">🎼 No structure</span>';
            }
            // North Star status
            var nsc = (typeof northStarCache !== 'undefined') ? northStarCache : {};
            if (nsc[title]) {
                html += '<span style="color:#22c55e;margin-left:8px">⭐ North Star</span>';
            } else {
                html += '<span style="color:var(--text-dim);opacity:0.5;margin-left:8px;cursor:pointer" onclick="event.stopPropagation();selectSong(\'' + safeTitle + '\')">⭐ Add North Star</span>';
            }
            // Harmonies status
            var hbc = (typeof harmonyBadgeCache !== 'undefined') ? harmonyBadgeCache : {};
            var hc = (typeof harmonyCache !== 'undefined') ? harmonyCache : {};
            if (hbc[title] || hc[title]) {
                html += '<span style="color:#818cf8;margin-left:8px">🎤 Harmonies</span>';
            } else {
                html += '<span style="color:var(--text-dim);opacity:0.5;margin-left:8px">🎤 No harmonies</span>';
            }
            extrasEl.innerHTML = html;
        });
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
