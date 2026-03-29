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
    if (queue.length > 0 && typeof openRehearsalModePractice === 'function') {
        openRehearsalModePractice(queue);
    } else if (queue.length > 0 && typeof openRehearsalMode === 'function') {
        openRehearsalMode(queue[0].title); // fallback single-song
    } else {
        showPage('songs');
    }
};

// ── Recreate session from recording ──────────────────────────────────────────
window._rhRecreateFromRecording = function() {
    var existing = document.getElementById('rhRecreateModal');
    if (existing) existing.remove();
    var today = new Date().toISOString().split('T')[0];
    var ov = document.createElement('div');
    ov.id = 'rhRecreateModal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)';
    ov.innerHTML = '<div style="max-width:420px;width:100%;background:#1e293b;border-radius:16px;padding:24px;border:1px solid rgba(255,255,255,0.08);max-height:90vh;overflow-y:auto">'
        + '<div style="font-size:1em;font-weight:800;color:#f1f5f9;margin-bottom:4px">Recreate from Recording</div>'
        + '<div style="font-size:0.78em;color:#64748b;margin-bottom:16px">Recover a past rehearsal that wasn\u2019t tracked.</div>'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Date</label>'
        + '<input type="date" id="rhRecDate" value="' + today + '" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.85em;margin-bottom:12px;color-scheme:dark">'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Recording (URL or paste link)</label>'
        + '<input type="text" id="rhRecUrl" placeholder="Google Drive, Dropbox, or direct URL" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.85em;margin-bottom:12px">'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Songs worked on</label>'
        + '<input type="text" id="rhRecSongs" placeholder="Song 1, Song 2, Song 3" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.85em;margin-bottom:12px">'
        + '<label style="font-size:0.75em;font-weight:700;color:var(--text-dim);display:block;margin-bottom:4px">Notes (optional)</label>'
        + '<textarea id="rhRecNotes" rows="2" placeholder="How did it go?" style="width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.3);color:var(--text);font-size:0.85em;margin-bottom:16px;resize:vertical"></textarea>'
        + '<button onclick="_rhSaveRecreatedSession()" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;font-size:0.92em;cursor:pointer">Save Recovered Rehearsal</button>'
        + '<button onclick="document.getElementById(\'rhRecreateModal\').remove()" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:none;background:none;color:#64748b;cursor:pointer;font-size:0.78em">Cancel</button>'
        + '</div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
};

window._rhSaveRecreatedSession = async function() {
    var date = (document.getElementById('rhRecDate') || {}).value || new Date().toISOString().split('T')[0];
    var url = (document.getElementById('rhRecUrl') || {}).value || '';
    var songStr = (document.getElementById('rhRecSongs') || {}).value || '';
    var notes = (document.getElementById('rhRecNotes') || {}).value || '';
    var songs = songStr.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    var session = {
        sessionId: 'rsess_rec_' + Date.now().toString(36),
        date: new Date(date + 'T12:00:00').toISOString(),
        start_time: new Date(date + 'T19:00:00').toISOString(),
        end_time: new Date(date + 'T21:00:00').toISOString(),
        totalBudgetMin: 0,
        totalActualMin: 120,
        blocksCompleted: songs.length,
        totalBlocks: songs.length,
        songsWorked: songs,
        notes: notes,
        mixdown_id: null,
        recording_url: url,
        recovered: true,
        recoveredLabel: 'Recovered from recording',
        blocks: songs.map(function(s) { return { title: s, budgetMin: 0, actualMin: 0 }; })
    };

    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try {
            await db.ref(bandPath('rehearsal_sessions') + '/' + session.sessionId).set(session);
            if (typeof showToast === 'function') showToast('\u2705 Recovered rehearsal saved');
        } catch(e) {
            if (typeof showToast === 'function') showToast('Save failed \u2014 check connection');
        }
    }

    var modal = document.getElementById('rhRecreateModal');
    if (modal) modal.remove();
    // Try to generate Reveal insights if Product Brain is available
    if (typeof GLProductBrain !== 'undefined' && GLProductBrain.getInsightFromSession) {
        try { GLProductBrain.getInsightFromSession(session.sessionId); } catch(e) {}
    }
    _rhRenderSessionHistory();
};

var rhCurrentEventId = null; // which event is open in detail view

// ── Page entry point ──────────────────────────────────────────────────────────
var _rhActiveTab = 'events';

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

async function renderRehearsalPage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'rehearsal');
    window.GL_REHEARSAL_READY = false;
    el.innerHTML = '<div id="rhMain"><div style="color:var(--text-dim);padding:40px;text-align:center">Loading...</div></div>';
    _rhActiveTab = 'tonight';
    _rhRenderCommandFlow(el);
}

