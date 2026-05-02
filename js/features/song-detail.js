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
    var container = containerOverride || document.getElementById('page-songdetail');
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
    h += '<input type="number" min="40" max="240" placeholder="BPM" value="' + _sdEsc(String(_dBpm)) + '" style="width:42px;font-size:0.75em;padding:1px 2px;background:transparent;border:none;color:' + (_dBpm ? 'var(--text)' : 'var(--text-dim)') + ';outline:none" onchange="sdUpdateSongBpm(this.value)">';
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

    if (_isPanelMode) {
        // Single-column layout for right panel rendering
        // Include sd-right-info/extras/structure so _sdPopulateRightPanel renders love + readiness
        return '<div class="song-detail-page">'+
               '<div class="sd-header">'+
               '  <div class="sd-header-top">'+
               '    <button class="sd-back-btn" onclick="glSongDetailBack()">\u2190 Songs</button>'+
               '    <div class="sd-header-meta">'+pills+'</div>'+
               '  </div>'+
               '  <h1 class="sd-title">'+_sdEsc(title)+'</h1>'+
               _dnaBar+
               '  <div id="sd-readiness-strip" class="sd-readiness-strip"></div>'+
               '</div>'+
               '<div id="sd-right-info"></div>'+
               '<div id="sd-right-structure"></div>'+
               '<div id="sd-right-extras"></div>'+
               '<nav class="sd-tab-bar"'+tabBarStyle+'>'+tabs+'</nav>'+
               '<div class="sd-panels">'+panels+'</div>'+
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

    return '<div class="song-detail-page sd-dual-layout">'+
           '<div class="sd-header">'+
           '  <div class="sd-header-top">'+
           '    <button class="sd-back-btn" onclick="glSongDetailBack()">\u2190 Songs</button>'+
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
            // Nothing cached locally AND Firebase returned null/timeout.
            // Could be either "chart doesn't exist" or "network hiccup" — we
            // can't tell. Mark as unresolved so the Play tab shows a retry
            // affordance instead of "No chart yet".
            _chartLoadFailed = true;
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
        '<div class="sd-dna-item"><span class="sd-dna-label">\uD83E\uDD41 BPM</span><input type="number" class="app-input sd-bpm-input" min="40" max="240" placeholder="120" value="'+_sdEsc(metaBpm)+'" onchange="sdUpdateSongBpm(this.value)"></div>'+
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
        // Find top-voted version
        var northStar = null;
        arr.forEach(function(v) {
            var votes = v.votes ? Object.keys(v.votes).filter(function(k) { return v.votes[k]; }).length : 0;
            if (!northStar || votes > (northStar._vc || 0)) northStar = Object.assign({}, v, { _vc: votes });
        });
        if (northStar && northStar.url) {
            step.onclick = function() { openMusicLink(northStar.url); };
            sub.innerHTML = '\u2B50 ' + _sdEsc(northStar.fetchedTitle || northStar.title || 'North Star version');
        }
    } catch(e) {}
}

