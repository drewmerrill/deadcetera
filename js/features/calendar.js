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
        <span>\uD83D\uDCC5 ${displayDate}</span>
        ${ev.time ? `<span>\u23F0 ${ev.time}</span>` : ''}
        <span style="text-transform:capitalize">\uD83D\uDCC2 ${ev.type||'other'}</span>
        ${ev.location ? `<span>\uD83D\uDCCD ${ev.location}</span>` : ''}
        ${ev.locationAddress ? `<a href="https://www.google.com/maps/search/${encodeURIComponent(ev.locationAddress)}" target="_blank" style="color:var(--accent-light);text-decoration:none;font-size:0.82em">\uD83D\uDDFA\uFE0F Directions</a>` : ''}
        ${ev.venue ? `<span>\uD83C\uDFDB\uFE0F ${ev.venue}</span>` : ''}
        ${ev.meetingLink ? `<a href="${ev.meetingLink}" target="_blank" style="color:var(--accent-light);text-decoration:none">\uD83D\uDD17 Join Meeting</a>` : ''}
        ${repeatLbl ? `<span style="color:var(--accent-light)">\uD83D\uDD04 ${repeatLbl}</span>` : ''}
    </div>
    ${ev.notes ? `<div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;font-size:0.85em;color:var(--text-muted);margin-bottom:12px">${ev.notes}</div>` : ''}
    <div style="margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">
        <div style="font-size:0.68em;font-weight:700;color:var(--text-dim);margin-bottom:6px">Are you in?</div>
        <div style="display:flex;gap:6px" id="calAvailBtns_${idx}">
            <button onclick="_calSetAvail('${ev.id||''}','${displayDate}','yes')" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac;font-weight:700;font-size:0.78em;cursor:pointer">\u2705 In</button>
            <button onclick="_calSetAvail('${ev.id||''}','${displayDate}','no')" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);color:#fca5a5;font-weight:700;font-size:0.78em;cursor:pointer">\u274C Out</button>
            <button onclick="_calSetAvail('${ev.id||''}','${displayDate}','maybe')" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);color:#fbbf24;font-weight:700;font-size:0.78em;cursor:pointer">\u2753 Maybe</button>
        </div>
        <div id="calAvailStatus_${idx}" style="font-size:0.72em;color:var(--text-dim);margin-top:4px"></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${isRehearsal ? `<button onclick="practicePlanActiveDate='${displayDate}';showPage('rehearsal')" class="btn btn-primary btn-sm">\uD83D\uDCC5 Rehearsal Plan</button>` : ''}
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

// ── Shared RSVP row builder — used by both "Upcoming Schedule" and "Next Up" ──
function _buildEventRsvpRow(ev, idx, eventAvail, gigs, members, bm, myKey) {
    if (!members || members.length < 2) return '';
    var _safeDk = (ev.date || '').replace(/-/g, '');
    var _eaForDate = eventAvail[_safeDk] || {};
    var _matchGig = gigs.find(function(g) { return g.date === ev.date; });
    var _merged = {};
    if (_matchGig && _matchGig.availability) {
        Object.keys(_matchGig.availability).forEach(function(k) { _merged[k] = _matchGig.availability[k]; });
    }
    Object.keys(_eaForDate).forEach(function(k) { if (!_merged[k]) _merged[k] = _eaForDate[k]; });
    var _hasAny = Object.keys(_merged).length > 0;

    var html = '<div style="margin-top:6px">';

    // Member status chips (compact)
    if (_hasAny) {
        var _confirmed = 0;
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">';
        members.forEach(function(ref) {
            var k = (typeof ref === 'object') ? ref.key : ref;
            var name = bm[k] ? (bm[k].name || k).split(' ')[0] : k;
            var a = _merged[k];
            var st = a ? a.status : null;
            if (st === 'yes') _confirmed++;
            var icon = st === 'yes' ? '\u2705' : st === 'maybe' ? '\u2753' : st === 'no' ? '\u274C' : '\u23F3';
            html += '<span style="font-size:0.72em;color:var(--text-dim)">' + name + '\u00A0' + icon + '</span>';
        });
        html += '</div>';
    }

    // RSVP buttons (compact inline)
    if (myKey) {
        var _myStatus = _merged[myKey] ? _merged[myKey].status : null;
        var _evId = ev.id || '';
        var _evDate = ev.date || '';
        var _bStyle = 'padding:3px 8px;border-radius:5px;font-size:0.68em;font-weight:600;cursor:pointer;border:1px solid ';
        html += '<div style="display:flex;gap:4px">';
        html += '<button onclick="_calSetAvailAndRefresh(\'' + _evDate + '\',\'yes\',\'' + _evId + '\')" style="' + _bStyle + (_myStatus === 'yes' ? 'rgba(34,197,94,0.4);background:rgba(34,197,94,0.15);color:#86efac' : 'rgba(255,255,255,0.06);background:none;color:var(--text-dim)') + '">\u2705 In</button>';
        html += '<button onclick="_calSetAvailAndRefresh(\'' + _evDate + '\',\'maybe\',\'' + _evId + '\')" style="' + _bStyle + (_myStatus === 'maybe' ? 'rgba(245,158,11,0.4);background:rgba(245,158,11,0.15);color:#fbbf24' : 'rgba(255,255,255,0.06);background:none;color:var(--text-dim)') + '">\u2753 Maybe</button>';
        html += '<button onclick="_calSetAvailAndRefresh(\'' + _evDate + '\',\'no\',\'' + _evId + '\')" style="' + _bStyle + (_myStatus === 'no' ? 'rgba(239,68,68,0.4);background:rgba(239,68,68,0.15);color:#f87171' : 'rgba(255,255,255,0.06);background:none;color:var(--text-dim)') + '">\u274C Out</button>';
        html += '</div>';
    }

    html += '</div>';
    return html;
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
    el.innerHTML = '<div class="page-header"><h1>\uD83D\uDCC5 Schedule</h1></div>'
        + '<div id="calIntelBanner"></div>'
        + '<div id="calBestRehearsalHero"></div>'
        + '<div id="calNextUpSection"></div>'
        + '<div id="calendarInner"></div>';
    _calRenderIntelBanner();
    _calRenderBestRehearsalHero();
    _calRenderNextUp();
    renderCalendarInner();
}

