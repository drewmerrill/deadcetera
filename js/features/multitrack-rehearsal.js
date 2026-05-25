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
    // Both with-hyphen and without-hyphen tom keys are recognized so the
    // auto-inference works for either filename convention (`tom-1-jay` and
    // `tom1-jay` both parse cleanly). Same display label = same dropdown
    // entry semantically — choosing either is fine.
    'tom1':      { label: 'Tom 1',     group: 'drums', order: 4 },
    'tom-1':     { label: 'Tom 1',     group: 'drums', order: 4 },
    'tom2':      { label: 'Tom 2',     group: 'drums', order: 5 },
    'tom-2':     { label: 'Tom 2',     group: 'drums', order: 5 },
    'tom3':      { label: 'Tom 3',     group: 'drums', order: 6 },
    'tom-3':     { label: 'Tom 3',     group: 'drums', order: 6 },
    'tom4':      { label: 'Tom 4',     group: 'drums', order: 6.5 },
    'ride':      { label: 'Ride',      group: 'drums', order: 7 },
    'oh-l':      { label: 'OH Left',   group: 'drums', order: 8 },
    'oh-r':      { label: 'OH Right',  group: 'drums', order: 9 },
    // Hand/auxiliary percussion (added 2026-05-24 from Drew's mic plot).
    'bongos':    { label: 'Bongos',    group: 'percussion', order: 9.1 },
    'congas':    { label: 'Congas',    group: 'percussion', order: 9.2 },
    'shaker':    { label: 'Shaker',    group: 'percussion', order: 9.3 },
    'tambourine':{ label: 'Tambourine',group: 'percussion', order: 9.4 },
    'percussion':{ label: 'Percussion',group: 'percussion', order: 9.5 },
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
    // 2026-05-24: switched to h:mm:ss when over an hour so the transport
    // label matches segment-row time format (which uses _mtFmtTimeShort,
    // same h:mm:ss switch). Before: transport showed "187:54" while
    // rows showed "3:07:54" — Drew (UAT): "the time in the right corner
    // is 187:54... but all the songs are in hour format 3:07:54...
    // which makes it hard to match to the song I am on."
    if (!isFinite(sec) || sec < 0) sec = 0;
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
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
    // 2026-05-24: switched from POST-through-worker to two-step
    // presigned-URL flow. Workers' edge has a ~100 MB request body cap that
    // killed the old direct-POST path for typical multitrack FLACs (500 MB
    // - 2 GB). New flow:
    //   1. POST a small JSON body to /multitrack/upload-url → worker
    //      returns a Sigv4-presigned R2 PUT URL (~1 KB response)
    //   2. PUT the file bytes directly to R2 via the presigned URL —
    //      bypasses the worker entirely, no size cap from R2.
    var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';

    var u = _mtState.activeUpload;
    if (u && u.aborted) {
        track._uploadStatus = 'cancelled';
        track._uploadError = null;
        _mtRenderUploadProgress();
        return { ok: false, cancelled: true };
    }

    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    track._uploadController = controller;
    track._uploadStatus = 'uploading';
    track._uploadError = null;
    _mtRenderUploadProgress();
    console.log('[Multitrack] upload started:', file.name);

    try {
        // ── Step 1: get presigned PUT URL ──────────────────────────────
        var urlRes = await fetch(workerBase + '/multitrack/upload-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Band-Slug': slug,
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({ filename: file.name }),
            signal: controller ? controller.signal : undefined
        });
        var urlJson = null;
        try { urlJson = await urlRes.json(); } catch (e) {}
        if (!urlRes.ok || !urlJson || !urlJson.ok || !urlJson.uploadUrl) {
            var urlMsg = (urlJson && urlJson.error) ? urlJson.error : ('HTTP ' + urlRes.status + ' from /multitrack/upload-url');
            track._uploadStatus = 'failed';
            track._uploadError = urlMsg;
            console.warn('[Multitrack] presign failed:', file.name, urlMsg);
            _mtRenderUploadProgress();
            return { ok: false, error: urlMsg };
        }

        // ── Step 2: PUT file directly to R2 via presigned URL ─────────
        // R2 returns 200 with empty body on success. ETag header is exposed
        // via the bucket's CORS ExposeHeaders config so we can read it.
        var putRes = await fetch(urlJson.uploadUrl, {
            method: 'PUT',
            body: file,
            // No custom headers — anything beyond `host` would invalidate
            // the Sigv4 signature. Content-Type is intentionally omitted;
            // R2 stores the bytes as-is and the public URL still serves
            // them with a reasonable default MIME type.
            signal: controller ? controller.signal : undefined
        });
        if (!putRes.ok) {
            var putMsg = 'R2 PUT failed: HTTP ' + putRes.status;
            track._uploadStatus = 'failed';
            track._uploadError = putMsg;
            console.warn('[Multitrack] R2 PUT failed:', file.name, putMsg);
            _mtRenderUploadProgress();
            return { ok: false, error: putMsg };
        }

        track.stemUrl = urlJson.publicUrl;
        track._uploadStatus = 'done';
        console.log('[Multitrack] upload completed:', file.name);
        _mtRenderUploadProgress();
        return { ok: true, key: urlJson.key, publicUrl: urlJson.publicUrl };
    } catch (e) {
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

// ── Player entry router (Review Mode default, Isolate Mode opt-in) ──────────
// Per the multitrack browser playback audit (2026-05-24):
//   - Review Mode (default): play one server-rendered stereo stream.
//     Sample-accurate, fast seek, no drift. Built from a recipe via
//     services/multitrack-render/render.py + worker /multitrack/render/*.
//   - Isolate Stems Mode: the legacy 17-stream player. Useful for short
//     A/B comparisons; honest banner warns about drift on long sessions.
// On first open we hit /multitrack/render/status. If a render exists,
// play it. If not, auto-trigger a render and show "Preparing review mix…"
// while it builds (~30-60s for a 3-hour rehearsal).
window._mtOpenPlayer = async function(sessionId, opts) {
    opts = opts || {};
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') {
        if (typeof showToast === 'function') showToast('Firebase not ready');
        return;
    }
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
    var tracks = session.tracks.slice().sort(function(a, b) {
        var ao = (_MT_ROLES[a.role] && _MT_ROLES[a.role].order) || 999;
        var bo = (_MT_ROLES[b.role] && _MT_ROLES[b.role].order) || 999;
        return ao - bo;
    });

    // Isolate Mode is a pure UI toggle — no render concerns.
    if (opts.mode === 'isolate') {
        return _mtOpenIsolateMode(session, tracks, sessionId);
    }

    // Three-step priority chain so we never fire duplicate renders, even
    // when the user explicitly toggles to Review Mode. Earlier bug
    // (2026-05-24): _mtSwitchToReview bypassed /status and blindly opened
    // Review Mode with no render → auto-render fired EVERY time the user
    // flipped Isolate → Review on a session that already had a render.
    //   1. /multitrack/render/status — completed render in R2 → use it
    //   2. Firebase _renderInFlight — in-flight render started by another
    //      tab/refresh within the last 15 min → RESUME polling that callId
    //   3. Neither → kick off a fresh render (in _mtKickAutoRender)
    var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var existingRender = (opts.mode === 'review' && opts.render) ? opts.render : null;
    var inFlight = null;
    if (!existingRender) {
        try {
            var sr = await fetch(workerBase + '/multitrack/render/status?bandSlug=' + encodeURIComponent(slug) + '&sessionId=' + encodeURIComponent(sessionId));
            if (sr.ok) {
                var sj = await sr.json();
                if (sj && Array.isArray(sj.renders) && sj.renders.length) {
                    existingRender = sj.renders[0]; // newest by worker sort
                }
            }
        } catch (e) {
            console.warn('[Multitrack] render status check failed (will continue in Review without auto-render):', e && e.message);
        }
    }
    // Only consult Firebase if /status returned no completed render — if a
    // completed one exists, in-flight Firebase entry is stale.
    if (!existingRender) {
        try {
            var ifSnap = await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/_renderInFlight')).once('value');
            var ifVal = ifSnap && ifSnap.val();
            if (ifVal && ifVal.callId && ifVal.startedAt) {
                var ageMs = Date.now() - new Date(ifVal.startedAt).getTime();
                if (ageMs >= 0 && ageMs < 15 * 60 * 1000) {
                    inFlight = ifVal;
                    console.log('[Multitrack] resuming in-flight render callId=' + ifVal.callId + ' (' + Math.round(ageMs / 1000) + 's old)');
                } else {
                    // Stale entry — clear it so we don't poll a dead callId
                    try { await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/_renderInFlight')).remove(); } catch (e) {}
                }
            }
        } catch (e) {
            console.warn('[Multitrack] in-flight check failed:', e && e.message);
        }
    }
    return _mtOpenReviewMode(session, tracks, sessionId, existingRender, inFlight);
};

// ── Isolate Mode (legacy 17-stream player) ──────────────────────────────────
// Opt-in from Review Mode via the 🎚 Isolate stems toggle. Honest banner
// warns the user that browser playback drifts on long sessions.
async function _mtOpenIsolateMode(session, tracks, sessionId) {
    // Read durationSec from session if known (used to gate the long-session
    // banner). Falls back to 0; banner only shows when we know the value
    // exceeds 30 min, so a missing value just hides the banner.
    var durHint = parseFloat(session.durationSec || session.duration || 0) || 0;
    var showLongBanner = durHint >= 30 * 60;

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
        return '<div class="mt-track-row" data-track-id="' + escHtml(t.trackId) + '" style="display:grid;grid-template-columns:130px 38px 38px 38px 1fr 45px;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78em">'
            + '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="font-weight:700;color:var(--text)">' + escHtml(t.label) + '</span>' + subTail + '</div>'
            + '<button onclick="_mtToggleMute(\'' + t.trackId + '\')" id="mtMute_' + escHtml(t.trackId) + '" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:3px 4px;cursor:pointer;font-size:0.78em">M</button>'
            + '<button onclick="_mtToggleSolo(\'' + t.trackId + '\')" id="mtSolo_' + escHtml(t.trackId) + '" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:3px 4px;cursor:pointer;font-size:0.78em">S</button>'
            + '<button onclick="_mtToggleTrackFx(\'' + t.trackId + '\')" id="mtFx_' + escHtml(t.trackId) + '" title="Send this track to reverb (master 💧 slider controls overall wet level)" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:3px 4px;cursor:pointer;font-size:0.78em">💧</button>'
            + '<input type="range" id="mtVol_' + escHtml(t.trackId) + '" min="0" max="200" value="100" step="1" oninput="_mtSetTrackVolume(\'' + t.trackId + '\', this.value)" title="Volume — 100% = unity gain, 200% = +6 dB boost" style="width:100%;accent-color:#a5b4fc;cursor:pointer">'
            + '<div id="mtVolLabel_' + escHtml(t.trackId) + '" style="font-family:ui-monospace,monospace;font-size:0.7em;color:var(--text-dim);text-align:right">100%</div>'
            // crossorigin=anonymous is REQUIRED for Web Audio API
            // (createMediaElementSource) to receive audio samples from
            // cross-origin URLs. Without it, MediaElementAudioSource
            // outputs silence per spec. R2's bucket CORS policy already
            // allows GET from any origin → CORS preflight succeeds → audio
            // flows. Symptom of forgetting this: playback "works" (the
            // audio element progresses) but no sound comes out.
            + '<audio preload="metadata" crossorigin="anonymous" src="' + escHtml(t.stemUrl) + '" data-track-id="' + escHtml(t.trackId) + '"></audio>'
            + '</div>';
    }).join('');

    ov.innerHTML =
        '<div style="max-width:880px;width:100%;background:#0f172a;border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,0.08);max-height:92vh;display:flex;flex-direction:column">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-shrink:0">' +
            '<span style="font-size:1.25em">🎚</span>' +
            '<div style="flex:1">' +
              '<div style="font-size:1em;font-weight:800;color:#f1f5f9">Multitrack rehearsal</div>' +
              '<div id="mtHeaderMeta" style="font-size:0.72em;color:var(--text-dim);margin-top:2px">' + escHtml(dateLabel) + (session.venue ? ' · ' + escHtml(session.venue) : '') + ' · ' + tracks.length + ' tracks</div>' +
            '</div>' +
            // ⭐ Keeper button — flags this rehearsal as "save the per-track
            // FLAC stems forever, never auto-tier." Initial state pulled
            // from session.keeper; toggled live by _mtToggleKeeper.
            '<button onclick="_mtToggleKeeper()" id="mtKeeperBtn" title="Mark this rehearsal as a Keeper — stems retained forever for future mastering" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:4px 8px;cursor:pointer;font-size:0.78em;margin-right:6px">' + (session.keeper ? '⭐ Keeper' : '☆ Keeper') + '</button>' +
            // 📦 Download stems — kicks off the existing /multitrack/zip
            // pipeline, polls, and surfaces the download link when ready.
            // UX convergence pass 2026-05-25: Stems moved into Tools dropdown
            // for Review Mode; preserved as a peer button in Isolate Mode
            // since power users land here specifically for stem-level work.
            '<button onclick="_mtDownloadStems()" id="mtDownloadBtn" title="Download original FLAC stems as a zip — for ProTools / other DAWs" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:4px 8px;cursor:pointer;font-size:0.78em;margin-right:4px">📦 Stems</button>' +
            // 👁 Review mode — switches the player to single-stream playback
            // against the server-rendered mix. Sample-accurate, fast seek.
            '<button onclick="_mtSwitchToReview()" title="Switch to Review Mode — single stereo mix, fast seek, no drift" style="background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.35);border-radius:5px;color:#a5b4fc;padding:4px 8px;cursor:pointer;font-size:0.78em;margin-right:4px">👁 Review</button>' +
            '<button onclick="_mtEditSessionHeader()" title="Edit date + venue" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:4px 8px;cursor:pointer;font-size:0.78em;margin-right:6px">✏️ Edit</button>' +
            '<button onclick="_mtClosePlayer()" style="background:none;border:none;color:#64748b;font-size:1.4em;cursor:pointer;padding:0 6px">×</button>' +
          '</div>' +
          // §8.1 Long-session banner — honest warning for sessions where the
          // browser-side sync is known to drift. Only shows when duration ≥
          // 30 min. Hidden once Drew opts out via setting localStorage flag.
          (showLongBanner ? ('<div id="mtLongSessionBanner" style="background:rgba(245,158,11,0.10);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:0.78em;color:#fbbf24;flex-shrink:0;display:flex;align-items:center;gap:8px">'
            + '<span style="font-size:1em">⚠️</span>'
            + '<span style="flex:1">Long-session multi-stream playback may drift on far seeks. '
            + '<button onclick="_mtSwitchToReview()" style="background:none;border:none;color:#fcd34d;text-decoration:underline;cursor:pointer;font:inherit;padding:0">Switch to Review Mode</button> for one stable rendered stream.</span>'
            + '<button onclick="_mtDismissLongBanner()" title="Don\'t show again this session" style="background:none;border:none;color:#fbbf24;cursor:pointer;padding:0 4px;font-size:1.1em">×</button>'
            + '</div>') : '') +
          // Transport bar — two rows. Row 1: action buttons + time.
          // Row 2: full-width seek bar (Drew 2026-05-24: "need slider full
          // length of screen, below everything").
          '<div style="padding:10px 8px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:10px;flex-shrink:0">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              // Skip-30s back. Press-and-hold for continuous rewind (accelerates).
              '<button onmousedown="_mtHoldStart(-30)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(-30)" ontouchend="_mtHoldStop()" title="Back 30s (hold for continuous rewind)" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">⏪ 30</button>' +
              // Skip-5s back
              '<button onmousedown="_mtHoldStart(-5)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(-5)" ontouchend="_mtHoldStop()" title="Back 5s (hold for continuous rewind)" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">⏪ 5</button>' +
              '<button onclick="_mtTogglePlayAll()" id="mtPlayAll" style="padding:8px 14px;border-radius:7px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:800;cursor:pointer;font-size:0.92em;min-width:78px">▶ Play</button>' +
              // Skip+5s forward
              '<button onmousedown="_mtHoldStart(5)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(5)" ontouchend="_mtHoldStop()" title="Forward 5s (hold for continuous fast-forward)" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">5 ⏩</button>' +
              // Skip+30s forward
              '<button onmousedown="_mtHoldStart(30)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(30)" ontouchend="_mtHoldStop()" title="Forward 30s (hold for continuous fast-forward)" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">30 ⏩</button>' +
              // Reverb — master wet/dry knob
              '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0" title="Reverb wet/dry — playback only, never baked to stems">' +
                '<span style="font-size:0.74em;color:var(--text-dim);font-weight:700">💧</span>' +
                '<input type="range" id="mtReverbSlider" min="0" max="100" value="0" step="1" oninput="_mtSetReverbWet(this.value)" style="width:90px;accent-color:#06b6d4;cursor:pointer">' +
                '<div id="mtReverbLabel" style="font-family:ui-monospace,monospace;font-size:0.7em;color:var(--text-dim);min-width:32px;text-align:right">0%</div>' +
              '</div>' +
              // Clear all — resets every track's mute / solo / volume / FX
              // + master reverb wet. One-click way back to a clean baseline.
              '<button onclick="_mtClearAllMix()" title="Reset all tracks: clear mutes/solos, volumes to 100%, all FX sends off, master reverb to 0" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.74em;flex-shrink:0">🧹 Clear all</button>' +
              // Manual re-sync — tracks drift naturally over long playback.
              '<button onclick="_mtResyncAll()" title="Re-sync all tracks to the master playhead" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.74em;flex-shrink:0">🔄 Re-sync</button>' +
              '<button onclick="_mtAnalyzeRehearsal()" title="Run the segmentation engine to detect song boundaries" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.12);color:#a5b4fc;cursor:pointer;font-size:0.74em;flex-shrink:0;font-weight:700">🎯 Analyze</button>' +
              '<button onclick="_mtExportDigest()" title="Copy a markdown digest of all comments to your clipboard" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.74em;flex-shrink:0">📋 Digest</button>' +
              // Phase 4B sticky review context — populated by
              // _mtUpdateActiveSegmentHighlight whenever the playhead
              // crosses into a new segment. Reads
              // "Reviewing: Franklin's Tower • 8:39–9:24 • 54%" so the
              // user always knows what song they're on without
              // scanning the segments panel.
              '<div id="mtNowReviewing" style="font-size:0.74em;color:var(--text-dim);min-width:0;flex:1;text-align:right;margin-left:auto;padding-right:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>' +
              '<div id="mtTimeLabel" style="font-family:ui-monospace,monospace;font-size:0.82em;color:var(--text);min-width:90px;text-align:right">0:00 / 0:00</div>' +
            '</div>' +
            // Row 2: full-width seek bar with comment + segment markers
            '<div style="position:relative;margin-top:10px;padding-top:4px">' +
              '<div id="mtSeekMarkers" style="position:absolute;left:0;right:0;top:0;height:8px;pointer-events:none"></div>' +
              '<input type="range" id="mtMasterSeek" min="0" max="100" value="0" step="0.1" oninput="_mtSeekPreview(this.value)" onchange="_mtSeekMaster(this.value)" style="width:100%;accent-color:#a5b4fc">' +
            '</div>' +
          '</div>' +
          // Phase C mix presets — saved snapshots of full mix state. Lives
          // ABOVE the tracks so it's visible without scrolling.
          '<div id="mtMixPresetBar" style="padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:8px;margin-bottom:8px;flex-shrink:0"></div>' +
          // Tracks list — capped height so comment panel always has room
          '<div style="overflow-y:auto;max-height:35vh;border:1px solid rgba(255,255,255,0.04);border-radius:8px;flex-shrink:0">' + trackRowsHtml + '</div>' +
          '<div style="margin-top:6px;font-size:0.66em;color:var(--text-dim);text-align:center;flex-shrink:0">M = mute · S = solo · slider = volume · 💧 = reverb · seek bar scrubs all tracks</div>' +
          // Phase B: comment list (fills remaining vertical space) + composer (sticky bottom)
          // Segments panel — server-precomputed waveforms + analyzer
          // results. Rehearsal navigation intelligence, not a DAW.
          '<div id="mtSegmentsPanel" style="margin-top:8px;flex-shrink:0"></div>' +
          '<div id="mtCommentPanel" style="margin-top:10px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow-y:auto;flex:1;min-height:120px"></div>' +
          '<div id="mtComposerArea"></div>' +
        '</div>';
    document.body.appendChild(ov);
    // Intentionally NOT wiring backdrop-click-to-close. The player runs
    // multi-minute server-side workflows (auto-render on session open,
    // 📤 Export Mix, 📦 Stems zip) — an accidental click on the dim
    // backdrop should never silently nuke a 5-minute render in progress.
    // Use the explicit × button or the 🎚/👁 mode toggles to leave.
    // (Drew, 2026-05-24: lost a 150s render to an accidental backdrop tap.)
    // Phase 2D: attach keyboard shortcuts for segment review.
    if (typeof _mtSegmentsKeydown === 'function') {
        try { document.removeEventListener('keydown', _mtSegmentsKeydown); } catch (e) {}
        document.addEventListener('keydown', _mtSegmentsKeydown);
    }

    // Wire up player state
    var audios = Array.from(ov.querySelectorAll('audio[data-track-id]'));
    _mtState.player = {
        mode: 'isolate',             // 'isolate' = 17-stream; 'review' = 1-stream
        sessionId: sessionId,
        session: session,            // retained for cross-mode rendering
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

    // Phase C: load persisted mix state + presets so the player opens
    // exactly as the user last left it. Web Audio graph is created lazily
    // on first play (autoplay policy), so volumes set here just go into
    // mixState — they get applied to the GainNodes after init.
    _mtLoadMixState(sessionId).then(function(saved) {
        if (_mtState.player && _mtState.player.sessionId === sessionId && saved) {
            _mtState.player.mixState = {
                volumes: saved.volumes || {},
                reverbWet: saved.reverbWet || 0,
                reverbSends: saved.reverbSends || {}
            };
            // Restore mute/solo state too — these affect audio.muted directly
            // even before Web Audio init.
            _mtState.player.muted = saved.mute || {};
            _mtState.player.soloed = saved.solo || {};
            _mtApplyMuteSolo();
            // Reflect in the UI controls
            Object.keys(saved.volumes || {}).forEach(function(id) {
                var slider = document.getElementById('mtVol_' + id);
                var label = document.getElementById('mtVolLabel_' + id);
                if (slider) slider.value = saved.volumes[id] * 100;
                if (label) label.textContent = Math.round(saved.volumes[id] * 100) + '%';
            });
            var revSlider = document.getElementById('mtReverbSlider');
            var revLabel = document.getElementById('mtReverbLabel');
            if (revSlider) revSlider.value = (saved.reverbWet || 0) * 100;
            if (revLabel) revLabel.textContent = Math.round((saved.reverbWet || 0) * 100) + '%';
            Object.keys(_mtState.player.muted).forEach(function(id) {
                if (!_mtState.player.muted[id]) return;
                var btn = document.getElementById('mtMute_' + id);
                if (btn) {
                    btn.style.background = 'rgba(239,68,68,0.18)';
                    btn.style.color = '#fca5a5';
                }
            });
            Object.keys(_mtState.player.soloed).forEach(function(id) {
                if (!_mtState.player.soloed[id]) return;
                var btn = document.getElementById('mtSolo_' + id);
                if (btn) {
                    btn.style.background = 'rgba(245,158,11,0.18)';
                    btn.style.color = '#fbbf24';
                }
            });
            // Reflect per-track reverb sends in the FX button styling.
            // Default is ON (send=1) for tracks never touched; OFF only if
            // explicitly set to 0 in saved state.
            (_mtState.player.tracks || []).forEach(function(t) {
                var sendVal = (saved.reverbSends && saved.reverbSends[t.trackId] !== undefined)
                    ? saved.reverbSends[t.trackId] : 1;
                var on = sendVal !== 0;
                var btn = document.getElementById('mtFx_' + t.trackId);
                if (btn) {
                    btn.style.background = on ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.04)';
                    btn.style.color = on ? '#67e8f9' : 'var(--text-dim)';
                }
            });
        }
    });
    _mtLoadMixPresets(sessionId).then(function(presets) {
        if (_mtState.player && _mtState.player.sessionId === sessionId) {
            _mtState.player.mixPresets = presets || [];
            _mtRenderMixPresetBar();
        }
    });
    // FX buttons default to ON visual (cyan tint) since the underlying
    // reverbSend GainNode defaults to 1.0. If saved state later toggles
    // any off, the load callback above repaints those individually.
    setTimeout(function() {
        if (!_mtState.player || _mtState.player.sessionId !== sessionId) return;
        (_mtState.player.tracks || []).forEach(function(t) {
            var btn = document.getElementById('mtFx_' + t.trackId);
            if (btn) {
                btn.style.background = 'rgba(6,182,212,0.18)';
                btn.style.color = '#67e8f9';
            }
        });
    }, 0);
    // Load any prior analysis segments so the seek bar markers show on open.
    _mtLoadSegments(sessionId).then(function() {
        if (_mtState.player && _mtState.player.sessionId === sessionId) {
            _mtRenderSegmentMarkers();
            _mtRenderSegmentsPanel();
        }
    });

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
}

// ── 🛠 Tools dropdown (UX convergence pass 2026-05-25) ─────────────────────
// Consolidates secondary actions (Mix / Text / Export / Isolate / Stems /
// Edit) into a single dropdown so the header isn't a 7-action equal-weight
// bar. Per founder UX review §1: "all actions appear equally important — this
// destroys operational clarity." Primary actions (Play / Analyze) stay in
// the transport row. Keeper is a flag, stays as a sibling button.
//
// Mode 'review'  → Mix / Text / Export / Isolate / Stems / Edit
// Mode 'isolate' → kept inline for power users (intentionally not collapsed)
function _mtRenderToolsMenuButton(mode) {
    return '<button id="mtToolsBtn" onclick="_mtToggleToolsMenu(\'' + mode + '\')" title="Mix · Text · Export · Isolate · Stems · Edit" '
        + 'style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:4px 10px;cursor:pointer;font-size:0.78em;margin-right:6px">'
        + '🛠 Tools ▾</button>';
}

window._mtToggleToolsMenu = function(mode) {
    var existing = document.getElementById('mtToolsMenu');
    if (existing) { existing.remove(); document.removeEventListener('click', _mtToolsMenuOutsideClick, true); return; }
    var btn = document.getElementById('mtToolsBtn');
    if (!btn) return;
    var rect = btn.getBoundingClientRect();
    // Tools items — review mode has 6, isolate has fewer (Stems + Edit only).
    // Each item is {icon+label, handler, accent?}. accent for the high-value
    // workflow path (Mix → Render) gets indigo styling.
    var items;
    if (mode === 'isolate') {
        items = [
            { label: '✏️ Edit date + venue', call: '_mtEditSessionHeader()' },
        ];
    } else {
        items = [
            { label: '🎛 Mix — dial in levels + render', call: '_mtOpenCustomMixModal()', accent: 'indigo' },
            { label: '📤 Export Mix — download as MP3 / WAV / FLAC', call: '_mtExportRehearsalMix()' },
            { label: '📨 Text band — share current mix via SMS', call: '_mtShareCurrentMix()', accent: 'green' },
            { label: '🎚 Isolate stems — per-track mute/solo', call: '_mtSwitchToIsolate()' },
            { label: '📦 Download stems — original FLAC ZIP', call: '_mtDownloadStems()' },
            { label: '✏️ Edit date + venue', call: '_mtEditSessionHeader()' },
        ];
    }
    var itemsHtml = items.map(function(it) {
        var color = it.accent === 'indigo' ? '#a5b4fc' : (it.accent === 'green' ? '#86efac' : '#cbd5e1');
        return '<button onclick="(function(){var m=document.getElementById(\'mtToolsMenu\');if(m)m.remove();document.removeEventListener(\'click\',_mtToolsMenuOutsideClick,true);' + it.call + '})()" '
            + 'style="display:block;width:100%;text-align:left;background:none;border:none;color:' + color + ';padding:9px 14px;cursor:pointer;font-size:0.85em;border-bottom:1px solid rgba(255,255,255,0.04);font-family:inherit">'
            + it.label + '</button>';
    }).join('');
    var menu = document.createElement('div');
    menu.id = 'mtToolsMenu';
    menu.setAttribute('role', 'menu');
    menu.style.cssText = 'position:fixed;top:' + Math.round(rect.bottom + 6) + 'px;left:' + Math.round(rect.left) + 'px;'
        + 'min-width:280px;max-width:340px;background:#0f172a;border:1px solid rgba(99,102,241,0.35);border-radius:8px;'
        + 'box-shadow:0 12px 36px rgba(0,0,0,0.55);z-index:6000;overflow:hidden';
    menu.innerHTML = itemsHtml;
    document.body.appendChild(menu);
    // Outside-click dismiss — delayed so the triggering click doesn't kill it
    setTimeout(function() { document.addEventListener('click', _mtToolsMenuOutsideClick, true); }, 0);
};

function _mtToolsMenuOutsideClick(e) {
    var menu = document.getElementById('mtToolsMenu');
    var btn = document.getElementById('mtToolsBtn');
    if (!menu) { document.removeEventListener('click', _mtToolsMenuOutsideClick, true); return; }
    if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
    menu.remove();
    document.removeEventListener('click', _mtToolsMenuOutsideClick, true);
}