// Lightweight rehearsal memory: check if latest rehearsal session had notes for this song
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
        var slider=isMe?'<input type="range" min="0" max="5" step="1" value="'+(score!=null&&score!==''?score:0)+'" '+
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
    var _bandAbbr = (typeof allSongs !== 'undefined') ? ((allSongs.find(function(s) { return s.title === title; }) || {}).band || '') : '';
    var _bandFull = (typeof getFullBandName === 'function') ? getFullBandName(_bandAbbr) : _bandAbbr;
    var ugQuery = encodeURIComponent(title + ' ' + _bandFull);
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
    // If a fullscreen wrap from a prior song/render is still pinned to
    // <body>, drop it before rebuilding — otherwise it'd orphan when the
    // new wrap renders into the panel.
    var orphan = document.body.querySelector(':scope > .sd-stems-wrap.sd-stems-fullscreen');
    if (orphan) {
        document.body.classList.remove('sd-stems-overlay-open');
        orphan.remove();
    }
    // New audio elements coming — abandon any prior WebAudio routing. The
    // old MediaElementSource nodes are dangling but the elements themselves
    // are about to be removed from the DOM.
    _sdStemsState = null;
    panel.innerHTML = '<div class="sd-panel-inner"><div style="text-align:center;padding:24px;color:var(--text-dim)">Loading stems…</div></div>';
    var stems = null, lalalSplit = null;
    try {
        if (window.GLStems) {
            // Load both Demucs stems and LALAL lead/backing in parallel —
            // GLAudioSession.mergeTracks fuses them so the lens renders one
            // canonical mixer (LALAL lead/backing replace the Demucs vocals row).
            var both = await Promise.all([
                GLStems.getStems(title).catch(function(){return null;}),
                GLStems.getLeadBackingSplit(title).catch(function(){return null;})
            ]);
            stems = both[0];
            lalalSplit = both[1];
        }
    } catch(e) {}
    if (stems && stems.stems && stems.stems.drums) {
        panel.innerHTML = '<div class="sd-panel-inner">' + _sdRenderStemsPlayer(title, stems, lalalSplit) + '</div>';
        _sdInitStemsPlayer();
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
      '<button onclick="_sdRunStemSeparation(\'' + safeSong + '\')" style="background:rgba(102,126,234,0.18);color:#a5b4fc;border:1px solid rgba(102,126,234,0.35);padding:11px 16px;border-radius:8px;font-weight:700;cursor:pointer;width:100%;margin-bottom:14px">▶ Separate from URL</button>' +
      // ── File upload (alternative — for offline audio) ───────────────────
      '<div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,0.02)">' +
        '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px">Or upload an audio file</label>' +
        '<input type="file" id="sdStemsFile" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac" onchange="_sdRunStemSeparationFromFile(\'' + safeSong + '\', this)" style="width:100%;font-size:0.85em;color:var(--text)">' +
        '<div style="font-size:0.7em;color:var(--text-dim);margin-top:6px">Up to ~50MB. Use this if your audio isn\'t online.</div>' +
      '</div>' +
    '</div>';
}

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
    var reader = new FileReader();
    var model = _sdStemsSelectedModel();
    reader.onload = function() {
        _sdRunStemSeparationFromTake(title, { audioDataUrl: reader.result, sourceLabel: file.name, model: model });
    };
    reader.onerror = function() {
        alert('Failed to read file.');
    };
    reader.readAsDataURL(file);
};

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
                    _sdRunStemSeparationFromTake(title, { audioDataUrl: data.data, sourceLabel: label, model: model });
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

