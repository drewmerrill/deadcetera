// ─────────────────────────────────────────────────────────────────────────────
// practice.js — Personal Practice (Woodshed) + Practice Mixes
//
// Tabs:
//   Focus  — This Week / Needs Polish / Gig Ready / weak songs / readiness
//   Mixes  — practiceMixes CRUD, shareSlug, band sharing
//
// Firebase schema:
//   bandPath('practice_mixes/{mixId}') → { id, title, type, songIds[], createdBy,
//     createdAt, shareSlug, isShared }
//
// EXPOSES: renderPracticePage, loadSongStatusMap
// DEPENDS ON: allSongs, readinessCache, loadBandDataFromDrive,
//             saveBandDataToDrive, bandPath, firebaseDB, showToast,
//             toArray, getCurrentMemberReadinessKey, sanitizeFirebasePath
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

// ── Module state ──────────────────────────────────────────────────────────────
var _pmTab         = 'focus';      // 'focus' | 'mixes'
var _pmMixes       = [];           // loaded mix objects
var _pmEditingMix  = null;         // mix object being edited/created (null = none)
var _pmMixSongs    = [];           // working song list for editor

var MIX_TYPES = [
    { id:'practice',   emoji:'🎯', label:'Practice'       },
    { id:'rehearsal',  emoji:'🎸', label:'Rehearsal Prep'  },
    { id:'gig',        emoji:'🎤', label:'Gig Prep'        },
    { id:'weak',       emoji:'⚠️', label:'Weak Songs'      },
];

// ── Page entry point ──────────────────────────────────────────────────────────
async function renderPracticePage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'practice');

    el.innerHTML =
        '<div class="page-header">' +
        '  <h1>🎯 Practice</h1>' +
        '  <p>Woodshed and your practice mixes</p>' +
        '</div>' +
        '<div class="pm-tab-strip">' +
        '  <button id="pm-tab-focus" class="pm-tab pm-tab--active" onclick="pmSwitchTab(\'focus\')">🎯 Focus</button>' +
        '  <button id="pm-tab-mixes" class="pm-tab" onclick="pmSwitchTab(\'mixes\')">🎵 Mixes</button>' +
        '</div>' +
        '<div id="pm-panel-focus"></div>' +
        '<div id="pm-panel-mixes" style="display:none"></div>';

    _pmInjectStyles();
    _pmTab = 'focus';
    _pmRenderFocusTab();
    _pmRenderMixesTab();   // pre-load mixes in background
}

// ── Tab switching ─────────────────────────────────────────────────────────────
window.pmSwitchTab = function pmSwitchTab(tab) {
    _pmTab = tab;
    document.querySelectorAll('.pm-tab').forEach(function(b) {
        b.classList.toggle('pm-tab--active', b.id === 'pm-tab-' + tab);
    });
    document.getElementById('pm-panel-focus').style.display = tab === 'focus' ? 'block' : 'none';
    document.getElementById('pm-panel-mixes').style.display = tab === 'mixes' ? 'block' : 'none';
};

// ── Active filter — canonical check for practice-eligible songs ───────────────
var _pmActiveStatuses = GLStore.ACTIVE_STATUSES;
function _pmIsActiveStatus(st) { return !!_pmActiveStatuses[st]; }

function _pmIsActive(title) {
    if (typeof GLStore !== 'undefined' && GLStore.getStatus) {
        var st = GLStore.getStatus(title);
        if (st) return _pmIsActiveStatus(st);
    }
    if (typeof isSongActive === 'function') return isSongActive(title);
    return false;
}