// ── Review Mode — single rendered stereo stream ─────────────────────────────
// The default playback path per the multitrack browser playback audit.
// One <audio> element points at the server-rendered mix (R2 URL). Sample-
// accurate, fast seek, no drift. If no render exists yet, this UI shows
// "Preparing review mix…" and triggers /multitrack/render/start in the
// background; on success it swaps the <audio> src.
async function _mtOpenReviewMode(session, tracks, sessionId, renderInfo, inFlight) {
    var existing = document.getElementById('mtPlayerOverlay');
    if (existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'mtPlayerOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px)';

    var dateLabel = session.date ? new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    var renderUrl = renderInfo && renderInfo.url ? renderInfo.url : '';
    var renderLabel = renderUrl
        ? ('Playing ' + escHtml(renderInfo.fileName || 'rendered mix') + ' · ' + (renderInfo.format || 'mix').toUpperCase())
        : '⏳ Preparing review mix… (~30-60s on first open)';

    ov.innerHTML =
        '<div style="max-width:880px;width:100%;background:#0f172a;border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,0.08);max-height:92vh;display:flex;flex-direction:column">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-shrink:0">' +
            '<span style="font-size:1.25em">👁</span>' +
            '<div style="flex:1">' +
              '<div style="font-size:1em;font-weight:800;color:#f1f5f9">Review Mode <span style="font-size:0.7em;font-weight:600;color:#a5b4fc;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:4px;padding:2px 6px;margin-left:6px">single stream</span></div>' +
              '<div id="mtHeaderMeta" style="font-size:0.72em;color:var(--text-dim);margin-top:2px">' + escHtml(dateLabel) + (session.venue ? ' · ' + escHtml(session.venue) : '') + ' · ' + tracks.length + ' tracks</div>' +
            '</div>' +
            // UX convergence pass 2026-05-25 (per founder UX review §1):
            // collapsed 7-action equal-weight bar into 3 surfaces:
            //   1. ☆ Keeper (flag, stays primary)
            //   2. 🛠 Tools dropdown (was: Mix / Text / Export / Isolate / Stems / Edit)
            //   3. × Close
            // Primary actions (Play / Analyze) live in the transport row below
            // and stay visually dominant.
            '<button onclick="_mtToggleKeeper()" id="mtKeeperBtn" title="Mark this rehearsal as a Keeper" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);padding:4px 8px;cursor:pointer;font-size:0.78em;margin-right:6px">' + (session.keeper ? '⭐ Keeper' : '☆ Keeper') + '</button>' +
            _mtRenderToolsMenuButton('review') +
            '<button onclick="_mtClosePlayer()" style="background:none;border:none;color:#64748b;font-size:1.4em;cursor:pointer;padding:0 6px">×</button>' +
          '</div>' +
          // Render-status banner — shows progress while a render is in flight,
          // or the active render's name once playing.
          '<div id="mtReviewStatusBanner" style="background:rgba(99,102,241,0.10);border:1px solid rgba(99,102,241,0.25);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:0.78em;color:#cbd5e1;flex-shrink:0">' +
            renderLabel +
          '</div>' +
          // Transport bar — same 2-row layout as Isolate Mode, but no
          // mute/solo/volume/reverb (those are mix-time decisions baked
          // into the render). Single <audio> element drives everything.
          '<div style="padding:10px 8px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:10px;flex-shrink:0">' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              '<button onmousedown="_mtHoldStart(-30)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(-30)" ontouchend="_mtHoldStop()" title="Back 30s" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">⏪ 30</button>' +
              '<button onmousedown="_mtHoldStart(-5)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(-5)" ontouchend="_mtHoldStop()" title="Back 5s" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">⏪ 5</button>' +
              '<button onclick="_mtTogglePlayAll()" id="mtPlayAll" style="padding:8px 14px;border-radius:7px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:800;cursor:pointer;font-size:0.92em;min-width:78px">▶ Play</button>' +
              '<button onmousedown="_mtHoldStart(5)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(5)" ontouchend="_mtHoldStop()" title="Forward 5s" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">5 ⏩</button>' +
              '<button onmousedown="_mtHoldStart(30)" onmouseup="_mtHoldStop()" onmouseleave="_mtHoldStop()" ontouchstart="_mtHoldStart(30)" ontouchend="_mtHoldStop()" title="Forward 30s" style="padding:6px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);font-weight:700;cursor:pointer;font-size:0.7em">30 ⏩</button>' +
              '<button onclick="_mtAnalyzeRehearsal()" title="Run the segmentation engine" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.12);color:#a5b4fc;cursor:pointer;font-size:0.74em;flex-shrink:0;font-weight:700">🎯 Analyze</button>' +
              '<button onclick="_mtExportDigest()" title="Copy a markdown digest of all comments" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-dim);cursor:pointer;font-size:0.74em;flex-shrink:0">📋 Digest</button>' +
              // Phase 4B sticky review context — populated by
              // _mtUpdateActiveSegmentHighlight whenever the playhead
              // crosses into a new segment. Reads
              // "Reviewing: Franklin's Tower • 8:39–9:24 • 54%" so the
              // user always knows what song they're on without
              // scanning the segments panel.
              '<div id="mtNowReviewing" style="font-size:0.74em;color:var(--text-dim);min-width:0;flex:1;text-align:right;margin-left:auto;padding-right:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>' +
              '<div id="mtTimeLabel" style="font-family:ui-monospace,monospace;font-size:0.82em;color:var(--text);min-width:90px;text-align:right">0:00 / 0:00</div>' +
            '</div>' +
            '<div style="position:relative;margin-top:10px;padding-top:4px">' +
              '<div id="mtSeekMarkers" style="position:absolute;left:0;right:0;top:0;height:8px;pointer-events:none"></div>' +
              '<input type="range" id="mtMasterSeek" min="0" max="100" value="0" step="0.1" oninput="_mtSeekPreview(this.value)" onchange="_mtSeekMaster(this.value)" style="width:100%;accent-color:#a5b4fc">' +
            '</div>' +
          '</div>' +
          // Single rendered audio — only created when we have a URL. While
          // waiting for the render, this slot is empty and play() is a no-op.
          '<audio id="mtReviewAudio" preload="metadata" crossorigin="anonymous"' + (renderUrl ? (' src="' + escHtml(renderUrl) + '"') : '') + '></audio>' +
          // Comments panel + composer — same as Isolate Mode.
          // Segments panel — server-precomputed waveforms + analyzer
          // results. Rehearsal navigation intelligence, not a DAW.
          '<div id="mtSegmentsPanel" style="margin-top:8px;flex-shrink:0"></div>' +
          '<div id="mtCommentPanel" style="margin-top:10px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow-y:auto;flex:1;min-height:160px"></div>' +
          '<div id="mtComposerArea"></div>' +
        '</div>';
    document.body.appendChild(ov);
    // Intentionally NOT wiring backdrop-click-to-close. The player runs
    // multi-minute server-side workflows (auto-render on session open,
    // 📤 Export Mix, 📦 Stems zip) — an accidental click on the dim
    // backdrop should never silently nuke a 5-minute render in progress.
    // Use the explicit × button or the 🎚/👁 mode toggles to leave.
    // (Drew, 2026-05-24: lost a 150s render to an accidental backdrop tap.)
    // Phase 2D: attach keyboard shortcuts for segment review.
    if (typeof _mtSegmentsKeydown === 'function') {
        try { document.removeEventListener('keydown', _mtSegmentsKeydown); } catch (e) {}
        document.addEventListener('keydown', _mtSegmentsKeydown);
    }

    var reviewAudio = document.getElementById('mtReviewAudio');
    _mtState.player = {
        mode: 'review',
        sessionId: sessionId,
        session: session,
        tracks: tracks,
        audios: reviewAudio ? [reviewAudio] : [],
        masterPlaying: false,
        soloed: {},
        muted: {},
        comments: [],
        anchorTrackId: '',
        commentFilterToSoloed: false,
        commentFilterMember: '',
        renderInfo: renderInfo || null,
    };

    // Wire the single audio element's events the same way Isolate Mode does
    // (loadedmetadata → duration; timeupdate → position label; ended → flip
    // the play button).
    if (reviewAudio) {
        reviewAudio.addEventListener('loadedmetadata', function() {
            _mtMaybeUpdateDuration();
            _mtRenderSeekMarkers();
        });
        reviewAudio.addEventListener('timeupdate', _mtMaybeUpdateMasterPosition);
        reviewAudio.addEventListener('ended', function() {
            if (_mtState.player) _mtState.player.masterPlaying = false;
            var btn = document.getElementById('mtPlayAll');
            if (btn) btn.textContent = '▶ Play';
        });
    }

    // Load comments + segments (same logic as Isolate Mode).
    _mtLoadSegments(sessionId).then(function() {
        if (_mtState.player && _mtState.player.sessionId === sessionId) {
            _mtRenderSegmentMarkers();
            _mtRenderSegmentsPanel();
        }
    });
    _mtLoadComments(sessionId).then(function(comments) {
        if (_mtState.player && _mtState.player.sessionId === sessionId) {
            _mtState.player.comments = comments;
            _mtRefreshCommentPanel();
            if (_mtState.player._timeTicker) clearInterval(_mtState.player._timeTicker);
            _mtState.player._timeTicker = setInterval(function() {
                var t = _mtCurrentPlayhead();
                var el = document.getElementById('mtComposerTime');
                if (el) el.textContent = _mtFmtTime(t);
                _mtHighlightActiveComment();
            }, 500);
        }
    });

    // If no completed render: either RESUME polling an in-flight one (from
    // Firebase _renderInFlight, set by an earlier session-open in this tab
    // or another) OR kick off a fresh render. Never start a new render
    // while another one is already running for the same session.
    if (!renderUrl) {
        _mtKickAutoRender(session, sessionId, inFlight || null);
    }
}

// Internal helper — fires off a fresh render OR resumes polling an
// in-flight one. Used by Review Mode when no completed render exists.
//
// resumeFrom (optional): { callId, startedAt, renderId } from Firebase.
// When present, skip /start and poll the existing callId instead.
async function _mtKickAutoRender(session, sessionId, resumeFrom) {
    var p = _mtState.player;
    if (!p || p.sessionId !== sessionId) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var banner = document.getElementById('mtReviewStatusBanner');
    function setBanner(text) {
        if (banner) banner.innerHTML = text;
    }
    function inFlightRef() {
        if (!db || typeof bandPath !== 'function') return null;
        return db.ref(bandPath('rehearsal_sessions/' + sessionId + '/_renderInFlight'));
    }
    async function clearInFlight() {
        var ref = inFlightRef();
        if (ref) { try { await ref.remove(); } catch (e) {} }
    }

    // Poll budget: 180 attempts × 5s = 15 min. Empirical 2026-05-24
    // baseline was 8m 20s for a 3-hour 17-stem session pre-parallel-
    // download optimization. 15 min gives 80% headroom for the slowest
    // realistic case (longest session × cold Modal start).
    var POLL_MAX = 180;
    var POLL_INTERVAL_MS = 5000;

    var callId, renderId, startedAt;
    try {
        if (resumeFrom && resumeFrom.callId) {
            callId = resumeFrom.callId;
            renderId = resumeFrom.renderId || ('resume-' + Date.now());
            startedAt = resumeFrom.startedAt || new Date().toISOString();
            var ageSec = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
            setBanner('⏳ Resuming in-flight render… (' + ageSec + 's elapsed before this tab opened)');
        } else {
            setBanner('⏳ Preparing review mix on the server… (~2-4 min for a 3-hour rehearsal)');
            // Stable renderId 'mix_default' — overwrites previous full-timeline
            // auto-renders rather than stacking 'auto-<ts>' copies. Songs-only
            // and custom mixes use distinct conventions (mix_songs_only,
            // custom-<ts>) so they coexist with mix_default in R2.
            renderId = 'mix_default';
            startedAt = new Date().toISOString();
            var startRes = await fetch(workerBase + '/multitrack/render/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bandSlug: slug,
                    sessionId: sessionId,
                    renderId: renderId,
                    recipe: {
                        tracks: {},                  // empty = every stem unity gain
                        masterReverbWet: 0,          // no reverb on auto-render
                        outputFormat: 'mp3',         // small + universally supported
                        outputName: 'rehearsal-mix-' + (session.date || sessionId) + '.mp3'
                    }
                })
            });
            var startJson = await startRes.json();
            if (!startRes.ok || !startJson || !startJson.call_id) {
                throw new Error((startJson && startJson.error) || ('HTTP ' + startRes.status));
            }
            callId = startJson.call_id;
            // Persist so concurrent tabs / refreshes can RESUME instead of
            // firing a duplicate render. 15-min staleness check happens on
            // the read side in _mtOpenPlayer.
            var ref = inFlightRef();
            if (ref) {
                try {
                    await ref.set({
                        callId: callId,
                        renderId: renderId,
                        startedAt: startedAt,
                        startedBy: (typeof currentUserEmail !== 'undefined' ? currentUserEmail : null),
                    });
                } catch (e) {
                    console.warn('[Multitrack] _renderInFlight write failed (non-fatal):', e && e.message);
                }
            }
        }

        var baseElapsedSec = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
        for (var attempt = 0; attempt < POLL_MAX; attempt++) {
            if (!_mtState.player || _mtState.player.sessionId !== sessionId) return;
            await new Promise(function(r) { setTimeout(r, POLL_INTERVAL_MS); });
            var totalSec = baseElapsedSec + (attempt + 1) * 5;
            setBanner('⏳ Rendering on the server… (' + totalSec + 's elapsed)');
            var checkRes = await fetch(workerBase + '/multitrack/render/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ call_id: callId })
            });
            var checkJson = await checkRes.json();
            if (checkJson && checkJson.status === 'done' && checkJson.publicUrl) {
                if (!_mtState.player || _mtState.player.sessionId !== sessionId) return;
                var audio = document.getElementById('mtReviewAudio');
                if (audio) {
                    audio.src = checkJson.publicUrl;
                    audio.load();
                }
                _mtState.player.renderInfo = {
                    url: checkJson.publicUrl,
                    fileName: checkJson.fileName,
                    format: checkJson.format,
                    renderId: checkJson.renderId,
                };
                setBanner('✓ Rendered ' + escHtml(checkJson.fileName || 'mix') + ' — playing single stream · seek anywhere instantly');
                if (typeof showToast === 'function') showToast('✓ Review mix ready');
                await clearInFlight();
                return;
            }
            if (checkJson && (checkJson.success === false || checkJson.status === 'error')) {
                await clearInFlight();
                throw new Error((checkJson.error || checkJson.detail || 'render_error'));
            }
        }
        throw new Error('render timed out after 15 minutes');
    } catch (e) {
        console.warn('[Multitrack] auto-render failed:', e);
        // Don't clear _renderInFlight on timeout — the Modal job may still
        // succeed, in which case a future session-open will pick up the
        // completed render via /status. If it actually errored on Modal,
        // the next /check call would return success:false and the next
        // open-window will then clear-and-restart. Bias: tolerate dup-poll
        // over duplicate-render.
        setBanner('⚠️ Auto-render polling timed out: ' + escHtml(String(e && e.message || e)) + '. The render may still complete on the server — try refreshing in a minute. Or <button onclick="_mtSwitchToIsolate()" style="background:none;border:none;color:#a5b4fc;text-decoration:underline;cursor:pointer;font:inherit;padding:0">open Isolate Mode</button>.');
    }
}

// ── Mode switches ───────────────────────────────────────────────────────────
window._mtSwitchToReview = function() {
    var p = _mtState.player;
    if (!p) return;
    if (p.mode === 'review') return;
    var sid = p.sessionId;
    // Forward any render info we already know about, so the router can
    // skip the /status network call when toggling. The router still does
    // a /status check as a safety net when this is absent. Both belt and
    // suspenders against the 2026-05-24 "Isolate→Review re-renders" bug.
    var known = p.renderInfo || null;
    _mtClosePlayer();
    window._mtOpenPlayer(sid, { mode: 'review', render: known });
};
window._mtSwitchToIsolate = function() {
    var p = _mtState.player;
    if (!p) return;
    if (p.mode === 'isolate') return;
    var sid = p.sessionId;
    _mtClosePlayer();
    window._mtOpenPlayer(sid, { mode: 'isolate' });
};
window._mtDismissLongBanner = function() {
    var b = document.getElementById('mtLongSessionBanner');
    if (b) b.style.display = 'none';
};

// ── 📤 Export Rehearsal Mix ─────────────────────────────────────────────────
// Builds a mix recipe from the current Isolate-mode state (volumes, mutes,
// solos, reverb sends, master reverb) — or defaults if user is in Review
// Mode — and kicks off a fresh server-side render. Surface the download
// link when complete.
window._mtExportRehearsalMix = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    // Format picker — simple confirm prompt with 3 options. Defaults to MP3.
    var fmt = (prompt('Export format? (wav / mp3 / flac)', 'mp3') || 'mp3').toLowerCase().trim();
    if (fmt !== 'wav' && fmt !== 'mp3' && fmt !== 'flac') {
        if (typeof showToast === 'function') showToast('Cancelled — pick wav, mp3, or flac');
        return;
    }
    var btn = document.getElementById('mtExportBtn');
    var orig = btn ? btn.textContent : '';
    function setLabel(text, disable) {
        if (!btn) return;
        btn.textContent = text;
        btn.disabled = !!disable;
        btn.style.opacity = disable ? '0.6' : '1';
    }
    var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';

    // Build the recipe from current mix state.
    // In Isolate Mode we have full per-track state; in Review Mode we have
    // none, so the recipe ends up empty (= server applies unity defaults).
    var anySolo = Object.keys(p.soloed || {}).some(function(k) { return p.soloed[k]; });
    var tracksRecipe = {};
    (p.tracks || []).forEach(function(t) {
        var tid = t.trackId;
        var vol = (p.mixState && p.mixState.volumes && p.mixState.volumes[tid] != null) ? p.mixState.volumes[tid] : 1.0;
        var send = (p.mixState && p.mixState.reverbSends && p.mixState.reverbSends[tid] !== undefined) ? p.mixState.reverbSends[tid] : 1;
        tracksRecipe[tid] = {
            gain: vol,
            mute: !!(p.muted && p.muted[tid]),
            solo: !!(p.soloed && p.soloed[tid]),
            reverbSend: send,
        };
    });
    var masterWet = (p.mixState && typeof p.mixState.reverbWet === 'number') ? p.mixState.reverbWet : 0;
    var renderId = 'export-' + Date.now();
    var recipe = {
        tracks: tracksRecipe,
        masterReverbWet: masterWet,
        outputFormat: fmt,
        outputName: 'rehearsal-mix-' + (p.session && p.session.date || p.sessionId) + '.' + fmt,
    };
    void anySolo; // documented; recipe carries explicit solo flags so server can mirror

    setLabel('⏳ Starting export…', true);
    try {
        var startRes = await fetch(workerBase + '/multitrack/render/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bandSlug: slug,
                sessionId: p.sessionId,
                renderId: renderId,
                recipe: recipe,
            })
        });
        var startJson = await startRes.json();
        if (!startRes.ok || !startJson || !startJson.call_id) {
            throw new Error((startJson && startJson.error) || ('HTTP ' + startRes.status));
        }
        var callId = startJson.call_id;
        // Poll budget extended to 15 min (180 × 5s). Empirical 2026-05-24:
        // a 3-hour 17-stem rehearsal takes ~8 min end-to-end with sequential
        // R2 downloads; ~2-3 min with parallel ones. 15 min gives headroom
        // for the slowest case.
        for (var attempt = 0; attempt < 180; attempt++) {
            await new Promise(function(r) { setTimeout(r, 5000); });
            setLabel('⏳ Rendering (' + ((attempt + 1) * 5) + 's)…', true);
            var checkRes = await fetch(workerBase + '/multitrack/render/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ call_id: callId })
            });
            var checkJson = await checkRes.json();
            if (checkJson && checkJson.status === 'done' && checkJson.publicUrl) {
                setLabel('📥 Downloading…', true);
                window.location.href = checkJson.publicUrl;
                setTimeout(function() { setLabel(orig || '📤 Export Mix', false); }, 2000);
                if (typeof showToast === 'function') showToast('✓ Mix ready — download starting');
                return;
            }
            if (checkJson && (checkJson.success === false || checkJson.status === 'error')) {
                throw new Error((checkJson.error || checkJson.detail || 'render_error'));
            }
        }
        throw new Error('render timed out after 15 minutes');
    } catch (e) {
        console.warn('[Multitrack] export render failed:', e);
        setLabel('✗ ' + (e.message || 'failed'), false);
        if (typeof showToast === 'function') showToast('Export failed: ' + (e.message || ''));
        setTimeout(function() { setLabel(orig || '📤 Export Mix', false); }, 4000);
    }
};

// ── Custom Mix modal ─────────────────────────────────────────────────────────
// Lets the user dial vocals/guitars/bass/drums/keys + master reverb in a
// compact recipe builder, render server-side, and have the result become
// the new Review Mode playback. The full 17-stem-slider UI lives in
// Isolate Mode for power-user fine control; this is the "quick mix" path.

function _mtRoleToGroup(role) {
    role = (role || '').toLowerCase();
    if (role.startsWith('vocal')) return 'vocals';
    if (role.startsWith('guitar')) return 'guitars';
    if (role === 'bass') return 'bass';
    if (role.indexOf('key') === 0) return 'keys'; // keys, keys-l, keys-r
    return 'drums'; // kick/snare/tom*/oh*/bongos/hat/ride/open
}

// Returns array of segments suitable for recipe.segments, filtered to
// exclude between-song chatter (multitrackSegments overlay `isBetween`).
// Empty array means "no song segments available" — caller should treat
// as "songs-only mode unavailable, render full timeline."
function _mtCollectSongSegments(player) {
    if (!player || !Array.isArray(player.segments) || !player.segments.length) return [];
    var out = [];
    player.segments.forEach(function(s) {
        if (_mtSegmentReviewState(s) === 'excluded') return;  // explicit user exclusion
        if (s.isBetween) return;                              // legacy overlay flag
        var effKind = _mtSegmentEffectiveKind(s);
        if (effKind === 'silence') return;                    // silence dropped
        if (effKind === 'speech') return;                     // chatter dropped
        // music + transition both included — transitions are song-adjacent
        // (intros, jams, segues) and belong in a songs-only mix.
        var start = (typeof s.startSec === 'number') ? s.startSec : (typeof s.start === 'number' ? s.start : null);
        var end = (typeof s.endSec === 'number') ? s.endSec : (typeof s.end === 'number' ? s.end : null);
        if (start == null || end == null) return;
        if (!(end > start)) return;
        var display = _mtSegmentDisplayName(s);
        var title = (display.kind === 'confirmed' || display.kind === 'matched')
            ? (s.songTitle || (s.likelySong && s.likelySong.title) || null)
            : null;
        out.push({
            start: start,
            end: end,
            title: title,
            id: s.id || null,
        });
    });
    // Ensure ascending + non-overlapping
    out.sort(function(a, b) { return a.start - b.start; });
    return out;
}

window._mtOpenCustomMixModal = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    // Ensure segments are loaded (the player loads them async on open;
    // if the user clicks 🎛 Mix before that finishes, await it now).
    if (!Array.isArray(p.segments)) {
        try { await _mtLoadSegments(p.sessionId); } catch (e) {}
    }
    var existing = document.getElementById('mtCustomMixModal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'mtCustomMixModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:6500;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';

    function sliderRow(emoji, label, key, defaultPct) {
        return '<div style="display:grid;grid-template-columns:120px 1fr 48px;gap:10px;align-items:center;margin-bottom:8px">' +
            '<div style="font-size:0.88em;color:var(--text)"><span style="margin-right:6px">' + emoji + '</span>' + escHtml(label) + '</div>' +
            '<input type="range" id="mtCmx_' + key + '" min="0" max="200" value="' + defaultPct + '" step="1" oninput="document.getElementById(\'mtCmxLabel_' + key + '\').textContent=this.value+\'%\'" style="width:100%;accent-color:#a5b4fc;cursor:pointer">' +
            '<div id="mtCmxLabel_' + key + '" style="font-family:ui-monospace,monospace;font-size:0.78em;color:var(--text-dim);text-align:right">' + defaultPct + '%</div>' +
            '</div>';
    }
    function reverbRow(defaultPct) {
        return '<div style="display:grid;grid-template-columns:120px 1fr 48px;gap:10px;align-items:center;margin-bottom:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">' +
            '<div style="font-size:0.88em;color:var(--text)"><span style="margin-right:6px">💧</span>Master reverb amount</div>' +
            '<input type="range" id="mtCmxReverb" min="0" max="100" value="' + defaultPct + '" step="1" oninput="document.getElementById(\'mtCmxReverbLabel\').textContent=this.value+\'%\';_mtCmxUpdateSendsDimmer()" style="width:100%;accent-color:#06b6d4;cursor:pointer">' +
            '<div id="mtCmxReverbLabel" style="font-family:ui-monospace,monospace;font-size:0.78em;color:var(--text-dim);text-align:right">' + defaultPct + '%</div>' +
            '</div>';
    }
    function sendsRow(restored) {
        // Per-group reverb-send checkboxes. Defaults: vocals only ON.
        // Routing is binary per group (on/off). The "amount" comes from
        // the master reverb slider above. Greyed visually when master
        // reverb is at 0% (sends have no audible effect without a master
        // wet level), but checkboxes stay interactive so user can
        // pre-arrange routing before raising the slider.
        function chk(key, label, checked) {
            return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:0.78em;color:var(--text-dim);user-select:none">'
                + '<input type="checkbox" id="mtCmxSend_' + key + '"' + (checked ? ' checked' : '') + ' style="cursor:pointer">'
                + label
                + '</label>';
        }
        function dflt(key, fallback) {
            if (restored && restored[key] != null) return !!restored[key];
            return fallback;
        }
        return '<div id="mtCmxSendsRow" style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center;margin-bottom:8px;opacity:0.55;transition:opacity 120ms">'
            + '<div style="font-size:0.78em;color:var(--text-dim)" title="Per-group routing is on/off; the slider above sets how much reverb">Send to reverb</div>'
            + '<div style="display:flex;gap:14px;flex-wrap:wrap">'
            + chk('vocals',  '🎤 Vocals',  dflt('vocals',  true))
            + chk('guitars', '🎸 Guitars', dflt('guitars', false))
            + chk('bass',    '🎸 Bass',    dflt('bass',    false))
            + chk('drums',   '🥁 Drums',   dflt('drums',   false))
            + chk('keys',    '🎹 Keys',    dflt('keys',    false))
            + '</div>'
            + '</div>';
    }

    // Phase A.5 — recipe restore. If there's an in-flight (or recently
    // completed) render for this session, restore the slider/send values
    // so the user re-enters the recipe they were tweaking, not factory
    // defaults. recipeUI is persisted in GLMultitrackRenders alongside the
    // job record.
    var restoreJob = (typeof GLMultitrackRenders !== 'undefined' && GLMultitrackRenders.findInFlightForSession)
        ? GLMultitrackRenders.findInFlightForSession(p.sessionId, { isPreview: false }) : null;
    var restoreUI = (restoreJob && restoreJob.recipeUI) || null;
    function _cmxGroupPct(key, fallback) {
        if (restoreUI && restoreUI.groupGains && restoreUI.groupGains[key] != null) {
            return Math.round(restoreUI.groupGains[key] * 100);
        }
        return fallback;
    }
    var reverbDefaultPct = (restoreUI && restoreUI.masterReverbWet != null)
        ? Math.round(restoreUI.masterReverbWet * 100) : 0;
    var sendsDefault = (restoreUI && restoreUI.sendsByGroup) || null;
    var songsOnlyDefault = !!(restoreUI && restoreUI.songsOnly);

    modal.innerHTML =
        '<div style="max-width:480px;width:100%;background:#0f172a;border-radius:14px;padding:22px;border:1px solid rgba(255,255,255,0.08);max-height:92vh;overflow-y:auto">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
                '<span style="font-size:1.4em">🎛</span>' +
                '<div style="flex:1;font-weight:800;color:#f1f5f9;font-size:1.05em">Custom Mix</div>' +
                '<button onclick="document.getElementById(\'mtCustomMixModal\').remove()" style="background:none;border:none;color:#64748b;font-size:1.3em;cursor:pointer;padding:0 6px">×</button>' +
            '</div>' +
            '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:14px">Dial each group, then render. The new mix becomes Review Mode\'s playback.</div>' +
            sliderRow('🎤', 'Vocals', 'vocals', _cmxGroupPct('vocals', 100)) +
            sliderRow('🎸', 'Guitars', 'guitars', _cmxGroupPct('guitars', 100)) +
            sliderRow('🎸', 'Bass', 'bass', _cmxGroupPct('bass', 100)) +
            sliderRow('🥁', 'Drums', 'drums', _cmxGroupPct('drums', 100)) +
            sliderRow('🎹', 'Keys', 'keys', _cmxGroupPct('keys', 100)) +
            reverbRow(reverbDefaultPct) +
            sendsRow(sendsDefault) +
            // Segment-aware render toggle — gated on a successful Analyze run.
            (function() {
                var songSegs = _mtCollectSongSegments(p);
                var hasSegs = songSegs.length > 0;
                var totalSec = songSegs.reduce(function(sum, s) { return sum + (s.end - s.start); }, 0);
                var minLabel = totalSec > 0 ? (' ~' + Math.round(totalSec / 60) + ' min of audio') : '';
                return '<div style="margin-top:14px;padding:10px 12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:8px">'
                    + '<label style="display:flex;align-items:flex-start;gap:8px;cursor:' + (hasSegs ? 'pointer' : 'not-allowed') + '">'
                    + '<input type="checkbox" id="mtCmxSongsOnly"' + (hasSegs ? '' : ' disabled') + (hasSegs && songsOnlyDefault ? ' checked' : '') + ' style="margin-top:2px;cursor:' + (hasSegs ? 'pointer' : 'not-allowed') + '">'
                    + '<div style="flex:1">'
                    + '<div style="font-weight:700;font-size:0.86em;color:' + (hasSegs ? '#c7d2fe' : 'var(--text-dim)') + '">Render songs only' + (hasSegs ? ' (' + songSegs.length + ' segments' + minLabel + ')' : '') + '</div>'
                    + '<div style="font-size:0.74em;color:var(--text-dim);margin-top:2px">'
                    + (hasSegs
                        ? 'Uses analyzed rehearsal segments to skip silence, chatter, and dead time between songs. Result is a tight songs-only mix.'
                        : 'No analysis yet — run Analyze to enable a songs-only mix. Without analysis we can only render the full timeline.')
                    + '</div>'
                    // Inline Analyze trigger when segments are missing — saves the
                    // user from cancelling the modal, hunting for the 🎯 Analyze
                    // button in the transport bar, running it, then reopening
                    // Custom Mix. Closes this modal and kicks Analyze in one click.
                    + (hasSegs ? '' :
                        '<button type="button" onclick="_mtCmxRunAnalyzeAndReopen(event)" style="margin-top:8px;background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);border-radius:6px;color:#a5b4fc;padding:5px 10px;cursor:pointer;font-size:0.78em;font-weight:700">🎯 Run Analyze now</button>'
                    )
                    + '</div>'
                    + '</label>'
                    + '</div>';
            })() +
            '<div style="margin-top:12px;font-size:0.74em;color:var(--text-dim)">Reverb sends are configurable above (defaults to vocals only — keys carry their own effects from Pierce\'s rig). For per-track FX, use 🎚 Isolate Mode.</div>' +
            '<div id="mtCmxStatus" style="margin-top:14px;min-height:18px;font-size:0.82em;color:var(--text-dim)"></div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:8px">' +
                // Cancel button — relabeled to "Close (keeps running)" once a
                // render is in flight (see _mtCustomMixRunRender). Mirrors the
                // Analyze modal Close UX so the user knows the work continues
                // server-side regardless of whether they leave the modal open.
                '<button id="mtCmxCancelBtn" onclick="document.getElementById(\'mtCustomMixModal\').remove()" class="btn btn-ghost btn-sm">Cancel</button>' +
                // Preview — 30s slice at current playhead with current
                // recipe. Renders fast (~30-60s) so the user can hear
                // before committing to a full render.
                '<button id="mtCmxPreviewBtn" onclick="_mtCustomMixPreview()" style="background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.35);border-radius:6px;color:#86efac;font-weight:700;padding:8px 14px;cursor:pointer;font-size:0.86em">🔊 Preview 30s</button>' +
                '<button id="mtCmxRenderBtn" onclick="_mtCustomMixRender()" style="background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:6px;color:white;font-weight:700;padding:8px 14px;cursor:pointer;font-size:0.88em">🎬 Render Mix</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
    // Phase A.5 — if a render is already in flight for this session (modal
    // reopened mid-run, or reopened after page reload via GLMultitrackRenders
    // boot-resume), reflect that state. Persistence is canonical; the closure
    // _customMixInFlight no longer exists.
    var pp = _mtState.player;
    var inFlight = (pp && typeof GLMultitrackRenders !== 'undefined' && GLMultitrackRenders.findInFlightForSession)
        ? GLMultitrackRenders.findInFlightForSession(pp.sessionId, { isPreview: false })
        : null;
    if (inFlight) {
        _mtRenderCustomMixStatus();
        var cancelBtnExisting = document.getElementById('mtCmxCancelBtn');
        if (cancelBtnExisting) cancelBtnExisting.textContent = 'Close (keeps running)';
        var renderBtnExisting = document.getElementById('mtCmxRenderBtn');
        if (renderBtnExisting) { renderBtnExisting.disabled = true; renderBtnExisting.style.opacity = '0.6'; renderBtnExisting.textContent = '⏳ Already rendering…'; }
        var previewBtnExisting = document.getElementById('mtCmxPreviewBtn');
        if (previewBtnExisting) previewBtnExisting.disabled = true;
    }
};

