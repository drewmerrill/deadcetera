// ============================================================================
// js/features/multitrack-rehearsal.js
//
// Multitrack rehearsal ingest + per-track playback.
// Phase A: import flow (drag-drop FLAC folder → filename inference → mapping
// confirmation → R2 upload → Firebase session write) + multitrack player
// (mute / solo / master scrub).
//
// Filename convention is STRICT: NN_role-member.flac
//   01_kick-jay.flac, 09_vocal-drew.flac, etc.
// REAPER export checklist lives at:
//   02_GrooveLinx/specs/multitrack_reaper_export_checklist.md
//
// DEPENDS ON globals: WORKER_URL, currentBandSlug, bandPath, firebaseDB,
//   BAND_MEMBERS_ORDERED, bandMembers, currentUserEmail, showToast, escHtml
//
// EXPOSES window.* handlers:
//   _mtOpenImportModal, _mtFilesPicked, _mtConfirmMapping, _mtCancelImport,
//   _mtOpenPlayer, _mtTogglePlayAll, _mtToggleMute, _mtToggleSolo,
//   _mtSeekMaster, _mtClosePlayer
//
// Phase B (comments + segments) and Phase D (storage tier automation) build
// on this module — keep the data-shape additive.
// ============================================================================

'use strict';

// ── Catalogs ─────────────────────────────────────────────────────────────────

// Canonical role keys → display labels and an instrument grouping for the
// future drum-submix automation (Phase D). Order is the default render
// order in the multitrack player. Add new roles by extending this map.
var _MT_ROLES = {
    'kick':      { label: 'Kick',      group: 'drums', order: 1 },
    'snare':     { label: 'Snare',     group: 'drums', order: 2 },
    'hat':       { label: 'Hi-Hat',    group: 'drums', order: 3 },
    'tom-1':     { label: 'Tom 1',     group: 'drums', order: 4 },
    'tom-2':     { label: 'Tom 2',     group: 'drums', order: 5 },
    'tom-3':     { label: 'Tom 3',     group: 'drums', order: 6 },
    'ride':      { label: 'Ride',      group: 'drums', order: 7 },
    'oh-l':      { label: 'OH Left',   group: 'drums', order: 8 },
    'oh-r':      { label: 'OH Right',  group: 'drums', order: 9 },
    'room-l':    { label: 'Room L',    group: 'room',  order: 10 },
    'room-r':    { label: 'Room R',    group: 'room',  order: 11 },
    'bass':      { label: 'Bass',      group: 'bass',  order: 20 },
    'guitar':    { label: 'Guitar',    group: 'guitar', order: 30 },
    'guitar-l':  { label: 'Guitar L',  group: 'guitar', order: 31 },
    'guitar-r':  { label: 'Guitar R',  group: 'guitar', order: 32 },
    'keys':      { label: 'Keys',      group: 'keys',  order: 40 },
    'keys-l':    { label: 'Keys L',    group: 'keys',  order: 41 },
    'keys-r':    { label: 'Keys R',    group: 'keys',  order: 42 },
    'vocal':     { label: 'Vocal',     group: 'vocal', order: 50 },
    'vocal-bg':  { label: 'BGV',       group: 'vocal', order: 51 },
    'click':     { label: 'Click',     group: 'misc',  order: 90 },
    'aux':       { label: 'Aux',       group: 'misc',  order: 99 }
};

// Phase B: fixed tag catalog. Multi-select on each comment. Optional —
// adding a comment without tags stays one keystroke + Enter. Order matters
// for chip rendering. Drew picked these 11 explicitly when greenlighting B.
var _MT_TAGS = [
    'rushed', 'dragged', 'pitchy', 'wrong chord', 'missed cue',
    'transition', 'too loud', 'too quiet', 'tone', 'nail this', 'revisit'
];

// Module-level state
var _mtState = {
    pickedFiles: [],     // [{file, inferredRole, inferredMember}]
    sessionId: null,
    uploads: {},         // { trackId: { progress, status, url } }
    player: null,        // { sessionId, tracks, audios, masterPlaying, soloed, muted, comments, composerTags, anchorTrackId }
    composerTags: {}     // { tagName: true } — fresh per comment
};

// ── Filename inference ───────────────────────────────────────────────────────
// Strict pattern: NN_role-member.ext (member optional). Examples that parse:
//   01_kick-jay.flac        → role:kick,    member:jay
//   04_oh-l-jay.flac        → role:oh-l,    member:jay   (multi-token role)
//   06_bass-brian.flac      → role:bass,    member:brian
//   12_room-l.flac          → role:room-l,  member:null  (no member tail)
// Returns { role, memberKey, normalizedFilename } or null on no match.
function _mtInferFromFilename(name) {
    var m = String(name || '').toLowerCase().match(/^(\d{1,3})_([a-z0-9-]+)\.(flac|wav|opus|mp3|m4a)$/i);
    if (!m) return null;
    var idx = parseInt(m[1], 10);
    var stem = m[2]; // e.g., 'kick-jay' or 'oh-l-jay' or 'bass'
    var ext = m[3].toLowerCase();

    // Strategy: walk known role keys longest-first; the rest after the role
    // prefix is the member key (or empty).
    var roleKeys = Object.keys(_MT_ROLES).sort(function(a, b) { return b.length - a.length; });
    var role = null, memberKey = null;
    for (var i = 0; i < roleKeys.length; i++) {
        var rk = roleKeys[i];
        if (stem === rk) { role = rk; memberKey = null; break; }
        if (stem.indexOf(rk + '-') === 0) {
            role = rk;
            memberKey = stem.substring(rk.length + 1) || null;
            break;
        }
    }
    if (!role) return null;
    return {
        index: idx,
        role: role,
        memberKey: memberKey,
        ext: ext,
        normalizedFilename: name
    };
}

