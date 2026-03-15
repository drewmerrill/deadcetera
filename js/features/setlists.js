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
function renderSetlistsPage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'setlists');
    el.innerHTML = `
    <div class="page-header"><h1>📋 Setlists</h1><p>Build and manage setlists for gigs</p></div>
    <div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn btn-primary" onclick="createNewSetlist()">+ New Setlist</button></div>
    <div id="setlistsList"></div>`;
    if (typeof loadGigHistory === 'function') loadGigHistory().then(() => loadSetlists()); else loadSetlists();
}

async function loadSetlists() {
    const rawData = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    // Sort newest first; track original indices for edit/delete operations
    const data = rawData.map((sl, origIdx) => ({ ...sl, _origIdx: origIdx })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    window._cachedSetlists = rawData; // cache unsorted for live-gig.js index lookup
    const container = document.getElementById('setlistsList');
    if (!container) return;
    if (data.length === 0) { container.innerHTML = '<div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No setlists yet. Create one for your next gig!</div>'; return; }
    container.innerHTML = data.map((sl, i) => `<div class="app-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;cursor:pointer" onclick="editSetlist(${sl._origIdx})">
                <h3 style="margin-bottom:4px">${sl.name||'Untitled'}</h3>
                <div style="display:flex;gap:12px;font-size:0.8em;color:var(--text-muted);flex-wrap:wrap">
                    <span>📅 ${sl.date||'No date'}</span><span>🏛️ ${sl.venue||'No venue'}</span>
                    <span>🎵 ${(sl.sets||[]).reduce((a,s)=>a+(s.songs||[]).length,0)} songs</span>
                    <span>📋 ${(sl.sets||[]).length} set${(sl.sets||[]).length!==1?'s':''}</span>
                </div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="btn btn-sm btn-ghost" onclick="editSetlist(${sl._origIdx})" title="Edit">✏️</button>
                <button class="btn btn-sm btn-ghost" onclick="launchLiveGig('${sl.id || sl._origIdx}')" title="Go Live" style="color:#22c55e">🎤</button>
                <button class="btn btn-sm btn-ghost" onclick="exportSetlistToiPad(${sl._origIdx})" title="Export for iPad" style="color:var(--accent-light)">📱</button>
                <button class="btn btn-sm btn-ghost" onclick="deleteSetlist(${sl._origIdx})" title="Delete" style="color:var(--red,#f87171)">🗑️</button>
            </div>
        </div>
        ${(sl.sets||[]).map(s => { const SA={'stop':'  ','flow':' → ','segue':' ~ ','cutoff':' | '}; return `<div style="font-size:0.78em;color:var(--text-dim);margin-top:4px"><strong>${s.name}:</strong> ${(s.songs||[]).map((sg,i,arr)=>{ const t=typeof sg==='string'?sg:sg.title; const a=i<arr.length-1?(SA[(typeof sg==='object'&&sg.segue)||'stop']||'  '):''; return t+a; }).join('')}</div>`; }).join('')}
    </div>`).join('');
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
    const container = document.getElementById('setlistsList');
    if (!container) return;
    window._slSets = [{ name: 'Set 1', songs: [] }];
    window._slSelectedVenueId = null;
    window._slSelectedVenueName = null;
    container.innerHTML = `<div class="app-card"><h3>New Setlist</h3>
        <div class="form-grid" style="margin-bottom:12px">
            <div class="form-row"><label class="form-label">Name</label><input class="app-input" id="slName" placeholder="e.g. Buckhead Theatre 3/15"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="slDate" type="date"></div>
            <div class="form-row"><label class="form-label">Venue</label><div id="slVenuePicker"></div></div>
            <div class="form-row"><label class="form-label">Notes</label><input class="app-input" id="slNotes" placeholder="Optional"></div>
        </div>
        <div id="slSets"><div class="app-card" style="background:rgba(255,255,255,0.02)"><h3 style="color:var(--accent-light)">Set 1</h3><div id="slSet0Songs"></div><div style="margin-top:8px"><div style="display:flex;gap:6px;margin-bottom:4px"><input class="app-input" id="slAddSong0" placeholder="Type song name..." oninput="slSearchSong(this,0)" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="flex-shrink:0;white-space:nowrap">⚡ All Songs</button></div><div id="slSongResults0"></div></div></div></div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn-ghost" onclick="slAddSet()">+ Add Set</button>
            <button class="btn btn-ghost" onclick="slAddSet('encore')">+ Encore</button>
            <button class="btn btn-ghost" onclick="slAddSet('soundcheck')" style="color:var(--yellow)">🔊 Soundcheck</button>
            <button class="btn btn-success" onclick="slSaveSetlist()" style="margin-left:auto">💾 Save Setlist</button>
        </div></div>`;
    _slInitVenuePicker(await GLStore.getVenues(), null);
}

var _slOnlyActive = false; // Pierce filter: show only prospect/wip/gig_ready songs

function slToggleActiveFilter(btn) {
    _slOnlyActive = !_slOnlyActive;
    btn.style.background = _slOnlyActive ? 'var(--accent)' : 'rgba(255,255,255,0.06)';
    btn.style.color = _slOnlyActive ? 'white' : 'var(--text-muted)';
    btn.textContent = _slOnlyActive ? '⚡ Active Only' : '⚡ All Songs';
}

function slSearchSong(input, setIdx) {
    const q = input.value.toLowerCase();
    const results = document.getElementById('slSongResults' + setIdx);
    if (!results || q.length < 2) { if(results) results.innerHTML=''; return; }
    const _activeStatuses = ['prospect','wip','gig_ready'];
    const matches = (typeof allSongs !== "undefined" ? allSongs : songs || [])
        .filter(s => s.title.toLowerCase().includes(q))
        .filter(s => !_slOnlyActive || _activeStatuses.includes(GLStore && GLStore.getStatus(s.title)))
        .slice(0, 12);
    results.innerHTML = matches.map(s => `<div class="list-item" style="cursor:pointer;padding:6px 10px;font-size:0.85em" data-title="${s.title.replace(/"/g,'&quot;')}" data-setidx="${setIdx}" onclick="slAddSongToSet(${setIdx},this.dataset.title)">
        <span style="color:var(--text-dim);font-size:0.8em;width:30px">${s.band||''}</span> ${s.title}</div>`).join('');
}
function slAddSongToSet(setIdx, title) {
    if (!requireSignIn()) return;
    if (!window._slSets[setIdx]) window._slSets[setIdx] = { songs: [] };
    window._slSets[setIdx].songs.push({title: title, segue: 'stop'});
    slRenderSetSongs(setIdx);
    document.getElementById('slAddSong' + setIdx).value = '';
    document.getElementById('slSongResults' + setIdx).innerHTML = '';
}

function slRenderSetSongs(setIdx) {
    const el = document.getElementById('slSet' + setIdx + 'Songs');
    if (!el) return;
    const items = window._slSets[setIdx]?.songs || [];
    const allSongsList = (typeof allSongs !== 'undefined' ? allSongs : songs || []);
    el.innerHTML = items.map((item, i) => {
        const s = typeof item === 'string' ? item : item.title;
        const segue = typeof item === 'object' ? (item.segue || 'stop') : 'stop';
        const songData = allSongsList.find(sd => sd.title === s);
        const keyStr = songData?.key ? `<span style="font-size:0.7em;color:#818cf8;background:rgba(129,140,248,0.12);padding:1px 5px;border-radius:4px;border:1px solid rgba(129,140,248,0.2)">${songData.key}</span>` : '';
        const bpmStr = songData?.bpm ? `<span style="font-size:0.7em;color:#94a3b8">\u26a1${songData.bpm}</span>` : '';
        const segueColor = { stop:'#64748b', flow:'#818cf8', segue:'#34d399', cutoff:'#f87171' }[segue] || '#64748b';
        const histTip = typeof getSongHistoryTooltip === 'function' ? getSongHistoryTooltip(s) : '';
        return `<div class="list-item sl-song-row" data-set="${setIdx}" data-idx="${i}" draggable="true"
            style="padding:6px 10px;font-size:0.85em;gap:6px;align-items:center;cursor:default" title="${histTip.replace(/"/g,'&quot;')}">
            <span style="color:#475569;cursor:grab;font-size:1em;flex-shrink:0" title="Drag to reorder">\u2807</span>
            <span style="color:var(--text-dim);min-width:20px;font-weight:600;flex-shrink:0">${i + 1}.</span>
            <span style="flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s}</span>
            ${keyStr}${bpmStr}<span id="slvote_${sanitizeFirebasePath(s).replace(/[^a-zA-Z0-9]/g,'_')}" style="display:inline-flex;align-items:center;gap:2px;margin-left:4px;vertical-align:middle"></span>
            <select onchange="slSetSegue(${setIdx},${i},this.value)" onclick="event.stopPropagation()"
                style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:${segueColor};border-radius:5px;padding:2px 4px;font-size:0.78em;font-weight:700;cursor:pointer;flex-shrink:0">
                <option value="stop" ${segue==='stop'?'selected':''}>Stop</option>
                <option value="flow" ${segue==='flow'?'selected':''}>\u2192 Flow</option>
                <option value="segue" ${segue==='segue'?'selected':''}>~ Segue</option>
                <option value="cutoff" ${segue==='cutoff'?'selected':''}>| Cut</option>
            </select>
            <button class="btn btn-sm btn-ghost" onclick="slRemoveSong(${setIdx},${i})" style="padding:2px 6px;flex-shrink:0">\u2715</button>
        </div>`;
    }).join('');
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
            slRenderSetSongs(setIdx);
        });
    });
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
            <div style="margin-top:8px"><div style="display:flex;gap:6px;margin-bottom:4px"><input class="app-input" id="slAddSong${idx}" placeholder="Type song name..." oninput="slSearchSong(this,${idx})" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="flex-shrink:0;white-space:nowrap">⚡ All Songs</button></div><div id="slSongResults${idx}"></div></div>
        </div>`);
}

async function slSaveSetlist() {
    if (!requireSignIn()) return;
    const sl = {
        setlistId: generateShortId(12),
        gigId: null,
        name: document.getElementById('slName')?.value || 'Untitled',
        date: document.getElementById('slDate')?.value || '',
        venueId: window._slSelectedVenueId || null,
        venue: window._slSelectedVenueName || '',
        notes: document.getElementById('slNotes')?.value || '',
        sets: window._slSets || [],
        created: new Date().toISOString()
    };
    const existing = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    existing.push(sl);
    await saveBandDataToDrive('_band', 'setlists', existing);
    showToast('✅ Setlist saved!');
    window._cachedSetlists = null;
    loadSetlists();
}

async function editSetlist(idx) {
    window._slEditIdx = idx;
    const data = window._cachedSetlists || toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    const sl = data[idx];
    if (!sl) { alert('Setlist not found'); return; }
    
    window._slSets = sl.sets || [{ name: 'Set 1', songs: [] }];
    window._slEditIndex = idx;
    _slSetCount = window._slSets.length;
    window._slSelectedVenueId = sl.venueId || null;
    window._slSelectedVenueName = sl.venue || null;

    const container = document.getElementById('setlistsList');
    container.innerHTML = `<div class="app-card"><h3>Edit: ${sl.name||'Untitled'}</h3>
        <div class="form-grid" style="margin-bottom:12px">
            <div class="form-row"><label class="form-label">Name</label><input class="app-input" id="slName" value="${(sl.name||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="slDate" type="date" value="${sl.date||''}" style="max-width:100%;box-sizing:border-box;padding-right:36px;"></div>
            <div class="form-row"><label class="form-label">Venue</label><div id="slVenuePicker"></div></div>
            <div class="form-row"><label class="form-label">Notes</label><input class="app-input" id="slNotes" value="${(sl.notes||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <div id="slLinkedGigRow" style="margin-bottom:8px"></div>
        <div id="slReadinessMeter"></div>
        <div id="slSets">${window._slSets.map((set, si) => `
            <div class="app-card" style="background:rgba(255,255,255,0.02)">
                <h3 style="color:var(--accent-light)">${set.name||'Set '+(si+1)}</h3>
                <div id="slSet${si}Songs"></div>
                <div style="margin-top:8px"><div style="display:flex;gap:6px;margin-bottom:4px"><input class="app-input" id="slAddSong${si}" placeholder="Type song name..." oninput="slSearchSong(this,${si})" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="flex-shrink:0;white-space:nowrap">⚡ All Songs</button></div><div id="slSongResults${si}"></div></div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn-ghost" onclick="slAddSet()">+ Add Set</button>
            <button class="btn btn-ghost" onclick="slAddSet('encore')">+ Encore</button>
            <button class="btn btn-ghost" onclick="slShareSetlist(${idx})" style="color:#94a3b8">📤 Share</button>
            <button class="btn btn-ghost" onclick="carePackageSend('gig',${idx})" style="color:#fbbf24;font-size:0.82em">🪂 Pack</button>
            <button class="btn btn-success" onclick="slSaveSetlistEdit(${idx})" style="margin-left:auto">💾 Save Changes</button>
            <button class="btn btn-ghost" onclick="loadSetlists()">Cancel</button>
        </div></div>`;
    
    // Init venue picker for edit form
    var slVenues = await GLStore.getVenues();
    var slPreselected = null;
    if (sl.venueId) slPreselected = slVenues.find(function(v){ return v.venueId === sl.venueId; });
    if (!slPreselected && sl.venue) slPreselected = slVenues.find(function(v){ return v.name === sl.venue; });
    _slInitVenuePicker(slVenues, slPreselected);

    // Render existing songs in each set
    window._slSets.forEach((set, si) => slRenderSetSongs(si));
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
        name: document.getElementById('slName')?.value || 'Untitled',
        date: document.getElementById('slDate')?.value || '',
        venueId: window._slVenueTouched ? (window._slSelectedVenueId || null) : (prev.venueId || null),
        venue: window._slVenueTouched ? (window._slSelectedVenueName || '') : (prev.venue || ''),
        notes: document.getElementById('slNotes')?.value || '',
        sets: window._slSets || [],
        updated: new Date().toISOString()
    };
    await saveBandDataToDrive('_band', 'setlists', data);
    showToast('✅ Setlist updated!');
    window._cachedSetlists = null;
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
window.editSetlist = editSetlist;
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