// Visual dimmer for the reverb-sends row — when the master wet slider is
// at 0% the sends don't do anything audible. Stays interactive so the
// user can pre-arrange routing before raising the master.
window._mtCmxUpdateSendsDimmer = function() {
    var slider = document.getElementById('mtCmxReverb');
    var row = document.getElementById('mtCmxSendsRow');
    if (!slider || !row) return;
    var v = parseFloat(slider.value);
    row.style.opacity = (isFinite(v) && v > 0) ? '1' : '0.55';
};

// Inline "🎯 Run Analyze now" trigger from the Custom Mix modal — closes
// the modal, runs the existing _mtAnalyzeRehearsal flow, and reopens the
// modal once analysis completes so the songs-only checkbox is enabled.
// Stops the click from bubbling to the parent <label> (which would
// otherwise toggle the disabled checkbox).
window._mtCmxRunAnalyzeAndReopen = function(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    var modalEl = document.getElementById('mtCustomMixModal');
    if (modalEl) modalEl.remove();
    // Flag so the analyzer's done-callback reopens the modal automatically.
    if (_mtState.player) _mtState.player._reopenCmxAfterAnalyze = true;
    if (typeof window._mtAnalyzeRehearsal === 'function') {
        window._mtAnalyzeRehearsal();
    } else if (typeof showToast === 'function') {
        showToast('Analyze flow unavailable');
    }
};

// Phase 4 — Custom Mix render phase narration. Mirrors the Analyze
// timeline pattern. 5 phases reflecting what render_mix actually does;
// browser falls back to elapsed-time heuristic when server hasn't
// emitted a phase marker yet (older Modal deploy, or first 5s of run).
var _MT_RENDER_PHASES = [
    { id: 'download',     emoji: '⬇️', label: 'Downloading stems from R2 (parallel ×8)',           thresh: 60  },
    { id: 'filter_build', emoji: '🎛', label: 'Building ffmpeg filter graph',                       thresh: 70  },
    { id: 'ffmpeg',       emoji: '🎼', label: 'Mixing audio — per-track gain + reverb sends',      thresh: 240 },
    { id: 'upload',       emoji: '📤', label: 'Uploading rendered mix to R2',                       thresh: 280 },
    { id: 'wrap',         emoji: '⏳', label: 'Finalizing — render complete',                       thresh: Infinity },
];
function _mtRenderPhaseIdxByElapsed(elapsedSec) {
    for (var i = 0; i < _MT_RENDER_PHASES.length; i++) {
        if (elapsedSec < _MT_RENDER_PHASES[i].thresh) return i;
    }
    return _MT_RENDER_PHASES.length - 1;
}
function _mtRenderPhaseIdxById(id) {
    if (!id) return -1;
    for (var i = 0; i < _MT_RENDER_PHASES.length; i++) {
        if (_MT_RENDER_PHASES[i].id === id) return i;
    }
    return -1;
}
function _mtRenderProgressHtml(inFlight) {
    var elapsedSec = Math.max(0, Math.round((Date.now() - inFlight.startedAt) / 1000));
    var elapsedLabel = elapsedSec < 60
        ? elapsedSec + 's'
        : Math.floor(elapsedSec / 60) + 'm ' + String(elapsedSec % 60).padStart(2, '0') + 's';
    var totalCount = _MT_RENDER_PHASES.length;
    var curIdx, sourceBadge;
    if (inFlight.serverPhase && inFlight.serverPhase.phase) {
        var sIdx = _mtRenderPhaseIdxById(inFlight.serverPhase.phase);
        if (sIdx >= 0) {
            curIdx = sIdx;
            sourceBadge = '<span title="Ground-truth phase emitted by Modal worker" style="background:rgba(34,197,94,0.18);color:#86efac;border:1px solid rgba(34,197,94,0.35);border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700;margin-left:6px">LIVE</span>';
        } else {
            curIdx = _mtRenderPhaseIdxByElapsed(elapsedSec);
            sourceBadge = '<span title="Server phase id not in browser map — using elapsed-time estimate" style="background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid rgba(245,158,11,0.35);border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700;margin-left:6px">EST</span>';
        }
    } else {
        curIdx = _mtRenderPhaseIdxByElapsed(elapsedSec);
        sourceBadge = '<span title="Elapsed-time heuristic — server hasn\'t reported a phase yet" style="background:rgba(148,163,184,0.15);color:var(--text-dim);border:1px solid rgba(148,163,184,0.25);border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700;margin-left:6px">EST</span>';
    }
    var doneCount = curIdx;
    var progressPct = Math.round((doneCount / totalCount) * 100);
    function phaseLine(phase, state) {
        var icon, opacity, weight, color;
        if (state === 'done')         { icon = '✓'; opacity = '0.55'; weight = '500'; color = '#86efac'; }
        else if (state === 'current') { icon = '▶'; opacity = '1';    weight = '700'; color = '#c7d2fe'; }
        else                          { icon = '○'; opacity = '0.4';  weight = '500'; color = 'var(--text-dim)'; }
        return '<div style="display:flex;align-items:center;gap:8px;font-size:0.78em;opacity:' + opacity + '">'
            + '<span style="color:' + color + ';font-family:ui-monospace,monospace;width:14px;text-align:center">' + icon + '</span>'
            + '<span style="font-size:1em">' + phase.emoji + '</span>'
            + '<span style="color:' + color + ';font-weight:' + weight + '">' + escHtml(phase.label) + '</span>'
            + '</div>';
    }
    var prevHtml = curIdx > 0 ? phaseLine(_MT_RENDER_PHASES[curIdx - 1], 'done') : '';
    var curHtml = phaseLine(_MT_RENDER_PHASES[curIdx], 'current');
    var nextHtml = (curIdx + 1 < totalCount) ? phaseLine(_MT_RENDER_PHASES[curIdx + 1], 'pending') : '';
    var modeLabel = inFlight.isPreview ? 'Preview render' : 'Server-side mix render';
    return '<div style="padding:12px 14px;border:1px solid rgba(99,102,241,0.3);border-radius:8px;background:linear-gradient(180deg,rgba(99,102,241,0.10),rgba(99,102,241,0.04));font-size:0.78em;color:#c7d2fe">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<span style="font-size:1.15em">' + (inFlight.isPreview ? '🔊' : '🎬') + '</span>'
        + '<div style="flex:1">'
        + '<div style="font-weight:700;font-size:0.95em">' + escHtml(modeLabel) + sourceBadge + '</div>'
        + '<div style="font-size:0.88em;color:var(--text-dim);margin-top:2px">' + escHtml(elapsedLabel) + ' elapsed · phase ' + (curIdx + 1) + ' of ' + totalCount + '</div>'
        + '</div>'
        + '</div>'
        + '<div style="height:6px;background:rgba(255,255,255,0.04);border-radius:3px;overflow:hidden;margin-bottom:10px">'
        + '<div style="width:' + progressPct + '%;height:100%;background:linear-gradient(90deg,#667eea,#764ba2);transition:width 1s ease"></div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:rgba(15,23,42,0.5);border-radius:6px">'
        + prevHtml + curHtml + nextHtml
        + '</div>'
        + '<div style="margin-top:8px;font-size:0.74em;color:var(--text-dim);font-style:italic">Safe to close this modal — render keeps running and lands automatically when done.</div>'
        + '</div>';
}

// Shared recipe builder + render driver. Used by Render Mix (full) and
// 🔊 Preview (slice). Returns the result promise; caller decides what
// to do with the URL on success.
async function _mtCustomMixRunRender(opts) {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    opts = opts || {};
    var isPreview = !!opts.preview;
    var previewSliceSec = opts.previewSliceSec || null;

    function readPct(id) {
        var el = document.getElementById(id);
        var v = el ? parseFloat(el.value) : 100;
        return (isFinite(v) ? v : 100) / 100;
    }
    var groupGains = {
        vocals:  readPct('mtCmx_vocals'),
        guitars: readPct('mtCmx_guitars'),
        bass:    readPct('mtCmx_bass'),
        drums:   readPct('mtCmx_drums'),
        keys:    readPct('mtCmx_keys'),
    };
    var masterReverbWet = readPct('mtCmxReverb');
    if (masterReverbWet > 1) masterReverbWet = 1;
    function readSend(key, dflt) {
        var el = document.getElementById('mtCmxSend_' + key);
        return el ? !!el.checked : !!dflt;
    }
    var sendsByGroup = {
        vocals:  readSend('vocals',  true),
        guitars: readSend('guitars', false),
        bass:    readSend('bass',    false),
        drums:   readSend('drums',   false),
        keys:    readSend('keys',    false),
    };
    var tracksRecipe = {};
    (p.tracks || []).forEach(function(t) {
        var grp = _mtRoleToGroup(t.role);
        var gain = groupGains[grp];
        if (gain === undefined) gain = 1.0;
        tracksRecipe[t.trackId] = {
            gain: gain,
            mute: false,
            solo: false,
            reverbSend: !!sendsByGroup[grp] ? 1 : 0,
        };
    });
    // Songs-only is irrelevant for previews (we slice at playhead).
    var songsOnlyEl = document.getElementById('mtCmxSongsOnly');
    var songsOnly = !isPreview && !!(songsOnlyEl && songsOnlyEl.checked);
    var songSegs = songsOnly ? _mtCollectSongSegments(p) : [];
    if (songsOnly && !songSegs.length) songsOnly = false;

    var isDefaultSliders = (
        groupGains.vocals === 1 && groupGains.guitars === 1 && groupGains.bass === 1 &&
        groupGains.drums === 1 && groupGains.keys === 1 && masterReverbWet === 0 &&
        sendsByGroup.vocals === true && sendsByGroup.guitars === false &&
        sendsByGroup.bass === false && sendsByGroup.drums === false && sendsByGroup.keys === false
    );
    var renderId;
    if (isPreview) {
        renderId = 'preview-' + Date.now();
    } else if (songsOnly && isDefaultSliders) {
        renderId = 'mix_songs_only';
    } else {
        renderId = 'custom-' + Date.now();
    }
    var recipe = {
        tracks: tracksRecipe,
        masterReverbWet: masterReverbWet,
        outputFormat: 'mp3',
        outputName: 'rehearsal-mix-' + (p.session && p.session.date || p.sessionId) + (isPreview ? '-preview' : (songsOnly ? '-songs' : '-custom')) + '.mp3',
    };
    if (songsOnly) recipe.segments = songSegs;
    if (isPreview && previewSliceSec) recipe.previewSliceSec = previewSliceSec;

    // Phase A.5 (2026-05-25) — persistence + recipe restore. Delegate the
    // start+poll loop to GLMultitrackRenders so a modal close, page reload,
    // or session switch no longer strands the render. recipeUI persists the
    // group-level slider state for modal reopen restoration; the persisted
    // record is the single source of truth for status (no more closure-scoped
    // _customMixInFlight). The Review Mode banner subscriber (attached at
    // module load) reacts to glRenderJobUpdated events so completion can
    // land while the modal is closed.
    var recipeUI = {
        groupGains: groupGains,
        masterReverbWet: masterReverbWet,
        sendsByGroup: sendsByGroup,
        songsOnly: songsOnly,
    };
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';

    if (typeof GLMultitrackRenders === 'undefined' || !GLMultitrackRenders.start) {
        throw new Error('GLMultitrackRenders unavailable');
    }
    _mtRenderCustomMixStatus();
    return await GLMultitrackRenders.start({
        bandSlug: slug,
        sessionId: p.sessionId,
        renderId: renderId,
        recipe: recipe,
        recipeUI: recipeUI,
        isPreview: isPreview,
        onProgress: function(phase) {
            _mtRenderCustomMixStatus();
            if (phase === 'processing') {
                var cancelBtn = document.getElementById('mtCmxCancelBtn');
                if (cancelBtn && cancelBtn.textContent === 'Cancel') {
                    cancelBtn.textContent = 'Close (keeps running)';
                }
            }
        },
    });
}

function _mtRenderCustomMixStatus() {
    var p = _mtState.player;
    var status = document.getElementById('mtCmxStatus');
    if (!status) return;
    // Phase A.5 — read in-flight state from GLMultitrackRenders (persistent)
    // rather than the closure-scoped p._customMixInFlight (removed).
    // Prefer non-preview render for the status panel; the 🔊 Preview path
    // shows its own inline player on success so we don't need to mirror it
    // here. If only a preview is in flight, show it too — the user did
    // request progress visibility.
    var job = null;
    if (p && typeof GLMultitrackRenders !== 'undefined' && GLMultitrackRenders.findInFlightForSession) {
        job = GLMultitrackRenders.findInFlightForSession(p.sessionId, { isPreview: false })
            || GLMultitrackRenders.findInFlightForSession(p.sessionId, { isPreview: true });
    }
    if (job) {
        // Adapter to _mtRenderProgressHtml's expected shape.
        status.innerHTML = _mtRenderProgressHtml({
            startedAt: job.startedAt,
            isPreview: job.isPreview,
            serverPhase: job.serverPhase,
        });
        status.style.minHeight = '0';
    } else {
        status.innerHTML = '';
    }
}

window._mtCustomMixRender = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    var btn = document.getElementById('mtCmxRenderBtn');
    var previewBtn = document.getElementById('mtCmxPreviewBtn');
    function setBtn(text, disable) {
        if (!btn) return;
        btn.textContent = text;
        btn.disabled = !!disable;
        btn.style.opacity = disable ? '0.6' : '1';
    }
    if (previewBtn) previewBtn.disabled = true;
    setBtn('⏳ Starting…', true);
    try {
        var checkJson = await _mtCustomMixRunRender({ preview: false });
        if (!checkJson) return;
        // Phase A.5 — modal-open-at-completion check. The banner subscriber
        // (glRenderJobUpdated listener) handles the closed-modal path with its
        // own toast + audio swap. If we toast here unconditionally we'd
        // double-toast whenever the user closed the modal mid-render. Only
        // run the foreground completion branch when the modal is still open.
        var modalElAtDone = document.getElementById('mtCustomMixModal');
        if (!modalElAtDone) return;
        // Swap audio.src in Review Mode so playback uses the new mix.
        var audio = document.getElementById('mtReviewAudio');
        if (audio) {
            audio.src = checkJson.publicUrl;
            audio.load();
        }
        if (_mtState.player && _mtState.player.sessionId === p.sessionId) {
            _mtState.player.renderInfo = {
                url: checkJson.publicUrl,
                fileName: checkJson.fileName,
                format: checkJson.format,
                renderId: checkJson.renderId,
            };
            var banner = document.getElementById('mtReviewStatusBanner');
            if (banner) {
                banner.innerHTML = '✓ Custom mix rendered — ' + escHtml(checkJson.fileName || 'mix') + ' · ▶ Play to listen';
            }
        }
        if (typeof showToast === 'function') showToast('✓ Custom mix ready — Review Mode is now playing it');
        modalElAtDone.remove();
    } catch (e) {
        console.warn('[Multitrack] custom mix render failed:', e);
        var statusEl = document.getElementById('mtCmxStatus');
        if (statusEl) statusEl.innerHTML = '<div style="color:#fca5a5">✗ ' + escHtml(e.message || 'failed') + '</div>';
        setBtn('🎬 Render Mix', false);
        if (previewBtn) previewBtn.disabled = false;
        if (typeof showToast === 'function') showToast('Render failed: ' + (e.message || ''));
    }
};

// Phase 4 — 🔊 Preview button. Renders a 30s slice at the user's
// current playhead with the current recipe. Plays inline below the
// status panel so the user can hear the proposed mix before committing
// to a full ~2-5 min render. If playhead is at 0 or beyond duration,
// defaults to 30s starting at the first analyzed music segment (or 30s
// from rehearsal start if no segments).
window._mtCustomMixPreview = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    var renderBtn = document.getElementById('mtCmxRenderBtn');
    var previewBtn = document.getElementById('mtCmxPreviewBtn');

    // Decide preview slice start.
    var playhead = (typeof _mtCurrentPlayheadSec === 'function') ? _mtCurrentPlayheadSec() : 0;
    var dur = (p.audios && p.audios[0] && p.audios[0].duration) || 0;
    var sliceStart = playhead;
    if (!playhead || playhead < 1) {
        // Default: first music segment, or 30s in.
        var firstMusic = (Array.isArray(p.segments) ? p.segments : []).find(function(s) {
            return _mtSegmentEffectiveKind(s) === 'music';
        });
        sliceStart = firstMusic ? firstMusic.startSec : 30;
    }
    var sliceDuration = 30;
    if (dur > 0 && sliceStart + sliceDuration > dur) {
        sliceStart = Math.max(0, dur - sliceDuration);
    }

    if (renderBtn) renderBtn.disabled = true;
    if (previewBtn) { previewBtn.disabled = true; previewBtn.textContent = '⏳ Rendering preview…'; }

    try {
        var checkJson = await _mtCustomMixRunRender({
            preview: true,
            previewSliceSec: { start: sliceStart, duration: sliceDuration },
        });
        if (!checkJson) return;
        // Inject inline preview player below the status panel.
        var status = document.getElementById('mtCmxStatus');
        if (status) {
            var startLbl = _mtFmtTimeShort(sliceStart);
            var endLbl = _mtFmtTimeShort(sliceStart + sliceDuration);
            status.innerHTML =
                '<div style="padding:10px 12px;border:1px solid rgba(34,197,94,0.3);border-radius:8px;background:rgba(34,197,94,0.07);font-size:0.82em">'
                + '<div style="font-weight:700;color:#86efac;margin-bottom:6px">🔊 Preview ready — ' + escHtml(startLbl) + ' to ' + escHtml(endLbl) + '</div>'
                + '<audio controls autoplay src="' + escHtml(checkJson.publicUrl) + '" style="width:100%;margin-top:4px"></audio>'
                + '<div style="margin-top:6px;font-size:0.78em;color:var(--text-dim)">Adjust sliders + 🔊 Preview again to compare, or 🎬 Render Mix to commit.</div>'
                + '</div>';
        }
        if (typeof showToast === 'function') showToast('🔊 Preview ready');
    } catch (e) {
        console.warn('[Multitrack] preview render failed:', e);
        var statusEl = document.getElementById('mtCmxStatus');
        if (statusEl) statusEl.innerHTML = '<div style="color:#fca5a5">✗ Preview failed: ' + escHtml(e.message || 'failed') + '</div>';
        if (typeof showToast === 'function') showToast('Preview failed: ' + (e.message || ''));
    } finally {
        if (renderBtn) renderBtn.disabled = false;
        if (previewBtn) { previewBtn.disabled = false; previewBtn.textContent = '🔊 Preview 30s'; }
    }
};

// ── 📨 Text Band — share current rendered mix via SMS ───────────────────────
// Uses GLSms.notifyBand (existing 3-layer notification system) to fan out
// to opted-in band members. Default excludes the sender. A2P-compliant
// body with brand prefix + STOP/HELP/rates disclosures. URL is the public
// R2 link; recipient taps it to play in their messaging app.
window._mtShareCurrentMix = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    if (typeof GLSms === 'undefined' || !GLSms.notifyBand) {
        if (typeof showToast === 'function') showToast('SMS pipeline unavailable');
        return;
    }
    // Share-preference policy:
    //   1. mix_songs_only (analyzed) — the bandmate-friendly default
    //   2. Whatever Review Mode is currently playing (with a warning if
    //      it's the full timeline since that's full of dead air)
    var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var shareUrl = null;
    var shareKind = '';   // 'songs' | 'full' | 'custom'
    var songsOnlyUrl = null;
    try {
        var sr = await fetch(workerBase + '/multitrack/render/status?bandSlug=' + encodeURIComponent(slug) + '&sessionId=' + encodeURIComponent(p.sessionId));
        if (sr.ok) {
            var sj = await sr.json();
            (sj && sj.renders ? sj.renders : []).forEach(function(r) {
                if (!songsOnlyUrl && r.renderId === 'mix_songs_only') {
                    songsOnlyUrl = r.url;
                }
            });
        }
    } catch (e) { /* fall through to current renderInfo */ }

    if (songsOnlyUrl) {
        shareUrl = songsOnlyUrl;
        shareKind = 'songs';
    } else if (p.renderInfo && p.renderInfo.url) {
        shareUrl = p.renderInfo.url;
        // Differentiate full timeline vs custom mix for the warning copy.
        shareKind = (p.renderInfo.renderId === 'mix_default') ? 'full' : 'custom';
    } else {
        if (typeof showToast === 'function') showToast('No mix to share yet — wait for the render to finish');
        return;
    }

    // Sender name from band roster, fallback to "A bandmate".
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    var senderName = 'A bandmate';
    try {
        if (memberKey && typeof bandMembers !== 'undefined' && bandMembers[memberKey] && bandMembers[memberKey].name) {
            senderName = bandMembers[memberKey].name.split(' ')[0];
        }
    } catch (e) {}
    // Rehearsal date label
    var dateLabel = '';
    try {
        if (p.session && p.session.date) {
            dateLabel = new Date(p.session.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    } catch (e) {}
    var labelTail = shareKind === 'songs' ? ' rehearsal mix (songs only)' : ' rehearsal mix';
    var bodyLead = 'GrooveLinx: ' + senderName + ' shared the' + (dateLabel ? ' ' + dateLabel : '') + labelTail + ': ' + shareUrl;
    var body = bodyLead + '. Reply STOP to opt out, HELP for help. Message and data rates may apply.';

    var preview = body.length > 280 ? body.slice(0, 280) + '…' : body;
    var warnPrefix = '';
    if (shareKind === 'full') {
        warnPrefix = '⚠️ This will share the FULL REHEARSAL (~3 hours, includes silence, chatter, and dead time between songs).\n\nFor a tight songs-only mix, cancel here and open 🎛 Mix → check "Render songs only" → Render Mix → try Text again.\n\n';
    }
    if (!confirm(warnPrefix + 'Send this SMS to opted-in band members?\n\n' + preview)) {
        return;
    }
    var btn = document.getElementById('mtShareBtn');
    var orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; }
    try {
        var result = await GLSms.notifyBand({ body: body });
        if (btn) { btn.disabled = false; btn.textContent = orig || '📨 Text'; }
        if (result && result.ok) {
            if (result.total === 0) {
                if (typeof showToast === 'function') showToast('ℹ No opted-in SMS recipients in your band');
            } else if (result.sent === result.total) {
                if (typeof showToast === 'function') showToast('✓ Mix link texted to ' + result.sent + ' bandmate' + (result.sent === 1 ? '' : 's'));
            } else {
                if (typeof showToast === 'function') showToast('⚠️ Sent ' + result.sent + ' of ' + result.total + ' (' + result.failed + ' failed)');
                console.warn('[Multitrack] SMS share partial failure:', result.errors);
            }
        } else {
            if (typeof showToast === 'function') showToast('Share failed: ' + ((result && result.reason) || 'unknown'));
        }
    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = orig || '📨 Text'; }
        console.warn('[Multitrack] SMS share threw:', e);
        if (typeof showToast === 'function') showToast('Share failed: ' + (e.message || ''));
    }
};

window._mtClosePlayer = function() {
    var ov = document.getElementById('mtPlayerOverlay');
    if (ov) ov.remove();
    // Phase 2D: detach keyboard shortcuts when leaving the player.
    if (typeof _mtSegmentsKeydown === 'function') {
        try { document.removeEventListener('keydown', _mtSegmentsKeydown); } catch (e) {}
    }
    if (_mtState.player) {
        if (_mtState.player._timeTicker) clearInterval(_mtState.player._timeTicker);
        _mtStopSyncWatchdog(_mtState.player);
        if (_mtState.player._holdTimer) { clearInterval(_mtState.player._holdTimer); _mtState.player._holdTimer = null; }
        _mtState.player.audios.forEach(function(a) { try { a.pause(); a.src = ''; } catch (e) {} });
        // Phase C: flush any pending mixState save, then tear down Web Audio
        // graph. Closing the AudioContext frees the GainNodes / ConvolverNode
        // and the synthesized impulse buffer; reopening the player creates a
        // fresh graph from scratch.
        if (_mtMixSaveTimer) { clearTimeout(_mtMixSaveTimer); _mtMixSaveTimer = null; _mtSaveMixState(); }
        if (_mtState.player.audioCtx) {
            try { _mtState.player.audioCtx.close(); } catch (e) {}
        }
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
        _mtStopSyncWatchdog(p);
        if (btn) btn.textContent = '▶ Play';
        // Tier 1F — clear the active-segment highlight on pause so it
        // doesn't appear to be tracking the analyzer (which it isn't).
        if (typeof _mtUpdateActiveSegmentHighlight === 'function') {
            setTimeout(_mtUpdateActiveSegmentHighlight, 0);
        }
    } else {
        // Phase C: initialize Web Audio graph on first play click. Browser
        // autoplay policy requires AudioContext creation to be inside a user
        // gesture handler; this is that handler. Idempotent if already
        // initialized.
        _mtInitWebAudio();
        // Resume context if it was created suspended (some browsers).
        if (p.audioCtx && p.audioCtx.state === 'suspended') {
            try { p.audioCtx.resume(); } catch (e) {}
        }
        // Sync all to first audio's currentTime to compensate for any drift
        var t = (p.audios[0] && p.audios[0].currentTime) || 0;
        var failed = 0;
        p.audios.forEach(function(a) {
            try { a.currentTime = t; } catch (e) {}
            var pr = a.play();
            if (pr && typeof pr.catch === 'function') {
                pr.catch(function(err) {
                    // AbortError is self-recovering — happens when the user
                    // hits play while a previous seek-induced load is still
                    // in flight. Silence it.
                    if (err && err.name === 'AbortError') return;
                    failed++;
                    console.warn('[Multitrack] play() rejected for', a.dataset.trackId, err && err.name);
                });
            }
        });
        p.masterPlaying = true;
        _mtStartSyncWatchdog(p);
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
    _mtSaveMixStateDebounced();
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
    _mtSaveMixStateDebounced();
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

// ── Web Audio graph (Phase C: per-track volume + master reverb) ─────────────
// Initialized lazily on first user gesture (play click) to satisfy browser
// autoplay policy. Each <audio> element is wrapped:
//   audio → MediaElementSource → trackGain → masterDry → AudioContext.destination
//                                          → reverbSend → convolver → reverbWet → destination
// Mute/solo continue to operate on audio.muted (pre-graph), so the graph
// just adjusts levels of whatever signal actually flows through.
function _mtInitWebAudio() {
    var p = _mtState.player;
    if (!p || p.audioCtx) return;
    try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            console.warn('[Multitrack] Web Audio not available — falling back to HTML5 audio only');
            return;
        }
        var ctx = new Ctx();
        p.audioCtx = ctx;
        p.trackChains = {}; // { trackId: { source, gain, reverbSend } }

        // Master bus: a dry path and a wet (reverb) path summed at destination.
        // The wet level controls how loud the reverb return is in the final mix.
        p.masterDry = ctx.createGain();
        p.masterDry.gain.value = 1.0;
        p.masterDry.connect(ctx.destination);

        p.reverbWet = ctx.createGain();
        p.reverbWet.gain.value = 0.0; // start fully dry
        p.reverbWet.connect(ctx.destination);

        p.convolver = ctx.createConvolver();
        p.convolver.buffer = _mtSynthImpulseResponse(ctx, 2.0, 2.5);
        p.convolver.connect(p.reverbWet);

        // Per-track chain: audio → source → trackGain → (masterDry + reverbSend)
        p.audios.forEach(function(audio) {
            var id = audio.dataset.trackId;
            try {
                var src = ctx.createMediaElementSource(audio);
                var gain = ctx.createGain();
                gain.gain.value = (p.mixState && p.mixState.volumes && p.mixState.volumes[id] != null)
                    ? p.mixState.volumes[id] : 1.0;
                var reverbSend = ctx.createGain();
                // Per-track reverb routing: each track has its own send level
                // (0 = no reverb on this track, 1 = full send). Default ON for
                // first-time players; user can disable per track via the 💧
                // button. The master wet knob controls overall reverb return.
                var savedSend = (p.mixState && p.mixState.reverbSends && p.mixState.reverbSends[id] !== undefined)
                    ? p.mixState.reverbSends[id] : 1;
                reverbSend.gain.value = savedSend;
                src.connect(gain);
                gain.connect(p.masterDry);
                gain.connect(reverbSend);
                reverbSend.connect(p.convolver);
                p.trackChains[id] = { source: src, gain: gain, reverbSend: reverbSend };
            } catch (e) {
                console.warn('[Multitrack] failed to wire track', id, e && e.message);
            }
        });

        // Apply persisted reverb wet level
        if (p.mixState && typeof p.mixState.reverbWet === 'number') {
            p.reverbWet.gain.value = p.mixState.reverbWet;
        }
    } catch (e) {
        console.warn('[Multitrack] Web Audio init failed:', e && e.message);
    }
}

