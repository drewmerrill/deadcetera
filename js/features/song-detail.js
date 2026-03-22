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
    { id:'band',    icon:'🎸', label:'Band'    },
    { id:'listen',  icon:'📻', label:'Listen'  },
    { id:'learn',   icon:'📖', label:'Learn'   },
    { id:'sing',    icon:'🎤', label:'Sing'    },
    { id:'inspire', icon:'✨', label:'Inspire' },
];

// Mode-specific lens sets — Play strips to just what's needed on stage
var SD_LENSES_BY_MODE = {
    sharpen: [
        { id:'band',   icon:'🎸', label:'Overview' },
        { id:'learn',  icon:'📖', label:'Learn'    },
        { id:'listen', icon:'📻', label:'Listen'   },
    ],
    lockin: [
        { id:'band',    icon:'🎸', label:'Band'    },
        { id:'listen',  icon:'📻', label:'Listen'  },
        { id:'learn',   icon:'📖', label:'Learn'   },
        { id:'sing',    icon:'🎤', label:'Sing'    },
    ],
    play: [
        { id:'band',   icon:'📊', label:'Chart'   },
    ],
};

function _sdGetMode() {
    return (typeof GLStore !== 'undefined' && GLStore.getProductMode) ? GLStore.getProductMode() : 'lockin';
}

var SD_LENSES = SD_LENSES_FULL; // backward compat

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
    container.innerHTML = _sdShellHTML(title);
    _sdInjectStyles();
    _sdActivateTab('band');
    _sdPopulateBandLens(title);
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
        if (lens==='inspire') _sdPopulateInspireLens(_sdCurrentSong);
    }
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

