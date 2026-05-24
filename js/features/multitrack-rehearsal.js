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

// ── Wizard (5-step ingest walkthrough) ──────────────────────────────────────
// Drew 2026-05-10: needs a "REALLY easy simple UI that walks me through
// exactly where to do it and where it ends up." Five steps from SD card to
// playback. Steps 1-2 are pure instructions; step 3 reuses the existing
// drop zone; step 4 reuses _mtRenderMappingTable + _mtConfirmMapping; step
// 5 is the post-upload success state. All existing IDs preserved.

var _MT_WIZ_STEPS = [
    { n: 1, title: 'SD Card → Mac',     icon: '💾' },
    { n: 2, title: 'REAPER render',     icon: '🎛' },
    { n: 3, title: 'Drop stems',        icon: '📂' },
    { n: 4, title: 'Confirm + upload',  icon: '🚀' },
    { n: 5, title: 'Review',            icon: '🎚' }
];

function _mtTodayStamp() {
    var d = new Date();
    return d.toISOString().slice(0, 10);
}

function _mtRehearsalFolderHint() {
    return '~/Music/DeadCetera/Rehearsals/' + _mtTodayStamp() + '-deadcetera/';
}

function _mtRenderWizardStepper() {
    var cur = _mtState.wizardStep || 1;
    var html = '<div class="mt-wiz-stepper">';
    _MT_WIZ_STEPS.forEach(function(s, i) {
        var state = s.n < cur ? 'done' : (s.n === cur ? 'current' : 'todo');
        html += '<button class="mt-wiz-pill mt-wiz-pill--' + state + '" onclick="_mtWizGoTo(' + s.n + ')">' +
                '<span class="mt-wiz-pill-num">' + (state === 'done' ? '✓' : s.n) + '</span>' +
                '<span class="mt-wiz-pill-label">' + s.title + '</span>' +
                '</button>';
        if (i < _MT_WIZ_STEPS.length - 1) html += '<span class="mt-wiz-divider"></span>';
    });
    html += '</div>';
    return html;
}

function _mtRenderStep1() {
    var safePath = _mtRehearsalFolderHint();
    return ''+
    '<div class="mt-wiz-step">' +
        '<div class="mt-wiz-step-eyebrow">STEP 1 OF 5</div>' +
        '<div class="mt-wiz-step-title">💾 Get the recording onto your Mac</div>' +
        '<div class="mt-wiz-checklist">' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">①</span><div><strong>Pop the SD card</strong> out of the X32 → into a USB 3.0 reader → into your Mac.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">②</span><div><strong>Copy the dated session folder</strong> (named like <code>5CB2934C/</code>) from the card to:<div class="mt-wiz-path">' + escHtml(safePath) + ' <button class="mt-wiz-copy" onclick="_mtCopyPath(\'' + escHtml(safePath) + '\')">📋 Copy</button></div>Skip the empty <code>X_LIVE/</code> folder and any <code>.Spotlight-V100</code> / <code>.fseventsd</code> metadata.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">③</span><div><strong>Eject the card safely</strong> when copy finishes.</div></div>' +
        '</div>' +
        '<div class="mt-wiz-callout">' +
            '<strong>What\'s in the folder?</strong> The X32 records multi-channel WAV split into chunks at 4 GB (FAT32 limit). A 3-hour rehearsal is ~17 chunks at ~4.3 GB each plus one smaller tail file. REAPER reassembles + demuxes them in the next step.' +
        '</div>' +
        '<div class="mt-wiz-time-est">⏱ ~2-4 min for ~30-70 GB at USB 3.0 speeds. Longer rehearsals = larger card contents.</div>' +
    '</div>';
}

