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
// Restore persisted sort + scope view on load
try { window._sqSongSort = localStorage.getItem('gl_song_sort') || 'default'; } catch(e) {}
window._sqScopeView = 'active'; // 'active' or 'library'
window._sqSelectMode = false;
window._sqSelected = {}; // { title: true }

// Derive scope from lifecycle status: prospect/learning/rotation = active, shelved/none = library
window.getSongScope = function(title) {
    var status = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? GLStore.getStatus(title) : '';
    // Canonical + legacy active statuses
    if (typeof GLStore !== 'undefined' && GLStore.ACTIVE_STATUSES && GLStore.ACTIVE_STATUSES[status]) return 'active';
    if (status === 'shelved' || status === 'parked' || status === 'retired') return 'library';
    return 'library'; // no status = library (default for imports)
};
window.isSongActive = function(title) { return getSongScope(title) === 'active'; };

// ── Songs Page Hydration Model ──────────────────────────────────────────────
// Tracks which async data layers have loaded. Prevents premature renders
// that would show empty/wrong values (0% readiness, missing love dots, etc.).
//
// Render gating:
//   songs + dna  → REQUIRED for first visible render (shows skeleton until ready)
//   readiness    → additive (re-render updates bars, no flash)
//   love         → additive (re-render adds dots, no flash)
//
// Sort safety:
//   If a sort depends on data not yet loaded (love, readiness), falls back
//   to title sort to prevent reorder jumps when data arrives.
window._sqDataReady = window._sqDataReady || { songs: false, dna: false, readiness: false, love: false };

