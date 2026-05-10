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

// Phase B+ (Workbench prelude): songs need to be derived from a multitrack
// session for "🎯 Practice this" to know what songId the task targets. v0.2
// of the spec defers full song-segment detection (it'd run the segmentation
// engine over the multitrack master mix). For MVP, we ASK the user which song
// the comment is about when they promote it — single dropdown of the band's
// active songs. If the user has set _mtState.player.songContext at any point
// (e.g. they're reviewing a single-song mix), we default to that.

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
    _mtState.activeUpload = null;
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

    // Stash everything retry needs in module state. Per-trackId entry tracks
    // file + status + result so a failed upload can be retried in isolation
    // without re-doing the successful ones.
    var fileByTrackId = {};
    tracks.forEach(function(t, i) { fileByTrackId[t.trackId] = picked[i].file; });
    _mtState.activeUpload = {
        sessionId: sessionId,
        date: date,
        venue: venue,
        tracks: tracks,
        fileByTrackId: fileByTrackId
    };

    _mtRenderUploadProgress();

    // Upload all in parallel (workers handle concurrent fetches; browser will
    // throttle if needed). For very large rehearsals (>20 files) we may want
    // to add a concurrency limit later; defer until we see real numbers.
    await Promise.allSettled(tracks.map(function(t) {
        return _mtUploadOne(fileByTrackId[t.trackId], sessionId, t);
    }));

    await _mtMaybeFinalizeSession();
};

// Render the upload progress UI from module state. Failed rows get a Retry
// button; successful rows get a green check; pending rows show "queued".
// Idempotent — safe to call after every status change.
function _mtRenderUploadProgress() {
    var u = _mtState.activeUpload;
    if (!u) return;
    var area = document.getElementById('mtMappingArea');
    var footer = document.getElementById('mtFooter');
    if (footer) {
        var failedCount = u.tracks.filter(function(t) { return t._uploadStatus === 'failed'; }).length;
        var doneCount = u.tracks.filter(function(t) { return t.stemUrl; }).length;
        if (failedCount > 0) {
            footer.innerHTML = '<div style="font-size:0.78em;color:#fbbf24">⚠ ' + failedCount + ' upload(s) failed — click Retry on any failed row, or close to abort.</div>'
                + '<button onclick="_mtRetryAllFailed()" style="margin-left:auto;padding:5px 10px;border-radius:6px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.12);color:#fbbf24;cursor:pointer;font-size:0.78em;font-weight:700">↻ Retry all failed</button>';
            footer.style.display = 'flex';
            footer.style.alignItems = 'center';
            footer.style.gap = '8px';
        } else if (doneCount === u.tracks.length) {
            footer.innerHTML = '<div style="font-size:0.78em;color:#22c55e">✓ All uploaded — finalizing session…</div>';
        } else {
            footer.innerHTML = '<div style="font-size:0.78em;color:var(--text-dim)">Uploading… ' + doneCount + ' / ' + u.tracks.length + ' done. Closing the modal will cancel pending uploads.</div>';
        }
    }
    if (area) {
        var progressRows = '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden">';
        u.tracks.forEach(function(t) {
            var statusHtml;
            if (t.stemUrl) {
                statusHtml = '<span style="color:#22c55e;font-size:0.85em;font-weight:600">✓ done</span>';
            } else if (t._uploadStatus === 'failed') {
                var errTitle = t._uploadError ? ' title="' + escHtml(t._uploadError) + '"' : '';
                statusHtml = '<button onclick="_mtRetryUpload(\'' + escHtml(t.trackId) + '\')"' + errTitle + ' style="padding:2px 8px;border-radius:5px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.12);color:#fbbf24;cursor:pointer;font-size:0.72em;font-weight:600">↻ Retry</button>';
            } else if (t._uploadStatus === 'uploading') {
                statusHtml = '<span style="color:#fbbf24;font-size:0.85em">uploading…</span>';
            } else {
                statusHtml = '<span style="color:var(--text-dim);font-size:0.85em">queued</span>';
            }
            progressRows += '<div id="mtUp_' + escHtml(t.trackId) + '" style="display:grid;grid-template-columns:1fr 90px 70px;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04);align-items:center;font-size:0.78em">'
                + '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,monospace">' + escHtml(t.filename) + '</div>'
                + '<div class="mtUpStatus">' + statusHtml + '</div>'
                + '<div class="mtUpSize" style="color:var(--text-dim);font-size:0.78em;text-align:right">' + _mtBytesLabel(t.sizeBytes) + '</div>'
                + '</div>';
        });
        progressRows += '</div>';
        area.innerHTML = progressRows;
    }
}