function _mtRenderStep2() {
    var path = _mtRehearsalFolderHint();
    return ''+
    '<div class="mt-wiz-step">' +
        '<div class="mt-wiz-step-eyebrow">STEP 2 OF 5</div>' +
        '<div class="mt-wiz-step-title">🎛 Demux + render to FLAC stems (REAPER)</div>' +
        '<div class="mt-wiz-checklist">' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">①</span><div><strong>Open REAPER</strong> → File → New project from template → <code>GrooveLinx-Multitrack</code>.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">②</span><div><strong>Set project sample rate to 48 kHz.</strong> ⌘⇧P → <em>check the "Project sample rate" box</em> → 48000 → OK. (If unchecked, REAPER falls back to hardware default; X32 records at 48.)</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">③</span><div><strong>Bulk-drag all WAV chunks in.</strong> Select all in Finder, drag together onto the empty arrange area. Prompt → pick <strong>"Sequential time positions on a single track"</strong>.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">④</span><div><strong>Glue + Explode.</strong> Select all items (⌘A) → right-click → <strong>Glue items</strong>. Then right-click the glued item → <strong>Item processing → Explode multichannel audio to new one-channel items</strong>. ~10 min wait. Result: ~32 mono tracks named <code>[c1]</code>–<code>[c32]</code>.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">⑤</span><div><strong>Solo + listen + rename</strong> each <code>[cN]</code> track per the convention <code>NN_role-member</code> (see table). <em>Don\'t delete the source track</em> — exploded items reference it.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">⑥</span><div><strong>Reset all track faders to 0 dB + pans to center</strong> before render. Track levels bake into the stems and bias analysis. Action list (<code>?</code>) → <code>Track: Set selected track(s) volume to 0 dB</code>.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">⑦</span><div><strong>File → Render…</strong> Select the audio tracks only (NOT the source / Master File). Load preset <code>GrooveLinx FLAC stems</code> (24-bit · 48 kHz · mono · FLAC). Click <strong>Render N files</strong>. ~5-15 min.</div></div>' +
            '<div class="mt-wiz-li"><span class="mt-wiz-li-num">⑧</span><div><strong>Stems land in:</strong> <code>' + escHtml(path) + 'stems/</code></div></div>' +
        '</div>' +
        '<details class="mt-wiz-details" open>' +
            '<summary>Expected files (Deadcetera X32 plot — verify the first time)</summary>' +
            '<table class="mt-wiz-roster">' +
                '<tr><td><code>01</code></td><td>Vocal</td><td><strong>Drew</strong></td></tr>' +
                '<tr><td><code>02</code></td><td>Vocal</td><td><strong>Brian</strong></td></tr>' +
                '<tr><td><code>03</code></td><td>Vocal</td><td><strong>Chris</strong></td></tr>' +
                '<tr><td><code>04</code></td><td>Vocal</td><td><strong>Pierce</strong></td></tr>' +
                '<tr><td><code>05</code></td><td>Lead guitar</td><td><strong>Brian</strong></td></tr>' +
                '<tr><td><code>06</code></td><td>Rhythm guitar</td><td><strong>Drew</strong></td></tr>' +
                '<tr><td><code>07</code></td><td>Bass</td><td><strong>Chris</strong></td></tr>' +
                '<tr><td><code>08</code></td><td>Reserved — mute</td><td><em>future Jay mic</em></td></tr>' +
                '<tr><td><code>09</code></td><td>Bongos</td><td><strong>Jay</strong></td></tr>' +
                '<tr><td><code>10</code></td><td>Kick</td><td><strong>Jay</strong></td></tr>' +
                '<tr><td><code>11</code></td><td>Snare</td><td><strong>Jay</strong></td></tr>' +
                '<tr><td><code>12–14</code></td><td>Toms 1-3</td><td><strong>Jay</strong></td></tr>' +
                '<tr><td><code>15–16</code></td><td>Overheads L/R</td><td><strong>Jay</strong></td></tr>' +
                '<tr><td><code>17–18</code></td><td>Keys L/R</td><td><strong>Pierce</strong></td></tr>' +
            '</table>' +
            '<div class="mt-wiz-note">Channel <code>08</code> is a placeholder for a future Jay mic — mute the track before render so no noise-only FLAC gets written. Channels 19-32 are unused inputs; don\'t include them in the render selection.</div>' +
        '</details>' +
        '<div class="mt-wiz-time-est">⏱ First-time setup: ~25 min (template + verify channel layout). Future rehearsals: ~10 min using the saved template + preset. Full recipe: <code>02_GrooveLinx/specs/multitrack_reaper_export_checklist.md</code></div>' +
    '</div>';
}

function _mtRenderStep3() {
    return ''+
    '<div class="mt-wiz-step">' +
        '<div class="mt-wiz-step-eyebrow">STEP 3 OF 5</div>' +
        '<div class="mt-wiz-step-title">📂 Drop stems folder into GrooveLinx</div>' +
        '<div class="mt-wiz-step-sub">Open your <code>stems/</code> folder, select all the FLAC files (<code>⌘A</code>), and drag them onto the box. OR click the box to browse + multi-select. Auto-mapping fires the moment files land. <em>(Dragging the folder itself doesn\'t work — browsers don\'t expand folders into the file list.)</em></div>' +
        // Drop zone — same id/wiring as the legacy modal so _mtFilesPicked
        // and the change/drop handlers work unchanged.
        '<div id="mtDropZone" class="mt-wiz-dropzone">' +
            '<div class="mt-wiz-dropzone-icon">📁</div>' +
            '<div class="mt-wiz-dropzone-title">Drop FLACs here</div>' +
            '<div class="mt-wiz-dropzone-sub">or click to browse — multiple files OK. Convention: <code>NN_role-member.flac</code></div>' +
            '<input type="file" id="mtFileInput" multiple accept=".flac,.wav,.opus,.mp3,.m4a" style="display:none">' +
        '</div>' +
        '<div class="mt-wiz-time-est">⏱ Files stay local until you click Upload in the next step.</div>' +
    '</div>';
}