window.renderSongs = function renderSongs(filter, searchTerm) {
    filter     = filter     || 'all';
    searchTerm = searchTerm || '';
    // Persist sort preference
    try { if (window._sqSongSort) localStorage.setItem('gl_song_sort', window._sqSongSort); } catch(e) {}

    var dropdown = document.getElementById('songDropdown');
    if (!dropdown) return;

    // Mark data layers as ready based on actual state
    if (typeof allSongs !== 'undefined' && allSongs.length > 0) window._sqDataReady.songs = true;
    if (window._glDnaPreloaded) window._sqDataReady.dna = true;
    if (typeof readinessCache !== 'undefined' && Object.keys(readinessCache).length > 0) window._sqDataReady.readiness = true;
    if (typeof GLStore !== 'undefined' && GLStore.getAllBandLove && Object.keys(GLStore.getAllBandLove()).length > 0) window._sqDataReady.love = true;

    // Show loading skeleton until songs + DNA are ready (minimum for meaningful render)
    if (!window._sqDataReady.songs || !window._sqDataReady.dna) {
        if (!dropdown.querySelector('.sq-loading')) {
            dropdown.innerHTML = '<div class="sq-loading" style="padding:40px 20px;text-align:center">'
                + '<div style="font-size:1.5em;margin-bottom:12px;opacity:0.3">\uD83C\uDFB5</div>'
                + '<div style="font-size:0.88em;color:var(--text-dim)">Loading songs...</div>'
                + '</div>';
        }
        return;
    }

    var knownBands = ['GD','JGB','WSP','PHISH','ABB','GOOSE','DMB'];

    // Empty band library — show setup CTA instead of empty search results
    if (typeof allSongs !== 'undefined' && allSongs.length === 0 && !searchTerm) {
        dropdown.innerHTML = '<div style="padding:40px 20px;text-align:center;display:block !important;grid-template-columns:none !important">'
            + '<div style="font-size:2.5em;margin-bottom:12px">🎵</div>'
            + '<div style="font-size:1.2em;font-weight:700;margin-bottom:8px;color:#f1f5f9">No songs yet</div>'
            + '<div style="font-size:0.9em;color:#94a3b8;margin-bottom:20px;line-height:1.5">Songs are added automatically when you create a setlist.<br>Just type your song names — no catalog setup needed.</div>'
            + '<button onclick="showPage(\'setlists\');setTimeout(function(){if(typeof createNewSetlist===\'function\')createNewSetlist();},300)" class="btn btn-primary" style="padding:14px 28px;font-size:1em;font-weight:700">Create a Setlist →</button>'
            + '<div style="margin-top:16px"><button onclick="_glAddSongManually()" class="btn btn-ghost" style="font-size:0.85em">+ Add a song manually</button></div>'
            + '</div>';
        return;
    }

    var filtered = allSongs.filter(function(song) {
        // Scope filter: active vs library view
        var _scope = getSongScope(song.title);
        if (window._sqScopeView === 'active' && _scope !== 'active') return false;
        if (window._sqScopeView === 'library' && _scope !== 'library') return false;

        var matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        // Multi-pick band filter (from column header)
        var _bf = window._sqBandFilter || [];
        if (_bf.length > 0) {
            var songBand = (song.band || 'Other');
            if (_bf.indexOf(songBand) === -1) return false;
        }

        // Legacy single-band filter (from old dropdown, if still called)
        if (filter && filter !== 'all') {
            var bandUpper = (song.band || '').toUpperCase();
            var matchesBand = filter.toUpperCase() === 'OTHER'
                ? !knownBands.includes(bandUpper)
                : bandUpper === filter.toUpperCase();
            if (!matchesBand) return false;
        }

        var isSearching = searchTerm.length > 0;

        // Multi-pick status filter (from column header)
        var _sf = window._sqStatusFilter || [];
        if (!isSearching && _sf.length > 0) {
            var songStatus = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? (GLStore.getStatus(song.title) || '') : '';
            if (_sf.indexOf(songStatus) === -1) return false;
        }

        // Legacy status filter (from old dropdown)
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
            // allSongs[].key and .bpm are the single source of truth after preload
            if (tf === 'no_key') {
                if (song.key) return false;
            }
            if (tf === 'no_bpm') {
                if (song.bpm) return false;
            }
            if (tf === 'no_status') {
                var _ts = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? GLStore.getStatus(song.title) : null;
                if (_ts) return false;
            }
            if (tf === 'no_lead') {
                // Check bulk-preloaded song.lead first, then GLStore detail cache
                if (song.lead) return false;
                var _dc = (typeof GLStore !== 'undefined' && GLStore._getDetailCache) ? GLStore._getDetailCache(song.title) : null;
                if (_dc && _dc.lead_singer && _dc.lead_singer.singer) return false;
            }
            if (tf === 'needs_work') {
                // Use focus engine — matches the "Needs work" chip exactly
                var _nwFocus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
                var _nwMatch = false;
                for (var _nwi = 0; _nwi < _nwFocus.list.length; _nwi++) {
                    if (_nwFocus.list[_nwi].title === song.title) { _nwMatch = true; break; }
                }
                if (!_nwMatch) return false;
            }
            if (tf === 'not_rotation') {
                var _nrStatus = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? GLStore.getStatus(song.title) : '';
                if (_nrStatus === 'rotation') return false;
            }
            if (tf === 'no_structure') {
                // Check bulk-preloaded flag first, then GLStore detail cache
                if (song._hasStructure) return false;
                var _stDc = (typeof GLStore !== 'undefined' && GLStore._getDetailCache) ? GLStore._getDetailCache(song.title) : null;
                if (_stDc && _stDc.song_structure && _stDc.song_structure.sections && _stDc.song_structure.sections.length > 0) return false;
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
        } else if (window._sqTriageFilter) {
            // Show comprehensive cleanup summary, not just the active filter
            var _tfLabels = { no_key:'Key', no_bpm:'BPM', no_status:'Status', no_lead:'Lead Singer', needs_work:'Needs Work', not_rotation:'Rotation', no_structure:'Structure' };
            var _tfLabel = _tfLabels[window._sqTriageFilter] || window._sqTriageFilter;
            // Check all categories for a complete picture
            var _allPool = (typeof allSongs !== 'undefined' ? allSongs : []).filter(function(s) { return isSongActive(s.title); });
            var _allMissing = {};
            _allPool.forEach(function(s) {
                if (!s.key) _allMissing.no_key = (_allMissing.no_key || 0) + 1;
                if (!s.bpm) _allMissing.no_bpm = (_allMissing.no_bpm || 0) + 1;
                if (!s.lead) _allMissing.no_lead = (_allMissing.no_lead || 0) + 1;
                if (typeof GLStore !== 'undefined' && GLStore.getStatus && !GLStore.getStatus(s.title)) _allMissing.no_status = (_allMissing.no_status || 0) + 1;
                if (!s._hasStructure) _allMissing.no_structure = (_allMissing.no_structure || 0) + 1;
            });
            var _summaryLines = [];
            ['no_key', 'no_bpm', 'no_lead', 'no_status', 'no_structure'].forEach(function(k) {
                var count = _allMissing[k] || 0;
                var label = _tfLabels[k] || k;
                _summaryLines.push('<div style="display:flex;justify-content:space-between;padding:2px 0">'
                    + '<span>' + label + '</span>'
                    + '<span style="font-weight:700;color:' + (count > 0 ? '#f59e0b' : '#22c55e') + '">' + (count > 0 ? count + ' missing' : '\u2713') + '</span></div>');
            });
            var _anyMissing = Object.keys(_allMissing).some(function(k) { return _allMissing[k] > 0; });
            msg = '<div style="font-size:2em;margin-bottom:12px">' + (_anyMissing ? '\uD83E\uDDF9' : '\u2705') + '</div>' +
                  '<div style="font-size:1.1em;font-weight:600;margin-bottom:6px;color:' + (_anyMissing ? '#fbbf24' : '#22c55e') + '">' + (_anyMissing ? 'Cleanup Status' : 'All good!') + '</div>' +
                  '<div style="max-width:250px;margin:0 auto 16px;text-align:left;font-size:0.85em;color:var(--text-dim)">' + _summaryLines.join('') + '</div>' +
                  (_anyMissing ? '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' + Object.keys(_allMissing).filter(function(k) { return _allMissing[k] > 0; }).map(function(k) {
                      return '<button onclick="sqTriageSet(\'' + k + '\')" style="font-size:0.78em;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.08);color:#fbbf24;font-weight:600">Fix ' + _tfLabels[k] + ' (' + _allMissing[k] + ')</button>';
                  }).join('') + '</div>' : '') +
                  '<button onclick="window._sqTriageFilter=null;document.body.classList.remove(\'gl-triage-active\');renderSongs()" class="btn btn-ghost" style="padding:8px 20px;font-size:0.85em;margin-top:12px">Back to Songs</button>';
        } else {
            msg = '<div style="font-size:2em;margin-bottom:12px">\uD83D\uDD0D</div>' +
                  '<div style="font-size:1.1em;font-weight:600;margin-bottom:6px">No songs found</div>' +
                  '<div style="font-size:0.9em;color:#64748b">Try a different search or filter</div>';
        }

        // Still render mode bar + scope tabs so user can navigate out of the empty state
        var _ac2 = 0, _lc2 = 0;
        if (typeof allSongs !== 'undefined') allSongs.forEach(function(s) { if (getSongScope(s.title) === 'active') _ac2++; else _lc2++; });
        var _emptyNav = '<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;margin-bottom:4px">'
            + '<button onclick="window._sqTriageFilter=null;window._sqSongSort=\'default\';document.body.classList.remove(\'gl-triage-active\');renderSongs()" style="font-size:0.72em;font-weight:800;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:#a5b4fc">All Songs</button>'
            + '<button onclick="if(!window._sqTriageFilter)sqCleanupStart()" style="font-size:0.72em;font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">\uD83E\uDDF9 Cleanup</button>'
            + '<span style="display:flex;align-items:center;gap:4px;margin-left:auto">'
            + '<button onclick="window._sqScopeView=\'active\';window._sqTriageFilter=null;window._sqSongSort=\'default\';renderSongs()" style="font-size:0.65em;font-weight:' + (window._sqScopeView === 'active' ? '800' : '500') + ';padding:2px 8px;border-radius:5px;cursor:pointer;border:1px solid ' + (window._sqScopeView === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)') + ';background:' + (window._sqScopeView === 'active' ? 'rgba(34,197,94,0.08)' : 'none') + ';color:' + (window._sqScopeView === 'active' ? '#22c55e' : 'var(--text-dim)') + '">Active (' + _ac2 + ')</button>'
            + '<button onclick="window._sqScopeView=\'library\';window._sqTriageFilter=null;window._sqSongSort=\'default\';renderSongs()" style="font-size:0.65em;font-weight:' + (window._sqScopeView === 'library' ? '800' : '500') + ';padding:2px 8px;border-radius:5px;cursor:pointer;border:1px solid ' + (window._sqScopeView === 'library' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)') + ';background:' + (window._sqScopeView === 'library' ? 'rgba(99,102,241,0.08)' : 'none') + ';color:' + (window._sqScopeView === 'library' ? '#a5b4fc' : 'var(--text-dim)') + '">Library (' + _lc2 + ')</button>'
            + '</span></div>';
        dropdown.innerHTML = _emptyNav + '<div style="padding:40px 20px;text-align:center;display:block !important;grid-template-columns:none !important">' + msg + '</div>';
        return;
    }

    // Show active filter chip so the user knows a filter is hiding songs
    _renderActiveFilterChip();

    // Sort: user-selected or triage auto-sort
    var _sortMode = window._sqSongSort || 'default';
    // User-selected sort — applies in all views including triage/cleanup
    var _userSortActive = _sortMode !== 'default' && filtered.length > 1;
    if (_userSortActive) {
        filtered.sort(function(a, b) {
            if (_sortMode === 'readiness_asc' || _sortMode === 'readiness_desc') {
                // If readiness data hasn't loaded yet, fall back to title sort
                if (!window._sqDataReady.readiness) return (a.title||'').localeCompare(b.title||'');
                var aA = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(a.title) : -1;
                var bA = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(b.title) : -1;
                if (aA < 0) aA = (_sortMode === 'readiness_asc' ? 99 : -1);
                if (bA < 0) bA = (_sortMode === 'readiness_asc' ? 99 : -1);
                return _sortMode === 'readiness_asc' ? aA - bA : bA - aA;
            }
            if (_sortMode === 'title_asc') return (a.title||'').localeCompare(b.title||'');
            if (_sortMode === 'title_desc') return (b.title||'').localeCompare(a.title||'');
            if (_sortMode === 'status') {
                var _aS = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? (GLStore.getStatus(a.title)||'') : '';
                var _bS = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? (GLStore.getStatus(b.title)||'') : '';
                return _aS.localeCompare(_bS);
            }
            if (_sortMode === 'band') return ((a.band||'').localeCompare(b.band||''));
            if (_sortMode === 'love_desc' || _sortMode === 'love_asc') {
                // If love data hasn't loaded yet, fall back to title sort (prevents reorder jump)
                if (!window._sqDataReady.love) return (a.title||'').localeCompare(b.title||'');
                var _gs = (typeof GLStore !== 'undefined');
                var _aLove = (_gs && GLStore.getBandLove) ? GLStore.getBandLove(a.title) : 0;
                var _bLove = (_gs && GLStore.getBandLove) ? GLStore.getBandLove(b.title) : 0;
                if (_aLove === _bLove) {
                    var _aAl = (_gs && GLStore.getAudienceLove) ? GLStore.getAudienceLove(a.title) : 0;
                    var _bAl = (_gs && GLStore.getAudienceLove) ? GLStore.getAudienceLove(b.title) : 0;
                    return _sortMode === 'love_desc' ? _bAl - _aAl : _aAl - _bAl;
                }
                return _sortMode === 'love_desc' ? _bLove - _aLove : _aLove - _bLove;
            }
            if (_sortMode === 'needs_work') {
                var _aNw = _topGaps[a.title] ? 1 : 0;
                var _bNw = _topGaps[b.title] ? 1 : 0;
                return _bNw - _aNw; // needs work first
            }
            return 0;
        });
    }

    // Triage priority sort: only when triage active AND no user sort overrides
    if (window._sqTriageFilter && !_userSortActive && filtered.length > 1) {
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
            var aAvg = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(a.title) : -1;
            var bAvg = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(b.title) : -1;
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
    var _hasGLStore = (typeof GLStore !== 'undefined');
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
    // Focus songs — single source of truth
    var _focusData = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
    var _topGaps = {};
    _focusData.list.forEach(function(f) { _topGaps[f.title] = true; });

    // ── MODE TOGGLE + SORT INDICATOR ──
    var _isCleanup = !!window._sqTriageFilter;
    var _sm = window._sqSongSort || 'default';
    var _arrow = function(field) {
        if (_sm === field + '_asc') return ' ↑';
        if (_sm === field + '_desc' || _sm === field) return ' ↓';
        return '';
    };
    var _sortLabels = { default:'Default', title_asc:'Song A→Z', title_desc:'Song Z→A', readiness_asc:'Readiness ↑', readiness_desc:'Readiness ↓', status:'Status', band:'Band', love_desc:'Love ↓', love_asc:'Love ↑', needs_work:'Needs Work' };
    var _modeBar = '<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;margin-bottom:4px">'
        + '<button onclick="window._sqTriageFilter=null;document.body.classList.remove(\'gl-triage-active\');renderSongs()" style="font-size:0.72em;font-weight:' + (!_isCleanup ? '800' : '600') + ';padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (!_isCleanup ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (!_isCleanup ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (!_isCleanup ? '#a5b4fc' : 'var(--text-dim)') + '">All Songs</button>'
        + '<button onclick="if(!window._sqTriageFilter)sqCleanupStart()" style="font-size:0.72em;font-weight:' + (_isCleanup ? '800' : '600') + ';padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (_isCleanup ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (_isCleanup ? 'rgba(251,191,36,0.1)' : 'none') + ';color:' + (_isCleanup ? '#fbbf24' : 'var(--text-dim)') + '">🧹 Cleanup</button>'
        + '<span style="display:flex;align-items:center;gap:4px;margin-left:auto">';
    // Count active vs library for scope labels
    var _activeCount = 0, _libraryCount = 0;
    if (typeof allSongs !== 'undefined') allSongs.forEach(function(s) { if (getSongScope(s.title) === 'active') _activeCount++; else _libraryCount++; });
    _modeBar += '<button onclick="window._sqScopeView=\'active\';window._sqSelectMode=false;window._sqSelected={};renderSongs()" title="Prospect + Learning + In Rotation" style="font-size:0.65em;font-weight:' + (window._sqScopeView === 'active' ? '800' : '500') + ';padding:2px 8px;border-radius:5px;cursor:pointer;border:1px solid ' + (window._sqScopeView === 'active' ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)') + ';background:' + (window._sqScopeView === 'active' ? 'rgba(34,197,94,0.08)' : 'none') + ';color:' + (window._sqScopeView === 'active' ? '#22c55e' : 'var(--text-dim)') + '">Active (' + _activeCount + ')</button>'
        + '<button onclick="window._sqScopeView=\'library\';window._sqSelectMode=false;window._sqSelected={};renderSongs()" title="Shelved + unassigned songs" style="font-size:0.65em;font-weight:' + (window._sqScopeView === 'library' ? '800' : '500') + ';padding:2px 8px;border-radius:5px;cursor:pointer;border:1px solid ' + (window._sqScopeView === 'library' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)') + ';background:' + (window._sqScopeView === 'library' ? 'rgba(99,102,241,0.08)' : 'none') + ';color:' + (window._sqScopeView === 'library' ? '#a5b4fc' : 'var(--text-dim)') + '">Library (' + _libraryCount + ')</button>'
        + (window._sqScopeView === 'library' ? '<button onclick="window._sqSelectMode=!window._sqSelectMode;window._sqSelected={};renderSongs()" style="font-size:0.65em;font-weight:' + (window._sqSelectMode ? '800' : '500') + ';padding:2px 8px;border-radius:5px;cursor:pointer;border:1px solid ' + (window._sqSelectMode ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)') + ';background:' + (window._sqSelectMode ? 'rgba(251,191,36,0.1)' : 'none') + ';color:' + (window._sqSelectMode ? '#fbbf24' : 'var(--text-dim)') + '">' + (window._sqSelectMode ? '✓ Done' : '☐ Select') + '</button>' : '')
        + '<span style="font-size:0.58em;color:var(--text-dim)">Sorted: <strong>' + (_sortLabels[_sm] || 'Default') + '</strong></span>'
        + '</span></div>';

    // ── ACTIVE FILTER BAR (shows what's filtered + clear all) ──
    var _bandFilter = window._sqBandFilter || [];
    var _statusFilter = window._sqStatusFilter || [];
    var _hasFilters = _bandFilter.length > 0 || _statusFilter.length > 0 || window._sqTriageFilter;
    var _filterBarEl = document.getElementById('songActiveFilters');
    if (_filterBarEl) {
        if (_hasFilters) {
            var _chips = [];
            _bandFilter.forEach(function(b) { _chips.push('<span onclick="window._sqBandFilter=window._sqBandFilter.filter(function(x){return x!==\'' + b + '\'});renderSongs()" style="font-size:0.72em;padding:2px 6px;border-radius:4px;background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.2);cursor:pointer">' + b + ' ✕</span>'); });
            _statusFilter.forEach(function(s) { _chips.push('<span onclick="window._sqStatusFilter=window._sqStatusFilter.filter(function(x){return x!==\'' + s + '\'});renderSongs()" style="font-size:0.72em;padding:2px 6px;border-radius:4px;background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2);cursor:pointer">' + (_statusDisplay[s] || s || 'Unrated') + ' ✕</span>'); });
            _filterBarEl.style.display = 'flex';
            _filterBarEl.innerHTML = '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">' + _chips.join('') +
                '<button onclick="window._sqBandFilter=[];window._sqStatusFilter=[];window._sqTriageFilter=null;document.body.classList.remove(\'gl-triage-active\');renderSongs()" style="font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-weight:700">Clear All</button></div>';
        } else {
            _filterBarEl.style.display = 'none';
        }
    }

    // ── UNIFIED TABLE ──
    var _hd = 'font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;cursor:pointer;padding:8px;white-space:nowrap';
    var _tableStart = '<table style="width:100%;border-collapse:collapse;table-layout:fixed">';
    var _bfActive = _bandFilter.length > 0;
    var _sfActive = _statusFilter.length > 0;
    var _bandFilterIcon = '<span onclick="event.stopPropagation();_sqToggleBandFilter()" style="cursor:pointer;margin-left:3px;font-size:0.9em;color:' + (_bfActive ? '#a5b4fc' : '#64748b') + '" title="Filter by band">' + (_bfActive ? '▼' : '▾') + '</span>';
    var _statusFilterIcon = '<span onclick="event.stopPropagation();_sqToggleStatusFilter()" style="cursor:pointer;margin-left:3px;font-size:0.9em;color:' + (_sfActive ? '#fbbf24' : '#64748b') + '" title="Filter by status">' + (_sfActive ? '▼' : '▾') + '</span>';
    var _isSelectMode = window._sqSelectMode && window._sqScopeView === 'library';
    var _selCount = Object.keys(window._sqSelected).length;
    var _selectAllChecked = _isSelectMode && _selCount > 0 && _selCount === filtered.length;
    var headerHTML = _tableStart + '<thead style="position:sticky;top:0;z-index:5;background:#0f172a"><tr style="border-bottom:2px solid rgba(255,255,255,0.1)">'
          + (_isSelectMode ? '<th style="' + _hd + ';width:28px;padding:6px 2px 6px 8px"><input type="checkbox" ' + (_selectAllChecked ? 'checked ' : '') + 'onclick="_sqToggleAll()" style="accent-color:#fbbf24;width:16px;height:16px;cursor:pointer" title="Select all"></th>' : '')
          + '<th style="' + _hd + ';text-align:left;width:' + (_isSelectMode ? '28%' : '32%') + '" onclick="window._sqSongSort=(window._sqSongSort===\'title_asc\'?\'title_desc\':\'title_asc\');renderSongs()">Song' + _arrow('title') + '</th>'
          + '<th style="' + _hd + ';text-align:left;width:14%" onclick="window._sqSongSort=(window._sqSongSort===\'readiness_asc\'?\'readiness_desc\':\'readiness_asc\');renderSongs()">Readiness' + _arrow('readiness') + '</th>'
          + '<th style="' + _hd + ';text-align:center;width:14%">Status' + _statusFilterIcon + '</th>'
          + '<th style="' + _hd + ';text-align:center;width:7%" onclick="window._sqSongSort=(window._sqSongSort===\'needs_work\'?\'default\':\'needs_work\');renderSongs()" title="Songs flagged by focus engine">\u26A0' + _arrow('needs_work') + '</th>'
          + '<th style="' + _hd + ';text-align:left;width:10%" onclick="window._sqSongSort=(window._sqSongSort===\'band\'?\'default\':\'band\');renderSongs()">Band' + _arrow('band') + ' ' + _bandFilterIcon + '</th>'
          + '<th style="' + _hd + ';text-align:center;width:13%" onclick="window._sqSongSort=(window._sqSongSort===\'love_desc\'?\'love_asc\':\'love_desc\');renderSongs()">Love' + _arrow('love') + '</th>'
          + '</tr></thead><tbody>';

    // ── Explainability helper ──
    function _sgBuildExplanation(title) {
      if (typeof GLInsights === 'undefined' || !GLInsights.getFocusExplanation) return '';
      var exp = GLInsights.getFocusExplanation(title);
      if (!exp || !exp.details || !exp.details.length) return '';
      var items = exp.details.slice(0, 3).map(function(d) {
        return '<span style="font-size:0.65em;color:var(--text-dim);display:inline-block;margin-right:8px">\u2022 ' + d + '</span>';
      }).join('');
      return '<div style="margin-top:4px;line-height:1.5">' + items + '</div>';
    }

    // ── SUGGESTED NEXT SONG ──
    // Focus engine — single source of truth for recommendation
    var _suggestHTML = '';
    if (!_isCleanup && filtered.length > 0) {
        var _focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { primary: null, list: [], reason: '' };
        if (_focus.primary) {
            var _sgSafe = _focus.primary.title.replace(/'/g, "\\'");

            // "Up Next" list (focus.list minus primary)
            var _upNextHtml = '';
            if (_focus.list.length > 1) {
                _upNextHtml = '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04)">';
                _upNextHtml += '<div style="font-size:0.6em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Up next</div>';
                _focus.list.slice(1, 4).forEach(function(s) {
                    var _nSafe = s.title.replace(/'/g, "\\'");
                    _upNextHtml += '<div onclick="if(typeof GLStore!==\'undefined\'&&GLStore.logBandActivity)GLStore.logBandActivity(\'practice\',{song:\'' + _nSafe + '\'});selectSong(\'' + _nSafe + '\')" style="display:flex;align-items:center;gap:6px;padding:5px 0;cursor:pointer;font-size:0.78em;color:var(--text-dim);min-height:32px">'
                        + '<span style="width:5px;height:5px;border-radius:50%;background:' + (s.avg < 2 ? '#ef4444' : s.avg < 3 ? '#fbbf24' : '#94a3b8') + ';flex-shrink:0"></span>'
                        + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + s.title + '</span></div>';
                });
                _upNextHtml += '</div>';
            }

            _suggestHTML = '<div style="padding:12px 18px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;border-left:4px solid #22c55e;box-shadow:0 2px 12px rgba(34,197,94,0.06)">'
                + '<div style="display:flex;align-items:center;gap:14px">'
                + '<div style="flex:1;min-width:0">'
                + '<div style="font-size:0.62em;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#86efac;margin-bottom:4px">Work on this next</div>'
                + '<div style="font-size:0.95em;font-weight:700;color:var(--text)">' + _focus.primary.title + '</div>'
                + '<div style="font-size:0.68em;color:var(--text-dim);margin-top:4px">' + (_focus.reason || '') + '</div>'
                + _sgBuildExplanation(_focus.primary.title)
                + '</div>'
                + '<button onclick="if(typeof GLStore!==\'undefined\'&&GLStore.logBandActivity)GLStore.logBandActivity(\'practice\',{song:\'' + _sgSafe + '\'});selectSong(\'' + _sgSafe + '\')" style="font-size:0.8em;font-weight:700;padding:9px 18px;border-radius:8px;cursor:pointer;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;white-space:nowrap;min-height:40px">\u25B6 Practice Now</button>'
                + '</div>'
                + _upNextHtml
                + '</div>';
        }
    }

    // ── CLEANUP QUEUE CARD (shown instead of suggestion when cleanup active) ──
    var _cleanupCard = '';
    if (_isCleanup && filtered.length > 0) {
        var _cFilter = window._sqTriageFilter;
        var _cLabel = { no_key:'Missing Key', no_bpm:'Missing BPM', no_status:'No Status', no_lead:'No Lead', needs_work:'Needs Work', not_rotation:'Not in Rotation', no_structure:'No Structure' }[_cFilter] || 'Filtered';

        if (_cFilter === 'needs_work') {
            // Needs Work: show as filter breadcrumb, not triage workflow
            _cleanupCard = '<div style="padding:8px 14px;margin-bottom:8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:10px;display:flex;align-items:center;gap:8px">'
                + '<span style="font-size:0.78em;color:#fbbf24;font-weight:600">\u26A0\uFE0F Showing ' + filtered.length + ' songs that need work</span>'
                + '<button onclick="sqTriageSet(null)" style="margin-left:auto;font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Show All</button>'
                + '</div>';
        } else {
            // Other triage filters: keep cleanup workflow
            var _cSong = filtered[0];
            var _cSafe = _cSong.title.replace(/'/g, "\\'");
            var _cTotal = filtered.length + (window._sqTriageDone || 0);
            var _cDone = window._sqTriageDone || 0;
            var _cPct = _cTotal > 0 ? Math.round(_cDone / _cTotal * 100) : 0;
            _cleanupCard = '<div style="padding:10px 14px;margin-bottom:8px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:10px;border-left:4px solid #fbbf24">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
                + '<span style="font-size:0.65em;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#fbbf24">Cleanup Queue \u00B7 ' + _cLabel + ' \u00B7 ' + _cDone + ' of ' + _cTotal + ' fixed</span>'
                + '<button onclick="sqTriageSet(null);window._sqTriageFilter=null;document.body.classList.remove(\'gl-triage-active\');renderSongs()" style="font-size:0.62em;padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Exit</button>'
                + '</div>'
                + '<div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-bottom:8px"><div style="height:100%;width:' + _cPct + '%;background:#fbbf24;border-radius:2px;transition:width 0.3s"></div></div>'
                + '<div style="font-size:0.88em;font-weight:700;color:var(--text);margin-bottom:4px">Next: ' + _cSong.title + '</div>'
                + '<div style="display:flex;gap:6px">'
                + '<button onclick="selectSong(\'' + _cSafe + '\')" style="font-size:0.72em;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24">Open & Edit \u2192</button>'
                + '<button onclick="window._sqTriageDone++;renderSongs()" style="font-size:0.72em;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim)">Skip</button>'
                + '</div></div>';
        }
    }

    // Focus mode: when entering from "Get Better", show focus list prominently
    if (window._glFocusMode && _focusData.list.length > 0) {
        var _focusTitles = {};
        _focusData.list.forEach(function(f) { _focusTitles[f.title] = true; });
        // Filter to focus songs only
        filtered = filtered.filter(function(s) { return _focusTitles[s.title]; });
        // Build focus banner
        _suggestHTML = '<div style="padding:12px 16px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:12px;border-left:4px solid #22c55e;margin-bottom:8px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
            + '<div style="font-size:0.72em;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#86efac">What to work on right now</div>'
            + '<button onclick="window._glFocusMode=false;renderSongs()" style="font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Show All</button>'
            + '</div>'
            + '<div style="font-size:0.78em;color:var(--text-dim)">' + (_focusData.reason || 'These songs need the most attention.') + '</div>'
            + '</div>';
        window._glFocusMode = false; // clear after rendering (one-shot)
    }

    // Render recommendation ABOVE search (in separate container)
    var _recEl = document.getElementById('songRecommendation');
    if (_recEl) {
        var _focusCue = '';
        if (!_isCleanup) {
            var _nwCount = 0;
            if (typeof allSongs !== 'undefined') allSongs.forEach(function(s) {
                if (typeof GLStore !== 'undefined' && GLStore.isActiveSong(s.title)) {
                    var _a = GLStore.avgReadiness ? GLStore.avgReadiness(s.title) : 0;
                    if (_a > 0 && _a < 3) _nwCount++;
                }
            });
            if (_nwCount > 0) _focusCue = '<div onclick="sqTriageSet(\'needs_work\')" style="font-size:0.75em;color:var(--gl-amber);opacity:0.7;cursor:pointer;padding:2px 0">\uD83C\uDFAF Focus: ' + _nwCount + ' song' + (_nwCount > 1 ? 's' : '') + ' need work</div>';
        }
        _recEl.innerHTML = (_isCleanup ? _cleanupCard : _suggestHTML) + _focusCue;
    }

    // ── Build normalized row view models (all data resolved once, not per-cell) ──
    var _isSelectMode = window._sqSelectMode && window._sqScopeView === 'library';
    var _rowModels = filtered.map(function(song) {
        var avg = (_hasGLStore && GLStore.avgReadiness) ? GLStore.avgReadiness(song.title) : 0;
        var status = (_hasGLStore && GLStore.getStatus) ? (GLStore.getStatus(song.title) || '') : '';
        var blv = (_hasGLStore && GLStore.getBandLove) ? GLStore.getBandLove(song.title) : 0;
        var alv = (_hasGLStore && GLStore.getAudienceLove) ? GLStore.getAudienceLove(song.title) : 0;
        return {
            title: song.title,
            titleEsc: song.title.replace(/"/g, '&quot;'),
            titleOnclick: song.title.replace(/'/g, "\\'"),
            band: song.band || '',
            isCustom: !!song.isCustom,
            avg: avg,
            barPct: avg ? Math.round((avg / 5) * 100) : 0,
            barColor: (typeof GLStatus !== 'undefined') ? GLStatus.getSongColor(avg) : (avg >= 3.5 ? '#22c55e' : avg >= 2 ? '#f59e0b' : avg > 0 ? '#ef4444' : 'rgba(255,255,255,0.08)'),
            readinessText: avg > 0 ? avg.toFixed(1) + '/5' : '\u2014',
            status: status,
            statusText: _statusDisplay[status] || '',
            needsWork: !!_topGaps[song.title],
            inSetlist: !!_upcomingSongs[song.title],
            bandLove: blv,
            audienceLove: alv,
            isChecked: _isSelectMode && !!window._sqSelected[song.title]
        };
    });

    dropdown.innerHTML = _modeBar + headerHTML + _rowModels.map(function(r) {
        var statusChip = r.statusText
            ? '<span class="song-chip" style="color:' + (_statusColor[r.status] || '#6b7280') + ';border-color:' + (_statusColor[r.status] || '#6b7280') + '44;background:' + (_statusColor[r.status] || '#6b7280') + '15">' + r.statusText + '</span>'
            : '';
        var needsWorkHtml = r.needsWork
            ? '<span style="color:#f59e0b;font-size:0.7em;font-weight:700" title="Focus engine flagged this song">\u26A0</span>'
            : (r.inSetlist ? '<span style="color:#818cf8;font-size:0.65em" title="In upcoming setlist">\uD83C\uDFAF</span>' : '');
        var _rowBorder = r.avg >= 3.5 ? '3px solid rgba(34,197,94,0.4)' : r.avg >= 2 ? '3px solid rgba(245,158,11,0.3)' : r.avg > 0 ? '3px solid rgba(239,68,68,0.4)' : '3px solid transparent';
        var _rowBg = r.needsWork ? 'rgba(245,158,11,0.02)' : '#1e293b';
        var _rowClick = _isSelectMode ? '_sqToggleRow(\'' + r.titleOnclick + '\')' : 'selectSong(\'' + r.titleOnclick + '\')';
        var _checkCol = _isSelectMode
            ? '<td style="padding:6px 2px 6px 8px;width:28px"><input type="checkbox" ' + (r.isChecked ? 'checked ' : '') + 'onclick="event.stopPropagation();_sqToggleRow(\'' + r.titleOnclick + '\')" style="accent-color:#fbbf24;width:16px;height:16px;cursor:pointer"></td>'
            : '';
        var _loveHtml = '';
        if (r.bandLove > 0 || r.audienceLove > 0) {
            var _bDots = '', _aDots = '';
            for (var _li = 1; _li <= 5; _li++) {
                _bDots += '<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:' + (_li <= r.bandLove ? '#ef4444' : 'rgba(255,255,255,0.08)') + ';margin-right:1px"></span>';
                _aDots += '<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:' + (_li <= r.audienceLove ? '#a855f7' : 'rgba(255,255,255,0.08)') + ';margin-right:1px"></span>';
            }
            _loveHtml = '<div style="display:flex;flex-direction:column;gap:1px;line-height:1" title="Band: ' + r.bandLove + '/5 \u00B7 Audience: ' + r.audienceLove + '/5">'
                + (r.bandLove > 0 ? '<div>' + _bDots + '</div>' : '')
                + (r.audienceLove > 0 ? '<div>' + _aDots + '</div>' : '')
                + '</div>';
        }
        return '<tr class="song-item' + (r.isCustom ? ' custom-song' : '') + '" data-title="' + r.titleEsc + '"' + (r.isCustom ? ' data-custom="true"' : '') +
               ' onclick="' + _rowClick + '" style="cursor:pointer;border-left:' + _rowBorder + ';background:' + (r.isChecked ? 'rgba(251,191,36,0.06)' : _rowBg) + '">' +
               _checkCol +
               '<td style="padding:8px 8px 8px ' + (_isSelectMode ? '4px' : '10px') + ';font-weight:600;font-size:0.88em;color:#f1f5f9;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:0">' + r.title + '</td>' +
               '<td style="padding:6px 4px"><div style="display:flex;align-items:center;gap:4px;white-space:nowrap"><span style="width:48px;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;flex-shrink:0"><span style="display:block;height:100%;width:' + r.barPct + '%;background:' + r.barColor + ';border-radius:3px"></span></span><span style="font-size:0.72em;font-weight:700;color:' + r.barColor + '">' + r.readinessText + '</span></div></td>' +
               '<td style="padding:6px 4px;font-size:0.7em;text-align:center">' + statusChip + '</td>' +
               '<td style="padding:6px 2px;text-align:center;font-size:1.1em">' + needsWorkHtml + '</td>' +
               '<td style="padding:6px 6px"><span class="song-badge ' + (r.band || 'other').toLowerCase() + '">' + r.band + '</span></td>' +
               '<td style="padding:6px 4px;text-align:center">' + _loveHtml + '</td>' +
               '</tr>';
    }).join('') + '</tbody></table>';

    // Bulk action bar (Library select mode)
    _sqRenderBulkBar();

    // Post-paint: highlight + preload only (no badge injection — all inline now)
    requestAnimationFrame(function() {
        if (!_isSelectMode) {
            if (typeof selectedSong !== 'undefined' && selectedSong && selectedSong.title) {
                highlightSelectedSongRow(selectedSong.title);
            }
            // Auto-select first song REMOVED — users found "After Midnight"
            // auto-opening on every render confusing. Let them tap explicitly.
        }
        if (typeof preloadAllStatuses === 'function') preloadAllStatuses();
    });
};

// ── Bulk select helpers (Library → Active) ───────────────────────────────────

window._sqToggleRow = function(title) {
    if (window._sqSelected[title]) delete window._sqSelected[title];
    else window._sqSelected[title] = true;
    renderSongs();
};

window._sqToggleAll = function() {
    var librarySongs = (typeof allSongs !== 'undefined') ? allSongs.filter(function(s) {
        return getSongScope(s.title) === 'library';
    }) : [];
    var allSelected = Object.keys(window._sqSelected).length === librarySongs.length;
    if (allSelected) {
        window._sqSelected = {};
    } else {
        window._sqSelected = {};
        librarySongs.forEach(function(s) { window._sqSelected[s.title] = true; });
    }
    renderSongs();
};

function _sqRenderBulkBar() {
    var existing = document.getElementById('sqBulkBar');
    if (existing) existing.remove();
    if (!window._sqSelectMode || window._sqScopeView !== 'library') return;
    var count = Object.keys(window._sqSelected).length;
    if (count === 0) return;

    var bar = document.createElement('div');
    bar.id = 'sqBulkBar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9998;background:rgba(15,23,42,0.97);border-top:1px solid rgba(251,191,36,0.3);padding:10px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 -4px 20px rgba(0,0,0,0.4)';
    bar.innerHTML = '<span style="font-size:0.82em;font-weight:700;color:#fbbf24">' + count + ' song' + (count > 1 ? 's' : '') + ' selected</span>'
        + '<select id="sqBulkStatus" style="padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:var(--text);font-size:0.82em;min-height:40px;-webkit-appearance:menulist">'
        + '<option value="learning" selected>📖 Learning — actively being learned</option>'
        + '<option value="prospect">👀 Prospect — candidate, not yet learned</option>'
        + '<option value="rotation">🔄 In Rotation — current working songs</option>'
        + '</select>'
        + '<button onclick="_sqBulkActivate()" style="padding:8px 18px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.12);color:#86efac;font-weight:700;font-size:0.82em;cursor:pointer;min-height:40px;white-space:nowrap">Add to Active Set</button>'
        + '<button onclick="window._sqSelected={};renderSongs()" style="padding:8px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);font-size:0.78em;cursor:pointer;min-height:40px">Cancel</button>';
    document.body.appendChild(bar);
}

window._sqBulkActivate = async function() {
    var titles = Object.keys(window._sqSelected);
    if (titles.length === 0) return;
    var statusEl = document.getElementById('sqBulkStatus');
    var status = statusEl ? statusEl.value : 'learning';
    var statusLabels = { prospect: 'Prospect', learning: 'Learning', rotation: 'In Rotation' };

    for (var i = 0; i < titles.length; i++) {
        if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
            await GLStore.updateSongField(titles[i], 'status', status);
        }
    }

    var count = titles.length;
    var firstTitle = titles[0];
    window._sqSelectMode = false;
    window._sqSelected = {};
    window._sqScopeView = 'active';
    renderSongs();

    // Remove bulk bar
    var bar = document.getElementById('sqBulkBar');
    if (bar) bar.remove();

    // Toast with optional "Open first song" CTA
    document.getElementById('sqActivateToast')?.remove();
    var toast = document.createElement('div');
    toast.id = 'sqActivateToast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.96);border:1px solid rgba(34,197,94,0.25);border-radius:14px;padding:10px 18px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.5);text-align:center;max-width:85vw;animation:glToastIn 0.2s ease-out';
    toast.innerHTML = '<div style="font-size:0.88em;font-weight:600;color:#f1f5f9">' + count + ' song' + (count > 1 ? 's' : '') + ' ready. Start with one now.</div>'
        + (firstTitle ? '<button onclick="selectSong(\'' + firstTitle.replace(/'/g, "\\'") + '\');this.closest(\'#sqActivateToast\').remove()" style="margin-top:6px;font-size:0.78em;font-weight:700;padding:5px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Open first song</button>' : '');
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.transition = 'opacity 0.4s';
        toast.style.opacity = '0';
        setTimeout(function() { toast.remove(); }, 400);
    }, 5000);
};

// ── Column filter dropdowns (band + status multi-pick) ───────────────────────
window._sqBandFilter = [];
window._sqStatusFilter = [];

window._sqToggleBandFilter = function() {
    var existing = document.getElementById('sqBandFilterDD');
    if (existing) { existing.remove(); return; }
    var bands = ['GD','JGB','WSP','Phish','ABB','Goose','DMB','Other'];
    var selected = window._sqBandFilter || [];
    var dd = document.createElement('div');
    dd.id = 'sqBandFilterDD';
    dd.style.cssText = 'position:fixed;z-index:999;background:#1e293b;border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5);max-height:300px;overflow-y:auto';
    dd.innerHTML = bands.map(function(b) {
        var checked = selected.indexOf(b) > -1 ? ' checked' : '';
        return '<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:0.82em;color:var(--text);cursor:pointer"><input type="checkbox" value="' + b + '"' + checked + ' onchange="_sqApplyBandFilter()" style="accent-color:var(--accent)">' + b + '</label>';
    }).join('') + '<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:4px;display:flex;gap:4px">'
        + '<button onclick="window._sqBandFilter=[];document.getElementById(\'sqBandFilterDD\').remove();renderSongs()" style="font-size:0.7em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Clear</button>'
        + '<button onclick="document.getElementById(\'sqBandFilterDD\').remove()" style="font-size:0.7em;padding:2px 8px;border-radius:4px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer">Done</button></div>';
    // Position near the Band header
    var th = document.querySelector('th:last-child');
    if (th) { var r = th.getBoundingClientRect(); dd.style.top = (r.bottom + 4) + 'px'; dd.style.right = (window.innerWidth - r.right) + 'px'; }
    document.body.appendChild(dd);
    document.addEventListener('click', function _closeBandDD(e) { if (!dd.contains(e.target) && e.target.closest('th') !== th) { dd.remove(); document.removeEventListener('click', _closeBandDD); } }, { capture: true });
};

window._sqApplyBandFilter = function() {
    var dd = document.getElementById('sqBandFilterDD');
    if (!dd) return;
    var checks = dd.querySelectorAll('input[type="checkbox"]');
    window._sqBandFilter = [];
    checks.forEach(function(c) { if (c.checked) window._sqBandFilter.push(c.value); });
    renderSongs();
};

window._sqToggleStatusFilter = function() {
    var existing = document.getElementById('sqStatusFilterDD');
    if (existing) { existing.remove(); return; }
    var statuses = [['prospect','👀 Prospect'],['learning','📖 Learning'],['rotation','🔄 In Rotation'],['shelved','📦 Shelved'],['','— Unrated']];
    var selected = window._sqStatusFilter || [];
    var dd = document.createElement('div');
    dd.id = 'sqStatusFilterDD';
    dd.style.cssText = 'position:fixed;z-index:999;background:#1e293b;border:1px solid rgba(251,191,36,0.3);border-radius:8px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5)';
    dd.innerHTML = statuses.map(function(s) {
        var checked = selected.indexOf(s[0]) > -1 ? ' checked' : '';
        return '<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:0.82em;color:var(--text);cursor:pointer"><input type="checkbox" value="' + s[0] + '"' + checked + ' onchange="_sqApplyStatusFilter()" style="accent-color:#fbbf24">' + s[1] + '</label>';
    }).join('') + '<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;padding-top:4px;display:flex;gap:4px">'
        + '<button onclick="window._sqStatusFilter=[];document.getElementById(\'sqStatusFilterDD\').remove();renderSongs()" style="font-size:0.7em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Clear</button>'
        + '<button onclick="document.getElementById(\'sqStatusFilterDD\').remove()" style="font-size:0.7em;padding:2px 8px;border-radius:4px;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24;cursor:pointer">Done</button></div>';
    var ths = document.querySelectorAll('thead th');
    var th = ths[2]; // Status is 3rd column
    if (th) { var r = th.getBoundingClientRect(); dd.style.top = (r.bottom + 4) + 'px'; dd.style.left = r.left + 'px'; }
    document.body.appendChild(dd);
    document.addEventListener('click', function _closeStatusDD(e) { if (!dd.contains(e.target)) { dd.remove(); document.removeEventListener('click', _closeStatusDD); } }, { capture: true });
};

window._sqApplyStatusFilter = function() {
    var dd = document.getElementById('sqStatusFilterDD');
    if (!dd) return;
    var checks = dd.querySelectorAll('input[type="checkbox"]');
    window._sqStatusFilter = [];
    checks.forEach(function(c) { if (c.checked) window._sqStatusFilter.push(c.value); });
    renderSongs();
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

// Smart cleanup entry: pick the first filter that has actual missing data
window.sqCleanupStart = function() {
    // Wait for DNA preload before checking
    if (!window._glDnaPreloaded) {
        if (typeof showToast === 'function') showToast('Loading song data\u2026 try again in a moment');
        return;
    }
    var pool = (typeof allSongs !== 'undefined' ? allSongs : []).filter(function(s) { return isSongActive(s.title); });
    var missing = { no_key: 0, no_bpm: 0, no_lead: 0, no_status: 0, no_structure: 0 };
    pool.forEach(function(s) {
        if (!s.key) missing.no_key++;
        if (!s.bpm) missing.no_bpm++;
        if (!s.lead) missing.no_lead++;
        if (typeof GLStore !== 'undefined' && GLStore.getStatus && !GLStore.getStatus(s.title)) missing.no_status++;
        if (!s._hasStructure) missing.no_structure++;
    });
    // Pick the first filter with missing data
    var order = ['no_key', 'no_bpm', 'no_lead', 'no_status', 'no_structure'];
    var labels = { no_key: 'key', no_bpm: 'BPM', no_lead: 'lead singer', no_status: 'status', no_structure: 'structure' };
    var best = null;
    for (var i = 0; i < order.length; i++) {
        if (missing[order[i]] > 0) { best = order[i]; break; }
    }
    if (best) {
        sqTriageSet(best);
    } else {
        // All clean — show summary
        sqTriageSet('no_bpm'); // will show "All good" message
    }
};

window.sqTriageSet = function(filter) {
    window._sqTriageFilter = (window._sqTriageFilter === filter) ? null : filter;
    window._sqTriageDone = 0;
    window._sqTriageIndex = -1;
    // Clear focus mode when entering triage — they don't stack
    window._glFocusMode = false;
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
        { id: 'no_structure', label: 'No Structure' },
        { id: 'needs_work', label: 'Needs Work' },
        { id: 'not_rotation', label: 'Not in Rotation' }
    ];
    // Count missing data — only active songs, respects band filter
    // Skip counts if DNA preload hasn't completed yet (allSongs lacks key/bpm before preload)
    var _missingCounts = { no_key: 0, no_bpm: 0, no_status: 0 };
    if (!window._glDnaPreloaded) {
        // DNA not loaded yet — don't show misleading counts
        bar.innerHTML = '';
        dropdown.insertBefore(bar, dropdown.firstChild);
        return;
    }
    var _countPool = allSongs.filter(function(s) {
        if (!isSongActive(s.title)) return false;
        if (window._sqBandFilter && window._sqBandFilter.length && window._sqBandFilter.indexOf(s.band || 'Other') === -1) return false;
        return true;
    });
    if (typeof _countPool !== 'undefined') {
        _countPool.forEach(function(s) {
            // allSongs[].key and .bpm are single source after preload promotion
            if (!s.key) _missingCounts.no_key++;
            if (!s.bpm) _missingCounts.no_bpm++;
            if (typeof GLStore !== 'undefined' && GLStore.getStatus && !GLStore.getStatus(s.title)) _missingCounts.no_status++;
        });
    }
    var _totalMissing = _missingCounts.no_key + _missingCounts.no_bpm + _missingCounts.no_status;

    var html = '';
    // Entry CTA — dynamic based on active triage or default
    if (_totalMissing > 0) {
        var _bestFilter = _missingCounts.no_bpm >= _missingCounts.no_key ? 'no_bpm' : 'no_key';
        if (_missingCounts.no_status > _missingCounts[_bestFilter]) _bestFilter = 'no_status';
        var _ctaLabel = tf
            ? { no_key:'Fix Missing Key', no_bpm:'Fix Missing BPM', no_status:'Set Status', no_lead:'Set Lead', no_structure:'Add Structure', needs_work:'Focus on Weak Songs', not_rotation:'Review Rotation' }[tf] || 'Continue Cleanup'
            : 'Get your songs rehearsal-ready';
        var _ctaCount = tf ? count : _totalMissing;
        var _ctaFilter = tf || _bestFilter;
        html += '<button onclick="sqTriageStart(\'' + _ctaFilter + '\')" style="font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24;margin-right:6px;display:inline-flex;align-items:center;gap:6px">'
            + '<span>⚡</span>' + _ctaLabel
            + '<span style="font-weight:500;opacity:0.7;font-size:0.82em">(' + _ctaCount + ')</span></button>';
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

    var _triageIcons = { no_key:'🔑', no_bpm:'🥁', no_status:'🎯', no_lead:'🎤', no_structure:'🎼', needs_work:'⚠️', not_rotation:'🔄' };
    var _primaryFilters = { needs_work: true, no_key: true, no_bpm: true };
    var _secondaryHtml = '';
    var _hasSecondary = false;
    items.forEach(function(it) {
        var active = tf === it.id;
        var itemCount = _missingCounts[it.id] || '';
        var icon = _triageIcons[it.id] || '';
        var btnHtml;
        if (tf && !active) {
            btnHtml = '<button onclick="sqTriageSet(\'' + it.id + '\')" class="gl-btn-ghost" style="font-size:0.62em;padding:2px 7px;opacity:0.4">' + icon + ' ' + it.label + '</button>';
        } else {
            btnHtml = '<button onclick="sqTriageSet(\'' + it.id + '\')" class="gl-btn-ghost" style="font-size:0.68em;font-weight:' + (active ? '800' : '600') + ';padding:3px 10px;' + (active ? 'border-color:var(--gl-amber);color:var(--gl-amber);background:rgba(251,191,36,0.15)' : '') + '">' + icon + ' ' + it.label + (itemCount ? ' <span style="opacity:0.6">(' + itemCount + ')</span>' : '') + '</button>';
        }
        if (_primaryFilters[it.id] || active) {
            html += btnHtml;
        } else {
            _secondaryHtml += btnHtml;
            _hasSecondary = true;
        }
    });
    // Collapsed secondary filters
    if (_hasSecondary && !tf) {
        html += '<button onclick="var s=document.getElementById(\'sqSecondaryFilters\');if(s){s.style.display=s.style.display===\'none\'?\'flex\':\'none\'}" class="gl-btn-ghost" style="font-size:0.62em;padding:2px 7px;opacity:0.5">More \u25BE</button>';
        html += '<div id="sqSecondaryFilters" style="display:none;gap:4px;flex-wrap:wrap;width:100%;padding-top:4px">' + _secondaryHtml + '</div>';
    } else if (_hasSecondary) {
        html += _secondaryHtml; // show all when a filter is active
    }
    if (tf) {
        html += '<span style="font-size:0.65em;color:var(--text-dim);margin-left:4px">' + count + ' songs need data</span>';
        if (window._sqTriageDone > 0) {
            html += '<span style="font-size:0.65em;color:#22c55e;margin-left:2px">(' + window._sqTriageDone + ' done)</span>';
        }
        html += '<button onclick="sqTriageSet(null);window._sqTriageFilter=null;renderSongs()" style="font-size:0.62em;background:none;border:none;color:var(--text-dim);cursor:pointer;padding:0 4px">Clear</button>';
    }
    // Chart queue launcher
    if (!tf) {
        html += '<button onclick="if(typeof openChartQueue===\'function\')openChartQueue()" style="font-size:0.68em;font-weight:600;padding:3px 10px;border-radius:8px;cursor:pointer;border:1px solid rgba(255,165,0,0.2);background:rgba(255,165,0,0.06);color:#fbbf24;transition:all 0.15s">🎸 Fill Missing Charts</button>';
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
        + '.song-col-why{font-size:0.72em;display:flex;flex-wrap:wrap;gap:3px;align-items:center}'
        + '.song-chip{font-size:0.82em;font-weight:600;padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);white-space:nowrap}'
        + '.song-chip--setlist{color:#818cf8;border-color:rgba(129,140,248,0.3);background:rgba(129,140,248,0.08)}'
        + '.song-chip--warn{color:#f59e0b;border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.08)}'
        + '.song-chip--warm{color:#94a3b8;border-color:rgba(148,163,184,0.2);background:rgba(148,163,184,0.06)}'
        + '.song-chip--dim{color:var(--text-dim);opacity:0.5;border-color:rgba(255,255,255,0.06)}'
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
        // Scroll snap for smooth iPhone scrolling
        + '#songDropdown{scroll-snap-type:y proximity;-webkit-overflow-scrolling:touch}'
        + '.song-item{scroll-snap-align:start}'
        // Mobile: show Song + Readiness + Love only, hide Status + NeedsWork + Band
        + '@media(max-width:640px){'
        + 'thead{display:none!important}'
        + '.song-item td:nth-child(3){display:none!important}'  // Status
        + '.song-item td:nth-child(4){display:none!important}'  // Needs Work
        + '.song-item td:nth-child(5){display:none!important}'  // Band
        + '.song-item td:first-child{white-space:normal!important;font-size:0.85em!important;max-width:none!important}'
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
    var currentStatus = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? (GLStore.getStatus(title) || '') : '';
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
    var statusOpts = [['','—'],['prospect','👀 Prospect'],['learning','📖 Learning'],['rotation','🔄 Rotation'],['shelved','📦 Shelved']].map(function(p) {
        return '<option value="' + p[0] + '"' + (currentStatus === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
    }).join('');

    // Key options
    var keyOpts = ['','A','Am','Bb','B','Bm','C','Cm','C#','D','Dm','E','Em','F','Fm','F#','G','Gm','Ab'].map(function(k) {
        return '<option value="' + k + '"' + (currentKey === k ? ' selected' : '') + '>' + (k || '—') + '</option>';
    }).join('');

    row.innerHTML = '<td colspan="4" style="padding:10px 12px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<span style="font-weight:700;font-size:0.95em;color:#f1f5f9">' + title + '</span>'
        + '<button class="sq-done" onclick="event.stopPropagation();_sqClose(\'' + safeTitle + '\')">Done</button>'
        + '</div>'
        + '<div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">'
        + '<label class="sq-edit-field"><span class="sq-edit-label">Lead</span><select class="sq-field sq-tab" id="sq-lead-' + safeTitle + '" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'leadSinger\',this.value)">' + leadOpts + '</select></label>'
        + '<label class="sq-edit-field"><span class="sq-edit-label">Status</span><select class="sq-field sq-tab" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'status\',this.value)">' + statusOpts + '</select></label>'
        + '<label class="sq-edit-field"><span class="sq-edit-label">Key</span><select class="sq-field sq-tab" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'key\',this.value)">' + keyOpts + '</select></label>'
        + '<label class="sq-edit-field"><span class="sq-edit-label">BPM</span><input type="number" class="sq-field sq-tab" style="width:60px" min="40" max="240" value="' + currentBpm + '" onchange="_sqFieldSaved(this);GLStore.updateSongField(\'' + safeTitle + '\',\'bpm\',this.value)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_sqAdvanceNext(\'' + safeTitle + '\')}"></label>'
        + '</div>'
        + '<div class="sq-edit-extras" id="sq-extras-' + safeTitle + '" style="margin-top:6px;font-size:0.78em;color:var(--text-dim)"></div>'
        + '</td>';

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

// ── Manual Song Add (for bands with empty library) ──────────────────────────
window._glAddSongManually = function() {
    var old = document.getElementById('glAddSongModal');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'glAddSongModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';

    overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:20px;max-width:360px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.5)">'
        + '<div style="font-size:0.95em;font-weight:700;color:#e2e8f0;margin-bottom:14px">Add a Song</div>'
        + '<input id="glAddSongTitle" class="app-input" placeholder="Song title" style="width:100%;margin-bottom:10px;padding:10px;font-size:0.9em">'
        + '<input id="glAddSongArtist" class="app-input" placeholder="Artist (optional)" style="width:100%;margin-bottom:14px;padding:10px;font-size:0.9em">'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="document.getElementById(\'glAddSongModal\').remove()" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;font-weight:600;font-size:0.85em;cursor:pointer">Cancel</button>'
        + '<button onclick="_glDoAddSong()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--accent);color:white;font-weight:600;font-size:0.85em;cursor:pointer">Add Song</button>'
        + '</div></div>';

    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    setTimeout(function() { var inp = document.getElementById('glAddSongTitle'); if (inp) inp.focus(); }, 100);
};

window._glDoAddSong = async function() {
    var titleEl = document.getElementById('glAddSongTitle');
    var artistEl = document.getElementById('glAddSongArtist');
    var title = titleEl ? titleEl.value.trim() : '';
    if (!title) { if (typeof showToast === 'function') showToast('Please enter a song title'); return; }

    var artist = artistEl ? artistEl.value.trim() : '';
    if (typeof ensureBandSong === 'function') await ensureBandSong(title);

    // Set default status to 'prospect' so the song appears in Active view
    if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
        await GLStore.updateSongField(title, 'status', 'prospect');
    }

    // Set artist if provided
    if (artist && typeof firebaseDB !== 'undefined' && firebaseDB) {
        var songId = (typeof generateSongId === 'function') ? generateSongId(title) : title.toLowerCase().replace(/\s+/g, '_');
        try { await firebaseDB.ref(window.bandPath('song_library/' + songId + '/artist')).set(artist); } catch(e) {}
    }

    var modal = document.getElementById('glAddSongModal');
    if (modal) modal.remove();
    if (typeof showToast === 'function') showToast('"' + title + '" added');
    renderSongs();

    // Show post-create setup tray
    _glShowSongSetupTray(title);
};

// ── Post-create song setup tray ──────────────────────────────────────────────
// Lightweight inline prompt to capture key, BPM, chart after adding a song.
// Not mandatory — "Skip for now" closes it immediately.
function _glShowSongSetupTray(songTitle) {
    var existing = document.getElementById('glSongSetupTray');
    if (existing) existing.remove();

    var tray = document.createElement('div');
    tray.id = 'glSongSetupTray';
    tray.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:4500;background:#1e293b;border-top:1px solid rgba(99,102,241,0.2);padding:12px 16px;padding-bottom:max(12px,env(safe-area-inset-bottom));box-shadow:0 -4px 20px rgba(0,0,0,0.4);animation:slideUp 0.2s ease';

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:0.82em;font-weight:700;color:var(--text)">\u2705 ' + escHtml(songTitle) + ' added \u2014 finish setup?</div>';
    html += '<button onclick="document.getElementById(\'glSongSetupTray\')?.remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.82em">Skip</button>';
    html += '</div>';

    // Setup fields — inline, compact
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';

    // Key
    html += '<div style="flex:1;min-width:80px">';
    html += '<label style="font-size:0.62em;color:var(--text-dim);display:block;margin-bottom:2px">Key</label>';
    html += '<select id="glSetupKey" onchange="_glSaveSetupField(\'' + escHtml(songTitle).replace(/'/g, "\\'") + '\',\'key\',this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:var(--text);font-size:0.82em;font-family:inherit">';
    html += '<option value="">--</option>';
    ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Am', 'Bm', 'Cm', 'Dm', 'Em', 'Fm', 'Gm'].forEach(function(k) {
        html += '<option value="' + k + '">' + k + '</option>';
    });
    html += '</select></div>';

    // BPM
    html += '<div style="flex:1;min-width:80px">';
    html += '<label style="font-size:0.62em;color:var(--text-dim);display:block;margin-bottom:2px">BPM</label>';
    html += '<input type="number" id="glSetupBpm" placeholder="e.g. 120" min="40" max="240" onchange="_glSaveSetupField(\'' + escHtml(songTitle).replace(/'/g, "\\'") + '\',\'bpm\',this.value)" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:var(--text);font-size:0.82em;font-family:inherit;box-sizing:border-box">';
    html += '</div>';

    // Chart buttons — Add Chart + Find Chart search
    html += '<div style="flex:1;min-width:80px;display:flex;flex-direction:column;gap:3px;justify-content:flex-end">';
    html += '<button onclick="_glSetupOpenChart(\'' + escHtml(songTitle).replace(/'/g, "\\'") + '\')" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;cursor:pointer;font-size:0.78em;font-weight:600;font-family:inherit;min-height:32px">\uD83C\uDFB5 Add Chart</button>';
    html += '<a href="https://www.google.com/search?q=' + encodeURIComponent(songTitle + ' chords tabs') + '" target="_blank" style="font-size:0.58em;color:var(--text-dim);text-align:center;text-decoration:none">\uD83D\uDD0D Find chart online</a>';
    html += '</div>';

    html += '</div>';

    // Inject slideUp animation if not present
    if (!document.getElementById('gl-setup-tray-style')) {
        var s = document.createElement('style');
        s.id = 'gl-setup-tray-style';
        s.textContent = '@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}';
        document.head.appendChild(s);
    }

    tray.innerHTML = html;
    document.body.appendChild(tray);

    // Auto-dismiss after 60 seconds, but cancel if user interacts
    var _setupDismissTimer = setTimeout(function() {
        var t = document.getElementById('glSongSetupTray');
        if (t) t.remove();
    }, 60000);
    // Any interaction with the tray cancels auto-dismiss
    tray.addEventListener('focusin', function() { clearTimeout(_setupDismissTimer); });
    tray.addEventListener('click', function() { clearTimeout(_setupDismissTimer); });
}

// Save a setup field inline (key or BPM)
window._glSaveSetupField = function(songTitle, field, value) {
    if (!value) return;
    if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
        GLStore.updateSongField(songTitle, field, field === 'bpm' ? parseInt(value) : value);
    }
};

// Open chart/song detail for the new song
window._glSetupOpenChart = function(songTitle) {
    var tray = document.getElementById('glSongSetupTray');
    if (tray) tray.remove();
    // Navigate to song detail
    if (typeof GLStore !== 'undefined' && GLStore.selectSong) {
        GLStore.selectSong(songTitle);
    } else if (typeof selectSong === 'function') {
        selectSong(songTitle);
    }
    showPage('songdetail');
};

// ── Focus change listener — re-render Songs when focus data changes ──────────
if (typeof GLStore !== 'undefined' && GLStore.on) {
  GLStore.on('focusChanged', function() {
    if (typeof currentPage !== 'undefined' && currentPage === 'songs') {
      renderSongs();
    }
  });
}

console.log('✅ songs.js loaded');