// ── Today's Practice — answers "what should I practice right now?" ────────────
function _pmGetTodayPracticeSongs(songList, statusMap, rc) {
    var seen = {};
    var result = [];
    function add(title) {
        if (seen[title] || result.length >= 5) return;
        if (typeof isStructuralTitle === 'function' && isStructuralTitle(title)) return;
        if (!_pmIsActive(title)) return;
        seen[title] = true;
        var ratings = rc[title] || {};
        var vals = Object.values(ratings).filter(function(v){ return typeof v === 'number' && v > 0; });
        var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : 0;
        var safeTitle = title.replace(/'/g, "\\'");
        result.push({ title: title, avg: avg, safeTitle: safeTitle });
    }
    // 1. Weakest songs (readiness < 3)
    var weak = [];
    Object.keys(rc).forEach(function(title) {
        var ratings = rc[title] || {};
        var vals = Object.values(ratings).filter(function(v){ return typeof v === 'number' && v > 0; });
        if (!vals.length) return;
        var avg = vals.reduce(function(a,b){return a+b;},0)/vals.length;
        if (avg < 3 && _pmIsActive(title)) weak.push({ title: title, avg: avg });
    });
    weak.sort(function(a,b){ return a.avg - b.avg; });
    weak.forEach(function(s){ add(s.title); });
    // 2. This Week
    songList.forEach(function(s){ if (statusMap[s.title] === 'this_week') add(s.title); });
    // 3. Needs Polish (wip)
    songList.forEach(function(s){ var st = statusMap[s.title]; if (st === 'needs_polish' || st === 'wip' || st === 'needsPolish' || st === 'learning') add(s.title); });
    // 4. On Deck
    songList.forEach(function(s){ var st = statusMap[s.title]; if (st === 'on_deck' || st === 'prospect' || st === 'onDeck') add(s.title); });
    return result;
}

// ── Focus Tab ─────────────────────────────────────────────────────────────────
async function _pmRenderFocusTab() {
    var el = document.getElementById('pm-panel-focus');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-dim)">Loading…</div>';

    var statusMap = await loadSongStatusMap();
    var songList  = typeof allSongs !== 'undefined' ? allSongs : [];
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};

    // Filter ALL buckets to active songs only
    var thisWeek    = songList.filter(function(s){ return statusMap[s.title]==='this_week' && _pmIsActive(s.title); });
    var needsPolish = songList.filter(function(s){
        var st = statusMap[s.title];
        return (st === 'needs_polish' || st === 'wip' || st === 'needsPolish' || st === 'learning') && _pmIsActive(s.title);
    });
    var gigReady    = songList.filter(function(s){ return (statusMap[s.title]==='gig_ready' || statusMap[s.title]==='rotation') && _pmIsActive(s.title); });
    var onDeck      = songList.filter(function(s){
        var st = statusMap[s.title];
        return (st === 'on_deck' || st === 'prospect' || st === 'onDeck') && _pmIsActive(s.title);
    });

    // Today's Practice
    var todaysSongs = _pmGetTodayPracticeSongs(songList, statusMap, rc);

    function songRow(s, badge) {
        badge = badge || '';
        return '<div class="list-item" style="cursor:pointer" onclick="selectSong(\''+s.title.replace(/'/g,"\\'")+'\')">'+
               '<span style="color:var(--text-dim);font-size:0.78em;min-width:35px;flex-shrink:0">'+(s.band||'')+'</span>'+
               '<span style="flex:1">'+s.title+'</span>'+badge+'</div>';
    }

    var html = '';

    // ── PRIMARY: Start Practice Session button ──
    if (todaysSongs.length) {
        html += '<button onclick="_pmStartSession()" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:800;font-size:1em;cursor:pointer;margin-bottom:16px;box-shadow:0 4px 16px rgba(102,126,234,0.3)">▶ Start Practice Session · ' + todaysSongs.length + ' songs</button>';
    }

    // ── TODAY'S PRACTICE ──
    if (todaysSongs.length) {
        html += '<div class="app-card" style="margin-bottom:16px;border:1px solid rgba(102,126,234,0.2);background:rgba(102,126,234,0.04)">' +
                '<div style="font-weight:700;font-size:0.95em;margin-bottom:10px">🔥 Today\'s Practice</div>';
        todaysSongs.forEach(function(s, i) {
            var avgColor = s.avg >= 3.5 ? '#4ade80' : s.avg >= 2 ? '#fbbf24' : s.avg > 0 ? '#f87171' : '#64748b';
            var avgLabel = s.avg > 0 ? s.avg.toFixed(1) : '—';
            html += '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer" onclick="selectSong(\'' + s.safeTitle + '\')">' +
                    '<span style="color:var(--text-dim);font-size:0.75em;min-width:18px">' + (i+1) + '</span>' +
                    '<span style="flex:1;font-size:0.88em;font-weight:500;color:var(--text)">' + s.title + '</span>' +
                    '<span style="font-size:0.75em;font-weight:700;color:' + avgColor + '">' + avgLabel + '</span>' +
                    '<button onclick="event.stopPropagation();if(typeof openRehearsalMode===\'function\')openRehearsalMode(\'' + s.safeTitle + '\')" style="padding:3px 10px;background:rgba(102,126,234,0.15);color:#a5b4fc;border:1px solid rgba(102,126,234,0.25);border-radius:6px;cursor:pointer;font-size:0.68em;font-weight:600;white-space:nowrap">▶ Practice</button>' +
                    '</div>';
        });
        html += '</div>';
    }

    // ── WEAK SONGS (async-filled) ──
    html += '<div id="practice-weak-songs"></div>';

    if (thisWeek.length || needsPolish.length) {
        html += '<div class="app-card" style="margin-bottom:16px">'+
                '<div style="font-weight:700;font-size:0.95em;margin-bottom:12px">🔥 This Week\'s Focus</div>'+
                thisWeek.map(function(s){return songRow(s,'<span style="background:rgba(239,68,68,0.15);color:#f87171;font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0">THIS WEEK</span>');}).join('')+
                needsPolish.map(function(s){return songRow(s,'<span style="background:rgba(245,158,11,0.15);color:#fbbf24;font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0">WIP</span>');}).join('')+
                '</div>';
    }
    if (gigReady.length) {
        html += '<div class="app-card" style="margin-bottom:16px">'+
                '<div style="font-weight:700;font-size:0.95em;margin-bottom:12px">✅ Gig Ready</div>'+
                gigReady.map(function(s){return songRow(s,'<span style="background:rgba(34,197,94,0.12);color:#4ade80;font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0">GIG READY</span>');}).join('')+
                '</div>';
    }
    if (onDeck.length) {
        html += '<div class="app-card" style="margin-bottom:16px">'+
                '<div style="font-weight:700;font-size:0.95em;margin-bottom:12px">🃏 On Deck</div>'+
                onDeck.map(function(s){return songRow(s);}).join('')+
                '</div>';
    }
    if (!todaysSongs.length && !thisWeek.length && !needsPolish.length && !gigReady.length && !onDeck.length) {
        html += '<div class="app-card" style="margin-bottom:16px;text-align:center;padding:32px 20px">'+
                '<div style="font-size:2em;margin-bottom:10px">🎸</div>'+
                '<div style="font-weight:700;margin-bottom:6px">No songs in the queue yet</div>'+
                '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:16px">Open any song → set status to <b>Learning</b> or <b>In Rotation</b> to see it here.</div>'+
                '<button class="btn btn-primary" onclick="showPage(\'songs\')">Browse Song Library →</button>'+
                '</div>';
    }

    html += '<div class="app-card" style="margin-bottom:16px">'+
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
            '<div style="font-weight:700;font-size:0.95em">📊 Your Readiness</div>'+
            '<button class="btn btn-ghost btn-sm" onclick="showPage(\'songs\')">View All →</button>'+
            '</div>'+
            '<div id="practice-readiness-list"><div style="font-size:0.82em;color:var(--text-dim);text-align:center;padding:12px">Loading…</div></div>'+
            '</div>';

    el.innerHTML = html;
    _fillPracticeWeakSongs();
    _fillPracticeReadiness();
}

