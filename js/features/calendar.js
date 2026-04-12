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
    // Inject premium page styles (once)
    if (!document.getElementById('cal-page-styles')) {
        var _ps = document.createElement('style');
        _ps.id = 'cal-page-styles';
        _ps.textContent =
            // Page-level reset — clean, open feel
            '#page-schedule .page-header h1{font-size:1.05em;font-weight:800;letter-spacing:-0.02em;margin-bottom:2px;color:var(--text)}'
            + '#page-schedule .page-header p{display:none}'
            + '#page-schedule .app-card{border:none;background:rgba(255,255,255,0.01);border-radius:10px}'
            // Section labels — understated
            + '.cal-section-label{font-size:0.65em;font-weight:700;color:rgba(148,163,184,0.8);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px}'
            // Next Up — minimal cards with hover depth
            + '.cal-next-card{padding:12px 14px;margin-bottom:6px;border-radius:10px;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.03);transition:all 0.15s}'
            + '.cal-next-card:hover{background:rgba(255,255,255,0.035);border-color:rgba(255,255,255,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.15)}'
            // Pill buttons
            + '.cal-action-btn{padding:6px 14px;border-radius:20px;font-size:0.72em;font-weight:600;cursor:pointer;transition:all 0.12s;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);font-family:inherit}'
            + '.cal-action-btn:hover{background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);box-shadow:0 1px 4px rgba(0,0,0,0.1)}'
            + '.cal-action-primary{background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:none;font-weight:700}'
            + '.cal-action-primary:hover{box-shadow:0 2px 12px rgba(34,197,94,0.2);transform:translateY(-1px)}'
            + '.cal-action-primary:active{transform:scale(0.98)}'
            // Calendar grid
            + '#calGrid{font-size:0.82em}'
            + '#calGrid>div>div{border-radius:8px;transition:box-shadow 0.1s}'
            + '#calGrid>div>div:hover{box-shadow:0 2px 8px rgba(0,0,0,0.2)}'
            // Collapsed sections
            + '#calendarInner details summary{border:none;background:transparent;padding:8px 0;transition:color 0.12s}'
            + '#calendarInner details summary:hover{color:var(--text)}'
            + '#calendarInner .app-card{border:none;background:transparent}'
            // Sync badges
            + '.cal-sync-badge{font-size:0.62em;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s}'
            ;
        document.head.appendChild(_ps);
    }

    el.innerHTML = '<div class="gl-page">'
        + '<div class="gl-page-title">\uD83D\uDCC5 Schedule</div>'
        + '<div id="calEventStrip" style="margin-bottom:12px"></div>'
        + '<div class="gl-page-split cal-page-split">'
        + '<div class="gl-page-primary">'
        + '<div id="calendarInner"></div>'
        + '</div>'
        + '<div class="gl-page-context" id="calContextRail"></div>'
        + '</div>'
        // Full-width conflict panel below calendar (toggled by View conflicts)
        + '<div id="calConflictPanel" style="display:none;margin-top:var(--gl-space-md)"></div>'
        + '</div>';
    _calRenderEventStrip();
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

    // Use the unified spacing-aware recommendation engine
    if (typeof GLStore === 'undefined' || !GLStore.getRehearsalDateRecommendations) { el.innerHTML = ''; return; }

    // Show loading shell immediately
    el.innerHTML = '<div style="padding:20px;margin-bottom:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.015);text-align:center">'
        + '<div style="font-size:0.72em;color:var(--text-dim)">Finding the best date\u2026</div></div>';

    var recs;
    try {
        // Wait for band members to load before asking for recommendations
        await GLStore.ready(['members'], 15000);
        var _heroPromise = GLStore.getRehearsalDateRecommendations();
        var _heroTimeout = new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 3000); });
        recs = await Promise.race([_heroPromise, _heroTimeout]);
    } catch(e) {
        // Timeout — still give direction, never dead-end
        el.innerHTML = '<div style="padding:16px 20px;margin-bottom:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.015)">'
            + '<div style="font-size:0.82em;font-weight:700;color:var(--text);margin-bottom:4px">Pick a date from the calendar below</div>'
            + '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:8px">We couldn\u2019t load scheduling data right now \u2014 tap any date to schedule.</div>'
            + '<button class="cal-action-btn cal-action-primary" onclick="calAddEvent()">Schedule Rehearsal</button>'
            + '</div>';
        return;
    }
    if (!recs || !recs.primary) {
        // No ideal date — show the best available or guide to calendar
        var _fallbackAlts = recs && recs.allCandidates ? recs.allCandidates.filter(function(c) { return c.availability && c.availability.label !== 'Not viable'; }).slice(0, 3) : [];
        var _fallbackHtml = '<div style="padding:16px 20px;margin-bottom:20px;border-radius:16px;border:1px solid rgba(255,255,255,0.04);background:rgba(255,255,255,0.015)">'
            + '<div style="font-size:0.82em;font-weight:700;color:var(--text);margin-bottom:4px">No standout date this round</div>'
            + '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:8px">Every date has a conflict or is too close to an existing rehearsal.</div>';
        if (_fallbackAlts.length) {
            _fallbackHtml += '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:6px">Best available:</div>';
            _fallbackAlts.forEach(function(a) {
                var aDate = new Date(a.date + 'T12:00:00');
                var aLabel = aDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                var _aSafe = a.date.replace(/'/g, "\\'");
                _fallbackHtml += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0">'
                    + '<span style="font-size:0.75em;color:var(--text)">' + aLabel + '</span>'
                    + '<span style="font-size:0.58em;color:' + a.color + '">' + a.label + '</span>'
                    + '<button onclick="_calLockAndPlan(\'' + _aSafe + '\')" class="cal-action-btn" style="margin-left:auto;font-size:0.65em;padding:3px 10px">Use This</button>'
                    + '</div>';
            });
        }
        _fallbackHtml += '<button class="cal-action-btn cal-action-primary" onclick="calAddEvent()" style="margin-top:8px;width:100%">Pick a Different Date</button></div>';
        el.innerHTML = _fallbackHtml;
        return;
    }

    var p = recs.primary;
    var pDate = new Date(p.date + 'T12:00:00');
    var pLabel = pDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    var _bdSafe = p.date.replace(/'/g, "\\'");

    // Build reason lines
    var reasonHtml = '';
    p.reasons.slice(0, 3).forEach(function(r) {
        var icon = '\u2022';
        if (r.match(/free/i)) icon = '\u2705';
        else if (r.match(/available/i)) icon = '\uD83D\uDC65';
        else if (r.match(/usual schedule/i)) icon = '\uD83D\uDC4D';
        else if (r.match(/gig/i)) icon = '\uD83C\uDFB8';
        else if (r.match(/typical|matches/i)) icon = '\uD83D\uDCC5';
        else if (r.match(/been|days since/i)) icon = '\u23F3';
        reasonHtml += '<div style="font-size:0.72em;color:var(--text-dim);line-height:1.5">' + icon + ' ' + (typeof escHtml === 'function' ? escHtml(r) : r) + '</div>';
    });

    // Alternatives
    var altsHtml = '';
    if (recs.alternatives.length) {
        altsHtml = '<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.04);padding-top:8px">';
        recs.alternatives.forEach(function(a) {
            var aDate = new Date(a.date + 'T12:00:00');
            var aLabel = aDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            var aReason = a.reasons.length ? a.reasons[0] : (a.availability.available + '/' + a.availability.total + ' free');
            var _aSafe = a.date.replace(/'/g, "\\'");
            altsHtml += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0">'
                + '<span style="flex:1;font-size:0.78em;color:var(--text)">' + aLabel + '</span>'
                + '<span style="font-size:0.58em;color:var(--text-dim)">' + (typeof escHtml === 'function' ? escHtml(aReason) : aReason) + '</span>'
                + '<button onclick="_calLockAndPlan(\'' + _aSafe + '\')" style="font-size:0.68em;padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer">Use This</button>'
                + '</div>';
        });
        altsHtml += '</div>';
    }

    // Skipped dates note
    var skipHtml = '';
    if (recs.tooClose.length > 0) {
        skipHtml = '<div style="font-size:0.62em;color:#f59e0b;margin-top:6px">'
            + recs.tooClose.length + ' date' + (recs.tooClose.length > 1 ? 's' : '') + ' too close to existing rehearsal</div>';
    }

    // Google Calendar button
    var gcalHtml = '';
    if (typeof calBuildRehearsalGoogleLink === 'function') {
        gcalHtml = '<button onclick="_calGcalFromHero(\'' + _bdSafe + '\')" style="margin-top:8px;width:100%;padding:8px;border-radius:6px;border:1px solid rgba(66,133,244,0.25);background:rgba(66,133,244,0.06);color:#4285f4;cursor:pointer;font-size:0.72em;font-weight:600;font-family:inherit;min-height:34px">\uD83D\uDCC5 Add to Google Calendar</button>';
    }

    // Momentum
    var momHtml = '';
    if (recs.momentum && recs.momentum.label) {
        var mColor = recs.momentum.type === 'streak' ? '#22c55e' : '#f59e0b';
        momHtml = '<div style="font-size:0.68em;color:' + mColor + ';font-weight:600;margin-bottom:6px">' + recs.momentum.label + '</div>';
    }

    // Task 1: Confident header with "here's why"
    var confLabel = p.score >= 70 ? 'This is your best next rehearsal \u2014 here\u2019s why' : 'Good option for the band';

    // Stats as justification — phrased as evidence
    var statsHtml = '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.72em;color:var(--text-dim);margin:6px 0 8px">';
    if (p.availability) {
        var _pct = Math.round((p.availability.available / Math.max(1, p.availability.total)) * 100);
        statsHtml += '<span>\uD83D\uDC65 ' + _pct + '% available</span>';
    }
    if (p.spacingDays !== null) statsHtml += '<span>\uD83D\uDCC5 ' + p.spacingDays + ' days since last</span>';
    if (recs.nextGigDate) {
        var _gDays = Math.round((new Date(recs.nextGigDate + 'T12:00:00') - new Date(p.date + 'T12:00:00')) / 86400000);
        if (_gDays > 0 && _gDays <= 30) statsHtml += '<span>\uD83C\uDFB8 ' + _gDays + ' days to gig</span>';
    }
    statsHtml += '</div>';

    // Task 4: Plan intelligence with light reasoning
    var planHtml = '';
    var focusSongs = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
    if (focusSongs.list.length > 0) {
        var _topSong = focusSongs.list[0];
        var _topTitle = _topSong.title;
        var _topReason = '';
        if (_topSong.reasons && _topSong.reasons.length) {
            // Use first reason as parenthetical context
            var _r = _topSong.reasons[0];
            if (_r.match(/readiness|low/i)) _topReason = 'needs work';
            else if (_r.match(/transition/i)) _topReason = 'transitions';
            else if (_r.match(/setlist/i)) _topReason = 'in the setlist';
            else if (_r.match(/critical/i)) _topReason = 'critical';
        }
        var _more = focusSongs.list.length - 1;
        var _esc = typeof escHtml === 'function' ? escHtml : function(s) { return s; };
        planHtml = '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:8px;padding:5px 8px;border-radius:4px;background:rgba(99,102,241,0.04)">'
            + '\uD83C\uDFAF Focus: <strong style="color:var(--text)">' + _esc(_topTitle) + '</strong>'
            + (_topReason ? ' <span style="color:var(--text-dim);font-size:0.9em">(' + _topReason + ')</span>' : '')
            + (_more > 0 ? ' + ' + _more + ' more' : '') + '</div>';
    } else if (recs.nextGigDate) {
        planHtml = '<div style="font-size:0.68em;color:var(--text-dim);margin-bottom:8px;padding:5px 8px;border-radius:4px;background:rgba(99,102,241,0.04)">'
            + '\uD83C\uDFAF We\u2019ll build this around your weakest songs before the gig</div>';
    }

    // Google Calendar sync state — check actual sync status on existing events
    var gcalStateHtml = '';
    var _calEvts = [];
    try { _calEvts = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []); } catch(e) {}
    var _matchedEvent = _calEvts.find(function(e) { return e.type === 'rehearsal' && e.date === p.date; });

    if (_matchedEvent && _matchedEvent.sync && _matchedEvent.sync.status === 'synced') {
        var _link = _matchedEvent.sync.htmlLink;
        gcalStateHtml = '<div style="margin-top:6px;padding:5px 8px;border-radius:6px;background:rgba(34,197,94,0.04);display:flex;align-items:center;gap:6px">'
            + '<span style="font-size:0.65em;color:#22c55e">\u2705 Synced with Google Calendar</span>'
            + (_link ? '<a href="' + _link + '" target="_blank" style="margin-left:auto;font-size:0.6em;color:#4285f4;text-decoration:underline">Open</a>' : '')
            + '</div>';
    } else if (_matchedEvent && _matchedEvent.sync && _matchedEvent.sync.status === 'needs_update') {
        gcalStateHtml = '<div style="margin-top:6px;padding:5px 8px;border-radius:6px;background:rgba(245,158,11,0.04);display:flex;align-items:center;gap:6px">'
            + '<span style="font-size:0.65em;color:#f59e0b">\u26A0 Date changed \u2014 </span>'
            + '<button onclick="_calSyncUpdateHero(\'' + _bdSafe + '\')" style="background:none;border:none;color:#4285f4;cursor:pointer;font-size:0.65em;font-weight:600;padding:0;text-decoration:underline">update calendar</button>'
            + '</div>';
    } else if (_matchedEvent && _matchedEvent.sync && _matchedEvent.sync.status === 'error') {
        gcalStateHtml = '<div style="margin-top:6px;padding:5px 8px;border-radius:6px;background:rgba(239,68,68,0.04);display:flex;align-items:center;gap:6px">'
            + '<span style="font-size:0.65em;color:#ef4444">\u274C Sync failed \u2014 </span>'
            + '<button onclick="_calSyncUpdateHero(\'' + _bdSafe + '\')" style="background:none;border:none;color:#4285f4;cursor:pointer;font-size:0.65em;font-weight:600;padding:0;text-decoration:underline">Retry</button>'
            + '</div>';
    } else {
        // Not synced or no event yet — will sync on Lock In
        gcalStateHtml = '<div style="margin-top:6px;font-size:0.58em;color:var(--text-dim);text-align:center">\uD83D\uDCC5 Will add to Google Calendar when locked in</div>';
    }

    // Task 3: Alternative access — subtle link, no second system
    var altLinkHtml = '';
    if (recs.alternatives.length > 0) {
        altLinkHtml = '<div style="text-align:center;margin-top:6px"><span onclick="var d=document.getElementById(\'calHeroAlts\');if(d)d.open=!d.open" style="font-size:0.6em;color:var(--text-dim);cursor:pointer;text-decoration:underline dotted">See other options</span></div>';
    }

    // Inject micro-interaction CSS (once)
    if (!document.getElementById('cal-hero-styles')) {
        var _hs = document.createElement('style');
        _hs.id = 'cal-hero-styles';
        _hs.textContent = '.cal-hero{transition:box-shadow 0.2s,transform 0.2s}'
            + '.cal-hero:hover{box-shadow:0 8px 32px rgba(34,197,94,0.12)}'
            + '.cal-lock-btn{transition:all 0.2s ease}'
            + '.cal-lock-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(34,197,94,0.25)}'
            + '.cal-lock-btn:active{transform:scale(0.98)}'
            + '.cal-lock-btn.loading{opacity:0.7;pointer-events:none}'
            + '@keyframes calSuccessPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}100%{box-shadow:none}}'
            + '.cal-hero-success{animation:calSuccessPulse 1.2s ease-out;border-color:#22c55e!important}'
            + '@keyframes calFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}'
            + '.cal-fade-in{animation:calFadeIn 0.3s ease forwards}'
            + '.cal-fade-delay-1{animation-delay:0.15s;opacity:0}'
            + '.cal-fade-delay-2{animation-delay:0.3s;opacity:0}'
            + '.cal-fade-delay-3{animation-delay:0.5s;opacity:0}'
            + '#calAvailabilityMatrix td{transition:opacity 0.12s}'
            + '#calAvailabilityMatrix tr:hover td{opacity:0.85}'
            + '#calAvailabilityMatrix td:hover{opacity:1!important}';
        document.head.appendChild(_hs);
    }

    // "Why others don't" — build from tooClose + alternatives with issues
    var whyNotHtml = '';
    if (recs.tooClose.length > 0 || recs.alternatives.some(function(a) { return a.offPatternNotes && a.offPatternNotes.length; })) {
        var whyNotItems = [];
        recs.tooClose.slice(0, 2).forEach(function(c) {
            var d = new Date(c.date + 'T12:00:00');
            var label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            whyNotItems.push(label + ' \u2014 ' + (c.penalties && c.penalties[0] ? c.penalties[0].toLowerCase() : 'too close'));
        });
        if (whyNotItems.length) {
            whyNotHtml = '<details style="margin-top:4px"><summary style="font-size:0.58em;color:var(--text-dim);cursor:pointer;list-style:none;text-decoration:underline dotted">Why not other dates?</summary>'
                + '<div style="padding:4px 0;font-size:0.58em;color:var(--text-dim)">';
            whyNotItems.forEach(function(item) { whyNotHtml += '<div style="padding:1px 0">\u274C ' + item + '</div>'; });
            whyNotHtml += '</div></details>';
        }
    }

    el.innerHTML = '<div id="calHeroCard" class="cal-hero" style="padding:22px 20px;margin-bottom:20px;border-radius:16px;border:1px solid rgba(34,197,94,0.15);background:linear-gradient(165deg,rgba(34,197,94,0.03) 0%,rgba(15,23,42,0.98) 40%,rgba(99,102,241,0.02) 100%);backdrop-filter:blur(8px)">'
        + momHtml
        + '<div style="font-size:0.58em;font-weight:700;color:#22c55e;letter-spacing:0.02em;margin-bottom:6px">' + confLabel + '</div>'
        + '<div style="font-size:1.35em;font-weight:900;color:var(--text);margin-bottom:4px;letter-spacing:-0.02em;line-height:1.1">' + pLabel + '</div>'
        + statsHtml
        + planHtml
        // "Why this works" expandable
        + '<details style="margin-bottom:8px"><summary style="font-size:0.6em;color:var(--text-dim);cursor:pointer;list-style:none;text-decoration:underline dotted">Why this works</summary>'
        + '<div style="padding:4px 0">' + reasonHtml + '</div></details>'
        + whyNotHtml
        // Confidence signal
        + (p.score >= 75 ? '<div style="font-size:0.58em;font-weight:700;color:#22c55e;margin-bottom:6px;display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e"></span> High confidence</div>'
          : p.score >= 55 ? '<div style="font-size:0.58em;font-weight:700;color:#84cc16;margin-bottom:6px;display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#84cc16"></span> Good option</div>' : '')
        // Lock In button
        + '<button id="calLockBtn" class="cal-lock-btn" onclick="_calLockAndPlan(\'' + _bdSafe + '\')" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.9em;cursor:pointer;min-height:48px;margin-top:4px;letter-spacing:0.01em">Lock In + Build Plan</button>'
        // Decision reinforcement
        + '<div style="font-size:0.52em;color:var(--text-dim);text-align:center;margin-top:4px;line-height:1.4">Best option based on availability, cadence, and timing</div>'
        // Sync state (always visible)
        + gcalStateHtml
        + altLinkHtml
        + (recs.alternatives.length > 0 ? '<details id="calHeroAlts" style="margin-top:4px">' + altsHtml.replace('<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.04);padding-top:8px">', '<div>') + '</details>' : '')
        + '</div>';
}

// Inline success morph — transforms hero without full re-render
function _calShowHeroSuccess(dateFmt, htmlLink) {
    var hero = document.getElementById('calHeroCard');
    if (!hero) { if (typeof showToast === 'function') showToast('\u2705 Locked for ' + dateFmt); return; }
    hero.classList.add('cal-hero-success');
    hero.style.borderColor = '#22c55e';
    hero.innerHTML = '<div style="text-align:center;padding:20px 0">'
        // Line 1: emoji + headline (immediate)
        + '<div class="cal-fade-in" style="font-size:1.6em;margin-bottom:6px">\uD83C\uDFB8</div>'
        + '<div class="cal-fade-in" style="font-size:1.05em;font-weight:800;color:var(--text);margin-bottom:2px">Rehearsal locked</div>'
        // Line 2: date/time (slight delay)
        + '<div class="cal-fade-in cal-fade-delay-1" style="font-size:0.82em;color:var(--text-dim);margin-bottom:10px">' + dateFmt + ' \u00B7 7 PM</div>'
        // Line 3: sync confirmation (more delay)
        + '<div class="cal-fade-in cal-fade-delay-2" style="font-size:0.72em;color:#22c55e;font-weight:600;margin-bottom:4px">\uD83D\uDCC5 Synced with Google Calendar</div>'
        + '<div class="cal-fade-in cal-fade-delay-2" style="font-size:0.62em;color:var(--text-dim);margin-bottom:10px">Band has been invited</div>'
        // Line 4: action link (most delay)
        + (htmlLink ? '<div class="cal-fade-in cal-fade-delay-3"><a href="' + htmlLink + '" target="_blank" style="font-size:0.68em;color:#4285f4;text-decoration:underline">Open event</a></div>' : '')
        + '<div class="cal-fade-in cal-fade-delay-3" style="font-size:0.55em;color:var(--text-dim);margin-top:12px">Opening rehearsal planner\u2026</div>'
        + '</div>';
}

// Sync update from hero card — retries failed or stale syncs
window._calSyncUpdateHero = async function(dateStr) {
    if (typeof GLCalendarSync === 'undefined') return;
    try {
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var idx = events.findIndex(function(e) { return e.type === 'rehearsal' && e.date === dateStr; });
        if (idx === -1 || !events[idx].sync || !events[idx].sync.externalEventId) return;
        var result = await GLCalendarSync.update(events[idx].sync.externalEventId, events[idx]);
        if (result.success) {
            events[idx].sync.status = 'synced';
            events[idx].sync.lastSyncedAt = result.lastSyncedAt;
            events[idx].sync.etag = result.etag;
            await saveBandDataToDrive('_band', 'calendar_events', events);
            if (typeof showToast === 'function') showToast('\u2705 Google Calendar updated');
            _calRenderBestRehearsalHero(); // re-render to show synced state
        } else {
            events[idx].sync.status = 'error';
            await saveBandDataToDrive('_band', 'calendar_events', events);
            if (typeof showToast === 'function') showToast('\u274C Update failed \u2014 try again later');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('\u274C Update failed');
    }
};

// ── Lock rehearsal + create plan + navigate ──────────────────────────────────
window._calLockAndPlan = async function(dateStr) {
    var _dateFmt = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Immediate loading feedback (<300ms perception)
    var lockBtn = document.getElementById('calLockBtn');
    if (lockBtn) { lockBtn.classList.add('loading'); lockBtn.textContent = 'Locking in\u2026'; }

    // 1. Create GrooveLinx event
    var eventIndex = -1;
    var glEvent = null;
    try {
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var existing = events.find(function(e) { return e.type === 'rehearsal' && e.date === dateStr; });
        if (!existing) {
            glEvent = {
                id: 'ev_' + Date.now().toString(36),
                type: 'rehearsal',
                title: 'Band Rehearsal',
                date: dateStr,
                time: '19:00',
                notes: '',
                created: new Date().toISOString()
            };
            events.push(glEvent);
            eventIndex = events.length - 1;
            await saveBandDataToDrive('_band', 'calendar_events', events);
        } else {
            glEvent = existing;
            eventIndex = events.indexOf(existing);
        }
    } catch(e) {
        console.warn('[Calendar] Failed to create event:', e);
    }

    // 2. Auto-sync to Google Calendar
    if (glEvent && typeof GLCalendarSync !== 'undefined') {
        var focusSongs = (typeof GLStore !== 'undefined' && GLStore.getNowFocus) ? GLStore.getNowFocus() : { list: [] };
        var planSummary = focusSongs.list.length ? 'Focus: ' + focusSongs.list.slice(0, 3).map(function(s) { return s.title; }).join(', ') : '';
        var syncResult = await GLCalendarSync.create(glEvent, { planSummary: planSummary });
        if (syncResult.success) {
            await GLCalendarSync.saveSyncState(eventIndex, syncResult.sync);
            // Inline success morph — no full re-render
            _calShowHeroSuccess(_dateFmt, syncResult.sync.htmlLink);
        } else if (syncResult.fallback && syncResult.opened) {
            if (typeof showToast === 'function') showToast('\u2705 Locked for ' + _dateFmt + ' \u2014 finish adding in Google Calendar');
        } else {
            if (typeof showToast === 'function') showToast('\u2705 Locked for ' + _dateFmt);
        }
    } else {
        if (typeof showToast === 'function') showToast('\u2705 Locked for ' + _dateFmt);
    }

    // 3. Navigate to rehearsal planner
    window.practicePlanActiveDate = dateStr;
    showPage('rehearsal');
};

// ── "Next Up" section — upcoming rehearsal + gig with availability/readiness ──
// ── Compact event strip — replaces stacked Next Up + Hero cards ──────────────
async function _calRenderEventStrip() {
    var el = document.getElementById('calEventStrip');
    if (!el) return;
    var today = new Date().toISOString().split('T')[0];
    var events = [];
    try { events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []); } catch(e) {}
    var futureEnd = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
    var expanded = expandRecurringEvents(events, today, futureEnd);
    var upcoming = expanded.filter(function(e) { return (e.date || '') >= today; }).sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); });
    var nextRehearsal = upcoming.find(function(e) { return e.type === 'rehearsal'; }) || null;
    var nextGig = upcoming.find(function(e) { return e.type === 'gig'; }) || null;

    var html = '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:stretch">';
    [nextRehearsal, nextGig].forEach(function(ev) {
        if (!ev) return;
        var icon = ev.type === 'rehearsal' ? '\uD83C\uDFB8' : '\uD83C\uDFA4';
        var daysAway = (typeof glDaysAway === 'function') ? glDaysAway(ev.date) : null;
        var daysLabel = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : (daysAway !== null ? daysAway + 'd' : '');
        var dateFmt = (typeof glFormatDate === 'function') ? glFormatDate(ev.date, true) : ev.date;
        var urgColor = daysAway !== null && daysAway <= 2 ? '#fbbf24' : 'var(--text-muted)';
        var onclick = ev.type === 'rehearsal' ? "practicePlanActiveDate='" + ev.date + "';showPage('rehearsal')" : "showPage('setlists')";
        html += '<div onclick="' + onclick + '" style="flex:1;min-width:140px;padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.02);cursor:pointer;transition:background 0.12s" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.02)\'">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span>' + icon + '</span><span style="font-size:0.82em;font-weight:700;color:var(--text)">' + (ev.title || (ev.type === 'rehearsal' ? 'Rehearsal' : 'Gig')) + '</span></div>';
        html += '<div style="font-size:0.72em;color:' + urgColor + '">' + dateFmt + (daysLabel ? ' \u00B7 ' + daysLabel : '') + '</div>';
        html += '</div>';
    });
    if (!nextRehearsal) {
        html += '<div onclick="calAddEvent()" style="flex:1;min-width:140px;padding:10px 14px;border-radius:8px;border:1px dashed rgba(255,255,255,0.08);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:background 0.12s" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'none\'">';
        html += '<span style="font-size:0.78em;color:var(--text-dim)">+ Schedule rehearsal</span></div>';
    }
    html += '</div>';
    el.innerHTML = html;

    // Also render guidance in right rail
    _calRenderRailGuidance();
}

