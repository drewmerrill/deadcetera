// ============================================================================
// js/features/song-detail.js  — Phase 2: direct Firebase rendering, no DOM mirroring
// LENSES: Band · Listen · Learn · Sing · Inspire
// EXPOSES: renderSongDetail, switchLens, glSongDetailBack, sdUpdate*, sdSaveReadiness
// ============================================================================
'use strict';

var _sdCurrentLens   = 'band';
var _sdCurrentSong   = null;
var _sdLensPopulated = {};
var _sdContainer     = null;

var SD_LENSES_FULL = [
    { id:'learn',    icon:'\uD83C\uDFB8', label:'Practice' },
    { id:'band',     icon:'\uD83D\uDCCA', label:'Play'     },
    { id:'listen',   icon:'\uD83C\uDFA7', label:'Versions' },
    { id:'sing',     icon:'\uD83C\uDFA4', label:'Harmony'  },
    { id:'stems',    icon:'\ud83c\udf9a', label:'Stems'    },
    { id:'inspire',  icon:'\u2728', label:'Inspire' },
];

// All tabs always visible — no mode-based gating.
// Practice/Rehearse/Play influence meaning, not visibility.
var SD_LENSES_BY_MODE = null; // DEPRECATED — kept as null to prevent errors if referenced
var SD_LENSES = SD_LENSES_FULL;

// ── Entry ────────────────────────────────────────────────────────────────────
window.renderSongDetail = function renderSongDetail(songTitle, containerOverride, options) {
    var container = containerOverride || document.getElementById('page-songdetail');
  try {
    var title = songTitle || (selectedSong && (selectedSong.title || selectedSong));
    if (!title) { if (typeof showPage==='function') showPage('songs'); return; }
    _sdCurrentSong   = title;
    _sdLensPopulated = {};
    _sdCurrentLens   = 'band';
    var _sdOpts = options || {};
    try {
        if (!_sdOpts.panelMode) { localStorage.setItem('glLastPage', 'songdetail'); }
        localStorage.setItem('glLastSong', title);
    } catch(e) {}
    if (!container) return;
    _sdContainer = container;
    window._sdPanelMode = !!_sdOpts.panelMode;
    container.innerHTML = _sdShellHTML(title);
    _sdInjectStyles();
    var _defaultTab = 'learn';
    _sdActivateTab(_defaultTab);
    _sdPopulateBandLens(title);
    if (_defaultTab === 'learn') { _sdLensPopulated.learn = true; _sdPopulateLearnLens(title); }
    _sdPopulateRightPanel(title);
    requestAnimationFrame(function() { container.classList.add('sd-entered'); });
  } catch (_glRenderE) {
    if (typeof _glRenderError === 'function') _glRenderError(container, 'renderSongDetail', _glRenderE);
  }
};

window.switchLens = function switchLens(lens) {
    if (!SD_LENSES.find(function(l){return l.id===lens;})) return;
    _sdCurrentLens = lens;
    _sdActivateTab(lens);
    if (!_sdLensPopulated[lens]) {
        _sdLensPopulated[lens] = true;
        if (lens==='listen')  _sdPopulateListenLens(_sdCurrentSong);
        if (lens==='learn')   _sdPopulateLearnLens(_sdCurrentSong);
        if (lens==='sing')    _sdPopulateSingLens(_sdCurrentSong);
        if (lens==='stems')   _sdPopulateStemsLens(_sdCurrentSong);
        if (lens==='inspire') _sdPopulateInspireLens(_sdCurrentSong);
    }
};

// Show chart inline (used by "View Chart" button in sharpen mode)
window.sdShowChart = async function sdShowChart(title) {
    var panel = (_sdContainer || document).querySelector('.sd-lens-panel[data-lens="band"]');
    if (!panel) return;
    var safeSong = (title || '').replace(/'/g, "\\'");
    panel.innerHTML = '<div class="sd-panel-inner"><div style="text-align:center;padding:24px;color:var(--text-dim)">Loading chart...</div></div>';
    try {
        var chartData = await loadBandDataFromDrive(title, 'chart').catch(function() { return null; });
        var chartText = (chartData && chartData.text && chartData.text.trim()) ? chartData.text : null;
        panel.innerHTML = '<div class="sd-panel-inner">'
            + '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button onclick="sdCloseChart()" style="font-size:0.78em;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-muted);cursor:pointer">✕ Close Chart</button></div>'
            + _sdRenderBandChart(title, safeSong, chartText)
            + '</div>';
    } catch(e) {
        panel.innerHTML = '<div class="sd-panel-inner"><div style="padding:24px;text-align:center;color:var(--text-dim)">Failed to load chart</div></div>';
    }
};

window.sdCloseChart = function sdCloseChart() {
    _sdLensPopulated.band = false;
    _sdPopulateBandLens(_sdCurrentSong);
};

window.glSongDetailBack = function glSongDetailBack() {
    if (typeof showPage==='function') showPage('songs');
};

function _sdActivateTab(lens) {
    var _sdRoot = _sdContainer || document;
    _sdRoot.querySelectorAll('.sd-tab-btn').forEach(function(btn) {
        btn.classList.toggle('sd-tab-btn--active', btn.dataset.lens===lens);
    });
    _sdRoot.querySelectorAll('.sd-lens-panel').forEach(function(panel) {
        panel.style.display = (panel.dataset.lens===lens) ? 'block' : 'none';
    });
}

// ── Quick DNA bar — Key/BPM/Lead always visible in header ─────────────────────
function _sdBuildDnaBar(title) {
    var song = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === title; }) : null;
    var _dKey = song ? (song.key || '') : '';
    var _dBpm = song ? (song.bpm || '') : '';
    var _dLead = song ? (song.lead || '') : '';
    // Also check GLStore for more recent data
    if (typeof GLStore !== 'undefined' && GLStore.getSongMeta) {
        var _sm = GLStore.getSongMeta(title);
        if (_sm) { _dKey = _sm.key || _dKey; _dBpm = _sm.bpm || _dBpm; _dLead = _sm.leadSinger || _dLead; }
    }

    var h = '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 0">';
    // Key select
    h += '<select style="font-size:0.75em;padding:3px 6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:' + (_dKey ? 'var(--text)' : 'var(--text-dim)') + ';border-radius:5px;cursor:pointer" onchange="sdUpdateSongKey(this.value)">';
    h += '<option value=""' + (!_dKey ? ' selected' : '') + '>\uD83D\uDD11 Key</option>';
    ['A','A#','Bb','B','C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','Am','A#m','Bbm','Bm','Cm','C#m','Dm','D#m','Ebm','Em','Fm','F#m','Gm','G#m','Abm'].forEach(function(k) {
        h += '<option value="' + k + '"' + (k === _dKey ? ' selected' : '') + '>' + k + '</option>';
    });
    h += '</select>';
    // BPM input
    h += '<div style="display:flex;align-items:center;gap:3px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:2px 6px">';
    h += '<span style="font-size:0.68em;color:var(--text-dim)">\uD83E\uDD41</span>';
    h += '<input type="number" name="dnaBpm" min="40" max="240" placeholder="BPM" value="' + _sdEsc(String(_dBpm)) + '" style="width:42px;font-size:0.75em;padding:1px 2px;background:transparent;border:none;color:' + (_dBpm ? 'var(--text)' : 'var(--text-dim)') + ';outline:none" onchange="sdUpdateSongBpm(this.value)">';
    h += '</div>';
    // Lead select
    if (typeof bandMembers !== 'undefined' && Object.keys(bandMembers).length > 0) {
        h += '<select style="font-size:0.75em;padding:3px 6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:' + (_dLead ? 'var(--text)' : 'var(--text-dim)') + ';border-radius:5px;cursor:pointer" onchange="sdUpdateLeadSinger(this.value)">';
        h += '<option value=""' + (!_dLead ? ' selected' : '') + '>\uD83C\uDFA4 Lead</option>';
        Object.entries(bandMembers).forEach(function(e) {
            h += '<option value="' + e[0] + '"' + (e[0] === _dLead ? ' selected' : '') + '>' + (e[1].name || e[0]) + '</option>';
        });
        h += '</select>';
    }
    h += '</div>';
    return h;
}

// ── Shell HTML ────────────────────────────────────────────────────────────────
function _sdShellHTML(title) {
    var song = (typeof allSongs!=='undefined') ? allSongs.find(function(s){return s.title===title;}) : null;
    var band=song?(song.band||''):'', key=song?(song.key||''):'', bpm=song?(song.bpm||''):'';
    var lenses = SD_LENSES_FULL;
    var pills = (band?'<span class="sd-meta-pill sd-band-pill '+band.toLowerCase()+'">'+_sdEsc(band)+'</span>':'');

    var tabs = lenses.map(function(l) {
        return '<button class="sd-tab-btn" data-lens="'+l.id+'" onclick="switchLens(\''+l.id+'\')">'+
               '<span class="sd-tab-icon">'+l.icon+'</span>'+
               '<span class="sd-tab-label">'+l.label+'</span></button>';
    }).join('');
    // Always create all lens panels (even if tab hidden) for backward compat
    var panels = SD_LENSES_FULL.map(function(l) {
        return '<div class="sd-lens-panel" data-lens="'+l.id+'" style="display:none">'+_sdSkeleton()+'</div>';
    }).join('');

    var tabBarStyle = ''; // tabs always visible

    // Unified action bar — same actions regardless of mode
    var safeSong = _sdEsc(title).replace(/'/g,"\\'");
    var action = '<button class="sd-mobile-bar__btn sd-mobile-bar__btn--primary" onclick="openRehearsalMode(\''+safeSong+'\')" >\u25B6 Practice</button>';

    // Panel mode (inside gl-right-panel): single column, no dual layout
    var _isPanelMode = !!window._sdPanelMode;

    // Quick DNA bar: inline Key/BPM/Lead always visible in header
    var _dnaBar = _sdBuildDnaBar(title);

    var _sdSongRecPanel = (typeof allSongs !== 'undefined') ? (allSongs.find(function(s){return s.title===title;}) || {}) : {};
    var _sdEditBtnPanel = _sdSongRecPanel.isCustom
        ? '<button class="sd-back-btn" title="Edit song info" style="margin-left:6px;padding:5px 10px" onclick="showEditCustomSongModal(\''+safeSong+'\')">\u270f\ufe0f Edit</button>'
        : '';
    if (_isPanelMode) {
        // Single-column layout for right panel rendering.
        // Order matters: tabs go RIGHT under the title (under the DNA bar)
        // because they're the primary actions. Per ChatGPT/Drew critique
        // 2026-05-10: love/readiness/structure/discussion sections used to
        // sit ABOVE the tabs, pushing the most-important nav below the
        // fold. Secondary metadata now lives below the panels.
        return '<div class="song-detail-page">'+
               '<div class="sd-header">'+
               '  <div class="sd-header-top">'+
               '    <div style="display:flex;align-items:center"><button class="sd-back-btn" onclick="glSongDetailBack()">\u2190 Songs</button>'+_sdEditBtnPanel+'</div>'+
               '    <div class="sd-header-meta">'+pills+'</div>'+
               '  </div>'+
               '  <h1 class="sd-title">'+_sdEsc(title)+'</h1>'+
               _dnaBar+
               '  <div id="sd-readiness-strip" class="sd-readiness-strip"></div>'+
               '</div>'+
               '<nav class="sd-tab-bar"'+tabBarStyle+'>'+tabs+'</nav>'+
               '<div class="sd-panels">'+panels+'</div>'+
               '<div id="sd-right-info"></div>'+
               '<div id="sd-right-structure"></div>'+
               '<div id="sd-right-extras"></div>'+
               '<div class="sd-mobile-bar">'+action+'</div>'+
               '</div>';
    }

    // Full-page mode: dual layout with persistent right panel
    var rightPanel = '<div class="sd-right-panel" id="sdRightPanel">'
        + '<div id="sd-readiness-strip" class="sd-readiness-strip"></div>'
        + '<div id="sd-right-info"></div>'
        + '<div id="sd-right-structure"></div>'
        + '<div id="sd-right-extras"></div>'
        + '</div>';

    var _sdSongRec = (typeof allSongs !== 'undefined') ? (allSongs.find(function(s){return s.title===title;}) || {}) : {};
    var _sdEditBtn = _sdSongRec.isCustom
        ? '<button class="sd-back-btn" title="Edit song info" style="margin-left:6px;padding:5px 10px" onclick="showEditCustomSongModal(\''+safeSong+'\')">\u270f\ufe0f Edit</button>'
        : '';
    return '<div class="song-detail-page sd-dual-layout">'+
           '<div class="sd-header">'+
           '  <div class="sd-header-top">'+
           '    <div style="display:flex;align-items:center"><button class="sd-back-btn" onclick="glSongDetailBack()">\u2190 Songs</button>'+_sdEditBtn+'</div>'+
           '    <div class="sd-header-meta">'+pills+'</div>'+
           '  </div>'+
           '  <h1 class="sd-title">'+_sdEsc(title)+'</h1>'+
           _dnaBar+
           '</div>'+
           '<div class="sd-workspace-row">'+
           '  <div class="sd-left-workspace">'+
           '    <nav class="sd-tab-bar"'+tabBarStyle+'>'+tabs+'</nav>'+
           '    <div class="sd-panels">'+panels+'</div>'+
           '  </div>'+
           rightPanel+
           '</div>'+
           '<div class="sd-mobile-bar">'+action+'</div>'+
           '</div>';
}

function _sdSkeleton() {
    return '<div class="sd-panel-inner">'+
           '<div class="sd-skeleton-pulse" style="height:22px;width:45%;margin-bottom:12px;border-radius:6px"></div>'+
           '<div class="sd-skeleton-pulse" style="height:14px;width:72%;margin-bottom:8px;border-radius:4px"></div>'+
           '<div class="sd-skeleton-pulse" style="height:14px;width:58%;border-radius:4px"></div>'+
           '</div>';
}

// ── Band Chart (primary display) ──────────────────────────────────────────────
function _sdRenderBandChart(title, safeSong, chartText) {
    // Phase B.1 (audit §8.4): route through ChartRenderer when available.
    // Cached-shell legacy fallback (same pattern Phase A uses for GLNotes)
    // keeps us safe if a stale service-worker shell loads song-detail.js
    // without gl-chart-renderer.js.
    var hasCR = typeof window.ChartRenderer !== 'undefined';
    if (hasCR) {
        if (!chartText) {
            return window.ChartRenderer.renderEmptyState({
                loadFailed: !!window._sdChartLoadFailed,
                safeSong: safeSong,
                onAddChart: 'openRehearsalMode',
                onRetry: 'renderSongDetail'
            });
        }
        return '<div class="sd-card" style="padding:16px;border-color:rgba(34,197,94,0.2);background:rgba(34,197,94,0.02)">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
            + '<div class="sd-card-title" style="margin:0">🎼 Your Chart</div>'
            + '<button onclick="openRehearsalMode(\'' + safeSong + '\')" style="font-size:0.72em;padding:4px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.25);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-weight:600">✏️ Edit</button>'
            + '</div>'
            + window.ChartRenderer.renderHtml(chartText)
            + '</div>';
    }
    // ── Legacy fallback (cached service-worker shell without ChartRenderer) ──
    if (!chartText) {
        // Distinguish "never had a chart" (prompt to add) from "load failed"
        // (prompt to retry) — the latter is what Drew hit when the chart was
        // on Firebase but the read timed out.
        if (window._sdChartLoadFailed) {
            return '<div class="sd-card" style="text-align:center;padding:24px;border-color:rgba(251,191,36,0.25);background:rgba(251,191,36,0.04)">'
                + '<div style="font-size:1.4em;margin-bottom:8px">\u26A0</div>'
                + '<div style="font-size:0.88em;font-weight:700;color:#fbbf24;margin-bottom:4px">Couldn\u2019t load chart</div>'
                + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:12px">Network hiccup or Firebase slow to respond. The chart may still exist.</div>'
                + '<button class="sd-pm-btn" onclick="renderSongDetail(\'' + safeSong + '\')">Retry</button>'
                + '</div>';
        }
        return '<div class="sd-card" style="text-align:center;padding:24px;border-color:rgba(99,102,241,0.12)">'
            + '<div style="font-size:1.4em;margin-bottom:8px">\uD83D\uDCDD</div>'
            + '<div style="font-size:0.88em;font-weight:700;color:var(--text);margin-bottom:4px">No chart yet</div>'
            + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:12px">Paste or type a chart in rehearsal mode</div>'
            + '<button class="sd-pm-btn" onclick="openRehearsalMode(\'' + safeSong + '\')">\uD83D\uDCDD Add Chart</button>'
            + '</div>';
    }
    return '<div class="sd-card" style="padding:16px;border-color:rgba(34,197,94,0.2);background:rgba(34,197,94,0.02)">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
        + '<div class="sd-card-title" style="margin:0">\uD83C\uDFBC Your Chart</div>'
        + '<button onclick="openRehearsalMode(\'' + safeSong + '\')" style="font-size:0.72em;padding:4px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.25);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-weight:600">\u270F\uFE0F Edit</button>'
        + '</div>'
        + '<pre style="white-space:pre-wrap;font-family:\'Courier New\',monospace;font-size:13px;line-height:1.7;color:#e2e8f0;margin:0;letter-spacing:0.01em;max-height:400px;overflow-y:auto">' + _sdEsc(typeof window.glDecodeHtmlEntities === 'function' ? window.glDecodeHtmlEntities(chartText) : chartText) + '</pre>'
        + '</div>';
}

// ── Practice This Song section ────────────────────────────────────────────────
function _sdRenderPracticeSection(title, safeSong, ytQuery) {
    var _opts = '';
    return '<div class="sd-card" style="border-color:rgba(34,197,94,0.15)">'+
        '<div class="sd-card-title" style="margin-bottom:10px">\uD83C\uDFB8 Practice This Song</div>'+
        '<div style="display:flex;flex-direction:column;gap:8px">'+
        // Play Along
        '<button onclick="openRehearsalMode(\''+safeSong+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;cursor:pointer;text-align:left;width:100%">'+
        '<span style="font-size:1.1em;flex-shrink:0">\u25B6</span>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:0.88em;color:var(--text)">Play Along</div>'+
        '<div style="font-size:0.72em;color:var(--text-dim)">Stay in time. Don\u2019t rush the chorus.</div></div></button>'+
        // Learn the Parts
        '<button onclick="switchLens(\'learn\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;width:100%">'+
        '<span style="font-size:1.1em;flex-shrink:0">\uD83E\uDDE0</span>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:0.88em;color:var(--text)">Learn the Parts</div>'+
        '<div style="font-size:0.72em;color:var(--text-dim)">Watch this version \u2014 it\u2019s closest to how you\u2019re playing it.</div></div></button>'+
        // Practice Harmonies
        '<button onclick="if(typeof switchLens===\'function\'&&SD_LENSES.find(function(l){return l.id===\'sing\'})){switchLens(\'sing\')}else{window.open(\'https://www.youtube.com/results?search_query='+ytQuery+'+harmony\',\'_blank\')}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;width:100%">'+
        '<span style="font-size:1.1em;flex-shrink:0">\uD83C\uDFA4</span>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:0.88em;color:var(--text)">Practice Harmonies</div>'+
        '<div style="font-size:0.72em;color:var(--text-dim)">Take the high part. I\u2019ll give you the reference.</div></div></button>'+
        // Learn the Lyrics
        '<button onclick="window.open(\'https://www.google.com/search?q='+ytQuery+'+lyrics\',\'_blank\')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;cursor:pointer;text-align:left;width:100%">'+
        '<span style="font-size:1.1em;flex-shrink:0">\uD83D\uDCDD</span>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:0.88em;color:var(--text)">Learn the Lyrics</div>'+
        '<div style="font-size:0.72em;color:var(--text-dim)">Know the words. Know what they mean. That\u2019s what makes it land.</div></div></button>'+
        '</div></div>';
}

// ── Band Lens ─────────────────────────────────────────────────────────────────
async function _sdPopulateBandLens(title) {
    var panel = (_sdContainer||document).querySelector('.sd-lens-panel[data-lens="band"]');
    if (!panel) return;
    panel.style.display = 'block';
    _sdBuildReadinessStrip(title);

    var songKey = typeof sanitizeFirebasePath==='function' ? sanitizeFirebasePath(title) : title;
    var safeSong = title.replace(/'/g,"\\'");
    var lead='', status='', cribData=null, rehearsalNotes=null, sectionRatings={}, songMeta={}, chartText=null;
    var firebaseKey = '', firebaseBpm = '';

    // ── FAST PATH: chart loads first (or from cache), other data in parallel ──
    // On iPhone, each Firebase read can take 15s+. Chart is the priority.
    try {
        // Check localStorage cache for instant chart display
        var _chartCacheKey = 'gl_chart_' + songKey;
        var _cachedChart = null;
        try { _cachedChart = localStorage.getItem(_chartCacheKey); } catch(e) {}
        if (_cachedChart) chartText = _cachedChart;

        // Track whether the chart call failed so we can show "retry" UI
        // instead of falsely claiming the song has no chart on a transient
        // network error.
        var _chartLoadFailed = false;
        var _chartPromise = loadBandDataFromDrive(title,'chart').catch(function(){
            _chartLoadFailed = true;
            return null;
        });
        // Start all other loads in parallel (non-blocking)
        var _otherPromises = Promise.all([
            loadBandDataFromDrive(title,'lead_singer').catch(function(){return null;}),
            loadBandDataFromDrive(title,'song_status').catch(function(){return null;}),
            _sdGet('songs/'+songKey+'/metadata'),
            loadBandDataFromDrive(title,'personal_tabs').catch(function(){return null;}),
            loadBandDataFromDrive(title,'rehearsal_notes').catch(function(){return null;}),
            _sdGet('songs/'+songKey+'/section_ratings'),
            loadBandDataFromDrive(title,'key').catch(function(){return null;}),
            loadBandDataFromDrive(title,'song_bpm').catch(function(){return null;}),
        ]);
        // Wait for chart — renders immediately (cache already showed stale version)
        var _chartRes = await _chartPromise;
        var _freshChart = (_chartRes && _chartRes.text && _chartRes.text.trim()) ? _chartRes.text : null;
        if (_freshChart) {
            chartText = _freshChart;
            try { localStorage.setItem(_chartCacheKey, _freshChart); } catch(e) {}
        }
        // Decode any stored HTML entities so "1 &amp; 2 &amp;" renders as
        // "1 & 2 &" regardless of whether an old save stored the escaped form.
        if (chartText && typeof window.glDecodeHtmlEntities === 'function') {
            chartText = window.glDecodeHtmlEntities(chartText);
        }
        if (!_freshChart && !chartText && _chartRes === null) {
            // Nothing cached locally AND Firebase returned null. Could be
            // either "chart doesn't exist yet" (brand-new song) or "fetch
            // failed". loadBandDataFromDrive swallows errors, so the only
            // signal we have is `navigator.onLine`. Online + null = song
            // genuinely has no chart yet → show "Add Chart" CTA. Offline +
            // null = treat as a load failure → show retry banner.
            _chartLoadFailed = (typeof navigator !== 'undefined' && navigator.onLine === false);
        }
        // Expose for render branches
        window._sdChartLoadFailed = _chartLoadFailed;
        // Use cached status (already in memory from boot preloads)
        var _cacheStatus = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? (GLStore.getStatus(title) || '') : '';
        status = _cacheStatus;
        // Now wait for the rest (they've been loading in parallel this whole time)
        var res = await _otherPromises;
        lead   = (res[0] && res[0].singer) ? res[0].singer : (typeof res[0]==='string' ? res[0] : '');
        var _fbStatus = (res[1] && res[1].status) ? res[1].status : (typeof res[1]==='string' ? res[1] : '');
        if (!status) status = _fbStatus;
        songMeta=res[2]||{};
        cribData=res[3]; rehearsalNotes=res[4]; sectionRatings=res[5]||{};
        firebaseKey = res[6] ? (res[6].key || (typeof res[6]==='string' ? res[6] : '')) : '';
        firebaseBpm = res[7] ? (res[7].bpm ? String(res[7].bpm) : '') : '';
    } catch(e) {}

    var songObj=(typeof allSongs!=='undefined')?allSongs.find(function(s){return s.title===title;}):null;
    var metaKey=firebaseKey||(songObj&&songObj.key?songObj.key:'')||(songMeta.key?songMeta.key:'')||'';
    var metaBpm=firebaseBpm||(songObj&&songObj.bpm?String(songObj.bpm):'')||(songMeta.bpm?String(songMeta.bpm):'')||'';
    // Stash for cross-feature consumers (harmony-lab, etc.) that don't have
    // direct access to the song-detail DOM inputs but still need real meta.
    try { window._sdCurrentSongMeta = { title: title, key: metaKey, bpm: metaBpm }; } catch(e) {}

    var leadOpts=['','drew','chris','brian','pierce','drew,chris','shared','rotating','n/a'].map(function(v){
        var lbl=v===''?'Select…':v==='drew,chris'?'Drew & Chris':v==='shared'?'Shared':v==='rotating'?'Rotating':v==='n/a'?'N/A (Instrumental)':v.charAt(0).toUpperCase()+v.slice(1);
        return '<option value="'+v+'"'+(lead===v?' selected':'')+'>'+lbl+'</option>';
    }).join('');
    var statusOpts=[['','— Select —'],['prospect','👀 Prospect (Active)'],['learning','📖 Learning (Active)'],['rotation','🔄 In Rotation (Active)'],['shelved','📦 Shelved (Library)']].map(function(p){
        return '<option value="'+p[0]+'"'+(status===p[0]?' selected':'')+'>'+p[1]+'</option>';
    }).join('');
    var keyOpts=['','A','A#','Bb','B','C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','Am','A#m','Bbm','Bm','Cm','C#m','Dm','D#m','Ebm','Em','Fm','F#m','Gm','G#m','Abm'].map(function(k){
        return '<option value="'+k+'"'+(metaKey===k?' selected':'')+'>'+(k||'—')+'</option>';
    }).join('');

    // Song Intelligence Engine (Milestone 2 → Milestone 3 Phase A)
    var _siIntel = (typeof GLStore !== 'undefined' && GLStore.getSongIntelligence) ? GLStore.getSongIntelligence(title) : null;
    var _siGaps = (typeof GLStore !== 'undefined' && GLStore.getSongGaps) ? GLStore.getSongGaps(title) : null;
    var avgReadiness = _siIntel ? _siIntel.avg : 0;
    var tierLabel = _siIntel ? (SongIntelligence.READINESS_TIERS[_siIntel.tier] || {}).label || '' : '';
    var topGap = (_siGaps && _siGaps.length > 0) ? _siGaps[0] : null;
    var _siLowest = _siIntel ? _siIntel.lowestMembers : [];
    var _siMin = _siIntel ? _siIntel.min : 0;
    var topGapText = '—';
    if (_siLowest.length === 1 && _siMin > 0) {
        var _lm = (typeof bandMembers !== 'undefined' && bandMembers[_siLowest[0]]) ? bandMembers[_siLowest[0]].name : _siLowest[0];
        topGapText = _sdEsc(_lm) + ' (' + _siMin + ')';
    } else if (_siLowest.length > 1 && _siMin > 0) {
        var _lm2 = (typeof bandMembers !== 'undefined' && bandMembers[_siLowest[0]]) ? bandMembers[_siLowest[0]].name : _siLowest[0];
        topGapText = _sdEsc(_lm2) + ' + ' + (_siLowest.length - 1) + ' more at ' + _siMin;
    } else if (_siIntel && _siIntel.ratedCount === 0) {
        topGapText = 'No scores yet';
    } else if (topGap) {
        topGapText = _sdEsc(topGap.detail);
    }
    var gapCount = _siGaps ? _siGaps.filter(function(g) { return g.severity === 'high'; }).length : 0;
    var statusLabels={'prospect':'Prospect','learning':'Learning','rotation':'In Rotation','shelved':'Shelved','wip':'Learning','active':'Learning','gig_ready':'Learning','parked':'Shelved','retired':'Shelved','':'—'};
    var statusLabel=statusLabels[status]||status||'—';
    var ytQuery=encodeURIComponent(title);

    // ── PLAY MODE: stage-ready with set navigation ──
    // Legacy branch: `mode` was never actually declared/parameterized into
    // this function. typeof-guard prevents ReferenceError for the common
    // "undefined" case (which is every call today). If a future caller wants
    // to enable Play Mode here, they'll need to introduce the parameter.
    if (typeof mode !== 'undefined' && mode === 'play') {
        var _playNav = _sdBuildPlayNav(title);
        var _playCue = _sdBuildPlayCue(title, avgReadiness, _siIntel);
        panel.innerHTML =
            '<div class="sd-panel-inner">'+
            // Now Playing indicator + set navigation
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px 8px">'+
            (_playNav.prev ? '<button class="sd-pm-btn" style="font-size:0.78em;padding:5px 12px" onclick="renderSongDetail(\''+_sdEsc(_playNav.prev).replace(/'/g,"\\'")+'\')">← '+_sdEsc(_playNav.prev)+'</button>' : '<div></div>')+
            '<div style="text-align:center;font-size:0.72em;color:var(--text-dim);font-weight:700;letter-spacing:0.05em">NOW PLAYING</div>'+
            (_playNav.next ? '<button class="sd-pm-btn" style="font-size:0.78em;padding:5px 12px" onclick="renderSongDetail(\''+_sdEsc(_playNav.next).replace(/'/g,"\\'")+'\')">'+_sdEsc(_playNav.next)+' →</button>' : '<div></div>')+
            '</div>'+
            // Performance confidence cue — one line, subtle
            (_playCue ? '<div style="text-align:center;font-size:0.75em;padding:0 0 14px;color:'+_playCue.color+'">'+_playCue.text+'</div>' : '') +
            // Clean chart
            (chartText
                ? '<div class="sd-card" style="padding:24px;border-color:rgba(99,102,241,0.12)"><pre style="white-space:pre-wrap;font-family:\'Courier New\',monospace;font-size:15px;line-height:1.8;color:#e2e8f0;margin:0;letter-spacing:0.02em">' + _sdEsc(chartText) + '</pre></div>'
                : window._sdChartLoadFailed
                    ? '<div class="sd-card" style="text-align:center;padding:32px;color:var(--text-dim)"><div style="font-size:1.6em;margin-bottom:10px">\u26A0</div><div style="font-size:0.95em;margin-bottom:4px;color:#fbbf24">Couldn\u2019t load chart</div><div style="font-size:0.78em;margin-bottom:12px">Network hiccup or Firebase slow to respond. The chart may still exist.</div><button class="sd-pm-btn" onclick="renderSongDetail(\''+safeSong+'\')">Retry</button></div>'
                    : '<div class="sd-card" style="text-align:center;padding:32px;color:var(--text-dim)"><div style="font-size:1.6em;margin-bottom:10px">📖</div><div style="font-size:0.95em;margin-bottom:12px">No chart yet</div><button class="sd-pm-btn" onclick="sdShowGetChartModal(\''+safeSong+'\')">Get Chart</button></div>'
            ) +
            // Crib notes
            (cribData && toArray(cribData).length
                ? '<div class="sd-card" style="padding:16px"><div class="sd-card-title" style="margin-bottom:8px">\uD83D\uDCCB Stage Notes</div>' + _sdRenderCribNotes(cribData) + '</div>'
                : ''
            ) +
            // Transition hint to next song
            (_playNav.next ? _sdBuildTransitionHint(title, _playNav.next) : '') +
            '</div>';
        _sdBuildReadinessStrip(title);
        return;
    }

    // ── SHARPEN MODE: band lens shows chart + band context (Song Info lives in right panel) ──
    // `mode` was never actually parameterized into this function (same as the
    // play branch above). typeof-guard prevents ReferenceError on every render
    // — the only call sites today never set `mode`, so this branch is dead
    // until a future caller introduces the parameter.
    if (typeof mode !== 'undefined' && mode === 'sharpen') {
        panel.innerHTML =
            '<div class="sd-panel-inner">'+
            _sdRenderBandChart(title, safeSong, chartText)+
            '</div>';
        _sdBuildReadinessStrip(title);
        return;
    }

    // ── LOCK IN MODE: rehearsal plan card + focus ──
    var _focusItems = _sdBuildFocusItems(title, avgReadiness, _siGaps, _siIntel, _siLowest, status);
    var _recentSignal = _sdBuildRecentSignal(title);
    var _rehearsalPlan = _sdBuildRehearsalPlan(title, _focusItems, _siIntel);

    panel.innerHTML =
        '<div class="sd-panel-inner">'+
        // ── Band Chart (primary — always first if exists) ──
        _sdRenderBandChart(title, safeSong, chartText)+
        // ── Recent band activity signal ──
        (_recentSignal ? '<div style="padding:8px 12px;margin-bottom:10px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.1);border-radius:8px;font-size:0.78em;color:#a5b4fc">' + _recentSignal + '</div>' : '') +
        // ── TODAY'S REHEARSAL PLAN ──
        '<div class="sd-card" style="border-color:rgba(245,158,11,0.2);background:linear-gradient(135deg,rgba(245,158,11,0.04),rgba(239,68,68,0.03))">'+
        '<div class="sd-card-title" style="color:#fbbf24">\uD83C\uDFAF Today\'s Rehearsal Plan</div>'+
        (_rehearsalPlan.length ? _rehearsalPlan.map(function(step, i) {
            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;' + (i < _rehearsalPlan.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.04)' : '') + '">'+
                '<div style="width:24px;height:24px;border-radius:50%;background:rgba(245,158,11,0.12);display:flex;align-items:center;justify-content:center;font-size:0.72em;font-weight:800;color:#fbbf24;flex-shrink:0">' + (i + 1) + '</div>'+
                '<div style="flex:1"><div style="font-weight:600;font-size:0.88em;color:var(--text)">' + step.icon + ' ' + _sdEsc(step.title) + '</div>'+
                '<div style="font-size:0.75em;color:var(--text-dim);margin-top:2px">' + _sdEsc(step.detail) + '</div></div>'+
                (step.time ? '<span style="font-size:0.72em;font-weight:700;color:var(--text-dim);flex-shrink:0;white-space:nowrap">' + step.time + '</span>' : '') +
                '</div>';
        }).join('') : '<div style="font-size:0.85em;color:var(--text-dim);padding:4px">Looking good \u2014 no critical gaps. Run it once to stay sharp.</div>') +
        '<div style="margin-top:12px;display:flex;gap:8px">'+
        '<button class="sd-pm-btn" onclick="openRehearsalMode(\''+safeSong+'\')">\uD83D\uDCCB Run Through</button>'+
        '<button class="sd-pm-btn" style="margin-left:8px" onclick="switchLens(\'learn\')">\uD83C\uDFB8 Practice</button>'+
        '</div></div>'+
        // Band Love (unique to this mode)
        '<div class="sd-card" id="sd-love-card">'+
        '<div class="sd-card-title">\u2764\uFE0F Love Playing</div>'+
        _sdRenderBandLove(title, safeSong)+
        '</div>'+
        // ── Collapsed detail sections ──
        '<details class="sd-details"><summary class="sd-details-summary">\uD83C\uDFBC Structure & DNA <span style="font-size:0.72em;font-weight:500;color:var(--text-dim);margin-left:4px">tap to expand</span></summary>'+
        '<div style="padding:12px 0">'+
        '<div class="sd-card" style="padding:10px 14px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div class="sd-card-title" style="margin-bottom:0">\uD83C\uDFBC How We Play It</div>' +
        '<button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px" onclick="sdEditStructure(\''+safeSong+'\')">Edit</button>' +
        '</div>' +
        '<div id="sd-structure" style="font-size:0.82em;color:var(--text-dim);margin-top:6px">Loading...</div>' +
        '</div>' +
        '<div class="sd-card" style="padding:10px 14px">'+
        '<div class="sd-card-title" style="margin-bottom:8px">\uD83E\uDDEC Song DNA</div>'+
        '<div class="sd-dna-grid">'+
        '<div class="sd-dna-item"><span class="sd-dna-label">\uD83C\uDFA4 Lead</span><select class="app-select sd-select" onchange="sdUpdateLeadSinger(this.value)">'+leadOpts+'</select></div>'+
        '<div class="sd-dna-item"><span class="sd-dna-label">\uD83C\uDFAF Status</span><select class="app-select sd-select" onchange="sdUpdateSongStatus(this.value)">'+statusOpts+'</select></div>'+
        '<div class="sd-dna-item"><span class="sd-dna-label">\uD83D\uDD11 Key</span><select class="app-select sd-select" style="width:80px" onchange="sdUpdateSongKey(this.value)">'+keyOpts+'</select></div>'+
        '<div class="sd-dna-item"><span class="sd-dna-label">\uD83E\uDD41 BPM</span><input type="number" name="sdBpm" class="app-input sd-bpm-input" min="40" max="240" placeholder="120" value="'+_sdEsc(metaBpm)+'" onchange="sdUpdateSongBpm(this.value)"></div>'+
        '</div></div>'+
        '</div></details>'+
        '<details class="sd-details"><summary class="sd-details-summary">📋 Notes & Discussion <span style="font-size:0.72em;font-weight:500;color:var(--text-dim);margin-left:4px">tap to expand</span></summary>'+
        '<div style="padding:12px 0">'+
        '<div class="sd-card" id="sd-discussion-mount"><div style="font-size:0.82em;color:var(--text-dim);padding:4px">Loading discussion...</div></div>'+
        '<div class="sd-card">'+
        '<div class="sd-card-title">\uD83D\uDCCB Band Notes</div>'+
        '<div class="sd-notes-sub">Stage Crib Notes</div>'+
        _sdRenderCribNotes(cribData)+
        '<div class="sd-notes-sub" style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07)">Rehearsal Notes</div>'+
        _sdRenderRehearsalNotes(rehearsalNotes)+
        '</div></div></details>'+
        '<details class="sd-details"><summary class="sd-details-summary">\uD83D\uDCE6 Assets & Practice <span style="font-size:0.72em;font-weight:500;color:var(--text-dim);margin-left:4px">tap to expand</span></summary>'+
        '<div style="padding:12px 0">'+
        '<div class="sd-card" style="padding:10px 14px"><div class="sd-card-title" style="margin-bottom:8px">\uD83D\uDCE6 Song Assets</div><div id="sd-assets" style="display:flex;flex-wrap:wrap;gap:6px;font-size:0.75em"><span style="color:var(--text-dim)">Loading...</span></div></div>'+
        '</div></details>'+
        '</div>';
    _sdBuildReadinessStrip(title);
    setTimeout(function() { _sdLoadAttribution(title); _sdShowLifecycleSuggestion(title, status); _sdLoadAssets(title); _sdLoadStructure(title); }, 300);
    setTimeout(function() {
        var discMount = document.getElementById('sd-discussion-mount');
        if (discMount && typeof renderSongDiscussion === 'function') renderSongDiscussion(title, discMount);
        _sdRenderProspectVote(title);
    }, 200);
}

// ── Focus Items Builder (Lock In) ────────────────────────────────────────────
function _sdBuildFocusItems(title, avgReadiness, gaps, intel, lowestMembers, status) {
    var items = [];
    // 1. Low readiness — explains gig impact
    if (avgReadiness > 0 && avgReadiness < 3) {
        items.push({ icon: '⚠️',
            title: 'Band\'s at ' + avgReadiness.toFixed(1) + ' — not ready for the stage',
            detail: avgReadiness < 2
                ? 'This could fall apart live. Run it at least twice in rehearsal.'
                : 'Getting there, but the rough spots will show under pressure.' });
    }
    // 2. Member gap — names the person and why it matters
    if (lowestMembers && lowestMembers.length > 0 && intel && intel.min > 0 && intel.min < 3) {
        var names = lowestMembers.map(function(k) { return (typeof bandMembers !== 'undefined' && bandMembers[k]) ? bandMembers[k].name : k; });
        var verb = intel.min <= 1 ? 'hasn\'t learned this yet' : 'is still shaky';
        items.push({ icon: '👤',
            title: names[0] + ' ' + verb + ' (' + intel.min + '/5)',
            detail: names.length > 1
                ? names.slice(1).join(', ') + ' too. The chain is only as strong as the weakest link.'
                : 'If they\'re lost, everyone feels it. Give them space to catch up.' });
    }
    // 3. High-severity gaps — actionable
    if (gaps && gaps.length > 0) {
        var highGaps = gaps.filter(function(g) { return g.severity === 'high'; });
        if (highGaps.length > 0) {
            items.push({ icon: '🔧',
                title: highGaps[0].detail || 'Something needs attention',
                detail: highGaps.length > 1
                    ? (highGaps.length - 1) + ' more thing' + (highGaps.length > 2 ? 's' : '') + ' to sort out before this is tight.'
                    : 'Fix this and the song levels up.' });
        }
    }
    // 4. No readiness data — encouraging, not scolding
    if (!avgReadiness || avgReadiness === 0) {
        items.push({ icon: '📊',
            title: 'Nobody\'s rated this one yet',
            detail: 'Be the first — it takes 5 seconds and helps the whole band see where you stand.' });
    }
    // 5. Prospect — action-oriented
    if (status === 'prospect' || status === '') {
        items.push({ icon: '🗳',
            title: 'Still a prospect — should you learn it?',
            detail: 'The band hasn\'t committed to this song yet. Cast your vote.' });
    }
    // 6. Strong song — positive reinforcement
    if (avgReadiness >= 4 && items.length === 0) {
        items.push({ icon: '🔥',
            title: 'This one\'s locked in — ' + avgReadiness.toFixed(1) + '/5',
            detail: 'The band feels good about this. Keep it sharp and it\'ll be a highlight.' });
    }
    return items.slice(0, 3);
}

// ── Play Mode: set navigation ────────────────────────────────────────────────
function _sdBuildPlayNav(title) {
    // Try to get the current setlist song order
    var setlists = (typeof window._glCachedSetlists !== 'undefined') ? window._glCachedSetlists : ((typeof window._cachedSetlists !== 'undefined') ? window._cachedSetlists : null);
    if (!setlists || !setlists.length) return { prev: null, next: null };
    // Use the first setlist (most recent / upcoming)
    var sl = setlists[0];
    var allTitles = [];
    (sl.sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : item.title;
            if (t) allTitles.push(t);
        });
    });
    var idx = allTitles.indexOf(title);
    if (idx === -1) return { prev: null, next: null };
    return {
        prev: idx > 0 ? allTitles[idx - 1] : null,
        next: idx < allTitles.length - 1 ? allTitles[idx + 1] : null
    };
}

// ── Play Mode: performance confidence cue ────────────────────────────────────
function _sdBuildPlayCue(title, avgReadiness, intel) {
    // Check for rehearsal memory (weak spots from last session)
    var memory = _sdGetRehearsalMemory(title);
    if (memory) return { text: memory, color: '#f59e0b' };

    if (!avgReadiness && !intel) return null;
    var avg = avgReadiness || 0;
    if (avg >= 4.5) return { text: '\uD83D\uDD25 You own this one. Let it rip.', color: '#22c55e' };
    if (avg >= 4)   return { text: '\u2705 Solid. Trust the work you\'ve put in.', color: '#86efac' };
    if (avg >= 3)   return { text: '\uD83D\uDCAA Getting there. Stay focused on the changes.', color: '#fbbf24' };
    if (avg >= 2)   return { text: '\uD83C\uDFAF Watch the tricky parts. You know where they are.', color: '#f59e0b' };
    if (avg > 0)    return { text: '\uD83D\uDCA1 Lean on the chart. The band\'s got your back.', color: '#94a3b8' };
    return null;
}

// ── Lock In: build rehearsal plan from focus items ────────────────────────────
function _sdBuildRehearsalPlan(title, focusItems, intel) {
    var plan = [];
    // Convert focus items into timed rehearsal steps
    focusItems.forEach(function(f) {
        var time = '';
        if (f.icon === '\u26A0\uFE0F' || f.icon === '\uD83D\uDC64') time = '10 min'; // readiness / member gaps
        else if (f.icon === '\uD83D\uDD27') time = '5 min'; // specific fix
        else if (f.icon === '\uD83D\uDCCA' || f.icon === '\uD83D\uDDF3') time = '2 min'; // quick actions
        plan.push({ icon: f.icon, title: f.title, detail: f.detail, time: time });
    });
    // If there are actual issues, add a run-through step at the end
    if (plan.length > 0) {
        plan.push({ icon: '\uD83C\uDFB5', title: 'Full run-through', detail: 'Play it start to finish. No stops.', time: '8 min' });
    }
    return plan;
}

// ── Lock In: recent band activity signal ─────────────────────────────────────
function _sdBuildRecentSignal(title) {
    // Check if any band member recently changed readiness for this song
    if (typeof GLStore === 'undefined' || !GLStore.getAllReadiness) return null;
    var rc = GLStore.getAllReadiness();
    var scores = rc[title] || {};
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var myKey = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
    // Find highest-scoring non-self member for positive signal
    var bestOther = null;
    members.forEach(function(m) {
        if (m.key === myKey) return;
        var s = scores[m.key] || 0;
        if (s >= 4 && (!bestOther || s > bestOther.score)) {
            bestOther = { name: m.name, score: s };
        }
    });
    if (bestOther) {
        return '\uD83D\uDCC8 ' + bestOther.name + ' is at ' + bestOther.score + '/5 \u2014 band readiness rising';
    }
    // Count rated members
    var rated = members.filter(function(m) { return (scores[m.key] || 0) > 0; }).length;
    if (rated > 0 && rated < members.length) {
        return '\uD83D\uDC65 ' + rated + '/' + members.length + ' members have rated this song';
    }
    return null;
}

// ── Play Mode: transition hint to next song ──────────────────────────────────
function _sdBuildTransitionHint(currentTitle, nextTitle) {
    if (!nextTitle) return '';
    // Check transition intelligence — never show empty state
    var hint = '\uD83D\uDD04 New transition';
    if (typeof GLStore !== 'undefined' && GLStore.getTransitionBySongs) {
        var currentId = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(currentTitle) : currentTitle;
        var nextId = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(nextTitle) : nextTitle;
        var trans = GLStore.getTransitionBySongs(currentId, nextId);
        if (trans && trans.practiceCount > 0 && trans.confidence >= 4) {
            hint = '\u2705 Transition locked';
        } else if (trans && trans.practiceCount > 0) {
            hint = '\uD83D\uDCAA Practiced';
        } else if (trans && trans.issueFlags && trans.issueFlags.length > 0) {
            hint = '\u26A0\uFE0F ' + trans.issueFlags[0];
        } else {
            hint = '\uD83D\uDD04 Not yet practiced';
        }
    }
    // Get next song's key for transition awareness
    var nextSong = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === nextTitle; }) : null;
    var nextKey = nextSong && nextSong.key ? nextSong.key : '';

    var safeNext = _sdEsc(nextTitle).replace(/'/g, "\\'");
    return '<div style="margin-top:8px;padding:12px 16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:background 0.15s" onclick="renderSongDetail(\'' + safeNext + '\')" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.02)\'">' +
        '<span style="font-size:0.72em;color:var(--text-dim);font-weight:700;letter-spacing:0.04em">NEXT</span>'+
        '<span style="font-size:0.88em;font-weight:600;color:var(--text);flex:1">' + _sdEsc(nextTitle) + '</span>'+
        (nextKey ? '<span style="font-size:0.72em;color:#818cf8;background:rgba(129,140,248,0.1);padding:2px 6px;border-radius:4px">' + _sdEsc(nextKey) + '</span>' : '') +
        '<span style="font-size:0.72em;color:var(--text-dim)">' + hint + '</span>' +
        '<span style="color:var(--text-dim);font-size:0.85em">\u2192</span>' +
        '</div>';
}

// ── Sharpen: upgrade Listen step with North Star ─────────────────────────────
async function _sdUpgradeListenStep(title) {
    var step = (_sdContainer || document).querySelector('#sd-listen-step');
    var sub = (_sdContainer || document).querySelector('#sd-listen-sub');
    if (!step || !sub) return;
    try {
        var refs = await loadBandDataFromDrive(title, 'spotify_versions').catch(function() { return null; });
        if (!refs) return;
        var arr = (typeof toArray === 'function') ? toArray(refs) : (Array.isArray(refs) ? refs : []);
        // Find top-voted version. Tie-breaker: most recently added wins, so
        // adding a fresh URL via "Change" actually replaces the displayed
        // North Star when both candidates have 0 votes. Without this, a
        // newly-added entry never displaces an older 0-vote entry that
        // happens to be earlier in the array.
        var northStar = null;
        // Explicit override first: if any version is flagged isNorthStar
        // (set by "Save as North Star" via the version hub), it wins
        // regardless of votes. Take the most-recently-flagged one if
        // multiple exist (legacy data safety).
        var explicit = arr.filter(function(v) { return v && v.isNorthStar === true; });
        if (explicit.length) {
            explicit.sort(function(a, b) { return _sdVersionTime(b) - _sdVersionTime(a); });
            northStar = Object.assign({}, explicit[0], { _vc: 0, _addedAt: _sdVersionTime(explicit[0]) });
        }
        arr.forEach(function(v) {
            if (northStar && northStar.isNorthStar) return; // explicit pick already won
            var votes = v.votes ? Object.keys(v.votes).filter(function(k) { return v.votes[k]; }).length : 0;
            var thisTime = _sdVersionTime(v);
            var existingTime = northStar ? (northStar._addedAt || 0) : 0;
            var existingVotes = northStar ? (northStar._vc || 0) : -1;
            var wins = votes > existingVotes || (votes === existingVotes && thisTime > existingTime);
            if (wins) northStar = Object.assign({}, v, { _vc: votes, _addedAt: thisTime });
        });
        if (northStar && northStar.url) {
            step.onclick = function() { openMusicLink(northStar.url); };
            sub.innerHTML = '\u2B50 ' + _sdEsc(northStar.fetchedTitle || northStar.title || 'North Star version');
        }
    } catch(e) {}
}

// Lightweight rehearsal memory: check if latest rehearsal session had notes for this song
// Numeric timestamp for a version, used to break vote ties so a freshly
// added "Change" entry wins over an older 0-vote entry. Falls back through
// addedAt → fetchedAt → id (id is `version_<Date.now()>`) → dateAdded so
// legacy versions written without addedAt still tie-break sensibly.
function _sdVersionTime(v) {
    if (!v) return 0;
    if (v.addedAt) { var t = Date.parse(v.addedAt); if (!isNaN(t)) return t; }
    if (v.fetchedAt) { var t2 = Date.parse(v.fetchedAt); if (!isNaN(t2)) return t2; }
    if (typeof v.id === 'string' && v.id.indexOf('version_') === 0) {
        var n = parseInt(v.id.slice(8), 10);
        if (!isNaN(n)) return n;
    }
    if (v.dateAdded) { var t3 = Date.parse(v.dateAdded); if (!isNaN(t3)) return t3; }
    return 0;
}

function _sdGetRehearsalMemory(title) {
    // Check latest completed rehearsal summary
    if (typeof GLStore === 'undefined' || !GLStore.getLatestCompletedSummary) return null;
    var summary = GLStore.getLatestCompletedSummary();
    if (!summary || !summary.blocks) return null;
    // Find this song's block in the session
    for (var i = 0; i < summary.blocks.length; i++) {
        var b = summary.blocks[i];
        if (b.title === title || b.songTitle === title) {
            // Check for pacing issues
            if (b.actualMinutes && b.budgetMinutes && b.actualMinutes > b.budgetMinutes * 1.5) {
                return '\u26A0\uFE0F Ran long last rehearsal \u2014 tighten the jam.';
            }
            // Check for notes left during session
            if (b.notes && b.notes.trim()) {
                var note = b.notes.trim();
                return '\uD83D\uDCDD ' + (note.length > 50 ? note.slice(0, 47) + '...' : note);
            }
        }
    }
    return null;
}

// ── Sharpen: readiness trend after save ──────────────────────────────────────
function _sdBuildReadinessTrend(title) {
    var myKey = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
    if (!myKey) return '';
    var scores = (typeof GLStore !== 'undefined' && GLStore.getReadiness) ? (GLStore.getReadiness(title) || {}) : {};
    var current = scores[myKey] || 0;
    if (!current) return '';
    var stats = (typeof GLStore !== 'undefined' && GLStore.getSongPracticeStats) ? GLStore.getSongPracticeStats(title) : null;
    var practiced = stats && stats.practiceCount ? stats.practiceCount : 0;

    // Try to load readiness history for real delta (async, inject when ready)
    _sdLoadReadinessHistory(title, myKey, current, practiced);

    // Immediate message based on current score
    if (current >= 5) return '<div class="sd-trend sd-trend--up" id="sd-trend-msg">\uD83D\uDD25 Locked in. You\'re gig-ready on this one.</div>';
    if (current >= 4) return '<div class="sd-trend sd-trend--up" id="sd-trend-msg">\uD83D\uDCC8 Almost there' + (practiced > 2 ? ' \u2014 ' + practiced + ' sessions deep.' : '. One more good run should do it.') + '</div>';
    if (current >= 3) return '<div class="sd-trend sd-trend--flat" id="sd-trend-msg">\uD83D\uDCAA Getting solid' + (practiced > 0 ? '. Keep the momentum going.' : '. A few focused reps will level this up.') + '</div>';
    if (current >= 2) return '<div class="sd-trend sd-trend--work" id="sd-trend-msg">\uD83C\uDFAF Needs work' + (practiced > 0 ? ', but you\'re putting in the time.' : '. Start with the parts you know and build out.') + '</div>';
    return '<div class="sd-trend sd-trend--work" id="sd-trend-msg">\uD83D\uDCD6 Early days. Listen first, then play along with the chart.</div>';
}

// Async: load history, compute delta, inject into existing trend element
function _sdLoadReadinessHistory(title, memberKey, currentScore, practiceCount) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return;
    var k = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(title) : title;
    try {
        firebaseDB.ref(bandPath('songs/' + k + '/readiness_history/' + memberKey)).limitToLast(5).once('value').then(function(snap) {
            var val = snap.val();
            if (!val) return;
            var entries = Object.values(val).sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
            if (entries.length < 2) return;
            // Previous score = second-to-last entry
            var prev = entries[entries.length - 2].score || 0;
            var delta = currentScore - prev;
            if (delta === 0) return; // no change to report
            var trendEl = (_sdContainer || document).querySelector('#sd-trend-msg');
            if (!trendEl) return;
            // Append delta badge
            var deltaHTML = delta > 0
                ? ' <span style="font-size:0.85em;color:#22c55e;font-weight:700">\u2191+' + delta + '</span>'
                : ' <span style="font-size:0.85em;color:#f59e0b;font-weight:700">\u2193' + delta + '</span>';
            trendEl.innerHTML = trendEl.innerHTML + deltaHTML;
        });
    } catch(e) {}
}

function _sdSectionDots(sectionRatings) {
    if (!sectionRatings||!Object.keys(sectionRatings).length) return '';
    var dots = Object.entries(sectionRatings).map(function(entry) {
        var secName=entry[0], ratings=entry[1];
        var vals=Object.values(ratings||{}).filter(function(v){return typeof v==='number';});
        if (!vals.length) return '';
        var avg=vals.reduce(function(a,b){return a+b;},0)/vals.length;
        var color=avg>=4?'#10b981':avg>=2.5?'#f59e0b':'#ef4444';
        return '<span class="sd-section-dot" style="background:'+color+'20;border:1px solid '+color+'40" title="'+_sdEsc(secName)+': '+avg.toFixed(1)+'/5">'+
               '<span style="width:7px;height:7px;border-radius:50%;background:'+color+';display:inline-block;flex-shrink:0"></span>'+
               '<span style="font-size:0.72em;font-weight:700;color:var(--text)">'+_sdEsc(secName)+'</span>'+
               '</span>';
    }).filter(Boolean).join('');
    return dots?'<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)"><div style="display:flex;flex-wrap:wrap;gap:5px">'+dots+'</div></div>':'';
}

function _sdRenderCribNotes(tabs) {
    // personal_tabs is array of {url, label, notes, memberKey, addedBy}
    var arr = Array.isArray(tabs) ? tabs : (tabs ? Object.values(tabs) : []);
    if (!arr.length) return '<div style="color:var(--text-dim);font-size:0.8em;opacity:0.6">No crib notes yet · <span style="color:var(--accent-light);cursor:pointer" onclick="if(typeof showAddCribNote===\'function\')showAddCribNote()">Add note</span></div>';
    var memberEmoji = {drew:'🎸',chris:'🎸',brian:'🎸',pierce:'🎹',jay:'🥁'};
    // Group by memberKey
    var byMember = {};
    arr.forEach(function(tab) {
        var k = tab.memberKey || tab.addedBy || 'unknown';
        if (!byMember[k]) byMember[k] = [];
        byMember[k].push(tab);
    });
    var html = Object.entries(byMember).map(function(e) {
        var member = e[0], memberTabs = e[1];
        var em = memberEmoji[member] || '👤';
        var name = member.charAt(0).toUpperCase() + member.slice(1);
        var links = memberTabs.map(function(t) {
            var label = t.label || t.notes || t.url || '';
            var note = (t.label && t.notes) ? t.notes : '';
            return '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;margin-left:20px">' +
                   (t.url ? '<a href="' + _sdEsc(t.url) + '" target="_blank" style="color:var(--accent-light);font-size:0.78em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + _sdEsc(label) + '</a>'
                           : '<span style="color:var(--text);font-size:0.78em;flex:1">' + _sdEsc(label) + '</span>') +
                   (note ? '<span style="color:var(--text-dim);font-size:0.65em">' + _sdEsc(note) + '</span>' : '') +
                   '</div>';
        }).join('');
        return '<div style="margin-bottom:8px">' +
               '<span style="font-size:0.8em;font-weight:700;color:var(--text-muted)">' + em + ' ' + name + '</span>' +
               links + '</div>';
    }).join('');
    return html || '<div style="color:var(--text-dim);font-size:0.85em">No crib notes yet.</div>';
}

function _sdRenderRehearsalNotes(notesData) {
    if (!notesData) return '<div style="color:var(--text-dim);font-size:0.85em">No rehearsal notes yet · Add after next rehearsal</div>';
    var notes=Array.isArray(notesData)?notesData:Object.values(notesData||{});
    if (!notes.length) return '<div style="color:var(--text-dim);font-size:0.85em">No rehearsal notes yet · Add after next rehearsal</div>';
    return notes.slice(-5).reverse().map(function(n) {
        if (!n) return '';
        var text=typeof n==='string'?n:(n.note||n.text||'');
        var author=n.author||n.by||'', date=n.date?n.date.slice(0,10):'';
        return '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
               '<div style="font-size:0.85em;color:var(--text);line-height:1.5">'+_sdEsc(text)+'</div>'+
               ((author||date)?'<div style="font-size:0.72em;color:var(--text-dim);margin-top:3px">'+
               (author?_sdEsc(author)+' ':'')+(date?'· '+date:'')+'</div>':'')+'</div>';
    }).join('');
}

// ── First Run-Through Card (for newly-added Prospect songs) ──────────────────

function _sdRenderFirstRunCard(title, status) {
    if (status !== 'prospect') return '';
    // Only show if song has no readiness data (never been run through)
    var scores = (typeof GLStore !== 'undefined' && GLStore.getReadiness) ? (GLStore.getReadiness(title) || {}) : {};
    var hasRating = Object.values(scores).some(function(v) { return typeof v === 'number' && v > 0; });
    if (hasRating) {
        // Song has been rated — offer transition to Learning
        return '<div class="sd-card" style="padding:10px 14px;border:1px solid rgba(34,197,94,0.15);background:rgba(34,197,94,0.04)">'
            + '<div style="font-size:0.82em;color:var(--text)">✅ First run captured — this is now a working song.</div>'
            + '<button onclick="sdUpdateSongStatus(\'learning\');this.closest(\'.sd-card\').innerHTML=\'<div style=color:#22c55e;font-size:0.82em;padding:6px>Locked in as Learning</div>\'" '
            + 'style="margin-top:6px;font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac;min-height:36px">'
            + '📖 Lock this in as a learning song</button></div>';
    }
    // No ratings yet — prompt first run-through
    return '<div class="sd-card" style="padding:10px 14px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.04)">'
        + '<div style="font-size:0.82em;color:var(--text);font-weight:600">🎯 First run-through recommended</div>'
        + '<div style="font-size:0.72em;color:var(--text-dim);margin-top:4px">Focus on getting through the structure — don\'t worry about polish yet. Play it once and rate it so the band can start tracking progress.</div>'
        + '</div>';
}

// ── Practice Attention Card (Milestone 5 Phase 4) ────────────────────────────

function _sdRenderAttentionCard(title, safeSong) {
    if (typeof GLStore === 'undefined' || !GLStore.getPracticeAttention) return '';
    var all = GLStore.getPracticeAttention({ limit: 50 });
    if (!all || !all.length) return '';
    var item = null;
    for (var i = 0; i < all.length; i++) {
        if (all[i].songId === title) { item = all[i]; break; }
    }
    if (!item) return '';

    // Urgency tier
    var urgColor = '#22c55e';
    var urgLabel = 'Keep Warm';
    if (item.score >= 20) { urgColor = '#ef4444'; urgLabel = 'Needs Work'; }
    else if (item.score >= 12) { urgColor = '#f59e0b'; urgLabel = 'Attention'; }

    // Confidence
    var confText = '';
    if (item.confidence === 'needs-rating') confText = 'Needs rating — score your readiness to unlock full insights';
    else if (item.confidence === 'partial') confText = 'Partial data — some members haven\'t rated yet';

    // Breakdown reasons (top 3)
    var reasonsHTML = item.reasons.slice(0, 3).map(function(r) {
        return '<div style="display:flex;align-items:baseline;gap:6px;padding:2px 0">'
            + '<span style="color:' + urgColor + ';font-size:0.8em">•</span>'
            + '<span style="font-size:0.82em;color:var(--text,#f1f5f9)">' + _sdEsc(r) + '</span>'
            + '</div>';
    }).join('');

    // Context-sensitive actions
    var actions = [];
    var b = item.breakdown;
    if (b.decayRisk >= 4) {
        actions.push('<button onclick="openRehearsalMode(\'' + safeSong + '\')" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#818cf8;font-size:0.78em;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer">📖 Practice Mode</button>');
    }
    if (b.readinessDeficit >= 4 || item.confidence !== 'rated') {
        actions.push('<button onclick="var el=(_sdContainer||document).querySelector(\'#sd-readiness-card\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'center\'})" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;font-size:0.78em;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer">🔗 Update Readiness</button>');
    }
    if (b.exposureBoost >= 8) {
        actions.push('<button onclick="showPage(\'setlists\')" style="background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);color:#fbbf24;font-size:0.78em;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer">📋 View Setlist</button>');
    }
    // Fallback: always show at least one action
    if (!actions.length) {
        actions.push('<button onclick="var el=(_sdContainer||document).querySelector(\'#sd-readiness-card\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'center\'})" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;font-size:0.78em;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer">🔗 Update Readiness</button>');
    }

    return '<div class="sd-card" style="padding:10px 14px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
        + '<div style="display:flex;align-items:center;gap:4px"><div class="sd-card-title" style="margin:0">🎯 Practice Attention</div>'
        + (typeof glInlineHelp !== 'undefined' ? glInlineHelp.renderHelpTrigger('practice-attention') : '') + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + '<span style="font-size:0.72em;font-weight:700;padding:2px 8px;border-radius:10px;background:' + urgColor + '18;color:' + urgColor + ';border:1px solid ' + urgColor + '33">' + urgLabel + '</span>'
        + '<span style="font-size:0.88em;font-weight:800;color:' + urgColor + '">' + item.score + '</span>'
        + '</div>'
        + '</div>'
        + (confText ? '<div style="font-size:0.75em;color:var(--text-dim,#475569);margin-bottom:8px">' + confText + '</div>' : '')
        + reasonsHTML
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' + actions.join('') + '</div>'
        + '</div>';
}

// ── Gaps Card (Milestone 3 Phase B) ──────────────────────────────────────────
function _sdRenderGapsCard(gaps) {
    if (!gaps || !gaps.length) return '';
    var high = gaps.filter(function(g) { return g.severity === 'high'; });
    if (!high.length) return '';
    var medCount = gaps.filter(function(g) { return g.severity === 'medium'; }).length;
    var rows = high.map(function(g) {
        return '<div style="display:flex;align-items:baseline;gap:6px;padding:3px 0">'
            + '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;margin-top:3px"></span>'
            + '<span style="font-size:0.82em;color:var(--text,#f1f5f9)">' + _sdEsc(g.detail) + '</span>'
            + '</div>';
    }).join('');
    var medLine = medCount > 0
        ? '<div style="font-size:0.72em;color:var(--text-dim,#475569);margin-top:4px;padding-left:13px">'
            + medCount + ' unrated member' + (medCount > 1 ? 's' : '') + '</div>'
        : '';
    return '<div class="sd-card" style="padding:10px 14px">'
        + '<div class="sd-card-title" style="margin-bottom:6px">⚠ Gaps</div>'
        + rows + medLine + '</div>';
}

window._sdAnonMode = false;
window.sdToggleAnon = function(checked) {
    window._sdAnonMode = checked;
    // Re-render readiness block with new mode
    if (!_sdCurrentSong) return;
    var container = (_sdContainer || document).querySelector('#sd-readiness-card');
    if (!container) return;
    var safeSong = _sdCurrentSong.replace(/'/g, "\\'");
    // Replace just the readiness content (keep the header)
    var inner = container.querySelector('.sd-readiness-inner');
    if (inner) inner.innerHTML = _sdRenderReadinessInner(_sdCurrentSong, safeSong);
};

function _sdRenderReadinessInner(title, safeSong) {
    var songScores=(typeof GLStore!=='undefined'&&GLStore.getReadiness)?(GLStore.getReadiness(title)||{}):{};
    var members=(typeof BAND_MEMBERS_ORDERED!=='undefined')?BAND_MEMBERS_ORDERED:[];
    var myKey=typeof getCurrentMemberKey==='function'?getCurrentMemberKey():null;
    if (!members.length) return '<div style="color:var(--text-dim);font-size:0.85em">Loading…</div>';
    var isAnon = window._sdAnonMode;
    return members.map(function(m, idx) {
        var key=m.key||m, name=m.name||(key.charAt(0).toUpperCase()+key.slice(1));
        var score=songScores[key]||0, pct=score?Math.round((score/5)*100):0;
        var color=score>=4?'#10b981':score>=3?'#f59e0b':score>0?'#ef4444':'rgba(255,255,255,0.1)';
        var isMe=myKey&&key===myKey;
        var displayName = isAnon && !isMe ? 'Member ' + (idx + 1) : name;
        var barId='sd-bar-'+key, lblId='sd-lbl-'+key;
        var RDEFS=['🔴 Never played','🟠 Learning','🟡 Rough','🟢 Getting there','🔵 Tight','⭐ Gig ready'];
        var tipTitle=RDEFS[score]||'Not rated — slide to set';
        var slider=isMe?'<input type="range" name="readiness-learn-'+key+'" min="0" max="5" step="1" value="'+(score!=null&&score!==''?score:0)+'" '+
                        'style="width:80px;accent-color:var(--accent)" '+
                        'title="'+tipTitle+'" '+
                        'oninput="(function(el){var v=parseInt(el.value,10);var defs=[\'🔴 Never played\',\'🟠 Learning\',\'🟡 Rough\',\'🟢 Getting there\',\'🔵 Tight\',\'⭐ Gig ready\'];var c=v>=4?\'#10b981\':v>=3?\'#f59e0b\':v>0?\'#ef4444\':\'rgba(255,255,255,0.1)\';var pct=v?Math.round((v/5)*100):0;var bar=document.getElementById(\''+barId+'\');var lbl=document.getElementById(\''+lblId+'\');if(bar){bar.style.width=pct+\'%\';bar.style.background=c;}if(lbl){lbl.textContent=v||(\'—\');lbl.style.color=c;}el.title=defs[v]||(\'Not rated\');})(this)" '+
                        'onchange="sdSaveReadiness(\''+safeSong+'\',\''+key+'\',this.value)">':'';
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0">'+
               '<span style="font-size:0.82em;font-weight:'+(isMe?'800':'600')+';color:var(--text);min-width:52px">'+_sdEsc(displayName)+'</span>'+
               '<div style="flex:1;height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden">'+
               '<div id="'+barId+'" style="height:100%;width:'+pct+'%;background:'+color+';border-radius:3px;transition:width 0.4s ease"></div></div>'+
               '<span id="'+lblId+'" style="font-size:0.78em;font-weight:700;color:'+color+';min-width:22px;text-align:right">'+(score||'—')+'</span>'+
               slider+'</div>';
    }).join('');
}

function _sdRenderReadinessBlock(title, safeSong) {
    return '<div class="sd-readiness-inner">' + _sdRenderReadinessInner(title, safeSong) + '</div>';
}

function _sdBuildReadinessStrip(title) {
    var strip=(_sdContainer||document).querySelector('#sd-readiness-strip');
    if (!strip) return;
    var songScores=(typeof GLStore!=='undefined'&&GLStore.getReadiness)?(GLStore.getReadiness(title)||{}):{};
    var members=(typeof BAND_MEMBERS_ORDERED!=='undefined')?BAND_MEMBERS_ORDERED:[];
    var pills=members.map(function(m){
        var key=m.key||m, name=m.name||(key.charAt(0).toUpperCase()+key.slice(1));
        var score=songScores[key];
        var color=score?(score>=4?'#10b981':score>=3?'#f59e0b':'#ef4444'):'rgba(255,255,255,0.1)';
        return '<span class="sd-readiness-pill" style="background:'+color+'" title="'+_sdEsc(name)+'">'+
               (function(n){var p=n.trim().split(/\s+/);return p.length>1?p[0].charAt(0)+p[p.length-1].charAt(0):p[0].charAt(0);})(name)+':'+(score||'—')+'</span>';
    }).join('');
    // DNA bar is rendered in the header via _sdBuildDnaBar — not duplicated here
    strip.innerHTML='<div class="sd-readiness-pills">'+pills+'</div>';
}

// ── DNA update handlers ───────────────────────────────────────────────────────
// Delegate all writes to canonical app.js functions so data shape and paths stay consistent
window.sdUpdateLeadSinger = function(v) {
    if (!_sdCurrentSong) return;
    if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
        GLStore.updateSongField(_sdCurrentSong, 'leadSinger', v);
    } else if (typeof saveBandDataToDrive === 'function') {
        saveBandDataToDrive(_sdCurrentSong, 'lead_singer', { singer: v });
        if (typeof showToast === 'function') showToast('Lead singer saved');
    }
    // Sync in-memory allSongs cache so cleanup filter updates immediately
    var song = (typeof allSongs !== 'undefined') ? allSongs.find(function(s){ return s.title === _sdCurrentSong; }) : null;
    if (song) song.lead = v;
    // Re-render song list to update filter counts
    if (typeof renderSongs === 'function') requestAnimationFrame(function(){ renderSongs(); });
};
window.sdUpdateSongStatus = function(v) {
    if (!_sdCurrentSong) return;
    if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
        GLStore.updateSongField(_sdCurrentSong, 'status', v);
    } else if (typeof saveBandDataToDrive === 'function') {
        saveBandDataToDrive(_sdCurrentSong, 'song_status', { status: v, updatedAt: new Date().toISOString() });
    }
    // Sync canonical status cache via GLStore (emits event bus notification)
    if (typeof GLStore !== 'undefined' && GLStore.setStatus) {
        GLStore.setStatus(_sdCurrentSong, v);
    }
    if (typeof GLStore !== 'undefined' && GLStore.getStatus && typeof saveMasterFile === 'function') {
        // Master file persist uses the full status cache from GLStore
        var _allStatuses = (typeof statusCache !== 'undefined') ? statusCache : {};
        saveMasterFile('_master_song_statuses.json', _allStatuses).catch(function(){});
    }
    // Re-render song list to update filter counts
    if (typeof renderSongs === 'function') requestAnimationFrame(function(){ renderSongs(); });
};
window.sdUpdateSongKey = function(v) {
    if (!_sdCurrentSong) return;
    // Route through GLStore for canonical persistence + cache invalidation
    if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
        GLStore.updateSongField(_sdCurrentSong, 'key', v);
    } else if (typeof saveBandDataToDrive === 'function') {
        saveBandDataToDrive(_sdCurrentSong, 'key', { key: v, updatedAt: new Date().toISOString() });
    }
    // Sync in-memory allSongs cache
    _sdSyncAllSongsField(_sdCurrentSong, 'key', v);
    // Sync topbar select if present
    var topSel = document.getElementById('songKeySelect');
    if (topSel) topSel.value = v || '';
    // Re-render song list to update filter counts
    if (typeof renderSongs === 'function') requestAnimationFrame(function(){ renderSongs(); });
};
window.sdUpdateSongBpm = function(v) {
    if (!_sdCurrentSong) return;
    var n = parseInt(v, 10);
    if (isNaN(n) || n < 20 || n > 320) return;
    // Route through GLStore for canonical persistence + cache invalidation
    if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
        GLStore.updateSongField(_sdCurrentSong, 'bpm', n);
    } else if (typeof saveBandDataToDrive === 'function') {
        saveBandDataToDrive(_sdCurrentSong, 'song_bpm', { bpm: n, updatedAt: new Date().toISOString() });
    }
    // Sync in-memory allSongs cache
    _sdSyncAllSongsField(_sdCurrentSong, 'bpm', n);
    // Sync topbar input if present
    var topInp = document.getElementById('songBpmInput');
    if (topInp) topInp.value = n;
    // Re-render song list to update filter counts
    if (typeof renderSongs === 'function') requestAnimationFrame(function(){ renderSongs(); });
};
// Sync allSongs in-memory cache when a field is updated
function _sdSyncAllSongsField(title, field, value) {
    if (typeof allSongs === 'undefined') return;
    var idx = allSongs.findIndex(function(s) { return s.title === title; });
    if (idx >= 0) allSongs[idx][field] = value;
}
// ── Attribution per DNA field ─────────────────────────────────────────────────
function _sdTimeAgo(iso) {
    if (!iso) return '';
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
}
function _sdLoadAttribution(title) {
    if (typeof GLStore === 'undefined' || !GLStore.loadFieldMeta) return;
    var fields = [
        { dataType: 'lead_singer', elId: 'sd-attr-lead', nameKey: 'updatedBy' },
        { dataType: 'song_status', elId: 'sd-attr-status', nameKey: 'updatedBy' },
        { dataType: 'key',         elId: 'sd-attr-key',    nameKey: 'updatedBy' },
        { dataType: 'song_bpm',    elId: 'sd-attr-bpm',    nameKey: 'updatedBy' }
    ];
    fields.forEach(function(f) {
        GLStore.loadFieldMeta(title, f.dataType).then(function(data) {
            var el = (_sdContainer || document).querySelector('#' + f.elId);
            if (!el || !data || !data[f.nameKey]) return;
            var who = data[f.nameKey];
            // Resolve display name from bandMembers
            var displayName = who;
            if (typeof bandMembers !== 'undefined' && bandMembers[who]) displayName = bandMembers[who].name || who;
            el.textContent = 'by ' + displayName + ' \u00B7 ' + _sdTimeAgo(data.updatedAt);
        }).catch(function() {});
    });
}

// ── Song Assets (progressive disclosure) ──────────────────────────────────────
function _sdLoadAssets(title) {
    var el = (_sdContainer || document).querySelector('#sd-assets');
    if (!el) return;
    var items = [];
    var _safeSong = title.replace(/'/g, "\\'");
    var _pillPresent = function(icon, label) { return '<span style="padding:3px 8px;border-radius:6px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);color:#22c55e;font-weight:600">' + icon + ' ' + label + '</span>'; };
    var _pillMissing = function(icon, label, action) { return '<span style="padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:var(--text-dim);cursor:pointer" onclick="' + action + '" title="Click to add">' + icon + ' Add ' + label + '</span>'; };
    // Check North Star
    var nsc = (typeof northStarCache !== 'undefined') ? northStarCache : {};
    items.push(nsc[title]
        ? _pillPresent('⭐', 'North Star')
        : _pillMissing('⭐', 'North Star', "selectSong('" + _safeSong + "')"));
    // Check Harmonies
    var hbc = (typeof harmonyBadgeCache !== 'undefined') ? harmonyBadgeCache : {};
    var hc = (typeof harmonyCache !== 'undefined') ? harmonyCache : {};
    items.push((hbc[title] || hc[title])
        ? _pillPresent('🎤', 'Harmonies')
        : _pillMissing('🎤', 'Harmonies', "selectSong('" + _safeSong + "')"));
    // Check Chart (from detail cache) — with versioning info
    var dc = (typeof GLStore !== 'undefined' && GLStore._getDetailCache) ? GLStore._getDetailCache(title) : null;
    var hasChart = dc && dc.chart && dc.chart.text;
    var chartMeta = '';
    if (hasChart && dc.chart.importedAt) {
        chartMeta = ' · ' + _sdTimeAgo(dc.chart.importedAt);
    }
    items.push(hasChart
        ? '<span style="padding:3px 8px;border-radius:6px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);color:#fbbf24;font-weight:600">📖 Chart' + chartMeta + '</span>'
        : _pillMissing('📖', 'Chart', "sdShowGetChartModal('" + _safeSong + "')"));
    // Key/BPM live in Song DNA — not shown here
    el.innerHTML = items.join('');
}

// ── Get Chart Modal ──────────────────────────────────────────────────────────
window.sdShowGetChartModal = function(title) {
    var existing = document.getElementById('sdGetChartModal');
    if (existing) existing.remove();
    var safeSong = title.replace(/'/g, "\\'");
    var _songRec = (typeof allSongs !== 'undefined') ? (allSongs.find(function(s) { return s.title === title; }) || {}) : {};
    var _bandAbbr = _songRec.band || '';
    var _bandFull = (typeof getFullBandName === 'function') ? getFullBandName(_bandAbbr) : _bandAbbr;
    // For custom songs filed under "Other", the dropdown can't represent the
    // real artist (e.g. "moe."). Prefer the song's `artist` field, then notes,
    // then fall back to the band code so the UG search isn't literally "Other".
    if (_bandFull === 'Other') {
        var _artistField = (_songRec.artist && _songRec.artist !== 'Other') ? _songRec.artist : '';
        var _notesField = (_songRec.notes || '').trim();
        _bandFull = _artistField || _notesField || '';
    }
    var ugQuery = encodeURIComponent((title + ' ' + _bandFull).trim());
    var modal = document.createElement('div');
    modal.id = 'sdGetChartModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.1));border-radius:14px;padding:24px;max-width:480px;width:100%;color:var(--text,#f1f5f9)">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<h3 style="margin:0;font-size:1em;color:var(--accent-light)">📖 Get a Chart</h3>'
        + '<button onclick="document.getElementById(\'sdGetChartModal\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>'
        + '</div>'
        + '<div style="font-size:0.85em;color:var(--text-muted);margin-bottom:16px">Find a chart for <strong>' + _sdEsc(title) + '</strong> and paste it here.</div>'
        + '<div style="margin-bottom:14px">'
        + '<button onclick="window.open(\'https://www.ultimate-guitar.com/search.php?search_type=title&value=' + ugQuery + '\',\'_blank\')" style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);color:#fbbf24;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85em;width:100%;text-align:center">Open Ultimate Guitar →</button>'
        + '<div style="font-size:0.72em;color:var(--text-dim);margin-top:6px;text-align:center">We\'ll open a new tab. Copy the chart text and come back here.</div>'
        + '</div>'
        + '<div style="margin-bottom:12px">'
        + '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Paste chart text or URL</label>'
        + '<textarea id="sdChartPasteInput" placeholder="Paste chord chart here..." style="width:100%;height:120px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:8px;font-size:0.85em;font-family:monospace;resize:vertical;box-sizing:border-box"></textarea>'
        + '</div>'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="sdSaveChartFromModal(\'' + safeSong + '\')" style="flex:1;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:8px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85em">Save Chart</button>'
        + '<button onclick="document.getElementById(\'sdGetChartModal\').remove()" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text-dim);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.85em">Cancel</button>'
        + '</div></div>';
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};

window.sdSaveChartFromModal = function(title) {
    var input = document.getElementById('sdChartPasteInput');
    if (!input || !input.value.trim()) { alert('Please paste a chart first'); return; }
    var chartText = input.value.trim();
    if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
        GLStore.saveSongData(title, 'chart', { text: chartText, importedAt: new Date().toISOString() });
    }
    document.getElementById('sdGetChartModal').remove();
    if (typeof showToast === 'function') showToast('Chart saved for ' + title);
    // Refresh song detail if currently viewing this song
    if (_sdCurrentSong === title && typeof renderSongDetail === 'function') {
        var container = _sdContainer || document.getElementById('page-songdetail');
        if (container) renderSongDetail(title, container);
    }
};

// ── Jam Structure ────────────────────────────────────────────────────────────
// ── Section type taxonomy ────────────────────────────────────────────────────
var _sdSectionTypes = [
    'intro','verse','pre_chorus','chorus','post_chorus','bridge','refrain',
    'interlude','solo','break','turnaround','breakdown','build','drop',
    'jam','vamp','tag','outro','ending','head','skit','other'
];
var _sdTypeIcons = {intro:'🎬',verse:'📝',chorus:'🎶',solo:'🎸',jam:'🌀',bridge:'🌉',outro:'🔚',ending:'🔚',breakdown:'💥',build:'📈',drop:'📉',vamp:'🔁',tag:'🏷',interlude:'🎵',turnaround:'↩️',other:'·'};
var _sdIntroTypes = ['count_in','cold_start','riff','drum_intro','vamp','build','acappella','noise'];
var _sdEndingTypes = ['hard_stop','big_rock','cacophony','fade','tag','stinger','ritardando','vamp','subtraction','false_end','cadence'];

// Infer type from label text
function _sdInferType(label) {
    if (!label) return 'other';
    var l = label.toLowerCase().trim();
    if (/^intro/i.test(l)) return 'intro';
    if (/^(verse|v\d)/i.test(l)) return 'verse';
    if (/pre.?chorus/i.test(l)) return 'pre_chorus';
    if (/^chorus/i.test(l)) return 'chorus';
    if (/post.?chorus/i.test(l)) return 'post_chorus';
    if (/^(bridge|middle.?eight)/i.test(l)) return 'bridge';
    if (/^(solo|guitar solo|keys solo|bass solo|drum solo)/i.test(l)) return 'solo';
    if (/^(jam|space|improv)/i.test(l)) return 'jam';
    if (/^(break|instrumental)/i.test(l)) return 'interlude';
    if (/^(breakdown|drop)/i.test(l)) return 'breakdown';
    if (/^(build)/i.test(l)) return 'build';
    if (/^(vamp)/i.test(l)) return 'vamp';
    if (/^(tag)/i.test(l)) return 'tag';
    if (/^(turnaround|ta\b)/i.test(l)) return 'turnaround';
    if (/^(outro|ending|end|coda)/i.test(l)) return 'outro';
    if (/^(head)/i.test(l)) return 'head';
    if (/^(refrain)/i.test(l)) return 'refrain';
    return 'other';
}

// Extract instrument from solo-type labels (e.g. "Guitar Solo" → "Guitar")
function _sdInferInstrument(label, type) {
    if (type !== 'solo' && type !== 'jam') return null;
    var m = (label || '').match(/^(guitar|keys|keyboard|bass|drum|sax|trumpet|harmonica|organ|piano|vocal)\s/i);
    return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : null;
}

// Generate stable section ID
function _sdGenSectionId() { return 'sec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

// Ensure section has all required fields (backward-compat upgrade)
function _sdNormalizeSection(s, i) {
    return {
        id: s.id || _sdGenSectionId(),
        type: s.type || _sdInferType(s.label || s.name),
        label: s.label || s.name || ('Section ' + (i + 1)),
        instrument: s.instrument || null,
        role: s.role || null,
        themeGroup: s.themeGroup || null,
        chartAnchor: s.chartAnchor || null,
        anchorIndex: (typeof s.anchorIndex === 'number') ? s.anchorIndex : 0,
        notes: s.notes || '',
        starter: s.starter || null,
        feel: s.feel || null,
        soloOrder: s.soloOrder || null,
        dynamics: s.dynamics || null,
        stopCue: s.stopCue || null,
        endCue: s.endCue || null,
        introType: s.introType || null,
        endingType: s.endingType || null
    };
}

// Auto-derive sections from chart text headers
window.deriveStructureFromChart = _sdDeriveFromChart;
function _sdDeriveFromChart(chartText) {
    if (!chartText) return [];
    var re = /^\[(.+?)\]\s*$/gm;
    var match, sections = [], seen = {};
    while ((match = re.exec(chartText)) !== null) {
        var label = match[1].trim();
        var anchor = label;
        var idx = seen[anchor] || 0;
        seen[anchor] = idx + 1;
        var type = _sdInferType(label);
        sections.push({
            id: _sdGenSectionId(),
            type: type,
            label: label,
            instrument: _sdInferInstrument(label, type),
            chartAnchor: anchor,
            anchorIndex: idx,
            notes: '', starter: null, feel: null, soloOrder: null,
            dynamics: null, stopCue: null, endCue: null,
            introType: null, endingType: null, role: null, themeGroup: null
        });
    }
    return sections;
}

// ── Display ──────────────────────────────────────────────────────────────────

function _sdLoadStructure(title) {
    var el = (_sdContainer || document).querySelector('#sd-structure');
    if (!el) return;
    if (typeof GLStore !== 'undefined' && GLStore.loadFieldMeta) {
        GLStore.loadFieldMeta(title, 'song_structure').then(function(data) {
            if (!data || !data.sections || !data.sections.length) {
                // Try auto-derive from chart
                var chartData = null;
                GLStore.loadFieldMeta(title, 'chart').then(function(cd) {
                    chartData = cd;
                    var derived = _sdDeriveFromChart(cd && cd.text ? cd.text : '');
                    if (derived.length > 0) {
                        el.innerHTML = '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:4px">Auto-detected from chart:</div>'
                            + _sdRenderStructureSummary(derived)
                            + '<div style="margin-top:6px"><button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px" onclick="sdSaveAutoStructure(\'' + title.replace(/'/g, "\\'") + '\')">Use This</button>'
                            + ' <button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px" onclick="sdEditStructure(\'' + title.replace(/'/g, "\\'") + '\')">Edit</button></div>';
                        window._sdAutoSections = derived;
                    } else {
                        el.innerHTML = '<span style="color:var(--text-dim);opacity:0.5">No structure defined — <span style="color:var(--accent-light);cursor:pointer" onclick="sdEditStructure(\'' + title.replace(/'/g, "\\'") + '\')">click Edit</span> to add how your band plays this song</span>';
                    }
                }).catch(function() {
                    el.innerHTML = '<span style="color:var(--text-dim);opacity:0.5">No structure defined — click Edit to add</span>';
                });
                return;
            }
            var sections = data.sections.map(_sdNormalizeSection);
            el.innerHTML = _sdRenderStructureSummary(sections);
        }).catch(function() {
            el.innerHTML = '<span style="color:var(--text-dim);opacity:0.5">No structure defined yet</span>';
        });
    }
}

// Save auto-derived sections
window.sdSaveAutoStructure = function(title) {
    if (!window._sdAutoSections || !window._sdAutoSections.length) return;
    if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
        var who = (typeof getCurrentMemberKey === 'function' && getCurrentMemberKey()) || 'unknown';
        GLStore.saveSongData(title, 'song_structure', { sections: window._sdAutoSections, updatedBy: who, updatedAt: new Date().toISOString() });
    }
    if (typeof showToast === 'function') showToast('Structure saved from chart');
    _sdLoadStructure(title);
};

// Render read-only summary of sections with band notes
function _sdRenderStructureSummary(sections) {
    return sections.map(function(s, i) {
        var icon = _sdTypeIcons[s.type] || _sdTypeIcons.other;
        var label = s.label || ('Section ' + (i + 1));
        // Build band notes line
        var details = [];
        if (s.starter) details.push(s.starter + ' starts');
        if (s.feel) details.push(s.feel);
        if (s.soloOrder && s.soloOrder.length) details.push(s.soloOrder.join(' → '));
        if (s.instrument && !s.soloOrder) details.push(s.instrument);
        if (s.dynamics) details.push(s.dynamics);
        if (s.stopCue) details.push('Stop: ' + s.stopCue);
        if (s.endCue) details.push(s.endCue);
        if (s.introType) details.push(s.introType.replace(/_/g, ' '));
        if (s.endingType) details.push(s.endingType.replace(/_/g, ' '));
        if (s.notes && !details.length) details.push(s.notes);
        var detailStr = details.length
            ? ' <span style="color:var(--text-muted);font-size:0.88em">— ' + details.map(_sdEsc).join(' · ') + '</span>'
            : (s.notes ? ' <span style="color:var(--text-muted);font-size:0.88em">— ' + _sdEsc(s.notes) + '</span>' : '');
        return '<div style="padding:2px 0;display:flex;align-items:baseline;gap:4px">'
            + '<span style="font-size:0.75em;min-width:16px">' + icon + '</span>'
            + '<strong style="font-size:0.88em">' + _sdEsc(label) + '</strong>' + detailStr + '</div>';
    }).join('');
}

// ── Editor ───────────────────────────────────────────────────────────────────

window.sdEditStructure = function(title) {
    var el = (_sdContainer || document).querySelector('#sd-structure');
    if (!el) return;
    var defaultSections = [
        { label: 'Intro', type: 'intro' },
        { label: 'Verse 1', type: 'verse' },
        { label: 'Chorus', type: 'chorus' },
        { label: 'Verse 2', type: 'verse' },
        { label: 'Chorus', type: 'chorus' },
        { label: 'Bridge', type: 'bridge' },
        { label: 'Solo', type: 'solo', notes: 'e.g. 1 solo, 16 bars' },
        { label: 'Chorus', type: 'chorus' },
        { label: 'Breakdown', type: 'breakdown' },
        { label: 'Outro', type: 'outro' },
        { label: 'End Cue', type: 'ending', notes: 'e.g. big finish on 1' }
    ].map(_sdNormalizeSection);
    if (typeof GLStore !== 'undefined' && GLStore.loadFieldMeta) {
        GLStore.loadFieldMeta(title, 'song_structure').then(function(data) {
            var sections = (data && data.sections && data.sections.length) ? data.sections.map(_sdNormalizeSection) : defaultSections;
            _sdRenderStructureEditor(el, title, sections);
        }).catch(function() {
            _sdRenderStructureEditor(el, title, defaultSections);
        });
    }
};

function _sdRenderStructureEditor(el, title, sections) {
    var safeSong = title.replace(/'/g, "\\'");
    window._sdEditSections = sections;
    window._sdEditTitle = title;

    var typeOpts = _sdSectionTypes.map(function(t) { return '<option value="' + t + '">' + t.replace(/_/g, ' ') + '</option>'; }).join('');

    var html = '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:6px">Define your song structure. Tap a row to expand band notes.</div>';
    html += '<div id="sd-structure-rows">';
    html += sections.map(function(s, i) {
        var isSolo = s.type === 'solo' || s.type === 'jam';
        var isIntro = s.type === 'intro';
        var isEnding = s.type === 'outro' || s.type === 'ending';
        var icon = _sdTypeIcons[s.type] || '·';
        // Compact row — always visible
        var row = '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:6px;margin-bottom:4px;background:rgba(255,255,255,0.02)" data-secrow="' + i + '">'
            + '<div style="display:flex;gap:4px;align-items:center;padding:4px 6px;cursor:pointer" onclick="sdToggleStructureDetail(' + i + ')">'
            + '<span style="font-size:0.8em">' + icon + '</span>'
            + '<input style="width:80px;font-size:0.82em;padding:2px 4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:3px;color:var(--text)" value="' + _sdEsc(s.label || '') + '" data-idx="' + i + '" data-field="label" placeholder="Label" onclick="event.stopPropagation()">'
            + '<select style="width:72px;font-size:0.7em;padding:2px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:3px;color:var(--text-dim)" data-idx="' + i + '" data-field="type" onclick="event.stopPropagation()">' + typeOpts.replace('value="' + s.type + '"', 'value="' + s.type + '" selected') + '</select>'
            + '<input style="flex:1;font-size:0.72em;padding:2px 4px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:3px;color:var(--text-muted)" value="' + _sdEsc(s.notes || '') + '" data-idx="' + i + '" data-field="notes" placeholder="Notes..." onclick="event.stopPropagation()">'
            + '<button onclick="event.stopPropagation();sdRemoveStructureRow(' + i + ')" style="background:none;border:none;color:var(--text-dim);opacity:0.3;cursor:pointer;font-size:0.75em;padding:2px 4px" title="Remove">✕</button>'
            + '</div>';
        // Expandable detail — band notes fields
        row += '<div id="sd-sec-detail-' + i + '" style="display:none;padding:4px 6px 6px 24px;border-top:1px solid rgba(255,255,255,0.04)">'
            + _sdDetailField(i, 'starter', 'Who starts', s.starter)
            + _sdDetailField(i, 'feel', 'Feel / groove', s.feel)
            + (isSolo ? _sdDetailField(i, 'soloOrder', 'Solo order (comma-sep)', (s.soloOrder || []).join(', ')) : '')
            + (isSolo ? _sdDetailField(i, 'instrument', 'Instrument', s.instrument) : '')
            + _sdDetailField(i, 'dynamics', 'Dynamics', s.dynamics)
            + _sdDetailField(i, 'stopCue', 'Stop / hit cue', s.stopCue)
            + _sdDetailField(i, 'endCue', 'End cue', s.endCue)
            + (isIntro ? _sdQuickSelect(i, 'introType', 'Intro type', _sdIntroTypes, s.introType) : '')
            + (isEnding ? _sdQuickSelect(i, 'endingType', 'Ending type', _sdEndingTypes, s.endingType) : '')
            + '</div></div>';
        return row;
    }).join('');
    html += '</div>';
    html += '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'
        + '<button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px" onclick="sdAddStructureRow()">+ Add Section</button>'
        + '<button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px" onclick="sdDeriveFromChart(\'' + safeSong + '\')">↻ From Chart</button>'
        + '<button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px;background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.3);color:#86efac" onclick="sdSaveStructure(\'' + safeSong + '\')">Save</button>'
        + '<button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px" onclick="_sdLoadStructure(\'' + safeSong + '\')">Cancel</button>'
        + '</div>';
    el.innerHTML = html;
}

function _sdDetailField(idx, field, placeholder, value) {
    return '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px">'
        + '<span style="font-size:0.65em;color:var(--text-dim);min-width:60px;text-align:right">' + placeholder + '</span>'
        + '<input style="flex:1;font-size:0.72em;padding:2px 4px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:3px;color:var(--text-muted)" value="' + _sdEsc(value || '') + '" data-idx="' + idx + '" data-field="' + field + '" placeholder="' + placeholder + '">'
        + '</div>';
}

function _sdQuickSelect(idx, field, label, options, current) {
    var pills = options.map(function(opt) {
        var active = current === opt;
        return '<span onclick="sdSetQuickField(' + idx + ',\'' + field + '\',\'' + opt + '\',this)" style="font-size:0.65em;padding:2px 6px;border-radius:3px;cursor:pointer;border:1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (active ? 'rgba(99,102,241,0.12)' : 'none') + ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + '">' + opt.replace(/_/g, ' ') + '</span>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px;flex-wrap:wrap">'
        + '<span style="font-size:0.65em;color:var(--text-dim);min-width:60px;text-align:right">' + label + '</span>'
        + pills + '</div>';
}

window.sdSetQuickField = function(idx, field, value, el) {
    if (!window._sdEditSections || !window._sdEditSections[idx]) return;
    var current = window._sdEditSections[idx][field];
    window._sdEditSections[idx][field] = (current === value) ? null : value; // toggle
    var container = (_sdContainer || document).querySelector('#sd-structure');
    if (container && window._sdEditTitle) _sdRenderStructureEditor(container, window._sdEditTitle, window._sdEditSections);
    // Re-open the same detail panel
    var detail = document.getElementById('sd-sec-detail-' + idx);
    if (detail) detail.style.display = 'block';
};

window.sdToggleStructureDetail = function(idx) {
    var el = document.getElementById('sd-sec-detail-' + idx);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.sdRemoveStructureRow = function(idx) {
    if (!window._sdEditSections) return;
    window._sdEditSections.splice(idx, 1);
    var el = (_sdContainer || document).querySelector('#sd-structure');
    if (el && window._sdEditTitle) _sdRenderStructureEditor(el, window._sdEditTitle, window._sdEditSections);
};

window.sdAddStructureRow = function() {
    if (!window._sdEditSections) window._sdEditSections = [];
    window._sdEditSections.push(_sdNormalizeSection({ label: '', type: 'other' }, window._sdEditSections.length));
    var el = (_sdContainer || document).querySelector('#sd-structure');
    if (el && window._sdEditTitle) _sdRenderStructureEditor(el, window._sdEditTitle, window._sdEditSections);
};

window.sdDeriveFromChart = function(title) {
    if (typeof GLStore === 'undefined' || !GLStore.loadFieldMeta) return;
    GLStore.loadFieldMeta(title, 'chart').then(function(cd) {
        var derived = _sdDeriveFromChart(cd && cd.text ? cd.text : '');
        if (derived.length === 0) { if (typeof showToast === 'function') showToast('No [Section] headers found in chart'); return; }
        window._sdEditSections = derived;
        var el = (_sdContainer || document).querySelector('#sd-structure');
        if (el) _sdRenderStructureEditor(el, title, derived);
        if (typeof showToast === 'function') showToast(derived.length + ' sections detected — review and save');
    });
};

window.sdSaveStructure = function(title) {
    var el = (_sdContainer || document).querySelector('#sd-structure');
    if (!el) return;
    // Read all inputs from the editor
    var sections = window._sdEditSections ? window._sdEditSections.slice() : [];
    var inputs = el.querySelectorAll('input[data-idx],select[data-idx]');
    inputs.forEach(function(inp) {
        var idx = parseInt(inp.dataset.idx, 10);
        if (!sections[idx]) return;
        var field = inp.dataset.field;
        var val = inp.value.trim();
        if (field === 'soloOrder') {
            sections[idx].soloOrder = val ? val.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : null;
        } else if (field === 'label') {
            sections[idx].label = val;
            // Re-infer type if label changed and type is still 'other'
            if (sections[idx].type === 'other' && val) sections[idx].type = _sdInferType(val);
        } else {
            sections[idx][field] = val || null;
        }
    });
    // Remove empty sections (no label)
    sections = sections.filter(function(s) { return s && s.label; });
    // Ensure IDs
    sections.forEach(function(s) { if (!s.id) s.id = _sdGenSectionId(); });
    var who = (typeof getCurrentMemberKey === 'function' && getCurrentMemberKey()) || 'unknown';
    if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
        GLStore.saveSongData(title, 'song_structure', { sections: sections, updatedBy: who, updatedAt: new Date().toISOString() });
    }
    // Sync in-memory flag so cleanup filter updates immediately
    var song = (typeof allSongs !== 'undefined') ? allSongs.find(function(s){ return s.title === title; }) : null;
    if (song && sections.length > 0) song._hasStructure = true;
    if (typeof showToast === 'function') showToast('Structure saved');
    _sdLoadStructure(title);
    // Re-render song list to update filter counts
    if (typeof renderSongs === 'function') requestAnimationFrame(function(){ renderSongs(); });
};

// ── Lifecycle suggestion (advisory) ───────────────────────────────────────────
function _sdShowLifecycleSuggestion(title, currentStatus) {
    var el = (_sdContainer || document).querySelector('#sd-attr-status');
    if (!el) return;
    if (typeof SongIntelligence === 'undefined' || !SongIntelligence.suggestLifecycle) return;
    var _siIntel = (typeof GLStore !== 'undefined' && GLStore.getSongIntelligence) ? GLStore.getSongIntelligence(title) : null;
    var avg = _siIntel ? _siIntel.avg : 0;
    var result = SongIntelligence.suggestLifecycle(title, avg, currentStatus);
    if (!result) return;
    var labels = { rotation: '🔄 In Rotation', learning: '📖 Learning', shelved: '📦 Shelved' };
    var lbl = labels[result.suggestion] || result.suggestion;
    // Append suggestion below existing attribution
    var existing = el.textContent || '';
    el.innerHTML = (existing ? '<span>' + existing + '</span> · ' : '')
        + '<span style="color:#fbbf24;cursor:pointer" title="' + result.reason + '" onclick="sdUpdateSongStatus(\'' + result.suggestion + '\');this.parentElement.innerHTML=\'Applied\'">'
        + 'Suggested: ' + lbl + '</span>';
}

window.sdSaveConfidence = function(songTitle, value) {
    var memberKey = typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : null;
    if (!memberKey || !songTitle) return;
    if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
        GLStore.saveSongData(songTitle, 'confidence', { [memberKey]: value, updatedAt: new Date().toISOString() });
    }
    var el = (_sdContainer || document).querySelector('#sd-confidence-prompt');
    if (el) {
        var labels = { yes: '✅ Yes — ready to play', maybe: '🤔 Maybe — needs a run', no: '⏳ Not yet' };
        el.innerHTML = '<div style="font-size:0.72em;color:#22c55e;font-weight:600">🔒 ' + (labels[value] || 'Saved') + '</div>';
    }
    if (typeof showToast === 'function') showToast('Confidence saved privately');
};

window.sdScrollToReadiness = function() {
    var el = (_sdContainer || document).querySelector('#sd-readiness-card');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    // Fallback: try right panel readiness
    var rp = document.querySelector('#sd-right-info');
    if (rp) rp.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.sdSaveReadiness = function(songTitle, memberKey, val) {
    if (typeof GLStore === 'undefined') { console.warn('[song-detail] GLStore not available'); return; }
    var prevVal = 0;
    try {
        var rc = GLStore.getAllReadiness ? GLStore.getAllReadiness() : {};
        prevVal = (rc[songTitle] || {})[memberKey] || 0;
    } catch(e) {}
    GLStore.saveReadiness(songTitle, memberKey, val).then(function() {
        _sdBuildReadinessStrip(songTitle);
        // Update trend message in Sharpen mode
        var trendEl = (_sdContainer || document).querySelector('.sd-trend');
        if (trendEl) {
            var newTrend = _sdBuildReadinessTrend(songTitle);
            if (newTrend) {
                var tmp = document.createElement('div');
                tmp.innerHTML = newTrend;
                if (tmp.firstChild) { trendEl.replaceWith(tmp.firstChild); }
            }
        }
        // Celebration: reached 5/5
        if (val >= 5 && prevVal < 5) {
            _sdCelebrate(songTitle);
        }
        // Progression: show delta if improved
        if (val > prevVal && prevVal > 0 && val < 5) {
            _sdShowDelta(val - prevVal);
        }
    });
};

function _sdCelebrate(title) {
    var existing = document.getElementById('sd-celebrate');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'sd-celebrate';
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;text-align:center;pointer-events:none;animation:sdCelebFade 2.5s ease forwards';
    el.innerHTML = '<div style="font-size:3em;margin-bottom:8px">\uD83D\uDD25</div>'
        + '<div style="font-size:1.2em;font-weight:800;color:#22c55e;text-shadow:0 0 20px rgba(34,197,94,0.5)">Locked In</div>'
        + '<div style="font-size:0.85em;color:#86efac;margin-top:4px">You\'re gig-ready on ' + _sdEsc(title) + '</div>';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 3000);
}

function _sdShowDelta(delta) {
    var existing = document.getElementById('sd-delta-toast');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.id = 'sd-delta-toast';
    el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:9998;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:8px 18px;border-radius:20px;font-size:0.85em;font-weight:700;pointer-events:none;animation:sdCelebFade 2s ease forwards';
    el.textContent = '\u2191 +' + delta + ' since last time';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 2500);
}

// ── Prospect Voting ──────────────────────────────────────────────────────────
async function _sdRenderProspectVote(title) {
    var el = (_sdContainer||document).querySelector('#sd-prospect-vote');
    if (!el) return;
    var songObj = (typeof GLStore !== 'undefined' && GLStore.getSongByTitle) ? GLStore.getSongByTitle(title) : null;
    var songId = songObj ? songObj.songId : null;
    if (!songId) { el.innerHTML = ''; return; }
    var votes = (typeof GLStore !== 'undefined' && GLStore.getSongVotes) ? await GLStore.getSongVotes(songId) : null;
    var userId = (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'me';
    var myVote = votes ? votes[userId] : null;

    var voteOpts = [
        { val: 'yes', icon: '👍', label: 'Yes', color: '#22c55e' },
        { val: 'maybe', icon: '🤔', label: 'Maybe', color: '#f59e0b' },
        { val: 'no', icon: '👎', label: 'Pass', color: '#ef4444' }
    ];
    var btns = voteOpts.map(function(o) {
        var active = myVote === o.val;
        var count = votes ? Object.values(votes).filter(function(v) { return v === o.val; }).length : 0;
        return '<button onclick="sdVoteProspect(\'' + songId + '\',\'' + o.val + '\')" style="display:flex;align-items:center;gap:4px;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.85em;font-weight:600;border:1px solid ' +
            (active ? o.color : 'rgba(255,255,255,0.1)') + ';background:' + (active ? o.color + '20' : 'rgba(255,255,255,0.03)') +
            ';color:' + (active ? o.color : 'var(--text-muted)') + '">' + o.icon + ' ' + o.label +
            (count > 0 ? ' <span style="font-size:0.75em;opacity:0.7">' + count + '</span>' : '') + '</button>';
    }).join('');
    el.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:wrap">' + btns + '</div>';
}
window.sdVoteProspect = async function(songId, vote) {
    var userId = (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'me';
    if (typeof GLStore !== 'undefined' && GLStore.voteSongProspect) {
        await GLStore.voteSongProspect(songId, userId, vote);
        if (typeof showToast === 'function') showToast('Vote recorded');
        _sdRenderProspectVote(_sdCurrentSong);
    }
};

// ── Listen Lens ───────────────────────────────────────────────────────────────
// ── Stems Lens ──────────────────────────────────────────────────────────────
// Demucs 4-stem separation (drums/bass/vocals/other) via Modal+R2. UI is a
// synced 4-track mixer once stems exist; otherwise a setup card asking for a
// source URL. Audio elements are kept in-DOM and time-synced off the first
// stem (master). Solo is exclusive; mute is per-stem.

async function _sdPopulateStemsLens(title) {
    var panel = (_sdContainer || document).querySelector('.sd-lens-panel[data-lens="stems"]');
    if (!panel) return;
    // If a fullscreen wrap from a prior render is still pinned to <body>,
    // drop it before rebuilding. If the orphan was for the SAME song, this
    // is a re-render (e.g. after a spatial split completes) and we want to
    // re-enter fullscreen post-rebuild so the user doesn't have to re-toggle
    // every time. If the song changed, do not auto-fullscreen.
    var orphan = document.body.querySelector(':scope > .sd-stems-wrap.sd-stems-fullscreen');
    var wasFullscreenSameSong = false;
    if (orphan) {
        if (orphan.dataset.song === title) wasFullscreenSameSong = true;
        document.body.classList.remove('sd-stems-overlay-open');
        orphan.remove();
    }
    // Loop markers + active practice preset are per-song state — reset on
    // every (re-)mount so they don't leak between songs.
    _sdLoop = { inSec: null, outSec: null, enabled: false };
    _sdActivePreset = null;
    // New audio elements coming — abandon any prior WebAudio routing. The
    // old MediaElementSource nodes are dangling but the elements themselves
    // are about to be removed from the DOM. Also stop the drift monitor —
    // its setInterval references audio elements that won't exist after the
    // re-render.
    if (_sdStemsState && _sdStemsState.driftTimer) {
        try { clearInterval(_sdStemsState.driftTimer); } catch(e) {}
    }
    _sdStemsState = null;
    panel.innerHTML = '<div class="sd-panel-inner"><div style="text-align:center;padding:24px;color:var(--text-dim)">Loading stems…</div></div>';
    var stems = null, lalalSplit = null, spatialSplits = [];
    try {
        if (window.GLStems) {
            // Load Demucs stems, LALAL lead/backing, and any Phase 2 spatial
            // splits in parallel. GLAudioSession.mergeTracks fuses all three
            // into one canonical mixer.
            var all = await Promise.all([
                GLStems.getStems(title).catch(function(){return null;}),
                GLStems.getLeadBackingSplit(title).catch(function(){return null;}),
                GLStems.getSpatialSplits ? GLStems.getSpatialSplits(title).catch(function(){return [];}) : Promise.resolve([])
            ]);
            stems = all[0];
            lalalSplit = all[1];
            spatialSplits = all[2] || [];
        }
    } catch(e) {}
    if (stems && stems.stems && stems.stems.drums) {
        panel.innerHTML = '<div class="sd-panel-inner">' + _sdRenderStemsPlayer(title, stems, lalalSplit, spatialSplits) + '</div>';
        _sdInitStemsPlayer();
        if (wasFullscreenSameSong && typeof window._sdStemsToggleFullscreen === 'function') {
            window._sdStemsToggleFullscreen();
        }
    } else {
        // Setup view — render shell first, then async-load Best Shot takes for picker
        panel.innerHTML = '<div class="sd-panel-inner">' + _sdRenderStemsSetup(title) + '</div>';
        _sdLoadStemsSourcePicker(title);
    }
}

function _sdRenderStemsSetup(title) {
    var safeSong = title.replace(/'/g, "\\'");
    return '<div class="sd-card">' +
      '<div class="sd-card-title">🎚 Separate Stems <span class="sd-title-badge">Demucs</span></div>' +
      '<div style="font-size:0.85em;color:var(--text-muted);margin-bottom:14px">Split a recording into separate tracks for studying parts in isolation. Runs on a GPU (~30s once warm, ~$0.005 per song).</div>' +
      // ── Model toggle (4-stem vs 6-stem) ────────────────────────────────
      '<div style="margin-bottom:14px">' +
        '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">Model</label>' +
        '<div style="display:flex;gap:8px">' +
          '<label class="sd-stems-model-opt" style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:rgba(255,255,255,0.02);font-size:0.82em">' +
            '<input type="radio" name="sdStemsModel" value="htdemucs"> ' +
            '<span><b>4 stems</b><br><span style="font-size:0.85em;color:var(--text-dim)">drums · bass · vocals · other</span></span>' +
          '</label>' +
          '<label class="sd-stems-model-opt" style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid rgba(102,126,234,0.35);border-radius:8px;cursor:pointer;background:rgba(102,126,234,0.05);font-size:0.82em">' +
            '<input type="radio" name="sdStemsModel" value="htdemucs_6s" checked> ' +
            '<span><b>6 stems</b> <span style="font-size:0.7em;color:#a5b4fc;font-weight:700">DEFAULT</span><br><span style="font-size:0.85em;color:var(--text-dim)">+ keys · guitar</span></span>' +
          '</label>' +
        '</div>' +
        '<div style="font-size:0.7em;color:var(--text-dim);margin-top:6px"><b>Keys</b> captures all keyboards — piano, organ, electric piano, synth. Lead vs rhythm guitar can\'t be split.</div>' +
      '</div>' +
      '<div id="sdStemsBestShotPicker" style="margin-bottom:14px"></div>' +
      // ── URL input (primary — works for YouTube et al via residential proxy) ──
      '<div style="margin-bottom:12px">' +
        '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Paste a URL</label>' +
        '<input id="sdStemsSourceUrl" class="app-input" placeholder="YouTube, SoundCloud, Bandcamp, or direct mp3/wav/m4a/flac" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:8px;font-size:0.85em;box-sizing:border-box">' +
        '<div style="font-size:0.7em;color:var(--text-dim);margin-top:6px">Works with most streaming sites. <b>Spotify</b> is the exception — DRM blocks ripping.</div>' +
      '</div>' +
      '<button onclick="_sdRunStemSeparation(\'' + safeSong + '\')" style="background:rgba(102,126,234,0.18);color:#a5b4fc;border:1px solid rgba(102,126,234,0.35);padding:11px 16px;border-radius:8px;font-weight:700;cursor:pointer;width:100%;margin-bottom:8px">▶ Separate from URL</button>' +
      // Pan check — quick pre-separation analysis. Lets the user see if
      // the source has clear L/R panning (common on 60s/70s recordings)
      // before committing to the full GPU-cost Demucs run.
      '<button onclick="_sdRunPanCheck()" style="background:rgba(34,211,238,0.1);color:#67e8f9;border:1px solid rgba(34,211,238,0.3);padding:8px 12px;border-radius:8px;font-size:0.82em;cursor:pointer;width:100%;margin-bottom:14px">🎧 Check pan distribution first (no separation, ~10s)</button>' +
      '<div id="sdPanCheckResult" style="margin-bottom:14px"></div>' +
      // ── File upload (alternative — for offline audio) ───────────────────
      '<div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.02)">' +
        '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">Or upload an audio file</label>' +
        '<input type="file" id="sdStemsFile" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac" onchange="_sdRunStemSeparationFromFile(\'' + safeSong + '\', this)" style="width:100%;font-size:0.85em;color:var(--text)">' +
        '<div style="font-size:0.7em;color:var(--text-dim);margin-top:6px">Up to ~50MB. After loading you\'ll get Pan check + Separate buttons — nothing runs automatically.</div>' +
      '</div>' +
    '</div>';
}

// File selection used to auto-separate immediately. Now it stages the
// file in memory and surfaces two explicit choices: Pan Check (client-
// side, no upload, instant) and Separate (the GPU-cost path). Avoids
// burning Demucs runs on files the user hadn't decided to commit to yet.
window._sdRunStemSeparationFromFile = function(title, input) {
    if (!input || !input.files || !input.files[0]) return;
    var file = input.files[0];
    // Cloudflare Workers default body cap is 100MB; base64 is ~33% larger
    // than raw, so 50MB raw is the safe ceiling. Worker also decodes the
    // whole payload in memory.
    if (file.size > 50 * 1024 * 1024) {
        alert('File is ' + Math.round(file.size / 1024 / 1024) + 'MB — please use a file under 50MB. Try compressing to MP3 first.');
        input.value = '';
        return;
    }
    window._sdStemsPendingFile = file;
    window._sdStemsPendingTitle = title;
    var result = document.getElementById('sdPanCheckResult');
    if (!result) return;
    result.innerHTML =
        '<div style="padding:12px;border:1px solid rgba(102,126,234,0.3);border-radius:8px;background:rgba(102,126,234,0.05)">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
            '<span style="font-size:1.2em">📁</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:0.85em;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _sdEsc(file.name) + '</div>' +
              '<div style="font-size:0.7em;color:var(--text-dim)">' + (Math.round(file.size/1024)) + ' KB · ready to process</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button onclick="_sdRunPanCheckOnFile()" style="flex:1;background:rgba(34,211,238,0.1);color:#67e8f9;border:1px solid rgba(34,211,238,0.3);padding:8px 12px;border-radius:6px;font-size:0.82em;cursor:pointer">🎧 Pan check first</button>' +
            '<button onclick="_sdSeparateFile()" style="flex:1;background:rgba(102,126,234,0.18);color:#a5b4fc;border:1px solid rgba(102,126,234,0.35);padding:8px 12px;border-radius:6px;font-size:0.82em;font-weight:700;cursor:pointer">▶ Separate</button>' +
          '</div>' +
          '<div id="sdPanCheckFileResult" style="margin-top:10px"></div>' +
        '</div>';
};

// Run the actual separation on the stashed file (deferred from selection
// time so the user can pan-check first).
window._sdSeparateFile = function() {
    var file = window._sdStemsPendingFile;
    var title = window._sdStemsPendingTitle;
    if (!file || !title) { alert('No file selected. Pick one first.'); return; }
    var reader = new FileReader();
    var model = _sdStemsSelectedModel();
    reader.onload = function() {
        _sdRunStemSeparationFromTake(title, { audioDataUrl: reader.result, sourceLabel: file.name, model: model });
    };
    reader.onerror = function() { alert('Failed to read file.'); };
    reader.readAsDataURL(file);
};

// Client-side pan analysis for a local file. Uses Web Audio
// decodeAudioData + L/R energy ratio per short window. No upload needed,
// no Modal cost. Mirrors the Modal _energy_pan_histogram math closely
// enough that the histogram visually matches the URL-path output.
window._sdRunPanCheckOnFile = async function() {
    var file = window._sdStemsPendingFile;
    if (!file) { alert('No file selected.'); return; }
    var out = document.getElementById('sdPanCheckFileResult');
    if (!out) return;
    out.innerHTML = '<div style="font-size:0.78em;color:var(--text-dim);text-align:center;padding:10px">⏳ Decoding + analyzing…</div>';
    try {
        var arrayBuf = await file.arrayBuffer();
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw new Error('Web Audio not supported in this browser');
        var ctx = new Ctx();
        var audioBuf = await ctx.decodeAudioData(arrayBuf);
        try { ctx.close(); } catch(e) {}
        if (audioBuf.numberOfChannels < 2) {
            out.innerHTML = '<div style="padding:10px;border:1px solid rgba(245,158,11,0.3);border-radius:8px;background:rgba(245,158,11,0.05);font-size:0.78em;color:#fbbf24">This file is mono — pan analysis isn\'t meaningful. Hit ▶ Separate to run Demucs directly.</div>';
            return;
        }
        var hist = _sdComputePanHistogram(audioBuf.getChannelData(0), audioBuf.getChannelData(1), 21);
        out.innerHTML =
            '<div style="padding:10px;border:1px solid rgba(34,211,238,0.25);border-radius:8px;background:rgba(34,211,238,0.04)">' +
              '<div style="font-size:0.78em;font-weight:700;color:#67e8f9;margin-bottom:6px">🎧 Pan-energy histogram</div>' +
              '<canvas id="sdPanCheckCanvas" width="400" height="80" style="width:100%;height:80px;background:rgba(0,0,0,0.25);border-radius:6px;display:block"></canvas>' +
              '<div style="display:flex;justify-content:space-between;font-size:0.66em;color:var(--text-dim);margin-top:4px"><span>Hard L</span><span>C</span><span>Hard R</span></div>' +
              '<div style="font-size:0.74em;color:var(--text-muted);margin-top:10px;line-height:1.5">Tall off-center bars = an instrument is panned there. Distinct L/R peaks → spatial split (after a Demucs pass) can isolate them. Everything piled at center → mono-leaning mix; Demucs alone is your best path.</div>' +
            '</div>';
        _sdRenderSpatialHistogram(hist, 'sdPanCheckCanvas');
    } catch (e) {
        out.innerHTML = '<div style="font-size:0.78em;color:#fca5a5;padding:10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px">Pan check failed: ' + _sdEsc(e.message || String(e)) + '</div>';
    }
};

// Energy-weighted pan histogram from L/R channel Float32Arrays. For each
// short window: compute eL = sum L^2, eR = sum R^2, pan = (eR-eL)/(eR+eL),
// add window energy to the matching bin. nBins=21 matches the Modal side.
function _sdComputePanHistogram(L, R, nBins) {
    var windowSize = 2048;
    var bins = new Array(nBins).fill(0);
    var n = Math.min(L.length, R.length);
    for (var i = 0; i < n; i += windowSize) {
        var eL = 0, eR = 0;
        var end = Math.min(i + windowSize, n);
        for (var j = i; j < end; j++) { eL += L[j] * L[j]; eR += R[j] * R[j]; }
        var tot = eL + eR;
        if (tot < 1e-9) continue;
        var pan = (eR - eL) / tot;
        var idx = Math.floor((pan + 1) / 2 * nBins);
        if (idx >= nBins) idx = nBins - 1;
        if (idx < 0) idx = 0;
        bins[idx] += tot;
    }
    return bins;
}

// Best Shot picker — fetches takes async and renders a button per usable
// take. Drive takes pass the user's access token so Modal can fetch via
// our /drive-stream proxy. Direct http URLs (or dropbox links normalized
// by normalizeAudioUrl) pass through as sourceUrl.
async function _sdLoadStemsSourcePicker(title) {
    var host = (_sdContainer || document).querySelector('#sdStemsBestShotPicker');
    if (!host) return;
    var takes = null;
    try {
        var raw = await loadBandDataFromDrive(title, 'best_shot_takes').catch(function(){return null;});
        takes = (typeof toArray === 'function') ? toArray(raw) : (Array.isArray(raw) ? raw : []);
    } catch(e) { takes = []; }
    if (!takes || !takes.length) return; // silent — user can still paste a URL
    var safeSong = title.replace(/'/g,"\\'");
    var rows = takes.map(function(take, idx) {
        var url = take && take.audioUrl ? take.audioUrl : '';
        if (!url) return '';
        var label = (take.label || ('Take ' + (idx + 1))) + (take.crowned ? ' 👑' : '');
        var who = take.uploadedByName ? ' · ' + take.uploadedByName : '';
        // Classify: firebase / gdrive / direct
        var kind = 'direct';
        var driveFileId = '';
        var fbTitle = '', fbKey = '';
        if (url.indexOf('firebase-audio://') === 0) {
            kind = 'firebase';
            var parts = url.replace('firebase-audio://', '').split('/');
            fbTitle = decodeURIComponent(parts[0] || '');
            fbKey = parts.slice(1).join('/');
        } else {
            var norm = (typeof normalizeAudioUrl === 'function') ? normalizeAudioUrl(url) : url;
            if (norm && norm.indexOf('gdrive:') === 0) {
                kind = 'gdrive';
                driveFileId = norm.replace('gdrive:', '');
            }
        }
        var dataAttrs = 'data-kind="' + kind + '" data-url="' + _sdEsc(url) + '"' +
                        (driveFileId ? ' data-drive-id="' + _sdEsc(driveFileId) + '"' : '') +
                        (fbTitle ? ' data-fb-title="' + _sdEsc(fbTitle) + '"' : '') +
                        (fbKey ? ' data-fb-key="' + _sdEsc(fbKey) + '"' : '') +
                        ' data-label="' + _sdEsc(label) + '"';
        var pill;
        if (kind === 'gdrive')        pill = '<span style="font-size:0.7em;color:#86efac;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);padding:2px 6px;border-radius:6px">Drive</span>';
        else if (kind === 'firebase') pill = '<span style="font-size:0.7em;color:#a5b4fc;background:rgba(102,126,234,0.12);border:1px solid rgba(102,126,234,0.25);padding:2px 6px;border-radius:6px">Firebase</span>';
        else                          pill = '<span style="font-size:0.7em;color:#fbbf24;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.25);padding:2px 6px;border-radius:6px">URL</span>';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:0.85em;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _sdEsc(label) + '</div>' +
            '<div style="font-size:0.7em;color:var(--text-dim)">Best Shot' + _sdEsc(who) + '</div>' +
          '</div>' +
          pill +
          '<button class="sd-stems-pick" ' + dataAttrs + ' style="padding:6px 12px;border-radius:6px;border:1px solid rgba(102,126,234,0.35);background:rgba(102,126,234,0.18);color:#a5b4fc;cursor:pointer;font-size:0.78em;font-weight:700;white-space:nowrap">Use this</button>' +
        '</div>';
    }).filter(Boolean).join('');
    if (!rows) return;
    host.innerHTML = '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:6px">From Best Shot</div>' + rows;
    // Wire up picker buttons
    host.querySelectorAll('.sd-stems-pick').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            var kind = btn.dataset.kind;
            var label = btn.dataset.label || 'Best Shot';
            var model = _sdStemsSelectedModel();
            if (kind === 'gdrive') {
                var fid = btn.dataset.driveId;
                if (!fid) return;
                if (typeof accessToken === 'undefined' || !accessToken) {
                    alert('Sign in with Google first — Drive files need an auth token to fetch.');
                    return;
                }
                _sdRunStemSeparationFromTake(title, { driveFileId: fid, accessToken: accessToken, sourceLabel: label, model: model });
            } else if (kind === 'firebase') {
                // Fetch base64 audio from Firebase and let the worker stage it to R2.
                var sTitle = btn.dataset.fbTitle;
                var aKey = btn.dataset.fbKey;
                if (!sTitle || !aKey) { alert('Firebase audio reference is malformed.'); return; }
                btn.disabled = true; btn.textContent = 'Fetching…';
                try {
                    var data = await loadBandDataFromDrive(sTitle, aKey);
                    if (!data || !data.data) throw new Error('Firebase audio not found');
                    _sdRunStemSeparationFromTake(title, {
                        audioDataUrl: data.data,
                        // firebaseAudioRef preserves the pointer so a future
                        // re-separate can re-fetch the base64 without forcing
                        // the user to re-pick the take.
                        firebaseAudioRef: btn.dataset.url,
                        sourceLabel: label,
                        model: model
                    });
                } catch (e) {
                    btn.disabled = false; btn.textContent = 'Use this';
                    alert('Could not load Firebase audio: ' + (e.message || e));
                }
            } else {
                _sdRunStemSeparationFromTake(title, { sourceUrl: btn.dataset.url, sourceLabel: label, model: model });
            }
        });
    });
}

// Read the currently-selected model from the setup card. Defaults to
// htdemucs_6s if the radio group isn't present (e.g. picker view rendered
// before the toggle was added in a stale DOM).
function _sdStemsSelectedModel() {
    var sel = (_sdContainer || document).querySelector('input[name="sdStemsModel"]:checked');
    return (sel && sel.value === 'htdemucs') ? 'htdemucs' : 'htdemucs_6s';
}

window._sdRunStemSeparation = async function(title) {
    var input = document.getElementById('sdStemsSourceUrl');
    var url = input ? input.value.trim() : '';
    if (!url) { alert('Paste an audio URL or pick a Best Shot take.'); return; }
    _sdRunStemSeparationFromTake(title, { sourceUrl: url, sourceLabel: 'URL', model: _sdStemsSelectedModel() });
};

// Pre-separation pan analysis. Shows the energy-by-pan-position
// histogram so the user can decide if spatial split is a viable
// path BEFORE paying for a full Demucs GPU run. Useful on old
// stereo recordings where instruments are hard-panned.
window._sdRunPanCheck = async function() {
    var input = document.getElementById('sdStemsSourceUrl');
    var url = input ? input.value.trim() : '';
    if (!url) { alert('Paste an audio URL first (in the box above).'); return; }
    var result = document.getElementById('sdPanCheckResult');
    if (!result) return;
    result.innerHTML = '<div style="font-size:0.78em;color:var(--text-dim);text-align:center;padding:12px;border:1px dashed var(--border);border-radius:8px">⏳ Fetching + analyzing pan distribution… (~10–60s incl. download)</div>';
    try {
        if (!window.GLStems || !GLStems.analyzePan) throw new Error('Pan analysis unavailable (GLStems.analyzePan missing)');
        var data = await GLStems.analyzePan(url);
        if (!data || !data.histogram) throw new Error('No histogram returned');
        result.innerHTML =
            '<div style="padding:10px;border:1px solid rgba(34,211,238,0.25);border-radius:8px;background:rgba(34,211,238,0.04)">' +
              '<div style="font-size:0.78em;font-weight:700;color:#67e8f9;margin-bottom:6px">🎧 Pan-energy histogram</div>' +
              '<canvas id="sdPanCheckCanvas" width="400" height="80" style="width:100%;height:80px;background:rgba(0,0,0,0.25);border-radius:6px;display:block"></canvas>' +
              '<div style="display:flex;justify-content:space-between;font-size:0.66em;color:var(--text-dim);margin-top:4px"><span>Hard L</span><span>C</span><span>Hard R</span></div>' +
              '<div style="font-size:0.74em;color:var(--text-muted);margin-top:10px;line-height:1.5">' +
                '<b>How to read it:</b> tall bars off-center mean an instrument is panned there. ' +
                'Distinct L/R peaks (common on 60s–70s mixes) → spatial split after a Demucs pass can extract those instruments cleanly. ' +
                'Everything piled at center → it\'s a mono-leaning mix; Demucs alone is your best option.' +
              '</div>' +
            '</div>';
        _sdRenderSpatialHistogram(data.histogram, 'sdPanCheckCanvas');
    } catch (e) {
        result.innerHTML = '<div style="font-size:0.78em;color:#fca5a5;padding:10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px">Pan check failed: ' + _sdEsc(e.message || String(e)) + '</div>';
    }
};

async function _sdRunStemSeparationFromTake(title, opts) {
    var panel = (_sdContainer || document).querySelector('.sd-lens-panel[data-lens="stems"]');
    if (!panel) return;
    var safeSong = title.replace(/'/g,"\\'");
    var modelLabel = (opts.model === 'htdemucs_ft') ? '4 stems HQ (~3× slower)'
                   : (opts.model === 'mdx_extra')   ? 'MDX'
                   : (opts.model === 'htdemucs')    ? '4 stems'
                   :                                  '6 stems';
    panel.innerHTML = '<div class="sd-panel-inner"><div style="text-align:center;padding:36px;color:var(--text-dim)">' +
      '<div style="font-size:2em;margin-bottom:10px">🎚</div>' +
      '<div id="sdStemsStageMsg" style="font-weight:700;color:var(--text);margin-bottom:6px">Separating stems…</div>' +
      '<div id="sdStemsStageHint" style="font-size:0.82em">Cold start can take 60-120s. Warm runs are ~30s.</div>' +
      '<div style="margin:18px auto 6px;max-width:280px;height:6px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden">' +
        '<div id="sdStemsProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#a78bfa);transition:width 0.6s ease"></div>' +
      '</div>' +
      '<div id="sdStemsProgressPct" style="font-size:0.75em;opacity:0.7">0%</div>' +
      '<div style="font-size:0.7em;margin-top:14px;opacity:0.7">Source: ' + _sdEsc(opts.sourceLabel || '—') + ' · ' + _sdEsc(modelLabel) + ' · don’t close the tab</div>' +
    '</div></div>';
    var msgEl = document.getElementById('sdStemsStageMsg');
    var hintEl = document.getElementById('sdStemsStageHint');
    var barEl = document.getElementById('sdStemsProgressBar');
    var pctEl = document.getElementById('sdStemsProgressPct');
    var stageLabels = {
      starting: { msg: 'Spinning up the GPU…', hint: 'Picking up your audio. This usually takes a few seconds.' },
      processing: { msg: 'Separating stems…', hint: 'Cold start can take 60-120s. Warm runs are ~30s.' },
      finalizing: { msg: 'Finalizing & uploading…', hint: 'Saving stem files. Almost there.' }
    };
    var onProgress = function(stage, percent) {
        var lbl = stageLabels[stage] || stageLabels.processing;
        if (msgEl) msgEl.textContent = lbl.msg;
        if (hintEl) hintEl.textContent = lbl.hint;
        var p = Math.max(0, Math.min(100, Number(percent) || 0));
        if (barEl) barEl.style.width = p + '%';
        if (pctEl) pctEl.textContent = p + '%';
    };
    try {
        await GLStems.separate(title, Object.assign({}, opts, { onProgress: onProgress }));
        _sdLensPopulated.stems = false;
        _sdPopulateStemsLens(title);
        if (typeof showToast === 'function') showToast('Stems ready for ' + title);
    } catch(e) {
        var msg = (e && e.message) ? e.message : String(e);
        panel.innerHTML = '<div class="sd-panel-inner"><div style="padding:24px;text-align:center">' +
          '<div style="color:#ef4444;font-weight:700;margin-bottom:8px">Separation failed</div>' +
          '<div style="color:var(--text-dim);font-size:0.85em;margin-bottom:14px;word-break:break-word">' + _sdEsc(msg) + '</div>' +
          '<button onclick="(function(){window._sdLensPopulated&&(_sdLensPopulated.stems=false);_sdPopulateStemsLens(\'' + safeSong + '\')})()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer">Try again</button>' +
        '</div></div>';
    }
}

// Build the model dropdown options. Marks the model that produced the
// current stems as "selected" so the user sees what was used.
function _sdStemsModelOptions(currentModel) {
    var opts = [
        { v: 'htdemucs_6s', l: '6 stems (default)' },
        { v: 'htdemucs',    l: '4 stems' },
        { v: 'htdemucs_ft', l: '4 stems HQ (~3× slower)' },
        { v: 'mdx_extra',   l: '4 stems · MDX architecture' }
    ];
    return opts.map(function(o) {
        var sel = (o.v === currentModel) ? ' selected' : '';
        return '<option value="' + o.v + '"' + sel + '>' + o.l + '</option>';
    }).join('');
}

// LALAL Lead/Backing should be derived from the SAME Demucs run as the other
// stems. If a user re-runs Demucs without re-running LALAL, the LALAL split
// points at obsolete vocals → temporal misalignment (bug S1). Two checks:
//   1. Timestamp: LALAL's separatedAt < Demucs's separatedAt → stale.
//   2. R2 songId: stems URLs embed `stems/{songId}/...` — the songId is a
//      timestamp generated per separation run. If Demucs vocals + LALAL lead
//      have different songIds, LALAL was run against a previous Demucs.
// The fix is _sdStemsResyncLalal: re-run LALAL with the current Demucs
// vocals as input. Same Path-A semantics as harmony-lab's hlGenerateFromStems.
function _sdLalalIsStale(stems, lalalSplit) {
    if (!lalalSplit || !lalalSplit.stems || !lalalSplit.stems.lead) return false;
    if (!stems || !stems.stems || !stems.stems.vocals) return false;
    // Timestamp check
    if (stems.separatedAt && lalalSplit.separatedAt) {
        var sd = new Date(stems.separatedAt).getTime();
        var ld = new Date(lalalSplit.separatedAt).getTime();
        if (ld && sd && ld < sd) return true;
    }
    // SongId check — extract from R2 URL pattern stems/{songId}/...
    var demRe = /\/stems\/([^\/]+)\//;
    var dm = (stems.stems.vocals || '').match(demRe);
    var lm = (lalalSplit.stems.lead || '').match(demRe);
    if (dm && lm && dm[1] !== lm[1]) return true;
    return false;
}

function _sdRenderStemsPlayer(title, stems, lalalSplit, spatialSplits) {
    _sdEnsureStemsFsStyle();
    var safeSong = title.replace(/'/g, "\\'");
    // Stash so _sdStemsRedo can read source refs + previous model without
    // having to re-load from band-data on every Re-separate click.
    window._sdLastStemsRec = stems;
    window._sdLastSpatialSplits = Array.isArray(spatialSplits) ? spatialSplits : [];
    // Single-source-of-truth merged track list. LALAL lead/backing replace
    // Demucs vocals; spatial-split children appear after their parent.
    var tracks = (window.GLAudioSession && GLAudioSession.mergeTracks)
        ? GLAudioSession.mergeTracks(stems, lalalSplit, window._sdLastSpatialSplits)
        : [];
    var hasLalal = !!(window.GLAudioSession && GLAudioSession.hasLalalSplit && GLAudioSession.hasLalalSplit(lalalSplit));
    var hasDemucsVocals = !!(stems && stems.stems && stems.stems.vocals);
    var rows = tracks.map(function(t) {
        var dlName = (title || 'song').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) + '_' + t.id + '.flac';
        // Compact row: activity strip dominates the wide space (where music
        // shows up vs silence), volume becomes a small fader on the right.
        // Click anywhere on the activity strip seeks all stems together.
        return '<div class="sd-stem-row" data-stem="' + t.id + '" data-source="' + t.source + '" data-color="' + t.color + '" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.02);margin-bottom:4px">' +
          '<span style="font-size:1.05em;width:1.2em;text-align:center;flex-shrink:0">' + t.icon + '</span>' +
          '<span style="font-size:0.78em;font-weight:700;color:' + t.color + ';width:54px;flex-shrink:0">' + t.label + '</span>' +
          '<div class="sd-stem-activity-wrap" data-stem="' + t.id + '" title="Click to seek · Shift-click to set loop in/out" style="position:relative;flex:1;min-width:80px;height:22px;cursor:pointer;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.04);border-radius:4px;overflow:hidden">' +
            '<canvas class="sd-stem-activity" style="width:100%;height:100%;display:block"></canvas>' +
            '<div class="sd-stem-loop-band" style="position:absolute;top:0;bottom:0;background:rgba(255,235,150,0.22);left:0;width:0;display:none;pointer-events:none"></div>' +
            '<div class="sd-stem-loop-marker" data-side="in" style="position:absolute;top:0;bottom:0;width:2px;background:#10b981;left:0;display:none;pointer-events:none;box-shadow:0 0 4px rgba(16,185,129,0.6)"></div>' +
            '<div class="sd-stem-loop-marker" data-side="out" style="position:absolute;top:0;bottom:0;width:2px;background:#ef4444;left:0;display:none;pointer-events:none;box-shadow:0 0 4px rgba(239,68,68,0.6)"></div>' +
            '<div class="sd-stem-playhead" style="position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.7);left:0;pointer-events:none;box-shadow:0 0 4px rgba(255,255,255,0.5)"></div>' +
            '<div class="sd-stem-activity-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.62em;color:var(--text-dim);pointer-events:none">…</div>' +
          '</div>' +
          // Per-row Mix controls — hidden by default. The musician-first
          // default surfaces only mute (the primary practice control) and
          // the activity strip. Volume / pan / solo move under ⚙️ Mix
          // (toggled via `.show-mix` on the player root). Nothing removed.
          '<button class="sd-stem-mute" data-stem="' + t.id + '" title="Mute" style="padding:4px 7px;border-radius:5px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.66em;font-weight:700">M</button>' +
          '<div class="sd-stem-mix-controls" style="display:none;align-items:center;gap:8px">' +
            '<input type="range" min="0" max="100" value="80" class="sd-stem-vol" data-stem="' + t.id + '" style="width:64px;flex-shrink:0;accent-color:' + t.color + '" title="Volume">' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:0;flex-shrink:0" title="Pan (L ↔ R)">' +
              '<input type="range" min="-100" max="100" value="0" class="sd-stem-pan" data-stem="' + t.id + '" style="width:48px;accent-color:' + t.color + '">' +
              '<span class="sd-stem-pan-val" data-stem="' + t.id + '" onclick="_sdStemsResetPan(\'' + t.id + '\')" title="Tap to center" style="font-size:0.58em;color:var(--text-dim);font-variant-numeric:tabular-nums;line-height:1;cursor:pointer;padding:2px 4px;border-radius:3px;-webkit-tap-highlight-color:rgba(102,126,234,0.2)">C</span>' +
            '</div>' +
            '<button class="sd-stem-solo" data-stem="' + t.id + '" title="Solo" style="padding:4px 7px;border-radius:5px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.66em;font-weight:700">S</button>' +
          '</div>' +
          '<div class="sd-stem-overflow-wrap" style="position:relative;flex-shrink:0">' +
            '<button class="sd-stem-overflow" onclick="_sdStemsToggleOverflow(this);event.stopPropagation()" title="More" style="padding:4px 8px;border-radius:5px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.95em;line-height:1;font-weight:700">⋮</button>' +
            '<div class="sd-stem-overflow-menu" style="position:absolute;top:calc(100% + 4px);right:0;display:none;background:#1e293b;border:1px solid var(--border);border-radius:6px;padding:4px 0;z-index:30;min-width:200px;box-shadow:0 6px 18px rgba(0,0,0,0.55)">' +
              '<a href="' + _sdEsc(t.rawUrl) + '" download="' + _sdEsc(dlName) + '" target="_blank" rel="noopener" onclick="_sdStemsCloseAllOverflows()" style="display:block;padding:7px 12px;color:var(--text);text-decoration:none;font-size:0.78em;white-space:nowrap">⬇ Download FLAC</a>' +
              // Spatial split: only for parent (non-child) stems. Data attributes
              // beat inline onclick — no string-escaping pitfalls (URLs / labels
              // could contain quotes / ampersands). Delegated handler at the
              // panel level reads data-action and dispatches.
              (t.kind !== 'spatial_child'
                ? '<button type="button" class="sd-stems-menu-action" data-action="spatial-split" data-song="' + _sdEsc(title) + '" data-stem-id="' + _sdEsc(t.id) + '" data-source-url="' + _sdEsc(t.rawUrl) + '" data-stem-label="' + _sdEsc(t.label) + '" style="display:block;width:100%;text-align:left;padding:7px 12px;color:var(--text);background:none;border:0;font-size:0.78em;cursor:pointer;white-space:nowrap" title="Split this stem by stereo pan position, optionally biased toward a tone fingerprint">↳ Spatial split…</button>'
                : '') +
              // Remove split: only for spatial-children — clears all children of this parent.
              (t.kind === 'spatial_child'
                ? '<button type="button" class="sd-stems-menu-action" data-action="remove-spatial-split" data-song="' + _sdEsc(title) + '" data-parent-id="' + _sdEsc(t.parentId) + '" style="display:block;width:100%;text-align:left;padding:7px 12px;color:#f87171;background:none;border:0;font-size:0.78em;cursor:pointer;white-space:nowrap" title="Discard the spatial split for this parent stem">✕ Remove split</button>'
                : '') +
            '</div>' +
          '</div>' +
          // crossorigin="anonymous" is REQUIRED for createMediaElementSource()
          // to produce non-silent output on cross-origin sources (R2). Without
          // it, the audio plays through the <audio> element itself but goes
          // silent the moment we route through Web Audio. R2 bucket needs
          // matching CORS policy (Allowed-Origin: *) for this to work.
          '<audio class="sd-stem-audio" data-stem="' + t.id + '" preload="auto" crossorigin="anonymous" src="' + _sdEsc(t.url) + '"></audio>' +
        '</div>';
    }).join('');
    var when = stems.separatedAt ? new Date(stems.separatedAt).toLocaleString() : '';
    // Tempo/pitch controls — tempo is native (preservesPitch=true by default).
    // Pitch nudge (-2..+2 semitones) lazy-engages Tone.js for true independent
    // shift so tempo and key are not coupled.
    // Promoted Speed/Key row — these are core practice tools (slow it down,
    // shift to a singable key), so styled like a primary control instead
    // of buried under a dashed-border "effects" treatment.
    var fxRow = '<div style="display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:9px 12px;border:1px solid rgba(102,126,234,0.25);border-radius:8px;background:rgba(102,126,234,0.05);flex-wrap:wrap;font-size:0.8em;color:var(--text)">' +
        '<span style="font-weight:700;color:#a5b4fc">⏱ Speed</span>' +
        '<input id="sdStemsTempo" type="range" min="50" max="150" step="1" value="100" style="flex:1;min-width:120px;accent-color:#818cf8">' +
        '<span id="sdStemsTempoVal" style="font-variant-numeric:tabular-nums;min-width:46px;text-align:right;font-weight:700">1.00×</span>' +
        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.92em;color:var(--text-dim)"><input id="sdStemsPreservePitch" type="checkbox" checked> Preserve pitch</label>' +
        '<span style="width:1px;height:20px;background:rgba(255,255,255,0.12);margin:0 4px"></span>' +
        '<span style="font-weight:700;color:#a5b4fc">🎼 Key</span>' +
        '<button class="sd-stems-pitch" data-delta="-1" title="Down 1 semitone" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:var(--text);cursor:pointer;font-weight:700;font-size:0.95em">−1</button>' +
        '<span id="sdStemsPitchVal" style="font-variant-numeric:tabular-nums;min-width:36px;text-align:center;font-weight:700;color:var(--text)">0</span>' +
        '<button class="sd-stems-pitch" data-delta="1" title="Up 1 semitone" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:var(--text);cursor:pointer;font-weight:700;font-size:0.95em">+1</button>' +
        '<button id="sdStemsPitchReset" style="padding:5px 8px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.85em">reset</button>' +
    '</div>';
    // ── Practice presets — one button per stem (skip "other" — usually
    // bleed/SFX, not a practice target). Click mutes that stem so you can
    // play/sing along; clicking the same preset again toggles back to
    // all-on. Only one preset active at a time — switching presets resets
    // mutes first.
    var presetIcons = { drums: '🥁', bass: '🎸', guitar: '🎸', piano: '🎹', lead: '🎤', backing: '🎶', vocals: '🎤' };
    var presetButtons = tracks
        .filter(function(t){ return t.id !== 'other'; })
        .map(function(t){
            return '<button class="sd-stems-preset" data-stem="' + t.id + '" data-color="' + t.color + '" onclick="_sdStemsApplyPreset(\'' + t.id + '\')" title="Mute ' + t.label + ' — play/sing along" style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:6px;border:1px solid ' + t.color + '40;background:rgba(255,255,255,0.03);color:var(--text-dim);cursor:pointer;font-size:0.78em;font-weight:700;white-space:nowrap">' + (presetIcons[t.id] || '🎵') + ' ' + t.label + '</button>';
        }).join('');
    // Promoted: practice presets are now the primary stem-control surface.
    // Per-stem vol/pan/solo move under ⚙️ Mix toggle (right side). The
    // bigger label + accent border signal "this is what you do here."
    var presetsRow = '<div id="sdStemsPresetsRow" style="display:flex;align-items:center;gap:6px;margin-top:10px;padding:10px 12px;border:1px solid rgba(102,126,234,0.28);border-radius:10px;flex-wrap:wrap;font-size:0.84em;color:var(--text-dim);background:rgba(102,126,234,0.04)">' +
        '<span style="font-weight:800;color:#a5b4fc;white-space:nowrap;font-size:0.92em">🎯 Practice — mute one and play along:</span>' +
        presetButtons +
        '<button onclick="_sdStemsResetPresets()" title="Unmute everything" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.78em">↺ Reset</button>' +
        '<span style="flex:1;min-width:8px"></span>' +
        // ⚙️ Mix toggle — reveals per-stem vol/pan/solo + reset-volumes.
        // Hidden by default per the "musician-first, not DAW" principle.
        '<button id="sdStemsMixToggle" onclick="window._sdStemsToggleMix()" title="Show per-stem volume, pan, and solo controls" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.78em;white-space:nowrap">⚙️ Mix ▾</button>' +
        '<button id="sdStemsResetVolumesBtn" onclick="_sdStemsResetVolumes()" title="Reset all stem volumes back to 80%" style="display:none;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.78em;white-space:nowrap">🔊 Reset volumes</button>' +
    '</div>';

    // ── Loop bar — explicit "Set In/Out here" buttons make the entry path
    // obvious without forcing the user to discover Shift-click. The Loop
    // button on the left is the on/off toggle once markers exist.
    var loopBar = '<div id="sdStemsLoopBar" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.02);font-size:0.78em;color:var(--text-dim);flex-wrap:wrap">' +
        '<button id="sdStemsLoopToggle" onclick="_sdStemsToggleLoop()" title="Toggle loop on/off (L)" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-weight:700">🔁 Loop</button>' +
        '<button onclick="_sdStemsSetLoopInHere()" title="Set IN at current playhead — key: [" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.1);color:#6ee7b7;cursor:pointer;font-weight:700;font-size:0.92em">[ Set In</button>' +
        '<span id="sdStemsLoopIn" style="font-variant-numeric:tabular-nums;color:#10b981;min-width:38px;font-weight:700">—</span>' +
        '<span style="opacity:0.5;font-weight:700">→</span>' +
        '<span id="sdStemsLoopOut" style="font-variant-numeric:tabular-nums;color:#ef4444;min-width:38px;font-weight:700">—</span>' +
        '<button onclick="_sdStemsSetLoopOutHere()" title="Set OUT at current playhead — key: ]" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);color:#fca5a5;cursor:pointer;font-weight:700;font-size:0.92em">Set Out ]</button>' +
        '<button id="sdStemsLoopClear" onclick="_sdStemsClearLoop()" title="Clear markers (Esc)" style="padding:4px 8px;border-radius:5px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.92em">Clear</button>' +
        '<span style="flex:1;min-width:8px"></span>' +
        '<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer" title="Play 4 metronome ticks before audio starts">' +
          '<input id="sdStemsCountIn" type="checkbox" ' + (window._sdCountInEnabled === false ? '' : 'checked') + ' onchange="window._sdCountInEnabled=this.checked"> Count-in' +
        '</label>' +
    '</div>' +
    // GrooveMate hint pill — populated dynamically by _sdGmRefreshHint.
    // Hidden by default; appears with Apply / Dismiss when ambient
    // GrooveMate evaluates a high-priority stems-* intent.
    '<div id="sdStemsGmHint" data-intent="" style="display:none;margin:0 4px 10px;padding:8px 10px;border-radius:8px;background:rgba(167,139,250,0.10);border:1px solid rgba(167,139,250,0.35);font-size:0.78em;color:#c4b5fd;align-items:center;gap:8px;flex-wrap:wrap">'
      + '<span style="font-size:0.85em">🎯</span>'
      + '<span id="sdStemsGmHintMsg" style="flex:1;min-width:140px;line-height:1.35"></span>'
      + '<button onclick="_sdGmApplyHint()" type="button" style="background:rgba(167,139,250,0.18);border:1px solid rgba(167,139,250,0.5);color:#ddd6fe;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.95em;font-weight:700">Apply</button>'
      + '<button onclick="_sdGmDismissHint()" type="button" style="background:none;border:1px solid rgba(255,255,255,0.12);color:var(--text-dim);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.95em">Dismiss</button>'
    + '</div>' +
    // Tiny subtitle so first-timers find the keys. Two flavors:
    // - kbd-hint: shown on hover-capable / pointer-fine devices (desktop)
    // - touch-hint: shown on coarse-pointer devices (phone/tablet) — points
    //   at the visible buttons since [/]/L/Esc keys aren't accessible.
    // Visibility is toggled by CSS in _sdEnsureStemsFsStyle.
    '<div class="sd-stems-kbd-hint" style="margin:0 4px 10px;font-size:0.68em;color:var(--text-dim);opacity:0.75;font-style:italic">Hit <b>[</b> / <b>]</b> while playing to mark in/out at the playhead, <b>L</b> to toggle, <b>Esc</b> to clear · or Shift-click any strip</div>' +
    '<div class="sd-stems-touch-hint" style="display:none;margin:0 4px 10px;font-size:0.7em;color:var(--text-dim);opacity:0.85;font-style:italic">Tap <b>[ Set In</b> / <b>Set Out ]</b> at the playhead, <b>🔁 Loop</b> to toggle, <b>Clear</b> to reset</div>';

    var badge = hasLalal
        ? '<span class="sd-title-badge">Demucs + LALAL</span>'
        : '<span class="sd-title-badge">Demucs</span>';
    // Stale-LALAL warning (bug S1 long-term fix). Only renders when the
    // LALAL Lead/Backing was generated from a different Demucs run than the
    // currently-loaded stems. The Re-sync button re-runs LALAL against the
    // current Demucs vocals stem (Path A — same as hlGenerateFromStems) so
    // alignment is restored.
    var staleLalalBanner = '';
    if (hasLalal && _sdLalalIsStale(stems, lalalSplit)) {
        staleLalalBanner = '<div id="sd-lalal-stale-banner" style="margin-bottom:10px;padding:10px 14px;background:rgba(245,158,11,0.10);border:1px solid rgba(245,158,11,0.4);border-radius:8px;font-size:0.82em;color:#fbbf24;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<span id="sd-lalal-stale-icon" style="font-size:1.2em;flex-shrink:0">⚠️</span>' +
          '<div id="sd-lalal-stale-status" style="flex:1;min-width:200px">' +
            '<div style="font-weight:700;margin-bottom:2px">Lead/Backing may be out of sync</div>' +
            '<div style="font-size:0.88em;opacity:0.85;line-height:1.4">LALAL was generated from an older Demucs run. Re-sync to align with the current stems.</div>' +
          '</div>' +
          '<button id="sd-lalal-stale-button" onclick="_sdStemsResyncLalal(\'' + safeSong + '\')" title="Re-run LALAL using the current Demucs vocals stem (~30-60s, uses one LALAL credit)" style="background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid rgba(245,158,11,0.5);padding:7px 14px;border-radius:6px;cursor:pointer;font-size:0.85em;font-weight:700;white-space:nowrap;flex-shrink:0">🔄 Re-sync LALAL</button>' +
        '</div>';
    }

    return '<div class="sd-stems-wrap" data-song="' + _sdEsc(title) + '">' +
      // Phone-portrait nudge — visible only via media query in _sdEnsureStemsFsStyle.
      '<div class="sd-stems-rotate-banner" style="display:none;margin-bottom:10px;padding:10px 14px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:8px;font-size:0.82em;color:#fbbf24;text-align:center;line-height:1.4">📱 ↻ <b>Rotate horizontal</b> for the full mixer view — pan / volume sliders need the width to be usable.</div>' +
      staleLalalBanner +
      '<div class="sd-card">' +
      '<div class="sd-card-title" style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
        '<span>🎚 Stems ' + badge + '</span>' +
        // Inline SVG (4-corner brackets) — the ⛶ unicode glyph rendered as
        // tofu in the user's system font. SVG + text label is bulletproof.
        '<button id="sdStemsExpand" onclick="_sdStemsToggleFullscreen()" title="Expand to full screen" style="display:inline-flex;align-items:center;gap:5px;background:rgba(102,126,234,0.12);border:1px solid rgba(102,126,234,0.3);color:#a5b4fc;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700;line-height:1">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/></svg>' +
          '<span class="sd-stems-expand-label">Full screen</span>' +
        '</button>' +
      '</div>' +
      // Active mode banner — only visible when a Practice preset is on. Tells
      // the user "you're hearing X muted" so they don't get confused why the
      // mix sounds different than the raw stems. Hidden by default; shown
      // by _sdStemsRedrawPresetUI.
      '<div id="sdStemsActiveModeBanner" style="display:none;margin-bottom:10px;padding:9px 12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:8px;font-size:0.85em;color:#fbbf24;align-items:center;gap:10px">' +
        '<span style="font-size:1.15em;flex-shrink:0">🎯</span>' +
        '<span><b>Practice mode:</b> <span id="sdStemsActiveModeLabel">—</span></span>' +
        '<span style="flex:1"></span>' +
        '<button onclick="_sdStemsResetPresets()" title="Unmute everything" style="background:none;border:1px solid rgba(245,158,11,0.5);color:#fbbf24;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:0.92em;font-weight:700;flex-shrink:0">↺ Clear</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:wrap">' +
        '<button id="sdStemsPlay" onclick="_sdStemsToggle()" title="Play/Pause (Space)" style="background:rgba(102,126,234,0.18);color:#a5b4fc;border:1px solid rgba(102,126,234,0.35);padding:9px 14px;border-radius:8px;font-weight:700;cursor:pointer;min-width:84px">▶ Play</button>' +
        '<button onclick="_sdStemsSeekBy(-30)" title="Back 30s (Shift+←)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">⏪ 30</button>' +
        '<button onclick="_sdStemsSeekBy(-10)" title="Back 10s (←)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">⏪ 10</button>' +
        '<button onclick="_sdStemsSeekBy(10)" title="Forward 10s (→)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">10 ⏩</button>' +
        '<button onclick="_sdStemsSeekBy(30)" title="Forward 30s (Shift+→)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">30 ⏩</button>' +
        '<input id="sdStemsScrub" type="range" min="0" max="1000" value="0" style="flex:1;min-width:120px;margin-left:4px">' +
        '<span id="sdStemsTime" style="font-size:0.78em;color:var(--text-dim);font-variant-numeric:tabular-nums;min-width:80px;text-align:right">0:00 / 0:00</span>' +
      '</div>' +
      // Promoted: Speed/Key sit right under transport — they're practice
      // controls, not effects. Loop bar follows since it's session-scoped.
      fxRow +
      loopBar +
      rows +
      presetsRow +
      // Shortcut: extract harmonies banner only when Demucs vocals exist AND
      // LALAL hasn't already split them — otherwise the user already has
      // lead/backing rows above and this banner would just be noise.
      ((hasDemucsVocals && !hasLalal) ? '<div style="margin-top:10px;padding:10px;background:rgba(99,102,241,0.06);border:1px dashed rgba(99,102,241,0.25);border-radius:10px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:1.4em">🎤</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.85em;font-weight:700">Got vocals — split into lead + backing</div>' +
          '<div style="font-size:0.7em;color:var(--text-dim)">Replaces the vocals row with separate Lead and Backing tracks for harmony work</div>' +
        '</div>' +
        '<button onclick="_sdLensPopulated.sing=false;if(typeof switchLens===\'function\')switchLens(\'sing\');setTimeout(function(){if(typeof hlGenerateFromStems===\'function\')hlGenerateFromStems();},400)" style="background:rgba(99,102,241,0.18);color:#a5b4fc;border:1px solid rgba(99,102,241,0.35);padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.82em;white-space:nowrap;flex-shrink:0">→ Split Vocals</button>' +
      '</div>' : '') +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:0.72em;color:var(--text-dim);gap:10px;flex-wrap:wrap">' +
        '<span>Separated ' + (when || '—') + (stems.elapsedSec ? ' · ' + Math.round(stems.elapsedSec) + 's' : '') + (stems.sourceLabel ? ' · from ' + _sdEsc(stems.sourceLabel) : '') + (stems.model ? ' · ' + _sdEsc(stems.model) : '') + '</span>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
          '<select id="sdStemsRedoModel" title="Pick a model and click Re-separate to bake-off variants" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:5px;font-size:0.92em;cursor:pointer">' +
            _sdStemsModelOptions(stems.model || 'htdemucs_6s') +
          '</select>' +
          '<button onclick="_sdStemsRedo(\'' + safeSong + '\')" title="Re-run separation against the saved source (URL or take) with the model selected at left" style="background:none;border:1px solid var(--border);color:var(--text-dim);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.92em;font-weight:700">Re-separate</button>' +
          '<button onclick="_sdStemsChangeSource(\'' + safeSong + '\')" title="Discard saved source and pick a different URL or Best Shot take" style="background:none;border:1px solid var(--border);color:var(--text-dim);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.92em;font-weight:700">Change source…</button>' +
        '</div>' +
      '</div>' +
      '</div>' + // .sd-card
    '</div>'; // .sd-stems-wrap
}

// One-shot CSS injection for the stems-fullscreen overlay. Class-only
// approach so we don't reparent DOM (which would break the WebAudio
// MediaElementSource bindings).
function _sdEnsureStemsFsStyle() {
    if (document.getElementById('sdStemsFsStyle')) return;
    var s = document.createElement('style');
    s.id = 'sdStemsFsStyle';
    // z-index has to beat any sticky page chrome (songs-list table header was
    // bleeding through at z-index ~99999). 2147483646 is safely under max int.
    // Explicit width/height in vw/vh defeats any ancestor with a `transform`
    // that would otherwise re-anchor `position: fixed` to the ancestor.
    s.textContent =
      '.sd-stems-fullscreen{position:fixed!important;left:0!important;top:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;z-index:2147483646!important;background:#0a0e1a!important;overflow-y:auto;padding:24px;margin:0!important;isolation:isolate}' +
      '.sd-stems-fullscreen .sd-card{max-width:1100px;margin:0 auto;background:#0a0e1a}' +
      '.sd-stems-fullscreen .sd-stem-row{padding:8px 12px;margin-bottom:6px}' +
      // Promote Mute/Solo to full words and bump size in fullscreen — there's
      // room for the extra ~30px per row, and the explicit labels read way
      // better than the cramped M/S abbreviations.
      '.sd-stems-fullscreen .sd-stem-mute,.sd-stems-fullscreen .sd-stem-solo{padding:6px 12px!important;font-size:0.78em!important;min-width:54px}' +
      // Active-state reinforcement — bigger borders / brighter text when
      // mute or solo is engaged so it pops at any density.
      '.sd-stem-mute[data-active="1"]{background:rgba(239,68,68,0.22)!important;color:#fca5a5!important;border-color:rgba(239,68,68,0.5)!important}' +
      '.sd-stem-solo[data-active="1"]{background:rgba(245,158,11,0.22)!important;color:#fbbf24!important;border-color:rgba(245,158,11,0.5)!important}' +
      // ⚙️ Mix collapse — per-stem mix controls hidden by default. Stems
      // wrap gets `.show-mix` to reveal them. Inline `display:none` on the
      // .sd-stem-mix-controls element wins until JS flips it.
      '.sd-stems-wrap.show-mix .sd-stem-mix-controls{display:flex!important}' +
      '.sd-stems-wrap.show-mix #sdStemsResetVolumesBtn{display:inline-flex!important}' +
      '.sd-stems-wrap.show-mix #sdStemsMixToggle{background:rgba(102,126,234,0.18)!important;color:#a5b4fc!important;border-color:rgba(102,126,234,0.4)!important}' +
      // 🎯 Focus chip — auto-injected when a PracticeTask with trackId is
      // active. Sits at the top of the stems player; one-tap mute focus.
      '.sd-stems-focus-chip{display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px 14px;border:1px solid rgba(245,158,11,0.4);border-radius:10px;background:linear-gradient(135deg,rgba(245,158,11,0.10),rgba(239,68,68,0.06))}' +
      '.sd-stems-focus-chip-label{font-size:0.84em;font-weight:800;color:#fbbf24}' +
      '.sd-stems-focus-chip-action{margin-left:auto;padding:6px 14px;border-radius:8px;border:0;background:#fbbf24;color:#1f2937;cursor:pointer;font-weight:800;font-size:0.84em}' +
      'body.sd-stems-overlay-open{overflow:hidden}' +
      // Hover-capable / fine-pointer devices = desktop. Coarse pointer = touch.
      // Default is desktop visibility (kbd hint shown, touch hint hidden);
      // touch override flips them.
      '@media (hover: none) and (pointer: coarse){' +
        '.sd-stems-kbd-hint{display:none!important}' +
        '.sd-stems-touch-hint{display:block!important}' +
      '}' +
      // Portrait phones: nudge to rotate. The mixer rows compress badly
      // below ~600px wide and pan/volume sliders become unusable.
      '@media (orientation: portrait) and (max-width: 640px){' +
        '.sd-stems-rotate-banner{display:block!important}' +
      '}';
    document.head.appendChild(s);
}

window._sdStemsToggleFullscreen = function() {
    var wrap = document.querySelector('.sd-stems-wrap');
    if (!wrap) return;
    var on = !wrap.classList.contains('sd-stems-fullscreen');
    if (on) {
        // Reparent to <body> so position:fixed actually covers the viewport.
        // An ancestor in the right-rail had a transform/will-change that
        // re-anchored fixed positioning to its containing block — symptoms
        // were a stems card that didn't fill the screen and underlying page
        // chrome bleeding through. MediaElementSource bindings survive DOM
        // moves; the AudioNode is bound to the element, not its position.
        wrap._sdFsOriginParent = wrap.parentElement;
        wrap._sdFsOriginNext = wrap.nextSibling;
        document.body.appendChild(wrap);
        wrap.classList.add('sd-stems-fullscreen');
        document.body.classList.add('sd-stems-overlay-open');
    } else {
        wrap.classList.remove('sd-stems-fullscreen');
        document.body.classList.remove('sd-stems-overlay-open');
        if (wrap._sdFsOriginParent && wrap._sdFsOriginParent.isConnected) {
            wrap._sdFsOriginParent.insertBefore(wrap, wrap._sdFsOriginNext || null);
        }
        wrap._sdFsOriginParent = null;
        wrap._sdFsOriginNext = null;
    }
    var btn = wrap.querySelector('#sdStemsExpand');
    if (btn) {
        var label = btn.querySelector('.sd-stems-expand-label');
        if (label) label.textContent = on ? 'Exit full screen' : 'Full screen';
        btn.title = on ? 'Exit full screen' : 'Expand to full screen';
    }
    // Swap M/S → Mute/Solo full-word labels in fullscreen (CSS bumps the size
    // to match). Compact M/S stays in the right rail where vertical density
    // matters more than label clarity.
    document.querySelectorAll('.sd-stem-mute').forEach(function(b) { b.textContent = on ? 'Mute' : 'M'; });
    document.querySelectorAll('.sd-stem-solo').forEach(function(b) { b.textContent = on ? 'Solo' : 'S'; });
    // Repaint activity strips at the new width (cached bins, no re-decode).
    setTimeout(function() {
        try { window.dispatchEvent(new Event('resize')); } catch(e) {}
    }, 50);
};

// Tap the pan-position label (C / L25 / R30) to recenter that stem's pan.
// Touch-friendly equivalent of the desktop dblclick on the slider — on iOS
// dblclick on a range input fires inconsistently and the pan slider is
// 48px wide so the precision required to drag back to dead center is
// punishing.
window._sdStemsResetPan = function(stemId) {
    var slider = document.querySelector('.sd-stem-pan[data-stem="' + stemId + '"]');
    if (!slider) return;
    slider.value = 0;
    try { slider.dispatchEvent(new Event('input', { bubbles: true })); } catch(e) {}
};

// One-tap restore: every stem volume slider back to 80 (the render default).
// After the user has dragged a few sliders during practice, "what was the
// balanced starting state?" is a real question that previously required
// per-stem manual reset.
window._sdStemsResetVolumes = function() {
    document.querySelectorAll('.sd-stem-vol').forEach(function(slider) {
        slider.value = 80;
        try { slider.dispatchEvent(new Event('input', { bubbles: true })); } catch(e) {}
    });
};

// ⚙️ Mix toggle — flips per-stem vol/pan/solo + reset-volumes between
// hidden (default) and shown. The musician-first default keeps the player
// uncluttered; the toggle gives full DAW-style control to anyone who
// wants it. Persists per-page-load only — re-mount resets to hidden.
window._sdStemsToggleMix = function() {
    var wrap = document.querySelector('.sd-stems-wrap');
    if (!wrap) return;
    var on = wrap.classList.toggle('show-mix');
    var btn = document.getElementById('sdStemsMixToggle');
    if (btn) btn.innerHTML = on ? '⚙️ Mix ▴' : '⚙️ Mix ▾';
};

// 🎯 Focus auto-button — when a PracticeTask carries a `trackId`, surface
// a one-tap "Focus on [Bass]" chip + auto-apply the mute preset for that
// stem so the user lands ready to play along. Reads window._wbActiveTask
// stamped by the Workbench shell. No-op if no task or no matching stem.
window._sdStemsApplyFocusFromTask = function() {
    try {
        var task = window._wbActiveTask;
        if (!task || !task.trackId) return;
        var trackId = String(task.trackId).toLowerCase();
        var row = document.querySelector('.sd-stem-row[data-stem="' + trackId + '"]');
        if (!row) {
            document.querySelectorAll('.sd-stem-row').forEach(function(r) {
                if (row) return;
                var sid = (r.dataset.stem || '').toLowerCase();
                if (sid && trackId.indexOf(sid) === 0) row = r;
            });
        }
        if (!row) return;
        var stemId = row.dataset.stem;
        var wrap = document.querySelector('.sd-stems-wrap');
        if (wrap && !wrap.querySelector('.sd-stems-focus-chip')) {
            // Per ChatGPT/Drew critique 2026-05-10: chip shows pure state,
            // no action button. The auto-apply already muted the stem;
            // showing a "Mute & Play Along" button created hesitation
            // ("did it apply or do I need to click?"). User can still
            // toggle via the practice presets row below.
            var label = (function() {
                var lbl = row.querySelector('span:nth-child(2)');
                return lbl ? lbl.textContent.trim() : stemId;
            })();
            // Member context: "Brian (Bass)" reads better than just
            // "Bass" because users think in roles (Brian's part) more
            // than instrument labels. Map task.memberKey → bandMembers
            // name; fall back to instrument label only when unknown.
            var memberLabel = '';
            try {
                var mk = task.memberKey;
                if (mk && typeof bandMembers !== 'undefined' && bandMembers) {
                    Object.keys(bandMembers).forEach(function(email) {
                        var m = bandMembers[email] || {};
                        if (m.key === mk || (m.name && m.name.toLowerCase() === String(mk).toLowerCase())) {
                            memberLabel = m.name || mk;
                        }
                    });
                    if (!memberLabel) memberLabel = String(mk).charAt(0).toUpperCase() + String(mk).slice(1);
                }
            } catch (e) {}
            var headlineText = memberLabel
                ? memberLabel + ' (' + label + ')'
                : label;
            var chip = document.createElement('div');
            chip.className = 'sd-stems-focus-chip';
            chip.id = 'sdStemsFocusChip';
            chip.dataset.stemId = stemId;
            chip.innerHTML =
                '<span style="font-size:1.1em">🎯</span>' +
                '<span class="sd-stems-focus-chip-label">Focus: ' + _sdEsc(headlineText) + '</span>' +
                '<span class="sd-stems-focus-chip-state" style="font-size:0.78em;color:#22c55e;font-weight:700">muted · playing along</span>' +
                '<span style="font-size:0.7em;color:var(--text-dim);margin-left:auto">from your task</span>';
            wrap.insertBefore(chip, wrap.firstChild);
        }
        // Auto-apply the preset so the user can just hit play.
        if (typeof window._sdStemsApplyPreset === 'function') {
            window._sdStemsApplyPreset(stemId);
        }
    } catch (e) {
        console.warn('[sd] focus-from-task failed:', e);
    }
};

// Keep the focus chip's state label honest. Called by ApplyPreset and
// ResetPresets when the active preset changes — if the user toggles the
// stem back to audible, the chip should say "audible" not "muted".
function _sdStemsRefreshFocusChipState() {
    var chip = document.getElementById('sdStemsFocusChip');
    if (!chip) return;
    var stemId = chip.dataset.stemId;
    if (!stemId) return;
    var audio = document.querySelector('.sd-stem-audio[data-stem="' + stemId + '"]');
    var muted = audio && audio.dataset.muted === '1';
    var stateEl = chip.querySelector('.sd-stems-focus-chip-state');
    if (stateEl) {
        stateEl.textContent = muted ? 'muted · playing along' : 'audible · listening';
        stateEl.style.color = muted ? '#22c55e' : '#94a3b8';
    }
}

// Visual state mirroring — dim a stem row whenever its audio is muted (by
// the mute button, the solo "everyone-else-off" mechanic, or a Practice
// preset). Without this, the active-mode banner is the ONLY signal that
// the mix sounds different than the raw stems. Now the row itself fades.
function _sdStemsRefreshAllRowDims() {
    document.querySelectorAll('.sd-stem-row').forEach(function(row) {
        var stemId = row.dataset.stem;
        var audio = document.querySelector('.sd-stem-audio[data-stem="' + stemId + '"]');
        if (!audio) return;
        var dimmed = (audio.dataset.muted === '1' || audio.dataset.soloOff === '1');
        row.style.transition = 'opacity 0.15s';
        row.style.opacity = dimmed ? '0.42' : '1';
    });
}

window._sdStemsToggle = async function() {
    var btn = document.getElementById('sdStemsPlay');
    // Scope to `document` (not _sdContainer) so we still find audios after
    // the wrap has been reparented to <body> for fullscreen mode.
    var audios = document.querySelectorAll('.sd-stem-audio');
    if (!audios.length) return;
    // First play resumes the suspended AudioContext (iOS Safari requires
    // a user gesture). Safe to call repeatedly.
    if (_sdStemsState && _sdStemsState.ctx && _sdStemsState.ctx.state === 'suspended') {
        try { _sdStemsState.ctx.resume(); } catch(e) {}
    }
    var anyPlaying = Array.prototype.some.call(audios, function(a){return !a.paused;});
    if (anyPlaying) {
        audios.forEach(function(a){a.pause();});
        if (btn) btn.textContent = '▶ Play';
    } else {
        // P1.4 (2026-05-08): gesture-arm each <audio> synchronously inside this
        // user-gesture handler BEFORE any `await`. iOS Safari requires a user
        // gesture to start playback per-element, and the gesture is consumed
        // when execution leaves the event handler — so any `play()` after the
        // count-in `await` below silently rejects on first attempt. Priming
        // each element with muted play()+pause() inside the gesture unlocks it
        // for later scripted play() calls. Idempotent — safe to call every time.
        if (_sdStemsState && !_sdStemsState._armed) {
            _sdStemsState._armed = true;
            audios.forEach(function(a) {
                try {
                    a.muted = true;
                    var pr = a.play();
                    a.pause();
                    a.muted = false;
                    if (pr && typeof pr.catch === 'function') {
                        pr.catch(function(err) {
                            console.warn('[Stems] gesture-arm play() rejected for ' + a.dataset.stem + ':', err && err.name);
                        });
                    }
                } catch(e) {}
            });
        }
        // Count-in (4 metronome ticks at song BPM) before audio starts.
        // The async/await means we can't bail mid-count without a flag —
        // pause during count-in just lets it finish, no audio plays.
        if (window._sdCountInEnabled !== false) {
            try { await _sdStemsCountIn(); } catch(e) {}
        }
        var t = audios[0].currentTime || 0;
        var _failures = 0;
        var _attempts = 0;
        audios.forEach(function(a){
            try { a.currentTime = t; } catch(e) {}
            _attempts++;
            a.play().catch(function(err) {
                _failures++;
                console.warn('[Stems] play() rejected for ' + a.dataset.stem + ':', err && err.name);
                // If ALL stems failed (and no fallback hint visible), surface a
                // tiny inline cue near the play button so the user knows to tap
                // again. Avoids a silent failure mode on iOS Safari edge cases.
                if (_failures === _attempts && !document.getElementById('sd-stems-tap-hint')) {
                    var hint = document.createElement('div');
                    hint.id = 'sd-stems-tap-hint';
                    hint.style.cssText = 'position:absolute;margin-top:6px;font-size:0.72em;color:#fbbf24;font-weight:600;';
                    hint.textContent = '↻ Tap Play once more to start audio';
                    if (btn && btn.parentNode) btn.parentNode.appendChild(hint);
                    setTimeout(function() { try { hint.remove(); } catch(e2) {} }, 8000);
                }
            });
        });
        if (btn) btn.textContent = '⏸ Pause';
    }
};

// Re-run LALAL using the CURRENT Demucs vocals stem as input. Fixes bug S1
// (stale LALAL → temporal misalignment) without requiring console snippets.
// Same Path-A semantics as harmony-lab.js's hlGenerateFromStems.
//
// Progress is rendered IN-PLACE inside the warning banner (sd-lalal-stale-status)
// rather than via toasts — toasts disappear and leave the user staring at a
// silent screen for 30-60s while LALAL processes. Heavy console logging is
// added so DevTools can show exactly where execution is at any point.
window._sdStemsResyncLalal = async function(title) {
    console.log('[Stems][resync] start, title=', title);
    if (!title) title = window._sdCurrentSong;
    if (!title) {
        console.warn('[Stems][resync] no title — abort');
        if (typeof showToast === 'function') showToast('No song');
        return;
    }

    function setStatus(html, color) {
        var el = document.getElementById('sd-lalal-stale-status');
        if (!el) {
            console.warn('[Stems][resync] sd-lalal-stale-status element not found in DOM');
            return;
        }
        el.innerHTML = html;
        if (color) el.style.color = color;
    }
    function setIcon(emoji) {
        var el = document.getElementById('sd-lalal-stale-icon');
        if (el) el.textContent = emoji;
    }
    function setButton(label, disabled) {
        var btn = document.getElementById('sd-lalal-stale-button');
        if (!btn) return;
        btn.textContent = label;
        btn.disabled = !!disabled;
        btn.style.opacity = disabled ? '0.5' : '1';
        btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }

    if (!window.GLStems || typeof GLStems.splitLeadBacking !== 'function') {
        console.error('[Stems][resync] GLStems.splitLeadBacking missing');
        setStatus('<div style="font-weight:700">Stems engine not loaded</div>');
        return;
    }
    if (!confirm('Re-run LALAL using the current Demucs vocals stem? Takes ~30-60s and uses one LALAL credit.')) {
        console.log('[Stems][resync] user cancelled at confirm');
        return;
    }

    setIcon('⏳');
    setButton('Working…', true);
    setStatus('<div style="font-weight:700;margin-bottom:2px">Loading Demucs vocals stem…</div>' +
              '<div style="font-size:0.88em;opacity:0.85;line-height:1.4">Step 1 of 3</div>');

    var stems;
    try {
        stems = await GLStems.getStems(title);
        console.log('[Stems][resync] got stems record:', stems);
    } catch(e) {
        console.error('[Stems][resync] GLStems.getStems threw:', e);
        setIcon('⚠️');
        setButton('🔄 Re-sync LALAL', false);
        setStatus('<div style="font-weight:700">Could not load stems: ' + (e.message || 'unknown') + '</div>');
        return;
    }
    if (!stems || !stems.stems || !stems.stems.vocals) {
        console.warn('[Stems][resync] no Demucs vocals stem found');
        setIcon('⚠️');
        setButton('🔄 Re-sync LALAL', false);
        setStatus('<div style="font-weight:700">No Demucs vocals stem found — run Demucs first</div>');
        return;
    }
    console.log('[Stems][resync] vocals URL:', stems.stems.vocals);

    setStatus('<div style="font-weight:700;margin-bottom:2px">🔄 Sending vocals to LALAL…</div>' +
              '<div style="font-size:0.88em;opacity:0.85;line-height:1.4">Step 2 of 3 · this can take 10-30s before progress starts</div>');

    try {
        var split = await GLStems.splitLeadBacking(title, {
            sourceUrl: stems.stems.vocals,
            sourceLabel: 'Demucs vocals stem',
            onProgress: function(stage, pct) {
                console.log('[Stems][resync] onProgress stage=' + stage + ' pct=' + pct);
                var msg, sub;
                if (stage === 'uploading') {
                    msg = '🔄 Uploading vocals to LALAL…';
                    sub = 'Step 2 of 3';
                } else if (stage === 'processing') {
                    msg = '🔄 LALAL is splitting Lead / Backing…';
                    sub = 'Step 2 of 3 · ' + (pct != null ? pct + '%' : 'working');
                } else if (stage === 'downloading') {
                    msg = '🔄 Downloading split stems…';
                    sub = 'Step 3 of 3';
                } else {
                    msg = '🔄 LALAL: ' + stage;
                    sub = pct != null ? pct + '%' : '';
                }
                setStatus('<div style="font-weight:700;margin-bottom:2px">' + msg + '</div>' +
                          '<div style="font-size:0.88em;opacity:0.85;line-height:1.4">' + sub + '</div>');
            }
        });
        console.log('[Stems][resync] splitLeadBacking returned:', split);
        if (split && split.stems && split.stems.lead) {
            setIcon('✅');
            setStatus('<div style="font-weight:700;margin-bottom:2px">LALAL re-synced — re-loading stems</div>' +
                      '<div style="font-size:0.88em;opacity:0.85;line-height:1.4">Lead/Backing now aligned with current Demucs run</div>');
            // Re-render stems lens so the new aligned Lead/Backing load
            try { if (window._sdLensPopulated) window._sdLensPopulated.stems = false; } catch(e) {}
            if (typeof _sdPopulateStemsLens === 'function') {
                console.log('[Stems][resync] calling _sdPopulateStemsLens to re-render');
                _sdPopulateStemsLens(title);
            } else {
                console.warn('[Stems][resync] _sdPopulateStemsLens not defined — cannot re-render');
            }
        } else {
            console.warn('[Stems][resync] split returned but no lead stem:', split);
            setIcon('⚠️');
            setButton('🔄 Re-sync LALAL', false);
            setStatus('<div style="font-weight:700">LALAL returned no lead stem</div>' +
                      '<div style="font-size:0.88em;opacity:0.85;line-height:1.4">Try again, or check the LALAL credit balance</div>');
        }
    } catch(e) {
        console.error('[Stems][resync] LALAL re-sync threw:', e);
        setIcon('⚠️');
        setButton('🔄 Re-sync LALAL', false);
        setStatus('<div style="font-weight:700">Re-sync failed: ' + (e.message || 'unknown') + '</div>' +
                  '<div style="font-size:0.88em;opacity:0.85;line-height:1.4">See DevTools console for details</div>');
    }
};

window._sdStemsRedo = async function(title) {
    var rec = window._sdLastStemsRec || {};
    var dropdown = document.getElementById('sdStemsRedoModel');
    var newModel = dropdown ? dropdown.value : (rec.model || 'htdemucs_6s');
    var hasSavedSource = !!(rec.sourceUrl || rec.driveFileId || rec.firebaseAudioRef);

    // No saved source (legacy stems record from before this change) — fall
    // back to the old behavior: clear stems and re-render setup view.
    if (!hasSavedSource) {
        if (!confirm('No saved source for this run. Open setup view to re-enter?')) return;
        if (window.GLStems) await GLStems.clearStems(title);
        _sdLensPopulated.stems = false;
        _sdPopulateStemsLens(title);
        return;
    }

    var modelChanged = newModel !== (rec.model || 'htdemucs_6s');
    var msg = modelChanged
        ? 'Re-separate with ' + newModel + '? (current: ' + (rec.model || '?') + ')'
        : 'Re-run separation with ' + newModel + '?';
    if (!confirm(msg)) return;

    var opts = { sourceLabel: rec.sourceLabel || 'Saved source', model: newModel };

    if (rec.sourceUrl) {
        opts.sourceUrl = rec.sourceUrl;
    } else if (rec.driveFileId) {
        opts.driveFileId = rec.driveFileId;
        if (typeof accessToken !== 'undefined' && accessToken) {
            opts.accessToken = accessToken;
        } else {
            alert('Sign in to Google first — Drive source needs an auth token.');
            return;
        }
    } else if (rec.firebaseAudioRef) {
        // Re-fetch base64 from Firebase using the saved pointer.
        var ref = rec.firebaseAudioRef;
        var parts = ref.replace('firebase-audio://', '').split('/');
        var fbTitle = decodeURIComponent(parts[0] || '');
        var fbKey = parts.slice(1).join('/');
        try {
            var data = await loadBandDataFromDrive(fbTitle, fbKey);
            if (!data || !data.data) throw new Error('Firebase audio not found');
            opts.audioDataUrl = data.data;
            opts.firebaseAudioRef = ref;
        } catch (e) {
            alert('Could not load saved Firebase audio: ' + (e.message || e));
            return;
        }
    }

    _sdRunStemSeparationFromTake(title, opts);
};

// Re-renders the setup view (URL paste + Best Shot picker) so the user can
// run a new separation against a different source. Doesn't delete the R2
// files — just clears the stems band-data record so _sdPopulateStemsLens
// falls back to setup. Use this for source swaps; use _sdStemsRedo when
// you want to keep the same source and only change models.
window._sdStemsChangeSource = async function(title) {
    if (!confirm('Pick a different source for ' + title + '?\n\nThis clears the current stem record so you can paste a new URL or pick a different Best Shot. The existing stem files stay in R2 (only this song\'s pointer to them is cleared).')) return;
    if (window.GLStems) {
        try { await GLStems.clearStems(title); } catch (e) {}
    }
    _sdLensPopulated.stems = false;
    _sdPopulateStemsLens(title);
};

// ── Phase 2: Spatial split panel ──────────────────────────────────────────
// Opens an inline overlay anchored on the stems panel. Lets the user pick
// pan windows + reference fingerprints, then runs the split.

// Delegated click handler for the per-stem ⋮ menu actions. Reads data
// attributes off the clicked button and dispatches to the right function.
// Bound once on first lens render so subsequent re-renders don't stack
// listeners. Wraps the dispatch in try/catch with visible error so silent
// failures (which is what Drew was hitting) become obvious immediately.
var _sdStemsMenuActionBound = false;
function _sdEnsureStemsMenuActionBound() {
    if (_sdStemsMenuActionBound) return;
    document.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest && e.target.closest('.sd-stems-menu-action');
        if (!btn) return;
        var action = btn.dataset.action;
        try {
            window._sdStemsCloseAllOverflows && window._sdStemsCloseAllOverflows();
            if (action === 'spatial-split') {
                console.log('[stems] spatial-split menu action', {
                    song: btn.dataset.song,
                    stemId: btn.dataset.stemId,
                    sourceUrl: btn.dataset.sourceUrl,
                    label: btn.dataset.stemLabel
                });
                window._sdStemsOpenSpatialPanel(
                    btn.dataset.song,
                    btn.dataset.stemId,
                    btn.dataset.sourceUrl,
                    btn.dataset.stemLabel
                );
            } else if (action === 'remove-spatial-split') {
                window._sdStemsRemoveSpatialSplit(
                    btn.dataset.song,
                    btn.dataset.parentId
                );
            }
        } catch (err) {
            console.error('[stems menu action] ' + action + ' failed:', err);
            alert('Couldn\'t run "' + action + '": ' + (err && err.message ? err.message : err));
        }
    });
    _sdStemsMenuActionBound = true;
}

window._sdStemsRemoveSpatialSplit = async function(title, parentId) {
    if (!confirm('Remove the spatial split for the ' + parentId + ' stem?\n\nThis clears the split record so the original stem is no longer divided. R2 files stay until garbage-collected.')) return;
    if (window.GLStems && GLStems.clearSpatialSplitFor) {
        try { await GLStems.clearSpatialSplitFor(title, parentId); } catch (e) {}
    }
    _sdLensPopulated.stems = false;
    _sdPopulateStemsLens(title);
};

window._sdStemsOpenSpatialPanel = async function(title, stemId, sourceUrl, sourceLabel) {
    console.log('[stems] _sdStemsOpenSpatialPanel called', { title: title, stemId: stemId, sourceUrl: sourceUrl, sourceLabel: sourceLabel });
    if (!title || !stemId || !sourceUrl) {
        console.error('[stems] Missing required args:', { title: title, stemId: stemId, sourceUrl: sourceUrl });
        alert('Spatial split: missing required data (title=' + title + ', stemId=' + stemId + ', sourceUrl=' + (sourceUrl ? 'set' : 'MISSING') + ')');
        return;
    }
    // Wrap the whole body so any internal exception surfaces visibly. Async
    // functions silently swallow exceptions into rejected promises otherwise.
    try {
    var existing = document.getElementById('sdSpatialOverlay');
    if (existing) existing.remove();

    var safeSong = (title || '').replace(/'/g, "\\'");
    var overlay = document.createElement('div');
    overlay.id = 'sdSpatialOverlay';
    // Window-level fixed overlay (was absolute inside the lens panel — that
    // was getting clipped by ancestor overflow:hidden somewhere up the tree
    // so the panel rendered but never showed up). Top z-index, fixed inset.
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,0.92);backdrop-filter:blur(6px);overflow-y:auto;padding:24px;color:var(--text)';
    overlay.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">'
      +   '<div>'
      +     '<div style="font-size:1.1em;font-weight:700">↳ Spatial split — ' + _sdEsc(sourceLabel || stemId) + '</div>'
      +     '<div style="font-size:0.78em;color:var(--text-dim);margin-top:2px;max-width:580px">Split by where each frequency lives in stereo space, optionally biased toward a tone fingerprint. Best for separating two players of the same instrument (e.g. Bobby vs Jerry).</div>'
      +   '</div>'
      +   '<button onclick="document.getElementById(\'sdSpatialOverlay\').remove()" style="padding:5px 11px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);border-radius:6px;cursor:pointer;font-size:0.85em">✕</button>'
      + '</div>'
      + '<div id="sdSpHist" style="margin-bottom:12px;padding:10px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.02)">'
      +   '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px">Energy by pan position <span id="sdSpHistStatus">— analyzing…</span></div>'
      +   '<canvas id="sdSpHistCanvas" width="800" height="60" style="width:100%;height:60px;display:block"></canvas>'
      +   '<div style="display:flex;justify-content:space-between;font-size:0.65em;color:var(--text-dim);margin-top:4px"><span>← Hard left</span><span>Center</span><span>Hard right →</span></div>'
      + '</div>'
      + '<div id="sdSpZones"></div>'
      + '<div style="margin-top:14px;padding:10px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.02)">'
      +   '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +     '<div style="font-size:0.85em;font-weight:700">Reference clips (tone fingerprints)</div>'
      +     '<button id="sdSpAddFp" style="padding:4px 10px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);border-radius:6px;cursor:pointer;font-size:0.78em">+ Add reference</button>'
      +   '</div>'
      +   '<div style="font-size:0.7em;color:var(--text-dim);margin-bottom:8px">Upload a clean isolated clip of e.g. Jerry\'s tone. Used to bias each pan zone toward whoever\'s tone matches better. Optional but powerful when one player is hard to isolate by pan alone.</div>'
      +   '<div id="sdSpFpList" style="display:flex;flex-direction:column;gap:6px"></div>'
      + '</div>'
      + '<div style="margin-top:14px;padding:10px;border:1px solid var(--border);border-radius:8px;background:rgba(255,255,255,0.02);display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
      +   '<label style="font-size:0.85em;font-weight:700">Fingerprint strength</label>'
      +   '<input type="range" id="sdSpFpStrength" min="0" max="100" value="50" style="flex:1;min-width:140px">'
      +   '<span id="sdSpFpStrengthVal" style="font-size:0.78em;color:var(--text-dim);min-width:60px;text-align:right;font-variant-numeric:tabular-nums">50%</span>'
      +   '<div style="flex-basis:100%;font-size:0.65em;color:var(--text-dim)">0% = pan only · 50% = balanced (recommended) · 100% = aggressive timbral bias</div>'
      + '</div>'
      + '<div id="sdSpRunRow" style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px">'
      +   '<button onclick="document.getElementById(\'sdSpatialOverlay\').remove()" style="padding:9px 15px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);border-radius:8px;cursor:pointer;font-size:0.88em">Cancel</button>'
      +   '<button id="sdSpRun" onclick="_sdStemsRunSpatial(\'' + safeSong + '\', \'' + _sdEsc(stemId) + '\', \'' + _sdEsc(sourceUrl) + '\', \'' + _sdEsc(sourceLabel || stemId) + '\')" style="padding:9px 18px;border:0;background:linear-gradient(90deg,#22d3ee,#a78bfa);color:#0f172a;border-radius:8px;cursor:pointer;font-size:0.9em;font-weight:700">↳ Run spatial split</button>'
      + '</div>';
    // Append to <body> directly so the fixed-position overlay always shows
    // above all app chrome regardless of ancestor stacking contexts.
    document.body.appendChild(overlay);
    console.log('[stems] Overlay appended to body. position=fixed, z-index=2147483647');

    // Try to load existing spatial-split state for this stem so renames,
    // pan-window adjustments, and fingerprint assignments persist across
    // panel re-opens. Without this, every re-open silently resets to the
    // generic defaults (left_lead/center/right_lead, fp_strength=50%, no
    // fingerprints) — and on Run, the persisted record gets overwritten
    // with those defaults, destroying the user's prior tuning.
    var existingZones = null;
    var existingFpStrength = null;
    if (window.GLStems && GLStems.getSpatialSplits) {
        try {
            var splits = await GLStems.getSpatialSplits(title);
            var rec = (splits || []).find(function(r) { return r && r.sourceStemId === stemId; });
            if (rec && Array.isArray(rec.panWindows) && rec.panWindows.length) {
                existingZones = rec.panWindows;
                if (typeof rec.fpStrength === 'number') existingFpStrength = rec.fpStrength;
            }
        } catch(e) { console.warn('[stems] could not load existing split state:', e); }
    }
    var defaultColors = ['#f59e0b', '#a78bfa', '#22d3ee'];
    var defaultHints  = ['Jerry / left side', 'Center / shared content', 'Bob / right side'];
    var zones;
    if (existingZones) {
        zones = existingZones.map(function(w, i) {
            return {
                name: w.name || ('zone_' + i),
                pan_min: typeof w.pan_min === 'number' ? w.pan_min : -1.0,
                pan_max: typeof w.pan_max === 'number' ? w.pan_max :  1.0,
                color: defaultColors[i % defaultColors.length],
                hint: defaultHints[i] || '',
                fingerprint_ref: w.fingerprint_ref || null
            };
        });
    } else {
        zones = [
            { name: 'left_lead',  pan_min: -1.0, pan_max: -0.3, color: '#f59e0b', hint: 'Jerry / left side' },
            { name: 'center',     pan_min: -0.3, pan_max:  0.3, color: '#a78bfa', hint: 'Center / shared content' },
            { name: 'right_lead', pan_min:  0.3, pan_max:  1.0, color: '#22d3ee', hint: 'Bob / right side' }
        ];
    }
    window._sdSpZones = zones;
    _sdRenderSpatialZones();
    _sdRenderSpatialFpList();

    var fpStrengthEl = document.getElementById('sdSpFpStrength');
    if (fpStrengthEl) {
        // Restore prior fp_strength if there's a persisted split for this stem.
        if (existingFpStrength !== null) {
            var pct = Math.round(existingFpStrength * 100);
            fpStrengthEl.value = pct;
            var fpLbl = document.getElementById('sdSpFpStrengthVal');
            if (fpLbl) fpLbl.textContent = pct + '%';
        }
        fpStrengthEl.addEventListener('input', function(e) {
            var lbl = document.getElementById('sdSpFpStrengthVal');
            if (lbl) lbl.textContent = e.target.value + '%';
        });
    }
    var fpAddBtn = document.getElementById('sdSpAddFp');
    if (fpAddBtn) fpAddBtn.onclick = _sdStemsAddFingerprintPrompt;

    // Async pan-analyze to refine the histogram + suggested windows.
    if (window.GLStems && GLStems.analyzePan) {
        try {
            var analysis = await GLStems.analyzePan(sourceUrl);
            _sdRenderSpatialHistogram(analysis.histogram || []);
            var status = document.getElementById('sdSpHistStatus');
            if (status) status.textContent = '';
        } catch (e) {
            var status2 = document.getElementById('sdSpHistStatus');
            if (status2) status2.textContent = '— couldn\'t analyze (' + (e.message || e) + ')';
        }
    }
    } catch (err) {
        console.error('[stems] _sdStemsOpenSpatialPanel threw:', err);
        alert('Spatial split panel error: ' + (err && err.message ? err.message : err));
    }
};

function _sdRenderSpatialZones() {
    var zones = window._sdSpZones || [];
    var fps = window._sdSpFps || {};
    var fpNames = Object.keys(fps);
    // Per-zone dropdown so we can pre-select the saved fingerprint_ref when
    // the user re-opens a panel that already had refs assigned. Without this,
    // every re-open silently resets every zone to "— none —".
    var fpOptionsFor = function(currentRef) {
        var none = (!currentRef) ? ' selected' : '';
        var opts = '<option value=""' + none + '>— none —</option>';
        fpNames.forEach(function(n) {
            var sel = (n === currentRef) ? ' selected' : '';
            opts += '<option value="' + _sdEsc(n) + '"' + sel + '>' + _sdEsc(n) + '</option>';
        });
        return opts;
    };
    var html = zones.map(function(z, i) {
        var minPct = (z.pan_min + 1) * 50;  // -1..+1 → 0..100
        var maxPct = (z.pan_max + 1) * 50;
        return '<div class="sd-sp-zone" data-zone-idx="' + i + '" style="margin-bottom:10px;padding:10px;border:1px solid ' + z.color + ';border-radius:8px;background:rgba(255,255,255,0.02)">'
          + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">'
          +   '<input type="text" class="sd-sp-zone-name" value="' + _sdEsc(z.name) + '" data-idx="' + i + '" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);color:' + z.color + ';font-weight:700;padding:4px 8px;border-radius:5px;font-size:0.88em;width:140px">'
          +   '<span style="font-size:0.7em;color:var(--text-dim);flex:1">' + _sdEsc(z.hint || '') + '</span>'
          +   '<select class="sd-sp-zone-fp" data-idx="' + i + '" title="Bias this zone toward a tone fingerprint" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:5px;font-size:0.78em">' + fpOptionsFor(z.fingerprint_ref) + '</select>'
          + '</div>'
          + '<div style="position:relative;height:18px;background:rgba(255,255,255,0.04);border-radius:9px;margin:6px 0">'
          +   '<div class="sd-sp-zone-band" style="position:absolute;top:0;bottom:0;background:' + z.color + ';opacity:0.55;border-radius:9px;left:' + minPct + '%;width:' + (maxPct - minPct) + '%"></div>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:10px;font-size:0.72em;color:var(--text-dim)">'
          +   '<span style="width:30px">Min</span>'
          +   '<input type="range" class="sd-sp-zone-min" data-idx="' + i + '" min="-100" max="100" value="' + Math.round(z.pan_min * 100) + '" style="flex:1;accent-color:' + z.color + '">'
          +   '<span class="sd-sp-zone-min-val" data-idx="' + i + '" style="width:42px;text-align:right;font-variant-numeric:tabular-nums">' + z.pan_min.toFixed(2) + '</span>'
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:10px;font-size:0.72em;color:var(--text-dim);margin-top:4px">'
          +   '<span style="width:30px">Max</span>'
          +   '<input type="range" class="sd-sp-zone-max" data-idx="' + i + '" min="-100" max="100" value="' + Math.round(z.pan_max * 100) + '" style="flex:1;accent-color:' + z.color + '">'
          +   '<span class="sd-sp-zone-max-val" data-idx="' + i + '" style="width:42px;text-align:right;font-variant-numeric:tabular-nums">' + z.pan_max.toFixed(2) + '</span>'
          + '</div>'
          + '</div>';
    }).join('');
    var container = document.getElementById('sdSpZones');
    if (!container) return;
    container.innerHTML = html;

    container.querySelectorAll('.sd-sp-zone-min').forEach(function(el) {
        el.addEventListener('input', function(e) {
            var i = +e.target.dataset.idx;
            var v = +e.target.value / 100;
            window._sdSpZones[i].pan_min = v;
            container.querySelector('.sd-sp-zone-min-val[data-idx="' + i + '"]').textContent = v.toFixed(2);
            _sdUpdateZoneBand(i);
        });
    });
    container.querySelectorAll('.sd-sp-zone-max').forEach(function(el) {
        el.addEventListener('input', function(e) {
            var i = +e.target.dataset.idx;
            var v = +e.target.value / 100;
            window._sdSpZones[i].pan_max = v;
            container.querySelector('.sd-sp-zone-max-val[data-idx="' + i + '"]').textContent = v.toFixed(2);
            _sdUpdateZoneBand(i);
        });
    });
    container.querySelectorAll('.sd-sp-zone-name').forEach(function(el) {
        el.addEventListener('input', function(e) {
            var i = +e.target.dataset.idx;
            window._sdSpZones[i].name = e.target.value.trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) || ('zone_' + i);
        });
    });
    container.querySelectorAll('.sd-sp-zone-fp').forEach(function(el) {
        el.addEventListener('change', function(e) {
            var i = +e.target.dataset.idx;
            window._sdSpZones[i].fingerprint_ref = e.target.value || null;
        });
    });
}

function _sdUpdateZoneBand(i) {
    var zone = window._sdSpZones[i];
    var band = document.querySelector('.sd-sp-zone[data-zone-idx="' + i + '"] .sd-sp-zone-band');
    if (!band) return;
    var minPct = (zone.pan_min + 1) * 50;
    var maxPct = (zone.pan_max + 1) * 50;
    var lo = Math.min(minPct, maxPct);
    var hi = Math.max(minPct, maxPct);
    band.style.left = lo + '%';
    band.style.width = (hi - lo) + '%';
}

function _sdRenderSpatialHistogram(hist, canvasId) {
    var canvas = document.getElementById(canvasId || 'sdSpHistCanvas');
    if (!canvas || !hist || !hist.length) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // Background gradient L→R for orientation
    var grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(245,158,11,0.08)');
    grad.addColorStop(0.5, 'rgba(167,139,250,0.06)');
    grad.addColorStop(1, 'rgba(34,211,238,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    var maxV = Math.max.apply(Math, hist);
    if (maxV <= 0) return;
    var bw = W / hist.length;
    for (var i = 0; i < hist.length; i++) {
        var h = (hist[i] / maxV) * (H - 6);
        var center = (i + 0.5) / hist.length;  // 0..1
        var hue = center < 0.5 ? 38 + center * 30 : 197 - (center - 0.5) * 30;
        ctx.fillStyle = 'hsl(' + hue + ',75%,62%)';
        ctx.fillRect(i * bw + 1, H - h - 2, bw - 2, h);
    }
    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
}

function _sdRenderSpatialFpList() {
    var list = document.getElementById('sdSpFpList');
    if (!list) return;
    var fps = window._sdSpFps || {};
    var names = Object.keys(fps);
    if (!names.length) {
        list.innerHTML = '<div style="font-size:0.72em;color:var(--text-dim);font-style:italic">No reference clips yet. Add one above to enable tone biasing.</div>';
        return;
    }
    list.innerHTML = names.map(function(n) {
        var fp = fps[n];
        var src = fp.sourceLabel || fp.sourceUrl || '';
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px">'
          + '<span style="font-weight:700;font-size:0.82em">' + _sdEsc(n) + '</span>'
          + '<span style="flex:1;font-size:0.7em;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _sdEsc(src) + '</span>'
          + '<button onclick="_sdStemsDeleteFingerprint(\'' + _sdEsc(n) + '\')" title="Delete" style="padding:3px 8px;border:1px solid var(--border);background:rgba(239,68,68,0.1);color:#fca5a5;border-radius:5px;cursor:pointer;font-size:0.72em">✕</button>'
          + '</div>';
    }).join('');
}

window._sdStemsAddFingerprintPrompt = async function() {
    var name = prompt('Reference name (e.g. "Jerry — Wolf 1977", "Bob Mesa"):');
    if (!name || !name.trim()) return;
    name = name.trim();
    var url = prompt('Public URL of a clean reference clip (10-60s of just this player works best):');
    if (!url || !url.trim()) return;
    url = url.trim();
    var label = prompt('Optional source label (e.g. "Workingman\'s Dead - isolated Jerry"):', '') || '';

    var btn = document.getElementById('sdSpAddFp');
    var origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Computing fingerprint…'; }
    try {
        var result = await GLStems.fingerprintTone(url, { sourceLabel: label });
        var lib = await GLStems.saveFingerprint(name, result);
        window._sdSpFps = lib;
        _sdRenderSpatialFpList();
        _sdRenderSpatialZones();  // re-render to refresh per-zone fingerprint dropdowns
        if (typeof showToast === 'function') showToast('Fingerprint saved: ' + name);
    } catch (e) {
        alert('Fingerprint failed: ' + (e.message || e));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
};

window._sdStemsDeleteFingerprint = async function(name) {
    if (!confirm('Delete reference "' + name + '"? Any zones using it will lose the bias.')) return;
    var lib = await GLStems.deleteFingerprint(name);
    window._sdSpFps = lib;
    // Drop ref from any zones currently using it
    (window._sdSpZones || []).forEach(function(z) { if (z.fingerprint_ref === name) z.fingerprint_ref = null; });
    _sdRenderSpatialFpList();
    _sdRenderSpatialZones();
};

window._sdStemsRunSpatial = async function(title, stemId, sourceUrl, sourceLabel) {
    var zones = window._sdSpZones || [];
    if (!zones.length) { alert('Add at least one pan zone.'); return; }
    var fpStrength = (+document.getElementById('sdSpFpStrength').value) / 100;
    var fps = window._sdSpFps || {};
    // Only include fingerprints that some zone actually references — saves a
    // few hundred floats round-tripping when no zone is biased.
    var referenced = {};
    zones.forEach(function(z) {
        if (z.fingerprint_ref && fps[z.fingerprint_ref]) referenced[z.fingerprint_ref] = fps[z.fingerprint_ref].fingerprint;
    });

    var panel = (_sdContainer || document).querySelector('.sd-lens-panel[data-lens="stems"]');
    var overlay = document.getElementById('sdSpatialOverlay');
    if (overlay) {
        overlay.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-dim)">'
          + '<div style="font-size:2em;margin-bottom:10px">↳</div>'
          + '<div id="sdSpStageMsg" style="font-weight:700;color:var(--text);margin-bottom:6px">Spawning DSP…</div>'
          + '<div id="sdSpStageHint" style="font-size:0.82em">Pan-window masking + fingerprint biasing.</div>'
          + '<div style="margin:18px auto 6px;max-width:280px;height:6px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden">'
          +   '<div id="sdSpProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#a78bfa);transition:width 0.5s ease"></div>'
          + '</div>'
          + '<div id="sdSpProgressPct" style="font-size:0.75em;opacity:0.7">0%</div>'
          + '</div>';
    }
    var stageLabels = {
        starting: { msg: 'Spawning DSP…', hint: 'Sending mask params to Modal.' },
        processing: { msg: 'Splitting by pan…', hint: 'STFT → mask → iSTFT for each zone (and fingerprint-bias if enabled).' },
        finalizing: { msg: 'Uploading stems…', hint: 'Saving to R2.' }
    };
    var onProgress = function(stage, percent) {
        var lbl = stageLabels[stage] || stageLabels.processing;
        var msg = document.getElementById('sdSpStageMsg');
        var hint = document.getElementById('sdSpStageHint');
        var bar = document.getElementById('sdSpProgressBar');
        var pct = document.getElementById('sdSpProgressPct');
        var p = Math.max(0, Math.min(100, +percent || 0));
        if (msg) msg.textContent = lbl.msg;
        if (hint) hint.textContent = lbl.hint;
        if (bar) bar.style.width = p + '%';
        if (pct) pct.textContent = p + '%';
    };
    try {
        await GLStems.spatialSplit(title, {
            sourceUrl: sourceUrl,
            sourceStemId: stemId,
            sourceLabel: sourceLabel,
            panWindows: zones.map(function(z) {
                return {
                    name: z.name,
                    pan_min: z.pan_min,
                    pan_max: z.pan_max,
                    soft_width: 0.15,
                    fingerprint_ref: z.fingerprint_ref || null
                };
            }),
            references: Object.keys(referenced).length ? Object.keys(referenced).reduce(function(acc, k) {
                acc[k] = referenced[k];
                return acc;
            }, {}) : null,
            fpStrength: fpStrength,
            onProgress: onProgress
        });
        if (overlay) overlay.remove();
        _sdLensPopulated.stems = false;
        _sdPopulateStemsLens(title);
        if (typeof showToast === 'function') showToast('Spatial split complete: ' + stemId);
    } catch (e) {
        if (overlay) {
            overlay.innerHTML = '<div style="padding:24px;text-align:center">'
              + '<div style="color:#ef4444;font-weight:700;margin-bottom:8px">Spatial split failed</div>'
              + '<div style="color:var(--text-dim);font-size:0.85em;margin-bottom:14px;word-break:break-word">' + _sdEsc(e.message || e) + '</div>'
              + '<button onclick="document.getElementById(\'sdSpatialOverlay\').remove()" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer">Close</button>'
              + '</div>';
        }
    }
};

// Pre-load the band fingerprint library when the song-detail module first
// touches the spatial features. Called by _sdStemsOpenSpatialPanel via a
// best-effort early load — failure is silent (the panel still renders).
(function _sdPreloadFingerprints() {
    if (window._sdSpFpsLoadStarted) return;
    window._sdSpFpsLoadStarted = true;
    if (window.GLStems && GLStems.loadFingerprints) {
        GLStems.loadFingerprints().then(function(lib) {
            window._sdSpFps = lib || {};
        }).catch(function() { window._sdSpFps = {}; });
    }
})();

// Format MM:SS for the transport time display.
function _sdStemsFmtTime(s) {
    s = Math.floor(s || 0);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}

// Single seek path — optimistic UI first (snap playhead + scrub + time
// display synchronously), then fire audio seeks. Without this you wait
// for the browser to issue Range requests on 7-8 FLAC stems and a
// `timeupdate` to fire before the playhead moves, which feels laggy.
// fastSeek (when available) seeks to the nearest keyframe and is
// noticeably faster than `currentTime =` on long FLAC files.
window._sdStemsApplySeek = function(t) {
    var audios = document.querySelectorAll('.sd-stem-audio');
    if (!audios.length) return;
    var master = audios[0];
    if (!master.duration) return;
    var clamped = Math.max(0, Math.min(master.duration, t));
    var frac = clamped / master.duration;
    // Visuals first — these are synchronous and feel instant.
    var scrub = document.getElementById('sdStemsScrub');
    var timeEl = document.getElementById('sdStemsTime');
    if (scrub) scrub.value = frac * 1000;
    if (timeEl) timeEl.textContent = _sdStemsFmtTime(clamped) + ' / ' + _sdStemsFmtTime(master.duration);
    document.querySelectorAll('.sd-stem-playhead').forEach(function(ph) {
        var w = ph.parentElement ? ph.parentElement.clientWidth : 0;
        ph.style.transform = 'translateX(' + (frac * w) + 'px)';
    });
    // Then kick the audio. fastSeek goes to nearest keyframe and returns
    // immediately; currentTime fallback waits for exact-position seek.
    audios.forEach(function(a) {
        try {
            if (typeof a.fastSeek === 'function') a.fastSeek(clamped);
            else a.currentTime = clamped;
        } catch(e) {}
    });
};

// DAW-style transport — relative seek shared by buttons + arrow keys.
window._sdStemsSeekBy = function(seconds) {
    var audios = document.querySelectorAll('.sd-stem-audio');
    if (!audios.length) return;
    var master = audios[0];
    if (!master.duration) return;
    window._sdStemsApplySeek((master.currentTime || 0) + seconds);
};

// Per-mount state. WebAudio routing is set up at mount time so volume/mute/
// solo always flow through GainNodes — no transition between native and
// engaged states. Tone.js is still lazy-loaded for PitchShift only, spliced
// into the existing chain on first ±semitone click.
var _sdStemsState = null;

// ── A/B loop + practice presets + count-in ──────────────────────────────────
// Loop state lives on _sdLoop. Markers persist across re-renders within
// the same song (cleared in _sdPopulateStemsLens between songs). Count-in
// preference lives on window so it survives re-renders too.
var _sdLoop = { inSec: null, outSec: null, enabled: false };
var _sdActivePreset = null; // stem id of the current "Practice X" mute, or null
if (typeof window._sdCountInEnabled === 'undefined') window._sdCountInEnabled = true;

// ── Read-only API surface for the PlayerEngine contract adapter (Phase C.3) ──
// Lets js/core/gl-stems-engine-contract.js read internal state without
// scraping the DOM. Pure read-only — no behavior changes here. The adapter
// uses this surface to expose the Stems mixer through the unified contract
// (CAPABILITIES.STEMS / LOOP / TEMPO / PITCH / etc) without forcing an
// extraction. Drew's C.3 directive: adapter-only, zero regression risk.
window._sdStemsAPI = {
    isMounted: function () { return _sdStemsState !== null; },
    getStemsRec: function () { return window._sdLastStemsRec || null; },
    getStemList: function () {
        var rec = window._sdLastStemsRec;
        if (!rec) return [];
        if (window.GLAudioSession && GLAudioSession.mergeTracks) {
            return GLAudioSession.mergeTracks(rec, null, window._sdLastSpatialSplits || []);
        }
        return rec.stems
            ? Object.keys(rec.stems).map(function (id) { return rec.stems[id]; })
            : [];
    },
    getMasterAudio: function () {
        return document.querySelector('.sd-stem-audio') || null;
    },
    getCurrentTime: function () {
        var m = this.getMasterAudio(); return m ? (m.currentTime || 0) : 0;
    },
    getDuration: function () {
        var m = this.getMasterAudio(); return m ? (m.duration || 0) : 0;
    },
    isPlaying: function () {
        var m = this.getMasterAudio(); return !!(m && !m.paused);
    },
    getTempo: function () {
        var m = this.getMasterAudio(); return m ? (m.playbackRate || 1) : 1;
    },
    getPitchSemitones: function () {
        return (_sdStemsState && _sdStemsState.pitchSemitones) || 0;
    },
    getLoop: function () {
        return { inSec: _sdLoop.inSec, outSec: _sdLoop.outSec, enabled: _sdLoop.enabled };
    },
    getActivePreset: function () { return _sdActivePreset; },
    getCountInEnabled: function () { return window._sdCountInEnabled !== false; },
    isFullscreen: function () {
        var w = document.querySelector('.sd-stems-wrap');
        return !!(w && w.classList && w.classList.contains('sd-stems-fullscreen'));
    },
    getStemRowState: function (stemId) {
        var row = document.querySelector('.sd-stem-row[data-stem="' + stemId + '"]');
        if (!row) return null;
        var vol  = row.querySelector('.sd-stem-vol');
        var pan  = row.querySelector('.sd-stem-pan');
        var soloBtn = row.querySelector('.sd-stem-solo');
        var audio = document.querySelector('.sd-stem-audio[data-stem="' + stemId + '"]');
        return {
            volume: vol ? Number(vol.value) / 100 : null,
            pan:    pan ? Number(pan.value) / 100 : null,
            muted:  !!(audio && audio.dataset.muted === '1'),
            soloed: !!(soloBtn && soloBtn.dataset.active === '1')
        };
    },
    getRecentLoops: function () {
        try { return JSON.parse(localStorage.getItem('gl_recent_loops') || '[]'); }
        catch (e) { return []; }
    }
};

window._sdStemsSetLoopMarker = function(t) {
    if (_sdLoop.inSec == null || _sdLoop.outSec != null) {
        // Fresh marker pair — set IN, clear OUT (loop disabled until OUT lands).
        _sdLoop.inSec = t;
        _sdLoop.outSec = null;
        _sdLoop.enabled = false;
    } else {
        // IN already set → this becomes OUT. Swap if user clicked before IN.
        if (t < _sdLoop.inSec) {
            _sdLoop.outSec = _sdLoop.inSec;
            _sdLoop.inSec = t;
        } else {
            _sdLoop.outSec = t;
        }
        // Reject zero-length (single-point click) — keep IN, wait for real OUT.
        if (_sdLoop.outSec - _sdLoop.inSec < 0.05) {
            _sdLoop.outSec = null;
            _sdStemsRedrawLoopMarkers();
            return;
        }
        _sdLoop.enabled = true; // auto-enable on second click
    }
    _sdStemsRedrawLoopUI();
};

window._sdStemsToggleLoop = function() {
    if (_sdLoop.inSec == null || _sdLoop.outSec == null) {
        if (typeof showToast === 'function') showToast('Hit [ to mark IN, ] to mark OUT — or shift-click a strip');
        return;
    }
    _sdLoop.enabled = !_sdLoop.enabled;
    _sdStemsRedrawLoopUI();
    _sdNotifyPracticeSessionLoop();
};

// Notify PracticeSession (Wave 2 storage layer) that the loop region or
// stems config changed. No-op when PracticeSession isn't loaded or when
// no session is active. Update is debounced inside PracticeSession.update.
function _sdNotifyPracticeSessionLoop() {
    if (typeof GLStore === 'undefined' || !GLStore.PracticeSession) return;
    if (!GLStore.PracticeSession.has()) return;
    var section = (_sdLoop.inSec != null && _sdLoop.outSec != null)
        ? { in: _sdLoop.inSec, out: _sdLoop.outSec }
        : null;
    GLStore.PracticeSession.update({ section: section });
}
function _sdNotifyPracticeSessionStems(stemId) {
    if (typeof GLStore === 'undefined' || !GLStore.PracticeSession) return;
    if (!GLStore.PracticeSession.has()) return;
    GLStore.PracticeSession.update({
        settings: {
            stemPreset: stemId ? 'mute-stem' : null,
            stemId: stemId || null
        }
    });
}

// Explicit IN/OUT setters used by the loop-bar buttons + keyboard. Unlike
// the shift-click "alternating" pattern, these always set the named side
// at the playhead and revalidate ordering — if the new value would make
// the loop range zero/negative, the other side is cleared.
window._sdStemsSetLoopIn = function(t) {
    _sdLoop.inSec = t;
    if (_sdLoop.outSec != null && _sdLoop.outSec - _sdLoop.inSec < 0.05) {
        _sdLoop.outSec = null;
        _sdLoop.enabled = false;
    }
    if (_sdLoop.inSec != null && _sdLoop.outSec != null) _sdLoop.enabled = true;
    _sdStemsRedrawLoopUI();
    _sdNotifyPracticeSessionLoop();
};
window._sdStemsSetLoopOut = function(t) {
    _sdLoop.outSec = t;
    if (_sdLoop.inSec != null && _sdLoop.outSec - _sdLoop.inSec < 0.05) {
        _sdLoop.inSec = null;
        _sdLoop.enabled = false;
    }
    if (_sdLoop.inSec != null && _sdLoop.outSec != null) _sdLoop.enabled = true;
    _sdStemsRedrawLoopUI();
    _sdNotifyPracticeSessionLoop();
};
window._sdStemsSetLoopInHere = function() {
    var audios = document.querySelectorAll('.sd-stem-audio');
    if (!audios.length) return;
    window._sdStemsSetLoopIn(audios[0].currentTime || 0);
};
window._sdStemsSetLoopOutHere = function() {
    var audios = document.querySelectorAll('.sd-stem-audio');
    if (!audios.length) return;
    window._sdStemsSetLoopOut(audios[0].currentTime || 0);
};

window._sdStemsClearLoop = function() {
    _sdLoop = { inSec: null, outSec: null, enabled: false };
    _sdStemsRedrawLoopUI();
};

// Live preview while drag-defining a loop. Paints the same band element
// _sdStemsRedrawLoopMarkers uses, on every wrap simultaneously, so the
// loop region reads consistently across all stems during the drag. After
// commit/cancel, _sdStemsRedrawLoopMarkers takes over (commits the new
// state or restores the previous one).
function _sdStemsPaintLoopPreview(t1, t2) {
    var audios = document.querySelectorAll('.sd-stem-audio');
    if (!audios.length) return;
    var dur = audios[0].duration || 0;
    if (!dur) return;
    document.querySelectorAll('.sd-stem-activity-wrap').forEach(function(w) {
        var band = w.querySelector('.sd-stem-loop-band');
        if (!band) return;
        var width = w.clientWidth;
        band.style.display = 'block';
        band.style.left = (t1 / dur * width) + 'px';
        band.style.width = ((t2 - t1) / dur * width) + 'px';
        band.style.background = 'rgba(255,235,150,0.18)';
    });
}

function _sdStemsRedrawLoopMarkers() {
    var wraps = document.querySelectorAll('.sd-stem-activity-wrap');
    var audios = document.querySelectorAll('.sd-stem-audio');
    if (!audios.length) return;
    var dur = audios[0].duration || 0;
    if (!dur) return;
    wraps.forEach(function(wrap) {
        var w = wrap.clientWidth;
        var inEl = wrap.querySelector('.sd-stem-loop-marker[data-side="in"]');
        var outEl = wrap.querySelector('.sd-stem-loop-marker[data-side="out"]');
        var band = wrap.querySelector('.sd-stem-loop-band');
        if (inEl) {
            if (_sdLoop.inSec != null) {
                inEl.style.display = 'block';
                inEl.style.transform = 'translateX(' + (_sdLoop.inSec / dur * w) + 'px)';
            } else { inEl.style.display = 'none'; }
        }
        if (outEl) {
            if (_sdLoop.outSec != null) {
                outEl.style.display = 'block';
                outEl.style.transform = 'translateX(' + (_sdLoop.outSec / dur * w) + 'px)';
            } else { outEl.style.display = 'none'; }
        }
        if (band) {
            if (_sdLoop.inSec != null && _sdLoop.outSec != null) {
                band.style.display = 'block';
                band.style.left = (_sdLoop.inSec / dur * w) + 'px';
                band.style.width = ((_sdLoop.outSec - _sdLoop.inSec) / dur * w) + 'px';
                band.style.background = _sdLoop.enabled ? 'rgba(255,235,150,0.22)' : 'rgba(255,255,255,0.08)';
            } else {
                band.style.display = 'none';
            }
        }
    });
}

function _sdStemsRedrawLoopUI() {
    var inEl = document.getElementById('sdStemsLoopIn');
    var outEl = document.getElementById('sdStemsLoopOut');
    var btn = document.getElementById('sdStemsLoopToggle');
    var bar = document.getElementById('sdStemsLoopBar');
    if (inEl) inEl.textContent = _sdLoop.inSec != null ? _sdStemsFmtTime(_sdLoop.inSec) : '—';
    if (outEl) outEl.textContent = _sdLoop.outSec != null ? _sdStemsFmtTime(_sdLoop.outSec) : '—';
    var hasMarkers = _sdLoop.inSec != null && _sdLoop.outSec != null;
    var active = hasMarkers && _sdLoop.enabled;
    if (btn) {
        if (active) {
            btn.style.background = 'rgba(245,158,11,0.18)';
            btn.style.color = '#fbbf24';
            btn.style.borderColor = 'rgba(245,158,11,0.45)';
            btn.textContent = '🔁 Loop ON';
        } else {
            btn.style.background = 'rgba(255,255,255,0.04)';
            btn.style.color = 'var(--text-dim)';
            btn.style.borderColor = 'var(--border)';
            btn.textContent = hasMarkers ? '🔁 Loop OFF' : '🔁 Loop';
        }
    }
    // Loop visibility upgrade per Drew/ChatGPT critique 2026-05-10:
    // when a loop is active, the bar promotes to a "mode" indicator
    // — orange background, brighter border. Reads as state ("we are
    // looping right now"), not just "this is a control."
    if (bar) {
        if (active) {
            bar.classList.add('loop-active');
            bar.style.background = 'rgba(245,158,11,0.10)';
            bar.style.borderColor = 'rgba(245,158,11,0.45)';
            bar.style.color = '#fbbf24';
        } else {
            bar.classList.remove('loop-active');
            bar.style.background = 'rgba(255,255,255,0.02)';
            bar.style.borderColor = 'var(--border)';
            bar.style.color = 'var(--text-dim)';
        }
    }
    _sdStemsRedrawLoopMarkers();
    // Record loop activations into the GLContext memory feed and re-evaluate
    // GrooveMate. Only count fully-armed loops (both markers + enabled);
    // intermediate states would noise the deepen-rule.
    if (_sdLoop.inSec != null && _sdLoop.outSec != null && _sdLoop.enabled) {
        _sdRecordRecentLoop();
    }
    _sdGmRefreshHint();
}

// Append the current song + loop start to a localStorage rolling window so
// the GrooveMate stems-loop-deepen rule can detect "looped this section
// N times". Capped at 30 so the JSON stays cheap to read.
function _sdRecordRecentLoop() {
    if (!_sdCurrentSong || _sdLoop.inSec == null) return;
    try {
        var raw = localStorage.getItem('gl_recent_loops');
        var list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
        // Coalesce: if the most-recent entry is the same song+section within
        // the last 5s, replace its ts rather than appending. Prevents UI
        // toggles from inflating the count.
        var now = Date.now();
        var head = list[0];
        if (head && head.song === _sdCurrentSong
            && Math.abs((head.inSec || 0) - _sdLoop.inSec) < 0.5
            && (now - (head.ts || 0)) < 5000) {
            head.ts = now;
        } else {
            list.unshift({ song: _sdCurrentSong, inSec: _sdLoop.inSec, outSec: _sdLoop.outSec, ts: now });
        }
        list = list.slice(0, 30);
        localStorage.setItem('gl_recent_loops', JSON.stringify(list));
    } catch (e) {}
}

// ── GrooveMate hint pill (per-song, per-loop) ──────────────────────────────
// Reads ambient context via GLContext + GLGrooveMate, paints the
// #sdStemsGmHint banner if the top decision is a stems-* intent. Apply
// runs the action through GLActions; Dismiss records a 24h suppression.
var _sdGmCurrentDecision = null;
function _sdGmRefreshHint() {
    var pill = document.getElementById('sdStemsGmHint');
    if (!pill) return;
    if (!window.GLGrooveMate || !window.GLContext) {
        pill.style.display = 'none';
        return;
    }
    var decision = GLGrooveMate.evaluate(GLContext.snapshot());
    if (!decision || !decision.intent || decision.intent.indexOf('stems-') !== 0) {
        pill.style.display = 'none';
        _sdGmCurrentDecision = null;
        return;
    }
    _sdGmCurrentDecision = decision;
    pill.dataset.intent = decision.intent;
    var msgEl = document.getElementById('sdStemsGmHintMsg');
    if (msgEl) msgEl.textContent = decision.message || '';
    pill.style.display = 'flex';
    if (typeof GLGrooveMate.recordDecision === 'function') GLGrooveMate.recordDecision(decision);
}
window._sdGmApplyHint = function () {
    if (!_sdGmCurrentDecision || !window.GLGrooveMate) return;
    GLGrooveMate.accept(_sdGmCurrentDecision);
    var pill = document.getElementById('sdStemsGmHint');
    if (pill) pill.style.display = 'none';
    _sdGmCurrentDecision = null;
};
window._sdGmDismissHint = function () {
    if (_sdGmCurrentDecision && window.GLGrooveMate) {
        GLGrooveMate.dismiss(_sdGmCurrentDecision.intent);
    }
    var pill = document.getElementById('sdStemsGmHint');
    if (pill) pill.style.display = 'none';
    _sdGmCurrentDecision = null;
};

// Practice preset = mute one stem so the user can play/sing that part with
// everything else playing. Clicking the active preset again toggles back
// to all-on. Switching presets clears the previous mute first (single-active).
window._sdStemsApplyPreset = function(stemId) {
    if (_sdActivePreset === stemId) {
        window._sdStemsResetPresets();
        return;
    }
    // Clear any active solo first. Without this, solo + practice mute
    // silently no-op (the soloed stem keeps playing alone, ignoring the
    // mute the user just clicked). Programmatic click hits the existing
    // solo handler so its closure-scoped `soloed` var stays in sync.
    var activeSoloBtn = document.querySelector('.sd-stem-solo[data-active="1"]');
    if (activeSoloBtn) activeSoloBtn.click();
    _sdActivePreset = stemId;
    document.querySelectorAll('.sd-stem-audio').forEach(function(a) {
        var isTarget = (a.dataset.stem === stemId);
        a.dataset.muted = isTarget ? '1' : '';
        _sdStemsApplyVolFor(a);
        var muteBtn = document.querySelector('.sd-stem-mute[data-stem="' + a.dataset.stem + '"]');
        if (muteBtn) muteBtn.dataset.active = isTarget ? '1' : '';
    });
    _sdStemsRefreshAllRowDims();
    _sdStemsRedrawPresetUI();
    _sdStemsRefreshFocusChipState();
    _sdNotifyPracticeSessionStems(stemId);
};

window._sdStemsResetPresets = function() {
    _sdActivePreset = null;
    // Reset is "Unmute everything" — clean slate to listen to the full
    // mix. That has to clear solos too, otherwise muted+soloOff stems
    // stay silent even though their mute button is back to inactive.
    var activeSoloBtn = document.querySelector('.sd-stem-solo[data-active="1"]');
    if (activeSoloBtn) activeSoloBtn.click();
    document.querySelectorAll('.sd-stem-audio').forEach(function(a) {
        a.dataset.muted = '';
        _sdStemsApplyVolFor(a);
        var muteBtn = document.querySelector('.sd-stem-mute[data-stem="' + a.dataset.stem + '"]');
        if (muteBtn) muteBtn.dataset.active = '';
    });
    _sdStemsRefreshAllRowDims();
    _sdStemsRedrawPresetUI();
    _sdStemsRefreshFocusChipState();
    _sdNotifyPracticeSessionStems(null);
};

// Shared volume application — used by preset toggles AND the per-stem
// vol slider handler (closure in _sdInitStemsPlayer). Reads slider value
// + muted/soloOff dataset flags and routes through the GainNode (or
// element volume in WebAudio-unavailable fallback).
function _sdStemsApplyVolFor(audio) {
    if (!audio) return;
    var slider = document.querySelector('.sd-stem-vol[data-stem="' + audio.dataset.stem + '"]');
    var sliderVal = slider ? Number(slider.value) : 80;
    var muted = audio.dataset.muted === '1';
    var soloOff = audio.dataset.soloOff === '1';
    var v = (muted || soloOff) ? 0 : Math.max(0, Math.min(1, sliderVal / 100));
    var node = _sdStemsState && _sdStemsState.nodes && _sdStemsState.nodes[audio.dataset.stem];
    if (node) {
        try { node.gain.gain.value = v; } catch (e) {}
    } else {
        audio.volume = v;
    }
}

function _sdStemsRedrawPresetUI() {
    var activeLabel = '';
    document.querySelectorAll('.sd-stems-preset').forEach(function(btn) {
        var on = (_sdActivePreset === btn.dataset.stem);
        var color = btn.dataset.color || 'rgba(255,255,255,0.1)';
        if (on) {
            btn.style.background = 'rgba(245,158,11,0.18)';
            btn.style.color = '#fbbf24';
            btn.style.borderColor = 'rgba(245,158,11,0.55)';
            // Pull label from the button text (icon + label) — strip leading
            // emoji + space so the banner reads "Lead muted" not "🎤 Lead muted".
            var raw = (btn.textContent || '').trim();
            activeLabel = raw.replace(/^\S+\s+/, '');
        } else {
            btn.style.background = 'rgba(255,255,255,0.03)';
            btn.style.color = 'var(--text-dim)';
            btn.style.borderColor = color + '40';
        }
    });
    // Top-of-card banner mirrors the preset state so users always know
    // why the mix sounds different than the raw stems.
    var banner = document.getElementById('sdStemsActiveModeBanner');
    var labelEl = document.getElementById('sdStemsActiveModeLabel');
    if (banner) banner.style.display = _sdActivePreset ? 'flex' : 'none';
    if (labelEl && _sdActivePreset) labelEl.textContent = activeLabel + ' muted — play/sing this part along';
}

// ── Overflow menus (per-row ⋮) ─────────────────────────────────────────────
window._sdStemsCloseAllOverflows = function() {
    document.querySelectorAll('.sd-stem-overflow-menu').forEach(function(m) {
        m.style.display = 'none';
    });
};
window._sdStemsToggleOverflow = function(btn) {
    var menu = btn && btn.nextElementSibling;
    if (!menu) return;
    var willOpen = menu.style.display !== 'block';
    window._sdStemsCloseAllOverflows();
    if (willOpen) menu.style.display = 'block';
};
var _sdStemsOverflowBound = false;
function _sdEnsureOverflowBound() {
    if (_sdStemsOverflowBound) return;
    document.addEventListener('click', function(e) {
        // Click inside an overflow wrapper → its onclick handles the toggle;
        // anything else just closes any open menu.
        if (!e.target.closest || !e.target.closest('.sd-stem-overflow-wrap')) {
            window._sdStemsCloseAllOverflows();
        }
    });
    _sdStemsOverflowBound = true;
}

// 4-beat metronome count-in before audio starts. Frequency at song BPM;
// pulled from window._sdCurrentSongMeta (set by song-detail) with 100 BPM
// fallback. First beat accented with a higher pitch. Visual countdown in
// the play button text.
async function _sdStemsCountIn() {
    if (!_sdStemsState || !_sdStemsState.ctx) return;
    var ctx = _sdStemsState.ctx;
    if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch(e) {}
    }
    var bpm = (window._sdCurrentSongMeta && Number(window._sdCurrentSongMeta.bpm)) || 100;
    var beatDur = 60 / bpm;
    var startAt = ctx.currentTime;
    for (var i = 0; i < 4; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = (i === 0) ? 1500 : 1000;
        var t0 = startAt + i * beatDur;
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.08);
    }
    var btn = document.getElementById('sdStemsPlay');
    for (var n = 0; n < 4; n++) {
        if (btn) btn.textContent = String(n + 1) + '…';
        await new Promise(function(r){ setTimeout(r, beatDur * 1000); });
    }
}

// Activity-strip cache: URL → { bins: Float32Array(N) of normalized RMS }.
// Decoded once per stem URL, shared across re-mounts of the lens. R2 sets
// Cache-Control: immutable so repeat fetches hit browser cache cheaply
// even on cold cache-cleared sessions.
var _sdStemActivityCache = {};
var _sdStemActivityBins = 280;

async function _sdRenderStemActivity(url, canvas, color, ctx) {
    if (!url || !canvas) return;
    var entry = _sdStemActivityCache[url];
    if (!entry) {
        try {
            var res = await fetch(url);
            var arrBuf = await res.arrayBuffer();
            // Reuse the playback AudioContext when available — saves spinning
            // up a second context just to decode. decodeAudioData detaches the
            // ArrayBuffer but doesn't tie up the audio thread.
            var decodeCtx = ctx || new (window.AudioContext || window.webkitAudioContext)();
            var audioBuf = await decodeCtx.decodeAudioData(arrBuf);
            var data = audioBuf.getChannelData(0);
            var n = _sdStemActivityBins;
            var samplesPerBin = Math.max(1, Math.floor(data.length / n));
            var arr = new Float32Array(n);
            var maxRms = 0;
            for (var i = 0; i < n; i++) {
                var sum = 0;
                var s = i * samplesPerBin;
                var e = Math.min(data.length, s + samplesPerBin);
                for (var j = s; j < e; j++) sum += data[j] * data[j];
                var rms = Math.sqrt(sum / Math.max(1, e - s));
                arr[i] = rms;
                if (rms > maxRms) maxRms = rms;
            }
            if (maxRms > 0) {
                for (var k = 0; k < n; k++) arr[k] = arr[k] / maxRms;
            }
            entry = { bins: arr };
            _sdStemActivityCache[url] = entry;
        } catch (err) {
            console.warn('[Stems] activity decode failed for', url, err);
            // Hide the loading "…" placeholder so the user isn't left staring at it.
            var loading = canvas.parentElement && canvas.parentElement.querySelector('.sd-stem-activity-loading');
            if (loading) loading.textContent = '';
            return;
        }
    }
    _sdPaintStemActivity(canvas, entry.bins, color);
    var loading = canvas.parentElement && canvas.parentElement.querySelector('.sd-stem-activity-loading');
    if (loading) loading.remove();
}

function _sdPaintStemActivity(canvas, bins, color) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || 200;
    var h = canvas.clientHeight || 22;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    var ctx2d = canvas.getContext('2d');
    ctx2d.scale(dpr, dpr);
    ctx2d.clearRect(0, 0, w, h);
    var n = bins.length;
    var binW = w / n;
    for (var i = 0; i < n; i++) {
        var v = bins[i]; // 0..1
        var barH = Math.max(1, v * h);
        ctx2d.fillStyle = color;
        ctx2d.globalAlpha = 0.18 + Math.min(0.82, v * 1.3);
        ctx2d.fillRect(i * binW, (h - barH) / 2, Math.max(0.5, binW - 0.3), barH);
    }
    ctx2d.globalAlpha = 1;
}

// Single global keydown handler — bound once, gated on whether the stems
// player is currently mounted. Avoids stealing keys when the player isn't
// visible. Inputs/contenteditable always pass through.
var _sdStemsKeyBound = false;
function _sdStemsKeyHandler(e) {
    if (!_sdStemsState || !_sdStemsState.ctx) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.code === 'Escape') {
        // Prefer clearing loop markers if any; otherwise exit fullscreen.
        if (_sdLoop.inSec != null || _sdLoop.outSec != null) {
            e.preventDefault(); window._sdStemsClearLoop();
            return;
        }
        var fs = document.querySelector('.sd-stems-wrap.sd-stems-fullscreen');
        if (fs) { e.preventDefault(); window._sdStemsToggleFullscreen(); }
        return;
    }
    if (e.code === 'KeyL') { e.preventDefault(); window._sdStemsToggleLoop(); return; }
    if (e.code === 'BracketLeft')  { e.preventDefault(); window._sdStemsSetLoopInHere(); return; }
    if (e.code === 'BracketRight') { e.preventDefault(); window._sdStemsSetLoopOutHere(); return; }
    if (e.code === 'Space') { e.preventDefault(); window._sdStemsToggle(); return; }
    if (e.code === 'ArrowLeft')  { e.preventDefault(); window._sdStemsSeekBy(e.shiftKey ? -30 : -10); return; }
    if (e.code === 'ArrowRight') { e.preventDefault(); window._sdStemsSeekBy(e.shiftKey ?  30 :  10); return; }
}
function _sdEnsureStemsKeyBound() {
    if (_sdStemsKeyBound) return;
    document.addEventListener('keydown', _sdStemsKeyHandler);
    _sdStemsKeyBound = true;
}

function _sdInitStemsPlayer() {
    // Idempotent global click delegate for per-stem ⋮ menu actions
    // (Spatial split / Remove split). Bound here so it fires once on
    // first lens render and survives subsequent re-renders.
    _sdEnsureStemsMenuActionBound();
    // Scope all queries to `document` (not _sdContainer) so per-stem mute /
    // solo / pan / scrub click handlers keep working after the wrap is
    // reparented to <body> for fullscreen mode. `.sd-stem-*` classes are
    // unique to this lens so a document-wide query is unambiguous.
    var root = document;
    var audios = root.querySelectorAll('.sd-stem-audio');
    var scrub = root.querySelector('#sdStemsScrub');
    var timeEl = root.querySelector('#sdStemsTime');
    if (!audios.length) return;
    var master = audios[0];
    _sdEnsureStemsKeyBound();
    _sdEnsureOverflowBound();

    var fmt = function(s){ s = Math.floor(s||0); return Math.floor(s/60) + ':' + ('0' + (s%60)).slice(-2); };

    // ── Always-on WebAudio chain ─────────────────────────────────────────
    // MES → Gain → destination per stem. Created at mount; AudioContext
    // starts suspended and resumes on first play (user gesture). Once a
    // MediaElementSource is created on an <audio>, the element's audio
    // output is permanently routed through WebAudio — but since we set
    // this up consistently at mount, there's no "engaged vs not" branch.
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = null;
    var nodes = {}; // stemId → { src, gain, pitch? }
    if (AC) {
        try {
            ctx = new AC();
            audios.forEach(function(audio) {
                audio.volume = 1; // bypass native — gain node controls output
                var src = ctx.createMediaElementSource(audio);
                var gain = ctx.createGain();
                gain.gain.value = 0.8;
                // Pan node tails the chain so pitch-shift splice (src→gain) stays untouched.
                var pan = (typeof ctx.createStereoPanner === 'function') ? ctx.createStereoPanner() : null;
                if (pan) {
                    src.connect(gain).connect(pan).connect(ctx.destination);
                } else {
                    src.connect(gain).connect(ctx.destination);
                }
                nodes[audio.dataset.stem] = { src: src, gain: gain, pan: pan };
            });
        } catch (e) {
            // Same-element MES double-create or AC not allowed — fall back to native volume.
            console.warn('[Stems] WebAudio init failed, falling back to native:', e);
            ctx = null;
            nodes = {};
        }
    }
    _sdStemsState = { ctx: ctx, nodes: nodes };

    // ── Drift resync ────────────────────────────────────────────────────
    // iOS Safari (and to a lesser extent desktop Safari) runs each <audio>
    // on its own decode clock — even though MediaElementSource routes the
    // audio through a shared AudioContext, the *timing* is still per-element.
    // Stems desync within a few seconds of playback and pause/play does
    // NOT recover sync because each element resumes from its own drifted
    // currentTime. Symptom: tracks audibly slap out of phase mid-song.
    //
    // Fix: every 500ms while master is playing, snap any stem whose
    // currentTime drifts more than 100ms from master back to master's time.
    // Heavy-handed but works without the AudioBuffer rewrite. Safari may
    // stutter briefly on a snap; threshold is tuned high enough that small
    // jitter doesn't trigger gratuitous seeks.
    var driftTimer = setInterval(function() {
        if (!master || master.paused) return;
        var ref = master.currentTime;
        if (!isFinite(ref)) return;
        audios.forEach(function(a) {
            if (a === master || a.paused || !isFinite(a.currentTime)) return;
            if (Math.abs(a.currentTime - ref) > 0.1) {
                try { a.currentTime = ref; } catch (e) {}
            }
        });
    }, 500);
    _sdStemsState.driftTimer = driftTimer;

    var applyVol = function(audio) {
        if (!audio) return;
        var slider = root.querySelector('.sd-stem-vol[data-stem="' + audio.dataset.stem + '"]');
        var sliderVal = slider ? Number(slider.value) : 80;
        var muted = audio.dataset.muted === '1';
        var soloOff = audio.dataset.soloOff === '1';
        var v = (muted || soloOff) ? 0 : Math.max(0, Math.min(1, sliderVal/100));
        var node = nodes[audio.dataset.stem];
        if (node) {
            try { node.gain.gain.value = v; } catch (e) {}
        } else {
            audio.volume = v;
        }
    };

    audios.forEach(function(audio) {
        var slider = root.querySelector('.sd-stem-vol[data-stem="' + audio.dataset.stem + '"]');
        if (slider) slider.addEventListener('input', function(){ applyVol(audio); });
    });

    // ── Pan ──────────────────────────────────────────────────────────────
    var applyPan = function(stemId, val) {
        var node = nodes[stemId];
        var v = Math.max(-1, Math.min(1, Number(val) / 100));
        if (node && node.pan) {
            try { node.pan.pan.value = v; } catch (e) {}
        }
        var label = root.querySelector('.sd-stem-pan-val[data-stem="' + stemId + '"]');
        if (label) {
            if (v === 0) label.textContent = 'C';
            else if (v < 0) label.textContent = 'L' + Math.round(Math.abs(v) * 100);
            else label.textContent = 'R' + Math.round(v * 100);
        }
    };
    root.querySelectorAll('.sd-stem-pan').forEach(function(slider) {
        slider.addEventListener('input', function(){ applyPan(slider.dataset.stem, slider.value); });
        slider.addEventListener('dblclick', function(){ slider.value = 0; applyPan(slider.dataset.stem, 0); });
    });

    root.querySelectorAll('.sd-stem-mute').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var audio = root.querySelector('.sd-stem-audio[data-stem="' + btn.dataset.stem + '"]');
            if (!audio) return;
            var muted = audio.dataset.muted === '1';
            audio.dataset.muted = muted ? '' : '1';
            applyVol(audio);
            btn.dataset.active = muted ? '' : '1';
            _sdStemsRefreshAllRowDims();
        });
    });

    var soloed = null;
    root.querySelectorAll('.sd-stem-solo').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var stemId = btn.dataset.stem;
            soloed = (soloed === stemId) ? null : stemId;
            root.querySelectorAll('.sd-stem-audio').forEach(function(a) {
                a.dataset.soloOff = (soloed && a.dataset.stem !== soloed) ? '1' : '';
                applyVol(a);
            });
            root.querySelectorAll('.sd-stem-solo').forEach(function(b) {
                b.dataset.active = (soloed === b.dataset.stem) ? '1' : '';
            });
            _sdStemsRefreshAllRowDims();
        });
    });

    // ── Tempo (native playbackRate + preservesPitch) ────────────────────────
    var tempoSlider = root.querySelector('#sdStemsTempo');
    var tempoVal = root.querySelector('#sdStemsTempoVal');
    var preservePitchEl = root.querySelector('#sdStemsPreservePitch');
    var applyTempo = function() {
        var rate = tempoSlider ? (Number(tempoSlider.value) / 100) : 1;
        var preserve = preservePitchEl ? !!preservePitchEl.checked : true;
        audios.forEach(function(a) {
            try {
                a.playbackRate = rate;
                a.preservesPitch = preserve;
                a.mozPreservesPitch = preserve;
                a.webkitPreservesPitch = preserve;
            } catch(e) {}
        });
        if (tempoVal) tempoVal.textContent = rate.toFixed(2) + '×';
    };
    if (tempoSlider) tempoSlider.addEventListener('input', applyTempo);
    if (preservePitchEl) preservePitchEl.addEventListener('change', applyTempo);
    applyTempo();

    // ── Pitch shift (Tone.js spliced into existing chain) ───────────────────
    // Tone.js is lazy-loaded on first ±N click. We point Tone at our
    // existing AudioContext (Tone.setContext) so the PitchShift node can
    // be inserted between MES and Gain without crossing contexts. Reset
    // sets pitch=0; the node stays in the chain as a pass-through.
    var pitchVal = root.querySelector('#sdStemsPitchVal');
    var currentPitch = 0;
    var pitchEngaged = false;
    var setPitchUI = function() {
        if (pitchVal) pitchVal.textContent = (currentPitch > 0 ? '+' : '') + currentPitch;
    };
    var ensureTone = async function() {
        if (window.Tone) return window.Tone;
        await new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            // Tone v15+ uses AudioWorkletNode (vs v14's deprecated
            // ScriptProcessorNode). API for PitchShift + setContext is unchanged.
            s.src = 'https://unpkg.com/tone@15.1.22/build/Tone.js';
            s.onload = resolve;
            s.onerror = function(){ reject(new Error('Tone.js failed to load')); };
            document.head.appendChild(s);
        });
        return window.Tone;
    };
    var splicePitchShift = async function() {
        if (pitchEngaged) return;
        if (!ctx) throw new Error('WebAudio unavailable — pitch shift not supported');
        var Tone = await ensureTone();
        // Bridge Tone to our existing context so nodes are interoperable.
        try {
            if (typeof Tone.setContext === 'function') Tone.setContext(ctx);
        } catch (e) { /* older Tone or different API; nodes may still work */ }
        try { if (typeof Tone.start === 'function') await Tone.start(); } catch(e) {}
        Object.keys(nodes).forEach(function(id) {
            var n = nodes[id];
            try {
                var ps = new Tone.PitchShift(0);
                // Disconnect existing src→gain edge; insert pitchShift between them.
                n.src.disconnect();
                // Tone v15 made native↔Tone connection stricter. Native
                // AudioNode.connect() rejects ToneAudioNode targets ("Overload
                // resolution failed"). The canonical bridge is Tone.connect()
                // which handles native, Tone, and mixed graphs uniformly.
                if (typeof Tone.connect === 'function') {
                    Tone.connect(n.src, ps);
                    Tone.connect(ps, n.gain);
                } else {
                    // Tone v14 fallback path
                    n.src.connect(ps.input);
                    ps.connect(n.gain);
                }
                n.pitch = ps;
            } catch (e) {
                console.warn('[Stems] PitchShift splice failed for', id, e);
                // Splice failed mid-rewire — n.src was disconnected before the
                // exception. Restore the original src→gain edge so audio
                // doesn't go silent. User loses pitch shift but keeps audio.
                try { n.src.connect(n.gain); } catch (re) {}
            }
        });
        pitchEngaged = true;
    };
    var setPitch = async function(semitones) {
        currentPitch = Math.max(-12, Math.min(12, semitones));
        setPitchUI();
        if (currentPitch === 0 && !pitchEngaged) return; // nothing to do
        try {
            await splicePitchShift();
            Object.keys(nodes).forEach(function(k){
                if (nodes[k].pitch) nodes[k].pitch.pitch = currentPitch;
            });
        } catch (e) {
            if (typeof showToast === 'function') showToast('Pitch shift unavailable: ' + (e.message || 'load failed'));
            currentPitch = 0; setPitchUI();
        }
    };
    root.querySelectorAll('.sd-stems-pitch').forEach(function(btn) {
        btn.addEventListener('click', function(){ setPitch(currentPitch + Number(btn.dataset.delta)); });
    });
    var pitchReset = root.querySelector('#sdStemsPitchReset');
    if (pitchReset) pitchReset.addEventListener('click', function(){ setPitch(0); });

    // ── Activity strips: decode + render + click-to-seek ────────────────────
    // Decode is parallel and non-blocking. Each strip shows a "…" placeholder
    // until its decode lands. Cache survives lens re-mounts.
    var playheads = root.querySelectorAll('.sd-stem-playhead');
    audios.forEach(function(audio) {
        var stemId = audio.dataset.stem;
        var wrap = root.querySelector('.sd-stem-activity-wrap[data-stem="' + stemId + '"]');
        if (!wrap) return;
        var canvas = wrap.querySelector('.sd-stem-activity');
        var row = root.querySelector('.sd-stem-row[data-stem="' + stemId + '"]');
        var color = (row && row.dataset.color) || 'rgba(255,255,255,0.5)';
        if (canvas) _sdRenderStemActivity(audio.src, canvas, color, ctx);
        // Pointer events handle both click (tap → seek) AND drag (drag-out
        // a loop region in one gesture). setPointerCapture means the drag
        // keeps tracking even if the cursor leaves the wrap. ~5px movement
        // threshold separates click from drag.
        var ds = null;
        var DRAG_PX = 5;
        var timeFromX = function(clientX) {
            var rect = wrap.getBoundingClientRect();
            var frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return frac * (master.duration || 0);
        };
        wrap.addEventListener('pointerdown', function(e) {
            if (e.button !== 0 || !master.duration) return;
            ds = { startX: e.clientX, startT: timeFromX(e.clientX), shift: e.shiftKey, dragging: false };
            try { wrap.setPointerCapture(e.pointerId); } catch(err) {}
            e.preventDefault();
        });
        wrap.addEventListener('pointermove', function(e) {
            if (!ds) return;
            if (!ds.dragging && Math.abs(e.clientX - ds.startX) > DRAG_PX) ds.dragging = true;
            if (ds.dragging) {
                ds.endT = timeFromX(e.clientX);
                _sdStemsPaintLoopPreview(Math.min(ds.startT, ds.endT), Math.max(ds.startT, ds.endT));
            }
        });
        wrap.addEventListener('pointerup', function(e) {
            if (!ds) return;
            try { wrap.releasePointerCapture(e.pointerId); } catch(err) {}
            if (ds.dragging) {
                var t1 = Math.min(ds.startT, ds.endT);
                var t2 = Math.max(ds.startT, ds.endT);
                if (t2 - t1 >= 0.05) {
                    _sdLoop.inSec = t1;
                    _sdLoop.outSec = t2;
                    _sdLoop.enabled = true;
                    _sdStemsRedrawLoopUI();
                } else {
                    // Movement was below commit threshold — restore prior state.
                    _sdStemsRedrawLoopMarkers();
                }
            } else {
                if (ds.shift) window._sdStemsSetLoopMarker(ds.startT);
                else window._sdStemsApplySeek(ds.startT);
            }
            ds = null;
        });
        wrap.addEventListener('pointercancel', function() {
            if (ds && ds.dragging) _sdStemsRedrawLoopMarkers();
            ds = null;
        });
    });
    // Repaint activity canvases on resize (e.g. entering/exiting fullscreen)
    // so the bins re-stretch to the new pixel width without re-decoding.
    // Loop markers need the same treatment (their positions are pixel-based).
    var repaintActivity = function() {
        audios.forEach(function(audio) {
            var stemId = audio.dataset.stem;
            var wrap = root.querySelector('.sd-stem-activity-wrap[data-stem="' + stemId + '"]');
            if (!wrap) return;
            var canvas = wrap.querySelector('.sd-stem-activity');
            var entry = _sdStemActivityCache[audio.src];
            var row = root.querySelector('.sd-stem-row[data-stem="' + stemId + '"]');
            var color = (row && row.dataset.color) || 'rgba(255,255,255,0.5)';
            if (canvas && entry) _sdPaintStemActivity(canvas, entry.bins, color);
        });
        _sdStemsRedrawLoopMarkers();
    };
    window.addEventListener('resize', repaintActivity);

    // ── Time sync / scrub / play-end ────────────────────────────────────────
    master.addEventListener('timeupdate', function() {
        if (!master.duration) return;
        // Loop wraparound — fires before the visual update so the playhead
        // jump is the only thing the user sees (no flicker past the OUT mark).
        if (_sdLoop.enabled && _sdLoop.inSec != null && _sdLoop.outSec != null
                && master.currentTime >= _sdLoop.outSec) {
            window._sdStemsApplySeek(_sdLoop.inSec);
            return;
        }
        if (scrub) scrub.value = (master.currentTime / master.duration) * 1000;
        if (timeEl) timeEl.textContent = fmt(master.currentTime) + ' / ' + fmt(master.duration);
        // Move per-stem playheads in sync. translateX is GPU-cheap; one
        // composite frame per timeupdate (~4Hz from <audio>).
        var frac = master.currentTime / master.duration;
        playheads.forEach(function(ph) {
            var w = ph.parentElement ? ph.parentElement.clientWidth : 0;
            ph.style.transform = 'translateX(' + (frac * w) + 'px)';
        });
    });
    master.addEventListener('loadedmetadata', function() {
        if (timeEl && master.duration) timeEl.textContent = '0:00 / ' + fmt(master.duration);
        // Loop markers need duration to compute their pixel positions.
        _sdStemsRedrawLoopMarkers();
    });
    master.addEventListener('ended', function() {
        var btn = document.getElementById('sdStemsPlay');
        if (btn) btn.textContent = '▶ Play';
        audios.forEach(function(a){ try { a.pause(); a.currentTime = 0; } catch(e){} });
    });
    // While dragging the master scrub bar, only update visuals — actual
    // audio seek fires once on `change` (mouseup). Avoids queuing dozens
    // of seeks across 7-8 stems while the user drags through the bar.
    if (scrub) {
        scrub.addEventListener('input', function() {
            if (!master.duration) return;
            var frac = scrub.value / 1000;
            if (timeEl) timeEl.textContent = fmt(frac * master.duration) + ' / ' + fmt(master.duration);
            playheads.forEach(function(ph) {
                var w = ph.parentElement ? ph.parentElement.clientWidth : 0;
                ph.style.transform = 'translateX(' + (frac * w) + 'px)';
            });
        });
        scrub.addEventListener('change', function() {
            if (!master.duration) return;
            window._sdStemsApplySeek((scrub.value / 1000) * master.duration);
        });
    }
    // Wire PracticeTask trackId → 🎯 Focus chip + auto-mute. Defer one
    // tick so all rows + buttons are in the DOM. Silent no-op if no
    // active task or no trackId.
    setTimeout(function() {
        if (typeof window._sdStemsApplyFocusFromTask === 'function') {
            window._sdStemsApplyFocusFromTask();
        }
    }, 50);
}

window._sdPopulateListenLensPublic = function(title) { _sdPopulateListenLens(title); };

// Render the All Versions card body. Per Drew/ChatGPT critique 2026-05-10:
// - Vote chips collapsed by default (show count + tap-to-expand)
// - Delete + promote-to-North-Star actions on each row
// - Sort by votes desc, then recency desc
function _sdRenderAllVersionsList(title, refs) {
    var safeSong = title.replace(/'/g, "\\'");
    if (!refs || !refs.length) {
        return '<div style="color:var(--text-dim);font-size:0.85em">No versions saved yet — Open Version Hub above to add one.</div>';
    }
    var members = (typeof bandMembers !== 'undefined' && bandMembers) ? bandMembers : {};
    var memberEmails = Object.keys(members);
    if (!memberEmails.length) {
        return '<div style="color:var(--text-dim);font-size:0.85em">Band roster not loaded yet — try refreshing.</div>';
    }
    var sorted = refs.map(function(v, i) { return { v: v, idx: i }; });
    sorted.sort(function(a, b) {
        var va = a.v.votes ? Object.keys(a.v.votes).filter(function(k){return a.v.votes[k];}).length : 0;
        var vb = b.v.votes ? Object.keys(b.v.votes).filter(function(k){return b.v.votes[k];}).length : 0;
        if (vb !== va) return vb - va;
        return _sdVersionTime(b.v) - _sdVersionTime(a.v);
    });
    return sorted.map(function(entry) {
        var v = entry.v;
        var origIdx = entry.idx;
        var voteCount = v.votes ? Object.keys(v.votes).filter(function(k){return v.votes[k];}).length : 0;
        var isStar = v.isNorthStar === true;
        var titleStr = v.fetchedTitle || v.title || 'Untitled';
        var voteSummary = voteCount > 0 ? '👍 ' + voteCount : 'No votes yet';
        // Collapsed-by-default chips. <details> handles toggle natively.
        var chips = memberEmails.map(function(email) {
            var member = members[email] || {};
            var voted = !!(v.votes && v.votes[email]);
            var name = member.name || email.split('@')[0];
            var bg = voted ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.04)';
            var fg = voted ? '#86efac' : 'var(--text-dim)';
            var bd = voted ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)';
            return '<span onclick="_sdToggleVersionVote(\''+safeSong+'\','+origIdx+',\''+email.replace(/'/g,"\\'")+'\');event.stopPropagation()" title="Toggle '+_sdEsc(name)+'’s vote" style="cursor:pointer;display:inline-flex;align-items:center;gap:3px;padding:4px 9px;border-radius:12px;font-size:0.72em;font-weight:600;background:'+bg+';color:'+fg+';border:1px solid '+bd+';white-space:nowrap">'+(voted?'✓ ':'')+_sdEsc(name)+'</span>';
        }).join('');
        var promoteBtn = isStar ? '' :
            '<button onclick="_sdPromoteVersionToNorthStar(\''+safeSong+'\','+origIdx+');event.stopPropagation()" title="Make this the North Star reference" style="font-size:0.66em;padding:3px 7px;border-radius:5px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.08);color:#fbbf24;cursor:pointer;white-space:nowrap">⭐ Promote</button>';
        var deleteBtn = '<button onclick="_sdDeleteVersion(\''+safeSong+'\','+origIdx+');event.stopPropagation()" title="Delete this version" style="font-size:0.66em;padding:3px 7px;border-radius:5px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);color:#fca5a5;cursor:pointer;white-space:nowrap">🗑</button>';
        return '<details style="margin-bottom:8px;padding:8px 10px;border:1px solid '+(isStar?'rgba(102,126,234,0.4)':'var(--border)')+';border-radius:8px;background:'+(isStar?'rgba(102,126,234,0.06)':'rgba(255,255,255,0.02)')+'">'+
          '<summary style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px">'+
            (isStar?'<span title="North Star" style="font-size:1.05em">⭐</span>':'')+
            '<div style="flex:1;min-width:0;font-size:0.84em;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_sdEsc(titleStr)+'</div>'+
            '<span style="font-size:0.7em;color:var(--text-dim);font-weight:700;flex-shrink:0">'+voteSummary+'</span>'+
            '<span style="font-size:0.7em;opacity:0.45;flex-shrink:0">▶</span>'+
          '</summary>'+
          '<div style="padding-top:8px;margin-top:6px;border-top:1px solid rgba(255,255,255,0.04)">'+
            (v.url?'<div style="font-size:0.66em;color:var(--text-dim);margin-bottom:6px;word-break:break-all;opacity:0.7">'+_sdEsc(v.url)+'</div>':'')+
            '<div style="font-size:0.66em;color:var(--text-muted);margin-bottom:4px">Tap a name to vote:</div>'+
            '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">'+chips+'</div>'+
            '<div style="display:flex;gap:6px;justify-content:flex-end">'+promoteBtn+deleteBtn+'</div>'+
          '</div>'+
        '</details>';
    }).join('');
}

// Promote a version to North Star — sets isNorthStar:true on the chosen
// entry and clears it from all others. Mirrors the same flag-flip
// vhSendTo does in version-hub.js so the song-detail Listen lens render
// path picks it up consistently.
window._sdPromoteVersionToNorthStar = async function(songTitle, versionIndex) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    try {
        var versions = (typeof loadRefVersions === 'function') ? (await loadRefVersions(songTitle) || []) : [];
        if (!versions[versionIndex]) return;
        versions.forEach(function(v, i) { v.isNorthStar = (i === versionIndex); });
        if (typeof saveRefVersions === 'function') await saveRefVersions(songTitle, versions);
        if (typeof _sdPopulateListenLensPublic === 'function') _sdPopulateListenLensPublic(songTitle);
        if (typeof showToast === 'function') showToast('⭐ Promoted to North Star');
    } catch (e) {
        console.warn('[sd] promote failed:', e);
        if (typeof showToast === 'function') showToast('Failed to promote: ' + (e.message || e));
    }
};

// Delete a version. Confirms first because votes (band history) are lost.
window._sdDeleteVersion = async function(songTitle, versionIndex) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    try {
        var versions = (typeof loadRefVersions === 'function') ? (await loadRefVersions(songTitle) || []) : [];
        var v = versions[versionIndex];
        if (!v) return;
        var label = v.fetchedTitle || v.title || 'this version';
        if (!confirm('Delete "' + label + '"? Votes on this version will be lost.')) return;
        versions.splice(versionIndex, 1);
        if (typeof saveRefVersions === 'function') await saveRefVersions(songTitle, versions);
        if (typeof _sdPopulateListenLensPublic === 'function') _sdPopulateListenLensPublic(songTitle);
        if (typeof showToast === 'function') showToast('Version deleted');
    } catch (e) {
        console.warn('[sd] delete failed:', e);
        if (typeof showToast === 'function') showToast('Failed to delete: ' + (e.message || e));
    }
};

// Toggle a single member's vote on a version. Re-renders the Listen
// lens so vote counts + ordering refresh. Mirrors the legacy
// toggleRefVote in app.js but is scoped to the new Workbench surface
// and re-renders the right container.
window._sdToggleVersionVote = async function(songTitle, versionIndex, voterEmail) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    try {
        var versions = (typeof loadRefVersions === 'function') ? (await loadRefVersions(songTitle) || []) : [];
        if (!versions[versionIndex]) return;
        if (!versions[versionIndex].votes) versions[versionIndex].votes = {};
        versions[versionIndex].votes[voterEmail] = !versions[versionIndex].votes[voterEmail];
        versions[versionIndex].totalVotes = Object.values(versions[versionIndex].votes).filter(function(v){return v;}).length;
        if (typeof saveRefVersions === 'function') await saveRefVersions(songTitle, versions);
        if (typeof _sdPopulateListenLensPublic === 'function') _sdPopulateListenLensPublic(songTitle);
    } catch (e) {
        console.error('[sd] vote toggle failed:', e);
        if (typeof showToast === 'function') showToast('Vote save failed: ' + (e.message || e));
    }
};

async function _sdPopulateListenLens(title) {
    var panel=(_sdContainer||document).querySelector('.sd-lens-panel[data-lens="listen"]');
    if (!panel) return;
    var northStar=null, bestShot=null;
    try {
        var res=await Promise.all([
            loadBandDataFromDrive(title,'spotify_versions').catch(function(){return null;}),
            loadBandDataFromDrive(title,'best_shot_takes').catch(function(){return null;}),
        ]);
        var refs=_sdArr(res[0]), shots=_sdArr(res[1]);
        // Same tie-breaker logic as the chart-card render path: prefer the
        // most-recently-added entry when votes are tied. Otherwise adding a
        // new North Star via "Change" doesn't visibly replace.
        // Explicit isNorthStar flag wins over vote-counting. Set by
        // "Save as North Star" in the version hub. Multiple flagged →
        // most recently set wins (legacy-data safety).
        var explicit = refs.filter(function(v) { return v && v.isNorthStar === true; });
        if (explicit.length) {
            explicit.sort(function(a, b) { return _sdVersionTime(b) - _sdVersionTime(a); });
            northStar = Object.assign({}, explicit[0], { _voteCount: 0, _addedAt: _sdVersionTime(explicit[0]) });
        }
        refs.forEach(function(v){
            if (northStar && northStar.isNorthStar) return; // explicit pick already won
            var votes=v.votes?Object.keys(v.votes).filter(function(k){return v.votes[k];}).length:0;
            var thisTime = _sdVersionTime(v);
            var existingTime = northStar ? (northStar._addedAt || 0) : 0;
            var existingVotes = northStar ? (northStar._voteCount || 0) : -1;
            var wins = votes > existingVotes || (votes === existingVotes && thisTime > existingTime);
            if(wins) northStar=Object.assign({},v,{_voteCount:votes,_addedAt:thisTime});
        });
        bestShot=shots.find(function(s){return s.crowned;})||(shots.length?shots[shots.length-1]:null);
    } catch(e){}

    // Detect link platform from URL
    var _nsLinkLabel = 'Open Link';
    if (northStar && northStar.url) {
        var _nsUrl = northStar.url.toLowerCase();
        if (_nsUrl.indexOf('youtube.com') !== -1 || _nsUrl.indexOf('youtu.be') !== -1) _nsLinkLabel = 'Open in YouTube';
        else if (_nsUrl.indexOf('spotify.com') !== -1) _nsLinkLabel = 'Open in Spotify';
        else if (_nsUrl.indexOf('soundcloud.com') !== -1) _nsLinkLabel = 'Open in SoundCloud';
        else if (_nsUrl.indexOf('bandcamp.com') !== -1) _nsLinkLabel = 'Open in Bandcamp';
        else if (_nsUrl.indexOf('apple.com') !== -1 || _nsUrl.indexOf('music.apple') !== -1) _nsLinkLabel = 'Open in Apple Music';
    }
    var nsHTML=northStar
        ?('<div style="padding:10px;background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px">'+
          '<div style="display:flex;align-items:center;gap:10px">'+
          '<span style="font-size:1.4em;flex-shrink:0">⭐</span><div style="flex:1;min-width:0">'+
          '<div style="font-size:0.85em;font-weight:700;color:var(--text)">'+_sdEsc(northStar.fetchedTitle||northStar.title||'Reference')+'</div>'+
          '<div style="font-size:0.72em;color:var(--text-dim)">'+(northStar._voteCount||0)+' votes</div></div>'+
          (northStar.url?'<button class="btn btn-sm" onclick="openMusicLink(\''+northStar.url.replace(/'/g,"\\'")+'\');" style="background:rgba(102,126,234,0.2);color:#818cf8;border:1px solid rgba(102,126,234,0.3);font-size:0.78em;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;flex-shrink:0">\u25B6 '+_nsLinkLabel+'</button>':'')+
          '</div>'+
          (northStar.url?'<div style="font-size:0.68em;color:var(--text-dim);margin-top:6px;word-break:break-all;opacity:0.7">'+_sdEsc(northStar.url)+'</div>':'')+
          '<div style="display:flex;gap:6px;margin-top:8px">'+
          '<button class="btn btn-sm" onclick="launchVersionHub()" style="flex:1;background:rgba(255,255,255,0.05);color:var(--text-dim);border:1px solid rgba(255,255,255,0.1);font-size:0.72em;padding:5px 8px;border-radius:6px;cursor:pointer">✏️ Change</button>'+
          '<button class="btn btn-sm" onclick="_sdClearNorthStar(\''+title.replace(/'/g,"\\'")+'\')" style="flex:1;background:rgba(239,68,68,0.08);color:#fca5a5;border:1px solid rgba(239,68,68,0.2);font-size:0.72em;padding:5px 8px;border-radius:6px;cursor:pointer">✕ Clear</button>'+
          '</div>'+
          '</div>')
        :'<div style="color:var(--text-dim);font-size:0.85em;display:flex;align-items:center;justify-content:space-between;gap:10px">No North Star set yet<button onclick="launchVersionHub()" class="btn btn-sm" style="background:rgba(102,126,234,0.15);color:#818cf8;border:1px solid rgba(102,126,234,0.3);font-size:0.82em;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;flex-shrink:0">🔍 Find One</button></div>';

    var bsHTML=bestShot
        ?('<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px">'+
          '<span style="font-size:1.4em">🏆</span><div style="flex:1;min-width:0">'+
          '<div style="font-size:0.85em;font-weight:700;color:var(--text)">'+_sdEsc(bestShot.label||'Best Take')+(bestShot.crowned?' 👑':'')+'</div>'+
          '<div style="font-size:0.72em;color:var(--text-dim)">'+_sdEsc(bestShot.uploadedByName||'')+'</div></div>'+
          (bestShot.audioUrl?'<audio controls src="'+_sdEsc(bestShot.audioUrl)+'" style="height:32px;max-width:140px"></audio>':
           bestShot.externalUrl?'<button class="btn btn-sm" onclick="window.open(\''+bestShot.externalUrl.replace(/'/g,"\\'")+'\',\'_blank\')" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.78em;padding:6px 12px;border-radius:8px;cursor:pointer">▶ Listen</button>':'')+
          '<button class="btn btn-sm" onclick="addBestShotTake(\''+title.replace(/'/g,"\\'")+'\')" title="Upload a new take" style="background:rgba(255,255,255,0.05);color:var(--text-dim);border:1px solid rgba(255,255,255,0.1);font-size:0.72em;padding:5px 10px;border-radius:6px;cursor:pointer;flex-shrink:0;margin-left:6px">✏️ Replace</button>'+
          '</div>')
        :'<div style="color:var(--text-dim);font-size:0.85em;display:flex;align-items:center;justify-content:space-between;gap:10px">No recording yet<button onclick="addBestShotTake(\''+title.replace(/'/g,"\\'")+'\');" class="btn btn-sm" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.82em;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;flex-shrink:0">\uD83D\uDCE4 Upload Take</button></div>';

    // refs is var-hoisted from inside the try; defensive fallback covers the
    // case where the load threw and refs never got assigned.
    var allVersionsHTML = _sdRenderAllVersionsList(title, (typeof refs !== 'undefined' && refs) ? refs : []);
    panel.innerHTML=
        '<div class="sd-panel-inner">'+
        '<div class="sd-card"><div class="sd-card-title">🔍 Find a Version</div>'+
        '<div style="font-size:0.85em;color:var(--text-muted);margin-bottom:12px">Search Archive.org, Relisten, Phish.in, YouTube and more.</div>'+
        '<button class="btn btn-primary" onclick="launchVersionHub()" style="width:100%;padding:13px;font-size:0.95em;background:linear-gradient(135deg,#667eea,#764ba2)">🔍 Open Version Hub</button></div>'+
        '<div class="sd-card"><div class="sd-card-title">⭐ North Star <span class="sd-title-badge">Reference</span></div>'+nsHTML+'</div>'+
        '<div class="sd-card"><div class="sd-card-title">🏆 Best Shot <span class="sd-title-badge sd-title-badge--gold">Our Recording</span></div>'+bsHTML+'</div>'+
        '<div class="sd-card"><div class="sd-card-title">🗳 All Versions <span class="sd-title-badge">Band Vote</span></div>'+allVersionsHTML+'</div>'+
        '</div>';
}

// ── Learn Lens ────────────────────────────────────────────────────────────────
// Build per-user lesson key (same pattern as rehearsal-mode.js _rmLessonKey)
function _sdMyLessonKey() {
    try {
        var email = typeof currentUserEmail !== 'undefined' ? currentUserEmail : '';
        if (email) return 'my_lessons_' + email.replace(/[.#$/\[\]]/g, '_');
    } catch(e) {}
    return 'my_lessons';
}

async function _sdPopulateLearnLens(title) {
    var panel=(_sdContainer||document).querySelector('.sd-lens-panel[data-lens="learn"]');
    if (!panel) return;
    var tracks=null, tabs=null, covers=null, myLessons=null;
    try {
        var res=await Promise.all([
            loadBandDataFromDrive(title,'practice_tracks').catch(function(){return null;}),
            loadBandDataFromDrive(title,'personal_tabs').catch(function(){return null;}),
            loadBandDataFromDrive(title,'cover_me').catch(function(){return null;}),
            loadBandDataFromDrive(title,_sdMyLessonKey()).catch(function(){return null;}),
        ]);
        tracks=_sdArr(res[0]); tabs=_sdArr(res[1]); covers=_sdArr(res[2]); myLessons=_sdArr(res[3]);
    } catch(e){}
    var safeSong = title.replace(/'/g,"\\'");

    // My Lessons card (per-user, from Practice Mode)
    var lessonsHtml = '';
    if (myLessons && myLessons.length) {
        lessonsHtml = '<div class="sd-card"><div class="sd-card-title">🎓 My Lessons</div>'
            + myLessons.map(function(item, i) {
                var label = item.title || item.url || 'Lesson';
                var url = item.url || '';
                var addedAt = item.addedAt ? new Date(item.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'
                    + '<span style="font-size:1.2em">🎓</span>'
                    + '<div style="flex:1;min-width:0">'
                    + '<div style="font-size:0.85em;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _sdEsc(label) + '</div>'
                    + (addedAt ? '<div style="font-size:0.72em;color:var(--text-dim)">Added ' + addedAt + '</div>' : '')
                    + '</div>'
                    + (url ? '<a href="' + _sdEsc(url) + '" target="_blank" style="color:var(--accent-light);font-size:0.78em;white-space:nowrap;text-decoration:none">Open →</a>' : '')
                    + '<button onclick="_sdRemoveMyLesson(\'' + safeSong + '\',' + i + ')" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:0.72em;padding:2px 4px" title="Remove">✕</button>'
                    + '</div>';
            }).join('')
            + '<div style="font-size:0.65em;color:var(--text-dim);padding:4px 0;font-style:italic">Saved from Practice Mode — only visible to you</div>'
            + '</div>';
    }

    // Load band chart for display at top of Learn lens
    var _learnChart = null;
    try { var _lc = await loadBandDataFromDrive(title, 'chart').catch(function(){ return null; }); _learnChart = (_lc && _lc.text && _lc.text.trim()) ? _lc.text : null; } catch(e) {}

    // Determine current step based on state
    var _prAvg = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(title) : 0;
    var _justPracticed = !!window._sdPracticeJustEnded;
    window._sdPracticeJustEnded = false; // consume flag
    var _currentStep = _justPracticed ? 3 : (_prAvg > 0 ? 2 : 1);

    // Progress message — directional
    var _prProgress = '';
    if (_justPracticed) _prProgress = '<span style="color:#10b981">Nice \u2014 now rate your readiness</span>';
    else if (_currentStep === 1) _prProgress = 'Start with the reference';
    else if (_currentStep === 2) _prProgress = 'Next: Play it through';
    else _prProgress = 'Next: Rate your readiness';
    if (_prAvg >= 4 && !_justPracticed) _prProgress = '<span style="color:#10b981">All parts ready</span>';

    // Step styling helpers
    var _stepActive = function(step) { return step === _currentStep; };
    var _stepDone = function(step) { return step < _currentStep; };
    var _circleBg = function(step) {
        if (_stepDone(step)) return 'background:#10b981';
        if (_stepActive(step)) return 'background:rgba(129,140,248,0.25)';
        return 'background:rgba(255,255,255,0.06)';
    };
    var _circleColor = function(step) {
        if (_stepDone(step)) return 'color:white';
        if (_stepActive(step)) return 'color:#a5b4fc';
        return 'color:var(--text-dim,#475569)';
    };
    var _circleContent = function(step) { return _stepDone(step) ? '\u2713' : String(step); };
    var _cardBorder = function(step) {
        if (_stepActive(step)) return 'border:1px solid rgba(99,102,241,0.25);background:rgba(99,102,241,0.04)';
        if (_stepDone(step)) return 'border:1px solid rgba(16,185,129,0.15);background:rgba(16,185,129,0.02)';
        return 'border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)';
    };
    var _arrowColor = function(step) {
        if (_stepActive(step)) return 'color:var(--accent-light,#818cf8)';
        return 'color:var(--text-dim,#475569)';
    };

    panel.innerHTML=
        '<div class="sd-panel-inner" style="max-width:640px;margin:0 auto">'+

        // ── HERO ──
        '<div style="text-align:center;padding:18px 16px;margin-bottom:14px;background:linear-gradient(135deg,rgba(99,102,241,0.05),rgba(34,197,94,0.03));border:1px solid rgba(99,102,241,0.15);border-radius:12px">'+
        '<div style="font-size:1.05em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:10px">\uD83C\uDFB8 Practice This Song</div>'+
        '<button onclick="openRehearsalMode(\''+safeSong+'\')" style="padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:700;font-size:0.92em;cursor:pointer;box-shadow:0 2px 8px rgba(99,102,241,0.2);min-width:200px">Start Practice Session</button>'+
        '<div style="font-size:0.75em;color:var(--text-dim);margin-top:8px">Start a guided practice run</div>'+
        '</div>'+

        // ── Progress ──
        '<div style="text-align:center;font-size:0.75em;font-weight:600;color:var(--text-dim,#475569);margin-bottom:14px;letter-spacing:0.02em">'+_prProgress+'</div>'+

        // ── Guided Steps ──
        '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">'+

        // Step 1: Listen
        '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;'+_cardBorder(1)+';cursor:pointer;transition:background 0.15s" onclick="switchLens(\'listen\')" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">'+
        '<div style="width:28px;height:28px;border-radius:50%;'+_circleBg(1)+';display:flex;align-items:center;justify-content:center;font-size:0.72em;font-weight:800;'+_circleColor(1)+';flex-shrink:0">'+_circleContent(1)+'</div>'+
        '<div style="flex:1">'+
        '<div style="font-size:0.85em;font-weight:600;color:var(--text,#f1f5f9)">Listen to the reference</div>'+
        '<div style="font-size:0.7em;color:var(--text-dim,#475569)">Hear how it should sound</div>'+
        '</div>'+
        '<span style="font-size:0.78em;'+_arrowColor(1)+'">\uD83C\uDFA7 \u203A</span>'+
        '</div>'+

        // Step 2: Play Along
        '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;'+_cardBorder(2)+';cursor:pointer;transition:background 0.15s" onclick="openRehearsalMode(\''+safeSong+'\')" onmouseover="this.style.background=\'rgba(99,102,241,0.06)\'" onmouseout="this.style.background=\'\'">'+
        '<div style="width:28px;height:28px;border-radius:50%;'+_circleBg(2)+';display:flex;align-items:center;justify-content:center;font-size:0.72em;font-weight:800;'+_circleColor(2)+';flex-shrink:0">'+_circleContent(2)+'</div>'+
        '<div style="flex:1">'+
        '<div style="font-size:0.85em;font-weight:600;color:var(--text,#f1f5f9)">Play it all the way through</div>'+
        '<div style="font-size:0.7em;color:var(--text-dim,#475569)">Open chart and run the song</div>'+
        '</div>'+
        '<span style="font-size:0.78em;'+_arrowColor(2)+'">\uD83C\uDFB8 \u203A</span>'+
        '</div>'+

        // Step 3: Rate
        '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;'+_cardBorder(3)+';cursor:pointer;transition:background 0.15s" onclick="sdScrollToReadiness()" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">'+
        '<div style="width:28px;height:28px;border-radius:50%;'+_circleBg(3)+';display:flex;align-items:center;justify-content:center;font-size:0.72em;font-weight:800;'+_circleColor(3)+';flex-shrink:0">'+_circleContent(3)+'</div>'+
        '<div style="flex:1">'+
        '<div style="font-size:0.85em;font-weight:600;color:var(--text,#f1f5f9)">Rate yourself honestly</div>'+
        '<div style="font-size:0.7em;color:var(--text-dim,#475569)">Slide your readiness score</div>'+
        '</div>'+
        '<span style="font-size:0.78em;'+_arrowColor(3)+'">\u2B50 \u203A</span>'+
        '</div>'+

        '</div>'+

        // ── My Lessons (if any) ──
        lessonsHtml+

        // ── References (collapsed) ──
        '<details class="sd-details"><summary class="sd-details-summary" style="font-size:0.78em;padding:8px 12px">\uD83D\uDD17 Tabs, Tracks & References</summary>'+
        '<div style="padding:8px 4px">'+
        '<div class="sd-card"><div class="sd-card-title">\uD83C\uDFA7 Practice Tracks</div>'+
            _sdLinkList(tracks,'\uD83C\uDFA7','')+
            ((!tracks||!tracks.length)?_sdEmptyAdd('No practice tracks yet','_sdAddTrackForm',''+safeSong+''):'')+
            '<div id="sd-learn-track-form"></div>'+
        '</div>'+
        '<div class="sd-card"><div class="sd-card-title">\uD83D\uDCCE Tabs &amp; Charts</div>'+
            _sdLinkList(tabs,'\uD83D\uDCCE','')+
            ((!tabs||!tabs.length)?_sdEmptyAdd('No external tabs yet','_sdAddTabForm',''+safeSong+''):'')+
            '<div id="sd-learn-tab-form"></div>'+
            ((tabs && tabs.length) ? '<button onclick="_sdImportTabAsChart(\'' + safeSong + '\')" style="margin-top:6px;width:100%;padding:8px;border-radius:8px;border:1px dashed rgba(34,197,94,0.3);background:none;color:#86efac;cursor:pointer;font-size:0.72em;font-weight:600">Make this your chart</button>' : '') +
        '</div>'+
        '<div class="sd-card"><div class="sd-card-title">\uD83C\uDFB5 Cover Versions to Study</div>'+
            _sdLinkList(covers,'\uD83C\uDFB5','')+
            ((!covers||!covers.length)?_sdEmptyAdd('No cover versions yet','_sdAddCoverForm',''+safeSong+''):'')+
            '<div id="sd-learn-cover-form"></div>'+
        '</div>'+
        '</div></details>'+

        '</div>';
}

function _sdEmptyAdd(msg, fn, safeSong) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">'
        + '<span style="color:var(--text-dim,#475569);font-size:0.85em">' + msg + '</span>'
        + '<button onclick="' + fn + '(\'' + safeSong + '\')" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#818cf8;font-size:0.75em;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;white-space:nowrap">+ Add</button>'
        + '</div>';
}

// Import external tab URL into band chart — opens rehearsal mode to paste
window._sdImportTabAsChart = function(songTitle) {
    if (typeof openRehearsalMode === 'function') {
        openRehearsalMode(songTitle);
        setTimeout(function() {
            if (typeof showToast === 'function') showToast('Open the tab link, copy the chart, and paste it here', 5000);
        }, 800);
    }
};

// Remove a per-user lesson (bridge to Practice Mode lessons)
// Clear the current North Star: zero out all votes on every version so
// _sdPopulateListenLens recomputes "no winner" → "No North Star set yet".
// Doesn't delete the version entries themselves (those are still useful in
// Version Hub); just resets the vote tally that makes one of them the star.
window._sdClearNorthStar = async function(songTitle) {
    if (!confirm('Clear the current North Star? Votes on all versions will be reset, but the versions themselves stay in the Version Hub.')) return;
    try {
        var refs = _sdArr(await loadBandDataFromDrive(songTitle, 'spotify_versions').catch(function(){ return null; }));
        if (!refs || !refs.length) {
            if (typeof showToast === 'function') showToast('No versions to clear');
            return;
        }
        refs.forEach(function(v) { if (v) v.votes = {}; });
        if (typeof GLStore !== 'undefined' && GLStore.saveSongData) { await GLStore.saveSongData(songTitle, 'spotify_versions', refs); }
        else { await saveBandDataToDrive(songTitle, 'spotify_versions', refs); }
        if (typeof northStarCache !== 'undefined') { try { delete northStarCache[songTitle]; } catch(e) {} }
        if (typeof showToast === 'function') showToast('North Star cleared — pick a new one in Version Hub');
        _sdPopulateListenLens(songTitle);
    } catch(e) {
        console.warn('[SongDetail] clearNorthStar failed:', e && e.message);
        if (typeof showToast === 'function') showToast('Could not clear North Star');
    }
};

window._sdRemoveMyLesson = async function(songTitle, idx) {
    try {
        var key = _sdMyLessonKey();
        var lessons = _sdArr(await loadBandDataFromDrive(songTitle, key).catch(function(){ return null; }));
        if (idx >= 0 && idx < lessons.length) {
            lessons.splice(idx, 1);
            if (typeof GLStore !== 'undefined' && GLStore.saveSongData) { await GLStore.saveSongData(songTitle, key, lessons); }
            else { await saveBandDataToDrive(songTitle, key, lessons); }
            if (typeof showToast === 'function') showToast('Lesson removed');
            _sdPopulateLearnLens(songTitle);
        }
    } catch(e) {}
};

window._sdAddTrackForm = function(songTitle) {
    var el = (_sdContainer||document).querySelector('#sd-learn-track-form');
    if (!el || el.innerHTML) return;
    el.innerHTML = '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;margin-top:8px">'
        + '<input id="sd-track-url" class="app-input" placeholder="Paste YouTube / URL" style="margin-bottom:6px;font-size:0.82em">'
        + '<input id="sd-track-label" class="app-input" placeholder="Label (optional)" style="margin-bottom:6px;font-size:0.82em">'
        + '<div style="display:flex;gap:6px">'
        + '<button onclick="_sdSaveTrack(\'' + songTitle.replace(/'/g,"\\'") + '\')" class="btn btn-primary" style="font-size:0.78em;padding:5px 12px">Save</button>'
        + '<button onclick="this.closest(\'#sd-learn-track-form\').innerHTML=\'\'" class="btn btn-ghost" style="font-size:0.78em;padding:5px 12px">Cancel</button>'
        + '</div></div>';
    el.querySelector('#sd-track-url').focus();
};

window._sdAddTabForm = function(songTitle) {
    var el = (_sdContainer||document).querySelector('#sd-learn-tab-form');
    if (!el || el.innerHTML) return;
    el.innerHTML = '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;margin-top:8px">'
        + '<input id="sd-tab-url" class="app-input" placeholder="Paste tab / chart URL" style="margin-bottom:6px;font-size:0.82em">'
        + '<input id="sd-tab-label" class="app-input" placeholder="Label (e.g. Ultimate Guitar)" style="margin-bottom:6px;font-size:0.82em">'
        + '<div style="display:flex;gap:6px">'
        + '<button onclick="_sdSaveTab(\'' + songTitle.replace(/'/g,"\\'") + '\')" class="btn btn-primary" style="font-size:0.78em;padding:5px 12px">Save</button>'
        + '<button onclick="this.closest(\'#sd-learn-tab-form\').innerHTML=\'\'" class="btn btn-ghost" style="font-size:0.78em;padding:5px 12px">Cancel</button>'
        + '</div></div>';
    el.querySelector('#sd-tab-url').focus();
};

window._sdAddCoverForm = function(songTitle) {
    var el = (_sdContainer||document).querySelector('#sd-learn-cover-form');
    if (!el || el.innerHTML) return;
    el.innerHTML = '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;margin-top:8px">'
        + '<input id="sd-cover-artist" class="app-input" placeholder="Artist / Band name *" style="margin-bottom:6px;font-size:0.82em">'
        + '<input id="sd-cover-url" class="app-input" placeholder="YouTube / Spotify link (optional)" style="margin-bottom:6px;font-size:0.82em">'
        + '<input id="sd-cover-notes" class="app-input" placeholder="Why — e.g. listen to the bass outro (optional)" style="margin-bottom:6px;font-size:0.82em">'
        + '<div style="display:flex;gap:6px">'
        + '<button onclick="_sdSaveCover(\'' + songTitle.replace(/'/g,"\\'") + '\')" class="btn btn-primary" style="font-size:0.78em;padding:5px 12px">Save</button>'
        + '<button onclick="this.closest(\'#sd-learn-cover-form\').innerHTML=\'\'" class="btn btn-ghost" style="font-size:0.78em;padding:5px 12px">Cancel</button>'
        + '</div></div>';
    el.querySelector('#sd-cover-artist').focus();
};

window._sdSaveTrack = async function(songTitle) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    var url = ((_sdContainer||document).querySelector('#sd-track-url')||{}).value || '';
    var label = ((_sdContainer||document).querySelector('#sd-track-label')||{}).value || '';
    if (!url.trim()) { if (typeof showToast==='function') showToast('Enter a URL'); return; }
    var tracks = _sdArr(await loadBandDataFromDrive(songTitle,'practice_tracks').catch(function(){return null;}));
    tracks.push({ url: url.trim(), label: label.trim() || url.trim(), addedBy: typeof getCurrentMemberKey==='function'?getCurrentMemberKey():'unknown' });
    if (typeof GLStore !== 'undefined' && GLStore.saveSongData) { await GLStore.saveSongData(songTitle,'practice_tracks',tracks); }
    else { await saveBandDataToDrive(songTitle,'practice_tracks',tracks); }
    if (typeof showToast==='function') showToast('Track saved');
    _sdPopulateLearnLens(songTitle);
};

window._sdSaveTab = async function(songTitle) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    var url = ((_sdContainer||document).querySelector('#sd-tab-url')||{}).value || '';
    var label = ((_sdContainer||document).querySelector('#sd-tab-label')||{}).value || '';
    if (!url.trim()) { if (typeof showToast==='function') showToast('Enter a URL'); return; }
    var tabs = _sdArr(await loadBandDataFromDrive(songTitle,'personal_tabs').catch(function(){return null;}));
    tabs.push({ url: url.trim(), label: label.trim() || url.trim(), memberKey: typeof getCurrentMemberKey==='function'?getCurrentMemberKey():'unknown' });
    if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
        await GLStore.saveSongData(songTitle,'personal_tabs',tabs);
    } else {
        await saveBandDataToDrive(songTitle,'personal_tabs',tabs);
    }
    if (typeof showToast==='function') showToast('Tab saved');
    _sdPopulateLearnLens(songTitle);
};

window._sdSaveCover = async function(songTitle) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    var artist = ((_sdContainer||document).querySelector('#sd-cover-artist')||{}).value || '';
    if (!artist.trim()) { if (typeof showToast==='function') showToast('Enter an artist name'); return; }
    var url = ((_sdContainer||document).querySelector('#sd-cover-url')||{}).value || '';
    var notes = ((_sdContainer||document).querySelector('#sd-cover-notes')||{}).value || '';
    var covers = _sdArr(await loadBandDataFromDrive(songTitle,'cover_me').catch(function(){return null;}));
    covers.push({ artist: artist.trim(), url: url.trim(), description: notes.trim(), addedBy: typeof getCurrentMemberKey==='function'?getCurrentMemberKey():'unknown', addedAt: new Date().toISOString() });
    if (typeof GLStore !== 'undefined' && GLStore.saveSongData) { await GLStore.saveSongData(songTitle,'cover_me',covers); }
    else { await saveBandDataToDrive(songTitle,'cover_me',covers); }
    if (typeof showToast==='function') showToast('Cover saved');
    _sdPopulateLearnLens(songTitle);
};

function _sdLinkList(items, icon, emptyMsg) {
    if (!items||!items.length) return '<div style="color:var(--text-dim);font-size:0.85em">'+emptyMsg+'</div>';
    return items.map(function(item){
        var url=item.url||item.link||item.spotifyUrl||'';
        var label=item.artist||item.title||item.label||item.name||url;
        var who=item.addedBy||item.memberKey||'';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
               '<span style="font-size:1.2em">'+icon+'</span>'+
               '<div style="flex:1;min-width:0">'+
               '<div style="font-size:0.85em;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_sdEsc(label)+'</div>'+
               (who?'<div style="font-size:0.72em;color:var(--text-dim)">'+_sdEsc(who)+'</div>':'')+
               '</div>'+(url?'<a href="'+_sdEsc(url)+'" target="_blank" style="color:var(--accent-light);font-size:0.78em;white-space:nowrap;text-decoration:none">Open →</a>':'')+
               '</div>';
    }).join('');
}

// ── Sing Lens ─────────────────────────────────────────────────────────────────
function _sdPopulateSingLens(title) {
    var panel=(_sdContainer||document).querySelector('.sd-lens-panel[data-lens="sing"]');
    if (!panel) return;
    if (typeof renderHarmonyLab==='function') {
        panel.innerHTML='<div class="sd-panel-inner"><div id="sd-harmony-lab-mount"></div></div>';
        renderHarmonyLab(title,'sd-harmony-lab-mount');
    } else if (typeof glLazy==='function') {
        panel.innerHTML='<div class="sd-panel-inner" style="text-align:center;padding:20px;color:var(--text-dim)">Loading Harmony Lab\u2026</div>';
        glLazy('js/features/harmony-lab.js').then(function() {
            if (typeof renderHarmonyLab==='function') {
                panel.innerHTML='<div class="sd-panel-inner"><div id="sd-harmony-lab-mount"></div></div>';
                renderHarmonyLab(title,'sd-harmony-lab-mount');
            }
        }).catch(function() {
            panel.innerHTML='<div class="sd-panel-inner"><div class="sd-card sd-coming-soon"><div class="sd-cs-icon">\uD83C\uDFA4</div><div class="sd-cs-title">Harmony Lab</div><div class="sd-cs-desc">Could not load</div></div></div>';
        });
    } else {
        panel.innerHTML='<div class="sd-panel-inner"><div class="sd-card sd-coming-soon"><div class="sd-cs-icon">\uD83C\uDFA4</div><div class="sd-cs-title">Harmony Lab</div><div class="sd-cs-desc">Coming soon</div></div></div>';
    }
}

// ── Inspire Lens ──────────────────────────────────────────────────────────────
function _sdPopulateInspireLens() {
    var panel=(_sdContainer||document).querySelector('.sd-lens-panel[data-lens="inspire"]');
    if (!panel) return;
    panel.innerHTML='<div class="sd-panel-inner"><div class="sd-card sd-coming-soon"><div class="sd-cs-icon">✨</div><div class="sd-cs-title">Inspire</div><div class="sd-cs-desc">Mood clips, alternate interpretations, and creative references — coming soon.</div></div></div>';
}

// ── Firebase helpers ──────────────────────────────────────────────────────────
function _sdGet(subpath){
    if(typeof firebaseDB==='undefined'||!firebaseDB||typeof bandPath!=='function') return Promise.resolve(null);
    return firebaseDB.ref(bandPath(subpath)).once('value').then(function(s){return s.val();}).catch(function(){return null;});
}
function _sdSet(subpath,val){
    if(typeof firebaseDB==='undefined'||!firebaseDB||typeof bandPath!=='function') return;
    firebaseDB.ref(bandPath(subpath)).set(val).catch(function(e){console.warn('[song-detail] write failed:',e);});
}

// ── Util ──────────────────────────────────────────────────────────────────────
function _sdEsc(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _sdArr(v){if(!v)return[];if(Array.isArray(v))return v;return Object.values(v);}

// ── Page registration ─────────────────────────────────────────────────────────
if (typeof pageRenderers!=='undefined') {
    pageRenderers['songdetail']=function(){
        _sdLensPopulated={}; _sdCurrentLens='band';
        window.renderSongDetail();
    };
}

// ── Styles ────────────────────────────────────────────────────────────────────
// ── Right Panel: persistent song context (always visible on desktop) ──────────
async function _sdPopulateRightPanel(title) {
    var infoEl = (_sdContainer || document).querySelector('#sd-right-info');
    var structEl = (_sdContainer || document).querySelector('#sd-right-structure');
    var extrasEl = (_sdContainer || document).querySelector('#sd-right-extras');
    if (!infoEl) return; // not in dual layout (mobile fallback)

    var safeSong = _sdEsc(title).replace(/'/g, "\\'");

    // ── COLLAPSED BY DEFAULT: Band Love + Audience Love ──
    // Per Drew/ChatGPT critique 2026-05-10: love hearts used to take up
    // ~150px above the fold and weren't actionable in the moment. Hidden
    // behind a one-line summary; tap to expand for the full hearts UI.
    var bandLove = (typeof GLStore !== 'undefined' && GLStore.getBandLove) ? (GLStore.getBandLove(title) || 0) : 0;
    var audLove = (typeof GLStore !== 'undefined' && GLStore.getAudienceLove) ? (GLStore.getAudienceLove(title) || 0) : 0;
    var loveSummary = '❤️ ' + bandLove + '/5  ·  💜 ' + audLove + '/5';
    infoEl.innerHTML =
        '<details class="sd-details" style="border-top:1px solid rgba(255,255,255,0.04)">'
        + '<summary style="padding:8px 12px;font-size:0.78em;font-weight:600;color:var(--text-dim);cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between">'
        + '<span><span style="font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-right:8px">Love</span>' + loveSummary + '</span>'
        + '<span style="font-size:0.9em;opacity:0.5">▶</span>'
        + '</summary>'
        + '<div style="padding:6px 12px 12px" id="sd-love-card">'
        + _sdRenderBandLove(title, safeSong)
        + _sdRenderAudienceLove(title, safeSong)
        + '</div>'
        + '</details>';

    // ── COLLAPSED BY DEFAULT: Readiness ──
    // Was always-open and dominated vertical space. Compressed to a
    // one-line "5/5 band average" summary; expand for the full per-member
    // sliders. Current member sees interactive slider on expand.
    var songScores = (typeof GLStore !== 'undefined' && GLStore.getReadiness) ? (GLStore.getReadiness(title) || {}) : {};
    var rpMembers = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var rpMyKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    var rdScores = rpMembers.map(function(m) { return songScores[m.key || m] || 0; }).filter(function(v) { return v > 0; });
    var rdAvg = rdScores.length ? (rdScores.reduce(function(a, b) { return a + b; }, 0) / rdScores.length) : 0;
    var rdAvgLabel = rdAvg > 0 ? rdAvg.toFixed(1) + '/5 band average' : 'no ratings yet';
    var readinessHtml = '<details class="sd-details" style="border-top:1px solid rgba(255,255,255,0.04)">'
        + '<summary style="padding:8px 12px;font-size:0.78em;font-weight:600;color:var(--text-dim);cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between">'
        + '<span><span style="font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-right:8px">Readiness</span>' + rdAvgLabel + '</span>'
        + '<span style="font-size:0.9em;opacity:0.5">▶</span>'
        + '</summary>'
        + '<div style="padding:6px 12px 12px"><div style="display:flex;flex-direction:column;gap:4px">';
    rpMembers.forEach(function(m) {
        var key = m.key || m, name = m.name || (key.charAt(0).toUpperCase() + key.slice(1));
        var score = songScores[key];
        var color = score ? (score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#ef4444') : '#475569';
        var barPct = score ? (score / 5 * 100) : 0;
        var isMe = rpMyKey && key === rpMyKey;
        var rpLblId = 'sd-rp-score-' + key;
        var nameCell = '<span style="color:' + (isMe ? 'var(--text)' : 'var(--text-dim)') + ';font-weight:' + (isMe ? '700' : '500') + ';min-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _sdEsc(name) + '</span>';
        var midCell;
        if (isMe) {
            midCell = '<input type="range" name="readiness-rp-' + key + '" min="0" max="5" step="1" value="' + (score || 0) + '" '
                + 'style="flex:1;min-width:0;accent-color:var(--accent);cursor:pointer" '
                + 'title="Drag to rate 0-5: Never played \u2192 Gig ready" '
                + 'oninput="(function(el){var v=parseInt(el.value,10);var c=v>=4?\'#10b981\':v>=3?\'#f59e0b\':v>0?\'#ef4444\':\'#475569\';var lbl=document.getElementById(\'' + rpLblId + '\');if(lbl){lbl.textContent=v||(\'\\u2014\');lbl.style.color=c;}})(this)" '
                + 'onchange="sdSaveReadiness(\'' + safeSong + '\',\'' + key + '\',this.value)">';
        } else {
            midCell = '<div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden"><div style="width:' + barPct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>';
        }
        readinessHtml += '<div style="display:flex;align-items:center;gap:8px;font-size:0.78em">'
            + nameCell + midCell
            + '<span id="' + rpLblId + '" style="color:' + color + ';font-weight:700;min-width:16px;text-align:right">' + (score || '\u2014') + '</span>'
            + '</div>';
    });
    readinessHtml += '</div></div></details>';

    // Love cards are now rendered in infoEl (above readiness, above fold)

    // ── COLLAPSIBLE: Structure ──
    structEl.innerHTML = '';
    if (typeof GLStore !== 'undefined' && GLStore.loadFieldMeta) {
        GLStore.loadFieldMeta(title, 'song_structure').then(function(data) {
            var sections = (data && data.sections && data.sections.length) ? data.sections : [];
            var structHtml = '<details class="sd-details" style="border-top:1px solid rgba(255,255,255,0.04)">'
                + '<summary style="padding:8px 12px;font-size:0.68em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between">'
                + '\uD83C\uDFBC Structure <span style="font-size:0.9em;opacity:0.5">\u25B6</span></summary>'
                + '<div style="padding:4px 12px 10px">';
            if (sections.length) {
                structHtml += '<div style="font-size:0.75em;color:var(--text-dim);line-height:1.6;margin-bottom:6px">'
                    + sections.map(function(sec) { return _sdEsc(sec.name || sec.label || sec); }).join(' \u00B7 ')
                    + '</div>';
            }
            structHtml += '<button class="sd-pm-btn" style="font-size:0.7em;padding:3px 8px" onclick="sdEditStructure(\'' + safeSong + '\')">Edit Structure</button>'
                + '</div></details>';
            if (structEl) structEl.innerHTML = structHtml;
        }).catch(function() {});
    }

    // Discussion section removed from the right rail per Drew/ChatGPT
    // critique 2026-05-10 — wasn't actionable from this surface, was
    // generating noise. Discussion is still reachable via the Practice
    // lens. Prospect voting kept (rare, conditional).
    var rpStatus = (typeof statusCache !== 'undefined' && statusCache[title]) ? statusCache[title] : '';
    var extrasHtml = '';
    if (rpStatus === 'prospect') {
        extrasHtml = '<div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,0.04)">'
            + '<div id="sd-rp-prospect-vote"></div>'
            + '</div>';
    }
    if (extrasEl) {
        extrasEl.innerHTML = readinessHtml + extrasHtml;
        if (rpStatus === 'prospect') {
            setTimeout(function() {
                var voteMount = document.getElementById('sd-rp-prospect-vote');
                if (voteMount) _sdRenderProspectVote(title);
            }, 300);
        }
    }
}

function _sdInjectStyles(){
    if((_sdContainer||document).querySelector('#sd-styles')) return;
    var s=document.createElement('style');
    s.id='sd-styles';
    s.textContent='.song-detail-page{max-width:800px;margin:0 auto;padding:0 0 80px;opacity:0;transform:translateY(12px);transition:opacity 0.25s ease,transform 0.25s ease}'+
    '.sd-entered .song-detail-page{opacity:1;transform:none}'+
    '.sd-header{padding:14px 16px 0;background:var(--bg-card,#1e293b);border-bottom:1px solid var(--border,rgba(255,255,255,0.08));z-index:50;border-radius:12px 12px 0 0}'+
    '.sd-header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}'+
    '.sd-back-btn{background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--text-muted,#94a3b8);padding:5px 12px;border-radius:20px;font-size:0.82em;font-weight:600;cursor:pointer;transition:all 0.15s}'+
    '.sd-back-btn:hover{background:rgba(255,255,255,0.06);color:var(--text,#f1f5f9)}'+
    '.sd-header-meta{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}'+
    '.sd-meta-pill{font-size:0.73em;font-weight:700;padding:3px 8px;border-radius:12px;background:rgba(255,255,255,0.07);color:var(--text-muted,#94a3b8);border:1px solid rgba(255,255,255,0.08)}'+
    '.sd-title{font-size:1.5em;font-weight:800;color:var(--text,#f1f5f9);margin:0 0 8px;line-height:1.2;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06)}'+
    '.sd-readiness-strip{margin-bottom:8px;min-height:20px}'+
    '.sd-readiness-pills{display:flex;gap:4px;flex-wrap:wrap}'+
    '.sd-readiness-pill{font-size:0.7em;font-weight:700;padding:2px 7px;border-radius:10px;color:#fff}'+
    '.sd-tab-bar{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;background:var(--bg-card,#1e293b);border-bottom:2px solid var(--border,rgba(255,255,255,0.08));padding:0 8px;scrollbar-width:none;position:sticky;top:0;z-index:49}'+
    '.sd-tab-bar::-webkit-scrollbar{display:none}'+
    '.sd-tab-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 14px 6px;background:transparent;border:none;border-bottom:3px solid transparent;color:var(--text-muted,#94a3b8);cursor:pointer;font-weight:600;white-space:nowrap;transition:all 0.15s;flex-shrink:0}'+
    '.sd-tab-btn:hover{color:var(--text,#f1f5f9);background:rgba(255,255,255,0.03)}'+
    '.sd-tab-btn--active{color:var(--accent,#667eea);border-bottom-color:var(--accent,#667eea)}'+
    '.sd-tab-icon{font-size:1.15em}.sd-tab-label{font-size:0.7em;font-weight:700;letter-spacing:0.04em;text-transform:uppercase}'+
    '.sd-panels{padding:12px 0}.sd-lens-panel{min-height:200px}'+
    '.sd-panel-inner{display:flex;flex-direction:column;gap:12px}'+
    '.sd-card{background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:12px;padding:16px;margin:0 0 12px}'+
    '.sd-card-title{font-size:0.82em;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted,#94a3b8);margin-bottom:12px;display:flex;align-items:center;gap:8px}'+
    '.sd-title-badge{font-size:0.78em;font-weight:700;padding:2px 7px;border-radius:8px;background:rgba(102,126,234,0.15);color:#818cf8;text-transform:none;letter-spacing:0}'+
    '.sd-title-badge--gold{background:rgba(251,191,36,0.15);color:#fbbf24}'+
    '.sd-dna-grid{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px}'+
    '.sd-dna-item{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px}'+
    '.sd-dna-attr{width:100%;font-size:0.65em;color:var(--text-dim,#475569);line-height:1.2;min-height:0}'+
    '.sd-dna-label{font-size:0.8em;font-weight:700;color:var(--text-muted,#94a3b8);white-space:nowrap}'+
    '.sd-select{font-size:0.82em!important;padding:5px 8px!important}'+
    '.sd-bpm-input{width:65px!important;padding:5px 8px!important;font-size:0.82em!important}'+
    '.sd-coming-soon{text-align:center;padding:36px 20px}'+
    '.sd-cs-icon{font-size:2.2em;margin-bottom:10px}'+
    '.sd-cs-title{font-size:1.1em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:6px}'+
    '.sd-cs-desc{font-size:0.88em;color:var(--text-muted,#94a3b8);margin-bottom:10px}'+
    '.sd-skeleton-pulse{background:linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.06) 75%);background-size:200% 100%;animation:sdSkeletonPulse 1.4s infinite;border-radius:4px;margin-bottom:8px}'+
    '@keyframes sdSkeletonPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}'+
    '.sd-intel-card{background:linear-gradient(135deg,rgba(102,126,234,0.07),rgba(118,75,162,0.07));border-color:rgba(102,126,234,0.18)}'+
    '.sd-intel-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;padding:2px 0}'+
    '.sd-intel-item{display:flex;flex-direction:column;gap:3px}'+
    '.sd-intel-label{font-size:0.68em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim,#475569)}'+
    '.sd-intel-val{font-size:1.1em;font-weight:800;color:var(--text,#f1f5f9)}'+
    '.sd-intel-sm{font-size:0.88em;font-weight:700}'+
    '.sd-intel-unit{font-size:0.6em;font-weight:600;color:var(--text-muted)}'+
    '.sd-intel-sub{font-size:0.62em;font-weight:600;color:var(--text-dim,#475569);margin-top:2px}'+
    '.sd-pm-btn{padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text,#f1f5f9);font-size:0.82em;font-weight:700;cursor:pointer;transition:all 0.15s;white-space:nowrap}'+
    '.sd-pm-btn:hover{background:rgba(102,126,234,0.15);border-color:rgba(102,126,234,0.35);color:#818cf8}'+
    '.sd-pm-btn--hero{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.3);color:#a5b4fc;font-size:0.92em;padding:10px 20px}'+
    '.sd-details{margin-bottom:8px;border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;overflow:hidden}'+
    '.sd-details[open]{border-color:rgba(99,102,241,0.15)}'+
    '.sd-details-summary{padding:12px 16px;font-size:0.85em;font-weight:700;color:var(--text-muted,#94a3b8);cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.02);transition:background 0.15s}'+
    '.sd-details-summary:hover{background:rgba(255,255,255,0.04)}'+
    '.sd-details-summary::-webkit-details-marker{display:none}'+
    '.sd-details[open] .sd-details-summary{border-bottom:1px solid var(--border,rgba(255,255,255,0.06))}'+
    '.sd-details > div{padding:0 12px}'+
    '.sd-trend{font-size:0.78em;padding:8px 10px;margin-top:10px;border-radius:8px;line-height:1.4}'+
    '.sd-trend--up{background:rgba(34,197,94,0.06);color:#86efac;border:1px solid rgba(34,197,94,0.12)}'+
    '.sd-trend--flat{background:rgba(245,158,11,0.06);color:#fbbf24;border:1px solid rgba(245,158,11,0.12)}'+
    '.sd-trend--work{background:rgba(99,102,241,0.04);color:#a5b4fc;border:1px solid rgba(99,102,241,0.1)}'+
    '@keyframes sdCelebFade{0%{opacity:0;transform:translate(-50%,-50%) scale(0.8)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}25%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-55%) scale(1)}}'+
    '.sd-panel-inner{animation:sdPanelIn 0.2s ease}'+
    '@keyframes sdPanelIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'+
    '.sd-notes-sub{font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim,#475569);margin-bottom:8px}'+
    '.sd-mobile-bar{display:none;position:fixed;bottom:0;left:0;right:0;padding:8px 16px;background:var(--bg-card,#1e293b);border-top:1px solid var(--border,rgba(255,255,255,0.08));z-index:60;gap:8px;justify-content:center}'+
    '.sd-mobile-bar__btn{flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text,#f1f5f9);font-size:0.82em;font-weight:700;cursor:pointer;text-align:center}'+
    '.sd-mobile-bar__btn--primary{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.3);color:#a5b4fc}'+
    '@media(max-width:768px){.sd-mobile-bar{display:flex}.song-detail-page{padding-bottom:120px}}'+
    // Dual-layout: left workspace + right persistent panel
    '.sd-dual-layout{max-width:1200px}'+
    '.sd-workspace-row{display:flex;gap:12px;align-items:flex-start}'+
    '.sd-left-workspace{flex:1;min-width:0}'+
    '.sd-right-panel{width:260px;flex-shrink:0;position:sticky;top:60px;max-height:calc(100vh - 80px);overflow-y:auto;background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.06));border-radius:10px}'+
    '.sd-right-panel::-webkit-scrollbar{width:3px}.sd-right-panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}'+
    '@media(max-width:900px){.sd-workspace-row{flex-direction:column}.sd-right-panel{width:100%;position:static;max-height:none;border-radius:10px}}';
    document.head.appendChild(s);
}

// ── Band Love Rating ────────────────────────────────────────────────────────

function _sdRenderBandLove(title, safeSong) {
    var love = (typeof GLStore !== 'undefined' && GLStore.getBandLove) ? GLStore.getBandLove(title) : 0;
    var derived = (typeof GLStore !== 'undefined' && GLStore.deriveSongStatus) ? GLStore.deriveSongStatus(title) : { label: 'Unrated', color: '#64748b' };
    var HEARTS = ['\u2764\uFE0F', '\u2764\uFE0F', '\u2764\uFE0F', '\u2764\uFE0F', '\u2764\uFE0F'];
    var labels = ['Not set', 'Meh', 'It\u2019s OK', 'Like it', 'Love it', 'LOVE IT'];

    // Shared band love (primary)
    var html = '<div style="display:flex;align-items:center;gap:12px;padding:8px 0">';
    html += '<span style="font-size:0.82em;font-weight:600;color:var(--text);min-width:70px">Band Love</span>';
    for (var i = 1; i <= 5; i++) {
        var active = i <= love;
        html += '<button onclick="sdSaveBandLove(\'' + safeSong + '\',' + i + ')" style="background:none;border:none;font-size:1.3em;cursor:pointer;opacity:' + (active ? '1' : '0.25') + ';transition:opacity 0.15s" title="' + labels[i] + '">' + HEARTS[(i - 1) % HEARTS.length] + '</button>';
    }
    html += '<span style="font-size:0.75em;color:var(--text-dim);margin-left:auto">' + labels[love] + '</span>';
    html += '</div>';

    // Personal band love (secondary, subtle)
    var myBl = (typeof GLStore !== 'undefined' && GLStore.getPersonalBandLove) ? GLStore.getPersonalBandLove(title) : 0;
    html += '<div style="display:flex;align-items:center;gap:12px;padding:2px 0;opacity:0.6">';
    html += '<span style="font-size:0.68em;color:var(--text-dim);min-width:70px">Your take</span>';
    for (var j = 1; j <= 5; j++) {
        var pActive = j <= myBl;
        html += '<button onclick="sdSavePersonalBandLove(\'' + safeSong + '\',' + j + ')" style="background:none;border:none;font-size:0.9em;cursor:pointer;opacity:' + (pActive ? '1' : '0.2') + ';transition:opacity 0.15s" title="Your personal: ' + labels[j] + '">\u2764\uFE0F</button>';
    }
    if (myBl > 0) html += '<span style="font-size:0.62em;color:var(--text-dim);margin-left:auto">' + labels[myBl] + '</span>';
    html += '</div>';

    // Band love disagreement insight
    if (typeof GLStore !== 'undefined' && GLStore.getBandLoveDisagreement) {
        var blDis = GLStore.getBandLoveDisagreement(title);
        if (blDis.disagreementLevel === 'notable' || blDis.disagreementLevel === 'strong') {
            var blInsight = '';
            if (blDis.delta > 0) blInsight = 'You\u2019re higher on this than the band \u2014 worth pushing?';
            else if (blDis.delta < 0) blInsight = 'You\u2019re lower on this \u2014 revisit or consider dropping';
            else if (blDis.groupSpread >= 2) blInsight = 'Mixed band feelings \u2014 try it live and decide';
            if (blInsight) {
                html += '<div style="font-size:0.62em;color:var(--gl-amber,#f59e0b);padding:1px 0;font-style:italic">' + blInsight + '</div>';
            }
        } else if (blDis.raterCount >= 3 && blDis.groupSpread <= 1 && love >= 4) {
            html += '<div style="font-size:0.62em;color:var(--gl-green,#22c55e);padding:1px 0;font-style:italic">Band agrees strongly on this one</div>';
        }
    }

    // Derived status badge
    if (derived.status !== 'unrated') {
        html += '<div style="display:inline-block;font-size:0.72em;font-weight:700;padding:3px 10px;border-radius:6px;background:' + derived.color + '20;color:' + derived.color + ';border:1px solid ' + derived.color + '30;margin-top:4px">' + derived.label + '</div>';
    }

    return html;
}

window.sdSaveBandLove = function(title, value) {
    if (typeof GLStore !== 'undefined' && GLStore.saveBandLove) {
        GLStore.saveBandLove(title, value);
        _sdRefreshLoveCard(null, title);
    }
};

// ── Audience Love Rating ─────────────────────────────────────────────────────

function _sdRenderAudienceLove(title, safeSong) {
    var crowd = (typeof GLStore !== 'undefined' && GLStore.getAudienceLove) ? GLStore.getAudienceLove(title) : 0;
    var HEARTS = ['\uD83D\uDC9C', '\uD83D\uDC9C', '\uD83D\uDC9C', '\uD83D\uDC9C', '\uD83D\uDC9C'];
    var labels = ['Not set', 'Quiet', 'Polite', 'Into it', 'They love it', 'CROWD GOES WILD'];

    // Shared audience love (primary)
    var html = '<div style="display:flex;align-items:center;gap:12px;padding:4px 0">';
    html += '<span style="font-size:0.82em;font-weight:600;color:var(--text);min-width:70px">Audience</span>';
    for (var i = 1; i <= 5; i++) {
        var active = i <= crowd;
        html += '<button onclick="sdSaveAudienceLove(\'' + safeSong + '\',' + i + ')" style="background:none;border:none;font-size:1.3em;cursor:pointer;opacity:' + (active ? '1' : '0.15') + ';transition:opacity 0.15s" title="' + labels[i] + '">' + HEARTS[(i - 1) % HEARTS.length] + '</button>';
    }
    html += '<span style="font-size:0.75em;color:var(--text-dim);margin-left:auto">' + labels[crowd] + '</span>';
    html += '</div>';

    // Personal audience love (secondary, subtle)
    var myAl = (typeof GLStore !== 'undefined' && GLStore.getPersonalAudienceLove) ? GLStore.getPersonalAudienceLove(title) : 0;
    html += '<div style="display:flex;align-items:center;gap:12px;padding:2px 0;opacity:0.6">';
    html += '<span style="font-size:0.68em;color:var(--text-dim);min-width:70px">Your take</span>';
    for (var j = 1; j <= 5; j++) {
        var pActive = j <= myAl;
        html += '<button onclick="sdSavePersonalAudienceLove(\'' + safeSong + '\',' + j + ')" style="background:none;border:none;font-size:0.9em;cursor:pointer;opacity:' + (pActive ? '1' : '0.2') + ';transition:opacity 0.15s" title="Your personal: ' + labels[j] + '">\uD83D\uDC9C</button>';
    }
    if (myAl > 0) html += '<span style="font-size:0.62em;color:var(--text-dim);margin-left:auto">' + labels[myAl] + '</span>';
    html += '</div>';

    // Audience love disagreement insight
    if (typeof GLStore !== 'undefined' && GLStore.getAudienceLoveDisagreement) {
        var alDis = GLStore.getAudienceLoveDisagreement(title);
        if (alDis.disagreementLevel === 'notable' || alDis.disagreementLevel === 'strong') {
            var alInsight = '';
            if (alDis.delta > 0) alInsight = 'You think the crowd loves this more \u2014 play it and see';
            else if (alDis.delta < 0) alInsight = 'You think the crowd cares less \u2014 test it at a gig';
            else if (alDis.groupSpread >= 2) alInsight = 'Crowd impact feels debated \u2014 try it live and decide';
            if (alInsight) {
                html += '<div style="font-size:0.62em;color:var(--gl-amber,#f59e0b);padding:1px 0;font-style:italic">' + alInsight + '</div>';
            }
        }
    }

    // Recommendation insight when both ratings exist
    var bandLove = (typeof GLStore !== 'undefined' && GLStore.getBandLove) ? GLStore.getBandLove(title) : 0;
    if (bandLove > 0 && crowd > 0) {
        var insight = '';
        if (bandLove >= 4 && crowd >= 4) insight = 'Band + crowd favorite \u2014 anchor song';
        else if (bandLove >= 4 && crowd < 3) insight = 'Band loves it \u2014 worth tightening for the crowd';
        else if (bandLove < 3 && crowd >= 4) insight = 'Crowd favorite \u2014 get this ready';
        else if (bandLove < 3 && crowd < 3) insight = 'Low energy both sides \u2014 consider dropping';
        if (insight) {
            html += '<div style="font-size:0.68em;color:var(--text-dim);padding:2px 0;margin-top:2px;font-style:italic">' + insight + '</div>';
        }
    }

    return html;
}

window.sdSaveAudienceLove = function(title, value) {
    if (typeof GLStore !== 'undefined' && GLStore.saveAudienceLove) {
        GLStore.saveAudienceLove(title, value);
        _sdRefreshLoveCard(null, title);
    }
};

window.sdSavePersonalBandLove = function(title, value) {
    if (typeof GLStore !== 'undefined' && GLStore.savePersonalBandLove) {
        GLStore.savePersonalBandLove(title, value);
        _sdRefreshLoveCard(null, title);
    }
};

window.sdSavePersonalAudienceLove = function(title, value) {
    if (typeof GLStore !== 'undefined' && GLStore.savePersonalAudienceLove) {
        GLStore.savePersonalAudienceLove(title, value);
        _sdRefreshLoveCard(null, title);
    }
};

function _sdRefreshLoveCard(_unused, title) {
    var card = document.getElementById('sd-love-card');
    if (!card) return;
    // Always rebuild safeSong from the raw title — never reuse the parameter
    // from the onclick handler (it was unescaped by the JS runtime)
    var safeSong = _sdEsc(title).replace(/'/g, "\\'");
    card.innerHTML = _sdRenderBandLove(title, safeSong) + _sdRenderAudienceLove(title, safeSong);
}

console.log('✅ song-detail.js loaded (Phase 2 — direct Firebase, no DOM mirroring)');

// ── GLActions: stems-domain actions ─────────────────────────────────────────
// Real handlers overwrite the gl-actions.js stubs. Wraps the existing
// _sdStems* functions so GrooveMate (and eventually GLActionRouter) can
// drive them without referencing module-internal globals.
if (typeof window !== 'undefined' && window.GLActions) {

  // Set / arm a loop. Accepts { inSec, outSec, enabled }; missing fields
  // leave the existing values in place.
  window.GLActions.register('stems.setLoop', function (args) {
    args = args || {};
    if (typeof args.inSec === 'number' && typeof window._sdStemsSetLoopIn === 'function') {
      window._sdStemsSetLoopIn(args.inSec);
    }
    if (typeof args.outSec === 'number' && typeof window._sdStemsSetLoopOut === 'function') {
      window._sdStemsSetLoopOut(args.outSec);
    }
    if (args.enabled === false && typeof _sdLoop !== 'undefined' && _sdLoop.enabled) {
      if (typeof window._sdStemsToggleLoop === 'function') window._sdStemsToggleLoop();
    }
    if (args.enabled === true && typeof _sdLoop !== 'undefined' && !_sdLoop.enabled) {
      if (typeof window._sdStemsToggleLoop === 'function') window._sdStemsToggleLoop();
    }
    return {
      inSec: (typeof _sdLoop !== 'undefined') ? _sdLoop.inSec : null,
      outSec: (typeof _sdLoop !== 'undefined') ? _sdLoop.outSec : null,
      enabled: (typeof _sdLoop !== 'undefined') ? !!_sdLoop.enabled : false
    };
  }, { source: 'song-detail.js' });

  // Apply a practice preset. Currently the only mode is "mute one stem so
  // you can play that part live." stemId comes from the Demucs vocabulary
  // (drums/bass/vocals/other/keys/guitar). Future modes (e.g. "drums+bass
  // backbone") would wire here without changing GrooveMate.
  window.GLActions.register('stems.applyPracticeMode', function (args) {
    args = args || {};
    if (args.mode === 'mute-stem' && args.stemId) {
      if (typeof window._sdStemsApplyPreset === 'function') {
        window._sdStemsApplyPreset(args.stemId);
        return { ok: true, mode: 'mute-stem', stemId: args.stemId };
      }
    }
    if (args.mode === 'reset' || args.mode === 'all-on') {
      if (typeof window._sdStemsResetPresets === 'function') {
        window._sdStemsResetPresets();
        return { ok: true, mode: 'reset' };
      }
    }
    return { ok: false, reason: 'unsupported mode', mode: args.mode };
  }, { source: 'song-detail.js' });

  // Reset all stem volumes back to 80% (the existing 🔊 Reset volumes
  // behavior). Distinct from applyPracticeMode reset which is about the
  // mute preset.
  window.GLActions.register('stems.resetMix', function () {
    if (typeof window._sdStemsResetVolumes === 'function') {
      window._sdStemsResetVolumes();
      return { ok: true };
    }
    return { ok: false, reason: '_sdStemsResetVolumes missing' };
  }, { source: 'song-detail.js' });

  // Stub remains for stems.recordTake — record-take UI doesn't exist yet.
}

// Refresh the GrooveMate hint pill whenever stems fullscreen toggles
// (entering fullscreen is a strong signal the user is in deep-practice
// mode and is the moment a hint is most useful).
if (typeof window !== 'undefined') {
  var _sdGmOrigToggleFullscreen = window._sdStemsToggleFullscreen;
  if (typeof _sdGmOrigToggleFullscreen === 'function') {
    window._sdStemsToggleFullscreen = function () {
      var r = _sdGmOrigToggleFullscreen.apply(this, arguments);
      try {
        if (typeof _sdGmRefreshHint === 'function') {
          // After the toggle settles into the DOM, re-evaluate.
          setTimeout(_sdGmRefreshHint, 50);
        }
      } catch (e) {}
      return r;
    };
  }
}