// ── Start Practice Session — launches practice mode with Today's songs ───────
window._pmStartSession = function() {
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var songList = typeof allSongs !== 'undefined' ? allSongs : [];
    // Re-derive (fast, sync) using cached status
    var statusMap = {};
    try {
        var cached = (typeof GLStore !== 'undefined' && GLStore.getAllStatus) ? GLStore.getAllStatus() : {};
        Object.keys(cached).forEach(function(k) { statusMap[k] = (cached[k] || '').toLowerCase().replace(/\s+/g,'_'); });
    } catch(e) {}
    var today = _pmGetTodayPracticeSongs(songList, statusMap, rc);
    if (!today.length) { if (typeof showToast === 'function') showToast('No songs to practice'); return; }
    if (today.length === 1) {
        if (typeof openRehearsalMode === 'function') openRehearsalMode(today[0].title);
        return;
    }
    var queue = today.map(function(s) {
        var songObj = songList.find(function(x){ return x.title === s.title; });
        return { title: s.title, band: songObj ? (songObj.band || '') : '' };
    });
    if (typeof openRehearsalModeWithQueue === 'function') openRehearsalModeWithQueue(queue);
};

async function _fillPracticeWeakSongs() {
    var el = document.getElementById('practice-weak-songs');
    if (!el) return;
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    if (!Object.keys(rc).length) return;
    var THRESH = 3, now = Date.now(), actLog = [], lastSeen = {};
    try { actLog = await window.loadMasterFile('_master_activity_log.json') || []; } catch(e) {}
    var ACTS = {practice_track:1,readiness_set:1,rehearsal_note:1,harmony_add:1,harmony_edit:1,part_notes:1};
    (Array.isArray(actLog)?actLog:[]).forEach(function(e){
        if(!e||!e.song||!e.time||!ACTS[e.action])return;
        var t=new Date(e.time).getTime();
        if(!isNaN(t)&&(!lastSeen[e.song]||t>lastSeen[e.song]))lastSeen[e.song]=t;
    });
    var scored=[];
    Object.keys(rc).forEach(function(title){
        if(typeof isStructuralTitle==='function'&&isStructuralTitle(title))return;
        var ratings=rc[title];
        var keys=Object.keys(ratings).filter(function(k){return typeof ratings[k]==='number'&&ratings[k]>0;});
        if(!keys.length)return;
        var avg=keys.reduce(function(s,k){return s+ratings[k];},0)/keys.length;
        if(avg>=THRESH)return;
        if(!_pmIsActive(title))return;
        var ds=lastSeen[title]?Math.floor((now-lastSeen[title])/86400000):null;
        scored.push({title:title,avg:avg,score:Math.max(0,THRESH-avg)*2+(ds===null?3:ds>21?Math.min(3,Math.floor(ds/7)):0)});
    });
    scored.sort(function(a,b){return b.score-a.score;});
    var top=scored.slice(0,5);
    if(!top.length) return;
    el.innerHTML='<div class="app-card" style="margin-bottom:16px">'+
        '<div style="font-weight:700;font-size:0.95em;margin-bottom:12px">⚠️ Weakest Songs — Work These First</div>'+
        top.map(function(s){
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer"'+
                   ' onclick="selectSong(\''+s.title.replace(/'/g,"\\'")+'\')">'+
                   '<div style="flex:1;font-size:0.88em;color:var(--text)">'+s.title+'</div>'+
                   '<div style="font-size:0.78em;color:'+(s.avg<2?'#f87171':'#fbbf24')+';font-weight:700">avg '+s.avg.toFixed(1)+'</div>'+
                   '</div>';
        }).join('')+
        '</div>';
}

async function _fillPracticeReadiness() {
    var el = document.getElementById('practice-readiness-list');
    if (!el) return;
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var myKey = typeof getCurrentMemberReadinessKey === 'function' ? getCurrentMemberReadinessKey() : null;
    if (!myKey) {
        el.innerHTML='<div style="font-size:0.82em;color:var(--text-dim);text-align:center;padding:8px">Sign in to see your readiness scores.</div>';
        return;
    }
    var songs = typeof allSongs !== 'undefined' ? allSongs : [];
    var rows = songs.map(function(s){return{title:s.title,score:((rc[s.title]||{})[myKey]||0)};})
        .filter(function(r){return r.score>0 && _pmIsActive(r.title);})
        .sort(function(a,b){return a.score-b.score;})
        .slice(0,8);
    if (!rows.length) {
        el.innerHTML='<div style="font-size:0.82em;color:var(--text-dim);text-align:center;padding:8px">No readiness data yet.</div>';
        return;
    }
    el.innerHTML=rows.map(function(r){
        var pct=(r.score/5)*100;
        var color=r.score>=4?'#4ade80':r.score>=3?'#fbbf24':'#f87171';
        return '<div style="margin-bottom:8px">'+
               '<div style="display:flex;justify-content:space-between;font-size:0.82em;margin-bottom:3px">'+
               '<span style="color:var(--text);cursor:pointer" onclick="selectSong(\''+r.title.replace(/'/g,"\\'")+'\')">'+r.title+'</span>'+
               '<span style="color:'+color+';font-weight:700">'+r.score+'/5</span></div>'+
               '<div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px">'+
               '<div style="height:4px;width:'+pct+'%;background:'+color+';border-radius:2px;transition:width 0.4s ease"></div>'+
               '</div></div>';
    }).join('');
}

// ── Mixes Tab ─────────────────────────────────────────────────────────────────
async function _pmRenderMixesTab() {
    var el = document.getElementById('pm-panel-mixes');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-dim)">Loading mixes…</div>';

    _pmMixes = await _pmLoadMixes();
    _pmRedrawMixList();
}

function _pmRedrawMixList() {
    var el = document.getElementById('pm-panel-mixes');
    if (!el) return;

    var myMixes  = _pmMixes.filter(function(m){return !m.isShared || m.createdBy === _pmMyKey();});
    var bandMixes = _pmMixes.filter(function(m){return m.isShared && m.createdBy !== _pmMyKey();});

    var html = '';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
            '<div style="font-weight:700;font-size:0.95em">🎵 Practice Mixes</div>'+
            '<div style="display:flex;gap:6px">'+
            '<button class="btn btn-ghost btn-sm" onclick="pmGenerateWeakMix()" style="font-size:0.78em">⚠️ Auto from Readiness</button>'+
            '<button class="btn btn-primary btn-sm" onclick="pmNewMix()" style="font-size:0.78em">+ New Mix</button>'+
            '</div></div>';

    if (!_pmMixes.length) {
        html += '<div class="app-card" style="text-align:center;padding:28px;margin-bottom:16px">'+
                '<div style="font-size:2em;margin-bottom:8px">🎛️</div>'+
                '<div style="font-weight:700;margin-bottom:6px">No mixes yet</div>'+
                '<div style="font-size:0.85em;color:var(--text-dim)">Create a mix to organize songs for practice or rehearsal.</div>'+
                '</div>';
    } else {
        if (myMixes.length) {
            html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">MY MIXES</div>';
            html += myMixes.map(_pmMixCard).join('');
        }
        if (bandMixes.length) {
            html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;margin:16px 0 8px">BAND MIXES</div>';
            html += bandMixes.map(_pmMixCard).join('');
        }
    }

    // Editor pane (shown inline when creating/editing)
    html += '<div id="pm-mix-editor" style="display:none"></div>';

    el.innerHTML = html;
}

function _pmMixCard(mix) {
    var type = MIX_TYPES.find(function(t){return t.id===mix.type;}) || MIX_TYPES[0];
    var songs = mix.songIds || [];
    var shareTag = mix.isShared
        ? '<span style="font-size:0.7em;background:rgba(102,126,234,0.15);color:#818cf8;padding:2px 8px;border-radius:8px;font-weight:700;flex-shrink:0">Shared</span>'
        : '';
    return '<div class="app-card" style="margin-bottom:10px">'+
           '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
           '<span style="font-size:1.1em">'+type.emoji+'</span>'+
           '<div style="flex:1;min-width:0">'+
           '<div style="font-weight:700;font-size:0.9em;color:var(--text)">'+_pmEsc(mix.title)+'</div>'+
           '<div style="font-size:0.72em;color:var(--text-dim)">'+type.label+' · '+songs.length+' songs</div>'+
           '</div>'+
           shareTag+
           '<button onclick="pmEditMix(\''+mix.id+'\')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.85em;padding:4px 8px">✏️</button>'+
           '<button onclick="pmDeleteMix(\''+mix.id+'\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.85em;padding:4px 8px">🗑️</button>'+
           '</div>'+
           (songs.length
               ? '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
                 songs.slice(0,6).map(function(s){
                     return '<span style="font-size:0.72em;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:8px;color:var(--text-muted)">'+_pmEsc(s)+'</span>';
                 }).join('')+
                 (songs.length>6?'<span style="font-size:0.72em;color:var(--text-dim)">+'+( songs.length-6)+' more</span>':'')+
                 '</div>'
               : '<div style="font-size:0.78em;color:var(--text-dim)">No songs yet</div>')+
           '</div>';
}

// ── Mix Editor ────────────────────────────────────────────────────────────────
window.pmNewMix = function pmNewMix() {
    _pmEditingMix = { id: null, title:'', type:'practice', songIds:[], isShared:false, createdBy: _pmMyKey() };
    _pmMixSongs = [];
    _pmShowEditor();
};

window.pmEditMix = function pmEditMix(mixId) {
    var mix = _pmMixes.find(function(m){return m.id===mixId;});
    if (!mix) return;
    _pmEditingMix = Object.assign({}, mix);
    _pmMixSongs = (mix.songIds || []).slice();
    _pmShowEditor();
};

function _pmShowEditor() {
    var el = document.getElementById('pm-mix-editor');
    if (!el) return;

    var typeOpts = MIX_TYPES.map(function(t){
        return '<option value="'+t.id+'"'+(_pmEditingMix.type===t.id?' selected':'')+'>'+t.emoji+' '+t.label+'</option>';
    }).join('');

    var songSearchHtml =
        '<input type="text" id="pm-song-search" placeholder="Type to search songs…" '+
        'style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:7px 10px;font-size:0.85em;font-family:inherit" '+
        'oninput="pmSongSearchFilter(this.value)" onclick="event.stopPropagation()">';

    var songListHtml = '<div id="pm-song-search-results" style="max-height:160px;overflow-y:auto;margin-top:6px"></div>';

    var addedHtml = _pmMixSongs.length
        ? '<div style="display:flex;flex-direction:column;gap:4px">'+
          _pmMixSongs.map(function(s,i){
              return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
                     '<span style="flex:1;font-size:0.85em;color:var(--text)">'+_pmEsc(s)+'</span>'+
                     (i>0?'<button onclick="pmMoveSong('+i+',-1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↑</button>':'<span style="width:26px"></span>')+
                     (i<_pmMixSongs.length-1?'<button onclick="pmMoveSong('+i+',1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↓</button>':'<span style="width:26px"></span>')+
                     '<button onclick="pmRemoveSong('+i+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px 6px">✕</button>'+
                     '</div>';
          }).join('')+
          '</div>'
        : '<div style="font-size:0.82em;color:var(--text-dim)">No songs added yet</div>';

    el.style.display = 'block';
    el.innerHTML =
        '<div class="app-card" style="margin-top:16px;border:1px solid rgba(102,126,234,0.3)">'+
        '<div style="font-weight:700;font-size:0.9em;margin-bottom:12px">'+(_pmEditingMix.id?'✏️ Edit Mix':'➕ New Mix')+'</div>'+

        '<span style="display:block;margin-bottom:10px">'+
        '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:4px">Mix Name</div>'+
        '<input type="text" id="pm-mix-title" value="'+_pmEsc(_pmEditingMix.title||'')+'" placeholder="e.g. Pre-Rehearsal Brush-Up" '+
        'style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:8px 10px;font-size:0.88em;font-family:inherit" '+
        'onclick="event.stopPropagation()"></label>'+

        '<span style="display:block;margin-bottom:12px">'+
        '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:4px">Type</div>'+
        '<select id="pm-mix-type" class="app-select" style="font-size:0.88em">'+typeOpts+'</select>'+
        '</label>'+

        '<div style="margin-bottom:12px">'+
        '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:6px">Songs ('+_pmMixSongs.length+')</div>'+
        '<div id="pm-added-songs">'+addedHtml+'</div>'+
        '<div style="margin-top:8px">'+songSearchHtml+songListHtml+'</div>'+
        '</div>'+

        '<label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer">'+
        '<input type="checkbox" id="pm-mix-shared" '+(_pmEditingMix.isShared?'checked':'')+' onclick="event.stopPropagation()">'+
        '<span style="font-size:0.85em;color:var(--text)">Share with band</span>'+
        '<span style="font-size:0.72em;color:var(--text-dim)">(bandmates can view this mix)</span>'+
        '</label>'+

        '<div style="display:flex;gap:8px">'+
        '<button class="btn btn-primary" onclick="pmSaveMix()" style="flex:1">💾 Save Mix</button>'+
        '<button class="btn btn-ghost" onclick="pmCancelEdit()">Cancel</button>'+
        '</div>'+
        '</div>';

    // Initial song search results (show all)
    pmSongSearchFilter('');
}

window.pmSongSearchFilter = function pmSongSearchFilter(term) {
    var el = document.getElementById('pm-song-search-results');
    if (!el) return;
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var filtered = songs.filter(function(s){
        return s.title.toLowerCase().includes(term.toLowerCase()) && !_pmMixSongs.includes(s.title);
    }).slice(0, 20);
    if (!filtered.length) {
        el.innerHTML = '<div style="font-size:0.8em;color:var(--text-dim);padding:6px">No matching songs</div>';
        return;
    }
    el.innerHTML = filtered.map(function(s){
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;transition:background 0.1s" '+
               'onmouseover="this.style.background=\'rgba(255,255,255,0.06)\'" onmouseout="this.style.background=\'\'" '+
               'onclick="pmAddSongToMix(\''+s.title.replace(/'/g,"\\'")+'\')">'+
               '<span style="font-size:0.78em;color:var(--text-dim);min-width:28px">'+_pmEsc(s.band||'')+'</span>'+
               '<span style="font-size:0.85em;color:var(--text);flex:1">'+_pmEsc(s.title)+'</span>'+
               '<span style="font-size:0.8em;color:var(--accent-light)">+ Add</span>'+
               '</div>';
    }).join('');
};

window.pmAddSongToMix = function pmAddSongToMix(title) {
    if (!_pmMixSongs.includes(title)) {
        _pmMixSongs.push(title);
        _pmRefreshAddedSongs();
        // Re-filter to remove added song
        var searchEl = document.getElementById('pm-song-search');
        pmSongSearchFilter(searchEl ? searchEl.value : '');
    }
};

window.pmRemoveSong = function pmRemoveSong(idx) {
    _pmMixSongs.splice(idx, 1);
    _pmRefreshAddedSongs();
    var searchEl = document.getElementById('pm-song-search');
    pmSongSearchFilter(searchEl ? searchEl.value : '');
};

window.pmMoveSong = function pmMoveSong(idx, dir) {
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= _pmMixSongs.length) return;
    var tmp = _pmMixSongs[idx];
    _pmMixSongs[idx] = _pmMixSongs[newIdx];
    _pmMixSongs[newIdx] = tmp;
    _pmRefreshAddedSongs();
};

function _pmRefreshAddedSongs() {
    var el = document.getElementById('pm-added-songs');
    if (!el) return;
    var html = _pmMixSongs.length
        ? '<div style="display:flex;flex-direction:column;gap:4px">'+
          _pmMixSongs.map(function(s,i){
              return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
                     '<span style="flex:1;font-size:0.85em;color:var(--text)">'+_pmEsc(s)+'</span>'+
                     (i>0?'<button onclick="pmMoveSong('+i+',-1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↑</button>':'<span style="width:26px"></span>')+
                     (i<_pmMixSongs.length-1?'<button onclick="pmMoveSong('+i+',1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↓</button>':'<span style="width:26px"></span>')+
                     '<button onclick="pmRemoveSong('+i+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px 6px">✕</button>'+
                     '</div>';
          }).join('')+
          '</div>'
        : '<div style="font-size:0.82em;color:var(--text-dim)">No songs added yet</div>';
    el.innerHTML = html;
    // Update count label
    var countEl = el.closest('.app-card');
    if (countEl) {
        var lbl = countEl.querySelector('[id^="pm-added-songs"]')?.previousElementSibling;
        if (lbl) lbl.textContent = 'Songs (' + _pmMixSongs.length + ')';
    }
}

window.pmSaveMix = async function pmSaveMix() {
    var titleEl  = document.getElementById('pm-mix-title');
    var typeEl   = document.getElementById('pm-mix-type');
    var sharedEl = document.getElementById('pm-mix-shared');
    if (!titleEl) return;

    var title    = titleEl.value.trim();
    var type     = typeEl ? typeEl.value : 'practice';
    var isShared = sharedEl ? sharedEl.checked : false;

    if (!title) { if (typeof showToast==='function') showToast('Please enter a mix name'); return; }

    var mix = {
        title:     title,
        type:      type,
        songIds:   _pmMixSongs.slice(),
        isShared:  isShared,
        createdBy: _pmMyKey(),
        updatedAt: new Date().toISOString(),
    };

    try {
        if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') {
            if (typeof showToast==='function') showToast('Not connected — sign in to save mixes');
            return;
        }
        var ref;
        if (_pmEditingMix && _pmEditingMix.id) {
            // Update existing
            mix.createdAt = _pmEditingMix.createdAt || mix.updatedAt;
            mix.shareSlug = _pmEditingMix.shareSlug || null;
            if (isShared && !mix.shareSlug) mix.shareSlug = _pmGenSlug(title);
            ref = firebaseDB.ref(bandPath('practice_mixes/' + _pmEditingMix.id));
            await ref.update(mix);
            mix.id = _pmEditingMix.id;
        } else {
            // Create new
            mix.createdAt = mix.updatedAt;
            if (isShared) mix.shareSlug = _pmGenSlug(title);
            ref = firebaseDB.ref(bandPath('practice_mixes')).push();
            mix.id = ref.key;
            await ref.set(mix);
        }

        // Update local list
        var idx = _pmMixes.findIndex(function(m){return m.id===mix.id;});
        if (idx >= 0) _pmMixes[idx] = mix; else _pmMixes.unshift(mix);

        _pmEditingMix = null;
        _pmMixSongs   = [];
        _pmRedrawMixList();
        if (typeof showToast==='function') showToast('Mix saved ✅');
    } catch(e) {
        console.error('[practice] saveMix failed:', e);
        if (typeof showToast==='function') showToast('Save failed — check connection');
    }
};