async function _calRenderRailGuidance() {
    // Replaced by _calRenderDecisionAnchor() above calendar
}

// ── Next event rail (single event, minimal) ──────────────────────────────────
async function _calPopulateNextEventRail() {
    var el = document.getElementById('calNextEventRail');
    if (!el) return;
    try {
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var today = new Date().toISOString().split('T')[0];
        var futureEnd = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
        var expanded = expandRecurringEvents(events, today, futureEnd);
        var next = expanded.filter(function(e) { return (e.date || '') >= today; })
            .sort(function(a,b) { return (a.date||'').localeCompare(b.date||''); })[0];
        if (!next) { el.innerHTML = '<div style="color:var(--gl-text-tertiary);font-size:0.75em;padding:var(--gl-space-sm) 0">No upcoming events</div>'; return; }
        var icon = next.type === 'gig' ? '\uD83C\uDFA4' : next.type === 'rehearsal' ? '\uD83C\uDFB8' : '\uD83D\uDCC5';
        var dateFmt = (typeof glFormatDate === 'function') ? glFormatDate(next.date, true) : next.date;
        var daysAway = (typeof glDaysAway === 'function') ? glDaysAway(next.date) : null;
        var daysLabel = daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : (daysAway !== null ? daysAway + 'd' : '');
        el.innerHTML = '<div style="padding:var(--gl-space-sm) 0">'
            + '<div style="display:flex;align-items:center;gap:6px">'
            + '<span>' + icon + '</span>'
            + '<span style="font-weight:600;color:var(--gl-text-secondary)">' + (next.title || (next.type === 'rehearsal' ? 'Rehearsal' : 'Event')) + '</span>'
            + '</div>'
            + '<div style="font-size:0.9em;color:var(--gl-text-tertiary);margin-top:2px">' + dateFmt + (daysLabel ? ' \u00B7 ' + daysLabel : '') + '</div>'
            + '</div>';
    } catch(e) { el.innerHTML = ''; }
}

// ── Sync coverage indicator ───────────────────────────────────────────────────
// ── External Google Calendar events overlay ──────────────────────────────────
// Loads user's Google Calendar events and adds subtle markers to calendar cells.
// Non-blocking, non-destructive — adds to existing cells without rebuilding grid.
var _calExternalEventsCache = {};

async function _calOverlayExternalEvents(monthPrefix, daysInMonth) {
    if (typeof GLCalendarSync === 'undefined' || !GLCalendarSync.hasCalendarScope()) return;
    var timeMin = monthPrefix + '01T00:00:00Z';
    var lastDay = String(daysInMonth).padStart(2, '0');
    var timeMax = monthPrefix + lastDay + 'T23:59:59Z';
    try {
        var events = await GLCalendarSync.listGoogleEvents(timeMin, timeMax);
        if (!events || !events.length) return;
        // Index by date
        var byDate = {};
        events.forEach(function(ev) {
            if (!ev.date) return;
            // Skip events that match existing GrooveLinx events (dedup by date + title similarity)
            if (!byDate[ev.date]) byDate[ev.date] = [];
            byDate[ev.date].push(ev);
        });
        _calExternalEventsCache = byDate;
        // Add markers to grid cells
        var grid = document.getElementById('calGrid');
        if (!grid) return;
        Object.keys(byDate).forEach(function(date) {
            var cell = grid.querySelector('[data-date="' + date + '"]');
            if (!cell) return;
            // Don't add marker if cell already has a band event state (gig/rehearsal)
            var state = cell.getAttribute('data-state');
            if (state === 'gig' || state === 'rehearsal') return;
            // Don't duplicate marker
            if (cell.querySelector('.gl-day-external')) return;
            // Add subtle dot marker
            var dot = document.createElement('div');
            dot.className = 'gl-day-external';
            dot.title = byDate[date].map(function(e) { return e.title; }).join(', ');
            cell.appendChild(dot);
            // Build external event hover lines
            var _extLines = byDate[date].slice(0, 3).map(function(e) {
                return '<div>' + (e.title || 'Busy') + (e.time ? ' \u00B7 ' + e.time : '') + '</div>';
            }).join('');
            if (byDate[date].length > 3) _extLines += '<div style="opacity:0.6">+' + (byDate[date].length - 3) + ' more</div>';
            _extLines += '<div style="opacity:0.4;margin-top:2px">Google Calendar</div>';
            // If this is a "best" day, downgrade the hover to acknowledge the conflict
            var existingHover = cell.querySelector('.gl-day-hover');
            if (state === 'best' && existingHover) {
                existingHover.innerHTML = 'Open with ' + byDate[date].length + ' Google event' + (byDate[date].length > 1 ? 's' : '') + '<div style="margin-top:4px">' + _extLines + '</div>';
            } else if (!existingHover) {
                var hover = document.createElement('div');
                hover.className = 'gl-day-hover';
                hover.innerHTML = _extLines;
                cell.appendChild(hover);
            } else {
                // Append to existing hover
                existingHover.innerHTML += '<div style="margin-top:4px;padding-top:4px;border-top:1px solid var(--gl-border-subtle)">' + _extLines + '</div>';
            }
        });
        console.log('[Calendar] External Google events overlaid:', events.length);
    } catch(e) { console.warn('[Calendar] External events overlay failed:', e); }
}

// ── SYNC COVERAGE — shared helper for all trust messaging ────────────────────
// RULES:
// - All sync coverage messaging must route through _calGetSyncCoverage()
// - No inline assumptions about sync completeness in UI code
// - Currently: only current user's primary Google Calendar is synced
// - MULTI-USER PATH: each band member connects their own Google Calendar
//   - OAuth tokens stored per-member in Firebase
//   - free/busy queried per-member with their token
//   - blocked ranges carry _source:'google' + person name
//   - event_availability carries source:'google' + syncedAt per member
//   - _calGetSyncCoverage().connected increases as members connect

// _calConnectedCache: populated async, used by sync functions
var _calConnectedCache = null;
var _calConnectedCacheTime = 0;

function _calGetSyncCoverage() {
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var hasScope = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope());
    var myKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
    var total = members.length || Object.keys(bm).length;
    // Use cached connection data if available (populated by _calLoadConnections)
    var connectedKeys = _calConnectedCache ? Object.keys(_calConnectedCache) : [];
    var connected = connectedKeys.length;
    // If no cache yet, fall back to current user check
    if (!_calConnectedCache) connected = hasScope ? 1 : 0;
    return {
        connected: connected,
        total: total,
        connectedKeys: connectedKeys,
        isPartial: connected > 0 && connected < total,
        isNone: connected === 0,
        isFull: connected >= total && total > 0,
        hasScope: hasScope,
        myKey: myKey
    };
}

// Load real connection data from Firebase (async — call on page load)
async function _calLoadConnections() {
    if (_calConnectedCache && _calConnectedCacheTime > Date.now() - 300000) return;
    try {
        if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.getConnectedMembers) {
            _calConnectedCache = await GLCalendarSync.getConnectedMembers();
            _calConnectedCacheTime = Date.now();
        }
    } catch(e) { _calConnectedCache = {}; }
}

function _calRenderSyncCoverage() {
    // Delegate to unified Google panel — keeps all callers working
    _calRenderGooglePanel();
}

// Manual sync: push unsynced events + pull latest availability
window._calSyncNow = async function() {
    var btn = document.getElementById('calSyncBtn');
    if (btn) { btn.textContent = '\u21BB Syncing...'; btn.disabled = true; }
    try {
        // Push unsynced events to Google band calendar
        if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope()) {
            var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
            var pushed = 0;
            for (var _si = 0; _si < events.length; _si++) {
                var ev = events[_si];
                if (ev.syncStatus === 'synced' && ev.googleEventId) continue; // already synced
                if (!ev.date || !ev.title) continue;
                try {
                    var glEvent = {
                        summary: ev.title || ev.type || 'Band Event',
                        date: ev.date,
                        startTime: ev.time || '19:00',
                        location: ev.location || ev.venue || '',
                        description: ev.notes || '',
                        type: ev.type
                    };
                    var sync = await GLCalendarSync.create(glEvent);
                    if (sync.success && sync.sync) {
                        events[_si].googleEventId = sync.sync.externalEventId;
                        events[_si].calendarId = sync.sync.calendarId;
                        events[_si].syncStatus = 'synced';
                        events[_si].lastSyncedAt = new Date().toISOString();
                        pushed++;
                    }
                } catch(e) {}
            }
            if (pushed > 0) {
                await saveBandDataToDrive('_band', 'calendar_events', events);
                console.log('[Sync] Pushed ' + pushed + ' events to Google Calendar');
            }
        }
        // Pull latest connections (no full re-render — prevents screen flash)
        _calConnectedCache = null;
        await _calLoadConnections();
        if (typeof loadCalendarEvents === 'function') await loadCalendarEvents();
        // Only re-render the Google panel, not the entire calendar grid
        _calRenderGooglePanel();
        // Build explicit sync status message
        var _hasAvail = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasFreeBusyScope && GLCalendarSync.hasFreeBusyScope());
        var _syncMsg = '\u2713 Band events synced to Google Calendar';
        if (typeof pushed !== 'undefined' && pushed > 0) _syncMsg += ' (' + pushed + ' new)';
        if (!_hasAvail) _syncMsg += '. Personal availability not synced \u2014 click "enable" above to detect scheduling conflicts.';
        if (typeof showToast === 'function') showToast(_syncMsg, _hasAvail ? 3000 : 6000);
    } catch(e) {
        if (typeof showToast === 'function') showToast('Sync failed: ' + (e.message || 'unknown error'));
    }
    var _hasAvailRestore = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasFreeBusyScope && GLCalendarSync.hasFreeBusyScope());
    if (btn) { btn.textContent = _hasAvailRestore ? '\u21BB Sync Calendars' : '\u21BB Sync Band Events'; btn.disabled = false; }
};

// Dismiss date selection — return to global mode
window._calDismissDateSelection = function() {
    var card = document.getElementById('calSelectedDayCard');
    if (card) card.innerHTML = '';
    // Restore global sections
    ['calAvailHealth', 'calWeeklyPressure'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = '';
    });
};