window._mtRetryUpload = async function(trackId) {
    var u = _mtState.activeUpload;
    if (!u) return;
    var track = u.tracks.find(function(t) { return t.trackId === trackId; });
    if (!track || track.stemUrl) return;
    var file = u.fileByTrackId[trackId];
    if (!file) return;
    track._uploadStatus = 'queued';
    track._uploadError = null;
    _mtRenderUploadProgress();
    await _mtUploadOne(file, u.sessionId, track);
    await _mtMaybeFinalizeSession();
};

window._mtRetryAllFailed = async function() {
    var u = _mtState.activeUpload;
    if (!u) return;
    var failed = u.tracks.filter(function(t) { return t._uploadStatus === 'failed'; });
    if (!failed.length) return;
    failed.forEach(function(t) { t._uploadStatus = 'queued'; t._uploadError = null; });
    _mtRenderUploadProgress();
    await Promise.allSettled(failed.map(function(t) {
        return _mtUploadOne(u.fileByTrackId[t.trackId], u.sessionId, t);
    }));
    await _mtMaybeFinalizeSession();
};

// Write the session to Firebase if (and only if) every track has succeeded.
// Safe to call multiple times — early-returns until all uploads are done.
async function _mtMaybeFinalizeSession() {
    var u = _mtState.activeUpload;
    if (!u) return;
    var allDone = u.tracks.every(function(t) { return !!t.stemUrl; });
    if (!allDone) return;

    var session = {
        sessionId: u.sessionId,
        type: 'multitrack',
        date: u.date,
        venue: u.venue || null,
        tracks: u.tracks.map(function(t) {
            // Strip transient _upload* fields before persisting
            var copy = {};
            Object.keys(t).forEach(function(k) { if (k.indexOf('_upload') !== 0) copy[k] = t[k]; });
            return copy;
        }),
        comments: [],
        createdAt: new Date().toISOString(),
        createdBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
    };
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + u.sessionId)).set(session);
        } catch (e) {
            if (typeof showToast === 'function') showToast('⚠ Session save failed: ' + (e.message || 'unknown'));
            return;
        }
    }
    var sId = u.sessionId;
    _mtState.activeUpload = null;
    _mtCancelImport();
    if (typeof showToast === 'function') showToast('✅ Multitrack session created (' + session.tracks.length + ' tracks)');
    setTimeout(function() { window._mtOpenPlayer(sId); }, 200);
}