function _mtRenderStep4() {
    return ''+
    '<div class="mt-wiz-step">' +
        '<div class="mt-wiz-step-eyebrow">STEP 4 OF 5</div>' +
        '<div class="mt-wiz-step-title">🚀 Confirm mapping & upload</div>' +
        '<div class="mt-wiz-step-sub">Review the auto-mapped roles. Set the date and venue. Then upload — runs in parallel.</div>' +
        // Existing IDs reused so _mtRenderMappingTable populates them
        '<div id="mtMappingArea" class="mt-wiz-mapping"></div>' +
        '<div id="mtFooter" class="mt-wiz-confirm-row"></div>' +
        '<div class="mt-wiz-destinations">' +
            '<div class="mt-wiz-destinations-title">Where it ends up</div>' +
            '<div class="mt-wiz-dest-row"><span class="mt-wiz-dest-key">📦 Files</span><span class="mt-wiz-dest-val">Cloudflare R2 — <code>groovelinx-multitrack</code> bucket</span></div>' +
            '<div class="mt-wiz-dest-row"><span class="mt-wiz-dest-key">🗂 Metadata</span><span class="mt-wiz-dest-val">Firebase — <code>bands/deadcetera/multitrack_sessions/{sessionId}</code></span></div>' +
            '<div class="mt-wiz-dest-row"><span class="mt-wiz-dest-key">▶ Playback</span><span class="mt-wiz-dest-val">Streamed back through the multitrack player (mute / solo / scrub)</span></div>' +
            '<div class="mt-wiz-dest-row"><span class="mt-wiz-dest-key">📝 Comments</span><span class="mt-wiz-dest-val">Timestamped + tagged; promotable to PracticeTasks</span></div>' +
        '</div>' +
        '<div class="mt-wiz-time-est">⏱ ~3–5 min for ~14 GB on a 100 Mbps connection.</div>' +
    '</div>';
}

function _mtRenderStep5() {
    var sid = _mtState.sessionId || '';
    var trackCount = (_mtState.pickedFiles || []).length;
    var totalBytes = (_mtState.pickedFiles || []).reduce(function(s, p) { return s + (p.sizeBytes || 0); }, 0);
    return ''+
    '<div class="mt-wiz-step">' +
        '<div class="mt-wiz-step-eyebrow">STEP 5 OF 5 · DONE</div>' +
        '<div class="mt-wiz-step-title">🎉 Session uploaded — ready to review</div>' +
        '<div class="mt-wiz-summary">' +
            '<div class="mt-wiz-summary-row"><span>Session ID</span><code>' + escHtml(sid) + '</code></div>' +
            '<div class="mt-wiz-summary-row"><span>Tracks</span><strong>' + trackCount + '</strong></div>' +
            '<div class="mt-wiz-summary-row"><span>Total size</span><strong>' + _mtBytesLabel(totalBytes) + '</strong></div>' +
        '</div>' +
        '<div class="mt-wiz-next-actions">' +
            '<div class="mt-wiz-step-sub">Up next inside the multitrack player:</div>' +
            '<ul>' +
                '<li><strong>Mute / solo</strong> any combination of tracks. Scrub the master timeline.</li>' +
                '<li><strong>Drop timestamped comments</strong> with tags (rushed, dragged, pitchy, wrong chord, missed cue, transition, too loud, too quiet, tone, nail this, revisit).</li>' +
                '<li><strong>Promote a comment</strong> to a PracticeTask so it surfaces in the next Practice session for that song.</li>' +
            '</ul>' +
        '</div>' +
        '<div class="mt-wiz-action-row">' +
            '<button class="mt-wiz-btn-primary" onclick="_mtWizOpenPlayer()">▶ Open multitrack player</button>' +
            '<button class="mt-wiz-btn-ghost" onclick="_mtCancelImport()">Close</button>' +
        '</div>' +
    '</div>';
}

window._mtWizGoTo = function(n) {
    if (n < 1 || n > 5) return;
    _mtState.wizardStep = n;
    _mtRenderWizardStep();
};

window._mtWizNext = function() {
    var n = (_mtState.wizardStep || 1) + 1;
    if (n > 5) return;
    _mtWizGoTo(n);
};

window._mtWizBack = function() {
    var n = (_mtState.wizardStep || 1) - 1;
    if (n < 1) return;
    _mtWizGoTo(n);
};

window._mtWizOpenPlayer = function() {
    var sid = _mtState.sessionId;
    _mtCancelImport();
    if (sid && typeof window._mtOpenPlayer === 'function') {
        window._mtOpenPlayer(sid);
    }
};

window._mtCopyPath = function(path) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(path);
            if (typeof showToast === 'function') showToast('Path copied to clipboard');
            return;
        }
    } catch (e) {}
    if (typeof showToast === 'function') showToast(path);
};