// Toggle RSVP status for a member on an event (inline, no modal)
window._calToggleRsvp = async function(eventId, memberKey, newStatus, dateStr) {
    try {
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var ev = events.find(function(e) { return (e.eventId || e.id) === eventId; });
        if (!ev) return;
        if (!ev.availability) ev.availability = {};
        if (newStatus === null) {
            delete ev.availability[memberKey];
        } else {
            ev.availability[memberKey] = { status: newStatus, updatedAt: new Date().toISOString() };
        }
        await saveBandDataToDrive('_band', 'calendar_events', events);
        // Update local cache
        if (_calEventsByDate[dateStr]) {
            var cached = _calEventsByDate[dateStr].find(function(e) { return (e.eventId || e.id) === eventId; });
            if (cached) cached.availability = ev.availability;
        }
        // Re-render the date panel
        if (dateStr) {
            var parts = dateStr.split('-');
            calDayClick(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('RSVP update failed');
    }
};

// Delete event from the date panel with confirmation + Google sync
window._calDeleteFromPanel = async function(eventId, dateStr) {
    // Check if event is synced to Google and whether we can reach Google
    var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    var ev = events.find(function(e) { return (e.eventId || e.id) === eventId; });
    var _isSynced = ev && ev.googleEventId;
    var _hasToken = (typeof accessToken !== 'undefined' && accessToken);

    if (_isSynced && !_hasToken) {
        // Event is on Google Calendar but we can't reach Google to delete it
        if (!confirm('This event is synced to Google Calendar, but your Google session has expired.\n\nDelete from GrooveLinx only?\nThe event will remain on Google Calendar until you sign in and sync again.')) return;
    } else {
        if (!confirm('Delete this event?' + (_isSynced ? ' It will also be removed from Google Calendar.' : ''))) return;
    }

    try {
        // Remove from Google Calendar if synced AND we have a token
        if (_isSynced && _hasToken && typeof GLCalendarSync !== 'undefined' && GLCalendarSync.remove) {
            try {
                await GLCalendarSync.remove(ev.googleEventId);
            } catch(e) {
                console.warn('[Calendar] Google delete failed:', e.message);
            }
        }
        // Remove from GrooveLinx
        events = events.filter(function(e) { return (e.eventId || e.id) !== eventId; });
        await saveBandDataToDrive('_band', 'calendar_events', events);
        // Refresh UI
        if (typeof loadCalendarEvents === 'function') await loadCalendarEvents();
        _calRenderGooglePanel();
        if (dateStr) {
            var parts = dateStr.split('-');
            calDayClick(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        var _toast = '\u2713 Event deleted';
        if (_isSynced && !_hasToken) _toast += ' from GrooveLinx (still on Google \u2014 sign in to sync)';
        else if (_isSynced) _toast += ' from GrooveLinx and Google Calendar';
        if (typeof showToast === 'function') showToast(_toast, 4000);
    } catch(e) {
        if (typeof showToast === 'function') showToast('Delete failed: ' + (e.message || 'unknown error'));
    }
};

// (Old simple sync replaced by full sync above that pushes unsynced events)

// ── First-time onboarding — now handled by _calRenderGooglePanel ──────────────
function _calRenderOnboarding() {
    // Full band milestone toast — show once when all members connected
    var cov = _calGetSyncCoverage();
    if (cov.isFull && !localStorage.getItem('gl_cal_fullband_shown')) {
        localStorage.setItem('gl_cal_fullband_shown', '1');
        if (typeof showToast === 'function') showToast('\uD83C\uDFB8 Full band connected — scheduling now reflects everyone\u2019s real availability');
    }
    // Connected impact confirmation — show once
    if (cov.hasScope && !localStorage.getItem('gl_cal_impact_shown')) {
        localStorage.setItem('gl_cal_impact_shown', '1');
        if (typeof showToast === 'function') showToast('\u2713 Connected — your availability is now included when the band schedules');
    }
    // Re-render Google panel with latest state
    _calRenderGooglePanel();
}

// ── Unified Google Panel (right rail) — single render, no duplicates ────────
function _calRenderGooglePanel() {
    var el = document.getElementById('calGooglePanel');
    if (!el) return;
    var cov = _calGetSyncCoverage();
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    if (!members.length) { el.innerHTML = ''; return; }

    var hasScope = cov.hasScope;
    var connectedCount = cov.connected;
    var totalCount = members.length;
    // Check if current user has a Firebase connection record (even if token expired)
    var _myConnected = cov.myKey && cov.connectedKeys.indexOf(cov.myKey) !== -1;
    // User is "connected" if they have scope OR have a Firebase connection record
    var _isConnected = hasScope || _myConnected;
    var _hasFreeBusy = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasFreeBusyScope) ? GLCalendarSync.hasFreeBusyScope() : true;
    var _partialScope = _isConnected && !_hasFreeBusy;

    // Last synced time
    var lastSync = '';
    try {
        if (_calConnectedCache) {
            var times = Object.values(_calConnectedCache).map(function(c) { return c.updatedAt || c.connectedAt || ''; }).filter(Boolean);
            if (times.length) {
                var latest = times.sort().reverse()[0];
                var mins = Math.floor((Date.now() - new Date(latest).getTime()) / 60000);
                lastSync = mins < 2 ? 'just now' : (mins < 60 ? mins + ' min ago' : Math.floor(mins / 60) + 'h ago');
            }
        }
        // Fallback: if no timestamps in records, use cache load time
        if (!lastSync && _calConnectedCacheTime > 0) {
            var _cacheAge = Math.floor((Date.now() - _calConnectedCacheTime) / 60000);
            lastSync = _cacheAge < 2 ? 'just now' : (_cacheAge < 60 ? _cacheAge + ' min ago' : Math.floor(_cacheAge / 60) + 'h ago');
        }
    } catch(e) {}

    // ── SINGLE member list (rendered once, used in all states) ──
    var memberHtml = '';
    members.forEach(function(m) {
        var key = (typeof m === 'object') ? m.key : m;
        var name = bm[key] ? (bm[key].name || key).split(' ')[0] : key;
        var isMe = key === cov.myKey;
        var connected = cov.connectedKeys.indexOf(key) !== -1 || (isMe && _isConnected);
        memberHtml += '<div style="display:flex;align-items:center;gap:5px;padding:2px 0;font-size:0.72em">'
            + '<span style="color:' + (connected ? 'var(--gl-green)' : 'var(--gl-text-tertiary)') + '">' + (connected ? '\u2713' : '\u26A0') + '</span>'
            + '<span style="color:' + (connected ? 'var(--gl-text)' : 'var(--gl-text-secondary)') + '">' + name + '</span>'
            + (connected ? '' : '<span style="font-size:0.82em;color:var(--gl-text-tertiary);opacity:0.5">not connected</span>')
            + '</div>';
    });

    // ── Build panel ──
    var borderColor = _isConnected ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.15)';
    var bgColor = _isConnected ? 'rgba(34,197,94,0.04)' : 'rgba(99,102,241,0.06)';

    var html = '<div style="padding:12px;border-radius:10px;background:' + bgColor + ';border:1px solid ' + borderColor + ';margin-bottom:var(--gl-space-sm)">';

    // Header: connection status
    if (_isConnected) {
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
            + '<span style="color:var(--gl-green);font-size:0.82em">\u2713</span>'
            + '<span style="font-size:0.78em;font-weight:600;color:var(--gl-text)">'
            + (connectedCount >= totalCount ? 'All calendars connected' : connectedCount + ' of ' + totalCount + ' connected')
            + '</span></div>';
        if (lastSync) html += '<div style="font-size:0.62em;color:var(--gl-text-tertiary);margin-bottom:2px">Last synced ' + lastSync + '</div>';
        // Band calendar name + access status
        try {
            var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
            if (db && typeof bandPath === 'function') {
                // Read synchronously from a cached value if available
            }
        } catch(e) {}
        // Show band calendar name if stored (async would delay render, use simple approach)
        html += '<div style="font-size:0.62em;color:var(--gl-text-tertiary);margin-bottom:6px">Band calendar: <span style="color:var(--gl-text)">' + (_isConnected ? '\u2714 configured' : 'not set') + '</span></div>';
    } else {
        html += '<div style="font-size:0.82em;font-weight:700;color:var(--gl-text);margin-bottom:4px">Google Calendar</div>'
            + '<div style="font-size:0.68em;color:var(--gl-text-secondary);line-height:1.5;margin-bottom:8px">Connect so GrooveLinx can find dates when everyone\u2019s free.</div>';
    }

    // Member list (always shown, once)
    html += '<div style="margin-bottom:8px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.02)">' + memberHtml + '</div>';

    // Partial scope warning
    if (_partialScope) {
        html += '<div style="padding:6px 8px;margin-bottom:8px;border-radius:6px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.12);font-size:0.68em;color:var(--gl-amber)">'
            + '\u26A0 Availability not enabled \u2014 <button onclick="_calConnectGoogle()" style="background:none;border:none;color:var(--gl-amber);cursor:pointer;font-weight:700;padding:0;font-size:1em;text-decoration:underline">enable</button></div>';
    }

    // CTA: connect (if never connected) OR sync + manage (if connected)
    if (!_isConnected) {
        html += '<button onclick="_calConnectGoogle()" class="gl-btn-primary" style="width:100%;padding:10px 14px;font-size:0.82em;font-weight:700">Connect Google Calendar</button>';
    } else {
        var _syncLabel = _hasFreeBusy ? '\u21BB Sync Calendars' : '\u21BB Sync Band Events';
        html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
            + '<button onclick="_calSyncNow()" id="calSyncBtn" style="font-size:0.68em;font-weight:700;padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.25);background:rgba(99,102,241,0.06);color:#a5b4fc;font-family:inherit">' + _syncLabel + '</button>'
            + '<button onclick="_calShowAvailabilitySettings()" style="font-size:0.62em;background:none;border:none;color:var(--gl-indigo);cursor:pointer;opacity:0.7;padding:0">Rules</button>'
            + '<button onclick="_calShowManageConnections()" style="font-size:0.62em;background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;opacity:0.5;padding:0">Connections</button>';
        if (connectedCount < totalCount) {
            html += '<button onclick="_calCopyBandSyncInvite()" style="font-size:0.62em;background:none;border:none;color:var(--gl-indigo);cursor:pointer;opacity:0.6;padding:0">Invite band</button>';
        }
        html += '</div>';
    }

    html += '</div>';
    el.innerHTML = html;
}

// Manage connections popover — shows member list with disconnect option
window._calShowManageConnections = function() {
    var cov = _calGetSyncCoverage();
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var html = '<div style="padding:10px 12px;border-radius:10px;background:var(--gl-surface);border:1px solid var(--gl-border-subtle);margin-bottom:var(--gl-space-sm)">';
    html += '<div style="font-size:0.78em;font-weight:600;color:var(--gl-text);margin-bottom:6px">Connections</div>';
    members.forEach(function(m) {
        var key = (typeof m === 'object') ? m.key : m;
        var name = bm[key] ? (bm[key].name || key).split(' ')[0] : key;
        var connected = cov.connectedKeys.indexOf(key) !== -1 || (key === cov.myKey && cov.hasScope);
        html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.72em">';
        html += '<span style="color:' + (connected ? 'var(--gl-green)' : 'var(--gl-amber)') + '">' + (connected ? '\u2713' : '\u26A0') + '</span>';
        html += '<span style="color:var(--gl-text);flex:1">' + name + '</span>';
        html += '<span style="color:var(--gl-text-tertiary);font-size:0.85em">' + (connected ? 'synced' : 'not connected') + '</span>';
        html += '</div>';
    });
    if (cov.hasScope) {
        html += '<button onclick="_calDisconnectGoogle()" style="font-size:0.62em;background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;opacity:0.5;margin-top:4px;padding:0">Disconnect my calendar</button>';
    }
    html += '<button onclick="_calRenderGooglePanel()" style="font-size:0.62em;background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;opacity:0.4;margin-top:2px;padding:0;display:block">Close</button>';
    html += '</div>';
    var el = document.getElementById('calGooglePanel');
    if (el) el.innerHTML = html;
};

// ── Band Availability Health (compact) ──────────────────────────────────────
function _calRenderAvailHealth() {
    var el = document.getElementById('calAvailHealth');
    if (!el) return;

    // Last synced header
    var _syncHeader = '';
    if (_calConnectedCacheTime > 0) {
        var _syncAge = Math.floor((Date.now() - _calConnectedCacheTime) / 60000);
        var _syncDate = new Date(_calConnectedCacheTime);
        var _syncStr = _syncDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        var _isStale = _syncAge > 5;
        _syncHeader = '<div style="font-size:0.62em;color:' + (_isStale ? 'var(--gl-amber)' : 'var(--gl-text-tertiary)') + ';margin-bottom:6px">'
            + (_isStale ? '\u26A0 ' : '') + 'Last synced: ' + _syncStr
            + '</div>';
    }

    var blocked = _calCachedBlockedRanges || [];
    var today = new Date().toISOString().split('T')[0];
    var twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    // Count unique members with conflicts in next 14 days
    var membersBlocked = {};
    var totalConflictDays = 0;
    blocked.forEach(function(b) {
        if (!b.startDate || b.startDate > twoWeeks || (b.endDate && b.endDate < today)) return;
        if (b.person) membersBlocked[b.person] = true;
        totalConflictDays++;
    });
    var blockedCount = Object.keys(membersBlocked).length;
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var totalMembers = members.length || 5;

    if (!totalConflictDays) {
        el.innerHTML = _syncHeader + '<div style="padding:8px 10px;border-radius:8px;font-size:0.72em;color:var(--gl-green);margin-bottom:var(--gl-space-xs,4px)">'
            + '\u2705 No conflicts in the next 2 weeks</div>';
        return;
    }
    var healthColor = blockedCount >= totalMembers - 1 ? 'var(--gl-red,#ef4444)' : blockedCount >= 2 ? 'var(--gl-amber,#f59e0b)' : 'var(--gl-text-secondary)';
    el.innerHTML = _syncHeader + '<div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);margin-bottom:var(--gl-space-xs,4px)">'
        + '<div style="font-size:0.72em;font-weight:600;color:' + healthColor + '">'
        + blockedCount + ' member' + (blockedCount > 1 ? 's' : '') + ' with conflicts (next 14 days)</div>'
        + '<div style="font-size:0.62em;color:var(--gl-text-tertiary);margin-top:2px">'
        + totalConflictDays + ' blocked range' + (totalConflictDays > 1 ? 's' : '') + ' total</div>'
        + '</div>';
}

// ── Weekly Pressure (compact) ───────────────────────────────────────────────
async function _calRenderWeeklyPressure() {
    var el = document.getElementById('calWeeklyPressure');
    if (!el) return;
    var today = new Date().toISOString().split('T')[0];
    var events = [];
    try { events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []); } catch(e) {}
    var thirtyOut = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    var expanded = (typeof expandRecurringEvents === 'function') ? expandRecurringEvents(events, today, thirtyOut) : events;
    var upcoming = expanded.filter(function(e) { return (e.date || '') >= today && (e.date || '') <= thirtyOut; });
    var gigs = upcoming.filter(function(e) { return e.type === 'gig'; });
    var rehearsals = upcoming.filter(function(e) { return e.type === 'rehearsal'; });

    // Last rehearsal
    var daysSinceRehearsal = null;
    try {
        var sessions = (typeof _rhSessionsCache !== 'undefined' && _rhSessionsCache) ? _rhSessionsCache : [];
        if (!sessions.length && typeof loadBandDataFromDrive === 'function') {
            var raw = await loadBandDataFromDrive('_band', 'rehearsal_sessions');
            sessions = raw ? toArray(raw).sort(function(a,b) { return (b.date||'').localeCompare(a.date||''); }) : [];
        }
        if (sessions.length && sessions[0].date) {
            daysSinceRehearsal = Math.floor((Date.now() - new Date(sessions[0].date).getTime()) / 86400000);
        }
    } catch(e) {}

    var items = [];
    if (gigs.length) {
        var nextGig = gigs[0];
        var gDays = Math.ceil((new Date(nextGig.date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
        var gIcon = gDays <= 7 ? '\uD83D\uDEA8' : '\uD83C\uDFA4';
        var gColor = gDays <= 7 ? 'var(--gl-amber)' : 'var(--gl-text-secondary)';
        items.push('<div style="color:' + gColor + '">' + gIcon + ' Gig in ' + gDays + ' day' + (gDays !== 1 ? 's' : '') + '</div>');
    }
    if (rehearsals.length) {
        items.push('<div>' + rehearsals.length + ' rehearsal' + (rehearsals.length > 1 ? 's' : '') + ' scheduled</div>');
    } else if (daysSinceRehearsal !== null && daysSinceRehearsal > 7) {
        items.push('<div style="color:var(--gl-amber)">\u26A0 ' + daysSinceRehearsal + ' days since last rehearsal</div>');
    }
    if (!items.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);font-size:0.68em;color:var(--gl-text-tertiary);display:flex;flex-direction:column;gap:2px;margin-bottom:var(--gl-space-xs,4px)">'
        + items.join('') + '</div>';
}

// ── Decision Anchor — lightweight recommendation above calendar ─────────────
async function _calRenderDecisionAnchor() {
    var el = document.getElementById('calDecisionAnchor');
    if (!el) return;
    if (typeof GLStore === 'undefined' || !GLStore.getRehearsalDateRecommendations) { el.innerHTML = ''; return; }
    try {
        await GLStore.ready(['members'], 10000);
        var _anchorTimeout = new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, 3000); });
        var recs = await Promise.race([GLStore.getRehearsalDateRecommendations(), _anchorTimeout]);
        if (!recs || !recs.primary) { el.innerHTML = ''; return; }
        var p = recs.primary;
        var pDate = new Date(p.date + 'T12:00:00');
        var pLabel = pDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        var _safDate = p.date.replace(/'/g, "\\'");
        // Build explainability line — conflict-aware reason
        var reason = '';
        var avail = p.availability;
        if (avail) {
            var softCount = avail.softConflictCount || 0;
            var hardCount = avail.hardConflictCount || 0;
            if (hardCount === 0 && softCount === 0) {
                reason = 'No conflicts \u2014 ' + avail.available + ' of ' + avail.total + ' members clear';
            } else if (hardCount === 0 && softCount > 0) {
                reason = 'Best available \u2014 ' + softCount + ' same-day event' + (softCount > 1 ? 's' : '') + ' but no overlaps';
            } else {
                reason = avail.available + ' of ' + avail.total + ' available';
            }
        } else if (p.reasons && p.reasons.length) {
            reason = p.reasons[0];
        }
        el.innerHTML = '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.1)">'
            + '<div style="flex:1;min-width:0">'
            + '<div style="font-size:0.72em;font-weight:700;color:var(--gl-green,#22c55e);margin-bottom:2px">Best next rehearsal</div>'
            + '<div style="font-size:0.95em;font-weight:800;color:var(--text);letter-spacing:-0.01em">' + pLabel + '</div>'
            + (reason ? '<div style="font-size:0.68em;color:var(--text-dim);margin-top:2px">' + (typeof escHtml === 'function' ? escHtml(reason) : reason) + '</div>' : '')
            + '</div>'
            + '<button onclick="_calLockAndPlan(\'' + _safDate + '\')" class="cal-action-btn cal-action-primary" style="flex-shrink:0;padding:8px 16px;font-size:0.78em">Schedule</button>'
            + '</div>';
    } catch(e) { el.innerHTML = ''; }
}

// ── Availability Rules Settings Modal ─────────────────────────────────────────
window._calShowAvailabilitySettings = async function() {
    var existing = document.getElementById('calAvailSettingsModal');
    if (existing) existing.remove();

    // Check connection via Firebase record, not just token (token may not be refreshed yet)
    var _cov = _calGetSyncCoverage();
    var _myConn = _cov.myKey && _cov.connectedKeys.indexOf(_cov.myKey) !== -1;
    if (typeof GLCalendarSync === 'undefined' || (!GLCalendarSync.hasCalendarScope() && !_myConn)) {
        if (typeof showToast === 'function') showToast('Enable availability first \u2014 click "enable" in the Google Calendar panel above');
        return;
    }

    var modal = document.createElement('div');
    modal.id = 'calAvailSettingsModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-card,#1e293b);border-radius:12px;padding:20px;max-width:480px;width:100%;border:1px solid var(--gl-border);max-height:80vh;overflow-y:auto';
    inner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
        + '<span style="font-weight:700;color:var(--gl-text);font-size:0.95em">Availability Rules</span>'
        + '<button onclick="document.getElementById(\'calAvailSettingsModal\').remove()" style="background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;font-size:1.1em">\u2715</button>'
        + '</div>'
        + '<div style="font-size:0.72em;color:var(--gl-text-secondary);margin-bottom:16px">Choose which calendars affect your band availability and how conflicts are classified.</div>'
        + '<div id="calAvailSettingsBody" style="font-size:0.82em;color:var(--gl-text-tertiary)">Loading calendars\u2026</div>';

    modal.appendChild(inner);
    document.body.appendChild(modal);

    // Load calendars + current settings + band-level band calendar
    var calendars = await GLCalendarSync.listCalendars();
    var settings = await GLCalendarSync.getAvailabilitySettings() || {};
    var selectedCals = settings.selectedCalendars || [];
    var ignoreAllDay = settings.ignoreAllDay === true;
    var timeAware = settings.timeAware !== false;
    var rWindow = settings.rehearsalWindow || { startHour: 17, endHour: 23 };

    // Band-level band calendar (shared across all members)
    var _bandLevelCalId = null;
    var _bandLevelCalName = null;
    var _bandLevelSetBy = null;
    try {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (db && typeof bandPath === 'function') {
            var _bcSnap = await db.ref(bandPath('band_calendar')).once('value');
            var _bcVal = _bcSnap.val();
            if (_bcVal) {
                _bandLevelCalId = _bcVal.calendarId || null;
                _bandLevelCalName = _bcVal.calendarName || null;
                _bandLevelSetBy = _bcVal.setBy || null;
            }
        }
    } catch(e) {}

    // Check if current user has access to the band calendar
    var _userCalIds = calendars.map(function(c) { return c.id; });
    var _userHasBandCal = _bandLevelCalId ? _userCalIds.indexOf(_bandLevelCalId) !== -1 : true;

    var body = document.getElementById('calAvailSettingsBody');
    if (!body) return;

    if (!calendars.length) {
        var _hasToken = (typeof accessToken !== 'undefined' && accessToken);
        body.innerHTML = '<div style="padding:16px 0">'
            + '<div style="color:var(--gl-amber);font-size:0.88em;font-weight:600;margin-bottom:8px">\u26A0 Could not load your calendars</div>'
            + '<div style="font-size:0.82em;color:var(--gl-text-secondary);line-height:1.5;margin-bottom:12px">'
            + (_hasToken
                ? 'Google Calendar access may not be fully granted. Try reconnecting below.'
                : 'Your Google session needs to be refreshed. Click below to sign in and grant calendar access.')
            + '</div>'
            + '<button onclick="document.getElementById(\'calAvailSettingsModal\').remove();_calConnectGoogle()" class="gl-btn-primary" style="width:100%;padding:10px;font-size:0.85em;font-weight:700">'
            + (_hasToken ? 'Reconnect Google Calendar' : 'Sign in to Google Calendar')
            + '</button></div>';
        return;
    }

    // ── SECTION 1: Availability Calendars (personal, read-only) ──
    var calHtml = '<div style="margin-bottom:16px">';
    calHtml += '<div style="font-weight:700;color:var(--gl-text);margin-bottom:4px">Your Availability Calendars</div>';
    calHtml += '<div style="font-size:0.82em;color:var(--gl-text-tertiary);margin-bottom:8px;line-height:1.4">Select your <strong>personal</strong> calendars. GrooveLinx reads these to detect when you\u2019re busy \u2014 it never writes to them.</div>';
    // Match band calendar by ID or by name (IDs can differ between users)
    var _bandCalName = (_bandLevelCalName || '').toLowerCase();
    calendars.forEach(function(c, i) {
        var isBandCal = (c.id === bandCalId) || (_bandCalName && c.summary.toLowerCase() === _bandCalName);
        var _esc = (typeof escHtml === 'function') ? escHtml(c.summary) : c.summary;

        if (isBandCal) {
            // Band calendar: disabled, cannot be used for availability
            calHtml += '<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;opacity:0.35;cursor:not-allowed">'
                + '<input type="checkbox" disabled style="accent-color:var(--gl-text-tertiary)">'
                + '<span style="flex:1;color:var(--gl-text-tertiary);text-decoration:line-through">' + _esc + '</span>'
                + '<span style="font-size:0.72em;color:var(--gl-text-tertiary)">band \u2014 excluded</span>'
                + '</label>';
            return;
        }
        var isSelected = selectedCals.length > 0
            ? selectedCals.indexOf(c.id) !== -1
            : (c.primary && !c.autoExclude);
        calHtml += '<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer">'
            + '<input type="checkbox" name="calSel" value="' + c.id + '"' + (isSelected ? ' checked' : '')
            + ' style="accent-color:var(--gl-green)">'
            + '<span style="flex:1;color:var(--gl-text)">' + _esc + '</span>'
            + (c.primary ? '<span style="font-size:0.72em;color:var(--gl-green)">personal</span>' : '')
            + (c.backgroundColor ? '<span style="width:10px;height:10px;border-radius:50%;background:' + c.backgroundColor + ';flex-shrink:0"></span>' : '')
            + '</label>';
    });
    calHtml += '<div style="font-size:0.72em;color:var(--gl-text-tertiary);padding:4px 8px;margin-top:4px;line-height:1.4">'
        + '\uD83D\uDCA1 Only check your personal calendars here. The band calendar (' + (typeof escHtml === 'function' ? escHtml(_bandLevelCalName || 'Deadcetera') : (_bandLevelCalName || 'Deadcetera')) + ') is automatically excluded so rehearsals don\u2019t conflict with themselves.</div>';
    calHtml += '</div>';

    // Time-aware filtering toggle
    var rulesHtml = '<div style="margin-bottom:16px;padding-top:12px;border-top:1px solid var(--gl-border-subtle)">';
    rulesHtml += '<div style="font-weight:700;color:var(--gl-text);margin-bottom:8px">Conflict rules</div>';
    rulesHtml += '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">'
        + '<input type="checkbox" id="calOptTimeAware"' + (timeAware ? ' checked' : '') + ' style="accent-color:var(--gl-green)">'
        + '<span style="color:var(--gl-text)">Only block events during rehearsal hours</span></label>';
    rulesHtml += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0 4px 26px;font-size:0.88em;color:var(--gl-text-tertiary)">'
        + 'Rehearsal window: '
        + '<select id="calOptStartHour" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--gl-text);border-radius:4px;padding:2px 4px;font-size:0.9em">';
    for (var h = 12; h <= 21; h++) {
        var lbl = h > 12 ? (h - 12) + 'pm' : h + (h === 12 ? 'pm' : 'am');
        rulesHtml += '<option value="' + h + '"' + (h === rWindow.startHour ? ' selected' : '') + '>' + lbl + '</option>';
    }
    rulesHtml += '</select> to <select id="calOptEndHour" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--gl-text);border-radius:4px;padding:2px 4px;font-size:0.9em">';
    for (var h = 18; h <= 24; h++) {
        var lbl = h > 12 ? (h - 12) + (h === 24 ? 'am' : 'pm') : h + 'am';
        rulesHtml += '<option value="' + h + '"' + (h === rWindow.endHour ? ' selected' : '') + '>' + lbl + '</option>';
    }
    rulesHtml += '</select></div>';
    rulesHtml += '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">'
        + '<input type="checkbox" id="calOptIgnoreAllDay"' + (ignoreAllDay ? ' checked' : '') + ' style="accent-color:var(--gl-green)">'
        + '<span style="color:var(--gl-text)">Skip all-day events in conflict detection</span></label>'
        + '<div style="font-size:0.78em;color:var(--gl-amber);padding:2px 0 4px 26px;line-height:1.4">\u26A0 Enabling this hides ALL all-day events \u2014 including PTO, travel, and out-of-town days. Only enable if birthday/holiday noise is a problem.</div>';
    rulesHtml += '</div>';

    // Band calendar — band-level setting (shared across all members)
    var bandCalId = _bandLevelCalId || settings.bandCalendarId || 'primary';
    var bandCalHtml = '<div style="margin-bottom:16px;padding-top:12px;border-top:1px solid var(--gl-border-subtle)">';
    bandCalHtml += '<div style="font-weight:700;color:var(--gl-text);margin-bottom:4px">Band Calendar</div>';
    bandCalHtml += '<div style="font-size:0.82em;color:var(--gl-text-tertiary);margin-bottom:8px;line-height:1.4">Shared calendar where GrooveLinx writes rehearsals and gigs. This setting applies to the whole band.</div>';

    if (_bandLevelCalId && !_userHasBandCal) {
        // User does NOT have access to the band calendar
        bandCalHtml += '<div style="padding:10px;border-radius:8px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);margin-bottom:8px">'
            + '<div style="font-size:0.78em;font-weight:600;color:#f87171;margin-bottom:4px">\u26A0 You don\u2019t have access to ' + (typeof escHtml === 'function' ? escHtml(_bandLevelCalName || 'the band calendar') : (_bandLevelCalName || 'the band calendar')) + '</div>'
            + '<div style="font-size:0.72em;color:var(--gl-text-secondary);line-height:1.4;margin-bottom:6px">'
            + 'This calendar must be shared with your Google account before GrooveLinx can write events there for you.</div>'
            + '<div style="font-size:0.72em;color:var(--gl-text-secondary);line-height:1.4">'
            + '<strong>Setup:</strong> Ask ' + (_bandLevelSetBy ? (typeof escHtml === 'function' ? escHtml(_bandLevelSetBy) : _bandLevelSetBy) : 'the person who set it up') + ' to share the <strong>' + (typeof escHtml === 'function' ? escHtml(_bandLevelCalName || 'band') : (_bandLevelCalName || 'band')) + '</strong> Google Calendar with you. After you accept the invitation, come back here and click Refresh.</div>'
            + '<button onclick="_calShowAvailabilitySettings()" style="margin-top:6px;font-size:0.72em;padding:4px 12px;border-radius:5px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.06);color:#a5b4fc;cursor:pointer;font-family:inherit">\u21BB Refresh</button>'
            + '</div>';
        bandCalHtml += '<input type="hidden" id="calOptBandCal" value="' + bandCalId + '">';
    } else {
        // User has access — show dropdown
        bandCalHtml += '<select id="calOptBandCal" style="width:100%;padding:6px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--gl-text);border-radius:6px;font-size:0.9em;font-family:inherit">';
        calendars.forEach(function(c) {
            var selected = c.id === bandCalId;
            bandCalHtml += '<option value="' + c.id + '"' + (selected ? ' selected' : '') + '>' + (typeof escHtml === 'function' ? escHtml(c.summary) : c.summary) + (c.primary ? ' (personal)' : '') + '</option>';
        });
        bandCalHtml += '</select>';
        if (_userHasBandCal && _bandLevelCalId) {
            bandCalHtml += '<div style="font-size:0.68em;color:var(--gl-green);margin-top:4px">\u2714 You have access to this calendar</div>';
        }
        bandCalHtml += '<div style="font-size:0.72em;color:var(--gl-text-tertiary);margin-top:4px;line-height:1.4">\uD83D\uDCA1 Tip: Create a shared \u201CDeadcetera\u201D calendar in Google and select it here. All band members should use the same calendar.</div>';
    }
    bandCalHtml += '</div>';

    // Save button
    var saveHtml = '<div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--gl-border-subtle)">'
        + '<button id="calAvailSaveBtn" onclick="_calSaveAvailabilitySettings()" class="gl-btn-primary" style="flex:1;padding:10px;font-size:0.85em;font-weight:700">Save & Refresh</button>'
        + '<button onclick="document.getElementById(\'calAvailSettingsModal\').remove()" class="gl-btn-ghost" style="padding:10px;font-size:0.85em">Cancel</button>'
        + '</div>';

    body.innerHTML = calHtml + rulesHtml + bandCalHtml + saveHtml;
};

window._calSaveAvailabilitySettings = async function() {
    var btn = document.getElementById('calAvailSaveBtn');
    if (btn) { btn.textContent = 'Saving\u2026'; btn.disabled = true; }

    // Gather selected calendars
    var checkboxes = document.querySelectorAll('input[name="calSel"]:checked');
    var selectedCals = [];
    checkboxes.forEach(function(cb) { selectedCals.push(cb.value); });

    if (!selectedCals.length) {
        if (typeof showToast === 'function') showToast('Select at least one calendar');
        if (btn) { btn.textContent = 'Save & Refresh'; btn.disabled = false; }
        return;
    }

    var timeAware = document.getElementById('calOptTimeAware');
    var ignoreAllDay = document.getElementById('calOptIgnoreAllDay');
    var startHour = document.getElementById('calOptStartHour');
    var endHour = document.getElementById('calOptEndHour');

    var bandCalSelect = document.getElementById('calOptBandCal');
    var bandCalId = bandCalSelect ? bandCalSelect.value : 'primary';

    var settings = {
        selectedCalendars: selectedCals,
        bandCalendarId: bandCalId,
        timeAware: timeAware ? timeAware.checked : true,
        ignoreAllDay: ignoreAllDay ? ignoreAllDay.checked : false,
        rehearsalWindow: {
            startHour: startHour ? parseInt(startHour.value, 10) : 17,
            endHour: endHour ? parseInt(endHour.value, 10) : 23
        },
        updatedAt: new Date().toISOString()
    };

    var ok = await GLCalendarSync.saveAvailabilitySettings(settings);

    // Also save band calendar at BAND level (shared across all members)
    if (bandCalId && bandCalId !== 'primary') {
        try {
            var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
            if (db && typeof bandPath === 'function') {
                // Find calendar name from list
                var _calName = bandCalId;
                var _calList = await GLCalendarSync.listCalendars();
                var _match = _calList.find(function(c) { return c.id === bandCalId; });
                if (_match) _calName = _match.summary;
                var _who = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '';
                await db.ref(bandPath('band_calendar')).set({
                    calendarId: bandCalId,
                    calendarName: _calName,
                    setBy: _who,
                    updatedAt: new Date().toISOString()
                });
            }
        } catch(e) { console.warn('[Calendar] Band calendar save failed:', e.message); }
    }

    if (ok) {
        if (typeof showToast === 'function') showToast('\u2705 Settings saved \u2014 refreshing calendar');
        var modal = document.getElementById('calAvailSettingsModal');
        if (modal) modal.remove();
        renderCalendarInner();
    } else {
        if (typeof showToast === 'function') showToast('Failed to save settings');
        if (btn) { btn.textContent = 'Save & Refresh'; btn.disabled = false; }
    }
};

// ── Sync explainer sheet ─────────────────────────────────────────────────────
window._calShowSyncExplainer = function() {
    var existing = document.getElementById('calSyncExplainer');
    if (existing) { existing.style.display = 'flex'; return; }
    var modal = document.createElement('div');
    modal.id = 'calSyncExplainer';
    modal.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-card,#1e293b);border-radius:12px;padding:20px;max-width:420px;width:100%;border:1px solid var(--gl-border)';
    inner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
        + '<span style="font-weight:700;color:var(--gl-text)">How Google Calendar sync works</span>'
        + '<button onclick="document.getElementById(\'calSyncExplainer\').style.display=\'none\'" style="background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;font-size:1.1em">\u2715</button>'
        + '</div>'
        + '<div style="font-size:0.82em;color:var(--gl-text-secondary);line-height:1.6">'
        + '<div style="margin-bottom:8px"><strong>What it does</strong></div>'
        + '<div style="margin-bottom:6px">\u2022 Reads your busy times from Google Calendar</div>'
        + '<div style="margin-bottom:6px">\u2022 Shows conflicts in the band schedule automatically</div>'
        + '<div style="margin-bottom:6px">\u2022 Syncs RSVP responses if you answer from Google</div>'
        + '<div style="margin-bottom:6px">\u2022 Makes date recommendations more accurate</div>'
        + '<div style="margin-bottom:12px;padding-top:8px;border-top:1px solid var(--gl-border-subtle)"><strong>How coverage works</strong></div>'
        + '<div style="margin-bottom:6px">Each band member connects their own calendar. The more members who connect, the more accurate scheduling becomes.</div>'
        + '<div style="margin-bottom:6px">Unconnected members still need to manually RSVP or block dates.</div>'
        + '<div style="margin-bottom:12px;padding-top:8px;border-top:1px solid var(--gl-border-subtle)"><strong style="color:var(--gl-amber)">Important</strong></div>'
        + '<div style="margin-bottom:6px">GrooveLinx only sees calendars that are connected. If someone hasn\u2019t connected, their conflicts won\u2019t show automatically.</div>'
        + '</div>';
    modal.appendChild(inner);
    document.body.appendChild(modal);
};

// ── Band invite message for Google sync ──────────────────────────────────────
window._calCopyBandSyncInvite = function() {
    var msg = 'Please connect your Google Calendar in GrooveLinx. It only takes a minute, and it lets the app automatically see your busy times so we stop guessing when the band can rehearse. It also keeps your RSVP responses synced if you answer from Google Calendar.';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(function() {
            if (typeof showToast === 'function') showToast('Message copied \u2014 paste to your band chat');
        });
    } else {
        var ta = document.createElement('textarea'); ta.value = msg; ta.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        if (typeof showToast === 'function') showToast('Message copied');
    }
};

// ── Schedule confirmation panel ──────────────────────────────────────────────
window._calConfirmSchedule = function(dateStr, type) {
    type = type || 'rehearsal';
    var cov = _calGetSyncCoverage();
    var dateLabel = '';
    try { dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); } catch(e) { dateLabel = dateStr; }

    var html = '<div style="padding:14px;border-radius:10px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);margin-bottom:12px">';
    html += '<div style="font-size:0.88em;font-weight:700;color:var(--gl-text);margin-bottom:8px">Schedule ' + type + ' for ' + dateLabel + '?</div>';
    html += '<div style="font-size:0.75em;color:var(--gl-text-secondary);line-height:1.5;margin-bottom:8px">'
        + 'This will:<br>'
        + '\u2022 Create the event in GrooveLinx<br>';
    if (cov.hasScope) {
        html += '\u2022 Sync to Google Calendar<br>'
            + '\u2022 Send Google invites to band members<br>'
            + '\u2022 Keep RSVP responses synced</div>';
    } else {
        html += '\u2022 Event stays in GrooveLinx only</div>';
    }
    if (cov.isPartial) {
        html += '<div style="font-size:0.72em;color:var(--gl-amber);margin-bottom:8px">\u26A0\uFE0F Only ' + cov.connected + '/' + cov.total + ' calendars are connected \u2014 this date may still conflict. Consider asking the rest of the band to connect for more accurate scheduling.</div>';
    }
    html += '<div style="display:flex;gap:6px">'
        + '<button onclick="calAddEvent(\'' + dateStr.replace(/'/g, "\\'") + '\')" class="gl-btn-primary" style="font-size:0.82em;padding:8px 18px">Confirm</button>'
        + '<button onclick="document.getElementById(\'calConfirmPanel\').innerHTML=\'\'" class="gl-btn-ghost" style="font-size:0.78em">Cancel</button>'
        + '</div></div>';

    var panel = document.getElementById('calConfirmPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'calConfirmPanel';
        var form = document.getElementById('calEventFormArea');
        if (form) form.parentNode.insertBefore(panel, form);
        else document.querySelector('.gl-page-primary').appendChild(panel);
    }
    panel.innerHTML = html;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ── Connect/Disconnect/Reconnect Google Calendar ─────────────────────────────
window._calConnectGoogle = async function() {
    // If we already have scope + token, just register the connection
    if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope()) {
        // Verify token is still valid with a lightweight API call
        var _testOk = _calTestGoogleToken();
        if (_testOk) {
            var result = await GLCalendarSync.connectGoogleCalendar();
            if (result.ok) {
                localStorage.removeItem('gl_cal_onboard_dismissed');
                localStorage.removeItem('gl_cal_impact_shown');
                _calConnectedCache = null;
                await _calLoadConnections();
                _calRenderSyncCoverage();
                _calRenderOnboarding();
                if (typeof showToast === 'function') showToast('\u2713 Google Calendar connected');
                // Auto-open calendar selection if first time connecting and user has multiple calendars
                if (!localStorage.getItem('gl_cal_settings_shown') && GLCalendarSync.listCalendars) {
                    var _cals = await GLCalendarSync.listCalendars();
                    if (_cals.length > 1) {
                        localStorage.setItem('gl_cal_settings_shown', '1');
                        setTimeout(function() { _calShowAvailabilitySettings(); }, 500);
                    }
                }
            }
            return;
        }
        // Token expired — fall through to re-auth
    }
    // Trigger Google re-auth with calendar scope
    _calTriggerGoogleReAuth();
};

window._calReconnectGoogle = function() {
    _calTriggerGoogleReAuth();
};

window._calDisconnectGoogle = async function() {
    if (typeof GLCalendarSync !== 'undefined') {
        var result = await GLCalendarSync.disconnectGoogleCalendar();
        if (result.ok) {
            if (typeof showToast === 'function') showToast('Google Calendar disconnected');
            _calConnectedCache = null;
            await _calLoadConnections();
            _calRenderSyncCoverage();
            _calRenderOnboarding();
        }
    }
};

// Check if current token exists (no API call — avoids CORS issues with Worker GET)
function _calTestGoogleToken() {
    return typeof accessToken !== 'undefined' && accessToken && accessToken.length > 20;
}

// Trigger Google OAuth re-consent
function _calTriggerGoogleReAuth() {
    if (_calConnecting) return; // already in progress — prevent double-click
    if (typeof tokenClient !== 'undefined' && tokenClient) {
        _calConnecting = true; // suppress Firebase listener re-renders during consent
        if (typeof showToast === 'function') showToast('Opening Google sign-in\u2026');
        try {
            // Revoke existing token first so Google re-evaluates all scopes (including calendar)
            var _oldToken = (typeof accessToken !== 'undefined') ? accessToken : null;
            if (_oldToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2 && google.accounts.oauth2.revoke) {
                google.accounts.oauth2.revoke(_oldToken, function() {
                    console.log('[Calendar] Old token revoked — requesting fresh consent');
                });
            }
            tokenClient.requestAccessToken({ prompt: 'consent' });
            // Poll for new token — give user up to 60 seconds to complete consent
            var _pollCount = 0;
            var _prevToken = (typeof accessToken !== 'undefined') ? accessToken : null;
            var _pollTimer = setInterval(async function() {
                _pollCount++;
                if (_pollCount >= 120) { // 60 seconds (120 * 500ms)
                    clearInterval(_pollTimer);
                    _calConnecting = false;
                    _calShowConnectionFailure();
                    return;
                }
                // Check if a NEW token has been set by the OAuth callback
                if (typeof accessToken !== 'undefined' && accessToken && accessToken !== _prevToken) {
                    clearInterval(_pollTimer);
                    // Check if Google granted any calendar scope at all
                    if (window._calendarScopeGranted === false) {
                        console.warn('[Calendar] Google did not grant calendar scope. Granted:', window._grantedScopes);
                        _calConnecting = false;
                        _calShowScopeNotGranted();
                        return;
                    }
                    // Connected — reset failure flags and proceed
                    GLCalendarSync.resetScopeFailure();
                    if (!window._calendarFreeBusyGranted) {
                        console.log('[Calendar] Calendar events scope granted but freeBusy not available — skipping free/busy overlay');
                    }
                    var r = await GLCalendarSync.connectGoogleCalendar();
                    _calConnecting = false; // done — allow Firebase listener re-renders
                    if (r.ok) {
                        localStorage.removeItem('gl_cal_onboard_dismissed');
                        localStorage.removeItem('gl_cal_impact_shown');
                        _calConnectedCache = null;
                        await _calLoadConnections();
                        _calRenderSyncCoverage();
                        _calRenderOnboarding();
                        if (typeof showToast === 'function') showToast('\u2713 Google Calendar connected');
                        // Auto-open calendar selection on first connect with multiple calendars
                        if (!localStorage.getItem('gl_cal_settings_shown') && GLCalendarSync.listCalendars) {
                            var _authCals = await GLCalendarSync.listCalendars();
                            if (_authCals.length > 1) {
                                localStorage.setItem('gl_cal_settings_shown', '1');
                                setTimeout(function() { _calShowAvailabilitySettings(); }, 500);
                            }
                        }
                    }
                }
            }, 500);
        } catch(e) {
            _calConnecting = false;
            if (typeof showToast === 'function') showToast('Could not open Google sign-in');
        }
    } else {
        // tokenClient not available — user needs to sign in first
        if (typeof showToast === 'function') showToast('Sign in to Google first');
        var _onboardEl = document.getElementById('calOnboardingCard');
        if (_onboardEl) {
            _onboardEl.innerHTML = '<div style="padding:12px;border-radius:10px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);margin-bottom:var(--gl-space-sm)">'
                + '<div style="font-size:0.82em;font-weight:600;color:var(--gl-amber);margin-bottom:4px">Sign in to Google first</div>'
                + '<div style="font-size:0.72em;color:var(--gl-text-secondary);line-height:1.5;margin-bottom:8px">We need your Google account to connect your calendar. Sign in and we\u2019ll take it from there.</div>'
                + '<button onclick="if(typeof signIn===\'function\')signIn()" class="gl-btn-primary" style="padding:6px 14px;font-size:0.78em">Sign in</button>'
                + '</div>';
        }
    }
}

// Show connection failure (consent denied or timeout)
function _calShowConnectionFailure() {
    if (typeof showToast === 'function') showToast('Connection didn\u2019t go through');
    var el = document.getElementById('calOnboardingCard');
    if (el) {
        el.innerHTML = '<div style="padding:12px;border-radius:10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);margin-bottom:var(--gl-space-sm);position:relative">'
            + '<div style="font-size:0.82em;font-weight:600;color:var(--gl-red);margin-bottom:4px">Connection didn\u2019t go through</div>'
            + '<div style="font-size:0.72em;color:var(--gl-text-secondary);line-height:1.5;margin-bottom:8px">'
            + 'We couldn\u2019t access your Google Calendar. Please try again and allow calendar access when prompted.'
            + '</div>'
            + '<button onclick="_calConnectGoogle()" class="gl-btn-primary" style="padding:6px 14px;font-size:0.78em">Try again</button>'
            + '</div>';
    }
}

// Google signed in but calendar scope was not granted
function _calShowScopeNotGranted() {
    if (typeof showToast === 'function') showToast('Calendar access not granted');
    var el = document.getElementById('calOnboardingCard');
    if (el) {
        el.innerHTML = '<div style="padding:12px;border-radius:10px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);margin-bottom:var(--gl-space-sm)">'
            + '<div style="font-size:0.82em;font-weight:600;color:var(--gl-amber);margin-bottom:4px">Calendar permission wasn\u2019t included</div>'
            + '<div style="font-size:0.72em;color:var(--gl-text-secondary);line-height:1.5;margin-bottom:8px">'
            + 'You signed in successfully, but Google didn\u2019t grant calendar access. This can happen if the permission was previously skipped.'
            + '<br><br><strong>To fix this:</strong>'
            + '<br>1. Go to <a href="https://myaccount.google.com/permissions" target="_blank" style="color:var(--accent-light);text-decoration:underline">Google Account Permissions</a>'
            + '<br>2. Find <strong>GrooveLinx</strong> and click <strong>Remove access</strong>'
            + '<br>3. Come back here and connect again'
            + '</div>'
            + '<button onclick="_calConnectGoogle()" class="gl-btn-primary" style="padding:6px 14px;font-size:0.78em">Try again</button>'
            + '</div>';
    }
}

// Show reconnect prompt when token is expired
function _calShowReconnectPrompt(container) {
    if (!container) return;
    container.innerHTML = '<div style="padding:10px;border-radius:8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);margin-bottom:8px">'
        + '<div style="font-size:0.78em;font-weight:600;color:var(--gl-amber);margin-bottom:4px">Your calendar connection needs to be refreshed</div>'
        + '<div style="font-size:0.72em;color:var(--gl-text-secondary);margin-bottom:6px">Reconnect to keep your availability accurate.</div>'
        + '<button onclick="_calReconnectGoogle()" class="gl-btn-ghost" style="font-size:0.72em;color:var(--gl-indigo)">Reconnect Google Calendar</button>'
        + '</div>';
}

// ── Live connection watcher ───────────────────────────────────────────────────
var _calConnectionWatcher = null;
var _calConnecting = false; // true while user is actively connecting (suppresses listener re-renders)
var _calWatchDebounce = null;

function _calWatchConnections() {
    if (_calConnectionWatcher) return; // already watching
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        _calConnectionWatcher = db.ref(bandPath('google_connections'));
        _calConnectionWatcher.on('value', function() {
            // Suppress re-renders while user is actively connecting (prevents consent UI flash)
            if (_calConnecting) return;
            // Debounce: multiple Firebase updates can fire in quick succession
            if (_calWatchDebounce) clearTimeout(_calWatchDebounce);
            _calWatchDebounce = setTimeout(function() {
                _calConnectedCache = null;
                _calLoadConnections().then(function() { _calRenderSyncCoverage(); });
            }, 1000);
        });
    } catch(e) {}
}