window.pmDeleteMix = async function pmDeleteMix(mixId) {
    if (!confirm('Delete this mix?')) return;
    try {
        if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
            await firebaseDB.ref(bandPath('practice_mixes/' + mixId)).remove();
        }
        _pmMixes = _pmMixes.filter(function(m){return m.id!==mixId;});
        _pmRedrawMixList();
        if (typeof showToast==='function') showToast('Mix deleted');
    } catch(e) {
        if (typeof showToast==='function') showToast('Delete failed');
    }
};

window.pmCancelEdit = function pmCancelEdit() {
    _pmEditingMix = null;
    _pmMixSongs   = [];
    var el = document.getElementById('pm-mix-editor');
    if (el) el.style.display = 'none';
};

// ── Auto-generate weak mix ────────────────────────────────────────────────────
window.pmGenerateWeakMix = async function pmGenerateWeakMix() {
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var weak = songs
        .map(function(s){
            var scores=rc[s.title]||{};
            var vals=Object.values(scores).filter(function(v){return typeof v==='number';});
            var avg=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null;
            return {title:s.title,avg:avg};
        })
        .filter(function(s){return s.avg!==null&&s.avg<=2.5;})
        .sort(function(a,b){return a.avg-b.avg;})
        .map(function(s){return s.title;})
        .slice(0,15);

    if (!weak.length) {
        if (typeof showToast==='function') showToast('No weak songs found (avg ≤ 2.5)');
        return;
    }

    var today = new Date().toISOString().slice(0,10);
    _pmEditingMix = { id:null, title:'Weak Songs — '+today, type:'weak', songIds:[], isShared:false, createdBy:_pmMyKey() };
    _pmMixSongs = weak;
    pmSwitchTab('mixes');
    _pmShowEditor();
    if (typeof showToast==='function') showToast('Generated '+weak.length+' weak songs — review and save');
};

