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
    // Reset SWR flag so cache is always checked on page entry
    _slLoadedFromNetwork = false;
    el.innerHTML = '<div class="page-header"><h1>Build Your Set</h1><p>This is what you\u2019ll play. Keep it tight, clear, and fun.</p></div>'
        + '<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap">'
        + '<button class="btn btn-primary" onclick="createNewSetlist()" style="font-size:0.85em">+ Build a New Set</button>'
        + '<div id="slFreshness" class="sl-freshness"></div>'
        + '<div id="slFilterBar" style="display:flex;gap:4px;margin-left:auto"></div></div>'
        + '<div id="setlistsList"><div style="text-align:center;padding:32px;color:var(--text-dim);font-size:0.85em">Loading setlists\u2026</div></div>';
    // Load setlists immediately — don't block on gig history (loads in parallel)
    loadSetlists();
    if (typeof loadGigHistory === 'function') loadGigHistory().catch(function() {});
}

var _slLoadedFromNetwork = false;

// Deep comparison for SWR invalidation — catches edits, reorders, lock changes
function _slDataChanged(cached, fresh) {
    if (!cached || !fresh) return true;
    if (cached.length !== fresh.length) return true;
    for (var i = 0; i < fresh.length; i++) {
        var c = cached[i] || {};
        var f = fresh[i] || {};
        // ID change
        if (c.setlistId !== f.setlistId) return true;
        // Metadata changes
        if (c.name !== f.name || c.date !== f.date || c.notes !== f.notes) return true;
        // Lock state change
        if (!!c.locked !== !!f.locked) return true;
        // Updated timestamp change
        if ((c.updated || '') !== (f.updated || '')) return true;
        // Song count / order checksum
        var cSongs = _slSetlistSongChecksum(c);
        var fSongs = _slSetlistSongChecksum(f);
        if (cSongs !== fSongs) return true;
    }
    return false;
}

function _slSetlistSongChecksum(sl) {
    var parts = [];
    (sl.sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : (item.title || '');
            var seg = typeof item === 'object' ? (item.segue || '') : '';
            parts.push(t + ':' + seg);
        });
    });
    return parts.join('|');
}

async function loadSetlists() {
    var _t0 = performance.now();
    console.log('[PERF] loadSetlists start ' + Math.round(_t0) + 'ms');
    // SWR: render from cache immediately if available
    var _cached = (typeof GLStore !== 'undefined' && GLStore.getCachedBandData) ? GLStore.getCachedBandData('setlists') : null;
    if (_cached && _cached.data && !_slLoadedFromNetwork) {
        console.log('[PERF] setlists SWR cache HIT ' + Math.round(performance.now()) + 'ms (' + GLStore.getCacheAgeLabel('setlists') + ')');
        if (GLStore.setGlobalStatus) GLStore.setGlobalStatus('refreshing', 'Refreshing');
        var _cachedData = toArray(_cached.data);
        if (typeof GLStore !== 'undefined' && GLStore.setSetlistCache) GLStore.setSetlistCache(_cachedData);
        _slRenderList(_cachedData);
        // Background refresh
        loadBandDataFromDrive('_band', 'setlists').then(function(data) {
            var fresh = toArray(data || []);
            _slLoadedFromNetwork = true;
            if (typeof GLStore !== 'undefined' && GLStore.setCachedBandData) GLStore.setCachedBandData('setlists', fresh);
            if (typeof GLStore !== 'undefined' && GLStore.setSetlistCache) GLStore.setSetlistCache(fresh);
            // Deep comparison: check IDs, count, updated timestamps, song counts, lock state
            var _changed = _slDataChanged(_cachedData, fresh);
            if (typeof GLStore !== 'undefined' && GLStore.setGlobalStatus) GLStore.setGlobalStatus('live', 'Live');
            if (_changed) {
                _slRenderList(fresh);
                console.log('[Setlists] SWR: background refresh — repainted (' + fresh.length + ' setlists)');
            } else {
                // Still update freshness indicator even if data unchanged
                var freshEl = document.getElementById('slFreshness');
                if (freshEl) { freshEl.className = 'sl-freshness'; freshEl.textContent = 'Updated just now'; }
                console.log('[Setlists] SWR: background refresh — no changes');
            }
        }).catch(function(e) {
            console.warn('[Setlists] SWR: background refresh failed:', e);
            var freshEl = document.getElementById('slFreshness');
            if (freshEl) { freshEl.className = 'sl-freshness sl-stale'; freshEl.textContent = 'Offline \u2014 showing cached data'; }
        });
        return;
    }

    console.log('[PERF] setlists SWR cache MISS — fetching from Firebase ' + Math.round(performance.now()) + 'ms');
    var rawData;
    try {
        rawData = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        console.log('[PERF] setlists Firebase complete ' + Math.round(performance.now()) + 'ms (' + (rawData ? rawData.length : 0) + ' setlists)');
    } catch(e) {
        console.error('[RenderError] setlists data load failed:', e);
        if (typeof GLRenderState !== 'undefined') GLRenderState.set('setlists', { status: 'error', title: 'Failed to load setlists', message: e.message, retry: "loadSetlists()" });
        return;
    }
    _slLoadedFromNetwork = true;
    // Update SWR cache
    if (typeof GLStore !== 'undefined' && GLStore.setCachedBandData) GLStore.setCachedBandData('setlists', rawData);
    if (typeof GLStore !== 'undefined' && GLStore.setSetlistCache) GLStore.setSetlistCache(rawData);
    else { window._glCachedSetlists = rawData; window._cachedSetlists = rawData; }
    _slRenderList(rawData);
}