// Synthesize a generic small-room impulse response (no external file load).
// Noise burst with exponential decay; 2 channels for natural stereo width.
function _mtSynthImpulseResponse(ctx, durationSec, decayCurve) {
    var sampleRate = ctx.sampleRate;
    var length = Math.floor(sampleRate * durationSec);
    var impulse = ctx.createBuffer(2, length, sampleRate);
    var L = impulse.getChannelData(0);
    var R = impulse.getChannelData(1);
    for (var i = 0; i < length; i++) {
        var env = Math.pow(1 - i / length, decayCurve);
        L[i] = (Math.random() * 2 - 1) * env;
        R[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
}

// ── Volume + reverb setters ────────────────────────────────────────────────
window._mtSetTrackVolume = function(trackId, pct) {
    var p = _mtState.player;
    if (!p) return;
    var v = parseFloat(pct) / 100;
    if (!isFinite(v)) v = 1.0;
    if (!p.mixState) p.mixState = { volumes: {}, reverbWet: 0 };
    if (!p.mixState.volumes) p.mixState.volumes = {};
    p.mixState.volumes[trackId] = v;
    var chain = p.trackChains && p.trackChains[trackId];
    if (chain && p.audioCtx) {
        chain.gain.gain.setTargetAtTime(v, p.audioCtx.currentTime, 0.02);
    }
    var label = document.getElementById('mtVolLabel_' + trackId);
    if (label) label.textContent = Math.round(pct) + '%';
    _mtSaveMixStateDebounced();
};

// ⭐ Keeper flag — explicit "save this rehearsal's stems forever" marker.
// Architectural reason: any future auto-tiering of stems (Phase D, deferred)
// MUST exempt sessions where keeper === true. Without this, a great take
// could get auto-archived/submixed before the band decides to master it.
// Mastering requires the original per-track FLACs — once lost, they're gone.
window._mtToggleKeeper = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var btn = document.getElementById('mtKeeperBtn');
    try {
        // Read current value fresh (don't trust local state if user opened
        // from a tab where another device toggled it)
        var snap = await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/keeper')).once('value');
        var current = !!snap.val();
        var next = !current;
        await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/keeper')).set(next);
        if (btn) {
            btn.textContent = next ? '⭐ Keeper' : '☆ Keeper';
            btn.style.background = next ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)';
            btn.style.borderColor = next ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.1)';
            btn.style.color = next ? '#fbbf24' : 'var(--text-dim)';
        }
        if (typeof showToast === 'function') {
            showToast(next ? '⭐ Marked as Keeper — stems will be retained forever' : '☆ Unmarked as Keeper');
        }
        // Refresh history sidebar so the visual flag shows up there too
        try { if (typeof _rhRenderSessionHistory === 'function') _rhRenderSessionHistory(); } catch (e) {}
    } catch (e) {
        if (typeof showToast === 'function') showToast('Save failed: ' + (e && e.message));
    }
};

// 📦 Download stems — uses the existing /multitrack/zip async pipeline.
// Flow:
//   1. Check /multitrack/zip/status — if a session.zip is already cached
//      in R2, redirect to it immediately.
//   2. Otherwise POST /multitrack/zip/start to spawn the Modal job, get
//      a call_id back.
//   3. Poll /multitrack/zip/check every 5s until state==='done'.
//   4. Trigger a browser download via the returned publicUrl.
window._mtDownloadStems = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var btn = document.getElementById('mtDownloadBtn');
    var origLabel = btn ? btn.textContent : '';

    function setLabel(text, isError) {
        if (!btn) return;
        btn.textContent = text;
        btn.disabled = !isError;
        btn.style.opacity = isError ? '1' : '0.7';
    }
    function resetLabel() {
        if (!btn) return;
        btn.textContent = origLabel || '📦 Stems';
        btn.disabled = false;
        btn.style.opacity = '1';
    }

    setLabel('⏳ Checking…');
    try {
        // 1. Cache check
        var statusRes = await fetch(workerBase + '/multitrack/zip/status?bandSlug=' + encodeURIComponent(slug) + '&sessionId=' + encodeURIComponent(p.sessionId));
        var statusJson = await statusRes.json();
        if (statusJson && statusJson.ready && statusJson.publicUrl) {
            setLabel('📥 Downloading…');
            window.location.href = statusJson.publicUrl;
            setTimeout(resetLabel, 2000);
            return;
        }

        // 2. Spawn a fresh build
        setLabel('🛠 Building zip…');
        var startRes = await fetch(workerBase + '/multitrack/zip/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bandSlug: slug, sessionId: p.sessionId })
        });
        var startJson = await startRes.json();
        if (!startRes.ok || !startJson || !startJson.call_id) {
            throw new Error((startJson && startJson.error) || ('HTTP ' + startRes.status));
        }
        var callId = startJson.call_id;

        // 3. Poll. Max ~5 min (60 attempts × 5s each) for very large sessions.
        for (var attempt = 0; attempt < 60; attempt++) {
            await new Promise(function(r) { setTimeout(r, 5000); });
            setLabel('⏳ Zipping (' + ((attempt + 1) * 5) + 's)…');
            var checkRes = await fetch(workerBase + '/multitrack/zip/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ call_id: callId })
            });
            var checkJson = await checkRes.json();
            if (checkJson && (checkJson.state === 'done' || checkJson.status === 'done')) {
                var url = checkJson.publicUrl || checkJson.url;
                if (!url) {
                    // Fall back to status check — Modal said done but didn't return URL
                    var s2 = await fetch(workerBase + '/multitrack/zip/status?bandSlug=' + encodeURIComponent(slug) + '&sessionId=' + encodeURIComponent(p.sessionId));
                    var s2j = await s2.json();
                    url = s2j && s2j.publicUrl;
                }
                if (!url) throw new Error('zip ready but no URL returned');
                setLabel('📥 Downloading…');
                window.location.href = url;
                setTimeout(resetLabel, 2000);
                return;
            }
            if (checkJson && (checkJson.state === 'error' || checkJson.status === 'error')) {
                throw new Error((checkJson.error || 'modal_error'));
            }
        }
        throw new Error('zip build timed out after 5 minutes');
    } catch (e) {
        console.warn('[Multitrack] download stems failed:', e);
        setLabel('✗ ' + (e.message || 'failed'), true);
        if (typeof showToast === 'function') showToast('Download failed: ' + (e.message || ''));
        setTimeout(resetLabel, 4000);
    }
};

// Edit the session header (date + venue) inline. Persists to
// rehearsal_sessions/{sid}/{date,venue} and re-renders the header strip.
window._mtEditSessionHeader = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') {
        if (typeof showToast === 'function') showToast('Firebase not ready');
        return;
    }
    // Pull current values fresh from Firebase so the edit form reflects truth
    var session;
    try {
        var snap = await db.ref(bandPath('rehearsal_sessions/' + p.sessionId)).once('value');
        session = snap.val() || {};
    } catch (e) { session = {}; }

    var curDate = session.date || '';
    var curVenue = session.venue || '';

    var existing = document.getElementById('mtHeaderEditModal');
    if (existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'mtHeaderEditModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';
    modal.innerHTML = '<div style="max-width:440px;width:100%;background:#0f172a;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.08)">'
        + '<div style="font-weight:800;font-size:1em;color:#f1f5f9;margin-bottom:12px">✏️ Edit rehearsal details</div>'
        + '<label style="display:block;font-size:0.74em;font-weight:700;color:var(--text-dim);margin-bottom:4px">Date</label>'
        + '<input type="date" id="mtEditDate" value="' + escHtml(curDate) + '" class="app-input" style="width:100%;font-size:0.9em;margin-bottom:12px">'
        + '<label style="display:block;font-size:0.74em;font-weight:700;color:var(--text-dim);margin-bottom:4px">Venue</label>'
        + '<input type="text" id="mtEditVenue" value="' + escHtml(curVenue) + '" class="app-input" style="width:100%;font-size:0.9em;margin-bottom:14px" placeholder="e.g. Drew\'s House (DeadCetera Rehearsal)">'
        + '<div id="mtEditStatus" style="font-size:0.78em;color:var(--text-dim);min-height:16px;margin-bottom:10px"></div>'
        + '<div style="display:flex;gap:8px;justify-content:flex-end">'
        + '<button onclick="document.getElementById(\'mtHeaderEditModal\').remove()" class="btn btn-ghost btn-sm">Cancel</button>'
        + '<button id="mtEditSaveBtn" onclick="_mtSaveSessionHeader()" class="btn btn-primary btn-sm">💾 Save</button>'
        + '</div>'
        + '</div>';
    document.body.appendChild(modal);
};

window._mtSaveSessionHeader = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    var dateEl = document.getElementById('mtEditDate');
    var venueEl = document.getElementById('mtEditVenue');
    var status = document.getElementById('mtEditStatus');
    var btn = document.getElementById('mtEditSaveBtn');
    var date = dateEl ? dateEl.value : '';
    var venue = venueEl ? (venueEl.value || '').trim() : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving…'; }
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') {
        if (status) status.textContent = 'Firebase not ready';
        return;
    }
    try {
        await db.ref(bandPath('rehearsal_sessions/' + p.sessionId)).update({
            date: date,
            venue: venue,
            updatedAt: new Date().toISOString()
        });
        // Refresh the visible header strip
        var meta = document.getElementById('mtHeaderMeta');
        if (meta) {
            var dateLabel = date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
            meta.innerHTML = escHtml(dateLabel) + (venue ? ' · ' + escHtml(venue) : '') + ' · ' + (p.tracks || []).length + ' tracks';
        }
        var modal = document.getElementById('mtHeaderEditModal');
        if (modal) modal.remove();
        if (typeof showToast === 'function') showToast('✓ Saved');
        // Refresh just the rehearsal history list in the sidebar so the
        // updated date/venue shows without a full page re-render. Targeted
        // refresh — calling the whole renderRehearsalPage was crashing
        // because its target element doesn't exist when called from inside
        // the player modal.
        try {
            if (typeof _rhRenderSessionHistory === 'function') _rhRenderSessionHistory();
        } catch (e) {}
    } catch (e) {
        if (status) status.textContent = '✗ ' + (e.message || 'save failed');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Save'; }
    }
};

// Toggle whether a single track is routed through the master reverb. The
// reverbSend GainNode per track was already in the graph from initial setup;
// this just flips its gain between 0 and 1. The master 💧 slider controls
// the wet return level. Default = ALL tracks send (1.0); typical use is to
// turn off drums/bass and keep vocals/keys going to reverb.
window._mtToggleTrackFx = function(trackId) {
    var p = _mtState.player;
    if (!p) return;
    if (!p.mixState) p.mixState = { volumes: {}, reverbWet: 0, reverbSends: {} };
    if (!p.mixState.reverbSends) p.mixState.reverbSends = {};
    // Treat undefined as ON (default behavior on first interaction); flip from there
    var curr = (p.mixState.reverbSends[trackId] !== 0); // default true if not set
    var nextOn = !curr;
    p.mixState.reverbSends[trackId] = nextOn ? 1 : 0;
    var chain = p.trackChains && p.trackChains[trackId];
    if (chain && p.audioCtx && chain.reverbSend) {
        chain.reverbSend.gain.setTargetAtTime(nextOn ? 1 : 0, p.audioCtx.currentTime, 0.02);
    }
    var btn = document.getElementById('mtFx_' + trackId);
    if (btn) {
        btn.style.background = nextOn ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.04)';
        btn.style.color = nextOn ? '#67e8f9' : 'var(--text-dim)';
    }
    _mtSaveMixStateDebounced();
};

window._mtSetReverbWet = function(pct) {
    var p = _mtState.player;
    if (!p) return;
    var v = parseFloat(pct) / 100;
    if (!isFinite(v)) v = 0;
    if (!p.mixState) p.mixState = { volumes: {}, reverbWet: 0 };
    p.mixState.reverbWet = v;
    if (p.reverbWet && p.audioCtx) {
        p.reverbWet.gain.setTargetAtTime(v, p.audioCtx.currentTime, 0.05);
    }
    var label = document.getElementById('mtReverbLabel');
    if (label) label.textContent = Math.round(pct) + '%';
    _mtSaveMixStateDebounced();
};

var _mtMixSaveTimer = null;
function _mtSaveMixStateDebounced() {
    if (_mtMixSaveTimer) clearTimeout(_mtMixSaveTimer);
    _mtMixSaveTimer = setTimeout(_mtSaveMixState, 600);
}

async function _mtSaveMixState() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var state = {
        volumes: (p.mixState && p.mixState.volumes) || {},
        reverbWet: (p.mixState && p.mixState.reverbWet) || 0,
        reverbSends: (p.mixState && p.mixState.reverbSends) || {},
        mute: p.muted || {},
        solo: p.soloed || {},
        updatedAt: new Date().toISOString()
    };
    try {
        await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/mixState')).set(state);
    } catch (e) { console.warn('[Multitrack] mixState save failed:', e && e.message); }
}

async function _mtLoadMixState(sessionId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return null;
    try {
        var snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/mixState')).once('value');
        return snap.val();
    } catch (e) { return null; }
}

// ── Mix presets — named snapshots of full mix state ────────────────────────
window._mtSaveMixPreset = async function() {
    var p = _mtState.player;
    if (!p) return;
    var name = prompt('Name this mix preset (e.g. "Vocals up", "Drums only", "Live mix"):');
    if (!name || !name.trim()) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') {
        if (typeof showToast === 'function') showToast('Firebase not ready');
        return;
    }
    var preset = {
        name: name.trim(),
        savedAt: new Date().toISOString(),
        savedBy: (typeof currentUserEmail !== 'undefined') ? (currentUserEmail || '') : '',
        state: {
            volumes: Object.assign({}, (p.mixState && p.mixState.volumes) || {}),
            reverbWet: (p.mixState && p.mixState.reverbWet) || 0,
            mute: Object.assign({}, p.muted || {}),
            solo: Object.assign({}, p.soloed || {})
        }
    };
    try {
        var ref = await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/mixPresets')).push(preset);
        preset._key = ref.key;
        if (!p.mixPresets) p.mixPresets = [];
        p.mixPresets.push(preset);
        _mtRenderMixPresetBar();
        if (typeof showToast === 'function') showToast('✓ Saved mix preset: ' + preset.name);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Save failed: ' + (e && e.message));
    }
};

window._mtLoadMixPreset = function(presetKey) {
    var p = _mtState.player;
    if (!p || !p.mixPresets) return;
    var preset = p.mixPresets.find(function(x) { return x._key === presetKey; });
    if (!preset || !preset.state) return;
    var s = preset.state;
    // Apply mute states
    p.muted = Object.assign({}, s.mute || {});
    p.soloed = Object.assign({}, s.solo || {});
    Object.keys(p.muted).forEach(function(id) {
        var btn = document.getElementById('mtMute_' + id);
        if (btn) {
            btn.style.background = p.muted[id] ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.04)';
            btn.style.color = p.muted[id] ? '#fca5a5' : 'var(--text-dim)';
        }
    });
    Object.keys(p.soloed).forEach(function(id) {
        var btn = document.getElementById('mtSolo_' + id);
        if (btn) {
            btn.style.background = p.soloed[id] ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)';
            btn.style.color = p.soloed[id] ? '#fbbf24' : 'var(--text-dim)';
        }
    });
    _mtApplyMuteSolo();
    // Apply volume + reverb
    p.mixState = { volumes: Object.assign({}, s.volumes || {}), reverbWet: s.reverbWet || 0 };
    Object.keys(p.mixState.volumes).forEach(function(id) {
        var pct = p.mixState.volumes[id] * 100;
        var slider = document.getElementById('mtVol_' + id);
        if (slider) slider.value = pct;
        _mtSetTrackVolume(id, pct);
    });
    var revSlider = document.getElementById('mtReverbSlider');
    if (revSlider) revSlider.value = p.mixState.reverbWet * 100;
    _mtSetReverbWet(p.mixState.reverbWet * 100);
    if (typeof showToast === 'function') showToast('✓ Loaded: ' + preset.name);
};

window._mtDeleteMixPreset = async function(presetKey) {
    var p = _mtState.player;
    if (!p || !p.mixPresets) return;
    var preset = p.mixPresets.find(function(x) { return x._key === presetKey; });
    if (!preset) return;
    if (!confirm('Delete mix preset "' + preset.name + '"?')) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/mixPresets/' + presetKey)).remove();
        p.mixPresets = p.mixPresets.filter(function(x) { return x._key !== presetKey; });
        _mtRenderMixPresetBar();
    } catch (e) {
        if (typeof showToast === 'function') showToast('Delete failed: ' + (e && e.message));
    }
};

async function _mtLoadMixPresets(sessionId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    try {
        var snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/mixPresets')).once('value');
        var val = snap.val() || {};
        return Object.keys(val).map(function(k) { return Object.assign({}, val[k], { _key: k }); });
    } catch (e) { return []; }
}

// ── Segmentation analysis — pipeline reuse for multitrack ─────────────────
// Bridges the multitrack player to the existing single-file analysis pipeline
// (window.RehearsalAnalysis.run). The analyzer takes any AudioBuffer; we
// supply one decoded stem at the user's choice rather than a full mixdown,
// because mixing N 3-hour FLACs in-browser exceeds heap limits. Picking a
// single representative stem (drums for tempo/section, vocal for lyric
// breaks) is usually sufficient to detect song boundaries.
//
// Future enhancement: server-side mixdown via Modal so the full multitrack
// signal feeds the analyzer. Tonight's single-stem approach is the bridge.
window._mtAnalyzeRehearsal = async function() {
    var p = _mtState.player;
    if (!p || !p.sessionId) return;

    // Source priority:
    //   1. ANY rendered stereo mix — recommended. Has all instruments —
    //      analyzer sees continuous music across songs regardless of which
    //      players are dropping out at any moment. Empirically (Drew,
    //      2026-05-24) picking the kick stem produced 381 segments because
    //      kick drops out during verses → analyzer sees silence mid-song.
    //   2. Vocals (lyric-start gives clean boundaries when no mix exists)
    //   3. Any other stem (fallback only)
    //
    // We also hit /multitrack/render/status to find the freshest available
    // render — Review Mode's currently-loaded renderInfo might be a custom
    // mix; for Analyze we prefer the canonical mix_default if any exists.
    var renderInfo = p.renderInfo || null;
    var bestMix = null;
    try {
        var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
        var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
        var sr = await fetch(workerBase + '/multitrack/render/status?bandSlug=' + encodeURIComponent(slug) + '&sessionId=' + encodeURIComponent(p.sessionId));
        if (sr.ok) {
            var sj = await sr.json();
            var renders = (sj && sj.renders) || [];
            // Prefer canonical mix_default; fall back to any other render.
            bestMix = renders.find(function(r) { return r.renderId === 'mix_default'; })
                   || renders[0]
                   || null;
        }
    } catch (e) { /* fall back to renderInfo or no-mix path */ }
    // If /status didn't surface a render but the player has one loaded,
    // use it. This catches sessions whose only render is a legacy
    // 'auto-<ts>' naming convention that didn't include renderId on the
    // R2 path level (newer renders have stable renderId keys).
    if (!bestMix && renderInfo && renderInfo.url) {
        bestMix = { url: renderInfo.url, fileName: renderInfo.fileName, renderId: renderInfo.renderId };
    }
    var hasMix = !!(bestMix && bestMix.url);
    // Default stem suggestion if no mix is available
    var defaultStem = p.tracks.find(function(t) { return (t.role || '').startsWith('vocal'); })
                    || p.tracks.find(function(t) { return t.role === 'kick'; })
                    || p.tracks.find(function(t) { return (_MT_ROLES[t.role] || {}).group === 'drums'; })
                    || p.tracks[0];
    if (!defaultStem && !hasMix) {
        if (typeof showToast === 'function') showToast('No tracks loaded');
        return;
    }

    var trackOptionsHtml = (p.tracks || []).map(function(t) {
        var label = (t.label || t.role) + (t.memberKey ? ' · ' + t.memberKey : '');
        var sel = (defaultStem && t.trackId === defaultStem.trackId) ? ' selected' : '';
        return '<option value="' + escHtml(t.trackId) + '"' + sel + '>' + escHtml(label) + '</option>';
    }).join('');

    // Cache best mix into player state so _mtAnalyzeRun can read it back.
    p._analyzeBestMix = bestMix || null;
    var mixLabel = (bestMix && bestMix.fileName) ? bestMix.fileName : 'rendered mix';

    // Source picker: radio between rendered-mix (when available) and
    // individual stem. Rendered mix is the safer default.
    var mixOptionHtml = hasMix
        ? '<label style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:rgba(99,102,241,0.10);border:1px solid rgba(99,102,241,0.35);border-radius:6px;margin-bottom:8px;cursor:pointer">'
            + '<input type="radio" name="mtAnalyzeSrcKind" value="mix" checked onclick="_mtAnalyzeSrcKindChanged()" style="margin-top:2px">'
            + '<div style="flex:1">'
            + '<div style="font-size:0.84em;font-weight:700;color:#c7d2fe">🎚 Rendered review mix <span style="font-weight:400;color:var(--text-dim);font-size:0.92em">(recommended)</span></div>'
            + '<div style="font-size:0.74em;color:var(--text-dim);margin-top:2px">' + escHtml(mixLabel) + ' — uses all instruments. Best segment quality.</div>'
            + '</div>'
            + '</label>'
        : '<div style="padding:8px 10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:6px;margin-bottom:8px;font-size:0.78em;color:#fbbf24">'
            + '⚠️ No rendered mix yet — analyzing a single stem will over-segment. Render the review mix first (it auto-runs on session open) for best results.'
            + '</div>';

    var stemOptionHtml = '<label style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;margin-bottom:12px;cursor:pointer">'
        + '<input type="radio" name="mtAnalyzeSrcKind" value="stem"' + (hasMix ? '' : ' checked') + ' onclick="_mtAnalyzeSrcKindChanged()" style="margin-top:2px">'
        + '<div style="flex:1">'
        + '<div style="font-size:0.84em;font-weight:700;color:#cbd5e1">🎵 Individual stem</div>'
        + '<div style="font-size:0.74em;color:var(--text-dim);margin-top:2px;margin-bottom:6px">Vocals work well (clean lyric-start markers). Avoid the kick — it drops out during normal play.</div>'
        + '<label for="mtAnalyzeStem" class="sr-only">Analysis source stem</label>'
        + '<select id="mtAnalyzeStem" name="mtAnalyzeStem" autocomplete="off" class="app-select" style="width:100%;font-size:0.88em"' + (hasMix ? ' disabled' : '') + '>' + trackOptionsHtml + '</select>'
        + '</div>'
        + '</label>';

    var pickerHtml = '<div id="mtAnalyzeModal" style="position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)">'
        + '<div style="max-width:460px;width:100%;background:#0f172a;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.08);position:relative">'
        + '<button onclick="_mtAnalyzeClose()" id="mtAnalyzeXBtn" title="Close (analysis keeps running)" style="position:absolute;top:10px;right:12px;background:none;border:none;color:#64748b;font-size:1.3em;cursor:pointer;padding:0 6px;line-height:1">×</button>'
        + '<div style="font-weight:800;font-size:1.05em;color:#f1f5f9;margin-bottom:8px;padding-right:24px">🎯 Analyze rehearsal for song boundaries</div>'
        + '<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:14px;line-height:1.4">Server-side segmentation engine detects song boundaries + setlist matches.</div>'
        + mixOptionHtml
        + stemOptionHtml
        + '<div id="mtAnalyzeStatus" style="font-size:0.78em;color:var(--text-dim);margin-bottom:12px;min-height:18px"></div>'
        + '<div style="display:flex;gap:8px;justify-content:flex-end">'
        + '<button onclick="_mtAnalyzeClose()" id="mtAnalyzeCancelBtn" class="btn btn-ghost btn-sm">Cancel</button>'
        + '<button id="mtAnalyzeGo" onclick="_mtAnalyzeRun()" class="btn btn-primary btn-sm">🎯 Run analysis</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    var existing = document.getElementById('mtAnalyzeModal');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.innerHTML = pickerHtml;
    document.body.appendChild(div.firstChild);

    // If an analysis is already running (user reopened the modal mid-run),
    // reflect that state: disable Run button, relabel Cancel → "Close
    // (keeps running)", populate the status div with the live progress
    // narrative, and disable the source picker (changing source mid-run
    // wouldn't affect the in-flight job).
    if (p._analyzeInFlight && p._analyzeInFlight.startedAt) {
        var goBtnEl = document.getElementById('mtAnalyzeGo');
        if (goBtnEl) { goBtnEl.disabled = true; goBtnEl.textContent = '⏳ Already analyzing…'; goBtnEl.style.opacity = '0.6'; }
        var cancelBtnEl = document.getElementById('mtAnalyzeCancelBtn');
        if (cancelBtnEl) cancelBtnEl.textContent = 'Close (keeps running)';
        // Replace the simple text status with the rich phase timeline.
        var statusEl = document.getElementById('mtAnalyzeStatus');
        if (statusEl) {
            statusEl.style.minHeight = '0';
            statusEl.innerHTML = _mtRenderAnalyzeProgressHtml(p._analyzeInFlight);
        }
        // Disable both source radios + the stem select so they're not
        // accidentally toggled (they have no effect on the in-flight job).
        document.querySelectorAll('input[name="mtAnalyzeSrcKind"]').forEach(function(r) { r.disabled = true; });
        var stemSelEl = document.getElementById('mtAnalyzeStem');
        if (stemSelEl) stemSelEl.disabled = true;
    }
};

// Toggle the stem-select enabled state based on which radio is checked.
window._mtAnalyzeSrcKindChanged = function() {
    var mixRadio = document.querySelector('input[name="mtAnalyzeSrcKind"][value="mix"]');
    var stemSel = document.getElementById('mtAnalyzeStem');
    if (!stemSel) return;
    stemSel.disabled = !!(mixRadio && mixRadio.checked);
};

window._mtAnalyzeClose = function() {
    var el = document.getElementById('mtAnalyzeModal');
    if (el) el.remove();
};

window._mtAnalyzeRun = async function() {
    var p = _mtState.player;
    if (!p) return;
    var status = document.getElementById('mtAnalyzeStatus');
    var goBtn = document.getElementById('mtAnalyzeGo');

    // Decide source. Radio picker: 'mix' or 'stem'.
    var mixRadio = document.querySelector('input[name="mtAnalyzeSrcKind"][value="mix"]');
    var useMix = !!(mixRadio && mixRadio.checked);
    var sourceUrl = null;
    var sourceLabel = '';
    var sourceStemId = '';
    var sourceStemRole = null;
    if (useMix) {
        var mix = p._analyzeBestMix || (p.renderInfo && p.renderInfo.url ? p.renderInfo : null);
        if (!mix || !mix.url) {
            if (status) status.textContent = 'Rendered mix unavailable — pick a stem instead';
            return;
        }
        sourceUrl = mix.url;
        sourceLabel = mix.fileName || 'rendered review mix';
        sourceStemId = mix.renderId || 'mix_default';
    } else {
        var sel = document.getElementById('mtAnalyzeStem');
        if (!sel || !sel.value) return;
        var track = (p.tracks || []).find(function(t) { return t.trackId === sel.value; });
        if (!track || !track.stemUrl) {
            if (status) status.textContent = 'Selected stem has no URL';
            return;
        }
        sourceUrl = track.stemUrl;
        sourceLabel = track.label || track.role;
        sourceStemId = track.trackId;
        sourceStemRole = track.role || null;
    }

    if (goBtn) { goBtn.disabled = true; goBtn.textContent = '⏳ Submitting…'; }
    if (status) status.textContent = 'Submitting ' + sourceLabel + ' to server segmenter…';

    var workerBase = (typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev');
    // Best-effort setlist context for song matching — same helper the
    // chopper uses. Falls back to empty if not loaded yet.
    var setlist = [];
    try {
        if (typeof _chopBuildSetlistContext === 'function') {
            setlist = _chopBuildSetlistContext() || [];
        }
    } catch (e) {}
    // Phase 3 — fingerprint priors. Fetch the band's confirmed-segment
    // corpus from bands/{slug}/song_fingerprints/* and shape into priors
    // the analyzer can use to bias matching. Failure = priors stay empty,
    // analyzer falls back to setlist-only matching.
    var fingerprintPriors = [];
    try {
        fingerprintPriors = await _mtFetchFingerprintPriors();
    } catch (e) {
        console.warn('[Multitrack] fingerprint priors fetch failed (continuing without):', e && e.message);
    }

    // Phase 4C — plan priors. Songs explicitly on today's rehearsal
    // plan + the next upcoming gig setlist. Boosted 1.5× in the
    // analyzer so the user's intent dominates ambiguous matches.
    // Independent of fingerprint priors (a song can be on both).
    var planPriors = [];
    try {
        planPriors = await _mtFetchPlanPriors(p.session);
    } catch (e) {
        console.warn('[Multitrack] plan priors fetch failed (continuing without):', e && e.message);
    }

    // Generate a short opaque progress_id so Modal can stash per-phase
    // markers in a shared Dict keyed by this ID. The browser polls /check
    // with the same ID to get ground-truth phase narration instead of
    // the elapsed-time heuristic. Format: alnum + dash, ≤80 chars
    // (Modal-side validates this shape).
    var progressId = 'pg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    try {
        var startRes = await fetch(workerBase + '/rehearsal-segment/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                songId: p.sessionId,
                sourceUrl: sourceUrl,
                setlist: setlist,
                progressId: progressId,
                fingerprintPriors: fingerprintPriors,
                planPriors: planPriors,
            })
        });
        var startJson = await startRes.json();
        if (!startRes.ok || !startJson || !startJson.success || !startJson.call_id) {
            throw new Error((startJson && startJson.error) || ('HTTP ' + startRes.status));
        }
        var callId = startJson.call_id;
        if (goBtn) goBtn.textContent = '⏳ Analyzing…';
        // Once the Modal job is spawned, "Cancel" is misleading — clicking
        // it only dismisses the modal locally; the GPU/CPU job keeps
        // running. Relabel to make that clear.
        var cancelBtn = document.getElementById('mtAnalyzeCancelBtn');
        if (cancelBtn) cancelBtn.textContent = 'Close (keeps running)';
        // Persist in-flight state so the Segments panel (and any other
        // surface) can show progress even after the modal closes. Cleared
        // in the success / error blocks below.
        p._analyzeInFlight = {
            callId: callId,
            progressId: progressId,
            startedAt: Date.now(),
            sourceLabel: sourceLabel,
            sourceUrl: sourceUrl,
            // Latest ground-truth phase from server (set by check polls).
            // Falls back to the elapsed-time heuristic when null.
            serverPhase: null,
        };
        // Trigger an immediate panel render so the user sees the in-flight
        // banner even if they close the modal right away.
        if (typeof _mtRenderSegmentsPanel === 'function') _mtRenderSegmentsPanel();

        // 30-minute poll budget — matches the chopper's server-analyze
        // implementation. A 4h rehearsal segments in ~10 min; the slack
        // covers cold Modal containers + queue waits.
        var result = null;
        for (var attempt = 0; attempt < 360; attempt++) {
            await new Promise(function(r) { setTimeout(r, 5000); });
            // Bail if the user closed the player entirely (new session opened, etc).
            if (!_mtState.player || _mtState.player.sessionId !== p.sessionId) {
                console.log('[Multitrack] analyze: player gone, abandoning polling');
                return;
            }
            // Update modal status if it's still open. If the modal was
            // reopened mid-run, the status div holds the rich phase
            // timeline — re-render it. Otherwise replace plain text.
            var statusEl = document.getElementById('mtAnalyzeStatus');
            if (statusEl && _mtState.player && _mtState.player._analyzeInFlight) {
                statusEl.innerHTML = _mtRenderAnalyzeProgressHtml(_mtState.player._analyzeInFlight);
                statusEl.style.minHeight = '0';
            }
            // Re-render segments panel so its in-flight banner ticks.
            if (typeof _mtRenderSegmentsPanel === 'function') _mtRenderSegmentsPanel();

            var checkRes = await fetch(workerBase + '/rehearsal-segment/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ call_id: callId, progressId: progressId })
            });
            var checkJson = await checkRes.json();
            if (!checkJson || !checkJson.success) {
                throw new Error((checkJson && checkJson.error) || 'check_failed');
            }
            // Stash server-emitted phase if present so the renderer can
            // prefer it over the heuristic. Cleared automatically when
            // the next render runs against an in-flight state.
            if (checkJson.progress && _mtState.player && _mtState.player._analyzeInFlight) {
                _mtState.player._analyzeInFlight.serverPhase = checkJson.progress;
            }
            if (checkJson.status === 'processing') continue;
            result = checkJson;
            break;
        }
        if (!result) throw new Error('server analysis timed out after 30 min');

        // Translate the server's snake_case segment shape into the
        // camelCase shape _mtLoadSegments + _mtCollectSongSegments expect.
        // Persist to rehearsal_sessions/{sid}/analysis/story so the existing
        // load path reads it cleanly.
        var serverSegs = Array.isArray(result.segments) ? result.segments : [];
        var converted = serverSegs.map(function(s, i) {
            return {
                id: s.id || ('seg_' + i),
                startSec: s.start_sec,
                endSec: s.end_sec,
                durationSec: s.duration_sec,
                kind: s.kind || null,
                label: (s.likely_song && s.likely_song.title) || s.kind || 'segment',
                confidence: s.confidence,
                evidence: s.evidence || null,
                bpm: s.bpm || null,
                key: s.key || null,
                likelySong: s.likely_song || null,
                likelyRestart: !!s.likely_restart,
                // Phase 3 — provenance from analyzer: how this match was found.
                provenance: s.provenance || null,
            };
        });
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function') {
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/analysis/story')).set({
                segments: converted,
                summary: result.summary || {},
                durationSec: result.duration_sec || null,
                // Lightweight RMS peaks (~2000 buckets across the full
                // rehearsal) for the Segments panel waveform strips. NOT
                // zoomable DAW data — purely a navigation aid.
                peaks: Array.isArray(result.peaks) ? result.peaks : [],
                peaksCount: result.peaks_count || (Array.isArray(result.peaks) ? result.peaks.length : 0),
                sourceStemId: sourceStemId,
                sourceStemRole: sourceStemRole,
                analyzedAt: new Date().toISOString(),
                analyzer: 'modal_segment_endpoint',
            });
        }
        if (status) status.textContent = '✓ Detected ' + converted.length + ' segments. Loading…';
        // Clear in-flight state BEFORE re-rendering so the panel shows the
        // segment rows, not the in-flight banner.
        if (_mtState.player && _mtState.player.sessionId === p.sessionId) {
            _mtState.player._analyzeInFlight = null;
        }
        await _mtLoadSegments(p.sessionId);
        _mtRenderSegmentMarkers();
        _mtRenderSegmentsPanel();
        if (typeof showToast === 'function') {
            var n = (p.segments || []).length;
            var s = result.summary || {};
            var detail = (s.music_segments ? s.music_segments + ' music · ' : '')
                       + (s.matched_to_setlist ? s.matched_to_setlist + ' matched to setlist' : '');
            showToast('✓ ' + n + ' segments via server analyzer' + (detail ? ' (' + detail + ')' : ''), 6000);
        }
        _mtAnalyzeClose();
        // If Custom Mix triggered this Analyze run, reopen it so the
        // songs-only checkbox is now enabled.
        if (p._reopenCmxAfterAnalyze) {
            p._reopenCmxAfterAnalyze = false;
            if (typeof window._mtOpenCustomMixModal === 'function') {
                setTimeout(function() { window._mtOpenCustomMixModal(); }, 100);
            }
        }
    } catch (e) {
        console.error('[Multitrack] server analyze failed:', e);
        if (status) status.textContent = '✗ ' + (e.message || 'analysis failed');
        if (goBtn) { goBtn.disabled = false; goBtn.textContent = '🎯 Retry'; }
        // Clear in-flight state on error and refresh the panel so it
        // returns to the empty-state with Analyze button.
        if (_mtState.player && _mtState.player.sessionId === p.sessionId) {
            _mtState.player._analyzeInFlight = null;
            if (typeof _mtRenderSegmentsPanel === 'function') _mtRenderSegmentsPanel();
        }
    }
};