// ── Token validation on load ─────────────────────────────────────────────────
// IMPORTANT: accessToken is set asynchronously by the OAuth auto-reconnect.
// We must wait for sign-in before validating, otherwise we'd always fail.
async function _calValidateMyToken() {
    // Wait for sign-in to complete (accessToken set by OAuth callback)
    if (typeof GLStore !== 'undefined' && GLStore.ready) {
        await GLStore.ready(['firebase'], 15000);
    }
    // Additional wait for the auto-reconnect to fire
    if (!_calTestGoogleToken()) {
        // Token not set yet — wait a bit more for auto-reconnect
        await new Promise(function(resolve) { setTimeout(resolve, 5000); });
    }
    var cov = _calGetSyncCoverage();
    if (!cov.hasScope) return;
    var myKey = cov.myKey;
    if (!myKey) return;
    var isRegistered = cov.connectedKeys.indexOf(myKey) !== -1;
    if (!isRegistered) return;
    var ok = _calTestGoogleToken();
    if (!ok) {
        // Token not available — log for diagnostics but do NOT auto-disconnect or flash UI.
        // The user will see "Reconnect" in the Google panel if they navigate to Schedule.
        // Auto-disconnecting here caused the consent UI to flash on every page load.
        console.log('[Calendar] Token validation: token not available for registered user. User can reconnect from Schedule page.');
    }
}