function _slRenderList(rawData) {
    var data = rawData.map(function(sl, origIdx) { return Object.assign({}, sl, { _origIdx: origIdx }); });
    var container = document.getElementById('setlistsList');
    if (!container) return;

    // Freshness indicator
    var freshEl = document.getElementById('slFreshness');
    if (freshEl) {
        var ageLabel = (typeof GLStore !== 'undefined' && GLStore.getCacheAgeLabel) ? GLStore.getCacheAgeLabel('setlists') : '';
        if (_slLoadedFromNetwork) {
            freshEl.className = 'sl-freshness';
            freshEl.textContent = ageLabel || 'Updated just now';
        } else if (ageLabel) {
            freshEl.className = 'sl-freshness sl-stale';
            freshEl.textContent = ageLabel + ' \u00B7 Refreshing\u2026';
        }
    }

    // Render filter bar
    var filterBar = document.getElementById('slFilterBar');
    if (filterBar) {
        filterBar.innerHTML = ['all','upcoming','past'].map(function(f) {
            var active = _slFilter === f;
            var label = f === 'all' ? 'All' : f === 'upcoming' ? 'Upcoming' : 'Past';
            return '<button onclick="_slFilter=\'' + f + '\';loadSetlists()" style="font-size:0.72em;font-weight:' + (active ? '800' : '600') + ';padding:3px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (active ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + '">' + label + '</button>';
        }).join('');
    }

    if (data.length === 0) { container.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px"><div style="font-size:1.5em;margin-bottom:8px">\uD83C\uDFB5</div><div style="font-weight:600;margin-bottom:4px">Start your first set.</div><div style="font-size:0.85em;margin-bottom:12px">Add a few songs and GrooveMate can turn them into a real rehearsal set.</div><button class="btn btn-primary" onclick="createNewSetlist()">Build My First Set</button></div>'; return; }

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
        // Mobile list cards: stack with title first, full-width open button
        '@media(max-width:600px){',
        '  .sl-card{flex-direction:column;gap:8px;padding:12px 14px}',
        '  .sl-card-info{width:100%}',
        '  .sl-card-actions{width:100%;gap:8px;order:1}',
        '  .sl-card-actions button{padding:8px 12px;font-size:0.82em;min-height:40px}',
        '  .sl-card-actions .sl-btn-open{flex:1;text-align:center}',
        '  .sl-card-title{white-space:normal;font-size:1em}',
        '  .sl-card-meta{font-size:0.78em;margin-top:4px}',
        '  .sl-card-preview{font-size:0.72em;margin-top:4px;white-space:normal;line-height:1.3}',
        '}',
        // Mobile editor song rows: 2-line stacked card
        '@media(max-width:600px){',
        '  .sl-song-row{flex-wrap:wrap!important;min-height:52px!important;padding:8px 10px!important;gap:6px!important;align-content:center!important}',
        '  .sl-song-row .sl-row-line1{display:flex;align-items:center;gap:6px;width:100%;min-width:0}',
        '  .sl-song-row .sl-row-line2{display:flex;align-items:center;gap:6px;width:100%;padding-left:26px;flex-wrap:wrap}',
        '  .sl-song-row .sl-segue{font-size:0.82em!important;padding:4px 8px!important;min-height:32px}',
        '  .sl-song-row .sl-delete{min-width:32px;min-height:32px;font-size:1em!important;padding:4px 8px!important}',
        '  .sl-break-btn{font-size:0.62em!important;padding:2px 8px!important}',
        '}',
        // Mobile song picker rows
        '@media(max-width:600px){',
        '  #slPickerList label{padding:10px 0!important;min-height:44px}',
        '  #slPickerList label input[type=checkbox]{width:20px!important;height:20px!important}',
        '  #slPickerList label span{font-size:0.9em!important}',
        '}',
        // Mobile search results
        '@media(max-width:600px){',
        '  .sl-search-result{padding:12px 10px!important;min-height:44px;font-size:0.9em!important}',
        '}',
        // Mobile bottom CTA safe area
        '@media(max-width:600px){',
        '  #slMobileSaveBar{padding-bottom:calc(10px + env(safe-area-inset-bottom))!important}',
        '  #slStickyFooter{padding-bottom:calc(12px + env(safe-area-inset-bottom))!important}',
        '}',
        // Freshness indicator
        '.sl-freshness{font-size:0.68em;color:var(--text-dim,#64748b);display:flex;align-items:center;gap:4px;padding:4px 0}',
        '.sl-freshness.sl-refreshing{color:#818cf8}',
        '.sl-freshness.sl-stale{color:#f59e0b}'
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
        + '<button class="sl-btn-open" onclick="editSetlist(' + idx + ')" style="font-size:0.75em;padding:5px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;font-weight:600" title="Open">\u25B6 Open</button>'
        + '<button onclick="slPlaySetlist(' + idx + ')" style="border:1px solid rgba(99,102,241,0.2);background:none;color:#818cf8;font-weight:600" title="Play">\uD83C\uDFA7</button>'
        + (sl.locked
            ? '<button onclick="slUnlockWithWarning(' + idx + ')" style="border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.05);color:#fbbf24;font-weight:600" title="Click to unlock">\uD83D\uDD12 Locked</button>'
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
    if (typeof GLFeedbackService !== 'undefined') GLFeedbackService.startFlow('create_setlist');
    const container = document.getElementById('setlistsList');
    if (!container) return;
    window._slSets = [{ name: 'All Songs', songs: [] }];
    window._slSelectedVenueId = null;
    window._slSelectedVenueName = null;
    // Auto-generate name and date so user can focus on adding songs
    var _today = new Date().toISOString().split('T')[0];
    container.innerHTML = `<div class="app-card"><h3>Build Your Set</h3>
        <div style="margin-bottom:12px">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                <div style="flex:2;min-width:150px"><span class="form-label">Set Name</span><input class="app-input" id="slName" value="" placeholder="e.g. GrizzFest 2026, Friday Rehearsal, Acoustic Set" title="Name your setlist by event, date, or theme"></div>
                <div style="flex:1;min-width:120px"><span class="form-label">Date</span><input class="app-input" id="slDate" type="date" value="${_today}" style="color-scheme:dark"></div>
            </div>
            <details style="font-size:0.82em;color:var(--text-dim)"><summary style="cursor:pointer;padding:4px 0">More options</summary>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
                    <div style="flex:1;min-width:120px"><span class="form-label">Venue</span><div id="slVenuePicker"></div></div>
                    <div style="flex:1;min-width:120px"><span class="form-label">Notes</span><input class="app-input" id="slNotes" placeholder="e.g. Theme, special requests..." title="Notes saved with this setlist"></div>
                </div>
            </details>
        </div>
        <div id="slQuickFillSection" style="margin-bottom:12px;padding:14px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:12px;text-align:center">
            <div style="font-size:0.88em;font-weight:700;color:#a5b4fc;margin-bottom:6px">Start with 3 songs. GrooveMate can finish the rest.</div>
            <button onclick="slQuickFill()" style="padding:12px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.92em;cursor:pointer;box-shadow:0 2px 10px rgba(99,102,241,0.3)">Fill This Out</button>
            <div style="font-size:0.72em;color:#475569;margin-top:6px">or type song names in the search below</div>
        </div>
        <div id="slSets"><div class="app-card" style="background:rgba(255,255,255,0.02)"><h3 style="color:var(--accent-light)">All Songs</h3><div id="slSet0Songs"></div><div style="margin-top:8px"><div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px;font-style:italic">Start with 3 songs. GrooveMate can finish the rest.</div><div style="display:flex;gap:6px;margin-bottom:4px"><input class="app-input" id="slAddSong0" placeholder="Add a song..." oninput="slSearchSong(this,0)" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(0)" style="flex-shrink:0;white-space:nowrap" title="Pick songs from library">📋 Pick</button><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="flex-shrink:0;white-space:nowrap" title="Toggle: show only gig-ready/active songs, or all songs">⚡ All Songs</button></div><div id="slSongResults0"></div></div></div></div>
        <div id="slShowTotal" style="margin-top:8px;padding:8px 12px;border-radius:8px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);font-size:0.75em;color:var(--text-dim)"></div>
        <div style="height:60px"></div></div>
        <div id="slStickyFooter" style="position:sticky;bottom:0;z-index:100;padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));background:linear-gradient(to top,#0f172a 60%,transparent);display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-success" onclick="slSaveSetlist()" style="padding:12px 24px;font-weight:700;font-size:0.92em;box-shadow:0 4px 16px rgba(34,197,94,0.3);min-height:44px">\uD83D\uDD12 Lock This Set</button>
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
    const _activeStatuses = (typeof GLStore !== 'undefined' && GLStore.ACTIVE_STATUSES) ? Object.keys(GLStore.ACTIVE_STATUSES) : ['prospect','learning','rotation','wip','active','gig_ready'];
    const songSource = (typeof GLStore !== 'undefined' && GLStore.getSongs) ? GLStore.getSongs() : (typeof allSongs !== 'undefined' ? allSongs : []);
    const matches = songSource
        .filter(s => s.title.toLowerCase().includes(q))
        .filter(s => !_slOnlyActive || _activeStatuses.includes(GLStore && GLStore.getStatus(s.title)))
        .slice(0, 10);
    var html = matches.map(s => {
        var safeTitle = s.title.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<div class="list-item sl-search-result" style="cursor:pointer;padding:10px 10px;font-size:0.85em" onmousedown="event.preventDefault();slAddSongToSet(${setIdx},'${safeTitle}')">
        <span style="color:var(--text-dim);font-size:0.8em;width:30px">${s.band||''}</span> ${s.title}</div>`;
    }).join('');
    // Show "Add as new song" only when no matching songs exist in the library
    var exactMatch = matches.some(s => s.title.toLowerCase() === q);
    if (!exactMatch && input.value.trim().length >= 2 && matches.length === 0) {
        var safeVal = input.value.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        var displayVal = input.value.trim().replace(/</g, '&lt;');
        html += `<div class="list-item sl-search-result" style="cursor:pointer;padding:10px;font-size:0.85em;color:#818cf8;border-top:1px solid rgba(255,255,255,0.06)" onmousedown="event.preventDefault();slAddSongToSet(${setIdx},'${safeVal}')">+ Add &quot;${displayVal}&quot; to this band</div>`;
    }
    results.innerHTML = html;
    results.style.cssText = 'position:relative;z-index:100000';
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
    slRenderReadinessMeter(); // keep master list in sync
    document.getElementById('slAddSong' + setIdx).value = '';
    document.getElementById('slSongResults' + setIdx).innerHTML = '';
    // Inline assist after 3 songs
    var _slSongCount = (window._slSets[setIdx].songs || []).length;
    if (_slSongCount === 3 && !document.getElementById('slAssistPrompt')) {
        var _assistEl = document.createElement('div');
        _assistEl.id = 'slAssistPrompt';
        _assistEl.style.cssText = 'margin:12px 0;padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:12px;text-align:center;animation:rmRevealIn 0.25s ease';
        _assistEl.innerHTML = '<div style="font-size:0.88em;font-weight:700;color:#a5b4fc;margin-bottom:8px">That\u2019s a solid start. Want me to round this into a full set?</div>'
            + '<div style="display:flex;gap:8px;justify-content:center">'
            + '<button onclick="if(typeof slQuickFill===\'function\')slQuickFill();var p=document.getElementById(\'slAssistPrompt\');if(p)p.remove()" style="padding:8px 16px;border-radius:8px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:700;font-size:0.82em;cursor:pointer">Finish My Set</button>'
            + '<button onclick="var p=document.getElementById(\'slAssistPrompt\');if(p)p.remove()" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);font-weight:600;font-size:0.82em;cursor:pointer">Keep Building</button>'
            + '</div>';
        var _slSetEl = document.getElementById('slSet' + setIdx + 'Songs');
        if (_slSetEl && _slSetEl.parentNode) _slSetEl.parentNode.insertBefore(_assistEl, _slSetEl.nextSibling);
    }
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
    var _isMobile = window.innerWidth <= 600;
    var rows = items.map((item, i) => {
        const s = typeof item === 'string' ? item : item.title;
        const segue = typeof item === 'object' ? (item.segue || 'stop') : 'stop';
        const songData = allSongsList.find(sd => sd.title === s);
        const keyStr = songData?.key ? `<span style="font-size:0.7em;color:#818cf8;background:rgba(129,140,248,0.12);padding:1px 5px;border-radius:4px;border:1px solid rgba(129,140,248,0.2)">${songData.key}</span>` : '';
        const bpmStr = songData?.bpm ? `<span style="font-size:0.7em;color:#94a3b8">\u26a1${songData.bpm}</span>` : '';
        const segueColor = { stop:'#64748b', flow:'#818cf8', segue:'#34d399', cutoff:'#f87171' }[segue] || '#64748b';
        const histTip = typeof getSongHistoryTooltip === 'function' ? getSongHistoryTooltip(s) : '';
        // Compact love + readiness badges
        var _slBl = (typeof GLStore !== 'undefined' && GLStore.getBandLove) ? GLStore.getBandLove(s) : 0;
        var _slAl = (typeof GLStore !== 'undefined' && GLStore.getAudienceLove) ? GLStore.getAudienceLove(s) : 0;
        var _slRd = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(s) : 0;
        var _slBadges = '';
        if (_slBl > 0) _slBadges += '<span style="font-size:0.7em;opacity:0.7" title="Band: ' + _slBl + '/5">' + '\u2764'.repeat(Math.min(_slBl, 5)) + '</span>';
        if (_slAl > 0) _slBadges += '<span style="font-size:0.7em;opacity:0.7" title="Audience: ' + _slAl + '/5">' + '\uD83D\uDC9C'.repeat(Math.min(_slAl, 5)) + '</span>';
        if (_slRd > 0 && _slRd < 3) _slBadges += '<span style="font-size:0.6em;color:#f59e0b;font-weight:700" title="Readiness: ' + _slRd.toFixed(1) + '/5">\u26A0</span>';
        var row;
        if (_isMobile) {
            if (_slEditMode) {
                // EDIT MODE: title dominant, compact controls right-aligned
                row = `<div class="list-item sl-song-row" data-set="${setIdx}" data-idx="${i}"
                    style="display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:default;min-height:44px;border-bottom:1px solid rgba(255,255,255,0.03)">
                    <span style="color:var(--text-dim);min-width:18px;font-weight:600;flex-shrink:0;font-size:0.8em;text-align:right">${i + 1}</span>
                    <span style="flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.92em">${s}</span>
                    ${i > 0 ? `<button onclick="event.stopPropagation();_slMovesong(${setIdx},${i},-1)" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.72em;padding:4px;min-width:24px;min-height:24px">\u25B2</button>` : ''}
                    ${i < items.length - 1 ? `<button onclick="event.stopPropagation();_slMovesong(${setIdx},${i},1)" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.72em;padding:4px;min-width:24px;min-height:24px">\u25BC</button>` : ''}
                    <select class="sl-segue" onchange="_slMarkDirty();slSetSegue(${setIdx},${i},this.value)" onclick="event.stopPropagation()"
                        style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);color:${segueColor};border-radius:5px;padding:2px 4px;font-size:0.68em;font-weight:700;cursor:pointer;flex-shrink:0;min-height:24px">
                        <option value="stop" ${segue==='stop'?'selected':''}>Stop</option>
                        <option value="flow" ${segue==='flow'?'selected':''}>Flow</option>
                        <option value="segue" ${segue==='segue'?'selected':''}>Segue</option>
                        <option value="cutoff" ${segue==='cutoff'?'selected':''}>Cut</option>
                    </select>
                    <button onclick="_slMarkDirty();slRemoveSong(${setIdx},${i})" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.78em;padding:4px;min-width:24px;min-height:24px">\u2715</button>
                </div>`;
            } else {
                // CLEAN BUILD: title-dominant, minimal chrome
                var segIndicator = segue === 'flow' ? '<span style="color:rgba(129,140,248,0.5);font-size:0.82em"> \u2192</span>'
                    : segue === 'segue' ? '<span style="color:rgba(52,211,153,0.5);font-size:0.82em"> ~</span>' : '';
                row = `<div class="list-item sl-song-row" data-set="${setIdx}" data-idx="${i}"
                    style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:default;min-height:40px;border-bottom:1px solid rgba(255,255,255,0.03)">
                    <span style="color:var(--text-dim);min-width:20px;font-weight:600;flex-shrink:0;font-size:0.8em;text-align:right">${i + 1}</span>
                    <span style="flex:1;font-weight:600;font-size:0.95em;color:var(--text,#e2e8f0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s}${segIndicator}</span>
                    ${keyStr ? `<span style="font-size:0.65em;color:rgba(129,140,248,0.4);font-weight:500">${songData?.key || ''}</span>` : ''}
                </div>`;
            }
        } else {
            // Desktop: compact single-line row
            row = `<div class="list-item sl-song-row" data-set="${setIdx}" data-idx="${i}" draggable="true"
                style="padding:3px 6px;font-size:0.82em;gap:4px;align-items:center;cursor:default;min-height:28px" title="${histTip.replace(/"/g,'&quot;')}">
                <span class="sl-drag" style="color:#475569;cursor:grab;font-size:0.9em;flex-shrink:0">\u2807</span>
                <span style="color:var(--text-dim);min-width:16px;font-weight:600;flex-shrink:0;font-size:0.85em">${i + 1}</span>
                <span style="flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s}</span>
                ${_slBadges}${keyStr}${bpmStr}
                <select class="sl-segue" onchange="_slMarkDirty();slSetSegue(${setIdx},${i},this.value)" onclick="event.stopPropagation()"
                    title="Transition: · = Full Stop, → = Flow into next, ~ = Segue/blend, | = Hard cutoff"
                    style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:${segueColor};border-radius:4px;padding:1px 3px;font-size:0.72em;font-weight:700;cursor:pointer;flex-shrink:0">
                    <option value="stop" ${segue==='stop'?'selected':''} title="Full stop between songs">·</option>
                    <option value="flow" ${segue==='flow'?'selected':''} title="Flow directly into next song">→</option>
                    <option value="segue" ${segue==='segue'?'selected':''} title="Segue / blend into next">~</option>
                    <option value="cutoff" ${segue==='cutoff'?'selected':''} title="Hard cutoff">|</option>
                </select>
                <button class="btn btn-sm btn-ghost sl-delete" onclick="_slMarkDirty();slRemoveSong(${setIdx},${i})" style="padding:1px 4px;flex-shrink:0;font-size:0.82em">\u2715</button>
            </div>`;
        }
        // Set Break button — desktop only, or edit mode on mobile
        if (i < items.length - 1 && !_isMobile) {
            row += `<div style="text-align:center;height:0;overflow:visible;position:relative"><button class="sl-break-btn" onclick="slInsertSetBreak(${setIdx},${i + 1})" style="font-size:0.5em;padding:0 6px;border:1px dashed rgba(245,158,11,0.2);background:rgba(15,23,42,0.95);color:#64748b;border-radius:3px;cursor:pointer;opacity:0.3;transition:opacity 0.15s;position:relative;top:-5px;z-index:1;line-height:1.4" onmouseover="this.style.opacity='1';this.style.color='#fbbf24'" onmouseout="this.style.opacity='0.3';this.style.color='#64748b'">add a break</button></div>`;
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
            slRenderReadinessMeter(); // keep master list in sync
        });
    });
    _slUpdateShowTotal();
    _slRenderSetIntelligence();
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
    slRenderReadinessMeter(); // keep master list in sync
}

// Toggle edit mode in Plan view — shows/hides row controls
window._slToggleEditMode = function() {
    _slEditMode = !_slEditMode;
    // Re-render all set songs with new mode
    (window._slSets || []).forEach(function(set, si) { slRenderSetSongs(si); });
    // Update toggle button appearance
    var btn = document.getElementById('slEditToggle');
    if (btn) {
        btn.textContent = _slEditMode ? '\u2713 Editing' : '\u270F Edit';
        btn.style.borderColor = _slEditMode ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)';
        btn.style.background = _slEditMode ? 'rgba(99,102,241,0.12)' : 'none';
        btn.style.color = _slEditMode ? '#a5b4fc' : '#64748b';
    }
};

// Mobile: expand one set at a time in Plan mode
window._slExpandSet = function(si) {
    _slExpandedSet = si;
    var idx = window._slEditIdx;
    var data = window._cachedSetlists || [];
    var sl = data[idx] || {};
    _slRenderPlanMode(idx, sl);
};

// Mobile move up/down (replaces drag-and-drop on touch devices)
function _slMovesong(setIdx, songIdx, dir) {
    var songs = window._slSets[setIdx]?.songs;
    if (!songs) return;
    var target = songIdx + dir;
    if (target < 0 || target >= songs.length) return;
    var moved = songs.splice(songIdx, 1)[0];
    songs.splice(target, 0, moved);
    if (typeof _slMarkDirty === 'function') _slMarkDirty();
    slRenderSetSongs(setIdx);
    slRenderReadinessMeter();
}
window._slMovesong = _slMovesong;

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
            <div style="margin-top:8px"><div style="display:flex;gap:6px;margin-bottom:4px"><input class="app-input" id="slAddSong${idx}" placeholder="Add a song..." oninput="slSearchSong(this,${idx})" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(${idx})" style="flex-shrink:0;white-space:nowrap" title="Pick songs from library">📋 Pick</button><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="flex-shrink:0;white-space:nowrap" title="Toggle: show only gig-ready/active songs, or all songs">⚡ All Songs</button></div><div id="slSongResults${idx}"></div></div>
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
        showToast('\u26A0\uFE0F Saved locally \u2014 will sync when connected');
    }
    if (typeof GLUXTracker !== 'undefined') GLUXTracker.completeFlow('create_setlist');
    if (typeof GLFeedbackService !== 'undefined') GLFeedbackService.completeFlow('create_setlist');
    // Onboarding: mark setlist step complete + navigate to Home for Step 2
    var _wasOnboarding = typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.getOnboardStep && GLAvatarGuide.getOnboardStep() === 1;
    if (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.completeOnboardStep) GLAvatarGuide.completeOnboardStep('setlist');
    if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
    else { window._cachedSetlists = null; window._glCachedSetlists = null; }
    if (_wasOnboarding && typeof showPage === 'function') {
        setTimeout(function() { showPage('home'); }, 800);
    } else {
        // Show post-save confirmation inline
        var container = document.getElementById('setlistsList');
        if (container) {
            container.innerHTML = '<div style="text-align:center;padding:40px 20px">'
                + '<div style="font-size:1.3em;font-weight:800;color:#f1f5f9;margin-bottom:8px">Set locked. You\u2019re ready to rehearse.</div>'
                + '<div style="display:flex;gap:10px;justify-content:center;margin-top:16px">'
                + '<button onclick="if(typeof _glQuickStartRehearsal===\'function\')_glQuickStartRehearsal();else showPage(\'rehearsal\')" style="padding:12px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.92em;cursor:pointer">Start Rehearsal</button>'
                + '<button onclick="loadSetlists()" style="padding:12px 24px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);font-weight:600;font-size:0.92em;cursor:pointer">Done</button>'
                + '</div></div>';
        } else {
            loadSetlists();
        }
    }
}

// ── Setlist mode state ──
var _slViewMode = 'plan'; // 'plan' | 'stage'
var _slExpandedSet = 0; // which set is expanded in plan mode (mobile)
var _slEditMode = false; // false = clean build (titles only), true = full controls

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
    _slViewMode = 'plan';
    _slEditMode = false;
    _slExpandedSet = 0;

    const container = document.getElementById('setlistsList');
    var _isMobile = window.innerWidth <= 900;

    // ── Sticky header (shared between Plan and Live) ──
    var safeName = (sl.name||'').replace(/"/g,'&quot;');
    var safeNotes = (sl.notes||'').replace(/"/g,'&quot;');
    var totalSongs = (sl.sets||[]).reduce(function(a,s){return a+(s.songs||[]).length;},0);
    var headerHtml = '<div id="slModeHeader" style="position:sticky;top:0;z-index:10;background:#0f172a;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.08);margin:0 -14px">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<button onclick="loadSetlists()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;padding:4px">\u2190</button>'
        + '<span style="font-weight:700;font-size:0.95em;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (sl.name||'Setlist') + '</span>'
        + (sl.locked ? '<span style="font-size:0.68em;color:#fbbf24;font-weight:700">\uD83D\uDD12 Locked</span>' : '')
        + '<span style="font-size:0.68em;color:var(--text-dim)">' + totalSongs + ' songs</span>'
        + '</div>'
        // Mode toggle: segmented control — tall, bold, unmissable
        + '<div style="display:flex;gap:0;margin-top:8px;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03)">'
        + '<button id="slModePlan" onclick="_slSwitchMode(\'plan\')" style="flex:1;padding:10px 8px;font-size:0.85em;font-weight:800;cursor:pointer;border:none;background:rgba(99,102,241,0.18);color:#a5b4fc;font-family:inherit;min-height:44px;letter-spacing:0.02em;-webkit-tap-highlight-color:transparent">\u270F\uFE0F Plan</button>'
        + '<button id="slModeStage" onclick="_slSwitchMode(\'stage\')" style="flex:1;padding:10px 8px;font-size:0.85em;font-weight:800;cursor:pointer;border:none;border-left:1px solid rgba(255,255,255,0.1);background:transparent;color:#64748b;font-family:inherit;min-height:44px;letter-spacing:0.02em;-webkit-tap-highlight-color:transparent">\uD83C\uDFA4 Stage</button>'
        + '</div></div>';

    container.innerHTML = '<div class="app-card" style="padding:0 14px 14px">'
        + headerHtml
        + '<div id="slModeContent" style="padding-top:8px"></div>'
        + '<div style="height:80px"></div>'
        + '<div id="slMobileSaveBar" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:9998;background:rgba(15,23,42,0.97);border-top:1px solid rgba(99,102,241,0.3);padding:10px 16px;padding-bottom:calc(10px + env(safe-area-inset-bottom));gap:8px">'
        + '<button class="btn btn-ghost" onclick="loadSetlists()" style="flex:1;font-size:0.88em;min-height:44px">Cancel</button>'
        + '<button class="btn btn-success" onclick="slSaveSetlistEdit(' + idx + ')" style="flex:2;font-size:0.92em;font-weight:700;min-height:44px">\uD83D\uDD12 Lock This Set</button>'
        + '</div></div>';

    // Render plan mode content
    _slRenderPlanMode(idx, sl);

    // Init venue picker
    GLStore.getVenues().then(function(slVenues) {
        var slPreselected = null;
        if (sl.venueId) slPreselected = slVenues.find(function(v){ return v.venueId === sl.venueId; });
        if (!slPreselected && sl.venue) slPreselected = slVenues.find(function(v){ return v.name === sl.venue; });
        _slInitVenuePicker(slVenues, slPreselected);
    }).catch(function() {});

    if (_isMobile) {
        var mBar = document.getElementById('slMobileSaveBar');
        if (mBar) mBar.style.display = 'flex';
    }
}

// ── Mode switching ──
window._slSwitchMode = function(mode) {
    _slViewMode = mode;
    var planBtn = document.getElementById('slModePlan');
    var stageBtn = document.getElementById('slModeStage');
    if (planBtn) {
        planBtn.style.background = mode === 'plan' ? 'rgba(99,102,241,0.18)' : 'transparent';
        planBtn.style.color = mode === 'plan' ? '#a5b4fc' : '#64748b';
    }
    if (stageBtn) {
        stageBtn.style.background = mode === 'stage' ? 'rgba(34,197,94,0.15)' : 'transparent';
        stageBtn.style.color = mode === 'stage' ? '#86efac' : '#64748b';
    }
    // Hide/show save bar
    var saveBar = document.getElementById('slMobileSaveBar');
    if (saveBar) saveBar.style.display = mode === 'plan' ? 'flex' : 'none';

    var idx = window._slEditIdx;
    var data = window._cachedSetlists || [];
    var sl = data[idx] || {};
    if (mode === 'plan') _slRenderPlanMode(idx, sl);
    else _slRenderStageView(idx, sl);
};

// ── STAGE VIEW — pre-gig readiness + launch surface ──
// ── STAGE VIEW — pre-gig readiness + launch surface ──
// Read-only. Only interactions: Start Gig + expand/collapse sets.
// Visual hierarchy: confidence meter → CTA → coaching → sets (collapsed)
function _slRenderStageView(idx, sl) {
    var content = document.getElementById('slModeContent');
    if (!content) return;

    var _hasStore = typeof GLStore !== 'undefined';
    var _songKeyMap = {};
    (typeof allSongs !== 'undefined' ? allSongs : []).forEach(function(s) { if (s.key) _songKeyMap[s.title] = s.key; });

    // Confidence labels — band language, not data language
    function _readinessLabel(pct) {
        if (pct >= 80) return { text: 'Locked in', color: '#22c55e', level: 'strong' };
        if (pct >= 50) return { text: 'Getting there', color: '#f59e0b', level: 'mixed' };
        if (pct > 0)   return { text: 'Needs work', color: '#ef4444', level: 'weak' };
        return { text: 'Not rated yet', color: '#475569', level: 'unrated' };
    }

    // Coaching — calm bandmate voice, specific, no alarm
    function _coachingText(totalWarn, totalSongs, totalReady, warnTitles) {
        if (totalWarn === 0) return '';
        if (totalWarn === 1) return 'Give \u201C' + warnTitles[0] + '\u201D a run before you go on';
        if (totalWarn === 2) return 'Hit \u201C' + warnTitles[0] + '\u201D and \u201C' + warnTitles[1] + '\u201D at soundcheck';
        if (totalWarn <= 4) return totalWarn + ' songs could use a quick run-through';
        var strongCount = totalReady;
        if (strongCount > totalWarn) return 'You\u2019ve got ' + strongCount + ' strong \u2014 lean on those early';
        return totalWarn + ' songs still rough. Start with what you know.';
    }

    // Gather stats + collect weak song titles for coaching
    var setStats = [];
    var totalSongs = 0, totalReady = 0, totalWarn = 0, totalUnrated = 0;
    var warnTitles = [];
    (window._slSets || []).forEach(function(set, si) {
        var songs = set.songs || [];
        var ready = 0, warn = 0, unrated = 0;
        songs.forEach(function(item) {
            var title = typeof item === 'string' ? item : (item.title || '');
            var avg = (_hasStore && GLStore.avgReadiness) ? GLStore.avgReadiness(title) : 0;
            if (avg >= 4) ready++;
            else if (avg > 0 && avg < 3) { warn++; if (warnTitles.length < 3) warnTitles.push(title); }
            else if (avg === 0) unrated++;
        });
        var pct = songs.length ? Math.round(ready / songs.length * 100) : 0;
        setStats.push({ name: set.name || 'Set ' + (si+1), count: songs.length, ready: ready, warn: warn, unrated: unrated, pct: pct, songs: songs });
        totalSongs += songs.length;
        totalReady += ready;
        totalWarn += warn;
        totalUnrated += unrated;
    });
    var overallPct = totalSongs ? Math.round(totalReady / totalSongs * 100) : 0;
    var overallLabel = _readinessLabel(overallPct);

    var html = '';

    // ── 1. CONFIDENCE METER — how ready is the band? ──
    html += '<div style="text-align:center;padding:16px 12px 12px;margin-bottom:4px">';
    var arcSize = 80;
    var arcStroke = 7;
    var circumference = Math.PI * (arcSize - arcStroke);
    var filled = circumference * (overallPct / 100);
    html += '<div style="position:relative;width:' + arcSize + 'px;height:' + (arcSize / 2 + 10) + 'px;margin:0 auto">';
    html += '<svg width="' + arcSize + '" height="' + (arcSize / 2 + 6) + '" viewBox="0 0 ' + arcSize + ' ' + (arcSize / 2 + 6) + '">';
    html += '<path d="M ' + arcStroke + ' ' + (arcSize / 2) + ' A ' + (arcSize / 2 - arcStroke) + ' ' + (arcSize / 2 - arcStroke) + ' 0 0 1 ' + (arcSize - arcStroke) + ' ' + (arcSize / 2) + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="' + arcStroke + '" stroke-linecap="round"/>';
    html += '<path d="M ' + arcStroke + ' ' + (arcSize / 2) + ' A ' + (arcSize / 2 - arcStroke) + ' ' + (arcSize / 2 - arcStroke) + ' 0 0 1 ' + (arcSize - arcStroke) + ' ' + (arcSize / 2) + '" fill="none" stroke="' + overallLabel.color + '" stroke-width="' + arcStroke + '" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (circumference - filled) + '" style="transition:stroke-dashoffset 0.4s ease"/>';
    html += '</svg>';
    html += '<div style="position:absolute;bottom:0;left:0;right:0;text-align:center">';
    html += '<div style="font-size:1.4em;font-weight:800;color:' + overallLabel.color + ';line-height:1">' + overallLabel.text + '</div>';
    html += '</div></div>';
    // Subtitle — human, not data-dump
    var _meterSub = totalSongs === 0 ? 'No songs in this set'
        : overallLabel.level === 'strong' ? totalReady + ' of ' + totalSongs + ' ready to play'
        : overallLabel.level === 'mixed' ? totalReady + ' solid, ' + totalWarn + ' need a run'
        : overallLabel.level === 'weak' ? 'Only ' + totalReady + ' of ' + totalSongs + ' feel tight'
        : 'Rate your songs to see readiness';
    html += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:4px">' + _meterSub + '</div>';
    html += '</div>';

    // ── 2. LAUNCH CTA — style adapts to confidence ──
    var _ctaBg = overallLabel.level === 'strong' ? 'linear-gradient(135deg,#22c55e,#16a34a)'
        : overallLabel.level === 'mixed' ? 'linear-gradient(135deg,#22c55e,#65a30d)'
        : 'linear-gradient(135deg,#22c55e,#16a34a)';
    var _ctaShadow = overallLabel.level === 'strong' ? '0 4px 20px rgba(34,197,94,0.3)'
        : '0 4px 16px rgba(34,197,94,0.2)';
    var _ctaLabel = '\uD83C\uDFA4 Start Gig';
    html += '<button onclick="_slLaunchLiveGig(' + idx + ')" style="display:block;width:100%;padding:16px;border-radius:12px;border:none;background:' + _ctaBg + ';color:white;font-size:1.1em;font-weight:800;cursor:pointer;min-height:54px;box-shadow:' + _ctaShadow + ';font-family:inherit;margin-bottom:10px;-webkit-tap-highlight-color:transparent">' + _ctaLabel + '</button>';

    // ── 3. COACHING — calm bandmate voice, no alarm icons ──
    var coaching = _coachingText(totalWarn, totalSongs, totalReady, warnTitles);
    if (coaching) {
        html += '<div style="padding:10px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;font-size:0.8em;color:#94a3b8;line-height:1.4">';
        html += coaching;
        html += '</div>';
    }

    // ── 4. PER-SET READINESS CARDS (collapsed) ──
    setStats.forEach(function(stat, si) {
        if (!stat.count) return;
        var label = _readinessLabel(stat.pct);
        var setId = 'slStageSet' + si;

        html += '<div style="margin-bottom:6px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);overflow:hidden">';
        html += '<div onclick="var el=document.getElementById(\'' + setId + '\');el.style.display=el.style.display===\'none\'?\'\':\'none\';this.querySelector(\'.sl-chev\').style.transform=el.style.display===\'none\'?\'rotate(0)\':\'rotate(90deg)\'" style="display:flex;align-items:center;gap:8px;padding:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:48px">';
        html += '<span class="sl-chev" style="font-size:0.7em;color:var(--text-dim);transition:transform 0.15s">\u25B8</span>';
        html += '<span style="font-weight:700;font-size:0.9em;color:var(--text,#e2e8f0)">' + stat.name + '</span>';
        html += '<span style="font-size:0.72em;color:var(--text-dim)">' + stat.count + '</span>';
        if (stat.warn > 0) html += '<span style="font-size:0.7em;color:#fbbf24;font-weight:700">' + stat.warn + '\u26A0</span>';
        html += '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">';
        html += '<div style="width:48px;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + stat.pct + '%;background:' + label.color + ';border-radius:3px"></div></div>';
        html += '<span style="font-size:0.72em;font-weight:700;color:' + label.color + ';min-width:42px;text-align:right">' + label.text + '</span>';
        html += '</div></div>';

        // Expanded song list (hidden by default)
        html += '<div id="' + setId + '" style="display:none;padding:2px 12px 10px">';
        stat.songs.forEach(function(item, i) {
            var title = typeof item === 'string' ? item : (item.title || '');
            var segue = typeof item === 'object' ? (item.segue || 'stop') : 'stop';
            var avg = (_hasStore && GLStore.avgReadiness) ? GLStore.avgReadiness(title) : 0;
            // Visual hierarchy: weak songs LOUD, strong songs quiet
            var isWeak = avg > 0 && avg < 3;
            var isStrong = avg >= 4;
            var rdBarW = isWeak ? '5px' : '3px';
            var rdBarH = isWeak ? '24px' : '18px';
            var rdColor = isWeak ? '#f59e0b' : isStrong ? 'rgba(34,197,94,0.35)' : avg >= 3 ? 'rgba(129,140,248,0.35)' : '#262e3d';
            var titleWeight = isWeak ? '700' : '500';
            var titleColor = isWeak ? '#fbbf24' : 'var(--text,#e2e8f0)';
            var segStr = segue === 'flow' ? ' \u2192' : segue === 'segue' ? ' ~' : '';
            var segColor = segue === 'flow' ? 'rgba(129,140,248,0.5)' : segue === 'segue' ? 'rgba(52,211,153,0.5)' : '';

            // 40px min-height, 7px vertical padding — iPhone thumb safe
            html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.03);min-height:40px">';
            html += '<span style="color:' + (isWeak ? '#f59e0b' : 'var(--text-dim)') + ';font-weight:600;min-width:20px;font-size:0.78em;text-align:right">' + (i + 1) + '</span>';
            html += '<div style="width:' + rdBarW + ';height:' + rdBarH + ';border-radius:2px;background:' + rdColor + ';flex-shrink:0"></div>';
            // Title dominant, key demoted
            html += '<span style="flex:1;font-weight:' + titleWeight + ';font-size:0.92em;color:' + titleColor + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + title + (segStr ? '<span style="color:' + segColor + ';font-size:0.82em">' + segStr + '</span>' : '') + '</span>';
            var key = _songKeyMap[title];
            if (key) html += '<span style="font-size:0.62em;color:rgba(129,140,248,0.4);font-weight:500">' + key + '</span>';
            html += '</div>';
        });
        html += '</div></div>';
    });

    content.innerHTML = html;
}

// Launch into existing Live Gig mode
window._slLaunchLiveGig = function(idx) {
    var data = window._cachedSetlists || [];
    var sl = data[idx];
    if (!sl) { if (typeof showToast === 'function') showToast('Setlist not found'); return; }
    // Set the launch handoff for live-gig.js
    window._lgLaunchSetlistId = sl.setlistId;
    if (typeof showPage === 'function') showPage('live-gig');
};

// ── PLAN MODE — editor view ──
function _slRenderPlanMode(idx, sl) {
    var content = document.getElementById('slModeContent');
    if (!content) return;
    var safeName = (sl.name||'').replace(/"/g,'&quot;');
    var safeNotes = (sl.notes||'').replace(/"/g,'&quot;');
    var _isMobile = window.innerWidth <= 900;

    var html = '';
    // Edit fields (collapsed on mobile behind details)
    if (_isMobile) {
        html += '<details style="margin-bottom:8px"><summary style="font-size:0.78em;color:var(--text-dim);cursor:pointer;padding:4px 0">Edit details</summary>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'
            + '<input class="app-input" id="slName" value="' + safeName + '" placeholder="Name" style="flex:2;min-width:120px;font-weight:700;font-size:0.85em;padding:5px 8px">'
            + '<input class="app-input" id="slDate" type="date" value="' + (sl.date||'') + '" style="width:120px;padding:5px 8px;font-size:0.82em;color-scheme:dark">'
            + '</div>'
            + '<input class="app-input" id="slNotes" value="' + safeNotes + '" placeholder="Notes..." style="width:100%;margin-top:4px;font-size:0.78em;padding:4px 8px;color:var(--text-dim);box-sizing:border-box">'
            + '<div id="slVenuePicker" style="margin-top:4px"></div>'
            + '</details>';
    } else {
        html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px">'
            + '<input class="app-input" id="slName" value="' + safeName + '" placeholder="Setlist name" style="flex:2;min-width:120px;font-weight:700;font-size:0.9em;padding:5px 8px">'
            + '<input class="app-input" id="slDate" type="date" value="' + (sl.date||'') + '" style="width:130px;padding:5px 8px;font-size:0.82em;color-scheme:dark">'
            + '<div id="slVenuePicker" style="flex:1;min-width:100px"></div>'
            + '</div>'
            + '<input class="app-input" id="slNotes" value="' + safeNotes + '" placeholder="Notes..." style="width:100%;margin-bottom:6px;font-size:0.78em;padding:4px 8px;color:var(--text-dim);box-sizing:border-box">';
    }

    html += '<div id="slLinkedGigRow" style="margin-bottom:6px"></div>';
    // Readiness meter: collapsed on mobile (full detail lives in Stage View)
    if (_isMobile) {
        html += '<div id="slReadinessMeter" style="display:none"></div>';
    } else {
        html += '<div id="slReadinessMeter" style="margin-bottom:6px"></div>';
    }

    // Actions bar — includes Edit toggle on mobile
    html += '<div id="slStickyActions" style="display:flex;gap:6px;align-items:center;margin-bottom:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06)">';
    if (_isMobile) {
        html += '<button id="slEditToggle" onclick="_slToggleEditMode()" style="font-size:0.75em;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (_slEditMode ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)') + ';background:' + (_slEditMode ? 'rgba(99,102,241,0.12)' : 'none') + ';color:' + (_slEditMode ? '#a5b4fc' : '#64748b') + ';font-family:inherit;min-height:30px">' + (_slEditMode ? '\u2713 Editing' : '\u270F Edit') + '</button>';
    }
    html += '<button class="btn btn-ghost btn-sm" onclick="slShareSetlist(' + idx + ')" style="color:#94a3b8;font-size:0.75em">\uD83D\uDCE4</button>'
        + '<span id="slDirtyIndicator" style="display:none;font-size:0.68em;color:#f59e0b;font-weight:700">\u25CF Unsaved</span>'
        + '<button class="btn btn-success btn-sm" onclick="slSaveSetlistEdit(' + idx + ')" style="margin-left:auto;font-size:0.78em;padding:4px 14px">\uD83D\uDD12 Lock This Set</button>'
        + '<button class="btn btn-ghost btn-sm" onclick="loadSetlists()" style="font-size:0.75em">Cancel</button>'
        + '</div>';

    // Sets — collapsible on mobile (one expanded at a time)
    html += '<div id="slSets">';
    window._slSets.forEach(function(set, si) {
        var setSongs = set.songs || [];
        var setCount = setSongs.length;
        var durLabel = setCount ? ' \u00B7 ' + setCount + ' songs \u00B7 ~' + _slDurationLabel(setSongs) : '';
        var setActions = '';
        if (si > 0) {
            setActions = '<div style="margin-left:auto;display:flex;gap:3px">'
                + '<button onclick="slMoveSetUp(' + si + ')" style="padding:2px 8px;background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:4px;cursor:pointer;font-size:0.68em;font-weight:600;min-height:28px">\u2191</button>'
                + '<button onclick="slMergeSets(' + si + ')" style="padding:2px 8px;background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:4px;cursor:pointer;font-size:0.68em;font-weight:600;min-height:28px">Merge \u2191</button>'
                + '</div>';
        }
        var isExpanded = !_isMobile || si === _slExpandedSet;
        var toggleAttr = _isMobile ? ' onclick="_slExpandSet(' + si + ')"' : '';
        html += '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">'
            + '<div style="display:flex;align-items:center;font-size:0.78em;font-weight:700;color:var(--accent-light);margin-bottom:' + (isExpanded ? '4' : '0') + 'px;cursor:' + (_isMobile ? 'pointer' : 'default') + '"' + toggleAttr + '>'
            + (_isMobile ? '<span style="font-size:0.8em;margin-right:4px;opacity:0.5;transition:transform 0.15s;transform:rotate(' + (isExpanded ? '90' : '0') + 'deg)">\u25B8</span>' : '')
            + '<span onclick="event.stopPropagation();slRenameSet(' + si + ')" style="cursor:pointer;border-bottom:1px dashed rgba(255,255,255,0.15)" title="Click to rename">' + (set.name || 'Set ' + (si+1)) + '</span>'
            + '<span style="font-weight:400;color:var(--text-dim);font-size:0.88em">' + durLabel + '</span>' + setActions + '</div>'
            + '<div id="slSet' + si + 'Songs" style="' + (isExpanded ? '' : 'display:none') + '"></div>'
            + (isExpanded ? '<div style="margin-top:6px"><div style="display:flex;gap:4px"><input class="app-input" id="slAddSong' + si + '" placeholder="Add a song..." oninput="slSearchSong(this,' + si + ')" style="flex:1;font-size:0.85em;padding:8px 10px;border-radius:8px">' + (_slEditMode || !_isMobile ? '<button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(' + si + ')" style="font-size:0.72em;flex-shrink:0;min-height:36px">\uD83D\uDCCB Pick</button>' : '') + '</div><div id="slSongResults' + si + '"></div></div>' : '')
            + '</div>';
    });
    html += '</div>';
    html += '<div id="slShowTotal" style="margin-top:10px;padding:8px 12px;border-radius:8px;background:rgba(99,102,241,0.05);border:1px solid rgba(99,102,241,0.15);font-size:0.75em;color:var(--text-dim);display:flex;align-items:center;justify-content:space-between"></div>';

    content.innerHTML = html;

    // Render songs + enrich
    window._slSets.forEach(function(set, si) { slRenderSetSongs(si); });
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
    showToast('\u2705 Set locked');
    if (typeof GLStore !== 'undefined' && GLStore.logBandActivity) {
        var _slName = document.getElementById('slName') ? document.getElementById('slName').value : '';
        GLStore.logBandActivity('setlist_locked', { name: _slName || 'Setlist' });
    }
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
            + '<div style="margin-top:4px"><div style="display:flex;gap:4px"><input class="app-input" id="slAddSong' + si + '" placeholder="Add a song..." oninput="slSearchSong(this,' + si + ')" style="flex:1;font-size:0.78em;padding:4px 6px"><button class="btn btn-ghost btn-sm" onclick="slOpenSongPicker(' + si + ')" style="font-size:0.68em;flex-shrink:0" title="Pick songs from library">📋 Pick</button><button class="btn btn-ghost btn-sm" onclick="slToggleActiveFilter(this)" style="font-size:0.68em;flex-shrink:0">All</button></div><div id="slSongResults' + si + '"></div></div>'
            + '</div>';
    }).join('');
    // Render songs for each set
    window._slSets.forEach(function(set, si) { slRenderSetSongs(si); });
    _slUpdateShowTotal();
    slRenderReadinessMeter(); // keep master list in sync
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
    var hint = setCount <= 1 && totalSongs > 5 ? '<span style="color:#fbbf24;font-weight:600"> · Use ✂ add a break between songs to split into sets</span>' : '';
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

// Active statuses: canonical definition from GLStore
var _slActiveStatuses = GLStore.ACTIVE_STATUSES;
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

// ============================================================================
// SETLIST INTELLIGENCE — Energy Model, Flow Visualization, Insights
// ============================================================================

// Energy score per song: audience-weighted (what the crowd feels)
// Scale 1-5 normalized
function _slSongEnergy(title) {
    if (typeof GLStore === 'undefined') return 2.5;
    var al = GLStore.getAudienceLove ? GLStore.getAudienceLove(title) : 0;
    var bl = GLStore.getBandLove ? GLStore.getBandLove(title) : 0;
    var rd = GLStore.avgReadiness ? GLStore.avgReadiness(title) : 0;
    // If nothing is rated, return neutral
    if (al === 0 && bl === 0 && rd === 0) return 0;
    var raw = (al * 0.6) + (bl * 0.3) + (rd * 0.1);
    // Normalize: if only partial data, scale from what we have
    var weight = (al > 0 ? 0.6 : 0) + (bl > 0 ? 0.3 : 0) + (rd > 0 ? 0.1 : 0);
    if (weight > 0 && weight < 1) raw = raw / weight; // normalize partial
    return Math.round(raw * 10) / 10;
}

// Color for energy level
function _slEnergyColor(e) {
    if (e === 0) return 'rgba(255,255,255,0.08)';
    if (e >= 4) return '#22c55e';
    if (e >= 3) return '#84cc16';
    if (e >= 2) return '#f59e0b';
    return '#ef4444';
}

// Render energy flow strip + insights for the full setlist
function _slRenderSetIntelligence() {
    // Remove old panel if exists
    var old = document.getElementById('slIntelPanel');
    if (old) old.remove();

    // Gather all songs across all sets
    var allSongs = [];
    (window._slSets || []).forEach(function(set, si) {
        (set.songs || []).forEach(function(item) {
            var title = typeof item === 'string' ? item : (item.title || '');
            if (title && !(item.break)) allSongs.push({ title: title, setIdx: si });
        });
    });
    if (allSongs.length < 2) return; // need at least 2 songs for flow

    // Compute energy per song
    var energies = allSongs.map(function(s) {
        return { title: s.title, energy: _slSongEnergy(s.title), setIdx: s.setIdx };
    });
    var ratedCount = energies.filter(function(e) { return e.energy > 0; }).length;
    if (ratedCount < 2) return; // not enough data

    // Build energy flow strip
    var maxE = Math.max.apply(null, energies.map(function(e) { return e.energy || 1; }));
    var stripHtml = '<div style="display:flex;align-items:flex-end;gap:2px;height:40px;margin-bottom:8px">';
    energies.forEach(function(e) {
        var pct = e.energy > 0 ? Math.round((e.energy / maxE) * 100) : 10;
        var color = _slEnergyColor(e.energy);
        var shortTitle = e.title.length > 12 ? e.title.substring(0, 11) + '\u2026' : e.title;
        stripHtml += '<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:1px" title="' + e.title.replace(/"/g, '&quot;') + ': ' + (e.energy > 0 ? e.energy.toFixed(1) : 'unrated') + '/5">'
            + '<div style="width:100%;height:' + pct + '%;min-height:3px;background:' + color + ';border-radius:3px 3px 0 0;transition:height 0.2s"></div>'
            + '</div>';
    });
    stripHtml += '</div>';
    // Labels: first, peak, last
    var peakIdx = 0;
    energies.forEach(function(e, i) { if (e.energy > energies[peakIdx].energy) peakIdx = i; });
    stripHtml += '<div style="display:flex;justify-content:space-between;font-size:0.55em;color:var(--text-dim)">'
        + '<span>Open</span>'
        + '<span>Peak: ' + energies[peakIdx].title.split(' ').slice(0, 3).join(' ') + '</span>'
        + '<span>Close</span></div>';

    // Generate insights (max 4)
    var insights = _slGenerateInsights(energies, allSongs);

    // Build panel
    var panel = document.createElement('div');
    panel.id = 'slIntelPanel';
    panel.style.cssText = 'margin-top:12px;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.04)';
    panel.innerHTML = '<div style="font-size:0.68em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">\uD83C\uDFB6 Set Energy</div>'
        + stripHtml
        + (insights.length ? '<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.04);padding-top:8px">'
            + insights.map(function(ins) {
                return '<div style="font-size:0.72em;color:' + (ins.color || 'var(--text-dim)') + ';padding:2px 0;display:flex;align-items:flex-start;gap:6px">'
                    + '<span style="flex-shrink:0">' + ins.icon + '</span>'
                    + '<span>' + ins.text + '</span></div>';
            }).join('') + '</div>' : '');

    // Insert after the show total element
    var showTotal = document.getElementById('slShowTotal');
    if (showTotal) {
        showTotal.parentNode.insertBefore(panel, showTotal);
    }
}

function _slGenerateInsights(energies, allSongs) {
    var insights = [];
    var _hasStore = typeof GLStore !== 'undefined';

    // 1. Energy flow analysis
    var first3Avg = energies.slice(0, Math.min(3, energies.length)).reduce(function(s, e) { return s + e.energy; }, 0) / Math.min(3, energies.length);
    var last3Avg = energies.slice(-Math.min(3, energies.length)).reduce(function(s, e) { return s + e.energy; }, 0) / Math.min(3, energies.length);
    var midStart = Math.floor(energies.length * 0.3);
    var midEnd = Math.ceil(energies.length * 0.7);
    var midSlice = energies.slice(midStart, midEnd);
    var midAvg = midSlice.length ? midSlice.reduce(function(s, e) { return s + e.energy; }, 0) / midSlice.length : 0;

    if (first3Avg > 0 && first3Avg < 2.5) {
        insights.push({ icon: '\u26A0', text: 'Starts flat \u2014 consider opening with a stronger song', color: '#f59e0b' });
    } else if (first3Avg >= 4) {
        insights.push({ icon: '\u2705', text: 'Strong opener \u2014 good energy out of the gate', color: '#22c55e' });
    }
    if (midAvg > 0 && midAvg < first3Avg * 0.7 && midAvg < last3Avg * 0.7) {
        insights.push({ icon: '\u26A0', text: 'Energy dips mid-set \u2014 consider a crowd favorite in the middle', color: '#f59e0b' });
    }
    if (last3Avg >= 3.5) {
        insights.push({ icon: '\u2705', text: 'Strong finish \u2014 set ends on a high note', color: '#22c55e' });
    } else if (last3Avg > 0 && last3Avg < 2.5) {
        insights.push({ icon: '\u26A0', text: 'Ends quiet \u2014 consider a bigger closer', color: '#f59e0b' });
    }

    // 2. Love balance
    var highAudience = 0, lowImpact = 0;
    allSongs.forEach(function(s) {
        var al = _hasStore && GLStore.getAudienceLove ? GLStore.getAudienceLove(s.title) : 0;
        var bl = _hasStore && GLStore.getBandLove ? GLStore.getBandLove(s.title) : 0;
        if (al >= 4) highAudience++;
        if (al > 0 && al < 3 && bl > 0 && bl < 3) lowImpact++;
    });
    if (highAudience >= allSongs.length * 0.5) {
        insights.push({ icon: '\uD83D\uDC9C', text: 'Crowd-heavy set \u2014 strong audience impact', color: '#a855f7' });
    } else if (highAudience === 0 && allSongs.length >= 4) {
        insights.push({ icon: '\u26A0', text: 'No crowd favorites \u2014 consider adding one the audience loves', color: '#f59e0b' });
    }
    if (lowImpact >= 3) {
        insights.push({ icon: '\u26A0', text: lowImpact + ' low-impact songs \u2014 consider swapping for higher energy', color: '#f59e0b' });
    }

    // 3. Readiness check
    var notReady = 0;
    allSongs.forEach(function(s) {
        var avg = _hasStore && GLStore.avgReadiness ? GLStore.avgReadiness(s.title) : 0;
        if (avg > 0 && avg < 3) notReady++;
    });
    if (notReady > 0) {
        insights.push({ icon: '\u26A0', text: notReady + ' song' + (notReady > 1 ? 's' : '') + ' may not be ready for this gig', color: '#f59e0b' });
    } else if (allSongs.length >= 4) {
        var anyRated = allSongs.some(function(s) { return _hasStore && GLStore.avgReadiness && GLStore.avgReadiness(s.title) > 0; });
        if (anyRated) insights.push({ icon: '\u2705', text: 'All songs gig-ready', color: '#22c55e' });
    }

    return insights.slice(0, 4); // max 4 insights
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