// ── Segments loading + naming ──────────────────────────────────────────────
async function _mtLoadSegments(sessionId) {
    var p = _mtState.player;
    if (!p || p.sessionId !== sessionId) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        // Segments live under rehearsal_sessions/{sid}/analysis/segments
        // (the existing pipeline writes there). For multitrack-specific
        // overrides (named songs, between-song flags) we also overlay
        // rehearsal_sessions/{sid}/multitrackSegments.
        var snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/analysis')).once('value');
        var analysis = snap.val();
        var segs = [];
        // Lightweight waveform peaks for the Segments panel (server
        // precomputed during analysis). One array per session; each
        // segment row slices it to draw its own thin strip.
        if (analysis && analysis.story && Array.isArray(analysis.story.peaks)) {
            p.peaks = analysis.story.peaks;
            p.peaksDurationSec = analysis.story.durationSec || 0;
        } else {
            p.peaks = [];
            p.peaksDurationSec = 0;
        }
        if (analysis && analysis.story && Array.isArray(analysis.story.segments)) {
            segs = analysis.story.segments.slice();
        } else if (analysis && analysis.v2Result && Array.isArray(analysis.v2Result.events)) {
            // Older pipeline shape — convert events into segment-like objects
            segs = analysis.v2Result.events.map(function(ev, i) {
                return {
                    id: 'ev_' + i,
                    startSec: ev.startSec || ev.time || 0,
                    endSec: ev.endSec || ev.time + (ev.duration || 0),
                    label: ev.label || 'segment',
                    confidence: ev.confidence || null
                };
            });
        }
        // Overlay multitrack-specific renames + between flags
        var overlaySnap = await db.ref(bandPath('rehearsal_sessions/' + sessionId + '/multitrackSegments')).once('value');
        var overlay = overlaySnap.val() || {};
        segs.forEach(function(s) {
            if (overlay[s.id]) {
                if (overlay[s.id].songTitle) s.songTitle = overlay[s.id].songTitle;
                if (typeof overlay[s.id].isBetween === 'boolean') s.isBetween = overlay[s.id].isBetween;
                if (overlay[s.id].startSec != null) s.startSec = overlay[s.id].startSec;
                if (overlay[s.id].endSec != null) s.endSec = overlay[s.id].endSec;
                // Phase 1E: user review state. 'confirmed' | 'needs-review' |
                // 'excluded' | undefined (= unconfirmed, derived from kind+conf).
                if (overlay[s.id].reviewState) s.reviewState = overlay[s.id].reviewState;
                if (overlay[s.id].confirmedAt) s.confirmedAt = overlay[s.id].confirmedAt;
                if (overlay[s.id].confirmedBy) s.confirmedBy = overlay[s.id].confirmedBy;
                // Phase 1C: canonical Song DNA link. When the user picks
                // (or types) a song from allSongs, we resolve to the
                // band's songId so future fingerprint training can key
                // off it directly. Title remains the user-facing string.
                if (overlay[s.id].songId) s.songId = overlay[s.id].songId;
                // Phase 2D: user kind override (Song / Chatter / Transition
                // via S/C/T keys, or kind change via UI). Distinct from
                // seg.kind which preserves the analyzer's original verdict.
                // _mtSegmentEffectiveKind resolves userKind → kind fallback.
                if (overlay[s.id].userKind) s.userKind = overlay[s.id].userKind;
            }
        });
        p.segments = segs;
    } catch (e) {
        console.warn('[Multitrack] segments load failed:', e && e.message);
        p.segments = [];
    }
}

// ── Segments panel — rehearsal navigation intelligence ─────────────────────
// Lightweight inline list of analyzed segments with thin waveform strips
// per row. Renders from p.segments (Firebase-loaded) + p.peaks (server
// precomputed RMS downsample). NOT a DAW: waveforms are a navigation
// aid only — no zoom, no sample-accurate editing. Independent from
// playback synchronization. Drew's product principle 2026-05-24:
// "rehearsal navigation intelligence, not waveform editing software."
function _mtKindMeta(kind) {
    // stripe = the 4px left bar that color-codes each row by kind.
    // stripBg/stripFg = subtle row tint + waveform fill color.
    // 'transition' is a Tier 2 USER-only kind (server emits music/speech/
    // silence only). Used for jams, intros, segues that aren't a
    // standalone song but aren't chatter either.
    switch ((kind || '').toLowerCase()) {
        case 'music':      return { emoji: '🎵', color: '#a5b4fc', name: 'song',       stripe: '#6366f1', stripBg: 'rgba(99,102,241,0.10)', stripFg: 'rgba(165,180,252,0.85)' };
        case 'silence':    return { emoji: '🤫', color: '#94a3b8', name: 'silence',    stripe: '#64748b', stripBg: 'rgba(100,116,139,0.05)', stripFg: 'rgba(148,163,184,0.4)' };
        case 'speech':     return { emoji: '💬', color: '#fbbf24', name: 'speech',     stripe: '#f59e0b', stripBg: 'rgba(245,158,11,0.07)', stripFg: 'rgba(252,211,77,0.75)' };
        case 'transition': return { emoji: '🌀', color: '#d8b4fe', name: 'transition', stripe: '#a855f7', stripBg: 'rgba(168,85,247,0.10)', stripFg: 'rgba(216,180,254,0.85)' };
        default:           return { emoji: '·',  color: '#94a3b8', name: 'segment',    stripe: '#94a3b8', stripBg: 'rgba(148,163,184,0.05)', stripFg: 'rgba(203,213,225,0.55)' };
    }
}

// Tier 2 + 5C — Effective kind, factoring in user override (`userKind`)
// stored in the multitrackSegments overlay. Server-emitted kind stays
// untouched in seg.kind for analyzer-audit purposes; this helper is the
// single source of truth for display + songs-only filtering.
function _mtSegmentEffectiveKind(seg) {
    if (!seg) return null;
    if (seg.userKind) return seg.userKind;
    return seg.kind || null;
}

// Tier 1A — Detection confidence blended from analyzer kind-confidence
// + song-match confidence (when present). 0-1 float.
function _mtSegmentConfidence(seg) {
    if (!seg) return 0;
    var kindConf = (typeof seg.confidence === 'number') ? seg.confidence : 0;
    if (seg.kind === 'music' && seg.likelySong && typeof seg.likelySong.confidence === 'number') {
        // Weighted blend — match confidence dominates because that's the
        // claim being shown to the user (the song title).
        return Math.max(0, Math.min(1, kindConf * 0.4 + seg.likelySong.confidence * 0.6));
    }
    return Math.max(0, Math.min(1, kindConf));
}

// Tier 1B — Safe fallback display name. Returns { title, placeholder,
// kind: 'confirmed' | 'matched' | 'possible' | 'unidentified' | 'kind' }.
// Never auto-shows a real song name when confidence is low — replaces
// with neutral fallbacks so the AI doesn't lie about certainty.
//
// Threshold bumped 0.65 → 0.75 (Phase 4B, 2026-05-24). ChatGPT's review
// frame: "wrong confident naming damages trust more than 'I'm not sure'."
// At 65% we were auto-asserting song titles for matches the analyzer
// itself thought were 35% likely to be wrong. At 75% the assertion bar
// is meaningfully higher; 65-74% matches now surface as
// "Possible: ..." placeholders the user must explicitly confirm.
var _MT_SAFE_TITLE_THRESHOLD = 0.75;
function _mtSegmentDisplayName(seg) {
    if (!seg) return { title: '', placeholder: 'Segment', kind: 'unidentified' };
    if (seg.songTitle) return { title: seg.songTitle, placeholder: 'Song title', kind: 'confirmed' };
    var effKind = _mtSegmentEffectiveKind(seg);
    if (effKind === 'music') {
        if (seg.likelySong && seg.likelySong.title && typeof seg.likelySong.confidence === 'number') {
            if (seg.likelySong.confidence >= _MT_SAFE_TITLE_THRESHOLD) {
                return { title: seg.likelySong.title, placeholder: 'Song title', kind: 'matched' };
            }
            return {
                title: '',
                placeholder: 'Possible: ' + seg.likelySong.title + ' (' + Math.round(seg.likelySong.confidence * 100) + '%) — type to confirm',
                kind: 'possible',
            };
        }
        return { title: '', placeholder: 'Unidentified Song — type to label', kind: 'unidentified' };
    }
    if (effKind === 'transition') return { title: '', placeholder: 'Transition / Jam — type to label', kind: 'kind' };
    if (effKind === 'speech')     return { title: '', placeholder: 'Chatter / Speech', kind: 'kind' };
    if (effKind === 'silence')    return { title: '', placeholder: 'Silence', kind: 'kind' };
    return { title: '', placeholder: 'Unidentified Segment', kind: 'unidentified' };
}

// Tier 1E — Review state. Derived from explicit user input (reviewState
// or isBetween overlay) + low-confidence auto-flag. Returns one of:
//   'confirmed' | 'needs-review' | 'excluded' | 'unconfirmed'
function _mtSegmentReviewState(seg) {
    if (!seg) return 'unconfirmed';
    if (seg.reviewState === 'confirmed') return 'confirmed';
    if (seg.reviewState === 'excluded' || seg.isBetween) return 'excluded';
    if (seg.reviewState === 'needs-review') return 'needs-review';
    // Auto-flag: low-confidence music or fully unmatched music → needs review.
    if (_mtSegmentEffectiveKind(seg) === 'music') {
        var conf = _mtSegmentConfidence(seg);
        if (conf < 0.55) return 'needs-review';
    }
    return 'unconfirmed';
}

// ── Musical moment markers (UX convergence pass 2026-05-25, P3) ────────────
// Lightweight per-segment flags. NOT a task system. NOT a comment system.
// NOT routed to PracticeTask or annotations yet — pure visual layer that
// prevents review comments from collapsing into generic note blobs. Per
// founder UX review: "during review I need ⭐ Important / ⚠ Needs work /
// 🎤 Harmony / 🥁 Timing / 🎸 Cue — otherwise everything becomes generic
// comments." Future convergence: these flag keys are the seed vocabulary
// that a future annotation/task model can promote to typed work items.
//
// Schema: multitrackSegments/{segId}/markers: { important?, needsWork?,
// harmony?, timing?, cue? } — sparse map, only set keys persisted.
var _MT_MARKER_DEFS = [
    { key: 'important', emoji: '⭐', label: 'Important moment',           color: '#fbbf24', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.45)' },
    { key: 'needsWork', emoji: '⚠',  label: 'Needs work',                 color: '#fca5a5', bg: 'rgba(239,68,68,0.18)',  border: 'rgba(239,68,68,0.45)' },
    { key: 'harmony',   emoji: '🎤', label: 'Harmony moment',             color: '#a5b4fc', bg: 'rgba(99,102,241,0.18)', border: 'rgba(99,102,241,0.45)' },
    { key: 'timing',    emoji: '🥁', label: 'Timing / pocket',            color: '#86efac', bg: 'rgba(34,197,94,0.18)',  border: 'rgba(34,197,94,0.45)' },
    { key: 'cue',       emoji: '🎸', label: 'Cue / instrument moment',    color: '#d8b4fe', bg: 'rgba(168,85,247,0.18)', border: 'rgba(168,85,247,0.45)' },
];

function _mtSegmentMarkers(seg) {
    return (seg && seg.markers && typeof seg.markers === 'object') ? seg.markers : {};
}

function _mtSegmentMarkerSummary(seg) {
    var m = _mtSegmentMarkers(seg);
    var out = '';
    _MT_MARKER_DEFS.forEach(function(def) { if (m[def.key]) out += def.emoji; });
    return out;
}

window._mtSegmentToggleMarker = async function(idx, key) {
    var p = _mtState.player;
    if (!p || !Array.isArray(p.segments)) return;
    var seg = p.segments[idx];
    if (!seg) return;
    var def = _MT_MARKER_DEFS.find(function(d) { return d.key === key; });
    if (!def) return;
    if (!seg.markers || typeof seg.markers !== 'object') seg.markers = {};
    var was = !!seg.markers[key];
    if (was) delete seg.markers[key];
    else seg.markers[key] = true;
    // Persist to multitrackSegments overlay (canonical write path — same
    // pattern as _mtSegmentConfirm / _mtSegmentToggleBetween).
    try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function' && seg.id) {
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/multitrackSegments/' + seg.id))
                .update({ markers: seg.markers, updatedAt: new Date().toISOString() });
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('Marker save failed — try again');
        // Roll back local state on persist failure
        if (was) seg.markers[key] = true; else delete seg.markers[key];
    }
    _mtRenderSegmentsPanel();
};

// Phase 4B (trust engineering) — solid confidence chips. The old
// tinted-bg + tinted-text chips made a 47% guess and a 96% match read
// nearly the same color, which is the worst possible UX for trust:
// users either over-trust low-conf matches or stop trusting the
// analyzer entirely. Solid backgrounds with high-contrast text make the
// distinction visually unambiguous from across the panel.
function _mtConfidenceChipHtml(conf) {
    if (!conf || conf < 0.05) return '';
    var pct = Math.round(conf * 100);
    var color, bg, border;
    if (pct >= 75)      { color = '#ffffff'; bg = '#16a34a'; border = '#15803d'; }    // SOLID green
    else if (pct >= 50) { color = '#451a03'; bg = '#fbbf24'; border = '#f59e0b'; }    // SOLID amber
    else                { color = '#ffffff'; bg = '#dc2626'; border = '#b91c1c'; }    // SOLID red
    return '<span title="Detection confidence" style="background:' + bg + ';border:1px solid ' + border + ';color:' + color + ';border-radius:3px;padding:1px 6px;font-size:0.72em;font-weight:800;font-family:ui-monospace,monospace;letter-spacing:0.02em">' + pct + '%</span>';
}

// Tier 1C — Build a single <datalist> from the band's canonical Song
// DNA library (allSongs). Title inputs reference it via list="...".
// Browsers handle the typeahead UI natively — no popper, no custom
// dropdown, no library. Songs are deduped + sorted alphabetically.
var _MT_SONGS_DATALIST_ID = 'mtSongTitlesDatalist';
function _mtSongsDatalistHtml() {
    var songs = (typeof allSongs !== 'undefined' && Array.isArray(allSongs)) ? allSongs : [];
    var titles = {};
    songs.forEach(function(s) {
        var t = (s && s.title) ? String(s.title).trim() : '';
        if (t) titles[t] = true;
    });
    var sorted = Object.keys(titles).sort(function(a, b) { return a.localeCompare(b); });
    return '<datalist id="' + _MT_SONGS_DATALIST_ID + '">'
        + sorted.map(function(t) { return '<option value="' + escHtml(t) + '">'; }).join('')
        + '</datalist>';
}

function _mtFmtTimeShort(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
}

// Slice the session's global peaks array down to the segment's time
// range, then RMS-downsample to a fixed bucket count for the strip canvas.
function _mtPeaksForSegment(peaks, durationSec, startSec, endSec, outBuckets) {
    if (!Array.isArray(peaks) || !peaks.length || !durationSec || durationSec <= 0) return [];
    var n = peaks.length;
    var pStart = Math.max(0, Math.floor((startSec / durationSec) * n));
    var pEnd = Math.min(n, Math.ceil((endSec / durationSec) * n));
    if (pEnd <= pStart) return [];
    var slice = peaks.slice(pStart, pEnd);
    // Re-bucket the slice into outBuckets evenly. Each output bucket is the
    // MAX of its input range (peaky look beats RMS-of-RMS for visual cues).
    var out = new Array(outBuckets);
    for (var i = 0; i < outBuckets; i++) {
        var aStart = Math.floor((i / outBuckets) * slice.length);
        var aEnd = Math.floor(((i + 1) / outBuckets) * slice.length);
        if (aEnd <= aStart) aEnd = aStart + 1;
        var mx = 0;
        for (var j = aStart; j < aEnd && j < slice.length; j++) {
            if (slice[j] > mx) mx = slice[j];
        }
        out[i] = mx;
    }
    // Normalize against this segment's own max so quiet segments still
    // show some shape (instead of looking flat when the overall rehearsal
    // had a single loud section). Falls back to absolute if max is 0.
    var localMax = 0;
    for (var k = 0; k < out.length; k++) if (out[k] > localMax) localMax = out[k];
    if (localMax > 0) {
        for (var k2 = 0; k2 < out.length; k2++) out[k2] = out[k2] / localMax;
    }
    return out;
}

// Paint a single segment's waveform strip into a canvas. Bars from center,
// thin spacing. Drew's constraint: lightweight navigation aid only.
function _mtDrawSegmentStrip(canvas, buckets, color) {
    if (!canvas) return;
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!buckets.length) return;
    ctx.fillStyle = color;
    var barW = Math.max(1, Math.floor(w / buckets.length) - 1);
    for (var i = 0; i < buckets.length; i++) {
        var v = buckets[i];
        if (!isFinite(v) || v <= 0) continue;
        var barH = Math.max(1, Math.round(v * (h - 2)));
        var x = Math.floor((i / buckets.length) * w);
        var y = Math.floor((h - barH) / 2);
        ctx.fillRect(x, y, barW, barH);
    }
}

// ── Server-analyze phase narration ─────────────────────────────────────────
// Heuristic mapping from elapsed-seconds to the phase segment_audio is
// likely in. Phases mirror the actual computation in segment.py
// (download → decode → RMS → silence → classify → musical analysis →
// setlist match → restart detection → peaks → wrap). The boundaries are
// empirical-ish — they assume a ~3h rehearsal. Smaller jobs collapse the
// later phases quickly; bigger jobs stay in musical analysis longer.
// Not exact, but communicates the real work happening.
var _MT_ANALYZE_PHASES = [
    { id: 'download',   emoji: '⬇️', label: 'Downloading rendered mix from R2 to Modal worker',          thresh: 25  },
    { id: 'decode',     emoji: '🎧', label: 'Decoding audio into PCM frames (mono @ 16 kHz)',           thresh: 50  },
    { id: 'envelope',   emoji: '📊', label: 'Computing RMS energy envelope across the timeline',         thresh: 75  },
    { id: 'silence',    emoji: '🤫', label: 'Detecting silence spans (≥ 2.5 s gaps)',                    thresh: 95  },
    { id: 'candidates', emoji: '✂️', label: 'Building candidate segments from silence boundaries',       thresh: 115 },
    { id: 'classify',   emoji: '🧠', label: 'Classifying segments — music vs. speech vs. silence',       thresh: 165 },
    { id: 'musical',    emoji: '🎼', label: 'Running musical analysis (BPM, key, energy) on music segments', thresh: 300 },
    { id: 'setlist',    emoji: '🎯', label: 'Matching segments to band setlist by BPM/key/duration',     thresh: 325 },
    { id: 'restarts',   emoji: '🔁', label: 'Detecting song restarts via pairwise spectral similarity',  thresh: 345 },
    { id: 'peaks',      emoji: '〰️', label: 'Generating waveform peaks for visual scanning',             thresh: 365 },
    { id: 'wrap',       emoji: '⏳', label: 'Finalizing segment list + summary',                         thresh: Infinity },
];

function _mtCurrentAnalyzePhaseIdx(elapsedSec) {
    for (var i = 0; i < _MT_ANALYZE_PHASES.length; i++) {
        if (elapsedSec < _MT_ANALYZE_PHASES[i].thresh) return i;
    }
    return _MT_ANALYZE_PHASES.length - 1;
}

// Find the phase index whose id matches the server-emitted phase id.
// Returns -1 if no match (fall back to heuristic).
function _mtAnalyzePhaseIdxById(phaseId) {
    if (!phaseId) return -1;
    for (var i = 0; i < _MT_ANALYZE_PHASES.length; i++) {
        if (_MT_ANALYZE_PHASES[i].id === phaseId) return i;
    }
    return -1;
}

function _mtRenderAnalyzeProgressHtml(inFlight) {
    var elapsedSec = Math.max(0, Math.round((Date.now() - inFlight.startedAt) / 1000));
    var elapsedLabel = elapsedSec < 60
        ? elapsedSec + 's'
        : Math.floor(elapsedSec / 60) + 'm ' + String(elapsedSec % 60).padStart(2, '0') + 's';
    // Prefer ground-truth server phase when available, fall back to the
    // elapsed-time heuristic. Browser stamps a small "live"/"est" badge so
    // it's honest about which source the user is seeing.
    var totalCount = _MT_ANALYZE_PHASES.length;
    var curIdx;
    var sourceBadge;
    if (inFlight.serverPhase && inFlight.serverPhase.phase) {
        var serverIdx = _mtAnalyzePhaseIdxById(inFlight.serverPhase.phase);
        if (serverIdx >= 0) {
            curIdx = serverIdx;
            sourceBadge = '<span title="Ground-truth phase emitted by the Modal worker" style="background:rgba(34,197,94,0.18);color:#86efac;border:1px solid rgba(34,197,94,0.35);border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700;margin-left:6px">LIVE</span>';
        } else {
            // Server emitted an unknown phase id — fall back to heuristic.
            curIdx = _mtCurrentAnalyzePhaseIdx(elapsedSec);
            sourceBadge = '<span title="Server phase id not in browser map — using elapsed-time estimate" style="background:rgba(245,158,11,0.18);color:#fbbf24;border:1px solid rgba(245,158,11,0.35);border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700;margin-left:6px">EST</span>';
        }
    } else {
        // No server phase data — either the Modal deploy doesn't emit yet
        // (older build), or the first marker hasn't landed yet.
        curIdx = _mtCurrentAnalyzePhaseIdx(elapsedSec);
        sourceBadge = '<span title="Elapsed-time heuristic — server hasn\'t reported a phase yet" style="background:rgba(148,163,184,0.15);color:var(--text-dim);border:1px solid rgba(148,163,184,0.25);border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700;margin-left:6px">EST</span>';
    }
    var doneCount = curIdx;

    // Show 3-line phase strip: previous (done) → current (animated) → next (pending).
    function phaseLine(phase, state) {
        // state: 'done' | 'current' | 'pending'
        var icon, opacity, weight, color;
        if (state === 'done') {
            icon = '✓';
            opacity = '0.55';
            weight = '500';
            color = '#86efac';
        } else if (state === 'current') {
            icon = '▶';
            opacity = '1';
            weight = '700';
            color = '#c7d2fe';
        } else {
            icon = '○';
            opacity = '0.4';
            weight = '500';
            color = 'var(--text-dim)';
        }
        return '<div style="display:flex;align-items:center;gap:8px;font-size:0.78em;opacity:' + opacity + '">'
            + '<span style="color:' + color + ';font-family:ui-monospace,monospace;width:14px;text-align:center">' + icon + '</span>'
            + '<span style="font-size:1em">' + phase.emoji + '</span>'
            + '<span style="color:' + color + ';font-weight:' + weight + '">' + escHtml(phase.label) + '</span>'
            + '</div>';
    }

    var prevHtml = curIdx > 0 ? phaseLine(_MT_ANALYZE_PHASES[curIdx - 1], 'done') : '';
    var curHtml = phaseLine(_MT_ANALYZE_PHASES[curIdx], 'current');
    var nextHtml = (curIdx + 1 < totalCount) ? phaseLine(_MT_ANALYZE_PHASES[curIdx + 1], 'pending') : '';

    // Progress bar — fraction of phases done.
    var progressPct = Math.round((doneCount / totalCount) * 100);

    return '<div style="padding:12px 14px;border:1px solid rgba(99,102,241,0.3);border-radius:8px;background:linear-gradient(180deg,rgba(99,102,241,0.10),rgba(99,102,241,0.04));font-size:0.78em;color:#c7d2fe">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        + '<span style="font-size:1.15em">🎯</span>'
        + '<div style="flex:1">'
        + '<div style="font-weight:700;font-size:0.95em">Server-side rehearsal analysis' + sourceBadge + '</div>'
        + '<div style="font-size:0.88em;color:var(--text-dim);margin-top:2px">Source: ' + escHtml(inFlight.sourceLabel || 'rendered mix') + ' · ' + escHtml(elapsedLabel) + ' elapsed · phase ' + (curIdx + 1) + ' of ' + totalCount + '</div>'
        + '</div>'
        + '<button onclick="_mtAnalyzeRehearsal()" title="Reopen Analyze modal" style="background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);border-radius:5px;color:#a5b4fc;padding:4px 10px;cursor:pointer;font-size:0.72em;font-weight:700">📊 Modal</button>'
        + '</div>'
        // Animated progress strip
        + '<div style="height:6px;background:rgba(255,255,255,0.04);border-radius:3px;overflow:hidden;margin-bottom:10px">'
        + '<div style="width:' + progressPct + '%;height:100%;background:linear-gradient(90deg,#667eea,#764ba2);transition:width 1s ease"></div>'
        + '</div>'
        // 3-line phase strip
        + '<div style="display:flex;flex-direction:column;gap:4px;padding:8px 10px;background:rgba(15,23,42,0.5);border-radius:6px">'
        + prevHtml
        + curHtml
        + nextHtml
        + '</div>'
        + '<div style="margin-top:8px;font-size:0.74em;color:var(--text-dim);font-style:italic">Safe to navigate away — segments will appear here when done.</div>'
        + '</div>';
}

// Short-silence toggle — used inside the Silence group header to flip
// between "30s+ only" and "show all" once the user opts into Silence.
window._mtSegmentsToggleShorts = function() {
    var p = _mtState.player;
    var el = document.getElementById('mtSegShowShorts');
    if (!p) return;
    p._showShortSilences = !!(el && el.checked);
    _mtRenderSegmentsPanel();
};

// Hint dismissal persists across sessions in localStorage. After first
// dismiss, the panel header shows a small ? button to bring it back.
window._mtSegmentsHintDismiss = function() {
    try { localStorage.setItem('mtSegmentsHintDismissed', '1'); } catch(_) {}
    _mtRenderSegmentsPanel();
};
window._mtSegmentsHintShow = function() {
    try { localStorage.removeItem('mtSegmentsHintDismissed'); } catch(_) {}
    _mtRenderSegmentsPanel();
};

// Phase 4A — filter pills toggle. Multi-select: each pill is an
// independent include. Default config seeded inside _mtRenderSegmentsPanel
// when player state is fresh (Songs ON + Needs Review ON, others OFF).
window._mtSegFilterToggle = function(key) {
    var p = _mtState.player;
    if (!p || !p._segFilters) return;
    p._segFilters[key] = !p._segFilters[key];
    _mtRenderSegmentsPanel();
};

// Phase 4A — collapsible group toggle. Persists per-player in
// _segGroupsOpen so collapsing the noise stays collapsed across re-renders.
window._mtSegGroupToggle = function(key) {
    var p = _mtState.player;
    if (!p || !p._segGroupsOpen) return;
    p._segGroupsOpen[key] = !p._segGroupsOpen[key];
    _mtRenderSegmentsPanel();
};

window._mtToggleSegmentsPanel = function() {
    var body = document.getElementById('mtSegmentsBody');
    var caret = document.getElementById('mtSegmentsCaret');
    if (!body) return;
    var collapsed = body.style.display === 'none';
    body.style.display = collapsed ? 'block' : 'none';
    if (caret) caret.textContent = collapsed ? '▾' : '▸';
    if (_mtState.player) _mtState.player._segmentsPanelCollapsed = !collapsed;
};