async function _sdRunStemSeparationFromTake(title, opts) {
    var panel = (_sdContainer || document).querySelector('.sd-lens-panel[data-lens="stems"]');
    if (!panel) return;
    var safeSong = title.replace(/'/g,"\\'");
    panel.innerHTML = '<div class="sd-panel-inner"><div style="text-align:center;padding:36px;color:var(--text-dim)">' +
      '<div style="font-size:2em;margin-bottom:10px">🎚</div>' +
      '<div style="font-weight:700;color:var(--text);margin-bottom:6px">Separating stems…</div>' +
      '<div style="font-size:0.82em">Cold start can take 60-120s. Warm runs are ~30s.</div>' +
      '<div style="font-size:0.7em;margin-top:14px;opacity:0.7">Source: ' + _sdEsc(opts.sourceLabel || '—') + ' · don’t close the tab</div>' +
    '</div></div>';
    try {
        await GLStems.separate(title, opts);
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

function _sdRenderStemsPlayer(title, stems, lalalSplit) {
    _sdEnsureStemsFsStyle();
    var safeSong = title.replace(/'/g, "\\'");
    // Single-source-of-truth merged track list. LALAL lead/backing replace
    // Demucs vocals when present — no duplicate vocal rows.
    var tracks = (window.GLAudioSession && GLAudioSession.mergeTracks)
        ? GLAudioSession.mergeTracks(stems, lalalSplit)
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
          '<div class="sd-stem-activity-wrap" data-stem="' + t.id + '" title="Click to seek" style="position:relative;flex:1;min-width:80px;height:22px;cursor:pointer;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.04);border-radius:4px;overflow:hidden">' +
            '<canvas class="sd-stem-activity" style="width:100%;height:100%;display:block"></canvas>' +
            '<div class="sd-stem-playhead" style="position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.7);left:0;pointer-events:none;box-shadow:0 0 4px rgba(255,255,255,0.5)"></div>' +
            '<div class="sd-stem-activity-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.62em;color:var(--text-dim);pointer-events:none">…</div>' +
          '</div>' +
          '<input type="range" min="0" max="100" value="80" class="sd-stem-vol" data-stem="' + t.id + '" style="width:64px;flex-shrink:0;accent-color:' + t.color + '" title="Volume">' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:0;flex-shrink:0" title="Pan (L ↔ R)">' +
            '<input type="range" min="-100" max="100" value="0" class="sd-stem-pan" data-stem="' + t.id + '" style="width:48px;accent-color:' + t.color + '">' +
            '<span class="sd-stem-pan-val" data-stem="' + t.id + '" style="font-size:0.58em;color:var(--text-dim);font-variant-numeric:tabular-nums;line-height:1">C</span>' +
          '</div>' +
          '<button class="sd-stem-mute" data-stem="' + t.id + '" title="Mute" style="padding:4px 7px;border-radius:5px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.66em;font-weight:700">M</button>' +
          '<button class="sd-stem-solo" data-stem="' + t.id + '" title="Solo" style="padding:4px 7px;border-radius:5px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.66em;font-weight:700">S</button>' +
          '<a class="sd-stem-dl" href="' + _sdEsc(t.rawUrl) + '" download="' + _sdEsc(dlName) + '" target="_blank" rel="noopener" title="Download FLAC" style="padding:4px 6px;border-radius:5px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text-dim);text-decoration:none;font-size:0.76em;line-height:1">⬇</a>' +
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
    var fxRow = '<div style="display:flex;align-items:center;gap:10px;margin:0 0 10px;padding:8px 10px;border:1px dashed var(--border);border-radius:10px;flex-wrap:wrap;font-size:0.78em;color:var(--text-dim)">' +
        '<span style="font-weight:700;color:var(--text-muted)">Speed</span>' +
        '<input id="sdStemsTempo" type="range" min="50" max="150" step="1" value="100" style="flex:1;min-width:120px">' +
        '<span id="sdStemsTempoVal" style="font-variant-numeric:tabular-nums;min-width:42px;text-align:right">1.00×</span>' +
        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input id="sdStemsPreservePitch" type="checkbox" checked> Preserve pitch</label>' +
        '<span style="width:1px;height:18px;background:var(--border);margin:0 4px"></span>' +
        '<span style="font-weight:700;color:var(--text-muted)">Key</span>' +
        '<button class="sd-stems-pitch" data-delta="-1" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-weight:700">−1</button>' +
        '<span id="sdStemsPitchVal" style="font-variant-numeric:tabular-nums;min-width:36px;text-align:center;font-weight:700;color:var(--text)">0</span>' +
        '<button class="sd-stems-pitch" data-delta="1" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-weight:700">+1</button>' +
        '<button id="sdStemsPitchReset" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.85em">reset</button>' +
    '</div>';
    var badge = hasLalal
        ? '<span class="sd-title-badge">Demucs + LALAL</span>'
        : '<span class="sd-title-badge">Demucs</span>';
    return '<div class="sd-stems-wrap">' +
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
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap">' +
        '<button id="sdStemsPlay" onclick="_sdStemsToggle()" title="Play/Pause (Space)" style="background:rgba(102,126,234,0.18);color:#a5b4fc;border:1px solid rgba(102,126,234,0.35);padding:9px 14px;border-radius:8px;font-weight:700;cursor:pointer;min-width:84px">▶ Play</button>' +
        '<button onclick="_sdStemsSeekBy(-30)" title="Back 30s (Shift+←)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">⏪ 30</button>' +
        '<button onclick="_sdStemsSeekBy(-10)" title="Back 10s (←)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">⏪ 10</button>' +
        '<button onclick="_sdStemsSeekBy(10)" title="Forward 10s (→)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">10 ⏩</button>' +
        '<button onclick="_sdStemsSeekBy(30)" title="Forward 30s (Shift+→)" style="padding:8px 9px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.74em;font-weight:700;font-variant-numeric:tabular-nums">30 ⏩</button>' +
        '<input id="sdStemsScrub" type="range" min="0" max="1000" value="0" style="flex:1;min-width:120px;margin-left:4px">' +
        '<span id="sdStemsTime" style="font-size:0.78em;color:var(--text-dim);font-variant-numeric:tabular-nums;min-width:80px;text-align:right">0:00 / 0:00</span>' +
      '</div>' +
      fxRow +
      rows +
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
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:0.7em;color:var(--text-dim);gap:10px;flex-wrap:wrap">' +
        '<span>Separated ' + (when || '—') + (stems.elapsedSec ? ' · ' + Math.round(stems.elapsedSec) + 's' : '') + (stems.sourceLabel ? ' · from ' + _sdEsc(stems.sourceLabel) : '') + '</span>' +
        '<button onclick="_sdStemsRedo(\'' + safeSong + '\')" style="background:none;border:1px solid var(--border);color:var(--text-dim);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.78em">Re-separate</button>' +
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
      'body.sd-stems-overlay-open{overflow:hidden}';
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
    // Repaint activity strips at the new width (cached bins, no re-decode).
    setTimeout(function() {
        try { window.dispatchEvent(new Event('resize')); } catch(e) {}
    }, 50);
};

window._sdStemsToggle = function() {
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
        var t = audios[0].currentTime || 0;
        audios.forEach(function(a){
            try { a.currentTime = t; } catch(e) {}
            a.play().catch(function(){});
        });
        if (btn) btn.textContent = '⏸ Pause';
    }
};

window._sdStemsRedo = async function(title) {
    if (!confirm('Replace these stems with a new separation?')) return;
    if (window.GLStems) await GLStems.clearStems(title);
    _sdLensPopulated.stems = false;
    _sdPopulateStemsLens(title);
};

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
        var fs = document.querySelector('.sd-stems-wrap.sd-stems-fullscreen');
        if (fs) { e.preventDefault(); window._sdStemsToggleFullscreen(); }
        return;
    }
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
            btn.style.background = muted ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.18)';
            btn.style.color = muted ? 'var(--text-dim)' : '#fca5a5';
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
                var on = (soloed === b.dataset.stem);
                b.style.background = on ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)';
                b.style.color = on ? '#fbbf24' : 'var(--text-dim)';
            });
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
        wrap.addEventListener('click', function(e) {
            if (!master.duration) return;
            var rect = wrap.getBoundingClientRect();
            var frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            window._sdStemsApplySeek(frac * master.duration);
        });
    });
    // Repaint activity canvases on resize (e.g. entering/exiting fullscreen)
    // so the bins re-stretch to the new pixel width without re-decoding.
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
    };
    window.addEventListener('resize', repaintActivity);

    // ── Time sync / scrub / play-end ────────────────────────────────────────
    master.addEventListener('timeupdate', function() {
        if (!master.duration) return;
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
}

window._sdPopulateListenLensPublic = function(title) { _sdPopulateListenLens(title); };
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
        refs.forEach(function(v){
            var votes=v.votes?Object.keys(v.votes).filter(function(k){return v.votes[k];}).length:0;
            if(!northStar||votes>(northStar._voteCount||0)) northStar=Object.assign({},v,{_voteCount:votes});
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

    panel.innerHTML=
        '<div class="sd-panel-inner">'+
        '<div class="sd-card"><div class="sd-card-title">🔍 Find a Version</div>'+
        '<div style="font-size:0.85em;color:var(--text-muted);margin-bottom:12px">Search Archive.org, Relisten, Phish.in, YouTube and more.</div>'+
        '<button class="btn btn-primary" onclick="launchVersionHub()" style="width:100%;padding:13px;font-size:0.95em;background:linear-gradient(135deg,#667eea,#764ba2)">🔍 Open Version Hub</button></div>'+
        '<div class="sd-card"><div class="sd-card-title">⭐ North Star <span class="sd-title-badge">Reference</span></div>'+nsHTML+'</div>'+
        '<div class="sd-card"><div class="sd-card-title">🏆 Best Shot <span class="sd-title-badge sd-title-badge--gold">Our Recording</span></div>'+bsHTML+'</div>'+
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

    // ── ALWAYS VISIBLE: Band Love + Audience Love (primary position — above fold) ──
    // Key/BPM/Lead/Status editing is in the header DNA bar only — not rendered here
    infoEl.innerHTML = '<div style="padding:8px 12px" id="sd-love-card">'
        + _sdRenderBandLove(title, safeSong)
        + _sdRenderAudienceLove(title, safeSong)
        + '</div>';

    // ── ALWAYS VISIBLE: Readiness (full card) ──
    var songScores = (typeof GLStore !== 'undefined' && GLStore.getReadiness) ? (GLStore.getReadiness(title) || {}) : {};
    var rpMembers = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var readinessHtml = '<div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,0.04)">'
        + '<div style="font-size:0.68em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:6px">Readiness</div>'
        + '<div style="display:flex;flex-direction:column;gap:4px">';
    rpMembers.forEach(function(m) {
        var key = m.key || m, name = m.name || (key.charAt(0).toUpperCase() + key.slice(1));
        var score = songScores[key];
        var color = score ? (score >= 4 ? '#10b981' : score >= 3 ? '#f59e0b' : '#ef4444') : '#475569';
        var barPct = score ? (score / 5 * 100) : 0;
        readinessHtml += '<div style="display:flex;align-items:center;gap:8px;font-size:0.78em">'
            + '<span style="color:var(--text-dim);min-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _sdEsc(name) + '</span>'
            + '<div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden"><div style="width:' + barPct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>'
            + '<span style="color:' + color + ';font-weight:700;min-width:16px;text-align:right">' + (score || '\u2014') + '</span>'
            + '</div>';
    });
    readinessHtml += '</div></div>';

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

    // ── COLLAPSIBLE: Discussion + Prospect Voting ──
    var extrasHtml = '<details class="sd-details" style="border-top:1px solid rgba(255,255,255,0.04)">'
        + '<summary style="padding:8px 12px;font-size:0.68em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between">'
        + '\uD83D\uDCCB Discussion <span style="font-size:0.9em;opacity:0.5">\u25B6</span></summary>'
        + '<div style="padding:4px 12px 10px">'
        + '<div id="sd-rp-discussion"><div style="font-size:0.78em;color:var(--text-dim)">Loading...</div></div>'
        + '<div id="sd-rp-prospect-vote"></div>'
        + '</div></details>';

    if (extrasEl) {
        extrasEl.innerHTML = readinessHtml + extrasHtml;
        // Load discussion into right panel
        setTimeout(function() {
            var discMount = document.getElementById('sd-rp-discussion');
            if (discMount && typeof renderSongDiscussion === 'function') renderSongDiscussion(title, discMount);
            // Prospect voting (conditional — only shows for prospect status)
            var voteMount = document.getElementById('sd-rp-prospect-vote');
            if (voteMount && status === 'prospect') {
                _sdRenderProspectVote(title);
            }
        }, 300);
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