// ── Intelligence Banner — smart scheduling recommendation ────────────────────
async function _calRenderIntelBanner() {
    var el = document.getElementById('calIntelBanner');
    if (!el) return;
    var daysSince = null, daysToGig = null, gigName = '';

    // Time since last rehearsal
    try {
        var sessions = (typeof _rhSessionsCache !== 'undefined' && _rhSessionsCache) ? _rhSessionsCache : [];
        if (!sessions.length && typeof loadBandDataFromDrive === 'function') {
            var raw = await loadBandDataFromDrive('_band', 'rehearsal_sessions');
            sessions = raw ? toArray(raw).sort(function(a,b) { return (b.date||'').localeCompare(a.date||''); }) : [];
        }
        if (sessions.length && sessions[0].date) {
            daysSince = Math.floor((Date.now() - new Date(sessions[0].date).getTime()) / 86400000);
        }
    } catch(e) {}

    // Days to next gig
    try {
        var today = new Date().toISOString().split('T')[0];
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var nextGig = events.filter(function(e) { return e.type === 'gig' && (e.date || '') >= today; })
            .sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0];
        if (nextGig) {
            daysToGig = Math.ceil((new Date(nextGig.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
            gigName = nextGig.title || nextGig.venue || 'your gig';
        }
    } catch(e) {}

    // Generate smart recommendation
    var msg = '', urgency = 'info'; // info | warning | urgent
    if (daysSince !== null && daysSince > 7 && daysToGig !== null && daysToGig <= 21) {
        var rehearsalsNeeded = Math.max(1, Math.ceil((daysToGig - 1) / 7));
        if (daysToGig <= 7) {
            msg = '\uD83D\uDEA8 ' + gigName + ' is in ' + daysToGig + ' day' + (daysToGig > 1 ? 's' : '') + ' and you haven\u2019t rehearsed in ' + daysSince + ' days. Schedule one now.';
            urgency = 'urgent';
        } else {
            msg = 'You should get ' + rehearsalsNeeded + ' rehearsal' + (rehearsalsNeeded > 1 ? 's' : '') + ' in before ' + gigName + ' (' + daysToGig + ' days). Last rehearsal was ' + daysSince + ' days ago.';
            urgency = 'warning';
        }
    } else if (daysSince !== null && daysSince > 14) {
        msg = '\u26A0\uFE0F ' + daysSince + ' days since your last rehearsal \u2014 the band is getting rusty.';
        urgency = 'warning';
    } else if (daysSince !== null && daysSince > 7) {
        msg = 'Last rehearsal ' + daysSince + ' days ago.' + (daysToGig ? ' Next gig in ' + daysToGig + ' days.' : '');
        urgency = 'info';
    } else if (daysToGig !== null && daysToGig <= 7) {
        msg = '\uD83C\uDFA4 ' + gigName + ' in ' + daysToGig + ' day' + (daysToGig > 1 ? 's' : '') + '.';
        urgency = daysToGig <= 3 ? 'warning' : 'info';
    }

    if (!msg) { el.innerHTML = ''; return; }
    var colors = { info: { bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.15)', text: 'var(--text-dim)' },
                   warning: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
                   urgent: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', text: '#f87171' } };
    var c = colors[urgency];
    el.innerHTML = '<div style="padding:10px 14px;margin-bottom:12px;border-radius:10px;background:' + c.bg + ';border:1px solid ' + c.border + ';font-size:0.82em;color:' + c.text + '">' + msg + '</div>';
}

// ── Best Next Rehearsal Hero Card ────────────────────────────────────────────
async function _calRenderBestRehearsalHero() {
    var el = document.getElementById('calBestRehearsalHero');
    if (!el) return;

    // Get members + blocked ranges
    var members = [];
    if (typeof bandMembers !== 'undefined') {
        Object.entries(bandMembers).forEach(function(e) { members.push({ key: e[0], name: e[1].name || e[0] }); });
    }
    if (members.length < 2) { el.innerHTML = ''; return; } // no point suggesting with solo

    var blockedRanges = [];
    try {
        var result = await loadCalendarEvents();
        blockedRanges = result ? (result.blockedRanges || []) : [];
    } catch(e) {}

    // Find best day in next 14 days with confidence scoring
    var today = new Date();
    var todayStr = today.toISOString().split('T')[0];
    var candidates = [];

    // Load gig dates for spacing calculation
    var nextGigDate = null;
    try {
        var allEvents = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var nextGig = allEvents.filter(function(e) { return e.type === 'gig' && (e.date || '') >= todayStr; })
            .sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0];
        if (nextGig) nextGigDate = nextGig.date;
    } catch(e) {}

    // Check existing rehearsals
    var existingRehearsals = [];
    try {
        var evts = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        existingRehearsals = evts.filter(function(e) { return e.type === 'rehearsal' && (e.date || '') >= todayStr; });
    } catch(e) {}

    // Load existing rehearsal dates to exclude from suggestions
    var _existingRehDates = {};
    existingRehearsals.forEach(function(r) { if (r.date) _existingRehDates[r.date] = true; });

    for (var d = 1; d <= 14; d++) {
        var dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
        var ds = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        // Skip dates that already have a rehearsal scheduled
        if (_existingRehDates[ds]) continue;
        var freeCount = 0;
        members.forEach(function(m) {
            var blocked = blockedRanges.some(function(b) {
                return (b.person === m.name || b.person === m.key) && b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate;
            });
            if (!blocked) freeCount++;
        });

        // Confidence scoring: availability + conflict score + gig spacing
        var availPct = Math.round((freeCount / members.length) * 100);
        var conflictScore = members.length - freeCount; // 0 = no conflicts
        var gigSpacing = nextGigDate ? Math.ceil((new Date(nextGigDate + 'T12:00:00') - new Date(ds + 'T12:00:00')) / 86400000) : 999;
        var spacingBonus = (gigSpacing >= 2 && gigSpacing <= 14) ? 10 : (gigSpacing >= 1 ? 5 : 0);
        var confidence = availPct - (conflictScore * 15) + spacingBonus;
        confidence = Math.max(0, Math.min(100, confidence));

        var quality = confidence >= 85 ? 'Best' : confidence >= 60 ? 'Good' : 'Backup';

        candidates.push({
            date: ds, dt: dt, freeCount: freeCount, availPct: availPct,
            conflictScore: conflictScore, gigSpacing: gigSpacing, confidence: confidence, quality: quality,
            day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()],
            dayNum: dt.getDate(),
            month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()]
        });
    }

    candidates.sort(function(a, b) { return b.confidence - a.confidence || a.date.localeCompare(b.date); });
    var best = candidates[0];
    if (!best || best.freeCount === 0) { el.innerHTML = ''; return; }

    var _bdParsed = glParseDate(best.date);
    var _bdArgs = _bdParsed ? _bdParsed.getFullYear() + ',' + _bdParsed.getMonth() + ',' + _bdParsed.getDate() : '';
    var _bdSafe = best.date.replace(/'/g, "\\'");

    // Alternatives as actionable cards
    var alts = candidates.filter(function(c) { return c.date !== best.date && c.confidence >= 40; }).slice(0, 3);
    var altsHtml = '';
    if (alts.length) {
        altsHtml = '<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.04);padding-top:10px">';
        alts.forEach(function(a) {
            var _aParsed = glParseDate(a.date);
            var _aArgs = _aParsed ? _aParsed.getFullYear() + ',' + _aParsed.getMonth() + ',' + _aParsed.getDate() : '';
            var qColor = a.quality === 'Good' ? '#84cc16' : '#fbbf24';
            altsHtml += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0">'
                + '<span style="flex:1;font-size:0.82em;color:var(--text)">' + a.day + ', ' + a.month + ' ' + a.dayNum
                + ' <span style="color:var(--text-dim)">(' + a.freeCount + '/' + members.length + ')</span></span>'
                + '<span style="font-size:0.65em;font-weight:700;padding:2px 6px;border-radius:4px;color:' + qColor + ';background:rgba(255,255,255,0.04)">' + a.quality + '</span>'
                + '<button onclick="calDayClick(' + _aArgs + ')" style="font-size:0.72em;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer">Use This</button>'
                + '</div>';
        });
        altsHtml += '</div>';
    }

    // Next Up validation: check if existing rehearsal is suboptimal
    var validationHtml = '';
    if (existingRehearsals.length > 0) {
        var nextReh = existingRehearsals.sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0];
        var rehCandidate = candidates.find(function(c) { return c.date === nextReh.date; });
        if (rehCandidate && rehCandidate.confidence < best.confidence - 20) {
            validationHtml = '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);font-size:0.78em;color:#fbbf24">'
                + '\u26A0\uFE0F Your scheduled rehearsal (' + (typeof glFormatDate === 'function' ? glFormatDate(nextReh.date) : nextReh.date) + ') isn\u2019t the best option. '
                + '<button onclick="calDayClick(' + _bdArgs + ')" style="background:none;border:none;color:#22c55e;cursor:pointer;font-weight:700;padding:0;text-decoration:underline">Move to ' + best.day + ' ' + best.month + ' ' + best.dayNum + '</button>'
                + '</div>';
        }
    }

    el.innerHTML = '<div style="padding:16px 18px;margin-bottom:12px;border-radius:12px;border:2px solid rgba(34,197,94,0.3);background:linear-gradient(160deg,rgba(34,197,94,0.06),rgba(99,102,241,0.04))">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
        + '<span style="font-size:0.68em;font-weight:800;color:#22c55e;text-transform:uppercase;letter-spacing:0.08em">Best Next Rehearsal</span>'
        + '<span style="font-size:0.62em;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,0.12);color:#22c55e">' + best.quality + ' (' + best.confidence + '%)</span>'
        + '</div>'
        + '<div style="font-size:1.15em;font-weight:900;color:var(--text)">' + best.day + ', ' + best.month + ' ' + best.dayNum + '</div>'
        + '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:10px">'
        + (best.availPct === 100 ? '\u2705 Everyone\u2019s free' : best.availPct + '% available')
        + (best.gigSpacing <= 14 ? ' \u00B7 ' + best.gigSpacing + ' days before gig' : '')
        + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
        + '<button onclick="_calLockAndPlan(\'' + _bdSafe + '\')" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.88em;cursor:pointer">\uD83C\uDFB8 Lock + Create Rehearsal Plan</button>'
        + '<button onclick="document.getElementById(\'calAvailabilityMatrix\').scrollIntoView({behavior:\'smooth\'})" style="padding:10px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);font-size:0.82em;cursor:pointer">See Alternatives</button>'
        + '</div>'
        + validationHtml
        + altsHtml
        + '</div>';
}

// ── Lock rehearsal + create plan + navigate ──────────────────────────────────
window._calLockAndPlan = async function(dateStr) {
    // 1. Create rehearsal event
    try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function' && typeof loadBandDataFromDrive === 'function') {
            var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
            var existing = events.find(function(e) { return e.type === 'rehearsal' && e.date === dateStr; });
            if (!existing) {
                var newEvent = {
                    id: 'ev_' + Date.now().toString(36),
                    type: 'rehearsal',
                    title: 'Band Rehearsal',
                    date: dateStr,
                    time: '19:00',
                    notes: '',
                    created: new Date().toISOString()
                };
                events.push(newEvent);
                await saveBandDataToDrive('_band', 'calendar_events', events);
            }
        }
        if (typeof showToast === 'function') showToast('\u2705 Rehearsal locked for ' + dateStr);
    } catch(e) {
        console.warn('[Calendar] Failed to create rehearsal event:', e);
    }

    // 2. Set the practice plan date and navigate to rehearsal page
    window.practicePlanActiveDate = dateStr;
    showPage('rehearsal');
};