// ── Firebase helpers ──────────────────────────────────────────────────────────
async function _pmLoadMixes() {
    try {
        if (typeof firebaseDB==='undefined'||!firebaseDB||typeof bandPath!=='function') return [];
        var snap = await firebaseDB.ref(bandPath('practice_mixes')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.entries(val).map(function(entry){
            return Object.assign({}, entry[1], {id:entry[0]});
        }).sort(function(a,b){
            return (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'');
        });
    } catch(e) { return []; }
}

function _pmMyKey() {
    return typeof getCurrentMemberKey==='function' ? (getCurrentMemberKey()||'unknown') : 'unknown';
}

function _pmGenSlug(title) {
    // Generate a short URL-safe slug for sharing
    var base = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20);
    var rand = Math.random().toString(36).slice(2,7);
    return base + '-' + rand;
}

function _pmEsc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Status map ────────────────────────────────────────────────────────────────
async function loadSongStatusMap() {
    try {
        // Primary: read from GLStore.getAllStatus() (statusCache)
        var cached = (window.GLStore && typeof GLStore.getAllStatus === 'function')
            ? GLStore.getAllStatus() : null;
        if (cached && typeof cached === 'object' && Object.keys(cached).length) {
            var map = {};
            Object.keys(cached).forEach(function(k) {
                var raw = cached[k];
                if (raw && typeof raw === 'string') {
                    map[k] = raw.toLowerCase().replace(/\s+/g, '_');
                } else if (raw && raw.status) {
                    map[k] = raw.status.toLowerCase().replace(/\s+/g, '_');
                }
            });
            return map;
        }
        // Fallback: try band-level key
        var allStatuses = await loadBandDataFromDrive('_band','song_statuses');
        if (!allStatuses||typeof allStatuses!=='object') return {};
        var map={};
        Object.keys(allStatuses).forEach(function(k){
            var v=allStatuses[k];
            var raw=(v&&v.status)?v.status:(typeof v==='string'?v:'');
            if(raw) map[k]=raw.toLowerCase().replace(/\s+/g,'_');
        });
        return map;
    } catch(e){return {};}
}

// ── Styles ────────────────────────────────────────────────────────────────────
function _pmInjectStyles(){
    if(document.getElementById('pm-styles'))return;
    var s=document.createElement('style');
    s.id='pm-styles';
    s.textContent=
    /* Tab strip container */
    '.pm-tab-strip{display:flex;gap:0;margin:0 0 16px;border-bottom:2px solid rgba(255,255,255,0.08);background:transparent;width:100%;}'+
    /* Individual tab */
    '.pm-tab{flex:1;padding:12px 8px;background:transparent;border:none;border-bottom:3px solid transparent;color:var(--text-muted,#94a3b8);cursor:pointer;font-weight:700;font-size:0.88em;transition:all 0.15s;font-family:inherit;-webkit-appearance:none;appearance:none;text-align:center;}'+
    '.pm-tab:hover{color:var(--text,#f1f5f9);background:rgba(255,255,255,0.04);}'+
    '.pm-tab--active{color:var(--accent,#667eea)!important;border-bottom-color:var(--accent,#667eea)!important;background:transparent!important;-webkit-text-fill-color:var(--accent,#667eea)!important;}';
    document.head.appendChild(s);
}

window.renderPracticePage = renderPracticePage;
window.loadSongStatusMap  = loadSongStatusMap;