function _mtRenderWizardStep() {
    var body = document.getElementById('mtWizBody');
    var stepper = document.getElementById('mtWizStepper');
    var footer = document.getElementById('mtWizFooter');
    if (!body || !footer) return;
    if (stepper) stepper.outerHTML = _mtRenderWizardStepper();
    var step = _mtState.wizardStep || 1;
    if (step === 1) body.innerHTML = _mtRenderStep1();
    else if (step === 2) body.innerHTML = _mtRenderStep2();
    else if (step === 3) {
        body.innerHTML = _mtRenderStep3();
        _mtWireDropZoneInWizard();
    }
    else if (step === 4) {
        body.innerHTML = _mtRenderStep4();
        _mtRenderMappingTable();
        // Patch the existing Confirm button so it advances to step 5 on success
        _mtPatchConfirmForWizard();
    }
    else if (step === 5) body.innerHTML = _mtRenderStep5();

    // Footer: prev / next buttons (hidden on step 5)
    if (step >= 5) {
        footer.innerHTML = '';
    } else {
        var canBack = step > 1;
        var canNext = step < 4 || (step === 4 && !!_mtState.uploadComplete);
        var nextLabel = step === 1 ? 'Did the copy → Step 2 →' :
                        step === 2 ? 'Render done → Step 3 →' :
                        step === 3 ? (_mtState.pickedFiles.length ? 'Files loaded → Step 4 →' : 'Drop files first to continue') :
                        step === 4 ? 'Upload first to continue' : 'Next →';
        footer.innerHTML =
            '<button class="mt-wiz-btn-ghost" ' + (canBack ? '' : 'disabled ') + 'onclick="_mtWizBack()">← Back</button>' +
            '<span style="flex:1"></span>' +
            '<button class="mt-wiz-btn-primary" ' + (canNext ? '' : 'disabled ') + 'onclick="_mtWizNext()">' + nextLabel + '</button>';
    }
}

function _mtWireDropZoneInWizard() {
    var dz = document.getElementById('mtDropZone');
    var input = document.getElementById('mtFileInput');
    if (!dz || !input) return;
    dz.addEventListener('click', function() { input.click(); });
    input.addEventListener('change', function(e) {
        _mtFilesPicked(Array.from(e.target.files));
        // Auto-advance if files came in
        if (_mtState.pickedFiles.length) setTimeout(function() { _mtWizGoTo(4); }, 250);
    });
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('mt-wiz-dropzone--hot'); });
    dz.addEventListener('dragleave', function() { dz.classList.remove('mt-wiz-dropzone--hot'); });
    dz.addEventListener('drop', function(e) {
        e.preventDefault();
        dz.classList.remove('mt-wiz-dropzone--hot');
        var files = Array.from(e.dataTransfer.files || []);
        _mtFilesPicked(files);
        if (_mtState.pickedFiles.length) setTimeout(function() { _mtWizGoTo(4); }, 250);
    });
}

function _mtPatchConfirmForWizard() {
    // Poll _mtState.activeUpload.tracks for completion. Each track gets
    // a `stemUrl` once its R2 upload succeeds. When every track has a
    // stemUrl, the session has been written to Firebase and we're ready
    // to advance to step 5.
    var observer = setInterval(function() {
        if (!document.getElementById('mtImportModal')) { clearInterval(observer); return; }
        var u = _mtState.activeUpload;
        if (!u || !u.tracks || !u.tracks.length) return;
        var allDone = u.tracks.every(function(t) { return !!t.stemUrl; });
        if (allDone) {
            _mtState.uploadComplete = true;
            clearInterval(observer);
            if ((_mtState.wizardStep || 1) === 4) _mtWizGoTo(5);
        }
    }, 800);
}

window._mtOpenImportModal = function() {
    var existing = document.getElementById('mtImportModal');
    if (existing) existing.remove();
    _mtState.wizardStep = 1;
    _mtState.pickedFiles = [];
    _mtState.sessionId = null;
    _mtState.uploads = {};
    _mtState.uploadComplete = false;

    var ov = document.createElement('div');
    ov.id = 'mtImportModal';
    ov.className = 'mt-wiz-overlay';
    ov.innerHTML =
        '<div class="mt-wiz-card">' +
            '<div class="mt-wiz-header">' +
                '<div class="mt-wiz-header-icon">🎚</div>' +
                '<div class="mt-wiz-header-titleblock">' +
                    '<div class="mt-wiz-header-title">Multitrack Rehearsal Ingest</div>' +
                    '<div class="mt-wiz-header-sub">X32 SD card → GrooveLinx in 5 steps</div>' +
                '</div>' +
                '<button class="mt-wiz-close" onclick="_mtCancelImport()" title="Cancel">×</button>' +
            '</div>' +
            '<div id="mtWizStepper">' + _mtRenderWizardStepper() + '</div>' +
            '<div class="mt-wiz-body" id="mtWizBody"></div>' +
            '<div class="mt-wiz-footer" id="mtWizFooter"></div>' +
        '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) _mtCancelImport(); });
    _mtInjectWizardStyles();
    _mtRenderWizardStep();
};

