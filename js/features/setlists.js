// ============================================================================
// js/features/setlists.js
// Setlist builder: create, edit, render, and export setlists.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js, worker-api.js
// EXPOSES globals: renderSetlistsPage, loadSetlists, createNewSetlist,
//   slAddSongToSet, slRenderSetSongs, slRenderReadinessMeter,
//   slSaveSetlistEdit, deleteSetlist, openSetlistCarePackage
// ============================================================================

'use strict';

// ============================================================================
// SETLIST BUILDER
// ============================================================================
var _slFilter = 'all'; // 'all' | 'upcoming' | 'past'

// Date helpers — delegate to shared glFormatDate / glDaysAway / glCountdownLabel in utils.js
// Local aliases for backward compat within this file
function _slFormatDate(dateStr, compact) { return (typeof glFormatDate === 'function') ? glFormatDate(dateStr, compact) : (dateStr || 'No date'); }
function _slDaysAway(dateStr) { return (typeof glDaysAway === 'function') ? glDaysAway(dateStr) : null; }
function _slCountdownLabel(dateStr) { return (typeof glCountdownLabel === 'function') ? glCountdownLabel(dateStr) : ''; }

function renderSetlistsPage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'setlists');
    el.innerHTML = '<div class="page-header"><h1>📋 Setlists</h1><p>Build and manage setlists for gigs</p></div>'
        + '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">'
        + '<button class="btn btn-primary" onclick="createNewSetlist()" style="font-size:0.85em">+ New Setlist</button>'
        + '<div id="slFilterBar" style="display:flex;gap:4px;margin-left:auto"></div></div>'
        + '<div id="setlistsList"></div>';
    if (typeof loadGigHistory === 'function') loadGigHistory().then(function() { loadSetlists(); }); else loadSetlists();
}

async function loadSetlists() {
    var rawData;
    try {
        rawData = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    } catch(e) {
        console.error('[RenderError] setlists data load failed:', e);
        if (typeof GLRenderState !== 'undefined') GLRenderState.set('setlists', { status: 'error', title: 'Failed to load setlists', message: e.message, retry: "loadSetlists()" });
        return;
    }
    if (typeof GLStore !== 'undefined' && GLStore.setSetlistCache) GLStore.setSetlistCache(rawData);
    else { window._glCachedSetlists = rawData; window._cachedSetlists = rawData; }
    var data = rawData.map(function(sl, origIdx) { return Object.assign({}, sl, { _origIdx: origIdx }); });
    var container = document.getElementById('setlistsList');
    if (!container) return;

    // Render filter bar
    var filterBar = document.getElementById('slFilterBar');
    if (filterBar) {
        filterBar.innerHTML = ['all','upcoming','past'].map(function(f) {
            var active = _slFilter === f;
            var label = f === 'all' ? 'All' : f === 'upcoming' ? 'Upcoming' : 'Past';
            return '<button onclick="_slFilter=\'' + f + '\';loadSetlists()" style="font-size:0.72em;font-weight:' + (active ? '800' : '600') + ';padding:3px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (active ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + '">' + label + '</button>';
        }).join('');
    }

    if (data.length === 0) { container.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px"><div style="font-size:1.5em;margin-bottom:8px">\uD83D\uDCCB</div><div style="font-weight:600;margin-bottom:4px">No setlists yet</div><div style="font-size:0.85em;margin-bottom:12px">Build your first setlist for a rehearsal or gig.</div><button class="btn btn-primary" onclick="createNewSetlist()">+ Create Setlist</button></div>'; return; }

    var today = new Date().toISOString().split('T')[0];
    var upcoming = data.filter(function(sl) { return (sl.date || '') >= today; }).sort(function(a,b) { return (a.date || '').localeCompare(b.date || ''); });
    var past = data.filter(function(sl) { return (sl.date || '') < today && sl.date; }).sort(function(a,b) { return (b.date || '').localeCompare(a.date || ''); });
    var noDate = data.filter(function(sl) { return !sl.date; });

    // Apply filter
    if (_slFilter === 'upcoming') { past = []; noDate = []; }
    if (_slFilter === 'past') { upcoming = []; noDate = []; }

    var html = '';

    // Upcoming section
    if (upcoming.length > 0) {
        html += '<div style="margin-bottom:16px">'
            + '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;margin-bottom:6px">Upcoming</div>';
        upcoming.forEach(function(sl, i) {
            html += _slRenderCard(sl, i === 0);
        });
        html += '</div>';
    }

    // Recent (last 5 past)
    var recent = past.slice(0, 5);
    var archive = past.slice(5);
    if (recent.length > 0) {
        html += '<div style="margin-bottom:16px">'
            + '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Recent</div>';
        recent.forEach(function(sl) { html += _slRenderCard(sl, false); });
        html += '</div>';
    }

    // Archive (collapsed)
    if (archive.length > 0) {
        html += '<details style="margin-bottom:16px"><summary style="font-size:0.68em;font-weight:800;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase;cursor:pointer;padding:6px 0">Archive (' + archive.length + ' more)</summary>';
        archive.forEach(function(sl) { html += _slRenderCard(sl, false); });
        html += '</details>';
    }

    // No date
    if (noDate.length > 0) {
        html += '<div style="margin-bottom:16px">'
            + '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">No Date</div>';
        noDate.forEach(function(sl) { html += _slRenderCard(sl, false); });
        html += '</div>';
    }

    if (!html) html = '<div style="text-align:center;color:var(--text-dim);padding:20px">No setlists match this filter.</div>';
    container.innerHTML = html;
}

// Inject responsive setlist card CSS once
(function _slInjectCSS() {
    if (document.getElementById('slCardCSS')) return;
    var s = document.createElement('style');
    s.id = 'slCardCSS';
    s.textContent = [
        '.sl-card{padding:10px 14px;border-radius:8px;margin-bottom:6px;display:flex;align-items:flex-start;gap:10px}',
        '.sl-card-info{flex:1;min-width:0;overflow:hidden}',
        '.sl-card-info>div{display:block;line-height:1.4;word-break:normal;overflow-wrap:normal}',
        '.sl-card-title{font-weight:700;font-size:0.9em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.sl-card-meta{font-size:0.72em;color:var(--text-dim);margin-top:2px}',
        '.sl-card-preview{font-size:0.68em;color:var(--text-muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.sl-card-badge{font-size:0.6em;font-weight:800;letter-spacing:0.1em;color:#a5b4fc;text-transform:uppercase;margin-bottom:2px}',
        '.sl-card-actions{display:flex;gap:4px;flex-shrink:0;align-items:center;flex-wrap:wrap}',
        '.sl-card-actions button{font-size:0.72em;padding:4px 8px;border-radius:5px;cursor:pointer}',
        // Mobile: stack vertically
        '@media(max-width:600px){',
        '  .sl-card{flex-direction:column;gap:6px}',
        '  .sl-card-info{width:100%}',
        '  .sl-card-actions{width:100%;justify-content:flex-start;order:-1;margin-bottom:2px}',
        '  .sl-card-title{white-space:normal}',
        '}'
    ].join('\n');
    document.head.appendChild(s);
})();

function _slRenderCard(sl, isNext) {
    var songCount = (sl.sets || []).reduce(function(a,s) { return a + (s.songs || []).length; }, 0);
    var setCount = (sl.sets || []).length;
    var idx = sl._origIdx;

    var dateDisplay = _slFormatDate(sl.date, true);
    var dateLabel = _slCountdownLabel(sl.date);

    var preview = '';
    if (sl.sets && sl.sets[0] && sl.sets[0].songs && sl.sets[0].songs.length > 0) {
        var songs = sl.sets[0].songs;
        var shown = songs.slice(0, 4).map(function(sg) { return typeof sg === 'string' ? sg : (sg.title || ''); });
        var more = songs.length > 4 ? ' +' + (songs.length - 4) + ' more' : '';
        preview = shown.join(' \u00B7 ') + more;
    }

    var borderColor = isNext ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)';
    var bgColor = isNext ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)';

    return '<div class="sl-card" style="border:1px solid ' + borderColor + ';background:' + bgColor + '">'
        + '<div class="sl-card-info">'
        + (isNext ? '<div class="sl-card-badge">NEXT UP' + (dateLabel ? ' \u00B7 ' + dateLabel : '') + ' \u00B7 ' + dateDisplay + '</div>' : '')
        + '<div class="sl-card-title">' + (sl.locked ? '\uD83D\uDD12 ' : '') + (sl.name || 'Untitled') + '</div>'
        + '<div class="sl-card-meta">'
        + dateDisplay + ' \u00B7 ' + songCount + ' songs \u00B7 ' + setCount + ' set' + (setCount !== 1 ? 's' : '')
        + (!isNext && dateLabel ? ' \u00B7 ' + dateLabel : '')
        + '</div>'
        + (preview ? '<div class="sl-card-preview">' + preview + '</div>' : '')
        + '</div>'
        + '<div class="sl-card-actions">'
        + '<button onclick="editSetlist(' + idx + ')" style="font-size:0.75em;padding:5px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;font-weight:600" title="Open">\u25B6 Open</button>'
        + '<button onclick="slPlaySetlist(' + idx + ')" style="border:1px solid rgba(99,102,241,0.2);background:none;color:#818cf8;font-weight:600" title="Play">\uD83C\uDFA7</button>'
        + (sl.locked
            ? '<button style="border:1px solid rgba(255,255,255,0.06);background:none;color:#475569;opacity:0.3;cursor:not-allowed" title="Unlock to edit">\u270F\uFE0F</button>'
              + '<button onclick="slUnlockWithWarning(' + idx + ')" style="border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.05);color:#fbbf24;font-weight:600" title="Click to unlock">\uD83D\uDD12 Locked</button>'
            : '<button onclick="editSetlist(' + idx + ')" style="border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)" title="Edit">\u270F\uFE0F</button>'
              + '<button onclick="slToggleLock(' + idx + ')" style="border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.05);color:#22c55e;font-weight:600" title="Lock this setlist">\uD83D\uDD13 Unlocked</button>'
              + '<button onclick="deleteSetlist(' + idx + ')" style="border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b" title="Delete">\uD83D\uDDD1\uFE0F</button>')
        + '</div></div>';
}

