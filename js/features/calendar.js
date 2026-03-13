// ============================================================================
// js/features/calendar.js
// Band calendar: month grid, events, rehearsal/gig links.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js
// EXPOSES globals: renderCalendarPage, renderCalendarInner, calNavMonth,
//   loadCalendarEvents, loadCalendarEventsRaw, calShowEvent,
//   calEditEvent, calDeleteEvent, calAddEvent, calSaveEvent
// ============================================================================

'use strict';

// Also update the calendar event DETAIL view for rehearsals to show a "📋 Practice Plan" link
async function calShowEvent(idx) {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const ev = events[idx];
    if (!ev) return;
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    const typeIcon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[ev.type||'other']||'📌';
    const isRehearsal = ev.type === 'rehearsal';
    area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h3 style="margin:0;font-size:1em">${typeIcon} ${ev.title||'Untitled'}</h3>
        <button onclick="document.getElementById('calEventFormArea').innerHTML=''" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1em">✕</button>
    </div>
    <div style="font-size:0.85em;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <span>📅 ${ev.date||''}</span>
        ${ev.time ? `<span>⏰ ${ev.time}</span>` : ''}
        <span style="text-transform:capitalize">📂 ${ev.type||'other'}</span>
    </div>
    ${ev.notes ? `<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;font-size:0.85em;color:var(--text-muted);margin-bottom:12px">${ev.notes}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${isRehearsal ? `<button onclick="practicePlanActiveDate='${ev.date}';showPage('rehearsal')" class="btn btn-primary btn-sm">📅 Rehearsal Plan</button>` : ''}
        <button onclick="calEditEvent(${idx})" class="btn btn-ghost btn-sm">✏️ Edit</button>
        <button onclick="calDeleteEvent(${idx})" class="btn btn-danger btn-sm">✕ Delete</button>
        <button onclick="document.getElementById('calEventFormArea').innerHTML=''" class="btn btn-ghost btn-sm">Close</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">
        ${typeof calExportButtonsHTML === 'function' ? calExportButtonsHTML(ev, '_calExp_' + idx) : ''}
    </div>`;
    area.scrollIntoView({behavior:'smooth', block:'nearest'});
}

// ============================================================================
// CALENDAR
// ============================================================================
// Calendar state - persists during session
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

function renderCalendarPage(el) {
    el.innerHTML = `<div class="page-header"><h1>📆 Calendar</h1><p>Band schedule and availability</p></div><div id="calendarInner"></div>`;
    renderCalendarInner();
}

function renderCalendarInner() {
    // Mobile: pull grid card edge-to-edge to fit 7 columns
    if (window.innerWidth <= 640) {
        var style = document.getElementById('_calGridStyle');
        if (!style) {
            style = document.createElement('style');
            style.id = '_calGridStyle';
            style.textContent = '#calendarInner .app-card:first-child{margin:0 -16px!important;border-radius:0!important;border-left:none!important;border-right:none!important;padding:12px 0!important;width:calc(100vw)!important;box-sizing:border-box!important;} #calGrid{padding:0 2px!important;}';
            document.head.appendChild(style);
        }
    }
    const el = document.getElementById('calendarInner');
    if (!el) return;
    const year = calViewYear, month = calViewMonth;
    const mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}-`;

    // Render shell immediately, then load events async and paint dots
    el.innerHTML = `
    <div class="app-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <button class="btn btn-ghost btn-sm" onclick="calNavMonth(-1)">← Prev</button>
            <h3 style="margin:0;font-size:1.05em;font-weight:700">${mNames[month]} ${year}</h3>
            <button class="btn btn-ghost btn-sm" onclick="calNavMonth(1)">Next →</button>
        </div>
        <div id="calGrid"></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="calAddEvent()">+ Add Event</button>
        <button class="btn btn-ghost" onclick="calBlockDates()" style="color:var(--red)">🚫 Block Dates</button>
        <button class="btn btn-ghost" onclick="calShowSubscribeModal(window.currentBandSlug||'deadcetera')" style="color:var(--accent-light)" title="Subscribe to band calendar in Google/Apple Calendar">📅 Subscribe</button>
    </div>
    <div class="app-card" id="calEventFormArea"></div>
    <div class="app-card"><h3>📌 Upcoming Events</h3>
        <div id="calendarEvents"><div style="text-align:center;padding:20px;color:var(--text-dim)">Loading…</div></div>
    </div>
    <div class="app-card"><h3>🚫 Blocked Dates</h3>
        <div id="blockedDates" style="font-size:0.85em;color:var(--text-muted)"><div style="text-align:center;padding:12px;color:var(--text-dim)">No blocked dates.</div></div>
    </div>`;

    // Load events, then build calendar grid with dots and blocked ranges
    loadCalendarEvents().then(result => {
        const eventDates = result ? result.dateMap : {};
        const blockedRanges = result ? (result.blockedRanges || []) : [];
        const grid = document.getElementById('calGrid');
        if (!grid) return;
        let g = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">';
        dNames.forEach((d,i) => {
            const w = i===0||i===6;
            g += `<div style="font-size:0.6em;font-weight:700;text-transform:uppercase;color:${w?'var(--accent-light)':'var(--text-dim)'};text-align:center;padding:6px 0">${d}</div>`;
        });
        for (let i=0;i<firstDay;i++) g += '<div style="min-height:60px;padding:4px;"></div>';
        for (let d=1;d<=daysInMonth;d++) {
            const ds = `${monthPrefix}${String(d).padStart(2,'0')}`;
            const isToday = ds===todayStr;
            const dow = new Date(year,month,d).getDay();
            const w = dow===0||dow===6;
            const dayEvents = eventDates ? (eventDates[ds] || []) : [];
            const hasEvent = dayEvents.length > 0;
            // For each event show icon + truncated name
            const eventPills = hasEvent
                ? dayEvents.slice(0,2).map((ev,ei) => {
                    const icon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[ev.type||'other']||'📌';
                    const name = (ev.title||'').substring(0,10) + ((ev.title||'').length > 10 ? '…' : '');
                    const evIdx = ev._idx !== undefined ? ev._idx : ei;
                    return `<div onclick="event.stopPropagation();calShowEvent(${evIdx})" style="display:flex;align-items:center;gap:2px;background:rgba(102,126,234,0.25);border-radius:3px;padding:1px 4px;margin-top:1px;cursor:pointer;overflow:hidden;width:100%" title="${ev.title||''}">
                        <span style="font-size:0.75em;flex-shrink:0">${icon}</span>
                        <span style="font-size:0.6em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:white">${name}</span>
                    </div>`;
                }).join('')
                : '';
            const moreCount = dayEvents.length > 2 ? `<div style="font-size:0.55em;color:var(--accent-light);text-align:center">+${dayEvents.length-2} more</div>` : '';
            // Blocked date bars
            const blockBars = blockedRanges
                .filter(b => b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate)
                .map((b,bi) => {
                    const bIdx = blockedRanges.indexOf(b);
                    return `<div ondblclick="event.stopPropagation();calEditBlocked(${bIdx})" onclick="event.stopPropagation()" style="background:rgba(239,68,68,0.7);border-radius:3px;padding:1px 4px;margin-top:1px;overflow:hidden;cursor:pointer" title="🖱️ Dbl-click to edit | ${b.person||''}: ${b.reason||''}">
                    <span style="font-size:0.55em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;color:white">🚫 ${(b.person||'').split(' ')[0]}</span>
                </div>`;
                }).join('');
            const isBlocked = blockedRanges.some(b => b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate);
            g += `<div style="min-height:60px;display:flex;flex-direction:column;align-items:stretch;padding:3px 2px;background:${isBlocked?'rgba(239,68,68,0.06)':hasEvent?'rgba(102,126,234,0.08)':w?'rgba(102,126,234,0.04)':'rgba(255,255,255,0.02)'};border-radius:6px;font-size:0.75em;cursor:pointer;${isToday?'border:2px solid var(--accent);':isBlocked?'border:1px solid rgba(239,68,68,0.3);':hasEvent?'border:1px solid rgba(102,126,234,0.25);':''}" onclick="calDayClick(${year},${month},${d})">
                <span style="text-align:center;${isToday?'color:var(--accent);font-weight:700;':hasEvent?'color:white;font-weight:600;':w?'color:var(--accent-light);':'color:var(--text-muted);'}">${d}</span>
                ${eventPills}
                ${moreCount}
                ${blockBars}
            </div>`;
        }
        g += '</div>';
        grid.innerHTML = g;
    });
}

function calNavMonth(dir) {
    calViewMonth += dir;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
    renderCalendarInner();
}


async function loadCalendarEvents() {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    // Build date map for grid dots (all events, not just upcoming)
    const dateMap = {};
    events.forEach((e, idx) => {
        if (e.date) {
            if (!dateMap[e.date]) dateMap[e.date] = [];
            dateMap[e.date].push({...e, _idx: idx});
        }
    });

    const el = document.getElementById('calendarEvents');
    if (!el) return dateMap;
    const today = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    if (upcoming.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">No upcoming events. Click a date or + Add Event.</div>';
    } else {
        el.innerHTML = upcoming.map((e,i) => {
            // Stamp event onto window now (at render time) so onclick can safely reference it
            // Cannot reference `upcoming` inside onclick — it's out of scope once innerHTML is set
            var wk = '_calEv_' + i; window[wk] = e;
            const typeIcon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[e.type]||'📌';
            const isRehearsal = e.type === 'rehearsal';
            return `<div class="list-item" style="padding:10px 12px;gap:10px">
                <span style="font-size:0.8em;color:var(--text-dim);min-width:85px">${e.date||''}</span>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${typeIcon} ${e.title||'Untitled'}</div>
                    ${e.venue?`<div style="font-size:0.75em;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${e.venue}</div>`:''}
                    ${e.linkedSetlist?`<div style="font-size:0.72em;color:var(--accent-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📋 ${e.linkedSetlist}</div>`:''}
                </div>
                ${e.time?`<span style="font-size:0.75em;color:var(--text-muted);flex-shrink:0">${e.time}</span>`:''}
                <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:nowrap;align-items:center">
                    ${isRehearsal ? `<button onclick="practicePlanActiveDate='${e.date}';showPage('rehearsal')" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;">📋</button>` : ''}
                    <button onclick="var u=calExportGoogleLink(window['_calEv_${i}']);if(u!=='#')window.open(u,'_blank')" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;" title="Add to Google Calendar">📅</button>
                    <button onclick="calExportICS(window['_calEv_${i}'])" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;" title="Download .ics">⬇️</button>
                    <button onclick="calEditEvent(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;">✏️</button>
                    <button onclick="calDeleteEvent(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;">✕</button>
                </div>
            </div>`;
        }).join('');
    }
    // Blocked dates
    const blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    const bEl = document.getElementById('blockedDates');
    if (bEl && blocked.length > 0) {
        bEl.innerHTML = blocked.map((b,i) => `<div class="list-item" style="padding:6px 12px;font-size:0.85em">
            <span style="color:var(--red)">${b.startDate} → ${b.endDate}</span>
            <span style="flex:1;color:var(--text-muted);margin-left:8px">${b.person||''}: ${b.reason||''}</span>
            <button onclick="calEditBlocked(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;flex-shrink:0;margin-right:4px;">✏️</button>
            <button onclick="calDeleteBlocked(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0;">✕</button>
        </div>`).join('');
    }
    return { dateMap, blockedRanges: blocked };
}

function calBlockDates() {
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    area.innerHTML = `<h3 style="font-size:0.9em;color:var(--red);margin-bottom:12px">🚫 Block Dates — I'm Unavailable</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Start Date</label><input class="app-input" id="blockStart" type="date"></div>
        <div class="form-row"><label class="form-label">End Date</label><input class="app-input" id="blockEnd" type="date"></div>
        <div class="form-row"><label class="form-label">Who</label><select class="app-select" id="blockPerson">${Object.entries(bandMembers).map(([k,m])=>'<option value="'+m.name+'">'+m.name+'</option>').join('')}</select></div>
        <div class="form-row"><label class="form-label">Reason</label><input class="app-input" id="blockReason" placeholder="e.g. Family vacation"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-danger" onclick="saveBlockedDates()">🚫 Block Dates</button>
        <button class="btn btn-ghost" onclick="document.getElementById('calEventFormArea').innerHTML=''">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function saveBlockedDates() {
    const b = { startDate: document.getElementById('blockStart')?.value, endDate: document.getElementById('blockEnd')?.value,
        person: document.getElementById('blockPerson')?.value, reason: document.getElementById('blockReason')?.value };
    if (!b.startDate || !b.endDate) { alert('Both dates required'); return; }
    const ex = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    ex.push(b);
    await saveBandDataToDrive('_band', 'blocked_dates', ex);
    document.getElementById('calEventFormArea').innerHTML = '';
    loadCalendarEvents();
}

async function calDeleteBlocked(idx) {
    if (!confirm('Remove this blocked date range?')) return;
    let blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    blocked.splice(idx, 1);
    await saveBandDataToDrive('_band', 'blocked_dates', blocked);
    loadCalendarEvents();
}

async function calEditBlocked(idx) {
    const blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    const b = blocked[idx];
    if (!b) return;
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    area.innerHTML = `<h3 style="font-size:0.9em;color:var(--red);margin-bottom:12px">✏️ Edit Blocked Dates</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Start Date</label><input class="app-input" id="blockStart" type="date" value="${b.startDate||''}"></div>
        <div class="form-row"><label class="form-label">End Date</label><input class="app-input" id="blockEnd" type="date" value="${b.endDate||''}"></div>
        <div class="form-row"><label class="form-label">Who</label><select class="app-select" id="blockPerson">${Object.entries(bandMembers).map(([k,m])=>`<option value="${m.name}" ${m.name===b.person?'selected':''}>${m.name}</option>`).join('')}</select></div>
        <div class="form-row"><label class="form-label">Reason</label><input class="app-input" id="blockReason" placeholder="e.g. Family vacation" value="${b.reason||''}"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-danger" onclick="saveBlockedDatesEdit(${idx})">💾 Update</button>
        <button class="btn btn-ghost" onclick="document.getElementById('calEventFormArea').innerHTML=''">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth', block:'nearest'});
}

async function saveBlockedDatesEdit(idx) {
    const b = { startDate: document.getElementById('blockStart')?.value, endDate: document.getElementById('blockEnd')?.value,
        person: document.getElementById('blockPerson')?.value, reason: document.getElementById('blockReason')?.value };
    if (!b.startDate || !b.endDate) { alert('Both dates required'); return; }
    let blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    blocked[idx] = b;
    await saveBandDataToDrive('_band', 'blocked_dates', blocked);
    document.getElementById('calEventFormArea').innerHTML = '';
    renderCalendarInner();
}

function calDayClick(y, m, d) {
    calViewYear = y; calViewMonth = m;
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    calAddEvent(ds);
}

async function calAddEvent(date, editIdx, existing) {
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    const isEdit = editIdx !== undefined;
    const ev = existing || {};
    // Load setlists + venues for gig-type dropdowns
    const setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    setlists.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const setlistOpts = setlists.map(sl =>
        `<option value="${(sl.name||'').replace(/"/g,'&quot;')}" ${(ev.linkedSetlist||'')===(sl.name||'')?'selected':''}>${sl.name||'Untitled'}${sl.date?' ('+sl.date+')':''}</option>`
    ).join('');
    const venues = toArray(await loadBandDataFromDrive('_band', 'venues') || []);
    venues.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    const venueOptsCal = venues.map(v =>
        `<option value="${(v.name||'').replace(/"/g,'&quot;')}" ${(ev.venue||'')===(v.name||'')?'selected':''}>${venueShortLabel(v)}</option>`
    ).join('');
    const showSetlist = ev.type === 'gig';
    const showVenue   = ev.type === 'gig';
    area.innerHTML = `<h3 style="margin-bottom:12px;font-size:0.95em">${isEdit?'\u270f\ufe0f Edit Event':'\u2795 Add Event'}</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="calDate" type="date" value="${date||ev.date||''}"></div>
        <div class="form-row"><label class="form-label">Type</label><select class="app-select" id="calType" onchange="calTypeChanged(this)">
            <option value="rehearsal" ${(ev.type||'rehearsal')==='rehearsal'?'selected':''}>&#127928; Rehearsal</option>
            <option value="gig" ${ev.type==='gig'?'selected':''}>&#127908; Gig</option>
            <option value="meeting" ${ev.type==='meeting'?'selected':''}>&#128101; Meeting</option>
            <option value="other" ${ev.type==='other'?'selected':''}>&#128204; Other</option>
        </select></div>
        <div class="form-row calGigOnly" id="calVenueRow" style="${showVenue?'':'display:none'}">
            <label class="form-label">🏛️ Venue</label>
            <select class="app-select" id="calVenue" onchange="calVenueSelected(this)" style="margin-bottom:6px">
                <option value="">-- Select a venue --</option>
                ${venueOptsCal}
                <option value="__other__">➕ Other / New venue…</option>
            </select>
            <input class="app-input" id="calVenueCustom" placeholder="Or type venue name" value="${ev.venueCustom||''}" style="${(ev.venue&&!venues.find(v=>v.name===ev.venue))||ev.venueCustom?'':'display:none'}">
        </div>
        <div class="form-row"><label class="form-label">Title</label><input class="app-input" id="calTitle" placeholder="e.g. Practice at Drew's" value="${ev.title||''}"></div>
        <div class="form-row"><label class="form-label">Time</label><input class="app-input" id="calTime" type="time" value="${ev.time||''}"></div>
        <div class="form-row calGigOnly" id="calSetlistRow" style="${showSetlist?'':'display:none'}">
            <label class="form-label">\uD83D\uDCCB Linked Setlist</label>
            <select class="app-select" id="calLinkedSetlist">
                <option value="">-- None --</option>
                ${setlistOpts}
            </select>
        </div>
    </div>
    <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="calNotes" placeholder="Optional notes" style="height:60px">${ev.notes||''}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-success" onclick="calSaveEvent(${isEdit?editIdx:'undefined'})">${isEdit?'\uD83D\uDCBE Update':'\uD83D\uDCBE Save Event'}</button>
        <button class="btn btn-ghost" onclick="document.getElementById('calEventFormArea').innerHTML=''">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function calTypeChanged(sel) {
    var slRow = document.getElementById('calSetlistRow');
    var vRow  = document.getElementById('calVenueRow');
    var isGig = sel.value === 'gig';
    if (slRow) slRow.style.display = isGig ? '' : 'none';
    if (vRow)  vRow.style.display  = isGig ? '' : 'none';
}

function calVenueSelected(sel) {
    var custom = document.getElementById('calVenueCustom');
    if (!custom) return;
    if (sel.value === '__other__') {
        custom.style.display = '';
        custom.focus();
        sel.value = '';
    } else {
        custom.style.display = 'none';
    }
}


async function calEditEvent(idx) {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const today = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    if (upcoming[idx]) calAddEvent(upcoming[idx].date, idx, upcoming[idx]);
}

async function calDeleteEvent(idx) {
    if (!confirm('Delete this event?')) return;
    let events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const today = new Date().toISOString().split('T')[0];
    const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const evToDelete = upcoming[idx];
    if (!evToDelete) return;
    events = events.filter(e => e !== evToDelete && !(e.date===evToDelete.date && e.title===evToDelete.title && e.created===evToDelete.created));
    await saveBandDataToDrive('_band', 'calendar_events', events);
    loadCalendarEvents();
}

async function calSaveEvent(editIdx) {
    const ev = {
        date: document.getElementById('calDate')?.value,
        type: document.getElementById('calType')?.value,
        title: document.getElementById('calTitle')?.value,
        time: document.getElementById('calTime')?.value,
        notes: document.getElementById('calNotes')?.value,
        linkedSetlist: document.getElementById('calLinkedSetlist')?.value || null,
        venue: (document.getElementById('calVenue')?.value && document.getElementById('calVenue')?.value !== '__other__')
            ? document.getElementById('calVenue')?.value
            : (document.getElementById('calVenueCustom')?.value || null),
    };
    if (!ev.date || !ev.title) { alert('Date and title required'); return; }
    if (ev.type === 'gig' && !ev.venue) { alert('Gig events require a venue'); return; }
    let events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    if (editIdx !== undefined) {
        // Find event by position in upcoming sorted list
        const today = new Date().toISOString().split('T')[0];
        const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
        const old = upcoming[editIdx];
        if (old) {
            const i = events.findIndex(e => e.date===old.date && e.title===old.title);
            if (i >= 0) {
                // Preserve existing id (never overwrite a stable id)
                const existingId = events[i].id;
                events[i] = { ...events[i], ...ev };
                if (existingId) events[i].id = existingId;
                events[i].updated_at = new Date().toISOString();
            }
        }
    } else {
        ev.created = new Date().toISOString();
        ev.updated_at = ev.created;
        // Stamp a stable id at creation — this is the most important moment
        ev.id = (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36);
        events.push(ev);
    }
    await saveBandDataToDrive('_band', 'calendar_events', events);
    // If this is a gig event, also sync to the Gigs page
    if (ev.type === 'gig') {
        const existingGigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        const gigKey = (ev.venue||'') + '|' + (ev.date||'');
        const existingIdx = existingGigs.findIndex(g => ((g.venue||'')+'|'+(g.date||'')) === gigKey);
        const gigRecord = {
            venue: ev.venue || ev.title || '',
            date: ev.date || '',
            startTime: ev.time || '',
            notes: ev.notes || '',
            linkedSetlist: ev.linkedSetlist || '',
            updated: new Date().toISOString()
        };
        if (existingIdx >= 0) {
            existingGigs[existingIdx] = { ...existingGigs[existingIdx], ...gigRecord };
        } else {
            gigRecord.created = new Date().toISOString();
            existingGigs.push(gigRecord);
        }
        await saveBandDataToDrive('_band', 'gigs', existingGigs);
    }
    document.getElementById('calEventFormArea').innerHTML = '';
    loadCalendarEvents();
}


// ============================================================================
// SOCIAL MEDIA COMMAND CENTER
// ============================================================================
// ============================================================================
// NOTIFICATIONS — Web Push (FCM) + SMS deep-link + subscription preferences
// ============================================================================

// Notification event types band members can subscribe to
const NOTIF_EVENTS = {
    practice_plan:    { label: 'Practice Plan Published',    icon: '📋', desc: 'When a practice plan is finalized and shared' },
    gig_added:        { label: 'New Gig Added',              icon: '🎤', desc: 'When a gig is added to the calendar' },
    rehearsal_added:  { label: 'Rehearsal Scheduled',        icon: '🎸', desc: 'When a rehearsal is added to the calendar' },
    song_status:      { label: 'Song Status Changed',        icon: '🎵', desc: 'When a song moves to Gig Ready or This Week' },
    new_harmony:      { label: 'New Harmony Added',          icon: '🎶', desc: 'When a harmony recording is uploaded' },
    setlist_created:  { label: 'Setlist Created/Updated',    icon: '📝', desc: 'When a setlist is created or changed' },
    blocked_dates:    { label: 'Blocked Dates Updated',      icon: '🚫', desc: 'When someone updates their availability' },
    announcements:    { label: 'Band Announcements',         icon: '📢', desc: 'General announcements (always recommended)' },
};

// ── Window exports (called from inline HTML onclick handlers) ──────────────
window.calShowEvent = calShowEvent;
window.renderCalendarPage = renderCalendarPage;
window.renderCalendarInner = renderCalendarInner;
window.calNavMonth = calNavMonth;
window.loadCalendarEvents = loadCalendarEvents;
window.calBlockDates = calBlockDates;
window.saveBlockedDates = saveBlockedDates;
window.calDeleteBlocked = calDeleteBlocked;
window.calEditBlocked = calEditBlocked;
window.saveBlockedDatesEdit = saveBlockedDatesEdit;
window.calDayClick = calDayClick;
window.calAddEvent = calAddEvent;
window.calTypeChanged = calTypeChanged;
window.calVenueSelected = calVenueSelected;
window.calEditEvent = calEditEvent;
window.calDeleteEvent = calDeleteEvent;
window.calSaveEvent = calSaveEvent;
window.calShowSubscribeModal = typeof calShowSubscribeModal !== 'undefined' ? calShowSubscribeModal : function() { alert('Calendar export module not loaded.'); };