// ── Attendee sync on page load ───────────────────────────────────────────────
// ── ATTENDEE SYNC RULES:
// - All attendee status mapping must route through GLCalendarSync.syncAttendeeStatus()
// - Maps: accepted→yes, declined→no, tentative→maybe, needsAction→pending
// - Writes to Firebase event_availability/{dateKey}/{memberKey}
// - 5-minute cache per session to avoid redundant API calls
// - Only syncs events with sync.externalEventId + status 'synced'
var _attendeeSyncedAt = 0;

async function _calSyncAttendeeStatuses() {
    if (typeof GLCalendarSync === 'undefined' || !GLCalendarSync.hasCalendarScope()) return;
    // 5-minute cache — don't re-sync within same session
    if (_attendeeSyncedAt > Date.now() - 300000) {
        console.log('[Calendar] Attendee sync cached (last:', Math.round((Date.now() - _attendeeSyncedAt) / 1000), 's ago)');
        return;
    }
    try {
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return;
        var syncCount = 0;
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (!ev.sync || !ev.sync.externalEventId || ev.sync.status !== 'synced') continue;
            var statuses = await GLCalendarSync.syncAttendeeStatus(ev.sync.externalEventId);
            if (!statuses) continue;
            var dateKey = (ev.date || '').replace(/-/g, '');
            if (!dateKey) continue;
            var updates = {};
            Object.keys(statuses).forEach(function(email) {
                var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
                Object.keys(bm).forEach(function(k) {
                    if (bm[k].email === email) {
                        updates[k] = { status: statuses[email].status, source: 'google', syncedAt: new Date().toISOString() };
                    }
                });
            });
            if (Object.keys(updates).length) {
                await db.ref(bandPath('event_availability/' + dateKey)).update(updates);
                syncCount++;
            }
        }
        _attendeeSyncedAt = Date.now();
        console.log('[Calendar] Attendee statuses synced:', syncCount, 'events updated');
    } catch(e) { console.warn('[Calendar] Attendee sync failed:', e); }
}

// ── Availability modal — scrollable timeline ─────────────────────────────────
window._calShowAvailabilityModal = function() {
    var existing = document.getElementById('calAvailModal');
    if (existing) { existing.style.display = 'flex'; _calBuildAvailTimeline(); return; }
    var modal = document.createElement('div');
    modal.id = 'calAvailModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.onclick = function(e) { if (e.target === modal) modal.style.display = 'none'; };
    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-card,#1e293b);border-radius:12px;padding:16px;max-width:720px;width:100%;max-height:85vh;overflow-y:auto;overflow-x:hidden;border:1px solid var(--gl-border)';
    inner.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
        + '<span style="font-weight:700;color:var(--gl-text)">Band Availability</span>'
        + '<button onclick="document.getElementById(\'calAvailModal\').style.display=\'none\'" style="background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;font-size:1.1em">\u2715</button>'
        + '</div>'
        + '<div id="calAvailTimeline"></div>';
    modal.appendChild(inner);
    document.body.appendChild(modal);
    _calBuildAvailTimeline();
};

var _availTimelineMonthsLoaded = 0;

async function _calBuildAvailTimeline() {
    var el = document.getElementById('calAvailTimeline');
    if (!el) return;
    _availTimelineMonthsLoaded = 0;
    el.innerHTML = '';
    await _calAppendAvailMonths(el, 3);
}

async function _calAppendAvailMonths(el, count) {
    if (!el) return;
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    if (!members.length) {
        Object.keys(bm).forEach(function(k) { members.push({ key: k, name: bm[k].name || k }); });
    }
    if (!members.length) { el.innerHTML = '<div style="color:var(--gl-text-tertiary);font-size:0.82em;padding:12px">No band members found.</div>'; return; }

    var blocked = _calCachedBlockedRanges;
    if (!blocked || !blocked.length) {
        try {
            if (typeof GLStore !== 'undefined' && GLStore.getScheduleBlocksAsRanges) {
                blocked = await GLStore.getScheduleBlocksAsRanges();
                _calCachedBlockedRanges = blocked;
            }
        } catch(e) { blocked = []; }
    }
    if (!blocked) blocked = [];

    var today = new Date();
    var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var cellW = 34;
    var startMonth = _availTimelineMonthsLoaded;

    for (var mi = 0; mi < count; mi++) {
        var mOffset = startMonth + mi;
        var monthStart = new Date(today.getFullYear(), today.getMonth() + mOffset, 1);
        var monthEnd = new Date(today.getFullYear(), today.getMonth() + mOffset + 1, 0);
        // For the current month, start from today
        var firstDay = (mOffset === 0) ? today.getDate() : 1;
        var numDays = monthEnd.getDate() - firstDay + 1;
        if (numDays <= 0) continue;

        var days = [];
        for (var d = 0; d < numDays; d++) {
            var dt = new Date(monthStart.getFullYear(), monthStart.getMonth(), firstDay + d);
            var ds = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
            var isToday = ds === (today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0'));
            days.push({ date: ds, day: dayNames[dt.getDay()], num: dt.getDate(), month: monthNames[dt.getMonth()], year: dt.getFullYear(), isWeekend: dt.getDay() === 0 || dt.getDay() === 6, isToday: isToday });
        }

        var monthBlock = document.createElement('div');
        monthBlock.style.cssText = 'margin-bottom:16px';

        // Month header
        var header = '<div style="font-size:0.78em;font-weight:800;color:var(--accent-light);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;padding-left:82px">'
            + monthNames[monthStart.getMonth()] + ' ' + monthStart.getFullYear() + '</div>';

        var html = header + '<div style="display:flex">';
        // Member name column (every month)
        html += '<div style="flex-shrink:0;width:80px;padding-top:24px">';
        members.forEach(function(m) {
            var name = (typeof m === 'object' ? m.name : bm[m] ? bm[m].name : m) || '';
            html += '<div style="height:28px;display:flex;align-items:center;font-size:0.72em;font-weight:600;color:var(--gl-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + name.split(' ')[0] + '</div>';
        });
        html += '</div>';
        // Date columns
        html += '<div style="overflow-x:auto;flex:1;-webkit-overflow-scrolling:touch;scrollbar-width:thin">';
        html += '<div style="display:flex;min-width:' + (numDays * cellW) + 'px">';
        days.forEach(function(day) {
            var bg = day.isToday ? 'rgba(99,102,241,0.15)' : day.isWeekend ? 'rgba(255,255,255,0.02)' : '';
            html += '<div style="width:' + cellW + 'px;flex-shrink:0;text-align:center;padding:2px 0;background:' + bg + '">';
            html += '<div style="font-size:0.5em;color:var(--gl-text-tertiary);font-weight:600">' + day.day + '</div>';
            html += '<div style="font-size:0.68em;font-weight:700;color:' + (day.isToday ? 'var(--accent-light)' : 'var(--gl-text-secondary)') + '">' + day.num + '</div>';
            html += '</div>';
        });
        html += '</div>';
        // Member rows
        members.forEach(function(m) {
            var key = (typeof m === 'object' ? m.key : m) || '';
            html += '<div style="display:flex;min-width:' + (numDays * cellW) + 'px">';
            days.forEach(function(day) {
                var isBlocked = blocked.some(function(b) { return b.person && (b.person === key || b.person === (bm[key] ? bm[key].name : '')) && b.startDate && b.endDate && day.date >= b.startDate && day.date <= b.endDate; });
                var bg = isBlocked ? 'rgba(239,68,68,0.2)' : day.isWeekend ? 'rgba(255,255,255,0.015)' : '';
                var border = isBlocked ? 'border:1px solid rgba(239,68,68,0.3)' : 'border:1px solid transparent';
                var label = isBlocked ? '\uD83D\uDEAB' : '\u2705';
                html += '<div style="width:' + cellW + 'px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.6em;background:' + bg + ';' + border + ';border-radius:3px">' + label + '</div>';
            });
            html += '</div>';
        });
        html += '</div></div>';
        monthBlock.innerHTML = html;
        el.appendChild(monthBlock);
    }

    _availTimelineMonthsLoaded += count;

    // Remove old sentinel if any
    var oldSentinel = el.querySelector('[data-avail-sentinel]');
    if (oldSentinel) oldSentinel.remove();

    // Add "Load more" sentinel
    var sentinel = document.createElement('div');
    sentinel.setAttribute('data-avail-sentinel', '1');
    sentinel.style.cssText = 'text-align:center;padding:12px';
    sentinel.innerHTML = '<button onclick="_calLoadMoreAvailMonths()" style="background:rgba(99,102,241,0.1);color:var(--accent-light);border:1px solid rgba(99,102,241,0.2);padding:6px 16px;border-radius:8px;font-size:0.72em;font-weight:600;cursor:pointer">Load more months</button>';
    el.appendChild(sentinel);

    // Auto-load more when scrolled near bottom
    var scrollParent = el.closest('#calAvailModal') ? el.parentElement : el;
    if (!scrollParent._availScrollWired) {
        scrollParent._availScrollWired = true;
        scrollParent.addEventListener('scroll', function() {
            if (scrollParent.scrollTop + scrollParent.clientHeight >= scrollParent.scrollHeight - 60) {
                _calLoadMoreAvailMonths();
            }
        });
    }

    // Legend (only on first render)
    if (startMonth === 0) {
        var legend = document.createElement('div');
        legend.style.cssText = 'display:flex;gap:12px;padding:8px 0 0;font-size:0.65em;color:var(--gl-text-tertiary)';
        legend.innerHTML = '<span>\u2705 Available</span><span>\uD83D\uDEAB Blocked</span><span style="color:var(--accent-light)">\u25CF Today</span><span style="opacity:0.6">Tinted = weekend</span>';
        el.insertBefore(legend, el.firstChild);
    }
}

window._calLoadMoreAvailMonths = function() {
    var el = document.getElementById('calAvailTimeline');
    if (!el) return;
    _calAppendAvailMonths(el, 2);
};

// ── View conflicts — highlight blocked days on calendar grid ─────────────────
window._calViewConflicts = function() {
    var grid = document.getElementById('calGrid');
    if (!grid) return;
    grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Semantic selector: data-blocked="true" added by grid renderers
    var blockedCells = grid.querySelectorAll('[data-blocked="true"]');
    if (!blockedCells.length) { if (typeof showToast === 'function') showToast('No conflicts this month'); return; }
    blockedCells.forEach(function(cell) {
        cell.classList.add('gl-day--pulse');
        setTimeout(function() { cell.classList.remove('gl-day--pulse'); }, 2000);
    });
};

window._calToggleConflictList = function() {
    var panel = document.getElementById('calConflictPanel');
    if (!panel) return;
    var isHidden = panel.style.display === 'none';
    if (isHidden) {
        _calRenderConflictPanel();
        panel.style.display = 'block';
        _calViewConflicts();
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        panel.style.display = 'none';
    }
};

// ── Full-width conflict panel (below calendar) ──────────────────────────────
function _calRenderConflictPanel() {
    var panel = document.getElementById('calConflictPanel');
    if (!panel) return;
    var blocked = _calCachedBlockedRanges || [];
    if (!blocked.length) {
        panel.innerHTML = '<div style="padding:16px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);text-align:center;font-size:0.82em;color:var(--gl-text-tertiary)">No conflicts or blocked dates</div>';
        return;
    }
    // Group by person
    var groups = {};
    blocked.forEach(function(b) {
        var person = b.person || 'Unknown';
        if (!groups[person]) groups[person] = [];
        groups[person].push(b);
    });
    var statusLabels = { unavailable:'Hard conflict', tentative:'Soft conflict', booked_elsewhere:'Booked elsewhere', vacation:'Vacation', travel:'Travel', personal_block:'Personal', hold:'Hold' };
    var html = '<div style="padding:16px 20px;border-radius:12px;background:rgba(255,255,255,0.015);border:1px solid rgba(255,255,255,0.06)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--gl-space-md,16px)">';
    html += '<div style="font-size:0.88em;font-weight:700;color:var(--gl-text)">\uD83D\uDEAB Conflicts & Blocked Dates <span style="font-weight:400;color:var(--gl-text-tertiary)">(' + blocked.length + ')</span></div>';
    html += '<button onclick="document.getElementById(\'calConflictPanel\').style.display=\'none\'" style="background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;font-size:0.85em;opacity:0.5">\u2715 Close</button>';
    html += '</div>';

    Object.keys(groups).forEach(function(person) {
        var items = groups[person];
        html += '<div style="margin-bottom:var(--gl-space-md,16px)">';
        html += '<div style="font-size:0.75em;font-weight:700;color:var(--gl-text-secondary);margin-bottom:6px">' + (typeof escHtml === 'function' ? escHtml(person) : person) + ' <span style="font-weight:400;color:var(--gl-text-tertiary)">(' + items.length + ')</span></div>';
        items.forEach(function(b) {
            var blockId = b._block ? b._block.blockId : null;
            var isSoft = b.status === 'tentative' || b.status === 'hold';
            var statusLabel = statusLabels[b.status] || 'Unavailable';
            var statusColor = isSoft ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.1)';
            var statusTextColor = isSoft ? '#fbbf24' : '#f87171';
            var startFmt = (typeof glFormatDate === 'function') ? glFormatDate(b.startDate, true) : b.startDate;
            var endFmt = (typeof glFormatDate === 'function') ? glFormatDate(b.endDate, true) : b.endDate;
            var _origBlock = b._block || null;
            var _isSynced = _origBlock && _origBlock.syncedToGoogle && _origBlock.googleEventId;
            var _isMyConflict = (typeof FeedActionState !== 'undefined' && FeedActionState.isMe) ? FeedActionState.isMe(b.person) : false;
            var _hasGoogleScope = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope());
            var deleteAction = '_calDeleteScheduleBlock(\'' + (blockId || '') + '\')';
            var editAction = '_calEditScheduleBlock(\'' + (blockId || '') + '\')';
            // Action buttons
            var actionsHtml = '';
            if (_isMyConflict && _hasGoogleScope && blockId && !_isSynced) {
                actionsHtml += '<button onclick="_calSyncExistingConflict(\'' + (blockId || '').replace(/'/g, "\\'") + '\')" style="font-size:0.68em;padding:3px 8px;border-radius:4px;border:1px solid rgba(66,133,244,0.2);background:rgba(66,133,244,0.06);color:#4285f4;cursor:pointer;white-space:nowrap">\uD83D\uDCC5 Push to Google</button>';
            }
            actionsHtml += '<button onclick="' + editAction + '" style="font-size:0.68em;padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-dim);cursor:pointer">\u270F\uFE0F</button>';
            actionsHtml += '<button onclick="' + deleteAction + '" style="font-size:0.68em;padding:3px 8px;border-radius:4px;border:none;background:rgba(239,68,68,0.1);color:#f87171;cursor:pointer">\u2715</button>';

            html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:4px;border-radius:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">';
            // Date range
            html += '<div style="flex:1;min-width:0">';
            html += '<div style="font-size:0.78em;color:var(--gl-text)">' + startFmt + ' \u2192 ' + endFmt + '</div>';
            html += '<div style="font-size:0.65em;color:var(--gl-text-tertiary);margin-top:1px">' + (b.reason || '') + '</div>';
            html += '</div>';
            // Status chip
            html += '<span style="font-size:0.62em;padding:2px 6px;border-radius:4px;background:' + statusColor + ';color:' + statusTextColor + ';white-space:nowrap;flex-shrink:0">' + statusLabel + '</span>';
            // Synced badge
            if (_isSynced) html += '<span style="font-size:0.65em;color:var(--gl-green);flex-shrink:0" title="Synced to Google Calendar">\u2705</span>';
            // Actions
            html += '<div style="display:flex;gap:4px;flex-shrink:0">' + actionsHtml + '</div>';
            html += '</div>';
        });
        html += '</div>';
    });
    html += '</div>';
    panel.innerHTML = html;
}

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

    var html = '<div style="margin-bottom:16px">';
    html += '<div class="cal-section-label">Next Up</div>';

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

        html += '<div class="cal-next-card" style="' + (isRisk ? 'border-color:rgba(245,158,11,0.2)' : '') + '">';
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

        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
        html += actionBtn;
        html += '</div>';
        // Sync state — always visible, subtle
        var _syncState = ev.sync ? ev.sync.status : null;
        if (_syncState === 'synced') {
            var _sLink = ev.sync.htmlLink || '';
            html += '<div style="font-size:0.6em;color:#22c55e;margin-top:4px;display:flex;align-items:center;gap:4px">\u2705 Synced with Google Calendar' + (_sLink ? ' <a href="' + _sLink + '" target="_blank" style="color:#4285f4;text-decoration:underline">Open</a>' : '') + '</div>';
        } else if (_syncState === 'needs_update') {
            html += '<div style="font-size:0.6em;color:#f59e0b;margin-top:4px">\u26A0 Needs calendar update</div>';
        } else if (_syncState === 'error') {
            html += '<div style="font-size:0.6em;color:#ef4444;margin-top:4px">\u274C Calendar sync failed</div>';
        } else {
            // Not synced — show add button
            if (typeof calBuildRehearsalGoogleLink === 'function' && ev.type === 'rehearsal') {
                html += '<button onclick="_calNextUpGcal(\'' + (ev.date || '').replace(/'/g, "\\'") + '\',\'' + (ev.time || '').replace(/'/g, "\\'") + '\',\'' + (ev.location || ev.venue || '').replace(/'/g, "\\'") + '\')" style="margin-top:4px;padding:4px 10px;border-radius:6px;border:1px solid rgba(66,133,244,0.15);background:none;color:#4285f4;font-size:0.6em;cursor:pointer">\uD83D\uDCC5 Add to Google Calendar</button>';
            } else if (typeof calBuildGigGoogleLink === 'function' && ev.type === 'gig') {
                html += '<button onclick="_calNextUpGigGcal(\'' + (ev.date || '').replace(/'/g, "\\'") + '\')" style="margin-top:4px;padding:4px 10px;border-radius:6px;border:1px solid rgba(66,133,244,0.15);background:none;color:#4285f4;font-size:0.6em;cursor:pointer">\uD83D\uDCC5 Add to Google Calendar</button>';
            }
        }
        html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
}

// Google Calendar helpers for Next Up cards
window._calNextUpGcal = function(date, time, location) {
    if (typeof calBuildRehearsalGoogleLink !== 'function') return;
    var url = calBuildRehearsalGoogleLink({ date: date, time: time || '19:00', location: location || '' }, '');
    if (url && url !== '#') { window.open(url, '_blank'); if (typeof showToast === 'function') showToast('\uD83D\uDCC5 Opening Google Calendar\u2026 send invites there'); }
};
window._calNextUpGigGcal = function(date) {
    if (typeof calBuildGigGoogleLink !== 'function') return;
    var gigs = window._loadedGigs || (typeof _cachedGigs !== 'undefined' ? _cachedGigs : []);
    var g = gigs.find(function(gig) { return gig.date === date; });
    if (!g) return;
    var url = calBuildGigGoogleLink(g);
    if (url && url !== '#') { window.open(url, '_blank'); if (typeof showToast === 'function') showToast('\uD83D\uDCC5 Opening Google Calendar\u2026 send invites there'); }
};

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
    // Decision anchor — lightweight recommendation
    '<div id="calDecisionAnchor" style="margin-bottom:var(--gl-space-md,16px)"></div>' +
    // Monthly Calendar — clean, borderless, dominant
    '<div style="margin-bottom:var(--gl-space-md,16px);padding:12px 0">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--gl-space-sm,8px)">' +
            '<button onclick="calNavMonth(-1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1em;padding:6px 10px">\u2190</button>' +
            '<span id="calMonthLabel" style="font-size:1.1em;font-weight:800;color:var(--text);letter-spacing:-0.02em;transition:opacity 0.12s ease">' + mNames[month] + ' ' + year + '</span>' +
            '<button onclick="calNavMonth(1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1em;padding:6px 10px">\u2192</button>' +
        '</div>' +
        '<div id="calGrid" style="transition:opacity 0.12s ease;will-change:opacity"></div>' +
    '</div>' +
    // Contextual actions — primary inline, secondary tucked away
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:var(--gl-space-md,16px)">' +
        '<button class="cal-action-btn cal-action-primary" onclick="calAddEvent()">Schedule Rehearsal</button>' +
        '<span style="margin-left:auto;display:flex;gap:6px">' +
            '<button onclick="calBlockDates()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.7em;padding:4px 8px;opacity:0.6" title="Block a date">\uD83D\uDEAB Block</button>' +
            '<button onclick="calShowSubscribeModal(window.currentBandSlug||\'deadcetera\')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.7em;padding:4px 8px;opacity:0.6" title="Subscribe to calendar feed">\uD83D\uDCC5 Subscribe</button>' +
        '</span>' +
    '</div>' +
    '<div id="calEventFormArea"></div>';

    // ── Context rail: Google panel (primary) + availability health + pressure ──
    var _ctxRail = document.getElementById('calContextRail');
    if (_ctxRail) {
        _ctxRail.innerHTML =
        // 1. Google Calendar connection panel (onboarding OR steady-state — rendered dynamically)
        '<div id="calGooglePanel"></div>' +
        // 2. Selected date context (populated by calDayClick)
        '<div id="calSelectedDayCard"></div>' +
        // 3. Band availability health (compact)
        '<div id="calAvailHealth"></div>' +
        // 4. Weekly pressure (gigs, missing rehearsals)
        '<div id="calWeeklyPressure"></div>' +
        // 5. Quick actions
        '<div style="padding-top:var(--gl-space-sm);display:flex;flex-direction:column;gap:4px">' +
            '<button onclick="_calShowAvailabilityModal()" class="gl-btn-ghost" style="width:100%;text-align:left;font-size:0.72em">Check availability</button>' +
            '<button onclick="_calToggleConflictList()" class="gl-btn-ghost" style="width:100%;text-align:left;font-size:0.72em">View conflicts</button>' +
        '</div>' +
        // Hidden containers for data loading (used by loadCalendarEvents)
        '<div id="calOnboardingCard" style="display:none"></div>' +
        '<div id="calSyncCoverage" style="display:none"></div>' +
        '<div id="calNextEventRail" style="display:none"></div>' +
        '<div id="calendarEvents" style="display:none"></div>' +
        '<div id="calAvailabilityMatrix" style="display:none"></div>' +
        '<div id="calConflictResolver" style="display:none"></div>';

        // Populate Google panel + availability + pressure
        _calPopulateNextEventRail(); // still loads data for internal use
        _calLoadConnections().then(function() {
            _calRenderGooglePanel();
            _calRenderAvailHealth();
            _calRenderWeeklyPressure();
            setTimeout(function() {
                _calValidateMyToken();
            }, 6000);
        });
        // Live connection updates — re-render when another member connects/disconnects
        _calWatchConnections();
        setTimeout(_calSyncAttendeeStatuses, 2000);
    }

    // Populate decision anchor above calendar
    _calRenderDecisionAnchor();

    // Load events, then build calendar grid + availability
    // Fallback: if loadCalendarEvents hasn't completed after all dependencies
    // are ready + 15s grace, render empty availability so the page isn't stuck.
    var _availRendered = false;
    if (typeof GLStore !== 'undefined' && GLStore.ready) {
        GLStore.ready(['firebase', 'members'], 30000).then(function() {
            setTimeout(function() {
                if (!_availRendered) {
                    console.log('[Calendar] Availability fallback — rendering without event data');
                    _calRenderAvailabilityMatrix([]);
                }
            }, 15000);
        });
    }

    // Wait for Firebase before loading events — prevents hang on loadBandDataFromDrive
    var _calLoadPromise = (typeof GLStore !== 'undefined' && GLStore.ready)
        ? GLStore.ready(['firebase'], 12000).then(function() { return loadCalendarEvents(); })
        : loadCalendarEvents();
    _calLoadPromise.catch(function(e) { console.warn('[Calendar] loadCalendarEvents failed:', e); return null; }).then(result => {
        _availRendered = true;
        const eventDates = result ? result.dateMap : {};
        const blockedRanges = result ? (result.blockedRanges || []) : [];
        const grid = document.getElementById('calGrid');
        if (!grid) return;
        let g = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;">';
        dNames.forEach((d,i) => {
            const w = i===0||i===6;
            g += `<div style="font-size:0.6em;font-weight:700;text-transform:uppercase;color:${w?'var(--accent-light)':'var(--gl-text-tertiary)'};text-align:center;padding:6px 0">${d}</div>`;
        });
        for (let i=0;i<firstDay;i++) g += '<div></div>';
        for (let d=1;d<=daysInMonth;d++) {
            const ds = `${monthPrefix}${String(d).padStart(2,'0')}`;
            const isToday = ds===todayStr;
            const dow = new Date(year,month,d).getDay();
            const w = dow===0||dow===6;
            const dayEvents = eventDates ? (eventDates[ds] || []) : [];
            const blockedList = blockedRanges.filter(b => b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate);
            const isBlocked = blockedList.length > 0;
            const hasHardConflict = blockedList.some(b => b._conflictType !== 'soft');
            const isSoftOnly = isBlocked && !hasHardConflict;
            // Determine dominant event type
            const isGig = dayEvents.some(e => e.type === 'gig');
            const isRehearsal = dayEvents.some(e => e.type === 'rehearsal');
            const hasEvent = dayEvents.length > 0;
            // State class (priority: gig > rehearsal > hard blocked > soft > best > default)
            const isFuture = ds >= todayStr;
            const isBest = isFuture && !hasEvent && !isBlocked && !w;
            let state = 'default';
            let stateClass = '';
            let icon = '';
            if (isGig) { state = 'gig'; stateClass = 'gl-day--gig'; icon = '\uD83C\uDFA4'; }
            else if (isRehearsal) { state = 'rehearsal'; stateClass = 'gl-day--rehearsal'; icon = '\uD83C\uDFB8'; }
            else if (isBlocked && !isSoftOnly) { state = 'blocked'; stateClass = 'gl-day--blocked'; }
            else if (isSoftOnly) { state = 'soft'; stateClass = 'gl-day--soft'; }
            else if (isBest) { state = 'best'; stateClass = 'gl-day--best'; }
            else if (hasEvent) { icon = dayEvents[0].type === 'meeting' ? '\uD83D\uDC65' : '\uD83D\uDCC5'; }
            if (isToday) stateClass += ' gl-day--today';
            // Hover content — explains the color with time-aware detail
            let hoverHtml = '';
            if (isGig) {
                const ev = dayEvents.find(e => e.type === 'gig');
                if (ev) {
                    hoverHtml = '<div class="gl-day-hover">';
                    if (ev.venue || ev.location) hoverHtml += '<div style="font-weight:600;color:var(--gl-text)">' + (ev.venue || ev.location) + '</div>';
                    if (ev.time) hoverHtml += '<div>' + ev.time + '</div>';
                    hoverHtml += '</div>';
                }
            } else if (isRehearsal) {
                const ev = dayEvents.find(e => e.type === 'rehearsal');
                if (ev) {
                    hoverHtml = '<div class="gl-day-hover">';
                    if (ev.time) hoverHtml += '<div>' + ev.time + '</div>';
                    if (ev.location || ev.venue) hoverHtml += '<div>' + (ev.location || ev.venue) + '</div>';
                    hoverHtml += '</div>';
                }
            } else if (isBlocked && blockedList.length) {
                // Determine event context for conflict explanation
                var _evtContext = isGig ? 'this gig' : isRehearsal ? 'rehearsal' : 'rehearsal';
                var _hardCount = blockedList.filter(function(x) { return x._conflictType !== 'soft'; }).length;
                var _softCount = blockedList.filter(function(x) { return x._conflictType === 'soft'; }).length;
                hoverHtml = '<div class="gl-day-hover">';
                // Summary line
                if (_hardCount && _softCount) hoverHtml += '<div style="font-size:0.9em;color:var(--gl-text-tertiary);margin-bottom:3px">' + _hardCount + ' conflict' + (_hardCount > 1 ? 's' : '') + ', ' + _softCount + ' same-day</div>';
                blockedList.slice(0,3).forEach(b => {
                    var name = (b.person || 'Member').split(' ')[0];
                    var time = b._timeLabel || '';
                    var conflictNote = b._conflictType === 'soft'
                        ? '<span style="color:var(--gl-text-tertiary)"> (same day, does not conflict)</span>'
                        : '<span style="color:#f87171"> (conflicts with ' + _evtContext + ')</span>';
                    hoverHtml += '<div>' + name + ' busy' + (time ? ' ' + time : '') + conflictNote + '</div>';
                });
                if (blockedList.length > 3) hoverHtml += '<div style="opacity:0.6">+' + (blockedList.length - 3) + ' more</div>';
                hoverHtml += '</div>';
            } else if (isBest) {
                var _syncCov = (typeof _calGetSyncCoverage === 'function') ? _calGetSyncCoverage() : null;
                var _bestExplain = 'No conflicts \u2014 everyone\u2019s clear';
                if (_syncCov && _syncCov.connected < _syncCov.total) {
                    _bestExplain = 'No conflicts from ' + _syncCov.connected + ' synced calendar' + (_syncCov.connected > 1 ? 's' : '');
                }
                hoverHtml = '<div class="gl-day-hover">' + _bestExplain + '</div>';
            } else if (state === 'default' && isFuture) {
                hoverHtml = '<div class="gl-day-hover" style="opacity:0.6">Open date</div>';
            }
            g += `<div class="gl-day ${stateClass}" data-date="${ds}" data-state="${state}"${isBlocked?' data-blocked="true"':''} onclick="calDayClick(${year},${month},${d})">
                <div class="gl-day-num">${d}</div>
                ${icon ? '<div class="gl-day-icon">' + icon + '</div>' : ''}
                ${hoverHtml}
            </div>`;
        }
        g += '</div>';
        grid.innerHTML = g;
        // Render availability matrix from blocked ranges
        _calCachedBlockedRanges = result ? (result.blockedRanges || []) : [];
        _calRenderAvailabilityMatrix(_calCachedBlockedRanges);
        // Overlay external Google Calendar events (non-blocking)
        _calOverlayExternalEvents(monthPrefix, daysInMonth);
    });
}

// Race-condition safe: each nav increments a sequence counter.
// Only the latest navigation's callback writes to the grid.
var _calNavSeq = 0;

function calNavMonth(dir) {
    calViewMonth += dir;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
    if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }

    // Update label with micro-fade (synchronous text, CSS transition on opacity)
    var mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var monthLabel = document.getElementById('calMonthLabel');
    if (monthLabel) {
        monthLabel.style.opacity = '0.3';
        monthLabel.textContent = mNames[calViewMonth] + ' ' + calViewYear;
        // Restore opacity after browser paints the new text
        requestAnimationFrame(function() { monthLabel.style.opacity = '1'; });
    }

    var grid = document.getElementById('calGrid');
    if (grid) {
        // Preserve height during transition to prevent collapse
        grid.style.minHeight = grid.offsetHeight + 'px';
        grid.style.opacity = '0.3';
        _calRenderGridOnly(grid);
    }
}