// Upload a single FLAC to the worker. Mutates track._uploadStatus and
// track.stemUrl in place so the rest of the module can read state from
// the track object. Always re-renders the progress UI on status change.
async function _mtUploadOne(file, sessionId, track) {
    var url = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev') + '/multitrack/upload';
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    track._uploadStatus = 'uploading';
    track._uploadError = null;
    _mtRenderUploadProgress();
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
            track._uploadStatus = 'failed';
            track._uploadError = msg;
            console.warn('[Multitrack] upload failed for', file.name, msg);
            _mtRenderUploadProgress();
            return { ok: false, error: msg };
        }
        track.stemUrl = json.publicUrl;
        track._uploadStatus = 'done';
        _mtRenderUploadProgress();
        return { ok: true, key: json.key, publicUrl: json.publicUrl };
    } catch (e) {
        track._uploadStatus = 'failed';
        track._uploadError = e.message || 'network';
        console.warn('[Multitrack] upload error for', file.name, e);
        _mtRenderUploadProgress();
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
            // Seek bar wrapped so comment markers can absolute-position above
            '<div style="position:relative;flex:1">' +
              '<div id="mtSeekMarkers" style="position:absolute;left:0;right:0;top:-3px;height:8px;pointer-events:none"></div>' +
              '<input type="range" id="mtMasterSeek" min="0" max="100" value="0" step="0.1" oninput="_mtSeekMaster(this.value)" style="width:100%;accent-color:#a5b4fc">' +
            '</div>' +
            '<button onclick="_mtExportDigest()" title="Copy a markdown digest of all comments to your clipboard" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.74em;flex-shrink:0">📋 Digest</button>' +
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
        commentFilterToSoloed: false,// per-track filter toggle
        commentFilterMember: ''      // per-member filter (Phase C step 1)
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
                _mtHighlightActiveComment();
            }, 500);
        }
    });
    // Re-evaluate mute states when one audio reports duration (they should
    // all have the same duration if exported from the same X-LIVE session).
    audios.forEach(function(a) {
        a.addEventListener('loadedmetadata', function() {
            _mtMaybeUpdateDuration();
            _mtRenderSeekMarkers(); // duration now known — markers can place
        });
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

// ── Phase B+ (Workbench prelude): PracticeTask data layer ────────────────────
// Stored at bands/{slug}/practice_tasks/{taskId}. Per spec §5.4, tasks are
// distinct from notes — they have lifecycle (open/in-progress/resolved) and
// always carry a back-ref to their source. Created via "🎯 Practice this"
// on a multitrack rehearsal comment for now; future surfaces (rehearsal-flag,
// manual) layer on later.

function _mtGenTaskId() {
    return 'tsk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

async function _mtSavePracticeTask(task) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return false;
    try {
        await db.ref(bandPath('practice_tasks/' + task.taskId)).set(task);
        return true;
    } catch (e) {
        console.warn('[Multitrack] save task failed:', e.message);
        return false;
    }
}

// Promote a comment to a PracticeTask. Asks the user which song the comment
// was about (no auto-segmentation in v0.2). Auto-fills section / track /
// member / tags / text from the comment. Saves to Firebase, surfaces toast
// confirmation, marks the comment row with a "→ task" badge for the rest of
// the session.
window._mtPromoteCommentToTask = async function(commentId) {
    var p = _mtState.player;
    if (!p) return;
    var comment = (p.comments || []).find(function(c) { return c.commentId === commentId; });
    if (!comment) {
        if (typeof showToast === 'function') showToast('Comment not found');
        return;
    }
    // Ask which song this comment was about. Defaults to band's Active songs.
    var allSongsList = (typeof allSongs !== 'undefined') ? allSongs : [];
    if (!allSongsList.length) {
        if (typeof showToast === 'function') showToast('No songs in library — can\'t create task');
        return;
    }
    // Build a lightweight prompt: comma-separated alphabetical titles, user
    // types or pastes one. (No full picker UI — Drew's "don't over-engineer"
    // guard. Phase 2 of Workbench introduces a real song picker.)
    var defaultGuess = '';
    var bandMembersMap = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var trackById = {};
    p.tracks.forEach(function(t) { trackById[t.trackId] = t; });
    var anchorTrack = comment.trackId ? trackById[comment.trackId] : null;
    var songTitle = prompt(
        'Which song is this about? (type the title)\n\n'
        + 'Comment: "' + (comment.text || '(no text)') + '"\n'
        + 'Tags: ' + ((comment.tags || []).join(', ') || '(none)') + '\n'
        + 'At: ' + _mtFmtTime(comment.timestampSec)
        + (anchorTrack ? '\nTrack: ' + anchorTrack.label : ''),
        defaultGuess
    );
    if (songTitle === null) return; // cancelled
    songTitle = songTitle.trim();
    if (!songTitle) return;
    // Best-effort canonical song lookup: prefer exact title match
    var matched = allSongsList.find(function(s) { return (s.title || '').toLowerCase() === songTitle.toLowerCase(); });
    var songId = matched ? (matched.songId || matched.title) : songTitle;
    var canonicalTitle = matched ? matched.title : songTitle;

    var task = {
        taskId: _mtGenTaskId(),
        songId: songId,
        songTitle: canonicalTitle,
        section: null,
        sectionLabel: null,
        timestampSec: comment.timestampSec,
        trackId: comment.trackId || null,
        memberKey: anchorTrack ? (anchorTrack.memberKey || null) : null,
        noteText: comment.text || '',
        tags: (comment.tags || []).slice(),
        status: 'open',
        source: 'review-comment',
        sourceRef: {
            sessionId: p.sessionId,
            commentId: commentId
        },
        createdAt: new Date().toISOString(),
        createdBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '',
        updatedAt: new Date().toISOString()
    };
    var ok = await _mtSavePracticeTask(task);
    if (!ok) {
        if (typeof showToast === 'function') showToast('⚠ Task save failed');
        return;
    }
    // Track the task back-ref on the comment in module state so the row's
    // "→ task" badge persists for this player session. Optional Firebase
    // write back to comments[].promotedTaskId is deferred — adds a write
    // per promotion; not worth the round-trip for visual breadcrumb only.
    comment.promotedTaskId = task.taskId;
    if (typeof showToast === 'function') showToast('✅ Task created — ' + canonicalTitle + ' · ' + _mtFmtTime(comment.timestampSec));
    _mtRefreshCommentPanel();
};

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

    // Per-member filter (Phase C step 1): drop comments where the anchor
    // track's memberKey doesn't match the selected member. "this moment"
    // comments (no trackId) are excluded when a specific member is selected.
    var filterMember = p.commentFilterMember || '';
    var filterMemberFn = filterMember
        ? function(c) {
            if (!c.trackId) return false;
            var t = trackById[c.trackId];
            return !!(t && t.memberKey === filterMember);
          }
        : null;

    var filtered = comments;
    if (filterToTrack) filtered = filtered.filter(function(c) { return c.trackId === soloedTrackId; });
    if (filterMemberFn) filtered = filtered.filter(filterMemberFn);

    // Build member dropdown from members who actually OWN tracks in this session
    var memberKeysWithTracks = {};
    p.tracks.forEach(function(t) { if (t.memberKey) memberKeysWithTracks[t.memberKey] = true; });
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var memberOptions = '<option value="">All members</option>';
    members.forEach(function(ref) {
        var key = (typeof ref === 'object') ? ref.key : ref;
        if (!memberKeysWithTracks[key]) return;
        var name = bandMembersMap[key] ? bandMembersMap[key].name : key;
        memberOptions += '<option value="' + escHtml(key) + '"' + (key === filterMember ? ' selected' : '') + '>' + escHtml(name) + '</option>';
    });

    var anyFilterActive = filterToTrack || !!filterMember;
    var headerHtml = '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);gap:8px;flex-wrap:wrap">'
        + '<span style="font-size:0.68em;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em">Comments (' + filtered.length + (anyFilterActive ? ' / ' + comments.length : '') + ')</span>'
        + '<div style="display:flex;gap:6px;align-items:center">';
    headerHtml += '<select onchange="_mtSetMemberFilter(this.value)" style="background:#1e293b;color:var(--text);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:2px 6px;font-size:0.7em;font-family:inherit">' + memberOptions + '</select>';
    if (soloedTrackId) {
        var soloLabel = (trackById[soloedTrackId] && trackById[soloedTrackId].label) || 'soloed track';
        headerHtml += '<button onclick="_mtToggleCommentFilter()" style="padding:2px 8px;border-radius:10px;border:1px solid ' + (filterToTrack ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)') + ';background:' + (filterToTrack ? 'rgba(245,158,11,0.12)' : 'none') + ';color:' + (filterToTrack ? '#fbbf24' : 'var(--text-dim)') + ';cursor:pointer;font-size:0.66em;font-weight:600;font-family:inherit">' + (filterToTrack ? '✓ Only ' + escHtml(soloLabel) : 'Only ' + escHtml(soloLabel)) + '</button>';
    }
    headerHtml += '</div></div>';

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
        // Phase B+: data-comment-time so the playback ticker can find this
        // row by timestamp and apply an "active" highlight as we cross it.
        // Workbench prelude: "→ task" badge if this comment was promoted.
        var taskBadge = c.promotedTaskId
            ? ' <span title="A practice task was created from this comment" style="font-size:0.6em;color:#22c55e;font-weight:700;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);padding:1px 5px;border-radius:8px">→ task</span>'
            : '';
        var practiceBtn = c.promotedTaskId
            ? ''
            : '<button onclick="_mtPromoteCommentToTask(\'' + escHtml(c.commentId) + '\')" title="Convert this comment into a practice task for the relevant song" style="background:none;border:1px solid rgba(34,197,94,0.3);color:#86efac;cursor:pointer;font-size:0.62em;padding:1px 5px;border-radius:4px;font-family:inherit;white-space:nowrap;font-weight:600">🎯 Practice this</button>';
        return '<div class="mt-comment-row" data-comment-time="' + c.timestampSec + '" data-comment-id="' + escHtml(c.commentId) + '" style="display:grid;grid-template-columns:50px 1fr auto 26px;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.03);align-items:start;font-size:0.78em;transition:background 0.18s">'
            + '<button onclick="_mtJumpToComment(' + c.timestampSec + ')" title="Jump to ' + _mtFmtTime(c.timestampSec) + '" style="font-family:ui-monospace,monospace;font-size:0.85em;color:#a5b4fc;background:none;border:none;cursor:pointer;padding:0;text-align:left;font-weight:700">' + _mtFmtTime(c.timestampSec) + '</button>'
            + '<div style="min-width:0">'
              + '<div style="color:var(--text);line-height:1.3;word-wrap:break-word">' + escHtml(c.text || '') + taskBadge + '</div>'
              + '<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">'
                + '<span style="font-size:0.65em;color:var(--text-dim);font-style:italic">' + escHtml(trackLabel) + '</span>'
                + (tagsHtml ? '<span style="color:var(--text-dim);font-size:0.65em">·</span> ' + tagsHtml : '')
              + '</div>'
            + '</div>'
            + '<div style="align-self:center">' + practiceBtn + '</div>'
            + '<button onclick="_mtDeleteCommentUI(\'' + escHtml(c.commentId) + '\')" title="Delete" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:0">×</button>'
            + '</div>';
    }).join('');

    return headerHtml + '<div>' + rowsHtml + '</div>';
}

