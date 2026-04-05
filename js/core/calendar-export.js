// ============================================================================
// js/core/calendar-export.js  v2
// Google Calendar export, ICS download, and subscribe feed helpers.
// GrooveLinx is the source of truth. Google/Apple/Outlook are downstream views.
//
// DEPENDS ON (globals): loadBandDataFromDrive, saveBandDataToDrive, toArray,
//                       generateShortId (utils.js)
// EXPOSES globals:
//   calExportGoogleLink(ev)         → prefilled Google Calendar URL string
//   calExportICS(ev)                → single-event .ics download
//   calExportAllICS(events)         → multi-event .ics download (array)
//   calExportAllICSFromFirebase()   → loads Firebase then downloads all
//   calSubscribeURL(bandSlug)       → stable Worker feed URL for subscription
//   calExportButtonsHTML(ev, key)   → HTML snippet: Google Cal + ICS buttons
//   calShowSubscribeModal(bandSlug) → full subscribe/download modal
//   calEnsureEventId(ev)            → generate + persist stable id if missing
//
// ── Event schema ─────────────────────────────────────────────────────────────
// Current (backward-compatible):
//   { id, date, time, type, title, venue, notes, linkedSetlist,
//     created, updated_at }
//
// Migration target (additive — old events still work, no field removals):
//   { id, start_at, end_at, timezone, updated_at,
//     date, time, type, title, venue, notes, linkedSetlist, created }
//
// _calParseEventTime() transparently handles both schemas.
// calSaveEvent() in calendar.js should be updated to write:
//   start_at  = `${date}T${time}:00`  (local, no Z suffix)
//   end_at    = start_at + 2h (or user-specified)
//   timezone  = 'America/New_York' (or user pref)
//   updated_at = new Date().toISOString()
// ============================================================================

'use strict';

// ── Config ────────────────────────────────────────────────────────────────────

var CAL_WORKER_BASE      = 'https://deadcetera-proxy.drewmerrill.workers.dev';
var CAL_DEFAULT_DURATION = 120;    // minutes when no end time exists
var CAL_DEFAULT_TIME     = '19:00'; // fallback start for date-only events
var CAL_TIMEZONE         = 'America/New_York'; // band local timezone

// ── Stable ID ─────────────────────────────────────────────────────────────────

/**
 * Return a stable ICS UID for an event.
 *
 * Priority:
 *   1. ev.id        — generated at creation, never changes on edits
 *   2. ev.uid       — legacy field
 *   3. ev.created   — stable if present, breaks only if created was never set
 *
 * Intentionally NOT hashing date+title — title or date edits would create a
 * new UID, causing duplicate events in every subscribed calendar.
 *
 * If none of the above exist, a temporary ID is generated for this export.
 * Callers should run calEnsureEventId() to persist it first.
 */
function _calEventUID(ev) {
    var base = ev.id || ev.uid || ev.created || null;
    if (!base) {
        // Ephemeral fallback — not persisted. calEnsureEventId() fixes this.
        base = (typeof generateShortId === 'function') ? generateShortId(12) : Math.random().toString(36).slice(2);
    }
    // Sanitize: UID must be safe for ICS (no spaces, no special chars except - _ .)
    return base.replace(/[^a-zA-Z0-9\-_.]/g, '') + '@groovelinx.band';
}

/**
 * Ensure an event has a stable `id`. If missing, generates one via
 * generateShortId() (utils.js) and persists it to Firebase.
 * Returns the event object with id guaranteed.
 * No-op if id already exists — safe to call on every export.
 */
async function calEnsureEventId(ev) {
    if (ev.id) return ev;
    ev.id = (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36);
    try {
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        // Match by created timestamp + title (most stable identity we have)
        var idx = events.findIndex(function(e) {
            return e.date === ev.date && e.title === ev.title &&
                   (e.created ? e.created === ev.created : true);
        });
        if (idx >= 0 && !events[idx].id) {
            events[idx].id = ev.id;
            events[idx].updated_at = new Date().toISOString();
            await saveBandDataToDrive('_band', 'calendar_events', events);
        }
    } catch (e) {
        console.warn('[calEnsureEventId] Could not persist id:', e.message);
    }
    return ev;
}

// ── Time parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a GrooveLinx event into { start: Date, end: Date }.
 *
 * Handles both schema versions transparently:
 *   Current:  { date: 'YYYY-MM-DD', time: 'HH:MM' }
 *   Future:   { start_at: 'YYYY-MM-DDTHH:MM:00', end_at: '...' }
 *
 * Critical: We construct dates as LOCAL time (no Z suffix).
 * new Date('2026-04-01T19:00:00') = local time in all modern browsers.
 * new Date('2026-04-01T19:00:00Z') = UTC — would shift the displayed time.
 * Google Calendar link dates are always UTC (formatted with Z), so we convert
 * the local Date object to UTC for that specific use.
 *
 * Returns null if date cannot be parsed.
 */
