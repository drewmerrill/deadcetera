// ─────────────────────────────────────────────────────────────────────────────
// practice.js — Personal Practice (Woodshed)
// Purpose: Individual skill development and song preparation.
//          NOT tied to band dates. Use Rehearsals for scheduled band sessions.
//
// EXPOSES globals: renderPracticePage, loadSongStatusMap
// DEPENDS ON: allSongs, readinessCache, loadBandDataFromDrive,
//             saveBandDataToDrive, showToast, toArray, getCurrentMemberReadinessKey
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

async function renderPracticePage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'practice');
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">Loading...</div>';

    const statusMap = await loadSongStatusMap();
    const songList = typeof allSongs !== 'undefined' ? allSongs : [];

    const thisWeek    = songList.filter(s => statusMap[s.title] === 'this_week');
    const needsPolish = songList.filter(s => statusMap[s.title] === 'needs_polish');
    const gigReady    = songList.filter(s => statusMap[s.title] === 'gig_ready');
    const onDeck      = songList.filter(s => statusMap[s.title] === 'on_deck');

    function songRow(s, badge='') {
        return `<div class="list-item" style="cursor:pointer" onclick="selectSong('${s.title.replace(/'/g,"\\'")}');showPage('songs')">
            <span style="color:var(--text-dim);font-size:0.78em;min-width:35px;flex-shrink:0">${s.band||''}</span>
            <span style="flex:1">${s.title}</span>${badge}
        </div>`;
    }

    el.innerHTML = `
    <div class="page-header">
        <h1>🎯 Practice</h1>
        <p>Your personal woodshed — songs to work on, resources to practice with</p>
    </div>

    <div id="practice-weak-songs"></div>

    ${thisWeek.length || needsPolish.length ? `
    <div class="app-card" style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.95em;margin-bottom:12px">🔥 This Week's Focus</div>
        ${thisWeek.map(s => songRow(s, '<span style="background:rgba(239,68,68,0.15);color:#f87171;font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0">THIS WEEK</span>')).join('')}
        ${needsPolish.map(s => songRow(s, '<span style="background:rgba(245,158,11,0.15);color:#fbbf24;font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0">NEEDS POLISH</span>')).join('')}
        <div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:10px;padding-top:10px;font-size:0.78em;color:var(--text-dim)">
            Tap any song to open it. Set song status from the Song Library.
        </div>
    </div>` : ''}

    ${gigReady.length ? `
    <div class="app-card" style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.95em;margin-bottom:12px">✅ Gig Ready</div>
        ${gigReady.map(s => songRow(s, '<span style="background:rgba(34,197,94,0.12);color:#4ade80;font-size:0.7em;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0">GIG READY</span>')).join('')}
    </div>` : ''}

    ${onDeck.length ? `
    <div class="app-card" style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.95em;margin-bottom:12px">🃏 On Deck</div>
        ${onDeck.map(s => songRow(s)).join('')}
    </div>` : ''}

    ${!thisWeek.length && !needsPolish.length && !gigReady.length && !onDeck.length ? `
    <div class="app-card" style="margin-bottom:16px;text-align:center;padding:32px 20px">
        <div style="font-size:2em;margin-bottom:10px">🎸</div>
        <div style="font-weight:700;margin-bottom:6px">No songs flagged for practice yet</div>
        <div style="font-size:0.85em;color:var(--text-dim);margin-bottom:16px">Open any song and set its status to "This Week" or "Needs Polish" to see it here.</div>
        <button class="btn btn-primary" onclick="showPage('songs')">Browse Song Library →</button>
    </div>` : ''}

    <div class="app-card" style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.95em;margin-bottom:12px">🎧 Practice Resources</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-ghost" style="text-align:left;padding:10px 12px;font-size:0.82em" onclick="showPage('pocketmeter')">🎚️ Tuner / Metronome</button>
            <button class="btn btn-ghost" style="text-align:left;padding:10px 12px;font-size:0.82em" onclick="showPage('bestshot')">🏆 Best Versions</button>
            <button class="btn btn-ghost" style="text-align:left;padding:10px 12px;font-size:0.82em" onclick="showPage('songs')">🎸 Song Library</button>
            <button class="btn btn-ghost" style="text-align:left;padding:10px 12px;font-size:0.82em" onclick="showPage('playlists')">🎧 Playlists</button>
        </div>
    </div>

    <div class="app-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="font-weight:700;font-size:0.95em">📊 Your Readiness</div>
            <button class="btn btn-ghost btn-sm" onclick="showPage('songs')">View All →</button>
        </div>
        <div id="practice-readiness-list">
            <div style="font-size:0.82em;color:var(--text-dim);text-align:center;padding:12px">Loading…</div>
        </div>
    </div>
    `;

    _fillPracticeWeakSongs();
    _fillPracticeReadiness();
}