// Phase 4A — single segment row renderer factored out of
// _mtRenderSegmentsPanel so the grouped layout can call it per-bucket
// without duplicating the row HTML. Keeps data-seg-idx/canvas-id
// attributes intact so _mtPaintSegmentStrips and
// _mtUpdateActiveSegmentHighlight keep working unchanged.
function _mtRenderSegmentRow(s, idx, p) {
    var startSec = (typeof s.startSec === 'number') ? s.startSec : 0;
    var endSec = (typeof s.endSec === 'number') ? s.endSec : 0;
    var effKind = _mtSegmentEffectiveKind(s);
    var meta = _mtKindMeta(effKind);
    var display = _mtSegmentDisplayName(s);
    var reviewState = _mtSegmentReviewState(s);
    var confidence = _mtSegmentConfidence(s);
    var canvasId = 'mtSegStrip_' + idx;
    var titleId = 'mtSegTitle_' + idx;

    // UX convergence pass 2026-05-25 (per founder UX review §"Segments panel
    // review"): rows still felt machine-oriented and too visually equal.
    // Per-kind weight differentiation makes SONGS dominate the surface;
    // chatter/silence recede. Songs = full weight; chatter = compact +
    // italic; silence = minimal; transition = bridge accent (kept purple).
    var isSong       = (effKind === 'music');
    var isChatter    = (effKind === 'speech');
    var isSilence    = (effKind === 'silence');
    var isTransition = (effKind === 'transition');

    // Stripe height proxies row weight: song = full, transition = full,
    // chatter = reduced, silence = minimal. Font + opacity ride along.
    var stripeH    = isSilence ? 16 : (isChatter ? 22 : 32);
    var rowPad     = isSilence ? '3px 8px' : (isChatter ? '4px 8px' : '6px 8px');
    var rowFontSz  = isSilence ? '0.70em' : (isChatter ? '0.72em' : '0.76em');
    var titleStyle = isSong ? 'font-weight:600;color:#f1f5f9' : (isChatter ? 'font-style:italic;color:#cbd5e1' : 'color:var(--text-dim)');
    var kindOpa    = isSilence ? '0.6' : (isChatter ? '0.78' : '1');

    var rowBg, rowAlpha, leftStripeColor, ringStyle;
    if (reviewState === 'excluded') {
        rowBg = 'rgba(100,116,139,0.05)';
        rowAlpha = '0.45';
        leftStripeColor = '#475569';
        ringStyle = '';
    } else if (reviewState === 'confirmed') {
        rowBg = 'rgba(34,197,94,0.07)';
        rowAlpha = '1';
        leftStripeColor = '#22c55e';
        ringStyle = '';
    } else if (reviewState === 'needs-review') {
        // Phase 4B (trust engineering) — low-confidence rows get a full
        // red wash + thicker left stripe. ChatGPT's frame: "low-conf rows
        // should slightly tint the whole row edge/background. Your eye
        // should instantly know: these 5 rows need attention."
        rowBg = 'rgba(239,68,68,0.09)';
        rowAlpha = '1';
        leftStripeColor = '#ef4444';
        ringStyle = 'box-shadow:inset 4px 0 0 0 rgba(239,68,68,0.65);';
    } else {
        rowBg = meta.stripBg;
        rowAlpha = '1';
        leftStripeColor = meta.stripe;
        ringStyle = '';
    }

    var confChip = _mtConfidenceChipHtml(confidence);
    var stateChip = '';
    if (reviewState === 'confirmed') {
        stateChip = '<span title="Confirmed by user" style="background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);color:#86efac;border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700">✓ CONFIRMED</span>';
    } else if (reviewState === 'needs-review') {
        stateChip = '<span title="Needs review — low confidence" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700">⚠ NEEDS REVIEW</span>';
    } else if (reviewState === 'excluded') {
        stateChip = '<span title="Excluded — not included in songs-only mix" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);color:#fbbf24;border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700">⊘ EXCLUDED</span>';
    }

    var confirmBg = (reviewState === 'confirmed') ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.05)';
    var confirmBorder = (reviewState === 'confirmed') ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.1)';
    var confirmColor = (reviewState === 'confirmed') ? '#86efac' : 'var(--text-dim)';
    var excludeBg = (reviewState === 'excluded') ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.05)';
    var excludeBorder = (reviewState === 'excluded') ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.1)';
    var excludeColor = (reviewState === 'excluded') ? '#fbbf24' : 'var(--text-dim)';

    // UX convergence pass 2026-05-25 (P3): markers row shows in the same
    // grid-spanning expanded area as the trim panel, only when ⋯ is open.
    // Keeps the collapsed row clean; surfaces the marker vocabulary when
    // the user has already opted into the advanced action surface.
    var moreOpen = (p._moreOpenIdx === idx);
    var activeMarkers = _mtSegmentMarkers(s);
    var markerPanelHtml = moreOpen ? (
        '<div style="grid-column:1/-1;padding:6px 12px;background:rgba(255,255,255,0.02);border-top:1px dashed rgba(255,255,255,0.06);display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:0.74em">'
        + '<span style="color:var(--text-dim);font-weight:700;margin-right:4px">Mark:</span>'
        + _MT_MARKER_DEFS.map(function(def) {
            var on = !!activeMarkers[def.key];
            var bg = on ? def.bg : 'rgba(255,255,255,0.04)';
            var border = on ? def.border : 'rgba(255,255,255,0.1)';
            var color = on ? def.color : 'var(--text-dim)';
            return '<button onclick="_mtSegmentToggleMarker(' + idx + ',\'' + def.key + '\')" title="' + escHtml(def.label) + (on ? ' — click to remove' : '') + '" '
                + 'style="background:' + bg + ';border:1px solid ' + border + ';border-radius:4px;color:' + color + ';padding:2px 8px;cursor:pointer;font-size:0.85em;font-family:inherit">'
                + def.emoji + '</button>';
        }).join('')
        + '</div>'
    ) : '';

    var trimOpen = (p._trimOpenIdx === idx);
    var trimPanelHtml = trimOpen ? (
        '<div style="grid-column:1/-1;padding:8px 12px;background:rgba(99,102,241,0.04);border-top:1px dashed rgba(99,102,241,0.2);display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:0.76em">'
        + '<div style="display:flex;align-items:center;gap:4px"><span style="color:var(--text-dim);font-weight:700;margin-right:4px">Start</span>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'start\',-5)" title="−5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">−5s</button>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'start\',-0.5)" title="−0.5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">−.5</button>'
        + '<span style="font-family:ui-monospace,monospace;color:#f1f5f9;min-width:46px;text-align:center">' + _mtFmtTimeShort(startSec) + '</span>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'start\',0.5)" title="+0.5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">+.5</button>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'start\',5)" title="+5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">+5s</button>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:4px"><span style="color:var(--text-dim);font-weight:700;margin-right:4px">End</span>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'end\',-5)" title="−5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">−5s</button>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'end\',-0.5)" title="−0.5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">−.5</button>'
        + '<span style="font-family:ui-monospace,monospace;color:#f1f5f9;min-width:46px;text-align:center">' + _mtFmtTimeShort(endSec) + '</span>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'end\',0.5)" title="+0.5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">+.5</button>'
        + '<button onclick="_mtSegmentTrim(' + idx + ',\'end\',5)" title="+5s" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 7px;cursor:pointer;font-size:0.78em">+5s</button>'
        + '</div>'
        + '<button onclick="_mtSegmentToggleTrim(' + idx + ')" style="margin-left:auto;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 8px;cursor:pointer;font-size:0.74em">Done</button>'
        + '</div>'
    ) : '';

    return '<div data-seg-idx="' + idx + '" data-seg-start="' + startSec + '" data-seg-end="' + endSec + '" tabindex="0" style="display:grid;grid-template-columns:4px 22px 78px 78px 1fr 175px;gap:8px;align-items:center;padding:' + rowPad + ';border-bottom:1px solid rgba(255,255,255,0.04);font-size:' + rowFontSz + ';background:' + rowBg + ';opacity:' + rowAlpha + ';transition:background 150ms;outline:none;' + ringStyle + '">'
        + '<div style="background:' + leftStripeColor + ';width:4px;height:' + stripeH + 'px;border-radius:2px"></div>'
        + '<div title="' + escHtml(meta.name) + '" style="text-align:center;color:' + meta.color + ';font-size:1.05em;opacity:' + kindOpa + '">' + meta.emoji + '</div>'
        + '<div style="font-family:ui-monospace,monospace;color:var(--text-dim);font-size:0.95em;opacity:' + kindOpa + '">' + _mtFmtTimeShort(startSec) + '–' + _mtFmtTimeShort(endSec) + '</div>'
        + '<canvas id="' + canvasId + '" width="78" height="' + (isSilence ? 12 : (isChatter ? 16 : 20)) + '" style="display:block;background:rgba(0,0,0,0.15);border-radius:3px;opacity:' + (isSilence ? '0.5' : (isChatter ? '0.7' : '1')) + '"></canvas>'
        + '<div style="display:flex;align-items:center;gap:6px;min-width:0">'
        + '<input id="' + titleId + '" type="text" value="' + escHtml(display.title) + '" placeholder="' + escHtml(display.placeholder) + '" list="' + _MT_SONGS_DATALIST_ID + '" autocomplete="off" oninput="_mtSegmentTitleDirty(' + idx + ')" onblur="_mtSegmentTitleSave(' + idx + ')" onkeydown="if(event.key===\'Enter\')this.blur()" class="app-input" style="flex:1;min-width:80px;font-size:' + (isSong ? '0.95em' : '0.88em') + ';padding:3px 6px;background:transparent;border:1px solid transparent;border-radius:4px;' + titleStyle + '">'
        + (stateChip ? '<div style="flex-shrink:0">' + stateChip + '</div>' : '')
        + (function() { var pc = _mtProvenanceChipHtml(s); return pc ? '<div style="flex-shrink:0">' + pc + '</div>' : ''; })()
        + (confChip ? '<div style="flex-shrink:0">' + confChip + '</div>' : '')
        + (function() {
            // UX convergence pass 2026-05-25 (P3): always-visible compact
            // marker summary so flagged moments are scannable from the
            // collapsed row. Full toggle UI lives in the expanded ⋯ panel.
            var sum = _mtSegmentMarkerSummary(s);
            if (!sum) return '';
            return '<div title="Marked moments — click ⋯ to edit" style="flex-shrink:0;font-size:0.95em;letter-spacing:1px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:1px 4px">' + sum + '</div>';
        })()
        + '</div>'
        + '<div style="display:flex;gap:3px;justify-content:flex-end">'
        + _mtRenderRowActions(idx, reviewState, confirmBg, confirmBorder, confirmColor, excludeBg, excludeBorder, excludeColor, trimOpen, p)
        + '</div>'
        + markerPanelHtml
        + trimPanelHtml
        + '</div>';
}

// Phase 4B (progressive disclosure) — default-visible: ▶ ⋯ ✓ ⊘. Click ⋯
// to reveal the advanced editing trio (✂ ⛓ ↕) inline; click × to collapse.
// Per-row open state stored in p._moreOpenIdx so only one row's tools
// are exposed at a time. Removes "tiny DAW toolbar syndrome" from every
// row when the user is just reviewing, not editing.
function _mtRenderRowActions(idx, reviewState, confirmBg, confirmBorder, confirmColor, excludeBg, excludeBorder, excludeColor, trimOpen, p) {
    var moreOpen = (p._moreOpenIdx === idx);
    var BTN_BASE = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:var(--text-dim);padding:2px 5px;cursor:pointer;font-size:0.78em';
    var moreBtnStyle = moreOpen
        ? 'background:rgba(99,102,241,0.22);border:1px solid rgba(99,102,241,0.45);border-radius:4px;color:#a5b4fc;padding:2px 5px;cursor:pointer;font-size:0.78em'
        : BTN_BASE;
    var trimBtnStyle = trimOpen
        ? 'background:rgba(99,102,241,0.22);border:1px solid rgba(99,102,241,0.45);border-radius:4px;color:#a5b4fc;padding:2px 5px;cursor:pointer;font-size:0.78em'
        : BTN_BASE;
    var html = '<button onclick="_mtSegmentJump(' + idx + ')" title="Jump to segment start (and play)" style="' + BTN_BASE + '">▶</button>';
    if (moreOpen) {
        html += '<button onclick="_mtSegmentSplit(' + idx + ')" title="Split at playhead" style="' + BTN_BASE + '">✂</button>'
             + '<button onclick="_mtSegmentMerge(' + idx + ')" title="Merge with next segment" style="' + BTN_BASE + '">⛓</button>'
             + '<button onclick="_mtSegmentToggleTrim(' + idx + ')" title="Trim start/end ±5s / ±0.5s" style="' + trimBtnStyle + '">↕</button>'
             + '<button onclick="_mtSegmentToggleMore(' + idx + ')" title="Hide advanced actions" style="' + moreBtnStyle + '">×</button>';
    } else {
        html += '<button onclick="_mtSegmentToggleMore(' + idx + ')" title="Show split / merge / trim" style="' + moreBtnStyle + '">⋯</button>';
    }
    html += '<button onclick="_mtSegmentConfirm(' + idx + ')" title="' + (reviewState === 'confirmed' ? 'Confirmed — click to unconfirm' : 'Confirm') + '" style="background:' + confirmBg + ';border:1px solid ' + confirmBorder + ';border-radius:4px;color:' + confirmColor + ';padding:2px 5px;cursor:pointer;font-size:0.78em">✓</button>'
         + '<button onclick="_mtSegmentToggleBetween(' + idx + ')" title="' + (reviewState === 'excluded' ? 'Excluded — click to unflag' : 'Exclude') + '" style="background:' + excludeBg + ';border:1px solid ' + excludeBorder + ';border-radius:4px;color:' + excludeColor + ';padding:2px 5px;cursor:pointer;font-size:0.78em">⊘</button>';
    return html;
}

window._mtSegmentToggleMore = function(idx) {
    var p = _mtState.player;
    if (!p) return;
    p._moreOpenIdx = (p._moreOpenIdx === idx) ? null : idx;
    _mtRenderSegmentsPanel();
};

// Phase 4A — filter pill bar HTML. Each pill is an independent toggle.
// Active pill = filled bg + colored border. Inactive = outline only.
// Count comes from raw counters (independent of which other pills are on),
// so users see "Songs (34)" no matter what else is filtered.
function _mtRenderFilterPills(filters, counts) {
    var pills = [
        { key: 'music',        label: 'Songs',        emoji: '🎵', color: '#a5b4fc', activeBg: 'rgba(99,102,241,0.22)',  activeBorder: 'rgba(99,102,241,0.5)',  count: counts.music },
        { key: 'needsReview',  label: 'Needs Review', emoji: '⚠',  color: '#fca5a5', activeBg: 'rgba(239,68,68,0.18)',   activeBorder: 'rgba(239,68,68,0.5)',   count: counts.needsReview },
        { key: 'unnamed',      label: 'Unnamed',      emoji: '❓', color: '#cbd5e1', activeBg: 'rgba(148,163,184,0.22)', activeBorder: 'rgba(148,163,184,0.5)', count: counts.unnamed },
        { key: 'transition',   label: 'Transitions',  emoji: '🔀', color: '#d8b4fe', activeBg: 'rgba(168,85,247,0.22)',  activeBorder: 'rgba(168,85,247,0.5)',  count: counts.transition },
        { key: 'speech',       label: 'Chatter',      emoji: '💬', color: '#fbbf24', activeBg: 'rgba(245,158,11,0.22)',  activeBorder: 'rgba(245,158,11,0.5)',  count: counts.speech },
        { key: 'silence',      label: 'Silence',      emoji: '🔇', color: '#94a3b8', activeBg: 'rgba(100,116,139,0.25)', activeBorder: 'rgba(148,163,184,0.5)', count: counts.silence },
        { key: 'excluded',     label: 'Excluded',     emoji: '🚫', color: '#fbbf24', activeBg: 'rgba(245,158,11,0.18)',  activeBorder: 'rgba(245,158,11,0.45)', count: counts.excluded },
    ];
    var html = pills.map(function(p) {
        var on = !!filters[p.key];
        var bg = on ? p.activeBg : 'transparent';
        var bd = on ? p.activeBorder : 'rgba(255,255,255,0.1)';
        var col = on ? p.color : 'var(--text-dim)';
        var weight = on ? '700' : '500';
        return '<button onclick="_mtSegFilterToggle(\'' + p.key + '\')" '
            + 'title="' + (on ? 'Hide' : 'Show') + ' ' + p.label + '" '
            + 'style="background:' + bg + ';border:1px solid ' + bd + ';color:' + col + ';font-weight:' + weight + ';border-radius:14px;padding:3px 10px;cursor:pointer;font-size:0.74em;white-space:nowrap;transition:all 120ms">'
            + p.emoji + ' ' + p.label + ' <span style="opacity:0.75;font-weight:400;margin-left:2px">' + p.count + '</span>'
            + '</button>';
    }).join('');
    return '<div style="display:flex;flex-wrap:wrap;gap:5px;padding:8px 12px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.05)">' + html + '</div>';
}

function _mtRenderSegmentsPanel() {
    var p = _mtState.player;
    var host = document.getElementById('mtSegmentsPanel');
    if (!p || !host) return;
    // Preserve scroll position across re-renders. Drew (UAT 2026-05-24):
    // "Everytime I type a replacement song and save or change anything in a
    // song, it goes all the way back up to the top song." Every handler
    // (_mtSegmentTitleSave, _mtSegmentConfirm, _mtSegmentToggleBetween,
    // _mtSegmentSplit) calls back through here, which rebuilds the list
    // DOM and resets scrollTop=0. Capture-restore here keeps the user's
    // place. The setTimeout dance accounts for the canvas paint deferral
    // (which happens on the next microtask) — restoring scroll BEFORE
    // paint scheduling is fine because we own the scroll container.
    var existingList = document.getElementById('mtSegmentsList');
    var savedScrollTop = existingList ? existingList.scrollTop : 0;
    var segs = Array.isArray(p.segments) ? p.segments : [];

    // Empty state — either no analysis yet OR an analysis is in flight.
    // The in-flight banner takes priority and ticks an elapsed timer +
    // a phase narrative so the user sees what's happening on the server
    // even after closing the Analyze modal.
    if (!segs.length) {
        var inFlight = p._analyzeInFlight;
        if (inFlight && inFlight.startedAt) {
            host.innerHTML = _mtRenderAnalyzeProgressHtml(inFlight);
            return;
        }
        host.innerHTML =
            '<div style="padding:8px 12px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;background:rgba(255,255,255,0.02);font-size:0.78em;color:var(--text-dim);display:flex;align-items:center;gap:10px">'
            + '<span>🎯 No segments yet — run Analyze to scan this rehearsal.</span>'
            + '<button onclick="_mtAnalyzeRehearsal()" style="margin-left:auto;background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.35);border-radius:5px;color:#a5b4fc;padding:4px 10px;cursor:pointer;font-size:0.78em;font-weight:700">Analyze</button>'
            + '</div>';
        return;
    }

    var collapsed = !!p._segmentsPanelCollapsed;

    // Phase 4A — filter pill + group state. Seed defaults on first render
    // so the user lands in the canonical "review workflow" view: Songs +
    // Needs Review open; Chatter/Transitions/Silence/Excluded collapsed
    // behind a single pill click. Per-player so flipping rehearsals
    // restarts from the canonical default.
    if (!p._segFilters) {
        p._segFilters = { music: true, needsReview: true, unnamed: false, transition: false, speech: false, silence: false, excluded: false };
    }
    if (!p._segGroupsOpen) {
        p._segGroupsOpen = { needsReview: true, music: true, transition: false, speech: false, silence: false, excluded: false };
    }
    var f = p._segFilters;
    var g = p._segGroupsOpen;

    var SHORT_SILENCE_THRESHOLD = 30; // sub-30s silences are almost always song-internal drops, not between-song breaks. Hidden inside the Silence group until the user opts in.
    var showShortSilences = !!p._showShortSilences;

    // Bucket segments by group + count raw totals for pill labels. Counts
    // are independent of which pills are on, so "Songs (34)" stays
    // honest even when Songs is filtered out.
    var buckets = { needsReview: [], music: [], transition: [], speech: [], silence: [], excluded: [] };
    var counts = { music: 0, transition: 0, speech: 0, silence: 0, excluded: 0, needsReview: 0, unnamed: 0 };
    var silenceHiddenShortCount = 0;

    segs.forEach(function(s, origIdx) {
        var rs = _mtSegmentReviewState(s);
        var effKind = _mtSegmentEffectiveKind(s) || 'silence';
        var disp = _mtSegmentDisplayName(s);
        var dur = (typeof s.endSec === 'number' && typeof s.startSec === 'number') ? (s.endSec - s.startSec) : 0;

        // Counts (chip labels) — exclude'd rows count only in excluded.
        if (rs === 'excluded') {
            counts.excluded++;
        } else {
            if (effKind === 'music') {
                counts.music++;
                if (rs === 'needs-review') counts.needsReview++;
                if (!disp.title) counts.unnamed++;
            } else if (effKind === 'transition') counts.transition++;
            else if (effKind === 'speech')     counts.speech++;
            else if (effKind === 'silence')    counts.silence++;
        }

        // Bucket assignment.
        if (rs === 'excluded') {
            if (f.excluded) buckets.excluded.push({ seg: s, idx: origIdx });
            return;
        }
        // Music + needs-review OR music + unnamed → lift into Needs Review
        // group when the relevant pill is on. Keeps the user's triage
        // queue at the top of the panel.
        var isUnnamedMusic = (effKind === 'music' && !disp.title);
        if (effKind === 'music' && rs === 'needs-review' && f.needsReview) {
            buckets.needsReview.push({ seg: s, idx: origIdx });
            return;
        }
        if (isUnnamedMusic && f.unnamed) {
            buckets.needsReview.push({ seg: s, idx: origIdx });
            return;
        }
        if (effKind === 'music' && f.music)                                     buckets.music.push({ seg: s, idx: origIdx });
        else if (effKind === 'transition' && f.transition)                      buckets.transition.push({ seg: s, idx: origIdx });
        else if (effKind === 'speech' && f.speech)                              buckets.speech.push({ seg: s, idx: origIdx });
        else if (effKind === 'silence' && f.silence) {
            if (!showShortSilences && dur < SHORT_SILENCE_THRESHOLD) {
                silenceHiddenShortCount++;
            } else {
                buckets.silence.push({ seg: s, idx: origIdx });
            }
        }
    });

    var totalVisible = buckets.needsReview.length + buckets.music.length + buckets.transition.length + buckets.speech.length + buckets.silence.length + buckets.excluded.length;
    var hiddenCount = segs.length - totalVisible;

    // Workflow hint banner — persists across sessions via localStorage so
    // dismissed stays dismissed. When dismissed, a small ? in the panel
    // header brings it back. Replaces the verbose always-on instructional
    // strip that was eating vertical space at the top of the panel.
    var hintDismissed = false;
    try { hintDismissed = (typeof localStorage !== 'undefined' && localStorage.getItem('mtSegmentsHintDismissed') === '1'); } catch(_) {}
    // UX convergence pass 2026-05-25 (P4): tightened from full sentence with
    // three nested workflows + emoji clutter to a single line of three terse
    // verb phrases. Same instruction, ~40% fewer characters, weaker visual
    // weight (font + opacity + smaller padding) so it sits below the
    // pills/segments instead of competing with them.
    var hintHtml = hintDismissed ? '' :
        '<div style="padding:6px 12px;background:rgba(99,102,241,0.06);border-bottom:1px solid rgba(99,102,241,0.15);font-size:0.72em;color:#a5b4fc;display:flex;align-items:center;gap:8px">'
        + '<span style="opacity:0.7">💡</span>'
        + '<div style="flex:1;line-height:1.4;opacity:0.85">Name songs · flag chatter · then <b>🎛 Tools → Mix → Render songs only</b></div>'
        + '<button onclick="_mtSegmentsHintDismiss()" title="Don\'t show again" style="background:none;border:none;color:#a5b4fc;cursor:pointer;padding:0 4px;font-size:1em;opacity:0.7">×</button>'
        + '</div>';

    // Phase 4A — filter pill bar (replaces the inline "Show N short
    // silences" toggle and the verbose header summary).
    var pillsHtml = _mtRenderFilterPills(f, counts);

    // Group renderer. Each group gets a clickable header (▾/▸) followed
    // by its rows when open. Order = triage attention first → bulk
    // categories → excluded last. Empty groups (no rows after filtering)
    // are skipped entirely so the panel never shows a "Songs (0)" header.
    var groupOrder = [
        { key: 'needsReview',  label: 'Needs Review',  emoji: '⚠',  color: '#fca5a5' },
        { key: 'music',        label: 'Songs',         emoji: '🎵', color: '#a5b4fc' },
        { key: 'transition',   label: 'Transitions',   emoji: '🔀', color: '#d8b4fe' },
        { key: 'speech',       label: 'Chatter',       emoji: '💬', color: '#fbbf24' },
        { key: 'silence',      label: 'Silence',       emoji: '🔇', color: '#94a3b8' },
        { key: 'excluded',     label: 'Excluded',      emoji: '🚫', color: '#fbbf24' },
    ];
    var groupsHtml = groupOrder.map(function(grp) {
        var items = buckets[grp.key] || [];
        if (items.length === 0) return '';
        var open = (grp.key in g) ? g[grp.key] : false;
        var headerHtml = '<div onclick="_mtSegGroupToggle(\'' + grp.key + '\')" style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;user-select:none;background:rgba(255,255,255,0.04);border-top:1px solid rgba(255,255,255,0.06);font-size:0.77em;font-weight:700">'
            + '<span style="color:var(--text-dim);font-size:0.85em;width:10px;display:inline-block">' + (open ? '▾' : '▸') + '</span>'
            + '<span style="color:' + grp.color + '">' + grp.emoji + ' ' + grp.label + '</span>'
            + '<span style="color:var(--text-dim);font-weight:400;margin-left:auto;font-family:ui-monospace,monospace">' + items.length + '</span>'
            + '</div>';
        if (!open) return headerHtml;
        // Silence group only — expose the short-silence toggle right
        // inside the group header so the threshold control lives next to
        // the rows it affects.
        var silenceHelperHtml = '';
        if (grp.key === 'silence' && silenceHiddenShortCount > 0) {
            silenceHelperHtml = '<div style="padding:6px 12px;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.72em;color:var(--text-dim)">'
                + '<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer">'
                + '<input type="checkbox" id="mtSegShowShorts" onclick="_mtSegmentsToggleShorts()"' + (showShortSilences ? ' checked' : '') + '>'
                + 'Show ' + silenceHiddenShortCount + ' short silence' + (silenceHiddenShortCount === 1 ? '' : 's') + ' (&lt; 30 s — usually song-internal drops)'
                + '</label></div>';
        }
        var rowsHtml = items.map(function(item) {
            return _mtRenderSegmentRow(item.seg, item.idx, p);
        }).join('');
        return headerHtml + silenceHelperHtml + rowsHtml;
    }).join('');

    // Empty-after-filter state — the user has all pills off, or every
    // segment was filtered out. Gentle nudge to re-enable Songs.
    var emptyAfterFilterHtml = (totalVisible === 0) ?
        '<div style="padding:18px 12px;text-align:center;font-size:0.78em;color:var(--text-dim)">No segments match the current filters. Click a pill above to show segments.</div>'
        : '';

    // Tier 1C — Single shared <datalist> for typeahead.
    var datalistHtml = _mtSongsDatalistHtml();

    // Footer: keyboard shortcut hint only (short-silence toggle moved
    // into the Silence group header).
    var shortcutHintHtml = '<div style="padding:6px 12px;background:rgba(255,255,255,0.02);border-top:1px solid rgba(255,255,255,0.04);font-size:0.7em;color:var(--text-dim)">'
        + '⌨ Click a row, then: <b>S</b>=Song · <b>C</b>=Chatter · <b>T</b>=Transition · <b>X</b>=Exclude · <b>Enter</b>=Confirm · <b>↑/↓</b>=move'
        + '</div>';

    // In-flight analyze banner — also shows when segments already exist
    // (re-analyze on top of prior run).
    var inFlightBannerHtml = '';
    if (p._analyzeInFlight && p._analyzeInFlight.startedAt) {
        inFlightBannerHtml =
            '<div style="margin-bottom:8px">'
            + _mtRenderAnalyzeProgressHtml(p._analyzeInFlight)
            + '<div style="margin-top:4px;font-size:0.72em;color:var(--text-dim);font-style:italic;text-align:center">Existing segments below will be replaced when this analysis completes.</div>'
            + '</div>';
    }

    // Header summary + ? help icon when hint is dismissed.
    var summaryStr = totalVisible + ' shown' + (hiddenCount ? ' · ' + hiddenCount + ' filtered out' : '');
    var helpIconHtml = hintDismissed
        ? '<button onclick="event.stopPropagation();_mtSegmentsHintShow()" title="Show review workflow help" style="background:none;border:1px solid rgba(255,255,255,0.15);color:var(--text-dim);border-radius:50%;width:18px;height:18px;line-height:14px;padding:0;cursor:pointer;font-size:0.7em;font-weight:700;margin-left:6px">?</button>'
        : '';

    host.innerHTML =
        datalistHtml
        + inFlightBannerHtml
        + '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.02)">'
        + '<div onclick="_mtToggleSegmentsPanel()" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;user-select:none;background:rgba(255,255,255,0.03)">'
        + '<span id="mtSegmentsCaret" style="color:var(--text-dim);font-size:0.85em">' + (collapsed ? '▸' : '▾') + '</span>'
        + '<span style="font-weight:700;font-size:0.82em;color:#f1f5f9">🎯 Segments</span>'
        + helpIconHtml
        + '<span style="font-size:0.74em;color:var(--text-dim);margin-left:auto">' + escHtml(summaryStr) + '</span>'
        + '</div>'
        + '<div id="mtSegmentsBody" style="display:' + (collapsed ? 'none' : 'block') + '">'
        + hintHtml
        + pillsHtml
        + '<div id="mtSegmentsList" style="max-height:340px;overflow-y:auto">' + groupsHtml + emptyAfterFilterHtml + '</div>'
        + shortcutHintHtml
        + '</div>'
        + '</div>';

    // Restore scroll position after the list is back in the DOM.
    var newList = document.getElementById('mtSegmentsList');
    if (newList && savedScrollTop > 0) {
        newList.scrollTop = savedScrollTop;
    }
    // Paint canvases after they're in the DOM. Defer so layout settles
    // (canvas width is fixed via attribute, but transform happens on next tick).
    setTimeout(_mtPaintSegmentStrips, 0);
    // Tier 1F: immediately apply active-segment highlight after re-render
    // so the user doesn't lose their playhead orientation.
    setTimeout(_mtUpdateActiveSegmentHighlight, 0);
}