function _calParseEventTime(ev) {
    // Future schema: prefer start_at / end_at
    if (ev.start_at) {
        var s = new Date(ev.start_at);
        if (!isNaN(s.getTime())) {
            var e = ev.end_at ? new Date(ev.end_at) : new Date(s.getTime() + CAL_DEFAULT_DURATION * 60000);
            return { start: s, end: e };
        }
    }
    // Current schema: date + optional time
    if (!ev.date) return null;
    var timeStr = (ev.time && ev.time.length >= 4) ? ev.time : CAL_DEFAULT_TIME;
    // Validate time format — guard against garbage values
    if (!/^\d{1,2}:\d{2}$/.test(timeStr)) timeStr = CAL_DEFAULT_TIME;
    var startLocal = new Date(ev.date + 'T' + timeStr + ':00');
    if (isNaN(startLocal.getTime())) return null;
    var endLocal = new Date(startLocal.getTime() + CAL_DEFAULT_DURATION * 60000);
    return { start: startLocal, end: endLocal };
}

// ── ICS helpers ───────────────────────────────────────────────────────────────

/**
 * Format a JS Date as ICS UTC timestamp: YYYYMMDDTHHMMSSZ
 * Used for DTSTAMP, DTSTART, DTEND when emitting UTC times.
 */