function _mtRoleOptionsHtml(selectedRole) {
    var opts = '';
    var keys = Object.keys(_MT_ROLES).sort(function(a, b) { return _MT_ROLES[a].order - _MT_ROLES[b].order; });
    keys.forEach(function(k) {
        opts += '<option value="' + k + '"' + (k === selectedRole ? ' selected' : '') + '>' + _MT_ROLES[k].label + '</option>';
    });
    return opts;
}

function _mtMemberOptionsHtml(selectedKey) {
    var opts = '<option value=""' + (!selectedKey ? ' selected' : '') + '>— none —</option>';
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    members.forEach(function(ref) {
        var key = (typeof ref === 'object') ? ref.key : ref;
        var name = bm[key] ? bm[key].name : key;
        opts += '<option value="' + escHtml(key) + '"' + (key === selectedKey ? ' selected' : '') + '>' + escHtml(name) + '</option>';
    });
    return opts;
}

function _mtBytesLabel(b) {
    if (b > 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
    if (b > 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    if (b > 1024) return (b / 1024).toFixed(1) + ' KB';
    return b + ' B';
}

function _mtFmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec - m * 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

function _mtGenSessionId() {
    return 'rsess_mt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function _mtGenTrackId(role, memberKey) {
    return 'tr_' + role.replace(/-/g, '_') + (memberKey ? '_' + memberKey : '');
}

// ── Import modal ─────────────────────────────────────────────────────────────

window._mtOpenImportModal = function() {
    var existing = document.getElementById('mtImportModal');
    if (existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'mtImportModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
    ov.innerHTML =
        '<div style="max-width:560px;width:100%;background:#0f172a;border-radius:14px;padding:22px;border:1px solid rgba(255,255,255,0.08);max-height:85vh;display:flex;flex-direction:column">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
            '<span style="font-size:1.25em">🎚</span>' +
            '<div style="flex:1">' +
              '<div style="font-size:1em;font-weight:800;color:#f1f5f9">Import multitrack rehearsal</div>' +
              '<div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Drop a folder of <code>NN_role-member.flac</code> files exported from REAPER.</div>' +
            '</div>' +
            '<button onclick="_mtCancelImport()" style="background:none;border:none;color:#64748b;font-size:1.4em;cursor:pointer;padding:0 6px">×</button>' +
          '</div>' +
          '<div id="mtDropZone" style="border:2px dashed rgba(99,102,241,0.4);border-radius:10px;padding:28px 16px;text-align:center;cursor:pointer;background:rgba(99,102,241,0.04);margin-bottom:10px">' +
            '<div style="font-size:0.92em;color:var(--text);margin-bottom:6px">📂 Drop FLAC files here, or click to choose</div>' +
            '<div style="font-size:0.7em;color:var(--text-dim)">Multiple files OK. Filename convention: <code>NN_role-member.flac</code></div>' +
            '<input type="file" id="mtFileInput" multiple accept=".flac,.wav,.opus,.mp3,.m4a" style="display:none">' +
          '</div>' +
          '<div id="mtMappingArea" style="overflow-y:auto;flex:1"></div>' +
          '<div id="mtFooter" style="margin-top:12px;display:flex;gap:8px;align-items:center"></div>' +
        '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) _mtCancelImport(); });

    var dz = document.getElementById('mtDropZone');
    var input = document.getElementById('mtFileInput');
    dz.addEventListener('click', function() { input.click(); });
    input.addEventListener('change', function(e) { _mtFilesPicked(Array.from(e.target.files)); });
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.style.background = 'rgba(99,102,241,0.12)'; });
    dz.addEventListener('dragleave', function() { dz.style.background = 'rgba(99,102,241,0.04)'; });
    dz.addEventListener('drop', function(e) {
        e.preventDefault();
        dz.style.background = 'rgba(99,102,241,0.04)';
        var files = Array.from(e.dataTransfer.files || []);
        _mtFilesPicked(files);
    });
};

window._mtCancelImport = function() {
    var ov = document.getElementById('mtImportModal');
    if (ov) ov.remove();
    _mtState.pickedFiles = [];
    _mtState.sessionId = null;
    _mtState.uploads = {};
};

window._mtFilesPicked = function(files) {
    if (!files || !files.length) return;
    // Filter to audio files only (REAPER folders may include .reapeaks etc.)
    var audio = files.filter(function(f) { return /\.(flac|wav|opus|mp3|m4a)$/i.test(f.name); });
    if (!audio.length) {
        if (typeof showToast === 'function') showToast('No audio files found in selection');
        return;
    }
    // Sort by inferred index, then filename
    var picked = audio.map(function(f) {
        var inf = _mtInferFromFilename(f.name);
        return {
            file: f,
            filename: f.name,
            sizeBytes: f.size,
            inferred: inf,
            role: inf ? inf.role : '',
            memberKey: inf ? inf.memberKey : ''
        };
    }).sort(function(a, b) {
        var ai = (a.inferred && a.inferred.index) || 999;
        var bi = (b.inferred && b.inferred.index) || 999;
        if (ai !== bi) return ai - bi;
        return a.filename.localeCompare(b.filename);
    });
    _mtState.pickedFiles = picked;
    _mtRenderMappingTable();
};

function _mtRenderMappingTable() {
    var area = document.getElementById('mtMappingArea');
    var footer = document.getElementById('mtFooter');
    if (!area || !footer) return;
    var picked = _mtState.pickedFiles;
    if (!picked.length) {
        area.innerHTML = '';
        footer.innerHTML = '';
        return;
    }
    var totalBytes = picked.reduce(function(s, p) { return s + p.sizeBytes; }, 0);
    var unmapped = picked.filter(function(p) { return !p.role; }).length;
    var unmappedBadge = unmapped > 0
        ? '<span style="color:#fbbf24;font-weight:700">⚠ ' + unmapped + ' need mapping</span>'
        : '<span style="color:#22c55e;font-weight:700">✓ all inferred</span>';
    var rows = '<div style="margin:8px 0;font-size:0.74em;color:var(--text-dim);display:flex;justify-content:space-between;gap:10px">'
        + '<span>' + picked.length + ' files · ' + _mtBytesLabel(totalBytes) + '</span>'
        + unmappedBadge
        + '</div>';
    rows += '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden">';
    picked.forEach(function(p, i) {
        var status = p.inferred
            ? '<span title="Inferred from filename" style="font-size:0.62em;color:#22c55e;white-space:nowrap">auto</span>'
            : '<span title="Could not infer — please pick" style="font-size:0.62em;color:#f87171;white-space:nowrap">manual</span>';
        rows += '<div style="display:grid;grid-template-columns:1fr 130px 110px 50px;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;font-size:0.78em">'
            + '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,monospace;color:var(--text)" title="' + escHtml(p.filename) + '">' + escHtml(p.filename) + '</div>'
            + '<select onchange="_mtSetRole(' + i + ',this.value)" style="background:#1e293b;color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:3px 5px;font-size:0.95em">' + _mtRoleOptionsHtml(p.role) + '</select>'
            + '<select onchange="_mtSetMember(' + i + ',this.value)" style="background:#1e293b;color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:3px 5px;font-size:0.95em">' + _mtMemberOptionsHtml(p.memberKey) + '</select>'
            + status
            + '</div>';
    });
    rows += '</div>';
    area.innerHTML = rows;

    // Date input + Confirm button
    var today = new Date().toISOString().slice(0, 10);
    footer.innerHTML =
        '<label style="display:flex;align-items:center;gap:6px;font-size:0.78em;color:var(--text-dim)">Date <input type="date" id="mtDate" value="' + today + '" style="background:#1e293b;color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:4px 6px;color-scheme:dark"></label>' +
        '<input type="text" id="mtVenue" placeholder="Venue (optional)" style="flex:1;background:#1e293b;color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:5px 8px;font-size:0.82em">' +
        '<button onclick="_mtConfirmMapping()" id="mtConfirmBtn" ' + (picked.some(function(p){return !p.role;}) ? 'disabled ' : '') +
        'style="padding:8px 16px;border-radius:7px;border:none;background:' + (picked.some(function(p){return !p.role;}) ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg,#667eea,#764ba2)') + ';color:white;font-weight:700;cursor:' + (picked.some(function(p){return !p.role;}) ? 'not-allowed' : 'pointer') + ';font-size:0.85em">Upload & Create Session</button>';
}

window._mtSetRole = function(idx, role) {
    if (!_mtState.pickedFiles[idx]) return;
    _mtState.pickedFiles[idx].role = role;
    _mtRenderMappingTable();
};
window._mtSetMember = function(idx, memberKey) {
    if (!_mtState.pickedFiles[idx]) return;
    _mtState.pickedFiles[idx].memberKey = memberKey || '';
    _mtRenderMappingTable();
};

// ── Upload + session create ──────────────────────────────────────────────────

window._mtConfirmMapping = async function() {
    var picked = _mtState.pickedFiles;
    if (!picked.length) return;
    if (picked.some(function(p) { return !p.role; })) {
        if (typeof showToast === 'function') showToast('Some tracks are unmapped — pick a role for each');
        return;
    }
    var dateInput = document.getElementById('mtDate');
    var venueInput = document.getElementById('mtVenue');
    var date = dateInput ? dateInput.value : new Date().toISOString().slice(0, 10);
    var venue = venueInput ? venueInput.value.trim() : '';

    var sessionId = _mtGenSessionId();
    _mtState.sessionId = sessionId;

    // Build tracks array (sans stemUrl until upload completes)
    var tracks = picked.map(function(p) {
        var roleMeta = _MT_ROLES[p.role] || { label: p.role, group: 'misc', order: 999 };
        return {
            trackId: _mtGenTrackId(p.role, p.memberKey),
            filename: p.filename,
            role: p.role,
            memberKey: p.memberKey || null,
            label: roleMeta.label,
            group: roleMeta.group,
            sizeBytes: p.sizeBytes,
            stemUrl: null,
            durationSec: null
        };
    });

    // Replace mapping area with progress UI
    var area = document.getElementById('mtMappingArea');
    var footer = document.getElementById('mtFooter');
    if (footer) footer.innerHTML = '<div style="font-size:0.78em;color:var(--text-dim)">Uploading… closing the modal will cancel.</div>';
    if (area) {
        var progressRows = '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden">';
        tracks.forEach(function(t) {
            progressRows += '<div id="mtUp_' + t.trackId + '" style="display:grid;grid-template-columns:1fr 80px 70px;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;font-size:0.78em">'
                + '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,monospace">' + escHtml(t.filename) + '</div>'
                + '<div class="mtUpStatus" style="color:var(--text-dim);font-size:0.88em">queued</div>'
                + '<div class="mtUpSize" style="color:var(--text-dim);font-size:0.78em;text-align:right">' + _mtBytesLabel(t.sizeBytes) + '</div>'
                + '</div>';
        });
        progressRows += '</div>';
        area.innerHTML = progressRows;
    }

    // Upload all in parallel (workers handle concurrent fetches; browser will
    // throttle if needed). For very large rehearsals (>20 files) we may want
    // to add a concurrency limit later; defer until we see real numbers.
    var uploadResults = await Promise.allSettled(tracks.map(function(t, i) {
        return _mtUploadOne(picked[i].file, sessionId, t);
    }));

    var failed = uploadResults.filter(function(r) { return r.status === 'rejected' || !r.value || !r.value.ok; });
    if (failed.length) {
        if (typeof showToast === 'function') showToast('⚠ ' + failed.length + ' upload(s) failed — keep modal open + retry');
        return;
    }

    // All uploads succeeded; stitch publicUrls into tracks
    uploadResults.forEach(function(r, i) {
        tracks[i].stemUrl = r.value.publicUrl;
    });

    // Write session to Firebase
    var session = {
        sessionId: sessionId,
        type: 'multitrack',
        date: date,
        venue: venue || null,
        tracks: tracks,
        comments: [],            // Phase B will populate
        createdAt: new Date().toISOString(),
        createdBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
    };
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + sessionId)).set(session);
        } catch (e) {
            if (typeof showToast === 'function') showToast('⚠ Session save failed: ' + (e.message || 'unknown'));
            return;
        }
    }

    // Close modal, open the player
    _mtCancelImport();
    if (typeof showToast === 'function') showToast('✅ Multitrack session created (' + tracks.length + ' tracks)');
    setTimeout(function() { window._mtOpenPlayer(sessionId); }, 200);
};