async function _fillPracticeWeakSongs() {
    var el = document.getElementById('practice-weak-songs');
    if (!el) return;
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    if (!Object.keys(rc).length) return;
    var THRESH = 3, now = Date.now(), actLog = [], lastSeen = {};
    try { actLog = await window.loadMasterFile('_master_activity_log.json') || []; } catch(e) {}
    var ACTS = {practice_track:1,readiness_set:1,rehearsal_note:1,harmony_add:1,harmony_edit:1,part_notes:1};
    (Array.isArray(actLog) ? actLog : []).forEach(function(e) {
        if (!e || !e.song || !e.time || !ACTS[e.action]) return;
        var t = new Date(e.time).getTime();
        if (!isNaN(t) && (!lastSeen[e.song] || t > lastSeen[e.song])) lastSeen[e.song] = t;
    });
    var scored = [];
    Object.keys(rc).forEach(function(title) {
        var ratings = rc[title];
        var keys = Object.keys(ratings).filter(function(k) { return typeof ratings[k] === 'number' && ratings[k] > 0; });
        if (!keys.length) return;
        var avg = keys.reduce(function(s, k) { return s + ratings[k]; }, 0) / keys.length;
        if (avg >= THRESH) return;
        var ds = lastSeen[title] ? Math.floor((now - lastSeen[title]) / 86400000) : null;
        scored.push({ title: title, avg: avg, score: Math.max(0, THRESH - avg) * 2 + (ds === null ? 3 : ds > 21 ? Math.min(3, Math.floor(ds / 7)) : 0) });
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    var top = scored.slice(0, 5);
    if (!top.length) return;
    el.innerHTML = '<div class="app-card" style="margin-bottom:16px">'
        + '<div style="font-weight:700;font-size:0.95em;margin-bottom:12px">⚠️ Weakest Songs — Work These First</div>'
        + top.map(function(s) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer"'
                + ' onclick="selectSong(\'' + s.title.replace(/'/g, "\\'") + '\');showPage(\'songs\')">'
                + '<div style="flex:1;font-size:0.88em;color:var(--text)">' + s.title + '</div>'
                + '<div style="font-size:0.78em;color:' + (s.avg < 2 ? '#f87171' : '#fbbf24') + ';font-weight:700">avg ' + s.avg.toFixed(1) + '</div>'
                + '</div>';
          }).join('')
        + '</div>';
}

async function _fillPracticeReadiness() {
    var el = document.getElementById('practice-readiness-list');
    if (!el) return;
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    var myKey = typeof getCurrentMemberReadinessKey === 'function' ? getCurrentMemberReadinessKey() : null;
    if (!myKey) {
        el.innerHTML = '<div style="font-size:0.82em;color:var(--text-dim);text-align:center;padding:8px">Sign in to see your readiness scores.</div>';
        return;
    }
    var songs = typeof allSongs !== 'undefined' ? allSongs : [];
    var rows = songs
        .map(function(s) { return { title: s.title, score: ((rc[s.title] || {})[myKey] || 0) }; })
        .filter(function(r) { return r.score > 0; })
        .sort(function(a, b) { return a.score - b.score; })
        .slice(0, 8);
    if (!rows.length) {
        el.innerHTML = '<div style="font-size:0.82em;color:var(--text-dim);text-align:center;padding:8px">No readiness data yet — rate songs from the Song Library.</div>';
        return;
    }
    el.innerHTML = rows.map(function(r) {
        var pct = (r.score / 5) * 100;
        var color = r.score >= 4 ? '#4ade80' : r.score >= 3 ? '#fbbf24' : '#f87171';
        return '<div style="margin-bottom:8px">'
            + '<div style="display:flex;justify-content:space-between;font-size:0.82em;margin-bottom:3px">'
            + '<span style="color:var(--text);cursor:pointer" onclick="selectSong(\'' + r.title.replace(/'/g, "\\'") + '\');showPage(\'songs\')">' + r.title + '</span>'
            + '<span style="color:' + color + ';font-weight:700">' + r.score + '/5</span>'
            + '</div>'
            + '<div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px">'
            + '<div style="height:4px;width:' + pct + '%;background:' + color + ';border-radius:2px;transition:width 0.4s ease"></div>'
            + '</div></div>';
    }).join('');
}

async function loadSongStatusMap() {
    try {
        const allStatuses = await loadBandDataFromDrive('_band', 'song_statuses');
        if (!allStatuses || typeof allStatuses !== 'object') return {};
        const map = {};
        Object.keys(allStatuses).forEach(function(k) {
            var v = allStatuses[k];
            // Normalize: handle both {status:'This Week'} object and raw string values
            var raw = (v && v.status) ? v.status : (typeof v === 'string' ? v : '');
            if (raw) map[k] = raw.toLowerCase().replace(/\s+/g, '_');
        });
        return map;
    } catch(e) { return {}; }
}

window.renderPracticePage = renderPracticePage;
window.loadSongStatusMap  = loadSongStatusMap;
