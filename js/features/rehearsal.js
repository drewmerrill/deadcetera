// =============================================================================
// js/features/rehearsal.js  —  Wave-2 extraction
// =============================================================================
// Contains:
//   • renderRehearsalPage — page entry point
//   • rhLoadEvents, rhEventCard, rhTogglePast, rhOpenEvent
//   • Practice timer: rhTimerRender, rhTimerToggle, rhTimerNext, rhTimerReset,
//                     rhTimerInit, _rhTimerSetGoal
//   • rhRenderScoreboard, rhRenderPlanSongs
//   • RSVP: rhSetRsvp
//   • Plan management: rhAddSongToPlan, rhRemoveSongFromPlan, rhSavePlan,
//                      rhSavePlanData, rhSendToPracticePlan
//   • AI suggestions: rhGenerateSuggestions, rhApplySuggestions
//   • Event modals: rhOpenCreateModal, rhOpenEditModal, rhShowEventModal,
//                   rhSaveEvent, rhDeleteEvent, rhGetAllEvents
//   • rhFormatDate
//
// Load order: AFTER utils.js, firebase-service.js, worker-api.js, navigation.js,
//             songs.js, data.js  — BEFORE app.js
//
// Globals read at CALL TIME (safe — all defined in app.js):
//   allSongs, BAND_MEMBERS_ORDERED, bandPath, firebaseDB, loadBandDataFromDrive,
//   saveBandDataToDrive, showToast, toArray, sanitizeFirebasePath,
//   isUserSignedIn, currentUserEmail, statusCache, readinessCache,
//   preloadReadinessCache, sendToPracticePlan, workerApi
// =============================================================================

// ── Rehearsal Planner block (app.js 18121–18801) ────────────────────────────

// Helper: ensure Add Block menu is open/closed for walkthrough steps
function _rhEnsureAddBlockMenu(open) {
    var menu = document.getElementById('rhAddBlockMenu');
    if (menu) menu.style.display = open ? 'flex' : 'none';
}

// Register rehearsal walkthrough v6
// Each step has a prepare() hook to set the UI state before highlighting.
if (typeof glSpotlight !== 'undefined') {
    glSpotlight.register('rehearsal-plan-v3', [
        { target: '#rhPlanCard',
          prepare: function() { _rhEnsureAddBlockMenu(false); },
          text: 'This is your rehearsal plan. Edit it to match how you actually want to run rehearsal. Focus songs are highlighted with an amber bar.' },
        { target: '#rhAddBlockBtn',
          prepare: function() { _rhEnsureAddBlockMenu(false); },
          text: 'Tap here to add a block \u2014 a song, exercise, jam, band business, or note.' },
        { target: function() {
              var rows = document.querySelectorAll('.rh-unit-row');
              for (var i = 0; i < rows.length; i++) {
                  if (!rows[i].querySelector('[style*="text-transform:uppercase"]')) return rows[i];
              }
              return document.querySelector('.rh-unit-row');
          },
          prepare: function() { _rhEnsureAddBlockMenu(false); },
          text: 'Drag the \u22EE\u22EE handle to reorder blocks. Tap the time to set how long each one takes.' },
        { target: function() { return document.querySelector('[onclick="renderRehearsalPlanner()"]'); },
          prepare: function() { _rhEnsureAddBlockMenu(false); },
          text: 'Edit Plan rebuilds from scratch. Your current plan is saved to Plan History first.' },
        { target: function() { return document.querySelector('[onclick="_rhConfirmStartRehearsal()"]'); },
          prepare: function() { _rhEnsureAddBlockMenu(false); },
          text: 'Start Band Rehearsal begins a tracked session. You\u2019ll see what to fix after.' },
        { target: function() { return document.querySelector('[onclick="_rhOpenChartsOnly()"]'); },
          prepare: function() { _rhEnsureAddBlockMenu(false); },
          text: 'Practice Without Starting a Rehearsal opens your charts with prev/next navigation. No session is saved.' },
        { target: '#rhPlanCard',
          prepare: function() { _rhEnsureAddBlockMenu(false); },
          text: 'Your plan auto-saves to the cloud. The whole band sees the same plan.' }
    ]);
}

// ── Rehearsal start guardrail ──────────────────────────────────────────────
window._rhConfirmStartRehearsal = function() {
    var existing = document.getElementById('rhStartConfirm');
    if (existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'rhStartConfirm';
    ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
    ov.innerHTML = '<div style="max-width:360px;width:100%;background:#1e293b;border-radius:16px;padding:24px;border:1px solid rgba(34,197,94,0.2);text-align:center">'
        + '<div style="font-size:1.1em;font-weight:800;color:#f1f5f9;margin-bottom:8px">Start a band rehearsal?</div>'
        + '<div style="font-size:0.82em;color:#94a3b8;margin-bottom:20px;line-height:1.4">Nothing is saved until you finish. You can discard it later if needed.</div>'
        + '<button onclick="document.getElementById(\'rhStartConfirm\').remove();_rhLaunchSavedPlan()" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.95em;cursor:pointer;margin-bottom:8px">\u25B6 Start Rehearsal</button>'
        + '<button onclick="document.getElementById(\'rhStartConfirm\').remove();_rhOpenChartsOnly()" style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(99,102,241,0.2);background:none;color:#a5b4fc;font-weight:600;font-size:0.82em;cursor:pointer">Just Practice Instead</button>'
        + '</div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
};

// Open charts for practice only — full plan queue, no session created
window._rhOpenChartsOnly = function() {
    var units = _rhGetUnits ? _rhGetUnits() : [];
    // Build a full queue from plan songs (same as rehearsal, but no session)
    var queue = [];
    for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (u.type === 'linked' && u.songs && u.songs.length) {
            u.songs.forEach(function(s) { if (s.title) queue.push({ title: s.title, band: s.band || '' }); });
        } else if (u.type === 'single' || u.type === 'song' || u.type === 'multi_song') {
            if (u.title) queue.push({ title: u.title, band: '' });
        }
    }
    if (queue.length > 0 && typeof openWorkbenchRunQueue === 'function') {
        openWorkbenchRunQueue(queue);
    } else if (queue.length > 0 && typeof openWorkbench === 'function') {
        openWorkbench(queue[0].title, 'practice', {});
    } else if (queue.length > 0 && typeof openRehearsalModePractice === 'function') {
        openRehearsalModePractice(queue); // hidden legacy fallback
    } else {
        showPage('songs');
    }
};

// ── Analyze Recording — upload audio for a rehearsal ─────────────────────────
window._rhRecreateFromRecording = function() {
    var existing = document.getElementById('rhRecreateModal');
    if (existing) existing.remove();
    var today = new Date().toISOString().split('T')[0];
    var ov = document.createElement('div');
    ov.id = 'rhRecreateModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
    ov.innerHTML = '<div style="max-width:420px;width:100%;background:#1e293b;border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,0.08);max-height:90vh;overflow-y:auto">'
        + '<div style="font-size:1em;font-weight:800;color:#f1f5f9;margin-bottom:4px">Analyze Recording</div>'
        + '<div style="font-size:0.78em;color:#64748b;margin-bottom:16px">Upload a rehearsal recording and GrooveLinx will break it down song by song.</div>'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Rehearsal date</label>'
        + '<input type="date" id="rhRecDate" value="' + today + '" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.85em;margin-bottom:12px;color-scheme:dark">'
        + '<div id="rhRecDupeWarning"></div>'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Recording file</label>'
        + '<input type="file" id="rhRecFile" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" style="width:100%;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.78em;margin-bottom:12px">'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Songs worked on <span style="font-weight:400;opacity:0.5">(helps with song matching)</span></label>'
        + '<input type="text" id="rhRecSongs" placeholder="Song 1, Song 2, Song 3" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.85em;margin-bottom:12px">'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Notes (optional)</label>'
        + '<textarea id="rhRecNotes" rows="2" placeholder="How did it go?" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.85em;margin-bottom:16px;resize:vertical"></textarea>'
        + '<button onclick="_rhSaveRecreatedSession()" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.92em;cursor:pointer">Save and Analyze</button>'
        + '<button onclick="document.getElementById(\'rhRecreateModal\').remove()" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:none;background:none;color:#64748b;cursor:pointer;font-size:0.78em">Cancel</button>'
        + '</div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    // Check for existing session on date change
    var dateInput = document.getElementById('rhRecDate');
    if (dateInput) {
        dateInput.addEventListener('change', function() { _rhCheckDuplicateDate(dateInput.value); });
        _rhCheckDuplicateDate(today);
    }
};

// Check if a session already exists for this date and show warning
async function _rhCheckDuplicateDate(dateStr) {
    var warnEl = document.getElementById('rhRecDupeWarning');
    if (!warnEl) return;
    var sessions = _rhSessionsCache || await _rhLoadSessions();
    var match = sessions.find(function(s) {
        if (!s.date) return false;
        return s.date.substring(0, 10) === dateStr || s.date.split('T')[0] === dateStr;
    });
    if (match) {
        var dur = match.totalActualMin || 0;
        var durLabel = dur >= 60 ? Math.floor(dur / 60) + 'h ' + (dur % 60) + 'm' : dur + ' min';
        var hasTimeline = !!(match.audio_segments);
        warnEl.innerHTML = '<div style="padding:10px 12px;margin-bottom:12px;border-radius:8px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);font-size:0.78em">'
            + '<div style="font-weight:700;color:#fbbf24;margin-bottom:4px">\u26A0 A rehearsal already exists for this date</div>'
            + '<div style="color:var(--text-muted);margin-bottom:6px">' + durLabel + (hasTimeline ? ' \u00B7 has timeline' : '') + '</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
            + '<button onclick="_rhAttachToExisting(\'' + match.sessionId + '\')" style="flex:1;padding:6px 12px;border-radius:6px;border:none;background:rgba(34,197,94,0.15);color:#86efac;cursor:pointer;font-size:0.85em;font-weight:700">Add to existing rehearsal</button>'
            + '<button onclick="document.getElementById(\'rhRecDupeWarning\').innerHTML=\'<div style=padding:6px;font-size:0.72em;color:var(--text-dim)>Will create a separate session.</div>\'" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer;font-size:0.82em">Create separate</button>'
            + '</div></div>';
        window._rhExistingSessionId = match.sessionId;
    } else {
        warnEl.innerHTML = '';
        window._rhExistingSessionId = null;
    }
}

// Attach recording to an existing session (instead of creating duplicate)
window._rhAttachToExisting = function(sessionId) {
    window._rhExistingSessionId = sessionId;
    var warnEl = document.getElementById('rhRecDupeWarning');
    if (warnEl) warnEl.innerHTML = '<div style="padding:6px;font-size:0.72em;color:#86efac;font-weight:600">\u2705 Will add recording to existing rehearsal. This will re-analyze the session.</div>';
};

window._rhSaveRecreatedSession = async function() {
    var date = (document.getElementById('rhRecDate') || {}).value || new Date().toISOString().split('T')[0];
    var url = (document.getElementById('rhRecUrl') || {}).value || '';
    var songStr = (document.getElementById('rhRecSongs') || {}).value || '';
    var notes = (document.getElementById('rhRecNotes') || {}).value || '';
    var songs = songStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    // If no songs typed, use current rehearsal plan as reference songs
    if (!songs.length) {
        try {
            // Primary: use _rhGetUnits() which checks Firebase cache → localStorage → fallback
            var _planUnits = (typeof _rhGetUnits === 'function') ? _rhGetUnits() : [];
            if (_planUnits && _planUnits.length) {
                songs = _planUnits.map(function(u) { return u && u.title ? u.title : ''; }).filter(Boolean);
            }
            // Fallback: raw localStorage reads
            if (!songs.length) {
                var _unitsRaw = localStorage.getItem('glPlannerUnits');
                if (_unitsRaw) {
                    var _units = JSON.parse(_unitsRaw);
                    songs = _units.filter(function(u) { return u && u.title; }).map(function(u) { return u.title; });
                }
            }
            if (!songs.length) {
                var _planRaw = localStorage.getItem('glPlannerQueue');
                if (_planRaw) {
                    var _planQueue = JSON.parse(_planRaw);
                    songs = _planQueue.map(function(item) { return typeof item === 'string' ? item : (item.title || ''); }).filter(Boolean);
                }
            }
            if (songs.length) console.log('[Rehearsal] Using current plan as reference: ' + songs.length + ' songs [' + songs.slice(0, 5).join(', ') + '...]');
            else console.warn('[Rehearsal] No plan songs found in _rhGetUnits, glPlannerUnits, or glPlannerQueue');
        } catch(e) { console.warn('[Rehearsal] Could not read plan:', e.message); }
    }

    // Use existing session if user chose "Add to existing rehearsal"
    var sessionId = window._rhExistingSessionId || ('rsess_rec_' + Date.now().toString(36));
    var isExisting = !!window._rhExistingSessionId;
    window._rhExistingSessionId = null;

    if (!isExisting) {
        // Create new session
        var session = {
            sessionId: sessionId,
            date: new Date(date + 'T12:00:00').toISOString(),
            start_time: new Date(date + 'T19:00:00').toISOString(),
            end_time: new Date(date + 'T21:00:00').toISOString(),
            totalBudgetMin: 0,
            totalActualMin: 120,
            blocksCompleted: songs.length,
            totalBlocks: songs.length,
            songsWorked: songs,
            notes: notes,
            recording_url: url,
            blocks: songs.map(function(s) { return { title: s, budgetMin: 0, actualMin: 0 }; })
        };
        // C2 Phase 1: route through GLStore.RehearsalSession.create when
        // available; cached-shell legacy fallback preserves a stale SW shell.
        var _rsCreate = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.create);
        try {
            if (_rsCreate) {
                await GLStore.RehearsalSession.create(sessionId, session);
            } else {
                var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
                if (db && typeof bandPath === 'function') {
                    await db.ref(bandPath('rehearsal_sessions/' + sessionId)).set(session);
                }
            }
            if (typeof showToast === 'function') showToast('\u2705 Rehearsal saved');
        } catch(e) {
            if (typeof showToast === 'function') showToast('Save failed');
            return;
        }
    } else {
        // Existing session — update notes/songs if provided
        // C2 Phase 1: route the partial update through RehearsalSession.update.
        var updates = {};
        if (notes) updates.notes = notes;
        if (songs.length) updates.songsWorked = songs;
        if (url) updates.recording_url = url;
        if (Object.keys(updates).length) {
            var _rsUpdate = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.update);
            if (_rsUpdate) {
                await GLStore.RehearsalSession.update(sessionId, updates);
            } else {
                var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
                if (db && typeof bandPath === 'function') {
                    await db.ref(bandPath('rehearsal_sessions/' + sessionId)).update(updates);
                }
            }
        }
        if (typeof showToast === 'function') showToast('\u2705 Adding recording to existing rehearsal');
    }

    // Check for local file upload
    var fileInput = document.getElementById('rhRecFile');
    var localFile = (fileInput && fileInput.files && fileInput.files.length > 0) ? fileInput.files[0] : null;

    var modal = document.getElementById('rhRecreateModal');
    if (modal) modal.remove();

    // Launch analysis: local file takes priority over URL
    if (localFile && typeof RecordingAnalyzer !== 'undefined') {
        var fileSizeMB = Math.round(localFile.size / 1024 / 1024);
        // Show inline progress bar in the timeline section
        var _progEl = document.getElementById('rhTimelineSection');
        var _stageLabels = {
            decoding: 'Decoding audio',
            segmenting: 'Finding song boundaries',
            groove: 'Extracting BPM, groove & chords',
            embedding: 'Generating audio fingerprints',
            matching: 'Identifying songs'
        };
        var _progStartTime = Date.now();
        function _updateProgress(stage, pct) {
            if (!_progEl) return;
            var label = _stageLabels[stage] || stage;
            var elapsed = Math.round((Date.now() - _progStartTime) / 1000);
            var elapsedStr = elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm ' + (elapsed % 60) + 's';
            _progEl.innerHTML = '<div style="padding:24px 20px;border-radius:12px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);margin:8px 0">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
                + '<div style="font-size:0.82em;font-weight:700;color:var(--text)">' + label + '\u2026</div>'
                + '<div style="font-size:0.68em;color:var(--text-dim)">' + elapsedStr + '</div>'
                + '</div>'
                + '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-bottom:8px">'
                + '<div style="height:100%;width:' + Math.min(pct, 100) + '%;background:linear-gradient(90deg,#818cf8,#6366f1);border-radius:3px;transition:width 0.3s"></div>'
                + '</div>'
                + '<div style="font-size:0.68em;color:var(--text-dim)">'
                + (stage === 'decoding' ? 'Reading ' + fileSizeMB + 'MB of audio — large files take longer'
                    : stage === 'segmenting' ? 'Detecting silence gaps between songs'
                    : stage === 'groove' ? 'Analyzing each segment for tempo, timing, key & chords'
                    : stage === 'embedding' ? 'Creating audio signatures for song comparison'
                    : stage === 'matching' ? 'Comparing detected features against your song catalog'
                    : '')
                + '</div></div>';
        }
        _updateProgress('decoding', 0);
        RecordingAnalyzer.analyze(localFile, {
            sessionId: sessionId,
            contextType: 'rehearsal',
            referenceSongs: songs,
            onProgress: _updateProgress
        }).then(function(result) {
            if (result && result.segments && result.segments.length) {
                // Save segments to Firebase — C2 Phase 1: setField wraps the
                // nested write + parent updatedAt stamp.
                var _rsSetField = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.setField);
                if (_rsSetField) {
                    GLStore.RehearsalSession.setField(sessionId, 'audio_segments', result.segments);
                } else {
                    var db2 = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
                    if (db2 && typeof bandPath === 'function') {
                        db2.ref(bandPath('rehearsal_sessions/' + sessionId + '/audio_segments')).set(result.segments);
                    }
                }
                // Phase 2: additive Take normalization. Mirrors the segment array into
                // bands/{slug}/takes/{takeId} so annotations and downstream intelligence
                // can hold stable foreign keys. Failure here never blocks the legacy
                // audio_segments write or the timeline UI.
                if (typeof window.GLTakes !== 'undefined' && window.GLTakes.normalizeRehearsalSegments) {
                    window.GLTakes.normalizeRehearsalSegments(sessionId, result.segments)
                        .then(function(r) {
                            var created = (r && r.created || []).length;
                            var prot = (r && r.protected) || 0;
                            console.log('[GLTakes] normalized ' + created + ' new takes' + (prot ? ' (' + prot + ' human-protected)' : '') + ' for session ' + sessionId);
                        })
                        .catch(function(err) { console.warn('[GLTakes] normalize after analysis failed:', err && err.message); });
                }
                if (typeof showToast === 'function') showToast('\u2705 Analysis complete \u2014 ' + result.segments.length + ' segments detected');
                // Show the timeline for this session
                if (typeof _rhShowSessionReport === 'function') _rhShowSessionReport(sessionId);
            } else {
                if (typeof showToast === 'function') showToast('Analysis complete \u2014 no segments detected');
            }
            _rhRenderSessionHistory();
        }).catch(function(e) {
            console.error('[Rehearsal] File analysis failed:', e);
            if (typeof showToast === 'function') showToast('Analysis failed: ' + (e.message || 'unknown error'));
        });
    } else if (typeof RehearsalAnalysis !== 'undefined' && url) {
        // URL-based fallback
        RehearsalAnalysis.run(session.sessionId, {
            recordingUrl: url
        }).catch(function(e) { console.warn('[Rehearsal] Analysis pipeline failed:', e); });
    }
    _rhRenderSessionHistory();
};

var rhCurrentEventId = null; // which event is open in detail view

// Phase 3d: page-mode enum.
// _rhPageMode is the single source of truth for which mode the rehearsal
// page is in: 'review' (default) or 'plan'. Mutate it ONLY via
// _rhSetPageMode(mode) below — that gives us one chokepoint for transitions
// and keeps the legacy _rhPlanningMode boolean in sync (back-compat alias
// still read by ~30 render branches).
//
// "Active" rehearsal isn't a page mode — clicking Start Rehearsal exits to
// rehearsal-mode.js (chart overlay), which is a separate surface. So Active
// lives outside this enum.
//
// Full render-path split (separate _rhRenderPlanMode / _rhRenderReviewMode
// functions per audit §9 Phase 3 item 5) is deferred — would touch ~700
// lines of intermingled branches; this enum + chokepoint is the prerequisite
// architectural step that makes that split safe to do later.
var _rhPageMode = 'review';
var _rhPlanningMode = false; // back-compat alias; reflects _rhPageMode === 'plan'
function _rhSetPageMode(mode) {
    if (mode !== 'review' && mode !== 'plan') return;
    _rhPageMode = mode;
    _rhPlanningMode = (mode === 'plan');
}

var _rhViewingSessionId = null; // which session timeline is currently displayed

// ── Page entry point ──────────────────────────────────────────────────────────

// Compact confidence badge for transition practice units (0–5 scale)
function _renderTransitionConfBadge(confidence) {
    var c = (confidence !== undefined && confidence !== null) ? confidence : 2.5;
    var color = c >= 3.5 ? '#22c55e' : c >= 2.0 ? '#f59e0b' : '#ef4444';
    var label = c >= 4.0 ? 'Solid' : c >= 3.0 ? 'OK' : c >= 2.0 ? 'Weak' : 'New';
    var pct = Math.round(Math.min(100, (c / 5) * 100));
    return '<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.62em;padding:1px 6px;border-radius:4px;background:' + color + '15;border:1px solid ' + color + '30;color:' + color + ';font-weight:700;white-space:nowrap">'
        + '<span style="display:inline-block;width:20px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden"><span style="display:block;width:' + pct + '%;height:100%;background:' + color + ';border-radius:2px"></span></span>'
        + label + '</span>';
}

// Console-only helper for Beta Semantic Clarity Pass observability.
// Read with `_glGetRehearsalEntryStats()` to see which entry path testers use.
// Clear with `_glClearRehearsalEntryStats()`.
window._glGetRehearsalEntryStats = function() {
    try { return JSON.parse(localStorage.getItem('gl_rehearsal_entry_stats') || '{}'); }
    catch(e) { return { error: e && e.message }; }
};
window._glClearRehearsalEntryStats = function() {
    try { localStorage.removeItem('gl_rehearsal_entry_stats'); return 'cleared'; }
    catch(e) { return 'failed: ' + (e && e.message); }
};

async function renderRehearsalPage(el) {
  try {
    // Beta Semantic Clarity Pass (2026-05-14): lightweight entry-source counter.
    // We have three rehearsal entry paths today (Home dashboard CTA, primary nav,
    // contextual deep-links) and don't yet know which testers gravitate to.
    // This is OBSERVATION work — read via _glGetRehearsalEntryStats() in console.
    // No code branches off this; no behavior depends on it. Purely a tally.
    try {
        var _glRES = JSON.parse(localStorage.getItem('gl_rehearsal_entry_stats') || '{}');
        var _glRESsrc = (window._glRehearsalEntrySource || 'direct');
        _glRES[_glRESsrc] = (_glRES[_glRESsrc] || 0) + 1;
        _glRES._lastEntry = new Date().toISOString();
        _glRES._lastSource = _glRESsrc;
        localStorage.setItem('gl_rehearsal_entry_stats', JSON.stringify(_glRES));
        // Reset the source flag so subsequent entries default to 'direct' unless
        // re-tagged by the next caller.
        window._glRehearsalEntrySource = null;
    } catch(e) { /* counter is non-essential; never block render */ }

    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'rehearsal');
    // If a render is already in flight, do NOT wipe the DOM \u2014 wiping
    // strands the in-flight render's cached `main` element, which becomes
    // detached when innerHTML is replaced, and the eventual `main.innerHTML = html`
    // writes into nothing (page stuck on "Loading..."). Queue a follow-up
    // render so the new focus data still lands once the first one finishes.
    if (_rhRenderInProgress) {
        _rhRenderQueued = true;
        return;
    }
    window.GL_REHEARSAL_READY = false;
    var _pageTitle = _rhPlanningMode
        ? '\uD83D\uDCCB Planning Next Rehearsal'
        : '\uD83C\uDFB8 Rehearsal';
    // Ingest Cockpit — live visibility surface for the operator-side
    // ingest pipeline. Wires to bands/{slug}/ingest_jobs via Firebase
    // RTDB listener. Auto-hides when no active job. See
    // js/features/ingest-cockpit.js for the implementation, and
    // services/glx-ingest/ingest_full_rehearsal.py for the writer.
    var ingestCockpitTile = '<div id="rhIngestCockpit" style="display:none"></div>';

    // NOTE: The "Upload reconstructed rehearsal" browser tile
    // (multitrack-ingest-first.js) is intentionally hidden in this
    // build per Drew 2026-05-27 — browser-side ingest UI shouldn't
    // appear to musicians until full raw-folder ingest works
    // end-to-end. The 5 GB R2 single-PUT cap means the current tile
    // would silently fail on a real 64 GB rehearsal. The operator-side
    // path (services/glx-ingest/ingest_full_rehearsal.py) is the real
    // ingest mechanism; this Ingest Cockpit (above) makes that
    // operator-side flow visible to the band without exposing a
    // misleading upload promise.
    // REAPER tile removed 2026-05-27 per Drew — the ingestion-first
    // reframe makes REAPER an optional editing tool, not a primary
    // ingest path. The _mtOpenImportModal entry point still exists in
    // multitrack-rehearsal.js for power users / future re-exposure
    // (e.g. via Settings or a "Power tools" disclosure); just no
    // surface tile in the main Rehearsal page anymore.
    var ingestTile = ingestCockpitTile;
    el.innerHTML = '<div class="gl-page">'
        + '<div class="gl-page-title" id="rhPageTitle">' + _pageTitle + '</div>'
        + ingestTile
        + '<div class="gl-page-split">'
        + '<div class="gl-page-primary"><div id="rhMain"><div style="color:var(--text-dim);padding:40px;text-align:center">Loading...</div></div></div>'
        + '<div class="gl-page-context" id="rhContextRail"></div>'
        + '</div></div>';
    _rhRenderCommandFlow(el);
    // Mount the Ingest Cockpit listener — auto-hides when no active job
    // and unmounts itself on the next renderRehearsalPage call via the
    // _glIngestCockpitUnmount path the module exposes.
    try {
      var _cockpitEl = el.querySelector('#rhIngestCockpit');
      if (_cockpitEl && typeof window._glIngestCockpitMount === 'function') {
        window._glIngestCockpitMount(_cockpitEl);
      }
    } catch (_e) {
      console.warn('[rehearsal] ingest cockpit mount failed', _e);
    }
  } catch (_glRenderE) {
    if (typeof _glRenderError === 'function') _glRenderError(el, 'renderRehearsalPage', _glRenderE);
  }
}

var _rhRenderInProgress = false; // guard against concurrent renders
var _rhRenderQueued = false;     // set when a render arrived during another; flushed in finally
//
// _rhRenderCommandFlow — orchestrator for the rehearsal page.
//
// Phase 3d structure (audit §9 item 5 — full mode-split deferred):
//   1. Concurrent-render guard + ctx loading (shared)
//   2. PRIMARY ACTIONS surface — branched on _rhPageMode:
//        'review' → intent picker + Continue chip          (~lines 470-540)
//        'plan'   → action row (Back / Duplicate / Clear) (~lines 545-575)
//   3. PLAN SECTION — branched on _rhPageMode + hasSavedPlan:
//        'plan'   → workspace (no collapsible, plan name editable inline)
//        'review' → collapsible card with intent + gig chips
//      The unit-row rendering inside is shared.
//   4. POST-RENDER hooks — timeline, snapshots, history (shared)
//
// To split this into _rhRenderPlanMode + _rhRenderReviewMode functions
// later: extract sections 2 + 3 of each branch into named helpers; keep
// section 1 (orchestration) and 4 (post-render) here.
async function _rhRenderCommandFlow(el) {
    if (_rhRenderInProgress) { _rhRenderQueued = true; return; }
    _rhRenderInProgress = true;
    var main = document.getElementById('rhMain');
    if (!main) { _rhRenderInProgress = false; return; }

  try {
    // Load context
    var ctx = null;
    try { ctx = await buildRiContext(); } catch(e) {
        console.error('[RenderError] rehearsal context load failed:', e);
    }
    var focusSongs = ctx ? deriveRiFocusSongs(ctx) : [];
    window._riLastCtx = ctx;
    window._riLastFocusSongs = focusSongs;

    // Next gig
    var gigs = [];
    try { gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []); } catch(e) {}
    var today = new Date().toISOString().split('T')[0];
    var nextGig = gigs.filter(function(g) { return g.date >= today; }).sort(function(a,b) { return a.date.localeCompare(b.date); })[0] || null;

    // Next rehearsal event for page title
    var _rhEvents = [];
    try { _rhEvents = toArray(await loadBandDataFromDrive('_band', 'rehearsals') || []); } catch(e) {}
    var _rhNextEvent = _rhEvents.filter(function(r) { return r && r.date && r.date >= today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0] || null;

    // Availability for next gig
    var availHtml = '';
    if (nextGig) {
        var avail = nextGig.availability || {};
        var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
        var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        if (members.length > 0) {
            availHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
            members.forEach(function(ref) {
                var mKey = (typeof ref === 'object') ? ref.key : ref;
                var name = bm[mKey] ? bm[mKey].name : mKey;
                var a = avail[mKey];
                var status = a ? a.status : null;
                var icon = status === 'yes' ? '✅' : status === 'maybe' ? '❓' : status === 'no' ? '❌' : '⏳';
                var short = name.split(' ')[0]; // first name only
                availHtml += '<span style="font-size:0.78em;color:var(--text-dim)">' + short + ' ' + icon + '</span>';
            });
            // Role gap check
            if (typeof _gigComputeAvailability === 'function') {
                var s = _gigComputeAvailability(nextGig);
                if (s.missingRoles.length > 0) {
                    var _rl = { drums:'Drums', bass:'Bass', keys:'Keys', guitar:'Guitar', vocals:'Vocals' };
                    availHtml += '<span style="font-size:0.72em;color:#fca5a5;font-weight:700;margin-left:4px">⚠️ Missing ' + s.missingRoles.map(function(r){return _rl[r]||r;}).join(', ') + '</span>';
                }
            }
            availHtml += '</div>';
        }
    }

    // Gig context
    var gigDaysAway = nextGig ? glDaysAway(nextGig.date) : null;
    var gigLabel = nextGig ? (nextGig.venue || 'Upcoming Gig') : null;

    // Focus songs — use unified focus engine (single source of truth)
    var _rhFocus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
    var weakSongs = _rhFocus.list;

    // Confidence level
    var ci = (typeof GLStore !== 'undefined' && GLStore.getCatalogIntelligence) ? GLStore.getCatalogIntelligence() : null;
    var confLabel = 'Unknown';
    var confColor = '#64748b';
    if (ci && ci.catalogAvg) {
        var avg = parseFloat(ci.catalogAvg);
        var _rs = (typeof GLStatus !== 'undefined') ? GLStatus.getReadiness(avg) : null;
        if (_rs) { confLabel = _rs.label; confColor = _rs.color; }
    }

    var html = '';

    // ── NEXT UP: decisive CTA ──
    var _rhFocusPrimary = weakSongs.length > 0 ? weakSongs[0].title : null;
    var _rhFocusCount = weakSongs.length;
    var _gigContext = nextGig ? (nextGig.venue || 'Gig') : null;
    var _gigDays = nextGig ? Math.ceil((new Date(nextGig.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000) : 999;

    // Saved plan check (used by contextual CTA + Start Here + plan card below).
    // Firebase first, then localStorage fallback.
    var fbPlan = await _rhLoadPlanFromFirebase();
    if (fbPlan && fbPlan.units && fbPlan.units.length) {
        try { localStorage.setItem('glPlannerUnits', JSON.stringify(fbPlan.units)); } catch(e) {}
    }
    var hasSavedPlan = false;
    try { hasSavedPlan = !!localStorage.getItem('glPlannerUnits') || !!localStorage.getItem('glPlannerQueue'); } catch(e) {}
    var savedAgenda = (typeof GLStore !== 'undefined' && GLStore.getLatestRehearsalAgenda) ? GLStore.getLatestRehearsalAgenda() : null;
    if (savedAgenda && savedAgenda.items && savedAgenda.items.length) hasSavedPlan = true;

    // Contextual primary CTA: gig <=7d + plan -> "Start Rehearsal"; otherwise "Plan Next Rehearsal".
    var _ctaStartPrimary = hasSavedPlan && _gigDays <= 7;

    // ── PRIMARY ACTIONS ──
    // Phase 2: page is intent-driven. When NOT in Plan Mode the intent
    // picker is always the entry surface. If a plan already exists, a
    // "Continue last plan?" chip pins ABOVE the picker so the user can
    // resume in one click without the plan dominating the page.
    var _renderIntentPicker = !_rhPlanningMode;
    var _heroRendered = false;
    if (_renderIntentPicker) {
        var _hasSnapshots = false, _hasSessions = false;
        try { var _snaps = await _rhLoadSnapshots(1); _hasSnapshots = !!(_snaps && _snaps.length); } catch(e) {}
        try { var _sess = _rhSessionsCache || await _rhLoadSessions(); _hasSessions = !!(_sess && _sess.length); } catch(e) {}

        // Tonight's Rehearsal hero — promoted from the old continue chip.
        // When a plan exists, this is the page's center of gravity.
        if (hasSavedPlan && _rhPlanCache) {
            var _ccUnits = _rhGetUnits() || [];
            var _ccSongCount = _ccUnits.reduce(function(n, u) {
                return n + (u.type === 'linked' ? (u.songs || []).length : 1);
            }, 0);
            var _ccDefaults = { exercise: 10, business: 15, jam: 10, note: 5, section: 0 };
            var _ccTotalMin = _ccUnits.reduce(function(sum, u) {
                var bt = u.type || 'single';
                if (u.durationMinOverride > 0) return sum + u.durationMinOverride;
                if (_ccDefaults[bt] !== undefined) return sum + _ccDefaults[bt];
                return sum + 9;
            }, 0);
            var _ccLabel = _ccTotalMin >= 60
                ? Math.floor(_ccTotalMin / 60) + 'h ' + (_ccTotalMin % 60) + 'm'
                : _ccTotalMin + 'm';
            html += _rhRenderTonightsHero(_rhPlanCache, _ccSongCount, _ccLabel, {
                nextGig: nextGig,
                gigDays: _gigDays,
                focusCount: _rhFocusCount,
                weakSongs: weakSongs,
                hasSessions: _hasSessions
            });
            _heroRendered = true;
        }

        // Intent picker — primary entry only when no plan exists. When a plan
        // is already saved, the picker drops to a "+ Build a different flow"
        // collapsed details below the flow rail. Removes the "What do you
        // want to do?" decision tax from the page's entry surface.
        if (!_heroRendered) {
            html += _rhRenderIntentPicker({
                nextGig: nextGig,
                gigDays: nextGig ? _gigDays : null,
                focusCount: _rhFocusCount,
                hasSnapshots: _hasSnapshots,
                hasSessions: _hasSessions
            });
        }
        // Stash the intent-picker HTML for late injection below the plan rail
        // when the hero is dominant. Avoids a second async pass.
        if (_heroRendered) {
            window._rhDemotedPickerHtml = '<details style="margin-top:var(--gl-space-md);font-size:0.78em">'
                + '<summary style="cursor:pointer;color:var(--gl-text-tertiary);padding:8px 0;display:inline-block;list-style:none">+ Build a different flow ▾</summary>'
                + '<div style="margin-top:8px">'
                + _rhRenderIntentPicker({
                    nextGig: nextGig,
                    gigDays: nextGig ? _gigDays : null,
                    focusCount: _rhFocusCount,
                    hasSnapshots: _hasSnapshots,
                    hasSessions: _hasSessions
                })
                + '</div></details>';
        } else {
            window._rhDemotedPickerHtml = '';
        }
    }

    // Phase 2: action-row only renders in Plan Mode now. The intent picker
    // + Continue chip (rendered above) cover all not-in-Plan-Mode CTAs.
    if (_rhPlanningMode) {
        html += '<div style="display:flex;gap:10px;margin-bottom:var(--gl-space-md);align-items:center;flex-wrap:wrap">';
        html += '<button onclick="_rhExitPlanMode()" style="padding:8px 16px;font-size:0.82em;font-weight:700;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:none;color:var(--gl-text-tertiary);font-family:inherit">\u2190 Back to Review</button>';
        html += '<span id="rhSaveStateTop" style="font-size:0.72em;color:var(--gl-green);font-weight:600"></span>';
        html += '<div style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">';
        html += '<button onclick="_rhDuplicatePriorPlan()" style="padding:6px 12px;font-size:0.78em;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--gl-text-tertiary);font-family:inherit">\uD83D\uDCC4 Duplicate Prior</button>';
        html += '<button onclick="_rhClearSavedPlan()" style="padding:6px 12px;font-size:0.78em;border-radius:6px;cursor:pointer;border:1px solid rgba(239,68,68,0.15);background:none;color:#f87171;font-family:inherit">Clear Plan</button>';
        html += '<button onclick="_rhLaunchSavedPlan()" class="gl-btn-primary" style="padding:8px 18px;font-size:0.85em;background:linear-gradient(135deg,#667eea,#764ba2)">\u25B6 Start This Plan</button>';
        html += '</div>';
        html += '</div>';
    }
    // Context metadata + directive headline. The Tonight's Rehearsal hero
    // already says venue / countdown / focus count; rendering them again
    // below would duplicate the visual weight and undermine the hero. So
    // these blocks render ONLY when the hero is NOT shown (no plan yet, or
    // we're in Plan Mode where the action row replaces the hero).
    if (!_rhPlanningMode && !_heroRendered) {
        html += '<div style="display:flex;gap:var(--gl-space-sm);align-items:center;flex-wrap:wrap;margin-bottom:var(--gl-space-md)">';
        if (_gigContext && _gigDays <= 30) {
            var _urgColor = _gigDays <= 3 ? 'var(--gl-amber)' : 'var(--gl-text-tertiary)';
            html += '<span style="color:' + _urgColor + ';font-size:0.72em">\uD83C\uDFA4 ' + escHtml(_gigContext) + ' \u00B7 ' + _gigDays + 'd</span>';
        }
        if (_rhFocusCount > 0) {
            html += '<span style="font-size:0.72em;color:var(--gl-amber)">\uD83C\uDFAF Focus: ' + _rhFocusCount + ' song' + (_rhFocusCount > 1 ? 's' : '') + '</span>';
        }
        html += '</div>';
    }

    if (!_rhPlanningMode && !_heroRendered) {
        var _activeCount = (function() {
            try {
                var s = (typeof allSongs !== 'undefined') ? allSongs : [];
                if (typeof isSongActive !== 'function') return s.length;
                return s.filter(function(x) { return isSongActive(x.title); }).length;
            } catch(e) { return 0; }
        })();
        var _gigPhrase = '';
        if (nextGig) {
            var _gigName = nextGig.venue || 'Upcoming gig';
            if (_gigDays <= 0) _gigPhrase = ' for ' + _gigName + ' (today)';
            else if (_gigDays === 1) _gigPhrase = ' for ' + _gigName + ' (tomorrow)';
            else _gigPhrase = ' for ' + _gigName + ' in ' + _gigDays + ' days';
        }
        var _directive = '';
        if (_rhFocusCount > 0) {
            _directive = _rhFocusCount + ' of ' + _activeCount + ' songs need work' + _gigPhrase + '.';
        } else if (_activeCount > 0) {
            _directive = 'All ' + _activeCount + ' active songs are tracking well' + _gigPhrase + '.';
        } else {
            _directive = 'No active songs yet \u2014 add a few to start rehearsing.';
        }
        html += '<div class="gl-confidence" style="margin-bottom:var(--gl-space-sm)">' + escHtml(_directive) + '</div>';
    }

    // (hasSavedPlan + fbPlan computed earlier for contextual CTA)

    // Build a {title -> true} map of songs already in the saved plan so the
    // Start Here panel and per-row affordances can both reference it.
    var _rhPlanTitles = {};
    if (hasSavedPlan) {
        try {
            (_rhGetUnits() || []).forEach(function(u) {
                if (u && u.title) _rhPlanTitles[u.title] = true;
                if (u && u.songs) u.songs.forEach(function(s) { if (s && s.title) _rhPlanTitles[s.title] = true; });
            });
        } catch(e) {}
    }

    // ── START HERE: data-driven directive surface ──
    // Surfaces the songs that need work right now with one-tap actions.
    // Replaces the abstract Readiness label as the primary "what should I do" cue.
    if (!_rhPlanningMode && weakSongs.length > 0) {
        html += '<div id="rhStartHere" style="margin-bottom:var(--gl-space-md);padding:12px 14px;border-radius:10px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2)">';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">';
        html += '<span style="font-size:0.75em;font-weight:800;color:#fbbf24;letter-spacing:0.04em;text-transform:uppercase">🎯 Start Here</span>';
        html += '<span style="font-size:0.7em;color:var(--text-dim)">Top ' + weakSongs.length + ' song' + (weakSongs.length > 1 ? 's' : '') + ' to focus on</span>';
        html += '</div>';
        html += '<div style="display:flex;flex-direction:column;gap:6px">';
        weakSongs.forEach(function(f) {
            var titleSafe = (f.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
            var avgPct = Math.round((f.avg / 5) * 100);
            var avgColor = f.avg >= 3 ? '#fbbf24' : f.avg >= 2 ? '#f59e0b' : '#ef4444';
            var inPlan = !!_rhPlanTitles[f.title];
            var planBtn = inPlan
                ? '<span style="font-size:0.7em;color:#86efac;padding:4px 8px;border-radius:5px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2)">✓ In plan</span>'
                : '<button onclick="_rhPickSong(\'' + titleSafe + '\')" style="font-size:0.7em;padding:4px 10px;border-radius:5px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-family:inherit">+ Add to plan</button>';
            html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.02);flex-wrap:wrap">';
            html += '<span style="flex:1;min-width:0;font-size:0.85em;color:var(--text);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(f.title) + '</span>';
            html += '<span style="font-size:0.62em;font-weight:700;color:' + avgColor + ';padding:2px 6px;border-radius:4px;background:' + avgColor + '15;border:1px solid ' + avgColor + '30;white-space:nowrap">' + avgPct + '%</span>';
            html += '<button onclick="(typeof openWorkbench===\'function\')?openWorkbench(\'' + titleSafe + '\',\'practice\',{}):(typeof openRehearsalMode===\'function\'&&openRehearsalMode(\'' + titleSafe + '\'))" style="font-size:0.7em;padding:4px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.12);background:none;color:var(--text-dim);cursor:pointer;font-family:inherit">🎤 Practice solo</button>';
            html += planBtn;
            html += '</div>';
        });
        html += '</div></div>';
    }

    // ── PLAN SECTION ──
    html += '<div id="rhPlanContainer">';
    // Plan Versions rendered by _rhRenderSnapshots() into #rhSnapshots — no separate header needed

    if (hasSavedPlan) {
        var savedUnits = _rhGetUnits();
        var songCount = savedUnits.reduce(function(n, u) { return n + (u.type === 'linked' ? u.songs.length : 1); }, 0);
        console.log('[Planner] Rendering saved plan:', songCount, 'songs,', savedUnits.length, 'blocks');

        var planName = (_rhPlanCache && _rhPlanCache.name) ? _rhPlanCache.name
            : (localStorage.getItem('glSavedPlanName') || (typeof practicePlanActiveDate !== 'undefined' && practicePlanActiveDate
                ? new Date(practicePlanActiveDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) + ' Rehearsal Plan'
                : 'Rehearsal Plan'));
        // Compute total time BEFORE using it in the header
        var _rhNonSongDefaults_pre = { exercise: 10, business: 15, jam: 10, note: 5, section: 0 };
        var _preTotalMin = savedUnits.reduce(function(sum, u) {
            var bt = u.type || 'single';
            if (u.durationMinOverride > 0) return sum + u.durationMinOverride;
            if (_rhNonSongDefaults_pre[bt] !== undefined) return sum + _rhNonSongDefaults_pre[bt];
            return sum + 9;
        }, 0);
        var _preTotalLabel = _preTotalMin >= 60 ? Math.floor(_preTotalMin / 60) + 'h ' + (_preTotalMin % 60) + 'm' : _preTotalMin + 'm';

        // Phase 2: intent badge surfaces "what was this plan built for"
        // (Run the Gig / Practice Transitions / Work Weak Songs / Custom).
        // Empty when intent is unknown (legacy plans pre-Phase-2).
        var _planIntentMeta = (_rhPlanCache && _rhPlanCache.intent)
            ? _rhPlanIntentMeta(_rhPlanCache.intent)
            : null;
        var _planIntentBadge = _planIntentMeta
            ? '<span title="' + escHtml(_planIntentMeta.label) + '" style="font-size:0.62em;font-weight:700;color:' + _planIntentMeta.color + ';background:rgba(255,255,255,0.04);border:1px solid ' + _planIntentMeta.color + '40;padding:2px 7px;border-radius:10px;text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0">' + _planIntentMeta.emoji + ' ' + escHtml(_planIntentMeta.label) + '</span>'
            : '';

        if (_rhPlanningMode) {
            // ── PLAN MODE: plan is the primary workspace (no collapsible) ──
            html += '<div id="rhPlanWorkspace" style="margin-bottom:12px">';
            // Subcontext bar
            var _planSubCtx = '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding:8px 12px;border-radius:8px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.12)">';
            if (nextGig && _gigDays <= 30) _planSubCtx += '<span style="font-size:0.72em;color:var(--gl-amber)">\uD83C\uDFA4 ' + escHtml(nextGig.venue || 'Gig') + ' in ' + _gigDays + ' days</span>';
            _planSubCtx += '<span style="font-size:0.72em;color:var(--gl-text-tertiary)">' + songCount + ' songs in plan \u00B7 ' + _preTotalLabel + '</span>';
            if (_rhFocusCount > 0) _planSubCtx += '<span style="font-size:0.72em;color:var(--gl-amber)">\uD83C\uDFAF ' + _rhFocusCount + ' focus</span>';
            _planSubCtx += '<span id="rhSaveState" style="font-size:0.68em;font-weight:600;margin-left:auto"></span>';
            _planSubCtx += '</div>';
            html += _planSubCtx;
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
                + _planIntentBadge
                + _rhPlanGigChip(_rhPlanCache) // Phase 3a: gig back-ref chip
                + '<span onclick="_rhEditPlanName()" style="font-size:0.88em;font-weight:700;color:#86efac;cursor:pointer;border-bottom:1px dashed rgba(134,239,172,0.3)" title="Click to rename">' + escHtml(planName) + '</span>'
                + '<button onclick="_rhClearSavedPlan()" style="margin-left:auto;font-size:0.65em;padding:3px 8px;border-radius:4px;border:1px solid rgba(239,68,68,0.2);background:none;color:#f87171;cursor:pointer">Clear Plan</button>'
                + '</div>';
        } else {
            // ── REVIEW MODE: plan is a collapsible card ──
            html += '<details id="rhPlanCard" style="margin-bottom:12px;border-radius:10px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.2)">'
                + '<summary style="padding:10px 14px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
                + '<span style="font-size:0.72em;font-weight:800;color:#86efac">\uD83D\uDCCB Plan</span>'
                + '<span style="font-size:0.65em;color:var(--text-dim)">' + songCount + ' songs in plan \u00B7 ' + _preTotalLabel + '</span>'
                + '<span style="font-size:0.6em;color:var(--text-dim);margin-left:auto">\u25B8 expand</span>'
                + '</summary>'
                + '<div style="padding:4px 14px 12px">'
                + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
                + _planIntentBadge
                + _rhPlanGigChip(_rhPlanCache) // Phase 3a: gig back-ref chip
                + '<span onclick="_rhEditPlanName()" style="font-size:0.72em;font-weight:700;color:#86efac;cursor:pointer;border-bottom:1px dashed rgba(134,239,172,0.3)" title="Click to rename">' + escHtml(planName) + '</span>'
                + '<span id="rhSaveState" style="font-size:0.58em;font-weight:600"></span>'
                + '<button onclick="_rhClearSavedPlan()" style="margin-left:auto;font-size:0.6em;padding:2px 6px;border-radius:4px;border:1px solid rgba(239,68,68,0.2);background:none;color:#f87171;cursor:pointer">Clear</button>'
                + '</div>';
        }

        // ── Rehearsal time budgeting ──────────────────────────────────────
        // Estimate minutes per block. Separate from setlist runtime logic.
        // Songs get 1.5x runtime (rehearsal overhead), non-song blocks get fixed defaults.
        var _rhNonSongDefaults = { exercise: 10, business: 15, jam: 10, note: 5, section: 0 };
        function _rhBlockMinutes(unit) {
            // User override takes priority
            if (unit.durationMinOverride > 0) return unit.durationMinOverride;
            var bt = unit.type || 'single';
            // Non-song blocks: fixed defaults
            if (_rhNonSongDefaults[bt] !== undefined) return _rhNonSongDefaults[bt];
            // Linked: sum of song runtimes * 1.5
            if (bt === 'linked' && unit.songs && unit.songs.length > 0) {
                var totalSec = 0;
                unit.songs.forEach(function(s) { totalSec += (typeof getSongRuntimeSec === 'function') ? getSongRuntimeSec(s.title) : 360; });
                return Math.ceil((totalSec / 60) * 1.5);
            }
            // multi_song: sum component songs if parseable, else 15 min
            if (bt === 'multi_song') {
                var titles = (unit.title || '').split(/[,→➔]/).map(function(s) { return s.trim(); }).filter(Boolean);
                if (titles.length > 0 && typeof getSongRuntimeSec === 'function') {
                    var sec = 0;
                    titles.forEach(function(t) { sec += getSongRuntimeSec(t); });
                    return Math.ceil((sec / 60) * 1.5);
                }
                return 15;
            }
            // Single song: runtime * 1.5
            var title = unit.title || (unit.songs && unit.songs[0] ? unit.songs[0].title : '');
            var runtimeSec = (typeof getSongRuntimeSec === 'function') ? getSongRuntimeSec(title) : 360;
            return Math.ceil((runtimeSec / 60) * 1.5);
        }

        var totalMin = savedUnits.reduce(function(sum, u) { return sum + _rhBlockMinutes(u); }, 0);
        var totalLabel = totalMin >= 60 ? Math.floor(totalMin / 60) + 'h ' + (totalMin % 60) + 'm' : totalMin + 'm';

        // Block type config
        var _btConfig = {
            single:   { icon:'🎵', label:'Song',     color:'var(--text)',  bg:'' },
            linked:   { icon:'🔗', label:'Linked',   color:'#818cf8',     bg:'' },
            song:     { icon:'🎵', label:'Song',     color:'var(--text)',  bg:'' },
            multi_song:{icon:'🎵', label:'Songs',    color:'var(--text)',  bg:'' },
            exercise: { icon:'🎓', label:'Exercise', color:'#a78bfa',     bg:'rgba(167,139,250,0.06)' },
            note:     { icon:'💬', label:'Note',     color:'#94a3b8',     bg:'rgba(148,163,184,0.04)' },
            business: { icon:'📋', label:'Business', color:'#fbbf24',     bg:'rgba(245,158,11,0.05)' },
            jam:      { icon:'🔥', label:'Jam',      color:'#22c55e',     bg:'rgba(34,197,94,0.05)' },
            section:  { icon:'▬',  label:'Section',  color:'#60a5fa',     bg:'' }
        };

        // Precompute section subtotals: for each section block, sum minutes until the next section
        var _sectionSubtotals = {};
        (function() {
            var currentSectionIdx = -1;
            for (var i = 0; i < savedUnits.length; i++) {
                if (savedUnits[i].type === 'section') {
                    currentSectionIdx = i;
                    _sectionSubtotals[i] = 0;
                } else if (currentSectionIdx >= 0) {
                    _sectionSubtotals[currentSectionIdx] += _rhBlockMinutes(savedUnits[i]);
                }
            }
        })();

        // Build member list for assignment
        var _rhMembers = [];
        if (typeof BAND_MEMBERS_ORDERED !== 'undefined' && typeof bandMembers !== 'undefined') {
            BAND_MEMBERS_ORDERED.forEach(function(ref) {
                var k = (typeof ref === 'object') ? ref.key : ref;
                var m = bandMembers[k];
                if (m) _rhMembers.push({ key: k, name: m.name || k, initial: (m.name || k).charAt(0).toUpperCase() });
            });
        }

        // Render editable units with block type awareness
        var unitNum = 0;
        var _editBtnStyle = 'background:none;border:none;color:#475569;cursor:pointer;font-size:0.75em;padding:4px;line-height:1;min-width:24px;min-height:24px;display:inline-flex;align-items:center;justify-content:center';
        var _dragHandleStyle = 'cursor:grab;color:#475569;font-size:0.82em;padding:0;user-select:none;touch-action:none;line-height:1;width:16px;text-align:center;flex-shrink:0';
        // Inject alignment CSS once
        if (!document.getElementById('rh-row-fix')) {
            var _rfix = document.createElement('style'); _rfix.id = 'rh-row-fix';
            _rfix.textContent =
                '.rh-unit-row>div:first-child{display:flex;align-items:center;gap:6px;padding:6px 8px;min-height:38px}' +
                '.rh-unit-row .rh-drag-handle{width:16px;flex-shrink:0;text-align:center}' +
                '.rh-row-controls{display:flex;align-items:center;gap:3px;flex-shrink:0;margin-left:auto}';
            document.head.appendChild(_rfix);
        }
        // Focus song lookup for highlighting
        var _rhFocusTitles = {};
        _rhFocus.list.forEach(function(f) { _rhFocusTitles[f.title] = true; });

        // Living Set Sheet — bucket annotations by song so per-row signal
        // computation stays synchronous. Uses GLAnnotations cache when warm;
        // skips the load when cold (signals degrade gracefully — the page
        // still renders, missing rows just don't show 💬 hints this pass).
        var _rhAnnByTitle = {};
        var _annAll = null;
        try {
            if (window.GLAnnotations && window.GLAnnotations.listAnnotationsByAnchor) {
                _annAll = await window.GLAnnotations.listAnnotationsByAnchor({});
                (_annAll || []).forEach(function(a) {
                    if (!a || a.archived) return;
                    if (a.status === 'fixed') return;
                    var anchor = a.anchor || {};
                    // anchor.song_id stores the song title string today (see
                    // songs_v2 migration finding); resolves cleanly post-Phase-2.
                    var key = anchor.song_id || null;
                    if (!key) return;
                    _rhAnnByTitle[key] = (_rhAnnByTitle[key] || 0) + 1;
                });
            }
        } catch (e) {}

        // Latest session for tight-last-rehearsal positive signal. Cache is
        // populated by `_rhLoadSessions` earlier in the render path.
        var _rhLatestSession = (Array.isArray(_rhSessionsCache) && _rhSessionsCache.length)
            ? _rhSessionsCache[0]
            : null;

        // Progression memory — recent-session history fingerprint per song
        // and annotation-age map (rehearsals since each oldest open note).
        // Both are derived from already-loaded data (sessions cache +
        // _annAll) so no extra Firebase round-trip.
        var _rhSongHistory = _rhBuildSongHistory(_rhSessionsCache);
        var _rhAnnAgeByTitle = _rhBuildAnnotationAge(_annAll || [], _rhSessionsCache);

        // Compute the per-unit signals once. _rhRenderUnitSignal then reads
        // from this map at row-render time. Restraint by design: most rows
        // have no entry and render nothing.
        var _rhUnitSignals = _rhBuildSongSignals(
            savedUnits,
            _rhFocus.list,
            _rhLatestSession,
            _rhAnnByTitle,
            _rhSongHistory,
            _rhAnnAgeByTitle
        );

        html += '<div id="rhUnitList">';
        savedUnits.forEach(function(unit, idx) {
            var bt = unit.type || 'single';
            var cfg = _btConfig[bt] || _btConfig.single;
            var dragHandle = '<span class="rh-drag-handle" style="' + _dragHandleStyle + '" title="Drag to reorder">⋮⋮</span>';

            // ── Section divider: render as full-width bar ──
            if (bt === 'section') {
                var secTitle = unit.title || 'Section';
                var secMin = _sectionSubtotals[idx];
                var secLabel = secMin !== undefined && secMin > 0 ? ' · ' + secMin + 'm' : '';
                var secNoteText = unit.note || '';
                var secNoteChip = secNoteText
                    ? '<span onclick="_rhEditBlockNote(' + idx + ')" style="font-size:0.6em;color:#fbbf24;cursor:pointer;padding:1px 4px;border-radius:3px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15)" title="' + escHtml(secNoteText) + '">📝</span>'
                    : '<span onclick="_rhEditBlockNote(' + idx + ')" style="font-size:0.6em;color:#475569;cursor:pointer;padding:1px 4px;border-radius:3px;border:1px dashed rgba(255,255,255,0.06)" title="Add note">📝</span>';
                html += '<div class="rh-unit-row" data-idx="' + idx + '" draggable="true" style="margin:6px 0 2px;border-radius:6px;background:rgba(96,165,250,0.06);border-left:3px solid rgba(96,165,250,0.4)">'
                    + '<div>'
                    + dragHandle
                    + '<span style="width:20px;flex-shrink:0;text-align:center;font-size:0.75em;color:#60a5fa">▬</span>'
                    + '<span onclick="_rhEditBlockTitle(' + idx + ')" title="Click to rename" style="flex:1;min-width:0;font-size:0.82em;font-weight:800;color:#60a5fa;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(secTitle) + '</span>'
                    + '<span class="rh-row-controls">'
                    + (secLabel ? '<span style="font-size:0.7em;color:rgba(96,165,250,0.6)">' + secLabel + '</span>' : '')
                    + secNoteChip
                    + '<button onclick="_rhRemoveUnit(' + idx + ')" style="' + _editBtnStyle + ';color:#f87171" title="Remove">✕</button>'
                    + '</span>'
                    + '</div>'
                    + (secNoteText ? '<div onclick="_rhEditBlockNote(' + idx + ')" style="padding:0 8px 4px 36px;font-size:0.68em;color:#fbbf24;opacity:0.7;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="Click to edit note">📝 ' + escHtml(secNoteText.length > 50 ? secNoteText.substring(0, 50) + '…' : secNoteText) + '</div>' : '')
                    + '</div>';
                return;
            }

            unitNum++;
            var unitLabel = '';
            if (bt === 'linked' && unit.songs && unit.songs.length > 1) {
                unitLabel = unit.songs.map(function(s) { return s.title; }).join(' → ');
            } else {
                unitLabel = unit.title || (unit.songs && unit.songs[0] ? unit.songs[0].title : '?');
            }
            var typeChip = '<span style="font-size:0.6em;margin-right:3px" title="' + cfg.label + '">' + cfg.icon + '</span>';
            var rowBg = cfg.bg ? 'background:' + cfg.bg + ';' : '';
            var isPlayable = bt === 'single' || bt === 'song' || bt === 'multi_song' || bt === 'linked';

            var isEditable = !isPlayable || bt === 'multi_song';
            var editClick = isEditable ? ' onclick="_rhEditBlockTitle(' + idx + ')" style="cursor:pointer;border-bottom:1px dashed rgba(255,255,255,0.1)"' : '';
            var editTitle = isEditable ? ' title="Click to edit"' : '';

            var blockMin = _rhBlockMinutes(unit);
            var isOverridden = unit.durationMinOverride > 0;
            var minChip = '<span onclick="_rhEditBlockTime(' + idx + ')" style="font-size:0.7em;color:' + (isOverridden ? '#a5b4fc' : 'var(--text-dim)') + ';white-space:nowrap;margin-left:4px;cursor:pointer;padding:1px 3px;border-radius:3px;border-bottom:1px dashed ' + (isOverridden ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)') + '" title="' + (isOverridden ? 'Custom override — click to change' : 'Click to set custom time') + '">' + blockMin + 'm</span>';
            var assignChip = _rhAssignChip(unit, idx);

            var noteText = unit.note || '';
            var noteSnippet = noteText.length > 50 ? noteText.substring(0, 50) + '…' : noteText;
            var noteChip = noteText
                ? '<span onclick="_rhEditBlockNote(' + idx + ')" style="font-size:0.6em;color:#fbbf24;cursor:pointer;padding:1px 4px;border-radius:3px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15)" title="' + escHtml(noteText) + '">📝</span>'
                : '<span onclick="_rhEditBlockNote(' + idx + ')" style="font-size:0.6em;color:#475569;cursor:pointer;padding:1px 4px;border-radius:3px;border:1px dashed rgba(255,255,255,0.06)" title="Add note">📝</span>';

            // Highlight focus songs
            var _isFocusSong = isPlayable && (unit.title && _rhFocusTitles[unit.title]);
            if (!_isFocusSong && unit.songs && unit.songs.length) { for (var _fi = 0; _fi < unit.songs.length; _fi++) { if (_rhFocusTitles[unit.songs[_fi].title]) { _isFocusSong = true; break; } } }
            var _focusBorder = _isFocusSong ? 'border-left:3px solid #fbbf24;' : '';

            // Per-row "Practice solo" — only for single-song rows where the title is unambiguous.
            var practiceSoloChip = '';
            if ((bt === 'single' || bt === 'song') && unit.title) {
                var _soloSafe = unit.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                practiceSoloChip = '<button onclick="event.stopPropagation();(typeof openWorkbench===\'function\')?openWorkbench(\'' + _soloSafe + '\',\'practice\',{}):(typeof openRehearsalMode===\'function\'&&openRehearsalMode(\'' + _soloSafe + '\'))" style="' + _editBtnStyle + ';color:#a5b4fc" title="Practice this song solo">🎤</button>';
            }

            // Living Set Sheet — at most one inline signal per row,
            // selected by precedence in _rhBuildSongSignals. Renders empty
            // for rows without a signal (which is the desired most-of-the-
            // time state).
            var _signalHtml = _rhRenderUnitSignal(_rhUnitSignals[idx]);

            html += '<div class="rh-unit-row" data-idx="' + idx + '" draggable="true" style="border-bottom:1px solid rgba(255,255,255,0.03);border-radius:4px;' + rowBg + _focusBorder + '">'
                + '<div>'
                + dragHandle
                + '<span style="width:18px;flex-shrink:0;text-align:center;font-size:0.78em;font-weight:700;color:var(--text-dim)">' + unitNum + '</span>'
                + '<span style="width:20px;flex-shrink:0;text-align:center;font-size:0.75em">' + cfg.icon + '</span>'
                + '<span' + editClick + editTitle + ' style="flex:1;min-width:0;font-size:0.85em;color:' + cfg.color + ';font-weight:' + (isPlayable && bt !== 'multi_song' ? '500' : '600') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (!isPlayable ? 'font-style:italic;' : '') + (isEditable ? 'cursor:pointer' : '') + '">' + unitLabel + '</span>'
                + '<span class="rh-row-controls">'
                + minChip + assignChip + noteChip + practiceSoloChip
                + '<button onclick="_rhRemoveUnit(' + idx + ')" style="' + _editBtnStyle + ';color:#f87171" title="Remove">✕</button>'
                + '</span>'
                + '</div>'
                + _signalHtml
                + (noteText ? '<div onclick="_rhEditBlockNote(' + idx + ')" style="padding:0 4px 4px 36px;font-size:0.68em;color:#fbbf24;opacity:0.7;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="Click to edit note">📝 ' + escHtml(noteSnippet) + '</div>' : '')
                + '</div>';
        });
        html += '</div>';

        // (The "Focus songs not in plan" prompt now lives in the top-level Start Here panel.)

        // Add Block picker
        html += '<div style="margin-top:8px"><button onclick="_rhShowAddBlock()" id="rhAddBlockBtn" style="width:100%;padding:6px;border-radius:6px;border:1px dashed rgba(99,102,241,0.3);background:none;color:#a5b4fc;cursor:pointer;font-size:0.72em;font-weight:600">+ Add Block</button>'
            + '<div id="rhAddBlockMenu" style="display:none;margin-top:4px;flex-direction:column;gap:6px">'
            + '<div style="font-size:0.6em;color:var(--text-dim);padding:0 2px 3px;font-style:italic">Tip: Use a "Section divider" to label a phase (like Warm-Up), then add songs or exercises under it.</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:4px">'
            + '<button onclick="_rhAddBlock(\'song\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer;font-size:0.68em">🎵 Song</button>'
            + '<button onclick="_rhAddBlock(\'multi_song\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer;font-size:0.68em">🎵🎵 Multi-Song</button>'
            + '<button onclick="_rhAddBlock(\'exercise\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(167,139,250,0.25);background:none;color:#a78bfa;cursor:pointer;font-size:0.68em">🎓 Exercise</button>'
            + '<button onclick="_rhAddBlock(\'note\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(148,163,184,0.2);background:none;color:#94a3b8;cursor:pointer;font-size:0.68em">💬 Note</button>'
            + '<button onclick="_rhAddBlock(\'business\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(245,158,11,0.25);background:none;color:#fbbf24;cursor:pointer;font-size:0.68em">📋 Business</button>'
            + '<button onclick="_rhAddBlock(\'jam\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(34,197,94,0.25);background:none;color:#22c55e;cursor:pointer;font-size:0.68em">🔥 Jam</button>'
            + '<button onclick="_rhAddBlock(\'section\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(96,165,250,0.3);background:rgba(96,165,250,0.06);color:#60a5fa;cursor:pointer;font-size:0.68em;font-weight:700" title="A divider that groups blocks into phases (e.g. Warm-Up, Song Work)">▬ Section divider</button>'
            + '</div>'
            + '<div id="rhTemplateArea" style="border-top:1px solid rgba(255,255,255,0.04);padding-top:4px"><div style="font-size:0.58em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:1px">Quick Templates</div>'
            + '<div style="font-size:0.55em;color:var(--text-dim);margin-bottom:3px;font-style:italic">One tap to add common rehearsal blocks.</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:3px">'
            + '<button onclick="_rhInsertTemplate(\'jam\',\'Open with jam\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.04);color:#86efac;cursor:pointer;font-size:0.62em">🔥 Open with jam</button>'
            + '<button onclick="_rhInsertTemplate(\'exercise\',\'Cold starts — all songs\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(167,139,250,0.2);background:rgba(167,139,250,0.04);color:#c4b5fd;cursor:pointer;font-size:0.62em">🎓 Cold starts</button>'
            + '<button onclick="_rhInsertTemplate(\'exercise\',\'Endings — all songs\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(167,139,250,0.2);background:rgba(167,139,250,0.04);color:#c4b5fd;cursor:pointer;font-size:0.62em">🎓 Endings</button>'
            + '<button onclick="_rhInsertTemplate(\'exercise\',\'Quick run-through — full set\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(167,139,250,0.2);background:rgba(167,139,250,0.04);color:#c4b5fd;cursor:pointer;font-size:0.62em">🎓 Run-through</button>'
            + '<button onclick="_rhInsertTemplate(\'business\',\'Band business\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.04);color:#fbbf24;cursor:pointer;font-size:0.62em">📋 Band business</button>'
            + '<button onclick="_rhInsertTemplate(\'note\',\'Set break — 15 min\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(148,163,184,0.15);background:rgba(148,163,184,0.03);color:#94a3b8;cursor:pointer;font-size:0.62em">💬 Set break</button>'
            + '<button onclick="_rhInsertTemplate(\'section\',\'Warm-Up\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(96,165,250,0.25);background:rgba(96,165,250,0.04);color:#60a5fa;cursor:pointer;font-size:0.62em">▬ Warm-Up</button>'
            + '<button onclick="_rhInsertTemplate(\'section\',\'Song Work\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(96,165,250,0.25);background:rgba(96,165,250,0.04);color:#60a5fa;cursor:pointer;font-size:0.62em">▬ Song Work</button>'
            + '<button onclick="_rhInsertTemplate(\'section\',\'Full Run-Through\')" style="padding:3px 8px;border-radius:4px;border:1px solid rgba(96,165,250,0.25);background:rgba(96,165,250,0.04);color:#60a5fa;cursor:pointer;font-size:0.62em">▬ Run-Through</button>'
            + '</div></div>'
            + '</div></div>';

        html += '</div>';

        // Example helper panel
        html += '<details style="margin-bottom:10px"><summary style="font-size:0.65em;font-weight:600;color:var(--text-dim);cursor:pointer;padding:4px 0">💡 How to build a rehearsal plan</summary>'
            + '<div style="margin-top:4px;padding:10px 12px;border-radius:8px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);font-size:0.72em;color:var(--text-muted)">'
            + '<div style="margin-bottom:6px;color:var(--text);font-weight:600">Example: A typical 2-hour rehearsal</div>'
            + '<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px">'
            + '<div><span style="color:#60a5fa;font-weight:700">▬ WARM-UP</span></div>'
            + '<div style="padding-left:12px">🔥 Open with jam</div>'
            + '<div style="padding-left:12px">🎓 Cold starts — all songs</div>'
            + '<div><span style="color:#60a5fa;font-weight:700">▬ SONG WORK</span></div>'
            + '<div style="padding-left:12px">🎵 Jack Straw <span style="color:var(--text-dim)">9m</span></div>'
            + '<div style="padding-left:12px">🎵 After Midnight <span style="color:var(--text-dim)">9m</span></div>'
            + '<div style="padding-left:12px">🎓 Transitions — Jack Straw → After Midnight</div>'
            + '<div><span style="color:#60a5fa;font-weight:700">▬ BUSINESS</span></div>'
            + '<div style="padding-left:12px">📋 Band business <span style="color:var(--text-dim)">15m</span></div>'
            + '<div><span style="color:#60a5fa;font-weight:700">▬ RUN-THROUGH</span></div>'
            + '<div style="padding-left:12px">🎵 Full set run <span style="color:var(--text-dim)">45m</span></div>'
            + '</div>'
            + '<div style="font-size:0.9em;color:var(--text-dim);font-style:italic">Use a template to build your plan faster. Drag to reorder. Tap the time to adjust.</div>'
            + '</div></details>';

        // Plan actions
        html += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
            + '<button onclick="rhOpenCreateModal()" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;font-size:0.68em;cursor:pointer">Schedule Date</button>'
            + '<button onclick="renderRehearsalPlanner()" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);font-size:0.68em;cursor:pointer">\u270F Edit Structure</button>'
            + '</div>';
        if (_rhPlanningMode) {
            html += '</div>'; // close plan card (plain div)
            // Snapshots in Plan Mode are in the right rail — no duplicate here
        } else {
            html += '</div></details>' // close plan details
                + '<div id="rhSnapshots"></div>';
        }
    } else {
        // No saved plan
        if (_rhPlanningMode) {
            // In plan mode with no plan — show seed message
            html += '<div style="padding:20px;text-align:center;color:var(--gl-text-tertiary);font-size:0.85em">'
                + 'No plan yet. Click below to build one from scratch or from your focus songs.'
                + '<div style="margin-top:12px;display:flex;gap:8px;justify-content:center">'
                + '<button onclick="renderRehearsalPlanner()" class="gl-btn-primary" style="padding:10px 20px;font-size:0.88em">\u25B6 Build Plan</button>'
                + '</div></div>';
        } else {
            html += '<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">'
                + '<button onclick="renderRehearsalPlanner()" style="flex:2;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:800;font-size:0.92em;cursor:pointer;min-height:48px">\u25B6 Plan Next Rehearsal</button>'
                + '<button onclick="var h=document.querySelector(\'#rhMain details:last-of-type\');if(h){h.open=true;h.scrollIntoView({behavior:\'smooth\'})}" style="flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);font-size:0.82em;cursor:pointer">Past Rehearsals</button>'
                + '</div>';
        }
        if (!_rhPlanningMode) html += '<div id="rhSnapshots"></div>';
    }

    html += '</div>'; // close #rhPlanContainer

    // ── SECTION: Latest Rehearsal Review ──
    if (_rhPlanningMode) {
        // Plan Mode: review content collapsed
        html += '<details style="margin-top:16px;opacity:0.7">'
            + '<summary style="font-size:0.68em;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);cursor:pointer;padding:4px 0;list-style:none;display:flex;align-items:center;gap:6px">'
            + '\u25B8 Latest Rehearsal Review</summary>'
            + '<div id="rhTimelineSection" style="margin-bottom:12px;margin-top:8px"></div>'
            + '<div id="rhLastRehearsalSnapshot" style="margin-bottom:12px"></div>'
            + '</details>';
    } else {
        // Review Mode: review content primary
        html += '<div style="font-size:0.68em;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:6px;margin-top:12px">Latest Rehearsal Review</div>';
        html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:8px">Listen back to each song, see where the band was tight and where it got rough. Tap a song for details, double-tap to loop.</div>';
        html += '<div id="rhTimelineSection" style="margin-bottom:12px"></div>';
        html += '<div id="rhLastRehearsalSnapshot" style="margin-bottom:12px"></div>';
    }

    // Demoted intent picker — appended below the flow rail when the
    // Tonight's Rehearsal hero owns the entry surface. Hidden behind a
    // collapsed details so the page entry stays clean while the picker
    // remains discoverable for users who want to start a different flow.
    if (window._rhDemotedPickerHtml) {
        html += window._rhDemotedPickerHtml;
        window._rhDemotedPickerHtml = '';
    }

    // Defensive re-grab: if a re-render wiped the DOM during our awaits, the
    // cached `main` is now an orphan node. Writing into it does nothing visible.
    if (!document.body.contains(main)) {
        var _live = document.getElementById('rhMain');
        if (_live) main = _live;
    }
    main.innerHTML = html;
    window.GL_REHEARSAL_READY = true;

    // ── Rehearsal History → right context rail ──
    var _rhCtx = document.getElementById('rhContextRail');
    if (_rhCtx) {
        // Inject chevron rotation CSS if not done
        if (!document.getElementById('rh-chevron-style')) {
            var _cs = document.createElement('style');
            _cs.id = 'rh-chevron-style';
            _cs.textContent = 'details[open] > summary .rh-chevron{transform:rotate(90deg)}';
            document.head.appendChild(_cs);
        }
        // Soft guidance at top of rail
        var _rhGuidance = '';
        if (weakSongs.length > 0) {
            _rhGuidance += '<div style="font-size:0.72em;color:#fbbf24;padding:2px 0">' + weakSongs.length + ' song' + (weakSongs.length > 1 ? 's' : '') + ' need work</div>';
        }
        if (confLabel) {
            _rhGuidance += '<div style="font-size:0.72em;color:' + confColor + ';padding:2px 0">Readiness: ' + confLabel + '</div>';
        }
        try {
            var _lp = localStorage.getItem('gl_last_practice_ts');
            if (_lp) {
                var _ds = Math.floor((Date.now() - new Date(_lp).getTime()) / 86400000);
                _rhGuidance += '<div style="font-size:0.72em;color:var(--text-dim);padding:2px 0">Last practice: ' + (_ds === 0 ? 'today' : _ds + 'd ago') + '</div>';
            }
        } catch(e) {}

        var _railHtml = '';
        if (_rhPlanningMode) {
            // Plan Mode right rail: context cards (readiness, focus, gig, versions, snapshots)
            _railHtml += (_rhGuidance ? '<div class="gl-context-card">' + _rhGuidance + '</div>' : '');
            // Upcoming gig context
            if (nextGig && _gigDays <= 30) {
                _railHtml += '<div class="gl-context-card" style="border-left:3px solid var(--gl-amber)">'
                    + '<div style="font-size:0.68em;font-weight:800;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px">Upcoming Gig</div>'
                    + '<div style="font-size:0.82em;font-weight:600;color:var(--gl-text)">' + escHtml(nextGig.venue || 'Gig') + '</div>'
                    + '<div style="font-size:0.72em;color:var(--gl-amber)">' + _gigDays + ' days away \u00B7 ' + (nextGig.date || '') + '</div>'
                    + (availHtml ? '<div style="margin-top:4px">' + availHtml + '</div>' : '')
                    + '</div>';
            }
            // Focus songs not in plan — right rail reminder
            if (hasSavedPlan) {
                var _planUnits = _rhGetUnits();
                var _planTitlesRail = {};
                _planUnits.forEach(function(u) {
                    if (u.title) _planTitlesRail[u.title] = true;
                    if (u.songs) u.songs.forEach(function(s) { if (s.title) _planTitlesRail[s.title] = true; });
                });
                var _missingRail = weakSongs.filter(function(f) { return !_planTitlesRail[f.title]; });
                if (_missingRail.length > 0) {
                    _railHtml += '<div class="gl-context-card" style="border-left:3px solid var(--gl-amber)">'
                        + '<div style="font-size:0.68em;font-weight:800;text-transform:uppercase;color:var(--gl-amber);margin-bottom:4px">Focus Songs Not in Plan</div>';
                    _missingRail.forEach(function(f) {
                        var _safe = f.title.replace(/'/g, "\\'");
                        _railHtml += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.75em">'
                            + '<span style="color:var(--gl-text)">' + escHtml(f.title) + '</span>'
                            + '<button onclick="_rhAddBlock(\'song\',\'' + _safe + '\')" style="font-size:0.82em;padding:1px 6px;border-radius:4px;border:1px solid rgba(34,197,94,0.2);background:none;color:#86efac;cursor:pointer">+</button>'
                            + '</div>';
                    });
                    _railHtml += '</div>';
                }
            }
            // Versioning card — single canonical location
            // No extra header here — _rhRenderSnapshots() includes its own "Plan Versions" heading
            _railHtml += '<div class="gl-context-card" id="rhVersionsRailCard">'
                + '<div id="rhSnapshots"></div>'
                + '</div>';
            // Quick actions
            _railHtml += '<div class="gl-context-card">'
                + '<div style="font-size:0.68em;font-weight:800;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px">Quick Actions</div>'
                + '<div style="display:flex;flex-direction:column;gap:4px">'
                + '<button onclick="rhOpenCreateModal()" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;font-size:0.72em;cursor:pointer;font-family:inherit">\uD83D\uDCC5 Schedule Date</button>'
                + '<button onclick="_rhLaunchSavedPlan()" style="width:100%;padding:6px;border-radius:6px;border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.06);color:#86efac;font-size:0.72em;cursor:pointer;font-family:inherit">\u25B6 Launch Plan</button>'
                + '</div></div>';
        } else {
            // Review Mode right rail: guidance + history + recordings
            // Plan stays in main column (was previously moved to rail — removed
            // because narrow rail truncated song names to "Esti..." / "Ba..." /
            // "S..." and made the plan unreadable. The plan is the page's
            // primary content and belongs in main.)
            _railHtml += (_rhGuidance ? '<div class="gl-context-card">' + _rhGuidance + '</div>' : '');
            // Practice Tasks (Workbench prelude — Phase B+) — open by default;
            // body filled in async by _rhRenderPracticeTasks() after render.
            _railHtml += '<details class="gl-context-card" id="rhTasksRailCard" style="padding:0" open>'
                + '<summary style="padding:10px 14px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px">'
                + '<span class="gl-section-label" style="padding:0;margin:0">🎯 Practice Tasks</span>'
                + '<span id="rhTasksCountBadge" style="font-size:0.62em;color:var(--gl-text-tertiary);margin-left:auto"></span>'
                + '<span style="font-size:0.5em;color:var(--gl-text-tertiary)">▸</span></summary>'
                + '<div style="padding:0 14px 10px"><div id="rhPracticeTasks"></div></div>'
                + '</details>';
            // History — collapsed
            _railHtml += '<details class="gl-context-card" style="padding:0">'
                + '<summary style="padding:10px 14px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px">'
                + '<span class="gl-section-label" style="padding:0;margin:0">History</span>'
                + '<span style="font-size:0.5em;color:var(--gl-text-tertiary)">\u25B8</span></summary>'
                + '<div style="padding:0 14px 10px">'
                + '<div style="margin-bottom:6px;display:flex;gap:4px;flex-wrap:wrap">'
                + '<button onclick="_rhRecreateFromRecording()" class="gl-btn-ghost" style="font-size:0.62em;padding:2px 6px">+ Analyze recording</button>'
                + '<button onclick="_mtOpenImportModal()" title="How to add a new multitrack rehearsal — operator-side guide" class="gl-btn-ghost" style="font-size:0.62em;padding:2px 6px">📖 How to add rehearsal</button>'
                + '</div>'
                + '<div id="rhSessionHistory"></div>'
                + '</div></details>';
            // Recordings — collapsed
            _railHtml += '<details class="gl-context-card" style="padding:0">'
                + '<summary style="padding:10px 14px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px">'
                + '<span class="gl-section-label" style="padding:0;margin:0">Recordings</span>'
                + '<span style="font-size:0.5em;color:var(--gl-text-tertiary)">\u25B8</span></summary>'
                + '<div style="padding:0 14px 10px"><div id="rhMixdownsContainer"></div></div>'
                + '</details>';
        }
        _rhCtx.innerHTML = _railHtml;
    } else {
        // Fallback: render inline if context rail not available
        main.innerHTML += '<div style="margin-top:16px"><div id="rhSessionHistory"></div><div id="rhMixdownsContainer" style="margin-top:12px"></div></div>';
    }

    // Render mixdowns section
    if (typeof RehearsalMixdowns !== 'undefined') RehearsalMixdowns.render('rhMixdownsContainer');

    // Accordion behavior — only one rail section open at a time
    if (_rhCtx) {
        _rhCtx.querySelectorAll('details').forEach(function(det) {
            det.addEventListener('toggle', function() {
                if (det.open) {
                    _rhCtx.querySelectorAll('details').forEach(function(other) {
                        if (other !== det && other.open) other.open = false;
                    });
                }
            });
        });
    }

    // Plan stays in main column in BOTH Plan Mode and Review Mode.
    // Previously the plan was moved to the right rail in Review Mode, but
    // the narrow rail truncated song names ("Esti...", "Ba...", "S...") and
    // made the page's primary content unreadable. Per UAT feedback, the plan
    // is what the page is FOR — keep it in main.

    // Wire up drag-and-drop on the unit list
    _rhInitDragDrop();

    // Render saved snapshots
    _rhRenderSnapshots();

    // Show initial save state in Plan Mode
    if (_rhPlanningMode && hasSavedPlan) {
        setTimeout(function() { _rhShowSaveState('saved'); }, 100);
    }

    // First-visit walkthrough (only when a saved plan exists)
    if (hasSavedPlan && typeof glSpotlight !== 'undefined') {
        setTimeout(function() { glSpotlight.run('rehearsal-plan-v3'); }, 800);
    }

    // Render last rehearsal snapshot + inline timeline (primary content)
    _rhRenderLastRehearsalTimeline();
    // Render full history list (inside collapsed History section)
    _rhRenderSessionHistory();
    // Render practice tasks panel (right rail, Workbench prelude)
    _rhRenderPracticeTasks();
  } catch (_glRenderE) {
    if (typeof _glRenderError === 'function') _glRenderError(main, '_rhRenderCommandFlow', _glRenderE);
  } finally {
    _rhRenderInProgress = false;
    // Flush a queued re-render if focusChanged (or another caller) tried to
    // re-render while this one was in flight. Belt-and-suspenders: also
    // covers the case where the caller wiped the DOM before the guard saved us.
    if (_rhRenderQueued) {
        _rhRenderQueued = false;
        var _pageEl = document.getElementById('page-rehearsal');
        if (_pageEl) setTimeout(function() { renderRehearsalPage(_pageEl); }, 0);
    }
  }
}

// Clear saved rehearsal plan (explicit user action — auto-snapshots first)
// ── PLAN MODE: full-width planning workspace ────────────────────────────────
window._rhOpenPlanMode = function() {
    // If no plan exists, seed from focus songs first
    var units = _rhGetUnits();
    if (!units || !units.length) {
        var _focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
        if (_focus.list.length > 0) {
            var newUnits = _focus.list.map(function(s) {
                return { type: 'single', title: s.title, band: '', block: 'flow' };
            });
            _rhSaveUnits(newUnits);
            if (typeof showToast === 'function') showToast('Plan started with ' + newUnits.length + ' focus songs');
        }
    }
    // Enter Plan Mode
    _rhSetPageMode('plan');
    var el = document.querySelector('.app-page:not(.hidden)') || document.body;
    renderRehearsalPage(el);
};

window._rhExitPlanMode = function() {
    _rhSetPageMode('review');
    var el = document.querySelector('.app-page:not(.hidden)') || document.body;
    renderRehearsalPage(el);
};

window._rhClearSavedPlan = async function() {
    if (!confirm('Clear your saved rehearsal plan? A snapshot will be saved automatically.')) return;
    await _rhSaveSnapshot('Before clearing plan');
    try {
        localStorage.removeItem('glPlannerQueue');
        localStorage.removeItem('glPlannerGuidance');
        localStorage.removeItem('glPlannerUnits');
        localStorage.removeItem('glSavedPlanName');
    } catch(e) {}
    // Phase 3b: null the currentPlanId pointer instead of wiping the
    // rehearsal_plans collection. The cleared plan stays in collection as
    // history; "no plan" survives reload because _rhLoadPlanFromFirebase
    // honors the explicit-null pointer.
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try { await db.ref(bandPath('rehearsal_state/currentPlanId')).set(null); }
        catch(e) { console.warn('[RhPlan] currentPlanId clear failed:', e.message); }
    }
    _rhPlanCache = null;
    if (typeof showToast === 'function') showToast('Plan cleared (snapshot saved)');
    var el = document.getElementById('rhMain');
    if (el) _rhRenderCommandFlow(document.querySelector('.app-page:not(.hidden)') || document.body);
};

// ── Intent-Based Entry (Phase 1+) ─────────────────────────────────────────────
// Shown when no active plan exists. Replaces the single "Plan Next Rehearsal"
// CTA with 4 intent buttons + 2 secondary actions. Each handler reuses
// existing logic: setlist for "Run the Gig", linkedPairs detection for
// "Practice Transitions", GLStore.getNowFocus() for "Work Weak Songs",
// existing wizard/plan-mode for "Build Custom Plan", existing snapshot
// restore for "Resume Last Plan", existing session timeline for
// "Review Last Rehearsal". No new systems built.

// Phase 2: intent metadata is the single source of truth for label /
// emoji / color across the intent picker, plan-card badge, and Continue
// chip. Keep these definitions in sync with the picker buttons below.
function _rhPlanIntentMeta(intent) {
    var defs = {
        'gig-run':     { label: 'Run the Gig',          emoji: '🎤', color: '#a5b4fc' },
        'transitions': { label: 'Practice Transitions', emoji: '🔗', color: '#86efac' },
        'weak':        { label: 'Work Weak Songs',      emoji: '🎯', color: '#fbbf24' },
        'custom':      { label: 'Custom Plan',          emoji: '📋', color: '#94a3b8' }
    };
    return defs[intent] || null;
}

// Phase 2: canonical plan-naming derived from intent + context. Used by
// each intent handler so naming stays consistent and the user can tell
// at a glance what the plan was built for.
function _rhDerivePlanName(intent, ctx) {
    if (intent === 'gig-run')     return 'Run ' + ((ctx && ctx.gig && ctx.gig.venue) || 'the Gig');
    if (intent === 'transitions') return 'Transitions for ' + ((ctx && ctx.gig && ctx.gig.venue) || 'gig');
    if (intent === 'weak')        return 'Work weak songs (' + ((ctx && ctx.count) || 0) + ')';
    if (intent === 'custom')      return 'Custom plan';
    return 'Rehearsal Plan';
}

// Phase 3a: render a "🎤 Built for [venue] · [date]" chip given a plan that
// carries gigId/gigDate/gigVenue. Returns '' for unlinked plans (legacy or
// weak-songs intent) so callers can blindly inject the result.
function _rhPlanGigChip(planCache) {
    if (!planCache || !planCache.gigId) return '';
    var venue = planCache.gigVenue || 'Gig';
    var dateLabel = '';
    if (planCache.gigDate) {
        try {
            dateLabel = new Date(planCache.gigDate + 'T12:00:00')
                .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch(e) {}
    }
    var label = '🎤 Built for ' + venue + (dateLabel ? ' · ' + dateLabel : '');
    return '<span title="This plan is linked to ' + escHtml(venue) + (dateLabel ? ' on ' + dateLabel : '') + '" '
        + 'style="font-size:0.62em;font-weight:700;color:#fbbf24;background:rgba(245,158,11,0.08);'
        + 'border:1px solid rgba(245,158,11,0.3);padding:2px 7px;border-radius:10px;'
        + 'text-transform:uppercase;letter-spacing:0.04em;flex-shrink:0;white-space:nowrap">'
        + escHtml(label) + '</span>';
}

// ─────────────────────────────────────────────────────────────────────────
// Living Set Sheet — inline rehearsal intelligence (2026-05-15).
//
// Each unit row in the flow rail can carry ONE compact signal that adds
// rehearsal memory without turning the page into a dashboard. Restraint
// is the rule: most rows show no signal at all. Precedence (top wins):
//
//   1. ⚠ Transition into B still rough after N rehearsals  (linked + persistent + focus)
//   2. ⚠ Still rough after N rehearsals                    (single + persistent open ann)
//   3. ⚠ Transition needs work                              (linked + focus, no persistence)
//   4. 💬 N open notes                                      (active annotations)
//   5. ⚠ Recurring trouble spot                             (single in focus, played 3+ sessions)
//   6. ⚠ Low readiness — N%                                 (single in focus, no recurrence)
//   7. ✓ Tightened significantly since last week           (confidence delta ≥ 0.15)
//   8. 🔥 Strongest take from last rehearsal                (highest latest-session avg conf)
//   9. ✓ Tight last rehearsal                              (avg ≥ 0.7 in latest session)
//
// "Strongest take" + "Tightened" + "Tight last rehearsal" only fire when no
// warning-level signal matched — per spec, positive signals never displace
// active issues.
//
// All inputs are pre-bucketed lookups; signal computation stays synchronous.
//
// Returns: { [unitIndex]: { icon, color, message, action? { label, onclick } } }
// Missing entries = no signal for that row (the desired empty state).
// ─────────────────────────────────────────────────────────────────────────
function _rhBuildSongSignals(units, focusList, latestSession, annByTitle, history, annAgeByTitle) {
    var signals = {};
    if (!Array.isArray(units) || !units.length) return signals;

    // Focus map — title -> {avg}
    var focusByTitle = {};
    (focusList || []).forEach(function (f) { if (f && f.title) focusByTitle[f.title] = f; });

    // Tight-last-rehearsal map — derived from the latest session's segments.
    // Threshold 0.7 is intentionally conservative: only fire on solid takes.
    var tightByTitle = {};
    if (latestSession && latestSession.audio_segments) {
        var segs = Array.isArray(latestSession.audio_segments)
            ? latestSession.audio_segments
            : Object.values(latestSession.audio_segments);
        var titleConfs = {};
        segs.forEach(function (s) {
            if (!s || !s.songTitle) return;
            if (typeof s.confidence !== 'number') return;
            // Skip non-music segment types so talking/false-starts don't seed positive signals
            var t = s.type || s.segType || 'song';
            if (t === 'talking' || t === 'speech' || t === 'discussion' || t === 'false_start' || t === 'ignore') return;
            if (!titleConfs[s.songTitle]) titleConfs[s.songTitle] = [];
            titleConfs[s.songTitle].push(s.confidence);
        });
        Object.keys(titleConfs).forEach(function (t) {
            var arr = titleConfs[t];
            var avg = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
            if (avg >= 0.7) tightByTitle[t] = avg;
        });
    }

    annByTitle = annByTitle || {};
    history = history || {};
    annAgeByTitle = annAgeByTitle || {};

    // Cheap lookups derived from history:
    //   - isStrongest(title)   → highest latest-session avg conf across all titles
    //   - tightenedDelta(title) → improvement signal (≥0.15 vs prior session)
    //   - persistAge(title)    → if open annotations span ≥2 prior rehearsals
    //   - sessionsPlayed(title) → number of recent sessions song appeared in
    function persistAge(title) {
        var a = annAgeByTitle[title];
        return (a && a.rehearsalsAgo >= 2) ? a.rehearsalsAgo : 0;
    }
    function tightenedDelta(title) {
        var h = history[title];
        if (!h || !Array.isArray(h.sessionConfs) || h.sessionConfs.length < 2) return 0;
        var latest = h.sessionConfs[0], prev = h.sessionConfs[1];
        if (typeof latest !== 'number' || typeof prev !== 'number') return 0;
        var delta = latest - prev;
        return (delta >= 0.15 && latest >= 0.6) ? delta : 0;
    }
    function sessionsPlayed(title) {
        var h = history[title];
        return (h && typeof h.appearances === 'number') ? h.appearances : 0;
    }

    units.forEach(function (unit, idx) {
        var bt = unit.type || 'single';
        // Never signal on dividers, notes, business blocks, exercises, jams.
        // Those rows are operational labels, not songs.
        if (bt === 'section' || bt === 'note' || bt === 'business' || bt === 'exercise' || bt === 'jam') return;

        if (bt === 'linked' && unit.songs && unit.songs.length >= 2) {
            var pairTitles = unit.songs.map(function (s) { return s && s.title; }).filter(Boolean);
            if (!pairTitles.length) return;
            var anyFocus = pairTitles.some(function (t) { return !!focusByTitle[t]; });
            var totalAnns = pairTitles.reduce(function (n, t) { return n + (annByTitle[t] || 0); }, 0);

            // Persistent transition issue — strongest signal for linked pairs.
            // If either song in the pair has open annotations carrying age ≥2,
            // surface the persistence ("still rough after N rehearsals") and
            // name the target song so the warning reads musically.
            var maxAge = 0, persistTarget = null;
            pairTitles.forEach(function (t) {
                var age = persistAge(t);
                if (age > maxAge) { maxAge = age; persistTarget = t; }
            });
            if (maxAge >= 2) {
                var targetLabel = (persistTarget === pairTitles[pairTitles.length - 1])
                    ? 'Transition into ' + persistTarget + ' still rough after ' + maxAge + ' rehearsals'
                    : 'Transition still rough after ' + maxAge + ' rehearsals';
                signals[idx] = {
                    icon: '⚠',
                    color: '#f97316', // sharper amber for persistence (vs gentle warning)
                    message: targetLabel,
                    actions: [
                        { label: 'Practice transition', onclick: 'window._rhPracticeTransitionUnit(' + idx + ')' },
                        // Closure-pass affordance: resolve the oldest open
                        // annotation on the affected song so the persistent
                        // signal can disappear when the band actually fixed it.
                        { label: 'Mark resolved', onclick: 'window._rhMarkOldestNoteResolved(' + idx + ')' }
                    ]
                };
                return;
            }

            if (anyFocus) {
                // Active transition warning — not yet persistent, but a focus
                // song is in the pair so practicing the seam pays off.
                signals[idx] = {
                    icon: '⚠',
                    color: '#fbbf24',
                    message: 'Transition needs work',
                    action: { label: 'Practice transition', onclick: 'window._rhPracticeTransitionUnit(' + idx + ')' }
                };
                return;
            }

            if (totalAnns > 0) {
                signals[idx] = {
                    icon: '💬',
                    color: '#a78bfa',
                    message: totalAnns + ' open note' + (totalAnns > 1 ? 's' : ''),
                    action: null
                };
                return;
            }
            // No positive linked-pair signal — keeping restraint per spec.
            return;
        }

        if (bt === 'single' || bt === 'song') {
            var t = unit.title;
            if (!t) return;

            // ── WARNING-LEVEL SIGNALS (top precedence) ────────────────────
            // Persistent unresolved issue — outranks low readiness.
            var ageR = persistAge(t);
            if (ageR >= 2) {
                signals[idx] = {
                    icon: '⚠',
                    color: '#f97316',
                    message: 'Still rough after ' + ageR + ' rehearsals',
                    actions: [
                        { label: 'Open notes', onclick: 'window._rhOpenSongNotes(' + idx + ')' },
                        // Closure-pass affordance: one-tap resolve on the
                        // oldest open annotation so the signal can clear when
                        // the band judges the issue fixed.
                        { label: 'Mark resolved', onclick: 'window._rhMarkOldestNoteResolved(' + idx + ')' }
                    ]
                };
                return;
            }

            // Open notes (no persistence yet) — keep as informational warning.
            if (annByTitle[t] && annByTitle[t] > 0) {
                signals[idx] = {
                    icon: '💬',
                    color: '#a78bfa',
                    message: annByTitle[t] + ' open note' + (annByTitle[t] > 1 ? 's' : ''),
                    action: { label: 'Open notes', onclick: 'window._rhOpenSongNotes(' + idx + ')' }
                };
                return;
            }

            // Recurring trouble spot — focus song that's been played 3+ times.
            // Reads more empathetic than the generic readiness percentage.
            if (focusByTitle[t] && sessionsPlayed(t) >= 3) {
                signals[idx] = {
                    icon: '⚠',
                    color: '#fbbf24',
                    message: 'Recurring trouble spot',
                    action: null
                };
                return;
            }

            // Generic low readiness — the existing baseline warning.
            if (focusByTitle[t]) {
                var pct = Math.round((focusByTitle[t].avg / 5) * 100);
                signals[idx] = {
                    icon: '⚠',
                    color: '#fbbf24',
                    message: 'Low readiness — ' + pct + '% locked',
                    action: null
                };
                return;
            }

            // ── POSITIVE SIGNALS (only fire when no warning matched) ──────
            // Tightened significantly — emotional improvement signal.
            var delta = tightenedDelta(t);
            if (delta >= 0.15) {
                signals[idx] = {
                    icon: '✓',
                    color: '#22c55e',
                    message: 'Tightened significantly since last week',
                    action: null
                };
                return;
            }

            // Strongest take from last rehearsal — peak-of-session signal.
            // Only one song wins this per session (highest avg conf ≥0.7).
            if (history[t] && history[t].isStrongest) {
                signals[idx] = {
                    icon: '🔥',
                    color: '#22c55e',
                    message: 'Strongest take from last rehearsal',
                    action: null
                };
                return;
            }

            // Generic tight-last-rehearsal positive signal.
            if (tightByTitle[t]) {
                signals[idx] = {
                    icon: '✓',
                    color: '#22c55e',
                    message: 'Tight last rehearsal',
                    action: null
                };
                return;
            }
        }
    });

    return signals;
}

// ─────────────────────────────────────────────────────────────────────────
// Rehearsal history fingerprint — used by the progression-memory signals.
// Walks the recent 5 sessions; per song captures appearances + per-session
// confidence avg. Pre-identifies the "strongest take" winner (highest
// latest-session avg conf, threshold ≥0.7). Returns map keyed by song title.
// ─────────────────────────────────────────────────────────────────────────
function _rhBuildSongHistory(sessionsCache) {
    var out = {};
    if (!Array.isArray(sessionsCache) || !sessionsCache.length) return out;
    var recent = sessionsCache.slice(0, 5); // _rhLoadSessions sorts newest-first

    recent.forEach(function (sess, sIdx) {
        var raw = sess && sess.audio_segments;
        var segs = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
        var sessConfs = {};
        segs.forEach(function (s) {
            if (!s || !s.songTitle) return;
            if (typeof s.confidence !== 'number') return;
            var t = s.type || s.segType || 'song';
            if (t === 'talking' || t === 'speech' || t === 'discussion' || t === 'false_start' || t === 'ignore') return;
            if (!sessConfs[s.songTitle]) sessConfs[s.songTitle] = [];
            sessConfs[s.songTitle].push(s.confidence);
        });
        Object.keys(sessConfs).forEach(function (title) {
            var arr = sessConfs[title];
            var avg = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
            if (!out[title]) out[title] = { appearances: 0, sessionConfs: [] };
            out[title].appearances++;
            out[title].sessionConfs.push(avg); // index 0 = latest, 1 = prev, …
        });
    });

    // Identify the strongest-take winner from the latest session only.
    // (Strongest is a "peak of last rehearsal" signal, not a rolling winner.)
    var strongestTitle = null, strongestConf = 0;
    Object.keys(out).forEach(function (t) {
        var latest = out[t].sessionConfs[0];
        if (typeof latest === 'number' && latest >= 0.7 && latest > strongestConf) {
            strongestConf = latest;
            strongestTitle = t;
        }
    });
    if (strongestTitle) out[strongestTitle].isStrongest = true;

    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Annotation age — for each song with open annotations, derive how many
// recent rehearsals have happened since the OLDEST open annotation was
// created. Drives the "still rough after N rehearsals" persistence signal.
// Returns: { [title]: { count, rehearsalsAgo } }
// ─────────────────────────────────────────────────────────────────────────
function _rhBuildAnnotationAge(allAnnotations, sessionsCache) {
    var out = {};
    if (!Array.isArray(allAnnotations) || !allAnnotations.length) return out;

    // First pass — bucket open annotations by song title, keep oldest created_at.
    allAnnotations.forEach(function (a) {
        if (!a || a.archived) return;
        if (a.status === 'fixed') return;
        var key = a.anchor && a.anchor.song_id;
        if (!key) return;
        if (!out[key]) out[key] = { count: 0, oldestCreatedAt: a.created_at || Date.now() };
        out[key].count++;
        if (a.created_at && a.created_at < out[key].oldestCreatedAt) {
            out[key].oldestCreatedAt = a.created_at;
        }
    });

    // Second pass — count how many recent sessions (out of the latest 5)
    // happened after each song's oldest annotation. That count IS the
    // "still rough after N rehearsals" number.
    var recent = Array.isArray(sessionsCache) ? sessionsCache.slice(0, 5) : [];
    var sessionDatesMs = recent.map(function (s) {
        if (!s || !s.date) return 0;
        try { return new Date(s.date + 'T12:00:00').getTime(); } catch (e) { return 0; }
    }).filter(function (n) { return n > 0; });

    Object.keys(out).forEach(function (title) {
        var oldest = out[title].oldestCreatedAt;
        var n = 0;
        sessionDatesMs.forEach(function (ms) { if (ms >= oldest) n++; });
        out[title].rehearsalsAgo = n;
    });

    return out;
}

// Render a single inline signal sub-line. Returns '' when sig is null so
// the call site can blindly inject the result.
//
// Two action shapes are supported (back-compat preserved):
//   sig.action  — { label, onclick }   single-action shorthand
//   sig.actions — [{ label, onclick }] multi-action array (closure pass)
//
// Multi-action mode joins links with ' · ' inline; mobile still wraps via
// the flex container so each link can fall to its own line on narrow widths.
function _rhRenderUnitSignal(sig) {
    if (!sig) return '';
    var actions = [];
    if (Array.isArray(sig.actions)) actions = sig.actions.filter(function (a) { return a && a.label && a.onclick; });
    else if (sig.action && sig.action.label && sig.action.onclick) actions = [sig.action];

    var linkStyle = 'color:#818cf8;text-decoration:none;border-bottom:1px dotted rgba(129,140,248,0.3);cursor:pointer';
    var actionHtml = '';
    actions.forEach(function (a) {
        actionHtml += ' · <a href="#" onclick="event.preventDefault();' + a.onclick + '" style="' + linkStyle + '">'
            + escHtml(a.label) + '</a>';
    });

    return '<div class="rh-unit-signal" style="padding:0 4px 4px 36px;font-size:0.68em;color:'
        + sig.color + ';opacity:0.9;line-height:1.3;display:flex;flex-wrap:wrap;align-items:center;gap:4px">'
        + '<span>' + sig.icon + ' ' + escHtml(sig.message) + '</span>'
        + actionHtml
        + '</div>';
}

// Per-unit Practice Transition handler — opens rehearsal mode with just
// the two songs in the linked pair queued. Reuses the existing
// `openRehearsalModeWithQueue` API; no new lifecycle work.
window._rhPracticeTransitionUnit = function (idx) {
    var units = _rhGetUnits() || [];
    var u = units[idx];
    if (!u || u.type !== 'linked' || !u.songs || u.songs.length < 2) {
        if (typeof showToast === 'function') showToast('Not a transition pair');
        return;
    }
    var queue = u.songs
        .filter(function (s) { return s && s.title; })
        .map(function (s) { return { title: s.title, budgetMin: 5 }; });
    if (!queue.length) return;
    if (typeof openRehearsalModeWithQueue === 'function') {
        openRehearsalModeWithQueue(queue);
    } else if (typeof showToast === 'function') {
        showToast('Rehearsal mode unavailable');
    }
};

// Open Song Detail focused on the notes panel for a unit's single song.
// Falls back to a song-detail open without notes hash if the deep link
// isn't supported by the current SD implementation.
window._rhOpenSongNotes = function (idx) {
    var units = _rhGetUnits() || [];
    var u = units[idx];
    var title = u && u.title;
    if (!title) return;
    if (typeof openSongDetail === 'function') {
        openSongDetail(title);
    } else if (typeof showPage === 'function') {
        try { window.location.hash = '#song/' + encodeURIComponent(title); } catch (e) {}
    }
};

// Closure-pass handler: resolve the OLDEST open annotation on the unit's
// song so the "Still rough after N rehearsals" signal can clear. For
// linked-pair units we resolve the oldest open annotation across either
// song in the pair (matches the persistence message that's driving the
// signal). Lightweight by design — no confirm modal, just an instant
// resolve + toast. Spec: "Feels fixed? / Mark resolved / Looks good now?"
window._rhMarkOldestNoteResolved = async function (idx) {
    if (typeof window.GLAnnotations === 'undefined') {
        if (typeof showToast === 'function') showToast('Notes system not loaded');
        return;
    }
    var units = _rhGetUnits() || [];
    var u = units[idx];
    if (!u) return;

    var titles = [];
    if (u.type === 'linked' && Array.isArray(u.songs)) {
        u.songs.forEach(function (s) { if (s && s.title) titles.push(s.title); });
    } else if (u.title) {
        titles.push(u.title);
    }
    if (!titles.length) return;

    // Load + find the oldest open annotation matching any song in the unit.
    var oldest = null;
    try {
        var all = await window.GLAnnotations.listAnnotationsByAnchor({});
        (all || []).forEach(function (a) {
            if (!a || a.archived) return;
            if (a.status === 'fixed') return;
            var key = a.anchor && a.anchor.song_id;
            if (!key || titles.indexOf(key) === -1) return;
            if (!oldest || (a.created_at && a.created_at < oldest.created_at)) oldest = a;
        });
    } catch (e) {
        if (typeof showToast === 'function') showToast('Could not load notes');
        return;
    }
    if (!oldest) {
        if (typeof showToast === 'function') showToast('No open note to resolve');
        return;
    }

    try {
        await window.GLAnnotations.updateAnnotation(oldest.id, { status: 'fixed' });
        if (typeof showToast === 'function') showToast('✓ Marked resolved — ' + (oldest.text || '').slice(0, 40));
    } catch (e) {
        if (typeof showToast === 'function') showToast('Resolve failed');
        return;
    }

    // Re-render the page so the persistent signal clears immediately.
    try {
        var el = document.getElementById('page-rehearsal');
        if (el && typeof renderRehearsalPage === 'function') renderRehearsalPage(el);
    } catch (e) {}
};

// ─────────────────────────────────────────────────────────────────────────
// Tonight's Rehearsal HERO — UX hierarchy refactor (2026-05-15).
//
// Tester feedback: the Rehearsal page felt like a workflow chooser instead
// of a guided rehearsal flow. This hero becomes the dominant object on the
// page when a plan exists: venue, song count, duration, focus signal, gig
// countdown, and three primary CTAs (Start / Edit Flow / Review Last).
//
// Reuses existing call sites — `_rhConfirmStartRehearsal`, `_rhOpenPlanMode`,
// `_rhIntentReviewLastRehearsal` — so the underlying logic is unchanged.
// What changes is visual gravity: this card is the page's center of
// attention; the intent picker drops to a "+ Build a different flow"
// details below the flow rail.
//
// Inputs:
//   planCache       — the saved plan (intent, name, gig back-ref)
//   songCount       — pre-computed unit count for "N songs"
//   durationLabel   — pre-computed "Nm" / "Xh Ym" string
//   opts.nextGig    — { date, venue, setlistId } or null
//   opts.gigDays    — days until gig (number) or 999 when none
//   opts.focusCount — weak song count
//   opts.weakSongs  — full focus list (so we can show top focus song name)
//   opts.hasSessions— enable/disable "Review Last Rehearsal"
// ─────────────────────────────────────────────────────────────────────────
function _rhRenderTonightsHero(planCache, songCount, durationLabel, opts) {
    if (!planCache) return '';
    opts = opts || {};
    var intent = planCache.intent || 'custom';
    var meta = _rhPlanIntentMeta(intent) || _rhPlanIntentMeta('custom');
    var planName = planCache.name || 'Rehearsal Plan';
    var nextGig = opts.nextGig || null;
    var gigDays = opts.gigDays;
    var focusCount = opts.focusCount || 0;
    var hasSessions = !!opts.hasSessions;

    // Build the stat strip: "6 songs · 27 min · Focus: transitions"
    var statParts = [];
    if (songCount) statParts.push(songCount + ' song' + (songCount === 1 ? '' : 's'));
    if (durationLabel) statParts.push(durationLabel);
    if (focusCount > 0) {
        statParts.push('Focus: ' + focusCount + ' weak song' + (focusCount > 1 ? 's' : ''));
    } else if (intent === 'transitions') {
        statParts.push('Focus: transitions');
    } else if (intent === 'gig-run') {
        statParts.push('Focus: gig run-through');
    }

    // Gig countdown line — only when relevant (within ~60d). Uses the same
    // urgency color thresholds as the rest of the page.
    var countdownLine = '';
    if (nextGig && gigDays != null && gigDays < 60) {
        var gigVenue = nextGig.venue || 'Upcoming gig';
        var countdownColor = (gigDays <= 3) ? 'var(--gl-amber)' : (gigDays <= 14) ? '#fbbf24' : 'var(--gl-text-tertiary)';
        var countdownText;
        if (gigDays <= 0)      countdownText = '🎤 ' + gigVenue + ' — today';
        else if (gigDays === 1) countdownText = '🎤 ' + gigVenue + ' — tomorrow';
        else                    countdownText = '🎤 ' + gigDays + ' days until ' + gigVenue;
        countdownLine = '<div style="font-size:0.78em;color:' + countdownColor + ';margin-top:6px;font-weight:600">' + escHtml(countdownText) + '</div>';
    }

    // Review Last button is gated on whether sessions exist; greyed when none.
    var reviewBtn = hasSessions
        ? '<button onclick="_rhIntentReviewLastRehearsal()" class="gl-btn-ghost" style="padding:9px 16px;font-size:0.82em;font-family:inherit">📊 Review Last Rehearsal</button>'
        : '<button disabled class="gl-btn-ghost" title="No past rehearsals to review" style="padding:9px 16px;font-size:0.82em;font-family:inherit;opacity:0.45;cursor:not-allowed">📊 Review Last Rehearsal</button>';

    var html = '';
    html += '<div class="gl-tonights-hero" style="margin-bottom:var(--gl-space-md);padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,rgba(102,126,234,0.10),rgba(118,75,162,0.06));border:1px solid rgba(99,102,241,0.30);box-shadow:0 2px 14px rgba(99,102,241,0.08)">';
    html += '<div style="font-size:0.68em;font-weight:800;color:' + meta.color + ';letter-spacing:0.10em;text-transform:uppercase;margin-bottom:6px">' + meta.emoji + ' Tonight’s Rehearsal</div>';
    html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">';
    html += '<div style="font-size:1.15em;font-weight:700;color:var(--gl-text);line-height:1.25">' + escHtml(planName) + '</div>';
    html += _rhPlanGigChip(planCache);
    html += '</div>';
    if (statParts.length) {
        html += '<div style="font-size:0.84em;color:var(--gl-text-tertiary);line-height:1.4">' + escHtml(statParts.join(' · ')) + '</div>';
    }
    html += countdownLine;
    html += '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">';
    html += '<button onclick="_rhConfirmStartRehearsal()" class="gl-btn-primary" style="padding:10px 22px;font-size:0.92em;font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);box-shadow:0 3px 12px rgba(99,102,241,0.20);font-family:inherit">▶ Start Rehearsal</button>';
    html += '<button onclick="_rhOpenPlanMode()" class="gl-btn-ghost" style="padding:9px 16px;font-size:0.82em;font-family:inherit">✏️ Edit Flow</button>';
    html += reviewBtn;
    html += '</div>';
    html += '</div>';
    return html;
}

// Phase 2: "Continue last plan?" chip — kept for back-compat callers that
// want the slim version (not used by the main Rehearsal page since the
// Tonight's Rehearsal hero now replaces it at the entry surface).
function _rhRenderContinueChip(planCache, songCount, durationLabel) {
    if (!planCache) return '';
    var intent = planCache.intent || 'custom';
    var meta = _rhPlanIntentMeta(intent) || _rhPlanIntentMeta('custom');
    var planName = planCache.name || 'Rehearsal Plan';
    var html = '<div style="margin-bottom:var(--gl-space-md);padding:12px 16px;border-radius:10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.25);display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
    html += '<span style="font-size:1.4em;flex-shrink:0">' + meta.emoji + '</span>';
    html += '<div style="flex:1;min-width:200px">';
    html += '<div style="font-size:0.7em;font-weight:700;color:' + meta.color + ';text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">Continue: ' + meta.label + '</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
    html += '<span style="font-size:0.92em;font-weight:700;color:var(--gl-text)">' + escHtml(planName) + '</span>';
    html += _rhPlanGigChip(planCache); // Phase 3a: gig back-ref chip (empty when unlinked)
    html += '</div>';
    html += '<div style="font-size:0.72em;color:var(--gl-text-tertiary);margin-top:2px">' + (songCount || 0) + ' song' + (songCount === 1 ? '' : 's') + ' in plan' + (durationLabel ? ' · ' + durationLabel : '') + '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;flex-shrink:0">';
    html += '<button onclick="_rhConfirmStartRehearsal()" class="gl-btn-primary" style="padding:9px 18px;font-size:0.85em;background:linear-gradient(135deg,#667eea,#764ba2);box-shadow:0 2px 8px rgba(99,102,241,0.15)">▶ Start</button>';
    html += '<button onclick="_rhOpenPlanMode()" class="gl-btn-ghost" style="padding:7px 14px;font-size:0.78em">📋 Edit</button>';
    html += '</div>';
    html += '</div>';
    return html;
}

function _rhRenderIntentPicker(opts) {
    opts = opts || {};
    var nextGig = opts.nextGig || null;
    var focusCount = opts.focusCount || 0;
    var hasGigSetlist = !!(nextGig && nextGig.setlistId);
    var hasFocus = focusCount > 0;
    var hasSnapshots = !!opts.hasSnapshots;
    var hasSessions = !!opts.hasSessions;

    var html = '<div class="gl-intent-picker" style="margin-bottom:var(--gl-space-md);padding:18px 16px;border-radius:12px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12)">';
    html += '<div style="font-size:0.95em;font-weight:700;color:var(--gl-text);margin-bottom:14px;text-align:center">What do you want to do?</div>';

    // Primary intents (4 buttons, 2-up grid on wide, 1-up on narrow)
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:12px">';

    // Run the Gig
    var runGigDisabled = !hasGigSetlist;
    var runGigSub = hasGigSetlist
        ? escHtml(nextGig.venue || 'Upcoming gig') + (opts.gigDays != null && opts.gigDays >= 0 ? ' · ' + opts.gigDays + 'd away' : '')
        : 'No upcoming gig with setlist';
    html += _rhIntentBtnHtml({
        action: '_rhIntentRunGig()',
        emoji: '🎤',
        label: 'Run the Gig',
        sub: runGigSub,
        disabled: runGigDisabled
    });

    // Practice Transitions
    var ptDisabled = !hasGigSetlist;
    var ptSub = hasGigSetlist
        ? 'Drill linked pairs from the setlist'
        : 'No upcoming gig with setlist';
    html += _rhIntentBtnHtml({
        action: '_rhIntentPracticeTransitions()',
        emoji: '🔗',
        label: 'Practice Transitions',
        sub: ptSub,
        disabled: ptDisabled
    });

    // Work Weak Songs
    var wsDisabled = !hasFocus;
    var wsSub = hasFocus
        ? focusCount + ' song' + (focusCount > 1 ? 's' : '') + ' need' + (focusCount === 1 ? 's' : '') + ' work'
        : 'No focus songs flagged';
    html += _rhIntentBtnHtml({
        action: '_rhIntentWorkWeakSongs()',
        emoji: '🎯',
        label: 'Work Weak Songs',
        sub: wsSub,
        disabled: wsDisabled
    });

    // Build Custom Plan
    html += _rhIntentBtnHtml({
        action: '_rhIntentBuildCustom()',
        emoji: '📋',
        label: 'Build Custom Plan',
        sub: 'Use the planner step-by-step',
        disabled: false
    });

    html += '</div>'; // end primary grid

    // Secondary actions (2 small chips)
    html += '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
    html += '<button onclick="_rhIntentResumeLastPlan()"' + (hasSnapshots ? '' : ' disabled') + ' style="padding:6px 14px;font-size:0.78em;border-radius:6px;cursor:' + (hasSnapshots ? 'pointer' : 'not-allowed') + ';border:1px solid rgba(255,255,255,0.08);background:none;color:var(--gl-text-tertiary);font-family:inherit;opacity:' + (hasSnapshots ? '1' : '0.45') + '" title="' + (hasSnapshots ? 'Restore the most recent saved plan' : 'No prior plans to restore') + '">↺ Resume Last Plan</button>';
    html += '<button onclick="_rhIntentReviewLastRehearsal()"' + (hasSessions ? '' : ' disabled') + ' style="padding:6px 14px;font-size:0.78em;border-radius:6px;cursor:' + (hasSessions ? 'pointer' : 'not-allowed') + ';border:1px solid rgba(255,255,255,0.08);background:none;color:var(--gl-text-tertiary);font-family:inherit;opacity:' + (hasSessions ? '1' : '0.45') + '" title="' + (hasSessions ? 'Open the most recent rehearsal timeline' : 'No past rehearsals to review') + '">📊 Review Last Rehearsal</button>';
    html += '</div>';

    html += '</div>'; // end picker
    return html;
}

function _rhIntentBtnHtml(b) {
    var bg = b.disabled
        ? 'rgba(255,255,255,0.02)'
        : 'linear-gradient(135deg,rgba(102,126,234,0.18),rgba(118,75,162,0.12))';
    var border = b.disabled
        ? 'rgba(255,255,255,0.06)'
        : 'rgba(99,102,241,0.35)';
    var color = b.disabled ? 'var(--gl-text-tertiary)' : 'var(--gl-text)';
    var cursor = b.disabled ? 'not-allowed' : 'pointer';
    var opacity = b.disabled ? '0.5' : '1';
    var html = '<button ' + (b.disabled ? 'disabled ' : '') + 'onclick="' + b.action + '" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px 16px;border-radius:10px;cursor:' + cursor + ';border:1px solid ' + border + ';background:' + bg + ';color:' + color + ';opacity:' + opacity + ';text-align:left;font-family:inherit;transition:transform 0.1s">';
    html += '<div style="display:flex;align-items:center;gap:8px;width:100%"><span style="font-size:1.3em">' + b.emoji + '</span><span style="font-size:0.92em;font-weight:700">' + b.label + '</span></div>';
    html += '<div style="font-size:0.72em;color:var(--gl-text-tertiary);margin-left:30px">' + b.sub + '</div>';
    html += '</button>';
    return html;
}

// Build a units array from a setlist's songs in order. Each song becomes
// a single-block. Reuses the same shape _rhSaveUnits already accepts.
async function _rhBuildUnitsFromUpcomingGigSetlist() {
    var gigs = [];
    try { gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []); } catch(e) {}
    var today = new Date().toISOString().split('T')[0];
    var nextGig = gigs.filter(function(g) { return g.date >= today && g.setlistId; })
        .sort(function(a,b) { return a.date.localeCompare(b.date); })[0] || null;
    if (!nextGig) return { units: [], gig: null, setlist: null };

    var setlists = window._glCachedSetlists || [];
    var sl = setlists.find(function(s) { return s.setlistId === nextGig.setlistId; });
    if (!sl) {
        try {
            setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
            sl = setlists.find(function(s) { return s.setlistId === nextGig.setlistId; });
        } catch(e) {}
    }
    if (!sl) return { units: [], gig: nextGig, setlist: null };

    // Same extraction logic as _rpSelectGig (rehearsal.js:4985-4995): preserves
    // setlist order and segue metadata. We reuse this for both "Run the Gig"
    // and "Practice Transitions" intents.
    var songs = [];
    (sl.sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(sg) {
            var title = typeof sg === 'string' ? sg : (sg.title || '');
            if (!title) return;
            var segue = (typeof sg === 'object') ? (sg.segue || 'stop') : 'stop';
            var songData = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === title; }) : null;
            songs.push({ title: title, band: songData ? (songData.band || '') : '', _segue: segue });
        });
    });

    var units = songs.map(function(s) {
        return { type: 'single', title: s.title, band: s.band, block: 'flow' };
    });
    return { units: units, gig: nextGig, setlist: sl, songs: songs };
}

// Build linked-pair units from the upcoming gig's setlist segue data. Reuses
// the same detection logic as _rpSelectGig (rehearsal.js:4998-5007).
async function _rhBuildUnitsFromGigLinkedPairs() {
    var ctx = await _rhBuildUnitsFromUpcomingGigSetlist();
    if (!ctx.songs || !ctx.songs.length) return { units: [], gig: ctx.gig, setlist: ctx.setlist };
    var songs = ctx.songs;
    var units = [];
    for (var i = 0; i < songs.length - 1; i++) {
        if (songs[i]._segue === 'flow' || songs[i]._segue === 'segue') {
            units.push({
                type: 'linked',
                title: songs[i].title + ' → ' + songs[i+1].title,
                songs: [
                    { title: songs[i].title,   band: songs[i].band   || '' },
                    { title: songs[i+1].title, band: songs[i+1].band || '' }
                ],
                block: 'flow'
            });
        }
    }
    return { units: units, gig: ctx.gig, setlist: ctx.setlist };
}

// ── Intent handlers ──────────────────────────────────────────────────────────

window._rhIntentRunGig = async function() {
    var ctx = await _rhBuildUnitsFromUpcomingGigSetlist();
    if (!ctx.units.length) {
        if (typeof showToast === 'function') showToast('No upcoming gig with setlist');
        return;
    }
    if (_rhPlanCache && _rhPlanCache.units && _rhPlanCache.units.length) {
        await _rhSaveSnapshot('Before Run the Gig intent');
    }
    _rhPlanCache = _rhPlanCache || {};
    _rhPlanCache.intent = 'gig-run';
    _rhPlanCache.name = _rhDerivePlanName('gig-run', ctx);
    // Phase 3a: gig back-reference
    _rhPlanCache.gigId = (ctx.gig && ctx.gig.gigId) || null;
    _rhPlanCache.gigDate = (ctx.gig && ctx.gig.date) || null;
    _rhPlanCache.gigVenue = (ctx.gig && ctx.gig.venue) || null;
    _rhSaveUnits(ctx.units);
    if (typeof showToast === 'function') showToast('▶ Plan loaded with setlist (' + ctx.units.length + ' songs)');
    var el = document.querySelector('.app-page:not(.hidden)') || document.body;
    renderRehearsalPage(el);
};

window._rhIntentPracticeTransitions = async function() {
    var ctx = await _rhBuildUnitsFromGigLinkedPairs();
    if (!ctx.units.length) {
        if (typeof showToast === 'function') showToast(ctx.gig ? 'No linked transitions in this setlist' : 'No upcoming gig with setlist');
        return;
    }
    if (_rhPlanCache && _rhPlanCache.units && _rhPlanCache.units.length) {
        await _rhSaveSnapshot('Before Practice Transitions intent');
    }
    _rhPlanCache = _rhPlanCache || {};
    _rhPlanCache.intent = 'transitions';
    _rhPlanCache.name = _rhDerivePlanName('transitions', ctx);
    // Phase 3a: gig back-reference
    _rhPlanCache.gigId = (ctx.gig && ctx.gig.gigId) || null;
    _rhPlanCache.gigDate = (ctx.gig && ctx.gig.date) || null;
    _rhPlanCache.gigVenue = (ctx.gig && ctx.gig.venue) || null;
    _rhSaveUnits(ctx.units);
    if (typeof showToast === 'function') showToast('🔗 Plan loaded with ' + ctx.units.length + ' transition' + (ctx.units.length > 1 ? 's' : ''));
    var el = document.querySelector('.app-page:not(.hidden)') || document.body;
    renderRehearsalPage(el);
};

window._rhIntentWorkWeakSongs = async function() {
    var focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
    var list = (focus.list || []).slice(0, 8); // top 8 weak songs
    if (!list.length) {
        if (typeof showToast === 'function') showToast('No focus songs flagged right now');
        return;
    }
    if (_rhPlanCache && _rhPlanCache.units && _rhPlanCache.units.length) {
        await _rhSaveSnapshot('Before Work Weak Songs intent');
    }
    var units = list.map(function(s) {
        return { type: 'single', title: s.title, band: s.band || '', block: 'song-work' };
    });
    _rhPlanCache = _rhPlanCache || {};
    _rhPlanCache.intent = 'weak';
    _rhPlanCache.name = _rhDerivePlanName('weak', { count: list.length });
    // Phase 3a: weak-songs plans aren't gig-scoped — explicitly null so we
    // don't inherit a previous plan's gig back-ref.
    _rhPlanCache.gigId = null;
    _rhPlanCache.gigDate = null;
    _rhPlanCache.gigVenue = null;
    _rhSaveUnits(units);
    if (typeof showToast === 'function') showToast('🎯 Plan loaded with ' + list.length + ' focus song' + (list.length > 1 ? 's' : ''));
    var el = document.querySelector('.app-page:not(.hidden)') || document.body;
    renderRehearsalPage(el);
};

window._rhIntentBuildCustom = function() {
    // Reuse existing wizard / plan-mode entry. _rhOpenPlanMode seeds units
    // from focus if empty, which is the same default the wizard's Step 1
    // would offer. Drew can also click "Edit Structure" to enter the
    // multi-step wizard from inside Plan Mode. Stamp intent='custom' on
    // any plan that comes out of this path so the badge is accurate.
    if (_rhPlanCache && !_rhPlanCache.intent) _rhPlanCache.intent = 'custom';
    if (typeof _rhOpenPlanMode === 'function') return _rhOpenPlanMode();
};

window._rhIntentResumeLastPlan = function() {
    // Reuses existing _rhDuplicatePriorPlan which loads most recent snapshot
    // and prompts before overwriting. Keeps snapshot-system semantics intact.
    if (typeof _rhDuplicatePriorPlan === 'function') return _rhDuplicatePriorPlan();
};

window._rhIntentReviewLastRehearsal = async function() {
    if (typeof _rhLoadSessions !== 'function') return;
    var sessions = _rhSessionsCache || await _rhLoadSessions();
    if (!sessions || !sessions.length) {
        if (typeof showToast === 'function') showToast('No past rehearsals yet');
        return;
    }
    // Sessions are sorted newest-first by _rhLoadSessions.
    var latest = sessions[0];
    if (typeof _rhShowSessionReport === 'function') {
        _rhShowSessionReport(latest.sessionId);
    }
};

// ── Duplicate prior plan (load most recent snapshot into active plan) ─────────
window._rhDuplicatePriorPlan = async function() {
    var snaps = await _rhLoadSnapshots(5);
    if (!snaps.length) { if (typeof showToast === 'function') showToast('No prior plans to duplicate'); return; }
    var latest = snaps[0];
    if (!latest.units || !latest.units.length) { if (typeof showToast === 'function') showToast('Prior plan is empty'); return; }
    if (!confirm('Replace current plan with "' + (latest.name || 'Previous version') + '"?')) return;
    // Snapshot current plan first
    await _rhSaveSnapshot('Before duplicating prior plan');
    _rhSaveUnits(latest.units);
    if (typeof showToast === 'function') showToast('\u2705 Plan restored from ' + (latest.name || 'previous version'));
    var el = document.querySelector('.app-page:not(.hidden)') || document.body;
    renderRehearsalPage(el);
};

// ── Rehearsal plan snapshots ──────────────────────────────────────────────────

var _rhLastSnapshotTime = 0; // dedupe: no more than 1 snapshot per 2 min

async function _rhSaveSnapshot(nameOverride) {
    var units = _rhGetUnits();
    if (!units.length) return null;
    // Dedupe: skip if a snapshot was created within 2 minutes
    var now = Date.now();
    if (now - _rhLastSnapshotTime < 120000) {
        console.log('[RhSnap] Skipped — too recent (' + Math.round((now - _rhLastSnapshotTime) / 1000) + 's ago)');
        return null;
    }
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return null;
    var planName = (_rhPlanCache && _rhPlanCache.name) ? _rhPlanCache.name : 'Rehearsal Plan';
    var songCount = units.reduce(function(n, u) { return n + (u.type === 'linked' ? (u.songs || []).length : 1); }, 0);
    var snap = {
        snapshotId: 'rs_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        name: nameOverride || ('Previous version'),
        savedAt: new Date(now).toISOString(),
        savedBy: (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : '',
        units: units,
        songCount: songCount,
        sourcePlanName: planName
    };
    try {
        await db.ref(bandPath('rehearsal_history/' + snap.snapshotId)).set(snap);
        _rhLastSnapshotTime = now;
        // Auto-prune: keep only latest 5
        _rhPruneSnapshots(5);
        return snap;
    } catch(e) {
        console.warn('[RhSnap] Save failed:', e.message);
        return null;
    }
}

async function _rhPruneSnapshots(keepCount) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        var snap = await db.ref(bandPath('rehearsal_history')).once('value');
        var val = snap.val();
        if (!val) return;
        var all = Object.values(val).sort(function(a, b) { return (b.savedAt || '').localeCompare(a.savedAt || ''); });
        if (all.length <= keepCount) return;
        var toDelete = all.slice(keepCount);
        for (var i = 0; i < toDelete.length; i++) {
            await db.ref(bandPath('rehearsal_history/' + toDelete[i].snapshotId)).remove();
        }
    } catch(e) {}
}

async function _rhLoadSnapshots(limit) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    try {
        var snap = await db.ref(bandPath('rehearsal_history')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.values(val).sort(function(a, b) { return (b.savedAt || '').localeCompare(a.savedAt || ''); }).slice(0, limit || 5);
    } catch(e) { return []; }
}

window._rhSaveSnapshotUI = function() {
    var planName = (_rhPlanCache && _rhPlanCache.name) ? _rhPlanCache.name : 'Rehearsal Plan';
    var dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var name = prompt('Snapshot name:', planName + ' — ' + dateLabel);
    if (name === null) return;
    _rhSaveSnapshot(name.trim() || undefined).then(function() { _rhReRender(); });
};

window._rhPreviewSnapshot = function(snapshotId) {
    _rhLoadSnapshots(20).then(function(snaps) {
        var snap = snaps.find(function(s) { return s.snapshotId === snapshotId; });
        if (!snap || !snap.units) return;
        var songCount = snap.songCount || snap.units.length;
        var songs = [];
        snap.units.forEach(function(u) {
            if (u.type === 'linked' && u.songs) u.songs.forEach(function(s) { if (s.title) songs.push(s.title); });
            else if (u.title && u.type !== 'section' && u.type !== 'note' && u.type !== 'business' && u.type !== 'exercise' && u.type !== 'jam') songs.push(u.title);
        });
        // Current plan summary
        var currentUnits = _rhGetUnits();
        var currentSongCount = currentUnits.reduce(function(n, u) { return n + (u.type === 'linked' ? (u.songs || []).length : 1); }, 0);

        var existing = document.getElementById('rhPreviewModal');
        if (existing) existing.remove();
        var ov = document.createElement('div');
        ov.id = 'rhPreviewModal';
        ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
        var html = '<div style="max-width:400px;width:100%;background:#1e293b;border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,0.08);max-height:80vh;overflow-y:auto">';
        html += '<div style="font-size:1em;font-weight:800;color:#f1f5f9;margin-bottom:12px">Preview: ' + escHtml(snap.name || 'Plan version') + '</div>';
        html += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:10px">' + songCount + ' songs</div>';
        if (songs.length) {
            html += '<div style="margin-bottom:12px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;max-height:150px;overflow-y:auto">';
            songs.slice(0, 15).forEach(function(t, i) { html += '<div style="font-size:0.78em;color:var(--text);padding:2px 0">' + (i + 1) + '. ' + escHtml(t) + '</div>'; });
            if (songs.length > 15) html += '<div style="font-size:0.72em;color:var(--text-dim);padding:2px 0">+' + (songs.length - 15) + ' more</div>';
            html += '</div>';
        }
        html += '<div style="font-size:0.72em;color:#64748b;margin-bottom:16px">Current plan: ' + currentSongCount + ' songs. Loading this version will replace it.</div>';
        html += '<button onclick="document.getElementById(\'rhPreviewModal\').remove();window._rhDoRestore(\'' + snapshotId + '\')" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.92em;cursor:pointer;margin-bottom:6px">Replace Current Plan</button>';
        html += '<button onclick="document.getElementById(\'rhPreviewModal\').remove()" style="width:100%;padding:8px;border-radius:8px;border:none;background:none;color:#64748b;cursor:pointer;font-size:0.78em">Cancel</button>';
        html += '</div>';
        ov.innerHTML = html;
        ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
    });
};

window._rhRestoreSnapshot = function(snapshotId) {
    _rhLoadSnapshots(20).then(function(snaps) {
        var snap = snaps.find(function(s) { return s.snapshotId === snapshotId; });
        if (!snap || !snap.units) return;
        // Show confirmation modal
        var existing = document.getElementById('rhLoadConfirm');
        if (existing) existing.remove();
        var ov = document.createElement('div');
        ov.id = 'rhLoadConfirm';
        ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
        ov.innerHTML = '<div style="max-width:360px;width:100%;background:#1e293b;border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,0.08);text-align:center">'
            + '<div style="font-size:1em;font-weight:800;color:#f1f5f9;margin-bottom:8px">Load this plan?</div>'
            + '<div style="font-size:0.82em;color:#94a3b8;margin-bottom:6px">' + (snap.name || 'Saved plan') + '</div>'
            + '<div style="font-size:0.72em;color:#64748b;margin-bottom:16px">This will replace your current rehearsal plan.</div>'
            + '<button onclick="document.getElementById(\'rhLoadConfirm\').remove();window._rhDoRestore(\'' + snapshotId + '\')" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.92em;cursor:pointer;margin-bottom:6px">Load Plan</button>'
            + '<button onclick="document.getElementById(\'rhLoadConfirm\').remove()" style="width:100%;padding:8px;border-radius:8px;border:none;background:none;color:#64748b;cursor:pointer;font-size:0.78em">Cancel</button>'
            + '</div>';
        ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
    });
};

window._rhDoRestore = function(snapshotId) {
    _rhLoadSnapshots(20).then(function(snaps) {
        var snap = snaps.find(function(s) { return s.snapshotId === snapshotId; });
        if (!snap || !snap.units) return;
        _rhPlanCache = _rhPlanCache || {};
        _rhPlanCache.units = snap.units;
        _rhPlanCache.name = snap.sourcePlanName || snap.name || 'Restored Plan';
        _rhSaveUnits(snap.units);
        _rhReRender();
        if (typeof showToast === 'function') showToast('Plan loaded');
    });
};

window._rhDeleteSnapshot = function(snapshotId) {
    if (!confirm('Delete this snapshot?')) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    db.ref(bandPath('rehearsal_history/' + snapshotId)).remove().then(function() {
        _rhReRender();
    });
};

// _rhRenderSessionReview removed — unified into _rhRenderSessionHistory with "LATEST" highlight

var _rhBulkMode = false;
var _rhBulkSelected = {};
var _rhSessionsCache = null;

async function _rhLoadSessions() {
    // C2 Phase 1: prefer GLStore.RehearsalSession.loadAll (same shape +
    // sort). Cached-shell legacy fallback for stale SW shells.
    var _rsLoadAll = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadAll);
    if (_rsLoadAll) {
        _rhSessionsCache = await GLStore.RehearsalSession.loadAll();
        return _rhSessionsCache;
    }
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    try {
        var snap = await db.ref(bandPath('rehearsal_sessions')).once('value');
        var val = snap.val();
        if (!val) return [];
        _rhSessionsCache = Object.keys(val).map(function(k) { var s = val[k]; s.sessionId = s.sessionId || k; return s; });
        _rhSessionsCache.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
        return _rhSessionsCache;
    } catch(e) { return []; }
}

async function _rhDeleteSession(sessionId) {
    // C2 Phase 1: route through RehearsalSession.remove.
    var _rsRemove = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.remove);
    if (_rsRemove) {
        await GLStore.RehearsalSession.remove(sessionId);
    } else {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return;
        try { await db.ref(bandPath('rehearsal_sessions/' + sessionId)).remove(); } catch(e) {}
    }
    _rhSessionsCache = null;
}

window._rhDeleteSessionUI = async function(sessionId) {
    if (!confirm('Delete this rehearsal session?')) return;
    await _rhDeleteSession(sessionId);
    if (typeof showToast === 'function') showToast('Session deleted');
    _rhRenderSessionHistory();
    // Also refresh the timeline — deleted session may have been the one displayed
    _rhRenderLastRehearsalTimeline();
};

window._rhToggleBulkMode = function() {
    _rhBulkMode = !_rhBulkMode;
    _rhBulkSelected = {};
    _rhRenderSessionHistory();
};

window._rhBulkToggle = function(sessionId) {
    if (_rhBulkSelected[sessionId]) delete _rhBulkSelected[sessionId];
    else _rhBulkSelected[sessionId] = true;
    var cb = document.getElementById('rhBulkCb_' + sessionId);
    if (cb) cb.checked = !!_rhBulkSelected[sessionId];
    var countEl = document.getElementById('rhBulkCount');
    if (countEl) countEl.textContent = Object.keys(_rhBulkSelected).length + ' selected';
};

window._rhBulkDelete = async function() {
    var ids = Object.keys(_rhBulkSelected);
    if (!ids.length) { if (typeof showToast === 'function') showToast('Nothing selected'); return; }
    if (!confirm('Delete ' + ids.length + ' session' + (ids.length > 1 ? 's' : '') + '? This cannot be undone.')) return;
    for (var i = 0; i < ids.length; i++) await _rhDeleteSession(ids[i]);
    if (typeof showToast === 'function') showToast(ids.length + ' session' + (ids.length > 1 ? 's' : '') + ' deleted');
    _rhBulkMode = false;
    _rhBulkSelected = {};
    _rhRenderSessionHistory();
    _rhRenderLastRehearsalTimeline();
};

// ── Practice Tasks panel (Workbench prelude) ────────────────────────────────
// Reads bands/{slug}/practice_tasks/* (created by _mtPromoteCommentToTask
// in multitrack-rehearsal.js). Shows only OPEN tasks; resolved tasks are
// surfaced via a count badge for affordance ("3 done in last 7 days") but
// don't clutter the list. Click a task → opens song detail with a context
// banner (full Workbench launch comes when Workbench shell ships).
async function _rhLoadPracticeTasks() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    try {
        var snap = await db.ref(bandPath('practice_tasks')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.values(val).sort(function(a, b) {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
    } catch (e) {
        console.warn('[Rehearsal] load practice tasks failed:', e.message);
        return [];
    }
}

async function _rhRenderPracticeTasks() {
    var el = document.getElementById('rhPracticeTasks');
    var badge = document.getElementById('rhTasksCountBadge');
    if (!el) return;
    var tasks = await _rhLoadPracticeTasks();
    var open = tasks.filter(function(t) { return t.status === 'open' || t.status === 'in-progress'; });
    var resolved = tasks.filter(function(t) { return t.status === 'resolved'; });
    if (badge) badge.textContent = open.length ? open.length + ' open' : '';

    if (!open.length) {
        el.innerHTML = '<div style="font-size:0.7em;color:var(--gl-text-tertiary);font-style:italic;padding:4px 0">'
            + 'No open tasks. Create one from a comment in any multitrack rehearsal review.'
            + '</div>'
            + (resolved.length ? '<div style="margin-top:4px;font-size:0.62em;color:var(--gl-text-tertiary)">' + resolved.length + ' resolved</div>' : '');
        return;
    }

    var bandMembersMap = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var rowsHtml = open.map(function(t) {
        var mName = t.memberKey ? (bandMembersMap[t.memberKey] ? bandMembersMap[t.memberKey].name.split(' ')[0] : t.memberKey) : '';
        var meta = [];
        if (t.songTitle) meta.push(t.songTitle);
        if (mName) meta.push(mName);
        if (typeof t.timestampSec === 'number') {
            var m = Math.floor(t.timestampSec / 60);
            var s = Math.floor(t.timestampSec - m * 60);
            meta.push(m + ':' + (s < 10 ? '0' : '') + s);
        }
        var tagsHtml = (t.tags && t.tags.length)
            ? t.tags.map(function(tag) { return '<span style="padding:0 4px;border-radius:6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;font-size:0.58em;font-weight:600">' + escHtml(tag) + '</span>'; }).join(' ')
            : '';
        return '<div style="display:grid;grid-template-columns:auto 1fr auto;gap:6px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.72em;align-items:start">'
            + '<input type="checkbox" onchange="_rhResolvePracticeTask(\'' + escHtml(t.taskId) + '\')" title="Mark resolved" style="margin-top:3px;accent-color:#22c55e;cursor:pointer">'
            + '<div style="min-width:0;cursor:pointer" onclick="_rhOpenPracticeTask(\'' + escHtml(t.taskId) + '\')" title="Open this song to practice">'
                + '<div style="color:var(--text);font-weight:600;line-height:1.3;word-wrap:break-word">' + escHtml(t.noteText || '(no note)') + '</div>'
                + '<div style="font-size:0.85em;color:var(--gl-text-tertiary);margin-top:2px">' + escHtml(meta.join(' · ')) + '</div>'
                + (tagsHtml ? '<div style="margin-top:3px;display:flex;gap:3px;flex-wrap:wrap">' + tagsHtml + '</div>' : '')
            + '</div>'
            + '<button onclick="_rhDeletePracticeTask(\'' + escHtml(t.taskId) + '\')" title="Delete task" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.85em;padding:0;align-self:start;margin-top:2px">×</button>'
            + '</div>';
    }).join('');
    el.innerHTML = rowsHtml + (resolved.length
        ? '<div style="margin-top:6px;font-size:0.62em;color:var(--gl-text-tertiary);text-align:center;font-style:italic">' + resolved.length + ' resolved</div>'
        : '');
}

window._rhResolvePracticeTask = async function(taskId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        await db.ref(bandPath('practice_tasks/' + taskId)).update({
            status: 'resolved',
            updatedAt: new Date().toISOString()
        });
        if (typeof showToast === 'function') showToast('✅ Task resolved');
        _rhRenderPracticeTasks();
    } catch (e) {
        if (typeof showToast === 'function') showToast('Resolve failed');
    }
};

window._rhDeletePracticeTask = async function(taskId) {
    if (!confirm('Delete this practice task?')) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        await db.ref(bandPath('practice_tasks/' + taskId)).remove();
        _rhRenderPracticeTasks();
    } catch (e) {}
};

// Open a practice task → routes through the new Workbench shell so the
// loop window + task highlight + "From last rehearsal" badge land in
// one coherent surface. Falls back to the old selectSong path if the
// Workbench script hasn't loaded yet (defensive — not expected in
// normal nav flow since `js/features/workbench.js` is lazy-loaded by
// the page system).
window._rhOpenPracticeTask = async function(taskId) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var snap = null;
    try { snap = await db.ref(bandPath('practice_tasks/' + taskId)).once('value'); } catch (e) {}
    var task = snap && snap.val();
    if (!task) {
        if (typeof showToast === 'function') showToast('Task not found');
        return;
    }
    var songId = task.songId || task.songTitle;
    if (!songId) {
        if (typeof showToast === 'function') showToast('Task has no song');
        return;
    }
    // Stash for any non-Workbench surfaces that still read this (legacy).
    // Workbench will overwrite it via _wbApplyTaskContext once it mounts.
    window._rhActivePracticeTask = task;
    if (typeof openWorkbench === 'function') {
        openWorkbench(songId, 'practice', { taskId: taskId });
    } else if (typeof selectSong === 'function' && task.songTitle) {
        // Fallback if workbench.js wasn't lazy-loaded yet.
        try { selectSong(task.songTitle); } catch (e) {}
    }
    if (typeof showToast === 'function') {
        var ts = (typeof task.timestampSec === 'number')
            ? ' at ' + Math.floor(task.timestampSec / 60) + ':' + (Math.floor(task.timestampSec % 60) < 10 ? '0' : '') + Math.floor(task.timestampSec % 60)
            : '';
        showToast('🎯 Opened: ' + (task.songTitle || 'song') + ts);
    }
};

async function _rhRenderSessionHistory() {
    var el = document.getElementById('rhSessionHistory');
    if (!el) return;
    var sessions = await _rhLoadSessions();

    // Filter: hide noisy micro-sessions (< 2 min, 0 blocks, or missing data).
    // Phase A multitrack: pass through any session with type==='multitrack'
    // even though it lacks blocks/duration — those fields are populated by
    // the segmentation engine on single-file sessions only.
    var clean = sessions.filter(function(s) {
        if (!s.date) return false;
        if (s.type === 'multitrack' && s.tracks && s.tracks.length) return true;
        if ((s.totalActualMin || 0) < 2 && (s.blocksCompleted || 0) === 0) return false;
        return true;
    });

    if (!clean.length) { el.innerHTML = ''; return; }

    var html = '<div style="margin-bottom:12px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:0.72em;font-weight:800;letter-spacing:0.08em;color:var(--text-dim);text-transform:uppercase">\uD83D\uDCCB Past Rehearsals (' + clean.length + ')</div>';
    html += '<div style="display:flex;gap:6px">';
    html += '<button onclick="_rhToggleBulkMode()" style="font-size:0.65em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid ' + (_rhBulkMode ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (_rhBulkMode ? 'rgba(239,68,68,0.1)' : 'none') + ';color:' + (_rhBulkMode ? '#f87171' : '#475569') + '">' + (_rhBulkMode ? '\u2715 Cancel' : '\u2611 Select') + '</button>';
    html += '</div></div>';

    // ── Trend Indicator ──
    var last5 = clean.slice(0, 5);
    if (last5.length >= 2) {
        var ratingIcons = { great: '\uD83D\uDD25', solid: '\uD83D\uDCAA', needs_work: '\uD83D\uDD27' };
        var ratingValues = { great: 3, solid: 2, needs_work: 1 };
        var dots = last5.map(function(s) { return ratingIcons[s.rating] || '\u25CB'; }).reverse().join(' ');
        var rated = last5.filter(function(s) { return s.rating; });
        var trend = '', trendColor = '', trendIcon = '';
        if (rated.length >= 2) {
            var recent = rated.slice(0, Math.ceil(rated.length / 2));
            var older = rated.slice(Math.ceil(rated.length / 2));
            var avgRecent = recent.reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / recent.length;
            var avgOlder = older.reduce(function(s, r) { return s + (ratingValues[r.rating] || 0); }, 0) / older.length;
            if (avgRecent > avgOlder + 0.3) { trend = 'Improving'; trendColor = '#22c55e'; trendIcon = '\u2191'; }
            else if (avgRecent < avgOlder - 0.3) { trend = 'Needs attention'; trendColor = '#fbbf24'; trendIcon = '\u2193'; }
            else { trend = 'Steady'; trendColor = '#94a3b8'; trendIcon = '\u2192'; }
        }
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px" title="Recent rehearsal trend \u2014 last ' + last5.length + ' sessions (oldest \u2192 newest). \uD83D\uDD25 = Great, \uD83D\uDCAA = Solid, \uD83D\uDD27 = Needs work, \u25CB = Not rated">';
        html += '<div style="font-size:0.65em;color:var(--text-dim);font-weight:600;white-space:nowrap">Trend</div>';
        html += '<div style="font-size:0.85em;letter-spacing:2px">' + dots + '</div>';
        if (trend) html += '<div style="font-size:0.72em;font-weight:700;color:' + trendColor + ';margin-left:auto">' + trendIcon + ' ' + trend + '</div>';
        html += '</div>';
    }

    if (_rhBulkMode) {
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px">'
            + '<span id="rhBulkCount" style="font-size:0.72em;font-weight:600;color:#f87171">0 selected</span>'
            + '<button onclick="_rhBulkDelete()" style="margin-left:auto;font-size:0.72em;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);color:#f87171">\uD83D\uDDD1 Delete Selected</button>'
            + '</div>';
    }

    clean.forEach(function(s, _si) {
        var isLatest = _si === 0;
        // Anchor at LOCAL noon so timezone shifts don't bump the displayed
        // date back a day. Some sessions store date as YYYY-MM-DD (multitrack)
        // and others as a full ISO string with time (legacy single-file).
        // Take the first 10 chars to normalize, then append T12:00:00.
        var d = s.date ? new Date(String(s.date).slice(0, 10) + 'T12:00:00') : null;
        var dateStr = (d && !isNaN(d.getTime())) ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        var totalActual = s.totalActualMin || 0;

        // Phase A multitrack: distinct compact card. Doesn't have a
        // segmentation-engine timeline so we surface tracks count + Open
        // button instead of the standard duration/headline/scorecard layout.
        if (s.type === 'multitrack') {
            var trackCount = (s.tracks && s.tracks.length) || 0;
            // ⭐ Keeper sessions get a brighter gold accent + sit at the top
            // visually so they're hard to miss when reviewing.
            var keeperAccent = s.keeper ? ';box-shadow:0 0 0 1px rgba(251,191,36,0.5),0 0 12px rgba(251,191,36,0.15);background:rgba(251,191,36,0.06)' : '';
            html += '<div class="app-card" style="padding:8px 12px;margin-bottom:5px;display:flex;align-items:center;gap:8px' + (isLatest ? ';border-left:3px solid #fbbf24;background:rgba(245,158,11,0.04)' : '') + keeperAccent + '">'
                + (_rhBulkMode ? '<input type="checkbox" id="rhBulkCb_' + s.sessionId + '" onchange="_rhBulkToggle(\'' + s.sessionId + '\')"' + (_rhBulkSelected[s.sessionId] ? ' checked' : '') + ' style="accent-color:#ef4444;width:14px;height:14px;cursor:pointer;flex-shrink:0">' : '')
                + '<div style="flex:1;min-width:0">'
                // Top line: 🎚 emoji + date + track count + (optional) ⭐
                // Keeper marker. The 🎚 emoji + yellow card border signal
                // "multitrack"; the ⭐ marker signals "keeper — stems
                // retained forever." Visible at a glance in history scroll.
                + '<div style="display:flex;align-items:center;gap:6px">'
                + '<span style="font-size:0.78em">🎚</span>'
                + '<span style="font-weight:700;font-size:0.82em;color:var(--text)">' + dateStr + '</span>'
                + '<span style="font-size:0.72em;color:var(--text-muted)">· ' + trackCount + ' tracks</span>'
                + (s.keeper ? '<span title="Keeper — stems retained forever" style="font-size:0.74em;color:#fbbf24">⭐</span>' : '')
                + '</div>'
                // Bottom line: venue, with strict single-line ellipsis so a
                // long string can\'t break the card layout (the previous
                // multitrack card had the venue text wrapping into the Open
                // button position — visual jumble).
                + (s.venue
                    ? '<div style="font-size:0.7em;color:var(--text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(s.venue) + '">📍 ' + escHtml(s.venue) + '</div>'
                    : '')
                + '</div>'
                + '<button onclick="_mtOpenPlayer(\'' + s.sessionId + '\')" style="font-size:0.65em;font-weight:600;padding:3px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);color:#fbbf24;white-space:nowrap;flex-shrink:0">▶ Open</button>'
                + (_rhBulkMode ? '' : '<button onclick="_rhDeleteSessionUI(\'' + s.sessionId + '\')" style="font-size:0.6em;padding:3px 6px;border-radius:4px;cursor:pointer;border:1px solid rgba(239,68,68,0.12);background:none;color:#64748b;flex-shrink:0">🗑️</button>')
                + '</div>';
            return; // skip standard card for multitrack
        }

        // Duration label
        var durLabel = '';
        if (totalActual >= 60) durLabel = Math.floor(totalActual / 60) + 'h ' + (totalActual % 60) + 'm';
        else durLabel = totalActual + ' min';

        // Rating badge
        var ratingIcons = { great: '\uD83D\uDD25', solid: '\uD83D\uDCAA', needs_work: '\uD83D\uDD27' };
        var ratingHtml = s.rating ? ' ' + (ratingIcons[s.rating] || '') : '';

        html += '<div class="app-card" style="padding:8px 12px;margin-bottom:5px;display:flex;align-items:center;gap:8px' + (isLatest ? ';border-left:3px solid #a5b4fc;background:rgba(99,102,241,0.04)' : '') + '">';

        // Bulk checkbox
        if (_rhBulkMode) {
            html += '<input type="checkbox" id="rhBulkCb_' + s.sessionId + '" onchange="_rhBulkToggle(\'' + s.sessionId + '\')"' + (_rhBulkSelected[s.sessionId] ? ' checked' : '') + ' style="accent-color:#ef4444;width:14px;height:14px;cursor:pointer;flex-shrink:0">';
        }

        // Date + duration + 1 key insight
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="display:flex;align-items:center;gap:6px">';
        html += '<span style="font-weight:700;font-size:0.82em;color:var(--text)">' + dateStr + '</span>';
        html += '<span style="font-size:0.72em;color:var(--text-muted)">' + durLabel + ratingHtml + '</span>';
        if (isLatest) html += '<span style="font-size:0.58em;font-weight:800;color:#a5b4fc;letter-spacing:0.05em;text-transform:uppercase">LATEST</span>';
        html += '</div>';
        // One key insight line
        var headline = _rhGetHeadline(s, _si, clean);
        if (headline) {
            html += '<div style="font-size:0.7em;font-weight:600;color:' + headline.color + ';margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + headline.icon + ' ' + headline.text + '</div>';
        }
        // Scorecard summary for latest session (inline, compact)
        if (isLatest && typeof RehearsalScorecardEngine !== 'undefined') {
            var _sc = RehearsalScorecardEngine.generateScorecard(s);
            if (_sc && _sc.score > 0) {
                var _scColor = _sc.score >= 85 ? '#22c55e' : _sc.score >= 65 ? '#84cc16' : _sc.score >= 40 ? '#f59e0b' : '#ef4444';
                html += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">';
                html += '<span style="font-size:1.1em;font-weight:800;color:' + _scColor + '">' + _sc.score + '</span>';
                html += '<span style="font-size:0.65em;color:var(--text-dim)">' + _sc.label + '</span>';
                if (_sc.highlights && _sc.highlights.biggestWin) {
                    html += '<span style="font-size:0.6em;color:var(--text-dim);margin-left:auto;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\u2705 ' + _sc.highlights.biggestWin + '</span>';
                }
                html += '</div>';
                // Top 2 action items
                if (_sc.recommendations && _sc.recommendations.length) {
                    _sc.recommendations.slice(0, 2).forEach(function(rec) {
                        html += '<div style="font-size:0.6em;color:var(--text-dim);padding:1px 8px">\u2192 ' + (rec.text || rec) + '</div>';
                    });
                }
            }
        }
        html += '</div>';

        // Actions — compact
        html += '<button onclick="_rhShowSessionReport(\'' + s.sessionId + '\')" style="font-size:0.65em;font-weight:600;padding:3px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.04);color:#a5b4fc;white-space:nowrap;flex-shrink:0">\u25B6 Timeline</button>';
        if (!_rhBulkMode) {
            html += '<button onclick="_rhDeleteSessionUI(\'' + s.sessionId + '\')" style="font-size:0.6em;padding:3px 6px;border-radius:4px;cursor:pointer;border:1px solid rgba(239,68,68,0.12);background:none;color:#64748b;flex-shrink:0">\uD83D\uDDD1\uFE0F</button>';
        }

        html += '</div>';

        // Inline mixdown player area (hidden until toggled)
        if (s.mixdown_id) {
            html += '<div id="rhMixdownPlayer_' + s.sessionId + '" style="display:none;margin-top:4px;padding:8px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.15);border-radius:8px"></div>';
        }
    });

    html += '</div>';
    el.innerHTML = html;
}

// ── Session Report Modal ─────────────────────────────────────────────────────
window._rhRerunAnalysis = function(sessionId) {
    if (typeof RehearsalAnalysis === 'undefined') return;
    if (typeof showToast === 'function') showToast('Analyzing rehearsal...');
    RehearsalAnalysis.run(sessionId, { force: true }).then(function(result) {
        if (result.status === 'complete') {
            if (typeof showToast === 'function') showToast('\u2705 Analysis updated');
            // Re-render inline timeline with fresh data
            setTimeout(function() { _rhShowSessionReport(sessionId); }, 300);
        } else {
            if (typeof showToast === 'function') showToast('Analysis returned: ' + result.status);
        }
    }).catch(function(e) {
        console.warn('[Rehearsal] Re-analysis failed:', e);
        if (typeof showToast === 'function') showToast('Analysis failed');
    });
};

// ── Last Rehearsal Snapshot + Auto-loaded Timeline ───────────────────────────
async function _rhRenderLastRehearsalTimeline() {
    var snapEl = document.getElementById('rhLastRehearsalSnapshot');
    var timelineEl = document.getElementById('rhTimelineSection');
    if (!snapEl || !timelineEl) return;

    // Load sessions to find the most recent
    var sessions = await _rhLoadSessions();
    if (!sessions || !sessions.length) {
        // Empty state — no rehearsals yet
        timelineEl.innerHTML = '<div style="padding:28px 20px;text-align:center;border-radius:12px;border:1px dashed rgba(99,102,241,0.2);background:rgba(99,102,241,0.02);margin:8px 0">'
            + '<div style="font-size:1.4em;margin-bottom:10px">\uD83C\uDFA4</div>'
            + '<div style="font-size:0.92em;font-weight:700;color:var(--text);margin-bottom:6px">Your rehearsal timeline starts here</div>'
            + '<div style="font-size:0.75em;color:var(--text-dim);line-height:1.5;margin-bottom:6px;max-width:340px;margin-left:auto;margin-right:auto">Run a rehearsal, then load the recording. GrooveLinx will break it down song by song so you can hear what\u2019s tight and what needs work.</div>'
            + '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:14px">Most bands see something useful after the first session.</div>'
            + '<button onclick="_rhConfirmStartRehearsal()" style="padding:12px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:700;font-size:0.88em;cursor:pointer;min-height:44px">Start Your First Rehearsal</button>'
            + '</div>';
        return;
    }
    var latest = sessions[0]; // sorted by date desc
    if (!latest) return;

    var _toArr = function(v) { if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'object') return Object.values(v); return []; };
    var segments = _toArr(latest.audio_segments);
    // Anchor at local noon to avoid timezone shift bumping the displayed
    // date back a day. Tolerate both YYYY-MM-DD and full-ISO date strings
    // by slicing to the first 10 chars before appending T12:00:00.
    var _latestD = latest.date ? new Date(String(latest.date).slice(0, 10) + 'T12:00:00') : null;
    var dateStr = (_latestD && !isNaN(_latestD.getTime())) ? _latestD.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    var durMin = latest.totalActualMin || 0;
    var durLabel = durMin >= 60 ? Math.floor(durMin / 60) + 'h ' + (durMin % 60) + 'm' : durMin + 'm';

    // ── Snapshot card ──
    var songCount = 0;
    var talkCount = 0;
    if (segments.length) {
        var data = _rhPrepareSegmentData(latest, segments);
        songCount = data.songList.length;
        talkCount = data.talkSegs.length;
    } else {
        songCount = _toArr(latest.songsWorked).length || _toArr(latest.blocks).length;
    }

    // Snapshot: compact summary line, details collapse
    var _snapSummary = dateStr + ' \u00B7 ' + durLabel + (songCount ? ' \u00B7 ' + songCount + ' songs' : '');
    var snapHtml = '<details style="border-radius:10px;background:rgba(255,255,255,0.015);margin-bottom:4px">';
    snapHtml += '<summary style="padding:8px 14px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;font-size:0.75em;color:var(--gl-text-secondary)">';
    snapHtml += '<span style="font-weight:600;color:var(--gl-text-tertiary)">Last rehearsal</span>';
    snapHtml += '<span style="opacity:0.7">' + _snapSummary + '</span>';
    snapHtml += '<span style="font-size:0.85em;color:var(--gl-text-tertiary);margin-left:auto">\u25B8</span>';
    snapHtml += '</summary><div style="padding:4px 14px 10px">';
    snapHtml += '<div style="display:flex;gap:12px;font-size:0.75em;color:var(--text-dim);margin-bottom:4px">';
    if (talkCount) snapHtml += '<span>' + talkCount + ' conversations</span>';
    snapHtml += '</div>';

    // Key insights (top 2)
    if (segments.length) {
        var data2 = _rhPrepareSegmentData(latest, segments);
        // Show headline from session if available
        if (latest.analysis && latest.analysis.story && latest.analysis.story.headline) {
            snapHtml += '<div style="font-size:0.72em;color:#fbbf24;font-weight:600;margin-top:6px">\u26A0 ' + escHtml(latest.analysis.story.headline) + '</div>';
        }
        // Top 2 recommendations
        data2.recommendations.slice(0, 2).forEach(function(r) {
            snapHtml += '<div style="font-size:0.68em;color:var(--text-dim);margin-top:2px">\u2022 ' + escHtml(r.text) + '</div>';
        });
        // CTA
        snapHtml += '<div style="margin-top:8px"><button onclick="var t=document.getElementById(\'rhTimelineSection\');if(t)t.scrollIntoView({behavior:\'smooth\'})" style="font-size:0.72em;padding:6px 14px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#818cf8;cursor:pointer;min-height:32px">\u25B6 Review Timeline</button></div>';
    } else {
        snapHtml += '<div style="margin-top:8px"><button onclick="if(typeof RecordingAnalyzer!==\'undefined\')RecordingAnalyzer.launchForSession(\'' + escHtml(latest.sessionId) + '\')" style="font-size:0.72em;padding:4px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#818cf8;cursor:pointer">\uD83D\uDD0D Analyze Recording</button></div>';
    }
    snapHtml += '</div></details>';
    snapEl.innerHTML = snapHtml;

    // ── Auto-render timeline for latest session (if segments exist) ──
    if (segments.length) {
        // Preload previous groove fingerprints for cross-session comparison
        await _rhPreloadFingerprints();
        _rhRenderInlineTimelineDirectly(timelineEl, latest.sessionId, latest, segments);

        // Bug 2026-05-18 (Drew): _rhShowSessionReport calls both
        // _rhRenderTonightProgress and _rhRenderTakeReview after the segments
        // (see line 4543-4544). The home page's _rhRenderLastRehearsalTimeline
        // historically only rendered segments — so canonical Takes never
        // appeared at the bottom even though they exist in Firebase. Mirror
        // the session-detail flow so Take Review is consistent everywhere.
        try { _rhRenderTonightProgress(timelineEl, latest.sessionId, latest); } catch (e) { console.warn('[TonightProgress] render failed:', e && e.message); }
        try { _rhRenderTakeReview(timelineEl, latest.sessionId, latest); } catch (e) { console.warn('[TakeReview] render failed:', e && e.message); }
    }
}

// Render timeline directly into a container (not toggled via session card)
function _rhRenderInlineTimelineDirectly(container, sessionId, session, segments) {
    var data = _rhPrepareSegmentData(session, segments);
    // Store in GLStore for inline compare and other consumers (no window globals)
    if (typeof GLStore !== 'undefined' && GLStore.setCurrentTimeline) {
        GLStore.setCurrentTimeline(sessionId, data);
    }
    var hasAudio = _rhHasAudio();
    var playBtnStyle = hasAudio
        ? 'background:none;border:none;color:#818cf8;cursor:pointer;font-size:0.85em'
        : 'background:none;border:none;color:#334155;cursor:default;font-size:0.85em';

    // Inject timeline styles (once)
    if (!document.getElementById('rh-timeline-styles')) {
        var _ts = document.createElement('style');
        _ts.id = 'rh-timeline-styles';
        _ts.textContent = '.rh-seg-row{transition:background 0.15s,box-shadow 0.15s;position:relative}'
            + '.rh-seg-row:hover{background:rgba(255,255,255,0.03)!important}'
            + '.rh-seg-row.rh-playing{background:rgba(99,102,241,0.06)!important;box-shadow:inset 3px 0 0 #667eea}'
            + '.rh-seg-row summary:hover{background:rgba(255,255,255,0.02)}'
            + '.rh-seg-row .rh-hover-actions{opacity:0;transition:opacity 0.15s;position:absolute;right:8px;top:6px}'
            + '.rh-seg-row:hover .rh-hover-actions{opacity:1}'
            + '.rh-strip-seg{cursor:pointer;transition:opacity 0.15s}'
            + '.rh-strip-seg:hover{opacity:0.7}'
            + '@keyframes rhPulsePlay{0%,100%{opacity:1}50%{opacity:0.5}}'
            + '.rh-playing-btn{animation:rhPulsePlay 1.5s ease infinite}'
            + '.rh-groove-strong{border-left-color:#10b981!important}'
            + '.rh-groove-unstable{border-left-color:#f59e0b!important}'
            + '.rh-groove-incomplete{border-left-color:#64748b!important}'
            + '@keyframes rhFocusFlash{0%{box-shadow:0 0 0 3px rgba(251,191,36,0.5)}50%{box-shadow:0 0 0 6px rgba(251,191,36,0.15)}100%{box-shadow:none}}'
            + '.rh-focus-flash{animation:rhFocusFlash 1.5s cubic-bezier(0.4,0,0.2,1)}'
            + '@keyframes rhJumpIn{0%{background:rgba(99,102,241,0.15)}100%{background:transparent}}'
            + '.rh-seg-row.rh-jump-highlight{animation:rhJumpIn 1s cubic-bezier(0.4,0,0.2,1)}'
            + '.rh-seg-row summary:active{transform:scale(0.995);transition:transform 0.1s}'
            + '.rh-compare-best{border-left-color:#10b981!important;background:rgba(16,185,129,0.04)!important}'
            + '.rh-fix-mode{border:1px solid rgba(245,158,11,0.3)!important;background:rgba(245,158,11,0.04)!important}'
            + '.rh-active-focus{box-shadow:0 0 0 2px rgba(245,158,11,0.3)!important}'
            + '.rh-active-focus::after{content:"WORKING ON THIS";position:absolute;top:4px;right:8px;font-size:0.5em;font-weight:800;color:#fbbf24;letter-spacing:0.05em;opacity:0.7}'
            + '@keyframes rhZonePulse{0%{opacity:0.3}50%{opacity:0.8}100%{opacity:0.3}}'
            + '.rh-zone-pulse{animation:rhZonePulse 1.5s ease-in-out 1}';
        document.head.appendChild(_ts);
    }

    var html = '';
    // Subheading only shown when rendered inside a session report (not on main page where the section heading exists)
    if (!document.querySelector('#rhTimelineSection')) {
        html += '<div style="font-size:0.72em;font-weight:800;letter-spacing:0.06em;color:var(--text-dim);text-transform:uppercase;margin-bottom:4px">Latest Rehearsal Review</div>';
    }
    // Description text rendered by page-level heading — not duplicated here

    // Audio state — prompt to load recording for playback
    if (!hasAudio) {
        html += '<div style="padding:8px 12px;margin-bottom:8px;border-radius:8px;border:1px solid rgba(245,158,11,0.12);background:rgba(245,158,11,0.03);font-size:0.72em;color:#fbbf24;display:flex;align-items:center;justify-content:space-between;gap:8px">'
            + '<span>Load your recording to listen back</span>'
            + '<button onclick="_rhLoadRecordingForPlayback(\'' + escHtml(sessionId) + '\')" style="font-size:0.88em;padding:4px 12px;border-radius:6px;border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.06);color:#fbbf24;cursor:pointer;font-family:inherit;white-space:nowrap">Load Audio</button>'
            + '</div>';
    }

    // Visual strip (clickable mini-map)
    var totalDur = segments[segments.length - 1] ? (segments[segments.length - 1].endSec || 1) : 1;
    html += '<div id="rhTimelineStrip" style="display:flex;height:10px;border-radius:4px;overflow:hidden;margin-bottom:10px;background:rgba(255,255,255,0.03);cursor:pointer">';
    segments.forEach(function(seg, si) {
        var pct = ((seg.duration || 0) / totalDur * 100).toFixed(1);
        var color = (!seg.segType || seg.segType === 'song') ? '#667eea' : (seg.segType === 'talking' ? '#a5b4fc' : (seg.segType === 'jam' ? '#f59e0b' : '#334155'));
        if (seg.segType === 'ignore') return;
        html += '<div class="rh-strip-seg" onclick="var el=document.getElementById(\'rhSeg_' + si + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});el.classList.add(\'rh-jump-highlight\');setTimeout(function(){el.classList.remove(\'rh-jump-highlight\')},800);if(el.dataset&&el.dataset.expanded==\'false\'&&window._rhToggleSeg)window._rhToggleSeg(' + si + ')}" style="width:' + pct + '%;background:' + color + ';min-width:2px" title="' + escHtml(seg.songTitle || seg.segType || '') + ' (' + _rhFmt(seg.startSec) + ')"></div>';
    });
    html += '</div>';

    // Segment list — interactive, expandable
    segments.forEach(function(seg, si) {
        if (seg.segType === 'ignore') return;
        var isSong = !seg.segType || seg.segType === 'song';
        var isTalk = seg.segType === 'talking';
        var isJam = seg.segType === 'jam';
        var durLabel2 = seg.duration >= 60 ? Math.round(seg.duration / 60) + 'm' : Math.round(seg.duration) + 's';

        if (isSong) {
            // Song segment — expandable, groove-coded border
            var grooveClass = '';
            if (seg.groove) {
                grooveClass = seg.groove.stability >= 80 ? ' rh-groove-strong' : (seg.groove.stability >= 50 ? ' rh-groove-unstable' : ' rh-groove-incomplete');
            } else if (seg.qualityScore < 2) {
                grooveClass = ' rh-groove-incomplete';
            }
            // Bug 2026-05-17 (a11y): converted from <details>/<summary> to a
            // <div> with click-to-toggle so the row's play / loop / practice
            // <button>s aren't nested inside <summary> (Chrome's a11y panel
            // flagged 32 of these \u2014 interactive elements inside <summary>
            // don't get reliable keyboard / screen-reader behavior because
            // <summary> itself owns the toggle key events).
            html += '<div id="rhSeg_' + si + '" class="rh-seg-row' + grooveClass + '" data-song="' + escHtml(seg.songTitle || '') + '" data-expanded="false" style="margin-bottom:5px;border-radius:7px;border-left:3px solid rgba(99,102,241,0.12);background:rgba(255,255,255,0.015)">';
            html += '<div class="rh-seg-header" style="padding:7px 10px;display:flex;align-items:center;gap:8px">';
            html += '<button id="rhPlayBtn_' + si + '" onclick="_rhPlaySegment(' + seg.startSec + ',' + seg.endSec + ',\'' + escHtml(sessionId) + '\',' + si + ')" style="' + playBtnStyle + '"' + (hasAudio ? '' : ' disabled') + '>\u25B6</button>';
            // Song name (primary) + metadata (secondary line). The title block
            // is the click-to-expand target; play / loop / practice buttons
            // are siblings, so they don't accidentally toggle the row.
            html += '<div onclick="window._rhToggleSeg(' + si + ')" role="button" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window._rhToggleSeg(' + si + ');}" aria-expanded="false" aria-controls="rhSegBody_' + si + '" style="flex:1;min-width:0;cursor:pointer">';
            var _titleConf = seg.songMatch ? seg.songMatch.confidence : null;
            var _confDot = _titleConf === 'low' ? '<span style="color:#64748b;font-size:0.7em" title="Uncertain match"> ?</span>' : (_titleConf === 'medium' ? '<span style="color:#f59e0b;font-size:0.7em" title="Likely match"> \u00B7</span>' : '');
            html += '<div style="font-size:0.8em;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(seg.songTitle || 'Unknown') + _confDot + '</div>';
            html += '<div style="font-size:0.58em;color:var(--text-dim)">' + _rhFmt(seg.startSec) + '\u2013' + _rhFmt(seg.endSec) + ' \u00B7 ' + durLabel2;
            if (seg.qualityLabel && (seg.qualityScore >= 3 || seg.groove)) html += ' \u00B7 <span style="color:' + (seg.qualityScore >= 3 ? '#10b981' : '#f59e0b') + '">' + escHtml(seg.qualityLabel) + '</span>';
            // BPM summary inline (if groove data has IOIs and song has target BPM)
            var _segTargetBPM = _rhGetSongBPM(seg.songTitle);
            if (seg.groove && seg.groove.iois && seg.groove.iois.length >= 8 && _segTargetBPM && typeof PocketMeterTimeSeries !== 'undefined') {
                var _ts = PocketMeterTimeSeries.compute(seg.groove, seg.startSec, _segTargetBPM);
                if (_ts) {
                    html += ' \u00B7 <span style="color:' + _ts.stabilityColor + '">' + _ts.avgBPM + ' BPM \u2014 ' + _ts.directionLabel + '</span>';
                }
            }
            html += '</div></div>';
            // Hover quick actions \u2014 now siblings of the toggle target.
            if (hasAudio) {
                html += '<span class="rh-hover-actions" style="display:flex;gap:3px">'
                    + '<button onclick="_rhLoopSegment(' + seg.startSec + ',' + seg.endSec + ',\'' + escHtml(sessionId) + '\',' + si + ')" style="background:none;border:none;color:#fbbf24;cursor:pointer;font-size:0.7em;padding:4px" title="Repeat this section on loop">\uD83D\uDD01</button>'
                    + '<button onclick="(function(t){(typeof openWorkbench===\'function\')?openWorkbench(t,\'practice\',{}):(typeof openRehearsalMode===\'function\'&&openRehearsalMode(t))})(\'' + escHtml(seg.songTitle || '').replace(/'/g, "\\'") + '\')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.7em;padding:4px" title="Open chart and practice this song">\uD83C\uDFAF</button>'
                    + '</span>';
            }
            html += '</div>'; // end .rh-seg-header
            // Expanded detail (toggle target \u2014 hidden until _rhToggleSeg flips data-expanded)
            var _sSafe = escHtml(sessionId);
            var _songSafe = escHtml(seg.songTitle || '').replace(/'/g, "\\'");
            html += '<div id="rhSegBody_' + si + '" class="rh-seg-body" style="display:none;padding:6px 10px 10px 32px;font-size:0.72em;color:var(--text-dim);line-height:1.5">';
            html += '<div>' + _rhFmt(seg.startSec) + ' \u2013 ' + _rhFmt(seg.endSec) + ' \u00B7 ' + durLabel2 + '</div>';
            // Match confidence + "why this matched" (skip for golden standard — those are definitively correct)
            if (seg.songMatch && !seg._goldenStandard) {
                var _mc = seg.songMatch;
                var _confColor = _mc.confidence === 'high' ? '#10b981' : _mc.confidence === 'medium' ? '#f59e0b' : '#64748b';
                var _confLabel = _mc.confidence === 'high' ? 'High confidence' : _mc.confidence === 'medium' ? 'Likely match' : 'Needs review';
                html += '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;flex-wrap:wrap">';
                html += '<span style="font-size:0.82em;color:' + _confColor + ';font-weight:600">' + _confLabel + '</span>';
                if (_mc.explanation && _mc.explanation.length) {
                    html += '<span style="font-size:0.78em;color:var(--text-dim)">\u2014 ' + escHtml(_mc.explanation[0]) + '</span>';
                }
                if (_mc.rerankedByChords) {
                    html += '<span style="font-size:0.68em;color:#818cf8;padding:1px 5px;border-radius:3px;background:rgba(129,140,248,0.1);border:1px solid rgba(129,140,248,0.2)">adjusted by chords</span>';
                }
                html += '</div>';
                // Quick alternatives with ranking cues (medium/low confidence only)
                if (_mc.confidence !== 'high' && _mc.candidates && _mc.candidates.length > 1) {
                    html += '<div style="font-size:0.75em;color:var(--text-dim);margin:2px 0">';
                    html += (_mc.confidence === 'low' ? 'Could be: ' : 'Also possible: ');
                    _mc.candidates.slice(1, 3).forEach(function(alt, ai) {
                        if (ai > 0) html += ', ';
                        var gap = _mc.bestMatch ? _mc.bestMatch.score - alt.score : 0;
                        var closeTag = gap < 0.1 ? ' <span style="font-size:0.85em;color:#f59e0b">(close)</span>' : '';
                        html += '<span onclick="if(typeof RecordingAnalyzer!==\'undefined\')RecordingAnalyzer._updateSegTitle(' + si + ',\'' + escHtml(alt.title).replace(/'/g, "\\'") + '\')" style="color:#818cf8;cursor:pointer;text-decoration:underline">' + escHtml(alt.title) + '</span>' + closeTag;
                    });
                    html += '</div>';
                }
            }
            if (seg.groove && seg.groove.label) {
                var _gStab = seg.groove.stability;
                var _gDesc = _gStab >= 80 ? 'Timing was locked in' : _gStab >= 50 ? 'Timing wavered in spots' : 'Timing was loose';
                html += '<div style="color:' + (_gStab >= 80 ? '#10b981' : _gStab >= 50 ? '#f59e0b' : '#ef4444') + '">' + _gDesc + '</div>';
            }
            // Pocket Meter graph (BPM over time)
            var _pmTargetBPM = _rhGetSongBPM(seg.songTitle);
            if (seg.groove && seg.groove.iois && seg.groove.iois.length >= 8 && _pmTargetBPM && typeof PocketMeterTimeSeries !== 'undefined') {
                var _pmTs = PocketMeterTimeSeries.compute(seg.groove, seg.startSec, _pmTargetBPM);
                if (_pmTs && _pmTs.points.length >= 3) {
                    html += '<div style="margin:6px 0 4px;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.04)">';
                    // Headline takeaway (max 1)
                    if (_pmTs.headline) {
                        html += '<div style="padding:6px 8px 2px;font-size:0.65em;font-weight:600;color:' + _pmTs.stabilityColor + ';line-height:1.3">' + escHtml(_pmTs.headline) + '</div>';
                    }
                    // Cross-session comparison (if previous fingerprint exists)
                    var _prevFp = _rhGetPreviousFingerprint(seg.songTitle);
                    if (_prevFp && _pmTs.fingerprint) {
                        _pmTs.fingerprint.songTitle = seg.songTitle;
                        var _cmp = PocketMeterTimeSeries.compareFingerprints(_pmTs.fingerprint, _prevFp);
                        if (_cmp) {
                            var _cmpColor = (_cmp.tier === 'big_gain' || _cmp.tier === 'gain') ? '#10b981' : (_cmp.tier === 'same') ? '#94a3b8' : '#f59e0b';
                            var _cmpIcon = _cmp.improved ? '\u2191' : (_cmp.tier === 'slip' || _cmp.tier === 'big_slip') ? '\u2193' : '\u2192';
                            var _cmpBg = _cmp.improved ? 'rgba(16,185,129,0.06)' : (_cmp.tier === 'same' ? 'transparent' : 'rgba(245,158,11,0.06)');
                            html += '<div style="padding:3px 8px;margin:2px 0;font-size:0.6em;color:' + _cmpColor + ';font-weight:600;border-radius:4px;background:' + _cmpBg + '">'
                                + _cmpIcon + ' ' + escHtml(_cmp.label) + '</div>';
                        }
                    }
                    // Trend from history (last 3+ sessions)
                    var _fpHistory = _rhFingerprintCache[seg.songTitle] && _rhFingerprintCache[seg.songTitle].history;
                    if (_fpHistory && _fpHistory.length >= 3 && typeof PocketMeterTimeSeries !== 'undefined' && PocketMeterTimeSeries.detectTrend) {
                        var _trend = PocketMeterTimeSeries.detectTrend(_fpHistory);
                        if (_trend && _trend.label) {
                            var _tColor = _trend.trend === 'improving' ? '#10b981' : '#f59e0b';
                            html += '<div style="padding:1px 8px;font-size:0.55em;color:' + _tColor + '">\uD83D\uDCC8 ' + escHtml(_trend.label) + '</div>';
                        }
                    }
                    // Save current fingerprint for next session comparison
                    _rhSaveFingerprint(seg.songTitle, _pmTs.fingerprint, session);
                    // Header with stability label + stats
                    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 8px 4px">';
                    html += '<span style="font-size:0.58em;color:var(--text-dim)">Pocket Meter \u00B7 <span style="color:' + _pmTs.stabilityColor + '">' + _pmTs.stabilityLabel + '</span></span>';
                    html += '<span style="font-size:0.55em;color:var(--text-dim)">Target ' + _pmTargetBPM + ' \u00B7 Avg ' + _pmTs.avgBPM + '</span>';
                    html += '</div>';
                    html += PocketMeterTimeSeries.renderSVG(_pmTs, 280, 80);
                    // Problem zone callouts — worst zone emphasized with "Work on This" link
                    if (_pmTs.problemZones.length > 0) {
                        html += '<div style="padding:3px 8px 5px;font-size:0.58em;color:var(--text-dim)">';
                        _pmTs.problemZones.slice(0, 3).forEach(function(z, zi) {
                            var isWorst = zi === 0;
                            var zColor = z.type === 'rushing' ? '#ef4444' : '#f59e0b';
                            html += '<div style="padding:1px 0' + (isWorst ? ';font-weight:700' : '') + '">';
                            html += '<span onclick="_rhJumpToTime(' + z.startSec.toFixed(1) + ')" style="cursor:pointer;color:' + zColor + '">'
                                + (isWorst ? '\u25B6 ' : '') + escHtml(z.label) + ' at ' + _rhFmt(z.startSec) + '</span>';
                            if (isWorst) {
                                html += ' <span onclick="_rhFixThisNow(\'' + _songSafe + '\',\'' + _sSafe + '\')" style="cursor:pointer;color:#fbbf24;text-decoration:underline;margin-left:4px">\u2014 start here</span>';
                            }
                            html += '</div>';
                        });
                        html += '</div>';
                    }
                    // Coaching insights
                    if (_pmTs.coachingInsights && _pmTs.coachingInsights.length) {
                        html += '<div style="padding:3px 8px 5px;border-top:1px solid rgba(255,255,255,0.04)">';
                        _pmTs.coachingInsights.forEach(function(ci) {
                            html += '<div style="font-size:0.58em;color:#a5b4fc;line-height:1.4">\uD83D\uDCA1 ' + escHtml(ci) + '</div>';
                        });
                        html += '</div>';
                    }
                    html += '</div>';
                }
            }
            if (seg.chordHints && seg.chordHints.usable && seg.chordHints.summary && seg.chordHints.summary.topProgressionHint) {
                html += '<div style="color:var(--text-dim)">\uD83C\uDFB5 ' + escHtml(seg.chordHints.summary.topProgressionHint) + '</div>';
            }
            // Action buttons — larger touch targets for mobile
            var _abtn = 'padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.85em;font-family:inherit;min-height:32px;';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">';
            if (hasAudio) {
                html += '<button onclick="_rhPlaySegment(' + seg.startSec + ',' + seg.endSec + ',\'' + _sSafe + '\',' + si + ')" style="' + _abtn + 'border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#818cf8" title="Listen to this take">\u25B6 Listen</button>';
                html += '<button onclick="_rhLoopSegment(' + seg.startSec + ',' + seg.endSec + ',\'' + _sSafe + '\',' + si + ')" style="' + _abtn + 'border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.04);color:#fbbf24" title="Repeat this section until you stop it">\uD83D\uDD01 Loop</button>';
            }
            // Compare: only if multiple attempts of this song
            var _attemptCount = data.songGroups[seg.songTitle] ? data.songGroups[seg.songTitle].segments.length : 0;
            if (_attemptCount >= 2) {
                html += '<button onclick="_rhCompareAttempts(\'' + _songSafe + '\')" style="' + _abtn + 'border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.04);color:#10b981" title="See all takes side by side">Compare Takes</button>';
            }
            html += '<button onclick="(typeof openWorkbench===\'function\')?openWorkbench(\'' + _songSafe + '\',\'practice\',{}):(typeof openRehearsalMode===\'function\'&&openRehearsalMode(\'' + _songSafe + '\'))" style="' + _abtn + 'border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)" title="Open chart and work on this song">Practice</button>';
            html += '</div>';
            html += '</div></div>'; // close rh-seg-body + rh-seg-row

        } else if (isTalk) {
            // Talking segment — enhanced "Band Note"
            var content = seg.transcript || seg.notes || '';
            var tags = (seg.talkTags && seg.talkTags.length) ? seg.talkTags : [];
            var tagLabel = tags.length ? tags.join(', ') : '';
            // Find nearest song for context
            var nearestSong = '';
            for (var nsi = si - 1; nsi >= 0; nsi--) {
                if (!segments[nsi].segType || segments[nsi].segType === 'song') { nearestSong = segments[nsi].songTitle || ''; break; }
            }

            var topicLabel = tags.length ? tags[0] : (nearestSong ? nearestSong : '');
            html += '<div id="rhSeg_' + si + '" class="rh-seg-row" style="margin-bottom:5px;padding:8px 10px;border-radius:7px;border-left:3px solid rgba(165,180,252,0.15);background:rgba(165,180,252,0.02)">';
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
            html += '<button id="rhPlayBtn_' + si + '" onclick="_rhPlaySegment(' + seg.startSec + ',' + seg.endSec + ',\'' + escHtml(sessionId) + '\',' + si + ')" style="' + playBtnStyle + '"' + (hasAudio ? '' : ' disabled') + '>\u25B6</button>';
            html += '<span style="font-size:0.68em;font-weight:700;color:#a5b4fc">\uD83D\uDCAC Discussion' + (topicLabel ? ' \u2014 ' + escHtml(topicLabel) : '') + '</span>';
            html += '<span style="font-size:0.58em;color:var(--text-dim);margin-left:auto">' + _rhFmt(seg.startSec) + ' \u00B7 ' + durLabel2 + '</span>';
            html += '</div>';
            if (content) html += '<div style="font-size:0.75em;color:var(--text-muted);line-height:1.4;padding-left:28px">\u201C' + escHtml(content.substring(0, 200)) + (content.length > 200 ? '...' : '') + '\u201D</div>';
            if (tags.length > 1) html += '<div style="font-size:0.58em;color:#818cf8;padding-left:28px;margin-top:2px">' + tags.join(' \u00B7 ') + '</div>';
            if (nearestSong) html += '<div style="font-size:0.62em;color:var(--text-dim);padding-left:28px;margin-top:2px;cursor:pointer" onclick="var el=document.querySelector(\'[data-song=\\\'' + escHtml(nearestSong).replace(/'/g, '') + '\\\']\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});el.classList.add(\'rh-jump-highlight\');setTimeout(function(){el.classList.remove(\'rh-jump-highlight\')},800)}">About: <span style="color:#818cf8;text-decoration:underline dotted">' + escHtml(nearestSong) + '</span></div>';
            html += '</div>';

        } else {
            // Jam/restart/other
            html += '<div style="margin-bottom:4px;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.01);display:flex;align-items:center;gap:8px">';
            html += '<button onclick="_rhPlaySegment(' + seg.startSec + ',' + seg.endSec + ',\'' + escHtml(sessionId) + '\')" style="' + playBtnStyle + '"' + (hasAudio ? '' : ' disabled') + '>\u25B6</button>';
            html += '<span style="font-size:0.65em;color:var(--text-dim)">' + _rhFmt(seg.startSec) + '</span>';
            html += '<span style="flex:1;font-size:0.72em;color:var(--text-dim)">' + escHtml(isJam ? '\uD83C\uDFB6 Jam' : (seg.segType || '')) + ' ' + escHtml(seg.songTitle || '') + '</span>';
            html += '<span style="font-size:0.62em;color:var(--text-dim)">' + durLabel2 + '</span>';
            html += '</div>';
        }
    });

    // ── Coaching Insights (merged, actionable) ──
    var _hasInsights = data.recommendations.length > 0 || data.songList.some(function(g) { return g.bestQuality < 2 || g.segments.length >= 3; });
    // Phase 3I.6: per-session dismissal — sticky overlay was unclosable, blocking
    // Take Review interaction. Suppression key is per-sessionId so dismissing on
    // one rehearsal doesn't hide it on others. Stored in sessionStorage so it
    // resets on tab close.
    var _coachDismissKey = 'rhCoachDismiss_' + sessionId;
    var _coachDismissed = false;
    try { _coachDismissed = sessionStorage.getItem(_coachDismissKey) === '1'; } catch (e) {}
    if (_hasInsights && !_coachDismissed) {
        html += '<div id="rhCoachingPanel" style="margin-top:12px;padding:10px 12px;border-radius:8px;border:1px solid rgba(245,158,11,0.12);background:#1a2340;position:sticky;bottom:48px;z-index:50;max-height:220px;overflow:hidden;transition:max-height 0.3s ease">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px">'
            + '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.06em;color:var(--text-dim);text-transform:uppercase">What to Work On</div>'
            + '<button onclick="window._rhDismissCoachingPanel(\'' + escHtml(sessionId) + '\')" aria-label="Close What to Work On" title="Hide for this session" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.1em;line-height:1;padding:2px 6px;border-radius:4px">✕</button>'
            + '</div>';

        // Priority songs — only resolved songs (confidence >= medium), no unresolved segments
        var _prioritySongs = data.songList.filter(function(g) {
            if (!g.title) return false;
            // Exclude unresolved/unknown segments from coaching
            var _isUnresolved = g.segments.some(function(s) { return s._unresolved; });
            var _isUnknown = g.title.indexOf('Unknown') !== -1 || g.title.indexOf('Unresolved') !== -1;
            if (_isUnresolved || _isUnknown) return false;
            return g.segments.length >= 3 || g.bestQuality < 2;
        });
        var _visibleCount = 2;
        var _hasOverflow = _prioritySongs.length > _visibleCount;

        // Helper to render a single insight row with accept/dismiss
        function _renderInsightRow(g, hidden) {
            var reason = g.segments.length >= 3 ? 'took ' + g.segments.length + ' tries \u2014 nail the transitions' : 'didn\u2019t finish \u2014 try a full run-through';
            var _gSafe = escHtml(g.title).replace(/'/g, "\\'");
            var firstSeg = g.segments[0];
            var _rowId = 'rhInsight_' + _gSafe.replace(/[^a-zA-Z0-9]/g, '_');
            var rowHtml = '<div id="' + _rowId + '" class="rh-insight-row" style="font-size:0.75em;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03)' + (hidden ? ';display:none' : '') + '">'
                + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
                + '<button onclick="_rhAcceptInsight(\'' + _gSafe + '\',\'' + _rowId + '\')" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;line-height:1" title="Yes \u2014 add to plan">\u2705</button>'
                + '<button onclick="_rhDismissInsight(\'' + _rowId + '\')" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;line-height:1" title="Skip this one">\u274C</button>'
                + '<span style="color:var(--text);font-weight:600">' + escHtml(g.title) + '</span>'
                + '<span style="color:var(--text-dim)">\u2014 ' + reason + '</span>'
                + '</div>'
                + '<div style="display:flex;gap:4px;flex-wrap:wrap;padding-left:20px">';
            if (firstSeg && hasAudio) {
                var _segIdx = _rhFindSegIdx(g.title, true);
                var _focusSeg = _segIdx !== null ? g.segments[g.segments.length - 1] : firstSeg;
                rowHtml += '<button onclick="_rhFocusSegment(' + (_segIdx !== null ? _segIdx : 0) + ',' + _focusSeg.startSec + ',' + _focusSeg.endSec + ',\'' + escHtml(sessionId) + '\')" style="font-size:0.85em;padding:2px 8px;border-radius:4px;border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.04);color:#fbbf24;cursor:pointer;font-family:inherit">\uD83D\uDD01 Loop</button>';
            }
            if (g.segments.length >= 2) {
                rowHtml += '<button onclick="_rhCompareAttempts(\'' + _gSafe + '\')" style="font-size:0.85em;padding:2px 8px;border-radius:4px;border:1px solid rgba(16,185,129,0.2);background:rgba(16,185,129,0.04);color:#10b981;cursor:pointer;font-family:inherit">Compare</button>';
            }
            var _fixLabel = g.segments.length >= 3 ? 'Start Here \u2014 Fix Transitions' : (g.bestQuality < 2 ? 'Start Here \u2014 Full Run' : 'Start Here');
            rowHtml += '<button onclick="_rhFixThisNow(\'' + _gSafe + '\',\'' + escHtml(sessionId) + '\')" style="font-size:0.85em;padding:4px 10px;border-radius:5px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);color:#fbbf24;cursor:pointer;font-family:inherit;font-weight:700;min-height:28px">\u25B6 ' + _fixLabel + '</button>';
            rowHtml += '</div></div>';
            return rowHtml;
        }

        if (_prioritySongs.length) {
            _prioritySongs.forEach(function(g, idx) {
                html += _renderInsightRow(g, idx >= _visibleCount);
            });
            if (_hasOverflow) {
                html += '<button id="rhInsightExpander" onclick="_rhExpandInsights()" style="width:100%;margin-top:4px;padding:4px;border-radius:4px;border:none;background:none;color:#818cf8;cursor:pointer;font-size:0.68em;font-weight:600">See ' + (_prioritySongs.length - _visibleCount) + ' more</button>';
            }
        }

        // Pattern insights (always visible, compact)
        data.recommendations.forEach(function(r) {
            if (r.song && _prioritySongs.some(function(p) { return p.title === r.song; })) return;
            html += '<div style="font-size:0.72em;color:var(--text-muted);padding:2px 0">\u2022 ' + escHtml(r.text) + '</div>';
        });

        // Auto-loop weakest section
        if (hasAudio && _prioritySongs.length) {
            var _weakest = _prioritySongs[0];
            var _weakSeg = _weakest.segments[_weakest.segments.length - 1];
            if (_weakSeg) {
                var _weakIdx = _rhFindSegIdx(_weakest.title, true);
                html += '<button onclick="_rhFocusSegment(' + (_weakIdx !== null ? _weakIdx : 0) + ',' + _weakSeg.startSec + ',' + _weakSeg.endSec + ',\'' + escHtml(sessionId) + '\')" style="width:100%;margin-top:8px;padding:10px;border-radius:8px;border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.04);color:#fbbf24;cursor:pointer;font-size:0.78em;font-weight:700">\uD83D\uDD01 Loop the Rough Spot \u2014 ' + escHtml(_weakest.title) + '</button>';
            }
        }

        html += '<button onclick="showPage(\'rehearsal\');setTimeout(function(){renderRehearsalPlanner();},300)" style="width:100%;margin-top:8px;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(34,197,94,0.1));color:#a5b4fc;cursor:pointer;font-size:0.78em;font-weight:700">Plan Next Rehearsal Based on This</button>';
        html += '</div>';
    }

    container.innerHTML = html;

    // Double-click-to-loop on segment rows
    container.querySelectorAll('.rh-seg-row[id^="rhSeg_"]').forEach(function(row) {
        row.addEventListener('dblclick', function(e) {
            // Find play button data
            var playBtn = row.querySelector('button[onclick*="_rhPlaySegment"]');
            if (!playBtn) return;
            var onclickStr = playBtn.getAttribute('onclick') || '';
            var match = onclickStr.match(/_rhPlaySegment\(([0-9.]+),([0-9.]+)/);
            if (match) {
                e.preventDefault();
                _rhLoopSegment(parseFloat(match[1]), parseFloat(match[2]), sessionId);
            }
        });
    });
}

// ── Coaching panel dismiss ───────────────────────────────────────────────────
// Phase 3I.6: per-session suppression. SessionStorage so the panel is hidden
// for the current tab session but reappears after a fresh load (we don't want
// to silently bury insights forever — just give the user breathing room).
window._rhDismissCoachingPanel = function (sessionId) {
    try { sessionStorage.setItem('rhCoachDismiss_' + sessionId, '1'); } catch (e) {}
    var panel = document.getElementById('rhCoachingPanel');
    if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
    }
};

// ── Coaching panel expand/collapse ────────────────────────────────────────────
window._rhExpandInsights = function() {
    var panel = document.getElementById('rhCoachingPanel');
    var btn = document.getElementById('rhInsightExpander');
    if (!panel) return;
    var hidden = panel.querySelectorAll('.rh-insight-row[style*="display:none"]');
    if (hidden.length > 0) {
        // Expand
        hidden.forEach(function(el) { el.style.display = ''; });
        panel.style.maxHeight = 'none';
        if (btn) btn.textContent = 'Show less';
    } else {
        // Collapse back to top 2
        var rows = panel.querySelectorAll('.rh-insight-row');
        rows.forEach(function(el, i) { if (i >= 2) el.style.display = 'none'; });
        panel.style.maxHeight = '220px';
        if (btn) btn.textContent = 'See ' + (rows.length - 2) + ' more';
    }
};

// ── Accept/Dismiss insight recommendations ──────────────────────────────────
window._rhAcceptInsight = function(songTitle, rowId) {
    // Add to plan
    var units = _rhGetUnits();
    // Check if already in plan
    var already = units.some(function(u) { return u.title === songTitle; });
    if (!already) {
        units.push({ type: 'single', title: songTitle, band: '', block: 'flow' });
        _rhSaveUnits(units);
        if (typeof showToast === 'function') showToast('\u2705 ' + songTitle + ' added to plan');
    } else {
        if (typeof showToast === 'function') showToast(songTitle + ' already in plan');
    }
    // Fade out the row
    var row = document.getElementById(rowId);
    if (row) { row.style.opacity = '0.3'; row.style.textDecoration = 'line-through'; row.style.pointerEvents = 'none'; }
};

window._rhDismissInsight = function(rowId) {
    var row = document.getElementById(rowId);
    if (row) {
        row.style.transition = 'opacity 0.3s, max-height 0.3s';
        row.style.opacity = '0';
        row.style.maxHeight = '0';
        row.style.overflow = 'hidden';
        row.style.padding = '0';
        row.style.margin = '0';
        setTimeout(function() { row.remove(); }, 300);
    }
};

// ── Insight → Action: scroll to segment, expand it, prepare playback ─────────
window._rhFocusSegment = function(segIdx, startSec, endSec, sessionId) {
    var row = document.getElementById('rhSeg_' + segIdx);
    if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (row.tagName === 'DETAILS' && !row.open) row.open = true;
        row.classList.add('rh-focus-flash');
        setTimeout(function() { row.classList.remove('rh-focus-flash'); }, 1500);
    }
    // Start loop playback
    if (startSec !== undefined && endSec !== undefined) {
        _rhLoopSegment(startSec, endSec, sessionId, segIdx);
    }
};

// ── Start Here mode: isolate worst section + loop + coaching guidance ─────────
window._rhFixThisNow = function(songTitle, sessionId) {
    var tl = (typeof GLStore !== 'undefined' && GLStore.getCurrentTimeline) ? GLStore.getCurrentTimeline() : {};
    var data = tl.data;
    if (!data || !data.songGroups || !data.songGroups[songTitle]) return;
    var group = data.songGroups[songTitle];
    // Use worst attempt (last one, typically where they gave up)
    var seg = group.segments[group.segments.length - 1];
    if (!seg) return;

    // Find segment index
    var segIdx = null;
    for (var i = 0; i < data.allSegments.length; i++) {
        if (data.allSegments[i] === seg) { segIdx = i; break; }
    }

    // Check for Pocket Meter worst zone — use it for more specific guidance and loop target
    var worstZone = null;
    var _ftnTargetBPM = _rhGetSongBPM(songTitle);
    if (seg.groove && seg.groove.iois && seg.groove.iois.length >= 8 && _ftnTargetBPM && typeof PocketMeterTimeSeries !== 'undefined') {
        var _ftnTs = PocketMeterTimeSeries.compute(seg.groove, seg.startSec, _ftnTargetBPM);
        if (_ftnTs && _ftnTs.worstZone) worstZone = _ftnTs.worstZone;
    }

    // Build coaching guidance based on segment data
    var guidance = [];
    if (worstZone) {
        guidance.push('The worst spot is at ' + _rhFmt(worstZone.startSec) + ' \u2014 ' + worstZone.label.toLowerCase() + '. Start there.');
    }
    if (group.segments.length >= 3) guidance.push('This took ' + group.segments.length + ' tries. Focus on the part where you keep tripping up.');
    if (seg.groove && seg.groove.stability < 50) guidance.push('The timing was loose here. Try counting it out or playing to a click.');
    if (seg.duration < 60) guidance.push('You stopped short. Try playing all the way through, even if it\u2019s messy.');
    if (seg.qualityScore < 2) guidance.push('This didn\u2019t get a clean run. Slow it down, nail the changes, then bring it back up.');
    if (!guidance.length) guidance.push('Loop this and focus on making each pass cleaner.');

    // Scroll to segment and expand
    var row = document.getElementById('rhSeg_' + segIdx);
    if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (row.tagName === 'DETAILS' && !row.open) row.open = true;
        row.classList.add('rh-fix-mode');
        row.classList.add('rh-active-focus');
    }

    // Clear previous focus states
    document.querySelectorAll('.rh-active-focus').forEach(function(el) { if (el !== row) el.classList.remove('rh-active-focus'); });

    // Show fix mode overlay on the segment
    var existingFix = document.getElementById('rhFixPanel');
    if (existingFix) existingFix.remove();

    var panel = document.createElement('div');
    panel.id = 'rhFixPanel';
    panel.style.cssText = 'margin:4px 0 8px;padding:10px 12px;border-radius:8px;border:1px solid rgba(245,158,11,0.25);background:rgba(245,158,11,0.04)';
    var ph = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
    ph += '<div style="font-size:0.75em;font-weight:800;color:#fbbf24">\u25B6 Start here \u2014 ' + escHtml(songTitle) + '</div>';
    ph += '<button onclick="document.getElementById(\'rhFixPanel\').remove();document.querySelectorAll(\'.rh-fix-mode,.rh-active-focus\').forEach(function(e){e.classList.remove(\'rh-fix-mode\');e.classList.remove(\'rh-active-focus\')})" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.82em">\u2715</button>';
    ph += '</div>';
    guidance.forEach(function(g) {
        ph += '<div style="font-size:0.72em;color:var(--text-muted);padding:2px 0;line-height:1.4">\u2022 ' + escHtml(g) + '</div>';
    });
    ph += '<div style="display:flex;gap:6px;margin-top:8px">';
    ph += '<button onclick="_rhLoopSegment(' + seg.startSec + ',' + seg.endSec + ',\'' + escHtml(sessionId || tl.sessionId || '') + '\',' + (segIdx || 0) + ')" style="flex:1;padding:8px;border-radius:6px;border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.06);color:#fbbf24;cursor:pointer;font-size:0.78em;font-weight:700;min-height:36px">\uD83D\uDD01 Loop It</button>';
    ph += '<button onclick="(function(t){(typeof openWorkbench===\'function\')?openWorkbench(t,\'practice\',{}):(typeof openRehearsalMode===\'function\'&&openRehearsalMode(t))})(\'' + escHtml(songTitle).replace(/'/g, "\\'") + '\')" style="flex:1;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-size:0.78em;font-weight:600;min-height:36px">Open Chart</button>';
    ph += '</div>';
    panel.innerHTML = ph;

    // Insert after the segment row
    if (row && row.nextSibling) {
        row.parentNode.insertBefore(panel, row.nextSibling);
    } else if (row) {
        row.parentNode.appendChild(panel);
    }

    // Start loop automatically — use worst zone if available for precision targeting
    if (_rhHasAudio()) {
        var loopStart = worstZone ? worstZone.startSec : seg.startSec;
        var loopEnd = worstZone ? Math.min(worstZone.endSec + 5, seg.endSec) : seg.endSec;
        _rhLoopSegment(loopStart, loopEnd, sessionId || tl.sessionId || '', segIdx || 0);
        if (typeof showToast === 'function') showToast('\uD83D\uDD01 Looping the toughest spot \u2014 ' + escHtml(songTitle));
    }
};

// Find the segment index for a song title (first or worst attempt)
function _rhFindSegIdx(songTitle, useWorst) {
    var tl = (typeof GLStore !== 'undefined' && GLStore.getCurrentTimeline) ? GLStore.getCurrentTimeline() : {};
    var data = tl.data;
    if (!data || !data.songGroups || !data.songGroups[songTitle]) return null;
    var segs = data.songGroups[songTitle].segments;
    if (!segs.length) return null;
    var target = useWorst ? segs[segs.length - 1] : segs[0];
    // Find its index in allSegments
    for (var i = 0; i < data.allSegments.length; i++) {
        if (data.allSegments[i] === target) return i;
    }
    return null;
}

// ── Pocket Meter fingerprint storage (cross-session comparison) ──────────────
// Stores groove fingerprints per song with history for trend tracking.
// Firebase schema: /groove_fingerprints/{songKey}/latest   — fast access
//                  /groove_fingerprints/{songKey}/history[] — array (max 10)
var _rhFingerprintCache = {}; // { songTitle: { current: fp, previous: fp, history: [] } }
var _RH_FP_MAX_HISTORY = 10;

function _rhSaveFingerprint(songTitle, fingerprint, session) {
    if (!songTitle || !fingerprint) return;
    fingerprint.songTitle = songTitle;
    fingerprint.timestamp = session && session.date ? session.date : new Date().toISOString();
    // Cache locally
    if (!_rhFingerprintCache[songTitle]) _rhFingerprintCache[songTitle] = {};
    _rhFingerprintCache[songTitle].current = fingerprint;
    // Persist to Firebase (non-blocking)
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        var key = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(songTitle) : songTitle.replace(/[.#$/\[\]]/g, '_');
        var fpPath = bandPath('groove_fingerprints/' + key);
        // Write latest for fast access
        db.ref(fpPath + '/latest').set(fingerprint).catch(function() {});
        // Append to history (capped to 10 entries)
        db.ref(fpPath + '/history').once('value').then(function(snap) {
            var history = snap.val();
            if (!Array.isArray(history)) history = history ? Object.values(history) : [];
            // Don't duplicate same timestamp
            var exists = history.some(function(h) { return h.timestamp === fingerprint.timestamp; });
            if (!exists) {
                history.push(fingerprint);
                // Keep only latest N
                if (history.length > _RH_FP_MAX_HISTORY) history = history.slice(history.length - _RH_FP_MAX_HISTORY);
                db.ref(fpPath + '/history').set(history).catch(function() {});
            }
        }).catch(function() {});
    }
}

function _rhGetPreviousFingerprint(songTitle) {
    if (!songTitle) return null;
    if (_rhFingerprintCache[songTitle] && _rhFingerprintCache[songTitle].previous) {
        return _rhFingerprintCache[songTitle].previous;
    }
    return null;
}

// Preload previous fingerprints from Firebase (called once when timeline renders)
async function _rhPreloadFingerprints() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        var snap = await db.ref(bandPath('groove_fingerprints')).once('value');
        var val = snap.val();
        if (!val) return;
        Object.keys(val).forEach(function(key) {
            var entry = val[key];
            var latest = entry && entry.latest;
            var history = entry && entry.history;
            if (!Array.isArray(history)) history = history ? Object.values(history) : [];
            if (latest && latest.songTitle) {
                if (!_rhFingerprintCache[latest.songTitle]) _rhFingerprintCache[latest.songTitle] = {};
                // Latest from Firebase becomes "previous" for comparison against current session
                _rhFingerprintCache[latest.songTitle].previous = latest;
                _rhFingerprintCache[latest.songTitle].history = history;
            }
        });
    } catch (e) {}
}

// ── Song BPM lookup (for Pocket Meter) ───────────────────────────────────────
function _rhGetSongBPM(songTitle) {
    if (!songTitle) return null;
    // Check allSongs array
    if (typeof allSongs !== 'undefined' && allSongs) {
        for (var i = 0; i < allSongs.length; i++) {
            if (allSongs[i].title === songTitle && allSongs[i].bpm) return allSongs[i].bpm;
        }
    }
    // Check GLStore
    if (typeof GLStore !== 'undefined' && GLStore.getSongDetail) {
        var detail = GLStore.getSongDetail(songTitle);
        if (detail && detail.bpm) return detail.bpm;
    }
    return null;
}

// ── Jump to time in playback (from Pocket Meter problem zone clicks) ─────────
window._rhJumpToTime = function(timeSec) {
    if (_rhSharedAudio && _rhSharedAudio.src) {
        _rhSharedAudio.currentTime = timeSec;
        if (_rhSharedAudio.paused) _rhSharedAudio.play();
        _rhUpdateTransport();
    } else {
        if (typeof showToast === 'function') showToast('Load a recording first to jump to this point');
    }
};

// ── Shared data preparation (single source of truth) ────────────────────────
var _rhFmt = function(sec) { if (!sec && sec !== 0) return '0:00'; var m = Math.floor(sec / 60); var s = Math.floor(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; };

function _rhPrepareSegmentData(session, segments) {
    // Anchor at local noon, tolerating both YYYY-MM-DD and full-ISO strings
    var _sessD = session.date ? new Date(String(session.date).slice(0, 10) + 'T12:00:00') : null;
    var dateStr = (_sessD && !isNaN(_sessD.getTime())) ? _sessD.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
    var totalDur = session.totalActualMin || 0;
    var durLabel = totalDur >= 60 ? Math.floor(totalDur / 60) + 'h ' + (totalDur % 60) + 'm' : totalDur + 'm';

    var songSegs = segments.filter(function(s) { return !s.segType || s.segType === 'song'; });
    var talkSegs = segments.filter(function(s) { return s.segType === 'talking'; });
    var restartSegs = segments.filter(function(s) { return s.segType === 'restart'; });
    var jamSegs = segments.filter(function(s) { return s.segType === 'jam'; });

    var songGroups = {};
    songSegs.forEach(function(seg) {
        var title = seg.songTitle || 'Unknown';
        if (!songGroups[title]) songGroups[title] = { title: title, segments: [], totalTime: 0, bestQuality: 0 };
        songGroups[title].segments.push(seg);
        songGroups[title].totalTime += seg.duration || 0;
        if ((seg.qualityScore || 0) > songGroups[title].bestQuality) songGroups[title].bestQuality = seg.qualityScore;
    });
    var songList = Object.values(songGroups).sort(function(a, b) {
        return (a.segments[0].startSec || 0) - (b.segments[0].startSec || 0);
    });

    // Derive recommendations from segment data
    var recommendations = [];
    songList.forEach(function(g) {
        if (g.segments.length >= 3) recommendations.push({ text: g.title + ' needed ' + g.segments.length + ' takes \u2014 slow down the tricky parts', song: g.title });
        if (g.bestQuality < 2 && g.segments.length > 0) recommendations.push({ text: g.title + ' didn\u2019t get a full run \u2014 try playing all the way through next time', song: g.title });
    });
    var totalSongTime = songSegs.reduce(function(a, s) { return a + (s.duration || 0); }, 0);
    var totalTalkTime = talkSegs.reduce(function(a, s) { return a + (s.duration || 0); }, 0);
    if (totalTalkTime > totalSongTime * 0.4 && talkSegs.length > 2) recommendations.push({ text: 'More time talking than playing \u2014 try running songs first next time' });

    return {
        dateStr: dateStr, durLabel: durLabel,
        songSegs: songSegs, talkSegs: talkSegs, restartSegs: restartSegs, jamSegs: jamSegs,
        songGroups: songGroups, songList: songList,
        pva: session.plan_vs_actual || null,
        recommendations: recommendations.slice(0, 3),
        allSegments: segments
    };
}

function _rhHasAudio() {
    if (_rhSharedAudio && _rhSharedAudio.src) return true;
    if (typeof RecordingAnalyzer !== 'undefined' && (RecordingAnalyzer._loadedPlaybackUrl || RecordingAnalyzer._currentAudioUrl)) return true;
    if (window._rhDriveFileId && window._rhDriveToken) return true;
    return false;
}


// Playback engine — single shared audio, pause toggle, transport bar
var _rhSharedAudio = null;
var _rhAudioSessionId = null;
var _rhPlayingSegIdx = null;     // currently playing segment index
var _rhPlayingEndSec = null;     // end boundary for current segment
var _rhTimeUpdateFn = null;      // active timeupdate listener ref

function _rhEnsureAudio(sessionId) {
    if (!_rhSharedAudio) {
        _rhSharedAudio = document.getElementById('rhTimelineAudio');
        if (!_rhSharedAudio) {
            _rhSharedAudio = document.createElement('audio');
            _rhSharedAudio.id = 'rhTimelineAudio';
            _rhSharedAudio.style.display = 'none';
            _rhSharedAudio.preload = 'metadata';
            document.body.appendChild(_rhSharedAudio);
        }
    }
    // Only set src ONCE — re-setting triggers full reload (OOM on large files)
    if (_rhAudioSessionId !== sessionId || !_rhSharedAudio.src) {
        var _url = null;
        if (typeof RecordingAnalyzer !== 'undefined' && RecordingAnalyzer._loadedPlaybackUrl) _url = RecordingAnalyzer._loadedPlaybackUrl;
        else if (typeof RecordingAnalyzer !== 'undefined' && RecordingAnalyzer._currentAudioUrl) _url = RecordingAnalyzer._currentAudioUrl;
        // Drive streaming: proxy through Worker (Safari can't stream from googleapis.com directly)
        if (!_url && window._rhDriveFileId && window._rhDriveToken) {
            var _wb = (typeof WORKER_URL !== 'undefined') ? WORKER_URL
                : (typeof WORKER_BASE !== 'undefined') ? WORKER_BASE
                : (typeof window.WORKER_BASE !== 'undefined') ? window.WORKER_BASE
                : 'https://deadcetera-proxy.drewmerrill.workers.dev';
            _url = _wb + '/drive-stream?fileId=' + encodeURIComponent(window._rhDriveFileId)
                + '&token=' + encodeURIComponent(window._rhDriveToken);
            // Pre-validate: check if the stream URL actually returns audio before setting as src
            console.log('[Drive] Stream URL:', _url.substring(0, 80) + '...');
            console.log('[Drive] Token length:', window._rhDriveToken.length, 'starts with:', window._rhDriveToken.substring(0, 10));
        }
        if (!_url) { if (typeof showToast === 'function') showToast('Select recording file first to enable playback'); return false; }
        _rhSharedAudio.src = _url;
        _rhSharedAudio.preload = 'none';
        _rhAudioSessionId = sessionId;
    }
    return true;
}

function _rhClearPlayState() {
    document.querySelectorAll('.rh-playing').forEach(function(el) { el.classList.remove('rh-playing'); });
    document.querySelectorAll('.rh-playing-btn').forEach(function(el) { el.classList.remove('rh-playing-btn'); el.textContent = '\u25B6'; });
    if (_rhTimeUpdateFn && _rhSharedAudio) { _rhSharedAudio.removeEventListener('timeupdate', _rhTimeUpdateFn); _rhTimeUpdateFn = null; }
    window._rhLoopActive = false;
    _rhPlayingSegIdx = null;
    _rhPlayingEndSec = null;
    _rhHideTransport();
}

window._rhPlaySegment = function(startSec, endSec, sessionId, segIdx) {
    var audio = _rhSharedAudio;

    // ── Pause toggle: if this segment is already playing, just pause ──
    if (audio && !audio.paused && _rhPlayingSegIdx === segIdx && segIdx !== undefined) {
        audio.pause();
        var btn = document.getElementById('rhPlayBtn_' + segIdx);
        if (btn) { btn.classList.remove('rh-playing-btn'); btn.textContent = '\u25B6'; }
        _rhUpdateTransport(); // update transport to show paused state
        return;
    }

    // ── Resume: if same segment is paused, resume ──
    if (audio && audio.paused && _rhPlayingSegIdx === segIdx && segIdx !== undefined
        && audio.currentTime >= startSec && audio.currentTime < endSec
        && audio.src) {
        audio.play();
        var btn2 = document.getElementById('rhPlayBtn_' + segIdx);
        if (btn2) { btn2.classList.add('rh-playing-btn'); btn2.textContent = '\u23F8'; }
        _rhUpdateTransport();
        return;
    }

    // ── New segment: set up fresh playback ──
    if (!_rhEnsureAudio(sessionId)) return;
    audio = _rhSharedAudio;

    // Stop any loop
    window._rhLoopActive = false;

    // Clear previous highlights
    _rhClearPlayState();

    // Set new play state
    _rhPlayingSegIdx = segIdx;
    _rhPlayingEndSec = endSec;

    // Highlight active row
    if (segIdx !== undefined) {
        var row = document.getElementById('rhSeg_' + segIdx);
        if (row) row.classList.add('rh-playing');
        var btn3 = document.getElementById('rhPlayBtn_' + segIdx);
        if (btn3) { btn3.classList.add('rh-playing-btn'); btn3.textContent = '\u23F8'; }
    }

    // For Drive streaming: fetch via JS fetch() and create a blob URL.
    // Safari won't play from any non-blob URL (SRC_NOT_SUPPORTED error 4).
    // Phase 3I.5 — skip this blob fetch when audio.src is already a Worker
    // /drive-stream URL: that endpoint already streams Drive bytes with proper
    // CORS + Range support, and the direct Drive API call this branch makes
    // 403s on drive.file-scoped tokens that didn't grant for the file via the
    // (older) Picker association. Path A above set up the stream URL; we just
    // need to let the audio element fetch it on demand.
    var _hasWorkerStream = audio.src && audio.src.indexOf('/drive-stream') !== -1;
    var _isDrivePending = window._rhDriveFileId && (!audio.src || (audio.src.indexOf('blob:') === -1 && !_hasWorkerStream));
    if (_isDrivePending) {
        if (typeof showToast === 'function') showToast('Downloading recording from Drive\u2026 this may take a minute');
        // Use fresh accessToken (not cached _rhDriveToken which may be stale)
        var _freshToken = (typeof accessToken !== 'undefined') ? accessToken : window._rhDriveToken;
        // Fetch directly from Drive API (not through Worker — fewer hops)
        var _apiUrl = 'https://www.googleapis.com/drive/v3/files/' + window._rhDriveFileId
            + '?alt=media&supportsAllDrives=true';
        console.log('[Drive] Fetching file as blob:', window._rhDriveFileId, 'token length:', (_freshToken || '').length);
        fetch(_apiUrl, {
            headers: { 'Authorization': 'Bearer ' + _freshToken }
        }).then(function(res) {
            console.log('[Drive] Response:', res.status, res.headers.get('Content-Type'), res.headers.get('Content-Length'));
            if (!res.ok) {
                return res.text().then(function(body) {
                    console.error('[Drive] Error body:', body.substring(0, 500));
                    throw new Error(res.status + ' — ' + (body.substring(0, 100)));
                });
            }
            return res.blob();
        }).then(function(blob) {
            console.log('[Drive] Blob received:', blob.size, 'bytes, type:', blob.type);
            var blobUrl = URL.createObjectURL(blob);
            audio.src = blobUrl;
            audio.preload = 'metadata';
            audio.addEventListener('loadedmetadata', function() {
                console.log('[Drive] Metadata loaded, duration:', audio.duration, 'seeking to:', startSec);
                audio.currentTime = startSec;
                audio.play();
            }, { once: true });
            audio.load();
            if (typeof showToast === 'function') showToast('Recording loaded (' + Math.round(blob.size / 1024 / 1024) + ' MB) \u2014 playing');
        }).catch(function(err) {
            console.error('[Drive] Fetch failed:', err);
            // 403/404 here usually means the file ID has no Picker grant (common
            // for recordings added before the drive.file migration). Point the
            // user at the Recordings surface where the Re-link button lives.
            var _msg = err && err.message ? err.message : 'Drive fetch failed';
            var _isAccessErr = /\b(403|404)\b/.test(_msg);
            if (typeof showToast === 'function') {
                showToast(_isAccessErr
                    ? '\u26A0 Recording needs re-linking under the new Drive Picker. Open Recordings \u2192 Re-link.'
                    : '\u26A0 ' + _msg, 8000);
            }
        });
    } else {
        // Local file or already-loaded blob — seek and play directly
        try { audio.currentTime = startSec; } catch(e) {}
        audio.play().catch(function(e) {
            console.warn('[Timeline] Play failed:', e.message);
            // Bug #10a 2026-05-17: when playback fails on a Worker /drive-stream
            // URL the most likely cause is 404 from Drive API (drive.file scope
            // can't see the file because it wasn't introduced via Drive Picker).
            // Surface a re-link prompt so Drew (or any band member) can recover
            // without console magic. Probe the URL HEAD to confirm it's a 4xx
            // before bothering the user — transient network errors shouldn't
            // pop the modal.
            if (_hasWorkerStream && window._rhDriveFileId) {
                try {
                    fetch(audio.src, { headers: { Range: 'bytes=0-0' } }).then(function(r) {
                        if (r.status >= 400 && r.status < 500) {
                            _rhPromptDriveRelink(sessionId);
                        }
                    }).catch(function() {});
                } catch (_pe) {}
            }
        });
    }

    // Show transport bar
    _rhShowTransport(startSec, endSec, sessionId, segIdx);

    // Stop at end + clean up
    var _segIdx = segIdx;
    _rhTimeUpdateFn = function() {
        _rhUpdateTransport();
        if (audio.currentTime >= endSec) {
            if (window._rhLoopActive) {
                audio.currentTime = startSec; // loop back
            } else {
                audio.pause();
                _rhClearPlayState();
            }
        }
    };
    audio.addEventListener('timeupdate', _rhTimeUpdateFn);
};

// Bug 2026-05-17 (a11y): segment row expand/collapse. Replaces the native
// <details>/<summary> behavior that used to host the play / loop / practice
// buttons inside <summary> (Chrome a11y panel flagged 32 of those). The row
// is now a plain <div> and clicking the title block here toggles the body's
// display + the data-expanded attribute + the aria-expanded state.
window._rhToggleSeg = function (si) {
    var row = document.getElementById('rhSeg_' + si);
    var body = document.getElementById('rhSegBody_' + si);
    if (!row || !body) return;
    var expanded = row.dataset.expanded === 'true';
    var next = expanded ? 'false' : 'true';
    row.dataset.expanded = next;
    body.style.display = expanded ? 'none' : 'block';
    // Keep aria-expanded on the toggle target in sync with the actual state.
    var toggleTarget = row.querySelector('[aria-controls="rhSegBody_' + si + '"]');
    if (toggleTarget) toggleTarget.setAttribute('aria-expanded', next);
};

// ── Pause/resume from transport bar ──────────────────────────────────────────
window._rhTogglePause = function() {
    if (!_rhSharedAudio) return;
    if (_rhSharedAudio.paused) {
        _rhSharedAudio.play();
    } else {
        _rhSharedAudio.pause();
    }
    _rhUpdateTransport();
    // Update segment button icon
    if (_rhPlayingSegIdx !== undefined && _rhPlayingSegIdx !== null) {
        var btn = document.getElementById('rhPlayBtn_' + _rhPlayingSegIdx);
        if (btn) {
            btn.textContent = _rhSharedAudio.paused ? '\u25B6' : '\u23F8';
            if (_rhSharedAudio.paused) btn.classList.remove('rh-playing-btn');
            else btn.classList.add('rh-playing-btn');
        }
    }
};

// ── Skip forward/back within segment ─────────────────────────────────────────
window._rhSkip = function(deltaSec) {
    if (!_rhSharedAudio) return;
    _rhSharedAudio.currentTime = Math.max(0, _rhSharedAudio.currentTime + deltaSec);
    _rhUpdateTransport();
};

// ── Stop playback ────────────────────────────────────────────────────────────
window._rhStopPlayback = function() {
    if (_rhSharedAudio) _rhSharedAudio.pause();
    _rhClearPlayState();
};

// ── Floating transport bar ───────────────────────────────────────────────────
var _rhTransportStart = 0;
var _rhTransportEnd = 0;

var _rhTransportSessionId = '';
var _rhTransportSegIdx = null;

function _rhShowTransport(startSec, endSec, sessionId, segIdx) {
    _rhTransportStart = startSec;
    _rhTransportEnd = endSec;
    _rhTransportSessionId = sessionId || '';
    _rhTransportSegIdx = segIdx;

    // Get song title + segment type from timeline data
    var title = '';
    var segType = '';
    var tl = (typeof GLStore !== 'undefined' && GLStore.getCurrentTimeline) ? GLStore.getCurrentTimeline() : {};
    if (tl.data && tl.data.allSegments && segIdx !== undefined && tl.data.allSegments[segIdx]) {
        var _seg = tl.data.allSegments[segIdx];
        title = _seg.songTitle || '';
        segType = _seg.segType || 'song';
    }
    var isLooping = !!window._rhLoopActive;
    var label = title || (segType === 'talking' ? 'Discussion' : segType === 'jam' ? 'Jam' : 'Segment');

    var bar = document.getElementById('rhTransportBar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'rhTransportBar';
        bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:4500;background:#1e293b;border-top:1px solid rgba(99,102,241,0.2);padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;font-family:inherit;box-shadow:0 -4px 20px rgba(0,0,0,0.4)';
        document.body.appendChild(bar);
    }
    bar.style.display = 'flex';

    // Add bottom padding to page so content isn't hidden behind transport
    var main = document.getElementById('rhMain');
    if (main) main.style.paddingBottom = '56px';

    var html = '';
    // Song title + loop indicator
    html += '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">';
    html += '<span style="font-size:0.78em;font-weight:600;color:var(--text)">' + escHtml(label) + '</span>';
    if (isLooping) html += ' <span style="font-size:0.6em;font-weight:700;color:#fbbf24;padding:1px 4px;border-radius:3px;background:rgba(245,158,11,0.1)">LOOP</span>';
    html += '</div>';
    // Time
    html += '<span id="rhTransportTime" style="font-size:0.68em;color:var(--text-dim);min-width:80px;text-align:center">' + _rhFmt(startSec) + ' / ' + _rhFmt(endSec) + '</span>';
    // Controls
    html += '<div style="display:flex;align-items:center;gap:4px">';
    html += '<button onclick="_rhSkip(-10)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.88em;padding:6px;min-width:32px;min-height:32px" title="Skip back 10 seconds">\u23EA</button>';
    html += '<button id="rhTransportPlayBtn" onclick="_rhTogglePause()" style="background:none;border:none;color:#818cf8;cursor:pointer;font-size:1.4em;padding:4px 8px;min-width:36px;min-height:36px">\u23F8</button>';
    html += '<button onclick="_rhSkip(10)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.88em;padding:6px;min-width:32px;min-height:32px" title="Skip ahead 10 seconds">\u23E9</button>';
    // Loop toggle
    html += '<button id="rhTransportLoopBtn" onclick="_rhToggleLoop()" style="background:none;border:none;color:' + (isLooping ? '#fbbf24' : '#475569') + ';cursor:pointer;font-size:0.88em;padding:6px;min-width:32px;min-height:32px" title="' + (isLooping ? 'Turn off repeat' : 'Repeat this section') + '">\uD83D\uDD01</button>';
    html += '<button onclick="_rhStopPlayback()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.88em;padding:6px;min-width:32px;min-height:32px" title="Stop playing">\u23F9</button>';
    html += '</div>';
    // Progress bar (click to seek)
    html += '<div id="rhTransportProgress" onclick="_rhSeekTransport(event)" style="position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.06);cursor:pointer">';
    html += '<div id="rhTransportFill" style="height:100%;width:0%;background:' + (isLooping ? '#fbbf24' : '#667eea') + ';border-radius:0 2px 2px 0;pointer-events:none"></div>';
    html += '</div>';

    bar.innerHTML = html;
}

// Toggle loop mode from transport bar
window._rhToggleLoop = function() {
    if (window._rhLoopActive) {
        // Turn off loop — convert to single play
        window._rhLoopActive = false;
        var loopBtn = document.getElementById('rhTransportLoopBtn');
        if (loopBtn) loopBtn.style.color = '#475569';
        var fill = document.getElementById('rhTransportFill');
        if (fill) fill.style.background = '#667eea';
        // Remove LOOP badge
        _rhShowTransport(_rhTransportStart, _rhTransportEnd, _rhTransportSessionId, _rhTransportSegIdx);
    } else {
        // Turn on loop
        window._rhLoopActive = true;
        var loopBtn2 = document.getElementById('rhTransportLoopBtn');
        if (loopBtn2) loopBtn2.style.color = '#fbbf24';
        var fill2 = document.getElementById('rhTransportFill');
        if (fill2) fill2.style.background = '#fbbf24';
        _rhShowTransport(_rhTransportStart, _rhTransportEnd, _rhTransportSessionId, _rhTransportSegIdx);
        if (typeof showToast === 'function') showToast('\uD83D\uDD01 Loop enabled');
    }
};

function _rhUpdateTransport() {
    if (!_rhSharedAudio) return;
    var timeEl = document.getElementById('rhTransportTime');
    var fillEl = document.getElementById('rhTransportFill');
    var playBtn = document.getElementById('rhTransportPlayBtn');
    if (timeEl) timeEl.textContent = _rhFmt(_rhSharedAudio.currentTime) + ' / ' + _rhFmt(_rhTransportEnd);
    if (fillEl) {
        var range = _rhTransportEnd - _rhTransportStart;
        var pct = range > 0 ? Math.min(100, ((_rhSharedAudio.currentTime - _rhTransportStart) / range) * 100) : 0;
        fillEl.style.width = pct + '%';
    }
    if (playBtn) playBtn.textContent = _rhSharedAudio.paused ? '\u25B6' : '\u23F8';
}

function _rhHideTransport() {
    var bar = document.getElementById('rhTransportBar');
    if (bar) bar.style.display = 'none';
    var main = document.getElementById('rhMain');
    if (main) main.style.paddingBottom = '';
}

// Click-to-seek on the transport progress bar
window._rhSeekTransport = function(e) {
    if (!_rhSharedAudio) return;
    var bar = document.getElementById('rhTransportProgress');
    if (!bar) return;
    var rect = bar.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    var range = _rhTransportEnd - _rhTransportStart;
    _rhSharedAudio.currentTime = _rhTransportStart + (pct * range);
    _rhUpdateTransport();
};

// ── Lightweight file loader for playback only (no analysis, no decoding) ─────
window._rhLoadRecordingForPlayback = async function(sessionId) {
    // Clear any previously cached Drive file (prevents playing wrong session's audio)
    window._rhDriveFileId = null;
    window._rhDriveToken = null;
    if (_rhSharedAudio) { _rhSharedAudio.src = ''; _rhSharedAudio.removeAttribute('src'); }
    _rhAudioSessionId = null;

    // Find session date to match the right Drive recording
    var _sessionDate = null;
    if (_rhSessionsCache) {
        var _s = _rhSessionsCache.find(function(s) { return s.sessionId === sessionId; });
        if (_s) _sessionDate = _s.date;
    }

    // Check if a Drive link is available for this session
    var driveUrl = null;
    if (typeof RehearsalMixdowns !== 'undefined' && RehearsalMixdowns.getDriveUrl) {
        driveUrl = await RehearsalMixdowns.getDriveUrl(_sessionDate);
    }

    if (driveUrl) {
        // Offer choice: stream from Drive or pick local file
        var existing = document.getElementById('rhAudioSourcePicker');
        if (existing) existing.remove();
        var picker = document.createElement('div');
        picker.id = 'rhAudioSourcePicker';
        picker.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px';
        picker.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:24px;max-width:340px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.5)">'
            + '<div style="font-size:0.95em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:4px">Load Recording</div>'
            + '<div style="font-size:0.75em;color:var(--text-dim);margin-bottom:16px">Choose how to load the rehearsal audio</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px">'
            + '<button id="rhPickDrive" style="padding:12px 16px;border-radius:10px;border:1px solid rgba(66,133,244,0.3);background:rgba(66,133,244,0.08);color:#60a5fa;cursor:pointer;text-align:left;font-family:inherit;width:100%">'
            + '<div style="font-weight:700;font-size:0.88em">\u2601\uFE0F Stream from Google Drive</div>'
            + '<div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">No download needed \u2014 plays directly</div></button>'
            + '<button id="rhPickFile" style="padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:var(--text-dim);cursor:pointer;text-align:left;font-family:inherit;width:100%">'
            + '<div style="font-weight:700;font-size:0.88em">\uD83D\uDCC1 Choose local file</div>'
            + '<div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">Pick from this device</div></button>'
            + '</div>'
            + '<button id="rhPickCancel" style="margin-top:12px;width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-size:0.78em;font-family:inherit">Cancel</button>'
            + '</div>';
        document.body.appendChild(picker);

        document.getElementById('rhPickDrive').onclick = function() {
            picker.remove();
            _rhStreamFromDrive(driveUrl, sessionId);
        };
        document.getElementById('rhPickFile').onclick = function() {
            picker.remove();
            _rhPickLocalFile(sessionId);
        };
        document.getElementById('rhPickCancel').onclick = function() { picker.remove(); };
        picker.onclick = function(e) { if (e.target === picker) picker.remove(); };
    } else {
        _rhPickLocalFile(sessionId);
    }
};

// Stream rehearsal audio from Google Drive via Worker proxy
function _rhStreamFromDrive(driveUrl, sessionId) {
    if (typeof showToast === 'function') showToast('Loading from Google Drive\u2026');

    var workerBase = (typeof WORKER_BASE !== 'undefined') ? WORKER_BASE
        : (typeof window.WORKER_BASE !== 'undefined') ? window.WORKER_BASE
        : 'https://groovelinx-worker.drewmerrill.workers.dev';

    // Check if token has Drive scope
    var _hasDriveScope = false;
    if (typeof window._grantedScopes === 'string') {
        _hasDriveScope = window._grantedScopes.indexOf('drive') !== -1;
    }

    // If no Drive scope, request it directly before streaming
    if (!_hasDriveScope && typeof tokenClient !== 'undefined' && tokenClient) {
        if (typeof showToast === 'function') showToast('Requesting Drive access\u2026');
        // Request token with consent to get Drive scope
        try {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch(e) {}
        // Poll for new token with Drive scope (up to 30s)
        var _pollCount2 = 0;
        var _pollTimer2 = setInterval(function() {
            _pollCount2++;
            if (_pollCount2 >= 60) { clearInterval(_pollTimer2); if (typeof showToast === 'function') showToast('\u26A0 Drive access not granted', 3000); return; }
            if (typeof window._grantedScopes === 'string' && window._grantedScopes.indexOf('drive') !== -1) {
                clearInterval(_pollTimer2);
                _rhDoStreamFromDrive(workerBase, driveUrl, sessionId);
            }
        }, 500);
        return;
    }

    _rhDoStreamFromDrive(workerBase, driveUrl, sessionId);
}

function _rhDoStreamFromDrive(workerBase, driveUrl, sessionId) {
    if (typeof showToast === 'function') showToast('Loading from Google Drive\u2026');

    // Extract file ID from Drive URL
    var _fileId = null;
    var _m = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (_m) _fileId = _m[1];
    if (!_fileId) { _m = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (_m) _fileId = _m[1]; }

    if (!_fileId) {
        if (typeof showToast === 'function') showToast('\u26A0 Could not extract file ID from Drive link', 5000);
        return;
    }

    // Store the Drive file ID + token so _rhPlaySegment can fetch individual segments
    // on demand. We do NOT download the whole file (200-400MB crashes iPad).
    var _token = (typeof accessToken !== 'undefined') ? accessToken : null;
    if (_token) {
        window._rhDriveFileId = _fileId;
        window._rhDriveToken = _token;
        // Mark audio as available so play buttons enable, but don't load anything yet
        _rhAudioSessionId = sessionId;
        console.log('[Drive] Drive playback configured:', _fileId.substring(0, 10) + '...');
        if (typeof showToast === 'function') showToast('Recording ready \u2014 tap play on any song');
        // Re-render the session the user was actually viewing (not always the latest)
        if (_rhViewingSessionId) {
            _rhShowSessionReport(_rhViewingSessionId);
        } else {
            _rhRenderLastRehearsalTimeline();
        }
    } else {
        _rhDoStreamViaWorker(workerBase, driveUrl, null, sessionId);
    }
}

// ── Bug #10a 2026-05-17: Drive Picker re-link affordance ────────────────────
// When a rehearsal session's recording_url points to a Drive file ID that the
// current OAuth token can't see (drive.file scope = per-file Picker grant),
// playback bricks with `404 File not found` from the Drive API behind the
// Worker proxy. The toast at line 3751 used to direct users to "Recordings →
// Re-link" but that surface only exists for Mixdowns; sessions created via
// `_rhRecreateFromRecording` had no such affordance. These two helpers add a
// modal prompt + Drive Picker re-link flow scoped to rehearsal sessions.
function _rhPromptDriveRelink(sessionId) {
    if (window._rhRelinkPromptOpen) return;
    window._rhRelinkPromptOpen = true;

    var overlay = document.createElement('div');
    overlay.id = 'rhRelinkPrompt';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:24px;max-width:380px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.5)">'
        + '<div style="font-size:0.95em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:8px">Re-link Drive recording</div>'
        + '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:16px;line-height:1.45">Drive can’t see this file under the app’s current scope. This happens when the recording was uploaded to Drive outside GrooveLinx. Pick the same file again via Drive Picker to grant access — the URL on this session will update automatically.</div>'
        + '<div style="display:flex;gap:8px">'
        + '<button id="rhRelinkPick" style="flex:1;padding:10px 14px;border-radius:8px;border:1px solid rgba(66,133,244,0.3);background:rgba(66,133,244,0.08);color:#60a5fa;cursor:pointer;font-family:inherit;font-weight:600">🔗 Re-link from Drive</button>'
        + '<button id="rhRelinkCancel" style="padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);cursor:pointer;font-family:inherit">Cancel</button>'
        + '</div></div>';
    document.body.appendChild(overlay);

    var close = function () {
        try { overlay.remove(); } catch (e) {}
        window._rhRelinkPromptOpen = false;
    };
    document.getElementById('rhRelinkPick').onclick = function () { close(); _rhRelinkFromDrivePicker(sessionId); };
    document.getElementById('rhRelinkCancel').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
}

function _rhRelinkFromDrivePicker(sessionId) {
    if (!window.GLDrivePicker || !window.GLDrivePicker.pickAudio) {
        if (typeof showToast === 'function') showToast('⚠ Drive Picker not available');
        return;
    }
    window.GLDrivePicker.pickAudio({
        onPick: async function (doc) {
            // Persist the new Drive URL on the session record so future
            // session loads use a file ID the token can actually see. The
            // Picker association is per-token; if Drew picks the SAME file ID,
            // the token gains consent for it and the URL value is unchanged
            // (but the update is harmless). If he picks a different upload
            // (e.g. a re-uploaded copy), the new file ID propagates.
            //
            // Bug 2026-05-17 (Drew session): the original write was
            // fire-and-forget. If Firebase rejected (security rules) or the
            // network dropped, the next session load returned the OLD
            // recording_url and the user had to re-link every reload. Now
            // awaited with error surfaced; also stamp recording_id=null so the
            // stale Recording row's audio_url doesn't get re-resolved into
            // the session at next load.
            var persisted = false;
            try {
                var db = (typeof firebaseDB !== 'undefined') ? firebaseDB : (window.firebaseDB || null);
                if (db && typeof bandPath === 'function') {
                    await db.ref(bandPath('rehearsal_sessions/' + sessionId)).update({
                        recording_url: doc.url,
                        recording_id: null
                    });
                    persisted = true;
                    console.log('[Re-link] Persisted new recording_url to rehearsal_sessions/' + sessionId);
                } else {
                    console.warn('[Re-link] firebaseDB or bandPath not available; new URL NOT persisted to Firebase');
                }
            } catch (e) {
                console.warn('[Re-link] Failed to update session recording_url:', e && e.message);
                if (typeof showToast === 'function') showToast('⚠ Re-link saved in-session but did NOT persist to Firebase: ' + (e && e.message || 'unknown'), 6000);
            }
            // Reset shared-audio + playback state so the next click on a take
            // row rebuilds the Worker URL with the new file ID.
            var a = window._rhSharedAudio;
            if (a) {
                try { a.pause(); } catch (e) {}
                a.src = '';
                a.removeAttribute('src');
                try { a.currentTime = 0; } catch (e) {}
            }
            window._rhAudioSessionId = null;
            try { _rhClearPlayState(); } catch (e) {}
            try { GLRecordings && GLRecordings.clearResolveCache && GLRecordings.clearResolveCache(); } catch (e) {}
            if (typeof showToast === 'function') showToast('Re-linked' + (persisted ? ' (saved)' : '') + ' — tap play on any segment', 4000);
            _rhStreamFromDrive(doc.url, sessionId);
        },
        onCancel: function () {},
        onError: function (e) {
            console.warn('[Re-link] Picker error:', e);
            if (typeof showToast === 'function') showToast('⚠ Drive Picker failed to open');
        }
    });
}

function _rhDoStreamViaWorker(workerBase, driveUrl, token, sessionId) {
    var _drivePayload = { driveUrl: driveUrl };
    if (token) _drivePayload.accessToken = token;

    fetch(workerBase + '/drive-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_drivePayload)
    }).then(function(res) {
        if (!res.ok) {
            return res.json().catch(function() { return {}; }).then(function(d) {
                var msg = d.error || 'Drive fetch failed: ' + res.status;
                if (d.hint) msg += '\n' + d.hint;
                if (d.detail) console.warn('[Drive] Worker API detail:', d.detail);
                throw new Error(msg);
            });
        }
        return res.blob();
    }).then(function(blob) {
        var blobUrl = URL.createObjectURL(blob);
        _rhSetupPlaybackAudio(blobUrl, sessionId);
        if (typeof showToast === 'function') showToast('Recording loaded from Drive \u2014 playback ready (' + Math.round(blob.size / 1024 / 1024) + ' MB)');
        if (_rhViewingSessionId) _rhShowSessionReport(_rhViewingSessionId); else _rhRenderLastRehearsalTimeline();
    }).catch(function(err) {
        if (typeof showToast === 'function') showToast('\u26A0 Could not load from Drive: ' + err.message, 5000);
    });
}

// Pick a local file for playback
function _rhPickLocalFile(sessionId) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = function() {
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        var blobUrl = URL.createObjectURL(file);
        _rhSetupPlaybackAudio(blobUrl, sessionId);
        if (typeof showToast === 'function') showToast('Recording loaded \u2014 playback ready (' + Math.round(file.size / 1024 / 1024) + ' MB)');
        if (_rhViewingSessionId) _rhShowSessionReport(_rhViewingSessionId); else _rhRenderLastRehearsalTimeline();
    };
    input.click();
}

// Shared: set up the audio element for timeline playback
function _rhSetupPlaybackAudio(blobUrl, sessionId) {
    if (typeof RecordingAnalyzer !== 'undefined') {
        RecordingAnalyzer._loadedPlaybackUrl = blobUrl;
    }
    if (!_rhSharedAudio) {
        _rhSharedAudio = document.createElement('audio');
        _rhSharedAudio.id = 'rhTimelineAudio';
        _rhSharedAudio.style.display = 'none';
        _rhSharedAudio.preload = 'none';
        document.body.appendChild(_rhSharedAudio);
    }
    _rhSharedAudio.src = blobUrl;
    _rhSharedAudio.preload = 'none';
    _rhAudioSessionId = sessionId;
}

// ── Loop segment (plays repeatedly until stopped) ────────────────────────────
window._rhLoopSegment = function(startSec, endSec, sessionId, segIdx) {
    // Toggle off if already looping
    if (window._rhLoopActive && _rhSharedAudio && !_rhSharedAudio.paused) {
        window._rhLoopActive = false;
        _rhSharedAudio.pause();
        _rhClearPlayState();
        if (typeof showToast === 'function') showToast('Loop stopped');
        return;
    }

    if (!_rhEnsureAudio(sessionId)) return;
    var audio = _rhSharedAudio;

    // Clear previous state
    _rhClearPlayState();

    window._rhLoopActive = true;
    _rhPlayingSegIdx = segIdx;
    _rhPlayingEndSec = endSec;

    if (segIdx !== undefined) {
        var row = document.getElementById('rhSeg_' + segIdx);
        if (row) row.classList.add('rh-playing');
    }
    if (typeof showToast === 'function') showToast('\uD83D\uDD01 Looping ' + _rhFmt(startSec) + '\u2013' + _rhFmt(endSec), 3000);

    audio.currentTime = startSec;
    audio.play();

    // Show transport bar
    _rhShowTransport(startSec, endSec, sessionId, segIdx);

    _rhTimeUpdateFn = function() {
        _rhUpdateTransport();
        if (!window._rhLoopActive) { audio.removeEventListener('timeupdate', _rhTimeUpdateFn); _rhTimeUpdateFn = null; return; }
        if (audio.currentTime >= endSec) { audio.currentTime = startSec; }
    };
    audio.addEventListener('timeupdate', _rhTimeUpdateFn);
};

// ── Compare attempts side-by-side ────────────────────────────────────────────
// ── Inline Compare (data-driven, no modal, no DOM scraping) ──────────────────
window._rhCompareAttempts = function(songTitle) {
    // Find the inline compare container in the timeline
    var containerId = 'rhCompare_' + songTitle.replace(/[^a-zA-Z0-9]/g, '_');
    var existing = document.getElementById(containerId);
    if (existing) {
        // Toggle off
        existing.remove();
        return;
    }

    // Find the first segment row for this song to insert after
    var anchor = document.querySelector('[data-song="' + songTitle.replace(/"/g, '') + '"]');
    if (!anchor) { if (typeof showToast === 'function') showToast('Song not found in timeline'); return; }

    // Get segment data from GLStore (no dependency on render order)
    var _tl = (typeof GLStore !== 'undefined' && GLStore.getCurrentTimeline) ? GLStore.getCurrentTimeline() : {};
    var _cachedData = _tl.data;
    if (!_cachedData || !_cachedData.songGroups || !_cachedData.songGroups[songTitle]) {
        if (typeof showToast === 'function') showToast('No compare data — open a timeline first');
        return;
    }
    var group = _cachedData.songGroups[songTitle];
    if (group.segments.length < 2) { if (typeof showToast === 'function') showToast('Only one attempt found'); return; }

    var hasAudio = _rhHasAudio();
    var sessionId = _tl.sessionId || '';
    var _abtn = 'padding:3px 8px;border-radius:4px;cursor:pointer;font-size:0.82em;font-family:inherit;';

    // Build inline compare panel
    var panel = document.createElement('div');
    panel.id = containerId;
    panel.style.cssText = 'margin:4px 0 8px;padding:10px 12px;border-radius:8px;border:1px solid rgba(16,185,129,0.15);background:rgba(16,185,129,0.03);animation:fadeIn 0.15s ease';

    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:0.75em;font-weight:800;color:#10b981">' + escHtml(songTitle) + ' \u2014 ' + group.segments.length + ' Takes</div>';
    html += '<button onclick="document.getElementById(\'' + containerId + '\').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.85em">\u2715</button>';
    html += '</div>';

    // Identify best attempt (highest qualityScore, then longest duration as tiebreak)
    var bestIdx = 0;
    var bestScore = -1;
    group.segments.forEach(function(seg, idx) {
        var score = (seg.qualityScore || 0) * 100 + (seg.groove ? seg.groove.stability || 0 : 0);
        if (score > bestScore || (score === bestScore && (seg.duration || 0) > (group.segments[bestIdx].duration || 0))) {
            bestScore = score;
            bestIdx = idx;
        }
    });

    // Render each attempt with real data + deltas + best highlight
    group.segments.forEach(function(seg, idx) {
        var durLabel = seg.duration >= 60 ? Math.round(seg.duration / 60) + 'm' : Math.round(seg.duration) + 's';
        var grooveColor = seg.groove ? (seg.groove.stability >= 80 ? '#10b981' : seg.groove.stability >= 50 ? '#f59e0b' : '#ef4444') : '#64748b';
        var qualColor = (seg.qualityScore >= 3) ? '#10b981' : (seg.qualityScore >= 2) ? '#f59e0b' : '#64748b';
        var isBest = idx === bestIdx && group.segments.length > 1;

        html += '<div class="' + (isBest ? 'rh-compare-best' : '') + '" style="padding:6px 8px;margin-bottom:4px;border-radius:6px;background:rgba(255,255,255,0.02);border-left:3px solid ' + grooveColor + '">';
        // Header row: take label + best badge + time
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span style="font-size:0.78em;font-weight:700;color:var(--text)">Take ' + (idx + 1) + '</span>';
        if (isBest) html += '<span style="font-size:0.58em;font-weight:700;color:#10b981;padding:1px 5px;border-radius:3px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2)">Best take</span>';
        html += '<span style="font-size:0.65em;color:var(--text-dim)">' + _rhFmt(seg.startSec) + '\u2013' + _rhFmt(seg.endSec) + ' \u00B7 ' + durLabel + '</span>';
        // Action buttons — inline on desktop, wrap on mobile
        if (hasAudio) {
            html += '<span style="margin-left:auto;display:flex;gap:3px;flex-shrink:0">';
            html += '<button onclick="_rhPlaySegment(' + seg.startSec + ',' + seg.endSec + ',\'' + escHtml(sessionId) + '\')" style="' + _abtn + 'border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#818cf8">\u25B6</button>';
            html += '<button onclick="_rhLoopSegment(' + seg.startSec + ',' + seg.endSec + ',\'' + escHtml(sessionId) + '\')" style="' + _abtn + 'border:1px solid rgba(245,158,11,0.2);background:rgba(245,158,11,0.04);color:#fbbf24">\uD83D\uDD01</button>';
            html += '</span>';
        }
        html += '</div>';
        // Quality + groove + delta indicators
        html += '<div style="display:flex;gap:8px;font-size:0.65em;margin-top:3px;align-items:center;flex-wrap:wrap">';
        if (seg.qualityLabel) html += '<span style="color:' + qualColor + '">' + escHtml(seg.qualityLabel) + '</span>';
        if (seg.groove && seg.groove.label) html += '<span style="color:' + grooveColor + '">' + escHtml(seg.groove.label) + '</span>';
        // Delta vs previous attempt
        if (idx > 0) {
            var prev = group.segments[idx - 1];
            var qDelta = (seg.qualityScore || 0) - (prev.qualityScore || 0);
            var gDelta = (seg.groove ? seg.groove.stability : 0) - (prev.groove ? prev.groove.stability : 0);
            if (qDelta !== 0) {
                var dLabel = qDelta > 0 ? '\u2191 better' : '\u2193 weaker';
                var dColor = qDelta > 0 ? '#10b981' : '#f59e0b';
                html += '<span style="color:' + dColor + ';font-weight:600">' + dLabel + '</span>';
            }
            if (gDelta !== 0 && seg.groove && prev.groove) {
                var gLabel = gDelta > 0 ? '\u2191 tighter' : '\u2193 looser';
                var gCol = gDelta > 0 ? '#10b981' : '#f59e0b';
                html += '<span style="color:' + gCol + '">' + gLabel + '</span>';
            }
        }
        html += '</div>';
        html += '</div>';
    });

    // Trend + "why" explanation
    var first = group.segments[0];
    var last = group.segments[group.segments.length - 1];
    var trendHtml = '';
    if (first.qualityScore !== undefined && last.qualityScore !== undefined) {
        var delta = last.qualityScore - first.qualityScore;
        var trendIcon = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2192';
        var trendColor = delta > 0 ? '#10b981' : delta < 0 ? '#f59e0b' : '#94a3b8';
        // Build "why" explanation from data
        var reasons = [];
        if (delta > 0) {
            if (last.duration > first.duration * 1.2) reasons.push('got further through the song');
            if (last.groove && first.groove && last.groove.stability > first.groove.stability) reasons.push('timing got tighter');
            if (!reasons.length) reasons.push('sounded better overall');
        } else if (delta < 0) {
            if (last.duration < first.duration * 0.7) reasons.push('stopped earlier');
            if (last.groove && first.groove && last.groove.stability < first.groove.stability) reasons.push('timing got looser');
            if (!reasons.length) reasons.push('quality dropped off');
        } else {
            reasons.push('stayed about the same');
        }
        var trendLabel = delta > 0 ? 'Getting better' : delta < 0 ? 'Needs more work' : 'Consistent';
        trendHtml = '<div style="text-align:center;font-size:0.72em;padding:4px 8px;margin-top:2px;border-radius:4px;background:' + trendColor + '08">'
            + '<span style="font-weight:700;color:' + trendColor + '">' + trendIcon + ' ' + trendLabel + '</span>'
            + '<span style="color:var(--text-dim)"> \u2014 ' + reasons.join(', ') + '</span>'
            + '</div>';
    }
    html += trendHtml;

    // Compare BPM overlay chart (if groove IOIs available for 2+ takes)
    var _cmpTargetBPM = _rhGetSongBPM(songTitle);
    if (_cmpTargetBPM && typeof PocketMeterTimeSeries !== 'undefined') {
        var compareSeries = [];
        var compareColors = ['#667eea', '#f59e0b', '#10b981', '#ef4444'];
        group.segments.forEach(function(seg, idx) {
            if (seg.groove && seg.groove.iois && seg.groove.iois.length >= 8) {
                var ts = PocketMeterTimeSeries.compute(seg.groove, seg.startSec, _cmpTargetBPM);
                if (ts && ts.points.length >= 3) {
                    compareSeries.push({ ts: ts, label: 'Take ' + (idx + 1), color: compareColors[idx % compareColors.length] });
                }
            }
        });
        if (compareSeries.length >= 2) {
            html += '<div style="margin-top:6px;border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.04)">';
            html += '<div style="padding:4px 8px;font-size:0.62em;font-weight:700;color:var(--text-dim)">Tempo Comparison</div>';
            html += PocketMeterTimeSeries.renderCompareSVG(compareSeries, 300, 100);
            // Best take + improvement metrics
            var bestTake = compareSeries.reduce(function(best, s, i) { return s.ts.variance < best.v ? { i: i, v: s.ts.variance } : best; }, { i: 0, v: 999 });
            html += '<div style="padding:3px 8px;font-size:0.58em;color:#10b981;text-align:center">';
            html += 'Take ' + (bestTake.i + 1) + ' was tightest \u2014 ' + compareSeries[bestTake.i].ts.stabilityLabel + ' (\u00B1' + compareSeries[bestTake.i].ts.variance + ' BPM)';
            html += '</div>';
            // Improvement from first to last take — human labels first, numbers second
            var firstTs = compareSeries[0].ts;
            var lastTs = compareSeries[compareSeries.length - 1].ts;
            if (compareSeries.length >= 2 && firstTs.variance > 0) {
                var improvPct = Math.round(((firstTs.variance - lastTs.variance) / firstTs.variance) * 100);
                var driftFrom = firstTs.variance;
                var driftTo = lastTs.variance;
                var improvLabel = '';
                var improvColor = '';
                if (improvPct >= 30) { improvLabel = 'Big improvement'; improvColor = '#10b981'; }
                else if (improvPct >= 10) { improvLabel = 'Tighter'; improvColor = '#22c55e'; }
                else if (improvPct > 0) { improvLabel = 'Slight improvement'; improvColor = '#84cc16'; }
                else if (improvPct > -10) { improvLabel = 'About the same'; improvColor = '#94a3b8'; }
                else { improvLabel = 'Got looser'; improvColor = '#f59e0b'; }

                html += '<div style="padding:0 8px 5px;font-size:0.58em;text-align:center">';
                html += '<span style="color:' + improvColor + ';font-weight:600">' + improvLabel + '</span>';
                html += '<span style="color:var(--text-dim)"> \u00B7 drift \u00B1' + driftFrom + ' \u2192 \u00B1' + driftTo + ' BPM</span>';
                html += '</div>';
            }
            html += '</div>';
        }
    }

    panel.innerHTML = html;

    // Insert after the last segment row for this song
    var allSongSegs = document.querySelectorAll('[data-song="' + songTitle.replace(/"/g, '') + '"]');
    var lastSeg = allSongSegs[allSongSegs.length - 1];
    if (lastSeg && lastSeg.nextSibling) {
        lastSeg.parentNode.insertBefore(panel, lastSeg.nextSibling);
    } else if (lastSeg) {
        lastSeg.parentNode.appendChild(panel);
    } else {
        anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    }
};

// ── View Session Timeline (replaces old modal report — loads session and renders inline timeline) ──
window._rhShowSessionReport = async function(sessionId) {
    // Load session from Firebase — C2 Phase 1: prefer RehearsalSession.loadById.
    var s = null;
    try {
        var _rsLoadById = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadById);
        if (_rsLoadById) {
            s = await GLStore.RehearsalSession.loadById(sessionId);
        } else if (typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
            var snap = await firebaseDB.ref(bandPath('rehearsal_sessions/' + sessionId)).once('value');
            s = snap.val();
            if (s) s.sessionId = sessionId;
        }
    } catch(e) {}
    if (!s) {
        var sessions = await _rhLoadSessions();
        s = sessions.find(function(x) { return x.sessionId === sessionId; });
    }
    if (!s) { if (typeof showToast === 'function') showToast('Session not found'); return; }

    var _toArr = function(v) { if (!v) return []; if (Array.isArray(v)) return v; if (typeof v === 'object') return Object.values(v); return []; };
    var segments = _toArr(s.audio_segments);

    // Track which session is being viewed (so audio load doesn't jump away)
    _rhViewingSessionId = sessionId;

    // Render into the main timeline section
    var timelineEl = document.getElementById('rhTimelineSection');
    if (!timelineEl) return;

    // Scorecard + Song Outcomes (rendered above timeline)
    var _scHtml = _rhBuildScorecardAndOutcomes(s, segments);
    if (_scHtml) {
        var _scDiv = document.createElement('div');
        _scDiv.innerHTML = _scHtml;
        timelineEl.innerHTML = '';
        timelineEl.appendChild(_scDiv);
    }

    if (segments.length > 0) {
        _rhRenderInlineTimelineDirectly(timelineEl, sessionId, s, segments);
        timelineEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        // No segments — offer to analyze
        timelineEl.innerHTML = '<div style="padding:16px;text-align:center;border-radius:10px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">'
            + '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:8px">No recording analysis for this session yet.</div>'
            + '<button onclick="if(typeof RecordingAnalyzer!==\'undefined\')RecordingAnalyzer.launchForSession(\'' + escHtml(sessionId) + '\')" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#818cf8;cursor:pointer;font-size:0.82em">\uD83D\uDD0D Analyze Recording</button>'
            + '</div>';
        timelineEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Phase 3A: Lightweight Analyzer Review Surface — renders canonical Takes
    // (when GLTakes has any for this rehearsal) as a compact review list under
    // the legacy timeline. Bails silently when no takes exist so legacy flows
    // are untouched. Best-effort only: failures here never block the report.
    try { _rhRenderTonightProgress(timelineEl, sessionId, s); } catch (e) { console.warn('[TonightProgress] render failed:', e && e.message); }
    try { _rhRenderTakeReview(timelineEl, sessionId, s); } catch (e) { console.warn('[TakeReview] render failed:', e && e.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3A — Lightweight Analyzer Review Surface
//
// Renders canonical Takes (from GLTakes.getTakesForRehearsal) below the legacy
// timeline in _rhShowSessionReport. Surfaces analyzer truthfulness without
// becoming a DAW: confidence chip, boundary chip, top-3 suggestions, quick
// play, quick correct. Spotify-row feel, not Pro Tools.
//
// Inputs:
//   container — the timeline mount (#rhTimelineSection) to append into
//   sessionId — rehearsal_sessions/{sessionId}
//   session   — already-loaded session object (for recording_url lookup)
//
// Rules:
//   - No takes -> render nothing (legacy timeline above is enough).
//   - No persistent recording URL -> render the list, disable play buttons,
//     surface the no-audio reason in the card header.
//   - Blob URLs are session-scoped; treat as missing for past sessions.
//
// Constraints (per Phase 3A spec):
//   - No waveform UI, no draggable regions, no DAW transport, no realtime.
//   - Reuse existing playback pattern (audio.currentTime + timeupdate stop).
//   - Mobile-safe: rows wrap, touch targets >= 32px, no fixed-width tables.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// Tonight's Progress — Lightweight Rehearsal Closure (2026-05-15).
//
// Small reflective card mounted inside _rhShowSessionReport above the
// Take Review surface. Surfaces four optional sections:
//
//   ✓ Tightened tonight     — songs whose confidence jumped ≥0.15 vs
//                             the prior session
//   🔥 Best take of the night — single song with the peak avg confidence
//                              in THIS session (≥0.7)
//   📝 Newly resolved        — annotations that flipped to 'fixed'
//                             between the prior session's date and this
//                             session's date
//   ⚠ Still needs work      — open annotations whose oldest predates
//                             this session (carry-forward awareness)
//
// Sections render only when non-empty. The whole card renders nothing
// when no section has content. Plain text + emoji — no chips, no buttons,
// no scorecards. Spec rule: "musical and reflective, NOT corporate
// reporting."
//
// Data sources: existing _rhSessionsCache + GLAnnotations.listByAnchor({}).
// No extra Firebase round-trip; reuses the cache that Take Review already
// warmed (Phase 3A).
// ─────────────────────────────────────────────────────────────────────────
async function _rhRenderTonightProgress(container, sessionId, session) {
    if (!container || !sessionId || !session) return;

    // Remove any prior render for this session to keep the card idempotent.
    var existing = document.getElementById('rhTonightProgress_' + sessionId);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    // Locate this session in the cache so we can identify the prior session
    // and bound the resolve-window correctly.
    var sessions = Array.isArray(_rhSessionsCache) ? _rhSessionsCache : [];
    var thisIdx = -1;
    for (var i = 0; i < sessions.length; i++) {
        if (sessions[i] && sessions[i].sessionId === sessionId) { thisIdx = i; break; }
    }
    if (thisIdx === -1) return; // session not in cache — can't bound the window

    var thisSession = sessions[thisIdx];
    var priorSession = (thisIdx + 1 < sessions.length) ? sessions[thisIdx + 1] : null;

    function _confsBySong(audioSegs) {
        var out = {};
        var arr = Array.isArray(audioSegs) ? audioSegs : (audioSegs ? Object.values(audioSegs) : []);
        var byTitle = {};
        arr.forEach(function (s) {
            if (!s || !s.songTitle || typeof s.confidence !== 'number') return;
            var t = s.type || s.segType || 'song';
            if (t === 'talking' || t === 'speech' || t === 'discussion' || t === 'false_start' || t === 'ignore') return;
            if (!byTitle[s.songTitle]) byTitle[s.songTitle] = [];
            byTitle[s.songTitle].push(s.confidence);
        });
        Object.keys(byTitle).forEach(function (title) {
            var conf = byTitle[title];
            out[title] = conf.reduce(function (a, b) { return a + b; }, 0) / conf.length;
        });
        return out;
    }

    var thisConfs = _confsBySong(thisSession.audio_segments);
    var priorConfs = priorSession ? _confsBySong(priorSession.audio_segments) : {};

    // ── Tightened tonight ───────────────────────────────────────────────
    // Same delta rule as the Living Set Sheet's "Tightened significantly"
    // signal so per-row signals and the closure card agree.
    var tightened = [];
    Object.keys(thisConfs).forEach(function (title) {
        var cur = thisConfs[title];
        var prev = priorConfs[title];
        if (typeof prev === 'number' && (cur - prev) >= 0.15 && cur >= 0.6) {
            tightened.push({ title: title, deltaPct: Math.round((cur - prev) * 100) });
        }
    });
    tightened.sort(function (a, b) { return b.deltaPct - a.deltaPct; });

    // ── Best take of the night ──────────────────────────────────────────
    var bestTitle = null, bestConf = 0;
    Object.keys(thisConfs).forEach(function (title) {
        if (thisConfs[title] >= 0.7 && thisConfs[title] > bestConf) {
            bestConf = thisConfs[title];
            bestTitle = title;
        }
    });

    // ── Annotation window scan (newly resolved + still needs work) ─────
    var newlyResolved = []; // [{ title, count }]
    var stillRough = [];    // [{ title, count }]

    if (window.GLAnnotations && window.GLAnnotations.listAnnotationsByAnchor) {
        try {
            var allAnns = await window.GLAnnotations.listAnnotationsByAnchor({}, { includeArchived: false });

            // Window for "newly resolved" — between the prior session date
            // (or 0 if there is no prior session) and the END of this session's
            // date. Annotations whose `updated_at` falls in that window AND
            // whose status is 'fixed' count as resolved tonight.
            var windowStart = priorSession && priorSession.date
                ? new Date(priorSession.date + 'T23:59:59').getTime()
                : 0;
            var windowEnd = thisSession.date
                ? new Date(thisSession.date + 'T23:59:59').getTime()
                : Date.now();

            var resolvedByTitle = {};
            var openByTitle = {};
            (allAnns || []).forEach(function (a) {
                if (!a) return;
                var key = a.anchor && a.anchor.song_id;
                if (!key) return;
                if (a.status === 'fixed') {
                    if (typeof a.updated_at === 'number' && a.updated_at > windowStart && a.updated_at <= windowEnd) {
                        resolvedByTitle[key] = (resolvedByTitle[key] || 0) + 1;
                    }
                } else {
                    // Open AT the time of this session — created on or before
                    // this session's date so it's not a brand-new note from
                    // afterward.
                    if (typeof a.created_at === 'number' && a.created_at <= windowEnd) {
                        openByTitle[key] = (openByTitle[key] || 0) + 1;
                    }
                }
            });

            Object.keys(resolvedByTitle).forEach(function (t) {
                newlyResolved.push({ title: t, count: resolvedByTitle[t] });
            });
            Object.keys(openByTitle).forEach(function (t) {
                stillRough.push({ title: t, count: openByTitle[t] });
            });
        } catch (e) {}
    }

    // Cap section lengths to keep the card scannable. Hidden remainder is
    // accessible via Song Detail / Take Review below.
    var CAP = 4;
    var hasContent = tightened.length || bestTitle || newlyResolved.length || stillRough.length;
    if (!hasContent) return;

    var html = '';
    html += '<div style="font-size:0.85em;font-weight:700;color:var(--gl-text);margin-bottom:10px;display:flex;align-items:center;gap:6px">';
    html += '<span style="font-size:1em">✨</span>';
    html += '<span>Tonight’s progress</span>';
    html += '</div>';

    function _bulletList(items, renderItem) {
        var capped = items.slice(0, CAP);
        var more = items.length - capped.length;
        var rows = capped.map(function (i) {
            return '<div style="font-size:0.74em;color:var(--gl-text-tertiary);line-height:1.45;padding:1px 0">· ' + renderItem(i) + '</div>';
        }).join('');
        if (more > 0) rows += '<div style="font-size:0.66em;color:var(--text-dim);padding:1px 0;font-style:italic">…and ' + more + ' more</div>';
        return rows;
    }

    function _section(label, color, body) {
        return '<div style="margin-bottom:10px">'
            + '<div style="font-size:0.7em;font-weight:700;color:' + color + ';letter-spacing:0.04em;margin-bottom:3px">' + label + '</div>'
            + body
            + '</div>';
    }

    if (tightened.length) {
        html += _section('✓ TIGHTENED TONIGHT', '#22c55e',
            _bulletList(tightened, function (i) {
                return escHtml(i.title) + ' <span style="color:#86efac">+' + i.deltaPct + '%</span>';
            }));
    }

    if (bestTitle) {
        html += _section('🔥 BEST TAKE OF THE NIGHT', '#fbbf24',
            '<div style="font-size:0.78em;color:var(--gl-text);line-height:1.4;padding:1px 0">' + escHtml(bestTitle) + '</div>');
    }

    if (newlyResolved.length) {
        html += _section('📝 NEWLY RESOLVED', '#a78bfa',
            _bulletList(newlyResolved, function (i) {
                return escHtml(i.title) + ' <span style="color:var(--text-dim)">· ' + i.count + ' note' + (i.count > 1 ? 's' : '') + ' closed</span>';
            }));
    }

    if (stillRough.length) {
        html += _section('⚠ STILL NEEDS WORK', '#f97316',
            _bulletList(stillRough, function (i) {
                return escHtml(i.title) + ' <span style="color:var(--text-dim)">· ' + i.count + ' open note' + (i.count > 1 ? 's' : '') + '</span>';
            }));
    }

    var card = document.createElement('div');
    card.id = 'rhTonightProgress_' + sessionId;
    card.style.cssText = 'margin-top:14px;padding:14px 16px;border-radius:12px;border:1px solid rgba(167,139,250,0.18);background:linear-gradient(135deg,rgba(99,102,241,0.05),rgba(167,139,250,0.04))';
    card.innerHTML = html;
    container.appendChild(card);
}

async function _rhRenderTakeReview(container, sessionId, session) {
    if (!container || !sessionId) return;
    if (typeof window.GLTakes === 'undefined' || !window.GLTakes.getTakesForRehearsal) return;

    var existing = document.getElementById('rhTakeReviewCard_' + sessionId);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var takes = [];
    try {
        takes = await window.GLTakes.getTakesForRehearsal(sessionId, { refresh: true });
    } catch (e) {
        console.warn('[TakeReview] load failed:', e && e.message);
        return;
    }
    if (!takes || !takes.length) return;

    // Phase 3C: audio source resolves through GLRecordings.resolvePlaybackSource,
    // which centralizes the priority order (recording_id → session.recording_url →
    // Mixdown by date → blob fallback) and opportunistically auto-creates a
    // canonical Recording so future resolves skip directly to Path 1. Closes
    // the Phase 3A Mixdown gap without breaking legacy session.recording_url.
    var audioUrl = '';
    var playbackResolution = null;
    if (typeof window.GLRecordings !== 'undefined' && window.GLRecordings.resolvePlaybackSource) {
        try {
            playbackResolution = await window.GLRecordings.resolvePlaybackSource(session || {});
            if (playbackResolution && playbackResolution.url && !playbackResolution.isBlob) {
                audioUrl = playbackResolution.url;
            }
        } catch (e) {
            console.warn('[TakeReview] playback resolve failed:', e && e.message);
        }
    } else {
        // Legacy fallback (cached-shell safety) — same shape as pre-3C.
        audioUrl = (session && session.recording_url) || '';
        if (audioUrl && audioUrl.indexOf('blob:') === 0) audioUrl = '';
    }

    // Phase 3B: calibration mode toggle. When on, GLObs surfaces appear inline
    // in this card. When off (default), the card stays Phase-3A-clean.
    var calMode = !!(window.GLObs && window.GLObs.isEnabled && window.GLObs.isEnabled());
    if (calMode && window.GLObs && window.GLObs.log) {
        window.GLObs.log('TakeReview', 'render', {
            sessionId: sessionId,
            takes: takes.length,
            audioUrl: audioUrl || '(none)'
        });
    }

    var card = document.createElement('div');
    card.id = 'rhTakeReviewCard_' + sessionId;
    card.style.cssText = 'margin-top:14px;padding:14px;border-radius:12px;border:1px solid rgba(99,102,241,0.16);background:rgba(99,102,241,0.04)';
    card.innerHTML = _rhTakeReviewHTML(takes, sessionId, audioUrl, session, calMode, playbackResolution);
    container.appendChild(card);

    var audioEl = document.getElementById('rhTakeReviewAudio_' + sessionId);
    if (audioEl && audioUrl) {
        audioEl.src = audioUrl;
    }

    // Phase 3E: hydrate the calibration banner benchmark panel asynchronously
    // so the synchronous Take Review render isn't blocked on Firebase reads.
    if (calMode && window._rhBenchHydrateBanner) {
        window._rhBenchHydrateBanner(sessionId);
    }
}

function _rhTakeReviewHTML(takes, sessionId, audioUrl, session, calMode, playbackResolution) {
    var counts = { human: 0, unresolved: 0, low: 0 };
    takes.forEach(function (t) {
        if (t.matching && t.matching.correction_source === 'human') counts.human++;
        if (!t.song_id && !t.song_title) counts.unresolved++;
        if (t.matching && t.matching.confidence === 'low') counts.low++;
    });

    var summary = takes.length + ' take' + (takes.length === 1 ? '' : 's');
    if (counts.unresolved) summary += ' · ' + counts.unresolved + ' unresolved';
    if (counts.low && counts.low !== counts.unresolved) summary += ' · ' + counts.low + ' low confidence';
    if (counts.human) summary += ' · ' + counts.human + ' corrected';

    var html = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;gap:8px;flex-wrap:wrap">'
        + '<div style="font-size:0.92em;font-weight:600">📝 Review takes</div>'
        + '<div style="font-size:0.7em;color:var(--text-dim)">' + escHtml(summary) + '</div>'
        + '</div>';

    // Phase 3B + 3C: calibration banner — only shown when GLObs is enabled.
    // playbackResolution (computed by _rhRenderTakeReview via
    // GLRecordings.resolvePlaybackSource) carries canonical recording id +
    // mixdown discovery + reason — banner displays it inline.
    if (calMode) {
        html += _rhRenderCalibrationBanner(takes, sessionId, session, audioUrl, playbackResolution);
    }

    if (!audioUrl) {
        html += '<div style="font-size:0.7em;color:#fbbf24;background:rgba(251,191,36,0.06);padding:6px 10px;border-radius:6px;margin-bottom:10px">'
            + 'No persistent audio attached to this rehearsal — playback disabled. Attach a recording via Mixdowns to enable play.'
            + '</div>';
    } else {
        html += '<audio id="rhTakeReviewAudio_' + escHtml(sessionId) + '" preload="metadata" style="display:none"></audio>';
    }

    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    for (var i = 0; i < takes.length; i++) {
        html += _rhTakeRowHTML(takes[i], sessionId, !!audioUrl, calMode);
    }
    html += '</div>';

    html += '<div style="font-size:0.65em;color:var(--text-dim);margin-top:8px;line-height:1.4">'
        + 'Tap a suggestion or “Correct…” to reassign. Band corrections are protected from future analyzer overwrites.'
        + '</div>';

    return html;
}

// Phase 3B: calibration banner that sits between the card header and the
// rows. Surfaces audio-source identity + continuity observations + a
// quick-disable link. Compact by default; details expand on demand.
function _rhRenderCalibrationBanner(takes, sessionId, session, audioUrl, playbackResolution) {
    var audio = (window.GLObs && window.GLObs.summarizeAudioSource)
        ? window.GLObs.summarizeAudioSource(session || {})
        : null;
    var obs = (window.GLObs && window.GLObs.analyzeTakeContinuity)
        ? window.GLObs.analyzeTakeContinuity(takes)
        : [];

    var html = '<div style="margin-bottom:10px;padding:8px 10px;border-radius:8px;border:1px dashed rgba(167,139,250,0.35);background:rgba(167,139,250,0.06)">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">'
            + '<div style="font-size:0.72em;font-weight:600;color:#a78bfa">🔬 Calibration mode</div>'
            + '<button onclick="if(window.GLObs){GLObs.disable();}var c=document.getElementById(\'rhTimelineSection\');if(c&&window._rhShowSessionReport){_rhShowSessionReport(\'' + escHtml(sessionId) + '\')}" style="font-size:0.65em;padding:2px 8px;border-radius:6px;border:1px solid rgba(167,139,250,0.3);background:transparent;color:#a78bfa;cursor:pointer">Disable</button>'
        + '</div>';

    // Phase 3C: canonical playback resolution diagnostic (richer + truthful
    // about which resolver path won). Rendered above the legacy session-only
    // summarize so the band sees both: what session.recording_url says vs
    // what GLRecordings actually resolved.
    if (playbackResolution) {
        var resOriginColor = playbackResolution.hasPersistent ? '#10b981' : (playbackResolution.isBlob ? '#ef4444' : '#64748b');
        var resBadge = playbackResolution.recordingId ? '✓ canonical' : (playbackResolution.hasPersistent ? '~ legacy persistent' : '⚠ no canonical');
        html += '<div style="font-size:0.66em;color:var(--text-dim);margin-bottom:4px">'
            + '<span style="color:' + resOriginColor + ';font-weight:500">resolved.origin:</span> ' + escHtml(playbackResolution.origin)
            + ' · <span style="color:var(--text-dim)">via:</span> ' + escHtml(playbackResolution.reason || '—')
            + ' · ' + escHtml(resBadge)
            + (playbackResolution.recordingId ? ' · <span style="color:var(--text-dim)">recording_id:</span> ' + escHtml(playbackResolution.recordingId.slice(0, 10)) + '…' : '')
            + (playbackResolution.mixdownId ? ' · <span style="color:var(--text-dim)">mixdown:</span> ' + escHtml(playbackResolution.mixdownId.slice(0, 10)) + '…' : '')
            + '</div>';
    }

    // Audio source diagnostic (legacy session.recording_url snapshot).
    if (audio) {
        var originColor = audio.hasPersistent ? '#10b981' : (audio.isBlob ? '#ef4444' : '#64748b');
        html += '<div style="font-size:0.66em;color:var(--text-dim);margin-bottom:4px">'
            + '<span style="color:' + originColor + ';font-weight:500">session.audio.origin:</span> ' + escHtml(audio.origin)
            + ' · <span style="color:var(--text-dim)">persistent:</span> ' + (audio.hasPersistent ? 'yes' : 'no')
            + (audio.isBlob ? ' · <span style="color:#ef4444">⚠ blob URL — session-scoped only</span>' : '')
            + '</div>';
        // Phase 3C: only show the mixdown-lookup gap note when the resolver
        // didn't actually resolve through a mixdown — otherwise it's stale.
        if (!playbackResolution || playbackResolution.reason !== 'mixdown_match') {
            html += '<div style="font-size:0.62em;color:var(--text-dim);margin-bottom:6px">'
                + escHtml(audio.mixdownLookupNote)
                + '</div>';
        }
    }

    // Continuity observations
    if (obs && obs.length) {
        html += '<div style="font-size:0.66em;color:#a78bfa;font-weight:500;margin-top:4px">Continuity signals (' + obs.length + ')</div>';
        html += '<ul style="margin:3px 0 0 16px;padding:0;font-size:0.64em;color:var(--text-dim);line-height:1.5">';
        obs.slice(0, 6).forEach(function (o) {
            var sevColor = (o.severity === 'warning') ? '#f59e0b' : '#a78bfa';
            html += '<li><span style="color:' + sevColor + '">' + escHtml(o.kind) + '</span> — ' + escHtml(o.message) + '</li>';
        });
        if (obs.length > 6) html += '<li>… and ' + (obs.length - 6) + ' more</li>';
        html += '</ul>';
    } else {
        html += '<div style="font-size:0.62em;color:var(--text-dim);margin-top:4px">No continuity signals.</div>';
    }

    // Phase 3D: Benchmark validation cheat-sheet — convergence health at a
    // glance. Take recording_id coverage = fraction of takes whose canonical
    // FK is set. Mismatches = takes with a non-null recording_id that
    // diverges from the resolver's session-level recording_id (real-world
    // this happens after re-analysis against a swapped recording).
    var withRid = 0, mismatches = 0, withTitle = 0, humanCount = 0;
    var sessRid = (playbackResolution && playbackResolution.recordingId) || null;
    (takes || []).forEach(function (t) {
        if (!t) return;
        var rid = (t.playback_ref && t.playback_ref.recording_id) || t.recording_id || null;
        if (rid) withRid++;
        if (rid && sessRid && rid !== sessRid) mismatches++;
        if (t.song_title || t.song_id) withTitle++;
        if (t.matching && t.matching.correction_source === 'human') humanCount++;
    });
    var totalTakes = (takes || []).length;
    var ridPct = totalTakes > 0 ? Math.round((withRid / totalTakes) * 100) : 0;
    var titlePct = totalTakes > 0 ? Math.round((withTitle / totalTakes) * 100) : 0;
    var ridColor = ridPct >= 95 ? '#10b981' : ridPct >= 60 ? '#f59e0b' : '#ef4444';
    var titleColor = titlePct >= 80 ? '#10b981' : titlePct >= 50 ? '#f59e0b' : '#ef4444';

    // Phase 3F: pull continuity pre-pass stats stashed by gl-takes during the
    // most recent normalize. May be absent if takes were loaded from cache
    // without a fresh analyze — show — to flag the gap.
    var contStash = (window._glContinuityLatest && window._glContinuityLatest[sessionId]) || null;
    var contAppliedStr = contStash ? String(contStash.applied) : '—';
    var contSuggStr = contStash ? String(contStash.suggestions.length) : '—';

    // Phase 3H: dominant-evidence histogram across this session's takes +
    // fallback-to-plan counter. Surfaces "what's actually picking songs
    // tonight?" in one glance. Pre-3H Takes without confidence_breakdown
    // simply don't contribute to the histogram.
    var domHist = {};
    var fallbackToPlanCount = 0;
    var disagreeCount = 0;
    (takes || []).forEach(function (t) {
        var cb = t && t.matching && t.matching.confidence_breakdown;
        if (!cb) return;
        if (cb.dominant_signal) domHist[cb.dominant_signal] = (domHist[cb.dominant_signal] || 0) + 1;
        if (cb.only_plan_active) fallbackToPlanCount++;
        if (cb.signals_disagree) disagreeCount++;
    });
    var domParts = Object.keys(domHist).sort(function (a, b) { return domHist[b] - domHist[a]; })
        .map(function (k) { return k + ':' + domHist[k]; });
    var domHistStr = domParts.length ? domParts.join(' · ') : null;
    // Emit a one-shot fallback-to-plan summary log when calibration mode is on.
    if (window.GLObs && window.GLObs.log && fallbackToPlanCount > 0) {
        window.GLObs.log('Matcher', 'fallback_to_plan summary', {
            session: sessionId,
            count: fallbackToPlanCount,
            total: (takes || []).length
        });
    }

    // Benchmark metrics stashed on the session DOM so the snapshot button
    // and the post-render hydrator can read them without re-computing.
    var benchMetrics = {
        take_count: totalTakes,
        recording_id_coverage_pct: ridPct,
        titled_pct: titlePct,
        rid_mismatch_count: mismatches,
        human_corrected_count: humanCount,
        classified_count: 0, // hydrated post-render
        // Phase 3F: continuity pre-pass metrics — null when the latest
        // normalize didn't run (cached takes path).
        continuity_suggestions_count: contStash ? contStash.suggestions.length : null,
        continuity_applied_count:     contStash ? contStash.applied : null
    };
    var benchContinuity = (window.GLBenchmark && window.GLBenchmark.bucketContinuity)
        ? window.GLBenchmark.bucketContinuity(obs)
        : { adjacent_same_song: 0, restart_loop_candidate: 0, unresolved_cluster: 0, short_take_run: 0 };
    try { window._rhBenchLastMetrics = window._rhBenchLastMetrics || {}; window._rhBenchLastMetrics[sessionId] = { metrics: benchMetrics, continuity: benchContinuity }; } catch (e) {}

    html += '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(167,139,250,0.2);font-size:0.62em;color:var(--text-dim);line-height:1.5">'
        + '<span style="color:#a78bfa;font-weight:600">🎯 Benchmark</span>'
        + ' · takes: <span style="color:var(--text)">' + totalTakes + '</span>'
        + ' · recording_id coverage: <span style="color:' + ridColor + ';font-weight:500">' + withRid + '/' + totalTakes + ' (' + ridPct + '%)</span>'
        + (mismatches > 0 ? ' · <span style="color:#ef4444">⚠ ' + mismatches + ' rid mismatch</span>' : '')
        + ' · titled: <span style="color:' + titleColor + ';font-weight:500">' + withTitle + ' (' + titlePct + '%)</span>'
        + (humanCount > 0 ? ' · <span style="color:#10b981">✓ ' + humanCount + ' human-corrected</span>' : '')
        + ' · <span id="rhBenchClassifiedCount_' + escHtml(sessionId) + '" style="color:var(--text-dim)">📋 — classified</span>'
        + ' · <span style="color:' + (contStash && contStash.applied > 0 ? '#10b981' : 'var(--text-dim)') + '">🔗 ' + contAppliedStr + ' merged / ' + contSuggStr + ' suggested</span>'
        + ' · <span id="rhContDecisionsCount_' + escHtml(sessionId) + '" style="color:var(--text-dim)">👤 — decisions</span>'
        + '</div>';

    // Phase 3H: session-level evidence-mix summary. Calibration-only, single
    // line. Tells the analyst at a glance which signal carried this session.
    if (domHistStr || fallbackToPlanCount > 0 || disagreeCount > 0) {
        var fallbackChip = fallbackToPlanCount > 0
            ? ' · <span style="color:#ef4444">⚠ ' + fallbackToPlanCount + ' fallback-to-plan</span>'
            : '';
        var disagreeChip = disagreeCount > 0
            ? ' · <span style="color:#f59e0b">⚠ ' + disagreeCount + ' signals-disagree</span>'
            : '';
        html += '<div style="font-size:0.62em;color:var(--text-dim);margin-top:3px;line-height:1.5">'
            + '<span style="color:#818cf8">📊 Evidence mix</span>: '
            + escHtml(domHistStr || '(no per-take breakdowns — re-analyze to populate)')
            + fallbackChip
            + disagreeChip
            + '</div>';
    }

    // Phase 3F: continuity suggestion list — kind counts only. Compact;
    // surfaces what the heuristic noticed without dumping JSON.
    if (contStash && contStash.suggestions && contStash.suggestions.length) {
        var kindCounts = contStash.kinds || {};
        var kindParts = Object.keys(kindCounts).filter(function (k) { return kindCounts[k] > 0; })
            .map(function (k) { return k + ': ' + kindCounts[k]; });
        if (kindParts.length) {
            html += '<div style="font-size:0.62em;color:var(--text-dim);margin-top:3px;line-height:1.5">'
                + '<span style="color:#a78bfa">🔗 Continuity pre-pass</span>: '
                + escHtml(kindParts.join(' · '))
                + '</div>';
        }
    } else if (window.GLContinuity) {
        html += '<div style="font-size:0.62em;color:var(--text-dim);margin-top:3px;font-style:italic">'
            + '🔗 Continuity pre-pass not run yet (re-analyze to populate)'
            + '</div>';
    }

    // Phase 3E: snapshot + rerun comparison panel. Empty on first render;
    // hydrated by _rhBenchHydrateBanner once GLBenchmark + GLObs return.
    if (window.GLBenchmark) {
        html += '<div id="rhBenchPanel_' + escHtml(sessionId) + '" style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(167,139,250,0.12);font-size:0.62em;color:var(--text-dim);line-height:1.5">'
            + '<span style="color:var(--text-dim);font-style:italic">Loading benchmark snapshots…</span>'
            + '</div>';
    }

    html += '</div>';
    return html;
}

// Phase 3E: post-render hydration for the calibration banner benchmark
// panel. Loads observation count + snapshot history, renders rerun diff vs
// the most recent prior snapshot, and exposes a [📸 Snapshot] button.
window._rhBenchHydrateBanner = async function (sessionId) {
    if (!window.GLBenchmark) return;
    var rehearsalId = sessionId; // 1:1 in this codebase
    try {
        var obsList = await window.GLBenchmark.getObservationsForSession(rehearsalId);
        var classifiedCount = (obsList || []).filter(function (o) {
            return o && o.classification && o.classification !== 'note';
        }).length;
        var countEl = document.getElementById('rhBenchClassifiedCount_' + sessionId);
        if (countEl) {
            countEl.innerHTML = '📋 <span style="color:' + (classifiedCount > 0 ? '#a78bfa' : 'var(--text-dim)') + '">' + classifiedCount + ' classified</span>';
        }

        // Phase 3G: hydrate continuity-authority decision count.
        var decisionsCount = 0;
        if (window.GLContinuityAuthority && window.GLContinuityAuthority.summarizeDecisionsForSession) {
            try {
                var summary = await window.GLContinuityAuthority.summarizeDecisionsForSession(rehearsalId);
                decisionsCount = (summary && summary.total) || 0;
                var dEl = document.getElementById('rhContDecisionsCount_' + sessionId);
                if (dEl) {
                    var dColor = decisionsCount > 0 ? '#10b981' : 'var(--text-dim)';
                    var pieces = [];
                    if (summary.good_merge > 0) pieces.push('✓' + summary.good_merge);
                    if (summary.keep_separate > 0) pieces.push('⚡' + summary.keep_separate);
                    if (summary.ignore_kind > 0) pieces.push('🚫' + summary.ignore_kind);
                    var detail = pieces.length ? ' (' + pieces.join(' ') + ')' : '';
                    dEl.innerHTML = '👤 <span style="color:' + dColor + '">' + decisionsCount + ' decisions' + detail + '</span>';
                }
            } catch (e) {}
        }

        var panel = document.getElementById('rhBenchPanel_' + sessionId);
        if (!panel) return;

        var snaps = await window.GLBenchmark.getSnapshotsForSession(rehearsalId);
        var html = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
            + '<button onclick="window._rhBenchSnapshot(\'' + escHtml(sessionId) + '\')" style="font-size:0.62em;padding:3px 8px;border-radius:4px;border:1px solid rgba(167,139,250,0.3);background:rgba(167,139,250,0.08);color:#a78bfa;cursor:pointer">📸 Snapshot benchmark</button>'
            + '<button onclick="window._rhBootstrapEmbeddings(\'' + escHtml(sessionId) + '\')" title="Walk human-confirmed Takes in this session, fetch CLAP embeddings, persist to bands/{slug}/_analyzer/embedding_bank" style="font-size:0.62em;padding:3px 8px;border-radius:4px;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.08);color:#10b981;cursor:pointer">🌱 Bootstrap embeddings</button>'
            + '<span id="rhBootstrapStatus_' + escHtml(sessionId) + '" style="font-size:0.62em;color:var(--text-dim)"></span>';
        if (snaps && snaps.length) {
            var latest = snaps[snaps.length - 1];
            var latestDate = latest.created_at ? new Date(latest.created_at).toLocaleString() : '';
            html += '<span style="color:var(--text-dim)">Snapshots: ' + snaps.length + ' · latest: ' + escHtml(latest.build || '?') + ' @ ' + escHtml(latestDate) + '</span>';
        } else {
            html += '<span style="color:var(--text-dim);font-style:italic">No prior snapshots — first snapshot becomes the baseline.</span>';
        }
        html += '</div>';

        // Rerun comparison: latest stored snapshot vs current live metrics.
        if (snaps && snaps.length && window._rhBenchLastMetrics && window._rhBenchLastMetrics[sessionId]) {
            var live = window._rhBenchLastMetrics[sessionId];
            // Inject classified_count into live metrics for fair comparison
            live.metrics.classified_count = classifiedCount;
            var prior = snaps[snaps.length - 1];
            var diff = window.GLBenchmark.diffSnapshots(prior, {
                metrics: live.metrics,
                continuity: live.continuity,
                build: prior.build
            });
            if (diff) {
                html += '<div style="margin-top:4px;padding:6px 8px;border-radius:6px;background:rgba(167,139,250,0.04);border:1px dashed rgba(167,139,250,0.18)">'
                    + '<div style="color:#a78bfa;font-weight:600;margin-bottom:3px">vs prior snapshot (' + escHtml(prior.build || '?') + ')</div>'
                    + _rhBenchRenderDiffRows(diff)
                    + '</div>';
            }
        }
        panel.innerHTML = html;
    } catch (e) {
        var panelErr = document.getElementById('rhBenchPanel_' + sessionId);
        if (panelErr) panelErr.innerHTML = '<span style="color:#ef4444">Benchmark hydration failed: ' + escHtml(e && e.message || 'unknown') + '</span>';
    }
};

function _rhBenchRenderDiffRows(diff) {
    function _row(label, info) {
        if (!info) return '';
        var delta = info.delta || 0;
        var arrow = delta === 0 ? '·' : (delta > 0 ? '▲' : '▼');
        var improvement = info.improvement || 'neutral';
        var color = '#94a3b8';
        if (improvement === 'higher_better') color = delta > 0 ? '#10b981' : (delta < 0 ? '#ef4444' : '#94a3b8');
        else if (improvement === 'lower_better') color = delta < 0 ? '#10b981' : (delta > 0 ? '#ef4444' : '#94a3b8');
        return '<div style="display:flex;gap:4px"><span style="min-width:200px;color:var(--text-dim)">' + escHtml(label) + '</span>'
            + '<span style="color:var(--text)">' + escHtml(String(info.from != null ? info.from : '—')) + ' → ' + escHtml(String(info.to != null ? info.to : '—')) + '</span>'
            + '<span style="color:' + color + ';margin-left:auto">' + arrow + ' ' + (delta > 0 ? '+' : '') + delta + '</span>'
            + '</div>';
    }
    var rows = '';
    rows += _row('recording_id_coverage_pct', diff.metrics.recording_id_coverage_pct);
    rows += _row('titled_pct',                diff.metrics.titled_pct);
    rows += _row('rid_mismatch_count',        diff.metrics.rid_mismatch_count);
    rows += _row('classified_count',          diff.metrics.classified_count);
    rows += _row('continuity_suggestions',    diff.metrics.continuity_suggestions_count);
    rows += _row('continuity_applied',        diff.metrics.continuity_applied_count);
    rows += _row('continuity_decisions',      diff.metrics.continuity_decisions_count);
    rows += _row('adjacent_same_song',        diff.continuity.adjacent_same_song);
    rows += _row('restart_loop_candidate',    diff.continuity.restart_loop_candidate);
    rows += _row('unresolved_cluster',        diff.continuity.unresolved_cluster);
    rows += _row('short_take_run',            diff.continuity.short_take_run);
    return rows;
}

window._rhBenchSnapshot = async function (sessionId) {
    if (!window.GLBenchmark) return;
    var live = window._rhBenchLastMetrics && window._rhBenchLastMetrics[sessionId];
    if (!live) {
        if (typeof showToast === 'function') showToast('Live metrics not yet computed');
        return;
    }
    try {
        var obsList = await window.GLBenchmark.getObservationsForSession(sessionId);
        live.metrics.classified_count = (obsList || []).filter(function (o) {
            return o && o.classification && o.classification !== 'note';
        }).length;
        // Phase 3G: also capture analyst authority decision count so the
        // benchmark snapshot freezes a holistic picture of human curation.
        if (window.GLContinuityAuthority && window.GLContinuityAuthority.summarizeDecisionsForSession) {
            try {
                var sum = await window.GLContinuityAuthority.summarizeDecisionsForSession(sessionId);
                live.metrics.continuity_decisions_count = (sum && sum.total) || 0;
            } catch (e) { live.metrics.continuity_decisions_count = 0; }
        }
        var snap = await window.GLBenchmark.snapshot(sessionId, live.metrics, live.continuity, '');
        if (typeof showToast === 'function') showToast('📸 Snapshot saved (build ' + (snap.build || '?') + ')');
        await window._rhBenchHydrateBanner(sessionId);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Snapshot failed: ' + (e && e.message || 'unknown'));
    }
};

// Phase 3I: Bootstrap the CLAP embedding bank from this session's
// human-confirmed Takes + benchmark wrong_match observations that name a
// truth song. Calibration-mode only — fired by the 🌱 button in the
// snapshot panel. Bad-label-poisoning safeguard: we ONLY ingest Takes
// whose song identity is human-authoritative.
window._rhBootstrapEmbeddings = async function (sessionId) {
    if (!window.GLTakes || !window.GLTakes.getTakesForRehearsal) {
        if (typeof showToast === 'function') showToast('GLTakes not loaded');
        return;
    }
    if (typeof SongMatchingEngine === 'undefined' || !SongMatchingEngine.storeConfirmedEmbedding) {
        if (typeof showToast === 'function') showToast('SongMatchingEngine missing storeConfirmedEmbedding');
        return;
    }

    var statusEl = document.getElementById('rhBootstrapStatus_' + sessionId);
    function _status(msg, color) {
        if (!statusEl) return;
        statusEl.style.color = color || 'var(--text-dim)';
        statusEl.textContent = msg;
    }

    _status('Probing embed service…');
    var embedUrl = window._glEmbedServiceUrl || 'http://localhost:8200';
    var healthy = false;
    try {
        var hres = await fetch(embedUrl + '/health', { signal: AbortSignal.timeout(2500) });
        var hdata = await hres.json();
        healthy = (hdata && (hdata.status === 'ok' || hdata.status === 'ready')) || false;
    } catch (e) {
        _status('⚠ Embed service unreachable at ' + embedUrl, '#ef4444');
        return;
    }
    if (!healthy) {
        _status('⚠ Embed service unhealthy at ' + embedUrl, '#ef4444');
        return;
    }

    _status('Loading Takes…');
    var takes = [];
    try {
        takes = await window.GLTakes.getTakesForRehearsal(sessionId);
    } catch (e) {
        _status('⚠ Could not load Takes', '#ef4444');
        return;
    }

    // Build the truth map: for each eligible Take, what's the authoritative
    // song identity? Sources:
    //   (a) take.matching.correction_source === 'human' → use take.song_title / song_id
    //   (b) benchmark observations of classification='wrong_match' with notes
    //       naming a song → resolve title to songId.
    // Source (a) is conservative — Phase 3A confirmation flow stamps this.
    // Source (b) is more aggressive — analyst note interpretation; gated.
    var humanTruth = takes.filter(function (t) {
        return t && t.matching && t.matching.correction_source === 'human'
            && (t.song_id || t.song_title) && t.playback_ref
            && t.playback_ref.start_sec != null && t.playback_ref.end_sec != null
            && (t.playback_ref.end_sec - t.playback_ref.start_sec) >= 30;
    });
    if (!humanTruth.length) {
        _status('No human-confirmed Takes (≥30s) found in this session', '#fbbf24');
        return;
    }

    // Resolve audio source via GLRecordings — same path used by Take Review.
    _status('Resolving audio source…');
    var session = null;
    try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function') {
            var snap = await db.ref(bandPath('rehearsal_sessions/' + sessionId)).once('value');
            session = snap.val() || {};
            session.sessionId = sessionId;
        }
    } catch (e) {}
    var audioUrl = '';
    if (session && window.GLRecordings && window.GLRecordings.resolvePlaybackSource) {
        try {
            var res = await window.GLRecordings.resolvePlaybackSource(session);
            if (res && res.url && !res.isBlob) audioUrl = res.url;
        } catch (e) {}
    }
    if (!audioUrl) {
        _status('⚠ No persistent audio source for this session', '#ef4444');
        return;
    }

    _status('Decoding audio (' + humanTruth.length + ' takes to embed)…');
    var fullPcm = null;
    var sampleRate = 0;
    try {
        var resp = await fetch(audioUrl);
        var buf = await resp.arrayBuffer();
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var decoded = await ctx.decodeAudioData(buf);
        fullPcm = decoded.getChannelData(0);
        sampleRate = decoded.sampleRate;
        ctx.close();
    } catch (e) {
        _status('⚠ Audio decode failed: ' + (e && e.message || 'unknown'), '#ef4444');
        return;
    }

    var done = 0, skipped = 0, failed = 0;
    for (var i = 0; i < humanTruth.length; i++) {
        var t = humanTruth[i];
        _status('Embedding ' + (i + 1) + '/' + humanTruth.length + ' · ' + (t.song_title || t.song_id) + '…');
        try {
            var startSec = t.playback_ref.start_sec;
            var endSec = t.playback_ref.end_sec;
            var startSample = Math.max(0, Math.floor(startSec * sampleRate));
            var endSample = Math.min(fullPcm.length, Math.floor(endSec * sampleRate));
            if (endSample - startSample < sampleRate * 30) { skipped++; continue; }

            var slice = fullPcm.subarray(startSample, endSample);
            var wav = _rhEncodeWavMono(slice, sampleRate);
            var form = new FormData();
            form.append('file', new Blob([wav], { type: 'audio/wav' }), 'take_' + t.id + '.wav');
            var ctrl = new AbortController();
            var to = setTimeout(function () { ctrl.abort(); }, 30000);
            var eres = await fetch(embedUrl + '/embed', { method: 'POST', body: form, signal: ctrl.signal });
            clearTimeout(to);
            var edata = await eres.json();
            if (!edata || !edata.embedding || !edata.embedding.length) { failed++; continue; }

            var songId = t.song_id || t.song_title;
            SongMatchingEngine.storeConfirmedEmbedding(songId, t.song_title || songId, edata.embedding, {
                segType: 'song',
                duration: endSec - startSec,
                qualityScore: 3,
                source: 'bootstrap',
                model_version: edata.model_version || (SongMatchingEngine.EMBED_MODEL_VERSION || 'laion/clap-htsat-unfused-v1'),
                take_id: t.id,
                recording_id: t.recording_id || (t.playback_ref && t.playback_ref.recording_id) || null,
                rehearsal_id: t.rehearsal_id || sessionId,
                confirmed_by: (t.matching && t.matching.corrected_by) || 'human'
            });
            done++;
        } catch (e) {
            failed++;
            if (e && e.name === 'AbortError') {
                _status('⚠ Embed request timed out — stopping bootstrap', '#ef4444');
                break;
            }
        }
    }

    if (window.GLObs && window.GLObs.log) {
        window.GLObs.log('EmbedBank', 'bootstrap complete', {
            session: sessionId,
            ingested: done,
            skipped: skipped,
            failed: failed,
            eligible: humanTruth.length
        });
    }
    var summary = '✅ Bootstrap: ' + done + ' embedded' + (skipped ? ' · ' + skipped + ' skipped' : '') + (failed ? ' · ' + failed + ' failed' : '');
    _status(summary, done > 0 ? '#10b981' : '#fbbf24');
    if (typeof showToast === 'function') showToast(summary);
};

// Phase 3I: minimal WAV encoder for Bootstrap slices. Mono, 16-bit PCM.
// Stays local to rehearsal.js so the bootstrap path doesn't depend on
// recording-analyzer.js _encodeWAV (which is module-private).
function _rhEncodeWavMono(samples, sampleRate) {
    var len = samples.length;
    var buffer = new ArrayBuffer(44 + len * 2);
    var view = new DataView(buffer);
    function _ws(off, str) { for (var i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); }
    _ws(0, 'RIFF');
    view.setUint32(4, 36 + len * 2, true);
    _ws(8, 'WAVE');
    _ws(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);          // PCM
    view.setUint16(22, 1, true);          // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    _ws(36, 'data');
    view.setUint32(40, len * 2, true);
    var off = 44;
    for (var i = 0; i < len; i++) {
        var s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
    }
    return buffer;
}

function _rhTakeRowHTML(take, sessionId, audioAvailable, calMode) {
    if (!take) return '';
    var matching = take.matching || {};
    var conf = matching.confidence || 'unknown';
    var boundary = take.boundary_confidence || null;
    var isHuman = matching.correction_source === 'human';
    var title = take.song_title || null;
    var unresolved = !title;

    var confColor = (conf === 'high') ? '#10b981'
                  : (conf === 'medium') ? '#f59e0b'
                  : (conf === 'low') ? '#ef4444'
                  : '#64748b';
    var confLabel = (conf === 'high') ? 'High confidence'
                  : (conf === 'medium') ? 'Medium'
                  : (conf === 'low') ? 'Low — review'
                  : '—';

    var boundaryColor = (boundary === 'hard') ? '#10b981'
                      : (boundary === 'soft') ? '#f59e0b'
                      : (boundary === 'inferred') ? '#a78bfa'
                      : '#64748b';
    var boundaryLabel = (boundary === 'hard') ? 'Strong boundary'
                      : (boundary === 'soft') ? 'Soft boundary'
                      : (boundary === 'inferred') ? 'Inferred boundary'
                      : null;

    var dur = (take.stats && take.stats.duration) || 0;
    var durLabel = _rhFormatTakeDuration(dur);

    var playBtn = audioAvailable
        ? '<button id="rhTakePlayBtn_' + escHtml(take.id) + '" data-rh-take-play="' + escHtml(take.id) + '" onclick="window._rhTakePlay(\'' + escHtml(sessionId) + '\',\'' + escHtml(take.id) + '\')" aria-label="Play take" title="Play this take" style="flex-shrink:0;width:32px;height:32px;border-radius:50%;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#818cf8;cursor:pointer;font-size:0.9em;line-height:1">▶</button>'
        : '<button disabled aria-label="Playback disabled" title="No recording attached" style="flex-shrink:0;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:#64748b;cursor:not-allowed;font-size:0.9em;line-height:1">▶</button>';

    var titleHtml;
    if (unresolved) {
        var reasonHint = (matching.confidence_reason === 'plan_only_no_audio')
            ? 'plan match, no audio evidence'
            : (matching.confidence_reason === 'signals_disagree')
                ? 'analyzer signals disagree'
                : 'analyzer uncertain';
        titleHtml = '<span style="color:var(--text-dim);font-style:italic">Unresolved — ' + escHtml(reasonHint) + '</span>';
    } else {
        titleHtml = '<span>' + escHtml(title) + '</span>';
    }

    var humanBadge = isHuman
        ? '<span title="A band member assigned this song — protected from analyzer overwrite" style="display:inline-flex;align-items:center;gap:3px;font-size:0.62em;padding:1px 6px;border-radius:10px;background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.25);margin-left:6px">✓ Corrected by band</span>'
        : '';

    var poolBadge = '';
    if (matching.candidate_pool === 'plan_first' && !isHuman) {
        poolBadge = '<span title="Matched from the rehearsal plan" style="font-size:0.6em;color:#a78bfa;margin-left:6px">• From plan</span>';
    }

    var chips = '<span title="Analyzer confidence in this match" style="font-size:0.62em;padding:1px 6px;border-radius:10px;color:' + confColor + ';background:' + confColor + '1A;border:1px solid ' + confColor + '40">' + escHtml(confLabel) + '</span>';
    if (boundaryLabel) {
        chips += '<span title="How clean the take’s start/end boundary is" style="font-size:0.62em;padding:1px 6px;border-radius:10px;color:' + boundaryColor + ';background:' + boundaryColor + '1A;border:1px solid ' + boundaryColor + '40;margin-left:4px">' + escHtml(boundaryLabel) + '</span>';
    }
    chips += '<span style="font-size:0.62em;color:var(--text-dim);margin-left:6px">' + escHtml(durLabel) + '</span>';

    var suggestions = Array.isArray(matching.top_suggestions) ? matching.top_suggestions : [];
    var suggestHtml = '';
    if (suggestions.length) {
        var parts = [];
        suggestions.slice(0, 3).forEach(function (s) {
            if (!s || !s.title) return;
            // Skip a suggestion that already matches the current title - adds nothing.
            if (!unresolved && title && s.title === title) return;
            parts.push('<a href="#" onclick="event.preventDefault();window._rhTakeQuickAssign(\'' + escHtml(sessionId) + '\',\'' + escHtml(take.id) + '\',\'' + escHtml(s.title) + '\')" style="color:#818cf8;text-decoration:none;border-bottom:1px dotted rgba(129,140,248,0.3);cursor:pointer">' + escHtml(s.title) + '</a>');
        });
        if (parts.length) {
            suggestHtml = '<div style="font-size:0.65em;color:var(--text-dim);margin-top:4px">Suggestions: ' + parts.join(' · ') + '</div>';
        }
    }

    var correctLabel = unresolved ? 'Assign …' : 'Correct …';
    var correctBtn = '<button onclick="window._rhTakeOpenCorrect(\'' + escHtml(sessionId) + '\',\'' + escHtml(take.id) + '\')" style="flex-shrink:0;padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#94a3b8;cursor:pointer;font-size:0.72em;align-self:flex-start">' + correctLabel + '</button>';

    // Phase 3I.6: boundary editor button — opens an inline numeric input + preview
    // form so the band can tighten start/end on a take before the slice gets
    // sent to the embedding bank. Bootstrap respects whatever boundaries the
    // take carries, so tightening here directly improves sound-bank quality.
    var editBoundsBtn = audioAvailable
        ? '<button onclick="window._rhTakeOpenBoundaries(\'' + escHtml(sessionId) + '\',\'' + escHtml(take.id) + '\')" title="Edit start/end boundaries before this slice goes to the sound bank" style="flex-shrink:0;padding:5px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#94a3b8;cursor:pointer;font-size:0.72em;align-self:flex-start">⏱ Trim</button>'
        : '';

    // Phase 3I.6: per-row inline playback controls. Hidden until _rhTakePlay
    // starts this take; then the coordinator flips display:flex on it. The
    // progress bar is click-to-seek within the take's start/end window.
    var playingControls = audioAvailable
        ? '<div id="rhTakePlaying_' + escHtml(take.id) + '" style="display:none;margin-top:6px;align-items:center;gap:8px;font-size:0.66em;color:var(--text-dim)">'
            + '<button onclick="window._rhTakeStop(\'' + escHtml(take.id) + '\')" title="Stop this take" style="flex-shrink:0;width:24px;height:24px;border-radius:50%;border:1px solid rgba(255,255,255,0.12);background:transparent;color:#94a3b8;cursor:pointer;font-size:0.9em;line-height:1">✕</button>'
            + '<span id="rhTakeProgTime_' + escHtml(take.id) + '" style="min-width:80px;text-align:center;font-variant-numeric:tabular-nums">0:00 / 0:00</span>'
            + '<div id="rhTakeProgBar_' + escHtml(take.id) + '" onclick="window._rhTakeSeek(event,\'' + escHtml(take.id) + '\')" onmousedown="window._rhTakeBarDragStart(event,\'' + escHtml(take.id) + '\')" title="Click or drag to seek" style="flex:1;height:12px;background:rgba(255,255,255,0.12);border-radius:6px;cursor:pointer;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06)">'
                + '<div id="rhTakeProgFill_' + escHtml(take.id) + '" style="height:100%;width:0%;background:linear-gradient(90deg,#818cf8,#a78bfa);border-radius:6px;pointer-events:none;min-width:3px;transition:width 0.08s linear"></div>'
            + '</div>'
        + '</div>'
        : '';

    // Phase 3B: per-row diagnostics. Only rendered when calibration mode is
    // on; collapsed by default to keep the page calm.
    var diagHtml = calMode ? _rhTakeRowDiagnosticsHTML(take) : '';

    return '<div class="rh-take-row" data-take-id="' + escHtml(take.id) + '" style="display:flex;align-items:flex-start;gap:10px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);flex-wrap:wrap">'
        + playBtn
        + '<div style="flex:1;min-width:160px">'
            + '<div style="font-size:0.85em;font-weight:500;display:flex;align-items:center;flex-wrap:wrap">' + titleHtml + humanBadge + poolBadge + '</div>'
            + '<div style="margin-top:3px;display:flex;flex-wrap:wrap;align-items:center">' + chips + '</div>'
            + suggestHtml
            + playingControls
            + '<div id="rhTakeCorrectForm_' + escHtml(take.id) + '" style="display:none;margin-top:6px"></div>'
            + '<div id="rhTakeBoundaryForm_' + escHtml(take.id) + '" style="display:none;margin-top:6px"></div>'
            + diagHtml
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:4px;align-self:flex-start">'
            + correctBtn
            + editBoundsBtn
        + '</div>'
        + '</div>';
}

// Phase 3B: per-row diagnostic <details>. Lazy expansion — content stays in
// the DOM but the browser only paints it when the <summary> is clicked.
// Compact layout: short key:value pairs, no JSON dumps, no waveform.
function _rhTakeRowDiagnosticsHTML(take) {
    var m = take.matching || {};
    var rawCount = Array.isArray(take.raw_markers) ? take.raw_markers.length : 0;
    var markerKinds = {};
    if (Array.isArray(take.raw_markers)) {
        take.raw_markers.forEach(function (r) {
            var k = (r && r.kind) || 'unknown';
            markerKinds[k] = (markerKinds[k] || 0) + 1;
        });
    }
    var markerKindStr = Object.keys(markerKinds).map(function (k) {
        return k + ':' + markerKinds[k];
    }).join(' ') || '—';

    var rows = [
        ['take.id',              take.id],
        ['segment_id',           take.segment_id || '—'],
        ['song_id',              take.song_id || '—'],
        ['song_title',           take.song_title || '—'],
        ['take_number',          (take.take_number != null) ? String(take.take_number) : '—'],
        ['rehearsal_id',         take.rehearsal_id || '—'],
        ['recording_id',         take.recording_id || '— (Phase 3+ FK)'],
        ['boundary_confidence',  take.boundary_confidence || '—'],
        ['raw_markers (n)',      String(rawCount) + (rawCount ? ' [' + markerKindStr + ']' : '')],
        ['matching.candidate_pool',   m.candidate_pool || '—'],
        ['matching.confidence',       m.confidence || '—'],
        ['matching.confidence_reason', m.confidence_reason || '—'],
        ['matching.correction_source', m.correction_source || '—']
    ];

    // Previous auto guess — populated by gl-takes.js when a human correction
    // overwrites an existing assignment.
    if (m.previous_auto_guess && m.previous_auto_guess.song_title) {
        rows.push(['previous_auto_guess',
            (m.previous_auto_guess.song_title || '—')
            + ' (' + (m.previous_auto_guess.confidence || '?')
            + (m.previous_auto_guess.confidence_reason ? ' · ' + m.previous_auto_guess.confidence_reason : '')
            + ')']);
    }

    if (Array.isArray(m.top_suggestions) && m.top_suggestions.length) {
        var sugStr = m.top_suggestions.map(function (s) {
            if (!s) return '';
            var sc = (typeof s.score === 'number') ? (' ' + s.score.toFixed(2)) : '';
            return (s.title || '?') + sc;
        }).filter(Boolean).join(' · ');
        rows.push(['top_suggestions', sugStr]);
    }

    var listHtml = rows.map(function (r) {
        return '<div style="display:flex;gap:6px;font-size:0.62em;line-height:1.4">'
            + '<span style="color:#a78bfa;min-width:160px;flex-shrink:0">' + escHtml(r[0]) + '</span>'
            + '<span style="color:var(--text-dim);word-break:break-all">' + escHtml(String(r[1])) + '</span>'
            + '</div>';
    }).join('');

    // Phase 3E: per-take benchmark classification picker. Founder/admin
    // structured failure tagging — durable, survives re-analysis. The
    // picker reads CLASSIFICATIONS from GLBenchmark so it stays in sync
    // with the schema. Existing classifications for this take are listed
    // above the picker so the analyst sees prior judgments.
    var benchHtml = '';
    if (window.GLBenchmark && window.GLBenchmark.CLASSIFICATIONS) {
        var classOptions = ['<option value="">(classify failure…)</option>',
            '<option value="note">📝 Note (no failure)</option>']
            .concat(window.GLBenchmark.CLASSIFICATIONS.map(function (c) {
                return '<option value="' + c + '">' + c + '</option>';
            })).join('');
        benchHtml = '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(167,139,250,0.2)">'
            + '<div style="font-size:0.62em;color:#a78bfa;font-weight:600;margin-bottom:4px">🎯 Benchmark classification</div>'
            + '<div id="rhBenchObsList_' + escHtml(take.id) + '" style="font-size:0.6em;color:var(--text-dim);margin-bottom:4px"></div>'
            + '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">'
            + '<select id="rhBenchClass_' + escHtml(take.id) + '" style="font-size:0.62em;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:inherit">' + classOptions + '</select>'
            + '<input type="text" id="rhBenchNote_' + escHtml(take.id) + '" placeholder="optional note…" maxlength="240" style="flex:1;min-width:120px;font-size:0.62em;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:inherit">'
            + '<button onclick="window._rhBenchAddObservation(\'' + escHtml(take.rehearsal_id || '') + '\',\'' + escHtml(take.id) + '\')" style="font-size:0.62em;padding:3px 8px;border-radius:4px;border:1px solid rgba(167,139,250,0.3);background:rgba(167,139,250,0.08);color:#a78bfa;cursor:pointer">Save</button>'
            + '</div>'
            + '</div>';
    }

    // Phase 3H: explainable evidence block. Renders the per-signal voting
    // breakdown when take.matching.evidence is populated (post-3H Takes).
    // Pre-3H Takes silently skip this section.
    var evidenceHtml = '';
    if (Array.isArray(m.evidence) && m.evidence.length) {
        var cb = m.confidence_breakdown || {};
        var tierColor = cb.tier === 'high' ? '#10b981'
                       : cb.tier === 'medium' ? '#f59e0b'
                       : cb.tier === 'low' ? '#ef4444' : '#64748b';
        var reasonChips = (cb.reasons || []).map(function (r) {
            return '<span style="color:var(--text-dim)">' + escHtml(r) + '</span>';
        }).join(' · ');
        var dominantStr = cb.dominant_signal ? '<span style="color:#10b981">dominant: ' + escHtml(cb.dominant_signal) + '</span>' : '';
        var weakStr = cb.weakest_signal ? '<span style="color:var(--text-dim)">missing: ' + escHtml(cb.weakest_signal) + '</span>' : '';

        var evidenceRows = m.evidence.map(function (e) {
            var color = e.polarity === 'strong'   ? '#10b981'
                      : e.polarity === 'moderate' ? '#fbbf24'
                      : e.polarity === 'weak'     ? '#94a3b8'
                      : e.polarity === 'conflict' ? '#ef4444'
                      : '#64748b';
            var icon = e.polarity === 'strong'   ? '●'
                     : e.polarity === 'moderate' ? '●'
                     : e.polarity === 'weak'     ? '○'
                     : e.polarity === 'conflict' ? '⚠'
                     : e.polarity === 'missing'  ? '—'
                     :                              '·';
            var barPct = Math.max(0, Math.min(100, Math.round((e.contribution || 0) * 200))); // 0.5 contribution → 100%
            var barHtml = '<span style="display:inline-block;width:36px;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;vertical-align:middle;margin:0 4px">'
                + '<span style="display:block;height:100%;width:' + barPct + '%;background:' + color + ';border-radius:2px"></span>'
                + '</span>';
            var contribStr = (typeof e.contribution === 'number') ? ('+' + e.contribution.toFixed(2)) : '—';
            var conflictTag = e.conflicts_with ? ' <span style="color:#ef4444">(prefers ' + escHtml(e.conflicts_with) + ')</span>' : '';
            return '<div style="display:flex;gap:6px;align-items:center;padding:2px 0">'
                + '<span style="color:' + color + ';width:14px;text-align:center">' + icon + '</span>'
                + '<span style="color:var(--text);min-width:110px">' + escHtml(e.signal) + '</span>'
                + barHtml
                + '<span style="color:var(--text-dim);min-width:48px">' + contribStr + '</span>'
                + '<span style="color:var(--text-dim);flex:1">' + escHtml(e.explanation || '') + conflictTag + '</span>'
                + '</div>';
        }).join('');

        evidenceHtml = '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(99,102,241,0.2)">'
            + '<div style="font-size:0.62em;font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
                + '<span style="color:#818cf8">📊 Evidence</span>'
                + '<span style="color:' + tierColor + ';font-weight:700">' + escHtml(cb.tier || m.confidence || '?') + '</span>'
                + (typeof cb.best_score === 'number' ? '<span style="color:var(--text-dim);font-weight:400">score ' + cb.best_score.toFixed(2) + ' · gap ' + (cb.gap_to_second || 0).toFixed(2) + ' · ' + (cb.active_signal_count || 0) + ' active</span>' : '')
            + '</div>'
            + (reasonChips ? '<div style="font-size:0.6em;color:var(--text-dim);margin-bottom:4px">' + reasonChips + '</div>' : '')
            + (dominantStr || weakStr ? '<div style="font-size:0.6em;margin-bottom:6px">' + dominantStr + (dominantStr && weakStr ? ' · ' : '') + weakStr + '</div>' : '')
            + '<div style="font-size:0.62em;font-family:-apple-system,SF Mono,monospace">' + evidenceRows + '</div>'
            + '</div>';
    }

    // Phase 3G: merge lineage + analyst authority. Only renders when this
    // Take was born from a continuity merge (take.continuity present).
    var lineageHtml = '';
    if (take.continuity && Array.isArray(take.continuity.applied) && take.continuity.applied.length) {
        var appliedLines = take.continuity.applied.map(function (a) {
            var pk = escHtml(a.pair_key || '');
            var gap = (typeof a.gap_sec === 'number') ? (' · gap ' + a.gap_sec + 's') : '';
            return '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:2px 0">'
                + '<span style="color:#10b981;font-weight:500">' + escHtml(a.kind || '?') + '</span>'
                + '<span style="color:var(--text-dim)">' + escHtml(a.reason || '') + gap + '</span>'
                + '<span style="margin-left:auto;display:flex;gap:3px">'
                + '<button title="Affirm this merge as analyst-approved" onclick="window._rhContAuthorityAct(\'' + escHtml(take.rehearsal_id || '') + '\',\'' + pk + '\',\'' + escHtml(a.kind || '') + '\',\'good_merge\',\'' + escHtml(take.id) + '\')" style="font-size:0.62em;padding:2px 6px;border-radius:4px;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.06);color:#10b981;cursor:pointer">✓ Good</button>'
                + '<button title="Mark these segments to be kept separate in future analyzer runs" onclick="window._rhContAuthorityAct(\'' + escHtml(take.rehearsal_id || '') + '\',\'' + pk + '\',\'' + escHtml(a.kind || '') + '\',\'keep_separate\',\'' + escHtml(take.id) + '\')" style="font-size:0.62em;padding:2px 6px;border-radius:4px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);color:#ef4444;cursor:pointer">⚡ Keep separate</button>'
                + '</span>'
                + '</div>';
        }).join('');
        var mergedFrom = (take.continuity.merged_seg_ids || []).join(', ');
        lineageHtml = '<div style="margin-top:8px;padding-top:6px;border-top:1px dashed rgba(16,185,129,0.2)">'
            + '<div style="font-size:0.62em;color:#10b981;font-weight:600;margin-bottom:4px">🔗 Merge lineage</div>'
            + (mergedFrom ? '<div style="font-size:0.6em;color:var(--text-dim);margin-bottom:4px">merged_from: ' + escHtml(mergedFrom) + '</div>' : '')
            + '<div style="font-size:0.62em">' + appliedLines + '</div>'
            + '<div id="rhContAuthorityList_' + escHtml(take.id) + '" style="font-size:0.6em;color:var(--text-dim);margin-top:4px"></div>'
            + '</div>';
    }

    return '<details style="margin-top:6px;font-size:0.7em" ontoggle="if(this.open){window._rhBenchLoadObservations(\'' + escHtml(take.id) + '\');window._rhContAuthorityLoad(\'' + escHtml(take.rehearsal_id || '') + '\',\'' + escHtml(take.id) + '\')}">'
        + '<summary style="cursor:pointer;color:#a78bfa;list-style:none;display:inline-block;padding:2px 6px;border-radius:4px;border:1px dashed rgba(167,139,250,0.3);background:rgba(167,139,250,0.04)">🔬 Diagnostics</summary>'
        + '<div style="margin-top:6px;padding:8px;border-radius:6px;background:rgba(0,0,0,0.18);border:1px solid rgba(167,139,250,0.18)">'
        + listHtml
        + evidenceHtml
        + lineageHtml
        + benchHtml
        + '</div>'
        + '</details>';
}

// Phase 3E: benchmark classification handlers. Calibration-mode only —
// these are wired through the global `window` namespace so the existing
// inline-onclick attribute pattern in _rhTakeRowDiagnosticsHTML works.

window._rhBenchAddObservation = async function (rehearsalId, takeId) {
    if (!window.GLBenchmark || !window.GLBenchmark.addObservation) return;
    var selEl = document.getElementById('rhBenchClass_' + takeId);
    var noteEl = document.getElementById('rhBenchNote_' + takeId);
    if (!selEl) return;
    var classification = selEl.value || '';
    var note = (noteEl && noteEl.value || '').trim();
    if (!classification && !note) {
        if (typeof showToast === 'function') showToast('Pick a classification or write a note');
        return;
    }
    try {
        await window.GLBenchmark.addObservation({
            rehearsal_id: rehearsalId,
            take_id: takeId,
            classification: classification || 'note',
            notes: note
        });
        if (selEl) selEl.value = '';
        if (noteEl) noteEl.value = '';
        if (typeof showToast === 'function') showToast('🎯 Benchmark observation saved');
        await window._rhBenchLoadObservations(takeId);
    } catch (e) {
        console.warn('[Benchmark] add failed:', e && e.message);
        if (typeof showToast === 'function') showToast('Save failed: ' + (e && e.message || 'unknown'));
    }
};

window._rhBenchLoadObservations = async function (takeId) {
    if (!window.GLBenchmark || !window.GLBenchmark.getObservationsForTake) return;
    var el = document.getElementById('rhBenchObsList_' + takeId);
    if (!el) return;
    try {
        var list = await window.GLBenchmark.getObservationsForTake(takeId);
        if (!list || !list.length) {
            el.innerHTML = '<span style="color:var(--text-dim);font-style:italic">No classifications yet.</span>';
            return;
        }
        el.innerHTML = list.map(function (o) {
            var sev = o.severity || 'info';
            var sevColor = sev === 'critical' ? '#ef4444' : sev === 'warning' ? '#f59e0b' : '#a78bfa';
            return '<div style="display:flex;gap:6px;align-items:center;padding:2px 0">'
                + '<span style="color:' + sevColor + ';font-weight:500">' + escHtml(o.classification || 'note') + '</span>'
                + (o.notes ? '<span style="color:var(--text-dim)">— ' + escHtml(o.notes) + '</span>' : '')
                + '<button onclick="window._rhBenchRemoveObservation(\'' + escHtml(o.id) + '\',\'' + escHtml(takeId) + '\')" style="margin-left:auto;font-size:0.9em;padding:0 6px;border:none;background:transparent;color:#ef4444;cursor:pointer" title="Remove">×</button>'
                + '</div>';
        }).join('');
    } catch (e) {
        el.innerHTML = '<span style="color:#ef4444">Load failed.</span>';
    }
};

window._rhBenchRemoveObservation = async function (obsId, takeId) {
    if (!window.GLBenchmark || !window.GLBenchmark.removeObservation) return;
    try {
        await window.GLBenchmark.removeObservation(obsId);
        if (typeof showToast === 'function') showToast('Removed');
        await window._rhBenchLoadObservations(takeId);
    } catch (e) {
        console.warn('[Benchmark] remove failed:', e && e.message);
    }
};

// Phase 3G: continuity authority handlers. Wired through window namespace
// so the inline-onclick attribute pattern in the lineage block works.
// All ops calibration-mode only — band members never reach these surfaces.

window._rhContAuthorityAct = async function (rehearsalId, pairKey, kind, action, takeId) {
    if (!window.GLContinuityAuthority) return;
    try {
        if (action === 'keep_separate') {
            await window.GLContinuityAuthority.markKeepSeparate(rehearsalId, pairKey, kind, '');
            if (typeof showToast === 'function') showToast('⚡ Keep Separate — next analyze will skip this pair');
        } else if (action === 'good_merge') {
            await window.GLContinuityAuthority.markGoodMerge(rehearsalId, pairKey, kind, '');
            if (typeof showToast === 'function') showToast('✓ Merge affirmed as analyst-approved');
        } else if (action === 'ignore_kind') {
            await window.GLContinuityAuthority.markIgnoreKind(rehearsalId, kind, '');
            if (typeof showToast === 'function') showToast('⚡ Ignoring all ' + kind + ' suggestions on this rehearsal');
        } else {
            return;
        }
        await window._rhContAuthorityLoad(rehearsalId, takeId);
    } catch (e) {
        console.warn('[ContAuthority] act failed:', e && e.message);
        if (typeof showToast === 'function') showToast('Decision failed: ' + (e && e.message || 'unknown'));
    }
};

window._rhContAuthorityLoad = async function (rehearsalId, takeId) {
    if (!window.GLContinuityAuthority || !window.GLContinuityAuthority.getDecisionsForSession) return;
    var el = document.getElementById('rhContAuthorityList_' + takeId);
    if (!el) return;
    try {
        // Filter to decisions touching THIS take's continuity provenance.
        var take = await (window.GLTakes && window.GLTakes.getTake ? window.GLTakes.getTake(takeId) : Promise.resolve(null));
        var ourPairKeys = {};
        if (take && take.continuity && Array.isArray(take.continuity.applied)) {
            take.continuity.applied.forEach(function (a) { if (a.pair_key) ourPairKeys[a.pair_key] = true; });
        }
        var all = await window.GLContinuityAuthority.getDecisionsForSession(rehearsalId);
        var relevant = (all || []).filter(function (d) {
            if (d && d.decision_type === 'ignore_kind') return true;
            return d && d.pair_key && ourPairKeys[d.pair_key];
        });
        if (!relevant.length) {
            el.innerHTML = '<span style="font-style:italic">No authority decisions yet.</span>';
            return;
        }
        el.innerHTML = relevant.map(function (d) {
            var color = d.decision_type === 'keep_separate' ? '#ef4444'
                      : d.decision_type === 'good_merge' ? '#10b981'
                      : '#fbbf24';
            return '<div style="display:flex;gap:6px;align-items:center;padding:2px 0">'
                + '<span style="color:' + color + ';font-weight:500">' + escHtml(d.decision_type) + '</span>'
                + (d.kind ? '<span style="color:var(--text-dim)">' + escHtml(d.kind) + '</span>' : '')
                + '<button onclick="window._rhContAuthorityRemove(\'' + escHtml(d.id) + '\',\'' + escHtml(rehearsalId) + '\',\'' + escHtml(takeId) + '\')" style="margin-left:auto;font-size:0.9em;padding:0 6px;border:none;background:transparent;color:#ef4444;cursor:pointer" title="Reverse this decision">×</button>'
                + '</div>';
        }).join('');
    } catch (e) {
        el.innerHTML = '<span style="color:#ef4444">Load failed.</span>';
    }
};

window._rhContAuthorityRemove = async function (decisionId, rehearsalId, takeId) {
    if (!window.GLContinuityAuthority || !window.GLContinuityAuthority.removeDecision) return;
    try {
        await window.GLContinuityAuthority.removeDecision(decisionId);
        if (typeof showToast === 'function') showToast('Decision reversed');
        await window._rhContAuthorityLoad(rehearsalId, takeId);
    } catch (e) {
        console.warn('[ContAuthority] remove failed:', e && e.message);
    }
};

function _rhFormatTakeDuration(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
}

// ── Take Review playback + correction handlers ──────────────────────────────

// Single auto-stop listener guard. We allow only one take to be auto-stopping
// at a time; starting a new play tears down the previous timeupdate listener.
var _rhTakeAutoStop = null;
var _rhTakeAutoStopAudio = null;  // audio element the auto-stop listener is attached to
// Phase 3I.6: single-take coordinator. Tracks which take's audio is currently
// playing so a second click on the same row toggles pause, while a click on a
// different row stops the prior take before starting the new one.
var _rhCurrentTake = null;  // { sessionId, takeId, startSec, endSec }

// Phase 3I.6: hard-stop every rehearsal audio source (shared timeline player
// + every per-card take-review element). Called before any new take play so
// only one stream runs at a time — fixes the dual-audio bug where the timeline
// element kept playing while a take row started a second stream on top.
function _rhStopAllAudio() {
    // Safety: if the Trim Preview audition is mid-play, stop it cleanly so
    // its button label + module state reset (otherwise external stops would
    // leave the ⏸ button label stuck and _rhTrimAuditionStop dangling).
    if (typeof _rhTrimAuditionStop === 'function') {
        try { _rhTrimAuditionStop(); } catch (_e) {}
    }
    try {
        if (_rhSharedAudio && !_rhSharedAudio.paused) { _rhSharedAudio.pause(); }
    } catch (e) {}
    try { _rhClearPlayState(); } catch (e) {}

    var takeAudios = document.querySelectorAll('audio[id^="rhTakeReviewAudio_"]');
    for (var i = 0; i < takeAudios.length; i++) {
        try { if (!takeAudios[i].paused) takeAudios[i].pause(); } catch (e) {}
    }

    if (_rhTakeAutoStop && _rhTakeAutoStopAudio) {
        try { _rhTakeAutoStopAudio.removeEventListener('timeupdate', _rhTakeAutoStop); } catch (e) {}
    }
    _rhTakeAutoStop = null;
    _rhTakeAutoStopAudio = null;

    if (_rhCurrentTake && _rhCurrentTake.takeId) {
        _rhSetTakeRowState(_rhCurrentTake.takeId, 'stopped');
    }
    _rhCurrentTake = null;
}

// Flip play button + show/hide inline progress controls for a take row.
// state: 'playing' | 'paused' | 'stopped'
function _rhSetTakeRowState(takeId, state) {
    var btn = document.getElementById('rhTakePlayBtn_' + takeId);
    var controls = document.getElementById('rhTakePlaying_' + takeId);
    if (btn) {
        if (state === 'playing') {
            btn.textContent = '⏸'; btn.setAttribute('aria-label', 'Pause take');
            btn.classList.add('rh-playing-btn');
        } else {
            btn.textContent = '▶'; btn.setAttribute('aria-label', 'Play take');
            btn.classList.remove('rh-playing-btn');
        }
    }
    if (controls) {
        controls.style.display = (state === 'stopped') ? 'none' : 'flex';
    }
    if (state === 'stopped') {
        var fill = document.getElementById('rhTakeProgFill_' + takeId);
        if (fill) fill.style.width = '0%';
    }
}

function _rhAttachTakeAutoStop(audio, takeId, endSec) {
    if (_rhTakeAutoStop && _rhTakeAutoStopAudio) {
        try { _rhTakeAutoStopAudio.removeEventListener('timeupdate', _rhTakeAutoStop); } catch (e) {}
    }
    _rhTakeAutoStop = function () {
        if (!audio) return;
        // Live progress UI
        var startSec = (_rhCurrentTake && _rhCurrentTake.startSec) || 0;
        var fill = document.getElementById('rhTakeProgFill_' + takeId);
        if (fill) {
            var range = endSec - startSec;
            var pct = range > 0 ? Math.max(0, Math.min(100, ((audio.currentTime - startSec) / range) * 100)) : 0;
            fill.style.width = pct + '%';
        }
        var timeEl = document.getElementById('rhTakeProgTime_' + takeId);
        if (timeEl) {
            var pos = Math.max(0, audio.currentTime - startSec);
            var tot = Math.max(0, endSec - startSec);
            timeEl.textContent = _rhFmt(pos) + ' / ' + _rhFmt(tot);
        }
        if (audio.currentTime >= endSec || audio.ended) {
            try { audio.pause(); } catch (e) {}
            try { audio.removeEventListener('timeupdate', _rhTakeAutoStop); } catch (e) {}
            _rhTakeAutoStop = null;
            _rhTakeAutoStopAudio = null;
            _rhSetTakeRowState(takeId, 'stopped');
            _rhCurrentTake = null;
        }
    };
    _rhTakeAutoStopAudio = audio;
    audio.addEventListener('timeupdate', _rhTakeAutoStop);
}

window._rhTakePlay = async function (sessionId, takeId) {
    if (typeof window.GLTakes === 'undefined') return;
    var audio = document.getElementById('rhTakeReviewAudio_' + sessionId);
    var take;
    try { take = await window.GLTakes.getTake(takeId); } catch (e) { return; }
    if (!take || !take.playback_ref) return;

    // Phase 3I.6: pause/resume toggle on the same row — avoids the surprise of
    // tearing down audio when the band just wants a brief pause.
    // Bug 2026-05-18 (Drew): only take the resume branch if the auto-stop
    // listener is still attached. After a Trim Preview audition or any
    // _rhStopAllAudio call, _rhTakeAutoStop is null even though
    // _rhCurrentTake may still be set — resuming via audio.play() then
    // leaves the row's progress bar + time display permanently frozen
    // because nothing's wired to update them. Fall through to the full
    // play path so _rhAttachTakeAutoStop reattaches.
    if (_rhCurrentTake && _rhCurrentTake.takeId === takeId && audio && _rhTakeAutoStop) {
        if (!audio.paused) {
            try { audio.pause(); } catch (e) {}
            _rhSetTakeRowState(takeId, 'paused');
        } else {
            audio.play().catch(function () {});
            _rhSetTakeRowState(takeId, 'playing');
        }
        return;
    }

    // Different take (or first play): stop everything else first.
    _rhStopAllAudio();

    // Phase 3D: if the audio element has no src yet, try to lazily resolve
    // playback from take.recording_id (or take.playback_ref.recording_id).
    // Lets a Take play even when the session's recording_url was not in
    // the original render-time resolve (e.g. browse-old-history paths).
    var takeRecId = (take.playback_ref && take.playback_ref.recording_id) || take.recording_id || null;
    if (audio && !audio.src && takeRecId && window.GLRecordings && window.GLRecordings.getRecording) {
        try {
            var rec = await window.GLRecordings.getRecording(takeRecId);
            if (rec && rec.audio_url && rec.audio_url.indexOf('blob:') !== 0) {
                audio.src = rec.audio_url;
                if (window.GLObs && window.GLObs.log) {
                    window.GLObs.log('TakeReview', 'lazy audio.src from take.recording_id', { takeId: takeId, recording_id: takeRecId });
                }
            }
        } catch (e) {}
    }

    // Bug 2026-05-17: Take Review's audio.src can be set during the initial
    // render to a raw `drive.google.com/.../view` share URL — that happens
    // when `_proxifyDriveUrl` runs before OAuth completes and finds
    // `window.accessToken` null, so it falls through and returns the original
    // URL unchanged. By the time the user clicks ▶ the token IS available, so
    // re-proxify here just before play. No-op when src is already a Worker URL.
    if (audio && audio.src && audio.src.indexOf('drive.google.com') !== -1
        && window.GLRecordings && typeof window.GLRecordings.proxifyDriveUrl === 'function') {
        var _proxied = window.GLRecordings.proxifyDriveUrl(audio.src);
        if (_proxied && _proxied !== audio.src) {
            audio.src = _proxied;
            if (window.GLObs && window.GLObs.log) {
                window.GLObs.log('TakeReview', 'lazy re-proxify audio.src at play time', { takeId: takeId });
            }
        }
    }
    if (!audio || !audio.src) {
        if (window.GLObs && window.GLObs.log) {
            window.GLObs.log('TakeReview', 'play blocked — no audio source', { takeId: takeId, take_recording_id: takeRecId });
        }
        if (typeof showToast === 'function') showToast('No audio attached to this rehearsal');
        return;
    }
    var startSec = take.playback_ref.start_sec || 0;
    var endSec = take.playback_ref.end_sec || (startSec + ((take.stats && take.stats.duration) || 0));

    _rhCurrentTake = { sessionId: sessionId, takeId: takeId, startSec: startSec, endSec: endSec };

    // Bug 2026-05-17 rev 3 (Drew): wait for the seek to complete before
    // calling play(). For Drive-streamed MP3 served via the Worker proxy, a
    // seek to a not-yet-buffered position requires a Range-request round
    // trip; if play() fires while the element is still in "seeking" state,
    // the browser plays from whatever WAS buffered (the previous pause
    // position) until the new range arrives, then jumps. The visible
    // symptom: every Preview / Play starts a few seconds away from the
    // requested boundary, and the jump amount varies per click.
    var _takeAudioSrc = audio.src;
    var played = false;
    var doPlay = function () {
        if (played) return;
        played = true;
        try { audio.removeEventListener('seeked', doPlay); } catch (_e) {}
        if (window.GLObs && window.GLObs.log) {
            window.GLObs.log('TakeReview', 'play after seek', { requested: startSec, actual: audio.currentTime, readyState: audio.readyState });
        }
        audio.play().catch(function (e) {
            var msg = e && e.message ? e.message : '';
            console.warn('[TakeReview] Play failed:', msg);
            _rhSetTakeRowState(takeId, 'stopped');
            if (_rhCurrentTake && _rhCurrentTake.takeId === takeId) _rhCurrentTake = null;
            var isWorkerStream = _takeAudioSrc && _takeAudioSrc.indexOf('/drive-stream') !== -1;
            var isRawDriveUrl = _takeAudioSrc && _takeAudioSrc.indexOf('drive.google.com') !== -1 && !isWorkerStream;
            if (isWorkerStream) {
                try {
                    fetch(_takeAudioSrc, { headers: { Range: 'bytes=0-0' } }).then(function (r) {
                        if (r.status >= 400 && r.status < 500) _rhPromptDriveRelink(sessionId);
                    }).catch(function () {});
                } catch (_pe) {}
            } else if (isRawDriveUrl) {
                _rhPromptDriveRelink(sessionId);
            }
        });
    };
    audio.addEventListener('seeked', doPlay, { once: true });
    // 800ms fallback: covers the case where 'seeked' never fires because
    // currentTime was set to a value already inside the buffered range. In
    // that case audio is already at the right place; play() is safe.
    setTimeout(doPlay, 800);
    try { audio.currentTime = startSec; } catch (e) { /* readyState not high enough yet - ignore */ }

    _rhSetTakeRowState(takeId, 'playing');
    _rhAttachTakeAutoStop(audio, takeId, endSec);
};

window._rhTakeStop = function (takeId) {
    if (!_rhCurrentTake || _rhCurrentTake.takeId !== takeId) {
        // Out-of-band stop (e.g. row re-rendered) — just clear the row UI.
        _rhSetTakeRowState(takeId, 'stopped');
        return;
    }
    var sessionId = _rhCurrentTake.sessionId;
    var audio = document.getElementById('rhTakeReviewAudio_' + sessionId);
    if (audio) {
        try { audio.pause(); } catch (e) {}
        if (_rhTakeAutoStop) {
            try { audio.removeEventListener('timeupdate', _rhTakeAutoStop); } catch (e) {}
        }
    }
    _rhTakeAutoStop = null;
    _rhTakeAutoStopAudio = null;
    _rhSetTakeRowState(takeId, 'stopped');
    _rhCurrentTake = null;
};

// Click-to-seek inside the take's [start..end] window. Restricts the seek to
// the take's own range so we never accidentally scrub into a neighbouring take.
window._rhTakeSeek = function (e, takeId) {
    if (!_rhCurrentTake || _rhCurrentTake.takeId !== takeId) return;
    var bar = document.getElementById('rhTakeProgBar_' + takeId);
    if (!bar) return;
    var audio = document.getElementById('rhTakeReviewAudio_' + _rhCurrentTake.sessionId);
    if (!audio) return;
    var rect = bar.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    var range = _rhCurrentTake.endSec - _rhCurrentTake.startSec;
    try { audio.currentTime = _rhCurrentTake.startSec + (pct * range); } catch (er) {}
};

// Bug 2026-05-18 (Drew): drag-to-seek on the take row progress bar. Mousedown
// captures, mousemove on document updates the seek continuously, mouseup
// releases. Uses the same bar/range math as _rhTakeSeek above.
window._rhTakeBarDragStart = function (e, takeId) {
    if (!_rhCurrentTake || _rhCurrentTake.takeId !== takeId) return;
    var bar = document.getElementById('rhTakeProgBar_' + takeId);
    var audio = document.getElementById('rhTakeReviewAudio_' + _rhCurrentTake.sessionId);
    if (!bar || !audio) return;
    e.preventDefault();
    function seekAt(clientX) {
        var rect = bar.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        var range = _rhCurrentTake.endSec - _rhCurrentTake.startSec;
        try { audio.currentTime = _rhCurrentTake.startSec + (pct * range); } catch (_e) {}
    }
    function onMove(ev) { seekAt(ev.clientX); }
    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    seekAt(e.clientX);
};

// ── Phase 3I.6: boundary editor ──────────────────────────────────────────────
// Numeric start/end inputs + a Preview button that plays the proposed slice
// without persisting, plus Save that writes playback_ref back to Firebase.
// Tightening boundaries here directly improves what Bootstrap sends to the
// embedding bank, so the sound bank stays clean.
// Bug 2026-05-17: Trim editor UX redesign per Drew's feedback. Original UI
// showed raw absolute seconds (e.g. Start 11152.2 / End 11878.9 for a take
// at 3:05:52 into the rehearsal) — forced mental math against the playback
// progress bar that displays mm:ss. New design:
//   • mm:ss inputs RELATIVE to the take's original start (0:00 → 12:06.7)
//   • Nudge buttons (-1s / -0.1 / +0.1 / +1s) for fast fine-tuning
//   • 📍 From playhead — capture current audio position as start or end
//   • The take's absolute anchor in rehearsal time shown once at the top
// Internally still saves absolute start_sec/end_sec to playback_ref so the
// rest of the pipeline (Bootstrap, preview, embedding bank) is unchanged.

// Parse "mm:ss", "mm:ss.s", "h:mm:ss", or raw seconds → seconds.
// Bug 2026-05-17 (Drew): accept leading "-" or "−" so users can extend a
// boundary BEFORE the take's current saved start (e.g. "−0:05.0" = 5s earlier
// than the anchor). Lets a too-aggressive trim be undone in place without
// having to re-analyze.
function _rhParseTrimTime(str) {
    if (str == null) return NaN;
    str = String(str).trim();
    if (!str) return NaN;
    var neg = false;
    if (str.charAt(0) === '-' || str.charAt(0) === '−') {
        neg = true;
        str = str.slice(1).trim();
    }
    var sign = neg ? -1 : 1;
    if (/^\d+(\.\d+)?$/.test(str)) return sign * parseFloat(str);
    var hms = str.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (hms) return sign * (parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseFloat(hms[3]));
    var ms = str.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (ms) return sign * (parseInt(ms[1], 10) * 60 + parseFloat(ms[2]));
    return NaN;
}

// Format seconds as "m:ss.s" or "−m:ss.s" (1 decimal). Negative values mean
// "earlier than the take's current saved start" — used when expanding the
// trim window backward to recover from an over-aggressive earlier save.
function _rhFmtTrimTime(sec) {
    sec = sec || 0;
    var neg = sec < 0;
    sec = Math.abs(sec);
    var m = Math.floor(sec / 60);
    var s = sec - m * 60;
    return (neg ? '−' : '') + m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

// Format absolute rehearsal seconds as "h:mm:ss" or "m:ss" — used to label
// where the take sits in the rehearsal (purely informational, integer
// precision is fine here).
function _rhFmtAbsTime(sec) {
    sec = Math.max(0, sec || 0);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}

// Same as _rhFmtAbsTime but with 1-decimal seconds precision. Used for the
// active Start / End readouts in the Trim editor so −0.1 / +0.1 nudges
// produce a visible change every click. Bug 2026-05-17 (Drew): integer-only
// display made small nudges look like nothing happened until 10 clicks
// crossed a whole-second boundary, at which point the display jumped a
// full second — felt like the buttons were applying way more than +0.1.
function _rhFmtAbsTimeFine(sec) {
    sec = Math.max(0, sec || 0);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec - h * 3600 - m * 60;
    var padI = function (n) { return (n < 10 ? '0' : '') + n; };
    var padF = function (x) { return (x < 10 ? '0' : '') + x.toFixed(1); };
    return h > 0 ? h + ':' + padI(m) + ':' + padF(s) : m + ':' + padF(s);
}

// Bug 2026-05-17 (Drew rev 2): full Trim editor rewrite.
//
// Symptoms reported:
//   (a) Save → re-open shows the take starting "too far into the song" —
//       the underlying playback_ref wrote correctly, but _rhTakePlay's
//       same-row pause/resume branch was bypassing the new boundaries.
//   (b) After save the take "just sits on pause" until the user clicks
//       another take and comes back — same coordinator-state staleness.
//   (c) Relative-to-anchor mm:ss display was confusing because the anchor
//       shifted with every save ("end keeps changing").
//   (d) Numeric inputs forced mental math; UX ask was a drag-slider for
//       rough placement + fine-tune nudges for precision.
//
// New design:
//   • Single horizontal slider with two draggable handles (S and E).
//   • Readouts show ABSOLUTE mm:ss (or h:mm:ss) into the rehearsal — no
//     more anchor-relative confusion. The values mean what they say.
//   • Nudge buttons (−1s / −0.1 / +0.1 / +1s) and 📍 From playhead per
//     boundary — fine-tune after rough drag.
//   • Slider window = take's current ± 60s, clamped to the recording
//     duration. Lets users extend a too-aggressive trim earlier OR later.
//   • State lives on `data-start-abs` / `data-end-abs` on the form's inner
//     wrapper, so the slider + readouts + nudge buttons + save all read
//     from a single source of truth. No string round-tripping.
//   • Save calls _rhStopAllAudio() to bust _rhCurrentTake — fixes the
//     "sits on pause / starts too far in" coordinator-staleness bugs.
// Trim Preview audition controls (2026-05-22).
// Drew asked for an audition-length picker on top of the existing fixed 2.0s
// audition. Three settings ship: 1s / 2s / 4s + hold. Hold mode skips the
// auto-pause so the user can listen as long as they want (toggle ▶ to stop).
// The picked mode persists in localStorage so the editor opens at the user's
// preferred setting next time.
var _rhTrimAuditionStop = null; // function while audition is active; null otherwise

function _rhGetAuditionMode() {
    try {
        var saved = localStorage.getItem('gl_rh_trim_audition_mode');
        if (saved === '1' || saved === '2' || saved === '4' || saved === 'hold') return saved;
    } catch (_e) {}
    return '2';
}

window._rhTakeSetAuditionMode = function (mode) {
    if (mode !== '1' && mode !== '2' && mode !== '4' && mode !== 'hold') return;
    try { localStorage.setItem('gl_rh_trim_audition_mode', mode); } catch (_e) {}
    _rhRefreshAuditionPickers();
};

function _rhRefreshAuditionPickers() {
    var mode = _rhGetAuditionMode();
    var pickers = document.querySelectorAll('[data-rh-audition-picker]');
    for (var i = 0; i < pickers.length; i++) {
        var btns = pickers[i].querySelectorAll('[data-mode]');
        for (var j = 0; j < btns.length; j++) {
            var b = btns[j];
            var on = (b.getAttribute('data-mode') === mode);
            b.style.background = on ? 'rgba(99,102,241,0.18)' : 'transparent';
            b.style.color = on ? '#a5b4fc' : 'var(--text-dim)';
        }
    }
}

function _rhUpdatePreviewButton(takeId, isPlaying) {
    var btn = document.getElementById('rhTrimPreviewBtn_' + takeId);
    if (!btn) return;
    btn.textContent = isPlaying ? '⏸ Stop preview' : '▶ Preview slice';
}

window._rhTakeOpenBoundaries = async function (sessionId, takeId) {
    var holder = document.getElementById('rhTakeBoundaryForm_' + takeId);
    if (!holder) return;
    if (holder.style.display !== 'none') {
        holder.style.display = 'none';
        holder.innerHTML = '';
        return;
    }
    holder.style.display = '';
    holder.innerHTML = '<div style="font-size:0.7em;color:var(--text-dim)">Loading…</div>';
    var take;
    try { take = await window.GLTakes.getTake(takeId); } catch (e) { holder.innerHTML = ''; return; }
    if (!take) { holder.innerHTML = ''; return; }
    var pref = take.playback_ref || {};
    var s = (typeof pref.start_sec === 'number') ? pref.start_sec : 0;
    var ee = (typeof pref.end_sec === 'number') ? pref.end_sec : (s + ((take.stats && take.stats.duration) || 0));

    // Slider window. Default ± 60s of headroom around the current take so
    // users can drag the handles into territory the take doesn't currently
    // cover (recover from over-aggressive earlier trims, or extend forward).
    // Upper bound clamped to the audio element's known duration if available;
    // otherwise we let the slider go up to anchor+endPad and rely on Save's
    // bounds check.
    var WIN_PAD = 60;
    var winStart = Math.max(0, s - WIN_PAD);
    var winEnd = ee + WIN_PAD;
    var audioEl = document.getElementById('rhTakeReviewAudio_' + sessionId);
    if (audioEl && Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
        winEnd = Math.min(winEnd, audioEl.duration);
    }
    if (winEnd <= winStart) winEnd = winStart + (ee - s) + 1;

    var tid = escHtml(takeId);
    var sid = escHtml(sessionId);

    function nudgeBtn(which, delta, label) {
        return '<button onclick="window._rhTakeNudgeBoundary(\'' + tid + '\',\'' + which + '\',' + delta + ')" '
            + 'style="padding:3px 7px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:var(--text-dim);cursor:pointer;font-size:0.85em;font-family:ui-monospace,monospace">'
            + label + '</button>';
    }
    function playheadBtn(which) {
        return '<button onclick="window._rhTakeBoundaryFromPlayhead(\'' + sid + '\',\'' + tid + '\',\'' + which + '\')" '
            + 'title="Set ' + which + ' to where the audio is currently playing. Hit ▶ on the take row first, scrub to the right moment, then tap this." '
            + 'style="padding:3px 8px;border-radius:4px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#818cf8;cursor:pointer;font-size:0.82em;font-weight:600">'
            + '📍 From playhead</button>';
    }
    function row(which, label) {
        var readId = 'rhTrim' + (which === 'start' ? 'Start' : 'End') + 'Read_' + tid;
        return '<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:5px;font-size:0.72em">'
            + '<span style="color:' + (which === 'start' ? '#86efac' : '#fca5a5') + ';min-width:46px;font-weight:700">' + label + '</span>'
            + '<span id="' + readId + '" style="font-family:ui-monospace,monospace;color:#e2e8f0;min-width:78px;padding:3px 8px;border-radius:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);text-align:right"></span>'
            + nudgeBtn(which, -1, '−1s')
            + nudgeBtn(which, -0.1, '−0.1')
            + nudgeBtn(which, 0.1, '+0.1')
            + nudgeBtn(which, 1, '+1s')
            + playheadBtn(which)
            + '</div>';
    }

    holder.innerHTML = '<div'
        + ' data-win-start="' + winStart + '"'
        + ' data-win-end="' + winEnd + '"'
        + ' data-start-abs="' + s + '"'
        + ' data-end-abs="' + ee + '"'
        + ' style="padding:10px;border:1px dashed rgba(167,139,250,0.3);background:rgba(167,139,250,0.04);border-radius:6px">'
        + '<div style="font-size:0.66em;color:#a78bfa;font-weight:700;margin-bottom:4px">⏱ Trim boundaries</div>'
        + '<div style="font-size:0.62em;color:var(--text-dim);margin-bottom:10px;line-height:1.5">'
            + 'Drag the <span style="color:#86efac;font-weight:700">S</span> and <span style="color:#fca5a5;font-weight:700">E</span> handles below for rough placement, then nudge or tap <strong>📍 From playhead</strong> for precision. Times are <strong>mm:ss into the rehearsal recording</strong>.'
        + '</div>'
        // Slider
        + '<div id="rhTrimSlider_' + tid + '" style="position:relative;height:28px;margin:6px 14px 18px;touch-action:none;user-select:none">'
            + '<div style="position:absolute;left:0;right:0;top:11px;height:6px;background:rgba(255,255,255,0.08);border-radius:3px"></div>'
            + '<div id="rhTrimFill_' + tid + '" style="position:absolute;top:11px;height:6px;background:linear-gradient(90deg,#86efac,#fca5a5);border-radius:3px"></div>'
            + '<div id="rhTrimThumbStart_' + tid + '" data-which="start" style="position:absolute;top:0;width:28px;height:28px;background:#0f172a;border:2.5px solid #22c55e;border-radius:50%;cursor:grab;transform:translateX(-50%);box-shadow:0 2px 8px rgba(34,197,94,0.35);display:flex;align-items:center;justify-content:center;font-size:0.65em;font-weight:800;color:#86efac">S</div>'
            + '<div id="rhTrimThumbEnd_' + tid + '" data-which="end" style="position:absolute;top:0;width:28px;height:28px;background:#0f172a;border:2.5px solid #ef4444;border-radius:50%;cursor:grab;transform:translateX(-50%);box-shadow:0 2px 8px rgba(239,68,68,0.35);display:flex;align-items:center;justify-content:center;font-size:0.65em;font-weight:800;color:#fca5a5">E</div>'
        + '</div>'
        // Window range label
        + '<div style="display:flex;justify-content:space-between;font-size:0.55em;color:var(--text-dim);margin:-12px 14px 10px;font-family:ui-monospace,monospace">'
            + '<span>' + _rhFmtAbsTime(winStart) + '</span>'
            + '<span id="rhTrimDuration_' + tid + '" style="color:#a78bfa">take length: 0:00.0</span>'
            + '<span>' + _rhFmtAbsTime(winEnd) + '</span>'
        + '</div>'
        + row('start', 'Start')
        + row('end', 'End')
        + '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">'
            + '<button id="rhTrimPreviewBtn_' + tid + '" onclick="window._rhTakePreviewBoundaries(\'' + sid + '\',\'' + tid + '\')" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#818cf8;cursor:pointer;font-size:0.85em;font-weight:600">▶ Preview slice</button>'
            // Audition-length picker (1s / 2s / 4s / hold). Mode persists in
            // localStorage; `hold` disables auto-pause so user toggles ▶ to stop.
            + '<span data-rh-audition-picker style="display:inline-flex;border:1px solid rgba(255,255,255,0.08);border-radius:6px;overflow:hidden;font-family:ui-monospace,monospace;font-size:0.74em" title="How long ▶ Preview plays before auto-pausing. hold = play until you stop it.">'
                + '<button onclick="window._rhTakeSetAuditionMode(\'1\')" data-mode="1" style="padding:5px 9px;border:none;background:transparent;color:var(--text-dim);cursor:pointer;font-family:inherit;font-size:inherit">1s</button>'
                + '<button onclick="window._rhTakeSetAuditionMode(\'2\')" data-mode="2" style="padding:5px 9px;border:none;border-left:1px solid rgba(255,255,255,0.08);background:transparent;color:var(--text-dim);cursor:pointer;font-family:inherit;font-size:inherit">2s</button>'
                + '<button onclick="window._rhTakeSetAuditionMode(\'4\')" data-mode="4" style="padding:5px 9px;border:none;border-left:1px solid rgba(255,255,255,0.08);background:transparent;color:var(--text-dim);cursor:pointer;font-family:inherit;font-size:inherit">4s</button>'
                + '<button onclick="window._rhTakeSetAuditionMode(\'hold\')" data-mode="hold" style="padding:5px 9px;border:none;border-left:1px solid rgba(255,255,255,0.08);background:transparent;color:var(--text-dim);cursor:pointer;font-family:inherit;font-size:inherit">hold</button>'
            + '</span>'
            + '<span id="rhTrimNowPlaying_' + tid + '" style="font-family:ui-monospace,monospace;font-size:0.72em;color:var(--text-dim);min-width:120px">ready</span>'
            + '<button onclick="window._rhTakeSaveBoundaries(\'' + sid + '\',\'' + tid + '\')" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(16,185,129,0.4);background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer;font-size:0.85em;font-weight:600">💾 Save</button>'
            + '<button onclick="window._rhTakeCancelBoundaries(\'' + tid + '\')" style="padding:6px 10px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--text-dim);cursor:pointer;font-size:0.85em">Cancel</button>'
        + '</div>'
        + '</div>';

    _rhTrimUpdateView(takeId);
    _rhTrimAttachDrag(takeId);
    _rhRefreshAuditionPickers();
};

// Sync the slider thumbs + readouts + fill-bar + duration label to the
// current `data-start-abs` / `data-end-abs` values stamped on the form
// wrapper. Idempotent — call any time state changes.
function _rhTrimUpdateView(takeId) {
    var holder = document.getElementById('rhTakeBoundaryForm_' + takeId);
    var inner = holder && holder.firstChild;
    if (!inner || !inner.dataset) return;
    var winStart = parseFloat(inner.dataset.winStart || '0');
    var winEnd = parseFloat(inner.dataset.winEnd || '0');
    var startAbs = parseFloat(inner.dataset.startAbs);
    var endAbs = parseFloat(inner.dataset.endAbs);
    var winSpan = winEnd - winStart;
    if (winSpan <= 0) return;
    var startPct = Math.max(0, Math.min(100, (startAbs - winStart) / winSpan * 100));
    var endPct = Math.max(0, Math.min(100, (endAbs - winStart) / winSpan * 100));

    var thumbS = document.getElementById('rhTrimThumbStart_' + takeId);
    var thumbE = document.getElementById('rhTrimThumbEnd_' + takeId);
    var fill = document.getElementById('rhTrimFill_' + takeId);
    if (thumbS) thumbS.style.left = startPct + '%';
    if (thumbE) thumbE.style.left = endPct + '%';
    if (fill) { fill.style.left = startPct + '%'; fill.style.width = Math.max(0, endPct - startPct) + '%'; }

    var startRead = document.getElementById('rhTrimStartRead_' + takeId);
    var endRead = document.getElementById('rhTrimEndRead_' + takeId);
    var durRead = document.getElementById('rhTrimDuration_' + takeId);
    // Use the .s-precision variant so every −0.1 / +0.1 nudge produces a
    // visible change. Integer-only display rounded sub-second adjustments
    // away and made small nudges look like they did nothing until ~10
    // clicks accumulated into a whole-second jump.
    if (startRead) startRead.textContent = _rhFmtAbsTimeFine(startAbs);
    if (endRead) endRead.textContent = _rhFmtAbsTimeFine(endAbs);
    if (durRead) durRead.textContent = 'take length: ' + _rhFmtTrimTime(Math.max(0, endAbs - startAbs));
}

// Mouse + touch drag handlers for the two slider thumbs. Attaches listeners
// to `document` so a fast drag that leaves the thumb still tracks correctly.
// Removes them on mouseup/touchend so the editor can be re-opened cleanly.
function _rhTrimAttachDrag(takeId) {
    var slider = document.getElementById('rhTrimSlider_' + takeId);
    if (!slider) return;
    var holder = document.getElementById('rhTakeBoundaryForm_' + takeId);
    var inner = holder && holder.firstChild;
    if (!inner) return;

    var dragging = null;
    function pctToAbs(clientX) {
        var rect = slider.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        var winStart = parseFloat(inner.dataset.winStart || '0');
        var winEnd = parseFloat(inner.dataset.winEnd || '0');
        return winStart + pct * (winEnd - winStart);
    }
    function applyDrag(clientX) {
        if (!dragging) return;
        var abs = pctToAbs(clientX);
        var startAbs = parseFloat(inner.dataset.startAbs);
        var endAbs = parseFloat(inner.dataset.endAbs);
        if (dragging === 'start') {
            if (abs >= endAbs) abs = endAbs - 0.1;
            if (abs < 0) abs = 0;
            inner.dataset.startAbs = String(abs);
        } else {
            if (abs <= startAbs) abs = startAbs + 0.1;
            inner.dataset.endAbs = String(abs);
        }
        _rhTrimUpdateView(takeId);
    }

    function onMouseDown(e) {
        var t = e.target;
        if (t && t.dataset && (t.dataset.which === 'start' || t.dataset.which === 'end')) {
            dragging = t.dataset.which;
            try { t.style.cursor = 'grabbing'; } catch (_e) {}
            e.preventDefault();
        }
    }
    function onMouseMove(e) { if (dragging) applyDrag(e.clientX); }
    function onMouseUp() {
        if (!dragging) return;
        var t = document.getElementById('rhTrimThumb' + (dragging === 'start' ? 'Start' : 'End') + '_' + takeId);
        if (t) try { t.style.cursor = 'grab'; } catch (_e) {}
        dragging = null;
    }
    function onTouchStart(e) {
        var t = e.target;
        if (t && t.dataset && (t.dataset.which === 'start' || t.dataset.which === 'end')) {
            dragging = t.dataset.which;
            e.preventDefault();
        }
    }
    function onTouchMove(e) {
        if (dragging && e.touches && e.touches.length) {
            applyDrag(e.touches[0].clientX);
            e.preventDefault();
        }
    }
    function onTouchEnd() { dragging = null; }

    slider.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    slider.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
}

// Nudge a boundary by a fixed delta (seconds). Works against absolute
// times stored in the form's dataset; cross-boundary + window-bounds
// clamps applied. Re-syncs the slider via _rhTrimUpdateView.
//
// 2026-05-17 instrumentation: console.log the delta and resulting absolute
// values per click so Drew can confirm whether the dataset is changing by
// exactly the expected delta (and not by some larger amount). If audio is
// playing, the audio element is NOT touched here — this handler only
// updates the editor state. If Drew sees audio "skipping forward" on +0.1
// clicks, the bug isn't here; the next thing to check is the auto-stop /
// progress-bar listener or the slider drag.
window._rhTakeNudgeBoundary = function (takeId, which, delta) {
    var holder = document.getElementById('rhTakeBoundaryForm_' + takeId);
    var inner = holder && holder.firstChild;
    if (!inner || !inner.dataset) return;
    var winStart = parseFloat(inner.dataset.winStart || '0');
    var winEnd = parseFloat(inner.dataset.winEnd || '0');
    var startAbs = parseFloat(inner.dataset.startAbs);
    var endAbs = parseFloat(inner.dataset.endAbs);
    var beforeStart = startAbs;
    var beforeEnd = endAbs;
    if (which === 'start') {
        var nextS = startAbs + delta;
        if (nextS < winStart) nextS = winStart;
        if (nextS >= endAbs) nextS = endAbs - 0.1;
        if (nextS < 0) nextS = 0;
        inner.dataset.startAbs = String(nextS);
    } else {
        var nextE = endAbs + delta;
        if (nextE > winEnd) nextE = winEnd;
        if (nextE <= startAbs) nextE = startAbs + 0.1;
        inner.dataset.endAbs = String(nextE);
    }
    _rhTrimUpdateView(takeId);
    console.log('[Trim nudge]', which, 'delta', delta,
        '| startAbs', beforeStart, '→', inner.dataset.startAbs,
        '| endAbs', beforeEnd, '→', inner.dataset.endAbs);
};

// Capture the take-review audio element's current playback position as the
// new absolute start- or end-time. Useful workflow: hit ▶ on the take row,
// scrub to the desired moment, tap 📍 From playhead.
window._rhTakeBoundaryFromPlayhead = function (sessionId, takeId, which) {
    var audio = document.getElementById('rhTakeReviewAudio_' + sessionId);
    if (!audio || !audio.src) {
        if (typeof showToast === 'function') showToast('Hit ▶ on the take first, then tap From playhead');
        return;
    }
    var holder = document.getElementById('rhTakeBoundaryForm_' + takeId);
    var inner = holder && holder.firstChild;
    if (!inner || !inner.dataset) return;
    var winStart = parseFloat(inner.dataset.winStart || '0');
    var winEnd = parseFloat(inner.dataset.winEnd || '0');
    var startAbs = parseFloat(inner.dataset.startAbs);
    var endAbs = parseFloat(inner.dataset.endAbs);
    var abs = audio.currentTime;
    if (abs < winStart) abs = winStart;
    if (abs > winEnd) abs = winEnd;
    if (which === 'start') {
        if (abs >= endAbs) abs = endAbs - 0.1;
        inner.dataset.startAbs = String(abs);
    } else {
        if (abs <= startAbs) abs = startAbs + 0.1;
        inner.dataset.endAbs = String(abs);
    }
    _rhTrimUpdateView(takeId);
    if (typeof showToast === 'function') showToast('✓ ' + (which === 'start' ? 'Start' : 'End') + ' → ' + _rhFmtAbsTimeFine(abs));
};

window._rhTakeCancelBoundaries = function (takeId) {
    var holder = document.getElementById('rhTakeBoundaryForm_' + takeId);
    if (!holder) return;
    // Stop any in-flight Trim Preview audition (esp. hold mode, which doesn't
    // auto-pause). _rhStopAllAudio calls _rhTrimAuditionStop if set.
    try { _rhStopAllAudio(); } catch (_e) {}
    holder.style.display = 'none';
    holder.innerHTML = '';
};

function _rhReadBoundaryInputs(takeId) {
    // 2026-05-17 rev 2: read directly from the form wrapper's data-start-abs
    // / data-end-abs (the single source of truth for the slider + nudges +
    // playhead all share). No more parsing relative mm:ss strings.
    var holder = document.getElementById('rhTakeBoundaryForm_' + takeId);
    var inner = holder && holder.firstChild;
    if (!inner || !inner.dataset) return null;
    var s = parseFloat(inner.dataset.startAbs);
    var e = parseFloat(inner.dataset.endAbs);
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
        if (typeof showToast === 'function') showToast('Trim state missing — close and re-open the editor');
        return null;
    }
    if (!(s >= 0)) {
        if (typeof showToast === 'function') showToast('Start can’t go before the beginning of the rehearsal recording.');
        return null;
    }
    if (!(e > s)) {
        if (typeof showToast === 'function') showToast('End must be after start.');
        return null;
    }
    return { start: s, end: e };
}

window._rhTakePreviewBoundaries = function (sessionId, takeId) {
    // Toggle: if an audition is currently running, this click stops it.
    // Applies to all modes (1s/2s/4s/hold) — user can always stop early.
    if (typeof _rhTrimAuditionStop === 'function') {
        try { _rhTrimAuditionStop(); } catch (_e) {}
        return;
    }
    var bounds = _rhReadBoundaryInputs(takeId);
    if (!bounds) return;
    var audio = document.getElementById('rhTakeReviewAudio_' + sessionId);
    if (!audio || !audio.src) {
        if (typeof showToast === 'function') showToast('No audio attached — cannot preview');
        return;
    }
    // Bug 2026-05-18 (Drew): audio.src was set during the initial Take
    // Review render via resolvePlaybackSource → _proxifyDriveUrl. If
    // window.accessToken wasn't available at render time, proxify fell
    // through and stored the raw drive.google.com/.../view URL — that URL
    // is an HTML viewer page, not a media stream. Browser loads it as
    // audio, reports duration: NaN, and "plays" silently forever (pause
    // icon shown but no sound). The seek precision diagnostic confirmed
    // currentTime accepts any value when no real media is loaded, which
    // is what made this look like an audio-precision issue.
    //
    // _rhTakePlay already has the same fix at line 5984. Mirror it here
    // so the Preview path catches the same stale-token case.
    if (audio.src.indexOf('drive.google.com') !== -1
        && window.GLRecordings && typeof window.GLRecordings.proxifyDriveUrl === 'function') {
        var _proxied = window.GLRecordings.proxifyDriveUrl(audio.src);
        if (_proxied && _proxied !== audio.src) {
            audio.src = _proxied;
            if (window.GLObs && window.GLObs.log) {
                window.GLObs.log('TakePreview', 'lazy re-proxify audio.src at preview time', { takeId: takeId });
            }
        }
    }
    _rhStopAllAudio();
    _rhCurrentTake = { sessionId: sessionId, takeId: takeId, startSec: bounds.start, endSec: bounds.end };

    // Bug 2026-05-18 (Drew) — fixed-duration audition + canplay wait + live readout.
    //
    // Earlier diagnostic proved seeks land at the requested time to within
    // microseconds. But variable startup latency (~300ms cold / ~50ms warm
    // buffer) meant each Preview click played a different *amount* of music
    // before the user paused — making the seek shift feel like multi-second
    // drift instead of the actual 0.1s difference.
    //
    // Fix:
    //  1) Wait for readyState >= 3 (HAVE_FUTURE_DATA) before play() so cold
    //     and warm clicks have the same perceived startup latency.
    //  2) Audition AUDITION_SEC of audio time, then auto-pause via timeupdate.
    //     Length picker (2026-05-22): 1s / 2s / 4s — same length every time
    //     within a mode so 0.1s shifts stay audibly comparable. `hold` mode
    //     skips the auto-stop entirely so users can listen as long as needed.
    //  3) Live currentTime readout in the boundary editor so the user can
    //     SEE the seek shifted by 0.1s in addition to hearing it.
    var mode = _rhGetAuditionMode();
    var AUDITION_SEC = (mode === 'hold') ? null : parseFloat(mode);
    var nowEl = document.getElementById('rhTrimNowPlaying_' + takeId);
    var stopAt = (AUDITION_SEC === null) ? null : bounds.start + AUDITION_SEC;
    var played = false;
    var stopped = false;
    var tickHandler = null;

    function _setNow(text, color) {
        if (!nowEl) return;
        nowEl.textContent = text;
        nowEl.style.color = color || 'var(--text-dim)';
    }

    function _stopAudition() {
        if (stopped) return;
        stopped = true;
        try { audio.pause(); } catch (_e) {}
        if (tickHandler) {
            try { audio.removeEventListener('timeupdate', tickHandler); } catch (_e) {}
            tickHandler = null;
        }
        _setNow('paused @ ' + _rhFmtAbsTimeFine(audio.currentTime), '#94a3b8');
        _rhSetTakeRowState(takeId, 'paused');
        _rhTrimAuditionStop = null;
        _rhUpdatePreviewButton(takeId, false);
    }
    _rhTrimAuditionStop = _stopAudition;
    _rhUpdatePreviewButton(takeId, true);

    function _startPlayback() {
        if (played) return;
        played = true;
        try { audio.removeEventListener('canplay', _startPlayback); } catch (_e) {}
        if (window.GLObs && window.GLObs.log) {
            window.GLObs.log('TakePreview', 'audition start', {
                requested: bounds.start,
                actual: audio.currentTime,
                readyState: audio.readyState,
                mode: mode
            });
        }
        tickHandler = function () {
            if (stopped) return;
            _setNow('▶ ' + _rhFmtAbsTimeFine(audio.currentTime), '#a78bfa');
            if (stopAt !== null && audio.currentTime >= stopAt) _stopAudition();
        };
        audio.addEventListener('timeupdate', tickHandler);
        audio.play().catch(function () {});
    }

    function _seekThenWait() {
        try { audio.currentTime = bounds.start; } catch (e) {}
        _setNow('buffering…', '#fbbf24');
        // Wait for readyState >= 3 before play. Use 'canplay' event; also
        // do a synchronous check in case we're already there.
        if (audio.readyState >= 3) {
            _startPlayback();
        } else {
            audio.addEventListener('canplay', _startPlayback, { once: true });
            // Safety timeout — if canplay never fires (slow network), play
            // anyway after 2.5s so the user isn't stuck on "buffering…".
            setTimeout(function () { if (!played) _startPlayback(); }, 2500);
        }
    }

    if (audio.readyState < 1) {
        audio.addEventListener('loadedmetadata', _seekThenWait, { once: true });
        setTimeout(function () { if (!played) _seekThenWait(); }, 5000);
    } else {
        _seekThenWait();
    }
    _rhSetTakeRowState(takeId, 'playing');
};

window._rhTakeSaveBoundaries = async function (sessionId, takeId) {
    var bounds = _rhReadBoundaryInputs(takeId);
    if (!bounds) return;
    if (typeof window.GLTakes === 'undefined' || !window.GLTakes.updateTake || !window.GLTakes.getTake) return;
    var existing;
    try { existing = await window.GLTakes.getTake(takeId); } catch (e) { existing = null; }
    var pref = (existing && existing.playback_ref) || {};
    var stats = (existing && existing.stats) || {};
    var newPref = {
        start_sec: bounds.start,
        end_sec: bounds.end
    };
    if (typeof pref.recording_id === 'string') newPref.recording_id = pref.recording_id;
    try {
        await window.GLTakes.updateTake(takeId, {
            playback_ref: newPref,
            stats: Object.assign({}, stats, { duration: bounds.end - bounds.start })
        });
        console.log('[TakeReview] boundary save persisted', { takeId: takeId, start_sec: bounds.start, end_sec: bounds.end });
        if (typeof showToast === 'function') showToast('✓ Boundaries saved (' + bounds.start.toFixed(1) + 's → ' + bounds.end.toFixed(1) + 's)');
    } catch (e) {
        console.warn('[TakeReview] boundary save failed:', e && e.message);
        if (typeof showToast === 'function') showToast('Save failed: ' + (e && e.message || 'unknown'));
        return;
    }
    // Bug 2026-05-17 (Drew session): on re-open, the take editor sometimes
    // showed the OLD boundaries — the 60-second cache window inside GLTakes
    // could serve stale data even after a successful write. Force a refresh
    // before the re-render so the cache reflects what we just wrote AND any
    // server-side reconciliation.
    try { if (window.GLTakes && window.GLTakes.refreshCache) await window.GLTakes.refreshCache(); } catch (e) {}
    // Bug 2026-05-17 rev 2 (Drew): bust the audio coordinator state so the
    // next click on this take row goes through the full play path with the
    // NEW boundaries. Without this, _rhTakePlay's pause/resume toggle branch
    // (which checks _rhCurrentTake.takeId === takeId and skips re-reading
    // playback_ref) silently played from the prior pause position — making
    // the take appear to "start too far into the song" or "sit on pause".
    try { _rhStopAllAudio(); } catch (e) {}
    // Re-render the card so the new duration / start_sec ordering reflects.
    var container = document.getElementById('rhTimelineSection');
    if (!container) return;
    var session;
    try {
        var _rsLoadById = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadById);
        if (_rsLoadById) session = await GLStore.RehearsalSession.loadById(sessionId);
    } catch (e) {}
    try { _rhRenderTakeReview(container, sessionId, session || {}); } catch (e) {}
    // Bug 2026-05-17 (Drew): after the re-render, the just-saved take used to
    // disappear off-screen because the browser dropped its scroll anchor when
    // the entire card got swapped out — landed back at the top of the take
    // list. Find the take's row after re-render and scroll it back into view
    // so the user can immediately verify the result of their edit.
    // requestAnimationFrame waits for the new DOM to paint before scrolling.
    requestAnimationFrame(function () {
        try {
            var row = document.querySelector('.rh-take-row[data-take-id="' + takeId.replace(/"/g, '\\"') + '"]');
            if (row && typeof row.scrollIntoView === 'function') {
                row.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        } catch (_e) {}
    });
};

window._rhTakeQuickAssign = async function (sessionId, takeId, songTitle) {
    if (!takeId || !songTitle) return;
    return _rhTakeAssign(sessionId, takeId, songTitle);
};

window._rhTakeOpenCorrect = function (sessionId, takeId) {
    var holder = document.getElementById('rhTakeCorrectForm_' + takeId);
    if (!holder) return;
    if (holder.style.display !== 'none') {
        holder.style.display = 'none';
        holder.innerHTML = '';
        return;
    }
    holder.style.display = '';
    var songs = (typeof allSongs !== 'undefined' && Array.isArray(allSongs)) ? allSongs : [];
    var listId = 'rhTakeSongList_' + takeId;
    var options = songs.slice(0, 400).map(function (s) {
        if (!s || !s.title) return '';
        return '<option value="' + escHtml(s.title) + '">';
    }).join('');
    holder.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">'
        + '<input type="text" list="' + listId + '" placeholder="Type or pick a song…" id="rhTakeCorrectInput_' + escHtml(takeId) + '" '
        + 'style="flex:1;min-width:140px;max-width:260px;padding:5px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:inherit;font-size:0.78em"'
        + ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();window._rhTakeSubmitCorrect(\'' + escHtml(sessionId) + '\',\'' + escHtml(takeId) + '\')}">'
        + '<datalist id="' + listId + '">' + options + '</datalist>'
        + '<button onclick="window._rhTakeSubmitCorrect(\'' + escHtml(sessionId) + '\',\'' + escHtml(takeId) + '\')" style="padding:5px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#818cf8;cursor:pointer;font-size:0.72em">Save</button>'
        + '<button onclick="window._rhTakeCancelCorrect(\'' + escHtml(takeId) + '\')" style="padding:5px 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--text-dim);cursor:pointer;font-size:0.72em">Cancel</button>'
        + '</div>';
    var input = document.getElementById('rhTakeCorrectInput_' + takeId);
    if (input) { try { input.focus(); } catch (e) {} }
};

window._rhTakeCancelCorrect = function (takeId) {
    var holder = document.getElementById('rhTakeCorrectForm_' + takeId);
    if (!holder) return;
    holder.style.display = 'none';
    holder.innerHTML = '';
};

window._rhTakeSubmitCorrect = function (sessionId, takeId) {
    var input = document.getElementById('rhTakeCorrectInput_' + takeId);
    var val = input ? (input.value || '').trim() : '';
    if (!val) {
        if (typeof showToast === 'function') showToast('Pick a song first');
        return;
    }
    return _rhTakeAssign(sessionId, takeId, val);
};

async function _rhTakeAssign(sessionId, takeId, songTitle) {
    if (typeof window.GLTakes === 'undefined' || !window.GLTakes.updateTake) return;
    var songId = null;
    try {
        if (typeof getSongByTitle === 'function') {
            var s = getSongByTitle(songTitle);
            if (s && s.songId) songId = s.songId;
        }
    } catch (e) {}
    try {
        await window.GLTakes.updateTake(takeId, {
            song_title: songTitle,
            song_id: songId, // may be null during songs_v2 migration window - OK
            matching: {
                candidate_pool: 'human',
                confidence: 'high',
                confidence_reason: 'human_correction',
                correction_source: 'human',
                top_suggestions: []
            }
        });
        if (typeof showToast === 'function') showToast('✓ Reassigned to ' + songTitle);
    } catch (e) {
        console.warn('[TakeReview] assign failed:', e && e.message);
        if (typeof showToast === 'function') showToast('Reassign failed');
        return;
    }

    // Re-render the card so the human badge + new title flow in. Cheap full
    // re-render - Phase 3A list size is small (a few dozen takes max).
    var container = document.getElementById('rhTimelineSection');
    if (!container) return;
    var session;
    try {
        var _rsLoadById = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.loadById);
        if (_rsLoadById) session = await GLStore.RehearsalSession.loadById(sessionId);
    } catch (e) {}
    try { _rhRenderTakeReview(container, sessionId, session || {}); } catch (e) {}
    // Bug 2026-05-17 (Drew): preserve scroll position after re-render so the
    // user lands back on the take they just corrected, not the top of the
    // list. Same trick as the boundary save flow.
    requestAnimationFrame(function () {
        try {
            var row = document.querySelector('.rh-take-row[data-take-id="' + takeId.replace(/"/g, '\\"') + '"]');
            if (row && typeof row.scrollIntoView === 'function') {
                row.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        } catch (_e) {}
    });
}

// ── Headline Insight ────────────────────────────────────────────────────────
function _rhGetHeadline(session, idx, allSessions) {
    var rating = session.rating;
    var actual = session.totalActualMin || 0;
    var budget = session.totalBudgetMin || 0;
    var songs = (session.songsWorked || session.blocks || []).length;
    var delta = actual - budget;
    var overBlocks = (session.blocks || []).filter(function(b) { return b.budgetMin > 0 && b.actualMin > b.budgetMin; });

    // Best rehearsal this month
    if (rating === 'great' && idx === 0) {
        var thisMonth = new Date().toISOString().substring(0, 7);
        var monthSessions = allSessions.filter(function(s) { return (s.date || '').substring(0, 7) === thisMonth; });
        var bestInMonth = monthSessions.every(function(s) { return s.rating !== 'great' || s === session; });
        if (bestInMonth || monthSessions.length <= 1) return { icon: '\uD83D\uDD25', text: 'Best rehearsal this month', color: '#22c55e' };
    }

    // Great rating
    if (rating === 'great') return { icon: '\uD83D\uDD25', text: 'Great session', color: '#22c55e' };

    // Tight and efficient
    if (budget > 0 && Math.abs(delta) <= 3 && songs >= 4) return { icon: '\uD83D\uDCAA', text: 'Tight and efficient session', color: '#a5b4fc' };

    // Ran long
    if (budget > 0 && delta > 10) return { icon: '\u26A0\uFE0F', text: 'Ran long \u2014 transitions need work', color: '#fbbf24' };

    // Over on most blocks
    if (overBlocks.length > 0 && overBlocks.length >= (session.blocks || []).length * 0.6) return { icon: '\u26A0\uFE0F', text: 'Most songs ran over \u2014 tighten up', color: '#fbbf24' };

    // Finished early
    if (budget > 0 && delta < -10) return { icon: '\u26A1', text: 'Finished early \u2014 add more to the plan', color: '#60a5fa' };

    // Solid
    if (rating === 'solid') return { icon: '\uD83D\uDCAA', text: 'Solid session', color: '#a5b4fc' };

    // Needs work
    if (rating === 'needs_work') return { icon: '\uD83D\uDD27', text: 'Needs work \u2014 keep pushing', color: '#fbbf24' };

    // Long productive session
    if (actual >= 60 && songs >= 6) return { icon: '\uD83C\uDFAF', text: 'Deep work session \u2014 ' + songs + ' songs in ' + actual + ' min', color: '#94a3b8' };

    return null;
}

// ── Mixdown Tagging ─────────────────────────────────────────────────────────
window._rhCycleMixdownTag = async function(sessionId) {
    var sessions = _rhSessionsCache || [];
    var s = sessions.find(function(x) { return x.sessionId === sessionId; });
    if (!s) return;

    var tags = [null, 'best_take', 'needs_work'];
    var cur = s.mixdown_tag || null;
    var nextIdx = (tags.indexOf(cur) + 1) % tags.length;
    var next = tags[nextIdx];

    // C2 Phase 1: route mixdown-tag toggle through RehearsalSession.update.
    try {
        var _rsUpd = (typeof GLStore !== 'undefined' && GLStore.RehearsalSession && GLStore.RehearsalSession.update);
        if (_rsUpd) {
            await GLStore.RehearsalSession.update(sessionId, { mixdown_tag: next || null });
            s.mixdown_tag = next;
        } else {
            var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
            if (db && typeof bandPath === 'function') {
                await db.ref(bandPath('rehearsal_sessions/' + sessionId)).update({ mixdown_tag: next || null });
                s.mixdown_tag = next;
            }
        }
    } catch(e) {}

    var labels = { best_take: '\u2B50 Best Take', needs_work: '\uD83D\uDD27 Needs Work' };
    if (typeof showToast === 'function') showToast(labels[next] || 'Tag cleared');
    _rhRenderSessionHistory();
};

window._rhToggleMixdownPlayer = async function(sessionId, mixdownId) {
    var el = document.getElementById('rhMixdownPlayer_' + sessionId);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<div style="font-size:0.72em;color:#fbbf24">Loading mixdown\u2026</div>';

    try {
        var all = await loadBandDataFromDrive('_band', 'rehearsal_mixdowns') || {};
        var mx = all[mixdownId];
        if (!mx) { el.innerHTML = '<div style="font-size:0.72em;color:#64748b">Mixdown not found</div>'; return; }

        // Phase 3D: route playback through GLRecordings.resolvePlaybackSource
        // by handing it a session-shaped object \u2014 Mixdown.audio_url becomes
        // session.recording_url, the resolver will canonicalize through P2.
        // Cached-shell fallback uses mx.audio_url directly.
        var playableUrl = '';
        if (window.GLRecordings && window.GLRecordings.resolvePlaybackSource) {
            try {
                var res = await window.GLRecordings.resolvePlaybackSource({
                    sessionId: 'mixdown:' + mixdownId,
                    recording_url: mx.audio_url || '',
                    date: mx.rehearsal_date || null
                }, { autoCreate: false });
                if (res && res.url && !res.isBlob) playableUrl = res.url;
            } catch (e) {
                if (window.GLObs && window.GLObs.log) {
                    window.GLObs.log('Mixdown', 'resolvePlaybackSource failed; falling back', { mixdownId: mixdownId, message: e && e.message });
                }
            }
        }
        if (!playableUrl && mx.audio_url && mx.audio_url.indexOf('blob:') !== 0) {
            playableUrl = mx.audio_url;
        }

        var html = '';
        if (playableUrl) {
            html += '<audio controls preload="metadata" style="width:100%;height:36px;margin-bottom:4px" src="' + escHtml(playableUrl) + '"></audio>';
        }
        if (mx.drive_url) {
            html += '<a href="' + escHtml(mx.drive_url) + '" target="_blank" rel="noopener" style="font-size:0.72em;color:#60a5fa;text-decoration:none">\uD83D\uDCC1 Open in Google Drive</a>';
        }
        if (!playableUrl && !mx.drive_url) {
            html = '<div style="font-size:0.72em;color:#64748b">No playable audio attached</div>';
        }
        el.innerHTML = html;
    } catch(e) {
        el.innerHTML = '<div style="font-size:0.72em;color:#64748b">Could not load mixdown</div>';
    }
};

async function _rhRenderSnapshots() {
    var el = document.getElementById('rhSnapshots');
    if (!el) return;
    var snaps = await _rhLoadSnapshots(5);
    // Show current plan status above snapshots
    var _currentUnits = _rhGetUnits();
    var _currentPlanName = (_rhPlanCache && _rhPlanCache.name) ? _rhPlanCache.name : (localStorage.getItem('glSavedPlanName') || 'Rehearsal Plan');
    var _currentHtml = '';
    if (_currentUnits.length > 0) {
        var _curSongCount = _currentUnits.reduce(function(n, u) { return n + (u.type === 'linked' && u.songs ? u.songs.length : 1); }, 0);
        _currentHtml = '<div style="padding:4px 0;margin-bottom:4px;font-size:0.75em">'
            + '<div style="display:flex;align-items:center;gap:6px">'
            + '<span style="color:var(--gl-green);font-weight:700">\u25CF</span>'
            + '<span style="color:var(--gl-text);font-weight:600">' + escHtml(_currentPlanName) + '</span>'
            + '<span style="color:var(--gl-text-tertiary)">\u2014 ' + _curSongCount + ' songs</span>'
            + '<span style="color:var(--gl-green);font-size:0.82em">current</span>'
            + '</div></div>';
    }
    if (!snaps.length) { el.innerHTML = _currentHtml || ''; return; }
    var html = _currentHtml;
    // Phase 3c: audit-log framing. Was "Prior Versions" with Preview/Restore
    // buttons that suggested switching. Now framed as "Plan change history"
    // with a View button (read-only inspection) \u2014 restore from inside the
    // modal is still destructive overwrite, but the entry surface no longer
    // suggests these are alternatives.
    html += '<details style="margin-bottom:4px;opacity:0.85">'
        + '<summary style="font-size:0.7em;font-weight:700;letter-spacing:0.08em;color:var(--text-dim);text-transform:uppercase;cursor:pointer;padding:4px 0">\uD83D\uDCDC Plan change history (' + snaps.length + ')</summary>'
        + '<div style="margin-top:6px">'
        + '<div style="font-size:0.68em;color:var(--text-dim);font-style:italic;margin:0 4px 6px;line-height:1.4">Audit log of past plan states. Viewing is read-only; "Replace" inside a snapshot overwrites the current plan.</div>';
    snaps.forEach(function(s) {
        var d = s.savedAt ? new Date(s.savedAt) : null;
        var dateStr = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        var songCount = s.songCount || (s.units ? s.units.length : 0);
        // Compute duration from units
        var _snapDur = 0;
        var _snapNonSong = { exercise: 10, business: 15, jam: 10, note: 5, section: 0 };
        (s.units || []).forEach(function(u) { _snapDur += (u.durationMinOverride > 0) ? u.durationMinOverride : (_snapNonSong[u.type] !== undefined ? _snapNonSong[u.type] : 9); });
        var _snapDurLabel = _snapDur >= 60 ? Math.floor(_snapDur / 60) + 'h ' + (_snapDur % 60) + 'm' : _snapDur + 'm';
        var label = s.name || 'Previous version';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.78em">'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(label) + '</div>'
            + '<div style="font-size:0.82em;color:var(--text-dim)">' + dateStr + ' \u00B7 ' + songCount + ' songs \u00B7 ' + _snapDurLabel + '</div>'
            + '</div>'
            + '<button onclick="_rhPreviewSnapshot(\'' + s.snapshotId + '\')" title="View this snapshot read-only (restore is a separate action inside the modal)" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(148,163,184,0.25);background:rgba(148,163,184,0.06);color:var(--text-dim);cursor:pointer;font-size:0.82em;font-weight:600;flex-shrink:0">View</button>'
            + '<button onclick="_rhDeleteSnapshot(\'' + s.snapshotId + '\')" style="padding:4px 6px;border-radius:5px;border:1px solid rgba(239,68,68,0.2);background:none;color:#f87171;cursor:pointer;font-size:0.78em;flex-shrink:0">\u2715</button>'
            + '</div>';
    });
    html += '</div></details>';
    el.innerHTML = html;
}

// ── Firebase rehearsal plan persistence ───────────────────────────────────────

var _rhPlanCache = null;       // cached plan object from Firebase
var _rhSaveTimer = null;       // debounce timer
var _rhSaveDebounceMs = 1500;  // debounce delay

function _rhGenPlanId() {
    return 'rp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// Load the latest rehearsal plan from Firebase (or cache)
// Phase 3b: pointer-based "current plan" resolution.
// Old behavior was "newest plan in rehearsal_plans by updatedAt wins" — meaning
// plans collection was load-bearing for "what's current," and clearing the
// plan required wiping the entire collection. New behavior:
//   - bands/{slug}/rehearsal_state/currentPlanId is the single source of truth
//   - Plans collection is append-only history; clearing nulls the pointer
//   - Legacy bands without a pointer fall back to "newest" once, then upgrade
async function _rhLoadPlanFromFirebase() {
    if (_rhPlanCache) return _rhPlanCache;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return null;
    try {
        // Pointer-first
        var ptrSnap = await db.ref(bandPath('rehearsal_state/currentPlanId')).once('value');
        var ptrVal = ptrSnap.val();
        if (ptrVal === null) {
            // Pointer exists but is null → user has explicitly cleared. Honor it.
            return null;
        }
        if (typeof ptrVal === 'string' && ptrVal) {
            var planSnap = await db.ref(bandPath('rehearsal_plans/' + ptrVal)).once('value');
            var planVal = planSnap.val();
            if (planVal) { _rhPlanCache = planVal; return _rhPlanCache; }
            // Pointer dangles — plan was deleted out from under it. Treat as cleared.
            return null;
        }
        // Pointer undefined → legacy band. Fall back to newest, then upgrade.
        var snap = await db.ref(bandPath('rehearsal_plans')).once('value');
        var val = snap.val();
        if (val) {
            var plans = Object.values(val).sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
            _rhPlanCache = plans[0] || null;
            // One-shot upgrade: write the pointer so next load is fast and
            // this band can use Clear Plan without losing history.
            if (_rhPlanCache && _rhPlanCache.planId) {
                try { await db.ref(bandPath('rehearsal_state/currentPlanId')).set(_rhPlanCache.planId); } catch(e) {}
            }
            return _rhPlanCache;
        }
    } catch(e) { console.warn('[RhPlan] Firebase load failed:', e.message); }
    return null;
}

// Save plan to Firebase (called by debounce). Phase 3b: also update the
// currentPlanId pointer so this plan becomes the resolved current plan.
async function _rhPersistToFirebase(plan) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return false;
    try {
        await db.ref(bandPath('rehearsal_plans/' + plan.planId)).set(plan);
        await db.ref(bandPath('rehearsal_state/currentPlanId')).set(plan.planId);
        _rhPlanCache = plan;
        _rhShowSaveState('saved');
        return true;
    } catch(e) {
        console.warn('[RhPlan] Firebase save failed:', e.message);
        _rhShowSaveState('error');
        return false;
    }
}

// Delete plan from Firebase
async function _rhDeletePlanFromFirebase() {
    if (!_rhPlanCache || !_rhPlanCache.planId) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        await db.ref(bandPath('rehearsal_plans/' + _rhPlanCache.planId)).remove();
    } catch(e) { console.warn('[RhPlan] Firebase delete failed:', e.message); }
    _rhPlanCache = null;
}

// Wipe the entire rehearsal_plans collection. DEPRECATED Phase 3b — use the
// currentPlanId pointer instead (Clear Plan now nulls the pointer and keeps
// plans as append-only history). Retained as an admin/debug escape hatch.
// Snapshots in rehearsal_history are NOT touched.
async function _rhClearAllPlansFromFirebase() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        await db.ref(bandPath('rehearsal_plans')).remove();
    } catch(e) { console.warn('[RhPlan] Firebase wipe failed:', e.message); }
}

// Show save state indicator
function _rhShowSaveState(state) {
    var targets = [document.getElementById('rhSaveState'), document.getElementById('rhSaveStateTop')];
    targets.forEach(function(el) {
        if (!el) return;
        if (state === 'saving') { el.textContent = 'Saving\u2026'; el.style.color = '#fbbf24'; }
        else if (state === 'saved') {
            el.textContent = '\u2713 Saved';
            el.style.color = '#22c55e';
            // In Plan Mode, keep showing "All changes saved" instead of clearing
            setTimeout(function() {
                if (el.textContent === '\u2713 Saved') {
                    if (_rhPlanningMode) {
                        el.textContent = '\u2713 All changes saved';
                        el.style.color = 'rgba(34,197,94,0.6)';
                    } else {
                        el.textContent = '';
                    }
                }
            }, 2000);
        }
        else if (state === 'error') { el.textContent = '\u2715 Save failed'; el.style.color = '#f87171'; }
        else { el.textContent = ''; }
    });
}

// ── Inline agenda editing ─────────────────────────────────────────────────────

function _rhGetUnits() {
    // 1. Firebase cache (primary when available)
    if (_rhPlanCache && _rhPlanCache.units && _rhPlanCache.units.length) return _rhPlanCache.units;
    // 2. localStorage grouped units
    try {
        var units = JSON.parse(localStorage.getItem('glPlannerUnits') || '[]');
        if (units.length) return units;
    } catch(e) {}
    // 3. Fallback: build units from flat queue (old format)
    try {
        var q = JSON.parse(localStorage.getItem('glPlannerQueue') || '[]');
        if (q.length) {
            var built = q.map(function(item) {
                return { type: 'single', title: item.title, band: item.band || '', block: item._blockType || 'flow' };
            });
            localStorage.setItem('glPlannerUnits', JSON.stringify(built));
            return built;
        }
    } catch(e) {}
    return [];
}

function _rhSaveUnits(units) {
    // Always save to localStorage immediately
    try {
        localStorage.setItem('glPlannerUnits', JSON.stringify(units));
        // Rebuild flat queue for Start Rehearsal
        var flatQueue = [];
        units.forEach(function(u) {
            var _playable = { single:1, song:1, multi_song:1, linked:1 };
            if (u.type === 'linked' && u.songs) {
                u.songs.forEach(function(s) { flatQueue.push({ title: s.title, band: s.band || '', _blockType: u.block || 'flow' }); });
            } else if (_playable[u.type || 'single']) {
                flatQueue.push({ title: u.title, band: u.band || '', _blockType: u.block || 'flow' });
            }
        });
        localStorage.setItem('glPlannerQueue', JSON.stringify(flatQueue));
    } catch(e) {}

    // Debounced Firebase save
    _rhShowSaveState('saving');
    if (_rhSaveTimer) clearTimeout(_rhSaveTimer);
    _rhSaveTimer = setTimeout(function() {
        var now = new Date().toISOString();
        var plan = _rhPlanCache || {};
        plan.planId = plan.planId || _rhGenPlanId();
        plan.name = plan.name || 'Next Rehearsal';
        // Phase 2: default intent so plans built without an explicit intent
        // (e.g. via Plan Mode drag-drop from scratch) still render a badge.
        plan.intent = plan.intent || 'custom';
        // Phase 3a: gig back-reference. Intent handlers + wizard stamp these on
        // _rhPlanCache before _rhSaveUnits runs; we just default to null so
        // legacy plans round-trip cleanly. Denormalized date/venue avoid an
        // extra gig-collection lookup on every render.
        if (plan.gigId === undefined) plan.gigId = null;
        if (plan.gigDate === undefined) plan.gigDate = null;
        if (plan.gigVenue === undefined) plan.gigVenue = null;
        plan.createdAt = plan.createdAt || now;
        plan.createdBy = plan.createdBy || (typeof currentUserEmail !== 'undefined' ? currentUserEmail : '');
        plan.updatedAt = now;
        plan.units = units;
        _rhPlanCache = plan;
        _rhPersistToFirebase(plan);
    }, _rhSaveDebounceMs);
}

function _rhReRender() {
    var el = document.getElementById('rhMain');
    if (el) _rhRenderCommandFlow(document.querySelector('.app-page:not(.hidden)') || document.body);
}

// ── Drag-and-drop reorder ────────────────────────────────────────────────────
function _rhInitDragDrop() {
    var list = document.getElementById('rhUnitList');
    if (!list) return;
    var rows = list.querySelectorAll('.rh-unit-row');
    if (!rows.length) return;

    var dragSrcIdx = null;

    // Inject drop-indicator CSS once
    if (!document.getElementById('rhDragCSS')) {
        var s = document.createElement('style');
        s.id = 'rhDragCSS';
        s.textContent = '.rh-unit-row.rh-drag-over-above{border-top:2px solid #60a5fa!important}'
            + '.rh-unit-row.rh-drag-over-below{border-bottom:2px solid #60a5fa!important}'
            + '.rh-unit-row.rh-dragging{opacity:0.35}';
        document.head.appendChild(s);
    }

    rows.forEach(function(row) {
        // Desktop drag events
        row.addEventListener('dragstart', function(e) {
            dragSrcIdx = parseInt(row.dataset.idx, 10);
            row.classList.add('rh-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragSrcIdx);
        });
        row.addEventListener('dragend', function() {
            row.classList.remove('rh-dragging');
            _rhClearDropIndicators(list);
        });
        row.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            _rhClearDropIndicators(list);
            var rect = row.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                row.classList.add('rh-drag-over-above');
            } else {
                row.classList.add('rh-drag-over-below');
            }
        });
        row.addEventListener('dragleave', function() {
            row.classList.remove('rh-drag-over-above', 'rh-drag-over-below');
        });
        row.addEventListener('drop', function(e) {
            e.preventDefault();
            _rhClearDropIndicators(list);
            var dropIdx = parseInt(row.dataset.idx, 10);
            if (dragSrcIdx === null || dragSrcIdx === dropIdx) return;
            // Determine insert position based on drop half
            var rect = row.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            var insertAbove = e.clientY < midY;
            _rhDragMove(dragSrcIdx, dropIdx, insertAbove);
            dragSrcIdx = null;
        });

        // Touch support: long-press on handle to start, move to reorder
        var handles = row.querySelectorAll('.rh-drag-handle');
        handles.forEach(function(handle) {
            var touchState = null;
            handle.addEventListener('touchstart', function(e) {
                e.preventDefault();
                dragSrcIdx = parseInt(row.dataset.idx, 10);
                row.classList.add('rh-dragging');
                touchState = { startY: e.touches[0].clientY };
            }, { passive: false });
            handle.addEventListener('touchmove', function(e) {
                if (!touchState) return;
                e.preventDefault();
                var touchY = e.touches[0].clientY;
                _rhClearDropIndicators(list);
                var targetRow = _rhRowAtY(list, touchY);
                if (targetRow && targetRow !== row) {
                    var rect = targetRow.getBoundingClientRect();
                    if (touchY < rect.top + rect.height / 2) {
                        targetRow.classList.add('rh-drag-over-above');
                    } else {
                        targetRow.classList.add('rh-drag-over-below');
                    }
                }
            }, { passive: false });
            handle.addEventListener('touchend', function(e) {
                if (!touchState) return;
                var touchY = e.changedTouches[0].clientY;
                row.classList.remove('rh-dragging');
                _rhClearDropIndicators(list);
                var targetRow = _rhRowAtY(list, touchY);
                if (targetRow && targetRow !== row) {
                    var dropIdx = parseInt(targetRow.dataset.idx, 10);
                    var rect = targetRow.getBoundingClientRect();
                    var insertAbove = touchY < rect.top + rect.height / 2;
                    _rhDragMove(dragSrcIdx, dropIdx, insertAbove);
                }
                dragSrcIdx = null;
                touchState = null;
            });
        });
    });
}

function _rhClearDropIndicators(list) {
    list.querySelectorAll('.rh-drag-over-above,.rh-drag-over-below').forEach(function(el) {
        el.classList.remove('rh-drag-over-above', 'rh-drag-over-below');
    });
}

function _rhRowAtY(list, y) {
    var rows = list.querySelectorAll('.rh-unit-row');
    for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) return rows[i];
    }
    return null;
}

function _rhDragMove(fromIdx, toIdx, insertAbove) {
    var units = _rhGetUnits();
    if (fromIdx < 0 || fromIdx >= units.length) return;
    var item = units.splice(fromIdx, 1)[0];
    // Adjust toIdx after removal
    var insertIdx = toIdx;
    if (fromIdx < toIdx) insertIdx--;
    if (!insertAbove) insertIdx++;
    if (insertIdx < 0) insertIdx = 0;
    if (insertIdx > units.length) insertIdx = units.length;
    units.splice(insertIdx, 0, item);
    _rhSaveUnits(units);
    _rhReRender();
}

window._rhMoveUnit = function(idx, dir) {
    var units = _rhGetUnits();
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= units.length) return;
    var tmp = units[idx];
    units[idx] = units[newIdx];
    units[newIdx] = tmp;
    _rhSaveUnits(units);
    _rhReRender();
};

window._rhRemoveUnit = function(idx) {
    var units = _rhGetUnits();
    if (!units[idx]) return;
    units.splice(idx, 1);
    _rhSaveUnits(units);
    if (typeof showToast === 'function') showToast('Removed');
    _rhReRender();
};

window._rhAddBusiness = function() {
    _rhAddBlock('business');
};

// Quick template insert — one click, no prompt
window._rhInsertTemplate = function(type, title) {
    var menu = document.getElementById('rhAddBlockMenu');
    if (menu) menu.style.display = 'none';
    var units = _rhGetUnits();
    units.push({ type: type, title: title, block: 'flow' });
    _rhSaveUnits(units);
    if (typeof showToast === 'function') showToast(title + ' added');
    _rhReRender();
};

// Inline edit block title
window._rhEditBlockTitle = function(idx) {
    var units = _rhGetUnits();
    if (!units[idx]) return;
    var current = units[idx].title || '';
    var newTitle = prompt('Edit block title:', current);
    if (newTitle === null || newTitle === current) return;
    units[idx].title = newTitle.trim() || current;
    _rhSaveUnits(units);
    _rhReRender();
};

// ── Block assignment ─────────────────────────────────────────────────────────
function _rhAssignChip(unit, idx) {
    var assigned = unit.assignedTo || [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    if (assigned.length === 0) {
        return '<span onclick="_rhShowAssignMenu(' + idx + ',this)" style="font-size:0.6em;color:#475569;cursor:pointer;padding:1px 4px;border-radius:3px;border:1px dashed rgba(255,255,255,0.08)" title="Assign members">+👤</span>';
    }
    // Show initials of assigned members
    var initials = assigned.map(function(key) {
        var m = bm[key];
        return (m && m.name) ? m.name.charAt(0).toUpperCase() : key.charAt(0).toUpperCase();
    }).join('');
    return '<span onclick="_rhShowAssignMenu(' + idx + ',this)" style="font-size:0.6em;color:#86efac;cursor:pointer;padding:1px 4px;border-radius:3px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);font-weight:700" title="' + assigned.map(function(k) { var m = bm[k]; return m ? m.name : k; }).join(', ') + '">' + initials + '</span>';
}

window._rhShowAssignMenu = function(idx, anchor) {
    // Remove existing menu
    var old = document.getElementById('rhAssignMenu');
    if (old) { old.remove(); return; }

    var units = _rhGetUnits();
    if (!units[idx]) return;
    var assigned = units[idx].assignedTo || [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var members = [];
    if (typeof BAND_MEMBERS_ORDERED !== 'undefined') {
        BAND_MEMBERS_ORDERED.forEach(function(ref) {
            var k = (typeof ref === 'object') ? ref.key : ref;
            var m = bm[k];
            if (m) members.push({ key: k, name: m.name || k });
        });
    }
    if (!members.length) return;

    var menu = document.createElement('div');
    menu.id = 'rhAssignMenu';
    menu.style.cssText = 'position:absolute;z-index:9999;background:#1e293b;border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:140px';

    var html = '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;padding:2px 4px;margin-bottom:4px">Assign to</div>';
    members.forEach(function(m) {
        var checked = assigned.indexOf(m.key) >= 0;
        html += '<label style="display:flex;align-items:center;gap:6px;padding:3px 4px;cursor:pointer;font-size:0.78em;color:' + (checked ? '#86efac' : 'var(--text-muted)') + ';border-radius:4px" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'none\'">'
            + '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="_rhToggleAssign(' + idx + ',\'' + m.key + '\',this.checked)" style="accent-color:#22c55e">'
            + '<span style="font-weight:600">' + escHtml(m.name) + '</span></label>';
    });
    html += '<div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.06);padding-top:4px">'
        + '<button onclick="document.getElementById(\'rhAssignMenu\').remove()" style="width:100%;font-size:0.68em;padding:3px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer">Done</button></div>';
    menu.innerHTML = html;

    // Position near the anchor
    var rect = anchor.getBoundingClientRect();
    menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    menu.style.left = Math.max(8, rect.left + window.scrollX - 60) + 'px';
    document.body.appendChild(menu);

    // Close on outside click
    setTimeout(function() {
        function _close(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', _close); } }
        document.addEventListener('mousedown', _close);
    }, 50);
};

window._rhToggleAssign = function(idx, memberKey, checked) {
    var units = _rhGetUnits();
    if (!units[idx]) return;
    if (!units[idx].assignedTo) units[idx].assignedTo = [];
    var arr = units[idx].assignedTo;
    var pos = arr.indexOf(memberKey);
    if (checked && pos < 0) arr.push(memberKey);
    if (!checked && pos >= 0) arr.splice(pos, 1);
    _rhSaveUnits(units);
    // Update chip without full re-render (keeps menu open)
};

window._rhEditBlockNote = function(idx) {
    var units = _rhGetUnits();
    if (!units[idx]) return;
    var current = units[idx].note || '';
    var newNote = prompt('Note for this block (leave empty to clear):', current);
    if (newNote === null) return; // cancelled
    if (newNote.trim() === '') {
        delete units[idx].note;
        delete units[idx].noteBy;
    } else {
        units[idx].note = newNote.trim();
        units[idx].noteBy = (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : '';
    }
    _rhSaveUnits(units);
    _rhReRender();
};

window._rhRunWalkthrough = function() {
    if (typeof glSpotlight !== 'undefined') {
        glSpotlight.reset('rehearsal-plan-v3');
        glSpotlight.run('rehearsal-plan-v3', null, { force: true });
    }
};

window._rhEditPlanName = function() {
    var current = (_rhPlanCache && _rhPlanCache.name) ? _rhPlanCache.name : 'Next Rehearsal';
    var newName = prompt('Rehearsal plan name (e.g., Apr 1 \u2013 Avon Prep):', current);
    if (newName === null || newName.trim() === current) return;
    if (!_rhPlanCache) _rhPlanCache = { planId: _rhGenPlanId(), units: _rhGetUnits() };
    _rhPlanCache.name = newName.trim() || 'Next Rehearsal';
    // Trigger a save with current units
    _rhSaveUnits(_rhGetUnits());
    _rhReRender();
};

window._rhEditBlockTime = function(idx) {
    var units = _rhGetUnits();
    if (!units[idx]) return;
    var current = units[idx].durationMinOverride || '';
    var input = prompt('Minutes for this block (leave empty for auto-estimate):', current);
    if (input === null) return; // cancelled
    if (input.trim() === '') {
        delete units[idx].durationMinOverride;
    } else {
        var mins = parseInt(input, 10);
        if (isNaN(mins) || mins < 1 || mins > 120) { alert('Enter a number between 1 and 120'); return; }
        units[idx].durationMinOverride = mins;
    }
    _rhSaveUnits(units);
    _rhReRender();
};

window._rhShowAddBlock = function() {
    var menu = document.getElementById('rhAddBlockMenu');
    if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
};

window._rhAddBlock = function(blockType) {
    var menu = document.getElementById('rhAddBlockMenu');
    if (menu) menu.style.display = 'none';

    if (blockType === 'song') {
        _rhAddSongToplan();
        return;
    }
    if (blockType === 'multi_song') {
        var titles = prompt('Enter song titles (comma-separated):', '');
        if (!titles) return;
        var units = _rhGetUnits();
        units.push({ type: 'multi_song', title: titles.trim(), block: 'flow' });
        _rhSaveUnits(units);
        _rhReRender();
        return;
    }

    var labels = { exercise:'Exercise', note:'Note', business:'Band Business', jam:'Jam / Break', section:'Section name' };
    var label = prompt((labels[blockType] || 'Block') + ':', labels[blockType] || '');
    if (!label) return;
    var units = _rhGetUnits();
    units.push({ type: blockType, title: label, block: 'flow' });
    _rhSaveUnits(units);
    _rhReRender();
};

var _rhPickerShowLibrary = false;

window._rhAddSongToplan = function(keepLibraryState) {
    if (!keepLibraryState) _rhPickerShowLibrary = false; // reset to active-only on fresh open
    var songList = (typeof allSongs !== 'undefined' ? allSongs : []).filter(function(s) {
        if (_rhPickerShowLibrary) return true;
        return typeof isSongActive === 'function' ? isSongActive(s.title) : true;
    });
    songList.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });

    var existing = document.getElementById('rhSongPickerOverlay');
    if (existing) existing.remove();

    var ov = document.createElement('div');
    ov.id = 'rhSongPickerOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';

    var h = '<div style="background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.12);border-radius:14px;max-width:420px;width:100%;max-height:70vh;display:flex;flex-direction:column;color:var(--text,#e2e8f0)">';
    h += '<div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;display:flex;align-items:center;justify-content:space-between">';
    h += '<span style="font-weight:700;font-size:0.92em">Add Song to Rehearsal</span>';
    h += '<button onclick="document.getElementById(\'rhSongPickerOverlay\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1em">✕</button></div>';
    h += '<div style="display:flex;gap:6px;padding:8px 16px 0;align-items:center">';
    h += '<input id="rhPickerSearch" type="text" placeholder="Search..." oninput="_rhFilterPicker(this.value)" style="flex:1;padding:6px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--text);font-size:0.85em;box-sizing:border-box">';
    h += '<label for="rhPickerLibraryCb" style="display:flex;align-items:center;gap:4px;font-size:0.68em;color:var(--text-dim);cursor:pointer;white-space:nowrap"><input type="checkbox" id="rhPickerLibraryCb" name="rhPickerLibrary" ' + (_rhPickerShowLibrary ? 'checked' : '') + ' onchange="_rhPickerShowLibrary=this.checked;_rhAddSongToplan(true)" style="accent-color:#667eea"> Library</label>';
    h += '</div>';
    h += '<div id="rhPickerList" style="overflow-y:auto;flex:1;padding:4px 16px">';
    songList.forEach(function(s) {
        var safe = s.title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        var isActive = typeof isSongActive === 'function' && isSongActive(s.title);
        h += '<div data-title="' + safe.toLowerCase() + '" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;font-size:0.85em;display:flex;align-items:center;gap:8px;' + (!isActive ? 'opacity:0.5' : '') + '" onclick="_rhPickSong(\'' + safe + '\')">';
        h += '<span style="flex:1">' + s.title + '</span>';
        h += '<span style="font-size:0.68em;color:var(--text-dim)">' + (s.band || '') + '</span></div>';
    });
    h += '</div>';
    h += '<div style="padding:8px 16px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0">';
    h += '<button onclick="document.getElementById(\'rhSongPickerOverlay\').remove();if(typeof showPage===\'function\')showPage(\'songs\');setTimeout(function(){if(typeof showAddCustomSongModal===\'function\')showAddCustomSongModal();},500)" style="width:100%;padding:6px;border-radius:6px;border:1px dashed rgba(255,255,255,0.15);background:none;color:var(--text-dim);cursor:pointer;font-size:0.72em">+ Add a New Song →</button>';
    h += '</div></div>';

    ov.innerHTML = h;
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    document.getElementById('rhPickerSearch').focus();
};

window._rhFilterPicker = function(q) {
    var lower = q.toLowerCase();
    document.querySelectorAll('#rhPickerList > div').forEach(function(row) {
        row.style.display = (!q || (row.dataset.title || '').indexOf(lower) !== -1) ? 'flex' : 'none';
    });
};

window._rhPickSong = function(title) {
    document.getElementById('rhSongPickerOverlay').remove();
    var units = _rhGetUnits();
    var songObj = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === title; });
    units.push({ type: 'single', title: title, band: songObj ? (songObj.band || '') : '', block: 'flow' });
    _rhSaveUnits(units);
    if (typeof showToast === 'function') showToast(title + ' added');
    _rhReRender();
};

// Launch saved rehearsal plan
window._rhLaunchSavedPlan = function() {
    try {
        // Rebuild queue from units (canonical source) to ensure consistency
        var units = _rhGetUnits();
        if (units.length) _rhSaveUnits(units); // rebuilds glPlannerQueue from units
        var q = JSON.parse(localStorage.getItem('glPlannerQueue') || '[]');
        // Enrich queue items with budgeted minutes from matching units
        q.forEach(function(item) {
            var match = units.find(function(u) { return u.title === item.title; });
            if (match) {
                // Use _rhBlockMinutes logic inline (can't call it here — it's scoped inside render)
                var bt = match.type || 'single';
                var budgetMin = match.durationMinOverride || 0;
                if (!budgetMin) {
                    var defaults = { exercise: 10, business: 15, jam: 10, note: 5, section: 0 };
                    if (defaults[bt] !== undefined) { budgetMin = defaults[bt]; }
                    else {
                        var sec = (typeof getSongRuntimeSec === 'function') ? getSongRuntimeSec(item.title) : 360;
                        budgetMin = Math.ceil((sec / 60) * 1.5);
                    }
                }
                item.budgetMin = budgetMin;
                if (match.note) item.note = match.note;
            }
        });
        if (q.length && typeof openRehearsalModeWithQueue === 'function') {
            var guidance = localStorage.getItem('glPlannerGuidance');
            if (guidance) window._rpBlockGuidance = JSON.parse(guidance);
            openRehearsalModeWithQueue(q);
        } else if (units.length) {
            // Units exist but all are business items (no songs to play)
            if (typeof showToast === 'function') showToast('No songs in the plan — add songs first');
        } else {
            if (typeof showToast === 'function') showToast('No saved plan found — build one first');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('Error loading plan');
    }
};

// Update save status indicator
window._rhUpdateSaveStatus = function(text) {
    var el = document.getElementById('rhSaveStatus');
    if (el) {
        el.textContent = text;
        el.style.color = '#86efac';
        setTimeout(function() { if (el) el.style.color = 'var(--text-dim)'; }, 1500);
    }
};


async function rhShowPlansTab(container) {
    container.innerHTML = '<div style="color:var(--text-dim);padding:40px;text-align:center">Loading...</div>';
    var allEvents = await loadCalendarEventsRaw();
    var today = new Date(); today.setHours(0,0,0,0);
    var rehearsals = allEvents
        .filter(function(e) { return e.type === 'rehearsal'; })
        .sort(function(a, b) { return (a.date||'').localeCompare(b.date||''); });
    if (!practicePlanActiveDate && rehearsals.length) {
        var upcoming = rehearsals.filter(function(r) { return new Date(r.date+'T00:00:00') >= today; });
        practicePlanActiveDate = upcoming.length ? upcoming[0].date : rehearsals[0].date;
    }
    var tabsHtml = '';
    if (rehearsals.length) {
        tabsHtml = '<div class="app-card" style="margin-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom:none">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
            + '<div style="font-weight:700;font-size:0.9em">📋 Rehearsal Plans</div>'
            + '<button class="btn btn-primary btn-sm" onclick="practicePlanNew()">+ New</button>'
            + '</div>'
            + '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none">';
        rehearsals.forEach(function(r) {
            var isPast = new Date(r.date+'T00:00:00') < today;
            var isActive = r.date === practicePlanActiveDate;
            tabsHtml += '<button data-plan-date="' + r.date + '" onclick="practicePlanSelectDate(\'' + r.date + '\')"'
                + ' style="flex-shrink:0;padding:6px 14px;border-radius:20px;'
                + 'border:1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)') + ';'
                + 'background:' + (isActive ? 'var(--accent)' : 'rgba(255,255,255,0.03)') + ';'
                + 'color:' + (isActive ? 'white' : isPast ? 'var(--text-dim)' : 'var(--text-muted)') + ';'
                + 'font-size:0.78em;font-weight:' + (isActive ? '700' : '500') + ';cursor:pointer;white-space:nowrap">'
                + (isPast ? '' : '🎸 ') + formatPracticeDate(r.date) + (isPast ? ' ✓' : '') + '</button>';
        });
        tabsHtml += '</div></div>';
    }
    var planBodyHtml = rehearsals.length
        ? '<div class="app-card" style="border-top-left-radius:0;border-top-right-radius:0"><div id="practicePlanBody">Loading plan...</div></div>'
        : '<div class="app-card" style="text-align:center;padding:32px 20px">'
          + '<div style="font-size:2em;margin-bottom:10px">📆</div>'
          + '<div style="font-weight:700;margin-bottom:6px">No rehearsals scheduled yet</div>'
          + '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:16px">Create your first rehearsal to start building a plan.</div>'
          + '<button class="btn btn-primary" onclick="rhOpenCreateModal()">+ New Rehearsal</button>'
          + '</div>';
    container.innerHTML = tabsHtml + planBodyHtml;
    if (rehearsals.length && practicePlanActiveDate) renderPracticePlanForDate(practicePlanActiveDate);
}

// ── Load & render event list ──────────────────────────────────────────────────
async function rhLoadEvents() {
    var container = document.getElementById('rhEventList');
    if (!container) return;
    var events = await rhGetAllEvents();
    if (!events.length) {
        container.innerHTML = '<div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">' +
            '<div style="font-size:2em;margin-bottom:12px">🎯</div>' +
            '<div style="font-weight:700;margin-bottom:6px">No rehearsals yet</div>' +
            '<div style="font-size:0.85em;margin-bottom:16px">Create your first one to get the band coordinated</div>' +
            '<button class="btn btn-primary" onclick="rhOpenCreateModal()">+ New Rehearsal</button>' +
        '</div>';
        return;
    }

    var now = new Date();
    var upcoming = events.filter(function(e) { return new Date(e.date + 'T23:59:59') >= now; });
    var past = events.filter(function(e) { return new Date(e.date + 'T23:59:59') < now; });
    upcoming.sort(function(a, b) { return a.date.localeCompare(b.date); });
    past.sort(function(a, b) { return b.date.localeCompare(a.date); });

    var html = '';
    if (upcoming.length) {
        html += '<div style="font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Upcoming</div>';
        html += upcoming.map(function(ev) { return rhEventCard(ev); }).join('');
    }
    if (past.length) {
        html += '<div style="margin-top:20px">';
        html += '<div style="font-weight:700;font-size:0.85em;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;cursor:pointer" onclick="rhTogglePast(this)">Past ▸ (' + past.length + ')</div>';
        html += '<div id="rhPastList" style="display:none">' + past.map(function(ev) { return rhEventCard(ev, true); }).join('') + '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function rhTogglePast(btn) {
    var el = document.getElementById('rhPastList');
    if (!el) return;
    if (el.style.display === 'none') { el.style.display = ''; btn.textContent = btn.textContent.replace('▸', '▾'); }
    else { el.style.display = 'none'; btn.textContent = btn.textContent.replace('▾', '▸'); }
}

function rhEventCard(ev, isPast) {
    var rsvps = ev.rsvps || {};
    var yes = 0, maybe = 0, no = 0;
    BAND_MEMBERS_ORDERED.forEach(function(m) {
        var s = (rsvps[m.key] || {}).status;
        if (s === 'yes') yes++;
        else if (s === 'maybe') maybe++;
        else if (s === 'no') no++;
    });
    var myKey = getCurrentMemberReadinessKey();
    var myStatus = myKey ? ((rsvps[myKey] || {}).status || '') : '';
    var myBadge = myStatus === 'yes' ? '✅ You\'re in' : myStatus === 'maybe' ? '❓ Maybe' : myStatus === 'no' ? '❌ Out' : '• RSVP needed';
    var myColor = myStatus === 'yes' ? '#22c55e' : myStatus === 'maybe' ? '#f59e0b' : myStatus === 'no' ? '#ef4444' : '#94a3b8';
    var planSongs = ((ev.plan || {}).songs || []).length;

    return '<div class="app-card" style="cursor:pointer;margin-bottom:8px;' + (isPast ? 'opacity:0.7;' : '') + '" onclick="rhOpenEvent(\'' + ev.id + '\')">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
            '<div style="flex:1;min-width:0">' +
                '<div style="font-weight:700;font-size:1em;color:var(--text)">' + rhFormatDate(ev.date) + (ev.time ? ' · ' + ev.time : '') + '</div>' +
                (ev.location ? '<div style="font-size:0.82em;color:var(--text-muted);margin-top:2px">📍 ' + ev.location + '</div>' : '') +
                (ev.notes ? '<div style="font-size:0.78em;color:var(--text-dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + ev.notes + '</div>' : '') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">' +
                '<div style="font-size:0.72em;font-weight:700;color:' + myColor + '">' + myBadge + '</div>' +
                '<div style="font-size:0.7em;color:var(--text-dim)">✅ ' + yes + ' · ❓ ' + maybe + ' · ❌ ' + no + '</div>' +
                (planSongs ? '<div style="font-size:0.7em;color:var(--accent-light)">🎵 ' + planSongs + ' songs planned</div>' : '') +
            '</div>' +
        '</div>' +
        '<div style="display:flex;gap:3px;margin-top:8px">' +
            BAND_MEMBERS_ORDERED.map(function(m) {
                var s = (rsvps[m.key] || {}).status;
                var dot = s === 'yes' ? '#22c55e' : s === 'maybe' ? '#f59e0b' : s === 'no' ? '#ef4444' : 'rgba(255,255,255,0.15)';
                return '<div title="' + m.name + ': ' + (s || 'no response') + '" style="width:28px;height:28px;border-radius:50%;background:' + dot + '22;border:2px solid ' + dot + ';display:flex;align-items:center;justify-content:center;font-size:0.75em">' + m.emoji + '</div>';
            }).join('') +
        '</div>' +
    '</div>';
}

// ── Open event detail ─────────────────────────────────────────────────────────
async function rhOpenEvent(eventId) {
    rhCurrentEventId = eventId;
    var events = await rhGetAllEvents();
    var ev = events.find(function(e) { return e.id === eventId; });
    if (!ev) return;

    var container = document.getElementById('rhEventList');
    if (!container) return;

    var myKey = getCurrentMemberReadinessKey();
    var myStatus = myKey ? ((ev.rsvps || {})[myKey] || {}).status || '' : '';
    var myNote = myKey ? ((ev.rsvps || {})[myKey] || {}).note || '' : '';
    var planSongs = ((ev.plan || {}).songs || []);
    var planNotes = ((ev.plan || {}).notes || '');
    var isCreator = ev.createdBy === currentUserEmail;

    var html =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">' +
            '<button class="btn btn-ghost btn-sm" onclick="rhLoadEvents()" style="padding:6px 10px">← Back</button>' +
            '<div style="flex:1">' +
                '<div style="font-weight:800;font-size:1.1em">' + rhFormatDate(ev.date) + (ev.time ? ' · ' + ev.time : '') + '</div>' +
                (ev.location ? '<div style="font-size:0.82em;color:var(--text-muted)">📍 ' + ev.location + '</div>' : '') +
            '</div>' +
            (isCreator || isUserSignedIn ?
                '<button class="btn btn-ghost btn-sm" onclick="rhOpenEditModal(\'' + eventId + '\')" style="font-size:0.8em;padding:5px 8px">✏️ Edit</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="rhDeleteEvent(\'' + eventId + '\')" style="font-size:0.8em;padding:5px 8px;color:#ef4444">🗑️</button>'
            : '') +
        '</div>';

    if (ev.notes) {
        html += '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:0.85em;color:var(--text-muted);font-style:italic">' + ev.notes + '</div>';
    }

    // ── Add to Google Calendar ──
    var _rhGcalPlan = planSongs.length ? 'Focus: ' + planSongs.slice(0, 3).join(', ') + (planSongs.length > 3 ? ' + ' + (planSongs.length - 3) + ' more' : '') : '';
    html += '<button onclick="(function(){if(typeof calBuildRehearsalGoogleLink===\'function\'){var u=calBuildRehearsalGoogleLink(' + JSON.stringify({ date: ev.date, time: ev.time || '', location: ev.location || '', notes: ev.notes || '' }) + ',' + JSON.stringify(_rhGcalPlan) + ');if(u!==\'#\'){window.open(u,\'_blank\');if(typeof showToast===\'function\')showToast(\'\uD83D\uDCC5 Opening Google Calendar \u2014 confirm there to send invites\')}}})()" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(66,133,244,0.25);background:rgba(66,133,244,0.06);color:#4285f4;cursor:pointer;font-size:0.78em;font-weight:600;font-family:inherit;margin-bottom:4px;min-height:36px">\uD83D\uDCC5 Add to Google Calendar</button>';
    html += '<div style="font-size:0.58em;color:var(--text-dim);text-align:center;margin-bottom:16px">Add it to your calendar and invite the band</div>';

    // ── RSVP Section ──
    html += '<div class="app-card" style="margin-bottom:16px">';
    html += '<div style="font-weight:700;font-size:0.9em;margin-bottom:12px">🙋 Who\'s In?</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';
    BAND_MEMBERS_ORDERED.forEach(function(m) {
        var s = ((ev.rsvps || {})[m.key] || {}).status;
        var n = ((ev.rsvps || {})[m.key] || {}).note || '';
        var bg = s === 'yes' ? 'rgba(34,197,94,0.12)' : s === 'maybe' ? 'rgba(245,158,11,0.12)' : s === 'no' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)';
        var border = s === 'yes' ? '#22c55e44' : s === 'maybe' ? '#f59e0b44' : s === 'no' ? '#ef444444' : 'rgba(255,255,255,0.08)';
        var icon = s === 'yes' ? '✅' : s === 'maybe' ? '❓' : s === 'no' ? '❌' : '—';
        html += '<div style="flex:1;min-width:80px;background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:8px;text-align:center">' +
            '<div style="font-size:1.1em;margin-bottom:2px">' + m.emoji + '</div>' +
            '<div style="font-size:0.75em;font-weight:700;color:var(--text)">' + m.name + '</div>' +
            '<div style="font-size:0.8em;margin-top:2px">' + icon + '</div>' +
            (n ? '<div style="font-size:0.65em;color:var(--text-dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + n + '">' + n + '</div>' : '') +
        '</div>';
    });
    html += '</div>';

    // My RSVP controls
    if (!isUserSignedIn) {
        html += '<div style="text-align:center;font-size:0.82em;color:var(--text-dim)">Sign in to RSVP</div>';
    } else if (!myKey) {
        html += '<div style="text-align:center;font-size:0.82em;color:var(--text-dim)">Your account isn\'t linked to a band member</div>';
    } else {
        html += '<div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:12px">';
        // Stale RSVP warning
        var _myRsvp = myKey ? ((ev.rsvps || {})[myKey] || {}) : {};
        if (_myRsvp.stale) {
            html += '<div style="padding:6px 8px;margin-bottom:8px;border-radius:6px;border:1px solid rgba(245,158,11,0.25);background:rgba(245,158,11,0.04);font-size:0.72em;color:#fbbf24;font-weight:600">'
                + '\u26A0 ' + (_myRsvp.staleReason || 'Details changed') + ' \u2014 please re-confirm</div>';
        }
        html += '<div style="font-size:0.8em;color:var(--text-muted);margin-bottom:8px;font-weight:600">Your RSVP:</div>';
        html += '<div style="display:flex;gap:6px;margin-bottom:8px">';
        ['yes','maybe','no'].forEach(function(opt) {
            var label = opt === 'yes' ? '✅ I\'m In' : opt === 'maybe' ? '❓ Maybe' : '❌ Can\'t Make It';
            var active = myStatus === opt;
            var bg = active ? (opt === 'yes' ? 'rgba(34,197,94,0.25)' : opt === 'maybe' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.05)';
            var border = active ? (opt === 'yes' ? '#22c55e' : opt === 'maybe' ? '#f59e0b' : '#ef4444') : 'rgba(255,255,255,0.1)';
            html += '<button onclick="rhSetRsvp(\'' + eventId + '\',\'' + opt + '\')" style="flex:1;padding:8px 4px;border-radius:8px;border:2px solid ' + border + ';background:' + bg + ';cursor:pointer;font-size:0.78em;font-weight:700;color:var(--text);transition:all 0.15s">' + label + '</button>';
        });
        html += '</div>';
        html += '<input type="text" id="rhRsvpNote" placeholder="Optional note (e.g. might be 10 min late)" value="' + myNote.replace(/"/g, '&quot;') + '" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:var(--text);padding:7px 10px;font-size:0.82em;font-family:inherit" onclick="event.stopPropagation()">';
        html += '</div>';
    }
    html += '</div>';

    // ── Song Plan Section ──
    html += '<div class="app-card" style="margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div style="font-weight:700;font-size:0.9em">🎵 Rehearsal Plan</div>';
    html += '<button class="btn btn-sm" onclick="rhGenerateSuggestions(\'' + eventId + '\')" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);font-size:0.75em;padding:5px 10px;border-radius:6px;cursor:pointer">🤖 Suggest Songs</button>';
    html += '</div>';

    if (planSongs.length) {
        html += '<div style="margin-bottom:10px"><button onclick="rhLaunchFromSession(\'' + eventId + '\')" '
            + 'style="width:100%;padding:12px 16px;border-radius:10px;'
            + 'background:linear-gradient(135deg,#667eea,#764ba2);'
            + 'color:white;border:none;font-weight:700;font-size:0.9em;cursor:pointer;'
            + 'letter-spacing:0.02em;box-shadow:0 2px 12px rgba(102,126,234,0.3)">'
            + '🎸 Start Rehearsal Mode</button></div>';
        html += '<div id="rhTimerWidget"></div>';
        html += '<div id="rhScoreboard"></div>';
        html += '<div id="rhPlanList" style="margin-bottom:10px">';
        html += rhRenderPlanSongs(planSongs, ev.plan.focusSections || {});
        html += '</div>';
    } else {
        html += '<div id="rhPlanList" style="color:var(--text-dim);font-size:0.85em;padding:8px 0;margin-bottom:10px">No songs planned yet — tap "Suggest Songs" to get started, or add manually below.</div>';
    }

    html += '<div style="display:flex;gap:6px;margin-bottom:8px">';
    html += '<input type="text" id="rhAddSongInput" placeholder="Add a song to the plan..." style="flex:1;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:var(--text);padding:7px 10px;font-size:0.82em;font-family:inherit" onclick="event.stopPropagation()" onkeydown="if(event.key===\'Enter\')rhAddSongToPlan(\'' + eventId + '\')">';
    html += '<button onclick="rhAddSongToPlan(\'' + eventId + '\')" style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.3);color:#818cf8;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:0.82em;font-weight:700;white-space:nowrap">+ Add</button>';
    html += '</div>';

    html += '<div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:10px">';
    html += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:5px">Plan notes:</div>';
    html += '<textarea id="rhPlanNotes" rows="2" placeholder="e.g. Run Reba twice, focus on the jam..." style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:var(--text);padding:7px 10px;font-size:0.82em;font-family:inherit;resize:vertical" onclick="event.stopPropagation()">' + planNotes + '</textarea>';
    html += '<div style="display:flex;gap:6px;margin-top:6px">';
    html += '<button onclick="rhSavePlan(\'' + eventId + '\')" class="btn btn-primary" style="font-size:0.82em;padding:7px 14px">💾 Save Plan</button>';
    if (planSongs.length) {
        html += '<button onclick="rhSendToPracticePlan(\'' + eventId + '\')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);border-radius:7px;padding:7px 12px;cursor:pointer;font-size:0.82em">📋 Send to Practice Plan</button>';
    }
    // ── Pocket Meter launch ──
    html += '<button onclick="rhOpenPocketMeter(\'' + eventId + '\')" style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#34d399;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:0.82em;font-weight:700">🎚️ Pocket Meter</button>';
    html += '</div></div>';
    html += '</div>';

    // ── Suggestion results area (hidden until generated) ──
    html += '<div id="rhSuggestionArea"></div>';

    // ── Groove Analysis summary (populated async below) ──
    html += '<div id="rhGrooveAnalysis"></div>';

    container.innerHTML = html;
    // Init timer and scoreboard
    if (planSongs.length) rhTimerInit(planSongs);
    rhRenderScoreboard(eventId);
    rhRenderGrooveAnalysis(eventId);
}

// Rehearsal Timer
var _rhTimer = { running:false, start:0, elapsed:0, songIdx:0, goalMins:10, tick:null, songs:[], log:[] };

function rhTimerRender() {
    var el = document.getElementById('rhTimerWidget');
    if (!el) return;
    var t = _rhTimer;
    var totalMs = t.running ? (Date.now()-t.start+t.elapsed) : t.elapsed;
    var totalSecs = Math.floor(totalMs/1000);
    var mins = Math.floor(totalSecs/60), secs = totalSecs%60;
    var goalMs = t.goalMins*60*1000;
    var pct = Math.min(100, Math.round(totalMs/goalMs*100));
    var over = totalMs > goalMs;
    var bc = over ? '#ef4444' : pct>75 ? '#f59e0b' : '#22c55e';
    var ts = (mins<10?'0':'')+mins+':'+(secs<10?'0':'')+secs;
    var curSong = t.songs[t.songIdx] || '';
    var h = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    h += '<span style="font-weight:700;font-size:0.9em">ⱱ Rehearsal Timer</span>';
    h += '<span style="font-size:1.3em;font-weight:800;color:'+(over?'#ef4444':'#f1f5f9')+'">'+ts+'</span></div>';
    h += '<div style="height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin-bottom:8px">';
    h += '<div style="height:100%;width:'+pct+'%;background:'+bc+';border-radius:3px"></div></div>';
    if (curSong) h += '<div style="font-size:0.78em;color:#94a3b8;margin-bottom:8px">🎵 '+curSong+'</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    h += '<button onclick="rhTimerToggle()" style="background:'+(t.running?'rgba(239,68,68,0.15)':'rgba(34,197,94,0.15)')+';border:1px solid '+(t.running?'rgba(239,68,68,0.3)':'rgba(34,197,94,0.3)')+';color:'+(t.running?'#f87171':'#86efac')+';padding:5px 12px;border-radius:8px;font-size:0.82em;font-weight:700;cursor:pointer">'+(t.running?'⏸ Pause':'▶ Start')+'</button>';
    h += '<button onclick="rhTimerNext()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:5px 12px;border-radius:8px;font-size:0.82em;cursor:pointer">⇥ Next Song</button>';
    h += '<button onclick="rhTimerReset()" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);color:#64748b;padding:5px 12px;border-radius:8px;font-size:0.82em;cursor:pointer">⟳ Reset</button>';
    h += '<label style="display:flex;align-items:center;gap:4px;font-size:0.78em;color:#64748b;margin-left:auto">Goal: <input type="number" min="1" max="60" value="'+t.goalMins+'" onchange="_rhTimerSetGoal(this.value)" style="width:38px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:#94a3b8;padding:2px 4px;font-size:inherit;text-align:center"> min</label>';
    h += '</div>';
    if (t.log.length) {
        h += '<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">';
        h += '<div style="font-size:0.7em;color:#64748b;font-weight:700;letter-spacing:0.05em;margin-bottom:6px">SONG LOG</div>';
        h += t.log.map(function(e) {
            var ok = e.mins <= t.goalMins;
            return '<div style="display:flex;gap:8px;padding:3px 0;font-size:0.8em"><span style="flex:1;color:#94a3b8">'+e.title+'</span><span style="color:'+(ok?'#22c55e':'#f59e0b')+';font-weight:700">'+e.mins+':'+(e.secs<10?'0':'')+e.secs+'</span></div>';
        }).join('');
        h += '</div>';
    }
    h += '</div>';
    el.innerHTML = h;
}

function rhTimerToggle() {
    if (_rhTimer.running) {
        clearInterval(_rhTimer.tick);
        _rhTimer.elapsed += Date.now()-_rhTimer.start;
        _rhTimer.running = false;
    } else {
        _rhTimer.start = Date.now();
        _rhTimer.running = true;
        _rhTimer.tick = setInterval(rhTimerRender, 500);
    }
    rhTimerRender();
}

function rhTimerNext() {
    var t = _rhTimer;
    var totalMs = t.running ? (Date.now()-t.start+t.elapsed) : t.elapsed;
    var s = Math.floor(totalMs/1000);
    if (t.songs[t.songIdx]) t.log.push({title:t.songs[t.songIdx],mins:Math.floor(s/60),secs:s%60});
    t.elapsed = 0; t.start = Date.now();
    t.songIdx = Math.min(t.songs.length-1, t.songIdx+1);
    rhTimerRender();
}

function rhTimerReset() {
    clearInterval(_rhTimer.tick);
    _rhTimer = {running:false,start:0,elapsed:0,songIdx:0,goalMins:_rhTimer.goalMins,tick:null,songs:_rhTimer.songs,log:[]};
    rhTimerRender();
}

function _rhTimerSetGoal(v) { _rhTimer.goalMins = Math.max(1,parseInt(v)||10); rhTimerRender(); }

function rhTimerInit(songs) {
    clearInterval(_rhTimer.tick);
    _rhTimer = {running:false,start:0,elapsed:0,songIdx:0,goalMins:_rhTimer.goalMins||10,tick:null,songs:songs||[],log:[]};
    rhTimerRender();
}

// Rehearsal Scoreboard
async function rhRenderScoreboard(eventId) {
    var container = document.getElementById('rhScoreboard');
    if (!container) return;
    var ev = null;
    try {
        var events = await rhGetAllEvents();
        ev = events.find(function(e){return e.id===eventId;});
    } catch(e) { return; }
    if (!ev || !ev.plan || !toArray(ev.plan.songs||[]).length) {
        container.innerHTML = '';
        return;
    }
    var planSongs = toArray(ev.plan.songs||[]);
    // Load section ratings for each song
    var allWeakSections = [];
    for (var i=0; i<planSongs.length; i++) {
        var title = planSongs[i];
        var path = bandPath('songs/'+sanitizeFirebasePath(title)+'/section_ratings');
        try {
            var snap = await firebaseDB.ref(path).once('value');
            var sectionData = snap.val() || {};
            Object.entries(sectionData).forEach(function(entry) {
                var sectionName = entry[0], ratings = entry[1];
                var vals = Object.values(ratings||{}).filter(function(v){return typeof v==='number';});
                if (!vals.length) return;
                var avg = vals.reduce(function(a,b){return a+b;},0)/vals.length;
                if (avg < 3.5) allWeakSections.push({song:title, section:sectionName, avg:avg});
            });
        } catch(e) {}
    }
    allWeakSections.sort(function(a,b){return a.avg-b.avg;});
    var top = allWeakSections.slice(0,5);
    if (!top.length) {
        // Fallback: check overall readiness when no section ratings exist
        var readinessAll = (window.GLStore && typeof GLStore.getAllReadiness === 'function')
            ? GLStore.getAllReadiness() : (window._masterReadiness || {});
        var lowReadiness = [];
        planSongs.forEach(function(title) {
            var scores = readinessAll[title] || readinessAll[sanitizeFirebasePath(title)] || {};
            var vals = Object.values(scores).filter(function(v){ return typeof v === 'number' && v > 0; });
            if (!vals.length) return;
            var avg = vals.reduce(function(a,b){return a+b;},0)/vals.length;
            if (avg < 3.5) lowReadiness.push({ song: title, avg: avg });
        });
        if (lowReadiness.length) {
            lowReadiness.sort(function(a,b){return a.avg-b.avg;});
            var h2 = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;margin-bottom:12px">';
            h2 += '<div style="font-weight:700;font-size:0.88em;margin-bottom:10px">⚠️ Songs Needing Work</div>';
            lowReadiness.slice(0,5).forEach(function(item) {
                var pct = Math.round(item.avg/5*100);
                var c = item.avg<2 ? '#ef4444' : item.avg<3 ? '#f97316' : '#f59e0b';
                h2 += '<div style="margin-bottom:8px">';
                h2 += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">';
                h2 += '<span style="font-size:0.8em;color:#f1f5f9;font-weight:600">' + item.song + '</span>';
                h2 += '<span style="font-size:0.78em;font-weight:700;color:' + c + '">' + item.avg.toFixed(1) + '/5</span></div>';
                h2 += '<div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden">';
                h2 += '<div style="height:100%;width:' + pct + '%;background:' + c + ';border-radius:2px"></div></div></div>';
            });
            h2 += '</div>';
            container.innerHTML = h2;
        } else {
            var solidMsg = planSongs.length > 0
                ? '🏆 Plan songs are looking solid — no major weak spots.'
                : '🏆 No major weak spots in active rotation.';
            container.innerHTML = '<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:10px 14px;font-size:0.82em;color:#86efac;margin-bottom:12px">' + solidMsg + '</div>';
        }
        return;
    }
    var h = '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;margin-bottom:12px">';
    h += '<div style="font-weight:700;font-size:0.88em;margin-bottom:10px">🏆 Sections to Tighten</div>';
    top.forEach(function(item) {
        var pct = Math.round(item.avg/5*100);
        var c = item.avg<2?'#ef4444':item.avg<3?'#f97316':'#f59e0b';
        h += '<div style="margin-bottom:8px">';
        h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">';
        h += '<span style="font-size:0.8em;color:#94a3b8"><span style="color:#f1f5f9;font-weight:600">'+item.song+'</span> — '+item.section+'</span>';
        h += '<span style="font-size:0.78em;font-weight:700;color:'+c+'">'+item.avg.toFixed(1)+'/5</span></div>';
        h += '<div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden">';
        h += '<div style="height:100%;width:'+pct+'%;background:'+c+';border-radius:2px"></div></div></div>';
    });
    h += '</div>';
    container.innerHTML = h;
}

function rhRenderPlanSongs(songs, focusSections) {
    return songs.map(function(title, i) {
        var focus = (focusSections[title] || []).join(', ');
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">' +
            '<span style="font-size:0.7em;color:var(--text-dim);width:16px;flex-shrink:0">' + (i + 1) + '</span>' +
            '<div style="flex:1;min-width:0">' +
                '<div style="font-size:0.85em;font-weight:600;color:var(--text)">' + title + '</div>' +
                (focus ? '<div style="font-size:0.7em;color:#f59e0b;margin-top:1px">Focus: ' + focus + '</div>' : '') +
            '</div>' +
            '<button onclick="event.stopPropagation();rhRemoveSongFromPlan(\'' + rhCurrentEventId + '\',\'' + title.replace(/'/g, "\\'") + '\')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.85em;padding:2px 4px" title="Remove">✕</button>' +
        '</div>';
    }).join('');
}

// ── RSVP save ─────────────────────────────────────────────────────────────────
async function rhSetRsvp(eventId, status) {
    var myKey = getCurrentMemberReadinessKey();
    if (!myKey || !firebaseDB) { showToast('Sign in to RSVP'); return; }
    var note = document.getElementById('rhRsvpNote')?.value.trim() || '';
    try {
        await firebaseDB.ref(bandPath('rehearsals/' + eventId + '/rsvps/' + myKey)).set({ status: status, note: note, updatedAt: new Date().toISOString() });
        showToast(status === 'yes' ? '✅ You\'re in!' : status === 'maybe' ? '❓ Marked as maybe' : '❌ Marked as out');
        await rhOpenEvent(eventId);
    } catch(e) { showToast('Could not save RSVP'); }
}

// ── Plan management ───────────────────────────────────────────────────────────
async function rhAddSongToPlan(eventId) {
    if (!requireSignIn()) return;
    var input = document.getElementById('rhAddSongInput');
    if (!input) return;
    var title = input.value.trim();
    if (!title) return;
    // Try to fuzzy-match against allSongs
    var match = allSongs.find(function(s) { return s.title.toLowerCase() === title.toLowerCase(); });
    var finalTitle = match ? match.title : title;
    var ev = (await rhGetAllEvents()).find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var plan = ev.plan || { songs: [], focusSections: {}, notes: '' };
    plan.songs = toArray(plan.songs || []);
    if (plan.songs.indexOf(finalTitle) === -1) {
        plan.songs.push(finalTitle);
        await rhSavePlanData(eventId, plan);
        input.value = '';
        await rhOpenEvent(eventId);
    } else {
        showToast('Already in the plan');
    }
}

async function rhRemoveSongFromPlan(eventId, title) {
    var ev = (await rhGetAllEvents()).find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var plan = ev.plan || { songs: [], focusSections: {}, notes: '' };
    plan.songs = toArray(plan.songs || []).filter(function(s) { return s !== title; });
    await rhSavePlanData(eventId, plan);
    await rhOpenEvent(eventId);
}

async function rhSavePlan(eventId) {
    if (!requireSignIn()) return;
    var planListEl = document.getElementById('rhPlanList');
    var notesEl = document.getElementById('rhPlanNotes');
    var ev = (await rhGetAllEvents()).find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var plan = ev.plan || { songs: [], focusSections: {}, notes: '' };
    plan.notes = notesEl ? notesEl.value : (plan.notes || '');
    await rhSavePlanData(eventId, plan);
    // Also write to rehearsal_plan_{date} so Plans tab can find it
    if (ev.date) {
        try {
            var planForDate = {
                songs: (plan.songs || []).map(function(s) {
                    return typeof s === 'string' ? { title: s, focus: '' } : s;
                }),
                notes: plan.notes || '',
                focusSections: plan.focusSections || {},
                updatedAt: new Date().toISOString()
            };
            await saveBandDataToDrive('_band', 'rehearsal_plan_' + ev.date, planForDate);
        } catch(e) { console.warn('rhSavePlan: could not mirror to rehearsal_plan_', e); }
    }
    showToast('✅ Plan saved');
}

async function rhSavePlanData(eventId, plan) {
    if (!firebaseDB) return;
    try {
        await firebaseDB.ref(bandPath('rehearsals/' + eventId + '/plan')).set(plan);
    } catch(e) { showToast('Could not save plan'); }
}

async function rhSendToPracticePlan(eventId) {
    var ev = (await rhGetAllEvents()).find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var songs = ((ev.plan || {}).songs || []);
    if (!songs.length) { showToast('No songs in plan'); return; }
    if (typeof sendToPracticePlan === 'function') {
        songs.forEach(function(title) { sendToPracticePlan(title); });
        showToast('🎯 ' + songs.length + ' songs flagged as This Week');
    } else {
        showToast('Practice Plan not available');
    }
}

// ── Smart Suggestion Engine ───────────────────────────────────────────────────
async function rhGenerateSuggestions(eventId) {
    var area = document.getElementById('rhSuggestionArea');
    if (!area) return;
    area.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:0.85em">🤖 Analyzing repertoire...</div>';

    // Preload data
    await preloadReadinessCache();
    var statusData = {};
    statusData = (typeof GLStore !== 'undefined') ? GLStore.getAllStatus() : (typeof statusCache !== 'undefined' ? statusCache : {});

    // Load all best shot dates from Firebase for recency scoring
    // We'll pull the master readiness file (already loaded) and do per-song recency via existing cache
    // For recency, we load best_shot_takes lazily per song only if needed — 
    // instead use uploadedAt from readinessCache update times (lightweight approximation)
    // Actual: we'll use a per-song last-shot timestamp stored in Firebase if available
    var shotsDateCache = {};
    try {
        var snap = await firebaseDB.ref(bandPath('_meta/last_shot_dates')).once('value');
        if (snap.val()) shotsDateCache = snap.val();
    } catch(e) {}

    var scored = [];
    var now = Date.now();

    allSongs.forEach(function(song) {
        var title = song.title;
        var avgReadiness = (typeof GLStore !== 'undefined' && GLStore.avgReadiness) ? GLStore.avgReadiness(title) : 0;

        // Section ratings from cache (loaded earlier in Best Shot)
        var sectionRatings = {}; // we'll pass empty; ratings loaded inline below
        var redCount = 0, yellowCount = 0;
        // Note: section ratings require per-song load; we use readiness as primary signal
        // and WIP status + recency as secondary. Section ratings shown post-render.

        var status = getStatusFromCache ? getStatusFromCache(title) : (statusData[title] || '');
        var isWip = status === 'wip';
        var isGigReady = status === 'gig_ready';

        // Recency: days since last best shot (capped at 150 days)
        var lastShot = shotsDateCache[title] ? new Date(shotsDateCache[title]).getTime() : 0;
        var daysSince = lastShot ? Math.min(Math.floor((now - lastShot) / 86400000), 150) : 150;
        var recencyPts = Math.min(daysSince / 30, 5); // 0–5 pts

        // Priority score
        var readinessPts = avgReadiness > 0 ? (5 - avgReadiness) * 3 : 6; // unknown = mid-high priority
        var wipPts = isWip ? 3 : 0;
        var priority = readinessPts + wipPts + recencyPts;

        // Bucket
        var bucket;
        if (avgReadiness > 0 && avgReadiness >= 4.2 && !isWip) bucket = 'warmup';
        else if (avgReadiness > 0 && avgReadiness >= 3 && !isWip) bucket = 'polish';
        else bucket = 'work';

        // Skip pure gig-ready songs with high scores unless WIP
        if (isGigReady && avgReadiness >= 4.5 && !isWip) return;

        scored.push({ title: title, priority: priority, bucket: bucket, avgReadiness: avgReadiness, isWip: isWip, recencyPts: recencyPts });
    });

    // Sort by priority desc, pick top 15 across buckets
    scored.sort(function(a, b) { return b.priority - a.priority; });

    var work = scored.filter(function(s) { return s.bucket === 'work'; }).slice(0, 8);
    var polish = scored.filter(function(s) { return s.bucket === 'polish'; }).slice(0, 4);
    var warmup = scored.filter(function(s) { return s.bucket === 'warmup'; }).slice(0, 3);

    if (!work.length && !polish.length && !warmup.length) {
        area.innerHTML = '<div class="app-card" style="color:var(--text-dim);text-align:center;padding:20px">No songs to suggest — your band is locked in! 🔒</div>';
        return;
    }

    var html = '<div class="app-card" style="margin-top:12px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div style="font-weight:700;font-size:0.9em">🤖 Suggested Rehearsal Plan</div>';
    html += '<button onclick="rhApplySuggestions(\'' + eventId + '\')" class="btn btn-primary" style="font-size:0.78em;padding:6px 12px">Use This Plan</button>';
    html += '</div>';

    function renderBucket(label, emoji, items, color) {
        if (!items.length) return '';
        var out = '<div style="margin-bottom:14px">';
        out += '<div style="font-size:0.72em;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">' + emoji + ' ' + label + '</div>';
        items.forEach(function(s) {
            var wipTag = s.isWip ? ' <span style="font-size:0.62em;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:4px;padding:1px 5px;border:1px solid rgba(245,158,11,0.3)">WIP</span>' : '';
            var cbId = 'rhSug_' + btoa(unescape(encodeURIComponent(s.title))).replace(/[^a-zA-Z0-9]/g,'').slice(0,12);
            out += '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';
            out += '<input type="checkbox" id="' + cbId + '" checked style="accent-color:#667eea;width:14px;height:14px;flex-shrink:0;margin-top:3px" onclick="event.stopPropagation()">';
            out += '<div style="flex:1;min-width:0">';
            out += '<label style="font-size:0.85em;color:var(--text);cursor:pointer;display:block" for="' + cbId + '">' + s.title + wipTag + '</label>';
            // Mini readiness bar per member
            if (s.avgReadiness > 0) {
                out += '<div style="display:flex;gap:2px;margin-top:4px;align-items:center">';
                BAND_MEMBERS_ORDERED.forEach(function(m) {
                    var rc2 = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : (readinessCache || {}); var sc = (rc2[s.title] || {})[m.key] || 0;
                    var c = sc ? readinessColor(sc) : 'rgba(255,255,255,0.08)';
                    out += '<span title="' + m.name + ': ' + (sc?sc+'/5':'?') + '" style="display:inline-block;width:18px;height:4px;border-radius:2px;background:' + c + '"></span>';
                });
                out += '<span style="font-size:0.68em;color:var(--text-dim);margin-left:4px">avg ' + s.avgReadiness.toFixed(1) + '</span>';
                out += '</div>';
            } else {
                out += '<span style="font-size:0.7em;color:#475569">No readiness data</span>';
            }
            out += '</div>';
            out += '</div>';
        });
        out += '</div>';
        return out;
    }

    html += renderBucket('Needs Work', '🔴', work, '#ef4444');
    html += renderBucket('Polish', '🟡', polish, '#f59e0b');
    html += renderBucket('Warm Up / Run Through', '🟢', warmup, '#22c55e');

    // Store suggestions for apply
    var allSugg = work.concat(polish).concat(warmup);
    html += '<div id="rhSuggData" style="display:none">' + JSON.stringify(allSugg.map(function(s) { return s.title; })) + '</div>';
    html += '</div>';

    area.innerHTML = html;
    area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function rhApplySuggestions(eventId) {
    var dataEl = document.getElementById('rhSuggData');
    if (!dataEl) return;
    var allTitles = JSON.parse(dataEl.textContent);
    // Only include checked ones
    var selected = allTitles.filter(function(title) {
        var id = 'rhSug_' + btoa(title).replace(/[^a-zA-Z0-9]/g,'').slice(0,12);
        var cb = document.getElementById(id);
        return cb ? cb.checked : true;
    });
    if (!selected.length) { showToast('No songs selected'); return; }

    var ev = (await rhGetAllEvents()).find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var plan = ev.plan || { songs: [], focusSections: {}, notes: '' };
    plan.songs = toArray(plan.songs || []);
    selected.forEach(function(title) {
        if (plan.songs.indexOf(title) === -1) plan.songs.push(title);
    });
    await rhSavePlanData(eventId, plan);
    showToast('✅ ' + selected.length + ' songs added to plan');
    await rhOpenEvent(eventId);
}

// ── Create / Edit modal ───────────────────────────────────────────────────────
function rhOpenCreateModal() {
    rhShowEventModal(null);
}

function rhOpenEditModal(eventId) {
    rhShowEventModal(eventId);
}

async function rhShowEventModal(eventId) {
    var existing = null;
    if (eventId) {
        var events = await rhGetAllEvents();
        existing = events.find(function(e) { return e.id === eventId; });
    }

    var today = new Date().toISOString().split('T')[0];
    var modal = document.createElement('div');
    modal.id = 'rhModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center';
    modal.innerHTML =
        '<div style="background:#1a2340;border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:500px;max-height:80vh;overflow-y:auto">' +
            '<div style="font-weight:700;font-size:1em;color:var(--text);margin-bottom:16px">' + (existing ? 'Edit Rehearsal' : 'Schedule Rehearsal') + '</div>' +
            // Date recommendations area (populated async)
            (!existing ? '<div id="rhDateRecs" style="margin-bottom:12px"><div style="font-size:0.72em;color:var(--text-dim);padding:8px 0">Finding the best date...</div></div>' : '') +
            '<div style="display:flex;flex-direction:column;gap:10px">' +
                '<div><label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">Date *</label>' +
                '<input type="date" id="rhDate" value="' + (existing ? existing.date : today) + '" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#f1f5f9;padding:9px 11px;font-size:0.9em;font-family:inherit;color-scheme:dark"></div>' +
                '<div><label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">Time</label>' +
                '<input type="text" id="rhTime" value="' + (existing ? (existing.time || '') : '7:00 PM') + '" placeholder="e.g. 7:00 PM" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#f1f5f9;padding:9px 11px;font-size:0.9em;font-family:inherit"></div>' +
                '<div><label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">Location</label>' +
                '<input type="text" id="rhLocation" value="' + (existing ? (existing.location || '') : '') + '" placeholder="e.g. Brian\'s garage" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#f1f5f9;padding:9px 11px;font-size:0.9em;font-family:inherit"></div>' +
                '<div><label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">Notes / Focus</label>' +
                '<textarea id="rhNotes" rows="2" placeholder="e.g. Focus on new Phish tunes" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#f1f5f9;padding:9px 11px;font-size:0.9em;font-family:inherit;resize:vertical">' + (existing ? (existing.notes || '') : '') + '</textarea></div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-top:16px">' +
                '<button onclick="rhSaveEvent(\'' + (eventId || '') + '\')" class="btn btn-primary" style="flex:2">' + (existing ? 'Save Changes' : 'Schedule It') + '</button>' +
                '<button onclick="document.getElementById(\'rhModal\')?.remove()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);border-radius:8px;padding:10px;cursor:pointer;font-size:0.9em">Cancel</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    // Load date recommendations async (only for new events)
    if (!existing && typeof GLStore !== 'undefined' && GLStore.getRehearsalDateRecommendations) {
        _rhRenderDateRecommendations();
    }
}

// Render date recommendations inside the create modal
// Layout: Momentum → Recommendation → Reasons → Alternatives → Planning hook
async function _rhRenderDateRecommendations(overrideSpacing) {
    var el = document.getElementById('rhDateRecs');
    if (!el) return;

    var recs;
    try {
        recs = await GLStore.getRehearsalDateRecommendations({ overrideSpacing: !!overrideSpacing });
    } catch (e) { el.innerHTML = ''; return; }

    if (!recs.primary) {
        el.innerHTML = '<div style="font-size:0.72em;color:var(--text-dim);padding:4px 0">Nothing open in the next 3 weeks.</div>';
        return;
    }

    var html = '';
    var p = recs.primary;
    var pDate = new Date(p.date + 'T12:00:00');
    var pLabel = pDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    var hasCloseRunner = recs.alternatives.length > 0 && (p.score - recs.alternatives[0].score) <= 3;

    // ── 1. MOMENTUM (context) ──
    if (recs.momentum && recs.momentum.label) {
        var mColor = recs.momentum.type === 'streak' ? '#22c55e' : recs.momentum.type === 'gap' || recs.momentum.type === 'nudge' ? '#f59e0b' : '#818cf8';
        html += '<div style="font-size:0.7em;color:' + mColor + ';font-weight:600;margin-bottom:8px">' + recs.momentum.label + '</div>';
    }

    // ── 2. RECOMMENDATION (decision) ──
    var confLabel = hasCloseRunner ? 'Close call \u2014 two good picks' : (p.score >= 70 ? 'Best next rehearsal' : 'Good option');
    html += '<div style="font-size:0.62em;font-weight:700;color:#22c55e;margin-bottom:3px">' + confLabel + '</div>';
    html += '<div id="rhRecPrimary" onclick="_rhPickRecommendedDate(\'' + p.date + '\',this)" style="padding:10px 12px;border-radius:8px;border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.04);cursor:pointer;margin-bottom:4px;transition:border-color 0.2s,background 0.2s">';
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">';
    html += '<div style="flex:1">';
    html += '<div style="font-size:0.88em;font-weight:700;color:var(--text)">' + pLabel + '</div>';

    // ── 3. REASONS (justification) — up to 3, icon-matched ──
    var pReasons = p.reasons.slice(0, 3);
    if (pReasons.length) {
        html += '<div style="margin-top:3px">';
        pReasons.forEach(function(r) {
            var icon = '\u2022';
            if (r.match(/free/i)) icon = '\u2705';
            else if (r.match(/available/i)) icon = '\uD83D\uDC65';
            else if (r.match(/usual schedule/i)) icon = '\uD83D\uDC4D';
            else if (r.match(/gig/i)) icon = '\uD83C\uDFB8';
            else if (r.match(/typical|matches/i)) icon = '\uD83D\uDCC5';
            else if (r.match(/been|days since/i)) icon = '\u23F3';
            html += '<div style="font-size:0.62em;color:var(--text-dim);line-height:1.5">' + icon + ' ' + escHtml(r) + '</div>';
        });
        html += '</div>';
    }
    if (p.offPatternNotes && p.offPatternNotes.length) {
        html += '<div style="font-size:0.55em;color:#f59e0b;margin-top:2px;font-style:italic">\u26A0 ' + escHtml(p.offPatternNotes[0]) + '</div>';
    }
    html += '</div>';
    html += '<span style="font-size:0.72em;color:#22c55e;font-weight:600;flex-shrink:0;align-self:center">Lock this in \u2192</span>';
    html += '</div>';
    // "Why this works" — one subtle line derived from the top reason
    if (pReasons.length) {
        var _whyReason = pReasons[0];
        var _whyText = '';
        if (_whyReason.match(/free/i)) _whyText = 'Everyone can make it';
        else if (_whyReason.match(/usual schedule/i)) _whyText = 'Matches your usual rhythm';
        else if (_whyReason.match(/typical|matches/i) && p.dayOfWeek) _whyText = 'Your usual ' + p.dayOfWeek + ' slot';
        else if (_whyReason.match(/gig/i)) _whyText = 'Good timing before the gig';
        else if (_whyReason.match(/been|days since/i)) _whyText = 'You\u2019re due for one';
        if (_whyText) {
            html += '<div style="font-size:0.55em;color:var(--text-dim);text-align:center;margin-top:3px;font-style:italic">' + _whyText + '</div>';
        }
    }
    html += '</div>';

    // Alternatives
    if (recs.alternatives.length) {
        html += '<details style="margin-bottom:4px">';
        var altSummary = hasCloseRunner ? 'Other strong options' : (recs.alternatives.length + ' more date' + (recs.alternatives.length > 1 ? 's' : ''));
        html += '<summary style="font-size:0.65em;color:var(--text-dim);cursor:pointer;padding:2px 0;list-style:none">' + altSummary + '</summary>';
        recs.alternatives.forEach(function(alt) {
            var aDate = new Date(alt.date + 'T12:00:00');
            var aLabel = aDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            var aReason = alt.reasons.length ? alt.reasons[0] : (alt.availability.available + '/' + alt.availability.total + ' free');
            html += '<div onclick="_rhPickRecommendedDate(\'' + alt.date + '\',this)" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin-top:3px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);cursor:pointer;background:rgba(255,255,255,0.02);transition:border-color 0.2s,background 0.2s">';
            html += '<div style="min-width:0"><div style="font-size:0.78em;color:var(--text)">' + aLabel + '</div>';
            html += '<div style="font-size:0.56em;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(aReason) + '</div></div>';
            html += '<span style="font-size:0.6em;font-weight:600;color:' + alt.color + ';flex-shrink:0;margin-left:6px">' + alt.label + '</span></div>';
        });
        html += '</details>';
    }

    // Skipped dates
    var tooCloseNotShown = recs.tooClose.filter(function(c) {
        return !recs.alternatives.some(function(a) { return a.date === c.date; }) && c.date !== p.date;
    });
    if (tooCloseNotShown.length > 0 && !overrideSpacing) {
        var skipReason = tooCloseNotShown[0].penalties.length ? tooCloseNotShown[0].penalties[0] : 'Too close together';
        html += '<div style="font-size:0.58em;color:#f59e0b;margin-top:3px">'
            + tooCloseNotShown.length + ' skipped \u2014 ' + escHtml(skipReason) + '. '
            + '<span onclick="_rhRenderDateRecommendations(true)" style="color:#818cf8;cursor:pointer;text-decoration:underline">Show anyway</span></div>';
    }

    // Cadence footnote (metadata, not narrative)
    if (recs.cadence.detected.detected || (recs.preferredDays && recs.preferredDays.detected)) {
        var footnote = recs.cadence.detected.detected ? 'Every ~' + recs.cadence.effectiveDays + 'd' : '';
        if (recs.preferredDays && recs.preferredDays.detected) {
            footnote += (footnote ? ' \u00B7 ' : '') + 'usually ' + recs.preferredDays.preferred.map(function(p) { return p.name + 's'; }).join('/');
        }
        html += '<div style="font-size:0.55em;color:var(--text-dim);margin-top:5px;opacity:0.8">' + footnote + '</div>';
    }

    // Stash for confirmation handler
    window._rhLastRecs = recs;

    el.innerHTML = html;
}

// Pick a recommended date — visual confirmation + planning transition
window._rhPickRecommendedDate = function(dateStr, clickedEl) {
    var input = document.getElementById('rhDate');
    if (input) {
        input.value = dateStr;
        input.style.borderColor = '#22c55e';
        input.style.boxShadow = '0 0 0 2px rgba(34,197,94,0.3)';
        setTimeout(function() { input.style.borderColor = ''; input.style.boxShadow = ''; }, 1500);
    }

    // Contextual confirmation — varies by match quality and pattern fit
    var isOnPattern = clickedEl && clickedEl.id === 'rhRecPrimary';
    var _recs = window._rhLastRecs; // stashed by render function
    var confirmText = '\u2714 Date set';
    if (isOnPattern && _recs) {
        var _p = _recs.primary;
        if (_p && _p.isPreferredDay && _p.reasons.some(function(r) { return r.match(/usual schedule/i); })) {
            confirmText = '\u2714 Locked in \u2014 right on your weekly pattern';
        } else if (_recs.momentum && _recs.momentum.type === 'streak') {
            confirmText = '\u2714 Locked in \u2014 keeps your momentum going';
        } else if (_p && _p.isPreferredDay) {
            confirmText = '\u2714 Locked in \u2014 your usual day';
        } else {
            confirmText = '\u2714 Locked in \u2014 fits your rhythm';
        }
    }

    if (clickedEl) {
        var allCards = document.querySelectorAll('#rhDateRecs [onclick*="_rhPickRecommendedDate"]');
        allCards.forEach(function(c) { c.style.opacity = c === clickedEl ? '1' : '0.4'; });
        clickedEl.style.borderColor = '#22c55e';
        clickedEl.style.background = 'rgba(34,197,94,0.08)';
        var confirmEl = document.createElement('div');
        confirmEl.style.cssText = 'font-size:0.65em;color:#22c55e;font-weight:600;text-align:center;margin-top:4px';
        confirmEl.textContent = confirmText;
        clickedEl.appendChild(confirmEl);
    }

    // Show planning hook — immediate transition to "what to work on"
    _rhShowPlanningHook(dateStr);
};

// ── Add to Google Calendar from scheduling flow ──────────────────────────────
var _rhGcalDebounce = 0;
window._rhAddToGoogleCal = function(dateStr, planSummary) {
    // Debounce: prevent multiple tab opens from rapid clicks
    if (Date.now() - _rhGcalDebounce < 3000) return;
    _rhGcalDebounce = Date.now();

    // Get time from the modal input if available
    var timeEl = document.getElementById('rhTime');
    var time = (timeEl && timeEl.value) ? timeEl.value.trim() : '7:00 PM';
    // Normalize time: "7:00 PM" → "19:00"
    var normalized = time;
    var pmMatch = time.match(/^(\d{1,2}):(\d{2})\s*(PM|AM)/i);
    if (pmMatch) {
        var h = parseInt(pmMatch[1]);
        if (pmMatch[3].toUpperCase() === 'PM' && h < 12) h += 12;
        if (pmMatch[3].toUpperCase() === 'AM' && h === 12) h = 0;
        normalized = (h < 10 ? '0' : '') + h + ':' + pmMatch[2];
    }

    var locEl = document.getElementById('rhLocation');
    var location = (locEl && locEl.value) ? locEl.value.trim() : '';
    var notesEl = document.getElementById('rhNotes');
    var notes = (notesEl && notesEl.value) ? notesEl.value.trim() : '';

    if (typeof calBuildRehearsalGoogleLink === 'function') {
        var url = calBuildRehearsalGoogleLink({ date: dateStr, time: normalized, location: location, notes: notes }, planSummary);
        if (url && url !== '#') {
            window.open(url, '_blank');
            if (typeof showToast === 'function') showToast('\uD83D\uDCC5 Opening Google Calendar\u2026 send invites there');
        }
        else if (typeof showToast === 'function') showToast('Could not build calendar link \u2014 check the date');
    } else {
        if (typeof showToast === 'function') showToast('Calendar export not available');
    }
};

// Planning handoff — immediate transition from scheduling to rehearsal prep
function _rhShowPlanningHook(dateStr) {
    var hookEl = document.getElementById('rhPlanningHook');
    if (hookEl) hookEl.remove();
    var recsEl = document.getElementById('rhDateRecs');
    if (!recsEl) return;

    var d = new Date(dateStr + 'T12:00:00');
    var dayLabel = d.toLocaleDateString('en-US', { weekday: 'long' });

    var focusSongs = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
    var hookText = '';
    var hookAction = '';
    if (focusSongs.list.length > 0) {
        var topSong = focusSongs.list[0].title;
        var more = focusSongs.list.length - 1;
        hookText = 'For ' + dayLabel + ': work on <strong>' + escHtml(topSong) + '</strong>' + (more > 0 ? ' + ' + more + ' more' : '');
        hookAction = 'Build the plan \u2192';
    } else {
        hookText = 'Schedule it, then we\u2019ll build your plan';
        hookAction = '';
    }

    // Build plan summary for calendar description
    var planSummary = '';
    if (focusSongs.list.length > 0) {
        planSummary = 'Focus: ' + focusSongs.list.slice(0, 3).map(function(s) { return s.title; }).join(', ');
        if (focusSongs.list.length > 3) planSummary += ' + ' + (focusSongs.list.length - 3) + ' more';
    }

    var hook = document.createElement('div');
    hook.id = 'rhPlanningHook';
    hook.style.cssText = 'margin-top:6px;padding:8px 10px;border-radius:6px;border:1px solid rgba(99,102,241,0.15);background:rgba(99,102,241,0.04)';
    var h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">';
    h += '<div style="font-size:0.62em;color:var(--text-dim)">\uD83C\uDFAF ' + hookText + '</div>';
    if (hookAction) {
        h += '<span onclick="document.getElementById(\'rhModal\')?.querySelector(\'.btn-primary\')?.click()" style="font-size:0.6em;color:#818cf8;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0">' + hookAction + '</span>';
    }
    h += '</div>';
    // Add to Google Calendar button + microcopy
    h += '<button onclick="_rhAddToGoogleCal(\'' + escHtml(dateStr) + '\',\'' + escHtml(planSummary).replace(/'/g, "\\'") + '\')" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(66,133,244,0.25);background:rgba(66,133,244,0.06);color:#4285f4;cursor:pointer;font-size:0.72em;font-weight:600;font-family:inherit;min-height:36px">\uD83D\uDCC5 Add to Google Calendar</button>';
    h += '<div style="font-size:0.52em;color:var(--text-dim);text-align:center;margin-top:3px">Add it to your calendar and invite the band</div>';
    hook.innerHTML = h;
    recsEl.appendChild(hook);
}

async function rhSaveEvent(eventId) {
    if (!requireSignIn()) return;
    var dateEl = document.getElementById('rhDate');
    var timeEl = document.getElementById('rhTime');
    var locEl = document.getElementById('rhLocation');
    var notesEl = document.getElementById('rhNotes');
    if (!dateEl || !dateEl.value) { showToast('Please pick a date'); return; }
    if (!firebaseDB) { showToast('Not connected to Firebase'); return; }

    var id = eventId || ('rh_' + Date.now());
    var ev = {
        id: id,
        date: dateEl.value,
        time: timeEl ? timeEl.value.trim() : '',
        location: locEl ? locEl.value.trim() : '',
        notes: notesEl ? notesEl.value.trim() : '',
        createdBy: currentUserEmail || '',
        createdAt: eventId ? undefined : new Date().toISOString()
    };
    // Remove undefined keys
    Object.keys(ev).forEach(function(k) { if (ev[k] === undefined) delete ev[k]; });

    // Detect critical changes that invalidate RSVPs (edit only)
    var _rhCriticalChange = false;
    var _rhChangeReasons = [];
    var _rhStaleLabel = '';
    if (eventId) {
        try {
            var _prevSnap = await firebaseDB.ref(bandPath('rehearsals/' + id)).once('value');
            var _prev = _prevSnap.val() || {};
            if (ev.date && ev.date !== _prev.date) { _rhCriticalChange = true; _rhChangeReasons.push('date changed'); }
            if (ev.time && ev.time !== (_prev.time || '')) { _rhCriticalChange = true; _rhChangeReasons.push('time changed'); }
            if (ev.location && ev.location !== (_prev.location || '')) { _rhCriticalChange = true; _rhChangeReasons.push('location changed'); }
            // Mark existing RSVPs as stale with human-friendly label
            if (_rhCriticalChange && _prev.rsvps) {
                var _hasDate = _rhChangeReasons.some(function(r) { return r.match(/date/); });
                var _hasTime = _rhChangeReasons.some(function(r) { return r.match(/time/); });
                var _hasLoc = _rhChangeReasons.some(function(r) { return r.match(/location/); });
                _rhStaleLabel = _hasDate && _hasLoc ? 'Date and location changed'
                    : _hasDate ? 'Date changed' : _hasTime && _hasLoc ? 'Time and location changed'
                    : _hasTime ? 'Time changed' : _hasLoc ? 'Location changed' : 'Details changed';

                var _staleRsvps = {};
                Object.keys(_prev.rsvps).forEach(function(k) {
                    _staleRsvps[k] = Object.assign({}, _prev.rsvps[k], { stale: true, staleReason: _rhStaleLabel, staleAt: new Date().toISOString() });
                });
                ev.rsvps = _staleRsvps;
                ev._lastCriticalChange = { fields: _rhChangeReasons, at: new Date().toISOString(), by: currentUserEmail || '' };

                // Post notification to band feed
                var _rhDateLabel = ev.date ? new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                if (typeof _postEventChangeNotification === 'function') {
                    _postEventChangeNotification('rehearsal', _rhDateLabel + ' rehearsal', _rhStaleLabel);
                }
            }
        } catch(e) { /* comparison best-effort */ }
    }

    try {
        await firebaseDB.ref(bandPath('rehearsals/' + id)).update(ev);

        // Google Calendar sync — auto-update if previously synced and critical fields changed
        if (_rhCriticalChange && eventId) {
            // Find matching calendar event to get sync object
            try {
                var _calEvts = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
                var _calIdx = _calEvts.findIndex(function(ce) { return ce.type === 'rehearsal' && (ce.date === ev.date || ce.date === (_prev && _prev.date)); });
                if (_calIdx !== -1 && _calEvts[_calIdx].sync && _calEvts[_calIdx].sync.externalEventId && typeof GLCalendarSync !== 'undefined') {
                    var _syncResult = await GLCalendarSync.update(_calEvts[_calIdx].sync.externalEventId, ev);
                    if (_syncResult.success) {
                        _calEvts[_calIdx].sync.status = 'synced';
                        _calEvts[_calIdx].sync.lastSyncedAt = _syncResult.lastSyncedAt;
                        _calEvts[_calIdx].sync.etag = _syncResult.etag;
                    } else {
                        _calEvts[_calIdx].sync.status = 'error';
                    }
                    // Update calendar event date if it changed
                    if (ev.date) _calEvts[_calIdx].date = ev.date;
                    if (ev.time) _calEvts[_calIdx].time = ev.time;
                    if (ev.location) _calEvts[_calIdx].location = ev.location;
                    await saveBandDataToDrive('_band', 'calendar_events', _calEvts);
                } else if (_calIdx !== -1 && _calEvts[_calIdx].sync && _calEvts[_calIdx].sync.externalEventId) {
                    // GLCalendarSync not loaded — mark needs_update
                    _calEvts[_calIdx].sync.status = 'needs_update';
                    await saveBandDataToDrive('_band', 'calendar_events', _calEvts);
                }
            } catch(e) { /* calendar sync best-effort */ }
        }

        document.getElementById('rhModal')?.remove();
        if (eventId) {
            if (_rhCriticalChange) {
                var _toastLabel = _rhStaleLabel || _rhChangeReasons.join(', ');
                showToast('\u2705 Rehearsal updated \u2014 ' + _toastLabel.toLowerCase() + '.');
            } else {
                showToast('\u2705 Rehearsal updated');
            }
            await rhLoadEvents();
        } else {
            // New rehearsal — navigate to the plan builder so user can build the agenda
            showToast('✅ Rehearsal created — now build your plan');
            // Also create a calendar event so the plan tab picks it up
            if (typeof saveBandDataToDrive === 'function') {
                try {
                    var calEvents = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
                    var alreadyExists = calEvents.some(function(ce) { return ce.type === 'rehearsal' && ce.date === ev.date; });
                    if (!alreadyExists) {
                        // Audit H3 + M13 (2026-05-04): use canonical id +
                        // timestamp field names matching the rest of the
                        // schema (id, created, updated_at) and explicit
                        // syncStatus so Phase 1 doesn't see a ghost row.
                        var _nowIso = new Date().toISOString();
                        var _newId = (typeof generateShortId === 'function') ? generateShortId(12) : ('cal_' + Date.now());
                        calEvents.push({
                            id: _newId,
                            type: 'rehearsal',
                            title: 'Rehearsal',
                            date: ev.date,
                            time: ev.time || '',
                            location: ev.location || '',
                            notes: ev.notes || '',
                            syncStatus: '',
                            created: _nowIso,
                            updated_at: _nowIso
                        });
                        await saveBandDataToDrive('_band', 'calendar_events', calEvents);
                    }
                } catch(e) { /* calendar sync best-effort */ }
            }
            // Switch to the new date's plan — clear old saved plan so user starts fresh
            setTimeout(function() {
                if (typeof practicePlanActiveDate !== 'undefined') practicePlanActiveDate = ev.date;
                // Clear old plan completely
                try { localStorage.removeItem('glPlannerQueue'); } catch(e) {}
                try { localStorage.removeItem('glPlannerGuidance'); } catch(e) {}
                try { localStorage.removeItem('glSavedPlanUnits'); } catch(e) {}
                // Set plan name to the new date so the header is clear
                var dateLabel = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
                if (typeof _rhPlanCache !== 'undefined') {
                    window._rhPlanCache = { name: dateLabel + ' Rehearsal Plan', date: ev.date };
                }
                try { localStorage.setItem('glSavedPlanName', dateLabel + ' Rehearsal Plan'); } catch(e) {}
                // Open the planner for the new date
                if (typeof renderRehearsalPlanner === 'function') {
                    renderRehearsalPlanner();
                }
            }, 300);
        }
    } catch(e) { showToast('Could not save: ' + e.message); }
}

async function rhDeleteEvent(eventId) {
    if (!requireSignIn()) return;
    if (!confirm('Delete this rehearsal?')) return;
    try {
        await firebaseDB.ref(bandPath('rehearsals/' + eventId)).remove();
        showToast('Rehearsal deleted');
        await rhLoadEvents();
    } catch(e) { showToast('Could not delete'); }
}

// ── Firebase helpers ──────────────────────────────────────────────────────────
async function rhGetAllEvents() {
    if (!firebaseDB) return [];
    try {
        var snap = await firebaseDB.ref(bandPath('rehearsals')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.values(val).filter(function(e) { return e && e.date; });
    } catch(e) { return []; }
}

// ── Util ──────────────────────────────────────────────────────────────────────
function rhFormatDate(dateStr) {
    if (!dateStr) return 'No date';
    try {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch(e) { return dateStr; }
}

console.log('Rehearsal Planner loaded');

// ══════════════════════════════════════════════════════════════════════════════
// REHEARSAL PLANNER — gig-driven, time-aware, energy-blocked rehearsal builder
// ══════════════════════════════════════════════════════════════════════════════

var _rpState = {
    step: 0,         // 0=gig, 1=select, 2=time, 3=plan, 4=launch
    gigId: null,
    setlistSongs: [],  // in setlist order: [{title, songId, band}]
    buckets: { needsWork: [], keepWarm: [], ready: [] },
    selected: {},      // { title: true }
    duration: 120,     // minutes
    blocks: { warmup: [], deepWork: [], flow: [], close: [] }
};

window.renderRehearsalPlanner = async function() {
    // Snapshot current plan before rebuilding (dedupe will skip if too recent)
    var currentUnits = _rhGetUnits();
    if (currentUnits.length > 0) {
        await _rhSaveSnapshot('Before rebuilding plan');
    }
    _rpState.step = 0;
    var container = document.getElementById('rhTabContent');
    // If rhTabContent doesn't exist, use rhMain with an edit-mode header
    if (!container) {
        var main = document.getElementById('rhMain');
        if (!main) { showPage('rehearsal'); setTimeout(renderRehearsalPlanner, 200); return; }
        main.innerHTML = '<div style="display:flex;align-items:center;gap:var(--gl-space-sm);margin-bottom:var(--gl-space-md)">'
            + '<span style="font-size:0.82em;font-weight:700;color:var(--gl-text)">Editing Plan</span>'
            + '<button onclick="_rhExitPlannerMode()" class="gl-btn-ghost" style="margin-left:auto">Back to Timeline</button>'
            + '</div>'
            + '<div id="rhTabContent"></div>';
        container = document.getElementById('rhTabContent');
    }
    if (!container) return;
    _rpRenderGigPicker(container);
};

window._rhExitPlannerMode = function() {
    _rhSetPageMode('review'); // Return to review mode when exiting planner
    var el = document.getElementById('page-rehearsal') || document.querySelector('.gl-page-primary');
    if (el) renderRehearsalPage(el);
};

// ── Step 0: Gig Picker ──────────────────────────────────────────────────────

async function _rpRenderGigPicker(container) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-dim)">Loading gigs...</div>';
    var gigs = [];
    try { gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []); } catch(e) {}
    var today = new Date().toISOString().split('T')[0];
    var upcoming = gigs.filter(function(g) { return g.date >= today && g.setlistId; })
        .sort(function(a,b) { return a.date.localeCompare(b.date); });

    var html = '<div style="max-width:520px;margin:0 auto;padding:16px 0">'
        + '<div style="font-size:0.7em;font-weight:800;letter-spacing:0.12em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:6px">Step 1</div>'
        + '<h2 style="margin:0 0 4px;font-size:1.2em;color:var(--text)">Which gig are you preparing for?</h2>'
        + '<p style="font-size:0.82em;color:var(--text-dim);margin:0 0 16px">Pick a gig to load its setlist.</p>';

    if (upcoming.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--text-dim);background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px">No upcoming gigs with linked setlists.<br><button onclick="showPage(\'gigs\')" style="margin-top:8px;padding:6px 14px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-size:0.82em">Create a Gig →</button></div>';
    } else {
        upcoming.forEach(function(g) {
            var safeId = (g.gigId || '').replace(/'/g, "\\'");
            html += '<button onclick="_rpSelectGig(\'' + safeId + '\')" style="display:block;width:100%;text-align:left;padding:12px 16px;margin-bottom:6px;border-radius:10px;border:1px solid rgba(99,102,241,0.15);background:rgba(99,102,241,0.04);cursor:pointer;color:var(--text)">'
                + '<div style="font-weight:700;font-size:0.9em">' + (g.venue || 'TBD') + '</div>'
                + '<div style="font-size:0.75em;color:var(--text-dim);margin-top:2px">📅 ' + (g.date || '') + (g.startTime ? ' · ' + g.startTime : '') + '</div>'
                + '</button>';
        });
    }
    html += '</div>';
    container.innerHTML = html;
    // Stash gigs for lookup
    window._rpGigs = upcoming;
}

window._rpSelectGig = async function(gigId) {
    var gig = (window._rpGigs || []).find(function(g) { return g.gigId === gigId; });
    if (!gig) return;
    _rpState.gigId = gigId;
    // Phase 3a: stamp the gig back-ref onto _rhPlanCache so the next
    // _rhSaveUnits picks it up. Wizard's own persistence path doesn't
    // route through _rhSaveUnits, but any subsequent edit (e.g. user
    // tweaks a block in Plan Mode after Build Plan) will persist it.
    _rhPlanCache = _rhPlanCache || {};
    _rhPlanCache.gigId = gig.gigId || null;
    _rhPlanCache.gigDate = gig.date || null;
    _rhPlanCache.gigVenue = gig.venue || null;

    // Load setlist
    var setlists = window._glCachedSetlists || [];
    var sl = setlists.find(function(s) { return s.setlistId === gig.setlistId; });
    if (!sl) { try { setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []); sl = setlists.find(function(s) { return s.setlistId === gig.setlistId; }); } catch(e) {} }
    if (!sl) { if (typeof showToast === 'function') showToast('Could not find linked setlist'); return; }

    // Extract songs in setlist order with transition data
    var songs = [];
    (sl.sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(sg) {
            var title = typeof sg === 'string' ? sg : (sg.title || '');
            if (!title) return;
            var segue = (typeof sg === 'object') ? (sg.segue || 'stop') : 'stop';
            var songData = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === title; }) : null;
            songs.push({ title: title, songId: songData ? (songData.songId || title) : title, band: songData ? songData.band : '', _segue: segue });
        });
    });
    _rpState.setlistSongs = songs;

    // Detect linked pairs from transition data (flow/segue = linked unit)
    var linkedPairs = [];
    console.log('[Planner] Setlist songs with segue data:', songs.map(function(s) { return s.title + ' (' + s._segue + ')'; }));
    for (var lpi = 0; lpi < songs.length - 1; lpi++) {
        if (songs[lpi]._segue === 'flow' || songs[lpi]._segue === 'segue') {
            linkedPairs.push({ from: songs[lpi], to: songs[lpi + 1], type: songs[lpi]._segue });
            console.log('[Planner] Linked pair found:', songs[lpi].title, '→', songs[lpi+1].title, '(' + songs[lpi]._segue + ')');
        }
    }
    _rpState.linkedPairs = linkedPairs;
    console.log('[Planner] Total linked pairs:', linkedPairs.length);

    // Bucket songs
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    _rpState.buckets = { needsWork: [], keepWarm: [], ready: [] };
    songs.forEach(function(s) {
        var scores = rc[s.title] || {};
        var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
        var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : 0;
        s._avg = avg;
        if (avg < 3) _rpState.buckets.needsWork.push(s);
        else if (avg < 3.8) _rpState.buckets.keepWarm.push(s);
        else _rpState.buckets.ready.push(s);
    });

    _rpState.selected = {};
    _rpState.step = 1;
    _rpRenderSelection(document.getElementById('rhTabContent'));
};

// ── Step 1: Song Selection ──────────────────────────────────────────────────

function _rpRenderSelection(container) {
    if (!container) return;
    var b = _rpState.buckets;
    var selCount = Object.keys(_rpState.selected).length;

    var html = '<div style="max-width:520px;margin:0 auto;padding:16px 0">'
        + '<div style="font-size:0.7em;font-weight:800;letter-spacing:0.12em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:6px">Step 2</div>'
        + '<h2 style="margin:0 0 4px;font-size:1.2em;color:var(--text)">Choose songs for this rehearsal</h2>'
        + '<p style="font-size:0.82em;color:var(--text-dim);margin:0 0 12px">' + _rpState.setlistSongs.length + ' songs in setlist · <strong>Choose 6–8 for focused work</strong></p>'
        + '<div style="font-size:0.78em;font-weight:700;color:' + (selCount >= 6 && selCount <= 8 ? '#22c55e' : selCount > 8 ? '#f59e0b' : 'var(--text-dim)') + ';margin-bottom:12px">' + selCount + ' selected</div>';

    function renderBucket(label, color, emoji, songs) {
        if (!songs.length) return '';
        var out = '<div style="margin-bottom:12px"><div style="font-size:0.72em;font-weight:800;color:' + color + ';margin-bottom:4px">' + emoji + ' ' + label + ' (' + songs.length + ')</div>';
        songs.forEach(function(s) {
            var checked = _rpState.selected[s.title];
            var safeTitle = s.title.replace(/'/g, "\\'");
            out += '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;background:' + (checked ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.01)') + ';border:1px solid ' + (checked ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)') + ';margin-bottom:3px">'
                + '<input type="checkbox" ' + (checked ? 'checked ' : '') + 'onchange="_rpToggleSong(\'' + safeTitle + '\')" style="accent-color:' + color + ';width:16px;height:16px">'
                + '<span style="font-size:0.85em;font-weight:600;color:var(--text);flex:1">' + s.title + '</span>'
                + '<span style="font-size:0.68em;color:var(--text-dim)">' + (s._avg > 0 ? s._avg.toFixed(1) + '/5' : 'unrated') + '</span>'
                + '</label>';
        });
        return out + '</div>';
    }

    html += renderBucket('NEEDS WORK', '#ef4444', '🔴', b.needsWork);
    html += renderBucket('KEEP WARM', '#f59e0b', '🟡', b.keepWarm);
    html += renderBucket('READY', '#22c55e', '🟢', b.ready);

    html += '<div style="display:flex;gap:8px;margin-top:12px">'
        + '<button onclick="_rpGoToTime()" ' + (selCount === 0 ? 'disabled ' : '') + 'style="flex:1;padding:10px;border-radius:8px;border:none;background:' + (selCount > 0 ? 'linear-gradient(135deg,#667eea,#764ba2)' : 'rgba(255,255,255,0.06)') + ';color:' + (selCount > 0 ? 'white' : '#64748b') + ';font-weight:700;cursor:' + (selCount > 0 ? 'pointer' : 'not-allowed') + ';font-size:0.88em">Next: Set Time →</button>'
        + '<button onclick="_rpState.step=0;_rpRenderGigPicker(document.getElementById(\'rhTabContent\'))" style="padding:10px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer;font-size:0.82em">Back</button>'
        + '</div></div>';
    container.innerHTML = html;
}

window._rpToggleSong = function(title) {
    if (_rpState.selected[title]) delete _rpState.selected[title];
    else _rpState.selected[title] = true;
    _rpRenderSelection(document.getElementById('rhTabContent'));
};

// ── Step 2: Time Input ──────────────────────────────────────────────────────

function _rpGoToTime() {
    _rpState.step = 2;
    var container = document.getElementById('rhTabContent');
    if (!container) return;
    var selCount = Object.keys(_rpState.selected).length;
    var html = '<div style="max-width:520px;margin:0 auto;padding:16px 0">'
        + '<div style="font-size:0.7em;font-weight:800;letter-spacing:0.12em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:6px">Step 3</div>'
        + '<h2 style="margin:0 0 4px;font-size:1.2em;color:var(--text)">How long is your rehearsal?</h2>'
        + '<p style="font-size:0.82em;color:var(--text-dim);margin:0 0 16px">' + selCount + ' songs selected</p>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">';
    [60, 90, 120, 150, 180].forEach(function(m) {
        var active = _rpState.duration === m;
        html += '<button onclick="_rpState.duration=' + m + ';_rpGoToTime()" style="padding:10px 18px;border-radius:8px;font-weight:700;font-size:0.88em;cursor:pointer;border:1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)') + ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + '">' + (m >= 60 ? Math.floor(m/60) + 'h' + (m%60 ? m%60 : '') : m + 'min') + '</button>';
    });
    html += '</div>';
    var usable = Math.round(_rpState.duration * 0.75);
    html += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:16px">Usable rehearsal time: <strong style="color:var(--text)">' + usable + ' min</strong> <span style="opacity:0.5">(75% of total — accounts for setup, breaks, chat)</span></div>';
    html += '<div style="display:flex;gap:8px">'
        + '<button onclick="_rpBuildPlan()" style="flex:1;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:700;cursor:pointer;font-size:0.88em">Build Plan →</button>'
        + '<button onclick="_rpState.step=1;_rpRenderSelection(document.getElementById(\'rhTabContent\'))" style="padding:10px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer;font-size:0.82em">Back</button>'
        + '</div></div>';
    container.innerHTML = html;
}

// ── Step 3: Auto-Build Plan ─────────────────────────────────────────────────

function _rpBuildPlan() {
    var selected = _rpState.setlistSongs.filter(function(s) { return _rpState.selected[s.title]; });
    var b = _rpState.buckets;
    var linkedPairs = _rpState.linkedPairs || [];

    // Build set of all songs that are part of a linked pair (protect from warm-up grab)
    var inLinkedPair = {};
    linkedPairs.forEach(function(lp) {
        if (_rpState.selected[lp.from.title] && _rpState.selected[lp.to.title]) {
            inLinkedPair[lp.from.title] = true;
            inLinkedPair[lp.to.title] = true;
        }
    });

    // Warm-Up: 1-2 ready songs that are NOT part of a linked pair
    var warmup = selected.filter(function(s) { return s._avg >= 3.8 && !inLinkedPair[s.title]; }).slice(0, 2);

    // Deep Work: up to 2 UNITS (a unit = 1 song or 1 linked pair)
    // Priority: linked transitions > low readiness individuals > any non-ready song
    var deepWorkUnits = [];
    var deepWorkUsed = {};

    // Pass 1: linked pairs where BOTH songs are selected
    // Transitions ALWAYS go to Deep Work — the transition itself is the practice target.
    // Focus reason: Song Focus / Transition Focus / Mixed Focus
    linkedPairs.forEach(function(lp) {
        if (deepWorkUnits.length >= 2) return;
        if (!_rpState.selected[lp.from.title] || !_rpState.selected[lp.to.title]) return;
        var fromAvg = lp.from._avg !== undefined ? lp.from._avg : 0;
        var toAvg = lp.to._avg !== undefined ? lp.to._avg : 0;
        var pairAvg = (fromAvg + toAvg) / 2;

        // Per-song readiness status
        var fromStatus = fromAvg >= 3.8 ? 'ready' : fromAvg >= 3.0 ? 'polish' : 'needsWork';
        var toStatus = toAvg >= 3.8 ? 'ready' : toAvg >= 3.0 ? 'polish' : 'needsWork';

        // Determine focus reason
        var bothStrong = fromAvg >= 3.8 && toAvg >= 3.8;
        var eitherWeak = fromAvg < 3.0 || toAvg < 3.0;
        var focusReason = bothStrong ? 'Transition Focus'
            : eitherWeak ? 'Song Focus'
            : 'Mixed Focus';

        // Transition-specific guidance
        var guidance = focusReason === 'Transition Focus'
            ? 'Both songs solid — focus on handoff, entry timing, and groove lock'
            : focusReason === 'Song Focus'
            ? 'Work the weaker song first, then drill the transition'
            : 'Polish songs and tighten the transition together';

        deepWorkUnits.push({
            isLinked: true,
            songs: [lp.from, lp.to],
            title: lp.from.title + ' → ' + lp.to.title,
            _avg: pairAvg,
            _segue: lp.type,
            _blockType: 'deepWork',
            _focusReason: focusReason,
            _guidance: guidance,
            _fromStatus: fromStatus,
            _toStatus: toStatus,
            _fromAvg: fromAvg,
            _toAvg: toAvg
        });
        deepWorkUsed[lp.from.title] = true;
        deepWorkUsed[lp.to.title] = true;
    });

    // Pass 2: individual songs with low readiness (< 3.5, sorted weakest first)
    var deepWorkPool = selected.filter(function(s) {
        return !deepWorkUsed[s.title] && s._avg < 3.5;
    }).sort(function(a, b) { return (a._avg || 0) - (b._avg || 0); });
    while (deepWorkUnits.length < 2 && deepWorkPool.length > 0) {
        deepWorkUnits.push(deepWorkPool.shift());
    }

    // Pass 3: GUARANTEE non-empty — if still empty, pick the weakest selected song
    if (deepWorkUnits.length === 0) {
        var fallback = selected.slice().sort(function(a, b) { return (a._avg || 0) - (b._avg || 0); });
        // Don't pick from warmup
        var warmupSet = {};
        warmup.forEach(function(s) { warmupSet[s.title] = true; });
        fallback = fallback.filter(function(s) { return !warmupSet[s.title]; });
        if (fallback.length > 0) {
            deepWorkUnits.push(fallback[0]);
            deepWorkUsed[fallback[0].title] = true;
        }
    }

    var deepWork = deepWorkUnits;
    console.log('[Planner] Block assembly:', 'warmup:', warmup.map(function(s){return s.title;}), 'deepWork:', deepWork.map(function(u){return u.isLinked ? u.title : u.title;}), 'linked protected:', Object.keys(inLinkedPair));

    // Flow: 3-4 consecutive songs from setlist order (exclude warmup + deep work)
    var used = {};
    warmup.forEach(function(s) { used[s.title] = true; });
    deepWork.forEach(function(u) {
        if (u.isLinked && u.songs) { u.songs.forEach(function(s) { used[s.title] = true; }); }
        else { used[u.title] = true; }
    });
    var flowPool = selected.filter(function(s) { return !used[s.title]; });
    // Find longest consecutive run in setlist order
    var setlistTitles = _rpState.setlistSongs.map(function(s) { return s.title; });
    var flowPoolSet = {};
    flowPool.forEach(function(s) { flowPoolSet[s.title] = true; });
    var bestRun = [], currentRun = [];
    for (var i = 0; i < setlistTitles.length; i++) {
        if (flowPoolSet[setlistTitles[i]]) {
            currentRun.push(flowPool.find(function(s) { return s.title === setlistTitles[i]; }));
            if (currentRun.length > bestRun.length) bestRun = currentRun.slice();
        } else {
            currentRun = [];
        }
    }
    var flow = bestRun.slice(0, 4);

    // Close: 1 high-energy ready song not yet used
    flow.forEach(function(s) { used[s.title] = true; });
    var close = selected.filter(function(s) { return !used[s.title] && s._avg >= 3.5; }).slice(0, 1);

    _rpState.blocks = { warmup: warmup, deepWork: deepWork, flow: flow, close: close };
    _rpState.step = 3;

    // Auto-save plan as GROUPED UNITS (not flat songs)
    // Each unit is either { type:"single", title, block } or { type:"linked", songs:[], block }
    try {
        var planUnits = [];
        var _saveBlock = function(items, bt) {
            items.forEach(function(item) {
                if (item.isLinked && item.songs) {
                    var linkedUnit = {
                        type: 'linked',
                        songs: item.songs.map(function(s) { return { title: s.title, band: s.band || '' }; }),
                        block: bt,
                        focusReason: item._focusReason || 'Transition Focus',
                        guidance: item._guidance || '',
                        fromStatus: item._fromStatus || 'polish',
                        toStatus: item._toStatus || 'polish',
                        fromAvg: item._fromAvg || 0,
                        toAvg: item._toAvg || 0,
                        segue: item._segue || 'flow'
                    };
                    planUnits.push(linkedUnit);
                } else {
                    planUnits.push({ type: 'single', title: item.title, band: item.band || '', block: bt });
                }
            });
        };
        _saveBlock(warmup, 'warmup');
        _saveBlock(deepWork, 'deepWork');
        _saveBlock(flow, 'flow');
        _saveBlock(close, 'close');

        // Save grouped units for render
        localStorage.setItem('glPlannerUnits', JSON.stringify(planUnits));

        // Also save flat queue for Start Rehearsal (execution needs individual songs in order)
        var flatQueue = [];
        var guid = {};
        var gLabels = { warmup: '🔥 WARM-UP — Start playing immediately', deepWork: '🛠️ DEEP WORK — Agree on structure before playing', flow: '🎸 FLOW — Play continuously', close: '🔚 CLOSE — Finish strong' };
        planUnits.forEach(function(u) {
            if (u.type === 'linked') {
                u.songs.forEach(function(s) { flatQueue.push({ title: s.title, band: s.band, _blockType: u.block }); guid[s.title] = gLabels[u.block] || ''; });
            } else {
                flatQueue.push({ title: u.title, band: u.band, _blockType: u.block }); guid[u.title] = gLabels[u.block] || '';
            }
        });
        if (flatQueue.length) {
            localStorage.setItem('glPlannerQueue', JSON.stringify(flatQueue));
            localStorage.setItem('glPlannerGuidance', JSON.stringify(guid));
        }
        console.log('[Planner] Saved ' + planUnits.length + ' units (' + flatQueue.length + ' songs)', planUnits);
    } catch(e) {}

    _rpRenderPlan(document.getElementById('rhTabContent'));
}

function _rpRenderPlan(container) {
    if (!container) return;
    var blocks = _rpState.blocks;
    var usable = Math.round(_rpState.duration * 0.75);

    var html = '<div style="max-width:520px;margin:0 auto;padding:16px 0">'
        + '<div style="font-size:0.7em;font-weight:800;letter-spacing:0.12em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:6px">Your Rehearsal Plan</div>'
        + '<h2 style="margin:0 0 4px;font-size:1.2em;color:var(--text)">' + usable + ' min · ' + (blocks.warmup.length + blocks.deepWork.length + blocks.flow.length + blocks.close.length) + ' songs</h2>'
        + '<p style="font-size:0.78em;color:var(--text-dim);margin:0 0 16px">Edit blocks or launch the rehearsal.</p>';

    function renderBlock(emoji, label, guidance, color, items) {
        var out = '<div style="margin-bottom:14px;padding:12px;border-radius:10px;border:1px solid ' + color + '30;background:' + color + '08">'
            + '<div style="font-size:0.78em;font-weight:800;color:' + color + ';margin-bottom:2px">' + emoji + ' ' + label + '</div>'
            + '<div style="font-size:0.68em;color:' + color + ';opacity:0.7;margin-bottom:8px;font-style:italic">' + guidance + '</div>';
        if (items.length === 0) {
            out += '<div style="font-size:0.75em;color:var(--text-dim);opacity:0.5">No songs assigned</div>';
        } else {
            items.forEach(function(item, i) {
                if (item.isLinked && item.songs && item.songs.length >= 2) {
                    // Linked unit: show as pair with focus reason and per-song status
                    var focusReason = item._focusReason || 'Transition Focus';
                    var guidance = item._guidance || 'Rehearse segue, timing, and entry';
                    var fromStatus = item._fromStatus || 'polish';
                    var toStatus = item._toStatus || 'polish';
                    var _statusChip = function(st) {
                        if (st === 'ready') return '<span style="font-size:0.62em;padding:1px 5px;border-radius:3px;background:rgba(34,197,94,0.15);color:#86efac;font-weight:700">Ready</span>';
                        if (st === 'polish') return '<span style="font-size:0.62em;padding:1px 5px;border-radius:3px;background:rgba(245,158,11,0.15);color:#fbbf24;font-weight:700">Polish</span>';
                        return '<span style="font-size:0.62em;padding:1px 5px;border-radius:3px;background:rgba(239,68,68,0.15);color:#fca5a5;font-weight:700">Needs Work</span>';
                    };
                    var _focusChip = function(fr) {
                        if (fr === 'Transition Focus') return '<span style="font-size:0.62em;padding:1px 5px;border-radius:3px;background:rgba(129,140,248,0.18);color:#a5b4fc;font-weight:700">🔗 Transition Focus</span>';
                        if (fr === 'Song Focus') return '<span style="font-size:0.62em;padding:1px 5px;border-radius:3px;background:rgba(239,68,68,0.15);color:#fca5a5;font-weight:700">🎵 Song Focus</span>';
                        return '<span style="font-size:0.62em;padding:1px 5px;border-radius:3px;background:rgba(245,158,11,0.15);color:#fbbf24;font-weight:700">🔀 Mixed Focus</span>';
                    };
                    out += '<div style="font-size:0.85em;color:var(--text);padding:6px 0;border-left:3px solid #818cf8;padding-left:8px;margin:2px 0">'
                        + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
                        + '<span style="font-size:0.72em;color:var(--text-dim);min-width:16px">' + (i+1) + '</span>'
                        + '<span style="font-weight:600">' + item.songs[0].title + ' <span style="color:#818cf8">→</span> ' + item.songs[1].title + '</span>'
                        + '</div>'
                        + '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:3px 0 1px 22px">'
                        + _statusChip(fromStatus) + ' ' + _focusChip(focusReason) + ' ' + _statusChip(toStatus)
                        + '</div>'
                        + '<div style="font-size:0.65em;color:#818cf8;margin-top:2px;margin-left:22px">' + guidance + '</div>'
                        + '</div>';
                } else {
                    out += '<div style="font-size:0.85em;color:var(--text);padding:3px 0;display:flex;align-items:center;gap:6px">'
                        + '<span style="font-size:0.72em;color:var(--text-dim);min-width:16px">' + (i+1) + '</span>'
                        + '<span style="font-weight:600">' + item.title + '</span>'
                        + '<span style="font-size:0.68em;color:var(--text-dim);margin-left:auto">' + (item._avg > 0 ? item._avg.toFixed(1) : '—') + '</span></div>';
                }
            });
        }
        return out + '</div>';
    }

    html += renderBlock('🔥', 'WARM-UP', 'Start playing immediately — don\'t overtalk', '#f59e0b', blocks.warmup);
    html += renderBlock('🛠️', 'DEEP WORK (max 2 units)', 'Agree on structure before playing — linked pairs count as 1 unit', '#ef4444', blocks.deepWork);
    html += renderBlock('🎸', 'FLOW — SET SIMULATION', 'Play continuously — simulate the gig', '#22c55e', blocks.flow);
    html += renderBlock('🔚', 'CLOSE STRONG', 'Finish strong', '#818cf8', blocks.close);

    html += '<div style="display:flex;gap:8px;margin-top:16px">'
        + '<button onclick="_rpLaunchRehearsal()" style="flex:2;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:800;font-size:0.92em;cursor:pointer">▶ Start Rehearsal</button>'
        + '<button onclick="_rpBuildPlan();_rpState.step=2;_rpGoToTime()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer;font-size:0.82em">Back</button>'
        + '</div></div>';
    container.innerHTML = html;
}

// ── Step 4: Launch ──────────────────────────────────────────────────────────

function _rpLaunchRehearsal() {
    var blocks = _rpState.blocks;
    // Build queue in block order with block-type tags
    var queue = [];
    var _addBlock = function(items, blockType) {
        items.forEach(function(item) {
            if (item.isLinked && item.songs) {
                // Flatten linked unit into individual songs with linked metadata
                item.songs.forEach(function(s, si) {
                    queue.push({ title: s.title, band: s.band || '', _blockType: blockType, _linkedUnit: item.title, _linkedPos: si });
                });
            } else {
                queue.push({ title: item.title, band: item.band || '', _blockType: blockType });
            }
        });
    };
    _addBlock(blocks.warmup, 'warmup');
    _addBlock(blocks.deepWork, 'deepWork');
    _addBlock(blocks.flow, 'flow');
    _addBlock(blocks.close, 'close');

    if (queue.length === 0) { if (typeof showToast === 'function') showToast('No songs in plan'); return; }

    // Store block guidance for dry-run overlay
    window._rpBlockGuidance = {};
    queue.forEach(function(q) {
        var g = { warmup: '🔥 WARM-UP — Start playing immediately, don\'t overtalk',
                  deepWork: '🛠️ DEEP WORK — Agree on structure before playing',
                  flow: '🎸 FLOW — Play continuously, simulate the gig',
                  close: '🔚 CLOSE — Finish strong' };
        window._rpBlockGuidance[q.title] = g[q._blockType] || '';
    });

    // Launch rehearsal-mode with the full plan queue
    if (typeof openRehearsalModeWithQueue === 'function') {
        openRehearsalModeWithQueue(queue);
    }
    if (typeof showToast === 'function') showToast('Rehearsal started · ' + queue.length + ' songs');
}

// ============================================================================
// REHEARSAL SCORECARD + SONG OUTCOMES
// ============================================================================

function _rhBuildScorecardAndOutcomes(session, segments) {
    if (!session) return '';
    var items = session.items || session.blocks || [];
    if (!items.length && !segments.length) return '';

    var html = '';

    // ── Scorecard ──
    if (typeof RehearsalScorecardEngine !== 'undefined') {
        var sc = RehearsalScorecardEngine.generateScorecard(session);
        if (sc && sc.score > 0) {
            var scColor = sc.score >= 85 ? '#22c55e' : sc.score >= 65 ? '#84cc16' : sc.score >= 40 ? '#f59e0b' : '#ef4444';
            html += '<div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.06);margin-bottom:12px">';
            // Header: score + label
            html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">';
            html += '<div style="font-size:2em;font-weight:900;color:' + scColor + ';line-height:1">' + sc.score + '</div>';
            html += '<div><div style="font-size:0.88em;font-weight:700;color:var(--text)">' + sc.label + '</div>';
            html += '<div style="font-size:0.72em;color:var(--text-dim)">' + sc.headline + '</div></div>';
            html += '</div>';
            // Highlights
            if (sc.highlights) {
                if (sc.highlights.biggestWin) html += '<div style="font-size:0.72em;color:#22c55e;padding:2px 0">\u2705 ' + sc.highlights.biggestWin + '</div>';
                if (sc.highlights.biggestRisk) html += '<div style="font-size:0.72em;color:#f59e0b;padding:2px 0">\u26A0 ' + sc.highlights.biggestRisk + '</div>';
            }
            // Top 3 action items
            if (sc.recommendations && sc.recommendations.length) {
                html += '<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.04);padding-top:6px">';
                html += '<div style="font-size:0.62em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Next Steps</div>';
                sc.recommendations.slice(0, 3).forEach(function(rec) {
                    var text = rec.text || rec;
                    html += '<div style="font-size:0.72em;color:var(--text-muted);padding:2px 0">\u2192 ' + text + '</div>';
                });
                html += '</div>';
            }
            html += '</div>';
        }
    }

    // ── Song Outcome Cards ──
    var songItems = items.filter(function(it) { return it.title && it.status; });
    // Also derive outcomes from segments if available
    var segmentSongs = {};
    if (segments && segments.length) {
        segments.forEach(function(seg) {
            var title = seg.label || seg.title || seg.songTitle || '';
            if (!title || seg.type === 'speech' || seg.type === 'silence' || seg.type === 'talking') return;
            if (!segmentSongs[title]) segmentSongs[title] = { attempts: 0, totalDuration: 0, longestDuration: 0 };
            segmentSongs[title].attempts++;
            var dur = seg.duration || seg.durationSec || 0;
            segmentSongs[title].totalDuration += dur;
            if (dur > segmentSongs[title].longestDuration) segmentSongs[title].longestDuration = dur;
        });
    }

    // Merge items + segment data
    var outcomeMap = {};
    songItems.forEach(function(it) {
        outcomeMap[it.title] = {
            title: it.title,
            status: it.status,
            minutes: it.minutes || 0,
            type: it.type || 'run'
        };
    });
    Object.keys(segmentSongs).forEach(function(title) {
        if (!outcomeMap[title]) {
            outcomeMap[title] = { title: title, status: 'done', minutes: Math.round(segmentSongs[title].totalDuration / 60), type: 'run' };
        }
        outcomeMap[title].attempts = segmentSongs[title].attempts;
        outcomeMap[title].longestSec = segmentSongs[title].longestDuration;
    });

    var outcomes = Object.values(outcomeMap);
    if (outcomes.length) {
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
        outcomes.forEach(function(o) {
            // Determine outcome status
            var outcomeLabel = 'Done';
            var outcomeColor = '#94a3b8';
            var outcomeIcon = '\u2705';
            if (o.status === 'skipped') {
                outcomeLabel = 'Skipped'; outcomeColor = '#64748b'; outcomeIcon = '\u23ED';
            } else if (o.attempts && o.attempts >= 3) {
                outcomeLabel = 'Needs work'; outcomeColor = '#f59e0b'; outcomeIcon = '\uD83D\uDD27';
            } else if (o.attempts && o.attempts === 1 && o.longestSec > 120) {
                outcomeLabel = 'Locked in'; outcomeColor = '#22c55e'; outcomeIcon = '\uD83D\uDD12';
            } else if (o.attempts && o.attempts <= 2) {
                outcomeLabel = 'Improving'; outcomeColor = '#84cc16'; outcomeIcon = '\uD83D\uDCC8';
            }
            var attemptStr = o.attempts ? o.attempts + ' take' + (o.attempts > 1 ? 's' : '') : '';

            html += '<div style="flex:1;min-width:140px;max-width:200px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">';
            html += '<div style="font-size:0.78em;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + o.title + '</div>';
            html += '<div style="display:flex;align-items:center;gap:6px;margin-top:3px">';
            html += '<span style="font-size:0.82em">' + outcomeIcon + '</span>';
            html += '<span style="font-size:0.65em;font-weight:700;color:' + outcomeColor + '">' + outcomeLabel + '</span>';
            if (attemptStr) html += '<span style="font-size:0.6em;color:var(--text-dim);margin-left:auto">' + attemptStr + '</span>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
    }

    return html;
}

console.log('✅ rehearsal.js loaded');


// ═══════════════════════════════════════════════════════════════════════════════
// REHEARSAL PLANNER — per-rehearsal plans (songs, goals, notes, export)
// Data key: _band/rehearsal_plan_{YYYY-MM-DD}
// Previously in practice.js — moved here so Rehearsal owns all band planning.
// One-time migration: reads practice_plan_* keys and copies to rehearsal_plan_*
// ═══════════════════════════════════════════════════════════════════════════════

var practicePlanActiveDate = null;

async function loadCalendarEventsRaw() {
    try {
        return toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    } catch(e) { return []; }
}

function formatPracticeDate(dateStr) {
    if (!dateStr) return '?';
    var d = new Date(dateStr + 'T12:00:00');
    var opts = { month: 'short', day: 'numeric' };
    var day = d.toLocaleDateString('en-US', opts);
    var dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    return dow + ' ' + day;
}

async function renderPracticePlanForDate(dateStr, statusMap) {
    var body = document.getElementById('practicePlanBody');
    if (!body) return;

    // ── One-time migration: copy old practice_plan_ keys → rehearsal_plan_ ──────
    var migKey = 'gl_plan_migrated_' + dateStr;
    if (!sessionStorage.getItem(migKey)) {
        try {
            var oldData = await loadBandDataFromDrive('_band', 'practice_plan_' + dateStr);
            if (oldData && Object.keys(oldData).length) {
                await saveBandDataToDrive('_band', 'rehearsal_plan_' + dateStr, oldData);
                console.log('[Migration] practice_plan_' + dateStr + ' → rehearsal_plan_' + dateStr);
            }
            sessionStorage.setItem(migKey, '1');
        } catch(e) {}
    }

    var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr) || {};
    var today = new Date(); today.setHours(0,0,0,0);
    var isPast = new Date(dateStr + 'T00:00:00') < today;
    var goals = toArray(plan.goals || []);
    var planSongs = toArray(plan.songs || []);
    var displayDate = formatPracticeDate(dateStr);

    // ── Ranked suggestions ────────────────────────────────────────────────────
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var THRESH = 3, now2 = Date.now(), actLog2 = [], lastSeen2 = {};
    try { actLog2 = await window.loadMasterFile('_master_activity_log.json') || []; } catch(e) {}
    var ACTS = {practice_track:1,readiness_set:1,rehearsal_note:1,harmony_add:1,harmony_edit:1,part_notes:1};
    (Array.isArray(actLog2) ? actLog2 : []).forEach(function(e) {
        if (!e || !e.song || !e.time || !ACTS[e.action]) return;
        var t = new Date(e.time).getTime();
        if (!isNaN(t) && (!lastSeen2[e.song] || t > lastSeen2[e.song])) lastSeen2[e.song] = t;
    });
    var scored2 = [];
    Object.keys(rc).forEach(function(title) {
        var ratings = rc[title];
        var keys = Object.keys(ratings).filter(function(k) { return typeof ratings[k] === 'number' && ratings[k] > 0; });
        if (!keys.length) return;
        var avg = keys.reduce(function(s, k) { return s + ratings[k]; }, 0) / keys.length;
        if (avg >= THRESH) return;
        var ds = lastSeen2[title] ? Math.floor((now2 - lastSeen2[title]) / 86400000) : null;
        scored2.push({ title: title, avg: avg, score: Math.max(0, THRESH - avg) * 2 + (ds === null ? 3 : ds > 21 ? Math.min(3, Math.floor(ds / 7)) : 0) });
    });
    scored2.sort(function(a, b) { return b.score - a.score; });

    // ── Build DOM ─────────────────────────────────────────────────────────────
    body.innerHTML = '';

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px';
    var hdrLeft = document.createElement('div');
    var hdrTitle = document.createElement('h3');
    hdrTitle.style.cssText = 'margin:0;color:var(--accent-light)';
    hdrTitle.textContent = '🎸 ' + displayDate + (isPast ? ' — Past Rehearsal' : '');
    hdrLeft.appendChild(hdrTitle);
    if (plan.location) {
        var locDiv = document.createElement('div');
        locDiv.style.cssText = 'font-size:0.8em;color:var(--text-dim);margin-top:2px';
        locDiv.textContent = '📍 ' + plan.location;
        hdrLeft.appendChild(locDiv);
    }
    hdr.appendChild(hdrLeft);
    var hdrBtns = document.createElement('div');
    hdrBtns.style.cssText = 'display:flex;gap:6px';
    var detailsBtn = document.createElement('button');
    detailsBtn.className = 'btn btn-ghost btn-sm';
    detailsBtn.textContent = '✏️ Details';
    detailsBtn.onclick = function() { practicePlanEditMeta(dateStr); };
    hdrBtns.appendChild(detailsBtn);
    if (!isPast) {
        var saveHdrBtn = document.createElement('button');
        saveHdrBtn.className = 'btn btn-primary btn-sm';
        saveHdrBtn.textContent = '💾 Save Plan';
        saveHdrBtn.onclick = function() { practicePlanSave(dateStr); };
        hdrBtns.appendChild(saveHdrBtn);
    }
    hdr.appendChild(hdrBtns);
    body.appendChild(hdr);

    // Meta info bar
    if (plan.startTime || plan.location) {
        var metaBar = document.createElement('div');
        metaBar.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;font-size:0.82em;color:var(--text-muted)';
        if (plan.startTime) { var s = document.createElement('span'); s.textContent = '⏰ ' + plan.startTime; metaBar.appendChild(s); }
        if (plan.location)  { var s = document.createElement('span'); s.textContent = '📍 ' + plan.location; metaBar.appendChild(s); }
        if (plan.duration)  { var s = document.createElement('span'); s.textContent = '⏱ ' + plan.duration; metaBar.appendChild(s); }
        body.appendChild(metaBar);
    }

    // Goals section
    var goalsSection = document.createElement('div');
    goalsSection.style.marginBottom = '16px';
    var goalsLbl = document.createElement('div');
    goalsLbl.style.cssText = 'font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px';
    goalsLbl.textContent = '🎯 Session Goals';
    goalsSection.appendChild(goalsLbl);
    var goalsList = document.createElement('div');
    goalsList.id = 'ppGoalsList';
    goalsList.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px';
    if (goals.length) {
        goals.forEach(function(g, i) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 10px';
            var txt = document.createElement('span');
            txt.style.flex = '1'; txt.style.fontSize = '0.88em'; txt.textContent = g;
            row.appendChild(txt);
            if (!isPast) {
                var rmBtn = document.createElement('button');
                rmBtn.style.cssText = 'background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9em';
                rmBtn.textContent = '✕';
                (function(idx) { rmBtn.onclick = function() { ppRemoveGoal(idx, dateStr); }; })(i);
                row.appendChild(rmBtn);
            }
            goalsList.appendChild(row);
        });
    } else {
        var noGoals = document.createElement('div');
        noGoals.style.cssText = 'color:var(--text-dim);font-size:0.85em;font-style:italic';
        noGoals.textContent = 'No goals set yet';
        goalsList.appendChild(noGoals);
    }
    goalsSection.appendChild(goalsList);
    if (!isPast) {
        var goalInputRow = document.createElement('div');
        goalInputRow.style.cssText = 'display:flex;gap:6px';
        var goalInp = document.createElement('input');
        goalInp.className = 'app-input'; goalInp.id = 'ppNewGoal';
        goalInp.placeholder = "Add a goal, e.g. 'Nail the Scarlet→Fire transition'";
        goalInp.style.cssText = 'flex:1;font-size:0.85em';
        goalInp.onkeydown = function(e) { if (e.key === 'Enter') ppAddGoal(dateStr); };
        var addGoalBtn = document.createElement('button');
        addGoalBtn.className = 'btn btn-ghost btn-sm'; addGoalBtn.textContent = '+ Add';
        addGoalBtn.onclick = function() { ppAddGoal(dateStr); };
        goalInputRow.appendChild(goalInp); goalInputRow.appendChild(addGoalBtn);
        goalsSection.appendChild(goalInputRow);
    }
    body.appendChild(goalsSection);

    // Songs section
    var songsSection = document.createElement('div');
    songsSection.style.marginBottom = '16px';
    var songsLbl = document.createElement('div');
    songsLbl.style.cssText = 'font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px';
    songsLbl.textContent = '🎵 Songs to Rehearse';
    songsSection.appendChild(songsLbl);
    var songsList2 = document.createElement('div');
    songsList2.id = 'ppSongsList';
    if (planSongs.length) {
        planSongs.forEach(function(s, i) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 10px;margin-bottom:4px';
            var bandSpan = document.createElement('span');
            bandSpan.style.cssText = 'color:var(--text-dim);font-size:0.72em;min-width:28px';
            bandSpan.textContent = s.band || '';
            var titleSpan = document.createElement('span');
            titleSpan.style.cssText = 'flex:1;font-size:0.88em;cursor:pointer';
            titleSpan.textContent = s.title || '';
            (function(t) { titleSpan.onclick = function() { selectSong(t); showPage('songs'); }; })(s.title);
            row.appendChild(bandSpan); row.appendChild(titleSpan);
            if (s.focus) {
                var focSpan = document.createElement('span');
                focSpan.style.cssText = 'font-size:0.7em;color:var(--yellow);flex-shrink:0';
                focSpan.textContent = s.focus;
                row.appendChild(focSpan);
            }
            if (!isPast) {
                var rmBtn2 = document.createElement('button');
                rmBtn2.style.cssText = 'background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9em;flex-shrink:0';
                rmBtn2.textContent = '✕';
                (function(idx) { rmBtn2.onclick = function() { ppRemoveSong(idx, dateStr); }; })(i);
                row.appendChild(rmBtn2);
            }
            songsList2.appendChild(row);
        });
    } else {
        var noSongs = document.createElement('div');
        noSongs.style.cssText = 'color:var(--text-dim);font-size:0.85em;font-style:italic;padding:4px 0';
        noSongs.textContent = 'No songs added yet';
        songsList2.appendChild(noSongs);
    }
    songsSection.appendChild(songsList2);
    if (!isPast) {
        var addSongRow = document.createElement('div');
        addSongRow.style.cssText = 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap';
        var picker = document.createElement('select');
        picker.className = 'app-select'; picker.id = 'ppSongPicker';
        picker.style.cssText = 'flex:2;min-width:160px;font-size:0.82em';
        var optBlank = document.createElement('option'); optBlank.value = ''; optBlank.textContent = '— Pick a song —';
        picker.appendChild(optBlank);
        if (scored2.length) {
            var og1 = document.createElement('optgroup'); og1.label = '🎯 Needs Work (ranked)';
            scored2.slice(0, 12).forEach(function(s) {
                var o = document.createElement('option'); o.value = s.title;
                o.textContent = s.title + ' — avg ' + s.avg.toFixed(1);
                og1.appendChild(o);
            });
            picker.appendChild(og1);
        }
        var og2 = document.createElement('optgroup'); og2.label = 'All Songs';
        (allSongs||[]).forEach(function(s) {
            var o = document.createElement('option'); o.value = s.title; o.textContent = s.title;
            og2.appendChild(o);
        });
        picker.appendChild(og2);
        var focusInp = document.createElement('input');
        focusInp.className = 'app-input'; focusInp.id = 'ppSongFocus';
        focusInp.placeholder = 'Focus note (optional)';
        focusInp.style.cssText = 'flex:2;min-width:120px;font-size:0.82em';
        var addSongBtn = document.createElement('button');
        addSongBtn.className = 'btn btn-ghost btn-sm'; addSongBtn.textContent = '+ Add';
        addSongBtn.onclick = function() { ppAddSong(dateStr); };
        addSongRow.appendChild(picker); addSongRow.appendChild(focusInp); addSongRow.appendChild(addSongBtn);
        songsSection.appendChild(addSongRow);
    }
    body.appendChild(songsSection);

    // Notes section
    var notesSection = document.createElement('div');
    var notesLbl = document.createElement('div');
    notesLbl.style.cssText = 'font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px';
    notesLbl.textContent = '📝 Notes & Agenda';
    notesSection.appendChild(notesLbl);
    if (!isPast) {
        var ta = document.createElement('textarea');
        ta.className = 'app-textarea'; ta.id = 'ppNotes'; ta.rows = 4;
        ta.placeholder = 'Warm-up order, who\'s bringing what, special requests...';
        ta.value = plan.notes || '';
        notesSection.appendChild(ta);
        var notesBtns = document.createElement('div');
        notesBtns.style.cssText = 'display:flex;gap:8px;margin-top:8px;flex-wrap:wrap';
        var saveBtn2 = document.createElement('button');
        saveBtn2.className = 'btn btn-primary btn-sm'; saveBtn2.textContent = '💾 Save Plan';
        saveBtn2.onclick = function() { practicePlanSave(dateStr); };
        var shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-success btn-sm'; shareBtn.textContent = '🔔 Share to Band';
        shareBtn.onclick = function() { notifFromPracticePlan(dateStr); };
        var exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-ghost btn-sm'; exportBtn.textContent = '📄 Export Text';
        exportBtn.onclick = function() { practicePlanExport(dateStr); };
        notesBtns.appendChild(saveBtn2); notesBtns.appendChild(shareBtn); notesBtns.appendChild(exportBtn);
        notesSection.appendChild(notesBtns);
    } else {
        var notesView = document.createElement('div');
        notesView.style.cssText = 'background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;font-size:0.88em;color:var(--text-muted);white-space:pre-wrap';
        notesView.textContent = plan.notes || 'No notes recorded.';
        notesSection.appendChild(notesView);
    }
    body.appendChild(notesSection);
}

function practicePlanSelectDate(dateStr) {
    practicePlanActiveDate = dateStr;
    renderPracticePlanForDate(dateStr);
    document.querySelectorAll('[data-plan-date]').forEach(function(btn) {
        var active = btn.getAttribute('data-plan-date') === dateStr;
        btn.style.background   = active ? 'var(--accent)' : 'rgba(255,255,255,0.03)';
        btn.style.borderColor  = active ? 'var(--accent)' : 'var(--border)';
        btn.style.color        = active ? 'white' : 'var(--text-muted)';
        btn.style.fontWeight   = active ? '700' : '500';
    });
    var planBody = document.getElementById('practicePlanBody');
    if (planBody) planBody.scrollIntoView({behavior:'smooth', block:'nearest'});
}

async function ppAddGoal(dateStr) {
    if (!requireSignIn()) return;
    var inp = document.getElementById('ppNewGoal');
    var val = inp ? inp.value.trim() : '';
    if (!val) return;
    var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr) || {};
    var goals = toArray(plan.goals || []);
    goals.push(val);
    plan.goals = goals;
    await saveBandDataToDrive('_band', 'rehearsal_plan_' + dateStr, plan);
    inp.value = '';
    renderPracticePlanForDate(dateStr);
}

async function ppRemoveGoal(idx, dateStr) {
    var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr) || {};
    var goals = toArray(plan.goals || []);
    goals.splice(idx, 1);
    plan.goals = goals;
    await saveBandDataToDrive('_band', 'rehearsal_plan_' + dateStr, plan);
    renderPracticePlanForDate(dateStr);
}

async function ppAddSong(dateStr) {
    if (!requireSignIn()) return;
    var pickerEl = document.getElementById('ppSongPicker');
    var title = pickerEl ? pickerEl.value : '';
    if (!title) return;
    var focusEl = document.getElementById('ppSongFocus');
    var focus = focusEl ? focusEl.value.trim() : '';
    var songData = (allSongs||[]).find(function(s) { return s.title === title; });
    var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr) || {};
    var songs = toArray(plan.songs || []);
    if (songs.find(function(s) { return s.title === title; })) { showToast('Already in this plan'); return; }
    songs.push({ title: title, band: songData ? (songData.band || '') : '', focus: focus });
    plan.songs = songs;
    await saveBandDataToDrive('_band', 'rehearsal_plan_' + dateStr, plan);
    if (pickerEl) pickerEl.value = '';
    if (focusEl) focusEl.value = '';
    renderPracticePlanForDate(dateStr);
}

async function ppRemoveSong(idx, dateStr) {
    var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr) || {};
    var songs = toArray(plan.songs || []);
    songs.splice(idx, 1);
    plan.songs = songs;
    await saveBandDataToDrive('_band', 'rehearsal_plan_' + dateStr, plan);
    renderPracticePlanForDate(dateStr);
}

async function practicePlanSave(dateStr) {
    if (!requireSignIn()) return;
    var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr) || {};
    var notesEl = document.getElementById('ppNotes');
    plan.notes = notesEl ? notesEl.value : (plan.notes || '');
    plan.updatedAt = new Date().toISOString();
    plan.updatedBy = currentUserEmail || 'unknown';
    await saveBandDataToDrive('_band', 'rehearsal_plan_' + dateStr, plan);
    var btn = event ? event.target : null;
    if (btn) { var orig = btn.textContent; btn.textContent = '✅ Saved!'; setTimeout(function(){ btn.textContent = orig; }, 1800); }
}

function practicePlanEditMeta(dateStr) {
    var modal = document.createElement('div');
    modal.id = 'ppMetaModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:400px;width:100%;color:var(--text)';
    var mhdr = document.createElement('div');
    mhdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px';
    var mh3 = document.createElement('h3'); mh3.style.margin = '0'; mh3.style.color = 'var(--accent-light)'; mh3.textContent = '✏️ Rehearsal Details';
    var mClose = document.createElement('button'); mClose.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em'; mClose.textContent = '✕';
    mClose.onclick = function() { modal.remove(); };
    mhdr.appendChild(mh3); mhdr.appendChild(mClose); inner.appendChild(mhdr);
    function metaField(id, label, placeholder) {
        var row = document.createElement('div'); row.className = 'form-row'; row.style.marginTop = '8px';
        var lbl = document.createElement('label'); lbl.className = 'form-label'; lbl.textContent = label;
        var inp = document.createElement('input'); inp.className = 'app-input'; inp.id = id; inp.placeholder = placeholder;
        row.appendChild(lbl); row.appendChild(inp); inner.appendChild(row);
    }
    metaField('ppMetaTime', 'Start Time', 'e.g. 7:00 PM');
    metaField('ppMetaLoc',  'Location / Venue', "e.g. Drew's garage, Studio B");
    metaField('ppMetaDur',  'Expected Duration', 'e.g. 3 hours');
    var mBtns = document.createElement('div'); mBtns.style.cssText = 'display:flex;gap:8px;margin-top:16px';
    var mSave = document.createElement('button'); mSave.className = 'btn btn-primary'; mSave.style.flex = '1'; mSave.textContent = '💾 Save';
    mSave.onclick = function() { practicePlanSaveMeta(dateStr); };
    var mCancel = document.createElement('button'); mCancel.className = 'btn btn-ghost'; mCancel.textContent = 'Cancel';
    mCancel.onclick = function() { modal.remove(); };
    mBtns.appendChild(mSave); mBtns.appendChild(mCancel); inner.appendChild(mBtns);
    modal.appendChild(inner);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr).then(function(plan) {
        if (!plan) return;
        if (plan.startTime) document.getElementById('ppMetaTime').value = plan.startTime;
        if (plan.location)  document.getElementById('ppMetaLoc').value  = plan.location;
        if (plan.duration)  document.getElementById('ppMetaDur').value  = plan.duration;
    });
}

async function practicePlanSaveMeta(dateStr) {
    if (!requireSignIn()) return;
    var plan = await loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr) || {};
    plan.startTime = document.getElementById('ppMetaTime') ? document.getElementById('ppMetaTime').value.trim() : '';
    plan.location  = document.getElementById('ppMetaLoc')  ? document.getElementById('ppMetaLoc').value.trim()  : '';
    plan.duration  = document.getElementById('ppMetaDur')  ? document.getElementById('ppMetaDur').value.trim()  : '';
    await saveBandDataToDrive('_band', 'rehearsal_plan_' + dateStr, plan);
    var m = document.getElementById('ppMetaModal'); if (m) m.remove();
    renderPracticePlanForDate(dateStr);
}

function practicePlanNew() {
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:360px;width:100%;color:var(--text);text-align:center';
    inner.innerHTML = '<div style="font-size:2em;margin-bottom:12px">📆</div>'
        + '<h3 style="margin-bottom:8px">Add a Rehearsal on the Calendar</h3>'
        + '<p style="color:var(--text-dim);font-size:0.88em;margin-bottom:20px">Rehearsal plans are tied to calendar events. Add a rehearsal event first, then its plan will appear here.</p>';
    var btns = document.createElement('div'); btns.style.cssText = 'display:flex;gap:8px;justify-content:center';
    var goBtn = document.createElement('button'); goBtn.className = 'btn btn-primary'; goBtn.textContent = '📆 Go to Calendar';
    goBtn.onclick = function() { modal.remove(); showPage('calendar'); };
    var cancelBtn = document.createElement('button'); cancelBtn.className = 'btn btn-ghost'; cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function() { modal.remove(); };
    btns.appendChild(goBtn); btns.appendChild(cancelBtn); inner.appendChild(btns);
    modal.appendChild(inner);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function practicePlanExport(dateStr) {
    loadBandDataFromDrive('_band', 'rehearsal_plan_' + dateStr).then(function(plan) {
        if (!plan) return;
        var displayDate = formatPracticeDate(dateStr);
        var songs = toArray(plan.songs||[]).map(function(s){ return '  \u2022 ' + s.title + (s.focus ? ' \u2014 ' + s.focus : ''); }).join('\n');
        var goals = toArray(plan.goals||[]).map(function(g){ return '  \u2022 ' + g; }).join('\n');
        var text = 'GROOVELINX REHEARSAL PLAN \u2014 ' + displayDate + '\n'
            + (plan.startTime ? '\u23f0 ' + plan.startTime : '') + (plan.location ? '  \ud83d\udccd ' + plan.location : '') + '\n\n'
            + 'GOALS:\n' + (goals || '  (none)') + '\n\nSONGS:\n' + (songs || '  (none)') + '\n\nNOTES:\n' + (plan.notes || '  (none)');
        var modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        var inner = document.createElement('div');
        inner.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:480px;width:100%;color:var(--text)';
        var mhdr = document.createElement('div'); mhdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px';
        var mh3 = document.createElement('h3'); mh3.style.margin = '0'; mh3.style.color = 'var(--accent-light)'; mh3.textContent = '\ud83d\udce4 Share Rehearsal Plan';
        var mClose = document.createElement('button'); mClose.style.cssText = 'background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em'; mClose.textContent = '\u2715';
        mClose.onclick = function() { modal.remove(); };
        mhdr.appendChild(mh3); mhdr.appendChild(mClose); inner.appendChild(mhdr);
        var ta = document.createElement('textarea'); ta.className = 'app-textarea'; ta.rows = 12;
        ta.style.cssText = 'font-family:monospace;font-size:0.78em'; ta.value = text;
        inner.appendChild(ta);
        var copyBtn = document.createElement('button'); copyBtn.className = 'btn btn-primary'; copyBtn.style.cssText = 'width:100%;margin-top:10px'; copyBtn.textContent = '\ud83d\udccb Copy to Clipboard';
        copyBtn.onclick = function() {
            navigator.clipboard.writeText(ta.value).then(function() {
                copyBtn.textContent = '\u2705 Copied!';
                setTimeout(function(){ copyBtn.textContent = '\ud83d\udccb Copy to Clipboard'; }, 1800);
            });
        };
        inner.appendChild(copyBtn); modal.appendChild(inner);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    });
}

// ── Pocket Meter integration ───────────────────────────────────────────────────

/**
 * Navigate to Pocket Meter page and pass the rehearsal event ID as context
 * so groove analysis auto-saves to rehearsals/{eventId}/grooveAnalysis.
 */
function rhOpenPocketMeter(eventId) {
    // Store eventId in a global so renderPocketMeterPage can pick it up
    window._pmPendingRehearsalEventId = eventId;
    if (typeof showPage === 'function') showPage('pocketmeter');
}
window.rhOpenPocketMeter = rhOpenPocketMeter;

/**
 * Load and display groove analysis summary for a rehearsal event.
 * Reads from Firebase: bandPath('rehearsals/{eventId}/grooveAnalysis')
 */
async function rhRenderGrooveAnalysis(eventId) {
    var container = document.getElementById('rhGrooveAnalysis');
    if (!container) return;

    try {
        if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') return;
        var snap = await firebaseDB.ref(bandPath('rehearsals/' + eventId + '/grooveAnalysis')).once('value');
        var ga = snap.val();
        if (!ga) {
            container.innerHTML =
                '<div style="margin-top:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px">' +
                '<div style="font-weight:700;font-size:0.82em;margin-bottom:6px;color:var(--text-muted)">🎚️ Groove Analysis</div>' +
                '<div style="font-size:0.8em;color:var(--text-dim)">No groove data yet — tap <strong style="color:#34d399">Pocket Meter</strong> during rehearsal to record.</div>' +
                '</div>';
            return;
        }

        var score = ga.stabilityScore || 0;
        var scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
        var offsetMs   = ga.pocketPositionMs;
        var offsetStr  = offsetMs === undefined ? '—' : (offsetMs >= 0 ? '+' : '') + offsetMs + 'ms';
        var pocket     = ga.pocketLabel || '';
        var pct        = ga.pctInPocket ? Math.round(ga.pctInPocket) + '%' : '—';
        var beats      = ga.beatCount || '—';
        var savedAt    = ga.savedAt ? new Date(ga.savedAt).toLocaleString() : '';

        container.innerHTML =
            '<div style="margin-top:8px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.18);border-radius:10px;padding:12px 14px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
            '<span style="font-weight:700;font-size:0.82em;color:#34d399">🎚️ Groove Analysis</span>' +
            (savedAt ? '<span style="font-size:0.7em;color:var(--text-dim)">' + savedAt + '</span>' : '') +
            '</div>' +
            '<div style="display:flex;align-items:flex-end;gap:4px;margin-bottom:8px">' +
            '<span style="font-size:2.4em;font-weight:900;color:' + scoreColor + ';line-height:1">' + score + '</span>' +
            '<span style="font-size:0.8em;color:var(--text-muted);margin-bottom:4px">/100 stability</span>' +
            '</div>' +
            '<div style="display:flex;gap:16px;flex-wrap:wrap">' +
            '<div><div style="font-size:0.68em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em">Pocket</div>' +
            '<div style="font-size:0.88em;font-weight:700;color:var(--text)">' + (pocket || '—') + '</div></div>' +
            '<div><div style="font-size:0.68em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em">Offset</div>' +
            '<div style="font-size:0.88em;font-weight:700;color:var(--text)">' + offsetStr + '</div></div>' +
            '<div><div style="font-size:0.68em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em">In Pocket</div>' +
            '<div style="font-size:0.88em;font-weight:700;color:var(--text)">' + pct + '</div></div>' +
            '<div><div style="font-size:0.68em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em">Beats</div>' +
            '<div style="font-size:0.88em;font-weight:700;color:var(--text)">' + beats + '</div></div>' +
            '</div>' +
            '</div>';
    } catch(e) {
        console.warn('[rehearsal] grooveAnalysis load failed:', e);
    }
}
window.rhRenderGrooveAnalysis = rhRenderGrooveAnalysis;

// ── Rehearsal Planner: window exports ─────────────────────────────────────────
window.loadCalendarEventsRaw     = loadCalendarEventsRaw;
window.formatPracticeDate        = formatPracticeDate;
window.renderPracticePlanForDate = renderPracticePlanForDate;
window.practicePlanSelectDate    = practicePlanSelectDate;
window.ppAddGoal                 = ppAddGoal;
window.ppRemoveGoal              = ppRemoveGoal;
window.ppAddSong                 = ppAddSong;
window.ppRemoveSong              = ppRemoveSong;
window.practicePlanSave          = practicePlanSave;
window.practicePlanEditMeta      = practicePlanEditMeta;
window.practicePlanSaveMeta      = practicePlanSaveMeta;
window.practicePlanNew           = practicePlanNew;
window.practicePlanExport        = practicePlanExport;


// =============================================================================
// REHEARSAL INTELLIGENCE  —  renderRehearsalIntel + helpers
// =============================================================================

// ── Tab shim ──────────────────────────────────────────────────────────────────
async function rhShowIntelTab(container) {
    container.innerHTML = '<div style="color:var(--text-dim);padding:40px;text-align:center">Loading intelligence...</div>';
    await renderRehearsalIntel(container, true);
}

// ── Page / tab entry point ────────────────────────────────────────────────────
async function renderRehearsalIntel(el, isTab) {
    var header = isTab ? '' :
        '<div class="page-header"><h1>Rehearsal Intelligence</h1><p>Your band coach — what to rehearse, why, and how long</p></div>';

    el.innerHTML = header + '<div style="color:var(--text-dim);padding:32px;text-align:center">Loading...</div>';

    var ctx = await buildRiContext();
    var focusSongs  = deriveRiFocusSongs(ctx);
    var plan        = deriveRiAutoPlan(ctx, focusSongs);
    var improvement = deriveRiImprovementSummary(ctx);

    // Cache for live mode (advanceRiSong needs these)
    window._riLastCtx         = ctx;
    window._riLastFocusSongs  = focusSongs;

    el.innerHTML = header
        + renderRiHero(ctx, focusSongs, plan)
        + renderRiCTA(ctx)
        + renderRiRehearsalFocus(focusSongs, ctx)
        + renderRiAutoPlan(plan, ctx)
        + renderRiReadinessBreakdown(ctx)
        + renderRiImprovementTracking(improvement, ctx)
        + renderRiGrooveInsight(ctx)
        + _riStyles();
}
window.renderRehearsalIntel = renderRehearsalIntel;

// ── Data context builder ──────────────────────────────────────────────────────
async function buildRiContext() {
    var rc = (typeof GLStore !== 'undefined' && GLStore.getAllReadiness)
        ? GLStore.getAllReadiness()
        : (typeof readinessCache !== 'undefined' ? readinessCache : {});

    var events = [];
    try { events = await rhGetAllEvents(); } catch(e) {}

    var today = new Date(); today.setHours(0,0,0,0);
    var upcoming = events
        .filter(function(e) { return new Date(e.date + 'T00:00:00') >= today; })
        .sort(function(a, b) { return a.date.localeCompare(b.date); });
    var past = events
        .filter(function(e) { return new Date(e.date + 'T00:00:00') < today; })
        .sort(function(a, b) { return b.date.localeCompare(a.date); });

    var nextEvent = upcoming[0] || null;
    var lastEvent = past[0] || null;

    // Songs in upcoming rehearsal plan
    var planSongs = new Set();
    if (nextEvent && nextEvent.plan && Array.isArray(nextEvent.plan.songs)) {
        nextEvent.plan.songs.forEach(function(s) {
            planSongs.add(typeof s === 'string' ? s : (s.title || ''));
        });
    }

    // Filter rc to Active songs only
    var activeRc = {};
    Object.entries(rc).forEach(function(e) {
        if (typeof isSongActive === 'function' && !isSongActive(e[0])) return;
        activeRc[e[0]] = e[1];
    });

    // Load upcoming gig setlist songs for relevance scoping
    var gigSetlistSongs = new Set();
    try {
        var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        var todayStr = (typeof glToday === 'function') ? glToday() : new Date().toISOString().split('T')[0];
        var nextGig = gigs.filter(function(g) { return g.date >= todayStr && g.setlistId; }).sort(function(a,b) { return a.date.localeCompare(b.date); })[0];
        if (nextGig) {
            var setlists = window._glCachedSetlists || toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
            var sl = setlists.find(function(s) { return s.setlistId === nextGig.setlistId; });
            if (sl) {
                (sl.sets || []).forEach(function(set) {
                    (set.songs || []).forEach(function(sg) {
                        gigSetlistSongs.add(typeof sg === 'string' ? sg : (sg.title || ''));
                    });
                });
            }
        }
    } catch(e) {}

    // Overall readiness pct (Active songs only)
    var rcVals = Object.values(activeRc).filter(function(r) {
        return r && typeof r === 'object' && Object.keys(r).length > 0;
    });
    var readyCount = rcVals.filter(function(r) { return _riBandAvg(r) >= 3; }).length;
    var bandPct = rcVals.length ? Math.round((readyCount / rcVals.length) * 100) : null;

    // Groove analysis from last event (optional, non-blocking)
    var grooveData = null;
    if (lastEvent && lastEvent.id && typeof firebaseDB !== 'undefined') {
        try {
            var snap = await firebaseDB.ref(bandPath('rehearsals/' + lastEvent.id + '/grooveAnalysis')).once('value');
            grooveData = snap.val();
        } catch(e) {}
    }

    // Detect linked pairs from gig setlist transitions
    var linkedUnits = [];
    try {
        var gigs2 = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        var todayStr2 = (typeof glToday === 'function') ? glToday() : new Date().toISOString().split('T')[0];
        var nextGig2 = gigs2.filter(function(g) { return g.date >= todayStr2 && g.setlistId; }).sort(function(a,b) { return a.date.localeCompare(b.date); })[0];
        if (nextGig2) {
            var sls2 = window._glCachedSetlists || [];
            var sl2 = sls2.find(function(s) { return s.setlistId === nextGig2.setlistId; });
            if (sl2) {
                (sl2.sets || []).forEach(function(set) {
                    var songs = set.songs || [];
                    for (var li = 0; li < songs.length - 1; li++) {
                        var sg = songs[li];
                        var segue = (typeof sg === 'object') ? (sg.segue || 'stop') : 'stop';
                        if (segue === 'flow' || segue === 'segue') {
                            var fromTitle = typeof sg === 'string' ? sg : (sg.title || '');
                            var toTitle = typeof songs[li+1] === 'string' ? songs[li+1] : (songs[li+1].title || '');
                            if (fromTitle && toTitle) {
                                linkedUnits.push({ from: fromTitle, to: toTitle, type: segue });
                            }
                        }
                    }
                });
            }
        }
    } catch(e) {}

    return { rc: activeRc, events: events, upcoming: upcoming, past: past,
             nextEvent: nextEvent, lastEvent: lastEvent,
             planSongs: planSongs, gigSetlistSongs: gigSetlistSongs,
             linkedUnits: linkedUnits,
             bandPct: bandPct, grooveData: grooveData };
}

// ── Derivation: Focus Songs ───────────────────────────────────────────────────
function deriveRiFocusSongs(ctx) {
    var rc = ctx.rc || {};
    var planSongs = ctx.planSongs || new Set();
    var gigSetlistSongs = ctx.gigSetlistSongs || new Set();
    var linkedUnits = ctx.linkedUnits || [];
    var candidates = [];

    // Build linked lookup: title → linked pair info
    var linkedLookup = {};
    linkedUnits.forEach(function(lu) {
        linkedLookup[lu.from] = lu;
        linkedLookup[lu.to] = lu;
    });

    // Track which songs are already covered by a linked unit candidate
    var coveredByLinked = {};

    // First pass: create linked unit candidates
    // Scoring: transition risk = strong weight, weaker song = medium, setlist = strong
    linkedUnits.forEach(function(lu) {
        var fromRc = rc[lu.from] || {};
        var toRc = rc[lu.to] || {};
        var fromAvg = _riBandAvg(fromRc);
        var toAvg = _riBandAvg(toRc);
        var pairAvg = (fromAvg + toAvg) / 2;
        var weakerAvg = Math.min(fromAvg, toAvg);
        var inSetlist = gigSetlistSongs.has(lu.from) || gigSetlistSongs.has(lu.to);

        // Focus reason
        var bothStrong = fromAvg >= 3.8 && toAvg >= 3.8;
        var eitherWeak = fromAvg < 3.0 || toAvg < 3.0;
        var focusReason = bothStrong ? 'Transition Focus'
            : eitherWeak ? 'Song Focus'
            : 'Mixed Focus';

        // Weighted scoring: transition risk (strong) + weaker song (medium) + setlist (strong)
        var transitionRisk = 30; // transitions always carry inherent risk
        if (lu.type === 'segue') transitionRisk += 10; // segues are harder than flows
        var songWeakness = (5 - weakerAvg) * 6; // medium weight on weaker song
        var setlistBoost = inSetlist ? 35 : 0; // strong weight on setlist priority

        var score = transitionRisk + songWeakness + setlistBoost;
        if (eitherWeak) score += 15; // extra bump when a song actually needs work

        var reasons = [];
        if (inSetlist) reasons.push('Setlist priority');
        reasons.push(focusReason);
        if (eitherWeak) reasons.push('Low readiness');

        candidates.push({
            title: lu.from + ' → ' + lu.to,
            avg: pairAvg,
            reasons: reasons,
            score: score,
            readiness: pairAvg,
            isLinked: true,
            songs: [lu.from, lu.to],
            _inSetlist: inSetlist,
            _focusReason: focusReason
        });
        coveredByLinked[lu.from] = true;
        coveredByLinked[lu.to] = true;
    });

    // Second pass: individual song candidates (skip those covered by linked units)
    Object.entries(rc).forEach(function(entry) {
        var title = entry[0];
        var ratings = entry[1] || {};
        if (coveredByLinked[title]) return;
        var keys = Object.keys(ratings).filter(function(k) {
            return typeof ratings[k] === 'number' && ratings[k] > 0;
        });
        if (!keys.length) return;
        var avg = keys.reduce(function(s, k) { return s + ratings[k]; }, 0) / keys.length;
        if (avg >= 4.5) return;

        var inGigSetlist = gigSetlistSongs.has(title);
        var inPlan = planSongs.has(title);

        var reasons = [];
        if (avg < 2) reasons.push('Critical');
        else if (avg < 3) reasons.push('Low readiness');
        else if (avg < 4) reasons.push('Needs polish');
        if (inGigSetlist) reasons.push('Setlist priority');
        else if (inPlan) reasons.push('In rehearsal plan');

        var score = (5 - avg) * 10;
        if (inGigSetlist) score += 30;
        else if (inPlan) score += 15;
        if (avg < 3) score += 20;

        candidates.push({ title: title, avg: avg, reasons: reasons, score: score, readiness: avg, _inSetlist: inGigSetlist });
    });

    candidates.sort(function(a, b) { return b.score - a.score; });
    var result = candidates.slice(0, 6);

    // GUARANTEE: never return empty — if no candidates, pick lowest-readiness Active song
    if (result.length === 0) {
        var allActive = Object.entries(rc).map(function(e) {
            var avg = _riBandAvg(e[1]);
            return { title: e[0], avg: avg, reasons: ['Lowest readiness'], score: 0, readiness: avg };
        }).filter(function(s) { return s.avg > 0; }).sort(function(a,b) { return a.avg - b.avg; });
        if (allActive.length > 0) result = [allActive[0]];
    }

    return result;
}

// ── Derivation: Auto Plan ────────────────────────────────────────────────────
function deriveRiAutoPlan(ctx, focusSongs) {
    var WARMUP = 10;
    var items = [{ type: 'warmup', label: 'Warmup / Tuning Jam', mins: WARMUP, goal: 'Get loose, tune up' }];
    focusSongs.forEach(function(s) {
        var mins = s.avg < 2 ? 20 : s.avg < 3 ? 15 : s.avg < 4 ? 10 : 8;
        var goal = s.avg < 2 ? 'Rebuild from scratch'
                 : s.avg < 3 ? 'Stabilize arrangement'
                 : s.avg < 4 ? 'Tighten transitions'
                 : 'Final polish';
        items.push({ type: 'song', title: s.title, avg: s.avg, mins: mins, goal: goal });
    });
    var total = items.reduce(function(s, i) { return s + i.mins; }, 0);
    return { items: items, totalMins: total, nextEvent: ctx.nextEvent };
}

// ── Derivation: Improvement Summary ─────────────────────────────────────────
function deriveRiImprovementSummary(ctx) {
    var past = ctx.past || [];
    if (past.length < 2) return { mode: 'empty', past: past };

    // Compare last two events that have readiness snapshots
    // We don't have true historical readiness snapshots — use grooveAnalysis as proxy
    var last = ctx.lastEvent;
    var groove = ctx.grooveData;

    // Build what we can: just show last rehearsal songs + current readiness
    var songs = [];
    if (last && last.plan && Array.isArray(last.plan.songs)) {
        last.plan.songs.forEach(function(s) {
            var title = typeof s === 'string' ? s : (s.title || '');
            var rc = ctx.rc || {};
            var ratings = rc[title];
            if (ratings) {
                var avg = _riFullBandAvg(ratings);
                songs.push({ title: title, current: avg });
            }
        });
    }

    if (!songs.length) return { mode: 'empty', past: past };
    return { mode: 'data', songs: songs, last: last, groove: groove, past: past };
}

// ── Render: Hero — Rehearsal Cockpit ─────────────────────────────────────────
function renderRiHero(ctx, focusSongs, plan) {
    var pct  = ctx.bandPct;
    var conf = deriveRiConfidenceLabel(pct);
    var goal = deriveRiSessionGoal(ctx, focusSongs);

    var next = ctx.nextEvent;
    var metaLine = next
        ? (next.date || '') + (next.location ? ' · ' + next.location : '')
        : 'No rehearsal scheduled';

    var stats = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'
        + _riStatPill(focusSongs.length ? focusSongs.length + ' focus songs' : 'No songs need extra work', '#667eea')
        + _riStatPill(plan.totalMins + ' min est.', '#f59e0b')
        + (conf ? _riStatPill('Confidence: ' + conf.label, conf.color) : '')
        + '</div>';

    return '<div class="ri-hero">'
        + '<div style="font-size:9px;font-weight:800;letter-spacing:0.18em;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:8px">🎛 Rehearsal Cockpit</div>'
        + '<div style="font-size:1.05em;font-weight:900;color:var(--text);line-height:1.3;margin-bottom:2px">' + goal + '</div>'
        + '<div style="font-size:0.75em;color:var(--text-dim);margin-top:3px">' + metaLine + '</div>'
        + stats
        + '</div>';
}

function _riStatPill(text, color) {
    return '<div style="font-size:0.72em;font-weight:700;padding:3px 10px;border-radius:20px;'
        + 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:' + color + ';white-space:nowrap">'
        + text + '</div>';
}

function deriveRiSessionGoal(ctx, focusSongs) {
    var pct = ctx.bandPct;
    if (!focusSongs || !focusSongs.length) {
        var hasSetlist = ctx.gigSetlistSongs && ctx.gigSetlistSongs.size > 0;
        return hasSetlist ? 'Setlist songs are solid — run the set for flow' : 'Active songs are solid — maintain readiness';
    }
    if (pct !== null && pct < 50) return 'Critical session — rebuild weak songs before next gig';
    var topSong = focusSongs[0].title;
    if (focusSongs.length === 1) return 'Lock in ' + topSong + ' this session';
    return 'Focus on ' + topSong + ' + ' + (focusSongs.length - 1) + ' more weak songs';
}

// ── Render: Section 1 — Rehearsal Focus ──────────────────────────────────────
function renderRiRehearsalFocus(focusSongs, ctx) {
    var inner = '';
    if (!focusSongs.length) {
        inner = '<div style="color:var(--text-dim);font-style:italic;padding:10px 0">No critical weak spots in upcoming songs.</div>';
    } else {
        inner = focusSongs.map(function(s, i) {
            var bar = _riBar(s.avg, 5);
            var severity = (typeof GLStatus !== 'undefined') ? GLStatus.getSongSeverity(s.avg)
                         : { label: 'Needs work', color: 'var(--gl-amber)', bg: 'rgba(245,158,11,0.12)' };
            var tags = s.reasons.map(function(r) {
                return '<span class="ri-tag">' + r + '</span>';
            }).join('');
            var safeTitle = s.title.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            return '<div class="ri-song-row">'
                + '<div style="display:flex;align-items:center;gap:10px">'
                + '<span style="font-size:11px;font-weight:900;color:var(--text-dim);width:18px;flex-shrink:0;text-align:right">' + (i+1) + '</span>'
                + '<div style="flex:1;min-width:0">'
                + '<div style="font-weight:700;font-size:0.9em">' + s.title + '</div>'
                + '<div style="font-size:0.72em;color:var(--text-dim);margin-top:1px">avg ' + s.avg.toFixed(1) + ' / 5</div>'
                + '</div>'
                + '<span style="font-size:0.65em;font-weight:800;padding:2px 8px;border-radius:20px;'
                + 'background:' + severity.bg + ';color:' + severity.color + ';border:1px solid ' + severity.color + '44;flex-shrink:0">'
                + severity.label + '</span>'
                + '</div>'
                + '<div style="margin:6px 0 4px 28px">' + bar + '</div>'
                + (tags ? '<div style="margin-left:28px;display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">' + tags + '</div>' : '')
                + '<div style="margin-left:28px;display:flex;gap:6px;margin-top:4px">'
                + '<button onclick="selectSong(\'' + safeTitle + '\');showPage(\'songs\')" '
                + 'style="font-size:11px;padding:4px 10px;border-radius:7px;background:rgba(102,126,234,0.12);border:1px solid rgba(102,126,234,0.3);color:#818cf8;cursor:pointer">Open</button>'
                + '<button onclick="showPage(\'practice\')" '
                + 'style="font-size:11px;padding:4px 10px;border-radius:7px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:var(--text-dim);cursor:pointer">Practice</button>'
                + '</div>'
                + '</div>';
        }).join('');
    }
    return '<div class="ri-section">'
        + _riSectionHead('🎯', 'PRIORITY QUEUE')
        + inner + '</div>';
}

// ── Render: Section 2 — Auto Plan ────────────────────────────────────────────
function renderRiAutoPlan(plan, ctx) {
    var rows = plan.items.map(function(item) {
        var icon = item.type === 'warmup' ? '~' : '*';
        var title = item.type === 'warmup' ? item.label : item.title;
        var avgStr = item.avg !== undefined ? ' · ' + item.avg.toFixed(1) + '/5' : '';
        return '<div class="ri-plan-row">'
            + '<span style="font-size:16px;flex-shrink:0">' + icon + '</span>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-weight:600;font-size:0.88em">' + title + avgStr + '</div>'
            + '<div style="font-size:0.72em;color:var(--text-dim);margin-top:1px">Goal: ' + item.goal + '</div>'
            + '</div>'
            + '<div style="font-size:0.8em;font-weight:700;color:var(--text-dim);flex-shrink:0;text-align:right">'
            + item.mins + ' min</div>'
            + '</div>';
    }).join('');

    var saveBtn = '';
    if (ctx.nextEvent && ctx.nextEvent.id) {
        var eventId = ctx.nextEvent.id;
        var songList = JSON.stringify(plan.items.filter(function(i){return i.type==='song';}).map(function(i){return i.title;}));
        saveBtn = '<button onclick="_riSavePlan(' + songList + ',\'' + eventId + '\')" '
            + 'style="margin-top:12px;padding:9px 16px;border-radius:10px;background:linear-gradient(135deg,#166534,#14532d);color:var(--green);border:1px solid rgba(74,222,128,0.25);font-weight:700;font-size:12px;cursor:pointer;touch-action:manipulation">Use This Plan →</button>';
    }

    return '<div class="ri-section">'
        + _riSectionHead('📋', 'SESSION PLAN')
        + '<div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:0.85em">Estimated rehearsal time: <strong style="color:var(--accent-light);font-size:1.1em">' + plan.totalMins + ' min</strong></div>'
        + rows
        + saveBtn
        + '</div>';
}

// ── Render: Section 3 — Readiness Breakdown ───────────────────────────────────
function renderRiReadinessBreakdown(ctx) {
    var rc  = ctx.rc || {};
    var pct = ctx.bandPct;

    var label = pct === null ? '' :
                pct >= 90 ? 'Gig Ready' :
                pct >= 70 ? 'Minor rehearsal recommended' :
                pct >= 50 ? 'Needs rehearsal' : 'Critical';
    var color = pct === null ? 'var(--text-dim)' :
                pct >= 90 ? 'var(--green)' :
                pct >= 70 ? '#fbbf24' :
                pct >= 50 ? '#f97316' : '#ef4444';

    // Show top 8 weakest songs
    var songs = Object.entries(rc)
        .map(function(e) { return { title: e[0], avg: _riFullBandAvg(e[1]) }; })
        .filter(function(s) { return s.avg > 0; })
        .sort(function(a, b) { return a.avg - b.avg; })
        .slice(0, 8);

    var songRows = songs.map(function(s) {
        var c = s.avg >= 4 ? 'var(--green)' : s.avg >= 3 ? '#fbbf24' : '#ef4444';
        return '<div style="margin-bottom:8px">'
            + '<div style="display:flex;justify-content:space-between;font-size:0.8em;margin-bottom:3px">'
            + '<span style="color:var(--text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">' + s.title + '</span>'
            + '<span style="color:' + c + ';font-weight:700;flex-shrink:0">' + s.avg.toFixed(1) + '</span>'
            + '</div>'
            + _riBar(s.avg, 5)
            + '</div>';
    }).join('');

    var overall = pct !== null
        ? '<div style="margin-bottom:14px">'
          + '<div style="display:flex;justify-content:space-between;font-size:0.82em;margin-bottom:4px">'
          + '<span style="font-weight:700;color:var(--text)">Overall Band Readiness</span>'
          + '<span style="color:' + color + ';font-weight:800">' + pct + '% — ' + label + '</span>'
          + '</div>'
          + _riBar(pct, 100)
          + '</div>'
        : '';

    return '<div class="ri-section">'
        + _riSectionHead('📊', 'BAND READINESS BREAKDOWN')
        + overall
        + (songs.length
            ? '<div style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Weakest Songs</div>' + songRows
            : '<div style="color:var(--text-dim);font-style:italic">No readiness data yet. Set ratings in the song library.</div>')
        + '</div>';
}

// ── Render: Section 4 — Improvement Tracking ─────────────────────────────────
function renderRiImprovementTracking(summary, ctx) {
    var inner = '';
    if (summary.mode === 'empty') {
        var pastCount = (summary.past || []).length;
        inner = '<div style="color:var(--text-dim);font-style:italic;padding:10px 0">'
            + (pastCount === 0
                ? 'No past rehearsals recorded yet. Complete a session to start tracking improvement.'
                : 'Complete a few more rehearsals with readiness updates to unlock improvement tracking.')
            + '</div>';
    } else {
        var last = summary.last;
        var dateStr = last && last.date ? last.date : 'Last session';
        inner = '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:10px">Based on songs from: <strong style="color:var(--text)">' + dateStr + '</strong></div>';

        inner += summary.songs.map(function(s) {
            var c = s.current >= 4 ? 'var(--green)' : s.current >= 3 ? '#fbbf24' : '#ef4444';
            var deltaHtml = '';
            if (typeof s.prev === 'number' && s.prev > 0) {
                var delta = s.current - s.prev;
                var dSign = delta >= 0 ? '+' : '';
                var dColor = delta > 0 ? 'var(--green)' : delta < 0 ? '#ef4444' : 'var(--text-dim)';
                deltaHtml = ' <span style="font-size:0.72em;color:' + dColor + ';font-weight:700">' + dSign + delta.toFixed(1) + ' readiness improvement</span>';
            }
            return '<div class="ri-song-row">'
                + '<div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85em;flex-wrap:wrap;gap:4px">'
                + '<span style="font-weight:600">' + s.title + '</span>'
                + '<span style="display:flex;align-items:center;gap:6px"><span style="color:' + c + ';font-weight:700">' + s.current.toFixed(1) + ' / 5</span>' + deltaHtml + '</span>'
                + '</div>'
                + '<div style="margin-top:4px">' + _riBar(s.current, 5) + '</div>'
                + '</div>';
        }).join('');

        if (summary.groove) {
            var gs = summary.groove;
            inner += '<div style="margin-top:12px;padding:10px;background:rgba(200,255,0,0.04);border-left:2px solid #c8ff00;border-radius:0 8px 8px 0">'
                + '<div style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#c8ff00;text-transform:uppercase;margin-bottom:4px">Pocket Meter</div>'
                + (gs.tempoStabilityScore !== undefined
                    ? '<div style="font-size:0.82em;color:var(--text)">Tempo stability: <strong>' + Math.round(gs.tempoStabilityScore) + '%</strong></div>'
                    : '<div style="font-size:0.82em;color:var(--text-dim)">Groove data recorded</div>')
                + '</div>';
        }
    }

    return '<div class="ri-section">'
        + _riSectionHead('📈', 'SESSION IMPACT')
        + inner + '</div>';
}

// ── Save plan to existing rehearsal event ────────────────────────────────────

// ── Render: Groove Insight (optional) ────────────────────────────────────────
function renderRiGrooveInsight(ctx) {
    var ga = ctx.grooveData;
    if (!ga || ga.stabilityScore === undefined) return '';
    var score = Math.round(ga.stabilityScore);
    var scoreColor = score >= 80 ? 'var(--green)' : score >= 60 ? '#fbbf24' : '#ef4444';
    var trendHtml = '';
    if (typeof ga.prevStabilityScore === 'number') {
        var delta = score - Math.round(ga.prevStabilityScore);
        var dStr = (delta >= 0 ? '+' : '') + delta + '%';
        var dColor = delta > 0 ? 'var(--green)' : '#ef4444';
        trendHtml = ' <span style="font-size:0.82em;font-weight:700;color:' + dColor + '">' + dStr + '</span>';
    }
    return '<div class="ri-section">'
        + _riSectionHead('🎚️', 'GROOVE INSIGHT')
        + '<div style="display:flex;align-items:center;gap:12px">'
        + '<div style="font-size:2em;font-weight:900;color:' + scoreColor + ';line-height:1">' + score + '</div>'
        + '<div>'
        + '<div style="font-size:0.82em;font-weight:700;color:var(--text)">/100 groove stability' + trendHtml + '</div>'
        + (ga.pocketLabel ? '<div style="font-size:0.75em;color:var(--text-dim);margin-top:2px">Pocket: ' + ga.pocketLabel + '</div>' : '')
        + (ga.pctInPocket ? '<div style="font-size:0.75em;color:var(--text-dim)">In pocket: ' + Math.round(ga.pctInPocket) + '%</div>' : '')
        + '</div>'
        + '</div>'
        + '</div>';
}

// ── Render: Start Rehearsal Mode CTA ─────────────────────────────────────────
function renderRiCTA(ctx) {
    var hasEvent = !!(ctx.nextEvent && ctx.nextEvent.id);
    var eventId  = hasEvent ? ctx.nextEvent.id : '';
    var label    = hasEvent ? 'Start Rehearsal Mode' : 'Schedule a Rehearsal';
    var sublabel = hasEvent
        ? (ctx.nextEvent.date || '') + (ctx.nextEvent.location ? ' · ' + ctx.nextEvent.location : '')
        : 'No rehearsal scheduled yet';
    var pmBtn = hasEvent
        ? '<button onclick="rhOpenPocketMeter(\'' + eventId + '\')" '
          + 'style="width:100%;margin-top:8px;padding:10px 16px;border-radius:10px;'
          + 'background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);'
          + 'color:#34d399;font-weight:700;font-size:0.88em;cursor:pointer;'
          + 'touch-action:manipulation">🎚️ Open Pocket Meter</button>'
        : '';
    return '<div style="margin:16px 0 8px">'
        + '<button onclick="rhLaunchFromSession(\'' + eventId + '\')" '
        + 'style="width:100%;padding:14px 20px;border-radius:14px;'
        + 'background:linear-gradient(135deg,#667eea,#764ba2);'
        + 'color:white;border:none;font-weight:800;font-size:1em;cursor:pointer;'
        + 'letter-spacing:0.02em;touch-action:manipulation;'
        + 'box-shadow:0 4px 20px rgba(102,126,234,0.35)">'
        + label
        + '</button>'
        + pmBtn
        + (sublabel ? '<div style="text-align:center;font-size:0.72em;color:var(--text-dim);margin-top:6px">' + sublabel + '</div>' : '')
        + '</div>';
}

// BUG FIX: navigate to Sessions tab first so rhEventList DOM exists,
// OR enter live cockpit mode if Intel context is already loaded
// Launch Live Rehearsal Mode directly from Sessions event view.
// Builds context from the event's plan songs without requiring Intel tab visit.
async function rhLaunchFromSession(eventId) {
    if (!eventId) { showToast('No event selected'); return; }
    var events = await rhGetAllEvents();
    var ev = events.find(function(e) { return e.id === eventId; });
    if (!ev || !ev.plan || !ev.plan.songs || !ev.plan.songs.length) {
        showToast('No songs in rehearsal plan');
        return;
    }
    var focusSongs = ev.plan.songs.map(function(s) { return { title: s.title || s, band: s.band || '' }; });
    var ctx = { nextEvent: ev };
    enterLiveRehearsalMode(ctx, focusSongs);
}
window.rhLaunchFromSession = rhLaunchFromSession;

function rhStartRehearsalMode(eventId) {
    if (window._riLastCtx && window._riLastFocusSongs && window._riLastFocusSongs.length) {
        enterLiveRehearsalMode(window._riLastCtx, window._riLastFocusSongs);
        return;
    }
    if (!eventId) { showPage('rehearsal'); return; }
    showPage('rehearsal');
    setTimeout(function() { rhOpenEvent(eventId); }, 120);
}
window.rhStartRehearsalMode = rhStartRehearsalMode;

async function _riSavePlan(songTitles, eventId) {
    if (!requireSignIn()) return;
    try {
        var events = await rhGetAllEvents();
        var ev = events.find(function(e) { return e.id === eventId; });
        if (!ev) { showToast('Event not found'); return; }
        var plan = ev.plan || { songs: [], focusSections: {}, notes: '' };
        // Merge without duplicates
        var existing = plan.songs || [];
        songTitles.forEach(function(t) {
            if (existing.indexOf(t) === -1) existing.push(t);
        });
        plan.songs = existing;
        await rhSavePlanData(eventId, plan);
        showToast('✅ Plan saved to rehearsal');
    } catch(e) { showToast('Could not save plan'); }
}
window._riSavePlan = _riSavePlan;

// ── Utilities ────────────────────────────────────────────────────────────────
function _riFullBandAvg(ratings) {
    if (!ratings || typeof ratings !== 'object') return 0;
    var keys = Object.keys(ratings).filter(function(k) { return typeof ratings[k] === 'number' && ratings[k] > 0; });
    if (!keys.length) return 0;
    return keys.reduce(function(s, k) { return s + ratings[k]; }, 0) / keys.length;
}
function _riBandAvg(ratings) { return _riFullBandAvg(ratings); }

function _riBar(val, max) {
    var pct = Math.min(100, Math.round((val / max) * 100));
    var color = pct >= 80 ? 'var(--green)' : pct >= 60 ? '#fbbf24' : pct >= 40 ? '#f97316' : '#ef4444';
    return '<div style="height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden">'
        + '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px;transition:width 0.4s"></div>'
        + '</div>';
}

function _riSectionHead(icon, title) {
    return '<div class="ri-section__header"><span class="ri-section__icon">' + icon + '</span><span class="ri-section__title">' + title + '</span></div>';
}

function deriveRiBandStatus(ctx) {
    var pct = ctx.bandPct;
    if (pct === null || pct === undefined) return 'No data yet';
    if (pct >= 90) return 'Gig Ready';
    if (pct >= 70) return 'Minor rehearsal recommended';
    if (pct >= 50) return 'Needs rehearsal';
    return 'Critical';
}

function deriveRiConfidenceLabel(pct) {
    if (pct === null || pct === undefined) return null;
    if (pct >= 90) return { label: 'Strong', detail: 'band is gig ready', color: 'var(--green)' };
    if (pct >= 70) return { label: 'Moderate', detail: 'minor rehearsal recommended', color: '#fbbf24' };
    if (pct >= 50) return { label: 'Weak', detail: 'rehearsal required', color: '#f97316' };
    return { label: 'Critical', detail: 'significant work needed', color: '#ef4444' };
}


// ── Groove Radar ─────────────────────────────────────────────────────────────
function deriveRiGrooveRadar(ga) {
    if (!ga || ga.stabilityScore === undefined) return null;
    var score  = Math.round(ga.stabilityScore || 0);
    var offset = ga.pocketPositionMs || 0;
    var label, color;
    if (score >= 85)      { label = 'Locked In';              color = '#10b981'; }
    else if (score >= 70) { label = offset > 10 ? 'Slight rush' : offset < -10 ? 'Slight drag' : 'Solid pocket'; color = '#34d399'; }
    else if (score >= 55) { label = offset > 15 ? 'Rushing — slow down' : offset < -15 ? 'Dragging — push it' : 'Unsteady pocket'; color = '#f59e0b'; }
    else                  { label = 'Needs another pass';     color = '#ef4444'; }
    var trendLabel = '';
    if (typeof ga.prevStabilityScore === 'number') {
        var delta = score - Math.round(ga.prevStabilityScore);
        trendLabel = delta > 3 ? 'Improving' : delta < -3 ? 'Declining' : 'Steady';
    }
    return { score: score, label: label, color: color, trendLabel: trendLabel };
}

// ── Live Rehearsal Mode ───────────────────────────────────────────────────────
var _riLive = { active: false, songIdx: 0, songs: [], eventId: null, startTime: null, songStartTime: null, timerTick: null };

function enterLiveRehearsalMode(ctx, focusSongs) {
    _riLive.active        = true;
    // Milestone 4: notify shell we're entering performance mode
    if (typeof GLStore !== 'undefined' && GLStore.setAppMode) GLStore.setAppMode('performance');
    if (typeof glWakeLock !== 'undefined') glWakeLock.acquire('live-rehearsal');
    if (typeof GLStore !== 'undefined' && GLStore.setLiveRehearsalSong) {
        var firstSong = (focusSongs && focusSongs[0]) ? focusSongs[0].title : null;
        GLStore.setLiveRehearsalSong(firstSong);
    }
    _riLive.songs         = (focusSongs || []).map(function(s) { return s.title; });
    _riLive.songIdx       = 0;
    _riLive.eventId       = ctx.nextEvent ? ctx.nextEvent.id : null;
    _riLive.startTime     = Date.now();
    _riLive.songStartTime = Date.now();
    var container = document.getElementById('rhTabContent');
    if (!container) return;
    renderRiLiveMode(ctx, focusSongs, container);
    if (_riLive.timerTick) clearInterval(_riLive.timerTick);
    _riLive.timerTick = setInterval(function() {
        var el = document.getElementById('ri-live-elapsed');
        if (!el) { clearInterval(_riLive.timerTick); return; }
        var s = Math.floor((Date.now() - _riLive.songStartTime) / 1000);
        el.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    }, 1000);
}
window.enterLiveRehearsalMode = enterLiveRehearsalMode;

// ── Agenda Overlay (Milestone 6 Phase 2B) ────────────────────────────────────

function _renderAgendaOverlay() {
    if (typeof GLStore === 'undefined' || !GLStore.getActiveRehearsalAgendaSession) return '';
    var session = GLStore.getActiveRehearsalAgendaSession();
    if (!session) return '';
    if (session.status === 'completed') return _renderAgendaComplete();
    if (session.status !== 'active') return '';

    var item = GLStore.getCurrentRehearsalAgendaItem();
    if (!item) return '';

    var nextItem = GLStore.getNextRehearsalAgendaItem();
    var slotNum = session.currentIndex + 1;
    var totalSlots = session.items.length;

    var typeColors = { warmup: '#22c55e', repair: '#f59e0b', learn: '#818cf8', closer: '#60a5fa', transition: '#a78bfa' };
    var typeIcons = { warmup: '🔥', repair: '🔧', learn: '📖', closer: '🎯', transition: '🔗' };
    var color = typeColors[item.type] || '#94a3b8';
    var icon = typeIcons[item.type] || '🎵';

    var h = '<div style="margin-top:10px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:10px;padding:10px 12px">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
    h += '<span style="font-size:0.65em;font-weight:800;letter-spacing:0.12em;color:rgba(99,102,241,0.6);text-transform:uppercase">Rehearsal Agenda</span>';
    h += '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim,#475569)">Slot ' + slotNum + ' of ' + totalSlots + '</span>';
    h += '</div>';

    // Transition item: special two-song display
    if (item.type === 'transition') {
        var _dimStyle = 'opacity:0.5;font-weight:400';
        var _activeStyle = 'font-weight:700;color:var(--text)';
        var _tConf = item.transitionConfidence !== undefined ? item.transitionConfidence : 2.5;
        h += '<div style="margin-bottom:6px;border-left:3px solid #a78bfa;padding-left:8px">';
        h += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">';
        h += '<span style="font-size:0.65em;font-weight:700;color:#a78bfa;text-transform:uppercase">🔗 Transition Practice · ' + item.minutes + ' min</span>';
        h += _renderTransitionConfBadge(_tConf);
        h += '</div>';
        h += '<div style="font-size:0.85em;' + (item.fromSongReady ? _dimStyle : _activeStyle) + '">' + (item.fromTitle || '') + (item.fromSongReady ? ' <span style="font-size:0.65em;color:#22c55e">✓ Ready</span>' : '') + '</div>';
        h += '<div style="font-size:0.72em;color:#a78bfa;margin:1px 0">↓ handoff</div>';
        h += '<div style="font-size:0.85em;' + (item.toSongReady ? _dimStyle : _activeStyle) + '">' + (item.toTitle || '') + (item.toSongReady ? ' <span style="font-size:0.65em;color:#22c55e">✓ Ready</span>' : '') + '</div>';
        h += '</div>';
        if (item.reason) h += '<div style="font-size:0.72em;color:var(--text-dim,#475569);margin-bottom:4px;font-style:italic">' + item.reason + '</div>';
        if (item.focus) h += '<div style="font-size:0.75em;color:var(--text-muted,#94a3b8);margin-bottom:6px">Focus: ' + item.focus + '</div>';
    } else {
        // Standard item display
        h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
        h += '<span style="font-size:1em">' + icon + '</span>';
        h += '<div style="flex:1;min-width:0">';
        h += '<span style="font-size:0.72em;font-weight:700;color:' + color + ';text-transform:uppercase">' + (item.type || '') + '</span>';
        h += '<span style="font-size:0.68em;color:var(--text-dim,#475569);margin-left:6px">' + item.minutes + ' min</span>';
        h += '</div>';
        h += '</div>';

        // Focus
        if (item.focus) {
            h += '<div style="font-size:0.75em;color:var(--text-muted,#94a3b8);margin-bottom:6px">Focus: ' + item.focus + '</div>';
        }
    }

    // Next up preview
    if (nextItem) {
        h += '<div style="font-size:0.68em;color:var(--text-dim,#475569);margin-bottom:8px">Next: ' + nextItem.title + '</div>';
    }

    // Agenda controls
    h += '<div style="display:flex;gap:6px">';
    if (nextItem) {
        h += '<button onclick="agendaCompleteAndNext()" style="flex:2;padding:7px;border-radius:8px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#86efac;font-size:0.78em;font-weight:700;cursor:pointer">✓ Complete & Next</button>';
        h += '<button onclick="agendaSkip()" style="flex:1;padding:7px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:var(--text-dim,#475569);font-size:0.78em;cursor:pointer">Skip</button>';
    } else {
        h += '<button onclick="agendaCompleteAndNext()" style="flex:1;padding:7px;border-radius:8px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#86efac;font-size:0.78em;font-weight:700;cursor:pointer">✓ Complete Agenda</button>';
    }
    h += '</div>';

    h += '</div>';
    return h;
}

function _renderAgendaComplete() {
    var summary = (typeof GLStore !== 'undefined' && GLStore.getLatestCompletedSummary)
        ? GLStore.getLatestCompletedSummary() : null;

    var h = '<div style="margin-top:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:12px 14px">';
    h += '<div style="text-align:center;margin-bottom:10px">';
    h += '<div style="font-size:1.4em;margin-bottom:4px">✅</div>';
    h += '<div style="font-size:0.92em;font-weight:800;color:#86efac">Agenda Complete</div>';
    h += '</div>';

    if (summary) {
        // Stats row
        h += '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;flex-wrap:wrap">';
        h += '<span style="font-size:0.72em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(34,197,94,0.12);color:#86efac">'
            + summary.completedCount + ' completed · ' + summary.completedMinutes + ' min</span>';
        if (summary.skippedCount > 0) {
            h += '<span style="font-size:0.72em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(251,191,36,0.12);color:#fbbf24">'
                + summary.skippedCount + ' skipped · ' + summary.skippedMinutes + ' min</span>';
        }
        h += '</div>';

        // Completed songs
        if (summary.completedSongs.length) {
            h += '<div style="margin-bottom:8px">';
            h += '<div style="font-size:0.65em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:4px">Completed</div>';
            for (var c = 0; c < summary.completedSongs.length; c++) {
                var cs = summary.completedSongs[c];
                h += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.8em">';
                h += '<span style="color:#34d399">✓</span>';
                h += '<span style="color:var(--text,#f1f5f9);flex:1">' + cs.title + '</span>';
                h += '<span style="font-size:0.75em;color:var(--text-dim,#475569)">' + cs.minutes + 'min</span>';
                h += '</div>';
            }
            h += '</div>';
        }

        // Skipped songs
        if (summary.skippedSongs.length) {
            h += '<div>';
            h += '<div style="font-size:0.65em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:4px">Skipped</div>';
            for (var sk = 0; sk < summary.skippedSongs.length; sk++) {
                var ss = summary.skippedSongs[sk];
                h += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.8em">';
                h += '<span style="color:#fbbf24">–</span>';
                h += '<span style="color:var(--text-dim,#475569);flex:1">' + ss.title + '</span>';
                h += '<span style="font-size:0.75em;color:var(--text-dim,#475569)">' + ss.minutes + 'min</span>';
                h += '</div>';
            }
            h += '</div>';
        }
    } else {
        h += '<div style="font-size:0.72em;color:var(--text-dim,#475569);text-align:center">All slots finished. Nice work.</div>';
    }

    h += '</div>';
    return h;
}

window.agendaCompleteAndNext = function() {
    if (typeof GLStore === 'undefined') return;

    // Check if current item is a transition — show feedback capture first
    var currentItem = GLStore.getCurrentRehearsalAgendaItem();
    if (currentItem && currentItem.type === 'transition') {
        _showTransitionFeedback(currentItem);
        return;
    }

    _agendaAdvance();
};

function _agendaAdvance() {
    var nextItem = GLStore.advanceRehearsalAgendaSession();
    if (nextItem) {
        _riLive.songIdx = _findSongIndex(nextItem.songId);
        _riLive.songStartTime = Date.now();
        var container = document.getElementById('rhTabContent');
        if (container) renderRiLiveMode(window._riLastCtx || {}, window._riLastFocusSongs || [], container);
    } else {
        var container = document.getElementById('rhTabContent');
        if (container) renderRiLiveMode(window._riLastCtx || {}, window._riLastFocusSongs || [], container);
    }
}

function _showTransitionFeedback(item) {
    var existing = document.getElementById('transitionFeedbackOverlay');
    if (existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'transitionFeedbackOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid rgba(167,139,250,0.3);border-radius:14px;padding:24px;max-width:380px;width:100%;color:var(--text,#e2e8f0);text-align:center">'
        + '<div style="font-size:1.2em;margin-bottom:6px">🔗</div>'
        + '<div style="font-size:0.92em;font-weight:700;margin-bottom:4px">' + (item.fromTitle || '') + ' → ' + (item.toTitle || '') + '</div>'
        + '<div style="font-size:0.75em;color:var(--text-dim);margin-bottom:16px">How did the transition feel?</div>'
        + '<div style="display:flex;flex-direction:column;gap:8px">'
        + '<button onclick="_submitTransitionFeedback(\'nailed_it\')" style="padding:12px;border-radius:10px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac;font-weight:700;cursor:pointer;font-size:0.88em">🎯 Nailed it</button>'
        + '<button onclick="_submitTransitionFeedback(\'felt_tighter\')" style="padding:12px;border-radius:10px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.1);color:#fbbf24;font-weight:700;cursor:pointer;font-size:0.88em">📈 Felt tighter</button>'
        + '<button onclick="_submitTransitionFeedback(\'still_rough\')" style="padding:12px;border-radius:10px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#fca5a5;font-weight:700;cursor:pointer;font-size:0.88em">🔄 Still rough</button>'
        + '</div></div>';
    document.body.appendChild(ov);
}

window._submitTransitionFeedback = function(outcome) {
    var item = GLStore.getCurrentRehearsalAgendaItem();
    if (item && item.type === 'transition' && typeof GLStore.saveTransitionPracticeResult === 'function') {
        GLStore.saveTransitionPracticeResult({
            fromSongId: item.fromSongId,
            toSongId: item.toSongId,
            outcome: outcome
        });
    }
    var ov = document.getElementById('transitionFeedbackOverlay');
    if (ov) ov.remove();
    _agendaAdvance();
};

window.agendaSkip = function() {
    if (typeof GLStore === 'undefined') return;
    var nextItem = GLStore.skipCurrentRehearsalAgendaItem();
    if (nextItem) {
        _riLive.songIdx = _findSongIndex(nextItem.songId);
        _riLive.songStartTime = Date.now();
        var container = document.getElementById('rhTabContent');
        if (container) renderRiLiveMode(window._riLastCtx || {}, window._riLastFocusSongs || [], container);
    } else {
        var container = document.getElementById('rhTabContent');
        if (container) renderRiLiveMode(window._riLastCtx || {}, window._riLastFocusSongs || [], container);
    }
};

function _findSongIndex(songId) {
    for (var i = 0; i < _riLive.songs.length; i++) {
        if (_riLive.songs[i] === songId) return i;
    }
    return _riLive.songIdx; // fallback: stay on current
}

function renderRiLiveMode(ctx, focusSongs, container) {
    var cur   = _riLive.songs[_riLive.songIdx] || 'No songs';
    var next  = _riLive.songs[_riLive.songIdx + 1] || null;
    var done  = _riLive.songIdx;
    var total = _riLive.songs.length;
    var pct   = total ? Math.round((done / total) * 100) : 0;

    var grHtml = '';
    if (ctx.grooveData) {
        var gr = deriveRiGrooveRadar(ctx.grooveData);
        if (gr) {
            grHtml = '<div style="margin-top:8px;padding:8px 12px;border-radius:8px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:10px">'
                + '<span style="font-size:0.68em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.4);text-transform:uppercase">Groove Radar</span>'
                + '<span style="font-size:0.82em;font-weight:800;color:' + gr.color + '">' + gr.label + '</span>'
                + (gr.trendLabel ? '<span style="font-size:0.7em;color:var(--text-dim)">· ' + gr.trendLabel + '</span>' : '')
                + '<span style="margin-left:auto;font-size:0.75em;font-weight:700;color:' + gr.color + '">' + gr.score + '/100</span>'
                + '</div>';
        }
    }

    var queueRows = _riLive.songs.map(function(title, i) {
        var st = i < done ? 'done' : i === done ? 'current' : 'upcoming';
        var bg     = st === 'current' ? 'rgba(102,126,234,0.15)' : 'rgba(255,255,255,0.02)';
        var border = st === 'current' ? '1px solid rgba(102,126,234,0.4)' : '1px solid rgba(255,255,255,0.05)';
        var icon   = st === 'done' ? '✓' : st === 'current' ? '▸' : '·';
        var col    = st === 'done' ? '#34d399' : st === 'current' ? '#818cf8' : 'var(--text-dim)';
        var weight = st === 'current' ? '700' : '500';
        var textCol = st === 'current' ? 'var(--text)' : 'var(--text-dim)';
        var safeTitle = title.replace(/'/g, "\\'");
        return '<div onclick="riOpenSongChart(\'' + safeTitle + '\',' + i + ')" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:' + bg + ';border:' + border + ';margin-bottom:4px;cursor:pointer;touch-action:manipulation">'
            + '<span style="font-size:0.82em;color:' + col + ';flex-shrink:0">' + icon + '</span>'
            + '<span style="font-size:0.85em;font-weight:' + weight + ';color:' + textCol + ';flex:1">' + title + '</span>'
            + '<span style="font-size:0.7em;color:' + col + ';opacity:0.5">📖</span>'
            + '</div>';
    }).join('');

    var eventId = _riLive.eventId || '';
    var pmBtnHtml = eventId
        ? '<button onclick="rhOpenPocketMeter(\'' + eventId + '\')" style="flex:1;padding:10px;border-radius:10px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);color:#34d399;font-size:0.82em;cursor:pointer">Meter</button>'
        : '';

    container.innerHTML =
        '<div style="padding:4px 0">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
        + '<div style="font-size:9px;font-weight:800;letter-spacing:0.18em;color:rgba(255,255,255,0.4);text-transform:uppercase">Live Rehearsal Mode</div>'
        + '<button onclick="endRiSession()" style="font-size:11px;padding:4px 10px;border-radius:7px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#f87171;cursor:pointer">End Session</button>'
        + '</div>'
        + '<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(102,126,234,0.3);border-radius:16px;padding:16px;margin-bottom:10px">'
        + '<div style="font-size:9px;font-weight:800;letter-spacing:0.14em;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:8px">Now Rehearsing</div>'
        + '<div style="font-size:1.4em;font-weight:900;color:var(--text);line-height:1.2;margin-bottom:4px">' + cur + '</div>'
        + '<div style="font-size:0.75em;color:var(--text-dim);margin-bottom:10px">'
        + '<span id="ri-live-elapsed">0:00</span> elapsed'
        + (next ? ' &nbsp;·&nbsp; Next: <strong style="color:var(--text-muted)">' + next + '</strong>' : ' &nbsp;·&nbsp; Last song')
        + '</div>'
        + grHtml
        + _renderAgendaOverlay()
        // Primary CTAs: Open Chart + Band Notes
        + '<div style="display:flex;gap:6px;margin-top:10px">'
        + '<button onclick="riOpenSongChart(\'' + cur.replace(/'/g, "\\'") + '\',' + done + ')" style="flex:2;padding:11px;border-radius:10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;font-weight:800;font-size:0.88em;cursor:pointer;touch-action:manipulation">📖 Open Chart</button>'
        + '<button onclick="riOpenSongChart(\'' + cur.replace(/'/g, "\\'") + '\',' + done + ',\'bandnotes\')" style="flex:1;padding:11px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);font-size:0.82em;cursor:pointer">🎯 Notes</button>'
        + '</div>'
        // Session controls
        + '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'
        + '<button onclick="advanceRiSong()" style="flex:2;padding:10px;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;font-weight:800;font-size:0.85em;cursor:pointer;touch-action:manipulation">Next Song ›</button>'
        + '<button onclick="repeatRiSong()" style="flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);font-size:0.82em;cursor:pointer">↻ Repeat</button>'
        + pmBtnHtml
        + '</div>'
        + '</div>'
        + '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px;margin-bottom:10px">'
        + '<div style="display:flex;justify-content:space-between;font-size:0.75em;color:var(--text-dim);margin-bottom:6px">'
        + '<span>Session Progress</span><span>' + done + ' / ' + total + ' songs</span>'
        + '</div>'
        + '<div style="height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden">'
        + '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:3px;transition:width 0.4s"></div>'
        + '</div>'
        + '</div>'
        + '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:10px">'
        + '<div style="font-size:9px;font-weight:800;letter-spacing:0.12em;color:rgba(255,255,255,0.35);text-transform:uppercase;margin-bottom:8px">Session Queue</div>'
        + queueRows
        + '</div>'
        + '</div>';
}

function advanceRiSong() {
    if (_riLive.songIdx < _riLive.songs.length - 1) {
        _riLive.songIdx++;
        _riLive.songStartTime = Date.now();
        var container = document.getElementById('rhTabContent');
        if (container) renderRiLiveMode(window._riLastCtx || {}, window._riLastFocusSongs || [], container);
    } else {
        endRiSession();
    }
}
window.advanceRiSong = advanceRiSong;

function repeatRiSong() {
    _riLive.songStartTime = Date.now();
    var el = document.getElementById('ri-live-elapsed');
    if (el) el.textContent = '0:00';
}
window.repeatRiSong = repeatRiSong;

// Open chart for a song from live rehearsal — bridges live mode → rehearsal-mode.js
window.riOpenSongChart = function(songTitle, queueIdx, tab) {
    if (!songTitle) return;
    // Jump queue position if clicking a different song
    if (typeof queueIdx === 'number' && queueIdx !== _riLive.songIdx && queueIdx >= 0 && queueIdx < _riLive.songs.length) {
        _riLive.songIdx = queueIdx;
        _riLive.songStartTime = Date.now();
        var container = document.getElementById('rhTabContent');
        if (container) renderRiLiveMode(window._riLastCtx || {}, window._riLastFocusSongs || [], container);
    }
    // Route to Workbench (legacy rehearsal-mode is hidden fallback per
    // Drew's deprecation directive 2026-05-10).
    if (typeof openWorkbench === 'function') {
        openWorkbench(songTitle, 'practice', {});
    } else if (typeof openRehearsalMode === 'function') {
        openRehearsalMode(songTitle);
    }
};

function endRiSession() {
    _riLive.active = false;
    if (_riLive.timerTick) { clearInterval(_riLive.timerTick); _riLive.timerTick = null; }
    // Milestone 4: restore workspace mode
    if (typeof GLStore !== 'undefined' && GLStore.setAppMode) GLStore.setAppMode('workspace');
    if (typeof glWakeLock !== 'undefined') glWakeLock.release('live-rehearsal');
    if (typeof GLStore !== 'undefined' && GLStore.setLiveRehearsalSong) GLStore.setLiveRehearsalSong(null);
    // Milestone 6: clear active agenda if one was driving this session
    if (typeof GLStore !== 'undefined' && GLStore.clearRehearsalAgenda) GLStore.clearRehearsalAgenda();
    showToast('Session ended');
    showPage('rehearsal');
}
window.endRiSession = endRiSession;

function _riStyles() {
    if (document.getElementById('ri-styles')) return '';
    var s = document.createElement('style');
    s.id = 'ri-styles';
    s.textContent = [
        '.ri-hero{background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:18px 16px;border:1px solid rgba(255,255,255,0.08);margin-bottom:12px}',
        '.ri-section{background:rgba(255,255,255,0.03);border-radius:14px;padding:14px 14px 12px;border:1px solid rgba(255,255,255,0.07);margin-bottom:10px}',
        '.ri-section__header{display:flex;align-items:center;gap:6px;margin-bottom:12px}',
        '.ri-section__icon{font-size:14px}',
        '.ri-section__title{font-size:10px;font-weight:800;letter-spacing:0.13em;color:var(--text-dim);text-transform:uppercase}',
        '.ri-song-row{padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)}',
        '.ri-song-row:last-child{border-bottom:none}',
        '.ri-plan-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)}',
        '.ri-plan-row:last-child{border-bottom:none}',
        '.ri-tag{font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.25);white-space:nowrap}'
    ].join('');
    document.head.appendChild(s);
    return '';
}

// ── Focus change listener — re-render Rehearsal when focus data changes ──────
// Skip the re-render when the user is in Plan Mode (or inside the wizard, which
// renders into #rhTabContent under #rhMain). Re-rendering wipes #rhMain and
// strands the wizard's DOM mid-edit, which surfaces as rage-clicks on
// checkboxes that "do nothing" while the rerender keeps swallowing them.
// Focus data isn't the primary surface in Plan Mode anyway — it's just used
// to seed new plans.
// Reality Stabilization Fix #03 (2026-05-13): GLStore.on returns an
// unsubscribe function. Capture it so `window._rhFocusTeardown()` can
// detach the subscription on sign-out. Handler is intentionally
// session-wide (self-guards via `currentPage === 'rehearsal'`) and is NOT
// registered with the route lifecycle — re-attaching on every rehearsal
// visit would either double-subscribe or require teardown coordination
// that this single guarded handler doesn't need.
if (typeof GLStore !== 'undefined' && GLStore.on) {
  var _rhFocusUnsubscribe = GLStore.on('focusChanged', function() {
    if (typeof currentPage !== 'undefined' && currentPage === 'rehearsal') {
      if (_rhPageMode === 'plan') return;
      var el = document.getElementById('page-rehearsal');
      if (el) renderRehearsalPage(el);
    }
  });
  window._rhFocusTeardown = function _rhFocusTeardown() {
    if (typeof _rhFocusUnsubscribe === 'function') {
      try { _rhFocusUnsubscribe(); } catch(e) {}
      _rhFocusUnsubscribe = null;
    }
  };
}

// ── GLActions: rehearsal-domain actions ─────────────────────────────────────
// Real handlers overwrite the gl-actions.js stubs. Invoked by GrooveMate
// (ambient suggestions) and eventually by GLActionRouter (avatar input).
if (typeof window !== 'undefined' && window.GLActions) {
  // Open the suggested song's detail view. This is the path GrooveMate
  // takes when a gig is imminent and a setlist song needs work.
  window.GLActions.register('rehearsal.suggestNextSong', function (args) {
    if (!args || !args.songId) return { ok: false, reason: 'missing songId' };
    if (typeof window.selectSong === 'function') {
      window.selectSong(args.songId);
      return { ok: true, navigatedTo: args.songId };
    }
    if (typeof window.showPage === 'function') {
      window.showPage('songs');
      return { ok: true, navigatedTo: 'songs', fallback: true };
    }
    return { ok: false, reason: 'no navigator' };
  }, { source: 'rehearsal.js' });

  // Wraps the existing rehearsal page entry. Deeper agenda surfaces can
  // register over this later.
  window.GLActions.register('rehearsal.startRehearsal', function () {
    if (typeof window.showPage === 'function') {
      window.showPage('rehearsal');
      return { ok: true };
    }
    return { ok: false, reason: 'no navigator' };
  }, { source: 'rehearsal.js' });
}