// Render just the calendar grid — race-condition safe, height-stable
function _calRenderGridOnly(grid) {
    // Snapshot month/year at call time — used in the callback to verify freshness
    var year = calViewYear, month = calViewMonth;
    var navId = ++_calNavSeq; // only latest nav writes

    var dNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var todayStr = new Date().toISOString().split('T')[0];
    var monthPrefix = year + '-' + String(month + 1).padStart(2, '0') + '-';

    loadCalendarEvents().then(function(result) {
        // Race guard: if a newer navigation happened, discard this result
        if (navId !== _calNavSeq) return;

        var eventDates = result ? result.dateMap : {};
        var blockedRanges = result ? (result.blockedRanges || []) : [];
        // Update cached blocked ranges for availability matrix
        _calCachedBlockedRanges = blockedRanges;
        if (!grid) return;

        var g = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
        dNames.forEach(function(d, i) {
            var w = i === 0 || i === 6;
            g += '<div style="font-size:0.6em;font-weight:700;text-transform:uppercase;color:' + (w ? 'var(--accent-light)' : 'var(--gl-text-tertiary)') + ';text-align:center;padding:6px 0">' + d + '</div>';
        });
        for (var i = 0; i < firstDay; i++) g += '<div></div>';
        for (var d = 1; d <= daysInMonth; d++) {
            var ds = monthPrefix + String(d).padStart(2, '0');
            var isToday = ds === todayStr;
            var dow = new Date(year, month, d).getDay();
            var dayEvents = eventDates[ds] || [];
            var blockedList = blockedRanges.filter(function(b) { return b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate; });
            var isBlocked = blockedList.length > 0;
            var hasHardConflict = blockedList.some(function(b) { return b._conflictType !== 'soft'; });
            var isSoftOnly = isBlocked && !hasHardConflict;
            var isGig = dayEvents.some(function(e) { return e.type === 'gig'; });
            var isRehearsal = dayEvents.some(function(e) { return e.type === 'rehearsal'; });
            var hasEvent = dayEvents.length > 0;
            var w = dow === 0 || dow === 6;
            var isFuture = ds >= todayStr;
            var isBest = isFuture && !hasEvent && !isBlocked && !w;
            var state = 'default';
            var stateClass = '';
            var icon = '';
            if (isGig) { state = 'gig'; stateClass = 'gl-day--gig'; icon = '\uD83C\uDFA4'; }
            else if (isRehearsal) { state = 'rehearsal'; stateClass = 'gl-day--rehearsal'; icon = '\uD83C\uDFB8'; }
            else if (isBlocked && !isSoftOnly) { state = 'blocked'; stateClass = 'gl-day--blocked'; }
            else if (isSoftOnly) { state = 'soft'; stateClass = 'gl-day--soft'; }
            else if (isBest) { state = 'best'; stateClass = 'gl-day--best'; }
            else if (hasEvent) { icon = '\uD83D\uDCC5'; }
            if (isToday) stateClass += ' gl-day--today';
            // Hover content — explains the color with time-aware detail
            var hoverHtml = '';
            if (isGig) {
                var ev = dayEvents.find(function(e) { return e.type === 'gig'; });
                if (ev) {
                    hoverHtml = '<div class="gl-day-hover">';
                    if (ev.venue || ev.location) hoverHtml += '<div style="font-weight:600;color:var(--gl-text)">' + (ev.venue || ev.location) + '</div>';
                    if (ev.time) hoverHtml += '<div>' + ev.time + '</div>';
                    hoverHtml += '</div>';
                }
            } else if (isRehearsal) {
                var ev = dayEvents.find(function(e) { return e.type === 'rehearsal'; });
                if (ev) {
                    hoverHtml = '<div class="gl-day-hover">';
                    if (ev.time) hoverHtml += '<div>' + ev.time + '</div>';
                    if (ev.location || ev.venue) hoverHtml += '<div>' + (ev.location || ev.venue) + '</div>';
                    hoverHtml += '</div>';
                }
            } else if (isBlocked) {
                if (blockedList.length) {
                    var _evCtx = isGig ? 'this gig' : 'rehearsal';
                    var _hCnt = blockedList.filter(function(x) { return x._conflictType !== 'soft'; }).length;
                    var _sCnt = blockedList.filter(function(x) { return x._conflictType === 'soft'; }).length;
                    hoverHtml = '<div class="gl-day-hover">';
                    if (_hCnt && _sCnt) hoverHtml += '<div style="font-size:0.9em;color:var(--gl-text-tertiary);margin-bottom:3px">' + _hCnt + ' conflict' + (_hCnt > 1 ? 's' : '') + ', ' + _sCnt + ' same-day</div>';
                    blockedList.slice(0,3).forEach(function(b) {
                        var nm = (b.person || 'Member').split(' ')[0];
                        var tm = b._timeLabel || '';
                        var note = b._conflictType === 'soft'
                            ? '<span style="color:var(--gl-text-tertiary)"> (same day, does not conflict)</span>'
                            : '<span style="color:#f87171"> (conflicts with ' + _evCtx + ')</span>';
                        hoverHtml += '<div>' + nm + ' busy' + (tm ? ' ' + tm : '') + note + '</div>';
                    });
                    if (blockedList.length > 3) hoverHtml += '<div style="opacity:0.6">+' + (blockedList.length - 3) + ' more</div>';
                    hoverHtml += '</div>';
                }
            } else if (isBest) {
                var _syncCov2 = (typeof _calGetSyncCoverage === 'function') ? _calGetSyncCoverage() : null;
                var _bestExp = 'No conflicts \u2014 everyone\u2019s clear';
                if (_syncCov2 && _syncCov2.connected < _syncCov2.total) {
                    _bestExp = 'No conflicts from ' + _syncCov2.connected + ' synced calendar' + (_syncCov2.connected > 1 ? 's' : '');
                }
                hoverHtml = '<div class="gl-day-hover">' + _bestExp + '</div>';
            } else if (state === 'default' && isFuture) {
                hoverHtml = '<div class="gl-day-hover" style="opacity:0.6">Open date</div>';
            }
            g += '<div class="gl-day ' + stateClass + '" data-date="' + ds + '" data-state="' + state + '"' + (isBlocked ? ' data-blocked="true"' : '') + ' onclick="calDayClick(' + year + ',' + month + ',' + d + ')">'
                + '<div class="gl-day-num">' + d + '</div>'
                + (icon ? '<div class="gl-day-icon">' + icon + '</div>' : '')
                + hoverHtml
                + '</div>';
        }
        g += '</div>';
        grid.innerHTML = g;
        grid.style.opacity = '1';
        grid.style.minHeight = ''; // release height lock after render
        _calOverlayExternalEvents(monthPrefix, daysInMonth);
    }).catch(function() {
        // Network error fallback — render empty grid, don't hang
        if (navId !== _calNavSeq) return;
        grid.style.opacity = '1';
        grid.style.minHeight = '';
    });
}


var _calEventsByDate = {}; // { 'YYYY-MM-DD': [event, ...] } — cached during render

