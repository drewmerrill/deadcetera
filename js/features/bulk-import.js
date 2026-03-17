// ============================================================================
// js/features/bulk-import.js
// Bulk song + chart URL import with artist-based browsing.
// LEGAL: stores chart URLs only — never scrapes or stores chart content.
// ============================================================================

'use strict';

window.showBulkImportModal = function() {
    var existing = document.getElementById('bulkImportModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'bulkImportModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

    modal.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:600px;width:100%;color:var(--text);max-height:85vh;overflow-y:auto">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<h3 style="margin:0;color:var(--accent-light)">🎵 Bulk Song Import</h3>'
        + '<button onclick="document.getElementById(\'bulkImportModal\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>'
        + '</div>'
        + '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:16px">Add multiple songs at once. Each song will start as "Learning" with chart links auto-generated.</div>'

        // Step 1: Choose method
        + '<div style="display:flex;gap:8px;margin-bottom:16px">'
        + '<button onclick="_bulkImportShowArtist()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;font-weight:700;cursor:pointer;font-size:0.85em">Browse by Artist</button>'
        + '<button onclick="_bulkImportShowPaste()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-muted);font-weight:600;cursor:pointer;font-size:0.85em">Paste Song List</button>'
        + '</div>'

        + '<div id="bulkImportContent"></div>'
        + '</div>';

    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    _bulkImportShowArtist();
};

// ── Browse by Artist ─────────────────────────────────────────────────────────
window._bulkImportShowArtist = function() {
    var el = document.getElementById('bulkImportContent');
    if (!el) return;

    // Build artist list from data.js songs
    var artists = {};
    if (typeof allSongs !== 'undefined') {
        allSongs.forEach(function(s) {
            var a = s.band || s.artist || 'Other';
            if (!artists[a]) artists[a] = 0;
            artists[a]++;
        });
    }

    var artistBtns = Object.entries(artists).sort(function(a,b) { return b[1] - a[1]; }).map(function(e) {
        return '<button onclick="_bulkImportBrowseArtist(\'' + e[0].replace(/'/g, "\\'") + '\')" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);cursor:pointer;font-size:0.82em">' + e[0] + ' <span style="opacity:0.5">(' + e[1] + ')</span></button>';
    }).join('');

    el.innerHTML = '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:8px">Select an artist to browse their songs:</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + artistBtns + '</div>'
        + '<div style="font-size:0.72em;color:var(--text-dim)">Or add a custom artist below:</div>'
        + '<div style="display:flex;gap:6px;margin-top:6px">'
        + '<input id="bulkCustomArtist" placeholder="Artist name" style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.85em">'
        + '<button onclick="_bulkImportBrowseArtist(document.getElementById(\'bulkCustomArtist\').value)" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-weight:700;font-size:0.82em">Browse</button>'
        + '</div>';
};

window._bulkImportBrowseArtist = function(artist) {
    if (!artist) return;
    var el = document.getElementById('bulkImportContent');
    if (!el) return;

    // Find songs by this artist in allSongs
    var artistSongs = [];
    if (typeof allSongs !== 'undefined') {
        artistSongs = allSongs.filter(function(s) { return (s.band || s.artist || '') === artist; });
    }

    if (artistSongs.length === 0) {
        // No songs in catalog — show paste mode for this artist
        el.innerHTML = '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:8px">No songs found for <strong>' + artist + '</strong> in catalog.</div>'
            + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Paste a list of song titles (one per line):</div>'
            + '<textarea id="bulkPasteInput" placeholder="Song Title 1\nSong Title 2\nSong Title 3" style="width:100%;height:120px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:8px;font-size:0.85em;box-sizing:border-box;resize:vertical"></textarea>'
            + '<input type="hidden" id="bulkPasteArtist" value="' + artist + '">'
            + '<button onclick="_bulkImportFromPaste()" style="margin-top:8px;padding:8px 16px;border-radius:8px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac;font-weight:700;cursor:pointer;font-size:0.85em;width:100%">Import Songs</button>';
        return;
    }

    // Show selectable song list
    var existingTitles = new Set();
    if (typeof allSongs !== 'undefined') allSongs.forEach(function(s) { if (s.isCustom) existingTitles.add(s.title.toLowerCase()); });

    var rows = artistSongs.map(function(s, i) {
        var alreadyCustom = existingTitles.has(s.title.toLowerCase());
        return '<label style="display:flex;align-items:center;gap:6px;padding:4px 6px;font-size:0.82em;color:var(--text);cursor:pointer' + (alreadyCustom ? ';opacity:0.4' : '') + '">'
            + '<input type="checkbox" class="bulk-song-check" data-title="' + s.title.replace(/"/g, '&quot;') + '" data-artist="' + (s.band || artist) + '"' + (alreadyCustom ? ' disabled' : '') + ' style="accent-color:var(--accent)">'
            + s.title + (alreadyCustom ? ' <span style="font-size:0.72em;color:var(--text-dim)">(already added)</span>' : '')
            + '</label>';
    }).join('');

    el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
        + '<span style="font-size:0.82em;font-weight:700;color:var(--text)">' + artist + ' — ' + artistSongs.length + ' songs</span>'
        + '<button onclick="_bulkImportShowArtist()" style="font-size:0.72em;color:var(--text-dim);background:none;border:none;cursor:pointer">← Back</button>'
        + '</div>'
        + '<div style="display:flex;gap:6px;margin-bottom:8px">'
        + '<button onclick="document.querySelectorAll(\'.bulk-song-check:not(:disabled)\').forEach(function(c){c.checked=true})" style="font-size:0.7em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Select All</button>'
        + '<button onclick="document.querySelectorAll(\'.bulk-song-check\').forEach(function(c){c.checked=false})" style="font-size:0.7em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Clear</button>'
        + '</div>'
        + '<div style="max-height:250px;overflow-y:auto;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:4px">' + rows + '</div>'
        + '<div style="margin-top:8px;display:flex;gap:8px">'
        + '<button onclick="_bulkImportSelected(\'' + artist.replace(/'/g, "\\'") + '\')" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac;font-weight:700;cursor:pointer;font-size:0.85em">Import Selected + Generate Chart Links</button>'
        + '</div>';
};

// ── Paste mode ───────────────────────────────────────────────────────────────
window._bulkImportShowPaste = function() {
    var el = document.getElementById('bulkImportContent');
    if (!el) return;
    el.innerHTML = '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Paste song titles (one per line). Optionally add artist name.</div>'
        + '<input id="bulkPasteArtist" placeholder="Artist/Band name" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.85em;margin-bottom:8px;box-sizing:border-box">'
        + '<textarea id="bulkPasteInput" placeholder="Song Title 1\nSong Title 2\nSong Title 3" style="width:100%;height:150px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:8px;font-size:0.85em;box-sizing:border-box;resize:vertical"></textarea>'
        + '<button onclick="_bulkImportFromPaste()" style="margin-top:8px;padding:8px 16px;border-radius:8px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac;font-weight:700;cursor:pointer;font-size:0.85em;width:100%">Import Songs + Generate Chart Links</button>';
};

// ── Import from paste ────────────────────────────────────────────────────────
window._bulkImportFromPaste = function() {
    var input = document.getElementById('bulkPasteInput');
    var artistInput = document.getElementById('bulkPasteArtist');
    if (!input || !input.value.trim()) { alert('Paste at least one song title'); return; }
    var artist = (artistInput && artistInput.value.trim()) || 'Other';
    var titles = input.value.trim().split('\n').map(function(t) { return t.trim(); }).filter(function(t) { return t; });
    _bulkDoImport(titles.map(function(t) { return { title: t, artist: artist }; }));
};

// ── Import from selected checkboxes ──────────────────────────────────────────
window._bulkImportSelected = function(artist) {
    var checks = document.querySelectorAll('.bulk-song-check:checked');
    if (!checks.length) { alert('Select at least one song'); return; }
    var songs = [];
    checks.forEach(function(c) { songs.push({ title: c.dataset.title, artist: c.dataset.artist || artist }); });
    _bulkDoImport(songs);
};

// ── Core import logic ────────────────────────────────────────────────────────
async function _bulkDoImport(songs) {
    var el = document.getElementById('bulkImportContent');
    if (!el) return;

    el.innerHTML = '<div style="text-align:center;padding:20px">'
        + '<div style="font-size:1.5em;margin-bottom:8px">⏳</div>'
        + '<div style="font-weight:700">Importing ' + songs.length + ' songs...</div>'
        + '</div>';

    var existingTitles = new Set();
    allSongs.forEach(function(s) { existingTitles.add(s.title.toLowerCase()); });

    var customSongs = toArray(await loadBandDataFromDrive('_band', 'custom_songs') || []);
    var added = 0, skipped = 0;

    for (var i = 0; i < songs.length; i++) {
        var s = songs[i];
        if (existingTitles.has(s.title.toLowerCase())) { skipped++; continue; }

        var songId = 'c_' + generateShortId(8);
        var newSong = {
            songId: songId,
            title: s.title,
            artist: s.artist || 'Other',
            band: s.artist || 'Other',
            originType: 'bulk_import',
            addedBy: (typeof currentUserEmail !== 'undefined' ? currentUserEmail : '') || 'unknown',
            addedAt: new Date().toISOString()
        };
        customSongs.push(newSong);
        allSongs.push({ songId: songId, title: s.title, artist: s.artist || 'Other', band: s.artist || 'Other', isCustom: true, addedBy: newSong.addedBy, notes: '' });
        existingTitles.add(s.title.toLowerCase());

        // Songs import to Library scope (no status = library)
        // User activates songs they want to work on via Songs page

        // Generate chart URL (Ultimate Guitar search — stores URL, not content)
        var chartUrl = 'https://www.ultimate-guitar.com/search.php?search_type=title&value=' + encodeURIComponent(s.title + ' ' + (s.artist || ''));
        if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
            GLStore.saveSongData(s.title, 'chart_url', { url: chartUrl, source: 'ultimate-guitar', addedAt: new Date().toISOString() });
        }

        added++;
        if (i > 0 && i % 10 === 0) await new Promise(function(r) { setTimeout(r, 50); });
    }

    await saveBandDataToDrive('_band', 'custom_songs', customSongs);
    if (typeof GLStore !== 'undefined' && GLStore.rebuildSongIndexes) GLStore.rebuildSongIndexes();
    if (typeof GLStore !== 'undefined' && GLStore.emit) GLStore.emit('songs:imported', { added: added, skipped: skipped });
    if (typeof renderSongs === 'function') renderSongs();

    // Show results
    el.innerHTML = '<div style="text-align:center;padding:20px">'
        + '<div style="font-size:2em;margin-bottom:8px">🎉</div>'
        + '<div style="font-size:1.1em;font-weight:700;color:#22c55e;margin-bottom:4px">' + added + ' songs imported!</div>'
        + (skipped > 0 ? '<div style="font-size:0.82em;color:var(--text-dim)">' + skipped + ' duplicates skipped.</div>' : '')
        + '<div style="font-size:0.82em;color:var(--text-dim);margin:8px 0">Songs added to your Library with chart search links.</div>'
        + '<div style="font-size:0.78em;color:var(--accent-light);margin-bottom:12px">Next: switch to Library view and set songs you\'re working on to "Learning" to activate them.</div>'
        + '<div style="display:flex;gap:8px;justify-content:center">'
        + '<button onclick="document.getElementById(\'bulkImportModal\').remove();showPage(\'songs\')" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;font-weight:700;cursor:pointer">View Songs</button>'
        + '<button onclick="document.getElementById(\'bulkImportModal\').remove()" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer">Close</button>'
        + '</div></div>';
}

console.log('✅ bulk-import.js loaded');
