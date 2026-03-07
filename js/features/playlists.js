// ============================================================================
// js/features/playlists.js
// Playlists: index, editor, player, listening party.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js, worker-api.js
// EXPOSES globals: renderPlaylistsPage, plCreateNew, plLoadIndex,
//   plPlayerRender, plPlayerResolveAndUpdate, plPlayerOpenCurrent,
//   plConfirmDelete, plPartySync
// ============================================================================

'use strict';

// ============================================================================
// PLAYLISTS — PHASE 2: INDEX PAGE + EDITOR
// ============================================================================

// ── Index Page ────────────────────────────────────────────────────────────────

function renderPlaylistsPage(el) {
    el.innerHTML = `
    <div class="page-header">
        <h1>🎵 Playlists</h1>
        <p>Curated listening for the whole band — from any source, in any order</p>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="plCreateNew()">+ New Playlist</button>
        <div class="tab-bar" id="plTypeFilter" style="margin-bottom:0;flex:1;min-width:0">
            <button class="tab-btn active" data-type="all" onclick="plFilterByType('all',this)">All</button>
            ${Object.entries(PLAYLIST_TYPES).map(([k,v]) =>
                `<button class="tab-btn" data-type="${k}" onclick="plFilterByType('${k}',this)">${v.label}</button>`
            ).join('')}
        </div>
    </div>
    <div id="plList"></div>`;
    plLoadIndex();
}

let _plAllLoaded = [];
let _plActiveType = 'all';

async function plLoadIndex() {
    const container = document.getElementById('plList');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Loading playlists…</div>';

    _plAllLoaded = await loadPlaylists();

    if (_plAllLoaded.length === 0) {
        container.innerHTML = `<div class="app-card" style="text-align:center;padding:40px;color:var(--text-dim)">
            <div style="font-size:2.5em;margin-bottom:12px">🎵</div>
            <div style="font-weight:700;margin-bottom:6px">No playlists yet</div>
            <div style="font-size:0.85em;margin-bottom:16px">Create your first playlist — North Star versions, pre-gig prep, whatever the band needs.</div>
            <button class="btn btn-primary" onclick="plCreateNew()">+ Create First Playlist</button>
        </div>`;
        return;
    }

    // Load listened data once for progress bars
    const listens = await loadPlaylistListens();
    plRenderIndex(_plAllLoaded, listens, _plActiveType);
}