// Upload a single FLAC to the worker. Returns { ok, key, publicUrl } or { ok:false, error }.
async function _mtUploadOne(file, sessionId, track) {
    var url = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev') + '/multitrack/upload';
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var statusEl = document.querySelector('#mtUp_' + track.trackId + ' .mtUpStatus');
    if (statusEl) { statusEl.textContent = 'uploading…'; statusEl.style.color = '#fbbf24'; }
    try {
        var res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': file.type || 'audio/flac',
                'X-Band-Slug': slug,
                'X-Session-Id': sessionId,
                'X-Filename': file.name
            },
            body: file
        });
        var json = null;
        try { json = await res.json(); } catch (e) {}
        if (!res.ok || !json || !json.ok) {
            var msg = (json && json.error) ? json.error : ('HTTP ' + res.status);
            if (statusEl) { statusEl.textContent = 'failed'; statusEl.style.color = '#f87171'; statusEl.title = msg; }
            console.warn('[Multitrack] upload failed for', file.name, msg);
            return { ok: false, error: msg };
        }
        if (statusEl) { statusEl.textContent = '✓ done'; statusEl.style.color = '#22c55e'; }
        return { ok: true, key: json.key, publicUrl: json.publicUrl };
    } catch (e) {
        if (statusEl) { statusEl.textContent = 'error'; statusEl.style.color = '#f87171'; statusEl.title = e.message || ''; }
        console.warn('[Multitrack] upload error for', file.name, e);
        return { ok: false, error: e.message || 'network' };
    }
}