// ── "Next Up" section — upcoming rehearsal + gig with availability/readiness ──
async function _calRenderNextUp() {
    var el = document.getElementById('calNextUpSection');
    if (!el) return;
    var today = new Date().toISOString().split('T')[0];
    var events = [];
    try { events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []); } catch(e) {}
    var futureEnd = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    var expanded = expandRecurringEvents(events, today, futureEnd);
    var upcoming = expanded.filter(function(e) { return (e.date || '') >= today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); });

    var nextRehearsal = upcoming.find(function(e) { return e.type === 'rehearsal'; }) || null;
    var nextGig = upcoming.find(function(e) { return e.type === 'gig'; }) || null;
    if (!nextRehearsal && !nextGig) {
        el.innerHTML = '<div style="padding:14px 16px;margin-bottom:12px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);font-size:0.85em;color:var(--text-dim)">No upcoming events. <button onclick="calAddEvent()" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-weight:600;padding:0">Add one \u2192</button></div>';
        return;
    }

    // Load members + gigs + event availability for RSVP display
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var gigs = [];
    try { gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []); } catch(e) {}
    // Load Firebase event_availability for rehearsals (gigs use gig.availability)
    var _eventAvail = {};
    try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function') {
            var _eaSnap = await db.ref(bandPath('event_availability')).once('value');
            _eventAvail = _eaSnap.val() || {};
        }
    } catch(e) {}

    var html = '<div style="margin-bottom:12px">';
    html += '<div style="font-size:0.72em;font-weight:800;letter-spacing:0.08em;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">Next Up</div>';

    // Render each upcoming event card
    [nextRehearsal, nextGig].forEach(function(ev) {
        if (!ev) return;
        var icon = ev.type === 'rehearsal' ? '\uD83C\uDFB8' : '\uD83C\uDFA4';
        var label = ev.type === 'rehearsal' ? 'Rehearsal' : 'Gig';
        var dateFmt = (typeof glFormatDate === 'function') ? glFormatDate(ev.date, true) : ev.date;
        var daysAway = (typeof glDaysAway === 'function') ? glDaysAway(ev.date) : null;
        var daysLabel = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : (daysAway !== null ? daysAway + ' days' : '');

        // Availability — merge gig data + event_availability (Firebase)
        var warnings = [];
        var matchGig = gigs.find(function(g) { return g.date === ev.date; });
        var _safeDateKey = (ev.date || '').replace(/-/g, '');
        var _eaForDate = _eventAvail[_safeDateKey] || {};
        // Merge: gig availability takes precedence, event_availability fills gaps
        var _mergedAvail = {};
        if (matchGig && matchGig.availability) {
            Object.keys(matchGig.availability).forEach(function(k) { _mergedAvail[k] = matchGig.availability[k]; });
        }
        Object.keys(_eaForDate).forEach(function(k) { if (!_mergedAvail[k]) _mergedAvail[k] = _eaForDate[k]; });

        var _hasAnyResponse = Object.keys(_mergedAvail).length > 0;
        if (_hasAnyResponse && members.length > 0) {
            var confirmed = 0, missing = 0;
            members.forEach(function(ref) {
                var k = (typeof ref === 'object') ? ref.key : ref;
                var a = _mergedAvail[k];
                if (a && a.status === 'yes') confirmed++;
                else missing++;
            });
            if (missing > 0) warnings.push('\u26A0\uFE0F ' + missing + ' not confirmed');
        } else if (members.length > 1) {
            warnings.push('\u26A0\uFE0F No availability responses yet');
        }

        // Readiness (setlist-based)
        if (ev.type === 'gig') {
            var setlists = (typeof GLStore !== 'undefined' && GLStore.getSetlistCache) ? GLStore.getSetlistCache() : (window._glCachedSetlists || []);
            if (!setlists || !setlists.length) warnings.push('\u26A0\uFE0F No setlist linked');
        }

        // Risk indicator
        var isRisk = warnings.length >= 2;

        // Action button
        var actionBtn = '';
        if (ev.type === 'rehearsal') {
            actionBtn = '<button onclick="practicePlanActiveDate=\'' + ev.date + '\';showPage(\'rehearsal\')" style="padding:6px 14px;border-radius:8px;border:none;background:rgba(34,197,94,0.12);color:#86efac;font-weight:700;font-size:0.78em;cursor:pointer">Open Rehearsal Plan</button>';
        } else {
            actionBtn = '<button onclick="showPage(\'setlists\')" style="padding:6px 14px;border-radius:8px;border:none;background:rgba(245,158,11,0.12);color:#fbbf24;font-weight:700;font-size:0.78em;cursor:pointer">View Setlist</button>';
        }

        html += '<div style="padding:14px 16px;margin-bottom:8px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid ' + (isRisk ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)') + '">';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
        html += '<span style="font-size:1.1em">' + icon + '</span>';
        html += '<div style="flex:1"><div style="font-weight:700;font-size:0.92em;color:var(--text)">' + (ev.title || label) + '</div>';
        html += '<div style="font-size:0.75em;color:var(--text-dim)">' + dateFmt + (daysLabel ? ' \u00B7 ' + daysLabel : '') + (ev.time ? ' \u00B7 ' + ev.time : '') + '</div></div>';
        if (isRisk) html += '<span style="font-size:0.68em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);color:#fbbf24">\u26A0\uFE0F At risk</span>';
        html += '</div>';

        // Warnings
        if (warnings.length) {
            html += '<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px">';
            warnings.forEach(function(w) {
                html += '<div style="font-size:0.75em;color:#fbbf24">' + w + '</div>';
            });
            html += '</div>';
        }

        // Who's in (if any availability data exists from either source)
        if (_hasAnyResponse && members.length > 0) {
            html += '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:6px">Who\u2019s in:</div>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
            members.forEach(function(ref) {
                var k = (typeof ref === 'object') ? ref.key : ref;
                var name = bm[k] ? (bm[k].name || k).split(' ')[0] : k;
                var a = _mergedAvail[k];
                var status = a ? a.status : null;
                var icon2 = status === 'yes' ? '\u2705' : status === 'maybe' ? '\u2753' : status === 'no' ? '\u274C' : '\u23F3';
                html += '<span style="font-size:0.78em;color:var(--text-dim)">' + name + ' ' + icon2 + '</span>';
            });
            html += '</div>';
        }

        // ── Your RSVP (In / Out / Maybe buttons) ──
        var myKey = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
        if (myKey) {
            var myStatus = _mergedAvail[myKey] ? _mergedAvail[myKey].status : null;
            var _evId = ev.id || '';
            var _evDate = ev.date || '';
            var _rsvpBtnStyle = 'padding:6px 12px;border-radius:8px;font-size:0.78em;font-weight:700;cursor:pointer;border:1px solid ';
            html += '<div style="display:flex;gap:6px;margin-bottom:8px">';
            html += '<button onclick="_calSetAvailAndRefresh(\'' + _evDate + '\',\'yes\',\'' + _evId + '\')" style="' + _rsvpBtnStyle + (myStatus === 'yes' ? 'rgba(34,197,94,0.4);background:rgba(34,197,94,0.15);color:#86efac' : 'rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:var(--text-dim)') + '">\u2705 In</button>';
            html += '<button onclick="_calSetAvailAndRefresh(\'' + _evDate + '\',\'maybe\',\'' + _evId + '\')" style="' + _rsvpBtnStyle + (myStatus === 'maybe' ? 'rgba(245,158,11,0.4);background:rgba(245,158,11,0.15);color:#fbbf24' : 'rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:var(--text-dim)') + '">\u2753 Maybe</button>';
            html += '<button onclick="_calSetAvailAndRefresh(\'' + _evDate + '\',\'no\',\'' + _evId + '\')" style="' + _rsvpBtnStyle + (myStatus === 'no' ? 'rgba(239,68,68,0.4);background:rgba(239,68,68,0.15);color:#f87171' : 'rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:var(--text-dim)') + '">\u274C Out</button>';
            html += '</div>';
        }

        html += actionBtn;
        html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
}

function renderCalendarInner() {
    // Clear schedule blocks cache so we get fresh data on each render
    if (typeof GLStore !== 'undefined' && GLStore._clearScheduleBlocksCache) GLStore._clearScheduleBlocksCache();
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
    el.innerHTML =
    '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" onclick="calAddEvent()" style="background:linear-gradient(135deg,#22c55e,#16a34a);border:none;font-weight:700">\uD83C\uDFB8 Schedule Rehearsal</button>' +
        '<button class="btn btn-ghost" onclick="calBlockDates()" style="color:#f87171">\uD83D\uDEAB Block Date</button>' +
        '<button class="btn btn-ghost" onclick="calShowSubscribeModal(window.currentBandSlug||\'deadcetera\')" style="color:var(--accent-light)" title="Subscribe to band calendar in Google/Apple Calendar">\uD83D\uDCC5 Subscribe</button>' +
    '</div>' +
    '<div class="app-card" id="calEventFormArea"></div>' +
    '<div class="app-card"><h3>\uD83D\uDCC5 Upcoming Schedule</h3>' +
        '<div id="calendarEvents"><div style="text-align:center;padding:20px;color:var(--text-dim)">Loading\u2026</div></div>' +
    '</div>' +
    '<div class="app-card"><h3>\uD83D\uDCCA Smart Scheduling</h3>' +
        '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Best days for the band to rehearse. Tap a date to lock it in.</div>' +
        '<div id="calAvailabilityMatrix" style="font-size:0.82em"><div style="text-align:center;padding:12px;color:var(--text-dim)">Loading\u2026</div></div>' +
        '<div id="calConflictResolver" style="display:none"></div>' +
    '</div>' +
    '<details style="margin-bottom:12px">' +
        '<summary class="app-card" style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px"><h3 style="margin:0" id="calBlockedHeader">\uD83D\uDEAB Conflicts</h3><span style="font-size:0.72em;color:var(--text-dim)">tap to expand</span></summary>' +
        '<div class="app-card" style="margin-top:-1px;border-top:none;border-top-left-radius:0;border-top-right-radius:0">' +
            '<div id="blockedDates" style="font-size:0.85em;color:var(--text-muted)"><div style="text-align:center;padding:12px;color:var(--text-dim)">No blocked dates.</div></div>' +
        '</div>' +
    '</details>' +
    '<details style="margin-bottom:12px">' +
        '<summary class="app-card" style="cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px"><h3 style="margin:0">\uD83D\uDCC5 Monthly Calendar</h3><span style="font-size:0.72em;color:var(--text-dim)">tap to expand</span></summary>' +
        '<div class="app-card" style="margin-top:-1px;border-top:none;border-top-left-radius:0;border-top-right-radius:0">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
                '<button class="btn btn-ghost btn-sm" onclick="calNavMonth(-1)">\u2190 Prev</button>' +
                '<h3 style="margin:0;font-size:1.05em;font-weight:700">' + mNames[month] + ' ' + year + '</h3>' +
                '<button class="btn btn-ghost btn-sm" onclick="calNavMonth(1)">Next \u2192</button>' +
            '</div>' +
            '<div id="calGrid"></div>' +
        '</div>' +
    '</details>';

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
                    // Accessible pills: icon + border style (no abbreviations)
                    var _pillCfg = {
                        rehearsal: { icon:'\uD83C\uDFB8', bg:'rgba(34,197,94,0.2)', border:'1px solid rgba(34,197,94,0.5)', radius:'3px' },
                        gig:       { icon:'\uD83C\uDFA4', bg:'rgba(245,158,11,0.2)', border:'2px solid rgba(245,158,11,0.6)', radius:'8px' },
                        meeting:   { icon:'\uD83D\uDC65', bg:'rgba(99,102,241,0.15)', border:'1px dashed rgba(99,102,241,0.4)', radius:'3px' },
                        other:     { icon:'\uD83D\uDCCC', bg:'rgba(148,163,184,0.1)', border:'1px solid rgba(148,163,184,0.3)', radius:'3px' }
                    };
                    var _pc = _pillCfg[ev.type||'other'] || _pillCfg.other;
                    const evIdx = ev._idx !== undefined ? ev._idx : ei;
                    // Month view: icon only — title on hover. Fast recognition, no clutter.
                    return `<div onclick="event.stopPropagation();calShowEvent(${evIdx},'${ev.date||''}')" style="display:flex;align-items:center;justify-content:center;background:${_pc.bg};border:${_pc.border};border-radius:${_pc.radius};padding:2px;margin-top:1px;cursor:pointer;width:100%;min-height:16px" title="${ev.title||'Untitled'}">
                        <span style="font-size:0.72em;line-height:1">${_pc.icon}</span>
                    </div>`;
                }).join('')
                : '';
            const moreCount = dayEvents.length > 2 ? `<div style="font-size:0.55em;color:var(--accent-light);text-align:center">+${dayEvents.length-2} more</div>` : '';
            // Blocked date bars
            const blockBars = blockedRanges
                .filter(b => b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate)
                .map((b,bi) => {
                    const blockId = b._block ? b._block.blockId : null;
                    // Always use _calEditScheduleBlock — it handles both legacy and new-model blocks
                    const editAction = blockId ? `_calEditScheduleBlock('${blockId}')` : `_calEditScheduleBlock('')`;
                    return `<div ondblclick="event.stopPropagation();${editAction}" onclick="event.stopPropagation()" style="background:rgba(239,68,68,0.7);border:2px dashed rgba(239,68,68,0.9);border-radius:3px;padding:1px 4px;margin-top:1px;overflow:hidden;cursor:pointer" title="Dbl-click to edit | ${b.person||''}: ${b.reason||''}">
                    <span style="font-size:0.5em;font-weight:800;letter-spacing:0.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;color:white">\uD83D\uDEAB OUT</span>
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
    // Re-open the calendar details element (it was open when user clicked nav)
    setTimeout(function() {
        var details = document.querySelectorAll('#calendarInner details');
        details.forEach(function(d) {
            if (d.querySelector('#calGrid')) d.open = true;
        });
    }, 50);
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
        // Resolve setlist names from IDs
        var _slCache = {};
        try {
            var _allSl = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? (GLStore.getSetlists() || []) : (window._glCachedSetlists || []);
            _allSl.forEach(function(sl) { if (sl.setlistId) _slCache[sl.setlistId] = sl.name || sl.title || sl.setlistId; if (sl.name) _slCache[sl.name] = sl.name; });
        } catch(e2) {}

        // Load event_availability + gig availability for RSVP display
        var _upEventAvail = {};
        var _upGigs = [];
        var _upMembers = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
        var _upBm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        var _upMyKey = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
        try {
            var _uDb = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
            if (_uDb && typeof bandPath === 'function') {
                var _uSnap = await _uDb.ref(bandPath('event_availability')).once('value');
                _upEventAvail = _uSnap.val() || {};
            }
            _upGigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        } catch(e3) {}

        el.innerHTML = upcoming.map((e,i) => {
            var wk = '_calEv_' + i; window[wk] = e;
            const typeIcon = {rehearsal:'\uD83C\uDFB8',gig:'\uD83C\uDFA4',meeting:'\uD83D\uDC65',other:'\uD83D\uDCCC'}[e.type]||'\uD83D\uDCCC';
            var _typeColor = {rehearsal:'#22c55e',gig:'#fbbf24',meeting:'#818cf8',other:'#64748b'}[e.type]||'#64748b';
            const isRehearsal = e.type === 'rehearsal';
            var repeatLbl = _calRepeatLabel(e.repeatRule);
            var evtId = e._baseEventId || e.id || '';

            // Human-readable date: "Fri, Apr 3, 2026"
            var _dParsed = glParseDate ? glParseDate(e.date) : null;
            var _dateHuman = _dParsed ? _dParsed.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) : (e.date || '');

            // Format time: "6:00 PM" from "18:00"
            var _timeHuman = '';
            if (e.time) {
                var _tp = e.time.split(':');
                var _h = parseInt(_tp[0],10), _m = _tp[1] || '00';
                _timeHuman = (_h > 12 ? _h - 12 : (_h === 0 ? 12 : _h)) + ':' + _m + ' ' + (_h >= 12 ? 'PM' : 'AM');
            }

            // Location
            var _evLocLine = e.location ? '\uD83D\uDCCD ' + e.location : (e.venue ? '\uD83C\uDFDB\uFE0F ' + e.venue : '');
            var _evDirLink = e.locationAddress ? ' <a href="https://www.google.com/maps/search/' + encodeURIComponent(e.locationAddress) + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--accent-light);text-decoration:none">\uD83D\uDDFA\uFE0F</a>' : '';

            // Setlist name resolution (ID → display name)
            var _slDisplay = '';
            if (e.linkedSetlist) {
                var _slName = _slCache[e.linkedSetlist] || e.linkedSetlist;
                // If it still looks like an ID (no spaces, short), try to find it
                if (_slName === e.linkedSetlist && _slName.length < 20 && _slName.indexOf(' ') === -1) {
                    _slName = _slCache[e.linkedSetlist] || 'Linked Setlist';
                }
                _slDisplay = '<span style="font-size:0.75em;color:var(--accent-light);cursor:pointer" onclick="event.stopPropagation();showPage(\'setlists\')" title="View setlist: ' + _slName + '">\uD83D\uDCCB ' + _slName + '</span>';
            }

            // First event gets "NEXT" badge
            var _nextBadge = i === 0 ? '<span style="font-size:0.6em;font-weight:800;padding:2px 6px;border-radius:4px;background:rgba(34,197,94,0.15);color:#22c55e;margin-left:6px;vertical-align:middle">NEXT</span>' : '';

            return '<div class="list-item" style="padding:12px 14px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start">'
                // Left: event info
                + '<div style="min-width:0">'
                + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">'
                + '<span style="font-size:1.05em;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (e.title || 'Untitled') + '</span>'
                + _nextBadge
                + '</div>'
                + '<div style="font-size:0.78em;color:var(--text-dim);display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center">'
                + '<span style="color:' + _typeColor + ';font-weight:600">' + typeIcon + ' ' + ({rehearsal:'Rehearsal',gig:'Gig',meeting:'Meeting',other:'Event'}[e.type]||'Event') + '</span>'
                + '<span>' + _dateHuman + '</span>'
                + (_timeHuman ? '<span>' + _timeHuman + '</span>' : '')
                + '</div>'
                + (_evLocLine ? '<div style="font-size:0.75em;color:var(--text-muted);margin-top:3px">' + _evLocLine + _evDirLink + '</div>' : '')
                + (_slDisplay ? '<div style="margin-top:3px">' + _slDisplay + '</div>' : '')
                + (repeatLbl ? '<div style="font-size:0.68em;color:var(--accent-light);margin-top:2px">\uD83D\uDD04 ' + repeatLbl + '</div>' : '')
                + _buildEventRsvpRow(e, i, _upEventAvail, _upGigs, _upMembers, _upBm, _upMyKey)
                + '</div>'
                // Right: actions (aligned top-right)
                + '<div style="display:flex;gap:6px;flex-shrink:0;align-items:center">'
                + (isRehearsal ? '<button onclick="practicePlanActiveDate=\'' + e.date + '\';showPage(\'rehearsal\')" style="background:rgba(34,197,94,0.1);color:#86efac;border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px" title="Open rehearsal plan">\uD83D\uDCCB</button>' : '')
                + '<button onclick="calEditEventById(\'' + evtId + '\')" style="background:rgba(255,255,255,0.04);color:var(--text-dim);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px" title="Edit event">\u270F\uFE0F</button>'
                + '<button onclick="calDeleteEventById(\'' + evtId + '\')" style="background:rgba(239,68,68,0.08);color:#f87171;border:1px solid rgba(239,68,68,0.15);border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px" title="Delete event">\u2715</button>'
                + '</div>'
                + '</div>';
        }).join('');
    }
    // Schedule blocks (unified: new model + legacy blocked_dates)
    var blocked = [];
    if (typeof GLStore !== 'undefined' && GLStore.getScheduleBlocksAsRanges) {
        blocked = await GLStore.getScheduleBlocksAsRanges();
    } else {
        blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
    }
    // Sort blocked dates chronologically
    blocked.sort(function(a, b) { return (a.startDate || '').localeCompare(b.startDate || ''); });
    // Update header count
    var bHeader = document.getElementById('calBlockedHeader');
    if (bHeader) bHeader.textContent = '🚫 Conflicts & Blocked Dates' + (blocked.length > 0 ? ' (' + blocked.length + ')' : '');
    const bEl = document.getElementById('blockedDates');
    if (bEl && blocked.length > 0) {
        var statusLabels = { unavailable:'Unavailable', tentative:'Tentative', booked_elsewhere:'Booked', vacation:'Vacation', travel:'Travel', personal_block:'Personal', hold:'Hold' };
        bEl.innerHTML = blocked.map(function(b, i) {
            var blockId = b._block ? b._block.blockId : null;
            var statusChip = b.status && b.status !== 'unavailable'
                ? '<span style="font-size:0.72em;padding:1px 5px;border-radius:3px;background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2)">' + (statusLabels[b.status] || b.status) + '</span> '
                : '';
            var startFmt = (typeof glFormatDate === 'function') ? glFormatDate(b.startDate, true) : b.startDate;
            var endFmt = (typeof glFormatDate === 'function') ? glFormatDate(b.endDate, true) : b.endDate;
            // Always use schedule block functions — they handle both legacy and new-model
            var deleteAction = '_calDeleteScheduleBlock(\'' + (blockId || '') + '\')';
            var editAction = '_calEditScheduleBlock(\'' + (blockId || '') + '\')';
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

    // Build day range with month context
    var today = new Date();
    var numDays = _calMatrixDays;
    var days = [];
    var _monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (var d = 0; d < numDays; d++) {
        var dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
        var _dStr = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        days.push({
            date: _dStr,
            label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()],
            dayNum: dt.getDate(),
            month: _monthNames[dt.getMonth()],
            monthIdx: dt.getMonth(),
            year: dt.getFullYear(),
            isWeekend: dt.getDay() === 0 || dt.getDay() === 6,
            isFirstOfMonth: dt.getDate() === 1 || d === 0
        });
    }

    // Build schedule blocks for status-aware evaluation
    var useRichEval = typeof GLStore !== 'undefined' && GLStore.computeDateStrength && GLStore.evaluateMemberDateStatus;
    var schedBlocks = [];
    if (useRichEval) {
        blockedRanges.forEach(function(br) {
            schedBlocks.push(br._block || { ownerName: br.person, ownerKey: br.person, startDate: br.startDate, endDate: br.endDate, status: br.status || 'unavailable' });
        });
    }

    // Compute per-day availability (status-aware when possible)
    var dayAvail = days.map(function(day) {
        if (useRichEval) {
            var strength = GLStore.computeDateStrength(schedBlocks, members, day.date);
            return { day: day, freeCount: strength.available, allFree: strength.label === 'Strong', strength: strength };
        }
        var freeCount = 0;
        members.forEach(function(member) {
            var blocked = blockedRanges.some(function(b) {
                return b.person === member && b.startDate && b.endDate && day.date >= b.startDate && day.date <= b.endDate;
            });
            if (!blocked) freeCount++;
        });
        return { day: day, freeCount: freeCount, allFree: freeCount === members.length, strength: null };
    });

    // Best rehearsal days — prioritize Strong, then Workable
    var allFreeDays = dayAvail.filter(function(d) { return d.allFree || (d.strength && d.strength.label === 'Strong'); });
    var bestHtml = '';
    if (allFreeDays.length > 0) {
        var bestList = allFreeDays.slice(0, 5).map(function(d) {
            var _bd = glParseDate(d.day.date);
            return '<span style="background:rgba(34,197,94,0.15);color:#22c55e;padding:2px 8px;border-radius:4px;font-weight:700;cursor:pointer" onclick="calDayClick(' +
                (_bd ? _bd.getFullYear() + ',' + _bd.getMonth() + ',' + _bd.getDate() : '') + ')">' +
                d.day.label + ' ' + d.day.month + ' ' + d.day.dayNum + '</span>';
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
        // Try Workable days first (soft conflicts only)
        var workableDays = dayAvail.filter(function(d) { return d.strength && d.strength.label === 'Workable'; });
        if (workableDays.length > 0) {
            var wkList = workableDays.slice(0, 4).map(function(d) {
                return '<span style="background:rgba(132,204,22,0.12);color:#84cc16;padding:2px 8px;border-radius:4px;font-weight:700">' +
                    d.day.label + ' ' + d.day.month + ' ' + d.day.dayNum + ' <span style="font-size:0.8em;opacity:0.7">' + d.strength.label + '</span></span>';
            }).join(' ');
            bestHtml = '<div style="margin-bottom:10px;padding:8px 10px;background:rgba(132,204,22,0.06);border:1px solid rgba(132,204,22,0.15);border-radius:8px;font-size:0.85em">' +
                '<span style="color:#84cc16;font-weight:700">Workable days (soft conflicts only):</span> ' + wkList + '</div>';
        } else {
            var maxFree = Math.max.apply(null, dayAvail.map(function(d) { return d.freeCount; }));
            if (maxFree > 0) {
                var mostAvail = dayAvail.filter(function(d) { return d.freeCount === maxFree; }).slice(0, 3);
                var mostList = mostAvail.map(function(d) {
                    var strengthLabel = d.strength ? ' · ' + d.strength.label : '';
                    return '<span style="background:rgba(251,191,36,0.12);color:#fbbf24;padding:2px 8px;border-radius:4px;font-weight:700">' +
                        d.day.label + ' ' + d.day.month + ' ' + d.day.dayNum + ' (' + d.freeCount + '/' + members.length + strengthLabel + ')</span>';
                }).join(' ');
                bestHtml = '<div style="margin-bottom:10px;padding:8px 10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;font-size:0.85em">' +
                    '<span style="color:#fbbf24;font-weight:700">Most available:</span> ' + mostList + '</div>';
            }
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

    // Table with month headers
    var html = rangeHtml + bestHtml;
    html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="width:100%;border-collapse:collapse;font-size:0.78em">';

    // Month header row
    html += '<tr><th style="position:sticky;left:0;background:#0f172a;z-index:2"></th>';
    var _prevMonth = -1;
    var _monthSpans = [];
    days.forEach(function(day, di) {
        var key = day.year + '-' + day.monthIdx;
        if (day.monthIdx !== _prevMonth) {
            if (_monthSpans.length) _monthSpans[_monthSpans.length - 1].span = di - _monthSpans[_monthSpans.length - 1].start;
            _monthSpans.push({ label: day.month + ' ' + day.year, start: di, span: 0 });
            _prevMonth = day.monthIdx;
        }
    });
    if (_monthSpans.length) _monthSpans[_monthSpans.length - 1].span = days.length - _monthSpans[_monthSpans.length - 1].start;
    _monthSpans.forEach(function(ms) {
        html += '<th colspan="' + ms.span + '" style="text-align:center;padding:2px 0;font-size:0.7em;font-weight:800;letter-spacing:0.08em;color:var(--accent-light);text-transform:uppercase;border-bottom:2px solid rgba(99,102,241,0.2)">' + ms.label + '</th>';
    });
    html += '</tr>';

    // Day header row
    html += '<tr><th style="text-align:left;padding:4px 6px;color:var(--text-dim);font-weight:600;border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;left:0;background:#0f172a;z-index:1"></th>';
    days.forEach(function(day) {
        var allFree = dayAvail.find(function(d) { return d.day.date === day.date; });
        var bg = allFree && allFree.allFree ? 'rgba(34,197,94,0.1)' : '';
        var monthBorder = day.isFirstOfMonth && day.dayNum === 1 ? 'border-left:3px solid rgba(99,102,241,0.5);' : '';
        html += '<th style="text-align:center;padding:4px 2px;color:' + (day.isWeekend ? 'var(--accent-light)' : 'var(--text-dim)') +
            ';font-weight:600;font-size:0.85em;border-bottom:1px solid rgba(255,255,255,0.08);background:' + bg + ';' + monthBorder +
            'cursor:pointer" onclick="calShowDateConflicts(\'' + day.date + '\')">' +
            day.label.charAt(0) + '<br><span style="font-size:0.9em">' + day.dayNum + '</span></th>';
    });
    html += '</tr>';

    members.forEach(function(member) {
        html += '<tr>';
        html += '<td style="padding:4px 6px;color:var(--text-muted);font-weight:600;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.04);position:sticky;left:0;background:#0f172a;z-index:1">' + member.split(' ')[0] + '</td>';
        days.forEach(function(day) {
            var allFreeDay = dayAvail.find(function(d) { return d.day.date === day.date; });
            var bgCol = allFreeDay && allFreeDay.allFree ? 'rgba(34,197,94,0.05)' : '';
            var cellContent = '<span style="color:#22c55e;opacity:0.4">\u2714</span>';
            if (useRichEval) {
                var mStatus = GLStore.evaluateMemberDateStatus(schedBlocks, member, day.date);
                if (mStatus.status === 'hard_conflict') {
                    cellContent = '<span style="color:#ef4444;font-weight:700">\u2716</span>';
                } else if (mStatus.status === 'soft_conflict') {
                    cellContent = '<span style="color:#f59e0b;font-weight:600">~</span>';
                }
            } else {
                var blocked = blockedRanges.some(function(b) { return b.person === member && b.startDate && b.endDate && day.date >= b.startDate && day.date <= b.endDate; });
                if (blocked) cellContent = '<span style="color:#ef4444;font-weight:700">\u2716</span>';
            }
            var monthBorder = day.isFirstOfMonth && day.dayNum === 1 ? 'border-left:3px solid rgba(99,102,241,0.5);' : '';
            html += '<td style="text-align:center;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.04);background:' + bgCol + ';' + monthBorder + '">' + cellContent + '</td>';
        });
        html += '</tr>';
    });

    // Footer row: strength label or free count
    html += '<tr><td style="padding:4px 6px;color:var(--text-dim);font-size:0.8em;font-weight:600;position:sticky;left:0;background:#0f172a;z-index:1">Status</td>';
    dayAvail.forEach(function(d, di) {
        var mb = d.day.isFirstOfMonth && d.day.dayNum === 1 ? 'border-left:3px solid rgba(99,102,241,0.5);' : '';
        if (d.strength) {
            var s = d.strength;
            var shortLabel = { 'Strong':'\u2714', 'Workable':'~', 'Risky':'!', 'Not viable':'\u2716' }[s.label] || '?';
            html += '<td style="text-align:center;padding:4px 2px;font-size:0.75em;font-weight:800;color:' + s.color + ';' + mb + '" title="' + s.label + ': ' + s.available + ' free, ' + s.softConflictCount + ' soft, ' + s.hardConflictCount + ' hard">' + shortLabel + '</td>';
        } else {
            var color = d.allFree ? '#22c55e' : d.freeCount >= members.length - 1 ? '#fbbf24' : 'var(--text-dim)';
            html += '<td style="text-align:center;padding:4px 2px;font-size:0.8em;font-weight:700;color:' + color + ';' + mb + '">' + d.freeCount + '</td>';
        }
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

// ── Date validation ──────────────────────────────────────────────────────────
function _calValidateDate(dateStr, label) {
    if (!dateStr) return label + ' is required.';
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return label + ' is not a valid date.';
    var year = d.getFullYear();
    if (year < 2020 || year > 2099) return label + ' has an unlikely year (' + year + '). Please double-check.';
    return null; // valid
}

function _calValidateDateRange(startDate, endDate) {
    var err = _calValidateDate(startDate, 'Start date');
    if (err) return err;
    err = _calValidateDate(endDate, 'End date');
    if (err) return err;
    if (endDate < startDate) return 'End date (' + endDate + ') is before start date (' + startDate + ').';
    // Warn if range is very long (> 60 days)
    var days = Math.round((new Date(endDate + 'T12:00:00') - new Date(startDate + 'T12:00:00')) / 86400000);
    if (days > 60) return 'Date range spans ' + days + ' days. Is that intentional?';
    return null;
}

async function saveBlockedDates() {
    var startDate = (document.getElementById('blockStart') || {}).value || '';
    var endDate = (document.getElementById('blockEnd') || {}).value || '';
    if (!startDate || !endDate) { alert('Both dates required'); return; }
    var rangeErr = _calValidateDateRange(startDate, endDate);
    if (rangeErr) { alert(rangeErr); return; }
    var personEl = document.getElementById('blockPerson');
    var personName = personEl ? personEl.value : '';
    var personKey = personEl ? (personEl.options[personEl.selectedIndex] || {}).dataset.key : null;
    var status = (document.getElementById('blockStatus') || {}).value || 'unavailable';
    var reason = (document.getElementById('blockReason') || {}).value || '';

    if (typeof GLStore !== 'undefined' && GLStore.saveScheduleBlock) {
        var editingId = window._calEditingBlockId || null;
        // If editing a legacy block, remove from legacy array and migrate to new model
        if (editingId && editingId.indexOf('_legacy_') === 0) {
            var legacyIdx = parseInt(editingId.replace('_legacy_', ''), 10);
            var legacyArr = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
            if (legacyIdx >= 0 && legacyIdx < legacyArr.length) {
                legacyArr.splice(legacyIdx, 1);
                await saveBandDataToDrive('_band', 'blocked_dates', legacyArr);
            }
            editingId = null; // assign new blockId for migrated block
        }
        var block = {
            blockId: editingId,
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

// Schedule block CRUD (handles both new-model and legacy blocks)
window._calDeleteScheduleBlock = async function(blockId) {
    if (!blockId || !confirm('Remove this schedule block?')) return;
    // Legacy blocks have blockId like '_legacy_N' — delete from blocked_dates array
    if (blockId.indexOf('_legacy_') === 0) {
        var legacyIdx = parseInt(blockId.replace('_legacy_', ''), 10);
        var blocked = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
        if (legacyIdx >= 0 && legacyIdx < blocked.length) {
            blocked.splice(legacyIdx, 1);
            await saveBandDataToDrive('_band', 'blocked_dates', blocked);
        }
    } else if (typeof GLStore !== 'undefined' && GLStore.deleteScheduleBlock) {
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
        // Update form title and button for edit mode
        var area = document.getElementById('calEventFormArea');
        if (area) {
            var h3 = area.querySelector('h3');
            if (h3) h3.textContent = '✏️ Edit Conflict';
        }
    }, 50);
    // Swap save button to update mode
    window._calEditingBlockId = blockId;
};

// ── Conflict Resolver Panel ──────────────────────────────────────────────────

window.calShowDateConflicts = function(dateStr) {
    var el = document.getElementById('calConflictResolver');
    if (!el) return;
    // Toggle off if same date clicked
    if (el.style.display !== 'none' && el.dataset.date === dateStr) {
        el.style.display = 'none';
        return;
    }
    el.dataset.date = dateStr;
    el.style.display = 'block';

    var dateDisplay = (typeof glFormatDate === 'function') ? glFormatDate(dateStr, false) : dateStr;
    var dayLabel = (typeof glCountdownLabel === 'function') ? glCountdownLabel(dateStr) : '';

    // Get members
    var members = [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    if (typeof BAND_MEMBERS_ORDERED !== 'undefined') {
        BAND_MEMBERS_ORDERED.forEach(function(ref) {
            var key = (typeof ref === 'object') ? ref.key : ref;
            members.push(bm[key] ? bm[key].name : key);
        });
    } else {
        Object.entries(bm).forEach(function(e) { members.push(e[1].name || e[0]); });
    }

    // Get strength evaluation
    var strength = null;
    if (typeof GLStore !== 'undefined' && GLStore.computeDateStrength && _calCachedBlockedRanges.length >= 0) {
        var blocks = _calCachedBlockedRanges.map(function(br) {
            return br._block || { ownerName: br.person, ownerKey: br.person, startDate: br.startDate, endDate: br.endDate, status: br.status || 'unavailable' };
        });
        strength = GLStore.computeDateStrength(blocks, members, dateStr);
    }

    var html = '<div style="margin-top:10px;padding:14px;border-radius:10px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.04)">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
        + '<div>'
        + '<div style="font-size:0.88em;font-weight:700;color:var(--text)">' + dateDisplay + '</div>'
        + (dayLabel ? '<div style="font-size:0.72em;color:var(--text-dim)">' + dayLabel + '</div>' : '')
        + '</div>'
        + '<button onclick="document.getElementById(\'calConflictResolver\').style.display=\'none\'" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.1em;padding:4px">✕</button>'
        + '</div>';

    // Strength badge
    if (strength) {
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
            + '<span style="font-size:0.82em;font-weight:800;color:' + strength.color + '">' + strength.label + '</span>'
            + '<span style="font-size:0.68em;color:var(--text-dim)">' + strength.available + ' available · ' + strength.softConflictCount + ' soft · ' + strength.hardConflictCount + ' hard</span>'
            + '</div>';
    }

    // Per-member breakdown
    if (strength && strength.memberStatuses) {
        html += '<div style="margin-bottom:10px">';
        var statusIcons = { available: '✅', hard_conflict: '❌', soft_conflict: '❓' };
        var statusColors = { available: '#22c55e', hard_conflict: '#ef4444', soft_conflict: '#f59e0b' };
        var statusLabels = { available: 'Available', hard_conflict: 'Unavailable', soft_conflict: 'Tentative' };
        var conflictTypeLabels = { unavailable: 'Unavailable', booked_elsewhere: 'Booked elsewhere', vacation: 'Vacation', travel: 'Travel', tentative: 'Tentative', hold: 'Hold', personal_block: 'Personal' };

        members.forEach(function(member) {
            var ms = strength.memberStatuses[member];
            if (!ms) return;
            var icon = statusIcons[ms.status] || '?';
            var color = statusColors[ms.status] || '#64748b';
            var label = statusLabels[ms.status] || ms.status;
            var detail = '';
            if (ms.blocks && ms.blocks.length > 0) {
                var b = ms.blocks[0];
                detail = ' — ' + (conflictTypeLabels[b.status] || b.status);
                if (b.summary) detail += ': ' + b.summary;
            }
            // Role info
            var roleStr = '';
            var memberKey = null;
            if (typeof BAND_MEMBERS_ORDERED !== 'undefined') {
                BAND_MEMBERS_ORDERED.forEach(function(ref) {
                    var k = (typeof ref === 'object') ? ref.key : ref;
                    if (bm[k] && bm[k].name === member) { memberKey = k; roleStr = bm[k].role || ''; }
                });
            }
            html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.82em;border-bottom:1px solid rgba(255,255,255,0.04)">'
                + '<span style="color:' + color + '">' + icon + '</span>'
                + '<span style="font-weight:600;color:var(--text)">' + member.split(' ')[0] + '</span>'
                + (roleStr ? '<span style="font-size:0.78em;color:var(--text-muted)">' + roleStr + '</span>' : '')
                + '<span style="margin-left:auto;font-size:0.78em;color:' + color + '">' + label + detail + '</span>'
                + '</div>';
        });
        html += '</div>';
    }

    // Reasons summary
    if (strength && strength.reasons && strength.reasons.length > 0 && strength.label !== 'Strong') {
        html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:10px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:4px">';
        strength.reasons.forEach(function(r) { html += '<div>· ' + r + '</div>'; });
        html += '</div>';
    }

    // Role gap display
    if (strength && (strength.missingCritical && strength.missingCritical.length > 0 || strength.softCritical && strength.softCritical.length > 0)) {
        html += '<div style="margin-bottom:8px;padding:6px 8px;border-radius:6px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15)">';
        if (strength.missingCritical && strength.missingCritical.length > 0) {
            html += '<div style="font-size:0.78em;color:#fca5a5;font-weight:600">🔴 Missing critical roles: ' + strength.missingCritical.join(', ') + '</div>';
        }
        if (strength.missingNonCritical && strength.missingNonCritical.length > 0) {
            html += '<div style="font-size:0.72em;color:#fcd34d;margin-top:2px">🟡 Missing: ' + strength.missingNonCritical.join(', ') + '</div>';
        }
        if (strength.softCritical && strength.softCritical.length > 0) {
            html += '<div style="font-size:0.72em;color:#fcd34d;margin-top:2px">❓ Uncertain critical: ' + strength.softCritical.join(', ') + '</div>';
        }
        html += '</div>';
    }

    // Coaching
    if (strength) {
        if (strength.label === 'Strong') {
            html += '<div style="font-size:0.78em;color:#22c55e;font-weight:600;margin-bottom:8px">Great day for rehearsal — all roles covered.</div>';
        } else if (strength.label === 'Workable' && (!strength.missingCritical || strength.missingCritical.length === 0)) {
            html += '<div style="font-size:0.78em;color:#84cc16;margin-bottom:8px">Workable — soft conflicts may clear. All critical roles covered.</div>';
        } else if (strength.label === 'Workable') {
            html += '<div style="font-size:0.78em;color:#f59e0b;margin-bottom:8px">Workable — but check role coverage before committing.</div>';
        } else if (strength.label === 'Risky' && strength.missingCritical && strength.missingCritical.length > 0) {
            html += '<div style="font-size:0.78em;color:#ef4444;margin-bottom:8px">Risky — critical role' + (strength.missingCritical.length > 1 ? 's' : '') + ' missing. Consider backup or alternative date.</div>';
        } else if (strength.label === 'Risky') {
            html += '<div style="font-size:0.78em;color:#ef4444;margin-bottom:8px">Risky — multiple conflicts. Consider an alternative date.</div>';
        } else {
            html += '<div style="font-size:0.78em;color:#64748b;margin-bottom:8px">Not viable — too many conflicts for a productive rehearsal.</div>';
        }
    }

    // Find better days (show top 3 Strong or Workable within the matrix range)
    if (strength && strength.label !== 'Strong') {
        var betterDays = [];
        var _matrixEl = document.getElementById('calAvailabilityMatrix');
        // Scan from cached dayAvail if available — simple: suggest from matrix data
        html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:8px">Check the matrix above for Strong (✔) or Workable (~) days.</div>';
    }

    // Actions
    var _pd = glParseDate(dateStr);
    var _clickArgs = _pd ? _pd.getFullYear() + ',' + _pd.getMonth() + ',' + _pd.getDate() : '';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<button onclick="calDayClick(' + _clickArgs + ')" style="font-size:0.78em;padding:6px 14px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;cursor:pointer;font-weight:600">+ Schedule Event</button>'
        + '<button onclick="document.getElementById(\'calConflictResolver\').style.display=\'none\'" style="font-size:0.78em;padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer">Close</button>'
        + '</div>';

    html += '</div>';
    el.innerHTML = html;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    const showLocation = (ev.type || 'rehearsal') === 'rehearsal';
    var repeatVal = _calRepeatRuleToValue(ev.repeatRule);
    window._calEditEventId = isEdit ? (ev.id || null) : null;
    var isRecurringEdit = isEdit && ev.repeatRule && ev.repeatRule.frequency;
    var _titlePlaceholder = (ev.type === 'gig') ? 'e.g. HighTower Drinks' : 'e.g. DeadCetera Rehearsal';
    // Load saved rehearsal locations
    var rehLocs = [];
    try { rehLocs = await GLStore.getRehearsalLocations(); } catch(e) {}
    var _locOpts = rehLocs.map(function(l) {
        return '<option value="' + (l.locationId||'') + '"' + (ev.locationId === l.locationId ? ' selected' : '') + '>' + (l.isVirtual ? '\uD83D\uDCBB ' : '\uD83D\uDCCD ') + (l.name||'Untitled') + '</option>';
    }).join('');
    area.innerHTML = `<h3 style="margin-bottom:12px;font-size:0.95em">${isEdit?'\u270f\ufe0f Edit Event':'\u2795 Add Event'}</h3>
    ${isRecurringEdit ? '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:0.82em;color:var(--accent-light)">\uD83D\uDD04 Editing this recurring event updates all future occurrences.</div>' : ''}
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Type</label><select class="app-select" id="calType" onchange="calTypeChanged(this)">
            <option value="rehearsal" ${(ev.type||'rehearsal')==='rehearsal'?'selected':''}>\uD83C\uDFB8 Rehearsal</option>
            <option value="gig" ${ev.type==='gig'?'selected':''}>\uD83C\uDFA4 Gig</option>
            <option value="meeting" ${ev.type==='meeting'?'selected':''}>\uD83D\uDC65 Meeting</option>
            <option value="other" ${ev.type==='other'?'selected':''}>\uD83D\uDCCC Other</option>
            <option value="_conflict">\uD83D\uDEAB Conflict / Blocked</option>
        </select></div>
        <div class="form-row"><label class="form-label">Title</label><input class="app-input" id="calTitle" placeholder="${_titlePlaceholder}" value="${ev.title||''}"></div>
        <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="calDate" type="date" value="${date||ev.date||''}" style="color-scheme:dark"></div>
        <div class="form-row"><label class="form-label">Time</label><input class="app-input" id="calTime" type="time" value="${ev.time||''}" style="color-scheme:dark"></div>
        <div class="form-row calGigOnly" id="calVenueRow" style="${showVenue?'':'display:none'}">
            <label class="form-label">Venue</label>
            <div id="calVenuePicker"></div>
        </div>
        <div class="form-row calRehearsalOnly" id="calLocationRow" style="${showLocation?'':'display:none'}">
            <label class="form-label">Rehearsal Location</label>
            <select class="app-select" id="calLocationSelect" onchange="_calLocationChanged(this)">
                <option value="">-- Select Location --</option>
                ${_locOpts}
                <option value="_virtual">\uD83D\uDCBB Virtual</option>
                <option value="_new">+ Add New Location</option>
            </select>
            <div id="calNewLocForm" style="display:none;margin-top:6px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">
                <input class="app-input" id="calNewLocName" placeholder="Location name" style="margin-bottom:4px">
                <input class="app-input" id="calNewLocAddress" placeholder="Address (for directions)" style="margin-bottom:4px">
                <input class="app-input" id="calNewLocNotes" placeholder="Notes (optional)" style="margin-bottom:6px">
                <button onclick="_calSaveNewLocation()" style="font-size:0.78em;padding:4px 12px;border-radius:6px;border:none;background:rgba(34,197,94,0.12);color:#86efac;cursor:pointer;font-weight:600">Save Location</button>
            </div>
        </div>
        <div class="form-row" id="calVirtualRow" style="${ev.meetingLink?'':'display:none'}">
            <label class="form-label">Meeting Link</label>
            <input class="app-input" id="calMeetingLink" placeholder="Zoom, Google Meet, etc." value="${ev.meetingLink||''}">
        </div>
        <div class="form-row"><label class="form-label">Repeat</label><select class="app-select" id="calRepeat" onchange="var er=document.getElementById('calRepeatEndRow');if(er)er.style.display=this.value==='none'?'none':''">
            <option value="none" ${repeatVal==='none'?'selected':''}>None</option>
            <option value="weekly" ${repeatVal==='weekly'?'selected':''}>Weekly</option>
            <option value="biweekly" ${repeatVal==='biweekly'?'selected':''}>Every 2 Weeks</option>
            <option value="monthly" ${repeatVal==='monthly'?'selected':''}>Monthly</option>
        </select></div>
        <div class="form-row" id="calRepeatEndRow" style="${repeatVal==='none'?'display:none':''}">
            <label class="form-label">Ends</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <select class="app-select" id="calRepeatEndType" onchange="var dr=document.getElementById('calRepeatEndDate');var dc=document.getElementById('calRepeatEndCount');if(dr)dr.style.display=this.value==='date'?'':'none';if(dc)dc.style.display=this.value==='count'?'':'none'" style="flex:1;min-width:120px">
                    <option value="date" ${(ev.repeatRule&&ev.repeatRule.endsAt)?'selected':''}>On a date</option>
                    <option value="count" ${(ev.repeatRule&&ev.repeatRule.endsAfter)?'selected':''}>After # times</option>
                </select>
                <input class="app-input" id="calRepeatEndDate" type="date" value="${(ev.repeatRule&&ev.repeatRule.endsAt)||''}" style="flex:1;color-scheme:dark;${(ev.repeatRule&&ev.repeatRule.endsAfter)?'display:none':''}">
                <input class="app-input" id="calRepeatEndCount" type="number" min="2" max="52" value="${(ev.repeatRule&&ev.repeatRule.endsAfter)||'12'}" placeholder="# of times" style="flex:1;width:80px;${(ev.repeatRule&&ev.repeatRule.endsAfter)?'':'display:none'}">
            </div>
        </div>
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

// ── Inline availability ──────────────────────────────────────────────────────
window._calSetAvail = async function(eventId, date, status) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var memberKey = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
    if (!memberKey) { if (typeof showToast === 'function') showToast('Sign in first'); return; }
    var safeDateKey = (date || '').replace(/-/g, '');
    try {
        await db.ref(bandPath('event_availability/' + safeDateKey + '/' + memberKey)).set({
            status: status,
            respondedAt: new Date().toISOString(),
            eventId: eventId || null
        });
        if (typeof showToast === 'function') {
            var labels = { yes: '\u2705 You\u2019re in!', no: '\u274C Marked as out', maybe: '\u2753 Marked as maybe' };
            showToast(labels[status] || 'Response saved', 2000);
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('Could not save \u2014 check connection');
    }
};

// ── Set availability AND write to gig Drive data for display consistency ──────
window._calSetAvailAndRefresh = async function(date, status, eventId) {
    // Write to Firebase event_availability (canonical)
    // _calSetAvail signature: (eventId, date, status)
    await _calSetAvail(eventId, date, status);

    // Also write to gig Drive data so "Next Up" reads it back
    var memberKey = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
    if (memberKey) {
        try {
            var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
            var gig = gigs.find(function(g) { return g.date === date; });
            if (gig) {
                if (!gig.availability) gig.availability = {};
                gig.availability[memberKey] = { status: status, respondedAt: new Date().toISOString() };
                await saveBandDataToDrive('_band', 'gigs', gigs);
            }
        } catch(e) {
            console.warn('[Calendar] Gig availability sync failed:', e);
        }
    }

    // Refresh both Next Up cards and Upcoming Schedule list (slight delay for Firebase propagation)
    setTimeout(function() {
        _calRenderNextUp();
        loadCalendarEvents(); // re-renders the Upcoming Schedule list with fresh RSVP data
    }, 300);
};

// ── Rehearsal location handlers ──────────────────────────────────────────────
window._calLocationChanged = function(sel) {
    var newLocForm = document.getElementById('calNewLocForm');
    var virtualRow = document.getElementById('calVirtualRow');
    if (sel.value === '_new') {
        if (newLocForm) newLocForm.style.display = '';
        if (virtualRow) virtualRow.style.display = 'none';
    } else if (sel.value === '_virtual') {
        if (newLocForm) newLocForm.style.display = 'none';
        if (virtualRow) virtualRow.style.display = '';
    } else {
        if (newLocForm) newLocForm.style.display = 'none';
        // Show virtual row if selected location has a meeting link
        GLStore.getRehearsalLocations().then(function(locs) {
            var loc = locs.find(function(l) { return l.locationId === sel.value; });
            if (loc && loc.meetingLink && virtualRow) {
                document.getElementById('calMeetingLink').value = loc.meetingLink;
                virtualRow.style.display = '';
            } else if (virtualRow) {
                virtualRow.style.display = 'none';
            }
        });
    }
};

window._calSaveNewLocation = async function() {
    var name = (document.getElementById('calNewLocName') || {}).value || '';
    var address = (document.getElementById('calNewLocAddress') || {}).value || '';
    var notes = (document.getElementById('calNewLocNotes') || {}).value || '';
    if (!name.trim()) { if (typeof showToast === 'function') showToast('Location name required'); return; }
    var loc = await GLStore.createRehearsalLocation({ name: name, address: address, notes: notes });
    if (typeof showToast === 'function') showToast('\u2705 Location saved');
    // Add to dropdown and select it
    var sel = document.getElementById('calLocationSelect');
    if (sel) {
        var opt = document.createElement('option');
        opt.value = loc.locationId;
        opt.textContent = '\uD83D\uDCCD ' + loc.name;
        opt.selected = true;
        sel.insertBefore(opt, sel.querySelector('[value="_virtual"]'));
    }
    var newLocForm = document.getElementById('calNewLocForm');
    if (newLocForm) newLocForm.style.display = 'none';
};

function calTypeChanged(sel) {
    // If user selects "Conflict / Blocked", switch to the conflict form
    if (sel.value === '_conflict') {
        var dateVal = (document.getElementById('calDate') || {}).value || '';
        calBlockDates();
        if (dateVal) {
            setTimeout(function() {
                var s = document.getElementById('blockStart'); if (s) s.value = dateVal;
                var e = document.getElementById('blockEnd'); if (e) e.value = dateVal;
            }, 50);
        }
        return;
    }
    var slRow = document.getElementById('calSetlistRow');
    var vRow  = document.getElementById('calVenueRow');
    var locRow = document.getElementById('calLocationRow');
    var virtualRow = document.getElementById('calVirtualRow');
    var titleInput = document.getElementById('calTitle');
    var isGig = sel.value === 'gig';
    var isRehearsal = sel.value === 'rehearsal';
    if (slRow) slRow.style.display = isGig ? '' : 'none';
    if (vRow)  vRow.style.display  = isGig ? '' : 'none';
    if (locRow) locRow.style.display = isRehearsal ? '' : 'none';
    if (virtualRow && !isRehearsal) virtualRow.style.display = 'none';
    // Update title placeholder
    if (titleInput) titleInput.placeholder = isGig ? 'e.g. HighTower Drinks' : isRehearsal ? 'e.g. DeadCetera Rehearsal' : 'e.g. Band meeting';
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
        locationId: null,
        location: null,
        locationAddress: null,
        meetingLink: (document.getElementById('calMeetingLink') || {}).value || null,
    };
    // Resolve rehearsal location from dropdown
    var _locSel = (document.getElementById('calLocationSelect') || {}).value || '';
    if (_locSel && _locSel !== '_new' && _locSel !== '_virtual') {
        ev.locationId = _locSel;
        try {
            var _locs = await GLStore.getRehearsalLocations();
            var _loc = _locs.find(function(l) { return l.locationId === _locSel; });
            if (_loc) {
                ev.location = _loc.name;
                ev.locationAddress = _loc.address || null;
                if (_loc.meetingLink) ev.meetingLink = ev.meetingLink || _loc.meetingLink;
            }
        } catch(e) {}
    } else if (_locSel === '_virtual') {
        ev.location = 'Virtual';
        ev.locationId = null;
    }
    // Recurrence rule
    var repeatVal = (document.getElementById('calRepeat') || {}).value || 'none';
    var _repeatEndType = (document.getElementById('calRepeatEndType') || {}).value || 'date';
    var _repeatEndDate = (document.getElementById('calRepeatEndDate') || {}).value || null;
    var _repeatEndCount = parseInt((document.getElementById('calRepeatEndCount') || {}).value) || null;
    var _endsAt = (_repeatEndType === 'date') ? _repeatEndDate : null;
    var _endsAfter = (_repeatEndType === 'count') ? _repeatEndCount : null;
    // Auto-compute endsAt from count if date not provided
    if (_endsAfter && !_endsAt && ev.date && repeatVal !== 'none') {
        var _interval = repeatVal === 'biweekly' ? 14 : repeatVal === 'monthly' ? 30 : 7;
        var _endDate = new Date(ev.date + 'T12:00:00');
        _endDate.setDate(_endDate.getDate() + (_interval * _endsAfter));
        _endsAt = _endDate.toISOString().split('T')[0];
    }
    if (repeatVal === 'weekly') ev.repeatRule = { frequency: 'weekly', interval: 1, endsAt: _endsAt, endsAfter: _endsAfter };
    else if (repeatVal === 'biweekly') ev.repeatRule = { frequency: 'weekly', interval: 2, endsAt: _endsAt, endsAfter: _endsAfter };
    else if (repeatVal === 'monthly') ev.repeatRule = { frequency: 'monthly', interval: 1, endsAt: _endsAt, endsAfter: _endsAfter };
    else ev.repeatRule = null;
    if (!ev.date || !ev.title) { alert('Date and title required'); return; }
    var dateErr = _calValidateDate(ev.date, 'Event date');
    if (dateErr) { alert(dateErr); return; }
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
    renderCalendarInner(); // re-render full grid + events list
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