async function exportSetlistToiPad(setlistIndex) {
    const allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    allSetlists.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const sl = allSetlists[setlistIndex];
    if (!sl) return;

    const allSongsList = typeof allSongs !== 'undefined' ? allSongs : (songs || []);
    const allTabs = {};

    // Gather all songs in this setlist
    const songTitles = [];
    (sl.sets || []).forEach(set => {
        (set.songs || []).forEach(item => {
            const title = typeof item === 'string' ? item : item.title;
            if (title && !songTitles.includes(title)) songTitles.push(title);
        });
    });

    // Load all personal tabs for each song in parallel
    await Promise.all(songTitles.map(async (title) => {
        allTabs[title] = await loadPersonalTabs(title) || [];
    }));

    // Build HTML document
    const memberColors = { drew: '#667eea', chris: '#10b981', brian: '#f59e0b', pierce: '#8b5cf6', jay: '#3b82f6' };
    const memberEmoji = { drew: '🎸', chris: '🎸', brian: '🎸', pierce: '🎹', jay: '🥁' };

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${sl.name || 'Setlist'} — GrooveLinx Crib Sheet</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; padding: 20px; }
  h1 { font-size: 1.6em; font-weight: 800; color: #818cf8; margin-bottom: 4px; }
  .meta { font-size: 0.85em; color: #94a3b8; margin-bottom: 24px; }
  .set-header { font-size: 1.1em; font-weight: 700; color: #10b981; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .song-block { background: #1e293b; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .song-title { font-size: 1.05em; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .song-number { background: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: 700; flex-shrink: 0; }
  .transition-arrow { color: #818cf8; font-weight: 700; margin-left: auto; }
  .member-refs { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-top: 8px; }
  .member-ref { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px 10px; }
  .member-name { font-size: 0.72em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .ref-link { font-size: 0.82em; color: #818cf8; text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .no-ref { font-size: 0.8em; color: #475569; font-style: italic; }
  .song-meta { font-size: 0.75em; color: #64748b; display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  @media print { body { background: white; color: black; } .song-block { background: #f8fafc; border-color: #e2e8f0; } }
  @media (max-width: 600px) { .member-refs { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<h1>📋 ${sl.name || 'Setlist'}</h1>
<div class="meta">📅 ${sl.date || 'Date TBD'} &nbsp;|&nbsp; 🏛️ ${sl.venue || 'Venue TBD'} &nbsp;|&nbsp; 🎵 ${songTitles.length} songs &nbsp;|&nbsp; Generated ${new Date().toLocaleDateString()}</div>
`;

    let songNumber = 0;
    for (const set of (sl.sets || [])) {
        html += `<div class="set-header">🎵 ${set.name || 'Set'}</div>`;
        for (const item of (set.songs || [])) {
            const title = typeof item === 'string' ? item : item.title;
            const isTransition = typeof item === 'object' && item.transition;
            songNumber++;
            const songData = allSongsList.find(s => s.title === title);
            const tabs = allTabs[title] || [];

            // Build member ref blocks
            const memberRefHTML = Object.entries(bandMembers).map(([key, member]) => {
                const memberTab = tabs.find(t => t.memberKey === key || (t.addedBy && t.addedBy.includes(key)));
                const color = memberColors[key] || '#94a3b8';
                const emoji = memberEmoji[key] || '👤';
                return `<div class="member-ref">
                    <div class="member-name" style="color:${color}">${emoji} ${member.name}</div>
                    ${memberTab ? `<a href="${memberTab.url}" class="ref-link">${memberTab.label || memberTab.notes || 'View Reference'}</a>` : '<span class="no-ref">No ref added</span>'}
                </div>`;
            }).join('');

            html += `<div class="song-block">
                <div class="song-title">
                    <span class="song-number">${songNumber}</span>
                    <span>${title}</span>
                    ${songData?.band ? `<span style="font-size:0.7em;color:#64748b;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:10px">${songData.band}</span>` : ''}
                    ${isTransition ? '<span class="transition-arrow">→</span>' : ''}
                </div>
                ${songData?.key || songData?.bpm ? `<div class="song-meta">${songData.key ? `🎵 Key: ${songData.key}` : ''}${songData.bpm ? ` &nbsp; ⚡ ${songData.bpm} BPM` : ''}</div>` : ''}
                <div class="member-refs">${memberRefHTML}</div>
            </div>`;
        }
    }

    html += `</body></html>`;

    // Open in new window
    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
    } else {
        // Fallback: download as HTML file
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(sl.name || 'setlist').replace(/[^a-z0-9]/gi, '_')}_crib_sheet.html`;
        a.click();
    }
}

async function createNewSetlist() {
    if (!requireSignIn()) return;
    if (typeof GLUXTracker !== 'undefined') GLUXTracker.startFlow('create_setlist');
    const container = document.getElementById('setlistsList');
    if (!container) return;
    window._slSets = [{ name: 'All Songs', songs: [] }];
    window._slSelectedVenueId = null;
    window._slSelectedVenueName = null;
    // Auto-generate name and date so user can focus on adding songs
    var _today = new Date().toISOString().split('T')[0];
    container.innerHTML = `<div class="app-card"><h3>New Setlist</h3>
        <div style="margin-bottom:12px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                <div style="flex:2;min-width:150px"><label class="form-label">Name</label><input class="app-input" id="slName" value="" placeholder="e.g. GrizzFest 2026, Friday Rehearsal, Acoustic Set" title="Name your setlist by event, date, or theme"></div>
                <div style="flex:1;min-width:120px"><label class="form-label">Date</label><input class="app-input" id="slDate" type="date" value="${_today}" style="color-scheme:dark"></div>
            </div>
            <details style="font-size:0.82em;color:var(--text-dim)"><summary style="cursor:pointer;padding:4px 0">More options</summary>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
                    <div style="flex:1;min-width:120px"><label class="form-label">Venue</label><div id="slVenuePicker"></div></div>
                    <div style="flex:1;min-width:120px"><label class="form-label">Notes</label><input class="app-input" id="slNotes" placeholder="e.g. Theme, special requests..." title="Notes saved with this setlist"></div>
                </div>
            </details>
        </div>
        <div id="slQuickFillSection" style="margin-bottom:12px;padding:14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:12px;text-align:center">
            <div style="font-size:0.88em;font-weight:700;color:#a5b4fc;margin-bottom:6px">Pick songs for your setlist</div>
            <button onclick="slQuickFill()" style="padding:12px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.92em;cursor:pointer;box-shadow:0 2px 10px rgba(99,102,241,0.3)">🎵 Choose Songs</button>
            <div style="font-size:0.72em;color:#475569;margin-top:6px">or type song names in the search below</div>
        </div>
        <div id="slSets"><div class="app-card" style="background:rgba(255,255,255,0.02)"><h3 style="color:var(--accent-light)">All Songs</h3><div id="slSet0Songs"></div><div style="margin-top:8px"><div style="display:flex;gap:6px;margin-bottom:4px"><input class="app-input" id="slAddSong0" placeholder="Type song name..." oninput="slSearchSong(this,0)" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(0)" style="flex-shrink:0;white-space:nowrap" title="Pick songs from library">📋 Pick</button><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="flex-shrink:0;white-space:nowrap" title="Toggle: show only gig-ready/active songs, or all songs">⚡ All Songs</button></div><div id="slSongResults0"></div></div></div></div>
        <div id="slShowTotal" style="margin-top:8px;padding:8px 12px;border-radius:8px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);font-size:0.75em;color:var(--text-dim)"></div>
        <div style="height:60px"></div></div>
        <div id="slStickyFooter" style="position:sticky;bottom:0;z-index:100;padding:12px 16px;background:linear-gradient(to top,#0f172a 60%,transparent);display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-success" onclick="slSaveSetlist()" style="padding:12px 24px;font-weight:700;font-size:0.92em;box-shadow:0 4px 16px rgba(34,197,94,0.3)">💾 Save Setlist</button>
        </div>`;
    _slInitVenuePicker(await GLStore.getVenues(), null);
}

var _slOnlyActive = false; // Pierce filter: show only prospect/wip/gig_ready songs
var _slPickerShowLibrary = false; // When true, song picker shows inactive/shelved songs too

function slToggleActiveFilter(btn) {
    _slOnlyActive = !_slOnlyActive;
    btn.style.background = _slOnlyActive ? 'var(--accent)' : 'rgba(255,255,255,0.06)';
    btn.style.color = _slOnlyActive ? 'white' : 'var(--text-muted)';
    btn.textContent = _slOnlyActive ? '⚡ Active Only' : '⚡ All Songs';
}

// Quick Fill: auto-populate setlist with active songs (highest readiness first)
function slQuickFill() {
    if (!window._slSets[0]) window._slSets[0] = { name: 'All Songs', songs: [] };
    var songSource = (typeof GLStore !== 'undefined' && GLStore.getSongs) ? GLStore.getSongs() : (typeof allSongs !== 'undefined' ? allSongs : []);
    if (songSource.length > 0) {
        // Band has songs — open the picker
        _slOnlyActive = true;
        slOpenSongPicker(0);
    } else {
        // Empty library — focus the search input so user can type song names
        var input = document.getElementById('slAddSong0');
        if (input) { input.focus(); input.placeholder = 'Type a song name to add it...'; }
        if (typeof showToast === 'function') showToast('Type song names below — they\'ll be added to your library automatically', 4000);
    }
    // Hide the quick fill section
    var qf = document.getElementById('slQuickFillSection');
    if (qf) qf.style.display = 'none';
}
window.slQuickFill = slQuickFill;

function slSearchSong(input, setIdx) {
    const q = input.value.toLowerCase();
    const results = document.getElementById('slSongResults' + setIdx);
    if (!results || q.length < 2) { if(results) results.innerHTML=''; return; }
    const _activeStatuses = ['prospect','wip','gig_ready'];
    const songSource = (typeof GLStore !== 'undefined' && GLStore.getSongs) ? GLStore.getSongs() : (typeof allSongs !== 'undefined' ? allSongs : []);
    const matches = songSource
        .filter(s => s.title.toLowerCase().includes(q))
        .filter(s => !_slOnlyActive || _activeStatuses.includes(GLStore && GLStore.getStatus(s.title)))
        .slice(0, 10);
    var html = matches.map(s => `<div class="list-item" style="cursor:pointer;padding:8px 10px;font-size:0.85em" data-title="${s.title.replace(/"/g,'&quot;')}" data-setidx="${setIdx}" onmousedown="event.preventDefault();slAddSongToSet(${setIdx},this.dataset.title)" ontouchstart="slAddSongToSet(${setIdx},this.dataset.title)">
        <span style="color:var(--text-dim);font-size:0.8em;width:30px">${s.band||''}</span> ${s.title}</div>`).join('');
    // Always show "Add as new song" option — allows implicit song creation
    var exactMatch = matches.some(s => s.title.toLowerCase() === q);
    if (!exactMatch && input.value.trim().length >= 2) {
        var safeVal = input.value.trim().replace(/"/g, '&quot;').replace(/</g, '&lt;');
        html += '<div class="list-item" style="cursor:pointer;padding:10px;font-size:0.85em;color:#818cf8;border-top:1px solid rgba(255,255,255,0.06)" onmousedown="event.preventDefault();slAddNewSongToSet(' + setIdx + ')" ontouchstart="slAddNewSongToSet(' + setIdx + ')">+ Add &quot;' + safeVal + '&quot; as new song</div>';
    }
    results.innerHTML = html;
}

function slAddNewSongToSet(setIdx) {
    var input = document.getElementById('slAddSong' + setIdx);
    if (!input || !input.value.trim()) return;
    var title = input.value.trim();
    slAddSongToSet(setIdx, title);
}
window.slAddNewSongToSet = slAddNewSongToSet;

function slAddSongToSet(setIdx, title) {
    if (!requireSignIn()) return;
    if (!window._slSets[setIdx]) window._slSets[setIdx] = { songs: [] };
    window._slSets[setIdx].songs.push({title: title, segue: 'stop'});
    // Auto-create song record in band library if it doesn't exist
    if (typeof ensureBandSong === 'function') ensureBandSong(title);
    if (typeof _slMarkDirty === 'function') _slMarkDirty();
    slRenderSetSongs(setIdx);
    document.getElementById('slAddSong' + setIdx).value = '';
    document.getElementById('slSongResults' + setIdx).innerHTML = '';
}

// Duration estimate: 6 min/song default
// Calculate total runtime in seconds for a set's songs
function _slSetRuntimeSec(songs) {
    if (!songs || !songs.length) return 0;
    var total = 0;
    for (var i = 0; i < songs.length; i++) {
        var title = typeof songs[i] === 'string' ? songs[i] : (songs[i].title || '');
        total += (typeof getSongRuntimeSec === 'function') ? getSongRuntimeSec(title) : 360;
    }
    return total;
}

function _slDurationLabel(songs) {
    // Accept either a songs array or a plain count (backward compat)
    if (typeof songs === 'number') {
        var mins = songs * 6;
        if (mins >= 60) return Math.floor(mins / 60) + 'h ' + (mins % 60 ? mins % 60 + 'min' : '');
        return mins + ' min';
    }
    var sec = _slSetRuntimeSec(songs);
    return (typeof formatRuntimeSec === 'function') ? formatRuntimeSec(sec) : Math.round(sec / 60) + ' min';
}

function slRenderSetSongs(setIdx) {
    const el = document.getElementById('slSet' + setIdx + 'Songs');
    if (!el) return;
    const items = window._slSets[setIdx]?.songs || [];
    const allSongsList = (typeof allSongs !== 'undefined' ? allSongs : songs || []);
    var rows = items.map((item, i) => {
        const s = typeof item === 'string' ? item : item.title;
        const segue = typeof item === 'object' ? (item.segue || 'stop') : 'stop';
        const songData = allSongsList.find(sd => sd.title === s);
        const keyStr = songData?.key ? `<span style="font-size:0.7em;color:#818cf8;background:rgba(129,140,248,0.12);padding:1px 5px;border-radius:4px;border:1px solid rgba(129,140,248,0.2)">${songData.key}</span>` : '';
        const bpmStr = songData?.bpm ? `<span style="font-size:0.7em;color:#94a3b8">\u26a1${songData.bpm}</span>` : '';
        const segueColor = { stop:'#64748b', flow:'#818cf8', segue:'#34d399', cutoff:'#f87171' }[segue] || '#64748b';
        const histTip = typeof getSongHistoryTooltip === 'function' ? getSongHistoryTooltip(s) : '';
        var row = `<div class="list-item sl-song-row" data-set="${setIdx}" data-idx="${i}" draggable="true"
            style="padding:3px 6px;font-size:0.82em;gap:4px;align-items:center;cursor:default;min-height:28px" title="${histTip.replace(/"/g,'&quot;')}">
            <span style="color:#475569;cursor:grab;font-size:0.9em;flex-shrink:0">\u2807</span>
            <span style="color:var(--text-dim);min-width:16px;font-weight:600;flex-shrink:0;font-size:0.85em">${i + 1}</span>
            <span style="flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s}</span>
            ${keyStr}${bpmStr}
            <select onchange="_slMarkDirty();slSetSegue(${setIdx},${i},this.value)" onclick="event.stopPropagation()"
                title="Transition: · = Full Stop, → = Flow into next, ~ = Segue/blend, | = Hard cutoff"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:${segueColor};border-radius:4px;padding:1px 3px;font-size:0.72em;font-weight:700;cursor:pointer;flex-shrink:0">
                <option value="stop" ${segue==='stop'?'selected':''} title="Full stop between songs">·</option>
                <option value="flow" ${segue==='flow'?'selected':''} title="Flow directly into next song">→</option>
                <option value="segue" ${segue==='segue'?'selected':''} title="Segue / blend into next">~</option>
                <option value="cutoff" ${segue==='cutoff'?'selected':''} title="Hard cutoff">|</option>
            </select>
            <button class="btn btn-sm btn-ghost" onclick="_slMarkDirty();slRemoveSong(${setIdx},${i})" style="padding:1px 4px;flex-shrink:0;font-size:0.82em">\u2715</button>
        </div>`;
        // Insert Set Break button between songs — always subtly visible
        if (i < items.length - 1) {
            row += `<div style="text-align:center;height:0;overflow:visible;position:relative"><button onclick="slInsertSetBreak(${setIdx},${i + 1})" style="font-size:0.5em;padding:0 6px;border:1px dashed rgba(245,158,11,0.2);background:rgba(15,23,42,0.95);color:#64748b;border-radius:3px;cursor:pointer;opacity:0.3;transition:opacity 0.15s;position:relative;top:-5px;z-index:1;line-height:1.4" onmouseover="this.style.opacity='1';this.style.color='#fbbf24'" onmouseout="this.style.opacity='0.3';this.style.color='#64748b'">✂ set break</button></div>`;
        }
        return row;
    }).join('');
    el.innerHTML = rows;
    el.querySelectorAll('.sl-song-row').forEach(row => {
        row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', row.dataset.idx); row.style.opacity='0.4'; });
        row.addEventListener('dragend', e => { row.style.opacity='1'; });
        row.addEventListener('dragover', e => { e.preventDefault(); row.style.background='rgba(102,126,234,0.12)'; });
        row.addEventListener('dragleave', e => { row.style.background=''; });
        row.addEventListener('drop', e => {
            e.preventDefault(); row.style.background='';
            const from=parseInt(e.dataTransfer.getData('text/plain')), to=parseInt(row.dataset.idx);
            if(from===to)return;
            const songs=window._slSets[setIdx].songs;
            const [moved]=songs.splice(from,1); songs.splice(to,0,moved);
            if (typeof _slMarkDirty === 'function') _slMarkDirty();
            slRenderSetSongs(setIdx);
        });
    });
    _slUpdateShowTotal();
}

// Band Readiness Meter for setlist
async function slRenderReadinessMeter() {
    var container = document.getElementById('slReadinessMeter');
    if (!container) return;
    await preloadReadinessCache();
    var allTitles = [];
    (window._slSets || []).forEach(function(set) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : item.title;
            if (t) allTitles.push(t);
        });
    });
    if (!allTitles.length) { container.innerHTML = ''; return; }
    var songRows = allTitles.map(function(title) {
        var scores = (GLStore ? GLStore.getAllReadiness() : readinessCache || {})[title] || {};
        var vals = BAND_MEMBERS_ORDERED.map(function(m) { return scores[m.key] || 0; }).filter(Boolean);
        var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : 0;
        return { title: title, avg: avg, color: avg ? readinessColor(Math.round(avg)) : '#334155', scores: scores };
    });
    var locked   = songRows.filter(function(s){return s.avg>=4;}).length;
    var unrated  = songRows.filter(function(s){return s.avg===0;}).length;
    var inProg   = songRows.length - locked - unrated;
    var pct      = songRows.length ? Math.round(locked/songRows.length*100) : 0;
    var mc       = pct>=80?'#22c55e':pct>=50?'#f59e0b':'#ef4444';
    var html = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    html += '<span style="font-weight:700;font-size:0.9em">🎯 Band Readiness</span>';
    html += '<span style="font-size:1.1em;font-weight:800;color:'+mc+'">'+pct+'%</span></div>';
    html += '<div style="height:8px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden;margin-bottom:10px">';
    html += '<div style="height:100%;width:'+pct+'%;background:'+mc+';border-radius:4px;transition:width 0.4s ease"></div></div>';
    html += '<div style="display:flex;gap:14px;font-size:0.75em;margin-bottom:10px">';
    html += '<span style="color:#22c55e">🔒 '+locked+' locked</span>';
    html += '<span style="color:#f59e0b">🔧 '+inProg+' in progress</span>';
    html += '<span style="color:#64748b">❓ '+unrated+' unrated</span></div>';
    html += '<div style="display:flex;flex-direction:column;gap:5px">';
    songRows.forEach(function(s) {
        var pctS = s.avg ? Math.round(s.avg/5*100) : 0;
        var dots = BAND_MEMBERS_ORDERED.map(function(m) {
            var sc = s.scores[m.key]||0;
            var c = sc ? readinessColor(sc) : 'rgba(255,255,255,0.1)';
            return '<span title="'+m.name+': '+( sc||'?' )+'/5" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c+'"></span>';
        }).join('');
        html += '<div style="display:flex;align-items:center;gap:6px">';
        html += '<span style="font-size:0.72em;color:#94a3b8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+s.title+'</span>';
        html += '<div style="display:flex;gap:2px;flex-shrink:0">'+dots+'</div>';
        html += '<div style="width:40px;height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden;flex-shrink:0">';
        html += '<div style="height:100%;width:'+pctS+'%;background:'+s.color+';border-radius:2px"></div></div></div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
}

// Song Voting for setlist
async function slVoteSong(setlistIdx, songTitle, vote) {
    var memberKey = getCurrentMemberReadinessKey();
    if (!memberKey) { showToast('Sign in to vote'); return; }
    var safe = sanitizeFirebasePath(songTitle);
    var path = bandPath('setlist_votes/'+setlistIdx+'/'+safe+'/'+memberKey);
    try {
        var snap = await firebaseDB.ref(path).once('value');
        if (snap.val() === vote) { await firebaseDB.ref(path).remove(); }
        else { await firebaseDB.ref(path).set(vote); }
        slRefreshVotesForSong(setlistIdx, songTitle);
    } catch(e) { showToast('Could not save vote'); }
}

async function slRefreshVotesForSong(setlistIdx, songTitle) {
    var safe = sanitizeFirebasePath(songTitle);
    var myKey = getCurrentMemberReadinessKey();
    try {
        var snap = await firebaseDB.ref(bandPath('setlist_votes/'+setlistIdx+'/'+safe)).once('value');
        var votes = snap.val() || {};
        var ups = Object.values(votes).filter(function(v){return v===1;}).length;
        var downs = Object.values(votes).filter(function(v){return v===-1;}).length;
        var myVote = myKey?(votes[myKey]||0):0;
        var safeId = safe.replace(/[^a-zA-Z0-9]/g,'_');
        var el = document.getElementById('slvote_'+safeId);
        if (el) el.innerHTML = _slVoteBtns(setlistIdx, songTitle, ups, downs, myVote);
    } catch(e) {}
}

function _slVoteBtns(idx, title, ups, downs, myVote) {
    var st = JSON.stringify(title);
    var upOn = myVote===1;
    var dnOn = myVote===-1;
    var upS = upOn?'background:rgba(34,197,94,0.25);color:#86efac;border-color:rgba(34,197,94,0.5)':'background:rgba(255,255,255,0.04);color:#64748b;border-color:rgba(255,255,255,0.1)';
    var dnS = dnOn?'background:rgba(239,68,68,0.2);color:#fca5a5;border-color:rgba(239,68,68,0.4)':'background:rgba(255,255,255,0.04);color:#64748b;border-color:rgba(255,255,255,0.1)';
    return '<button onclick="event.stopPropagation();slVoteSong('+idx+','+st+',1)" style="border:1px solid;border-radius:5px;padding:1px 6px;font-size:0.7em;cursor:pointer;'+upS+'">👍'+(ups?ups:'')+'</button>'+           '<button onclick="event.stopPropagation();slVoteSong('+idx+','+st+',-1)" style="border:1px solid;border-radius:5px;padding:1px 6px;font-size:0.7em;cursor:pointer;margin-left:3px;'+dnS+'">👎'+(downs?downs:'')+'</button>';
}

async function slEnrichKeyBpm() {
    // Fetch key+BPM for any song in the current sets that's missing them
    if (!window._slSets) return;
    var allTitles = [];
    window._slSets.forEach(function(set) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : item.title;
            if (t) allTitles.push(t);
        });
    });
    var allSongsList = (typeof allSongs !== 'undefined' ? allSongs : []);
    var toFetch = allTitles.filter(function(t) {
        var sd = allSongsList.find(function(s) { return s.title === t; });
        return !sd || (!sd.key && !sd.bpm);
    });
    if (!toFetch.length) return;
    await Promise.all(toFetch.map(async function(title) {
        try {
            var keyData = await loadBandDataFromDrive(title, 'key').catch(function(){return null;});
            if (!keyData || !keyData.key) keyData = await loadBandDataFromDrive(title, 'song_key').catch(function(){return null;});
            var bpmData = await loadBandDataFromDrive(title, 'song_bpm').catch(function(){return null;});
            var sd = allSongsList.find(function(s) { return s.title === title; });
            if (sd) {
                if (keyData && keyData.key) sd.key = keyData.key;
                if (bpmData && bpmData.bpm) sd.bpm = bpmData.bpm;
            }
        } catch(e) {}
    }));
    // Re-render all sets now that we have key/bpm
    window._slSets.forEach(function(_, si) { slRenderSetSongs(si); });
    slRenderReadinessMeter();
    var _vIdx = window._slEditIdx;
    if (_vIdx !== undefined) {
        (window._slSets||[]).forEach(function(set){
            (set.songs||[]).forEach(function(item){
                var t = typeof item==='string'?item:item.title;
                if(t) slRefreshVotesForSong(_vIdx, t);
            });
        });
    }
}

function slSetSegue(setIdx, songIdx, segueType) {
    const items = window._slSets[setIdx]?.songs;
    if (!items || items[songIdx] === undefined) return;
    if (typeof items[songIdx] === 'string') items[songIdx] = { title: items[songIdx], segue: segueType };
    else items[songIdx].segue = segueType;
}

function slToggleTransition(setIdx, songIdx) {
    const items = window._slSets[setIdx]?.songs;
    if (!items || !items[songIdx]) return;
    if (typeof items[songIdx] === 'string') items[songIdx] = { title: items[songIdx], segue: 'flow' };
    else items[songIdx].segue = items[songIdx].segue === 'flow' ? 'stop' : 'flow';
    slRenderSetSongs(setIdx);
}

function slRemoveSong(setIdx, songIdx) {
    window._slSets[setIdx]?.songs.splice(songIdx, 1);
    slRenderSetSongs(setIdx);
}

let _slSetCount = 1;
function slAddSet(type) {
    if (!requireSignIn()) return;
    const name = type === 'encore' ? 'Encore' : type === 'soundcheck' ? '🔊 Soundcheck' : ('Set ' + (++_slSetCount));
    window._slSets.push({ name, songs: [] });
    const idx = window._slSets.length - 1;
    const color = type === 'encore' ? 'var(--yellow)' : type === 'soundcheck' ? 'var(--green)' : 'var(--accent-light)';
    const setsEl = document.getElementById('slSets');
    setsEl.insertAdjacentHTML('beforeend', `
        <div class="app-card" style="background:rgba(255,255,255,0.02)">
            <h3 style="color:${color}">${name}</h3>
            <div id="slSet${idx}Songs"></div>
            <div style="margin-top:8px"><div style="display:flex;gap:6px;margin-bottom:4px"><input class="app-input" id="slAddSong${idx}" placeholder="Type song name..." oninput="slSearchSong(this,${idx})" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(${idx})" style="flex-shrink:0;white-space:nowrap" title="Pick songs from library">📋 Pick</button><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="flex-shrink:0;white-space:nowrap" title="Toggle: show only gig-ready/active songs, or all songs">⚡ All Songs</button></div><div id="slSongResults${idx}"></div></div>
        </div>`);
}

async function slSaveSetlist() {
    if (!requireSignIn()) return;
    const sl = {
        setlistId: generateShortId(12),
        gigId: null,
        name: document.getElementById('slName')?.value || ('Setlist ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        date: document.getElementById('slDate')?.value || '',
        venueId: window._slSelectedVenueId || null,
        venue: window._slSelectedVenueName || '',
        notes: document.getElementById('slNotes')?.value || '',
        sets: window._slSets || [],
        created: new Date().toISOString()
    };
    const existing = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    existing.push(sl);
    var saved = false;
    try {
        saved = await saveBandDataToDrive('_band', 'setlists', existing);
    } catch(e) {
        console.log('[Setlist] Save error:', e.message || e);
    }
    if (saved === false) {
        // Data is in localStorage via saveBandDataToDrive's first line — show soft warning
        showToast('⚠️ Saved locally — will sync when connected');
    } else {
        showToast('✅ Setlist saved');
    }
    if (typeof GLUXTracker !== 'undefined') GLUXTracker.completeFlow('create_setlist');
    // Onboarding: mark setlist step complete + navigate to Home for Step 2
    var _wasOnboarding = typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getOnboardStep && GLAvatarGuide.getOnboardStep() === 1;
    if (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.completeOnboardStep) GLAvatarGuide.completeOnboardStep('setlist');
    if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
    else { window._cachedSetlists = null; window._glCachedSetlists = null; }
    if (_wasOnboarding && typeof showPage === 'function') {
        setTimeout(function() { showPage('home'); }, 800);
    } else {
        loadSetlists();
    }
}

async function editSetlist(idx) {
    window._slEditIdx = idx;
    const data = window._cachedSetlists || toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    const sl = data[idx];
    if (!sl) { alert('Setlist not found'); return; }
    
    window._slSets = sl.sets || [{ name: 'Set 1', songs: [] }];
    window._slEditIndex = idx;
    window._slIsLocked = !!sl.locked;
    _slSetCount = window._slSets.length;
    window._slSelectedVenueId = sl.venueId || null;
    window._slSelectedVenueName = sl.venue || null;

    const container = document.getElementById('setlistsList');
    var safeName = (sl.name||'').replace(/"/g,'&quot;');
    var safeNotes = (sl.notes||'').replace(/"/g,'&quot;');
    container.innerHTML = '<div class="app-card" style="padding:10px 14px">'
        // Compact header: row 1 = name + date + venue, row 2 = gig chip + notes
        + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">'
        + '<input class="app-input" id="slName" value="' + safeName + '" placeholder="Setlist name" style="flex:2;min-width:120px;font-weight:700;font-size:0.9em;padding:5px 8px">'
        + '<input class="app-input" id="slDate" type="date" value="' + (sl.date||'') + '" style="width:130px;padding:5px 8px;font-size:0.82em;box-sizing:border-box;color-scheme:dark">'
        + '<div id="slVenuePicker" style="flex:1;min-width:100px"></div>'
        + '</div>'
        + (sl.locked ? '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;margin-bottom:8px;font-size:0.78em;color:#fbbf24"><span>🔒 This setlist is locked' + (sl.lockedBy ? ' by ' + _slMemberName(sl.lockedBy) : '') + '. Editing is view-only until unlocked.</span><button onclick="slUnlockWithWarning(' + idx + ')" style="margin-left:auto;padding:3px 10px;background:none;border:1px solid rgba(245,158,11,0.4);color:#fbbf24;border-radius:6px;cursor:pointer;font-size:0.88em;font-weight:600;white-space:nowrap">🔓 Unlock</button></div>' : '')
        + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">'
        + '<div id="slLinkedGigRow" style="flex-shrink:0"></div>'
        + '<input class="app-input" id="slNotes" value="' + safeNotes + '" placeholder="Notes..." style="flex:1;font-size:0.78em;padding:4px 8px;color:var(--text-dim)">'
        + '</div>'
        + '<div id="slReadinessMeter" style="margin-bottom:6px"></div>'
        // Persistent sticky save bar (desktop: top sticky, mobile: bottom fixed)
        + '<div id="slStickyActions" style="position:sticky;top:0;z-index:10;background:#1e293b;padding:6px 0;margin:0 -14px;padding-left:14px;padding-right:14px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
        + '<button class="btn btn-ghost btn-sm" onclick="slShareSetlist(' + idx + ')" style="color:#94a3b8;font-size:0.75em">📤</button>'
        + '<span id="slDirtyIndicator" style="display:none;font-size:0.68em;color:#f59e0b;font-weight:700;margin-left:auto">● Unsaved</span>'
        + '<button class="btn btn-success btn-sm" onclick="slSaveSetlistEdit(' + idx + ')" style="margin-left:auto;font-size:0.78em;padding:4px 14px">💾 Save</button>'
        + '<button class="btn btn-ghost btn-sm" onclick="loadSetlists()" style="font-size:0.75em">Cancel</button>'
        + '</div>'
        // Sets
        + '<div id="slSets">' + window._slSets.map(function(set, si) {
            var setSongs = set.songs || [];
            var setCount = setSongs.length;
            var durLabel = setCount ? ' · ' + setCount + ' songs · ~' + _slDurationLabel(setSongs) : '';
            var setActions = '';
            if (si > 0) {
                setActions = '<div style="margin-left:auto;display:flex;gap:3px">'
                    + '<button onclick="slMoveSetUp(' + si + ')" style="padding:1px 6px;background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:4px;cursor:pointer;font-size:0.58em;font-weight:600" title="Move this set up">↑</button>'
                    + '<button onclick="slMergeSets(' + si + ')" style="padding:1px 6px;background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:4px;cursor:pointer;font-size:0.58em;font-weight:600" title="Merge into previous set">Merge ↑</button>'
                    + '</div>';
            }
            return '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">'
                + '<div style="display:flex;align-items:center;font-size:0.78em;font-weight:700;color:var(--accent-light);margin-bottom:4px"><span onclick="slRenameSet(' + si + ')" style="cursor:pointer;border-bottom:1px dashed rgba(255,255,255,0.15)" title="Click to rename">' + (set.name || 'Set ' + (si+1)) + '</span><span style="font-weight:400;color:var(--text-dim);font-size:0.88em">' + durLabel + '</span>' + setActions + '</div>'
                + '<div id="slSet' + si + 'Songs"></div>'
                + '<div style="margin-top:4px"><div style="display:flex;gap:4px"><input class="app-input" id="slAddSong' + si + '" placeholder="Add song..." oninput="slSearchSong(this,' + si + ')" style="flex:1;font-size:0.78em;padding:4px 6px"><button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(' + si + ')" style="font-size:0.68em;flex-shrink:0" title="Pick songs from library">📋 Pick</button><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="font-size:0.68em;flex-shrink:0">All</button></div><div id="slSongResults' + si + '"></div></div>'
                + '</div>';
        }).join('') + '</div>'
        // Mobile bottom save bar
        + '<div id="slShowTotal" style="margin-top:10px;padding:8px 12px;border-radius:8px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);font-size:0.75em;color:var(--text-dim);display:flex;align-items:center;justify-content:space-between"></div>'
        + '<div id="slMobileSaveBar" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:9998;background:rgba(15,23,42,0.97);border-top:1px solid rgba(99,102,241,0.3);padding:10px 16px;gap:8px">'
        + '<button class="btn btn-ghost" onclick="loadSetlists()" style="flex:1;font-size:0.82em">Cancel</button>'
        + '<button class="btn btn-success" onclick="slSaveSetlistEdit(' + idx + ')" style="flex:2;font-size:0.88em;font-weight:700">💾 Save Changes</button>'
        + '</div>'
        + '</div>';
    // Show mobile save bar on small screens
    if (window.innerWidth <= 768) {
        var mBar = document.getElementById('slMobileSaveBar');
        if (mBar) mBar.style.display = 'flex';
    }
    
    // Init venue picker for edit form
    var slVenues = await GLStore.getVenues();
    var slPreselected = null;
    if (sl.venueId) slPreselected = slVenues.find(function(v){ return v.venueId === sl.venueId; });
    if (!slPreselected && sl.venue) slPreselected = slVenues.find(function(v){ return v.name === sl.venue; });
    _slInitVenuePicker(slVenues, slPreselected);

    // Render existing songs in each set
    window._slSets.forEach((set, si) => slRenderSetSongs(si));
    _slUpdateShowTotal();
    slEnrichKeyBpm();
    (async function() {
        var row = document.getElementById("slLinkedGigRow");
        if (!row) return;
        try {
            var gigs = toArray(await loadBandDataFromDrive("_band", "gigs") || []);
            // Match by gigId first (stable), fallback to date match (legacy compat)
            var match = null;
            if (sl.gigId) {
                match = gigs.find(function(g){ return g.gigId === sl.gigId; });
            }
            if (!match && sl.date) {
                match = gigs.find(function(g){ return g.date === sl.date; });
            }
            if (match) {
                var gigIdx = gigs.indexOf(match);
                var label = match.title || match.venue || "Gig";
                var html = '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(99,102,241,0.12);border-radius:8px;font-size:0.85em">';
                html += '<span style="color:var(--accent-light)">🎤 Linked Gig:</span>';
                html += '<span style="color:#fff;font-weight:600">' + label + '</span>';
                html += '<button onclick="showPage(\'gigs\');setTimeout(function(){editGig(' + gigIdx + ');},400);" style="margin-left:auto;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.82em;cursor:pointer">Open →</button></div>';
                // Venue mismatch info bar — only when both have venueId and they differ
                if (sl.venueId && match.venueId && sl.venueId !== match.venueId) {
                    html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;margin-top:6px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;font-size:0.8em;color:#fbbf24">'
                        + '<span>This setlist\'s venue differs from its linked gig.</span></div>';
                }
                row.innerHTML = html;
            }
        } catch(e) {}
    })();
}

function slShareSetlist(idx) {
    var sl = (window._slSets !== undefined) ? null : null; // loaded below
    // Load from Firebase and show share modal
    loadBandDataFromDrive('_band', 'setlists').then(function(setlists) {
        setlists = toArray(setlists||[]);
        var sl = setlists[idx];
        if (!sl) { showToast('Setlist not found'); return; }
        _slShowShareModal(sl, idx);
    });
}

function _slShowShareModal(sl, idx) {
    var existing = document.getElementById('slShareModal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'slShareModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center';
    var name = sl.name || 'Untitled Setlist';
    var date = sl.date || '';
    // Build text version
    var lines = [name + (date?' — '+date:''), ''];
    (sl.sets||[]).forEach(function(set, si) {
        lines.push((set.name||'Set '+(si+1)).toUpperCase());
        (set.songs||[]).forEach(function(item, i) {
            var t = typeof item==='string'?item:item.title;
            var key = typeof item==='object'&&item.key?' ['+item.key+']':'';
            var seg = typeof item==='object'&&item.segue&&item.segue!=='stop'?' →':'';
            lines.push('  '+(i+1)+'. '+t+key+seg);
        });
        lines.push('');
    });
    lines.push('Generated by GrooveLinx');
    var textContent = lines.join('\n');
    modal.innerHTML = '<div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:80vh;overflow-y:auto">';
    modal.innerHTML += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    modal.innerHTML += '<div style="font-weight:800;font-size:1em">📤 Share Setlist</div>';
    modal.innerHTML += '<button onclick="document.getElementById(\'slShareModal\').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1em">×</button></div>';
    modal.innerHTML += '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;font-family:monospace;font-size:0.78em;color:#94a3b8;white-space:pre-wrap;max-height:200px;overflow-y:auto;margin-bottom:14px" id="slShareTextPreview">' + textContent.replace(/</g,'&lt;') + '</div>';
    modal.innerHTML += '<div style="display:flex;flex-direction:column;gap:8px">';
    modal.innerHTML += '<button onclick="slShareCopyText()" style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.35);color:#a5b4fc;padding:10px;border-radius:10px;font-size:0.88em;font-weight:700;cursor:pointer">📋 Copy as Text</button>';
    modal.innerHTML += '<div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:8px;margin-top:4px">';
    modal.innerHTML += '<div style="font-size:0.7em;font-weight:700;color:#f59e0b;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">🪂 Parachute — Emergency Backups</div>';
    modal.innerHTML += '<button onclick="parachutePrint('+idx+')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;padding:10px;border-radius:10px;font-size:0.88em;font-weight:700;cursor:pointer;width:100%;text-align:left">🖨️ Print / PDF all charts (Kinkos ready)</button>';
    modal.innerHTML += '<button onclick="parachuteEmail('+idx+')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">📧 Email gig pack to myself</button>';
    modal.innerHTML += '<button onclick="parachutePublicUrl('+idx+')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">🔗 Copy public link (no login needed)</button>';
    modal.innerHTML += '<button onclick="parachuteCacheOffline('+idx+')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">💾 Cache offline (survives no WiFi)</button>';
    var _op = localStorage.getItem('deadcetera_offline_gigpack');
    if (_op) { try { var _opd = JSON.parse(_op); modal.innerHTML += '<button onclick="parachuteOpenOfflinePack()" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer;width:100%;text-align:left;margin-top:6px">📂 Open cached pack: \''+(_opd.name||'?')+"\' ("+new Date(_opd.cachedAt).toLocaleDateString()+')</button>'; } catch(e) {} }
    modal.innerHTML += '</div></div></div>';
    modal.innerHTML += '</div></div>';
    // Store text for copy fn
    modal.dataset.text = textContent;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function slShareCopyText() {
    var modal = document.getElementById('slShareModal');
    var text = modal ? modal.dataset.text : '';
    if (!text) return;
    navigator.clipboard.writeText(text).then(function() {
        showToast('📋 Copied to clipboard!');
    }).catch(function() {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        ta.remove();
        showToast('📋 Copied!');
    });
}

async function slSharePrint(idx) {
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var sl = setlists[idx];
    if (!sl) return;
    var name = sl.name || 'Setlist';
    var date = sl.date || '';
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + name + '</title>';
    html += '<style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;padding:0 20px;color:#111}h1{font-size:1.6em;margin-bottom:4px}';
    html += '.meta{color:#666;font-size:0.85em;margin-bottom:24px}.set-header{font-size:0.75em;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#888;border-bottom:1px solid #ddd;padding-bottom:4px;margin:20px 0 10px}';
    html += '.song{display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px solid #f0f0f0}.num{color:#999;min-width:24px;font-size:0.85em}.title{flex:1;font-size:1em}.chip{font-size:0.72em;color:#666;background:#f5f5f5;padding:1px 6px;border-radius:4px}';
    html += '.footer{margin-top:32px;font-size:0.75em;color:#aaa;text-align:center}@media print{.footer{position:fixed;bottom:20px;width:100%}}</style></head><body>';
    html += '<h1>' + name + '</h1>';
    html += '<div class="meta">' + (date?date+' · ':'')+'GrooveLinx</div>';
    (sl.sets||[]).forEach(function(set, si) {
        html += '<div class="set-header">' + (set.name||'Set '+(si+1)) + '</div>';
        (set.songs||[]).forEach(function(item, i) {
            var t = typeof item==='string'?item:item.title;
            var key = typeof item==='object'&&item.key?'<span class="chip">'+item.key+'</span>':'';
            var bpm = typeof item==='object'&&item.bpm?'<span class="chip">⚡'+item.bpm+'</span>':'';
            var seg = typeof item==='object'&&item.segue&&item.segue!=='stop'?'<span style="color:#999;margin-left:4px">→</span>':'';
            html += '<div class="song"><span class="num">'+(i+1)+'.</span><span class="title">'+ t + seg +'</span>'+key+bpm+'</div>';
        });
    });
    html += '<div class="footer">Generated by GrooveLinx — Where bands lock in.</div>';
    html += '</body></html>';
    var win = window.open('','_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function(){win.print();},400);
}

// PARACHUTE SYSTEM
// Offline PDF gig pack, email gig pack, public read-only URL, offline cache

async function parachuteLoadSetlistData(sl) {
    var songs = [];
    (sl.sets||[]).forEach(function(set, si) {
        (set.songs||[]).forEach(function(item) {
            var t = typeof item==='string'?item:item.title;
            if (t) songs.push({ title:t, setName:set.name||'Set '+(si+1), key:'', bpm:'', chart:'', segue:typeof item==='object'?item.segue:'stop' });
        });
    });
    await Promise.all(songs.map(async function(s) {
        var sd = allSongs.find(function(a){return a.title===s.title;});
        s.key = sd&&sd.key?sd.key:'';
        s.bpm = sd&&sd.bpm?String(sd.bpm):'';
        try {
            var cd = await loadBandDataFromDrive(s.title, 'chart');
            if (cd && cd.text && cd.text.trim()) s.chart = cd.text.trim();
        } catch(e) {}
    }));
    return songs;
}

function parachuteBuildHtml(sl, songs) {
    var name = sl.name || 'Setlist';
    var date = sl.date || '';
    var h = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+name+'</title>';
    h += '<style>';
    h += '*{box-sizing:border-box;margin:0;padding:0}';
    h += 'body{font-family:Georgia,serif;font-size:13px;color:#111;background:#fff;padding:24px 32px}';
    h += '.cover{text-align:center;padding:40px 0 32px;border-bottom:2px solid #333;margin-bottom:28px}';
    h += '.cover h1{font-size:2.2em;font-weight:700;margin-bottom:6px}';
    h += '.cover .meta{font-size:0.85em;color:#666;margin-top:4px}';
    h += '.toc{margin-bottom:28px;border:1px solid #ddd;border-radius:4px;padding:16px}';
    h += '.toc h3{font-size:0.8em;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:10px}';
    h += '.toc-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f0f0f0;font-size:0.88em}';
    h += '.song-page{page-break-before:always;padding-top:8px}';
    h += '.song-page:first-of-type{page-break-before:auto}';
    h += '.song-header{display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:12px}';
    h += '.song-title{font-size:1.4em;font-weight:700}';
    h += '.chip{background:#f0f0f0;padding:2px 8px;border-radius:4px;border:1px solid #ddd;font-size:0.78em;margin-left:6px}';
    h += '.chart{font-family:Menlo,Consolas,monospace;font-size:11.5px;line-height:1.55;white-space:pre-wrap;background:#fafafa;border:1px solid #e8e8e8;border-radius:4px;padding:12px 14px;margin-top:4px}';
    h += '.no-chart{color:#999;font-style:italic;font-size:0.88em;padding:10px 0}';
    h += '.footer{margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:0.72em;color:#aaa;text-align:center}';
    h += '@media print{.song-page{page-break-before:always}.song-page:first-of-type{page-break-before:auto}body{padding:16px 20px}}';
    h += '</style></head><body>';
    h += '<div class="cover"><h1>'+name+'</h1>';
    if (date) h += '<div class="meta">'+date+'</div>';
    h += '<div class="meta" style="margin-top:8px;font-size:0.75em;color:#aaa">GrooveLinx Emergency Gig Pack \u2014 Printed '+new Date().toLocaleDateString()+'</div></div>';
    // TOC
    h += '<div class="toc"><h3>Setlist</h3>';
    var num = 0, lastSet = '';
    songs.forEach(function(s) {
        if (s.setName !== lastSet) {
            if (lastSet) h += '<div style="height:4px"></div>';
            h += '<div style="font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin:6px 0 3px">'+s.setName+'</div>';
            lastSet = s.setName;
        }
        num++;
        var chips = (s.key?s.key:'')+(s.key&&s.bpm?' \u00b7 ':'')+( s.bpm?s.bpm+' bpm':'');
        var seg = {flow:' \u2192',segue:' ~',cutoff:' |'}[s.segue]||'';
        h += '<div class="toc-row"><span><b>'+num+'.</b> '+s.title+seg+'</span><span style="color:#888;font-size:0.85em">'+chips+'</span></div>';
    });
    h += '</div>';
    // Per-song pages
    songs.forEach(function(s) {
        h += '<div class="song-page">';
        h += '<div class="song-header"><span class="song-title">'+s.title+'</span><span>';
        if (s.key) h += '<span class="chip">\ud83c\udfb5 '+s.key+'</span>';
        if (s.bpm) h += '<span class="chip">\u26a1'+s.bpm+' BPM</span>';
        h += '</span></div>';
        if (s.chart) {
            h += '<div class="chart">'+s.chart.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>';
        } else {
            h += '<div class="no-chart">No chord chart saved yet.</div>';
        }
        h += '</div>';
    });
    h += '<div class="footer">GrooveLinx Emergency Gig Pack \u2014 '+name+(date?' \u2014 '+date:'')+' \u2014 Printed '+new Date().toLocaleDateString()+'</div>';
    h += '</body></html>';
    return h;
}

async function parachutePrint(slIdx) {
    document.getElementById('slShareModal')?.remove();
    showToast('\ud83c\udfa2 Loading charts...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var html = parachuteBuildHtml(sl, songs);
    var win = window.open('','_blank');
    if (!win) { showToast('Pop-up blocked \u2014 allow pop-ups and try again'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function(){win.print();}, 600);
}

async function parachuteEmail(slIdx) {
    document.getElementById('slShareModal')?.remove();
    showToast('\ud83c\udfa2 Building email pack...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var body = (sl.name||'Setlist')+(sl.date?' \u2014 '+sl.date:'')+'\n';
    body += 'Emergency Gig Pack from GrooveLinx\n';
    body += '='.repeat(40)+'\n\n';
    var lastSet = '';
    songs.forEach(function(s, i) {
        if (s.setName !== lastSet) {
            body += '\n\u2500\u2500 '+s.setName.toUpperCase()+' \u2500\u2500\n';
            lastSet = s.setName;
        }
        body += '\n'+(i+1)+'. '+s.title;
        if (s.key||s.bpm) body += ' ('+[s.key,s.bpm&&s.bpm+' BPM'].filter(Boolean).join(', ')+')';
        body += '\n';
        if (s.chart) body += s.chart+'\n';
        else body += '(no chart saved)\n';
    });
    var subject = encodeURIComponent('GrooveLinx Gig Pack: '+(sl.name||'Setlist')+(sl.date?' \u2014 '+sl.date:''));
    var to = encodeURIComponent(currentUserEmail||'');
    var mailto = 'mailto:'+to+'?subject='+subject+'&body='+encodeURIComponent(body);
    if (mailto.length > 8000) {
        showToast('\ud83d\udce7 Pack too large for email \u2014 opening print view instead');
        setTimeout(function(){parachutePrint(slIdx);}, 800);
        return;
    }
    window.location.href = mailto;
    showToast('\ud83d\udce7 Opening email...');
}

async function parachutePublicUrl(slIdx) {
    showToast('\ud83d\udd17 Building public link...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var payload = JSON.stringify({
        name: sl.name||'Setlist',
        date: sl.date||'',
        songs: songs.map(function(s){return {title:s.title,key:s.key,bpm:s.bpm,chart:s.chart,setName:s.setName,segue:s.segue};})
    });
    var b64 = btoa(unescape(encodeURIComponent(payload)));
    if (b64.length > 200000) {
        showToast('\u26a0\ufe0f Pack too large for URL \u2014 use Print or Email instead');
        return;
    }
    var url = window.location.origin + window.location.pathname + '?gigpack=1#' + b64;
    navigator.clipboard.writeText(url).then(function() {
        showToast('\ud83d\udd17 Public link copied! Anyone can open in any browser.');
    }).catch(function() {
        prompt('Copy this link:', url);
    });
}

function parachuteCheckUrlHash() {
    if (window.location.search.indexOf('gigpack=1') < 0) return false;
    var hash = window.location.hash;
    if (!hash) return false;
    try {
        var payload = JSON.parse(decodeURIComponent(escape(atob(hash.slice(1)))));
        if (!payload || !payload.songs) return false;
        var html = parachuteBuildHtml({name:payload.name,date:payload.date}, payload.songs);
        document.open(); document.write(html); document.close();
        return true;
    } catch(e) { return false; }
}

async function parachuteCacheOffline(slIdx) {
    showToast('\ud83d\udcbe Loading charts for offline cache...');
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists')||[]);
    var sl = setlists[slIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    var songs = await parachuteLoadSetlistData(sl);
    var pack = { name:sl.name, date:sl.date, songs:songs, cachedAt:new Date().toISOString() };
    try {
        localStorage.setItem('deadcetera_offline_gigpack', JSON.stringify(pack));
        showToast('\ud83d\udcbe Gig pack cached for offline use! \ud83c\udf89');
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({type:'CACHE_GIG_PACK'});
        }
    } catch(e) {
        showToast('Could not cache: '+e.message);
    }
}

function parachuteOpenOfflinePack() {
    var raw = localStorage.getItem('deadcetera_offline_gigpack');
    if (!raw) { showToast('No offline gig pack cached yet'); return; }
    try {
        var pack = JSON.parse(raw);
        var html = parachuteBuildHtml({name:pack.name,date:pack.date}, pack.songs);
        var win = window.open('','_blank');
        if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(function(){win.print();},400); }
        else { document.open(); document.write(html); document.close(); }
    } catch(e) { showToast('Could not open pack'); }
}


async function slSaveSetlistEdit(idx) {
    if (!requireSignIn()) return;
    const data = window._cachedSetlists ? [...window._cachedSetlists] : toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var prev = data[idx] || {};
    data[idx] = {
        ...prev,
        setlistId: prev.setlistId || generateShortId(12),
        gigId: prev.gigId || null,
        name: document.getElementById('slName')?.value || ('Setlist ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        date: document.getElementById('slDate')?.value || '',
        venueId: window._slVenueTouched ? (window._slSelectedVenueId || null) : (prev.venueId || null),
        venue: window._slVenueTouched ? (window._slSelectedVenueName || '') : (prev.venue || ''),
        notes: document.getElementById('slNotes')?.value || '',
        sets: window._slSets || [],
        updated: new Date().toISOString()
    };
    var saved = await saveBandDataToDrive('_band', 'setlists', data);
    if (saved === false) {
        showToast('❌ Save failed — check your connection or sign in');
        return;
    }
    showToast('✅ Setlist saved to band');
    // Onboarding: mark setlist step complete
    if (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.completeOnboardStep) GLAvatarGuide.completeOnboardStep('setlist');
    if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
    else { window._cachedSetlists = null; window._glCachedSetlists = null; }
    loadSetlists();
}

async function deleteSetlist(idx) {
    if (!requireSignIn()) return;
    if (!confirm('Delete this setlist? This cannot be undone.')) return;
    const raw = window._cachedSetlists || toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    const data = [...raw];
    data.splice(idx, 1);
    await saveBandDataToDrive('_band', 'setlists', data);
    showToast('🗑️ Setlist deleted');
    loadSetlists();
}

// Returns "Venue Name — City, ST" for dropdown display, falling back gracefully
// venueShortLabel(), deleteGig(), editGig(), saveGigEdit()
// → js/features/gigs.js

// Venue picker init for setlist forms
function _slInitVenuePicker(venues, preselected) {
    if (!document.getElementById('slVenuePicker')) return;
    window._slVenueTouched = false;
    function _onSelect(v) {
        window._slVenueTouched = true;
        if (v) {
            window._slSelectedVenueId = v.venueId || null;
            window._slSelectedVenueName = v.name || '';
        } else {
            window._slSelectedVenueId = null;
            window._slSelectedVenueName = null;
        }
    }
    function _onCreateNew(text) {
        glVenueCreateModal({
            initialName: text,
            onSave: function(venue) {
                window._slSelectedVenueId = venue.venueId;
                window._slSelectedVenueName = venue.name;
                GLStore.getVenues().then(function(v) {
                    if (window._slVenuePicker) window._slVenuePicker.refresh(v);
                    if (window._slVenuePicker) window._slVenuePicker.setValue(venue.venueId);
                });
            },
            onUseExisting: function(venue) {
                window._slSelectedVenueId = venue.venueId;
                window._slSelectedVenueName = venue.name;
                if (window._slVenuePicker) window._slVenuePicker.setValue(venue.venueId);
            }
        });
    }
    window._slVenuePicker = glEntityPicker({
        containerId: 'slVenuePicker',
        items: venues,
        labelFn: venueShortLabel,
        subLabelFn: function(v) { return v.address || ''; },
        onSelect: _onSelect,
        onCreateNew: _onCreateNew,
        placeholder: 'Search venues...',
        emptyText: 'No venues yet',
        selectedItem: preselected || null
    });
}

// ── Window exports (called from inline HTML onclick handlers) ──────────────
// Setlist lock toggle
// slToggleLock is now ONLY used for LOCKING (not unlocking — use slUnlockWithWarning for that)
async function slToggleLock(idx) {
    if (!requireSignIn()) return;
    var data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    if (!data[idx]) return;
    var willLock = !data[idx].locked;
    data[idx].locked = willLock;
    if (willLock) {
        data[idx].lockedAt = new Date().toISOString();
        data[idx].lockedBy = (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'unknown';
    }
    await saveBandDataToDrive('_band', 'setlists', data);
    if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
    else { window._cachedSetlists = null; window._glCachedSetlists = null; }
    showToast(willLock ? '🔒 Setlist locked' : '🔓 Setlist unlocked');
    loadSetlists();
}
// ── Insert Set Break — splits a set into two at a given song index ────────────
function slInsertSetBreak(setIdx, afterSongIdx) {
    var set = window._slSets[setIdx];
    if (!set || !set.songs || afterSongIdx < 1 || afterSongIdx >= set.songs.length) return;

    // Show styled picker instead of prompt()
    _slShowBreakPicker(setIdx, afterSongIdx);
}

function _slShowBreakPicker(setIdx, afterSongIdx) {
    // Remove any existing picker
    var old = document.getElementById('slBreakPicker');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'slBreakPicker';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;animation:glFlowIn 0.15s ease';

    overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:20px;max-width:320px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.5)">'
        + '<div style="font-size:0.92em;font-weight:700;color:#e2e8f0;margin-bottom:14px">What starts after this break?</div>'
        + '<div style="display:flex;flex-direction:column;gap:8px">'
        + '<button class="btn" onclick="_slBreakChoice(' + setIdx + ',' + afterSongIdx + ',\'set\')" style="padding:12px;border-radius:10px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;font-weight:600;font-size:0.88em;cursor:pointer;text-align:left">New Set</button>'
        + '<button class="btn" onclick="_slBreakChoice(' + setIdx + ',' + afterSongIdx + ',\'soundcheck\')" style="padding:12px;border-radius:10px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac;font-weight:600;font-size:0.88em;cursor:pointer;text-align:left">🔊 Soundcheck</button>'
        + '<button class="btn" onclick="_slBreakChoice(' + setIdx + ',' + afterSongIdx + ',\'encore\')" style="padding:12px;border-radius:10px;border:1px solid rgba(234,179,8,0.3);background:rgba(234,179,8,0.08);color:#fde047;font-weight:600;font-size:0.88em;cursor:pointer;text-align:left">Encore</button>'
        + '</div>'
        + '<button onclick="document.getElementById(\'slBreakPicker\').remove()" style="margin-top:12px;width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;font-weight:600;font-size:0.82em;cursor:pointer">Cancel</button>'
        + '</div>';

    // Close on backdrop click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}
window._slShowBreakPicker = _slShowBreakPicker;

function _slBreakChoice(setIdx, afterSongIdx, type) {
    // Remove picker
    var picker = document.getElementById('slBreakPicker');
    if (picker) picker.remove();

    var set = window._slSets[setIdx];
    if (!set || !set.songs) return;

    var firstHalf = set.songs.slice(0, afterSongIdx);
    var secondHalf = set.songs.slice(afterSongIdx);

    // Determine name for the new section
    var secondName = '';
    if (type === 'soundcheck') {
        secondName = '🔊 Soundcheck';
    } else if (type === 'encore') {
        secondName = 'Encore';
    } else {
        var usedNums = {};
        window._slSets.forEach(function(s) {
            var m = (s.name || '').match(/^Set (\d+)$/);
            if (m) usedNums[parseInt(m[1])] = true;
        });
        var nextNum = 1;
        while (usedNums[nextNum]) nextNum++;
        secondName = 'Set ' + nextNum;
    }

    // Name the first half if it was "All Songs"
    var firstName = set.name;
    if (set.name === 'All Songs') {
        if (secondName.match(/^Set \d+$/)) firstName = 'Set 1';
    }

    set.name = firstName;
    set.songs = firstHalf;
    window._slSets.splice(setIdx + 1, 0, { name: secondName, songs: secondHalf });
    _slRenumberSets();

    if (typeof _slMarkDirty === 'function') _slMarkDirty();
    _slReRenderSets();
    if (typeof showToast === 'function') showToast(secondName + ' added — now ' + window._slSets.length + ' sections');
}
window._slBreakChoice = _slBreakChoice;

// Rename a set section
function slRenameSet(setIdx) {
    if (!window._slSets[setIdx]) return;
    var current = window._slSets[setIdx].name || 'Set ' + (setIdx + 1);

    // Remove any existing rename dialog
    var old = document.getElementById('slRenamePicker');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'slRenamePicker';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;animation:glFlowIn 0.15s ease';

    overlay.innerHTML = '<div style="background:#1e293b;border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:20px;max-width:320px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.5)">'
        + '<div style="font-size:0.92em;font-weight:700;color:#e2e8f0;margin-bottom:12px">Rename section</div>'
        + '<input id="slRenameInput" class="app-input" value="' + current.replace(/"/g, '&quot;') + '" style="width:100%;margin-bottom:14px;padding:10px;font-size:0.9em">'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="document.getElementById(\'slRenamePicker\').remove()" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:none;color:#94a3b8;font-weight:600;font-size:0.85em;cursor:pointer">Cancel</button>'
        + '<button onclick="_slDoRename(' + setIdx + ')" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--accent);color:white;font-weight:600;font-size:0.85em;cursor:pointer">Save</button>'
        + '</div></div>';

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    setTimeout(function() {
        var inp = document.getElementById('slRenameInput');
        if (inp) { inp.focus(); inp.select(); }
    }, 100);
}

function _slDoRename(setIdx) {
    var inp = document.getElementById('slRenameInput');
    var newName = inp ? inp.value.trim() : '';
    var picker = document.getElementById('slRenamePicker');
    if (picker) picker.remove();
    if (!newName || !window._slSets[setIdx]) return;
    window._slSets[setIdx].name = newName;
    if (typeof _slMarkDirty === 'function') _slMarkDirty();
    _slReRenderSets();
}
window._slDoRename = _slDoRename;
window.slRenameSet = slRenameSet;

// Auto-renumber "Set N" sections sequentially after any structural change.
// Leaves Soundcheck, Encore, and custom names untouched.
function _slRenumberSets() {
    var setNum = 1;
    window._slSets.forEach(function(s) {
        if ((s.name || '').match(/^Set \d+$/) || s.name === 'All Songs') {
            s.name = 'Set ' + setNum;
            setNum++;
        }
    });
}

// Move a set up in the order
function slMoveSetUp(setIdx) {
    if (setIdx < 1 || !window._slSets[setIdx]) return;
    var tmp = window._slSets[setIdx];
    window._slSets[setIdx] = window._slSets[setIdx - 1];
    window._slSets[setIdx - 1] = tmp;
    _slRenumberSets();
    if (typeof _slMarkDirty === 'function') _slMarkDirty();
    _slReRenderSets();
}
window.slMoveSetUp = slMoveSetUp;

function _slReRenderSets() {
    var setsEl = document.getElementById('slSets');
    if (!setsEl) return;
    setsEl.innerHTML = window._slSets.map(function(set, si) {
        var setSongs = set.songs || [];
        var setCount = setSongs.length;
        var durLabel = setCount ? ' · ' + setCount + ' songs · ~' + _slDurationLabel(setSongs) : '';
        var setActions = '';
        if (si > 0) {
            setActions = '<div style="margin-left:auto;display:flex;gap:3px">'
                + '<button onclick="slMoveSetUp(' + si + ')" style="padding:1px 6px;background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:4px;cursor:pointer;font-size:0.58em;font-weight:600" title="Move this set up">↑</button>'
                + '<button onclick="slMergeSets(' + si + ')" style="padding:1px 6px;background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:4px;cursor:pointer;font-size:0.58em;font-weight:600" title="Merge into previous set">Merge ↑</button>'
                + '</div>';
        }
        return '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">'
            + '<div style="display:flex;align-items:center;font-size:0.78em;font-weight:700;color:var(--accent-light);margin-bottom:4px"><span onclick="slRenameSet(' + si + ')" style="cursor:pointer;border-bottom:1px dashed rgba(255,255,255,0.15)" title="Click to rename">' + (set.name || 'Set ' + (si+1)) + '</span><span style="font-weight:400;color:var(--text-dim);font-size:0.88em">' + durLabel + '</span>' + setActions + '</div>'
            + '<div id="slSet' + si + 'Songs"></div>'
            + '<div style="margin-top:4px"><div style="display:flex;gap:4px"><input class="app-input" id="slAddSong' + si + '" placeholder="Add song..." oninput="slSearchSong(this,' + si + ')" style="flex:1;font-size:0.78em;padding:4px 6px"><button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(' + si + ')" style="font-size:0.68em;flex-shrink:0" title="Pick songs from library">📋 Pick</button><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="font-size:0.68em;flex-shrink:0">All</button></div><div id="slSongResults' + si + '"></div></div>'
            + '</div>';
    }).join('');
    // Render songs for each set
    window._slSets.forEach(function(set, si) { slRenderSetSongs(si); });
    _slUpdateShowTotal();
}

function _slUpdateShowTotal() {
    var el = document.getElementById('slShowTotal');
    if (!el) return;
    var totalSongs = 0;
    var allSongsFlat = [];
    window._slSets.forEach(function(s) {
        var songs = s.songs || [];
        totalSongs += songs.length;
        allSongsFlat = allSongsFlat.concat(songs);
    });
    var setCount = window._slSets.length;
    var hint = setCount <= 1 && totalSongs > 5 ? '<span style="color:#fbbf24;font-weight:600"> · Use ✂ set break between songs to split into sets</span>' : '';
    el.innerHTML = '<span>Full Show · ' + totalSongs + ' songs · ~' + _slDurationLabel(allSongsFlat) + (setCount > 1 ? ' · ' + setCount + ' sets' : '') + '</span>' + hint;
}

// ── Merge Sets — undo a set break by combining with previous set ─────────────
function slMergeSets(setIdx) {
    if (setIdx < 1 || !window._slSets[setIdx] || !window._slSets[setIdx - 1]) return;
    var prev = window._slSets[setIdx - 1];
    var curr = window._slSets[setIdx];
    // Append current songs to previous set
    prev.songs = (prev.songs || []).concat(curr.songs || []);
    // Remove the current set
    window._slSets.splice(setIdx, 1);
    // If only one set remains, rename to "All Songs"
    if (window._slSets.length === 1) {
        window._slSets[0].name = 'All Songs';
    } else {
        _slRenumberSets();
    }
    if (typeof _slMarkDirty === 'function') _slMarkDirty();
    _slReRenderSets();
    if (typeof showToast === 'function') showToast('Sets merged — now ' + window._slSets.length + (window._slSets.length === 1 ? ' set' : ' sets'));
}

// Look up a band member's full name from email handle or key
function _slMemberName(key) {
    if (!key) return 'someone';
    if (typeof bandMembers !== 'undefined') {
        // Try exact key match
        if (bandMembers[key] && bandMembers[key].name) return bandMembers[key].name;
        for (var k in bandMembers) {
            var m = bandMembers[k];
            // Match by: key, email prefix, name (case-insensitive), or partial email
            if (k === key || k.split('@')[0] === key || (m.name && m.name.toLowerCase() === key.toLowerCase())) return m.name || key;
        }
    }
    // Last resort: try currentUserName if the key matches current user's email prefix
    if (typeof currentUserEmail !== 'undefined' && currentUserEmail && currentUserEmail.split('@')[0] === key) {
        return (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : key;
    }
    return key;
}

// Unlock a locked setlist with combined warning + notification
window.slUnlockWithWarning = async function(idx) {
    if (!requireSignIn()) return;
    var data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var sl = data[idx];
    if (!sl) return;

    // Build combined warning message
    var lockerName = _slMemberName(sl.lockedBy);
    var lockedAt = sl.lockedAt ? new Date(sl.lockedAt).toLocaleDateString() : 'unknown date';
    var msg = '⚠️ This setlist was locked by ' + lockerName + ' on ' + lockedAt + '.';

    // Include gig warning if linked to upcoming gig
    if (sl.gigId) {
        try {
            var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
            var today = new Date().toISOString().split('T')[0];
            var linkedGig = gigs.find(function(g) { return g.gigId === sl.gigId && g.date && g.date >= today; });
            if (linkedGig) {
                msg += '\n\nThis setlist is linked to an upcoming gig: ' + (linkedGig.venue || linkedGig.title || linkedGig.date) + '.';
            }
        } catch(e) {}
    }

    msg += '\n\nUnlocking will allow editing. ' + lockerName + ' will be notified.\n\nUnlock this setlist?';

    if (!confirm(msg)) return;

    // Unlock directly (skip slToggleLock to avoid double confirm)
    data[idx].locked = false;
    data[idx].unlockedBy = typeof currentUserEmail !== 'undefined' ? currentUserEmail : '';
    data[idx].unlockedAt = new Date().toISOString();
    // Keep lockedBy/lockedAt for history
    var saved = false;
    try { saved = await saveBandDataToDrive('_band', 'setlists', data); } catch(e) { console.log('[Setlist] Unlock save error:', e); }
    if (saved === false) {
        showToast('⚠️ Unlock saved locally — will sync when connected');
    }

    // Save notification for the locker (best-effort, don't block unlock)
    var unlockerName = _slMemberName(typeof currentUserEmail !== 'undefined' ? currentUserEmail.split('@')[0] : '');
    try {
        var notifications = toArray(await loadBandDataFromDrive('_band', 'notifications') || []);
        notifications.push({
            id: 'notif_' + Date.now(),
            type: 'setlist_unlocked',
            message: unlockerName + ' unlocked the setlist "' + (sl.name || 'Untitled') + '"',
            for: sl.lockedBy || '',
            createdAt: new Date().toISOString(),
            read: false
        });
        saveBandDataToDrive('_band', 'notifications', notifications).catch(function(){});
    } catch(e) {}

    // Force clear ALL caches so the list reflects the change
    if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
    window._cachedSetlists = null;
    window._glCachedSetlists = null;
    showToast('🔓 Setlist unlocked');
    await loadSetlists();
};

window.slInsertSetBreak = slInsertSetBreak;
window.slMergeSets = slMergeSets;
window.slToggleLock = slToggleLock;

// ── Song Picker Modal ────────────────────────────────────────────────────────
// Checkbox-based song selection for fast setlist building.

// Active statuses: canonical + legacy values that haven't been migrated yet
var _slActiveStatuses = { prospect:1, learning:1, rotation:1, wip:1, active:1, gig_ready:1 };
var _slInactiveStatuses = { shelved:1, parked:1, retired:1 };

function _slIsActive(title) {
    var st = null;
    // Try GLStore first (canonical)
    if (typeof GLStore !== 'undefined' && GLStore.getStatus) st = GLStore.getStatus(title);
    // Fallback: direct statusCache
    if (!st) { try { if (typeof statusCache !== 'undefined' && statusCache) st = statusCache[title]; } catch(e) {} }
    if (st) return !!_slActiveStatuses[st];
    // No status at all — treat as active if cache hasn't loaded, otherwise library
    try { if (typeof statusCacheLoaded !== 'undefined' && !statusCacheLoaded) return true; } catch(e) {}
    return false;
}

function slOpenSongPicker(setIdx) {
    var existing = document.getElementById('slSongPickerOverlay');
    if (existing) existing.remove();

    var inSet = {};
    var setSongs = (window._slSets[setIdx] && window._slSets[setIdx].songs) || [];
    setSongs.forEach(function(item) {
        var t = typeof item === 'string' ? item : (item.title || '');
        if (t) inSet[t] = true;
    });

    var songList = ((typeof GLStore !== 'undefined' && GLStore.getSongs) ? GLStore.getSongs() : (typeof allSongs !== 'undefined' ? allSongs : [])).slice();
    songList.sort(function(a, b) {
        var aActive = _slIsActive(a.title);
        var bActive = _slIsActive(b.title);
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return (a.title || '').localeCompare(b.title || '');
    });

    var ov = document.createElement('div');
    ov.id = 'slSongPickerOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';

    var activeCount = songList.filter(function(s) { return _slIsActive(s.title); }).length;

    var html = '<div style="background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:14px;max-width:480px;width:100%;max-height:85vh;display:flex;flex-direction:column;color:var(--text,#e2e8f0)">';
    html += '<div style="padding:16px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<h3 style="margin:0;font-size:1em;color:var(--accent-light,#818cf8)">📋 Pick Songs</h3>';
    html += '<button onclick="document.getElementById(\'slSongPickerOverlay\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1em">✕</button>';
    html += '</div>';
    html += '<input id="slPickerSearch" type="text" placeholder="Search songs..." oninput="slPickerFilter(this.value)" style="width:100%;padding:6px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text);font-size:0.85em;box-sizing:border-box">';
    html += '<div style="display:flex;gap:6px;margin-top:6px">';
    html += '<button onclick="slPickerSelectAll(true)" style="font-size:0.68em;padding:3px 8px;border-radius:5px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac;cursor:pointer;font-weight:600">Select All Active (' + activeCount + ')</button>';
    html += '<button onclick="slPickerSelectAll(false)" style="font-size:0.68em;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Clear All</button>';
    html += '<button onclick="slPickerToggleLibrary()" id="slPickerLibBtn" style="font-size:0.68em;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">' + (_slPickerShowLibrary ? 'Hide Library' : 'Show Library') + '</button>';
    html += '<span id="slPickerCount" style="font-size:0.68em;color:var(--text-dim);margin-left:auto;align-self:center">' + Object.keys(inSet).length + ' selected</span>';
    html += '</div></div>';

    html += '<div id="slPickerList" style="overflow-y:auto;flex:1;padding:8px 16px">';
    if (songList.length === 0) {
        html += '<div style="text-align:center;padding:30px 16px;color:var(--text-dim)">'
            + '<div style="font-size:1.5em;margin-bottom:8px">🎵</div>'
            + '<div style="font-weight:600;margin-bottom:6px">No songs in your library yet</div>'
            + '<div style="font-size:0.82em;margin-bottom:14px;line-height:1.4">Type song names in the search box on the setlist editor — they\'ll be added automatically.</div>'
            + '<button onclick="document.getElementById(\'slSongPickerOverlay\').remove()" class="btn btn-ghost" style="font-size:0.85em">Got it</button>'
            + '</div>';
    }
    songList.forEach(function(s) {
        var isActive = _slIsActive(s.title);
        // When Library is off, hide inactive songs entirely (not just dim)
        if (!_slPickerShowLibrary && !isActive) return;
        var checked = inSet[s.title] ? 'checked' : '';
        var safeTitle = s.title.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        // Get status for library songs
        var statusLabel = '';
        if (!isActive) {
            var st = (typeof GLStore !== 'undefined' && GLStore.getStatus) ? GLStore.getStatus(s.title) : '';
            var stMap = { shelved:'Shelved', parked:'Parked', retired:'Retired' };
            statusLabel = '<span style="font-size:0.55em;padding:1px 4px;border-radius:3px;background:rgba(100,116,139,0.15);color:#64748b;font-weight:600;flex-shrink:0">' + (stMap[st] || 'Library') + '</span>';
        }
        html += '<label data-title="' + safeTitle + '" data-active="' + (isActive ? '1' : '0') + '" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;' + (!isActive ? 'opacity:0.5' : '') + '">';
        html += '<input type="checkbox" class="sl-picker-cb" data-song="' + safeTitle + '" ' + checked + ' onchange="slPickerUpdateCount()" style="accent-color:#667eea;width:16px;height:16px;flex-shrink:0">';
        html += '<span style="font-size:0.85em;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + s.title + '</span>';
        html += '<span style="font-size:0.68em;color:var(--text-dim);flex-shrink:0">' + (s.band || '') + '</span>';
        if (isActive) html += '<span style="font-size:0.55em;padding:1px 4px;border-radius:3px;background:rgba(34,197,94,0.15);color:#86efac;font-weight:700;flex-shrink:0">Active</span>';
        else html += statusLabel;
        html += '</label>';
    });
    html += '</div>';

    html += '<div style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;flex-shrink:0">';
    html += '<button onclick="slPickerConfirm(' + setIdx + ')" style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:700;font-size:0.9em;cursor:pointer">Add Selected</button>';
    html += '<button onclick="document.getElementById(\'slSongPickerOverlay\').remove()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer;font-size:0.85em">Cancel</button>';
    html += '</div></div>';

    ov.innerHTML = html;
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    document.getElementById('slPickerSearch').focus();
}

function slPickerFilter(q) {
    var lower = q.toLowerCase();
    document.querySelectorAll('#slPickerList label').forEach(function(label) {
        var title = (label.dataset.title || '').toLowerCase();
        label.style.display = (!q || title.indexOf(lower) !== -1) ? 'flex' : 'none';
    });
}

function slPickerSelectAll(selectActive) {
    document.querySelectorAll('.sl-picker-cb').forEach(function(cb) {
        var label = cb.closest('label');
        cb.checked = selectActive ? (label && label.dataset.active === '1') : false;
    });
    slPickerUpdateCount();
}

function slPickerUpdateCount() {
    var el = document.getElementById('slPickerCount');
    if (el) el.textContent = document.querySelectorAll('.sl-picker-cb:checked').length + ' selected';
}

function slPickerConfirm(setIdx) {
    if (!window._slSets[setIdx]) window._slSets[setIdx] = { name: 'Set ' + (setIdx + 1), songs: [] };
    var existingTitles = {};
    (window._slSets[setIdx].songs || []).forEach(function(item) {
        var t = typeof item === 'string' ? item : (item.title || '');
        if (t) existingTitles[t] = true;
    });

    var checkboxes = document.querySelectorAll('.sl-picker-cb:checked');
    var added = 0;
    checkboxes.forEach(function(cb) {
        var title = cb.dataset.song;
        if (title && !existingTitles[title]) {
            window._slSets[setIdx].songs.push({ title: title, segue: 'stop' });
            added++;
        }
    });

    var checkedTitles = {};
    checkboxes.forEach(function(cb) { if (cb.dataset.song) checkedTitles[cb.dataset.song] = true; });
    window._slSets[setIdx].songs = window._slSets[setIdx].songs.filter(function(item) {
        var t = typeof item === 'string' ? item : (item.title || '');
        return checkedTitles[t];
    });

    document.getElementById('slSongPickerOverlay').remove();
    if (typeof _slMarkDirty === 'function') _slMarkDirty();
    slRenderSetSongs(setIdx);
    if (typeof showToast === 'function') showToast(added > 0 ? added + ' song' + (added > 1 ? 's' : '') + ' added' : 'Setlist updated');
}

function slPickerToggleLibrary() {
    _slPickerShowLibrary = !_slPickerShowLibrary;
    var btn = document.getElementById('slPickerLibBtn');
    if (btn) btn.textContent = _slPickerShowLibrary ? 'Hide Library' : 'Show Library';
    // Re-render by toggling visibility of inactive labels
    document.querySelectorAll('#slPickerList label').forEach(function(label) {
        if (label.dataset.active === '0') {
            label.style.display = _slPickerShowLibrary ? 'flex' : 'none';
        }
    });
}

window.slOpenSongPicker = slOpenSongPicker;
window.slPickerFilter = slPickerFilter;
window.slPickerSelectAll = slPickerSelectAll;
window.slPickerUpdateCount = slPickerUpdateCount;
window.slPickerConfirm = slPickerConfirm;
window.slPickerToggleLibrary = slPickerToggleLibrary;

window.renderSetlistsPage = renderSetlistsPage;
window.loadSetlists = loadSetlists;
window.exportSetlistToiPad = exportSetlistToiPad;
window.createNewSetlist = createNewSetlist;
window.slSearchSong = slSearchSong;
window.slAddSongToSet = slAddSongToSet;
window.slRenderSetSongs = slRenderSetSongs;
window.slRenderReadinessMeter = slRenderReadinessMeter;
window.slVoteSong = slVoteSong;
window.slRefreshVotesForSong = slRefreshVotesForSong;
window.slEnrichKeyBpm = slEnrichKeyBpm;
window.slSetSegue = slSetSegue;
window.slToggleTransition = slToggleTransition;
window.slRemoveSong = slRemoveSong;
window.slAddSet = slAddSet;
window.slSaveSetlist = slSaveSetlist;

// Dirty state tracking for persistent save indicator
window._slMarkDirty = function() {
    var ind = document.getElementById('slDirtyIndicator');
    if (ind) ind.style.display = '';
};
window.editSetlist = editSetlist;

window.slPlaySetlist = async function(idx) {
    // idx is _origIdx from unsorted Firebase data — do NOT re-sort
    var allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var sl = allSetlists[idx];
    if (!sl) { if (typeof showToast === 'function') showToast('Setlist not found'); return; }
    var name = sl.name || sl.title || 'Setlist';
    console.log('[slPlaySetlist] idx=' + idx + ' name=' + name);

    // Use unified engine if available, fall back to legacy
    if (typeof GLPlayerEngine !== 'undefined' && typeof GLPlayerUI !== 'undefined') {
        GLPlayerEngine.loadFromSetlist(sl, { name: name });
        GLPlayerUI.showOverlay();
        GLPlayerEngine.play(0);
    } else if (typeof SetlistPlayer !== 'undefined') {
        SetlistPlayer.launch(sl, name);
    } else {
        if (typeof showToast === 'function') showToast('Player not available');
    }
};

window.slShareSetlist = slShareSetlist;
window.slShareCopyText = slShareCopyText;
window.slSharePrint = slSharePrint;
window.parachuteLoadSetlistData = parachuteLoadSetlistData;
window.parachuteBuildHtml = parachuteBuildHtml;
window.parachutePrint = parachutePrint;
window.parachuteEmail = parachuteEmail;
window.parachutePublicUrl = parachutePublicUrl;
window.parachuteCheckUrlHash = parachuteCheckUrlHash;
window.parachuteCacheOffline = parachuteCacheOffline;
window.parachuteOpenOfflinePack = parachuteOpenOfflinePack;
window.slSaveSetlistEdit = slSaveSetlistEdit;
window.deleteSetlist = deleteSetlist;