// ── Multitrack player ────────────────────────────────────────────────────────

window._mtOpenPlayer = async function(sessionId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') {
        if (typeof showToast === 'function') showToast('Firebase not ready');
        return;
    }
    var snap = null;
    try { snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId)).once('value'); } catch (e) {}
    var session = snap && snap.val();
    if (!session || session.type !== 'multitrack' || !session.tracks || !session.tracks.length) {
        if (typeof showToast === 'function') showToast('Session not found or not multitrack');
        return;
    }

    // Sort tracks by role order, group by group label
    var tracks = session.tracks.slice().sort(function(a, b) {
        var ao = (_MT_ROLES[a.role] && _MT_ROLES[a.role].order) || 999;
        var bo = (_MT_ROLES[b.role] && _MT_ROLES[b.role].order) || 999;
        return ao - bo;
    });

    var existing = document.getElementById('mtPlayerOverlay');
    if (existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'mtPlayerOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px)';

    var dateLabel = session.date ? new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    var bandMembersMap = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var trackRowsHtml = tracks.map(function(t) {
        var mName = t.memberKey ? (bandMembersMap[t.memberKey] ? bandMembersMap[t.memberKey].name.split(' ')[0] : t.memberKey) : '';
        // Tracks without a member assignment (room mics, audience, click) get
        // an "ambient" tail so the row doesn't read as missing data — distinct
        // styling (italic, dimmer) signals this is metadata, not a name.
        var subTail = mName
            ? ' <span style="color:var(--text-dim);font-size:0.85em">· ' + escHtml(mName) + '</span>'
            : ' <span style="color:var(--text-dim);font-size:0.78em;font-style:italic;opacity:0.7">· ambient</span>';
        return '<div class="mt-track-row" data-track-id="' + escHtml(t.trackId) + '" style="display:grid;grid-template-columns:130px 60px 60px 1fr 50px;gap:8px;align-items:center;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78em">'
            + '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="font-weight:700;color:var(--text)">' + escHtml(t.label) + '</span>' + subTail + '</div>'
            + '<button onclick="_mtToggleMute(\'' + t.trackId + '\')" id="mtMute_' + escHtml(t.trackId) + '" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:3px 6px;cursor:pointer;font-size:0.78em">M</button>'
            + '<button onclick="_mtToggleSolo(\'' + t.trackId + '\')" id="mtSolo_' + escHtml(t.trackId) + '" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:3px 6px;cursor:pointer;font-size:0.78em">S</button>'
            + '<div id="mtMeter_' + escHtml(t.trackId) + '" style="height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden"><div style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#a5b4fc)"></div></div>'
            + '<audio preload="metadata" src="' + escHtml(t.stemUrl) + '" data-track-id="' + escHtml(t.trackId) + '"></audio>'
            + '</div>';
    }).join('');

    ov.innerHTML =
        '<div style="max-width:880px;width:100%;background:#0f172a;border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,0.08);max-height:92vh;display:flex;flex-direction:column">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-shrink:0">' +
            '<span style="font-size:1.25em">🎚</span>' +
            '<div style="flex:1">' +
              '<div style="font-size:1em;font-weight:800;color:#f1f5f9">Multitrack rehearsal</div>' +
              '<div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">' + escHtml(dateLabel) + (session.venue ? ' · ' + escHtml(session.venue) : '') + ' · ' + tracks.length + ' tracks</div>' +
            '</div>' +
            '<button onclick="_mtClosePlayer()" style="background:none;border:none;color:#64748b;font-size:1.4em;cursor:pointer;padding:0 6px">×</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:12px;padding:10px 8px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:10px;flex-shrink:0">' +
            '<button onclick="_mtTogglePlayAll()" id="mtPlayAll" style="padding:8px 16px;border-radius:7px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:800;cursor:pointer;font-size:0.92em;min-width:90px">▶ Play</button>' +
            '<input type="range" id="mtMasterSeek" min="0" max="100" value="0" step="0.1" oninput="_mtSeekMaster(this.value)" style="flex:1;accent-color:#a5b4fc">' +
            '<div id="mtTimeLabel" style="font-family:ui-monospace,monospace;font-size:0.82em;color:var(--text);min-width:90px;text-align:right">0:00 / 0:00</div>' +
          '</div>' +
          // Tracks list — capped height so comment panel always has room
          '<div style="overflow-y:auto;max-height:35vh;border:1px solid rgba(255,255,255,0.04);border-radius:8px;flex-shrink:0">' + trackRowsHtml + '</div>' +
          '<div style="margin-top:6px;font-size:0.66em;color:var(--text-dim);text-align:center;flex-shrink:0">M = mute · S = solo · seek bar scrubs all tracks</div>' +
          // Phase B: comment list (fills remaining vertical space) + composer (sticky bottom)
          '<div id="mtCommentPanel" style="margin-top:10px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow-y:auto;flex:1;min-height:120px"></div>' +
          '<div id="mtComposerArea"></div>' +
        '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) _mtClosePlayer(); });

    // Wire up player state
    var audios = Array.from(ov.querySelectorAll('audio[data-track-id]'));
    _mtState.player = {
        sessionId: sessionId,
        tracks: tracks,
        audios: audios,
        masterPlaying: false,
        soloed: {},                  // { trackId: true }
        muted: {},                   // { trackId: true }
        comments: [],                // Phase B — populated below
        anchorTrackId: '',           // composer anchor selection
        commentFilterToSoloed: false // per-track filter toggle
    };

    // Phase B: load existing comments and render composer + list
    _mtLoadComments(sessionId).then(function(comments) {
        if (_mtState.player && _mtState.player.sessionId === sessionId) {
            _mtState.player.comments = comments;
            _mtRefreshCommentPanel();
            // Auto-tick the composer playhead label every second so it doesn't
            // look stale while the user pauses/scrubs before adding a note.
            if (_mtState.player._timeTicker) clearInterval(_mtState.player._timeTicker);
            _mtState.player._timeTicker = setInterval(function() {
                var t = _mtCurrentPlayhead();
                var el = document.getElementById('mtComposerTime');
                if (el) el.textContent = _mtFmtTime(t);
            }, 500);
        }
    });
    // Re-evaluate mute states when one audio reports duration (they should
    // all have the same duration if exported from the same X-LIVE session).
    audios.forEach(function(a) {
        a.addEventListener('loadedmetadata', _mtMaybeUpdateDuration);
        a.addEventListener('timeupdate', _mtMaybeUpdateMasterPosition);
        a.addEventListener('ended', function() {
            if (_mtState.player) _mtState.player.masterPlaying = false;
            var btn = document.getElementById('mtPlayAll');
            if (btn) btn.textContent = '▶ Play';
        });
    });
};