function plFilterByType(type, btn) {
    _plActiveType = type;
    document.querySelectorAll('#plTypeFilter .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    plRenderIndex(_plAllLoaded, null, type);
}

async function plRenderIndex(playlists, listens, typeFilter) {
    const container = document.getElementById('plList');
    if (!container) return;

    if (!listens) listens = await loadPlaylistListens();

    const filtered = typeFilter === 'all'
        ? playlists
        : playlists.filter(p => p.type === typeFilter);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="app-card" style="text-align:center;padding:32px;color:var(--text-dim)">No ${typeFilter} playlists yet.</div>`;
        return;
    }

    // Check which playlists have active listening parties
    const partyStates = {};
    if (firebaseDB && isUserSignedIn) {
        await Promise.all(filtered.map(async pl => {
            const state = await getPartyState(pl.id).catch(() => null);
            if (state?.active) partyStates[pl.id] = state;
        }));
    }

    container.innerHTML = filtered.map((pl, i) => {
        const meta = PLAYLIST_TYPES[pl.type] || PLAYLIST_TYPES.custom;
        const songs = pl.linkedSetlistId ? null : toArray(pl.songs || []);
        const songCount = songs ? songs.length : '?';
        const listenedByUser = listens[pl.id] || {};
        const memberCount = Object.keys(bandMembers).length;

        // Progress bar: average % across all members
        const totalSongs = songs ? songs.length : 0;
        const progressHTML = totalSongs > 0
            ? Object.entries(bandMembers).map(([key, member]) => {
                const heard = (listenedByUser[key] || []).length;
                const pct = Math.round((heard / totalSongs) * 100);
                return `<div title="${member.name}: ${heard}/${totalSongs}" style="display:flex;align-items:center;gap:5px;font-size:0.72em;color:var(--text-muted)">
                    <span style="width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${member.name.split(' ')[0]}</span>
                    <div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;min-width:50px">
                        <div style="height:5px;border-radius:3px;background:${pct===100?'var(--green)':'var(--accent)'};width:${pct}%;transition:width 0.3s"></div>
                    </div>
                    <span style="width:26px;text-align:right;color:var(--text-dim)">${pct}%</span>
                </div>`;
            }).join('')
            : '';

        const linkedBadge = pl.linkedSetlistId
            ? `<span style="font-size:0.7em;background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.25);padding:2px 7px;border-radius:10px;font-weight:600">⚡ Live from setlist</span>`
            : '';

        // Listening party badge
        const party = partyStates[pl.id];
        const partyBadge = party
            ? `<span style="font-size:0.7em;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);padding:2px 7px;border-radius:10px;font-weight:600;animation:pulse 2s infinite">🎉 Party Live</span>`
            : '';

        const createdDate = pl.createdAt ? new Date(pl.createdAt).toLocaleDateString() : '';

        const partyCount = party ? Object.values(party.presence || {}).filter(p => p.online).length : 0;

        return `<div class="app-card" id="plCard_${pl.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div style="flex:1;min-width:0;cursor:pointer" onclick="plEdit('${pl.id}')">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                        <span style="font-weight:700;font-size:0.98em">${pl.name || 'Untitled'}</span>
                        <span style="font-size:0.72em;font-weight:600;padding:2px 8px;border-radius:10px;background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};white-space:nowrap">${meta.label}</span>
                        ${linkedBadge}
                        ${partyBadge}
                    </div>
                    ${pl.description ? `<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pl.description}</div>` : ''}
                    <div style="display:flex;gap:10px;font-size:0.78em;color:var(--text-dim);flex-wrap:wrap">
                        <span>🎵 ${pl.linkedSetlistId ? 'Synced' : songCount + ' song' + (songCount !== 1 ? 's' : '')}</span>
                        ${createdDate ? `<span>📅 ${createdDate}</span>` : ''}
                        <span>👤 ${bandMembers[pl.createdBy]?.name || pl.createdBy || 'Unknown'}</span>
                        ${partyCount > 0 ? `<span>👥 ${partyCount} listening now</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start;flex-wrap:wrap;justify-content:flex-end">
                    ${party ? `<button class="btn btn-sm" onclick="plPlay('${pl.id}')" title="Join the active listening party" style="font-size:0.78em;padding:4px 10px;background:rgba(251,191,36,0.2);color:#fbbf24;border:1px solid rgba(251,191,36,0.4)">🎉 Join Party</button>` : ''}
                    <button class="btn btn-sm btn-primary" onclick="plPlay('${pl.id}')" title="Play this playlist" style="font-size:0.78em;padding:4px 10px">▶ Play</button>
                    <button class="btn btn-sm btn-ghost" onclick="plEdit('${pl.id}')" title="Edit">✏️</button>
                    <button class="btn btn-sm btn-ghost" onclick="copyPlaylistShareUrl('${pl.id}')" title="Copy share link" style="color:var(--accent-light)">🔗</button>
                    <button class="btn btn-sm btn-ghost" onclick="plConfirmDelete('${pl.id}')" title="Delete" style="color:var(--red)">🗑️</button>
                </div>
            </div>
            ${progressHTML ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:4px">${progressHTML}</div>` : ''}
        </div>`;
    }).join('');
}


// ── Playlist Player ──────────────────────────────────────────────────────────
// Queue-based player: one song at a time. Tap ▶ Open to launch it in Spotify/YouTube,
// then tap ▶▶ Next when you're ready for the next song. No tab explosion.

let _plPlayerSongs = [];      // resolved songs for current session
let _plPlayerIndex = 0;       // which song is "now playing"
let _plPlayerPlaylist = null; // current playlist object
let _plPartyActive = false;   // true while a listening party is joined

async function plPlay(playlistId) {
    const playlists = await loadPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) { showToast('Playlist not found', 2000); return; }

    const songs = await getPlaylistSongs(pl);
    if (!songs.length) { showToast('This playlist has no songs yet', 2000); return; }

    _plPlayerPlaylist = pl;
    _plPlayerSongs = songs;

    // If a party is already active for this playlist, jump to its current song
    const partyState = firebaseDB ? await getPartyState(playlistId) : null;
    if (partyState?.active) {
        _plPlayerIndex = partyState.currentSongIndex || 0;
        _plPartyActive = true;
        await joinListeningParty(playlistId, songs);
    } else {
        _plPlayerIndex = 0;
        _plPartyActive = false;
    }

    plPlayerRender();
}

function plPlayerRender() {
    const existing = document.getElementById('plPlayerModal');
    if (existing) existing.remove();

    const pl = _plPlayerPlaylist;
    const songs = _plPlayerSongs;
    const idx = _plPlayerIndex;
    const current = songs[idx];
    const meta = PLAYLIST_TYPES[pl.type] || PLAYLIST_TYPES.custom;
    const total = songs.length;

    const modal = document.createElement('div');
    modal.id = 'plPlayerModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;overflow:hidden';

    // Build the song queue list (all songs, current one highlighted)
    const queueRows = songs.map((s, i) => {
        const isCurrent = i === idx;
        const isDone = i < idx;
        return `<div id="plQueueRow_${i}" onclick="plPlayerJumpTo(${i})"
            style="padding:10px 16px;display:flex;align-items:center;gap:10px;
                   cursor:pointer;transition:background 0.15s;
                   background:${isCurrent ? 'rgba(102,126,234,0.15)' : 'transparent'};
                   border-left:3px solid ${isCurrent ? 'var(--accent)' : 'transparent'}">
            <span style="font-size:0.78em;min-width:22px;text-align:right;flex-shrink:0;
                         color:${isCurrent ? 'var(--accent-light)' : isDone ? 'var(--green)' : 'var(--text-dim)'}">
                ${isDone ? '✓' : isCurrent ? '▶' : i + 1}
            </span>
            <div style="flex:1;min-width:0">
                <div style="font-size:0.88em;font-weight:${isCurrent ? '700' : '500'};
                            color:${isCurrent ? 'var(--text)' : isDone ? 'var(--text-dim)' : 'var(--text-muted)'};
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    ${s.songTitle}
                </div>
                ${s.note ? `<div style="font-size:0.72em;color:var(--text-dim);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.note}</div>` : ''}
            </div>
            ${isCurrent ? `<span style="font-size:0.7em;color:var(--accent-light);flex-shrink:0">Now</span>` : ''}
        </div>`;
    }).join('');

    modal.innerHTML = `
        <!-- Header -->
        <div style="background:var(--bg-card);border-bottom:1px solid var(--border);padding:12px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0">
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.95em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pl.name || 'Playlist'}</div>
                <div style="font-size:0.72em;color:var(--text-muted);margin-top:2px">
                    <span style="padding:1px 7px;border-radius:10px;background:${meta.bg};color:${meta.color};border:1px solid ${meta.border};font-weight:600">${meta.label}</span>
                    &nbsp;Song ${idx + 1} of ${total}
                </div>
            </div>
            <button onclick="plPlayerClose()"
                style="background:none;border:none;color:var(--text-muted);font-size:1.4em;cursor:pointer;flex-shrink:0;padding:4px;line-height:1">✕</button>
        </div>

        <!-- Party status bar (shown when party active) -->
        <div id="plPartyBar" style="display:${_plPartyActive ? '' : 'none'};background:rgba(251,191,36,0.1);border-bottom:1px solid rgba(251,191,36,0.25);padding:8px 16px;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-size:0.82em;font-weight:700;color:#fbbf24">🎉 Listening Party</span>
                <div id="plPartyPresence" style="display:flex;gap:5px;flex:1;flex-wrap:wrap"></div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                    <button onclick="plPartyAdvance()" class="btn btn-sm" style="background:rgba(251,191,36,0.2);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);font-size:0.75em;padding:4px 10px">▶▶ Advance All</button>
                    <button id="plPartyHostBtn" onclick="plPartyEnd()" style="display:none" class="btn btn-sm" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);font-size:0.75em;padding:4px 10px">End Party</button>
                    <button id="plPartyLeaveBtn" onclick="plPartyLeave()" class="btn btn-sm" style="background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid var(--border);font-size:0.75em;padding:4px 10px">Leave</button>
                </div>
            </div>
            <div id="plPartyLastAdvanced" style="font-size:0.72em;color:var(--text-dim);margin-top:3px"></div>
        </div>

        <!-- Now Playing card -->
        <div style="background:rgba(102,126,234,0.08);border-bottom:1px solid var(--border);padding:20px 20px 16px;flex-shrink:0">
            <div style="font-size:0.7em;font-weight:700;letter-spacing:0.08em;color:var(--accent-light);text-transform:uppercase;margin-bottom:6px">Now Playing</div>
            <div style="font-size:1.15em;font-weight:700;color:var(--text);margin-bottom:4px;line-height:1.3">${current.songTitle}</div>
            ${current.note ? `<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:10px">${current.note}</div>` : '<div style="margin-bottom:10px"></div>'}

            <!-- Action buttons -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <button id="plOpenBtn" onclick="plPlayerOpenCurrent()"
                    class="btn btn-primary" style="font-size:0.88em;padding:9px 18px;gap:6px">
                    ⏳ Loading…
                </button>
                ${idx > 0 ? `
                <button onclick="plPlayerJumpTo(${idx - 1})"
                    class="btn btn-ghost" style="font-size:0.82em;padding:8px 14px">
                    ◀ Prev
                </button>` : ''}
                ${idx < total - 1 ? `
                <button onclick="plPlayerJumpTo(${idx + 1})"
                    class="btn btn-success" style="font-size:0.88em;padding:9px 18px">
                    Next ▶▶
                </button>` : `
                <div style="font-size:0.82em;color:var(--green);padding:8px;font-weight:600">
                    ✅ End of playlist
                </div>`}
                <div style="flex:1"></div>
                ${isUserSignedIn && !_plPartyActive ? `
                <button onclick="plPartyStart()" class="btn btn-sm"
                    style="background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3);font-size:0.75em;padding:6px 12px;white-space:nowrap">
                    🎉 Start Party
                </button>` : ''}
                ${!isUserSignedIn ? `
                <div style="font-size:0.72em;color:var(--text-dim);text-align:right;line-height:1.4">
                    Opens in Spotify<br>or YouTube
                </div>` : ''}
            </div>
        </div>

        <!-- Queue -->
        <div style="flex:1;overflow-y:auto" id="plQueueList">
            ${queueRows}
        </div>`;

    document.body.appendChild(modal);

    // Scroll current song into view in the queue
    setTimeout(() => {
        const row = document.getElementById(`plQueueRow_${idx}`);
        if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 100);

    // Resolve the current song's URL (and pre-resolve next)
    plPlayerResolveAndUpdate(idx);
    if (idx + 1 < songs.length) plPlayerResolveAndUpdate(idx + 1);
}

// Cache of resolved URLs so we don't re-fetch on navigation
const _plPlayerUrlCache = {};

async function plPlayerResolveAndUpdate(idx) {
    if (_plPlayerUrlCache[idx]) {
        plPlayerUpdateOpenBtn(idx, _plPlayerUrlCache[idx]);
        return;
    }
    const song = _plPlayerSongs[idx];
    if (!song) return;
    const resolved = await resolvePlaylistSongUrl(song);
    _plPlayerUrlCache[idx] = resolved;
    if (idx === _plPlayerIndex) plPlayerUpdateOpenBtn(idx, resolved);
}

function plPlayerUpdateOpenBtn(idx, resolved) {
    if (idx !== _plPlayerIndex) return; // user moved on
    const btn = document.getElementById('plOpenBtn');
    if (!btn) return;
    const srcMeta = getSourceMeta(resolved.source);
    btn.innerHTML = `${srcMeta.icon} Open in ${srcMeta.label}`;
    btn.style.background = srcMeta.color;
    btn.style.color = 'white';
    btn.dataset.url = resolved.url;
}

function plPlayerOpenCurrent() {
    const btn = document.getElementById('plOpenBtn');
    const url = btn?.dataset.url;
    if (!url || url === '') { showToast('Still loading URL…', 1500); return; }
    window.open(url, '_blank', 'noopener');
    // Auto-highlight this row as played
    const row = document.getElementById(`plQueueRow_${_plPlayerIndex}`);
    if (row) row.style.borderLeftColor = 'var(--green)';
}

function plPlayerClose() {
    if (_plPartyActive) leaveListeningParty(true);
    _plPartyActive = false;
    document.getElementById('plPlayerModal')?.remove();
}

function plPlayerJumpTo(idx) {
    _plPlayerIndex = idx;
    // If in a party, advance all members too
    if (_plPartyActive && _plPlayerPlaylist) {
        advancePartyToSong(_plPlayerPlaylist.id, idx, _plPlayerSongs).catch(() => {});
    }
    plPlayerRender();
}

// ── Listening Party actions ───────────────────────────────────────────────────

async function plPartyStart() {
    if (!isUserSignedIn) { showToast('Sign in to start a Listening Party', 2500); return; }
    if (!_plPlayerPlaylist) return;
    _plPartyActive = true;
    await startListeningParty(_plPlayerPlaylist.id, _plPlayerSongs);
    plPlayerRender();
    showToast('🎉 Listening Party started! Band members can join when they open this playlist.', 4000);
    // Refresh playlist index so the "Join Party" badge appears
    plLoadIndex().catch(() => {});
}

async function plPartyAdvance() {
    if (!_plPlayerPlaylist || !_plPartyActive) return;
    const nextIdx = _plPlayerIndex + 1;
    if (nextIdx >= _plPlayerSongs.length) { showToast('Already at the last song', 2000); return; }
    await advancePartyToSong(_plPlayerPlaylist.id, nextIdx, _plPlayerSongs);
    // onPartyUpdate will drive the render via Firebase listener
}

async function plPartyLeave() {
    leaveListeningParty(true);
    _plPartyActive = false;
    plPlayerRender();
    showToast('👋 Left the Listening Party', 2000);
}

async function plPartyEnd() {
    if (!_plPlayerPlaylist) return;
    if (!confirm('End the Listening Party for everyone?')) return;
    await endListeningParty(_plPlayerPlaylist.id);
    _plPartyActive = false;
    plPlayerRender();
    showToast('🛑 Listening Party ended', 2500);
    plLoadIndex().catch(() => {});
}

// Update just the party status bar (called from onPartyUpdate — no full re-render)
function plPartyRenderStatus(party) {
    const bar = document.getElementById('plPartyBar');
    if (!bar) return;
    bar.style.display = '';

    // Presence avatars
    const presenceEl = document.getElementById('plPartyPresence');
    if (presenceEl && party.presence) {
        presenceEl.innerHTML = Object.entries(party.presence)
            .filter(([, p]) => p.online)
            .map(([key]) => {
                const name = getBandMemberName(key);
                const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                return `<span title="${name}" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(251,191,36,0.25);color:#fbbf24;font-size:0.7em;font-weight:700;border:1px solid rgba(251,191,36,0.4)">${initials}</span>`;
            }).join('');
    }

    // Last advanced by
    const advEl = document.getElementById('plPartyLastAdvanced');
    if (advEl && party.lastAdvancedBy) {
        const who = getBandMemberName(party.lastAdvancedBy);
        const when = party.lastAdvancedAt ? new Date(party.lastAdvancedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        advEl.textContent = `Last advanced by ${who}${when ? ' at ' + when : ''}`;
    }

    // Show End Party button only to the host
    const hostBtn = document.getElementById('plPartyHostBtn');
    if (hostBtn) {
        const myKey = getCurrentMemberKey();
        hostBtn.style.display = (myKey && myKey === party.startedBy) ? '' : 'none';
    }
}



async function plConfirmDelete(playlistId) {
    const pl = _plAllLoaded.find(p => p.id === playlistId);
    if (!confirm(`Delete "${pl?.name || 'this playlist'}"? This cannot be undone.`)) return;
    await deletePlaylist(playlistId);
    showToast('🗑️ Playlist deleted', 2000);
    plLoadIndex();
}

