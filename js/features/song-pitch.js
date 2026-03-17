// ============================================================================
// js/features/song-pitch.js
// Song Pitch System — structured song intake with voting and tradeoff logic.
// Lives in Band Room. Integrates with Active/Library scope model.
// ============================================================================

'use strict';

// ── Render Pitch Section (called from Band Room page) ────────────────────────
window.renderSongPitchSection = async function(container) {
    if (!container) return;
    var pitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    var pending = pitches.filter(function(p) { return p.status === 'pending'; });
    var backlog = pitches.filter(function(p) { return p.status === 'rejected' || p.status === 'deferred'; });

    var html = '<div style="margin-bottom:16px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
        + '<h3 style="margin:0;font-size:0.95em;color:var(--text)">🎤 Song Pitches</h3>'
        + '<button onclick="showPitchModal()" style="font-size:0.75em;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">+ Pitch a Song</button>'
        + '</div>';

    if (pending.length === 0 && backlog.length === 0) {
        html += '<div style="font-size:0.82em;color:var(--text-dim);padding:12px;text-align:center;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">No active pitches. Suggest a song for the band to learn.</div>';
    }

    // Pending pitches
    pending.forEach(function(p) {
        var myKey = typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : null;
        var votes = p.votes || {};
        var yesCount = Object.values(votes).filter(function(v) { return v === 'yes'; }).length;
        var noCount = Object.values(votes).filter(function(v) { return v === 'no'; }).length;
        var deferCount = Object.values(votes).filter(function(v) { return v === 'defer'; }).length;
        var totalVotes = Object.keys(votes).length;
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
        var majority = Math.ceil(memberCount / 2);
        var myVote = myKey ? (votes[myKey] || null) : null;

        html += '<div style="padding:10px 12px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:8px;margin-bottom:8px">'
            + '<div style="display:flex;align-items:center;justify-content:space-between">'
            + '<div><div style="font-weight:700;font-size:0.88em;color:var(--text)">' + (p.title || 'Untitled') + '</div>'
            + (p.reason ? '<div style="font-size:0.75em;color:var(--text-dim);margin-top:2px">"' + p.reason + '"</div>' : '')
            + '<div style="font-size:0.68em;color:var(--text-dim);margin-top:2px">Pitched by ' + (p.pitchedBy || 'someone') + ' · Votes are anonymous</div></div>'
            + '<div style="text-align:right"><div style="font-size:0.68em;color:var(--text-dim)">' + totalVotes + ' of ' + memberCount + ' voted · needs ' + majority + ' yes</div>'
            + '<div style="font-size:0.72em;margin-top:2px"><span style="color:#22c55e">👍 ' + yesCount + '</span> <span style="color:#ef4444">👎 ' + noCount + '</span> <span style="color:var(--text-dim)">🤷 ' + deferCount + '</span></div></div>'
            + '</div>';

        // Tradeoff preview
        if (p.replaceSong) {
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:6px;padding:4px 8px;background:rgba(255,255,255,0.02);border-radius:4px">'
                + 'If approved: <strong style="color:#22c55e">' + (p.title || '') + '</strong> → Active · <strong style="color:#f59e0b">' + p.replaceSong + '</strong> → Library'
                + '</div>';
        }

        // Vote buttons — always shown, current vote highlighted, can change
        if (myKey) {
            var _pid = (p.id || '').replace(/'/g, "\\'");
            var _vStyle = function(type, isActive) {
                var colors = { yes: ['34,197,94', '#22c55e'], no: ['239,68,68', '#ef4444'], defer: ['255,255,255', 'var(--text-dim)'] };
                var c = colors[type] || colors.defer;
                return 'font-size:0.72em;padding:3px 10px;border-radius:5px;cursor:pointer;border:' + (isActive ? '2px' : '1px') + ' solid rgba(' + c[0] + ',' + (isActive ? '0.6' : '0.2') + ');background:rgba(' + c[0] + ',' + (isActive ? '0.15' : '0.05') + ');color:' + c[1] + ';font-weight:' + (isActive ? '800' : '600');
            };
            html += '<div style="display:flex;gap:6px;margin-top:6px">'
                + '<button onclick="votePitch(\'' + _pid + '\',\'yes\')" style="' + _vStyle('yes', myVote === 'yes') + '">👍 Yes</button>'
                + '<button onclick="votePitch(\'' + _pid + '\',\'no\')" style="' + _vStyle('no', myVote === 'no') + '">👎 No</button>'
                + '<button onclick="votePitch(\'' + _pid + '\',\'defer\')" style="' + _vStyle('defer', myVote === 'defer') + '">🤷 Not now</button>'
                + '</div>';
        }
        html += '</div>';
    });

    // Backlog (collapsed)
    if (backlog.length > 0) {
        html += '<details style="margin-top:8px"><summary style="font-size:0.72em;color:var(--text-dim);cursor:pointer">Backlog (' + backlog.length + ' songs)</summary>';
        backlog.forEach(function(p) {
            html += '<div style="font-size:0.78em;color:var(--text-dim);padding:4px 8px;display:flex;justify-content:space-between">'
                + '<span>' + (p.title || '') + '</span>'
                + '<button onclick="showPitchModal(\'' + (p.title || '').replace(/'/g, "\\'") + '\')" style="font-size:0.68em;background:none;border:none;color:var(--accent-light);cursor:pointer">Re-pitch</button>'
                + '</div>';
        });
        html += '</details>';
    }

    html += '</div>';
    container.innerHTML = html;
};

// ── Pitch Modal ──────────────────────────────────────────────────────────────
window.showPitchModal = function(prefillTitle) {
    var existing = document.getElementById('pitchModal');
    if (existing) existing.remove();

    // Find suggested replacement (lowest readiness active song)
    var suggestReplace = '';
    try {
        var _rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
        var _sc = (typeof statusCache !== 'undefined') ? statusCache : {};
        var _activeSongs = (typeof allSongs !== 'undefined') ? allSongs.filter(function(s) {
            var st = _sc[s.title] || '';
            return st === 'prospect' || st === 'learning' || st === 'rotation';
        }) : [];
        var _withScores = _activeSongs.map(function(s) {
            var scores = _rc[s.title] || {};
            var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
            return { title: s.title, avg: vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : 99 };
        }).sort(function(a,b) { return a.avg - b.avg; });
        if (_withScores.length > 0 && _withScores[0].avg < 99) suggestReplace = _withScores[0].title;
    } catch(e) {}

    var modal = document.createElement('div');
    modal.id = 'pitchModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:480px;width:100%;color:var(--text)">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<h3 style="margin:0;color:var(--accent-light)">🎤 Pitch a Song</h3>'
        + '<button onclick="document.getElementById(\'pitchModal\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>'
        + '</div>'
        + '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:12px">Propose a song for the band to learn. Band members will vote.</div>'
        + '<div style="font-size:0.72em;color:#f59e0b;padding:6px 8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.12);border-radius:6px;margin-bottom:12px">Adding a song requires replacing or delaying another Active song.</div>'
        + '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Song Title</label>'
        + '<input id="pitchTitle" value="' + (prefillTitle || '') + '" placeholder="e.g. Green Eyed Lady" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.88em;box-sizing:border-box;margin-bottom:10px">'
        + '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Why this song?</label>'
        + '<input id="pitchReason" placeholder="e.g. Great crowd-pleaser, easy to learn" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.85em;box-sizing:border-box;margin-bottom:10px">'
        + '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Replace which Active song?</label>'
        + '<input id="pitchReplace" value="' + suggestReplace + '" placeholder="e.g. Tennessee Jed (suggested: lowest readiness)" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.85em;box-sizing:border-box;margin-bottom:6px">'
        + (suggestReplace ? '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:10px">Suggested: <strong>' + suggestReplace + '</strong> (lowest readiness in Active set)</div>' : '')
        + '<button onclick="submitPitch()" style="width:100%;padding:10px;border-radius:8px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.12);color:#a5b4fc;font-weight:700;cursor:pointer;font-size:0.88em">Submit Pitch for Vote</button>'
        + '</div>';
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};

// ── Submit Pitch ─────────────────────────────────────────────────────────────
window.submitPitch = async function() {
    var title = (document.getElementById('pitchTitle') || {}).value || '';
    var reason = (document.getElementById('pitchReason') || {}).value || '';
    var replaceSong = (document.getElementById('pitchReplace') || {}).value || '';
    if (!title.trim()) { alert('Enter a song title'); return; }

    // Guard: check if song is already Active
    if (typeof isSongActive === 'function' && isSongActive(title.trim())) {
        alert(title.trim() + ' is already in your Active set.');
        return;
    }

    // Guard: check if there's already a pending pitch for this song
    var existingPitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    if (existingPitches.some(function(p) { return p.status === 'pending' && p.title.toLowerCase() === title.trim().toLowerCase(); })) {
        alert('There is already a pending pitch for ' + title.trim());
        return;
    }

    // Warn if replacement song is targeted by another pending pitch
    if (replaceSong.trim()) {
        var _conflicting = existingPitches.filter(function(p) { return p.status === 'pending' && p.replaceSong && p.replaceSong.toLowerCase() === replaceSong.trim().toLowerCase(); });
        if (_conflicting.length > 0) {
            if (!confirm(replaceSong.trim() + ' is already targeted for replacement in another pitch. Continue anyway?')) return;
        }
    }

    var memberKey = typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : 'unknown';
    var memberName = '';
    if (typeof bandMembers !== 'undefined' && bandMembers[memberKey]) memberName = bandMembers[memberKey].name || memberKey;

    var pitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    var newPitch = {
        id: (typeof generateShortId === 'function') ? generateShortId(10) : Date.now().toString(36),
        title: title.trim(),
        reason: reason.trim(),
        replaceSong: replaceSong.trim(),
        pitchedBy: memberName || memberKey,
        pitchedAt: new Date().toISOString(),
        status: 'pending',
        votes: {}
    };
    pitches.push(newPitch);
    await saveBandDataToDrive('_band', 'song_pitches', pitches);

    document.getElementById('pitchModal').remove();
    if (typeof showToast === 'function') showToast('Song pitched! Band members can now vote.');

    // Refresh pitch section if visible
    var container = document.getElementById('bcPitchSection');
    if (container) renderSongPitchSection(container);

    // Emit event
    if (typeof GLStore !== 'undefined' && GLStore.emit) GLStore.emit('songPitched', { title: title });
};

// ── Vote on Pitch ────────────────────────────────────────────────────────────
window.votePitch = async function(pitchId, vote) {
    var memberKey = typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : null;
    if (!memberKey || !pitchId) return;

    var pitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    var pitch = pitches.find(function(p) { return p.id === pitchId; });
    if (!pitch) return;

    if (!pitch.votes) pitch.votes = {};
    pitch.votes[memberKey] = vote;

    // Check if majority reached (simple majority of band members)
    var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
    var yesCount = Object.values(pitch.votes).filter(function(v) { return v === 'yes'; }).length;
    var noCount = Object.values(pitch.votes).filter(function(v) { return v === 'no'; }).length;
    var majority = Math.ceil(memberCount / 2);

    if (yesCount >= majority) {
        // APPROVED — activate song, shelve replacement
        pitch.status = 'approved';
        pitch.decidedAt = new Date().toISOString();

        // Add song to library if not exists, then set to prospect
        if (typeof allSongs !== 'undefined' && !allSongs.find(function(s) { return s.title === pitch.title; })) {
            var customSongs = toArray(await loadBandDataFromDrive('_band', 'custom_songs') || []);
            customSongs.push({ songId: 'c_' + generateShortId(8), title: pitch.title, artist: 'Other', band: 'Other', originType: 'pitch', addedBy: pitch.pitchedBy, addedAt: new Date().toISOString() });
            await saveBandDataToDrive('_band', 'custom_songs', customSongs);
            if (typeof loadCustomSongs === 'function') await loadCustomSongs();
        }
        if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
            GLStore.updateSongField(pitch.title, 'status', 'prospect');
            if (pitch.replaceSong) GLStore.updateSongField(pitch.replaceSong, 'status', 'shelved');
        }
        if (typeof showToast === 'function') showToast('Approved! ' + pitch.title + ' is now Active.');
    } else if (noCount >= majority) {
        // REJECTED — move to backlog
        pitch.status = 'rejected';
        pitch.decidedAt = new Date().toISOString();
        if (typeof showToast === 'function') showToast(pitch.title + ' was not approved. Moved to backlog.');
    }

    await saveBandDataToDrive('_band', 'song_pitches', pitches);

    // Refresh
    var container = document.getElementById('bcPitchSection');
    if (container) renderSongPitchSection(container);
};

console.log('✅ song-pitch.js loaded');