function _icsUTCStr(d) {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Escape ICS text per RFC 5545 §3.3.11:
 * Backslash, semicolon, comma must be escaped.
 * Newlines become literal \n (two characters, not a real newline).
 */
function _icsEsc(str) {
    return (str || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold ICS lines at 75 octets per RFC 5545 §3.1.
 * Continuation lines begin with a single space.
 * Uses \r\n line endings as required by the spec.
 */
function _icsFold(line) {
    if (line.length <= 75) return line;
    var out = [line.slice(0, 75)];
    var i = 75;
    while (i < line.length) {
        out.push(' ' + line.slice(i, i + 74));
        i += 74;
    }
    return out.join('\r\n');
}

/**
 * Build a single VEVENT block for one GrooveLinx event.
 * Includes all required + recommended fields for cross-platform compatibility.
 * Returns empty string if the event has no parseable date.
 */
function _buildVEvent(ev, nowStr) {
    var times = _calParseEventTime(ev);
    if (!times) return '';

    var uid  = _calEventUID(ev);
    var lastMod = ev.updated_at ? _icsUTCStr(new Date(ev.updated_at)) : nowStr;

    // SUMMARY: plain text, no emoji (some clients strip or mangle them)
    var typeLabel = { rehearsal: 'Rehearsal', gig: 'Gig', meeting: 'Meeting', other: 'Event' };
    var summary = (typeLabel[ev.type] || 'Event') + ': ' + (ev.title || 'Untitled');

    // CATEGORIES: maps to Google Calendar color/category if client supports it
    var catMap = { rehearsal: 'REHEARSAL', gig: 'GIG', meeting: 'MEETING', other: 'EVENT' };
    var category = catMap[ev.type] || 'EVENT';

    // DESCRIPTION: multiline, escaped
    var descParts = [];
    if (ev.type) descParts.push('Type: ' + (typeLabel[ev.type] || ev.type));
    if (ev.venue) descParts.push('Venue: ' + ev.venue);
    if (ev.linkedSetlist) descParts.push('Setlist: ' + ev.linkedSetlist);
    if (ev.notes) descParts.push(ev.notes);
    descParts.push('— GrooveLinx Band Calendar');

    var lines = [
        'BEGIN:VEVENT',
        _icsFold('UID:'         + uid),
        _icsFold('DTSTAMP:'     + nowStr),
        _icsFold('LAST-MODIFIED:' + lastMod),
        _icsFold('DTSTART:'     + _icsUTCStr(times.start)),
        _icsFold('DTEND:'       + _icsUTCStr(times.end)),
        _icsFold('SUMMARY:'     + _icsEsc(summary)),
        _icsFold('CATEGORIES:'  + category),
        _icsFold('DESCRIPTION:' + _icsEsc(descParts.join('\n'))),
    ];
    if (ev.venue) lines.push(_icsFold('LOCATION:' + _icsEsc(ev.venue)));
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
    return lines.join('\r\n');
}

/**
 * Wrap one or more VEVENT strings in a VCALENDAR envelope.
 * X-WR-CALNAME sets the display name in Google/Apple Calendar.
 * X-PUBLISHED-TTL hints to clients how often to re-fetch (1 hour).
 */
function _buildVCalendar(vevents, calName) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//GrooveLinx//Band Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        _icsFold('X-WR-CALNAME:' + _icsEsc(calName || 'GrooveLinx Band Calendar')),
        _icsFold('X-WR-TIMEZONE:' + CAL_TIMEZONE),
        'X-PUBLISHED-TTL:PT1H',
        vevents,
        'END:VCALENDAR'
    ].join('\r\n');
}

/**
 * Trigger a browser .ics file download from a string.
 */
function _downloadICS(icsString, filename) {
    var blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a prefilled Google Calendar "Add Event" URL.
 * Opens in new tab — user clicks Save in their own Google Calendar.
 * This is a ONE-TIME ADD. It does not subscribe or auto-update.
 */
/**
 * Generate a prefilled Google Calendar link for an event.
 * Opens in the user's browser — no API access needed.
 *
 * @param {object} ev - Event with: date, time, title, type, venue/location, notes
 * @param {object} [opts] - Optional: { attendees: string[], planSummary: string, bandName: string }
 * @returns {string} Google Calendar URL or '#' if no date
 */
function calExportGoogleLink(ev, opts) {
    var times = _calParseEventTime(ev);
    if (!times) return '#';
    opts = opts || {};

    var typeLabel = { rehearsal: 'Rehearsal', gig: 'Gig', meeting: 'Meeting', other: 'Event' };
    var bandPrefix = opts.bandName ? opts.bandName + ' ' : '';
    var title = bandPrefix + (typeLabel[ev.type] ? typeLabel[ev.type] : 'Event') + (ev.title ? ' \u2014 ' + ev.title : '');

    var descParts = [];
    if (ev.venue || ev.location) descParts.push('Location: ' + (ev.venue || ev.location));
    if (opts.planSummary) descParts.push('Plan: ' + opts.planSummary);
    if (ev.linkedSetlist) descParts.push('Setlist: ' + ev.linkedSetlist);
    if (ev.notes) descParts.push(ev.notes);
    descParts.push('Added from GrooveLinx');

    // Google Calendar dates: YYYYMMDDTHHMMSSZ (UTC)
    var fmt = function(d) { return d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z'; };

    var params = new URLSearchParams({
        action:   'TEMPLATE',
        text:     title,
        dates:    fmt(times.start) + '/' + fmt(times.end),
        details:  descParts.join('\n'),
        location: ev.venue || ev.location || '',
    });

    // Add attendees (band member emails)
    if (opts.attendees && opts.attendees.length) {
        params.set('add', opts.attendees.join(','));
    }

    return 'https://calendar.google.com/calendar/render?' + params.toString();
}

/**
 * Build a Google Calendar link specifically for a rehearsal event.
 * Pulls band name and member emails automatically.
 *
 * @param {object} ev - Rehearsal event { date, time, location, notes }
 * @param {string} [planSummary] - Short plan description (e.g. "Focus on Jack Straw + 2 more")
 * @returns {string} Google Calendar URL
 */
function calBuildRehearsalGoogleLink(ev, planSummary) {
    var bandName = '';
    if (typeof currentBandName !== 'undefined' && currentBandName) bandName = currentBandName;
    else if (typeof window.currentBandSlug !== 'undefined') bandName = window.currentBandSlug;

    var attendees = _calGetBandEmails();

    return calExportGoogleLink(
        { date: ev.date, time: ev.time || '19:00', type: 'rehearsal', title: ev.title || '', venue: ev.location || ev.venue || '', notes: ev.notes || '', linkedSetlist: ev.linkedSetlist || '' },
        { attendees: attendees, planSummary: planSummary || '', bandName: bandName }
    );
}

/**
 * Build a Google Calendar link for a gig.
 */
function calBuildGigGoogleLink(gig) {
    var bandName = '';
    if (typeof currentBandName !== 'undefined' && currentBandName) bandName = currentBandName;
    else if (typeof window.currentBandSlug !== 'undefined') bandName = window.currentBandSlug;

    var attendees = _calGetBandEmails();

    var notes = [];
    if (gig.soundPerson) notes.push('Sound: ' + gig.soundPerson);
    if (gig.contact) notes.push('Contact: ' + gig.contact);
    if (gig.pay) notes.push('Pay: ' + gig.pay);
    if (gig.notes) notes.push(gig.notes);

    return calExportGoogleLink(
        { date: gig.date, time: gig.startTime || gig.arrivalTime || '19:00', type: 'gig', title: gig.venue || '', venue: gig.venue || '', notes: notes.join('\n'), linkedSetlist: gig.setlistId || '' },
        { attendees: attendees, bandName: bandName }
    );
}

/**
 * Get band member emails for calendar invites.
 * Reads from bandMembers global, filters out empty/missing emails.
 */
function _calGetBandEmails() {
    var emails = [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    Object.keys(bm).forEach(function(k) {
        if (bm[k] && bm[k].email) emails.push(bm[k].email);
    });
    return emails;
}

/**
 * Download a single event as a .ics file.
 * Google Calendar, Apple Calendar, Outlook all accept this format.
 * This is a ONE-TIME IMPORT. It will not auto-update when the event changes.
 * For auto-updates, use the Subscribe feed.
 */
function calExportICS(ev) {
    var nowStr = _icsUTCStr(new Date());
    var vevent = _buildVEvent(ev, nowStr);
    if (!vevent) { alert('This event has no date and cannot be exported.'); return; }
    var ics = _buildVCalendar(vevent, ev.title || 'GrooveLinx Event');
    var filename = ((ev.title || 'event').replace(/[^a-z0-9]/gi, '-').toLowerCase()) + '.ics';
    _downloadICS(ics, filename);
}

/**
 * Download all provided events as a single .ics file.
 * Useful as a one-time full-calendar import / fallback when subscribe isn't possible.
 */
function calExportAllICS(events) {
    if (!events || !events.length) { alert('No events to export.'); return; }
    var nowStr   = _icsUTCStr(new Date());
    var vevents  = events.map(function(ev) { return _buildVEvent(ev, nowStr); }).filter(Boolean).join('\r\n');
    var ics      = _buildVCalendar(vevents, 'GrooveLinx Band Calendar');
    _downloadICS(ics, 'groovelinx-band-calendar.ics');
}

/**
 * Load all events from Firebase then trigger a full .ics download.
 * Called from the Subscribe modal's "Download All" button.
 */
async function calExportAllICSFromFirebase() {
    try {
        var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        calExportAllICS(events);
    } catch(e) {
        alert('Could not load events: ' + e.message);
    }
}

/**
 * Return the stable ICS subscription feed URL for a band slug.
 * This URL is permanent — Brian/Pierce subscribe once, events auto-update.
 */
function calSubscribeURL(bandSlug) {
    return CAL_WORKER_BASE + '/ical/' + (bandSlug || 'deadcetera');
}

/**
 * Return an HTML string with Google Cal + ICS download buttons for one event.
 * Uses window-keyed event refs to avoid JSON-in-onclick quoting issues.
 *
 * Usage: someElement.innerHTML += calExportButtonsHTML(ev);
 */
function calExportButtonsHTML(ev, key) {
    var k = key || ('_calExp_' + Date.now());
    window[k] = ev;
    return '<button onclick="(function(){var u=calExportGoogleLink(window[\'' + k + '\']);if(u!==\'#\')window.open(u,\'_blank\');})()" class="btn btn-ghost btn-sm" title="Add this event to your Google Calendar">\uD83D\uDCC5 Add to Google Calendar</button>' +
           '<button onclick="calExportICS(window[\'' + k + '\'])" class="btn btn-ghost btn-sm" title="Download .ics file for any calendar app">\u2B07\uFE0F Download .ics</button>';
}

/**
 * Show the "Sync with Your Calendar" modal.
 * Clearly distinguishes Subscribe (auto-updates) from Download (one-time).
 */
function calShowSubscribeModal(bandSlug) {
    var slug    = bandSlug || (typeof window.currentBandSlug !== 'undefined' ? window.currentBandSlug : 'deadcetera');
    var feedUrl = calSubscribeURL(slug);

    var existing = document.getElementById('calSubscribeModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'calSubscribeModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';

    modal.innerHTML = [
        '<div style="background:var(--bg-card,#1a1a2e);border-radius:16px;padding:24px;max-width:500px;width:100%;',
        'box-shadow:0 12px 48px rgba(0,0,0,0.6);max-height:90vh;overflow-y:auto">',

        // Header
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">',
        '<h2 style="margin:0;font-size:1.1em;font-weight:700">📅 Sync with Your Calendar</h2>',
        '<button onclick="document.getElementById(\'calSubscribeModal\').remove()" ',
        'style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:1.4em;line-height:1">✕</button>',
        '</div>',

        // Two-option explanation
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">',

        // Option A: Subscribe
        '<div style="background:rgba(102,126,234,0.12);border:1px solid rgba(102,126,234,0.35);border-radius:10px;padding:14px">',
        '<div style="font-weight:700;font-size:0.9em;color:var(--accent-light,#a5b4fc);margin-bottom:6px">⭐ Subscribe <span style="font-size:0.75em;font-weight:400;opacity:0.8">(recommended)</span></div>',
        '<div style="font-size:0.8em;color:var(--text-muted,#aaa);line-height:1.5">',
        'Paste the feed URL once. New events and changes appear in your calendar <strong>automatically</strong> — no action needed.',
        '</div>',
        '</div>',

        // Option B: Download
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:14px">',
        '<div style="font-weight:700;font-size:0.9em;color:var(--text-muted,#ccc);margin-bottom:6px">⬇️ Download / Import</div>',
        '<div style="font-size:0.8em;color:var(--text-dim,#888);line-height:1.5">',
        'Download a .ics file and import it. <strong>One-time snapshot</strong> — future changes will not appear automatically.',
        '</div>',
        '</div>',

        '</div>', // end grid

        // Feed URL box
        '<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(102,126,234,0.3);border-radius:8px;padding:12px;margin-bottom:18px">',
        '<div style="font-size:0.72em;color:var(--accent-light,#a5b4fc);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">',
        'Band Calendar Feed URL</div>',
        '<div style="display:flex;align-items:center;gap:8px">',
        '<code id="calFeedUrlText" style="font-size:0.7em;color:#e2e8f0;word-break:break-all;flex:1;',
        'background:rgba(0,0,0,0.4);padding:7px 9px;border-radius:5px;user-select:all">' + feedUrl + '</code>',
        '<button onclick="navigator.clipboard.writeText(\'' + feedUrl + '\')',
        '.then(function(){var b=document.getElementById(\'calCopyBtn\');b.textContent=\'✅\';',
        'setTimeout(function(){b.textContent=\'📋\';},2000)})" ',
        'id="calCopyBtn" style="background:rgba(102,126,234,0.25);border:1px solid rgba(102,126,234,0.4);',
        'color:var(--accent-light,#a5b4fc);border-radius:6px;padding:7px 12px;cursor:pointer;',
        'font-size:0.9em;flex-shrink:0;white-space:nowrap">📋</button>',
        '</div>',
        '</div>',

        // Google Calendar steps
        '<div style="margin-bottom:16px">',
        '<div style="font-weight:700;font-size:0.85em;color:var(--text-muted,#ccc);margin-bottom:10px">',
        'How to subscribe in Google Calendar (desktop):</div>',
        '<ol style="margin:0;padding-left:22px;color:var(--text-muted,#aaa);font-size:0.83em;line-height:2">',
        '<li>Open <strong>calendar.google.com</strong></li>',
        '<li>Left sidebar → <strong>"+ Other calendars"</strong> → <strong>"From URL"</strong></li>',
        '<li>Paste the feed URL above</li>',
        '<li>Click <strong>"Add calendar"</strong></li>',
        '<li>Done — all GrooveLinx events appear automatically 🎉</li>',
        '</ol>',
        '</div>',

        // Other clients
        '<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:11px;margin-bottom:18px;',
        'font-size:0.78em;color:var(--text-dim,#777);line-height:1.7">',
        '<strong style="color:var(--text-muted,#aaa)">🍎 Apple Calendar:</strong> File → New Calendar Subscription → paste URL<br>',
        '<strong style="color:var(--text-muted,#aaa)">📧 Outlook:</strong> Add Calendar → Subscribe from web → paste URL',
        '</div>',

        // Action buttons
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">',
        '<button onclick="calExportAllICSFromFirebase()" class="btn btn-ghost btn-sm">⬇️ Download all events (.ics)</button>',
        '<button onclick="document.getElementById(\'calSubscribeModal\').remove()" class="btn btn-primary btn-sm">Got it!</button>',
        '</div>',

        '</div>', // card
        '</div>'  // modal backdrop
    ].join('');

    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

// ── Window exports ────────────────────────────────────────────────────────────
window.calExportGoogleLink         = calExportGoogleLink;
window.calExportICS                = calExportICS;
window.calExportAllICS             = calExportAllICS;
window.calExportAllICSFromFirebase = calExportAllICSFromFirebase;
window.calSubscribeURL             = calSubscribeURL;
window.calExportButtonsHTML        = calExportButtonsHTML;
window.calShowSubscribeModal       = calShowSubscribeModal;
window.calEnsureEventId            = calEnsureEventId;

console.log('✅ calendar-export.js loaded');
