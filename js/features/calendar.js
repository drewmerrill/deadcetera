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
async function calShowEvent(idx, occDate) {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const ev = events[idx];
    if (!ev) return;
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    const typeIcon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[ev.type||'other']||'📌';
    const isRehearsal = ev.type === 'rehearsal';
    const displayDate = occDate || ev.date || '';
    const repeatLbl = _calRepeatLabel(ev.repeatRule);
    const isRecurring = ev.repeatRule && ev.repeatRule.frequency;
    area.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h3 style="margin:0;font-size:1em">${typeIcon} ${ev.title||'Untitled'}</h3>
        <button onclick="document.getElementById('calEventFormArea').innerHTML=''" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1em">✕</button>
    </div>
    <div style="font-size:0.85em;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <span>📅 ${displayDate}</span>
        ${ev.time ? `<span>⏰ ${ev.time}</span>` : ''}
        <span style="text-transform:capitalize">📂 ${ev.type||'other'}</span>
        ${repeatLbl ? `<span style="color:var(--accent-light)">🔄 ${repeatLbl}</span>` : ''}
    </div>
    ${ev.notes ? `<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;font-size:0.85em;color:var(--text-muted);margin-bottom:12px">${ev.notes}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${isRehearsal ? `<button onclick="practicePlanActiveDate='${displayDate}';showPage('rehearsal')" class="btn btn-primary btn-sm">📅 Rehearsal Plan</button>` : ''}
        <button onclick="calEditEventById('${ev.id||''}')" class="btn btn-ghost btn-sm">${isRecurring ? '✏️ Edit Series' : '✏️ Edit'}</button>
        <button onclick="calDeleteEventById('${ev.id||''}')" class="btn btn-danger btn-sm">${isRecurring ? '✕ Delete Series' : '✕ Delete'}</button>
        <button onclick="document.getElementById('calEventFormArea').innerHTML=''" class="btn btn-ghost btn-sm">Close</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">
        ${typeof calExportButtonsHTML === 'function' ? calExportButtonsHTML(Object.assign({}, ev, {date: displayDate}), '_calExp_' + idx) : ''}
    </div>`;
    area.scrollIntoView({behavior:'smooth', block:'nearest'});
}

// ============================================================================
// CALENDAR
// ============================================================================
// Calendar state - persists during session
let calViewYear = new Date().getFullYear();
let calViewMonth = new Date().getMonth();

// ── Recurrence helpers ──────────────────────────────────────────────────────

function _calRepeatRuleToValue(rule) {
    if (!rule || !rule.frequency) return 'none';
    if (rule.frequency === 'weekly' && (rule.interval || 1) === 1) return 'weekly';
    if (rule.frequency === 'weekly' && rule.interval === 2) return 'biweekly';
    if (rule.frequency === 'monthly') return 'monthly';
    return 'none';
}

function _calRepeatLabel(rule) {
    if (!rule || !rule.frequency) return '';
    if (rule.frequency === 'weekly' && (rule.interval || 1) === 1) return 'Repeats weekly';
    if (rule.frequency === 'weekly' && rule.interval === 2) return 'Repeats every 2 weeks';
    if (rule.frequency === 'monthly') return 'Repeats monthly';
    return '';
}

function expandRecurringEvents(rawEvents, rangeStart, rangeEnd) {
    var result = [];
    rawEvents.forEach(function(ev, idx) {
        if (!ev.repeatRule || !ev.repeatRule.frequency) {
            // Non-recurring: pass through with base index
            if (ev.date) result.push(Object.assign({}, ev, { _baseIdx: idx, _baseEventId: ev.id || null }));
            return;
        }
        // Recurring: generate occurrences within range
        var dates = _generateOccurrenceDates(
            ev.date, ev.repeatRule.frequency, ev.repeatRule.interval || 1,
            rangeStart, rangeEnd, ev.repeatRule.endsAt
        );
        dates.forEach(function(occDate) {
            result.push(Object.assign({}, ev, {
                date: occDate,
                _isOccurrence: occDate !== ev.date,
                _baseIdx: idx,
                _baseEventId: ev.id || null,
                _occurrenceDate: occDate
            }));
        });
    });
    return result;
}

function _generateOccurrenceDates(baseDate, frequency, interval, rangeStart, rangeEnd, endsAt) {
    if (!baseDate) return [];
    var dates = [];
    var effectiveEnd = (endsAt && endsAt < rangeEnd) ? endsAt : rangeEnd;

    if (frequency === 'weekly') {
        var base = new Date(baseDate + 'T12:00:00');
        var start = new Date(rangeStart + 'T12:00:00');
        var end = new Date(effectiveEnd + 'T12:00:00');
        var stepMs = interval * 7 * 86400000;
        // Jump to first occurrence at or after rangeStart
        var diffMs = start.getTime() - base.getTime();
        var stepsToSkip = diffMs > 0 ? Math.floor(diffMs / stepMs) : 0;
        var current = new Date(base.getTime() + stepsToSkip * stepMs);
        for (var i = 0; i < 200 && current <= end; i++) {
            var ds = current.toISOString().split('T')[0];
            if (ds >= rangeStart && ds <= effectiveEnd) dates.push(ds);
            current = new Date(current.getTime() + stepMs);
        }
    } else if (frequency === 'monthly') {
        var parts = baseDate.split('-');
        var baseY = parseInt(parts[0], 10);
        var baseM = parseInt(parts[1], 10) - 1;
        var baseD = parseInt(parts[2], 10);
        for (var step = 0; step < 120; step++) {
            var totalM = baseM + step * interval;
            var y = baseY + Math.floor(totalM / 12);
            var m = totalM % 12;
            var daysInMonth = new Date(y, m + 1, 0).getDate();
            var d = Math.min(baseD, daysInMonth);
            var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
            if (ds > effectiveEnd) break;
            if (ds >= rangeStart) dates.push(ds);
        }
    }
    return dates;
}

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
        <button class="btn btn-ghost" onclick="calBlockDates()" style="color:var(--red)">🚫 Add Conflict</button>
        <button class="btn btn-ghost" onclick="calShowSubscribeModal(window.currentBandSlug||'deadcetera')" style="color:var(--accent-light)" title="Subscribe to band calendar in Google/Apple Calendar">📅 Subscribe</button>
    </div>
    <div class="app-card" id="calEventFormArea"></div>
    <div class="app-card"><h3>📌 Upcoming Events</h3>
        <div id="calendarEvents"><div style="text-align:center;padding:20px;color:var(--text-dim)">Loading…</div></div>
    </div>
    <div class="app-card"><h3>📊 Availability Matrix</h3>
        <div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">See when the band is free to rehearse. Click a day to schedule.</div>
        <div id="calAvailabilityMatrix" style="font-size:0.82em"><div style="text-align:center;padding:12px;color:var(--text-dim)">Loading…</div></div>
    </div>
    <div class="app-card"><h3>🚫 Conflicts &amp; Blocked Dates</h3>
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
                    return `<div onclick="event.stopPropagation();calShowEvent(${evIdx},'${ev.date||''}')" style="display:flex;align-items:center;gap:2px;background:rgba(102,126,234,0.25);border-radius:3px;padding:1px 4px;margin-top:1px;cursor:pointer;overflow:hidden;width:100%" title="${ev.title||''}">
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
        // Render availability matrix from blocked ranges
        _calCachedBlockedRanges = result ? (result.blockedRanges || []) : [];
        _calRenderAvailabilityMatrix(_calCachedBlockedRanges);
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

    // Expand recurring events for the viewed month (grid dots)
    var daysInViewMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    var monthStart = calViewYear + '-' + String(calViewMonth + 1).padStart(2, '0') + '-01';
    var monthEnd = calViewYear + '-' + String(calViewMonth + 1).padStart(2, '0') + '-' + String(daysInViewMonth).padStart(2, '0');
    var expandedGrid = expandRecurringEvents(events, monthStart, monthEnd);

    const dateMap = {};
    expandedGrid.forEach(function(e) {
        if (e.date) {
            if (!dateMap[e.date]) dateMap[e.date] = [];
            dateMap[e.date].push(Object.assign({}, e, { _idx: e._baseIdx }));
        }
    });

    const el = document.getElementById('calendarEvents');
    if (!el) return { dateMap, blockedRanges: [] };
    const today = new Date().toISOString().split('T')[0];
    var futureEnd = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
    var expandedUpcoming = expandRecurringEvents(events, today, futureEnd);
    const upcoming = expandedUpcoming.filter(function(e) { return (e.date || '') >= today; })
        .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    if (upcoming.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">No upcoming events. Click a date or + Add Event.</div>';
    } else {
        el.innerHTML = upcoming.map((e,i) => {
            // Stamp event onto window now (at render time) so onclick can safely reference it
            // Cannot reference `upcoming` inside onclick — it's out of scope once innerHTML is set
            var wk = '_calEv_' + i; window[wk] = e;
            const typeIcon = {rehearsal:'🎸',gig:'🎤',meeting:'👥',other:'📌'}[e.type]||'📌';
            const isRehearsal = e.type === 'rehearsal';
            var repeatLbl = _calRepeatLabel(e.repeatRule);
            var evtId = e._baseEventId || e.id || '';
            return `<div class="list-item" style="padding:10px 12px;gap:10px">
                <span style="font-size:0.8em;color:var(--text-dim);min-width:85px">${e.date||''}</span>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${typeIcon} ${e.title||'Untitled'}</div>
                    ${e.venue?`<div style="font-size:0.75em;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${e.venue}</div>`:''}
                    ${e.linkedSetlist?`<div style="font-size:0.72em;color:var(--accent-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📋 ${e.linkedSetlist}</div>`:''}
                    ${repeatLbl?`<div style="font-size:0.68em;color:var(--accent-light);margin-top:1px">🔄 ${repeatLbl}</div>`:''}
                </div>
                ${e.time?`<span style="font-size:0.75em;color:var(--text-muted);flex-shrink:0">${e.time}</span>`:''}
                <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:nowrap;align-items:center">
                    ${isRehearsal ? `<button onclick="practicePlanActiveDate='${e.date}';showPage('rehearsal')" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;">📋</button>` : ''}
                    <button onclick="var u=calExportGoogleLink(window['_calEv_${i}']);if(u!=='#')window.open(u,'_blank')" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;" title="Add to Google Calendar">📅</button>
                    <button onclick="calExportICS(window['_calEv_${i}'])" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;" title="Download .ics">⬇️</button>
                    <button onclick="calEditEventById('${evtId}')" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;">✏️</button>
                    <button onclick="calDeleteEventById('${evtId}')" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:700;">✕</button>
                </div>
            </div>`;
        }).join('');
    }
    // Schedule blocks (unified: new model + legacy blocked_dates)
    var blocked = [];
    if (typeof GLStore !== 'undefined' && GLStore.getScheduleBlocksAsRanges) {
        blocked = await GLStore.getScheduleBlocksAsRanges();
    } else {
        blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    }
    const bEl = document.getElementById('blockedDates');
    if (bEl && blocked.length > 0) {
        var statusLabels = { unavailable:'Unavailable', tentative:'Tentative', booked_elsewhere:'Booked', vacation:'Vacation', travel:'Travel', personal_block:'Personal', hold:'Hold' };
        bEl.innerHTML = blocked.map(function(b, i) {
            var isLegacy = b._block && b._block._legacy;
            var blockId = b._block ? b._block.blockId : null;
            var statusChip = b.status && b.status !== 'unavailable'
                ? '<span style="font-size:0.72em;padding:1px 5px;border-radius:3px;background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2)">' + (statusLabels[b.status] || b.status) + '</span> '
                : '';
            var startFmt = (typeof glFormatDate === 'function') ? glFormatDate(b.startDate, true) : b.startDate;
            var endFmt = (typeof glFormatDate === 'function') ? glFormatDate(b.endDate, true) : b.endDate;
            var deleteAction = isLegacy ? 'calDeleteBlocked(' + i + ')' : '_calDeleteScheduleBlock(\'' + (blockId || '') + '\')';
            var editAction = isLegacy ? 'calEditBlocked(' + i + ')' : '_calEditScheduleBlock(\'' + (blockId || '') + '\')';
            return '<div class="list-item" style="padding:6px 12px;font-size:0.85em">'
                + '<span style="color:var(--red)">' + startFmt + ' → ' + endFmt + '</span>'
                + '<span style="flex:1;color:var(--text-muted);margin-left:8px">' + statusChip + (b.person || '') + (b.reason ? ': ' + b.reason : '') + '</span>'
                + '<button onclick="' + editAction + '" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;flex-shrink:0;margin-right:4px;">✏️</button>'
                + '<button onclick="' + deleteAction + '" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0;">✕</button>'
                + '</div>';
        }).join('');
    }
    return { dateMap, blockedRanges: blocked };
}

var _calMatrixDays = 14;
var _calCachedBlockedRanges = []; // cached for range toggle without full re-render
window.calMatrixRange = function(n) {
    _calMatrixDays = n;
    // Re-render just the availability matrix, not the entire calendar page
    _calRenderAvailabilityMatrix(_calCachedBlockedRanges);
};

function _calRenderAvailabilityMatrix(blockedRanges) {
    var el = document.getElementById('calAvailabilityMatrix');
    if (!el) return;

    // Get members
    var members = [];
    if (typeof bandMembers !== 'undefined') {
        Object.entries(bandMembers).forEach(function(e) { members.push(e[1].name || e[0]); });
    } else {
        var seen = {};
        blockedRanges.forEach(function(b) {
            if (b.person && !seen[b.person]) { seen[b.person] = true; members.push(b.person); }
        });
    }
    if (!members.length) { el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-dim)">Add band members to see availability.</div>'; return; }

    // Build day range
    var today = new Date();
    var numDays = _calMatrixDays;
    var days = [];
    for (var d = 0; d < numDays; d++) {
        var dt = new Date(today.getTime() + d * 86400000);
        days.push({
            date: dt.toISOString().split('T')[0],
            label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()],
            dayNum: dt.getDate(),
            isWeekend: dt.getDay() === 0 || dt.getDay() === 6
        });
    }

    // Compute per-day availability
    var dayAvail = days.map(function(day) {
        var freeCount = 0;
        members.forEach(function(member) {
            var blocked = blockedRanges.some(function(b) {
                return b.person === member && b.startDate && b.endDate && day.date >= b.startDate && day.date <= b.endDate;
            });
            if (!blocked) freeCount++;
        });
        return { day: day, freeCount: freeCount, allFree: freeCount === members.length };
    });

    // Best rehearsal days summary
    var allFreeDays = dayAvail.filter(function(d) { return d.allFree; });
    var bestHtml = '';
    if (allFreeDays.length > 0) {
        var bestList = allFreeDays.slice(0, 5).map(function(d) {
            var _bd = glParseDate(d.day.date);
            return '<span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:2px 8px;border-radius:4px;font-weight:700;cursor:pointer" onclick="calDayClick(' +
                (_bd ? _bd.getFullYear() + ',' + _bd.getMonth() + ',' + _bd.getDate() : '') + ')">' +
                d.day.label + ' ' + d.day.dayNum + '</span>';
        }).join(' ');
        var firstBest = allFreeDays[0].day;
        var _fbd = glParseDate(firstBest.date);
        bestHtml = '<div style="margin-bottom:10px;padding:8px 10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;font-size:0.85em">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">' +
            '<div><span style="color:#22c55e;font-weight:700">Best rehearsal days:</span> ' + bestList + '</div>' +
            '<button onclick="calDayClick(' + (_fbd ? _fbd.getFullYear() + ',' + _fbd.getMonth() + ',' + _fbd.getDate() : '') + ')" ' +
            'style="background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:4px 12px;font-size:0.82em;font-weight:700;cursor:pointer;white-space:nowrap">+ Create Rehearsal</button>' +
            '</div></div>';
    } else {
        var maxFree = Math.max.apply(null, dayAvail.map(function(d) { return d.freeCount; }));
        if (maxFree > 0) {
            var mostAvail = dayAvail.filter(function(d) { return d.freeCount === maxFree; }).slice(0, 3);
            var mostList = mostAvail.map(function(d) {
                return '<span style="background:rgba(251,191,36,0.12);color:#fbbf24;padding:2px 8px;border-radius:4px;font-weight:700">' +
                    d.day.label + ' ' + d.day.dayNum + ' (' + d.freeCount + '/' + members.length + ')</span>';
            }).join(' ');
            bestHtml = '<div style="margin-bottom:10px;padding:8px 10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;font-size:0.85em">' +
                '<span style="color:#fbbf24;font-weight:700">Most available:</span> ' + mostList + '</div>';
        }
    }

    // Range controls
    var rangeHtml = '<div style="display:flex;gap:4px;margin-bottom:8px">';
    [7, 14, 30].forEach(function(n) {
        var active = numDays === n;
        rangeHtml += '<button onclick="calMatrixRange(' + n + ')" style="background:' + (active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)') +
            ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + ';border:1px solid ' + (active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)') +
            ';padding:3px 10px;border-radius:6px;font-size:0.72em;font-weight:700;cursor:pointer">' + n + ' days</button>';
    });
    rangeHtml += '</div>';

    // Table
    var html = rangeHtml + bestHtml;
    html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;border-collapse:collapse;font-size:0.78em">';
    html += '<tr><th style="text-align:left;padding:4px 6px;color:var(--text-dim);font-weight:600;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;left:0;background:#0f172a;z-index:1"></th>';
    days.forEach(function(day) {
        var allFree = dayAvail.find(function(d) { return d.day.date === day.date; });
        var bg = allFree && allFree.allFree ? 'rgba(34,197,94,0.08)' : '';
        html += '<th style="text-align:center;padding:4px 2px;color:' + (day.isWeekend ? 'var(--accent-light)' : 'var(--text-dim)') +
            ';font-weight:600;font-size:0.85em;border-bottom:1px solid rgba(255,255,255,0.08);background:' + bg +
            ';cursor:pointer" onclick="calDayClick(' + new Date(day.date).getFullYear() + ',' + new Date(day.date).getMonth() + ',' + new Date(day.date).getDate() + ')">' +
            day.label.charAt(0) + '<br><span style="font-size:0.9em">' + day.dayNum + '</span></th>';
    });
    html += '</tr>';

    members.forEach(function(member) {
        html += '<tr>';
        html += '<td style="padding:4px 6px;color:var(--text-muted);font-weight:600;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.04);position:sticky;left:0;background:#0f172a;z-index:1">' + member.split(' ')[0] + '</td>';
        days.forEach(function(day) {
            var blocked = blockedRanges.some(function(b) {
                return b.person === member && b.startDate && b.endDate && day.date >= b.startDate && day.date <= b.endDate;
            });
            var allFreeDay = dayAvail.find(function(d) { return d.day.date === day.date; });
            var bgCol = allFreeDay && allFreeDay.allFree ? 'rgba(34,197,94,0.05)' : '';
            html += '<td style="text-align:center;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.04);background:' + bgCol + '">' +
                (blocked ? '<span style="color:#ef4444;font-weight:700">✖</span>' : '<span style="color:#22c55e;opacity:0.4">✔</span>') +
                '</td>';
        });
        html += '</tr>';
    });

    // Footer row: free count per day
    html += '<tr><td style="padding:4px 6px;color:var(--text-dim);font-size:0.8em;font-weight:600;position:sticky;left:0;background:#0f172a;z-index:1">Free</td>';
    dayAvail.forEach(function(d) {
        var color = d.allFree ? '#22c55e' : d.freeCount >= members.length - 1 ? '#fbbf24' : 'var(--text-dim)';
        html += '<td style="text-align:center;padding:4px 2px;font-size:0.8em;font-weight:700;color:' + color + '">' + d.freeCount + '</td>';
    });
    html += '</tr>';

    html += '</table></div>';
    if (!blockedRanges.length) {
        html += '<div style="text-align:center;padding:8px;color:var(--text-dim);font-size:0.8em">No blocked dates yet — all days show available.</div>';
    }
    el.innerHTML = html;
}

function calBlockDates() {
    window._calEditingBlockId = null;
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    var statusOpts = [
        ['unavailable','Unavailable'],['tentative','Tentative'],['booked_elsewhere','Booked Elsewhere'],
        ['vacation','Vacation'],['travel','Travel'],['personal_block','Personal'],['hold','Hold']
    ].map(function(s) { return '<option value="'+s[0]+'">'+s[1]+'</option>'; }).join('');
    var memberOpts = Object.entries(bandMembers).map(function(e) { return '<option value="'+e[1].name+'" data-key="'+e[0]+'">'+e[1].name+'</option>'; }).join('');
    area.innerHTML = '<h3 style="font-size:0.9em;color:var(--red);margin-bottom:12px">🚫 Add Conflict</h3>'
        + '<div class="form-grid">'
        + '<div class="form-row"><label class="form-label">Start Date</label><input class="app-input" id="blockStart" type="date"></div>'
        + '<div class="form-row"><label class="form-label">End Date</label><input class="app-input" id="blockEnd" type="date"></div>'
        + '<div class="form-row"><label class="form-label">Who</label><select class="app-select" id="blockPerson">' + memberOpts + '</select></div>'
        + '<div class="form-row"><label class="form-label">Type</label><select class="app-select" id="blockStatus">' + statusOpts + '</select></div>'
        + '<div class="form-row"><label class="form-label">Reason</label><input class="app-input" id="blockReason" placeholder="e.g. Family vacation"></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:8px">'
        + '<button class="btn btn-danger" onclick="saveBlockedDates()">🚫 Save Conflict</button>'
        + '<button class="btn btn-ghost" onclick="document.getElementById(\'calEventFormArea\').innerHTML=\'\'">Cancel</button>'
        + '</div>';
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function saveBlockedDates() {
    var startDate = (document.getElementById('blockStart') || {}).value || '';
    var endDate = (document.getElementById('blockEnd') || {}).value || '';
    if (!startDate || !endDate) { alert('Both dates required'); return; }
    var personEl = document.getElementById('blockPerson');
    var personName = personEl ? personEl.value : '';
    var personKey = personEl ? (personEl.options[personEl.selectedIndex] || {}).dataset.key : null;
    var status = (document.getElementById('blockStatus') || {}).value || 'unavailable';
    var reason = (document.getElementById('blockReason') || {}).value || '';

    if (typeof GLStore !== 'undefined' && GLStore.saveScheduleBlock) {
        var block = {
            blockId: window._calEditingBlockId || null,
            ownerKey: personKey || null,
            ownerName: personName,
            status: status,
            startDate: startDate,
            endDate: endDate,
            allDay: true,
            summary: reason,
            visibility: 'band_full',
            sourceType: 'manual'
        };
        await GLStore.saveScheduleBlock(block);
    } else {
        // Fallback: save to legacy blocked_dates
        var ex = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
        ex.push({ startDate: startDate, endDate: endDate, person: personName, reason: reason });
        await saveBandDataToDrive('_band', 'blocked_dates', ex);
    }
    window._calEditingBlockId = null;
    document.getElementById('calEventFormArea').innerHTML = '';
    renderCalendarInner();
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

// Schedule block CRUD (new model)
window._calDeleteScheduleBlock = async function(blockId) {
    if (!blockId || !confirm('Remove this schedule block?')) return;
    if (typeof GLStore !== 'undefined' && GLStore.deleteScheduleBlock) {
        await GLStore.deleteScheduleBlock(blockId);
    }
    renderCalendarInner();
};

window._calEditScheduleBlock = async function(blockId) {
    if (!blockId || typeof GLStore === 'undefined') return;
    var blocks = await GLStore.getScheduleBlocks();
    var block = blocks.find(function(b) { return b.blockId === blockId; });
    if (!block) return;
    // Reuse the block dates form with pre-filled values
    calBlockDates();
    setTimeout(function() {
        var s = document.getElementById('blockStart'); if (s) s.value = block.startDate || '';
        var e = document.getElementById('blockEnd'); if (e) e.value = block.endDate || '';
        var p = document.getElementById('blockPerson'); if (p) p.value = block.ownerName || '';
        var r = document.getElementById('blockReason'); if (r) r.value = block.summary || '';
        var st = document.getElementById('blockStatus'); if (st) st.value = block.status || 'unavailable';
    }, 50);
    // Swap save button to update mode
    window._calEditingBlockId = blockId;
};

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
    // Reset venue picker state
    window._calVenuePicker = null;
    // Load setlists + venues for gig-type dropdowns
    const setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    setlists.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const setlistOpts = setlists.map(sl =>
        `<option value="${sl.setlistId||''}" ${sl.setlistId&&ev.setlistId===sl.setlistId?'selected':''}>${sl.name||'Untitled'}${sl.date?' ('+sl.date+')':''}</option>`
    ).join('');
    const venues = await GLStore.getVenues();
    window._calSelectedVenueId = ev.venueId || null;
    window._calSelectedVenueName = ev.venue || null;
    const showSetlist = ev.type === 'gig';
    const showVenue   = ev.type === 'gig';
    var repeatVal = _calRepeatRuleToValue(ev.repeatRule);
    window._calEditEventId = isEdit ? (ev.id || null) : null;
    var isRecurringEdit = isEdit && ev.repeatRule && ev.repeatRule.frequency;
    area.innerHTML = `<h3 style="margin-bottom:12px;font-size:0.95em">${isEdit?'\u270f\ufe0f Edit Event':'\u2795 Add Event'}</h3>
    ${isRecurringEdit ? '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:0.82em;color:var(--accent-light)">🔄 Editing this recurring event updates all future occurrences.</div>' : ''}
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="calDate" type="date" value="${date||ev.date||''}"></div>
        <div class="form-row"><label class="form-label">Type</label><select class="app-select" id="calType" onchange="calTypeChanged(this)">
            <option value="rehearsal" ${(ev.type||'rehearsal')==='rehearsal'?'selected':''}>&#127928; Rehearsal</option>
            <option value="gig" ${ev.type==='gig'?'selected':''}>&#127908; Gig</option>
            <option value="meeting" ${ev.type==='meeting'?'selected':''}>&#128101; Meeting</option>
            <option value="other" ${ev.type==='other'?'selected':''}>&#128204; Other</option>
        </select></div>
        <div class="form-row calGigOnly" id="calVenueRow" style="${showVenue?'':'display:none'}">
            <label class="form-label">Venue</label>
            <div id="calVenuePicker"></div>
        </div>
        <div class="form-row"><label class="form-label">Title</label><input class="app-input" id="calTitle" placeholder="e.g. Practice at Drew's" value="${ev.title||''}"></div>
        <div class="form-row"><label class="form-label">Time</label><input class="app-input" id="calTime" type="time" value="${ev.time||''}"></div>
        <div class="form-row"><label class="form-label">Repeat</label><select class="app-select" id="calRepeat">
            <option value="none" ${repeatVal==='none'?'selected':''}>None</option>
            <option value="weekly" ${repeatVal==='weekly'?'selected':''}>Weekly</option>
            <option value="biweekly" ${repeatVal==='biweekly'?'selected':''}>Every 2 Weeks</option>
            <option value="monthly" ${repeatVal==='monthly'?'selected':''}>Monthly</option>
        </select></div>
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
    // Init venue picker for gig events
    var calPreselected = null;
    if (ev.venueId) calPreselected = venues.find(function(v){ return v.venueId === ev.venueId; });
    if (!calPreselected && ev.venue) calPreselected = venues.find(function(v){ return v.name === ev.venue; });
    _calInitVenuePicker(venues, calPreselected);
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function calTypeChanged(sel) {
    var slRow = document.getElementById('calSetlistRow');
    var vRow  = document.getElementById('calVenueRow');
    var isGig = sel.value === 'gig';
    if (slRow) slRow.style.display = isGig ? '' : 'none';
    if (vRow)  vRow.style.display  = isGig ? '' : 'none';
    // Init venue picker if switching to gig and picker not yet initialized
    if (isGig && !window._calVenuePicker && document.getElementById('calVenuePicker')) {
        GLStore.getVenues().then(function(venues) {
            _calInitVenuePicker(venues, null);
        });
    }
}

// Venue picker init for calendar event forms
function _calInitVenuePicker(venues, preselected) {
    if (!document.getElementById('calVenuePicker')) return;
    window._calVenueTouched = false;
    function _onSelect(v) {
        window._calVenueTouched = true;
        if (v) {
            window._calSelectedVenueId = v.venueId || null;
            window._calSelectedVenueName = v.name || '';
        } else {
            window._calSelectedVenueId = null;
            window._calSelectedVenueName = null;
        }
    }
    function _onCreateNew(text) {
        glVenueCreateModal({
            initialName: text,
            onSave: function(venue) {
                window._calSelectedVenueId = venue.venueId;
                window._calSelectedVenueName = venue.name;
                GLStore.getVenues().then(function(v) {
                    if (window._calVenuePicker) window._calVenuePicker.refresh(v);
                    if (window._calVenuePicker) window._calVenuePicker.setValue(venue.venueId);
                });
            },
            onUseExisting: function(venue) {
                window._calSelectedVenueId = venue.venueId;
                window._calSelectedVenueName = venue.name;
                if (window._calVenuePicker) window._calVenuePicker.setValue(venue.venueId);
            }
        });
    }
    window._calVenuePicker = glEntityPicker({
        containerId: 'calVenuePicker',
        items: venues,
        labelFn: venueShortLabel,
        subLabelFn: function(v) { return v.address || ''; },
        onSelect: _onSelect,
        onCreateNew: _onCreateNew,
        placeholder: 'Search venues...',
        emptyText: 'No venues yet',
        selectedItem: preselected || null
    });
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

async function calEditEventById(eventId) {
    if (!eventId) return;
    var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    var ev = events.find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var rawIdx = events.indexOf(ev);
    calAddEvent(ev.date, rawIdx, ev);
}

async function calDeleteEventById(eventId) {
    if (!eventId) return;
    var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    var ev = events.find(function(e) { return e.id === eventId; });
    if (!ev) return;
    var isRecurring = ev.repeatRule && ev.repeatRule.frequency;
    var msg = isRecurring
        ? 'Delete this recurring event? All future occurrences will be removed.'
        : 'Delete this event?';
    if (!confirm(msg)) return;
    events = events.filter(function(e) { return e.id !== eventId; });
    await saveBandDataToDrive('_band', 'calendar_events', events);
    document.getElementById('calEventFormArea').innerHTML = '';
    renderCalendarInner();
}

async function calSaveEvent(editIdx) {
    const ev = {
        date: document.getElementById('calDate')?.value,
        type: document.getElementById('calType')?.value,
        title: document.getElementById('calTitle')?.value,
        time: document.getElementById('calTime')?.value,
        notes: document.getElementById('calNotes')?.value,
        linkedSetlist: document.getElementById('calLinkedSetlist')?.value || null,
        venueId: window._calSelectedVenueId || null,
        venue: window._calSelectedVenueName || null,
    };
    // Recurrence rule
    var repeatVal = (document.getElementById('calRepeat') || {}).value || 'none';
    if (repeatVal === 'weekly') ev.repeatRule = { frequency: 'weekly', interval: 1, endsAt: null };
    else if (repeatVal === 'biweekly') ev.repeatRule = { frequency: 'weekly', interval: 2, endsAt: null };
    else if (repeatVal === 'monthly') ev.repeatRule = { frequency: 'monthly', interval: 1, endsAt: null };
    else ev.repeatRule = null;
    if (!ev.date || !ev.title) { alert('Date and title required'); return; }
    if (ev.type === 'gig' && !ev.venue) { alert('Gig events require a venue'); return; }
    let events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    if (editIdx !== undefined) {
        var i = -1;
        // Try id-based lookup first (set by calEditEventById)
        var editId = window._calEditEventId;
        if (editId) {
            i = events.findIndex(function(e) { return e.id === editId; });
        }
        if (i < 0) {
            // Fallback to positional lookup (legacy path)
            const today = new Date().toISOString().split('T')[0];
            const upcoming = events.filter(e => (e.date||'') >= today).sort((a,b) => (a.date||'').localeCompare(b.date||''));
            const old = upcoming[editIdx];
            if (old) i = events.findIndex(e => e.date===old.date && e.title===old.title);
        }
        if (i >= 0) {
            const existingId = events[i].id;
            events[i] = { ...events[i], ...ev };
            if (existingId) events[i].id = existingId;
            events[i].updated_at = new Date().toISOString();
        }
        window._calEditEventId = null;
    } else {
        ev.created = new Date().toISOString();
        ev.updated_at = ev.created;
        // Stamp a stable id at creation — this is the most important moment
        ev.id = (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36);
        events.push(ev);
    }
    await saveBandDataToDrive('_band', 'calendar_events', events);
    // If this is a gig event, sync to canonical Gig record
    if (ev.type === 'gig') {
        const existingGigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        // Match by gigId first (stable), fallback to venue+date (legacy compat)
        var existingIdx = -1;
        if (ev.gigId) {
            existingIdx = existingGigs.findIndex(function(g) { return g.gigId === ev.gigId; });
        }
        if (existingIdx < 0) {
            const gigKey = (ev.venue||'') + '|' + (ev.date||'');
            existingIdx = existingGigs.findIndex(function(g) { return ((g.venue||'')+'|'+(g.date||'')) === gigKey; });
        }

        // Resolve setlist from dropdown
        var calSetlistVal = ev.linkedSetlist || '';
        var allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        var linkedSl = calSetlistVal
            ? allSetlists.find(function(s) { return s.setlistId === calSetlistVal; })
            : null;

        const gigRecord = {
            venueId: ev.venueId || null,
            venue: ev.venue || ev.title || '',
            date: ev.date || '',
            startTime: ev.time || '',
            notes: ev.notes || '',
            linkedSetlist: linkedSl ? (linkedSl.name || '') : (ev.linkedSetlist || ''),
            setlistId: linkedSl ? (linkedSl.setlistId || null) : null,
            updated: new Date().toISOString()
        };
        if (existingIdx >= 0) {
            var prev = existingGigs[existingIdx];
            existingGigs[existingIdx] = { ...prev, ...gigRecord };
            // Preserve existing gigId and fields not in the calendar form
            existingGigs[existingIdx].gigId = prev.gigId || generateShortId(12);
            if (!gigRecord.setlistId && prev.setlistId) existingGigs[existingIdx].setlistId = prev.setlistId;
            if (!gigRecord.linkedSetlist && prev.linkedSetlist) existingGigs[existingIdx].linkedSetlist = prev.linkedSetlist;
            // Write gigId back to calendar event
            ev.gigId = existingGigs[existingIdx].gigId;
        } else {
            gigRecord.gigId = generateShortId(12);
            gigRecord.created = new Date().toISOString();
            // Auto-create blank setlist if none selected
            if (!gigRecord.setlistId) {
                var newSl = {
                    setlistId: generateShortId(12),
                    gigId: gigRecord.gigId,
                    name: (gigRecord.venue || 'Gig') + ' ' + (gigRecord.date || ''),
                    date: gigRecord.date || '',
                    venueId: gigRecord.venueId || null,
                    venue: gigRecord.venue || '',
                    notes: '',
                    sets: [{ name: 'Set 1', songs: [] }],
                    created: new Date().toISOString()
                };
                gigRecord.setlistId = newSl.setlistId;
                gigRecord.linkedSetlist = newSl.name;
                allSetlists.push(newSl);
                await saveBandDataToDrive('_band', 'setlists', allSetlists);
            }
            ev.gigId = gigRecord.gigId;
            existingGigs.push(gigRecord);
        }
        // Link setlist back to gig if applicable
        if (linkedSl && !linkedSl.gigId) {
            linkedSl.gigId = ev.gigId;
            await saveBandDataToDrive('_band', 'setlists', allSetlists);
        }
        await saveBandDataToDrive('_band', 'gigs', existingGigs);
        // Re-save calendar events with gigId stamped on the event
        var savedEvents = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var calIdx = savedEvents.findIndex(function(e) { return e.id === ev.id; });
        if (calIdx >= 0 && !savedEvents[calIdx].gigId) {
            savedEvents[calIdx].gigId = ev.gigId;
            await saveBandDataToDrive('_band', 'calendar_events', savedEvents);
        }
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
window._calInitVenuePicker = _calInitVenuePicker;
window.calEditEvent = calEditEvent;
window.calDeleteEvent = calDeleteEvent;
window.calEditEventById = calEditEventById;
window.calDeleteEventById = calDeleteEventById;
window.calSaveEvent = calSaveEvent;
window.expandRecurringEvents = expandRecurringEvents;
window.calShowSubscribeModal = typeof calShowSubscribeModal !== 'undefined' ? calShowSubscribeModal : function() { alert('Calendar export module not loaded.'); };