function _mtInjectWizardStyles() {
    if (document.getElementById('mtWizStyles')) return;
    var s = document.createElement('style');
    s.id = 'mtWizStyles';
    s.textContent = [
        '.mt-wiz-overlay { position: fixed; inset: 0; z-index: 5000; background: rgba(0,0,0,0.82); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }',
        '.mt-wiz-card { width: 100%; max-width: 760px; max-height: 92vh; background: linear-gradient(160deg, #0f172a, #1e293b); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }',
        '.mt-wiz-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }',
        '.mt-wiz-header-icon { font-size: 1.6em; }',
        '.mt-wiz-header-titleblock { flex: 1; min-width: 0; }',
        '.mt-wiz-header-title { font-size: 1.05em; font-weight: 800; color: #f1f5f9; }',
        '.mt-wiz-header-sub { font-size: 0.78em; color: var(--text-dim); margin-top: 2px; }',
        '.mt-wiz-close { background: none; border: none; color: #64748b; font-size: 1.5em; cursor: pointer; padding: 0 6px; }',
        '.mt-wiz-stepper { display: flex; align-items: center; gap: 4px; padding: 10px 16px; background: rgba(0,0,0,0.18); border-bottom: 1px solid rgba(255,255,255,0.04); overflow-x: auto; flex-shrink: 0; }',
        '.mt-wiz-pill { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); color: var(--text-dim); cursor: pointer; font-family: inherit; font-size: 0.74em; white-space: nowrap; }',
        '.mt-wiz-pill:hover { background: rgba(255,255,255,0.05); color: var(--text); }',
        '.mt-wiz-pill--current { background: rgba(99,102,241,0.15); color: #a5b4fc; border-color: rgba(99,102,241,0.45); font-weight: 700; }',
        '.mt-wiz-pill--done { background: rgba(34,197,94,0.10); color: #86efac; border-color: rgba(34,197,94,0.30); }',
        '.mt-wiz-pill-num { font-weight: 800; min-width: 14px; text-align: center; }',
        '.mt-wiz-divider { width: 14px; height: 1px; background: rgba(255,255,255,0.10); flex-shrink: 0; }',
        '.mt-wiz-body { flex: 1; overflow-y: auto; padding: 20px 24px; min-height: 0; }',
        '.mt-wiz-footer { display: flex; gap: 8px; align-items: center; padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }',
        '.mt-wiz-step-eyebrow { font-size: 0.66em; font-weight: 800; letter-spacing: 0.10em; color: #818cf8; }',
        '.mt-wiz-step-title { font-size: 1.20em; font-weight: 800; color: var(--text); margin: 4px 0 12px; }',
        '.mt-wiz-step-sub { font-size: 0.85em; color: var(--text-dim); margin-bottom: 14px; line-height: 1.5; }',
        '.mt-wiz-checklist { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }',
        '.mt-wiz-li { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; font-size: 0.88em; line-height: 1.5; color: var(--text); }',
        '.mt-wiz-li-num { font-weight: 800; color: #a5b4fc; flex-shrink: 0; min-width: 22px; }',
        '.mt-wiz-li code, .mt-wiz-step code { background: rgba(99,102,241,0.12); padding: 1px 6px; border-radius: 4px; font-size: 0.92em; color: #c7d2fe; }',
        '.mt-wiz-path { margin-top: 4px; padding: 6px 8px; background: #0a0e1a; border-radius: 6px; font-family: ui-monospace,monospace; font-size: 0.85em; color: #c7d2fe; display: flex; align-items: center; gap: 8px; }',
        '.mt-wiz-copy { background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.35); color: #a5b4fc; cursor: pointer; padding: 3px 8px; border-radius: 4px; font-size: 0.78em; font-family: inherit; margin-left: auto; }',
        '.mt-wiz-callout { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.20); border-radius: 8px; padding: 10px 12px; font-size: 0.82em; color: var(--text); line-height: 1.5; margin-bottom: 12px; }',
        '.mt-wiz-time-est { font-size: 0.74em; color: var(--text-dim); font-style: italic; padding: 8px 0 0; border-top: 1px solid rgba(255,255,255,0.04); margin-top: 8px; }',
        '.mt-wiz-details { margin-top: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; }',
        '.mt-wiz-details summary { cursor: pointer; font-size: 0.85em; font-weight: 700; color: var(--text); }',
        '.mt-wiz-roster { width: 100%; margin-top: 8px; font-size: 0.80em; border-collapse: collapse; }',
        '.mt-wiz-roster td { padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--text); }',
        '.mt-wiz-roster td:first-child { color: #a5b4fc; font-family: ui-monospace,monospace; width: 60px; }',
        '.mt-wiz-roster td:nth-child(2) { color: var(--text-dim); width: 110px; }',
        '.mt-wiz-note { font-size: 0.74em; color: var(--text-dim); font-style: italic; margin-top: 8px; }',
        '.mt-wiz-dropzone { border: 2px dashed rgba(99,102,241,0.4); border-radius: 12px; padding: 36px 20px; text-align: center; cursor: pointer; background: rgba(99,102,241,0.04); transition: background 0.15s, border-color 0.15s; }',
        '.mt-wiz-dropzone--hot { background: rgba(99,102,241,0.14); border-color: #818cf8; }',
        '.mt-wiz-dropzone-icon { font-size: 2em; }',
        '.mt-wiz-dropzone-title { font-size: 1em; font-weight: 700; color: var(--text); margin-top: 6px; }',
        '.mt-wiz-dropzone-sub { font-size: 0.78em; color: var(--text-dim); margin-top: 4px; }',
        '.mt-wiz-mapping { max-height: 320px; overflow-y: auto; margin-top: 4px; }',
        '.mt-wiz-confirm-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap; }',
        '.mt-wiz-destinations { margin-top: 16px; padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; }',
        '.mt-wiz-destinations-title { font-size: 0.72em; font-weight: 800; color: var(--text-dim); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }',
        '.mt-wiz-dest-row { display: flex; gap: 10px; padding: 4px 0; font-size: 0.80em; }',
        '.mt-wiz-dest-key { min-width: 100px; color: var(--text); font-weight: 600; }',
        '.mt-wiz-dest-val { color: var(--text-dim); }',
        '.mt-wiz-summary { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.20); border-radius: 8px; margin-bottom: 14px; }',
        '.mt-wiz-summary-row { display: flex; justify-content: space-between; gap: 10px; font-size: 0.85em; color: var(--text); }',
        '.mt-wiz-summary-row span { color: var(--text-dim); }',
        '.mt-wiz-next-actions { font-size: 0.84em; color: var(--text); line-height: 1.5; }',
        '.mt-wiz-next-actions ul { padding-left: 20px; margin-top: 6px; }',
        '.mt-wiz-next-actions li { margin-bottom: 4px; }',
        '.mt-wiz-action-row { display: flex; gap: 8px; margin-top: 16px; }',
        '.mt-wiz-btn-primary { padding: 10px 18px; border: none; border-radius: 8px; background: linear-gradient(135deg,#667eea,#764ba2); color: #fff; font-weight: 800; cursor: pointer; font-family: inherit; font-size: 0.88em; }',
        '.mt-wiz-btn-primary[disabled] { background: rgba(99,102,241,0.2); cursor: not-allowed; opacity: 0.6; }',
        '.mt-wiz-btn-primary:not([disabled]):hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(102,126,234,0.4); }',
        '.mt-wiz-btn-ghost { padding: 10px 14px; border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; background: rgba(255,255,255,0.02); color: var(--text-dim); cursor: pointer; font-family: inherit; font-size: 0.84em; }',
        '.mt-wiz-btn-ghost[disabled] { opacity: 0.4; cursor: not-allowed; }',
        '.mt-wiz-btn-ghost:not([disabled]):hover { color: var(--text); border-color: rgba(255,255,255,0.25); }'
    ].join('\n');
    document.head.appendChild(s);
}