// Highlight the comment whose timestamp the playhead is currently passing.
// Called once per second from the player's _timeTicker. Cheap — DOM query
// once + class-toggle on at most 2 elements.
function _mtHighlightActiveComment() {
    var p = _mtState.player;
    if (!p) return;
    var t = _mtCurrentPlayhead();
    var rows = document.querySelectorAll('.mt-comment-row');
    if (!rows.length) return;
    // Find the latest comment whose timestamp <= playhead within a ~3s window
    // (so highlight feels "now" rather than "ago"). Earlier comments lose
    // highlight; later ones don't get it yet.
    var activeRow = null;
    var bestDelta = Infinity;
    rows.forEach(function(row) {
        var ts = parseFloat(row.dataset.commentTime || '0');
        var delta = t - ts;
        if (delta >= 0 && delta < 3 && delta < bestDelta) {
            bestDelta = delta;
            activeRow = row;
        }
    });
    rows.forEach(function(row) {
        if (row === activeRow) {
            if (!row.classList.contains('mt-comment-active')) {
                row.classList.add('mt-comment-active');
                row.style.background = 'rgba(99,102,241,0.10)';
                row.style.borderLeft = '2px solid #a5b4fc';
                row.style.paddingLeft = '8px';
                // Scroll into view if not visible; only when player is playing
                // (avoid scrolling away from where the user is reading).
                if (p.masterPlaying) {
                    try { row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
                }
            }
        } else if (row.classList.contains('mt-comment-active')) {
            row.classList.remove('mt-comment-active');
            row.style.background = '';
            row.style.borderLeft = '';
            row.style.paddingLeft = '';
        }
    });
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
    _mtRenderSeekMarkers();
}

// Phase B+: render comment markers on the master seek bar. Each comment is
// a small dot positioned at left:%. Tagged comments render amber; un-tagged
// render slate. Click jumps to the comment's timestamp. Hover shows a
// preview tooltip.
function _mtRenderSeekMarkers() {
    var p = _mtState.player;
    var host = document.getElementById('mtSeekMarkers');
    if (!host || !p) return;
    var dur = p.audios[0] && isFinite(p.audios[0].duration) ? p.audios[0].duration : 0;
    if (dur <= 0 || !p.comments || !p.comments.length) {
        host.innerHTML = '';
        return;
    }
    var markers = p.comments.map(function(c) {
        var pct = Math.max(0, Math.min(100, (c.timestampSec / dur) * 100));
        var hasTags = c.tags && c.tags.length > 0;
        var color = hasTags ? '#fbbf24' : '#94a3b8';
        var tipText = _mtFmtTime(c.timestampSec) + ' · ' + (c.text || '(no text)') + (c.tags && c.tags.length ? ' [' + c.tags.join(', ') + ']' : '');
        return '<div onclick="_mtJumpToComment(' + c.timestampSec + ')" '
            + 'title="' + escHtml(tipText) + '" '
            + 'style="position:absolute;left:calc(' + pct.toFixed(2) + '% - 4px);top:0;width:8px;height:8px;border-radius:50%;background:' + color + ';border:1px solid rgba(0,0,0,0.4);cursor:pointer;pointer-events:auto;box-shadow:0 0 3px rgba(0,0,0,0.5)"></div>';
    }).join('');
    host.innerHTML = markers;
}

// Phase B+: copy a markdown digest of all comments in this session to the
// clipboard. Sections by timestamp + by tag for skim-ability. Useful for
// pasting into band-comms / Slack / email without forcing the band into
// the app.
window._mtExportDigest = async function() {
    var p = _mtState.player;
    if (!p) return;
    var comments = (p.comments || []).slice().sort(function(a, b) { return (a.timestampSec || 0) - (b.timestampSec || 0); });
    if (!comments.length) {
        if (typeof showToast === 'function') showToast('No comments to export yet');
        return;
    }
    var bandMembersMap = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var trackById = {};
    p.tracks.forEach(function(t) { trackById[t.trackId] = t; });

    var sessionDateLabel = '';
    try {
        var s = await firebaseDB.ref(bandPath('rehearsal_sessions/' + p.sessionId)).once('value');
        var sv = s && s.val();
        if (sv && sv.date) sessionDateLabel = new Date(sv.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
        var sessionVenue = (sv && sv.venue) ? ' · ' + sv.venue : '';
    } catch (e) {}

    function trackLabel(c) {
        if (!c.trackId) return 'this moment';
        var t = trackById[c.trackId];
        if (!t) return c.trackId;
        var mName = t.memberKey ? (bandMembersMap[t.memberKey] ? bandMembersMap[t.memberKey].name.split(' ')[0] : t.memberKey) : 'ambient';
        return t.label + ' · ' + mName;
    }

    var lines = [];
    lines.push('# Multitrack rehearsal — ' + (sessionDateLabel || 'undated') + (sessionVenue || ''));
    lines.push(p.tracks.length + ' tracks · ' + comments.length + ' comments');
    lines.push('');
    lines.push('## By timestamp');
    lines.push('');
    comments.forEach(function(c) {
        var tagSuffix = c.tags && c.tags.length ? ' `' + c.tags.join('` `') + '`' : '';
        lines.push('- **[' + _mtFmtTime(c.timestampSec) + ']** ' + (c.text || '(no text)') + ' — _' + trackLabel(c) + '_' + tagSuffix);
    });

    // Group by tag — only includes tagged comments
    var byTag = {};
    comments.forEach(function(c) {
        (c.tags || []).forEach(function(tag) {
            if (!byTag[tag]) byTag[tag] = [];
            byTag[tag].push(c);
        });
    });
    var tagKeys = Object.keys(byTag).sort();
    if (tagKeys.length) {
        lines.push('');
        lines.push('## By tag');
        lines.push('');
        tagKeys.forEach(function(tag) {
            lines.push('### ' + tag + ' (' + byTag[tag].length + ')');
            byTag[tag].forEach(function(c) {
                lines.push('- **[' + _mtFmtTime(c.timestampSec) + ']** ' + (c.text || '(no text)') + ' — _' + trackLabel(c) + '_');
            });
            lines.push('');
        });
    }

    var md = lines.join('\n');
    try {
        await navigator.clipboard.writeText(md);
        if (typeof showToast === 'function') showToast('✅ Copied digest (' + comments.length + ' comments) to clipboard');
    } catch (e) {
        // Fallback: open a textarea so the user can copy manually
        var ta = document.createElement('textarea');
        ta.value = md;
        ta.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80vw;height:60vh;z-index:6000;background:#1e293b;color:white;border:1px solid #475569;font-family:monospace;font-size:13px;padding:12px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        if (typeof showToast === 'function') showToast('Clipboard blocked — text shown for manual copy');
        setTimeout(function() { try { ta.remove(); } catch (e) {} }, 30000);
    }
};

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

window._mtSetMemberFilter = function(memberKey) {
    var p = _mtState.player;
    if (!p) return;
    p.commentFilterMember = memberKey || '';
    _mtRefreshCommentPanel();
};

console.log('🎚 multitrack-rehearsal.js loaded (Phase A + B)');