async function _rhRenderCommandFlow(el) {
    var main = document.getElementById('rhMain');
    if (!main) return;

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
        if (avg >= 4) { confLabel = 'Strong'; confColor = '#22c55e'; }
        else if (avg >= 3) { confLabel = 'Moderate'; confColor = '#f59e0b'; }
        else { confLabel = 'Needs Work'; confColor = '#ef4444'; }
    }

    var html = '';

    // ── Page title ──
    var _rhPageTitle = 'Tonight\u2019s Rehearsal';
    if (_rhNextEvent && _rhNextEvent.date && _rhNextEvent.date !== today) {
        var _rhEventDate = new Date(_rhNextEvent.date + 'T12:00:00');
        _rhPageTitle = 'Next Rehearsal \u2014 ' + _rhEventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    html += '<div style="margin-bottom:12px">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<h1 style="font-size:1.3em;font-weight:900;color:var(--text);margin:0">Rehearsal Plan</h1>';
    html += '<span style="font-size:0.62em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);color:#818cf8">Draft</span>';
    html += '</div>';
    html += '<div style="font-size:0.82em;color:var(--text-dim);margin-top:4px">This is your next rehearsal. We\u2019ll track it and show you what to fix.</div>';
    // Focus from engine
    var _rhFocusPrimary = weakSongs.length > 0 ? weakSongs[0].title : null;
    var _rhFocusMore = weakSongs.length > 1 ? ' (+' + (weakSongs.length - 1) + ' more)' : '';
    if (_rhFocusPrimary) html += '<div style="font-size:0.78em;color:#fbbf24;font-weight:600;margin-top:4px">Focus for this rehearsal: <strong>' + _rhFocusPrimary + '</strong>' + _rhFocusMore + '</div>';
    html += '</div>';

    // ── SECTION 1: Context ──
    html += '<div style="margin-bottom:16px">';
    if (nextGig) {
        html += '<div style="padding:14px 16px;border-radius:12px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15)">'
            + '<div style="font-size:0.65em;font-weight:800;letter-spacing:0.1em;color:rgba(99,102,241,0.6);text-transform:uppercase;margin-bottom:4px">Preparing for</div>'
            + '<div style="font-size:1.1em;font-weight:800;color:var(--text)">' + gigLabel + ' <span style="font-weight:500;font-size:0.72em;color:var(--text-dim)">\u00B7 ' + (gigDaysAway === 0 ? 'Today' : gigDaysAway === 1 ? 'Tomorrow' : gigDaysAway + ' days') + '</span></div>'
            + (weakSongs.length > 0 ? '<div style="font-size:0.78em;color:var(--text-dim);margin-top:4px">Focus on <strong>' + weakSongs[0].title + '</strong>' + (weakSongs.length > 1 ? ' + ' + (weakSongs.length - 1) + ' more' : '') + '</div>' : '')
            + (availHtml ? '<div style="margin-top:8px">' + availHtml + '</div>' : '')
            + '</div>';
    } else {
        html += '<div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06)">'
            + '<div style="font-size:0.82em;color:var(--text-dim)">No upcoming gig scheduled. <button onclick="showPage(\'gigs\')" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-weight:600;padding:0">Add a gig \u2192</button></div>'
            + '</div>';
    }
    html += '</div>';

    // ── SECTION 2: Saved Plan indicator + Primary CTA ──
    // Try Firebase first, then fall back to localStorage
    var fbPlan = await _rhLoadPlanFromFirebase();
    if (fbPlan && fbPlan.units && fbPlan.units.length) {
        // Sync Firebase plan to localStorage
        try { localStorage.setItem('glPlannerUnits', JSON.stringify(fbPlan.units)); } catch(e) {}
    }
    var hasSavedPlan = false;
    try { hasSavedPlan = !!localStorage.getItem('glPlannerUnits') || !!localStorage.getItem('glPlannerQueue'); } catch(e) {}
    var savedAgenda = (typeof GLStore !== 'undefined' && GLStore.getLatestRehearsalAgenda) ? GLStore.getLatestRehearsalAgenda() : null;
    if (savedAgenda && savedAgenda.items && savedAgenda.items.length) hasSavedPlan = true;

    // ── Primary + Secondary CTAs — always visible above plan details ──
    if (hasSavedPlan) {
        html += '<div style="margin-bottom:12px">'
            + '<button onclick="_rhConfirmStartRehearsal()" style="width:100%;padding:16px;border-radius:12px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:1em;cursor:pointer;box-shadow:0 4px 16px rgba(34,197,94,0.3)">\u25B6 Start Band Rehearsal</button>'
            + '<div style="font-size:0.68em;color:var(--text-dim);text-align:center;margin-top:4px">Use this when the band is actually rehearsing together.</div>'
            + '<button onclick="_rhOpenChartsOnly()" style="width:100%;margin-top:8px;padding:10px;border-radius:10px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.04);color:#a5b4fc;font-weight:600;font-size:0.85em;cursor:pointer">\uD83D\uDCDD Practice Without Starting a Rehearsal</button>'
            + '<div style="font-size:0.65em;color:#475569;text-align:center;margin-top:3px">No session will be saved.</div>'
            + '</div>';
    }

    // ── SECTION 2: Saved Plan details ──
    if (hasSavedPlan) {
        var savedUnits = _rhGetUnits();
        var songCount = savedUnits.reduce(function(n, u) { return n + (u.type === 'linked' ? u.songs.length : 1); }, 0);
        console.log('[Planner] Rendering saved plan:', savedUnits.length, 'units,', songCount, 'songs', savedUnits);

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
        html += '<div id="rhPlanCard" style="margin-bottom:12px;padding:12px 14px;border-radius:10px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.2)">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
            + '<span onclick="_rhEditPlanName()" style="font-size:0.78em;font-weight:800;color:#86efac;cursor:pointer;border-bottom:1px dashed rgba(134,239,172,0.3)" title="Click to rename">✅ ' + escHtml(planName) + '</span>'
            + '<span id="rhSaveState" style="font-size:0.58em;font-weight:600"></span>'
            + '<span style="font-size:0.65em;color:var(--text-dim)">' + savedUnits.length + ' units · ' + songCount + ' songs</span>'
            + '<span style="font-size:0.65em;font-weight:700;color:#a5b4fc;padding:1px 6px;border-radius:4px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2)">\u23F1 ' + _preTotalLabel + '</span>'
            + '<button onclick="_rhRunWalkthrough()" style="margin-left:auto;font-size:0.62em;padding:2px 8px;border-radius:4px;border:1px solid rgba(99,102,241,0.2);background:none;color:#a5b4fc;cursor:pointer" title="Show guided tour">?</button>'
            + '<button onclick="_rhClearSavedPlan()" style="font-size:0.62em;padding:2px 8px;border-radius:4px;border:1px solid rgba(239,68,68,0.2);background:none;color:#f87171;cursor:pointer">Clear Plan</button>'
            + '</div>';

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

            html += '<div class="rh-unit-row" data-idx="' + idx + '" draggable="true" style="border-bottom:1px solid rgba(255,255,255,0.03);border-radius:4px;' + rowBg + _focusBorder + '">'
                + '<div>'
                + dragHandle
                + '<span style="width:18px;flex-shrink:0;text-align:center;font-size:0.78em;font-weight:700;color:var(--text-dim)">' + unitNum + '</span>'
                + '<span style="width:20px;flex-shrink:0;text-align:center;font-size:0.75em">' + cfg.icon + '</span>'
                + '<span' + editClick + editTitle + ' style="flex:1;min-width:0;font-size:0.85em;color:' + cfg.color + ';font-weight:' + (isPlayable && bt !== 'multi_song' ? '500' : '600') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (!isPlayable ? 'font-style:italic;' : '') + (isEditable ? 'cursor:pointer' : '') + '">' + unitLabel + '</span>'
                + '<span class="rh-row-controls">'
                + minChip + assignChip + noteChip
                + '<button onclick="_rhRemoveUnit(' + idx + ')" style="' + _editBtnStyle + ';color:#f87171" title="Remove">✕</button>'
                + '</span>'
                + '</div>'
                + (noteText ? '<div onclick="_rhEditBlockNote(' + idx + ')" style="padding:0 4px 4px 36px;font-size:0.68em;color:#fbbf24;opacity:0.7;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="Click to edit note">📝 ' + escHtml(noteSnippet) + '</div>' : '')
                + '</div>';
        });
        html += '</div>';

        // Focus songs not in plan — recommend adding
        var _planTitles = {};
        savedUnits.forEach(function(u) {
            if (u.title) _planTitles[u.title] = true;
            if (u.songs) u.songs.forEach(function(s) { if (s.title) _planTitles[s.title] = true; });
        });
        var _missingFocus = _rhFocus.list.filter(function(f) { return !_planTitles[f.title]; });
        if (_missingFocus.length > 0) {
            html += '<div style="margin:8px 0;padding:8px 12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:8px">';
            html += '<div style="font-size:0.68em;font-weight:700;color:#fbbf24;margin-bottom:4px">Focus songs not in this plan:</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
            _missingFocus.forEach(function(f) {
                var _mfSafe = f.title.replace(/'/g, "\\'");
                html += '<button onclick="_rhAddBlock(\'song\',\'' + _mfSafe + '\')" style="font-size:0.68em;padding:3px 8px;border-radius:5px;border:1px solid rgba(245,158,11,0.25);background:rgba(245,158,11,0.06);color:#fbbf24;cursor:pointer">+ ' + escHtml(f.title) + '</button>';
            });
            html += '</div></div>';
        }

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
            + '<div style="font-size:0.9em;color:var(--text-dim);font-style:italic">Use sections to organize, templates to add fast, and drag to reorder. Tap the time on any block to adjust.</div>'
            + '</div></details>';

        // Plan actions (edit-level, not rehearsal-start)
        html += '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">'
            + '<button onclick="rhOpenCreateModal()" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;font-size:0.75em;font-weight:600;cursor:pointer">+ Schedule Date</button>'
            + '<button onclick="renderRehearsalPlanner()" style="flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);font-size:0.75em;cursor:pointer">\u270F\uFE0F Edit Plan</button>'
            + '</div>'
            + '<div id="rhSnapshots"></div>';
    } else {
        // No saved plan — show planner CTA + snapshots for restore
        html += '<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">'
            + '<button onclick="renderRehearsalPlanner()" style="flex:2;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:white;font-weight:800;font-size:0.92em;cursor:pointer;min-height:48px">▶ Plan Next Rehearsal</button>'
            + '<button onclick="rhShowTab(\'history\')" style="flex:1;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);font-size:0.82em;cursor:pointer">Past Rehearsals</button>'
            + '</div>'
            + '<div id="rhSnapshots"></div>';
    }

    // ── Rehearsal History (collapsed by default) ──
    html += '<details style="border-top:2px solid rgba(255,255,255,0.06);margin:16px 0;padding-top:12px">';
    html += '<summary style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:4px 0">'
        + '<span style="font-size:0.72em;font-weight:800;letter-spacing:0.08em;color:var(--text-dim);text-transform:uppercase">\uD83D\uDCCB Rehearsal History</span>'
        + '</summary>';
    html += '<div style="margin-top:8px">';
    html += '<div style="margin-bottom:6px"><button onclick="_rhRecreateFromRecording()" style="font-size:0.65em;padding:3px 8px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">+ Recreate from Recording</button></div>';
    html += '<div id="rhSessionReview"></div>';
    html += '<div id="rhSessionHistory"></div>';
    html += '<div id="rhMixdownsContainer" style="margin-top:12px"></div>';
    html += '</div></details>';

    // ── Tab content area (AI suggestions) ──
    html += '<div id="rhTabContent"></div>';

    main.innerHTML = html;
    window.GL_REHEARSAL_READY = true;

    // Render mixdowns section
    if (typeof RehearsalMixdowns !== 'undefined') RehearsalMixdowns.render('rhMixdownsContainer');

    // Wire up drag-and-drop on the unit list
    _rhInitDragDrop();

    // Render saved snapshots
    _rhRenderSnapshots();

    // First-visit walkthrough (only when a saved plan exists)
    if (hasSavedPlan && typeof glSpotlight !== 'undefined') {
        setTimeout(function() { glSpotlight.run('rehearsal-plan-v3'); }, 800);
    }

    // Render last rehearsal session review + history
    // Unified Past Rehearsals (includes most recent — no separate "Last Rehearsal" card)
    _rhRenderSessionHistory();

    // Show AI focus below the saved plan (complementary, not competing)
    if (hasSavedPlan) {
        // When plan exists, show a collapsed AI suggestions section
        var tabEl = document.getElementById('rhTabContent');
        if (tabEl) {
            tabEl.innerHTML = '<details style="margin-top:4px"><summary style="font-size:0.68em;font-weight:700;letter-spacing:0.1em;color:var(--text-dim);text-transform:uppercase;cursor:pointer;padding:6px 0">Broader Analysis (not current focus)</summary><div id="rhAISuggestions"></div></details>';
            _rhRenderTonightTab_inner(document.getElementById('rhAISuggestions'));
        }
    } else {
        _rhRenderTonightTab();
    }
}

