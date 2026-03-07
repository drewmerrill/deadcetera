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
async function renderRehearsalPage(el) {
    el.innerHTML =
        '<div class="page-header"><h1>🎯 Rehearsals</h1><p>Plan sessions, RSVP, and get smart song suggestions</p></div>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px">' +
            '<button class="btn btn-primary" onclick="rhOpenCreateModal()">+ New Rehearsal</button>' +
        '</div>' +
        '<div id="rhEventList"><div style="color:var(--text-dim);padding:40px;text-align:center">Loading...</div></div>';
    await rhLoadEvents();
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
    html += '</div></div>';
    html += '</div>';

    // ── Suggestion results area (hidden until generated) ──
    html += '<div id="rhSuggestionArea"></div>';

    container.innerHTML = html;
    // Init timer and scoreboard
    if (planSongs.length) rhTimerInit(planSongs);
    rhRenderScoreboard(eventId);
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
        container.innerHTML = '<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:10px 14px;font-size:0.82em;color:#86efac;margin-bottom:12px">🏆 All sections looking solid! No major weak spots.</div>';
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
    var planListEl = document.getElementById('rhPlanList');
    var notesEl = document.getElementById('rhPlanNotes');
    var ev = (await rhGetAllEvents()).find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var plan = ev.plan || { songs: [], focusSections: {}, notes: '' };
    plan.notes = notesEl ? notesEl.value : (plan.notes || '');
    await rhSavePlanData(eventId, plan);
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
        showToast('📋 ' + songs.length + ' songs sent to Practice Plan');
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
    if (typeof statusCache !== 'undefined') statusData = statusCache;

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
        var scores = readinessCache[title] || {};
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
                    var sc = (readinessCache[s.title] || {})[m.key] || 0;
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