window._mtCancelImport = function() {
    // Stab #13 — actually abort in-flight uploads. Previously this just
    // removed the DOM element; fetches continued running, R2 received
    // partial files, and the session was left referencing partial URLs.
    // Idempotent: re-entry (e.g., double-click on the close button or
    // backdrop) is safe — _mtAbortAllUploads short-circuits on already-aborted.
    var abortedCount = _mtAbortAllUploads('modal_closed');
    var ov = document.getElementById('mtImportModal');
    if (ov) ov.remove();
    _mtState.pickedFiles = [];
    _mtState.sessionId = null;
    _mtState.uploads = {};
    if (abortedCount > 0 && typeof showToast === 'function') {
        showToast('Cancelled ' + abortedCount + ' in-flight upload' + (abortedCount === 1 ? '' : 's'));
    }
    _mtState.activeUpload = null;
};

// Stab #13 — Runtime Health Overlay accessor + offline + route-leave hooks.
// Exposes a small stats object so observability can surface "uploads in
// flight" + "last abort reason" without monkey-patching the wizard.
window._mtGetUploadStats = function() {
    var u = _mtState.activeUpload;
    if (!u) return { available: false };
    var inFlight = 0, queued = 0, done = 0, failed = 0, cancelled = 0;
    (u.tracks || []).forEach(function(t) {
        if (t.stemUrl) done++;
        else if (t._uploadStatus === 'uploading') inFlight++;
        else if (t._uploadStatus === 'failed') failed++;
        else if (t._uploadStatus === 'cancelled') cancelled++;
        else queued++;
    });
    return {
        available: true,
        sessionId: u.sessionId || null,
        aborted: !!u.aborted,
        abortReason: u.abortReason || null,
        total: (u.tracks || []).length,
        inFlight: inFlight,
        queued: queued,
        done: done,
        failed: failed,
        cancelled: cancelled,
    };
};

