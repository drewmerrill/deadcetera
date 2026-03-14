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

var rhCurrentEventId = null; // which event is open in detail view

// ── Page entry point ──────────────────────────────────────────────────────────
var _rhActiveTab = 'events';

async function renderRehearsalPage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'rehearsal');
    el.innerHTML =
        '<div class="page-header"><h1>📅 Rehearsals</h1><p>Schedule band sessions, track plans, RSVP, and review recordings</p></div>' +
        '<div style="display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px">' +
            '<button id="rhTab-events" class="btn" onclick="rhShowTab(\'events\')" style="flex:1;font-size:0.85em">📅 Sessions</button>' +
            '<button id="rhTab-plans"  class="btn" onclick="rhShowTab(\'plans\')"  style="flex:1;font-size:0.85em">📋 Plans</button>' +
            '<button id="rhTab-intel"  class="btn" onclick="rhShowTab(\'intel\')"  style="flex:1;font-size:0.85em">Intel</button>' +
        '</div>' +
        '<div id="rhTabContent"><div style="color:var(--text-dim);padding:40px;text-align:center">Loading...</div></div>';
    // Restore last sub-tab if set
    setTimeout(function() {
        try {
            var saved = localStorage.getItem('glRhLastTab');
            if (saved && saved !== 'events' && typeof rhShowTab === 'function') rhShowTab(saved);
        } catch(e) {}
    }, 0);
    rhShowTab(_rhActiveTab);
}