async function loadCalendarEvents() {
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    // Cache events by date for quick lookup in calDayClick
    _calEventsByDate = {};
    events.forEach(function(ev, idx) { if (ev.date) { if (!_calEventsByDate[ev.date]) _calEventsByDate[ev.date] = []; _calEventsByDate[ev.date].push(Object.assign({}, ev, { _idx: idx })); } });

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
    // Note: el may be null if context rail hasn't rendered yet.
    // Do NOT return early — blocked data must still load for the grid.
    const today = new Date().toISOString().split('T')[0];
    var futureEnd = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
    var expandedUpcoming = expandRecurringEvents(events, today, futureEnd);
    const upcoming = expandedUpcoming.filter(function(e) { return (e.date || '') >= today; })
        .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    if (!el) {
        // calendarEvents not in DOM yet — skip upcoming rendering, proceed to blocked data
    } else if (upcoming.length === 0) {
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
    // Build per-date event windows from gig/rehearsal events for accurate conflict classification
    // Gigs use their actual start/end time; dates without events use the default rehearsal window
    var _dateWindows = {};
    Object.keys(dateMap).forEach(function(ds) {
        var dayEvts = dateMap[ds];
        dayEvts.forEach(function(ev) {
            if (ev.type === 'gig' && ev.time) {
                // Parse gig time (e.g., "19:00" or "7:30 PM") into start hour
                var gStart = parseInt(ev.time.split(':')[0], 10);
                if (isNaN(gStart)) return;
                // Estimate gig duration: use end time if available, otherwise assume 3 hours
                var gEnd = gStart + 3;
                if (ev.endTime) {
                    var eH = parseInt(ev.endTime.split(':')[0], 10);
                    if (!isNaN(eH)) gEnd = eH;
                } else if (ev.duration) {
                    gEnd = gStart + Math.ceil(ev.duration / 60);
                }
                _dateWindows[ds] = { startHour: gStart, endHour: Math.min(gEnd, 26) };
            }
        });
    });

    // Merge Google Calendar free/busy — current user + all connected members
    // Load availability settings for time-aware conflict classification
    var _fbOpts = { rehearsalStartHour: 17, rehearsalEndHour: 23, ignoreAllDay: true, timeAware: true, dateWindows: _dateWindows };
    try {
        if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.getAvailabilitySettings) {
            var _avSettings = await GLCalendarSync.getAvailabilitySettings();
            if (_avSettings) {
                if (_avSettings.rehearsalWindow) {
                    _fbOpts.rehearsalStartHour = _avSettings.rehearsalWindow.startHour || 17;
                    _fbOpts.rehearsalEndHour = _avSettings.rehearsalWindow.endHour || 23;
                }
                if (typeof _avSettings.ignoreAllDay !== 'undefined') _fbOpts.ignoreAllDay = _avSettings.ignoreAllDay;
                if (typeof _avSettings.timeAware !== 'undefined') _fbOpts.timeAware = _avSettings.timeAware;
            }
        }
    } catch(e) {}
    try {
        var _fbTimeMin = calViewYear + '-' + String(calViewMonth + 1).padStart(2, '0') + '-01T00:00:00Z';
        var _fbDaysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
        var _fbTimeMax = calViewYear + '-' + String(calViewMonth + 1).padStart(2, '0') + '-' + String(_fbDaysInMonth).padStart(2, '0') + 'T23:59:59Z';
        // Current user: query Google directly (has own OAuth token)
        if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope()) {
            var _fbData = await GLCalendarSync.getFreeBusy(_fbTimeMin, _fbTimeMax);
            if (_fbData.source === 'unavailable' || _fbData.source === 'needs_consent') {
                // FreeBusy not available — silently skip (events scope still works for other features)
            } else {
                var _myName = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyDisplayName) ? FeedActionState.getMyDisplayName() : 'You';
                var _myBlocks = GLCalendarSync.freeBusyToBlockedRanges(_fbData, _myName, _fbOpts);
                if (_myBlocks.length) blocked = blocked.concat(_myBlocks);
            }
        }
        // Other members: read their shared free/busy from Firebase
        if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.getAllMembersFreeBusy) {
            var _allFb = await GLCalendarSync.getAllMembersFreeBusy();
            var _myKey = (typeof FeedActionState !== 'undefined' && FeedActionState.getMyMemberKey) ? FeedActionState.getMyMemberKey() : null;
            var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
            Object.keys(_allFb).forEach(function(mk) {
                if (mk === _myKey) return; // skip self — already queried directly
                var fb = _allFb[mk];
                if (!fb || !fb.busy || !fb.busy.length) return;
                // Check freshness: only use data < 1 hour old
                if (fb.updatedAt && (Date.now() - new Date(fb.updatedAt).getTime() > 3600000)) return;
                var memberName = bm[mk] ? bm[mk].name : mk;
                var memberBlocks = GLCalendarSync.freeBusyToBlockedRanges(fb, memberName, _fbOpts);
                if (memberBlocks.length) blocked = blocked.concat(memberBlocks);
            });
        }
        var _totalGoogleBlocks = blocked.filter(function(b) { return b._source === 'google'; }).length;
        var _softBlocks = blocked.filter(function(b) { return b._conflictType === 'soft'; }).length;
        if (_totalGoogleBlocks) console.log('[Calendar] Google free/busy merged:', _totalGoogleBlocks, 'ranges (' + _softBlocks + ' soft, all members)');
    } catch(e) { console.warn('[Calendar] Free/busy merge failed:', e); }
    // Sort blocked dates chronologically
    blocked.sort(function(a, b) { return (a.startDate || '').localeCompare(b.startDate || ''); });
    console.log('[Calendar] Total blocked ranges:', blocked.length, '| calendarEvents el:', !!el);
    // Cache blocked ranges for conflict panel (rendered on toggle)
    _calCachedBlockedRanges = blocked;
    // Update availability health in right rail now that we have conflict data
    _calRenderAvailHealth();
    // Re-render conflict panel if it's currently visible
    var _conflictPanel = document.getElementById('calConflictPanel');
    if (_conflictPanel && _conflictPanel.style.display !== 'none') {
        _calRenderConflictPanel();
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

async function _calRenderAvailabilityMatrix(blockedRanges) {
    var el = document.getElementById('calAvailabilityMatrix');
    if (!el) return;

    // Show the grid immediately with availability data, THEN overlay recommendation annotations async
    // This prevents the "Loading..." hang — user sees the grid right away
    _calRenderAvailabilityGridSync(el, blockedRanges);

    // Async: wait for members to load, then overlay recommendation annotations
    try {
        if (typeof GLStore !== 'undefined' && GLStore.getRehearsalDateRecommendations) {
            await GLStore.ready(['members'], 15000);
            var _recData = await GLStore.getRehearsalDateRecommendations();
            if (_recData) {
                _calRenderAvailabilityGridSync(el, blockedRanges, _recData);
            }
        }
    } catch(e) {
        console.warn('[Calendar] Recommendation annotations unavailable:', e.message);
    }
}

function _calRenderAvailabilityGridSync(el, blockedRanges, recData) {
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
    if (!members.length) {
        // bandMembers may not be loaded yet — retry up to 3 times
        var _retryCount = el._retryCount || 0;
        if (_retryCount < 3) {
            el._retryCount = _retryCount + 1;
            setTimeout(function() { _calRenderAvailabilityGridSync(el, blockedRanges, recData); }, 1500);
        } else {
            el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:0.78em">No band members found. <a href="#" onclick="showPage(\'settings\');return false" style="color:var(--accent-light)">Add members in Settings</a></div>';
        }
        return;
    }

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

    // Use recommendation data if provided (async overlay), otherwise render without
    var _tooCloseDates = {};
    var _primaryDate = null;
    var _altDates = {};
    if (recData) {
        if (recData.primary) _primaryDate = recData.primary.date;
        (recData.alternatives || []).forEach(function(a) { _altDates[a.date] = true; });
        (recData.tooClose || []).forEach(function(c) { _tooCloseDates[c.date] = c.penalties && c.penalties[0] ? c.penalties[0] : 'Too close'; });
    }

    // Range controls
    var rangeHtml = '<div style="display:flex;gap:4px;margin-bottom:8px">';
    [7, 14, 30, 60, 90].forEach(function(n) {
        var active = numDays === n;
        rangeHtml += '<button onclick="calMatrixRange(' + n + ')" style="background:' + (active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)') +
            ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + ';border:1px solid ' + (active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)') +
            ';padding:3px 10px;border-radius:6px;font-size:0.72em;font-weight:700;cursor:pointer">' + n + ' days</button>';
    });
    rangeHtml += '</div>';

    // Table with month headers
    var html = rangeHtml;
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
        // Color-code by recommendation status
        var isPrimary = day.date === _primaryDate;
        var isAlt = _altDates[day.date];
        var isTooClose = _tooCloseDates[day.date];
        var bg = isPrimary ? 'rgba(34,197,94,0.15)' : isAlt ? 'rgba(34,197,94,0.06)' : isTooClose ? 'rgba(245,158,11,0.06)' : (allFree && allFree.allFree ? 'rgba(34,197,94,0.04)' : '');
        var headerColor = isPrimary ? '#22c55e' : isTooClose ? '#f59e0b' : (day.isWeekend ? 'var(--accent-light)' : 'var(--text-dim)');
        var monthBorder = day.isFirstOfMonth && day.dayNum === 1 ? 'border-left:3px solid rgba(99,102,241,0.5);' : '';
        var topBorder = isPrimary ? 'border-top:2px solid #22c55e;' : isTooClose ? 'border-top:2px solid rgba(245,158,11,0.3);' : '';
        var title = isPrimary ? 'Best date' : isTooClose ? (typeof _tooCloseDates[day.date] === 'string' ? _tooCloseDates[day.date] : 'Too close') : '';
        html += '<th style="text-align:center;padding:4px 2px;color:' + headerColor +
            ';font-weight:' + (isPrimary ? '800' : '600') + ';font-size:0.85em;border-bottom:1px solid rgba(255,255,255,0.08);background:' + bg + ';' + monthBorder + topBorder +
            'cursor:pointer" onclick="calShowDateConflicts(\'' + day.date + '\')"' + (title ? ' title="' + title + '"' : '') + '>' +
            day.label.charAt(0) + '<br><span style="font-size:0.9em">' + day.dayNum + '</span>' +
            (isPrimary ? '<br><span style="font-size:0.42em;font-weight:800;color:#22c55e;letter-spacing:0.05em">BEST</span>' : '') +
            (isTooClose ? '<br><span style="font-size:0.38em;color:#f59e0b;letter-spacing:0.03em">CLOSE</span>' : '') +
            '</th>';
    });
    html += '</tr>';

    members.forEach(function(member) {
        html += '<tr>';
        html += '<td style="padding:4px 6px;color:var(--text-muted);font-weight:600;white-space:nowrap;border-bottom:1px solid rgba(255,255,255,0.03);position:sticky;left:0;background:#0f172a;z-index:1">' + member.split(' ')[0] + '</td>';
        days.forEach(function(day) {
            // Heatmap column colors based on recommendation status
            var isPrimary = day.date === _primaryDate;
            var isTooClose = !!_tooCloseDates[day.date];
            var bgCol = isPrimary ? 'rgba(34,197,94,0.08)' : isTooClose ? 'rgba(245,158,11,0.04)' : '';
            var cellContent = '<span style="color:#22c55e;opacity:0.3">\u2714</span>';
            if (useRichEval) {
                var mStatus = GLStore.evaluateMemberDateStatus(schedBlocks, member, day.date);
                if (mStatus.status === 'hard_conflict') {
                    cellContent = '<span style="color:#ef4444">\u2716</span>';
                    if (!bgCol) bgCol = 'rgba(239,68,68,0.04)';
                } else if (mStatus.status === 'soft_conflict') {
                    cellContent = '<span style="color:#f59e0b">~</span>';
                }
            } else {
                var blocked = blockedRanges.some(function(b) { return b.person === member && b.startDate && b.endDate && day.date >= b.startDate && day.date <= b.endDate; });
                if (blocked) { cellContent = '<span style="color:#ef4444">\u2716</span>'; bgCol = 'rgba(239,68,68,0.04)'; }
            }
            var monthBorder = day.isFirstOfMonth && day.dayNum === 1 ? 'border-left:2px solid rgba(99,102,241,0.3);' : '';
            html += '<td style="text-align:center;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.02);background:' + bgCol + ';' + monthBorder + '">' + cellContent + '</td>';
        });
        html += '</tr>';
    });

    // Footer row: spacing-aware status
    html += '<tr><td style="padding:4px 6px;color:var(--text-dim);font-size:0.8em;font-weight:600;position:sticky;left:0;background:#0f172a;z-index:1">Status</td>';
    dayAvail.forEach(function(d) {
        var mb = d.day.isFirstOfMonth && d.day.dayNum === 1 ? 'border-left:3px solid rgba(99,102,241,0.5);' : '';
        var isPrimary = d.day.date === _primaryDate;
        var isTooClose = !!_tooCloseDates[d.day.date];
        var footerLabel = '';
        var footerColor = '';
        if (isPrimary) { footerLabel = '\u2605'; footerColor = '#22c55e'; }
        else if (isTooClose) { footerLabel = '\u26A0'; footerColor = '#f59e0b'; }
        else if (d.strength) {
            footerLabel = { 'Strong':'\u2714', 'Workable':'~', 'Risky':'!', 'Not viable':'\u2716' }[d.strength.label] || '?';
            footerColor = d.strength.color;
        } else {
            footerLabel = '' + d.freeCount;
            footerColor = d.allFree ? '#22c55e' : d.freeCount >= members.length - 1 ? '#fbbf24' : 'var(--text-dim)';
        }
        var title = isPrimary ? 'Recommended' : isTooClose ? 'Too close to existing rehearsal' : (d.strength ? d.strength.label : d.freeCount + ' free');
        html += '<td style="text-align:center;padding:4px 2px;font-size:0.75em;font-weight:800;color:' + footerColor + ';' + mb + '" title="' + title + '">' + footerLabel + '</td>';
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
        + '<div class="form-row"><span class="form-label">Start Date</span><input class="app-input" id="blockStart" type="date"></div>'
        + '<div class="form-row"><span class="form-label">End Date</span><input class="app-input" id="blockEnd" type="date"></div>'
        + '<div class="form-row"><span class="form-label">Who</span><select class="app-select" id="blockPerson">' + memberOpts + '</select></div>'
        + '<div class="form-row"><span class="form-label">Type</span><select class="app-select" id="blockStatus">' + statusOpts + '</select></div>'
        + '<div class="form-row"><span class="form-label">Reason</span><input class="app-input" id="blockReason" placeholder="e.g. Family vacation"></div>'
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
        // Preserve googleEventId from existing block when editing
        var _existingGoogleEventId = null;
        if (editingId && typeof GLStore !== 'undefined' && GLStore.getScheduleBlocks) {
            var _existBlocks = await GLStore.getScheduleBlocks();
            var _existBlock = _existBlocks.find(function(b) { return b.blockId === editingId; });
            if (_existBlock && _existBlock.googleEventId) _existingGoogleEventId = _existBlock.googleEventId;
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
        if (_existingGoogleEventId) {
            block.googleEventId = _existingGoogleEventId;
            block.syncedToGoogle = true;
        }
        var savedBlock = await GLStore.saveScheduleBlock(block);
        var finalBlockId = (savedBlock && savedBlock.blockId) || block.blockId || editingId;
        // If editing and already synced to Google, auto-update silently
        if (editingId && block.googleEventId) {
            block.blockId = finalBlockId;
            var _upd = await GLCalendarSync.updateConflictInGoogle(block);
            if (_upd.success) {
                if (typeof showToast === 'function') showToast('Google Calendar updated');
            }
        }
        window._calEditingBlockId = null;
        document.getElementById('calEventFormArea').innerHTML = '';
        renderCalendarInner();
        // Show Google sync prompt (only for own conflicts, only if connected)
        var _isMe = (typeof FeedActionState !== 'undefined' && FeedActionState.isMe) ? FeedActionState.isMe(personName) : false;
        var _hasScope = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope());
        if (_isMe && _hasScope && !editingId) {
            _calShowGoogleSyncPrompt(finalBlockId, block);
        }
    } else {
        // Fallback: save to legacy blocked_dates
        var ex = toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || []);
        ex.push({ startDate: startDate, endDate: endDate, person: personName, reason: reason });
        await saveBandDataToDrive('_band', 'blocked_dates', ex);
        window._calEditingBlockId = null;
        document.getElementById('calEventFormArea').innerHTML = '';
        renderCalendarInner();
    }
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
        <div class="form-row"><span class="form-label">Start Date</span><input class="app-input" id="blockStart" type="date" value="${b.startDate||''}"></div>
        <div class="form-row"><span class="form-label">End Date</span><input class="app-input" id="blockEnd" type="date" value="${b.endDate||''}"></div>
        <div class="form-row"><span class="form-label">Who</span><select class="app-select" id="blockPerson">${Object.entries(bandMembers).map(([k,m])=>`<option value="${m.name}" ${m.name===b.person?'selected':''}>${m.name}</option>`).join('')}</select></div>
        <div class="form-row"><span class="form-label">Reason</span><input class="app-input" id="blockReason" placeholder="e.g. Family vacation" value="${b.reason||''}"></div>
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
    // Check if synced to Google before deleting
    var googleEventId = null;
    if (blockId.indexOf('_legacy_') !== 0 && typeof GLStore !== 'undefined' && GLStore.getScheduleBlocks) {
        var _blocks = await GLStore.getScheduleBlocks();
        var _block = _blocks.find(function(b) { return b.blockId === blockId; });
        if (_block && _block.googleEventId) googleEventId = _block.googleEventId;
    }
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
    // If was synced to Google, ask to remove there too
    if (googleEventId && typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope()) {
        if (confirm('Also remove from your Google Calendar?')) {
            var result = await GLCalendarSync.deleteConflictFromGoogle(googleEventId);
            if (result.success) {
                if (typeof showToast === 'function') showToast('Removed from Google Calendar');
            } else {
                if (typeof showToast === 'function') showToast('Couldn\u2019t remove from Google Calendar');
            }
        }
    }
    renderCalendarInner();
};