// Clear saved rehearsal plan (explicit user action — auto-snapshots first)
window._rhClearSavedPlan = async function() {
    if (!confirm('Clear your saved rehearsal plan? A snapshot will be saved automatically.')) return;
    await _rhSaveSnapshot('Before clearing plan');
    try {
        localStorage.removeItem('glPlannerQueue');
        localStorage.removeItem('glPlannerGuidance');
        localStorage.removeItem('glPlannerUnits');
    } catch(e) {}
    _rhDeletePlanFromFirebase();
    if (typeof showToast === 'function') showToast('Plan cleared (snapshot saved)');
    var el = document.getElementById('rhMain');
    if (el) _rhRenderCommandFlow(document.querySelector('.app-page:not(.hidden)') || document.body);
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
        name: nameOverride || ('Before editing plan'),
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
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try { await db.ref(bandPath('rehearsal_sessions/' + sessionId)).remove(); } catch(e) {}
    _rhSessionsCache = null;
}

window._rhDeleteSessionUI = async function(sessionId) {
    if (!confirm('Delete this rehearsal session?')) return;
    await _rhDeleteSession(sessionId);
    if (typeof showToast === 'function') showToast('Session deleted');
    _rhRenderSessionHistory();
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
};

async function _rhRenderSessionHistory() {
    var el = document.getElementById('rhSessionHistory');
    if (!el) return;
    var sessions = await _rhLoadSessions();

    // Filter: hide noisy micro-sessions (< 2 min, 0 blocks, or missing data)
    var clean = sessions.filter(function(s) {
        if (!s.date) return false;
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
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:8px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px">';
        html += '<div style="font-size:0.85em;letter-spacing:2px" title="Last ' + last5.length + ' sessions (oldest \u2192 newest)">' + dots + '</div>';
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
        var d = s.date ? new Date(s.date) : null;
        var dateStr = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        var totalActual = s.totalActualMin || 0;
        var totalBudget = s.totalBudgetMin || 0;
        var blocksCompleted = s.blocksCompleted || (s.blocks ? s.blocks.length : 0);
        var totalBlocks = s.totalBlocks || blocksCompleted;

        // Duration label
        var durLabel = '';
        if (totalActual >= 60) durLabel = Math.floor(totalActual / 60) + 'h ' + (totalActual % 60) + 'm';
        else durLabel = totalActual + ' min';

        // Song list from blocks
        var songList = '';
        if (s.blocks && s.blocks.length) {
            var songNames = s.blocks.map(function(b) { return b.title; }).filter(Boolean);
            if (songNames.length > 3) songList = songNames.slice(0, 3).join(' \u00B7 ') + ' +' + (songNames.length - 3) + ' more';
            else if (songNames.length) songList = songNames.join(' \u00B7 ');
        }

        // Verdict
        var verdict = '', verdictColor = '';
        if (!totalBudget) { verdict = ''; }
        else {
            var delta = totalActual - totalBudget;
            if (Math.abs(delta) <= 3) { verdict = 'On track'; verdictColor = '#22c55e'; }
            else if (delta > 0) { verdict = '+' + delta + 'm'; verdictColor = delta > 10 ? '#ef4444' : '#fbbf24'; }
            else { verdict = delta + 'm'; verdictColor = '#60a5fa'; }
        }

        // Notes + summary
        var notesPreview = s.notes ? escHtml(s.notes).substring(0, 60) + (s.notes.length > 60 ? '\u2026' : '') : '';
        var summaryLine = s.summary || '';

        // Rating badge
        var ratingIcons = { great: '\uD83D\uDD25', solid: '\uD83D\uDCAA', needs_work: '\uD83D\uDD27' };
        var ratingColors = { great: '#22c55e', solid: '#a5b4fc', needs_work: '#fbbf24' };
        var ratingHtml = s.rating ? '<span style="font-size:0.68em;color:' + (ratingColors[s.rating] || '#94a3b8') + ';font-weight:700" title="' + (s.rating || '').replace('_', ' ') + '">' + (ratingIcons[s.rating] || '') + '</span>' : '';

        // Mixdown link
        var mixdownHtml = '';
        if (s.mixdown_id) {
            mixdownHtml = '<span style="font-size:0.65em;color:#fbbf24" title="Has mixdown">\uD83C\uDFA4</span>';
        }

        html += '<div class="app-card" style="padding:8px 12px;margin-bottom:6px' + (isLatest ? ';border-left:3px solid #a5b4fc;background:rgba(99,102,241,0.04)' : '') + '">';

        // Bulk checkbox
        if (_rhBulkMode) {
            html += '<div style="float:left;margin-right:8px;margin-top:2px">'
                + '<input type="checkbox" id="rhBulkCb_' + s.sessionId + '" onchange="_rhBulkToggle(\'' + s.sessionId + '\')"' + (_rhBulkSelected[s.sessionId] ? ' checked' : '') + ' style="accent-color:#ef4444;width:14px;height:14px;cursor:pointer">'
                + '</div>';
        }

        // Header: date + duration + verdict
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">';
        html += '<span style="font-weight:700;font-size:0.85em;color:var(--text)">' + dateStr + '</span>';
        html += '<span style="font-size:0.78em;color:var(--text-muted);font-weight:600">' + durLabel + '</span>';
        if (verdict) html += '<span style="font-size:0.72em;font-weight:700;color:' + verdictColor + '">' + verdict + '</span>';
        html += ratingHtml;
        html += mixdownHtml;
        html += '<span style="font-size:0.68em;color:var(--text-dim);margin-left:auto">' + blocksCompleted + '/' + totalBlocks + ' songs</span>';
        html += '</div>';

        // Headline insight
        var headline = _rhGetHeadline(s, _si, clean);
        if (headline) html += '<div style="font-size:0.78em;font-weight:700;color:' + headline.color + ';margin-bottom:3px">' + headline.icon + ' ' + headline.text + '</div>';

        // Summary line (auto-generated or from session)
        if (summaryLine && !headline) html += '<div style="font-size:0.72em;color:#94a3b8;margin-bottom:3px;line-height:1.4">' + escHtml(summaryLine) + '</div>';

        // Songs preview
        if (songList && !summaryLine && !headline) html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(songList) + '</div>';

        // Notes
        if (notesPreview) html += '<div style="font-size:0.72em;color:#475569;margin-bottom:3px">' + notesPreview + '</div>';

        // Actions
        html += '<div style="display:flex;gap:6px;align-items:center">';
        if (isLatest) html += '<span style="font-size:0.6em;font-weight:800;color:#a5b4fc;letter-spacing:0.05em;text-transform:uppercase">LATEST</span>';
        html += '<button onclick="var d=document.getElementById(\'rhSessDetail_' + s.sessionId + '\');if(d)d.style.display=d.style.display===\'none\'?\'block\':\'none\'" style="font-size:0.65em;font-weight:600;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Details</button>';
        if (s.mixdown_id) {
            html += '<button onclick="_rhToggleMixdownPlayer(\'' + s.sessionId + '\',\'' + escHtml(s.mixdown_id) + '\')" style="font-size:0.65em;font-weight:600;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.06);color:#fbbf24">\uD83C\uDFA4 Mixdown</button>';
            // Mixdown tag
            var mxTag = s.mixdown_tag || '';
            var mxTagLabels = { best_take: '\u2B50 Best Take', needs_work: '\uD83D\uDD27 Needs Work' };
            html += '<button onclick="_rhCycleMixdownTag(\'' + s.sessionId + '\')" style="font-size:0.6em;font-weight:600;padding:2px 6px;border-radius:4px;cursor:pointer;border:1px solid ' + (mxTag === 'best_take' ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (mxTag === 'best_take' ? 'rgba(251,191,36,0.1)' : 'none') + ';color:' + (mxTag === 'best_take' ? '#fbbf24' : mxTag === 'needs_work' ? '#f87171' : '#475569') + '">' + (mxTagLabels[mxTag] || '\uD83C\uDFF7 Tag') + '</button>';
            html += '<button onclick="if(typeof RehearsalMixdowns!==\'undefined\')RehearsalMixdowns.openInChopper(\'' + escHtml(s.mixdown_id) + '\')" style="font-size:0.65em;font-weight:600;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b">\u2702\uFE0F Chopper</button>';
        }
        html += '<button onclick="_rhDeleteSessionUI(\'' + s.sessionId + '\')" style="font-size:0.65em;font-weight:600;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(239,68,68,0.15);background:none;color:#64748b;margin-left:auto">\uD83D\uDDD1\uFE0F</button>';
        html += '</div>';

        // Expandable block detail
        if (s.blocks && s.blocks.length) {
            html += '<div style="padding:4px 0 2px 4px;display:none;margin-top:4px;border-top:1px solid rgba(255,255,255,0.04)" id="rhSessDetail_' + s.sessionId + '">';
            s.blocks.forEach(function(b) {
                if (!b.budgetMin && !b.actualMin) return;
                var over = b.budgetMin > 0 && b.actualMin > b.budgetMin;
                var pct = b.budgetMin > 0 ? Math.min(Math.round((b.actualMin / b.budgetMin) * 100), 200) : 100;
                var barColor = pct <= 100 ? '#22c55e' : '#ef4444';
                html += '<div style="display:flex;align-items:center;gap:6px;padding:1px 0;font-size:0.68em">'
                    + '<span style="min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (over ? '#fca5a5' : 'var(--text-dim)') + '">' + escHtml(b.title) + '</span>'
                    + '<div style="flex:1;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden"><div style="width:' + Math.min(pct, 100) + '%;height:100%;background:' + barColor + ';border-radius:2px"></div></div>'
                    + '<span style="color:' + (over ? '#ef4444' : 'var(--text-dim)') + ';white-space:nowrap">' + b.actualMin + 'm' + (b.budgetMin ? '/' + b.budgetMin + 'm' : '') + '</span>'
                    + '</div>';
            });
            html += '</div>';
        }

        // Inline mixdown player area (hidden until toggled)
        if (s.mixdown_id) {
            html += '<div id="rhMixdownPlayer_' + s.sessionId + '" style="display:none;margin-top:6px;padding:8px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.15);border-radius:8px"></div>';
        }

        html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
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

    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + sessionId)).update({ mixdown_tag: next || null });
            s.mixdown_tag = next;
        } catch(e) {}
    }

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

    // Load mixdown data
    try {
        var all = await loadBandDataFromDrive('_band', 'rehearsal_mixdowns') || {};
        var mx = all[mixdownId];
        if (!mx) { el.innerHTML = '<div style="font-size:0.72em;color:#64748b">Mixdown not found</div>'; return; }

        var html = '';
        if (mx.audio_url) {
            html += '<audio controls preload="metadata" style="width:100%;height:36px;margin-bottom:4px" src="' + escHtml(mx.audio_url) + '"></audio>';
        }
        if (mx.drive_url) {
            html += '<a href="' + escHtml(mx.drive_url) + '" target="_blank" rel="noopener" style="font-size:0.72em;color:#60a5fa;text-decoration:none">\uD83D\uDCC1 Open in Google Drive</a>';
        }
        if (!mx.audio_url && !mx.drive_url) {
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
    if (!snaps.length) { el.innerHTML = ''; return; }
    var html = '<details style="margin-bottom:12px"><summary style="font-size:0.7em;font-weight:700;letter-spacing:0.08em;color:var(--text-dim);text-transform:uppercase;cursor:pointer;padding:4px 0">\uD83D\uDCC2 Plan History (' + snaps.length + ')</summary>'
        + '<div style="margin-top:6px">';
    snaps.forEach(function(s) {
        var d = s.savedAt ? new Date(s.savedAt) : null;
        var dateStr = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        var timeStr = d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
        var songCount = s.songCount || (s.units ? s.units.length : 0);
        var label = s.name || 'Before editing plan';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.78em">'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(label) + '</div>'
            + '<div style="font-size:0.82em;color:var(--text-dim)">' + dateStr + ' ' + timeStr + ' \u00B7 ' + songCount + ' songs</div>'
            + '</div>'
            + '<button onclick="_rhRestoreSnapshot(\'' + s.snapshotId + '\')" style="padding:4px 10px;border-radius:5px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac;cursor:pointer;font-size:0.82em;font-weight:600;flex-shrink:0">Load</button>'
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
async function _rhLoadPlanFromFirebase() {
    if (_rhPlanCache) return _rhPlanCache;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return null;
    try {
        var snap = await db.ref(bandPath('rehearsal_plans')).once('value');
        var val = snap.val();
        if (val) {
            var plans = Object.values(val).sort(function(a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
            _rhPlanCache = plans[0] || null;
            return _rhPlanCache;
        }
    } catch(e) { console.warn('[RhPlan] Firebase load failed:', e.message); }
    return null;
}

// Save plan to Firebase (called by debounce)
async function _rhPersistToFirebase(plan) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return false;
    try {
        await db.ref(bandPath('rehearsal_plans/' + plan.planId)).set(plan);
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

// Show save state indicator
function _rhShowSaveState(state) {
    var el = document.getElementById('rhSaveState');
    if (!el) return;
    if (state === 'saving') { el.textContent = 'Saving…'; el.style.color = '#fbbf24'; }
    else if (state === 'saved') { el.textContent = '✓ Saved'; el.style.color = '#22c55e'; setTimeout(function() { if (el.textContent === '✓ Saved') el.textContent = ''; }, 2000); }
    else if (state === 'error') { el.textContent = '✕ Save failed'; el.style.color = '#f87171'; }
    else { el.textContent = ''; }
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
    var newName = prompt('Rehearsal plan name:', current);
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

async function _rhRenderTonightTab() {
    var content = document.getElementById('rhTabContent');
    if (!content) return;
    _rhRenderTonightTab_inner(content);
}

async function _rhRenderTonightTab_inner(content) {
    if (!content) return;

    var ctx = window._riLastCtx;
    var focusSongs = window._riLastFocusSongs || [];

    // Focus songs (already scoped to Active by buildRiContext — linked units included)
    var activeFocus = focusSongs;

    var html = '';

    // Focus songs / deep work recommendations
    if (activeFocus.length > 0) {
        html += '<div style="margin-bottom:14px">'
            + '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.1em;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px">Deep Work Focus</div>';
        activeFocus.slice(0, 6).forEach(function(s, i) {
            var avg = s.readiness || s.avg || 0;
            var barColor = avg >= 3.5 ? '#22c55e' : avg >= 2 ? '#f59e0b' : avg > 0 ? '#ef4444' : '#64748b';
            var reasonChips = (s.reasons || []).map(function(r) {
                var chipColor = r === 'Transition focus' ? '#818cf8' : r === 'Setlist priority' ? '#a5b4fc' : r === 'Low readiness' || r === 'Critical' ? '#f59e0b' : '#64748b';
                return '<span style="font-size:0.6em;padding:1px 5px;border-radius:3px;background:' + chipColor + '15;color:' + chipColor + ';border:1px solid ' + chipColor + '30">' + r + '</span>';
            }).join(' ');

            if (s.isLinked) {
                // Linked unit display
                html += '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);border-left:3px solid #818cf8;padding-left:8px;margin:2px 0">'
                    + '<div style="display:flex;align-items:center;gap:8px">'
                    + '<span style="font-size:0.72em;color:var(--text-dim);min-width:16px">' + (i+1) + '</span>'
                    + '<span style="font-size:0.85em;font-weight:600;color:var(--text);flex:1">' + s.title + '</span>'
                    + '<span style="font-size:0.75em;font-weight:700;color:' + barColor + '">' + (avg > 0 ? avg.toFixed(1) : '—') + '</span>'
                    + '</div>'
                    + '<div style="display:flex;gap:4px;margin-top:3px;margin-left:24px;flex-wrap:wrap">' + reasonChips + '</div>'
                    + '</div>';
            } else {
                html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
                    + '<span style="font-size:0.72em;color:var(--text-dim);min-width:16px">' + (i+1) + '</span>'
                    + '<div style="flex:1;min-width:0">'
                    + '<div style="font-size:0.85em;font-weight:600;color:var(--text)">' + s.title + '</div>'
                    + '<div style="display:flex;gap:4px;margin-top:2px;flex-wrap:wrap">' + reasonChips + '</div>'
                    + '</div>'
                    + '<span style="font-size:0.75em;font-weight:700;color:' + barColor + '">' + (avg > 0 ? avg.toFixed(1) : '—') + '</span>'
                    + '</div>';
            }
        });
        html += '</div>';
    } else {
        html += '<div style="font-size:0.82em;color:var(--text-dim);padding:12px 0">No focus areas identified — all active songs are solid.</div>';
    }

    // Readiness breakdown (collapsed)
    if (ctx) {
        html += '<details style="margin-bottom:14px"><summary style="font-size:0.68em;font-weight:800;letter-spacing:0.1em;color:var(--text-dim);text-transform:uppercase;cursor:pointer;padding:6px 0">Readiness Breakdown</summary>';
        html += renderRiReadinessBreakdown(ctx);
        html += '</details>';
    }

    content.innerHTML = html;
}

// Tab router for secondary views
async function rhShowTab(tab) {
    _rhActiveTab = tab;
    try { localStorage.setItem('glRhLastTab', tab); } catch(e) {}
    var content = document.getElementById('rhTabContent');
    if (!content) return;

    if (tab === 'sessions') {
        content.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:14px">'
            + '<button class="btn btn-primary" onclick="rhOpenCreateModal()">+ New Rehearsal</button></div>'
            + '<div id="rhEventList"><div style="color:var(--text-dim);padding:40px;text-align:center">Loading...</div></div>';
        await rhLoadEvents();
    } else if (tab === 'history') {
        content.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Session history coming soon.</div>';
        // Future: completion history
        if (typeof GLStore !== 'undefined' && GLStore.getRehearsalCompletionHistory) {
            var history = GLStore.getRehearsalCompletionHistory();
            if (history && history.length > 0) {
                content.innerHTML = '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.1em;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">Past Sessions</div>'
                    + history.slice(0, 10).map(function(h) {
                        return '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.82em;color:var(--text-dim)">'
                            + (h.completedAt ? new Date(h.completedAt).toLocaleDateString() : '—')
                            + ' · ' + (h.songsCompleted || 0) + ' songs · ' + (h.totalMinutes || 0) + ' min'
                            + '</div>';
                    }).join('');
            }
        }
    } else {
        _rhRenderTonightTab();
    }
}

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
        html += '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:16px;font-size:0.85em;color:var(--text-muted);font-style:italic">' + ev.notes + '</div>';
    }

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
        var scores = ((typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : (readinessCache || {}))[title] || {};
        var setScores = BAND_MEMBERS_ORDERED.map(function(m) { return scores[m.key]; }).filter(function(s) { return s && s > 0; });
        var avgReadiness = setScores.length ? (setScores.reduce(function(a, b) { return a + b; }, 0) / setScores.length) : 0;

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
            '<div style="font-weight:700;font-size:1em;color:var(--text);margin-bottom:16px">' + (existing ? '✏️ Edit Rehearsal' : '🎯 New Rehearsal') + '</div>' +
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
                '<button onclick="rhSaveEvent(\'' + (eventId || '') + '\')" class="btn btn-primary" style="flex:2">💾 ' + (existing ? 'Save Changes' : 'Create Rehearsal') + '</button>' +
                '<button onclick="document.getElementById(\'rhModal\')?.remove()" style="flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);border-radius:8px;padding:10px;cursor:pointer;font-size:0.9em">Cancel</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
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

    try {
        await firebaseDB.ref(bandPath('rehearsals/' + id)).update(ev);
        document.getElementById('rhModal')?.remove();
        if (eventId) {
            showToast('✅ Rehearsal updated');
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
                        calEvents.push({
                            id: 'cal_' + Date.now(),
                            type: 'rehearsal',
                            date: ev.date,
                            time: ev.time || '',
                            location: ev.location || '',
                            notes: ev.notes || '',
                            createdAt: new Date().toISOString()
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
                } else {
                    rhShowTab('tonight');
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
    if (!container) { showPage('rehearsal'); setTimeout(renderRehearsalPlanner, 200); return; }
    _rpRenderGigPicker(container);
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
                if (item.isLinked && item.songs) {
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
            var severity = s.avg < 2 ? { label: 'Critical',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   }
                         : s.avg < 3 ? { label: 'Needs work',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  }
                         : s.avg < 4 ? { label: 'Needs polish',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  }
                         :             { label: 'Final pass',     color: '#34d399', bg: 'rgba(52,211,153,0.10)'  };
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
    if (!eventId) { rhShowTab('events'); return; }
    rhShowTab('events');
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
    // Open rehearsal-mode overlay with this song
    if (typeof openRehearsalMode === 'function') {
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
    rhShowTab('intel');
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