async function rhShowTab(tab) {
    _rhActiveTab = tab;
    ['events','plans','intel'].forEach(function(t) {
        try { localStorage.setItem('glRhLastTab', t); } catch(e) {}
    var btn = document.getElementById('rhTab-' + t);
        if (!btn) return;
        var active = t === tab;
        btn.style.background = active ? 'var(--accent)' : 'rgba(255,255,255,0.04)';
        btn.style.color      = active ? 'white' : 'var(--text-muted)';
        btn.style.border     = active ? '1px solid var(--accent)' : '1px solid var(--border)';
        btn.style.fontWeight = active ? '700' : '500';
    });
    var content = document.getElementById('rhTabContent');
    if (!content) return;
    if (tab === 'events') {
        content.innerHTML =
            '<div style="display:flex;gap:8px;margin-bottom:14px">' +
            '<button class="btn btn-primary" onclick="rhOpenCreateModal()">+ New Rehearsal</button>' +
            '</div>' +
            '<div id="rhEventList"><div style="color:var(--text-dim);padding:40px;text-align:center">Loading...</div></div>';
        await rhLoadEvents();
    } else if (tab === 'intel') {
        await rhShowIntelTab(content);
    } else {
        await rhShowPlansTab(content);
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
          + '<div style="font-size:0.85em;color:var(--text-dim);margin-bottom:16px">Add a rehearsal event in the Calendar to create a plan here.</div>'
          + '<button class="btn btn-primary" onclick="showPage(\'calendar\')">📆 Go to Calendar</button>'
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
            container.innerHTML = '<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:10px 14px;font-size:0.82em;color:#86efac;margin-bottom:12px">🏆 All songs looking solid! No major weak spots.</div>';
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
                '<input type="date" id="rhDate" value="' + (existing ? existing.date : today) + '" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--text);padding:9px 11px;font-size:0.9em;font-family:inherit"></div>' +
                '<div><label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">Time</label>' +
                '<input type="text" id="rhTime" value="' + (existing ? (existing.time || '') : '7:00 PM') + '" placeholder="e.g. 7:00 PM" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--text);padding:9px 11px;font-size:0.9em;font-family:inherit"></div>' +
                '<div><label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">Location</label>' +
                '<input type="text" id="rhLocation" value="' + (existing ? (existing.location || '') : '') + '" placeholder="e.g. Brian\'s garage" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--text);padding:9px 11px;font-size:0.9em;font-family:inherit"></div>' +
                '<div><label style="font-size:0.78em;color:var(--text-muted);display:block;margin-bottom:4px">Notes / Focus</label>' +
                '<textarea id="rhNotes" rows="2" placeholder="e.g. Focus on new Phish tunes" style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--text);padding:9px 11px;font-size:0.9em;font-family:inherit;resize:vertical">' + (existing ? (existing.notes || '') : '') + '</textarea></div>' +
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
        showToast(eventId ? '✅ Rehearsal updated' : '✅ Rehearsal created');
        await rhLoadEvents();
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

    // Overall readiness pct
    var rcVals = Object.values(rc).filter(function(r) {
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

    return { rc: rc, events: events, upcoming: upcoming, past: past,
             nextEvent: nextEvent, lastEvent: lastEvent,
             planSongs: planSongs, bandPct: bandPct, grooveData: grooveData };
}

// ── Derivation: Focus Songs ───────────────────────────────────────────────────
function deriveRiFocusSongs(ctx) {
    var rc       = ctx.rc || {};
    var planSongs = ctx.planSongs || new Set();
    var candidates = [];

    var grooveLow = ctx.grooveData && ctx.grooveData.stabilityScore !== undefined
        && ctx.grooveData.stabilityScore < 60;

    Object.entries(rc).forEach(function(entry) {
        var title   = entry[0];
        var ratings = entry[1] || {};
        var keys = Object.keys(ratings).filter(function(k) {
            return typeof ratings[k] === 'number' && ratings[k] > 0;
        });
        if (!keys.length) return;
        var avg = keys.reduce(function(s, k) { return s + ratings[k]; }, 0) / keys.length;
        if (avg >= 4.5) return; // already excellent

        var reasons = [];
        if (avg < 2)      reasons.push('Critical');
        else if (avg < 3) reasons.push('Low readiness');
        else if (avg < 4) reasons.push('Needs polish');
        if (planSongs.has(title)) reasons.push('Upcoming setlist song');
        if (grooveLow && planSongs.has(title)) reasons.push('Groove drift detected');
        var vals = keys.map(function(k) { return ratings[k]; });
        if (vals.length >= 2) {
            var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
            if (mx - mn >= 2) reasons.push('Harmony instability');
        }
        var score = (5 - avg) * 10 + (planSongs.has(title) ? 15 : 0);
        if (reasons.indexOf('Harmony instability') !== -1) score += 5;
        candidates.push({ title: title, avg: avg, reasons: reasons, score: score });
    });

    candidates.sort(function(a, b) { return b.score - a.score; });
    return candidates.slice(0, 5);
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
        + _riStatPill(focusSongs.length + ' focus songs', '#667eea')
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
    if (!focusSongs || !focusSongs.length) return 'Maintain peak readiness — band is solid';
    if (pct !== null && pct < 50) return 'Critical session — rebuild weak songs before next gig';
    var topSong = focusSongs[0].title;
    if (focusSongs.length === 1) return 'Lock in ' + topSong + ' this session';
    return 'Focus on ' + topSong + ' + ' + (focusSongs.length - 1) + ' more weak songs';
}

// ── Render: Section 1 — Rehearsal Focus ──────────────────────────────────────
function renderRiRehearsalFocus(focusSongs, ctx) {
    var inner = '';
    if (!focusSongs.length) {
        inner = '<div style="color:var(--text-dim);font-style:italic;padding:10px 0">Band readiness is strong — no critical songs right now.</div>';
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
        var icon   = st === 'done' ? 'v' : st === 'current' ? '>' : '-';
        var col    = st === 'done' ? '#34d399' : st === 'current' ? '#818cf8' : 'var(--text-dim)';
        var weight = st === 'current' ? '700' : '500';
        var textCol = st === 'current' ? 'var(--text)' : 'var(--text-dim)';
        return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:' + bg + ';border:' + border + ';margin-bottom:4px">'
            + '<span style="font-size:0.82em;color:' + col + ';flex-shrink:0">' + icon + '</span>'
            + '<span style="font-size:0.85em;font-weight:' + weight + ';color:' + textCol + ';flex:1">' + title + '</span>'
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
        + '<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">'
        + '<button onclick="advanceRiSong()" style="flex:2;padding:10px;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;font-weight:800;font-size:0.85em;cursor:pointer;touch-action:manipulation">Next Song</button>'
        + '<button onclick="repeatRiSong()" style="flex:1;padding:10px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);font-size:0.82em;cursor:pointer">Repeat</button>'
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

function endRiSession() {
    _riLive.active = false;
    if (_riLive.timerTick) { clearInterval(_riLive.timerTick); _riLive.timerTick = null; }
    // Milestone 4: restore workspace mode
    if (typeof GLStore !== 'undefined' && GLStore.setAppMode) GLStore.setAppMode('workspace');
    if (typeof GLStore !== 'undefined' && GLStore.setLiveRehearsalSong) GLStore.setLiveRehearsalSong(null);
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