// ── Google Calendar sync prompt after conflict save ──────────────────────────
function _calShowGoogleSyncPrompt(blockId, block) {
    var area = document.getElementById('calEventFormArea');
    if (!area) return;
    area.innerHTML = '<div style="padding:12px;border-radius:10px;background:rgba(66,133,244,0.06);border:1px solid rgba(66,133,244,0.15);margin-bottom:8px">'
        + '<div style="font-size:0.82em;font-weight:600;color:#4285f4;margin-bottom:6px">Also add this to your Google Calendar?</div>'
        + '<div style="display:flex;gap:8px">'
        + '<button onclick="_calSyncConflictToGoogle(\'' + (blockId || '').replace(/'/g, "\\'") + '\')" style="font-size:0.75em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(66,133,244,0.3);background:rgba(66,133,244,0.15);color:#4285f4">\uD83D\uDCC5 Add to Google</button>'
        + '<button onclick="document.getElementById(\'calEventFormArea\').innerHTML=\'\'" style="font-size:0.75em;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid var(--gl-border);background:none;color:var(--gl-text-tertiary)">Keep here only</button>'
        + '</div></div>';
}

window._calSyncConflictToGoogle = async function(blockId) {
    var area = document.getElementById('calEventFormArea');
    if (area) area.innerHTML = '<div style="padding:12px;font-size:0.78em;color:var(--gl-text-tertiary)">Syncing\u2026</div>';
    // Load block data
    var block = null;
    if (typeof GLStore !== 'undefined' && GLStore.getScheduleBlocks) {
        var blocks = await GLStore.getScheduleBlocks();
        block = blocks.find(function(b) { return b.blockId === blockId; });
    }
    if (!block) { if (area) area.innerHTML = ''; return; }
    var result = await GLCalendarSync.syncConflictToGoogle(block);
    if (result.success) {
        // Save googleEventId back to the block
        block.googleEventId = result.googleEventId;
        block.syncedToGoogle = true;
        if (typeof GLStore !== 'undefined' && GLStore.saveScheduleBlock) {
            await GLStore.saveScheduleBlock(block);
        }
        if (typeof showToast === 'function') showToast('\u2713 Added to your Google Calendar');
    } else {
        if (typeof showToast === 'function') showToast('Couldn\u2019t add to Google Calendar');
    }
    if (area) area.innerHTML = '';
};

// Sync an existing/legacy conflict to Google Calendar (from the list button)
window._calSyncExistingConflict = async function(blockId) {
    if (!blockId) return;
    var block = null;
    if (typeof GLStore !== 'undefined' && GLStore.getScheduleBlocks) {
        var blocks = await GLStore.getScheduleBlocks();
        block = blocks.find(function(b) { return b.blockId === blockId; });
    }
    if (!block) { if (typeof showToast === 'function') showToast('Block not found'); return; }
    if (block.syncedToGoogle && block.googleEventId) {
        if (typeof showToast === 'function') showToast('Already synced to Google Calendar');
        return;
    }
    var result = await GLCalendarSync.syncConflictToGoogle(block);
    if (result.success) {
        block.googleEventId = result.googleEventId;
        block.syncedToGoogle = true;
        if (typeof GLStore !== 'undefined' && GLStore.saveScheduleBlock) {
            await GLStore.saveScheduleBlock(block);
        }
        if (typeof showToast === 'function') showToast('\u2713 Added to your Google Calendar');
        renderCalendarInner();
    } else {
        if (typeof showToast === 'function') showToast('Couldn\u2019t add to Google Calendar');
    }
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
        // Conflict summary in plain language
        var _csHard = strength.hardConflictCount || 0;
        var _csSoft = strength.softConflictCount || 0;
        var _csAvail = strength.available || 0;
        var _csTotal = strength.total || 0;
        var _csSummary = _csAvail + ' of ' + _csTotal + ' clear';
        if (_csHard > 0) _csSummary += ' \u00B7 ' + _csHard + ' conflict' + (_csHard > 1 ? 's' : '');
        if (_csSoft > 0) _csSummary += ' \u00B7 ' + _csSoft + ' same-day';
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
            + '<span style="font-size:0.82em;font-weight:800;color:' + strength.color + '">' + strength.label + '</span>'
            + '<span style="font-size:0.68em;color:var(--text-dim)">' + _csSummary + '</span>'
            + '</div>';
    }

    // Per-member breakdown
    if (strength && strength.memberStatuses) {
        html += '<div style="margin-bottom:10px">';
        var statusIcons = { available: '\u2705', hard_conflict: '\u274C', soft_conflict: '\u26A0' };
        var statusColors = { available: '#22c55e', hard_conflict: '#ef4444', soft_conflict: '#f59e0b' };

        members.forEach(function(member) {
            var ms = strength.memberStatuses[member];
            if (!ms) return;
            var icon = statusIcons[ms.status] || '?';
            var color = statusColors[ms.status] || '#64748b';
            // Build human-readable detail from block data
            var label = 'Available';
            var detail = '';
            if (ms.status === 'hard_conflict' && ms.blocks && ms.blocks.length > 0) {
                var hb = ms.blocks[0];
                label = hb._timeLabel ? 'Busy ' + hb._timeLabel : 'Unavailable';
                detail = ' (conflicts)';
            } else if (ms.status === 'soft_conflict' && ms.blocks && ms.blocks.length > 0) {
                var sb = ms.blocks[0];
                label = sb._timeLabel ? 'Busy ' + sb._timeLabel : 'Same-day event';
                detail = ' (does not conflict)';
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
    var ds = y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');

    // Mobile: show bottom card instead of right rail
    if (window.innerWidth <= 640) {
        _calShowMobileDateCard(ds, y, m, d);
        return;
    }

    // ── CONTEXT MODE: hide global insights, show date-specific ──
    var _globalSections = ['calAvailHealth', 'calWeeklyPressure'];
    _globalSections.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Desktop: show selected-date context in right rail
    var ctxRail = document.getElementById('calContextRail');
    if (ctxRail) {
        var dateObj = new Date(y, m, d);
        var dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        var blocked = _calCachedBlockedRanges ? _calCachedBlockedRanges.filter(function(b) { return b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate; }) : [];
        var isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        var _dq = (typeof GLScheduleQuality !== 'undefined') ? GLScheduleQuality.forDate(blocked.length, isWeekend) : { label: '', color: 'var(--gl-text-tertiary)', level: 'fair' };
        var hint = _dq.label;
        var hintColor = _dq.color;
        var safDs = ds.replace(/'/g, "\\'");
        var borderColor = blocked.length > 0 ? 'var(--gl-amber)' : 'var(--gl-green)';

        // External Google events for this date
        var _extEvents = _calExternalEventsCache[ds] || [];
        var _extHtml = '';
        if (_extEvents.length) {
            _extHtml = '<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--gl-border-subtle);font-size:0.72em;color:var(--gl-text-tertiary)">';
            _extHtml += '<div style="font-weight:600;margin-bottom:2px">Google Calendar</div>';
            _extEvents.slice(0, 3).forEach(function(e) {
                _extHtml += '<div>' + (e.title || 'Busy') + (e.time ? ' \u00B7 ' + e.time : '') + '</div>';
            });
            _extHtml += '</div>';
        }

        // ── SECTION: Per-member availability for this date ──
        var _allMembers = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
        var _bm2 = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        var _hasAvailScope = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasFreeBusyScope && GLCalendarSync.hasFreeBusyScope());
        var _conflictSummary = '';

        if (_allMembers.length > 0 && (blocked.length > 0 || _hasAvailScope) && ds >= new Date().toISOString().split('T')[0]) {
            _conflictSummary = '<div style="font-size:0.62em;font-weight:700;color:var(--gl-text-tertiary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Availability</div>';
            // Build per-member availability map
            var _memberBlocks = {};
            blocked.forEach(function(b) {
                var nm = (b.person || 'Unknown').split(' ')[0];
                if (!_memberBlocks[nm]) _memberBlocks[nm] = [];
                _memberBlocks[nm].push(b);
            });
            // Stale data warning
            if (_calConnectedCacheTime > 0) {
                var _staleMin = Math.floor((Date.now() - _calConnectedCacheTime) / 60000);
                if (_staleMin > 5) {
                    _conflictSummary += '<div style="font-size:0.62em;color:var(--gl-amber);margin-bottom:4px">\u26A0 Availability may be outdated \u2014 last synced ' + _staleMin + ' min ago</div>';
                }
            }
            _allMembers.forEach(function(ref) {
                var mKey = (typeof ref === 'object') ? ref.key : ref;
                var name = _bm2[mKey] ? _bm2[mKey].name : mKey;
                var short = name.split(' ')[0];
                var blocks = _memberBlocks[short] || [];
                if (blocks.length > 0) {
                    // Show strongest conflict first (hard > soft, all-day > timed)
                    var _sorted = blocks.slice().sort(function(a, b) {
                        if (a._conflictType === 'hard' && b._conflictType !== 'hard') return -1;
                        if (a._isAllDay && !b._isAllDay) return -1;
                        return 0;
                    });
                    var _primary = _sorted[0];
                    var icon = _primary._conflictType === 'hard' ? '\u2716' : '\u26A0';
                    var color = _primary._conflictType === 'hard' ? '#f87171' : 'var(--gl-amber)';
                    var detail = _primary.reason || (_primary._isAllDay ? 'Busy all day' : (_primary._timeLabel ? 'Busy ' + _primary._timeLabel : 'Busy'));
                    _conflictSummary += '<div style="font-size:0.68em;padding:2px 0;display:flex;align-items:center;gap:4px">'
                        + '<span style="color:' + color + '">' + icon + '</span>'
                        + '<span style="color:var(--gl-text);font-weight:500">' + short + '</span>'
                        + '<span style="color:var(--gl-text-tertiary)">\u2014 ' + detail + '</span></div>';
                    if (_sorted.length > 1) {
                        _conflictSummary += '<div style="font-size:0.6em;color:var(--gl-text-tertiary);padding-left:18px">+ ' + (_sorted.length - 1) + ' more conflict' + (_sorted.length > 2 ? 's' : '') + '</div>';
                    }
                } else {
                    _conflictSummary += '<div style="font-size:0.68em;padding:1px 0;display:flex;align-items:center;gap:4px">'
                        + '<span style="color:var(--gl-green)">\u2714</span>'
                        + '<span style="color:var(--gl-text)">' + short + '</span>'
                        + '<span style="color:var(--gl-text-tertiary)">\u2014 Free</span></div>';
                }
            });
            _conflictSummary += '<div style="height:4px"></div>';
        } else if (!_hasAvailScope && ds >= new Date().toISOString().split('T')[0]) {
            _conflictSummary = '<div style="font-size:0.65em;color:var(--gl-amber);margin-bottom:4px">\u26A0 Availability not enabled \u2014 cannot check conflicts</div>';
        }

        // ── SECTION 1: Existing events + RSVP ──
        var _dateEvents = _calEventsByDate[ds] || [];
        var _existingHtml = '';
        var _bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        var _members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
        if (_dateEvents.length > 0) {
            _dateEvents.forEach(function(ev) {
                var icon = ev.type === 'rehearsal' ? '\uD83C\uDFB8' : ev.type === 'gig' ? '\uD83C\uDFA4' : '\uD83D\uDCCC';
                var label = ev.name || ev.title || (ev.type || 'Event');
                var time = ev.time ? (' \u00B7 ' + ev.time) : '';
                var loc = ev.location ? (' \u00B7 ' + ev.location) : (ev.venue ? (' \u00B7 ' + ev.venue) : '');
                var evId = ev.eventId || ev.id || '';
                _existingHtml += '<div style="padding:8px 8px;margin-bottom:4px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">'
                    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">'
                    + '<span style="font-size:0.85em">' + icon + '</span>'
                    + '<span style="font-size:0.75em;font-weight:600;color:var(--gl-text);flex:1">' + label + '</span>'
                    + '</div>'
                    + (time || loc ? '<div style="font-size:0.65em;color:var(--gl-text-tertiary);margin-bottom:4px">' + (time + loc).replace(/^ \u00B7 /, '') + '</div>' : '');
                // RSVP display
                var _avail = ev.availability || {};
                if (_members.length > 0) {
                    _existingHtml += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px" title="RSVP: \u2714=attending \u2716=not attending ?=maybe \u2022=no response \u2014 click to change">';
                    _members.forEach(function(ref) {
                        var mKey = (typeof ref === 'object') ? ref.key : ref;
                        var name = _bm[mKey] ? _bm[mKey].name : mKey;
                        var short = name.split(' ')[0];
                        var a = _avail[mKey];
                        var status = a ? a.status : null;
                        var rIcon = status === 'yes' ? '\u2714' : status === 'no' ? '\u2716' : status === 'maybe' ? '?' : '\u2022';
                        var rColor = status === 'yes' ? 'var(--gl-green)' : status === 'no' ? '#f87171' : status === 'maybe' ? 'var(--gl-amber)' : 'var(--gl-text-tertiary)';
                        var _nextStatus = !status ? 'yes' : status === 'yes' ? 'no' : status === 'no' ? null : 'yes';
                        var _nextVal = _nextStatus === null ? 'null' : '\'' + _nextStatus + '\'';
                        _existingHtml += '<span onclick="_calToggleRsvp(\'' + evId + '\',\'' + mKey + '\',' + _nextVal + ',\'' + safDs + '\')" style="font-size:0.62em;color:' + rColor + ';cursor:pointer" title="Click to change RSVP (\u2714=yes \u2716=no \u2022=unknown)">' + rIcon + ' ' + short + '</span>';
                    });
                    _existingHtml += '</div>';
                }
                _existingHtml += '<div style="display:flex;gap:6px">'
                    + '<button onclick="calEditEventById(\'' + evId + '\')" style="font-size:0.62em;padding:2px 8px;border-radius:4px;border:1px solid rgba(99,102,241,0.2);background:none;color:#a5b4fc;cursor:pointer;font-family:inherit">Edit</button>'
                    + '<button onclick="_calDeleteFromPanel(\'' + evId + '\',\'' + safDs + '\')" style="font-size:0.62em;padding:2px 8px;border-radius:4px;border:1px solid rgba(239,68,68,0.2);background:none;color:#f87171;cursor:pointer;font-family:inherit">Delete</button>'
                    + '</div></div>';
            });
        }

        // ── SECTION 2: Availability for this date ──
        var _availSection = '';
        var _hasAvailData = (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasFreeBusyScope && GLCalendarSync.hasFreeBusyScope());
        if (!_hasAvailData && blocked.length === 0) {
            // Availability warning shown in conflict summary section below — not duplicated here
            _availSection = '';
        }

        var cardHtml = '<div class="gl-context-card" id="calSelectedDayCard" style="border-left:3px solid ' + borderColor + '">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">'
            + '<span style="font-size:0.82em;font-weight:700;color:var(--gl-text)">' + dateLabel + '</span>'
            + '<button onclick="_calDismissDateSelection()" style="background:none;border:none;color:var(--gl-text-tertiary);cursor:pointer;font-size:0.85em;padding:2px">\u2715</button>'
            + '</div>'
            + '<div class="gl-confidence" style="color:' + hintColor + ';margin-bottom:4px">' + hint + '</div>'
            + _availSection
            + _existingHtml
            + _conflictSummary
            + _extHtml
            + '<div style="display:flex;gap:4px;margin-top:6px">'
            + '<button onclick="calAddEvent(\'' + safDs + '\',null,{type:\'rehearsal\'})" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-size:0.72em;font-weight:700;font-family:inherit">\uD83C\uDFB8 Rehearsal</button>'
            + '<button onclick="calAddEvent(\'' + safDs + '\',null,{type:\'gig\'})" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);color:#fbbf24;cursor:pointer;font-size:0.72em;font-weight:700;font-family:inherit">\uD83C\uDFA4 Gig</button>'
            + '<button onclick="calAddEvent(\'' + safDs + '\')" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--gl-text-dim);cursor:pointer;font-size:0.72em;font-weight:600;font-family:inherit">Other</button>'
            + '</div>'
            + '</div>';

        var existing = document.getElementById('calSelectedDayCard');
        if (existing) { existing.outerHTML = cardHtml; }
        else { var t = document.createElement('div'); t.innerHTML = cardHtml; ctxRail.insertBefore(t.firstElementChild, ctxRail.firstChild); }
    }
}

// ── Mobile date card (bottom sheet) ──────────────────────────────────────────
function _calShowMobileDateCard(ds, y, m, d) {
    var dateObj = new Date(y, m, d);
    var dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    var blocked = _calCachedBlockedRanges ? _calCachedBlockedRanges.filter(function(b) { return b.startDate && b.endDate && ds >= b.startDate && ds <= b.endDate; }) : [];
    var isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    var _ext = _calExternalEventsCache[ds] || [];
    var safDs = ds.replace(/'/g, "\\'");
    var todayStr = new Date().toISOString().split('T')[0];
    var isFuture = ds >= todayStr;

    // Read true state from grid cell (set during render)
    var _cellState = 'default';
    var grid = document.getElementById('calGrid');
    if (grid) {
        var cell = grid.querySelector('[data-date="' + ds + '"]');
        if (cell) _cellState = cell.getAttribute('data-state') || 'default';
    }

    // Build header
    var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
    html += '<div style="font-size:1em;font-weight:700;color:var(--gl-text)">' + dateLabel + '</div>';
    html += '<button onclick="_calCloseMobileCard()" style="background:none;border:none;color:var(--gl-text-tertiary);font-size:1.2em;cursor:pointer;padding:4px">\u2715</button>';
    html += '</div>';

    // State-based message + CTA
    var statusMsg = '';
    var statusColor = 'var(--gl-text-tertiary)';
    var ctaLabel = '';
    var ctaAction = '';

    if (_cellState === 'gig') {
        statusMsg = 'Gig scheduled';
        statusColor = 'var(--gl-amber)';
        ctaLabel = 'View gig details';
        ctaAction = "_calCloseMobileCard();showPage('setlists')";
    } else if (_cellState === 'rehearsal') {
        statusMsg = 'Rehearsal scheduled';
        statusColor = 'var(--gl-indigo)';
        ctaLabel = 'Open rehearsal';
        ctaAction = "_calCloseMobileCard();practicePlanActiveDate='" + safDs + "';showPage('rehearsal')";
    } else if (_cellState === 'blocked') {
        if (blocked.length >= 2) {
            statusMsg = 'Conflicts \u2014 not ideal';
            statusColor = 'var(--gl-red)';
            ctaLabel = 'Schedule anyway';
        } else {
            statusMsg = 'Good option \u2014 minor conflict';
            statusColor = 'var(--gl-amber)';
            ctaLabel = 'Schedule anyway';
        }
        ctaAction = "_calCloseMobileCard();calAddEvent('" + safDs + "')";
    } else if (_cellState === 'best') {
        var _hasExtConflict = _ext.length > 0;
        statusMsg = _hasExtConflict ? 'Open with ' + _ext.length + ' Google event' + (_ext.length > 1 ? 's' : '') : 'Best choice this week';
        statusColor = _hasExtConflict ? 'var(--gl-amber)' : 'var(--gl-green)';
        ctaLabel = 'Schedule rehearsal';
        ctaAction = "_calCloseMobileCard();calAddEvent('" + safDs + "')";
    } else if (!isFuture) {
        statusMsg = 'Past date';
        statusColor = 'var(--gl-text-tertiary)';
    } else {
        statusMsg = 'Open date';
        statusColor = 'var(--gl-text-tertiary)';
        ctaLabel = 'Schedule rehearsal';
        ctaAction = "_calCloseMobileCard();calAddEvent('" + safDs + "')";
    }

    html += '<div style="font-size:0.85em;font-weight:600;color:' + statusColor + ';margin-bottom:10px">' + statusMsg + '</div>';

    // Blocked details
    if (blocked.length) {
        blocked.slice(0, 3).forEach(function(b) {
            html += '<div style="font-size:0.78em;color:var(--gl-text-secondary);padding:2px 0">' + (b.person || 'Member') + (b.reason ? ' \u2014 ' + b.reason : ' unavailable') + '</div>';
        });
    }

    // External Google events
    if (_ext.length) {
        html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--gl-border-subtle);font-size:0.78em;color:var(--gl-text-tertiary)">';
        html += '<div style="font-weight:600;margin-bottom:2px">Google Calendar</div>';
        _ext.slice(0, 4).forEach(function(e) {
            html += '<div>' + (e.title || 'Busy') + (e.time ? ' \u00B7 ' + e.time : '') + '</div>';
        });
        html += '</div>';
    }

    // CTA — quick event type buttons for schedulable dates
    if (ctaLabel && ctaAction && (_cellState === 'best' || _cellState === 'blocked' || _cellState === 'default')) {
        html += '<div style="display:flex;gap:6px;margin-top:12px">';
        html += '<button onclick="_calCloseMobileCard();calAddEvent(\'' + safDs + '\',null,{type:\'rehearsal\'})" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer;font-size:0.82em;font-weight:700;font-family:inherit">\uD83C\uDFB8 Rehearsal</button>';
        html += '<button onclick="_calCloseMobileCard();calAddEvent(\'' + safDs + '\',null,{type:\'gig\'})" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);color:#fbbf24;cursor:pointer;font-size:0.82em;font-weight:700;font-family:inherit">\uD83C\uDFA4 Gig</button>';
        html += '</div>';
    } else if (ctaLabel && ctaAction) {
        html += '<div style="margin-top:12px">';
        html += '<button onclick="' + ctaAction + '" class="gl-btn-primary" style="width:100%">' + ctaLabel + '</button>';
        html += '</div>';
    }

    // Show/create bottom card
    var card = document.getElementById('calMobileCard');
    if (!card) {
        card = document.createElement('div');
        card.id = 'calMobileCard';
        card.className = 'gl-day-mobile-card';
        document.body.appendChild(card);
    }
    card.innerHTML = html;
    card.classList.add('is-open');
    // Close on backdrop tap
    var _backdrop = document.getElementById('calMobileBackdrop');
    if (!_backdrop) {
        _backdrop = document.createElement('div');
        _backdrop.id = 'calMobileBackdrop';
        _backdrop.style.cssText = 'position:fixed;inset:0;z-index:1099;background:rgba(0,0,0,0.3)';
        _backdrop.onclick = function() { _calCloseMobileCard(); };
        document.body.appendChild(_backdrop);
    }
    _backdrop.style.display = 'block';
}

window._calCloseMobileCard = function() {
    var card = document.getElementById('calMobileCard');
    if (card) card.classList.remove('is-open');
    var backdrop = document.getElementById('calMobileBackdrop');
    if (backdrop) backdrop.style.display = 'none';
};

async function calAddEvent(date, editIdx, existing) {
    // Gate: must have an active Google token to create/edit events
    var _hasToken = (typeof accessToken !== 'undefined' && accessToken);
    if (!_hasToken) {
        if (typeof showToast === 'function') showToast('\u26A0 Sign in to Google Calendar first to create events.', 5000);
        // Offer to connect
        if (confirm('You need to sign in to Google Calendar before creating events.\n\nSign in now?')) {
            _calConnectGoogle();
        }
        return;
    }
    // Also check band calendar access
    if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.canWriteBandCalendar) {
        var _canWrite = await GLCalendarSync.canWriteBandCalendar();
        if (!_canWrite) {
            if (typeof showToast === 'function') showToast('\u26A0 You don\u2019t have access to the band calendar. Open Rules to set up access.', 5000);
            return;
        }
    }
    const area = document.getElementById('calEventFormArea');
    if (!area) return;
    const isEdit = editIdx !== undefined;
    const ev = existing || {};
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
        <div class="form-row"><span class="form-label">Type</span><select class="app-select" id="calType" onchange="calTypeChanged(this)">
            <option value="rehearsal" ${(ev.type||'rehearsal')==='rehearsal'?'selected':''}>\uD83C\uDFB8 Rehearsal</option>
            <option value="gig" ${ev.type==='gig'?'selected':''}>\uD83C\uDFA4 Gig</option>
            <option value="meeting" ${ev.type==='meeting'?'selected':''}>\uD83D\uDC65 Meeting</option>
            <option value="other" ${ev.type==='other'?'selected':''}>\uD83D\uDCCC Other</option>
            <option value="_conflict">\uD83D\uDEAB Conflict / Blocked</option>
        </select></div>
        <div class="form-row"><span class="form-label">Title</span><input class="app-input" id="calTitle" placeholder="${_titlePlaceholder}" value="${ev.title||''}"></div>
        <div class="form-row"><span class="form-label">Date</span><input class="app-input" id="calDate" type="date" value="${date||ev.date||''}" style="color-scheme:dark"></div>
        <div class="form-row"><span class="form-label">Time</span><input class="app-input" id="calTime" type="time" value="${ev.time||''}" style="color-scheme:dark"></div>
        <div class="form-row calGigOnly" id="calVenueRow" style="${showVenue?'':'display:none'}">
            <span class="form-label">Venue</span>
            <div id="calVenuePicker"></div>
        </div>
        <div class="form-row calRehearsalOnly" id="calLocationRow" style="${showLocation?'':'display:none'}">
            <span class="form-label">Rehearsal Location</span>
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
            <span class="form-label">Meeting Link</span>
            <input class="app-input" id="calMeetingLink" placeholder="Zoom, Google Meet, etc." value="${ev.meetingLink||''}">
        </div>
        <div class="form-row"><span class="form-label">Repeat</span><select class="app-select" id="calRepeat" onchange="var er=document.getElementById('calRepeatEndRow');if(er)er.style.display=this.value==='none'?'none':''">
            <option value="none" ${repeatVal==='none'?'selected':''}>None</option>
            <option value="weekly" ${repeatVal==='weekly'?'selected':''}>Weekly</option>
            <option value="biweekly" ${repeatVal==='biweekly'?'selected':''}>Every 2 Weeks</option>
            <option value="monthly" ${repeatVal==='monthly'?'selected':''}>Monthly</option>
        </select></div>
        <div class="form-row" id="calRepeatEndRow" style="${repeatVal==='none'?'display:none':''}">
            <span class="form-label">Ends</span>
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
            <span class="form-label">\uD83D\uDCCB Linked Setlist</span>
            <select class="app-select" id="calLinkedSetlist">
                <option value="">-- None --</option>
                ${setlistOpts}
            </select>
        </div>
    </div>
    <div class="form-row"><span class="form-label">Notes</span><textarea class="app-textarea" id="calNotes" placeholder="Optional notes" style="height:60px">${ev.notes||''}</textarea></div>
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
    // Auto-sync to Google Calendar (band calendar)
    if (typeof GLCalendarSync !== 'undefined' && GLCalendarSync.hasCalendarScope()) {
        try {
            var glEvent = {
                summary: ev.title || (ev.type === 'rehearsal' ? 'Rehearsal' : ev.type === 'gig' ? 'Gig' : 'Band Event'),
                date: ev.date,
                startTime: ev.time || '19:00',
                location: ev.location || ev.venue || '',
                description: ev.notes || '',
                type: ev.type
            };
            // Check if already synced (edit) — update instead of create
            var _savedEvt = events.find(function(e) { return e.id === ev.id; }) || ev;
            if (_savedEvt.googleEventId) {
                var upd = await GLCalendarSync.update(_savedEvt.googleEventId, glEvent);
                if (upd.success) {
                    _savedEvt.lastSyncedAt = new Date().toISOString();
                    _savedEvt.syncStatus = 'synced';
                }
            } else {
                var sync = await GLCalendarSync.create(glEvent);
                if (sync.success && sync.sync) {
                    _savedEvt.googleEventId = sync.sync.externalEventId;
                    _savedEvt.calendarId = sync.sync.calendarId;
                    _savedEvt.syncStatus = 'synced';
                    _savedEvt.lastSyncedAt = new Date().toISOString();
                    // Re-save with sync metadata
                    var _updatedEvents = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
                    var _ui = _updatedEvents.findIndex(function(e) { return e.id === ev.id; });
                    if (_ui >= 0) {
                        _updatedEvents[_ui].googleEventId = _savedEvt.googleEventId;
                        _updatedEvents[_ui].calendarId = _savedEvt.calendarId;
                        _updatedEvents[_ui].syncStatus = 'synced';
                        _updatedEvents[_ui].lastSyncedAt = _savedEvt.lastSyncedAt;
                        await saveBandDataToDrive('_band', 'calendar_events', _updatedEvents);
                    }
                }
            }
        } catch(e) {
            console.warn('[Calendar] Google sync failed:', e.message);
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