// Tier 1F — Auto-highlight the row whose time-range contains the
// current playhead. Auto-scrolls the row into view when it changes,
// but only on transitions (not every timeupdate tick) so the scroll
// stays useful, not jittery.
//
// Highlight ONLY appears while audio is actively playing. When the
// user pauses (or the player just opened with playhead at 0:00), the
// highlight clears. Otherwise the box looked like it was tracking
// "what the analyzer is processing" — it isn't (Drew, 2026-05-24).
function _mtUpdateActiveSegmentHighlight() {
    var p = _mtState.player;
    if (!p || !Array.isArray(p.segments)) return;
    var rows = document.querySelectorAll('#mtSegmentsList [data-seg-idx]');
    // Drew (UAT 2026-05-24): "the box around each song needs to stay
    // until the time ticks over to the next section and then the box
    // immediately moves to the next one. Sometimes, the box disappears."
    // Old behavior cleared the highlight on pause + on every gap
    // between segments. New behavior: highlight tracks the playhead
    // ALWAYS (regardless of paused state), and falls back to the most
    // recent segment whose start ≤ playhead when the playhead lands in
    // a gap (silence/chatter between two music segments).
    var t = (typeof _mtCurrentPlayheadSec === 'function') ? _mtCurrentPlayheadSec() : 0;
    var activeOrigIdx = -1;
    // First pass: segment whose time range CONTAINS the playhead.
    for (var i = 0; i < p.segments.length; i++) {
        var s = p.segments[i];
        var st = (typeof s.startSec === 'number') ? s.startSec : 0;
        var en = (typeof s.endSec === 'number') ? s.endSec : 0;
        if (t >= st && t < en) { activeOrigIdx = i; break; }
    }
    // Fallback: most recent segment whose start ≤ playhead. Keeps the
    // box sticky during gaps so the user doesn't "lose" their place.
    if (activeOrigIdx === -1) {
        for (var j = p.segments.length - 1; j >= 0; j--) {
            var sg = p.segments[j];
            var sst = (typeof sg.startSec === 'number') ? sg.startSec : 0;
            if (sst <= t) { activeOrigIdx = j; break; }
        }
        // If even that fails (playhead before the first segment), pick row 0.
        if (activeOrigIdx === -1 && p.segments.length > 0) activeOrigIdx = 0;
    }
    rows.forEach(function(row) {
        var idx = parseInt(row.getAttribute('data-seg-idx'), 10);
        if (idx === activeOrigIdx) {
            row.style.outline = '2px solid rgba(165,180,252,0.75)';
            row.style.outlineOffset = '-1px';
        } else {
            row.style.outline = '';
            row.style.outlineOffset = '';
        }
    });
    if (activeOrigIdx >= 0 && activeOrigIdx !== p._lastActiveSegIdx) {
        var activeRow = document.querySelector('#mtSegmentsList [data-seg-idx="' + activeOrigIdx + '"]');
        if (activeRow) {
            try { activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
        }
    }
    // Phase 4B sticky review context — write "Reviewing: {title} •
    // {range} • {conf%}" into the transport row. Only on segment
    // transitions (not every timeupdate tick) so the DOM write is cheap.
    if (activeOrigIdx !== p._lastActiveSegIdx) {
        _mtUpdateNowReviewingLabel(p, activeOrigIdx);
    }
    p._lastActiveSegIdx = activeOrigIdx;
}

// Phase 4B — sticky "Reviewing: X • range • conf%" header label.
// Pulls from active segment's display name + confidence + time range,
// formats compactly to fit the transport row's right-hand space.
function _mtUpdateNowReviewingLabel(p, activeOrigIdx) {
    var el = document.getElementById('mtNowReviewing');
    if (!el) return;
    if (activeOrigIdx < 0 || !p || !p.segments || !p.segments[activeOrigIdx]) {
        el.innerHTML = '';
        return;
    }
    var seg = p.segments[activeOrigIdx];
    var disp = _mtSegmentDisplayName(seg);
    var effKind = _mtSegmentEffectiveKind(seg) || 'segment';
    var meta = _mtKindMeta(seg.kind);
    // Label: user-set title > AI matched title > placeholder w/o the
    // "— type to..." cruft > kind name.
    var labelTitle;
    if (disp.title) {
        labelTitle = disp.title;
    } else if (disp.kind === 'possible') {
        labelTitle = '?? ' + (disp.placeholder.replace(/^Possible:\s*/, '').replace(/\s*—\s*type to.*$/, ''));
    } else if (effKind === 'music') {
        labelTitle = '?? Unidentified';
    } else {
        labelTitle = meta.name.charAt(0).toUpperCase() + meta.name.slice(1);
    }
    var startSec = (typeof seg.startSec === 'number') ? seg.startSec : 0;
    var endSec = (typeof seg.endSec === 'number') ? seg.endSec : 0;
    var range = _mtFmtTimeShort(startSec) + '–' + _mtFmtTimeShort(endSec);
    var conf = _mtSegmentConfidence(seg);
    var confStr = (conf > 0.05) ? (' · ' + Math.round(conf * 100) + '%') : '';
    var rs = _mtSegmentReviewState(seg);
    var titleColor;
    if (rs === 'confirmed')        titleColor = '#86efac';
    else if (rs === 'needs-review') titleColor = '#fca5a5';
    else if (rs === 'excluded')    titleColor = '#fbbf24';
    else                            titleColor = '#f1f5f9';
    el.innerHTML = '<span style="opacity:0.55">' + meta.emoji + ' Reviewing: </span>'
        + '<b style="color:' + titleColor + '">' + escHtml(labelTitle) + '</b>'
        + '<span style="opacity:0.6;font-family:ui-monospace,monospace;font-size:0.92em"> · ' + range + confStr + '</span>';
}

function _mtPaintSegmentStrips() {
    var p = _mtState.player;
    if (!p || !Array.isArray(p.segments)) return;
    var peaks = p.peaks || [];
    var dur = p.peaksDurationSec || 0;
    // Only paint canvases that are actually in the DOM (the panel may be
    // filtering out short-silence rows so not every segment has a canvas).
    p.segments.forEach(function(s, idx) {
        var canvas = document.getElementById('mtSegStrip_' + idx);
        if (!canvas) return; // filtered out — skip cleanly
        var startSec = (typeof s.startSec === 'number') ? s.startSec : 0;
        var endSec = (typeof s.endSec === 'number') ? s.endSec : 0;
        var buckets = _mtPeaksForSegment(peaks, dur, startSec, endSec, 40);
        var meta = _mtKindMeta(s.kind);
        _mtDrawSegmentStrip(canvas, buckets, meta.stripFg);
    });
}

// Mark the title input as dirty (visual cue). Save happens on blur.
window._mtSegmentTitleDirty = function(idx) {
    var el = document.getElementById('mtSegTitle_' + idx);
    if (!el) return;
    el.style.border = '1px solid rgba(165,180,252,0.4)';
    el.style.background = 'rgba(99,102,241,0.06)';
};

// Tier 1C — Resolve a free-text title to the canonical Song DNA songId
// when the title matches a record in allSongs. Returns { songId } or
// null. Case-insensitive exact match — typeahead from <datalist> nudges
// users toward canonical strings, so exact match is the right rule.
function _mtResolveSongIdForTitle(title) {
    var clean = String(title || '').trim().toLowerCase();
    if (!clean) return null;
    var songs = (typeof allSongs !== 'undefined' && Array.isArray(allSongs)) ? allSongs : [];
    var match = songs.find(function(s) {
        return s && s.title && String(s.title).trim().toLowerCase() === clean;
    });
    if (match && (match.id || match.songId)) return { songId: match.id || match.songId };
    return null;
}

window._mtSegmentTitleSave = async function(idx) {
    var p = _mtState.player;
    if (!p) return;
    var el = document.getElementById('mtSegTitle_' + idx);
    if (!el) return;
    var newTitle = (el.value || '').trim();
    var seg = p.segments[idx];
    if (!seg) return;
    if ((seg.songTitle || '') === newTitle) {
        el.style.border = '1px solid transparent';
        el.style.background = 'transparent';
        return;
    }
    seg.songTitle = newTitle || null;
    // Resolve canonical Song DNA songId when the title matches a band-
    // library record. Stored alongside the user-facing title so future
    // training / cross-rehearsal lookups can key off it.
    var resolved = _mtResolveSongIdForTitle(newTitle);
    seg.songId = resolved ? resolved.songId : null;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function' && seg.id) {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/multitrackSegments/' + seg.id))
                .update({
                    songTitle: newTitle || null,
                    songId: seg.songId,
                });
        } catch (e) {
            console.warn('[Multitrack] segment rename failed:', e && e.message);
        }
    }
    el.style.border = '1px solid transparent';
    el.style.background = 'transparent';
    // Re-render so the row's confidence/state chips reflect the new title.
    _mtRenderSegmentsPanel();
};

// Tier 1E — Explicit user confirmation of a segment's title + kind.
// Distinct from typing a title (which just sets songTitle). Sets a
// reviewState='confirmed' flag persisted to multitrackSegments overlay.
// Stamps confirmedAt + confirmedBy for traceability + future fingerprint
// training corpus (Phase 3). Toggling re-clicks → unconfirms.
window._mtSegmentConfirm = async function(idx) {
    var p = _mtState.player;
    if (!p) return;
    var seg = p.segments[idx];
    if (!seg) return;
    // Pull the current title from the input (in case the user typed
    // without losing focus first).
    var titleEl = document.getElementById('mtSegTitle_' + idx);
    var currentTitle = titleEl ? String(titleEl.value || '').trim() : (seg.songTitle || '');
    if (titleEl && currentTitle !== (seg.songTitle || '')) {
        // Save title first so we don't confirm a stale value.
        await window._mtSegmentTitleSave(idx);
        seg = p.segments[idx]; // refresh
    }
    var alreadyConfirmed = (_mtSegmentReviewState(seg) === 'confirmed');
    var next = alreadyConfirmed ? 'unconfirmed' : 'confirmed';
    seg.reviewState = (next === 'unconfirmed') ? null : 'confirmed';
    var nowIso = new Date().toISOString();
    var who = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : null;
    if (next === 'confirmed') {
        seg.confirmedAt = nowIso;
        seg.confirmedBy = who;
    } else {
        seg.confirmedAt = null;
        seg.confirmedBy = null;
    }
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function' && seg.id) {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/multitrackSegments/' + seg.id))
                .update({
                    reviewState: seg.reviewState,
                    confirmedAt: seg.confirmedAt,
                    confirmedBy: seg.confirmedBy,
                });
        } catch (e) {
            console.warn('[Multitrack] segment confirm failed:', e && e.message);
            if (typeof showToast === 'function') showToast('Confirm save failed: ' + (e && e.message));
        }
    }
    // Phase 3 — Tier 3 learning loop. When a segment is confirmed AND
    // resolved to a canonical songId, write its BPM/key/duration to the
    // band's fingerprint corpus. When un-confirmed, remove the sample.
    // No-op when no songId (free-text titles don't train the corpus —
    // user has to pick from autocomplete or the matching is skipped).
    try {
        if (next === 'confirmed') {
            await _mtWriteFingerprintSample(seg);
        } else {
            await _mtRemoveFingerprintSample(seg);
        }
    } catch (e) {
        console.warn('[Multitrack] fingerprint update failed (segment state still saved):', e && e.message);
    }
    _mtRenderSegmentsPanel();
    _mtRenderSegmentMarkers();
};

window._mtSegmentToggleBetween = async function(idx) {
    var p = _mtState.player;
    if (!p) return;
    var seg = p.segments[idx];
    if (!seg) return;
    var wasExcluded = (_mtSegmentReviewState(seg) === 'excluded');
    // Toggle both the legacy isBetween flag AND the new reviewState so
    // older code paths + new panel UI stay in sync.
    var nextExcluded = !wasExcluded;
    seg.isBetween = nextExcluded;
    seg.reviewState = nextExcluded ? 'excluded' : null;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function' && seg.id) {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/multitrackSegments/' + seg.id))
                .update({
                    isBetween: nextExcluded,
                    reviewState: seg.reviewState,
                });
        } catch (e) {
            console.warn('[Multitrack] segment exclude toggle failed:', e && e.message);
        }
    }
    _mtRenderSegmentsPanel();
    _mtRenderSegmentMarkers();
};

// Manual segment split at current playhead. Used when the analyzer
// misses a song boundary (e.g., busy live-room with no real silences).
// Splits the segment in place: replaces one row with two rows that
// share the original's kind + likely_song but with start/end times
// carved at the playhead. Writes back to analysis.story.segments —
// a fresh Analyze run will overwrite manual splits, which is the
// intended trade-off (user can always re-edit after).
window._mtSegmentSplit = async function(idx) {
    var p = _mtState.player;
    if (!p || !Array.isArray(p.segments)) return;
    var seg = p.segments[idx];
    if (!seg) return;
    var startSec = (typeof seg.startSec === 'number') ? seg.startSec : 0;
    var endSec = (typeof seg.endSec === 'number') ? seg.endSec : 0;
    var playhead = (typeof _mtCurrentPlayheadSec === 'function') ? _mtCurrentPlayheadSec() : 0;
    // Tolerance: require playhead to be at least 1s inside both edges
    // so we don't create absurdly short slivers.
    if (!(playhead > startSec + 1 && playhead < endSec - 1)) {
        if (typeof showToast === 'function') {
            showToast('Move the playhead inside this segment (≥ 1s from each edge) before splitting');
        }
        return;
    }
    if (!confirm('Split "' + (seg.songTitle || seg.label || 'segment') + '" at ' + _mtFmtTimeShort(playhead) + '?\n\nThe upper half becomes a new segment; the lower half keeps the original\'s title and kind.')) {
        return;
    }
    var nowIso = new Date().toISOString();
    // Build two replacement segments. The first keeps original metadata
    // (title, kind, etc); the second is a fresh blank with same kind so
    // the user can rename it. New IDs derive from original id + suffix
    // so multitrackSegments overlay (isBetween, songTitle) still works.
    var baseId = seg.id || ('seg_' + idx);
    var first = Object.assign({}, seg, {
        endSec: playhead,
        durationSec: Math.round((playhead - startSec) * 100) / 100,
    });
    var second = Object.assign({}, seg, {
        id: baseId + '_split_' + Date.now(),
        startSec: playhead,
        durationSec: Math.round((endSec - playhead) * 100) / 100,
        songTitle: null,
        isBetween: false,
        // Inherit kind + classification so songs-only filter still works.
    });
    var newSegs = p.segments.slice(0, idx).concat([first, second]).concat(p.segments.slice(idx + 1));
    p.segments = newSegs;
    // Persist back to Firebase.
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/analysis/story/segments'))
                .set(newSegs);
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/analysis/story/manualSplitsAt'))
                .set(nowIso);
        } catch (e) {
            console.warn('[Multitrack] segment split persist failed:', e && e.message);
            if (typeof showToast === 'function') showToast('Split UI applied but Firebase save failed: ' + (e && e.message));
        }
    }
    _mtRenderSegmentsPanel();
    _mtRenderSegmentMarkers();
    if (typeof showToast === 'function') showToast('✂ Split at ' + _mtFmtTimeShort(playhead));
};

// ── Phase 2 / Tier 2 — Shared edit primitives + new operations ────────────
// Drew's convergence directive (Tier 5C): merge/split/trim/confirm/exclude/
// rename/retag must be reusable across Review Mode and Chopper. For now we
// expose `_mtSegOps` as a thin namespace; the existing window._mtSegment*
// handlers delegate to it where new code touches them. Full extraction
// from the legacy handlers is a follow-up — current shape doesn't require
// a rewrite to land Phase 2.
// ── Phase 3 / Tier 3 — Learning loop: fingerprint corpus ─────────────────
// Each ✓-confirmed segment becomes a training sample under
//   bands/{slug}/song_fingerprints/{songId}/{sampleId}
// With fields:
//   { bpm, key, duration, sourceSessionId, sourceSegmentId,
//     confirmedAt, confirmedBy }
// On Analyze, the browser fetches the full corpus, reduces by songId
// into priors with median bpm/key/duration + sample count, and passes
// to the Modal analyzer. Analyzer treats fingerprint priors as virtual
// setlist entries with a 1.3x match boost. Over time the band's
// confirmed history makes the analyzer recognize their actual sound
// rather than only doing generic BPM/key matching.

async function _mtFetchFingerprintPriors() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    var snap;
    try {
        snap = await db.ref(bandPath('song_fingerprints')).once('value');
    } catch (e) {
        console.warn('[Multitrack] fingerprint corpus read failed:', e && e.message);
        return [];
    }
    var val = snap && snap.val();
    if (!val) return [];
    var priors = [];
    var titleLookup = {};
    // Build songId → canonical title lookup from allSongs once.
    try {
        var songs = (typeof allSongs !== 'undefined' && Array.isArray(allSongs)) ? allSongs : [];
        songs.forEach(function(s) {
            var sid = s && (s.id || s.songId);
            if (sid && s.title) titleLookup[sid] = s.title;
        });
    } catch (e) {}
    Object.keys(val).forEach(function(songId) {
        var samplesNode = val[songId] || {};
        var samples = [];
        Object.keys(samplesNode).forEach(function(sampleId) {
            var s = samplesNode[sampleId];
            if (!s || typeof s !== 'object') return;
            samples.push({
                bpm: (typeof s.bpm === 'number') ? s.bpm : null,
                key: s.key || null,
                duration: (typeof s.duration === 'number') ? s.duration : null,
            });
        });
        if (!samples.length) return;
        priors.push({
            songId: songId,
            songTitle: titleLookup[songId] || songId,
            samples: samples,
        });
    });
    if (priors.length) {
        var totalSamples = priors.reduce(function(n, p) { return n + p.samples.length; }, 0);
        console.log('[Multitrack] fingerprint priors: ' + priors.length + ' songs · ' + totalSamples + ' total samples');
    }
    return priors;
}

// Phase 4C — Plan priors. Collect songs the band has explicitly
// committed to playing for this rehearsal date and the next gig.
// Source 1: rehearsal_plan_{date} from band Drive (planner-written
// list of songs scheduled for this session). Source 2: setlist of the
// next future gig (gigs from getGigs(), filtered to date > today,
// sorted, first entry; linked setlist by setlistId).
//
// Returns [{songTitle, songId, bpm, key, duration}]. Each title is
// joined to allSongs for canonical metadata. Duplicates are
// deduplicated by lowercased title — if a song is on both today's
// plan and the next gig, it counts once (the boost is multiplicative
// not additive). Failures are non-fatal: returns whatever it could
// gather, [] if nothing.
async function _mtFetchPlanPriors(session) {
    var titles = new Set();
    var sessionDate = (session && session.date) || '';

    // Source 1: today's rehearsal plan.
    if (sessionDate && typeof loadBandDataFromDrive === 'function') {
        try {
            var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + sessionDate) || {};
            var planSongs = (plan && Array.isArray(plan.songs)) ? plan.songs : [];
            planSongs.forEach(function(s) {
                var t = (typeof s === 'string') ? s : (s && (s.title || s.name)) || '';
                if (t) titles.add(t);
            });
        } catch (e) {
            console.warn('[Multitrack] plan priors: rehearsal_plan read failed:', e && e.message);
        }
    }

    // Source 2: next upcoming gig's setlist.
    try {
        var gigs = (typeof GLStore !== 'undefined' && GLStore.getGigs) ? (GLStore.getGigs() || []) : [];
        var today = (new Date()).toISOString().slice(0, 10);
        var futureGigs = gigs.filter(function(g) { return g && g.date && g.date >= today; });
        futureGigs.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
        var nextGig = futureGigs[0];
        if (nextGig && nextGig.setlistId && GLStore.getSetlists) {
            var sls = GLStore.getSetlists() || [];
            var sl = sls.find(function(x) { return x && x.setlistId === nextGig.setlistId; });
            var sets = (sl && Array.isArray(sl.sets)) ? sl.sets : [];
            sets.forEach(function(set) {
                var songs = (set && set.songs) || [];
                songs.forEach(function(sg) {
                    var t = (typeof sg === 'string') ? sg : (sg && (sg.title || sg.name)) || '';
                    if (t) titles.add(t);
                });
            });
        }
    } catch (e) {
        console.warn('[Multitrack] plan priors: next-gig setlist read failed:', e && e.message);
    }

    if (!titles.size) return [];

    // Hydrate each title against allSongs for canonical bpm/key/duration.
    var allSongsArr = (typeof allSongs !== 'undefined' && Array.isArray(allSongs)) ? allSongs : [];
    var lookup = {};
    allSongsArr.forEach(function(s) {
        if (s && s.title) lookup[s.title.toLowerCase()] = s;
    });
    var priors = [];
    titles.forEach(function(title) {
        var song = lookup[title.toLowerCase()] || null;
        var entry = { songTitle: title };
        if (song) {
            if (song.id || song.songId) entry.songId = song.id || song.songId;
            if (typeof song.bpm === 'number' && song.bpm > 0) entry.bpm = song.bpm;
            if (song.key) entry.key = song.key;
            if (typeof song.duration === 'number' && song.duration > 0) entry.duration = song.duration;
        }
        priors.push(entry);
    });
    console.log('[Multitrack] plan priors: ' + priors.length + ' songs (today + next gig)');
    return priors;
}

// Write a confirmed segment to the fingerprint corpus. Called from the
// Confirm handler after Firebase persistence succeeds. Sample is keyed
// by sourceSessionId + sourceSegmentId so re-confirming overwrites the
// same record (idempotent).
async function _mtWriteFingerprintSample(seg) {
    if (!seg || !seg.songId) return;  // need canonical songId to file under
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var p = _mtState.player;
    if (!p) return;
    var sampleId = (p.sessionId || 'session') + '__' + (seg.id || 'seg');
    // Sanitize sampleId for Firebase path constraints (no . # $ [ ] /).
    sampleId = sampleId.replace(/[.#$\[\]/]/g, '_');
    var sample = {
        bpm: (typeof seg.bpm === 'number') ? seg.bpm : null,
        key: seg.key || null,
        duration: (typeof seg.durationSec === 'number') ? seg.durationSec
                : (typeof seg.duration_sec === 'number') ? seg.duration_sec
                : null,
        sourceSessionId: p.sessionId || null,
        sourceSegmentId: seg.id || null,
        confirmedAt: seg.confirmedAt || new Date().toISOString(),
        confirmedBy: seg.confirmedBy || (typeof currentUserEmail !== 'undefined' ? currentUserEmail : null),
    };
    try {
        await db.ref(bandPath('song_fingerprints/' + seg.songId + '/' + sampleId)).set(sample);
        console.log('[Multitrack] fingerprint sample written: ' + seg.songId + '/' + sampleId);
    } catch (e) {
        console.warn('[Multitrack] fingerprint write failed:', e && e.message);
    }
}

// Remove a previously-written fingerprint sample (called when user
// un-confirms a segment). Idempotent if the sample doesn't exist.
async function _mtRemoveFingerprintSample(seg) {
    if (!seg || !seg.songId) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var p = _mtState.player;
    if (!p) return;
    var sampleId = ((p.sessionId || 'session') + '__' + (seg.id || 'seg'))
        .replace(/[.#$\[\]/]/g, '_');
    try {
        await db.ref(bandPath('song_fingerprints/' + seg.songId + '/' + sampleId)).remove();
        console.log('[Multitrack] fingerprint sample removed: ' + seg.songId + '/' + sampleId);
    } catch (e) {
        console.warn('[Multitrack] fingerprint remove failed:', e && e.message);
    }
}

// Tier 3C — Provenance chip HTML. Shows where the match came from:
// 'fingerprint' (training corpus), 'setlist' (band setlist match),
// 'kind_only' (no match, just kind-classified), or missing (no analyzer
// data — pre-Phase-3 segment).
function _mtProvenanceChipHtml(seg) {
    if (!seg || !seg.provenance) return '';
    var src = seg.provenance.matchSource;
    if (!src || src === 'kind_only') return '';
    if (src === 'fingerprint') {
        return '<span title="Matched against your band\'s confirmed-segment fingerprint corpus" style="background:rgba(168,85,247,0.18);border:1px solid rgba(168,85,247,0.4);color:#d8b4fe;border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700">🧠 FINGERPRINT</span>';
    }
    if (src === 'setlist') {
        return '<span title="Matched against the rehearsal\'s setlist by BPM/key/duration" style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.35);color:#a5b4fc;border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700">📋 SETLIST</span>';
    }
    if (src === 'plan') {
        // Phase 4C — strongest prior. Boosted match against today's
        // rehearsal plan or next upcoming gig setlist. The user
        // explicitly told us these songs are on deck, so a match here
        // gets a 1.5× boost in segment.py.
        return '<span title="Matched against today\'s rehearsal plan or upcoming gig setlist (1.5× boost)" style="background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);color:#86efac;border-radius:3px;padding:1px 5px;font-size:0.7em;font-weight:700">🎯 ON PLAN</span>';
    }
    return '';
}

var _mtSegOps = (function() {
    function _ref(p, segId) {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function' || !segId) return null;
        return db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/multitrackSegments/' + segId));
    }
    return {
        // Merge segments[idx] + segments[idx+1] into one. The result
        // inherits the LONGER segment's title (preserves user edit) and
        // the dominant kind ('music' > 'transition' > 'speech' > 'silence').
        // Stamps a new id (orig + '_merged_' + ts) so multitrackSegments
        // overlay can persist independently of either parent.
        merge: async function(idx) {
            var p = _mtState.player;
            if (!p || !Array.isArray(p.segments)) return;
            var a = p.segments[idx];
            var b = p.segments[idx + 1];
            if (!a || !b) {
                if (typeof showToast === 'function') showToast('No next segment to merge with');
                return;
            }
            var aDur = (a.endSec || 0) - (a.startSec || 0);
            var bDur = (b.endSec || 0) - (b.startSec || 0);
            var kindRank = { music: 3, transition: 2, speech: 1, silence: 0 };
            var aEff = _mtSegmentEffectiveKind(a) || 'silence';
            var bEff = _mtSegmentEffectiveKind(b) || 'silence';
            var winnerKind = (kindRank[aEff] >= kindRank[bEff]) ? aEff : bEff;
            var winnerTitle = (aDur >= bDur) ? (a.songTitle || null) : (b.songTitle || null);
            var winnerSongId = (aDur >= bDur) ? (a.songId || null) : (b.songId || null);
            if (!confirm('Merge "' + (a.songTitle || a.label || 'segment ' + idx) + '" with "' + (b.songTitle || b.label || 'segment ' + (idx+1)) + '"?\n\nThe combined segment inherits "' + winnerKind + '" kind' + (winnerTitle ? ' and title "' + winnerTitle + '"' : '') + '.')) {
                return;
            }
            var newId = (a.id || ('seg_' + idx)) + '_merged_' + Date.now();
            var merged = Object.assign({}, a, {
                id: newId,
                startSec: Math.min(a.startSec, b.startSec),
                endSec: Math.max(a.endSec, b.endSec),
                durationSec: Math.round((Math.max(a.endSec, b.endSec) - Math.min(a.startSec, b.startSec)) * 100) / 100,
                userKind: winnerKind,
                songTitle: winnerTitle,
                songId: winnerSongId,
                // Reset review state — user should explicitly confirm the merged result.
                reviewState: null,
                confirmedAt: null,
                confirmedBy: null,
                isBetween: false,
                // Note source for provenance.
                mergedFrom: [a.id, b.id],
                mergedAt: new Date().toISOString(),
            });
            var newSegs = p.segments.slice(0, idx).concat([merged]).concat(p.segments.slice(idx + 2));
            p.segments = newSegs;
            var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
            if (db && typeof bandPath === 'function') {
                try {
                    await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/analysis/story/segments'))
                        .set(newSegs);
                    await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/analysis/story/manualMergesAt'))
                        .set(new Date().toISOString());
                } catch (e) {
                    console.warn('[Multitrack] merge persist failed:', e && e.message);
                    if (typeof showToast === 'function') showToast('Merge UI applied but Firebase save failed: ' + (e && e.message));
                }
            }
            _mtRenderSegmentsPanel();
            _mtRenderSegmentMarkers();
            if (typeof showToast === 'function') showToast('⛓ Merged');
        },
        // Trim a segment's start or end by a signed delta in seconds.
        // edge: 'start' | 'end'. deltaSec: positive or negative.
        // Clamps so we never cross into a neighbor or invert the range.
        trim: async function(idx, edge, deltaSec) {
            var p = _mtState.player;
            if (!p || !Array.isArray(p.segments)) return;
            var seg = p.segments[idx];
            if (!seg) return;
            var prev = p.segments[idx - 1];
            var next = p.segments[idx + 1];
            var minStart = prev ? (prev.endSec || 0) : 0;
            var maxEnd = next ? (next.startSec || 99999) : 99999;
            var newStart = seg.startSec, newEnd = seg.endSec;
            if (edge === 'start') {
                newStart = Math.max(minStart, Math.min(seg.endSec - 1.0, seg.startSec + deltaSec));
            } else if (edge === 'end') {
                newEnd = Math.min(maxEnd, Math.max(seg.startSec + 1.0, seg.endSec + deltaSec));
            }
            if (newStart === seg.startSec && newEnd === seg.endSec) {
                if (typeof showToast === 'function') showToast('Trim clamped — already at neighbor edge');
                return;
            }
            seg.startSec = newStart;
            seg.endSec = newEnd;
            seg.durationSec = Math.round((newEnd - newStart) * 100) / 100;
            var ref = _ref(p, seg.id);
            if (ref) {
                try { await ref.update({ startSec: seg.startSec, endSec: seg.endSec }); }
                catch (e) { console.warn('[Multitrack] trim persist failed:', e && e.message); }
            }
            _mtRenderSegmentsPanel();
            _mtRenderSegmentMarkers();
        },
        // Set the user-kind override (S/C/T keystrokes). null clears it.
        setKind: async function(idx, userKind) {
            var p = _mtState.player;
            if (!p || !Array.isArray(p.segments)) return;
            var seg = p.segments[idx];
            if (!seg) return;
            var allowed = ['music', 'speech', 'silence', 'transition', null];
            if (allowed.indexOf(userKind) === -1) return;
            seg.userKind = userKind;
            var ref = _ref(p, seg.id);
            if (ref) {
                try { await ref.update({ userKind: userKind }); }
                catch (e) { console.warn('[Multitrack] setKind persist failed:', e && e.message); }
            }
            _mtRenderSegmentsPanel();
            _mtRenderSegmentMarkers();
            if (typeof showToast === 'function') showToast('Kind → ' + (userKind || 'auto'));
        },
    };
})();

window._mtSegmentMerge = function(idx) { return _mtSegOps.merge(idx); };
window._mtSegmentTrim = function(idx, edge, delta) { return _mtSegOps.trim(idx, edge, delta); };
window._mtSegmentSetKind = function(idx, k) { return _mtSegOps.setKind(idx, k); };

// Phase 2D — Keyboard shortcuts. When focus is on a segment row (the
// row container is tabindex=0), keystrokes operate on that row:
//   S      → mark as Song (userKind='music')
//   C      → mark as Chatter (userKind='speech')
//   T      → mark as Transition (userKind='transition')
//   X      → toggle Exclude
//   Enter  → toggle Confirm
//   ↑ / ↓  → move focus to prev/next row
//
// Skipped when focus is on an input/textarea/select (so typing a song
// title doesn't trigger keyboard ops). Skipped when modal overlays are
// open (analyze, custom mix, etc) to avoid hijacking.
function _mtSegmentsKeydown(e) {
    var p = _mtState.player;
    if (!p || !Array.isArray(p.segments)) return;
    // Bail when typing in a text field.
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    // Bail when a modal overlay is open (analyze, custom mix, segment edit, etc).
    if (document.getElementById('mtAnalyzeModal')
     || document.getElementById('mtCustomMixModal')
     || document.getElementById('mtSegmentModal')
     || document.getElementById('mtHeaderEditModal')) return;
    // Bail when shift/ctrl/meta — leave browser shortcuts alone.
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;

    // Find the row that currently has focus. If none has focus but the
    // user pressed one of our keys, fall back to the first visible row.
    var focused = document.activeElement;
    var row = (focused && focused.closest) ? focused.closest('#mtSegmentsList [data-seg-idx]') : null;
    if (!row) row = document.querySelector('#mtSegmentsList [data-seg-idx]');
    if (!row) return;
    var idx = parseInt(row.getAttribute('data-seg-idx'), 10);
    if (!isFinite(idx)) return;

    var key = e.key;
    var keyLower = (typeof key === 'string') ? key.toLowerCase() : '';
    var handled = true;
    switch (keyLower) {
        case 's': _mtSegOps.setKind(idx, 'music'); break;
        case 'c': _mtSegOps.setKind(idx, 'speech'); break;
        case 't': _mtSegOps.setKind(idx, 'transition'); break;
        case 'x': window._mtSegmentToggleBetween(idx); break;
        case 'enter': window._mtSegmentConfirm(idx); break;
        case 'arrowdown': {
            var next = row.nextElementSibling;
            // Skip the inline trim panel (which is part of the prior row).
            while (next && !next.hasAttribute('data-seg-idx')) next = next.nextElementSibling;
            if (next) next.focus();
            break;
        }
        case 'arrowup': {
            var prev = row.previousElementSibling;
            while (prev && !prev.hasAttribute('data-seg-idx')) prev = prev.previousElementSibling;
            if (prev) prev.focus();
            break;
        }
        default: handled = false;
    }
    if (handled) e.preventDefault();
}

// Per-row trim expansion state. Tracks which row's trim controls are
// expanded inline below the segment row. Only one open at a time.
window._mtSegmentToggleTrim = function(idx) {
    var p = _mtState.player;
    if (!p) return;
    p._trimOpenIdx = (p._trimOpenIdx === idx) ? null : idx;
    _mtRenderSegmentsPanel();
};

window._mtSegmentJump = function(idx) {
    var p = _mtState.player;
    if (!p || !Array.isArray(p.audios) || !p.audios[0]) return;
    var seg = p.segments && p.segments[idx];
    if (!seg) return;
    var start = (typeof seg.startSec === 'number') ? seg.startSec : 0;
    var dur = p.audios[0].duration;
    if (!isFinite(dur) || dur <= 0) return;
    var pct = Math.max(0, Math.min(100, (start / dur) * 100));
    var slider = document.getElementById('mtMasterSeek');
    if (slider) slider.value = pct;
    window._mtSeekMaster(pct);
    // Drew (UAT 2026-05-24): "Should jump to segment start also begin
    // playing instead of just going to the top of the segment and
    // stopping?" Yes — Jump is the "play this song" button intent. If
    // playback isn't already going, kick it off after the seek lands.
    if (!p.masterPlaying) {
        // Slight delay so the seek's currentTime writes settle before
        // _mtTogglePlayAll snaps everything to audios[0].currentTime.
        setTimeout(function() {
            if (_mtState.player === p && !p.masterPlaying) {
                window._mtTogglePlayAll();
            }
        }, 80);
    }
};

function _mtRenderSegmentMarkers() {
    var p = _mtState.player;
    if (!p || !p.audios[0]) return;
    var dur = p.audios[0].duration;
    if (!isFinite(dur) || dur <= 0) return;
    // Reuse the existing #mtSeekMarkers container the comment renderer uses
    var container = document.getElementById('mtSeekMarkers');
    if (!container) return;
    // Drop any prior segment markers (class mt-seg-marker); leave comment ones
    Array.from(container.querySelectorAll('.mt-seg-marker')).forEach(function(n) { n.remove(); });
    (p.segments || []).forEach(function(s, i) {
        if (s.startSec == null) return;
        var pct = (s.startSec / dur) * 100;
        if (pct < 0 || pct > 100) return;
        var marker = document.createElement('button');
        marker.className = 'mt-seg-marker';
        marker.dataset.segIdx = i;
        marker.title = (s.songTitle || s.label || 'segment') + ' · click to name';
        marker.onclick = function(ev) { ev.stopPropagation(); _mtSegmentClick(i); };
        var color = s.isBetween ? '#64748b' : (s.songTitle ? '#22c55e' : '#a5b4fc');
        marker.style.cssText = 'position:absolute;left:' + pct + '%;top:0;height:14px;width:3px;background:' + color + ';border:none;padding:0;cursor:pointer;border-radius:1.5px;pointer-events:auto;transform:translateX(-50%)';
        container.appendChild(marker);
    });
}

window._mtSegmentClick = function(idx) {
    var p = _mtState.player;
    if (!p || !p.segments || !p.segments[idx]) return;
    var seg = p.segments[idx];

    // Build a song-picker from the band's active songs library.
    var songs = [];
    try {
        if (typeof GLStore !== 'undefined' && GLStore.getSongs) {
            songs = (GLStore.getSongs() || []).filter(function(s) {
                return s && (typeof GLStore.isActiveSong === 'function' ? GLStore.isActiveSong(s.title) : true);
            }).map(function(s) { return s.title; }).sort();
        }
    } catch (e) {}
    var songOptions = '<option value="">— pick a song —</option>'
        + songs.map(function(t) {
            var sel = (seg.songTitle === t) ? ' selected' : '';
            return '<option value="' + escHtml(t) + '"' + sel + '>' + escHtml(t) + '</option>';
        }).join('');

    var startMmss = _mtFmtTime(seg.startSec || 0);
    var endMmss = _mtFmtTime(seg.endSec || seg.startSec || 0);
    var modal = document.createElement('div');
    modal.id = 'mtSegmentModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';
    modal.innerHTML = '<div style="max-width:460px;width:100%;background:#0f172a;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.08)">'
        + '<div style="font-weight:800;font-size:1em;color:#f1f5f9;margin-bottom:6px">🎵 Name this segment</div>'
        + '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:14px">' + escHtml(startMmss) + ' → ' + escHtml(endMmss) + ' · ' + Math.round((seg.endSec || seg.startSec || 0) - (seg.startSec || 0)) + 's</div>'
        + '<label style="display:block;font-size:0.74em;font-weight:700;color:var(--text-dim);margin-bottom:4px">Song</label>'
        + '<select id="mtSegSong" class="app-select" style="width:100%;font-size:0.9em;margin-bottom:12px">' + songOptions + '</select>'
        + '<label style="display:flex;align-items:center;gap:8px;font-size:0.82em;color:var(--text);margin-bottom:14px;cursor:pointer">'
        + '<input type="checkbox" id="mtSegBetween"' + (seg.isBetween ? ' checked' : '') + ' style="accent-color:#a5b4fc">'
        + '<span>Between songs — mark as trim-fat / discussion gap</span>'
        + '</label>'
        + '<div style="display:flex;gap:8px;justify-content:flex-end">'
        + '<button onclick="document.getElementById(\'mtSegmentModal\').remove()" class="btn btn-ghost btn-sm">Cancel</button>'
        + '<button onclick="_mtSegmentSave(' + idx + ')" class="btn btn-primary btn-sm">💾 Save</button>'
        + '</div>'
        + '</div>';
    document.body.appendChild(modal);
};

window._mtSegmentSave = async function(idx) {
    var p = _mtState.player;
    if (!p || !p.segments || !p.segments[idx]) return;
    var seg = p.segments[idx];
    var songEl = document.getElementById('mtSegSong');
    var betweenEl = document.getElementById('mtSegBetween');
    seg.songTitle = (songEl && songEl.value) ? songEl.value : '';
    seg.isBetween = !!(betweenEl && betweenEl.checked);
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + p.sessionId + '/multitrackSegments/' + seg.id)).set({
                songTitle: seg.songTitle,
                isBetween: seg.isBetween,
                startSec: seg.startSec,
                endSec: seg.endSec,
                updatedAt: new Date().toISOString()
            });
        } catch (e) { console.warn('[Multitrack] segment save failed:', e); }
    }
    var modal = document.getElementById('mtSegmentModal');
    if (modal) modal.remove();
    _mtRenderSegmentMarkers();
    _mtRenderSegmentsPanel();
    if (typeof showToast === 'function') showToast('✓ Segment saved');
};