window._mtClosePlayer = function() {
    var ov = document.getElementById('mtPlayerOverlay');
    if (ov) ov.remove();
    if (_mtState.player) {
        if (_mtState.player._timeTicker) clearInterval(_mtState.player._timeTicker);
        _mtState.player.audios.forEach(function(a) { try { a.pause(); a.src = ''; } catch (e) {} });
        _mtState.player = null;
    }
    _mtState.composerTags = {};
};

window._mtTogglePlayAll = function() {
    var p = _mtState.player;
    if (!p) return;
    var btn = document.getElementById('mtPlayAll');
    if (p.masterPlaying) {
        p.audios.forEach(function(a) { try { a.pause(); } catch (e) {} });
        p.masterPlaying = false;
        if (btn) btn.textContent = '▶ Play';
    } else {
        // Sync all to first audio's currentTime to compensate for any drift
        var t = (p.audios[0] && p.audios[0].currentTime) || 0;
        var failed = 0;
        p.audios.forEach(function(a) {
            try { a.currentTime = t; } catch (e) {}
            var pr = a.play();
            if (pr && typeof pr.catch === 'function') {
                pr.catch(function(err) { failed++; console.warn('[Multitrack] play() rejected for', a.dataset.trackId, err && err.name); });
            }
        });
        p.masterPlaying = true;
        if (btn) btn.textContent = '⏸ Pause';
    }
};