// Offline-mid-upload signal — when the network drops, mark the activeUpload
// so the UI message can distinguish "interrupted by network" from a generic
// failure. The actual fetch aborts on the underlying socket error and lands
// in the catch branch of _mtUploadOne with track._uploadStatus = 'failed'.
// We don't auto-abort here; in-flight bytes may still complete on the way
// down, and partial-success semantics are better than aggressive teardown.
if (typeof window !== 'undefined' && !window._mtOfflineWired) {
    window._mtOfflineWired = true;
    window.addEventListener('offline', function() {
        var u = _mtState.activeUpload;
        if (u && !u.aborted) {
            u.wentOffline = true;
            console.log('[Multitrack] offline detected during upload — in-flight fetches may fail');
            _mtRenderUploadProgress();
        }
    });
}

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
        var cancelledCount = u.tracks.filter(function(t) { return t._uploadStatus === 'cancelled'; }).length;
        var doneCount = u.tracks.filter(function(t) { return t.stemUrl; }).length;
        if (u.aborted) {
            // Stab #13 — truthful cancellation state. Distinguish how the
            // session was aborted: user closed modal vs. underlying error
            // path. Partial-success semantics if some tracks did complete
            // before the abort.
            var reasonLabel = u.abortReason === 'modal_closed' ? 'Modal closed — uploads cancelled.'
                : u.abortReason === 'route_left' ? 'Navigated away — uploads cancelled.'
                : 'Uploads cancelled.';
            var partialLabel = (doneCount > 0)
                ? ' (' + doneCount + ' of ' + u.tracks.length + ' completed before cancel)'
                : '';
            footer.innerHTML = '<div style="font-size:0.78em;color:#94a3b8">' + reasonLabel + partialLabel + '</div>';
        } else if (failedCount > 0) {
            footer.innerHTML = '<div style="font-size:0.78em;color:#fbbf24">⚠ ' + failedCount + ' upload(s) failed — click Retry on any failed row, or close to abort.</div>'
                + '<button onclick="_mtRetryAllFailed()" style="margin-left:auto;padding:5px 10px;border-radius:6px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.12);color:#fbbf24;cursor:pointer;font-size:0.78em;font-weight:700">↻ Retry all failed</button>';
            footer.style.display = 'flex';
            footer.style.alignItems = 'center';
            footer.style.gap = '8px';
        } else if (doneCount === u.tracks.length) {
            footer.innerHTML = '<div style="font-size:0.78em;color:#22c55e">✓ All uploaded — finalizing session…</div>';
        } else if (cancelledCount > 0 && (doneCount + cancelledCount === u.tracks.length)) {
            // All work completed but some pieces were cancelled (no failures)
            footer.innerHTML = '<div style="font-size:0.78em;color:#94a3b8">' + doneCount + ' uploaded, ' + cancelledCount + ' cancelled.</div>';
        } else {
            var offlineNote = u.wentOffline ? ' (network interrupted — some uploads may fail)' : '';
            footer.innerHTML = '<div style="font-size:0.78em;color:var(--text-dim)">Uploading… ' + doneCount + ' / ' + u.tracks.length + ' done. Closing the modal will cancel pending uploads.' + offlineNote + '</div>';
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
            } else if (t._uploadStatus === 'cancelled') {
                // Stab #13 — cancelled is calm, not alarming. The user did this
                // on purpose (or accepted it via modal close). Retry is still
                // available so they can re-upload without re-mapping.
                statusHtml = '<button onclick="_mtRetryUpload(\'' + escHtml(t.trackId) + '\')" style="padding:2px 8px;border-radius:5px;border:1px solid rgba(148,163,184,0.4);background:rgba(148,163,184,0.10);color:#94a3b8;cursor:pointer;font-size:0.72em;font-weight:600">↻ Re-upload</button>';
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
    // C2 Phase 2: route through canonical create when available.
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    try {
        if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.create) {
            await GLStore.RehearsalSession.create(u.sessionId, session);
        } else if (db && typeof bandPath === 'function') {
            // Legacy fallback (cached-shell safety)
            await db.ref(bandPath('rehearsal_sessions/' + u.sessionId)).set(session);
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('⚠ Session save failed: ' + (e.message || 'unknown'));
        return;
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
//
// Stab #13 (2026-05-14) — Trust hardening per Audit #09 §3.2.1/§3.2.2. The
// modal UI promised "Closing the modal will cancel pending uploads" but no
// AbortController was actually wired — closing the modal left in-flight
// fetches running, R2 received partial files, and the session referenced
// URLs for incomplete uploads. New behavior: per-upload AbortController
// stored on track._uploadController; `_mtAbortAllUploads(reason)` walks
// active controllers and aborts; AbortError is treated as 'cancelled'
// (distinct from 'failed' so the UI doesn't misrepresent the cause).
async function _mtUploadOne(file, sessionId, track) {
    var url = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev') + '/multitrack/upload';
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';

    // If the parent upload session was already aborted (e.g., user closed
    // the modal between Promise.all chunks), don't even fire this fetch.
    var u = _mtState.activeUpload;
    if (u && u.aborted) {
        track._uploadStatus = 'cancelled';
        track._uploadError = null;
        _mtRenderUploadProgress();
        return { ok: false, cancelled: true };
    }

    // Fresh controller per attempt — a retry will get a new one. Old one (if
    // present from a previous failed try) is discarded; nothing references it.
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    track._uploadController = controller;
    track._uploadStatus = 'uploading';
    track._uploadError = null;
    _mtRenderUploadProgress();
    console.log('[Multitrack] upload started:', file.name);
    try {
        var res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': file.type || 'audio/flac',
                'X-Band-Slug': slug,
                'X-Session-Id': sessionId,
                'X-Filename': file.name
            },
            body: file,
            signal: controller ? controller.signal : undefined
        });
        var json = null;
        try { json = await res.json(); } catch (e) {}
        if (!res.ok || !json || !json.ok) {
            var msg = (json && json.error) ? json.error : ('HTTP ' + res.status);
            track._uploadStatus = 'failed';
            track._uploadError = msg;
            console.warn('[Multitrack] upload failed:', file.name, msg);
            _mtRenderUploadProgress();
            return { ok: false, error: msg };
        }
        track.stemUrl = json.publicUrl;
        track._uploadStatus = 'done';
        console.log('[Multitrack] upload completed:', file.name);
        _mtRenderUploadProgress();
        return { ok: true, key: json.key, publicUrl: json.publicUrl };
    } catch (e) {
        // AbortError can show up under a couple of names depending on the
        // browser; check both. Aborted uploads are NOT failures — they're
        // intentional cancellations and the UI must reflect that distinction.
        var isAbort = e && (e.name === 'AbortError' || e.code === 20
            || (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError'));
        if (isAbort) {
            track._uploadStatus = 'cancelled';
            track._uploadError = null;
            console.log('[Multitrack] upload aborted:', file.name);
            _mtRenderUploadProgress();
            return { ok: false, cancelled: true };
        }
        track._uploadStatus = 'failed';
        track._uploadError = e.message || 'network';
        console.warn('[Multitrack] upload error:', file.name, e);
        _mtRenderUploadProgress();
        return { ok: false, error: e.message || 'network' };
    } finally {
        // Drop the controller ref so subsequent abort sweeps don't try to
        // re-abort an already-settled fetch (idempotent but cleaner).
        if (track._uploadController === controller) track._uploadController = null;
    }
}

// Walk every track in the active upload session and abort its in-flight
// fetch. Safe to call multiple times — already-settled fetches' controllers
// are nulled in the upload finally block. The `aborted` flag prevents
// _mtUploadOne from firing new fetches for tracks that haven't started yet
// (relevant during a Promise.all chunk where some uploads kicked off and
// others are queued waiting for parallel slots).
function _mtAbortAllUploads(reason) {
    var u = _mtState.activeUpload;
    if (!u) return 0;
    if (u.aborted) return 0; // already done
    u.aborted = true;
    u.abortReason = reason || 'user_cancelled';
    var n = 0;
    (u.tracks || []).forEach(function(t) {
        if (t && t._uploadController) {
            try { t._uploadController.abort(); n++; } catch(_ae) {}
            t._uploadController = null;
        }
        // Any track still in 'uploading' or 'queued' transitions to 'cancelled'
        // immediately so the UI doesn't show a stale spinner while AbortError
        // propagates through the fetch chain.
        if (t && !t.stemUrl && t._uploadStatus !== 'failed' && t._uploadStatus !== 'cancelled') {
            t._uploadStatus = 'cancelled';
            t._uploadError = null;
        }
    });
    if (n > 0) console.log('[Multitrack] aborted ' + n + ' in-flight upload(s) — reason: ' + (reason || 'user_cancelled'));
    _mtRenderUploadProgress();
    return n;
}

// ── Multitrack player ────────────────────────────────────────────────────────

window._mtOpenPlayer = async function(sessionId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') {
        if (typeof showToast === 'function') showToast('Firebase not ready');
        return;
    }
    // C2 Phase 2: route through canonical loadById when available.
    var session = null;
    try {
        if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadById) {
            session = await GLStore.RehearsalSession.loadById(sessionId);
        } else {
            var snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId)).once('value');
            session = snap && snap.val();
        }
    } catch (e) {}
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
    // C2 Phase 2: route through canonical loadField when available.
    try {
        var val;
        if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadField) {
            val = await GLStore.RehearsalSession.loadField(sessionId, 'comments');
        } else {
            var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
            if (!db || typeof bandPath !== 'function') return [];
            var snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments')).once('value');
            val = snap.val();
        }
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
    // C2 Phase 2: route through canonical setField when available.
    try {
        if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.setField) {
            await GLStore.RehearsalSession.setField(sessionId, 'comments/' + comment.commentId, comment);
            return true;
        }
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return false;
        await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments/' + comment.commentId)).set(comment);
        return true;
    } catch (e) {
        console.warn('[Multitrack] save comment failed:', e.message);
        return false;
    }
}

async function _mtDeleteComment(sessionId, commentId) {
    // C2 Phase 2: route through canonical removeField when available.
    try {
        if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.removeField) {
            await GLStore.RehearsalSession.removeField(sessionId, 'comments/' + commentId);
            return true;
        }
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return false;
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
        // C2 Phase 2: route through canonical loadById when available.
        var sv;
        if (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadById) {
            sv = await GLStore.RehearsalSession.loadById(p.sessionId);
        } else {
            var s = await firebaseDB.ref(bandPath('rehearsal_sessions/' + p.sessionId)).once('value');
            sv = s && s.val();
        }
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