// ── Shell HTML ────────────────────────────────────────────────────────────────
function _sdShellHTML(title) {
    var song = (typeof allSongs!=='undefined') ? allSongs.find(function(s){return s.title===title;}) : null;
    var band=song?(song.band||''):'', key=song?(song.key||''):'', bpm=song?(song.bpm||''):'';
    var mode = _sdGetMode();
    var lenses = SD_LENSES_BY_MODE[mode] || SD_LENSES_FULL;
    var pills = (band?'<span class="sd-meta-pill sd-band-pill '+band.toLowerCase()+'">'+_sdEsc(band)+'</span>':'');
    // Key/BPM pills for quick reference (always shown, prominent in Play)
    if (key) pills += '<span class="sd-meta-pill" style="background:rgba(129,140,248,0.12);color:#818cf8;border-color:rgba(129,140,248,0.2)">'+_sdEsc(key)+'</span>';
    if (bpm) pills += '<span class="sd-meta-pill" style="color:var(--text-dim)">'+_sdEsc(bpm)+' BPM</span>';

    var tabs = lenses.map(function(l) {
        return '<button class="sd-tab-btn" data-lens="'+l.id+'" onclick="switchLens(\''+l.id+'\')">'+
               '<span class="sd-tab-icon">'+l.icon+'</span>'+
               '<span class="sd-tab-label">'+l.label+'</span></button>';
    }).join('');
    // Always create all lens panels (even if tab hidden) for backward compat
    var panels = SD_LENSES_FULL.map(function(l) {
        return '<div class="sd-lens-panel" data-lens="'+l.id+'" style="display:none">'+_sdSkeleton()+'</div>';
    }).join('');

    // Play mode: hide tab bar entirely (single-lens mode)
    var tabBarStyle = (mode === 'play') ? ' style="display:none"' : '';

    // Mode-specific dominant action
    var safeSong = _sdEsc(title).replace(/'/g,"\\'");
    var action = '';
    if (mode === 'sharpen') {
        action = '<button class="sd-mobile-bar__btn sd-mobile-bar__btn--primary" onclick="openRehearsalMode(\''+safeSong+'\')" >🔥 Start Practice</button>';
    } else if (mode === 'lockin') {
        action = '<button class="sd-mobile-bar__btn" onclick="var el=document.querySelector(\'#sd-readiness-card\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'center\'})">📊 Update Readiness</button>'
               + '<button class="sd-mobile-bar__btn sd-mobile-bar__btn--primary" onclick="openRehearsalMode(\''+safeSong+'\')" >📖 Practice</button>';
    } else {
        action = '<button class="sd-mobile-bar__btn sd-mobile-bar__btn--primary" onclick="openRehearsalMode(\''+safeSong+'\')" >📖 Open Chart</button>';
    }

    return '<div class="song-detail-page">'+
           '<div class="sd-header">'+
           '  <div class="sd-header-top">'+
           '    <button class="sd-back-btn" onclick="glSongDetailBack()">← Songs</button>'+
           '    <div class="sd-header-meta">'+pills+'</div>'+
           '  </div>'+
           '  <h1 class="sd-title">'+_sdEsc(title)+'</h1>'+
           '  <div id="sd-readiness-strip" class="sd-readiness-strip"></div>'+
           '</div>'+
           '<nav class="sd-tab-bar"'+tabBarStyle+'>'+tabs+'</nav>'+
           '<div class="sd-panels">'+panels+'</div>'+
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

// ── Band Lens ─────────────────────────────────────────────────────────────────
async function _sdPopulateBandLens(title) {
    var panel = (_sdContainer||document).querySelector('.sd-lens-panel[data-lens="band"]');
    if (!panel) return;
    panel.style.display = 'block';
    _sdBuildReadinessStrip(title);
    var mode = _sdGetMode();

    var songKey = typeof sanitizeFirebasePath==='function' ? sanitizeFirebasePath(title) : title;
    var safeSong = title.replace(/'/g,"\\'");
    var lead='', status='', cribData=null, rehearsalNotes=null, sectionRatings={}, songMeta={}, chartText=null;

    try {
        var res = await Promise.all([
            loadBandDataFromDrive(title,'lead_singer').catch(function(){return null;}),
            loadBandDataFromDrive(title,'song_status').catch(function(){return null;}),
            _sdGet('songs/'+songKey+'/metadata'),
            loadBandDataFromDrive(title,'personal_tabs').catch(function(){return null;}),
            loadBandDataFromDrive(title,'rehearsal_notes').catch(function(){return null;}),
            _sdGet('songs/'+songKey+'/section_ratings'),
            loadBandDataFromDrive(title,'chart').catch(function(){return null;}),
            loadBandDataFromDrive(title,'key').catch(function(){return null;}),
            loadBandDataFromDrive(title,'song_bpm').catch(function(){return null;}),
        ]);
        // lead_singer stored as { singer: 'drew' }, song_status as { status: 'gig_ready', ... }
        lead   = (res[0] && res[0].singer) ? res[0].singer : (typeof res[0]==='string' ? res[0] : '');
        // Status: prefer statusCache (master file, migrated) over per-song Firebase
        // to avoid stale legacy values. Fall back to Firebase if cache is empty.
        var _fbStatus = (res[1] && res[1].status) ? res[1].status : (typeof res[1]==='string' ? res[1] : '');
        var _cacheStatus = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? (GLStore.getStatus(title) || '') : ((typeof statusCache !== 'undefined' && statusCache[title]) ? statusCache[title] : '');
        status = _cacheStatus || _fbStatus;
        songMeta=res[2]||{};
        cribData=res[3]; rehearsalNotes=res[4]; sectionRatings=res[5]||{};
        chartText=(res[6] && res[6].text && res[6].text.trim()) ? res[6].text : null;
        var firebaseKey = res[7] ? (res[7].key || (typeof res[7]==='string' ? res[7] : '')) : '';
        var firebaseBpm = res[8] ? (res[8].bpm ? String(res[8].bpm) : '') : '';
    } catch(e) {}

    var songObj=(typeof allSongs!=='undefined')?allSongs.find(function(s){return s.title===title;}):null;
    var metaKey=firebaseKey||(songObj&&songObj.key?songObj.key:'')||(songMeta.key?songMeta.key:'')||'';
    var metaBpm=firebaseBpm||(songObj&&songObj.bpm?String(songObj.bpm):'')||(songMeta.bpm?String(songMeta.bpm):'')||'';

    var leadOpts=['','drew','chris','brian','pierce','drew,chris','shared','rotating'].map(function(v){
        var lbl=v===''?'Select…':v==='drew,chris'?'Drew & Chris':v==='shared'?'Shared':v==='rotating'?'Rotating':v.charAt(0).toUpperCase()+v.slice(1);
        return '<option value="'+v+'"'+(lead===v?' selected':'')+'>'+lbl+'</option>';
    }).join('');
    var statusOpts=[['','— Select —'],['prospect','👀 Prospect (Active)'],['learning','📖 Learning (Active)'],['rotation','🔄 In Rotation (Active)'],['shelved','📦 Shelved (Library)']].map(function(p){
        return '<option value="'+p[0]+'"'+(status===p[0]?' selected':'')+'>'+p[1]+'</option>';
    }).join('');
    var keyOpts=['','A','Am','Bb','Bbm','B','Bm','C','Cm','C#','C#m','D','Dm','D#m','E','Em','F','Fm','F#','F#m','G','Gm','G#m','Ab','Abm'].map(function(k){
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
    if (mode === 'play') {
        // Build prev/next navigation from cached setlist
        var _playNav = _sdBuildPlayNav(title);
        panel.innerHTML =
            '<div class="sd-panel-inner">'+
            // Now Playing indicator + set navigation
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px 12px">'+
            (_playNav.prev ? '<button class="sd-pm-btn" style="font-size:0.78em;padding:5px 12px" onclick="renderSongDetail(\''+_sdEsc(_playNav.prev).replace(/'/g,"\\'")+'\')">← '+_sdEsc(_playNav.prev)+'</button>' : '<div></div>')+
            '<div style="text-align:center;font-size:0.72em;color:var(--text-dim);font-weight:700;letter-spacing:0.05em">NOW PLAYING</div>'+
            (_playNav.next ? '<button class="sd-pm-btn" style="font-size:0.78em;padding:5px 12px" onclick="renderSongDetail(\''+_sdEsc(_playNav.next).replace(/'/g,"\\'")+'\')">'+_sdEsc(_playNav.next)+' →</button>' : '<div></div>')+
            '</div>'+
            // Clean chart — full width, large text, premium feel
            (chartText
                ? '<div class="sd-card" style="padding:24px;border-color:rgba(99,102,241,0.12)"><pre style="white-space:pre-wrap;font-family:\'Courier New\',monospace;font-size:15px;line-height:1.8;color:#e2e8f0;margin:0;letter-spacing:0.02em">' + _sdEsc(chartText) + '</pre></div>'
                : '<div class="sd-card" style="text-align:center;padding:32px;color:var(--text-dim)"><div style="font-size:1.6em;margin-bottom:10px">📖</div><div style="font-size:0.95em;margin-bottom:12px">No chart yet</div><button class="sd-pm-btn" onclick="sdShowGetChartModal(\''+safeSong+'\')">Get Chart</button></div>'
            ) +
            // Crib notes
            (cribData && toArray(cribData).length
                ? '<div class="sd-card" style="padding:16px"><div class="sd-card-title" style="margin-bottom:8px">📋 Stage Notes</div>' + _sdRenderCribNotes(cribData) + '</div>'
                : ''
            ) +
            '</div>';
        _sdBuildReadinessStrip(title);
        return;
    }

    // ── SHARPEN MODE: guided practice workflow ──
    if (mode === 'sharpen') {
        panel.innerHTML =
            '<div class="sd-panel-inner">'+
            // Practice workflow — 3-step guided flow
            '<div class="sd-card" style="border-color:rgba(99,102,241,0.15)">'+
            '<div class="sd-card-title" style="margin-bottom:4px">\uD83D\uDD25 Practice This Song</div>'+
            '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:14px;font-style:italic">Focus on what will make you better today</div>'+
            '<div style="display:flex;flex-direction:column;gap:10px">'+
            // Step 1: Listen
            '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;cursor:pointer" onclick="window.open(\'https://www.youtube.com/results?search_query='+ytQuery+'\',\'_blank\')">'+
            '<div style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;font-size:0.82em;font-weight:800;color:#818cf8;flex-shrink:0">1</div>'+
            '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.88em;color:var(--text)">Listen</div><div style="font-size:0.75em;color:var(--text-dim)">Hear the reference version</div></div>'+
            '<span style="color:var(--text-dim);font-size:0.85em">▶</span>'+
            '</div>'+
            // Step 2: Play
            '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.15);border-radius:10px;cursor:pointer" onclick="openRehearsalMode(\''+safeSong+'\')">'+
            '<div style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:0.82em;font-weight:800;color:#a5b4fc;flex-shrink:0">2</div>'+
            '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.88em;color:var(--text)">Play Along</div><div style="font-size:0.75em;color:var(--text-dim)">Open chart and practice</div></div>'+
            '<span style="color:var(--accent-light);font-size:0.85em">→</span>'+
            '</div>'+
            // Step 3: Rate
            '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;cursor:pointer" onclick="var el=document.querySelector(\'#sd-readiness-card\');if(el)el.scrollIntoView({behavior:\'smooth\',block:\'center\'})">'+
            '<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:0.82em;font-weight:800;color:var(--text-muted);flex-shrink:0">3</div>'+
            '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:0.88em;color:var(--text)">Rate Yourself</div><div style="font-size:0.75em;color:var(--text-dim)">Track your progress</div></div>'+
            '<span style="color:var(--text-dim);font-size:0.85em">↓</span>'+
            '</div>'+
            '</div></div>'+
            // Readiness
            '<div class="sd-card" id="sd-readiness-card">'+
            '<div class="sd-card-title">📊 Your Readiness</div>'+
            _sdRenderReadinessBlock(title,safeSong)+
            '</div>'+
            // Song Info
            '<div class="sd-card" style="padding:10px 14px">'+
            '<div class="sd-card-title" style="margin-bottom:8px">\uD83E\uDDEC Song Info</div>'+
            '<div style="display:flex;gap:16px;font-size:0.88em;color:var(--text-muted)">'+
            (metaKey?'<span>\uD83D\uDD11 '+_sdEsc(metaKey)+'</span>':'')+
            (metaBpm?'<span>\uD83E\uDD41 '+_sdEsc(metaBpm)+' BPM</span>':'')+
            (lead?'<span>\uD83C\uDFA4 '+_sdEsc(lead.charAt(0).toUpperCase()+lead.slice(1))+'</span>':'')+
            '</div></div>'+
            // How We Play It
            '<div class="sd-card" style="padding:10px 14px">' +
            '<div class="sd-card-title" style="margin-bottom:0">\uD83C\uDFBC How We Play It</div>' +
            '<div id="sd-structure" style="font-size:0.82em;color:var(--text-dim);margin-top:6px">Loading...</div>' +
            '</div>' +
            '</div>';
        _sdBuildReadinessStrip(title);
        setTimeout(function() { _sdLoadStructure(title); }, 300);
        return;
    }

    // ── LOCK IN MODE: focus-first with collapsible detail ──
    // Top 3 Focus card + collapsed remaining cards
    var _focusItems = _sdBuildFocusItems(title, avgReadiness, _siGaps, _siIntel, _siLowest, status);

    panel.innerHTML =
        '<div class="sd-panel-inner">'+
        // ── TOP 3 FOCUS — the single most important card ──
        '<div class="sd-card" style="border-color:rgba(245,158,11,0.2);background:linear-gradient(135deg,rgba(245,158,11,0.04),rgba(239,68,68,0.03))">'+
        '<div class="sd-card-title" style="color:#fbbf24">\uD83C\uDFAF Focus for Rehearsal</div>'+
        (_focusItems.length ? _focusItems.map(function(f) {
            return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'+
                '<span style="font-size:1em;flex-shrink:0;margin-top:1px">'+f.icon+'</span>'+
                '<div><div style="font-weight:600;font-size:0.88em;color:var(--text)">'+_sdEsc(f.title)+'</div>'+
                '<div style="font-size:0.78em;color:var(--text-dim);margin-top:2px">'+_sdEsc(f.detail)+'</div></div></div>';
        }).join('') : '<div style="font-size:0.85em;color:var(--text-dim);padding:4px">Looking good — no critical gaps found.</div>') +
        '<div style="margin-top:12px;display:flex;gap:8px">'+
        '<button class="sd-pm-btn" onclick="openRehearsalMode(\''+safeSong+'\')">📖 Practice Now</button>'+
        '</div></div>'+
        // ── Readiness ──
        '<div class="sd-card" id="sd-readiness-card">'+
        '<div class="sd-card-title">📊 Band Readiness</div>'+
        _sdRenderReadinessBlock(title,safeSong)+
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
        (chartText?'<div class="sd-card"><div class="sd-card-title">\uD83E\uDDE0 Practice Mode</div><pre style="white-space:pre-wrap;font-family:monospace;font-size:11px;color:#64748b;line-height:1.4;max-height:72px;overflow:hidden;margin:0 0 10px">'+_sdEsc(chartText.split('\n').slice(0,4).join('\n'))+'</pre><button class="sd-pm-btn" onclick="openRehearsalMode(\''+safeSong+'\')">📖 View Chart</button></div>':'')+
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
    // 1. Low readiness
    if (avgReadiness > 0 && avgReadiness < 3) {
        items.push({ icon: '⚠️', title: 'Low band readiness (' + avgReadiness.toFixed(1) + '/5)', detail: 'This song needs more practice before it\'s gig-ready.' });
    }
    // 2. Member gap
    if (lowestMembers && lowestMembers.length > 0 && intel && intel.min > 0 && intel.min < 3) {
        var memberNames = lowestMembers.map(function(k) { return (typeof bandMembers !== 'undefined' && bandMembers[k]) ? bandMembers[k].name : k; });
        items.push({ icon: '👤', title: memberNames.join(', ') + ' at ' + intel.min + '/5', detail: 'Weakest link — focus rehearsal time here.' });
    }
    // 3. High-severity gaps
    if (gaps && gaps.length > 0) {
        var highGaps = gaps.filter(function(g) { return g.severity === 'high'; });
        if (highGaps.length > 0) {
            items.push({ icon: '🔧', title: highGaps[0].detail || 'Gap detected', detail: highGaps.length > 1 ? '+' + (highGaps.length - 1) + ' more issues' : 'Address this before next gig.' });
        }
    }
    // 4. No readiness data at all
    if (!avgReadiness || avgReadiness === 0) {
        items.push({ icon: '📊', title: 'No readiness scores yet', detail: 'Have each band member rate this song.' });
    }
    // 5. Status is prospect (not committed)
    if (status === 'prospect' || status === '') {
        items.push({ icon: '🗳', title: 'Song not committed', detail: 'Vote on whether to add this to the rotation.' });
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
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    var scores = rc[title] || {};
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
    var rc=(typeof GLStore!=='undefined')?GLStore.getAllReadiness():(typeof readinessCache!=='undefined'?readinessCache:{});
    var members=(typeof BAND_MEMBERS_ORDERED!=='undefined')?BAND_MEMBERS_ORDERED:[];
    var songScores=rc[title]||{};
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
    var rc=(typeof GLStore!=='undefined')?GLStore.getAllReadiness():(typeof readinessCache!=='undefined'?readinessCache:{});
    var members=(typeof BAND_MEMBERS_ORDERED!=='undefined')?BAND_MEMBERS_ORDERED:[];
    var songScores=rc[title]||{};
    var pills=members.map(function(m){
        var key=m.key||m, name=m.name||(key.charAt(0).toUpperCase()+key.slice(1));
        var score=songScores[key];
        var color=score?(score>=4?'#10b981':score>=3?'#f59e0b':'#ef4444'):'rgba(255,255,255,0.1)';
        return '<span class="sd-readiness-pill" style="background:'+color+'" title="'+_sdEsc(name)+'">'+
               (function(n){var p=n.trim().split(/\s+/);return p.length>1?p[0].charAt(0)+p[p.length-1].charAt(0):p[0].charAt(0);})(name)+':'+(score||'—')+'</span>';
    }).join('');
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
};
window.sdUpdateSongStatus = function(v) {
    if (!_sdCurrentSong) return;
    if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
        GLStore.updateSongField(_sdCurrentSong, 'status', v);
    } else if (typeof saveBandDataToDrive === 'function') {
        saveBandDataToDrive(_sdCurrentSong, 'song_status', { status: v, updatedAt: new Date().toISOString() });
    }
    // Additional status-specific cache sync (GLStore.updateSongField handles statusCache for us,
    // but master file persist needs explicit call)
    if (typeof statusCache !== 'undefined') statusCache[_sdCurrentSong] = v;
    if (typeof statusCache !== 'undefined' && typeof saveMasterFile === 'function') {
        saveMasterFile('_master_song_statuses.json', statusCache).catch(function(){});
    }
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
    if (typeof showToast === 'function') showToast('Structure saved');
    _sdLoadStructure(title);
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

window.sdSaveReadiness = function(songTitle, memberKey, val) {
    if (typeof GLStore === 'undefined') { console.warn('[song-detail] GLStore not available'); return; }
    GLStore.saveReadiness(songTitle, memberKey, val).then(function() {
        _sdBuildReadinessStrip(songTitle);
    });
};

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

    var nsHTML=northStar
        ?('<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px">'+
          '<span style="font-size:1.4em">⭐</span><div style="flex:1;min-width:0">'+
          '<div style="font-size:0.85em;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_sdEsc(northStar.fetchedTitle||northStar.title||'Reference')+'</div>'+
          '<div style="font-size:0.72em;color:var(--text-dim)">'+(northStar._voteCount||0)+' votes</div></div>'+
          (northStar.url?'<button class="btn btn-sm" onclick="window.open(\''+northStar.url.replace(/'/g,"\\'")+'\',\'_blank\')" style="background:rgba(102,126,234,0.2);color:#818cf8;border:1px solid rgba(102,126,234,0.3);font-size:0.78em;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap">▶ Listen</button>':'')+
          '</div>')
        :'<div style="color:var(--text-dim);font-size:0.85em">No North Star set yet — open Version Hub to browse and vote.</div>';

    var bsHTML=bestShot
        ?('<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px">'+
          '<span style="font-size:1.4em">🏆</span><div style="flex:1;min-width:0">'+
          '<div style="font-size:0.85em;font-weight:700;color:var(--text)">'+_sdEsc(bestShot.label||'Best Take')+(bestShot.crowned?' 👑':'')+'</div>'+
          '<div style="font-size:0.72em;color:var(--text-dim)">'+_sdEsc(bestShot.uploadedByName||'')+'</div></div>'+
          (bestShot.audioUrl?'<audio controls src="'+_sdEsc(bestShot.audioUrl)+'" style="height:32px;max-width:140px"></audio>':
           bestShot.externalUrl?'<button class="btn btn-sm" onclick="window.open(\''+bestShot.externalUrl.replace(/'/g,"\\'")+'\',\'_blank\')" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.78em;padding:6px 12px;border-radius:8px;cursor:pointer">▶ Listen</button>':'')+
          '</div>')
        :'<div style="color:var(--text-dim);font-size:0.85em">No recording yet — upload a take from the Songs page.</div>';

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

    panel.innerHTML=
        '<div class="sd-panel-inner">'+
        lessonsHtml+
        '<div class="sd-card"><div class="sd-card-title">🎧 Practice Tracks</div>'+
            _sdLinkList(tracks,'🎧','')+
            ((!tracks||!tracks.length)?_sdEmptyAdd('No practice tracks yet','_sdAddTrackForm',''+safeSong+''):'')+
            '<div id="sd-learn-track-form"></div>'+
        '</div>'+
        '<div class="sd-card"><div class="sd-card-title">📄 Tabs &amp; Charts</div>'+
            _sdLinkList(tabs,'📄','')+
            ((!tabs||!tabs.length)?_sdEmptyAdd('No tabs or charts yet','_sdAddTabForm',''+safeSong+''):'')+
            '<div id="sd-learn-tab-form"></div>'+
        '</div>'+
        '<div class="sd-card"><div class="sd-card-title">🎵 Cover Versions to Study</div>'+
            _sdLinkList(covers,'🎵','')+
            ((!covers||!covers.length)?_sdEmptyAdd('No cover versions yet','_sdAddCoverForm',''+safeSong+''):'')+
            '<div id="sd-learn-cover-form"></div>'+
        '</div>'+
        '</div>';
}

function _sdEmptyAdd(msg, fn, safeSong) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">'
        + '<span style="color:var(--text-dim,#475569);font-size:0.85em">' + msg + '</span>'
        + '<button onclick="' + fn + '(\'' + safeSong + '\')" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#818cf8;font-size:0.75em;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;white-space:nowrap">+ Add</button>'
        + '</div>';
}

// Remove a per-user lesson (bridge to Practice Mode lessons)
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
    } else {
        panel.innerHTML='<div class="sd-panel-inner"><div class="sd-card sd-coming-soon"><div class="sd-cs-icon">🎤</div><div class="sd-cs-title">Harmony Lab</div><div class="sd-cs-desc">Loading…</div></div></div>';
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
function _sdInjectStyles(){
    if((_sdContainer||document).querySelector('#sd-styles')) return;
    var s=document.createElement('style');
    s.id='sd-styles';
    s.textContent='.song-detail-page{max-width:800px;margin:0 auto;padding:0 0 80px;opacity:0;transform:translateY(12px);transition:opacity 0.25s ease,transform 0.25s ease}'+
    '.sd-entered .song-detail-page{opacity:1;transform:none}'+
    '.sd-header{padding:14px 16px 0;background:var(--bg-card,#1e293b);border-bottom:1px solid var(--border,rgba(255,255,255,0.08));position:sticky;top:0;z-index:50;backdrop-filter:blur(12px);border-radius:12px 12px 0 0}'+
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
    '.sd-notes-sub{font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim,#475569);margin-bottom:8px}'+
    '.sd-mobile-bar{display:none;position:fixed;bottom:0;left:0;right:0;padding:8px 16px;background:var(--bg-card,#1e293b);border-top:1px solid var(--border,rgba(255,255,255,0.08));z-index:60;gap:8px;justify-content:center}'+
    '.sd-mobile-bar__btn{flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text,#f1f5f9);font-size:0.82em;font-weight:700;cursor:pointer;text-align:center}'+
    '.sd-mobile-bar__btn--primary{background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.3);color:#a5b4fc}'+
    '@media(max-width:768px){.sd-mobile-bar{display:flex}.song-detail-page{padding-bottom:120px}}';
    document.head.appendChild(s);
}

console.log('✅ song-detail.js loaded (Phase 2 — direct Firebase, no DOM mirroring)');