window._mtToggleMute = function(trackId) {
    var p = _mtState.player;
    if (!p) return;
    p.muted[trackId] = !p.muted[trackId];
    _mtApplyMuteSolo();
    var btn = document.getElementById('mtMute_' + trackId);
    if (btn) {
        btn.style.background = p.muted[trackId] ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)';
        btn.style.color = p.muted[trackId] ? '#fca5a5' : 'var(--text-dim)';
    }
};

window._mtToggleSolo = function(trackId) {
    var p = _mtState.player;
    if (!p) return;
    p.soloed[trackId] = !p.soloed[trackId];
    _mtApplyMuteSolo();
    var btn = document.getElementById('mtSolo_' + trackId);
    if (btn) {
        btn.style.background = p.soloed[trackId] ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)';
        btn.style.color = p.soloed[trackId] ? '#fbbf24' : 'var(--text-dim)';
    }
    // Phase B: refresh comment panel so the per-track filter chip
    // appears/disappears and the composer's anchor default tracks the solo.
    var soloedIds = Object.keys(p.soloed).filter(function(k) { return p.soloed[k]; });
    if (soloedIds.length === 1) p.anchorTrackId = soloedIds[0];
    else if (soloedIds.length === 0 && p.anchorTrackId) p.anchorTrackId = '';
    _mtRefreshCommentPanel();
};

function _mtApplyMuteSolo() {
    var p = _mtState.player;
    if (!p) return;
    var anySoloed = Object.keys(p.soloed).some(function(k) { return p.soloed[k]; });
    p.audios.forEach(function(a) {
        var id = a.dataset.trackId;
        if (anySoloed) {
            // Solo mode: only soloed tracks play; muted overrides solo
            a.muted = !p.soloed[id] || !!p.muted[id];
        } else {
            a.muted = !!p.muted[id];
        }
    });
}

window._mtSeekMaster = function(pct) {
    var p = _mtState.player;
    if (!p || !p.audios[0]) return;
    var dur = p.audios[0].duration;
    if (!isFinite(dur) || dur <= 0) return;
    var t = (parseFloat(pct) / 100) * dur;
    p.audios.forEach(function(a) { try { a.currentTime = t; } catch (e) {} });
    _mtMaybeUpdateMasterPosition();
};

function _mtMaybeUpdateDuration() {
    var p = _mtState.player;
    if (!p) return;
    var dur = 0;
    p.audios.forEach(function(a) {
        if (isFinite(a.duration) && a.duration > dur) dur = a.duration;
    });
    var label = document.getElementById('mtTimeLabel');
    if (label) {
        var t = (p.audios[0] && p.audios[0].currentTime) || 0;
        label.textContent = _mtFmtTime(t) + ' / ' + _mtFmtTime(dur);
    }
}

function _mtMaybeUpdateMasterPosition() {
    var p = _mtState.player;
    if (!p) return;
    var a0 = p.audios[0];
    if (!a0 || !isFinite(a0.duration) || a0.duration <= 0) return;
    var pct = (a0.currentTime / a0.duration) * 100;
    var seek = document.getElementById('mtMasterSeek');
    if (seek && document.activeElement !== seek) seek.value = pct;
    var label = document.getElementById('mtTimeLabel');
    if (label) label.textContent = _mtFmtTime(a0.currentTime) + ' / ' + _mtFmtTime(a0.duration);
}

// ── Phase B: comments data layer ─────────────────────────────────────────────
// Per-session sub-collection at:
//   bands/{slug}/rehearsal_sessions/{sessionId}/comments/{commentId}
// Shape: { commentId, timestampSec, text, trackId|null, tags:[], createdAt, createdBy }

function _mtGenCommentId() {
    return 'cmt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

async function _mtLoadComments(sessionId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    try {
        var snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.values(val).sort(function(a, b) {
            return (a.timestampSec || 0) - (b.timestampSec || 0);
        });
    } catch (e) {
        console.warn('[Multitrack] load comments failed:', e.message);
        return [];
    }
}

async function _mtSaveComment(sessionId, comment) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return false;
    try {
        await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments/' + comment.commentId)).set(comment);
        return true;
    } catch (e) {
        console.warn('[Multitrack] save comment failed:', e.message);
        return false;
    }
}