function _mtRenderMixPresetBar() {
    var bar = document.getElementById('mtMixPresetBar');
    if (!bar) return;
    var p = _mtState.player;
    var presets = (p && p.mixPresets) || [];
    var presetHtml = presets.map(function(pr) {
        return '<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:3px 4px 3px 8px;font-size:0.74em;margin-right:6px">'
            + '<button onclick="_mtLoadMixPreset(\'' + escHtml(pr._key) + '\')" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:0.92em;padding:0">' + escHtml(pr.name) + '</button>'
            + '<button onclick="_mtDeleteMixPreset(\'' + escHtml(pr._key) + '\')" title="Delete preset" style="background:none;border:none;color:#64748b;cursor:pointer;padding:0 4px;font-size:1em;line-height:1">×</button>'
            + '</div>';
    }).join('');
    bar.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        + '<span style="font-size:0.72em;color:var(--text-dim);font-weight:700;letter-spacing:0.04em">MIX</span>'
        + (presets.length ? presetHtml : '<span style="font-size:0.72em;color:var(--text-dim);font-style:italic">No saved presets yet</span>')
        + '<button onclick="_mtSaveMixPreset()" title="Save current mute/solo/volume/reverb as a named preset" style="margin-left:auto;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:6px;color:#a5b4fc;padding:4px 10px;cursor:pointer;font-size:0.74em;font-weight:700">+ Save mix</button>'
        + '</div>';
}

window._mtSeekMaster = function(pct) {
    var p = _mtState.player;
    if (!p || !p.audios[0]) return;
    var dur = p.audios[0].duration;
    if (!isFinite(dur) || dur <= 0) return;
    var t = (parseFloat(pct) / 100) * dur;

    // §8.2 Concurrent-seek debounce (interim fix from the multitrack
    // playback audit). In Isolate Mode a far seek can take 20-30s of
    // buffer-fill across 17 streams. If the user scrubs again during
    // that wait, the prior 17 range fetches are still in flight and
    // serializing through the 6-connection-per-origin cap. Suppress
    // duplicate seeks within 750ms (leading-edge debounce) so only
    // the LATEST scrub target is applied. Review Mode has 1 stream
    // so this is harmless there.
    var now = Date.now();
    if (p._lastSeekAt && (now - p._lastSeekAt) < 750) {
        // Stash the latest desired position; when the active seek's
        // settle timer fires it will re-apply the most recent value.
        p._pendingSeekPct = pct;
        if (!p._pendingSeekTimer) {
            p._pendingSeekTimer = setTimeout(function() {
                p._pendingSeekTimer = null;
                var lastPct = p._pendingSeekPct;
                p._pendingSeekPct = null;
                if (lastPct != null && _mtState.player === p) {
                    window._mtSeekMaster(lastPct);
                }
            }, 750);
        }
        return;
    }
    p._lastSeekAt = now;

    var wasPlaying = p.masterPlaying;
    if (wasPlaying) {
        p.audios.forEach(function(a) { try { a.pause(); } catch (e) {} });
    }
    p.audios.forEach(function(a) { try { a.currentTime = t; } catch (e) {} });

    if (!wasPlaying) {
        _mtMaybeUpdateMasterPosition();
        return;
    }

    // Far-seek strategy: HTML5 <audio> can't be perfectly sync-started across
    // 17 streaming elements. After a far seek (e.g. -80 min), each element's
    // buffer arrives at a different wall-clock time. If we call play() on
    // all 17 at once, the loaded ones start; the unloaded ones stall, then
    // auto-resume from their OWN currentTime (still the seek target) while
    // the playing tracks have already advanced — producing permanent drift
    // (Drew, 2026-05-24: "tracks come in one by one, full drift").
    //
    // The fix: late tracks must rejoin AT THE CURRENT MASTER POSITION, not
    // at their original seek target. Flow:
    //   1. Wait for master audio (index 0) to be ready (or 20 s fallback)
    //   2. Play tracks that are also ready at that moment — synced start
    //   3. For each NOT-yet-ready track: on canplay → re-seek it to whatever
    //      master.currentTime is NOW → then play. They join late but
    //      synchronized, instead of staggered with permanent drift.
    var playBtn = document.getElementById('mtPlayAll');
    var totalCount = p.audios.length;
    var seekToken = (p._seekToken || 0) + 1;
    p._seekToken = seekToken;
    var startedPlayback = false;
    var startedCount = 0;
    var initialWaitTimer = null;
    var progressTimer = null;
    var bufferTick = null;

    function isStale() { return p._seekToken !== seekToken; }
    function isCancelled() {
        return !_mtState.player || !_mtState.player.masterPlaying;
    }
    function updateBtnBuffering() {
        if (startedPlayback || !playBtn || isStale()) return;
        var ready = 0;
        p.audios.forEach(function(a) { if (a.readyState >= 3) ready++; });
        playBtn.textContent = '⏳ ' + ready + '/' + totalCount;
    }
    function updateBtnPlaying() {
        if (!playBtn || isStale()) return;
        if (startedCount >= totalCount) {
            playBtn.textContent = '⏸ Pause';
        } else {
            playBtn.textContent = '⏸ ' + startedCount + '/' + totalCount;
        }
    }
    function safePlay(a) {
        var pr = a.play();
        if (pr && typeof pr.catch === 'function') {
            pr.catch(function(err) {
                if (err && err.name === 'AbortError') return;
                console.warn('[Multitrack] play() rejected for', a.dataset.trackId, err && err.name);
            });
        }
    }
    function catchUpWhenReady(a) {
        // Latecomer: wait for canplay, re-seek to the CURRENT playhead
        // (median across playing tracks, NOT audios[0] — that may be the
        // bad-buffering stem itself), then play.
        var handler = function() {
            a.removeEventListener('canplay', handler);
            if (isStale() || isCancelled()) return;
            if (a.readyState < 3) {
                a.addEventListener('canplay', handler);
                return;
            }
            var masterPos = _mtCurrentPlayheadSec();
            try { a.currentTime = masterPos; } catch (e) {}
            // Brief settle so the re-seek range fetch lands before play.
            setTimeout(function() {
                if (isStale() || isCancelled()) return;
                safePlay(a);
                startedCount++;
                updateBtnPlaying();
            }, 50);
        };
        a.addEventListener('canplay', handler);
    }
    function startPlayback() {
        if (startedPlayback || isStale() || isCancelled()) return;
        startedPlayback = true;
        if (initialWaitTimer) { clearTimeout(initialWaitTimer); initialWaitTimer = null; }
        if (bufferTick) { clearInterval(bufferTick); bufferTick = null; }
        p.audios.forEach(function(a) {
            if (a.readyState >= 3) {
                safePlay(a);
                startedCount++;
            } else {
                catchUpWhenReady(a);
            }
        });
        updateBtnPlaying();
        progressTimer = setInterval(function() {
            if (isStale() || isCancelled() || startedCount >= totalCount) {
                clearInterval(progressTimer);
                progressTimer = null;
                if (!isStale() && !isCancelled() && playBtn) {
                    playBtn.textContent = '⏸ Pause';
                }
                return;
            }
            updateBtnPlaying();
        }, 500);
    }

    updateBtnBuffering();

    // Phase 1: wait until ANY track is ready (don't pin to audios[0] — one
    // bad-buffering stem there freezes the whole player, which Drew hit
    // 2026-05-24 with Kick · Jay). First ready track triggers the start;
    // others either join immediately or via catchUpWhenReady.
    function anyReady() {
        for (var i = 0; i < p.audios.length; i++) {
            if (p.audios[i].readyState >= 3) return true;
        }
        return false;
    }

    if (anyReady()) {
        startPlayback();
    } else {
        var firstReadyHandlers = [];
        function onAnyReady() {
            firstReadyHandlers.forEach(function(rec) {
                rec.a.removeEventListener('canplay', rec.fn);
            });
            firstReadyHandlers = [];
            if (isStale() || isCancelled()) return;
            startPlayback();
        }
        p.audios.forEach(function(a) {
            var fn = function() { onAnyReady(); };
            firstReadyHandlers.push({ a: a, fn: fn });
            a.addEventListener('canplay', fn);
        });
        // Heartbeat: update buffering counter while we wait.
        bufferTick = setInterval(function() {
            if (startedPlayback || isStale() || isCancelled()) {
                clearInterval(bufferTick);
                bufferTick = null;
                return;
            }
            updateBtnBuffering();
        }, 250);
        // Fallback: 20 s — if no track has fired canplay (unlikely with 17
        // streams), start anyway. Browsers will keep buffering and the
        // catch-up handlers continue to chase the playhead.
        initialWaitTimer = setTimeout(function() {
            if (startedPlayback || isStale() || isCancelled()) return;
            console.warn('[Multitrack] no track buffered in 20s — starting anyway');
            startPlayback();
        }, 20000);
    }

    _mtMaybeUpdateMasterPosition();
};

// Live preview during a seek drag — updates the time label only, no
// audio.currentTime writes. Final commit happens on `change` (release).
// Without this, dragging the slider triggered 17 simultaneous seeks per
// pixel, locking up playback for several seconds.
window._mtSeekPreview = function(pct) {
    var p = _mtState.player;
    if (!p || !p.audios[0]) return;
    var dur = p.audios[0].duration;
    if (!isFinite(dur) || dur <= 0) return;
    var t = (parseFloat(pct) / 100) * dur;
    var label = document.getElementById('mtTimeLabel');
    if (label) label.textContent = _mtFmtTime(t) + ' / ' + _mtFmtTime(dur);
};

// Skip the master playhead by a fixed delta. Bounded to [0, duration].
window._mtSkipBy = function(deltaSec) {
    var p = _mtState.player;
    if (!p || !p.audios[0]) return;
    var dur = p.audios[0].duration;
    if (!isFinite(dur) || dur <= 0) return;
    // Use median playhead as the reference, not audios[0] (which may be
    // stuck/stalled). Without this, skipping while index 0 is frozen
    // would compute deltas off a stale reference and re-seek everything
    // to the same wrong time.
    var refTime = _mtCurrentPlayheadSec();
    var t = Math.max(0, Math.min(dur, refTime + deltaSec));
    p.audios.forEach(function(a) { try { a.currentTime = t; } catch (e) {} });
    _mtMaybeUpdateMasterPosition();
};

// Press-and-hold support for skip buttons. Single click = one skip (the
// initial call on mousedown). Hold = continuous skip every 200ms, with
// acceleration over time so a long hold scans through minutes quickly.
window._mtHoldStart = function(deltaSec) {
    var p = _mtState.player;
    if (!p) return;
    if (p._holdTimer) clearInterval(p._holdTimer);
    _mtSkipBy(deltaSec); // immediate single jump
    var rate = 1;
    p._holdTimer = setInterval(function() {
        _mtSkipBy(deltaSec * rate);
        // Ramp from 1x → 10x over ~3 seconds of holding
        rate = Math.min(rate * 1.25, 10);
    }, 200);
};

window._mtHoldStop = function() {
    var p = _mtState.player;
    if (!p) return;
    if (p._holdTimer) {
        clearInterval(p._holdTimer);
        p._holdTimer = null;
    }
};

// ── Drift handling — passive, no continuous watchdog ─────────────────────
// Earlier tonight we tried two automatic drift-correction schemes:
//   1. Hard-snap watchdog (every 4s): caused audible glitches on snap
//   2. Soft rate-adjustment watchdog (every 1s): caused glitches every
//      4-8s and at one point looped a 1s segment at 58min mark.
//
// Both failed for the same root reason: HTML5 <audio> reports
// currentTime only at decode boundaries (~250ms granularity), so the
// "drift" we measure includes 100-200ms of jitter that isn't real drift.
// Acting on phantom drift produces audible artifacts (rate flicks,
// re-buffers) that are worse than the drift itself.
//
// New approach: NO continuous watchdog. Let tracks drift naturally
// during playback. Re-sync only fires on user-initiated events:
//   - Play (existing): all tracks snap to audios[0].currentTime
//   - Seek (existing): all tracks set to the new position
//   - Manual 🔄 Re-sync button (new): explicit user re-sync
//
// For long review sessions the user notices drift and hits Re-sync;
// for typical short reviews (one song at a time) the tracks stay
// in sync naturally from the play-start alignment. Trade-off accepted.
//
// Proper architectural fix lives in the render-pipeline proposal
// (specs/rehearsal_render_pipeline.md) — server-renders a stereo
// master mix that has no drift by definition.
function _mtStartSyncWatchdog(p) {
    // Intentional no-op. Kept as a hook so callers don't break.
    // Re-introduce only if a future strategy (e.g. AudioBufferSource +
    // chunked decode) is implemented.
}

// Clear-all mix reset — wipes every per-track adjustment + master reverb,
// returning the player to a flat unity baseline. Persists via the normal
// debounced mixState save.
window._mtClearAllMix = function() {
    var p = _mtState.player;
    if (!p) return;
    if (!confirm('Reset all tracks?\n\nClears every mute + solo, sets all volumes back to 100%, turns off all reverb sends, and zeros the master reverb. Mix presets are kept; only the current live state is reset.')) return;
    p.muted = {};
    p.soloed = {};
    p.mixState = p.mixState || {};
    p.mixState.volumes = {};
    p.mixState.reverbSends = {};
    p.mixState.reverbWet = 0;
    // Reset UI: every track row's mute/solo/FX buttons + volume slider
    (p.tracks || []).forEach(function(t) {
        var muteBtn = document.getElementById('mtMute_' + t.trackId);
        if (muteBtn) {
            muteBtn.style.background = 'rgba(255,255,255,0.04)';
            muteBtn.style.color = 'var(--text-dim)';
        }
        var soloBtn = document.getElementById('mtSolo_' + t.trackId);
        if (soloBtn) {
            soloBtn.style.background = 'rgba(255,255,255,0.04)';
            soloBtn.style.color = 'var(--text-dim)';
        }
        var fxBtn = document.getElementById('mtFx_' + t.trackId);
        if (fxBtn) {
            // Default = OFF after clear (Drew's expectation: "clear all reverbs")
            fxBtn.style.background = 'rgba(255,255,255,0.04)';
            fxBtn.style.color = 'var(--text-dim)';
        }
        var volSlider = document.getElementById('mtVol_' + t.trackId);
        if (volSlider) volSlider.value = 100;
        var volLabel = document.getElementById('mtVolLabel_' + t.trackId);
        if (volLabel) volLabel.textContent = '100%';
        // Web Audio graph updates (if initialized)
        var chain = p.trackChains && p.trackChains[t.trackId];
        if (chain && p.audioCtx) {
            try {
                chain.gain.gain.setTargetAtTime(1.0, p.audioCtx.currentTime, 0.02);
                if (chain.reverbSend) chain.reverbSend.gain.setTargetAtTime(0, p.audioCtx.currentTime, 0.02);
            } catch (e) {}
        }
    });
    // Reset master reverb slider
    var revSlider = document.getElementById('mtReverbSlider');
    if (revSlider) revSlider.value = 0;
    var revLabel = document.getElementById('mtReverbLabel');
    if (revLabel) revLabel.textContent = '0%';
    if (p.reverbWet && p.audioCtx) {
        try { p.reverbWet.gain.setTargetAtTime(0, p.audioCtx.currentTime, 0.05); } catch (e) {}
    }
    // Apply mute/solo (now empty) so all audio.muted flags clear
    _mtApplyMuteSolo();
    // Refresh comment panel since the per-track filter may change
    _mtRefreshCommentPanel();
    _mtSaveMixStateDebounced();
    if (typeof showToast === 'function') showToast('🧹 Mix cleared');
};

window._mtResyncAll = function() {
    var p = _mtState.player;
    if (!p || !p.audios || !p.audios.length) return;
    // Use median playhead, not audios[0] — index 0 may itself be drifted
    // or stuck. Median of all playing tracks is the robust reference.
    var refTime = _mtCurrentPlayheadSec();
    p.audios.forEach(function(a) {
        try { a.currentTime = refTime; } catch (e) {}
        a.playbackRate = 1.0;
    });
    if (typeof showToast === 'function') showToast('🔄 Tracks re-synced');
};

function _mtStopSyncWatchdog(p) {
    if (p && p._syncTimer) {
        clearInterval(p._syncTimer);
        p._syncTimer = null;
    }
}

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

// Dynamic playhead: the "current time" for display + latecomer sync is the
// MEDIAN currentTime of all ready+playing tracks. Falls back to audios[0]
// if nothing is playing yet. Index 0 (Kick · Jay) used to be the canonical
// master, but Drew 2026-05-24 hit the case where Kick's FLAC failed to
// buffer at all on a far seek — the whole sync system froze because every
// other track was syncing TO a stuck reference. Median across playing
// tracks tolerates one bad-buffering stem.
function _mtCurrentPlayheadSec() {
    var p = _mtState.player;
    if (!p || !p.audios || !p.audios.length) return 0;
    var times = [];
    p.audios.forEach(function(a) {
        if (!a.paused && a.readyState >= 3 && isFinite(a.currentTime)) {
            times.push(a.currentTime);
        }
    });
    if (!times.length) {
        return (p.audios[0] && isFinite(p.audios[0].currentTime)) ? p.audios[0].currentTime : 0;
    }
    times.sort(function(a, b) { return a - b; });
    var mid = Math.floor(times.length / 2);
    return times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
}

function _mtMaybeUpdateMasterPosition() {
    var p = _mtState.player;
    if (!p) return;
    var a0 = p.audios[0];
    if (!a0 || !isFinite(a0.duration) || a0.duration <= 0) return;
    var t = _mtCurrentPlayheadSec();
    var pct = (t / a0.duration) * 100;
    var seek = document.getElementById('mtMasterSeek');
    if (seek && document.activeElement !== seek) seek.value = pct;
    var label = document.getElementById('mtTimeLabel');
    if (label) label.textContent = _mtFmtTime(t) + ' / ' + _mtFmtTime(a0.duration);
    // Tier 1F — keep the active-segment highlight in sync with playback.
    // Cheap (linear scan over ~50 segments); browsers fire timeupdate at
    // 4-25 Hz so this runs plenty often without us touching every frame.
    if (typeof _mtUpdateActiveSegmentHighlight === 'function') {
        _mtUpdateActiveSegmentHighlight();
    }
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

// ── Phase A.5 — Review Mode render banner subscriber ──────────────────────
// Once-only listener that reacts to `glRenderJobUpdated` events from
// GLMultitrackRenders. Keeps the in-modal status panel + the Review Mode
// banner in sync regardless of whether the user has the Custom Mix modal
// open. When a render completes while the user is on a different page or
// has closed the modal, the banner updates and a toast fires so the user
// notices the result landed.
if (typeof window !== 'undefined' && !window._mtRenderListenerAttached) {
    window._mtRenderListenerAttached = true;
    document.addEventListener('glRenderJobUpdated', function(ev) {
        try {
            var d = (ev && ev.detail) || {};
            var p = _mtState.player;
            // Only react when the event is for the currently-open session.
            if (!p || !p.sessionId || p.sessionId !== d.sessionId) return;

            // Keep modal status panel fresh (no-op if modal not open).
            _mtRenderCustomMixStatus();

            // Skip preview job notifications — they have their own inline
            // player surfaced inside the modal. Banner shows full renders.
            if (d.isPreview) return;

            var banner = document.getElementById('mtReviewStatusBanner');
            var modalOpen = !!document.getElementById('mtCustomMixModal');

            if (d.status === 'processing') {
                if (banner) {
                    // Look up the job so we have startedAt + serverPhase for
                    // accurate elapsed-label.
                    var jp = (typeof GLMultitrackRenders !== 'undefined' && GLMultitrackRenders.findInFlightForSession)
                        ? GLMultitrackRenders.findInFlightForSession(p.sessionId, { isPreview: false }) : null;
                    if (jp) {
                        var elapsedSec = Math.max(0, Math.round((Date.now() - jp.startedAt) / 1000));
                        var elapsedLabel = elapsedSec < 60
                            ? elapsedSec + 's'
                            : Math.floor(elapsedSec / 60) + 'm ' + String(elapsedSec % 60).padStart(2, '0') + 's';
                        var phaseLabel = (jp.serverPhase && jp.serverPhase.phase) ? ' · ' + jp.serverPhase.phase : '';
                        banner.innerHTML = '🎬 Custom mix rendering · ' + elapsedLabel + ' elapsed' + phaseLabel;
                    }
                }
                return;
            }

            if (d.status === 'completed' && d.publicUrl) {
                // Persist the renderInfo on the player so other subsystems
                // (re-open Review Mode etc.) see the latest mix.
                p.renderInfo = {
                    url: d.publicUrl,
                    renderId: d.jobId || null,
                };
                if (banner) {
                    banner.innerHTML = '✓ Custom mix ready — ' + (modalOpen ? 'modal will close' : '<button onclick="(function(){var a=document.getElementById(\'mtReviewAudio\');if(a){a.src=\'' + d.publicUrl.replace(/'/g, "\\'") + '\';a.load();a.play().catch(function(){});}})()" style="background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.4);border-radius:4px;color:#a5b4fc;padding:3px 9px;cursor:pointer;font-size:0.85em;font-weight:700">▶ Play</button>');
                }
                // If the modal is NOT open, the foreground completion path
                // in _mtCustomMixRender never ran, so swap audio.src + toast
                // here. Modal-open case is already handled inline.
                if (!modalOpen) {
                    var audio = document.getElementById('mtReviewAudio');
                    if (audio) {
                        audio.src = d.publicUrl;
                        audio.load();
                    }
                    if (typeof showToast === 'function') showToast('✓ Custom mix ready');
                }
                return;
            }

            if (d.status === 'failed') {
                if (banner) {
                    banner.innerHTML = '✗ Render failed — <button onclick="_mtOpenCustomMixModal()" style="background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.4);border-radius:4px;color:#fca5a5;padding:3px 9px;cursor:pointer;font-size:0.85em;font-weight:700">Retry</button>';
                }
                if (!modalOpen && typeof showToast === 'function') {
                    showToast('Render failed — tap Multitrack to retry');
                }
                return;
            }
        } catch (e) {
            console.warn('[Multitrack] render listener error:', e && e.message);
        }
    });
}

console.log('🎚 multitrack-rehearsal.js loaded (Phase A + B)');