async function _mtDeleteComment(sessionId, commentId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return false;
    try {
        await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments/' + commentId)).remove();
        return true;
    } catch (e) {
        console.warn('[Multitrack] delete comment failed:', e.message);
        return false;
    }
}

// ── Phase B: comment list rendering ──────────────────────────────────────────

function _mtTagChipHtml(tag, selected, onClick) {
    var color = selected ? '#fbbf24' : 'var(--text-dim)';
    var bg = selected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)';
    var border = selected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)';
    return '<button onclick="' + onClick + '" style="padding:2px 8px;border-radius:10px;border:1px solid ' + border + ';background:' + bg + ';color:' + color + ';cursor:pointer;font-size:0.66em;font-weight:600;white-space:nowrap;font-family:inherit">' + escHtml(tag) + '</button>';
}

function _mtRenderComposer() {
    var p = _mtState.player;
    if (!p) return '';
    // Anchor selector: if a track is soloed, default to that track; otherwise "all"
    var soloedIds = Object.keys(p.soloed).filter(function(k) { return p.soloed[k]; });
    var defaultAnchor = soloedIds.length === 1 ? soloedIds[0] : '';
    if (p.anchorTrackId === undefined) p.anchorTrackId = defaultAnchor;

    var anchorOptions = '<option value=""' + (!p.anchorTrackId ? ' selected' : '') + '>This moment (no track)</option>';
    var bandMembersMap = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    p.tracks.forEach(function(t) {
        var mName = t.memberKey ? (bandMembersMap[t.memberKey] ? bandMembersMap[t.memberKey].name.split(' ')[0] : t.memberKey) : '';
        var label = t.label + (mName ? ' · ' + mName : ' · ambient');
        anchorOptions += '<option value="' + escHtml(t.trackId) + '"' + (t.trackId === p.anchorTrackId ? ' selected' : '') + '>' + escHtml(label) + '</option>';
    });

    var tagChips = _MT_TAGS.map(function(tag) {
        return _mtTagChipHtml(tag, !!_mtState.composerTags[tag], '_mtToggleComposerTag(\'' + tag.replace(/'/g, "\\'") + '\')');
    }).join(' ');

    return '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;margin-top:6px;background:#0f172a;flex-shrink:0">'
        + '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">'
        + '<span id="mtComposerTime" style="font-family:ui-monospace,monospace;font-size:0.78em;color:#a5b4fc;font-weight:700;min-width:46px">' + _mtFmtTime(_mtCurrentPlayhead()) + '</span>'
        + '<select id="mtComposerAnchor" onchange="_mtSetAnchor(this.value)" style="background:#1e293b;color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:3px 6px;font-size:0.78em;flex-shrink:0">' + anchorOptions + '</select>'
        + '<input type="text" id="mtComposerText" placeholder="What did you notice? (Enter to add)" onkeydown="if(event.key===\'Enter\')_mtAddComment()" style="flex:1;background:#1e293b;color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:5px 8px;font-size:0.85em;font-family:inherit">'
        + '<button onclick="_mtAddComment()" style="padding:5px 12px;border-radius:6px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:700;cursor:pointer;font-size:0.82em">Add</button>'
        + '</div>'
        + '<div id="mtComposerTags" style="display:flex;flex-wrap:wrap;gap:4px">' + tagChips + '</div>'
        + '</div>';
}

function _mtRenderCommentList() {
    var p = _mtState.player;
    if (!p) return '';
    var comments = p.comments || [];
    var bandMembersMap = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var trackById = {};
    p.tracks.forEach(function(t) { trackById[t.trackId] = t; });

    // Per-track filter state — when a track is soloed, allow filtering list
    var soloedIds = Object.keys(p.soloed).filter(function(k) { return p.soloed[k]; });
    var soloedTrackId = soloedIds.length === 1 ? soloedIds[0] : null;
    var filterToTrack = !!p.commentFilterToSoloed && !!soloedTrackId;

    var filtered = filterToTrack
        ? comments.filter(function(c) { return c.trackId === soloedTrackId; })
        : comments;

    var headerHtml = '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06)">'
        + '<span style="font-size:0.68em;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Comments (' + filtered.length + (filterToTrack ? ' / ' + comments.length : '') + ')</span>';
    if (soloedTrackId) {
        var soloLabel = (trackById[soloedTrackId] && trackById[soloedTrackId].label) || 'soloed track';
        headerHtml += '<button onclick="_mtToggleCommentFilter()" style="padding:2px 8px;border-radius:10px;border:1px solid ' + (filterToTrack ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)') + ';background:' + (filterToTrack ? 'rgba(245,158,11,0.12)' : 'none') + ';color:' + (filterToTrack ? '#fbbf24' : 'var(--text-dim)') + ';cursor:pointer;font-size:0.66em;font-weight:600;font-family:inherit">' + (filterToTrack ? '✓ Only ' + escHtml(soloLabel) : 'Only ' + escHtml(soloLabel)) + '</button>';
    }
    headerHtml += '</div>';

    if (!filtered.length) {
        return headerHtml
            + '<div style="padding:14px;text-align:center;color:var(--text-dim);font-size:0.78em;font-style:italic">'
            + (filterToTrack ? 'No comments on this track yet.' : 'No comments yet — scrub to a moment, type a note, hit Enter.')
            + '</div>';
    }

    var rowsHtml = filtered.map(function(c) {
        var t = c.trackId ? trackById[c.trackId] : null;
        var mName = t && t.memberKey ? (bandMembersMap[t.memberKey] ? bandMembersMap[t.memberKey].name.split(' ')[0] : t.memberKey) : '';
        var trackLabel = t ? (t.label + (mName ? ' · ' + mName : '')) : 'this moment';
        var tagsHtml = (c.tags && c.tags.length)
            ? c.tags.map(function(tag) { return '<span style="padding:1px 6px;border-radius:8px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;font-size:0.62em;font-weight:600">' + escHtml(tag) + '</span>'; }).join(' ')
            : '';
        return '<div style="display:grid;grid-template-columns:50px 1fr 26px;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.03);align-items:start;font-size:0.78em">'
            + '<button onclick="_mtJumpToComment(' + c.timestampSec + ')" title="Jump to ' + _mtFmtTime(c.timestampSec) + '" style="font-family:ui-monospace,monospace;font-size:0.85em;color:#a5b4fc;background:none;border:none;cursor:pointer;padding:0;text-align:left;font-weight:700">' + _mtFmtTime(c.timestampSec) + '</button>'
            + '<div style="min-width:0">'
              + '<div style="color:var(--text);line-height:1.3;word-wrap:break-word">' + escHtml(c.text || '') + '</div>'
              + '<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">'
                + '<span style="font-size:0.65em;color:var(--text-dim);font-style:italic">' + escHtml(trackLabel) + '</span>'
                + (tagsHtml ? '<span style="color:var(--text-dim);font-size:0.65em">·</span> ' + tagsHtml : '')
              + '</div>'
            + '</div>'
            + '<button onclick="_mtDeleteCommentUI(\'' + escHtml(c.commentId) + '\')" title="Delete" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:0">×</button>'
            + '</div>';
    }).join('');

    return headerHtml + '<div>' + rowsHtml + '</div>';
}

function _mtCurrentPlayhead() {
    var p = _mtState.player;
    if (!p || !p.audios[0]) return 0;
    return p.audios[0].currentTime || 0;
}

function _mtRefreshCommentPanel() {
    var panel = document.getElementById('mtCommentPanel');
    if (panel) panel.innerHTML = _mtRenderCommentList();
    var composerArea = document.getElementById('mtComposerArea');
    if (composerArea) composerArea.innerHTML = _mtRenderComposer();
}

// ── Phase B: composer + list handlers ────────────────────────────────────────

window._mtToggleComposerTag = function(tag) {
    if (_mtState.composerTags[tag]) delete _mtState.composerTags[tag];
    else _mtState.composerTags[tag] = true;
    var area = document.getElementById('mtComposerTags');
    if (area) {
        area.innerHTML = _MT_TAGS.map(function(t) {
            return _mtTagChipHtml(t, !!_mtState.composerTags[t], '_mtToggleComposerTag(\'' + t.replace(/'/g, "\\'") + '\')');
        }).join(' ');
    }
};

window._mtSetAnchor = function(trackId) {
    if (_mtState.player) _mtState.player.anchorTrackId = trackId || '';
};

window._mtAddComment = async function() {
    var p = _mtState.player;
    if (!p) return;
    var input = document.getElementById('mtComposerText');
    var text = input ? input.value.trim() : '';
    var tags = Object.keys(_mtState.composerTags).filter(function(k) { return _mtState.composerTags[k]; });
    if (!text && !tags.length) {
        if (typeof showToast === 'function') showToast('Type a note or pick a tag first');
        return;
    }
    var comment = {
        commentId: _mtGenCommentId(),
        timestampSec: _mtCurrentPlayhead(),
        text: text,
        trackId: p.anchorTrackId || null,
        tags: tags,
        createdAt: new Date().toISOString(),
        createdBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
    };
    var ok = await _mtSaveComment(p.sessionId, comment);
    if (!ok) {
        if (typeof showToast === 'function') showToast('⚠ Save failed');
        return;
    }
    p.comments = (p.comments || []).concat([comment]).sort(function(a, b) {
        return (a.timestampSec || 0) - (b.timestampSec || 0);
    });
    if (input) input.value = '';
    _mtState.composerTags = {};
    _mtRefreshCommentPanel();
    // Refocus the input so user can keep typing comments without re-clicking
    setTimeout(function() {
        var i2 = document.getElementById('mtComposerText');
        if (i2) i2.focus();
    }, 50);
};

window._mtJumpToComment = function(timestampSec) {
    var p = _mtState.player;
    if (!p || !p.audios.length) return;
    var t = parseFloat(timestampSec) || 0;
    p.audios.forEach(function(a) { try { a.currentTime = t; } catch (e) {} });
    _mtMaybeUpdateMasterPosition();
};

window._mtDeleteCommentUI = async function(commentId) {
    var p = _mtState.player;
    if (!p) return;
    if (!confirm('Delete this comment?')) return;
    var ok = await _mtDeleteComment(p.sessionId, commentId);
    if (!ok) {
        if (typeof showToast === 'function') showToast('⚠ Delete failed');
        return;
    }
    p.comments = (p.comments || []).filter(function(c) { return c.commentId !== commentId; });
    _mtRefreshCommentPanel();
};

window._mtToggleCommentFilter = function() {
    var p = _mtState.player;
    if (!p) return;
    p.commentFilterToSoloed = !p.commentFilterToSoloed;
    _mtRefreshCommentPanel();
};

console.log('🎚 multitrack-rehearsal.js loaded (Phase A + B)');
